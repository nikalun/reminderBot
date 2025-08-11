require('dotenv').config();
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const filepath = path.join(__dirname, '..', 'db', process.env.DATA_BASE_NAME);

const db = new sqlite3.Database(filepath);

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS migrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE
  )`, applyMigrations);
});

function applyMigrations() {
    const migrationDir = path.join(__dirname, '..', 'migrations');
    const files = fs.readdirSync(migrationDir).sort();

    db.all('SELECT name FROM migrations', (err, rows) => {
        if (err) throw err;

        const applied = new Set(rows.map(row => row.name));

        const toApply = files.filter(f => !applied.has(f));

        runMigrations(toApply, migrationDir);
    });
}

function runMigrations(files, dir) {
    if (files.length === 0) {
        console.log('✅ Все миграции уже применены.');
        db.close();
        return;
    }

    const next = files.shift();
    const sql = fs.readFileSync(path.join(dir, next), 'utf-8');

    db.exec(sql, (err) => {
        if (err) {
            console.error(`❌ Ошибка в миграции ${next}:`, err);
            db.close();
            return;
        }

        db.run('INSERT INTO migrations (name) VALUES (?)', [next], () => {
            console.log(`✅ Применена миграция: ${next}`);
            runMigrations(files, dir);
        });
    });
}
