# Деплой OpenClaw на VPS (hoster.by)

## Требования к серверу
- **OS:** Ubuntu 22.04 LTS (рекомендуется)
- **RAM:** 1GB+ (для Node.js + боты)
- **Диск:** 10GB+ (зависит от размера проекта)

---

## Шаг 1: Подготовка сервера

Подключись к серверу по SSH:
```bash
ssh root@Y178.172.173.91
```

Обнови систему:
```bash
apt update && apt upgrade -y 
```

Установи необходимые пакеты:
```bash
apt install -y curl git nginx build-essential sqlite3
```

---

## Шаг 2: Установка Node.js

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Проверка
node --version  # v20.x.x
npm --version   # 10.x.x
```

---

## Шаг 3: Создание пользователя для проекта

```bash
useradd -m -s /bin/bash openclaw
usermod -aG sudo openclaw
su - openclaw
```

---

## Шаг 4: Клонирование проекта

```bash
cd ~
git clone https://github.com/DenisLeonov1985/-stepik.git openclaw
# Или загрузи проект через SCP/FTP
```

---

## Шаг 5: Установка зависимостей

```bash
cd ~/openclaw
npm install
npm run build
```

---

## Шаг 6: Настройка окружения

```bash
cp .env.example .env
nano .env
```

Заполни все переменные:
```env
# Discord
DISCORD_TOKEN=your_discord_token
DISCORD_CLIENT_ID=your_client_id
DISCORD_GUILD_ID=your_guild_id

# Telegram
TELEGRAM_TOKEN=your_telegram_token

# Notion (опционально)
NOTION_TOKEN=your_notion_token
NOTION_DATABASE_ID=your_database_id

# Airtable (опционально)
AIRTABLE_API_KEY=your_key
AIRTABLE_BASE_ID=your_base_id

# Database
DATABASE_PATH=./data/openclaw.db

# Environment
NODE_ENV=production
LOG_LEVEL=info
```

---

## Шаг 7: Создание systemd сервиса

Создай файл сервиса:
```bash
sudo nano /etc/systemd/system/openclaw.service
```

Вставь содержимое:
```ini
[Unit]
Description=OpenClaw Bot System
After=network.target

[Service]
Type=simple
User=openclaw
WorkingDirectory=/home/openclaw/openclaw
ExecStart=/usr/bin/node dist/index.js
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

Активируй сервис:
```bash
sudo systemctl daemon-reload
sudo systemctl enable openclaw
sudo systemctl start openclaw
```

Проверь статус:
```bash
sudo systemctl status openclaw
sudo journalctl -u openclaw -f  # логи в реальном времени
```

---

## Шаг 8: Альтернатива — PM2 (рекомендуется для Node.js)

Установи PM2 глобально:
```bash
sudo npm install -g pm2
```

Запусти приложение:
```bash
cd ~/openclaw
pm2 start dist/index.js --name "openclaw"
```

Настрой автозапуск:
```bash
pm2 startup systemd
# Скопируй команду из вывода и выполни её
pm2 save
```

Управление:
```bash
pm2 status
pm2 logs openclaw
pm2 restart openclaw
pm2 stop openclaw
```

---

## Шаг 9: Настройка файрвола

```bash
sudo ufw allow ssh
sudo ufw allow 22/tcp
# Дополнительные порты если нужны
sudo ufw enable
```

---

## Шаг 10: Бэкап данных

Настрой cron для регулярного бэкапа:
```bash
crontab -e
```

Добавь строку:
```
0 3 * * * cp /home/openclaw/openclaw/data/openclaw.db /home/openclaw/backups/openclaw-$(date +\%Y\%m\%d).db
```

Создай папку для бэкапов:
```bash
mkdir -p ~/backups
```

---

## Шаг 11: Обновление проекта

```bash
cd ~/openclaw
git pull
npm install
npm run build

# Перезапуск
sudo systemctl restart openclaw
# или
pm2 restart openclaw
```

---

## Полезные команды

### Проверка логов
```bash
# systemd
sudo journalctl -u openclaw -n 50

# PM2
pm2 logs openclaw --lines 50
```

### Мониторинг ресурсов
```bash
htop
free -h
df -h
```

### Проверка открытых портов
```bash
netstat -tulpn
```

---

## Рекомендации по безопасности

1. **Измени стандартный SSH порт** (опционально)
2. **Настрой SSH ключ вместо пароля**
3. **Регулярно обновляй систему:** `apt update && apt upgrade`
4. **Используй сложные пароли для токенов**
5. **Ограничь доступ к .env файлу:** `chmod 600 .env`

---

## Устранение проблем

### Ошибка "Permission denied"
```bash
sudo chown -R openclaw:openclaw /home/openclaw/openclaw
```

### Ошибка "Cannot find module"
```bash
rm -rf node_modules
npm install
npm run build
```

### Бот не отвечает
```bash
# Проверь токены в .env
# Проверь логи
pm2 logs openclaw
# Проверь подключение к API
curl -I https://discord.com/api/v10
```

---

## Связь с проектом

После деплоя боты будут доступны:
- **Discord:** через команды `/task`, `/my`, `/team`
- **Telegram:** через команды `/tasks`, `/my`, `/assign`

Данные хранятся в SQLite базе: `/home/openclaw/openclaw/data/openclaw.db`
