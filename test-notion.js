// Тест подключения к Notion
require('dotenv').config();
const { Client } = require('@notionhq/client');

const notion = new Client({
  auth: process.env.NOTION_TOKEN
});

const DATABASE_ID = process.env.NOTION_DATABASE_ID || 'faaff92a-bcab-486c-9fdf-c9f2666d3fa7';

async function testConnection() {
  try {
    // Тест 1: Получить информацию о базе данных
    console.log('Testing database connection...');
    const dbInfo = await notion.databases.retrieve({ database_id: DATABASE_ID });
    console.log('✅ Database found:', dbInfo.title[0]?.text?.content || 'Untitled');
    console.log('Properties:', Object.keys(dbInfo.properties));
    
    // Тест 2: Запросить записи
    console.log('\nTesting query...');
    const queryResult = await notion.databases.query({
      database_id: DATABASE_ID,
      page_size: 5
    });
    console.log(`✅ Query successful, found ${queryResult.results.length} pages`);
    
    // Тест 3: Создать тестовую страницу
    console.log('\nCreating test page...');
    const newPage = await notion.pages.create({
      parent: { database_id: DATABASE_ID },
      properties: {
        title: {
          title: [{ text: { content: 'Test from OpenClaw ' + new Date().toISOString() } }]
        }
      }
    });
    console.log('✅ Test page created:', newPage.id);
    
    // Тест 4: Удалить тестовую страницу
    console.log('\nArchiving test page...');
    await notion.pages.update({
      page_id: newPage.id,
      archived: true
    });
    console.log('✅ Test page archived');
    
    console.log('\n🎉 All tests passed! Notion integration is working.');
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.body) {
      console.error('Details:', JSON.stringify(error.body, null, 2));
    }
  }
}

testConnection();
