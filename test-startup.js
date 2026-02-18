// Тест запуска
console.log('Starting test...');

try {
  console.log('Loading dotenv...');
  require('dotenv').config();
  console.log('DISCORD_TOKEN:', process.env.DISCORD_TOKEN ? 'set' : 'empty');
  console.log('TELEGRAM_TOKEN:', process.env.TELEGRAM_TOKEN ? 'set' : 'empty');
  
  console.log('Loading logger...');
  const { logger } = require('./src/core/logger');
  logger.info('Logger loaded');
  
  console.log('Loading database...');
  const { initDatabase } = require('./src/db');
  initDatabase();
  console.log('Database initialized');
  
  console.log('All tests passed!');
} catch (error) {
  console.error('Error:', error.message);
  console.error('Stack:', error.stack);
}
