<?php
/**
 * API Endpoint: Crear Reserva / Cita desde el Carrito
 * Método: POST
 * Parámetros JSON:
 * {
 *   "usuario_id": 2, // opcional o id registrado
 *   "nombre_cliente": "Camila Morales", // si no está logueada
 *   "telefono_cliente": "+59160737902",
 *   "email_cliente": "camila@gmail.com",
 *   "fecha_cita": "2026-08-25",
 *   "hora_cita": "16:00",
 *   "observaciones": "Quiero diseño con flores y brillo",
 *   "servicios": [
 *       {"servicio_id": 1, "nombre": "Uñas Acrílicas", "precio": 80.00, "cantidad": 1},
 *       {"servicio_id": 4, "nombre": "Decoración Premium", "precio": 35.00, "cantidad": 1}
 *   ]
 * }
 */

require_once __DIR__ . '/../config/conexion.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(false, 'Método HTTP no permitido. Use POST.', null, 405);
}

$input = json_decode(file_get_contents('php://input'), true) ?? $_POST;

$usuario_id = !empty($input['usuario_id']) ? intval($input['usuario_id']) : null;
$nombre_cliente = trim($input['nombre_cliente'] ?? '');
$email_cliente = trim($input['email_cliente'] ?? '');
$telefono_cliente = trim($input['telefono_cliente'] ?? '');
$fecha_cita = trim($input['fecha_cita'] ?? date('Y-m-d', strtotime('+1 day')));
$hora_cita = trim($input['hora_cita'] ?? '10:00:00');
$observaciones = trim($input['observaciones'] ?? '');
$servicios = $input['servicios'] ?? [];

if (empty($servicios) || !is_array($servicios)) {
    jsonResponse(false, 'Debe seleccionar al menos un servicio para agendar su cita.', null, 400);
}

try {
    $pdo = Database::getConnection();
    $pdo->beginTransaction();

    // Si no tiene usuario_id pero envió datos de cliente, buscar o crear usuario temporal
    if (!$usuario_id) {
        if (!empty($email_cliente)) {
            $stmtUser = $pdo->prepare("SELECT id FROM usuarios WHERE email = :email");
            $stmtUser->execute([':email' => $email_cliente]);
            $existing = $stmtUser->fetch();
            if ($existing) {
                $usuario_id = $existing['id'];
            } else {
                $pwdTmp = password_hash(uniqid('nail_'), PASSWORD_DEFAULT);
                $stmtNew = $pdo->prepare("INSERT INTO usuarios (rol_id, nombre, email, telefono, password_hash) 
                                          VALUES (2, :nombre, :email, :telefono, :pwd)");
                $stmtNew->execute([
                    ':nombre' => !empty($nombre_cliente) ? $nombre_cliente : 'Clienta Invitada',
                    ':email' => $email_cliente,
                    ':telefono' => $telefono_cliente,
                    ':pwd' => $pwdTmp
                ]);
                $usuario_id = $pdo->lastInsertId();
            }
        } else {
            // Usuario invitado por defecto (ID 2 o el primero de rol cliente)
            $usuario_id = 2;
        }
    }

    // Calcular montos
    $total_bs = 0;
    $itemsValidados = [];

    foreach ($servicios as $item) {
        $servicio_id = intval($item['servicio_id'] ?? 0);
        $cantidad = max(1, intval($item['cantidad'] ?? 1));
        
        // Si no enviaron servicio_id pero enviaron nombre, buscar por nombre
        if ($servicio_id === 0 && !empty($item['nombre'])) {
            $stmtSrv = $pdo->prepare("SELECT id, precio, nombre FROM servicios WHERE nombre LIKE :nombre LIMIT 1");
            $stmtSrv->execute([':nombre' => '%' . trim($item['nombre']) . '%']);
            $srvFound = $stmtSrv->fetch();
            if ($srvFound) {
                $servicio_id = $srvFound['id'];
                $precio = floatval($srvFound['precio']);
            } else {
                $precio = floatval($item['precio'] ?? 0);
            }
        } else {
            $stmtSrv = $pdo->prepare("SELECT id, precio, nombre FROM servicios WHERE id = :id");
            $stmtSrv->execute([':id' => $servicio_id]);
            $srvFound = $stmtSrv->fetch();
            $precio = $srvFound ? floatval($srvFound['precio']) : floatval($item['precio'] ?? 0);
        }

        if ($servicio_id > 0) {
            $subtotal = $precio * $cantidad;
            $total_bs += $subtotal;
            $itemsValidados[] = [
                'servicio_id' => $servicio_id,
                'precio_unitario' => $precio,
                'cantidad' => $cantidad,
                'subtotal' => $subtotal
            ];
        }
    }

    if (empty($itemsValidados)) {
        $pdo->rollBack();
        jsonResponse(false, 'No se pudieron procesar los servicios seleccionados.', null, 400);
    }

    // Generar código de reserva único
    $codigo_reserva = 'RES-' . date('Y') . '-' . strtoupper(substr(uniqid(), -5));

    // Descuento VIP si aplica
    $stmtDesc = $pdo->prepare("SELECT descuento_vip FROM usuarios WHERE id = :id");
    $stmtDesc->execute([':id' => $usuario_id]);
    $descRow = $stmtDesc->fetch();
    $descuentoPorcentaje = $descRow ? floatval($descRow['descuento_vip']) : 0;
    $descuento_bs = ($total_bs * $descuentoPorcentaje) / 100;
    $total_final_bs = max(0, $total_bs - $descuento_bs);

    // Insertar en tabla `citas`
    $sqlCita = "INSERT INTO citas (codigo_reserva, usuario_id, fecha_cita, hora_cita, total_bs, 
                                   descuento_aplicado, total_final_bs, estado, observaciones, metodo_contacto) 
                VALUES (:codigo, :usuario_id, :fecha, :hora, :total_bs, :descuento, :total_final, 'Pendiente', :obs, 'WhatsApp')";
    
    $stmtCita = $pdo->prepare($sqlCita);
    $stmtCita->execute([
        ':codigo' => $codigo_reserva,
        ':usuario_id' => $usuario_id,
        ':fecha' => $fecha_cita,
        ':hora' => $hora_cita,
        ':total_bs' => $total_bs,
        ':descuento' => $descuento_bs,
        ':total_final' => $total_final_bs,
        ':obs' => $observaciones
    ]);

    $cita_id = $pdo->lastInsertId();

    // Insertar en tabla `detalle_cita`
    $sqlDetalle = "INSERT INTO detalle_cita (cita_id, servicio_id, precio_unitario, cantidad, subtotal) 
                   VALUES (:cita_id, :servicio_id, :precio_unitario, :cantidad, :subtotal)";
    $stmtDetalle = $pdo->prepare($sqlDetalle);

    foreach ($itemsValidados as $item) {
        $stmtDetalle->execute([
            ':cita_id' => $cita_id,
            ':servicio_id' => $item['servicio_id'],
            ':precio_unitario' => $item['precio_unitario'],
            ':cantidad' => $item['cantidad'],
            ':subtotal' => $item['subtotal']
        ]);
    }

    $pdo->commit();

    jsonResponse(true, '¡Reserva creada exitosamente en la base de datos!', [
        'cita_id' => $cita_id,
        'codigo_reserva' => $codigo_reserva,
        'fecha_cita' => $fecha_cita,
        'hora_cita' => $hora_cita,
        'total_bs' => $total_bs,
        'descuento_bs' => $descuento_bs,
        'total_final_bs' => $total_final_bs,
        'estado' => 'Pendiente',
        'cantidad_servicios' => count($itemsValidados)
    ], 201);

} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    jsonResponse(false, 'Error al guardar la reserva en la base de datos.', $e->getMessage(), 500);
}
