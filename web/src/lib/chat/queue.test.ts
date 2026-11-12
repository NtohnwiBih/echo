import { describe, it, expect } from "vitest";
import { SerialQueue } from "./queue";

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

describe("SerialQueue", () => {
  it("runs jobs one at a time, in order", async () => {
    const queue = new SerialQueue();
    const log: string[] = [];
    const job = (name: string, ms: number) => async () => {
      log.push(`${name} start`);
      await wait(ms);
      log.push(`${name} end`);
    };
    await Promise.all([queue.run(job("a", 20)), queue.run(job("b", 1))]);
    expect(log).toEqual(["a start", "a end", "b start", "b end"]);
  });

  it("returns each job's result", async () => {
    const queue = new SerialQueue();
    expect(await queue.run(async () => 42)).toBe(42);
  });

  it("keeps going after a job fails", async () => {
    const queue = new SerialQueue();
    const failing = queue.run(async () => {
      throw new Error("boom");
    });
    const next = queue.run(async () => "ok");
    await expect(failing).rejects.toThrow("boom");
    await expect(next).resolves.toBe("ok");
  });

  it("counts running and waiting jobs", async () => {
    const queue = new SerialQueue();
    expect(queue.size).toBe(0);
    const first = queue.run(() => wait(10));
    const second = queue.run(() => wait(1));
    expect(queue.size).toBe(2);
    await Promise.all([first, second]);
    await wait(0);
    expect(queue.size).toBe(0);
  });
});
