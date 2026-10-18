const Database = require('../database/db');
const users = Database.all('SELECT id, email, password_hash FROM usuarios');
console.log(users);
