/**
 * NailArtist Studio — Authentication & Authorization Middleware
 */

const Database = require('../database/db');

// Middleware para adjuntar la información completa del usuario autenticado a req.user
function attachUser(req, res, next) {
    if (req.session && req.session.userId) {
        try {
            const user = Database.get(
                `SELECT u.id, u.rol_id, u.nombre, u.apellido, u.email, u.telefono, 
                        u.descuento_vip, u.estado, u.fecha_registro, r.nombre AS rol_nombre
                 FROM usuarios u
                 INNER JOIN roles r ON u.rol_id = r.id
                 WHERE u.id = ? AND u.estado = 'activo'`,
                [req.session.userId]
            );

            if (user) {
                req.user = user;
            } else {
                req.session.userId = null;
                req.user = null;
            }
        } catch (err) {
            console.error('Error en attachUser:', err);
            req.user = null;
        }
    } else {
        req.user = null;
    }
    next();
}

// Middleware que requiere que el usuario haya iniciado sesión
function requireAuth(req, res, next) {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            message: 'Acceso no autorizado. Por favor inicia sesión.'
        });
    }
    next();
}

// Middleware que requiere rol de Administrador (rol_id = 1)
function requireAdmin(req, res, next) {
    if (!req.user) {
        // Si es una petición de página HTML en el navegador, redirigir al login
        if (req.accepts('html')) {
            return res.redirect('/login.html?error=no_auth&redirect=' + encodeURIComponent(req.originalUrl));
        }
        return res.status(401).json({
            success: false,
            message: 'Debes iniciar sesión como Administrador.'
        });
    }

    const rol = (req.user.rol_nombre || '').toLowerCase();
    if (req.user.rol_id !== 1 && rol !== 'administrador' && rol !== 'admin') {
        if (req.accepts('html')) {
            return res.redirect('/index.html?error=forbidden');
        }
        return res.status(403).json({
            success: false,
            message: 'Acceso denegado. Se requieren permisos de Administrador.'
        });
    }

    next();
}

// Middleware que requiere rol de Manicurista o Administrador
function requireManicurista(req, res, next) {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            message: 'Inicia sesión para continuar.'
        });
    }

    const rol = (req.user.rol_nombre || '').toLowerCase();
    const isManicuristaOrAdmin = req.user.rol_id === 3 || req.user.rol_id === 1 ||
                                rol === 'manicurista' || rol === 'administrador';

    if (!isManicuristaOrAdmin) {
        return res.status(403).json({
            success: false,
            message: 'Acceso exclusivo para manicuristas del estudio.'
        });
    }

    next();
}

module.exports = {
    attachUser,
    requireAuth,
    requireAdmin,
    requireManicurista
};
