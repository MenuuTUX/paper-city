export type Metric = 'affordable' | 'market' | 'rgi' | 'supportive';
export type Stage = 'planning' | 'approved' | 'construction' | 'occupied';
export type StageFilter = Stage | 'all';

export interface Project {
  id: string;
  address: string;
  addresses: string;
  status: string;
  ward: number;
  wardName: string;
  affordable: number;
  market: number;
  rgi: number;
  supportive: number;
  torontoBuilds: boolean;
  coordinates: number[];
}

export const METRICS: Record<Metric, { label: string; short: string; description: string }> = {
  affordable: { label: 'Affordable homes', short: 'affordable', description: 'The City’s “Affordable Homes Approved” field. These are recorded approved counts, grouped by the project’s reported status.' },
  market: { label: 'Rent-controlled market', short: 'rent-controlled market', description: 'Market-rent homes recorded separately by the City. Rent control does not by itself mean a home has an affordable starting rent.' },
  rgi: { label: 'Rent-geared-to-income', short: 'rent-geared-to-income', description: 'The City’s “RGI Homes Approved” field. RGI homes are reported separately; do not add this field to the affordable count without confirming overlap.' },
  supportive: { label: 'Supportive homes', short: 'supportive', description: 'The City’s “Supportive Units” field. This category may overlap with other housing types and is never added to them here.' },
};

export const STAGES: Record<Stage, { label: string; color: string; description: string }> = {
  planning: { label: 'In planning', color: '#aaa99e', description: 'Pre-planning or a planning application under review.' },
  approved: { label: 'Approved & permits', color: '#d47a51', description: 'A planning approval or permit stage. A permit alone does not establish that construction has started.' },
  construction: { label: 'Under construction', color: '#7d9184', description: 'The City labels the project “Started Construction”.' },
  occupied: { label: 'Occupied projects', color: '#294b40', description: 'The City labels the project “Occupied”. This is a project-level status, not an audit of every individual home.' },
};

const statusStages: Record<string, Stage> = {
  'Pre-Planning': 'planning',
  'Planning Applications Under Review': 'planning',
  'Approved OPAs and Zoning By-Law Amendments': 'approved',
  'Approved Site Plan Application': 'approved',
  'Building Permit Application': 'approved',
  'Issued Building Permit': 'approved',
  'Started Construction': 'construction',
  'Occupied': 'occupied',
};

export function getStage(status: string): Stage {
  const stage = statusStages[status];
  if (!stage) throw new Error(`Unrecognised City status: ${status}`);
  return stage;
}

export function selectProjects(projects: Project[], filters: { metric: Metric; stage?: StageFilter; ward?: string; query?: string }) {
  const query = (filters.query ?? '').trim().toLocaleLowerCase();
  return projects.filter(project =>
    project[filters.metric] > 0 &&
    (!filters.ward || filters.ward === 'all' || String(project.ward) === filters.ward) &&
    (!filters.stage || filters.stage === 'all' || getStage(project.status) === filters.stage) &&
    (!query || `${project.address} ${project.addresses} ${project.wardName} ${project.id}`.toLocaleLowerCase().includes(query))
  );
}

export function summarize(projects: Project[], metric: Metric) {
  const byStage: Record<Stage, number> = { planning: 0, approved: 0, construction: 0, occupied: 0 };
  for (const project of projects) byStage[getStage(project.status)] += project[metric];
  return { total: Object.values(byStage).reduce((sum, value) => sum + value, 0), byStage, count: projects.length };
}

export const formatNumber = (value: number) => new Intl.NumberFormat('en-CA').format(value);

export function makeBriefing(options: { projects: Project[]; metric: Metric; ward: string; stage: StageFilter; updated: string; source: string; selected?: Project | null; query?: string }) {
  const { projects, metric, ward, stage, updated, source, selected, query } = options;
  const summary = summarize(projects, metric);
  const area = ward === 'all' ? 'Toronto' : projects[0]?.wardName ?? `Ward ${ward}`;
  return [
    `PAPER CITY · A housing briefing for ${area}`,
    `City source refreshed: ${updated.slice(0, 10)}`,
    `Housing category: ${METRICS[metric].label}`,
    `Stage filter: ${stage === 'all' ? 'All reported stages' : STAGES[stage].label}`,
    ...(query?.trim() ? [`Address / neighbourhood search: ${query.trim()}`] : []),
    '',
    `${formatNumber(summary.total)} recorded units across ${summary.count} projects in this view.`,
    ...Object.entries(summary.byStage).map(([key, value]) => `${STAGES[key as Stage].label}: ${formatNumber(value)} recorded units`),
    '',
    ...(selected ? [`PROJECT IN FOCUS`, `${selected.address} · ${selected.id}`, `Official status: ${selected.status}`, `${METRICS[metric].label}: ${formatNumber(selected[metric])}`, ''] : []),
    'A QUESTION TO TAKE TO A PUBLIC MEETING',
    `What are the next documented milestones for ${METRICS[metric].short} housing projects in ${area}, and how will residents be able to check progress?`,
    '',
    'READ THE NUMBERS CAREFULLY',
    'These are approved-unit fields grouped by a project-level snapshot status. Occupied does not establish that every approved unit is occupied or available. Categories are shown separately because they may overlap. This dataset does not cover every home in Toronto or establish why a project has not progressed.',
    '',
    `Official source: ${source}`,
    'Prepared with Paper City. Candidate-neutral. No endorsements or predictions.',
  ].join('\n');
}
