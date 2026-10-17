/**
 * NailArtist Studio — Bookings Routes
 * Gestión de citas, detalle de servicios y generación de códigos de reserva
 */

const express = require('express');
const router = express.Router();
const Database = require('../database/db');

/**
 * POST /api/reservas & /api/crear_reserva
 */
router.post(['/', '/crear_reserva'], (req, res) => {
    try {
        const { servicios, fecha_cita, hora_cita, observaciones, metodo_contacto } = req.body || {};

        if (!servicios || !Array.isArray(servicios) || servicios.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Debes incluir al menos un servicio en tu reserva.'
            });
        }

        // Obtener usuario autenticado o cliente por defecto
        let userId = req.user ? req.user.id : (req.session ? req.session.userId : null);
        let userDescuento = 0;

        if (userId) {
            const u = Database.get('SELECT id, descuento_vip FROM usuarios WHERE id = ?', [userId]);
            if (u) userDescuento = Number(u.descuento_vip || 0);
        } else {
            const fallbackUser = Database.get('SELECT id, descuento_vip FROM usuarios WHERE rol_id = 2 ORDER BY id ASC LIMIT 1');
            userId = fallbackUser ? fallbackUser.id : 1;
            userDescuento = fallbackUser ? Number(fallbackUser.descuento_vip || 0) : 0;
        }

        // Calcular totales
        let totalBs = 0;
        const itemsToInsert = [];

        for (const item of servicios) {
            const nombre = (item.nombre || '').trim();
            const precioUnit = Math.max(0, parseFloat(item.precio) || 0);
            const cantidad = Math.max(1, parseInt(item.cantidad, 10) || 1);
            const subtotal = precioUnit * cantidad;

            // Buscar servicio en la BD si existe para asociar ID
            const dbServ = Database.get('SELECT id FROM servicios WHERE nombre LIKE ? LIMIT 1', [`%${nombre}%`]);
            const servicioId = dbServ ? dbServ.id : 1; // Fallback al primer servicio

            totalBs += subtotal;
            itemsToInsert.push({
                servicio_id: servicioId,
                nombre,
                precio_unitario: precioUnit,
                cantidad,
                subtotal
            });
        }

        const descuentoMonto = totalBs * (userDescuento / 100);
        const totalFinalBs = Math.max(0, totalBs - descuentoMonto);

        // Generar código de reserva único
        const year = new Date().getFullYear();
        const randNum = Math.floor(1000 + Math.random() * 9000);
        const codigoReserva = `RES-${year}-${randNum}`;

        const fechaFinal = fecha_cita || new Date(Date.now() + 86400000).toISOString().split('T')[0];
        const horaFinal = hora_cita || '15:00:00';
        const metodoFinal = metodo_contacto || 'WhatsApp';

        // Insertar en tabla citas
        const resultCita = Database.run(
            `INSERT INTO citas (codigo_reserva, usuario_id, fecha_cita, hora_cita, total_bs, descuento_aplicado, total_final_bs, estado, observaciones, metodo_contacto)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'Pendiente', ?, ?)`,
            [
                codigoReserva,
                userId,
                fechaFinal,
                horaFinal,
                totalBs.toFixed(2),
                descuentoMonto.toFixed(2),
                totalFinalBs.toFixed(2),
                observaciones || 'Reserva generada desde la plataforma web',
                metodoFinal
            ]
        );

        const citaId = resultCita.lastInsertRowid;

        // Insertar detalles en detalle_cita
        for (const item of itemsToInsert) {
            Database.run(
                `INSERT INTO detalle_cita (cita_id, servicio_id, precio_unitario, cantidad, subtotal)
                 VALUES (?, ?, ?, ?, ?)`,
                [citaId, item.servicio_id, item.precio_unitario.toFixed(2), item.cantidad, item.subtotal.toFixed(2)]
            );
        }

        return res.status(201).json({
            success: true,
            message: '¡Reserva creada exitosamente!',
            data: {
                cita_id: citaId,
                codigo_reserva: codigoReserva,
                total_bs: totalBs,
                descuento_aplicado: descuentoMonto,
                total_final_bs: totalFinalBs,
                fecha_cita: fechaFinal,
                hora_cita: horaFinal
            }
        });
    } catch (err) {
        console.error('Error al crear reserva:', err);
        return res.status(500).json({
            success: false,
            message: 'Error al procesar la reserva.'
        });
    }
});

/**
 * GET /api/reservas/mis-citas
 */
router.get('/mis-citas', (req, res) => {
    const userId = req.user ? req.user.id : (req.session ? req.session.userId : null);
    if (!userId) {
        return res.status(401).json({ success: false, message: 'Inicia sesión para ver tus citas.' });
    }

    try {
        const citas = Database.all(
            `SELECT c.*, 
                    (SELECT COUNT(*) FROM detalle_cita d WHERE d.cita_id = c.id) AS total_servicios,
                    (SELECT GROUP_CONCAT(COALESCE(s.nombre, 'Servicio'), ', ') 
                     FROM detalle_cita d 
                     LEFT JOIN servicios s ON d.servicio_id = s.id 
                     WHERE d.cita_id = c.id) AS servicios_resumen
             FROM citas c
             WHERE c.usuario_id = ?
             ORDER BY c.id DESC`,
            [userId]
        );

        return res.json({ success: true, data: citas });
    } catch (err) {
        console.error('Error al obtener citas del usuario:', err);
        return res.status(500).json({ success: false, message: 'Error al consultar citas.' });
    }
});

/**
 * GET /api/reservas/detalle/:id & /api/reservas/:id
 * Obtener detalle completo de una reserva con todos los servicios
 */
router.get(['/detalle/:id', '/:id'], (req, res) => {
    const userId = req.user ? req.user.id : (req.session ? req.session.userId : null);
    if (!userId) {
        return res.status(401).json({ success: false, message: 'Inicia sesión para consultar el detalle.' });
    }

    try {
        const citaId = parseInt(req.params.id, 10);
        const isAdmin = req.user && (req.user.rol_id === 1 || (req.user.rol_nombre || '').toLowerCase() === 'administrador');

        // Si es admin puede ver cualquier cita; si es cliente sólo sus citas
        const queryCita = isAdmin
            ? `SELECT c.*, u.nombre AS cliente_nombre, u.apellido AS cliente_apellido, u.telefono AS cliente_telefono, u.email AS cliente_email 
               FROM citas c INNER JOIN usuarios u ON c.usuario_id = u.id WHERE c.id = ?`
            : `SELECT c.*, u.nombre AS cliente_nombre, u.apellido AS cliente_apellido, u.telefono AS cliente_telefono, u.email AS cliente_email 
               FROM citas c INNER JOIN usuarios u ON c.usuario_id = u.id WHERE c.id = ? AND c.usuario_id = ?`;
        
        const params = isAdmin ? [citaId] : [citaId, userId];
        const cita = Database.get(queryCita, params);

        if (!cita) {
            return res.status(404).json({ success: false, message: 'Reserva no encontrada o no autorizada.' });
        }

        const items = Database.all(
            `SELECT d.*, s.nombre AS servicio_nombre, s.imagen AS servicio_imagen, s.duracion_minutos
             FROM detalle_cita d
             LEFT JOIN servicios s ON d.servicio_id = s.id
             WHERE d.cita_id = ?`,
            [citaId]
        );

        return res.json({
            success: true,
            data: {
                ...cita,
                servicios: items
            }
        });
    } catch (err) {
        console.error('Error al obtener detalle de reserva:', err);
        return res.status(500).json({ success: false, message: 'Error al obtener detalle de la cita.' });
    }
});

module.exports = router;
