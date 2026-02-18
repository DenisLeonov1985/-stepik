// ============================================
// OpenClaw - Discord Bot
// ============================================

import {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  Partials,
} from 'discord.js';
import { taskManager } from '../../core/task-manager';
import { teamManager } from '../../core/team-manager';
import { notificationService } from '../../core/notification-service';
import { logger } from '../../core/logger';
import type { Task, User, TaskStatus, TaskPriority } from '../../types';

// ============================================
// Slash Commands Definition
// ============================================

const commands = [
  // /task create - Create a new task
  new SlashCommandBuilder()
    .setName('task')
    .setDescription('Manage tasks')
    .addSubcommand(sub =>
      sub
        .setName('create')
        .setDescription('Create a new task')
        .addStringOption(opt =>
          opt.setName('title').setDescription('Task title').setRequired(true)
        )
        .addStringOption(opt =>
          opt.setName('description').setDescription('Task description').setRequired(false)
        )
        .addStringOption(opt =>
          opt
            .setName('priority')
            .setDescription('Task priority')
            .setRequired(false)
            .addChoices(
              { name: 'Low', value: 'low' },
              { name: 'Medium', value: 'medium' },
              { name: 'High', value: 'high' },
              { name: 'Urgent', value: 'urgent' }
            )
        )
        .addUserOption(opt =>
          opt.setName('assignee').setDescription('Assign to user').setRequired(false)
        )
        .addStringOption(opt =>
          opt.setName('deadline').setDescription('Deadline (YYYY-MM-DD HH:MM)').setRequired(false)
        )
    )
    // /task list - List tasks
    .addSubcommand(sub =>
      sub
        .setName('list')
        .setDescription('List tasks')
        .addStringOption(opt =>
          opt
            .setName('status')
            .setDescription('Filter by status')
            .setRequired(false)
            .addChoices(
              { name: 'Todo', value: 'todo' },
              { name: 'In Progress', value: 'in_progress' },
              { name: 'Review', value: 'review' },
              { name: 'Done', value: 'done' }
            )
        )
    )
    // /task assign - Assign task to user
    .addSubcommand(sub =>
      sub
        .setName('assign')
        .setDescription('Assign task to user')
        .addIntegerOption(opt =>
          opt.setName('id').setDescription('Task ID').setRequired(true)
        )
        .addUserOption(opt =>
          opt.setName('user').setDescription('User to assign').setRequired(true)
        )
    )
    // /task status - Change task status
    .addSubcommand(sub =>
      sub
        .setName('status')
        .setDescription('Change task status')
        .addIntegerOption(opt =>
          opt.setName('id').setDescription('Task ID').setRequired(true)
        )
        .addStringOption(opt =>
          opt
            .setName('status')
            .setDescription('New status')
            .setRequired(true)
            .addChoices(
              { name: 'Todo', value: 'todo' },
              { name: 'In Progress', value: 'in_progress' },
              { name: 'Review', value: 'review' },
              { name: 'Done', value: 'done' }
            )
        )
    )
    // /task info - Get task details
    .addSubcommand(sub =>
      sub
        .setName('info')
        .setDescription('Get task details')
        .addIntegerOption(opt =>
          opt.setName('id').setDescription('Task ID').setRequired(true)
        )
    ),

  // /my - Show my tasks
  new SlashCommandBuilder()
    .setName('my')
    .setDescription('Show my assigned tasks'),

  // /team - Team management
  new SlashCommandBuilder()
    .setName('team')
    .setDescription('Team management')
    .addSubcommand(sub =>
      sub.setName('list').setDescription('List all team members')
    )
    .addSubcommand(sub =>
      sub
        .setName('role')
        .setDescription('Change user role')
        .addUserOption(opt =>
          opt.setName('user').setDescription('User').setRequired(true)
        )
        .addStringOption(opt =>
          opt
            .setName('role')
            .setDescription('New role')
            .setRequired(true)
            .addChoices(
              { name: 'Admin', value: 'admin' },
              { name: 'Manager', value: 'manager' },
              { name: 'Member', value: 'member' }
            )
        )
    ),
].map(cmd => cmd.toJSON());

// ============================================
// Discord Bot Class
// ============================================

export class DiscordBot {
  private client: Client;
  private rest: REST;
  private clientId: string;
  private guildId?: string;
  private token: string;

  constructor(token: string, clientId: string, guildId?: string) {
    this.token = token;
    this.clientId = clientId;
    this.guildId = guildId;

    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.DirectMessages,
      ],
      partials: [Partials.Channel],
    });

    this.rest = new REST({ version: '10' }).setToken(token);

    this.setupEventHandlers();
  }

  /**
   * Start the bot
   */
  async start(): Promise<void> {
    // Register commands
    try {
      if (this.guildId) {
        await this.rest.put(
          Routes.applicationGuildCommands(this.clientId, this.guildId),
          { body: commands }
        );
        logger.info('Discord slash commands registered for guild');
      } else {
        await this.rest.put(Routes.applicationCommands(this.clientId), { body: commands });
        logger.info('Discord slash commands registered globally');
      }
    } catch (error) {
      logger.error('Failed to register Discord commands:', error);
      throw error;
    }

    // Login
    await this.client.login(this.token);
    logger.info('Discord bot started');
  }

  /**
   * Get the client instance
   */
  getClient(): Client {
    return this.client;
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    this.client.once('ready', () => {
      logger.info(`Discord bot logged in as ${this.client.user?.tag}`);
    });

    this.client.on('interactionCreate', async interaction => {
      if (!interaction.isChatInputCommand()) return;

      try {
        await this.handleCommand(interaction);
      } catch (error) {
        logger.error('Error handling Discord command:', error);
        
        const errorMessage = 'An error occurred while processing your command.';
        
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({ content: errorMessage, ephemeral: true });
        } else {
          await interaction.reply({ content: errorMessage, ephemeral: true });
        }
      }
    });
  }

  /**
   * Handle slash commands
   */
  private async handleCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    const discordUser = interaction.user;
    const user = teamManager.getOrCreateByDiscord(discordUser.id, discordUser.username);

    switch (interaction.commandName) {
      case 'task':
        await this.handleTaskCommand(interaction, user);
        break;
      case 'my':
        await this.handleMyCommand(interaction, user);
        break;
      case 'team':
        await this.handleTeamCommand(interaction, user);
        break;
      default:
        await interaction.reply({ content: 'Unknown command', ephemeral: true });
    }
  }

  /**
   * Handle /task commands
   */
  private async handleTaskCommand(interaction: ChatInputCommandInteraction, user: User): Promise<void> {
    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case 'create':
        await this.handleTaskCreate(interaction, user);
        break;
      case 'list':
        await this.handleTaskList(interaction, user);
        break;
      case 'assign':
        await this.handleTaskAssign(interaction, user);
        break;
      case 'status':
        await this.handleTaskStatus(interaction, user);
        break;
      case 'info':
        await this.handleTaskInfo(interaction, user);
        break;
      default:
        await interaction.reply({ content: 'Unknown subcommand', ephemeral: true });
    }
  }

  /**
   * Handle /task create
   */
  private async handleTaskCreate(interaction: ChatInputCommandInteraction, user: User): Promise<void> {
    const title = interaction.options.getString('title', true);
    const description = interaction.options.getString('description');
    const priority = interaction.options.getString('priority') as TaskPriority | null;
    const assigneeUser = interaction.options.getUser('assignee');
    const deadline = interaction.options.getString('deadline');

    let assigneeId: number | undefined;
    if (assigneeUser) {
      const assignee = teamManager.getOrCreateByDiscord(assigneeUser.id, assigneeUser.username);
      assigneeId = assignee.id;
    }

    const task = taskManager.createTask({
      title,
      description: description || undefined,
      priority: priority || undefined,
      assignee_id: assigneeId,
      created_by: user.id,
      deadline: deadline || undefined,
    });

    // Send notification to assignee
    if (assigneeId && task.assignee) {
      await notificationService.notifyTaskAssigned(task, task.assignee);
    }

    const embed = this.createTaskEmbed(task);
    await interaction.reply({ embeds: [embed], ephemeral: false });
  }

  /**
   * Handle /task list
   */
  private async handleTaskList(interaction: ChatInputCommandInteraction, user: User): Promise<void> {
    const status = interaction.options.getString('status') as TaskStatus | null;

    const tasks = taskManager.getTasks(status ? { status } : undefined);

    if (tasks.length === 0) {
      await interaction.reply({ content: 'No tasks found.', ephemeral: true });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle('Tasks')
      .setColor(0x5865F2)
      .setDescription(
        tasks
          .slice(0, 10)
          .map(t => {
            const statusEmoji = this.getStatusEmoji(t.status);
            const priorityEmoji = this.getPriorityEmoji(t.priority);
            const assignee = t.assignee ? ` @${t.assignee.username}` : '';
            return `${statusEmoji} **#${t.id}** ${t.title}${assignee} ${priorityEmoji}`;
          })
          .join('\n')
      )
      .setFooter({ text: tasks.length > 10 ? `Showing 10 of ${tasks.length} tasks` : `${tasks.length} tasks` });

    await interaction.reply({ embeds: [embed], ephemeral: false });
  }

  /**
   * Handle /task assign
   */
  private async handleTaskAssign(interaction: ChatInputCommandInteraction, user: User): Promise<void> {
    const taskId = interaction.options.getInteger('id', true);
    const assigneeUser = interaction.options.getUser('user', true);

    const task = taskManager.getTaskById(taskId);
    if (!task) {
      await interaction.reply({ content: 'Task not found.', ephemeral: true });
      return;
    }

    const assignee = teamManager.getOrCreateByDiscord(assigneeUser.id, assigneeUser.username);
    const updatedTask = taskManager.updateTask(taskId, { assignee_id: assignee.id });

    if (updatedTask) {
      await notificationService.notifyTaskAssigned(updatedTask, assignee);
      const embed = this.createTaskEmbed(updatedTask);
      await interaction.reply({ embeds: [embed], content: 'Task assigned successfully!' });
    } else {
      await interaction.reply({ content: 'Failed to update task.', ephemeral: true });
    }
  }

  /**
   * Handle /task status
   */
  private async handleTaskStatus(interaction: ChatInputCommandInteraction, user: User): Promise<void> {
    const taskId = interaction.options.getInteger('id', true);
    const status = interaction.options.getString('status', true) as TaskStatus;

    const task = taskManager.getTaskById(taskId);
    if (!task) {
      await interaction.reply({ content: 'Task not found.', ephemeral: true });
      return;
    }

    const updatedTask = taskManager.updateTask(taskId, { status });

    if (updatedTask) {
      await notificationService.notifyStatusChanged(updatedTask, status);
      const embed = this.createTaskEmbed(updatedTask);
      await interaction.reply({ embeds: [embed], content: 'Status updated!' });
    } else {
      await interaction.reply({ content: 'Failed to update task.', ephemeral: true });
    }
  }

  /**
   * Handle /task info
   */
  private async handleTaskInfo(interaction: ChatInputCommandInteraction, user: User): Promise<void> {
    const taskId = interaction.options.getInteger('id', true);

    const task = taskManager.getTaskById(taskId);
    if (!task) {
      await interaction.reply({ content: 'Task not found.', ephemeral: true });
      return;
    }

    const embed = this.createTaskEmbed(task);
    await interaction.reply({ embeds: [embed], ephemeral: false });
  }

  /**
   * Handle /my command
   */
  private async handleMyCommand(interaction: ChatInputCommandInteraction, user: User): Promise<void> {
    const tasks = taskManager.getUserTasks(user.id);

    if (tasks.length === 0) {
      await interaction.reply({ content: 'You have no assigned tasks.', ephemeral: true });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle('My Tasks')
      .setColor(0x57F287)
      .setDescription(
        tasks
          .map(t => {
            const statusEmoji = this.getStatusEmoji(t.status);
            const priorityEmoji = this.getPriorityEmoji(t.priority);
            const deadline = t.deadline ? ` (due: ${t.deadline})` : '';
            return `${statusEmoji} **#${t.id}** ${t.title}${deadline} ${priorityEmoji}`;
          })
          .join('\n')
      );

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }

  /**
   * Handle /team commands
   */
  private async handleTeamCommand(interaction: ChatInputCommandInteraction, user: User): Promise<void> {
    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case 'list':
        await this.handleTeamList(interaction, user);
        break;
      case 'role':
        await this.handleTeamRole(interaction, user);
        break;
      default:
        await interaction.reply({ content: 'Unknown subcommand', ephemeral: true });
    }
  }

  /**
   * Handle /team list
   */
  private async handleTeamList(interaction: ChatInputCommandInteraction, user: User): Promise<void> {
    const users = teamManager.getAllUsers();

    const embed = new EmbedBuilder()
      .setTitle('Team Members')
      .setColor(0x5865F2)
      .setDescription(
        users
          .map(u => {
            const roleEmoji = u.role === 'admin' ? ' crown' : u.role === 'manager' ? ' shield' : '';
            return `**${u.username}** - ${u.role}${roleEmoji}`;
          })
          .join('\n')
      );

    await interaction.reply({ embeds: [embed], ephemeral: false });
  }

  /**
   * Handle /team role
   */
  private async handleTeamRole(interaction: ChatInputCommandInteraction, user: User): Promise<void> {
    // Check permissions
    if (!teamManager.hasPermission(user.id, 'manager')) {
      await interaction.reply({ content: 'You do not have permission to change roles.', ephemeral: true });
      return;
    }

    const targetUser = interaction.options.getUser('user', true);
    const role = interaction.options.getString('role', true) as 'admin' | 'manager' | 'member';

    const target = teamManager.getUserByDiscordId(targetUser.id);
    if (!target) {
      await interaction.reply({ content: 'User not found in team.', ephemeral: true });
      return;
    }

    const updated = teamManager.updateUserRole(target.id, role);
    await interaction.reply({ content: `Updated ${target.username}'s role to ${role}.`, ephemeral: false });
  }

  /**
   * Create task embed
   */
  private createTaskEmbed(task: Task): EmbedBuilder {
    const statusColors: Record<string, number> = {
      todo: 0x9B9B9B,
      in_progress: 0xFEE75C,
      review: 0xEB459E,
      done: 0x57F287,
    };

    const embed = new EmbedBuilder()
      .setTitle(`Task #${task.id}: ${task.title}`)
      .setColor(statusColors[task.status] || 0x5865F2)
      .addFields(
        { name: 'Status', value: task.status, inline: true },
        { name: 'Priority', value: task.priority, inline: true },
        { name: 'Created by', value: task.creator?.username || 'Unknown', inline: true }
      );

    if (task.description) {
      embed.addFields({ name: 'Description', value: task.description, inline: false });
    }

    if (task.assignee) {
      embed.addFields({ name: 'Assignee', value: task.assignee.username, inline: true });
    }

    if (task.deadline) {
      embed.addFields({ name: 'Deadline', value: task.deadline, inline: true });
    }

    embed.setFooter({ text: `Created: ${task.created_at}` });

    return embed;
  }

  /**
   * Get status emoji
   */
  private getStatusEmoji(status: string): string {
    const emojis: Record<string, string> = {
      todo: ' white_check_mark',
      in_progress: ' hourglass',
      review: ' eyes',
      done: ' white_check_mark',
    };
    return emojis[status] || 'pencil';
  }

  /**
   * Get priority emoji
   */
  private getPriorityEmoji(priority: string): string {
    const emojis: Record<string, string> = {
      low: ' green_circle',
      medium: ' yellow_circle',
      high: ' orange_circle',
      urgent: ' red_circle',
    };
    return emojis[priority] || ' white_circle';
  }
}

// ============================================
// Bot Initialization
// ============================================

let bot: DiscordBot | null = null;

export function initDiscordBot(): DiscordBot | null {
  const token = process.env.DISCORD_TOKEN;
  const clientId = process.env.DISCORD_CLIENT_ID;
  const guildId = process.env.DISCORD_GUILD_ID;

  if (!token || !clientId) {
    logger.warn('Discord bot not configured. Set DISCORD_TOKEN and DISCORD_CLIENT_ID.');
    return null;
  }

  bot = new DiscordBot(token, clientId, guildId);
  notificationService.setDiscordBot(bot.getClient());
  
  return bot;
}

export function getDiscordBot(): DiscordBot | null {
  return bot;
}