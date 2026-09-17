import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GreenApiClient } from "../api/greenApi";
import {
  isNotificationForMessenger,
  type MessengerDefinition,
  type ResolvedRecipient,
} from "../messengers/messengers";
import type {
  ChatMessage,
  Credentials,
  IncomingNotification,
} from "../model/types";
import { loadChatMessages, saveChatMessages } from "../storage/chatStorage";

export type NotificationStatus =
  "connecting" | "connected" | "reconnecting" | "mismatch";

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
  return error instanceof Error
    ? error.message
    : "Не удалось получить входящие сообщения";
}

export function useChatMessages(
  credentials: Credentials,
  recipient: ResolvedRecipient,
  messenger: MessengerDefinition,
): UseChatMessagesResult {
  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    loadChatMessages(credentials, recipient.chatId),
  );

  const [notificationStatus, setNotificationStatus] =
    useState<NotificationStatus>("connecting");

  const [notificationError, setNotificationError] = useState<string | null>(
    null,
  );

  const activeSendRequests = useRef(new Set<AbortController>());

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

  const updateMessage = useCallback(
    (messageId: string, patch: Partial<ChatMessage>) => {
      setMessages((currentMessages) =>
        currentMessages.map((message) =>
          message.id === messageId ? { ...message, ...patch } : message,
        ),
      );
    },
    [],
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

      if (!chatId || !text || !apiMessageId || chatId !== recipient.chatId) {
        return;
      }

      setMessages((currentMessages) => {
        const alreadyExists = currentMessages.some(
          (message) =>
            message.chatId === chatId && message.apiMessageId === apiMessageId,
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
    [recipient.chatId],
  );

  const processNotification = useCallback(
    (notification: IncomingNotification) => {
      const notificationInstanceType =
        notification.body.instanceData?.typeInstance;

      if (
        notificationInstanceType &&
        !isNotificationForMessenger(notification, messenger)
      ) {
        throw new Error(
          `Инстанс относится к типу "${notificationInstanceType}", ` +
            `но выбран клиент ${messenger.label}.`,
        );
      }

      appendIncomingMessage(notification);
    },
    [appendIncomingMessage, messenger],
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

          const retryDelay = Math.min(
            1000 * 2 ** (consecutiveFailures - 1),
            10_000,
          );

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
        status: "sending",
        error: undefined,
      });

      try {
        const response = await client.sendMessage(
          recipient.chatId,
          text,
          controller.signal,
        );

        if (controller.signal.aborted) {
          return;
        }

        updateMessage(messageId, {
          apiMessageId: response.idMessage,
          status: "sent",
          error: undefined,
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
