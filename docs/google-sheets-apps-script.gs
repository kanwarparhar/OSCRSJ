/**
 * OSCRSJ — Google Sheets Webhook (Apps Script)
 * ============================================================
 * Receives POST requests from lib/integrations/googleSheets.ts
 * and appends rows to the bound Google Sheet.
 *
 * Deploy:
 *   1. Open your Sheet → Extensions → Apps Script.
 *   2. Replace the default Code.gs with this entire file.
 *   3. File → Project properties → Script properties → add:
 *        Key:   SHARED_SECRET
 *        Value: <a long random string — paste the SAME value
 *               into Vercel as GOOGLE_SHEETS_WEBHOOK_SECRET>
 *   4. Deploy → New deployment → Type: Web app.
 *        Description: OSCRSJ form webhook
 *        Execute as:  Me (your account)
 *        Who has access: Anyone
 *   5. Authorize the script (you'll be prompted on first deploy).
 *   6. Copy the resulting Web App URL — paste into Vercel as
 *      GOOGLE_SHEETS_WEBHOOK_URL.
 *
 * If you ever rotate the secret, update BOTH Script properties
 * AND Vercel env. If you re-deploy a new version, the URL stays
 * the same (Apps Script preserves URLs across deployments of
 * the same project).
 * ============================================================
 */

// Column header rows by sheet tab. The order MUST match the
// order in which lib/scholars/actions.ts builds the `row` array.
const HEADERS = {
  'Scholars Applications': [
    'Submitted At (UTC)',
    'Application ID',
    'First Name',
    'Last Name',
    'Email',
    'Country',
    'School',
    'Year',
    'Track',
    'Tier',
    'Personal Statement',
    'Research Experience',
    'CV Filename',
    'CV Download Link (1-year)',
    'Admin Detail URL',
    'Participant Agreement Ack',
  ],
  // Journal Formatter (/format) — one row per formatting job.
  // Order MUST match app/api/format/jobs/route.ts.
  'Formatter Submissions': [
    'Submitted At (UTC)',
    'Job ID',
    'Email',
    'Original Filename',
    'Target Journal',
    'Article Type',
    'Figures',
    'IP',
    'Marketing Consent',
    'Consent Version',
    'Consent Scope',
  ],
  // Journal Finder (/format #finder) — one row per match query. Stateless: no
  // email is collected. Order MUST match app/api/finder/match/route.ts.
  'Finder Submissions': [
    'Submitted At (UTC)',
    'Article Type',
    'Word Count',
    'Subspecialty',
    'Top Result',
    'Bucket Summary',
    'IP',
  ],
  // NO SURVEY TAB HERE, DELIBERATELY. 'Studio Survey Responses' was declared in
  // this map for part of 2026-07-26 and was removed the same day. Kanwar
  // directive: survey data and its analytics live in the SAME spreadsheet as
  // the Admin Manuscript Hub, which is pull-based. docs/admin-manuscript-hub.gs
  // reads studio_survey_responses from Supabase directly and writes both
  // 'Studio Survey Responses' and 'Studio Survey Analytics' into that workbook.
  //
  // Nothing in the app posts survey rows to this script. Re-adding a header
  // here would not merely be dead config: it would invite someone to point the
  // submit path at this webhook and create a second, diverging copy of the
  // responses in the wrong workbook, which is worse than having none. If you
  // want to change the survey columns, the only mirror of surveySheetHeaders()
  // that still exists is SURVEY_FIXED_HEADERS + SURVEY_QUESTIONS in
  // docs/admin-manuscript-hub.gs.
  // ---------------------------------------------------------------------
  // SUPERSEDED (2026-07-26). The two tabs below have NO writer in this
  // webhook and never did: nothing in the app posts to them. The live
  // versions of both are PULL-based and are built by
  // docs/admin-manuscript-hub.gs, which reads Supabase directly on an
  // hourly trigger and writes them into the "OSCRSJ - Admin Manuscript Hub"
  // spreadsheet, not into this one.
  //
  // They are kept rather than deleted for two reasons. First, UPSERT_BY_KEY
  // below still names 'Studio Daily Metrics', and the deployed webhook's
  // replace/upsert paths read HEADERS[sheetName] for the tab width -- so if
  // the push path is ever revived (a backfill, a one-off export), these
  // definitions are what make it land correctly instead of guessing the
  // width from the first row. Second, they document the column contract the
  // Hub script's STUDIO_DAILY_HEADERS / STUDIO_MARKETING_HEADERS still
  // follow, so the two sheets stay comparable.
  //
  // Do NOT add writers for these here. Change the Hub script instead, and
  // mirror the change down here if you want the two to keep matching.
  // ---------------------------------------------------------------------
  // One row per LOCAL day (America/Los_Angeles). Order matches
  // STUDIO_DAILY_HEADERS in docs/admin-manuscript-hub.gs.
  // (An earlier version of this comment pointed at a metricsRow() helper in
  // app/api/cron/studio-daily/route.ts. No such function exists -- the cron
  // writes its snapshot to the studio_daily_metrics TABLE and the Hub script
  // renders it. The reference is removed rather than corrected because there
  // is nothing on the push side left to point at.)
  // Re-posting a day OVERWRITES that day's row (see UPSERT_BY_KEY below)
  // rather than appending a duplicate.
  'Studio Daily Metrics': [
    'Date',
    'Jobs Started',
    'Completed',
    'Failed',
    'Still Running',
    'Completion Rate %',
    'Median Run (s)',
    'Finder Queries',
    'Unique Users',
    'New Users',
    'Returning Users',
    'Top Journal',
    'Top Journal Jobs',
    'Distinct Journals',
    'Top Article Type',
    'Figures Uploaded',
    'Top Failure Reason',
    'DeepSeek Tokens',
    'Est Cost (USD)',
    'Actual Spend (USD)',
    'Cost / Completed Job (USD)',
    'DeepSeek Balance (USD)',
    'Est Spend To Date (USD)',
    'Jobs To Date',
    'Completed To Date',
    'Marketing List Size',
    'Generated At (UTC)',
  ],
  // SUPERSEDED, see the block above. Deduplicated marketing list, rebuilt from
  // the database on every Hub refresh (the Hub script's
  // writeStudioMarketingSheet_). Order matches STUDIO_MARKETING_HEADERS in
  // docs/admin-manuscript-hub.gs. Do not hand-edit either copy: the Hub's is
  // overwritten hourly. Unsubscribes belong in your email tool, not here.
  'Studio Marketing List': [
    'Email',
    'First Seen (UTC)',
    'Last Seen (UTC)',
    'Jobs',
    'Journals Formatted For',
    'Last Article Type',
    'Consent Version',
    'Consent Scope',
    'Source',
  ],
}

// Tabs whose first column is a unique key: a posted row with a key already
// present overwrites that row instead of appending a second one. Keeps the
// daily-metrics tab honest when the morning job is re-run or backfilled.
//
// 'Studio Daily Metrics' is SUPERSEDED (see HEADERS above) and has no writer
// today, so this list is currently inert. It stays because the entry costs
// nothing and because deleting it is how a revived backfill quietly starts
// appending one duplicate row per re-run.
const UPSERT_BY_KEY = ['Studio Daily Metrics']

function doPost(e) {
  try {
    // ---- Parse body ----
    if (!e || !e.postData || !e.postData.contents) {
      return jsonResponse(400, { ok: false, error: 'no_body' })
    }
    let payload
    try {
      payload = JSON.parse(e.postData.contents)
    } catch (err) {
      return jsonResponse(400, { ok: false, error: 'invalid_json' })
    }

    // ---- Auth: validate shared secret (carried in body) ----
    // Apps Script "Anyone" web apps cannot read custom HTTP
    // headers, so the OSCRSJ client posts the secret inside the
    // JSON body. Validate before doing anything else.
    const expectedSecret =
      PropertiesService.getScriptProperties().getProperty('SHARED_SECRET')
    if (!expectedSecret) {
      return jsonResponse(500, { ok: false, error: 'server_misconfigured' })
    }
    if (payload.secret !== expectedSecret) {
      return jsonResponse(401, { ok: false, error: 'unauthorized' })
    }

    const sheetName = payload.sheetName
    const mode = payload.mode === 'replace' ? 'replace' : 'append'
    const row = payload.row
    const rows = payload.rows
    if (!sheetName) {
      return jsonResponse(400, { ok: false, error: 'bad_shape' })
    }
    if (mode === 'append' && !Array.isArray(row)) {
      return jsonResponse(400, { ok: false, error: 'bad_shape' })
    }
    if (mode === 'replace' && !Array.isArray(rows)) {
      return jsonResponse(400, { ok: false, error: 'bad_shape' })
    }

    // ---- Resolve / create sheet tab ----
    const ss = SpreadsheetApp.getActiveSpreadsheet()
    let sheet = ss.getSheetByName(sheetName)
    if (!sheet) {
      sheet = ss.insertSheet(sheetName)
      const headers = HEADERS[sheetName]
      if (headers && headers.length) {
        sheet
          .getRange(1, 1, 1, headers.length)
          .setValues([headers])
          .setFontWeight('bold')
        sheet.setFrozenRows(1)
      }
    }

    // ---- Replace mode: overwrite the whole body, keep the header ----
    // Used for derived tabs (the marketing list) that must be deduplicated. An
    // append-only log cannot dedupe an address that formatted three
    // manuscripts, so the server rebuilds the list and posts it whole.
    if (mode === 'replace') {
      var headerCount = (HEADERS[sheetName] || []).length
      var width = headerCount || (rows.length ? rows[0].length : 1)
      var lastRow = sheet.getLastRow()
      if (lastRow > 1) {
        sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).clearContent()
      }
      if (rows.length) {
        var normalized = rows.map(function (r) {
          var out = r.slice(0, width)
          while (out.length < width) out.push('')
          return out
        })
        sheet.getRange(2, 1, normalized.length, width).setValues(normalized)
      }
      return jsonResponse(200, { ok: true, mode: 'replace', rows: rows.length })
    }

    // ---- Append mode ----
    // Upsert tabs: if column A already holds this row's key, overwrite in place.
    if (UPSERT_BY_KEY.indexOf(sheetName) !== -1 && row.length) {
      var key = String(row[0])
      var lastRowU = sheet.getLastRow()
      if (lastRowU > 1) {
        var keys = sheet.getRange(2, 1, lastRowU - 1, 1).getDisplayValues()
        for (var i = 0; i < keys.length; i++) {
          if (String(keys[i][0]) === key) {
            sheet.getRange(i + 2, 1, 1, row.length).setValues([row])
            return jsonResponse(200, { ok: true, mode: 'upsert', replacedRow: i + 2 })
          }
        }
      }
    }

    sheet.appendRow(row)

    return jsonResponse(200, { ok: true })
  } catch (err) {
    return jsonResponse(500, {
      ok: false,
      error: 'unhandled',
      message: String(err && err.message ? err.message : err),
    })
  }
}

function doGet() {
  // Apps Script "Anyone" web apps need a GET handler so the URL
  // returns something sensible when pasted into a browser by
  // mistake. Don't leak the secret or any sheet state.
  return jsonResponse(200, {
    ok: true,
    service: 'oscrsj-sheets-webhook',
    method: 'POST',
  })
}

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------

function jsonResponse(status, body) {
  // Apps Script's ContentService doesn't expose HTTP status
  // codes; the body itself carries `ok: true/false`. The
  // `status` arg is kept for readability + future migration.
  return ContentService.createTextOutput(JSON.stringify(body)).setMimeType(
    ContentService.MimeType.JSON
  )
}

