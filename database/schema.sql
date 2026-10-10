-- Community Operations Platform — initial portable schema
-- Designed for SQLite/D1-compatible deployment; IDs are application-generated UUIDs.

PRAGMA foreign_keys = ON;

CREATE TABLE communities (id TEXT PRIMARY KEY, name TEXT NOT NULL, community_type TEXT NOT NULL DEFAULT 'residential', timezone TEXT NOT NULL DEFAULT 'Africa/Cairo', default_language TEXT NOT NULL DEFAULT 'ar', created_at TEXT NOT NULL);
CREATE TABLE community_policies (community_id TEXT NOT NULL REFERENCES communities(id), policy_key TEXT NOT NULL, enabled INTEGER NOT NULL DEFAULT 1, PRIMARY KEY(community_id, policy_key));
CREATE TABLE community_settings (community_id TEXT NOT NULL REFERENCES communities(id), setting_key TEXT NOT NULL, setting_value TEXT NOT NULL, PRIMARY KEY(community_id, setting_key));
CREATE TABLE commercial_units (id TEXT PRIMARY KEY, community_id TEXT NOT NULL REFERENCES communities(id), code TEXT NOT NULL, tenant_name TEXT NOT NULL, category TEXT, status TEXT NOT NULL DEFAULT 'active', lease_start TEXT, lease_end TEXT, UNIQUE(community_id, code));
CREATE TABLE leases (id TEXT PRIMARY KEY, community_id TEXT NOT NULL REFERENCES communities(id), subject_type TEXT NOT NULL, subject_id TEXT NOT NULL, lessor_name TEXT NOT NULL, lessor_type TEXT NOT NULL DEFAULT 'community_owner', lessee_name TEXT NOT NULL, lessee_user_id TEXT REFERENCES users(id), starts_at TEXT NOT NULL, ends_at TEXT, status TEXT NOT NULL DEFAULT 'active', rent_amount REAL, rent_currency TEXT NOT NULL DEFAULT 'EGP', created_at TEXT NOT NULL);
CREATE TABLE loading_slots (id TEXT PRIMARY KEY, community_id TEXT NOT NULL REFERENCES communities(id), code TEXT NOT NULL, zone TEXT, booking_mode TEXT NOT NULL DEFAULT 'reservation', status TEXT NOT NULL DEFAULT 'active', UNIQUE(community_id, code));
CREATE TABLE loading_bookings (id TEXT PRIMARY KEY, community_id TEXT NOT NULL REFERENCES communities(id), loading_slot_id TEXT NOT NULL REFERENCES loading_slots(id), commercial_unit_id TEXT REFERENCES commercial_units(id), carrier_name TEXT NOT NULL, vehicle_plate TEXT, starts_at TEXT NOT NULL, ends_at TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'requested', created_by TEXT NOT NULL REFERENCES users(id), created_at TEXT NOT NULL);
CREATE TABLE users (id TEXT PRIMARY KEY, community_id TEXT NOT NULL REFERENCES communities(id), full_name TEXT NOT NULL, phone TEXT, email TEXT, status TEXT NOT NULL DEFAULT 'active', created_at TEXT NOT NULL);
CREATE TABLE user_roles (user_id TEXT NOT NULL REFERENCES users(id), role TEXT NOT NULL, PRIMARY KEY(user_id, role));
CREATE TABLE buildings (id TEXT PRIMARY KEY, community_id TEXT NOT NULL REFERENCES communities(id), name TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE units (id TEXT PRIMARY KEY, community_id TEXT NOT NULL REFERENCES communities(id), building_id TEXT REFERENCES buildings(id), code TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'active', UNIQUE(community_id, code));
CREATE TABLE unit_memberships (unit_id TEXT NOT NULL REFERENCES units(id), user_id TEXT NOT NULL REFERENCES users(id), membership_type TEXT NOT NULL DEFAULT 'resident', is_primary INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(unit_id, user_id));
CREATE TABLE vehicles (id TEXT PRIMARY KEY, community_id TEXT NOT NULL REFERENCES communities(id), primary_user_id TEXT REFERENCES users(id), plate_number TEXT NOT NULL, access_tag TEXT, status TEXT NOT NULL DEFAULT 'active', UNIQUE(community_id, plate_number));
CREATE TABLE parking_spaces (id TEXT PRIMARY KEY, community_id TEXT NOT NULL REFERENCES communities(id), code TEXT NOT NULL, zone TEXT, parking_type TEXT NOT NULL DEFAULT 'shared', allocation_mode TEXT NOT NULL DEFAULT 'fixed', assigned_unit_id TEXT REFERENCES units(id), access_control TEXT NOT NULL DEFAULT 'community', status TEXT NOT NULL DEFAULT 'available', occupancy_state TEXT NOT NULL DEFAULT 'unknown', occupancy_source TEXT NOT NULL DEFAULT 'manual', sensor_ref TEXT, last_observed_at TEXT, UNIQUE(community_id, code));
CREATE TABLE permits (id TEXT PRIMARY KEY, community_id TEXT NOT NULL REFERENCES communities(id), issued_by TEXT NOT NULL REFERENCES users(id), unit_id TEXT REFERENCES units(id), vehicle_id TEXT REFERENCES vehicles(id), subject_name TEXT NOT NULL, permit_type TEXT NOT NULL, starts_at TEXT NOT NULL, expires_at TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'active', created_at TEXT NOT NULL);
CREATE TABLE gate_events (id TEXT PRIMARY KEY, community_id TEXT NOT NULL REFERENCES communities(id), permit_id TEXT REFERENCES permits(id), vehicle_id TEXT REFERENCES vehicles(id), gate_name TEXT NOT NULL, direction TEXT NOT NULL, decision TEXT NOT NULL, captured_at TEXT NOT NULL, source TEXT NOT NULL DEFAULT 'manual');
CREATE TABLE maintenance_tickets (id TEXT PRIMARY KEY, community_id TEXT NOT NULL REFERENCES communities(id), unit_id TEXT REFERENCES units(id), requester_id TEXT NOT NULL REFERENCES users(id), assigned_to TEXT REFERENCES users(id), title TEXT NOT NULL, description TEXT, priority TEXT NOT NULL DEFAULT 'normal', status TEXT NOT NULL DEFAULT 'open', created_at TEXT NOT NULL, closed_at TEXT);
CREATE TABLE ticket_history (id TEXT PRIMARY KEY, ticket_id TEXT NOT NULL REFERENCES maintenance_tickets(id), changed_by TEXT NOT NULL REFERENCES users(id), from_status TEXT, to_status TEXT NOT NULL, note TEXT, changed_at TEXT NOT NULL);
CREATE TABLE announcements (id TEXT PRIMARY KEY, community_id TEXT NOT NULL REFERENCES communities(id), author_id TEXT NOT NULL REFERENCES users(id), title TEXT NOT NULL, body TEXT NOT NULL, audience TEXT NOT NULL DEFAULT 'all', published_at TEXT, created_at TEXT NOT NULL);
CREATE TABLE notifications (id TEXT PRIMARY KEY, community_id TEXT NOT NULL REFERENCES communities(id), user_id TEXT NOT NULL REFERENCES users(id), announcement_id TEXT REFERENCES announcements(id), channel TEXT NOT NULL DEFAULT 'in_app', delivery_status TEXT NOT NULL DEFAULT 'pending', read_at TEXT, created_at TEXT NOT NULL);
CREATE TABLE audit_events (id TEXT PRIMARY KEY, community_id TEXT NOT NULL REFERENCES communities(id), actor_user_id TEXT REFERENCES users(id), action TEXT NOT NULL, entity_type TEXT NOT NULL, entity_id TEXT NOT NULL, metadata_json TEXT, created_at TEXT NOT NULL);

CREATE INDEX idx_users_community ON users(community_id);
CREATE INDEX idx_permits_expiry ON permits(community_id, expires_at, status);
CREATE INDEX idx_gate_events_time ON gate_events(community_id, captured_at);
CREATE INDEX idx_tickets_status ON maintenance_tickets(community_id, status, priority);
CREATE INDEX idx_notifications_user ON notifications(user_id, read_at);
CREATE INDEX idx_leases_subject ON leases(community_id, subject_type, subject_id, status);
CREATE INDEX idx_leases_lessee ON leases(community_id, lessee_user_id, status);

