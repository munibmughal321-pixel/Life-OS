import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {nativeWorkspace} from '../native/workspace.js';
import {callbackRoute,validatePlace,distanceMetres} from '../native/contracts.js';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);

export function sqliteBridge(){
 const db=new DatabaseSync(':memory:');
 db.exec('CREATE TABLE workspaces(name TEXT PRIMARY KEY, revision INTEGER NOT NULL, value TEXT NOT NULL)');
 let fail=false;
 return {
  db,
  failNext(){fail=true;},
  async readWorkspace({name}){
   const row=db.prepare('SELECT revision,value FROM workspaces WHERE name=?').get(name);
   return row?{...row}:{revision:0,value:null};
  },
  async writeWorkspace({name,expected,value}){
   db.exec('BEGIN IMMEDIATE');
   try{
    if(fail){fail=false;throw Error('Simulated disk failure');}
    const row=db.prepare('SELECT revision FROM workspaces WHERE name=?').get(name);
    if((row?.revision||0)!==expected)throw Error('Native records changed. Reload or retry.');
    db.prepare('INSERT OR REPLACE INTO workspaces(name,revision,value) VALUES(?,?,?)').run(name,expected+1,value);
    db.exec('COMMIT');
   }catch(error){db.exec('ROLLBACK');throw error;}
  }
 };
}
test('native SQLite adapter retains atomic collection/recovery writes, rejects stale edits, isolates owners and fails closed',async()=>{
 const device=sqliteBridge(),a=nativeWorkspace(device,'lifeos-local'),b=nativeWorkspace(device,'lifeos-account-11111111-1111-1111-1111-111111111111');
 try{
  const initial=await a.read(),stale=await a.read();
  initial.data.collections.logs={version:1,revision:1,value:[{id:'entry'}]};
  initial.data.recovery['sync-state']={enabled:true,base:{},conflicts:[]};
  await a.commit(initial,initial.data);
  assert.equal((await a.read()).data.collections.logs.value.length,1);
  assert.deepEqual((await b.read()).data.collections,{});
  await assert.rejects(a.commit(stale,stale.data),/changed/);
  const current=await a.read();device.failNext();
  await assert.rejects(a.commit(current,{version:1,collections:{},recovery:{}}),/disk/);
  assert.deepEqual((await a.read()).data,current.data);
  device.db.prepare('UPDATE workspaces SET value=? WHERE name=?').run('broken','lifeos-local');
  await assert.rejects(a.read());
  assert.throws(()=>nativeWorkspace(device,'../../other'));
 }finally{device.db.close();}
});
test('callback allowlist rejects external URLs, injected routes and token fragments',()=>{
 assert.equal(callbackRoute('com.munib.lifeos://auth/login.html?code=abc'),'login.html?code=abc');
 assert.equal(callbackRoute('com.munib.lifeos://auth/reset-password.html?code=a%2Bb'),'reset-password.html?code=a%2Bb');
 for(const url of ['https://example.com/login.html?code=x','com.munib.lifeos://auth/other.html?code=x','com.munib.lifeos://evil/login.html?code=x','com.munib.lifeos://auth/login.html#access_token=x','com.munib.lifeos://auth/login.html?code=x&code=y','com.munib.lifeos://user@auth/login.html?code=x'])assert.equal(callbackRoute(url),null);
});
test('saved places enforce bounds and correct distance calculation',()=>{
 const place={id:'test',name:'Library',activity:'Study',latitude:24.86,longitude:67.01,radius:200};
 assert.equal(validatePlace(place).name,'Library');assert.equal(distanceMetres(place,place),0);
 assert.ok(distanceMetres(place,{...place,latitude:24.87})>1100);
 for(const patch of [{latitude:91},{longitude:NaN},{radius:99},{radius:1001},{name:''},{id:'../bad'}])assert.throws(()=>validatePlace({...place,...patch}));
});
test('native projects register the bridge and Xcode project parses with plugin source included',()=>{
 const xcode=require('xcode'),project=xcode.project('ios/App/App.xcodeproj/project.pbxproj');project.parseSync();
 assert.ok(project.generateUuid().length===24);
 assert.match(readFileSync('android/app/src/main/java/com/munib/lifeos/MainActivity.java','utf8'),/registerPlugin\(LifeOSDevicePlugin.class\)/);
 assert.match(readFileSync('ios/App/App/SceneDelegate.swift','utf8'),/LifeOSViewController\(\)/);
 assert.ok(project.pbxSourcesBuildPhaseObj(Object.keys(project.pbxNativeTargetSection()).find(k=>!k.endsWith('_comment'))).files.some(f=>f.comment==='LifeOSDevicePlugin.swift in Sources'));
});
