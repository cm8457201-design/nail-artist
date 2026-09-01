/**
 * NailArtist Studio — Contact Routes
 * Recepción y guardado de mensajes de contacto
 */

const express = require('express');
const router = express.Router();
const Database = require('../database/db');

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
