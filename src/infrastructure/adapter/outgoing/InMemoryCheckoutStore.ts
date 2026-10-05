import type { CheckoutStorePort } from "../../../application/port/outgoing/CheckoutStorePort.js";
import { createSeedState } from "../../../domain/catalog.js";
import type { Product, StoreConfig, StoreState } from "../../../domain/model.js";
import { AsyncLock } from "./AsyncLock.js";

export type InMemoryStoreOptions = {
  products?: Product[];
  config?: StoreConfig;
};

export class InMemoryCheckoutStore implements CheckoutStorePort {
  private readonly state: StoreState;
  private readonly lock = new AsyncLock();

  constructor(options?: InMemoryStoreOptions) {
    this.state = createSeedState(options);
  }

  transaction<T>(work: (state: StoreState) => T): Promise<T> {
    return this.lock.run(() => work(this.state));
  }
}
