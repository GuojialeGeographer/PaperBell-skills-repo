---
name: track-changes
description: Write review findings into a markdown document as CriticMarkup, and process the author's replies to them. Use when the user asks for tracked changes, inline comments, or annotations on a draft, or hands over a document that already carries marks.
---

# Track changes

Findings delivered **beside the sentence they are about**, in the document
itself, instead of in a chat log. The marks and the `author="…"` prefix grammar
are in `references/criticmarkup.md`; this is how to use them without turning a
review into a rewrite.

**This skill owns delivery, not judgement.** It decides how a finding is written
into the file; deciding what is worth saying happens before this skill runs, and
is out of scope. Wrapping a mark around a sentence does not lower that bar.

## 1. Settle the author name and read what is already there

One `author="…"` name throughout a document. Omit `date=` rather than guess it —
it is display-only.

**A mark with no `author=` is the user's**, written by their editor. Never stamp
their name onto it, never invent their dates, never edit inside it.

## 2. Write the findings

The rule that everything else follows from: **never rewrite, rephrase, or
generate the author's prose.** A finding is wrapped *around* their text, never
substituted for it, and it does not bend because the fix looks obvious. This
skill annotates a draft; it does not write one.

| Mark | Use it for |
|---|---|
| `{>>…<<}` | **the default** — anything that needs a reason |
| `{++…++}` `{--…--}` `{~~old~>new~~}` | short mechanical fixes only: a typo, a missing unit, a wrong cross-reference |
| `{==…==}` | sparingly, when you genuinely cannot form a useful comment |
| `{=+…+=}` | text *you* inserted, flagged so the author can strip it in one pass |

A bare suggestion with no rationale is noise. If you cannot say why, it is not a
finding yet.

**Place the mark immediately after the passage** — same paragraph if it fits, the
next line otherwise, never with a blank line between. A blank line breaks
threading, and a multi-line comment dropped mid-paragraph splits the paragraph in
two for every tool that reads the file afterwards.

## 3. Process replies

Only when asked to address the author's comments, and only on threads they have
actually replied to:

| Their reply | What you do |
|---|---|
| `{>>done<<}` | verify the text now addresses the point, then delete the whole thread — or push back with an adjacent follow-up |
| `{>>ignore<<}`, *won't fix* | leave the thread; it documents the decision |
| a question | answer it in an adjacent mark |
| no reply | still waiting on them — leave it alone |

## 4. Say what the document now is

An annotated document is **not export-ready**. Nothing in a Pandoc chain strips
CriticMarkup, and two of the six marks print as plausible typography rather than
as visible syntax — `references/elements/annotations.md` has the table. Tell the user
this when you hand the draft back.

```
python3 scripts/check_annotations.py DRAFT.md
```

That is for the moment the review closes, not for a review in progress: while one
is open the marks are supposed to be there, so simply do not run it.

Lead the chat message with the same three findings you would have led a report
with, and say where the rest are. An annotated draft is not licence to devolve
into scattered nitpicks.

## Completion criterion

Every mark carries a severity and a named principle; no human-authored sentence
was rewritten; every mark you wrote carries the one `author=` name and none of
the user's own marks were touched; and the user has been told the draft is not
export-ready until the marks are resolved.

## Reference

- `references/criticmarkup.md` — the six marks and the prefix grammar
- `references/elements/annotations.md` — what a leftover mark compiles to, and the
  `%%…%%` form that is safe to leave in
- `scripts/check_annotations.py` — `--list-checks` for what is enforced
