"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "./supabase";
import type { Player, Draft, DraftPick, HaloMap, MapVote, Game, PlayerStat } from "./types";

// ---- AUTH / SESSION ----

export function useSession() {
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [player, setPlayer] = useState<Player | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem("halo_player_id");
    if (stored) {
      setPlayerId(stored);
      supabase
        .from("halo_players")
        .select("*")
        .eq("id", stored)
        .single()
        .then(({ data }) => {
          if (data) setPlayer(data as Player);
          else localStorage.removeItem("halo_player_id");
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, []);

  const login = useCallback(async (phone: string) => {
    // Strip to last 10 digits for matching (handles any format)
    const digits = phone.replace(/\D/g, "");
    const last10 = digits.slice(-10);

    let data: Player | null = null;

    // Match on last 10 digits (covers +1, 1, bare area code, any format)
    if (last10.length === 10) {
      const res = await supabase
        .from("halo_players")
        .select("*")
        .eq("phone_digits", last10)
        .single();
      data = res.data as Player | null;
    }

    // Fallback: try raw input (for email addresses like felix7747@icloud.com)
    if (!data) {
      const res = await supabase
        .from("halo_players")
        .select("*")
        .eq("phone", phone.trim())
        .single();
      data = res.data as Player | null;
    }

    if (!data) return { success: false, error: "Phone not in the squad" };

    localStorage.setItem("halo_player_id", data.id);
    setPlayerId(data.id);
    setPlayer(data as Player);
    return { success: true, player: data as Player };
  }, []);

  const updateProfile = useCallback(async (updates: Partial<Player>) => {
    if (!playerId) return;

    // If gamertag is changing, log the old one to history and create new active entry
    if (updates.gamertag && player?.gamertag && updates.gamertag !== player.gamertag) {
      // Deactivate all current gamertags
      await supabase
        .from("halo_gamertags")
        .update({ is_active: false })
        .eq("player_id", playerId);
      // Insert new active gamertag
      await supabase
        .from("halo_gamertags")
        .insert({ player_id: playerId, gamertag: updates.gamertag, is_active: true });
    }

    // If this is the first profile save and gamertag exists, seed the history
    if (updates.gamertag && !player?.gamertag) {
      await supabase
        .from("halo_gamertags")
        .insert({ player_id: playerId, gamertag: updates.gamertag, is_active: true });
    }

    const { data } = await supabase
      .from("halo_players")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", playerId)
      .select()
      .single();
    if (data) setPlayer(data as Player);
  }, [playerId, player?.gamertag]);

  const checkIn = useCallback(async () => {
    if (!playerId) return;
    await supabase
      .from("halo_players")
      .update({ checked_in: true, checked_in_at: new Date().toISOString() })
      .eq("id", playerId);
    setPlayer(prev => prev ? { ...prev, checked_in: true } : null);
  }, [playerId]);

  const logout = useCallback(() => {
    localStorage.removeItem("halo_player_id");
    setPlayerId(null);
    setPlayer(null);
  }, []);

  return { playerId, player, loading, login, updateProfile, checkIn, logout };
}

// ---- PLAYERS ----

export function usePlayers() {
  const [players, setPlayers] = useState<Player[]>([]);

  useEffect(() => {
    supabase.from("halo_players").select("*").order("name").then(({ data }) => {
      if (data) setPlayers(data as Player[]);
    });

    const channel = supabase
      .channel("halo_players_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "halo_players" }, () => {
        supabase.from("halo_players").select("*").order("name").then(({ data }) => {
          if (data) setPlayers(data as Player[]);
        });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  return players;
}

// ---- DRAFT ----

export function useDraft() {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [picks, setPicks] = useState<DraftPick[]>([]);

  const fetchDraft = useCallback(async () => {
    const { data } = await supabase
      .from("halo_drafts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    if (data) setDraft(data as Draft);
    return data as Draft | null;
  }, []);

  const fetchPicks = useCallback(async (draftId: string) => {
    const { data } = await supabase
      .from("halo_draft_picks")
      .select("*, player:halo_players(*)")
      .eq("draft_id", draftId)
      .order("pick_order");
    if (data) setPicks(data as DraftPick[]);
  }, []);

  useEffect(() => {
    fetchDraft().then(d => { if (d) fetchPicks(d.id); });

    const channel = supabase
      .channel("halo_draft_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "halo_drafts" }, () => {
        fetchDraft();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "halo_draft_picks" }, () => {
        if (draft?.id) fetchPicks(draft.id);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchDraft, fetchPicks, draft?.id]);

  const createDraft = useCallback(async (mode: Draft["mode"], captainAId: string, captainBId: string) => {
    const { data } = await supabase
      .from("halo_drafts")
      .insert({
        mode,
        status: "drafting",
        captain_a: captainAId,
        captain_b: captainBId,
        current_pick: captainAId,
        pick_number: 0,
      })
      .select()
      .single();
    if (data) {
      setDraft(data as Draft);
      setPicks([]);
    }
    return data as Draft;
  }, []);

  const makePick = useCallback(async (playerId: string) => {
    if (!draft) return;

    const pickNum = draft.pick_number;
    // Snake draft: 1-2-2-2-2-2-1 pattern
    // Pick 0 = captain A picks first, then captain B gets 2, etc.
    const team = getSnakeTeam(pickNum, draft.mode);
    const nextPicker = getNextPicker(pickNum + 1, draft.captain_a!, draft.captain_b!, draft.mode);

    await supabase.from("halo_draft_picks").insert({
      draft_id: draft.id,
      player_id: playerId,
      team,
      pick_order: pickNum,
    });

    const maxPicks = getMaxPicks(draft.mode);
    const newStatus = pickNum + 1 >= maxPicks ? "complete" : "drafting";

    await supabase
      .from("halo_drafts")
      .update({
        pick_number: pickNum + 1,
        current_pick: newStatus === "complete" ? null : nextPicker,
        status: newStatus,
      })
      .eq("id", draft.id);

    await fetchDraft();
    await fetchPicks(draft.id);
  }, [draft, fetchDraft, fetchPicks]);

  return { draft, picks, createDraft, makePick, fetchDraft };
}

// Snake draft helpers
function getSnakeTeam(pickNum: number, mode: string): "alpha" | "bravo" {
  // Standard snake: A, B, B, A, A, B, B, A, A...
  // First pick is alpha, then pairs alternate
  if (pickNum === 0) return "alpha";
  const cycle = Math.floor((pickNum - 1) / 2);
  const pos = (pickNum - 1) % 2;
  if (cycle % 2 === 0) return pos === 0 ? "bravo" : "bravo";
  return pos === 0 ? "alpha" : "alpha";
}

function getNextPicker(nextPickNum: number, captainA: string, captainB: string, mode: string): string {
  const team = getSnakeTeam(nextPickNum, mode);
  return team === "alpha" ? captainA : captainB;
}

function getMaxPicks(mode: string): number {
  switch (mode) {
    case "8v8": return 14; // 16 players - 2 captains
    case "4v4": return 6;  // 8 players - 2 captains
    case "2v2": return 2;  // 4 players - 2 captains
    default: return 0;
  }
}

// ---- MAPS ----

export function useMaps() {
  const [maps, setMaps] = useState<HaloMap[]>([]);

  useEffect(() => {
    supabase
      .from("halo_maps")
      .select("*")
      .order("game")
      .order("map_name")
      .then(({ data }) => {
        if (data) setMaps(data as HaloMap[]);
      });
  }, []);

  return maps;
}

// ---- MAP VOTING ----

export function useMapVoting(draftId: string | null, playerId: string | null) {
  const [votes, setVotes] = useState<MapVote[]>([]);
  const [allVotes, setAllVotes] = useState<MapVote[]>([]);

  const fetchVotes = useCallback(async () => {
    if (!draftId) return;

    // Get all votes for this draft
    const { data } = await supabase
      .from("halo_map_votes")
      .select("*")
      .eq("draft_id", draftId);
    if (data) setAllVotes(data as MapVote[]);

    // Get my votes
    if (playerId) {
      const { data: myVotes } = await supabase
        .from("halo_map_votes")
        .select("*")
        .eq("draft_id", draftId)
        .eq("player_id", playerId);
      if (myVotes) setVotes(myVotes as MapVote[]);
    }
  }, [draftId, playerId]);

  useEffect(() => {
    fetchVotes();

    if (!draftId) return;
    const channel = supabase
      .channel("halo_votes_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "halo_map_votes" }, fetchVotes)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [draftId, fetchVotes]);

  const castVote = useCallback(async (mapId: string, rank: number) => {
    if (!draftId || !playerId) return;

    await supabase.from("halo_map_votes").upsert({
      player_id: playerId,
      map_id: mapId,
      draft_id: draftId,
      rank,
    }, { onConflict: "player_id,map_id,draft_id" });

    fetchVotes();
  }, [draftId, playerId, fetchVotes]);

  // Tally: weighted score (rank 1 = 5pts, rank 2 = 4pts, etc.)
  const tally = allVotes.reduce<Record<string, number>>((acc, v) => {
    acc[v.map_id] = (acc[v.map_id] || 0) + (6 - v.rank);
    return acc;
  }, {});

  return { votes, allVotes, tally, castVote };
}

// ---- GAMES ----

export function useGames(draftId: string | null) {
  const [games, setGames] = useState<Game[]>([]);
  const [stats, setStats] = useState<Record<string, PlayerStat[]>>({});

  const fetchGames = useCallback(async () => {
    if (!draftId) return;
    const { data } = await supabase
      .from("halo_games")
      .select("*, map:halo_maps(*), mvp:halo_players(*)")
      .eq("draft_id", draftId)
      .order("game_number");
    if (data) setGames(data as Game[]);
  }, [draftId]);

  useEffect(() => {
    fetchGames();

    if (!draftId) return;
    const channel = supabase
      .channel("halo_games_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "halo_games" }, fetchGames)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [draftId, fetchGames]);

  const logGame = useCallback(async (mapId: string, alphaScore: number, bravoScore: number, mvpId?: string) => {
    if (!draftId) return;
    const gameNum = games.length + 1;
    const { data } = await supabase
      .from("halo_games")
      .insert({
        draft_id: draftId,
        map_id: mapId,
        game_number: gameNum,
        alpha_score: alphaScore,
        bravo_score: bravoScore,
        mvp_player_id: mvpId || null,
      })
      .select()
      .single();
    fetchGames();
    return data;
  }, [draftId, games.length, fetchGames]);

  const fetchStats = useCallback(async (gameId: string) => {
    const { data } = await supabase
      .from("halo_player_stats")
      .select("*, player:halo_players(*)")
      .eq("game_id", gameId);
    if (data) setStats(prev => ({ ...prev, [gameId]: data as PlayerStat[] }));
  }, []);

  return { games, stats, logGame, fetchStats };
}

// ---- SETTINGS ----

export function useSettings() {
  const [settings, setSettings] = useState<Record<string, string>>({});

  useEffect(() => {
    supabase.from("halo_settings").select("*").then(({ data }) => {
      if (data) {
        const map: Record<string, string> = {};
        data.forEach((s: { key: string; value: string }) => { map[s.key] = s.value; });
        setSettings(map);
      }
    });
  }, []);

  const updateSetting = useCallback(async (key: string, value: string) => {
    await supabase.from("halo_settings").upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" });
    setSettings(prev => ({ ...prev, [key]: value }));
  }, []);

  return { settings, updateSetting, ranksRevealed: settings.ranks_revealed === "true" };
}

// ---- COMPOSITE SCORES ----

export interface CompositeScore {
  playerId: string;
  score: number;
  breakdown: {
    h2Rank: number;
    experienceAvg: number;
    peerConsensus: number;
    skillVoteNet: number;
    recencyBonus: number;
  };
  peerRatingCount: number;
}

export function useCompositeScores(players: Player[]) {
  const [scores, setScores] = useState<Record<string, CompositeScore>>({});

  useEffect(() => {
    if (players.length === 0) return;

    const compute = async () => {
      // Fetch peer assessments
      const { data: assessments } = await supabase.from("halo_peer_assessments").select("*");
      // Fetch skill votes
      const { data: skillVotes } = await supabase.from("halo_skill_votes").select("*");

      const expToNum = (exp: string) => {
        if (exp === "sweaty") return 100;
        if (exp === "experienced") return 50;
        if (exp === "casual") return 25;
        return 0;
      };

      const result: Record<string, CompositeScore> = {};

      for (const p of players) {
        // Self-reported H2 rank (0-50 normalized to 0-100)
        const h2Rank = Math.min(100, (p.h2_rank || 0) * 2);

        // Average experience across games
        const exps: number[] = [p.h1_experience, p.h2_experience, p.h3_experience, p.h5_experience, p.hinf_experience]
          .filter(e => e && e !== "never")
          .map(e => expToNum(e));
        const experienceAvg = exps.length > 0 ? exps.reduce((a: number, b: number) => a + b, 0) / exps.length : 0;

        // Peer assessment consensus
        const peerForPlayer = (assessments || []).filter((a: { target_id: string }) => a.target_id === p.id);
        const peerExps = peerForPlayer
          .map((a: { experience: string }) => expToNum(a.experience))
          .filter((v: number) => v > 0);
        const peerConsensus = peerExps.length > 0 ? peerExps.reduce((a: number, b: number) => a + b, 0) / peerExps.length : 0;

        // Skill vote net
        const votesForPlayer = (skillVotes || []).filter((v: { target_id: string }) => v.target_id === p.id);
        const skillVoteNet = votesForPlayer.reduce((s: number, v: { vote: number }) => s + v.vote, 0);

        // Recency bonus
        const recencyBonus = p.last_played_year === 2026 ? 10 : p.last_played_year === 2025 ? 5 : 0;

        // Weighted composite (out of ~100)
        const score = Math.round(
          h2Rank * 0.25 +
          experienceAvg * 0.3 +
          peerConsensus * 0.25 +
          Math.min(20, Math.max(-20, skillVoteNet * 5)) * 0.1 +
          recencyBonus
        );

        result[p.id] = {
          playerId: p.id,
          score: Math.max(0, Math.min(100, score)),
          breakdown: { h2Rank, experienceAvg, peerConsensus, skillVoteNet, recencyBonus },
          peerRatingCount: peerForPlayer.length,
        };
      }

      setScores(result);
    };

    compute();
  }, [players]);

  return scores;
}
