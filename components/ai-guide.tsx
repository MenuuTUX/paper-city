'use client';

import { useRef, useState } from 'react';
import { ArrowRight, Sparkles } from 'lucide-react';
import { formatNumber, type Metric, type StageFilter } from '@/lib/housing';

export type GuideAnswer = { reply: string; action: 'tour' | 'claim' | 'filter' | 'none'; stage: StageFilter; metric: Metric; ward: string; query: string };
type Preview = { count: number; total: number; label: string };
const SUGGESTIONS = ['What is actually being built near Scarborough?', 'I’m new. Where do I start?', 'Show homes under construction'];
const ACTION_LABEL = { tour: 'Start the guided tour', claim: 'Open the headline checker', filter: 'Show these on the map', none: '' } as const;

export function AiGuide({ onTour, onClaim, onFilter, preview }: { onTour: () => void; onClaim: () => void; onFilter: (answer: GuideAnswer) => void; preview: (answer: GuideAnswer) => Preview }) {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState<GuideAnswer | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const input = useRef<HTMLInputElement>(null);

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
  const match = answer?.action === 'filter' ? preview(answer) : null;

  return <section className="ai-guide" id="ask-guide" aria-label="Ask the guide">
    <div className="ai-guide-head">
      <span className="ai-guide-icon" aria-hidden="true"><Sparkles size={20}/></span>
      <div><h2>Ask the guide</h2><p>Tell it what you want to know about Toronto housing. It finds the right records for you.</p></div>
      <span className="ai-guide-badge">Powered by Google Gemini</span>
    </div>
    <form onSubmit={event => { event.preventDefault(); ask(text); }}>
      <div className="ai-guide-row">
        <input ref={input} id="guide-input" aria-label="Ask the guide a question" maxLength={500} placeholder="e.g. What is actually being built near me?" value={text} onChange={event => setText(event.target.value)}/>
        <button className="primary-button" type="submit" disabled={loading || !text.trim()}>{loading ? <><span className="loader small"/>Thinking</> : <>Ask <ArrowRight size={16}/></>}</button>
      </div>
    </form>
    {!answer && !unavailable && !loading && <div className="ai-guide-chips">{SUGGESTIONS.map(s => <button key={s} type="button" onClick={() => { setText(s); ask(s); }}>{s}</button>)}</div>}
    {answer && <div className="ai-guide-answer" role="status">
      <p>{answer.reply}</p>
      {match && <div className="ai-guide-match"><strong>{formatNumber(match.count)}</strong> projects<span/><strong>{formatNumber(match.total)}</strong> recorded {match.label} units<small>Counted from the City’s snapshot</small></div>}
      {answer.action !== 'none' && <button className="primary-button" onClick={() => run(answer)}>{ACTION_LABEL[answer.action]} <ArrowRight size={16}/></button>}
      <small>It reads the City’s snapshot totals only. It never judges a claim or recommends a candidate.</small>
    </div>}
    {unavailable && <div className="ai-guide-answer" role="status"><p>The guide is resting right now. The tour is the best way in.</p><button className="primary-button" onClick={onTour}>Start the guided tour <ArrowRight size={16}/></button></div>}
  </section>;
}
