import assert from 'node:assert/strict';
import { processLeaseReminders } from './reminders.js';

class ReminderDB {
  constructor() { this.calls = []; }
  prepare(sql) {
    const self = this;
    return {
      bind(...args) {
        return {
          all: async () => ({ results: [{ id: 'payment-1', community_id: 'demo-community', due_date: '2026-10-11', amount: 15000, currency: 'EGP', status: 'due', user_id: 'user-ahmed' }] }),
          run: async () => { self.calls.push({ sql, args }); return { success: true }; }
        };
      }
    };
  }
}

const db = new ReminderDB();
const result = await processLeaseReminders(db, new Date('2026-10-10T08:00:00Z'), 3);
assert.deepEqual(result, { queued: 1, scanned: 1 });
assert.ok(db.calls.some(call => call.sql.includes('INSERT INTO notifications')));
assert.ok(db.calls.some(call => call.sql.includes('UPDATE lease_payments')));
console.log('reminder smoke tests: OK');

