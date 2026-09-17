import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GreenApiClient } from "../api/greenApi";
import {
  isNotificationForMessenger,
  type MessengerDefinition,
  type ResolvedRecipient,
} from "../messengers/messengers";
import type { ChatMessage, Credentials, IncomingNotification, MessageStatus } from "../model/types";
import { loadChatMessages, saveChatMessages } from "../storage/chatStorage";

export type NotificationStatus = "connecting" | "connected" | "reconnecting" | "mismatch";

interface UseChatMessagesResult {
  messages: ChatMessage[];
  notificationStatus: NotificationStatus;
  notificationError: string | null;
  sendTextMessage: (text: string) => Promise<void>;
  retryMessage: (messageId: string, text: string) => Promise<void>;
}

function wait(milliseconds: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) {
      resolve();
      return;
    }

    const timeoutId = window.setTimeout(() => {
      signal.removeEventListener("abort", handleAbort);
      resolve();
    }, milliseconds);

    function handleAbort() {
      window.clearTimeout(timeoutId);
      resolve();
    }

    signal.addEventListener("abort", handleAbort, {
      once: true,
    });
  });
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Не удалось получить входящие сообщения";
}

export function useChatMessages(
  credentials: Credentials,
  recipient: ResolvedRecipient,
  messenger: MessengerDefinition,
): UseChatMessagesResult {
  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    loadChatMessages(credentials, recipient.chatId),
  );

  const [notificationStatus, setNotificationStatus] = useState<NotificationStatus>("connecting");

  const [notificationError, setNotificationError] = useState<string | null>(null);

  const activeSendRequests = useRef(new Set<AbortController>());
  const pendingStatuses = useRef(new Map<string, NormalizedMessageStatus>());

  const client = useMemo(() => new GreenApiClient(credentials), [credentials]);

  useEffect(() => {
    saveChatMessages(credentials, recipient.chatId, messages);
  }, [credentials, recipient.chatId, messages]);

  useEffect(() => {
    const requests = activeSendRequests.current;

    return () => {
      requests.forEach((controller) => controller.abort());

      requests.clear();
    };
  }, []);

  const updateMessage = useCallback((messageId: string, patch: Partial<ChatMessage>) => {
    setMessages((currentMessages) =>
      currentMessages.map((message) =>
        message.id === messageId ? { ...message, ...patch } : message,
      ),
    );
  }, []);

  const isCurrentRecipient = useCallback(
    (chatId?: string) => {
      if (!chatId) {
        return false;
      }

      if (chatId === recipient.chatId) {
        return true;
      }

      return messenger.id === "whatsapp" && chatId === `${recipient.phoneNumber}@c.us`;
    },
    [messenger.id, recipient.chatId, recipient.phoneNumber],
  );

  const appendIncomingMessage = useCallback(
    (notification: IncomingNotification) => {
      const { body } = notification;

      if (body.typeWebhook !== "incomingMessageReceived") {
        return;
      }

      if (body.messageData?.typeMessage !== "textMessage") {
        return;
      }

      const chatId = body.senderData?.chatId;
      const text = body.messageData.textMessageData?.textMessage;
      const apiMessageId = body.idMessage;

      if (!chatId || !text || !apiMessageId || !isCurrentRecipient(chatId)) {
        return;
      }

      setMessages((currentMessages) => {
        const alreadyExists = currentMessages.some(
          (message) => message.chatId === chatId && message.apiMessageId === apiMessageId,
        );

        if (alreadyExists) {
          return currentMessages;
        }

        const incomingMessage: ChatMessage = {
          id: crypto.randomUUID(),
          apiMessageId,
          chatId,
          text,
          direction: "incoming",
          timestamp: body.timestamp ? body.timestamp * 1000 : Date.now(),
          status: "sent",
        };

        return [...currentMessages, incomingMessage];
      });
    },
    [isCurrentRecipient],
  );

  const applyOutgoingStatus = useCallback(
    (notification: IncomingNotification) => {
      const { typeWebhook, idMessage, chatId, status, description } = notification.body;

      if (typeWebhook !== "outgoingMessageStatus" || !idMessage || !status) {
        return;
      }

      // Не применяем статус из другого открытого чата.
      if (chatId && !isCurrentRecipient(chatId)) {
        return;
      }

      const normalizedStatus = normalizeOutgoingStatus(status, description);

      if (!normalizedStatus) {
        return;
      }

      setMessages((currentMessages) => {
        let matched = false;

        const updatedMessages = currentMessages.map((message) => {
          if (message.direction !== "outgoing" || message.apiMessageId !== idMessage) {
            return message;
          }

          matched = true;

          return applyStatusToMessage(message, normalizedStatus);
        });

        const hasPendingOutgoingMessage = currentMessages.some(
          (message) =>
            message.direction === "outgoing" &&
            message.status === "sending" &&
            !message.apiMessageId,
        );

        if (!matched && hasPendingOutgoingMessage) {
          const pendingStatus = pendingStatuses.current.get(idMessage);

          pendingStatuses.current.set(
            idMessage,
            pendingStatus ? selectLatestStatus(pendingStatus, normalizedStatus) : normalizedStatus,
          );
        }

        return updatedMessages;
      });
    },
    [isCurrentRecipient],
  );

  const processNotification = useCallback(
    (notification: IncomingNotification) => {
      const notificationInstanceType = notification.body.instanceData?.typeInstance;

      if (notificationInstanceType && !isNotificationForMessenger(notification, messenger)) {
        throw new Error(
          `Инстанс относится к типу "${notificationInstanceType}", ` +
            `но выбран клиент ${messenger.label}.`,
        );
      }

      if (notification.body.typeWebhook === "outgoingMessageStatus") {
        applyOutgoingStatus(notification);
        return;
      }

      appendIncomingMessage(notification);
    },
    [appendIncomingMessage, applyOutgoingStatus, messenger],
  );

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;

    let consecutiveFailures = 0;

    async function pollNotifications() {
      while (!signal.aborted) {
        try {
          const notification = await client.receiveNotification(signal);

          if (signal.aborted) {
            return;
          }

          consecutiveFailures = 0;
          setNotificationStatus("connected");
          setNotificationError(null);

          if (!notification) {
            continue;
          }

          try {
            processNotification(notification);
          } catch (processingError) {
            setNotificationStatus("mismatch");
            setNotificationError(getErrorMessage(processingError));

            return;
          }

          await client.deleteNotification(notification.receiptId, signal);
        } catch (requestError) {
          if (signal.aborted) {
            return;
          }

          consecutiveFailures += 1;

          const retryDelay = Math.min(1000 * 2 ** (consecutiveFailures - 1), 10_000);

          setNotificationStatus("reconnecting");
          setNotificationError(getErrorMessage(requestError));

          await wait(retryDelay, signal);
        }
      }
    }

    void pollNotifications();

    return () => {
      controller.abort();
    };
  }, [client, processNotification]);

  const deliverMessage = useCallback(
    async (messageId: string, text: string) => {
      const controller = new AbortController();

      activeSendRequests.current.add(controller);

      updateMessage(messageId, {
        apiMessageId: undefined,
        status: "sending",
        error: undefined,
      });

      try {
        const response = await client.sendMessage(recipient.chatId, text, controller.signal);

        if (controller.signal.aborted) {
          return;
        }

        setMessages((currentMessages) => {
          const pendingStatus = pendingStatuses.current.get(response.idMessage);

          if (pendingStatus) {
            pendingStatuses.current.delete(response.idMessage);
          }

          return currentMessages.map((message) => {
            if (message.id !== messageId) {
              return message;
            }

            const sentMessage: ChatMessage = {
              ...message,
              apiMessageId: response.idMessage,
              status: "sent",
              error: undefined,
            };

            return pendingStatus ? applyStatusToMessage(sentMessage, pendingStatus) : sentMessage;
          });
        });
      } catch (requestError) {
        if (controller.signal.aborted) {
          return;
        }

        updateMessage(messageId, {
          status: "failed",
          error: getErrorMessage(requestError),
        });
      } finally {
        activeSendRequests.current.delete(controller);
      }
    },
    [client, recipient.chatId, updateMessage],
  );

  const sendTextMessage = useCallback(
    async (text: string) => {
      const message: ChatMessage = {
        id: crypto.randomUUID(),
        chatId: recipient.chatId,
        text,
        direction: "outgoing",
        timestamp: Date.now(),
        status: "sending",
      };

      setMessages((currentMessages) => [...currentMessages, message]);

      await deliverMessage(message.id, message.text);
    },
    [deliverMessage, recipient.chatId],
  );

  const retryMessage = useCallback(
    async (messageId: string, text: string) => {
      await deliverMessage(messageId, text);
    },
    [deliverMessage],
  );

  return {
    messages,
    notificationStatus,
    notificationError,
    sendTextMessage,
    retryMessage,
  };
}
const statusPriority: Record<MessageStatus, number> = {
  sending: 0,
  sent: 1,
  delivered: 2,
  read: 3,
  failed: 4,
};

interface NormalizedMessageStatus {
  status: MessageStatus;
  error?: string;
}

function selectLatestStatus(
  currentStatus: NormalizedMessageStatus,
  nextStatus: NormalizedMessageStatus,
): NormalizedMessageStatus {
  if (nextStatus.status === "failed") {
    return nextStatus;
  }

  if (currentStatus.status === "failed") {
    return currentStatus;
  }

  return statusPriority[nextStatus.status] >= statusPriority[currentStatus.status]
    ? nextStatus
    : currentStatus;
}

function applyStatusToMessage(
  message: ChatMessage,
  nextStatus: NormalizedMessageStatus,
): ChatMessage {
  const latestStatus = selectLatestStatus(
    {
      status: message.status ?? "sent",
      error: message.error,
    },
    nextStatus,
  );

  if (latestStatus.status === message.status && latestStatus.error === message.error) {
    return message;
  }

  return {
    ...message,
    status: latestStatus.status,
    error: latestStatus.error,
  };
}

function normalizeOutgoingStatus(
  status: string,
  description?: string,
): NormalizedMessageStatus | null {
  switch (status) {
    case "sent":
      return { status: "sent" };

    case "delivered":
      return { status: "delivered" };

    case "read":
      return { status: "read" };

    case "failed":
      return {
        status: "failed",
        error: description || "Не удалось доставить сообщение",
      };

    case "noAccount":
      return {
        status: "failed",
        error: description || "У получателя нет аккаунта в выбранном мессенджере",
      };

    case "suspended":
      return {
        status: "failed",
        error: description || "Аккаунт отправителя временно заблокирован",
      };

    case "notInGroup":
      return {
        status: "failed",
        error: description || "Отправитель больше не состоит в группе",
      };

    case "yellowCard":
      return {
        status: "failed",
        error: description || "Отправка сообщения ограничена мессенджером",
      };

    default:
      // Неизвестный будущий статус не ломает приложение.
      return null;
  }
}
