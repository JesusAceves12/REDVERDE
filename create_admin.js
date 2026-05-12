const mysql = require('mysql2');

const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',      
    password: '012345678',      
    database: 'gestion_parques'
});

db.connect((err) => {
    if (err) {
        console.error('Error conectando a la base de datos:', err.message);
        return;
    }
    
    // 1. Check if admin exists
    const checkSql = 'SELECT * FROM Usuario WHERE email = ?';
    db.query(checkSql, ['admin@redverde.com'], (err, results) => {
        if (err) throw err;
        if (results.length > 0) {
            console.log('El administrador ya existe.');
            db.end();
            return;
        }

        // 2. Create profile
        const sqlPerfil = 'INSERT INTO perfil (biografia, reputacion) VALUES (?, ?)';
        db.query(sqlPerfil, ['Administrador del sistema REDVERDE', 100], (errPerfil, resultPerfil) => {
            if (errPerfil) throw errPerfil;

            const idPerfil = resultPerfil.insertId;

            // 3. Create user
            const sqlUsuario = 'INSERT INTO Usuario (nombre, email, password, rol, ID_perfil) VALUES (?, ?, ?, ?, ?)';
            db.query(sqlUsuario, ['Administrador', 'admin@redverde.com', 'admin123', 'Admin', idPerfil], (errUser, resultUser) => {
                if (errUser) throw errUser;
                console.log('Usuario administrador creado exitosamente.');
                db.end();
            });
        });
    });
});
