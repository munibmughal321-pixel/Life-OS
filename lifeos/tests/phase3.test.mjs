import test from 'node:test';
import assert from 'node:assert/strict';
import {validateRecord} from '../backend/repository.js';
test('cloud record boundary rejects invalid collections, identities and payloads',()=>{
 assert.throws(()=>validateRecord('unknown','key',{}));
 assert.throws(()=>validateRecord('notes','',{}));
 assert.throws(()=>validateRecord('notes','a'.repeat(101),{}));
 assert.throws(()=>validateRecord('notes','x',[]));
 assert.throws(()=>validateRecord('notes','x',null));
 assert.throws(()=>validateRecord('notes','x',{text:'x'.repeat(65536)}));
 assert.doesNotThrow(()=>validateRecord('notes','x',{title:'Allowed'}));
});
import {authMessage} from '../backend/auth-feedback.js';
test('auth feedback distinguishes email limits, request limits and unknown throttling',()=>{
 assert.match(authMessage({status:429,code:'over_email_send_rate_limit'}),/email service.*sending limit/);
 assert.match(authMessage({status:429,code:'over_request_rate_limit'}),/account requests/);
 assert.match(authMessage({status:429}),/did not specify/);
 assert.match(authMessage({code:'email_address_not_authorized'}),/not configured/);
});
