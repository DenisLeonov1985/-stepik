// ============================================
// OpenClaw - Типы данных
// ============================================

// Роли пользователей
export type UserRole = 'admin' | 'manager' | 'member';

// Статусы задач
export type TaskStatus = 'todo' | 'in_progress' | 'review' | 'done';

// Приоритеты задач
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

// Типы уведомлений
export type NotificationType = 'task_assigned' | 'deadline_reminder' | 'status_changed' | 'task_created';

// ============================================
// Пользователь
// ============================================
export interface User {
  id: number;
  username: string;
  discord_id: string | null;
  telegram_id: string | null;
  role: UserRole;
  created_at: string;
}

export interface CreateUserInput {
  username: string;
  discord_id?: string;
  telegram_id?: string;
  role?: UserRole;
}

// ============================================
// Задача
// ============================================
export interface Task {
  id: number;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  assignee_id: number | null;
  created_by: number;
  deadline: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  assignee?: User;
  creator?: User;
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  priority?: TaskPriority;
  assignee_id?: number;
  created_by: number;
  deadline?: string;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  assignee_id?: number;
  deadline?: string;
}

export interface TaskFilter {
  status?: TaskStatus;
  priority?: TaskPriority;
  assignee_id?: number;
  created_by?: number;
}

// ============================================
// Уведомление
// ============================================
export interface Notification {
  id: number;
  user_id: number;
  message: string;
  type: NotificationType;
  sent_at: string;
  is_read: boolean;
  // Joined fields
  user?: User;
}

export interface CreateNotificationInput {
  user_id: number;
  message: string;
  type: NotificationType;
}

// ============================================
// Конфигурация
// ============================================
export interface DiscordConfig {
  token: string;
  clientId: string;
  guildId?: string;
}

export interface TelegramConfig {
  token: string;
}

export interface DatabaseConfig {
  path: string;
}

export interface NotificationsConfig {
  deadlineReminders: boolean;
  reminderHours: number[];
}

export interface Config {
  discord: DiscordConfig;
  telegram: TelegramConfig;
  database: DatabaseConfig;
  notifications: NotificationsConfig;
}

// ============================================
// Ответы API
// ============================================
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  perPage: number;
}
