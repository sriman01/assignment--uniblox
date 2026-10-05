import type { AdminService } from "../../application/service/AdminService.js";
import { AdminService as AdminServiceClass } from "../../application/service/AdminService.js";
import { CustomerService } from "../../application/service/CustomerService.js";
import type { StorefrontService } from "../../application/service/StorefrontService.js";
import { StorefrontService as StorefrontServiceClass } from "../../application/service/StorefrontService.js";
import type { CheckoutStorePort } from "../../application/port/outgoing/CheckoutStorePort.js";
import type { ClockPort } from "../../application/port/outgoing/ClockPort.js";
import type { PasswordHasherPort } from "../../application/port/outgoing/PasswordHasherPort.js";
import type { Hono } from "hono";
import { demoCustomerId } from "../../domain/catalog.js";
import type { Customer } from "../../domain/model.js";
import { createHttpApp } from "../adapter/incoming/http/createHttpApp.js";
import { InMemoryCheckoutStore, type InMemoryStoreOptions } from "../adapter/outgoing/InMemoryCheckoutStore.js";
import { RandomIdGenerator } from "../adapter/outgoing/RandomIdGenerator.js";
import { ScryptPasswordHasher } from "../adapter/outgoing/ScryptPasswordHasher.js";
import { SystemClock } from "../adapter/outgoing/SystemClock.js";

export type CheckoutModule = {
  app: Hono;
  storefront: StorefrontService;
  admin: AdminService;
  customers: CustomerService;
};

export type CheckoutModuleOptions = InMemoryStoreOptions & {
  /** Use this store instead of a fresh in-memory one; the seed options are then ignored. */
  store?: CheckoutStorePort;
};

export function demoCustomers(passwords: PasswordHasherPort, clock: ClockPort): Customer[] {
  return [
    {
      id: demoCustomerId,
      name: "Maya Sharma",
      email: "maya@assignment.test",
      passwordHash: passwords.hash("sleepwell"),
      createdAt: clock.nowIso(),
    },
  ];
}

export function createCheckoutModule(options?: CheckoutModuleOptions): CheckoutModule {
  const clock = new SystemClock();
  const ids = new RandomIdGenerator();
  const passwords = new ScryptPasswordHasher();
  const store =
    options?.store ??
    new InMemoryCheckoutStore({
      ...options,
      customers: options?.customers ?? demoCustomers(passwords, clock),
    });
  const storefront = new StorefrontServiceClass(store, clock, ids);
  const admin = new AdminServiceClass(store, clock, ids);
  const customers = new CustomerService(store, clock, ids, passwords);
  return {
    app: createHttpApp(storefront, admin, customers),
    storefront,
    admin,
    customers,
  };
}
