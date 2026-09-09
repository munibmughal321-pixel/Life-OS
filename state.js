// This file defines what the app's data looks like, and holds it
// in memory while the app is running. Every screen reads from and
// writes to this same `state` object.
//
// storage.js is responsible for loading this from data.json on
// startup, and saving it back after every change.

export const defaultState = {
  profile: {
    name: 'Munib',
    cgpa: 2.49,
    salary: 40000
  },

  // Activity check-in / check-out log
  logs: [], // { id, activity, startISO, endISO, quality?, headache? }

  // Deen
  prayers: {},   // { "2026-09-08": { Fajr: true, Dhuhr: false, ... } }
  quran: [],     // { date, pages }
  adhkar: {},    // { "2026-09-08": { morning: true, evening: false } }
  jumuah: {},    // { "2026-09-08": true }
  ramadan: { enabled: false, fasting: {} },

  // Health
  checkins: [], // { date, weight, energy, mood, water, exercise, steps, calories, headache }

  // Finance
  finance: [],    // { id, type: 'income'|'expense', amount, category, note, date }
  loans: [],      // { id, name, type: 'given'|'received', amount, notes, settled, date }
  recurring: [],  // { id, name, amount, frequency, category }

  // Growth
  goals: [],      // { id, name, category, target, current, deadline, status }
  mission: { goalId: null },
  skills: [],     // { id, name, xp, projects, notes }
  education: [],  // { id, name, type, status, deadline, notes }
  courses: [],    // { id, name, creditHours, gradePoints }
  trades: [],     // { id, pair, entry, exit, tp, sl, result, lessons, date }
  notes: [],      // { id, category, title, content, date }

  journal: [] // { date, best, worst, focus }
};

// The live, in-memory copy of the app's data.
// Screens mutate this directly (e.g. state.logs.push(...)) and then
// call saveState() from storage.js to persist the change.
export let state = structuredClone(defaultState);

// Replaces the entire state object (used once, right after loading
// from the server on startup).
export function setState(loaded) {
  state = { ...structuredClone(defaultState), ...loaded };
}
