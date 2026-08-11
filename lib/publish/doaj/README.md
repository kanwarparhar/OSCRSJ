# DOAJ deposit — deferred stub

DOAJ accepts article metadata as **Crossref-format XML uploads**, so the
assembly work is already done: `lib/publish/crossref/depositInput.ts`
(`buildDepositInput`) produces a complete, database-sourced record, and only
the serializer differs.

**Blocked on two things, in order:**

1. **ISSN.** DOAJ will not accept an application without one. LOC application
   `APPL0007345` was filed 2026-07-25 (2–8 week assignment window).
2. **Volume.** DOAJ expects a journal with a real publication record —
   the working threshold in the Credibility & Indexing Roadmap is 10 articles
   or 12 months, whichever comes first.

When it unblocks: add `lib/publish/doaj/doajXml.ts` consuming the same
`DepositInput`, and reuse `crossref_deposits`' state-machine shape rather than
inventing a second one — the asynchronous submit-then-confirm problem is
identical, and a silent rejection is just as damaging.

Do **not** build this before the ISSN lands. A DOAJ application rejected for
an incomplete record carries a re-application waiting period.
