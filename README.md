# Telegram Todo List Bot

A simple todo list bot for Telegram running on Cloudflare Workers with automatic daily reminders.

## Features

- ✅ Add tasks with simple commands
- 📋 List all active tasks
- 📅 Set deadlines for tasks
- ✓ Mark tasks as done with one click
- ⏰ Automatic reminders at 12 AM, 6 AM, and 6 PM daily

## Commands

- `/start` - Show welcome message and command list
- `/add <task>` - Add a new task
  - Example: `/add Buy groceries`
- `/list` - Show all your tasks
- `/deadline <task_number> <date>` - Set deadline for a task
  - Example: `/deadline 1 2025-10-20`

## Deployment

### 1. Create Cloudflare Account
Go to [Cloudflare Dashboard](https://dash.cloudflare.com/) and sign up/login

### 2. Create KV Namespace
- Navigate to "Workers & Pages" > "KV"
- Click "Create namespace"
- Name: `TASKS`
- Copy the namespace ID

### 3. Create Worker
- Go to "Workers & Pages" > "Create application" > "Create Worker"
- Name: `todolist-bot`
- Click "Deploy"

### 4. Add Worker Code
- Click "Edit Code"
- Delete the default code
- Copy and paste the entire `worker.js` code
- Click "Save and Deploy"

### 5. Configure Environment Variables
- Go to "Settings" > "Variables"
- Add Environment Variable:
  - Name: `BOT_TOKEN`
  - Value: Your Telegram Bot Token (from [@BotFather](https://t.me/BotFather))

### 6. Bind KV Namespace
- Go to "Settings" > "Bindings"
- Click "Add binding"
  - Type: KV Namespace
  - Variable name: `TASKS`
  - KV namespace: Select `TASKS`
- Click "Save"

### 7. Set Up Cron Triggers
- Go to "Settings" > "Triggers" > "Cron Triggers"
- Add these 3 triggers:
  - `0 0 * * *` (12 AM UTC)
  - `0 6 * * *` (6 AM UTC)
  - `0 18 * * *` (6 PM UTC)

### 8. Deploy Changes
- Click "Save and Deploy"
- Copy your worker URL (e.g., `https://todolist-bot.YOUR-SUBDOMAIN.workers.dev`)

### 9. Set Telegram Webhook
Open this URL in your browser (replace with your values):
```
https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook?url=<YOUR_WORKER_URL>
```

## Usage

1. Open Telegram and search for your bot
2. Send `/start` to begin
3. Use `/add` to create tasks
4. Click ✅ Done button to complete tasks
5. Use `/deadline` to set due dates
6. Receive automatic reminders 3 times daily

## Tech Stack

- Cloudflare Workers (Serverless)
- Cloudflare KV (Storage)
- Telegram Bot API
- Cron Triggers (Scheduled reminders)

## License

MIT

