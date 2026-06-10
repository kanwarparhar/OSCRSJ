#!/usr/bin/env python3
"""
Build the OSCRSJ SANRA Self-Rating fillable PDF.

Output: public/downloads/oscrsj-sanra-self-rating.pdf

SANRA — Scale for the Assessment of Narrative Review Articles
Baethge C, Goldbeck-Wood S, Mertens S. Research Integrity and Peer Review (2019) 4:5.
https://doi.org/10.1186/s41073-019-0064-8  — CC BY 4.0.

The six item titles are reproduced verbatim from the published scale. The 0/1/2
anchor guidance is a faithful summary; the authoritative anchor definitions and
worked examples live in the official "explanations and instructions" companion
document referenced on the cover page.

Mirrors the visual pattern of the OSCRSJ CARE / JBI / PRISMA checklist downloads
using the Neutral Elegance palette.
"""
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib.colors import HexColor
from reportlab.pdfgen import canvas
from reportlab.pdfbase.pdfmetrics import stringWidth

# ---- Neutral Elegance palette ----
INK        = HexColor("#120D08")
BROWN_DARK = HexColor("#3D2A18")
BROWN      = HexColor("#664930")
TAUPE      = HexColor("#CCBEB1")
PEACH      = HexColor("#F0C49A")
CREAM      = HexColor("#FDFBF8")
CREAM_ALT  = HexColor("#F8F4ED")
WHITE      = HexColor("#FFFFFF")

PAGE_W, PAGE_H = letter
M = 0.85 * inch          # page margin
CONTENT_W = PAGE_W - 2 * M

OUT = "public/downloads/oscrsj-sanra-self-rating.pdf"

# The six SANRA items — titles verbatim from the published scale (Fig. 1),
# with a faithful 0 / 1 / 2 anchor summary for rater calibration.
ITEMS = [
    ("Justification of the article's importance for the readership",
     "0 = not satisfied  ·  1 = partially  ·  2 = the importance is explicitly justified "
     "(e.g. burden of disease, controversy, or practical relevance to the readership)."),
    ("Statement of concrete aims or formulation of questions",
     "0 = not satisfied  ·  1 = partially  ·  2 = concrete aims are stated or a specific "
     "question / objective is formulated."),
    ("Description of the literature search",
     "0 = not satisfied  ·  1 = partially  ·  2 = the search is described — sources searched "
     "plus search terms, time period, or inclusion/exclusion criteria."),
    ("Referencing",
     "0 = not satisfied  ·  1 = partially  ·  2 = key statements are supported by appropriate, "
     "specific references; no broken or irrelevant citations."),
    ("Scientific reasoning (e.g. incorporation of appropriate evidence)",
     "0 = not satisfied  ·  1 = partially  ·  2 = conclusions follow from the evidence; the "
     "relevant level of evidence is weighed rather than asserted."),
    ("Appropriate presentation of data",
     "0 = not satisfied  ·  1 = partially  ·  2 = relevant endpoint data are presented "
     "appropriately (e.g. effect sizes with measures of precision)."),
]

c = canvas.Canvas(OUT, pagesize=letter)
c.setTitle("OSCRSJ SANRA Self-Rating — Narrative Review Quality Self-Assessment")
c.setAuthor("Orthopedic Surgery Case Reports & Series Journal (OSCRSJ)")
c.setSubject("SANRA self-rating form for Narrative Review submissions (Baethge et al. 2019, CC BY 4.0)")


def wrap(text, font, size, max_w):
    words = text.split()
    lines, cur = [], ""
    for w in words:
        trial = (cur + " " + w).strip()
        if stringWidth(trial, font, size) <= max_w:
            cur = trial
        else:
            if cur:
                lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines


def draw_para(x, y, text, font, size, max_w, leading, color=INK):
    c.setFont(font, size)
    c.setFillColor(color)
    for ln in wrap(text, font, size, max_w):
        c.drawString(x, y, ln)
        y -= leading
    return y


def page_bg():
    c.setFillColor(CREAM)
    c.rect(0, 0, PAGE_W, PAGE_H, stroke=0, fill=1)


def header(kicker, title_lines):
    page_bg()
    y = PAGE_H - M
    c.setFillColor(BROWN)
    c.setFont("Helvetica-Bold", 8.5)
    c.drawString(M, y, kicker.upper())
    # wordmark, right
    c.setFont("Helvetica-Bold", 8.5)
    c.setFillColor(BROWN)
    c.drawRightString(PAGE_W - M, y, "OSCRSJ")
    y -= 6
    c.setStrokeColor(TAUPE); c.setLineWidth(1)
    c.line(M, y, PAGE_W - M, y)
    y -= 26
    c.setFillColor(BROWN_DARK)
    c.setFont("Times-Bold", 19)
    for ln in title_lines:
        c.drawString(M, y, ln)
        y -= 22
    return y - 4


def footer(page_label):
    c.setStrokeColor(TAUPE); c.setLineWidth(1)
    c.line(M, M - 6, PAGE_W - M, M - 6)
    c.setFont("Helvetica", 7.5)
    c.setFillColor(BROWN)
    c.drawString(M, M - 18, "OSCRSJ · Orthopedic Surgery Case Reports & Series Journal · oscrsj.com")
    c.drawRightString(PAGE_W - M, M - 18, page_label)


# =====================================================================
# PAGE 1 — COVER / INSTRUCTIONS
# =====================================================================
y = header("Narrative Review · Required Self-Assessment",
           ["SANRA Self-Rating"])

y = draw_para(M, y,
    "Scale for the Assessment of Narrative Review Articles", "Times-Italic", 12, CONTENT_W, 16, BROWN_DARK)
y -= 6

intro = ("Every Narrative Review submitted to OSCRSJ must include a completed SANRA self-rating. "
         "SANRA is a brief, validated instrument for appraising the quality of non-systematic "
         "(narrative) reviews. Score each of the six items below from 0 to 2 and report the sum "
         "(maximum 12). Authors should rate their own manuscript honestly; reviewers re-score the "
         "same six items during double-blind peer review.")
y = draw_para(M, y, intro, "Helvetica", 9.5, CONTENT_W, 13)
y -= 8

# Entry-threshold callout
box_h = 30
c.setFillColor(CREAM_ALT)
c.roundRect(M, y - box_h, CONTENT_W, box_h, 5, stroke=0, fill=1)
c.setFillColor(BROWN_DARK); c.setFont("Helvetica-Bold", 9.5)
c.drawString(M + 12, y - 13, "OSCRSJ entry threshold:  sum score ≥ 8 / 12 to enter peer review.")
c.setFillColor(BROWN); c.setFont("Helvetica", 8.5)
c.drawString(M + 12, y - 24,
             "Manuscripts scoring below 8 are returned for improvement before review. Scoring: 0 = low standard, 1 = intermediate, 2 = high standard.")
y -= box_h + 16

# Item definitions
c.setFillColor(BROWN_DARK); c.setFont("Helvetica-Bold", 10)
c.drawString(M, y, "The six SANRA items")
y -= 16
for i, (title, anchor) in enumerate(ITEMS, 1):
    c.setFillColor(BROWN_DARK); c.setFont("Helvetica-Bold", 9.5)
    num_w = 16
    c.drawString(M, y, f"{i}.")
    for j, ln in enumerate(wrap(title, "Helvetica-Bold", 9.5, CONTENT_W - num_w)):
        c.drawString(M + num_w, y, ln); y -= 12.5
    y = draw_para(M + num_w, y, anchor, "Helvetica", 8.3, CONTENT_W - num_w, 10.5, BROWN)
    y -= 7

y -= 2
# Attribution block
c.setStrokeColor(TAUPE); c.setLineWidth(0.75)
c.line(M, y, PAGE_W - M, y)
y -= 14
att_title = "Source & attribution"
c.setFillColor(BROWN_DARK); c.setFont("Helvetica-Bold", 8.5)
c.drawString(M, y, att_title); y -= 12
attribution = ("SANRA — Scale for the Assessment of Narrative Review Articles. "
               "Baethge C, Goldbeck-Wood S, Mertens S. Research Integrity and Peer Review (2019) 4:5. "
               "doi:10.1186/s41073-019-0064-8. © The Author(s) 2019. Distributed under the Creative "
               "Commons Attribution 4.0 International License (CC BY 4.0): "
               "https://creativecommons.org/licenses/by/4.0/. The item titles are reproduced verbatim; "
               "the 0/1/2 anchor guidance is summarised. The authoritative anchor definitions and worked "
               "examples are in the official SANRA “explanations and instructions” document "
               "(open access via the publisher). OSCRSJ reproduces the scale unmodified for self-rating and peer review.")
y = draw_para(M, y, attribution, "Helvetica", 7.3, CONTENT_W, 9.5, BROWN)

footer("Page 1 of 2 — instructions")
c.showPage()

# =====================================================================
# PAGE 2 — FILLABLE FORM
# =====================================================================
y = header("Narrative Review · Fillable Self-Rating Form",
           ["SANRA Self-Rating — Score Sheet"])
y -= 2

form = c.acroForm

# --- Manuscript / rater metadata fields ---
def text_field(name, x, y, w, h, value="", size=9, tooltip=""):
    form.textfield(name=name, tooltip=tooltip or name, x=x, y=y, width=w, height=h,
                   borderColor=TAUPE, fillColor=WHITE, textColor=INK,
                   borderWidth=0.75, forceBorder=True, fontSize=size, value=value)

label_font = ("Helvetica-Bold", 8.5)
fh = 16  # field height
# Row 1: Manuscript title
c.setFillColor(BROWN_DARK); c.setFont(*label_font)
c.drawString(M, y, "Manuscript title")
y -= fh + 2
text_field("manuscript_title", M, y, CONTENT_W, fh, tooltip="Manuscript title")
y -= 16
# Row 2: Manuscript ID + Date
half = (CONTENT_W - 14) / 2
c.setFillColor(BROWN_DARK); c.setFont(*label_font)
c.drawString(M, y, "Manuscript ID")
c.drawString(M + half + 14, y, "Date")
y -= fh + 2
text_field("manuscript_id", M, y, half, fh, tooltip="Manuscript ID")
text_field("rating_date", M + half + 14, y, half, fh, tooltip="Date (YYYY-MM-DD)")
y -= 16
# Row 3: Rated by + Role
c.setFillColor(BROWN_DARK); c.setFont(*label_font)
c.drawString(M, y, "Rated by")
c.drawString(M + half + 14, y, "Role (author / reviewer / editor)")
y -= fh + 2
text_field("rated_by", M, y, half, fh, tooltip="Rater name")
text_field("rater_role", M + half + 14, y, half, fh, tooltip="Author / Reviewer / Editor")
y -= 22

# --- Column header for the score grid ---
c.setStrokeColor(TAUPE); c.setLineWidth(1)
c.line(M, y + 6, PAGE_W - M, y + 6)
score_col_x = PAGE_W - M - 150
c.setFillColor(BROWN_DARK); c.setFont("Helvetica-Bold", 8.5)
c.drawString(M, y - 4, "SANRA item")
# 0/1/2 column headers centered over each radio
radio_size = 13
gap = 46
centers = [score_col_x + 8, score_col_x + 8 + gap, score_col_x + 8 + 2 * gap]
for lab, cx in zip(["0", "1", "2"], centers):
    c.drawCentredString(cx + radio_size / 2, y - 4, lab)
y -= 10
c.setStrokeColor(TAUPE); c.setLineWidth(0.75)
c.line(M, y, PAGE_W - M, y)
y -= 6

# --- Six item rows with radio groups ---
item_text_w = score_col_x - M - 10
for i, (title, _anchor) in enumerate(ITEMS, 1):
    title_lines = wrap(f"{i}. {title}", "Helvetica", 9, item_text_w)
    row_h = max(len(title_lines) * 11 + 8, radio_size + 10)
    row_top = y
    # item text
    ty = row_top - 9
    c.setFillColor(INK); c.setFont("Helvetica", 9)
    for ln in title_lines:
        c.drawString(M, ty, ln); ty -= 11
    # radios — vertically centered in the row
    ry = row_top - (row_h / 2) - radio_size / 2 + 2
    gname = f"item_{i}_score"
    for val, cx in zip(["0", "1", "2"], centers):
        form.radio(name=gname, tooltip=f"Item {i} = {val}", value=val,
                   selected=False, x=cx, y=ry, size=radio_size,
                   buttonStyle="circle", borderColor=BROWN, fillColor=WHITE,
                   textColor=BROWN_DARK, borderWidth=0.9, forceBorder=True)
    y = row_top - row_h
    c.setStrokeColor(CREAM_ALT if i % 2 else TAUPE); c.setLineWidth(0.5)
    c.setStrokeColor(TAUPE)
    c.line(M, y, PAGE_W - M, y)

y -= 6
# --- Total score ---
c.setFillColor(BROWN_DARK); c.setFont("Helvetica-Bold", 10)
c.drawString(M, y - 3, "Total SANRA score (sum of items, 0–12)")
total_w = 60
text_field("total_score", score_col_x + 8, y - 7, total_w, 18, size=11,
           tooltip="Total score 0-12")
c.setFillColor(BROWN); c.setFont("Helvetica", 8)
c.drawString(score_col_x + 8 + total_w + 8, y - 2, "≥ 8 to enter review")
y -= 30

# --- Comments box ---
c.setFillColor(BROWN_DARK); c.setFont(*label_font)
c.drawString(M, y, "Notes / justification (optional)")
y -= 6
comments_h = y - (M + 6) - 2
if comments_h < 36:
    comments_h = 36
form.textfield(name="sanra_notes", tooltip="Notes / justification", x=M, y=M + 4,
               width=CONTENT_W, height=comments_h, borderColor=TAUPE, fillColor=WHITE,
               textColor=INK, borderWidth=0.75, forceBorder=True, fontSize=9,
               fieldFlags="multiline", value="")

footer("Page 2 of 2 — fillable form")
c.showPage()
c.save()
print("wrote", OUT)
