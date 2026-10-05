export type Uuid = string & { __brand: "Uuid" };
export type Iso8601DateTime = string & { __brand: "Iso8601DateTime" };

export function uuidFromString(value: string): Uuid {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new Error(`Invalid UUID: ${value}`);
  }
  return value as Uuid;
}
