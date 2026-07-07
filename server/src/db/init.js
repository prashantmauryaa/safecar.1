const { Pool } = require('pg');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
require('dotenv').config();

let db;
const isPostgres = !!process.env.DATABASE_URL;

if (isPostgres) {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false // Required for some hosted PostgreSQL like Render
    }
  });
  db = pool;
} else {
  const dbPath = path.join(__dirname, 'aidlyn.db');
  console.log(`DATABASE_URL not set. Falling back to SQLite: ${dbPath}`);
  const sqliteDb = new sqlite3.Database(dbPath);

  // Enable foreign keys
  sqliteDb.run("PRAGMA foreign_keys = ON;");

  db = {
    query: (sql, params = []) => {
      return new Promise((resolve, reject) => {
        const sqliteSql = sql.replace(/\$\d+/g, '?');
        sqliteDb.all(sqliteSql, params, (err, rows) => {
          if (err) return reject(err);
          resolve({ rows: rows || [] });
        });
      });
    }
  };
}

const initDb = async () => {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE,
        password TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS qr_profiles (
        qr_id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        owner_name TEXT,
        emergency_contacts TEXT,
        is_active INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        city TEXT,
        blood_group TEXT,
        vehicle_type TEXT,
        FOREIGN KEY(user_id) REFERENCES users(id)
      )
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS incidents (
        id TEXT PRIMARY KEY,
        qr_id TEXT NOT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        location TEXT,
        FOREIGN KEY(qr_id) REFERENCES qr_profiles(qr_id)
      )
    `);

    if (isPostgres) {
      console.log("PostgreSQL Database initialized successfully");
    } else {
      console.log("SQLite Database initialized successfully");
    }
  } catch (error) {
    console.error("Database initialization error:", error);
  }
};

// Export `db` as the pool or wrapper object, which has `query` method.
module.exports = { db, initDb };
