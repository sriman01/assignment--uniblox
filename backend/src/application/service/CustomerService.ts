import type { CheckoutStorePort } from "../port/outgoing/CheckoutStorePort.js";
import type { ClockPort } from "../port/outgoing/ClockPort.js";
import type { IdPort } from "../port/outgoing/IdPort.js";
import type { PasswordHasherPort } from "../port/outgoing/PasswordHasherPort.js";
import { ErrorCode, domainError } from "../../domain/errors.js";
import type { Customer, PublicCustomer, RewardProgress } from "../../domain/model.js";
import { dataResult, errorResult, type Result } from "../../domain/result.js";
import { rewardProgress } from "../../domain/rewards.js";
import type { Uuid } from "../../domain/typeDefinitions.js";

export type Registration = {
  name: string;
  email: string;
  password: string;
};

export class CustomerService {
  constructor(
    private readonly store: CheckoutStorePort,
    private readonly clock: ClockPort,
    private readonly ids: IdPort,
    private readonly passwords: PasswordHasherPort,
  ) {}

  async register(registration: Registration): Promise<Result<PublicCustomer>> {
    const name = registration.name.trim();
    const email = registration.email.trim().toLowerCase();
    if (!name || name.length > 80) {
      return errorResult(domainError(ErrorCode.VALIDATION_ERROR, "Name must be 1 to 80 characters."));
    }
    if (registration.password.length < 8 || registration.password.length > 128) {
      return errorResult(domainError(ErrorCode.VALIDATION_ERROR, "Password must be 8 to 128 characters."));
    }
    const passwordHash = this.passwords.hash(registration.password);
    return this.store.transaction((state) => {
      for (const customer of state.customers.values()) {
        if (customer.email === email) {
          return errorResult(
            domainError(ErrorCode.EMAIL_TAKEN, "An account with that email already exists. Sign in instead.", { email }),
          );
        }
      }
      const customer: Customer = {
        id: this.ids.next(),
        name,
        email,
        passwordHash,
        createdAt: this.clock.nowIso(),
      };
      state.customers.set(customer.id, customer);
      return dataResult(publicCustomer(customer));
    });
  }

  async authenticate(email: string, password: string): Promise<Result<PublicCustomer>> {
    const normalized = email.trim().toLowerCase();
    const customer = await this.store.transaction((state) => {
      for (const candidate of state.customers.values()) {
        if (candidate.email === normalized) return { ...candidate };
      }
      return null;
    });
    if (!customer || !this.passwords.verify(password, customer.passwordHash)) {
      return errorResult(
        domainError(ErrorCode.INVALID_CREDENTIALS, "That email or password does not match a customer account."),
      );
    }
    return dataResult(publicCustomer(customer));
  }

  getCustomer(customerId: Uuid): Promise<Result<PublicCustomer>> {
    return this.store.transaction((state) => {
      const customer = state.customers.get(customerId);
      if (!customer) return errorResult(missingCustomer(customerId));
      return dataResult(publicCustomer(customer));
    });
  }

  rewards(customerId: Uuid): Promise<Result<RewardProgress>> {
    return this.store.transaction((state) => {
      if (!state.customers.has(customerId)) return errorResult(missingCustomer(customerId));
      return dataResult(rewardProgress(state, customerId));
    });
  }
}

export function publicCustomer(customer: Customer): PublicCustomer {
  return { id: customer.id, name: customer.name, email: customer.email };
}

export function missingCustomer(customerId: Uuid) {
  return domainError(ErrorCode.CUSTOMER_NOT_FOUND, `Customer ${customerId} does not exist.`, { customerId });
}
