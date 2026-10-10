# Database Release Manifest

## Current baseline

- Platform release: `4.46`
- Schema baseline: `portable-sqlite-d1`
- Canonical schema: `database/schema.sql`
- Demo-only seed: `database/seed.sql`
- API adapter: `worker/api.js`
- Verification commands: `node worker/smoke.mjs` and `node database/verify.mjs`

## Restore contract

1. Create an empty SQLite-compatible database outside Sites.
2. Apply `schema.sql`.
3. Apply `seed.sql` only in a demo environment.
4. Configure the API adapter with the database binding or connection used by the target environment.
5. Run both verification commands.
6. Run `node worker/reminders.smoke.mjs`.
7. Run `node database/sqlite-restore.smoke.mjs`.
8. Run `node worker/sqlite-integration.smoke.mjs`.
9. Confirm that authentication, role scoping, module states, audit events, notifications, leases, and unit mailboxes behave as expected.

The release archive contains the source required to reconstruct the application. Sites is a deployment surface, not the canonical source or backup location.

