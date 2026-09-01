<?php
/**
 * NailArtist Studio — Gestión de Usuarios y Roles
 */

$pageTitle = 'Usuarios';
$pageHeading = 'Gestión de Usuarios & Roles';

require_once __DIR__ . '/header.php';

$pdo = Database::getConnection();

// Obtener roles disponibles
$roles = $pdo->query("SELECT * FROM roles ORDER BY id ASC")->fetchAll();

// Obtener todos los usuarios
$stmtUsers = $pdo->query("SELECT u.*, r.nombre AS rol_nombre 
                          FROM usuarios u 
                          INNER JOIN roles r ON u.rol_id = r.id 
                          ORDER BY u.id DESC");
$usuarios = $stmtUsers->fetchAll();
?>

<div class="admin-card">
    <div class="card-header">
        <h3 class="card-title">👥 Listado General de Usuarios</h3>
        <div class="card-actions">
            <button class="btn-primary btn-sm" onclick="abrirModalCrearUsuario()">
                <span>➕ Nuevo Usuario</span>
            </button>
        </div>
    </div>
    
    <div class="card-body">
        
        <!-- Barra de Búsqueda y Filtros -->
        <div class="filter-bar">
            <input type="text" class="search-input" data-table-search="tabla-usuarios" placeholder="🔍 Buscar por nombre, correo, teléfono o rol...">
            
            <select class="filter-select" id="filtro-rol" onchange="filtrarUsuarios()">
                <option value="">Todos los Roles</option>
                <option value="Administrador">👑 Administradores</option>
                <option value="Manicurista">💅 Manicuristas</option>
                <option value="Cliente">💖 Clientes VIP</option>
            </select>

            <select class="filter-select" id="filtro-estado" onchange="filtrarUsuarios()">
                <option value="">Todos los Estados</option>
                <option value="activo">Activos</option>
                <option value="inactivo">Inactivos</option>
                <option value="bloqueado">Bloqueados</option>
            </select>
        </div>

        <!-- Tabla de Usuarios -->
        <div class="table-responsive">
            <table class="admin-table" id="tabla-usuarios">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Usuario</th>
                        <th>Contacto</th>
                        <th>Rol</th>
                        <th>Descuento VIP</th>
                        <th>Estado</th>
                        <th>Registro</th>
                        <th>Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    <?php if (empty($usuarios)): ?>
                        <tr>
                            <td colspan="8" style="text-align: center; padding: 30px; color: var(--text-muted);">
                                No hay usuarios registrados en la base de datos.
                            </td>
                        </tr>
                    <?php else: ?>
                        <?php foreach ($usuarios as $u): ?>
                            <tr data-rol="<?= htmlspecialchars($u['rol_nombre']) ?>" data-estado="<?= htmlspecialchars($u['estado']) ?>" id="fila-usuario-<?= $u['id'] ?>">
                                <td><strong>#<?= $u['id'] ?></strong></td>
                                <td>
                                    <div style="font-weight: 700; color: var(--text-main);">
                                        <?= htmlspecialchars($u['nombre'] . ' ' . ($u['apellido'] ?? '')) ?>
                                    </div>
                                    <div style="font-size: 0.8rem; color: var(--text-muted);">
                                        ✉️ <?= htmlspecialchars($u['email']) ?>
                                    </div>
                                </td>
                                <td>
                                    <span><?= htmlspecialchars($u['telefono'] ?? 'Sin registrar') ?></span>
                                </td>
                                <td>
                                    <?php
                                    $rolClass = 'badge-cliente';
                                    $rolIcon = '💖';
                                    if ($u['rol_id'] == 1) { $rolClass = 'badge-admin'; $rolIcon = '👑'; }
                                    if ($u['rol_id'] == 3) { $rolClass = 'badge-manicurista'; $rolIcon = '💅'; }
                                    ?>
                                    <span class="badge <?= $rolClass ?>">
                                        <?= $rolIcon ?> <?= htmlspecialchars($u['rol_nombre']) ?>
                                    </span>
                                </td>
                                <td>
                                    <strong><?= number_format($u['descuento_vip'], 1) ?>%</strong>
                                </td>
                                <td>
                                    <?php
                                    $estadoClass = 'badge-activo';
                                    if ($u['estado'] === 'inactivo') $estadoClass = 'badge-inactivo';
                                    if ($u['estado'] === 'bloqueado') $estadoClass = 'badge-bloqueado';
                                    ?>
                                    <span class="badge <?= $estadoClass ?>">
                                        <?= htmlspecialchars(ucfirst($u['estado'])) ?>
                                    </span>
                                </td>
                                <td>
                                    <span style="font-size: 0.82rem; color: var(--text-muted);">
                                        <?= substr($u['fecha_registro'], 0, 10) ?>
                                    </span>
                                </td>
                                <td>
                                    <div style="display: flex; gap: 6px;">
                                        <button class="btn-action" onclick="abrirModalEditarUsuario(<?= $u['id'] ?>)" title="Editar Usuario">
                                            ✏️ Editar
                                        </button>
                                        <?php if ($u['id'] !== (int)($_SESSION['admin_user']['id'] ?? 0)): ?>
                                            <button class="btn-action delete" onclick="eliminarUsuario(<?= $u['id'] ?>, '<?= htmlspecialchars(addslashes($u['nombre'])) ?>')" title="Eliminar Usuario">
                                                🗑️
                                            </button>
                                        <?php endif; ?>
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
<!-- MODAL: CREAR USUARIO                                                      -->
<!-- ========================================================================= -->
<div id="modal-crear-usuario" class="modal-overlay">
    <div class="modal-card">
        <div class="modal-header">
            <h3 class="modal-title">➕ Crear Nuevo Usuario</h3>
            <button class="modal-close" data-close-modal>✕</button>
        </div>
        <form id="form-crear-usuario" onsubmit="guardarNuevoUsuario(event)">
            <div class="modal-body">
                
                <div class="form-grid-2">
                    <div class="form-group" style="margin-bottom: 16px;">
                        <label class="form-label">Nombre *</label>
                        <input type="text" name="nombre" class="form-control" placeholder="Ej: Marcela" required>
                    </div>
                    <div class="form-group" style="margin-bottom: 16px;">
                        <label class="form-label">Apellido</label>
                        <input type="text" name="apellido" class="form-control" placeholder="Ej: Vargas">
                    </div>
                </div>

                <div class="form-grid-2">
                    <div class="form-group" style="margin-bottom: 16px;">
                        <label class="form-label">Correo Electrónico *</label>
                        <input type="email" name="email" class="form-control" placeholder="marcela@email.com" required>
                    </div>
                    <div class="form-group" style="margin-bottom: 16px;">
                        <label class="form-label">Teléfono / WhatsApp</label>
                        <input type="text" name="telefono" class="form-control" placeholder="+591 70000000">
                    </div>
                </div>

                <div class="form-grid-2">
                    <div class="form-group" style="margin-bottom: 16px;">
                        <label class="form-label">Rol del Usuario *</label>
                        <select name="rol_id" class="form-control" required>
                            <?php foreach ($roles as $r): ?>
                                <option value="<?= $r['id'] ?>" <?= $r['id'] == 2 ? 'selected' : '' ?>>
                                    <?= htmlspecialchars($r['nombre']) ?> (<?= htmlspecialchars($r['descripcion']) ?>)
                                </option>
                            <?php endforeach; ?>
                        </select>
                    </div>
                    <div class="form-group" style="margin-bottom: 16px;">
                        <label class="form-label">Estado de Cuenta</label>
                        <select name="estado" class="form-control">
                            <option value="activo" selected>Activo</option>
                            <option value="inactivo">Inactivo</option>
                            <option value="bloqueado">Bloqueado</option>
                        </select>
                    </div>
                </div>

                <div class="form-grid-2">
                    <div class="form-group" style="margin-bottom: 16px;">
                        <label class="form-label">Contraseña *</label>
                        <input type="password" name="password" class="form-control" placeholder="Mínimo 6 caracteres" required minlength="6">
                    </div>
                    <div class="form-group" style="margin-bottom: 16px;">
                        <label class="form-label">Descuento VIP (%)</label>
                        <input type="number" step="0.5" name="descuento_vip" class="form-control" value="15.00" min="0" max="100">
                    </div>
                </div>

            </div>
            <div class="modal-footer">
                <button type="button" class="btn-action" data-close-modal>Cancelar</button>
                <button type="submit" class="btn-primary btn-sm">Guardar Usuario</button>
            </div>
        </form>
    </div>
</div>

<!-- ========================================================================= -->
<!-- MODAL: EDITAR USUARIO                                                     -->
<!-- ========================================================================= -->
<div id="modal-editar-usuario" class="modal-overlay">
    <div class="modal-card">
        <div class="modal-header">
            <h3 class="modal-title">✏️ Editar Usuario</h3>
            <button class="modal-close" data-close-modal>✕</button>
        </div>
        <form id="form-editar-usuario" onsubmit="actualizarUsuario(event)">
            <input type="hidden" name="id" id="edit-user-id">
            
            <div class="modal-body">
                <div class="form-grid-2">
                    <div class="form-group" style="margin-bottom: 16px;">
                        <label class="form-label">Nombre *</label>
                        <input type="text" name="nombre" id="edit-user-nombre" class="form-control" required>
                    </div>
                    <div class="form-group" style="margin-bottom: 16px;">
                        <label class="form-label">Apellido</label>
                        <input type="text" name="apellido" id="edit-user-apellido" class="form-control">
                    </div>
                </div>

                <div class="form-grid-2">
                    <div class="form-group" style="margin-bottom: 16px;">
                        <label class="form-label">Correo Electrónico *</label>
                        <input type="email" name="email" id="edit-user-email" class="form-control" required>
                    </div>
                    <div class="form-group" style="margin-bottom: 16px;">
                        <label class="form-label">Teléfono / WhatsApp</label>
                        <input type="text" name="telefono" id="edit-user-telefono" class="form-control">
                    </div>
                </div>

                <div class="form-grid-2">
                    <div class="form-group" style="margin-bottom: 16px;">
                        <label class="form-label">Rol del Usuario *</label>
                        <select name="rol_id" id="edit-user-rol" class="form-control" required>
                            <?php foreach ($roles as $r): ?>
                                <option value="<?= $r['id'] ?>">
                                    <?= htmlspecialchars($r['nombre']) ?>
                                </option>
                            <?php endforeach; ?>
                        </select>
                    </div>
                    <div class="form-group" style="margin-bottom: 16px;">
                        <label class="form-label">Estado de Cuenta</label>
                        <select name="estado" id="edit-user-estado" class="form-control">
                            <option value="activo">Activo</option>
                            <option value="inactivo">Inactivo</option>
                            <option value="bloqueado">Bloqueado</option>
                        </select>
                    </div>
                </div>

                <div class="form-grid-2">
                    <div class="form-group" style="margin-bottom: 16px;">
                        <label class="form-label">Cambiar Contraseña (opcional)</label>
                        <input type="password" name="password" id="edit-user-password" class="form-control" placeholder="Dejar en blanco para conservar actual">
                    </div>
                    <div class="form-group" style="margin-bottom: 16px;">
                        <label class="form-label">Descuento VIP (%)</label>
                        <input type="number" step="0.5" name="descuento_vip" id="edit-user-descuento" class="form-control" min="0" max="100">
                    </div>
                </div>
            </div>

            <div class="modal-footer">
                <button type="button" class="btn-action" data-close-modal>Cancelar</button>
                <button type="submit" class="btn-primary btn-sm">Actualizar Cambios</button>
            </div>
        </form>
    </div>
</div>

<script>
function filtrarUsuarios() {
    const rolVal = document.getElementById('filtro-rol').value.toLowerCase();
    const estadoVal = document.getElementById('filtro-estado').value.toLowerCase();
    const filas = document.querySelectorAll('#tabla-usuarios tbody tr');

    filas.forEach(fila => {
        const rol = (fila.getAttribute('data-rol') || '').toLowerCase();
        const estado = (fila.getAttribute('data-estado') || '').toLowerCase();

        const matchRol = !rolVal || rol.includes(rolVal);
        const matchEstado = !estadoVal || estado === estadoVal;

        fila.style.display = (matchRol && matchEstado) ? '' : 'none';
    });
}

function abrirModalCrearUsuario() {
    document.getElementById('form-crear-usuario').reset();
    openAdminModal('modal-crear-usuario');
}

async function guardarNuevoUsuario(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());

    const res = await apiAdminRequest('usuario_crear', data);
    if (res.success) {
        showAdminToast(res.message, 'success');
        closeAdminModal('modal-crear-usuario');
        setTimeout(() => location.reload(), 1000);
    } else {
        showAdminToast(res.message, 'error');
    }
}

async function abrirModalEditarUsuario(id) {
    const res = await apiAdminRequest('usuario_obtener', { id: id });
    if (res.success && res.data) {
        const u = res.data;
        document.getElementById('edit-user-id').value = u.id;
        document.getElementById('edit-user-nombre').value = u.nombre;
        document.getElementById('edit-user-apellido').value = u.apellido || '';
        document.getElementById('edit-user-email').value = u.email;
        document.getElementById('edit-user-telefono').value = u.telefono || '';
        document.getElementById('edit-user-rol').value = u.rol_id;
        document.getElementById('edit-user-estado').value = u.estado;
        document.getElementById('edit-user-descuento').value = u.descuento_vip || 0;
        document.getElementById('edit-user-password').value = '';

        openAdminModal('modal-editar-usuario');
    } else {
        showAdminToast(res.message || 'Error al obtener usuario', 'error');
    }
}

async function actualizarUsuario(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());

    const res = await apiAdminRequest('usuario_editar', data);
    if (res.success) {
        showAdminToast(res.message, 'success');
        closeAdminModal('modal-editar-usuario');
        setTimeout(() => location.reload(), 1000);
    } else {
        showAdminToast(res.message, 'error');
    }
}

async function eliminarUsuario(id, nombre) {
    if (!confirm(`¿Estás seguro de que deseas eliminar o bloquear al usuario "${nombre}"?`)) {
        return;
    }

    const res = await apiAdminRequest('usuario_eliminar', { id: id });
    if (res.success) {
        showAdminToast(res.message, 'success');
        const fila = document.getElementById(`fila-usuario-${id}`);
        if (fila) fila.remove();
    } else {
        showAdminToast(res.message, 'error');
    }
}
</script>

<?php
require_once __DIR__ . '/footer.php';
?>
