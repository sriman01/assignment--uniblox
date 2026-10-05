import type { IdPort } from "../../../application/port/outgoing/IdPort.js";
import type { Uuid } from "../../../domain/typeDefinitions.js";
import { generateUuid } from "./generateUuid.js";

export class RandomIdGenerator implements IdPort {
  next(): Uuid {
    return generateUuid();
  }
}
