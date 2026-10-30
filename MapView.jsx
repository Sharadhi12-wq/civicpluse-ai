import { useEffect, useRef } from "react";

const KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
const COLORS = { critical: "#dc2626", high: "#ea580c", medium: "#ca8a04", low: "#16a34a" };

let loader;
function loadMaps() {
  if (window.google?.maps) return Promise.resolve();
  if (!loader) {
    loader = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = `https://maps.googleapis.com/maps/api/js?key=${KEY}&libraries=visualization`;
      s.async = true;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }
  return loader;
}

/** Community Impact Map: priority-coloured markers + heatmap of hotspots. */
export default function MapView({ complaints, height = 420 }) {
  const ref = useRef(null);
  const mapRef = useRef(null);
  const layersRef = useRef({ markers: [], heat: null });

  useEffect(() => {
    if (!KEY) return;
    let cancelled = false;
    loadMaps().then(() => {
      if (cancelled || !ref.current) return;
      const g = window.google.maps;
      if (!mapRef.current) {
        mapRef.current = new g.Map(ref.current, {
          center: { lat: 12.9716, lng: 77.5946 },
          zoom: 12,
          streetViewControl: false,
        });
      }
      const map = mapRef.current;
      layersRef.current.markers.forEach((m) => m.setMap(null));
      layersRef.current.heat?.setMap(null);

      const info = new g.InfoWindow();
      layersRef.current.markers = complaints.map((c) => {
        const marker = new g.Marker({
          position: { lat: c.lat, lng: c.lng },
          map,
          title: c.title,
          icon: {
            path: g.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: COLORS[c.priority_label] || "#64748b",
            fillOpacity: 0.95,
            strokeColor: "#fff",
            strokeWeight: 2,
          },
        });
        marker.addListener("click", () => {
          info.setContent(
            `<div style="max-width:220px"><b>${esc(c.title)}</b><br/>${esc(c.category)} · ${esc(
              c.priority_label
            )}<br/>Status: ${esc(c.status)}</div>`
          );
          info.open(map, marker);
        });
        return marker;
      });

      layersRef.current.heat = new g.visualization.HeatmapLayer({
        data: complaints.map((c) => ({
          location: new g.LatLng(c.lat, c.lng),
          weight: Math.max(1, c.priority_score / 20),
        })),
        radius: 40,
        opacity: 0.45,
        map,
      });

      if (complaints.length) {
        const bounds = new g.LatLngBounds();
        complaints.forEach((c) => bounds.extend({ lat: c.lat, lng: c.lng }));
        map.fitBounds(bounds, 60);
        if (complaints.length === 1) map.setZoom(16);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [complaints]);

  if (!KEY) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 p-6 text-sm text-slate-500">
        Set <code>VITE_GOOGLE_MAPS_API_KEY</code> in <code>frontend/.env</code> to enable the map.
      </div>
    );
  }
  return <div ref={ref} style={{ height }} className="w-full overflow-hidden rounded-xl border border-slate-200" />;
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
}
