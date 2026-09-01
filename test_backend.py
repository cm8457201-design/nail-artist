"""
Test Suite integral para verificar el servidor Flask y la base de datos SQLite de NailArtist Studio.
"""

import unittest
import json
import app
import database

class NailArtistServerTests(unittest.TestCase):

    def setUp(self):
        app.app.config['TESTING'] = True
        app.app.config['SECRET_KEY'] = 'test_secret_key'
        self.client = app.app.test_client()
        # Asegurar datos iniciales
        database.init_db(drop_existing=False)

    def test_01_static_pages_exist(self):
        """Verifica que las páginas originales permanezcan intactas y accesibles."""
        pages = ['index.html', 'servicios.html', 'combos.html', 'decoracion.html', 'revolution.html', 'login.html']
        for p in pages:
            res = self.client.get(f'/{p}')
            self.assertEqual(res.status_code, 200, f"Error al cargar página {p}")

    def test_02_login_redesign_content(self):
        """Verifica elementos clave en el nuevo login.html."""
        res = self.client.get('/login.html')
        content = res.get_data(as_text=True)
        self.assertIn('NAILS', content)
        self.assertIn('ARTIST', content)
        self.assertIn('Uñas Acrílicas', content)
        self.assertIn('Iniciar Sesión', content)
        self.assertIn('Crear Cuenta VIP', content)
        self.assertIn('Recordarme', content)
        self.assertIn('¿Olvidaste tu contraseña?', content)
        self.assertIn('INICIAR SESIÓN', content)

    def test_03_admin_login_success(self):
        """Verifica que admin@gmail.com / admin123 autentique correctamente con rol Administrador."""
        res = self.client.post('/api/login', json={
            'email': 'admin@gmail.com',
            'password': 'admin123'
        })
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data['success'])
        self.assertEqual(data['data']['usuario']['rol_id'], 1)
        self.assertEqual(data['data']['usuario']['rol'], 'Administrador')

    def test_04_client_login_success(self):
        """Verifica que un cliente registrado autentique correctamente."""
        res = self.client.post('/api/login', json={
            'email': 'camila.morales@gmail.com',
            'password': 'cliente123'
        })
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data['success'])
        self.assertEqual(data['data']['usuario']['rol_id'], 2)
        self.assertEqual(data['data']['usuario']['descuento_vip'], 15.0)

    def test_05_login_invalid_password(self):
        """Verifica rechazo con contraseña incorrecta."""
        res = self.client.post('/api/login', json={
            'email': 'admin@gmail.com',
            'password': 'password_invalido_999'
        })
        self.assertEqual(res.status_code, 401)
        data = res.get_json()
        self.assertFalse(data['success'])

    def test_06_register_new_vip_user(self):
        """Verifica registro de una nueva clienta con 15% de descuento."""
        unique_email = f"sofia.test_{int(database.sqlite3.connect(database.DB_PATH).execute('SELECT COUNT(*) FROM usuarios').fetchone()[0])}@gmail.com"
        res = self.client.post('/api/registrar_usuario', json={
            'nombre': 'Sofia',
            'apellido': 'Vargas',
            'email': unique_email,
            'telefono': '+59177889900',
            'password': 'sofia_password_123'
        })
        self.assertEqual(res.status_code, 201)
        data = res.get_json()
        self.assertTrue(data['success'])
        self.assertEqual(data['data']['descuento_vip'], 15.0)

    def test_07_get_services_api(self):
        """Verifica consulta de catálogo de servicios."""
        res = self.client.get('/api/obtener_servicios')
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data['success'])
        self.assertGreaterEqual(data['data']['total'], 9)

    def test_08_create_booking_api(self):
        """Verifica creación de reserva con servicios en SQLite."""
        res = self.client.post('/api/crear_reserva', json={
            'nombre_cliente': 'Test Clienta',
            'email_cliente': 'testclienta@gmail.com',
            'telefono_cliente': '+59160000000',
            'fecha_cita': '2026-09-01',
            'hora_cita': '14:30:00',
            'observaciones': 'Prueba unitaria de agendamiento',
            'servicios': [
                {'servicio_id': 1, 'nombre': 'Uñas Acrílicas', 'precio': 80.0, 'cantidad': 1},
                {'servicio_id': 4, 'nombre': 'Decoración Premium', 'precio': 35.0, 'cantidad': 1}
            ]
        })
        self.assertEqual(res.status_code, 201)
        data = res.get_json()
        self.assertTrue(data['success'])
        self.assertIn('RES-2026-', data['data']['codigo_reserva'])

    def test_09_contact_message_api(self):
        """Verifica guardado de mensaje de contacto."""
        res = self.client.post('/api/contacto', json={
            'nombre': 'Laura Test',
            'email': 'laura@test.com',
            'telefono': '+59171122334',
            'mensaje': 'Consulta sobre disponibilidad para soft gel.'
        })
        self.assertEqual(res.status_code, 201)
        data = res.get_json()
        self.assertTrue(data['success'])

    def test_10_admin_panel_auth(self):
        """Verifica protección del panel de administración y acceso autenticado."""
        # Sin login redirige a login.php
        res_no_auth = self.client.get('/admin/index.php')
        self.assertEqual(res_no_auth.status_code, 302)

        # Con login de administrador
        with self.client.session_transaction() as sess:
            sess['admin_user'] = {
                'id': 1,
                'rol_id': 1,
                'rol': 'Administrador',
                'nombre': 'Administrador',
                'email': 'admin@gmail.com'
            }

        res_auth = self.client.get('/admin/index.php')
        self.assertEqual(res_auth.status_code, 200)
        content = res_auth.get_data(as_text=True)
        self.assertIn('Dashboard', content)
        self.assertIn('Total Usuarios', content)

if __name__ == '__main__':
    unittest.main()
