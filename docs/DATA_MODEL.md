# Data model v0.4

## Entity relationships

```text
Community
  ├─ Buildings ── Units ── Residents
  ├─ ParkingSpaces ── Vehicles ── Residents
  ├─ AccessPoints ── GateEvents
  ├─ Permits ── Visitors / ServiceProviders
  ├─ MaintenanceTickets ── Units / Residents / Providers
  ├─ Facilities ── Bookings ── Residents
  └─ Announcements ── Notifications ── Users
```

## Required identifiers

- `community_id` scopes every operational record.
- `user_id` identifies a person and their roles.
- `unit_id` identifies the home or commercial unit.
- `vehicle_id` identifies a vehicle independently of its owner.
- `permit_id` identifies a time-bounded access permission.
- `event_id` identifies an immutable gate or audit event.

## Important rules

- A vehicle may have more than one authorized driver, but one primary unit relationship.
- A permit always has an issuer, purpose, start time, expiry time and status.
- A gate event is append-only; corrections are recorded as new audit events.
- A maintenance ticket keeps its complete status history and assignment history.
- Notifications store channel, delivery status and read timestamp.
- Soft deletion is used for operational records; historical audit records are never deleted through the UI.

## Role matrix

| Area | Admin | Operations | Security | Resident | Provider |
|---|---|---|---|---|---|
| Residents/units | Full | Manage | View limited | Own unit | None |
| Vehicles/parking | Full | Manage | Check | Own vehicles | None |
| Permits/gates | Full | Manage | Issue/check | Request | Assigned only |
| Maintenance | Full | Assign/close | View | Create/track | Assigned work |
| Announcements | Full | Publish | Read | Read | Targeted read |
| Audit/reports | Full | Operational | Gate only | Own activity | Own work |

## First database slice

`communities`, `buildings`, `units`, `users`, `unit_memberships`, `vehicles`, `parking_spaces`, `permits`, `gate_events`, `maintenance_tickets`, `notifications`, `audit_events`.

