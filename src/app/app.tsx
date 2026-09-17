import { useState } from "react";
import { LogOut, MessageCircle, ShieldCheck } from "lucide-react";
import { AuthForm } from "../components/AuthForm/AuthForm";
import { getMessengerDefinition } from "../messengers/messengers";
import type { Credentials } from "../model/types";
import {
  clearCredentials,
  loadCredentials,
  saveCredentials,
} from "../storage/credentials";

export const App = () => {
  const [credentials, setCredentials] = useState<Credentials | null>(
    loadCredentials,
  );

  function handleConnected(nextCredentials: Credentials) {
    saveCredentials(nextCredentials);
    setCredentials(nextCredentials);
  }

  function handleLogout() {
    clearCredentials();
    setCredentials(null);
  }

  if (!credentials) {
    return <AuthForm onConnected={handleConnected} />;
  }

  const messenger = getMessengerDefinition(credentials.messenger);

  return (
    <main className="connected-page">
      <section className="connected-card">
        <div className="connected-card__icon">
          <ShieldCheck aria-hidden="true" />
        </div>

        <span className="eyebrow">ПОДКЛЮЧЕНИЕ УСТАНОВЛЕНО</span>
        <h1>{messenger.label}-инстанс готов</h1>
        <p>
          Данные проверены. Теперь можно перейти к созданию чата в{" "}
          {messenger.label}.
        </p>

        <dl className="instance-info">
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

        <div className="connected-card__actions">
          <button className="primary-button" type="button">
            <MessageCircle aria-hidden="true" />
            Создать чат
          </button>
          <button
            className="secondary-button"
            type="button"
            onClick={handleLogout}
          >
            <LogOut aria-hidden="true" />
            Отключиться
          </button>
        </div>
      </section>
    </main>
  );
};
