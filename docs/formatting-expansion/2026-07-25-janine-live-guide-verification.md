# Live-guide verification pass + pre-announcement accuracy audit (2026-07-25)

**Janine (Scholarly Infrastructure & Compliance).** Discharges four open handoffs:
`^handoff-janine-et-al-live-guide-2026-07-22`, `^handoff-janine-line-spacing-provenance-2026-07-18`,
`^handoff-janine-finder-metadata-backfill-2026-07-18`, and a partial pass at
`^handoff-janine-formatting-top75-audit-2026-07-12` (waived 2026-07-12; re-opened because a
public announcement is now on the table).

Doctrine unchanged and enforced throughout: **verified-or-null.** Every non-null value carries a
source and a date. Unknown stays null and the UI renders "—". Nothing was inferred from a sibling
journal, a publisher house style, or a plausible default.

---

## 0. Reachability — read this before reading the numbers

Every conclusion below is bounded by what could actually be fetched. Attempts were made via
`WebFetch` **and** via a browser-driven session against a logged-in Chrome.

| Publisher estate | Result |
|---|---|
| Springer / BMC (`link.springer.com`) | ✅ reachable, high yield |
| BMJ (`bjsm.bmj.com`) | ✅ reachable |
| Society / self-hosted (Acta Orthopaedica, Asian Spine J, J Bone Metab, JSSM, Termedia) | ✅ reachable |
| Sage **PDF mirror** (`sagepub.com/docs/default-source/...`) | ✅ reachable |
| **Elsevier / ScienceDirect** | ❌ CAPTCHA challenge ("Are you a robot?") — not bypassed |
| **Sage HTML** (`journals.sagepub.com`) | ❌ Cloudflare interstitial, never cleared |
| **Wolters Kluwer / LWW** (`journals.lww.com`) | ❌ Cloudflare interstitial, never cleared |
| **Taylor & Francis**, **Wiley** (`onlinelibrary.wiley.com`) | ❌ 403 |

**Consequence, stated plainly: `jbjs` and `ajsm` could not be verified this session.** They are the
two journals the original pre-launch gate named, both were encoded from archived sources, and both
sit behind Wolters Kluwer and Sage respectively. A CAPTCHA was presented and was not solved. This
is the single most important limitation in this document and it shapes the verdict in §5.

---

## 1. `line_spacing` provenance — 5 of 6 resolved, all CONFIRMED

Handoff asked: read each journal's **own** guide and either cite the sentence or null the value.
Both outcomes were acceptable; a value with no provenance was the only bad state.

| journal | encoded | verdict | the sentence |
|---|---|---|---|
| `acta-orthopaedica` | `double` | ✅ **confirm** | "It should be double line spaced (also the reference list), line numbered…" |
| `asian-spine-journal` | `double` | ✅ **confirm** | "…typed in 10-point Arial, Times New Roman, or Courier font and double-spaced." |
| `biology-of-sport` | `double` | ✅ **confirm** | "…Times New Roman font, 12-point type, double-spaced with 2.5 cm margins." |
| `journal-of-bone-metabolism` | `double` | ✅ **confirm** | "…written in 12-point font with double line spacing on A4 sized… paper…" |
| `jssm` | `double` | ✅ **confirm** | "The manuscripts should be submitted in Times New Roman font, 12-point type, double-spaced with 3 cm margins on all sides." |
| `journal-of-orthopaedic-translation` | `double` | ⛔ **unresolved** | Elsevier CAPTCHA. Value stands (2024 Wayback-sourced); attempt recorded. |

Each confirmed file gained an `encoding_notes` entry quoting the sentence.

**Session 97 was right to refuse to null these.** All five were correct. Nulling on "the note didn't
say" would have degraded five accurate values and, for the four journals that genuinely mandate
double spacing, would have shipped manuscripts in the author's original spacing against an explicit
journal instruction. This is the second time the *don't-resolve-by-inspection* rule has paid; it
should be treated as settled practice.

**Two secondary confirmations fell out of the same fetches:**
- `acta-orthopaedica.layout.line_numbers = "continuous"` is confirmed by the same sentence ("line numbered").
- A trap worth recording: `actaorthop.org/actao/about/submissions` carries an OJS **platform
  boilerplate** checklist reading *"The text is single-spaced"* — flatly contradicting the journal's
  own instructions. An encoder working from the submissions page instead of the instructions page
  would have introduced a real defect. Noted in the file.

---

## 2. `et_al_threshold` — 2 of 3 resolved; the schema gap is real but sits on a different journal

| journal | encoded | verdict |
|---|---|---|
| `jssm` | `null` | ✅ **null CONFIRMED CORRECT.** The guide's reference section shows full-author *examples* and states no rule. The only stated "et al." rule is for **in-text** Harvard citations (3+ authors). An example is not a statement — Session 98's call stands. |
| `tamd` | `null` | ✅ **null CONFIRMED CORRECT.** Sage's official TAMD guidelines PDF states **no author-count rule** in its reference section. The two-tier "6, else first 3" is Sage *house* style, not this journal's instruction. **No schema change needed for tamd.** |
| `essr` | `null` | ⛔ **unresolved.** Wolters Kluwer / LWW blocked. Stays null; attempt recorded. |

### 2.1 The two-tier shape IS needed — for `asian-spine-journal`, and for AMA

The handoff predicted the schema gap would surface at `tamd`. It didn't. It surfaced while
verifying a different journal, and there it is unambiguous:

> **Asian Spine Journal:** *"List names of all authors when six or fewer. When seven or more, list
> only the first three names, followed by 'et al.'"*

`asian-spine-journal.references.et_al_threshold` is `6`. A single N cannot express this rule. Today
our engine renders an 8-author reference as **6 authors + et al.**; the journal wants **3 + et al.**
That is a live, author-visible formatting error on a journal we told the author we had handled.

The same shape governs **AMA 11th §3.7** (>6 authors → first **three** + et al.). Session 98
recorded encoding AMA's `STYLE_DEFAULT_ET_AL` as `6` as the deliberately conservative direction,
reasoning that listing too many authors is never a desk-reject. I agree with that as a stopgap and
**disagree with it as a permanent encoding**, for one reason: AMA's rule is *published and citable*,
so encoding it is a verified change, not an inferred one. The conservative-default argument is the
right tool when a rule is unknown. It is the wrong tool when the rule is known and we are choosing
not to represent it. This currently affects every `ama`-style journal with a null threshold —
including **AJSM**, the highest-profile sports journal in the registry.

**Spec handed to Sushant** (no code written this session — this is an engine + schema change):

```ts
et_al_threshold: z.union([
  z.number().int(),                                     // "list up to N, then et al."
  z.literal('all'),                                     // explicit all-authors rule
  z.object({ list_up_to: z.number().int(),              // two-tier: ≤ list_up_to → list all
             then_first: z.number().int() }),           //           > list_up_to → first then_first + et al.
]).nullable()
```

- `asian-spine-journal` → `{ list_up_to: 6, then_first: 3 }` (guide-quoted, ready to apply).
- `STYLE_DEFAULT_ET_AL.ama` → `{ list_up_to: 6, then_first: 3 }` (AMA 11th §3.7).
- NLM / Vancouver defaults unchanged at `6`.
- `analyze.ts` must not raise an action-required flag off the object form — same rule as today:
  the flag fires only on `'all'`.

Until that ships, `asian-spine-journal` stays at `6` (the nearer of the two representable options)
with the gap documented in its own `encoding_notes`.

---

## 3. Finder metadata backfill — `lib/finder/journalMeta.ts`

| field | before | after |
|---|---:|---:|
| `review_speed` populated | 2 / 75 | **17 / 75** |
| `oa_model` null | 9 | **7** |
| `apc_usd` wrong | 1 | **0** |

### 3.1 One real defect corrected

`biology-of-sport.apc_usd` was **`0`** — the Finder was telling authors a paid journal was free.
The journal's own author page states: *"The APC is 1000 EUR (4800 PLN or 1200 USD) per accepted
article."* Corrected to **1200**. A `0` is worse than a `null` here: null renders "—" and the author
goes and checks; `0` renders "free" and the author doesn't.

### 3.2 `review_speed` rows added (15)

All quoted in the publisher's own metric name. Springer rows are the publisher-reported
`Submission to first decision (median)`.

`acta-orthopaedica` (desk rejections 1–2 days; ~2 months to peer-reviewed rejection; ~5 months to
acceptance) · `aots` 7d · `arthroplasty` 12d · `bjsm` 20d · `calcified-tissue-international` 5d ·
`crmm` 3d · `ejap` 6d · `european-spine-journal` 10d · `international-orthopaedics` 12d · `josr` 4d ·
`journal-of-orthopaedics-and-traumatology` 19d · `ksrr` 5d · `skeletal-muscle` 9d ·
`sports-medicine` 31d · `sports-medicine-open` 36d.

`oa_model` also filled for `bjsm` ("Subscription; with hybrid open access option" → `hybrid`) and
`sports-medicine` (`hybrid`).

### 3.3 Two doctrine decisions, made and written into the file header

**Currency — do not convert.** `apc_usd` is populated only when the journal itself states a USD
figure. We do not convert GBP/EUR/PLN. A converted number is a value no source ever published and it
goes stale silently as the rate moves — precisely what verified-or-null exists to prevent. Journals
pricing only in another currency keep `apc_usd: null`, and I have specced `apc_amount` +
`apc_currency` to Sushant so they can carry their real, cited price. (`biology-of-sport` is the
clean case: 1200 is *the journal's own* USD figure, so it is recorded, not derived.)

**`review_speed` stays free text, and keeps the metric's name.** "Submission to first decision
(median): 12 days", never a bare "12 days". Publishers measure different things — first decision vs.
acceptance; medians that include desk rejections vs. ones that don't. Normalising to a number would
invent a comparability the sources do not support, and would make a 3-day desk-triage median look
like it beats a 20-day full-review median.

### 3.4 The blocked rows are blocked by design, not by oversight

`jbjs`, `jbjs-reviews`, `ajsm`, `arthroscopy`, `jot`, `injury`, `jses`, `the-spine-journal`,
`journal-of-arthroplasty`, `osteoarthritis-cartilage`, `jshs`, `jcsm`, `kssta`, `spine`, `jhs`,
`corr`, `jaaos`, `physical-therapy-in-sport`, `science-medicine-football` all sit behind Elsevier,
Sage HTML, Wolters Kluwer, Wiley or T&F. Their nulls are honest and stay.

---

## 4. Pre-announcement accuracy audit

**Method.** For each journal reachable this session, the cells an author actually acts on — word
limits, abstract structure and cap, reference style and et-al rule, figure/table caps, article types
accepted, line spacing — were compared against the journal's **own** live Guide for Authors. A cell
counts as *confirmed* only where the guide states the value; cells the guide is silent on are
reported separately as *unverified*, never scored as correct.

**Sample: 10 journals.** `oscrsj` · `acta-orthopaedica` · `asian-spine-journal` · `biology-of-sport` ·
`journal-of-bone-metabolism` · `jssm` · `tamd` · `european-spine-journal` · `josr` · `sports-medicine`.

| journal | cells confirmed | confirmed wrong | unverified |
|---|---:|---:|---:|
| `journal-of-bone-metabolism` | 9 | 0 | 0 |
| `european-spine-journal` | 10 | 0 | 1 |
| `biology-of-sport` | 8 | 0 | 0 |
| `tamd` | 7 | 0 | 1 |
| `asian-spine-journal` | 7 | **1** | 1 |
| `jssm` | 6 | 0 | 1 |
| `acta-orthopaedica` | 5 | 0 | 1 |
| `sports-medicine` | 4 | 0 | 0 |
| `josr` | 3 | 0 | 1 |
| `oscrsj` | 9 | **2** | 0 |
| **total** | **68** | **3** | **6** |

### **Accuracy: 95.8% (68 of 71 decidable cells), across 10 journals, 3 named misses.**

### 4.1 The three misses, named

1. **`asian-spine-journal` — `et_al_threshold`.** Two-tier rule flattened to a single N. A 7+-author
   reference formats as 6 + et al. where the journal wants 3 + et al. Root cause is the schema gap
   in §2.1, not encoder error. *Author-visible.*
2. **`oscrsj` — "Images in Orthopedics" is missing from `article_types`.** Our own
   `/guide-for-authors` lists seven article types; the rule file carries six. Consequence: an author
   who selects Images in Orthopedics is told **our own journal does not accept it** — and since
   Session 97 shipped a server-side eligibility gate on `article_types`, that is now a hard 400, not
   a cosmetic gap. *Worst single defect in the sample, because it is on us.*
3. **`oscrsj` — `abstract.sections` is case-report-specific and applied journal-wide.** Every
   OSCRSJ-targeted manuscript is told to structure its abstract as
   Introduction / Case Presentation / Discussion / Conclusion, including narrative reviews and
   systematic reviews. The schema carries one abstract block per journal, so this is structural —
   but it produces a wrong instruction on four of our six types.

### 4.2 Six cells flagged unverified (neither confirmed nor refuted — do not "tidy" these either)

`acta-orthopaedica` review/SR `references_max: 40` (the guide says "limit… to 25. Exceptions may be
for meta-analyses or review articles" without quantifying the exception) · `asian-spine-journal`
`case_report` row (type present, all limits null, type not listed in the section of the guide
reached) · `jssm` `letter` references 5–8 · `tamd` `case_series` row · `josr` `et_al_threshold: 6` ·
`european-spine-journal` `case_report` figure/table caps (guide states "5 Images/drawings, 2
figures/tables" — genuinely ambiguous phrasing; left null rather than guessed).

### 4.3 One improvement made during the audit

`sports-medicine.word_limits` was `{}` with the encoder's own note: *"Word limits NOT
primary-verified and set null… Verify against the live guide before enforcing."* The live guide was
reached this session, so that instruction was discharged: Review 8000, Systematic Review 10,000,
Letter 1000, abstract 250 (guide notes SRs and original research may extend to 450), Original
Research states no limit → left null, and figures/tables/references left null because the guide
states *"There is no limit on the number of tables, figures or references."* Quoted in the file.

### 4.4 What this rate does and does not license

It says: on the journals we can reach, the encoding is good, the failure mode is *schema
expressiveness*, not carelessness, and the encoders' own notes are trustworthy — twice this session
a note correctly told me a value was unverified.

It does **not** discharge the pre-launch gate. **JBJS and AJSM remain unaudited**, both were encoded
from archived sources, and AJSM is exactly the AMA-style journal affected by §2.1. The two journals
the gate named are the two the sample could not include.

---

## 5. Verdict on the announcement gate (data side)

**Not yet — one 15-minute fix short.**

- The two `oscrsj` misses in §4.1 must be fixed before we announce. Getting *our own journal* wrong
  in a tool that advertises 75 journals is the one error a reader will actually find and screenshot,
  and one of them is now a hard 400 on a type our own guide offers.
- `biology-of-sport`'s APC is fixed; that class of defect (a wrong number rather than a blank) is the
  one that draws publisher complaints, and it justifies one more sweep of non-null `apc_usd` values
  before launch.
- The `asian-spine-journal` / AMA et-al gap is a real formatting error but a *defensible* one — it
  is documented, bounded, and the fix is specced. It does not have to block an announcement; it
  does have to be on a dated queue before AJSM traffic arrives.
- Everything Elsevier / Sage / LWW / Wiley / T&F stays null and honest. Nulls are not a launch
  blocker. Wrong values are.

Compliance and positioning judgement on announcing at all is in the vault note:
`02 - OSCRSJ/Notes/Compliance & Indexing/2026-07-25 Submission Studio Data Audit & Announcement Readiness (Janine).md`.

---

## 5b. Low-confidence re-encodes — 2 of 9 cleared, and the flag was partly wrong

`manifest.low_confidence_reencode` listed nine journals whose live guides were "fully bot-blocked"
at encoding time, leaving journal-specific caps null. **Two of the nine were never actually blocked.**
`calcified-tissue-international` and `ejap` are Springer titles, and Springer journal pages open
cleanly — the same route that yielded fifteen `review_speed` values in §3. Both are now re-encoded
from their **primary** guides (commit `2d0c627`):

- **`calcified-tissue-international`** — Original Articles 5,000 words / 45 refs; Reviews 10,000
  words / 100 refs / 10 figures (a figures-*only* cap, so exact); Letters 500; Editorials 1,000;
  abstract 250. Combined figure+table caps left null (no schema slot). "Reports" and "Perspectives"
  omitted for lack of an enum slot. **Case reports are not an accepted type.**
- **`ejap`** — Invited Reviews 4,000 words; Letters 1,000; structured abstract
  Purpose / Methods / Results / Conclusion at 250. Original Articles and Editorials state no limit →
  null. "Comments" and "Perspectives" omitted. **Case reports confirmed not accepted**, which the
  existing `article_types` already had right.

**One deliberate non-change worth reading before anyone "fixes" it.**
`calcified-tissue-international.et_al_threshold` stays **null** even though the guide names a number:

> *"the names of all authors should be provided. For references with **more than 7 authors** the usage
> of 'et al' after the first 7 authors have been named will **also be accepted**."*

That 7 is a **permission, not an instruction** — the primary instruction is to provide all authors.
Encoding 7 would truncate reference lists the journal actually prefers in full. The style is
`custom`, so null renders every author: it satisfies the stated preference and never flags an author
who used et al. Same family as `aots` / `european-spine-journal` / `kssta` in Session 98. Noted in
the file so it survives the next reader.

**Remaining 7, re-confirmed unreachable this session** (WebFetch *and* a logged-in browser):
`global-spine-journal` · `science-medicine-football` · `ejss` · `journal-of-sports-sciences` ·
`bmjosem` · `jeo` · `jor-spine`.

**Lesson: check the publisher per journal, not per estate.** The low-confidence flag was applied
wholesale during a session where the dominant publishers were blocked, and two titles inherited it
without being blocked themselves. Worth a pass over any other flag set the same way.

---

## 6. Verification run this session

- `npx tsc --noEmit -p tsconfig.json` → **exit 0** (after every edit).
- All **75** journal JSON files parse; structural diff confirms **only `encoding_notes` changed** in
  the five files noted, plus the intended `word_limits` / `abstract.max_words` change on
  `sports-medicine`.
- `npm run validate:rules` and `npm test` **could not run.** `node_modules` carries
  `@esbuild/darwin-arm64` against a linux-arm64 execution environment — the same platform mismatch
  already logged in CLAUDE.md §11 from Session 96. Both must be run on the Mac before push. I did
  not run them and am not claiming they pass.
