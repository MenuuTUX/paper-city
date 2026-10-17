export type ClaimCategory = 'affordable' | 'market' | 'rgi' | 'supportive' | 'rent-controlled' | 'unspecified';
export type ClaimStage = 'target' | 'planning' | 'approved' | 'construction' | 'occupied' | 'unspecified';
export interface ClaimReading {
  quote: string;
  quantity: string;
  category: ClaimCategory;
  stage: ClaimStage;
  geography: string;
  timeframe: string;
}

export const claimCategories = ['affordable', 'market', 'rgi', 'supportive', 'rent-controlled', 'unspecified'] as const;
export const claimStages = ['target', 'planning', 'approved', 'construction', 'occupied', 'unspecified'] as const;

export function readClaim(text: string): ClaimReading {
  const t = text.toLowerCase();
  const category: ClaimCategory = /rent.geared|\brgi\b/.test(t) ? 'rgi'
    : /supportive/.test(t) ? 'supportive'
    : /affordable/.test(t) ? 'affordable'
    : /market.rent|rent.controlled market/.test(t) ? 'market'
    : /rent.control/.test(t) ? 'rent-controlled' : 'unspecified';
  const stage: ClaimStage = /goal|target|by 20\d\d|will build|pledge|promise|plan to/.test(t) ? 'target'
    : /occupied|delivered|completed|has built|have built|already built/.test(t) ? 'occupied'
    : /under construction|started construction|construction starts/.test(t) ? 'construction'
    : /approv|permit/.test(t) ? 'approved'
    : /propos|planning|review/.test(t) ? 'planning' : 'unspecified';
  return {
    quote: text.trim(),
    quantity: text.match(/\b\d{1,3}(?:,\d{3})+\b|\b\d+(?:\.\d+)?\s*(?:million|thousand)\b|\b\d+\b/i)?.[0] ?? 'Not stated',
    category,
    stage,
    geography: /toronto/i.test(text) ? 'Toronto' : text.match(/ward\s+\d+/i)?.[0] ?? 'Not stated',
    timeframe: text.match(/(?:by|in|since|between|through)\s+20\d{2}(?:\s*(?:and|to|–|-)\s*20\d{2})?/i)?.[0] ?? 'Not stated',
  };
}

export function validateReading(value: unknown): ClaimReading {
  if (!value || typeof value !== 'object') throw new Error('Missing claim reading');
  const v = value as Record<string, unknown>;
  for (const key of ['quote', 'quantity', 'geography', 'timeframe']) {
    if (typeof v[key] !== 'string' || (v[key] as string).length > 4000) throw new Error('Invalid claim field');
  }
  if (!claimCategories.includes(v.category as ClaimCategory) || !claimStages.includes(v.stage as ClaimStage)) throw new Error('Invalid claim category');
  return { quote: v.quote as string, quantity: v.quantity as string, geography: v.geography as string, timeframe: v.timeframe as string, category: v.category as ClaimCategory, stage: v.stage as ClaimStage };
}

export function explainReading(reading: ClaimReading) {
  const notes: string[] = [];
  if (reading.stage === 'target') notes.push('This describes a target or future commitment. It does not establish how many homes have been completed.');
  if (reading.stage === 'approved') notes.push('Approval or a permit is a milestone. It does not by itself establish that construction has started or that homes are occupied.');
  if (reading.stage === 'occupied') notes.push('A delivery claim needs evidence about completed homes, a defined period, and matching geography. This snapshot alone cannot verify a citywide delivery claim.');
  if (reading.stage === 'construction') notes.push('A construction start is different from a completed or occupied home.');
  if (reading.stage === 'unspecified') notes.push('The stage is not clear. Ask whether this number means proposed, approved, under construction, or occupied.');
  if (reading.category === 'rent-controlled') notes.push('Rent-controlled and affordable are different categories. The City reports rent-controlled market homes separately from affordable and RGI homes.');
  if (reading.category === 'unspecified') notes.push('The housing type is not stated. An all-housing number cannot be compared directly with this affordable-housing dataset.');
  if (reading.geography === 'Not stated') notes.push('Confirm the geography before comparing figures.');
  if (reading.timeframe === 'Not stated') notes.push('No clear timeframe was found. A snapshot and a count of homes delivered over several years are not interchangeable.');
  notes.push('This is a reading guide, not a true/false verdict. The map provides context from one City dataset, not a complete audit of the claim.');
  return notes;
}
