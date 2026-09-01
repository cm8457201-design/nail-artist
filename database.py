"""
NailArtist Studio — Módulo de Base de Datos SQLite
Gestiona la conexión, creación de tablas y datos semilla compatibles con DB Browser for SQLite.
"""

import sqlite3
import os
import bcrypt

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'nailartist.db')

def get_db_connection():
    """Retorna una conexión a la base de datos SQLite con soporte para diccionarios (Row)."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn

def hash_password(password: str) -> str:
    """Genera un hash bcrypt seguro compatible con PHP password_hash."""
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')

def verify_password(plain_password: str, password_hash: str) -> bool:
    """Verifica una contraseña en texto plano contra un hash bcrypt (soporta prefijos $2y$ y $2b$)."""
    if not password_hash or not plain_password:
        return False
    try:
        # Reemplazar prefijo PHP $2y$ por $2b$ para compatibilidad con la librería de Python si es necesario
        formatted_hash = password_hash
        if formatted_hash.startswith('$2y$'):
            formatted_hash = '$2b$' + formatted_hash[4:]
        return bcrypt.checkpw(plain_password.encode('utf-8'), formatted_hash.encode('utf-8'))
    except Exception as e:
        print(f"Error verificando contraseña: {e}")
        return False

def init_db(drop_existing: bool = False):
    """Crea la estructura de tablas y puebla los datos iniciales de NailArtist Studio."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("PRAGMA foreign_keys = ON;")

    if drop_existing:
        cursor.executescript("""
            DROP TABLE IF EXISTS detalle_cita;
            DROP TABLE IF EXISTS citas;
            DROP TABLE IF EXISTS resenas;
            DROP TABLE IF EXISTS servicios;
            DROP TABLE IF EXISTS categorias;
            DROP TABLE IF EXISTS contactos;
            DROP TABLE IF EXISTS usuarios;
            DROP TABLE IF EXISTS roles;
        """)

    # 1. Tabla roles
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS roles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL UNIQUE,
            descripcion TEXT,
            fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    """)

    # 2. Tabla usuarios
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS usuarios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            rol_id INTEGER NOT NULL DEFAULT 2,
            nombre TEXT NOT NULL,
            apellido TEXT,
            email TEXT NOT NULL UNIQUE,
            telefono TEXT,
            password_hash TEXT NOT NULL,
            descuento_vip REAL DEFAULT 15.00,
            estado TEXT NOT NULL DEFAULT 'activo' CHECK(estado IN ('activo', 'inactivo', 'bloqueado')),
            fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (rol_id) REFERENCES roles(id) ON UPDATE CASCADE ON DELETE RESTRICT
        );
    """)

    # 3. Tabla categorias
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS categorias (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL UNIQUE,
            slug TEXT NOT NULL UNIQUE,
            descripcion TEXT,
            estado TEXT NOT NULL DEFAULT 'activo' CHECK(estado IN ('activo', 'inactivo')),
            fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    """)

    # 4. Tabla servicios
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS servicios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            categoria_id INTEGER NOT NULL,
            nombre TEXT NOT NULL,
            slug TEXT NOT NULL UNIQUE,
            descripcion TEXT NOT NULL,
            precio REAL NOT NULL,
            moneda TEXT NOT NULL DEFAULT 'Bs.',
            duracion_minutos INTEGER NOT NULL DEFAULT 60,
            imagen TEXT NOT NULL,
            url_detalle TEXT NOT NULL,
            destacado INTEGER NOT NULL DEFAULT 1,
            calificacion REAL DEFAULT 5.0,
            estado TEXT NOT NULL DEFAULT 'activo' CHECK(estado IN ('activo', 'inactivo')),
            fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (categoria_id) REFERENCES categorias(id) ON UPDATE CASCADE ON DELETE RESTRICT
        );
    """)

    # 5. Tabla citas
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS citas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            codigo_reserva TEXT NOT NULL UNIQUE,
            usuario_id INTEGER NOT NULL,
            fecha_cita TEXT NOT NULL,
            hora_cita TEXT NOT NULL,
            total_bs REAL NOT NULL,
            descuento_aplicado REAL DEFAULT 0.00,
            total_final_bs REAL NOT NULL,
            estado TEXT NOT NULL DEFAULT 'Pendiente' CHECK(estado IN ('Pendiente', 'Confirmada', 'Cancelada', 'Completada')),
            observaciones TEXT,
            metodo_contacto TEXT DEFAULT 'WhatsApp' CHECK(metodo_contacto IN ('WhatsApp', 'Llamada', 'Correo')),
            fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON UPDATE CASCADE ON DELETE RESTRICT
        );
    """)

    # 6. Tabla detalle_cita
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS detalle_cita (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            cita_id INTEGER NOT NULL,
            servicio_id INTEGER NOT NULL,
            precio_unitario REAL NOT NULL,
            cantidad INTEGER NOT NULL DEFAULT 1,
            subtotal REAL NOT NULL,
            FOREIGN KEY (cita_id) REFERENCES citas(id) ON UPDATE CASCADE ON DELETE CASCADE,
            FOREIGN KEY (servicio_id) REFERENCES servicios(id) ON UPDATE CASCADE ON DELETE RESTRICT
        );
    """)

    # 7. Tabla contactos
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS contactos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL,
            email TEXT NOT NULL,
            telefono TEXT,
            mensaje TEXT NOT NULL,
            leido INTEGER DEFAULT 0,
            fecha_envio TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    """)

    # 8. Tabla resenas
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS resenas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            usuario_id INTEGER NOT NULL,
            servicio_id INTEGER,
            calificacion INTEGER NOT NULL CHECK(calificacion BETWEEN 1 AND 5),
            comentario TEXT NOT NULL,
            publicado INTEGER DEFAULT 1,
            fecha_resena TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON UPDATE CASCADE ON DELETE CASCADE,
            FOREIGN KEY (servicio_id) REFERENCES servicios(id) ON UPDATE CASCADE ON DELETE SET NULL
        );
    """)

    # Índices para optimización
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_usuarios_email ON usuarios(email);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_servicios_categoria ON servicios(categoria_id);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_servicios_precio ON servicios(precio);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_citas_fecha ON citas(fecha_cita, hora_cita);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_citas_estado ON citas(estado);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_citas_usuario ON citas(usuario_id);")

    # =========================================================================
    # DATOS INICIALES (SEED DATA)
    # =========================================================================

    # 1. Roles
    cursor.executemany("""
        INSERT OR IGNORE INTO roles (id, nombre, descripcion) VALUES (?, ?, ?);
    """, [
        (1, 'Administrador', 'Control total de servicios, citas, usuarios y reportes'),
        (2, 'Cliente', 'Acceso a registro VIP, promociones y reservas de citas'),
        (3, 'Manicurista', 'Gestión de agenda y atención de citas')
    ])

    # Hashes de contraseñas
    admin_pwd_hash = hash_password('admin123')
    cliente_pwd_hash = hash_password('cliente123')

    # 2. Usuarios (Incluyendo admin@gmail.com con admin123, admin@nailartist.com y clientes de prueba)
    cursor.executemany("""
        INSERT OR IGNORE INTO usuarios (id, rol_id, nombre, apellido, email, telefono, password_hash, descuento_vip, estado)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
    """, [
        (1, 1, 'Administrador', 'General', 'admin@gmail.com', '+59160737902', admin_pwd_hash, 0.00, 'activo'),
        (2, 2, 'Camila', 'Morales', 'camila.morales@gmail.com', '+59178945612', cliente_pwd_hash, 15.00, 'activo'),
        (3, 2, 'Valentina', 'Rios', 'valentina.rios@gmail.com', '+59171234567', cliente_pwd_hash, 15.00, 'activo'),
        (4, 1, 'Administradora', 'NailArtist', 'admin@nailartist.com', '+59160737902', admin_pwd_hash, 0.00, 'activo')
    ])

    # 3. Categorías Oficiales
    cursor.executemany("""
        INSERT OR IGNORE INTO categorias (id, nombre, slug, descripcion, estado)
        VALUES (?, ?, ?, ?, ?);
    """, [
        (1, 'Estructuras & Esculpido', 'estructuras-esculpido', 'Sistemas profesionales de acrílico y extensiones largas', 'activo'),
        (2, 'Sistemas de Gel', 'sistemas-gel', 'Tecnologías suaves, ligeras y flexibles como Soft Gel y Rubber Base', 'activo'),
        (3, 'Cuidado & Manicure Spa', 'cuidado-manicure-spa', 'Tratamientos de higiene, exfoliación e hidratación profunda', 'activo'),
        (4, 'Arte & Decoración', 'arte-decoracion', 'Diseños a mano alzada, encapsulados, cristales Swarovski y foil', 'activo'),
        (5, 'Promociones & Combos', 'promociones-combos', 'Paquetes combinados con beneficios y descuentos especiales', 'activo')
    ])

    # 4. Servicios Oficiales
    cursor.executemany("""
        INSERT OR IGNORE INTO servicios (id, categoria_id, nombre, slug, descripcion, precio, moneda, duracion_minutos, imagen, url_detalle, destacado, calificacion, estado)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    """, [
        (1, 1, 'Uñas Acrílicas', 'unas-acrilicas', 'Esculpido profesional en acrílico de alta resistencia con puntas personalizadas (Almond, Coffin, Stiletto) y sellado de brillo duradero.', 80.00, 'Bs.', 105, 'images/service_acrilicas.jpg', 'left-sidebar.html', 1, 5.0, 'activo'),
        (2, 2, 'Soft Gel / Revolution', 'soft-gel-revolution', 'Tips 100% de gel ultra flexibles que se fusionan con tu uña natural. Ligeras, cómodas y de apariencia sumamente delicada.', 90.00, 'Bs.', 90, 'images/service_softgel.jpg', 'revolution.html', 1, 4.9, 'activo'),
        (3, 3, 'Manicure Completo', 'manicure-completo', 'Cuidado profundo de cutículas, exfoliación frutal de manos, baño de pétalos, hidratación intensiva con aceites y esmaltado nutritivo.', 40.00, 'Bs.', 50, 'images/service_manicure.jpg', 'manicure.html', 1, 4.8, 'activo'),
        (4, 4, 'Decoración Premium', 'decoracion-premium', 'Incrustación de cristales genuinos estilo Swarovski, dijes dorados 3D, efecto cromo holográfico y relieves de lujo.', 35.00, 'Bs.', 30, 'images/service_decoracion.jpg', 'decoracion.html', 1, 5.0, 'activo'),
        (5, 2, 'Esmaltado Semipermanente', 'esmaltado-semipermanente', 'Gama de más de 120 tonos en tendencia. Secado UV/LED instantáneo con brillo espejo intacto por más de 3 semanas sin descascararse.', 60.00, 'Bs.', 60, 'images/service_semipermanente.jpg', 'esmaltado.html', 1, 4.9, 'activo'),
        (6, 4, 'Diseños Personalizados', 'disenos-personalizados', 'Trae tu foto de Pinterest o Instagram: recreamos líneas abstractas, french creativo, mármol y retratos con pincel fino.', 70.00, 'Bs.', 75, 'images/service_disenos.jpg', 'diseños.html', 1, 5.0, 'activo'),
        (7, 4, 'Uñas Encapsuladas', 'unas-encapsuladas', 'Efecto transparente de cristal con encapsulado de flores secas, hojilla de oro rosa y glitter holográfico tridimensional.', 85.00, 'Bs.', 105, 'images/poc03.jpg', 'escapsuladas.html', 1, 4.9, 'activo'),
        (8, 1, 'Extensión de Uñas XL', 'extension-unas-xl', 'Largo imponente con estructura y peralte reforzado para máxima resistencia. Puntas Ballerina, Coffin o Stiletto de impacto.', 100.00, 'Bs.', 120, 'images/poc04.jpg', 'extencion.html', 1, 5.0, 'activo'),
        (9, 5, 'Combos & Promociones', 'combos-promociones', 'Combo Bestie: Set completo de Uñas Acrílicas o Soft Gel + Esmaltado Semipermanente + Decoración de 2 uñas ¡GRATIS!', 110.00, 'Bs.', 135, 'images/poc05.jpg', 'combos.html', 1, 5.0, 'activo')
    ])

    # 5. Cita de Ejemplo
    cursor.execute("""
        INSERT OR IGNORE INTO citas (id, codigo_reserva, usuario_id, fecha_cita, hora_cita, total_bs, descuento_aplicado, total_final_bs, estado, observaciones, metodo_contacto)
        VALUES (1, 'RES-2026-001', 2, '2026-08-20', '15:30:00', 115.00, 17.25, 97.75, 'Confirmada', 'Clienta solicita tono rosa blush con toques dorados', 'WhatsApp');
    """)

    # 6. Detalle de Cita de Ejemplo
    cursor.executemany("""
        INSERT OR IGNORE INTO detalle_cita (id, cita_id, servicio_id, precio_unitario, cantidad, subtotal)
        VALUES (?, ?, ?, ?, ?, ?);
    """, [
        (1, 1, 1, 80.00, 1, 80.00),
        (2, 1, 4, 35.00, 1, 35.00)
    ])

    # 7. Reseñas de Prueba
    cursor.executemany("""
        INSERT OR IGNORE INTO resenas (usuario_id, servicio_id, calificacion, comentario, publicado)
        VALUES (?, ?, ?, ?, ?);
    """, [
        (2, 1, 5, '¡Me encantaron mis uñas acrílicas! El acabado es súper fino y me duraron más de un mes perfectas.', 1),
        (3, 2, 5, 'Excelente atención y cuidado de mis uñas. El soft gel no pesa nada y se ve súper natural.', 1)
    ])

    conn.commit()
    conn.close()
    print(f"Base de datos SQLite inicializada exitosamente en: {DB_PATH}")

if __name__ == '__main__':
    init_db(drop_existing=True)
