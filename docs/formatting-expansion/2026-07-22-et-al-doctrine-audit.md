# Rules-doctrine audit — `et_al_threshold` three-state fix (2026-07-22)

**Session 98 (Sushant), Part B of the Submission Studio integrity-fix brief.**
Mirrors the 2026-07-18 `line_numbers` doctrine audit (`2026-07-18-doctrine-audit.md`) — same bug class, one field over.

## The doctrine

Silence is not an instruction. For `references.et_al_threshold`:

| value | meaning | engine behaviour |
|---|---|---|
| number `N` | the guide states "list up to N authors, then et al." | render truncates at N; no flag |
| `'all'` **(new)** | the guide **explicitly** requires every author | render lists every author; an author using "et al." gets an action-required flag |
| `null` | the guide is **silent** | render falls back to the citation style's own default (NLM/Vancouver/AMA → 6 then et al.; custom → list all); **no flag ever** |

## What went wrong

The schema comment said null = "journal does not specify," but
`analyze.ts` treated null as "list every author" and raised an
**action-required** violation ("References must list all authors — no 'et
al.'") fabricated from guide silence, and `render.ts` rendered full lists.
**47 of 75** rule files carried null — including `oscrsj.json`, which
simultaneously declares Vancouver style (whose own convention truncates at
6). Authors who correctly wrote "et al." were told it was a violation.

## Changes

**Schema** — `et_al_threshold: z.union([z.number().int(), z.literal('all')]).nullable()`,
with the three-state doctrine written on the field.

**Engine** —
- `analyze.ts`: the all-authors flag fires **only** on `'all'`.
- `render.ts`: new `STYLE_DEFAULT_ET_AL` map for the null state — NLM 6,
  Vancouver 6, AMA 6, custom → no truncation. Manual citations are in the
  map's comment. Note: AMA 11th §3.7 technically truncates >6-author lists
  to the first **three** + et al.; the single-N field cannot express
  "3-of->6" and the brief prescribes 6 — deliberately the conservative
  direction (more authors listed is never a desk-reject; three when the
  journal wanted six could be).
- `demoSpecs.ts` / `WordDemo.tsx`: type widened; the demo status bar renders
  `'all'` as "all authors listed" instead of the nonsensical "et al. past all".

**Rule files** — distribution across 75 files:

| value | before | after |
|---|---:|---:|
| number | 28 | 28 |
| `'all'` | 0 | **4** |
| `null` | 47 | **43** |

## Per-journal decisions (the 47 nulls)

Evidence source: each file's own `encoding_notes` only. Live guides are
Cloudflare-blocked from build sessions and were **not** fetched; nothing was
flipped without an already-recorded explicit statement.

### Set to `'all'` (4) — explicit guide statement recorded

| journal | recorded evidence |
|---|---|
| `jbjs` | "all authors listed with no 'et al.'" (PubMed/Index Medicus reference format section) |
| `jbjs-open-access` | "journal citations must include all authors (not 'et al.')" |
| `jbjs-reviews` | guide "explicitly forbids abbreviating author lists: 'journal citations must include all authors (not \"et al.\") and complete page numbers'" |
| `biology-of-sport` | "References: 'List all authors' — no et al." |

Each flipped file gained an `encoding_notes` entry recording the change.

### Stay `null` (43)

**Explicitly permissive, no numeric N (3):** `aots`,
`european-spine-journal`, `kssta` — all carry the Springer wording "the
names of all authors should be provided, but the usage of et al in long
author lists will also be accepted." A hard `'all'` would flag authors the
guide explicitly accepts; a number would be invented. All three are
custom-style → the null default lists every author, matching the guide's
"ideally" preference with no flag.

**Example-derived full lists only — not a stated rule (7):** `essr`,
`injury`, `international-orthopaedics`, `jat`, `jssm`,
`journal-of-orthopaedics-and-traumatology`, `nassj`. Their notes say the
guide's *sample references* list all authors but state no rule. Doctrine:
an example is not a statement; inventing `'all'` from it would raise
action-required flags on guide-accepted manuscripts. All but `essr` and
`jat` are custom-style (null → full list anyway, so behavior matches the
samples).

**Threshold known only from third-party sources (2):** `crmm` (a
third-party CSL implies 6 — its note says "the live guide does not state a
threshold, so left null"; the Vancouver null-default of 6 now happens to
coincide), `tamd` (Sage's two-tier "6, else first 3 + et al." rule is not
quoted in the journal's own guide AND is unrepresentable in a single-N
field).

**No recorded evidence either way (31):** `acta-orthopaedica` ("no et al.
author threshold stated"), `sjmss` ("et al. threshold not stated"), `ajsm`,
`asmr`, `bjj`, `bjpt`, `bone-joint-open`, `bone-joint-research`,
`calcified-tissue-international`, `efort-open-reviews`, `ejap`, `ejss`,
`global-spine-journal`, `ijspp`, `jbmr`, `jbmr-plus`, `jcsm`, `jeo`, `jhs`,
`jocr`, `jor-spine`, `journal-of-sports-sciences`, `jshs`, `ksrr`, `ojsm`,
`oscrsj`, `osteoarthritis-cartilage`, `physical-therapy-in-sport`,
`science-medicine-football`, `sports-health`, `sports-medicine`.

## Needs future live-guide verification

Cannot be resolved from recorded evidence; pairs with the existing §11
re-encode/re-verify items (Cloudflare-clearing fetch required):

- **`essr`** (NLM style): samples list all authors, so the null default (6 +
  et al.) may diverge from house practice for >6-author references. If the
  live guide states an all-authors rule, flip to `'all'`.
- **`tamd`** (Vancouver): if Sage's two-tier rule is confirmed in the
  journal's own guide, the schema needs a richer shape (e.g.
  `{ list_up_to: 6, then_first: 3 }`) — a single N cannot express it.
- **`jssm`** (custom): the reference-list example lists all 6 authors; if
  the live guide states an all-authors rule, flip to `'all'` (today's
  custom-null behavior already lists all, so only the flag differs).

## Acceptance (verified this session)

- OSCRSJ-targeted manuscript using "et al." → no all-authors flag
  (`tests/pipeline.test.ts`).
- JBJS-targeted → flag still fires (same test).
- Null-threshold Vancouver render truncates at 6; `'all'` lists everyone;
  custom-null lists everyone (`tests/references-render.test.ts`).
- `npm run validate:rules` → 75/75. `npx tsc --noEmit` → 0.
