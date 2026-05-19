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
}

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
    const row = payload.row
    if (!sheetName || !Array.isArray(row)) {
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

    // ---- Append the row ----
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

