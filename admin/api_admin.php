<?php
/**
 * NailArtist Studio — API Administrativa Unificada
 * Maneja todas las operaciones CRUD y cambios de estado con verificación estricta de Administrador.
 */

require_once __DIR__ . '/../config/conexion.php';
require_once __DIR__ . '/auth_check.php';

// Validar que el usuario sea Administrador
requerirAdminApi();

$action = $_GET['action'] ?? '';
$input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
$pdo = Database::getConnection();

switch ($action) {

    // =========================================================================
    // 1. GESTIÓN DE USUARIOS
    // =========================================================================
    case 'usuario_obtener':
        $id = (int)($_GET['id'] ?? $input['id'] ?? 0);
        $stmt = $pdo->prepare("SELECT u.id, u.rol_id, u.nombre, u.apellido, u.email, u.telefono, 
                                      u.descuento_vip, u.estado, r.nombre AS rol_nombre
                               FROM usuarios u
                               INNER JOIN roles r ON u.rol_id = r.id
                               WHERE u.id = :id");
        $stmt->execute([':id' => $id]);
        $user = $stmt->fetch();
        if ($user) {
            jsonResponse(true, 'Usuario obtenido', $user);
        } else {
            jsonResponse(false, 'Usuario no encontrado', null, 404);
        }
        break;

    case 'usuario_crear':
        $nombre = trim($input['nombre'] ?? '');
        $apellido = trim($input['apellido'] ?? '');
        $email = trim($input['email'] ?? '');
        $telefono = trim($input['telefono'] ?? '');
        $password = trim($input['password'] ?? '');
        $rol_id = (int)($input['rol_id'] ?? 2);
        $estado = in_array($input['estado'] ?? '', ['activo', 'inactivo', 'bloqueado']) ? $input['estado'] : 'activo';
        $descuento = floatval($input['descuento_vip'] ?? 0);

        if (empty($nombre) || empty($email) || empty($password)) {
            jsonResponse(false, 'Nombre, correo y contraseña son obligatorios.', null, 400);
        }
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            jsonResponse(false, 'El formato de correo no es válido.', null, 400);
        }

        // Verificar si el correo ya existe
        $stmtCheck = $pdo->prepare("SELECT id FROM usuarios WHERE email = :email");
        $stmtCheck->execute([':email' => $email]);
        if ($stmtCheck->fetch()) {
            jsonResponse(false, 'Ya existe un usuario registrado con este correo.', null, 409);
        }

        $password_hash = password_hash($password, PASSWORD_DEFAULT);

        $stmtInsert = $pdo->prepare("INSERT INTO usuarios (rol_id, nombre, apellido, email, telefono, password_hash, descuento_vip, estado) 
                                     VALUES (:rol_id, :nombre, :apellido, :email, :telefono, :pwd, :descuento, :estado)");
        $stmtInsert->execute([
            ':rol_id' => $rol_id,
            ':nombre' => $nombre,
            ':apellido' => $apellido,
            ':email' => $email,
            ':telefono' => $telefono,
            ':pwd' => $password_hash,
            ':descuento' => $descuento,
            ':estado' => $estado
        ]);

        jsonResponse(true, 'Usuario creado exitosamente con ID #' . $pdo->lastInsertId());
        break;

    case 'usuario_editar':
        $id = (int)($input['id'] ?? 0);
        $nombre = trim($input['nombre'] ?? '');
        $apellido = trim($input['apellido'] ?? '');
        $email = trim($input['email'] ?? '');
        $telefono = trim($input['telefono'] ?? '');
        $password = trim($input['password'] ?? '');
        $rol_id = (int)($input['rol_id'] ?? 2);
        $estado = in_array($input['estado'] ?? '', ['activo', 'inactivo', 'bloqueado']) ? $input['estado'] : 'activo';
        $descuento = floatval($input['descuento_vip'] ?? 0);

        if ($id <= 0 || empty($nombre) || empty($email)) {
            jsonResponse(false, 'Datos incompletos para actualizar usuario.', null, 400);
        }

        // Comprobar correo duplicado en otro ID
        $stmtCheck = $pdo->prepare("SELECT id FROM usuarios WHERE email = :email AND id != :id");
        $stmtCheck->execute([':email' => $email, ':id' => $id]);
        if ($stmtCheck->fetch()) {
            jsonResponse(false, 'El correo electrónico ya pertenece a otro usuario.', null, 409);
        }

        if (!empty($password)) {
            $password_hash = password_hash($password, PASSWORD_DEFAULT);
            $stmtUp = $pdo->prepare("UPDATE usuarios SET rol_id = :rol_id, nombre = :nombre, apellido = :apellido, 
                                                        email = :email, telefono = :telefono, password_hash = :pwd, 
                                                        descuento_vip = :descuento, estado = :estado 
                                     WHERE id = :id");
            $stmtUp->execute([
                ':rol_id' => $rol_id,
                ':nombre' => $nombre,
                ':apellido' => $apellido,
                ':email' => $email,
                ':telefono' => $telefono,
                ':pwd' => $password_hash,
                ':descuento' => $descuento,
                ':estado' => $estado,
                ':id' => $id
            ]);
        } else {
            $stmtUp = $pdo->prepare("UPDATE usuarios SET rol_id = :rol_id, nombre = :nombre, apellido = :apellido, 
                                                        email = :email, telefono = :telefono, 
                                                        descuento_vip = :descuento, estado = :estado 
                                     WHERE id = :id");
            $stmtUp->execute([
                ':rol_id' => $rol_id,
                ':nombre' => $nombre,
                ':apellido' => $apellido,
                ':email' => $email,
                ':telefono' => $telefono,
                ':descuento' => $descuento,
                ':estado' => $estado,
                ':id' => $id
            ]);
        }

        jsonResponse(true, 'Usuario actualizado correctamente.');
        break;

    case 'usuario_eliminar':
        $id = (int)($input['id'] ?? 0);
        if ($id <= 0) jsonResponse(false, 'ID de usuario inválido.', null, 400);

        // Prevenir que el admin actual se elimine a sí mismo
        if ($id === (int)($_SESSION['admin_user']['id'] ?? 0)) {
            jsonResponse(false, 'No puedes eliminar tu propia cuenta de administrador en sesión activa.', null, 403);
        }

        try {
            $stmtDel = $pdo->prepare("DELETE FROM usuarios WHERE id = :id");
            $stmtDel->execute([':id' => $id]);
            jsonResponse(true, 'Usuario eliminado de la base de datos.');
        } catch (PDOException $e) {
            // Si tiene citas u otras claves foráneas, cambiar a inactivo/bloqueado
            $stmtUp = $pdo->prepare("UPDATE usuarios SET estado = 'bloqueado' WHERE id = :id");
            $stmtUp->execute([':id' => $id]);
            jsonResponse(true, 'El usuario tiene citas o datos históricos asociados. Su estado se ha cambiado a "Bloqueado".');
        }
        break;

    // =========================================================================
    // 2. GESTIÓN DE SERVICIOS
    // =========================================================================
    case 'servicio_obtener':
        $id = (int)($_GET['id'] ?? $input['id'] ?? 0);
        $stmt = $pdo->prepare("SELECT s.*, c.nombre AS categoria_nombre 
                               FROM servicios s
                               INNER JOIN categorias c ON s.categoria_id = c.id
                               WHERE s.id = :id");
        $stmt->execute([':id' => $id]);
        $srv = $stmt->fetch();
        if ($srv) {
            jsonResponse(true, 'Servicio encontrado', $srv);
        } else {
            jsonResponse(false, 'Servicio no encontrado', null, 404);
        }
        break;

    case 'servicio_crear':
        $categoria_id = (int)($input['categoria_id'] ?? 1);
        $nombre = trim($input['nombre'] ?? '');
        $descripcion = trim($input['descripcion'] ?? '');
        $precio = floatval($input['precio'] ?? 0);
        $duracion = intval($input['duracion_minutos'] ?? 60);
        $imagen = trim($input['imagen'] ?? 'images/service_acrilicas.jpg');
        $url_detalle = trim($input['url_detalle'] ?? 'servicios.html');
        $destacado = !empty($input['destacado']) ? 1 : 0;
        $estado = in_array($input['estado'] ?? '', ['activo', 'inactivo']) ? $input['estado'] : 'activo';

        if (empty($nombre) || $precio <= 0) {
            jsonResponse(false, 'El nombre y precio válido son obligatorios.', null, 400);
        }

        // Generar slug
        $slug = strtolower(trim(preg_replace('/[^A-Za-z0-9-]+/', '-', $nombre)));
        $stmtSlug = $pdo->prepare("SELECT id FROM servicios WHERE slug = :slug");
        $stmtSlug->execute([':slug' => $slug]);
        if ($stmtSlug->fetch()) {
            $slug .= '-' . time();
        }

        $stmtIns = $pdo->prepare("INSERT INTO servicios (categoria_id, nombre, slug, descripcion, precio, moneda, duracion_minutos, imagen, url_detalle, destacado, calificacion, estado)
                                  VALUES (:cat, :nombre, :slug, :desc, :precio, 'Bs.', :duracion, :imagen, :url, :destacado, 5.0, :estado)");
        $stmtIns->execute([
            ':cat' => $categoria_id,
            ':nombre' => $nombre,
            ':slug' => $slug,
            ':desc' => $descripcion,
            ':precio' => $precio,
            ':duracion' => $duracion,
            ':imagen' => $imagen,
            ':url' => $url_detalle,
            ':destacado' => $destacado,
            ':estado' => $estado
        ]);

        jsonResponse(true, 'Servicio creado exitosamente en el catálogo con ID #' . $pdo->lastInsertId());
        break;

    case 'servicio_editar':
        $id = (int)($input['id'] ?? 0);
        $categoria_id = (int)($input['categoria_id'] ?? 1);
        $nombre = trim($input['nombre'] ?? '');
        $descripcion = trim($input['descripcion'] ?? '');
        $precio = floatval($input['precio'] ?? 0);
        $duracion = intval($input['duracion_minutos'] ?? 60);
        $imagen = trim($input['imagen'] ?? 'images/service_acrilicas.jpg');
        $url_detalle = trim($input['url_detalle'] ?? 'servicios.html');
        $destacado = !empty($input['destacado']) ? 1 : 0;
        $estado = in_array($input['estado'] ?? '', ['activo', 'inactivo']) ? $input['estado'] : 'activo';

        if ($id <= 0 || empty($nombre) || $precio <= 0) {
            jsonResponse(false, 'Datos incompletos para actualizar servicio.', null, 400);
        }

        $stmtUp = $pdo->prepare("UPDATE servicios 
                                 SET categoria_id = :cat, nombre = :nombre, descripcion = :desc, 
                                     precio = :precio, duracion_minutos = :duracion, imagen = :imagen, 
                                     url_detalle = :url, destacado = :destacado, estado = :estado 
                                 WHERE id = :id");
        $stmtUp->execute([
            ':cat' => $categoria_id,
            ':nombre' => $nombre,
            ':desc' => $descripcion,
            ':precio' => $precio,
            ':duracion' => $duracion,
            ':imagen' => $imagen,
            ':url' => $url_detalle,
            ':destacado' => $destacado,
            ':estado' => $estado,
            ':id' => $id
        ]);

        jsonResponse(true, 'Servicio actualizado correctamente.');
        break;

    case 'servicio_eliminar':
        $id = (int)($input['id'] ?? 0);
        if ($id <= 0) jsonResponse(false, 'ID de servicio inválido.', null, 400);

        try {
            $stmtDel = $pdo->prepare("DELETE FROM servicios WHERE id = :id");
            $stmtDel->execute([':id' => $id]);
            jsonResponse(true, 'Servicio eliminado permanentemente.');
        } catch (PDOException $e) {
            // Si tiene citas registradas, desactivarlo
            $stmtUp = $pdo->prepare("UPDATE servicios SET estado = 'inactivo' WHERE id = :id");
            $stmtUp->execute([':id' => $id]);
            jsonResponse(true, 'El servicio tiene citas históricas asociadas. Se cambió su estado a "Inactivo".');
        }
        break;

    // =========================================================================
    // 3. GESTIÓN DE CITAS
    // =========================================================================
    case 'cita_cambiar_estado':
        $id = (int)($input['id'] ?? 0);
        $estado = $input['estado'] ?? '';
        $estadosPermitidos = ['Pendiente', 'Confirmada', 'Cancelada', 'Completada'];

        if ($id <= 0 || !in_array($estado, $estadosPermitidos)) {
            jsonResponse(false, 'Estado o ID de cita inválido.', null, 400);
        }

        $stmt = $pdo->prepare("UPDATE citas SET estado = :estado WHERE id = :id");
        $stmt->execute([':estado' => $estado, ':id' => $id]);

        jsonResponse(true, "Estado de la cita #{$id} actualizado a '{$estado}'.");
        break;

    case 'cita_detalle':
        $id = (int)($_GET['id'] ?? $input['id'] ?? 0);
        if ($id <= 0) jsonResponse(false, 'ID de cita inválido.', null, 400);

        $stmtCita = $pdo->prepare("SELECT c.*, u.nombre AS cliente_nombre, u.apellido AS cliente_apellido, 
                                          u.email AS cliente_email, u.telefono AS cliente_telefono
                                   FROM citas c
                                   INNER JOIN usuarios u ON c.usuario_id = u.id
                                   WHERE c.id = :id");
        $stmtCita->execute([':id' => $id]);
        $cita = $stmtCita->fetch();

        if (!$cita) {
            jsonResponse(false, 'Cita no encontrada.', null, 404);
        }

        $stmtItems = $pdo->prepare("SELECT d.*, s.nombre AS servicio_nombre, s.imagen AS servicio_imagen
                                    FROM detalle_cita d
                                    INNER JOIN servicios s ON d.servicio_id = s.id
                                    WHERE d.cita_id = :cita_id");
        $stmtItems->execute([':cita_id' => $id]);
        $cita['servicios'] = $stmtItems->fetchAll();

        jsonResponse(true, 'Detalle de cita cargado', $cita);
        break;

    // =========================================================================
    // 4. RESEÑAS
    // =========================================================================
    case 'resena_toggle_publicado':
        $id = (int)($input['id'] ?? 0);
        $publicado = !empty($input['publicado']) ? 1 : 0;

        $stmt = $pdo->prepare("UPDATE resenas SET publicado = :pub WHERE id = :id");
        $stmt->execute([':pub' => $publicado, ':id' => $id]);

        jsonResponse(true, 'Estado de publicación de la reseña actualizado.');
        break;

    case 'resena_eliminar':
        $id = (int)($input['id'] ?? 0);
        $stmt = $pdo->prepare("DELETE FROM resenas WHERE id = :id");
        $stmt->execute([':id' => $id]);
        jsonResponse(true, 'Reseña eliminada correctamente.');
        break;

    // =========================================================================
    // 5. MENSAJES DE CONTACTO
    // =========================================================================
    case 'mensaje_marcar_leido':
        $id = (int)($input['id'] ?? 0);
        $leido = !empty($input['leido']) ? 1 : 0;

        $stmt = $pdo->prepare("UPDATE contactos SET leido = :leido WHERE id = :id");
        $stmt->execute([':leido' => $leido, ':id' => $id]);

        jsonResponse(true, 'Estado del mensaje actualizado.');
        break;

    case 'mensaje_eliminar':
        $id = (int)($input['id'] ?? 0);
        $stmt = $pdo->prepare("DELETE FROM contactos WHERE id = :id");
        $stmt->execute([':id' => $id]);
        jsonResponse(true, 'Mensaje de contacto eliminado.');
        break;

    default:
        jsonResponse(false, 'Acción administrativa no válida.', null, 400);
        break;
}
