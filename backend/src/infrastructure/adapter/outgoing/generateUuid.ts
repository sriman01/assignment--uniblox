import { v4 as uuid_v4 } from "uuid";
import type { Uuid } from "../../../domain/typeDefinitions.js";

export function generateUuid(): Uuid {
  return uuid_v4() as Uuid;
}
