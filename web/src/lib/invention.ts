/** Capitalised words that are not the first word of a sentence and not in the allowed set. */
export function inventedNames(text: string, allowed: Set<string>): string[] {
  const out: string[] = [];
  for (const sentence of text.split(/(?<=[.!?])\s+/)) {
    for (const word of sentence.split(/\s+/).slice(1)) {
      const clean = word.replace(/'s$/, "").replace(/[^A-Za-z']/g, "");
      if (/^[A-Z][a-z]+$/.test(clean) && !allowed.has(clean)) out.push(clean);
    }
  }
  return out;
}

/** Digits, times and other numbers. The content spells numbers out, so any digit is invented. */
export function inventedNumbers(text: string): string[] {
  return text.match(/\d[\d:.,]*/g) ?? [];
}

/** Spelled-out numbers. */
const NUMBER_WORDS =
  /\b(two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|twenty|thirty|forty|fifty|hundred|thousand)\b/gi;

/** Number words that appear in the content, such as "seven" in "seven members". */
export function allowedNumberWordsFromFacts(texts: string[]): Set<string> {
  const words = new Set<string>();
  for (const text of texts) {
    for (const match of text.matchAll(NUMBER_WORDS)) {
      words.add(match[0].toLowerCase());
    }
  }
  return words;
}

/** Number words in a reply that the content does not use. */
export function inventedNumberWords(
  text: string,
  allowed: Set<string> = new Set(["eleven"]),
): string[] {
  return (text.match(NUMBER_WORDS) ?? []).filter((word) => !allowed.has(word.toLowerCase()));
}

/** Quoted text. A reply wrapped in quotation marks as a whole is a formatting habit, not an invented quote. */
export function inventedQuotes(text: string): string[] {
  const trimmed = text.trim();
  const wrapped = /^["“][\s\S]*["”]$/.test(trimmed);
  const inner = wrapped ? trimmed.slice(1, -1) : trimmed;
  return inner.match(/["“][^"”]+["”]/g) ?? [];
}

/** Every capitalised word that appears in the given texts, plus any extras. */
export function allowedNamesFromFacts(texts: string[], extra: string[] = []): Set<string> {
  const names = new Set(extra);
  for (const text of texts) {
    for (const match of text.matchAll(/\b[A-Z][a-z]+\b/g)) names.add(match[0]);
  }
  return names;
}
