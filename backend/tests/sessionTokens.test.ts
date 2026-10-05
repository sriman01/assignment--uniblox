import { describe, expect, it } from "vitest";
import { SessionTokens } from "../src/infrastructure/adapter/incoming/http/sessionTokens.js";

const secret = "a".repeat(32);

describe("session tokens", () => {
  it("verifies on any instance that shares the secret, and only for the same kind", () => {
    const token = new SessionTokens(secret).issue("customer", "77777777-7777-4777-8777-777777777777");
    const otherInstance = new SessionTokens(secret);
    expect(otherInstance.verify("customer", token)).toBe("77777777-7777-4777-8777-777777777777");
    expect(otherInstance.verify("admin", token)).toBeNull();
    expect(new SessionTokens("b".repeat(32)).verify("customer", token)).toBeNull();
  });

  it("rejects tampered, malformed, and expired tokens", () => {
    const tokens = new SessionTokens(secret, 60);
    const issuedAt = Date.parse("2026-10-05T00:00:00.000Z");
    const token = tokens.issue("admin", "admin@assignment.test", issuedAt);
    const [payload, signature] = token.split(".");
    const forgedPayload = Buffer.from(JSON.stringify({ k: "admin", s: "someone-else", e: 9_999_999_999 })).toString("base64url");

    expect(tokens.verify("admin", token, issuedAt + 59_000)).toBe("admin@assignment.test");
    expect(tokens.verify("admin", token, issuedAt + 60_000)).toBeNull();
    expect(tokens.verify("admin", `${forgedPayload}.${signature}`, issuedAt)).toBeNull();
    expect(tokens.verify("admin", `${payload}.${signature}x`, issuedAt)).toBeNull();
    expect(tokens.verify("admin", `${token}.extra`, issuedAt)).toBeNull();
    expect(tokens.verify("admin", undefined)).toBeNull();
  });

  it("refuses short secrets", () => {
    expect(() => new SessionTokens("short")).toThrow("at least 32 characters");
  });
});
