// Persistence boundary: validate imported and stored records before any renderer sees them.
const DataSchema = (() => {
  const object = v => v !== null && typeof v === 'object' && (Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null);
  const text = v => typeof v === 'string' && v.length <= 100000;
  const name = v => text(v) && v.trim().length > 0;
  const number = v => typeof v === 'number' && Number.isFinite(v);
  const nonnegative = v => number(v) && v >= 0;
  const positive = v => number(v) && v > 0;
  const bool = v => typeof v === 'boolean';
  const id = v => typeof v === 'string' && /^[a-zA-Z0-9_-]{1,160}$/.test(v);
  const date = v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0,10) === v;
  const timestamp = v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v) && Number.isFinite(Date.parse(v));
  const optional = rule => v => v === undefined || rule(v);
  const nullable = rule => v => v == null || rule(v);
  const choice = (...values) => v => values.includes(v);
  const list = rule => v => Array.isArray(v) && v.length <= 100000 && v.every(rule);
  const fields = (v, rules) => object(v) && Object.entries(rules).every(([key, rule]) => rule(v[key]));
  const checklist = list(v => fields(v, {text, done:bool}));
  const optionalDate = optional(v => v === '' || v === null || date(v));
  const optionalTime = optional(nullable(timestamp));
  const optionalNumber = optional(nullable(nonnegative));
  const rating = max => optional(nullable(v => number(v) && v >= 1 && v <= max));
  const url = v => v === '' || (text(v) && (() => {try{return ['http:','https:'].includes(new URL(v).protocol);}catch{return false;}})());
  // Unknown future fields are retained only if they are safe JSON; known fields stay typed.
  function safeJSON(v, depth=0){
    if(depth > 16)return false;
    if(v === null || bool(v) || text(v) || number(v))return true;
    if(Array.isArray(v))return v.length <= 100000 && v.every(x=>safeJSON(x,depth+1));
    return object(v) && Object.keys(v).length <= 100000 && Object.entries(v).every(([key,value]) => !['__proto__','prototype','constructor'].includes(key) && safeJSON(value,depth+1));
  }
  const common = {id, date:optionalDate};
  const session = v => fields(v, {
    id, activity:v=>ACTIVITY_TYPES.some(a=>a.key===v), startISO:timestamp,
    endISO:optionalTime, plannedEndISO:optionalTime, goalId:optional(nullable(v=>v==='' || id(v))),
    intention:optional(text),reflection:optional(text),quality:rating(5),rating:rating(5),
    headache:optional(nullable(bool)),sound:optional(bool),notify:optional(bool),
    reviewPending:optional(bool),reviewSkipped:optional(bool),endedAutomatically:optional(bool)
  }) && (!v.endISO || Date.parse(v.endISO)>=Date.parse(v.startISO)) && (!v.plannedEndISO || Date.parse(v.plannedEndISO)>Date.parse(v.startISO));
  const itemRules = {
    logs:session,
    quran:v=>fields(v,{date,pages:positive}),
    finance:v=>fields(v,{...common,date,type:choice('income','expense'),amount:positive,category:text,note:optional(text)}),
    loans:v=>fields(v,{...common,name,type:choice('given','received'),amount:positive,notes:optional(text),settled:optional(bool)}),
    recurring:v=>fields(v,{id,name,amount:positive,frequency:choice('Monthly','Weekly'),category:optional(text)}),
    goals:v=>fields(v,{...common,name,category:optional(text),status:optional(text),deadline:optionalDate,tracking:optional(choice('number','checklist','completion')),target:positive,current:nonnegative,start:optional(nonnegative),unit:optional(text),sessionProgress:optional(choice('manual','hours','sessions')),steps:optional(checklist)}),
    skills:v=>fields(v,{...common,name,category:optional(text),level:optional(text),milestone:optional(text),evidence:optional(text),notes:optional(text),xp:optional(nonnegative),projects:optional(nonnegative),practice:optional(list(p=>fields(p,{id,date,minutes:v=>Number.isInteger(v)&&v>0&&v<=1440,note:text})))}),
    education:v=>fields(v,{...common,name,type:optional(text),status:optional(text),source:optional(url),notes:optional(text),deadline:optionalDate,completed:optional(nonnegative),total:optional(nonnegative),progressUnit:optional(text)}) && (!v.total || (v.completed || 0)<=v.total),
    courses:v=>fields(v,{id,name,creditHours:positive,gradePoints:v=>number(v)&&v>=0&&v<=4}),
    trades:v=>fields(v,{...common,pair:name,entry:nonnegative,exit:nonnegative,tp:optional(v=>v==='' || nonnegative(v) || (text(v)&&Number.isFinite(Number(v))&&Number(v)>=0)),sl:optional(v=>v==='' || nonnegative(v) || (text(v)&&Number.isFinite(Number(v))&&Number(v)>=0)),result:choice('Win','Loss','Break Even'),lessons:optional(text)}),
    notes:v=>fields(v,{...common,title:name,content:optional(text),category:optional(text),kind:optional(text),url:optional(url),tags:optional(list(text)),related:optional(text),pinned:optional(bool),archived:optional(bool),checklist:optional(checklist),updatedAt:optionalTime}),
    checkins:v=>fields(v,{date,weight:nullable(positive),energy:rating(10),mood:rating(10),water:optionalNumber,exercise:optionalNumber,steps:optionalNumber,calories:optionalNumber,headache:optional(bool)}),
    journal:v=>fields(v,{date,best:text,worst:text,focus:text})
  };
  const dateMap = (v, rule) => object(v) && Object.entries(v).every(([key,value])=>date(key)&&rule(value));
  const objectRules = {
    profile:v=>fields(v,{name:optional(text),cgpa:optional(nullable(v=>number(v)&&v>=0&&v<=4)),salary:optionalNumber,learningPaths:optional(list(text)),academicTools:optional(bool),savingsGoal:optionalNumber,savingsCurrent:optionalNumber}),
    mission:v=>fields(v,{goalId:nullable(v=>v==='' || id(v))}),
    prayers:v=>dateMap(v,p=>fields(p,Object.fromEntries([...PRAYER_NAMES.map(k=>[k,optional(bool)]),['note',optional(text)]]))),
    adhkar:v=>dateMap(v,p=>fields(p,{morning:optional(bool),evening:optional(bool)})),
    jumuah:v=>dateMap(v,bool),
    ramadan:v=>fields(v,{enabled:bool,fasting:x=>dateMap(x,bool)})
  };
  function error(key,value){
    if(!safeJSON(value))return key+': unsupported, non-finite or unsafe data.';
    if(itemRules[key]){
      if(!Array.isArray(value))return key+': expected a list.';
      const seen=new Set();
      for(let i=0;i<value.length;i++){
        if(!itemRules[key](value[i]))return key+': invalid fields in record '+(i+1)+'.';
        const identity=value[i].id || (key==='quran'?value[i].date:null);
        if(identity && seen.has(identity))return key+': duplicate record ID.';
        seen.add(identity);
      }
      if(key==='logs' && value.filter(l=>!l.endISO).length>1)return 'logs: more than one running activity.';
      return '';
    }
    return objectRules[key]?.(value)?'':key+': invalid collection fields.';
  }
  return {error, safeJSON, session, date, timestamp};
})();
