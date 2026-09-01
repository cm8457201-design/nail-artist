<?php
/**
 * NailArtist Studio — Gestión de Citas y Reservas
 */

$pageTitle = 'Citas & Reservas';
$pageHeading = 'Gestión de Citas & Agenda';

require_once __DIR__ . '/header.php';

$pdo = Database::getConnection();

// Obtener citas con datos del cliente
$stmtCitas = $pdo->query("SELECT c.*, u.nombre AS cliente_nombre, u.apellido AS cliente_apellido, 
                                 u.email AS cliente_email, u.telefono AS cliente_telefono
                          FROM citas c
                          INNER JOIN usuarios u ON c.usuario_id = u.id
                          ORDER BY c.id DESC");
$citas = $stmtCitas->fetchAll();
?>

<div class="admin-card">
    <div class="card-header">
        <h3 class="card-title">📅 Agenda Oficial de Citas & Reservas</h3>
    </div>

    <div class="card-body">

        <!-- Barra de Filtros -->
        <div class="filter-bar">
            <input type="text" class="search-input" data-table-search="tabla-citas" placeholder="🔍 Buscar por código de reserva, clienta o teléfono...">
            
            <select class="filter-select" id="filtro-estado-citas" onchange="filtrarCitas()">
                <option value="">Todos los Estados</option>
                <option value="Pendiente">⏳ Pendientes</option>
                <option value="Confirmada">✅ Confirmadas</option>
                <option value="Completada">🎉 Completadas</option>
                <option value="Cancelada">❌ Canceladas</option>
            </select>
        </div>

        <!-- Tabla de Citas -->
        <div class="table-responsive">
            <table class="admin-table" id="tabla-citas">
                <thead>
                    <tr>
                        <th>Código</th>
                        <th>Clienta</th>
                        <th>Fecha & Hora</th>
                        <th>Total Final</th>
                        <th>Método</th>
                        <th>Estado Actual</th>
                        <th>Cambiar Estado</th>
                        <th>Acción</th>
                    </tr>
                </thead>
                <tbody>
                    <?php if (empty($citas)): ?>
                        <tr>
                            <td colspan="8" style="text-align: center; padding: 30px; color: var(--text-muted);">
                                No hay citas registradas en el sistema.
                            </td>
                        </tr>
                    <?php else: ?>
                        <?php foreach ($citas as $c): ?>
                            <tr data-estado="<?= htmlspecialchars($c['estado']) ?>" id="fila-cita-<?= $c['id'] ?>">
                                <td>
                                    <strong style="color: var(--pink-vivid); font-family: var(--font-title); font-size: 1.05rem;">
                                        <?= htmlspecialchars($c['codigo_reserva']) ?>
                                    </strong>
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
                                    <div>📅 <strong><?= htmlspecialchars($c['fecha_cita']) ?></strong></div>
                                    <div style="font-size: 0.82rem; color: var(--text-muted);">⏰ <?= substr($c['hora_cita'], 0, 5) ?> hrs</div>
                                </td>
                                <td>
                                    <strong style="font-size: 1rem; color: var(--text-main);">
                                        Bs. <?= number_format($c['total_final_bs'], 2) ?>
                                    </strong>
                                    <?php if ($c['descuento_aplicado'] > 0): ?>
                                        <div style="font-size: 0.75rem; color: #15803d;">
                                            - Bs. <?= number_format($c['descuento_aplicado'], 2) ?> (Desc. VIP)
                                        </div>
                                    <?php endif; ?>
                                </td>
                                <td>
                                    <span class="badge" style="background: #e0f2fe; color: #0369a1;">
                                        💬 <?= htmlspecialchars($c['metodo_contacto'] ?? 'WhatsApp') ?>
                                    </span>
                                </td>
                                <td>
                                    <?php
                                    $bClass = 'badge-pendiente';
                                    if ($c['estado'] === 'Confirmada') $bClass = 'badge-confirmada';
                                    if ($c['estado'] === 'Completada') $bClass = 'badge-completada';
                                    if ($c['estado'] === 'Cancelada') $bClass = 'badge-cancelada';
                                    ?>
                                    <span id="badge-page-cita-<?= $c['id'] ?>" class="badge <?= $bClass ?>">
                                        <?= htmlspecialchars($c['estado']) ?>
                                    </span>
                                </td>
                                <td>
                                    <select class="filter-select" style="padding: 6px 12px; font-size: 0.85rem;" onchange="actualizarEstadoCita(<?= $c['id'] ?>, this.value)">
                                        <option value="Pendiente" <?= $c['estado'] === 'Pendiente' ? 'selected' : '' ?>>⏳ Pendiente</option>
                                        <option value="Confirmada" <?= $c['estado'] === 'Confirmada' ? 'selected' : '' ?>>✅ Confirmada</option>
                                        <option value="Completada" <?= $c['estado'] === 'Completada' ? 'selected' : '' ?>>🎉 Completada</option>
                                        <option value="Cancelada" <?= $c['estado'] === 'Cancelada' ? 'selected' : '' ?>>❌ Cancelada</option>
                                    </select>
                                </td>
                                <td>
                                    <button class="btn-action" onclick="verDetalleCita(<?= $c['id'] ?>)" title="Ver servicios y observaciones">
                                        👁️ Ver Detalle
                                    </button>
                                </td>
                            </tr>
                        <?php endforeach; ?>
                    <?php endif; ?>
                </tbody>
            </table>
        </div>

    </div>
</div>

<!-- ========================================================================= -->
<!-- MODAL: DETALLE DE CITA                                                    -->
<!-- ========================================================================= -->
<div id="modal-detalle-cita" class="modal-overlay">
    <div class="modal-card" style="max-width: 650px;">
        <div class="modal-header">
            <h3 class="modal-title">📋 Detalle de la Reserva <span id="modal-reserva-codigo" style="color: var(--pink-vivid);"></span></h3>
            <button class="modal-close" data-close-modal>✕</button>
        </div>
        <div class="modal-body" id="modal-detalle-body">
            <!-- Cargado dinámicamente vía AJAX -->
            <div style="text-align: center; padding: 20px;">Cargando información...</div>
        </div>
        <div class="modal-footer">
            <button type="button" class="btn-action" data-close-modal>Cerrar</button>
        </div>
    </div>
</div>

<script>
function filtrarCitas() {
    const estadoVal = document.getElementById('filtro-estado-citas').value.toLowerCase();
    const filas = document.querySelectorAll('#tabla-citas tbody tr');

    filas.forEach(fila => {
        const estado = (fila.getAttribute('data-estado') || '').toLowerCase();
        fila.style.display = (!estadoVal || estado === estadoVal) ? '' : 'none';
    });
}

async function actualizarEstadoCita(citaId, nuevoEstado) {
    const res = await apiAdminRequest('cita_cambiar_estado', { id: citaId, estado: nuevoEstado });
    if (res.success) {
        showAdminToast(res.message, 'success');
        const badge = document.getElementById(`badge-page-cita-${citaId}`);
        const fila = document.getElementById(`fila-cita-${citaId}`);
        if (fila) fila.setAttribute('data-estado', nuevoEstado);
        if (badge) {
            badge.innerText = nuevoEstado;
            badge.className = 'badge';
            if (nuevoEstado === 'Pendiente') badge.classList.add('badge-pendiente');
            if (nuevoEstado === 'Confirmada') badge.classList.add('badge-confirmada');
            if (nuevoEstado === 'Completada') badge.classList.add('badge-completada');
            if (nuevoEstado === 'Cancelada') badge.classList.add('badge-cancelada');
        }
    } else {
        showAdminToast(res.message || 'Error al cambiar estado', 'error');
    }
}

async function verDetalleCita(citaId) {
    openAdminModal('modal-detalle-cita');
    const body = document.getElementById('modal-detalle-body');
    body.innerHTML = '<div style="text-align:center; padding: 30px;">⏳ Cargando servicios de la reserva...</div>';

    const res = await apiAdminRequest('cita_detalle', { id: citaId });
    if (res.success && res.data) {
        const c = res.data;
        document.getElementById('modal-reserva-codigo').innerText = `#${c.codigo_reserva}`;

        let serviciosHtml = '';
        if (c.servicios && c.servicios.length > 0) {
            c.servicios.forEach(s => {
                serviciosHtml += `
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid var(--border-light);">
                        <div>
                            <strong>💅 ${s.servicio_nombre}</strong>
                            <div style="font-size: 0.8rem; color: var(--text-muted);">Cantidad: x${s.cantidad} &nbsp;•&nbsp; Precio Unitario: Bs. ${s.precio_unitario}</div>
                        </div>
                        <div style="font-weight: 800; color: var(--pink-vivid);">
                            Bs. ${s.subtotal}
                        </div>
                    </div>
                `;
            });
        } else {
            serviciosHtml = '<p style="color: var(--text-muted);">Sin desglose de servicios individuales.</p>';
        }

        body.innerHTML = `
            <div style="background: var(--bg-surface-soft); padding: 16px; border-radius: var(--radius-md); margin-bottom: 20px;">
                <div class="form-grid-2">
                    <div>
                        <div style="font-size: 0.8rem; color: var(--text-muted);">CLIENTA</div>
                        <div style="font-weight: 800; font-size: 1rem; color: var(--text-main);">${c.cliente_nombre} ${c.cliente_apellido || ''}</div>
                        <div style="font-size: 0.85rem;">📞 ${c.cliente_telefono || 'No registrado'}</div>
                        <div style="font-size: 0.85rem;">✉️ ${c.cliente_email}</div>
                    </div>
                    <div>
                        <div style="font-size: 0.8rem; color: var(--text-muted);">HORARIO DE CITA</div>
                        <div style="font-weight: 800; font-size: 1rem; color: var(--text-main);">📅 ${c.fecha_cita}</div>
                        <div style="font-size: 0.9rem;">⏰ ${c.hora_cita.substring(0, 5)} hrs</div>
                        <div style="margin-top: 4px;"><span class="badge badge-confirmada">${c.estado}</span></div>
                    </div>
                </div>
            </div>

            <div style="margin-bottom: 20px;">
                <h4 style="font-family: var(--font-title); font-size: 1.05rem; margin-bottom: 12px;">Servicios Solicitados</h4>
                ${serviciosHtml}
            </div>

            <div style="background: #ffffff; border: 1.5px solid var(--border-light); padding: 14px; border-radius: var(--radius-md); margin-bottom: 20px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 0.9rem;">
                    <span>Subtotal Servicios:</span>
                    <span>Bs. ${c.total_bs}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 0.9rem; color: #15803d;">
                    <span>Descuento VIP Aplicado:</span>
                    <span>- Bs. ${c.descuento_aplicado}</span>
                </div>
                <div style="display: flex; justify-content: space-between; font-weight: 800; font-size: 1.15rem; color: var(--pink-vivid); border-top: 1px dashed var(--border-light); padding-top: 6px;">
                    <span>Total a Cobrar:</span>
                    <span>Bs. ${c.total_final_bs}</span>
                </div>
            </div>

            <div>
                <h4 style="font-size: 0.85rem; text-transform: uppercase; color: var(--text-muted); margin-bottom: 4px;">Observaciones / Preferencias de la Clienta:</h4>
                <div style="background: var(--bg-surface-soft); padding: 12px; border-radius: var(--radius-sm); font-size: 0.88rem; font-style: italic;">
                    "${c.observaciones ? c.observaciones : 'Sin observaciones especiales registradas.'}"
                </div>
            </div>
        `;
    } else {
        body.innerHTML = '<div style="color: #ef4444; padding: 20px;">Error al cargar detalle de cita.</div>';
    }
}
</script>

<?php
require_once __DIR__ . '/footer.php';
?>
