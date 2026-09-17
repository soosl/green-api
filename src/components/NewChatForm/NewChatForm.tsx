import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { LoaderCircle, Phone, Search, X } from "lucide-react";
import { GreenApiClient, GreenApiError } from "../../api/greenApi";
import type {
  MessengerDefinition,
  ResolvedRecipient,
} from "../../messengers/messengers";
import type { Credentials } from "../../model/types";

interface NewChatFormProps {
  credentials: Credentials;
  messenger: MessengerDefinition;
  onCreated: (recipient: ResolvedRecipient) => void;
  onCancel: () => void;
}

export function NewChatForm({
  credentials,
  messenger,
  onCreated,
  onCancel,
}: NewChatFormProps) {
  const [recipientValue, setRecipientValue] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestRef = useRef<AbortController | null>(null);

  const client = useMemo(() => new GreenApiClient(credentials), [credentials]);

  useEffect(() => {
    return () => {
      requestRef.current?.abort();
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    requestRef.current?.abort();

    const controller = new AbortController();
    requestRef.current = controller;

    setIsSubmitting(true);
    setError(null);

    try {
      const recipient = await messenger.resolveRecipient(
        client,
        recipientValue,
        controller.signal,
      );

      if (!controller.signal.aborted) {
        onCreated(recipient);
      }
    } catch (requestError) {
      if (controller.signal.aborted) {
        return;
      }

      if (
        requestError instanceof GreenApiError ||
        requestError instanceof Error
      ) {
        setError(requestError.message);
        return;
      }

      setError("Не удалось проверить получателя.");
    } finally {
      if (requestRef.current === controller && !controller.signal.aborted) {
        setIsSubmitting(false);
      }
    }
  }

  return (
    <section className="new-chat-card">
      <div className="new-chat-card__header">
        <div>
          <span className="eyebrow">НОВЫЙ ЧАТ</span>
          <h2>Найдите получателя</h2>
        </div>

        <button
          className="icon-button"
          type="button"
          aria-label="Закрыть форму"
          disabled={isSubmitting}
          onClick={onCancel}
        >
          <X aria-hidden="true" />
        </button>
      </div>

      <p className="new-chat-card__description">
        Введите номер в международном формате. Проверка выполнится только после
        нажатия кнопки.
      </p>

      <form className="new-chat-form" onSubmit={handleSubmit}>
        <label className="form-field">
          <span>{messenger.recipientLabel}</span>

          <div className="input-control">
            <Phone aria-hidden="true" />

            <input
              type="tel"
              inputMode="tel"
              value={recipientValue}
              placeholder={messenger.recipientPlaceholder}
              autoComplete="tel"
              disabled={isSubmitting}
              onChange={(event) => {
                setRecipientValue(event.target.value);
                setError(null);
              }}
            />
          </div>
        </label>

        {error && (
          <div className="form-error" role="alert">
            {error}
          </div>
        )}

        <button
          className="primary-button"
          type="submit"
          disabled={isSubmitting || !recipientValue.trim()}
        >
          {isSubmitting ? (
            <LoaderCircle className="spinner" aria-hidden="true" />
          ) : (
            <Search aria-hidden="true" />
          )}

          {isSubmitting ? "Проверяем аккаунт" : "Найти и создать чат"}
        </button>
      </form>
    </section>
  );
}
