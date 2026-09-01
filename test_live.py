import urllib.request
import urllib.parse
import json

BASE_URL = "http://127.0.0.1:5000"

def test_live_server():
    print("=== TEST 1: Verificar páginas HTML ===")
    pages = ["index.html", "login.html", "servicios.html", "combos.html", "decoracion.html", "revolution.html"]
    for p in pages:
        req = urllib.request.urlopen(f"{BASE_URL}/{p}")
        print(f" - {p}: Status {req.status} OK")

    print("\n=== TEST 2: Login Administrador (admin@gmail.com / admin123) ===")
    data = json.dumps({"email": "admin@gmail.com", "password": "admin123"}).encode("utf-8")
    req = urllib.request.Request(f"{BASE_URL}/api/login", data=data, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req) as resp:
        res = json.loads(resp.read().decode("utf-8"))
        print(" - Login Admin:", res["message"])
        print(" - Usuario:", res["data"]["usuario"]["nombre"], "| Rol:", res["data"]["usuario"]["rol"])
        assert res["success"] == True
        assert res["data"]["usuario"]["rol_id"] == 1

    print("\n=== TEST 3: Login Cliente (camila.morales@gmail.com / cliente123) ===")
    data = json.dumps({"email": "camila.morales@gmail.com", "password": "cliente123"}).encode("utf-8")
    req = urllib.request.Request(f"{BASE_URL}/api/login", data=data, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req) as resp:
        res = json.loads(resp.read().decode("utf-8"))
        print(" - Login Cliente:", res["message"])
        print(" - Descuento VIP:", res["data"]["usuario"]["descuento_vip"], "%")
        assert res["success"] == True
        assert res["data"]["usuario"]["rol_id"] == 2

    print("\n=== TEST 4: Obtener Servicios desde SQLite ===")
    with urllib.request.urlopen(f"{BASE_URL}/api/obtener_servicios") as resp:
        res = json.loads(resp.read().decode("utf-8"))
        print(" - Total servicios:", res["data"]["total"])
        assert res["data"]["total"] >= 9

    print("\n=== TEST 5: Crear Reserva desde Carrito ===")
    reserva_data = json.dumps({
        "nombre_cliente": "Clienta Live Test",
        "email_cliente": "livetest@gmail.com",
        "telefono_cliente": "+59160000000",
        "fecha_cita": "2026-08-30",
        "hora_cita": "15:00",
        "observaciones": "Reserva de prueba live",
        "servicios": [
            {"servicio_id": 1, "nombre": "Uñas Acrílicas", "precio": 80.0, "cantidad": 1}
        ]
    }).encode("utf-8")
    req = urllib.request.Request(f"{BASE_URL}/api/crear_reserva", data=reserva_data, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req) as resp:
        res = json.loads(resp.read().decode("utf-8"))
        print(" - Reserva:", res["message"])
        print(" - Código:", res["data"]["codigo_reserva"], "| Total:", res["data"]["total_final_bs"])
        assert res["success"] == True

    print("\n=== TODOS LOS TESTS EN VIVO PASARON EXITOSAMENTE ===")

if __name__ == '__main__':
    test_live_server()
