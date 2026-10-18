/**
 * NailArtist Studio — Services & Catalog Routes
 * Catálogo protegido para usuarios autenticados, reseñas específicas por servicio y manicuristas activas
 */

const express = require('express');
const router = express.Router();
const Database = require('../database/db');

/**
 * GET /api/servicios/meta/manicuristas
 * Obtener manicuristas activas y sus especialidades (Público para la sección "Conoce a nuestras manicuristas")
 */
router.get('/meta/manicuristas', (req, res) => {
    try {
        const manicuristas = Database.all(`
            SELECT u.id, u.nombre, u.apellido, u.email, u.telefono, 
                   COALESCE(u.foto_perfil, u.foto) AS foto_perfil, 
                   COALESCE(u.foto, u.foto_perfil) AS foto, 
                   COALESCE(u.cargo_especialidad, u.especialidades_texto, 'Manicurista Profesional') AS cargo_especialidad,
                   u.especialidades_texto, u.descripcion, 
                   COALESCE(u.experiencia_anios, 3) AS experiencia_anios, u.estado,
                   (SELECT COUNT(*) FROM citas c WHERE c.manicurista_id = u.id AND c.estado = 'Completada') AS total_citas_completadas,
                   (SELECT ROUND(AVG(calificacion), 1) FROM resenas r WHERE r.publicado = 1) AS calificacion_estudio
            FROM usuarios u
            WHERE u.rol_id = 3 AND u.estado = 'activo'
            ORDER BY u.id ASC
        `);

        // Adjuntar especialidades de cada manicurista
        manicuristas.forEach(m => {
            const specs = Database.all(`
                SELECT s.id, s.nombre, s.slug, s.precio, s.duracion_minutos
                FROM manicurista_servicios ms
                JOIN servicios s ON ms.servicio_id = s.id
                WHERE ms.manicurista_id = ? AND s.estado = 'activo'
            `, [m.id]);
            m.especialidades = specs;
        });

        return res.json({
            success: true,
            total: manicuristas.length,
            data: manicuristas
        });
    } catch (err) {
        console.error('Error al obtener manicuristas:', err);
        return res.status(500).json({ success: false, message: 'Error al obtener manicuristas.' });
    }
});

/**
 * GET /api/servicios/:id/resenas
 * Reseñas publicadas asociadas a un servicio específico
 */
router.get('/:id/resenas', (req, res) => {
    try {
        const servicioId = parseInt(req.params.id, 10);
        if (isNaN(servicioId)) {
            return res.status(400).json({ success: false, message: 'ID de servicio inválido.' });
        }

        const resenas = Database.all(`
            SELECT r.id, r.calificacion, r.comentario, r.fecha_resena,
                   u.nombre AS cliente_nombre, SUBSTR(u.nombre, 1, 1) AS inicial
            FROM resenas r
            INNER JOIN usuarios u ON r.usuario_id = u.id
            WHERE r.servicio_id = ? AND r.publicado = 1
            ORDER BY r.id DESC
            LIMIT 15
        `, [servicioId]);

        const resumen = Database.get(`
            SELECT COUNT(*) AS total, ROUND(AVG(calificacion), 1) AS promedio
            FROM resenas
            WHERE servicio_id = ? AND publicado = 1
        `, [servicioId]);

        return res.json({
            success: true,
            total: resenas.length,
            promedio: resumen?.promedio || 5.0,
            data: resenas
        });
    } catch (err) {
        console.error('Error al obtener reseñas del servicio:', err);
        return res.status(500).json({ success: false, message: 'Error al cargar reseñas del servicio.' });
    }
});

/**
 * GET /api/servicios/meta/descuento
 * Retorna la información del beneficio aplicable al usuario según orden de prioridad
 */
router.get('/meta/descuento', (req, res) => {
    try {
        const configDescRow = Database.get("SELECT valor FROM configuracion WHERE clave = 'descuento_general_porcentaje'");
        const configActivoRow = Database.get("SELECT valor FROM configuracion WHERE clave = 'descuento_general_activo'");
        const configNombreRow = Database.get("SELECT valor FROM configuracion WHERE clave = 'descuento_general_nombre'");

        const generalPorcentaje = configDescRow ? parseFloat(configDescRow.valor) : 0.0;
        const generalActivo = configActivoRow ? configActivoRow.valor === '1' : false;
        const generalNombre = configNombreRow ? configNombreRow.valor : 'Promoción General';

        let tipoAplicado = 'ninguno';
        let porcentajeAplicado = 0;
        let esPersonalizado = false;
        let nombreCampana = 'Tarifa Estándar';
        let numeroCompra = 1;

        const userId = req.user ? req.user.id : (req.session ? req.session.userId : null);

        if (userId) {
            const user = Database.get('SELECT id, descuento_vip, nombre FROM usuarios WHERE id = ?', [userId]);
            const userCustomDesc = user ? parseFloat(user.descuento_vip || 0) : 0;

            // Prioridad 1: Descuento personalizado manual del cliente
            if (userCustomDesc > 0) {
                tipoAplicado = 'personalizado';
                porcentajeAplicado = userCustomDesc;
                esPersonalizado = true;
                nombreCampana = `Descuento Personalizado (${userCustomDesc}%)`;
            } else {
                // Prioridad 2: Beneficio por número de compra real
                const countRow = Database.get(
                    "SELECT COUNT(*) AS total FROM citas WHERE usuario_id = ? AND estado IN ('Confirmada', 'Completada')",
                    [userId]
                );
                const comprasPrevias = countRow ? parseInt(countRow.total, 10) : 0;
                numeroCompra = comprasPrevias + 1;

                const c1 = Database.get("SELECT valor FROM configuracion WHERE clave = 'descuento_compra_1'");
                const c2 = Database.get("SELECT valor FROM configuracion WHERE clave = 'descuento_compra_2'");
                const c3 = Database.get("SELECT valor FROM configuracion WHERE clave = 'descuento_compra_3'");
                const c4 = Database.get("SELECT valor FROM configuracion WHERE clave = 'descuento_compra_4_mas'");

                const pct1 = c1 ? parseFloat(c1.valor) : 15.0;
                const pct2 = c2 ? parseFloat(c2.valor) : 5.0;
                const pct3 = c3 ? parseFloat(c3.valor) : 3.0;
                const pct4 = c4 ? parseFloat(c4.valor) : 0.0;

                let pctTier = 0;
                let tierNombre = '';

                if (numeroCompra === 1) {
                    pctTier = pct1;
                    tierNombre = `Beneficio 1ra Compra (${pct1}% OFF)`;
                } else if (numeroCompra === 2) {
                    pctTier = pct2;
                    tierNombre = `Beneficio 2da Compra (${pct2}% OFF)`;
                } else if (numeroCompra === 3) {
                    pctTier = pct3;
                    tierNombre = `Beneficio 3ra Compra (${pct3}% OFF)`;
                } else {
                    pctTier = pct4;
                    tierNombre = pct4 > 0 ? `Beneficio Compra #${numeroCompra} (${pct4}% OFF)` : 'Cliente Frecuente';
                }

                if (pctTier > 0) {
                    tipoAplicado = 'numero_compra';
                    porcentajeAplicado = pctTier;
                    esPersonalizado = false;
                    nombreCampana = tierNombre;
                } else if (generalActivo && generalPorcentaje > 0) {
                    // Prioridad 3: Descuento general
                    tipoAplicado = 'general';
                    porcentajeAplicado = generalPorcentaje;
                    esPersonalizado = false;
                    nombreCampana = generalNombre;
                }
            }
        }

        return res.json({
            success: true,
            data: {
                tipo: tipoAplicado,
                porcentaje: Math.round(porcentajeAplicado),
                numero_compra: numeroCompra,
                es_personalizado: esPersonalizado,
                nombre_campana: nombreCampana,
                general: {
                    porcentaje: Math.round(generalPorcentaje),
                    activo: generalActivo,
                    nombre: generalNombre
                },
                autenticado: !!userId
            }
        });
    } catch (err) {
        console.error('Error al consultar meta/descuento:', err);
        return res.status(500).json({ success: false, message: 'Error al consultar descuento.' });
    }
});

/**
 * GET /api/servicios & /api/obtener_servicios
 * Catálogo completo de servicios (Público para todos los visitantes)
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
 * Detalle de servicio (Público)
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
