import { z } from "zod";

export const CHARACTER_FILES = [
  "identity",
  "work",
  "personality",
  "history",
  "relationships",
  "knowledge",
] as const;

export const metaSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "must be lowercase words joined by hyphens"),
    scope: z.enum(["world", "character"]),
    character: z.string().optional(),
    visibility: z.enum(["public", "locked"]),
    knownBy: z.union([z.string(), z.array(z.string()).min(1)]),
    reliability: z.enum(["confirmed", "reported", "rumour"]).default("confirmed"),
    source: z.string().min(1).optional(),
    discover: z.boolean().optional(),
  })
  .strict();

export type ContentMeta = z.infer<typeof metaSchema>;
