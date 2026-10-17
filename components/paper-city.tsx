'use client';

import dynamic from 'next/dynamic';
import { ProjectSearch, PinnedPlaces, StageDisclosure } from './project-tools';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUpRight, BookOpen, Bookmark, Check, ChevronDown, ChevronLeft, ChevronRight, Clipboard, Download, ExternalLink, FileText, HelpCircle, ImagePlus, Link2, MapPin, Play, Search, SlidersHorizontal, Sparkles, X } from 'lucide-react';
import { formatNumber, getStage, makeBriefing, METRICS, selectProjects, STAGES, summarize, type Metric, type Project, type Stage, type StageFilter } from '@/lib/housing';
import { explainReading, readClaim, type ClaimReading, type ClaimCategory, type ClaimStage } from '@/lib/claims';

const HousingMap = dynamic(() => import('./city-map'), { ssr: false, loading: () => <div className="map-loading"><span className="loader"/>Unfolding Toronto…</div> });
type Snapshot = { source: string; api: string; title: string; updated: string; retrieved: string; projects: Project[] };
const stageKeys: Stage[] = ['planning', 'approved', 'construction', 'occupied'];
const CHAPTERS = [
  { eyebrow: 'Start with the full picture', title: 'What does a housing number count?', text: 'These markers are real affordable housing projects in Toronto. The total includes several stages of progress. It is not a count of homes completed. Next, we’ll look at three actual projects.', stage: 'all' as StageFilter, takeaway: 'Your task: distinguish a plan, a construction start, and a project marked occupied. Then use the same questions on a housing headline.' },
  { eyebrow: '02 / THE CITY ON PAPER', title: 'Approved does not mean finished.', text: 'Planning approvals and permits move a project forward. But a recorded approval does not mean someone can move in.', stage: 'approved' as StageFilter, takeaway: 'Follow the official status. Approval, permits, and construction are different milestones.' },
  { eyebrow: '03 / FROM PAPER TO PROGRESS', title: 'Construction is a separate stage.', text: 'For these projects, the City records that construction has started. Something is taking shape, but these homes are not yet recorded as occupied.', stage: 'construction' as StageFilter, takeaway: 'A construction start is progress. It is still different from a completed home.' },
  { eyebrow: '04 / A PLACE TO CALL HOME', title: 'Occupied is a different claim.', text: 'These projects are marked occupied in the City’s snapshot. It is a different picture from the one you saw at the start.', stage: 'occupied' as StageFilter, takeaway: '“Occupied” is a project-level status. It does not prove that every approved home is occupied or available.' },
];
const TOUR_ADDRESSES = ['', '591 Dundas St E', '49 Ontario St', '373 Front St E'];

function Logo() {
  return <span className="brand"><img className="brand-mark" src="/logo-mark.svg" width="44" height="58" alt=""/><span>Paper City</span></span>;
}

function AnimatedNumber({ value }: { value: number }) {
  const [shown, setShown] = useState(value);
  const previous = useRef(value);
  useEffect(() => {
    const from = previous.current;
    previous.current = value;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setShown(value); return; }
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const progress = Math.min((now - start) / 650, 1);
      setShown(Math.round(from + (value - from) * (1 - Math.pow(1 - progress, 3))));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return <>{formatNumber(shown)}</>;
}

function Modal({ title, onClose, children, wide = false }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { const el = dialog.current; el?.showModal(); return () => el?.close(); }, []);
  return <dialog ref={dialog} className={`dialog ${wide ? 'wide' : ''}`} onCancel={onClose} onClick={event => { if (event.target === event.currentTarget) { const r = event.currentTarget.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) onClose(); } }} aria-labelledby="dialog-title"><div className="dialog-head"><span className="eyebrow">PAPER CITY / FIELD NOTES</span><button className="icon-button" aria-label="Close dialog" onClick={onClose}><X size={20}/></button></div><h2 id="dialog-title">{title}</h2>{children}</dialog>;
}

export default function PaperCity({ snapshot }: { snapshot: Snapshot }) {
  const [metric, setMetric] = useState<Metric>('affordable');
  const [stage, setStage] = useState<StageFilter>('all');
  const [ward, setWard] = useState('all');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [panel, setPanel] = useState<'projects' | 'claim'>('projects');
  const [modal, setModal] = useState<'briefing' | 'method' | 'search' | 'pins' | null>(null);
  const [pinnedIds, setPinnedIds] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState('');
  const [limit, setLimit] = useState(30);
  const [journey, setJourney] = useState<number | null>(null);
  const [urlReady, setUrlReady] = useState(false);
  const workspace = useRef<HTMLDivElement>(null);
  const projectScrollRequested = useRef(false);

  useEffect(() => {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem('paper-city-pins') || '[]');
      if (Array.isArray(saved)) setPinnedIds(saved.filter((id): id is string => typeof id === 'string' && snapshot.projects.some(project => project.id === id)).slice(0, 30));
    } catch { setToast('Saved places could not be loaded in this browser.'); }
    const shortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k' && !document.querySelector('.journey-mode')) {
        event.preventDefault(); setModal('search');
      }
    };
    window.addEventListener('keydown', shortcut);
    return () => window.removeEventListener('keydown', shortcut);
  }, [snapshot.projects]);

  function togglePin(id: string) {
    const removing = pinnedIds.includes(id);
    if (!removing && pinnedIds.length >= 30) { setToast('You can pin up to 30 places. Remove one to add another.'); return; }
    const next = removing ? pinnedIds.filter(value => value !== id) : [...pinnedIds, id];
    setPinnedIds(next);
    try { localStorage.setItem('paper-city-pins', JSON.stringify(next)); setToast(removing ? 'Place unpinned.' : 'Place pinned. Find it in Saved places.'); }
    catch { setToast('Pinned for this visit. Your browser could not save it for later.'); }
  }
  function openProject(id: string) {
    projectScrollRequested.current = true;
    setMetric('affordable'); setStage('all'); setWard('all'); setQuery(''); setSelectedId(id); setPanel('projects'); setModal(null);
  }
  useEffect(() => {
    if (!projectScrollRequested.current || journey !== null || !selectedId) return;
    const frame = requestAnimationFrame(() => {
      projectScrollRequested.current = false;
      workspace.current?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
    });
    return () => cancelAnimationFrame(frame);
  }, [selectedId, journey, modal]);

  const wards = useMemo(() => Array.from(new Map(snapshot.projects.map(p => [p.ward, p.wardName]))).sort((a,b) => a[0]-b[0]), [snapshot.projects]);
  const areaProjects = useMemo(() => selectProjects(snapshot.projects, { metric, ward }), [snapshot.projects, metric, ward]);
  const areaSummary = useMemo(() => summarize(areaProjects, metric), [areaProjects, metric]);
  const visibleProjects = useMemo(() => selectProjects(snapshot.projects, { metric, stage, ward, query }).sort((a,b) => b[metric]-a[metric] || a.address.localeCompare(b.address)), [snapshot.projects, metric, stage, ward, query]);
  const selected = snapshot.projects.find(p => p.id === selectedId) ?? null;
  const introductionProject = snapshot.projects.find(project => project.address === '591 Dundas St E' && getStage(project.status) === 'approved') ?? snapshot.projects.find(project => project.affordable > 0 && getStage(project.status) === 'approved');
  const areaName = ward === 'all' ? 'Toronto' : wards.find(([number]) => String(number) === ward)?.[1] ?? 'Toronto';
  const visibleSummary = summarize(visibleProjects, metric);
  const sourceDate = new Intl.DateTimeFormat('en-CA', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(snapshot.updated.replace(' ', 'T') + 'Z'));
  const briefing = makeBriefing({ projects: visibleProjects, metric, ward, stage, updated: snapshot.updated, source: snapshot.source, selected, query });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has('metric') && params.get('metric')! in METRICS) setMetric(params.get('metric') as Metric);
    if (params.has('stage') && ['all', ...stageKeys].includes(params.get('stage')!)) setStage(params.get('stage') as StageFilter);
    if (params.get('ward') === 'all' || wards.some(([n]) => String(n) === params.get('ward'))) setWard(params.get('ward')!);
    if (snapshot.projects.some(p => p.id === params.get('project'))) setSelectedId(params.get('project'));
    if (params.has('q')) setQuery(params.get('q')!.slice(0, 200));
    if (params.get('panel') === 'claim') setPanel('claim');
    setUrlReady(true);
  }, [snapshot.projects, wards]);

  useEffect(() => {
    if (!urlReady || journey !== null) return;
    const params = new URLSearchParams();
    if (metric !== 'affordable') params.set('metric', metric);
    if (stage !== 'all') params.set('stage', stage);
    if (ward !== 'all') params.set('ward', ward);
    if (selectedId) params.set('project', selectedId);
    if (query) params.set('q', query);
    if (panel === 'claim') params.set('panel', panel);
    window.history.replaceState(null, '', `${window.location.pathname}${params.size ? '?' + params.toString() : ''}${window.location.hash}`);
  }, [metric, stage, ward, selectedId, query, panel, urlReady, journey]);

  useEffect(() => { if (!toast) return; const timeout = setTimeout(() => setToast(''), 3200); return () => clearTimeout(timeout); }, [toast]);
  useEffect(() => { setLimit(30); }, [query, metric, stage, ward]);
  useEffect(() => {
    if (journey === null) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    workspace.current?.querySelector<HTMLElement>('.journey-card h2')?.focus({ preventScroll: true });
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        const focusable = Array.from(workspace.current?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], [tabindex="0"]') ?? []);
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && (document.activeElement === first || !workspace.current?.contains(document.activeElement))) { e.preventDefault(); last?.focus(); }
        else if (!e.shiftKey && (document.activeElement === last || !workspace.current?.contains(document.activeElement))) { e.preventDefault(); first?.focus(); }
      }
      if (e.key === 'Escape') endJourney();
      if (e.key === 'ArrowRight' && journey < 3) changeChapter(journey + 1);
      if (e.key === 'ArrowLeft' && journey > 0) changeChapter(journey - 1);
    };
    window.addEventListener('keydown', key);
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener('keydown', key); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [journey]);

  function changeChapter(index: number) {
    setMetric('affordable'); setWard('all'); setQuery(''); setStage(CHAPTERS[index].stage); setJourney(index);
    const candidates = [...snapshot.projects].filter(p => getStage(p.status) === CHAPTERS[index].stage && p.affordable > 0).sort((a,b) => b.affordable-a.affordable);
    const featured = index === 0 ? null : candidates.find(p => p.address === TOUR_ADDRESSES[index]) ?? candidates[0];
    setSelectedId(featured?.id ?? null);
  }
  function endJourney() { setJourney(null); setStage('all'); setSelectedId(null); setPanel('projects'); }
  function resetFilters() { setMetric('affordable'); setStage('all'); setWard('all'); setQuery(''); setSelectedId(null); }
  const selectProject = useCallback((id: string) => { setSelectedId(id); if (journey === null) setPanel('projects'); }, [journey]);
  function scrollToClaim() {
    const target = window.innerWidth <= 760 ? workspace.current?.querySelector('.claim-panel') : workspace.current;
    target?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
  }
  useEffect(() => {
    if (!urlReady || panel !== 'claim' || journey !== null) return;
    const frame = requestAnimationFrame(scrollToClaim);
    return () => cancelAnimationFrame(frame);
  }, [panel, urlReady, journey]);
  function showClaims() { setPanel('claim'); setSelectedId(null); if (panel === 'claim') scrollToClaim(); }

  async function copy(text: string) {
    try { await navigator.clipboard.writeText(text); setCopied(true); setToast('Copied. Take the evidence with you.'); setTimeout(() => setCopied(false), 2200); }
    catch { setToast('Clipboard unavailable. Use Download to save the briefing.'); }
  }
  function downloadBriefing() {
    const url = URL.createObjectURL(new Blob([briefing], { type: 'text/plain;charset=utf-8' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `paper-city-${areaName.toLowerCase().replaceAll(' ', '-')}.txt`; anchor.click(); URL.revokeObjectURL(url);
  }

  return <>
    <div className="reading-progress" aria-hidden="true"/>
    <a className="skip-link" href="#explore">Skip to housing explorer</a>
    <header className="site-header"><div className="header-inner"><a href="/" aria-label="Paper City home"><Logo/></a><nav aria-label="Main navigation"><button onClick={() => changeChapter(0)}>Guided tour</button><a href="#explore">Explore projects</a><button onClick={() => setModal('method')}>About the data</button></nav><div className="header-tools"><button className="header-search" onClick={() => setModal('search')} aria-label="Search all projects"><Search size={16}/><span>Find a place</span><kbd>⌘ K</kbd></button><button className="header-pins" onClick={() => setModal('pins')} aria-label={`Saved places, ${pinnedIds.length} pinned`}><Bookmark size={16}/><span>{pinnedIds.length || 'Saved'}</span></button><button className="header-briefing" onClick={() => setModal('briefing')}>Your field notes <ArrowUpRight size={15}/></button></div></div></header>

    <main>
      <section className="hero page-width welcome-hero" aria-labelledby="welcome-title">
        <div className="hero-copy">
          <h1 id="welcome-title">Housing promises,<br/>made clear.</h1>
          <p className="welcome-explanation">A promise to build homes isn’t the same as a home someone can move into. Follow Toronto’s affordable housing projects from planning to occupancy, using the City’s own records.</p>
          <div className="welcome-actions"><button className="primary-button" onClick={() => changeChapter(0)}>Start here: take the tour <ArrowRight size={18}/></button><button className="text-button" onClick={showClaims}>I have a housing headline <ArrowUpRight size={16}/></button></div>
          <p className="civic-purpose">For Toronto’s 2026 municipal election. Independent and candidate-neutral.</p>
        </div>
        {introductionProject && <aside className="welcome-example" aria-label="A real example from the City records">
          <h2>An approval.<br/>Not a finished home.</h2>
          <p>At <strong>{introductionProject.address}</strong>, the City records <strong>{formatNumber(introductionProject.affordable)} affordable units</strong> in a project marked <strong>approved &amp; permits</strong>.</p>
          <p>That tells us something different from “{formatNumber(introductionProject.affordable)} homes completed.”</p>
          <button className="text-button" onClick={() => openProject(introductionProject.id)}>See this project on the map <ArrowUpRight size={17}/></button>
          <small>City of Toronto pipeline · {sourceDate}</small>
        </aside>}
      </section>

      <section className="start-path page-width" aria-label="How to use Paper City"><p><strong>A housing number is only the start.</strong> Find the project, check its reported stage, then take a sourced question to a public meeting or an election conversation.</p><button onClick={() => setModal('method')}>What can this data tell me? <ArrowUpRight size={15}/></button></section>

      <section className="stats-strip page-width" aria-label="Housing snapshot for selected area"><div className="snapshot-label"><span className="live-dot"/><span>THE PUBLIC RECORD<small>City snapshot · {sourceDate}</small></span></div><div className="stat"><strong><AnimatedNumber value={areaSummary.total}/></strong><span>recorded {METRICS[metric].short} units<HelpCircle size={12} aria-label="Counts use approved-unit fields grouped by project status"/></span></div><div className="stat"><strong><AnimatedNumber value={areaSummary.byStage.occupied}/></strong><span>in projects marked occupied</span></div><div className="stat compact"><strong><AnimatedNumber value={areaSummary.count}/><span className="stat-unit"> projects</span></strong><span>across {areaName}</span></div><button className="claim-invite" onClick={showClaims}><span className="claim-icon"><Sparkles size={18}/></span><span>Big housing headline?<small>Let’s read the fine print.</small></span><ArrowUpRight size={18}/></button></section>

      <section className="explorer page-width" data-ui id="explore" aria-label="Toronto housing explorer">
        <div className="explorer-toolbar"><div className="toolbar-title"><span className="eyebrow">Explore the housing records</span><span className="toolbar-separator"/><span>{formatNumber(visibleProjects.length)} projects in view</span></div><div className="toolbar-filters"><label className="select-shell"><MapPin size={14}/><select aria-label="Filter by ward" value={ward} onChange={e => { setWard(e.target.value); setSelectedId(null); }}><option value="all">All of Toronto</option>{wards.map(([number,name]) => <option key={number} value={number}>{number} · {name}</option>)}</select><ChevronDown size={13}/></label><label className="select-shell metric-select"><SlidersHorizontal size={14}/><select aria-label="Housing category" value={metric} onChange={e => { setMetric(e.target.value as Metric); setSelectedId(null); }}>{Object.entries(METRICS).map(([key,value]) => <option key={key} value={key}>{value.label}</option>)}</select><ChevronDown size={13}/></label></div></div>

        <div ref={workspace} className={`workspace ${journey !== null ? 'journey-mode' : ''}`} role={journey !== null ? 'dialog' : undefined} aria-modal={journey !== null ? true : undefined} aria-label={journey !== null ? 'The city, unfolded: an interactive housing journey' : undefined}>
          <div className="map-frame"><HousingMap projects={visibleProjects} metric={metric} selected={selected} onSelect={selectProject} ward={ward} journey={journey}/>
            {journey === null && <><div className="map-heading"><span className="map-heading-dot"/><span>TORONTO, ON<small>Choose an address to see its status.</small></span></div><StageDisclosure stage={stage} onChange={next => { setStage(next); setSelectedId(null); }}/>{selected && <button className="mobile-record-link" onClick={() => workspace.current?.querySelector('.project-detail')?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' })}>Read this project’s record <ArrowDown size={15}/></button>}<button className="map-guide" onClick={() => changeChapter(0)}><Play size={12} fill="currentColor"/>New here? Start the guided tour <ArrowRight size={13}/></button></>}
          </div>

          {journey === null ? <aside className="side-panel" aria-label="Project records and claim reader"><div className="panel-tabs fluid-tabs" style={{ '--tab-index': panel === 'projects' ? 0 : 1 } as React.CSSProperties}><button className={panel === 'projects' ? 'active' : ''} onClick={() => setPanel('projects')}><MapPin size={14}/>Find a project<span>{visibleProjects.length}</span></button><button className={panel === 'claim' ? 'active' : ''} onClick={() => { setPanel('claim'); setSelectedId(null); }}><Sparkles size={14}/>Check a headline</button></div>
            {panel === 'claim' ? <ClaimPanel onApply={reading => { if (reading.category in METRICS) setMetric(reading.category as Metric); if (stageKeys.includes(reading.stage as Stage)) setStage(reading.stage as Stage); else setStage('all'); const wardMatch = reading.geography.match(/ward\s+(\d+)/i); setWard(wardMatch && wards.some(([n]) => String(n) === wardMatch[1]) ? wardMatch[1] : 'all'); setQuery(''); setSelectedId(null); setToast('Map updated. This snapshot is context, not a verdict.'); }} /> : selected ? <ProjectDetail project={selected} metric={metric} source={snapshot.source} sourceDate={sourceDate} onBack={() => setSelectedId(null)} onBriefing={() => setModal('briefing')} pinned={pinnedIds.includes(selected.id)} onPin={() => togglePin(selected.id)}/> : <><div className="panel-intro"><h2>Find a place.<br/>Check its progress.</h2><p>Search an address or choose a project below. Its record shows the stage, unit counts, and source.</p><label className="search-field"><Search size={16}/><input aria-label="Search projects by address or neighbourhood" placeholder="Search an address or neighbourhood" value={query} onChange={e => { setQuery(e.target.value); setSelectedId(null); }}/>{query && <button aria-label="Clear search" onClick={() => setQuery('')}><X size={14}/></button>}</label></div><div className="project-list"><div className="list-label"><span>{stage === 'all' ? 'ALL REPORTED STAGES' : STAGES[stage].label.toUpperCase()}</span><span>{METRICS[metric].short.toUpperCase()} UNITS</span></div>{visibleProjects.length === 0 ? <div className="empty-state"><Search size={26}/><h3>No projects in this view.</h3><p>Try another address, housing category, or ward.</p><button className="text-button" onClick={resetFilters}>Reset the filters <ArrowRight size={14}/></button></div> : visibleProjects.slice(0,limit).map(project => <button className="project-row" key={project.id} onClick={() => selectProject(project.id)}><span className="project-building" style={{ '--stage-color': STAGES[getStage(project.status)].color } as React.CSSProperties}><span/><span/><span/></span><span className="project-row-copy"><strong>{project.address}</strong><span>{project.wardName}</span><small><i style={{ background: STAGES[getStage(project.status)].color }}/>{STAGES[getStage(project.status)].label}</small></span><span className="project-row-count">{formatNumber(project[metric])}<ChevronRight size={13}/></span></button>)}{visibleProjects.length > limit && <button className="load-more" onClick={() => setLimit(l => l + 30)}>Show more projects <ArrowDown size={14}/></button>}</div><div className="panel-foot"><span className="live-dot"/>Real City data. No invented buildings.<button aria-label="Read data methodology" onClick={() => setModal('method')}><HelpCircle size={14}/></button></div></>}
          </aside> : <><div className="journey-top"><Logo/><span>A guide to Toronto’s housing records</span><button onClick={endJourney}>Back to exploring <X size={18}/></button></div><div className="journey-card" key={journey}><span className="eyebrow">{CHAPTERS[journey].eyebrow}</span><h2 tabIndex={-1}>{CHAPTERS[journey].title}</h2><p>{CHAPTERS[journey].text}</p><div className="journey-number"><strong><AnimatedNumber value={visibleSummary.total}/></strong><span>recorded affordable units<br/>{journey === 0 ? 'across all reported stages' : `in ${STAGES[CHAPTERS[journey].stage as Stage].label.toLowerCase()}`}</span></div>{selected && <button className="journey-project" onClick={() => { const id = selected.id; endJourney(); setSelectedId(id); }}><MapPin size={16}/><span><strong>{selected.address}</strong><small>{formatNumber(selected.affordable)} recorded affordable units</small></span><ArrowUpRight size={16}/></button>}<div className="journey-takeaway"><BookOpen size={16}/><p>{CHAPTERS[journey].takeaway}</p></div><div className="journey-actions"><button className="icon-button" aria-label="Previous chapter" disabled={journey === 0} onClick={() => changeChapter(journey-1)}><ArrowLeft size={19}/></button><span>{String(journey+1).padStart(2,'0')} <span>/ 04</span></span><button className="primary-button" onClick={() => { if (journey === 3 && selected) { endJourney(); openProject(selected.id); } else changeChapter(journey+1); }}>{journey === 3 ? 'Open this project’s record' : ['See an approved project','See construction','See an occupied project'][journey]}<ArrowRight size={16}/></button></div></div><div className="journey-progress">{CHAPTERS.map((chapter,index) => <button aria-label={`Chapter ${index+1}: ${chapter.title}`} aria-current={journey === index ? 'step' : undefined} className={journey === index ? 'active' : ''} key={index} onClick={() => changeChapter(index)}><span/><small>{['The promise','On paper','Breaking ground','A place to live'][index]}</small></button>)}</div><span className="journey-hint">Select a marker to focus on its recorded location</span></>}
        </div>

        <div className="stage-ribbon"><div className="ribbon-title"><span className="eyebrow">THE BIGGER PICTURE</span><span>{METRICS[metric].label} · {areaName}</span></div><div className="stage-distribution" aria-label="Distribution by project stage">{stageKeys.map(key => <button title={`${STAGES[key].label}: ${formatNumber(areaSummary.byStage[key])}`} key={key} style={{ flex: areaSummary.byStage[key] || 0.01, background: STAGES[key].color }} onClick={() => { setStage(stage === key ? 'all' : key); setSelectedId(null); }} aria-label={`Show ${STAGES[key].label}`}/>)}</div><div className="ribbon-legend">{stageKeys.map(key => <button key={key} className={stage === key ? 'active' : ''} onClick={() => { setStage(stage === key ? 'all' : key); setSelectedId(null); }}><i style={{ background: STAGES[key].color }}/><span>{STAGES[key].label}</span><strong>{formatNumber(areaSummary.byStage[key])}</strong></button>)}</div></div>
        <div className="explorer-note"><span><HelpCircle size={13}/>Recorded approved-unit counts grouped by project status. Categories may overlap; we never add them together.</span><button onClick={() => setModal('method')}>Read the data notes <ArrowUpRight size={13}/></button></div>
      </section>

      <section className="how-section page-width" id="how-it-works"><div className="how-heading"><h2>From a claim<br/>to a better question.</h2><p>Toronto’s housing debate is full of big numbers. Paper City helps you ask what those numbers actually mean before you use them.</p><button className="text-button" onClick={showClaims}>Bring a headline <ArrowUpRight size={16}/></button></div><div className="how-steps"><div><div><h3>Identify the claim.</h3><p>Paste a statement or upload a screenshot. Identify what’s being counted, where, and by when.</p></div><FileText size={20}/></div><div><div><h3>Follow the public record.</h3><p>Explore actual projects. See the reported stage and trace every number back to the City’s source.</p></div><MapPin size={20}/></div><div><div><h3>Save a sourced question.</h3><p>Save a field note for your next public meeting, community conversation, or election-season debate.</p></div><ArrowUpRight size={20}/></div></div></section>

      <section className="closing-note page-width"><span className="note-mark">“</span><p>Bring the evidence<br/>to the conversation.</p><button className="primary-button" onClick={() => setModal('briefing')}>Save your current view <ArrowUpRight size={16}/></button></section>
    </main>
    <footer className="site-footer page-width"><Logo/><p>Made for the city we share.<span>Independent. Candidate-neutral. Grounded in public data.</span></p><a href={snapshot.source} target="_blank" rel="noreferrer">Toronto Open Data <ArrowUpRight size={14}/></a><span className="footer-edition">TORONTO / FIELD GUIDE Nº 001</span></footer>

    {modal === 'search' && <Modal title="Find your place." onClose={() => setModal(null)}><ProjectSearch projects={snapshot.projects.filter(project => project.affordable > 0)} onSelect={openProject}/></Modal>}
    {modal === 'pins' && <Modal title="Your pinned places." onClose={() => setModal(null)}><PinnedPlaces projects={pinnedIds.flatMap(id => snapshot.projects.find(project => project.id === id) ?? [])} onSelect={openProject} onRemove={togglePin}/></Modal>}
    {modal === 'method' && <Modal title="The details matter." onClose={() => setModal(null)}><div className="method-content"><p>Paper City uses the City of Toronto’s Affordable Housing Pipeline, a quarterly snapshot of {snapshot.projects.length} projects. The source was refreshed on <strong>{sourceDate}</strong>.</p><details className="source-accordion"><summary>What the stacks mean<ChevronDown size={16}/></summary><p>Each stack sits at a project’s reported coordinates. Its size represents the selected category’s recorded count. It is a data symbol with square-root height scaling, not a model of an actual building. The neutral 3D buildings use OpenStreetMap footprints and reported heights when available; missing heights use a schematic 8 metres. Basemap imagery is not evidence of current project completion.</p></details><details className="source-accordion"><summary>Approved counts, reported stages<ChevronDown size={16}/></summary><p>The affordable, market, and RGI fields are approved-unit counts. We group those counts by the project’s current status. “Occupied” describes a project, not verified occupancy of every individual home. The snapshot does not establish when a stage began or why a project has not progressed.</p></details><details className="source-accordion"><summary>Four categories, kept separate<ChevronDown size={16}/></summary><p>Affordable, rent-controlled market, rent-geared-to-income, and supportive homes are different fields. Some can overlap. We never sum categories or treat market rent as affordable rent.</p></details><details className="source-accordion"><summary>What this dataset leaves out<ChevronDown size={16}/></summary><p>This is not an inventory of every home or available rental in Toronto. It cannot alone verify a citywide claim about homes completed during a particular term. Missing records do not prove that a home does not exist.</p></details><details className="source-accordion"><summary>How the claim reader works<ChevronDown size={16}/></summary><p>Screenshots are read on your device with Tesseract OCR; images never leave the browser. The statement text is sent to Google Gemini to extract the housing type, stage, geography and timeframe into editable fields. If Gemini is unavailable, a rule-based source guide does the same offline. Neither issues a true/false verdict. All map totals are calculated directly from the bundled City snapshot.</p></details><div className="source-links"><a href={snapshot.source} target="_blank" rel="noreferrer">Open the official dataset <ExternalLink size={14}/></a><a href={snapshot.api} target="_blank" rel="noreferrer">Inspect the raw City records <ExternalLink size={14}/></a></div></div></Modal>}
    {modal === 'briefing' && <Modal title="Take the evidence with you." wide onClose={() => setModal(null)}><p className="dialog-description">Your current view, its sources, and a question worth asking.</p><div className="briefing-paper"><span className="eyebrow">PAPER CITY / YOUR FIELD NOTE</span><pre>{briefing}</pre></div><div className="briefing-actions"><button className="secondary-button" onClick={() => copy(window.location.href)}><Link2 size={15}/>Share this view</button><button className="secondary-button" onClick={() => copy(briefing)}>{copied ? <Check size={15}/> : <Clipboard size={15}/>}Copy field note</button><button className="primary-button" onClick={downloadBriefing}><Download size={15}/>Download</button></div></Modal>}
    {toast && <div className="toast" role="status"><Check size={16}/>{toast}</div>}
  </>;
}

function ProjectDetail({ project, metric, source, sourceDate, onBack, onBriefing, pinned, onPin }: { project: Project; metric: Metric; source: string; sourceDate: string; onBack: () => void; onBriefing: () => void; pinned: boolean; onPin: () => void }) {
  const stage = getStage(project.status);
  return <div className="project-detail" key={project.id}><button className="text-button back-button" onClick={onBack}><ArrowLeft size={14}/>All projects</button><button className="pin-place-button" aria-pressed={pinned} onClick={onPin}><Bookmark size={15} fill={pinned ? 'currentColor' : 'none'}/>{pinned ? 'Place pinned' : 'Pin this place'}</button><span className="eyebrow">PROJECT {project.id} / WARD {project.ward}</span><h2>{project.address}</h2><p className="detail-ward"><MapPin size={13}/>{project.wardName}</p><div className="detail-stage" style={{ '--stage-color': STAGES[stage].color } as React.CSSProperties}><i/>{STAGES[stage].label}</div><div className="detail-count"><strong>{formatNumber(project[metric])}</strong><span>recorded {METRICS[metric].short} units</span></div><div className="detail-milestones" aria-label="Project progress">{stageKeys.map((key,index) => <span key={key} className={stageKeys.indexOf(stage) >= index ? 'reached' : ''} style={{ '--stage-color': STAGES[stage].color } as React.CSSProperties}><i/>{['Planning','Approval','Building','Occupied'][index]}</span>)}</div><p className="detail-explainer">{STAGES[stage].description} This snapshot does not give dates for each milestone.</p><div className="evidence-box"><div><FileText size={15}/><span>ON THE PUBLIC RECORD</span></div><dl><dt>Official status</dt><dd>{project.status}</dd><dt>Source refreshed</dt><dd>{sourceDate}</dd><dt>Project reference</dt><dd>{project.id}</dd></dl><a href={source} target="_blank" rel="noreferrer">Read the City’s source <ArrowUpRight size={14}/></a></div><div className="detail-categories"><span className="eyebrow">REPORTED SEPARATELY</span>{Object.entries(METRICS).map(([key,meta]) => <div key={key}><span>{meta.label}</span><strong>{formatNumber(project[key as Metric])}</strong></div>)}<p>Categories may overlap. These figures are not added together.</p></div><button className="primary-button full-width" onClick={onBriefing}>Save this project’s field note <ArrowUpRight size={15}/></button></div>;
}

function ClaimPanel({ onApply }: { onApply: (reading: ClaimReading) => void }) {
  const [text, setText] = useState('');
  const [image, setImage] = useState<{ mimeType: string; data: string; name: string } | null>(null);
  const [reading, setReading] = useState<ClaimReading | null>(null);
  const [mode, setMode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [notice, setNotice] = useState('');
  const [ocrProgress, setOcrProgress] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setLoading(true); setError(''); setNotice(''); setReading(null); setConfirmed(false);
    try {
      let statement = text.trim();
      if (image) {
        setOcrProgress('Opening the on-device reader…');
        const { createWorker } = await import('tesseract.js');
        const worker = await createWorker('eng', 1, {
          workerPath: '/ocr/worker.min.js', corePath: '/ocr', langPath: '/ocr',
          logger: message => {
            if (message.status === 'recognizing text') setOcrProgress(`Reading on your device… ${Math.round(message.progress * 100)}%`);
            else if (message.status === 'loading language traineddata') setOcrProgress('Loading the free English reader…');
          },
        });
        try {
          const result = await worker.recognize(`data:${image.mimeType};base64,${image.data}`);
          const extracted = result.data.text.trim();
          if (!extracted) throw new Error('No text was found. Try a clearer screenshot or paste the quote.');
          statement = [statement, extracted].filter(Boolean).join('\n').slice(0, 4000);
          setText(statement); setImage(null);
          if (fileInput.current) fileInput.current.value = '';
          setNotice('Read entirely on your device. Check the extracted quote for OCR mistakes before confirming.');
        } finally { await worker.terminate(); }
      }
      if (!statement) throw new Error('Paste a statement or add a screenshot first.');
      const viaOcr = !!image;
      let smart: ClaimReading | null = null;
      try {
        const res = await fetch('/api/interpret', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: statement }) });
        if (res.ok) smart = await res.json();
      } catch { /* fall back to the offline guide */ }
      setReading(smart ?? readClaim(statement)); setMode(smart ? 'gemini' : viaOcr ? 'local-ocr' : 'guide');
    } catch (e) { setError(e instanceof Error ? e.message : 'The claim could not be read.'); }
    finally { setLoading(false); setOcrProgress(''); }
  }
  function upload(file?: File) {
    if (!file) return;
    if (!['image/png','image/jpeg','image/webp'].includes(file.type) || file.size > 5*1024*1024) { setError('Choose a PNG, JPEG, or WebP smaller than 5 MB.'); return; }
    const reader = new FileReader();
    reader.onload = () => { setImage({ name: file.name, mimeType: file.type, data: String(reader.result).split(',')[1] }); setError(''); };
    reader.onerror = () => setError('The image could not be opened. Try another file.');
    reader.readAsDataURL(file);
  }
  return <div className="claim-panel"><div className="panel-kicker"><Sparkles size={12}/>Your headline, explained</div><h2>What does the headline count?</h2><p className="claim-description">Paste a housing claim or upload a screenshot. We’ll help you identify the housing type, timeframe, and whether it describes a target or reported progress.</p><form onSubmit={submit}><label htmlFor="claim-text" className="field-label">THE STATEMENT</label><textarea id="claim-text" maxLength={4000} placeholder={'“Toronto has a goal of 65,000 rent-controlled homes by 2030.”'} value={text} onChange={e => { setText(e.target.value); setConfirmed(false); }}/><div className="claim-upload-row"><input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={e => upload(e.target.files?.[0])}/><button type="button" className="text-button" onClick={() => fileInput.current?.click()}><ImagePlus size={14}/>{image ? 'Change screenshot' : 'Or add a screenshot'}</button><span>{text.length}/4,000</span></div>{image && <div className="image-file"><FileText size={14}/><span>{image.name}</span><button type="button" aria-label="Remove screenshot" onClick={() => { setImage(null); if (fileInput.current) fileInput.current.value = ''; }}><X size={14}/></button></div>}<button className="primary-button full-width claim-submit" type="submit" disabled={loading || (!text.trim() && !image)}>{loading ? <><span className="loader small"/>{ocrProgress || 'Reading the fine print…'}</> : <>Unpack this statement <ArrowRight size={16}/></>}</button><p className="upload-privacy">Screenshots are read on your device. The statement text may be sent to Google Gemini to fill in the fields; it is not stored by Paper City.</p></form>
    {!reading && <div className="try-example"><span className="eyebrow">NEED A STARTING POINT?</span><button onClick={() => { setText('Toronto has a goal of 65,000 rent-controlled homes by 2030.'); setImage(null); setError(''); }}>The City’s 65,000-home goal <ArrowUpRight size={13}/></button><a href="https://www.toronto.ca/city-government/data-research-maps/toronto-housing-data-hub/housing-data/" target="_blank" rel="noreferrer">Read the original City wording <ExternalLink size={11}/></a></div>}
    {error && <div className="inline-error" role="alert">{error}</div>}{notice && <div className="inline-notice" role="status">{notice}</div>}
    {reading && <div className="claim-result"><div className="reading-mode"><span className="live-dot"/>{mode === 'gemini' ? 'GOOGLE GEMINI · CHECK THE INTERPRETATION' : mode === 'local-ocr' ? 'ON-DEVICE OCR · CHECK THE INTERPRETATION' : 'SOURCE GUIDE · RULE-BASED TEXT READING'}</div><h3>{confirmed ? 'Read the number carefully.' : 'First, is this what you meant?'}</h3><p>Confirm or correct the fields before exploring the evidence.</p><div className="reading-fields"><label>Number stated<input aria-label="Number stated in claim" value={reading.quantity} onChange={e => { setReading({ ...reading, quantity: e.target.value }); setConfirmed(false); }}/></label><label>Housing type<select aria-label="Claim housing type" value={reading.category} onChange={e => { setReading({ ...reading, category: e.target.value as ClaimCategory }); setConfirmed(false); }}>{Object.entries(METRICS).map(([key,value]) => <option key={key} value={key}>{value.label}</option>)}<option value="rent-controlled">Rent-controlled, unspecified type</option><option value="unspecified">Not stated</option></select></label><label>Stage<select aria-label="Claim housing stage" value={reading.stage} onChange={e => { setReading({ ...reading, stage: e.target.value as ClaimStage }); setConfirmed(false); }}><option value="target">Target or future commitment</option>{stageKeys.map(key => <option key={key} value={key}>{STAGES[key].label}</option>)}<option value="unspecified">Not stated</option></select></label><label>Geography<input aria-label="Claim geography" value={reading.geography} onChange={e => { setReading({ ...reading, geography: e.target.value }); setConfirmed(false); }}/></label><label>Timeframe<input aria-label="Claim timeframe" value={reading.timeframe} onChange={e => { setReading({ ...reading, timeframe: e.target.value }); setConfirmed(false); }}/></label></div>{!confirmed ? <button className="secondary-button full-width" onClick={() => setConfirmed(true)}>Confirm interpretation <Check size={15}/></button> : <><div className="reading-notes">{explainReading(reading).map((note,index) => <p key={index}><span>{String(index+1).padStart(2,'0')}</span>{note}</p>)}</div><button className="primary-button full-width" onClick={() => onApply(reading)}>Explore snapshot context <ArrowUpRight size={15}/></button><p className="context-note">A target has no matching stage. Unsupported categories show the current category, without comparing its total to the claim.</p></>}</div>}
  </div>;
}
