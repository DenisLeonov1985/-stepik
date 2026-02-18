// ============================================
// Airtable Integration
// ============================================

import Airtable from 'airtable';
import { User, Task } from '../types';
import logger from '../core/logger';

// Инициализация Airtable (опционально)
let base: ReturnType<Airtable.Base> | null = null;

if (process.env.AIRTABLE_API_KEY && process.env.AIRTABLE_BASE_ID) {
  const airtable = new Airtable({
    apiKey: process.env.AIRTABLE_API_KEY
  });
  base = airtable.base(process.env.AIRTABLE_BASE_ID);
} else {
  logger.warn('Airtable not configured. Set AIRTABLE_API_KEY and AIRTABLE_BASE_ID in .env');
}

// Названия таблиц в Airtable
const TABLES = {
  USERS: 'Users',
  TASKS: 'Tasks',
  NOTIFICATIONS: 'Notifications',
  CHECKINS: 'Check-ins'
};

// ============================================
// Синхронизация пользователей
// ============================================

/**
 * Сохранить пользователя в Airtable
 */
export async function syncUserToAirtable(user: User): Promise<void> {
  if (!base) {
    logger.debug('Airtable not configured, skipping user sync');
    return;
  }
  try {
    // Проверяем, существует ли пользователь
    const existingRecords = await base(TABLES.USERS)
      .select({
        filterByFormula: `{discord_id} = '${user.discord_id}'`,
        maxRecords: 1
      })
      .firstPage();

    const fields = {
      username: user.username,
      discord_id: user.discord_id || '',
      telegram_id: user.telegram_id || '',
      role: user.role,
      created_at: user.created_at
    };

    if (existingRecords.length > 0) {
      // Обновляем существующую запись
      await base(TABLES.USERS).update(existingRecords[0].id, fields);
      logger.info(`User ${user.username} updated in Airtable`);
    } else {
      // Создаём новую запись
      await base(TABLES.USERS).create([{ fields }]);
      logger.info(`User ${user.username} created in Airtable`);
    }
  } catch (error) {
    logger.error(`Failed to sync user to Airtable: ${error}`);
    throw error;
  }
}

/**
 * Получить всех пользователей из Airtable
 */
export async function getUsersFromAirtable(): Promise<any[]> {
  try {
    const records = await base(TABLES.USERS).select().all();
    return records.map(record => ({
      id: record.id,
      ...record.fields
    }));
  } catch (error) {
    logger.error(`Failed to get users from Airtable: ${error}`);
    throw error;
  }
}

// ============================================
// Синхронизация задач
// ============================================

/**
 * Сохранить задачу в Airtable
 */
export async function syncTaskToAirtable(task: Task): Promise<void> {
  try {
    // Проверяем, существует ли задача
    const existingRecords = await base(TABLES.TASKS)
      .select({
        filterByFormula: `{task_id} = ${task.id}`,
        maxRecords: 1
      })
      .firstPage();

    const fields = {
      task_id: task.id,
      title: task.title,
      description: task.description || '',
      status: task.status,
      priority: task.priority,
      assignee_id: task.assignee_id || 0,
      assignee_username: task.assignee?.username || '',
      created_by: task.created_by,
      creator_username: task.creator?.username || '',
      deadline: task.deadline || '',
      created_at: task.created_at,
      updated_at: task.updated_at
    };

    if (existingRecords.length > 0) {
      // Обновляем существующую запись
      await base(TABLES.TASKS).update(existingRecords[0].id, fields);
      logger.info(`Task #${task.id} updated in Airtable`);
    } else {
      // Создаём новую запись
      await base(TABLES.TASKS).create([{ fields }]);
      logger.info(`Task #${task.id} created in Airtable`);
    }
  } catch (error) {
    logger.error(`Failed to sync task to Airtable: ${error}`);
    throw error;
  }
}

/**
 * Получить все задачи из Airtable
 */
export async function getTasksFromAirtable(): Promise<any[]> {
  try {
    const records = await base(TABLES.TASKS).select().all();
    return records.map(record => ({
      id: record.id,
      ...record.fields
    }));
  } catch (error) {
    logger.error(`Failed to get tasks from Airtable: ${error}`);
    throw error;
  }
}

// ============================================
// Синхронизация уведомлений
// ============================================

/**
 * Сохранить уведомление в Airtable
 */
export async function syncNotificationToAirtable(notification: {
  user_id: number;
  username: string;
  message: string;
  type: string;
  sent_at: string;
}): Promise<void> {
  try {
    await base(TABLES.NOTIFICATIONS).create([
      {
        fields: {
          user_id: notification.user_id,
          username: notification.username,
          message: notification.message,
          type: notification.type,
          sent_at: notification.sent_at
        }
      }
    ]);
    logger.info(`Notification for user ${notification.username} saved to Airtable`);
  } catch (error) {
    logger.error(`Failed to sync notification to Airtable: ${error}`);
    throw error;
  }
}

// ============================================
// Массовая синхронизация
// ============================================

/**
 * Синхронизировать всех пользователей из SQLite в Airtable
 */
export async function syncAllUsersToAirtable(users: User[]): Promise<void> {
  logger.info(`Starting sync of ${users.length} users to Airtable...`);
  
  for (const user of users) {
    try {
      await syncUserToAirtable(user);
    } catch (error) {
      logger.error(`Failed to sync user ${user.username}: ${error}`);
    }
  }
  
  logger.info('User sync completed');
}

/**
 * Синхронизировать все задачи из SQLite в Airtable
 */
export async function syncAllTasksToAirtable(tasks: Task[]): Promise<void> {
  logger.info(`Starting sync of ${tasks.length} tasks to Airtable...`);
  
  for (const task of tasks) {
    try {
      await syncTaskToAirtable(task);
    } catch (error) {
      logger.error(`Failed to sync task #${task.id}: ${error}`);
    }
  }
  
  logger.info('Task sync completed');
}

// ============================================
// Проверка подключения
// ============================================

/**
 * Проверить подключение к Airtable
 */
export async function testAirtableConnection(): Promise<boolean> {
  try {
    await base(TABLES.USERS).select({ maxRecords: 1 }).firstPage();
    logger.info('Airtable connection successful');
    return true;
  } catch (error) {
    logger.error(`Airtable connection failed: ${error}`);
    return false;
  }
}

// ============================================
// Check-ins (опросы участников)
// ============================================

/**
 * Сохранить ответ на check-in в Airtable
 */
export async function saveCheckinToAirtable(checkin: {
  user_id: number;
  username: string;
  question: string;
  answer: string;
  timestamp: string;
}): Promise<void> {
  try {
    await base(TABLES.CHECKINS).create([
      {
        fields: {
          user_id: checkin.user_id,
          username: checkin.username,
          question: checkin.question,
          answer: checkin.answer,
          timestamp: checkin.timestamp
        }
      }
    ]);
    logger.info(`Check-in saved for user ${checkin.username}`);
  } catch (error) {
    logger.error(`Failed to save check-in to Airtable: ${error}`);
    throw error;
  }
}
