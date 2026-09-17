import type {
  Credentials,
  IncomingNotification,
  InstanceStateResponse,
  SendMessageResponse,
} from "../model/types";

export class GreenApiError extends Error {
  public readonly status: number;
  public readonly response?: unknown;

  constructor(message: string, status: number, response?: unknown) {
    super(message);

    this.name = "GreenApiError";
    this.status = status;
    this.response = response;
  }
}

function normalizeApiUrl(apiUrl: string): string {
  return apiUrl.trim().replace(/\/+$/, "");
}

async function readResponse(response: Response): Promise<unknown> {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function getApiErrorMessage(body: unknown, status: number): string {
  if (typeof body !== "object" || body === null) {
    return `GREEN-API вернул ошибку ${status}`;
  }

  for (const field of ["message", "reason", "description"] as const) {
    if (field in body) {
      const value = (body as Record<string, unknown>)[field];

      if (typeof value === "string") {
        return value;
      }
    }
  }

  return `GREEN-API вернул ошибку ${status}`;
}

export class GreenApiClient {
  private readonly apiUrl: string;
  private readonly credentials: Credentials;

  constructor(credentials: Credentials) {
    this.credentials = credentials;
    this.apiUrl = normalizeApiUrl(credentials.apiUrl);
  }

  private buildUrl(method: string, suffix = ""): string {
    const { idInstance, apiTokenInstance } = this.credentials;

    return (
      `${this.apiUrl}/waInstance${idInstance}` +
      `/${method}/${encodeURIComponent(apiTokenInstance)}${suffix}`
    );
  }

  private async request<T>(url: string, init?: RequestInit): Promise<T> {
    let response: Response;

    try {
      response = await fetch(url, init);
    } catch {
      throw new GreenApiError(
        "Не удалось подключиться к GREEN-API. Проверьте apiUrl и интернет-соединение.",
        0,
      );
    }

    const body = await readResponse(response);

    if (!response.ok) {
      throw new GreenApiError(getApiErrorMessage(body, response.status), response.status, body);
    }

    return body as T;
  }

  get<T>(method: string, signal?: AbortSignal, suffix = ""): Promise<T> {
    return this.request<T>(this.buildUrl(method, suffix), { signal });
  }

  post<T>(method: string, body: unknown, signal?: AbortSignal): Promise<T> {
    return this.request<T>(this.buildUrl(method), {
      method: "POST",
      signal,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  }

  delete<T>(method: string, suffix: string, signal?: AbortSignal): Promise<T> {
    return this.request<T>(this.buildUrl(method, suffix), {
      method: "DELETE",
      signal,
    });
  }

  getStateInstance(signal?: AbortSignal): Promise<InstanceStateResponse> {
    return this.get<InstanceStateResponse>("getStateInstance", signal);
  }

  sendMessage(chatId: string, message: string, signal?: AbortSignal): Promise<SendMessageResponse> {
    return this.post<SendMessageResponse>("sendMessage", { chatId, message }, signal);
  }

  receiveNotification(signal?: AbortSignal): Promise<IncomingNotification | null> {
    return this.get<IncomingNotification | null>("receiveNotification", signal);
  }

  async deleteNotification(receiptId: number, signal?: AbortSignal): Promise<void> {
    await this.delete<boolean>("deleteNotification", `/${receiptId}`, signal);
  }
}
