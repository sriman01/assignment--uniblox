import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { cors } from "hono/cors";
import { z as zod } from "zod";
import type { AdminService } from "../../../../application/service/AdminService.js";
import type { CustomerService } from "../../../../application/service/CustomerService.js";
import type { StorefrontService } from "../../../../application/service/StorefrontService.js";
import type { DomainError } from "../../../../domain/errors.js";
import { ErrorCode, domainError } from "../../../../domain/errors.js";
import type { Result } from "../../../../domain/result.js";
import { uuidFromString, type Uuid } from "../../../../domain/typeDefinitions.js";
import { statusFor } from "./statusFor.js";
import { generateUuid } from "../../outgoing/generateUuid.js";

const quantityBody = zod.object({
  quantity: zod.number(),
});

const addItemBody = quantityBody.extend({
  productId: zod.uuid().transform(uuidFromString),
});

const checkoutBody = zod.object({
  couponCode: zod.string().trim().max(64).optional(),
});

const signInBody = zod.object({
  email: zod.string().trim().min(3),
  password: zod.string().min(1),
});

const registerBody = zod.object({
  name: zod.string().trim().min(1).max(80),
  email: zod.email().max(254),
  password: zod.string().min(8).max(128),
});

const adminAccount = {
  email: "admin@assignment.test",
  password: "assignment",
};

const productPatchBody = zod
  .object({
    unitPriceCents: zod.number().optional(),
    availableQuantity: zod.number().optional(),
  })
  .refine((value) => value.unitPriceCents !== undefined || value.availableQuantity !== undefined, {
    message: "Provide unitPriceCents or availableQuantity.",
  });

const storeConfigBody = zod.object({
  everyNthOrder: zod.number().int().min(1).max(1_000_000),
  discountPercent: zod.number().int().min(0).max(100),
});

const optionalCustomerId = zod.uuid().transform(uuidFromString).nullable().optional();

const generateCouponBody = zod.object({
  customerId: optionalCustomerId,
});

const createCouponBody = zod.object({
  code: zod.string().trim().max(32).optional(),
  percentOff: zod.number(),
  customerId: optionalCustomerId,
});

const updateCouponBody = zod
  .object({
    percentOff: zod.number().optional(),
    customerId: optionalCustomerId,
    status: zod.enum(["available", "disabled"]).optional(),
  })
  .refine((value) => value.percentOff !== undefined || value.customerId !== undefined || value.status !== undefined, {
    message: "Provide percentOff, customerId, or status.",
  });

type CookieContext = Parameters<typeof getCookie>[0];

export function createHttpApp(storefront: StorefrontService, admin: AdminService, customers: CustomerService): Hono {
  const adminSessions = new Map<string, string>();
  const customerSessions = new Map<string, Uuid>();

  const customerIdFromCookie = (c: CookieContext): Uuid | null => {
    const token = getCookie(c, "customer_session");
    return token ? customerSessions.get(token) ?? null : null;
  };

  const startCustomerSession = (c: CookieContext, customerId: Uuid) => {
    const token = generateUuid();
    customerSessions.set(token, customerId);
    setCookie(c, "customer_session", token, { path: "/", httpOnly: true, sameSite: "Lax" });
  };

  const app = new Hono();
  app.use("*", cors());
  app.onError((error, c) => {
    if (error.message.startsWith("Invalid UUID:")) {
      return c.json({ error: domainError(ErrorCode.VALIDATION_ERROR, error.message) }, 400);
    }
    console.error(error);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Unexpected server error." } }, 500);
  });

  app.get("/health", (c) => c.json({ ok: true }));

  app.post("/customer/register", async (c) => {
    const parsed = await readBody(c, registerBody);
    if (parsed.success !== true) return jsonResult(c, parsed);
    const registered = await customers.register(parsed.data);
    if (registered.success !== true) return jsonResult(c, registered);
    startCustomerSession(c, registered.data.id);
    return c.json({ signedIn: true, customer: registered.data }, 201);
  });

  app.post("/customer/session", async (c) => {
    const parsed = await readBody(c, signInBody);
    if (parsed.success !== true) return jsonResult(c, parsed);
    const authenticated = await customers.authenticate(parsed.data.email, parsed.data.password);
    if (authenticated.success !== true) return jsonResult(c, authenticated);
    startCustomerSession(c, authenticated.data.id);
    return c.json({ signedIn: true, customer: authenticated.data });
  });

  app.get("/customer/session", async (c) => {
    const customerId = customerIdFromCookie(c);
    if (!customerId) return c.json({ signedIn: false });
    const customer = await customers.getCustomer(customerId);
    return c.json(customer.success === true ? { signedIn: true, customer: customer.data } : { signedIn: false });
  });

  app.delete("/customer/session", (c) => {
    const token = getCookie(c, "customer_session");
    if (token) customerSessions.delete(token);
    deleteCookie(c, "customer_session", { path: "/" });
    return c.json({ signedIn: false });
  });

  app.get("/products", (c) => send(c, storefront.listProducts().then((result) => mapResult(result, (items) => ({ items })))));
  app.get("/products/:productId", (c) => send(c, storefront.getProduct(uuidFromString(c.req.param("productId")))));

  app.post("/carts", (c) => send(c, storefront.createCart(customerIdFromCookie(c)), 201));
  app.get("/carts/:cartId", (c) => send(c, storefront.getCart(uuidFromString(c.req.param("cartId")))));
  app.post("/carts/:cartId/items", (c) =>
    send(c, readBody(c, addItemBody).then((parsed) => {
      if (parsed.success !== true) {
        return parsed;
      }
      return storefront.addItem(uuidFromString(c.req.param("cartId")), parsed.data.productId, parsed.data.quantity);
    })),
  );
  app.patch("/carts/:cartId/items/:productId", (c) =>
    send(c, readBody(c, quantityBody).then((parsed) => {
      if (parsed.success !== true) {
        return parsed;
      }
      return storefront.updateItem(
        uuidFromString(c.req.param("cartId")),
        uuidFromString(c.req.param("productId")),
        parsed.data.quantity,
      );
    })),
  );
  app.delete("/carts/:cartId/items/:productId", (c) =>
    send(
      c,
      storefront.removeItem(
        uuidFromString(c.req.param("cartId")),
        uuidFromString(c.req.param("productId")),
      ),
    ),
  );

  app.post("/carts/:cartId/checkout", async (c) => {
    const parsed = await readBody(c, checkoutBody);
    if (parsed.success !== true) {
      return jsonResult(c, parsed);
    }
    const idempotencyKey = c.req.header("Idempotency-Key") ?? "";
    const result = await storefront.checkout(
      uuidFromString(c.req.param("cartId")),
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

  app.get("/orders/:orderId", (c) => send(c, storefront.getOrder(uuidFromString(c.req.param("orderId")))));

  app.get("/customer/orders", async (c) => {
    const customerId = customerIdFromCookie(c);
    if (!customerId) return unauthorized(c);
    return await send(c, storefront.listCustomerOrders(customerId).then((result) => mapResult(result, (items) => ({ items }))));
  });

  app.get("/customer/coupons", async (c) => {
    const customerId = customerIdFromCookie(c);
    if (!customerId) return unauthorized(c);
    return await send(c, storefront.listCustomerCoupons(customerId).then((result) => mapResult(result, (items) => ({ items }))));
  });

  app.get("/customer/rewards", async (c) => {
    const customerId = customerIdFromCookie(c);
    if (!customerId) return unauthorized(c);
    return await send(c, customers.rewards(customerId));
  });

  app.post("/admin/session", async (c) => {
    const parsed = await readBody(c, signInBody);
    if (parsed.success !== true) {
      return jsonResult(c, parsed);
    }
    if (parsed.data.email !== adminAccount.email || parsed.data.password !== adminAccount.password) {
      return c.json(
        { error: domainError(ErrorCode.INVALID_CREDENTIALS, "That email or password does not match the admin account.") },
        401,
      );
    }
    const token = generateUuid();
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
  app.patch("/admin/config", (c) =>
    send(c, readBody(c, storeConfigBody).then((parsed) => {
      if (parsed.success !== true) {
        return parsed;
      }
      return admin.updateConfig(parsed.data);
    })),
  );
  app.patch("/admin/products/:productId", (c) =>
    send(c, readBody(c, productPatchBody).then((parsed) => {
      if (parsed.success !== true) {
        return parsed;
      }
      return admin.updateProduct(uuidFromString(c.req.param("productId")), parsed.data);
    })),
  );
  app.get("/admin/customers", (c) => send(c, admin.listCustomers().then((result) => mapResult(result, (items) => ({ items })))));
  app.post("/admin/coupons/generate", (c) =>
    send(c, readBody(c, generateCouponBody).then((parsed) => {
      if (parsed.success !== true) return parsed;
      return admin.generateCoupon(parsed.data.customerId ?? null);
    }), 201),
  );
  app.post("/admin/coupons", (c) =>
    send(c, readBody(c, createCouponBody).then((parsed) => {
      if (parsed.success !== true) return parsed;
      return admin.createCoupon({
        code: parsed.data.code,
        percentOff: parsed.data.percentOff,
        customerId: parsed.data.customerId ?? null,
      });
    }), 201),
  );
  app.patch("/admin/coupons/:code", (c) =>
    send(c, readBody(c, updateCouponBody).then((parsed) => {
      if (parsed.success !== true) return parsed;
      return admin.updateCoupon(c.req.param("code"), parsed.data);
    })),
  );
  app.delete("/admin/coupons/:code", (c) => send(c, admin.deleteCoupon(c.req.param("code"))));
  app.get("/admin/coupons", (c) => send(c, admin.listCoupons().then((result) => mapResult(result, (items) => ({ items })))));
  app.get("/admin/orders", (c) => send(c, admin.listOrders().then((result) => mapResult(result, (items) => ({ items })))));
  app.get("/admin/reports", (c) => send(c, admin.report()));

  app.notFound((c) =>
    c.json({ error: { code: "NOT_FOUND", message: `No route for ${c.req.method} ${c.req.path}.` } }, 404),
  );

  return app;
}

function unauthorized(c: { json: (body: unknown, status?: number) => Response }): Response {
  return c.json({ error: domainError(ErrorCode.UNAUTHORIZED, "Customer sign-in required.") }, 401);
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
