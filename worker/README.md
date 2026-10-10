# API worker

`api.js` is the first server-side implementation of the platform contract. It expects a D1 binding named `DB`, uses the platform's authenticated-user headers, enforces community membership and role checks, and writes audit events for mutations.

Supported first slice:

- `GET /api/{community_id}/units`
- `GET /api/{community_id}/vehicles`
- `GET /api/{community_id}/parking`
- `POST /api/{community_id}/parking-assignments`
- `POST /api/{community_id}/parking-claim`
- `POST /api/{community_id}/parking-occupancy`
- `POST /api/{community_id}/permits`
- `POST /api/{community_id}/gate-check`
- `POST /api/{community_id}/gate-events`
- `GET /api/{community_id}/maintenance-tickets`
- `POST /api/{community_id}/maintenance-tickets`
- `PATCH /api/{community_id}/maintenance-tickets`
- `GET /api/{community_id}/announcements`
- `POST /api/{community_id}/announcements`
- `POST /api/{community_id}/permit-revoke`
- `GET/POST/PATCH /api/{community_id}/visits`
- `GET/PATCH /api/{community_id}/notifications`
- `GET/PATCH /api/{community_id}/notification-preferences`
- `GET/PATCH /api/{community_id}/modules`
- `GET/POST /api/{community_id}/leases`
- `GET/POST/PATCH /api/{community_id}/lease-payments`
- `GET/POST/PATCH /api/{community_id}/unit-mailbox`
- `GET/POST /api/{community_id}/commercial-units`
- `GET /api/{community_id}/loading-slots`
- `POST /api/{community_id}/loading-bookings`

The worker deliberately returns a clear `503` when the Site has no database binding. This prevents accidental fallback to an unprotected or in-memory production store.

`reminders.js` provides a provider-neutral scheduled job for upcoming and overdue lease payments. It queues an in-app notification once per payment and records `reminder_sent_at`; an external scheduler can invoke it and add email, SMS, or WhatsApp adapters without changing lease data.

## External deployment

Copy `wrangler.example.toml` to a private deployment workspace, replace the D1 database ID, apply `../database/schema.sql`, and deploy the Worker with the provider's authenticated CLI. Keep the real `wrangler.toml`, database exports, and secrets outside the public repository.

