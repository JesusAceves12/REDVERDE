const mysql = require('mysql2');
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '012345678',
    database: 'gestion_parques'
});
db.query('DESCRIBE perfil', (err, results) => {
    if(err) console.error(err);
    else {
        console.log('Perfil table:');
        console.log(results);
        db.query('DESCRIBE usuario', (err, results) => {
            if(err) console.error(err);
            else {
                console.log('Usuario table:');
                console.log(results);
            }
            db.end();
        });
    }
});
