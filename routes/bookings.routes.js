/**
 * NailArtist Studio — Bookings Routes
 * Gestión de citas, asignación de manicuristas, detalle de servicios y generación de códigos de reserva
 */

const express = require('express');
const router = express.Router();
const Database = require('../database/db');
const {
    requireAuth,
    errorResponse,
    validarId,
    validarFecha,
    validarHora,
    validarTexto,
    validarMetodoContacto,
    fechaEsPasada
} = require('../middleware/validation');

/**
 * Helper para convertir "HH:MM" a minutos desde medianoche
 */
function timeToMinutes(timeStr) {
    if (!timeStr) return 0;
    const parts = timeStr.trim().split(':');
    const h = parseInt(parts[0], 10) || 0;
    const m = parseInt(parts[1], 10) || 0;
    return h * 60 + m;
}

/**
 * Helper para convertir minutos desde medianoche a "HH:MM"
 */
function minutesToTime(mins) {
    const h = Math.floor(mins / 60).toString().padStart(2, '0');
    const m = (mins % 60).toString().padStart(2, '0');
    return `${h}:${m}`;
}

/**
 * Helper para calcular descuento por usuario según reglas de prioridad:
 * 1. Descuento personalizado manual del cliente (> 0)
 * 2. Beneficio por número de compra (1ra: 15%, 2da: 5%, 3ra: 3%, 4ta+: 0%)
 * 3. Descuento general de la tienda si está activo
 * 4. 0%
 */
function calcularDescuentoUsuario(userId) {
    if (!userId) {
        // Visitante no registrado: 0% beneficio personal
        return {
            porcentaje: 0,
            tipo: 'ninguno',
            nombre_regla: 'Sin descuento',
            numero_compra: 1,
            es_personalizado: false
        };
    }

    const user = Database.get('SELECT id, descuento_vip FROM usuarios WHERE id = ?', [userId]);
    const customDesc = user ? parseFloat(user.descuento_vip || 0) : 0;

    // Prioridad 1: Descuento personalizado asignado manualmente al cliente
    if (customDesc > 0) {
        return {
            porcentaje: customDesc,
            tipo: 'personalizado',
            nombre_regla: `Descuento Personalizado (${customDesc}%)`,
            numero_compra: 1,
            es_personalizado: true
        };
    }

    // Calcular historial de compras reales (excluyendo canceladas)
    const countRow = Database.get(
        "SELECT COUNT(*) AS total FROM citas WHERE usuario_id = ? AND estado IN ('Confirmada', 'Completada')",
        [userId]
    );
    const comprasPrevias = countRow ? parseInt(countRow.total, 10) : 0;
    const numeroCompra = comprasPrevias + 1;

    // Consultar porcentajes configurados en la base de datos
    const c1 = Database.get("SELECT valor FROM configuracion WHERE clave = 'descuento_compra_1'");
    const c2 = Database.get("SELECT valor FROM configuracion WHERE clave = 'descuento_compra_2'");
    const c3 = Database.get("SELECT valor FROM configuracion WHERE clave = 'descuento_compra_3'");
    const c4 = Database.get("SELECT valor FROM configuracion WHERE clave = 'descuento_compra_4_mas'");

    const pct1 = c1 ? parseFloat(c1.valor) : 15.0;
    const pct2 = c2 ? parseFloat(c2.valor) : 5.0;
    const pct3 = c3 ? parseFloat(c3.valor) : 3.0;
    const pct4 = c4 ? parseFloat(c4.valor) : 0.0;

    let pctCompra = 0;
    let reglaNombre = '';

    if (numeroCompra === 1) {
        pctCompra = pct1;
        reglaNombre = `1ra Compra (${pct1}% OFF)`;
    } else if (numeroCompra === 2) {
        pctCompra = pct2;
        reglaNombre = `2da Compra (${pct2}% OFF)`;
    } else if (numeroCompra === 3) {
        pctCompra = pct3;
        reglaNombre = `3ra Compra (${pct3}% OFF)`;
    } else {
        pctCompra = pct4;
        reglaNombre = pct4 > 0 ? `Compra #${numeroCompra} (${pct4}% OFF)` : 'Cliente Frecuente';
    }

    // Prioridad 2: Beneficio por número de compra
    if (pctCompra > 0) {
        return {
            porcentaje: pctCompra,
            tipo: 'numero_compra',
            nombre_regla: reglaNombre,
            numero_compra: numeroCompra,
            es_personalizado: false
        };
    }

    // Prioridad 3: Descuento general si está activo
    const configDescRow = Database.get("SELECT valor FROM configuracion WHERE clave = 'descuento_general_porcentaje'");
    const configActivoRow = Database.get("SELECT valor FROM configuracion WHERE clave = 'descuento_general_activo'");
    const configNombreRow = Database.get("SELECT valor FROM configuracion WHERE clave = 'descuento_general_nombre'");

    const generalPorcentaje = configDescRow ? parseFloat(configDescRow.valor) : 0.0;
    const generalActivo = configActivoRow ? configActivoRow.valor === '1' : false;
    const generalNombre = configNombreRow ? configNombreRow.valor : 'Promoción General';

    if (generalActivo && generalPorcentaje > 0) {
        return {
            porcentaje: generalPorcentaje,
            tipo: 'general',
            nombre_regla: generalNombre,
            numero_compra: numeroCompra,
            es_personalizado: false
        };
    }

    // Prioridad 4: Sin descuento (0%)
    return {
        porcentaje: 0,
        tipo: 'ninguno',
        nombre_regla: 'Tarifa Estándar',
        numero_compra: numeroCompra,
        es_personalizado: false
    };
}

/**
 * GET /api/reservas/disponibilidad
 * Consulta horarios y disponibilidad real considerando citas existentes, duración de servicio y horas de atención
 */
router.get('/disponibilidad', (req, res) => {
    try {
        const manicurista_id = req.query.manicurista_id;
        const fecha_cita_raw = req.query.fecha || req.query.fecha_cita;
        const duracionParam = parseInt(req.query.duracion || req.query.duracion_minutos || 60, 10);
        const duracionRequerida = isNaN(duracionParam) || duracionParam <= 0 ? 60 : Math.min(duracionParam, 480);

        // Validar que la fecha tenga formato YYYY-MM-DD
        const fecha_cita = validarFecha(fecha_cita_raw);
        if (!fecha_cita) {
            return errorResponse(res, 400, 'La fecha de la cita no es válida. Usa el formato YYYY-MM-DD.');
        }

        // Horarios estándar de apertura
        const defaultSlots = [
            '09:00', '10:00', '11:00', '12:00', 
            '14:00', '15:00', '16:00', '17:00', '18:00', '19:00'
        ];

        const horaCierreMin = 19 * 60 + 30; // 19:30 (1170 minutos)
        const horaAperturaMin = 9 * 60;     // 09:00 (540 minutos)

        // Obtener citas activas de la manicurista en la fecha dada
        let citasManicurista = [];
        if (manicurista_id) {
            const maniIdNum = parseInt(manicurista_id, 10);
            citasManicurista = Database.all(`
                SELECT c.id, c.codigo_reserva, c.hora_cita, c.estado,
                       (SELECT COALESCE(SUM(s.duracion_minutos), 60) 
                        FROM detalle_cita d 
                        JOIN servicios s ON d.servicio_id = s.id 
                        WHERE d.cita_id = c.id) AS duracion_total
                FROM citas c
                WHERE c.manicurista_id = ? AND c.fecha_cita = ? AND c.estado IN ('Pendiente', 'Confirmada', 'En Atencion')
            `, [maniIdNum, fecha_cita]);
        }

        // Determinar fecha y hora actual del servidor
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const todayStr = `${year}-${month}-${day}`;
        const currentMinsNow = now.getHours() * 60 + now.getMinutes();
        const esHoy = fecha_cita === todayStr;
        const esPasado = fecha_cita < todayStr;

        const slots = defaultSlots.map(slotTime => {
            const slotStartMin = timeToMinutes(slotTime);
            const slotEndMin = slotStartMin + duracionRequerida;

            let estado = 'disponible';
            let etiqueta = 'Disponible';
            let disponible = true;
            let motivo = '';

            // 1. Fecha en el pasado
            if (esPasado) {
                estado = 'turno_finalizado';
                etiqueta = 'Turno finalizado';
                disponible = false;
                motivo = 'La fecha seleccionada ya ha transcurrido.';
            }
            // 2. Si es hoy y el horario ya pasó
            else if (esHoy && slotStartMin <= currentMinsNow) {
                // Verificar si actualmente la manicurista está en una cita en este rango
                const citaActual = citasManicurista.find(c => {
                    const cStart = timeToMinutes(c.hora_cita);
                    const cDur = parseInt(c.duracion_total, 10) || 60;
                    const cEnd = cStart + cDur;
                    return currentMinsNow >= cStart && currentMinsNow < cEnd;
                });

                if (citaActual && slotStartMin >= timeToMinutes(citaActual.hora_cita) && slotStartMin < timeToMinutes(citaActual.hora_cita) + (parseInt(citaActual.duracion_total, 10) || 60)) {
                    estado = 'en_atencion';
                    etiqueta = 'En atención';
                    disponible = false;
                    motivo = 'La manicurista se encuentra atendiendo una cita actualmente.';
                } else {
                    estado = 'turno_finalizado';
                    etiqueta = 'Turno finalizado';
                    disponible = false;
                    motivo = 'El horario de este turno ya ha concluido.';
                }
            }
            // 3. Fuera del horario de atención del estudio
            else if (slotStartMin < horaAperturaMin) {
                estado = 'fuera_de_horario';
                etiqueta = 'Fuera de horario';
                disponible = false;
                motivo = 'Horario previo a la apertura del estudio.';
            }
            else if (slotEndMin > horaCierreMin) {
                estado = 'fuera_de_horario';
                etiqueta = 'Turno finalizado';
                disponible = false;
                motivo = `La duración del servicio (${duracionRequerida} min) excede el cierre de atención (19:30).`;
            }
            // 4. Conflicto de solapamiento con citas existentes
            else {
                for (const cita of citasManicurista) {
                    const citaStart = timeToMinutes(cita.hora_cita);
                    const citaDur = parseInt(cita.duracion_total, 10) || 60;
                    const citaEnd = citaStart + citaDur;

                    // Hay solapamiento si [slotStart, slotEnd] se cruza con [citaStart, citaEnd]
                    if (slotStartMin < citaEnd && slotEndMin > citaStart) {
                        estado = 'ocupado';
                        etiqueta = 'Ocupado';
                        disponible = false;
                        motivo = `Horario ocupado por otra cita agendada (${cita.hora_cita.substring(0, 5)} - ${minutesToTime(citaEnd)}).`;
                        break;
                    }
                }
            }

            return {
                hora: slotTime,
                estado,
                etiqueta,
                disponible,
                ocupado: !disponible,
                motivo
            };
        });

        return res.json({
            success: true,
            data: {
                fecha_cita,
                manicurista_id: manicurista_id ? parseInt(manicurista_id, 10) : null,
                duracion_minutos: duracionRequerida,
                slots
            }
        });
    } catch (err) {
        console.error('Error al consultar disponibilidad:', err);
        return res.status(500).json({ success: false, message: 'Error al consultar disponibilidad de horarios.' });
    }
});

/**
 * POST /api/reservas & /api/crear_reserva
 * Requiere autenticación: solo usuarios registrados pueden crear reservas.
 */
router.post(['/', '/crear_reserva'], requireAuth, (req, res) => {
    try {
        const body = req.body || {};
        const servicios = body.servicios || body.items;
        const { fecha_cita, hora_cita, observaciones, metodo_contacto, manicurista_id } = body;

        if (!servicios || !Array.isArray(servicios) || servicios.length === 0) {
            return errorResponse(res, 400, 'Debes incluir al menos un servicio en tu reserva.');
        }

        if (servicios.length > 10) {
            return errorResponse(res, 400, 'No puedes seleccionar más de 10 servicios por reserva.');
        }

        // Obtener usuario autenticado (garantizado por requireAuth)
        const userId = req.user.id;

        // Validar fecha (obligatoria y no puede ser pasada)
        const fechaFinal = validarFecha(fecha_cita);
        if (!fechaFinal) {
            return errorResponse(res, 400, 'La fecha de la cita no es válida. Usa el formato YYYY-MM-DD.', 'fecha_cita');
        }
        if (fechaEsPasada(fechaFinal)) {
            return errorResponse(res, 400, 'No puedes agendar una cita en una fecha que ya pasó.', 'fecha_cita');
        }

        // Validar hora (obligatoria)
        const horaCorta = validarHora(hora_cita);
        if (!horaCorta) {
            return errorResponse(res, 400, 'La hora de la cita no es válida. Usa el formato HH:MM.', 'hora_cita');
        }
        const horaFinal = horaCorta + ':00';

        // Validar método de contacto
        const metodoFinal = validarMetodoContacto(metodo_contacto);

        // Validar observaciones (opcional, texto plano, max 500 chars)
        let observacionesLimpias = 'Reserva personalizada con manicurista';
        if (observaciones && observaciones.trim()) {
            const obs = validarTexto(observaciones, { min: 1, max: 500 });
            if (obs === null) {
                return errorResponse(res, 400, 'Las observaciones no deben superar los 500 caracteres.', 'observaciones');
            }
            observacionesLimpias = obs;
        }

        // Calcular beneficio y descuento del usuario
        const descInfo = calcularDescuentoUsuario(userId);
        const userDescuentoPorcentaje = descInfo.porcentaje;
        const numeroCompra = descInfo.numero_compra;
        const esDescuentoPersonalizado = descInfo.es_personalizado;

        // Validar y determinar manicurista asignada
        let manicuristaFinalId = null;
        let manicuristaObj = null;

        if (manicurista_id) {
            const maniId = validarId(manicurista_id);
            if (!maniId) {
                return errorResponse(res, 400, 'El ID de manicurista no es válido.', 'manicurista_id');
            }
            manicuristaObj = Database.get("SELECT id, nombre, apellido FROM usuarios WHERE id = ? AND rol_id = 3 AND estado = 'activo'", [maniId]);
            if (!manicuristaObj) {
                return errorResponse(res, 400, 'La manicurista seleccionada no está disponible o no tiene el rol correspondiente.');
            }
            manicuristaFinalId = manicuristaObj.id;
        } else {
            const randomM = Database.get("SELECT id, nombre, apellido FROM usuarios WHERE rol_id = 3 AND estado = 'activo' ORDER BY RANDOM() LIMIT 1");
            if (randomM) {
                manicuristaFinalId = randomM.id;
                manicuristaObj = randomM;
            }
        }

        // Calcular totales y duración utilizando precios oficiales de SQLite
        let subtotalAcumulado = 0;
        let duracionTotalMinutos = 0;
        const itemsToInsert = [];

        for (const item of servicios) {
            // El servicio DEBE existir en la base de datos por ID (no aceptar precios del frontend)
            const serviceIdParam = item.id || item.servicio_id;
            const servId = validarId(serviceIdParam);
            if (!servId) {
                return errorResponse(res, 400, 'Uno de los servicios seleccionados tiene un ID inválido.');
            }

            const dbServ = Database.get(
                "SELECT id, nombre, precio, duracion_minutos FROM servicios WHERE id = ? AND estado = 'activo'",
                [servId]
            );
            if (!dbServ) {
                return errorResponse(res, 400, `El servicio con ID #${servId} no existe o no está disponible.`);
            }

            // Cantidad mínima 1, máxima 5 por servicio
            const cantidad = Math.max(1, Math.min(5, parseInt(item.cantidad, 10) || 1));

            // Precio oficial desde la DB (nunca del frontend)
            const precioUnit = Math.round(Number(dbServ.precio));
            const duracionUnit = parseInt(dbServ.duracion_minutos, 10) || 60;
            const subtotalItem = precioUnit * cantidad;

            subtotalAcumulado += subtotalItem;
            duracionTotalMinutos += duracionUnit * cantidad;

            itemsToInsert.push({
                servicio_id: dbServ.id,
                nombre: dbServ.nombre,
                precio_unitario: precioUnit,
                cantidad,
                subtotal: subtotalItem,
                duracion_minutos: duracionUnit
            });
        }

        // Validación estricta de solapamiento de agenda por duración
        if (manicuristaFinalId) {
            const slotStartMin = timeToMinutes(horaCorta);
            const slotEndMin = slotStartMin + duracionTotalMinutos;
            const horaCierreMin = 19 * 60 + 30; // 19:30

            if (slotEndMin > horaCierreMin) {
                return res.status(400).json({
                    success: false,
                    message: `La duración total de tus servicios seleccionados (${duracionTotalMinutos} min) excede el horario de atención del estudio (cierre 19:30). Selecciona un horario anterior.`
                });
            }

            const citasExistentes = Database.all(`
                SELECT c.id, c.codigo_reserva, c.hora_cita,
                       (SELECT COALESCE(SUM(s.duracion_minutos), 60) 
                        FROM detalle_cita d 
                        JOIN servicios s ON d.servicio_id = s.id 
                        WHERE d.cita_id = c.id) AS duracion_total
                FROM citas c
                WHERE c.manicurista_id = ? AND c.fecha_cita = ? AND c.estado IN ('Pendiente', 'Confirmada', 'En Atencion')
            `, [manicuristaFinalId, fechaFinal]);

            for (const cita of citasExistentes) {
                const citaStart = timeToMinutes(cita.hora_cita);
                const citaDur = parseInt(cita.duracion_total, 10) || 60;
                const citaEnd = citaStart + citaDur;

                if (slotStartMin < citaEnd && slotEndMin > citaStart) {
                    return res.status(409).json({
                        success: false,
                        message: `La manicurista ya tiene una cita agendada en este horario (${cita.hora_cita.substring(0, 5)} - ${minutesToTime(citaEnd)}). Por favor selecciona otro turno.`
                    });
                }
            }
        }

        // Redondeo monetario entero consistente (Sin decimales)
        const subtotalFinalEntero = Math.round(subtotalAcumulado);
        const descuentoMontoEntero = Math.round(subtotalFinalEntero * (userDescuentoPorcentaje / 100));
        const totalFinalEntero = Math.max(0, subtotalFinalEntero - descuentoMontoEntero);

        // Generar código de reserva único
        const year = new Date().getFullYear();
        const randNum = Math.floor(1000 + Math.random() * 9000);
        const codigoReserva = `RES-${year}-${randNum}`;
        // (metodoFinal ya fue validado arriba)

        // Insertar en tabla citas guardando el descuento y número de compra histórico
        const resultCita = Database.run(
            `INSERT INTO citas (
                codigo_reserva, usuario_id, manicurista_id, fecha_cita, hora_cita, 
                total_bs, descuento_aplicado, total_final_bs, descuento_porcentaje, numero_compra,
                estado, observaciones, metodo_contacto
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pendiente', ?, ?)`,
            [
                codigoReserva,
                userId,
                manicuristaFinalId,
                fechaFinal,
                horaFinal,
                subtotalFinalEntero,
                descuentoMontoEntero,
                totalFinalEntero,
                userDescuentoPorcentaje,
                numeroCompra,
                observacionesLimpias,
                metodoFinal
            ]
        );

        const citaId = resultCita.lastInsertRowid;

        // Insertar detalles en detalle_cita con cantidades enteras
        for (const item of itemsToInsert) {
            Database.run(
                `INSERT INTO detalle_cita (cita_id, servicio_id, precio_unitario, cantidad, subtotal)
                 VALUES (?, ?, ?, ?, ?)`,
                [citaId, item.servicio_id, item.precio_unitario, item.cantidad, item.subtotal]
            );
        }

        // Crear notificaciones en base de datos
        try {
            const manicName = manicuristaObj ? `${manicuristaObj.nombre} ${manicuristaObj.apellido || ''}`.trim() : 'Especialista';

            if (userId) {
                Database.run(
                    'INSERT INTO notificaciones (usuario_id, titulo, mensaje, tipo) VALUES (?, ?, ?, ?)',
                    [
                        userId,
                        `Reserva recibida (${codigoReserva})`,
                        `Tu cita con ${manicName} ha sido agendada para el ${fechaFinal} a las ${horaCorta}. Total: Bs. ${totalFinalEntero}. Estado: Pendiente.`,
                        'reserva'
                    ]
                );
            }

            if (manicuristaFinalId) {
                const clientUser = userId ? Database.get('SELECT nombre, apellido FROM usuarios WHERE id = ?', [userId]) : null;
                const clientName = clientUser ? `${clientUser.nombre} ${clientUser.apellido || ''}`.trim() : 'Cliente';
                Database.run(
                    'INSERT INTO notificaciones (usuario_id, titulo, mensaje, tipo) VALUES (?, ?, ?, ?)',
                    [
                        manicuristaFinalId,
                        `Nueva cita asignada (${codigoReserva})`,
                        `Tienes una nueva reserva con ${clientName} para el ${fechaFinal} a las ${horaCorta} (${duracionTotalMinutos} min).`,
                        'reserva'
                    ]
                );
            }
        } catch(e) {
            console.warn('Error al crear notificaciones automáticas:', e);
        }

        return res.status(201).json({
            success: true,
            message: '¡Reserva creada exitosamente!',
            data: {
                cita_id: citaId,
                id: citaId,
                codigo_reserva: codigoReserva,
                total_bs: subtotalFinalEntero,
                descuento_porcentaje: userDescuentoPorcentaje,
                numero_compra: numeroCompra,
                es_descuento_personalizado: esDescuentoPersonalizado,
                descuento_aplicado: descuentoMontoEntero,
                total_final_bs: totalFinalEntero,
                fecha_cita: fechaFinal,
                hora_cita: horaCorta,
                duracion_minutos: duracionTotalMinutos,
                manicurista_id: manicuristaFinalId,
                manicurista_nombre: manicuristaObj ? `${manicuristaObj.nombre} ${manicuristaObj.apellido || ''}`.trim() : 'Especialista',
                servicios: itemsToInsert
            }
        });
    } catch (err) {
        console.error('Error al crear reserva:', err);
        return res.status(500).json({ success: false, message: 'Error al procesar la reserva.' });
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
                    m.nombre AS manicurista_nombre, m.apellido AS manicurista_apellido,
                    (SELECT COUNT(*) FROM detalle_cita d WHERE d.cita_id = c.id) AS total_servicios,
                    (SELECT GROUP_CONCAT(COALESCE(s.nombre, 'Servicio'), ', ') 
                     FROM detalle_cita d 
                     LEFT JOIN servicios s ON d.servicio_id = s.id 
                     WHERE d.cita_id = c.id) AS servicios_resumen
             FROM citas c
             LEFT JOIN usuarios m ON c.manicurista_id = m.id
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
 * GET /api/reservas/:id
 */
router.get('/:id', (req, res) => {
    const id = parseInt(req.params.id, 10);
    const userId = req.user ? req.user.id : (req.session ? req.session.userId : null);

    if (isNaN(id)) {
        return res.status(400).json({ success: false, message: 'ID inválido.' });
    }

    try {
        const isAdm = req.user && req.user.rol_id === 1;
        let sql = `
            SELECT c.*, 
                   u.nombre AS cliente_nombre, u.apellido AS cliente_apellido, u.email AS cliente_email, u.telefono AS cliente_telefono,
                   m.nombre AS manicurista_nombre, m.apellido AS manicurista_apellido,
                   (SELECT GROUP_CONCAT(COALESCE(s.nombre, 'Servicio'), ', ') 
                    FROM detalle_cita d 
                    LEFT JOIN servicios s ON d.servicio_id = s.id 
                    WHERE d.cita_id = c.id) AS servicios_resumen
            FROM citas c
            INNER JOIN usuarios u ON c.usuario_id = u.id
            LEFT JOIN usuarios m ON c.manicurista_id = m.id
            WHERE c.id = ?
        `;
        const params = [id];

        if (!isAdm && userId) {
            sql += ' AND (c.usuario_id = ? OR c.manicurista_id = ?)';
            params.push(userId, userId);
        }

        const cita = Database.get(sql, params);

        if (!cita) {
            return res.status(404).json({ success: false, message: 'Reserva no encontrada.' });
        }

        // Obtener servicios de la cita
        const servicios = Database.all(
            `SELECT d.*, s.nombre AS servicio_nombre, s.imagen AS servicio_imagen
             FROM detalle_cita d
             LEFT JOIN servicios s ON d.servicio_id = s.id
             WHERE d.cita_id = ?`,
            [id]
        );

        cita.servicios = servicios;

        return res.json({ success: true, data: cita });
    } catch (err) {
        console.error('Error al consultar detalle de reserva:', err);
        return res.status(500).json({ success: false, message: 'Error interno del servidor.' });
    }
});

/**
 * PUT & POST /api/reservas/:id/cancelar
 * Cancelación segura de cita desde el panel de cliente o administrador
 */
router.all(['/:id/cancelar', '/cancelar/:id'], async (req, res) => {
    try {
        if (!['PUT', 'POST'].includes(req.method)) {
            return res.status(405).json({ success: false, message: 'Método no permitido.' });
        }

        const citaId = parseInt(req.params.id, 10);
        const userId = req.user ? req.user.id : (req.session ? req.session.userId : null);

        if (isNaN(citaId) || citaId <= 0) {
            return res.status(400).json({ success: false, message: 'ID de reserva inválido.' });
        }

        if (!userId) {
            return res.status(401).json({ success: false, message: 'Debes iniciar sesión para cancelar una cita.' });
        }

        const isAdm = req.user && (req.user.rol_id === 1 || (req.user.rol_nombre || '').toLowerCase() === 'administrador');

        // Consultar la cita en SQLite
        const cita = Database.get(`
            SELECT c.*, 
                   u.nombre AS cliente_nombre, u.apellido AS cliente_apellido,
                   m.nombre AS manicurista_nombre, m.apellido AS manicurista_apellido,
                   (SELECT GROUP_CONCAT(COALESCE(s.nombre, 'Servicio'), ', ') 
                    FROM detalle_cita d 
                    LEFT JOIN servicios s ON d.servicio_id = s.id 
                    WHERE d.cita_id = c.id) AS servicios_resumen
            FROM citas c
            INNER JOIN usuarios u ON c.usuario_id = u.id
            LEFT JOIN usuarios m ON c.manicurista_id = m.id
            WHERE c.id = ?
        `, [citaId]);

        if (!cita) {
            return res.status(404).json({ success: false, message: 'Reserva no encontrada.' });
        }

        // Seguridad: el cliente únicamente puede cancelar sus propias citas
        if (!isAdm && cita.usuario_id !== userId) {
            return res.status(403).json({ success: false, message: 'No tienes permisos para cancelar esta cita.' });
        }

        const estadoActual = (cita.estado || '').toLowerCase();

        if (estadoActual === 'cancelada') {
            return res.status(400).json({ success: false, message: 'Esta cita ya se encuentra cancelada.' });
        }

        // Restricción: No permitir cancelar citas ya completadas / finalizadas
        if (['completada', 'finalizada', 'entregada'].includes(estadoActual)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Esta cita ya no puede cancelarse desde el panel. Comunícate con NailArtist para solicitar asistencia.' 
            });
        }

        if (!['pendiente', 'confirmada'].includes(estadoActual)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Esta cita ya no puede cancelarse desde el panel. Comunícate con NailArtist para solicitar asistencia.' 
            });
        }

        // Cambiar estado a 'Cancelada' en SQLite conservando historial
        Database.run("UPDATE citas SET estado = 'Cancelada' WHERE id = ?", [citaId]);

        const clienteNombre = `${cita.cliente_nombre || 'Cliente'} ${cita.cliente_apellido || ''}`.trim();
        const horaCorta = (cita.hora_cita || '').substring(0, 5);
        const servicioNombre = cita.servicios_resumen || 'Servicio de Uñas';

        // Notificación para la manicurista asignada
        if (cita.manicurista_id) {
            try {
                Database.run(
                    'INSERT INTO notificaciones (usuario_id, titulo, mensaje, tipo) VALUES (?, ?, ?, ?)',
                    [
                        cita.manicurista_id,
                        `Cita Cancelada (${cita.codigo_reserva})`,
                        `La clienta ${clienteNombre} ha cancelado su cita de ${servicioNombre} programada para el ${cita.fecha_cita} a las ${horaCorta}.`,
                        'alerta'
                    ]
                );
            } catch (e) {
                console.warn('Error al crear notificación para manicurista:', e);
            }
        }

        // Notificación para el cliente
        try {
            Database.run(
                'INSERT INTO notificaciones (usuario_id, titulo, mensaje, tipo) VALUES (?, ?, ?, ?)',
                [
                    cita.usuario_id,
                    `Cita Cancelada (${cita.codigo_reserva})`,
                    `Has cancelado exitosamente tu cita del ${cita.fecha_cita} a las ${horaCorta}. Estado: Cancelada.`,
                    'info'
                ]
            );
        } catch (e) {}

        // Notificación para los administradores
        try {
            const admins = Database.all('SELECT id FROM usuarios WHERE rol_id = 1');
            admins.forEach(adm => {
                if (adm.id !== userId) {
                    Database.run(
                        'INSERT INTO notificaciones (usuario_id, titulo, mensaje, tipo) VALUES (?, ?, ?, ?)',
                        [
                            adm.id,
                            `Cita Cancelada (${cita.codigo_reserva})`,
                            `La clienta ${clienteNombre} canceló su cita de ${servicioNombre} del ${cita.fecha_cita} a las ${horaCorta}.`,
                            'alerta'
                        ]
                    );
                }
            });
        } catch (e) {}

        return res.json({
            success: true,
            message: 'Tu cita ha sido cancelada correctamente.',
            data: {
                id: citaId,
                codigo_reserva: cita.codigo_reserva,
                estado: 'Cancelada',
                fecha_cita: cita.fecha_cita,
                hora_cita: horaCorta
            }
        });
    } catch (err) {
        console.error('Error al cancelar reserva:', err);
        return res.status(500).json({ success: false, message: 'Error interno al cancelar la cita.' });
    }
});

module.exports = router;
