# Journal rules files

One `<slug>.json` per journal. Every file validates against
`lib/formatting/rulesSchema.ts` (`journalRulesSchema`). Run the gate with:

```bash
npm run validate:rules
```

## Doctrine (from the build brief)

- **Live pages only.** Rules are encoded from each journal's live
  Guide-for-Authors page at `identity.guidelines_url`. Training-data knowledge
  of a journal's requirements is **not** a valid source — assume it is stale.
- **Structured data only.** We encode values (font, margins, word caps, section
  order …), never copy guideline prose. Guidelines are copyrighted.
- **Unknown ⇒ `null`, never guessed.** A field the guide does not specify is
  `null` so the engine flags it for the author instead of fabricating a default.
- Each file records `identity.guidelines_url`, `identity.verified_date`
  (ISO date the page was fetched + encoded), and `identity.source_hash`.

## `source_hash` — reproducible fetch + normalize + hash

`source_hash` is the SHA-256 (hex) of the **normalized** fetched guide text.
The Session C monthly freshness cron re-runs the identical recipe and diffs the
hash to detect when a journal has changed its guidelines. Normalization must
stay byte-identical to this recipe:

1. `curl -sL --compressed` the `guidelines_url` (UA:
   `Mozilla/5.0 (OSCRSJ-guidelines-checker)`).
2. Remove `<script>…</script>` and `<style>…</style>` blocks (case-insensitive,
   dotall).
3. Strip all remaining tags (`<[^>]+>` → single space).
4. HTML-unescape entities.
5. Collapse all whitespace runs to a single space, `strip()`, `lower()`.
6. `shasum -a 256` of the result.

Reference one-liner:

```bash
curl -sL --compressed -A "Mozilla/5.0 (OSCRSJ-guidelines-checker)" "$URL" \
  | python3 -c "import sys,re,html; t=sys.stdin.read(); \
t=re.sub(r'(?is)<script.*?</script>',' ',t); \
t=re.sub(r'(?is)<style.*?</style>',' ',t); \
t=re.sub(r'(?s)<[^>]+>',' ',t); t=html.unescape(t); \
t=re.sub(r'\s+',' ',t).strip().lower(); sys.stdout.write(t)" \
  | shasum -a 256
```

**JS-rendered guides:** some publisher guides are client-rendered SPAs where
`curl` returns only a shell. Where that happened the rules were extracted from
the rendered page and `identity.source_note` records that the hash is of the
shell (still change-detecting, but coarser). Session C's cron will upgrade
these to a headless fetch.
