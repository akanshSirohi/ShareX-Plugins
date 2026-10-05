"use client";

import { useEffect, useRef, useState } from "react";
import SharexSDK from "sharex-sdk";
import plugin from "../config.json";

const development = process.env.NODE_ENV === "development";

export default function Starter() {
  const sdkRef = useRef(null);
  const databaseRef = useRef(null);
  const [status, setStatus] = useState(
    development ? "Pair your phone" : "Connecting",
  );
  const [connected, setConnected] = useState(false);
  const [users, setUsers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState("Hello from my plugin!");
  const [notes, setNotes] = useState([]);
  const [databaseReady, setDatabaseReady] = useState(false);
  const [note, setNote] = useState("My first saved note");

  useEffect(() => {
    let sdk;
    let disposed = false;
    const refreshUsers = () => sdk.getAllUsers(setUsers);
    const refreshNotes = () =>
      databaseRef.current?.find("notes", (result) =>
        setNotes(result.data || []),
      );
    try {
      sdk = new SharexSDK({
        public_data: { name: `Browser ${Math.floor(Math.random() * 1000)}` },
        preserve_session_id: true,
        ...(development ? { development: { package_name: plugin.package } } : {}),
      });
      sdkRef.current = sdk;
      setStatus("Connecting");
      sdk.init((action, data) => {
        if (disposed) return;
        if (action === "open" || action === "reconnect") {
          setConnected(true);
          setStatus("Connected to ShareX");
          refreshUsers();
          if (action === "open") {
            databaseRef.current = sdk.createDBInstance(
              "starter",
              (databaseAction, result) => {
                if (disposed) return;
                setDatabaseReady(result === "success");
                if (result === "success") refreshNotes();
              },
            );
          }
        } else if (action === "close") {
          setConnected(false);
          setDatabaseReady(false);
          setUsers([]);
          setStatus("Disconnected. Retrying…");
        } else if (action === "error") {
          setStatus(
            "Connection failed. Check sharing, development key, and network.",
          );
        } else if (action === "user_arrive" || action === "user_left") {
          refreshUsers();
        } else if (action === "msg_arrive") {
          setMessages((items) =>
            [{ text: data, received: true }, ...items].slice(0, 20),
          );
        }
      });
    } catch (error) {
      setStatus(error.message);
    }
    return () => {
      disposed = true;
      sdk?.disconnect();
      if (sdkRef.current === sdk) sdkRef.current = null;
      databaseRef.current = null;
    };
  }, []);

  const send = (event) => {
    event.preventDefault();
    const sdk = sdkRef.current;
    if (!sdk?.connectionStatus || !message.trim()) return;
    sdk.getAllUsers((peers) => {
      const recipients = peers.filter((user) => user.uuid !== sdk.getMyUUID());
      recipients.forEach((user) => sdk.sendMsg(user.uuid, message));
      setMessages((items) =>
        [
          {
            text: `Sent to ${recipients.length} browser(s): ${message}`,
            received: false,
          },
          ...items,
        ].slice(0, 20),
      );
    });
  };

  const saveNote = (event) => {
    event.preventDefault();
    if (!note.trim() || !databaseReady) return;
    databaseRef.current.insert(
      "notes",
      { text: note.trim() },
      { uuid: true },
      (result) => {
        if (result.status !== "success") {
          setStatus("Could not save note");
          return;
        }
        databaseRef.current.find("notes", (result) =>
          setNotes(result.data || []),
        );
        setNote("");
      },
    );
  };

  return (
    <main>
      <header>
        <div className="mark">S</div>
        <div>
          <p className="eyebrow">SHAREX / PLUGIN STARTER</p>
          <h1>Build here. Connect anywhere.</h1>
        </div>
      </header>
      <p className="intro">
        Your plugin runs in the browser. ShareX on your phone provides messaging
        and storage.
      </p>
      <div className="status" role="status">
        <span className={connected ? "dot online" : "dot"} />
        {status}
      </div>
      <div className="grid">
        <section>
          <p className="eyebrow">01 / WEBSOCKET</p>
          <h2>Say hello</h2>
          <p>
            {users.length} connected browser(s). Messages stay within this
            plugin.
          </p>
          <form onSubmit={send}>
            <label htmlFor="message">Message to other browsers</label>
            <input
              id="message"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
            />
            <button disabled={!connected} type="submit">
              Send message
            </button>
          </form>
          <ul className="items">
            {messages.map((item, index) => (
              <li key={index}>
                <small>{item.received ? "RECEIVED" : "SENT"}</small>
                {item.text}
              </li>
            ))}
          </ul>
          {!messages.length && (
            <p className="empty">Connect a second browser to try messaging.</p>
          )}
        </section>
        <section>
          <p className="eyebrow">02 / PLUGIN DATABASE</p>
          <h2>Keep a note</h2>
          <p>
            Notes persist on your phone. Development uses a separate database.
          </p>
          <form onSubmit={saveNote}>
            <label htmlFor="note">New note</label>
            <input
              id="note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
            <button disabled={!connected || !databaseReady} type="submit">
              Save note
            </button>
          </form>
          <ul className="items">
            {notes.map((item) => (
              <li key={item._uuid}>{item.text}</li>
            ))}
          </ul>
          {!notes.length && (
            <p className="empty">Your saved notes will appear here.</p>
          )}
        </section>
      </div>
      <footer>
        {plugin.package} · {plugin.version}{" "}
        <span>{development ? "Live development" : "Static plugin"}</span>
      </footer>
    </main>
  );
}
