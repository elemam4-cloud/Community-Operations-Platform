# API contract v0.6

The first Worker adapter uses `/api/{community_id}/{resource}` paths. Every response is `{ data, error }`, and every request requires an authenticated identity plus community membership.

## Read operations

- `GET /api/{community_id}/units`
- `GET /api/{community_id}/vehicles` — residents receive their own vehicles; operations and security roles receive the operational list.
- `GET /api/{community_id}/parking`
- `GET /api/{community_id}/maintenance-tickets` — residents receive their own tickets.
- `GET /api/{community_id}/announcements`
- `GET /api/{community_id}/notifications` — current user only.

## Vehicles, access, and permits

- `POST /api/{community_id}/vehicles` — register a vehicle; a resident is always the owner of the new record.
- `POST /api/{community_id}/parking-assignments` — operations/admin assignment with audit event.
- `POST /api/{community_id}/permits` — issue a time-bounded permit.
- `POST /api/{community_id}/permit-revoke` — revoke an active permit and record the reason.
- `POST /api/{community_id}/gate-check` — allow only when the permit is active, started, and not expired.
- `POST /api/{community_id}/gate-events` — append a gate decision event.

## Maintenance and communication

- `POST /api/{community_id}/maintenance-tickets` — create a ticket.
- `PATCH /api/{community_id}/maintenance-tickets` — update status; residents can update only their own tickets.
- `POST /api/{community_id}/announcements` — publish and queue in-app notifications for active users.
- `PATCH /api/{community_id}/notifications` — mark a notification read; only its owner can do so.

## Safety rules

- Gate events and audit events are append-only through the client contract.
- Mutations write audit events where applicable.
- Resident list operations are scoped to resident-owned records.
- External RFID/ANPR adapters should translate device events into the gate-event contract rather than bypassing authorization.

## Community policy switches

The controls above are configurable per community through `community_policies`. Supported keys are `permit_time_window`, `resident_ownership_scope`, `gate_value_validation`, `resident_vehicle_scope`, and `parking_unit_validation`. A missing key defaults to enabled; administrators may disable selected controls when the community's operating policy calls for a less restrictive mode.

