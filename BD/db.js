const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(
  path.join(__dirname, 'database.sqlite'),
  (err) => {
    if (err) {
      console.error('Erreur SQLite', err);
    } else {
      console.log('Connexion SQLite OK');
    }
  }
);

// Création de la table users (idempotent)
db.run(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    score INTEGER DEFAULT 0
  )
`);

module.exports = db;