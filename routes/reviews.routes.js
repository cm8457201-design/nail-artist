/**
 * NailArtist Studio — Reviews Routes
 * Sistema de reseñas, testimonios y calificaciones de 1 a 5 estrellas
 */

const express = require('express');
const router = express.Router();
const Database = require('../database/db');

/**
 * GET /api/resenas
 * Obtener reseñas públicas (opcionalmente filtradas por servicio_id)
 */
router.get('/', (req, res) => {
    try {
        const { servicio_id, limit } = req.query;
        let sql = `
            SELECT r.id, r.usuario_id, r.servicio_id, r.calificacion, r.comentario, 
                   r.publicado, r.fecha_resena,
                   u.nombre AS usuario_nombre, u.apellido AS usuario_apellido,
                   s.nombre AS servicio_nombre, s.imagen AS servicio_imagen
            FROM resenas r
            INNER JOIN usuarios u ON r.usuario_id = u.id
            LEFT JOIN servicios s ON r.servicio_id = s.id
            WHERE r.publicado = 1
        `;
        const params = [];

        if (servicio_id) {
            sql += ' AND r.servicio_id = ?';
            params.push(parseInt(servicio_id, 10));
        }

        sql += ' ORDER BY r.id DESC';

        if (limit) {
            sql += ' LIMIT ?';
            params.push(parseInt(limit, 10));
        }

        const resenas = Database.all(sql, params);

        return res.json({
            success: true,
            total: resenas.length,
            data: resenas
        });
    } catch (err) {
        console.error('Error al obtener reseñas:', err);
        return res.status(500).json({ success: false, message: 'Error al cargar reseñas.' });
    }
});

/**
 * GET /api/resenas/servicio/:id o /api/servicios/:id/resenas
 */
router.get('/servicio/:id', (req, res) => {
    try {
        const servicioId = parseInt(req.params.id, 10);
        if (isNaN(servicioId)) {
            return res.status(400).json({ success: false, message: 'ID de servicio inválido.' });
        }

        const resenas = Database.all(
            `SELECT r.id, r.usuario_id, r.servicio_id, r.calificacion, r.comentario, 
                    r.publicado, r.fecha_resena,
                    u.nombre AS usuario_nombre, u.apellido AS usuario_apellido
             FROM resenas r
             INNER JOIN usuarios u ON r.usuario_id = u.id
             WHERE r.servicio_id = ? AND r.publicado = 1
             ORDER BY r.id DESC`,
            [servicioId]
        );

        // Promedio y desglose
        const stats = Database.get(
            `SELECT COUNT(*) AS total, ROUND(AVG(calificacion), 1) AS promedio 
             FROM resenas 
             WHERE servicio_id = ? AND publicado = 1`,
            [servicioId]
        );

        return res.json({
            success: true,
            stats: {
                total: stats ? stats.total : 0,
                promedio: stats && stats.promedio ? stats.promedio : 5.0
            },
            data: resenas
        });
    } catch (err) {
        console.error('Error al obtener reseñas del servicio:', err);
        return res.status(500).json({ success: false, message: 'Error interno.' });
    }
});

/**
 * POST /api/resenas
 * Crear una nueva reseña vinculada al usuario y servicio
 */
router.post('/', (req, res) => {
    try {
        const { servicio_id, calificacion, comentario, nombre_cliente } = req.body || {};

        const rating = parseInt(calificacion, 10);
        if (isNaN(rating) || rating < 1 || rating > 5) {
            return res.status(400).json({
                success: false,
                message: 'Por favor selecciona una calificación válida de 1 a 5 estrellas.'
            });
        }

        if (!comentario || !comentario.trim()) {
            return res.status(400).json({
                success: false,
                message: 'Por favor escribe un comentario contando tu experiencia.'
            });
        }

        // Determinar usuario: Si está en sesión, usar su ID. De lo contrario, buscar o usar cliente por defecto o crear uno.
        let userId = req.user ? req.user.id : (req.session ? req.session.userId : null);

        if (!userId) {
            // Si no hay sesión pero se proporciona nombre, buscar usuario o asociar al usuario 2 (Cliente por defecto)
            const fallbackUser = Database.get('SELECT id FROM usuarios WHERE rol_id = 2 ORDER BY id ASC LIMIT 1');
            userId = fallbackUser ? fallbackUser.id : 1;
        }

        const servId = servicio_id ? parseInt(servicio_id, 10) : null;

        const result = Database.run(
            `INSERT INTO resenas (usuario_id, servicio_id, calificacion, comentario, publicado)
             VALUES (?, ?, ?, ?, 1)`,
            [userId, servId, rating, comentario.trim()]
        );

        return res.status(201).json({
            success: true,
            message: '¡Muchas gracias por tu reseña! Ha sido publicada exitosamente.',
            data: {
                id: result.lastInsertRowid,
                calificacion: rating,
                comentario: comentario.trim()
            }
        });
    } catch (err) {
        console.error('Error al publicar reseña:', err);
        return res.status(500).json({
            success: false,
            message: 'Error al registrar la reseña.'
        });
    }
});

module.exports = router;
