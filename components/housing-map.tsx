'use client';

import { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import type { Feature } from 'geojson'; // fixmyslop-ignore[deps/phantom-import] Type-only import supplied by the declared @types/geojson dependency, with no runtime package.
import { Box, Minus, Plus, RotateCcw, RotateCw, LocateFixed, Layers2 } from 'lucide-react';
import { getStage, METRICS, STAGES, type Metric, type Project } from '@/lib/housing';
import 'maplibre-gl/dist/maplibre-gl.css';

type Props = { projects: Project[]; metric: Metric; selected: Project | null; onSelect: (id: string) => void; ward: string; journey: number | null };

export default function HousingMap({ projects, metric, selected, onSelect, ward, journey }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const onSelectRef = useRef(onSelect);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  const [threeD, setThreeD] = useState(true);
  const reduced = useRef(false);

  useEffect(() => { onSelectRef.current = onSelect; }, [onSelect]);

  useEffect(() => {
    if (!container.current) return;
    setReady(false);
    let disposed = false;
    reduced.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let instance: maplibregl.Map;
    try {
      maplibregl.setWorkerUrl('/maplibre-worker.mjs');
      instance = new maplibregl.Map({
        container: container.current,
        style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
        center: [-79.397, 43.694], zoom: 10.6, pitch: 48, bearing: -20,
        minZoom: 9, maxZoom: 17, attributionControl: false,
        canvasContextAttributes: { antialias: true },
      });
      map.current = instance;
      instance.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-left');
      instance.on('load', () => {
        if (disposed) return;
        instance.setLight({ anchor: 'viewport', color: '#fff9ec', intensity: 0.45, position: [1.5, 210, 35] });
        const layers = instance.getStyle().layers;
        for (const layer of layers) {
          if (layer.type === 'background') instance.setPaintProperty(layer.id, 'background-color', '#f0eee7');
          if (layer.id.toLowerCase().includes('water') && layer.type === 'fill') instance.setPaintProperty(layer.id, 'fill-color', '#c5d9da');
          if (layer.id.toLowerCase().includes('park') && layer.type === 'fill') instance.setPaintProperty(layer.id, 'fill-color', '#e2e6d9');
        }
        // Real OpenStreetMap footprints. Missing heights use a modest schematic
        // 8 m height; the map never presents these as photorealistic buildings.
        const firstLabel = layers.find(layer => layer.type === 'symbol')?.id;
        instance.addLayer({
          id: 'real-city-buildings', type: 'fill-extrusion', source: 'carto',
          'source-layer': 'building', minzoom: 12,
          filter: ['!=', ['get', 'hide_3d'], true],
          paint: {
            'fill-extrusion-color': '#e0dfd1',
            'fill-extrusion-height': ['interpolate', ['linear'], ['zoom'], 12, 0, 13, ['max', 3, ['case', ['has', 'render_height'], ['to-number', ['get', 'render_height'], 8], ['has', 'height'], ['to-number', ['get', 'height'], 8], 8]]],
            'fill-extrusion-base': 0,
            'fill-extrusion-opacity': 0.8,
            'fill-extrusion-vertical-gradient': true,
          },
        }, firstLabel);
        instance.addSource('housing', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        instance.addLayer({ id: 'project-ground', type: 'circle', source: 'housing', filter: ['==', ['geometry-type'], 'Point'], paint: {
          'circle-color': ['get', 'color'], 'circle-opacity': 0.15,
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 9, 5, 13, 17, 16, 30],
        } });
        instance.addLayer({ id: 'housing-columns', type: 'fill-extrusion', source: 'housing', filter: ['==', ['geometry-type'], 'Polygon'], paint: {
          'fill-extrusion-color': ['get', 'color'], 'fill-extrusion-height': ['get', 'height'],
          'fill-extrusion-base': 0, 'fill-extrusion-opacity': 0.91,
          'fill-extrusion-vertical-gradient': true,
        } });
        instance.addLayer({ id: 'project-points', type: 'circle', source: 'housing', filter: ['==', ['geometry-type'], 'Point'], paint: {
          'circle-color': ['get', 'color'], 'circle-radius': ['interpolate', ['linear'], ['zoom'], 9, 2.5, 12, 4, 15, 6],
          'circle-stroke-color': '#fffdf8', 'circle-stroke-width': 1.2,
        } });
        instance.addLayer({ id: 'project-selection', type: 'circle', source: 'housing', filter: ['all', ['==', ['geometry-type'], 'Point'], ['==', ['get', 'projectId'], '']], paint: {
          'circle-color': '#ffd166', 'circle-opacity': 0.2, 'circle-radius': 24, 'circle-stroke-color': '#ffe2a0', 'circle-stroke-width': 4,
        } });
        for (const layer of ['housing-columns', 'project-points', 'project-ground']) {
          instance.on('click', layer, event => {
            const id = event.features?.[0]?.properties?.projectId;
            if (id) onSelectRef.current(String(id));
          });
          instance.on('mouseenter', layer, () => { instance.getCanvas().style.cursor = 'pointer'; });
          instance.on('mouseleave', layer, () => { instance.getCanvas().style.cursor = ''; });
        }
        setReady(true);
      });
      instance.on('error', () => { if (!instance.isStyleLoaded()) setError(true); });
    } catch { setError(true); return; }
    const observer = new ResizeObserver(() => instance.resize());
    observer.observe(container.current);
    return () => { disposed = true; observer.disconnect(); instance.remove(); map.current = null; };
  }, []);

  useEffect(() => {
    if (!ready || !map.current) return;
    const features: Feature[] = [];
    for (const project of projects) {
      const [lng, lat] = project.coordinates;
      const color = STAGES[getStage(project.status)].color;
      const size = 0.00025 + Math.sqrt(project[metric]) * 0.000009;
      const properties = { projectId: project.id, color, height: Math.max(65, Math.sqrt(project[metric]) * 28), units: project[metric] };
      features.push({ type: 'Feature', properties, geometry: { type: 'Point', coordinates: [lng, lat] } });
      features.push({ type: 'Feature', properties, geometry: { type: 'Polygon', coordinates: [[[lng-size,lat-size*0.72],[lng+size,lat-size*0.72],[lng+size,lat+size*0.72],[lng-size,lat+size*0.72],[lng-size,lat-size*0.72]]] } });
    }
    (map.current.getSource('housing') as maplibregl.GeoJSONSource | undefined)?.setData({ type: 'FeatureCollection', features });
  }, [projects, metric, ready]);

  useEffect(() => {
    const instance = map.current;
    if (!ready || !instance || !instance.getLayer('project-selection')) return;
    instance.setFilter('project-selection', ['all', ['==', ['geometry-type'], 'Point'], ['==', ['get', 'projectId'], selected?.id ?? '']]);
    instance.setPaintProperty('housing-columns', 'fill-extrusion-color', ['case', ['==', ['get', 'projectId'], selected?.id ?? ''], '#ffd166', ['get', 'color']]);
    const mobile = window.innerWidth <= 760;
    if (selected) instance.flyTo({ center: selected.coordinates as [number,number], zoom: journey !== null ? (mobile ? 12.7 : 14) : 13.4, pitch: threeD ? 58 : 0, bearing: journey !== null ? -28 + journey * 18 : -20, duration: reduced.current ? 0 : 1800, padding: journey !== null ? (mobile ? { left: 0, right: 0, top: 50, bottom: Math.round(window.innerHeight * 0.56) } : { left: Math.min(window.innerWidth * 0.3, 380), right: 40, top: 30, bottom: 40 }) : { left: 0, right: 0, top: 0, bottom: 0 } });
  }, [selected, ready, journey, threeD]);

  useEffect(() => {
    const instance = map.current;
    if (!ready || !instance || selected) return;
    if (ward === 'all') instance.flyTo({ center: [-79.397, 43.694], zoom: journey !== null ? 11 : 10.6, pitch: threeD ? 48 : 0, bearing: -20, padding: { left: 0, right: 0, top: 0, bottom: 0 }, duration: reduced.current ? 0 : 1400 });
    else if (projects.length) {
      const bounds = new maplibregl.LngLatBounds();
      projects.forEach(p => bounds.extend(p.coordinates as [number,number]));
      instance.fitBounds(bounds, { padding: 75, maxZoom: 13, duration: reduced.current ? 0 : 1400, pitch: threeD ? 48 : 0 });
    }
    // Stage changes preserve the camera; changing the area reframes the map.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ward, ready, selected, journey]);

  function reset() {
    map.current?.flyTo({ center: [-79.397, 43.694], zoom: 10.6, pitch: threeD ? 48 : 0, bearing: -20, padding: { left: 0, right: 0, top: 0, bottom: 0 }, duration: reduced.current ? 0 : 1400 });
  }

  return <div className="map-scene">
    <div ref={container} className="map-canvas" role="region" aria-label={`Interactive 3D map of ${projects.length} Toronto housing projects. Use the project list for keyboard access.`} />
    {error && !ready && <div className="map-fallback"><Box size={36}/><h3>The map couldn’t load.</h3><p>The City records are still available in the project list. Check your connection and reload to explore in 3D.</p><button className="text-button" onClick={() => window.location.reload()}>Reload map <RotateCcw size={14}/></button></div>}
    {!ready && !error && <div className="map-loading"><span className="loader"/><span>Unfolding Toronto…</span></div>}
    <div className="map-tools">
      <button disabled={!ready} className={threeD ? 'active' : ''} aria-label={threeD ? 'Switch to 2D map' : 'Switch to 3D map'} title={threeD ? 'Switch to 2D' : 'Switch to 3D'} onClick={() => { const next = !threeD; setThreeD(next); map.current?.easeTo({ pitch: next ? 48 : 0, duration: reduced.current ? 0 : 900 }); for (const id of ['housing-columns', 'real-city-buildings']) map.current?.setLayoutProperty(id, 'visibility', next ? 'visible' : 'none'); }}>{threeD ? <Box size={18}/> : <Layers2 size={18}/>}<span>{threeD ? '3D' : '2D'}</span></button>
      <div className="map-tool-divider"/>
      <button aria-label="Zoom in" title="Zoom in" onClick={() => map.current?.zoomIn()}><Plus size={18}/></button>
      <button aria-label="Zoom out" title="Zoom out" onClick={() => map.current?.zoomOut()}><Minus size={18}/></button>
      <button aria-label="Rotate map" title="Rotate the city" onClick={() => map.current?.easeTo({ bearing: (map.current?.getBearing() ?? 0) + 45, duration: reduced.current ? 0 : 800 })}><RotateCw size={17}/></button>
      <button aria-label="Reset map view" title="Back to Toronto" onClick={reset}><LocateFixed size={18}/></button>
    </div>
    <div className="map-scale-note"><span className="scale-line"/>3D stacks show {METRICS[metric].short} counts, not building shapes.</div>
  </div>;
}
