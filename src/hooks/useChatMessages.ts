import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GreenApiClient } from "../api/greenApi";
import type { ResolvedRecipient } from "../messengers/messengers";
import type { ChatMessage, Credentials } from "../model/types";

interface UseChatMessagesResult {
  messages: ChatMessage[];
  sendTextMessage: (text: string) => Promise<void>;
  retryMessage: (messageId: string, text: string) => Promise<void>;
}

export function useChatMessages(
  credentials: Credentials,
  recipient: ResolvedRecipient,
): UseChatMessagesResult {
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const activeRequests = useRef(new Set<AbortController>());

  const client = useMemo(() => new GreenApiClient(credentials), [credentials]);

  useEffect(() => {
    const requests = activeRequests.current;

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

  const deliverMessage = useCallback(
    async (messageId: string, text: string) => {
      const controller = new AbortController();
      activeRequests.current.add(controller);

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

        const errorMessage =
          requestError instanceof Error
            ? requestError.message
            : "Не удалось отправить сообщение";

        updateMessage(messageId, {
          status: "failed",
          error: errorMessage,
        });
      } finally {
        activeRequests.current.delete(controller);
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
    sendTextMessage,
    retryMessage,
  };
}
