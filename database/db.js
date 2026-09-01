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
