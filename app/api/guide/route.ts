import snapshot from '@/data/housing.json';
import { METRICS, STAGES, selectProjects, summarize, type Metric, type Project } from '@/lib/housing';

const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const projects = snapshot.projects as Project[];
const wards = Array.from(new Map(projects.map(p => [p.ward, p.wardName]))).sort((a, b) => a[0] - b[0]);
const facts = [
  `Dataset: City of Toronto Affordable Housing Pipeline, ${projects.length} projects, refreshed ${snapshot.updated.slice(0, 10)}.`,
  ...(Object.keys(METRICS) as Metric[]).map(metric => {
    const s = summarize(selectProjects(projects, { metric }), metric);
    return `${METRICS[metric].label}: ${s.total} recorded units in ${s.count} projects (planning ${s.byStage.planning}, approved ${s.byStage.approved}, construction ${s.byStage.construction}, occupied ${s.byStage.occupied}).`;
  }),
  `Wards: ${wards.map(([n, name]) => `${n}=${name}`).join('; ')}.`,
].join('\n');

const PROMPT = `You are the guide on Paper City, a candidate-neutral field guide to Toronto's affordable housing records ahead of the 2026 municipal election.
Help the visitor find what they are looking for, then pick ONE action for the site to run.
Rules:
- Use only the facts below for any number. Never invent figures, addresses or dates.
- Never recommend candidates, predict the election, or say whether a claim is true or false.
- Stages: planning, approved (permits are not construction), construction, occupied (a project status, not every home).
- reply: at most 2 short sentences, plain language, friendly.
- action "tour" for someone new or confused; "claim" if they paste or mention a headline or statement to check; "filter" to show matching projects (set stage, metric, ward as a number string or "all", and query for an address or neighbourhood, else empty); "none" if the question is off-topic, and say what the site can do.
Facts:
${facts}
Visitor says:
`;

const stages = ['all', ...Object.keys(STAGES)];
const metrics = Object.keys(METRICS);

export async function POST(request: Request) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return Response.json({ error: 'not-configured' }, { status: 503 });
  let message = '';
  try { message = String((await request.json()).message ?? '').trim().slice(0, 500); } catch { return Response.json({ error: 'bad-request' }, { status: 400 }); }
  if (!message) return Response.json({ error: 'bad-request' }, { status: 400 });
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
      signal: AbortSignal.timeout(9000),
      body: JSON.stringify({
        contents: [{ parts: [{ text: PROMPT + message }] }],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'OBJECT',
            properties: {
              reply: { type: 'STRING' },
              action: { type: 'STRING', enum: ['tour', 'claim', 'filter', 'none'] },
              stage: { type: 'STRING', enum: stages },
              metric: { type: 'STRING', enum: metrics },
              ward: { type: 'STRING' },
              query: { type: 'STRING' },
            },
            required: ['reply', 'action', 'stage', 'metric', 'ward', 'query'],
          },
        },
      }),
    });
    if (!res.ok) return Response.json({ error: 'upstream' }, { status: 502 });
    const data = await res.json();
    const out = JSON.parse(data.candidates?.[0]?.content?.parts?.[0]?.text ?? '');
    const ward = wards.some(([n]) => String(n) === out.ward) ? out.ward : 'all';
    return Response.json({
      reply: String(out.reply).slice(0, 400),
      action: ['tour', 'claim', 'filter', 'none'].includes(out.action) ? out.action : 'none',
      stage: stages.includes(out.stage) ? out.stage : 'all',
      metric: metrics.includes(out.metric) ? out.metric : 'affordable',
      ward,
      query: String(out.query ?? '').slice(0, 80),
    });
  } catch {
    return Response.json({ error: 'upstream' }, { status: 502 });
  }
}
