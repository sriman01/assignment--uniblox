import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Uuid } from "../typeDefinitions";
import { readWishlistIds, wishlistKey, writeWishlistIds } from "./storage";

type WishlistValue = {
  ids: Uuid[];
  has: (productId: Uuid) => boolean;
  add: (productId: Uuid) => void;
  remove: (productId: Uuid) => void;
  toggle: (productId: Uuid) => boolean;
};

const WishlistContext = createContext<WishlistValue | null>(null);

export function WishlistProvider({ children }: { children: ReactNode }) {
  const [ids, setIds] = useState<Uuid[]>(readWishlistIds);

  useEffect(() => {
    const syncFromOtherTab = (event: StorageEvent) => {
      if (event.key === wishlistKey) setIds(readWishlistIds());
    };
    window.addEventListener("storage", syncFromOtherTab);
    return () => window.removeEventListener("storage", syncFromOtherTab);
  }, []);

  const update = useCallback((next: (current: Uuid[]) => Uuid[]) => {
    setIds((current) => {
      const value = next(current);
      writeWishlistIds(value);
      return value;
    });
  }, []);

  const value = useMemo<WishlistValue>(() => {
    const saved = new Set(ids);
    return {
      ids,
      has: (productId) => saved.has(productId),
      add: (productId) => update((current) => (current.includes(productId) ? current : [...current, productId])),
      remove: (productId) => update((current) => current.filter((id) => id !== productId)),
      toggle: (productId) => {
        const adding = !saved.has(productId);
        update((current) => (adding ? [...current, productId] : current.filter((id) => id !== productId)));
        return adding;
      },
    };
  }, [ids, update]);

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

export function useWishlist(): WishlistValue {
  const value = useContext(WishlistContext);
  if (!value) throw new Error("useWishlist must be used inside WishlistProvider");
  return value;
}
