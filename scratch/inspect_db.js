const fs = require('fs');
const path = require('path');

// Backup SQLite DB
const backupName = `nailartist_backup_${Date.now()}.db`;
fs.copyFileSync(
    path.join(__dirname, '..', 'nailartist.db'),
    path.join(__dirname, '..', backupName)
);
console.log(`Backup created: ${backupName}`);

const db = require('../database/db');

console.log('--- TABLES ---');
console.log(db.all("SELECT name FROM sqlite_master WHERE type='table'"));

console.log('\n--- PRAGMA table_info(usuarios) ---');
console.log(db.all("PRAGMA table_info(usuarios)"));

console.log('\n--- PRAGMA table_info(citas) ---');
console.log(db.all("PRAGMA table_info(citas)"));

console.log('\n--- ROLES ---');
console.log(db.all("SELECT * FROM roles"));

console.log('\n--- MANICURISTAS EN BD ---');
console.log(db.all("SELECT * FROM usuarios WHERE rol_id = 3"));
