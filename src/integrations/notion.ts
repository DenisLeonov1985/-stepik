// ============================================
// Notion Integration
// ============================================

import { Client } from '@notionhq/client';
import { User, Task } from '../types';
import logger from '../core/logger';

// Инициализация Notion клиента
const notion = new Client({
  auth: process.env.NOTION_TOKEN || ''
});

// ID базы данных Notion
const DATABASE_ID = process.env.NOTION_DATABASE_ID || 'faaff92a-bcab-486c-9fdf-c9f2666d3fa7';

// ============================================
// Синхронизация пользователей
// ============================================

/**
 * Сохранить пользователя в Notion
 */
export async function syncUserToNotion(user: User): Promise<string | null> {
  try {
    // Проверяем, существует ли пользователь
    // @ts-expect-error - Notion API types may be incomplete
    const existingRecords = await notion.databases.query({
      database_id: DATABASE_ID,
      filter: {
        property: 'discord_id',
        rich_text: { equals: user.discord_id || '' }
      },
      page_size: 1
    });

    const properties = {
      title: {
        title: [{ text: { content: user.username } }]
      },
      discord_id: {
        rich_text: [{ text: { content: user.discord_id || '' } }]
      },
      telegram_id: {
        rich_text: [{ text: { content: user.telegram_id || '' } }]
      },
      role: {
        select: { name: user.role }
      },
      created_at: {
        date: { start: user.created_at }
      }
    };

    if (existingRecords.results.length > 0) {
      // Обновляем существующую запись
      const pageId = existingRecords.results[0].id;
      await notion.pages.update({
        page_id: pageId,
        properties: properties as any
      });
      logger.info(`User ${user.username} updated in Notion`);
      return pageId;
    } else {
      // Создаём новую запись
      const response = await notion.pages.create({
        parent: { database_id: DATABASE_ID },
        properties: properties as any
      });
      logger.info(`User ${user.username} created in Notion`);
      return response.id;
    }
  } catch (error) {
    logger.error(`Failed to sync user to Notion: ${error}`);
    throw error;
  }
}

/**
 * Получить всех пользователей из Notion
 */
export async function getUsersFromNotion(): Promise<any[]> {
  try {
    // @ts-expect-error - Notion API types may be incomplete
    const response = await notion.databases.query({
      database_id: DATABASE_ID
    });
    
    return response.results.map((page: any) => {
      const props = page.properties;
      return {
        id: page.id,
        username: props.title?.title?.[0]?.text?.content || '',
        discord_id: props.discord_id?.rich_text?.[0]?.text?.content || '',
        telegram_id: props.telegram_id?.rich_text?.[0]?.text?.content || '',
        role: props.role?.select?.name || 'member',
        created_at: props.created_at?.date?.start || ''
      };
    });
  } catch (error) {
    logger.error(`Failed to get users from Notion: ${error}`);
    throw error;
  }
}

// ============================================
// Синхронизация задач
// ============================================

/**
 * Сохранить задачу в Notion
 */
export async function syncTaskToNotion(task: Task): Promise<string | null> {
  try {
    // Проверяем, существует ли задача
    // @ts-expect-error - Notion API types may be incomplete
    const existingRecords = await notion.databases.query({
      database_id: DATABASE_ID,
      filter: {
        property: 'task_id',
        number: { equals: task.id }
      },
      page_size: 1
    });

    const properties = {
      title: {
        title: [{ text: { content: task.title } }]
      },
      task_id: {
        number: task.id
      },
      description: {
        rich_text: [{ text: { content: task.description || '' } }]
      },
      status: {
        select: { name: task.status }
      },
      priority: {
        select: { name: task.priority }
      },
      assignee_id: {
        number: task.assignee_id || null
      },
      assignee_username: {
        rich_text: [{ text: { content: task.assignee?.username || '' } }]
      },
      created_by: {
        number: task.created_by
      },
      creator_username: {
        rich_text: [{ text: { content: task.creator?.username || '' } }]
      },
      deadline: {
        date: task.deadline ? { start: task.deadline } : null
      },
      created_at: {
        date: { start: task.created_at }
      },
      updated_at: {
        date: { start: task.updated_at }
      }
    };

    if (existingRecords.results.length > 0) {
      // Обновляем существующую запись
      const pageId = existingRecords.results[0].id;
      await notion.pages.update({
        page_id: pageId,
        properties: properties as any
      });
      logger.info(`Task #${task.id} updated in Notion`);
      return pageId;
    } else {
      // Создаём новую запись
      const response = await notion.pages.create({
        parent: { database_id: DATABASE_ID },
        properties: properties as any
      });
      logger.info(`Task #${task.id} created in Notion`);
      return response.id;
    }
  } catch (error) {
    logger.error(`Failed to sync task to Notion: ${error}`);
    throw error;
  }
}

/**
 * Получить все задачи из Notion
 */
export async function getTasksFromNotion(): Promise<any[]> {
  try {
    // @ts-expect-error - Notion API types may be incomplete
    const response = await notion.databases.query({
      database_id: DATABASE_ID,
      filter: {
        property: 'task_id',
        number: { is_not_empty: true }
      }
    });
    
    return response.results.map((page: any) => {
      const props = page.properties;
      return {
        id: page.id,
        task_id: props.task_id?.number || 0,
        title: props.title?.title?.[0]?.text?.content || '',
        description: props.description?.rich_text?.[0]?.text?.content || '',
        status: props.status?.select?.name || 'todo',
        priority: props.priority?.select?.name || 'medium',
        assignee_id: props.assignee_id?.number || null,
        assignee_username: props.assignee_username?.rich_text?.[0]?.text?.content || '',
        created_by: props.created_by?.number || 0,
        creator_username: props.creator_username?.rich_text?.[0]?.text?.content || '',
        deadline: props.deadline?.date?.start || null,
        created_at: props.created_at?.date?.start || '',
        updated_at: props.updated_at?.date?.start || ''
      };
    });
  } catch (error) {
    logger.error(`Failed to get tasks from Notion: ${error}`);
    throw error;
  }
}

// ============================================
// Синхронизация уведомлений
// ============================================

/**
 * Сохранить уведомление в Notion
 */
export async function syncNotificationToNotion(notification: {
  user_id: number;
  username: string;
  message: string;
  type: string;
  sent_at: string;
}): Promise<string | null> {
  try {
    const response = await notion.pages.create({
      parent: { database_id: DATABASE_ID },
      properties: {
        title: {
          title: [{ text: { content: `[${notification.type}] ${notification.username}` } }]
        },
        user_id: {
          number: notification.user_id
        },
        username: {
          rich_text: [{ text: { content: notification.username } }]
        },
        message: {
          rich_text: [{ text: { content: notification.message } }]
        },
        type: {
          select: { name: notification.type }
        },
        sent_at: {
          date: { start: notification.sent_at }
        }
      } as any
    });
    logger.info(`Notification for user ${notification.username} saved to Notion`);
    return response.id;
  } catch (error) {
    logger.error(`Failed to sync notification to Notion: ${error}`);
    throw error;
  }
}

// ============================================
// Массовая синхронизация
// ============================================

/**
 * Синхронизировать всех пользователей из SQLite в Notion
 */
export async function syncAllUsersToNotion(users: User[]): Promise<void> {
  logger.info(`Starting sync of ${users.length} users to Notion...`);
  
  for (const user of users) {
    try {
      await syncUserToNotion(user);
    } catch (error) {
      logger.error(`Failed to sync user ${user.username}: ${error}`);
    }
  }
  
  logger.info('User sync to Notion completed');
}

/**
 * Синхронизировать все задачи из SQLite в Notion
 */
export async function syncAllTasksToNotion(tasks: Task[]): Promise<void> {
  logger.info(`Starting sync of ${tasks.length} tasks to Notion...`);
  
  for (const task of tasks) {
    try {
      await syncTaskToNotion(task);
    } catch (error) {
      logger.error(`Failed to sync task #${task.id}: ${error}`);
    }
  }
  
  logger.info('Task sync to Notion completed');
}

// ============================================
// Проверка подключения
// ============================================

/**
 * Проверить подключение к Notion
 */
export async function testNotionConnection(): Promise<boolean> {
  try {
    await notion.databases.retrieve({ database_id: DATABASE_ID });
    logger.info('Notion connection successful');
    return true;
  } catch (error) {
    logger.error(`Notion connection failed: ${error}`);
    return false;
  }
}

/**
 * Получить информацию о базе данных Notion
 */
export async function getNotionDatabaseInfo(): Promise<any> {
  try {
    const response = await notion.databases.retrieve({ database_id: DATABASE_ID });
    return {
      id: response.id,
      title: (response as any).title?.[0]?.text?.content || 'Untitled',
      properties: Object.keys((response as any).properties || {})
    };
  } catch (error) {
    logger.error(`Failed to get Notion database info: ${error}`);
    throw error;
  }
}

// ============================================
// Создание страницы (общий метод)
// ============================================

/**
 * Создать новую страницу в Notion
 */
export async function createNotionPage(properties: Record<string, any>): Promise<string | null> {
  try {
    const response = await notion.pages.create({
      parent: { database_id: DATABASE_ID },
      properties: properties as any
    });
    logger.info('New page created in Notion');
    return response.id;
  } catch (error) {
    logger.error(`Failed to create Notion page: ${error}`);
    throw error;
  }
}

/**
 * Обновить страницу в Notion
 */
export async function updateNotionPage(pageId: string, properties: Record<string, any>): Promise<void> {
  try {
    await notion.pages.update({
      page_id: pageId,
      properties: properties as any
    });
    logger.info(`Notion page ${pageId} updated`);
  } catch (error) {
    logger.error(`Failed to update Notion page: ${error}`);
    throw error;
  }
}

/**
 * Удалить страницу в Notion (archive)
 */
export async function deleteNotionPage(pageId: string): Promise<void> {
  try {
    await notion.pages.update({
      page_id: pageId,
      archived: true
    });
    logger.info(`Notion page ${pageId} archived`);
  } catch (error) {
    logger.error(`Failed to archive Notion page: ${error}`);
    throw error;
  }
}
