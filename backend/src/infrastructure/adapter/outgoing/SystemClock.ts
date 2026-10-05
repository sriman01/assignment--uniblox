import type { ClockPort } from "../../../application/port/outgoing/ClockPort.js";
import type { Iso8601DateTime } from "../../../domain/typeDefinitions.js";

export class SystemClock implements ClockPort {
  nowIso(): Iso8601DateTime {
    return new Date().toISOString() as Iso8601DateTime;
  }
}
