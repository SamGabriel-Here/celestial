import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useRef, useState } from 'react';
import { useData } from '../app/data';
import { fetchFrames, type Frame } from '../lib/rainviewer';
import { clockLabel, localIso } from '../lib/units';

const FRAME_MS = 500;
const RADAR_OPACITY = 0.78;

export function RadarPanel() {
  const { place, forecast } = useData();
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layers = useRef<L.TileLayer[]>([]);
  const pin = useRef<L.CircleMarker | null>(null);
  const [frames, setFrames] = useState<Frame[]>([]);
  const [idx, setIdx] = useState(0);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const [playing, setPlaying] = useState(!reduced);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const m = L.map(el.current!, { zoomControl: true, attributionControl: true }).setView([place?.lat ?? 0, place?.lon ?? 0], 7);
    const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas';
    L.tileLayer(`${ESRI}/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}`, {
      attribution: 'Basemap &copy; <a href="https://www.esri.com/">Esri</a>, HERE, Garmin, &copy; OpenStreetMap contributors · Radar <a href="https://www.rainviewer.com/">RainViewer</a>',
      maxZoom: 10,
    }).addTo(m);
    m.createPane('labels').style.zIndex = '450'; // place names above the radar
    L.tileLayer(`${ESRI}/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}`, { pane: 'labels', maxZoom: 10 }).addTo(m);
    pin.current = L.circleMarker([place?.lat ?? 0, place?.lon ?? 0], { radius: 6, color: '#11141b', weight: 2, fillColor: '#f3f2ec', fillOpacity: 1, interactive: false }).addTo(m);
    map.current = m;
    let live = true;
    fetchFrames().then((fs) => {
      if (!live) return;
      if (!fs.length) return setFailed(true);
      layers.current = fs.map((f) => L.tileLayer(f.url, { opacity: 0, maxNativeZoom: 7, maxZoom: 10 }).addTo(m));
      setFrames(fs);
      setIdx(fs.length - 1);
    }).catch(() => live && setFailed(true));
    return () => { live = false; m.remove(); map.current = null; layers.current = []; };
    // Deps deliberately empty: the map is created once; place changes pan it below.
  }, []);

  useEffect(() => {
    if (!place) return;
    map.current?.setView([place.lat, place.lon], map.current.getZoom());
    pin.current?.setLatLng([place.lat, place.lon]);
  }, [place?.id]);

  useEffect(() => {
    layers.current.forEach((l, i) => l.setOpacity(i === idx ? RADAR_OPACITY : 0));
  }, [idx, frames]);

  useEffect(() => {
    if (!playing || frames.length < 2) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % frames.length), FRAME_MS);
    return () => clearInterval(t);
  }, [playing, frames.length]);

  const frame = frames[idx];
  const off = forecast?.offsetSec ?? 0;
  return (
    <div className="radar">
      <div ref={el} className="radar-map" role="region" aria-label="Rain radar map" />
      <div className="radar-controls">
        {failed ? <p role="status">Radar is unavailable right now. The two-hour rain timeline still works.</p> : (
          <>
            <button type="button" className="chip" onClick={() => setPlaying((p) => !p)} disabled={frames.length < 2}>{playing ? 'Pause' : 'Play'}</button>
            <input type="range" min={0} max={Math.max(0, frames.length - 1)} value={idx} aria-label="Radar frame"
              aria-valuetext={frame ? `${clockLabel(localIso(frame.time, off))} local` : undefined}
              onChange={(e) => { setPlaying(false); setIdx(Number(e.target.value)); }} />
            <span className="mono">{frame ? `${clockLabel(localIso(frame.time, off))}${idx === frames.length - 1 ? ' · latest' : ''}` : 'Loading radar…'}</span>
          </>
        )}
      </div>
    </div>
  );
}
