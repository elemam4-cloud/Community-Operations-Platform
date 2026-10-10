# D1 portability and exit plan

D1 is a Cloudflare service, not a ChatGPT-owned data store. The application must remain operable if Sites is unavailable.

## Source of truth

- Schema: `database/schema.sql` and versioned migrations.
- Demo data: `database/seed.sql` only.
- API logic: `worker/api.js`.
- Deployment configuration: `.openai/hosting.json` and the external Worker configuration used by the operator.

## External operation

The database can be created, migrated and exported with Cloudflare Wrangler or the Cloudflare API. The application schema uses portable SQLite-compatible SQL so it can be tested locally and migrated to another SQLite-compatible service. D1-specific bindings are kept at the adapter boundary.

## Required backup routine

1. Before each migration, export the remote D1 database to SQL.
2. Store the export outside Sites, with the release number and UTC timestamp.
3. Apply the migration through a versioned migration file.
4. Run smoke queries and compare row counts for critical tables.
5. Test restoring the export into a clean local SQLite-compatible database.

## Exit path

To leave D1, export schema and data as SQL, provision the target SQLite-compatible database, apply migrations, import the export, update only the database adapter configuration, and run the API smoke tests. No resident-facing feature should depend directly on Sites APIs.

## Prohibited design

- No production records only in browser storage.
- No credentials in source or seed files.
- No vendor-specific access logic embedded in resident workflows.
- No irreversible migration without an export and restore check.

