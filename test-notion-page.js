// Проверка страницы Notion
require('dotenv').config();
const { Client } = require('@notionhq/client');

const notion = new Client({
  auth: process.env.NOTION_TOKEN
});

const PAGE_ID = '30b12789e8f8809c919ceecbbbfe4dcc';

async function checkPage() {
  try {
    console.log('Checking page...\n');
    
    // Получаем информацию о странице
    const page = await notion.pages.retrieve({ page_id: PAGE_ID });
    console.log('Page title:', page.properties?.title?.title?.[0]?.text?.content || 'Untitled');
    console.log('Page ID:', page.id);
    console.log('Page URL:', page.url);
    
    // Получаем дочерние блоки (возможно там база данных)
    console.log('\nSearching for children (databases)...');
    const children = await notion.blocks.children.list({
      block_id: PAGE_ID,
      page_size: 100
    });
    
    console.log(`Found ${children.results.length} child blocks:\n`);
    
    const databases = children.results.filter(b => b.type === 'child_database');
    
    if (databases.length === 0) {
      console.log('❌ No child databases found on this page.');
      console.log('\nYou need to:');
      console.log('1. Add a database to this page in Notion');
      console.log('2. Or create a new database page');
      console.log('\nBlocks on page:', children.results.map(b => b.type).join(', '));
    } else {
      console.log(`✅ Found ${databases.length} database(s):`);
      databases.forEach((db, i) => {
        console.log(`\n${i + 1}. Database ID: ${db.id}`);
        console.log(`   Title: ${db.child_database?.title || 'Untitled'}`);
      });
      
      // Используем первую базу данных
      const dbId = databases[0].id;
      console.log(`\n📝 Using database ID: ${dbId}`);
      console.log('Update .env with: NOTION_DATABASE_ID=' + dbId);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.body) {
      console.error('Details:', JSON.stringify(error.body, null, 2));
    }
  }
}

checkPage();
