import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useRef, useState } from 'react';
import { useData } from '../app/data';
import { Dial, type Segment } from '../dial/Dial';
import { fetchFrames, type Frame } from '../lib/rainviewer';
import { clockLabel, localIso } from '../lib/units';

const FRAME_MS = 600;
const RADAR_OPACITY = 0.8;
const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas';

/** Radar in the dial's window; the rim holds the last two hours of frames. */
export function RadarDial() {
  const { place, forecast } = useData();
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const pin = useRef<L.CircleMarker | null>(null);
  const layers = useRef<L.TileLayer[]>([]);
  const [frames, setFrames] = useState<Frame[]>([]);
  const [idx, setIdx] = useState(0);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const [playing, setPlaying] = useState(!reduced);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const m = L.map(el.current!, { zoomControl: false, attributionControl: false }).setView([place?.lat ?? 0, place?.lon ?? 0], 7);
    // Attribution is printed under the dial: the round window would clip Leaflet's corner credit.
    L.tileLayer(`${ESRI}/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}`, { maxZoom: 10 }).addTo(m);
    m.createPane('labels').style.zIndex = '450'; // place names above the radar
    L.tileLayer(`${ESRI}/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}`, { pane: 'labels', maxZoom: 10 }).addTo(m);
    pin.current = L.circleMarker([place?.lat ?? 0, place?.lon ?? 0], { radius: 6, color: '#ffc92e', weight: 2, fillColor: '#142d7e', fillOpacity: 1, interactive: false }).addTo(m);
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

  useEffect(() => { layers.current.forEach((l, i) => l.setOpacity(i === idx ? RADAR_OPACITY : 0)); }, [idx, frames]);

  useEffect(() => {
    if (!playing || frames.length < 2) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % frames.length), FRAME_MS);
    return () => clearInterval(t);
  }, [playing, frames.length]);

  const off = forecast?.offsetSec ?? 0;
  const time = (f: Frame) => clockLabel(localIso(f.time, off));
  const segments: Segment[] = frames.length
    ? frames.map((f, k) => ({ key: String(f.time), top: time(f).slice(0, 2), bottom: time(f).slice(2), mark: k === frames.length - 1 }))
    : [{ key: 'wait', top: '', bottom: '' }];
  const frame = frames[idx];

  return (
    <>
      <Dial turnMs={250} segments={segments} index={Math.min(idx, segments.length - 1)} onIndex={(i) => { setPlaying(false); setIdx(i); }}
        label="Turn the wheel through the last two hours of radar" valueText={frame ? `${time(frame)} local` : 'Loading radar'}>
        <div ref={el} className="radar-map" style={{ width: '100%', height: '100%' }} role="region" aria-label="Rain radar map" />
      </Dial>
      <div className="radar-controls dial-hint">
        {failed ? <span role="status">Radar is unavailable right now. The two-hour rain timeline still works.</span> : (
          <>
            <button type="button" className="chip" onClick={() => setPlaying((p) => !p)} disabled={frames.length < 2}>{playing ? 'Pause' : 'Play'}</button>
            <span className="num">{frame ? `${time(frame)}${idx === frames.length - 1 ? ' · latest' : ''}` : 'Loading radar…'}</span>
          </>
        )}
      </div>
      <p className="credit">Basemap © Esri, HERE, Garmin, © OpenStreetMap contributors · Radar © RainViewer</p>
    </>
  );
}
