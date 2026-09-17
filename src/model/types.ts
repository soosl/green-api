export type MessengerId = "telegram" | "whatsapp" | "max";

export type InstanceType = "telegram" | "whatsapp" | "v3";

export interface Credentials {
  messenger: MessengerId;
  apiUrl: string;
  idInstance: string;
  apiTokenInstance: string;
}

export type InstanceState =
  | "authorized"
  | "notAuthorized"
  | "blocked"
  | "suspended"
  | "starting"
  | "pendingPassword";

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
    timestamp: number;
    idMessage?: string;
    instanceData?: {
      idInstance: number;
      wid: string;
      typeInstance: InstanceType;
    };
    senderData?: {
      chatId: string;
      chatType?: string;
      sender?: string;
      chatName?: string;
      senderName?: string;
      senderContactName?: string;
      senderPhoneNumber?: number;
    };
    messageData?: {
      typeMessage: string;
      textMessageData?: {
        textMessage: string;
      };
    };
  };
}

export interface ChatMessage {
  id: string;
  chatId: string;
  text: string;
  direction: "incoming" | "outgoing";
  timestamp: number;
  status?: "sending" | "sent" | "failed";
}
