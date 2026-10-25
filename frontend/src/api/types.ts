// Mirrors backend/app/schemas.py

export interface User {
  id: number;
  email: string;
  created_at: string;
}

export interface Token {
  access_token: string;
  token_type: string;
}

export interface UploadResult {
  upload_id: number | null;
  filename: string;
  added: number;
  updated: number; // dives stored from UDDF that a FIT upload filled in
  skipped: number;
  warnings: string[];
}

export interface UploadOut {
  id: number;
  filename: string;
  uploaded_at: string;
  dives_added: number;
  dives_skipped: number;
}

export interface DiveSummary {
  id: number;
  upload_id: number;
  started_at: string;
  duration_s: number;
  max_depth_m: number;
  avg_depth_m: number;
  min_temp_k: number | null;
  computer_model: string | null;
  site_id: number | null;
  site_name: string | null;
  overall_score: number | null;
  scores: SkillScore[];
}

export type Skill = "ascent" | "stop" | "buoyancy" | "air";

export interface SkillScore {
  skill: Skill;
  score: number | null; // null = N/A, explained by reason
  reason: string;
}

export interface Region {
  start_s: number;
  end_s: number;
  label: string;
  severity: "info" | "warning" | "violation";
}

export interface SkillScoreDetail extends SkillScore {
  regions: Region[];
}

export interface ProfilePoint {
  t_s: number;
  depth_m: number;
  rate_m_per_min: number;
}

export interface Sample {
  t_s: number;
  depth_m: number;
  temp_k: number | null;
  heart_rate: number | null;
  tank_pressure_bar: number | null;
  ndl_s: number | null;
  // The dive computer's own calculations (FIT only)
  ceiling_m: number | null; // next deco stop depth, 0 = none
  tts_s: number | null;
  n2_load_pct: number | null;
  cns_pct: number | null;
  po2_bar: number | null;
}

export interface Tank {
  volume_l: number | null;
  start_bar: number;
  end_bar: number;
  source: "sampled" | "manual";
}

export interface DiveDetail extends DiveSummary {
  computer_serial: string | null;
  source: "uddf" | "fit";
  tank: Tank | null;
  water_type: "salt" | "fresh" | null;
  latitude: number | null;
  longitude: number | null;
  entry_latitude: number | null;
  entry_longitude: number | null;
  exit_latitude: number | null;
  exit_longitude: number | null;
  site: SiteRef | null;
  notes: Notes | null;
  scores: SkillScoreDetail[];
  samples: Sample[];
  profile: ProfilePoint[];
}

export interface SiteRef {
  id: number;
  name: string | null; // null until the diver names it
  latitude: number;
  longitude: number;
  water_type: "salt" | "fresh" | null; // null = use the dive computer's setting
}

// Surface GPS fixes only: there is no GPS underwater
export interface MapDive {
  id: number;
  started_at: string;
  duration_s: number;
  max_depth_m: number;
  overall_score: number | null;
  latitude: number | null;
  longitude: number | null;
  entry_latitude: number | null;
  entry_longitude: number | null;
  exit_latitude: number | null;
  exit_longitude: number | null;
}

export interface SiteOut extends SiteRef {
  average_scores: Record<Skill, number | null>;
  average_overall: number | null;
  dives: MapDive[]; // newest first
  // From the dives' notes, most often noted first
  sea_life: string[];
  landmarks: string[];
}

export interface NameSuggestion {
  name: string;
  kind: string; // e.g. "Dive site", "Lake", "Reef"
  distance_m: number; // 0 when the site is inside it
}

export interface NameSuggestions {
  suggestions: NameSuggestion[];
  error: string | null; // the lookup service couldn't be reached
}

export interface NotesInput {
  feeling: number | null; // 1 rough ... 5 great
  sea_life: string[];
  landmarks: string[];
  text: string;
}

export interface Notes extends NotesInput {
  updated_at: string;
}

export interface NoteTags {
  sea_life: string[];
  landmarks: string[];
}

export interface TrendPoint {
  id: number;
  started_at: string;
  site_id: number | null;
  scores: Record<Skill, number | null>;
  overall_score: number | null;
  median_ascent_m_per_min: number | null;
  max_ascent_m_per_min: number | null;
}

export interface Headline {
  skill: Skill | "overall";
  recent: number | null;
  recent_dives: number;
  previous: number | null;
  previous_dives: number;
}

export interface Trends {
  points: TrendPoint[]; // oldest first
  headlines: Headline[];
  window: number; // dives per headline period
}

export interface DiveMap {
  sites: SiteOut[];
  unknown: MapDive[]; // dives without a GPS position
}

// Mirrors backend/app/scoring/settings.py
export interface ScoringSettings {
  ascent_window_s: number;
  ascent_target_m_per_min: number;
  ascent_violation_m_per_min: number;
  ascent_final_zone_m: number;
  ascent_final_zone_weight: number;
  stop_band_min_m: number;
  stop_band_max_m: number;
  stop_tolerance_m: number;
  stop_target_s: number;
  stop_min_dive_depth_m: number;
  buoyancy_detrend_window_s: number;
  buoyancy_excursion_m: number;
  default_water_type: "salt" | "fresh";
  difficulty: Difficulty;
  units: "metric" | "imperial"; // thresholds above are always metric
  weight_ascent: number;
  weight_stop: number;
  weight_buoyancy: number;
  weight_air: number;
}

export type Difficulty = "easy" | "normal" | "hard";

// Mirrors backend/app/scoring/difficulty.py
export interface Grading {
  ascent_violation_penalty: number;
  ascent_over_target_penalty: number;
  ascent_penalty_cap: number;
  stop_exit_penalty: number;
  stop_drift_allowance_m: number;
  stop_drift_penalty: number;
  stop_drift_penalty_cap: number;
  buoyancy_wobble_good_m: number;
  buoyancy_wobble_bad_m: number;
  buoyancy_excursion_penalty: number;
  air_at_baseline: number;
  air_points_per_pct: number;
}

export interface SettingsResponse {
  values: ScoringSettings;
  defaults: ScoringSettings;
  version: number;
  grading: Record<Difficulty, Grading>;
}
