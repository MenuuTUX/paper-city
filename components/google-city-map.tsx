'use client';

import { useEffect, useRef, useState } from 'react';
import { Globe2, LocateFixed, MapPin, Minus, Orbit, Plus, RotateCw } from 'lucide-react';
import { formatNumber, getStage, METRICS, STAGES } from '@/lib/housing';
import type { CityMapProps } from './city-map';

let googleLoad: Promise<void> | null = null;
declare global { interface Window { __paperCityMapReady?: () => void; gm_authFailure?: () => void } }

function loadGoogle(): Promise<void> {
  if (typeof google !== 'undefined' && typeof google.maps?.importLibrary === 'function') return Promise.resolve();
  if (googleLoad) return googleLoad;
  googleLoad = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    const timeout = setTimeout(() => { script.remove(); googleLoad = null; reject(new Error('Map load timeout')); }, 18000);
    window.__paperCityMapReady = () => { clearTimeout(timeout); resolve(); };
    window.gm_authFailure = () => window.dispatchEvent(new Event('paper-city-google-error'));
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '')}&v=weekly&loading=async&libraries=maps3d,marker&callback=__paperCityMapReady`;
    script.async = true;
    script.onerror = () => { clearTimeout(timeout); script.remove(); googleLoad = null; reject(new Error('Map unavailable')); };
    document.head.append(script);
  });
  return googleLoad;
}

export default function GoogleCityMap({ projects, metric, selected, onSelect, ward, journey, onUnavailable }: CityMapProps & { onUnavailable: () => void }) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<google.maps.maps3d.Map3DElement | null>(null);
  const libraries = useRef<{ maps: google.maps.Maps3DLibrary; markers: google.maps.MarkerLibrary } | null>(null);
  const markers = useRef<google.maps.maps3d.Marker3DInteractiveElement[]>([]);
  const spotlight = useRef<google.maps.maps3d.Polygon3DElement | null>(null);
  const onSelectRef = useRef(onSelect);
  const onUnavailableRef = useRef(onUnavailable);
  const [ready, setReady] = useState(false);
  const [orbiting, setOrbiting] = useState(false);
  const [labels, setLabels] = useState(false);
  const reduced = useRef(false);
  useEffect(() => { onSelectRef.current = onSelect; onUnavailableRef.current = onUnavailable; }, [onSelect, onUnavailable]);

  useEffect(() => {
    let cancelled = false;
    let loadingTimeout: ReturnType<typeof setTimeout>;
    reduced.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const fail = () => { if (!cancelled) onUnavailableRef.current(); };
    window.addEventListener('paper-city-google-error', fail);
    (async () => {
      try {
        await loadGoogle();
        const [maps, markerLibrary] = await Promise.all([google.maps.importLibrary('maps3d') as Promise<google.maps.Maps3DLibrary>, google.maps.importLibrary('marker') as Promise<google.maps.MarkerLibrary>]);
        if (cancelled || !container.current) return;
        libraries.current = { maps, markers: markerLibrary };
        const scene = new maps.Map3DElement({
          center: { lat: 43.672, lng: -79.385, altitude: 100 },
          range: 16000, tilt: 58, heading: 335,
          mode: maps.MapMode.SATELLITE,
          defaultUIHidden: true,
          gestureHandling: maps.GestureHandling.COOPERATIVE,
          description: 'Photorealistic 3D Toronto with housing project markers. Use the project list for keyboard access.',
        });
        scene.style.width = '100%'; scene.style.height = '100%';
        scene.addEventListener('gmp-error', fail);
        scene.addEventListener('gmp-steadychange', () => { if (!cancelled) { clearTimeout(loadingTimeout); setReady(true); } });
        scene.addEventListener('gmp-animationend', () => setOrbiting(false));
        map.current = scene;
        container.current.replaceChildren(scene);
        // A scene may already be steady when the listener attaches. Constructors
        // and imports succeeded, so controls and data can be attached immediately.
        setReady(true);
        loadingTimeout = setTimeout(() => { if (!scene.isConnected) fail(); }, 15000);
      } catch { fail(); }
    })();
    return () => { cancelled = true; clearTimeout(loadingTimeout); window.removeEventListener('paper-city-google-error', fail); map.current?.stopCameraAnimation(); map.current?.remove(); map.current = null; markers.current = []; };
  }, []);

  useEffect(() => {
    if (!ready || !map.current || !libraries.current) return;
    markers.current.forEach(marker => marker.remove());
    spotlight.current?.remove();
    spotlight.current = null;
    if (selected && projects.some(project => project.id === selected.id)) {
      const [lng, lat] = selected.coordinates;
      // A 45 m location spotlight, not an inferred building footprint or parcel.
      const ring = new libraries.current.maps.Polygon3DElement({
        altitudeMode: libraries.current.maps.AltitudeMode.CLAMP_TO_GROUND,
        fillColor: '#ffd16640', strokeColor: '#ffe2a0', strokeWidth: 4,
        drawsOccludedSegments: true,
      });
      ring.path = Array.from({ length: 65 }, (_, index) => {
        const angle = index / 64 * Math.PI * 2;
        return { lat: lat + Math.sin(angle) * 45 / 111320, lng: lng + Math.cos(angle) * 45 / (111320 * Math.cos(lat * Math.PI / 180)) };
      });
      map.current.append(ring);
      spotlight.current = ring;
    }
    markers.current = projects.map(project => {
      const stage = getStage(project.status);
      const focused = project.id === selected?.id;
      const marker = new libraries.current!.maps.Marker3DInteractiveElement({
        position: { lat: project.coordinates[1], lng: project.coordinates[0], altitude: focused ? 60 : 25 },
        altitudeMode: libraries.current!.maps.AltitudeMode.RELATIVE_TO_GROUND,
        extruded: true,
        label: focused ? `IN FOCUS · ${project.address} · ${formatNumber(project[metric])} ${METRICS[metric].short} units` : undefined,
        collisionBehavior: focused ? google.maps.CollisionBehavior.REQUIRED : google.maps.CollisionBehavior.OPTIONAL_AND_HIDES_LOWER_PRIORITY,
      });
      marker.title = `${project.address}: ${formatNumber(project[metric])} ${METRICS[metric].short} units. ${STAGES[stage].label}.`;
      const pin = new libraries.current!.markers.PinElement({ background: focused ? '#ffd166' : STAGES[stage].color, borderColor: focused ? '#23392f' : '#fffdf4', glyphColor: focused ? '#23392f' : '#fffdf4', scale: focused ? 1.65 : 0.75 });
      marker.append(pin);
      marker.addEventListener('gmp-click', event => { event.stopPropagation(); onSelectRef.current(project.id); });
      map.current!.append(marker);
      return marker;
    });
  }, [projects, metric, selected, ready]);

  useEffect(() => {
    if (!ready || !map.current) return;
    const scene = map.current;
    setOrbiting(false); scene.stopCameraAnimation();
    const mobile = window.innerWidth <= 760;
    if (selected) {
      scene.flyCameraTo({ endCamera: {
        center: { lat: selected.coordinates[1] + (journey !== null && mobile ? -0.003 : 0), lng: selected.coordinates[0] - (journey !== null && !mobile ? 0.0015 : 0), altitude: 100 },
        range: journey !== null ? (mobile ? 1800 : 1400) : 1900, tilt: 65, heading: 325 + (journey ?? 0) * 12,
      }, durationMillis: reduced.current ? 0 : 2200 });
    } else if (ward === 'all') scene.flyCameraTo({ endCamera: { center: { lat: 43.672, lng: -79.385, altitude: 100 }, range: 16000, tilt: 58, heading: 335 }, durationMillis: reduced.current ? 0 : 1800 });
    else if (projects.length) {
      const lats = projects.map(p => p.coordinates[1]), lngs = projects.map(p => p.coordinates[0]);
      const north = Math.max(...lats), south = Math.min(...lats), east = Math.max(...lngs), west = Math.min(...lngs);
      scene.flyCameraTo({ endCamera: { center: { lat: (north+south)/2, lng: (east+west)/2, altitude: 100 }, range: Math.max(2500, Math.max(north-south, (east-west)*0.72) * 180000), tilt: 55, heading: 335 }, durationMillis: reduced.current ? 0 : 1800 });
    }
    // Filtering a stage preserves the viewpoint. Ward and selected-project changes fly the camera.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, selected, ward, journey]);

  function reset() { map.current?.stopCameraAnimation(); setOrbiting(false); map.current?.flyCameraTo({ endCamera: { center: { lat: 43.672, lng: -79.385, altitude: 100 }, range: 16000, tilt: 58, heading: 335 }, durationMillis: reduced.current ? 0 : 1400 }); }
  function orbit() {
    if (!map.current) return;
    if (orbiting) { map.current.stopCameraAnimation(); setOrbiting(false); return; }
    map.current.flyCameraAround({ camera: { center: map.current.center, range: map.current.range, tilt: map.current.tilt, heading: map.current.heading }, durationMillis: 30000, repeatCount: 1 });
    setOrbiting(true);
  }

  return <div className="map-scene google-map-scene"><div ref={container} className="map-canvas"/>{!ready && <div className="map-loading"><Globe2 size={24}/><span>Flying into Toronto…</span></div>}<div className="map-tools"><button disabled={!ready} aria-label={orbiting ? 'Stop orbit' : 'Orbit the 3D city'} title="Orbit the real city" className={orbiting ? 'active' : ''} onClick={orbit}><Orbit size={19}/><span>{orbiting ? 'STOP' : 'ORBIT'}</span></button><div className="map-tool-divider"/><button disabled={!ready} aria-label="Zoom in" onClick={() => { if (map.current) map.current.range = Math.max(200,(map.current.range ?? 2000)*0.65); }}><Plus size={18}/></button><button disabled={!ready} aria-label="Zoom out" onClick={() => { if (map.current) map.current.range = Math.min(60000,(map.current.range ?? 2000)*1.5); }}><Minus size={18}/></button><button disabled={!ready} aria-label="Rotate map" title="Rotate the city" onClick={() => { if (map.current) map.current.heading = (map.current.heading ?? 0) + 35; }}><RotateCw size={17}/></button><button disabled={!ready} aria-label={labels ? "Hide map labels" : "Show map labels"} title="Street and place labels" onClick={() => { if (map.current && libraries.current) { map.current.mode = labels ? libraries.current.maps.MapMode.SATELLITE : libraries.current.maps.MapMode.HYBRID; setLabels(!labels); } }}><MapPin size={17}/></button><button disabled={!ready} aria-label="Reset map view" title="Back to Toronto" onClick={reset}><LocateFixed size={18}/></button></div><div className="map-scale-note">Google 3D imagery · project status comes from City records, not imagery.</div></div>;
}
