#!/usr/bin/env node
// ============================================
// Мониторинг Notion на новые документы
// ============================================

require('dotenv').config();

const { Client } = require('@notionhq/client');
const { Client: DiscordClient, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const STATE_FILE = './data/notion-monitor-state.json';

const notion = new Client({
  auth: process.env.NOTION_TOKEN || ''
});

const DATABASE_ID = process.env.NOTION_DATABASE_ID || '';
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const CHANNEL_ID = process.env.DISCORD_NOTIFICATION_CHANNEL_ID;

/**
 * Загрузить состояние (предыдущие документы)
 */
function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
    }
  } catch (error) {
    console.error('Failed to load state:', error.message);
  }
  return { documents: {}, lastCheck: null };
}

/**
 * Сохранить состояние
 */
function saveState(state) {
  try {
    const dir = path.dirname(STATE_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  } catch (error) {
    console.error('Failed to save state:', error.message);
  }
}

/**
 * Получить все документы из базы Notion
 */
async function getNotionDocuments() {
  try {
    const response = await notion.databases.query({
      database_id: DATABASE_ID,
      sorts: [{ timestamp: 'created_time', direction: 'descending' }]
    });

    const documents = {};
    for (const page of response.results) {
      const title = page.properties?.title?.title?.[0]?.text?.content || 
                    page.properties?.Name?.title?.[0]?.text?.content || 
                    'Untitled';
      documents[page.id] = {
        id: page.id,
        title: title,
        created: page.created_time,
        url: page.url
      };
    }

    return documents;
  } catch (error) {
    console.error('❌ Failed to fetch Notion documents:', error.message);
    throw error;
  }
}

/**
 * Отправить уведомление в Discord
 */
async function sendDiscordNotification(documents) {
  if (!DISCORD_TOKEN || !CHANNEL_ID) {
    console.error('❌ Discord not configured');
    return;
  }

  const client = new DiscordClient({
    intents: [GatewayIntentBits.Guilds]
  });

  try {
    await client.login(DISCORD_TOKEN);
    console.log('✅ Discord connected');

    const channel = await client.channels.fetch(CHANNEL_ID);
    if (!channel) {
      console.error('❌ Channel not found');
      return;
    }

    for (const doc of documents) {
      const embed = new EmbedBuilder()
        .setTitle('🆕 Новый документ в Notion')
        .setColor(0x00D26A)
        .addFields(
          { name: 'Название', value: doc.title, inline: false },
          { name: 'Ссылка', value: `[Открыть в Notion](${doc.url})`, inline: false }
        )
        .setTimestamp(new Date(doc.created));

      await channel.send({
        content: '@everyone Новый документ!',
        embeds: [embed]
      });

      console.log(`✅ Notified about: ${doc.title}`);
    }

    await client.destroy();
  } catch (error) {
    console.error('❌ Discord error:', error.message);
    await client.destroy();
  }
}

/**
 * Основная функция мониторинга
 */
async function monitorNotion() {
  console.log(`🔍 Checking Notion at ${new Date().toISOString()}...`);

  const state = loadState();
  const currentDocs = await getNotionDocuments();

  // Находим новые документы
  const newDocuments = [];
  for (const [id, doc] of Object.entries(currentDocs)) {
    if (!state.documents[id]) {
      newDocuments.push(doc);
      console.log(`🆕 New document found: ${doc.title}`);
    }
  }

  // Отправляем уведомления
  if (newDocuments.length > 0) {
    console.log(`📢 Sending ${newDocuments.length} notifications...`);
    await sendDiscordNotification(newDocuments);
  } else {
    console.log('✅ No new documents');
  }

  // Сохраняем состояние
  state.documents = currentDocs;
  state.lastCheck = new Date().toISOString();
  saveState(state);

  console.log('✅ Check completed\n');
}

// Запуск
monitorNotion().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
