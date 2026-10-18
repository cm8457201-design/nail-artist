/**
 * NailArtist Studio — Admin API Routes
 * Panel de Control, Métricas KPIs, CRUD de Usuarios (Edición y cambio de roles Cliente ↔ Manicurista),
 * Gestión de Manicuristas, Asignación de Citas, Servicios, Reseñas y Mensajes
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const Database = require('../database/db');
const { requireAdmin } = require('../middleware/auth');
const {
    errorResponse,
    validarEmail,
    validarNombre,
    validarPassword,
    validarTelefono,
    validarRol,
    validarId,
    validarPrecio,
    validarDuracion,
    validarPorcentaje,
    validarEstadoUsuario,
    validarTexto,
    validarImagenBase64,
    nombreArchivoSeguro,
    stripHtml
} = require('../middleware/validation');

// Todas las rutas administrativas requieren permisos de Administrador
router.use(requireAdmin);

// =============================================================================
// 1. DASHBOARD & MÉTRICAS (KPIs)
// =============================================================================
router.get('/dashboard', (req, res) => {
    try {
        const totalUsuarios = Database.get('SELECT COUNT(*) AS count FROM usuarios')?.count || 0;
        const totalClientes = Database.get('SELECT COUNT(*) AS count FROM usuarios WHERE rol_id = 2')?.count || 0;
        const totalManicuristas = Database.get('SELECT COUNT(*) AS count FROM usuarios WHERE rol_id = 3')?.count || 0;
        const totalAdmins = Database.get('SELECT COUNT(*) AS count FROM usuarios WHERE rol_id = 1')?.count || 0;

        const totalServicios = Database.get("SELECT COUNT(*) AS count FROM servicios WHERE estado = 'activo'")?.count || 0;

        const totalCitas = Database.get('SELECT COUNT(*) AS count FROM citas')?.count || 0;
        const citasPendientes = Database.get("SELECT COUNT(*) AS count FROM citas WHERE estado = 'Pendiente'")?.count || 0;
        const citasConfirmadas = Database.get("SELECT COUNT(*) AS count FROM citas WHERE estado = 'Confirmada'")?.count || 0;
        const citasCompletadas = Database.get("SELECT COUNT(*) AS count FROM citas WHERE estado = 'Completada'")?.count || 0;
        const citasCanceladas = Database.get("SELECT COUNT(*) AS count FROM citas WHERE estado = 'Cancelada'")?.count || 0;

        const ingresosResult = Database.get("SELECT COALESCE(SUM(total_final_bs), 0) AS total FROM citas WHERE estado IN ('Confirmada', 'Completada')");
        const ingresosTotalesBs = parseFloat(ingresosResult?.total || 0);

        const ratingResult = Database.get('SELECT COALESCE(AVG(calificacion), 5.0) AS avg FROM resenas WHERE publicado = 1');
        const promedioCalificacion = parseFloat(ratingResult?.avg || 5.0);

        const totalMensajes = Database.get('SELECT COUNT(*) AS count FROM contactos')?.count || 0;
        const mensajesNoLeidos = Database.get('SELECT COUNT(*) AS count FROM contactos WHERE leido = 0')?.count || 0;
        const totalResenas = Database.get('SELECT COUNT(*) AS count FROM resenas')?.count || 0;

        // Citas recientes
        const ultimasCitas = Database.all(`
            SELECT c.*, 
                   u.nombre AS cliente_nombre, u.apellido AS cliente_apellido, u.telefono AS cliente_telefono, u.email AS cliente_email,
                   m.nombre AS manicurista_nombre, m.apellido AS manicurista_apellido
            FROM citas c
            INNER JOIN usuarios u ON c.usuario_id = u.id
            LEFT JOIN usuarios m ON c.manicurista_id = m.id
            ORDER BY c.id DESC LIMIT 5
        `);

        // Mensajes recientes
        const ultimosMensajes = Database.all('SELECT * FROM contactos ORDER BY id DESC LIMIT 5');

        // Reseñas recientes
        const ultimasResenas = Database.all(`
            SELECT r.*, u.nombre AS usuario_nombre, u.apellido AS usuario_apellido, s.nombre AS servicio_nombre
            FROM resenas r
            INNER JOIN usuarios u ON r.usuario_id = u.id
            LEFT JOIN servicios s ON r.servicio_id = s.id
            ORDER BY r.id DESC LIMIT 5
        `);

        return res.json({
            success: true,
            data: {
                kpis: {
                    totalUsuarios,
                    totalClientes,
                    totalManicuristas,
                    totalAdmins,
                    totalServicios,
                    totalCitas,
                    citasPendientes,
                    citasConfirmadas,
                    citasCompletadas,
                    citasCanceladas,
                    ingresosTotalesBs,
                    promedioCalificacion: Number(promedioCalificacion.toFixed(1)),
                    totalMensajes,
                    mensajesNoLeidos,
                    totalResenas
                },
                ultimasCitas,
                ultimosMensajes,
                ultimasResenas
            }
        });
    } catch (err) {
        console.error('Error al obtener dashboard stats:', err);
        return res.status(500).json({ success: false, message: 'Error al calcular métricas.' });
    }
});

// =============================================================================
// 2. GESTIÓN DE USUARIOS Y ROLES (Cliente ↔ Manicurista)
// =============================================================================

// Listar usuarios
router.get('/usuarios', (req, res) => {
    try {
        const { rol_id, estado, search } = req.query;
        let sql = `
            SELECT u.id, u.rol_id, u.nombre, u.apellido, u.email, u.telefono, 
                   u.descuento_vip, u.estado, u.fecha_registro,
                   COALESCE(u.foto_perfil, u.foto) AS foto_perfil,
                   COALESCE(u.foto, u.foto_perfil) AS foto,
                   COALESCE(u.cargo_especialidad, u.especialidades_texto, 'Manicurista Profesional') AS cargo_especialidad,
                   u.especialidades_texto, u.descripcion,
                   COALESCE(u.experiencia_anios, 3) AS experiencia_anios,
                   r.nombre AS rol_nombre,
                   (SELECT COUNT(*) FROM citas c WHERE c.usuario_id = u.id) AS total_citas_cliente,
                   (SELECT COUNT(*) FROM citas c WHERE c.manicurista_id = u.id) AS total_citas_manicurista
            FROM usuarios u
            INNER JOIN roles r ON u.rol_id = r.id
            WHERE 1=1
        `;
        const params = [];

        if (rol_id) {
            sql += ' AND u.rol_id = ?';
            params.push(parseInt(rol_id, 10));
        }

        if (estado) {
            sql += ' AND u.estado = ?';
            params.push(estado);
        }

        if (search) {
            sql += ' AND (u.nombre LIKE ? OR u.apellido LIKE ? OR u.email LIKE ? OR u.telefono LIKE ?)';
            const q = `%${search}%`;
            params.push(q, q, q, q);
        }

        sql += ' ORDER BY u.id DESC';

        const usuarios = Database.all(sql, params);
        const roles = Database.all('SELECT * FROM roles ORDER BY id ASC');

        return res.json({
            success: true,
            total: usuarios.length,
            data: usuarios,
            roles
        });
    } catch (err) {
        console.error('Error al listar usuarios admin:', err);
        return res.status(500).json({ success: false, message: 'Error al listar usuarios.' });
    }
});

// Obtener un usuario por ID
router.get('/usuarios/:id', (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id) || id <= 0) {
            return res.status(400).json({ success: false, message: 'ID de usuario inválido.' });
        }

        const usuario = Database.get(`
            SELECT u.id, u.rol_id, u.nombre, u.apellido, u.email, u.telefono, 
                   u.descuento_vip, u.estado, u.fecha_registro,
                   COALESCE(u.foto_perfil, u.foto) AS foto_perfil,
                   COALESCE(u.foto, u.foto_perfil) AS foto,
                   COALESCE(u.cargo_especialidad, u.especialidades_texto, 'Manicurista Profesional') AS cargo_especialidad,
                   u.especialidades_texto, u.descripcion,
                   COALESCE(u.experiencia_anios, 3) AS experiencia_anios,
                   r.nombre AS rol_nombre
            FROM usuarios u
            INNER JOIN roles r ON u.rol_id = r.id
            WHERE u.id = ?
        `, [id]);

        if (!usuario) {
            return res.status(404).json({ success: false, message: 'Usuario no encontrado.' });
        }

        return res.json({ success: true, data: usuario });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Error al consultar usuario.' });
    }
});

// Cambiar rol de usuario (Cliente ↔ Manicurista) de forma explícita y segura
router.put('/usuarios/:id/rol', (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        const { rol_id } = req.body;
        const targetRolId = parseInt(rol_id, 10);

        if (![1, 2, 3].includes(targetRolId)) {
            return res.status(400).json({ success: false, message: 'Rol inválido. Debe ser 1 (Admin), 2 (Cliente) o 3 (Manicurista).' });
        }

        const usuario = Database.get('SELECT * FROM usuarios WHERE id = ?', [id]);
        if (!usuario) {
            return res.status(404).json({ success: false, message: 'Usuario no encontrado.' });
        }

        Database.run('UPDATE usuarios SET rol_id = ? WHERE id = ?', [targetRolId, id]);

        const rolInfo = Database.get('SELECT nombre FROM roles WHERE id = ?', [targetRolId]);

        return res.json({
            success: true,
            message: `Rol del usuario ${usuario.nombre} actualizado a "${rolInfo?.nombre}".`,
            data: { id, rol_id: targetRolId, rol_nombre: rolInfo?.nombre }
        });
    } catch (err) {
        console.error('Error al cambiar rol:', err);
        return res.status(500).json({ success: false, message: 'Error al cambiar rol del usuario.' });
    }
});

// Asignar o editar Descuento Personalizado de un cliente específico
router.put('/usuarios/:id/descuento', (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id) || id <= 0) {
            return res.status(400).json({ success: false, message: 'ID de usuario inválido.' });
        }

        const usuario = Database.get('SELECT id, nombre, apellido, email, rol_id, descuento_vip FROM usuarios WHERE id = ?', [id]);
        if (!usuario) {
            return res.status(404).json({ success: false, message: 'Usuario no encontrado.' });
        }

        const { descuento, remover } = req.body;
        let nuevoDescuento = 0;

        if (remover === true || descuento === null || descuento === '' || descuento === 0) {
            nuevoDescuento = 0;
        } else {
            const descNum = parseFloat(descuento);
            if (isNaN(descNum) || descNum < 0 || descNum > 100) {
                return res.status(400).json({ success: false, message: 'El descuento debe ser un porcentaje numérico válido entre 0 y 100.' });
            }
            nuevoDescuento = Math.round(descNum * 100) / 100;
        }

        Database.run('UPDATE usuarios SET descuento_vip = ? WHERE id = ?', [nuevoDescuento, id]);

        const nombreComp = `${usuario.nombre} ${usuario.apellido || ''}`.trim();
        const msg = nuevoDescuento > 0 
            ? `Descuento personalizado del ${nuevoDescuento}% asignado a ${nombreComp}.`
            : `Descuento personalizado removido para ${nombreComp}. Ahora utilizará el descuento general.`;

        return res.json({
            success: true,
            message: msg,
            data: {
                id,
                nombre: nombreComp,
                descuento_personalizado: nuevoDescuento,
                usa_descuento_general: nuevoDescuento === 0
            }
        });
    } catch (err) {
        console.error('Error al actualizar descuento personalizado:', err);
        return res.status(500).json({ success: false, message: 'Error al actualizar descuento del usuario.' });
    }
});

// =============================================================================
// GESTIÓN DE CONFIGURACIÓN DE DESCUENTOS (GENERAL & CAMPAÑAS)
// =============================================================================

// Obtener configuración del Descuento General
router.get('/configuracion/descuento', (req, res) => {
    try {
        const configDescRow = Database.get("SELECT valor FROM configuracion WHERE clave = 'descuento_general_porcentaje'");
        const configActivoRow = Database.get("SELECT valor FROM configuracion WHERE clave = 'descuento_general_activo'");
        const configNombreRow = Database.get("SELECT valor FROM configuracion WHERE clave = 'descuento_general_nombre'");

        const porcentaje = configDescRow ? Math.round(parseFloat(configDescRow.valor)) : 15;
        const activo = configActivoRow ? configActivoRow.valor === '1' : true;
        const nombre = configNombreRow ? configNombreRow.valor : 'Descuento General de Temporada';

        const totalClientesConDesc = Database.get('SELECT COUNT(*) AS count FROM usuarios WHERE rol_id = 2 AND descuento_vip > 0')?.count || 0;

        return res.json({
            success: true,
            data: {
                porcentaje,
                activo,
                nombre,
                clientes_con_descuento_personalizado: totalClientesConDesc
            }
        });
    } catch (err) {
        console.error('Error al consultar configuración de descuento:', err);
        return res.status(500).json({ success: false, message: 'Error al obtener configuración de descuento.' });
    }
});

// Guardar / Actualizar configuración del Descuento General
router.put('/configuracion/descuento', (req, res) => {
    try {
        const { porcentaje, activo, nombre } = req.body;

        if (porcentaje === undefined || porcentaje === null || isNaN(parseFloat(porcentaje))) {
            return res.status(400).json({ success: false, message: 'El porcentaje de descuento debe ser un valor numérico.' });
        }

        const pctNum = Math.round(parseFloat(porcentaje));
        if (pctNum < 0 || pctNum > 100) {
            return res.status(400).json({ success: false, message: 'El porcentaje debe estar entre 0% y 100%.' });
        }

        const esActivo = activo === true || activo === 1 || activo === '1' || activo === 'true';
        const nombreFinal = (nombre || 'Descuento General de Temporada').trim();

        Database.run(
            "INSERT INTO configuracion (clave, valor, descripcion) VALUES ('descuento_general_porcentaje', ?, 'Porcentaje de descuento general') ON CONFLICT(clave) DO UPDATE SET valor = ?, fecha_actualizacion = CURRENT_TIMESTAMP",
            [String(pctNum), String(pctNum)]
        );

        Database.run(
            "INSERT INTO configuracion (clave, valor, descripcion) VALUES ('descuento_general_activo', ?, 'Estado del descuento general: 1 = Activo, 0 = Inactivo') ON CONFLICT(clave) DO UPDATE SET valor = ?, fecha_actualizacion = CURRENT_TIMESTAMP",
            [esActivo ? '1' : '0', esActivo ? '1' : '0']
        );

        Database.run(
            "INSERT INTO configuracion (clave, valor, descripcion) VALUES ('descuento_general_nombre', ?, 'Nombre o campaña del descuento general') ON CONFLICT(clave) DO UPDATE SET valor = ?, fecha_actualizacion = CURRENT_TIMESTAMP",
            [nombreFinal, nombreFinal]
        );

        return res.json({
            success: true,
            message: `Descuento general configurado a ${pctNum}% (${esActivo ? 'Activo' : 'Desactivado'}).`,
            data: {
                porcentaje: pctNum,
                activo: esActivo,
                nombre: nombreFinal
            }
        });
    } catch (err) {
        console.error('Error al actualizar configuración de descuento:', err);
        return res.status(500).json({ success: false, message: 'Error interno al guardar configuración de descuento.' });
    }
});

// Obtener configuración de "Beneficios por número de compra"
router.get('/configuracion/descuentos-compras', (req, res) => {
    try {
        const c1 = Database.get("SELECT valor FROM configuracion WHERE clave = 'descuento_compra_1'");
        const c2 = Database.get("SELECT valor FROM configuracion WHERE clave = 'descuento_compra_2'");
        const c3 = Database.get("SELECT valor FROM configuracion WHERE clave = 'descuento_compra_3'");
        const c4 = Database.get("SELECT valor FROM configuracion WHERE clave = 'descuento_compra_4_mas'");

        return res.json({
            success: true,
            data: {
                compra_1: c1 ? Math.round(parseFloat(c1.valor)) : 15,
                compra_2: c2 ? Math.round(parseFloat(c2.valor)) : 5,
                compra_3: c3 ? Math.round(parseFloat(c3.valor)) : 3,
                compra_4_mas: c4 ? Math.round(parseFloat(c4.valor)) : 0
            }
        });
    } catch (err) {
        console.error('Error al consultar descuentos por compra:', err);
        return res.status(500).json({ success: false, message: 'Error al consultar beneficios por compra.' });
    }
});

// Guardar configuración de "Beneficios por número de compra"
router.put('/configuracion/descuentos-compras', (req, res) => {
    try {
        const { compra_1, compra_2, compra_3, compra_4_mas } = req.body || {};

        const v1 = parseInt(compra_1, 10);
        const v2 = parseInt(compra_2, 10);
        const v3 = parseInt(compra_3, 10);
        const v4 = parseInt(compra_4_mas, 10);

        if (isNaN(v1) || v1 < 0 || v1 > 100 ||
            isNaN(v2) || v2 < 0 || v2 > 100 ||
            isNaN(v3) || v3 < 0 || v3 > 100 ||
            isNaN(v4) || v4 < 0 || v4 > 100) {
            return res.status(400).json({
                success: false,
                message: 'Todos los valores de descuento deben ser números enteros entre 0% y 100%.'
            });
        }

        Database.run(
            "INSERT INTO configuracion (clave, valor, descripcion) VALUES ('descuento_compra_1', ?, 'Porcentaje para 1ra compra') ON CONFLICT(clave) DO UPDATE SET valor = ?, fecha_actualizacion = CURRENT_TIMESTAMP",
            [String(v1), String(v1)]
        );
        Database.run(
            "INSERT INTO configuracion (clave, valor, descripcion) VALUES ('descuento_compra_2', ?, 'Porcentaje para 2da compra') ON CONFLICT(clave) DO UPDATE SET valor = ?, fecha_actualizacion = CURRENT_TIMESTAMP",
            [String(v2), String(v2)]
        );
        Database.run(
            "INSERT INTO configuracion (clave, valor, descripcion) VALUES ('descuento_compra_3', ?, 'Porcentaje para 3ra compra') ON CONFLICT(clave) DO UPDATE SET valor = ?, fecha_actualizacion = CURRENT_TIMESTAMP",
            [String(v3), String(v3)]
        );
        Database.run(
            "INSERT INTO configuracion (clave, valor, descripcion) VALUES ('descuento_compra_4_mas', ?, 'Porcentaje para 4ta compra en adelante') ON CONFLICT(clave) DO UPDATE SET valor = ?, fecha_actualizacion = CURRENT_TIMESTAMP",
            [String(v4), String(v4)]
        );

        return res.json({
            success: true,
            message: 'Configuración de beneficios por número de compra guardada correctamente.',
            data: {
                compra_1: v1,
                compra_2: v2,
                compra_3: v3,
                compra_4_mas: v4
            }
        });
    } catch (err) {
        console.error('Error al guardar beneficios por compra:', err);
        return res.status(500).json({ success: false, message: 'Error interno al guardar la configuración.' });
    }
});

// Crear usuario desde panel admin
router.post('/usuarios', async (req, res) => {
    try {
        const { nombre, apellido, email, telefono, password, rol_id, estado, descuento_vip, foto, especialidades_texto } = req.body || {};

        // Validar nombre
        const nombreLimpio = validarNombre(nombre, { min: 2, max: 60 });
        if (!nombreLimpio) {
            return errorResponse(res, 400, 'El nombre es obligatorio y debe tener entre 2 y 60 letras.', 'nombre');
        }

        // Validar email
        const emailLimpio = validarEmail(email);
        if (!emailLimpio) {
            return errorResponse(res, 400, 'El correo electrónico no es válido.', 'email');
        }

        // Validar contraseña
        const pwdLimpio = validarPassword(password, { min: 6, max: 128 });
        if (!pwdLimpio) {
            return errorResponse(res, 400, 'La contraseña debe tener entre 6 y 128 caracteres.', 'password');
        }

        // Verificar email duplicado
        const existing = Database.get('SELECT id FROM usuarios WHERE LOWER(email) = ?', [emailLimpio]);
        if (existing) {
            return errorResponse(res, 409, 'El correo electrónico ya está registrado.');
        }

        // Validar rol
        const finalRolId = validarRol(rol_id) || 2;

        // Validar estado
        const finalEstado = validarEstadoUsuario(estado) || 'activo';

        // Validar descuento
        const finalDescuento = validarPorcentaje(descuento_vip) !== null ? validarPorcentaje(descuento_vip) : 0;

        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(pwdLimpio, salt);

        // Apellido (opcional)
        let apellidoLimpio = '';
        if (apellido && apellido.trim()) {
            apellidoLimpio = validarNombre(apellido, { min: 2, max: 60 }) || '';
        }

        // Teléfono (opcional)
        let telLimpio = '';
        if (telefono && telefono.trim()) {
            telLimpio = validarTelefono(telefono) || '';
        }

        const result = Database.run(`
            INSERT INTO usuarios (rol_id, nombre, apellido, email, telefono, password_hash, descuento_vip, estado, foto, especialidades_texto)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [finalRolId, nombreLimpio, apellidoLimpio, emailLimpio, telLimpio, password_hash, finalDescuento, finalEstado, foto || null, especialidades_texto ? stripHtml(especialidades_texto) : null]);

        return res.status(201).json({
            success: true,
            message: `Usuario creado exitosamente con ID #${result.lastInsertRowid}.`,
            data: { id: result.lastInsertRowid, email: emailLimpio, rol_id: finalRolId }
        });
    } catch (err) {
        console.error('Error al crear usuario admin:', err);
        return errorResponse(res, 500, 'Error interno al crear usuario.');
    }
});

// Editar usuario completo
router.put('/usuarios/:id', async (req, res) => {
    try {
        const id = validarId(req.params.id);
        if (!id) {
            return errorResponse(res, 400, 'ID de usuario inválido.');
        }

        const { nombre, apellido, email, telefono, password, rol_id, estado, descuento_vip, foto, especialidades_texto } = req.body || {};

        // Validar nombre
        const nombreLimpio = validarNombre(nombre, { min: 2, max: 60 });
        if (!nombreLimpio) {
            return errorResponse(res, 400, 'El nombre es obligatorio y debe tener entre 2 y 60 letras.', 'nombre');
        }

        // Validar email
        const emailLimpio = validarEmail(email);
        if (!emailLimpio) {
            return errorResponse(res, 400, 'El correo electrónico no es válido.', 'email');
        }

        const duplicate = Database.get('SELECT id FROM usuarios WHERE LOWER(email) = ? AND id != ?', [emailLimpio, id]);
        if (duplicate) {
            return errorResponse(res, 409, 'El correo ya pertenece a otro usuario.');
        }

        const finalRolId = validarRol(rol_id) || 2;
        const finalEstado = validarEstadoUsuario(estado) || 'activo';
        const finalDescuento = validarPorcentaje(descuento_vip) !== null ? validarPorcentaje(descuento_vip) : 0;

        // Apellido (opcional)
        let apellidoLimpio = '';
        if (apellido && apellido.trim()) {
            apellidoLimpio = validarNombre(apellido, { min: 2, max: 60 }) || '';
        }

        // Teléfono (opcional)
        let telLimpio = '';
        if (telefono && telefono.trim()) {
            telLimpio = validarTelefono(telefono) || '';
        }

        if (password && password.trim().length >= 6) {
            const pwdLimpio = validarPassword(password, { min: 6, max: 128 });
            if (!pwdLimpio) {
                return errorResponse(res, 400, 'La contraseña debe tener entre 6 y 128 caracteres.', 'password');
            }
            const salt = await bcrypt.genSalt(10);
            const password_hash = await bcrypt.hash(pwdLimpio, salt);

            Database.run(`
                UPDATE usuarios 
                SET rol_id = ?, nombre = ?, apellido = ?, email = ?, telefono = ?, password_hash = ?, descuento_vip = ?, estado = ?, foto = ?, especialidades_texto = ?
                WHERE id = ?
            `, [finalRolId, nombreLimpio, apellidoLimpio, emailLimpio, telLimpio, password_hash, finalDescuento, finalEstado, foto || null, especialidades_texto ? stripHtml(especialidades_texto) : null, id]);
        } else {
            Database.run(`
                UPDATE usuarios 
                SET rol_id = ?, nombre = ?, apellido = ?, email = ?, telefono = ?, descuento_vip = ?, estado = ?, foto = ?, especialidades_texto = ?
                WHERE id = ?
            `, [finalRolId, nombreLimpio, apellidoLimpio, emailLimpio, telLimpio, finalDescuento, finalEstado, foto || null, especialidades_texto ? stripHtml(especialidades_texto) : null, id]);
        }

        return res.json({
            success: true,
            message: 'Usuario actualizado correctamente.',
            data: { id, rol_id: finalRolId, estado: finalEstado }
        });
    } catch (err) {
        console.error('Error al actualizar usuario:', err);
        return errorResponse(res, 500, 'Error al actualizar usuario.');
    }
});

// Eliminar usuario
router.delete('/usuarios/:id', (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id) || id <= 0) {
            return res.status(400).json({ success: false, message: 'ID de usuario inválido.' });
        }

        if (req.user && req.user.id === id) {
            return res.status(403).json({ success: false, message: 'No puedes eliminar tu propia cuenta en sesión activa.' });
        }

        Database.run('DELETE FROM usuarios WHERE id = ?', [id]);

        return res.json({
            success: true,
            message: `Usuario #${id} eliminado correctamente.`
        });
    } catch (err) {
        console.error('Error al eliminar usuario:', err);
        return res.status(500).json({ success: false, message: 'Error al eliminar usuario. Puede tener citas o dependencias vinculadas.' });
    }
});

// =============================================================================
// 3. GESTIÓN EXCLUSIVA DE MANICURISTAS (FOTOS DE PERFIL, ESPECIALIDAD, SERVICIOS)
// =============================================================================

// Listar todas las manicuristas con sus datos profesionales completos
router.get('/manicuristas', (req, res) => {
    try {
        const manicuristas = Database.all(`
            SELECT u.id, u.nombre, u.apellido, u.email, u.telefono, 
                   COALESCE(u.foto_perfil, u.foto) AS foto_perfil,
                   COALESCE(u.foto, u.foto_perfil) AS foto,
                   COALESCE(u.cargo_especialidad, u.especialidades_texto, 'Manicurista Profesional') AS cargo_especialidad,
                   u.especialidades_texto, u.descripcion,
                   COALESCE(u.experiencia_anios, 3) AS experiencia_anios,
                   u.estado, u.fecha_registro,
                   (SELECT COUNT(*) FROM citas c WHERE c.manicurista_id = u.id) AS total_citas_asignadas,
                   (SELECT COUNT(*) FROM citas c WHERE c.manicurista_id = u.id AND c.estado = 'Completada') AS total_citas_completadas
            FROM usuarios u
            WHERE u.rol_id = 3
            ORDER BY u.id ASC
        `);

        manicuristas.forEach(m => {
            const specs = Database.all(`
                SELECT s.id, s.nombre, s.slug, s.precio, s.imagen
                FROM manicurista_servicios ms
                JOIN servicios s ON ms.servicio_id = s.id
                WHERE ms.manicurista_id = ?
            `, [m.id]);
            m.especialidades = specs;
            m.servicios_ids = specs.map(s => s.id);
        });

        return res.json({ success: true, total: manicuristas.length, data: manicuristas });
    } catch (err) {
        console.error('Error al listar manicuristas admin:', err);
        return res.status(500).json({ success: false, message: 'Error al listar manicuristas.' });
    }
});

// Obtener una manicurista específica por ID
router.get('/manicuristas/:id', (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id) || id <= 0) {
            return res.status(400).json({ success: false, message: 'ID de manicurista inválido.' });
        }

        const manicurista = Database.get(`
            SELECT u.id, u.nombre, u.apellido, u.email, u.telefono, 
                   COALESCE(u.foto_perfil, u.foto) AS foto_perfil,
                   COALESCE(u.foto, u.foto_perfil) AS foto,
                   COALESCE(u.cargo_especialidad, u.especialidades_texto, 'Manicurista Profesional') AS cargo_especialidad,
                   u.especialidades_texto, u.descripcion,
                   COALESCE(u.experiencia_anios, 3) AS experiencia_anios,
                   u.estado, u.fecha_registro,
                   (SELECT COUNT(*) FROM citas c WHERE c.manicurista_id = u.id) AS total_citas_asignadas,
                   (SELECT COUNT(*) FROM citas c WHERE c.manicurista_id = u.id AND c.estado = 'Completada') AS total_citas_completadas
            FROM usuarios u
            WHERE u.id = ? AND u.rol_id = 3
        `, [id]);

        if (!manicurista) {
            return res.status(404).json({ success: false, message: 'Manicurista no encontrada.' });
        }

        const specs = Database.all(`
            SELECT s.id, s.nombre, s.slug, s.precio
            FROM manicurista_servicios ms
            JOIN servicios s ON ms.servicio_id = s.id
            WHERE ms.manicurista_id = ?
        `, [id]);
        manicurista.especialidades = specs;
        manicurista.servicios_ids = specs.map(s => s.id);

        const todosServicios = Database.all("SELECT id, nombre, precio, duracion_minutos FROM servicios WHERE estado = 'activo' ORDER BY nombre ASC");

        return res.json({
            success: true,
            data: manicurista,
            catalogo_servicios: todosServicios
        });
    } catch (err) {
        console.error('Error al consultar manicurista:', err);
        return res.status(500).json({ success: false, message: 'Error al consultar manicurista.' });
    }
});

// Endpoint para subir / almacenar fotografía de perfil de manicurista o usuario
router.post('/manicuristas/upload-foto', (req, res) => {
    try {
        const { imagen_base64, nombre_manicurista } = req.body || {};

        // Validar imagen con verificación de magic bytes + tamaño + formato
        const imgData = validarImagenBase64(imagen_base64);
        if (!imgData) {
            return errorResponse(res, 400, 'Imagen inválida. Solo se aceptan JPG, PNG o WEBP de hasta 5MB.');
        }

        const { extension, buffer } = imgData;
        const filename = nombreArchivoSeguro(nombre_manicurista || 'manicurista', extension);

        const uploadDir = path.join(__dirname, '..', 'images', 'manicuristas');
        const uploadsDir = path.join(__dirname, '..', 'uploads', 'manicuristas');
        if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
        if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

        fs.writeFileSync(path.join(uploadDir, filename), buffer);
        try { fs.writeFileSync(path.join(uploadsDir, filename), buffer); } catch(e) {}

        const publicUrl = `/images/manicuristas/${filename}`;

        return res.json({
            success: true,
            message: 'Fotografía subida correctamente.',
            foto_url: publicUrl,
            filename
        });
    } catch (err) {
        console.error('Error al subir foto de manicurista:', err);
        return errorResponse(res, 500, 'Error interno al procesar la fotografía.');
    }
});

// Endpoint directo para asignar o cambiar foto de un usuario específico (ej. rol_id = 3)
router.post('/usuarios/:id/foto', (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id) || id <= 0) {
            return res.status(400).json({ success: false, message: 'ID de usuario inválido.' });
        }

        const usuario = Database.get('SELECT id, nombre, apellido, rol_id, foto, foto_perfil FROM usuarios WHERE id = ?', [id]);
        if (!usuario) {
            return res.status(404).json({ success: false, message: 'Usuario no encontrado.' });
        }

        const { imagen_base64, foto_url } = req.body || {};

        let finalUrl = foto_url;

        // Si se envió en base64, procesar y guardar físicamente
        if (imagen_base64 && typeof imagen_base64 === 'string') {
            let extension = 'jpg';
            let base64Data = imagen_base64;

            if (imagen_base64.includes(';base64,')) {
                const matches = imagen_base64.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
                if (matches && matches.length === 3) {
                    const mimeType = matches[1].toLowerCase();
                    if (mimeType === 'png') extension = 'png';
                    else if (mimeType === 'webp') extension = 'webp';
                    else if (mimeType === 'jpeg' || mimeType === 'jpg') extension = 'jpg';
                    else {
                        return res.status(400).json({ success: false, message: 'Formato no permitido. Solo se aceptan JPG, JPEG, PNG o WEBP.' });
                    }
                    base64Data = matches[2];
                } else {
                    base64Data = imagen_base64.split(';base64,')[1];
                }
            }

            const buffer = Buffer.from(base64Data, 'base64');
            if (buffer.length === 0) {
                return res.status(400).json({ success: false, message: 'La imagen está vacía.' });
            }

            if (buffer.length > 5 * 1024 * 1024) {
                return res.status(400).json({ success: false, message: 'La imagen supera el límite de 5MB.' });
            }

            const safeName = `${usuario.nombre || 'usuario'}-${usuario.apellido || ''}`
                .toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-|-$/g, '') || 'usuario';

            const filename = `${safeName}-${id}-${Date.now()}.${extension}`;
            const uploadDir = path.join(__dirname, '..', 'images', 'manicuristas');
            const uploadsDir = path.join(__dirname, '..', 'uploads', 'manicuristas');
            if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
            if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

            fs.writeFileSync(path.join(uploadDir, filename), buffer);
            try { fs.writeFileSync(path.join(uploadsDir, filename), buffer); } catch(e) {}

            finalUrl = `/images/manicuristas/${filename}`;
        }

        if (!finalUrl) {
            return res.status(400).json({ success: false, message: 'No se especificó ninguna fotografía para guardar.' });
        }

        Database.run('UPDATE usuarios SET foto = ?, foto_perfil = ? WHERE id = ?', [finalUrl, finalUrl, id]);

        return res.json({
            success: true,
            message: 'Fotografía actualizada correctamente en SQLite.',
            foto_url: finalUrl
        });
    } catch (err) {
        console.error('Error al actualizar foto de usuario:', err);
        return res.status(500).json({ success: false, message: 'Error interno al actualizar la fotografía.' });
    }
});

// Endpoint directo para eliminar foto de usuario
router.delete('/usuarios/:id/foto', (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id) || id <= 0) {
            return res.status(400).json({ success: false, message: 'ID de usuario inválido.' });
        }

        Database.run('UPDATE usuarios SET foto = NULL, foto_perfil = NULL WHERE id = ?', [id]);

        return res.json({
            success: true,
            message: 'Fotografía eliminada correctamente.'
        });
    } catch (err) {
        console.error('Error al eliminar foto de usuario:', err);
        return res.status(500).json({ success: false, message: 'Error interno al eliminar la fotografía.' });
    }
});

// Crear nueva manicurista desde panel admin
router.post('/manicuristas', async (req, res) => {
    try {
        const {
            nombre, apellido, email, telefono, password,
            foto_perfil, cargo_especialidad, descripcion,
            experiencia_anios, estado, servicios_ids
        } = req.body || {};

        if (!nombre || !nombre.trim()) {
            return res.status(400).json({ success: false, message: 'El nombre de la manicurista es obligatorio.' });
        }
        if (!email || !email.trim()) {
            return res.status(400).json({ success: false, message: 'El correo electrónico es obligatorio.' });
        }
        if (!password || password.trim().length < 6) {
            return res.status(400).json({ success: false, message: 'La contraseña debe tener al menos 6 caracteres.' });
        }

        const normalizedEmail = email.trim().toLowerCase();
        const existing = Database.get('SELECT id FROM usuarios WHERE LOWER(email) = ?', [normalizedEmail]);
        if (existing) {
            return res.status(409).json({ success: false, message: 'El correo electrónico ya está registrado.' });
        }

        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(password.trim(), salt);

        const finalEstado = ['activo', 'inactivo', 'bloqueado'].includes(estado) ? estado : 'activo';
        const finalFoto = (foto_perfil || '').trim() || null;
        const finalCargo = (cargo_especialidad || '').trim() || 'Manicurista Profesional';
        const finalDesc = (descripcion || '').trim() || 'Especialista en cuidado de uñas y manicura profesional.';
        const finalExp = parseInt(experiencia_anios, 10) || 3;

        const result = Database.run(`
            INSERT INTO usuarios (
                rol_id, nombre, apellido, email, telefono, password_hash, 
                estado, foto_perfil, foto, cargo_especialidad, especialidades_texto, 
                descripcion, experiencia_anios
            ) VALUES (3, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            nombre.trim(),
            (apellido || '').trim(),
            normalizedEmail,
            (telefono || '').trim(),
            password_hash,
            finalEstado,
            finalFoto,
            finalFoto,
            finalCargo,
            finalCargo,
            finalDesc,
            finalExp
        ]);

        const newId = result.lastInsertRowid;

        // Guardar servicios asignados
        if (Array.isArray(servicios_ids) && servicios_ids.length > 0) {
            for (const sId of servicios_ids) {
                const validSId = parseInt(sId, 10);
                if (!isNaN(validSId) && validSId > 0) {
                    Database.run(
                        'INSERT INTO manicurista_servicios (manicurista_id, servicio_id) VALUES (?, ?)',
                        [newId, validSId]
                    );
                }
            }
        }

        return res.status(201).json({
            success: true,
            message: `Manicurista "${nombre.trim()}" creada exitosamente.`,
            data: { id: newId, nombre: nombre.trim(), email: normalizedEmail, foto_perfil: finalFoto }
        });
    } catch (err) {
        console.error('Error al crear manicurista:', err);
        return res.status(500).json({ success: false, message: 'Error interno al crear manicurista.' });
    }
});

// Editar manicurista
router.put('/manicuristas/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id) || id <= 0) {
            return res.status(400).json({ success: false, message: 'ID de manicurista inválido.' });
        }

        const manicurista = Database.get('SELECT * FROM usuarios WHERE id = ? AND rol_id = 3', [id]);
        if (!manicurista) {
            return res.status(404).json({ success: false, message: 'Manicurista no encontrada.' });
        }

        const {
            nombre, apellido, email, telefono, password,
            foto_perfil, cargo_especialidad, descripcion,
            experiencia_anios, estado, servicios_ids
        } = req.body || {};

        if (!nombre || !nombre.trim()) {
            return res.status(400).json({ success: false, message: 'El nombre es obligatorio.' });
        }
        if (!email || !email.trim()) {
            return res.status(400).json({ success: false, message: 'El correo electrónico es obligatorio.' });
        }

        const normalizedEmail = email.trim().toLowerCase();
        const duplicate = Database.get('SELECT id FROM usuarios WHERE LOWER(email) = ? AND id != ?', [normalizedEmail, id]);
        if (duplicate) {
            return res.status(409).json({ success: false, message: 'El correo ya pertenece a otro usuario.' });
        }

        const finalEstado = ['activo', 'inactivo', 'bloqueado'].includes(estado) ? estado : 'activo';
        const finalFoto = foto_perfil !== undefined ? ((foto_perfil || '').trim() || null) : manicurista.foto_perfil;
        const finalCargo = (cargo_especialidad || '').trim() || manicurista.cargo_especialidad || 'Manicurista Profesional';
        const finalDesc = (descripcion || '').trim() || manicurista.descripcion || 'Especialista en cuidado de uñas y manicura profesional.';
        const finalExp = !isNaN(parseInt(experiencia_anios, 10)) ? parseInt(experiencia_anios, 10) : (manicurista.experiencia_anios || 3);

        if (password && password.trim().length >= 6) {
            const salt = await bcrypt.genSalt(10);
            const password_hash = await bcrypt.hash(password.trim(), salt);

            Database.run(`
                UPDATE usuarios 
                SET nombre = ?, apellido = ?, email = ?, telefono = ?, password_hash = ?,
                    estado = ?, foto_perfil = ?, foto = ?, cargo_especialidad = ?,
                    especialidades_texto = ?, descripcion = ?, experiencia_anios = ?
                WHERE id = ?
            `, [
                nombre.trim(),
                (apellido || '').trim(),
                normalizedEmail,
                (telefono || '').trim(),
                password_hash,
                finalEstado,
                finalFoto,
                finalFoto,
                finalCargo,
                finalCargo,
                finalDesc,
                finalExp,
                id
            ]);
        } else {
            Database.run(`
                UPDATE usuarios 
                SET nombre = ?, apellido = ?, email = ?, telefono = ?,
                    estado = ?, foto_perfil = ?, foto = ?, cargo_especialidad = ?,
                    especialidades_texto = ?, descripcion = ?, experiencia_anios = ?
                WHERE id = ?
            `, [
                nombre.trim(),
                (apellido || '').trim(),
                normalizedEmail,
                (telefono || '').trim(),
                finalEstado,
                finalFoto,
                finalFoto,
                finalCargo,
                finalCargo,
                finalDesc,
                finalExp,
                id
            ]);
        }

        // Actualizar servicios asignados si se proporciona la lista
        if (Array.isArray(servicios_ids)) {
            Database.run('DELETE FROM manicurista_servicios WHERE manicurista_id = ?', [id]);
            for (const sId of servicios_ids) {
                const validSId = parseInt(sId, 10);
                if (!isNaN(validSId) && validSId > 0) {
                    Database.run(
                        'INSERT INTO manicurista_servicios (manicurista_id, servicio_id) VALUES (?, ?)',
                        [id, validSId]
                    );
                }
            }
        }

        return res.json({
            success: true,
            message: `Manicurista "${nombre.trim()}" actualizada correctamente.`,
            data: { id, nombre: nombre.trim(), email: normalizedEmail, foto_perfil: finalFoto, estado: finalEstado }
        });
    } catch (err) {
        console.error('Error al actualizar manicurista:', err);
        return res.status(500).json({ success: false, message: 'Error interno al actualizar manicurista.' });
    }
});

// Eliminar / Cambiar fotografía de manicurista (quitar foto para activar fallback)
router.delete('/manicuristas/:id/foto', (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id) || id <= 0) {
            return res.status(400).json({ success: false, message: 'ID de manicurista inválido.' });
        }

        Database.run('UPDATE usuarios SET foto_perfil = NULL, foto = NULL WHERE id = ? AND rol_id = 3', [id]);

        return res.json({
            success: true,
            message: 'Fotografía de perfil removida. Ahora se mostrarán las iniciales como fallback.'
        });
    } catch (err) {
        console.error('Error al remover foto:', err);
        return res.status(500).json({ success: false, message: 'Error al remover fotografía.' });
    }
});

// Cambiar estado activo / inactivo de manicurista
router.put('/manicuristas/:id/estado', (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        const { estado } = req.body || {};

        if (!['activo', 'inactivo', 'bloqueado'].includes(estado)) {
            return res.status(400).json({ success: false, message: 'Estado no válido.' });
        }

        Database.run('UPDATE usuarios SET estado = ? WHERE id = ? AND rol_id = 3', [estado, id]);

        return res.json({
            success: true,
            message: `Estado de la manicurista cambiado a "${estado}".`,
            data: { id, estado }
        });
    } catch (err) {
        console.error('Error al cambiar estado de manicurista:', err);
        return res.status(500).json({ success: false, message: 'Error al cambiar estado.' });
    }
});

// Eliminar manicurista
router.delete('/manicuristas/:id', (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id) || id <= 0) {
            return res.status(400).json({ success: false, message: 'ID de manicurista inválido.' });
        }

        const citasAsignadas = Database.get('SELECT COUNT(*) AS count FROM citas WHERE manicurista_id = ?', [id])?.count || 0;
        if (citasAsignadas > 0) {
            // Si tiene citas, en lugar de romper integridad, desactivar
            Database.run("UPDATE usuarios SET estado = 'inactivo' WHERE id = ?", [id]);
            return res.json({
                success: true,
                message: `La manicurista tiene ${citasAsignadas} cita(s) en su historial. Se ha cambiado su estado a "Inactivo" para preservar los registros.`
            });
        }

        Database.run('DELETE FROM manicurista_servicios WHERE manicurista_id = ?', [id]);
        Database.run('DELETE FROM usuarios WHERE id = ? AND rol_id = 3', [id]);

        return res.json({
            success: true,
            message: 'Manicurista eliminada correctamente de la base de datos.'
        });
    } catch (err) {
        console.error('Error al eliminar manicurista:', err);
        return res.status(500).json({ success: false, message: 'Error interno al eliminar manicurista.' });
    }
});

// =============================================================================
// 4. CRUD SERVICIOS
// =============================================================================

router.get('/servicios', (req, res) => {
    try {
        const servicios = Database.all(`
            SELECT s.*, c.nombre AS categoria_nombre,
                   (SELECT COUNT(*) FROM resenas r WHERE r.servicio_id = s.id) AS total_resenas
            FROM servicios s
            INNER JOIN categorias c ON s.categoria_id = c.id
            ORDER BY s.id ASC
        `);
        const categorias = Database.all('SELECT * FROM categorias ORDER BY id ASC');

        return res.json({ success: true, total: servicios.length, data: servicios, categorias });
    } catch (err) {
        console.error('Error al listar servicios admin:', err);
        return res.status(500).json({ success: false, message: 'Error al listar servicios.' });
    }
});

router.get('/servicios/:id', (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        const servicio = Database.get('SELECT * FROM servicios WHERE id = ?', [id]);
        if (!servicio) return res.status(404).json({ success: false, message: 'Servicio no encontrado.' });
        return res.json({ success: true, data: servicio });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Error al consultar servicio.' });
    }
});

router.post('/servicios', (req, res) => {
    try {
        const { categoria_id, nombre, descripcion, precio, moneda, duracion_minutos, imagen, url_detalle, destacado, estado } = req.body || {};

        if (!nombre || !nombre.trim()) {
            return res.status(400).json({ success: false, message: 'El nombre del servicio es obligatorio.' });
        }
        if (precio === undefined || isNaN(parseFloat(precio))) {
            return res.status(400).json({ success: false, message: 'El precio debe ser un valor numérico.' });
        }

        const slug = nombre.trim().toLowerCase()
            .replace(/[^\w\s-]/g, '')
            .replace(/[\s_-]+/g, '-')
            .replace(/^-+|-+$/g, '') || `servicio-${Date.now()}`;

        const result = Database.run(`
            INSERT INTO servicios (categoria_id, nombre, slug, descripcion, precio, moneda, duracion_minutos, imagen, url_detalle, destacado, estado)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            parseInt(categoria_id, 10) || 1,
            nombre.trim(),
            slug,
            descripcion || '',
            parseFloat(precio),
            moneda || 'Bs.',
            parseInt(duracion_minutos, 10) || 60,
            imagen || 'images/service_acrilicas.jpg',
            url_detalle || 'left-sidebar.html',
            destacado ? 1 : 0,
            estado || 'activo'
        ]);

        return res.status(201).json({
            success: true,
            message: 'Servicio creado exitosamente.',
            data: { id: result.lastInsertRowid }
        });
    } catch (err) {
        console.error('Error al crear servicio admin:', err);
        return res.status(500).json({ success: false, message: 'Error al crear servicio.' });
    }
});

router.put('/servicios/:id', (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        const { categoria_id, nombre, descripcion, precio, moneda, duracion_minutos, imagen, url_detalle, destacado, estado } = req.body || {};

        if (!nombre || !nombre.trim()) {
            return res.status(400).json({ success: false, message: 'El nombre del servicio es obligatorio.' });
        }

        Database.run(`
            UPDATE servicios 
            SET categoria_id = ?, nombre = ?, descripcion = ?, precio = ?, moneda = ?, duracion_minutos = ?, imagen = ?, url_detalle = ?, destacado = ?, estado = ?
            WHERE id = ?
        `, [
            parseInt(categoria_id, 10) || 1,
            nombre.trim(),
            descripcion || '',
            parseFloat(precio) || 0,
            moneda || 'Bs.',
            parseInt(duracion_minutos, 10) || 60,
            imagen || 'images/service_acrilicas.jpg',
            url_detalle || 'left-sidebar.html',
            destacado ? 1 : 0,
            estado || 'activo',
            id
        ]);

        return res.json({ success: true, message: 'Servicio actualizado correctamente.' });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Error al actualizar servicio.' });
    }
});

router.delete('/servicios/:id', (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        Database.run('DELETE FROM servicios WHERE id = ?', [id]);
        return res.json({ success: true, message: 'Servicio eliminado correctamente.' });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Error al eliminar servicio. Puede tener citas vinculadas.' });
    }
});

// =============================================================================
// 5. GESTIÓN DE CITAS & ASIGNACIÓN DE MANICURISTAS
// =============================================================================

router.get('/citas', (req, res) => {
    try {
        const { estado, fecha, search, manicurista_id } = req.query;
        let sql = `
            SELECT c.*, 
                   u.nombre AS cliente_nombre, u.apellido AS cliente_apellido, u.telefono AS cliente_telefono, u.email AS cliente_email,
                   m.nombre AS manicurista_nombre, m.apellido AS manicurista_apellido,
                   (SELECT GROUP_CONCAT(COALESCE(s.nombre, 'Servicio'), ', ') 
                    FROM detalle_cita dc 
                    LEFT JOIN servicios s ON dc.servicio_id = s.id 
                    WHERE dc.cita_id = c.id) AS servicios_resumen
            FROM citas c
            INNER JOIN usuarios u ON c.usuario_id = u.id
            LEFT JOIN usuarios m ON c.manicurista_id = m.id
            WHERE 1=1
        `;
        const params = [];

        if (estado && estado !== 'todos') {
            sql += ' AND c.estado = ?';
            params.push(estado);
        }

        if (fecha) {
            sql += ' AND c.fecha_cita = ?';
            params.push(fecha);
        }

        if (manicurista_id) {
            sql += ' AND c.manicurista_id = ?';
            params.push(parseInt(manicurista_id, 10));
        }

        if (search) {
            sql += ' AND (c.codigo_reserva LIKE ? OR u.nombre LIKE ? OR u.apellido LIKE ? OR u.telefono LIKE ?)';
            const q = `%${search}%`;
            params.push(q, q, q, q);
        }

        sql += ' ORDER BY c.id DESC';

        const citas = Database.all(sql, params);
        const manicuristas = Database.all("SELECT id, nombre, apellido FROM usuarios WHERE rol_id = 3 AND estado = 'activo'");

        return res.json({ success: true, total: citas.length, data: citas, manicuristas });
    } catch (err) {
        console.error('Error al listar citas admin:', err);
        return res.status(500).json({ success: false, message: 'Error al listar citas.' });
    }
});

router.get(['/citas/:id', '/citas/:id/detalle'], (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        const cita = Database.get(`
            SELECT c.*, 
                   u.nombre AS cliente_nombre, u.apellido AS cliente_apellido, u.telefono AS cliente_telefono, u.email AS cliente_email,
                   m.nombre AS manicurista_nombre, m.apellido AS manicurista_apellido
            FROM citas c
            INNER JOIN usuarios u ON c.usuario_id = u.id
            LEFT JOIN usuarios m ON c.manicurista_id = m.id
            WHERE c.id = ?
        `, [id]);

        if (!cita) {
            return res.status(404).json({ success: false, message: 'Cita no encontrada.' });
        }

        const servicios = Database.all(`
            SELECT d.*, s.nombre AS servicio_nombre, s.imagen AS servicio_imagen, s.duracion_minutos
            FROM detalle_cita d
            LEFT JOIN servicios s ON d.servicio_id = s.id
            WHERE d.cita_id = ?
        `, [id]);

        return res.json({
            success: true,
            data: {
                ...cita,
                servicios
            }
        });
    } catch (err) {
        console.error('Error al obtener detalle cita admin:', err);
        return res.status(500).json({ success: false, message: 'Error al consultar detalle de cita.' });
    }
});

// Asignar o reasignar manicurista a una cita
router.put('/citas/:id/asignar-manicurista', (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        const { manicurista_id } = req.body;
        const targetManicuristaId = manicurista_id ? parseInt(manicurista_id, 10) : null;

        const cita = Database.get('SELECT * FROM citas WHERE id = ?', [id]);
        if (!cita) {
            return res.status(404).json({ success: false, message: 'Cita no encontrada.' });
        }

        Database.run('UPDATE citas SET manicurista_id = ? WHERE id = ?', [targetManicuristaId, id]);

        if (targetManicuristaId) {
            const m = Database.get('SELECT nombre, apellido FROM usuarios WHERE id = ?', [targetManicuristaId]);
            const mNombre = m ? `${m.nombre} ${m.apellido || ''}`.trim() : 'Manicurista';

            // Notificación para la manicurista
            try {
                Database.run(
                    'INSERT INTO notificaciones (usuario_id, titulo, mensaje, tipo) VALUES (?, ?, ?, ?)',
                    [
                        targetManicuristaId,
                        `Cita Asignada (${cita.codigo_reserva})`,
                        `El administrador te ha asignado la cita del día ${cita.fecha_cita} a las ${cita.hora_cita}.`,
                        'reserva'
                    ]
                );
            } catch(e){}

            return res.json({
                success: true,
                message: `Cita #${cita.codigo_reserva} asignada a ${mNombre}.`,
                data: { id, manicurista_id: targetManicuristaId, manicurista_nombre: mNombre }
            });
        }

        return res.json({
            success: true,
            message: `Cita #${cita.codigo_reserva} quedó sin manicurista asignada.`,
            data: { id, manicurista_id: null }
        });
    } catch (err) {
        console.error('Error al asignar manicurista:', err);
        return res.status(500).json({ success: false, message: 'Error al asignar manicurista.' });
    }
});

router.put('/citas/:id', (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        const { estado, observaciones, manicurista_id } = req.body || {};

        if (!['Pendiente', 'Confirmada', 'Cancelada', 'Completada'].includes(estado)) {
            return res.status(400).json({ success: false, message: 'Estado de cita no válido.' });
        }

        const manicId = manicurista_id !== undefined ? (manicurista_id ? parseInt(manicurista_id, 10) : null) : undefined;

        if (manicId !== undefined) {
            Database.run('UPDATE citas SET estado = ?, observaciones = ?, manicurista_id = ? WHERE id = ?', [estado, observaciones || '', manicId, id]);
        } else if (observaciones !== undefined) {
            Database.run('UPDATE citas SET estado = ?, observaciones = ? WHERE id = ?', [estado, observaciones, id]);
        } else {
            Database.run('UPDATE citas SET estado = ? WHERE id = ?', [estado, id]);
        }

        return res.json({ success: true, message: `Cita #${id} actualizada a estado: ${estado}.` });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Error al actualizar cita.' });
    }
});

router.delete('/citas/:id', (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        Database.run('DELETE FROM citas WHERE id = ?', [id]);
        return res.json({ success: true, message: 'Cita eliminada correctamente.' });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Error al eliminar cita.' });
    }
});

// =============================================================================
// 6. RESEÑAS & MODERACIÓN
// =============================================================================

router.get('/resenas', (req, res) => {
    try {
        const resenas = Database.all(`
            SELECT r.*, u.nombre AS usuario_nombre, u.apellido AS usuario_apellido, u.email AS usuario_email,
                   s.nombre AS servicio_nombre
            FROM resenas r
            INNER JOIN usuarios u ON r.usuario_id = u.id
            LEFT JOIN servicios s ON r.servicio_id = s.id
            ORDER BY r.id DESC
        `);

        return res.json({ success: true, total: resenas.length, data: resenas });
    } catch (err) {
        console.error('Error al listar reseñas admin:', err);
        return res.status(500).json({ success: false, message: 'Error al listar reseñas.' });
    }
});

router.put('/resenas/:id/toggle', (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        const resena = Database.get('SELECT publicado FROM resenas WHERE id = ?', [id]);
        if (!resena) return res.status(404).json({ success: false, message: 'Reseña no encontrada.' });

        const nuevoEstado = resena.publicado === 1 ? 0 : 1;
        Database.run('UPDATE resenas SET publicado = ? WHERE id = ?', [nuevoEstado, id]);

        return res.json({
            success: true,
            message: `Reseña #${id} ${nuevoEstado === 1 ? 'publicada y visible' : 'ocultada'} correctamente.`,
            data: { publicado: nuevoEstado }
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Error al moderar reseña.' });
    }
});

router.delete('/resenas/:id', (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        Database.run('DELETE FROM resenas WHERE id = ?', [id]);
        return res.json({ success: true, message: 'Reseña eliminada correctamente.' });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Error al eliminar reseña.' });
    }
});

// =============================================================================
// 7. MENSAJES DE CONTACTO
// =============================================================================

router.get('/mensajes', (req, res) => {
    try {
        const mensajes = Database.all('SELECT * FROM contactos ORDER BY id DESC');
        return res.json({ success: true, total: mensajes.length, data: mensajes });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Error al listar mensajes.' });
    }
});

router.put('/mensajes/:id/toggle', (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        const msg = Database.get('SELECT leido FROM contactos WHERE id = ?', [id]);
        if (!msg) return res.status(404).json({ success: false, message: 'Mensaje no encontrado.' });

        const nuevoEstado = msg.leido === 1 ? 0 : 1;
        Database.run('UPDATE contactos SET leido = ? WHERE id = ?', [nuevoEstado, id]);

        return res.json({
            success: true,
            message: `Mensaje #${id} marcado como ${nuevoEstado === 1 ? 'leído' : 'no leído'}.`,
            data: { leido: nuevoEstado }
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Error al actualizar mensaje.' });
    }
});

router.delete('/mensajes/:id', (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        Database.run('DELETE FROM contactos WHERE id = ?', [id]);
        return res.json({ success: true, message: 'Mensaje eliminado correctamente.' });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Error al eliminar mensaje.' });
    }
});

module.exports = router;
