'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import { Box, Globe2 } from 'lucide-react';
import type { Metric, Project } from '@/lib/housing';

export type CityMapProps = { projects: Project[]; metric: Metric; selected: Project | null; onSelect: (id: string) => void; ward: string; journey: number | null };
const PaperMap = dynamic(() => import('./housing-map'), { ssr: false });
const RealCityMap = dynamic(() => import('./google-city-map'), { ssr: false });

export default function CityMap(props: CityMapProps) {
  const configured = Boolean(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY);
  const [view, setView] = useState<'google' | 'paper'>(configured ? 'google' : 'paper');
  const [unavailable, setUnavailable] = useState(false);
  return <>
    {view === 'google' ? <RealCityMap {...props} onUnavailable={() => { setUnavailable(true); setView('paper'); }}/> : <PaperMap {...props}/>}
    {configured && <div className="map-view-switch" role="group" aria-label="Map view"><button aria-pressed={view === 'paper'} className={view === 'paper' ? 'active' : ''} onClick={() => setView('paper')}><Box size={13}/>Paper map</button><button aria-pressed={view === 'google'} className={view === 'google' ? 'active' : ''} onClick={() => { setUnavailable(false); setView('google'); }}><Globe2 size={13}/>Real city</button></div>}
    {unavailable && <div className="map-provider-notice" role="status">Google 3D is unavailable. You can keep exploring the free paper map.</div>}
  </>;
}
