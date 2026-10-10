# Portable database deployment checklist

This checklist keeps the production database independent from ChatGPT and Sites.

1. Create an empty SQLite-compatible database (Cloudflare D1 for the first hosted deployment).
2. Apply `schema.sql` using the target provider's documented import or migration command.
3. Run the provider's foreign-key and table checks.
4. Apply `seed.sql` only to a disposable demo database.
5. Configure the Worker binding as `DB` and verify the authenticated identity headers.
6. Run `worker/smoke.mjs` against the Worker adapter and perform one manual resident flow.
7. Export the database before every production migration and store the export outside the provider.
8. Record the migration version and test restoration into a fresh database.

The repository is the source of truth for schema and application code. Sites is only a publishing layer; it is not the sole location of data or source code.

