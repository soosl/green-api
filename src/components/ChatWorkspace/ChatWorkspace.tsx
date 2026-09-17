import {
  ArrowLeft,
  LogOut,
  MessageCircle,
  MoreVertical,
  Send,
  UserRound,
} from "lucide-react";
import type {
  MessengerDefinition,
  ResolvedRecipient,
} from "../../messengers/messengers";

interface ChatWorkspaceProps {
  messenger: MessengerDefinition;
  recipient: ResolvedRecipient;
  onBack: () => void;
  onLogout: () => void;
}

export function ChatWorkspace({
  messenger,
  recipient,
  onBack,
  onLogout,
}: ChatWorkspaceProps) {
  const avatarLetter =
    recipient.displayName.replace(/^[@+]/, "").charAt(0).toUpperCase() || "?";

  return (
    <main className="chat-page">
      <aside className="chat-sidebar">
        <header className="chat-sidebar__header">
          <div className="brand brand--dark">
            <div className="brand__icon brand__icon--blue">
              <MessageCircle aria-hidden="true" />
            </div>

            <span>Green {messenger.label}</span>
          </div>

          <button
            className="icon-button"
            type="button"
            aria-label="Отключиться"
            title="Отключиться"
            onClick={onLogout}
          >
            <LogOut aria-hidden="true" />
          </button>
        </header>

        <div className="chat-sidebar__section-title">Чаты</div>

        <button className="chat-list-item chat-list-item--active" type="button">
          <span className="avatar">{avatarLetter}</span>

          <span className="chat-list-item__content">
            <strong>{recipient.displayName}</strong>
            <small>Чат создан</small>
          </span>
        </button>
      </aside>

      <section className="chat-workspace">
        <header className="chat-header">
          <button
            className="icon-button chat-header__back"
            type="button"
            aria-label="Вернуться назад"
            onClick={onBack}
          >
            <ArrowLeft aria-hidden="true" />
          </button>

          <span className="avatar avatar--small">{avatarLetter}</span>

          <div className="chat-header__contact">
            <strong>{recipient.displayName}</strong>

            <span>
              {messenger.label} · +{recipient.phoneNumber}
            </span>
          </div>

          <button
            className="icon-button"
            type="button"
            aria-label="Дополнительные действия"
            disabled
          >
            <MoreVertical aria-hidden="true" />
          </button>
        </header>

        <div className="messages-area">
          <div className="empty-chat">
            <div className="empty-chat__icon">
              <UserRound aria-hidden="true" />
            </div>

            <h1>{recipient.displayName}</h1>

            <p>Чат успешно создан. Теперь можно отправить первое сообщение.</p>
          </div>
        </div>

        <footer className="message-composer">
          <input
            type="text"
            placeholder="Отправка сообщений — следующий этап"
            disabled
          />

          <button type="button" aria-label="Отправить сообщение" disabled>
            <Send aria-hidden="true" />
          </button>
        </footer>
      </section>
    </main>
  );
}
