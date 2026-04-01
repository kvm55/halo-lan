export interface Player {
  id: string;
  phone: string;
  name: string | null;
  first_name: string | null;
  last_name: string | null;
  gamertag: string | null;
  is_captain: boolean;
  checked_in: boolean;
  checked_in_at: string | null;
  sensitivity: number;
  inverted_y: boolean;
  button_layout: string;
  phone_digits: string | null;
  h2_rank: number;
  h1_experience: string;
  h2_experience: string;
  h3_experience: string;
  h5_experience: string;
  hinf_experience: string;
  h3_rank: string;
  h5_csr: string;
  hinf_csr: string;
  last_played_year: number;
  xbl_gamertag: string | null;
  xbox_count: number;
  xbox_model: string | null;
  controller_count: number;
  tv_count: number;
  extras: string[];
  is_admin: boolean;
  profile_confirmed: boolean;
  tentative_name: string | null;
  created_at: string;
}

/** Display helper: confirmed players show real name, others show masked phone */
export function displayName(p: Player): string {
  if (p.profile_confirmed) {
    if (p.first_name && p.last_name) return `${p.first_name} ${p.last_name}`;
    if (p.first_name) return p.first_name;
  }
  // Unconfirmed: show tentative name + masked phone
  const masked = p.phone_digits ? `(***) ***-${p.phone_digits.slice(-4)}` : "???";
  return p.tentative_name ? `${p.tentative_name} (unverified)` : masked;
}

/** Short display for confirmed only */
export function shortName(p: Player): string {
  if (p.profile_confirmed && p.first_name) {
    return p.last_name ? `${p.first_name} ${p.last_name.charAt(0)}.` : p.first_name;
  }
  return p.phone_digits ? `***-${p.phone_digits.slice(-4)}` : "?";
}

export interface Draft {
  id: string;
  mode: "8v8" | "4v4" | "2v2" | "ffa";
  status: "pending" | "drafting" | "complete";
  captain_a: string | null;
  captain_b: string | null;
  current_pick: string | null;
  pick_number: number;
  created_at: string;
}

export interface DraftPick {
  id: string;
  draft_id: string;
  player_id: string;
  team: "alpha" | "bravo";
  pick_order: number;
  player?: Player;
}

export interface HaloMap {
  id: string;
  game: string;
  map_name: string;
  game_mode: string;
  variant: string;
  image_url: string | null;
  description: string | null;
  map_size: string | null;
  elo_score: number;
}

export interface MapVote {
  id: string;
  player_id: string;
  map_id: string;
  draft_id: string;
  rank: number;
}

export interface Game {
  id: string;
  draft_id: string;
  map_id: string;
  game_number: number;
  alpha_score: number;
  bravo_score: number;
  mvp_player_id: string | null;
  screenshot_url: string | null;
  ai_parsed: boolean;
  played_at: string;
  map?: HaloMap;
  mvp?: Player;
}

export interface PlayerStat {
  id: string;
  game_id: string;
  player_id: string;
  kills: number;
  deaths: number;
  assists: number;
  headshots: number;
  player?: Player;
}

export type AppScreen = "intro" | "login" | "profile" | "lobby" | "draft" | "equipment" | "voting" | "games";
