/**
 * OSCRSJ — Admin Manuscript Hub
 * ---------------------------------------------------------------------------
 * A Google Apps Script bound to the "OSCRSJ — Admin Manuscript Hub" spreadsheet.
 * It PULLS every submitted manuscript straight from the Supabase database
 * (PostgREST) and Storage, so you never have to log into oscrsj.com to see the
 * pipeline. It also serves one-click ZIP downloads of every file an author
 * submitted, and refreshes itself on an hourly schedule.
 *
 * Six tabs are built automatically. The first two are the manuscript pipeline,
 * the rest are Submission Studio and are each wrapped so a failure there cannot
 * stop the manuscript tabs refreshing:
 *   • "Manuscript Hub"           — one row per manuscript, color-coded by status
 *   • "Metrics"                  — totals, rates, and breakdowns
 *   • "Studio Daily Metrics"     — live Studio KPIs + the daily snapshot history
 *   • "Studio Marketing List"    — deduplicated consenting addresses
 *   • "Studio Survey Responses"  — raw unlock-survey responses, one row each
 *   • "Studio Survey Analytics"  — the survey report: funnel, distributions,
 *                                   ranked problems, pricing, verbatim free text
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
// Submission Studio unlock survey (2026-07-26). Two tabs, same pull-on-refresh
// arrangement as the two above: the raw dump so the data can be re-read by hand
// and never has to be taken on trust, and the analytics report so the questions
// that get asked out loud are already answered in a cell. Built by
// writeSurveyResponsesSheet_ / writeSurveyAnalyticsSheet_ at the bottom of the
// Submission Studio section.
var STUDIO_SURVEY_SHEET           = 'Studio Survey Responses';
var STUDIO_SURVEY_ANALYTICS_SHEET = 'Studio Survey Analytics';
// The sentinel a Journal Finder assessment writes into formatting_jobs.journal_id,
// which is NOT NULL and has no meaning for an assessment (migration 030;
// finder-v2-execution-report.md item 6). It is not a journal slug and must never
// be presented as one -- see writeStudioMarketingSheet_.
var FINDER_ASSESS_JOURNAL_ID = 'finder_assess';
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
  // `jobs` is declared out here rather than inside the try because the survey
  // block below needs it for the funnel. If the fetch throws it stays [], and
  // the funnel's job-side rows read zero -- which the note on that block warns
  // about, and which is better than the survey tabs failing in sympathy.
  var jobs = [];
  var studioNote = '';
  try {
    jobs       = fetchFormattingJobs_();
    var days   = fetchStudioDays_();
    var finder = fetchFinderCount_();
    writeStudioMetricsSheet_(ss, jobs, days, finder);
    writeStudioMarketingSheet_(ss, jobs);
    studioNote = '  ' + jobs.length + ' Studio jobs.';
  } catch (e) {
    studioNote = '  Studio tabs failed: ' + e.message;
  }

  // Submission Studio survey tabs. Wrapped SEPARATELY from the block above, not
  // folded into it: these read studio_survey_responses and studio_email_quota,
  // which arrived in migration 031. A sheet pointed at a database where that
  // migration has not run must still get its metrics and marketing tabs. One
  // failure, one lost pair of tabs -- never the whole refresh.
  var surveyNote = '';
  try {
    var survey = fetchSurveyResponses_();
    var quota  = fetchQuotaRows_();
    writeSurveyResponsesSheet_(ss, survey);
    writeSurveyAnalyticsSheet_(ss, survey, quota, jobs);
    surveyNote = '  ' + survey.length + ' survey responses.';
  } catch (e) {
    surveyNote = '  Survey tabs failed: ' + e.message;
  }

  removeDefaultSheet_(ss);
  try {
    ss.toast(mans.length + ' manuscripts loaded.' + studioNote + surveyNote,
             'OSCRSJ Hub refreshed', 5);
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
                     journals: {}, type: '', version: '', scope: '',
                     formatter: false, finder: false };
      order.push(e);
    }
    var c = byEmail[e];
    c.last = j.created_at;
    c.jobs++;
    // A row whose journal_id is the finder_assess sentinel is a Journal Finder
    // ASSESSMENT, not a formatter job (migration 030). Two consequences, both of
    // which used to be wrong here: the sentinel is not a journal and must stay
    // out of "Journals Formatted For", and the row must not be labelled a
    // formatter job in the Source column. One address can have done both, so the
    // two are tracked separately and the label states what the person actually
    // did. NOTE: buildMarketingList() in lib/studio/metrics.ts has the identical
    // bug and is not fixed here -- that file is the cron's copy of this logic.
    if (j.journal_id === FINDER_ASSESS_JOURNAL_ID) {
      c.finder = true;
    } else {
      c.formatter = true;
      if (j.journal_id) c.journals[j.journal_id] = true;
    }
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
               c.type, c.version, c.scope, studioSourceLabel_(c) ];
    });
    sh.getRange(5, 1, rows.length, STUDIO_MARKETING_HEADERS.length).setValues(rows);
  }

  sh.setFrozenRows(4);
  sh.autoResizeColumns(1, STUDIO_MARKETING_HEADERS.length);
}

/**
 * What this address actually used, for the marketing list's Source column.
 *
 * Split out rather than inlined because the answer is not one of two values:
 * an address can appear on both sides, and calling such a person a formatter
 * user because that string was easier to hardcode is the kind of small lie that
 * gets discovered in the middle of a campaign to the wrong list.
 */
function studioSourceLabel_(c) {
  if (c.formatter && c.finder) return 'Submission Studio (Formatter + Journal Finder)';
  if (c.finder) return 'Submission Studio (Journal Finder)';
  return 'Submission Studio (Formatter)';
}

function num_(v) {
  return (v === null || v === undefined) ? 0 : v;
}

function blank_(v) {
  return (v === null || v === undefined) ? '' : v;
}

// ======================= SUBMISSION STUDIO SURVEY ==========================
// Two more tabs, for the unlock survey at oscrsj.com/studio/unlock (2026-07-26).
//
//   "Studio Survey Responses"   raw dump, one row per response, nothing derived
//   "Studio Survey Analytics"   the read-this-one tab: funnel, distributions,
//                               ranked problems, pricing, verbatim free text
//
// WHY BOTH. The dump exists so that no reading of the data is privileged: if a
// number on the analytics tab looks wrong you can go and count the rows
// yourself, and you can sort, filter and pivot however you like without waiting
// for this script to grow another feature. The analytics tab exists because
// nobody actually pivots anything at 11pm -- the questions that get asked out
// loud ("is the gate working", "what do we fix first", "what is it worth")
// should already be answered, in words, in a cell.
//
// WHY IT IS PULLED HERE and nowhere else. Kanwar directive, 2026-07-26: survey
// data and its analytics live in THIS workbook. The push webhook
// (docs/google-sheets-apps-script.gs) deliberately has no survey tab, because a
// second copy of the responses in the Form Submissions workbook would diverge
// from this one the first time either side changed. Reading Supabase direct
// also means analytics see the WHOLE set on every refresh -- a distribution
// cannot be appended to -- and can reach studio_email_quota, which the app
// never pushes anywhere.
//
// Collection runs until 2026-09-01 (STUDIO_FREE_UNTIL_ISO in
// lib/studio/quotaConstants.ts). After that the free period ends, the survey
// stops being offered, and these two tabs stop being a dashboard and become a
// record.

// Built from char codes for the same reason writeStudioMetricsSheet_ does it:
// a "$" next to a quote is an expansion directive inside a JS replacement
// string, and this file has already been silently mangled once by being applied
// through a browser. The fair-price options below are full of "$10"/"$25",
// which read as capture-group references ($1, $2) in exactly that situation.
var SURVEY_MONEY = String.fromCharCode(36);
var SURVEY_DASH  = String.fromCharCode(8212);
// Full block, for the in-cell bar charts. Same defensive construction.
var SURVEY_BAR_CHAR = String.fromCharCode(9608);

// --------------------------------------------------- mirror of survey.ts ----
// Apps Script cannot import the TypeScript question set, so the ids, types and
// option lists are transcribed here. This is the only duplication in the file
// and it is deliberate: the analytics need to know which questions are
// multi-select (different denominator), which ones can carry a write-in, which
// options were OFFERED (an option nobody picked is a finding, and it can only
// appear as a zero row if the list is known independently of the answers), and
// which question is which for the labelled blocks.
//
// Transcribed against SURVEY_VERSION '2026-07-26.v2'. v2 CUT five questions --
// role, journal_available, missing_journal, willingness_to_pay, anything_else --
// and dropped 'It should be free' from fair_price. Anything in this file that
// depended on those questions has been removed rather than left to return
// blanks; the removals are marked with tombstone comments where the block used
// to be, so the loss is visible instead of merely absent.
//
// When the survey changes again: bump SURVEY_VERSION_MIRRORED, update the array
// below, re-run. Nothing here throws when it drifts -- an unrecognised answer is
// still counted, under its own label -- but a stale option list quietly stops
// reporting new options, so the analytics header block prints a warning
// whenever a response arrives carrying a version this mirror does not know.
var SURVEY_VERSION_MIRRORED = '2026-07-26.v2';

// Matches MULTI_JOIN in lib/studio/survey.ts. Multi-select cells must be joined
// the same way the app joins them or the two exports stop being comparable.
var SURVEY_MULTI_JOIN = '; ';
// Matches OTHER_PREFIX. Write-ins arrive as the literal string 'Other: <text>'.
var SURVEY_OTHER_PREFIX = 'Other: ';
// The prefix without its trailing space. Every write-in test matches on THIS,
// not on the prefix, because an empty write-in arrives as 'Other:  ' and the
// helpers trim before testing -- leaving the bare stem 'Other:', which does not
// start with 'Other: ' and so sailed through as if it were a real option. It
// then appeared in the ranked problems list as its own bucket. Match the stem
// and judge emptiness on what follows it.
var SURVEY_OTHER_STEM = 'Other:';
// Distributions collapse every write-in into one bucket, otherwise a long tail
// of one-off answers buries the options that were actually offered. The
// write-ins are NOT lost: they get their own block at the bottom of the
// analytics tab, verbatim.
var SURVEY_OTHER_BUCKET = 'Other (write-in)';

// Mirrors STUDIO_FREE_RUNS / STUDIO_QUOTA_WINDOW_DAYS in
// lib/studio/quotaConstants.ts. The funnel is meaningless without both: since
// 2026-07-26 the allowance is three completed runs per ROLLING SEVEN DAYS, not
// three for life, so "hit the limit" is a statement about a span of time and
// not about a running total. Change these together or the funnel lies.
var STUDIO_FREE_RUNS = 3;
var STUDIO_QUOTA_WINDOW_DAYS = 7;
var STUDIO_QUOTA_WINDOW_MS = STUDIO_QUOTA_WINDOW_DAYS * 24 * 60 * 60 * 1000;

// Mirrors STUDIO_ADMIN_EMAILS in lib/studio/quotaConstants.ts. These addresses
// bypass the allowance entirely -- no counting, no gate -- so leaving them in
// would put an unbounded number of runs from one person into every denominator
// on the tab and make the funnel read as though users were sailing past the
// limit. They are excluded from ALL analytics, and the count of what was
// excluded is printed in the Overview so the exclusion is never silent.
//
// KNOWN GAP: the app also honours a comma-separated STUDIO_ADMIN_EMAILS
// environment variable, server-side, which Apps Script cannot see. An admin
// added that way and NOT added to this array will be counted here as an
// ordinary user. If that ever happens, add the address to this array too.
var STUDIO_ADMIN_EMAILS = ['kanwarpartap@live.com'];

// Mirrors the rule stated on studio_survey_responses.duration_seconds in
// migration 031: a survey completed faster than this was almost certainly
// speed-run to get the refill, and its free text should not drive a decision on
// its own. Flagged, never dropped -- a fast answer from someone who already
// knew what they wanted to say is a real answer.
var SURVEY_LOW_CONFIDENCE_SECONDS = 30;

// The six columns that precede the per-question ones. Mirrors FIXED_HEADERS in
// lib/studio/survey.ts, so surveyDumpHeaders_() below produces exactly what
// surveySheetHeaders() produces. This is now the ONLY mirror of that function
// anywhere in the repo -- the push webhook's copy was deleted with its tab -- so
// if these drift, nothing else will catch it.
var SURVEY_FIXED_HEADERS = [
  'Submitted At (UTC)', 'Email', 'Survey Version', 'Granted Reset',
  'Duration (sec)', 'Follow-up OK'
];

// Seven questions, in the order surveySheetHeaders() emits them.
// `allowOther` marks the ones that can carry a 'Other: ...' write-in; after v2
// that is `problems` alone, and the write-in block iterates this flag rather
// than every question so it stops scanning six ids that can never match.
var SURVEY_QUESTIONS = [
  { id: 'tools_used', type: 'multi', header: 'Tools Used', allowOther: false, options: [
    'Journal Finder',
    'Manuscript Formatter'
  ] },
  // A 1-5 scale. The options are written out as strings so the scale shares one
  // code path with the categorical questions, and so a score nobody gave still
  // shows as a zero row -- "not one person said 5" is the finding.
  { id: 'usefulness', type: 'scale', header: 'Usefulness (1-5)', allowOther: false, options: [
    '1', '2', '3', '4', '5'
  ] },
  { id: 'time_saved', type: 'single', header: 'Time Effect', allowOther: false, options: [
    'Saved me several hours',
    'Saved me about an hour',
    'Saved me a few minutes',
    'About the same either way',
    'Cost me more time than it saved',
    'I never used the output'
  ] },
  { id: 'output_usable', type: 'single', header: 'Output Usable', allowOther: false, options: [
    'All of it, no changes needed',
    'Most of it, minor fixes',
    'About half',
    'Very little, major rework',
    'None of it',
    'I did not get far enough to tell'
  ] },
  { id: 'problems', type: 'multi', header: 'Problems', allowOther: true, options: [
    'References or citation style',
    'Headings or section order',
    'Tables',
    'Figures or figure captions',
    'Title page, authors, or affiliations',
    'Abstract structure',
    'Word or character counts',
    'The journal shortlist did not fit my paper',
    'It failed or errored before finishing',
    'It was too slow',
    'Nothing went wrong'
  ] },
  { id: 'most_important_fix', type: 'text', header: 'Most Important Fix', allowOther: false, options: [] },
  // 'It should be free' was removed from this list in v2. It is not restored
  // here as a zero row: an option that was never offered to these respondents
  // must not appear in their distribution, or a reader concludes nobody wanted
  // a free tier when in fact nobody was asked.
  { id: 'fair_price', type: 'single', header: 'Fair Price', allowOther: false, options: [
    'Under ' + SURVEY_MONEY + '10',
    SURVEY_MONEY + '10 to ' + SURVEY_MONEY + '25',
    SURVEY_MONEY + '25 to ' + SURVEY_MONEY + '50',
    'More than ' + SURVEY_MONEY + '50',
    'I would rather pay a monthly subscription'
  ] }
];

/**
 * The raw-dump header. Same construction as surveySheetHeaders() in
 * lib/studio/survey.ts: the six fixed columns, then one per question in
 * declared order. Derived rather than typed out a second time, so the dump tab
 * cannot drift from the mirror above even if someone edits only the mirror.
 */
function surveyDumpHeaders_() {
  var out = SURVEY_FIXED_HEADERS.slice();
  for (var i = 0; i < SURVEY_QUESTIONS.length; i++) out.push(SURVEY_QUESTIONS[i].header);
  return out;
}

function surveyQuestion_(id) {
  for (var i = 0; i < SURVEY_QUESTIONS.length; i++) {
    if (SURVEY_QUESTIONS[i].id === id) return SURVEY_QUESTIONS[i];
  }
  // Never throw on a missing question: an id renamed or cut in the app must
  // degrade to an empty block, not take the whole refresh down.
  return { id: id, type: 'single', header: id, allowOther: false, options: [] };
}

// ------------------------------------------------------------------ fetch ---

/**
 * Every survey response, newest first.
 *
 * Same limit convention as the other fetchers (5000). PostgREST caps rows
 * server-side anyway, and at the volume this survey can ever see -- offered
 * once per address, during a six-week free period -- 5000 is not a ceiling
 * anyone reaches. If it ever were, the analytics would describe the newest 5000
 * and the count printed on the tab is the honest count of what was read.
 *
 * THE SELECT LIST IS LOAD BEARING. PostgREST 400s the whole request for one
 * unknown column, which would take out both survey tabs. `role` and
 * `willingness_to_pay` were promoted columns until 2026-07-26 and are now gone
 * from migration 031 along with their questions -- selecting them today is an
 * error, not merely a null. `usefulness` is the one promoted column left.
 * `follow_up_ok` IS a real column (not null, default false): the migration
 * keeps it out of the jsonb blob deliberately, because it is permission rather
 * than data and anyone building a follow-up list filters on it.
 *
 * `ip` is deliberately NOT selected. It exists for abuse forensics, nothing on
 * either tab uses it, and pulling it would put a list of IP addresses into a
 * spreadsheet for no reason.
 */
function fetchSurveyResponses_() {
  var select = [
    'id', 'email', 'survey_version', 'responses',
    'usefulness', 'granted_reset', 'follow_up_ok',
    'duration_seconds', 'created_at'
  ].join(',');
  return supaGet_('/rest/v1/studio_survey_responses?select=' + encodeURIComponent(select) +
                  '&order=created_at.desc&limit=5000');
}

/**
 * The per-email allowance rows.
 *
 * Needed for exactly one thing, and it is the important thing: the funnel. The
 * survey table alone says how many people answered; only studio_email_quota
 * says how many were ASKED -- which addresses ran out of runs, how many refills
 * were actually granted, and (via quota_reset_at) whether anyone came back and
 * used the runs they bought. Without this table the conversion denominators do
 * not exist and the response count is a number with no scale.
 *
 * Rows are sparse by design: no row means no refill was ever granted for that
 * address and the count runs from the rolling window alone. Absence is normal,
 * not missing data, and migration 031 explicitly declines to backfill.
 */
function fetchQuotaRows_() {
  var select = [
    'email', 'quota_reset_at', 'reset_count', 'survey_completed_at', 'first_seen_at'
  ].join(',');
  return supaGet_('/rest/v1/studio_email_quota?select=' + encodeURIComponent(select) +
                  '&order=first_seen_at.desc&limit=5000');
}

// ------------------------------------------------- reading a response row ---

/**
 * The answers blob, always as a plain object, never throwing.
 *
 * `responses` is jsonb and PostgREST returns it already parsed, but this also
 * accepts a string (a row written by hand through the SQL editor, or a future
 * client that double-encodes) and returns {} for anything it cannot make sense
 * of. One malformed blob must cost one blank row, not the whole refresh: a
 * throw here would take out both survey tabs, for one bad row out of hundreds.
 */
function surveyAnswers_(row) {
  if (!row) return {};
  var raw = row.responses;
  if (!raw) return {};
  if (typeof raw === 'string') {
    try { raw = JSON.parse(raw); } catch (e) { return {}; }
  }
  if (!raw || typeof raw !== 'object') return {};
  if (Object.prototype.toString.call(raw) === '[object Array]') return {};
  return raw;
}

function surveyIsArray_(v) {
  return Object.prototype.toString.call(v) === '[object Array]';
}

/**
 * One answer as a display string. A missing key, a key belonging to a question
 * that has since been cut, null, or a nested object we did not expect all come
 * back as '' -- a blank cell, never an error.
 */
function surveyText_(answers, id) {
  if (!answers) return '';
  var v = answers[id];
  if (v === null || v === undefined) return '';
  if (surveyIsArray_(v)) {
    var parts = [];
    for (var i = 0; i < v.length; i++) {
      if (v[i] === null || v[i] === undefined) continue;
      if (typeof v[i] === 'object') continue;
      var s = String(v[i]).replace(/^\s+|\s+$/g, '');
      if (s) parts.push(s);
    }
    return parts.join(SURVEY_MULTI_JOIN);
  }
  if (typeof v === 'object') return '';
  return String(v).replace(/^\s+|\s+$/g, '');
}

/**
 * One answer as a list of selections. Tolerates a bare string where an array
 * was expected (a hand-fixed row, or a single-select that later became a
 * multi): counting it once is obviously right, and refusing to count it
 * silently loses a respondent.
 */
function surveyList_(answers, id) {
  if (!answers) return [];
  var v = answers[id];
  if (v === null || v === undefined) return [];
  var out = [];
  if (surveyIsArray_(v)) {
    for (var i = 0; i < v.length; i++) {
      if (v[i] === null || v[i] === undefined || typeof v[i] === 'object') continue;
      var s = String(v[i]).replace(/^\s+|\s+$/g, '');
      if (s) out.push(s);
    }
    return out;
  }
  if (typeof v === 'object') return [];
  var one = String(v).replace(/^\s+|\s+$/g, '');
  return one ? [one] : [];
}

/**
 * 'Other: whatever they typed' -> the single write-in bucket.
 *
 * An EMPTY write-in ('Other:' with nothing after it) is discarded rather than
 * bucketed. validateSurvey() rejects those at the door now, but rows written
 * before that fix landed on 2026-07-26 can still carry the literal 'Other:  ',
 * and a blank write-in counted as a real one reads on the analytics tab as an
 * unanticipated finding that does not exist.
 */
function surveyBucket_(value) {
  if (!value) return '';
  var s = String(value);
  if (s.indexOf(SURVEY_OTHER_STEM) !== 0) return s;
  return s.substring(SURVEY_OTHER_STEM.length).replace(/^\s+|\s+$/g, '') === ''
    ? '' : SURVEY_OTHER_BUCKET;
}

function surveyNormEmail_(e) {
  return (e || '').toString().toLowerCase().replace(/^\s+|\s+$/g, '');
}

/** Mirrors isAdminEmail() in lib/studio/quotaConstants.ts, minus the env list. */
function surveyIsAdmin_(email) {
  var e = surveyNormEmail_(email);
  for (var i = 0; i < STUDIO_ADMIN_EMAILS.length; i++) {
    if (surveyNormEmail_(STUDIO_ADMIN_EMAILS[i]) === e) return true;
  }
  return false;
}

/**
 * Timestamps render in UTC, not in the script's time zone, because the column
 * is labelled "(UTC)". Quietly re-basing a UTC instant into whatever zone the
 * script happens to be set to, under a heading that says UTC, is how two people
 * end up disagreeing about which day something happened.
 */
function surveyStamp_(iso) {
  if (!iso) return '';
  var t = Date.parse(iso);
  if (isNaN(t)) return String(iso);
  return Utilities.formatDate(new Date(t), 'UTC', 'yyyy-MM-dd HH:mm');
}

/**
 * Free text goes through here before it reaches a cell.
 *
 * A respondent who starts an answer with "=" or "+" or "@" would otherwise have
 * their sentence parsed as a formula and rendered as #NAME?, which loses the
 * answer -- and the free text is the entire point of the one open question left.
 * The leading apostrophe is Sheets' own "this is text" marker; it does not
 * display and does not survive into a copy of the cell value.
 */
function surveySafeText_(s) {
  var v = (s === null || s === undefined) ? '' : String(s);
  if (!v) return '';
  var c = v.charAt(0);
  if (c === '=' || c === '+' || c === '@') return "'" + v;
  return v;
}

/**
 * Did this respondent agree to be emailed about their feedback?
 *
 * `follow_up_ok` is a real column as of migration 031 -- not null, default
 * false -- kept out of the jsonb blob on purpose, because it is permission and
 * not data and a permission flag buried in a blob is one that eventually gets
 * missed. The blob fallbacks below cover only the case of a row written by an
 * older client that stashed it inside `responses`, and an unknown answer
 * reports BLANK rather than 'no': "we did not record it" and "they said no"
 * are different facts, and only one of them is a reason not to email someone.
 */
function surveyFollowUp_(row, answers) {
  var v = null;
  if (row && row.follow_up_ok !== undefined && row.follow_up_ok !== null) {
    v = row.follow_up_ok;
  } else if (answers) {
    if (answers.follow_up_ok !== undefined && answers.follow_up_ok !== null) v = answers.follow_up_ok;
    else if (answers.followUpOk !== undefined && answers.followUpOk !== null) v = answers.followUpOk;
  }
  if (v === null || v === undefined || v === '') return '';
  if (v === true || v === 1 || v === '1') return 'yes';
  if (v === false || v === 0 || v === '0') return 'no';
  var s = String(v).toLowerCase();
  if (s === 'yes' || s === 'true') return 'yes';
  if (s === 'no' || s === 'false') return 'no';
  return String(v);
}

/**
 * Normalise the raw PostgREST rows once, up front, into the shape every block
 * below reads. One pass rather than re-parsing the blob inside each block: the
 * parsing is the fiddly, throw-prone part, so it happens exactly once, in one
 * place, where it is defended.
 *
 * `role` and `wtp` fields used to live on this record and are gone with their
 * questions (v2). Nothing reads them; anything that did has been deleted rather
 * than left to render an empty column.
 */
function surveyRecords_(rows) {
  var out = [];
  if (!rows || !rows.length) return out;
  for (var i = 0; i < rows.length; i++) {
    var row = rows[i] || {};
    var a = surveyAnswers_(row);
    var dur = null;
    if (row.duration_seconds !== null && row.duration_seconds !== undefined && row.duration_seconds !== '') {
      var d = Number(row.duration_seconds);
      if (!isNaN(d)) dur = d;
    }
    var useN = null;
    var useRaw = surveyText_(a, 'usefulness');
    if (useRaw === '' && row.usefulness !== null && row.usefulness !== undefined) useRaw = String(row.usefulness);
    if (useRaw !== '') {
      var u = Number(useRaw);
      if (!isNaN(u)) useN = u;
    }
    var email = surveyNormEmail_(row.email);
    out.push({
      id: row.id || '',
      email: email,
      isAdmin: surveyIsAdmin_(email),
      version: row.survey_version || '',
      created: row.created_at || '',
      granted: row.granted_reset === true,
      duration: dur,
      lowConfidence: (dur !== null && dur < SURVEY_LOW_CONFIDENCE_SECONDS),
      followUp: surveyFollowUp_(row, a),
      answers: a,
      usefulness: useN
    });
  }
  return out;
}

/**
 * One answer, preferring the blob and falling back to the promoted column.
 *
 * The blob is the answer of record; `usefulness` is a denormalised copy written
 * at insert for indexing, and is now the ONLY promoted column. The fallback
 * exists so a row whose blob was truncated or hand-repaired still counts in
 * that distribution instead of silently shrinking the denominator.
 */
function surveyAnswerText_(rec, id) {
  var v = surveyText_(rec.answers, id);
  if (v !== '') return v;
  if (id === 'usefulness') return rec.usefulness === null ? '' : String(rec.usefulness);
  return '';
}

/** The dump cell for one question: multi joins, everything else is text. */
function surveyCell_(rec, q) {
  if (q.type === 'multi') return surveyList_(rec.answers, q.id).join(SURVEY_MULTI_JOIN);
  return surveyAnswerText_(rec, q.id);
}

/**
 * Which tools this respondent used, as one string.
 *
 * Carried alongside the free text and the write-ins as CONTEXT, taking the slot
 * `role` used to occupy before it was cut. It is a weaker signal than role was
 * -- it says what they touched, not who they are -- but it is the only
 * per-respondent attribute left, and "the formatter mangled my tables" from
 * someone who only ever used the Finder means something is wrong with the
 * answer, not the formatter.
 */
function surveyToolsText_(rec) {
  return surveyList_(rec.answers, 'tools_used').join(SURVEY_MULTI_JOIN);
}

// ---------------------------------------------------- small math + layout ---

function surveyPct_(n, d) {
  if (!d) return SURVEY_DASH;
  return (Math.round(n / d * 1000) / 10) + '%';
}

function surveyRepeat_(ch, n) {
  var s = '';
  for (var i = 0; i < n; i++) s += ch;
  return s;
}

/**
 * A bar drawn in text, so a distribution reads at a glance without anyone
 * inserting a chart. Scaled to the biggest bucket rather than to the total,
 * because the SHAPE is the thing being read. Any non-zero count gets at least
 * one block: a bar that rounds away to nothing looks like a zero.
 */
function surveyBar_(n, max) {
  if (!n || !max) return '';
  var units = Math.round(n / max * 20);
  if (units < 1) units = 1;
  return surveyRepeat_(SURVEY_BAR_CHAR, units);
}

function surveyPadRow_(row, width) {
  var out = row.slice(0, width);
  while (out.length < width) out.push('');
  return out;
}

/**
 * One labelled block: bold title, optional italic note, bold header row, body,
 * then a blank line. Returns the row the NEXT block starts on.
 *
 * Everything on the analytics tab goes through here so the blocks line up, and
 * so a block with nothing in it prints an em dash instead of colliding with the
 * next one. setValues needs a rectangle, hence the padding: the blocks have
 * different widths and a ragged array throws.
 */
function surveyBlock_(sh, r, title, header, rows, note) {
  sh.getRange(r, 1).setValue(title)
    .setFontWeight('bold').setFontSize(12).setFontColor('#3D2A18');
  r++;
  if (note) {
    sh.getRange(r, 1).setValue(note).setFontStyle('italic').setFontColor('#664930');
    r++;
  }
  var width = (header && header.length) ? header.length : 1;
  var i;
  if (rows) {
    for (i = 0; i < rows.length; i++) {
      if (rows[i].length > width) width = rows[i].length;
    }
  }
  if (header && header.length) {
    sh.getRange(r, 1, 1, width).setValues([surveyPadRow_(header, width)])
      .setFontWeight('bold').setBackground('#F8F4ED').setFontColor('#3D2A18');
    r++;
  }
  if (rows && rows.length) {
    var padded = [];
    for (i = 0; i < rows.length; i++) padded.push(surveyPadRow_(rows[i], width));
    sh.getRange(r, 1, padded.length, width).setValues(padded);
    r += padded.length;
  } else {
    sh.getRange(r, 1).setValue(SURVEY_DASH + ' none').setFontColor('#664930');
    r++;
  }
  return r + 1;
}

/**
 * Column widths, set once at the end. The blocks share columns, so the widths
 * are a compromise: column A is always the label or the long text, and B / C /
 * F stay narrow for counts and percentages.
 */
function surveySetWidths_(sh) {
  var widths = [300, 130, 130, 220, 210, 130, 190, 190];
  for (var c = 0; c < widths.length; c++) sh.setColumnWidth(c + 1, widths[c]);
}

// ------------------------------------------------------- raw responses tab ---

/**
 * The dump. One row per response, no aggregation, columns exactly as
 * surveySheetHeaders() defines them.
 *
 * The jsonb blob is keyed by question id, so unpacking is BY ID and never by
 * position: a question inserted or cut in the app shifts columns here rather
 * than scrambling the data. A key that is missing, or that belonged to a
 * question cut in v2, produces a blank cell. That is the correct answer -- the
 * row genuinely does not contain it -- and it keeps pre-v2 responses readable
 * next to new ones instead of dropping them or throwing.
 *
 * ADMIN ROWS ARE KEPT HERE. The analytics tab excludes them because they would
 * skew every denominator, but this tab is the record of what is in the table
 * and filtering it would make the two tabs disagree about how many responses
 * exist, which is exactly the kind of discrepancy that costs an hour to chase.
 */
function writeSurveyResponsesSheet_(ss, responses) {
  var sh = ss.getSheetByName(STUDIO_SURVEY_SHEET) || ss.insertSheet(STUDIO_SURVEY_SHEET);
  sh.clear();

  var headers = surveyDumpHeaders_();
  var recs = surveyRecords_(responses);

  sh.getRange(1, 1).setValue('OSCRSJ ' + SURVEY_DASH + ' Submission Studio survey responses (raw)')
    .setFontSize(14).setFontWeight('bold').setFontColor('#3D2A18');
  sh.getRange(2, 1).setValue(
      recs.length + ' response(s), newest first, admin addresses included. Rebuilt from the database on ' +
      'every refresh, so edits here are overwritten. Columns mirror surveySheetHeaders() in ' +
      'lib/studio/survey.ts.  Updated ' + fmtNow_())
    .setFontStyle('italic').setFontColor('#664930');

  sh.getRange(4, 1, 1, headers.length).setValues([headers])
    .setFontWeight('bold').setBackground('#F8F4ED').setFontColor('#3D2A18');

  if (!recs.length) {
    sh.getRange(5, 1).setValue('No survey responses yet.')
      .setFontStyle('italic').setFontColor('#664930');
  } else {
    var rows = [];
    for (var i = 0; i < recs.length; i++) {
      var x = recs[i];
      var row = [
        surveyStamp_(x.created),
        x.email,
        x.version,
        x.granted ? 'yes' : 'no',
        x.duration === null ? '' : x.duration,
        x.followUp
      ];
      for (var j = 0; j < SURVEY_QUESTIONS.length; j++) {
        row.push(surveySafeText_(surveyCell_(x, SURVEY_QUESTIONS[j])));
      }
      rows.push(surveyPadRow_(row, headers.length));
    }
    sh.getRange(5, 1, rows.length, headers.length).setValues(rows);
    // Only the one long free-text column wraps. Wrapping everything turns the
    // tab into a wall of tall rows and makes it useless for scanning.
    // 'Most Important Fix' is second from the right after v2 cut 'Anything Else'.
    var fixCol = headers.length - 1;
    sh.getRange(5, fixCol, rows.length, 1).setWrap(true);
    sh.getRange(5, 1, rows.length, headers.length).setVerticalAlignment('top');
  }

  sh.setFrozenRows(4);
  sh.autoResizeColumns(1, headers.length);
  // autoResize makes the free-text column absurdly wide; pin it back.
  sh.setColumnWidth(headers.length - 1, 340);
}

// -------------------------------------------------------- analytics blocks ---

/**
 * Did this address ever hit the allowance, under a ROLLING window?
 *
 * The allowance moved from "three runs for life" to "three completed runs per
 * rolling seven days" on 2026-07-26, and that changes what the question even
 * means. A lifetime cap is a running total, so hitting it is `completed >= 3`.
 * A rolling cap is a statement about a SPAN: an address hit it if three
 * completed runs ever fell inside any seven-day window, and an address with
 * thirty completed runs spread one a fortnight has never hit it at all.
 *
 * Cheap to compute exactly, so it is computed exactly rather than approximated:
 * sort the charged timestamps and slide a window of STUDIO_FREE_RUNS across
 * them. If the first and last of any such group are within the window, the
 * address was locked out at that moment.
 *
 * The reset epoch is deliberately IGNORED here. A refill stops old runs
 * counting against the live allowance, but it does not un-happen the lockout
 * that earned the refill, and the funnel's denominator is "people the gate
 * actually stopped" -- a historical fact.
 */
function surveyEverHitLimit_(charged) {
  if (!charged || charged.length < STUDIO_FREE_RUNS) return false;
  var t = charged.slice().sort(function (a, b) { return a - b; });
  for (var i = STUDIO_FREE_RUNS - 1; i < t.length; i++) {
    if (t[i] - t[i - (STUDIO_FREE_RUNS - 1)] <= STUDIO_QUOTA_WINDOW_MS) return true;
  }
  return false;
}

/**
 * The gate funnel. The single most important block on the tab.
 *
 * It answers the question the survey gate was always going to raise: is asking
 * for feedback in exchange for a refill actually buying feedback, or is it
 * simply where usage stops? Every other block describes the people who
 * answered. This one describes the people who did not.
 *
 * Derived from three sources because no single one of them knows:
 *   formatting_jobs      who ran what, and how much of it completed
 *   studio_email_quota   who was granted a refill, and from when it counts
 *   survey responses     who answered
 *
 * TWO THINGS THAT CHANGED ON 2026-07-26 AND CHANGE HOW THIS READS:
 *
 *   1. The window is rolling, not lifetime. "Hit the limit" is now the sliding
 *      test above, and every label here says "window" or names the seven days
 *      rather than saying "lifetime", which would now be false.
 *
 *   2. The survey is no longer the ONLY way back. Waiting for the oldest run to
 *      age out unlocks the address on its own. So a low conversion here is no
 *      longer evidence the survey is failing -- it may simply mean people are
 *      waiting, which is a perfectly good outcome for them and a bad one only
 *      for us. Read the conversion together with "ran again after the refill":
 *      that pair separates "nobody wants to answer" from "nobody needed to".
 *
 * Only completed runs count, matching CHARGED_STATUS in lib/studio/quota.ts.
 * In-flight jobs, which the live gate also counts for up to
 * IN_FLIGHT_GRACE_MINUTES, are not reconstructed: the grace window has long
 * expired for anything historical, so including them would add nothing but
 * noise from jobs still running as this refresh executes.
 *
 * ADMIN ADDRESSES ARE STRIPPED FROM ALL THREE INPUTS. They bypass the allowance
 * entirely, so an admin with forty test runs would otherwise appear as one
 * user who blew straight past a limit that was never applied to them, and would
 * sit in the denominator of every rate on this block.
 */
function surveyFunnelRows_(recs, quotaRows, jobs) {
  var quotaBy = {};
  var i, e, q, c;
  for (i = 0; quotaRows && i < quotaRows.length; i++) {
    e = surveyNormEmail_(quotaRows[i] && quotaRows[i].email);
    if (e && !surveyIsAdmin_(e)) quotaBy[e] = quotaRows[i];
  }

  var now = Date.now();
  var rollingStart = now - STUDIO_QUOTA_WINDOW_MS;

  var jobsBy = {};
  var adminJobEmails = {};
  for (i = 0; jobs && i < jobs.length; i++) {
    var j = jobs[i] || {};
    e = surveyNormEmail_(j.email);
    if (!e) continue;
    if (surveyIsAdmin_(e)) { adminJobEmails[e] = true; continue; }
    c = jobsBy[e];
    if (!c) { c = jobsBy[e] = { total: 0, completed: 0, charged: [], afterReset: 0, afterResetCompleted: 0 }; }
    c.total++;
    var t = j.created_at ? Date.parse(j.created_at) : NaN;
    if (j.status === 'complete') {
      c.completed++;
      if (!isNaN(t)) c.charged.push(t);
    }
    q = quotaBy[e];
    if (q && q.quota_reset_at && !isNaN(t) && t > Date.parse(q.quota_reset_at)) {
      c.afterReset++;
      if (j.status === 'complete') c.afterResetCompleted++;
    }
  }

  var jobEmails = Object.keys(jobsBy);
  var ranAny = jobEmails.length;
  var completedAny = 0, everHit = 0, lockedNow = 0, lockedOpen = 0, lockedFinal = 0;
  for (i = 0; i < jobEmails.length; i++) {
    e = jobEmails[i];
    c = jobsBy[e];
    q = quotaBy[e];
    if (c.completed > 0) completedAny++;
    c.everHit = surveyEverHitLimit_(c.charged);
    if (c.everHit) everHit++;
    // Live lock state: completed runs since the LATER of the refill epoch and
    // now-7d, exactly as countUsage() in lib/studio/quota.ts computes it.
    var windowStart = rollingStart;
    if (q && q.quota_reset_at) {
      var epoch = Date.parse(q.quota_reset_at);
      if (!isNaN(epoch) && epoch > windowStart) windowStart = epoch;
    }
    var inWindow = 0;
    for (var k = 0; k < c.charged.length; k++) { if (c.charged[k] >= windowStart) inWindow++; }
    if (inWindow >= STUDIO_FREE_RUNS) {
      lockedNow++;
      if (q && Number(q.reset_count || 0) >= 1) lockedFinal++; else lockedOpen++;
    }
  }

  var respondentEmails = {};
  for (i = 0; i < recs.length; i++) {
    if (recs[i].email) respondentEmails[recs[i].email] = true;
  }
  var respondents = Object.keys(respondentEmails);
  var surveyed = respondents.length;

  var atLimit = 0, voluntary = 0, orphan = 0;
  for (i = 0; i < respondents.length; i++) {
    c = jobsBy[respondents[i]];
    if (!c) { orphan++; continue; }
    if (c.everHit) atLimit++; else voluntary++;
  }

  var refills = 0, cameBack = 0, cameBackCompleted = 0;
  var quotaEmails = Object.keys(quotaBy);
  for (i = 0; i < quotaEmails.length; i++) {
    e = quotaEmails[i];
    if (Number(quotaBy[e].reset_count || 0) < 1) continue;
    refills++;
    c = jobsBy[e];
    if (c && c.afterReset > 0) cameBack++;
    if (c && c.afterResetCompleted > 0) cameBackCompleted++;
  }

  var pad = '     ';
  var windowPhrase = STUDIO_FREE_RUNS + ' completed runs inside any ' + STUDIO_QUOTA_WINDOW_DAYS + '-day window';
  return [
    ['Distinct emails that started a Studio job', ranAny, SURVEY_DASH, 'admins excluded'],
    [pad + 'with at least one COMPLETED run', completedAny, surveyPct_(completedAny, ranAny), 'of emails that started a job'],
    ['Ever hit the allowance (' + windowPhrase + ')', everHit, surveyPct_(everHit, completedAny), 'of emails with a completed run'],
    ['Locked right now', lockedNow, surveyPct_(lockedNow, completedAny), 'of emails with a completed run'],
    [pad + 'refill still available', lockedOpen, SURVEY_DASH, 'the people the survey is being offered to'],
    [pad + 'refill already spent, waiting for runs to age out', lockedFinal, SURVEY_DASH, 'nothing further is on offer to these addresses'],
    // The headline count is distinct RESPONDENTS in any state, so it carries no
    // conversion of its own: a respondent who ran their jobs under a different
    // address is not a member of the "ever hit the allowance" set, and dividing
    // one by the other would print a rate above 100% and make the block look
    // broken. The real gate conversion is the subset ratio on the next row.
    ['Completed the survey', surveyed, SURVEY_DASH, 'distinct addresses, any state'],
    [pad + 'had hit the allowance  <-- THE GATE CONVERSION', atLimit, surveyPct_(atLimit, everHit), 'of emails that ever hit the allowance'],
    [pad + 'answered without ever hitting it', voluntary, surveyPct_(voluntary, surveyed), 'of respondents'],
    [pad + 'no job on record for that address', orphan, surveyPct_(orphan, surveyed), 'of respondents'],
    ['Refills granted', refills, surveyPct_(refills, surveyed), 'of respondents'],
    [pad + 'ran at least one job after the refill', cameBack, surveyPct_(cameBack, refills), 'of refills granted'],
    [pad + 'completed at least one run after the refill', cameBackCompleted, surveyPct_(cameBackCompleted, refills), 'of refills granted'],
    ['Admin addresses excluded from every figure above', Object.keys(adminJobEmails).length, SURVEY_DASH, 'STUDIO_ADMIN_EMAILS'],
    ['Total responses (repeat submissions included)', recs.length, SURVEY_DASH, SURVEY_DASH]
  ];
}

/**
 * Counts and percentages for one single-select or scale question, biggest
 * first. Options that were offered but never chosen stay as zero rows: a
 * silent option is a finding, and dropping it makes the list look as though the
 * only answers available were the ones people gave.
 */
function surveySingleDist_(recs, q) {
  var counts = {}, order = {}, extra = 1000, i, k;
  for (i = 0; q.options && i < q.options.length; i++) {
    counts[q.options[i]] = 0;
    order[q.options[i]] = i;
  }
  var answered = 0;
  for (i = 0; i < recs.length; i++) {
    var v = surveyAnswerText_(recs[i], q.id);
    if (v === '') continue;
    k = surveyBucket_(v);
    if (k === '') continue;
    answered++;
    if (counts[k] === undefined) { counts[k] = 0; order[k] = extra++; }
    counts[k]++;
  }
  var keys = Object.keys(counts);
  var max = 0;
  for (i = 0; i < keys.length; i++) { if (counts[keys[i]] > max) max = counts[keys[i]]; }
  keys.sort(function (a, b) {
    if (counts[b] !== counts[a]) return counts[b] - counts[a];
    return order[a] - order[b];
  });
  var rows = [];
  for (i = 0; i < keys.length; i++) {
    rows.push([keys[i], counts[keys[i]], surveyPct_(counts[keys[i]], answered), surveyBar_(counts[keys[i]], max)]);
  }
  return { rows: rows, answered: answered, counts: counts };
}

/**
 * Counts for one multi-select question.
 *
 * The denominator is RESPONDENTS, not selections. Someone who ticks four boxes
 * is one person with four problems, not four people; dividing by selections
 * would make a widely shared problem look rarer the more OTHER problems people
 * also had. The consequence is that these percentages sum past 100, which is
 * why every multi block says "% of respondents" in its note instead of a bare
 * "%" -- somebody will otherwise read a column that totals 240% as broken.
 *
 * A repeated selection inside one response counts once, so a duplicated value
 * in a hand-edited blob cannot push an option past its respondent count.
 */
function surveyMultiDist_(recs, q) {
  var counts = {}, order = {}, extra = 1000, i, k;
  for (i = 0; q.options && i < q.options.length; i++) {
    counts[q.options[i]] = 0;
    order[q.options[i]] = i;
  }
  var respondents = 0, selections = 0;
  for (i = 0; i < recs.length; i++) {
    var list = surveyList_(recs[i].answers, q.id);
    if (!list.length) continue;
    respondents++;
    var seen = {};
    for (var s = 0; s < list.length; s++) {
      k = surveyBucket_(list[s]);
      if (k === '' || seen[k]) continue;
      seen[k] = true;
      if (counts[k] === undefined) { counts[k] = 0; order[k] = extra++; }
      counts[k]++;
      selections++;
    }
  }
  var keys = Object.keys(counts);
  var max = 0;
  for (i = 0; i < keys.length; i++) { if (counts[keys[i]] > max) max = counts[keys[i]]; }
  keys.sort(function (a, b) {
    if (counts[b] !== counts[a]) return counts[b] - counts[a];
    return order[a] - order[b];
  });
  var rows = [];
  for (i = 0; i < keys.length; i++) {
    rows.push([keys[i], counts[keys[i]], surveyPct_(counts[keys[i]], respondents), surveyBar_(counts[keys[i]], max)]);
  }
  return { rows: rows, respondents: respondents, selections: selections, counts: counts };
}

/** Mean, median and n for the usefulness scale. */
function surveyUsefulnessStats_(recs) {
  var vals = [], i;
  for (i = 0; i < recs.length; i++) {
    if (recs[i].usefulness !== null) vals.push(recs[i].usefulness);
  }
  if (!vals.length) return { n: 0, mean: null, median: null, missing: recs.length };
  vals.sort(function (a, b) { return a - b; });
  var sum = 0;
  for (i = 0; i < vals.length; i++) sum += vals[i];
  var mid = Math.floor(vals.length / 2);
  var median = (vals.length % 2) ? vals[mid] : (vals[mid - 1] + vals[mid]) / 2;
  return {
    n: vals.length,
    mean: Math.round(sum / vals.length * 100) / 100,
    median: median,
    missing: recs.length - vals.length
  };
}

// TOMBSTONE, 2026-07-26. surveyPriceCrossTab_() used to cross fair_price
// against willingness_to_pay, and the interesting cell was the disagreement:
// someone who said "I would not pay for this" and then priced it at $25 to $50
// was telling you the tool is worth money to somebody, just not to them.
// willingness_to_pay was cut in v2, so there is nothing left to cross it
// against and that particular reading is simply gone.
//
// It is replaced by fair_price crossed against the USEFULNESS BAND rather than
// by a bare price distribution, and the choice is deliberate. A price
// distribution on its own answers "what number do people say", which is close
// to worthless from a self-selected sample: everyone says a low number. Split
// by whether the respondent rated the tool 4-5 or 1-3, it answers the question
// the cut question was actually there to answer -- does perceived value track
// experienced value -- and it does so with a number the respondent had no
// reason to shade, because they rated usefulness before they saw the price
// question and did not know the two would be put side by side.
//
// It is arguably the better instrument anyway. Stated purchase intent from
// someone who has paid nothing is the softest data in any survey; a price named
// by someone who found the thing genuinely useful is at least anchored to an
// experience. Read the 4-5 column: if the people who liked it price it the same
// as the people who did not, the tool has no pricing power yet.

/** 4-5 is high, 1-3 is low, anything else is unrated. */
function surveyUsefulnessBand_(u) {
  if (u === null || u === undefined || isNaN(u)) return 'No rating';
  if (u >= 4) return 'Rated 4-5 (found it useful)';
  return 'Rated 1-3 (did not)';
}

function surveyPriceByUsefulness_(recs) {
  var q = surveyQuestion_('fair_price');
  var noAns = '(no answer)';
  var bands = ['Rated 4-5 (found it useful)', 'Rated 1-3 (did not)', 'No rating'];

  var rowKeys = q.options.slice();
  rowKeys.push(SURVEY_OTHER_BUCKET);
  rowKeys.push(noAns);

  var cell = {}, rowTot = {}, useSum = {}, useN = {}, colTot = {}, i, b;
  for (i = 0; i < bands.length; i++) colTot[bands[i]] = 0;
  for (i = 0; i < recs.length; i++) {
    var p = surveyBucket_(surveyAnswerText_(recs[i], 'fair_price')) || noAns;
    if (rowKeys.indexOf(p) === -1) rowKeys.push(p);
    b = surveyUsefulnessBand_(recs[i].usefulness);
    cell[p + ' >< ' + b] = (cell[p + ' >< ' + b] || 0) + 1;
    rowTot[p] = (rowTot[p] || 0) + 1;
    colTot[b] = (colTot[b] || 0) + 1;
    if (recs[i].usefulness !== null) {
      useSum[p] = (useSum[p] || 0) + recs[i].usefulness;
      useN[p] = (useN[p] || 0) + 1;
    }
  }

  // Empty price rows are dropped so the matrix stays small enough to read
  // without scrolling. The three band columns are ALWAYS shown, even at zero:
  // an empty "Rated 4-5" column is the single most informative cell on the
  // block and it has to be visibly empty rather than absent.
  var liveRows = [];
  for (i = 0; i < rowKeys.length; i++) { if (rowTot[rowKeys[i]]) liveRows.push(rowKeys[i]); }

  var header = ['Fair price (row) vs how useful they found it (col)'];
  for (i = 0; i < bands.length; i++) header.push(bands[i]);
  header.push('Total');
  header.push('Mean usefulness');

  var rows = [], grand = 0;
  for (var rr = 0; rr < liveRows.length; rr++) {
    var pk = liveRows[rr];
    var line = [pk];
    for (i = 0; i < bands.length; i++) line.push(cell[pk + ' >< ' + bands[i]] || 0);
    line.push(rowTot[pk] || 0);
    line.push(useN[pk] ? Math.round(useSum[pk] / useN[pk] * 100) / 100 : SURVEY_DASH);
    rows.push(line);
    grand += rowTot[pk] || 0;
  }
  if (liveRows.length) {
    var totalLine = ['Total'];
    for (i = 0; i < bands.length; i++) totalLine.push(colTot[bands[i]] || 0);
    totalLine.push(grand);
    var all = surveyUsefulnessStats_(recs);
    totalLine.push(all.mean === null ? SURVEY_DASH : all.mean);
    rows.push(totalLine);
  }
  return { header: header, rows: rows };
}

// TOMBSTONE, 2026-07-26. surveyRoleRows_() used to split mean usefulness and
// top problem by `role`, on the argument that a resident formatting a case
// report at midnight and an attending checking a journal shortlist are not the
// same customer. `role` was cut in v2, so the segment does not exist and the
// block is gone rather than left rendering a single "(no answer)" row.
// `tools_used` is the only per-respondent attribute left and it is a weaker
// cut -- it says what someone touched, not who they are -- so it is used for
// context beside the free text rather than promoted into a segment table.

// TOMBSTONE, 2026-07-26. surveyMissingJournalRows_() listed every journal a
// respondent said was missing, deduplicated case- and whitespace-insensitively,
// as a direct build queue: adding a journal is cheap and one request was reason
// enough. The `journal_available` and `missing_journal` questions were both cut
// in v2, so there is no longer any input to it.
//
// THIS IS A REAL LOSS and it is worth being explicit about, because it is the
// one block here that generated work rather than describing it. Nothing else in
// the survey tells us which journals people wanted and could not find. If the
// question is ever reinstated: restore a `missing_journal` text question in
// lib/studio/survey.ts, add it to SURVEY_QUESTIONS above, and the block was a
// counted list keyed on the lowercased, whitespace-collapsed answer while
// displaying the first spelling seen verbatim -- never title-cased, because a
// tidied-up journal name is one you cannot search for.

/**
 * All free text, with the context needed to weigh it.
 *
 * `most_important_fix` is the only open question left after v2 cut
 * `anything_else`. Usefulness and tools-used sit beside each answer because
 * "add BibTeX export" from someone who rated the tool 5 and the same sentence
 * from someone who rated it 1 are different messages, and because a complaint
 * about the formatter from someone who only used the Finder is a signal about
 * the answer rather than about the formatter. These two replace the `role`
 * column that used to fill this slot.
 *
 * Sub-30-second responses are flagged LOW-CONFIDENCE and sorted to the bottom
 * rather than removed: the refill was the incentive to fill this in fast, so
 * speed-run answers exist and pretending otherwise would be editing the data --
 * but they should not be the first thing read.
 */
function surveyFreeTextRows_(recs) {
  var ok = [], low = [], i;
  for (i = 0; i < recs.length; i++) {
    var x = recs[i];
    var fix = surveyText_(x.answers, 'most_important_fix');
    if (!fix) continue;
    var row = [
      surveySafeText_(fix),
      x.lowConfidence ? 'LOW-CONFIDENCE' : '',
      x.usefulness === null ? SURVEY_DASH : x.usefulness,
      surveyToolsText_(x) || SURVEY_DASH,
      x.email,
      x.duration === null ? SURVEY_DASH : x.duration,
      surveyStamp_(x.created)
    ];
    if (x.lowConfidence) low.push(row); else ok.push(row);
  }
  // recs arrive newest-first, so each half stays newest-first.
  return ok.concat(low);
}

/**
 * Every 'Other: ...' write-in, verbatim, with the question it answers.
 *
 * Pulled out because a write-in is by definition something the option list did
 * not anticipate, which makes it the highest-information answer in the set and
 * the one most likely to change what gets built. Inside a distribution it would
 * be one anonymous line reading "Other (write-in)  3".
 *
 * Only questions carrying `allowOther` are scanned. After v2 that is `problems`
 * alone -- `tools_used` is a multi-select but has no write-in field, and every
 * other question that had one was cut -- so looping the whole question set
 * would mean six ids that can never produce a match. The flag is read from the
 * mirror rather than hardcoding 'problems', so restoring a write-in elsewhere
 * only means setting allowOther there.
 */
function surveyWriteInRows_(recs) {
  var rows = [], i, k;
  for (i = 0; i < recs.length; i++) {
    var x = recs[i];
    for (var qi = 0; qi < SURVEY_QUESTIONS.length; qi++) {
      var q = SURVEY_QUESTIONS[qi];
      if (!q.allowOther) continue;
      if (q.type !== 'single' && q.type !== 'multi') continue;
      var values = (q.type === 'multi')
        ? surveyList_(x.answers, q.id)
        : [surveyAnswerText_(x, q.id)];
      for (k = 0; k < values.length; k++) {
        var v = values[k];
        if (!v || String(v).indexOf(SURVEY_OTHER_STEM) !== 0) continue;
        var text = String(v).substring(SURVEY_OTHER_STEM.length).replace(/^\s+|\s+$/g, '');
        // An empty write-in is not an answer. See surveyBucket_.
        if (!text) continue;
        rows.push([
          surveySafeText_(text),
          q.header,
          x.usefulness === null ? SURVEY_DASH : x.usefulness,
          surveyToolsText_(x) || SURVEY_DASH,
          surveyStamp_(x.created)
        ]);
      }
    }
  }
  return rows;
}

// ----------------------------------------------------------- analytics tab ---

/**
 * The report. Everything above, laid out in reading order.
 *
 * The order is deliberate and is roughly "what would make you change a
 * decision", most consequential first: the funnel (is the gate working at all),
 * then whether the thing is useful, then what is broken, then what it is worth,
 * then the raw words.
 *
 * Grouped by survey version at the top and warned about loudly when more than
 * one is present, per the standing rule in lib/studio/survey.ts: a reworded
 * question pooled with its old self produces a confident wrong answer. That
 * warning is not hypothetical any more -- v2 cut five questions and changed the
 * fair_price option list, so a v1 response pooled with a v2 response really does
 * produce nonsense in the pricing block and phantom blanks everywhere else. The
 * blocks do NOT split by version; the warning tells you to filter the dump.
 *
 * ADMIN ADDRESSES ARE EXCLUDED FROM EVERY FIGURE ON THIS TAB, and the count of
 * what was excluded is printed in the Overview so the exclusion is visible
 * rather than merely applied. The raw dump keeps them, so the two tabs will
 * disagree on the total by exactly that number, on purpose.
 *
 * Nothing in here throws on bad data. Every read of the blob goes through the
 * defended helpers above, an empty set short-circuits to a clean sheet, and a
 * question that has disappeared from the mirror degrades to an empty block.
 * This runs inside refreshHub's try/catch, and a throw here would cost the
 * toast and the other Studio tab as well as this one.
 */
function writeSurveyAnalyticsSheet_(ss, responses, quotaRows, jobs) {
  var sh = ss.getSheetByName(STUDIO_SURVEY_ANALYTICS_SHEET) ||
           ss.insertSheet(STUDIO_SURVEY_ANALYTICS_SHEET);
  sh.clear();

  var all = surveyRecords_(responses);
  var recs = [], adminSkipped = 0, i;
  for (i = 0; i < all.length; i++) {
    if (all[i].isAdmin) adminSkipped++; else recs.push(all[i]);
  }

  sh.getRange(1, 1).setValue('OSCRSJ ' + SURVEY_DASH + ' Submission Studio survey analytics')
    .setFontSize(14).setFontWeight('bold').setFontColor('#3D2A18');
  sh.getRange(2, 1).setValue(
      'Updated ' + fmtNow_() + '     Rebuilt from the database on every refresh, so edits here are ' +
      'overwritten. Admin addresses excluded throughout. Collection runs to September 1, 2026.')
    .setFontStyle('italic').setFontColor('#664930');

  var funnelHeader = ['Funnel step', 'Count', 'Conversion', 'Of what'];
  var funnelNote =
    'The highlighted row is the one that matters: of the people the gate actually stopped, what share ' +
    'paid the toll. Since 2026-07-26 the allowance is ' + STUDIO_FREE_RUNS + ' completed runs per rolling ' +
    STUDIO_QUOTA_WINDOW_DAYS + ' days and the survey is no longer the only way back -- waiting also ' +
    'works -- so a low conversion may mean people waited rather than that the survey is unappealing. ' +
    'Read it together with "ran again after the refill". Denominators differ by row and each is named.';

  // Zero responses is not an error state, it is a finding -- and the funnel is
  // where you see it, so the funnel is written even when nothing else can be.
  if (!recs.length) {
    sh.getRange(4, 1).setValue('No survey responses yet.')
      .setFontWeight('bold').setFontSize(12).setFontColor('#3D2A18');
    sh.getRange(5, 1).setValue(
        'Nobody has completed the unlock survey' +
        (adminSkipped ? ' (' + adminSkipped + ' admin response(s) excluded)' : '') +
        '. The funnel below still reads, and is the thing to look at: if addresses are hitting the ' +
        'allowance and none of them are answering, the gate is costing runs without buying feedback.')
      .setFontStyle('italic').setFontColor('#664930');
    surveyBlock_(sh, 7, 'Gate funnel', funnelHeader,
                 surveyFunnelRows_(recs, quotaRows, jobs), funnelNote);
    surveySetWidths_(sh);
    return;
  }

  var r = 4;

  // ---- Overview ----
  var lowCount = 0, followYes = 0, grantedCount = 0, distinct = {}, last7 = 0;
  var week = Date.now() - 7 * 24 * 60 * 60 * 1000;
  for (i = 0; i < recs.length; i++) {
    if (recs[i].lowConfidence) lowCount++;
    if (recs[i].followUp === 'yes') followYes++;
    if (recs[i].granted) grantedCount++;
    if (recs[i].email) distinct[recs[i].email] = true;
    if (recs[i].created && Date.parse(recs[i].created) >= week) last7++;
  }
  var durs = [];
  for (i = 0; i < recs.length; i++) { if (recs[i].duration !== null) durs.push(recs[i].duration); }
  durs.sort(function (a, b) { return a - b; });
  var medDur = durs.length
    ? (durs.length % 2 ? durs[Math.floor(durs.length / 2)]
        : (durs[durs.length / 2 - 1] + durs[durs.length / 2]) / 2)
    : null;

  r = surveyBlock_(sh, r, 'Overview', ['Measure', 'Value'], [
    ['Total responses', recs.length],
    ['Distinct respondents (by email)', Object.keys(distinct).length],
    ['Responses in the last 7 days', last7],
    ['Bought a refill with this response', grantedCount],
    ['Gave follow-up permission', followYes + '  (' + surveyPct_(followYes, recs.length) + ')'],
    ['Median completion time (sec)', medDur === null ? SURVEY_DASH : medDur],
    ['Flagged low-confidence (under ' + SURVEY_LOW_CONFIDENCE_SECONDS + 's)',
     lowCount + '  (' + surveyPct_(lowCount, recs.length) + ')'],
    ['Admin responses excluded from this tab', adminSkipped]
  ], null);

  // ---- Versions ----
  var vCounts = {}, vKeys = [];
  for (i = 0; i < recs.length; i++) {
    var vv = recs[i].version || '(none recorded)';
    if (vCounts[vv] === undefined) { vCounts[vv] = 0; vKeys.push(vv); }
    vCounts[vv]++;
  }
  vKeys.sort(function (a, b) { return vCounts[b] - vCounts[a]; });
  var vRows = [];
  for (i = 0; i < vKeys.length; i++) {
    vRows.push([vKeys[i], vCounts[vKeys[i]], surveyPct_(vCounts[vKeys[i]], recs.length)]);
  }
  r = surveyBlock_(sh, r, 'Responses by survey version',
                   ['Survey version', 'Responses', '% of responses'], vRows, null);

  if (vKeys.length > 1) {
    sh.getRange(r - 1, 1).setValue(
        'WARNING: ' + vKeys.length + ' survey versions are present and every block below POOLS them. ' +
        'v2 cut five questions and changed the fair_price options, so pooled pricing figures are ' +
        'meaningless and the cut questions show as blanks rather than as absences. Filter the raw dump ' +
        'tab to a single version before acting on anything here.')
      .setFontWeight('bold').setBackground('#F4CCCC').setFontColor('#3D2A18');
    r++;
  }
  var unknownVersion = false;
  for (i = 0; i < vKeys.length; i++) {
    if (vKeys[i] !== SURVEY_VERSION_MIRRORED && vKeys[i] !== '(none recorded)') unknownVersion = true;
  }
  if (unknownVersion) {
    sh.getRange(r - 1, 1).setValue(
        'WARNING: responses carry a survey version this script was not written against (mirror: ' +
        SURVEY_VERSION_MIRRORED + '). Unrecognised answers are still counted, but options added since ' +
        'are not shown as zero rows and renamed ones will appear twice. Update SURVEY_QUESTIONS here.')
      .setFontWeight('bold').setBackground('#FFF2CC').setFontColor('#3D2A18');
    r++;
  }

  // ---- Funnel ----
  var fRows = surveyFunnelRows_(recs, quotaRows, jobs);
  r = surveyBlock_(sh, r, 'Gate funnel', funnelHeader, fRows, funnelNote);
  // Call out the two rows the block exists to compare, rather than letting them
  // rank equally with the other thirteen. Matched on label, not on index, so
  // adding a step to the funnel cannot silently highlight the wrong line.
  var fStart = r - 1 - fRows.length;
  for (i = 0; i < fRows.length; i++) {
    var flabel = String(fRows[i][0]);
    if (flabel.indexOf('Ever hit the allowance') === 0 || flabel.indexOf('THE GATE CONVERSION') !== -1) {
      sh.getRange(fStart + i, 1, 1, funnelHeader.length).setBackground('#FFF6E5');
    }
  }

  // ---- Usefulness ----
  var us = surveyUsefulnessStats_(recs);
  r = surveyBlock_(sh, r, 'Usefulness', ['Measure', 'Value'], [
    ['Mean', us.mean === null ? SURVEY_DASH : us.mean],
    ['Median', us.median === null ? SURVEY_DASH : us.median],
    ['Answered', us.n],
    ['No answer', us.missing]
  ], 'Scale of 1 (not useful at all) to 5 (extremely useful).');

  var uDist = surveySingleDist_(recs, surveyQuestion_('usefulness'));
  var scaleLabels = ['', '1  Not useful at all', '2', '3', '4', '5  Extremely useful'];
  var uMax = 0, uRows = [];
  for (i = 1; i <= 5; i++) { if ((uDist.counts[String(i)] || 0) > uMax) uMax = uDist.counts[String(i)] || 0; }
  for (i = 1; i <= 5; i++) {
    var un = uDist.counts[String(i)] || 0;
    uRows.push([scaleLabels[i], un, surveyPct_(un, uDist.answered), surveyBar_(un, uMax)]);
  }
  r = surveyBlock_(sh, r, 'Usefulness distribution',
                   ['Score', 'Responses', '% of those who answered', 'Shape'], uRows,
                   'In score order, not count order: a scale is only readable as a shape. n = ' +
                   uDist.answered + '.');

  // ---- Problems ----
  var pDist = surveyMultiDist_(recs, surveyQuestion_('problems'));
  var nothing = pDist.counts['Nothing went wrong'] || 0;
  r = surveyBlock_(sh, r, 'Problems, ranked (the fix queue)',
                   ['Problem', 'Respondents', '% of respondents', 'Shape'], pDist.rows,
                   'Multi-select, so these sum past 100%: ' + pDist.selections + ' selections from ' +
                   pDist.respondents + ' respondents. ' + nothing + ' respondent(s), ' +
                   surveyPct_(nothing, pDist.respondents) + ', said NOTHING went wrong -- that share ' +
                   'is the honest ceiling on how well the pipeline is currently doing.');

  // ---- Pricing ----
  var fpQ = surveyQuestion_('fair_price');
  var fpDist = surveySingleDist_(recs, fpQ);
  r = surveyBlock_(sh, r, 'Fair price',
                   ['Price', 'Responses', '% of those who answered', 'Shape'], fpDist.rows,
                   'What people say a manuscript is worth. n = ' + fpDist.answered + ' answered. ' +
                   'Note that v2 removed the "It should be free" option, so its absence here means it ' +
                   'was never offered, not that nobody wanted it.');

  var xtab = surveyPriceByUsefulness_(recs);
  r = surveyBlock_(sh, r, 'Fair price by how useful they found it', xtab.header, xtab.rows,
                   'The willingness-to-pay question was cut, so this is the closest surviving read on ' +
                   'intent -- and a better one: a price named by someone who found the tool genuinely ' +
                   'useful is anchored to an experience, while stated intent from someone who paid ' +
                   'nothing is the softest data in any survey. Read the "Rated 4-5" column. If the ' +
                   'people who liked it price it the same as the people who did not, there is no ' +
                   'pricing power here yet.');

  // ---- Per-question distributions ----
  sh.getRange(r, 1).setValue('Per-question distributions')
    .setFontWeight('bold').setFontSize(12).setFontColor('#3D2A18');
  r++;
  sh.getRange(r, 1).setValue(
      'Every remaining closed question. Usefulness, Problems and Fair Price have their own blocks ' +
      'above and are not repeated.')
    .setFontStyle('italic').setFontColor('#664930');
  r += 2;

  for (i = 0; i < SURVEY_QUESTIONS.length; i++) {
    var q = SURVEY_QUESTIONS[i];
    if (q.type === 'text') continue;
    if (q.id === 'usefulness' || q.id === 'problems' || q.id === 'fair_price') continue;
    if (q.type === 'multi') {
      var md = surveyMultiDist_(recs, q);
      r = surveyBlock_(sh, r, q.header, ['Option', 'Respondents', '% of respondents', 'Shape'], md.rows,
                       'Multi-select: percentages are of the ' + md.respondents +
                       ' respondent(s) who answered this question, and sum past 100% by design (' +
                       md.selections + ' selections).');
    } else {
      var sd = surveySingleDist_(recs, q);
      r = surveyBlock_(sh, r, q.header, ['Option', 'Responses', '% of those who answered', 'Shape'],
                       sd.rows, 'Pick one. n = ' + sd.answered + ' answered.');
    }
  }

  // ---- Free text ----
  var ft = surveyFreeTextRows_(recs);
  r = surveyBlock_(sh, r, 'Free text (the single most important fix)',
                   ['Most important fix', 'Flag', 'Usefulness', 'Tools used', 'Email',
                    'Duration (sec)', 'Submitted'], ft,
                   'The only open question left after v2. Newest first. LOW-CONFIDENCE means the whole ' +
                   'survey was completed in under ' + SURVEY_LOW_CONFIDENCE_SECONDS + ' seconds, which ' +
                   'usually means it was speed-run for the refill; those rows sink to the bottom, they ' +
                   'are not removed.');
  if (ft.length) {
    var ftStart = r - 1 - ft.length;
    sh.getRange(ftStart, 1, ft.length, 1).setWrap(true);
    sh.getRange(ftStart, 1, ft.length, 7).setVerticalAlignment('top');
  }

  // ---- Write-ins ----
  var wi = surveyWriteInRows_(recs);
  r = surveyBlock_(sh, r, 'Write-in answers (everything typed into "Other")',
                   ['Write-in answer', 'Question', 'Usefulness', 'Tools used', 'Submitted'], wi,
                   'Stored as "' + SURVEY_OTHER_PREFIX + '<text>"; the prefix is stripped here. Only ' +
                   'the Problems question can carry one after v2. These are the answers the option ' +
                   'list did not anticipate, which is exactly why they are not left buried in an ' +
                   '"Other" bucket in the distribution above.');
  if (wi.length) sh.getRange(r - 1 - wi.length, 1, wi.length, 1).setWrap(true);

  surveySetWidths_(sh);
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
