const Database = require('../database/db');
const bcrypt = require('bcryptjs');

const manicuristas = Database.all('SELECT id, nombre, email, password_hash FROM usuarios WHERE rol_id = 3');
console.log('Manicuristas in DB:', manicuristas.map(m => ({ id: m.id, nombre: m.nombre, email: m.email })));

for (const m of manicuristas) {
    const is123456 = bcrypt.compareSync('123456', m.password_hash);
    const isPass123 = bcrypt.compareSync('password123', m.password_hash);
    const isCli123 = bcrypt.compareSync('cliente123', m.password_hash);
    console.log(`Manicurista ${m.email}: 123456=${is123456}, password123=${isPass123}, cliente123=${isCli123}`);
}
