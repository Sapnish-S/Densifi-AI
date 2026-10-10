/**
 * Clinical Hair Loss Staging Engine
 *
 * Implements:
 * 1. The Norwood-Hamilton Scale for Men (Stages 1 through 7)
 * 2. The Ludwig Scale for Women (Stages I through III)
 *
 * Provides quantitative classification based on follicular density percentage
 * and miniaturization index, along with clinical descriptions, visual stage
 * benchmarks, and evidence-based therapeutic recommendations.
 */

export type StagingScale = "norwood" | "ludwig"
export type GenderPreference = "male" | "female"

export interface StageInfo {
  scale: StagingScale
  stageNumber: number
  stageLabel: string // e.g. "Norwood Stage 3" or "Ludwig Stage II"
  romanLabel?: string // e.g. "Stage III"
  title: string // e.g. "Deep Frontotemporal Recession"
  subtitle: string
  densityMin: number
  densityMax: number
  miniaturizationMin: number
  miniaturizationMax: number
  severity: "mild" | "moderate" | "advanced" | "severe"
  color: string
  description: string
  patternHighlights: string[]
  recommendation: string
}

export const NORWOOD_STAGES: StageInfo[] = [
  {
    scale: "norwood",
    stageNumber: 1,
    stageLabel: "Norwood Stage 1",
    romanLabel: "Stage I",
    title: "Minimal / Adolescent Baseline",
    subtitle: "No significant clinical recession",
    densityMin: 88,
    densityMax: 100,
    miniaturizationMin: 0.0,
    miniaturizationMax: 0.12,
    severity: "mild",
    color: "emerald",
    description:
      "Control baseline with full terminal coverage across the frontal hairline and vertex. Temporal borders show minimal to no recession. Follicles are predominantly robust terminal hairs with healthy caliber.",
    patternHighlights: [
      "Intact frontal border with natural density",
      "Zero to minimal temporal corner maturation",
      "Vertex/crown completely covered and unaffected",
    ],
    recommendation:
      "Maintain preventative routine: gentle scalp cleansing, balanced nutrition, baseline monthly biometric tracking to detect micro-recession early.",
  },
  {
    scale: "norwood",
    stageNumber: 2,
    stageLabel: "Norwood Stage 2",
    romanLabel: "Stage II",
    title: "Mild Temporal Recession",
    subtitle: "Mature hairline formation",
    densityMin: 78,
    densityMax: 87,
    miniaturizationMin: 0.13,
    miniaturizationMax: 0.22,
    severity: "mild",
    color: "teal",
    description:
      "Symmetrical triangular recession at the frontotemporal hairline. Recession does not extend beyond a line 2 cm anterior to the coronal plane. Vertex remains dense and uncompromised.",
    patternHighlights: [
      "Triangular recession at temple angles",
      "Hairline assumes a mild M-shape",
      "Crown/vertex remains fully preserved",
    ],
    recommendation:
      "First-line intervention: consider topical minoxidil (5%), ketoconazole anti-inflammatory shampoo, and red-light photobiomodulation. Monitor vertex closely.",
  },
  {
    scale: "norwood",
    stageNumber: 3,
    stageLabel: "Norwood Stage 3",
    romanLabel: "Stage III",
    title: "Deep Frontotemporal Recession",
    subtitle: "Clinically recognized hair loss border",
    densityMin: 65,
    densityMax: 77,
    miniaturizationMin: 0.23,
    miniaturizationMax: 0.35,
    severity: "moderate",
    color: "amber",
    description:
      "Clinically significant hairline recession. Deep symmetrical recession at the temples; bare or sparse coverage in temporal triangles. A vertex variant (3V) exhibits concurrent thinning on the crown.",
    patternHighlights: [
      "Deep bilateral temple recession (M or V shape)",
      "Recession extends beyond mature baseline threshold",
      "Possible early vertex thinning (Stage 3 Vertex)",
    ],
    recommendation:
      "Active medical protocol recommended: consult regarding 5-alpha reductase inhibitors (oral/topical finasteride), combined with vasodilators and microneedling.",
  },
  {
    scale: "norwood",
    stageNumber: 4,
    stageLabel: "Norwood Stage 4",
    romanLabel: "Stage IV",
    title: "Frontotemporal & Vertex Thinning",
    subtitle: "Dual-zone thinning with separating bridge",
    densityMin: 52,
    densityMax: 64,
    miniaturizationMin: 0.36,
    miniaturizationMax: 0.48,
    severity: "moderate",
    color: "orange",
    description:
      "More severe frontotemporal recession accompanied by a distinct bald or sparse spot on the crown/vertex. The two zones are distinctly separated by a solid band of hair across the mid-scalp.",
    patternHighlights: [
      "Pronounced frontal recession",
      "Distinct circular thinning on the crown/vertex",
      "Separating band of terminal hair across top of scalp",
    ],
    recommendation:
      "Multi-modal therapy: 5-AR inhibitor + topical minoxidil + PRP/growth factor therapy. Clinical specialist consultation advised to halt progression.",
  },
  {
    scale: "norwood",
    stageNumber: 5,
    stageLabel: "Norwood Stage 5",
    romanLabel: "Stage V",
    title: "Narrowing Mid-Scalp Bridge",
    subtitle: "Frontal and vertex regions expanding",
    densityMin: 40,
    densityMax: 51,
    miniaturizationMin: 0.49,
    miniaturizationMax: 0.62,
    severity: "advanced",
    color: "rose",
    description:
      "Frontal and vertex hair loss areas have enlarged significantly. The separating band across the mid-scalp is noticeably thinner and narrower, approaching confluence.",
    patternHighlights: [
      "Expanded frontal and vertex zones",
      "Dividing hair bridge is sparse and narrow",
      "Sides and back retain solid donor density",
    ],
    recommendation:
      "Intensive medical stabilization and surgical evaluation (FUE/FUT hair restoration) to reconstruct frontal zones while stabilizing native hair.",
  },
  {
    scale: "norwood",
    stageNumber: 6,
    stageLabel: "Norwood Stage 6",
    romanLabel: "Stage VI",
    title: "Confluent Frontovertex Loss",
    subtitle: "Bridge lost; frontal & crown zones merge",
    densityMin: 28,
    densityMax: 39,
    miniaturizationMin: 0.63,
    miniaturizationMax: 0.78,
    severity: "advanced",
    color: "red",
    description:
      "The bridge of hair connecting the lateral sides across the crown is lost. The frontal and vertex bald areas have coalesced into a single extensive bald expanse across the top of the head.",
    patternHighlights: [
      "Frontal and crown zones fully merged",
      "Lateral borders dip further below parietal ridge",
      "Dense horseshoe band remains on back and sides",
    ],
    recommendation:
      "Specialist surgical hair restoration, scalp micropigmentation (SMP), and continued anti-androgen therapy to protect residual donor bank.",
  },
  {
    scale: "norwood",
    stageNumber: 7,
    stageLabel: "Norwood Stage 7",
    romanLabel: "Stage VII",
    title: "Advanced Horseshoe Pattern",
    subtitle: "Rim-only perimeter persistence",
    densityMin: 0,
    densityMax: 27,
    miniaturizationMin: 0.79,
    miniaturizationMax: 1.0,
    severity: "severe",
    color: "violet",
    description:
      "Most severe presentation of androgenic alopecia. Only a narrow horseshoe-shaped rim of hair persists low on the sides and posterior occipital scalp. Remaining hair is often sparse.",
    patternHighlights: [
      "Narrow horseshoe rim along sides and nape",
      "Complete alopecia across top, front, and crown",
      "Hair caliber in donor zone may be partially reduced",
    ],
    recommendation:
      "Non-surgical cranial prosthesis, scalp micropigmentation (SMP), or targeted donor-density restorative consultations with a hair restoration surgeon.",
  },
]

export const LUDWIG_STAGES: StageInfo[] = [
  {
    scale: "ludwig",
    stageNumber: 1,
    stageLabel: "Ludwig Stage I",
    romanLabel: "Stage I (Mild)",
    title: "Perceptible Midline Thinning",
    subtitle: "Preserved frontal border with part widening",
    densityMin: 70,
    densityMax: 100,
    miniaturizationMin: 0.0,
    miniaturizationMax: 0.3,
    severity: "mild",
    color: "emerald",
    description:
      "Perceptible diffuse thinning over the vertex and crown. The central midline part line widens progressively ('Christmas tree' pattern), but the frontal hairline (anterior 1–2 cm) remains intact.",
    patternHighlights: [
      "Preserved frontal hairline border",
      "Widening of the central part line",
      "Early miniaturization on crown and mid-scalp",
    ],
    recommendation:
      "Early clinical intervention: topical minoxidil (2% or 5%), low-level laser therapy (LLLT), serum ferritin, vitamin D, and endocrine hormone assessment.",
  },
  {
    scale: "ludwig",
    stageNumber: 2,
    stageLabel: "Ludwig Stage II",
    romanLabel: "Stage II (Moderate)",
    title: "Pronounced Crown Thinning",
    subtitle: "Marked volume loss & visible midline scalp",
    densityMin: 48,
    densityMax: 69,
    miniaturizationMin: 0.31,
    miniaturizationMax: 0.6,
    severity: "moderate",
    color: "amber",
    description:
      "Pronounced diffuse thinning across the crown and top of the head. The part line is distinctly widened, and the scalp is clearly visible under normal ambient lighting. Ponytail volume noticeably decreased.",
    patternHighlights: [
      "Noticeable scalp visibility over top of head",
      "Distinct widening of part across mid-scalp",
      "Overall reduction in hair caliber and volume",
    ],
    recommendation:
      "Comprehensive medical regimen: dermatological evaluation for anti-androgen therapy (spironolactone, oral minoxidil), peptide complexes, and PRP treatments.",
  },
  {
    scale: "ludwig",
    stageNumber: 3,
    stageLabel: "Ludwig Stage III",
    romanLabel: "Stage III (Advanced)",
    title: "Extensive Diffuse Alopecia",
    subtitle: "Near-total crown visibility",
    densityMin: 0,
    densityMax: 47,
    miniaturizationMin: 0.61,
    miniaturizationMax: 1.0,
    severity: "advanced",
    color: "rose",
    description:
      "Extensive, diffuse hair loss across the entire top of the scalp. The scalp is prominently visible with predominantly fine, miniaturized wisps. The frontal fringe remains visible but is fragile and thin.",
    patternHighlights: [
      "Extensive scalp visibility over the entire crown",
      "Severe miniaturization with fine, vellus-like hairs",
      "Frontal hairline may persist but has low density",
    ],
    recommendation:
      "Specialist trichology consultation: systemic combination therapy, follicular unit transplantation, scalp micropigmentation, or specialized hair integration systems.",
  },
]

/**
 * Classify a user's stage based on density percentage and miniaturization index.
 */
export function classifyStage(
  densityPercentage: number,
  miniaturizationIndex: number,
  gender: GenderPreference = "male",
): StageInfo {
  const density = Math.max(0, Math.min(100, densityPercentage))
  const mini = Math.max(0, Math.min(1.0, miniaturizationIndex))

  if (gender === "female") {
    // Ludwig scale classification (Stages 1 to 3)
    // Primary index is a balanced combination of density deficit and miniaturization
    if (density >= 70 && mini <= 0.3) {
      return LUDWIG_STAGES[0]
    } else if (density >= 48 && mini <= 0.6) {
      return LUDWIG_STAGES[1]
    } else {
      return LUDWIG_STAGES[2]
    }
  }

  // Norwood scale classification (Stages 1 to 7)
  // Evaluated from Stage 1 to Stage 7
  if (density >= 88 && mini <= 0.12) {
    return NORWOOD_STAGES[0] // Stage 1
  } else if (density >= 78 && mini <= 0.22) {
    return NORWOOD_STAGES[1] // Stage 2
  } else if (density >= 65 && mini <= 0.35) {
    return NORWOOD_STAGES[2] // Stage 3
  } else if (density >= 52 && mini <= 0.48) {
    return NORWOOD_STAGES[3] // Stage 4
  } else if (density >= 40 && mini <= 0.62) {
    return NORWOOD_STAGES[4] // Stage 5
  } else if (density >= 28 && mini <= 0.78) {
    return NORWOOD_STAGES[5] // Stage 6
  } else {
    return NORWOOD_STAGES[6] // Stage 7
  }
}

/**
 * Returns all stages for a given scale.
 */
export function getStagesForScale(scale: StagingScale): StageInfo[] {
  return scale === "norwood" ? NORWOOD_STAGES : LUDWIG_STAGES
}

/**
 * Returns detailed info for a specific stage number.
 */
export function getStageByNumber(scale: StagingScale, stageNumber: number): StageInfo {
  const list = getStagesForScale(scale)
  return list.find((s) => s.stageNumber === stageNumber) || list[0]
}
