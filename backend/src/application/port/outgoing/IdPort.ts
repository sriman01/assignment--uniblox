import type { Uuid } from "../../../domain/typeDefinitions.js";

export interface IdPort {
  next(): Uuid;
}
