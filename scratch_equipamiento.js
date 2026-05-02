const mysql = require('mysql2');
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '012345678',
    database: 'gestion_parques'
});

db.connect((err) => {
    if (err) throw err;
    db.query('SELECT ID_parque FROM Parque', (err, parques) => {
        if (err) throw err;
        
        if (parques.length === 0) {
            console.log('No hay parques en la base de datos para agregar equipamiento.');
            process.exit(0);
        }

        const equipamientos = ['Bancas', 'Juegos Infantiles', 'Canchas Deportivas', 'Bebederos', 'Botes de Basura', 'Luminarias', 'Gimnasio al aire libre'];
        const estados = ['Excelente', 'Bueno', 'Regular', 'Requiere Mantenimiento'];

        let insertedCount = 0;
        // Asignaremos de 2 a 3 equipamientos por parque
        let targetCount = 0;
        
        const queries = [];

        parques.forEach(p => {
            const numEquip = Math.floor(Math.random() * 2) + 2; // 2 or 3
            targetCount += numEquip;
            
            for (let i = 0; i < numEquip; i++) {
                const tipo = equipamientos[Math.floor(Math.random() * equipamientos.length)];
                const estado = estados[Math.floor(Math.random() * estados.length)];
                queries.push([tipo, estado, p.ID_parque]);
            }
        });

        queries.forEach(params => {
            db.query('INSERT INTO Equipamiento (tipo, estado_mantenimiento, ID_parque) VALUES (?, ?, ?)', params, (err) => {
                if (err) console.error(err);
                insertedCount++;
                if (insertedCount === targetCount) {
                    console.log(`Se insertaron ${insertedCount} registros de equipamiento con éxito.`);
                    process.exit(0);
                }
            });
        });
    });
});
