const mysql = require('mysql2');
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '012345678',
    database: 'gestion_parques'
});
db.query('DESCRIBE reporte', (err, results) => {
    if(err) console.error(err);
    else console.log(results);
    db.end();
});
