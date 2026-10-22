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
  overall_score: number | null;
  scores: SkillScore[];
}

export type Skill = "ascent" | "stop";

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
}

export interface DiveDetail extends DiveSummary {
  computer_serial: string | null;
  scores: SkillScoreDetail[];
  samples: Sample[];
  profile: ProfilePoint[];
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
  weight_ascent: number;
  weight_stop: number;
}

export interface SettingsResponse {
  values: ScoringSettings;
  defaults: ScoringSettings;
  version: number;
}
