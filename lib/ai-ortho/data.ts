// Data layer for the AI in Orthopedics hub.
// Categories are stable (defined here). Briefs are currently an empty placeholder
// array — Arjun populates this in the next session (inaugural slate of 10 briefs
// per AI in Orthopedics Page Plan §4).

import type { ComponentType } from 'react'
import ImagingIcon from '@/components/icons/ai-ortho/Imaging'
import SurgicalPlanningIcon from '@/components/icons/ai-ortho/SurgicalPlanning'
import RoboticsIcon from '@/components/icons/ai-ortho/Robotics'
import OutcomesIcon from '@/components/icons/ai-ortho/Outcomes'
import LLMsIcon from '@/components/icons/ai-ortho/LLMs'
import ResearchToolsIcon from '@/components/icons/ai-ortho/ResearchTools'

export type AiOrthoCategorySlug =
  | 'imaging'
  | 'surgical-planning'
  | 'robotics'
  | 'outcomes-prediction'
  | 'llms-and-decision-support'
  | 'research-tools'

export interface AiOrthoCategory {
  slug: AiOrthoCategorySlug
  label: string
  short: string // short label for pills/badges
  description: string
  Icon: ComponentType<{ className?: string }>
}

export const AI_ORTHO_CATEGORIES: AiOrthoCategory[] = [
  {
    slug: 'imaging',
    label: 'AI in Imaging',
    short: 'Imaging',
    description:
      'Fracture detection, OA grading, tumor and lesion classification, automated Cobb angle, MRI segmentation.',
    Icon: ImagingIcon,
  },
  {
    slug: 'surgical-planning',
    label: 'Surgical Planning & Navigation',
    short: 'Surgical Planning',
    description:
      'AI-assisted 3D reconstruction, pre-op implant sizing, AR/VR overlays, patient-specific instrumentation.',
    Icon: SurgicalPlanningIcon,
  },
  {
    slug: 'robotics',
    label: 'Robotic Surgery',
    short: 'Robotics',
    description:
      'Robotic arthroplasty, robotic spine, emerging robotic arthroscopy, AI-enhanced robotic systems.',
    Icon: RoboticsIcon,
  },
  {
    slug: 'outcomes-prediction',
    label: 'Outcomes & Risk Prediction',
    short: 'Outcomes',
    description:
      'ML models for post-op complications, PROMs, readmission risk, length of stay, cost and resource forecasting.',
    Icon: OutcomesIcon,
  },
  {
    slug: 'llms-and-decision-support',
    label: 'LLMs & Clinical Decision Support',
    short: 'LLMs',
    description:
      'ChatGPT, Claude, and DeepSeek for clinical workup, guideline concordance, patient education, and resident studying.',
    Icon: LLMsIcon,
  },
  {
    slug: 'research-tools',
    label: 'Research & Education Tools',
    short: 'Research Tools',
    description:
      'AI for literature search, writing assistance, figure generation, coding, statistics, and ethics of AI use in research.',
    Icon: ResearchToolsIcon,
  },
]

export function getCategory(slug: string): AiOrthoCategory | undefined {
  return AI_ORTHO_CATEGORIES.find((c) => c.slug === slug)
}

// ---------------------------------------------------------------------------
// Briefs
// ---------------------------------------------------------------------------

export interface AiOrthoBrief {
  slug: string // URL slug (brief-slug segment)
  category: AiOrthoCategorySlug
  headline: string
  publishedAt: string // ISO date, e.g. '2026-04-14'
  readMinutes: number
  summary: string // one-sentence bottom-line for cards + meta description
  bottomLine: string // callout at top of individual brief
  whatTheyDid: string
  whatTheyFound: string
  whyItMatters: string
  limitations: string
  furtherReading?: { label: string; href: string }[]
  source: {
    paperTitle: string
    authors: string // e.g. "Smith JA, Chen L, Patel R, et al."
    journal: string
    paperPublishedAt: string // ISO or human date string
    doi?: string // e.g. "10.2106/JBJS.25.00001"
    url?: string // canonical link (falls back to https://doi.org/<doi>)
    openAccess?: boolean
  }
  // Reference to a single important figure or table from the source paper that
  // captures the study's core result. Rendered under the DOI line on the brief
  // page. OSCRSJ does not reproduce paywalled figures — we link out.
  keyFigure?: {
    label: string // e.g. "Figure 3" or "Table 2"
    description: string // one-sentence description of what it shows
    url?: string // optional direct link to the figure/table in the paper
  }
  // Full Vancouver-style citation string for the bottom of the brief.
  citation: string
}

// Inaugural slate — first 6 briefs shipped 2026-04-16 (Arjun Cowork session).
// Pilot batch covering Imaging (2), Robotics (2), and LLMs (2). Remaining 4
// briefs (Surgical Planning, Outcomes, Research Tools) follow in a subsequent
// session once additional source PDFs are provided.
export const AI_ORTHO_BRIEFS: AiOrthoBrief[] = [
  {
    slug: 'commercial-ai-fracture-detection-meta-analysis',
    category: 'imaging',
    headline:
      'Commercial AI fracture detection: meta-analysis of 17 studies finds good overall accuracy, with weaker performance on ribs and spine',
    publishedAt: '2026-04-16',
    readMinutes: 4,
    summary:
      'A meta-analysis of 17 diagnostic accuracy studies across seven commercial AI fracture detection products reports good to excellent sensitivity in most anatomical regions, notably weaker performance on ribs and spine, and the highest accuracy when AI output is combined with human review.',
    bottomLine:
      'Across 38,978 radiographs, four of five commercial AI fracture detection systems achieved sensitivities above 90 percent and specificities in the 80 to 90 percent range. Accuracy dropped on rib and spine radiographs. The best configuration was not AI alone or human alone, but human plus AI.',
    whatTheyDid:
      'The authors systematically searched PubMed and Embase for peer-reviewed diagnostic test accuracy studies of commercially available AI fracture detection solutions used on conventional radiography. Seventeen studies covering seven certified products and 38,978 x-rays with 8,150 fractures were pooled using a bivariate random-effects model. Pre-specified subgroup analyses examined product, rater type (stand-alone AI, human unaided, human aided by AI), anatomical region, and the influence of industry funding.',
    whatTheyFound:
      'Four of five products evaluated in stand-alone mode achieved sensitivity above 90 percent with specificity of 80 to 90 percent; one outlier product had sensitivity below 60 percent and specificity above 95 percent. Pooled accuracy was good to excellent across most anatomical regions, with two clear exceptions: rib radiographs (poor sensitivity, moderate specificity) and spine radiographs (excellent sensitivity, poor specificity). Human radiologists aided by AI achieved significantly higher specificity than stand-alone AI (p < 0.001) with no loss of sensitivity (p = 0.316). Industry-funded studies reported sensitivity 5 percent higher and specificity 4 percent lower than independently funded studies, a small but measurable effect.',
    whyItMatters:
      'Emergency departments and urgent-care clinics are the clearest fit for this technology, where radiograph volume and time-to-disposition pressure are highest. The data support AI as an assistive layer, not a replacement for radiologist review. Orthopedic trainees reading shoulder, wrist, ankle, and hand films with AI prefill should expect a genuine boost in specificity, alongside a smaller benefit for unaided sensitivity. The lower performance on rib and spine imaging is a concrete limitation to communicate when these tools are deployed in trauma and spine services.',
    limitations:
      'Diagnostic test accuracy studies vary in reference standard, patient population, and spectrum of injuries included. Only four rib studies and four spine studies were available for those subgroup estimates, so those numbers carry wider uncertainty. The funding analysis compared four industry-funded trials against eleven non-funded trials, and only six percent of commercial AI evaluations in the broader literature are fully independent. External validation across diverse scanner vendors and patient demographics was inconsistent across studies. Clinical outcome benefits, including missed-fracture rates and downstream treatment decisions, were not measured.',
    source: {
      paperTitle:
        'Artificial intelligence in commercial fracture detection products: a systematic review and meta-analysis of diagnostic test accuracy',
      authors: 'Husarek J, Hess S, Razaeian S, Ruder TD, Sehmisch S, Müller M, Liodakis E',
      journal: 'Scientific Reports',
      paperPublishedAt: 'October 2024',
      doi: '10.1038/s41598-024-73058-8',
      url: 'https://doi.org/10.1038/s41598-024-73058-8',
      openAccess: true,
    },
    keyFigure: {
      label: 'Figure 4',
      description:
        'Forest plot of pooled sensitivity and specificity for stand-alone commercial AI, broken out by anatomical region, showing the sharp performance drop on rib and spine radiographs.',
      url: 'https://www.nature.com/articles/s41598-024-73058-8/figures/4',
    },
    citation:
      'Husarek J, Hess S, Razaeian S, Ruder TD, Sehmisch S, Müller M, Liodakis E. Artificial intelligence in commercial fracture detection products: a systematic review and meta-analysis of diagnostic test accuracy. Sci Rep. 2024;14:23053. doi:10.1038/s41598-024-73058-8',
  },

  {
    slug: 'deep-learning-cobb-angle-meta-analysis',
    category: 'imaging',
    headline:
      'Deep learning measures Cobb angle to within 3 degrees of expert reads, with segmentation methods outperforming landmark methods',
    publishedAt: '2026-04-16',
    readMinutes: 4,
    summary:
      'A systematic review and meta-analysis of deep learning algorithms for automated Cobb angle measurement reports a pooled error of 2.99 degrees, with segmentation-based architectures significantly more accurate than landmark-based ones.',
    bottomLine:
      'Across 17 studies in meta-analysis, deep learning measured the Cobb angle to within about 3 degrees of expert radiologist reads (CMAE 2.99°, 95% CI 2.61 to 3.38). Segmentation models outperformed landmark models by roughly 1 degree. Clinical use still rests largely on single-center retrospective cohorts.',
    whatTheyDid:
      'The authors searched six databases through September 2023 for studies developing or evaluating deep learning algorithms to estimate Cobb angle on spinal radiographs. Fifty studies were included in the systematic review and seventeen contributed data to the meta-analysis. The primary outcome was circular mean absolute error (CMAE) relative to expert radiologist ground truth. A pre-specified subgroup compared segmentation-based methods (pixel-wise spine segmentation then angle calculation) against landmark-based methods (identification of vertebral corners). Risk of bias was assessed with QUADAS-2 and the protocol was registered in PROSPERO (CRD42023403057).',
    whatTheyFound:
      'The pooled CMAE across 17 studies was 2.99° (95% CI 2.61 to 3.38), with high between-study heterogeneity (94%, p < 0.01). Segmentation-based models reached a CMAE of 2.40° (95% CI 1.85 to 2.95), significantly lower than the 3.31° (95% CI 2.89 to 3.72) achieved by landmark-based models (p < 0.01). Individual study CMAE ranged from 1.07° to 17.13°. Most included studies relied on convolutional architectures, with U-Net, ResNet, DeepLab V3+, and HRNet the most common.',
    whyItMatters:
      'The clinically relevant threshold for Cobb angle measurement error is generally considered to be 5 degrees, the range within which two expert human readers typically agree. Pooled deep learning performance now sits inside that window. For adolescent idiopathic scoliosis screening, a workflow where an algorithm produces an initial Cobb measurement and the treating physician confirms or adjusts is within reach based on the published accuracy. Segmentation architectures appear to be the stronger starting point for new clinical deployments.',
    limitations:
      'Only three of the 50 reviewed studies were prospective, and only one was multicenter. Most models were trained and evaluated on open challenge datasets or single-institution cohorts, leaving external validity unclear. Between-study heterogeneity was high, and publication bias could not be fully excluded. Measurement of error only captured agreement with a human read, not clinical outcomes such as treatment threshold decisions or surgical planning accuracy. Pediatric cohorts and severe curves above 50 degrees remain underrepresented in the literature.',
    source: {
      paperTitle:
        'Deep learning in Cobb angle automated measurement on X-rays: a systematic review and meta-analysis',
      authors: 'Zhu Y, Yin X, Chen Z, Zhang H, Xu K, Zhang J, Wu N',
      journal: 'Spine Deformity',
      paperPublishedAt: 'January 2025',
      doi: '10.1007/s43390-024-00954-4',
      url: 'https://doi.org/10.1007/s43390-024-00954-4',
      openAccess: true,
    },
    keyFigure: {
      label: 'Figure 4',
      description:
        'Forest plot of the 17 studies contributing to the meta-analysis, showing the overall pooled CMAE of 2.99 degrees and the subgroup advantage of segmentation-based models (2.40°) over landmark-based models (3.31°).',
      url: 'https://link.springer.com/article/10.1007/s43390-024-00954-4/figures/4',
    },
    citation:
      'Zhu Y, Yin X, Chen Z, Zhang H, Xu K, Zhang J, Wu N. Deep learning in Cobb angle automated measurement on X-rays: a systematic review and meta-analysis. Spine Deform. 2025;13(1):19-27. doi:10.1007/s43390-024-00954-4',
  },

  {
    slug: 'robot-assisted-femoral-shaft-reduction-controlled-trial',
    category: 'robotics',
    headline:
      'Robot-assisted femoral shaft reduction cuts fluoroscopy by about two-thirds and improves alignment in a 30-patient controlled study',
    publishedAt: '2026-04-16',
    readMinutes: 4,
    summary:
      'A prospective non-randomized controlled study of 30 patients reports that robot-assisted closed reduction of femoral shaft fractures delivered superior alignment and substantially lower fluoroscopy burden compared with conventional technique, without a difference in blood loss or total reduction time.',
    bottomLine:
      'Robot-assisted reduction reduced intraoperative fluoroscopy events from 117 to 37 on average, improved femoral length discrepancy from 4.2 to 1.7 mm, and improved anteversion error from 13.8° to 3.7°. Total reduction time and blood loss were unchanged. Sample size was 30 and allocation was not randomized.',
    whatTheyDid:
      'Thirty adults with fresh femoral shaft fractures at a single Beijing center were allocated to robot-assisted closed reduction and intramedullary nailing (n = 15) or conventional fluoroscopy-guided reduction and nailing (n = 15) in a prospective non-randomized controlled design. The robot-assisted group used an orthopedic surgical navigation system to guide the reduction step. Primary outcomes were reduction time, total operative time, intraoperative fluoroscopy count, blood loss, and post-operative reduction error measured on imaging (femoral length discrepancy and anteversion difference).',
    whatTheyFound:
      'Baseline characteristics were similar between groups. The robot-assisted group required significantly fewer intraoperative fluoroscopies (36.67 ± 25.41 vs 117.26 ± 61.28, P < 0.001). Post-operative femoral length discrepancy was lower (1.74 ± 1.37 mm vs 4.16 ± 2.67 mm, P = 0.004) and anteversion difference was lower (3.66 ± 3.37° vs 13.81 ± 9.58°, P = 0.001). Intraoperative blood loss (207.33 ± 119.91 mL vs 240.00 ± 139.13 mL, P = 0.497) and reduction time (74.27 ± 27.38 min vs 69.73 ± 34.10 min, P = 0.691) did not differ significantly.',
    whyItMatters:
      'The dosimetric case for robot-assisted long-bone reduction has been mostly theoretical. This study puts a concrete number on it: roughly 80 fewer fluoroscopy shots per case, translating to meaningful reduction in radiation exposure to the surgeon, OR staff, and patient over a year of trauma volume. Alignment gains are equally notable, as malunion and leg length inequality drive long-term disability and reoperation after femoral shaft fixation. The data suggest a legitimate role for robotic navigation in high-volume trauma centers, assuming the platform is available and the learning curve has been climbed.',
    limitations:
      'The study enrolled 30 patients from a single center, with allocation described as non-randomized, both of which limit generalizability. Two of the authors are affiliated with the robot manufacturer, a potential source of bias that readers should weigh. Follow-up was short and no clinical outcomes such as union time, functional scores, or reoperation rate were reported. The conventional arm used fluoroscopy alone without modern adjuncts such as CT-guided navigation, which may narrow the comparative gap. A larger multicenter randomized trial with patient-reported outcomes would strengthen the evidence base.',
    source: {
      paperTitle:
        'Robot-assisted closed reduction of femoral shaft fractures: a prospective controlled study',
      authors: 'Zhao C, Xiao H, Cao Q, Bei M, Li B, Song Y, Zhu G, Wu X',
      journal: 'International Orthopaedics',
      paperPublishedAt: '2025',
      doi: '10.1007/s00264-025-06623-z',
      url: 'https://doi.org/10.1007/s00264-025-06623-z',
      openAccess: true,
    },
    keyFigure: {
      label: 'Table 1',
      description:
        'Demographics and operative data comparing the robot-assisted and conventional arms side by side, including the intraoperative fluoroscopy count, length discrepancy, and anteversion difference that drive the paper\u2019s conclusion.',
      url: 'https://link.springer.com/article/10.1007/s00264-025-06623-z',
    },
    citation:
      'Zhao C, Xiao H, Cao Q, Bei M, Li B, Song Y, Zhu G, Wu X. Robot-assisted closed reduction of femoral shaft fractures: a prospective controlled study. Int Orthop. 2025;49(9):2251-2261. doi:10.1007/s00264-025-06623-z',
  },

  {
    slug: 'robotic-assisted-arthroscopy-hss-review',
    category: 'robotics',
    headline:
      'Robotic-assisted arthroscopy review: submillimeter precision in early studies, adoption gated by regulatory, economic, and training barriers',
    publishedAt: '2026-04-16',
    readMinutes: 4,
    summary:
      'A narrative review in HSS Journal surveys the emerging landscape of robotic-assisted arthroscopy, describes submillimeter precision and improved anatomic accuracy in preclinical and cadaveric studies, and names the barriers that currently limit clinical rollout.',
    bottomLine:
      'Unlike total joint arthroplasty and spine, arthroscopy has not yet absorbed robotics at scale. Early preclinical and cadaveric work shows promise, including submillimeter tunnel placement in ACL reconstruction. The piece is a narrative review, not a clinical trial, and adoption depends on regulation, cost, and training pathways that do not yet exist.',
    whatTheyDid:
      'Four orthopedic surgeons from Hospital for Special Surgery, the Royal London Hospital, and the University of California San Francisco authored a narrative review synthesizing the current landscape of robotic-assisted arthroscopy. The review outlines the limitations of conventional arthroscopy that robotics aims to address (confined 2D optics, constrained dexterity, one-handed camera control), surveys early robotic platforms, and examines the clinical, regulatory, and economic barriers to adoption. The piece also introduces concepts such as "digital fencing" of cartilage surfaces to prevent iatrogenic injury during robotic instrument passes.',
    whatTheyFound:
      'Preclinical and cadaveric studies cited in the review describe submillimeter precision and improved anatomic accuracy in robotic assistance for anterior cruciate ligament reconstruction tunnel placement. The authors note that robotic platforms can keep the surgical view centered, manage fluid dynamics automatically, and digitally mark cartilage surfaces to avoid breaching during instrument passes. Clinical adoption was judged to remain limited and early. The review does not report pooled diagnostic or surgical outcomes, as it is a narrative rather than a systematic synthesis.',
    whyItMatters:
      'Arthroscopy is the next frontier in orthopedic robotics. Residents who trained on robotic TKA and spine navigation will likely encounter robotic arthroscopy during fellowship or early practice. Familiarity with the clinical rationale (depth perception, dexterity, reproducibility) and the open questions (regulatory approval pathway, cost per case, training curriculum) is useful for trainees evaluating fellowship programs or early-career practice environments that advertise the technology. For program directors, the review helps set realistic expectations about what robotic arthroscopy can and cannot yet do.',
    limitations:
      'The article is a narrative review, not a systematic review or meta-analysis, and its claims rest on the authors\u2019 selection of literature. Most cited performance data come from preclinical or cadaveric work, not clinical trials in living patients. Sample sizes in the cited early clinical series are small, and no head-to-head comparisons against conventional arthroscopy exist at scale. Cost-effectiveness, long-term patient-reported outcomes, and failure modes of robotic arthroscopy in real-world OR conditions have not been characterized.',
    source: {
      paperTitle:
        'Robotic-assisted arthroscopy promises enhanced procedural efficiency, visualization, and control but must overcome barriers to adoption',
      authors: 'Kunze KN, Ferguson D, Pareek A, Colyvas N',
      journal: 'HSS Journal',
      paperPublishedAt: '2025',
      doi: '10.1177/15563316251340983',
      url: 'https://doi.org/10.1177/15563316251340983',
    },
    citation:
      'Kunze KN, Ferguson D, Pareek A, Colyvas N. Robotic-assisted arthroscopy promises enhanced procedural efficiency, visualization, and control but must overcome barriers to adoption. HSS J. 2025:1-6. doi:10.1177/15563316251340983',
  },

  {
    slug: 'chatgpt-deepseek-aaos-clavicle-guidelines',
    category: 'llms-and-decision-support',
    headline:
      'ChatGPT-4o and DeepSeek align with AAOS clavicle fracture guidelines about 90 percent of the time, but neither scored on actionability',
    publishedAt: '2026-04-16',
    readMinutes: 4,
    summary:
      'A comparative study evaluated ChatGPT-4o and DeepSeek on 14 clinical questions derived from the 2022 AAOS clinical practice guideline for clavicle fractures and found comparable accuracy between the two models, with both failing to produce actionable patient-facing instructions.',
    bottomLine:
      'Binary accuracy against the 2022 AAOS clavicle CPG was 0.93 for ChatGPT-4o and 0.89 for DeepSeek (p > 0.05, not significant). Both models produced coherent, high-accuracy answers. Both also scored a median of 0 on PEMAT actionability, meaning patients could not readily act on what was written. Occasional hallucinations were observed.',
    whatTheyDid:
      'The authors rephrased each recommendation from the 2022 AAOS Clinical Practice Guideline on clavicle fractures into a standardized open-ended prompt, yielding 14 clinical questions. Each question was submitted once to ChatGPT-4o and once to DeepSeek. Two orthopedic surgeons independently rated responses using DISCERN, PEMAT-P, and a CLEAR score, along with Flesch-Kincaid Grade Level, Flesch Reading Ease, and Gunning-Fog Index. Binary accuracy (complete concordance with the CPG) and weighted accuracy (partial concordance) were computed against the source guideline. Mann-Whitney U tests compared the two models.',
    whatTheyFound:
      'Binary accuracy was 0.93 for ChatGPT-4o and 0.89 for DeepSeek (p > 0.05). Weighted accuracy was 0.83 and 0.79 respectively (p > 0.05). DeepSeek responses were longer (median 572 words vs 438.5, p = 0.016) and scored higher on CLEAR (18 vs 16, p < 0.001), but PEMAT understandability, PEMAT actionability, and total PEMAT scores were statistically indistinguishable between the two models. Both systems posted a median PEMAT actionability score of 0, meaning responses contained no patient-actionable elements. The reviewers flagged occasional inaccuracies and hallucinations across both models.',
    whyItMatters:
      'The study reinforces a pattern now consistent across LLM-versus-guideline evaluations in orthopedics: high surface accuracy, poor actionability, and episodic hallucination. For trainees, this means general-purpose LLMs are a reasonable starting point for studying a CPG, but the output cannot be handed to a patient as discharge instructions without rewriting. For educators, actionability is the design target LLMs have not yet hit on orthopedic content. The study also shows that, within a single specialty question set, choice of model (ChatGPT vs DeepSeek) did not drive accuracy differences.',
    limitations:
      'Only 14 questions from a single clinical practice guideline were evaluated, which limits statistical power and generalizability. Each prompt was submitted once per model, so intra-model variance was not captured and prompt engineering was not explored. Two raters rated all responses, and inter-rater reliability was averaged rather than reported per question. Hallucination rates were not formally quantified. The study is a snapshot in time, and LLM behavior changes with each model release, so the specific numbers should not be generalized to future versions.',
    source: {
      paperTitle:
        'Can large language models follow guidelines? A comparative study of ChatGPT-4o and DeepSeek AI in clavicle fracture management based on AAOS recommendations',
      authors: 'Keçeci T, Karagöz B',
      journal: 'BMC Medical Informatics and Decision Making',
      paperPublishedAt: '2025',
      doi: '10.1186/s12911-025-03202-5',
      url: 'https://doi.org/10.1186/s12911-025-03202-5',
      openAccess: true,
    },
    keyFigure: {
      label: 'Figure 4',
      description:
        'Side-by-side bar chart of binary accuracy, weighted accuracy, and concordance across the 14 AAOS clavicle CPG questions for ChatGPT-4o versus DeepSeek.',
      url: 'https://bmcmedinformdecismak.biomedcentral.com/articles/10.1186/s12911-025-03202-5/figures/4',
    },
    citation:
      'Keçeci T, Karagöz B. Can large language models follow guidelines? A comparative study of ChatGPT-4o and DeepSeek AI in clavicle fracture management based on AAOS recommendations. BMC Med Inform Decis Mak. 2025;25:350. doi:10.1186/s12911-025-03202-5',
  },

  {
    slug: 'chatgpt-medicine-applications-challenges-review',
    category: 'llms-and-decision-support',
    headline:
      'ChatGPT in medicine: a narrative review of applications, failure modes, and the ethical boundaries clinicians need to hold',
    publishedAt: '2026-04-16',
    readMinutes: 4,
    summary:
      'An open-access narrative review synthesizes current evidence on ChatGPT\u2019s use across clinical practice, medical education, and research, and specifies the limitations trainees should understand before integrating it into workflow.',
    bottomLine:
      'ChatGPT has demonstrated useful capabilities in triage support, patient-education drafting, and study aid, with reported overall accuracy around 72 percent in one diagnostic study and 95.7 percent sensitivity for admission triage in another. It also hallucinates, fabricates citations, and encodes training biases. It is not a clinical decision-making tool.',
    whatTheyDid:
      'The authors conducted a literature search of PubMed, Web of Science, and Google Scholar for studies discussing ChatGPT\u2019s applications in the medical field. The review organizes findings across four domains: clinical practice (diagnosis, triage, documentation), healthcare delivery (chatbots, patient education), medical education (study aid, simulated cases), and medical research (literature summarization, writing assistance). Limitations, ethical considerations, and future research directions are consolidated into a single reference piece.',
    whatTheyFound:
      'Reported performance of ChatGPT was variable across use cases. In one diagnostic evaluation the model achieved an overall accuracy of 71.7 percent (95% CI 69.3 to 74.1 percent), with notably lower performance on differential diagnosis and clinical management than on general medical knowledge. In a triage study the model had 95.7 percent sensitivity for identifying patients suitable for admission but only 18.2 percent specificity for identifying patients who could be safely discharged. In patient-facing correspondence, clinical letters generated by ChatGPT scored a median accuracy of 7 out of 9 with a weighted kappa of 0.80 (p < 0.0001). The review repeatedly emphasizes hallucination, fabricated references, and algorithmic bias as core failure modes.',
    whyItMatters:
      'For orthopedic trainees, the practical takeaway is scope discipline. ChatGPT is appropriate for drafting, explaining, summarizing, and studying, provided every clinical fact is re-verified against the primary source. It is not appropriate as a source of differential diagnosis, clinical management recommendation, or verified citation. The triage numbers illustrate why: high sensitivity with very low specificity means the model will over-refer, which is acceptable for safety netting but is not decision-making. Residency programs integrating LLM tools should set explicit expectations about what counts as appropriate use and what does not.',
    limitations:
      'This is a narrative review, not a systematic review, and the authors did not quantify study quality or pool effect sizes. The cited studies span heterogeneous clinical domains, so generalizing to orthopedic practice specifically requires caution. Many of the cited performance numbers come from early iterations of ChatGPT, and current model versions may perform differently in either direction. The review predates several major model releases and the broader integration of retrieval-augmented generation, which may reduce the hallucination rate described here.',
    source: {
      paperTitle:
        'The potential applications and challenges of ChatGPT in the medical field',
      authors: 'Mu Y, He D',
      journal: 'International Journal of General Medicine',
      paperPublishedAt: 'March 2024',
      doi: '10.2147/IJGM.S456659',
      url: 'https://doi.org/10.2147/IJGM.S456659',
      openAccess: true,
    },
    citation:
      'Mu Y, He D. The potential applications and challenges of ChatGPT in the medical field. Int J Gen Med. 2024;17:817-826. doi:10.2147/IJGM.S456659',
  },
]

export function getBriefsByCategory(slug: AiOrthoCategorySlug): AiOrthoBrief[] {
  return AI_ORTHO_BRIEFS.filter((b) => b.category === slug).sort(
    (a, b) => b.publishedAt.localeCompare(a.publishedAt)
  )
}

export function getLatestBriefs(limit = 10): AiOrthoBrief[] {
  return [...AI_ORTHO_BRIEFS]
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
    .slice(0, limit)
}

export function getBrief(
  category: AiOrthoCategorySlug,
  slug: string
): AiOrthoBrief | undefined {
  return AI_ORTHO_BRIEFS.find((b) => b.category === category && b.slug === slug)
}

// ---------------------------------------------------------------------------
// Landing primer (150 words, institutional voice)
// ---------------------------------------------------------------------------

export const AI_ORTHO_PRIMER =
  'Artificial intelligence has moved from research into daily orthopedic practice. Deep learning now reads radiographs for fracture detection, segments MRI scans, and grades osteoarthritis severity. Machine learning models predict surgical complications and post-operative outcomes. Large language models are increasingly used by trainees for clinical workup, patient education, and writing assistance. The pace is uneven, and the distance between a promising study and a validated clinical tool is often unclear. The AI in Orthopedics hub is OSCRSJ\u2019s curated reference on this landscape. It covers six categories: imaging, surgical planning and navigation, robotic surgery, outcomes and risk prediction, large language models and clinical decision support, and research and education tools. Every brief draws from peer-reviewed orthopedic journals or specialty society communications, links to the primary source, reports effect sizes honestly, and names the limitations the study could not resolve.'

// ---------------------------------------------------------------------------
// Glossary v1 — 20 terms at launch, target 40 by Month 3
// ---------------------------------------------------------------------------

export interface GlossaryEntry {
  term: string
  definition: string
}

export const AI_ORTHO_GLOSSARY: GlossaryEntry[] = [
  {
    term: 'Machine learning',
    definition:
      'A family of algorithms that learn patterns from data rather than being explicitly programmed with rules. In orthopedics, machine learning models are commonly trained on labeled imaging or outcomes data.',
  },
  {
    term: 'Deep learning',
    definition:
      'A subset of machine learning that uses layered neural networks, capable of learning complex features directly from raw data such as radiographs or MRI scans. Most recent AI imaging tools in orthopedics rely on deep learning.',
  },
  {
    term: 'Convolutional neural network (CNN)',
    definition:
      'A deep learning architecture designed for image data. CNNs scan an image with small filters to detect local features such as edges and textures, and remain a standard architecture for fracture detection, segmentation, and OA grading.',
  },
  {
    term: 'Transformer',
    definition:
      'A neural network architecture built around an attention mechanism that weighs relationships across an input sequence. Transformers power large language models and are increasingly used for medical imaging and clinical text.',
  },
  {
    term: 'Foundation model',
    definition:
      'A large model pretrained on a broad dataset that can be adapted to many downstream tasks. Foundation models are often the backbone of newer clinical AI tools and include families such as GPT, Claude, and medical-specific variants.',
  },
  {
    term: 'Large language model (LLM)',
    definition:
      'A transformer-based foundation model trained on text. LLMs produce fluent natural-language output and can summarize literature, draft notes, and answer clinical questions, but they can also fabricate information. See Hallucination.',
  },
  {
    term: 'Prompt',
    definition:
      'The natural-language input given to a large language model. Prompt wording substantially affects output quality, and small changes to a prompt can change the model\u2019s answer.',
  },
  {
    term: 'Hallucination',
    definition:
      'The production by a large language model of confident-sounding content that is false or unsupported by any source. Hallucinations are a well-documented failure mode and a central safety concern for clinical LLM use.',
  },
  {
    term: 'Retrieval-augmented generation (RAG)',
    definition:
      'A technique in which a language model is connected to a curated document store at query time and instructed to answer from retrieved passages. RAG is used to reduce hallucinations in clinical and research tools.',
  },
  {
    term: 'Sensitivity',
    definition:
      'The proportion of true positives correctly identified by a test or model. A fracture detection model with 95 percent sensitivity misses 5 percent of fractures present in the data.',
  },
  {
    term: 'Specificity',
    definition:
      'The proportion of true negatives correctly identified by a test or model. High sensitivity with low specificity produces many false alarms. Both numbers should always be reported together.',
  },
  {
    term: 'Positive predictive value (PPV)',
    definition:
      'Among cases the model flags as positive, the proportion that are truly positive. PPV depends on disease prevalence and falls sharply in low-prevalence populations.',
  },
  {
    term: 'Negative predictive value (NPV)',
    definition:
      'Among cases the model flags as negative, the proportion that are truly negative. NPV also depends on prevalence and is often high when disease is uncommon.',
  },
  {
    term: 'ROC curve and AUC',
    definition:
      'A receiver operating characteristic curve plots sensitivity against 1 minus specificity across all classification thresholds. The area under the curve (AUC) summarizes overall discrimination on a 0 to 1 scale, with 0.5 indicating chance and 1.0 indicating perfect discrimination.',
  },
  {
    term: 'Training, validation, and test sets',
    definition:
      'The three data partitions used to develop and evaluate a model. The model learns from the training set, is tuned on the validation set, and is evaluated on the held-out test set. A model that has seen the test data during training will report inflated performance.',
  },
  {
    term: 'Overfitting',
    definition:
      'When a model learns patterns specific to its training data that do not generalize to new cases. Overfit models perform well on their own test set but fail on external cases.',
  },
  {
    term: 'External validation',
    definition:
      'Evaluation of a model on data from an institution, scanner, or population not used during training. External validation is the standard for judging whether a model will generalize to clinical use.',
  },
  {
    term: 'Ground truth',
    definition:
      'The reference label against which model predictions are compared, for example an orthopedic surgeon\u2019s read of a radiograph or a confirmed intraoperative diagnosis. Model performance is only as reliable as the ground truth it is measured against.',
  },
  {
    term: 'PACS',
    definition:
      'Picture Archiving and Communication System. The hospital infrastructure that stores, retrieves, and distributes medical imaging. Clinical AI imaging tools are typically integrated at the PACS level.',
  },
  {
    term: 'DICOM',
    definition:
      'Digital Imaging and Communications in Medicine. The standard file format and communication protocol for medical imaging. AI imaging models typically consume DICOM inputs.',
  },
]
