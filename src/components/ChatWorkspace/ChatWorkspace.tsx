import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  LoaderCircle,
  LogOut,
  MessageCircle,
  MoreVertical,
  RotateCcw,
  Send,
  UserRound,
} from "lucide-react";
import { useChatMessages } from "../../hooks/useChatMessages";
import type {
  MessengerDefinition,
  ResolvedRecipient,
} from "../../messengers/messengers";
import type { ChatMessage, Credentials } from "../../model/types";
import ui from "../../styles/ui.module.css";
import styles from "./ChatWorkspace.module.css";

interface ChatWorkspaceProps {
  credentials: Credentials;
  messenger: MessengerDefinition;
  recipient: ResolvedRecipient;
  onBack: () => void;
  onLogout: () => void;
}

const timeFormatter = new Intl.DateTimeFormat("ru-RU", {
  hour: "2-digit",
  minute: "2-digit",
});

function MessageStatus({ message }: { message: ChatMessage }) {
  if (message.status === "sending") {
    return (
      <LoaderCircle
        className={`${styles.messageStatus} ${styles.messageStatusLoading}`}
        aria-label="Отправляется"
      />
    );
  }

  if (message.status === "failed") {
    return (
      <AlertCircle
        className={`${styles.messageStatus} ${styles.messageStatusFailed}`}
        aria-label="Ошибка отправки"
      />
    );
  }

  return <Check className={styles.messageStatus} aria-label="Отправлено" />;
}

export function ChatWorkspace({
  credentials,
  messenger,
  recipient,
  onBack,
  onLogout,
}: ChatWorkspaceProps) {
  const [draft, setDraft] = useState("");
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const { messages, sendTextMessage, retryMessage } = useChatMessages(
    credentials,
    recipient,
  );

  const avatarLetter =
    recipient.displayName.replace(/^[@+]/, "").charAt(0).toUpperCase() || "?";
  const normalizedDraft = draft.trim();
  const isTooLong = draft.length > messenger.messageMaxLength;
  const canSend = normalizedDraft.length > 0 && !isTooLong;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, [messages]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canSend) {
      return;
    }

    setDraft("");
    void sendTextMessage(normalizedDraft);
  }

  function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }

  return (
    <main className={styles.page}>
      <aside className={styles.sidebar}>
        <header className={styles.sidebarHeader}>
          <div className={`${ui.brand} ${styles.brandDark}`}>
            <div className={`${ui.brandIcon} ${styles.brandIconBlue}`}>
              <MessageCircle aria-hidden="true" />
            </div>
            <span>Green {messenger.label}</span>
          </div>

          <button
            className={ui.iconButton}
            type="button"
            aria-label="Отключиться"
            title="Отключиться"
            onClick={onLogout}
          >
            <LogOut aria-hidden="true" />
          </button>
        </header>

        <div className={styles.sectionTitle}>Чаты</div>

        <button className={styles.chatListItem} type="button">
          <span className={styles.avatar}>{avatarLetter}</span>
          <span className={styles.chatListContent}>
            <strong>{recipient.displayName}</strong>
            <small>
              {messages.length > 0 ? messages.at(-1)?.text : "Чат создан"}
            </small>
          </span>
        </button>
      </aside>

      <section className={styles.workspace}>
        <header className={styles.header}>
          <button
            className={`${ui.iconButton} ${styles.backButton}`}
            type="button"
            aria-label="Вернуться назад"
            onClick={onBack}
          >
            <ArrowLeft aria-hidden="true" />
          </button>

          <span className={`${styles.avatar} ${styles.avatarSmall}`}>
            {avatarLetter}
          </span>

          <div className={styles.contact}>
            <strong>{recipient.displayName}</strong>
            <span>
              {messenger.label} · +{recipient.phoneNumber}
            </span>
          </div>

          <button
            className={ui.iconButton}
            type="button"
            aria-label="Дополнительные действия"
            disabled
          >
            <MoreVertical aria-hidden="true" />
          </button>
        </header>

        <div className={styles.messagesArea} aria-live="polite">
          {messages.length === 0 ? (
            <div className={styles.emptyChat}>
              <div className={styles.emptyChatIcon}>
                <UserRound aria-hidden="true" />
              </div>
              <h1>{recipient.displayName}</h1>
              <p>Чат создан. Отправьте первое текстовое сообщение.</p>
            </div>
          ) : (
            <div className={styles.messagesList}>
              {messages.map((message) => {
                const rowClassName =
                  message.direction === "outgoing"
                    ? `${styles.messageRow} ${styles.messageRowOutgoing}`
                    : styles.messageRow;
                const bubbleClassName = [
                  styles.messageBubble,
                  message.direction === "outgoing"
                    ? styles.messageBubbleOutgoing
                    : "",
                  message.status === "failed" ? styles.messageBubbleFailed : "",
                ]
                  .filter(Boolean)
                  .join(" ");

                return (
                  <article key={message.id} className={rowClassName}>
                    <div className={bubbleClassName}>
                      <p>{message.text}</p>

                      <div className={styles.messageMeta}>
                        <time
                          dateTime={new Date(message.timestamp).toISOString()}
                        >
                          {timeFormatter.format(message.timestamp)}
                        </time>
                        <MessageStatus message={message} />
                      </div>

                      {message.status === "failed" && (
                        <div className={styles.messageError}>
                          <span>{message.error ?? "Ошибка отправки"}</span>
                          <button
                            type="button"
                            onClick={() =>
                              void retryMessage(message.id, message.text)
                            }
                          >
                            <RotateCcw aria-hidden="true" />
                            Повторить
                          </button>
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        <form className={styles.composer} onSubmit={handleSubmit}>
          <div className={styles.composerField}>
            <textarea
              rows={1}
              value={draft}
              placeholder="Сообщение"
              aria-label="Текст сообщения"
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={handleComposerKeyDown}
            />
            <span
              className={
                isTooLong
                  ? `${styles.composerCounter} ${styles.composerCounterError}`
                  : styles.composerCounter
              }
            >
              {draft.length}/{messenger.messageMaxLength}
            </span>
          </div>

          <button
            className={styles.sendButton}
            type="submit"
            aria-label="Отправить сообщение"
            disabled={!canSend}
          >
            <Send aria-hidden="true" />
          </button>
        </form>
      </section>
    </main>
  );
}
