import { createHash } from "node:crypto";

/** Short fingerprint of the exact prompt text, so results can't be mixed up. */
export function promptHash(text: string): string {
  return createHash("sha256").update(text).digest("hex").slice(0, 8);
}
