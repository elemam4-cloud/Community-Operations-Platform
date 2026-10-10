import fs from "node:fs";
import assert from "node:assert/strict";

const schema = fs.readFileSync(new URL("./schema.sql", import.meta.url), "utf8");
const seed = fs.readFileSync(new URL("./seed.sql", import.meta.url), "utf8");
const requiredTables = [
  "communities", "community_policies", "community_settings", "community_modules", "commercial_units", "leases", "lease_payments", "loading_slots", "loading_bookings", "users", "user_roles", "units", "unit_memberships",
  "vehicles", "parking_spaces", "permits", "visits", "gate_events",
  "maintenance_tickets", "ticket_history", "announcements",
  "notifications", "notification_preferences", "unit_mail_items", "audit_events"
];
for (const table of requiredTables) {
  assert.match(schema, new RegExp(`CREATE TABLE ${table}\\s`, "i"), `missing table: ${table}`);
}
assert.match(schema, /PRAGMA foreign_keys = ON/i);
assert.match(schema, /community_type TEXT NOT NULL/i);
assert.match(seed, /INSERT INTO communities/i);
assert.match(seed, /INSERT INTO users/i);
assert.match(seed, /INSERT INTO user_roles/i);
assert.match(schema, /parking_type TEXT NOT NULL/i);
assert.match(schema, /allocation_mode TEXT NOT NULL/i);
assert.match(schema, /occupancy_state TEXT NOT NULL/i);
assert.match(seed, /'private'/i);
assert.doesNotMatch(seed, /password|access_token|national.?id|payment.?credential/i);
console.log(`database portability checks: OK (${requiredTables.length} tables)`);

