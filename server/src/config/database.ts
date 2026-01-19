import { drizzle } from 'drizzle-orm/sqlite3';
import { Database } from 'sqlite3';
import * as schema from '../models/index';

const sqlite = new Database(process.env.DATABASE_URL || './data/app.db');
export const db = drizzle(sqlite, { schema });

// Enable foreign keys
sqlite.run('PRAGMA foreign_keys = ON');

// Create tables if they don't exist
export const initializeDatabase = () => {
  // This will be handled by migration scripts
  console.log('Database initialized');
};