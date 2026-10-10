import assert from 'node:assert/strict';
import api from './api.js';

class FakeDB {
  constructor(){this.calls=[];}
  prepare(sql){
    const self=this;
    return {bind(...args){return {first:async()=>sql.includes('user_roles')?{role:args[0]==='user-admin'?'admin':args[0]==='user-security'?'security':'resident'}:null,all:async()=>({results:[]}),run:async()=>{self.calls.push({sql,args});return {success:true}}};}};
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
res=await api.fetch(req('/api/demo-community/announcements',{method:'POST',headers:{'content-type':'application/json','oai-authenticated-user-id':'user-admin'},body:JSON.stringify({title:'Water maintenance',body:'Scheduled maintenance tomorrow'})}),env);
assert.equal(res.status,201,'admin can publish an announcement');
res=await api.fetch(req('/api/demo-community/notifications',{headers:{'oai-authenticated-user-id':'user-ahmed'}}),env);
assert.equal(res.status,200,'resident can read notifications');
console.log('worker smoke tests: OK');

