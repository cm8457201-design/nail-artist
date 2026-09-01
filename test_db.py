import sqlite3
import database

conn = database.get_db_connection()
cursor = conn.cursor()

tables = cursor.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;").fetchall()
print("Tablas encontradas:", [t['name'] for t in tables])

users = cursor.execute("SELECT u.id, u.nombre, u.email, r.nombre as rol, u.password_hash FROM usuarios u JOIN roles r ON u.rol_id = r.id;").fetchall()
for u in users:
    is_admin123 = database.verify_password('admin123', u['password_hash'])
    print(f"Usuario: {u['nombre']} ({u['email']}) | Rol: {u['rol']} | admin123 válido: {is_admin123}")

services = cursor.execute("SELECT id, nombre, precio, moneda FROM servicios;").fetchall()
print(f"Total servicios en SQLite: {len(services)}")
for s in services[:3]:
    print(f" - #{s['id']}: {s['nombre']} ({s['moneda']} {s['precio']})")
