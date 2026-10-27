// How the logbook's dive list is sorted and grouped; kept in the URL
export type SortKey =
  | "date" | "site" | "duration" | "max_depth" | "avg_depth" | "temp"
  | "ascent" | "stop" | "buoyancy" | "air" | "overall";
export type SortDir = "asc" | "desc";
export type GroupKey = "none" | "day" | "month" | "site" | "sea_life" | "buddy";

export const SORT_KEYS: SortKey[] = [
  "date", "site", "duration", "max_depth", "avg_depth", "temp", "ascent", "stop", "buoyancy", "air", "overall",
];
export const GROUP_KEYS: GroupKey[] = ["none", "day", "month", "site", "sea_life", "buddy"];

// Names read A to Z; numbers and dates start with the biggest, newest or best
export const defaultDir = (key: SortKey): SortDir => (key === "site" ? "asc" : "desc");
