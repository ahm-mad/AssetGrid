"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import type L from "leaflet";

import type { StatusKind } from "@/components/charts/status-dot";

// `leaflet/dist/leaflet.css` is imported in `app/app/layout.tsx` (a Server
// Component), matching Next's own docs example (they import external
// package CSS from a layout, not a "use client" file) — keep it there.

export interface WorldMapMarker {
  id: string;
  label: string;
  sublabel?: string;
  lat: number;
  lng: number;
  deviceCount: number;
  status: StatusKind;
}

const STATUS_VAR: Record<StatusKind, string> = {
  online: "var(--status-online)",
  warning: "var(--status-warning)",
  critical: "var(--status-critical)",
  offline: "var(--status-offline)",
  info: "var(--status-info)",
};

// Esri's "Canvas" basemaps — free, keyless tile REST services (unlike
// CARTO's basemaps.cartocdn.com, which now requires a signed-up API key
// even for anonymous use). Neutral gray canvas style, a close match for
// this app's flat Ops Console look.
const TILE_URL = {
  dark: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}",
  light: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}",
};
const TILE_ATTRIBUTION =
  'Tiles &copy; <a href="https://www.esri.com" target="_blank" rel="noreferrer">Esri</a> &mdash; Esri, HERE, Garmin, &copy; OpenStreetMap contributors';

function escapeHtml(s: string) {
  const map: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  return s.replace(/[&<>"']/g, (c) => map[c]);
}

/**
 * One real, live, pannable/zoomable world map (Leaflet + Esri's free
 * keyless Canvas tiles) with a pulsing status dot per asset location,
 * status-page style — instead of one embed per site.
 */
export function WorldAssetMap({ markers, height = 420 }: { markers: WorldMapMarker[]; height?: number }) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const mapRef = React.useRef<L.Map | null>(null);
  const tileLayerRef = React.useRef<L.TileLayer | null>(null);
  const { resolvedTheme } = useTheme();

  React.useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const L = (await import("leaflet")).default;
        if (cancelled || !containerRef.current || mapRef.current) return;

        const map = L.map(containerRef.current, {
          worldCopyJump: true,
          minZoom: 2,
        });

        if (markers.length > 0) {
          const bounds = L.latLngBounds(markers.map((m) => [m.lat, m.lng] as [number, number]));
          map.fitBounds(bounds, { padding: [40, 40], maxZoom: 6 });
        } else {
          map.setView([20, 0], 2);
        }

        tileLayerRef.current = L.tileLayer(TILE_URL[resolvedTheme === "light" ? "light" : "dark"], {
          attribution: TILE_ATTRIBUTION,
          maxZoom: 19,
        }).addTo(map);

        for (const m of markers) {
          const color = STATUS_VAR[m.status];
          // Pulse only signals "needs attention" — a solid dot everywhere
          // would just be decoration, and every marker pulsing at once reads
          // as busy rather than live (the exact neon-spread complaint that
          // moved the whole app to flat/restrained in the first place).
          const needsAttention = m.status === "warning" || m.status === "critical";
          const icon = L.divIcon({
            className: "",
            html: needsAttention
              ? `<span class="relative inline-flex size-3.5">
                  <span class="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" style="background-color:${color}"></span>
                  <span class="relative inline-flex size-3.5 rounded-full border border-white/80" style="background-color:${color}"></span>
                </span>`
              : `<span class="inline-flex size-3.5 rounded-full border border-white/80" style="background-color:${color}"></span>`,
            iconSize: [14, 14],
            iconAnchor: [7, 7],
          });
          L.marker([m.lat, m.lng], { icon }).addTo(map).bindPopup(
            `<div class="font-mono text-xs">
              <div class="text-sm font-semibold">${escapeHtml(m.label)}</div>
              ${m.sublabel ? `<div class="text-muted-foreground">${escapeHtml(m.sublabel)}</div>` : ""}
              <div class="mt-1 tabular-nums">${m.deviceCount} devices &middot; ${m.status}</div>
            </div>`,
          );
        }

        mapRef.current = map;
      } catch (err) {
        console.error("[WorldAssetMap] init failed", err);
      }
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markers]);

  React.useEffect(() => {
    tileLayerRef.current?.setUrl(TILE_URL[resolvedTheme === "light" ? "light" : "dark"]);
  }, [resolvedTheme]);

  return <div ref={containerRef} className="map-shell overflow-hidden rounded-lg border" style={{ height }} />;
}
