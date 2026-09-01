<?php
/**
 * NailArtist Studio — Bandeja de Mensajes de Contacto
 */

$pageTitle = 'Mensajes';
$pageHeading = 'Bandeja de Mensajes & Consultas';

require_once __DIR__ . '/header.php';

$pdo = Database::getConnection();

$stmtMsgs = $pdo->query("SELECT * FROM contactos ORDER BY id DESC");
$mensajes = $stmtMsgs->fetchAll();
?>

<div class="admin-card">
    <div class="card-header">
        <h3 class="card-title">💌 Mensajes Recibidos desde la Web</h3>
    </div>

    <div class="card-body">

        <!-- Filtros -->
        <div class="filter-bar">
            <input type="text" class="search-input" data-table-search="tabla-mensajes" placeholder="🔍 Buscar por remitente, correo o texto del mensaje...">
            
            <select class="filter-select" id="filtro-leido" onchange="filtrarMensajes()">
                <option value="">Todos los Mensajes</option>
                <option value="0">📬 No Leídos</option>
                <option value="1">📭 Leídos</option>
            </select>
        </div>

        <!-- Tabla de Mensajes -->
        <div class="table-responsive">
            <table class="admin-table" id="tabla-mensajes">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Remitente</th>
                        <th>Contacto</th>
                        <th>Mensaje</th>
                        <th>Fecha</th>
                        <th>Estado</th>
                        <th>Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    <?php if (empty($mensajes)): ?>
                        <tr>
                            <td colspan="7" style="text-align: center; padding: 30px; color: var(--text-muted);">
                                No hay mensajes en la bandeja de entrada.
                            </td>
                        </tr>
                    <?php else: ?>
                        <?php foreach ($mensajes as $m): ?>
                            <tr data-leido="<?= $m['leido'] ?>" id="fila-msg-<?= $m['id'] ?>" style="<?= !$m['leido'] ? 'background: #fff5f8;' : '' ?>">
                                <td><strong>#<?= $m['id'] ?></strong></td>
                                <td>
                                    <div style="font-weight: 700; color: var(--text-main);">
                                        <?= htmlspecialchars($m['nombre']) ?>
                                    </div>
                                </td>
                                <td>
                                    <div style="font-size: 0.85rem;">✉️ <?= htmlspecialchars($m['email']) ?></div>
                                    <?php if (!empty($m['telefono'])): ?>
                                        <div style="font-size: 0.8rem; color: var(--text-muted);">📞 <?= htmlspecialchars($m['telefono']) ?></div>
                                    <?php endif; ?>
                                </td>
                                <td>
                                    <div style="max-width: 320px; font-size: 0.88rem; color: var(--text-main);">
                                        <?= htmlspecialchars($m['mensaje']) ?>
                                    </div>
                                </td>
                                <td>
                                    <span style="font-size: 0.82rem; color: var(--text-muted);">
                                        <?= $m['fecha_envio'] ?>
                                    </span>
                                </td>
                                <td>
                                    <span id="badge-msg-<?= $m['id'] ?>" class="badge <?= $m['leido'] ? 'badge-inactivo' : 'badge-admin' ?>">
                                        <?= $m['leido'] ? 'Leído' : '📬 No Leído' ?>
                                    </span>
                                </td>
                                <td>
                                    <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                                        <button class="btn-action" onclick="toggleLeido(<?= $m['id'] ?>, <?= $m['leido'] ? 0 : 1 ?>)" id="btn-msg-leido-<?= $m['id'] ?>">
                                            <?= $m['leido'] ? 'Marcar No Leído' : '✔️ Marcar Leído' ?>
                                        </button>
                                        <?php if (!empty($m['telefono'])): ?>
                                            <?php $telClean = preg_replace('/[^0-9]/', '', $m['telefono']); ?>
                                            <a href="https://wa.me/<?= $telClean ?>" target="_blank" class="btn-action" style="color: #16a34a; border-color: #bbf7d0;" title="Responder por WhatsApp">
                                                💬 WhatsApp
                                            </a>
                                        <?php endif; ?>
                                        <a href="mailto:<?= htmlspecialchars($m['email']) ?>?subject=Respuesta NailArtist Studio" class="btn-action" title="Responder por Correo">
                                            ✉️ Email
                                        </a>
                                        <button class="btn-action delete" onclick="eliminarMensaje(<?= $m['id'] ?>)" title="Eliminar Mensaje">
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
function filtrarMensajes() {
    const leidoVal = document.getElementById('filtro-leido').value;
    const filas = document.querySelectorAll('#tabla-mensajes tbody tr');

    filas.forEach(fila => {
        const leido = fila.getAttribute('data-leido') || '';
        fila.style.display = (leidoVal === '' || leido === leidoVal) ? '' : 'none';
    });
}

async function toggleLeido(id, nuevoLeido) {
    const res = await apiAdminRequest('mensaje_marcar_leido', { id: id, leido: nuevoLeido });
    if (res.success) {
        showAdminToast(res.message, 'success');
        const badge = document.getElementById(`badge-msg-${id}`);
        const btn = document.getElementById(`btn-msg-leido-${id}`);
        const fila = document.getElementById(`fila-msg-${id}`);

        if (badge && btn && fila) {
            fila.setAttribute('data-leido', nuevoLeido);
            if (nuevoLeido === 1) {
                badge.innerText = 'Leído';
                badge.className = 'badge badge-inactivo';
                btn.innerHTML = 'Marcar No Leído';
                btn.setAttribute('onclick', `toggleLeido(${id}, 0)`);
                fila.style.background = '';
            } else {
                badge.innerText = '📬 No Leído';
                badge.className = 'badge badge-admin';
                btn.innerHTML = '✔️ Marcar Leído';
                btn.setAttribute('onclick', `toggleLeido(${id}, 1)`);
                fila.style.background = '#fff5f8';
            }
        }
    } else {
        showAdminToast(res.message || 'Error al cambiar estado', 'error');
    }
}

async function eliminarMensaje(id) {
    if (!confirm('¿Deseas eliminar este mensaje de contacto?')) {
        return;
    }

    const res = await apiAdminRequest('mensaje_eliminar', { id: id });
    if (res.success) {
        showAdminToast(res.message, 'success');
        const fila = document.getElementById(`fila-msg-${id}`);
        if (fila) fila.remove();
    } else {
        showAdminToast(res.message, 'error');
    }
}
</script>

<?php
require_once __DIR__ . '/footer.php';
?>
