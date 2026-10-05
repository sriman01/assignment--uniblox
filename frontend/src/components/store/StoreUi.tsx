import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { Icon } from "../ui/Icon";

type Toast = { id: number; message: string; tone: "success" | "error"; leaving?: boolean };

const toastExitMs = 400;

type StoreUiValue = {
  notify: (message: string, tone?: Toast["tone"]) => void;
  cartOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
};

const StoreUiContext = createContext<StoreUiValue | null>(null);

export function StoreUiProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.map((toast) => (toast.id === id ? { ...toast, leaving: true } : toast)));
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, toastExitMs);
  }, []);

  const notify = useCallback(
    (message: string, tone: Toast["tone"] = "success") => {
      const id = nextId.current++;
      setToasts((current) => [...current.slice(-2), { id, message, tone }]);
      window.setTimeout(() => dismiss(id), 3200);
    },
    [dismiss],
  );

  const openCart = useCallback(() => setCartOpen(true), []);
  const closeCart = useCallback(() => setCartOpen(false), []);
  const value = useMemo<StoreUiValue>(
    () => ({ notify, cartOpen, openCart, closeCart }),
    [notify, cartOpen, openCart, closeCart],
  );

  return (
    <StoreUiContext.Provider value={value}>
      {children}
      <div className="toast-region" aria-live="polite">
        {toasts.map((toast) => (
          <div className={`toast toast--${toast.tone}`} key={toast.id} data-leaving={toast.leaving ? "" : undefined}>
            <span className="toast__icon">
              <Icon name={toast.tone === "success" ? "check" : "close"} size={16} />
            </span>
            <span>{toast.message}</span>
            <button className="toast__close" type="button" onClick={() => dismiss(toast.id)} aria-label="Dismiss">
              <Icon name="close" size={14} />
            </button>
          </div>
        ))}
      </div>
    </StoreUiContext.Provider>
  );
}

export function useStoreUi(): StoreUiValue {
  const value = useContext(StoreUiContext);
  if (!value) throw new Error("useStoreUi must be used inside StoreUiProvider");
  return value;
}
