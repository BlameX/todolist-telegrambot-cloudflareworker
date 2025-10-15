# Telegram Todo List Bot

A feature-rich todo list and reminder bot for Telegram running on Cloudflare Workers with automatic alerts and reminders.

## Features

### Todo List
- ✅ Add tasks with simple commands
- 📋 List all active tasks with deadlines
- 📅 Set deadlines for tasks
- ✓ Mark tasks as done with one click
- ⏰ Automatic task alerts at 12 AM, 6 AM, 12 PM, and 6 PM daily (Tehran time)

### Custom Reminders
- 🔔 Create custom reminders for any event
- 📅 Interactive calendar picker for date selection
- ⏰ Manual time entry in HH:MM format (Tehran timezone)
- 🎯 Multi-stage alerts: 24h, 12h, 6h, 2h, 1h, 30min, 15min, 5min, 1min before event
- 📊 View all active reminders with countdown
- 🗑️ Auto-delete overdue reminders

## Commands

### Tasks
- `/start` - Show welcome message and command list
- `/add` - Add a new task (interactive mode)
  - Or: `/add <task>` - Quick add
  - Example: `/add Buy groceries`
- `/list` - Show all your tasks with deadlines
- `/deadline <task_number> <date>` - Set deadline for a task
  - Example: `/deadline 1 2025-10-20`
  - Shows days/hours remaining

### Reminders
- `/reminder` - View all active reminders with countdown
- `/setreminder` - Create new custom reminder
  - Interactive: Enter text → Pick date → Enter time
  - Supports 24-hour format (12:30, 22:00, 00:00)
  - All times in Tehran timezone (UTC+3:30)

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
- Add these triggers:
  - `* * * * *` (Every minute - for custom reminders)
  - `30 20 * * *` (12 AM Tehran - 8:30 PM UTC - daily task list)
  - `30 2 * * *` (6 AM Tehran - 2:30 AM UTC - daily task list)
  - `30 8 * * *` (12 PM Tehran - 8:30 AM UTC - daily task list)
  - `30 14 * * *` (6 PM Tehran - 2:30 PM UTC - daily task list)

### 8. Deploy Changes
- Click "Save and Deploy"
- Copy your worker URL (e.g., `https://todolist-bot.YOUR-SUBDOMAIN.workers.dev`)

### 9. Set Telegram Webhook
Open this URL in your browser (replace with your values):
```
https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook?url=<YOUR_WORKER_URL>
```

## Usage

### Task Management
1. Send `/start` to begin
2. Use `/add` or `/add <task name>` to create tasks
3. Click ✅ Done button under tasks to complete them
4. Use `/deadline <number> <date>` to set due dates
5. Receive automatic task alerts at 12 AM, 6 AM, 12 PM, 6 PM daily

### Custom Reminders
1. Send `/setreminder`
2. Type your reminder text (e.g., "Football match")
3. Select date from interactive calendar
4. Enter time in HH:MM format (e.g., 14:30, 22:00)
5. Receive alerts at: 24h, 12h, 6h, 2h, 1h, 30min, 15min, 5min, 1min before event
6. Use `/reminder` to view all active reminders

### Time Format
- All times in Tehran timezone (UTC+3:30)
- Use 24-hour format: 00:00 (midnight), 12:00 (noon), 14:30 (2:30 PM), 22:00 (10 PM)

## Tech Stack

- Cloudflare Workers (Serverless)
- Cloudflare KV (Storage)
- Telegram Bot API
- Cron Triggers (Scheduled reminders)

## License

MIT




