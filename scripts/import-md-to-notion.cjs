#!/usr/bin/env node
// ============================================
// Импорт Markdown в Notion (CommonJS)
// ============================================

require('dotenv').config();

const { Client } = require('@notionhq/client');
const fs = require('fs');
const path = require('path');

// Инициализация Notion клиента
const notion = new Client({
  auth: process.env.NOTION_TOKEN || ''
});

const DATABASE_ID = process.env.NOTION_DATABASE_ID || '';

/**
 * Парсить markdown на блоки Notion
 */
function parseMarkdownToBlocks(content) {
  const lines = content.split('\n');
  const blocks = [];
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    if (!trimmed) {
      continue;
    }
    
    // Разделитель (---)
    if (trimmed === '---') {
      blocks.push({
        object: 'block',
        type: 'divider',
        divider: {}
      });
    }
    // Заголовок 1 (#)
    else if (trimmed.startsWith('# ')) {
      blocks.push({
        object: 'block',
        type: 'heading_1',
        heading_1: {
          rich_text: [{ type: 'text', text: { content: trimmed.substring(2) } }]
        }
      });
    }
    // Заголовок 2 (##)
    else if (trimmed.startsWith('## ')) {
      blocks.push({
        object: 'block',
        type: 'heading_2',
        heading_2: {
          rich_text: [{ type: 'text', text: { content: trimmed.substring(3) } }]
        }
      });
    }
    // Заголовок 3 (###)
    else if (trimmed.startsWith('### ')) {
      blocks.push({
        object: 'block',
        type: 'heading_3',
        heading_3: {
          rich_text: [{ type: 'text', text: { content: trimmed.substring(4) } }]
        }
      });
    }
    // Список с checkbox
    else if (trimmed.startsWith('✅') || trimmed.startsWith('✓')) {
      blocks.push({
        object: 'block',
        type: 'to_do',
        to_do: {
          rich_text: [{ type: 'text', text: { content: trimmed.substring(1).trim() } }],
          checked: true
        }
      });
    }
    // Список (- или *)
    else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      blocks.push({
        object: 'block',
        type: 'bulleted_list_item',
        bulleted_list_item: {
          rich_text: [{ type: 'text', text: { content: trimmed.substring(2) } }]
        }
      });
    }
    // Нумерованный список
    else if (/^\d+\.\s/.test(trimmed)) {
      const text = trimmed.replace(/^\d+\.\s/, '');
      blocks.push({
        object: 'block',
        type: 'numbered_list_item',
        numbered_list_item: {
          rich_text: [{ type: 'text', text: { content: text } }]
        }
      });
    }
    // Цитата (>)
    else if (trimmed.startsWith('> ')) {
      blocks.push({
        object: 'block',
        type: 'quote',
        quote: {
          rich_text: [{ type: 'text', text: { content: trimmed.substring(2) } }]
        }
      });
    }
    // Обычный параграф
    else {
      blocks.push({
        object: 'block',
        type: 'paragraph',
        paragraph: {
          rich_text: [{ type: 'text', text: { content: trimmed } }]
        }
      });
    }
  }
  
  return blocks;
}

/**
 * Импортировать markdown файл в Notion
 */
async function importMarkdownToNotion(filePath, title) {
  try {
    if (!fs.existsSync(filePath)) {
      console.error(`❌ File not found: ${filePath}`);
      process.exit(1);
    }
    
    const content = fs.readFileSync(filePath, 'utf-8');
    const fileName = path.basename(filePath, '.md');
    const pageTitle = title || fileName;
    
    console.log(`📖 Reading: ${filePath}`);
    console.log(`📝 Title: ${pageTitle}`);
    
    const blocks = parseMarkdownToBlocks(content);
    const MAX_BLOCKS = 100;
    const firstBlocks = blocks.slice(0, MAX_BLOCKS);
    const remainingBlocks = blocks.slice(MAX_BLOCKS);
    
    console.log(`🔄 Total blocks: ${blocks.length}`);
    
    const response = await notion.pages.create({
      parent: { database_id: DATABASE_ID },
      properties: {
        title: {
          title: [{ text: { content: pageTitle } }]
        }
      },
      children: firstBlocks
    });
    
    console.log(`✅ Page created: ${response.id}`);
    
    if (remainingBlocks.length > 0) {
      console.log(`➕ Adding ${remainingBlocks.length} more blocks...`);
      for (let i = 0; i < remainingBlocks.length; i += MAX_BLOCKS) {
        const chunk = remainingBlocks.slice(i, i + MAX_BLOCKS);
        await notion.blocks.children.append({
          block_id: response.id,
          children: chunk
        });
      }
    }
    
    console.log(`🎉 Successfully imported ${blocks.length} blocks!`);
    console.log(`🔗 https://www.notion.so/${response.id.replace(/-/g, '')}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.body) {
      console.error('Details:', JSON.stringify(error.body, null, 2));
    }
    process.exit(1);
  }
}

// Запуск
const filePath = process.argv[2];
const title = process.argv[3];

if (!filePath) {
  console.log('Usage: node import-md-to-notion.js <path-to-md-file> [title]');
  console.log('Example: node scripts/import-md-to-notion.js "course/Исходники/Шаблон.md" "Описание курса"');
  process.exit(1);
}

importMarkdownToNotion(path.resolve(filePath), title);
