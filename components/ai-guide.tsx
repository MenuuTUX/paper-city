'use client';

import { useState } from 'react';
import { ArrowRight, Sparkles } from 'lucide-react';
import type { Metric, StageFilter } from '@/lib/housing';

export type GuideAnswer = { reply: string; action: 'tour' | 'claim' | 'filter' | 'none'; stage: StageFilter; metric: Metric; ward: string; query: string };
const SUGGESTIONS = ['What is actually being built near Scarborough?', 'I’m new. Where do I start?', 'Show homes under construction'];
const ACTION_LABEL = { tour: 'Start the guided tour', claim: 'Open the headline checker', filter: 'Show these on the map', none: '' } as const;

export function AiGuide({ onTour, onClaim, onFilter }: { onTour: () => void; onClaim: () => void; onFilter: (answer: GuideAnswer) => void }) {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState<GuideAnswer | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  async function ask(message: string) {
    if (!message.trim() || loading) return;
    setLoading(true); setUnavailable(false); setAnswer(null);
    try {
      const res = await fetch('/api/guide', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message }) });
      if (!res.ok) throw new Error('unavailable');
      setAnswer(await res.json());
    } catch { setUnavailable(true); }
    finally { setLoading(false); }
  }
  function run(a: GuideAnswer) { if (a.action === 'tour') onTour(); else if (a.action === 'claim') onClaim(); else if (a.action === 'filter') onFilter(a); }

  return <div className="ai-guide" aria-label="Ask the guide">
    <form onSubmit={event => { event.preventDefault(); ask(text); }}>
      <label htmlFor="guide-input"><Sparkles size={14}/>Not sure where to start? Ask the guide.</label>
      <div className="ai-guide-row">
        <input id="guide-input" maxLength={500} placeholder="What do you want to find out?" value={text} onChange={event => setText(event.target.value)}/>
        <button className="primary-button" type="submit" disabled={loading || !text.trim()}>{loading ? <span className="loader small"/> : <>Ask <ArrowRight size={15}/></>}</button>
      </div>
    </form>
    {!answer && !unavailable && !loading && <div className="ai-guide-chips">{SUGGESTIONS.map(s => <button key={s} type="button" onClick={() => { setText(s); ask(s); }}>{s}</button>)}</div>}
    {answer && <div className="ai-guide-answer" role="status"><p>{answer.reply}</p>{answer.action !== 'none' && <button className="text-button" onClick={() => run(answer)}>{ACTION_LABEL[answer.action]} <ArrowRight size={14}/></button>}<small>AI guide, powered by Google Gemini. It reads the City’s snapshot totals and never judges a claim.</small></div>}
    {unavailable && <div className="ai-guide-answer" role="status"><p>The guide is resting right now. The tour is the best way in.</p><button className="text-button" onClick={onTour}>Start the guided tour <ArrowRight size={14}/></button></div>}
  </div>;
}
