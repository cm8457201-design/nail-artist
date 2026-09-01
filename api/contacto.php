<?php
/**
 * API Endpoint: Enviar Mensaje de Contacto
 * Método: POST
 * Parámetros: nombre, email, telefono, mensaje
 */

require_once __DIR__ . '/../config/conexion.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(false, 'Método HTTP no permitido. Use POST.', null, 405);
}

$input = json_decode(file_get_contents('php://input'), true) ?? $_POST;

$nombre = trim($input['nombre'] ?? '');
$email = trim($input['email'] ?? '');
$telefono = trim($input['telefono'] ?? '');
$mensaje = trim($input['mensaje'] ?? '');

if (empty($nombre) || empty($email) || empty($mensaje)) {
    jsonResponse(false, 'Nombre, correo electrónico y mensaje son obligatorios.', null, 400);
}

try {
    $pdo = Database::getConnection();

    $stmt = $pdo->prepare("INSERT INTO contactos (nombre, email, telefono, mensaje) 
                           VALUES (:nombre, :email, :telefono, :mensaje)");
    $stmt->execute([
        ':nombre' => $nombre,
        ':email' => $email,
        ':telefono' => $telefono,
        ':mensaje' => $mensaje
    ]);

    jsonResponse(true, '¡Gracias por contactarnos! Tu mensaje ha sido recibido.', [
        'id' => $pdo->lastInsertId()
    ], 201);

} catch (Exception $e) {
    jsonResponse(false, 'Error al guardar el mensaje de contacto.', $e->getMessage(), 500);
}
