import { createRequire } from 'module';
import { app } from 'electron';
import path from 'path';
import fs from 'fs';

const require = createRequire(import.meta.url);
const Database = require('better-sqlite3');

let db;

export function initDatabase() {
  const userDataPath = app.getPath('userData');
  const dbPath = path.join(userDataPath, 'finance-reconciliation.db');
  
  if (!fs.existsSync(userDataPath)) {
    fs.mkdirSync(userDataPath, { recursive: true });
  }
  
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  
  createTables();
  createIndexes();
  
  return db;
}

export function getDb() {
  if (!db) {
    return initDatabase();
  }
  return db;
}

function createTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      file_path TEXT NOT NULL,
      file_name TEXT NOT NULL,
      file_hash TEXT UNIQUE,
      file_type TEXT,
      file_size INTEGER,
      ocr_text TEXT,
      invoice_no TEXT,
      invoice_code TEXT,
      amount REAL,
      tax_amount REAL,
      total_amount REAL,
      invoice_date TEXT,
      seller_name TEXT,
      seller_tax_no TEXT,
      buyer_name TEXT,
      buyer_tax_no TEXT,
      category TEXT,
      status TEXT DEFAULT 'pending',
      notes TEXT,
      imported_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bank_name TEXT,
      account_no TEXT,
      transaction_date TEXT NOT NULL,
      transaction_time TEXT,
      amount REAL NOT NULL,
      balance REAL,
      counterparty_name TEXT,
      counterparty_account TEXT,
      summary TEXT,
      remark TEXT,
      transaction_type TEXT,
      serial_no TEXT,
      status TEXT DEFAULT 'pending',
      imported_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS matches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id INTEGER NOT NULL,
      transaction_id INTEGER NOT NULL,
      matched_amount REAL NOT NULL,
      match_type TEXT DEFAULT 'auto',
      match_score REAL,
      status TEXT DEFAULT 'confirmed',
      matched_at TEXT DEFAULT (datetime('now', 'localtime')),
      matched_by TEXT,
      notes TEXT,
      FOREIGN KEY (invoice_id) REFERENCES invoices (id) ON DELETE CASCADE,
      FOREIGN KEY (transaction_id) REFERENCES transactions (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS anomalies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      severity TEXT DEFAULT 'warning',
      invoice_id INTEGER,
      transaction_id INTEGER,
      match_id INTEGER,
      description TEXT NOT NULL,
      detail TEXT,
      status TEXT DEFAULT 'open',
      resolution TEXT,
      resolved_at TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (invoice_id) REFERENCES invoices (id) ON DELETE SET NULL,
      FOREIGN KEY (transaction_id) REFERENCES transactions (id) ON DELETE SET NULL,
      FOREIGN KEY (match_id) REFERENCES matches (id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      parent_id INTEGER,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at TEXT DEFAULT (datetime('now', 'localtime'))
    );
  `);
  
  const stmt = db.prepare('SELECT COUNT(*) as count FROM categories');
  const result = stmt.get();
  if (result.count === 0) {
    const insert = db.prepare('INSERT INTO categories (name, sort_order) VALUES (?, ?)');
    const categories = [
      ['办公费用', 1],
      ['差旅费用', 2],
      ['餐饮费用', 3],
      ['交通费用', 4],
      ['采购费用', 5],
      ['其他费用', 99],
    ];
    categories.forEach(([name, order]) => insert.run(name, order));
  }
}

function createIndexes() {
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
    CREATE INDEX IF NOT EXISTS idx_invoices_invoice_date ON invoices(invoice_date);
    CREATE INDEX IF NOT EXISTS idx_invoices_total_amount ON invoices(total_amount);
    CREATE INDEX IF NOT EXISTS idx_invoices_category ON invoices(category);
    
    CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
    CREATE INDEX IF NOT EXISTS idx_transactions_transaction_date ON transactions(transaction_date);
    CREATE INDEX IF NOT EXISTS idx_transactions_amount ON transactions(amount);
    
    CREATE INDEX IF NOT EXISTS idx_matches_invoice_id ON matches(invoice_id);
    CREATE INDEX IF NOT EXISTS idx_matches_transaction_id ON matches(transaction_id);
    CREATE INDEX IF NOT EXISTS idx_matches_status ON matches(status);
    
    CREATE INDEX IF NOT EXISTS idx_anomalies_status ON anomalies(status);
    CREATE INDEX IF NOT EXISTS idx_anomalies_type ON anomalies(type);
    CREATE INDEX IF NOT EXISTS idx_anomalies_severity ON anomalies(severity);
  `);
}
