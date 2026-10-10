# API contract v0.6

The first Worker adapter uses `/api/{community_id}/{resource}` paths. Every response is `{ data, error }`, and every request requires an authenticated identity plus community membership.

## Read operations

- `GET /api/{community_id}/units`
- `GET /api/{community_id}/vehicles` — residents receive their own vehicles; operations and security roles receive the operational list.
- `GET /api/{community_id}/parking`
- `GET /api/{community_id}/maintenance-tickets` — residents receive their own tickets.
- `GET /api/{community_id}/announcements` — the information center feed; scheduled items appear only when their time arrives.
- `GET /api/{community_id}/notifications` — current user only.
- `GET /api/{community_id}/notification-preferences` — current user's delivery preferences.
- `GET /api/{community_id}/modules` — operations/admin view module activation states.
- `GET /api/{community_id}/unit-mailbox?unit_id=...` — digital mailbox for an authorized unit.

## Vehicles, access, and permits

- `POST /api/{community_id}/vehicles` — register a vehicle; a resident is always the owner of the new record.
- `POST /api/{community_id}/parking-assignments` — operations/admin assignment with audit event.
- `POST /api/{community_id}/parking-claim` — resident claim of an available `first_come` space after unit-membership validation.
- `POST /api/{community_id}/parking-occupancy` — operations/security/device adapter updates occupied, vacant, or unknown state and receives a red/green/amber indicator.
- `POST /api/{community_id}/permits` — issue a time-bounded permit.
- `POST /api/{community_id}/permit-revoke` — revoke an active permit and record the reason.
- `GET /api/{community_id}/visits` — operational visit list; residents see visits for their units.
- `POST /api/{community_id}/visits` — security/operations register an expected visitor, domestic staff member, delivery, or contractor; linked permits must be active and within their time window.
- `PATCH /api/{community_id}/visits` — security/operations record expected, checked-in, checked-out, or cancelled status.
- `POST /api/{community_id}/gate-check` — allow only when the permit is active, started, and not expired.
- `POST /api/{community_id}/gate-events` — append a gate decision event.

## Maintenance and communication

- `POST /api/{community_id}/maintenance-tickets` — create a ticket.
- `PATCH /api/{community_id}/maintenance-tickets` — update status; residents can update only their own tickets.
- `POST /api/{community_id}/announcements` — publish or schedule an information item and queue notifications for the selected audience and channels.
- `PATCH /api/{community_id}/notifications` — mark a notification read; only its owner can do so.
- `PATCH /api/{community_id}/notification-preferences` — enable or disable a delivery channel for the current user.
- `POST /api/{community_id}/unit-mailbox` — operations/security place a message, document, parcel, registered mail, or notice in a unit mailbox.
- `PATCH /api/{community_id}/unit-mailbox` — authorized users mark an item read, awaiting collection, collected, or archived.
- `GET /api/{community_id}/policies` — operations/admin view policy switches.
- `PATCH /api/{community_id}/policies` — operations/admin enable or disable an approved policy.
- `GET /api/{community_id}/settings` — operations/admin view multi-mode settings.
- `PATCH /api/{community_id}/settings` — operations/admin select an approved access verification mode.
- `PATCH /api/{community_id}/modules` — operations/admin enable, disable, or pilot a module without deleting its data.

When a module is `disabled`, its API routes return `404` while its records remain intact. `pilot` is available for controlled rollout; the current authorization rules still apply.
- `GET /api/{community_id}/commercial-units` — operations/security view tenants and commercial spaces.
- `POST /api/{community_id}/commercial-units` — operations/admin create a tenant space.
- `GET /api/{community_id}/leases` — operations/security view all leases; residents see only leases linked to their user.
- `POST /api/{community_id}/leases` — operations/admin create a lease for a residential or commercial unit, with community or external lessor.
- `GET /api/{community_id}/lease-payments` — view due, paid, late, and waived rent installments; residents see only their linked leases.
- `POST /api/{community_id}/lease-payments` — operations/admin add a monthly or annual installment record.
- `PATCH /api/{community_id}/lease-payments` — operations/admin mark an installment paid, due, late, or waived.
- `GET /api/{community_id}/loading-slots` — operations/security view loading areas.
- `POST /api/{community_id}/loading-bookings` — operations/security create a time-bounded supplier booking.

## Safety rules

- Gate events and audit events are append-only through the client contract.
- Mutations write audit events where applicable.
- Resident list operations are scoped to resident-owned records.
- External RFID/ANPR adapters should translate device events into the gate-event contract rather than bypassing authorization.

Parking records support `parking_type=shared|private`, `allocation_mode=fixed|reservation|first_come`, and `access_control=community|unit_only|none`. A community may assign one or many fixed spaces to a unit, reserve shared spaces, or make them first-come-first-served. Private spaces can therefore bypass shared-parking rules while remaining visible in the inventory and audit model.

Occupancy is separate from assignment. A sensor, camera/ANPR adapter, or gate event can update `occupancy_state`; the display layer can map `vacant` to green, `occupied` to red, and `unknown` to amber. `unknown` is intentionally supported when a sensor is offline or stale.

## Community policy switches

The controls above are configurable per community through `community_policies`. Supported keys are `permit_time_window`, `resident_ownership_scope`, `gate_value_validation`, `resident_vehicle_scope`, and `parking_unit_validation`. A missing key defaults to enabled; administrators may disable selected controls when the community's operating policy calls for a less restrictive mode.

Feature modes that have more than two states use `community_settings`. For example, `access_verification_mode` may be `qr_only`, `tag_only`, `qr_or_tag`, `anpr_only`, or `hybrid`. The demo defaults to `qr_or_tag`; ANPR/camera integration can be added without forcing every community to install cameras.

The reference scheduled reminder implementation is `worker/reminders.js`. It queues one in-app reminder per eligible lease payment and records `reminder_sent_at`; a cron trigger or external scheduler can invoke it and add email, SMS, or WhatsApp adapters.

Lease payments are lightweight operational records: amount, due date, status, and optional payment reference. Reminder delivery can use email, SMS, or WhatsApp adapters; the platform stores reminder timing without forcing one provider.

When a `due` installment passes its due date, the read contract exposes it as `late` without destroying the original record. A scheduled notification worker can select upcoming or late installments, create in-app notifications, and hand delivery to the configured email/SMS/WhatsApp provider.

