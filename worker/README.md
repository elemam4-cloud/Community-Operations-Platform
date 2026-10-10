# API worker

`api.js` is the first server-side implementation of the platform contract. It expects a D1 binding named `DB`, uses the platform's authenticated-user headers, enforces community membership and role checks, and writes audit events for mutations.

Supported first slice:

- `GET /api/{community_id}/units`
- `GET /api/{community_id}/vehicles`
- `POST /api/{community_id}/permits`
- `GET /api/{community_id}/maintenance-tickets`
- `POST /api/{community_id}/maintenance-tickets`
- `PATCH /api/{community_id}/maintenance-tickets`
- `GET /api/{community_id}/announcements`
- `POST /api/{community_id}/announcements`
- `POST /api/{community_id}/permit-revoke`

The worker deliberately returns a clear `503` when the Site has no database binding. This prevents accidental fallback to an unprotected or in-memory production store.

`reminders.js` provides a provider-neutral scheduled job for upcoming and overdue lease payments. It queues an in-app notification once per payment and records `reminder_sent_at`; an external scheduler can invoke it and add email, SMS, or WhatsApp adapters without changing lease data.

## External deployment

Copy `wrangler.example.toml` to a private deployment workspace, replace the D1 database ID, apply `../database/schema.sql`, and deploy the Worker with the provider's authenticated CLI. Keep the real `wrangler.toml`, database exports, and secrets outside the public repository.

