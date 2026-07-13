# Top-100 formatting-expansion — future-expansion guide (75 → 100)

**FINAL state (2026-07-12):** 75 journals encoded + committed (waves 1–5, ranks 1–75) +
all scale infra. **Kanwar stopped the expansion at 75** ("that is plenty") — 75 is the
shipped registry. The remaining 25 (ranks 77–103) are **deferred, not excluded**; this
guide is how to reach 100 if it's pursued later. The manifest marks these rows `deferred`;
everything is committed and the manifest is the single source of truth.

## Pending journals (25) — publisher hints

Wave 6 (ranks 77–91): `foot-and-ankle-surgery` (Elsevier, EFAS — distinct from fai.json),
`clinics-shoulder-elbow` (Korean OA, cisejournal.org/e-cise), `patient-safety-surgery`
(BMC), `sports` (MDPI — Akamai-blocked, headless/wayback), `oac-open` (Elsevier),
`cios` (Korean OA, ecios.org), `the-knee` (Elsevier), `bmc-musculoskeletal-disorders`
(BMC — curls CLEAN via WebFetch), `research-in-sports-medicine` (T&F gspm20 — likely
hard-blocked), `smhs` (Elsevier/KeAi), `arthroplasty-today` (Elsevier/AAHKS), `jpah`
(Human Kinetics — ≤12mo Wayback works), `physician-sportsmedicine` (T&F ipsm20 — likely
hard-blocked, LOW-confidence expected).

Wave 7 (ranks 92–103): `gait-and-posture` (Elsevier), `current-trauma-reports` (Springer),
`sports-biomechanics` (T&F rbsp20), `jses-international` (Elsevier, OA — distinct from
jses.json), `jor` (Journal of Orthopaedic Research — Wiley), `fsal` (Frontiers in Sports
and Active Living — Frontiers, curls clean), `orr` (Orthopedic Research and Reviews — Dove
Press OA), `bone-reports` (Elsevier, OA), `ijss` (International Journal of Spine Surgery —
self-hosted/SAGE), `jbmm` (Journal of Bone and Mineral Metabolism — Springer, BACKFILL),
`jdrs` (Joint Diseases and Related Surgery — Turkish OA, BACKFILL), `orthopaedic-surgery`
(Wiley, Chinese Orthopaedic Association, BACKFILL).

The 3 backfills (jbmm/jdrs/orthopaedic-surgery) replace the 3 off-product exclusion slots
to keep the registry at 100 total.

## Resumption pipeline (per wave)

Reusable tooling lives in the session scratchpad
(`.../scratchpad/`): `subagent-prompt.md` (research contract), `finalize_journal.py`
(curl→reproducible hash + schema-required coercion), `update_manifest.py`,
`make_audit_sample.py`, `ghash.sh`. If resuming in a fresh session, re-create them from
the patterns documented here + in the wave commits.

1. **Research** — one general-purpose subagent per journal; prompt = "read scratchpad/
   subagent-prompt.md + this journal's name/slug/rank/publisher-hint + draft path". They
   write `scratchpad/drafts/<slug>.json` and return a compact evidence report. Subagents
   have WebFetch/WebSearch + the **Apify rag-web-browser** headless tool (clears most
   publisher bot-blocks — the key to Elsevier/SAGE/Wiley/Springer). They CANNOT reach
   Wayback directly (fetch-tool limitation) but can headless-render Wayback snapshots.
2. **Finalize** — `python3 scratchpad/finalize_journal.py <slugs...>` computes each
   `source_hash` (curl live → clean = Tier A; blocked → ≤12mo Wayback via CDX, else the
   live shell) and coerces schema-required enums the subagents left null (with transparent
   `[schema-required default]` encoding_notes). NB: main-session curl reaches many
   link.springer.com / boneandjoint.org.uk / edmgr.ovid.com / Korean-OA / Frontiers pages
   that block the subagents' headless path — so the finalizer often gets a better (real,
   reproducible) hash than the subagent's source.
3. `npm run validate:rules` → fix any schema failures (add coercions to finalize_journal.py
   if a new null-in-required-enum class appears).
4. `python3 scratchpad/update_manifest.py <slugs...>` (status→encoded, tier, url, note).
5. `npx tsx scripts/gen-journal-list.ts` (regenerates registry-meta.ts + journalList.ts).
6. `npx tsc --noEmit -p tsconfig.json` (0) + `npm test` (61 pass + 1 live-gated).
7. Commit by explicit path: `feat(format): journal rules wave N — <slugs>`. **Do not push**
   (launch gate governs deploy).

## After the final wave (100 encoded)

- `python3 scratchpad/make_audit_sample.py` — regenerate the Janine audit sample.
- Re-run the 5-journal self-spot-check on 5 of the newly-added journals.
- Update `manifest.progress` + finish the CLAUDE.md M1–M4 wrap-up + push the Janine audit
  handoff.

## Known low-confidence re-encodes

See `manifest.low_confidence_reencode` — 9 Tier-B journals whose live guide was fully
bot-blocked with no ≤12mo archive (T&F, hard-Cloudflare Wiley/Springer/SAGE). Encoded from
house-style/templates with journal-specific caps null. Re-encode when reachable; all are on
Janine's audit list. Watch for the Elsevier/Springer→**Wiley/ESSKA** migration pattern
(kssta, jeo, ejss, asmr already confirmed) on the remaining Wiley-family journals (jor).
