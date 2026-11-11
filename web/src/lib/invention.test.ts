import { describe, it, expect } from "vitest";
import {
  allowedNamesFromFacts,
  allowedNumberWordsFromFacts,
  inventedNames,
  inventedNumberWords,
  inventedNumbers,
  inventedQuotes,
} from "./invention";

const allowed = new Set(["Mira", "Vorr"]);

describe("inventedNames", () => {
  it("flags an unknown name in the middle of a sentence", () => {
    expect(inventedNames("I spoke to Zara Esh today.", allowed)).toEqual(["Zara", "Esh"]);
  });
  it("ignores the first word of a sentence", () => {
    expect(inventedNames("Nobody saw him. Later we left.", allowed)).toEqual([]);
  });
  it("ignores allowed names, including possessives", () => {
    expect(inventedNames("That was Vorr's badge, said Mira.", allowed)).toEqual([]);
  });
});

describe("the other invention checks", () => {
  it("flags times and digits", () => {
    expect(inventedNumbers("It was at 22:00 sharp.")).toEqual(["22:00"]);
  });
  it("flags spelled-out numbers but not eleven", () => {
    expect(inventedNumberWords("I found three witnesses and eleven files.")).toEqual(["three"]);
  });
  it("flags quoted text", () => {
    expect(inventedQuotes('He said "go away" quietly.')).toEqual(['"go away"']);
  });
  it("ignores a reply wrapped entirely in quotation marks", () => {
    expect(inventedQuotes('"Nothing has changed."')).toEqual([]);
    expect(inventedQuotes('"He said "go away" to me."')).toEqual(['"go away"']);
  });
});

describe("allowedNamesFromFacts", () => {
  it("collects capitalised words and the extras", () => {
    const names = allowedNamesFromFacts(["Vorr led the Meridian Grid project."], ["Mira"]);
    expect(names.has("Vorr")).toBe(true);
    expect(names.has("Meridian")).toBe(true);
    expect(names.has("Mira")).toBe(true);
    expect(names.has("led")).toBe(false);
  });
  it("allows number words that appear in the content", () => {
    const allowed = allowedNumberWordsFromFacts([
      "The Council has seven members.",
      "The Nine Days cut power.",
    ]);
    expect(
      inventedNumberWords("The seven members met during the Nine Days, said three.", allowed),
    ).toEqual(["three"]);
  });
});
