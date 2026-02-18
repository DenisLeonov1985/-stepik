// ============================================
// OpenClaw - Main Entry Point
// ============================================

import * as dotenv from 'dotenv';
import * as path from 'path';
import { initDatabase, closeDatabase } from './db';
import { logger } from './core/logger';
import { initDiscordBot } from './bots/discord';
import { initTelegramBot } from './bots/telegram';
import { notificationService } from './core/notification-service';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env'), override: true });

console.log('[DEBUG] ENV loaded:', {
  DISCORD_TOKEN: process.env.DISCORD_TOKEN ? 'set' : 'empty',
  TELEGRAM_TOKEN: process.env.TELEGRAM_TOKEN ? 'set' : 'empty',
  DISCORD_CLIENT_ID: process.env.DISCORD_CLIENT_ID || 'empty',
});

console.log('[DEBUG] Loading logger...');
// Graceful shutdown handler
function setupGracefulShutdown(): void {
  const shutdown = (signal: string) => {
    logger.info(`Received ${signal}, shutting down...`);
    closeDatabase();
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

// Main function
async function main(): Promise<void> {
  console.log('[DEBUG] main() started');
  logger.info('Starting OpenClaw...');
  console.log('[DEBUG] logger.info called');

  // Initialize database
  console.log('[DEBUG] Calling initDatabase()');
  initDatabase();
  console.log('[DEBUG] Database initialized');
  logger.info('Database initialized');

  // Initialize Discord bot
  const discordBot = initDiscordBot();
  if (discordBot) {
    await discordBot.start();
  }

  // Initialize Telegram bot
  const telegramBot = initTelegramBot();
  if (telegramBot) {
    telegramBot.start();
  }

  // Setup graceful shutdown
  setupGracefulShutdown();

  logger.info('OpenClaw is ready!');
}

// Run main function
main().catch(error => {
  logger.error('Failed to start OpenClaw:', error);
  process.exit(1);
});