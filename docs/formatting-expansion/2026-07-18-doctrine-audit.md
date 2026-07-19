# Rules-doctrine audit — defaulted destructive values nulled (2026-07-18)

**Session 97 (Sushant), Part B of the Submission Studio output-gap brief.**
Evidence: vault `02 - OSCRSJ/Notes/Strategy/2026-07-18 Submission Studio Output Assessment & Change Plan.md` finding F5.

## The doctrine

For any rule that drives a **removal or an override** of something the author
already has:

| value | meaning | engine behaviour |
|---|---|---|
| `null` | the guide is **silent** | preserve the author's setting |
| a concrete value | the guide **states it** | apply it, and cite the statement in `encoding_notes` |

A value that was defaulted, inferred, assumed, or simply not found is `null`.
Never a plausible-looking concrete value.

## What went wrong

`layout.line_numbers` was **not nullable** in `rulesSchema.ts`, so encoders had
no way to record "unspecified". 36 of the 37 files carrying `"none"` said so
explicitly in their own `encoding_notes` — several complained about it directly:

> `bmjosem`: "layout.line_numbers set to 'none' only because the enum has no null option and the live house style is silent on line numbering"

> `injury`: "page size, margins, alignment, line numbering, page numbers, and running head are unspecified and defaulted to none/false/null"

> `international-orthopaedics`: "FORCED-ENUM defaults (schema has no null slot) ... line-numbering requirement UNVERIFIED"

`ooxml/layout.ts` read `"none"` as an instruction and called
`removeChild(sect, 'w:lnNumType')`, **stripping line numbering the author had
deliberately added**. Observed live on the Injury fixture run.

## Changes

**Schema** — `line_numbers` is now `.nullable()`, with the doctrine written on
the field so future encoders inherit it.

**Engine** — `applyLayout` skips the line-number transform entirely when the
rule is `null`, and reports no change for it.

**Rule files** — `line_numbers` distribution, 75 files:

| value | before | after |
|---|---:|---:|
| `null` | 0 | **36** |
| `"none"` | 37 | **1** (`otsr`) |
| `"continuous"` / `"per_page"` | 38 | 38 |

The 36 nulled files each gained the note:

> `2026-07-18 doctrine audit: line_numbers 'none' was a default, not a guide statement — nulled so the engine preserves the author's setting.`

**`otsr` keeps `"none"`** — the only genuine guide statement in the set:
Editorial Manager auto-generates a line-numbered PDF and authors are told *not*
to submit a line-numbered manuscript. Its existing note already cites this.

**`oscrsj.alignment`: `"left"` → `null`.** Its own note said the value was
*"inferred from double-spaced Times New Roman manuscript format"*. Checked
against our own `/guide-for-authors`, which states `Spacing: double-spaced
throughout.` but says nothing about justification. Inferred ⇒ null.
(`oscrsj.line_spacing: "double"` is guide-stated and stands.)

## Fields checked and left alone

- **`alignment`** (10 non-null) — 9 of 10 cite an explicit guide instruction,
  almost all variants of *"do not use the word processor's options to justify
  text"*. Only `oscrsj` was inferred; nulled above. `ooxml/layout.ts` already
  guards with `if (L.alignment)`, so null is a correct no-op.
- **`line_spacing`** (45 non-null) — 39 cite an explicit statement. Already
  null-guarded in the engine.
- **`page_numbers.show: false` / `running_head.show: false`** — skipped per the
  brief: the engine only ever *adds* or re-aligns these, so a false value is
  non-destructive.

## Not verified — carried forward

Six files carry `line_spacing` with **no note mentioning spacing either way**:
`acta-orthopaedica`, `asian-spine-journal`, `biology-of-sport`,
`journal-of-bone-metabolism`, `journal-of-orthopaedic-translation`, `jssm`.

These were **not** changed. Absence of a note is not evidence of a default —
`encoding_notes` is a highlights section, not an exhaustive provenance log, and
double spacing is the single most commonly stated manuscript rule (39 of 45
non-null values cite it explicitly). Nulling on "the note didn't say" would
itself be an unverified change, degrading a probably-correct value.

Resolving these needs the **live guides**, which are Cloudflare-blocked for
most of these publishers from this environment. Folded into the existing
re-encode follow-up. **Do not resolve either direction by inspection.**
