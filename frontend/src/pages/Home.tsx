import { Suspense, lazy, useCallback, useEffect, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ChevronLeft, Globe2, MapPin, Waves } from "lucide-react";
import { api } from "../api/client";
import type { DiveMap, MapDive, NameSuggestions, SiteOut, SiteRef, Skill } from "../api/types";
import { diveFixes } from "../lib/map";
import { formatDate, formatDepth, formatDuration, formatTime } from "../lib/format";
import { SKILL_NAMES, formatScore } from "../lib/skills";

// MapLibre is most of the app's code, so other pages load without it
const DiveGlobe = lazy(() => import("../components/DiveGlobe").then((m) => ({ default: m.DiveGlobe })));

const SKILLS: Skill[] = ["ascent", "stop", "buoyancy", "air"];

const siteName = (s: SiteRef) => s.name ?? "Unnamed site";
const coords = (lat: number, lon: number) =>
  `${Math.abs(lat).toFixed(4)}° ${lat >= 0 ? "N" : "S"}, ${Math.abs(lon).toFixed(4)}° ${lon >= 0 ? "E" : "W"}`;

// The panel covers the right of the map on wide screens and the bottom on phones
function usePanelPadding() {
  const query = "(min-width: 768px)";
  const [wide, setWide] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const update = () => setWide(mq.matches);
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return wide ? { top: 0, right: 352, bottom: 0, left: 0 } : { top: 0, right: 0, bottom: 290, left: 0 };
}

export default function Home() {
  const [data, setData] = useState<DiveMap | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [params, setParams] = useSearchParams();
  const padding = usePanelPadding();

  const load = useCallback(() => {
    api.get<DiveMap>("/sites").then(setData).catch((e: Error) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  if (error) return <p className="text-sm text-mist">Couldn't reach the API: {error}</p>;
  if (!data) return <p className="text-sm text-murk">Descending…</p>;

  // ?dive= opens a dive (and its site); ?site= opens a site
  const diveId = Number(params.get("dive")) || null;
  const dive = diveId === null ? null : data.sites.flatMap((s) => s.dives).find((d) => d.id === diveId) ?? null;
  const site =
    data.sites.find((s) => (dive ? s.dives.includes(dive) : s.id === Number(params.get("site")))) ?? null;

  const select = (next: { site?: number; dive?: number }) => {
    const p = new URLSearchParams();
    if (next.site) p.set("site", String(next.site));
    if (next.dive) p.set("dive", String(next.dive));
    setParams(p);
  };

  const diveCount = data.sites.reduce((n, s) => n + s.dives.length, 0) + data.unknown.length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foam">Where you've dived</h1>
        <p className="mt-1 text-sm text-mist">
          {data.sites.length
            ? `${data.sites.length} site${data.sites.length === 1 ? "" : "s"}, ${diveCount} dive${diveCount === 1 ? "" : "s"}. Click a pin to zoom in, or drag the globe and scroll to explore.`
            : "Spin the globe. Your dive sites appear here once a dive has a GPS position."}
        </p>
      </div>

      <div className="relative h-[72vh] min-h-[480px] overflow-hidden rounded-xl border border-surface-border">
        <Suspense fallback={<div className="absolute inset-0 bg-abyss" />}>
          <DiveGlobe
            sites={data.sites}
            site={site}
            dive={dive}
            padding={padding}
            onSelectSite={(id) => select({ site: id })}
            onSelectDive={(id) => select({ dive: id })}
          />
        </Suspense>
        <aside className="absolute inset-x-2 bottom-10 flex max-h-[240px] flex-col overflow-hidden rounded-xl border border-surface-border bg-surface-raised/95 shadow-xl backdrop-blur md:inset-x-auto md:top-3 md:right-3 md:bottom-3 md:max-h-none md:w-80">
          {diveCount === 0 ? (
            <EmptyPanel />
          ) : dive && site ? (
            <DivePanel dive={dive} site={site} onBack={() => select({ site: site.id })} />
          ) : site ? (
            <SitePanel site={site} onBack={() => select({})} onSelectDive={(id) => select({ dive: id })} onSaved={load} />
          ) : (
            <SitesPanel data={data} onSelectSite={(id) => select({ site: id })} />
          )}
        </aside>
      </div>
    </div>
  );
}

function PanelHeader({ children, onBack, back }: { children: ReactNode; onBack?: () => void; back?: string }) {
  return (
    <div className="border-b border-surface-border px-4 py-3">
      {onBack && (
        <button onClick={onBack} className="mb-1 inline-flex items-center gap-1 text-xs text-murk hover:text-mist">
          <ChevronLeft size={12} />
          {back}
        </button>
      )}
      {children}
    </div>
  );
}

function DiveRow({ dive, onClick }: { dive: MapDive; onClick: () => void }) {
  return (
    <li>
      <button
        onClick={onClick}
        className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm transition-colors hover:bg-lagoon/10"
      >
        <span>
          <span className="text-foam">{formatDate(dive.started_at)}</span>
          <span className="ml-2 text-xs text-murk">
            {formatDepth(dive.max_depth_m)} · {formatDuration(dive.duration_s)}
          </span>
        </span>
        <span className="tabular-nums text-mist">{formatScore(dive.overall_score)}</span>
      </button>
    </li>
  );
}

function SitesPanel({ data, onSelectSite }: { data: DiveMap; onSelectSite: (id: number) => void }) {
  return (
    <>
      <PanelHeader>
        <h2 className="flex items-center gap-1.5 text-sm font-medium text-foam">
          <Globe2 size={14} className="text-aqua" />
          Dive sites
        </h2>
      </PanelHeader>
      <ul className="flex-1 divide-y divide-surface-border/60 overflow-y-auto">
        {data.sites.map((s) => (
          <li key={s.id}>
            <button
              onClick={() => onSelectSite(s.id)}
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-lagoon/10"
            >
              <span>
                <span className="block text-sm text-foam">{siteName(s)}</span>
                <span className="text-xs text-murk">
                  {s.dives.length} dive{s.dives.length === 1 ? "" : "s"} · last {formatDate(s.dives[0].started_at)}
                </span>
              </span>
              <span className="text-right">
                <span className="block text-sm tabular-nums text-foam">{formatScore(s.average_overall)}</span>
                <span className="text-xs text-murk">avg</span>
              </span>
            </button>
          </li>
        ))}
        {data.unknown.length > 0 && (
          <li className="px-4 py-3">
            <p className="text-sm text-foam">Unknown site</p>
            <p className="mt-0.5 text-xs text-murk">
              {data.unknown.length} dive{data.unknown.length === 1 ? "" : "s"} without a GPS position. Upload the
              .fit file from your watch to place {data.unknown.length === 1 ? "it" : "them"}.
            </p>
            <ul className="mt-2 space-y-1">
              {data.unknown.map((d) => (
                <li key={d.id}>
                  <Link to={`/dives/${d.id}`} className="text-xs text-aqua hover:text-foam">
                    {formatDate(d.started_at)} {formatTime(d.started_at)}
                  </Link>
                </li>
              ))}
            </ul>
          </li>
        )}
      </ul>
    </>
  );
}

function SitePanel({
  site,
  onBack,
  onSelectDive,
  onSaved,
}: {
  site: SiteOut;
  onBack: () => void;
  onSelectDive: (id: number) => void;
  onSaved: () => void;
}) {
  return (
    <>
      <PanelHeader onBack={onBack} back="All sites">
        <h2 className="text-sm font-medium text-foam">{siteName(site)}</h2>
        <p className="mt-0.5 text-xs text-murk">{coords(site.latitude, site.longitude)}</p>
      </PanelHeader>
      <div className="flex-1 overflow-y-auto">
        <SiteEditor key={site.id} site={site} onSaved={onSaved} />
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 border-b border-surface-border px-4 py-3">
          {SKILLS.map((skill) => (
            <div key={skill}>
              <p className="text-xs text-murk">{SKILL_NAMES[skill]}</p>
              <p className="text-sm tabular-nums text-foam">{formatScore(site.average_scores[skill])}</p>
            </div>
          ))}
          <p className="col-span-2 text-xs text-murk">Average per skill across this site's dives</p>
        </div>
        <Sightings label="Sea life seen here" items={site.sea_life} />
        <Sightings label="Landmarks" items={site.landmarks} />
        <ul className="divide-y divide-surface-border/60">
          {site.dives.map((d) => (
            <DiveRow key={d.id} dive={d} onClick={() => onSelectDive(d.id)} />
          ))}
        </ul>
      </div>
    </>
  );
}

function Sightings({ label, items }: { label: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div className="border-b border-surface-border px-4 py-3">
      <p className="text-xs text-murk">{label}</p>
      <ul className="mt-1.5 flex flex-wrap gap-1.5">
        {items.map((item) => (
          <li key={item} className="rounded-md bg-lagoon/15 px-2 py-0.5 text-xs text-foam">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

const distance = (m: number) => (m === 0 ? "you're in it" : m < 1000 ? `${m} m away` : `${(m / 1000).toFixed(1)} km away`);

function SiteEditor({ site, onSaved }: { site: SiteOut; onSaved: () => void }) {
  const [name, setName] = useState(site.name ?? "");
  const [nearby, setNearby] = useState<NameSuggestions | null>(null);

  useEffect(() => {
    // Popular dive sites and bodies of water at this spot, from OpenStreetMap
    api
      .get<NameSuggestions>(`/sites/${site.id}/suggestions`)
      .then(setNearby)
      .catch(() => setNearby({ suggestions: [], error: "Couldn't look up names nearby." }));
  }, [site.id]);
  const suggestions = (nearby?.suggestions ?? []).filter((s) => s.name !== name.trim());
  const [water, setWater] = useState(site.water_type ?? "");
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);
  const dirty = name.trim() !== (site.name ?? "") || water !== (site.water_type ?? "");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus("saving");
    setError(null);
    try {
      await api.put(`/sites/${site.id}`, { name: name.trim() || null, water_type: water || null });
      setStatus("saved");
      onSaved();
    } catch (err) {
      setError((err as Error).message);
      setStatus("idle");
    }
  }

  const field = "w-full rounded-lg border border-surface-border bg-surface px-3 py-1.5 text-sm text-foam outline-none transition-colors focus:border-lagoon";
  return (
    <form onSubmit={handleSubmit} className="space-y-2 border-b border-surface-border px-4 py-3">
      <label className="block">
        <span className="text-xs text-murk">Name</span>
        <input
          value={name}
          maxLength={120}
          placeholder={nearby?.suggestions[0] ? `e.g. ${nearby.suggestions[0].name}` : "e.g. Blue Hole"}
          onChange={(e) => {
            setName(e.target.value);
            setStatus("idle");
          }}
          className={`mt-1 ${field}`}
        />
      </label>
      {nearby === null ? (
        <p className="text-xs text-murk">Looking up names nearby…</p>
      ) : nearby.error ? (
        <p className="text-xs text-murk">{nearby.error}</p>
      ) : suggestions.length > 0 ? (
        <div>
          <p className="text-xs text-murk">Nearby on OpenStreetMap: tap to use</p>
          <ul className="mt-1.5 flex flex-wrap gap-1.5">
            {suggestions.map((s) => (
              <li key={s.name}>
                <button
                  type="button"
                  title={`${s.kind}, ${distance(s.distance_m)}`}
                  onClick={() => {
                    setName(s.name);
                    setStatus("idle");
                  }}
                  className="rounded-md border border-surface-border px-2 py-1 text-left text-xs text-foam transition-colors hover:border-lagoon"
                >
                  {s.name}
                  <span className="ml-1 text-murk">· {s.kind}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <label className="block">
        <span className="text-xs text-murk">Water</span>
        <select
          value={water}
          onChange={(e) => {
            setWater(e.target.value);
            setStatus("idle");
          }}
          className={`mt-1 ${field}`}
        >
          <option value="">As your dive computer recorded</option>
          <option value="fresh">Fresh</option>
          <option value="salt">Salt</option>
        </select>
      </label>
      <p className="text-xs text-murk">Water type sets the pressure at depth for air efficiency, here and on future dives.</p>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={!dirty || status === "saving"}
          className="rounded-lg bg-lagoon px-3 py-1.5 text-sm font-medium text-abyss transition-colors hover:bg-aqua disabled:opacity-40"
        >
          {status === "saving" ? "Saving…" : "Save site"}
        </button>
        {status === "saved" && !dirty && <span className="text-xs text-seagrass">Saved</span>}
        {error && <span className="text-xs text-coral">{error}</span>}
      </div>
    </form>
  );
}

function DivePanel({ dive, site, onBack }: { dive: MapDive; site: SiteOut; onBack: () => void }) {
  const { entry, exit } = diveFixes(dive);
  return (
    <>
      <PanelHeader onBack={onBack} back={siteName(site)}>
        <h2 className="text-sm font-medium text-foam">
          {formatDate(dive.started_at)}
          <span className="ml-2 font-normal text-murk">{formatTime(dive.started_at)}</span>
        </h2>
      </PanelHeader>
      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-3">
        <dl className="grid grid-cols-3 gap-3">
          <Stat label="Max depth" value={formatDepth(dive.max_depth_m)} />
          <Stat label="Duration" value={formatDuration(dive.duration_s)} />
          <Stat label="Overall" value={formatScore(dive.overall_score)} />
        </dl>
        <ul className="space-y-1.5 text-sm">
          <Legend color="bg-seagrass" label="Entry" detail={entry ? coords(entry[1], entry[0]) : "No GPS fix when you went in"} />
          <Legend color="bg-coral" label="Exit" detail={exit ? coords(exit[1], exit[0]) : "No GPS fix when you came out"} />
        </ul>
        <p className="text-xs text-murk">
          {entry || exit
            ? "Your watch takes a GPS fix at the surface only, so the line joins where you went in and came out, not the route underwater."
            : "This dive came from a UDDF export, which has only the site's position. Upload the .fit file to see where you went in and came out."}
        </p>
        <Link
          to={`/dives/${dive.id}`}
          className="inline-flex items-center gap-1.5 rounded-lg bg-lagoon px-3 py-1.5 text-sm font-medium text-abyss transition-colors hover:bg-aqua"
        >
          <MapPin size={14} />
          Open dive debrief
        </Link>
      </div>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-murk">{label}</dt>
      <dd className="text-sm tabular-nums text-foam">{value}</dd>
    </div>
  );
}

function Legend({ color, label, detail }: { color: string; label: string; detail: string }) {
  return (
    <li className="flex items-start gap-2">
      <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-foam/80 ${color}`} />
      <span>
        <span className="text-foam">{label}</span>
        <span className="block text-xs text-murk">{detail}</span>
      </span>
    </li>
  );
}

function EmptyPanel() {
  return (
    <div className="px-5 py-6 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-lagoon/10 text-aqua">
        <Waves size={22} />
      </div>
      <h2 className="mt-4 text-sm font-semibold text-foam">The reef is quiet</h2>
      <p className="mt-1 text-xs text-mist">Upload a .fit file from your Garmin and your dives show up on the globe.</p>
      <Link
        to="/upload"
        className="mt-4 inline-flex rounded-lg bg-lagoon px-4 py-2 text-sm font-medium text-abyss transition-colors hover:bg-aqua"
      >
        Log your first dive
      </Link>
    </div>
  );
}
