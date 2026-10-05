import type { Iso8601DateTime } from "../../../domain/typeDefinitions.js";

export interface ClockPort {
  nowIso(): Iso8601DateTime;
}
