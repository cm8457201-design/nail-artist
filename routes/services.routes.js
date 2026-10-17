/**
 * NailArtist Studio — Services Routes
 * Obtener catálogo de servicios y categorías desde SQLite
 */

const express = require('express');
const router = express.Router();
const Database = require('../database/db');

/**
 * GET /api/servicios & /api/obtener_servicios
 */
router.get(['/', '/obtener_servicios'], (req, res) => {
    try {
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.set('Pragma', 'no-cache');
        res.set('Expires', '0');

        const { categoria_id, destacado } = req.query;
        let sql = `
            SELECT s.*, COALESCE(c.nombre, 'General') AS categoria_nombre, COALESCE(c.slug, 'general') AS categoria_slug,
                   (SELECT COUNT(*) FROM resenas r WHERE r.servicio_id = s.id AND r.publicado = 1) AS total_resenas,
                   (SELECT ROUND(AVG(calificacion), 1) FROM resenas r WHERE r.servicio_id = s.id AND r.publicado = 1) AS calificacion_promedio
            FROM servicios s
            LEFT JOIN categorias c ON s.categoria_id = c.id
            WHERE s.estado = 'activo'
        `;
        const params = [];

        if (categoria_id) {
            sql += ' AND s.categoria_id = ?';
            params.push(categoria_id);
        }

        if (destacado !== undefined && destacado !== '') {
            sql += ' AND s.destacado = ?';
            params.push(destacado === '1' || destacado === 'true' ? 1 : 0);
        }

        sql += ' ORDER BY s.id ASC';

        const servicios = Database.all(sql, params);

        return res.json({
            success: true,
            total: servicios.length,
            data: servicios
        });
    } catch (err) {
        console.error('Error al obtener servicios:', err);
        return res.status(500).json({
            success: false,
            message: 'Error al cargar los servicios.'
        });
    }
});

/**
 * GET /api/servicios/:id
 */
router.get('/:id', (req, res) => {
    try {
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        const id = parseInt(req.params.id, 10);
        if (isNaN(id)) {
            return res.status(400).json({ success: false, message: 'ID inválido' });
        }

        const servicio = Database.get(
            `SELECT s.*, COALESCE(c.nombre, 'General') AS categoria_nombre, COALESCE(c.slug, 'general') AS categoria_slug,
                    (SELECT COUNT(*) FROM resenas r WHERE r.servicio_id = s.id AND r.publicado = 1) AS total_resenas,
                    (SELECT ROUND(AVG(calificacion), 1) FROM resenas r WHERE r.servicio_id = s.id AND r.publicado = 1) AS calificacion_promedio
             FROM servicios s
             LEFT JOIN categorias c ON s.categoria_id = c.id
             WHERE s.id = ? AND s.estado = 'activo'`,
            [id]
        );

        if (!servicio) {
            return res.status(404).json({ success: false, message: 'Servicio no encontrado' });
        }

        return res.json({
            success: true,
            data: servicio
        });
    } catch (err) {
        console.error('Error al obtener servicio:', err);
        return res.status(500).json({ success: false, message: 'Error interno del servidor' });
    }
});

/**
 * GET /api/categorias
 */
router.get('/meta/categorias', (req, res) => {
    try {
        const categorias = Database.all('SELECT * FROM categorias WHERE estado = \'activo\' ORDER BY id ASC');
        return res.json({ success: true, data: categorias });
    } catch (err) {
        console.error('Error al obtener categorías:', err);
        return res.status(500).json({ success: false, message: 'Error al cargar categorías' });
    }
});

module.exports = router;
