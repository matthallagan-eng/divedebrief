import { useEffect, useRef, useState } from "react";
import { AttributionControl, LngLatBounds, Map as MapLibreMap, NavigationControl, Popup, setWorkerUrl } from "maplibre-gl";
import type { GeoJSONSource, LngLatLike } from "maplibre-gl";
import type { Feature, FeatureCollection } from "geojson";
import "maplibre-gl/dist/maplibre-gl.css";
// MapLibre loads its worker from a file next to its own; once bundled that
// file isn't there, so Vite builds the worker and hands over its URL
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import type { MapDive, SiteOut } from "../api/types";
import { diveFixes } from "../lib/map";

// Matches the theme in index.css; the map paints on a canvas, so no CSS variables
const COLORS = { abyss: "#030d15", aqua: "#6fd6ea", lagoon: "#1e9fbd", foam: "#e6f6f8", seagrass: "#3fb68b", coral: "#de6650" };

setWorkerUrl(workerUrl);

const WORLD_ZOOM = 1.6;
const SITE_ZOOM = 16;
const DIVE_MAX_ZOOM = 18.5;

interface Props {
  sites: SiteOut[];
  site: SiteOut | null;
  dive: MapDive | null;
  // Room the overlay panel takes up, so zooming centres on the visible part
  padding: { top: number; right: number; bottom: number; left: number };
  onSelectSite: (id: number) => void;
  onSelectDive: (id: number) => void;
}

const point = (lng: number, lat: number, props: Record<string, unknown>): Feature => ({
  type: "Feature",
  geometry: { type: "Point", coordinates: [lng, lat] },
  properties: props,
});

const collection = (features: Feature[]): FeatureCollection => ({ type: "FeatureCollection", features });

function diveFeatures(d: MapDive): Feature[] {
  const { entry, exit, position } = diveFixes(d);
  const out: Feature[] = [];
  if (entry && exit) {
    out.push({ type: "Feature", geometry: { type: "LineString", coordinates: [entry, exit] }, properties: {} });
  }
  if (entry) out.push(point(...entry, { kind: "entry" }));
  if (exit) out.push(point(...exit, { kind: "exit" }));
  // UDDF dives only know the site's position
  if (!entry && !exit && position) out.push(point(...position, { kind: "position" }));
  return out;
}

export function DiveGlobe({ sites, site, dive, padding, onSelectSite, onSelectDive }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<MapLibreMap | null>(null);
  // Latest callbacks, so the map's listeners are added once
  const handlers = useRef({ onSelectSite, onSelectDive });
  useEffect(() => {
    handlers.current = { onSelectSite, onSelectDive };
  });

  useEffect(() => {
    const m = new MapLibreMap({
      container: container.current!,
      center: [0, 20],
      zoom: WORLD_ZOOM,
      maxZoom: 19,
      attributionControl: false,
      style: {
        version: 8,
        projection: { type: "globe" },
        // A glow around the globe that fades out as you zoom in to a site
        sky: {
          "sky-color": COLORS.abyss,
          "horizon-color": COLORS.lagoon,
          "atmosphere-blend": ["interpolate", ["linear"], ["zoom"], 0, 1, 5, 1, 7, 0],
        },
        sources: {
          osm: {
            type: "raster",
            tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
            tileSize: 256,
            maxzoom: 19,
            attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          },
        },
        layers: [
          { id: "background", type: "background", paint: { "background-color": COLORS.abyss } },
          // Dimmed a little to sit with the dark theme
          { id: "osm", type: "raster", source: "osm", paint: { "raster-brightness-max": 0.85, "raster-saturation": -0.25 } },
        ],
      },
    });
    m.addControl(new NavigationControl({ visualizePitch: true }), "top-left");
    // Bottom left, clear of the panel on the right
    m.addControl(new AttributionControl({ compact: true }), "bottom-left");

    m.on("load", () => {
      m.addSource("sites", { type: "geojson", data: collection([]) });
      m.addSource("site-dives", { type: "geojson", data: collection([]) });
      m.addSource("dive", { type: "geojson", data: collection([]) });

      m.addLayer({
        id: "sites-glow",
        type: "circle",
        source: "sites",
        paint: { "circle-radius": ["+", 10, ["*", 2, ["min", ["get", "count"], 6]]], "circle-color": COLORS.aqua, "circle-opacity": 0.18, "circle-blur": 0.6 },
      });
      m.addLayer({
        id: "sites",
        type: "circle",
        source: "sites",
        paint: {
          "circle-radius": ["+", 5, ["min", ["get", "count"], 6]],
          "circle-color": ["case", ["get", "selected"], COLORS.foam, COLORS.aqua],
          "circle-stroke-color": COLORS.abyss,
          "circle-stroke-width": 2,
        },
      });
      // Every dive at the open site, so one can be picked on the map too
      m.addLayer({
        id: "site-dives",
        type: "circle",
        source: "site-dives",
        paint: { "circle-radius": 6, "circle-color": COLORS.lagoon, "circle-stroke-color": COLORS.foam, "circle-stroke-width": 1.5 },
      });
      m.addLayer({
        id: "dive-line",
        type: "line",
        source: "dive",
        filter: ["==", ["geometry-type"], "LineString"],
        paint: { "line-color": COLORS.foam, "line-width": 2.5, "line-dasharray": [2, 1.5] },
      });
      m.addLayer({
        id: "dive-points",
        type: "circle",
        source: "dive",
        filter: ["==", ["geometry-type"], "Point"],
        paint: {
          "circle-radius": 8,
          "circle-color": ["match", ["get", "kind"], "entry", COLORS.seagrass, "exit", COLORS.coral, COLORS.aqua],
          "circle-stroke-color": COLORS.foam,
          "circle-stroke-width": 2,
        },
      });

      const hover = new Popup({ closeButton: false, closeOnClick: false, offset: 12, className: "dive-popup" });
      for (const layer of ["sites", "site-dives", "dive-points"]) {
        m.on("mouseenter", layer, (e) => {
          m.getCanvas().style.cursor = "pointer";
          const label = e.features?.[0]?.properties?.label;
          if (label) hover.setLngLat(e.lngLat).setText(label).addTo(m);
        });
        m.on("mouseleave", layer, () => {
          m.getCanvas().style.cursor = "";
          hover.remove();
        });
      }
      m.on("click", "sites", (e) => {
        const id = e.features?.[0]?.properties?.id;
        if (id !== undefined) handlers.current.onSelectSite(Number(id));
      });
      m.on("click", "site-dives", (e) => {
        const id = e.features?.[0]?.properties?.id;
        if (id !== undefined) handlers.current.onSelectDive(Number(id));
      });
      setMap(m);
    });
    return () => {
      setMap(null);
      m.remove();
    };
  }, []);

  // Site pins
  useEffect(() => {
    if (!map) return;
    (map.getSource("sites") as GeoJSONSource).setData(
      collection(
        sites.map((s) =>
          point(s.longitude, s.latitude, {
            id: s.id,
            count: s.dives.length,
            selected: s.id === site?.id,
            label: `${s.name ?? "Unnamed site"} · ${s.dives.length} dive${s.dives.length === 1 ? "" : "s"}`,
          }),
        ),
      ),
    );
  }, [map, sites, site]);

  // The open site's dives, and the selected dive's entry and exit
  useEffect(() => {
    if (!map) return;
    const others = site && !dive ? site.dives : [];
    (map.getSource("site-dives") as GeoJSONSource).setData(
      collection(
        others.flatMap((d) => {
          const { position } = diveFixes(d);
          const label = new Date(d.started_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
          return position ? [point(...position, { id: d.id, label })] : [];
        }),
      ),
    );
    (map.getSource("dive") as GeoJSONSource).setData(collection(dive ? diveFeatures(dive) : []));
    map.setLayoutProperty("sites", "visibility", dive ? "none" : "visible");
    map.setLayoutProperty("sites-glow", "visibility", dive ? "none" : "visible");
  }, [map, site, dive]);

  // Camera: the whole globe, a site, or a dive. It moves only when the
  // target changes, not when the same site's data reloads after an edit.
  const { top, right, bottom, left } = padding;
  const target = dive ? `dive:${dive.id}` : site ? `site:${site.id}` : `world:${sites.length}`;
  const latest = useRef({ sites, site, dive });
  useEffect(() => {
    latest.current = { sites, site, dive };
  });
  useEffect(() => {
    if (!map) return;
    const { sites, site, dive } = latest.current;
    const pad = { top, right, bottom, left };
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const move = { padding: pad, essential: false, animate: !reduced, duration: 2600 };
    if (dive) {
      const { entry, exit, position } = diveFixes(dive);
      const fixes = [entry, exit].filter((f): f is [number, number] => f !== null);
      if (fixes.length === 2) {
        const bounds = new LngLatBounds(fixes[0], fixes[0]).extend(fixes[1]);
        map.fitBounds(bounds, { ...move, padding: { top: top + 80, right: right + 80, bottom: bottom + 80, left: left + 80 }, maxZoom: DIVE_MAX_ZOOM });
      } else if (fixes[0] ?? position) {
        map.flyTo({ ...move, center: (fixes[0] ?? position) as LngLatLike, zoom: DIVE_MAX_ZOOM - 1 });
      }
    } else if (site) {
      map.flyTo({ ...move, center: [site.longitude, site.latitude], zoom: SITE_ZOOM });
    } else {
      const center: LngLatLike = sites.length
        ? [sites.reduce((a, s) => a + s.longitude, 0) / sites.length, sites.reduce((a, s) => a + s.latitude, 0) / sites.length]
        : [0, 20];
      map.flyTo({ ...move, center, zoom: WORLD_ZOOM });
    }
  }, [map, target, top, right, bottom, left]);

  // MapLibre makes its container position: relative, so the sizing goes on a wrapper
  return (
    <div className="absolute inset-0 bg-abyss">
      <div ref={container} className="h-full w-full" aria-label="Map of your dive sites" role="region" />
    </div>
  );
}
