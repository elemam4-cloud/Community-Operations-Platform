# Community Operations Platform — First Operational Runbook

## 1. Community setup

1. Create the community and choose `residential`, `commercial`, `mixed_use`, or `campus`.
2. Create buildings, residential units, and/or commercial units.
3. Activate only the modules required by the site.
4. Create administrators, operations users, security users, residents, and providers through the identity layer.
5. Confirm the community policies and access verification mode.

## 2. Resident and tenant onboarding

1. Create or import the person record.
2. Link the person to a unit with the appropriate membership type.
3. Register vehicles and access tags when applicable.
4. Add a lease and installment schedule when the unit is rented.
5. Confirm the person's notification channel preferences.

## 3. Daily access operations

1. A resident, visitor, staff member, provider, or delivery vehicle receives an appropriate permit.
2. Security checks the permit and records entry or exit.
3. The system validates time, ownership, and policy rules according to the community configuration.
4. Manual fallback remains available when an external device or network is unavailable.

## 4. Parking operations

1. Define shared, private, or unit-only spaces.
2. Choose fixed, reservation, or first-come allocation.
3. Assign spaces or allow a validated resident claim.
4. Receive occupancy updates from staff, sensors, or camera adapters.
5. Display vacant, occupied, or unknown status without changing ownership data.

## 5. Maintenance and communication

1. A resident or operations user creates a ticket.
2. Operations assigns the ticket and tracks status history.
3. The information center publishes an announcement, alert, event, or maintenance notice.
4. The selected audience receives in-app notifications through its enabled channels.
5. Messages, documents, parcels, and registered mail can be placed in the unit mailbox.

## 6. Lease and payment operations

1. Create a lease for a residential or commercial unit.
2. Add monthly or annual installment records.
3. Mark installments due, paid, late, or waived.
4. Run the reminder job for upcoming and overdue installments.
5. Add external delivery providers only at the notification adapter boundary.

## 7. Safety and recovery

- Every mutation must remain auditable.
- Module disablement hides routes without deleting records.
- Export the database before migrations.
- Run the Worker, reminder, and portability checks before each release.
- Keep production credentials and provider secrets outside the repository and Sites.

