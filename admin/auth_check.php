<?php
/**
 * NailArtist Studio — Middleware de Autenticación de Administrador
 * Verifica que la sesión esté activa y que el usuario tenga rol de Administrador (rol_id = 1).
 */

if (session_status() === PHP_SESSION_NONE) {
    // Configuración segura de cookies de sesión
    session_set_cookie_params([
        'lifetime' => 0,
        'path'     => '/',
        'domain'   => '',
        'secure'   => isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on',
        'httponly' => true,
        'samesite' => 'Lax'
    ]);
    session_start();
}

/**
 * Función para verificar si el usuario actual es administrador
 */
function esAdminAutenticado(): bool {
    if (!isset($_SESSION['admin_user']) || !is_array($_SESSION['admin_user'])) {
        return false;
    }
    
    $user = $_SESSION['admin_user'];
    // Validar ID de rol (1 = Administrador) o nombre de rol
    return (isset($user['rol_id']) && (int)$user['rol_id'] === 1) ||
           (isset($user['rol']) && strtolower($user['rol']) === 'administrador');
}

/**
 * Función para proteger páginas HTML/PHP administrativas
 */
function requerirAdmin() {
    if (!esAdminAutenticado()) {
        // Redirigir al formulario de login con mensaje de error
        $mensaje = urlencode('Debes iniciar sesión con una cuenta de Administrador para acceder.');
        header("Location: login.php?error=no_auth&msg={$mensaje}");
        exit;
    }
}

/**
 * Función para proteger endpoints API del administrador (retorna JSON)
 */
function requerirAdminApi() {
    if (!esAdminAutenticado()) {
        http_response_code(403);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode([
            'success' => false,
            'message' => 'Acceso denegado. Se requieren privilegios de Administrador.',
            'error_code' => 'UNAUTHORIZED_ROLE'
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }
}
