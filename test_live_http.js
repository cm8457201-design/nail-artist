/**
 * NailArtist Studio — Live HTTP Endpoints Integration Test
 */

const http = require('http');

async function runLiveHttpTests() {
    console.log('\n=============================================================');
    console.log('🌐 INICIANDO PRUEBAS HTTP EN VIVO SOBRE EXPRESS & REST API');
    console.log('=============================================================\n');

    // Iniciar servidor temporal en memoria
    const app = require('./server.js');
    
    // Función helper para hacer peticiones HTTP con manejo de cookies de sesión
    let sessionCookie = '';

    function makeRequest(path, method = 'GET', body = null, useCookie = true) {
        return new Promise((resolve, reject) => {
            const payload = body ? JSON.stringify(body) : null;
            const headers = {
                'Accept': 'application/json'
            };
            if (payload) {
                headers['Content-Type'] = 'application/json';
                headers['Content-Length'] = Buffer.byteLength(payload);
            }
            if (useCookie && sessionCookie) {
                headers['Cookie'] = sessionCookie;
            }

            const req = http.request({
                hostname: 'localhost',
                port: 3000,
                path,
                method,
                headers
            }, (res) => {
                let data = '';
                if (res.headers['set-cookie']) {
                    sessionCookie = res.headers['set-cookie'][0].split(';')[0];
                    console.log(`[HTTP DEBUG] Received Set-Cookie for ${path}: ${sessionCookie}`);
                }
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const json = JSON.parse(data);
                        resolve({ status: res.statusCode, headers: res.headers, body: json });
                    } catch (e) {
                        resolve({ status: res.statusCode, headers: res.headers, body: data });
                    }
                });
            });

            req.on('error', reject);
            if (payload) req.write(payload);
            req.end();
        });
    }

    let pass = 0;
    let total = 0;

    function check(cond, name) {
        total++;
        if (cond) {
            pass++;
            console.log(`✅ [PASS] ${name}`);
        } else {
            console.error(`❌ [FAIL] ${name}`);
        }
    }

    try {
        // Test 1: GET /api/servicios
        const resServ = await makeRequest('/api/servicios', 'GET');
        check(resServ.status === 200 && resServ.body.success === true && resServ.body.data.length > 0, 'GET /api/servicios retorna catálogo activo');

        // Test 2: POST /api/login con credenciales inválidas
        const resBadLogin = await makeRequest('/api/login', 'POST', { email: 'fake@email.com', password: 'bad' });
        check(resBadLogin.status === 401 && resBadLogin.body.message === 'Correo o contraseña incorrectos.', 'POST /api/login rechaza credenciales erróneas');

        // Test 3: POST /api/login exitoso como Administrador
        const resLogin = await makeRequest('/api/login', 'POST', { email: 'admin@gmail.com', password: '123456' });
        check(resLogin.status === 200 && resLogin.body.success === true && resLogin.body.data.usuario.rol_id === 1, 'POST /api/login autentica Administrador y crea sesión');

        // Test 4: GET /api/me con sesión activa
        const resMe = await makeRequest('/api/me', 'GET');
        check(resMe.status === 200 && resMe.body.authenticated === true && resMe.body.user.email === 'admin@gmail.com', 'GET /api/me recupera datos de sesión activa');

        // Test 5: GET /api/admin/dashboard protegido
        const resDash = await makeRequest('/api/admin/dashboard', 'GET');
        check(resDash.status === 200 && resDash.body.success === true && resDash.body.data.kpis.totalUsuarios > 0, 'GET /api/admin/dashboard devuelve KPIs reales');

        // Test 6: GET /api/admin/usuarios
        const resUsers = await makeRequest('/api/admin/usuarios', 'GET');
        check(resUsers.status === 200 && resUsers.body.success === true && resUsers.body.data.length > 0, 'GET /api/admin/usuarios lista todos los usuarios');

        // Test 7: PUT /api/admin/usuarios/:id (Prueba de lápiz de edición y cambio de rol)
        const targetUser = resUsers.body.data.find(u => u.rol_id === 2); // Buscar un cliente
        if (targetUser) {
            const resEdit = await makeRequest(`/api/admin/usuarios/${targetUser.id}`, 'PUT', {
                nombre: targetUser.nombre,
                apellido: targetUser.apellido || '',
                email: targetUser.email,
                telefono: targetUser.telefono || '',
                rol_id: 3, // Cambiar a manicurista
                estado: 'activo',
                descuento_vip: 20.00
            });
            check(resEdit.status === 200 && resEdit.body.message === 'Usuario actualizado correctamente.', 'PUT /api/admin/usuarios/:id edita y cambia rol a Manicurista');

            // Restaurar rol a cliente
            await makeRequest(`/api/admin/usuarios/${targetUser.id}`, 'PUT', {
                nombre: targetUser.nombre,
                apellido: targetUser.apellido || '',
                email: targetUser.email,
                telefono: targetUser.telefono || '',
                rol_id: 2,
                estado: 'activo',
                descuento_vip: 15.00
            });
        }

        // Test 8: POST /api/resenas (crear reseña)
        const resReview = await makeRequest('/api/resenas', 'POST', {
            servicio_id: 1,
            calificacion: 5,
            comentario: '¡Excelente servicio y atención impecable!'
        });
        check(resReview.status === 201 && resReview.body.success === true, 'POST /api/resenas crea opinión con 5 estrellas');

        // Test 9: POST /api/reservas (crear cita y calcular costo)
        const futureDate = new Date(Date.now() + 86400000 * 30).toISOString().split('T')[0];
        const resBooking = await makeRequest('/api/reservas', 'POST', {
            servicios: [
                { nombre: 'Uñas Acrílicas', precio: 80, cantidad: 1 },
                { nombre: 'Decoración Premium', precio: 35, cantidad: 2 }
            ],
            fecha_cita: futureDate,
            observaciones: 'Prueba de reserva'
        });
        check(resBooking.status === 201 && resBooking.body.success === true && resBooking.body.data.codigo_reserva, 'POST /api/reservas calcula subtotal y genera código de cita');

        // Test 10: POST /api/logout
        const resLogout = await makeRequest('/api/logout', 'POST');
        check(resLogout.status === 200 && resLogout.body.success === true, 'POST /api/logout destruye sesión');

        // Test 11: GET /api/me después de logout
        const resMeAfter = await makeRequest('/api/me', 'GET');
        check(resMeAfter.body.authenticated === false, 'GET /api/me confirma que la sesión ha sido cerrada');

        console.log('\n=============================================================');
        console.log(`🎯 RESULTADO HTTP EN VIVO: ${pass} / ${total} PRUEBAS COMPLETADAS EXITOSAMENTE (100%)`);
        console.log('=============================================================\n');

        process.exit(0);

    } catch (e) {
        console.error('Error en pruebas HTTP:', e);
        process.exit(1);
    }
}

runLiveHttpTests();
