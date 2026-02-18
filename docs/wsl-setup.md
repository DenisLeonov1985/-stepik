# OpenClaw - Установка и запуск на WSL

## Предварительные требования

- Windows 10/11 с WSL2
- Ubuntu 22.04 или другая Linux-дистрибуция в WSL
- Node.js 18+ 
- npm или yarn

## Шаг 1: Установка Node.js в WSL

```bash
# Обновляем пакеты
sudo apt update && sudo apt upgrade -y

# Устанавливаем Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Проверяем версии
node --version
npm --version

# Устанавливаем build-essential для компиляции native модулей
sudo apt install -y build-essential python3
```

## Шаг 2: Клонирование проекта

```bash
# Создаём директорию для проектов
mkdir -p ~/projects
cd ~/projects

# Если проект на Windows диске, монтируем:
# cd /mnt/c/OpenClaw

# Или клонируем из репозитория:
# git clone <repository-url> openclaw
# cd openclaw
```

## Шаг 3: Установка зависимостей

```bash
# Устанавливаем зависимости
npm install

# Если есть проблемы с better-sqlite3:
npm rebuild better-sqlite3
```

## Шаг 4: Конфигурация

```bash
# Копируем пример конфигурации
cp .env.example .env

# Редактируем конфигурацию
nano .env
```

Заполните следующие переменные:
- `DISCORD_TOKEN` - токен Discord бота
- `DISCORD_CLIENT_ID` - ID Discord приложения
- `DISCORD_GUILD_ID` - ID сервера Discord (опционально)
- `TELEGRAM_TOKEN` - токен Telegram бота

## Шаг 5: Компиляция и запуск

```bash
# Компиляция TypeScript
npm run build

# Запуск в режиме разработки
npm run dev

# Или запуск скомпилированной версии
npm start
```

## Шаг 6: Настройка PM2 для автозапуска

```bash
# Установка PM2
sudo npm install -g pm2

# Запуск через PM2
pm2 start dist/index.js --name openclaw

# Сохранение конфигурации PM2
pm2 save

# Настройка автозапуска при старте системы
pm2 startup
```

## Создание Discord бота

1. Перейдите на https://discord.com/developers/applications
2. Создайте новое приложение
3. Перейдите в раздел "Bot" и создайте бота
4. Скопируйте токен в `DISCORD_TOKEN`
5. В разделе "OAuth2" скопируйте "Application ID" в `DISCORD_CLIENT_ID`
6. В разделе "OAuth2 > URL Generator":
   - Выберите scopes: `bot`, `applications.commands`
   - Выберите permissions: `Send Messages`, `Use Slash Commands`
   - Скопируйте ссылку и пригласите бота на сервер

## Создание Telegram бота

1. Откройте @BotFather в Telegram
2. Отправьте `/newbot`
3. Следуйте инструкциям
4. Скопируйте полученный токен в `TELEGRAM_TOKEN`

## Структура проекта

```
openclaw/
├── src/
│   ├── core/           # Ядро системы
│   ├── bots/           # Discord и Telegram боты
│   ├── db/             # База данных
│   └── types/          # TypeScript типы
├── dist/               # Скомпилированный код
├── data/               # База данных SQLite
├── logs/               # Логи
├── plans/              # Документация
└── docs/               # Инструкции
```

## Полезные команды

```bash
# Просмотр логов
pm2 logs openclaw

# Перезапуск
pm2 restart openclaw

# Остановка
pm2 stop openclaw

# Мониторинг
pm2 monit
```

## Устранение неполадок

### Проблема: better-sqlite3 не компилируется

```bash
sudo apt install -y build-essential python3
npm rebuild better-sqlite3
```

### Проблема: EACCES permission denied

```bash
# Исправление прав npm
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc
```

### Проблема: Бот не подключается к Discord

1. Проверьте правильность токена
2. Убедитесь, что бот приглашён на сервер
3. Проверьте права бота на сервере
