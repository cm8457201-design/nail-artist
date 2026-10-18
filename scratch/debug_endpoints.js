const http = require('http');

async function debug() {
    // 1. Check booking creation
    const loginCli = await makeRequest('/api/login', { method: 'POST' }, {
        email: 'camila.morales@gmail.com',
        password: 'cliente123'
    });
    const cliCookie = loginCli.cookies;

    const resNuevaCita = await makeRequest('/api/reservas', { method: 'POST' }, {
        servicios: [{ nombre: 'Uñas Acrílicas Esculpidas', precio: 120, cantidad: 1 }],
        fecha_cita: '2026-10-15',
        hora_cita: '15:00',
        manicurista_id: 11,
        observaciones: 'Prueba de integración'
    }, cliCookie);
    console.log('Nueva Cita Response:', resNuevaCita.status, resNuevaCita.data);

    // 2. Check admin dashboard
    const loginAdm = await makeRequest('/api/login', { method: 'POST' }, {
        email: 'admin@gmail.com',
        password: '123456'
    });
    const admCookie = loginAdm.cookies;
    const resAdmDash = await makeRequest('/api/admin/dashboard', {}, null, admCookie);
    console.log('Admin Dash Response:', resAdmDash.status, resAdmDash.data);
}

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
                    cookies: setCookie ? setCookie.map(c => c.split(';')[0]).join('; ') : '',
                    data: parsed
                });
            });
        });

        req.on('error', reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

debug();
