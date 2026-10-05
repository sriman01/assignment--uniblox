export type Uuid = string & { __brand: "Uuid" };
export type Iso8601DateTime = string & { __brand: "Iso8601DateTime" };

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function uuidFromString(value: string): Uuid {
  if (!uuidPattern.test(value)) throw new Error(`Invalid UUID: ${value}`);
  return value as Uuid;
}

export function iso8601DateTimeFromString(value: string): Iso8601DateTime {
  if (Number.isNaN(Date.parse(value)) || new Date(value).toISOString() !== value) {
    throw new Error(`Invalid ISO 8601 datetime: ${value}`);
  }
  return value as Iso8601DateTime;
}
