const http = require('http');
const assert = require('assert');
const path = require('path');
const fs = require('fs');

// Iniciar servidor
require('../server.js');

const PORT = process.env.PORT || 3000;

function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function request(options, body = null, cookie = '') {
    return new Promise((resolve, reject) => {
        const reqOpts = {
            hostname: 'localhost',
            port: PORT,
            path: options.path,
            method: options.method || 'GET',
            headers: {
                'Content-Type': 'application/json',
                ...(cookie ? { 'Cookie': cookie } : {}),
                ...(options.headers || {})
            }
        };

        const req = http.request(reqOpts, (res) => {
            let data = '';
            const setCookie = res.headers['set-cookie'] ? res.headers['set-cookie'][0].split(';')[0] : '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = data ? JSON.parse(data) : {};
                    resolve({ status: res.statusCode, body: parsed, cookie: setCookie || cookie, raw: data });
                } catch (e) {
                    resolve({ status: res.statusCode, raw: data, cookie: setCookie || cookie });
                }
            });
        });

        req.on('error', reject);
        if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body));
        req.end();
    });
}

async function runTests() {
    await wait(600);
    console.log('🧪 INICIANDO PRUEBAS DEL SISTEMA DE MANICURISTAS & FOTOS DE PERFIL...\n');

    // 1. Iniciar sesión como administrador
    console.log('1. Login de Administrador...');
    const adminLogin = await request({ path: '/api/auth/login', method: 'POST' }, {
        email: 'admin@gmail.com',
        password: '123456'
    });
    assert.strictEqual(adminLogin.status, 200, 'Login admin exitoso');
    const adminCookie = adminLogin.cookie;
    console.log('✅ Admin autenticado');

    // 2. Probar endpoint público /api/servicios/meta/manicuristas
    console.log('\n2. GET /api/servicios/meta/manicuristas (Público)...');
    const pubMeta = await request({ path: '/api/servicios/meta/manicuristas', method: 'GET' });
    assert.strictEqual(pubMeta.status, 200, 'Endpoint público responde 200');
    assert.strictEqual(pubMeta.body.success, true);
    assert(Array.isArray(pubMeta.body.data), 'Retorna lista de manicuristas');
    console.log(`✅ ${pubMeta.body.data.length} manicuristas activas obtenidas públicamente`);
    const firstM = pubMeta.body.data[0];
    console.log(`   Ejemplo: ${firstM.nombre} ${firstM.apellido} - Cargo: "${firstM.cargo_especialidad}" - Foto: ${firstM.foto_perfil || 'null (fallback initials)'}`);

    // 3. Probar subida de fotografía de perfil
    console.log('\n3. POST /api/admin/manicuristas/upload-foto...');
    // Base64 sample 1x1 transparent PNG / dummy image
    const sampleBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const uploadRes = await request({ path: '/api/admin/manicuristas/upload-foto', method: 'POST' }, {
        imagen_base64: sampleBase64,
        nombre_manicurista: 'Valeria-Test'
    }, adminCookie);
    assert.strictEqual(uploadRes.status, 200, 'Subida de imagen responde 200');
    assert.strictEqual(uploadRes.body.success, true);
    assert(uploadRes.body.foto_url && uploadRes.body.foto_url.startsWith('/images/manicuristas/'), 'Ruta pública devuelta');
    console.log(`✅ Foto subida exitosamente: ${uploadRes.body.foto_url}`);

    // 4. Crear nueva manicurista con fotografía
    console.log('\n4. POST /api/admin/manicuristas (Crear manicurista)...');
    const newManiEmail = `test_mani_${Date.now()}@nailartist.com`;
    const createRes = await request({ path: '/api/admin/manicuristas', method: 'POST' }, {
        nombre: 'Carolina',
        apellido: 'Mendez',
        email: newManiEmail,
        telefono: '+591 72345678',
        password: 'password123',
        foto_perfil: uploadRes.body.foto_url,
        cargo_especialidad: 'Master en Acrílico & Estructuras Coffin',
        descripcion: 'Especialista con 6 años de trayectoria profesional en esculpido y encapsulados.',
        experiencia_anios: 6,
        estado: 'activo',
        servicios_ids: [1, 2, 4]
    }, adminCookie);
    assert.strictEqual(createRes.status, 201, 'Manicurista creada responde 201');
    assert.strictEqual(createRes.body.success, true);
    const createdId = createRes.body.data.id;
    console.log(`✅ Manicurista creada con ID #${createdId}`);

    // 5. Consultar detalle de la manicurista creada
    console.log('\n5. GET /api/admin/manicuristas/:id...');
    const detailRes = await request({ path: `/api/admin/manicuristas/${createdId}`, method: 'GET' }, null, adminCookie);
    assert.strictEqual(detailRes.status, 200);
    assert.strictEqual(detailRes.body.data.foto_perfil, uploadRes.body.foto_url, 'Foto guardada correctamente en SQLite');
    assert.strictEqual(detailRes.body.data.cargo_especialidad, 'Master en Acrílico & Estructuras Coffin');
    assert.strictEqual(detailRes.body.data.experiencia_anios, 6);
    assert.deepStrictEqual(detailRes.body.data.servicios_ids.sort(), [1, 2, 4].sort(), 'Servicios asignados coinciden');
    console.log(`✅ Detalle verificado correctamente: Foto=${detailRes.body.data.foto_perfil}, Exp=${detailRes.body.data.experiencia_anios} años`);

    // 6. Editar manicurista y actualizar servicios
    console.log('\n6. PUT /api/admin/manicuristas/:id (Editar manicurista)...');
    const editRes = await request({ path: `/api/admin/manicuristas/${createdId}`, method: 'PUT' }, {
        nombre: 'Carolina Actualizada',
        apellido: 'Mendez Ramos',
        email: newManiEmail,
        telefono: '+591 79999999',
        cargo_especialidad: 'Master Supreme en Acrílico & Soft Gel',
        descripcion: 'Descripción actualizada con técnicas europeas.',
        experiencia_anios: 7,
        estado: 'activo',
        servicios_ids: [1, 2, 3, 5]
    }, adminCookie);
    assert.strictEqual(editRes.status, 200);
    console.log('✅ Manicurista actualizada exitosamente');

    // 7. Remover foto y verificar fallback
    console.log('\n7. DELETE /api/admin/manicuristas/:id/foto (Remover foto)...');
    const rmFotoRes = await request({ path: `/api/admin/manicuristas/${createdId}/foto`, method: 'DELETE' }, null, adminCookie);
    assert.strictEqual(rmFotoRes.status, 200);
    const detailAfterRm = await request({ path: `/api/admin/manicuristas/${createdId}`, method: 'GET' }, null, adminCookie);
    assert.strictEqual(detailAfterRm.body.data.foto_perfil, null, 'Foto ahora es NULL (activa fallback de iniciales)');
    console.log('✅ Foto removida, SQLite actualizado a NULL para fallback');

    // 8. Cambiar estado activo/inactivo
    console.log('\n8. PUT /api/admin/manicuristas/:id/estado (Desactivar/Activar)...');
    const toggleRes = await request({ path: `/api/admin/manicuristas/${createdId}/estado`, method: 'PUT' }, { estado: 'inactivo' }, adminCookie);
    assert.strictEqual(toggleRes.status, 200);
    assert.strictEqual(toggleRes.body.data.estado, 'inactivo');
    console.log('✅ Estado cambiado a inactivo');

    // 9. Agendar cita con manicurista
    console.log('\n9. POST /api/reservas (Agendar cita con manicurista)...');
    // Login as client
    const clientLogin = await request({ path: '/api/auth/login', method: 'POST' }, {
        email: 'camila.morales@gmail.com',
        password: 'cliente123'
    });
    assert.strictEqual(clientLogin.status, 200);
    const clientCookie = clientLogin.cookie;

    // Obtener manicurista activa existente
    const activeManic = pubMeta.body.data[0];
    const bookingRes = await request({ path: '/api/reservas', method: 'POST' }, {
        manicurista_id: activeManic.id,
        servicios: [1, 3],
        fecha_cita: '2026-12-15',
        hora_cita: '10:00:00',
        metodo_contacto: 'WhatsApp',
        observaciones: 'Prueba de reserva con manicurista asignada'
    }, clientCookie);
    assert.strictEqual(bookingRes.status, 201, 'Cita creada exitosamente');
    assert.strictEqual(bookingRes.body.success, true);
    assert.strictEqual(bookingRes.body.data.manicurista_id, activeManic.id, 'Manicurista asignada a la cita');
    console.log(`✅ Cita #${bookingRes.body.data.codigo_reserva} creada con manicurista ID #${activeManic.id}`);

    // Limpieza de manicurista de prueba
    console.log('\n10. Limpieza: Eliminar manicurista de prueba...');
    await request({ path: `/api/admin/manicuristas/${createdId}`, method: 'DELETE' }, null, adminCookie);
    console.log('✅ Manicurista de prueba eliminada');

    console.log('\n=============================================================');
    console.log('🎉 TODAS LAS PRUEBAS DEL SISTEMA PASARON EXITOSAMENTE (10/10) 🎉');
    console.log('=============================================================');
    process.exit(0);
}

runTests().catch(err => {
    console.error('❌ Error en las pruebas:', err);
    process.exit(1);
});
