import type { Hono } from "hono";
import type { InMemoryStoreOptions } from "../src/infrastructure/adapter/outgoing/InMemoryCheckoutStore.js";
import { createCheckoutModule } from "../src/infrastructure/composition/createCheckoutModule.js";

export type Json = Record<string, unknown>;

export function createTestApp(options?: InMemoryStoreOptions) {
  return createCheckoutModule(options).app;
}

export async function getJson(app: Hono, path: string) {
  const response = await app.request(path);
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

export async function createCart(app: Hono): Promise<string> {
  const created = await postJson(app, "/carts");
  if (created.status !== 201 || typeof created.json.id !== "string") {
    throw new Error(`create cart failed: ${created.status} ${JSON.stringify(created.json)}`);
  }
  return created.json.id;
}
