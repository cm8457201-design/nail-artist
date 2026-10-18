const db = require('../database/db');

function ensureColumns() {
    const tableInfo = db.all("PRAGMA table_info(usuarios)");
    const colNames = tableInfo.map(c => c.name);

    if (!colNames.includes('foto_perfil')) {
        db.exec("ALTER TABLE usuarios ADD COLUMN foto_perfil TEXT;");
        console.log("Column 'foto_perfil' added to usuarios");
    }
    if (!colNames.includes('foto')) {
        db.exec("ALTER TABLE usuarios ADD COLUMN foto TEXT;");
        console.log("Column 'foto' added to usuarios");
    }
    if (!colNames.includes('cargo_especialidad')) {
        db.exec("ALTER TABLE usuarios ADD COLUMN cargo_especialidad TEXT;");
        console.log("Column 'cargo_especialidad' added to usuarios");
    }
    if (!colNames.includes('descripcion')) {
        db.exec("ALTER TABLE usuarios ADD COLUMN descripcion TEXT;");
        console.log("Column 'descripcion' added to usuarios");
    }
    if (!colNames.includes('experiencia_anios')) {
        db.exec("ALTER TABLE usuarios ADD COLUMN experiencia_anios INTEGER DEFAULT 3;");
        console.log("Column 'experiencia_anios' added to usuarios");
    }

    // Sync foto and foto_perfil if one is set
    db.run("UPDATE usuarios SET foto_perfil = foto WHERE foto_perfil IS NULL AND foto IS NOT NULL");
    db.run("UPDATE usuarios SET foto = foto_perfil WHERE foto IS NULL AND foto_perfil IS NOT NULL");

    // Set default professional specialties and descriptions for existing manicuristas if empty
    const manicuristas = db.all("SELECT id, nombre, apellido, cargo_especialidad, descripcion FROM usuarios WHERE rol_id = 3");
    for (const m of manicuristas) {
        if (!m.cargo_especialidad) {
            let cargo = 'Master Nail Artist & Especialista en Acrílico';
            let desc = 'Especialista certificada con amplia experiencia en estructuras esculpidas, Soft Gel y diseños personalizados de alta precisión.';
            if (m.nombre.toLowerCase().includes('valeria')) {
                cargo = 'Especialista en Soft Gel & Estructuras';
                desc = 'Apasionada por la delicadeza del Soft Gel y acabados impecables de brillo duradero con técnicas europeas.';
            } else if (m.nombre.toLowerCase().includes('marua') || m.nombre.toLowerCase().includes('maru')) {
                cargo = 'Master en Uñas Acrílicas & Encapsulados';
                desc = 'Experta en esculpido avanzado, encapsulados con flores y glitter, y extensiones XL de máxima durabilidad.';
            } else if (m.nombre.toLowerCase().includes('cristian')) {
                cargo = 'Especialista en Diseños & Arte a Mano Alzada';
                desc = 'Creadora de trazos finos, efectos mármol, nail art en tendencia y estilo personalizado.';
            } else if (m.nombre.toLowerCase().includes('vanessa')) {
                cargo = 'Especialista en Manicure Spa & Semipermanente';
                desc = 'Dedicada al cuidado de la salud de la uña natural, esmaltado semipermanente y tratamientos reconstructivos.';
            }
            db.run("UPDATE usuarios SET cargo_especialidad = ?, descripcion = ? WHERE id = ?", [cargo, desc, m.id]);
        }
    }

    console.log("Migration completed successfully!");
}

ensureColumns();
