/** Runs jobs one at a time, in the order they arrive. */
export class SerialQueue {
  private chain: Promise<void> = Promise.resolve();
  private pending = 0;

  /** How many jobs are running or waiting. A new job has this many ahead of it. */
  get size(): number {
    return this.pending;
  }

  run<T>(job: () => Promise<T>): Promise<T> {
    this.pending++;
    const result = this.chain.then(() => job());
    // The chain must never reject, or one failure would block every later job.
    this.chain = result.then(
      () => {
        this.pending--;
      },
      () => {
        this.pending--;
      },
    );
    return result;
  }
}
