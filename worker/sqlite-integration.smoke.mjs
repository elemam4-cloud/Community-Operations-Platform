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
const dashboard = (await response.json()).data.metrics;
assert.equal(dashboard.units, 3);
assert.equal(dashboard.users, 4);
assert.equal(dashboard.vehicles, 1);

response = await api.fetch(request('/api/demo-community/visits', { method: 'POST', headers: headers('user-security'), body: JSON.stringify({ visitor_name: 'Integration Visitor', visitor_type: 'visitor', host_unit_id: 'unit-a204' }) }), env);
assert.equal(response.status, 201);
const visitId = (await response.json()).data.id;

response = await api.fetch(request('/api/demo-community/visits', { method: 'PATCH', headers: headers('user-security'), body: JSON.stringify({ visit_id: visitId, status: 'checked_in' }) }), env);
assert.equal(response.status, 200);
assert.equal(sqlite.prepare('SELECT status FROM visits WHERE id=?').get(visitId).status, 'checked_in');

response = await api.fetch(request('/api/demo-community/visits', { headers: headers('user-ahmed') }), env);
assert.equal(response.status, 200);
console.log('sqlite integration smoke tests: OK');

