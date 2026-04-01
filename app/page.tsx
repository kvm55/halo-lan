"use client";

import { useState, useRef, useEffect } from "react";
import { useSession, usePlayers, useDraft, useMaps, useMapVoting, useGames, useSettings } from "@/lib/hooks";
import { supabase } from "@/lib/supabase";
import { displayName, shortName } from "@/lib/types";
import type { AppScreen, Player, HaloMap } from "@/lib/types";

// ---- BUTTON LAYOUT OPTIONS ----
const BUTTON_LAYOUTS = [
  { id: "default", name: "Default", desc: "Standard controls" },
  { id: "southpaw", name: "Southpaw", desc: "Swapped sticks" },
  { id: "bumper_jumper", name: "Bumper Jumper", desc: "Jump with LB" },
  { id: "recon", name: "Recon", desc: "Halo 3 classic" },
  { id: "fishstick", name: "Fishstick", desc: "CoD-style" },
  { id: "boxer", name: "Boxer", desc: "Melee with left trigger" },
  { id: "green_thumb", name: "Green Thumb", desc: "Click stick to melee" },
  { id: "walkie_talkie", name: "Walkie Talkie", desc: "D-pad talk" },
];

export default function Home() {
  const session = useSession();
  const players = usePlayers();
  const { draft, picks, createDraft, makePick } = useDraft();
  const maps = useMaps();
  const voting = useMapVoting(draft?.id || null, session.playerId);
  const { settings, updateSetting, ranksRevealed } = useSettings();
  const { games, logGame } = useGames(draft?.id || null);

  const [screen, setScreen] = useState<AppScreen>("intro");
  const [phone, setPhone] = useState("");
  const [loginError, setLoginError] = useState("");
  const [needsProfile, setNeedsProfile] = useState(false);

  // Determine screen based on session state
  useEffect(() => {
    if (session.loading) return;
    if (!session.player) {
      // Don't override intro screen
      if (screen !== "intro") setScreen("login");
    } else if (needsProfile || !session.player.checked_in) {
      // Always force profile on first login of the session
      setScreen("profile");
    } else {
      setScreen("lobby");
    }
  }, [session.loading, session.player, needsProfile]);

  if (session.loading) {
    return (
      <div className="scanlines hex-bg min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-2xl hud-glow text-green-400 animate-pulse">INITIALIZING...</div>
          <p className="text-green-700 text-sm mt-2">Connecting to UNSC servers</p>
        </div>
      </div>
    );
  }

  return (
    <div className="scanlines hex-bg min-h-screen">
      {/* ---- CORTANA INTRO ---- */}
      {screen === "intro" && (
        <CortanaIntro onComplete={() => setScreen("login")} />
      )}

      {/* ---- LOGIN SCREEN ---- */}
      {screen === "login" && (
        <div className="min-h-screen flex items-center justify-center px-4 relative">
          <div className="absolute inset-0 bg-cover bg-center opacity-15" style={{ backgroundImage: "url(/bg/chief_cortana.jpg)" }} />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-black/60" />
          <div className="w-full max-w-md relative z-10">
            <div className="text-center mb-8">
              <p className="text-xs tracking-[0.3em] text-green-600 uppercase mb-2">// CLASSIFIED OPERATION</p>
              <h1 className="text-4xl md:text-5xl font-bold hud-glow tracking-tight mb-2">
                OPERATION
              </h1>
              <h1 className="text-3xl md:text-4xl font-bold hud-glow-amber text-amber-400 tracking-tight">
                BIRTHDAY AMBUSH
              </h1>
              <p className="text-green-700 text-sm mt-4">Enter your phone number to verify identity</p>
            </div>

            <div className="kpi-card p-6 rounded">
              <label className="text-xs tracking-[0.2em] text-green-600 uppercase block mb-2">
                SPARTAN ID (PHONE NUMBER)
              </label>
              <input
                type="text"
                value={phone}
                onChange={e => {
                  const val = e.target.value;
                  // If it contains @ or letters, treat as email (Felix)
                  if (val.includes("@") || /[a-zA-Z]/.test(val)) {
                    setPhone(val);
                  } else {
                    // Auto-format as (XXX) XXX-XXXX
                    const raw = val.replace(/\D/g, "").slice(0, 10);
                    let formatted = raw;
                    if (raw.length > 6) formatted = `(${raw.slice(0,3)}) ${raw.slice(3,6)}-${raw.slice(6)}`;
                    else if (raw.length > 3) formatted = `(${raw.slice(0,3)}) ${raw.slice(3)}`;
                    else if (raw.length > 0) formatted = `(${raw}`;
                    setPhone(formatted);
                  }
                  setLoginError("");
                }}
                placeholder="(770) 654-3480 or email"
                className="w-full bg-black/50 border border-green-800 text-green-300 px-4 py-3 text-lg font-mono focus:border-green-400 focus:outline-none tracking-wider"
                onKeyDown={e => {
                  if (e.key === "Enter") handleLogin();
                }}
              />
              {loginError && (
                <p className="text-red-400 text-sm mt-2">{loginError}</p>
              )}
              <button
                onClick={handleLogin}
                className="w-full mt-4 px-6 py-3 border border-green-500 text-green-400 hover:bg-green-500/10 transition-all tracking-widest text-sm uppercase"
              >
                AUTHENTICATE
              </button>
            </div>

            <p className="text-center text-green-900 text-xs mt-4">
              PARKER MUST NOT SEE THIS SITE
            </p>
          </div>
        </div>
      )}

      {/* ---- PROFILE SETUP ---- */}
      {screen === "profile" && session.player && (
        <ProfileSetup
          player={session.player}
          onSave={async (updates) => {
            await session.updateProfile(updates);
            await session.checkIn();
            setNeedsProfile(false);
            setScreen("lobby");
          }}
        />
      )}

      {/* ---- MAIN APP (LOBBY / DRAFT / VOTING / GAMES) ---- */}
      {screen !== "login" && screen !== "profile" && session.player && (
        <MainApp
          screen={screen}
          setScreen={setScreen}
          setNeedsProfile={setNeedsProfile}
          session={session}
          players={players}
          draft={draft}
          picks={picks}
          createDraft={createDraft}
          makePick={makePick}
          maps={maps}
          voting={voting}
          games={games}
          logGame={logGame}
          ranksRevealed={ranksRevealed}
          updateSetting={updateSetting}
        />
      )}
    </div>
  );

  async function handleLogin() {
    const result = await session.login(phone);
    if (!result.success) {
      setLoginError(result.error || "Authentication failed");
    } else {
      // Always show profile wizard on login so they confirm name + gamertag
      setNeedsProfile(true);
    }
  }
}

// ---- PROFILE SETUP WIZARD ----

function ProfileSetup({ player, onSave }: { player: Player; onSave: (u: Partial<Player>) => Promise<void> }) {
  const [step, setStep] = useState(0);
  const [firstName, setFirstName] = useState(player.first_name || "");
  const [lastName, setLastName] = useState(player.last_name || "");
  const [gamertag, setGamertag] = useState(player.gamertag || "");
  const [xblGamertag, setXblGamertag] = useState(player.xbl_gamertag || "");
  const [sensitivity, setSensitivity] = useState(player.sensitivity || 3);
  const [invertedY, setInvertedY] = useState(player.inverted_y || false);
  const [buttonLayout, setButtonLayout] = useState(player.button_layout || "default");
  const [h2Rank, setH2Rank] = useState(player.h2_rank ?? 0);
  const [h3Rank, setH3Rank] = useState(player.h3_rank || "never");
  const [h5Csr, setH5Csr] = useState(player.h5_csr || "never");
  const [hinfCsr, setHinfCsr] = useState(player.hinf_csr || "never");
  // Empty string = unselected (must click to proceed)
  const [h1Exp, setH1Exp] = useState(player.h1_experience && player.profile_confirmed ? player.h1_experience : "");
  const [h2Exp, setH2Exp] = useState(player.h2_experience && player.profile_confirmed ? player.h2_experience : "");
  const [h3Exp, setH3Exp] = useState(player.h3_experience && player.profile_confirmed ? player.h3_experience : "");
  const [h5Exp, setH5Exp] = useState(player.h5_experience && player.profile_confirmed ? player.h5_experience : "");
  const [hinfExp, setHinfExp] = useState(player.hinf_experience && player.profile_confirmed ? player.hinf_experience : "");
  const [lastPlayed, setLastPlayed] = useState(player.last_played_year || -1);

  const rankIconUrl = (rank: number) => `/ranks/rank_${rank}.png`;

  const EXP_LEVELS = [
    { id: "never", label: "NEVER", color: "text-green-900 border-green-900/30" },
    { id: "casual", label: "CASUAL", color: "text-green-600 border-green-700" },
    { id: "experienced", label: "EXPERIENCED", color: "text-green-400 border-green-500" },
    { id: "sweaty", label: "SWEATY", color: "text-amber-400 border-amber-500" },
  ] as const;

  const steps = [
    // Step 0: First Name, Last Name, Gamertag
    <div key="name" className="space-y-5">
      <h2 className="text-xl hud-glow">SPARTAN IDENTIFICATION</h2>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs tracking-[0.2em] text-green-600 uppercase block mb-2">FIRST NAME</label>
          <input
            value={firstName}
            onChange={e => setFirstName(e.target.value)}
            className="w-full bg-black/50 border border-green-800 text-green-300 px-4 py-3 font-mono focus:border-green-400 focus:outline-none"
            placeholder="John"
            autoFocus
          />
        </div>
        <div>
          <label className="text-xs tracking-[0.2em] text-green-600 uppercase block mb-2">LAST NAME</label>
          <input
            value={lastName}
            onChange={e => setLastName(e.target.value)}
            className="w-full bg-black/50 border border-green-800 text-green-300 px-4 py-3 font-mono focus:border-green-400 focus:outline-none"
            placeholder="117"
          />
        </div>
      </div>
      <div>
        <label className="text-xs tracking-[0.2em] text-green-600 uppercase block mb-2">GAMERTAG <span className="text-green-800">(FOR THE PARTY)</span></label>
        <input
          value={gamertag}
          onChange={e => setGamertag(e.target.value)}
          className="w-full bg-black/50 border border-green-800 text-green-300 px-4 py-3 font-mono focus:border-green-400 focus:outline-none"
          placeholder="What name are you playing under tonight?"
        />
        {player.gamertag && gamertag !== player.gamertag && (
          <p className="text-amber-500 text-xs mt-1">Changing from &quot;{player.gamertag}&quot; (will be tracked)</p>
        )}
      </div>
      <div>
        <label className="text-xs tracking-[0.2em] text-green-600 uppercase block mb-2">XBOX LIVE GAMERTAG <span className="text-green-800">(OPTIONAL LOOKUP)</span></label>
        <input
          value={xblGamertag}
          onChange={e => setXblGamertag(e.target.value)}
          className="w-full bg-black/50 border border-green-800 text-green-300 px-4 py-3 font-mono focus:border-green-400 focus:outline-none"
          placeholder="Your actual Xbox Live gamertag"
        />
        <p className="text-green-800 text-[10px] mt-1">Links to your Xbox profile (gamerscore, achievements, game history across all Halo titles) and HaloTracker for Infinite ranked stats.</p>
      </div>
    </div>,

    // Step 1: HALO CE
    <div key="h1" className="space-y-4">
      <h2 className="text-2xl hud-glow">HALO CE</h2>
      <p className="text-green-600 text-sm">The original. No ranking system. Blood Gulch. Pistol meta.</p>
      <div className="kpi-card p-2 rounded border-amber-500/20">
        <p className="text-amber-400/80 text-xs text-center">
          All ranks are PUBLIC. They influence draft picks and set prediction market odds. Sandbaggers will be exposed (looking at you, Paul).
        </p>
      </div>
      <p className="text-green-500 text-sm mt-4">How well do you know this game?</p>
      <div className="grid grid-cols-2 gap-2">
        {EXP_LEVELS.map(level => (
          <button key={level.id} onClick={() => setH1Exp(level.id)}
            className={`py-4 border text-sm tracking-wider transition-all rounded ${h1Exp === level.id ? `${level.color} bg-green-400/10` : "border-green-900/20 text-green-900 hover:border-green-700"}`}
          >{level.label}</button>
        ))}
      </div>
    </div>,

    // Step 2: HALO 2
    <div key="h2" className="space-y-4">
      <h2 className="text-2xl hud-glow">HALO 2</h2>
      <p className="text-green-600 text-sm">1-50. The golden era. BXR. Superbounce. Lockout.</p>
      <p className="text-green-500 text-sm">Experience level:</p>
      <div className="grid grid-cols-2 gap-2">
        {EXP_LEVELS.map(level => (
          <button key={level.id} onClick={() => { setH2Exp(level.id); if (level.id === "never") setH2Rank(0); }}
            className={`py-4 border text-sm tracking-wider transition-all rounded ${h2Exp === level.id ? `${level.color} bg-green-400/10` : "border-green-900/20 text-green-900 hover:border-green-700"}`}
          >{level.label}</button>
        ))}
      </div>
      {h2Exp !== "never" && (
        <div className="mt-2">
          <p className="text-green-500 text-sm mb-2">Highest rank:</p>
          <div className="grid grid-cols-5 gap-1.5">
            {Array.from({ length: 50 }, (_, i) => i + 1).map(r => (
              <button key={r} onClick={() => setH2Rank(r)}
                className={`flex flex-col items-center p-1.5 border rounded transition-all ${h2Rank === r ? "border-green-400 bg-green-400/20 scale-105" : "border-green-900/20 hover:border-green-600"}`}
              >
                <img src={rankIconUrl(r)} alt={`${r}`} className="w-8 h-8" />
                <span className={`text-[10px] mt-0.5 ${h2Rank === r ? "text-green-300" : "text-green-800"}`}>{r}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>,

    // Step 3: HALO 3
    <div key="h3" className="space-y-4">
      <h2 className="text-2xl hud-glow">HALO 3</h2>
      <p className="text-green-600 text-sm">The Pit. MLG. Military ranks from Recruit to General.</p>
      <p className="text-green-500 text-sm">Experience level:</p>
      <div className="grid grid-cols-2 gap-2">
        {EXP_LEVELS.map(level => (
          <button key={level.id} onClick={() => { setH3Exp(level.id); if (level.id === "never") setH3Rank("never"); }}
            className={`py-4 border text-sm tracking-wider transition-all rounded ${h3Exp === level.id ? `${level.color} bg-green-400/10` : "border-green-900/20 text-green-900 hover:border-green-700"}`}
          >{level.label}</button>
        ))}
      </div>
      {h3Exp !== "never" && (
        <div className="mt-2">
          <p className="text-green-500 text-sm mb-2">Highest rank:</p>
          <div className="grid grid-cols-4 gap-2">
            {[
              { id: "recruit", label: "Recruit" }, { id: "apprentice", label: "Apprentice" },
              { id: "private", label: "Private" }, { id: "corporal", label: "Corporal" },
              { id: "sergeant", label: "Sergeant" }, { id: "gunnery_sgt", label: "Gunnery Sgt" },
              { id: "lieutenant", label: "Lieutenant" }, { id: "captain", label: "Captain" },
              { id: "major", label: "Major" }, { id: "commander", label: "Commander" },
              { id: "colonel", label: "Colonel" }, { id: "brigadier", label: "Brigadier" },
              { id: "general", label: "General" },
            ].map(r => (
              <button key={r.id} onClick={() => setH3Rank(r.id)}
                className={`flex flex-col items-center p-2 border rounded transition-all ${h3Rank === r.id ? "border-green-400 bg-green-400/20" : "border-green-900/20 hover:border-green-600"}`}
              >
                <img src={`/ranks/h3/${r.id}.svg`} alt={r.label} className="w-10 h-10" />
                <span className={`text-[10px] mt-1 ${h3Rank === r.id ? "text-green-300" : "text-green-800"}`}>{r.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>,

    // Step 4: HALO 5
    <div key="h5" className="space-y-4">
      <h2 className="text-2xl hud-glow">HALO 5: GUARDIANS</h2>
      <p className="text-green-600 text-sm">Bronze to Champion CSR. Breakout. Warzone.</p>
      <p className="text-green-500 text-sm">Experience level:</p>
      <div className="grid grid-cols-2 gap-2">
        {EXP_LEVELS.map(level => (
          <button key={level.id} onClick={() => { setH5Exp(level.id); if (level.id === "never") setH5Csr("never"); }}
            className={`py-4 border text-sm tracking-wider transition-all rounded ${h5Exp === level.id ? `${level.color} bg-green-400/10` : "border-green-900/20 text-green-900 hover:border-green-700"}`}
          >{level.label}</button>
        ))}
      </div>
      {h5Exp !== "never" && (
        <div className="mt-2">
          <p className="text-green-500 text-sm mb-2">Highest CSR division:</p>
          <div className="grid grid-cols-4 gap-2">
            {["bronze","silver","gold","platinum","diamond","onyx","champion"].map(r => (
              <button key={r} onClick={() => setH5Csr(r)}
                className={`flex flex-col items-center p-2 border rounded transition-all ${h5Csr === r ? "border-green-400 bg-green-400/20" : "border-green-900/20 hover:border-green-600"}`}
              >
                <img src={`/ranks/h5/${r}.png`} alt={r} className="w-12 h-12 object-contain" />
                <span className={`text-[10px] mt-1 uppercase ${h5Csr === r ? "text-green-300" : "text-green-800"}`}>{r}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>,

    // Step 5: HALO INFINITE
    <div key="hinf" className="space-y-4">
      <h2 className="text-2xl hud-glow">HALO INFINITE</h2>
      <p className="text-green-600 text-sm">Bronze to Onyx. Most recent competitive experience.</p>
      <p className="text-green-500 text-sm">Experience level:</p>
      <div className="grid grid-cols-2 gap-2">
        {EXP_LEVELS.map(level => (
          <button key={level.id} onClick={() => { setHinfExp(level.id); if (level.id === "never") setHinfCsr("never"); }}
            className={`py-4 border text-sm tracking-wider transition-all rounded ${hinfExp === level.id ? `${level.color} bg-green-400/10` : "border-green-900/20 text-green-900 hover:border-green-700"}`}
          >{level.label}</button>
        ))}
      </div>
      {hinfExp !== "never" && (
        <div className="mt-2">
          <p className="text-green-500 text-sm mb-2">Highest ranked tier:</p>
          <div className="grid grid-cols-4 gap-2">
            {["bronze","silver","gold","platinum","diamond","onyx"].map(r => (
              <button key={r} onClick={() => setHinfCsr(r)}
                className={`flex flex-col items-center p-2 border rounded transition-all ${hinfCsr === r ? "border-green-400 bg-green-400/20" : "border-green-900/20 hover:border-green-600"}`}
              >
                <img src={`/ranks/hinf/${r}.png`} alt={r} className="w-12 h-12 object-contain" />
                <span className={`text-[10px] mt-1 uppercase ${hinfCsr === r ? "text-green-300" : "text-green-800"}`}>{r}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>,

    // Step 6: Last played
    <div key="lastplayed" className="space-y-4">
      <h2 className="text-2xl hud-glow">LAST DEPLOYMENT</h2>
      <p className="text-green-600 text-sm">When did you last play any Halo?</p>
      <div className="grid grid-cols-2 gap-3 mt-4">
        {[
          { id: 0, label: "YEARS AGO", sub: "Dusty controller" },
          { id: 2024, label: "2024", sub: "Somewhat recent" },
          { id: 2025, label: "2025", sub: "Still got it" },
          { id: 2026, label: "THIS YEAR", sub: "Warmed up" },
        ].map(y => (
          <button key={y.id} onClick={() => setLastPlayed(y.id)}
            className={`py-5 border text-sm tracking-wider transition-all rounded ${lastPlayed === y.id ? "text-green-300 border-green-500 bg-green-400/10" : "border-green-900/20 text-green-900 hover:border-green-700"}`}
          >
            <div>{y.label}</div>
            <div className="text-[10px] text-green-800 mt-1">{y.sub}</div>
          </button>
        ))}
      </div>
    </div>,

    // Step 2: Sensitivity
    <div key="sens" className="space-y-6">
      <h2 className="text-xl hud-glow">LOOK SENSITIVITY</h2>
      <p className="text-green-600 text-sm">How fast do you want to look around?</p>
      <div className="flex items-center gap-4">
        <span className="text-green-700 text-sm w-12">SLOW</span>
        <input
          type="range"
          min={1}
          max={10}
          value={sensitivity}
          onChange={e => setSensitivity(parseInt(e.target.value))}
          className="flex-1 accent-green-500"
        />
        <span className="text-green-700 text-sm w-12 text-right">FAST</span>
      </div>
      <div className="text-center text-4xl hud-glow text-green-300">{sensitivity}</div>
      <div className="flex items-center justify-between mt-4 kpi-card p-4 rounded">
        <span className="text-green-400">INVERT Y-AXIS</span>
        <button
          onClick={() => setInvertedY(!invertedY)}
          className={`px-4 py-2 border text-sm tracking-widest ${
            invertedY
              ? "border-green-400 bg-green-400/10 text-green-300"
              : "border-green-900 text-green-700"
          }`}
        >
          {invertedY ? "INVERTED" : "NORMAL"}
        </button>
      </div>
    </div>,

    // Step 3: Button Layout
    <div key="layout" className="space-y-4">
      <h2 className="text-xl hud-glow">BUTTON LAYOUT</h2>
      <p className="text-green-600 text-sm">Select your controller config</p>
      <div className="grid grid-cols-2 gap-2">
        {BUTTON_LAYOUTS.map(layout => (
          <button
            key={layout.id}
            onClick={() => setButtonLayout(layout.id)}
            className={`p-3 border text-left transition-all ${
              buttonLayout === layout.id
                ? "border-green-400 bg-green-400/10"
                : "border-green-900/30 hover:border-green-700"
            }`}
          >
            <div className={`text-sm font-bold ${buttonLayout === layout.id ? "text-green-300" : "text-green-500"}`}>
              {layout.name}
            </div>
            <div className="text-xs text-green-700">{layout.desc}</div>
          </button>
        ))}
      </div>
    </div>,
  ];

  const canAdvance = () => {
    switch (step) {
      case 0: return !!(firstName && lastName && gamertag);
      case 1: return h1Exp !== "";  // must click an experience level
      case 2: return h2Exp !== "" && (h2Exp === "never" || h2Rank > 0);
      case 3: return h3Exp !== "" && (h3Exp === "never" || h3Rank !== "never");
      case 4: return h5Exp !== "" && (h5Exp === "never" || h5Csr !== "never");
      case 5: return hinfExp !== "" && (hinfExp === "never" || hinfCsr !== "never");
      case 6: return lastPlayed !== -1;  // must select when last played
      default: return true;
    }
  };

  const handleAdvance = () => {
    if (!canAdvance()) return;
    if (step < steps.length - 1) {
      setStep(s => s + 1);
    } else {
      onSave({ first_name: firstName, last_name: lastName, name: `${firstName} ${lastName}`.trim(), gamertag, xbl_gamertag: xblGamertag || null, h2_rank: h2Rank, h3_rank: h3Rank, h5_csr: h5Csr, hinf_csr: hinfCsr, h1_experience: h1Exp, h2_experience: h2Exp, h3_experience: h3Exp, h5_experience: h5Exp, hinf_experience: hinfExp, last_played_year: lastPlayed, sensitivity, inverted_y: invertedY, button_layout: buttonLayout, profile_confirmed: true });
    }
  };

  // Enter key advances wizard
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Enter") handleAdvance();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <p className="text-xs tracking-[0.3em] text-green-600 uppercase">
            STEP {step + 1} OF {steps.length}
          </p>
          <div className="flex gap-1 justify-center mt-2">
            {steps.map((_, i) => (
              <div
                key={i}
                className={`h-1 w-12 ${i <= step ? "bg-green-400" : "bg-green-900/30"}`}
              />
            ))}
          </div>
        </div>

        <div className="kpi-card p-6 rounded">
          {steps[step]}

          <div className="flex justify-between mt-6">
            {step > 0 ? (
              <button
                onClick={() => setStep(s => s - 1)}
                className="px-4 py-2 border border-green-900 text-green-700 text-sm tracking-widest"
              >
                BACK
              </button>
            ) : <div />}

            {step < steps.length - 1 ? (
              <button
                onClick={handleAdvance}
                disabled={!canAdvance()}
                className="px-6 py-2 border border-green-500 text-green-400 hover:bg-green-500/10 text-sm tracking-widest disabled:opacity-30 disabled:cursor-not-allowed"
              >
                NEXT <span className="text-green-700 text-[10px] ml-1">(ENTER)</span>
              </button>
            ) : (
              <button
                onClick={handleAdvance}
                className="px-6 py-2 border border-amber-500 text-amber-400 hover:bg-amber-500/10 text-sm tracking-widest"
              >
                DEPLOY <span className="text-amber-700 text-[10px] ml-1">(ENTER)</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- MAIN APP ----

interface MainAppProps {
  screen: AppScreen;
  setScreen: (s: AppScreen) => void;
  setNeedsProfile: (v: boolean) => void;
  session: ReturnType<typeof useSession>;
  players: Player[];
  draft: ReturnType<typeof useDraft>["draft"];
  picks: ReturnType<typeof useDraft>["picks"];
  createDraft: ReturnType<typeof useDraft>["createDraft"];
  makePick: ReturnType<typeof useDraft>["makePick"];
  maps: HaloMap[];
  voting: ReturnType<typeof useMapVoting>;
  games: ReturnType<typeof useGames>["games"];
  logGame: ReturnType<typeof useGames>["logGame"];
  ranksRevealed: boolean;
  updateSetting: (key: string, value: string) => Promise<void>;
}

function MainApp({ screen, setScreen, setNeedsProfile, session, players, draft, picks, createDraft, makePick, maps, voting, games, logGame, ranksRevealed, updateSetting }: MainAppProps) {
  const [draftMode, setDraftMode] = useState<"8v8" | "4v4" | "2v2" | "ffa">("8v8");
  const [captainA, setCaptainA] = useState("");
  const [captainB, setCaptainB] = useState("");
  const [mapFilter, setMapFilter] = useState<string>("all");
  const [variantFilter, setVariantFilter] = useState<string>("all");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const checkedIn = players.filter(p => p.checked_in);
  const totalControllers = players.reduce((s, p) => s + (p.controller_count || 0), 0);
  const totalXbox = players.reduce((s, p) => s + (p.xbox_count || 0), 0);
  const totalTVs = players.reduce((s, p) => s + (p.tv_count || 0), 0);

  const alphaTeam = picks.filter(p => p.team === "alpha");
  const bravoTeam = picks.filter(p => p.team === "bravo");

  const alphaWins = games.filter(g => g.alpha_score > g.bravo_score).length;
  const bravoWins = games.filter(g => g.bravo_score > g.alpha_score).length;

  // Get unique game names and variants for filters
  const gameNames = [...new Set(maps.map(m => m.game))].sort();
  const variants = [...new Set(maps.map(m => m.variant))].sort();

  const filteredMaps = maps.filter(m => {
    if (mapFilter !== "all" && m.game !== mapFilter) return false;
    if (variantFilter !== "all" && m.variant !== variantFilter) return false;
    return true;
  });

  // Sort maps by vote tally
  const sortedMaps = [...filteredMaps].sort((a, b) => (voting.tally[b.id] || 0) - (voting.tally[a.id] || 0));

  return (
    <>
      {/* HEADER */}
      <header className="border-b border-green-900/50 px-4 py-4 md:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold hud-glow tracking-tight">
                OPERATION: BIRTHDAY AMBUSH
              </h1>
              <p className="text-green-700 text-xs mt-1">
                Spartan <span className="text-green-400">{session.player?.gamertag}</span> // {session.player?.name}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => { setNeedsProfile(true); setScreen("profile"); }} className="text-xs text-green-700 hover:text-green-400 border border-green-900/30 px-2 py-1">
                EDIT PROFILE
              </button>
              <button onClick={session.logout} className="text-xs text-red-700 hover:text-red-400 border border-red-900/30 px-2 py-1">
                LOGOUT
              </button>
            </div>
          </div>

          <nav className="flex gap-1 mt-4 overflow-x-auto">
            {(["lobby", "equipment", "draft", "voting", "games"] as const).map(tab => {
              const wip = tab === "draft" || tab === "games";
              const tabLabels: Record<string, string> = { lobby: "LOBBY", equipment: "EQUIPMENT", draft: "DRAFT", voting: "MAPS", games: "GAMES" };
              return (
              <button
                key={tab}
                onClick={() => setScreen(tab)}
                className={`px-4 py-2 text-xs tracking-widest uppercase border whitespace-nowrap transition-all ${
                  screen === tab
                    ? "border-green-400 bg-green-400/10 text-green-300"
                    : wip
                    ? "border-amber-900/30 text-amber-900 hover:border-amber-700 hover:text-amber-600"
                    : "border-green-900/30 text-green-700 hover:border-green-600 hover:text-green-400"
                }`}
              >
                {tabLabels[tab] || tab}{wip ? " *" : ""}
              </button>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 md:px-8">

        {/* ---- LOBBY ---- */}
        {screen === "lobby" && (
          <div className="space-y-6">
            {/* MISSION BRIEF */}
            <div className="kpi-card p-6 rounded">
              <h2 className="text-xs tracking-[0.3em] text-green-600 uppercase mb-3">// MISSION BRIEFING</h2>
              <div className="text-green-300 space-y-2 text-sm">
                <p>Surprise Halo LAN party. Parker thinks everyone has Easter plans.</p>
                <p className="text-green-600">Paul sets up at 19:00. McClain brings Parker at 19:30. We ambush.</p>
                <p className="text-amber-400/80">6190 Bent Tree Cove, Murrayville GA 30564</p>
              </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <KPICard label="CHECKED IN" value={checkedIn.length} sub={`of ${players.length} spartans`} />
              <div onClick={() => setScreen("equipment")} className="cursor-pointer"><KPICard label="XBOXES" value={totalXbox} sub="tap to see manifest" /></div>
              <div onClick={() => setScreen("equipment")} className="cursor-pointer"><KPICard label="CONTROLLERS" value={totalControllers} sub={`${(totalControllers / players.length).toFixed(1)}/player`} /></div>
              <KPICard label="GAMES PLAYED" value={games.length} sub={alphaWins || bravoWins ? `${alphaWins}-${bravoWins}` : "none yet"} />
            </div>

            {/* CHECK IN */}
            {!session.player?.checked_in && (
              <button
                onClick={session.checkIn}
                className="w-full py-4 border-2 border-green-500 text-green-400 hover:bg-green-500/10 text-lg tracking-widest border-pulse"
              >
                CHECK IN
              </button>
            )}

            {/* ADMIN - subtle inline */}
            {session.player?.is_admin && (
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => updateSetting("ranks_revealed", ranksRevealed ? "false" : "true")}
                  className={`text-[10px] px-2 py-1 border rounded ${ranksRevealed ? "border-green-800 text-green-700" : "border-green-900/20 text-green-900"}`}
                >
                  {ranksRevealed ? "composite: visible" : "composite: hidden"}
                </button>
              </div>
            )}

            {/* PLAYER LIST */}
            <div className="kpi-card p-4 rounded">
              <h2 className="text-xs tracking-[0.3em] text-green-600 uppercase mb-4">// CONFIRMED SPARTANS</h2>
              <div className="space-y-2">
                {players.filter(p => p.profile_confirmed).map(p => (
                  <PlayerCard key={p.id} player={p} ranksRevealed={ranksRevealed} />
                ))}
              </div>

              {/* Unconfirmed - just show phone numbers */}
              {players.filter(p => !p.profile_confirmed).length > 0 && (
                <>
                  <h3 className="text-xs tracking-[0.3em] text-green-800 uppercase mt-6 mb-3">// AWAITING AUTHENTICATION ({players.filter(p => !p.profile_confirmed).length}) - tap to pre-rate</h3>
                  <div className="space-y-2">
                    {players.filter(p => !p.profile_confirmed).map(p => (
                      <UnconfirmedPlayerCard key={p.id} player={p} />
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* ---- DRAFT (WIP) ---- */}
        {screen === "draft" && (
          <WIPScreen
            title="SNAKE DRAFT"
            features={[
              "Team captains: Paul + Parker",
              "Snake draft pick order (1-2-2-2-1)",
              "Flexible team sizes: 8v8, 4v4, 2v2, FFA",
              "Redraft between series",
              "Draft seeded by combat records + peer assessments",
            ]}
            eta="GAME NIGHT"
          />
        )}

        {/* Draft v2 code saved in git history */}

        {/* ---- EQUIPMENT ---- */}
        {screen === "equipment" && (
          <div className="space-y-6">
            <div className="kpi-card p-4 rounded">
              <h2 className="text-xs tracking-[0.3em] text-green-600 uppercase mb-2">// ARMORY</h2>
              <p className="text-green-700 text-sm">What are you bringing? Update your loadout so we know what we have.</p>
            </div>

            {/* My equipment editor */}
            <EquipmentEditor player={session.player!} />

            {/* Everyone's equipment */}
            <div className="kpi-card p-4 rounded">
              <h2 className="text-xs tracking-[0.3em] text-green-600 uppercase mb-4">// FULL MANIFEST</h2>
              <EquipmentManifest players={players} />
            </div>
          </div>
        )}

        {/* ---- MAP VOTING ---- */}
        {screen === "voting" && (
          <MapVotingSwipe maps={maps} voting={voting} playerId={session.playerId} />
        )}

        {/* ---- GAMES (WIP) ---- */}
        {screen === "games" && (
          <WIPScreen
            title="LIVE GAME TRACKER"
            features={[
              "Post-game screenshot upload with AI stat parsing",
              "Live series score (Alpha vs Bravo)",
              "Per-player K/D, assists, headshots",
              "MVP tracking per game",
              "Prediction market / HALO token wagering",
              "Community odds from pre-game skill assessments",
            ]}
            eta="GAME NIGHT"
          />
        )}

        {/* Games v2 code saved in git history */}
      </main>

      {/* Cortana Helper */}
      <CortanaHelper screen={screen} playerCount={players.filter(p => p.profile_confirmed).length} />

      <footer className="border-t border-green-900/30 px-4 py-4 mt-8">
        <div className="max-w-6xl mx-auto flex justify-between text-xs text-green-800">
          <span>UNSC // OPERATION BIRTHDAY AMBUSH</span>
          <span>CLASSIFIED</span>
        </div>
      </footer>
    </>
  );
}

// ---- QUICK SCORE ENTRY ----

function QuickScoreEntry({ maps, players, onSubmit }: { maps: HaloMap[]; players: Player[]; onSubmit: (mapId: string, a: number, b: number, mvp?: string) => Promise<unknown> }) {
  const [mapId, setMapId] = useState("");
  const [alphaScore, setAlphaScore] = useState("");
  const [bravoScore, setBravoScore] = useState("");
  const [mvpId, setMvpId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!mapId || !alphaScore || !bravoScore) return;
    setSubmitting(true);
    await onSubmit(mapId, parseInt(alphaScore), parseInt(bravoScore), mvpId || undefined);
    setMapId("");
    setAlphaScore("");
    setBravoScore("");
    setMvpId("");
    setSubmitting(false);
  };

  return (
    <div className="kpi-card p-4 rounded">
      <h3 className="text-xs tracking-[0.2em] text-green-600 uppercase mb-3">// MANUAL SCORE ENTRY</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="col-span-2">
          <label className="text-xs text-green-700 block mb-1">MAP</label>
          <select
            value={mapId}
            onChange={e => setMapId(e.target.value)}
            className="w-full bg-black/50 border border-green-800 text-green-400 px-3 py-2 text-sm"
          >
            <option value="">Select map...</option>
            {maps.map(m => (
              <option key={m.id} value={m.id}>{m.game} - {m.map_name} ({m.game_mode})</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-blue-500 block mb-1">ALPHA</label>
          <input
            type="number"
            value={alphaScore}
            onChange={e => setAlphaScore(e.target.value)}
            className="w-full bg-black/50 border border-blue-800 text-blue-300 px-3 py-2 text-sm"
            placeholder="50"
          />
        </div>
        <div>
          <label className="text-xs text-red-500 block mb-1">BRAVO</label>
          <input
            type="number"
            value={bravoScore}
            onChange={e => setBravoScore(e.target.value)}
            className="w-full bg-black/50 border border-red-800 text-red-300 px-3 py-2 text-sm"
            placeholder="47"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 mt-3">
        <div>
          <label className="text-xs text-amber-500 block mb-1">MVP</label>
          <select
            value={mvpId}
            onChange={e => setMvpId(e.target.value)}
            className="w-full bg-black/50 border border-amber-800 text-amber-300 px-3 py-2 text-sm"
          >
            <option value="">Select MVP...</option>
            {players.map(p => (
              <option key={p.id} value={p.id}>{displayName(p)} ({p.gamertag})</option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <button
            onClick={handleSubmit}
            disabled={!mapId || !alphaScore || !bravoScore || submitting}
            className="w-full py-2 border border-green-500 text-green-400 hover:bg-green-500/10 tracking-widest text-sm uppercase disabled:opacity-30"
          >
            {submitting ? "LOGGING..." : "LOG GAME"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- KPI CARD ----

interface EquipmentItem {
  id: string;
  player_id: string;
  item_type: string;
  model: string | null;
  notes: string | null;
}

function EquipmentEditor({ player }: { player: Player }) {
  const [items, setItems] = useState<EquipmentItem[]>([]);
  const [addingType, setAddingType] = useState<string | null>(null);
  const [model, setModel] = useState("");
  const [notes, setNotes] = useState("");

  const XBOX_MODELS = ["Xbox One", "Xbox One S", "Xbox One X", "Xbox Series S", "Xbox Series X"];
  const CONTROLLER_TYPES = ["Standard Wireless", "Wired", "Elite", "Elite Series 2", "Third Party", "Scuf", "Other"];
  const TV_TYPES = ["32 inch or smaller", "40-49 inch", "50-59 inch", "60-65 inch", "70+ inch", "Monitor"];
  const OTHER_TYPES = ["Ethernet Cable", "Network Switch", "Headset", "N64", "Snacks", "Other"];

  const modelOptions: Record<string, string[]> = {
    xbox: XBOX_MODELS,
    controller: CONTROLLER_TYPES,
    tv: TV_TYPES,
    other: OTHER_TYPES,
  };

  useEffect(() => {
    supabase.from("halo_equipment").select("*").eq("player_id", player.id).order("created_at").then(({ data }) => {
      if (data) setItems(data as EquipmentItem[]);
    });
  }, [player.id]);

  const [qty, setQty] = useState(1);

  const addItem = async () => {
    if (!addingType || !model) return;
    const inserts = Array.from({ length: qty }, () => ({
      player_id: player.id,
      item_type: addingType,
      model,
      notes: notes || null,
    }));
    const { data } = await supabase.from("halo_equipment").insert(inserts).select();
    if (data) setItems(prev => [...prev, ...(data as EquipmentItem[])]);
    setAddingType(null);
    setModel("");
    setNotes("");
    setQty(1);
  };

  const removeItem = async (id: string) => {
    await supabase.from("halo_equipment").delete().eq("id", id);
    setItems(prev => prev.filter(i => i.id !== id));
  };

  const typeLabels: Record<string, string> = { xbox: "XBOX", controller: "CONTROLLER", tv: "TV/MONITOR", other: "OTHER" };
  const typeColors: Record<string, string> = { xbox: "text-green-400 border-green-500", controller: "text-blue-400 border-blue-500", tv: "text-amber-400 border-amber-500", other: "text-purple-400 border-purple-500" };

  return (
    <div className="kpi-card p-4 rounded border-amber-500/20">
      <h3 className="text-xs tracking-[0.2em] text-amber-400 uppercase mb-4">// YOUR LOADOUT</h3>

      {/* Current items */}
      {items.length > 0 && (
        <div className="space-y-1 mb-4">
          {items.map(item => (
            <div key={item.id} className="flex items-center justify-between py-2 px-2 border-b border-green-900/20">
              <div className="flex items-center gap-2">
                <span className={`text-[10px] px-1.5 py-0.5 border rounded ${typeColors[item.item_type] || "text-green-400 border-green-500"}`}>
                  {typeLabels[item.item_type] || item.item_type}
                </span>
                <span className="text-green-300 text-sm">{item.model}</span>
                {item.notes && <span className="text-green-700 text-xs">({item.notes})</span>}
              </div>
              <button onClick={() => removeItem(item.id)} className="text-red-800 hover:text-red-400 text-xs px-2">X</button>
            </div>
          ))}
        </div>
      )}

      {/* Add new item */}
      {!addingType ? (
        <div className="grid grid-cols-4 gap-2">
          {["xbox", "controller", "tv", "other"].map(type => (
            <button key={type} onClick={() => setAddingType(type)}
              className={`py-3 border text-xs tracking-wider rounded hover:bg-green-900/20 transition-all ${typeColors[type]}`}
            >+ {typeLabels[type]}</button>
          ))}
        </div>
      ) : (
        <div className="space-y-3 border border-green-800 p-3 rounded">
          <div className="flex justify-between items-center">
            <span className="text-green-400 text-sm font-bold">ADD {typeLabels[addingType]}</span>
            <button onClick={() => { setAddingType(null); setModel(""); setNotes(""); }} className="text-green-700 text-xs">CANCEL</button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {modelOptions[addingType]?.map(m => (
              <button key={m} onClick={() => setModel(m)}
                className={`py-2 border text-xs rounded transition-all ${model === m ? "border-green-400 bg-green-400/10 text-green-300" : "border-green-900/20 text-green-700 hover:border-green-600"}`}
              >{m}</button>
            ))}
          </div>
          <input
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Notes (optional)"
            className="w-full bg-black/50 border border-green-800 text-green-300 px-3 py-2 text-sm font-mono focus:border-green-400 focus:outline-none"
          />
          <div className="flex items-center gap-2">
            <span className="text-green-600 text-xs">QTY:</span>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5, 6].map(n => (
                <button key={n} onClick={() => setQty(n)}
                  className={`w-8 h-8 border text-sm ${qty === n ? "border-green-400 bg-green-400/10 text-green-300" : "border-green-900/20 text-green-800"}`}
                >{n}</button>
              ))}
            </div>
          </div>
          <button onClick={addItem} disabled={!model}
            className="w-full py-2 border border-green-500 text-green-400 hover:bg-green-500/10 tracking-widest text-sm uppercase disabled:opacity-30">
            ADD {qty > 1 ? `${qty}x ` : ""}TO LOADOUT
          </button>
        </div>
      )}
    </div>
  );
}

function UnconfirmedPlayerCard({ player: p }: { player: Player }) {
  const [expanded, setExpanded] = useState(false);
  const myId = typeof window !== "undefined" ? localStorage.getItem("halo_player_id") : null;

  const phoneDisplay = p.phone_digits
    ? `(${p.phone_digits.slice(0,3)}) ${p.phone_digits.slice(3,6)}-${p.phone_digits.slice(6)}`
    : p.phone || "???";

  return (
    <div className="kpi-card rounded overflow-hidden border-green-900/20">
      <button onClick={() => setExpanded(!expanded)} className="w-full py-2 px-3 flex items-center justify-between hover:bg-green-900/10 transition-all">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-900" />
          <span className="text-green-800 font-mono text-sm">{phoneDisplay}</span>
          {p.tentative_name && <span className="text-green-900 text-xs italic">maybe {p.tentative_name}?</span>}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-green-900">NOT LOGGED IN</span>
          <span className="text-green-800 text-xs">{expanded ? "▲" : "▼"}</span>
        </div>
      </button>
      {expanded && myId && myId !== p.id && (
        <div className="px-3 pb-3 border-t border-green-900/20 pt-3">
          <p className="text-green-700 text-xs mb-2">Pre-rate {p.tentative_name || "this player"} before they log in:</p>
          <PeerAssessment assessorId={myId} target={p} />
        </div>
      )}
    </div>
  );
}

function CortanaIntro({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState(0);

  const slides = [
    {
      bg: "/bg/halo_1.jpg",
      speaker: "CORTANA",
      text: "Wake up, Spartan. We have a mission.",
      sub: "Operation: Birthday Ambush is go. Parker doesn't know what's coming.",
    },
    {
      bg: "/bg/halo_2.jpg",
      speaker: "CORTANA",
      text: "I need to verify your identity.",
      sub: "Enter your phone number to access the operation. Only authorized Spartans may proceed.",
    },
    {
      bg: "/bg/halo_3.jpg",
      speaker: "CORTANA",
      text: "Once verified, you'll register your combat record.",
      sub: "Your Halo rank history across every game. CE through Infinite. Be honest. Your squad will be rating you too.",
    },
    {
      bg: "/bg/halo_4.jpg",
      speaker: "CORTANA",
      text: "Friday night. 7:30 PM. System link.",
      sub: "Snake draft for teams. Map voting. Live scoring. Prediction market. Everything tracked.",
    },
    {
      bg: "/bg/halo_5.jpg",
      speaker: "CORTANA",
      text: "One more thing, Spartan.",
      sub: "Parker thinks everyone has Easter plans. Keep it that way. This site is classified.",
      cta: "I'M READY",
    },
  ];

  const current = slides[step];

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        if (step < slides.length - 1) setStep(s => s + 1);
        else onComplete();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  return (
    <div
      className="min-h-screen flex flex-col justify-end relative overflow-hidden"
      onClick={() => {
        if (step < slides.length - 1) setStep(s => s + 1);
        else onComplete();
      }}
    >
      {/* Background image */}
      <div
        className="absolute inset-0 bg-cover bg-center transition-all duration-700"
        style={{ backgroundImage: `url(${current.bg})` }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent" />

      {/* Progress dots */}
      <div className="absolute top-6 left-0 right-0 flex justify-center gap-2 z-10">
        {slides.map((_, i) => (
          <div key={i} className={`h-1 w-8 rounded ${i <= step ? "bg-blue-400" : "bg-white/20"}`} />
        ))}
      </div>

      {/* Text overlay */}
      <div className="relative z-10 p-6 pb-12 max-w-lg mx-auto w-full">
        <div className="mb-1">
          <span className="text-blue-400 text-xs tracking-[0.3em] font-bold">{current.speaker}</span>
        </div>
        <h2 className="text-2xl md:text-3xl font-bold text-white mb-3 leading-tight" style={{ textShadow: "0 2px 20px rgba(0,0,0,0.8)" }}>
          {current.text}
        </h2>
        <p className="text-green-300/80 text-sm leading-relaxed" style={{ textShadow: "0 1px 10px rgba(0,0,0,0.8)" }}>
          {current.sub}
        </p>

        {current.cta ? (
          <button
            onClick={(e) => { e.stopPropagation(); onComplete(); }}
            className="mt-6 w-full py-4 border-2 border-blue-400 text-blue-300 text-lg tracking-widest hover:bg-blue-400/10 transition-all"
          >
            {current.cta}
          </button>
        ) : (
          <p className="text-white/30 text-xs mt-6 text-center">TAP TO CONTINUE</p>
        )}
      </div>
    </div>
  );
}

function PeerAssessment({ assessorId, target }: { assessorId: string; target: Player }) {
  const [open, setOpen] = useState(false);
  const [assessments, setAssessments] = useState<Record<string, { experience: string; rank_estimate: string }>>({});
  const [saved, setSaved] = useState(false);

  const EXP = ["never", "casual", "experienced", "sweaty"] as const;

  const H3_RANKS = [
    { id: "recruit", label: "REC" }, { id: "apprentice", label: "APP" },
    { id: "private", label: "PVT" }, { id: "corporal", label: "CPL" },
    { id: "sergeant", label: "SGT" }, { id: "gunnery_sgt", label: "GSGT" },
    { id: "lieutenant", label: "LT" }, { id: "captain", label: "CPT" },
    { id: "major", label: "MAJ" }, { id: "commander", label: "CDR" },
    { id: "colonel", label: "COL" }, { id: "brigadier", label: "BRG" },
    { id: "general", label: "GEN" },
  ];

  useEffect(() => {
    if (!open) return;
    supabase.from("halo_peer_assessments").select("*").eq("assessor_id", assessorId).eq("target_id", target.id).then(({ data }) => {
      if (data) {
        const map: Record<string, { experience: string; rank_estimate: string }> = {};
        data.forEach((a: { game: string; experience: string; rank_estimate: string }) => {
          map[a.game] = { experience: a.experience, rank_estimate: a.rank_estimate };
        });
        setAssessments(map);
      }
    });
  }, [open, assessorId, target.id]);

  const setGameData = (game: string, field: "experience" | "rank_estimate", value: string) => {
    setAssessments(prev => ({
      ...prev,
      [game]: {
        experience: prev[game]?.experience || "",
        rank_estimate: prev[game]?.rank_estimate || "",
        [field]: value,
      },
    }));
  };

  const saveAll = async () => {
    const games = ["h1", "h2", "h3", "h5", "hinf"];
    for (const g of games) {
      const a = assessments[g];
      if (a?.experience) {
        await supabase.from("halo_peer_assessments").upsert({
          assessor_id: assessorId, target_id: target.id, game: g,
          experience: a.experience, rank_estimate: a.rank_estimate || null,
          updated_at: new Date().toISOString(),
        }, { onConflict: "assessor_id,target_id,game" });
      }
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="w-full py-2 border border-blue-800 text-blue-400 hover:bg-blue-500/10 text-xs tracking-widest rounded mt-2">
        RATE THIS SPARTAN
      </button>
    );
  }

  const expButtons = (game: string) => (
    <div className="grid grid-cols-4 gap-1">
      {EXP.map(e => (
        <button key={e} onClick={() => {
          setGameData(game, "experience", e);
          if (e === "never") setGameData(game, "rank_estimate", "");
        }}
          className={`py-1.5 border text-[10px] rounded ${assessments[game]?.experience === e ? "border-blue-400 bg-blue-400/10 text-blue-300" : "border-green-900/20 text-green-900"}`}
        >{e.toUpperCase()}</button>
      ))}
    </div>
  );

  return (
    <div className="border border-blue-800 rounded p-3 mt-2 space-y-3 max-h-[60vh] overflow-y-auto">
      <div className="flex justify-between items-center sticky top-0 bg-black/90 py-1 z-10">
        <span className="text-blue-400 text-xs tracking-widest">RATING {target.first_name?.toUpperCase() || target.tentative_name?.toUpperCase()}</span>
        <button onClick={() => setOpen(false)} className="text-blue-800 text-xs border border-blue-900/30 px-2 py-0.5 rounded">CLOSE</button>
      </div>

      {/* HALO CE */}
      <div className="space-y-1">
        <span className="text-green-300 text-xs font-bold">HALO CE</span>
        {expButtons("h1")}
      </div>

      {/* HALO 2 + rank icons */}
      <div className="space-y-1">
        <span className="text-green-300 text-xs font-bold">HALO 2</span>
        {expButtons("h2")}
        {assessments.h2?.experience && assessments.h2.experience !== "never" && (
          <div className="grid grid-cols-5 gap-1 mt-1">
            {Array.from({ length: 50 }, (_, i) => i + 1).map(r => (
              <button key={r} onClick={() => setGameData("h2", "rank_estimate", String(r))}
                className={`flex flex-col items-center p-0.5 border rounded ${assessments.h2?.rank_estimate === String(r) ? "border-blue-400 bg-blue-400/20" : "border-green-900/20"}`}
              >
                <img src={`/ranks/rank_${r}.png`} alt={`${r}`} className="w-6 h-6" />
                <span className={`text-[7px] ${assessments.h2?.rank_estimate === String(r) ? "text-blue-300" : "text-green-800"}`}>{r}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* HALO 3 + rank icons */}
      <div className="space-y-1">
        <span className="text-green-300 text-xs font-bold">HALO 3</span>
        {expButtons("h3")}
        {assessments.h3?.experience && assessments.h3.experience !== "never" && (
          <div className="grid grid-cols-4 gap-1 mt-1">
            {H3_RANKS.map(r => (
              <button key={r.id} onClick={() => setGameData("h3", "rank_estimate", r.id)}
                className={`flex flex-col items-center p-1 border rounded ${assessments.h3?.rank_estimate === r.id ? "border-blue-400 bg-blue-400/20" : "border-green-900/20"}`}
              >
                <img src={`/ranks/h3/${r.id}.svg`} alt={r.label} className="w-7 h-7" />
                <span className={`text-[8px] ${assessments.h3?.rank_estimate === r.id ? "text-blue-300" : "text-green-800"}`}>{r.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* HALO 5 + CSR icons */}
      <div className="space-y-1">
        <span className="text-green-300 text-xs font-bold">HALO 5</span>
        {expButtons("h5")}
        {assessments.h5?.experience && assessments.h5.experience !== "never" && (
          <div className="grid grid-cols-4 gap-1 mt-1">
            {["bronze","silver","gold","platinum","diamond","onyx","champion"].map(r => (
              <button key={r} onClick={() => setGameData("h5", "rank_estimate", r)}
                className={`flex flex-col items-center p-1 border rounded ${assessments.h5?.rank_estimate === r ? "border-blue-400 bg-blue-400/20" : "border-green-900/20"}`}
              >
                <img src={`/ranks/h5/${r}.png`} alt={r} className="w-8 h-8 object-contain" />
                <span className={`text-[8px] uppercase ${assessments.h5?.rank_estimate === r ? "text-blue-300" : "text-green-800"}`}>{r}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* INFINITE + CSR icons */}
      <div className="space-y-1">
        <span className="text-green-300 text-xs font-bold">INFINITE</span>
        {expButtons("hinf")}
        {assessments.hinf?.experience && assessments.hinf.experience !== "never" && (
          <div className="grid grid-cols-4 gap-1 mt-1">
            {["bronze","silver","gold","platinum","diamond","onyx"].map(r => (
              <button key={r} onClick={() => setGameData("hinf", "rank_estimate", r)}
                className={`flex flex-col items-center p-1 border rounded ${assessments.hinf?.rank_estimate === r ? "border-blue-400 bg-blue-400/20" : "border-green-900/20"}`}
              >
                <img src={`/ranks/hinf/${r}.png`} alt={r} className="w-8 h-8 object-contain" />
                <span className={`text-[8px] uppercase ${assessments.hinf?.rank_estimate === r ? "text-blue-300" : "text-green-800"}`}>{r}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* SUBMIT */}
      <button onClick={saveAll}
        className={`w-full py-3 border text-xs tracking-widest rounded sticky bottom-0 ${saved ? "border-green-400 text-green-400 bg-green-400/10" : "border-blue-500 text-blue-400 hover:bg-blue-500/10 bg-black/90"}`}>
        {saved ? "SAVED" : "SUBMIT ASSESSMENT"}
      </button>
    </div>
  );
}

function PlayerCard({ player: p, ranksRevealed }: { player: Player; ranksRevealed: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const [skillVotes, setSkillVotes] = useState<Record<string, number>>({});
  const [myVotes, setMyVotes] = useState<Record<string, number>>({});
  const [equipment, setEquipment] = useState<EquipmentItem[]>([]);
  const [cardTab, setCardTab] = useState<"combat" | "loadout">("combat");
  const myId = typeof window !== "undefined" ? localStorage.getItem("halo_player_id") : null;

  useEffect(() => {
    if (!expanded) return;
    // Fetch equipment
    supabase.from("halo_equipment").select("*").eq("player_id", p.id).then(({ data }) => {
      if (data) setEquipment(data as EquipmentItem[]);
    });
    // Fetch aggregate votes for this player
    supabase.from("halo_skill_votes").select("game, vote").eq("target_id", p.id).then(({ data }) => {
      if (data) {
        const totals: Record<string, number> = {};
        data.forEach((v: { game: string; vote: number }) => { totals[v.game] = (totals[v.game] || 0) + v.vote; });
        setSkillVotes(totals);
      }
    });
    // Fetch my votes for this player
    if (myId) {
      supabase.from("halo_skill_votes").select("game, vote").eq("target_id", p.id).eq("voter_id", myId).then(({ data }) => {
        if (data) {
          const mine: Record<string, number> = {};
          data.forEach((v: { game: string; vote: number }) => { mine[v.game] = v.vote; });
          setMyVotes(mine);
        }
      });
    }
  }, [expanded, p.id, myId]);

  const castSkillVote = async (game: string, vote: number) => {
    if (!myId || myId === p.id) return; // can't vote for yourself
    await supabase.from("halo_skill_votes").upsert({ voter_id: myId, target_id: p.id, game, vote }, { onConflict: "voter_id,target_id,game" });
    setMyVotes(prev => ({ ...prev, [game]: vote }));
    setSkillVotes(prev => ({ ...prev, [game]: (prev[game] || 0) + vote - (myVotes[game] || 0) }));
  };

  const LAYOUT_NAMES: Record<string, string> = {
    default: "Default", southpaw: "Southpaw", bumper_jumper: "Bumper Jumper",
    recon: "Recon", fishstick: "Fishstick", boxer: "Boxer",
    green_thumb: "Green Thumb", walkie_talkie: "Walkie Talkie",
  };

  const H3_RANKS: Record<string, string> = {
    recruit: "Recruit", apprentice: "Apprentice", private: "Private", corporal: "Corporal",
    sergeant: "Sergeant", gunnery_sgt: "Gunnery Sgt", lieutenant: "Lieutenant",
    captain: "Captain", major: "Major", commander: "Commander", colonel: "Colonel",
    brigadier: "Brigadier", general: "General",
  };

  const expLabel = (exp: string) => {
    if (!exp || exp === "never") return null;
    return exp.charAt(0).toUpperCase() + exp.slice(1);
  };

  return (
    <div className="kpi-card rounded overflow-hidden">
      {/* Header row - always visible */}
      <button onClick={() => setExpanded(!expanded)} className="w-full py-3 px-3 flex items-center justify-between hover:bg-green-900/10 transition-all">
        <div className="flex items-center gap-2">
          {/* Self-assessed rank icons - always visible */}
          {p.h2_rank > 0 && <img src={`/ranks/rank_${p.h2_rank}.png`} alt="H2" className="w-5 h-5" />}
          {p.h3_rank && p.h3_rank !== "never" && <img src={`/ranks/h3/${p.h3_rank}.svg`} alt="H3" className="w-5 h-5" />}
          {p.h5_csr && p.h5_csr !== "never" && <img src={`/ranks/h5/${p.h5_csr}.png`} alt="H5" className="w-5 h-5 object-contain" />}
          {p.hinf_csr && p.hinf_csr !== "never" && <img src={`/ranks/hinf/${p.hinf_csr}.png`} alt="INF" className="w-5 h-5 object-contain" />}
          <span className="text-green-300 font-bold">{displayName(p)}</span>
          <span className="text-green-700 text-xs">// {p.gamertag}</span>
        </div>
        <div className="flex items-center gap-2">
          {p.is_captain && (
            <span className="text-xs px-2 py-0.5 border border-amber-500/30 text-amber-400 bg-amber-400/10 rounded">CPT</span>
          )}
          <span className="text-green-700 text-xs">{expanded ? "▲" : "▼"}</span>
        </div>
      </button>

      {/* Expanded profile */}
      {expanded && (
        <div className="border-t border-green-900/30">
          {/* Card tabs */}
          <div className="flex border-b border-green-900/20">
            <button onClick={() => setCardTab("combat")}
              className={`flex-1 py-2 text-xs tracking-widest ${cardTab === "combat" ? "text-green-300 border-b border-green-400" : "text-green-800"}`}>
              COMBAT
            </button>
            <button onClick={() => setCardTab("loadout")}
              className={`flex-1 py-2 text-xs tracking-widest ${cardTab === "loadout" ? "text-green-300 border-b border-green-400" : "text-green-800"}`}>
              LOADOUT
            </button>
          </div>

          {/* COMBAT TAB */}
          {cardTab === "combat" && (
          <div className="px-3 pb-3 pt-3 space-y-3">
          {/* Combat Record */}
          <div>
            <p className="text-xs text-green-600 tracking-widest mb-2">COMBAT RECORD (SELF-ASSESSED)</p>
            <div className="grid grid-cols-5 gap-2 text-center">
              {[
                { label: "CE", exp: p.h1_experience, icon: null },
                { label: "H2", exp: p.h2_experience, icon: p.h2_rank > 0 ? `/ranks/rank_${p.h2_rank}.png` : null, sub: p.h2_rank > 0 ? `Rank ${p.h2_rank}` : null },
                { label: "H3", exp: p.h3_experience, icon: p.h3_rank && p.h3_rank !== "never" ? `/ranks/h3/${p.h3_rank}.svg` : null, sub: H3_RANKS[p.h3_rank] || null },
                { label: "H5", exp: p.h5_experience, icon: p.h5_csr && p.h5_csr !== "never" ? `/ranks/h5/${p.h5_csr}.png` : null, sub: p.h5_csr !== "never" ? p.h5_csr : null },
                { label: "INF", exp: p.hinf_experience, icon: p.hinf_csr && p.hinf_csr !== "never" ? `/ranks/hinf/${p.hinf_csr}.png` : null, sub: p.hinf_csr !== "never" ? p.hinf_csr : null },
              ].map(g => {
                const gameKey = g.label === "CE" ? "h1" : g.label === "H2" ? "h2" : g.label === "H3" ? "h3" : g.label === "H5" ? "h5" : "hinf";
                const voteTotal = skillVotes[gameKey] || 0;
                const myVote = myVotes[gameKey] || 0;
                return (
                <div key={g.label} className="flex flex-col items-center">
                  <span className="text-green-600 text-[10px] mb-1">{g.label}</span>
                  {g.icon ? (
                    <img src={g.icon} alt={g.label} className="w-8 h-8 object-contain" />
                  ) : (
                    <div className="w-8 h-8 flex items-center justify-center text-green-900 text-xs">
                      {expLabel(g.exp) || "N/A"}
                    </div>
                  )}
                  {g.sub && <span className="text-green-700 text-[9px] mt-0.5 capitalize">{g.sub}</span>}
                  {expLabel(g.exp) && <span className={`text-[8px] mt-0.5 ${g.exp === "sweaty" ? "text-amber-400" : "text-green-600"}`}>{expLabel(g.exp)}</span>}
                  {/* Community vote buttons */}
                  {expLabel(g.exp) && myId !== p.id && (
                    <div className="flex items-center gap-1 mt-1">
                      <button onClick={(e) => { e.stopPropagation(); castSkillVote(gameKey, 1); }}
                        className={`text-[10px] px-1 ${myVote === 1 ? "text-green-300" : "text-green-900 hover:text-green-500"}`}>▲</button>
                      <span className={`text-[9px] ${voteTotal > 0 ? "text-green-400" : voteTotal < 0 ? "text-red-400" : "text-green-800"}`}>{voteTotal > 0 ? `+${voteTotal}` : voteTotal}</span>
                      <button onClick={(e) => { e.stopPropagation(); castSkillVote(gameKey, -1); }}
                        className={`text-[10px] px-1 ${myVote === -1 ? "text-red-300" : "text-green-900 hover:text-red-500"}`}>▼</button>
                    </div>
                  )}
                </div>
                );
              })}
            </div>
          </div>

          {/* Composite Rank - hidden until admin reveals */}
          {ranksRevealed && (
            <div className="border-t border-amber-900/30 pt-2">
              <p className="text-xs text-amber-400 tracking-widest mb-1">COMPOSITE RANK (PEER-ASSESSED)</p>
              <div className="grid grid-cols-5 gap-2 text-center">
                {["h1","h2","h3","h5","hinf"].map(game => {
                  const total = skillVotes[game] || 0;
                  return (
                    <div key={game} className="text-center">
                      <span className="text-green-700 text-[10px]">{game.toUpperCase()}</span>
                      <div className={`text-sm font-bold ${total > 0 ? "text-green-400" : total < 0 ? "text-red-400" : "text-green-800"}`}>
                        {total > 0 ? `+${total}` : total}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Controller Setup */}
          <div className="flex items-center justify-between text-xs border-t border-green-900/20 pt-2">
            <div className="flex gap-4">
              <span className="text-green-600">SENSITIVITY: <span className="text-green-300">{p.sensitivity}/10</span></span>
              <span className="text-green-600">Y-AXIS: <span className="text-green-300">{p.inverted_y ? "INVERTED" : "NORMAL"}</span></span>
            </div>
            <span className="text-green-600">LAYOUT: <span className="text-green-300">{LAYOUT_NAMES[p.button_layout] || p.button_layout}</span></span>
          </div>

          {/* Rate This Spartan */}
          {myId && myId !== p.id && (
            <PeerAssessment assessorId={myId} target={p} />
          )}

          {/* Last Played + Stats + Contact Card */}
          <div className="flex items-center justify-between text-xs text-green-700 border-t border-green-900/20 pt-2 flex-wrap gap-2">
            <span>LAST PLAYED: {p.last_played_year === 2026 ? "This year" : p.last_played_year > 0 ? String(p.last_played_year) : "Years ago"}</span>
            <div className="flex gap-2">
              {p.xbl_gamertag && (
                <>
                  <a
                    href={`https://halotracker.com/halo-infinite/profile/xbl/${encodeURIComponent(String(p.xbl_gamertag))}/overview`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    className="text-blue-400 hover:text-blue-300 text-[10px] border border-blue-900/30 px-2 py-0.5 rounded"
                  >
                    HALO STATS
                  </a>
                  <a
                    href={`https://www.xboxgamertag.com/search/${encodeURIComponent(String(p.xbl_gamertag))}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    className="text-green-500 hover:text-green-300 text-[10px] border border-green-900/30 px-2 py-0.5 rounded"
                  >
                    XBOX PROFILE
                  </a>
                </>
              )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                const vcard = `BEGIN:VCARD\nVERSION:3.0\nN:${p.last_name || ""};${p.first_name || ""}\nFN:${displayName(p)}\n${p.phone_digits ? `TEL:+1${p.phone_digits}` : ""}\nNOTE:Gamertag: ${p.gamertag || "?"} // H2 Rank: ${p.h2_rank} // Operation Birthday Ambush Spartan\nEND:VCARD`;
                const blob = new Blob([vcard], { type: "text/vcard" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `${p.first_name || "spartan"}_${p.last_name || "contact"}.vcf`;
                a.click();
                URL.revokeObjectURL(url);
              }}
              className="text-green-800 hover:text-green-400 text-[10px] border border-green-900/30 px-2 py-0.5 rounded"
            >
              + ADD CONTACT
            </button>
            </div>
          </div>
          </div>
          )}

          {/* LOADOUT TAB */}
          {cardTab === "loadout" && (
          <div className="px-3 pb-3 pt-3 space-y-3">
            <p className="text-xs text-green-600 tracking-widest mb-2">EQUIPMENT LOADOUT</p>
            {equipment.length > 0 ? (
              <div className="space-y-1">
                {equipment.map(item => {
                  const typeColors: Record<string, string> = { xbox: "text-green-400 border-green-500", controller: "text-blue-400 border-blue-500", tv: "text-amber-400 border-amber-500", other: "text-purple-400 border-purple-500" };
                  const typeLabels: Record<string, string> = { xbox: "XBOX", controller: "CTRL", tv: "TV", other: "OTHER" };
                  return (
                    <div key={item.id} className="flex items-center gap-2 py-1 border-b border-green-900/10">
                      <span className={`text-[10px] px-1.5 py-0.5 border rounded ${typeColors[item.item_type] || "text-green-400 border-green-500"}`}>
                        {typeLabels[item.item_type] || item.item_type}
                      </span>
                      <span className="text-green-300 text-sm">{item.model}</span>
                      {item.notes && <span className="text-green-700 text-xs">({item.notes})</span>}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-green-800 text-sm">No equipment registered yet.</p>
            )}

            {/* Controller settings */}
            <div className="border-t border-green-900/20 pt-2">
              <p className="text-xs text-green-600 tracking-widest mb-2">CONTROLLER CONFIG</p>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-green-700 text-[10px]">SENSITIVITY</p>
                  <p className="text-green-300 text-lg font-bold">{p.sensitivity}/10</p>
                </div>
                <div>
                  <p className="text-green-700 text-[10px]">Y-AXIS</p>
                  <p className="text-green-300 text-sm font-bold">{p.inverted_y ? "INVERTED" : "NORMAL"}</p>
                </div>
                <div>
                  <p className="text-green-700 text-[10px]">LAYOUT</p>
                  <p className="text-green-300 text-sm font-bold">{p.button_layout || "Default"}</p>
                </div>
              </div>
            </div>
          </div>
          )}
        </div>
      )}
    </div>
  );
}

function MapVotingSwipe({ maps, voting, playerId }: { maps: HaloMap[]; voting: ReturnType<typeof useMapVoting>; playerId: string | null }) {
  const [mode, setMode] = useState<"vote" | "results">("vote");
  const [gameFilter, setGameFilter] = useState("all");
  const [sizeFilter, setSizeFilter] = useState<string>("all");
  const [localVoted, setLocalVoted] = useState<Set<string>>(new Set());

  // Filter maps
  const filtered = maps.filter(m => {
    if (gameFilter !== "all" && m.game !== gameFilter) return false;
    if (sizeFilter !== "all" && m.map_size !== sizeFilter) return false;
    return true;
  });

  // Dedupe to unique map_name + game combos
  const uniqueMaps = filtered.filter((m, i, arr) =>
    arr.findIndex(x => x.map_name === m.map_name && x.game === m.game) === i
  );

  const votedMapIds = new Set([...voting.votes.map(v => v.map_id), ...localVoted]);
  const unvoted = uniqueMaps.filter(m => !votedMapIds.has(m.id));
  const currentMap = unvoted[0] || null;
  const progress = uniqueMaps.length - unvoted.length;

  const playerCountLabel = (size: string | null) => {
    if (size === "small") return "2-8 PLAYERS";
    if (size === "medium") return "4-12 PLAYERS";
    if (size === "large") return "8-16 PLAYERS";
    return null;
  };

  // A/B matchup: pick two random unmatched maps
  const [matchup, setMatchup] = useState<[HaloMap, HaloMap] | null>(null);
  const [matchupCount, setMatchupCount] = useState(0);
  const QUIZ_SIZE = 15;

  useEffect(() => {
    if (mode === "vote" && !matchup && uniqueMaps.length >= 2 && matchupCount < QUIZ_SIZE) {
      pickNewMatchup();
    }
  }, [mode, uniqueMaps.length]);

  function pickNewMatchup() {
    if (uniqueMaps.length < 2) return;
    const shuffled = [...uniqueMaps].sort(() => Math.random() - 0.5);
    // Try to match same size first
    const first = shuffled[0];
    const sameSize = shuffled.slice(1).find(m => m.map_size === first.map_size && m.id !== first.id);
    if (sameSize) {
      setMatchup([first, sameSize]);
    } else {
      // Fallback to any two
      setMatchup([shuffled[0], shuffled[1]]);
    }
  }

  const pickWinner = async (winner: HaloMap, loser: HaloMap) => {
    if (!playerId) return;
    // Save to DB
    await supabase.from("halo_map_matchups").insert({
      voter_id: playerId,
      winner_id: winner.id,
      loser_id: loser.id,
    });
    // Cast as rank vote too (winner gets rank 1, loser gets rank 5)
    voting.castVote(winner.id, 1);
    setLocalVoted(prev => new Set([...prev, winner.id]));
    setMatchupCount(c => c + 1);
    if (matchupCount + 1 >= QUIZ_SIZE) {
      setMatchup(null);
    } else {
      pickNewMatchup();
    }
  };

  // Sort results by tally
  const results = [...uniqueMaps].sort((a, b) => (voting.tally[b.id] || 0) - (voting.tally[a.id] || 0));
  const gameNames = [...new Set(maps.map(m => m.game))].sort();
  const gameModes = [...new Set(maps.map(m => m.game_mode))].sort();

  function MapCard({ map, onClick, label }: { map: HaloMap; onClick: () => void; label?: string }) {
    const score = voting.tally[map.id] || 0;
    return (
      <button onClick={onClick} className="kpi-card rounded-lg overflow-hidden text-left w-full hover:border-green-400 transition-all border border-green-900/30">
        {map.image_url ? (
          <div className="w-full h-32 bg-cover bg-center relative" style={{ backgroundImage: `url(${map.image_url})` }}>
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
            <div className="absolute bottom-2 left-3 right-3">
              <h3 className="text-lg font-bold text-white hud-glow">{map.map_name}</h3>
              <p className="text-green-400 text-[10px]">{map.game}</p>
            </div>
          </div>
        ) : (
          <div className="w-full h-20 bg-green-950/30 flex items-center justify-center relative">
            <h3 className="text-lg font-bold text-green-300">{map.map_name}</h3>
            <span className="absolute bottom-1 left-3 text-green-700 text-[10px]">{map.game}</span>
          </div>
        )}
        <div className="p-3">
          {map.description && (
            <p className="text-green-600 text-xs leading-relaxed mb-2">{map.description}</p>
          )}
          <div className="flex gap-1.5 flex-wrap">
            <span className="text-[10px] px-1.5 py-0.5 border border-green-700 text-green-500 rounded">{map.game_mode}</span>
            {map.map_size && (
              <span className="text-[10px] px-1.5 py-0.5 border border-amber-900/50 text-amber-500 rounded">{playerCountLabel(map.map_size)}</span>
            )}
            {score > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 border border-green-900/30 text-green-600 rounded">{score}pts</span>
            )}
          </div>
          {label && <p className="text-center text-green-500 text-xs mt-2 font-bold tracking-widest">{label}</p>}
        </div>
      </button>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header + mode toggle */}
      <div className="flex items-center justify-between">
        <h2 className="text-xs tracking-[0.3em] text-green-600 uppercase">// MAP VOTE</h2>
        <div className="flex gap-1">
          <button onClick={() => setMode("vote")}
            className={`px-3 py-1 border text-xs ${mode === "vote" ? "border-green-400 text-green-300" : "border-green-900/30 text-green-800"}`}>
            VOTE
          </button>
          <button onClick={() => setMode("results")}
            className={`px-3 py-1 border text-xs ${mode === "results" ? "border-green-400 text-green-300" : "border-green-900/30 text-green-800"}`}>
            RESULTS
          </button>
        </div>
      </div>

      {/* Size category filter */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {[
          { id: "all", label: "ALL MAPS" },
          { id: "small", label: "2v2 / 4v4" },
          { id: "medium", label: "4v4 / 8v8" },
          { id: "large", label: "BTB (8v8+)" },
        ].map(s => (
          <button key={s.id} onClick={() => { setSizeFilter(s.id); setMatchup(null); setMatchupCount(0); }}
            className={`px-3 py-1.5 border text-xs whitespace-nowrap rounded ${sizeFilter === s.id ? "border-green-400 text-green-300 bg-green-400/10" : "border-green-900/30 text-green-800"}`}>
            {s.label}
          </button>
        ))}
      </div>

      {/* Game filter */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        <button onClick={() => { setGameFilter("all"); setMatchup(null); setMatchupCount(0); }}
          className={`px-2 py-1 border text-[10px] whitespace-nowrap ${gameFilter === "all" ? "border-green-400 text-green-300" : "border-green-900/30 text-green-800"}`}>
          ALL
        </button>
        {gameNames.map(g => (
          <button key={g} onClick={() => { setGameFilter(g); setMatchup(null); setMatchupCount(0); }}
            className={`px-2 py-1 border text-[10px] whitespace-nowrap ${gameFilter === g ? "border-green-400 text-green-300" : "border-green-900/30 text-green-800"}`}>
            {g.replace("Halo ", "H").toUpperCase()}
          </button>
        ))}
      </div>

      {mode === "vote" && (
        <>
          {/* Progress */}
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1 bg-green-900/30 rounded overflow-hidden">
              <div className="h-full bg-green-400 transition-all" style={{ width: `${(matchupCount / QUIZ_SIZE) * 100}%` }} />
            </div>
            <span className="text-green-700 text-xs">{matchupCount}/{QUIZ_SIZE}</span>
          </div>

          {matchup && matchupCount < QUIZ_SIZE ? (
            <div>
              <p className="text-center text-green-500 text-sm mb-1">Which would you rather play?</p>
              {matchup[0].map_size && (
                <p className="text-center text-green-800 text-[10px] mb-3">
                  {matchup[0].map_size === "small" ? "Small map (2v2 / 4v4)" : matchup[0].map_size === "medium" ? "Medium map (4v4 / 8v8)" : "Big Team Battle (8v8+)"} matchup
                </p>
              )}
              <div className="grid grid-cols-2 gap-3">
                <MapCard map={matchup[0]} onClick={() => pickWinner(matchup[0], matchup[1])} label="PICK" />
                <MapCard map={matchup[1]} onClick={() => pickWinner(matchup[1], matchup[0])} label="PICK" />
              </div>
              <button onClick={() => pickNewMatchup()} className="w-full mt-3 py-2 border border-green-900/30 text-green-800 text-xs tracking-widest hover:text-green-500">
                SKIP BOTH
              </button>
            </div>
          ) : (
            <div className="kpi-card p-8 rounded text-center">
              <div className="text-2xl hud-glow text-green-300 mb-2">ROUND COMPLETE</div>
              <p className="text-green-700 mb-4">{matchupCount} matchups voted. Run another round to refine rankings.</p>
              <div className="flex gap-3 justify-center">
                <button onClick={() => { setMatchupCount(0); pickNewMatchup(); }}
                  className="px-6 py-2 border border-green-500 text-green-400 text-sm tracking-widest">
                  ANOTHER ROUND
                </button>
                <button onClick={() => setMode("results")}
                  className="px-6 py-2 border border-amber-500 text-amber-400 text-sm tracking-widest">
                  VIEW RESULTS
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {mode === "results" && (
        <div className="space-y-1">
          {results.map((map, i) => {
            const score = voting.tally[map.id] || 0;
            const voterCount = voting.allVotes.filter(v => v.map_id === map.id).length;
            if (score === 0 && voterCount === 0) return null;
            return (
              <div key={map.id} className="kpi-card p-2 rounded flex items-center gap-3">
                <span className={`text-lg font-bold w-6 text-center ${i < 3 ? "text-amber-400" : i < 10 ? "text-green-500" : "text-green-800"}`}>
                  {i + 1}
                </span>
                {map.image_url && (
                  <img src={map.image_url} alt={map.map_name} className="w-10 h-10 rounded object-cover" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-green-300 text-sm font-bold">{map.map_name}</span>
                    <span className="text-green-800 text-[10px]">{map.game}</span>
                  </div>
                  {map.description && <p className="text-green-700 text-[10px] truncate">{map.description}</p>}
                </div>
                <div className="text-right shrink-0">
                  <div className="text-green-300 font-bold text-sm">{score}pts</div>
                  <div className="text-green-800 text-[10px]">{voterCount} votes</div>
                </div>
              </div>
            );
          })}
          {results.filter(m => (voting.tally[m.id] || 0) > 0).length === 0 && (
            <p className="text-green-800 text-center py-8">No votes yet. Switch to VOTE tab to start.</p>
          )}
        </div>
      )}
    </div>
  );
}

function EquipmentManifest({ players }: { players: Player[] }) {
  const [allItems, setAllItems] = useState<(EquipmentItem & { player?: Player })[]>([]);

  useEffect(() => {
    supabase.from("halo_equipment").select("*").then(({ data }) => {
      if (data) {
        const withPlayers = (data as EquipmentItem[]).map(item => ({
          ...item,
          player: players.find(p => p.id === item.player_id),
        }));
        setAllItems(withPlayers);
      }
    });

    const channel = supabase
      .channel("equipment_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "halo_equipment" }, () => {
        supabase.from("halo_equipment").select("*").then(({ data }) => {
          if (data) {
            const withPlayers = (data as EquipmentItem[]).map(item => ({
              ...item,
              player: players.find(p => p.id === item.player_id),
            }));
            setAllItems(withPlayers);
          }
        });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [players]);

  const xboxes = allItems.filter(i => i.item_type === "xbox");
  const controllers = allItems.filter(i => i.item_type === "controller");
  const tvs = allItems.filter(i => i.item_type === "tv");
  const others = allItems.filter(i => i.item_type === "other");

  const typeColors: Record<string, string> = { xbox: "text-green-400", controller: "text-blue-400", tv: "text-amber-400", other: "text-purple-400" };

  return (
    <>
      <div className="grid grid-cols-4 gap-3 mb-4 text-center">
        <div>
          <div className="text-2xl font-bold hud-glow text-green-300">{xboxes.length}</div>
          <p className="text-xs text-green-700">XBOXES</p>
        </div>
        <div>
          <div className="text-2xl font-bold hud-glow text-blue-300">{controllers.length}</div>
          <p className="text-xs text-green-700">CONTROLLERS</p>
        </div>
        <div>
          <div className="text-2xl font-bold hud-glow text-amber-300">{tvs.length}</div>
          <p className="text-xs text-green-700">TVs</p>
        </div>
        <div>
          <div className="text-2xl font-bold hud-glow text-green-300">{others.length}</div>
          <p className="text-xs text-green-700">OTHER</p>
        </div>
      </div>

      {allItems.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-green-900/50 text-green-600 text-xs">
                <th className="text-left py-2 pr-2">SPARTAN</th>
                <th className="text-center py-2 px-1">XBOX</th>
                <th className="text-center py-2 px-1">CTRL</th>
                <th className="text-center py-2 px-1">TV</th>
                <th className="text-center py-2 px-1">OTHER</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                // Group by player
                const byPlayer: Record<string, { name: string; xbox: string[]; ctrl: string[]; tv: string[]; other: string[] }> = {};
                allItems.forEach(item => {
                  const pid = item.player_id;
                  const pname = item.player?.profile_confirmed ? shortName(item.player) : (item.player?.tentative_name || "?");
                  if (!byPlayer[pid]) byPlayer[pid] = { name: pname, xbox: [], ctrl: [], tv: [], other: [] };
                  const entry = item.model + (item.notes ? ` (${item.notes})` : "");
                  if (item.item_type === "xbox") byPlayer[pid].xbox.push(entry);
                  else if (item.item_type === "controller") byPlayer[pid].ctrl.push(entry);
                  else if (item.item_type === "tv") byPlayer[pid].tv.push(entry);
                  else byPlayer[pid].other.push(entry);
                });
                return Object.entries(byPlayer).map(([pid, data]) => (
                  <tr key={pid} className="player-row border-b border-green-900/20">
                    <td className="py-2 pr-2 text-green-300 font-bold text-xs">{data.name}</td>
                    <td className="py-2 px-1 text-center">
                      {data.xbox.length > 0 ? (
                        <div className="text-green-400 text-xs">{data.xbox.length}<span className="text-green-800 block text-[9px]">{data.xbox[0]}</span></div>
                      ) : <span className="text-green-900">-</span>}
                    </td>
                    <td className="py-2 px-1 text-center">
                      {data.ctrl.length > 0 ? (
                        <span className="text-blue-400 text-xs">{data.ctrl.length}</span>
                      ) : <span className="text-green-900">-</span>}
                    </td>
                    <td className="py-2 px-1 text-center">
                      {data.tv.length > 0 ? (
                        <div className="text-amber-400 text-xs">{data.tv.length}<span className="text-green-800 block text-[9px]">{data.tv[0]}</span></div>
                      ) : <span className="text-green-900">-</span>}
                    </td>
                    <td className="py-2 px-1 text-center">
                      {data.other.length > 0 ? (
                        <div className="text-purple-400 text-xs">{data.other.map((o, i) => <span key={i} className="block text-[9px]">{o}</span>)}</div>
                      ) : <span className="text-green-900">-</span>}
                    </td>
                  </tr>
                ));
              })()}
            </tbody>
            <tfoot>
              <tr className="border-t border-green-500/30 text-green-300 font-bold text-xs">
                <td className="py-2">TOTAL</td>
                <td className="py-2 text-center text-green-400">{xboxes.length}</td>
                <td className="py-2 text-center text-blue-400">{controllers.length}</td>
                <td className="py-2 text-center text-amber-400">{tvs.length}</td>
                <td className="py-2 text-center text-purple-400">{others.length}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        <p className="text-green-800 text-sm text-center py-4">No equipment logged yet. Add yours above.</p>
      )}
    </>
  );
}

function CortanaHelper({ screen, playerCount }: { screen: AppScreen; playerCount: number }) {
  const [dismissed, setDismissed] = useState(false);
  const [minimized, setMinimized] = useState(false);

  // Reset when screen changes
  useEffect(() => { setDismissed(false); setMinimized(false); }, [screen]);

  const tips: Record<string, { text: string; action?: string }> = {
    lobby: playerCount < 5
      ? { text: `${playerCount} Spartan${playerCount === 1 ? "" : "s"} confirmed. Share the link to get more players checked in.`, action: "Copy link" }
      : playerCount < 12
      ? { text: `${playerCount} Spartans and counting. Tap any player card to see their combat record or rate their skill.` }
      : { text: `${playerCount} Spartans confirmed. Looking like a full 8v8. Check the Equipment tab to make sure we have enough controllers.` },
    equipment: { text: "Add what you're bringing. Tap + XBOX, + CONTROLLER, or + TV. Everyone can see the full manifest below." },
    draft: { text: "Snake draft is coming. Captains will pick teams based on combat records and peer assessments. Get your ratings in." },
    voting: { text: "Vote on every map. PLAY if you want it in the rotation, SKIP if not. Results tab shows the current leaderboard." },
    games: { text: "Game tracker goes live on Friday. Upload post-game screenshots and I'll parse the scores automatically." },
  };

  const tip = tips[screen];
  if (!tip || dismissed) return null;

  if (minimized) {
    return (
      <button
        onClick={() => setMinimized(false)}
        className="fixed bottom-4 right-4 z-40 w-10 h-10 rounded-full bg-blue-900/80 border border-blue-500/30 flex items-center justify-center text-blue-400 text-lg hover:bg-blue-800/80 transition-all"
      >
        C
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 left-4 md:left-auto md:w-80 z-40">
      <div className="kpi-card rounded-lg p-3 border-blue-500/20 bg-black/95 backdrop-blur-sm">
        <div className="flex items-start gap-2">
          <div className="w-8 h-8 rounded-full bg-blue-900/50 border border-blue-500/30 flex items-center justify-center text-blue-400 text-xs font-bold shrink-0 mt-0.5">
            C
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <span className="text-blue-400 text-[10px] tracking-widest font-bold">CORTANA</span>
              <div className="flex gap-1">
                <button onClick={() => setMinimized(true)} className="text-green-900 hover:text-green-600 text-xs px-1">_</button>
                <button onClick={() => setDismissed(true)} className="text-green-900 hover:text-green-600 text-xs px-1">X</button>
              </div>
            </div>
            <p className="text-green-300 text-xs leading-relaxed">{tip.text}</p>
            {tip.action && screen === "lobby" && (
              <button
                onClick={() => {
                  navigator.clipboard.writeText("https://parker-halo-tracker.vercel.app");
                  setDismissed(true);
                }}
                className="mt-2 text-[10px] px-3 py-1 border border-blue-500/30 text-blue-400 rounded hover:bg-blue-500/10"
              >
                {tip.action}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function WIPScreen({ title, features, eta }: { title: string; features: string[]; eta: string }) {
  return (
    <div className="space-y-6">
      <div className="kpi-card p-6 rounded text-center border-amber-500/20">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/bg/grunt_wip.jpg" alt="Grunt with plasma grenades" className="w-40 h-auto mx-auto mb-4 rounded opacity-80" />
        <h2 className="text-2xl font-bold text-amber-400 hud-glow-amber mb-2">{title}</h2>
        <p className="text-amber-500/60 text-sm tracking-widest">UNDER CONSTRUCTION</p>
        <div className="w-16 h-0.5 bg-amber-500/30 mx-auto my-3" />
        <p className="text-red-400 text-xs font-bold">DANGER ZONE</p>
        <p className="text-green-600 text-xs mt-1">ETA: {eta}</p>
      </div>

      <div className="kpi-card p-4 rounded">
        <h3 className="text-xs tracking-[0.2em] text-green-600 uppercase mb-3">// INCOMING FEATURES</h3>
        <ul className="space-y-2">
          {features.map((f, i) => (
            <li key={i} className="flex items-start gap-2 text-sm">
              <span className="text-green-700 mt-0.5">+</span>
              <span className="text-green-400">{f}</span>
            </li>
          ))}
        </ul>
      </div>

      <p className="text-center text-amber-900 text-xs">
        This grunt has two live plasma grenades. Turn back, Spartan.
      </p>
    </div>
  );
}

function KPICard({ label, value, sub }: { label: string; value: number; sub: string }) {
  return (
    <div className="kpi-card p-4 rounded text-center">
      <p className="text-xs tracking-[0.2em] text-green-600 uppercase">{label}</p>
      <div className="text-3xl font-bold hud-glow text-green-300 my-1">{value}</div>
      <p className="text-xs text-green-700">{sub}</p>
    </div>
  );
}
