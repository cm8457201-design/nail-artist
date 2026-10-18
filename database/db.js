/**
 * NailArtist Studio — Database Connection Module (SQLite 3)
 * Utiliza el módulo nativo node:sqlite de Node.js con soporte de Foreign Keys
 */

const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '..', 'nailartist.db');

let dbInstance = null;

function initDatabase() {
    if (dbInstance) return dbInstance;

    try {
        dbInstance = new DatabaseSync(DB_PATH);
        // Habilitar claves foráneas en SQLite
        dbInstance.exec('PRAGMA foreign_keys = ON;');
        dbInstance.exec('PRAGMA journal_mode = WAL;');

        // Inicializar tabla de configuración general si no existe
        dbInstance.exec(`
            CREATE TABLE IF NOT EXISTS configuracion (
                clave TEXT PRIMARY KEY,
                valor TEXT NOT NULL,
                descripcion TEXT,
                fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Valores por defecto de configuración de descuentos
        const insertConfig = dbInstance.prepare(`
            INSERT OR IGNORE INTO configuracion (clave, valor, descripcion) 
            VALUES (?, ?, ?)
        `);
        insertConfig.run('descuento_general_porcentaje', '15.00', 'Porcentaje de descuento general aplicable a los servicios');
        insertConfig.run('descuento_general_activo', '1', 'Estado del descuento general: 1 = Activo, 0 = Inactivo');
        insertConfig.run('descuento_general_nombre', 'Descuento General de Temporada', 'Nombre o campaña del descuento general');

        // Asegurar columnas de perfil profesional de manicuristas en usuarios
        try {
            const tableInfoStmt = dbInstance.prepare("PRAGMA table_info(usuarios);");
            const columns = tableInfoStmt.all().map(c => c.name);
            if (!columns.includes('foto_perfil')) dbInstance.exec("ALTER TABLE usuarios ADD COLUMN foto_perfil TEXT;");
            if (!columns.includes('foto')) dbInstance.exec("ALTER TABLE usuarios ADD COLUMN foto TEXT;");
            if (!columns.includes('cargo_especialidad')) dbInstance.exec("ALTER TABLE usuarios ADD COLUMN cargo_especialidad TEXT;");
            if (!columns.includes('descripcion')) dbInstance.exec("ALTER TABLE usuarios ADD COLUMN descripcion TEXT;");
            if (!columns.includes('experiencia_anios')) dbInstance.exec("ALTER TABLE usuarios ADD COLUMN experiencia_anios INTEGER DEFAULT 3;");
        } catch(colErr) {
            console.warn('Nota sobre esquema de usuarios:', colErr.message);
        }

        console.log(`🗄️  [SQLite] Base de datos conectada exitosamente: ${path.basename(DB_PATH)}`);
        return dbInstance;
    } catch (err) {
        console.error('❌ [SQLite] Error al conectar con la base de datos:', err);
        throw err;
    }
}

const db = initDatabase();

// Helpers para consultas convenientes
const Database = {
    getDb: () => dbInstance || initDatabase(),

    // Obtener múltiples filas
    all(sql, params = []) {
        try {
            const stmt = db.prepare(sql);
            return stmt.all(...params);
        } catch (err) {
            console.error(`❌ [DB Error en .all()]: ${sql}`, err);
            throw err;
        }
    },

    // Obtener una sola fila
    get(sql, params = []) {
        try {
            const stmt = db.prepare(sql);
            return stmt.get(...params) || null;
        } catch (err) {
            console.error(`❌ [DB Error en .get()]: ${sql}`, err);
            throw err;
        }
    },

    // Ejecutar INSERT, UPDATE, DELETE
    run(sql, params = []) {
        try {
            const stmt = db.prepare(sql);
            const info = stmt.run(...params);
            return {
                changes: Number(info.changes || 0),
                lastInsertRowid: Number(info.lastInsertRowid || 0)
            };
        } catch (err) {
            console.error(`❌ [DB Error en .run()]: ${sql}`, err);
            throw err;
        }
    },

    // Ejecutar script SQL en bloque
    exec(sql) {
        try {
            return db.exec(sql);
        } catch (err) {
            console.error('❌ [DB Error en .exec()]:', err);
            throw err;
        }
    }
};

module.exports = Database;
