import { useState, type FormEvent } from "react";
import {
  Eye,
  EyeOff,
  Hash,
  KeyRound,
  Link2,
  LoaderCircle,
  MessageCircle,
} from "lucide-react";
import { GreenApiClient, GreenApiError } from "../../api/greenApi";
import {
  getMessengerDefinition,
  MESSENGER_OPTIONS,
} from "../../messengers/messengers";
import type { Credentials, InstanceState } from "../../model/types";
import styles from "./AuthForm.module.css";
import ui from "../../styles/ui.module.css";

interface AuthFormProps {
  onConnected: (credentials: Credentials) => void;
}

const initialCredentials: Credentials = {
  messenger: "telegram",
  apiUrl: "",
  idInstance: "",
  apiTokenInstance: "",
};

function validateCredentials(credentials: Credentials): string | null {
  let apiUrl: URL;

  try {
    apiUrl = new URL(credentials.apiUrl);
  } catch {
    return "Введите корректный apiUrl";
  }

  if (apiUrl.protocol !== "https:") {
    return "apiUrl должен начинаться с https://";
  }

  const isGreenApiHost =
    apiUrl.hostname === "api.green-api.com" ||
    apiUrl.hostname.endsWith(".api.green-api.com");

  if (!isGreenApiHost) {
    return "Используйте apiUrl из личного кабинета GREEN-API";
  }

  if (!/^\d+$/.test(credentials.idInstance)) {
    return "idInstance должен содержать только цифры";
  }

  if (!credentials.apiTokenInstance) {
    return "Введите apiTokenInstance";
  }

  return null;
}

function getStateError(state: InstanceState): string {
  const messages: Record<Exclude<InstanceState, "authorized">, string> = {
    notAuthorized:
      "Инстанс не авторизован. Авторизуйте его в личном кабинете GREEN-API.",
    blocked: "Аккаунт мессенджера заблокирован.",
    suspended: "На аккаунт мессенджера наложены временные ограничения.",
    starting:
      "Инстанс запускается. Подождите несколько минут и попробуйте снова.",
    pendingPassword:
      "Для завершения авторизации требуется пароль двухфакторной аутентификации.",
  };

  return state === "authorized"
    ? ""
    : (messages[state] ?? `Неизвестное состояние инстанса: ${state}`);
}

export function AuthForm({ onConnected }: AuthFormProps) {
  const [credentials, setCredentials] =
    useState<Credentials>(initialCredentials);
  const [showToken, setShowToken] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selectedMessenger = getMessengerDefinition(credentials.messenger);

  function updateField<K extends keyof Credentials>(
    field: K,
    value: Credentials[K],
  ) {
    setCredentials((current) => ({
      ...current,
      [field]: value,
    }));
    setError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedCredentials: Credentials = {
      messenger: credentials.messenger,
      apiUrl: credentials.apiUrl.trim().replace(/\/+$/, ""),
      idInstance: credentials.idInstance.trim(),
      apiTokenInstance: credentials.apiTokenInstance.trim(),
    };
    const validationError = validateCredentials(normalizedCredentials);

    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const client = new GreenApiClient(normalizedCredentials);
      const response = await client.getStateInstance();

      if (response.stateInstance !== "authorized") {
        setError(getStateError(response.stateInstance));
        return;
      }

      onConnected(normalizedCredentials);
    } catch (requestError) {
      if (
        requestError instanceof GreenApiError ||
        requestError instanceof Error
      ) {
        setError(requestError.message);
        return;
      }

      setError("Не удалось проверить данные инстанса.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.promo}>
        <div className={styles.promoContent}>
          <div className={ui.brand}>
            <div className={ui.brandIcon}>
              <MessageCircle aria-hidden="true" />
            </div>
            <span>Green {selectedMessenger.label}</span>
          </div>

          <div className={styles.promoDescription}>
            <span className={`${ui.eyebrow} ${styles.promoEyebrow}`}>
              GREEN-API CLIENT
            </span>
            <h1>
              Общайтесь в {selectedMessenger.label} из собственного приложения
            </h1>
            <p>
              Минималистичный веб-клиент для отправки и получения текстовых
              сообщений через GREEN-API.
            </p>
          </div>

          <div className={styles.security}>
            <KeyRound aria-hidden="true" />
            <p>Данные инстанса хранятся только до закрытия вкладки.</p>
          </div>
        </div>
      </section>

      <section className={styles.panel}>
        <div className={styles.card}>
          <div className={styles.header}>
            <span className={ui.eyebrow}>ПОДКЛЮЧЕНИЕ</span>
            <h2>Войдите в чат</h2>
            <p>Укажите параметры инстанса из личного кабинета GREEN-API.</p>
          </div>

          <form className={styles.form} onSubmit={handleSubmit}>
            <fieldset className={styles.messengerField}>
              <legend>Мессенджер</legend>
              <div className={styles.messengerSwitch}>
                {MESSENGER_OPTIONS.map((messenger) => (
                  <button
                    key={messenger.id}
                    className={
                      credentials.messenger === messenger.id
                        ? `${styles.messengerButton} ${styles.messengerButtonActive}`
                        : styles.messengerButton
                    }
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => updateField("messenger", messenger.id)}
                  >
                    {messenger.label}
                  </button>
                ))}
              </div>
            </fieldset>

            <label className={ui.formField}>
              <span>apiUrl</span>
              <div className={ui.inputControl}>
                <Link2 aria-hidden="true" />
                <input
                  type="url"
                  value={credentials.apiUrl}
                  placeholder="https://4100.api.green-api.com"
                  autoComplete="url"
                  disabled={isSubmitting}
                  onChange={(event) =>
                    updateField("apiUrl", event.target.value)
                  }
                />
              </div>
            </label>

            <label className={ui.formField}>
              <span>idInstance</span>
              <div className={ui.inputControl}>
                <Hash aria-hidden="true" />
                <input
                  type="text"
                  inputMode="numeric"
                  value={credentials.idInstance}
                  placeholder="4100000000"
                  autoComplete="off"
                  disabled={isSubmitting}
                  onChange={(event) =>
                    updateField("idInstance", event.target.value)
                  }
                />
              </div>
            </label>

            <label className={ui.formField}>
              <span>apiTokenInstance</span>
              <div className={ui.inputControl}>
                <KeyRound aria-hidden="true" />
                <input
                  type={showToken ? "text" : "password"}
                  value={credentials.apiTokenInstance}
                  placeholder="Введите токен доступа"
                  autoComplete="off"
                  spellCheck={false}
                  disabled={isSubmitting}
                  onChange={(event) =>
                    updateField("apiTokenInstance", event.target.value)
                  }
                />
                <button
                  className={ui.inputAction}
                  type="button"
                  aria-label={showToken ? "Скрыть токен" : "Показать токен"}
                  onClick={() => setShowToken((current) => !current)}
                >
                  {showToken ? (
                    <EyeOff aria-hidden="true" />
                  ) : (
                    <Eye aria-hidden="true" />
                  )}
                </button>
              </div>
            </label>

            {error && (
              <div className={ui.formError} role="alert">
                {error}
              </div>
            )}

            <button
              className={ui.primaryButton}
              type="submit"
              disabled={isSubmitting}
            >
              {isSubmitting && (
                <LoaderCircle className={ui.spinner} aria-hidden="true" />
              )}
              {isSubmitting ? "Проверяем подключение" : "Подключиться"}
            </button>
          </form>

          <p className={styles.hint}>
            Перед подключением авторизуйте {selectedMessenger.label}-инстанс в
            кабинете GREEN-API.
          </p>
        </div>
      </section>
    </main>
  );
}
