import { describe, expect, it } from "vitest";
import { createTestApp, postJson } from "./helpers.js";

describe("admin sign-in", () => {
  it("accepts the demo admin and rejects a wrong password", async () => {
    const app = createTestApp();
    const wrong = await postJson(app, "/admin/session", { email: "admin@sleepyhug.test", password: "nope" });
    expect(wrong.status).toBe(401);
    expect((wrong.json.error as { code: string }).code).toBe("INVALID_CREDENTIALS");

    const signedIn = await postJson(app, "/admin/session", { email: "admin@sleepyhug.test", password: "sleepyhug" });
    expect(signedIn.status).toBe(200);
    expect(signedIn.json).toMatchObject({ signedIn: true, email: "admin@sleepyhug.test" });
    const cookie = signedIn.headers.get("set-cookie") ?? "";
    expect(cookie).toContain("admin_session=");

    const session = await app.request("/admin/session", { headers: { cookie: cookie.split(";")[0] ?? "" } });
    expect(session.status).toBe(200);
    expect(await session.json()).toEqual({ signedIn: true, email: "admin@sleepyhug.test" });
  });
});
