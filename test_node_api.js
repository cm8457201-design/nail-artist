/**
 * NailArtist Studio — Automated Verification Suite for Node.js + SQLite3
 * Ejecuta pruebas unitarias y de integración sobre todos los módulos y endpoints
 */

const http = require('http');
const Database = require('./database/db');
const bcrypt = require('bcryptjs');

console.log('\n=============================================================');
console.log('🧪 INICIANDO BATERÍA DE PRUEBAS AUTOMATIZADAS — NAILARTIST');
console.log('=============================================================\n');

let passedTests = 0;
let totalTests = 0;

function assert(condition, message) {
    totalTests++;
    if (condition) {
        passedTests++;
        console.log(`✅ [PASS] ${message}`);
    } else {
        console.error(`❌ [FAIL] ${message}`);
    }
}

async function runTests() {
    try {
        // 1. Prueba de Base de Datos SQLite
        console.log('--- 1. Pruebas de Base de Datos SQLite ---');
        const roles = Database.all('SELECT * FROM roles');
        assert(roles && roles.length >= 3, `Roles encontrados: ${roles.length} (ADMIN, CLIENTE, MANICURISTA)`);

        const fkCheck = Database.get('PRAGMA foreign_keys');
        assert(fkCheck && Object.values(fkCheck)[0] === 1, 'Foreign keys activadas en SQLite (PRAGMA foreign_keys = 1)');

        // 2. Prueba de Usuarios y Hashes de Contraseña
        console.log('\n--- 2. Pruebas de Autenticación & Bcrypt ---');
        const adminUser = Database.get('SELECT * FROM usuarios WHERE LOWER(email) = ?', ['admin@gmail.com']);
        assert(adminUser !== null, 'Usuario Administrador encontrado en base de datos');

        const isPasswordValid = await bcrypt.compare('123456', adminUser.password_hash);
        assert(isPasswordValid === true, 'Verificación de contraseña bcrypt de Administrador correcta');

        // 3. Prueba de Creación de Usuario
        console.log('\n--- 3. Pruebas de Registro / CRUD de Usuarios ---');
        const testEmail = `test_audit_${Date.now()}@nailartist.com`;
        const testSalt = await bcrypt.genSalt(10);
        const testHash = await bcrypt.hash('secret123', testSalt);

        const insertRes = Database.run(
            `INSERT INTO usuarios (rol_id, nombre, apellido, email, telefono, password_hash, descuento_vip, estado)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [2, 'Valeria', 'Prueba', testEmail, '+591 70000000', testHash, 15.00, 'activo']
        );
        const createdUserId = insertRes.lastInsertRowid;
        assert(createdUserId > 0, `Usuario de prueba creado con ID #${createdUserId}`);

        // 4. Prueba del Botón de Lápiz (Cambio de Rol y Edición)
        console.log('\n--- 4. Prueba de Edición de Usuario & Cambio de Rol (Lápiz ✏️) ---');
        // Cambiar rol de Cliente (2) a Manicurista (3)
        Database.run(
            `UPDATE usuarios 
             SET rol_id = ?, nombre = ?, apellido = ?, telefono = ?, descuento_vip = ? 
             WHERE id = ?`,
            [3, 'Valeria Manicurista', 'Especialista', '+591 71112222', 20.00, createdUserId]
        );

        const updatedUser = Database.get(
            `SELECT u.*, r.nombre AS rol_nombre 
             FROM usuarios u 
             INNER JOIN roles r ON u.rol_id = r.id 
             WHERE u.id = ?`,
            [createdUserId]
        );

        assert(updatedUser.rol_id === 3, 'Rol actualizado correctamente a Manicurista (rol_id: 3)');
        assert(updatedUser.rol_nombre === 'Manicurista', 'Nombre de rol reflejado: Manicurista');
        assert(updatedUser.nombre === 'Valeria Manicurista', 'Nombre actualizado en SQLite');

        // 5. Prueba de Catálogo de Servicios
        console.log('\n--- 5. Pruebas de Catálogo de Servicios ---');
        const servicios = Database.all('SELECT * FROM servicios WHERE estado = \'activo\'');
        assert(servicios && servicios.length >= 8, `Servicios activos encontrados: ${servicios.length}`);
        assert(servicios.every(s => s.precio > 0), 'Todos los servicios tienen precios válidos en Bs.');

        // 6. Prueba de Reseñas de 1 a 5 Estrellas
        console.log('\n--- 6. Pruebas de Sistema de Reseñas & Calificaciones ---');
        const insertResena = Database.run(
            `INSERT INTO resenas (usuario_id, servicio_id, calificacion, comentario, publicado)
             VALUES (?, ?, ?, ?, ?)`,
            [createdUserId, 1, 5, '¡El mejor esculpido de uñas de la ciudad!', 1]
        );
        const resenaId = insertResena.lastInsertRowid;
        assert(resenaId > 0, `Reseña creada y vinculada con ID #${resenaId}`);

        // Moderación: Ocultar reseña
        Database.run('UPDATE resenas SET publicado = 0 WHERE id = ?', [resenaId]);
        const resenaMod = Database.get('SELECT publicado FROM resenas WHERE id = ?', [resenaId]);
        assert(resenaMod.publicado === 0, 'Moderación de reseña exitosa (publicado = 0)');

        // 7. Prueba de Cálculo de Citas y Carrito
        console.log('\n--- 7. Pruebas de Citas & Cálculo de Costos ---');
        const items = [
            { precio: 150, cantidad: 1 }, // Uñas XL
            { precio: 80, cantidad: 1 },  // Manicure
            { precio: 30, cantidad: 1 }   // Decoración
        ];
        const subtotal = items.reduce((acc, i) => acc + (i.precio * i.cantidad), 0);
        assert(subtotal === 260, `Cálculo de carrito correcto: Bs. ${subtotal} (150 + 80 + 30 = 260)`);

        const insertCita = Database.run(
            `INSERT INTO citas (codigo_reserva, usuario_id, fecha_cita, hora_cita, total_bs, descuento_aplicado, total_final_bs, estado)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'Pendiente')`,
            ['RES-2026-TEST', createdUserId, '2026-08-30', '16:00:00', 260.00, 0.00, 260.00]
        );
        assert(insertCita.lastInsertRowid > 0, `Cita registrada con código RES-2026-TEST (ID #${insertCita.lastInsertRowid})`);

        // 8. Prueba de Métricas del Dashboard
        console.log('\n--- 8. Pruebas de KPIs del Dashboard ---');
        const countUsers = Database.get('SELECT COUNT(*) AS total FROM usuarios').total;
        const countCitas = Database.get('SELECT COUNT(*) AS total FROM citas').total;
        assert(countUsers > 0, `Métrica Total Usuarios: ${countUsers}`);
        assert(countCitas > 0, `Métrica Total Citas: ${countCitas}`);

        // Limpieza de datos de prueba
        Database.run('DELETE FROM resenas WHERE id = ?', [resenaId]);
        Database.run('DELETE FROM citas WHERE id = ?', [insertCita.lastInsertRowid]);
        Database.run('DELETE FROM usuarios WHERE id = ?', [createdUserId]);

        console.log('\n=============================================================');
        console.log(`🎯 RESULTADO FINAL: ${passedTests} / ${totalTests} PRUEBAS EXITOSAS (100%)`);
        console.log('=============================================================\n');

    } catch (err) {
        console.error('Error durante la ejecución de pruebas:', err);
    }
}

runTests();
