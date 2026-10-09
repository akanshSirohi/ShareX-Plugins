"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import SharexSDK from "sharex-sdk";
import plugin from "../config.json";

const PROTOCOL = "sharex-ttt/v1";
const EMPTY_BOARD = () => Array(9).fill(null);
const emptyRoom = () => ({
  role: null,
  code: "",
  peer: null,
  peerOnline: false,
  board: EMPTY_BOARD(),
  turn: "X",
  result: null,
});

function findResult(board) {
  const lines = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6],
  ];
  for (const [a, b, c] of lines) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a];
    }
  }
  return board.every(Boolean) ? "draw" : null;
}

function makeCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from(crypto.getRandomValues(new Uint8Array(6)))
    .map((value) => alphabet[value % alphabet.length])
    .join("");
}

export default function TicTacToe() {
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
      users
        .filter((user) => user.uuid !== sdk.getMyUUID())
        .forEach((user) => sendTo(user.uuid, type, payload));
    });
  }, [sendTo]);

  const sendState = useCallback((target = roomRef.current.peer) => {
    const current = roomRef.current;
    if (current.role !== "host" || !target) return;
    sendTo(target, "state", {
      code: current.code,
      board: current.board,
      turn: current.turn,
      result: current.result,
    });
  }, [sendTo]);

  const applyMove = useCallback((index, player) => {
    const current = roomRef.current;
    if (!current.role || current.result || current.turn !== player || current.board[index]) return null;
    const board = [...current.board];
    board[index] = player;
    const result = findResult(board);
    const next = { ...current, board, result, turn: player === "X" ? "O" : "X" };
    updateRoom(next);
    return next;
  }, [updateRoom]);

  const handleMessage = useCallback((raw) => {
    if (typeof raw !== "string") return;
    let packet;
    try { packet = JSON.parse(raw); } catch { return; }
    if (packet?.protocol !== PROTOCOL || typeof packet.type !== "string") return;
    const sdk = sdkRef.current;
    if (!sdk) return;
    const messageSender = packet.from;
    if (typeof messageSender !== "string" || !messageSender) return;
    const current = roomRef.current;

    if (packet.type === "seek" && current.role === "host" && packet.code === current.code) {
      const player = current.peer;
      if (!player || player === messageSender) {
        const next = { ...current, peer: messageSender, peerOnline: true };
        updateRoom(next);
        sendTo(messageSender, "accepted", {
          code: current.code,
          host: sdk.getMyUUID(),
          board: next.board,
          turn: next.turn,
          result: next.result,
        });
        setNotice("");
      } else {
        sendTo(messageSender, "declined", { code: packet.code });
      }
      return;
    }

    if (packet.type === "accepted" && current.role === "joining" && packet.code === current.code) {
      updateRoom({
        ...current,
        role: "guest",
        peer: packet.host || messageSender,
        peerOnline: true,
        board: Array.isArray(packet.board) && packet.board.length === 9 ? packet.board : EMPTY_BOARD(),
        turn: packet.turn || "X",
        result: packet.result || null,
      });
      setStatus("Connected · you’re playing O");
      setNotice("");
      return;
    }

    if (packet.type === "declined" && current.role === "joining" && packet.code === current.code) {
      setNotice("That room already has two players or has closed.");
      return;
    }

    if (packet.type === "state" && current.role === "guest" && packet.code === current.code && messageSender === current.peer) {
      if (!Array.isArray(packet.board) || packet.board.length !== 9) return;
      updateRoom({ ...current, board: packet.board, turn: packet.turn, result: packet.result || null, peerOnline: true });
      return;
    }

    if (packet.type === "move" && current.role === "host" && messageSender === current.peer && packet.code === current.code) {
      if (!Number.isInteger(packet.index) || packet.index < 0 || packet.index > 8) return;
      const next = applyMove(packet.index, "O");
      if (next) sendState(current.peer);
      return;
    }

    if (packet.type === "leave" && current.role === "host" && messageSender === current.peer) {
      updateRoom({ ...current, peer: null, peerOnline: false, board: EMPTY_BOARD(), turn: "X", result: null });
      setNotice("Your opponent left. The room is open for another player.");
      return;
    }

    if (packet.type === "closed" && current.role === "guest" && messageSender === current.peer) {
      updateRoom(emptyRoom());
      setNotice("The host closed this room.");
      setStatus("Room closed");
    }
  }, [applyMove, sendState, sendTo, updateRoom]);

  useEffect(() => {
    let sdk;
    let disposed = false;
    try {
      const development = process.env.NODE_ENV === "development";
      sdk = new SharexSDK({
        public_data: { name: "Tic Tac Toe player" },
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
          if (current.role === "guest" || current.role === "joining") {
            broadcast("seek", { code: current.code });
          }
        } else if (action === "close") {
          setConnected(false);
          setStatus("Connection lost · reconnecting");
          const current = roomRef.current;
          if (current.role === "host" && current.peer) updateRoom({ ...current, peerOnline: false });
          if (current.role === "guest") updateRoom({ ...current, peerOnline: false });
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
    const next = { ...emptyRoom(), role: "host", code: makeCode() };
    updateRoom(next);
    setNotice("");
    setStatus("Room open · share the code with your opponent");
  };

  const joinRoom = (event) => {
    event.preventDefault();
    const code = joinCode.replace(/[^a-z0-9]/gi, "").toUpperCase().slice(0, 6);
    if (code.length !== 6 || !sdkRef.current?.connectionStatus) return;
    updateRoom({ ...emptyRoom(), role: "joining", code });
    setNotice("Looking for that room…");
    setStatus("Joining room");
    broadcast("seek", { code });
    window.setTimeout(() => {
      if (roomRef.current.role === "joining" && roomRef.current.code === code) {
        setNotice("No open room found with that code. Check it and try again.");
        updateRoom(emptyRoom());
        setStatus("Connected to ShareX");
      }
    }, 5500);
  };

  const play = (index) => {
    const current = roomRef.current;
    if (current.role === "host") {
      const next = applyMove(index, "X");
      if (next) sendState();
    } else if (current.role === "guest" && current.turn === "O" && !current.result && !current.board[index]) {
      sendTo(current.peer, "move", { code: current.code, index });
    }
  };

  const newGame = () => {
    const current = roomRef.current;
    if (current.role !== "host") return;
    updateRoom({ ...current, board: EMPTY_BOARD(), turn: "X", result: null });
    sendState();
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

  const mark = room.role === "host" ? "X" : "O";
  const isMyTurn = room.turn === mark;
  const resultText = room.result === "draw"
    ? "A draw. Good game."
    : room.result
      ? `${room.result === mark ? "You win" : "You lose"}. ${room.result} takes it.`
      : isMyTurn ? "Your turn" : "Opponent’s turn";

  return (
    <main className="page-shell">
      <header className="topbar">
        <a className="brand" href="#home" aria-label="Tic Tac Toe home" onClick={(event) => { event.preventDefault(); if (room.role) leaveRoom(); }}>
          <span className="brand-mark"><i /><i /><i /><i /></span>
          <span>side by side<span className="brand-period">.</span></span>
        </a>
        <div className="connection"><span className={`connection-dot ${connected ? "is-online" : ""}`} />{status}</div>
      </header>

      <div className="layout" id="home">
        <section className="game-column">
          <div className="title-row">
            <div>
              <p className="eyebrow">SHAREX · TWO PLAYER</p>
              <h1>Tic tac toe<span className="title-period">.</span></h1>
            </div>
            {room.role && <button className="text-button" onClick={leaveRoom}>Leave game <span aria-hidden="true">↗</span></button>}
          </div>

          {!room.role ? (
            <div className="lobby">
              <p className="lead">A little game, played together.</p>
              <div className="lobby-actions">
                <button className="primary-button" onClick={createRoom} disabled={!connected}>
                  <span className="button-symbol">＋</span>
                  <span>Create a room<small>Start a game as X</small></span>
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
              <p className="lobby-footnote">Both players need ShareX open and connected. Room codes are shared over your live ShareX connection.</p>
            </div>
          ) : room.role === "joining" ? (
            <div className="waiting-panel">
              <span className="spinner" />
              <p className="eyebrow">ROOM {room.code}</p>
              <h2>Finding your opponent</h2>
              <p>Asking connected players for an open room…</p>
              {notice && <p className="notice" role="status">{notice}</p>}
              <button className="text-button" onClick={leaveRoom}>Cancel</button>
            </div>
          ) : (
            <div className="match-area">
              <div className="match-meta">
                <div className="players">
                  <div className={`player ${isMyTurn && !room.result ? "active-player" : ""}`}>
                    <span className="player-token token-x">X</span>
                    <span><strong>{room.role === "host" ? "You" : "Host"}</strong><small>Player one</small></span>
                  </div>
                  <span className="versus">VS</span>
                  <div className={`player ${!isMyTurn && !room.result && room.peerOnline ? "active-player" : ""}`}>
                    <span className="player-token token-o">O</span>
                    <span><strong>{room.role === "guest" ? "You" : room.peerOnline ? "Opponent" : "Waiting"}</strong><small>Player two</small></span>
                  </div>
                </div>
                <div className="room-badge"><span className={`connection-dot ${room.peerOnline ? "is-online" : ""}`} />{room.peerOnline ? "IN GAME" : room.role === "host" ? "ROOM OPEN" : "RECONNECTING"}</div>
              </div>

              {room.role === "host" && !room.peer && (
                <div className="invite-strip">
                  <div><small>INVITE WITH CODE</small><strong>{room.code}</strong></div>
                  <button onClick={copyCode}>{copied ? "Copied ✓" : "Copy code ↗"}</button>
                </div>
              )}

              <div className="board-wrap">
                <div className={`turn-label ${room.result ? "finished" : ""}`} aria-live="polite">
                  <span className={`turn-token ${room.result === "draw" ? "token-draw" : room.result ? (room.result === "X" ? "token-x" : "token-o") : (isMyTurn ? (mark === "X" ? "token-x" : "token-o") : "token-muted")}`}>
                    {room.result === "draw" ? "=" : room.result || (isMyTurn ? mark : "·")}
                  </span>
                  <span>{resultText}{!room.peerOnline && !room.result ? " · waiting for connection" : ""}</span>
                  {room.result && room.role === "host" && <button className="rematch-button" onClick={newGame}>Play again <span>↻</span></button>}
                </div>
                <div className="board" role="grid" aria-label="Tic tac toe board">
                  {room.board.map((cell, index) => (
                    <button
                      key={index}
                      className={`square ${cell ? `square-${cell.toLowerCase()}` : ""} ${!cell && isMyTurn && !room.result ? "square-ready" : ""}`}
                      onClick={() => play(index)}
                      disabled={!room.peerOnline || Boolean(room.result) || !isMyTurn || Boolean(cell) || room.role === "joining"}
                      role="gridcell"
                      aria-label={`Row ${Math.floor(index / 3) + 1}, column ${(index % 3) + 1}${cell ? `, ${cell}` : ", empty"}`}
                    >
                      {cell && <span>{cell}</span>}
                    </button>
                  ))}
                </div>
              </div>
              {notice && <p className="notice" role="status">{notice}</p>}
            </div>
          )}
        </section>

        <aside className="side-column">
          <div className="side-heading"><span>HOW TO PLAY</span><span className="side-number">01 — 03</span></div>
          <ol className="steps">
            <li><span>01</span><p><strong>Make a room</strong>One player creates a room and shares the code.</p></li>
            <li><span>02</span><p><strong>Join in</strong>The other player enters the six-letter code.</p></li>
            <li><span>03</span><p><strong>Take turns</strong>Get three in a row. X goes first.</p></li>
          </ol>
          <div className="side-note"><span className="note-icon">✳</span><p>Every room is its own little table. Start as many as you like.</p></div>
          <div className="side-footer"><span>LIVE THROUGH SHAREX</span><span className="live-indicator"><i /> {connected ? "CONNECTED" : "OFFLINE"}</span></div>
        </aside>
      </div>
      <footer className="page-footer"><span>Good games are better together.</span><span>{plugin.package} · {plugin.version}</span></footer>
    </main>
  );
}
