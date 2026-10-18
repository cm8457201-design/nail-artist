const http = require('http');

function makeReq(path, method = 'GET', body = null, cookie = '') {
    return new Promise((resolve) => {
        const req = http.request({
            hostname: 'localhost',
            port: 3000,
            path: path,
            method: method,
            headers: {
                'Content-Type': 'application/json',
                ...(cookie ? { 'Cookie': cookie } : {})
            }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                let parsed;
                try { parsed = JSON.parse(data); } catch(e) { parsed = data; }
                resolve({ status: res.statusCode, data: parsed });
            });
        });
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

async function debug() {
    // 1. Login
    const login = await makeReq('/api/login', 'POST', { email: 'camila.morales@gmail.com', password: 'cliente123' });
    const cookie = login.data?.user ? `nailartist_session=...` : '';
    console.log('Login res:', login.status, login.data);

    // Meta manicuristas
    const meta = await makeReq('/api/servicios/meta/manicuristas');
    console.log('Meta manicuristas:', meta.status, meta.data);
    const mId = meta.data.data[0].id;

    // Disponibilidad
    const disp = await makeReq(`/api/reservas/disponibilidad?manicurista_id=${mId}&fecha=2026-11-20`);
    console.log('Disponibilidad res:', disp.status, disp.data);

    // Make booking
    const book = await makeReq('/api/reservas', 'POST', {
        items: [{ servicio_id: 1, cantidad: 1 }],
        fecha_cita: '2026-11-20',
        hora_cita: '15:00',
        manicurista_id: mId
    }, cookie);
    console.log('Booking res:', book.status, book.data);
}

debug();
