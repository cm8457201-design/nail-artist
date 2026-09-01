<?php
/**
 * API Endpoint: Inicio de Sesión (Login)
 * Método: POST
 * Parámetros: email, password
 */

require_once __DIR__ . '/../config/conexion.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(false, 'Método HTTP no permitido. Use POST.', null, 405);
}

$input = json_decode(file_get_contents('php://input'), true) ?? $_POST;

$email = trim($input['email'] ?? '');
$password = trim($input['password'] ?? '');

if (empty($email) || empty($password)) {
    jsonResponse(false, 'Debe ingresar su correo electrónico y contraseña.', null, 400);
}

try {
    $pdo = Database::getConnection();

    $stmt = $pdo->prepare("SELECT u.id, u.nombre, u.apellido, u.email, u.password_hash, 
                                  u.descuento_vip, u.estado, r.nombre AS rol
                           FROM usuarios u
                           INNER JOIN roles r ON u.rol_id = r.id
                           WHERE u.email = :email");
    $stmt->execute([':email' => $email]);
    $user = $stmt->fetch();

    if (!$user) {
        jsonResponse(false, 'Credenciales incorrectas o correo no registrado.', null, 401);
    }

    if ($user['estado'] !== 'activo') {
        jsonResponse(false, 'Su cuenta se encuentra inactiva o bloqueada. Contacte con la administración.', null, 403);
    }

    // Verificar hash de contraseña
    if (!password_verify($password, $user['password_hash'])) {
        jsonResponse(false, 'Credenciales incorrectas. Verifique su contraseña.', null, 401);
    }

    // Inicio de sesión exitoso
    unset($user['password_hash']);

    jsonResponse(true, 'Inicio de sesión exitoso. ¡Bienvenida a NailArtist!', [
        'usuario' => $user
    ]);

} catch (Exception $e) {
    jsonResponse(false, 'Error en el servidor al intentar iniciar sesión.', $e->getMessage(), 500);
}
