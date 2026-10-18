/**
 * NailArtist Studio — Contact Routes
 * Recepción y guardado de mensajes de contacto
 */

const express = require('express');
const router = express.Router();
const Database = require('../database/db');
const {
    errorResponse,
    validarNombre,
    validarEmail,
    validarTelefono,
    validarTexto,
    stripHtml
} = require('../middleware/validation');

/**
 * POST /api/contactos & /api/contacto
 */
router.post(['/', '/contacto'], (req, res) => {
    try {
        const { nombre, email, telefono, mensaje } = req.body || {};

        // Validar nombre (obligatorio)
        const nombreLimpio = validarNombre(nombre, { min: 2, max: 80 });
        if (!nombreLimpio) {
            return errorResponse(res, 400, 'Por favor ingresa tu nombre completo (2–80 caracteres).', 'nombre');
        }

        // Validar email (obligatorio)
        const emailLimpio = validarEmail(email);
        if (!emailLimpio) {
            return errorResponse(res, 400, 'Por favor ingresa un correo electrónico válido.', 'email');
        }

        // Validar mensaje (obligatorio, mínimo 10 chars)
        const mensajeLimpio = validarTexto(mensaje, { min: 10, max: 1000 });
        if (!mensajeLimpio) {
            return errorResponse(res, 400, 'Por favor escribe tu mensaje (entre 10 y 1000 caracteres).', 'mensaje');
        }

        // Teléfono (opcional)
        let telLimpio = '';
        if (telefono && telefono.trim()) {
            const tel = validarTelefono(telefono);
            if (tel === null) {
                return errorResponse(res, 400, 'El número de teléfono ingresado no es válido.', 'telefono');
            }
            telLimpio = tel;
        }

        // Sanitizar contra XSS antes de guardar en DB
        const result = Database.run(
            `INSERT INTO contactos (nombre, email, telefono, mensaje, leido)
             VALUES (?, ?, ?, ?, 0)`,
            [stripHtml(nombreLimpio), emailLimpio, telLimpio, stripHtml(mensajeLimpio)]
        );

        return res.status(201).json({
            success: true,
            message: '¡Gracias por contactarnos! Te responderemos muy pronto.',
            data: { id: result.lastInsertRowid }
        });
    } catch (err) {
        console.error('Error al guardar contacto:', err);
        return errorResponse(res, 500, 'Error al enviar mensaje.');
    }
});

module.exports = router;


/**
 * POST /api/contactos & /api/contacto
 */
router.post(['/', '/contacto'], (req, res) => {
    try {
        const { nombre, email, telefono, mensaje } = req.body || {};

        if (!nombre || !nombre.trim()) {
            return res.status(400).json({ success: false, message: 'Por favor ingresa tu nombre.' });
        }

        if (!email || !email.trim()) {
            return res.status(400).json({ success: false, message: 'Por favor ingresa tu correo electrónico.' });
        }

        if (!mensaje || !mensaje.trim()) {
            return res.status(400).json({ success: false, message: 'Por favor escribe tu consulta o mensaje.' });
        }

        const result = Database.run(
            `INSERT INTO contactos (nombre, email, telefono, mensaje, leido)
             VALUES (?, ?, ?, ?, 0)`,
            [nombre.trim(), email.trim(), (telefono || '').trim(), mensaje.trim()]
        );

        return res.status(201).json({
            success: true,
            message: '¡Gracias por contactarnos! Te responderemos muy pronto.',
            data: { id: result.lastInsertRowid }
        });
    } catch (err) {
        console.error('Error al guardar contacto:', err);
        return res.status(500).json({ success: false, message: 'Error al enviar mensaje.' });
    }
});

module.exports = router;
