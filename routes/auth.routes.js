/**
 * NailArtist Studio — Auth Routes
 * Manejo de Login, Registro, Logout y Estado de Sesión con validaciones estrictas y bcrypt
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const Database = require('../database/db');
const {
    validarEmail,
    validarPassword,
    validarNombre,
    validarTelefono,
    requireAuth,
    errorResponse,
    stripHtml
} = require('../middleware/validation');

/**
 * POST /login
 */
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body || {};

        const emailLimpio = validarEmail(email);
        if (!emailLimpio) {
            return errorResponse(res, 400, 'Ingresa un correo electrónico válido.', 'email');
        }

        if (!validarPassword(password)) {
            return errorResponse(res, 400, 'La contraseña es obligatoria.', 'password');
        }

        // Buscar usuario en SQLite
        const user = Database.get(
            `SELECT u.*, r.nombre AS rol_nombre 
             FROM usuarios u 
             INNER JOIN roles r ON u.rol_id = r.id 
             WHERE LOWER(u.email) = ?`,
            [emailLimpio]
        );

        if (!user) {
            return errorResponse(res, 401, 'Correo o contraseña incorrectos.');
        }

        // Validar estado de la cuenta
        if (user.estado !== 'activo') {
            return errorResponse(res, 403, `Tu cuenta está ${user.estado}. Comunícate con administración.`);
        }

        // Comparar contraseña con bcrypt
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return errorResponse(res, 401, 'Correo o contraseña incorrectos.');
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
        return errorResponse(res, 500, 'Ocurrió un error en el servidor al iniciar sesión.');
    }
});

/**
 * POST /register
 */
router.post('/register', async (req, res) => {
    try {
        const { nombre, apellido, email, telefono, password, confirm_password, password_confirm } = req.body || {};

        // Validar nombre (obligatorio)
        const nombreLimpio = validarNombre(nombre, { min: 2, max: 60 });
        if (!nombreLimpio) {
            return errorResponse(res, 400, 'Ingresa un nombre válido (2–60 letras, sin números ni símbolos especiales).', 'nombre');
        }

        // Validar apellido (opcional, pero si se ingresa debe ser válido)
        let apellidoLimpio = '';
        if (apellido && apellido.trim()) {
            const ap = validarNombre(apellido, { min: 2, max: 60 });
            if (ap === null) {
                return errorResponse(res, 400, 'El apellido ingresado no es válido.', 'apellido');
            }
            apellidoLimpio = ap;
        }

        // Validar email
        const emailLimpio = validarEmail(email);
        if (!emailLimpio) {
            return errorResponse(res, 400, 'Ingresa un correo electrónico válido.', 'email');
        }

        // Validar contraseña
        const pwdLimpio = validarPassword(password, { min: 6, max: 128 });
        if (!pwdLimpio) {
            return errorResponse(res, 400, 'La contraseña debe tener entre 6 y 128 caracteres.', 'password');
        }

        // Confirmar contraseña (si se envía)
        const confirmation = confirm_password || password_confirm;
        if (confirmation && confirmation !== password) {
            return errorResponse(res, 400, 'La confirmación de la contraseña no coincide.', 'confirm_password');
        }

        // Validar teléfono (opcional)
        let telLimpio = '';
        if (telefono && telefono.trim()) {
            const tel = validarTelefono(telefono);
            if (tel === null) {
                return errorResponse(res, 400, 'El número de teléfono ingresado no es válido.', 'telefono');
            }
            telLimpio = tel;
        }

        // Verificar si el correo ya existe
        const existing = Database.get('SELECT id FROM usuarios WHERE LOWER(email) = ?', [emailLimpio]);
        if (existing) {
            return errorResponse(res, 409, 'Este correo ya está registrado. ¿Olvidaste tu contraseña?');
        }

        // Generar hash seguro con bcrypt
        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(pwdLimpio, salt);

        // Rol por defecto: Cliente (id: 2)
        const result = Database.run(
            `INSERT INTO usuarios (rol_id, nombre, apellido, email, telefono, password_hash, descuento_vip, estado)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [2, nombreLimpio, apellidoLimpio, emailLimpio, telLimpio, password_hash, 0.00, 'activo']
        );

        const newUserId = result.lastInsertRowid;

        // Iniciar sesión automáticamente
        req.session.userId = newUserId;

        const safeUser = {
            id: newUserId,
            rol_id: 2,
            rol: 'Cliente',
            rol_nombre: 'Cliente',
            nombre: nombreLimpio,
            apellido: apellidoLimpio,
            nombre_completo: `${nombreLimpio} ${apellidoLimpio}`.trim(),
            email: emailLimpio,
            telefono: telLimpio,
            descuento_vip: 0,
            estado: 'activo',
            saludo: `Bienvenida, ${nombreLimpio}`,
            badge: 'Cliente Registrado'
        };

        req.session.save((err) => {
            if (err) console.error('Error al guardar sesión en registro:', err);
            return res.status(201).json({
                success: true,
                message: 'Cuenta creada correctamente.',
                data: {
                    usuario: safeUser,
                    descuento_vip: 0
                }
            });
        });
    } catch (err) {
        console.error('Error en /api/register:', err);
        return errorResponse(res, 500, 'Error al registrar la cuenta.');
    }
});

/**
 * ALL /logout
 */
router.all('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            console.error('Error al destruir sesión:', err);
            return errorResponse(res, 500, 'Error al cerrar sesión.');
        }
        res.clearCookie('connect.sid');
        if (req.accepts('html') && !req.xhr && req.headers['accept'] && req.headers['accept'].includes('text/html')) {
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
                    u.descuento_vip, u.estado, u.fecha_registro, u.foto, u.especialidades_texto, r.nombre AS rol_nombre
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

        let welcomeMsg = `Bienvenida, ${user.nombre}`;
        let roleBadge = 'Cliente';
        if (user.rol_id === 1 || (user.rol_nombre || '').toLowerCase() === 'administrador') {
            welcomeMsg = `Bienvenido, ${user.nombre}`;
            roleBadge = 'Administrador';
        } else if (user.rol_id === 3 || (user.rol_nombre || '').toLowerCase() === 'manicurista') {
            welcomeMsg = `Bienvenida, ${user.nombre}`;
            roleBadge = 'Manicurista Profesional';
        }

        // Calcular historial de compras y beneficio aplicable
        const countRow = Database.get(
            "SELECT COUNT(*) AS total FROM citas WHERE usuario_id = ? AND estado IN ('Confirmada', 'Completada')",
            [user.id]
        );
        const comprasRealizadas = countRow ? parseInt(countRow.total, 10) : 0;
        const proximaCompra = comprasRealizadas + 1;

        let descuentoActivoPorcentaje = 0;
        let beneficioNombre = 'Tarifa Estándar';

        const customDesc = Math.round(parseFloat(user.descuento_vip || 0));

        if (customDesc > 0) {
            descuentoActivoPorcentaje = customDesc;
            beneficioNombre = `Descuento Personalizado (${customDesc}%)`;
        } else {
            const c1 = Database.get("SELECT valor FROM configuracion WHERE clave = 'descuento_compra_1'");
            const c2 = Database.get("SELECT valor FROM configuracion WHERE clave = 'descuento_compra_2'");
            const c3 = Database.get("SELECT valor FROM configuracion WHERE clave = 'descuento_compra_3'");
            const c4 = Database.get("SELECT valor FROM configuracion WHERE clave = 'descuento_compra_4_mas'");

            const pct1 = c1 ? Math.round(parseFloat(c1.valor)) : 15;
            const pct2 = c2 ? Math.round(parseFloat(c2.valor)) : 5;
            const pct3 = c3 ? Math.round(parseFloat(c3.valor)) : 3;
            const pct4 = c4 ? Math.round(parseFloat(c4.valor)) : 0;

            if (proximaCompra === 1) {
                descuentoActivoPorcentaje = pct1;
                beneficioNombre = `Beneficio 1ra Compra (${pct1}% OFF)`;
            } else if (proximaCompra === 2) {
                descuentoActivoPorcentaje = pct2;
                beneficioNombre = `Beneficio 2da Compra (${pct2}% OFF)`;
            } else if (proximaCompra === 3) {
                descuentoActivoPorcentaje = pct3;
                beneficioNombre = `Beneficio 3ra Compra (${pct3}% OFF)`;
            } else {
                descuentoActivoPorcentaje = pct4;
                beneficioNombre = pct4 > 0 ? `Beneficio Compra #${proximaCompra} (${pct4}% OFF)` : 'Cliente Frecuente';
            }
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
                descuento_vip: customDesc,
                descuento_activo_porcentaje: descuentoActivoPorcentaje,
                beneficio_nombre: beneficioNombre,
                compras_realizadas: comprasRealizadas,
                proxima_compra_numero: proximaCompra,
                foto: user.foto || null,
                especialidades_texto: user.especialidades_texto || null,
                estado: user.estado,
                fecha_registro: user.fecha_registro,
                saludo: welcomeMsg,
                badge: roleBadge
            }
        });
    } catch (err) {
        console.error('Error en /api/me:', err);
        return errorResponse(res, 500, 'Error al consultar la sesión.');
    }
});

/**
 * PUT /perfil
 * Actualizar datos de contacto seguros del usuario autenticado (Nombre, Apellido, Teléfono)
 */
router.put('/perfil', requireAuth, async (req, res) => {
    const userId = req.user ? req.user.id : (req.session ? req.session.userId : null);

    try {
        const { nombre, apellido, telefono, password, current_password } = req.body || {};

        // Validar nombre (obligatorio)
        const nombreLimpio = validarNombre(nombre, { min: 2, max: 60 });
        if (!nombreLimpio) {
            return errorResponse(res, 400, 'El nombre ingresado no es válido (2–60 letras).', 'nombre');
        }

        // Apellido opcional
        let apellidoLimpio = '';
        if (apellido && apellido.trim()) {
            const ap = validarNombre(apellido, { min: 2, max: 60 });
            if (ap === null) {
                return errorResponse(res, 400, 'El apellido ingresado no es válido.', 'apellido');
            }
            apellidoLimpio = ap;
        }

        // Teléfono opcional
        let telLimpio = '';
        if (telefono && telefono.trim()) {
            const tel = validarTelefono(telefono);
            if (tel === null) {
                return errorResponse(res, 400, 'El número de teléfono no es válido.', 'telefono');
            }
            telLimpio = tel;
        }

        const currentUser = Database.get('SELECT * FROM usuarios WHERE id = ?', [userId]);
        if (!currentUser) {
            return errorResponse(res, 404, 'Usuario no encontrado.');
        }

        // Si desea cambiar contraseña
        if (password && password.trim().length > 0) {
            const pwdNueva = validarPassword(password, { min: 6, max: 128 });
            if (!pwdNueva) {
                return errorResponse(res, 400, 'La nueva contraseña debe tener entre 6 y 128 caracteres.', 'password');
            }
            // La contraseña actual es OBLIGATORIA para hacer el cambio
            if (!current_password) {
                return errorResponse(res, 400, 'Debes ingresar tu contraseña actual para cambiarla.', 'current_password');
            }
            const isMatch = await bcrypt.compare(current_password, currentUser.password_hash);
            if (!isMatch) {
                return errorResponse(res, 400, 'La contraseña actual no es correcta.', 'current_password');
            }
            const salt = await bcrypt.genSalt(10);
            const pwdHash = await bcrypt.hash(pwdNueva, salt);
            Database.run(
                'UPDATE usuarios SET nombre = ?, apellido = ?, telefono = ?, password_hash = ? WHERE id = ?',
                [nombreLimpio, apellidoLimpio, telLimpio, pwdHash, userId]
            );
        } else {
            Database.run(
                'UPDATE usuarios SET nombre = ?, apellido = ?, telefono = ? WHERE id = ?',
                [nombreLimpio, apellidoLimpio, telLimpio, userId]
            );
        }

        const updatedUser = Database.get(
            `SELECT u.id, u.rol_id, u.nombre, u.apellido, u.email, u.telefono, 
                    u.descuento_vip, u.estado, u.fecha_registro, r.nombre AS rol_nombre
             FROM usuarios u
             INNER JOIN roles r ON u.rol_id = r.id
             WHERE u.id = ?`,
            [userId]
        );

        return res.json({
            success: true,
            message: 'Tus datos han sido actualizados correctamente ✨',
            data: updatedUser
        });
    } catch (err) {
        console.error('Error al actualizar perfil:', err);
        return errorResponse(res, 500, 'Error al actualizar tus datos.');
    }
});

module.exports = router;


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

        // Rol por defecto: Cliente (id: 2), Descuento personalizado por defecto 0 (para que aplique el beneficio de 1ra compra: 15%)
        const result = Database.run(
            `INSERT INTO usuarios (rol_id, nombre, apellido, email, telefono, password_hash, descuento_vip, estado)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [2, nombre.trim(), (apellido || '').trim(), normalizedEmail, (telefono || '').trim(), password_hash, 0.00, 'activo']
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
            descuento_vip: 0,
            estado: 'activo',
            saludo: `Bienvenida, ${nombre.trim()}`,
            badge: 'Cliente Registrado'
        };

        req.session.save((err) => {
            if (err) console.error('Error al guardar sesión en registro:', err);
            return res.status(201).json({
                success: true,
                message: 'Cuenta creada correctamente.',
                data: {
                    usuario: safeUser,
                    descuento_vip: 0
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
                    u.descuento_vip, u.estado, u.fecha_registro, u.foto, u.especialidades_texto, r.nombre AS rol_nombre
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

        let welcomeMsg = `Bienvenida, ${user.nombre}`;
        let roleBadge = 'Cliente';
        if (user.rol_id === 1 || (user.rol_nombre || '').toLowerCase() === 'administrador') {
            welcomeMsg = `Bienvenido, ${user.nombre}`;
            roleBadge = 'Administrador';
        } else if (user.rol_id === 3 || (user.rol_nombre || '').toLowerCase() === 'manicurista') {
            welcomeMsg = `Bienvenida, ${user.nombre}`;
            roleBadge = 'Manicurista Profesional';
        }

        // Calcular historial de compras y beneficio aplicable
        const countRow = Database.get(
            "SELECT COUNT(*) AS total FROM citas WHERE usuario_id = ? AND estado IN ('Confirmada', 'Completada')",
            [user.id]
        );
        const comprasRealizadas = countRow ? parseInt(countRow.total, 10) : 0;
        const proximaCompra = comprasRealizadas + 1;

        let descuentoActivoPorcentaje = 0;
        let beneficioNombre = 'Tarifa Estándar';

        const customDesc = Math.round(parseFloat(user.descuento_vip || 0));

        if (customDesc > 0) {
            descuentoActivoPorcentaje = customDesc;
            beneficioNombre = `Descuento Personalizado (${customDesc}%)`;
        } else {
            const c1 = Database.get("SELECT valor FROM configuracion WHERE clave = 'descuento_compra_1'");
            const c2 = Database.get("SELECT valor FROM configuracion WHERE clave = 'descuento_compra_2'");
            const c3 = Database.get("SELECT valor FROM configuracion WHERE clave = 'descuento_compra_3'");
            const c4 = Database.get("SELECT valor FROM configuracion WHERE clave = 'descuento_compra_4_mas'");

            const pct1 = c1 ? Math.round(parseFloat(c1.valor)) : 15;
            const pct2 = c2 ? Math.round(parseFloat(c2.valor)) : 5;
            const pct3 = c3 ? Math.round(parseFloat(c3.valor)) : 3;
            const pct4 = c4 ? Math.round(parseFloat(c4.valor)) : 0;

            if (proximaCompra === 1) {
                descuentoActivoPorcentaje = pct1;
                beneficioNombre = `Beneficio 1ra Compra (${pct1}% OFF)`;
            } else if (proximaCompra === 2) {
                descuentoActivoPorcentaje = pct2;
                beneficioNombre = `Beneficio 2da Compra (${pct2}% OFF)`;
            } else if (proximaCompra === 3) {
                descuentoActivoPorcentaje = pct3;
                beneficioNombre = `Beneficio 3ra Compra (${pct3}% OFF)`;
            } else {
                descuentoActivoPorcentaje = pct4;
                beneficioNombre = pct4 > 0 ? `Beneficio Compra #${proximaCompra} (${pct4}% OFF)` : 'Cliente Frecuente';
            }
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
                descuento_vip: customDesc,
                descuento_activo_porcentaje: descuentoActivoPorcentaje,
                beneficio_nombre: beneficioNombre,
                compras_realizadas: comprasRealizadas,
                proxima_compra_numero: proximaCompra,
                foto: user.foto || null,
                especialidades_texto: user.especialidades_texto || null,
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

/**
 * PUT /perfil
 * Actualizar datos de contacto seguros del usuario autenticado (Nombre, Apellido, Teléfono)
 */
router.put('/perfil', async (req, res) => {
    const userId = req.user ? req.user.id : (req.session ? req.session.userId : null);
    if (!userId) {
        return res.status(401).json({ success: false, message: 'Debes iniciar sesión para actualizar tus datos.' });
    }

    try {
        const { nombre, apellido, telefono, password, current_password } = req.body || {};

        if (!nombre || !nombre.trim()) {
            return res.status(400).json({ success: false, message: 'El nombre es obligatorio.' });
        }

        const currentUser = Database.get('SELECT * FROM usuarios WHERE id = ?', [userId]);
        if (!currentUser) {
            return res.status(404).json({ success: false, message: 'Usuario no encontrado.' });
        }

        // Si desea cambiar contraseña
        if (password && password.trim().length > 0) {
            if (password.trim().length < 6) {
                return res.status(400).json({ success: false, message: 'La nueva contraseña debe tener al menos 6 caracteres.' });
            }
            if (current_password) {
                const isMatch = await bcrypt.compare(current_password, currentUser.password_hash);
                if (!isMatch) {
                    return res.status(400).json({ success: false, message: 'La contraseña actual no es correcta.' });
                }
            }
            const salt = await bcrypt.genSalt(10);
            const pwdHash = await bcrypt.hash(password.trim(), salt);
            Database.run(
                'UPDATE usuarios SET nombre = ?, apellido = ?, telefono = ?, password_hash = ? WHERE id = ?',
                [nombre.trim(), (apellido || '').trim(), (telefono || '').trim(), pwdHash, userId]
            );
        } else {
            Database.run(
                'UPDATE usuarios SET nombre = ?, apellido = ?, telefono = ? WHERE id = ?',
                [nombre.trim(), (apellido || '').trim(), (telefono || '').trim(), userId]
            );
        }

        const updatedUser = Database.get(
            `SELECT u.id, u.rol_id, u.nombre, u.apellido, u.email, u.telefono, 
                    u.descuento_vip, u.estado, u.fecha_registro, r.nombre AS rol_nombre
             FROM usuarios u
             INNER JOIN roles r ON u.rol_id = r.id
             WHERE u.id = ?`,
            [userId]
        );

        return res.json({
            success: true,
            message: 'Tus datos han sido actualizados correctamente ✨',
            data: updatedUser
        });
    } catch (err) {
        console.error('Error al actualizar perfil:', err);
        return res.status(500).json({ success: false, message: 'Error al actualizar tus datos.' });
    }
});

module.exports = router;
