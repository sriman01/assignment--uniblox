export class AsyncLock {
  private tail: Promise<void> = Promise.resolve();

  run<T>(fn: () => T | Promise<T>): Promise<T> {
    const result = this.tail.then(fn);
    this.tail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }
}
