import type { ContentMeta } from "./schema";

export type Level = "error" | "warning";

export type Issue = {
  level: Level;
  path: string;
  line?: number;
  message: string;
};

export type Fact = {
  text: string;
  line: number;
};

export type ContentDoc = {
  path: string;
  meta: ContentMeta;
  title: string;
  facts: Fact[];
};

export type CharacterRef = {
  slug: string;
  name: string;
};
