// ============================================
// OpenClaw - Сервис уведомлений
// ============================================

import getDatabase from '../db';
import { logger } from './logger';
import type { Notification, CreateNotificationInput, Task, User } from '../types';

/**
 * Сервис уведомлений - создание и управление уведомлениями
 */
export class NotificationService {
  private discordBot: any = null;
  private telegramBot: any = null;
  
  /**
   * Установить Discord бота для отправки уведомлений
   */
  setDiscordBot(bot: any): void {
    this.discordBot = bot;
  }
  
  /**
   * Установить Telegram бота для отправки уведомлений
   */
  setTelegramBot(bot: any): void {
    this.telegramBot = bot;
  }
  
  /**
   * Создать уведомление в базе данных
   */
  createNotification(input: CreateNotificationInput): Notification {
    const db = getDatabase();
    
    const stmt = db.prepare(`
      INSERT INTO notifications (user_id, message, type)
      VALUES (?, ?, ?)
    `);
    
    const result = stmt.run(input.user_id, input.message, input.type);
    
    logger.debug(`Создано уведомление для пользователя #${input.user_id}`);
    
    return this.getNotificationById(result.lastInsertRowid as number)!;
  }
  
  /**
   * Получить уведомление по ID
   */
  getNotificationById(id: number): Notification | null {
    const db = getDatabase();
    
    const stmt = db.prepare('SELECT * FROM notifications WHERE id = ?');
    const row = stmt.get(id) as any;
    
    return row || null;
  }
  
  /**
   * Получить непрочитанные уведомления пользователя
   */
  getUnreadNotifications(userId: number): Notification[] {
    const db = getDatabase();
    
    const stmt = db.prepare(`
      SELECT * FROM notifications 
      WHERE user_id = ? AND is_read = FALSE 
      ORDER BY sent_at DESC
    `);
    
    return stmt.all(userId) as Notification[];
  }
  
  /**
   * Отметить уведомление как прочитанное
   */
  markAsRead(notificationId: number): void {
    const db = getDatabase();
    
    const stmt = db.prepare('UPDATE notifications SET is_read = TRUE WHERE id = ?');
    stmt.run(notificationId);
  }
  
  /**
   * Отправить уведомление о назначении задачи
   */
  async notifyTaskAssigned(task: Task, assignee: User): Promise<void> {
    const message = `📋 Вам назначена задача: "${task.title}"`;
    
    this.createNotification({
      user_id: assignee.id,
      message,
      type: 'task_assigned',
    });
    
    await this.sendToUser(assignee, message);
  }
  
  /**
   * Отправить напоминание о дедлайне
   */
  async notifyDeadlineReminder(task: Task, assignee: User, hoursLeft: number): Promise<void> {
    const message = `⏰ Напоминание: до дедлайна задачи "${task.title}" осталось ${hoursLeft} ч.`;
    
    this.createNotification({
      user_id: assignee.id,
      message,
      type: 'deadline_reminder',
    });
    
    await this.sendToUser(assignee, message);
  }
  
  /**
   * Отправить уведомление об изменении статуса задачи
   */
  async notifyStatusChanged(task: Task, newStatus: string): Promise<void> {
    if (!task.created_by) return;
    
    const statusEmoji: Record<string, string> = {
      todo: '📝',
      in_progress: '🔄',
      review: '👀',
      done: '✅',
    };
    
    const message = `${statusEmoji[newStatus] || '📌'} Статус задачи "${task.title}" изменён на: ${newStatus}`;
    
    this.createNotification({
      user_id: task.created_by,
      message,
      type: 'status_changed',
    });
    
    // Получаем создателя задачи
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM users WHERE id = ?');
    const creator = stmt.get(task.created_by) as User | undefined;
    
    if (creator) {
      await this.sendToUser(creator, message);
    }
  }
  
  /**
   * Отправить уведомление о создании задачи
   */
  async notifyTaskCreated(task: Task): Promise<void> {
    const message = `🆕 Создана новая задача: "${task.title}"`;
    
    // Уведомляем всех менеджеров и админов
    const db = getDatabase();
    const stmt = db.prepare("SELECT * FROM users WHERE role IN ('admin', 'manager')");
    const managers = stmt.all() as User[];
    
    for (const manager of managers) {
      if (manager.id !== task.created_by) {
        this.createNotification({
          user_id: manager.id,
          message,
          type: 'task_created',
        });
        
        await this.sendToUser(manager, message);
      }
    }
  }
  
  /**
   * Отправить сообщение пользователю через доступные каналы
   */
  private async sendToUser(user: User, message: string): Promise<void> {
    const promises: Promise<void>[] = [];
    
    // Отправка через Discord
    if (user.discord_id && this.discordBot) {
      promises.push(this.sendViaDiscord(user.discord_id, message));
    }
    
    // Отправка через Telegram
    if (user.telegram_id && this.telegramBot) {
      promises.push(this.sendViaTelegram(user.telegram_id, message));
    }
    
    await Promise.allSettled(promises);
  }
  
  /**
   * Отправить сообщение через Discord
   */
  private async sendViaDiscord(discordId: string, message: string): Promise<void> {
    try {
      if (this.discordBot?.users) {
        const user = await this.discordBot.users.fetch(discordId);
        if (user) {
          await user.send(message);
          logger.debug(`Discord сообщение отправлено: ${discordId}`);
        }
      }
    } catch (error) {
      logger.error(`Ошибка отправки Discord сообщения: ${error}`);
    }
  }
  
  /**
   * Отправить сообщение через Telegram
   */
  private async sendViaTelegram(telegramId: string, message: string): Promise<void> {
    try {
      if (this.telegramBot) {
        await this.telegramBot.sendMessage(telegramId, message);
        logger.debug(`Telegram сообщение отправлено: ${telegramId}`);
      }
    } catch (error) {
      logger.error(`Ошибка отправки Telegram сообщения: ${error}`);
    }
  }
}

// Экспортируем singleton экземпляр
export const notificationService = new NotificationService();
