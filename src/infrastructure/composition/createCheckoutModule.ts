import type { AdminService } from "../../application/service/AdminService.js";
import { AdminService as AdminServiceClass } from "../../application/service/AdminService.js";
import type { StorefrontService } from "../../application/service/StorefrontService.js";
import { StorefrontService as StorefrontServiceClass } from "../../application/service/StorefrontService.js";
import type { Hono } from "hono";
import { createHttpApp } from "../adapter/incoming/http/createHttpApp.js";
import { InMemoryCheckoutStore, type InMemoryStoreOptions } from "../adapter/outgoing/InMemoryCheckoutStore.js";
import { RandomIdGenerator } from "../adapter/outgoing/RandomIdGenerator.js";
import { SystemClock } from "../adapter/outgoing/SystemClock.js";

export type CheckoutModule = {
  app: Hono;
  storefront: StorefrontService;
  admin: AdminService;
};

export function createCheckoutModule(options?: InMemoryStoreOptions): CheckoutModule {
  const store = new InMemoryCheckoutStore(options);
  const clock = new SystemClock();
  const ids = new RandomIdGenerator();
  const storefront = new StorefrontServiceClass(store, clock, ids);
  const admin = new AdminServiceClass(store, clock);
  return {
    app: createHttpApp(storefront, admin),
    storefront,
    admin,
  };
}
