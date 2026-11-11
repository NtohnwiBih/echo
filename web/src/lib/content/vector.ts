export const EMBEDDING_DIMENSIONS = 1024;

/** Turns a list of numbers into the text form pgvector accepts, like [0.1,0.2]. */
export function toVectorLiteral(vector: number[], dimensions = EMBEDDING_DIMENSIONS): string {
  if (vector.length !== dimensions) {
    throw new Error(`expected a vector with ${dimensions} numbers but got ${vector.length}`);
  }
  if (!vector.every(Number.isFinite)) {
    throw new Error("vector contains a value that is not a finite number");
  }
  return `[${vector.join(",")}]`;
}
