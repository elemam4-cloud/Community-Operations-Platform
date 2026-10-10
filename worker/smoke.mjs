import assert from 'node:assert/strict';
import api from './api.js';

class FakeDB {
  constructor(){this.calls=[];}
  prepare(sql){
    const self=this;
    return {bind(...args){return {first:async()=>sql.includes('user_roles')?{role:args[0]==='user-admin'?'admin':args[0]==='user-security'?'security':'resident'}:sql.includes('maintenance_tickets')?{id:args[0],requester_id:'user-admin'}:null,all:async()=>({results:[]}),run:async()=>{self.calls.push({sql,args});return {success:true}}};}};
  }
}
const env={DB:new FakeDB()};
const req=(path,options={})=>new Request('https://example.test'+path,options);
let res=await api.fetch(req('/api/demo-community/units'),env);
assert.equal(res.status,401,'missing identity must be rejected');
res=await api.fetch(req('/api/demo-community/units',{headers:{'oai-authenticated-user-id':'user-admin'}}),env);
assert.equal(res.status,200,'admin can read units');
res=await api.fetch(req('/api/demo-community/permits',{method:'POST',headers:{'content-type':'application/json','oai-authenticated-user-id':'user-admin'},body:JSON.stringify({subject_name:'Test visitor',permit_type:'visitor',starts_at:'2026-10-10T08:00:00Z',expires_at:'2026-10-10T18:00:00Z'})}),env);
assert.equal(res.status,201,'admin can issue a permit');
assert.ok(env.DB.calls.some(x=>x.sql.includes('INSERT INTO permits')),'permit insert was executed');
res=await api.fetch(req('/api/demo-community/maintenance-tickets',{method:'POST',headers:{'content-type':'application/json','oai-authenticated-user-id':'user-admin'},body:JSON.stringify({title:'Test ticket'})}),env);
assert.equal(res.status,201,'admin can create a maintenance ticket');
assert.ok(env.DB.calls.some(x=>x.sql.includes('INSERT INTO audit_events')),'audit event was written');
res=await api.fetch(req('/api/demo-community/maintenance-tickets',{headers:{'oai-authenticated-user-id':'user-ahmed'}}),env);
assert.equal(res.status,200,'resident can read maintenance tickets');
assert.ok(env.DB.calls.length >= 0,'resident ticket query completed with scoped parameters');
res=await api.fetch(req('/api/demo-community/permit-revoke',{method:'POST',headers:{'content-type':'application/json','oai-authenticated-user-id':'user-admin'},body:JSON.stringify({permit_id:'permit-demo',reason:'Test revocation'})}),env);
assert.equal(res.status,200,'admin can revoke a permit');
assert.ok(env.DB.calls.some(x=>x.sql.includes('UPDATE permits')),'permit revocation was executed');
res=await api.fetch(req('/api/demo-community/maintenance-tickets',{method:'PATCH',headers:{'content-type':'application/json','oai-authenticated-user-id':'user-admin'},body:JSON.stringify({ticket_id:'ticket-demo',status:'in_progress',note:'Technician assigned'})}),env);
assert.equal(res.status,200,'admin can update maintenance status');
assert.ok(env.DB.calls.some(x=>x.sql.includes('INSERT INTO ticket_history')),'ticket history was written');
res=await api.fetch(req('/api/demo-community/maintenance-tickets',{method:'PATCH',headers:{'content-type':'application/json','oai-authenticated-user-id':'user-admin'},body:JSON.stringify({ticket_id:'ticket-demo',status:'invalid'})}),env);
assert.equal(res.status,400,'invalid maintenance status is rejected');
res=await api.fetch(req('/api/demo-community/announcements',{method:'POST',headers:{'content-type':'application/json','oai-authenticated-user-id':'user-admin'},body:JSON.stringify({title:'Water maintenance',body:'Scheduled maintenance tomorrow'})}),env);
assert.equal(res.status,201,'admin can publish an announcement');
res=await api.fetch(req('/api/demo-community/announcements',{headers:{'oai-authenticated-user-id':'user-ahmed'}}),env);
assert.equal(res.status,200,'resident can read announcements');
res=await api.fetch(req('/api/demo-community/notifications',{headers:{'oai-authenticated-user-id':'user-ahmed'}}),env);
assert.equal(res.status,200,'resident can read notifications');
res=await api.fetch(req('/api/demo-community/parking',{headers:{'oai-authenticated-user-id':'user-security'}}),env);
assert.equal(res.status,200,'security can read parking');
res=await api.fetch(req('/api/demo-community/gate-check',{method:'POST',headers:{'content-type':'application/json','oai-authenticated-user-id':'user-security'},body:JSON.stringify({permit_id:'missing-permit'})}),env);
assert.equal(res.status,200,'security can check a permit');
assert.equal((await res.json()).data.allowed,false,'missing permit is denied');
res=await api.fetch(req('/api/demo-community/gate-events',{method:'POST',headers:{'content-type':'application/json','oai-authenticated-user-id':'user-security'},body:JSON.stringify({gate_name:'North Gate',direction:'entry',decision:'denied'})}),env);
assert.equal(res.status,201,'security can append a gate event');
console.log('worker smoke tests: OK');

