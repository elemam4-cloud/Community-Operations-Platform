# API contract v0.5

All endpoints are scoped by `community_id` and require an authenticated user. Responses use a stable envelope: `{ data, error, meta }`.

## Residents and units

- `GET /communities/{community_id}/units?search=` — searchable units.
- `POST /communities/{community_id}/units` — create a unit.
- `GET /communities/{community_id}/residents?unit_id=` — list residents.
- `POST /communities/{community_id}/residents` — create a resident membership.

## Vehicles and parking

- `GET /communities/{community_id}/vehicles?status=` — list vehicles.
- `POST /communities/{community_id}/vehicles` — register a vehicle.
- `POST /communities/{community_id}/parking/assign` — assign a parking space.
- `GET /communities/{community_id}/parking/availability` — available spaces.

## Permits and access

- `POST /communities/{community_id}/permits` — issue a time-bounded permit.
- `POST /communities/{community_id}/permits/{permit_id}/revoke` — revoke a permit.
- `POST /communities/{community_id}/gate-events/check` — check a person/vehicle.
- `POST /communities/{community_id}/gate-events` — append a gate event.

## Maintenance and communication

- `POST /communities/{community_id}/maintenance-tickets` — create a ticket.
- `PATCH /communities/{community_id}/maintenance-tickets/{ticket_id}` — update status or assignment.
- `POST /communities/{community_id}/announcements` — publish a notice.
- `GET /communities/{community_id}/notifications` — list notifications for the current user.
- `POST /notifications/{notification_id}/read` — mark as read.

## Safety rules

- Permit creation validates expiry, unit access and issuer role.
- Gate events are append-only and cannot be edited through the client.
- Every mutation writes an audit event.
- List endpoints paginate and never return unrestricted personal data.
- Integration adapters translate external RFID/ANPR events into the same gate-event contract.

