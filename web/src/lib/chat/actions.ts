/**
 * Keeps at most `max` *actions* in a reply. Small models ignore "at most one
 * action", so the backend enforces it. Works on a stream: call push() with each
 * piece of text and send whatever it returns.
 */
export function createActionLimiter(max = 1) {
  let inAction = false; // between a pair of asterisks
  let seen = 0; // actions started so far
  let dropping = false; // inside an action that is being removed
  let skipSpace = false; // swallow the whitespace after a removed action

  function push(text: string): string {
    let out = "";
    for (const char of text) {
      if (char === "*") {
        if (!inAction) {
          inAction = true;
          seen++;
          dropping = seen > max;
          if (!dropping) out += char;
        } else {
          inAction = false;
          if (dropping) {
            dropping = false;
            skipSpace = true;
          } else {
            out += char;
          }
        }
        continue;
      }
      if (dropping) continue;
      if (skipSpace && /\s/.test(char)) continue;
      skipSpace = false;
      out += char;
    }
    return out;
  }

  return { push };
}

/** The same limit applied to a finished reply. */
export function limitActions(text: string, max = 1): string {
  return createActionLimiter(max).push(text).trim();
}
