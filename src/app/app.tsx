import { useState } from "react";
import { LogOut, MessageCircle, ShieldCheck } from "lucide-react";
import { AuthForm } from "../components/AuthForm/AuthForm";
import { ChatWorkspace } from "../components/ChatWorkspace/ChatWorkspace";
import { NewChatForm } from "../components/NewChatForm/NewChatForm";
import {
  getMessengerDefinition,
  type ResolvedRecipient,
} from "../messengers/messengers";
import type { Credentials } from "../model/types";
import {
  clearCredentials,
  loadCredentials,
  saveCredentials,
} from "../storage/credentials";
import styles from "./App.module.css";
import ui from "../styles/ui.module.css";

export const App = () => {
  const [credentials, setCredentials] = useState<Credentials | null>(
    loadCredentials,
  );
  const [recipient, setRecipient] = useState<ResolvedRecipient | null>(null);
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);

  function handleConnected(nextCredentials: Credentials) {
    saveCredentials(nextCredentials);
    setCredentials(nextCredentials);
    setRecipient(null);
    setIsNewChatOpen(false);
  }

  function handleLogout() {
    clearCredentials();
    setCredentials(null);
    setRecipient(null);
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
        onBack={() => setRecipient(null)}
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
          Данные проверены. Теперь можно создать чат в {messenger.label}.
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
            onCreated={(nextRecipient) => {
              setRecipient(nextRecipient);
              setIsNewChatOpen(false);
            }}
            onCancel={() => setIsNewChatOpen(false)}
          />
        ) : (
          <div className={styles.actions}>
            <button
              className={ui.primaryButton}
              type="button"
              onClick={() => setIsNewChatOpen(true)}
            >
              <MessageCircle aria-hidden="true" />
              Создать чат
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
