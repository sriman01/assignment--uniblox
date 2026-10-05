import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export type SessionKind = "customer" | "admin";

type Payload = { k: SessionKind; s: string; e: number };

/**
 * Stateless signed session cookies (`payload.signature`, HMAC-SHA256), so any server instance can verify them.
 * Signing out clears the cookie; a copied token stays valid until it expires.
 */
export class SessionTokens {
  readonly maxAgeSeconds: number;
  private readonly secret: Buffer;

  constructor(secret: string = randomBytes(32).toString("hex"), maxAgeSeconds = 60 * 60 * 24 * 7) {
    if (secret.length < 32) throw new Error("SESSION_SECRET must be at least 32 characters");
    this.secret = Buffer.from(secret);
    this.maxAgeSeconds = maxAgeSeconds;
  }

  issue(kind: SessionKind, subject: string, nowMs = Date.now()): string {
    const payload: Payload = { k: kind, s: subject, e: Math.floor(nowMs / 1000) + this.maxAgeSeconds };
    const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
    return `${encoded}.${this.sign(encoded)}`;
  }

  /** The subject, or `null` when the token is missing, forged, expired, or for another kind of session. */
  verify(kind: SessionKind, token: string | undefined, nowMs = Date.now()): string | null {
    if (!token) return null;
    const [encoded, signature, extra] = token.split(".");
    if (!encoded || !signature || extra !== undefined) return null;

    const expected = Buffer.from(this.sign(encoded));
    const actual = Buffer.from(signature);
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;

    try {
      const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as Partial<Payload>;
      if (payload.k !== kind || typeof payload.s !== "string" || typeof payload.e !== "number") return null;
      return payload.e > nowMs / 1000 ? payload.s : null;
    } catch {
      return null;
    }
  }

  private sign(encoded: string): string {
    return createHmac("sha256", this.secret).update(encoded).digest("base64url");
  }
}
