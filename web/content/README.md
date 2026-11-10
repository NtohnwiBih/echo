# ECHO content (version two)

This folder is the source of truth for everything the characters may know about the world and about themselves. The files are for authoring. Later, an ingestion step will split each file into single facts, embed them and store them in the database. The model will only ever see the few facts retrieved for a given question.

Until that step exists, the running prompt still uses `world.ts` and `characters.ts`. These files do not change it yet.

## Layout

    content/
      world/            shared facts about Aetheria
        signals/        the city signals shown on the Discover page
        locked/         secrets: never retrieved until the story unlocks them
      characters/
        mira/           identity, work, personality, history, relationships, knowledge
        kael/
        elyra/

## File format

Every file starts with front matter, then a title, then one fact per bullet.

    ---
    id: world-council
    scope: world
    visibility: public
    knownBy: all
    ---
    # The Council
    - The Council governs Aetheria and has seven members.

| Field | Values | Meaning |
|---|---|---|
| `scope` | `world`, `character` | Shared world fact, or a fact about one character |
| `character` | `mira`, `kael`, `elyra` | Character files only |
| `visibility` | `public`, `locked` | Locked facts are never retrieved until the backend records that the story unlocked them |
| `knownBy` | `all`, `self`, `none`, or a list such as `[mira]` | Who may state the fact. `self` means only the character the file belongs to. `none` means nobody yet |
| `reliability` | `confirmed`, `reported`, `rumour` | How solid the fact is inside the story. If omitted, it is `confirmed` |
| `source` | text | Optional label shown with a signal, for example `District Nine · Street report` |
| `discover` | `true` | Optional. The first bullet of the file is shown on the Discover page as a city signal |

A character always knows the facts in their own files. Other characters can use them only if `knownBy` says `all` or lists them.

Discover signals are shown to the player whatever `knownBy` says. That is deliberate: the player can know something that no character in the room knows.

## Rules for writing facts

1. **One fact per bullet, and it must make sense alone.** Retrieval returns single bullets, so name the subject every time. Write "Vorr led the Meridian Grid project", never "He led it".
2. **Write the gaps as facts.** If players will ask a question and nobody knows the answer, write "It is not publicly known where Vorr lived." That is a true statement the character can say instead of inventing an answer.
3. **Spell numbers out** ("seven members", "eleven days"). The invention check treats any digit in a reply as invented.
4. **Never put a secret in a public file.** Anything a character must not reveal yet goes in `world/locked/` or in a file with `knownBy: none`.
5. **Mark rumours as rumours.** A character may repeat a rumour, but must be able to tell it apart from a confirmed fact.
6. **Keep names consistent.** The invention check will later build its list of allowed names from these files.
7. **Facts that change over time** (for example, "eleven days ago") will go stale as the story moves. Prefer anchors such as "on the night he vanished" where you can.
8. **Do not contradict another file.** When you change a fact, search the whole folder for the old wording.

## Questions players will ask

For each question, some file should hold either the answer or a fact saying nobody knows.

- Who is the character, what do they do, where do they live and work?
- Who runs the city, who runs the Grid, and who is the Council?
- What happened to Vorr, when, and where was he last seen?
- Who saw him last, who were his colleagues, did he have family, where did he live?
- What was he working on, did anyone threaten him, was he afraid, did he leave a message?
- Why are the lower districts having blackouts, and is the Grid safe?
- What are the Nine Days, and why are the districts sealed?
- Who sealed Vorr's records?
- What does each character want, fear and refuse to talk about?
- How do the characters know each other, and what do they think of one another?

Everything in these files is a first draft. Rewrite it in your own words: it is your world.

## Version history

- Version one: first draft of the world and the three characters.
- Version two: the Corporate Consortium operates the Grid under a Council contract. District Nine, the Meridian Exchange and the Glassline were added. The historical power failure was renamed the Nine Days, because it clashed with the rolling blackouts now happening. Rumours and city signals were added, and the front matter gained `reliability`, `source` and `discover`.
