<?php
/**
 * NailArtist Studio — Gestión de Servicios y Catálogo
 */

$pageTitle = 'Servicios';
$pageHeading = 'Gestión de Servicios & Precios';

require_once __DIR__ . '/header.php';

$pdo = Database::getConnection();

// Obtener categorías oficiales
$categorias = $pdo->query("SELECT * FROM categorias ORDER BY id ASC")->fetchAll();

// Obtener servicios con sus categorías
$stmtServicios = $pdo->query("SELECT s.*, c.nombre AS categoria_nombre 
                             FROM servicios s 
                             INNER JOIN categorias c ON s.categoria_id = c.id 
                             ORDER BY s.id ASC");
$servicios = $stmtServicios->fetchAll();
?>

<div class="admin-card">
    <div class="card-header">
        <h3 class="card-title">💅 Catálogo Oficial de Servicios NailArtist</h3>
        <div class="card-actions">
            <button class="btn-primary btn-sm" onclick="abrirModalCrearServicio()">
                <span>➕ Nuevo Servicio</span>
            </button>
        </div>
    </div>

    <div class="card-body">

        <!-- Barra de Filtros y Búsqueda -->
        <div class="filter-bar">
            <input type="text" class="search-input" data-table-search="tabla-servicios" placeholder="🔍 Buscar servicio por nombre o categoría...">
            
            <select class="filter-select" id="filtro-categoria" onchange="filtrarServicios()">
                <option value="">Todas las Categorías</option>
                <?php foreach ($categorias as $cat): ?>
                    <option value="<?= htmlspecialchars($cat['nombre']) ?>"><?= htmlspecialchars($cat['nombre']) ?></option>
                <?php endforeach; ?>
            </select>

            <select class="filter-select" id="filtro-estado-srv" onchange="filtrarServicios()">
                <option value="">Todos los Estados</option>
                <option value="activo">Activos</option>
                <option value="inactivo">Inactivos</option>
            </select>
        </div>

        <!-- Tabla de Servicios -->
        <div class="table-responsive">
            <table class="admin-table" id="tabla-servicios">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Imagen</th>
                        <th>Servicio</th>
                        <th>Categoría</th>
                        <th>Precio</th>
                        <th>Duración</th>
                        <th>Destacado</th>
                        <th>Estado</th>
                        <th>Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    <?php if (empty($servicios)): ?>
                        <tr>
                            <td colspan="9" style="text-align: center; padding: 30px; color: var(--text-muted);">
                                No hay servicios registrados en el catálogo.
                            </td>
                        </tr>
                    <?php else: ?>
                        <?php foreach ($servicios as $s): ?>
                            <tr data-cat="<?= htmlspecialchars($s['categoria_nombre']) ?>" data-estado="<?= htmlspecialchars($s['estado']) ?>" id="fila-srv-<?= $s['id'] ?>">
                                <td><strong>#<?= $s['id'] ?></strong></td>
                                <td>
                                    <img src="../<?= htmlspecialchars($s['imagen']) ?>" alt="<?= htmlspecialchars($s['nombre']) ?>" class="table-thumb" onerror="this.src='../images/service_acrilicas.jpg'">
                                </td>
                                <td>
                                    <div style="font-weight: 700; color: var(--text-main);">
                                        <?= htmlspecialchars($s['nombre']) ?>
                                    </div>
                                    <div style="font-size: 0.8rem; color: var(--text-muted); max-width: 260px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                                        <?= htmlspecialchars($s['descripcion']) ?>
                                    </div>
                                </td>
                                <td>
                                    <span class="badge" style="background: #fdf2f8; color: #9d174d; border: 1px solid #fbcfe8;">
                                        <?= htmlspecialchars($s['categoria_nombre']) ?>
                                    </span>
                                </td>
                                <td>
                                    <strong style="color: var(--pink-vivid); font-size: 1rem;">
                                        Bs. <?= number_format($s['precio'], 2) ?>
                                    </strong>
                                </td>
                                <td>
                                    <span>⏱️ <?= $s['duracion_minutos'] ?> min</span>
                                </td>
                                <td>
                                    <?php if ($s['destacado']): ?>
                                        <span class="badge" style="background: #fef3c7; color: #b45309;">⭐ Sí</span>
                                    <?php else: ?>
                                        <span style="color: var(--text-muted); font-size: 0.85rem;">No</span>
                                    <?php endif; ?>
                                </td>
                                <td>
                                    <span class="badge <?= $s['estado'] === 'activo' ? 'badge-activo' : 'badge-inactivo' ?>">
                                        <?= ucfirst($s['estado']) ?>
                                    </span>
                                </td>
                                <td>
                                    <div style="display: flex; gap: 6px;">
                                        <button class="btn-action" onclick="abrirModalEditarServicio(<?= $s['id'] ?>)" title="Editar Servicio">
                                            ✏️ Editar
                                        </button>
                                        <button class="btn-action delete" onclick="eliminarServicio(<?= $s['id'] ?>, '<?= htmlspecialchars(addslashes($s['nombre'])) ?>')" title="Eliminar Servicio">
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

<!-- ========================================================================= -->
<!-- MODAL: CREAR SERVICIO                                                     -->
<!-- ========================================================================= -->
<div id="modal-crear-servicio" class="modal-overlay">
    <div class="modal-card">
        <div class="modal-header">
            <h3 class="modal-title">➕ Agregar Nuevo Servicio</h3>
            <button class="modal-close" data-close-modal>✕</button>
        </div>
        <form id="form-crear-servicio" onsubmit="guardarNuevoServicio(event)">
            <div class="modal-body">
                
                <div class="form-grid-2">
                    <div class="form-group" style="margin-bottom: 16px;">
                        <label class="form-label">Nombre del Servicio *</label>
                        <input type="text" name="nombre" class="form-control" placeholder="Ej: Russian Manicure Spa" required>
                    </div>
                    <div class="form-group" style="margin-bottom: 16px;">
                        <label class="form-label">Categoría *</label>
                        <select name="categoria_id" class="form-control" required>
                            <?php foreach ($categorias as $c): ?>
                                <option value="<?= $c['id'] ?>"><?= htmlspecialchars($c['nombre']) ?></option>
                            <?php endforeach; ?>
                        </select>
                    </div>
                </div>

                <div class="form-group" style="margin-bottom: 16px;">
                    <label class="form-label">Descripción Detallada *</label>
                    <textarea name="descripcion" class="form-control" rows="3" placeholder="Describe los beneficios, técnica y acabado..." required></textarea>
                </div>

                <div class="form-grid-2">
                    <div class="form-group" style="margin-bottom: 16px;">
                        <label class="form-label">Precio en Bolivianos (Bs.) *</label>
                        <input type="number" step="0.5" name="precio" class="form-control" placeholder="80.00" required min="1">
                    </div>
                    <div class="form-group" style="margin-bottom: 16px;">
                        <label class="form-label">Duración Estimada (Minutos)</label>
                        <input type="number" name="duracion_minutos" class="form-control" value="60" min="10" step="5">
                    </div>
                </div>

                <div class="form-grid-2">
                    <div class="form-group" style="margin-bottom: 16px;">
                        <label class="form-label">Ruta de Imagen</label>
                        <input type="text" name="imagen" class="form-control" value="images/service_acrilicas.jpg" placeholder="images/nombre_foto.jpg">
                    </div>
                    <div class="form-group" style="margin-bottom: 16px;">
                        <label class="form-label">Página de Detalle (HTML)</label>
                        <input type="text" name="url_detalle" class="form-control" value="servicios.html" placeholder="servicios.html">
                    </div>
                </div>

                <div class="form-grid-2">
                    <div class="form-group" style="margin-bottom: 16px;">
                        <label class="form-label">Estado</label>
                        <select name="estado" class="form-control">
                            <option value="activo" selected>Activo (Visible)</option>
                            <option value="inactivo">Inactivo (Oculto)</option>
                        </select>
                    </div>
                    <div class="form-group" style="margin-bottom: 16px; display: flex; align-items: center; gap: 8px; margin-top: 28px;">
                        <input type="checkbox" name="destacado" id="chk-destacado" value="1" checked style="width: 18px; height: 18px; accent-color: var(--pink-vivid);">
                        <label for="chk-destacado" class="form-label" style="margin: 0; cursor: pointer;">⭐ Mostrar como Servicio Destacado</label>
                    </div>
                </div>

            </div>
            <div class="modal-footer">
                <button type="button" class="btn-action" data-close-modal>Cancelar</button>
                <button type="submit" class="btn-primary btn-sm">Crear Servicio</button>
            </div>
        </form>
    </div>
</div>

<!-- ========================================================================= -->
<!-- MODAL: EDITAR SERVICIO                                                    -->
<!-- ========================================================================= -->
<div id="modal-editar-servicio" class="modal-overlay">
    <div class="modal-card">
        <div class="modal-header">
            <h3 class="modal-title">✏️ Modificar Servicio</h3>
            <button class="modal-close" data-close-modal>✕</button>
        </div>
        <form id="form-editar-servicio" onsubmit="actualizarServicio(event)">
            <input type="hidden" name="id" id="edit-srv-id">
            
            <div class="modal-body">
                <div class="form-grid-2">
                    <div class="form-group" style="margin-bottom: 16px;">
                        <label class="form-label">Nombre del Servicio *</label>
                        <input type="text" name="nombre" id="edit-srv-nombre" class="form-control" required>
                    </div>
                    <div class="form-group" style="margin-bottom: 16px;">
                        <label class="form-label">Categoría *</label>
                        <select name="categoria_id" id="edit-srv-cat" class="form-control" required>
                            <?php foreach ($categorias as $c): ?>
                                <option value="<?= $c['id'] ?>"><?= htmlspecialchars($c['nombre']) ?></option>
                            <?php endforeach; ?>
                        </select>
                    </div>
                </div>

                <div class="form-group" style="margin-bottom: 16px;">
                    <label class="form-label">Descripción Detallada *</label>
                    <textarea name="descripcion" id="edit-srv-desc" class="form-control" rows="3" required></textarea>
                </div>

                <div class="form-grid-2">
                    <div class="form-group" style="margin-bottom: 16px;">
                        <label class="form-label">Precio en Bolivianos (Bs.) *</label>
                        <input type="number" step="0.5" name="precio" id="edit-srv-precio" class="form-control" required min="1">
                    </div>
                    <div class="form-group" style="margin-bottom: 16px;">
                        <label class="form-label">Duración (Minutos)</label>
                        <input type="number" name="duracion_minutos" id="edit-srv-duracion" class="form-control" min="10">
                    </div>
                </div>

                <div class="form-grid-2">
                    <div class="form-group" style="margin-bottom: 16px;">
                        <label class="form-label">Ruta de Imagen</label>
                        <input type="text" name="imagen" id="edit-srv-imagen" class="form-control">
                    </div>
                    <div class="form-group" style="margin-bottom: 16px;">
                        <label class="form-label">Página de Detalle</label>
                        <input type="text" name="url_detalle" id="edit-srv-url" class="form-control">
                    </div>
                </div>

                <div class="form-grid-2">
                    <div class="form-group" style="margin-bottom: 16px;">
                        <label class="form-label">Estado</label>
                        <select name="estado" id="edit-srv-estado" class="form-control">
                            <option value="activo">Activo (Visible)</option>
                            <option value="inactivo">Inactivo (Oculto)</option>
                        </select>
                    </div>
                    <div class="form-group" style="margin-bottom: 16px; display: flex; align-items: center; gap: 8px; margin-top: 28px;">
                        <input type="checkbox" name="destacado" id="edit-srv-destacado" value="1" style="width: 18px; height: 18px; accent-color: var(--pink-vivid);">
                        <label for="edit-srv-destacado" class="form-label" style="margin: 0; cursor: pointer;">⭐ Servicio Destacado</label>
                    </div>
                </div>
            </div>

            <div class="modal-footer">
                <button type="button" class="btn-action" data-close-modal>Cancelar</button>
                <button type="submit" class="btn-primary btn-sm">Actualizar Servicio</button>
            </div>
        </form>
    </div>
</div>

<script>
function filtrarServicios() {
    const catVal = document.getElementById('filtro-categoria').value.toLowerCase();
    const estadoVal = document.getElementById('filtro-estado-srv').value.toLowerCase();
    const filas = document.querySelectorAll('#tabla-servicios tbody tr');

    filas.forEach(fila => {
        const cat = (fila.getAttribute('data-cat') || '').toLowerCase();
        const estado = (fila.getAttribute('data-estado') || '').toLowerCase();

        const matchCat = !catVal || cat.includes(catVal);
        const matchEstado = !estadoVal || estado === estadoVal;

        fila.style.display = (matchCat && matchEstado) ? '' : 'none';
    });
}

function abrirModalCrearServicio() {
    document.getElementById('form-crear-servicio').reset();
    openAdminModal('modal-crear-servicio');
}

async function guardarNuevoServicio(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());

    const res = await apiAdminRequest('servicio_crear', data);
    if (res.success) {
        showAdminToast(res.message, 'success');
        closeAdminModal('modal-crear-servicio');
        setTimeout(() => location.reload(), 1000);
    } else {
        showAdminToast(res.message, 'error');
    }
}

async function abrirModalEditarServicio(id) {
    const res = await apiAdminRequest('servicio_obtener', { id: id });
    if (res.success && res.data) {
        const s = res.data;
        document.getElementById('edit-srv-id').value = s.id;
        document.getElementById('edit-srv-nombre').value = s.nombre;
        document.getElementById('edit-srv-cat').value = s.categoria_id;
        document.getElementById('edit-srv-desc').value = s.descripcion;
        document.getElementById('edit-srv-precio').value = s.precio;
        document.getElementById('edit-srv-duracion').value = s.duracion_minutos;
        document.getElementById('edit-srv-imagen').value = s.imagen;
        document.getElementById('edit-srv-url').value = s.url_detalle;
        document.getElementById('edit-srv-estado').value = s.estado;
        document.getElementById('edit-srv-destacado').checked = parseInt(s.destacado) === 1;

        openAdminModal('modal-editar-servicio');
    } else {
        showAdminToast(res.message || 'Error al obtener servicio', 'error');
    }
}

async function actualizarServicio(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());

    const res = await apiAdminRequest('servicio_editar', data);
    if (res.success) {
        showAdminToast(res.message, 'success');
        closeAdminModal('modal-editar-servicio');
        setTimeout(() => location.reload(), 1000);
    } else {
        showAdminToast(res.message, 'error');
    }
}

async function eliminarServicio(id, nombre) {
    if (!confirm(`¿Deseas eliminar permanentemente o desactivar el servicio "${nombre}"?`)) {
        return;
    }

    const res = await apiAdminRequest('servicio_eliminar', { id: id });
    if (res.success) {
        showAdminToast(res.message, 'success');
        const fila = document.getElementById(`fila-srv-${id}`);
        if (fila) fila.remove();
    } else {
        showAdminToast(res.message, 'error');
    }
}
</script>

<?php
require_once __DIR__ . '/footer.php';
?>
