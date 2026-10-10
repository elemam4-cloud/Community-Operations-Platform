# Database

`schema.sql` is the portable structural schema. `seed.sql` is demo data only and must never be run against production.

## Safe deployment order

1. Create a new empty database for the target environment.
2. Apply `schema.sql`.
3. Run a read-only table and foreign-key check.
4. Apply `seed.sql` only to a demo environment.
5. Create the first admin through the identity layer, not by hard-coding credentials.
6. Verify backups and restore before importing real residents.

## Production rules

- Never store passwords, access tokens, national IDs, or payment credentials in seed files.
- Use UTC timestamps in storage and render the community timezone in the UI.
- Keep gate and audit events append-only.
- Back up before migrations and record the migration version.

