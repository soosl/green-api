export type MessengerId = "telegram" | "whatsapp";

export type InstanceType = "telegram" | "whatsapp";

export interface Credentials {
  messenger: MessengerId;
  apiUrl: string;
  idInstance: string;
  apiTokenInstance: string;
}

export type InstanceState =
  "authorized" | "notAuthorized" | "blocked" | "suspended" | "starting" | "pendingPassword";

export interface InstanceStateResponse {
  stateInstance: InstanceState;
}

export interface SendMessageResponse {
  idMessage: string;
}

export interface IncomingNotification {
  receiptId: number;
  body: {
    typeWebhook: string;
    timestamp?: number;
    idMessage?: string;

    instanceData?: {
      idInstance?: number;
      wid?: string;
      typeInstance?: InstanceType;
    };

    // Статусы исходящих сообщений приходят на верхнем уровне body
    chatId?: string;
    status?: string;
    description?: string;
    sendByApi?: boolean;

    senderData?: {
      chatId?: string;
      sender?: string;
      senderName?: string;
    };

    messageData?: {
      typeMessage?: string;
      textMessageData?: {
        textMessage?: string;
      };
      extendedTextMessageData?: {
        text?: string;
      };
    };
  };
}

export interface ChatMessage {
  id: string;
  apiMessageId?: string;
  chatId: string;
  text: string;
  direction: "incoming" | "outgoing";
  timestamp: number;
  status?: MessageStatus;
  error?: string;
}

export type MessageStatus = "sending" | "sent" | "delivered" | "read" | "failed";
