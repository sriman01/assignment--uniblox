import type { DomainError } from "./errors.js";

export type DataResult<T> = {
  success: true;
  data: T;
};

export type ErrorResult<U> = {
  success: false;
  error: U;
};

export type Result<T, U = DomainError> = DataResult<T> | ErrorResult<U>;

export function dataResult<T>(data: T): DataResult<T> {
  return { success: true, data };
}

export function errorResult<U>(error: U): ErrorResult<U> {
  return { success: false, error };
}
