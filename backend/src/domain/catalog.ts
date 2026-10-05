import type { Customer, Product, StoreConfig, StoreState } from "./model.js";
import { uuidFromString, type Uuid } from "./typeDefinitions.js";

export const ProductId = {
  merinoBlanket: uuidFromString("11111111-1111-4111-8111-111111111111"),
  linenSheet: uuidFromString("22222222-2222-4222-8222-222222222222"),
  downPillow: uuidFromString("33333333-3333-4333-8333-333333333333"),
  woolThrow: uuidFromString("44444444-4444-4444-8444-444444444444"),
  cedarSachet: uuidFromString("55555555-5555-4555-8555-555555555555"),
  eyeMask: uuidFromString("66666666-6666-4666-8666-666666666666"),
} as const;

export const defaultConfig: StoreConfig = {
  everyNthOrder: 5,
  discountPercent: 10,
};

export function defaultProducts(): Product[] {
  return [
    { id: ProductId.merinoBlanket, name: "Merino Blanket", unitPriceCents: 8900, availableQuantity: 20 },
    { id: ProductId.linenSheet, name: "Linen Sheet Set", unitPriceCents: 6400, availableQuantity: 15 },
    { id: ProductId.downPillow, name: "Down Pillow", unitPriceCents: 4200, availableQuantity: 8 },
    { id: ProductId.woolThrow, name: "Wool Throw", unitPriceCents: 5500, availableQuantity: 2 },
    { id: ProductId.cedarSachet, name: "Cedar Sachet", unitPriceCents: 1200, availableQuantity: 40 },
    { id: ProductId.eyeMask, name: "Travel Eye Mask", unitPriceCents: 1800, availableQuantity: 1 },
  ];
}

export const demoCustomerId = uuidFromString("77777777-7777-4777-8777-777777777777");

export function createSeedState(options?: {
  products?: Product[];
  config?: StoreConfig;
  customers?: Customer[];
}): StoreState {
  const config = options?.config ?? defaultConfig;
  if (!Number.isInteger(config.everyNthOrder) || config.everyNthOrder < 1) {
    throw new Error("everyNthOrder must be an integer of at least 1");
  }
  if (!Number.isInteger(config.discountPercent) || config.discountPercent < 0 || config.discountPercent > 100) {
    throw new Error("discountPercent must be an integer from 0 to 100");
  }

  const products = options?.products ?? defaultProducts();
  const productMap = new Map<Uuid, Product>();
  for (const product of products) {
    if (productMap.has(product.id)) {
      throw new Error(`duplicate product id ${product.id}`);
    }
    productMap.set(product.id, { ...product });
  }

  const customerMap = new Map<Uuid, Customer>();
  for (const customer of options?.customers ?? []) {
    customerMap.set(customer.id, { ...customer, email: customer.email.toLowerCase() });
  }

  return {
    products: productMap,
    carts: new Map(),
    orders: new Map(),
    coupons: new Map(),
    customers: customerMap,
    idempotency: new Map(),
    config: { ...config },
  };
}
