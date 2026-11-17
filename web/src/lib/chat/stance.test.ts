import { describe, it, expect } from "vitest";
import { buildSceneNotes, detectStance } from "./stance";

describe("detectStance", () => {
  it("spots a player who wants to leave", () => {
    expect(detectStance("Sorry, I can't help you, I will take my leave now")).toBe("leaving");
    expect(detectStance("If you can't help me I will just leave")).toBe("leaving");
    expect(detectStance("I'm leaving")).toBe("leaving");
  });

  it("spots an annoyed player", () => {
    expect(detectStance("It's just a question, girl chill")).toBe("annoyed");
    expect(detectStance("you are so aggressive")).toBe("annoyed");
    expect(detectStance("Nothing, should I spell it out? NOTHING")).toBe("annoyed");
  });

  it("does not mistake an ordinary question for either", () => {
    expect(detectStance("Where is the Glassline cafe, is it a chill spot?")).toBe("neutral");
    expect(detectStance("Who leads the Council?")).toBe("neutral");
  });

  it("puts leaving before annoyed", () => {
    expect(detectStance("You're rude, I'm leaving")).toBe("leaving");
  });
});

describe("buildSceneNotes", () => {
  it("says nothing when there is nothing to say", () => {
    expect(buildSceneNotes()).toEqual([]);
    expect(buildSceneNotes({ stance: "neutral" })).toEqual([]);
  });

  it("describes the player's role", () => {
    expect(buildSceneNotes({ role: "newcomer" })[0]).toContain("newcomer");
  });

  it("tells the character not to block a player who is leaving", () => {
    expect(buildSceneNotes({ stance: "leaving" })[0]).toContain("Do not block");
  });

  it("combines a role and a stance", () => {
    expect(buildSceneNotes({ role: "newcomer", stance: "annoyed" })).toHaveLength(2);
  });
});
