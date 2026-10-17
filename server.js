/**
 * NailArtist Studio — Master Express Server (Node.js + SQLite 3)
 * Servidor HTTP y API REST oficial con soporte multirol (Cliente, Manicurista, Administrador) y Catálogo Protegido
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
const { attachUser, requireAdmin, requireManicurista } = require('./middleware/auth');

// Rutas
const authRoutes = require('./routes/auth.routes');
const servicesRoutes = require('./routes/services.routes');
const reviewsRoutes = require('./routes/reviews.routes');
const bookingsRoutes = require('./routes/bookings.routes');
const contactRoutes = require('./routes/contact.routes');
const adminRoutes = require('./routes/admin.routes');
const manicuristaRoutes = require('./routes/manicurista.routes');

const app = express();
const PORT = process.env.PORT || 3000;

// Asegurar carpetas para fotografías de manicuristas y uploads
const MANICURISTAS_IMG_DIR = path.join(__dirname, 'images', 'manicuristas');
const UPLOADS_MANICURISTAS_DIR = path.join(__dirname, 'uploads', 'manicuristas');
if (!fs.existsSync(MANICURISTAS_IMG_DIR)) {
    fs.mkdirSync(MANICURISTAS_IMG_DIR, { recursive: true });
}
if (!fs.existsSync(UPLOADS_MANICURISTAS_DIR)) {
    fs.mkdirSync(UPLOADS_MANICURISTAS_DIR, { recursive: true });
}

// Configuración de Middlewares globales
app.use(morgan('dev'));
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// Cabeceras de seguridad básicas
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    next();
});

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

// 2. Catálogo de Servicios (Protegido para usuarios autenticados)
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

// 7. Panel de Manicuristas
app.use('/api/manicurista', manicuristaRoutes);

// =============================================================================
// GESTIÓN Y PROTECCIÓN DE RUTAS DEL PANEL ADMINISTRADOR (/admin)
// =============================================================================

app.use('/admin', (req, res, next) => {
    if (req.path.startsWith('/assets/')) {
        return next();
    }

    if (!req.user || (req.user.rol_id !== 1 && (req.user.rol_nombre || '').toLowerCase() !== 'administrador')) {
        return res.redirect('/login.html?error=no_admin_access&redirect=' + encodeURIComponent(req.originalUrl));
    }

    if (req.path === '/' || req.path === '') {
        return res.sendFile(path.join(__dirname, 'admin', 'index.html'));
    }

    next();
});

app.use('/admin', express.static(path.join(__dirname, 'admin')));

// =============================================================================
// GESTIÓN Y PROTECCIÓN DE RUTAS DEL PANEL MANICURISTA (/manicurista)
// =============================================================================

app.use('/manicurista', (req, res, next) => {
    if (req.path.startsWith('/assets/')) {
        return next();
    }

    const rol = (req.user?.rol_nombre || '').toLowerCase();
    const isManicuristaOrAdmin = req.user && (req.user.rol_id === 3 || req.user.rol_id === 1 || rol === 'manicurista' || rol === 'administrador');

    if (!isManicuristaOrAdmin) {
        return res.redirect('/login.html?error=no_manicurista_access&redirect=' + encodeURIComponent(req.originalUrl));
    }

    if (req.path === '/' || req.path === '') {
        return res.sendFile(path.join(__dirname, 'manicurista', 'index.html'));
    }

    next();
});

app.use('/manicurista', express.static(path.join(__dirname, 'manicurista')));

// =============================================================================
// CATÁLOGO PÚBLICO (/servicios.html) — ACCESIBLE A TODOS LOS VISITANTES
// =============================================================================
app.get('/servicios.html', (req, res, next) => {
    next();
});

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
    console.log(`🌐 Servidor funcionando en:   http://localhost:${PORT}`);
    console.log(`👑 Panel Administrador:       http://localhost:${PORT}/admin/`);
    console.log(`💅 Panel Manicurista:         http://localhost:${PORT}/manicurista/`);
    console.log(`👤 Panel Cliente:             http://localhost:${PORT}/cliente.html`);
    console.log(`🎨 Catálogo Protegido:        http://localhost:${PORT}/servicios.html`);
    console.log(`🔐 Iniciar Sesión / Registro:  http://localhost:${PORT}/login.html`);
    console.log(`🗄️  Base de Datos SQLite:      nailartist.db`);
    console.log('=============================================================\n');
});
