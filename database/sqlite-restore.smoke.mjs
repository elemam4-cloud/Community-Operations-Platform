import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';

const db = new DatabaseSync(':memory:');
db.exec(fs.readFileSync(new URL('./schema.sql', import.meta.url), 'utf8'));
db.exec(fs.readFileSync(new URL('./seed.sql', import.meta.url), 'utf8'));
const tables = db.prepare("SELECT type,name FROM sqlite_master").all().filter(row => row.type === 'table' && !row.name.startsWith('sqlite_'));
if (tables.length !== 26) throw new Error(`expected 26 tables, found ${tables.length}`);
const units = db.prepare('SELECT count(*) AS count FROM units').get().count;
const users = db.prepare('SELECT count(*) AS count FROM users').get().count;
if (units < 1 || users < 1) throw new Error('seed data was not restored');
console.log(`sqlite restore validation: OK (${tables.length} tables, ${units} units, ${users} users)`);

