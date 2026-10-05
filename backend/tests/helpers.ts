import type { Hono } from "hono";
import { ProductId } from "../src/domain/catalog.js";
import type { InMemoryStoreOptions } from "../src/infrastructure/adapter/outgoing/InMemoryCheckoutStore.js";
import { createCheckoutModule } from "../src/infrastructure/composition/createCheckoutModule.js";

export type Json = Record<string, unknown>;

export function createTestApp(options?: InMemoryStoreOptions) {
  return createCheckoutModule(options).app;
}

export async function getJson(app: Hono, path: string, headers?: Record<string, string>) {
  const response = await app.request(path, { headers });
  return { status: response.status, json: (await response.json()) as Json, headers: response.headers };
}

export async function postJson(app: Hono, path: string, body?: unknown, headers?: Record<string, string>) {
  const response = await app.request(path, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, json: (await response.json()) as Json, headers: response.headers };
}

export async function patchJson(app: Hono, path: string, body: unknown) {
  const response = await app.request(path, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: response.status, json: (await response.json()) as Json, headers: response.headers };
}

export async function deleteJson(app: Hono, path: string) {
  const response = await app.request(path, { method: "DELETE" });
  return { status: response.status, json: (await response.json()) as Json, headers: response.headers };
}

export function errorCode(json: Json): string {
  const error = json.error as { code?: string } | undefined;
  return error?.code ?? "";
}

export async function createCart(app: Hono, cookie?: string): Promise<string> {
  const created = await postJson(app, "/carts", undefined, cookie ? { cookie } : undefined);
  if (created.status !== 201 || typeof created.json.id !== "string") {
    throw new Error(`create cart failed: ${created.status} ${JSON.stringify(created.json)}`);
  }
  return created.json.id;
}

export type Shopper = { cookie: string; id: string };

function sessionCookie(headers: Headers): string {
  return headers.get("set-cookie")?.split(";")[0] ?? "";
}

export async function signInMaya(app: Hono): Promise<Shopper> {
  const signedIn = await postJson(app, "/customer/session", { email: "maya@assignment.test", password: "sleepwell" });
  if (signedIn.status !== 200) throw new Error(`sign in failed: ${JSON.stringify(signedIn.json)}`);
  return { cookie: sessionCookie(signedIn.headers), id: String((signedIn.json.customer as Json).id) };
}

export async function registerShopper(app: Hono, name: string, email: string): Promise<Shopper> {
  const registered = await postJson(app, "/customer/register", { name, email, password: "password123" });
  if (registered.status !== 201) throw new Error(`register failed: ${JSON.stringify(registered.json)}`);
  return { cookie: sessionCookie(registered.headers), id: String((registered.json.customer as Json).id) };
}

/** Places a one-item order. Pass a shopper to count it toward that customer's milestones. */
export async function placeOrder(
  app: Hono,
  key: string,
  options: { shopper?: Shopper; couponCode?: string; productId?: string } = {},
) {
  const headers = options.shopper ? { cookie: options.shopper.cookie } : undefined;
  const cartId = await createCart(app, options.shopper?.cookie);
  const added = await postJson(
    app,
    `/carts/${cartId}/items`,
    { productId: options.productId ?? ProductId.cedarSachet, quantity: 1 },
    headers,
  );
  if (added.status !== 200) throw new Error(`add item failed: ${JSON.stringify(added.json)}`);
  const checkout = await postJson(
    app,
    `/carts/${cartId}/checkout`,
    options.couponCode ? { couponCode: options.couponCode } : {},
    { ...headers, "Idempotency-Key": key },
  );
  return { ...checkout, cartId };
}
