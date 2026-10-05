import type { StoreState } from "../../../domain/model.js";

/**
 * One unit of work. The callback runs alone against the live state.
 * Do not start another transaction from inside the callback: the lock is not reentrant.
 */
export interface CheckoutStorePort {
  transaction<T>(work: (state: StoreState) => T): Promise<T>;
}
