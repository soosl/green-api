import type { ResolvedRecipient } from "../messengers/messengers";
import type { ChatMessage, Credentials } from "../model/types";

const STORAGE_VERSION = "v1";
const MAX_STORED_MESSAGES = 200;

function getInstanceScope(credentials: Credentials): string {
  return [STORAGE_VERSION, credentials.messenger, credentials.idInstance].join(
    ":",
  );
}

function getActiveRecipientKey(credentials: Credentials): string {
  return `green-api:active-recipient:${getInstanceScope(credentials)}`;
}

function getMessagesKey(credentials: Credentials, chatId: string): string {
  return (
    `green-api:messages:${getInstanceScope(credentials)}:` +
    encodeURIComponent(chatId)
  );
}

function isResolvedRecipient(value: unknown): value is ResolvedRecipient {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const recipient = value as Partial<ResolvedRecipient>;

  return (
    typeof recipient.chatId === "string" &&
    typeof recipient.displayName === "string" &&
    typeof recipient.phoneNumber === "string"
  );
}

function isChatMessage(value: unknown): value is ChatMessage {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const message = value as Partial<ChatMessage>;

  return (
    typeof message.id === "string" &&
    typeof message.chatId === "string" &&
    typeof message.text === "string" &&
    typeof message.timestamp === "number" &&
    (message.direction === "incoming" || message.direction === "outgoing")
  );
}

function normalizeRestoredMessage(message: ChatMessage): ChatMessage {
  if (message.status !== "sending") {
    return message;
  }

  return {
    ...message,
    status: "failed",
    error: "Отправка была прервана обновлением страницы",
  };
}

export function saveActiveRecipient(
  credentials: Credentials,
  recipient: ResolvedRecipient,
): void {
  try {
    sessionStorage.setItem(
      getActiveRecipientKey(credentials),
      JSON.stringify(recipient),
    );
  } catch (err) {
    console.log(err);
  }
}

export function loadActiveRecipient(
  credentials: Credentials,
): ResolvedRecipient | null {
  try {
    const value = sessionStorage.getItem(getActiveRecipientKey(credentials));

    if (!value) {
      return null;
    }

    const recipient = JSON.parse(value) as unknown;

    return isResolvedRecipient(recipient) ? recipient : null;
  } catch {
    return null;
  }
}

export function saveChatMessages(
  credentials: Credentials,
  chatId: string,
  messages: ChatMessage[],
): void {
  try {
    const messagesToStore = messages.slice(-MAX_STORED_MESSAGES);

    sessionStorage.setItem(
      getMessagesKey(credentials, chatId),
      JSON.stringify(messagesToStore),
    );
  } catch (err) {
    console.log(err);
  }
}

export function loadChatMessages(
  credentials: Credentials,
  chatId: string,
): ChatMessage[] {
  try {
    const value = sessionStorage.getItem(getMessagesKey(credentials, chatId));

    if (!value) {
      return [];
    }

    const parsed = JSON.parse(value) as unknown;

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter(isChatMessage)
      .map(normalizeRestoredMessage)
      .slice(-MAX_STORED_MESSAGES);
  } catch {
    return [];
  }
}

export function clearChatSession(credentials: Credentials): void {
  const instanceScope = getInstanceScope(credentials);

  try {
    const keysToRemove: string[] = [];

    for (let index = 0; index < sessionStorage.length; index += 1) {
      const key = sessionStorage.key(index);

      if (key?.includes(instanceScope)) {
        keysToRemove.push(key);
      }
    }

    keysToRemove.forEach((key) => sessionStorage.removeItem(key));
  } catch (err) {
    console.log(err);
  }
}
