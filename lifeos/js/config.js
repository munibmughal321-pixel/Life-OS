// App constants, presets, and static configuration
const localDateKey = date => date.getFullYear()+'-'+String(date.getMonth()+1).padStart(2,'0')+'-'+String(date.getDate()).padStart(2,'0');
const today = () => localDateKey(new Date());
const DAY_MS = 86400000;
let currentScreen = "dashboard";
let growthSub = "goals";

const ACTIVITY_TYPES = [
  {key:"Sleep", color:"#6B7CFF"},{key:"Work", color:"#4CAF7D"},{key:"Study", color:"#E8A33D"},
  {key:"Quran", color:"#C97B63"},{key:"Workout", color:"#D9615A"},{key:"Travel", color:"#8B93A7"},
  {key:"Gaming", color:"#7C5CFF"},{key:"Social Media", color:"#5C6480"},{key:"Family/Friends", color:"#E8A33D"},
  {key:"Other", color:"#8B93A7"}
];
const colorFor = (k) => (ACTIVITY_TYPES.find(a=>a.key===k)||{}).color || "#8B93A7";
const SKILL_PRESETS = ["HTML","CSS","JavaScript","React","React Native","Firebase"];
const PRAYER_NAMES = ["Fajr","Dhuhr","Asr","Maghrib","Isha"];
