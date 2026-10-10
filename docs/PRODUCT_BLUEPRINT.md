# Community Operations Platform — Product Blueprint v0.4

## Product principle
One extensible operating platform for residential communities, commercial centers, mixed-use sites, and managed campuses. Every module is optional per site, and every record is scoped to a community and governed by role-based access.

## Core roles
- Community owner/admin: configuration, users, reports, policies.
- Operations manager: residents, services, facilities, announcements.
- Security officer: gates, vehicles, permits, visitor check-in/out.
- Resident: own unit, vehicles, permits, maintenance requests, bookings, messages.
- Service provider: assigned work orders and approved entry permits.

## Core modules
1. Communities, buildings, units, residents.
2. Vehicles, parking spaces, access devices and gate events.
3. Permits for residents, visitors, domestic staff, maintenance and deliveries.
4. Maintenance tickets with priority, assignment, SLA, attachments and rating.
5. Announcements and notification delivery preferences.
6. Information center, audience-targeted notices, scheduled events, and unit digital mailboxes.
7. Lease contracts, installment schedules, lightweight claims/receipts, and overdue reminders.
8. Facilities, activities, bookings and internal service directory.
9. Reports, audit log, settings and bilingual content.

## Optional commercial module

- Commercial units, tenants, categories and lease status.
- Loading zones and reservable delivery slots.
- Supplier, contractor and vehicle permits can reuse the core permit and gate model.
- The module remains disabled for communities that do not need it.

## Integrated operating model

- A unit is the common anchor for residents, tenants, vehicles, parking, leases, maintenance, permits, messages, and mailbox items.
- A commercial unit follows the same operating model while adding tenant, category, loading, and lease capabilities.
- The information center is the common communication hub; announcements can target all users, residents, staff, security, or providers and can be delivered through selected channels.
- Lease tracking is operational, not general ledger accounting: the platform records contract metadata, due installments, payment status, receipts/references, and reminders. Full accounting, tax, invoicing, and payment gateways remain optional adapters/modules.
- Every feature has a configurable enforcement level where real communities differ: strict, relaxed, manual fallback, or disabled.

## Non-negotiable behavior
- Every access decision is auditable.
- Temporary permits expire automatically.
- Security has a manual fallback during connectivity issues.
- Residents only see their own unit and permitted community content.
- New modules must not change existing data or permissions.

## First production slice
Community setup → unit/resident record → vehicle/parking record → visitor permit → security check-in/out → maintenance ticket → information-center notification → unit mailbox.

## Future integrations
RFID/UHF, ANPR cameras, barriers, SMS, WhatsApp Business, payment providers, accounting systems and mobile push notifications. Integrations must be adapter-based so the platform is not tied to one vendor.
# Deployment scope

The core is property-type neutral. A community can be residential, commercial, mixed-use, campus, or another managed site. Residents, tenants, visitors, vehicles, parking, permits, maintenance, announcements, notifications, and audit trails are shared primitives; property-specific modules are enabled through configuration rather than hard-coded into every workflow.


