import { useState } from "react";
import {
  LogOut,
  MessageCircle,
  MessagesSquare,
  Plus,
  ShieldCheck,
} from "lucide-react";
import { AuthForm } from "../components/AuthForm/AuthForm";
import { ChatWorkspace } from "../components/ChatWorkspace/ChatWorkspace";
import { NewChatForm } from "../components/NewChatForm/NewChatForm";
import {
  getMessengerDefinition,
  type ResolvedRecipient,
} from "../messengers/messengers";
import type { Credentials } from "../model/types";
import {
  clearChatSession,
  loadActiveRecipient,
  saveActiveRecipient,
} from "../storage/chatStorage";
import {
  clearCredentials,
  loadCredentials,
  saveCredentials,
} from "../storage/credentials";
import ui from "../styles/ui.module.css";
import styles from "./App.module.css";

interface AppSession {
  credentials: Credentials | null;
  recipient: ResolvedRecipient | null;
  savedRecipient: ResolvedRecipient | null;
}

function loadInitialSession(): AppSession {
  const credentials = loadCredentials();

  if (!credentials) {
    return {
      credentials: null,
      recipient: null,
      savedRecipient: null,
    };
  }

  const savedRecipient = loadActiveRecipient(credentials);

  return {
    credentials,
    recipient: savedRecipient,
    savedRecipient,
  };
}

export const App = () => {
  const [session, setSession] = useState<AppSession>(loadInitialSession);

  const [isNewChatOpen, setIsNewChatOpen] = useState(false);

  const { credentials, recipient, savedRecipient } = session;

  function handleConnected(nextCredentials: Credentials) {
    saveCredentials(nextCredentials);

    const restoredRecipient = loadActiveRecipient(nextCredentials);

    setSession({
      credentials: nextCredentials,
      recipient: restoredRecipient,
      savedRecipient: restoredRecipient,
    });

    setIsNewChatOpen(false);
  }

  function handleChatCreated(nextRecipient: ResolvedRecipient) {
    if (!credentials) {
      return;
    }

    saveActiveRecipient(credentials, nextRecipient);

    setSession((currentSession) => ({
      ...currentSession,
      recipient: nextRecipient,
      savedRecipient: nextRecipient,
    }));

    setIsNewChatOpen(false);
  }

  function handleBack() {
    setSession((currentSession) => ({
      ...currentSession,
      recipient: null,
    }));
  }

  function handleContinueChat() {
    if (!savedRecipient) {
      return;
    }

    setSession((currentSession) => ({
      ...currentSession,
      recipient: savedRecipient,
    }));
  }

  function handleLogout() {
    if (credentials) {
      clearChatSession(credentials);
    }

    clearCredentials();

    setSession({
      credentials: null,
      recipient: null,
      savedRecipient: null,
    });

    setIsNewChatOpen(false);
  }

  if (!credentials) {
    return <AuthForm onConnected={handleConnected} />;
  }

  const messenger = getMessengerDefinition(credentials.messenger);

  if (recipient) {
    return (
      <ChatWorkspace
        credentials={credentials}
        messenger={messenger}
        recipient={recipient}
        onBack={handleBack}
        onLogout={handleLogout}
      />
    );
  }

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <div className={styles.statusIcon}>
          <ShieldCheck aria-hidden="true" />
        </div>

        <span className={ui.eyebrow}>ПОДКЛЮЧЕНИЕ УСТАНОВЛЕНО</span>

        <h1>{messenger.label}-инстанс готов</h1>

        <p className={styles.description}>
          Данные проверены. Можно продолжить существующий чат или создать новый.
        </p>

        <dl className={styles.instanceInfo}>
          <div>
            <dt>Мессенджер</dt>
            <dd>{messenger.label}</dd>
          </div>

          <div>
            <dt>Инстанс</dt>
            <dd>{credentials.idInstance}</dd>
          </div>

          <div>
            <dt>API-сервер</dt>
            <dd>{credentials.apiUrl}</dd>
          </div>
        </dl>

        {isNewChatOpen ? (
          <NewChatForm
            credentials={credentials}
            messenger={messenger}
            onCreated={handleChatCreated}
            onCancel={() => setIsNewChatOpen(false)}
          />
        ) : (
          <div className={styles.actions}>
            {savedRecipient && (
              <button
                className={ui.primaryButton}
                type="button"
                onClick={handleContinueChat}
              >
                <MessagesSquare aria-hidden="true" />
                Продолжить чат
              </button>
            )}

            <button
              className={savedRecipient ? ui.secondaryButton : ui.primaryButton}
              type="button"
              onClick={() => setIsNewChatOpen(true)}
            >
              {savedRecipient ? (
                <Plus aria-hidden="true" />
              ) : (
                <MessageCircle aria-hidden="true" />
              )}
              Новый чат
            </button>

            <button
              className={ui.secondaryButton}
              type="button"
              onClick={handleLogout}
            >
              <LogOut aria-hidden="true" />
              Отключиться
            </button>
          </div>
        )}
      </section>
    </main>
  );
};
