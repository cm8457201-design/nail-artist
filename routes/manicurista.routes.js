/**
 * NailArtist Studio — Manicurista API Routes
 * Panel exclusivo para manicuristas: Citas asignadas, agenda, detalle, notificaciones y perfil
 */

const express = require('express');
const router = express.Router();
const Database = require('../database/db');
const { requireManicurista } = require('../middleware/auth');
const {
    errorResponse,
    validarId,
    validarFecha,
    validarEstadoCita
} = require('../middleware/validation');

// Todas las rutas de este módulo requieren sesión activa con rol Manicurista o Admin
router.use(requireManicurista);

/**
 * 1. GET /api/manicurista/dashboard
 * Métricas reales exclusivas de la manicurista autenticada
 */
router.get('/dashboard', (req, res) => {
    try {
        const manicuristaId = req.user.id;
        const today = new Date().toISOString().split('T')[0];

        const totalCitas = Database.get('SELECT COUNT(*) AS count FROM citas WHERE manicurista_id = ?', [manicuristaId])?.count || 0;
        const citasPendientes = Database.get("SELECT COUNT(*) AS count FROM citas WHERE manicurista_id = ? AND estado = 'Pendiente'", [manicuristaId])?.count || 0;
        const citasConfirmadas = Database.get("SELECT COUNT(*) AS count FROM citas WHERE manicurista_id = ? AND estado = 'Confirmada'", [manicuristaId])?.count || 0;
        const citasCompletadas = Database.get("SELECT COUNT(*) AS count FROM citas WHERE manicurista_id = ? AND estado = 'Completada'", [manicuristaId])?.count || 0;
        const citasHoy = Database.get('SELECT COUNT(*) AS count FROM citas WHERE manicurista_id = ? AND fecha_cita = ?', [manicuristaId, today])?.count || 0;

        // Próximas 5 citas
        const proximasCitas = Database.all(`
            SELECT c.*, u.nombre AS cliente_nombre, u.apellido AS cliente_apellido, u.telefono AS cliente_telefono, u.email AS cliente_email
            FROM citas c
            INNER JOIN usuarios u ON c.usuario_id = u.id
            WHERE c.manicurista_id = ? AND c.estado IN ('Pendiente', 'Confirmada')
            ORDER BY c.fecha_cita ASC, c.hora_cita ASC
            LIMIT 5
        `, [manicuristaId]);

        return res.json({
            success: true,
            usuario: req.user,
            stats: {
                citas_hoy: citasHoy,
                citas_pendientes: citasPendientes,
                citas_confirmadas: citasConfirmadas,
                citas_completadas: citasCompletadas,
                total_clientes: totalCitas
            },
            citas_hoy: proximasCitas,
            data: {
                kpis: {
                    totalCitas,
                    citasPendientes,
                    citasConfirmadas,
                    citasCompletadas,
                    citasHoy
                },
                proximasCitas
            }
        });
    } catch (err) {
        console.error('Error en /api/manicurista/dashboard:', err);
        return res.status(500).json({ success: false, message: 'Error al obtener dashboard de manicurista.' });
    }
});

/**
 * 2. GET /api/manicurista/citas
 * Listado de citas asignadas a la manicurista con filtros opcionales
 */
router.get('/citas', (req, res) => {
    try {
        const manicuristaId = req.user.id;
        const { estado, fecha, search } = req.query;

        let sql = `
            SELECT c.*, 
                   u.nombre AS cliente_nombre, u.apellido AS cliente_apellido, 
                   u.telefono AS cliente_telefono, u.email AS cliente_email,
                   (SELECT GROUP_CONCAT(s.nombre, ', ') 
                    FROM detalle_cita dc 
                    INNER JOIN servicios s ON dc.servicio_id = s.id 
                    WHERE dc.cita_id = c.id) AS servicios_resumen
            FROM citas c
            INNER JOIN usuarios u ON c.usuario_id = u.id
            WHERE c.manicurista_id = ?
        `;
        const params = [manicuristaId];

        if (estado && estado !== 'todas') {
            const estadoLimpio = validarEstadoCita(estado);
            if (estadoLimpio) {
                sql += ' AND c.estado = ?';
                params.push(estadoLimpio);
            }
        }

        if (fecha) {
            const fechaLimpia = validarFecha(fecha);
            if (fechaLimpia) {
                sql += ' AND c.fecha_cita = ?';
                params.push(fechaLimpia);
            }
        }

        if (search) {
            sql += ' AND (c.codigo_reserva LIKE ? OR u.nombre LIKE ? OR u.apellido LIKE ?)';
            const q = `%${search}%`;
            params.push(q, q, q);
        }

        sql += ' ORDER BY c.fecha_cita DESC, c.hora_cita DESC';

        const citas = Database.all(sql, params);

        return res.json({
            success: true,
            total: citas.length,
            data: citas
        });
    } catch (err) {
        console.error('Error en /api/manicurista/citas:', err);
        return res.status(500).json({ success: false, message: 'Error al obtener citas.' });
    }
});

/**
 * 3. GET /api/manicurista/citas/:id
 * Detalle completo de una cita asignada
 */
router.get('/citas/:id', (req, res) => {
    try {
        const manicuristaId = req.user.id;
        const citaId = parseInt(req.params.id, 10);

        const cita = Database.get(`
            SELECT c.*, 
                   u.nombre AS cliente_nombre, u.apellido AS cliente_apellido, 
                   u.telefono AS cliente_telefono, u.email AS cliente_email
            FROM citas c
            INNER JOIN usuarios u ON c.usuario_id = u.id
            WHERE c.id = ? AND (c.manicurista_id = ? OR ? = 1)
        `, [citaId, manicuristaId, req.user.rol_id]);

        if (!cita) {
            return res.status(404).json({ success: false, message: 'Cita no encontrada o no asignada a tu perfil.' });
        }

        const servicios = Database.all(`
            SELECT dc.*, s.nombre AS servicio_nombre, s.duracion_minutos
            FROM detalle_cita dc
            INNER JOIN servicios s ON dc.servicio_id = s.id
            WHERE dc.cita_id = ?
        `, [citaId]);

        cita.servicios = servicios;

        return res.json({
            success: true,
            data: cita
        });
    } catch (err) {
        console.error('Error en /api/manicurista/citas/:id:', err);
        return res.status(500).json({ success: false, message: 'Error al obtener detalle de la cita.' });
    }
});

/**
 * 4. PUT /api/manicurista/citas/:id/estado
 * Cambiar el estado de la cita asignada (e.g., 'Confirmada', 'Completada')
 */
router.put('/citas/:id/estado', (req, res) => {
    try {
        const manicuristaId = req.user.id;

        // Validar ID de cita
        const citaId = validarId(req.params.id);
        if (!citaId) {
            return errorResponse(res, 400, 'ID de cita inválido.');
        }

        const { estado } = req.body;

        // Validar estado con enumerado centralizado
        const estadoLimpio = validarEstadoCita(estado);
        if (!estadoLimpio) {
            return errorResponse(res, 400, 'Estado no válido. Los estados permitidos son: Pendiente, Confirmada, Completada, Cancelada.');
        }

        const cita = Database.get('SELECT * FROM citas WHERE id = ? AND (manicurista_id = ? OR ? = 1)', [citaId, manicuristaId, req.user.rol_id]);
        if (!cita) {
            return errorResponse(res, 404, 'Cita no encontrada o no asignada a tu cuenta.');
        }

        // No permitir reactivar una cita ya Cancelada
        if (cita.estado === 'Cancelada' && estadoLimpio !== 'Cancelada') {
            return errorResponse(res, 400, 'No se puede cambiar el estado de una cita ya cancelada.');
        }

        Database.run('UPDATE citas SET estado = ? WHERE id = ?', [estadoLimpio, citaId]);

        // Crear notificación para el cliente
        try {
            Database.run(
                'INSERT INTO notificaciones (usuario_id, titulo, mensaje, tipo) VALUES (?, ?, ?, ?)',
                [
                    cita.usuario_id,
                    `Estado de cita actualizado: ${estadoLimpio}`,
                    `Tu cita (${cita.codigo_reserva}) para el día ${cita.fecha_cita} ha sido actualizada a "${estadoLimpio}".`,
                    estadoLimpio === 'Completada' ? 'exito' : (estadoLimpio === 'Cancelada' ? 'alerta' : 'info')
                ]
            );
        } catch(e){}

        return res.json({
            success: true,
            message: `Cita #${cita.codigo_reserva} actualizada a "${estadoLimpio}".`
        });
    } catch (err) {
        console.error('Error al actualizar estado:', err);
        return errorResponse(res, 500, 'Error interno del servidor.');
    }
});

/**
 * 5. GET /api/manicurista/agenda
 * Vista cronológica organizada de citas de hoy y próximas
 */
router.get('/agenda', (req, res) => {
    try {
        const manicuristaId = req.user.id;
        const today = new Date().toISOString().split('T')[0];

        const citasHoy = Database.all(`
            SELECT c.*, u.nombre AS cliente_nombre, u.apellido AS cliente_apellido, u.telefono AS cliente_telefono,
                   (SELECT GROUP_CONCAT(s.nombre, ', ') FROM detalle_cita dc JOIN servicios s ON dc.servicio_id = s.id WHERE dc.cita_id = c.id) AS servicios_resumen
            FROM citas c
            JOIN usuarios u ON c.usuario_id = u.id
            WHERE c.manicurista_id = ? AND c.fecha_cita = ?
            ORDER BY c.hora_cita ASC
        `, [manicuristaId, today]);

        const citasProximas = Database.all(`
            SELECT c.*, u.nombre AS cliente_nombre, u.apellido AS cliente_apellido, u.telefono AS cliente_telefono,
                   (SELECT GROUP_CONCAT(s.nombre, ', ') FROM detalle_cita dc JOIN servicios s ON dc.servicio_id = s.id WHERE dc.cita_id = c.id) AS servicios_resumen
            FROM citas c
            JOIN usuarios u ON c.usuario_id = u.id
            WHERE c.manicurista_id = ? AND c.fecha_cita > ?
            ORDER BY c.fecha_cita ASC, c.hora_cita ASC
            LIMIT 20
        `, [manicuristaId, today]);

        return res.json({
            success: true,
            data: {
                hoy: citasHoy,
                proximas: citasProximas
            }
        });
    } catch (err) {
        console.error('Error en /api/manicurista/agenda:', err);
        return res.status(500).json({ success: false, message: 'Error al obtener la agenda.' });
    }
});

/**
 * 6. GET /api/manicurista/notificaciones
 */
router.get('/notificaciones', (req, res) => {
    try {
        const manicuristaId = req.user.id;
        const notifs = Database.all(
            'SELECT * FROM notificaciones WHERE usuario_id = ? ORDER BY id DESC LIMIT 15',
            [manicuristaId]
        );

        // Notificaciones sintéticas basadas en citas asignadas recientes si tabla vacía
        if (notifs.length === 0) {
            const citasRecientes = Database.all(`
                SELECT c.*, u.nombre AS cliente_nombre 
                FROM citas c JOIN usuarios u ON c.usuario_id = u.id 
                WHERE c.manicurista_id = ? 
                ORDER BY c.id DESC LIMIT 4
            `, [manicuristaId]);

            citasRecientes.forEach(c => {
                notifs.push({
                    id: c.id,
                    usuario_id: manicuristaId,
                    titulo: `Cita Asignada: ${c.codigo_reserva}`,
                    mensaje: `Tienes una cita asignada con ${c.cliente_nombre} para el ${c.fecha_cita} a las ${c.hora_cita}.`,
                    tipo: 'reserva',
                    leida: 0,
                    fecha_creacion: c.fecha_creacion
                });
            });
        }

        return res.json({
            success: true,
            data: notifs
        });
    } catch (err) {
        console.error('Error en notificaciones manicurista:', err);
        return res.status(500).json({ success: false, message: 'Error al obtener notificaciones.' });
    }
});

/**
 * 7. GET /api/manicurista/perfil
 */
router.get('/perfil', (req, res) => {
    try {
        const manicuristaId = req.user.id;
        const user = Database.get('SELECT id, nombre, apellido, email, telefono, estado, fecha_registro FROM usuarios WHERE id = ?', [manicuristaId]);

        const especialidades = Database.all(`
            SELECT s.id, s.nombre, s.descripcion, s.precio, s.imagen
            FROM manicurista_servicios ms
            INNER JOIN servicios s ON ms.servicio_id = s.id
            WHERE ms.manicurista_id = ? AND s.estado = 'activo'
        `, [manicuristaId]);

        return res.json({
            success: true,
            data: {
                usuario: user,
                especialidades
            }
        });
    } catch (err) {
        console.error('Error en perfil manicurista:', err);
        return res.status(500).json({ success: false, message: 'Error al obtener perfil profesional.' });
    }
});

module.exports = router;
