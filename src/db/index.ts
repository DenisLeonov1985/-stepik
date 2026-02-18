// ============================================
// OpenClaw - Инициализация базы данных
// ============================================

import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';
import { logger } from '../core/logger';

let db: Database.Database | null = null;

/**
 * Получить путь к файлу базы данных
 */
function getDbPath(): string {
  const dbPath = process.env.DATABASE_PATH || './data/openclaw.db';
  const dir = path.dirname(dbPath);
  
  // Создаём директорию если не существует
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  return dbPath;
}

/**
 * Инициализировать базу данных
 */
export function initDatabase(): Database.Database {
  if (db) {
    return db;
  }
  
  const dbPath = getDbPath();
  logger.info(`Инициализация базы данных: ${dbPath}`);
  
  db = new Database(dbPath);
  
  // Включаем foreign keys
  db.pragma('foreign_keys = ON');
  
  // Читаем и выполняем схему
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf-8');
  db.exec(schema);
  
  logger.info('База данных инициализирована успешно');
  
  return db;
}

/**
 * Получить экземпляр базы данных
 */
export function getDatabase(): Database.Database {
  if (!db) {
    return initDatabase();
  }
  return db;
}

/**
 * Закрыть соединение с базой данных
 */
export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
    logger.info('Соединение с базой данных закрыто');
  }
}

export default getDatabase;
