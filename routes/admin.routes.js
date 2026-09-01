/**
 * NailArtist Studio — Admin API Routes
 * Panel de Control, Métricas KPIs, CRUD de Usuarios (Edición con lápiz y cambio de roles),
 * Servicios, Citas, Reseñas y Mensajes
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const Database = require('../database/db');
const { requireAdmin } = require('../middleware/auth');

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

        const totalServicios = Database.get('SELECT COUNT(*) AS count FROM servicios WHERE estado = \'activo\'')?.count || 0;

        const totalCitas = Database.get('SELECT COUNT(*) AS count FROM citas')?.count || 0;
        const citasPendientes = Database.get('SELECT COUNT(*) AS count FROM citas WHERE estado = \'Pendiente\'')?.count || 0;
        const citasConfirmadas = Database.get('SELECT COUNT(*) AS count FROM citas WHERE estado = \'Confirmada\'')?.count || 0;
        const citasCompletadas = Database.get('SELECT COUNT(*) AS count FROM citas WHERE estado = \'Completada\'')?.count || 0;
        const citasCanceladas = Database.get('SELECT COUNT(*) AS count FROM citas WHERE estado = \'Cancelada\'')?.count || 0;

        const ingresosResult = Database.get('SELECT COALESCE(SUM(total_final_bs), 0) AS total FROM citas WHERE estado IN (\'Confirmada\', \'Completada\')');
        const ingresosTotalesBs = parseFloat(ingresosResult?.total || 0);

        const ratingResult = Database.get('SELECT COALESCE(AVG(calificacion), 5.0) AS avg FROM resenas WHERE publicado = 1');
        const promedioCalificacion = parseFloat(ratingResult?.avg || 5.0);

        const totalMensajes = Database.get('SELECT COUNT(*) AS count FROM contactos')?.count || 0;
        const mensajesNoLeidos = Database.get('SELECT COUNT(*) AS count FROM contactos WHERE leido = 0')?.count || 0;
        const totalResenas = Database.get('SELECT COUNT(*) AS count FROM resenas')?.count || 0;

        // Citas recientes
        const ultimasCitas = Database.all(`
            SELECT c.*, u.nombre AS cliente_nombre, u.apellido AS cliente_apellido, u.telefono AS cliente_telefono, u.email AS cliente_email
            FROM citas c
            INNER JOIN usuarios u ON c.usuario_id = u.id
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
// 2. CRUD USUARIOS (Corrección de botón de lápiz y cambio de roles)
// =============================================================================

// Listar usuarios
router.get('/usuarios', (req, res) => {
    try {
        const usuarios = Database.all(`
            SELECT u.id, u.rol_id, u.nombre, u.apellido, u.email, u.telefono, 
                   u.descuento_vip, u.estado, u.fecha_registro, r.nombre AS rol_nombre 
            FROM usuarios u 
            INNER JOIN roles r ON u.rol_id = r.id 
            ORDER BY u.id DESC
        `);

        const roles = Database.all('SELECT * FROM roles ORDER BY id ASC');

        return res.json({
            success: true,
            total: usuarios.length,
            data: usuarios,
            roles
        });
    } catch (err) {
        console.error('Error al listar usuarios:', err);
        return res.status(500).json({ success: false, message: 'Error al obtener usuarios.' });
    }
});

// Obtener un usuario por ID para el modal de edición
router.get('/usuarios/:id', (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        const user = Database.get(`
            SELECT u.id, u.rol_id, u.nombre, u.apellido, u.email, u.telefono, 
                   u.descuento_vip, u.estado, u.fecha_registro, r.nombre AS rol_nombre
            FROM usuarios u
            INNER JOIN roles r ON u.rol_id = r.id
            WHERE u.id = ?
        `, [id]);

        if (!user) {
            return res.status(404).json({ success: false, message: 'Usuario no encontrado.' });
        }

        return res.json({ success: true, data: user });
    } catch (err) {
        console.error('Error al obtener usuario:', err);
        return res.status(500).json({ success: false, message: 'Error al consultar usuario.' });
    }
});

// Crear nuevo usuario desde Admin
router.post('/usuarios', async (req, res) => {
    try {
        const { nombre, apellido, email, telefono, password, rol_id, estado, descuento_vip } = req.body || {};

        if (!nombre || !nombre.trim()) {
            return res.status(400).json({ success: false, message: 'El nombre es obligatorio.' });
        }
        if (!email || !email.trim()) {
            return res.status(400).json({ success: false, message: 'El correo electrónico es obligatorio.' });
        }
        if (!password || password.length < 6) {
            return res.status(400).json({ success: false, message: 'La contraseña debe tener al menos 6 caracteres.' });
        }

        const normalizedEmail = email.trim().toLowerCase();
        const existing = Database.get('SELECT id FROM usuarios WHERE LOWER(email) = ?', [normalizedEmail]);
        if (existing) {
            return res.status(409).json({ success: false, message: 'Ya existe un usuario con este correo.' });
        }

        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(password, salt);

        const finalRolId = parseInt(rol_id, 10) || 2;
        const finalEstado = ['activo', 'inactivo', 'bloqueado'].includes(estado) ? estado : 'activo';
        const finalDescuento = Math.max(0, parseFloat(descuento_vip) || (finalRolId === 2 ? 15.00 : 0));

        const result = Database.run(`
            INSERT INTO usuarios (rol_id, nombre, apellido, email, telefono, password_hash, descuento_vip, estado)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [finalRolId, nombre.trim(), (apellido || '').trim(), normalizedEmail, (telefono || '').trim(), password_hash, finalDescuento, finalEstado]);

        return res.status(201).json({
            success: true,
            message: `Usuario #${result.lastInsertRowid} creado correctamente.`,
            data: { id: result.lastInsertRowid }
        });
    } catch (err) {
        console.error('Error al crear usuario:', err);
        return res.status(500).json({ success: false, message: 'Error al registrar usuario.' });
    }
});

// Editar usuario (BOTÓN DE LÁPIZ) — Permite cambiar rol, datos, contraseña y estado
router.put('/usuarios/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        const { nombre, apellido, email, telefono, password, rol_id, estado, descuento_vip } = req.body || {};

        if (isNaN(id) || id <= 0) {
            return res.status(400).json({ success: false, message: 'ID de usuario inválido.' });
        }

        if (!nombre || !nombre.trim()) {
            return res.status(400).json({ success: false, message: 'El nombre es obligatorio.' });
        }
        if (!email || !email.trim()) {
            return res.status(400).json({ success: false, message: 'El correo electrónico es obligatorio.' });
        }

        const normalizedEmail = email.trim().toLowerCase();

        // Validar correo duplicado en otro usuario
        const duplicate = Database.get('SELECT id FROM usuarios WHERE LOWER(email) = ? AND id != ?', [normalizedEmail, id]);
        if (duplicate) {
            return res.status(409).json({ success: false, message: 'El correo ya pertenece a otro usuario.' });
        }

        const finalRolId = parseInt(rol_id, 10) || 2;
        const finalEstado = ['activo', 'inactivo', 'bloqueado'].includes(estado) ? estado : 'activo';
        const finalDescuento = Math.max(0, parseFloat(descuento_vip) || 0);

        if (password && password.trim().length >= 6) {
            const salt = await bcrypt.genSalt(10);
            const password_hash = await bcrypt.hash(password.trim(), salt);

            Database.run(`
                UPDATE usuarios 
                SET rol_id = ?, nombre = ?, apellido = ?, email = ?, telefono = ?, password_hash = ?, descuento_vip = ?, estado = ?
                WHERE id = ?
            `, [finalRolId, nombre.trim(), (apellido || '').trim(), normalizedEmail, (telefono || '').trim(), password_hash, finalDescuento, finalEstado, id]);
        } else {
            Database.run(`
                UPDATE usuarios 
                SET rol_id = ?, nombre = ?, apellido = ?, email = ?, telefono = ?, descuento_vip = ?, estado = ?
                WHERE id = ?
            `, [finalRolId, nombre.trim(), (apellido || '').trim(), normalizedEmail, (telefono || '').trim(), finalDescuento, finalEstado, id]);
        }

        return res.json({
            success: true,
            message: 'Usuario actualizado correctamente.',
            data: { id, rol_id: finalRolId, estado: finalEstado }
        });
    } catch (err) {
        console.error('Error al actualizar usuario:', err);
        return res.status(500).json({ success: false, message: 'Error al actualizar usuario.' });
    }
});

// Eliminar usuario
router.delete('/usuarios/:id', (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id) || id <= 0) {
            return res.status(400).json({ success: false, message: 'ID de usuario inválido.' });
        }

        // Prevenir auto-eliminación
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
// 3. CRUD SERVICIOS
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
        const { categoria_id, nombre, descripcion, precio, duracion_minutos, imagen, url_detalle, destacado, estado } = req.body || {};

        if (!nombre || !precio) {
            return res.status(400).json({ success: false, message: 'Nombre y precio son obligatorios.' });
        }

        const slug = nombre.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        const catId = parseInt(categoria_id, 10) || 1;
        const duracion = parseInt(duracion_minutos, 10) || 60;
        const img = imagen || 'images/service_acrilicas.jpg';
        const url = url_detalle || 'left-sidebar.html';
        const isDestacado = destacado ? 1 : 0;
        const st = estado === 'inactivo' ? 'inactivo' : 'activo';

        const result = Database.run(`
            INSERT INTO servicios (categoria_id, nombre, slug, descripcion, precio, duracion_minutos, imagen, url_detalle, destacado, calificacion, estado)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 5.0, ?)
        `, [catId, nombre.trim(), slug, descripcion || '', parseFloat(precio), duracion, img, url, isDestacado, st]);

        return res.status(201).json({
            success: true,
            message: 'Servicio creado exitosamente.',
            data: { id: result.lastInsertRowid }
        });
    } catch (err) {
        console.error('Error al crear servicio:', err);
        return res.status(500).json({ success: false, message: 'Error al crear servicio.' });
    }
});

router.put('/servicios/:id', (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        const { categoria_id, nombre, descripcion, precio, duracion_minutos, imagen, url_detalle, destacado, estado } = req.body || {};

        if (!nombre || !precio) {
            return res.status(400).json({ success: false, message: 'Nombre y precio son obligatorios.' });
        }

        const catId = parseInt(categoria_id, 10) || 1;
        const duracion = parseInt(duracion_minutos, 10) || 60;
        const img = imagen || 'images/service_acrilicas.jpg';
        const url = url_detalle || 'left-sidebar.html';
        const isDestacado = destacado ? 1 : 0;
        const st = estado === 'inactivo' ? 'inactivo' : 'activo';

        Database.run(`
            UPDATE servicios 
            SET categoria_id = ?, nombre = ?, descripcion = ?, precio = ?, duracion_minutos = ?, imagen = ?, url_detalle = ?, destacado = ?, estado = ?
            WHERE id = ?
        `, [catId, nombre.trim(), descripcion || '', parseFloat(precio), duracion, img, url, isDestacado, st, id]);

        return res.json({ success: true, message: 'Servicio actualizado correctamente.' });
    } catch (err) {
        console.error('Error al actualizar servicio:', err);
        return res.status(500).json({ success: false, message: 'Error al actualizar servicio.' });
    }
});

router.delete('/servicios/:id', (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        Database.run('DELETE FROM servicios WHERE id = ?', [id]);
        return res.json({ success: true, message: 'Servicio eliminado correctamente.' });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Error al eliminar servicio.' });
    }
});

// =============================================================================
// 4. CITAS & RESERVAS
// =============================================================================

router.get('/citas', (req, res) => {
    try {
        const citas = Database.all(`
            SELECT c.*, u.nombre AS cliente_nombre, u.apellido AS cliente_apellido, u.telefono AS cliente_telefono, u.email AS cliente_email
            FROM citas c
            INNER JOIN usuarios u ON c.usuario_id = u.id
            ORDER BY c.id DESC
        `);

        return res.json({ success: true, total: citas.length, data: citas });
    } catch (err) {
        console.error('Error al listar citas admin:', err);
        return res.status(500).json({ success: false, message: 'Error al listar citas.' });
    }
});

router.put('/citas/:id', (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        const { estado, observaciones } = req.body || {};

        if (!['Pendiente', 'Confirmada', 'Cancelada', 'Completada'].includes(estado)) {
            return res.status(400).json({ success: false, message: 'Estado de cita no válido.' });
        }

        if (observaciones !== undefined) {
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
// 5. RESEÑAS & MODERACIÓN
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
// 6. MENSAJES DE CONTACTO
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
