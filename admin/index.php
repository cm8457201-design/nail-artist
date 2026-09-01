<?php
/**
 * NailArtist Studio — Dashboard Principal
 */

$pageTitle = 'Dashboard';
$pageHeading = 'Panel de Control & Métricas';

require_once __DIR__ . '/header.php';

$pdo = Database::getConnection();

// 1. Estadísticas Generales (KPIs)
$totalUsuarios = 0;
$totalClientes = 0;
$totalManicuristas = 0;
$totalServicios = 0;
$totalCitas = 0;
$totalCitasPendientes = 0;
$totalCitasConfirmadas = 0;
$totalCitasCompletadas = 0;
$ingresosTotalesBs = 0.00;
$promedioCalificacion = 5.0;
$totalMensajes = 0;

try {
    // Usuarios
    $totalUsuarios = (int)$pdo->query("SELECT COUNT(*) FROM usuarios")->fetchColumn();
    $totalClientes = (int)$pdo->query("SELECT COUNT(*) FROM usuarios WHERE rol_id = 2")->fetchColumn();
    $totalManicuristas = (int)$pdo->query("SELECT COUNT(*) FROM usuarios WHERE rol_id = 3")->fetchColumn();

    // Servicios
    $totalServicios = (int)$pdo->query("SELECT COUNT(*) FROM servicios WHERE estado = 'activo'")->fetchColumn();

    // Citas
    $totalCitas = (int)$pdo->query("SELECT COUNT(*) FROM citas")->fetchColumn();
    $totalCitasPendientes = (int)$pdo->query("SELECT COUNT(*) FROM citas WHERE estado = 'Pendiente'")->fetchColumn();
    $totalCitasConfirmadas = (int)$pdo->query("SELECT COUNT(*) FROM citas WHERE estado = 'Confirmada'")->fetchColumn();
    $totalCitasCompletadas = (int)$pdo->query("SELECT COUNT(*) FROM citas WHERE estado = 'Completada'")->fetchColumn();

    // Ingresos estimados en Bs.
    $ingresosTotalesBs = (float)$pdo->query("SELECT COALESCE(SUM(total_final_bs), 0) FROM citas WHERE estado IN ('Confirmada', 'Completada')")->fetchColumn();

    // Calificación
    $promedioCalificacion = (float)$pdo->query("SELECT COALESCE(AVG(calificacion), 5.0) FROM resenas WHERE publicado = 1")->fetchColumn();

    // Mensajes
    $totalMensajes = (int)$pdo->query("SELECT COUNT(*) FROM contactos")->fetchColumn();

    // 2. Últimas 5 Citas Recientes
    $stmtUltimasCitas = $pdo->query("SELECT c.*, u.nombre AS cliente_nombre, u.apellido AS cliente_apellido, u.telefono AS cliente_telefono
                                     FROM citas c
                                     INNER JOIN usuarios u ON c.usuario_id = u.id
                                     ORDER BY c.id DESC LIMIT 5");
    $ultimasCitas = $stmtUltimasCitas->fetchAll();

    // 3. Últimos 4 Mensajes de Contacto
    $stmtUltimosMsgs = $pdo->query("SELECT * FROM contactos ORDER BY id DESC LIMIT 4");
    $ultimosMensajes = $stmtUltimosMsgs->fetchAll();

    // 4. Últimas Reseñas
    $stmtUltimasRes = $pdo->query("SELECT r.*, u.nombre AS usuario_nombre, s.nombre AS servicio_nombre
                                   FROM resenas r
                                   INNER JOIN usuarios u ON r.usuario_id = u.id
                                   LEFT JOIN servicios s ON r.servicio_id = s.id
                                   ORDER BY r.id DESC LIMIT 3");
    $ultimasResenas = $stmtUltimasRes->fetchAll();

} catch (Exception $e) {
    $errorDb = $e->getMessage();
}
?>

<!-- Grid de Métricas Principales (KPI Cards) -->
<div class="stats-grid">
    
    <!-- Total Usuarios -->
    <div class="stat-card">
        <div class="stat-icon pink">👥</div>
        <div class="stat-data">
            <span class="stat-label">Total Usuarios</span>
            <span class="stat-value"><?= number_format($totalUsuarios) ?></span>
            <span class="stat-sub">💖 <?= $totalClientes ?> Clientas VIP &nbsp;|&nbsp; 👑 <?= $totalUsuarios - $totalClientes - $totalManicuristas ?> Admins</span>
        </div>
    </div>

    <!-- Manicuristas Activas -->
    <div class="stat-card">
        <div class="stat-icon purple">💅</div>
        <div class="stat-data">
            <span class="stat-label">Manicuristas</span>
            <span class="stat-value"><?= number_format($totalManicuristas) ?></span>
            <span class="stat-sub">Especialistas de Estudio</span>
        </div>
    </div>

    <!-- Servicios en Catálogo -->
    <div class="stat-card">
        <div class="stat-icon gold">✨</div>
        <div class="stat-data">
            <span class="stat-label">Servicios Activos</span>
            <span class="stat-value"><?= number_format($totalServicios) ?></span>
            <span class="stat-sub">En catálogo oficial</span>
        </div>
    </div>

    <!-- Total Citas & Reservas -->
    <div class="stat-card">
        <div class="stat-icon green">📅</div>
        <div class="stat-data">
            <span class="stat-label">Total Citas</span>
            <span class="stat-value"><?= number_format($totalCitas) ?></span>
            <span class="stat-sub">⏳ <?= $totalCitasPendientes ?> Pendientes &nbsp;|&nbsp; ✅ <?= $totalCitasConfirmadas + $totalCitasCompletadas ?> Activas</span>
        </div>
    </div>

</div>

<!-- Segunda Fila de Métricas: Ingresos y Calificación -->
<div class="stats-grid" style="grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));">
    <div class="stat-card" style="background: linear-gradient(135deg, #240e1b 0%, #3d142f 100%); color: #ffffff;">
        <div class="stat-icon" style="background: var(--gold-gradient); color: #170914;">💰</div>
        <div class="stat-data">
            <span class="stat-label" style="color: var(--pink-soft);">Ingresos Estimados Confirmados</span>
            <span class="stat-value" style="color: #ffffff;">Bs. <?= number_format($ingresosTotalesBs, 2) ?></span>
            <span class="stat-sub" style="color: rgba(255,255,255,0.7);">Cálculo sobre citas confirmadas y completadas</span>
        </div>
    </div>

    <div class="stat-card" style="background: linear-gradient(135deg, #fff0f6 0%, #ffffff 100%);">
        <div class="stat-icon gold">⭐</div>
        <div class="stat-data">
            <span class="stat-label">Calificación Promedio</span>
            <span class="stat-value" style="color: var(--text-main);"><?= number_format($promedioCalificacion, 1) ?> / 5.0</span>
            <span class="stat-sub">Basado en reseñas publicadas de clientas</span>
        </div>
    </div>
</div>

<!-- Sección: Últimas Citas Recibidas -->
<div class="admin-card">
    <div class="card-header">
        <h3 class="card-title">📅 Últimas Citas y Reservas Recibidas</h3>
        <div class="card-actions">
            <a href="citas.php" class="btn-action">Ver Todas las Citas →</a>
        </div>
    </div>
    <div class="card-body" style="padding: 0;">
        <div class="table-responsive">
            <table class="admin-table">
                <thead>
                    <tr>
                        <th>Código</th>
                        <th>Cliente</th>
                        <th>Fecha & Hora</th>
                        <th>Total</th>
                        <th>Estado Actual</th>
                        <th>Acción Rápida</th>
                    </tr>
                </thead>
                <tbody>
                    <?php if (empty($ultimasCitas)): ?>
                        <tr>
                            <td colspan="6" style="text-align: center; padding: 30px; color: var(--text-muted);">
                                No hay citas registradas en la base de datos.
                            </td>
                        </tr>
                    <?php else: ?>
                        <?php foreach ($ultimasCitas as $c): ?>
                            <tr>
                                <td>
                                    <strong style="color: var(--pink-vivid);"><?= htmlspecialchars($c['codigo_reserva']) ?></strong>
                                </td>
                                <td>
                                    <div style="font-weight: 700; color: var(--text-main);">
                                        <?= htmlspecialchars($c['cliente_nombre'] . ' ' . ($c['cliente_apellido'] ?? '')) ?>
                                    </div>
                                    <div style="font-size: 0.8rem; color: var(--text-muted);">
                                        📞 <?= htmlspecialchars($c['cliente_telefono'] ?? 'Sin teléfono') ?>
                                    </div>
                                </td>
                                <td>
                                    <div>📅 <?= htmlspecialchars($c['fecha_cita']) ?></div>
                                    <div style="font-size: 0.8rem; color: var(--text-muted);">⏰ <?= substr($c['hora_cita'], 0, 5) ?></div>
                                </td>
                                <td>
                                    <strong>Bs. <?= number_format($c['total_final_bs'], 2) ?></strong>
                                </td>
                                <td>
                                    <?php
                                    $badgeClass = 'badge-pendiente';
                                    if ($c['estado'] === 'Confirmada') $badgeClass = 'badge-confirmada';
                                    if ($c['estado'] === 'Completada') $badgeClass = 'badge-completada';
                                    if ($c['estado'] === 'Cancelada') $badgeClass = 'badge-cancelada';
                                    ?>
                                    <span id="badge-cita-<?= $c['id'] ?>" class="badge <?= $badgeClass ?>">
                                        <?= htmlspecialchars($c['estado']) ?>
                                    </span>
                                </td>
                                <td>
                                    <select class="filter-select" style="padding: 4px 10px; font-size: 0.82rem;" onchange="cambiarEstadoCitaDashboard(<?= $c['id'] ?>, this.value)">
                                        <option value="Pendiente" <?= $c['estado'] === 'Pendiente' ? 'selected' : '' ?>>Pendiente</option>
                                        <option value="Confirmada" <?= $c['estado'] === 'Confirmada' ? 'selected' : '' ?>>Confirmada</option>
                                        <option value="Completada" <?= $c['estado'] === 'Completada' ? 'selected' : '' ?>>Completada</option>
                                        <option value="Cancelada" <?= $c['estado'] === 'Cancelada' ? 'selected' : '' ?>>Cancelada</option>
                                    </select>
                                </td>
                            </tr>
                        <?php endforeach; ?>
                    <?php endif; ?>
                </tbody>
            </table>
        </div>
    </div>
</div>

<!-- Fila de 2 Columnas: Mensajes Recientes & Reseñas -->
<div class="form-grid-2">

    <!-- Mensajes Recientes -->
    <div class="admin-card">
        <div class="card-header">
            <h3 class="card-title">💌 Mensajes de Contacto</h3>
            <a href="mensajes.php" class="btn-action">Ver Bandeja →</a>
        </div>
        <div class="card-body">
            <?php if (empty($ultimosMensajes)): ?>
                <p style="text-align: center; color: var(--text-muted); padding: 20px;">No hay mensajes nuevos.</p>
            <?php else: ?>
                <div style="display: flex; flex-direction: column; gap: 14px;">
                    <?php foreach ($ultimosMensajes as $m): ?>
                        <div style="background: var(--bg-surface-soft); padding: 12px 16px; border-radius: var(--radius-md); border-left: 3px solid <?= $m['leido'] ? '#cbd5e1' : 'var(--pink-vivid)' ?>;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                                <strong style="font-size: 0.9rem; color: var(--text-main);"><?= htmlspecialchars($m['nombre']) ?></strong>
                                <span style="font-size: 0.75rem; color: var(--text-muted);"><?= substr($m['fecha_envio'], 0, 10) ?></span>
                            </div>
                            <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                                "<?= htmlspecialchars($m['mensaje']) ?>"
                            </p>
                            <div style="font-size: 0.78rem; color: var(--pink-vivid);">
                                ✉️ <?= htmlspecialchars($m['email']) ?>
                            </div>
                        </div>
                    <?php endforeach; ?>
                </div>
            <?php endif; ?>
        </div>
    </div>

    <!-- Últimas Reseñas -->
    <div class="admin-card">
        <div class="card-header">
            <h3 class="card-title">⭐ Testimonios & Reseñas</h3>
            <a href="resenas.php" class="btn-action">Gestionar →</a>
        </div>
        <div class="card-body">
            <?php if (empty($ultimasResenas)): ?>
                <p style="text-align: center; color: var(--text-muted); padding: 20px;">No hay reseñas aún.</p>
            <?php else: ?>
                <div style="display: flex; flex-direction: column; gap: 14px;">
                    <?php foreach ($ultimasResenas as $r): ?>
                        <div style="background: var(--bg-surface-soft); padding: 14px 16px; border-radius: var(--radius-md);">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                                <strong style="font-size: 0.9rem; color: var(--text-main);">
                                    <?= htmlspecialchars($r['usuario_nombre']) ?>
                                    <span style="font-weight: normal; font-size: 0.8rem; color: var(--text-muted);">
                                        sobre <em><?= htmlspecialchars($r['servicio_nombre'] ?? 'Estudio') ?></em>
                                    </span>
                                </strong>
                                <span style="color: #e5a93b; font-size: 0.9rem;">
                                    <?= str_repeat('★', (int)$r['calificacion']) ?><?= str_repeat('☆', 5 - (int)$r['calificacion']) ?>
                                </span>
                            </div>
                            <p style="font-size: 0.86rem; color: var(--text-muted); font-style: italic;">
                                "<?= htmlspecialchars($r['comentario']) ?>"
                            </p>
                        </div>
                    <?php endforeach; ?>
                </div>
            <?php endif; ?>
        </div>
    </div>

</div>

<script>
async function cambiarEstadoCitaDashboard(citaId, nuevoEstado) {
    const res = await apiAdminRequest('cita_cambiar_estado', { id: citaId, estado: nuevoEstado });
    if (res.success) {
        showAdminToast(res.message, 'success');
        const badge = document.getElementById(`badge-cita-${citaId}`);
        if (badge) {
            badge.innerText = nuevoEstado;
            badge.className = 'badge';
            if (nuevoEstado === 'Pendiente') badge.classList.add('badge-pendiente');
            if (nuevoEstado === 'Confirmada') badge.classList.add('badge-confirmada');
            if (nuevoEstado === 'Completada') badge.classList.add('badge-completada');
            if (nuevoEstado === 'Cancelada') badge.classList.add('badge-cancelada');
        }
    } else {
        showAdminToast(res.message || 'Error al actualizar estado', 'error');
    }
}
</script>

<?php
require_once __DIR__ . '/footer.php';
?>
