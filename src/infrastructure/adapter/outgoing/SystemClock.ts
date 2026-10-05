import type { ClockPort } from "../../../application/port/outgoing/ClockPort.js";

export class SystemClock implements ClockPort {
  nowIso(): string {
    return new Date().toISOString();
  }
}
