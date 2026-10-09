export const LETTERS = ["B", "I", "N", "G", "O"];

const LINES = [
  ...Array.from({ length: 5 }, (_, row) => Array.from({ length: 5 }, (_, column) => row * 5 + column)),
  ...Array.from({ length: 5 }, (_, column) => Array.from({ length: 5 }, (_, row) => row * 5 + column)),
  [0, 6, 12, 18, 24],
  [4, 8, 12, 16, 20],
];

export function completedLines(card, called) {
  if (card.length !== 25) return [];
  const marked = new Set(called);
  return LINES.filter((line) => line.every((index) => marked.has(card[index])));
}

export function hasBingo(card, called) {
  return completedLines(card, called).length >= LETTERS.length;
}

export function turnForSequence(sequence) {
  return sequence % 2 === 0 ? "host" : "guest";
}

export function canCall(state, caller) {
  return (caller === "host" || caller === "guest") && state.active && state.peerOnline
    && !state.pending && !state.result && turnForSequence(state.sequence) === caller;
}

export function advanceCall(state, number, caller, sequence) {
  if (state.role !== "host" || sequence !== state.sequence || !canCall(state, caller)) return null;
  if (!Number.isInteger(number) || number < 1 || number > 25 || state.called.includes(number)) return null;
  const called = [...state.called, number];
  return {
    ...state,
    called,
    sequence: state.sequence + 1,
    pending: true,
    pendingNumber: null,
    hostBingo: hasBingo(state.card, called),
    guestBingo: false,
  };
}

export function callResult(hostBingo, guestBingo) {
  if (hostBingo && guestBingo) return { winner: "draw" };
  if (hostBingo) return { winner: "X" };
  if (guestBingo) return { winner: "O" };
  return null;
}
