"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import SharexSDK from "sharex-sdk";
import plugin from "../config.json";
import { LETTERS, advanceCall, callResult, canCall, completedLines, hasBingo, turnForSequence } from "./bingo.mjs";

const PROTOCOL = "sharex-bingo/v2";

function shuffledCard() {
  const numbers = Array.from({ length: 25 }, (_, index) => index + 1);
  for (let index = numbers.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [numbers[index], numbers[swapIndex]] = [numbers[swapIndex], numbers[index]];
  }
  return numbers;
}

function emptyRoom() {
  return {
    role: null,
    code: "",
    card: [],
    peer: null,
    peerOnline: false,
    called: [],
    sequence: 0,
    active: false,
    pending: false,
    pendingNumber: null,
    hostBingo: false,
    guestBingo: false,
    result: null,
  };
}

function createCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from(crypto.getRandomValues(new Uint8Array(6)))
    .map((value) => alphabet[value % alphabet.length])
    .join("");
}

function resultLabel(result, role) {
  if (!result) return "";
  if (result.winner === "draw") return "Draw — you both called BINGO.";
  const won = result.winner === (role === "host" ? "X" : "O");
  return won ? "BINGO! You got there first." : "Your opponent called BINGO first.";
}

export default function Bingo() {
  const sdkRef = useRef(null);
  const roomRef = useRef(emptyRoom());
  const [room, setRoom] = useState(emptyRoom);
  const [connected, setConnected] = useState(false);
  const [status, setStatus] = useState("Pair your phone to start");
  const [joinCode, setJoinCode] = useState("");
  const [notice, setNotice] = useState("");
  const [copied, setCopied] = useState(false);

  const updateRoom = useCallback((next) => {
    roomRef.current = next;
    setRoom(next);
  }, []);

  const sendTo = useCallback((uuid, type, payload = {}) => {
    const sdk = sdkRef.current;
    if (!sdk?.connectionStatus || !uuid) return;
    sdk.sendMsg(uuid, JSON.stringify({ protocol: PROTOCOL, type, from: sdk.getMyUUID(), ...payload }));
  }, []);

  const broadcast = useCallback((type, payload = {}) => {
    const sdk = sdkRef.current;
    if (!sdk?.connectionStatus) return;
    sdk.getAllUsers((users) => {
      users.filter((user) => user.uuid !== sdk.getMyUUID())
        .forEach((user) => sendTo(user.uuid, type, payload));
    });
  }, [sendTo]);

  const sendProgress = useCallback((target, state = roomRef.current) => {
    sendTo(target, "progress", {
      code: state.code,
      sequence: state.sequence,
      bingo: hasBingo(state.card, state.called),
    });
  }, [sendTo]);

  const sendReady = useCallback((target, state) => {
    sendTo(target, "ready", {
      code: state.code,
      called: state.called,
      sequence: state.sequence,
      pending: state.pending,
      hostBingo: state.hostBingo,
      guestBingo: state.guestBingo,
      result: state.result,
    });
  }, [sendTo]);

  const commitNumber = useCallback((number, caller = "host", sequence) => {
    const current = roomRef.current;
    const next = advanceCall(current, number, caller, caller === "host" ? current.sequence : sequence);
    if (!next) return false;
    updateRoom(next);
    sendTo(current.peer, "called", {
      code: current.code,
      number,
      sequence: next.sequence,
      called: next.called,
      hostBingo: next.hostBingo,
    });
    return true;
  }, [sendTo, updateRoom]);

  const handleMessage = useCallback((raw) => {
    if (typeof raw !== "string") return;
    let packet;
    try { packet = JSON.parse(raw); } catch { return; }
    if (packet?.protocol !== PROTOCOL || typeof packet.type !== "string" || typeof packet.from !== "string") return;
    const sender = packet.from;
    const current = roomRef.current;

    if (packet.type === "seek" && current.role === "host" && packet.code === current.code) {
      if (current.peer && current.peer !== sender) {
        sendTo(sender, "declined", { code: current.code });
        return;
      }
      const next = { ...current, peer: sender, peerOnline: true, active: true };
      updateRoom(next);
      sendTo(sender, "accepted", {
        code: next.code,
        host: sdkRef.current?.getMyUUID(),
        called: next.called,
        sequence: next.sequence,
        pending: next.pending,
        hostBingo: hasBingo(next.card, next.called),
        result: next.result,
      });
      setNotice("");
      return;
    }

    if (packet.type === "accepted" && (current.role === "joining" || (current.role === "guest" && (!current.peer || current.peer === sender))) && packet.code === current.code) {
      const called = Array.isArray(packet.called) ? packet.called.filter((number) => Number.isInteger(number) && number >= 1 && number <= 25) : [];
      const next = {
        ...current,
        role: "guest",
        peer: packet.host || sender,
        peerOnline: true,
        called,
        sequence: Number.isInteger(packet.sequence) ? packet.sequence : called.length,
        active: true,
        pending: Boolean(packet.pending),
        pendingNumber: null,
        hostBingo: Boolean(packet.hostBingo),
        guestBingo: hasBingo(current.card, called),
        result: packet.result || null,
      };
      updateRoom(next);
      setStatus("Connected · your card is ready");
      setNotice("");
      if (next.pending && !next.result) sendProgress(next.peer, next);
      else if (current.pendingNumber && !called.includes(current.pendingNumber) && canCall(next, "guest")) {
        updateRoom({ ...next, pending: true, pendingNumber: current.pendingNumber });
        sendTo(next.peer, "call_request", { code: next.code, number: current.pendingNumber, sequence: next.sequence });
      }
      return;
    }

    if (packet.type === "declined" && current.role === "joining" && packet.code === current.code) {
      setNotice("That room already has another player or has closed.");
      return;
    }

    if (packet.type === "call_request" && current.role === "host" && sender === current.peer && packet.code === current.code) {
      if (!commitNumber(packet.number, "guest", packet.sequence)) sendReady(sender, current);
      return;
    }

    if (packet.type === "called" && current.role === "guest" && sender === current.peer && packet.code === current.code) {
      const called = Array.isArray(packet.called) ? packet.called.filter((number) => Number.isInteger(number) && number >= 1 && number <= 25) : null;
      if (!called || !Number.isInteger(packet.sequence) || packet.sequence < current.sequence) return;
      if (packet.sequence === current.sequence && current.called.includes(packet.number)) {
        sendProgress(current.peer, current);
        return;
      }
      if (packet.sequence !== current.sequence + 1 || !Number.isInteger(packet.number) || !called.includes(packet.number)) return;
      const next = {
        ...current,
        called,
        sequence: packet.sequence,
        pending: true,
        pendingNumber: null,
        hostBingo: Boolean(packet.hostBingo),
        guestBingo: hasBingo(current.card, called),
      };
      updateRoom(next);
      sendProgress(current.peer, next);
      return;
    }

    if (packet.type === "progress" && current.role === "host" && sender === current.peer && packet.code === current.code && packet.sequence === current.sequence && current.pending) {
      const guestBingo = Boolean(packet.bingo);
      const result = callResult(current.hostBingo, guestBingo);
      const next = { ...current, pending: false, guestBingo, result };
      updateRoom(next);
      if (result) {
        sendTo(current.peer, "result", { code: current.code, sequence: current.sequence, result });
      } else {
        sendReady(current.peer, next);
      }
      return;
    }

    if (packet.type === "ready" && current.role === "guest" && sender === current.peer && packet.code === current.code && Number.isInteger(packet.sequence) && packet.sequence >= current.sequence) {
      const called = Array.isArray(packet.called) ? packet.called : current.called;
      const next = {
        ...current,
        called,
        sequence: packet.sequence,
        pending: Boolean(packet.pending),
        pendingNumber: null,
        hostBingo: Boolean(packet.hostBingo),
        guestBingo: hasBingo(current.card, called),
        result: packet.result || null,
      };
      updateRoom(next);
      if (next.pending && !next.result) sendProgress(current.peer, next);
      return;
    }

    if (packet.type === "result" && current.role === "guest" && sender === current.peer && packet.code === current.code && packet.sequence === current.sequence) {
      updateRoom({ ...current, pending: false, pendingNumber: null, result: packet.result || null });
      return;
    }

    if (packet.type === "new_game" && current.role === "guest" && sender === current.peer && packet.code === current.code) {
      updateRoom({ ...current, card: shuffledCard(), called: [], sequence: 0, pending: false, pendingNumber: null, hostBingo: false, guestBingo: false, result: null, active: true });
      setNotice("A fresh card is ready. The host calls first.");
      return;
    }

    if (packet.type === "leave" && current.role === "host" && sender === current.peer && packet.code === current.code) {
      updateRoom({ ...emptyRoom(), role: "host", code: current.code, card: shuffledCard() });
      setNotice("Your opponent left. The room is open for another player.");
      return;
    }

    if (packet.type === "closed" && current.role === "guest" && sender === current.peer && packet.code === current.code) {
      updateRoom(emptyRoom());
      setStatus("Room closed");
      setNotice("The host closed this room.");
    }
  }, [commitNumber, sendProgress, sendReady, sendTo, updateRoom]);

  useEffect(() => {
    let sdk;
    let disposed = false;
    try {
      const development = process.env.NODE_ENV === "development";
      sdk = new SharexSDK({
        public_data: { name: "Bingo player" },
        preserve_session_id: true,
        ...(development
          ? {
              development: {
                package_name: plugin.package,
              },
            }
          : {}),
      });
      sdkRef.current = sdk;
      sdk.init((action, data) => {
        if (disposed) return;
        if (action === "open" || action === "reconnect") {
          setConnected(true);
          setStatus("Connected to ShareX");
          const current = roomRef.current;
          if (current.role === "guest" || current.role === "joining") broadcast("seek", { code: current.code });
        } else if (action === "close") {
          setConnected(false);
          setStatus("Connection lost · reconnecting");
          const current = roomRef.current;
          if (current.peer) updateRoom({ ...current, peerOnline: false });
        } else if (action === "error") {
          setConnected(false);
          setStatus("Could not connect · check ShareX sharing and pairing");
        } else if (action === "msg_arrive") {
          handleMessage(data);
        } else if (action === "user_left") {
          const current = roomRef.current;
          if (current.peer && data?.uuid === current.peer) updateRoom({ ...current, peerOnline: false });
        }
      });
    } catch (error) {
      setStatus(error.message || "Could not initialize ShareX");
    }
    return () => {
      disposed = true;
      sdk?.disconnect();
      if (sdkRef.current === sdk) sdkRef.current = null;
    };
  }, [broadcast, handleMessage, updateRoom]);

  const createRoom = () => {
    if (!sdkRef.current?.connectionStatus) return;
    updateRoom({ ...emptyRoom(), role: "host", code: createCode(), card: shuffledCard() });
    setNotice("");
    setStatus("Room open · share the code with another player");
  };

  const joinRoom = (event) => {
    event.preventDefault();
    const code = joinCode.replace(/[^a-z0-9]/gi, "").toUpperCase().slice(0, 6);
    if (code.length !== 6 || !sdkRef.current?.connectionStatus) return;
    updateRoom({ ...emptyRoom(), role: "joining", code, card: shuffledCard() });
    setStatus("Looking for room");
    setNotice("Asking connected players…");
    broadcast("seek", { code });
    window.setTimeout(() => {
      if (roomRef.current.role === "joining" && roomRef.current.code === code) {
        updateRoom(emptyRoom());
        setStatus("Connected to ShareX");
        setNotice("No open room found with that code. Check it and try again.");
      }
    }, 5500);
  };

  const callNumber = (number) => {
    const current = roomRef.current;
    if (!canCall(current, current.role) || current.called.includes(number)) return;
    if (current.role === "host") {
      commitNumber(number);
    } else if (current.role === "guest") {
      const next = { ...current, pending: true, pendingNumber: number };
      updateRoom(next);
      sendTo(current.peer, "call_request", { code: current.code, number, sequence: current.sequence });
    }
  };

  const leaveRoom = () => {
    const current = roomRef.current;
    if (current.role === "guest" || current.role === "joining") sendTo(current.peer, "leave", { code: current.code });
    if (current.role === "host" && current.peer) sendTo(current.peer, "closed", { code: current.code });
    updateRoom(emptyRoom());
    setNotice("");
    setStatus(connected ? "Connected to ShareX" : "Pair your phone to start");
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(room.code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setNotice(`Room code: ${room.code}`);
    }
  };

  const role = room.role;
  const ownLines = completedLines(room.card, room.called);
  const crossedLetters = Math.min(ownLines.length, LETTERS.length);
  const completeCells = new Set(ownLines.flat());
  const calledSet = new Set(room.called);
  const isMyBingo = crossedLetters === LETTERS.length;
  const isMyTurn = turnForSequence(room.sequence) === role;
  const canPickNumber = canCall(room, role);
  const resultText = resultLabel(room.result, role);

  return (
    <main className="page-shell">
      <header className="topbar">
        <a className="brand" href="#home" aria-label="Bingo home" onClick={(event) => { event.preventDefault(); if (role) leaveRoom(); }}>
          <span className="brand-mark"><i /><i /><i /><i /></span>
          <span>good call<span className="brand-period">.</span></span>
        </a>
        <div className="connection"><span className={`connection-dot ${connected ? "is-online" : ""}`} />{status}</div>
      </header>

      <div className="layout" id="home">
        <section className="game-column">
          <div className="title-row">
            <div>
              <p className="eyebrow">SHAREX · TWO PLAYER</p>
              <h1>Bingo<span className="title-period">.</span></h1>
            </div>
            {role && <button className="text-button" onClick={leaveRoom}>Leave room <span aria-hidden="true">↗</span></button>}
          </div>

          {!role ? (
            <div className="lobby">
              <p className="lead">One card each. Every call counts for both.</p>
              <div className="lobby-actions">
                <button className="primary-button" onClick={createRoom} disabled={!connected}>
                  <span className="button-symbol">＋</span>
                  <span>Create a room<small>Deal your private card</small></span>
                  <span className="button-arrow">↗</span>
                </button>
                <form className="join-form" onSubmit={joinRoom}>
                  <label htmlFor="room-code">Have a room code?</label>
                  <div className="join-input-row">
                    <input id="room-code" value={joinCode} onChange={(event) => setJoinCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))} placeholder="ENTER CODE" maxLength={6} autoComplete="off" />
                    <button type="submit" disabled={!connected || joinCode.length !== 6}>Join <span aria-hidden="true">→</span></button>
                  </div>
                </form>
              </div>
              {notice && <p className="notice" role="status">{notice}</p>}
              <p className="lobby-footnote">Numbers 1–25 are shuffled differently for each player. Calls are shared live through ShareX.</p>
            </div>
          ) : role === "joining" ? (
            <div className="waiting-panel">
              <span className="spinner" />
              <p className="eyebrow">ROOM {room.code}</p>
              <h2>Finding your opponent</h2>
              <p>Preparing your own private card…</p>
              {notice && <p className="notice" role="status">{notice}</p>}
              <button className="text-button" onClick={leaveRoom}>Cancel</button>
            </div>
          ) : (
            <div className="match-area">
              <div className="match-meta">
                <div className="players">
                  <div className={`player ${turnForSequence(room.sequence) === "host" ? "active-player" : ""}`}>
                    <span className="player-token token-x">X</span>
                    <span><strong>{role === "host" ? "You" : "Host"}</strong><small>Player one</small></span>
                  </div>
                  <span className="versus">VS</span>
                  <div className={`player ${turnForSequence(room.sequence) === "guest" ? "active-player" : ""}`}>
                    <span className="player-token token-o">O</span>
                    <span><strong>{role === "guest" ? "You" : room.peerOnline ? "Opponent" : "Waiting"}</strong><small>Player two</small></span>
                  </div>
                </div>
                <div className="room-badge"><span className={`connection-dot ${room.peerOnline ? "is-online" : ""}`} />{room.peerOnline ? room.active ? "LIVE GAME" : "CONNECTED" : "WAITING FOR PLAYER"}</div>
              </div>

              {role === "host" && !room.peerOnline && (
                <div className="invite-strip">
                  <div><small>INVITE WITH CODE</small><strong>{room.code}</strong></div>
                  <button onClick={copyCode}>{copied ? "Copied ✓" : "Copy code ↗"}</button>
                </div>
              )}

              <div className="board-wrap">
                <div className="board-heading">
                  <div className="turn-label" aria-live="polite">
                    <span className={`turn-token ${room.result ? room.result.winner === "draw" ? "token-draw" : room.result.winner === (role === "host" ? "X" : "O") ? "token-x" : "token-o" : isMyBingo ? "token-x" : "token-muted"}`}>
                      {room.result ? room.result.winner === "draw" ? "=" : room.result.winner : isMyBingo ? "✓" : "·"}
                    </span>
                    <span>{room.result ? resultText : !room.peerOnline ? room.active ? "Opponent disconnected · waiting to reconnect." : "Waiting for your opponent to join." : isMyBingo ? "BINGO! Waiting for the call to settle…" : room.pending ? room.pendingNumber ? `Calling ${room.pendingNumber}…` : "Checking both cards…" : isMyTurn ? "Your turn · tap a number to call it." : "Opponent’s turn · waiting for a number."}</span>
                  </div>
                  <div className="card-private"><span className="privacy-dot" />YOUR CARD ONLY</div>
                </div>
                <div className="bingo-progress" aria-label={`Your Bingo progress: ${crossedLetters} of 5 letters crossed`}>
                  {LETTERS.map((letter, index) => (
                    <span key={letter} className={`bingo-letter ${index < crossedLetters ? "is-crossed" : ""}`} aria-label={`${letter}${index < crossedLetters ? ", crossed" : ""}`}>{letter}</span>
                  ))}
                </div>
                <div className="bingo-board" role="grid" aria-label="Your private Bingo card">
                  {room.card.map((number, index) => {
                    const marked = calledSet.has(number);
                    return (
                      <button
                        key={number}
                        className={`bingo-cell ${marked ? "is-marked" : ""} ${completeCells.has(index) ? "line-complete" : ""}`}
                        onClick={() => callNumber(number)}
                        disabled={!canPickNumber || marked}
                        role="gridcell"
                        aria-label={`Row ${Math.floor(index / 5) + 1}, column ${index % 5 + 1}, ${number}${marked ? ", called" : ""}`}
                      >
                        <span>{number}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="board-foot"><span>{room.called.length} / 25 NUMBERS CALLED</span><span>{crossedLetters} / 5 BINGO LETTERS</span></div>
              </div>
              {room.result && role === "host" && <button className="rematch-button" disabled={!connected || !room.peerOnline} onClick={() => { const next = { ...roomRef.current, card: shuffledCard(), called: [], sequence: 0, pending: false, pendingNumber: null, hostBingo: false, guestBingo: false, result: null, active: true }; updateRoom(next); sendTo(next.peer, "new_game", { code: next.code }); setNotice("New cards dealt. You call first."); }}>Deal new cards <span>↻</span></button>}
              {notice && <p className="notice" role="status">{notice}</p>}
            </div>
          )}
        </section>

        <aside className="side-column">
          <div className="side-heading"><span>HOW TO PLAY</span><span className="side-number">01 — 03</span></div>
          <ol className="steps">
            <li><span>01</span><p><strong>Make a room</strong>Share the code with one other player.</p></li>
            <li><span>02</span><p><strong>Take turns</strong>The host calls first, then alternate. Each number marks on both cards.</p></li>
            <li><span>03</span><p><strong>Cross off BINGO</strong>Each full row, column, or diagonal crosses one letter. Five lines win; both on the same call means a draw.</p></li>
          </ol>
          <div className="side-note"><span className="note-icon">✳</span><p>Your card stays private. Only called numbers are shared.</p></div>
          <div className="side-footer"><span>LIVE THROUGH SHAREX</span><span className="live-indicator"><i /> {connected ? "CONNECTED" : "OFFLINE"}</span></div>
        </aside>
      </div>
      <footer className="page-footer"><span>Same calls. Two different cards.</span><span>{plugin.package} · {plugin.version}</span></footer>
    </main>
  );
}
