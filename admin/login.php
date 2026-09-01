<?php
/**
 * NailArtist Studio — Pantalla de Acceso Administrativo
 */

require_once __DIR__ . '/../config/conexion.php';

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

// Si ya tiene sesión activa como Administrador, redirigir directo al dashboard
if (isset($_SESSION['admin_user']) && ((int)($_SESSION['admin_user']['rol_id'] ?? 0) === 1)) {
    header("Location: index.php");
    exit;
}

$error = '';
$success = '';

if (isset($_GET['msg'])) {
    $success = htmlspecialchars($_GET['msg'], ENT_QUOTES, 'UTF-8');
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $email = trim($_POST['email'] ?? '');
    $password = trim($_POST['password'] ?? '');

    if (empty($email) || empty($password)) {
        $error = 'Por favor ingresa tu correo electrónico y contraseña.';
    } else {
        try {
            $pdo = Database::getConnection();
            $stmt = $pdo->prepare("SELECT u.id, u.rol_id, u.nombre, u.apellido, u.email, 
                                          u.password_hash, u.estado, r.nombre AS rol
                                   FROM usuarios u
                                   INNER JOIN roles r ON u.rol_id = r.id
                                   WHERE u.email = :email LIMIT 1");
            $stmt->execute([':email' => $email]);
            $user = $stmt->fetch();

            if (!$user) {
                $error = 'Credenciales incorrectas o usuario no registrado.';
            } elseif (!password_verify($password, $user['password_hash'])) {
                $error = 'Contraseña incorrecta. Por favor intenta de nuevo.';
            } elseif ($user['estado'] !== 'activo') {
                $error = 'Esta cuenta se encuentra inactiva o bloqueada. Contacte soporte.';
            } elseif ((int)$user['rol_id'] !== 1 && strtolower($user['rol']) !== 'administrador') {
                // El usuario existe pero NO es Administrador
                $error = 'Acceso Denegado: Tu cuenta tiene rol de ' . htmlspecialchars($user['rol']) . ' y no cuenta con privilegios de Administrador.';
            } else {
                // Autenticación exitosa
                session_regenerate_id(true);
                $_SESSION['admin_user'] = [
                    'id' => (int)$user['id'],
                    'rol_id' => (int)$user['rol_id'],
                    'rol' => $user['rol'],
                    'nombre' => $user['nombre'],
                    'apellido' => $user['apellido'],
                    'email' => $user['email'],
                    'ultimo_acceso' => date('Y-m-d H:i:s')
                ];

                header("Location: index.php");
                exit;
            }
        } catch (Exception $e) {
            $error = 'Error de conexión con el servidor MySQL: ' . $e->getMessage();
        }
    }
}
?>
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Acceso Administrador — NailArtist Studio</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400..900;1,400..900&family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="assets/css/admin.css">
</head>
<body class="admin-auth-body">

    <div class="auth-wrapper">
        <div class="auth-glass-card">
            
            <div class="auth-header">
                <a href="../index.html" class="auth-logo" title="Volver a la Web Principal">
                    <svg class="logo-spiral-icon" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M50 8 C26.8 8 8 26.8 8 50 C8 73.2 26.8 92 50 92 C73.2 92 92 73.2 92 50 C92 31.5 80 16 62.5 11.5 C41.5 6.1 20.8 18.2 15.4 39.2 C10 60.2 22.1 80.9 43.1 86.3 C64.1 91.7 84.8 79.6 90.2 58.6 C94.5 41.8 84.5 24.5 67.7 20.2 C52.5 16.3 36.8 24.8 32.9 40 C29 55.2 37.5 70.9 52.7 74.8 C66.5 78.3 80.5 70 83.2 56 C85.5 44 77.5 32.5 65.5 30.2 C54.5 28.1 44 35.5 41.9 46.5 C40 56.5 47 65.5 57 67.4 C65.5 69 73 63 74.5 54.5" stroke="currentColor" stroke-width="5" stroke-linecap="round"/>
                    </svg>
                    <div class="auth-brand-text">
                        <span class="brand-top">NAILS</span>
                        <span class="brand-bottom">ARTIST</span>
                    </div>
                </a>
                <span class="auth-badge">👑 PANEL ADMINISTRADOR</span>
                <h1 class="auth-title">Iniciar Sesión</h1>
                <p class="auth-subtitle">Ingresa tus credenciales de administrador para gestionar servicios, citas y usuarios de NailArtist.</p>
            </div>

            <?php if (!empty($error)): ?>
                <div class="alert alert-error">
                    <span class="alert-icon">⚠️</span>
                    <div class="alert-text"><?= htmlspecialchars($error) ?></div>
                </div>
            <?php endif; ?>

            <?php if (!empty($success)): ?>
                <div class="alert alert-success">
                    <span class="alert-icon">✨</span>
                    <div class="alert-text"><?= htmlspecialchars($success) ?></div>
                </div>
            <?php endif; ?>

            <form action="login.php" method="POST" class="auth-form" autocomplete="off">
                <div class="form-group">
                    <label for="email" class="form-label">Correo Electrónico</label>
                    <div class="input-icon-wrap">
                        <input type="email" id="email" name="email" class="form-control" placeholder="admin@nailartist.com" required value="<?= htmlspecialchars($_POST['email'] ?? 'admin@nailartist.com') ?>">
                        <span class="input-icon">✉️</span>
                    </div>
                </div>

                <div class="form-group">
                    <label for="password" class="form-label">Contraseña</label>
                    <div class="input-icon-wrap">
                        <input type="password" id="password" name="password" class="form-control" placeholder="••••••••" required>
                        <span class="input-icon">🔒</span>
                    </div>
                </div>

                <div class="form-help-row">
                    <span class="credential-tip">💡 Credencial por defecto: <strong>admin@nailartist.com</strong> / <strong>admin123</strong></span>
                </div>

                <button type="submit" class="btn-primary btn-block">
                    <span>Acceder al Panel</span>
                    <span class="btn-arrow">→</span>
                </button>
            </form>

            <div class="auth-footer">
                <a href="../index.html" class="back-link">
                    <span>← Volver al sitio web principal</span>
                </a>
            </div>

        </div>
    </div>

</body>
</html>
