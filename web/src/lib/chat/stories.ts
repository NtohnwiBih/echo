export type StoryEntry = {
  subtitle: string;
  opening: string;
  suggestions: string[];
};

const stories: Record<string, StoryEntry> = {
  mira: {
    subtitle: "Aetheria · Unproven source",
    opening:
      "*Mira closes the office door and turns her evidence slate face down.* You asked about Vorr. That name has a way of making records disappear. Before I show you anything, what brought you to his case?",
    suggestions: ["What did Vorr uncover?", "Who sealed his file?", "Examine the access logs"],
  },
  kael: {
    subtitle: "Aetheria · Stranger",
    opening:
      "*Kael keeps working on a dismantled relay and does not look up.* Stall's open until the market closes. State your business.",
    suggestions: [
      "Do you know Vorr?",
      "What have the blackouts been like?",
      "Tell me about District Nine",
    ],
  },
  elyra: {
    subtitle: "Aetheria · Stranger",
    opening:
      "*Elyra slides into the booth across from you and sets her recorder on the table, switched off.* People only talk here when they think no one is listening. So, what are you listening for?",
    suggestions: ["What have your sources heard?", "Tell me about the Grid", "Who can I trust?"],
  },
};

/** The page content for a character, or undefined if there is none. */
export function getStory(slug: string): StoryEntry | undefined {
  return Object.hasOwn(stories, slug) ? stories[slug] : undefined;
}
