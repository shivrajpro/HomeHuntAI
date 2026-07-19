import type { PropertyInsights } from '@/features/properties/types'

/**
 * The ranking vocabulary Nestor scores against: the seven locality-score
 * dimensions (with display labels and the keywords that trigger them), the
 * balanced default priority profile, and the life-stage phrases that imply
 * priorities without naming them. Pure data — no parsing or scoring logic.
 */

/** The locality-score dimensions we rank on, with display labels + trigger words. */
export type Dimension = keyof PropertyInsights

export const DIMENSION_META: Record<
  Dimension,
  { label: string; keywords: string[] }
> = {
  walkability: {
    label: 'Walkability',
    keywords: ['walkable', 'walkability', 'walk to', 'pedestrian', 'on foot'],
  },
  familyScore: {
    label: 'Family-friendly',
    keywords: [
      'family',
      'families',
      'kid',
      'kids',
      'child',
      'children',
      'school',
      'schools',
      'playground',
    ],
  },
  investmentScore: {
    label: 'Investment',
    keywords: [
      'investment',
      'invest',
      'appreciation',
      'resale',
      'roi',
      'returns',
      'rental yield',
      'yield',
      'capital growth',
    ],
  },
  commuteScore: {
    label: 'Commute',
    keywords: [
      'commute',
      'office',
      'work',
      'workplace',
      'it park',
      'tech park',
      'metro',
      'connectivity',
      'connected',
      'short drive',
    ],
  },
  safetyScore: {
    label: 'Safety',
    keywords: ['safe', 'safety', 'secure', 'security', 'gated', 'low crime'],
  },
  nightlifeScore: {
    label: 'Nightlife',
    keywords: [
      'nightlife',
      'pub',
      'pubs',
      'bar',
      'bars',
      'restaurant',
      'restaurants',
      'cafe',
      'cafes',
      'social',
      'vibrant',
      'happening',
    ],
  },
  greenScore: {
    label: 'Green & calm',
    keywords: [
      'green',
      'greenery',
      'parks',
      'nature',
      'trees',
      'quiet',
      'peaceful',
      'calm',
      'serene',
      'open space',
      'fresh air',
    ],
  },
}

export const ALL_DIMENSIONS = Object.keys(DIMENSION_META) as Dimension[]

/** A ranking dimension, exposed for the editable-priorities UI. */
export type PriorityDimension = Dimension

/** All ranking dimensions with display labels, for the priority chip editor. */
export const PRIORITY_OPTIONS: { value: PriorityDimension; label: string }[] =
  ALL_DIMENSIONS.map((dim) => ({ value: dim, label: DIMENSION_META[dim].label }))

/** When the brief gives no explicit priorities, rank on this balanced profile. */
export const DEFAULT_PRIORITIES: Dimension[] = [
  'familyScore',
  'safetyScore',
  'commuteScore',
  'investmentScore',
]

/**
 * Life-stage / lifestyle phrases that imply a set of priorities without
 * naming them (e.g. "I'm newly married" implies nightlife + commute). `label`
 * is surfaced back to the user in the "interpreted priorities" disclosure so
 * they can see *why* a dimension was picked, not just that it was.
 */
export const LIFE_STAGES: {
  pattern: RegExp
  dimensions: Dimension[]
  label: string
}[] = [
  {
    pattern: /\b(retire|retirement|retiring|senior|elderly|old(er)? parents)\b/i,
    dimensions: ['greenScore', 'safetyScore', 'walkability'],
    label: 'Retiring / senior living',
  },
  {
    pattern: /\b(young couple|newly ?wed|newly married|just married|dinks?)\b/i,
    dimensions: ['nightlifeScore', 'commuteScore', 'investmentScore'],
    label: 'Newly married',
  },
  {
    pattern: /\b(bachelor|single|solo|working professional|it professional)\b/i,
    dimensions: ['commuteScore', 'nightlifeScore'],
    label: 'Single professional',
  },
  {
    pattern: /\b(growing family|family with (kids|children)|school-going)\b/i,
    dimensions: ['familyScore', 'safetyScore', 'greenScore'],
    label: 'Growing family',
  },
  {
    pattern: /\b(investor|investment property|second home|rental income)\b/i,
    dimensions: ['investmentScore', 'commuteScore'],
    label: 'Investor',
  },
  {
    pattern:
      /\b(expecting( a baby)?|pregnant|having a baby|planning a family|trying for a baby|kids? soon|kids? on the way|baby on the way)\b/i,
    dimensions: ['familyScore', 'safetyScore', 'greenScore'],
    label: 'Expecting / planning a family',
  },
  {
    pattern:
      /\b(parents? (?:will\s+)?(?:stay|staying|move|moving|live|living) with (?:us|me)|joint family|multi-?generational|in-?laws? (?:stay|staying|living) with (?:us|me))\b/i,
    dimensions: ['familyScore', 'safetyScore', 'walkability'],
    label: 'Multigenerational household',
  },
  {
    pattern:
      /\b(work(?:s|ing)? remotely|work(?:s|ing)? from home|remote job|remote work|\bwfh\b|freelanc(?:e|er|ing))\b/i,
    dimensions: ['greenScore', 'walkability'],
    label: 'Remote / work-from-home',
  },
  {
    pattern: /\b(have a dog|have a cat|have (?:a )?pet|pet-?friendly|dog owner|dog parent|cat owner)\b/i,
    dimensions: ['greenScore', 'walkability'],
    label: 'Pet owner',
  },
]

/** Score thresholds shared by ranking and narration: a genuinely strong trait… */
export const STRONG = 80
/** …and a decent-but-not-headline one. */
export const DECENT = 65
