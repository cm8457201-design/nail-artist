/**
 * NailArtist Studio — Auth Routes
 * Manejo de Login, Registro, Logout y Estado de Sesión con validaciones estrictas y bcrypt
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const Database = require('../database/db');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * POST /login
 */
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body || {};

        if (!email || !email.trim()) {
            return res.status(400).json({
                success: false,
                message: 'Ingresa tu correo electrónico.'
            });
        }

        if (!password) {
            return res.status(400).json({
                success: false,
                message: 'Ingresa tu contraseña.'
            });
        }

        const normalizedEmail = email.trim().toLowerCase();

        // Buscar usuario en SQLite
        const user = Database.get(
            `SELECT u.*, r.nombre AS rol_nombre 
             FROM usuarios u 
             INNER JOIN roles r ON u.rol_id = r.id 
             WHERE LOWER(u.email) = ?`,
            [normalizedEmail]
        );

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Correo o contraseña incorrectos.'
            });
        }

        // Validar estado de la cuenta
        if (user.estado !== 'activo') {
            return res.status(403).json({
                success: false,
                message: `Tu cuenta está ${user.estado}. Comunícate con administración.`
            });
        }

        // Comparar contraseña con bcrypt
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: 'Correo o contraseña incorrectos.'
            });
        }

        // Guardar sesión en Express
        req.session.userId = user.id;

        // Saludo personalizado por rol
        let welcomeMsg = `Bienvenida, ${user.nombre} ✨`;
        let roleBadge = 'Cliente VIP';
        if (user.rol_id === 1 || user.rol_nombre.toLowerCase() === 'administrador') {
            welcomeMsg = `Bienvenido, ${user.nombre} 👑`;
            roleBadge = 'Administrador';
        } else if (user.rol_id === 3 || user.rol_nombre.toLowerCase() === 'manicurista') {
            welcomeMsg = `Bienvenida, ${user.nombre} 💅`;
            roleBadge = 'Manicurista';
        }

        const safeUser = {
            id: user.id,
            rol_id: user.rol_id,
            rol: user.rol_nombre,
            rol_nombre: user.rol_nombre,
            nombre: user.nombre,
            apellido: user.apellido || '',
            nombre_completo: `${user.nombre} ${user.apellido || ''}`.trim(),
            email: user.email,
            telefono: user.telefono || '',
            descuento_vip: user.descuento_vip || 0,
            estado: user.estado,
            saludo: welcomeMsg,
            badge: roleBadge
        };

        req.session.save((err) => {
            if (err) console.error('Error al guardar sesión:', err);
            return res.json({
                success: true,
                message: `¡${welcomeMsg}! Sesión iniciada correctamente.`,
                data: {
                    usuario: safeUser,
                    redirect: user.rol_id === 1 ? '/admin/index.html' : '/index.html'
                }
            });
        });
    } catch (err) {
        console.error('Error en /api/login:', err);
        return res.status(500).json({
            success: false,
            message: 'Ocurrió un error en el servidor al iniciar sesión.'
        });
    }
});

/**
 * POST /register
 */
router.post('/register', async (req, res) => {
    try {
        const { nombre, apellido, email, telefono, password, confirm_password, password_confirm } = req.body || {};

        if (!nombre || !nombre.trim()) {
            return res.status(400).json({
                success: false,
                message: 'Por favor ingresa tu nombre.'
            });
        }

        if (!email || !email.trim()) {
            return res.status(400).json({
                success: false,
                message: 'Por favor ingresa tu correo electrónico.'
            });
        }

        const normalizedEmail = email.trim().toLowerCase();
        if (!EMAIL_REGEX.test(normalizedEmail)) {
            return res.status(400).json({
                success: false,
                message: 'El formato del correo electrónico no es válido.'
            });
        }

        if (!password) {
            return res.status(400).json({
                success: false,
                message: 'Por favor ingresa una contraseña.'
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'La contraseña debe tener al menos 6 caracteres.'
            });
        }

        const confirmation = confirm_password || password_confirm;
        if (confirmation && confirmation !== password) {
            return res.status(400).json({
                success: false,
                message: 'La confirmación de la contraseña no coincide.'
            });
        }

        // Verificar si el correo ya existe
        const existing = Database.get('SELECT id FROM usuarios WHERE LOWER(email) = ?', [normalizedEmail]);
        if (existing) {
            return res.status(409).json({
                success: false,
                message: 'Este correo ya está registrado.'
            });
        }

        // Generar hash seguro con bcrypt
        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(password, salt);

        // Rol por defecto: Cliente (id: 2), Descuento VIP 15%
        const result = Database.run(
            `INSERT INTO usuarios (rol_id, nombre, apellido, email, telefono, password_hash, descuento_vip, estado)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [2, nombre.trim(), (apellido || '').trim(), normalizedEmail, (telefono || '').trim(), password_hash, 15.00, 'activo']
        );

        const newUserId = result.lastInsertRowid;

        // Iniciar sesión automáticamente
        req.session.userId = newUserId;

        const safeUser = {
            id: newUserId,
            rol_id: 2,
            rol: 'Cliente',
            rol_nombre: 'Cliente',
            nombre: nombre.trim(),
            apellido: (apellido || '').trim(),
            nombre_completo: `${nombre.trim()} ${(apellido || '').trim()}`.trim(),
            email: normalizedEmail,
            telefono: (telefono || '').trim(),
            descuento_vip: 15.00,
            estado: 'activo',
            saludo: `Bienvenida, ${nombre.trim()} ✨`,
            badge: 'Cliente VIP'
        };

        req.session.save((err) => {
            if (err) console.error('Error al guardar sesión en registro:', err);
            return res.status(201).json({
                success: true,
                message: 'Cuenta creada correctamente.',
                data: {
                    usuario: safeUser,
                    descuento_vip: 15.00
                }
            });
        });
    } catch (err) {
        console.error('Error en /api/register:', err);
        return res.status(500).json({
            success: false,
            message: 'Error al registrar la cuenta.'
        });
    }
});

/**
 * ALL /logout
 */
router.all('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            console.error('Error al destruir sesión:', err);
            return res.status(500).json({ success: false, message: 'Error al cerrar sesión.' });
        }
        res.clearCookie('connect.sid');
        if (req.accepts('html') && !req.xhr && req.headers['accept']?.includes('text/html')) {
            return res.redirect('/index.html?logout=success');
        }
        return res.json({
            success: true,
            message: 'Sesión cerrada correctamente.'
        });
    });
});

/**
 * GET /me
 */
router.get('/me', (req, res) => {
    if (!req.session || !req.session.userId) {
        return res.json({
            success: false,
            authenticated: false,
            user: null,
            message: 'No hay sesión activa.'
        });
    }

    try {
        const user = Database.get(
            `SELECT u.id, u.rol_id, u.nombre, u.apellido, u.email, u.telefono, 
                    u.descuento_vip, u.estado, u.fecha_registro, r.nombre AS rol_nombre
             FROM usuarios u
             INNER JOIN roles r ON u.rol_id = r.id
             WHERE u.id = ? AND u.estado = 'activo'`,
            [req.session.userId]
        );

        if (!user) {
            req.session.userId = null;
            return res.json({
                success: false,
                authenticated: false,
                user: null,
                message: 'Usuario no encontrado o inactivo.'
            });
        }

        let welcomeMsg = `Bienvenida, ${user.nombre} ✨`;
        let roleBadge = 'Cliente VIP';
        if (user.rol_id === 1 || user.rol_nombre.toLowerCase() === 'administrador') {
            welcomeMsg = `Bienvenido, ${user.nombre} 👑`;
            roleBadge = 'Administrador';
        } else if (user.rol_id === 3 || user.rol_nombre.toLowerCase() === 'manicurista') {
            welcomeMsg = `Bienvenida, ${user.nombre} 💅`;
            roleBadge = 'Manicurista';
        }

        return res.json({
            success: true,
            authenticated: true,
            user: {
                id: user.id,
                rol_id: user.rol_id,
                rol: user.rol_nombre,
                rol_nombre: user.rol_nombre,
                nombre: user.nombre,
                apellido: user.apellido || '',
                nombre_completo: `${user.nombre} ${user.apellido || ''}`.trim(),
                email: user.email,
                telefono: user.telefono || '',
                descuento_vip: user.descuento_vip || 0,
                estado: user.estado,
                fecha_registro: user.fecha_registro,
                saludo: welcomeMsg,
                badge: roleBadge
            }
        });
    } catch (err) {
        console.error('Error en /api/me:', err);
        return res.status(500).json({ success: false, message: 'Error al consultar la sesión.' });
    }
});

module.exports = router;
