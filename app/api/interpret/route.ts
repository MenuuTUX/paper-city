import { claimCategories, claimStages, validateReading } from '@/lib/claims';

const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const PROMPT = `Extract fields from a housing statement about Toronto. Do not judge whether it is true. Use only what the text says.
- quantity: the main number as written, or "Not stated".
- category: affordable, market, rgi, supportive, rent-controlled (rent-controlled but type unclear), or unspecified.
- stage: target (goal, pledge, promise, future commitment), planning, approved, construction, occupied (completed or delivered), or unspecified.
- geography: place named, or "Not stated".
- timeframe: dates or period named, or "Not stated".
Statement:
`;

export async function POST(request: Request) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return Response.json({ error: 'not-configured' }, { status: 503 });
  let text = '';
  try { text = String((await request.json()).text ?? '').trim().slice(0, 4000); } catch { return Response.json({ error: 'bad-request' }, { status: 400 }); }
  if (!text) return Response.json({ error: 'bad-request' }, { status: 400 });
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
      signal: AbortSignal.timeout(8000),
      body: JSON.stringify({
        contents: [{ parts: [{ text: PROMPT + text }] }],
        generationConfig: {
          temperature: 0,
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'OBJECT',
            properties: {
              quantity: { type: 'STRING' },
              category: { type: 'STRING', enum: [...claimCategories] },
              stage: { type: 'STRING', enum: [...claimStages] },
              geography: { type: 'STRING' },
              timeframe: { type: 'STRING' },
            },
            required: ['quantity', 'category', 'stage', 'geography', 'timeframe'],
          },
        },
      }),
    });
    if (!res.ok) return Response.json({ error: 'upstream' }, { status: 502 });
    const data = await res.json();
    const parsed = JSON.parse(data.candidates?.[0]?.content?.parts?.[0]?.text ?? '');
    return Response.json(validateReading({ ...parsed, quote: text }));
  } catch {
    return Response.json({ error: 'upstream' }, { status: 502 });
  }
}
