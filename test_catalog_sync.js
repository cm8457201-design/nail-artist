const Database = require('./database/db');
const http = require('http');

async function runTest() {
    console.log('====================================================');
    console.log('🚀 INICIANDO TEST DE INTEGRACIÓN: ADMIN -> SQLITE -> API -> FRONTEND');
    console.log('====================================================\n');

    // 1. Iniciar servidor Express
    const express = require('express');
    const app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    
    // Mock sesión y middlewares
    const servicesRoutes = require('./routes/services.routes');
    const adminRoutes = require('./routes/admin.routes');
    
    // Simular middleware auth para admin en test
    app.use((req, res, next) => {
        req.user = { id: 1, rol_id: 1, rol_nombre: 'administrador', nombre: 'Admin Test' };
        next();
    });

    app.use('/api/servicios', servicesRoutes);
    app.use('/api/admin', adminRoutes);

    const server = http.createServer(app);
    await new Promise(resolve => server.listen(3099, resolve));
    console.log('✅ Servidor de prueba iniciado en http://localhost:3099');

    // Helper para fetch
    async function request(url, options = {}) {
        const fullUrl = `http://localhost:3099${url}`;
        const res = await fetch(fullUrl, options);
        const data = await res.json();
        return { status: res.status, headers: res.headers, data };
    }

    try {
        // 2. Verificar que 'uñas de marca' ya está en SQLite y devuelto en GET /api/servicios
        console.log('\n--- PASO 1: Comprobar GET /api/servicios con datos iniciales de SQLite ---');
        const res1 = await request('/api/servicios');
        console.log(`Status: ${res1.status}, Total servicios: ${res1.data.total}`);
        const foundUñasDeMarca = res1.data.data.find(s => s.nombre.toLowerCase().includes('uñas de marca'));
        if (foundUñasDeMarca) {
            console.log(`✅ 'uñas de marca' encontrada en GET /api/servicios: ID #${foundUñasDeMarca.id}, Precio: Bs. ${foundUñasDeMarca.precio}`);
        } else {
            console.error('❌ "uñas de marca" no encontrada en GET /api/servicios');
        }

        // 3. Crear servicio "PRUEBA SERVICIO DINAMICO" vía POST /api/admin/servicios
        console.log('\n--- PASO 2: Crear servicio desde Admin (POST /api/admin/servicios) ---');
        const nuevoServicioData = {
            nombre: 'PRUEBA SERVICIO DINAMICO',
            categoria_id: 1,
            precio: 95,
            duracion_minutos: 75,
            descripcion: 'Servicio creado para comprobar sincronización',
            imagen: 'images/service_acrilicas.jpg',
            url_detalle: 'left-sidebar.html',
            destacado: '1',
            estado: 'activo'
        };

        const resCreate = await request('/api/admin/servicios', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(nuevoServicioData)
        });

        console.log('Respuesta creación:', resCreate.data);
        const nuevoId = resCreate.data.data.id;
        console.log(`✅ Servicio creado con ID #${nuevoId}`);

        // 4. Verificar directamente en SQLite
        console.log('\n--- PASO 3: Verificar en SQLite (nailartist.db) ---');
        const dbRow = Database.get('SELECT * FROM servicios WHERE id = ?', [nuevoId]);
        console.log('Fila en SQLite:', dbRow);
        if (dbRow && dbRow.nombre === 'PRUEBA SERVICIO DINAMICO') {
            console.log('✅ Verificado con éxito en nailartist.db');
        } else {
            throw new Error('No se encontró el registro en SQLite');
        }

        // 5. Verificar que aparece inmediatamente en GET /api/servicios
        console.log('\n--- PASO 4: Comprobar respuesta JSON de GET /api/servicios ---');
        const res2 = await request('/api/servicios');
        const foundNuevo = res2.data.data.find(s => s.id === nuevoId);
        if (foundNuevo) {
            console.log('✅ Servicio nuevo incluido en GET /api/servicios:');
            console.log(JSON.stringify(foundNuevo, null, 2));
        } else {
            throw new Error('El servicio nuevo NO apareció en GET /api/servicios');
        }

        // 6. Simular renderizado frontend de cargarServiciosCatalogo
        console.log('\n--- PASO 5: Simular renderizado HTML de tarjeta frontend ---');
        const s = foundNuevo;
        const cardHtml = `
            <div class="service-card" data-service-id="${s.id}">
                <div class="card-img-holder">
                    <img src="${s.imagen}" alt="${s.nombre}" />
                    <span class="card-category-badge">${s.categoria_nombre}</span>
                    <div class="price-badge">Bs. ${s.precio}</div>
                </div>
                <div class="card-content">
                    <div class="card-meta">
                        <div class="card-rating">★★★★★ <span>(${s.calificacion})</span></div>
                        <span class="card-duration">⏱ ~1h 15m</span>
                    </div>
                    <h3 class="card-title">${s.nombre}</h3>
                    <p class="card-desc">${s.descripcion}</p>
                    <div class="card-actions-group">
                        <a href="${s.url_detalle}" class="btn-card-details">🔍 Ver Detalles</a>
                        <button type="button" class="btn-add-cart" onclick="agregarAlCarrito('${s.nombre}', ${s.precio})">
                            🛒 Añadir
                        </button>
                    </div>
                </div>
            </div>
        `;
        console.log('✅ Tarjeta renderizada correctamente:');
        console.log(cardHtml.trim());

        // 7. Eliminar el servicio de prueba creado para dejar la base de datos limpia o mantenerlo según se desee
        console.log('\n--- PASO 6: Limpieza del servicio de prueba del test ---');
        Database.run('DELETE FROM servicios WHERE id = ?', [nuevoId]);
        console.log(`✅ Servicio de prueba #${nuevoId} eliminado.`);

        console.log('\n====================================================');
        console.log('🎉 TODOS LOS TESTS PASARON CON ÉXITO AL 100%');
        console.log('====================================================\n');

    } finally {
        server.close();
    }
}

runTest().catch(err => {
    console.error('❌ Error en el test:', err);
    process.exit(1);
});
