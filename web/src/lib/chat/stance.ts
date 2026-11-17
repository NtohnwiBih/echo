export type PlayerRole = "newcomer" | "investigator" | "local";
export type Stance = "leaving" | "annoyed" | "neutral";

const LEAVING = [
  /\btake my leave\b/i,
  /\bi(?:'m| am| will|'ll)? (?:just )?(?:leave|leaving|head out)\b/i,
  /\bgoodbye\b/i,
  /\bbye\b/i,
];

const ANNOYED = [
  /\b(?:girl|just|please)\s+chill\b/i,
  /\bchill out\b/i,
  /\baggressive\b/i,
  /\brude\b/i,
  /\bcalm down\b/i,
  /\bback off\b/i,
  /\bdo we have a problem\b/i,
  /\bspell it out\b/i,
  /\bstop (?:asking|interrogating|it)\b/i,
];

/** A cheap first guess at the player's mood from their words. A classifier replaces it later. */
export function detectStance(message: string): Stance {
  if (LEAVING.some((pattern) => pattern.test(message))) return "leaving";
  if (ANNOYED.some((pattern) => pattern.test(message))) return "annoyed";
  return "neutral";
}

const ROLE_NOTES: Record<PlayerRole, string> = {
  newcomer:
    "The player is a newcomer who has just arrived in Aetheria and knows nothing about the case. Do not ask what they know about it. Welcome them and offer to show them around.",
  investigator:
    "The player has come about the Vorr case. Share what you can, as far as you trust them.",
  local: "The player lives in Aetheria and knows the city well.",
};

const STANCE_NOTES: Record<Exclude<Stance, "neutral">, string> = {
  leaving:
    "The player wants to leave. Let them go gracefully. Do not block them, hold them back or ask them to stay. Say a warm goodbye in character.",
  annoyed:
    "The player is annoyed with you. Soften your tone, apologise lightly or joke, and drop the case. Do not accuse them or ask what they are hiding.",
};

/** Short situational instructions, placed next to the player's words. */
export function buildSceneNotes({
  role,
  stance = "neutral",
}: { role?: PlayerRole; stance?: Stance } = {}): string[] {
  const notes: string[] = [];
  if (role) notes.push(ROLE_NOTES[role]);
  if (stance !== "neutral") notes.push(STANCE_NOTES[stance]);
  return notes;
}
