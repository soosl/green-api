import type { Credentials, MessengerId } from "../model/types";

const STORAGE_KEY = "green-api-chat-credentials";
const LEGACY_STORAGE_KEY = "green-api-telegram-credentials";

const messengerIds: MessengerId[] = ["telegram", "whatsapp", "max"];

function isMessengerId(value: unknown): value is MessengerId {
  return (
    typeof value === "string" && messengerIds.includes(value as MessengerId)
  );
}

export function saveCredentials(credentials: Credentials): void {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(credentials));
}

export function loadCredentials(): Credentials | null {
  const value =
    sessionStorage.getItem(STORAGE_KEY) ??
    sessionStorage.getItem(LEGACY_STORAGE_KEY);

  if (!value) {
    return null;
  }

  try {
    const stored = JSON.parse(value) as Partial<Credentials>;

    if (
      typeof stored.apiUrl !== "string" ||
      typeof stored.idInstance !== "string" ||
      typeof stored.apiTokenInstance !== "string"
    ) {
      return null;
    }

    return {
      messenger: isMessengerId(stored.messenger)
        ? stored.messenger
        : "telegram",
      apiUrl: stored.apiUrl,
      idInstance: stored.idInstance,
      apiTokenInstance: stored.apiTokenInstance,
    };
  } catch {
    return null;
  }
}

export function clearCredentials(): void {
  sessionStorage.removeItem(STORAGE_KEY);
  sessionStorage.removeItem(LEGACY_STORAGE_KEY);
}
