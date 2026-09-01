"""
NailArtist Studio — Backend Flask & SQLite API
Reemplaza completamente la lógica PHP por un backend Python moderno, seguro y compatible.
Permite ejecutar el sitio completo, APIs de reservas/login y el Panel de Administración.
"""

from flask import Flask, request, jsonify, render_template_string, session, redirect, url_for, send_from_directory, abort
import os
import re
import datetime
import uuid
import database

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

app = Flask(__name__, static_folder=BASE_DIR, static_url_path='')
app.secret_key = 'nailartist_studio_ultra_secret_key_2026_glam'

# Inicializar DB si no existe
if not os.path.exists(database.DB_PATH):
    database.init_db(drop_existing=False)

@app.after_request
def add_cors_headers(response):
    """Permite peticiones Cross-Origin (CORS) para compatibilidad con cualquier entorno de desarrollo."""
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Requested-With, Accept'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
    return response

def json_response(success: bool, message: str, data=None, status_code: int = 200):
    """Auxiliar para emitir respuestas JSON estandarizadas."""
    resp = {
        'success': success,
        'message': message,
        'timestamp': datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    }
    if data is not None:
        resp['data'] = data
    return jsonify(resp), status_code

def is_admin_authenticated() -> bool:
    """Verifica si el usuario en sesión es Administrador."""
    user = session.get('admin_user')
    if not user or not isinstance(user, dict):
        return False
    rol_id = int(user.get('rol_id', 0))
    rol_name = str(user.get('rol', '')).lower()
    return rol_id == 1 or rol_name in ('administrador', 'admin')

# =============================================================================
# 1. SERVIR ARCHIVOS ESTÁTICOS & PÁGINAS HTML
# =============================================================================

@app.route('/')
def home():
    """Página principal de NailArtist Studio."""
    return send_from_directory(BASE_DIR, 'index.html')

@app.route('/<path:filename>')
def serve_file(filename):
    """Sirve páginas HTML, imágenes y recursos CSS/JS manteniendo intactos los enlaces."""
    # Evitar exponer la base de datos o archivos Python sensibles
    if filename.endswith('.db') or filename.endswith('.py') or filename.endswith('.sql'):
        abort(404)
        
    full_path = os.path.join(BASE_DIR, filename)
    if os.path.exists(full_path) and os.path.isfile(full_path):
        return send_from_directory(BASE_DIR, filename)
    
    # Si intentan acceder sin .html
    if os.path.exists(full_path + '.html'):
        return send_from_directory(BASE_DIR, filename + '.html')
        
    abort(404)

# =============================================================================
# 2. ENDPOINTS API PÚBLICOS (CLIENTES & REGISTRO)
# =============================================================================

@app.route('/api/login', methods=['POST', 'OPTIONS'])
@app.route('/api/login.php', methods=['POST', 'OPTIONS'])
def api_login():
    """Autenticación de usuarios (Clientes y Administradores)."""
    if request.method == 'OPTIONS':
        return '', 200

    data = request.get_json(silent=True) or request.form.to_dict()
    email = str(data.get('email', '')).strip().lower()
    password = str(data.get('password', '')).strip()

    if not email or not password:
        return json_response(False, 'Debe ingresar su correo electrónico y contraseña.', status_code=400)

    try:
        conn = database.get_db_connection()
        cursor = conn.cursor()
        query = """
            SELECT u.id, u.rol_id, u.nombre, u.apellido, u.email, u.telefono,
                   u.password_hash, u.descuento_vip, u.estado, r.nombre AS rol
            FROM usuarios u
            INNER JOIN roles r ON u.rol_id = r.id
            WHERE LOWER(u.email) = ?
        """
        cursor.execute(query, (email,))
        user = cursor.fetchone()
        conn.close()

        if not user:
            return json_response(False, 'Credenciales incorrectas o correo no registrado.', status_code=401)

        if user['estado'] != 'activo':
            return json_response(False, 'Su cuenta se encuentra inactiva o bloqueada. Contacte con administración.', status_code=403)

        if not database.verify_password(password, user['password_hash']):
            return json_response(False, 'Credenciales incorrectas. Verifique su contraseña.', status_code=401)

        user_dict = {
            'id': user['id'],
            'rol_id': user['rol_id'],
            'nombre': user['nombre'],
            'apellido': user['apellido'] or '',
            'email': user['email'],
            'telefono': user['telefono'] or '',
            'descuento_vip': float(user['descuento_vip']),
            'estado': user['estado'],
            'rol': user['rol']
        }

        # Si es Administrador, inicializar también la sesión de Flask
        if user['rol_id'] == 1 or str(user['rol']).lower() in ('administrador', 'admin'):
            session['admin_user'] = user_dict

        return json_response(True, f'¡Bienvenida {user["nombre"]} a NailArtist Studio!', {
            'usuario': user_dict
        })

    except Exception as e:
        return json_response(False, f'Error en el servidor al intentar iniciar sesión: {str(e)}', status_code=500)


@app.route('/api/registrar_usuario', methods=['POST', 'OPTIONS'])
@app.route('/api/registrar_usuario.php', methods=['POST', 'OPTIONS'])
def api_registrar_usuario():
    """Registro de nuevas clientas en Nails VIP Club con 15% de descuento."""
    if request.method == 'OPTIONS':
        return '', 200

    data = request.get_json(silent=True) or request.form.to_dict()
    nombre = str(data.get('nombre', '')).strip()
    apellido = str(data.get('apellido', '')).strip()
    email = str(data.get('email', '')).strip().lower()
    telefono = str(data.get('telefono', '')).strip()
    password = str(data.get('password', '')).strip()

    if not nombre:
        return json_response(False, 'El nombre es obligatorio.', status_code=400)

    if not email or '@' not in email:
        return json_response(False, 'Debe proporcionar un correo electrónico válido.', status_code=400)

    if not password or len(password) < 6:
        return json_response(False, 'La contraseña debe tener al menos 6 caracteres.', status_code=400)

    try:
        conn = database.get_db_connection()
        cursor = conn.cursor()

        # Verificar si el correo ya existe
        cursor.execute("SELECT id FROM usuarios WHERE LOWER(email) = ?", (email,))
        if cursor.fetchone():
            conn.close()
            return json_response(False, 'El correo electrónico ya se encuentra registrado. Intente iniciar sesión.', status_code=409)

        pwd_hash = database.hash_password(password)

        cursor.execute("""
            INSERT INTO usuarios (rol_id, nombre, apellido, email, telefono, password_hash, descuento_vip, estado)
            VALUES (2, ?, ?, ?, ?, ?, 15.00, 'activo')
        """, (nombre, apellido, email, telefono, pwd_hash))
        
        user_id = cursor.lastrowid
        conn.commit()
        conn.close()

        return json_response(True, '¡Bienvenida a Nails VIP Club! Tu cuenta ha sido registrada con 15% de descuento.', {
            'id': user_id,
            'nombre': nombre,
            'email': email,
            'descuento_vip': 15.00,
            'mensaje': 'Tu descuento del 15% ha sido activado para tu primera cita.'
        }, status_code=201)

    except Exception as e:
        return json_response(False, f'Error al registrar el usuario en la base de datos: {str(e)}', status_code=500)


@app.route('/api/crear_reserva', methods=['POST', 'OPTIONS'])
@app.route('/api/crear_reserva.php', methods=['POST', 'OPTIONS'])
def api_crear_reserva():
    """Creación de reservas desde el carrito con cálculo de servicios y descuento VIP."""
    if request.method == 'OPTIONS':
        return '', 200

    data = request.get_json(silent=True) or request.form.to_dict()
    usuario_id = data.get('usuario_id')
    nombre_cliente = str(data.get('nombre_cliente', '')).strip()
    email_cliente = str(data.get('email_cliente', '')).strip().lower()
    telefono_cliente = str(data.get('telefono_cliente', '')).strip()
    
    manana = (datetime.date.today() + datetime.timedelta(days=1)).strftime('%Y-%m-%d')
    fecha_cita = str(data.get('fecha_cita', manana)).strip()
    hora_cita = str(data.get('hora_cita', '10:00:00')).strip()
    observaciones = str(data.get('observaciones', '')).strip()
    servicios = data.get('servicios', [])

    if not servicios or not isinstance(servicios, list):
        return json_response(False, 'Debe seleccionar al menos un servicio para agendar su cita.', status_code=400)

    try:
        conn = database.get_db_connection()
        cursor = conn.cursor()

        # Si no tiene usuario_id pero tiene email, buscar o crear
        if not usuario_id:
            if email_cliente:
                cursor.execute("SELECT id FROM usuarios WHERE LOWER(email) = ?", (email_cliente,))
                existing = cursor.fetchone()
                if existing:
                    usuario_id = existing['id']
                else:
                    pwd_tmp = database.hash_password(str(uuid.uuid4())[:8])
                    cursor.execute("""
                        INSERT INTO usuarios (rol_id, nombre, email, telefono, password_hash)
                        VALUES (2, ?, ?, ?, ?)
                    """, (nombre_cliente or 'Clienta Invitada', email_cliente, telefono_cliente, pwd_tmp))
                    usuario_id = cursor.lastrowid
            else:
                usuario_id = 2  # Usuario cliente por defecto

        total_bs = 0.0
        items_validados = []

        for item in servicios:
            srv_id = int(item.get('servicio_id', 0) or item.get('id', 0))
            cantidad = max(1, int(item.get('cantidad', 1)))
            nombre_srv = str(item.get('nombre', '')).strip()

            if srv_id == 0 and nombre_srv:
                cursor.execute("SELECT id, precio, nombre FROM servicios WHERE nombre LIKE ? LIMIT 1", (f"%{nombre_srv}%",))
                srv_found = cursor.fetchone()
                if srv_found:
                    srv_id = srv_found['id']
                    precio = float(srv_found['precio'])
                else:
                    precio = float(item.get('precio', 0))
            else:
                cursor.execute("SELECT id, precio, nombre FROM servicios WHERE id = ?", (srv_id,))
                srv_found = cursor.fetchone()
                precio = float(srv_found['precio']) if srv_found else float(item.get('precio', 0))

            if srv_id > 0:
                subtotal = precio * cantidad
                total_bs += subtotal
                items_validados.append({
                    'servicio_id': srv_id,
                    'precio_unitario': precio,
                    'cantidad': cantidad,
                    'subtotal': subtotal
                })

        if not items_validados:
            conn.close()
            return json_response(False, 'No se pudieron procesar los servicios seleccionados.', status_code=400)

        # Generar código de reserva único
        codigo_reserva = f"RES-{datetime.date.today().year}-{str(uuid.uuid4())[-5:].upper()}"

        # Descuento VIP
        cursor.execute("SELECT descuento_vip FROM usuarios WHERE id = ?", (usuario_id,))
        desc_row = cursor.fetchone()
        descuento_porcentaje = float(desc_row['descuento_vip']) if desc_row else 0.0
        descuento_bs = (total_bs * descuento_porcentaje) / 100.0
        total_final_bs = max(0.0, total_bs - descuento_bs)

        # Insertar cita
        cursor.execute("""
            INSERT INTO citas (codigo_reserva, usuario_id, fecha_cita, hora_cita, total_bs,
                               descuento_aplicado, total_final_bs, estado, observaciones, metodo_contacto)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'Pendiente', ?, 'WhatsApp')
        """, (codigo_reserva, usuario_id, fecha_cita, hora_cita, total_bs, descuento_bs, total_final_bs, observaciones))
        
        cita_id = cursor.lastrowid

        # Insertar detalles de cita
        for item in items_validados:
            cursor.execute("""
                INSERT INTO detalle_cita (cita_id, servicio_id, precio_unitario, cantidad, subtotal)
                VALUES (?, ?, ?, ?, ?)
            """, (cita_id, item['servicio_id'], item['precio_unitario'], item['cantidad'], item['subtotal']))

        conn.commit()
        conn.close()

        return json_response(True, '¡Reserva creada exitosamente en la base de datos!', {
            'cita_id': cita_id,
            'codigo_reserva': codigo_reserva,
            'fecha_cita': fecha_cita,
            'hora_cita': hora_cita,
            'total_bs': total_bs,
            'descuento_bs': descuento_bs,
            'total_final_bs': total_final_bs,
            'estado': 'Pendiente',
            'cantidad_servicios': len(items_validados)
        }, status_code=201)

    except Exception as e:
        return json_response(False, f'Error al guardar la reserva en la base de datos: {str(e)}', status_code=500)


@app.route('/api/obtener_servicios', methods=['GET'])
@app.route('/api/obtener_servicios.php', methods=['GET'])
def api_obtener_servicios():
    """Consulta de servicios oficiales activos de NailArtist Studio."""
    categoria_id = request.args.get('categoria_id')
    destacado = request.args.get('destacado')

    try:
        conn = database.get_db_connection()
        cursor = conn.cursor()

        sql = """
            SELECT s.id, s.nombre, s.slug, s.descripcion, s.precio, s.moneda,
                   s.duracion_minutos, s.imagen, s.url_detalle, s.destacado, s.calificacion,
                   c.id AS categoria_id, c.nombre AS categoria_nombre
            FROM servicios s
            INNER JOIN categorias c ON s.categoria_id = c.id
            WHERE s.estado = 'activo'
        """
        params = []
        if categoria_id:
            sql += " AND s.categoria_id = ?"
            params.append(int(categoria_id))
        if destacado is not None and destacado != '':
            sql += " AND s.destacado = ?"
            params.append(int(destacado))

        sql += " ORDER BY s.id ASC"
        cursor.execute(sql, params)
        rows = cursor.fetchall()
        conn.close()

        servicios = [dict(row) for row in rows]
        return json_response(True, 'Servicios obtenidos exitosamente', {
            'total': len(servicios),
            'servicios': servicios
        })

    except Exception as e:
        return json_response(False, f'Error al consultar los servicios: {str(e)}', status_code=500)


@app.route('/api/contacto', methods=['POST', 'OPTIONS'])
@app.route('/api/contacto.php', methods=['POST', 'OPTIONS'])
def api_contacto():
    """Guardar mensajes de contacto enviados por clientas."""
    if request.method == 'OPTIONS':
        return '', 200

    data = request.get_json(silent=True) or request.form.to_dict()
    nombre = str(data.get('nombre', '')).strip()
    email = str(data.get('email', '')).strip()
    telefono = str(data.get('telefono', '')).strip()
    mensaje = str(data.get('mensaje', '')).strip()

    if not nombre or not email or not mensaje:
        return json_response(False, 'Nombre, correo electrónico y mensaje son obligatorios.', status_code=400)

    try:
        conn = database.get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO contactos (nombre, email, telefono, mensaje)
            VALUES (?, ?, ?, ?)
        """, (nombre, email, telefono, mensaje))
        contacto_id = cursor.lastrowid
        conn.commit()
        conn.close()

        return json_response(True, '¡Gracias por contactarnos! Tu mensaje ha sido recibido.', {
            'id': contacto_id
        }, status_code=201)

    except Exception as e:
        return json_response(False, f'Error al guardar el mensaje de contacto: {str(e)}', status_code=500)


# =============================================================================
# 3. RUTAS DEL PANEL DE ADMINISTRACIÓN (/admin/*)
# =============================================================================

@app.route('/admin')
@app.route('/admin/')
@app.route('/admin/index.php')
def admin_dashboard():
    """Dashboard Administrativo Principal con KPIs e Histórico."""
    if not is_admin_authenticated():
        return redirect('/admin/login.php?error=no_auth&msg=' + 'Debes iniciar sesión como Administrador')

    admin = session['admin_user']
    conn = database.get_db_connection()
    cursor = conn.cursor()

    # KPIs
    total_usuarios = cursor.execute("SELECT COUNT(*) FROM usuarios").fetchone()[0]
    total_clientes = cursor.execute("SELECT COUNT(*) FROM usuarios WHERE rol_id = 2").fetchone()[0]
    total_manicuristas = cursor.execute("SELECT COUNT(*) FROM usuarios WHERE rol_id = 3").fetchone()[0]
    total_servicios = cursor.execute("SELECT COUNT(*) FROM servicios WHERE estado = 'activo'").fetchone()[0]
    total_citas = cursor.execute("SELECT COUNT(*) FROM citas").fetchone()[0]
    citas_pendientes = cursor.execute("SELECT COUNT(*) FROM citas WHERE estado = 'Pendiente'").fetchone()[0]
    citas_confirmadas = cursor.execute("SELECT COUNT(*) FROM citas WHERE estado = 'Confirmada'").fetchone()[0]
    citas_completadas = cursor.execute("SELECT COUNT(*) FROM citas WHERE estado = 'Completada'").fetchone()[0]
    
    ingresos_row = cursor.execute("SELECT COALESCE(SUM(total_final_bs), 0) FROM citas WHERE estado IN ('Confirmada', 'Completada')").fetchone()
    ingresos_totales = float(ingresos_row[0]) if ingresos_row else 0.0

    calif_row = cursor.execute("SELECT COALESCE(AVG(calificacion), 5.0) FROM resenas WHERE publicado = 1").fetchone()
    promedio_calif = float(calif_row[0]) if calif_row else 5.0
    
    total_mensajes = cursor.execute("SELECT COUNT(*) FROM contactos").fetchone()[0]
    mensajes_no_leidos = cursor.execute("SELECT COUNT(*) FROM contactos WHERE leido = 0").fetchone()[0]

    # Citas recientes
    ultimas_citas = cursor.execute("""
        SELECT c.*, u.nombre AS cliente_nombre, u.apellido AS cliente_apellido, u.telefono AS cliente_telefono
        FROM citas c
        INNER JOIN usuarios u ON c.usuario_id = u.id
        ORDER BY c.id DESC LIMIT 5
    """).fetchall()

    # Últimos mensajes
    ultimos_mensajes = cursor.execute("SELECT * FROM contactos ORDER BY id DESC LIMIT 4").fetchall()

    # Reseñas recientes
    ultimas_resenas = cursor.execute("""
        SELECT r.*, u.nombre AS usuario_nombre, s.nombre AS servicio_nombre
        FROM resenas r
        INNER JOIN usuarios u ON r.usuario_id = u.id
        LEFT JOIN servicios s ON r.servicio_id = s.id
        ORDER BY r.id DESC LIMIT 3
    """).fetchall()

    conn.close()

    return render_admin_page(
        page_title='Dashboard',
        page_heading='Panel de Control & Métricas',
        active_page='index.php',
        admin=admin,
        citas_pendientes=citas_pendientes,
        mensajes_no_leidos=mensajes_no_leidos,
        content=render_dashboard_content(
            total_usuarios, total_clientes, total_manicuristas, total_servicios,
            total_citas, citas_pendientes, citas_confirmadas, citas_completadas,
            ingresos_totales, promedio_calif, ultimas_citas, ultimos_mensajes, ultimas_resenas
        )
    )


@app.route('/admin/login.php', methods=['GET', 'POST'])
@app.route('/admin/login', methods=['GET', 'POST'])
def admin_login():
    """Pantalla de Login del Administrador."""
    if is_admin_authenticated():
        return redirect('/admin/index.php')

    error = ''
    success = request.args.get('msg', '')

    if request.method == 'POST':
        email = str(request.form.get('email', '')).strip().lower()
        password = str(request.form.get('password', '')).strip()

        if not email or not password:
            error = 'Por favor ingresa tu correo electrónico y contraseña.'
        else:
            conn = database.get_db_connection()
            cursor = conn.cursor()
            cursor.execute("""
                SELECT u.id, u.rol_id, u.nombre, u.apellido, u.email, u.password_hash, u.estado, r.nombre AS rol
                FROM usuarios u
                INNER JOIN roles r ON u.rol_id = r.id
                WHERE LOWER(u.email) = ? LIMIT 1
            """, (email,))
            user = cursor.fetchone()
            conn.close()

            if not user:
                error = 'Credenciales incorrectas o usuario no registrado.'
            elif not database.verify_password(password, user['password_hash']):
                error = 'Contraseña incorrecta. Por favor intenta de nuevo.'
            elif user['estado'] != 'activo':
                error = 'Esta cuenta se encuentra inactiva o bloqueada.'
            elif user['rol_id'] != 1 and str(user['rol']).lower() not in ('administrador', 'admin'):
                error = f"Acceso Denegado: Tu cuenta tiene rol de '{user['rol']}' y no cuenta con privilegios de Administrador."
            else:
                session['admin_user'] = {
                    'id': user['id'],
                    'rol_id': user['rol_id'],
                    'rol': user['rol'],
                    'nombre': user['nombre'],
                    'apellido': user['apellido'] or '',
                    'email': user['email']
                }
                return redirect('/admin/index.php')

    # Servir la plantilla HTML de login de admin
    login_html_path = os.path.join(BASE_DIR, 'admin', 'login.php')
    if os.path.exists(login_html_path):
        with open(login_html_path, 'r', encoding='utf-8', errors='ignore') as f:
            template = f.read()
            
        # Reemplazar bloques dinámicos simples
        err_block = f'<div class="alert alert-error"><span class="alert-icon">⚠️</span><div class="alert-text">{error}</div></div>' if error else ''
        succ_block = f'<div class="alert alert-success"><span class="alert-icon">✨</span><div class="alert-text">{success}</div></div>' if success else ''
        
        # Renderizado limpio
        rendered = re.sub(r'<\?php if \(!empty\(\$error\)\): \?>.*?<\?php endif; \?>', err_block, template, flags=re.DOTALL)
        rendered = re.sub(r'<\?php if \(!empty\(\$success\)\): \?>.*?<\?php endif; \?>', succ_block, rendered, flags=re.DOTALL)
        rendered = re.sub(r'<\?= htmlspecialchars\(\$_POST\[\'email\'\] \?\? \'admin@nailartist\.com\'\) \?>', email if 'email' in locals() and email else 'admin@gmail.com', rendered)
        rendered = re.sub(r'<\?php.*?\?>', '', rendered, flags=re.DOTALL)
        return rendered

    return "Plantilla de login no encontrada", 404


@app.route('/admin/logout.php')
@app.route('/admin/logout')
def admin_logout():
    """Cierre de sesión del administrador."""
    session.pop('admin_user', None)
    return redirect('/admin/login.php?msg=Has+cerrado+sesi%C3%B3n+correctamente.+%C2%A1Hasta+pronto!')


@app.route('/admin/citas.php')
def admin_citas():
    """Gestión de Citas & Agenda."""
    if not is_admin_authenticated():
        return redirect('/admin/login.php?error=no_auth')

    conn = database.get_db_connection()
    cursor = conn.cursor()
    citas = cursor.execute("""
        SELECT c.*, u.nombre AS cliente_nombre, u.apellido AS cliente_apellido,
               u.email AS cliente_email, u.telefono AS cliente_telefono
        FROM citas c
        INNER JOIN usuarios u ON c.usuario_id = u.id
        ORDER BY c.id DESC
    """).fetchall()
    
    citas_pendientes = cursor.execute("SELECT COUNT(*) FROM citas WHERE estado = 'Pendiente'").fetchone()[0]
    mensajes_no_leidos = cursor.execute("SELECT COUNT(*) FROM contactos WHERE leido = 0").fetchone()[0]
    conn.close()

    content = render_citas_content(citas)
    return render_admin_page('Citas & Reservas', 'Gestión de Citas & Agenda', 'citas.php', session['admin_user'], citas_pendientes, mensajes_no_leidos, content)


@app.route('/admin/servicios.php')
def admin_servicios():
    """Gestión de Catálogo de Servicios y Precios."""
    if not is_admin_authenticated():
        return redirect('/admin/login.php?error=no_auth')

    conn = database.get_db_connection()
    cursor = conn.cursor()
    categorias = cursor.execute("SELECT * FROM categorias ORDER BY id ASC").fetchall()
    servicios = cursor.execute("""
        SELECT s.*, c.nombre AS categoria_nombre
        FROM servicios s
        INNER JOIN categorias c ON s.categoria_id = c.id
        ORDER BY s.id ASC
    """).fetchall()
    
    citas_pendientes = cursor.execute("SELECT COUNT(*) FROM citas WHERE estado = 'Pendiente'").fetchone()[0]
    mensajes_no_leidos = cursor.execute("SELECT COUNT(*) FROM contactos WHERE leido = 0").fetchone()[0]
    conn.close()

    content = render_servicios_content(servicios, categorias)
    return render_admin_page('Servicios', 'Gestión de Servicios & Precios', 'servicios.php', session['admin_user'], citas_pendientes, mensajes_no_leidos, content)


@app.route('/admin/usuarios.php')
def admin_usuarios():
    """Gestión de Usuarios y Roles."""
    if not is_admin_authenticated():
        return redirect('/admin/login.php?error=no_auth')

    conn = database.get_db_connection()
    cursor = conn.cursor()
    roles = cursor.execute("SELECT * FROM roles ORDER BY id ASC").fetchall()
    usuarios = cursor.execute("""
        SELECT u.*, r.nombre AS rol_nombre
        FROM usuarios u
        INNER JOIN roles r ON u.rol_id = r.id
        ORDER BY u.id DESC
    """).fetchall()
    
    citas_pendientes = cursor.execute("SELECT COUNT(*) FROM citas WHERE estado = 'Pendiente'").fetchone()[0]
    mensajes_no_leidos = cursor.execute("SELECT COUNT(*) FROM contactos WHERE leido = 0").fetchone()[0]
    conn.close()

    content = render_usuarios_content(usuarios, roles)
    return render_admin_page('Usuarios', 'Gestión de Usuarios & Roles', 'usuarios.php', session['admin_user'], citas_pendientes, mensajes_no_leidos, content)


@app.route('/admin/resenas.php')
def admin_resenas():
    """Gestión de Reseñas y Testimonios."""
    if not is_admin_authenticated():
        return redirect('/admin/login.php?error=no_auth')

    conn = database.get_db_connection()
    cursor = conn.cursor()
    resenas = cursor.execute("""
        SELECT r.*, u.nombre AS usuario_nombre, u.apellido AS usuario_apellido, u.email AS usuario_email,
               s.nombre AS servicio_nombre
        FROM resenas r
        INNER JOIN usuarios u ON r.usuario_id = u.id
        LEFT JOIN servicios s ON r.servicio_id = s.id
        ORDER BY r.id DESC
    """).fetchall()
    
    citas_pendientes = cursor.execute("SELECT COUNT(*) FROM citas WHERE estado = 'Pendiente'").fetchone()[0]
    mensajes_no_leidos = cursor.execute("SELECT COUNT(*) FROM contactos WHERE leido = 0").fetchone()[0]
    conn.close()

    content = render_resenas_content(resenas)
    return render_admin_page('Reseñas', 'Gestión de Reseñas & Opiniones', 'resenas.php', session['admin_user'], citas_pendientes, mensajes_no_leidos, content)


@app.route('/admin/mensajes.php')
def admin_mensajes():
    """Gestión de Mensajes de Contacto."""
    if not is_admin_authenticated():
        return redirect('/admin/login.php?error=no_auth')

    conn = database.get_db_connection()
    cursor = conn.cursor()
    mensajes = cursor.execute("SELECT * FROM contactos ORDER BY id DESC").fetchall()
    citas_pendientes = cursor.execute("SELECT COUNT(*) FROM citas WHERE estado = 'Pendiente'").fetchone()[0]
    mensajes_no_leidos = cursor.execute("SELECT COUNT(*) FROM contactos WHERE leido = 0").fetchone()[0]
    conn.close()

    content = render_mensajes_content(mensajes)
    return render_admin_page('Mensajes', 'Mensajes de Contacto Recibidos', 'mensajes.php', session['admin_user'], citas_pendientes, mensajes_no_leidos, content)


# =============================================================================
# 4. API ADMINISTRATIVA UNIFICADA (CRUD & AJAX)
# =============================================================================

@app.route('/admin/api_admin.php', methods=['GET', 'POST', 'OPTIONS'])
@app.route('/admin/api_admin', methods=['GET', 'POST', 'OPTIONS'])
def admin_api():
    """Manejo de operaciones AJAX del panel administrativo."""
    if request.method == 'OPTIONS':
        return '', 200

    if not is_admin_authenticated():
        return json_response(False, 'Acceso denegado. Se requieren privilegios de Administrador.', status_code=403)

    action = request.args.get('action') or request.form.get('action') or ''
    input_data = request.get_json(silent=True) or request.form.to_dict()
    if not action:
        action = input_data.get('action', '')

    conn = database.get_db_connection()
    cursor = conn.cursor()

    try:
        # --- 1. USUARIOS ---
        if action == 'usuario_obtener':
            user_id = int(request.args.get('id') or input_data.get('id', 0))
            cursor.execute("""
                SELECT u.id, u.rol_id, u.nombre, u.apellido, u.email, u.telefono,
                       u.descuento_vip, u.estado, r.nombre AS rol_nombre
                FROM usuarios u
                INNER JOIN roles r ON u.rol_id = r.id
                WHERE u.id = ?
            """, (user_id,))
            user = cursor.fetchone()
            if user:
                return json_response(True, 'Usuario obtenido', dict(user))
            return json_response(False, 'Usuario no encontrado', status_code=404)

        elif action == 'usuario_crear':
            nombre = str(input_data.get('nombre', '')).strip()
            apellido = str(input_data.get('apellido', '')).strip()
            email = str(input_data.get('email', '')).strip().lower()
            telefono = str(input_data.get('telefono', '')).strip()
            password = str(input_data.get('password', '')).strip()
            rol_id = int(input_data.get('rol_id', 2))
            estado = input_data.get('estado', 'activo') if input_data.get('estado') in ('activo', 'inactivo', 'bloqueado') else 'activo'
            descuento = float(input_data.get('descuento_vip', 0))

            if not nombre or not email or not password:
                return json_response(False, 'Nombre, correo y contraseña son obligatorios.', status_code=400)

            cursor.execute("SELECT id FROM usuarios WHERE LOWER(email) = ?", (email,))
            if cursor.fetchone():
                return json_response(False, 'Ya existe un usuario registrado con este correo.', status_code=409)

            pwd_hash = database.hash_password(password)
            cursor.execute("""
                INSERT INTO usuarios (rol_id, nombre, apellido, email, telefono, password_hash, descuento_vip, estado)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (rol_id, nombre, apellido, email, telefono, pwd_hash, descuento, estado))
            conn.commit()
            return json_response(True, f'Usuario creado exitosamente con ID #{cursor.lastrowid}')

        elif action == 'usuario_editar':
            user_id = int(input_data.get('id', 0))
            nombre = str(input_data.get('nombre', '')).strip()
            apellido = str(input_data.get('apellido', '')).strip()
            email = str(input_data.get('email', '')).strip().lower()
            telefono = str(input_data.get('telefono', '')).strip()
            password = str(input_data.get('password', '')).strip()
            rol_id = int(input_data.get('rol_id', 2))
            estado = input_data.get('estado', 'activo') if input_data.get('estado') in ('activo', 'inactivo', 'bloqueado') else 'activo'
            descuento = float(input_data.get('descuento_vip', 0))

            if user_id <= 0 or not nombre or not email:
                return json_response(False, 'Datos incompletos para actualizar usuario.', status_code=400)

            cursor.execute("SELECT id FROM usuarios WHERE LOWER(email) = ? AND id != ?", (email, user_id))
            if cursor.fetchone():
                return json_response(False, 'El correo electrónico ya pertenece a otro usuario.', status_code=409)

            if password:
                pwd_hash = database.hash_password(password)
                cursor.execute("""
                    UPDATE usuarios SET rol_id = ?, nombre = ?, apellido = ?, email = ?, telefono = ?,
                                        password_hash = ?, descuento_vip = ?, estado = ?
                    WHERE id = ?
                """, (rol_id, nombre, apellido, email, telefono, pwd_hash, descuento, estado, user_id))
            else:
                cursor.execute("""
                    UPDATE usuarios SET rol_id = ?, nombre = ?, apellido = ?, email = ?, telefono = ?,
                                        descuento_vip = ?, estado = ?
                    WHERE id = ?
                """, (rol_id, nombre, apellido, email, telefono, descuento, estado, user_id))

            conn.commit()
            return json_response(True, 'Usuario actualizado correctamente.')

        elif action == 'usuario_eliminar':
            user_id = int(input_data.get('id', 0))
            if user_id <= 0:
                return json_response(False, 'ID de usuario inválido.', status_code=400)

            current_admin = session.get('admin_user', {})
            if user_id == int(current_admin.get('id', 0)):
                return json_response(False, 'No puedes eliminar tu propia cuenta de administrador en sesión activa.', status_code=403)

            try:
                cursor.execute("DELETE FROM usuarios WHERE id = ?", (user_id,))
                conn.commit()
                return json_response(True, 'Usuario eliminado de la base de datos.')
            except Exception:
                cursor.execute("UPDATE usuarios SET estado = 'bloqueado' WHERE id = ?", (user_id,))
                conn.commit()
                return json_response(True, 'El usuario tiene citas o datos históricos asociados. Su estado se ha cambiado a "Bloqueado".')

        # --- 2. SERVICIOS ---
        elif action == 'servicio_obtener':
            srv_id = int(request.args.get('id') or input_data.get('id', 0))
            cursor.execute("""
                SELECT s.*, c.nombre AS categoria_nombre
                FROM servicios s
                INNER JOIN categorias c ON s.categoria_id = c.id
                WHERE s.id = ?
            """, (srv_id,))
            srv = cursor.fetchone()
            if srv:
                return json_response(True, 'Servicio encontrado', dict(srv))
            return json_response(False, 'Servicio no encontrado', status_code=404)

        elif action == 'servicio_crear':
            categoria_id = int(input_data.get('categoria_id', 1))
            nombre = str(input_data.get('nombre', '')).strip()
            descripcion = str(input_data.get('descripcion', '')).strip()
            precio = float(input_data.get('precio', 0))
            duracion = int(input_data.get('duracion_minutos', 60))
            imagen = str(input_data.get('imagen', 'images/service_acrilicas.jpg')).strip()
            url_detalle = str(input_data.get('url_detalle', 'servicios.html')).strip()
            destacado = 1 if input_data.get('destacado') else 0
            estado = input_data.get('estado', 'activo') if input_data.get('estado') in ('activo', 'inactivo') else 'activo'

            if not nombre or precio <= 0:
                return json_response(False, 'El nombre y precio válido son obligatorios.', status_code=400)

            slug = re.sub(r'[^a-zA-Z0-9-]+', '-', nombre).lower().strip('-')
            cursor.execute("SELECT id FROM servicios WHERE slug = ?", (slug,))
            if cursor.fetchone():
                slug = f"{slug}-{int(datetime.datetime.now().timestamp())}"

            cursor.execute("""
                INSERT INTO servicios (categoria_id, nombre, slug, descripcion, precio, moneda, duracion_minutos, imagen, url_detalle, destacado, calificacion, estado)
                VALUES (?, ?, ?, ?, ?, 'Bs.', ?, ?, ?, ?, 5.0, ?)
            """, (categoria_id, nombre, slug, descripcion, precio, duracion, imagen, url_detalle, destacado, estado))
            conn.commit()
            return json_response(True, f'Servicio creado exitosamente con ID #{cursor.lastrowid}')

        elif action == 'servicio_editar':
            srv_id = int(input_data.get('id', 0))
            categoria_id = int(input_data.get('categoria_id', 1))
            nombre = str(input_data.get('nombre', '')).strip()
            descripcion = str(input_data.get('descripcion', '')).strip()
            precio = float(input_data.get('precio', 0))
            duracion = int(input_data.get('duracion_minutos', 60))
            imagen = str(input_data.get('imagen', 'images/service_acrilicas.jpg')).strip()
            url_detalle = str(input_data.get('url_detalle', 'servicios.html')).strip()
            destacado = 1 if input_data.get('destacado') else 0
            estado = input_data.get('estado', 'activo') if input_data.get('estado') in ('activo', 'inactivo') else 'activo'

            if srv_id <= 0 or not nombre or precio <= 0:
                return json_response(False, 'Datos incompletos para actualizar servicio.', status_code=400)

            cursor.execute("""
                UPDATE servicios
                SET categoria_id = ?, nombre = ?, descripcion = ?, precio = ?, duracion_minutos = ?,
                    imagen = ?, url_detalle = ?, destacado = ?, estado = ?
                WHERE id = ?
            """, (categoria_id, nombre, descripcion, precio, duracion, imagen, url_detalle, destacado, estado, srv_id))
            conn.commit()
            return json_response(True, 'Servicio actualizado correctamente.')

        elif action == 'servicio_eliminar':
            srv_id = int(input_data.get('id', 0))
            if srv_id <= 0:
                return json_response(False, 'ID de servicio inválido.', status_code=400)

            try:
                cursor.execute("DELETE FROM servicios WHERE id = ?", (srv_id,))
                conn.commit()
                return json_response(True, 'Servicio eliminado permanentemente.')
            except Exception:
                cursor.execute("UPDATE servicios SET estado = 'inactivo' WHERE id = ?", (srv_id,))
                conn.commit()
                return json_response(True, 'El servicio tiene citas históricas asociadas. Se cambió su estado a "Inactivo".')

        # --- 3. CITAS ---
        elif action == 'cita_cambiar_estado':
            cita_id = int(input_data.get('id', 0))
            nuevo_estado = str(input_data.get('estado', '')).strip()
            estados_permitidos = ['Pendiente', 'Confirmada', 'Cancelada', 'Completada']

            if cita_id <= 0 or nuevo_estado not in estados_permitidos:
                return json_response(False, 'Estado o ID de cita inválido.', status_code=400)

            cursor.execute("UPDATE citas SET estado = ? WHERE id = ?", (nuevo_estado, cita_id))
            conn.commit()
            return json_response(True, f"Estado de la cita #{cita_id} actualizado a '{nuevo_estado}'.")

        elif action == 'cita_detalle':
            cita_id = int(request.args.get('id') or input_data.get('id', 0))
            if cita_id <= 0:
                return json_response(False, 'ID de cita inválido.', status_code=400)

            cursor.execute("""
                SELECT c.*, u.nombre AS cliente_nombre, u.apellido AS cliente_apellido,
                       u.email AS cliente_email, u.telefono AS cliente_telefono
                FROM citas c
                INNER JOIN usuarios u ON c.usuario_id = u.id
                WHERE c.id = ?
            """, (cita_id,))
            cita = cursor.fetchone()
            if not cita:
                return json_response(False, 'Cita no encontrada.', status_code=404)

            cita_dict = dict(cita)
            cursor.execute("""
                SELECT d.*, s.nombre AS servicio_nombre, s.imagen AS servicio_imagen
                FROM detalle_cita d
                INNER JOIN servicios s ON d.servicio_id = s.id
                WHERE d.cita_id = ?
            """, (cita_id,))
            cita_dict['servicios'] = [dict(s) for s in cursor.fetchall()]
            return json_response(True, 'Detalle de cita cargado', cita_dict)

        # --- 4. RESEÑAS ---
        elif action == 'resena_toggle_publicado':
            res_id = int(input_data.get('id', 0))
            publicado = 1 if input_data.get('publicado') else 0
            cursor.execute("UPDATE resenas SET publicado = ? WHERE id = ?", (publicado, res_id))
            conn.commit()
            return json_response(True, 'Estado de publicación de la reseña actualizado.')

        elif action == 'resena_eliminar':
            res_id = int(input_data.get('id', 0))
            cursor.execute("DELETE FROM resenas WHERE id = ?", (res_id,))
            conn.commit()
            return json_response(True, 'Reseña eliminada correctamente.')

        # --- 5. MENSAJES ---
        elif action == 'mensaje_marcar_leido':
            msg_id = int(input_data.get('id', 0))
            leido = 1 if input_data.get('leido') else 0
            cursor.execute("UPDATE contactos SET leido = ? WHERE id = ?", (leido, msg_id))
            conn.commit()
            return json_response(True, 'Estado del mensaje actualizado.')

        elif action == 'mensaje_eliminar':
            msg_id = int(input_data.get('id', 0))
            cursor.execute("DELETE FROM contactos WHERE id = ?", (msg_id,))
            conn.commit()
            return json_response(True, 'Mensaje de contacto eliminado.')

        else:
            return json_response(False, f'Acción administrativa no válida: {action}', status_code=400)

    except Exception as e:
        return json_response(False, f'Error en el servidor: {str(e)}', status_code=500)
    finally:
        conn.close()


# =============================================================================
# 5. RENDERIZADORES HTML DE VISTAS ADMINISTRATIVAS
# =============================================================================

def render_admin_page(page_title, page_heading, active_page, admin, citas_pendientes, mensajes_no_leidos, content, extra_scripts=""):
    """Plantilla Maestra del Panel Administrativo."""
    badge_citas = f'<span class="nav-badge">{citas_pendientes}</span>' if citas_pendientes > 0 else ''
    badge_msgs = f'<span class="nav-badge">{mensajes_no_leidos}</span>' if mensajes_no_leidos > 0 else ''
    admin_name = f"{admin.get('nombre', 'Admin')} {admin.get('apellido', '')}".strip()
    admin_initial = admin_name[0].upper() if admin_name else 'A'
    admin_role = admin.get('rol', 'Administrador')

    return f"""<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{page_title} — NailArtist Studio</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400..900;1,400..900&family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="/admin/assets/css/admin.css">
</head>
<body>
<div class="admin-container">
    <div id="sidebar-overlay" class="modal-overlay"></div>
    <aside id="admin-sidebar" class="admin-sidebar">
        <div class="sidebar-header">
            <a href="/admin/index.php" class="sidebar-logo">
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
                    <a href="/admin/index.php" class="nav-link {'active' if active_page == 'index.php' else ''}">
                        <span class="nav-icon">📊</span>
                        <span>Dashboard</span>
                    </a>
                </li>
            </ul>
            <div class="nav-section-title">Gestión de Negocio</div>
            <ul class="nav-list">
                <li>
                    <a href="/admin/citas.php" class="nav-link {'active' if active_page == 'citas.php' else ''}">
                        <span class="nav-icon">📅</span>
                        <span>Citas & Reservas</span>
                        {badge_citas}
                    </a>
                </li>
                <li>
                    <a href="/admin/servicios.php" class="nav-link {'active' if active_page == 'servicios.php' else ''}">
                        <span class="nav-icon">💅</span>
                        <span>Servicios & Precios</span>
                    </a>
                </li>
                <li>
                    <a href="/admin/usuarios.php" class="nav-link {'active' if active_page == 'usuarios.php' else ''}">
                        <span class="nav-icon">👥</span>
                        <span>Usuarios & Roles</span>
                    </a>
                </li>
            </ul>
            <div class="nav-section-title">Interacción & Feedback</div>
            <ul class="nav-list">
                <li>
                    <a href="/admin/resenas.php" class="nav-link {'active' if active_page == 'resenas.php' else ''}">
                        <span class="nav-icon">⭐</span>
                        <span>Reseñas & Opiniones</span>
                    </a>
                </li>
                <li>
                    <a href="/admin/mensajes.php" class="nav-link {'active' if active_page == 'mensajes.php' else ''}">
                        <span class="nav-icon">💌</span>
                        <span>Mensajes de Contacto</span>
                        {badge_msgs}
                    </a>
                </li>
            </ul>
        </nav>
        <div class="sidebar-footer">
            <div class="user-profile-widget">
                <div class="user-avatar">{admin_initial}</div>
                <div class="user-info">
                    <div class="user-name">{admin_name}</div>
                    <div class="user-role">👑 {admin_role}</div>
                </div>
                <a href="/admin/logout.php" class="btn-logout" title="Cerrar Sesión">🚪</a>
            </div>
        </div>
    </aside>
    <div class="admin-main">
        <header class="admin-topbar">
            <div class="topbar-left">
                <button id="mobile-sidebar-toggle" class="mobile-toggle-btn" aria-label="Abrir Menú">☰</button>
                <h2 class="page-title">{page_heading}</h2>
            </div>
            <div class="topbar-right">
                <a href="/index.html" target="_blank" class="btn-view-site">
                    <span>🌐 Ver Sitio Web</span>
                    <span>↗</span>
                </a>
            </div>
        </header>
        <main class="admin-content">
            {content}
        </main>
    </div>
</div>
<script src="/admin/assets/js/admin.js"></script>
{extra_scripts}
</body>
</html>"""


def render_dashboard_content(total_usuarios, total_clientes, total_manicuristas, total_servicios,
                             total_citas, citas_pendientes, citas_confirmadas, citas_completadas,
                             ingresos_totales, promedio_calif, ultimas_citas, ultimos_mensajes, ultimas_resenas):
    """Genera el contenido dinámico del Dashboard."""
    # Filas de citas
    citas_rows = ""
    if not ultimas_citas:
        citas_rows = '<tr><td colspan="6" style="text-align: center; padding: 24px; color: var(--text-muted);">No hay citas registradas en el sistema.</td></tr>'
    else:
        for c in ultimas_citas:
            badge_class = 'badge-pending'
            if c['estado'] == 'Confirmada': badge_class = 'badge-confirmed'
            elif c['estado'] == 'Completada': badge_class = 'badge-completed'
            elif c['estado'] == 'Cancelada': badge_class = 'badge-canceled'
            
            citas_rows += f"""<tr>
                <td><strong style="color: var(--pink-vivid);">{c['codigo_reserva']}</strong></td>
                <td><strong>{c['cliente_nombre']} {c['cliente_apellido'] or ''}</strong><br><small style="color: var(--text-muted);">{c['cliente_telefono'] or 'Sin teléfono'}</small></td>
                <td>📅 {c['fecha_cita']}<br><small style="color: var(--text-muted);">⏰ {c['hora_cita'][:5]} hrs</small></td>
                <td><strong>Bs. {float(c['total_final_bs']):.2f}</strong></td>
                <td><span class="badge {badge_class}">{c['estado']}</span></td>
                <td><a href="/admin/citas.php" class="btn-action">Gestionar</a></td>
            </tr>"""

    # Mensajes
    msgs_rows = ""
    if not ultimos_mensajes:
        msgs_rows = '<p style="text-align: center; color: var(--text-muted); padding: 16px;">No hay mensajes recibidos.</p>'
    else:
        for m in ultimos_mensajes:
            leido_badge = '<span style="color: var(--pink-vivid); font-size: 0.75rem;">● Nuevo</span>' if not m['leido'] else ''
            msgs_rows += f"""<div style="padding: 12px 0; border-bottom: 1px solid var(--border-color);">
                <div style="display: flex; justify-content: space-between; font-weight: 700; font-size: 0.9rem;">
                    <span>{m['nombre']} {leido_badge}</span>
                    <small style="color: var(--text-muted); font-weight: 400;">{m['fecha_envio'][:10]}</small>
                </div>
                <p style="font-size: 0.84rem; color: var(--text-muted); margin-top: 4px;">{m['mensaje']}</p>
            </div>"""

    # Reseñas
    resenas_rows = ""
    if not ultimas_resenas:
        resenas_rows = '<p style="text-align: center; color: var(--text-muted); padding: 16px;">No hay reseñas de clientas aún.</p>'
    else:
        for r in ultimas_resenas:
            stars = '★' * int(r['calificacion'])
            resenas_rows += f"""<div style="padding: 12px 0; border-bottom: 1px solid var(--border-color);">
                <div style="display: flex; justify-content: space-between; font-weight: 700;">
                    <span>{r['usuario_nombre']} <small style="color: var(--pink-vivid); font-weight: 400;">({r['servicio_nombre'] or 'General'})</small></span>
                    <span style="color: var(--gold-accent);">{stars}</span>
                </div>
                <p style="font-size: 0.84rem; color: var(--text-muted); margin-top: 4px; font-style: italic;">"{r['comentario']}"</p>
            </div>"""

    return f"""
    <div class="stats-grid">
        <div class="stat-card">
            <div class="stat-icon pink">👥</div>
            <div class="stat-data">
                <span class="stat-label">Total Usuarios</span>
                <span class="stat-value">{total_usuarios}</span>
                <span class="stat-sub">💖 {total_clientes} Clientas VIP &nbsp;|&nbsp; 👑 {total_usuarios - total_clientes - total_manicuristas} Admins</span>
            </div>
        </div>
        <div class="stat-card">
            <div class="stat-icon purple">💅</div>
            <div class="stat-data">
                <span class="stat-label">Manicuristas</span>
                <span class="stat-value">{total_manicuristas}</span>
                <span class="stat-sub">Especialistas de Estudio</span>
            </div>
        </div>
        <div class="stat-card">
            <div class="stat-icon gold">✨</div>
            <div class="stat-data">
                <span class="stat-label">Servicios Activos</span>
                <span class="stat-value">{total_servicios}</span>
                <span class="stat-sub">En catálogo oficial</span>
            </div>
        </div>
        <div class="stat-card">
            <div class="stat-icon green">📅</div>
            <div class="stat-data">
                <span class="stat-label">Total Citas</span>
                <span class="stat-value">{total_citas}</span>
                <span class="stat-sub">⏳ {citas_pendientes} Pendientes &nbsp;|&nbsp; ✅ {citas_confirmadas + citas_completadas} Activas</span>
            </div>
        </div>
    </div>

    <div class="stats-grid" style="grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));">
        <div class="stat-card" style="background: linear-gradient(135deg, #240e1b 0%, #3d142f 100%); color: #ffffff;">
            <div class="stat-icon" style="background: var(--gold-gradient); color: #170914;">💰</div>
            <div class="stat-data">
                <span class="stat-label" style="color: var(--pink-soft);">Ingresos Estimados Confirmados</span>
                <span class="stat-value" style="color: #ffffff;">Bs. {ingresos_totales:.2f}</span>
                <span class="stat-sub" style="color: rgba(255,255,255,0.7);">Cálculo sobre citas confirmadas y completadas</span>
            </div>
        </div>
        <div class="stat-card" style="background: linear-gradient(135deg, #fff0f6 0%, #ffffff 100%);">
            <div class="stat-icon gold">⭐</div>
            <div class="stat-data">
                <span class="stat-label">Calificación Promedio</span>
                <span class="stat-value" style="color: var(--text-main);">{promedio_calif:.1f} / 5.0</span>
                <span class="stat-sub">Basado en reseñas publicadas de clientas</span>
            </div>
        </div>
    </div>

    <div class="admin-card">
        <div class="card-header">
            <h3 class="card-title">📅 Últimas Citas y Reservas Recibidas</h3>
            <div class="card-actions">
                <a href="/admin/citas.php" class="btn-action">Ver Todas las Citas →</a>
            </div>
        </div>
        <div class="card-body" style="padding: 0;">
            <div class="table-responsive">
                <table class="admin-table">
                    <thead>
                        <tr>
                            <th>Código</th>
                            <th>Clienta</th>
                            <th>Fecha & Hora</th>
                            <th>Total</th>
                            <th>Estado</th>
                            <th>Acción</th>
                        </tr>
                    </thead>
                    <tbody>
                        {citas_rows}
                    </tbody>
                </table>
            </div>
        </div>
    </div>

    <div class="stats-grid" style="grid-template-columns: 1fr 1fr;">
        <div class="admin-card">
            <div class="card-header">
                <h3 class="card-title">💌 Mensajes de Contacto Recientes</h3>
                <a href="/admin/mensajes.php" class="btn-action">Ver Todos →</a>
            </div>
            <div class="card-body">
                {msgs_rows}
            </div>
        </div>

        <div class="admin-card">
            <div class="card-header">
                <h3 class="card-title">⭐ Últimas Reseñas de Clientas</h3>
                <a href="/admin/resenas.php" class="btn-action">Gestionar →</a>
            </div>
            <div class="card-body">
                {resenas_rows}
            </div>
        </div>
    </div>
    """


def render_citas_content(citas):
    """Genera la vista de gestión de citas."""
    rows = ""
    if not citas:
        rows = '<tr><td colspan="8" style="text-align:center; padding:30px; color:var(--text-muted);">No hay citas registradas.</td></tr>'
    else:
        for c in citas:
            desc_badge = f"<div style='font-size:0.75rem; color:#15803d;'>- Bs. {float(c['descuento_aplicado']):.2f} (VIP)</div>" if c['descuento_aplicado'] > 0 else ""
            badge_class = 'badge-pending'
            if c['estado'] == 'Confirmada': badge_class = 'badge-confirmed'
            elif c['estado'] == 'Completada': badge_class = 'badge-completed'
            elif c['estado'] == 'Cancelada': badge_class = 'badge-canceled'

            rows += f"""<tr id="fila-cita-{c['id']}" data-estado="{c['estado']}">
                <td><strong style="color:var(--pink-vivid);">{c['codigo_reserva']}</strong></td>
                <td><strong>{c['cliente_nombre']} {c['cliente_apellido'] or ''}</strong><br><small style="color:var(--text-muted);">📞 {c['cliente_telefono'] or 'Sin tel'}</small></td>
                <td>📅 {c['fecha_cita']}<br><small style="color:var(--text-muted);">⏰ {c['hora_cita'][:5]} hrs</small></td>
                <td><strong>Bs. {float(c['total_final_bs']):.2f}</strong>{desc_badge}</td>
                <td><span class="badge" style="background:#e0f2fe; color:#0369a1;">💬 {c['metodo_contacto'] or 'WhatsApp'}</span></td>
                <td><span class="badge {badge_class}" id="badge-estado-{c['id']}">{c['estado']}</span></td>
                <td>
                    <select class="form-control form-control-sm" style="padding:4px 8px; font-size:0.8rem;" onchange="cambiarEstadoCita({c['id']}, this.value)">
                        <option value="Pendiente" {'selected' if c['estado'] == 'Pendiente' else ''}>⏳ Pendiente</option>
                        <option value="Confirmada" {'selected' if c['estado'] == 'Confirmada' else ''}>✅ Confirmada</option>
                        <option value="Completada" {'selected' if c['estado'] == 'Completada' else ''}>🎉 Completada</option>
                        <option value="Cancelada" {'selected' if c['estado'] == 'Cancelada' else ''}>❌ Cancelada</option>
                    </select>
                </td>
                <td>
                    <button class="btn-action" onclick="verDetalleCita({c['id']})">🔍 Ver</button>
                </td>
            </tr>"""

    return f"""
    <div class="admin-card">
        <div class="card-header">
            <h3 class="card-title">📅 Agenda Oficial de Citas & Reservas</h3>
        </div>
        <div class="card-body">
            <div class="filter-bar">
                <input type="text" class="search-input" data-table-search="tabla-citas" placeholder="🔍 Buscar por código, clienta o teléfono...">
                <select class="filter-select" id="filtro-estado-citas" onchange="filtrarCitas()">
                    <option value="">Todos los Estados</option>
                    <option value="Pendiente">⏳ Pendientes</option>
                    <option value="Confirmada">✅ Confirmadas</option>
                    <option value="Completada">🎉 Completadas</option>
                    <option value="Cancelada">❌ Canceladas</option>
                </select>
            </div>
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
                        {rows}
                    </tbody>
                </table>
            </div>
        </div>
    </div>

    <!-- Modal Detalle Cita -->
    <div id="modal-detalle-cita" class="modal-overlay">
        <div class="admin-modal">
            <div class="modal-header">
                <h3 class="modal-title" id="modal-cita-titulo">Detalle de Cita</h3>
                <button class="modal-close-btn" data-close-modal>✕</button>
            </div>
            <div class="modal-body" id="modal-cita-body">
                <p>Cargando información...</p>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn-secondary" data-close-modal>Cerrar</button>
            </div>
        </div>
    </div>

    <script>
        function filtrarCitas() {{
            const estado = document.getElementById('filtro-estado-citas').value;
            const rows = document.querySelectorAll('#tabla-citas tbody tr');
            rows.forEach(r => {{
                const rEstado = r.getAttribute('data-estado');
                r.style.display = (!estado || rEstado === estado) ? '' : 'none';
            }});
        }}

        async function cambiarEstadoCita(id, estado) {{
            const res = await apiAdminRequest('cita_cambiar_estado', {{ id, estado }});
            if (res.success) {{
                showAdminToast(res.message, 'success');
                const badge = document.getElementById(`badge-estado-${{id}}`);
                if (badge) {{
                    badge.innerText = estado;
                    badge.className = `badge badge-${{estado === 'Pendiente' ? 'pending' : (estado === 'Confirmada' ? 'confirmed' : (estado === 'Completada' ? 'completed' : 'canceled'))}}`;
                }}
                document.getElementById(`fila-cita-${{id}}`).setAttribute('data-estado', estado);
            }} else {{
                showAdminToast(res.message, 'error');
            }}
        }}

        async function verDetalleCita(id) {{
            openAdminModal('modal-detalle-cita');
            const res = await apiAdminRequest('cita_detalle', {{ id }}, 'GET');
            if (res.success) {{
                const c = res.data;
                let srvList = '';
                if (c.servicios && c.servicios.length > 0) {{
                    srvList = c.servicios.map(s => `<li><strong>${{s.servicio_nombre}}</strong> (x${{s.cantidad}}) — Bs. ${{s.subtotal}}</li>`).join('');
                }} else {{
                    srvList = '<li>Sin servicios especificados</li>';
                }}

                document.getElementById('modal-cita-titulo').innerText = `Cita #${{c.id}} — ${{c.codigo_reserva}}`;
                document.getElementById('modal-cita-body').innerHTML = `
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:16px;">
                        <div>
                            <p><strong>Clienta:</strong> ${{c.cliente_nombre}} ${{c.cliente_apellido || ''}}</p>
                            <p><strong>Email:</strong> ${{c.cliente_email}}</p>
                            <p><strong>Teléfono:</strong> ${{c.cliente_telefono || 'No registrado'}}</p>
                        </div>
                        <div>
                            <p><strong>Fecha Cita:</strong> ${{c.fecha_cita}}</p>
                            <p><strong>Hora:</strong> ${{c.hora_cita}}</p>
                            <p><strong>Estado:</strong> <span class="badge badge-confirmed">${{c.estado}}</span></p>
                        </div>
                    </div>
                    <div style="background:var(--pink-light); padding:14px; border-radius:10px; margin-bottom:16px;">
                        <h4 style="margin-bottom:8px; color:var(--pink-vivid);">💅 Servicios Agendados:</h4>
                        <ul style="padding-left:20px; line-height:1.6;">${{srvList}}</ul>
                        <div style="margin-top:10px; font-size:1.05rem; font-weight:800; text-align:right; border-top:1px dashed #fbcfe8; padding-top:8px;">
                            Total a Cobrar: <span style="color:var(--pink-vivid);">Bs. ${{parseFloat(c.total_final_bs).toFixed(2)}}</span>
                        </div>
                    </div>
                    <div>
                        <strong>Observaciones:</strong>
                        <p style="color:var(--text-muted); font-size:0.9rem; margin-top:4px;">${{c.observaciones || 'Ninguna observación.'}}</p>
                    </div>
                `;
            }} else {{
                document.getElementById('modal-cita-body').innerHTML = `<p style="color:red;">${{res.message}}</p>`;
            }}
        }}
    </script>
    """


def render_servicios_content(servicios, categorias):
    """Genera la vista de catálogo de servicios."""
    cats_options = "".join([f"<option value='{c['id']}'>{c['nombre']}</option>" for c in categorias])
    rows = ""
    for s in servicios:
        status_badge = '<span class="badge badge-confirmed">Activo</span>' if s['estado'] == 'activo' else '<span class="badge badge-canceled">Inactivo</span>'
        dest_badge = '⭐ Sí' if s['destacado'] else 'No'
        rows += f"""<tr id="fila-srv-{s['id']}" data-cat="{s['categoria_nombre']}" data-estado="{s['estado']}">
            <td><strong>#{s['id']}</strong></td>
            <td><img src="/{s['imagen']}" alt="{s['nombre']}" class="table-thumb" onerror="this.src='/images/service_acrilicas.jpg'"></td>
            <td><strong>{s['nombre']}</strong><br><small style="color:var(--text-muted);">{s['descripcion'][:60]}...</small></td>
            <td><span class="badge" style="background:#fdf2f8; color:#9d174d;">{s['categoria_nombre']}</span></td>
            <td><strong style="color:var(--pink-vivid);">Bs. {float(s['precio']):.2f}</strong></td>
            <td>⏱ {s['duracion_minutos']} min</td>
            <td>{dest_badge}</td>
            <td>{status_badge}</td>
            <td>
                <button class="btn-action" onclick="editarServicio({s['id']})">✏️</button>
                <button class="btn-action" style="color:red;" onclick="eliminarServicio({s['id']})">🗑️</button>
            </td>
        </tr>"""

    return f"""
    <div class="admin-card">
        <div class="card-header">
            <h3 class="card-title">💅 Catálogo Oficial de Servicios NailArtist</h3>
            <button class="btn-primary btn-sm" onclick="abrirModalCrearServicio()">➕ Nuevo Servicio</button>
        </div>
        <div class="card-body">
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
                    <tbody>{rows}</tbody>
                </table>
            </div>
        </div>
    </div>

    <!-- Modal Servicio -->
    <div id="modal-servicio" class="modal-overlay">
        <div class="admin-modal">
            <div class="modal-header">
                <h3 class="modal-title" id="modal-srv-titulo">Servicio</h3>
                <button class="modal-close-btn" data-close-modal>✕</button>
            </div>
            <form id="form-servicio" onsubmit="guardarServicio(event)">
                <input type="hidden" id="srv-id" name="id" value="0">
                <div class="modal-body">
                    <div class="form-group">
                        <label class="form-label">Nombre del Servicio *</label>
                        <input type="text" id="srv-nombre" name="nombre" class="form-control" required placeholder="Ej: Uñas Acrílicas XL">
                    </div>
                    <div class="form-grid-2">
                        <div class="form-group">
                            <label class="form-label">Categoría *</label>
                            <select id="srv-cat" name="categoria_id" class="form-control" required>{cats_options}</select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Precio en Bs. *</label>
                            <input type="number" step="0.5" id="srv-precio" name="precio" class="form-control" required placeholder="80.00">
                        </div>
                    </div>
                    <div class="form-grid-2">
                        <div class="form-group">
                            <label class="form-label">Duración Estimada (Minutos)</label>
                            <input type="number" id="srv-duracion" name="duracion_minutos" class="form-control" value="60">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Ruta de Imagen</label>
                            <input type="text" id="srv-imagen" name="imagen" class="form-control" value="images/service_acrilicas.jpg">
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Descripción Detallada</label>
                        <textarea id="srv-desc" name="descripcion" class="form-control" rows="3" placeholder="Detalle del servicio de uñas..."></textarea>
                    </div>
                    <div class="form-grid-2">
                        <div class="form-group">
                            <label class="form-label">Estado</label>
                            <select id="srv-estado" name="estado" class="form-control">
                                <option value="activo">Activo</option>
                                <option value="inactivo">Inactivo</option>
                            </select>
                        </div>
                        <div class="form-group" style="display:flex; align-items:center; gap:8px; margin-top:28px;">
                            <input type="checkbox" id="srv-destacado" name="destacado" value="1">
                            <label for="srv-destacado" style="font-weight:700;">Destacar en Inicio</label>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn-secondary" data-close-modal>Cancelar</button>
                    <button type="submit" class="btn-primary">Guardar Servicio</button>
                </div>
            </form>
        </div>
    </div>

    <script>
        function abrirModalCrearServicio() {{
            document.getElementById('form-servicio').reset();
            document.getElementById('srv-id').value = '0';
            document.getElementById('modal-srv-titulo').innerText = '➕ Nuevo Servicio de Uñas';
            openAdminModal('modal-servicio');
        }}

        async function editarServicio(id) {{
            const res = await apiAdminRequest('servicio_obtener', {{ id }}, 'GET');
            if (res.success) {{
                const s = res.data;
                document.getElementById('srv-id').value = s.id;
                document.getElementById('srv-nombre').value = s.nombre;
                document.getElementById('srv-cat').value = s.categoria_id;
                document.getElementById('srv-precio').value = s.precio;
                document.getElementById('srv-duracion').value = s.duracion_minutos;
                document.getElementById('srv-imagen').value = s.imagen;
                document.getElementById('srv-desc').value = s.descripcion;
                document.getElementById('srv-estado').value = s.estado;
                document.getElementById('srv-destacado').checked = s.destacado == 1;
                document.getElementById('modal-srv-titulo').innerText = `✏️ Editar Servicio #${{s.id}}`;
                openAdminModal('modal-servicio');
            }}
        }}

        async function guardarServicio(e) {{
            e.preventDefault();
            const id = parseInt(document.getElementById('srv-id').value);
            const action = id > 0 ? 'servicio_editar' : 'servicio_crear';
            const data = {{
                id: id,
                nombre: document.getElementById('srv-nombre').value,
                categoria_id: document.getElementById('srv-cat').value,
                precio: document.getElementById('srv-precio').value,
                duracion_minutos: document.getElementById('srv-duracion').value,
                imagen: document.getElementById('srv-imagen').value,
                descripcion: document.getElementById('srv-desc').value,
                estado: document.getElementById('srv-estado').value,
                destacado: document.getElementById('srv-destacado').checked ? 1 : 0
            }};

            const res = await apiAdminRequest(action, data);
            if (res.success) {{
                showAdminToast(res.message, 'success');
                closeAdminModal('modal-servicio');
                setTimeout(() => window.location.reload(), 800);
            }} else {{
                showAdminToast(res.message, 'error');
            }}
        }}

        async function eliminarServicio(id) {{
            if (confirm('¿Estás segura de eliminar este servicio del catálogo?')) {{
                const res = await apiAdminRequest('servicio_eliminar', {{ id }});
                if (res.success) {{
                    showAdminToast(res.message, 'success');
                    setTimeout(() => window.location.reload(), 800);
                }} else {{
                    showAdminToast(res.message, 'error');
                }}
            }}
        }}
    </script>
    """


def render_usuarios_content(usuarios, roles):
    """Genera la vista de gestión de usuarios."""
    roles_options = "".join([f"<option value='{r['id']}'>{r['nombre']}</option>" for r in roles])
    rows = ""
    for u in usuarios:
        role_badge = f"<span class='badge' style='background:#fef3c7; color:#92400e;'>👑 {u['rol_nombre']}</span>" if u['rol_id'] == 1 else f"<span class='badge' style='background:#fdf2f8; color:#9d174d;'>💖 {u['rol_nombre']}</span>"
        status_badge = '<span class="badge badge-confirmed">Activo</span>' if u['estado'] == 'activo' else '<span class="badge badge-canceled">Bloqueado</span>'
        rows += f"""<tr id="fila-usr-{u['id']}">
            <td><strong>#{u['id']}</strong></td>
            <td><strong>{u['nombre']} {u['apellido'] or ''}</strong></td>
            <td>{u['email']}</td>
            <td>{u['telefono'] or 'Sin teléfono'}</td>
            <td>{role_badge}</td>
            <td><strong style="color:#15803d;">{float(u['descuento_vip'])}%</strong></td>
            <td>{status_badge}</td>
            <td>
                <button class="btn-action" onclick="editarUsuario({u['id']})">✏️</button>
                <button class="btn-action" style="color:red;" onclick="eliminarUsuario({u['id']})">🗑️</button>
            </td>
        </tr>"""

    return f"""
    <div class="admin-card">
        <div class="card-header">
            <h3 class="card-title">👥 Listado General de Usuarios</h3>
            <button class="btn-primary btn-sm" onclick="abrirModalCrearUsuario()">➕ Nuevo Usuario</button>
        </div>
        <div class="card-body">
            <div class="table-responsive">
                <table class="admin-table" id="tabla-usuarios">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Nombre Completo</th>
                            <th>Email</th>
                            <th>Teléfono</th>
                            <th>Rol</th>
                            <th>Desc. VIP</th>
                            <th>Estado</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>{rows}</tbody>
                </table>
            </div>
        </div>
    </div>

    <!-- Modal Usuario -->
    <div id="modal-usuario" class="modal-overlay">
        <div class="admin-modal">
            <div class="modal-header">
                <h3 class="modal-title" id="modal-usr-titulo">Usuario</h3>
                <button class="modal-close-btn" data-close-modal>✕</button>
            </div>
            <form id="form-usuario" onsubmit="guardarUsuario(event)">
                <input type="hidden" id="usr-id" name="id" value="0">
                <div class="modal-body">
                    <div class="form-grid-2">
                        <div class="form-group">
                            <label class="form-label">Nombre *</label>
                            <input type="text" id="usr-nombre" class="form-control" required>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Apellido</label>
                            <input type="text" id="usr-apellido" class="form-control">
                        </div>
                    </div>
                    <div class="form-grid-2">
                        <div class="form-group">
                            <label class="form-label">Correo Electrónico *</label>
                            <input type="email" id="usr-email" class="form-control" required>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Teléfono</label>
                            <input type="text" id="usr-telefono" class="form-control">
                        </div>
                    </div>
                    <div class="form-grid-2">
                        <div class="form-group">
                            <label class="form-label">Rol de Sistema</label>
                            <select id="usr-rol" class="form-control">{roles_options}</select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Descuento VIP (%)</label>
                            <input type="number" id="usr-desc" class="form-control" value="15">
                        </div>
                    </div>
                    <div class="form-grid-2">
                        <div class="form-group">
                            <label class="form-label">Estado</label>
                            <select id="usr-estado" class="form-control">
                                <option value="activo">Activo</option>
                                <option value="inactivo">Inactivo</option>
                                <option value="bloqueado">Bloqueado</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Contraseña <small>(Dejar vacío para mantener)</small></label>
                            <input type="password" id="usr-pwd" class="form-control" placeholder="••••••••">
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn-secondary" data-close-modal>Cancelar</button>
                    <button type="submit" class="btn-primary">Guardar Usuario</button>
                </div>
            </form>
        </div>
    </div>

    <script>
        function abrirModalCrearUsuario() {{
            document.getElementById('form-usuario').reset();
            document.getElementById('usr-id').value = '0';
            document.getElementById('usr-pwd').required = true;
            document.getElementById('modal-usr-titulo').innerText = '➕ Registrar Nuevo Usuario';
            openAdminModal('modal-usuario');
        }}

        async function editarUsuario(id) {{
            const res = await apiAdminRequest('usuario_obtener', {{ id }}, 'GET');
            if (res.success) {{
                const u = res.data;
                document.getElementById('usr-id').value = u.id;
                document.getElementById('usr-nombre').value = u.nombre;
                document.getElementById('usr-apellido').value = u.apellido || '';
                document.getElementById('usr-email').value = u.email;
                document.getElementById('usr-telefono').value = u.telefono || '';
                document.getElementById('usr-rol').value = u.rol_id;
                document.getElementById('usr-desc').value = u.descuento_vip;
                document.getElementById('usr-estado').value = u.estado;
                document.getElementById('usr-pwd').required = false;
                document.getElementById('modal-usr-titulo').innerText = `✏️ Editar Usuario #${{u.id}}`;
                openAdminModal('modal-usuario');
            }}
        }}

        async function guardarUsuario(e) {{
            e.preventDefault();
            const id = parseInt(document.getElementById('usr-id').value);
            const action = id > 0 ? 'usuario_editar' : 'usuario_crear';
            const data = {{
                id: id,
                nombre: document.getElementById('usr-nombre').value,
                apellido: document.getElementById('usr-apellido').value,
                email: document.getElementById('usr-email').value,
                telefono: document.getElementById('usr-telefono').value,
                rol_id: document.getElementById('usr-rol').value,
                descuento_vip: document.getElementById('usr-desc').value,
                estado: document.getElementById('usr-estado').value,
                password: document.getElementById('usr-pwd').value
            }};

            const res = await apiAdminRequest(action, data);
            if (res.success) {{
                showAdminToast(res.message, 'success');
                closeAdminModal('modal-usuario');
                setTimeout(() => window.location.reload(), 800);
            }} else {{
                showAdminToast(res.message, 'error');
            }}
        }}

        async function eliminarUsuario(id) {{
            if (confirm('¿Estás segura de eliminar este usuario del sistema?')) {{
                const res = await apiAdminRequest('usuario_eliminar', {{ id }});
                if (res.success) {{
                    showAdminToast(res.message, 'success');
                    setTimeout(() => window.location.reload(), 800);
                }} else {{
                    showAdminToast(res.message, 'error');
                }}
            }}
        }}
    </script>
    """


def render_resenas_content(resenas):
    """Genera la vista de gestión de reseñas."""
    rows = ""
    if not resenas:
        rows = '<tr><td colspan="7" style="text-align:center; padding:24px; color:var(--text-muted);">No hay reseñas en la base de datos.</td></tr>'
    else:
        for r in resenas:
            stars = '★' * int(r['calificacion'])
            pub_badge = '<span class="badge badge-confirmed">Publicada</span>' if r['publicado'] else '<span class="badge badge-canceled">Oculta</span>'
            btn_toggle = "Ocultar" if r['publicado'] else "Publicar"
            target_pub = 0 if r['publicado'] else 1
            rows += f"""<tr>
                <td>#{r['id']}</td>
                <td><strong>{r['usuario_nombre']} {r['usuario_apellido'] or ''}</strong><br><small style="color:var(--text-muted);">{r['usuario_email']}</small></td>
                <td>{r['servicio_nombre'] or 'General'}</td>
                <td style="color:var(--gold-accent); font-size:1.1rem;">{stars}</td>
                <td><p style="font-size:0.86rem; font-style:italic;">"{r['comentario']}"</p></td>
                <td>{pub_badge}</td>
                <td>
                    <button class="btn-action" onclick="togglePublicadoResena({r['id']}, {target_pub})">{btn_toggle}</button>
                    <button class="btn-action" style="color:red;" onclick="eliminarResena({r['id']})">🗑️</button>
                </td>
            </tr>"""

    return f"""
    <div class="admin-card">
        <div class="card-header"><h3 class="card-title">⭐ Reseñas y Testimonios de Clientas</h3></div>
        <div class="card-body">
            <div class="table-responsive">
                <table class="admin-table">
                    <thead><tr><th>ID</th><th>Clienta</th><th>Servicio</th><th>Calificación</th><th>Comentario</th><th>Estado</th><th>Acciones</th></tr></thead>
                    <tbody>{rows}</tbody>
                </table>
            </div>
        </div>
    </div>
    <script>
        async function togglePublicadoResena(id, publicado) {{
            const res = await apiAdminRequest('resena_toggle_publicado', {{ id, publicado }});
            if (res.success) {{ showAdminToast(res.message, 'success'); setTimeout(() => window.location.reload(), 600); }}
        }}
        async function eliminarResena(id) {{
            if (confirm('¿Eliminar esta reseña permanentemente?')) {{
                const res = await apiAdminRequest('resena_eliminar', {{ id }});
                if (res.success) {{ showAdminToast(res.message, 'success'); setTimeout(() => window.location.reload(), 600); }}
            }}
        }}
    </script>
    """


def render_mensajes_content(mensajes):
    """Genera la vista de gestión de mensajes de contacto."""
    rows = ""
    if not mensajes:
        rows = '<tr><td colspan="6" style="text-align:center; padding:24px; color:var(--text-muted);">No hay mensajes de contacto recibidos.</td></tr>'
    else:
        for m in mensajes:
            leido_badge = '<span class="badge badge-confirmed">Leído</span>' if m['leido'] else '<span class="badge badge-pending">Nuevo</span>'
            btn_toggle = "Marcar No Leído" if m['leido'] else "Marcar Leído"
            target_leido = 0 if m['leido'] else 1
            rows += f"""<tr>
                <td>#{m['id']}</td>
                <td><strong>{m['nombre']}</strong><br><small>{m['email']}</small><br><small style="color:var(--text-muted);">{m['telefono'] or ''}</small></td>
                <td><p style="font-size:0.88rem; max-width:400px;">{m['mensaje']}</p></td>
                <td>{m['fecha_envio']}</td>
                <td>{leido_badge}</td>
                <td>
                    <button class="btn-action" onclick="toggleLeidoMensaje({m['id']}, {target_leido})">{btn_toggle}</button>
                    <button class="btn-action" style="color:red;" onclick="eliminarMensaje({m['id']})">🗑️</button>
                </td>
            </tr>"""

    return f"""
    <div class="admin-card">
        <div class="card-header"><h3 class="card-title">💌 Mensajes de Contacto</h3></div>
        <div class="card-body">
            <div class="table-responsive">
                <table class="admin-table">
                    <thead><tr><th>ID</th><th>Remitente</th><th>Mensaje</th><th>Fecha</th><th>Estado</th><th>Acciones</th></tr></thead>
                    <tbody>{rows}</tbody>
                </table>
            </div>
        </div>
    </div>
    <script>
        async function toggleLeidoMensaje(id, leido) {{
            const res = await apiAdminRequest('mensaje_marcar_leido', {{ id, leido }});
            if (res.success) {{ showAdminToast(res.message, 'success'); setTimeout(() => window.location.reload(), 600); }}
        }}
        async function eliminarMensaje(id) {{
            if (confirm('¿Eliminar este mensaje de contacto?')) {{
                const res = await apiAdminRequest('mensaje_eliminar', {{ id }});
                if (res.success) {{ showAdminToast(res.message, 'success'); setTimeout(() => window.location.reload(), 600); }}
            }}
        }}
    </script>
    """

# =============================================================================
# INICIAR SERVIDOR LOCAL
# =============================================================================

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    print("\n=======================================================")
    print(f"NailArtist Studio -- Servidor Flask & SQLite Iniciado")
    print(f"Web Principal:   http://localhost:{port}/index.html")
    print(f"Nuevo Login:     http://localhost:{port}/login.html")
    print(f"Panel Admin:     http://localhost:{port}/admin/index.php")
    print(f"SQLite DB:       {database.DB_PATH}")
    print("=======================================================\n")
    app.run(host='0.0.0.0', port=port, debug=False)
