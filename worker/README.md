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

