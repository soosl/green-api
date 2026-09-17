import type { GreenApiClient } from "../api/greenApi";
import type { IncomingNotification, InstanceType, MessengerId } from "../model/types";

export interface ResolvedRecipient {
  chatId: string;
  displayName: string;
  phoneNumber: string;
}

export interface MessengerDefinition {
  id: MessengerId;
  label: string;
  instanceType: InstanceType;
  recipientLabel: string;
  recipientPlaceholder: string;
  messageMaxLength: number;
  resolveRecipient: (
    client: GreenApiClient,
    value: string,
    signal?: AbortSignal,
  ) => Promise<ResolvedRecipient>;
}

interface CheckAccountResponse {
  exist?: boolean;
  chatId?: string;
  username?: string;
  phoneNumber?: number;
  status?: boolean;
  reason?: string;
}

interface CheckWhatsappResponse {
  existsWhatsapp?: boolean;
  chatId?: string;
  username?: string;
  phoneNumber?: string;
  fromCache?: boolean;
}

function normalizePhoneNumber(value: string): string {
  const phoneNumber = value.replace(/\D/g, "");

  if (!phoneNumber) {
    throw new Error("Введите номер телефона в международном формате");
  }

  if (phoneNumber.length < 7 || phoneNumber.length > 16) {
    throw new Error("Проверьте формат номера телефона");
  }

  return phoneNumber;
}

async function resolveWithCheckAccount(
  client: GreenApiClient,
  value: string,
  messengerName: string,
  signal?: AbortSignal,
): Promise<ResolvedRecipient> {
  const phoneNumber = normalizePhoneNumber(value);
  const response = await client.post<CheckAccountResponse>(
    "checkAccount",
    { phoneNumber: Number(phoneNumber) },
    signal,
  );

  if (response.status === false) {
    throw new Error(response.reason ?? `Не удалось проверить аккаунт ${messengerName}`);
  }

  if (!response.exist || !response.chatId) {
    throw new Error(`На этом номере не найден аккаунт ${messengerName}`);
  }

  return {
    chatId: response.chatId,
    displayName: response.username || `+${phoneNumber}`,
    phoneNumber,
  };
}

async function resolveWhatsappRecipient(
  client: GreenApiClient,
  value: string,
  signal?: AbortSignal,
): Promise<ResolvedRecipient> {
  const phoneNumber = normalizePhoneNumber(value);
  const response = await client.post<CheckWhatsappResponse>(
    "checkWhatsapp",
    { phoneNumber: Number(phoneNumber) },
    signal,
  );

  if (!response.existsWhatsapp) {
    throw new Error("На этом номере не найден аккаунт WhatsApp");
  }

  return {
    chatId: response.chatId || `${phoneNumber}@c.us`,
    displayName: response.username || `+${phoneNumber}`,
    phoneNumber,
  };
}

export const MESSENGERS: Record<MessengerId, MessengerDefinition> = {
  telegram: {
    id: "telegram",
    label: "Telegram",
    instanceType: "telegram",
    recipientLabel: "Номер телефона Telegram",
    recipientPlaceholder: "+7 999 123-45-67",
    messageMaxLength: 4096,
    resolveRecipient: (client, value, signal) =>
      resolveWithCheckAccount(client, value, "Telegram", signal),
  },
  whatsapp: {
    id: "whatsapp",
    label: "WhatsApp",
    instanceType: "whatsapp",
    recipientLabel: "Номер телефона WhatsApp",
    recipientPlaceholder: "+7 999 123-45-67",
    messageMaxLength: 20_000,
    resolveRecipient: resolveWhatsappRecipient,
  },
};

export const MESSENGER_OPTIONS = Object.values(MESSENGERS);

export function getMessengerDefinition(messenger: MessengerId): MessengerDefinition {
  return MESSENGERS[messenger];
}

export function isNotificationForMessenger(
  notification: IncomingNotification,
  messenger: MessengerDefinition,
): boolean {
  return notification.body.instanceData?.typeInstance === messenger.instanceType;
}
