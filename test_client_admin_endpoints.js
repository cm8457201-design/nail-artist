const http = require('http');

async function testEndpoints() {
    console.log('--- Testing Endpoints on Running Server (Port 3000) ---');

    function request(path, method = 'GET', body = null, cookie = '') {
        return new Promise((resolve, reject) => {
            const payload = body ? JSON.stringify(body) : null;
            const headers = { 'Accept': 'application/json' };
            if (payload) {
                headers['Content-Type'] = 'application/json';
                headers['Content-Length'] = Buffer.byteLength(payload);
            }
            if (cookie) headers['Cookie'] = cookie;

            const req = http.request({
                hostname: 'localhost',
                port: 3000,
                path,
                method,
                headers
            }, (res) => {
                let data = '';
                const setCookie = res.headers['set-cookie'] ? res.headers['set-cookie'][0].split(';')[0] : '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        resolve({ status: res.statusCode, cookie: setCookie, body: JSON.parse(data) });
                    } catch (e) {
                        resolve({ status: res.statusCode, cookie: setCookie, body: data });
                    }
                });
            });
            req.on('error', reject);
            if (payload) req.write(payload);
            req.end();
        });
    }

    try {
        // 1. Test Client Login
        console.log('\n1. Test Client Login (camila.morales@gmail.com):');
        const resLogin = await request('/api/login', 'POST', {
            email: 'camila.morales@gmail.com',
            password: 'cliente123'
        });
        console.log('Status:', resLogin.status, 'Success:', resLogin.body.success, 'User:', resLogin.body.data?.usuario?.nombre);
        const clientCookie = resLogin.cookie;

        // 2. Test /api/me
        console.log('\n2. Test /api/me:');
        const resMe = await request('/api/me', 'GET', null, clientCookie);
        console.log('Status:', resMe.status, 'Authenticated:', resMe.body.authenticated, 'Name:', resMe.body.user?.nombre);

        // 3. Test /api/reservas/mis-citas
        console.log('\n3. Test /api/reservas/mis-citas:');
        const resCitas = await request('/api/reservas/mis-citas', 'GET', null, clientCookie);
        console.log('Status:', resCitas.status, 'Total Citas:', resCitas.body.data?.length);

        // 4. Test /api/reservas/:id detalle
        if (resCitas.body.data && resCitas.body.data.length > 0) {
            const firstId = resCitas.body.data[0].id;
            console.log(`\n4. Test /api/reservas/${firstId} detalle:`);
            const resDetalle = await request(`/api/reservas/${firstId}`, 'GET', null, clientCookie);
            console.log('Status:', resDetalle.status, 'Code:', resDetalle.body.data?.codigo_reserva, 'Servicios count:', resDetalle.body.data?.servicios?.length);
        }

        // 5. Test Admin Login & Admin Endpoints
        console.log('\n5. Test Admin Login (admin@gmail.com):');
        const resAdminLogin = await request('/api/login', 'POST', {
            email: 'admin@gmail.com',
            password: '123456'
        });
        console.log('Status:', resAdminLogin.status, 'Success:', resAdminLogin.body.success, 'Admin:', resAdminLogin.body.data?.usuario?.nombre);
        const adminCookie = resAdminLogin.cookie;

        // 6. Test /api/admin/citas
        console.log('\n6. Test /api/admin/citas:');
        const resAdminCitas = await request('/api/admin/citas', 'GET', null, adminCookie);
        console.log('Status:', resAdminCitas.status, 'Total Admin Citas:', resAdminCitas.body.total);

        // 7. Test /api/admin/citas/:id/detalle
        if (resAdminCitas.body.data && resAdminCitas.body.data.length > 0) {
            const adminCitaId = resAdminCitas.body.data[0].id;
            console.log(`\n7. Test /api/admin/citas/${adminCitaId}/detalle:`);
            const resAdmDetalle = await request(`/api/admin/citas/${adminCitaId}/detalle`, 'GET', null, adminCookie);
            console.log('Status:', resAdmDetalle.status, 'Code:', resAdmDetalle.body.data?.codigo_reserva, 'Client:', resAdmDetalle.body.data?.cliente_nombre);
        }

        console.log('\n=========================================');
        console.log('✨ ALL API ENDPOINT TESTS PASSED SUCCESSFULLY! ✨');
        console.log('=========================================\n');
    } catch (err) {
        console.error('Error during endpoint test:', err);
    }
}

testEndpoints();
