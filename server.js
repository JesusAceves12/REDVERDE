const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const multer = require('multer');
const path = require('path');

const app = express();
const PORT = 3000;

// Middlewares
app.use(cors());
app.use(express.json()); // Permite recibir JSON del frontend
app.use('/uploads', express.static(path.join(__dirname, 'uploads'))); // Servir fotos estáticas

// Configuración de Multer para subir archivos
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/'); // Carpeta donde se guardarán las fotos
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// Configuración de la conexión a la base de datos
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',      // Usuario por defecto en XAMPP/WAMP
    password: '012345678',      // Contraseña por defecto (vacía)
    database: 'gestion_parques'
});

// Conectar a la base de datos
db.connect((err) => {
    if (err) {
        console.error('Error conectando a la base de datos:', err.message);
        return;
    }
    console.log('Conectado a la base de datos MySQL (gestion_parques)');
});

// Endpoint para registrar un nuevo usuario con perfil vinculado
app.post('/api/registro', (req, res) => {
    const { nombre, email, password } = req.body;

    if (!nombre || !email || !password) {
        return res.status(400).json({ error: 'Todos los campos son obligatorios' });
    }

    // 1. Crear el perfil primero (vacío por defecto)
    const sqlPerfil = 'INSERT INTO perfil (biografia, reputacion) VALUES (?, ?)';
    db.query(sqlPerfil, ['', 0], (errPerfil, resultPerfil) => {
        if (errPerfil) {
            console.error('Error creando perfil:', errPerfil);
            return res.status(500).json({ error: 'Error al crear el perfil del usuario' });
        }

        const idPerfil = resultPerfil.insertId;

        // 2. Crear el usuario vinculado al perfil
        const sqlUsuario = 'INSERT INTO Usuario (nombre, email, password, rol, ID_perfil) VALUES (?, ?, ?, ?, ?)';
        db.query(sqlUsuario, [nombre, email, password, 'Ciudadano', idPerfil], (errUser, resultUser) => {
            if (errUser) {
                console.error('Error insertando usuario:', errUser);
                if (errUser.code === 'ER_DUP_ENTRY') {
                    return res.status(400).json({ error: 'El correo electrónico ya está registrado' });
                }
                return res.status(500).json({ error: 'Error al registrar el usuario' });
            }
            res.status(201).json({ mensaje: 'Usuario registrado exitosamente', id: resultUser.insertId });
        });
    });
});

// Endpoint para iniciar sesión con datos de perfil
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Correo y contraseña son obligatorios' });
    }

    const sql = `
        SELECT u.*, p.biografia, p.foto_perfil, p.reputacion 
        FROM Usuario u 
        LEFT JOIN perfil p ON u.ID_perfil = p.ID_perfil 
        WHERE u.email = ? AND u.password = ?
    `;
    db.query(sql, [email, password], (err, results) => {
        if (err) {
            console.error('Error buscando usuario:', err);
            return res.status(500).json({ error: 'Error al iniciar sesión' });
        }

        if (results.length > 0) {
            res.status(200).json({ mensaje: 'Inicio de sesión exitoso', usuario: results[0] });
        } else {
            res.status(401).json({ error: 'Correo o contraseña incorrectos' });
        }
    });
});

// Endpoint para obtener parques simplificado (solo ID y nombre)
app.get('/api/parques', (req, res) => {
    const sql = 'SELECT ID_parque, nombre FROM Parque';
    db.query(sql, (err, results) => {
        if (err) {
            console.error('Error obteniendo parques:', err);
            return res.status(500).json({ error: 'Error al obtener parques' });
        }
        res.status(200).json(results);
    });
});

// Endpoint para obtener información detallada de un solo parque
app.get('/api/parques/:id', (req, res) => {
    const idParque = req.params.id;
    const sql = `
        SELECT p.ID_parque, p.nombre, p.direccion, p.horario, p.latitud, p.longitud, c.categoria AS condicion, c.nivel, c.comentarios,
        GROUP_CONCAT(CONCAT(e.tipo, ' (', e.estado_mantenimiento, ')') SEPARATOR ', ') AS equipamientos
        FROM Parque p
        LEFT JOIN Condicion c ON p.ID_condicion = c.ID_condicion
        LEFT JOIN Equipamiento e ON p.ID_parque = e.ID_parque
        WHERE p.ID_parque = ?
        GROUP BY p.ID_parque
    `;
    db.query(sql, [idParque], (err, results) => {
        if (err) {
            console.error('Error obteniendo detalles del parque:', err);
            return res.status(500).json({ error: 'Error al obtener detalles del parque' });
        }
        if (results.length === 0) {
            return res.status(404).json({ error: 'Parque no encontrado' });
        }
        res.status(200).json(results[0]);
    });
});

// Endpoint para crear una actividad
app.post('/api/actividades', (req, res) => {
    const { titulo, descripcion, tipo, fecha, organizador, cupo, ID_parque } = req.body;

    if (!titulo || !fecha) {
        return res.status(400).json({ error: 'Título y fecha son obligatorios' });
    }

    const sql = 'INSERT INTO actividad_evento (titulo, descripcion, tipo, fecha, organizador, cupo, ID_parque) VALUES (?, ?, ?, ?, ?, ?, ?)';
    db.query(sql, [titulo, descripcion, tipo, fecha, organizador, cupo, ID_parque || null], (err, result) => {
        if (err) {
            console.error('Error insertando actividad:', err);
            return res.status(500).json({ error: 'Error al registrar la actividad' });
        }
        res.status(201).json({ mensaje: 'Actividad creada exitosamente', id: result.insertId });
    });
});

// Endpoint para obtener todas las actividades
app.get('/api/actividades', (req, res) => {
    // Sería útil obtener el nombre del parque si es que está relacionado, pero como por ahora podría no haber parques, hacemos LEFT JOIN
    const sql = `
        SELECT a.ID_actividad, a.titulo, a.descripcion, a.tipo, a.fecha, a.organizador, a.cupo, p.nombre as parque_nombre
        FROM actividad_evento a
        LEFT JOIN Parque p ON a.ID_parque = p.ID_parque
        ORDER BY a.fecha DESC
    `;
    db.query(sql, (err, results) => {
        if (err) {
            console.error('Error obteniendo actividades:', err);
            return res.status(500).json({ error: 'Error al obtener actividades' });
        }
        res.status(200).json(results);
    });
});

// Endpoint para obtener las actividades a las que asiste un usuario
app.get('/api/actividades/usuario/:id', (req, res) => {
    const userId = req.params.id;

    const sql = `
        SELECT a.ID_actividad, a.titulo, a.descripcion, a.tipo, a.fecha, a.organizador, p.nombre as parque_nombre, asis.fecha_inscripcion
        FROM Actividad_Evento a
        JOIN Asiste asis ON a.ID_actividad = asis.ID_actividad
        LEFT JOIN Parque p ON a.ID_parque = p.ID_parque
        WHERE asis.ID_usuario = ?
        ORDER BY a.fecha DESC
    `;
    
    db.query(sql, [userId], (err, results) => {
        if (err) {
            console.error('Error obteniendo actividades del usuario:', err);
            return res.status(500).json({ error: 'Error al obtener las actividades' });
        }
        res.status(200).json(results);
    });
});

// Endpoint para inscribirse en una actividad
app.post('/api/actividades/:id/inscribirse', (req, res) => {
    const ID_actividad = req.params.id;
    const { ID_usuario } = req.body;

    if (!ID_usuario) {
        return res.status(400).json({ error: 'ID de usuario es obligatorio' });
    }

    // Verificar cupo
    db.query('SELECT cupo FROM Actividad_Evento WHERE ID_actividad = ?', [ID_actividad], (err, results) => {
        if (err) return res.status(500).json({ error: 'Error al verificar la actividad' });
        if (results.length === 0) return res.status(404).json({ error: 'Actividad no encontrada' });
        
        const cupo = results[0].cupo;
        if (cupo !== null && cupo <= 0) {
            return res.status(400).json({ error: 'No hay cupo disponible para esta actividad' });
        }

        // Insertar en Asiste
        const sqlAsiste = 'INSERT INTO Asiste (ID_usuario, ID_actividad) VALUES (?, ?)';
        db.query(sqlAsiste, [ID_usuario, ID_actividad], (errAsiste, resultAsiste) => {
            if (errAsiste) {
                if (errAsiste.code === 'ER_DUP_ENTRY') {
                    return res.status(400).json({ error: 'Ya estás inscrito en esta actividad' });
                }
                console.error('Error al inscribir:', errAsiste);
                return res.status(500).json({ error: 'Error al inscribirse' });
            }

            // Reducir cupo si no es null
            if (cupo !== null) {
                const sqlUpdateCupo = 'UPDATE Actividad_Evento SET cupo = cupo - 1 WHERE ID_actividad = ?';
                db.query(sqlUpdateCupo, [ID_actividad], (errUpdate, resultUpdate) => {
                    if (errUpdate) {
                        console.error('Error al actualizar cupo:', errUpdate);
                        return res.status(500).json({ error: 'Inscrito, pero error al actualizar cupo' });
                    }
                    res.status(200).json({ mensaje: 'Inscripción exitosa' });
                });
            } else {
                res.status(200).json({ mensaje: 'Inscripción exitosa' });
            }
        });
    });
});

// Endpoint para desinscribirse de una actividad
app.post('/api/actividades/:id/desinscribirse', (req, res) => {
    const ID_actividad = req.params.id;
    const { ID_usuario } = req.body;

    if (!ID_usuario) {
        return res.status(400).json({ error: 'ID de usuario es obligatorio' });
    }

    // Eliminar de Asiste
    const sqlDeleteAsiste = 'DELETE FROM Asiste WHERE ID_usuario = ? AND ID_actividad = ?';
    db.query(sqlDeleteAsiste, [ID_usuario, ID_actividad], (errDelete, resultDelete) => {
        if (errDelete) {
            console.error('Error al desinscribir:', errDelete);
            return res.status(500).json({ error: 'Error al desinscribirse' });
        }

        if (resultDelete.affectedRows === 0) {
            return res.status(400).json({ error: 'No estás inscrito en esta actividad' });
        }

        // Verificar cupo antes de aumentar
        db.query('SELECT cupo FROM Actividad_Evento WHERE ID_actividad = ?', [ID_actividad], (err, results) => {
            if (err) return res.status(500).json({ error: 'Desinscrito, pero error al verificar la actividad' });
            if (results.length === 0) return res.status(404).json({ error: 'Actividad no encontrada' });
            
            const cupo = results[0].cupo;
            if (cupo !== null) {
                const sqlUpdateCupo = 'UPDATE Actividad_Evento SET cupo = cupo + 1 WHERE ID_actividad = ?';
                db.query(sqlUpdateCupo, [ID_actividad], (errUpdate, resultUpdate) => {
                    if (errUpdate) {
                        console.error('Error al actualizar cupo:', errUpdate);
                        return res.status(500).json({ error: 'Desinscrito, pero error al actualizar cupo' });
                    }
                    res.status(200).json({ mensaje: 'Desinscripción exitosa' });
                });
            } else {
                res.status(200).json({ mensaje: 'Desinscripción exitosa' });
            }
        });
    });
});

// Endpoint para crear un reporte con subida de imagen
app.post('/api/reportes', upload.single('foto_evidencia'), (req, res) => {
    // Cuando usamos multer (multipart/form-data), los campos de texto están en req.body y el archivo en req.file
    const { incidencia, situacion_del_reporte, ID_usuario, ID_parque } = req.body;
    
    // Si se subió un archivo, generamos la URL completa para acceder a él
    const foto_evidencia = req.file ? `http://localhost:${PORT}/uploads/${req.file.filename}` : null;

    if (!incidencia || !ID_parque) {
        return res.status(400).json({ error: 'La incidencia y el parque son obligatorios' });
    }

    // Primero insertamos el reporte
    const sqlReporte = 'INSERT INTO reporte (incidencia, foto_evidencia, situacion_del_reporte, ID_usuario) VALUES (?, ?, ?, ?)';
    const situacion = situacion_del_reporte || 'Pendiente';
    
    db.query(sqlReporte, [incidencia, foto_evidencia, situacion, ID_usuario || null], (err, result) => {
        if (err) {
            console.error('Error insertando reporte:', err);
            return res.status(500).json({ error: 'Error al registrar el reporte' });
        }
        
        const idReporte = result.insertId;
        
        // Luego vinculamos el reporte al parque en historial_reportes
        const sqlHistorial = 'INSERT INTO historial_reportes (ID_parque, ID_reporte) VALUES (?, ?)';
        db.query(sqlHistorial, [ID_parque, idReporte], (errHistorial, resultHistorial) => {
            if (errHistorial) {
                console.error('Error insertando en historial_reportes:', errHistorial);
                return res.status(500).json({ error: 'Error al vincular el reporte con el parque' });
            }
            res.status(201).json({ mensaje: 'Reporte creado exitosamente', id: idReporte });
        });
    });
});

// Endpoint para obtener los reportes de un usuario
app.get('/api/reportes/usuario/:id', (req, res) => {
    const userId = req.params.id;

    const sql = `
        SELECT r.ID_reporte, r.incidencia, r.fecha_creacion, r.situacion_del_reporte, r.foto_evidencia, p.nombre as parque_nombre
        FROM reporte r
        LEFT JOIN historial_reportes hr ON r.ID_reporte = hr.ID_reporte
        LEFT JOIN parque p ON hr.ID_parque = p.ID_parque
        WHERE r.ID_usuario = ?
        ORDER BY r.fecha_creacion DESC
    `;
    
    db.query(sql, [userId], (err, results) => {
        if (err) {
            console.error('Error obteniendo reportes del usuario:', err);
            return res.status(500).json({ error: 'Error al obtener los reportes' });
        }
        res.status(200).json(results);
    });
});

// Endpoint para actualizar el perfil del usuario
app.put('/api/perfil/:idPerfil', upload.single('foto_perfil'), (req, res) => {
    const idPerfil = req.params.idPerfil;
    const { biografia } = req.body;
    let foto_perfil = req.body.foto_perfil_existente || null;

    if (req.file) {
        foto_perfil = `http://localhost:${PORT}/uploads/${req.file.filename}`;
    }

    const sql = 'UPDATE perfil SET biografia = ?, foto_perfil = ? WHERE ID_perfil = ?';
    db.query(sql, [biografia, foto_perfil, idPerfil], (err, result) => {
        if (err) {
            console.error('Error actualizando perfil:', err);
            return res.status(500).json({ error: 'Error al actualizar el perfil' });
        }
        
        // Obtener los datos actualizados del usuario para devolverlos al frontend
        const sqlUser = `
            SELECT u.*, p.biografia, p.foto_perfil, p.reputacion 
            FROM Usuario u 
            LEFT JOIN perfil p ON u.ID_perfil = p.ID_perfil 
            WHERE u.ID_perfil = ?
        `;
        db.query(sqlUser, [idPerfil], (errUser, resultsUser) => {
            if (errUser || resultsUser.length === 0) {
                return res.status(200).json({ mensaje: 'Perfil actualizado, pero error al recuperar datos actualizados' });
            }
            res.status(200).json({ mensaje: 'Perfil actualizado exitosamente', usuario: resultsUser[0] });
        });
    });
});

// Iniciar el servidor
app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
