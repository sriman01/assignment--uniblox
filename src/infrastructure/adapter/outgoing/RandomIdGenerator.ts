import { randomUUID } from "node:crypto";
import type { IdPort } from "../../../application/port/outgoing/IdPort.js";

export class RandomIdGenerator implements IdPort {
  next(prefix: string): string {
    return `${prefix}_${randomUUID()}`;
  }
}
