import { test } from "node:test";
import assert from "node:assert/strict";
import { advanceCall, callResult, canCall, completedLines, hasBingo, turnForSequence } from "../app/bingo.mjs";

const card = Array.from({ length: 25 }, (_, index) => index + 1);
const hostRoom = () => ({
  role: "host", card, called: [], sequence: 0,
  active: true, peerOnline: true, pending: false, result: null,
});

test("one completed row crosses only B and does not end either player's game", () => {
  const called = [1, 2, 3, 4, 5];
  assert.equal(completedLines(card, called).length, 1);
  assert.equal(hasBingo(card, called), false);
  assert.equal(callResult(hasBingo(card, called), hasBingo(card, called)), null);
});

test("columns and both full diagonals count as distinct lines", () => {
  assert.equal(completedLines(card, [1, 6, 11, 16, 21]).length, 1);
  assert.equal(completedLines(card, [1, 7, 13, 19, 25]).length, 1);
  assert.equal(completedLines(card, [5, 9, 13, 17, 21]).length, 1);
  assert.equal(completedLines(card, [1, 7, 13, 19, 25, 5, 9, 17, 21]).length, 2);
  assert.equal(completedLines(card, [1, 7, 13, 19]).length, 0);
});

test("five distinct lines are required; repeated calls do not add lines", () => {
  const fourRows = card.slice(0, 20);
  assert.equal(completedLines(card, fourRows).length, 4);
  assert.equal(hasBingo(card, fourRows), false);
  assert.equal(hasBingo(card, [...fourRows, 21]), true);
  assert.equal(completedLines(card, [1, 2, 3, 4, 5, 5, 5]).length, 1);
  assert.equal(completedLines(card, card).length, 12);
});

test("one call can cross two letters when it completes a row and column", () => {
  const called = [...card.slice(0, 20).filter((number) => number !== 2), 22];
  assert.equal(completedLines(card, called).length, 3);
  assert.equal(completedLines(card, [...called, 2]).length, 5);
  assert.equal(hasBingo(card, [...called, 2]), true);
});

test("players alternate after each acknowledged call; pending calls lock both sides", () => {
  const room = hostRoom();
  assert.equal(canCall(room, "host"), true);
  assert.equal(canCall(room, "guest"), false);
  assert.equal(advanceCall(room, 2, "guest", 0), null);
  const first = advanceCall(room, 1, "host", 0);
  assert.equal(canCall(first, "host"), false);
  assert.equal(canCall(first, "guest"), false);
  const ready = { ...first, pending: false };
  assert.equal(turnForSequence(ready.sequence), "guest");
  assert.equal(advanceCall(ready, 2, "host", 1), null);
  const second = advanceCall(ready, 2, "guest", 1);
  assert.deepEqual(second.called, [1, 2]);
  assert.equal(turnForSequence(second.sequence), "host");
});

test("the host rejects stale requests, duplicate or invalid numbers, disconnections, and finished games", () => {
  const room = { ...hostRoom(), sequence: 3, called: [1, 2, 3] };
  assert.equal(advanceCall(room, 4, "guest", 1), null);
  assert.equal(advanceCall(room, 4, "guest", undefined), null);
  for (const number of [1, 0, 26, 1.5, "4"]) {
    assert.equal(advanceCall(room, number, "guest", 3), null);
  }
  assert.equal(advanceCall({ ...room, peerOnline: false }, 4, "guest", 3), null);
  assert.equal(advanceCall({ ...room, result: { winner: "X" } }, 4, "guest", 3), null);
  assert.equal(advanceCall({ ...room, role: "guest" }, 4, "guest", 3), null);
});

test("the host waits for the guest before settling a five-line win or same-call draw", () => {
  const before = { ...hostRoom(), called: card.slice(0, 20), sequence: 20 };
  const pending = advanceCall(before, 21, "host", 20);
  assert.equal(pending.hostBingo, true);
  assert.equal(pending.pending, true);
  assert.equal(pending.result, null);
  assert.deepEqual(callResult(pending.hostBingo, hasBingo(card, pending.called)), { winner: "draw" });
  assert.deepEqual(callResult(true, false), { winner: "X" });
  assert.deepEqual(callResult(false, true), { winner: "O" });
  assert.equal(callResult(false, false), null);
});
