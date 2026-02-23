// Поиск доступных баз данных
require('dotenv').config();
const { Client } = require('@notionhq/client');

const notion = new Client({
  auth: process.env.NOTION_TOKEN
});

async function searchDatabases() {
  try {
    console.log('Searching for databases shared with integration...\n');
    
    const response = await notion.search({
      query: '',
      page_size: 20
    });
    
    if (response.results.length === 0) {
      console.log('❌ No databases found. Make sure to share databases with your integration.');
      return;
    }
    
    console.log(`✅ Found ${response.results.length} database(s):\n`);
    
    response.results.forEach((db, i) => {
      const title = db.title?.[0]?.text?.content || 'Untitled';
      console.log(`${i + 1}. "${title}"`);
      console.log(`   ID: ${db.id}`);
      console.log(`   URL: ${db.url}`);
      console.log('');
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

searchDatabases();
