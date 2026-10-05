import type { Product, StoreConfig, StoreState } from "./model.js";

export const ProductId = {
  merinoBlanket: "prd_merino_blanket",
  linenSheet: "prd_linen_sheet",
  downPillow: "prd_down_pillow",
  woolThrow: "prd_wool_throw",
  cedarSachet: "prd_cedar_sachet",
  eyeMask: "prd_eye_mask",
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

export function couponCodeForMilestone(milestone: number): string {
  return `MILESTONE-${milestone}`;
}

export function createSeedState(options?: {
  products?: Product[];
  config?: StoreConfig;
}): StoreState {
  const config = options?.config ?? defaultConfig;
  if (!Number.isInteger(config.everyNthOrder) || config.everyNthOrder < 1) {
    throw new Error("everyNthOrder must be an integer of at least 1");
  }
  if (!Number.isInteger(config.discountPercent) || config.discountPercent < 0 || config.discountPercent > 100) {
    throw new Error("discountPercent must be an integer from 0 to 100");
  }

  const products = options?.products ?? defaultProducts();
  const productMap = new Map<string, Product>();
  for (const product of products) {
    if (productMap.has(product.id)) {
      throw new Error(`duplicate product id ${product.id}`);
    }
    productMap.set(product.id, { ...product });
  }

  return {
    products: productMap,
    carts: new Map(),
    orders: new Map(),
    coupons: new Map(),
    idempotency: new Map(),
    config: { ...config },
  };
}
