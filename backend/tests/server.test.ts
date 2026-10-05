import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createCheckoutModule } from "../src/infrastructure/composition/createCheckoutModule.js";
import { createServerApp } from "../src/infrastructure/composition/createServerApp.js";

let frontendRoot: string | null = null;

afterEach(async () => {
  if (frontendRoot) await rm(frontendRoot, { recursive: true, force: true });
  frontendRoot = null;
});

describe("single-server deployment", () => {
  it("serves the API and React Router fallback from one Hono app", async () => {
    frontendRoot = await mkdtemp(join(tmpdir(), "checkout-frontend-"));
    await writeFile(join(frontendRoot, "index.html"), "<html><body>checkout-ui</body></html>");

    const { app: api } = createCheckoutModule();
    const app = createServerApp(api, frontendRoot);

    const health = await app.request("/api/health");
    expect(health.status).toBe(200);
    expect(await health.json()).toEqual({ ok: true });

    const home = await app.request("/");
    expect(home.status).toBe(200);
    expect(await home.text()).toContain("checkout-ui");

    const clientRoute = await app.request("/account");
    expect(clientRoute.status).toBe(200);
    expect(await clientRoute.text()).toContain("checkout-ui");
  });
});
