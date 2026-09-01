<?php
/**
 * API Endpoint: Obtener Servicios Oficiales
 * Método: GET
 * Retorna todos los servicios activos de la base de datos MySQL en formato JSON
 */

require_once __DIR__ . '/../config/conexion.php';

try {
    $pdo = Database::getConnection();

    $categoria_id = isset($_GET['categoria_id']) ? intval($_GET['categoria_id']) : null;
    $destacado = isset($_GET['destacado']) ? intval($_GET['destacado']) : null;

    $sql = "SELECT s.id, s.nombre, s.slug, s.descripcion, s.precio, s.moneda, 
                   s.duracion_minutos, s.imagen, s.url_detalle, s.destacado, s.calificacion,
                   c.id AS categoria_id, c.nombre AS categoria_nombre
            FROM servicios s
            INNER JOIN categorias c ON s.categoria_id = c.id
            WHERE s.estado = 'activo'";

    $params = [];

    if ($categoria_id !== null) {
        $sql .= " AND s.categoria_id = :categoria_id";
        $params[':categoria_id'] = $categoria_id;
    }

    if ($destacado !== null) {
        $sql .= " AND s.destacado = :destacado";
        $params[':destacado'] = $destacado;
    }

    $sql .= " ORDER BY s.id ASC";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $servicios = $stmt->fetchAll();

    jsonResponse(true, 'Servicios obtenidos exitosamente', [
        'total' => count($servicios),
        'servicios' => $servicios
    ]);

} catch (Exception $e) {
    jsonResponse(false, 'Error al consultar los servicios', $e->getMessage(), 500);
}
