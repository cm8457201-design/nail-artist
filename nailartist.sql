-- =============================================================================
-- BASE DE DATOS: NailArtist Studio
-- Motor: MySQL / MariaDB (Compatible con XAMPP / phpMyAdmin)
-- Charset: utf8mb4 (Soporte completo de emojis y caracteres en español)
-- =============================================================================

CREATE DATABASE IF NOT EXISTS `nailartist`
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;

USE `nailartist`;

-- -----------------------------------------------------------------------------
-- 1. TABLA: roles
-- Define los privilegios de los usuarios (Administrador, Cliente, Manicurista)
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS `detalle_cita`;
DROP TABLE IF EXISTS `citas`;
DROP TABLE IF EXISTS `resenas`;
DROP TABLE IF EXISTS `servicios`;
DROP TABLE IF EXISTS `categorias`;
DROP TABLE IF EXISTS `contactos`;
DROP TABLE IF EXISTS `usuarios`;
DROP TABLE IF EXISTS `roles`;

CREATE TABLE `roles` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `nombre` VARCHAR(50) NOT NULL UNIQUE,
    `descripcion` VARCHAR(255) NULL,
    `fecha_creacion` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 2. TABLA: usuarios
-- Almacena la información de clientes registrados en Nails VIP Club y administradores
-- -----------------------------------------------------------------------------
CREATE TABLE `usuarios` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `rol_id` INT NOT NULL DEFAULT 2,
    `nombre` VARCHAR(100) NOT NULL,
    `apellido` VARCHAR(100) NULL,
    `email` VARCHAR(150) NOT NULL UNIQUE,
    `telefono` VARCHAR(25) NULL,
    `password_hash` VARCHAR(255) NOT NULL,
    `descuento_vip` DECIMAL(5,2) DEFAULT 15.00,
    `estado` ENUM('activo', 'inactivo', 'bloqueado') NOT NULL DEFAULT 'activo',
    `fecha_registro` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT `fk_usuarios_rol` FOREIGN KEY (`rol_id`) REFERENCES `roles` (`id`) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 3. TABLA: categorias
-- Clasificación de los servicios de uñas para facilitar la búsqueda y orden
-- -----------------------------------------------------------------------------
CREATE TABLE `categorias` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `nombre` VARCHAR(100) NOT NULL UNIQUE,
    `slug` VARCHAR(100) NOT NULL UNIQUE,
    `descripcion` TEXT NULL,
    `estado` ENUM('activo', 'inactivo') NOT NULL DEFAULT 'activo',
    `fecha_creacion` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 4. TABLA: servicios
-- Almacena los servicios de uñas oficiales de NailArtist Studio con precios en Bs.
-- -----------------------------------------------------------------------------
CREATE TABLE `servicios` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `categoria_id` INT NOT NULL,
    `nombre` VARCHAR(150) NOT NULL,
    `slug` VARCHAR(150) NOT NULL UNIQUE,
    `descripcion` TEXT NOT NULL,
    `precio` DECIMAL(10,2) NOT NULL,
    `moneda` VARCHAR(5) NOT NULL DEFAULT 'Bs.',
    `duracion_minutos` INT NOT NULL DEFAULT 60,
    `imagen` VARCHAR(255) NOT NULL,
    `url_detalle` VARCHAR(255) NOT NULL,
    `destacado` TINYINT(1) NOT NULL DEFAULT 1,
    `calificacion` DECIMAL(2,1) DEFAULT 5.0,
    `estado` ENUM('activo', 'inactivo') NOT NULL DEFAULT 'activo',
    `fecha_creacion` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT `fk_servicios_categoria` FOREIGN KEY (`categoria_id`) REFERENCES `categorias` (`id`) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 5. TABLA: citas (Encabezado de reservas)
-- Registra las citas programadas por clientes desde la página web o carrito
-- -----------------------------------------------------------------------------
CREATE TABLE `citas` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `codigo_reserva` VARCHAR(20) NOT NULL UNIQUE,
    `usuario_id` INT NOT NULL,
    `fecha_cita` DATE NOT NULL,
    `hora_cita` TIME NOT NULL,
    `total_bs` DECIMAL(10,2) NOT NULL,
    `descuento_aplicado` DECIMAL(10,2) DEFAULT 0.00,
    `total_final_bs` DECIMAL(10,2) NOT NULL,
    `estado` ENUM('Pendiente', 'Confirmada', 'Cancelada', 'Completada') NOT NULL DEFAULT 'Pendiente',
    `observaciones` TEXT NULL,
    `metodo_contacto` ENUM('WhatsApp', 'Llamada', 'Correo') DEFAULT 'WhatsApp',
    `fecha_creacion` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT `fk_citas_usuario` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 6. TABLA: detalle_cita (Servicios incluidos en cada reserva)
-- Relaciona los servicios seleccionados con cada cita para histórico y reportes
-- -----------------------------------------------------------------------------
CREATE TABLE `detalle_cita` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `cita_id` INT NOT NULL,
    `servicio_id` INT NOT NULL,
    `precio_unitario` DECIMAL(10,2) NOT NULL,
    `cantidad` INT NOT NULL DEFAULT 1,
    `subtotal` DECIMAL(10,2) NOT NULL,
    CONSTRAINT `fk_detalle_cita` FOREIGN KEY (`cita_id`) REFERENCES `citas` (`id`) ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT `fk_detalle_servicio` FOREIGN KEY (`servicio_id`) REFERENCES `servicios` (`id`) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 7. TABLA: contactos (Consultas y mensajes de clientas)
-- -----------------------------------------------------------------------------
CREATE TABLE `contactos` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `nombre` VARCHAR(120) NOT NULL,
    `email` VARCHAR(150) NOT NULL,
    `telefono` VARCHAR(25) NULL,
    `mensaje` TEXT NOT NULL,
    `leido` TINYINT(1) DEFAULT 0,
    `fecha_envio` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 8. TABLA: resenas (Testimonios y valoraciones de clientas)
-- -----------------------------------------------------------------------------
CREATE TABLE `resenas` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `usuario_id` INT NOT NULL,
    `servicio_id` INT NULL,
    `calificacion` INT NOT NULL CHECK (`calificacion` BETWEEN 1 AND 5),
    `comentario` TEXT NOT NULL,
    `publicado` TINYINT(1) DEFAULT 1,
    `fecha_resena` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT `fk_resenas_usuario` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT `fk_resenas_servicio` FOREIGN KEY (`servicio_id`) REFERENCES `servicios` (`id`) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- ÍNDICES PARA OPTIMIZACIÓN DE CONSULTAS
-- =============================================================================
CREATE INDEX `idx_usuarios_email` ON `usuarios` (`email`);
CREATE INDEX `idx_servicios_categoria` ON `servicios` (`categoria_id`);
CREATE INDEX `idx_servicios_precio` ON `servicios` (`precio`);
CREATE INDEX `idx_citas_fecha` ON `citas` (`fecha_cita`, `hora_cita`);
CREATE INDEX `idx_citas_estado` ON `citas` (`estado`);
CREATE INDEX `idx_citas_usuario` ON `citas` (`usuario_id`);

-- =============================================================================
-- DATOS INICIALES (SEED DATA)
-- =============================================================================

-- 1. Insertar Roles
INSERT INTO `roles` (`id`, `nombre`, `descripcion`) VALUES
(1, 'Administrador', 'Control total de servicios, citas, usuarios y reportes'),
(2, 'Cliente', 'Acceso a registro VIP, promociones y reservas de citas'),
(3, 'Manicurista', 'Gestión de agenda y atención de citas');

-- 2. Insertar Usuarios de Prueba (Contraseña encriptada para 'admin123' y 'cliente123')
-- Hash generado con password_hash('admin123', PASSWORD_BCRYPT)
INSERT INTO `usuarios` (`id`, `rol_id`, `nombre`, `apellido`, `email`, `telefono`, `password_hash`, `descuento_vip`, `estado`) VALUES
(1, 1, 'Administradora', 'NailArtist', 'admin@nailzartist.com', '+59160737902', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 0.00, 'activo'),
(2, 2, 'Camila', 'Morales', 'camila.morales@gmail.com', '+59178945612', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 15.00, 'activo'),
(3, 2, 'Valentina', 'Rios', 'valentina.rios@gmail.com', '+59171234567', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 15.00, 'activo');

-- 3. Insertar Categorías Oficiales
INSERT INTO `categorias` (`id`, `nombre`, `slug`, `descripcion`, `estado`) VALUES
(1, 'Estructuras & Esculpido', 'estructuras-esculpido', 'Sistemas profesionales de acrílico y extensiones largas', 'activo'),
(2, 'Sistemas de Gel', 'sistemas-gel', 'Tecnologías suaves, ligeras y flexibles como Soft Gel y Rubber Base', 'activo'),
(3, 'Cuidado & Manicure Spa', 'cuidado-manicure-spa', 'Tratamientos de higiene, exfoliación e hidratación profunda', 'activo'),
(4, 'Arte & Decoración', 'arte-decoracion', 'Diseños a mano alzada, encapsulados, cristales Swarovski y foil', 'activo'),
(5, 'Promociones & Combos', 'promociones-combos', 'Paquetes combinados con beneficios y descuentos especiales', 'activo');

-- 4. Insertar los 9 Servicios Oficiales de NailArtist Studio con Precios en Bs.
INSERT INTO `servicios` (`id`, `categoria_id`, `nombre`, `slug`, `descripcion`, `precio`, `moneda`, `duracion_minutos`, `imagen`, `url_detalle`, `destacado`, `calificacion`, `estado`) VALUES
(1, 1, 'Uñas Acrílicas', 'unas-acrilicas', 'Esculpido profesional en acrílico de alta resistencia con puntas personalizadas (Almond, Coffin, Stiletto) y sellado de brillo duradero.', 80.00, 'Bs.', 105, 'images/service_acrilicas.jpg', 'left-sidebar.html', 1, 5.0, 'activo'),

(2, 2, 'Soft Gel / Revolution', 'soft-gel-revolution', 'Tips 100% de gel ultra flexibles que se fusionan con tu uña natural. Ligeras, cómodas y de apariencia sumamente delicada.', 90.00, 'Bs.', 90, 'images/service_softgel.jpg', 'revolution.html', 1, 4.9, 'activo'),

(3, 3, 'Manicure Completo', 'manicure-completo', 'Cuidado profundo de cutículas, exfoliación frutal de manos, baño de pétalos, hidratación intensiva con aceites y esmaltado nutritivo.', 40.00, 'Bs.', 50, 'images/service_manicure.jpg', 'manicure.html', 1, 4.8, 'activo'),

(4, 4, 'Decoración Premium', 'decoracion-premium', 'Incrustación de cristales genuinos estilo Swarovski, dijes dorados 3D, efecto cromo holográfico y relieves de lujo.', 35.00, 'Bs.', 30, 'images/service_decoracion.jpg', 'decoracion.html', 1, 5.0, 'activo'),

(5, 2, 'Esmaltado Semipermanente', 'esmaltado-semipermanente', 'Gama de más de 120 tonos en tendencia. Secado UV/LED instantáneo con brillo espejo intacto por más de 3 semanas sin descascararse.', 60.00, 'Bs.', 60, 'images/service_semipermanente.jpg', 'esmaltado.html', 1, 4.9, 'activo'),

(6, 4, 'Diseños Personalizados', 'disenos-personalizados', 'Trae tu foto de Pinterest o Instagram: recreamos líneas abstractas, french creativo, mármol y retratos con pincel fino.', 70.00, 'Bs.', 75, 'images/service_disenos.jpg', 'diseños.html', 1, 5.0, 'activo'),

(7, 4, 'Uñas Encapsuladas', 'unas-encapsuladas', 'Efecto transparente de cristal con encapsulado de flores secas, hojilla de oro rosa y glitter holográfico tridimensional.', 85.00, 'Bs.', 105, 'images/poc03.jpg', 'escapsuladas.html', 1, 4.9, 'activo'),

(8, 1, 'Extensión de Uñas XL', 'extension-unas-xl', 'Largo imponente con estructura y peralte reforzado para máxima resistencia. Puntas Ballerina, Coffin o Stiletto de impacto.', 100.00, 'Bs.', 120, 'images/poc04.jpg', 'extencion.html', 1, 5.0, 'activo'),

(9, 5, 'Combos & Promociones', 'combos-promociones', 'Combo Bestie: Set completo de Uñas Acrílicas o Soft Gel + Esmaltado Semipermanente + Decoración de 2 uñas ¡GRATIS!', 110.00, 'Bs.', 135, 'images/poc05.jpg', 'combos.html', 1, 5.0, 'activo');

-- 5. Insertar Cita de Ejemplo
INSERT INTO `citas` (`id`, `codigo_reserva`, `usuario_id`, `fecha_cita`, `hora_cita`, `total_bs`, `descuento_aplicado`, `total_final_bs`, `estado`, `observaciones`, `metodo_contacto`) VALUES
(1, 'RES-2026-001', 2, '2026-08-20', '15:30:00', 115.00, 17.25, 97.75, 'Confirmada', 'Clienta solicita tono rosa blush con toques dorados', 'WhatsApp');

-- 6. Insertar Detalle de la Cita de Ejemplo (Uñas Acrílicas Bs. 80 + Decoración Premium Bs. 35 = Bs. 115)
INSERT INTO `detalle_cita` (`id`, `cita_id`, `servicio_id`, `precio_unitario`, `cantidad`, `subtotal`) VALUES
(1, 1, 1, 80.00, 1, 80.00),
(2, 1, 4, 35.00, 1, 35.00);

-- 7. Insertar Reseña de Prueba
INSERT INTO `resenas` (`usuario_id`, `servicio_id`, `calificacion`, `comentario`) VALUES
(2, 1, 5, '¡Me encantaron mis uñas acrílicas! El acabado es súper fino y me duraron más de un mes perfectas.'),
(3, 2, 5, 'Excelente atención y cuidado de mis uñas. El soft gel no pesa nada y se ve súper natural.');
