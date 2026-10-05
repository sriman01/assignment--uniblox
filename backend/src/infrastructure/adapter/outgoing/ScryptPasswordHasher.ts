import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import type { PasswordHasherPort } from "../../../application/port/outgoing/PasswordHasherPort.js";

const keyLength = 32;

export class ScryptPasswordHasher implements PasswordHasherPort {
  hash(password: string): string {
    const salt = randomBytes(16).toString("hex");
    const derived = scryptSync(password, salt, keyLength).toString("hex");
    return `scrypt$${salt}$${derived}`;
  }

  verify(password: string, passwordHash: string): boolean {
    const [scheme, salt, expectedHex] = passwordHash.split("$");
    if (scheme !== "scrypt" || !salt || !expectedHex) return false;
    const expected = Buffer.from(expectedHex, "hex");
    const actual = scryptSync(password, salt, expected.length);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  }
}
