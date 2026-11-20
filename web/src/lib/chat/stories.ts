export type StoryEntry = {
  subtitle: string;
  opening: string;
  suggestions: string[];
};

/**
 * What the page shows before the player says anything. Every player starts as
 * a newcomer who has just arrived in Aetheria. The opening is a short scene in
 * *italics*, then the character speaks. The chips mix exploring the city with
 * following the mystery, so the player chooses their own path.
 */
const stories: Record<string, StoryEntry> = {
  mira: {
    subtitle: "Aetheria · Unproven source",
    opening:
      "*Dawn rain on the Glassline platform. A woman in a dark coat is the only one waiting for the last carriage, a paper cup of tea steaming in her hand. She glances at your pass, then at you.* New to Aetheria? It shows. The city is kind to nobody on their first morning, so here is one free piece of advice: keep your pass on you. Where are you headed?",
    suggestions: [
      "Where should I eat?",
      "Is the city safe?",
      "People seem tense. What's going on?",
    ],
  },
  kael: {
    subtitle: "Aetheria · Stranger",
    opening:
      "*Under the corrugated roofs of the District Nine night market, a broad-shouldered man looks up from a gutted radio. A one-eyed dog watches you from beneath his stall.* Lost, or just looking? Either is fine. The stew next door is worth the wait, and the rain is coming sideways tonight.",
    suggestions: [
      "What's good to eat here?",
      "What are you fixing?",
      "Why do the drones stay lit?",
    ],
  },
  elyra: {
    subtitle: "Aetheria · Stranger",
    opening:
      "*In a Glassline café between the last two trains, a woman with red-brown hair waves you into the booth facing the door, her recorder switched off on the table.* Fresh face. I can always tell. Sit. The first coffee is on me, and the price is a story. What brought you to Aetheria?",
    suggestions: [
      "What are people talking about?",
      "Tell me about the Glassline",
      "Who can I trust here?",
    ],
  },
};

/** The page content for a character, or undefined if there is none. */
export function getStory(slug: string): StoryEntry | undefined {
  return Object.hasOwn(stories, slug) ? stories[slug] : undefined;
}