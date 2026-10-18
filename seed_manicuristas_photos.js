const db = require('./database/db');

const manicuristas = [
  {
    id: 2,
    nombre: 'Camila',
    apellido: 'Morales',
    foto: '/images/manicuristas/camila-morales.jpg',
    cargo: 'Especialista en Acrílico & Soft Gel',
    desc: 'Especialista en estructuras acrílicas y soft gel con acabados de alta precisión. Apasionada por el nail art de vanguardia y diseños únicos para cada clienta.',
    exp: 5,
    servicios: [1, 2, 7, 8, 9] // Acrílicas, Soft Gel, Encapsuladas, Extensión XL, Combos
  },
  {
    id: 3,
    nombre: 'Valentina',
    apellido: 'Rios',
    foto: '/images/manicuristas/valentina-rios.jpg',
    cargo: 'Master Nail Artist & Diseños Premium',
    desc: 'Master en nail art con especialidad en diseños personalizados y técnicas de encapsulado. Cada trabajo es una obra de arte creada para resaltar tu estilo único.',
    exp: 7,
    servicios: [1, 4, 6, 7, 14] // Acrílicas, Decoración Premium, Diseños Personalizados, Encapsuladas, Mariposa
  },
  {
    id: 5,
    nombre: 'Sofia',
    apellido: 'Vargas',
    foto: '/images/manicuristas/sofia-vargas.jpg',
    cargo: 'Especialista en Manicure & Decoración',
    desc: 'Especialista en manicure spa y decoración artística. Su delicadeza y atención al detalle garantizan resultados naturales y duraderos para cada clienta.',
    exp: 4,
    servicios: [2, 3, 4, 5, 9] // Soft Gel, Manicure Completo, Decoración Premium, Semipermanente, Combos
  }
];

try {
  for (const m of manicuristas) {
    db.run(
      `UPDATE usuarios 
       SET rol_id = 3, nombre = ?, apellido = ?, foto_perfil = ?, foto = ?, cargo_especialidad = ?, descripcion = ?, experiencia_anios = ?, estado = 'activo' 
       WHERE id = ?`,
      [m.nombre, m.apellido, m.foto, m.foto, m.cargo, m.desc, m.exp, m.id]
    );
    console.log(`Configured manicurista: ${m.nombre} ${m.apellido} (id: ${m.id})`);

    // Assign services
    db.run("DELETE FROM manicurista_servicios WHERE manicurista_id = ?", [m.id]);
    for (const sId of m.servicios) {
      db.run("INSERT INTO manicurista_servicios (manicurista_id, servicio_id) VALUES (?, ?)", [m.id, sId]);
    }
  }

  // Set unused test manicuristas to inactive
  db.run("UPDATE usuarios SET estado = 'inactivo' WHERE rol_id = 3 AND id NOT IN (2, 3, 5)", []);

  const activeMani = db.all(`
    SELECT u.id, u.nombre, u.apellido, u.rol_id, u.estado, u.foto_perfil, u.cargo_especialidad, u.experiencia_anios
    FROM usuarios u
    WHERE u.rol_id = 3 AND u.estado = 'activo'
  `, []);
  console.log('\nActive Manicuristas in DB:\n', JSON.stringify(activeMani, null, 2));

} catch (err) {
  console.error('Error seeding manicuristas:', err);
}
