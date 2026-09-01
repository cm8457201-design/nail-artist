<?php
/**
 * NailArtist Studio — Gestión de Reseñas y Testimonios
 */

$pageTitle = 'Reseñas';
$pageHeading = 'Gestión de Reseñas & Testimonios';

require_once __DIR__ . '/header.php';

$pdo = Database::getConnection();

$stmtRes = $pdo->query("SELECT r.*, u.nombre AS usuario_nombre, u.apellido AS usuario_apellido, 
                               u.email AS usuario_email, s.nombre AS servicio_nombre
                        FROM resenas r
                        INNER JOIN usuarios u ON r.usuario_id = u.id
                        LEFT JOIN servicios s ON r.servicio_id = s.id
                        ORDER BY r.id DESC");
$resenas = $stmtRes->fetchAll();
?>

<div class="admin-card">
    <div class="card-header">
        <h3 class="card-title">⭐ Testimonios & Calificaciones de Clientas</h3>
    </div>

    <div class="card-body">

        <!-- Filtros -->
        <div class="filter-bar">
            <input type="text" class="search-input" data-table-search="tabla-resenas" placeholder="🔍 Buscar reseña por clienta, comentario o servicio...">
            
            <select class="filter-select" id="filtro-estrellas" onchange="filtrarResenas()">
                <option value="">Todas las Estrellas</option>
                <option value="5">⭐⭐⭐⭐⭐ 5 Estrellas</option>
                <option value="4">⭐⭐⭐⭐ 4 Estrellas</option>
                <option value="3">⭐⭐⭐ 3 Estrellas</option>
                <option value="2">⭐⭐ 2 Estrellas</option>
                <option value="1">⭐ 1 Estrella</option>
            </select>
        </div>

        <!-- Tabla de Reseñas -->
        <div class="table-responsive">
            <table class="admin-table" id="tabla-resenas">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Clienta</th>
                        <th>Servicio</th>
                        <th>Calificación</th>
                        <th>Comentario</th>
                        <th>Fecha</th>
                        <th>Visibilidad</th>
                        <th>Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    <?php if (empty($resenas)): ?>
                        <tr>
                            <td colspan="8" style="text-align: center; padding: 30px; color: var(--text-muted);">
                                No hay reseñas registradas en la base de datos.
                            </td>
                        </tr>
                    <?php else: ?>
                        <?php foreach ($resenas as $r): ?>
                            <tr data-calif="<?= $r['calificacion'] ?>" id="fila-resena-<?= $r['id'] ?>">
                                <td><strong>#<?= $r['id'] ?></strong></td>
                                <td>
                                    <div style="font-weight: 700; color: var(--text-main);">
                                        <?= htmlspecialchars($r['usuario_nombre'] . ' ' . ($r['usuario_apellido'] ?? '')) ?>
                                    </div>
                                    <div style="font-size: 0.78rem; color: var(--text-muted);">
                                        <?= htmlspecialchars($r['usuario_email']) ?>
                                    </div>
                                </td>
                                <td>
                                    <span style="font-weight: 600; color: var(--pink-vivid);">
                                        💅 <?= htmlspecialchars($r['servicio_nombre'] ?? 'Estudio General') ?>
                                    </span>
                                </td>
                                <td>
                                    <div style="color: #e5a93b; font-size: 1rem; letter-spacing: 2px;">
                                        <?= str_repeat('★', (int)$r['calificacion']) ?><?= str_repeat('☆', 5 - (int)$r['calificacion']) ?>
                                    </div>
                                </td>
                                <td>
                                    <div style="font-style: italic; max-width: 320px; font-size: 0.88rem; color: var(--text-main);">
                                        "<?= htmlspecialchars($r['comentario']) ?>"
                                    </div>
                                </td>
                                <td>
                                    <span style="font-size: 0.8rem; color: var(--text-muted);">
                                        <?= substr($r['fecha_resena'], 0, 10) ?>
                                    </span>
                                </td>
                                <td>
                                    <span id="badge-res-<?= $r['id'] ?>" class="badge <?= $r['publicado'] ? 'badge-activo' : 'badge-inactivo' ?>">
                                        <?= $r['publicado'] ? 'Publicado' : 'Oculto' ?>
                                    </span>
                                </td>
                                <td>
                                    <div style="display: flex; gap: 6px;">
                                        <button class="btn-action" onclick="togglePublicacionResena(<?= $r['id'] ?>, <?= $r['publicado'] ? 0 : 1 ?>)" id="btn-toggle-<?= $r['id'] ?>">
                                            <?= $r['publicado'] ? '🙈 Ocultar' : '👁️ Publicar' ?>
                                        </button>
                                        <button class="btn-action delete" onclick="eliminarResena(<?= $r['id'] ?>)" title="Eliminar Reseña">
                                            🗑️
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        <?php endforeach; ?>
                    <?php endif; ?>
                </tbody>
            </table>
        </div>

    </div>
</div>

<script>
function filtrarResenas() {
    const starVal = document.getElementById('filtro-estrellas').value;
    const filas = document.querySelectorAll('#tabla-resenas tbody tr');

    filas.forEach(fila => {
        const calif = fila.getAttribute('data-calif') || '';
        fila.style.display = (!starVal || calif === starVal) ? '' : 'none';
    });
}

async function togglePublicacionResena(id, nuevoEstado) {
    const res = await apiAdminRequest('resena_toggle_publicado', { id: id, publicado: nuevoEstado });
    if (res.success) {
        showAdminToast(res.message, 'success');
        const badge = document.getElementById(`badge-res-${id}`);
        const btn = document.getElementById(`btn-toggle-${id}`);
        if (badge && btn) {
            if (nuevoEstado === 1) {
                badge.innerText = 'Publicado';
                badge.className = 'badge badge-activo';
                btn.innerHTML = '🙈 Ocultar';
                btn.setAttribute('onclick', `togglePublicacionResena(${id}, 0)`);
            } else {
                badge.innerText = 'Oculto';
                badge.className = 'badge badge-inactivo';
                btn.innerHTML = '👁️ Publicar';
                btn.setAttribute('onclick', `togglePublicacionResena(${id}, 1)`);
            }
        }
    } else {
        showAdminToast(res.message || 'Error al cambiar publicación', 'error');
    }
}

async function eliminarResena(id) {
    if (!confirm('¿Deseas eliminar permanentemente este testimonio de la base de datos?')) {
        return;
    }

    const res = await apiAdminRequest('resena_eliminar', { id: id });
    if (res.success) {
        showAdminToast(res.message, 'success');
        const fila = document.getElementById(`fila-resena-${id}`);
        if (fila) fila.remove();
    } else {
        showAdminToast(res.message, 'error');
    }
}
</script>

<?php
require_once __DIR__ . '/footer.php';
?>
