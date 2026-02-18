// ============================================
// OpenClaw - Менеджер задач
// ============================================

import getDatabase from '../db';
import { logger } from './logger';
import type { 
  Task, 
  CreateTaskInput, 
  UpdateTaskInput, 
  TaskFilter,
  User 
} from '../types';
import { syncTaskToAirtable } from '../integrations/airtable';

/**
 * Менеджер задач - CRUD операции с задачами
 */
export class TaskManager {
  /**
   * Создать новую задачу
   */
  createTask(input: CreateTaskInput): Task {
    const db = getDatabase();
    
    const stmt = db.prepare(`
      INSERT INTO tasks (title, description, priority, assignee_id, created_by, deadline)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    const result = stmt.run(
      input.title,
      input.description || null,
      input.priority || 'medium',
      input.assignee_id || null,
      input.created_by,
      input.deadline || null
    );
    
    logger.info(`Создана задача #${result.lastInsertRowid}: ${input.title}`);
    
    const task = this.getTaskById(result.lastInsertRowid as number)!;
    
    // Синхронизация с Airtable (асинхронно, не блокируем основной поток)
    if (process.env.AIRTABLE_API_KEY && process.env.AIRTABLE_BASE_ID) {
      syncTaskToAirtable(task).catch(err => {
        logger.error(`Failed to sync task to Airtable: ${err}`);
      });
    }
    
    return task;
  }
  
  /**
   * Получить задачу по ID
   */
  getTaskById(id: number): Task | null {
    const db = getDatabase();
    
    const stmt = db.prepare(`
      SELECT t.*, 
        u1.username as assignee_username, 
        u1.discord_id as assignee_discord_id,
        u1.telegram_id as assignee_telegram_id,
        u1.role as assignee_role,
        u2.username as creator_username,
        u2.discord_id as creator_discord_id,
        u2.telegram_id as creator_telegram_id,
        u2.role as creator_role
      FROM tasks t
      LEFT JOIN users u1 ON t.assignee_id = u1.id
      JOIN users u2 ON t.created_by = u2.id
      WHERE t.id = ?
    `);
    
    const row = stmt.get(id) as any;
    
    if (!row) return null;
    
    return this.mapRowToTask(row);
  }
  
  /**
   * Получить список задач с фильтрацией
   */
  getTasks(filter?: TaskFilter): Task[] {
    const db = getDatabase();
    
    let query = `
      SELECT t.*, 
        u1.username as assignee_username, 
        u1.discord_id as assignee_discord_id,
        u1.telegram_id as assignee_telegram_id,
        u1.role as assignee_role,
        u2.username as creator_username,
        u2.discord_id as creator_discord_id,
        u2.telegram_id as creator_telegram_id,
        u2.role as creator_role
      FROM tasks t
      LEFT JOIN users u1 ON t.assignee_id = u1.id
      JOIN users u2 ON t.created_by = u2.id
      WHERE 1=1
    `;
    
    const params: any[] = [];
    
    if (filter?.status) {
      query += ' AND t.status = ?';
      params.push(filter.status);
    }
    
    if (filter?.priority) {
      query += ' AND t.priority = ?';
      params.push(filter.priority);
    }
    
    if (filter?.assignee_id !== undefined) {
      if (filter.assignee_id === null) {
        query += ' AND t.assignee_id IS NULL';
      } else {
        query += ' AND t.assignee_id = ?';
        params.push(filter.assignee_id);
      }
    }
    
    if (filter?.created_by) {
      query += ' AND t.created_by = ?';
      params.push(filter.created_by);
    }
    
    query += ' ORDER BY t.created_at DESC';
    
    const stmt = db.prepare(query);
    const rows = stmt.all(...params) as any[];
    
    return rows.map(row => this.mapRowToTask(row));
  }
  
  /**
   * Обновить задачу
   */
  updateTask(id: number, input: UpdateTaskInput): Task | null {
    const db = getDatabase();
    
    const updates: string[] = [];
    const params: any[] = [];
    
    if (input.title !== undefined) {
      updates.push('title = ?');
      params.push(input.title);
    }
    
    if (input.description !== undefined) {
      updates.push('description = ?');
      params.push(input.description);
    }
    
    if (input.status !== undefined) {
      updates.push('status = ?');
      params.push(input.status);
    }
    
    if (input.priority !== undefined) {
      updates.push('priority = ?');
      params.push(input.priority);
    }
    
    if (input.assignee_id !== undefined) {
      updates.push('assignee_id = ?');
      params.push(input.assignee_id);
    }
    
    if (input.deadline !== undefined) {
      updates.push('deadline = ?');
      params.push(input.deadline);
    }
    
    if (updates.length === 0) {
      return this.getTaskById(id);
    }
    
    params.push(id);
    
    const stmt = db.prepare(`
      UPDATE tasks 
      SET ${updates.join(', ')}
      WHERE id = ?
    `);
    
    stmt.run(...params);
    
    logger.info(`Обновлена задача #${id}`);
    
    const task = this.getTaskById(id);
    
    // Синхронизация с Airtable (асинхронно, не блокируем основной поток)
    if (task && process.env.AIRTABLE_API_KEY && process.env.AIRTABLE_BASE_ID) {
      syncTaskToAirtable(task).catch(err => {
        logger.error(`Failed to sync task to Airtable: ${err}`);
      });
    }
    
    return task;
  }
  
  /**
   * Удалить задачу
   */
  deleteTask(id: number): boolean {
    const db = getDatabase();
    
    const stmt = db.prepare('DELETE FROM tasks WHERE id = ?');
    const result = stmt.run(id);
    
    if (result.changes > 0) {
      logger.info(`Удалена задача #${id}`);
      return true;
    }
    
    return false;
  }
  
  /**
   * Получить задачи пользователя
   */
  getUserTasks(userId: number): Task[] {
    return this.getTasks({ assignee_id: userId });
  }
  
  /**
   * Получить задачи с приближающимися дедлайнами
   */
  getUpcomingDeadlines(hours: number): Task[] {
    const db = getDatabase();
    
    const stmt = db.prepare(`
      SELECT t.*, 
        u1.username as assignee_username, 
        u1.discord_id as assignee_discord_id,
        u1.telegram_id as assignee_telegram_id,
        u1.role as assignee_role,
        u2.username as creator_username,
        u2.discord_id as creator_discord_id,
        u2.telegram_id as creator_telegram_id,
        u2.role as creator_role
      FROM tasks t
      LEFT JOIN users u1 ON t.assignee_id = u1.id
      JOIN users u2 ON t.created_by = u2.id
      WHERE t.deadline IS NOT NULL
        AND t.status != 'done'
        AND datetime(t.deadline) <= datetime('now', '+' || ? || ' hours')
        AND datetime(t.deadline) > datetime('now')
      ORDER BY t.deadline ASC
    `);
    
    const rows = stmt.all(hours) as any[];
    return rows.map(row => this.mapRowToTask(row));
  }
  
  /**
   * Преобразовать строку БД в объект Task
   */
  private mapRowToTask(row: any): Task {
    const task: Task = {
      id: row.id,
      title: row.title,
      description: row.description,
      status: row.status,
      priority: row.priority,
      assignee_id: row.assignee_id,
      created_by: row.created_by,
      deadline: row.deadline,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
    
    if (row.assignee_username) {
      task.assignee = {
        id: row.assignee_id,
        username: row.assignee_username,
        discord_id: row.assignee_discord_id,
        telegram_id: row.assignee_telegram_id,
        role: row.assignee_role,
        created_at: '', // Не важно для отображения
      };
    }
    
    if (row.creator_username) {
      task.creator = {
        id: row.created_by,
        username: row.creator_username,
        discord_id: row.creator_discord_id,
        telegram_id: row.creator_telegram_id,
        role: row.creator_role,
        created_at: '',
      };
    }
    
    return task;
  }
}

// Экспортируем singleton экземпляр
export const taskManager = new TaskManager();
