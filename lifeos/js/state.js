// Central application state and persistence key registry
let state = {
  logs: [], prayers: {}, quran: [], finance: [], loans: [], recurring: [],
  checkins: [], profile: { cgpa: 2.49, salary: 40000 },
  goals: [], skills: [], education: [], notes: [], journal: [],
  mission: { goalId: null }, courses: [], adhkar: {}, jumuah: {},
  ramadan: { enabled:false, fasting:{} }, trades: []
};
const STORAGE_KEYS = ["logs","prayers","quran","finance","loans","recurring","checkins","profile","goals","skills","education","notes","journal","mission","courses","adhkar","jumuah","ramadan","trades"];
