// Journal rules schema — single source of truth for the Manuscript Formatting
// Service (Sushant, Session 87, 2026-07-08). Every journal in
// `lib/formatting/journals/*.json` validates against `journalRulesSchema`.
//
// DOCTRINE (from the build brief + OSCRSJ AI Layer operating doctrine):
//   - Every rule field an engine transform reads MUST exist in this schema.
//     There is NO hardcoded per-journal behaviour anywhere in engine code —
//     the engine reads only from a validated JournalRules object.
//   - Rules are encoded from LIVE Guide-for-Authors pages only (training-data
//     knowledge of a journal's requirements is NOT a valid source). Each file
//     records `guidelines_url` + `verified_date` + `source_hash` so staleness
//     is visible and the monthly freshness cron (Session C) can diff against
//     the live page.
//   - Structured data only — never copy guideline prose (copyright).
//   - Fields the journal does not specify are `null`, never guessed. A null
//     value means "the engine flags this for the author" rather than
//     "the engine fabricates a default".
//
// zod v4 note: `z.record(key, value)` takes two args; `.url()`/`.datetime()`
// string refinements are deprecated in v4, so URLs and dates are validated
// with version-proof `.regex()` here.

import { z } from 'zod'

/** Bump when the schema shape changes in a way that requires re-encoding. */
export const SCHEMA_VERSION = '1.0.0'

// ---------------------------------------------------------------------------
// Shared enums (exported as const arrays so engine + report code can reuse
// them without re-declaring the allowed values).
// ---------------------------------------------------------------------------

/** Manuscript article types the service understands. */
export const ARTICLE_TYPES = [
  'case_report',
  'case_series',
  'original_research',
  'review',
  'systematic_review',
  'narrative_review',
  'technical_note',
  'letter',
  'editorial',
] as const
export type ArticleType = (typeof ARTICLE_TYPES)[number]

/** Ordered title-page element identifiers. `elements` is an ordered subset. */
export const TITLE_PAGE_ELEMENTS = [
  'article_title',
  'running_title',
  'article_type',
  'authors',
  'affiliations',
  'corresponding_author',
  'orcid',
  'abstract',
  'keywords',
  'word_count_abstract',
  'word_count_manuscript',
  'figure_count',
  'table_count',
  'funding',
  'disclosures',
  'acknowledgments',
  'ethics_statement',
  'data_availability',
  'highlights',
  'date',
] as const
export type TitlePageElement = (typeof TITLE_PAGE_ELEMENTS)[number]

/** Back-matter declaration identifiers, in the order the journal wants them. */
export const DECLARATION_ELEMENTS = [
  'acknowledgments',
  'author_contributions',
  'funding',
  'conflict_of_interest',
  'ethics_approval',
  'patient_consent',
  'data_availability',
  'trial_registration',
] as const
export type DeclarationElement = (typeof DECLARATION_ELEMENTS)[number]

const isArticleTypeKey = (obj: Record<string, unknown>) =>
  Object.keys(obj).every((k) => (ARTICLE_TYPES as readonly string[]).includes(k))

// ---------------------------------------------------------------------------
// Leaf schemas
// ---------------------------------------------------------------------------

const fontSchema = z
  .object({
    // Both nullable: a guide often pins size/spacing but leaves the body font
    // to the author ("any legible serif"). Null = not specified → engine keeps
    // the author's font rather than fabricating one (unknown-⇒-null doctrine).
    family: z.string().nullable(), // e.g. "Times New Roman"
    size_pt: z.number().nullable(), // e.g. 12
  })
  .strict()

const marginsSchema = z
  .object({
    top_mm: z.number(),
    bottom_mm: z.number(),
    left_mm: z.number(),
    right_mm: z.number(),
  })
  .strict()

/** One heading level's case + emphasis rules (catalog A: heading hierarchy). */
const headingLevelSchema = z
  .object({
    level: z.number().int(), // 1 = top-level section heading
    case: z.enum(['title', 'sentence', 'upper', 'lower', 'as_is']),
    bold: z.boolean(),
    italic: z.boolean(),
    numbered: z.boolean(),
  })
  .strict()

const identitySchema = z
  .object({
    name: z.string(),
    slug: z.string(), // matches the json filename, e.g. "jbjs"
    issn: z.string().nullable(),
    publisher: z.string().nullable(),
    /** LIVE Guide-for-Authors URL the rules were encoded from. */
    guidelines_url: z.string().regex(/^https?:\/\/.+/, 'must be an http(s) URL'),
    /** ISO date (YYYY-MM-DD) the live page was fetched + encoded. */
    verified_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'must be YYYY-MM-DD'),
    /** SHA-256 (hex) of the normalized fetched guide text — see journals/README.md. */
    source_hash: z.string().regex(/^[a-f0-9]{64}$/, 'must be a 64-char sha256 hex'),
    /** Free-text note, e.g. "guide is a JS SPA; hash is of the rendered text". */
    source_note: z.string().nullable(),
    /** Submission platform, e.g. "Editorial Manager", "ScholarOne". */
    submission_system: z.string().nullable(),
  })
  .strict()

const blindingSchema = z
  .object({
    double_blind: z.boolean(),
    separate_title_page: z.boolean(),
    scrub_body_identifiers: z.boolean(),
    /** Strip docx core-properties author metadata on output. */
    scrub_metadata: z.boolean(),
  })
  .strict()

const layoutSchema = z
  .object({
    page_size: z.enum(['letter', 'a4']).nullable(),
    font: fontSchema,
    // Nullable: null = guide-silent → engine preserves the author's spacing
    // rather than re-spacing the whole document on a guess (unknown-⇒-null).
    line_spacing: z.enum(['single', '1.5', 'double']).nullable(),
    margins_mm: marginsSchema.nullable(),
    alignment: z.enum(['left', 'justified']).nullable(),
    /** true = first-line indent paragraphs; false = block paragraphs. */
    first_line_indent: z.boolean().nullable(),
    /**
     * ENCODING DOCTRINE (applies to every field that drives a REMOVAL or an
     * override, not just this one — see `alignment` and `line_spacing` above):
     *
     *   null    = the guide is SILENT. The engine preserves whatever the author
     *             already has. This is the correct value whenever a rule was
     *             defaulted, inferred, assumed, or simply not found.
     *   'none'  = the guide EXPLICITLY says no line numbers. Only then may the
     *             engine strip the author's line numbering. A note citing the
     *             guide statement is required alongside this value.
     *
     * This field was non-nullable until 2026-07-18, so encoders were forced to
     * write 'none' for "unspecified" and said so in 36 of 37 encoding_notes.
     * The engine read that as an instruction and stripped line numbers the
     * author had deliberately added (observed live on the Injury fixture).
     * Never re-default this field to 'none' to satisfy a type error.
     */
    line_numbers: z.enum(['none', 'continuous', 'per_page']).nullable(),
    page_numbers: z
      .object({
        show: z.boolean(),
        position: z
          .enum([
            'top-left',
            'top-center',
            'top-right',
            'bottom-left',
            'bottom-center',
            'bottom-right',
          ])
          .nullable(),
      })
      .strict(),
    /** Running head printed in the page header (distinct from the running-title text cap). */
    running_head: z
      .object({
        show: z.boolean(),
        position: z.enum(['top-left', 'top-center', 'top-right']).nullable(),
      })
      .strict(),
    /** Per-level heading case/emphasis; null = journal does not specify. */
    headings: z.array(headingLevelSchema).nullable(),
  })
  .strict()

const titlePageSchema = z
  .object({
    elements: z.array(z.enum(TITLE_PAGE_ELEMENTS)), // ordered
    running_title_max_chars: z.number().int().nullable(),
    title_max_chars: z.number().int().nullable(),
    title_max_words: z.number().int().nullable(),
    /** Whether academic degrees stay on the author line or are stripped. */
    authors_degrees: z.enum(['include', 'strip']).nullable(),
  })
  .strict()

const abstractSchema = z
  .object({
    structured: z.boolean(),
    /** Ordered structured-section labels for the journal's primary type; null if unstructured. */
    sections: z.array(z.string()).nullable(),
    max_words: z.number().int().nullable(),
    keywords: z
      .object({
        required: z.boolean(),
        min: z.number().int().nullable(),
        max: z.number().int().nullable(),
        case: z.enum(['title', 'sentence', 'lower', 'as_is']).nullable(),
        separator: z.enum(['comma', 'semicolon']).nullable(),
      })
      .strict(),
  })
  .strict()

/** article_type -> ordered list of required section headings. */
const sectionsSchema = z
  .record(z.string(), z.array(z.string()))
  .refine(isArticleTypeKey, { message: 'sections keys must be valid article_types' })

const wordLimitSchema = z
  .object({
    manuscript_max_words: z.number().int().nullable(),
    abstract_max_words: z.number().int().nullable(),
    references_min: z.number().int().nullable(),
    references_max: z.number().int().nullable(),
    figures_max: z.number().int().nullable(),
    tables_max: z.number().int().nullable(),
  })
  .strict()

/** article_type -> word/count limits. */
const wordLimitsSchema = z
  .record(z.string(), wordLimitSchema)
  .refine(isArticleTypeKey, { message: 'word_limits keys must be valid article_types' })

const referencesSchema = z
  .object({
    style: z.enum(['nlm', 'ama', 'vancouver', 'custom']),
    in_text: z.enum(['superscript', 'bracket', 'paren']),
    /** Marker position relative to sentence punctuation. */
    in_text_punctuation: z.enum(['before', 'after']).nullable(),
    order: z.enum(['cited', 'alphabetical']),
    journal_abbrev: z.enum(['nlm', 'full']),
    include_doi: z.boolean(),
    /**
     * Three states (2026-07-22 doctrine fix — silence is not an instruction):
     *   number N = the guide states "list up to N authors, then et al."
     *   'all'    = the guide EXPLICITLY requires every author (JBJS family).
     *   null     = the guide is silent; the engine falls back to the citation
     *              style's own default (see STYLE_DEFAULT_ET_AL in
     *              references/render.ts) and raises NO author-list flag.
     */
    et_al_threshold: z.union([z.number().int(), z.literal('all')]).nullable(),
    max_count: z.number().int().nullable(),
  })
  .strict()

const tablesSchema = z
  .object({
    placement: z.enum(['in_text', 'grouped_end', 'separate_section', 'separate_file']),
    caption_position: z.enum(['above', 'below']).nullable(),
    numbering: z.enum(['arabic', 'roman']).nullable(),
  })
  .strict()

const figuresSchema = z
  .object({
    separate_files: z.boolean(),
    formats: z.array(z.enum(['tif', 'tiff', 'jpg', 'jpeg', 'png', 'eps', 'pdf'])),
    min_dpi: z.number().int().nullable(),
    legends_location: z.enum(['in_text', 'figure_legends_section', 'separate_file']),
    callout_style: z.enum(['Figure', 'Fig.']).nullable(),
    /** Filename pattern token, e.g. "Figure{n}" -> Figure1.tif. */
    naming_pattern: z.string().nullable(),
  })
  .strict()

const declarationsSchema = z
  .object({
    order: z.array(z.enum(DECLARATION_ELEMENTS)), // ordered heading set
    required: z.array(z.enum(DECLARATION_ELEMENTS)).nullable(),
  })
  .strict()

const miscSchema = z
  .object({
    orcid_required: z.boolean(),
    cover_letter_required: z.boolean(),
    highlights_required: z.boolean().nullable(),
    title_case: z.enum(['title', 'sentence']).nullable(),
  })
  .strict()

// ---------------------------------------------------------------------------
// Top-level schema
// ---------------------------------------------------------------------------

export const journalRulesSchema = z
  .object({
    schema_version: z.literal(SCHEMA_VERSION),
    identity: identitySchema,
    /** Article types this journal accepts / that we have encoded. */
    article_types: z.array(z.enum(ARTICLE_TYPES)).min(1),
    blinding: blindingSchema,
    layout: layoutSchema,
    title_page: titlePageSchema,
    abstract: abstractSchema,
    sections: sectionsSchema,
    word_limits: wordLimitsSchema,
    references: referencesSchema,
    tables: tablesSchema,
    figures: figuresSchema,
    declarations: declarationsSchema,
    misc: miscSchema,
    /** Encoder notes: ambiguities, journal-specific caveats, dropped fields. */
    encoding_notes: z.array(z.string()).nullable(),
  })
  .strict()
  .superRefine((rules, ctx) => {
    // Coherence: every article_type used as a sections/word_limits key must be
    // declared in the top-level article_types list.
    const declared = new Set<string>(rules.article_types)
    for (const key of Object.keys(rules.sections)) {
      if (!declared.has(key)) {
        ctx.addIssue({
          code: 'custom',
          message: `sections has article_type "${key}" not listed in article_types`,
          path: ['sections', key],
        })
      }
    }
    for (const key of Object.keys(rules.word_limits)) {
      if (!declared.has(key)) {
        ctx.addIssue({
          code: 'custom',
          message: `word_limits has article_type "${key}" not listed in article_types`,
          path: ['word_limits', key],
        })
      }
    }
  })

/** A fully-validated set of journal formatting rules. */
export type JournalRules = z.infer<typeof journalRulesSchema>
