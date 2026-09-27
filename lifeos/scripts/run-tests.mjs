import {spawn} from 'node:child_process';

const files=[
 'tests/phase6.test.mjs',
 'tests/entry-design.test.mjs',
 'tests/phase5.test.mjs',
 'tests/phase5-browser.test.mjs',
 'tests/phase4.test.mjs',
 'tests/phase3.test.mjs',
 'tests/phase3-auth.test.mjs',
 'tests/phase4-browser.test.mjs',
 'tests/phase2.test.mjs',
 'tests/phase-handoff.test.mjs'
];

for(const file of files){
 console.log(`\n==> ${file}`);
 const code=await new Promise((resolve,reject)=>{
  const child=spawn(process.execPath,['--test','--test-concurrency=1',file],{stdio:'inherit'});
  child.once('error',reject);
  child.once('exit',value=>resolve(value??1));
 });
 if(code!==0)process.exit(code);
}
