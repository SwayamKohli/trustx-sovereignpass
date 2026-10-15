import { db } from '../db/index';
const username = process.argv[2]?.trim().toLowerCase();
if (!username) throw new Error('Usage: npm run admin:grant -- <registered-username>');
const result = db.prepare("UPDATE users SET role = 'ADMIN' WHERE username = ?").run(username);
if (result.changes !== 1) throw new Error('Register this account first; no account was changed.');
console.log(`Administrator role granted to ${username}. Refresh the bank to reload your role.`);
