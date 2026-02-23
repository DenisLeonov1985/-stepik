#!/usr/bin/env node
// ============================================
// Отправка уведомления в Discord о документе в Notion
// ============================================

require('dotenv').config();

const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const CHANNEL_ID = process.env.DISCORD_NOTIFICATION_CHANNEL_ID || ''; // ID канала для уведомлений

/**
 * Отправить уведомление о документе в Discord
 */
async function notifyDocumentCreated(title, notionUrl, description = '') {
  if (!DISCORD_TOKEN) {
    console.error('❌ DISCORD_TOKEN not set');
    process.exit(1);
  }

  const client = new Client({
    intents: [GatewayIntentBits.Guilds]
  });

  try {
    await client.login(DISCORD_TOKEN);
    console.log('✅ Discord bot connected');

    // Ищем канал
    let channel = null;
    
    if (CHANNEL_ID) {
      channel = await client.channels.fetch(CHANNEL_ID).catch(() => null);
    }
    
    // Если канал не найден по ID, берём первый текстовый канал на первом сервере
    if (!channel) {
      const guild = client.guilds.cache.first();
      if (guild) {
        channel = guild.channels.cache.find(ch => ch.type === 0); // 0 = GUILD_TEXT
      }
    }

    if (!channel) {
      console.error('❌ No text channel found');
      await client.destroy();
      process.exit(1);
    }

    // Создаём embed
    const embed = new EmbedBuilder()
      .setTitle('📄 Новый документ в Notion')
      .setColor(0x5865F2)
      .addFields(
        { name: 'Название', value: title, inline: false },
        { name: 'Ссылка', value: `[Открыть в Notion](${notionUrl})`, inline: false }
      )
      .setTimestamp();

    if (description) {
      embed.setDescription(description);
    }

    // Отправляем сообщение
    await channel.send({
      content: '@everyone Новый документ доступен!',
      embeds: [embed]
    });

    console.log(`✅ Notification sent to #${channel.name}`);
    await client.destroy();
    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error.message);
    await client.destroy();
    process.exit(1);
  }
}

// Запуск
const title = process.argv[2];
const notionUrl = process.argv[3];
const description = process.argv[4] || '';

if (!title || !notionUrl) {
  console.log('Usage: node notify-discord.js <title> <notion-url> [description]');
  console.log('Example: node notify-discord.js "Описание курса" "https://notion.so/..." "Документ импортирован"');
  process.exit(1);
}

notifyDocumentCreated(title, notionUrl, description);
