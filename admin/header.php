<?php
/**
 * NailArtist Studio — Encabezado y Barra Lateral Administrativa
 */

require_once __DIR__ . '/../config/conexion.php';
require_once __DIR__ . '/auth_check.php';

// Validar privilegios de administrador antes de renderizar cualquier vista
requerirAdmin();

$admin = $_SESSION['admin_user'];
$currentPage = basename($_SERVER['PHP_SELF']);

// Obtener contadores para insignias de la barra lateral
$pdo = Database::getConnection();

$countCitasPendientes = 0;
$countMensajesNoLeidos = 0;

try {
    $stmtCitasBadge = $pdo->query("SELECT COUNT(*) AS total FROM citas WHERE estado = 'Pendiente'");
    $countCitasPendientes = (int)$stmtCitasBadge->fetchColumn();

    $stmtMsgsBadge = $pdo->query("SELECT COUNT(*) AS total FROM contactos WHERE leido = 0");
    $countMensajesNoLeidos = (int)$stmtMsgsBadge->fetchColumn();
} catch (Exception $e) {
    // Silencioso en caso de error temporal
}
?>
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?= $pageTitle ?? 'Panel de Administración' ?> — NailArtist Studio</title>
    
    <!-- Google Fonts -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400..900;1,400..900&family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
    
    <!-- Estilos del Administrador -->
    <link rel="stylesheet" href="assets/css/admin.css">
</head>
<body>

<div class="admin-container">

    <!-- Overlay para móvil -->
    <div id="sidebar-overlay" class="modal-overlay"></div>

    <!-- Barra Lateral (Sidebar) -->
    <aside id="admin-sidebar" class="admin-sidebar">
        
        <div class="sidebar-header">
            <a href="index.php" class="sidebar-logo">
                <svg class="logo-spiral-icon" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M50 8 C26.8 8 8 26.8 8 50 C8 73.2 26.8 92 50 92 C73.2 92 92 73.2 92 50 C92 31.5 80 16 62.5 11.5 C41.5 6.1 20.8 18.2 15.4 39.2 C10 60.2 22.1 80.9 43.1 86.3 C64.1 91.7 84.8 79.6 90.2 58.6 C94.5 41.8 84.5 24.5 67.7 20.2 C52.5 16.3 36.8 24.8 32.9 40 C29 55.2 37.5 70.9 52.7 74.8 C66.5 78.3 80.5 70 83.2 56 C85.5 44 77.5 32.5 65.5 30.2 C54.5 28.1 44 35.5 41.9 46.5 C40 56.5 47 65.5 57 67.4 C65.5 69 73 63 74.5 54.5" stroke="currentColor" stroke-width="5" stroke-linecap="round"/>
                </svg>
                <div class="auth-brand-text">
                    <span class="brand-top">NAILS</span>
                    <span class="brand-bottom">ARTIST</span>
                </div>
            </a>
            <span class="sidebar-badge">👑 PANEL ADMIN</span>
        </div>

        <nav class="sidebar-nav">
            <div class="nav-section-title">Principal</div>
            <ul class="nav-list">
                <li>
                    <a href="index.php" class="nav-link <?= $currentPage === 'index.php' ? 'active' : '' ?>">
                        <span class="nav-icon">📊</span>
                        <span>Dashboard</span>
                    </a>
                </li>
            </ul>

            <div class="nav-section-title">Gestión de Negocio</div>
            <ul class="nav-list">
                <li>
                    <a href="citas.php" class="nav-link <?= $currentPage === 'citas.php' ? 'active' : '' ?>">
                        <span class="nav-icon">📅</span>
                        <span>Citas & Reservas</span>
                        <?php if ($countCitasPendientes > 0): ?>
                            <span class="nav-badge"><?= $countCitasPendientes ?></span>
                        <?php endif; ?>
                    </a>
                </li>
                <li>
                    <a href="servicios.php" class="nav-link <?= $currentPage === 'servicios.php' ? 'active' : '' ?>">
                        <span class="nav-icon">💅</span>
                        <span>Servicios & Precios</span>
                    </a>
                </li>
                <li>
                    <a href="usuarios.php" class="nav-link <?= $currentPage === 'usuarios.php' ? 'active' : '' ?>">
                        <span class="nav-icon">👥</span>
                        <span>Usuarios & Roles</span>
                    </a>
                </li>
            </ul>

            <div class="nav-section-title">Interacción & Feedback</div>
            <ul class="nav-list">
                <li>
                    <a href="resenas.php" class="nav-link <?= $currentPage === 'resenas.php' ? 'active' : '' ?>">
                        <span class="nav-icon">⭐</span>
                        <span>Reseñas & Opiniones</span>
                    </a>
                </li>
                <li>
                    <a href="mensajes.php" class="nav-link <?= $currentPage === 'mensajes.php' ? 'active' : '' ?>">
                        <span class="nav-icon">💌</span>
                        <span>Mensajes de Contacto</span>
                        <?php if ($countMensajesNoLeidos > 0): ?>
                            <span class="nav-badge"><?= $countMensajesNoLeidos ?></span>
                        <?php endif; ?>
                    </a>
                </li>
            </ul>
        </nav>

        <div class="sidebar-footer">
            <div class="user-profile-widget">
                <div class="user-avatar">
                    <?= strtoupper(substr($admin['nombre'] ?? 'A', 0, 1)) ?>
                </div>
                <div class="user-info">
                    <div class="user-name"><?= htmlspecialchars(($admin['nombre'] ?? 'Admin') . ' ' . ($admin['apellido'] ?? '')) ?></div>
                    <div class="user-role">👑 <?= htmlspecialchars($admin['rol'] ?? 'Administrador') ?></div>
                </div>
                <a href="logout.php" class="btn-logout" title="Cerrar Sesión">
                    🚪
                </a>
            </div>
        </div>

    </aside>

    <!-- Contenedor Principal -->
    <div class="admin-main">

        <!-- Barra Superior (Topbar) -->
        <header class="admin-topbar">
            <div class="topbar-left">
                <button id="mobile-sidebar-toggle" class="mobile-toggle-btn" aria-label="Abrir Menú">☰</button>
                <h2 class="page-title"><?= $pageHeading ?? 'Panel de Control' ?></h2>
            </div>
            <div class="topbar-right">
                <a href="../index.html" target="_blank" class="btn-view-site">
                    <span>🌐 Ver Sitio Web</span>
                    <span>↗</span>
                </a>
            </div>
        </header>

        <!-- Área de Contenido Dinámico -->
        <main class="admin-content">
