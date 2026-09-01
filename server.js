/**
 * NailArtist Studio — Master Express Server (Node.js + SQLite 3)
 * Servidor HTTP y API REST oficial
 */

const express = require('express');
const session = require('express-session');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');

// Inicializar DB
const Database = require('./database/db');

// Middlewares
const { attachUser, requireAdmin } = require('./middleware/auth');

// Rutas
const authRoutes = require('./routes/auth.routes');
const servicesRoutes = require('./routes/services.routes');
const reviewsRoutes = require('./routes/reviews.routes');
const bookingsRoutes = require('./routes/bookings.routes');
const contactRoutes = require('./routes/contact.routes');
const adminRoutes = require('./routes/admin.routes');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuración de Middlewares globales
app.use(morgan('dev'));
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configuración de Sesiones en memoria/Express
app.use(session({
    secret: 'nailartist-super-secret-key-2026-vip-glam',
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        secure: false, // true en producción HTTPS
        maxAge: 1000 * 60 * 60 * 24 * 7 // 7 días de persistencia
    }
}));

// Adjuntar información de usuario a req.user en cada petición
app.use(attachUser);

// =============================================================================
// RUTAS DE LA API REST (FETCH API)
// =============================================================================

// 1. Autenticación y Cuentas
app.use('/api/auth', authRoutes);
app.post('/api/login', (req, res, next) => { req.url = '/login'; authRoutes(req, res, next); });
app.post('/api/register', (req, res, next) => { req.url = '/register'; authRoutes(req, res, next); });
app.post('/api/registrar_usuario', (req, res, next) => { req.url = '/register'; authRoutes(req, res, next); });
app.all('/api/logout', (req, res, next) => { req.url = '/logout'; authRoutes(req, res, next); });
app.get('/api/me', (req, res, next) => { req.url = '/me'; authRoutes(req, res, next); });

// 2. Catálogo de Servicios
app.use('/api/servicios', servicesRoutes);
app.use('/api/services', servicesRoutes);
app.use('/api/obtener_servicios', servicesRoutes);

// 3. Reseñas y Testimonios
app.use('/api/resenas', reviewsRoutes);
app.use('/api/reviews', reviewsRoutes);

// 4. Reservas y Citas
app.use('/api/reservas', bookingsRoutes);
app.use('/api/crear_reserva', bookingsRoutes);

// 5. Contacto
app.use('/api/contactos', contactRoutes);
app.use('/api/contacto', contactRoutes);

// 6. Panel de Administración
app.use('/api/admin', adminRoutes);

// Bridge de compatibilidad para api_admin.php (por si algún archivo legacy lo invoca)
app.all(['/admin/api_admin.php', '/api_admin.php'], requireAdmin, async (req, res) => {
    const action = req.query.action || req.body.action || '';
    const input = { ...req.query, ...req.body };

    try {
        switch (action) {
            case 'usuario_obtener': {
                const id = parseInt(input.id, 10);
                const user = Database.get('SELECT id, rol_id, nombre, apellido, email, telefono, descuento_vip, estado FROM usuarios WHERE id = ?', [id]);
                if (user) return res.json({ success: true, message: 'Usuario obtenido', data: user });
                return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
            }
            case 'usuario_crear': {
                const { nombre, apellido, email, telefono, password, rol_id, estado, descuento_vip } = input;
                const bcrypt = require('bcryptjs');
                const salt = await bcrypt.genSalt(10);
                const pwd = await bcrypt.hash(password || '123456', salt);
                const result = Database.run(
                    'INSERT INTO usuarios (rol_id, nombre, apellido, email, telefono, password_hash, descuento_vip, estado) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                    [parseInt(rol_id, 10) || 2, nombre, apellido || '', email, telefono || '', pwd, parseFloat(descuento_vip) || 0, estado || 'activo']
                );
                return res.json({ success: true, message: `Usuario #${result.lastInsertRowid} creado exitosamente.` });
            }
            case 'usuario_editar': {
                const id = parseInt(input.id, 10);
                const { nombre, apellido, email, telefono, password, rol_id, estado, descuento_vip } = input;
                if (password && password.trim().length >= 6) {
                    const bcrypt = require('bcryptjs');
                    const salt = await bcrypt.genSalt(10);
                    const pwd = await bcrypt.hash(password.trim(), salt);
                    Database.run(
                        'UPDATE usuarios SET rol_id = ?, nombre = ?, apellido = ?, email = ?, telefono = ?, password_hash = ?, descuento_vip = ?, estado = ? WHERE id = ?',
                        [parseInt(rol_id, 10) || 2, nombre, apellido || '', email, telefono || '', pwd, parseFloat(descuento_vip) || 0, estado || 'activo', id]
                    );
                } else {
                    Database.run(
                        'UPDATE usuarios SET rol_id = ?, nombre = ?, apellido = ?, email = ?, telefono = ?, descuento_vip = ?, estado = ? WHERE id = ?',
                        [parseInt(rol_id, 10) || 2, nombre, apellido || '', email, telefono || '', parseFloat(descuento_vip) || 0, estado || 'activo', id]
                    );
                }
                return res.json({ success: true, message: 'Usuario actualizado correctamente.' });
            }
            case 'usuario_eliminar': {
                const id = parseInt(input.id, 10);
                Database.run('DELETE FROM usuarios WHERE id = ?', [id]);
                return res.json({ success: true, message: 'Usuario eliminado correctamente.' });
            }
            default:
                return res.json({ success: false, message: `Acción '${action}' no reconocida.` });
        }
    } catch (err) {
        console.error('Error en api_admin bridge:', err);
        return res.status(500).json({ success: false, message: 'Error interno en bridge admin.' });
    }
});

// =============================================================================
// GESTIÓN Y PROTECCIÓN DE RUTAS DEL PANEL ADMINISTRADOR (/admin)
// =============================================================================

// Protección de acceso al directorio /admin
app.use('/admin', (req, res, next) => {
    // Permitir archivos de assets públicos del admin (css, js, imágenes)
    if (req.path.startsWith('/assets/')) {
        return next();
    }

    // Verificar permisos de administrador
    if (!req.user || (req.user.rol_id !== 1 && (req.user.rol_nombre || '').toLowerCase() !== 'administrador')) {
        return res.redirect('/login.html?error=no_admin_access&redirect=' + encodeURIComponent(req.originalUrl));
    }

    // Redirección de .php a .html si aplica
    if (req.path.endsWith('.php')) {
        const htmlTarget = req.path.replace(/\.php$/, '.html');
        return res.redirect(path.join('/admin', htmlTarget));
    }

    if (req.path === '/' || req.path === '') {
        return res.sendFile(path.join(__dirname, 'admin', 'index.html'));
    }

    next();
});

// Servir estáticos de admin
app.use('/admin', express.static(path.join(__dirname, 'admin')));

// =============================================================================
// ARCHIVOS ESTÁTICOS FRONTEND
// =============================================================================
app.use(express.static(path.join(__dirname)));

// Redirección raíz a index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Manejo de errores 404
app.use((req, res) => {
    if (req.accepts('html')) {
        return res.status(404).sendFile(path.join(__dirname, 'index.html'));
    }
    return res.status(404).json({
        success: false,
        message: 'Recurso no encontrado (404).'
    });
});

// Manejo general de errores
app.use((err, req, res, next) => {
    console.error('❌ [Server Error]:', err);
    res.status(500).json({
        success: false,
        message: 'Error interno del servidor.'
    });
});

// Iniciar Servidor
app.listen(PORT, () => {
    console.log('\n=============================================================');
    console.log('✨ NAILARTIST STUDIO — SERVIDOR NODE.JS + SQLITE EN LÍNEA ✨');
    console.log('=============================================================');
    console.log(`🌐 Servidor funcionando en:  http://localhost:${PORT}`);
    console.log(`👑 Panel Administrador:      http://localhost:${PORT}/admin/`);
    console.log(`💅 Catálogo de Servicios:    http://localhost:${PORT}/servicios.html`);
    console.log(`🔐 Iniciar Sesión / Registro: http://localhost:${PORT}/login.html`);
    console.log(`🗄️  Base de Datos SQLite:     nailartist.db`);
    console.log('=============================================================\n');
});
