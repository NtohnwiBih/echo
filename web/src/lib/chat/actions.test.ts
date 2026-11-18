import { describe, it, expect } from "vitest";
import { createActionLimiter, limitActions } from "./actions";

describe("limitActions", () => {
  it("leaves text with no actions alone", () => {
    expect(limitActions("Hello there.")).toBe("Hello there.");
  });

  it("keeps a single action", () => {
    expect(limitActions("*nods* Hello.")).toBe("*nods* Hello.");
  });

  it("removes the second and later actions", () => {
    expect(limitActions("*nods* Hello. *smiles* Sit. *sighs* Now.")).toBe(
      "*nods* Hello. Sit. Now.",
    );
  });

  it("removes every action when the limit is zero", () => {
    expect(limitActions("*nods* Hello.", 0)).toBe("Hello.");
  });

  it("does not leave a double space behind", () => {
    expect(limitActions("Hello *x* *y* there")).toBe("Hello *x* there");
  });

  it("keeps an action that never closes", () => {
    expect(limitActions("Hello *nods")).toBe("Hello *nods");
  });
});

describe("createActionLimiter", () => {
  it("gives the same result when the text arrives in pieces", () => {
    const limiter = createActionLimiter(1);
    const pieces = ["*no", "ds* He", "llo. *smi", "les* Bye."];
    expect(pieces.map((piece) => limiter.push(piece)).join("")).toBe("*nods* Hello. Bye.");
  });
});
