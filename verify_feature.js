const fs = require('fs');
const path = require('path');

async function test() {
  console.log('--- 1. Testing Image Files on Disk ---');
  const photos = [
    'camila-morales.jpg',
    'valentina-rios.jpg',
    'sofia-vargas.jpg'
  ];
  for (const p of photos) {
    const filePath = path.join(__dirname, 'images', 'manicuristas', p);
    const exists = fs.existsSync(filePath);
    const size = exists ? fs.statSync(filePath).size : 0;
    console.log(`Photo ${p}: exists=${exists}, size=${size} bytes`);
  }

  console.log('\n--- 2. Testing HTTP Endpoints ---');
  const resMeta = await fetch('http://localhost:3000/api/servicios/meta/manicuristas');
  const metaJson = await resMeta.json();
  console.log('Public meta endpoint status:', resMeta.status);
  console.log('Total manicuristas:', metaJson.total);
  metaJson.data.forEach(m => {
    console.log(`- ${m.nombre} ${m.apellido}: foto=${m.foto_perfil}, cargo=${m.cargo_especialidad}, exp=${m.experiencia_anios}a, especialidades=${m.especialidades.length}`);
  });

  console.log('\n--- 3. Testing Photo Static URL serving ---');
  for (const m of metaJson.data) {
    const photoUrl = 'http://localhost:3000' + m.foto_perfil;
    const resImg = await fetch(photoUrl);
    console.log(`URL ${photoUrl} -> Status ${resImg.status}, Content-Type: ${resImg.headers.get('content-type')}`);
  }
}

test().catch(console.error);
