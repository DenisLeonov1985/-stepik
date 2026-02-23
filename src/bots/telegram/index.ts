// ============================================
// OpenClaw - Telegram Bot
// ============================================

import TelegramBot from 'node-telegram-bot-api';
import { taskManager } from '../../core/task-manager';
import { teamManager } from '../../core/team-manager';
import { notificationService } from '../../core/notification-service';
import { logger } from '../../core/logger';
import type { Task, User, TaskStatus, TaskPriority } from '../../types';

// ============================================
// Telegram Bot Class
// ============================================

export class TelegramBotHandler {
  private bot: TelegramBot;

  constructor(token: string) {
    this.bot = new TelegramBot(token, { polling: true });
    this.setupHandlers();
  }

  /**
   * Start the bot
   */
  start(): void {
    logger.info('Telegram bot started');
  }

  /**
   * Get the bot instance
   */
  getBot(): TelegramBot {
    return this.bot;
  }

  /**
   * Setup command handlers
   */
  private setupHandlers(): void {
    // /start - Register user
    this.bot.onText(/\/start/, async msg => {
      const chatId = msg.chat.id.toString();
      const username = msg.from?.username || `user_${msg.from?.id}`;

      const user = teamManager.getOrCreateByTelegram(chatId, username);

      await this.bot.sendMessage(
        chatId,
        `Welcome to OpenClaw, ${user.username}!\n\n` +
          'Available commands:\n' +
          '/tasks - List all tasks\n' +
          '/my - Show my tasks\n' +
          '/task_create <title> - Create a new task\n' +
          '/task_<id> - Show task details\n' +
          '/assign_<task_id> - Assign task to yourself\n' +
          '/status_<task_id>_<status> - Change task status\n' +
          '/team - List team members\n' +
          '/checkin - Share how you\'re doing'
      );
    });

    // /tasks - List all tasks
    this.bot.onText(/\/tasks/, async msg => {
      const chatId = msg.chat.id;
      const tasks = taskManager.getTasks();

      if (tasks.length === 0) {
        await this.bot.sendMessage(chatId, 'No tasks found.');
        return;
      }

      const message = tasks
        .slice(0, 20)
        .map(t => {
          const statusEmoji = this.getStatusEmoji(t.status);
          const priorityEmoji = this.getPriorityEmoji(t.priority);
          const assignee = t.assignee ? ` @${t.assignee.username}` : ' unassigned';
          return `${statusEmoji} #${t.id} ${t.title}${assignee} ${priorityEmoji}`;
        })
        .join('\n');

      await this.bot.sendMessage(chatId, `Tasks:\n${message}`);
    });

    // /my - Show my tasks
    this.bot.onText(/\/my/, async msg => {
      const chatId = msg.chat.id.toString();
      const username = msg.from?.username || `user_${msg.from?.id}`;

      const user = teamManager.getUserByTelegramId(chatId);
      if (!user) {
        await this.bot.sendMessage(msg.chat.id, 'Please use /start first to register.');
        return;
      }

      const tasks = taskManager.getUserTasks(user.id);

      if (tasks.length === 0) {
        await this.bot.sendMessage(msg.chat.id, 'You have no assigned tasks.');
        return;
      }

      const message = tasks
        .map(t => {
          const statusEmoji = this.getStatusEmoji(t.status);
          const priorityEmoji = this.getPriorityEmoji(t.priority);
          const deadline = t.deadline ? ` (due: ${t.deadline})` : '';
          return `${statusEmoji} #${t.id} ${t.title}${deadline} ${priorityEmoji}`;
        })
        .join('\n');

      await this.bot.sendMessage(msg.chat.id, `Your tasks:\n${message}`);
    });

    // /task_create <title> - Create a new task
    this.bot.onText(/\/task_create (.+)/, async (msg, match) => {
      const chatId = msg.chat.id.toString();
      const title = match?.[1];

      if (!title) {
        await this.bot.sendMessage(msg.chat.id, 'Usage: /task_create <title>');
        return;
      }

      const username = msg.from?.username || `user_${msg.from?.id}`;
      const user = teamManager.getOrCreateByTelegram(chatId, username);

      const task = taskManager.createTask({
        title,
        created_by: user.id,
      });

      await notificationService.notifyTaskCreated(task);

      await this.bot.sendMessage(
        msg.chat.id,
        `Task #${task.id} created: "${task.title}"\n` +
          `Use /assign_${task.id} to assign it to yourself.`
      );
    });

    // /task_<id> - Show task details
    this.bot.onText(/\/task_(\d+)/, async (msg, match) => {
      const taskId = parseInt(match?.[1] || '0', 10);
      const task = taskManager.getTaskById(taskId);

      if (!task) {
        await this.bot.sendMessage(msg.chat.id, 'Task not found.');
        return;
      }

      const message =
        `Task #${task.id}: ${task.title}\n\n` +
        `Status: ${this.getStatusEmoji(task.status)} ${task.status}\n` +
        `Priority: ${this.getPriorityEmoji(task.priority)} ${task.priority}\n` +
        `Created by: ${task.creator?.username || 'Unknown'}\n` +
        (task.assignee ? `Assignee: ${task.assignee.username}\n` : '') +
        (task.deadline ? `Deadline: ${task.deadline}\n` : '') +
        (task.description ? `\nDescription: ${task.description}` : '');

      await this.bot.sendMessage(msg.chat.id, message);
    });

    // /assign_<task_id> - Assign task to yourself
    this.bot.onText(/\/assign_(\d+)/, async (msg, match) => {
      const chatId = msg.chat.id.toString();
      const taskId = parseInt(match?.[1] || '0', 10);

      const task = taskManager.getTaskById(taskId);
      if (!task) {
        await this.bot.sendMessage(msg.chat.id, 'Task not found.');
        return;
      }

      const username = msg.from?.username || `user_${msg.from?.id}`;
      const user = teamManager.getOrCreateByTelegram(chatId, username);

      const updatedTask = taskManager.updateTask(taskId, { assignee_id: user.id });

      if (updatedTask) {
        await notificationService.notifyTaskAssigned(updatedTask, user);
        await this.bot.sendMessage(msg.chat.id, `Task #${taskId} assigned to you.`);
      } else {
        await this.bot.sendMessage(msg.chat.id, 'Failed to assign task.');
      }
    });

    // /status_<task_id>_<status> - Change task status
    this.bot.onText(/\/status_(\d+)_(\w+)/, async (msg, match) => {
      const taskId = parseInt(match?.[1] || '0', 10);
      const status = match?.[2] as TaskStatus;

      const validStatuses: TaskStatus[] = ['todo', 'in_progress', 'review', 'done'];
      if (!validStatuses.includes(status)) {
        await this.bot.sendMessage(
          msg.chat.id,
          `Invalid status. Valid options: ${validStatuses.join(', ')}`
        );
        return;
      }

      const task = taskManager.getTaskById(taskId);
      if (!task) {
        await this.bot.sendMessage(msg.chat.id, 'Task not found.');
        return;
      }

      const updatedTask = taskManager.updateTask(taskId, { status });

      if (updatedTask) {
        await notificationService.notifyStatusChanged(updatedTask, status);
        await this.bot.sendMessage(
          msg.chat.id,
          `Task #${taskId} status changed to: ${status}`
        );
      } else {
        await this.bot.sendMessage(msg.chat.id, 'Failed to update task status.');
      }
    });

    // /team - List team members
    this.bot.onText(/\/team/, async msg => {
      const users = teamManager.getAllUsers();

      const message = users
        .map(u => {
          const roleEmoji = u.role === 'admin' ? ' crown' : u.role === 'manager' ? ' shield' : '';
          return `${u.username} - ${u.role}${roleEmoji}`;
        })
        .join('\n');

      await this.bot.sendMessage(msg.chat.id, `Team members:\n${message}`);
    });

    // /done_<task_id> - Quick mark as done
    this.bot.onText(/\/done_(\d+)/, async (msg, match) => {
      const taskId = parseInt(match?.[1] || '0', 10);

      const task = taskManager.getTaskById(taskId);
      if (!task) {
        await this.bot.sendMessage(msg.chat.id, 'Task not found.');
        return;
      }

      const updatedTask = taskManager.updateTask(taskId, { status: 'done' });

      if (updatedTask) {
        await notificationService.notifyStatusChanged(updatedTask, 'done');
        await this.bot.sendMessage(msg.chat.id, `Task #${taskId} marked as done!`);
      } else {
        await this.bot.sendMessage(msg.chat.id, 'Failed to update task.');
      }
    });

    // /checkin - Ask how everyone is doing
    this.bot.onText(/\/checkin/, async msg => {
      const chatId = msg.chat.id.toString();
      const username = msg.from?.username || `user_${msg.from?.id}`;

      const user = teamManager.getUserByTelegramId(chatId);
      if (!user) {
        await this.bot.sendMessage(msg.chat.id, 'Please use /start first to register.');
        return;
      }

      // Отправляем вопрос
      await this.bot.sendMessage(
        msg.chat.id,
        'Как у тебя дела? Расскажи о своём прогрессе по задачам или о том, что тебя беспокоит.'
      );

      // Ждём ответа (следующее сообщение от пользователя)
      const listener = async (response: any) => {
        if (response.chat.id.toString() === chatId && response.text && !response.text.startsWith('/')) {
          await this.bot.sendMessage(
            msg.chat.id,
            'Спасибо за ответ! Твой фидбек сохранён. 👍'
          );

          // Удаляем слушатель после получения ответа
          this.bot.removeListener('message', listener);
        }
      };

      // Добавляем слушатель на следующее сообщение
      this.bot.on('message', listener);
    });

    // Error handling
    this.bot.on('polling_error', error => {
      logger.error('Telegram polling error:', error);
    });
  }

  /**
   * Get status emoji
   */
  private getStatusEmoji(status: string): string {
    const emojis: Record<string, string> = {
      todo: 'pencil',
      in_progress: 'hourglass',
      review: 'eyes',
      done: 'white_check_mark',
    };
    return emojis[status] || 'pencil';
  }

  /**
   * Get priority emoji
   */
  private getPriorityEmoji(priority: string): string {
    const emojis: Record<string, string> = {
      low: 'green_circle',
      medium: 'yellow_circle',
      high: 'orange_circle',
      urgent: 'red_circle',
    };
    return emojis[priority] || 'white_circle';
  }
}

// ============================================
// Bot Initialization
// ============================================

let botHandler: TelegramBotHandler | null = null;

export function initTelegramBot(): TelegramBotHandler | null {
  const token = process.env.TELEGRAM_TOKEN;

  if (!token) {
    logger.warn('Telegram bot not configured. Set TELEGRAM_TOKEN.');
    return null;
  }

  botHandler = new TelegramBotHandler(token);
  notificationService.setTelegramBot(botHandler.getBot());
  
  return botHandler;
}

export function getTelegramBot(): TelegramBotHandler | null {
  return botHandler;
}