# Local validation outside Sites

The first operational slice can be validated without Sites or a live D1 database.

From this directory, run:

```text
npm test
```

The command validates authentication and role checks, the dashboard, vehicles, parking, permits, gate events and manual override policy, maintenance, announcements, notifications, leases, mailboxes, commercial operations, reminder behavior, SQLite/D1 integration, schema portability, and restore viability.

The SQLite integration test executes `database/schema.sql` and `database/seed.sql` in an in-memory SQLite database, then sends real `Request` objects through `worker/api.js`. This is the external recovery path when Sites is unavailable.

For production, apply `database/schema.sql` to a new D1-compatible database, configure the `DB` binding, provide the hosting identity headers, and run the same checks against a controlled demo environment before importing real data.

