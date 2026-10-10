import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import api from './api.js';

class SQLiteD1Adapter {
  constructor(db) { this.db = db; }
  prepare(sql) {
    const db = this.db;
    return {
      bind(...args) {
        return {
          first: async () => db.prepare(sql).get(...args) || null,
          all: async () => ({ results: db.prepare(sql).all(...args) }),
          run: async () => { db.prepare(sql).run(...args); return { success: true }; }
        };
      }
    };
  }
}

const sqlite = new DatabaseSync(':memory:');
sqlite.exec(fs.readFileSync(new URL('../database/schema.sql', import.meta.url), 'utf8'));
sqlite.exec(fs.readFileSync(new URL('../database/seed.sql', import.meta.url), 'utf8'));
const env = { DB: new SQLiteD1Adapter(sqlite) };
const request = (path, options = {}) => new Request(`https://example.test${path}`, options);
const headers = user => ({ 'oai-authenticated-user-id': user, 'content-type': 'application/json' });

let response = await api.fetch(request('/api/demo-community/units', { headers: headers('user-admin') }), env);
assert.equal(response.status, 200);
assert.equal((await response.json()).data.length, 3);

response = await api.fetch(request('/api/demo-community/dashboard', { headers: headers('user-admin') }), env);
assert.equal(response.status, 200);
const initialDashboard = (await response.json()).data;
assert.equal(initialDashboard.operational_state, 'online');
assert.equal(initialDashboard.last_successful_sync_at, '2026-10-09T08:00:00Z');
const dashboard = initialDashboard.metrics;
assert.equal(dashboard.units, 3);
assert.equal(dashboard.users, 4);
assert.equal(dashboard.vehicles, 1);

sqlite.prepare("UPDATE community_settings SET setting_value=? WHERE community_id=? AND setting_key=?").run('manual_fallback', 'demo-community', 'operational_state');
sqlite.prepare("UPDATE community_settings SET setting_value=? WHERE community_id=? AND setting_key=?").run('2026-10-10T08:00:00Z', 'demo-community', 'last_successful_sync_at');
response = await api.fetch(request('/api/demo-community/dashboard', { headers: headers('user-admin') }), env);
const emergencyDashboard = (await response.json()).data;
assert.equal(emergencyDashboard.operational_state, 'manual_fallback');
assert.equal(emergencyDashboard.last_successful_sync_at, '2026-10-10T08:00:00Z');

response = await api.fetch(request('/api/demo-community/gate-events', { method: 'POST', headers: headers('user-security'), body: JSON.stringify({ gate_name: 'North Gate', direction: 'entry', decision: 'allowed', manual_override: true, reason: 'Emergency response' }) }), env);
assert.equal(response.status, 201);
response = await api.fetch(request('/api/demo-community/policies', { method: 'PATCH', headers: headers('user-admin'), body: JSON.stringify({ policy_key: 'manual_gate_override', enabled: false }) }), env);
assert.equal(response.status, 200);
response = await api.fetch(request('/api/demo-community/gate-events', { method: 'POST', headers: headers('user-security'), body: JSON.stringify({ gate_name: 'North Gate', direction: 'entry', decision: 'allowed', manual_override: true, reason: 'Should be rejected' }) }), env);
assert.equal(response.status, 400);
response = await api.fetch(request('/api/demo-community/policies', { method: 'PATCH', headers: headers('user-admin'), body: JSON.stringify({ policy_key: 'manual_gate_override', enabled: true }) }), env);
assert.equal(response.status, 200);

response = await api.fetch(request('/api/demo-community/visits', { method: 'POST', headers: headers('user-security'), body: JSON.stringify({ visitor_name: 'Integration Visitor', visitor_type: 'visitor', host_unit_id: 'unit-a204' }) }), env);
assert.equal(response.status, 201);
const visitId = (await response.json()).data.id;

response = await api.fetch(request('/api/demo-community/visits', { method: 'PATCH', headers: headers('user-security'), body: JSON.stringify({ visit_id: visitId, status: 'checked_in' }) }), env);
assert.equal(response.status, 200);
assert.equal(sqlite.prepare('SELECT status FROM visits WHERE id=?').get(visitId).status, 'checked_in');

response = await api.fetch(request('/api/demo-community/visits', { headers: headers('user-ahmed') }), env);
assert.equal(response.status, 200);
console.log('sqlite integration smoke tests: OK');

