// ============================================
// OpenClaw - Менеджер команды
// ============================================

import getDatabase from '../db';
import { logger } from './logger';
import type { User, CreateUserInput, UserRole } from '../types';
import { syncUserToAirtable } from '../integrations/airtable';

/**
 * Менеджер команды - управление пользователями
 */
export class TeamManager {
  /**
   * Создать нового пользователя
   */
  createUser(input: CreateUserInput): User {
    const db = getDatabase();
    
    const stmt = db.prepare(`
      INSERT INTO users (username, discord_id, telegram_id, role)
      VALUES (?, ?, ?, ?)
    `);
    
    const result = stmt.run(
      input.username,
      input.discord_id || null,
      input.telegram_id || null,
      input.role || 'member'
    );
    
    logger.info(`Создан пользователь #${result.lastInsertRowid}: ${input.username}`);
    
    const user = this.getUserById(result.lastInsertRowid as number)!;
    
    // Синхронизация с Airtable (асинхронно, не блокируем основной поток)
    if (process.env.AIRTABLE_API_KEY && process.env.AIRTABLE_BASE_ID) {
      syncUserToAirtable(user).catch(err => {
        logger.error(`Failed to sync user to Airtable: ${err}`);
      });
    }
    
    return user;
  }
  
  /**
   * Получить пользователя по ID
   */
  getUserById(id: number): User | null {
    const db = getDatabase();
    
    const stmt = db.prepare('SELECT * FROM users WHERE id = ?');
    const row = stmt.get(id) as any;
    
    return row || null;
  }
  
  /**
   * Получить пользователя по Discord ID
   */
  getUserByDiscordId(discordId: string): User | null {
    const db = getDatabase();
    
    const stmt = db.prepare('SELECT * FROM users WHERE discord_id = ?');
    const row = stmt.get(discordId) as any;
    
    return row || null;
  }
  
  /**
   * Получить пользователя по Telegram ID
   */
  getUserByTelegramId(telegramId: string): User | null {
    const db = getDatabase();
    
    const stmt = db.prepare('SELECT * FROM users WHERE telegram_id = ?');
    const row = stmt.get(telegramId) as any;
    
    return row || null;
  }
  
  /**
   * Получить пользователя по имени
   */
  getUserByUsername(username: string): User | null {
    const db = getDatabase();
    
    const stmt = db.prepare('SELECT * FROM users WHERE username = ?');
    const row = stmt.get(username) as any;
    
    return row || null;
  }
  
  /**
   * Получить всех пользователей
   */
  getAllUsers(): User[] {
    const db = getDatabase();
    
    const stmt = db.prepare('SELECT * FROM users ORDER BY created_at ASC');
    const rows = stmt.all() as any[];
    
    return rows;
  }
  
  /**
   * Обновить роль пользователя
   */
  updateUserRole(userId: number, role: UserRole): User | null {
    const db = getDatabase();
    
    const stmt = db.prepare('UPDATE users SET role = ? WHERE id = ?');
    stmt.run(role, userId);
    
    logger.info(`Обновлена роль пользователя #${userId} на ${role}`);
    
    return this.getUserById(userId);
  }
  
  /**
   * Связать Discord аккаунт с пользователем
   */
  linkDiscord(userId: number, discordId: string): User | null {
    const db = getDatabase();
    
    const stmt = db.prepare('UPDATE users SET discord_id = ? WHERE id = ?');
    stmt.run(discordId, userId);
    
    logger.info(`Discord аккаунт привязан к пользователю #${userId}`);
    
    return this.getUserById(userId);
  }
  
  /**
   * Связать Telegram аккаунт с пользователем
   */
  linkTelegram(userId: number, telegramId: string): User | null {
    const db = getDatabase();
    
    const stmt = db.prepare('UPDATE users SET telegram_id = ? WHERE id = ?');
    stmt.run(telegramId, userId);
    
    logger.info(`Telegram аккаунт привязан к пользователю #${userId}`);
    
    return this.getUserById(userId);
  }
  
  /**
   * Удалить пользователя
   */
  deleteUser(userId: number): boolean {
    const db = getDatabase();
    
    const stmt = db.prepare('DELETE FROM users WHERE id = ?');
    const result = stmt.run(userId);
    
    if (result.changes > 0) {
      logger.info(`Удалён пользователь #${userId}`);
      return true;
    }
    
    return false;
  }
  
  /**
   * Получить или создать пользователя по Discord данным
   */
  getOrCreateByDiscord(discordId: string, username: string): User {
    let user = this.getUserByDiscordId(discordId);
    
    if (!user) {
      // Проверяем есть ли пользователь с таким именем
      user = this.getUserByUsername(username);
      
      if (user) {
        // Привязываем Discord к существующему пользователю
        user = this.linkDiscord(user.id, discordId);
      } else {
        // Создаём нового пользователя
        user = this.createUser({
          username,
          discord_id: discordId,
        });
      }
    }
    
    return user!;
  }
  
  /**
   * Получить или создать пользователя по Telegram данным
   */
  getOrCreateByTelegram(telegramId: string, username: string): User {
    let user = this.getUserByTelegramId(telegramId);
    
    if (!user) {
      // Проверяем есть ли пользователь с таким именем
      user = this.getUserByUsername(username);
      
      if (user) {
        // Привязываем Telegram к существующему пользователю
        user = this.linkTelegram(user.id, telegramId);
      } else {
        // Создаём нового пользователя
        user = this.createUser({
          username,
          telegram_id: telegramId,
        });
      }
    }
    
    return user!;
  }
  
  /**
   * Проверить права пользователя
   */
  hasPermission(userId: number, requiredRole: UserRole): boolean {
    const user = this.getUserById(userId);
    
    if (!user) return false;
    
    const roleHierarchy: Record<UserRole, number> = {
      admin: 3,
      manager: 2,
      member: 1,
    };
    
    return roleHierarchy[user.role] >= roleHierarchy[requiredRole];
  }
}

// Экспортируем singleton экземпляр
export const teamManager = new TeamManager();
