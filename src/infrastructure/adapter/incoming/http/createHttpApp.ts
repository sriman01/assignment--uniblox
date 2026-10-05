import { randomUUID } from "node:crypto";
import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { cors } from "hono/cors";
import { z as zod } from "zod";
import type { AdminService } from "../../../../application/service/AdminService.js";
import type { StorefrontService } from "../../../../application/service/StorefrontService.js";
import type { DomainError } from "../../../../domain/errors.js";
import { ErrorCode, domainError } from "../../../../domain/errors.js";
import type { Result } from "../../../../domain/result.js";
import { statusFor } from "./statusFor.js";

const quantityBody = zod.object({
  quantity: zod.number(),
});

const addItemBody = quantityBody.extend({
  productId: zod.string().trim().min(1).max(80),
});

const checkoutBody = zod.object({
  couponCode: zod.string().trim().max(64).optional(),
});

const adminSignInBody = zod.object({
  email: zod.string().trim().min(3),
  password: zod.string().min(1),
});

const adminAccount = {
  email: "admin@sleepyhug.test",
  password: "sleepyhug",
};

const customerAccount = {
  id: "cus_maya",
  name: "Maya Sharma",
  email: "maya@sleepyhug.test",
  password: "sleepwell",
};

const adminSessions = new Map<string, string>();
const customerSessions = new Map<string, string>();

const productPatchBody = zod
  .object({
    unitPriceCents: zod.number().optional(),
    availableQuantity: zod.number().optional(),
  })
  .refine((value) => value.unitPriceCents !== undefined || value.availableQuantity !== undefined, {
    message: "Provide unitPriceCents or availableQuantity.",
  });

export function createHttpApp(storefront: StorefrontService, admin: AdminService): Hono {
  const app = new Hono();
  app.use("*", cors());

  app.get("/health", (c) => c.json({ ok: true }));

  app.post("/customer/session", async (c) => {
    const parsed = await readBody(c, adminSignInBody);
    if (parsed.success !== true) {
      return jsonResult(c, parsed);
    }
    if (parsed.data.email !== customerAccount.email || parsed.data.password !== customerAccount.password) {
      return c.json(
        { error: { code: "INVALID_CREDENTIALS", message: "That email or password does not match the customer account." } },
        401,
      );
    }
    const token = randomUUID();
    customerSessions.set(token, customerAccount.id);
    setCookie(c, "customer_session", token, { path: "/", httpOnly: true, sameSite: "Lax" });
    return c.json({ signedIn: true, customer: publicCustomer() });
  });

  app.get("/customer/session", (c) => {
    const customerId = customerIdFromCookie(c);
    return c.json(
      customerId
        ? { signedIn: true, customer: publicCustomer() }
        : { signedIn: false },
    );
  });

  app.delete("/customer/session", (c) => {
    const token = getCookie(c, "customer_session");
    if (token) customerSessions.delete(token);
    deleteCookie(c, "customer_session", { path: "/" });
    return c.json({ signedIn: false });
  });

  app.get("/products", (c) => send(c, storefront.listProducts().then((result) => mapResult(result, (items) => ({ items })))));
  app.get("/products/:productId", (c) => send(c, storefront.getProduct(c.req.param("productId"))));

  app.post("/carts", (c) => send(c, storefront.createCart(customerIdFromCookie(c)), 201));
  app.get("/carts/:cartId", (c) => send(c, storefront.getCart(c.req.param("cartId"))));
  app.post("/carts/:cartId/items", (c) =>
    send(c, readBody(c, addItemBody).then((parsed) => {
      if (parsed.success !== true) {
        return parsed;
      }
      return storefront.addItem(c.req.param("cartId"), parsed.data.productId, parsed.data.quantity);
    })),
  );
  app.patch("/carts/:cartId/items/:productId", (c) =>
    send(c, readBody(c, quantityBody).then((parsed) => {
      if (parsed.success !== true) {
        return parsed;
      }
      return storefront.updateItem(c.req.param("cartId"), c.req.param("productId"), parsed.data.quantity);
    })),
  );
  app.delete("/carts/:cartId/items/:productId", (c) =>
    send(c, storefront.removeItem(c.req.param("cartId"), c.req.param("productId"))),
  );

  app.post("/carts/:cartId/checkout", async (c) => {
    const parsed = await readBody(c, checkoutBody);
    if (parsed.success !== true) {
      return jsonResult(c, parsed);
    }
    const idempotencyKey = c.req.header("Idempotency-Key") ?? "";
    const result = await storefront.checkout(
      c.req.param("cartId"),
      idempotencyKey,
      parsed.data.couponCode ?? null,
      customerIdFromCookie(c),
    );
    if (result.success !== true) {
      return c.json({ error: result.error }, statusFor(result.error.code));
    }
    if (result.data.replayed) {
      return c.json(result.data.order, 200, { "Idempotent-Replayed": "true" });
    }
    return c.json(result.data.order, 201, { Location: `/orders/${result.data.order.id}` });
  });

  app.get("/orders/:orderId", (c) => send(c, storefront.getOrder(c.req.param("orderId"))));

  app.get("/customer/orders", async (c) => {
    const customerId = customerIdFromCookie(c);
    if (!customerId) return c.json({ error: { code: "UNAUTHORIZED", message: "Customer sign-in required." } }, 401);
    return await send(c, storefront.listCustomerOrders(customerId).then((result) => mapResult(result, (items) => ({ items }))));
  });

  app.get("/customer/coupons", async (c) => {
    const customerId = customerIdFromCookie(c);
    if (!customerId) return c.json({ error: { code: "UNAUTHORIZED", message: "Customer sign-in required." } }, 401);
    return await send(c, storefront.listCustomerCoupons(customerId).then((result) => mapResult(result, (items) => ({ items }))));
  });

  app.post("/admin/session", async (c) => {
    const parsed = await readBody(c, adminSignInBody);
    if (parsed.success !== true) {
      return jsonResult(c, parsed);
    }
    if (parsed.data.email !== adminAccount.email || parsed.data.password !== adminAccount.password) {
      return c.json(
        { error: { code: "INVALID_CREDENTIALS", message: "That email or password does not match the admin account." } },
        401,
      );
    }
    const token = randomUUID();
    adminSessions.set(token, adminAccount.email);
    setCookie(c, "admin_session", token, { path: "/", httpOnly: true, sameSite: "Lax" });
    return c.json({ signedIn: true, email: adminAccount.email });
  });

  app.get("/admin/session", (c) => {
    const token = getCookie(c, "admin_session");
    const email = token ? adminSessions.get(token) : undefined;
    if (!email) {
      return c.json({ signedIn: false });
    }
    return c.json({ signedIn: true, email });
  });

  app.delete("/admin/session", (c) => {
    const token = getCookie(c, "admin_session");
    if (token) {
      adminSessions.delete(token);
    }
    deleteCookie(c, "admin_session", { path: "/" });
    return c.json({ signedIn: false });
  });

  app.get("/admin/config", (c) => send(c, admin.getConfig()));
  app.patch("/admin/products/:productId", (c) =>
    send(c, readBody(c, productPatchBody).then((parsed) => {
      if (parsed.success !== true) {
        return parsed;
      }
      return admin.updateProduct(c.req.param("productId"), parsed.data);
    })),
  );
  app.post("/admin/coupons/generate", (c) => send(c, admin.generateCoupon(), 201));
  app.get("/admin/coupons", (c) => send(c, admin.listCoupons().then((result) => mapResult(result, (items) => ({ items })))));
  app.get("/admin/orders", (c) => send(c, admin.listOrders().then((result) => mapResult(result, (items) => ({ items })))));
  app.get("/admin/reports", (c) => send(c, admin.report()));

  app.notFound((c) =>
    c.json({ error: { code: "NOT_FOUND", message: `No route for ${c.req.method} ${c.req.path}.` } }, 404),
  );

  return app;
}

function customerIdFromCookie(c: Parameters<typeof getCookie>[0]): string | null {
  const token = getCookie(c, "customer_session");
  return token ? customerSessions.get(token) ?? null : null;
}

function publicCustomer() {
  return { id: customerAccount.id, name: customerAccount.name, email: customerAccount.email };
}

function mapResult<T, U>(result: Result<T, DomainError>, map: (data: T) => U): Result<U, DomainError> {
  if (result.success !== true) {
    return result;
  }
  return { success: true, data: map(result.data) };
}

async function send(
  c: { json: (body: unknown, status?: number) => Response },
  pending: Promise<Result<unknown, DomainError>>,
  successStatus = 200,
): Promise<Response> {
  return jsonResult(c, await pending, successStatus);
}

function jsonResult(
  c: { json: (body: unknown, status?: number) => Response },
  result: Result<unknown, DomainError>,
  successStatus = 200,
): Response {
  if (result.success !== true) {
    return c.json({ error: result.error }, statusFor(result.error.code));
  }
  return c.json(result.data, successStatus);
}

async function readBody<T>(
  c: { req: { text: () => Promise<string> } },
  schema: zod.ZodType<T>,
): Promise<Result<T, DomainError>> {
  const text = await c.req.text();
  const raw: unknown = text.trim() === "" ? {} : parseJson(text);
  if (raw === invalidJson) {
    return {
      success: false,
      error: domainError(ErrorCode.VALIDATION_ERROR, "Request body must be JSON."),
    };
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      error: domainError(ErrorCode.VALIDATION_ERROR, "Request body is invalid.", {
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      }),
    };
  }
  return { success: true, data: parsed.data };
}

const invalidJson = Symbol("invalidJson");

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return invalidJson;
  }
}
