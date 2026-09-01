<?php
/**
 * API Endpoint: Registro de Clientes (Nails VIP Club)
 * Método: POST
 * Parámetros JSON o Form-Data: nombre, apellido, email, telefono, password
 */

require_once __DIR__ . '/../config/conexion.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(false, 'Método HTTP no permitido. Use POST.', null, 405);
}

// Obtener datos recibidos en JSON o Form-Data
$input = json_decode(file_get_contents('php://input'), true) ?? $_POST;

$nombre = trim($input['nombre'] ?? '');
$apellido = trim($input['apellido'] ?? '');
$email = trim($input['email'] ?? '');
$telefono = trim($input['telefono'] ?? '');
$password = trim($input['password'] ?? '');

// Validaciones
if (empty($nombre)) {
    jsonResponse(false, 'El nombre es obligatorio.', null, 400);
}

if (empty($email) || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    jsonResponse(false, 'Debe proporcionar un correo electrónico válido.', null, 400);
}

if (empty($password) || strlen($password) < 6) {
    jsonResponse(false, 'La contraseña debe tener al menos 6 caracteres.', null, 400);
}

try {
    $pdo = Database::getConnection();

    // Verificar si el correo ya existe
    $stmtCheck = $pdo->prepare("SELECT id FROM usuarios WHERE email = :email");
    $stmtCheck->execute([':email' => $email]);
    if ($stmtCheck->fetch()) {
        jsonResponse(false, 'El correo electrónico ya se encuentra registrado. Intente iniciar sesión.', null, 409);
    }

    // Encriptar contraseña de forma segura (Algoritmo BCRYPT)
    $password_hash = password_hash($password, PASSWORD_DEFAULT);

    // Insertar nuevo usuario como Cliente (rol_id = 2) con 15% de descuento VIP
    $sqlInsert = "INSERT INTO usuarios (rol_id, nombre, apellido, email, telefono, password_hash, descuento_vip, estado) 
                  VALUES (2, :nombre, :apellido, :email, :telefono, :password_hash, 15.00, 'activo')";
    
    $stmtInsert = $pdo->prepare($sqlInsert);
    $stmtInsert->execute([
        ':nombre' => $nombre,
        ':apellido' => $apellido,
        ':email' => $email,
        ':telefono' => $telefono,
        ':password_hash' => $password_hash
    ]);

    $usuarioId = $pdo->lastInsertId();

    jsonResponse(true, '¡Bienvenida a Nails VIP Club! Tu cuenta ha sido registrada con 15% de descuento.', [
        'id' => $usuarioId,
        'nombre' => $nombre,
        'email' => $email,
        'descuento_vip' => 15.00,
        'mensaje' => 'Tu descuento del 15% ha sido activado para tu primera cita.'
    ], 201);

} catch (Exception $e) {
    jsonResponse(false, 'Error al registrar el usuario en la base de datos.', $e->getMessage(), 500);
}
