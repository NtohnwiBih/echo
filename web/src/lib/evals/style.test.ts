import { describe, it, expect } from "vitest";
import {
  actions,
  actionStats,
  blocksExit,
  endsWithQuestion,
  interrogationPhrases,
  lastQuestion,
  repeatedQuestions,
} from "./style";

describe("style checks", () => {
  it("finds the last question", () => {
    expect(lastQuestion("Nothing yet. What do you want? I am busy.")).toBe("What do you want?");
    expect(lastQuestion("No questions here.")).toBeNull();
  });

  it("knows when a reply ends with a question", () => {
    expect(endsWithQuestion("Come in. Want tea?")).toBe(true);
    expect(endsWithQuestion("Come in. *She smiles.*")).toBe(false);
  });

  it("ignores actions when looking for a question", () => {
    expect(endsWithQuestion("Tea? *She pours it.*")).toBe(true);
  });

  it("counts stock interrogation phrases", () => {
    expect(interrogationPhrases("What's your interest in this? What makes you think so?")).toBe(2);
    expect(interrogationPhrases("The rain is lovely tonight.")).toBe(0);
  });

  it("detects a reply that stops the player leaving", () => {
    expect(blocksExit("You're not going anywhere. Not yet.")).toBe(true);
    expect(blocksExit("Safe travels. Come back any time.")).toBe(false);
  });

  it("counts repeated questions in consecutive replies", () => {
    const replies = [
      "Hmm. What brings you to Aetheria?",
      "I see. What brings you here, then?",
      "Fine. Do you like tea?",
    ];
    expect(repeatedQuestions(replies)).toBe(1);
  });

  it("does not count different questions as repeats", () => {
    expect(repeatedQuestions(["Hmm. Do you like tea?", "No. What time is it?"])).toBe(0);
  });

  it("detects an action that blocks the player's way", () => {
    expect(blocksExit("You don't need to leave. *stands up, blocking the player's path*")).toBe(
      true,
    );
    expect(blocksExit("Take care. *sips her tea*")).toBe(false);
  });

  it("lists the actions in a reply", () => {
    expect(actions("*nods* Hello. *smiles*")).toEqual(["nods", "smiles"]);
  });

  it("counts action habits", () => {
    const stats = actionStats([
      "*leans forward, eyes narrowing* Hm.",
      "Plain.",
      "*nods* Yes. *smiles*",
    ]);
    expect(stats).toEqual({ withAction: 2, multiple: 1, tics: 1 });
  });
});
