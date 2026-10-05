import type { StoreState } from "../../domain/model.js";
import { ErrorCode, domainError } from "../../domain/errors.js";
import { lineTotalCents } from "../../domain/money.js";
import type { PricedCart } from "../../domain/model.js";
import { errorResult, dataResult, type Result } from "../../domain/result.js";
import type { Uuid } from "../../domain/typeDefinitions.js";

export function priceCart(state: StoreState, cartId: Uuid): Result<PricedCart> {
  const cart = state.carts.get(cartId);
  if (!cart) {
    return errorResult(domainError(ErrorCode.CART_NOT_FOUND, `Cart ${cartId} does not exist.`, { cartId }));
  }

  const items: PricedCart["items"] = [];
  let grossCents = 0;
  for (const item of cart.items) {
    const product = state.products.get(item.productId);
    if (!product) {
      return errorResult(
        domainError(ErrorCode.PRODUCT_NOT_FOUND, `Product ${item.productId} does not exist.`, {
          productId: item.productId,
        }),
      );
    }
    const lineTotal = lineTotalCents(product.unitPriceCents, item.quantity);
    grossCents += lineTotal;
    items.push({
      productId: product.id,
      name: product.name,
      quantity: item.quantity,
      unitPriceCents: product.unitPriceCents,
      lineTotalCents: lineTotal,
      availableQuantity: product.availableQuantity,
    });
  }

  return dataResult({
    id: cart.id,
    status: cart.status,
    items,
    grossCents,
    orderId: cart.orderId,
    pricedAt: "current_catalog",
  });
}
