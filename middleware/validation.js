/**
 * NailArtist Studio — Sistema Centralizado de Validaciones
 * Funciones reutilizables para validar todos los tipos de datos del sistema.
 * Nivel: Junior/Intermedio — Claro, consistente y seguro.
 */

// =============================================================================
// CONSTANTES DE VALIDACIÓN
// =============================================================================
const ROLES_VALIDOS = [1, 2, 3]; // 1=Admin, 2=Cliente, 3=Manicurista
const ESTADOS_USUARIO = ['activo', 'inactivo', 'bloqueado'];
const ESTADOS_CITA = ['Pendiente', 'Confirmada', 'Completada', 'Cancelada'];
const ESTADOS_SERVICIO = ['activo', 'inactivo'];
const METODOS_CONTACTO = ['WhatsApp', 'Llamada', 'Correo'];
const FORMATOS_IMAGEN = ['jpg', 'jpeg', 'png', 'webp'];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const HORA_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;
const FECHA_REGEX = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

// =============================================================================
// HELPER: Crear respuesta de error estandarizada
// =============================================================================
function errorResponse(res, status, message, field) {
    const body = {
        ok: false,
        success: false,
        error: httpCodeToError(status),
        message
    };
    if (field) body.field = field;
    return res.status(status).json(body);
}

function httpCodeToError(code) {
    const map = {
        400: 'VALIDATION_ERROR',
        401: 'UNAUTHORIZED',
        403: 'FORBIDDEN',
        404: 'NOT_FOUND',
        409: 'CONFLICT',
        413: 'PAYLOAD_TOO_LARGE',
        429: 'TOO_MANY_REQUESTS',
        500: 'INTERNAL_ERROR'
    };
    return map[code] || 'ERROR';
}

// =============================================================================
// VALIDACIONES DE TEXTO
// =============================================================================

/**
 * Valida un campo de texto genérico.
 * @returns {string|null} Texto normalizado o null si es inválido.
 */
function validarTexto(valor, opts) {
    const min = (opts && opts.min !== undefined) ? opts.min : 1;
    const max = (opts && opts.max !== undefined) ? opts.max : 500;
    if (valor === null || valor === undefined || valor === '') return null;
    const str = String(valor).trim();
    if (str.length < min || str.length > max) return null;
    return str;
}

/**
 * Valida un nombre o apellido (permite tildes, espacios, letras Unicode).
 */
function validarNombre(valor, opts) {
    const min = (opts && opts.min !== undefined) ? opts.min : 2;
    const max = (opts && opts.max !== undefined) ? opts.max : 100;
    if (!valor || typeof valor !== 'string') return null;
    const str = valor.trim().replace(/\s+/g, ' ');
    if (str.length < min || str.length > max) return null;
    // Permitir letras Unicode (incluyendo tildes, ñ, etc.) y espacios
    if (!/^[\p{L}\p{M}' \-]+$/u.test(str)) return null;
    return str;
}

/**
 * Valida un email y lo normaliza a minúsculas.
 */
function validarEmail(valor) {
    if (!valor || typeof valor !== 'string') return null;
    const email = valor.trim().toLowerCase();
    if (!EMAIL_REGEX.test(email)) return null;
    if (email.length > 150) return null;
    return email;
}

/**
 * Valida un número de teléfono.
 */
function validarTelefono(valor) {
    if (!valor) return '';
    const tel = String(valor).trim();
    if (tel.length === 0) return '';
    if (tel.length > 25) return null;
    // Permitir +, dígitos, espacios, guiones y paréntesis
    if (!/^[+\d\s\-().]{7,25}$/.test(tel)) return null;
    // No puede ser solo caracteres no numéricos
    if (!/\d/.test(tel)) return null;
    return tel;
}

/**
 * Valida una contraseña (longitud mínima y máxima).
 */
function validarPassword(valor, opts) {
    const min = (opts && opts.min !== undefined) ? opts.min : 6;
    const max = (opts && opts.max !== undefined) ? opts.max : 128;
    if (!valor || typeof valor !== 'string') return null;
    if (valor.length < min || valor.length > max) return null;
    return valor;
}

// =============================================================================
// VALIDACIONES NUMÉRICAS
// =============================================================================

/**
 * Valida un ID numérico entero positivo.
 */
function validarId(valor) {
    const num = parseInt(valor, 10);
    if (isNaN(num) || num <= 0) return null;
    return num;
}

/**
 * Valida un número dentro de un rango.
 */
function validarNumero(valor, opts) {
    const min = (opts && opts.min !== undefined) ? opts.min : 0;
    const max = (opts && opts.max !== undefined) ? opts.max : Infinity;
    const entero = (opts && opts.entero) ? true : false;
    const num = entero ? parseInt(valor, 10) : parseFloat(valor);
    if (isNaN(num) || !isFinite(num)) return null;
    if (num < min || num > max) return null;
    return num;
}

/**
 * Valida un porcentaje (0–100).
 */
function validarPorcentaje(valor) {
    return validarNumero(valor, { min: 0, max: 100 });
}

/**
 * Valida un precio (>= 0).
 */
function validarPrecio(valor) {
    return validarNumero(valor, { min: 0, max: 999999 });
}

/**
 * Valida una duración en minutos (> 0).
 */
function validarDuracion(valor) {
    return validarNumero(valor, { min: 1, max: 480, entero: true });
}

// =============================================================================
// VALIDACIONES DE FECHA Y HORA
// =============================================================================

/**
 * Valida una fecha en formato YYYY-MM-DD.
 * Verifica que la fecha exista realmente (no: 2026-02-30).
 */
function validarFecha(valor) {
    if (!valor || typeof valor !== 'string') return null;
    const str = valor.trim();
    if (!FECHA_REGEX.test(str)) return null;

    // Verificar que la fecha sea real
    const partes = str.split('-').map(Number);
    const anio = partes[0];
    const mes = partes[1];
    const dia = partes[2];
    const fecha = new Date(anio, mes - 1, dia);
    if (
        fecha.getFullYear() !== anio ||
        fecha.getMonth() + 1 !== mes ||
        fecha.getDate() !== dia
    ) {
        return null;
    }

    return str;
}

/**
 * Valida una hora en formato HH:MM.
 */
function validarHora(valor) {
    if (!valor || typeof valor !== 'string') return null;
    // Aceptar HH:MM o HH:MM:SS y normalizar a HH:MM
    const str = valor.trim().substring(0, 5);
    if (!HORA_REGEX.test(str)) return null;
    return str;
}

/**
 * Verifica que una fecha no sea anterior a hoy.
 */
function fechaEsPasada(fechaStr) {
    if (!fechaStr) return true;
    const hoy = new Date();
    const hoyStr = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
    return fechaStr < hoyStr;
}

// =============================================================================
// VALIDACIONES DE ENUMERADOS (ESTADOS / ROLES)
// =============================================================================

/**
 * Valida un rol de usuario (1, 2 o 3).
 */
function validarRol(valor) {
    const num = parseInt(valor, 10);
    if (!ROLES_VALIDOS.includes(num)) return null;
    return num;
}

/**
 * Valida el estado de un usuario.
 */
function validarEstadoUsuario(valor) {
    if (!valor || typeof valor !== 'string') return null;
    const str = valor.trim().toLowerCase();
    if (!ESTADOS_USUARIO.includes(str)) return null;
    return str;
}

/**
 * Valida el estado de una cita (exactamente como está en la DB).
 */
function validarEstadoCita(valor) {
    if (!valor || typeof valor !== 'string') return null;
    const encontrado = ESTADOS_CITA.find(function(e) { return e.toLowerCase() === valor.trim().toLowerCase(); });
    return encontrado || null;
}

/**
 * Valida el estado de un servicio.
 */
function validarEstadoServicio(valor) {
    if (!valor || typeof valor !== 'string') return null;
    const str = valor.trim().toLowerCase();
    if (!ESTADOS_SERVICIO.includes(str)) return null;
    return str;
}

/**
 * Valida el método de contacto.
 */
function validarMetodoContacto(valor) {
    if (!valor) return 'WhatsApp';
    const encontrado = METODOS_CONTACTO.find(function(m) { return m.toLowerCase() === valor.trim().toLowerCase(); });
    return encontrado || 'WhatsApp';
}

// =============================================================================
// VALIDACIONES DE ARRAYS Y OBJETOS
// =============================================================================

/**
 * Valida que un valor sea un array no vacío.
 */
function validarArray(valor, opts) {
    const minLen = (opts && opts.minLen !== undefined) ? opts.minLen : 1;
    const maxLen = (opts && opts.maxLen !== undefined) ? opts.maxLen : 50;
    if (!Array.isArray(valor)) return null;
    if (valor.length < minLen || valor.length > maxLen) return null;
    return valor;
}

/**
 * Valida parámetros de paginación.
 */
function validarPaginacion(page, limit) {
    const p = Math.max(1, parseInt(page, 10) || 1);
    const l = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    return { page: p, limit: l };
}

// =============================================================================
// VALIDACIONES DE ARCHIVOS (IMÁGENES BASE64)
// =============================================================================

/**
 * Valida una imagen en base64.
 * @returns {{ extension, buffer, mimeType } | null}
 */
function validarImagenBase64(base64String) {
    if (!base64String || typeof base64String !== 'string') return null;

    let extension = 'jpg';
    let base64Data = base64String;
    let mimeType = 'image/jpeg';

    if (base64String.includes(';base64,')) {
        const matches = base64String.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
        if (!matches || matches.length !== 3) return null;

        const mime = matches[1].toLowerCase();
        const mimeOk = FORMATOS_IMAGEN.includes(mime) || mime === 'jpeg';
        if (!mimeOk) return null;

        mimeType = 'image/' + mime;
        extension = mime === 'jpeg' ? 'jpg' : mime;
        base64Data = matches[2];
    }

    try {
        const buffer = Buffer.from(base64Data, 'base64');

        if (buffer.length === 0) return null;

        // Verificar firma del archivo (magic bytes)
        if (!verificarMagicBytes(buffer, extension)) return null;

        // Límite de 5MB
        const MAX_SIZE = 5 * 1024 * 1024;
        if (buffer.length > MAX_SIZE) return null;

        return { extension: extension, buffer: buffer, mimeType: mimeType };
    } catch (e) {
        return null;
    }
}

/**
 * Verifica los magic bytes de un archivo de imagen.
 */
function verificarMagicBytes(buffer, extension) {
    if (buffer.length < 4) return false;

    const ext = extension.toLowerCase();

    // JPEG: FF D8 FF
    if (ext === 'jpg' || ext === 'jpeg') {
        return buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF;
    }
    // PNG: 89 50 4E 47
    if (ext === 'png') {
        return buffer[0] === 0x89 && buffer[1] === 0x50 &&
               buffer[2] === 0x4E && buffer[3] === 0x47;
    }
    // WEBP: RIFF????WEBP
    if (ext === 'webp') {
        return buffer[0] === 0x52 && buffer[1] === 0x49 &&
               buffer[2] === 0x46 && buffer[3] === 0x46;
    }
    return false;
}

/**
 * Genera un nombre de archivo seguro.
 */
function nombreArchivoSeguro(nombreBase, extension) {
    const safe = (nombreBase || 'archivo')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .substring(0, 50) || 'archivo';

    const timestamp = Date.now();
    return safe + '-' + timestamp + '.' + extension;
}

// =============================================================================
// MIDDLEWARES DE AUTENTICACIÓN Y AUTORIZACIÓN
// =============================================================================

/**
 * Middleware: Requiere que el usuario esté autenticado (sesión activa).
 */
function requireAuth(req, res, next) {
    if (!req.user) {
        return errorResponse(res, 401, 'Debes iniciar sesión para continuar.');
    }
    next();
}

/**
 * Middleware: Requiere rol de Administrador.
 */
function requireAdminMW(req, res, next) {
    if (!req.user) {
        return errorResponse(res, 401, 'Debes iniciar sesión como Administrador.');
    }
    if (req.user.rol_id !== 1) {
        return errorResponse(res, 403, 'Acceso denegado. Se requieren permisos de Administrador.');
    }
    next();
}

/**
 * Middleware: Requiere rol de Manicurista o Administrador.
 */
function requireManicuristaMW(req, res, next) {
    if (!req.user) {
        return errorResponse(res, 401, 'Debes iniciar sesión para continuar.');
    }
    if (req.user.rol_id !== 3 && req.user.rol_id !== 1) {
        return errorResponse(res, 403, 'Acceso exclusivo para manicuristas del estudio.');
    }
    next();
}

/**
 * Middleware: Requiere rol de Cliente (o Admin).
 */
function requireCliente(req, res, next) {
    if (!req.user) {
        return errorResponse(res, 401, 'Debes iniciar sesión para continuar.');
    }
    if (req.user.rol_id !== 2 && req.user.rol_id !== 1) {
        return errorResponse(res, 403, 'Acceso exclusivo para clientes registrados.');
    }
    next();
}

// =============================================================================
// SANITIZACIÓN BÁSICA ANTI-XSS
// =============================================================================

/**
 * Escapa caracteres peligrosos de HTML en una cadena.
 */
function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/**
 * Elimina etiquetas HTML de una cadena (para guardar texto plano en DB).
 */
function stripHtml(str) {
    if (!str) return '';
    return String(str).replace(/<[^>]*>/g, '').trim();
}

// =============================================================================
// EXPORTS
// =============================================================================
module.exports = {
    // Constantes
    ROLES_VALIDOS,
    ESTADOS_USUARIO,
    ESTADOS_CITA,
    ESTADOS_SERVICIO,
    METODOS_CONTACTO,

    // Respuestas
    errorResponse,

    // Validaciones de texto
    validarTexto,
    validarNombre,
    validarEmail,
    validarTelefono,
    validarPassword,

    // Validaciones numéricas
    validarId,
    validarNumero,
    validarPorcentaje,
    validarPrecio,
    validarDuracion,

    // Validaciones de fecha y hora
    validarFecha,
    validarHora,
    fechaEsPasada,

    // Validaciones de enumerados
    validarRol,
    validarEstadoUsuario,
    validarEstadoCita,
    validarEstadoServicio,
    validarMetodoContacto,

    // Arrays y paginación
    validarArray,
    validarPaginacion,

    // Archivos
    validarImagenBase64,
    verificarMagicBytes,
    nombreArchivoSeguro,

    // Middlewares
    requireAuth,
    requireAdmin: requireAdminMW,
    requireManicurista: requireManicuristaMW,
    requireCliente,

    // Sanitización
    escapeHtml,
    stripHtml
};

