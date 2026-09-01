<?php
/**
 * NailArtist Studio — Cierre de Sesión Seguro
 */

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

// Limpiar todas las variables de sesión
$_SESSION = [];

// Destruir la cookie de sesión si existe
if (ini_get("session.use_cookies")) {
    $params = session_get_cookie_params();
    setcookie(session_name(), '', time() - 42000,
        $params["path"], $params["domain"],
        $params["secure"], $params["httponly"]
    );
}

// Destruir la sesión en el servidor
session_destroy();

// Redirigir a login con mensaje informativo
header("Location: login.php?msg=" . urlencode('Has cerrado sesión correctamente. ¡Hasta pronto!'));
exit;
