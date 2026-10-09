# Community Operations Platform — Product Blueprint v0.3

## Product principle
One extensible operating platform for residential communities. Every module is optional per community, and every record is scoped to a community and governed by role-based access.

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
6. Facilities, activities, bookings and internal service directory.
7. Reports, audit log, settings and bilingual content.

## Non-negotiable behavior
- Every access decision is auditable.
- Temporary permits expire automatically.
- Security has a manual fallback during connectivity issues.
- Residents only see their own unit and permitted community content.
- New modules must not change existing data or permissions.

## First production slice
Community setup → unit/resident record → vehicle/parking record → visitor permit → security check-in/out → maintenance ticket → resident notification.

## Future integrations
RFID/UHF, ANPR cameras, barriers, SMS, WhatsApp Business, payment providers, accounting systems and mobile push notifications. Integrations must be adapter-based so the platform is not tied to one vendor.

