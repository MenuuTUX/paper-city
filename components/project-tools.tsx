'use client';

import { useState } from 'react';
import { ArrowUpRight, Bookmark, Check, MapPin, Search, SlidersHorizontal, X } from 'lucide-react';
import { formatNumber, getStage, STAGES, type Project, type StageFilter } from '@/lib/housing';

// Viora UI interaction patterns, adapted to Paper City's data and native controls.
export function ProjectSearch({ projects, onSelect }: { projects: Project[]; onSelect: (id: string) => void }) {
  const [query, setQuery] = useState('');
  const results = projects.filter(project => `${project.address} ${project.wardName}`.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 12);
  return <div className="action-search">
    <form onSubmit={event => { event.preventDefault(); if (results[0]) onSelect(results[0].id); }}>
      <Search size={19}/><input autoFocus aria-label="Find a housing project" placeholder="Address or neighbourhood…" value={query} onChange={event => setQuery(event.target.value)}/><kbd>↵</kbd>
    </form>
    <p className="tools-hint">Search across all wards. Opening a project resets your map filters.</p>
    <div className="action-results" aria-label="Project search results">
      {results.map(project => <button key={project.id} onClick={() => onSelect(project.id)}><MapPin size={17}/><span><strong>{project.address}</strong><small>{project.wardName} · {STAGES[getStage(project.status)].label}</small></span><ArrowUpRight size={16}/></button>)}
      {!results.length && <p className="tools-empty">No matching address. Try a street name or neighbourhood.</p>}
    </div>
  </div>;
}

export function PinnedPlaces({ projects, onSelect, onRemove }: { projects: Project[]; onSelect: (id: string) => void; onRemove: (id: string) => void }) {
  return <div className="pinned-places"><p className="tools-hint">Keep addresses for your next conversation. Saved only in this browser.</p>
    {!projects.length && <div className="tools-empty"><Bookmark size={27}/><h3>Your city, collected.</h3><p>Open a project and choose “Pin this place” to keep it here.</p></div>}
    {projects.map(project => <div className="pinned-place" key={project.id}><button onClick={() => onSelect(project.id)}><span className="pin-monogram"><MapPin size={21}/></span><span><strong>{project.address}</strong><small>{project.wardName}</small><small>{formatNumber(project.affordable)} recorded affordable units</small></span><ArrowUpRight size={17}/></button><button className="unpin-button" aria-label={`Unpin ${project.address}`} onClick={() => onRemove(project.id)}><X size={15}/></button></div>)}
  </div>;
}

export function StageDisclosure({ stage, onChange }: { stage: StageFilter; onChange: (stage: StageFilter) => void }) {
  const [open, setOpen] = useState(false);
  return <div className="stage-disclosure"><button className="filter-trigger" aria-expanded={open} aria-controls="stage-options" onClick={() => setOpen(!open)}><SlidersHorizontal size={15}/><span>{stage === 'all' ? 'All stages' : STAGES[stage].label}</span><span className="filter-trigger-count">{stage === 'all' ? '4' : '1'}</span></button>
    {open && <div id="stage-options" className="filter-options" role="group" aria-label="Filter by project stage"><div><span>Project stage</span><button aria-label="Close stage filters" onClick={() => setOpen(false)}><X size={14}/></button></div>{(['all', 'planning', 'approved', 'construction', 'occupied'] as const).map(key => <button aria-pressed={stage === key} key={key} onClick={() => { onChange(key); setOpen(false); }}><i style={{ background: key === 'all' ? 'var(--ink)' : STAGES[key].color }}/><span>{key === 'all' ? 'All stages' : STAGES[key].label}</span>{stage === key && <Check size={15}/>}</button>)}</div>}
  </div>;
}
