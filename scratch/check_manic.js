const db = require('../database/db');
console.log('manicurista_servicios columns:', db.all('PRAGMA table_info(manicurista_servicios)'));
console.log('manicurista_servicios rows:', db.all('SELECT * FROM manicurista_servicios'));
console.log('servicios rows:', db.all('SELECT id, nombre FROM servicios'));
console.log('usuarios (manicuristas):', db.all('SELECT id, nombre, apellido, email, estado, foto, especialidades_texto FROM usuarios WHERE rol_id = 3'));
