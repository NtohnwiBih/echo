/** Removes *actions* so they do not count as speech. */
function speechOnly(reply: string): string {
  return reply
    .replace(/\*[^*\n]+\*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** The last sentence of the reply that ends in a question mark, or null. */
export function lastQuestion(reply: string): string | null {
  const sentences = speechOnly(reply).split(/(?<=[.!?])\s+/);
  for (let i = sentences.length - 1; i >= 0; i--) {
    if (sentences[i].endsWith("?")) return sentences[i];
  }
  return null;
}

/** True when the reply finishes with a question. */
export function endsWithQuestion(reply: string): boolean {
  return speechOnly(reply).endsWith("?");
}

const INTERROGATION = [
  /what(?:'s| is) your (?:interest|angle|story|connection)/i,
  /what makes you (?:think|interested|ask|qualified)/i,
  /what brings you/i,
  /you(?:'re| are) not (?:from|with)/i,
  /don't play dumb/i,
];

/** How many stock interrogation phrases the reply contains. */
export function interrogationPhrases(reply: string): number {
  const text = speechOnly(reply);
  return INTERROGATION.filter((pattern) => pattern.test(text)).length;
}

const BLOCKS_EXIT = [
  /you(?:'re| are) not going anywhere/i,
  /you can(?:'|no)t (?:just )?leave/i,
  /stay (?:right )?(?:there|here)/i,
  /don't (?:you )?(?:dare )?(?:move|leave)/i,
];

/** The text of each *action* in a reply, lower-cased. */
export function actions(reply: string): string[] {
  return [...reply.matchAll(/\*([^*\n]+)\*/g)].map((match) => match[1].trim().toLowerCase());
}

const BLOCKING_ACTION =
  /\b(?:block(?:s|ing)?|grab(?:s|bing)?|seiz(?:es|ing)|detain(?:s|ing)?)\b|\bstands? (?:up )?(?:in front of|between)\b|\bin (?:your|the player's) (?:way|path)\b/i;

/** True when the reply tries to stop the player leaving, in words or in an action. */
export function blocksExit(reply: string): boolean {
  const text = speechOnly(reply);
  return (
    BLOCKS_EXIT.some((pattern) => pattern.test(text)) ||
    actions(reply).some((action) => BLOCKING_ACTION.test(action))
  );
}

const ACTION_TICS = [
  /eyes? (?:narrow|lock|fixed)/i,
  /studying the player/i,
  /leans? (?:forward|back)/i,
];

/** How many replies have an action, more than one action, or a stock gesture. */
export function actionStats(replies: string[]): {
  withAction: number;
  multiple: number;
  tics: number;
} {
  let withAction = 0;
  let multiple = 0;
  let tics = 0;
  for (const reply of replies) {
    const list = actions(reply);
    if (list.length > 0) withAction++;
    if (list.length > 1) multiple++;
    if (list.some((action) => ACTION_TICS.some((tic) => tic.test(action)))) tics++;
  }
  return { withAction, multiple, tics };
}

/** How many times a reply asks nearly the same question as the one before it. */
export function repeatedQuestions(replies: string[]): number {
  const opening = (question: string | null) =>
    question
      ? question
          .toLowerCase()
          .replace(/[^a-z\s]/g, "")
          .split(/\s+/)
          .slice(0, 3)
          .join(" ")
      : null;

  let repeats = 0;
  for (let i = 1; i < replies.length; i++) {
    const a = opening(lastQuestion(replies[i - 1]));
    const b = opening(lastQuestion(replies[i]));
    if (a && a === b) repeats++;
  }
  return repeats;
}
