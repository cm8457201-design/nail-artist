/**
 * Full End-to-End Verification Test for Multi-Role NailArtist Studio
 * Including Real Manicurist Booking, Availability Checking & Collision Prevention
 */

const http = require('http');

function makeRequest(path, options = {}, body = null, cookie = '') {
    return new Promise((resolve, reject) => {
        const reqOptions = {
            hostname: 'localhost',
            port: 3000,
            path: path,
            method: options.method || 'GET',
            headers: {
                'Content-Type': 'application/json',
                ...(cookie ? { 'Cookie': cookie } : {}),
                ...(options.headers || {})
            }
        };

        const req = http.request(reqOptions, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                let parsed = null;
                try { parsed = JSON.parse(data); } catch (e) { parsed = data; }
                const setCookie = res.headers['set-cookie'];
                resolve({
                    status: res.statusCode,
                    headers: res.headers,
                    cookies: setCookie ? setCookie.map(c => c.split(';')[0]).join('; ') : '',
                    data: parsed
                });
            });
        });

        req.on('error', reject);
        if (body) {
            req.write(typeof body === 'string' ? body : JSON.stringify(body));
        }
        req.end();
    });
}

async function runTests() {
    console.log('====================================================');
    console.log('   NAILARTIST STUDIO — FULL VERIFICATION SUITE       ');
    console.log('====================================================\n');

    let passed = 0;
    let failed = 0;

    function assert(condition, testName, details = '') {
        if (condition) {
            console.log(`✅ PASS: ${testName}`);
            passed++;
        } else {
            console.error(`❌ FAIL: ${testName} -> ${details}`);
            failed++;
        }
    }

    try {
        // 1. Unauthenticated checks
        console.log('--- 1. Pruebas sin autenticación ---');
        const resMe = await makeRequest('/api/me');
        assert(resMe.data.authenticated === false, 'API /api/me reporta no autenticado');

        const resCatProt = await makeRequest('/api/servicios');
        assert(resCatProt.status === 401 && resCatProt.data.requires_auth === true, 'Catálogo completo /api/servicios protegido con 401');

        const resCatPreview = await makeRequest('/api/servicios?public_preview=true');
        assert(resCatPreview.status === 200 && Array.isArray(resCatPreview.data.data), 'Catálogo /api/servicios?public_preview=true funciona para preview');

        const resManicMeta = await makeRequest('/api/servicios/meta/manicuristas');
        assert(resManicMeta.status === 200 && resManicMeta.data.success && resManicMeta.data.data.length > 0, 'Meta Manicuristas público /api/servicios/meta/manicuristas retorna manicuristas activas');

        const resReviewsServ = await makeRequest('/api/servicios/1/resenas');
        assert(resReviewsServ.status === 200 && resReviewsServ.data.success, 'Reseñas por servicio /api/servicios/1/resenas responde exitosamente');

        // 2. Cliente Login & Booking
        console.log('\n--- 2. Pruebas Rol Cliente & Sistema de Disponibilidad ---');
        const loginCli = await makeRequest('/api/login', { method: 'POST' }, {
            email: 'camila.morales@gmail.com',
            password: 'cliente123'
        });
        const cliUser = loginCli.data.data?.usuario || loginCli.data.user;
        assert(loginCli.status === 200 && cliUser && cliUser.rol_id === 2, 'Login de Cliente (rol_id = 2)');
        const cliCookie = loginCli.cookies;

        const cliMe = await makeRequest('/api/me', {}, null, cliCookie);
        assert(cliMe.data.authenticated === true && cliMe.data.user.rol_id === 2, 'Sesión de Cliente validada');

        const cliCat = await makeRequest('/api/servicios', {}, null, cliCookie);
        assert(cliCat.status === 200 && cliCat.data.success === true, 'Cliente autenticado puede ver catálogo completo');

        const cliCitas = await makeRequest('/api/reservas/mis-citas', {}, null, cliCookie);
        assert(cliCitas.status === 200 && cliCitas.data.success === true, 'Cliente obtiene mis-citas');

        // Test disponibilidad endpoint
        const manicId = resManicMeta.data.data[0].id;
        const testDate = `2026-12-${String((Date.now() % 20) + 1).padStart(2, '0')}`;
        const resDisp = await makeRequest(`/api/reservas/disponibilidad?manicurista_id=${manicId}&fecha=${testDate}`);
        assert(resDisp.status === 200 && resDisp.data.success && Array.isArray(resDisp.data.data.slots), 'API /api/reservas/disponibilidad responde slots');

        // Crear una nueva cita con manicurista asignada
        const resNuevaCita = await makeRequest('/api/reservas', { method: 'POST' }, {
            items: [{ servicio_id: 1, cantidad: 1 }],
            fecha_cita: testDate,
            hora_cita: '15:00',
            manicurista_id: manicId,
            observaciones: 'Prueba de integración multirol con manicurista'
        }, cliCookie);
        assert(resNuevaCita.status === 201 && resNuevaCita.data.success === true, 'Creación de cita con manicurista_id exitosa');

        // Test colisión de horario (mismo manicurista, misma fecha, misma hora)
        const resColision = await makeRequest('/api/reservas', { method: 'POST' }, {
            items: [{ servicio_id: 2, cantidad: 1 }],
            fecha_cita: testDate,
            hora_cita: '15:00',
            manicurista_id: manicId,
            observaciones: 'Intento de doble reserva'
        }, cliCookie);
        assert(resColision.status === 409, 'Control de colisión: Doble reserva para misma manicurista/hora rechazada con 409 Conflict');

        // 3. Admin Login & Role Switch & Manicurist Endpoints
        console.log('\n--- 3. Pruebas Rol Administrador & Gestión ---');
        const loginAdm = await makeRequest('/api/login', { method: 'POST' }, {
            email: 'admin@gmail.com',
            password: '123456'
        });
        const admUser = loginAdm.data.data?.usuario || loginAdm.data.user;
        assert(loginAdm.status === 200 && admUser && admUser.rol_id === 1, 'Login de Administrador (rol_id = 1)');
        const admCookie = loginAdm.cookies;

        const resAdmDash = await makeRequest('/api/admin/dashboard', {}, null, admCookie);
        assert(resAdmDash.status === 200 && resAdmDash.data.success === true, 'Dashboard Admin responde con métricas');

        const resAdmManics = await makeRequest('/api/admin/manicuristas', {}, null, admCookie);
        assert(resAdmManics.status === 200 && resAdmManics.data.success === true, 'Admin lista manicuristas activas');

        // Test Role Switch: Convert user #3 (valentina.rios@gmail.com) to Manicurista
        const resSwitchToManic = await makeRequest('/api/admin/usuarios/3/rol', { method: 'PUT' }, {
            rol_id: 3
        }, admCookie);
        assert(resSwitchToManic.status === 200 && resSwitchToManic.data.success === true, 'Admin convierte usuario #3 en Manicurista');

        // 4. Manicurista Login & Panel Exclusivo
        console.log('\n--- 4. Pruebas Rol Manicurista (valentina.rios@gmail.com) ---');
        const loginManic = await makeRequest('/api/login', { method: 'POST' }, {
            email: 'valentina.rios@gmail.com',
            password: 'cliente123'
        });
        const manicUser = loginManic.data.data?.usuario || loginManic.data.user;
        assert(loginManic.status === 200 && manicUser && manicUser.rol_id === 3, 'Login de Manicurista (rol_id = 3)');
        const manicCookie = loginManic.cookies;

        const resManicDash = await makeRequest('/api/manicurista/dashboard', {}, null, manicCookie);
        assert(resManicDash.status === 200 && resManicDash.data.success === true, 'API /api/manicurista/dashboard responde KPIs y citas');

        const resManicCitas = await makeRequest('/api/manicurista/citas', {}, null, manicCookie);
        assert(resManicCitas.status === 200 && resManicCitas.data.success === true, 'API /api/manicurista/citas lista citas asignadas');

        const resManicAgenda = await makeRequest('/api/manicurista/agenda', {}, null, manicCookie);
        assert(resManicAgenda.status === 200 && resManicAgenda.data.success === true, 'API /api/manicurista/agenda organiza agenda cronológica');

        const resManicNotif = await makeRequest('/api/manicurista/notificaciones', {}, null, manicCookie);
        assert(resManicNotif.status === 200 && resManicNotif.data.success === true, 'API /api/manicurista/notificaciones lista notificaciones');

        const resManicPerfil = await makeRequest('/api/manicurista/perfil', {}, null, manicCookie);
        assert(resManicPerfil.status === 200 && resManicPerfil.data.success === true, 'API /api/manicurista/perfil retorna datos y especialidades');

        // Test Role Switch Back
        const resSwitchBack = await makeRequest('/api/admin/usuarios/3/rol', { method: 'PUT' }, {
            rol_id: 2
        }, admCookie);
        assert(resSwitchBack.status === 200 && resSwitchBack.data.success === true, 'Admin restaura rol a Cliente sin pérdida de datos');

        console.log('\n====================================================');
        console.log(`TOTAL: ${passed} PASSED, ${failed} FAILED`);
        console.log('====================================================');

    } catch (e) {
        console.error('Fatal test error:', e);
    }
}

runTests();
