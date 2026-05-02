const mysql = require('mysql2');
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '012345678',
    database: 'gestion_parques'
});
db.query('SHOW CREATE TABLE historial_reportes', (err, results) => {
    if(err) console.error(err);
    else console.log(results[0]['Create Table']);
    db.end();
});
