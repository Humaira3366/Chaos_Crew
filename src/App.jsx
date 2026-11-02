import React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const EMOJIS = ["🔥", "👻", "⚡", "🌈"];
const MISSIONS = [
  "Pick the emoji you think at least one crewmate will choose.",
  "Try to be the only player who chooses your emoji.",
  "Read the room: choose the emoji you think will be most popular.",
  "Go rogue: choose an emoji nobody else expects."
];
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;
const makeId = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);
const makeCode = () => Math.random().toString(36).slice(2, 8).toUpperCase();

function initialGame(code, hostId, hostName) {
  return {
    code, hostId, status: "lobby", round: 1, maxRounds: 5, deadline: null,
    players: [{ id: hostId, name: hostName, score: 0, connected: true }],
    choices: {}, revealed: false, roundResults: [], winnerId: null
  };
}

export default function App() {
  const [screen, setScreen] = useState("home");
  const [name, setName] = useState(localStorage.getItem("cc_name") || "");
  const [joinCode, setJoinCode] = useState("");
  const [game, setGame] = useState(null);
  // Keep player identity per browser tab. localStorage is shared by every tab
  // on localhost, which made two test tabs look like the same player.
  const [myId] = useState(() => sessionStorage.getItem("cc_player_id") || makeId());
  const [myMission, setMyMission] = useState("");
  const [selected, setSelected] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [remaining, setRemaining] = useState(20);
  const channelRef = useRef(null);
  const gameRef = useRef(null);
  const nameRef = useRef(name);
  const myIdRef = useRef(myId);
  const hostTimerRef = useRef(null);

  useEffect(() => { sessionStorage.setItem("cc_player_id", myId); }, [myId]);
  useEffect(() => { nameRef.current = name; localStorage.setItem("cc_name", name); }, [name]);
  useEffect(() => { gameRef.current = game; }, [game]);
  useEffect(() => {
    if (!game) return;
    if (game.status === "playing") setScreen("game");
    else if (game.status === "finished") setScreen("results");
    else setScreen("lobby");
  }, [game?.status]);

  const me = useMemo(() => game?.players?.find(p => p.id === myId), [game, myId]);
  const isHost = !!game && game.hostId === myId;

  function send(event, payload) {
    const channel = channelRef.current;
    if (channel) channel.send({ type: "broadcast", event, payload });
  }

  function applyGame(next) {
    gameRef.current = next;
    setGame(next);
  }

  function connectRoom(code, onReady) {
    if (!supabase) {
      setNotice("Add your Supabase URL and anon key to .env before starting multiplayer.");
      return;
    }
    if (channelRef.current) supabase.removeChannel(channelRef.current);
    const channel = supabase.channel(`chaos-crew-${code}`, {
      config: { broadcast: { self: false }, presence: { key: myId } }
    });
    channel
      .on("broadcast", { event: "game_state" }, ({ payload }) => {
        if (!payload?.game) return;
        applyGame(payload.game);
        if (payload.missions?.[myId]) setMyMission(payload.missions[myId]);
        if (payload.game.status === "playing" && payload.game.deadline) {
          setRemaining(Math.max(0, Math.ceil((payload.game.deadline - Date.now()) / 1000)));
        }
      })
      .on("broadcast", { event: "join_request" }, ({ payload }) => {
        if (gameRef.current?.hostId === myId) handleHostAction({ ...payload, type: "join" });
      })
      .on("broadcast", { event: "action" }, ({ payload }) => {
        if (gameRef.current?.hostId !== myId) return;
        handleHostAction(payload);
      })
      .on("broadcast", { event: "request_state" }, ({ payload }) => {
        if (gameRef.current?.hostId === myId && gameRef.current) {
          send("game_state", { game: gameRef.current, missions: missionMapRef.current });
        }
      })
      .on("presence", { event: "sync" }, () => {
        const presence = channel.presenceState();
        const people = Object.values(presence).flat().map(p => ({ id: p.id, name: p.name }));
        const current = gameRef.current;
        if (!current || current.hostId !== myId) return;
        const merged = [...current.players];
        for (const person of people) {
          const found = merged.find(p => p.id === person.id);
          if (found) { found.connected = true; if (person.name) found.name = person.name; }
          else if (merged.length < 6) merged.push({ id: person.id, name: person.name || "Crewmate", score: 0, connected: true });
        }
        for (const player of merged) {
          if (!people.some(p => p.id === player.id)) player.connected = player.id === myId;
        }
        const next = { ...current, players: merged };
        applyGame(next);
        send("game_state", { game: next, missions: missionMapRef.current });
      })
      .subscribe(async status => {
        if (status === "SUBSCRIBED") {
          await channel.track({ id: myId, name: nameRef.current || "Crewmate" });
          channelRef.current = channel;
          if (onReady) onReady(channel);
          send("request_state", { id: myId });
        }
      });
    channelRef.current = channel;
  }

  const missionMapRef = useRef({});
  function publish(next, missions = missionMapRef.current) {
    applyGame(next);
    send("game_state", { game: next, missions });
  }

  function createRoom() {
    const cleanName = name.trim();
    if (!cleanName) { setNotice("Enter your name first."); return; }
    if (!supabase) { setNotice("Setup needed: add Supabase credentials in your .env file first."); return; }
    setBusy(true);
    const code = makeCode();
    const next = initialGame(code, myId, cleanName.slice(0, 18));
    missionMapRef.current = {};
    applyGame(next);
    setScreen("lobby");
    connectRoom(code, () => {
      publish(next);
      setBusy(false);
    });
  }

  function joinRoom() {
    const cleanName = name.trim();
    const code = joinCode.trim().toUpperCase();
    if (!cleanName) { setNotice("Enter your name first."); return; }
    if (code.length < 4) { setNotice("Enter the room code your host shared."); return; }
    if (!supabase) { setNotice("Setup needed: add Supabase credentials in your .env file first."); return; }
    setBusy(true);
    setGame(null);
    setScreen("lobby");
    connectRoom(code, () => {
      setTimeout(() => {
        send("join_request", { id: myId, name: cleanName.slice(0, 18) });
        send("request_state", { id: myId });
        setBusy(false);
      }, 400);
    });
    // Host handles this as an action as well as a join request for compatibility.
    setTimeout(() => send("action", { type: "join", id: myId, name: cleanName.slice(0, 18) }), 700);
  }

  function handleHostAction(action) {
    const current = gameRef.current;
    if (!current || !action) return;
    if (action.type === "join" || action.type === "join_request") {
      if (current.players.some(p => p.id === action.id)) return;
      if (current.players.length >= 6 || current.status !== "lobby") return;
      const next = { ...current, players: [...current.players, { id: action.id, name: action.name || "Crewmate", score: 0, connected: true }] };
      publish(next);
      return;
    }
    if (action.type === "choice") {
      if (current.status !== "playing" || current.revealed || !current.players.some(p => p.id === action.id)) return;
      const choices = { ...current.choices, [action.id]: action.emoji };
      const allSubmitted = current.players.every(p => choices[p.id]);
      const next = { ...current, choices, ...(allSubmitted ? {} : {}) };
      publish(next);
      if (allSubmitted) revealRound(next);
      return;
    }
    if (action.type === "start") {
      if (current.hostId !== action.id || current.players.length < 2) return;
      const missions = {};
      current.players.forEach((p, i) => missions[p.id] = MISSIONS[(current.round + i - 1) % MISSIONS.length]);
      missionMapRef.current = missions;
      const next = { ...current, status: "playing", deadline: Date.now() + 20000, choices: {}, revealed: false };
      publish(next, missions);
      return;
    }
    if (action.type === "next") {
      if (current.hostId !== action.id || !current.revealed) return;
      if (current.round >= current.maxRounds) {
        const winner = [...current.players].sort((a,b) => b.score - a.score)[0];
        publish({ ...current, status: "finished", winnerId: winner?.id || null });
      } else {
        const round = current.round + 1;
        const missions = {};
        current.players.forEach((p, i) => missions[p.id] = MISSIONS[(round + i - 1) % MISSIONS.length]);
        missionMapRef.current = missions;
        publish({ ...current, round, status: "playing", deadline: Date.now() + 20000, choices: {}, revealed: false }, missions);
      }
    }
    if (action.type === "rematch" && current.status === "finished") {
      const next = { ...initialGame(current.code, current.hostId, current.players.find(p => p.id === current.hostId)?.name || "Host"), players: current.players.map(p => ({ ...p, score: 0, connected: true })) };
      missionMapRef.current = {};
      publish(next);
    }
  }

  function submitChoice(emoji) {
    if (!game || game.status !== "playing" || game.revealed || game.choices?.[myId]) return;
    setSelected(emoji);
    send("action", { type: "choice", id: myId, emoji });
    // If host is this player, the host won't receive its own broadcast.
    if (isHost) handleHostAction({ type: "choice", id: myId, emoji });
  }

  function revealRound(current) {
    if (!current || current.revealed) return;
    const counts = {};
    Object.values(current.choices).forEach(e => counts[e] = (counts[e] || 0) + 1);
    const scores = {};
    current.players.forEach(p => {
      const choice = current.choices[p.id];
      if (!choice) { scores[p.id] = 0; return; }
      if (counts[choice] === 1) scores[p.id] = 3;
      else scores[p.id] = 2;
    });
    const players = current.players.map(p => ({ ...p, score: p.score + (scores[p.id] || 0) }));
    const results = players.map(p => ({ id: p.id, name: p.name, emoji: current.choices[p.id] || "⌛", points: scores[p.id] || 0 }));
    const next = { ...current, players, revealed: true, roundResults: results, deadline: null };
    publish(next);
  }

  useEffect(() => {
    if (!game || game.status !== "playing" || game.revealed || !game.deadline) return;
    const tick = () => {
      const left = Math.max(0, Math.ceil((gameRef.current?.deadline - Date.now()) / 1000));
      setRemaining(left);
      if (left <= 0 && gameRef.current?.hostId === myId && !gameRef.current.revealed) {
        revealRound(gameRef.current);
      }
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [game?.status, game?.deadline, game?.revealed, myId]);

  useEffect(() => () => {
    if (supabase && channelRef.current) supabase.removeChannel(channelRef.current);
    if (hostTimerRef.current) clearInterval(hostTimerRef.current);
  }, []);

  function leaveGame() {
    if (supabase && channelRef.current) supabase.removeChannel(channelRef.current);
    channelRef.current = null;
    setGame(null); setScreen("home"); setNotice(""); setMyMission(""); setSelected("");
  }

  function startGame() {
    if (!isHost) return;
    if (game.players.length < 2) { setNotice("Invite at least one friend before starting."); return; }
    handleHostAction({ type: "start", id: myId });
  }

  function nextRound() { handleHostAction({ type: "next", id: myId }); }

  if (!supabase) {
    // Keep the landing page visible and explain configuration rather than failing silently.
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <button className="brand" onClick={leaveGame} aria-label="Go home"><span className="brand-mark">✦</span> CHAOS <b>CREW</b></button>
        <div className="top-pill"><span className="live-dot" /> REAL-TIME PARTY GAME</div>
      </header>

      {screen === "home" && (
        <section className="hero">
          <div className="eyebrow">✦ YOUR FRIEND GROUP, UNHINGED</div>
          <h1>TRUST NOBODY.<br/><span>MATCH SOMEBODY.</span></h1>
          <p className="hero-copy">Tiny choices. Big chaos. Join your crew, read the room, and find out who really knows how everyone thinks.</p>
          <div className="emoji-orbit" aria-hidden="true"><span>🔥</span><span>👻</span><span>⚡</span><span>🌈</span><i>✦</i></div>
          <div className="panel setup-panel">
            <label htmlFor="player-name">YOUR PLAYER NAME</label>
            <input id="player-name" maxLength="18" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. chaos gremlin" />
            <div className="home-actions">
              <button className="button primary" onClick={createRoom} disabled={busy}>{busy ? "CREATING..." : "＋ CREATE A ROOM"}</button>
              <div className="join-row"><input aria-label="Room code" maxLength="8" value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())} placeholder="ROOM CODE" /><button className="button secondary" onClick={joinRoom} disabled={busy}>JOIN ↗</button></div>
            </div>
            {notice && <p className="notice">{notice}</p>}
            {!supabase && <p className="setup-hint">Setup needed: connect a Supabase project using the README steps.</p>}
          </div>
          <div className="feature-row"><span>⚡ 2–6 PLAYERS</span><span>◷ 20-SECOND ROUNDS</span><span>✦ 5 ROUNDS TO GLORY</span></div>
        </section>
      )}

      {screen === "lobby" && (
        <section className="game-layout">
          <div className="section-head"><div><div className="eyebrow">CREW LOBBY</div><h2>Get your people in here.</h2></div><button className="text-button" onClick={leaveGame}>← Leave</button></div>
          <div className="panel lobby-panel">
            <div className="room-code-label">YOUR ROOM CODE</div>
            <div className="room-code">{game?.code || joinCode.toUpperCase() || "......"}</div>
            <p className="muted">Send this code to your friends. They can join from any device.</p>
            <button className="button secondary" onClick={() => navigator.clipboard?.writeText(game?.code || joinCode.toUpperCase())}>COPY ROOM CODE</button>
            <div className="divider" />
            <div className="players-title">CREW MEMBERS <span>{game?.players?.length || 0}/6</span></div>
            <div className="player-list">
              {(game?.players || []).map((p, i) => <div className="player-row" key={p.id}><div className={`avatar avatar-${i % 4}`}>{["✦","☻","⚡","👾"][i % 4]}</div><div className="player-name">{p.name} {p.id === myId && <small>(YOU)</small>} {p.id === game?.hostId && <small className="host-tag">HOST</small>}</div><span className="connected">{p.connected === false ? "OFFLINE" : "● READY"}</span></div>)}
              {!game && <p className="muted">Connecting to room…</p>}
            </div>
            {isHost ? <button className="button primary full" onClick={startGame}>START THE CHAOS ↗</button> : <p className="waiting">⏳ Waiting for the host to start the game…</p>}
            {notice && <p className="notice">{notice}</p>}
          </div>
        </section>
      )}

      {screen === "game" && game && (
        <section className="game-layout">
          <div className="section-head"><div><div className="eyebrow">ROUND {game.round} / {game.maxRounds}</div><h2>Make your move.</h2></div><div className="timer">{game.revealed ? "REVEALED" : `00:${String(remaining).padStart(2,"0")}`}</div></div>
          <div className="mission-card"><span className="mission-icon">✦</span><div><div className="room-code-label">YOUR SECRET MISSION</div><p>{myMission || "Pick your emoji carefully. Can you read the room?"}</p></div></div>
          <div className="emoji-grid">{EMOJIS.map(emoji => <button key={emoji} className={`emoji-card ${selected === emoji ? "selected" : ""}`} disabled={game.revealed || !!game.choices?.[myId]} onClick={() => submitChoice(emoji)}><span>{emoji}</span><small>{selected === emoji || game.choices?.[myId] === emoji ? "LOCKED IN" : "CHOOSE ME"}</small></button>)}</div>
          <p className="muted center">{game.revealed ? "The choices are in. Check the round results below." : game.choices?.[myId] ? "Choice locked. Waiting for the crew…" : "Choose one emoji. Your choice stays secret until the reveal."}</p>
          {game.revealed && <div className="panel results-panel"><div className="players-title">ROUND RESULTS <span>+ POINTS</span></div>{(game.roundResults || []).map(r => <div className="result-row" key={r.id}><span className="result-emoji">{r.emoji}</span><span className="player-name">{r.name}</span><b>+{r.points}</b></div>)}{isHost && <button className="button primary full" onClick={nextRound}>{game.round >= game.maxRounds ? "SHOW FINAL RESULTS ↗" : "NEXT ROUND ↗"}</button>}</div>}
          <div className="panel score-panel"><div className="players-title">LIVE SCOREBOARD</div>{[...(game.players || [])].sort((a,b) => b.score - a.score).map((p, i) => <div className="player-row" key={p.id}><div className={`rank rank-${i}`}>{i + 1}</div><div className="player-name">{p.name} {p.id === myId && <small>(YOU)</small>}</div><strong>{p.score}</strong></div>)}</div>
        </section>
      )}

      {screen === "results" && game && (
        <section className="game-layout"><div className="eyebrow">GAME COMPLETE</div><h1 className="final-title">THE CHAOS<br/><span>CHAMPION.</span></h1><div className="panel results-panel"><div className="winner-crown">👑</div><h2>{game.players.find(p => p.id === game.winnerId)?.name || "Your crew"}</h2><p className="muted">Survived five rounds of absolute chaos.</p>{[...game.players].sort((a,b)=>b.score-a.score).map((p,i)=><div className="player-row" key={p.id}><div className={`rank rank-${i}`}>{i+1}</div><div className="player-name">{p.name}</div><strong>{p.score} pts</strong></div>)}{isHost && <button className="button primary full" onClick={() => handleHostAction({type:"rematch"})}>RUN IT BACK ↗</button>}</div></section>
      )}

      <footer><span>CHAOS CREW © 2026</span><span>GOOD FRIENDS. QUESTIONABLE CHOICES.</span></footer>
    </main>
  );
}
