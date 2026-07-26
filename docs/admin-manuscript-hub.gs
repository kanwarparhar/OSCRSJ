/**
 * OSCRSJ — Admin Manuscript Hub
 * ---------------------------------------------------------------------------
 * A Google Apps Script bound to the "OSCRSJ — Admin Manuscript Hub" spreadsheet.
 * It PULLS every submitted manuscript straight from the Supabase database
 * (PostgREST) and Storage, so you never have to log into oscrsj.com to see the
 * pipeline. It also serves one-click ZIP downloads of every file an author
 * submitted, and refreshes itself on an hourly schedule.
 *
 * Two tabs are built automatically:
 *   • "Manuscript Hub" — one row per manuscript, color-coded by status
 *   • "Metrics"        — totals, rates, and breakdowns
 *
 * SETUP: follow admin-manuscript-hub-setup.md. You must set three Script
 * Properties (Project Settings → Script Properties) before it will run:
 *   SUPABASE_URL      https://uambcccuookmbciqpcvh.supabase.co
 *   SERVICE_ROLE_KEY  the LEGACY service_role JWT (starts eyJ...) — bypasses RLS,
 *                     keep private. NOT the new sb_secret_ key: Supabase blocks
 *                     those from Apps Script (see supaHeaders_ below).
 *   DOWNLOAD_TOKEN    any long random string of your choosing
 * ---------------------------------------------------------------------------
 */

// ============================ CONFIG =======================================

var HUB_SHEET       = 'Manuscript Hub';
var METRICS_SHEET   = 'Metrics';
// Submission Studio tabs (2026-07-25). These READ Supabase on the same hourly
// refresh as the manuscript tabs rather than waiting to be pushed a row by the
// morning cron -- the cron owns the daily snapshot and the email, this sheet
// owns presentation. That means the numbers are live between cron runs, and a
// cron outage shows up as a stale "Daily history" table rather than as a tab
// that silently stops updating.
var STUDIO_METRICS_SHEET   = 'Studio Daily Metrics';
var STUDIO_MARKETING_SHEET = 'Studio Marketing List';
var TEMP_FOLDER     = 'OSCRSJ Hub — temp downloads';
var STORAGE_BUCKET  = 'submissions';

// Light row-fill colors, tuned so black text stays readable.
var STATUS_COLORS = {
  submitted:          '#FFFFFF', // new — no highlight
  under_review:       '#FFF2CC', // yellow — sent to reviewers
  revision_requested: '#CFE2F3', // blue — back to author (round 2)
  revision_received:  '#D9D2E9', // purple — author submitted their revision
  accepted:           '#D9EAD3', // green
  awaiting_payment:   '#D9EAD3', // green
  in_production:      '#D9EAD3', // green
  published:          '#B6D7A8', // deeper green
  rejected:           '#F4CCCC', // red
  desk_rejected:      '#F4CCCC', // red
  withdrawn:          '#FCE5CD', // orange
  draft:              '#FFFFFF'
};

var STATUS_LABELS = {
  submitted:          'Submitted (new)',
  under_review:       'Under review',
  revision_requested: 'Revision requested',
  revision_received:  'Revision received',
  accepted:           'Accepted',
  awaiting_payment:   'Awaiting payment',
  in_production:      'In production',
  published:          'Published',
  rejected:           'Rejected',
  desk_rejected:      'Desk rejected',
  withdrawn:          'Withdrawn',
  draft:              'Draft'
};

var TYPE_LABELS = {
  case_report:        'Case Report',
  case_series:        'Case Series',
  review_article:     'Systematic Review & Meta-Analysis',
  narrative_review:   'Narrative Review',
  surgical_technique: 'Surgical Technique',
  letter_to_editor:   'Letter to Editor',
  editorial:          'Editorial'
};

var HEADERS = [
  'Submission ID', 'Title', 'Authors', 'Country', 'Study Type',
  'Date Submitted', 'Projected Review', 'Projected Decision',
  'Status', 'Files', 'Decision Date', 'Last Updated'
];

// ============================ MENU =========================================

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('OSCRSJ Hub')
    .addItem('Refresh now', 'refreshHub')
    .addSeparator()
    .addItem('Install hourly auto-refresh', 'installTrigger')
    .addItem('Test Supabase connection', 'testConnection')
    .addToUi();
}

function installTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'refreshHub') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('refreshHub').timeBased().everyHours(1).create();
  SpreadsheetApp.getUi().alert('Hourly auto-refresh installed. The hub will now update once an hour.');
}

function testConnection() {
  try {
    var r = supaGet_('/rest/v1/manuscripts?select=id&limit=1');
    SpreadsheetApp.getUi().alert('Connected to Supabase. The query returned ' + r.length + ' sample row(s).');
  } catch (e) {
    SpreadsheetApp.getUi().alert('Connection failed:\n\n' + e.message);
  }
}

// ============================ CORE REFRESH =================================

function refreshHub() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var mans = fetchManuscripts_();
  writeHubSheet_(ss, mans);
  writeMetricsSheet_(ss, mans);

  // Submission Studio tabs. Wrapped: the Studio is a separate product on
  // separate tables, and a failure there (a table not yet migrated, a schema
  // change) must not stop the manuscript pipeline -- which is the thing this
  // sheet exists for -- from refreshing.
  var studioNote = '';
  try {
    var jobs   = fetchFormattingJobs_();
    var days   = fetchStudioDays_();
    var finder = fetchFinderCount_();
    writeStudioMetricsSheet_(ss, jobs, days, finder);
    writeStudioMarketingSheet_(ss, jobs);
    studioNote = '  ' + jobs.length + ' Studio jobs.';
  } catch (e) {
    studioNote = '  Studio tabs failed: ' + e.message;
  }

  removeDefaultSheet_(ss);
  try {
    ss.toast(mans.length + ' manuscripts loaded.' + studioNote, 'OSCRSJ Hub refreshed', 5);
  } catch (e) {}
}

function fetchManuscripts_() {
  var select = [
    'id', 'submission_id', 'title', 'manuscript_type', 'status',
    'submission_date', 'created_at', 'updated_at', 'decision_date',
    'elocation_id', 'doi',
    'manuscript_authors(full_name,author_order,is_corresponding)',
    'manuscript_affiliations(country,affiliation_order)',
    'manuscript_files(id)'
  ].join(',');
  var q = '/rest/v1/manuscripts?select=' + encodeURIComponent(select) +
          '&status=neq.draft' +
          '&order=submission_date.desc.nullslast';
  return supaGet_(q);
}

// ============================ HUB SHEET ====================================

function writeHubSheet_(ss, mans) {
  var sh = ss.getSheetByName(HUB_SHEET) || ss.insertSheet(HUB_SHEET, 0);
  sh.clear();
  var ncol = HEADERS.length;
  // clear() does not remove merges — break the header-area merges so re-merging
  // on subsequent refreshes never hits an "intersecting merge" error.
  sh.getRange(1, 1, 3, ncol + 2).breakApart();

  // Row 1 — title banner.
  sh.getRange(1, 1, 1, ncol).merge()
    .setValue('OSCRSJ — Admin Manuscript Hub')
    .setFontSize(14).setFontWeight('bold')
    .setBackground('#3D2A18').setFontColor('#FFFFFF')
    .setVerticalAlignment('middle');
  sh.setRowHeight(1, 34);

  // Row 2 — subtitle / refresh stamp.
  sh.getRange(2, 1, 1, ncol).merge()
    .setValue('Last refreshed: ' + fmtNow_() +
              '     •     * = corresponding author     •     Auto-refreshes hourly')
    .setFontColor('#664930').setFontStyle('italic');

  // Row 3 — color legend.
  writeLegend_(sh, 3);

  // Row 4 — headers (frozen).
  var hdrRow = 4;
  sh.getRange(hdrRow, 1, 1, ncol).setValues([HEADERS])
    .setFontWeight('bold').setBackground('#F8F4ED').setFontColor('#3D2A18')
    .setBorder(true, true, true, true, false, false);

  // Rows 5+ — data.
  var data = mans.map(buildRow_);
  var startRow = hdrRow + 1;

  if (data.length) {
    sh.getRange(startRow, 1, data.length, ncol).setValues(data);

    // Color each row by manuscript status.
    for (var i = 0; i < mans.length; i++) {
      var color = STATUS_COLORS[mans[i].status] || '#FFFFFF';
      sh.getRange(startRow + i, 1, 1, ncol).setBackground(color);
    }

    // Date number formats: Submitted / Projected Review / Projected Decision.
    sh.getRange(startRow, 6, data.length, 3).setNumberFormat('mmm d, yyyy');
    // Decision Date.
    sh.getRange(startRow, 11, data.length, 1).setNumberFormat('mmm d, yyyy');
    // Last Updated.
    sh.getRange(startRow, 12, data.length, 1).setNumberFormat('mmm d, yyyy  h:mm am/pm');

    // Wrap the long text columns.
    sh.getRange(startRow, 2, data.length, 1).setWrap(true); // Title
    sh.getRange(startRow, 3, data.length, 1).setWrap(true); // Authors
    sh.getRange(startRow, 1, data.length, ncol).setVerticalAlignment('top');
  } else {
    sh.getRange(startRow, 1).setValue('No submitted manuscripts yet. New submissions appear here automatically.');
  }

  sh.setFrozenRows(hdrRow);

  var widths = [120, 300, 230, 110, 160, 105, 110, 120, 150, 130, 105, 150];
  for (var c = 0; c < widths.length; c++) sh.setColumnWidth(c + 1, widths[c]);
}

function buildRow_(m) {
  var authors = (m.manuscript_authors || [])
    .slice()
    .sort(function (a, b) { return (a.author_order || 0) - (b.author_order || 0); })
    .map(function (a) { return a.is_corresponding ? a.full_name + ' *' : a.full_name; })
    .join(', ');

  var country = pickCountry_(m.manuscript_affiliations);
  var type = TYPE_LABELS[m.manuscript_type] || titleCase_(m.manuscript_type);

  var subIso = m.submission_date || m.created_at;
  var subDate = subIso ? new Date(subIso) : '';
  var review = subDate ? addDays_(subDate, 14) : '';
  var decision = subDate ? addDays_(subDate, 30) : '';

  var statusLabel = STATUS_LABELS[m.status] || m.status;
  var fileCount = (m.manuscript_files || []).length;
  var filesCell = zipHyperlink_(m.id, fileCount);

  var decDate = m.decision_date ? new Date(m.decision_date) : '';
  var updated = m.updated_at ? new Date(m.updated_at) : '';

  return [
    m.submission_id || '', m.title || '(untitled)', authors, country, type,
    subDate, review, decision, statusLabel, filesCell, decDate, updated
  ];
}

function zipHyperlink_(id, count) {
  if (!count) return 'No files';
  var base = getWebAppUrl_();
  if (!base) return 'Deploy web app first';
  var token = PropertiesService.getScriptProperties().getProperty('DOWNLOAD_TOKEN') || '';
  var url = base + '?action=zip&id=' + id + '&token=' + encodeURIComponent(token);
  return '=HYPERLINK("' + url + '","Download ZIP (' + count + ')")';
}

function writeLegend_(sh, row) {
  var items = [
    ['#FFFFFF', 'Submitted / new'],
    ['#FFF2CC', 'Under review'],
    ['#CFE2F3', 'Revision requested'],
    ['#D9D2E9', 'Revision received'],
    ['#D9EAD3', 'Accepted'],
    ['#F4CCCC', 'Rejected'],
    ['#FCE5CD', 'Withdrawn']
  ];
  sh.setRowHeight(row, 22);
  var col = 1;
  for (var i = 0; i < items.length; i++) {
    sh.getRange(row, col, 1, 2).merge()
      .setValue('  ' + items[i][1])
      .setBackground(items[i][0])
      .setFontColor('#3D2A18').setFontSize(9).setFontWeight('bold')
      .setVerticalAlignment('middle')
      .setBorder(true, true, true, true, false, false, '#CCBEB1', SpreadsheetApp.BorderStyle.SOLID);
    col += 2;
  }
}

// ============================ METRICS SHEET ================================

function writeMetricsSheet_(ss, mans) {
  var sh = ss.getSheetByName(METRICS_SHEET) || ss.insertSheet(METRICS_SHEET);
  sh.clear();
  sh.getCharts().forEach(function (c) { sh.removeChart(c); });

  sh.getRange(1, 1).setValue('OSCRSJ — Manuscript Metrics')
    .setFontSize(14).setFontWeight('bold').setFontColor('#3D2A18');
  sh.getRange(2, 1).setValue('Updated ' + fmtNow_())
    .setFontStyle('italic').setFontColor('#664930');

  var byStatus = countBy_(mans, function (m) { return m.status; });
  var accepted = sumKeys_(byStatus, ['accepted', 'awaiting_payment', 'in_production', 'published']);
  var rejected = sumKeys_(byStatus, ['rejected', 'desk_rejected']);
  var decided = accepted + rejected;

  var kpis = [
    ['Total submitted',                mans.length],
    ['Awaiting reviewer assignment',   byStatus['submitted'] || 0],
    ['Under review',                   byStatus['under_review'] || 0],
    ['In revision (back to author)',   (byStatus['revision_requested'] || 0) + (byStatus['revision_received'] || 0)],
    ['Accepted',                       accepted],
    ['Published',                      byStatus['published'] || 0],
    ['Rejected (incl. desk reject)',   rejected],
    ['Withdrawn',                      byStatus['withdrawn'] || 0],
    ['Decisions made',                 decided],
    ['Acceptance rate',                decided ? Math.round(accepted / decided * 100) + '%' : '—'],
    ['Avg. days to decision',          avgDecisionDays_(mans)]
  ];
  sh.getRange(4, 1, 1, 2).setValues([['Key metric', 'Value']])
    .setFontWeight('bold').setBackground('#F8F4ED');
  sh.getRange(5, 1, kpis.length, 2).setValues(kpis);
  sh.getRange(5, 1, kpis.length, 1).setFontWeight('bold');

  // By-status table (columns D:E) — also feeds the chart.
  var statusOrder = ['submitted', 'under_review', 'revision_requested', 'revision_received',
                     'accepted', 'awaiting_payment', 'in_production', 'published',
                     'rejected', 'desk_rejected', 'withdrawn'];
  var statusRows = [];
  statusOrder.forEach(function (s) {
    if (byStatus[s]) statusRows.push([STATUS_LABELS[s] || s, byStatus[s]]);
  });
  sh.getRange(4, 4, 1, 2).setValues([['By status', 'Count']])
    .setFontWeight('bold').setBackground('#F8F4ED');
  var sRows = statusRows.length ? statusRows : [['—', 0]];
  sh.getRange(5, 4, sRows.length, 2).setValues(sRows);

  if (statusRows.length) {
    var chart = sh.newChart().asColumnChart()
      .addRange(sh.getRange(5, 4, statusRows.length, 2))
      .setPosition(4, 7, 0, 0)
      .setNumHeaders(0)
      .setOption('title', 'Manuscripts by status')
      .setOption('legend', { position: 'none' })
      .setOption('colors', ['#6FA8DC'])
      .setOption('width', 480).setOption('height', 300)
      .build();
    sh.insertChart(chart);
  }

  // Vertical breakdown blocks under the KPI table (columns A:B).
  var r = 5 + kpis.length + 2;
  r = writeBlock_(sh, r, 'By study type',
        pairsCount_(mans, function (m) { return TYPE_LABELS[m.manuscript_type] || titleCase_(m.manuscript_type); }));
  r = writeBlock_(sh, r, 'By country',
        pairsCount_(mans, function (m) { return pickCountry_(m.manuscript_affiliations); }));
  r = writeBlock_(sh, r, 'Submissions by month', monthPairs_(mans));

  sh.setColumnWidth(1, 270);
  sh.setColumnWidth(2, 90);
  sh.setColumnWidth(4, 180);
  sh.setColumnWidth(5, 80);
}

function writeBlock_(sh, r, title, pairs) {
  sh.getRange(r, 1, 1, 2).setValues([[title, '']])
    .setFontWeight('bold').setBackground('#F8F4ED').setFontColor('#3D2A18');
  r++;
  if (pairs.length) {
    sh.getRange(r, 1, pairs.length, 2).setValues(pairs);
    r += pairs.length;
  } else {
    sh.getRange(r, 1).setValue('—');
    r++;
  }
  return r + 1; // trailing blank row
}

// ============================ SUBMISSION STUDIO ============================
// Two tabs for the free manuscript-formatting tool at oscrsj.com/studio.
//
// Source of truth is Supabase, not the sheet:
//   formatting_jobs        one row per formatting job, incl. versioned consent
//   finder_queries         one envelope row per Journal Finder match
//   studio_daily_metrics   one snapshot per LOCAL day, written by the morning
//                          cron (/api/cron/studio-daily)
//
// The "At a glance" block is computed LIVE from formatting_jobs on every
// refresh, so these tabs are useful from the moment they are built rather than
// from the first cron run. The daily history table below it comes from the
// snapshots, because per-day figures like new-vs-returning users and the
// DeepSeek balance delta cannot be reconstructed after the fact.

function fetchFormattingJobs_() {
  var select = [
    'id', 'email', 'journal_id', 'article_type', 'status',
    'marketing_consent', 'consent_version', 'consent_scope',
    'created_at', 'updated_at'
  ].join(',');
  return supaGet_('/rest/v1/formatting_jobs?select=' + encodeURIComponent(select) +
                  '&order=created_at.asc&limit=5000');
}

function fetchStudioDays_() {
  // Newest first, capped at roughly four months. Older days stay in the table.
  return supaGet_('/rest/v1/studio_daily_metrics?select=' +
                  encodeURIComponent('day,metrics,deepseek_balance_usd') +
                  '&order=day.desc&limit=120');
}

function fetchFinderCount_() {
  // PostgREST caps rows server-side, so this is a floor once the Finder passes
  // that cap. Good enough as a demand signal; the daily table has exact
  // per-day counts from the snapshots.
  try {
    return supaGet_('/rest/v1/finder_queries?select=id&limit=5000').length;
  } catch (e) {
    return null;
  }
}

// ---------------------------------------------------------------- metrics tab

var STUDIO_DAILY_HEADERS = [
  'Date', 'Jobs Started', 'Completed', 'Failed', 'Still Running',
  'Completion Rate %', 'Median Run (s)', 'Finder Queries',
  'Unique Users', 'New Users', 'Returning Users',
  'Top Journal', 'Top Journal Jobs', 'Distinct Journals', 'Top Article Type',
  'Figures Uploaded', 'Top Failure Reason',
  'DeepSeek Tokens', 'Est Cost (USD)', 'Actual Spend (USD)',
  'Cost / Completed Job (USD)', 'DeepSeek Balance (USD)',
  'Est Spend To Date (USD)', 'Jobs To Date', 'Completed To Date',
  'Marketing List Size'
];

function writeStudioMetricsSheet_(ss, jobs, days, finderCount) {
  var sh = ss.getSheetByName(STUDIO_METRICS_SHEET) || ss.insertSheet(STUDIO_METRICS_SHEET);
  sh.clear();

  sh.getRange(1, 1).setValue('OSCRSJ — Submission Studio')
    .setFontSize(14).setFontWeight('bold').setFontColor('#3D2A18');
  sh.getRange(2, 1).setValue('Updated ' + fmtNow_())
    .setFontStyle('italic').setFontColor('#664930');

  // ---- At a glance (live) ----
  var completed = jobs.filter(function (j) { return j.status === 'complete'; });
  var failed    = jobs.filter(function (j) { return j.status === 'failed'; });
  var decided   = completed.length + failed.length;

  var emails = {}, consenting = {};
  jobs.forEach(function (j) {
    var e = (j.email || '').toLowerCase().trim();
    if (!e) return;
    emails[e] = (emails[e] || 0) + 1;
    if (j.marketing_consent === true) consenting[e] = true;
  });
  var uniqueUsers = Object.keys(emails).length;
  var repeatUsers = Object.keys(emails).filter(function (e) { return emails[e] > 1; }).length;

  var cutoff7 = Date.now() - 7 * 24 * 60 * 60 * 1000;
  var last7 = jobs.filter(function (j) { return Date.parse(j.created_at) >= cutoff7; }).length;

  var latest = days && days.length ? days[0] : null;
  var m = latest && latest.metrics ? latest.metrics : {};
  var bal = latest ? latest.deepseek_balance_usd : null;
  // Built from char codes, not written literally: a "$" followed by a quote is
  // an expansion directive inside a JS replacement string, and writing these
  // inline silently duplicated this file the first time it was applied through
  // the browser. Cheap immunity, and the deployed copy matches this one.
  var money = String.fromCharCode(36);
  var dash = String.fromCharCode(8212);

  var kpis = [
    ['Jobs to date',                   jobs.length],
    ['Jobs in the last 7 days',        last7],
    ['Completed',                      completed.length],
    ['Failed',                         failed.length],
    ['Completion rate',                decided ? Math.round(completed.length / decided * 100) + '%' : dash],
    ['Unique users',                   uniqueUsers],
    ['Repeat users (2+ manuscripts)',  repeatUsers],
    ['Journal Finder queries',         finderCount === null ? dash : finderCount],
    ['Marketing list size',            Object.keys(consenting).length],
    ['Est. DeepSeek spend to date',    m.cumulativeCostUsdEst === undefined ? dash : money + Number(m.cumulativeCostUsdEst).toFixed(2)],
    ['DeepSeek balance',               (bal === null || bal === undefined) ? dash : money + Number(bal).toFixed(2)],
    ['Last daily snapshot',            latest ? latest.day : 'none yet, first one lands tomorrow morning']
  ];

  sh.getRange(4, 1, 1, 2).setValues([['At a glance (live)', '']])
    .setFontWeight('bold').setBackground('#F8F4ED').setFontColor('#3D2A18');
  sh.getRange(5, 1, kpis.length, 2).setValues(kpis);
  sh.getRange(5, 1, kpis.length, 1).setFontWeight('bold');

  // The two numbers worth reading first, called out rather than left to rank
  // equally with the rest: completion rate is the health signal (it moves
  // before anyone complains) and repeat users is the only real evidence the
  // tool is useful rather than merely tried once.
  sh.getRange(9, 1, 1, 2).setBackground('#FFF6E5');
  sh.getRange(11, 1, 1, 2).setBackground('#FFF6E5');

  // ---- Daily history (from the morning snapshots) ----
  var r = 5 + kpis.length + 2;
  sh.getRange(r, 1).setValue('Daily history')
    .setFontWeight('bold').setFontSize(12).setFontColor('#3D2A18');
  r++;
  sh.getRange(r, 1).setValue('One row per day, America/Los_Angeles, written each morning by /api/cron/studio-daily.')
    .setFontStyle('italic').setFontColor('#664930');
  r += 2;

  sh.getRange(r, 1, 1, STUDIO_DAILY_HEADERS.length).setValues([STUDIO_DAILY_HEADERS])
    .setFontWeight('bold').setBackground('#F8F4ED').setFontColor('#3D2A18');
  var headerRow = r;
  r++;

  if (!days || !days.length) {
    sh.getRange(r, 1).setValue('No snapshots yet. The first one is written the morning after the cron goes live.')
      .setFontStyle('italic').setFontColor('#664930');
  } else {
    var rows = days.map(function (d) {
      var x = d.metrics || {};
      return [
        d.day,
        num_(x.jobsStarted), num_(x.jobsCompleted), num_(x.jobsFailed), num_(x.jobsUnfinished),
        blank_(x.completionRatePct), blank_(x.medianCompletionSeconds), num_(x.finderQueries),
        num_(x.uniqueEmails), num_(x.newEmails), num_(x.returningEmails),
        blank_(x.topJournal), num_(x.topJournalCount), num_(x.distinctJournals), blank_(x.topArticleType),
        num_(x.figuresUploaded), blank_(x.topFailureReason),
        num_(x.deepseekTokens), blank_(x.deepseekCostUsdEst), blank_(x.balanceDeltaUsd),
        blank_(x.costPerCompletedJobUsd), blank_(x.balanceUsd),
        blank_(x.cumulativeCostUsdEst), num_(x.cumulativeJobs), num_(x.cumulativeCompleted),
        num_(x.cumulativeMarketingContacts)
      ];
    });
    sh.getRange(r, 1, rows.length, STUDIO_DAILY_HEADERS.length).setValues(rows);
  }

  sh.setFrozenRows(headerRow);
  sh.autoResizeColumns(1, STUDIO_DAILY_HEADERS.length);
  sh.setColumnWidth(1, 150);
}

// -------------------------------------------------------------- marketing tab

var STUDIO_MARKETING_HEADERS = [
  'Email', 'First Seen (UTC)', 'Last Seen (UTC)', 'Jobs',
  'Journals Formatted For', 'Last Article Type',
  'Consent Version', 'Consent Scope', 'Source'
];

function writeStudioMarketingSheet_(ss, jobs) {
  var sh = ss.getSheetByName(STUDIO_MARKETING_SHEET) || ss.insertSheet(STUDIO_MARKETING_SHEET);
  sh.clear();

  // Deduplicated per address, oldest activity first. Rebuilt from the database
  // on every refresh, so DO NOT hand-edit this tab -- your edits are gone on the
  // next hourly run. Unsubscribes belong in the email tool, not here.
  //
  // Only rows with marketing_consent = true appear. Jobs created before
  // migration 029 are false and are excluded by construction: they were
  // collected under the earlier on-page promise that the address would be used
  // only to prevent abuse. That exclusion is deliberate, not a gap to backfill.
  var byEmail = {};
  var order = [];
  jobs.forEach(function (j) {
    if (j.marketing_consent !== true) return;
    var e = (j.email || '').toLowerCase().trim();
    if (!e) return;
    if (!byEmail[e]) {
      byEmail[e] = { email: e, first: j.created_at, last: j.created_at, jobs: 0,
                     journals: {}, type: '', version: '', scope: '' };
      order.push(e);
    }
    var c = byEmail[e];
    c.last = j.created_at;
    c.jobs++;
    if (j.journal_id) c.journals[j.journal_id] = true;
    if (j.article_type) c.type = j.article_type;
    if (j.consent_version) c.version = j.consent_version;
    if (j.consent_scope) c.scope = j.consent_scope;
  });

  sh.getRange(1, 1).setValue('OSCRSJ — Submission Studio marketing list')
    .setFontSize(14).setFontWeight('bold').setFontColor('#3D2A18');
  sh.getRange(2, 1).setValue(
      order.length + ' consenting address(es).  Rebuilt from the database every refresh, so ' +
      'edits here are overwritten. Keep unsubscribes in your email tool.  Updated ' + fmtNow_())
    .setFontStyle('italic').setFontColor('#664930');

  sh.getRange(4, 1, 1, STUDIO_MARKETING_HEADERS.length).setValues([STUDIO_MARKETING_HEADERS])
    .setFontWeight('bold').setBackground('#F8F4ED').setFontColor('#3D2A18');

  if (!order.length) {
    sh.getRange(5, 1).setValue('No consenting addresses yet.')
      .setFontStyle('italic').setFontColor('#664930');
  } else {
    var rows = order.map(function (e) {
      var c = byEmail[e];
      return [ c.email, c.first, c.last, c.jobs,
               Object.keys(c.journals).join(', '),
               c.type, c.version, c.scope, 'Submission Studio (Formatter)' ];
    });
    sh.getRange(5, 1, rows.length, STUDIO_MARKETING_HEADERS.length).setValues(rows);
  }

  sh.setFrozenRows(4);
  sh.autoResizeColumns(1, STUDIO_MARKETING_HEADERS.length);
}

function num_(v) {
  return (v === null || v === undefined) ? 0 : v;
}

function blank_(v) {
  return (v === null || v === undefined) ? '' : v;
}

// ============================ ZIP WEB APP ==================================

function doGet(e) {
  var p = (e && e.parameter) || {};
  if (p.action === 'zip') return handleZip_(p);
  return HtmlService.createHtmlOutput(
    '<p style="font-family:Arial">OSCRSJ Manuscript Hub web app is running.</p>');
}

function handleZip_(p) {
  try {
    var expected = PropertiesService.getScriptProperties().getProperty('DOWNLOAD_TOKEN');
    if (!expected || p.token !== expected) {
      return HtmlService.createHtmlOutput('<p style="font-family:Arial">Unauthorized.</p>');
    }
    var id = p.id;
    if (!id) return HtmlService.createHtmlOutput('<p style="font-family:Arial">Missing manuscript id.</p>');

    var files = supaGet_('/rest/v1/manuscript_files?manuscript_id=eq.' + id +
      '&select=original_filename,file_name,storage_path,file_type,version,file_order' +
      '&order=version.asc,file_order.asc');
    if (!files.length) return HtmlService.createHtmlOutput('<p style="font-family:Arial">No files found for this manuscript.</p>');

    var blobs = [];
    var used = {};
    files.forEach(function (f) {
      var signed = signStorage_(f.storage_path);
      if (!signed) return;
      var resp = UrlFetchApp.fetch(signed, { muteHttpExceptions: true });
      if (resp.getResponseCode() !== 200) return;
      var label = (f.original_filename || f.file_name || 'file');
      var name = 'v' + f.version + '_' + f.file_type + '_' + label;
      if (used[name]) name = (f.file_order || 0) + '_' + name;
      used[name] = true;
      blobs.push(resp.getBlob().setName(name));
    });
    if (!blobs.length) return HtmlService.createHtmlOutput('<p style="font-family:Arial">Could not fetch the files from Storage.</p>');

    var man = supaGet_('/rest/v1/manuscripts?id=eq.' + id + '&select=submission_id')[0] || {};
    var zipName = (man.submission_id || 'manuscript') + '_files.zip';
    var zip = Utilities.zip(blobs, zipName);

    var folder = getTempFolder_();
    var file = folder.createFile(zip);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    var dl = 'https://drive.google.com/uc?export=download&id=' + file.getId();

    return HtmlService.createHtmlOutput(
      '<html><body style="font-family:Arial;padding:28px;color:#3D2A18">' +
      '<h3 style="margin:0 0 8px">' + zipName + '</h3>' +
      '<p>' + blobs.length + ' file(s) zipped. Your download should start automatically…</p>' +
      '<p><a id="dl" href="' + dl + '" target="_top">Click here if it does not start.</a></p>' +
      '<script>document.getElementById("dl").click();</script>' +
      '</body></html>');
  } catch (err) {
    return HtmlService.createHtmlOutput('<p style="font-family:Arial">Error: ' + err.message + '</p>');
  }
}

function signStorage_(path) {
  var base = getProp_('SUPABASE_URL').replace(/\/$/, '');
  var url = base + '/storage/v1/object/sign/' + STORAGE_BUCKET + '/' + encodeURI(path);
  var res = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    headers: supaHeaders_(),
    payload: JSON.stringify({ expiresIn: 120 }),
    muteHttpExceptions: true
  });
  if (res.getResponseCode() !== 200) return null;
  var j = JSON.parse(res.getContentText());
  var s = j.signedURL || j.signedUrl;
  if (!s) return null;
  return base + '/storage/v1' + (s.charAt(0) === '/' ? '' : '/') + s;
}

function getTempFolder_() {
  var it = DriveApp.getFoldersByName(TEMP_FOLDER);
  var folder = it.hasNext() ? it.next() : DriveApp.createFolder(TEMP_FOLDER);
  // Housekeeping: trash zips older than 24h so Drive doesn't fill up.
  var cutoff = Date.now() - 24 * 3600 * 1000;
  var fit = folder.getFiles();
  while (fit.hasNext()) {
    var f = fit.next();
    if (f.getDateCreated().getTime() < cutoff) f.setTrashed(true);
  }
  return folder;
}

// ============================ SUPABASE HELPERS =============================

function getProp_(k) {
  var v = PropertiesService.getScriptProperties().getProperty(k);
  if (!v) throw new Error('Missing Script Property: ' + k + '. See the setup guide.');
  return v;
}

function supaHeaders_() {
  // NOTE: Supabase's new sb_secret_ keys are REJECTED from Apps Script — Google's
  // servers send a browser-like User-Agent, which trips Supabase's "secret API key
  // in a browser" block. So SERVICE_ROLE_KEY must be the LEGACY service_role JWT
  // (starts with eyJ...). The apikey header carries the public publishable key
  // (browser-safe, never triggers the block); the legacy service_role JWT rides
  // Authorization to grant the RLS-bypass role in PostgREST + Storage.
  var key = getProp_('SERVICE_ROLE_KEY');
  var pub = 'sb_publishable_au7bA3qBXPXB6ud1S62GvA_V4U6kWSO';
  return { apikey: pub, Authorization: 'Bearer ' + key };
}

function supaGet_(pathAndQuery) {
  var url = getProp_('SUPABASE_URL').replace(/\/$/, '') + pathAndQuery;
  var res = UrlFetchApp.fetch(url, { method: 'get', headers: supaHeaders_(), muteHttpExceptions: true });
  var code = res.getResponseCode();
  if (code < 200 || code >= 300) {
    throw new Error('Supabase GET ' + code + ': ' + res.getContentText().slice(0, 400));
  }
  return JSON.parse(res.getContentText());
}

function getWebAppUrl_() {
  // A pinned WEB_APP_URL wins: ScriptApp.getService().getUrl() has been observed to
  // return a stale/dead deployment URL, so prefer the explicitly pinned one. Set the
  // WEB_APP_URL script property to the live web-app /exec URL after deploying.
  var pinned = PropertiesService.getScriptProperties().getProperty('WEB_APP_URL');
  if (pinned) return pinned;
  try {
    var u = ScriptApp.getService().getUrl();
    if (u) return u;
  } catch (e) {}
  return '';
}

// ============================ SMALL UTILITIES =============================

function pickCountry_(affs) {
  if (!affs || !affs.length) return '—';
  var sorted = affs.slice().sort(function (a, b) {
    return (a.affiliation_order || 0) - (b.affiliation_order || 0);
  });
  for (var i = 0; i < sorted.length; i++) {
    if (sorted[i].country) return sorted[i].country;
  }
  return '—';
}

function addDays_(d, n) {
  var x = new Date(d.getTime());
  x.setDate(x.getDate() + n);
  return x;
}

function titleCase_(s) {
  if (!s) return '—';
  return String(s).replace(/_/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); });
}

function countBy_(arr, fn) {
  var o = {};
  arr.forEach(function (x) {
    var k = fn(x) || '—';
    o[k] = (o[k] || 0) + 1;
  });
  return o;
}

function sumKeys_(obj, keys) {
  var t = 0;
  keys.forEach(function (k) { t += obj[k] || 0; });
  return t;
}

function pairsCount_(arr, fn) {
  var o = countBy_(arr, fn);
  return Object.keys(o)
    .map(function (k) { return [k, o[k]]; })
    .sort(function (a, b) { return b[1] - a[1]; });
}

function monthPairs_(mans) {
  var o = {};
  mans.forEach(function (m) {
    var iso = m.submission_date || m.created_at;
    if (!iso) return;
    var d = new Date(iso);
    var key = Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM');
    o[key] = (o[key] || 0) + 1;
  });
  return Object.keys(o).sort().map(function (k) { return [k, o[k]]; });
}

function avgDecisionDays_(mans) {
  var totals = 0, n = 0;
  mans.forEach(function (m) {
    if (!m.decision_date) return;
    var start = m.submission_date || m.created_at;
    if (!start) return;
    var days = (new Date(m.decision_date).getTime() - new Date(start).getTime()) / 86400000;
    if (days >= 0) { totals += days; n++; }
  });
  return n ? Math.round(totals / n) : '—';
}

function fmtNow_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'EEE, MMM d yyyy  h:mm a');
}

function removeDefaultSheet_(ss) {
  var def = ss.getSheetByName('Sheet1');
  if (def && ss.getSheets().length > 1 && def.getLastRow() === 0) {
    ss.deleteSheet(def);
  }
}
