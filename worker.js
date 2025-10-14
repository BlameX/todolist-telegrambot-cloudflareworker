export default {
  async fetch(request, env) {
    if (request.method === 'POST') {
      const update = await request.json();
      await handleUpdate(update, env);
      return new Response('OK');
    }
    return new Response('Bot is running');
  },
  
  async scheduled(event, env, ctx) {
    await sendScheduledReminders(env);
  }
};

async function handleUpdate(update, env) {
  if (update.message) {
    await handleMessage(update.message, env);
  } else if (update.callback_query) {
    await handleCallbackQuery(update.callback_query, env);
  }
}

async function handleMessage(message, env) {
  const chatId = message.chat.id;
  const text = message.text || '';
  
  await registerUser(chatId, env);

  if (text.startsWith('/add ')) {
    const task = text.substring(5).trim();
    if (task) {
      await addTask(chatId, task, env);
      await sendMessage(chatId, `✅ Task added: ${task}`, env);
    } else {
      await sendMessage(chatId, 'Usage: /add <task description>', env);
    }
  } else if (text === '/list') {
    await listTasks(chatId, env);
  } else if (text.startsWith('/deadline ')) {
    const parts = text.substring(10).trim().split(' ');
    if (parts.length >= 2) {
      const taskId = parseInt(parts[0]);
      const deadline = parts.slice(1).join(' ');
      await setDeadline(chatId, taskId, deadline, env);
    } else {
      await sendMessage(chatId, 'Usage: /deadline <task_number> <date>', env);
    }
  } else if (text === '/start') {
    await sendMessage(chatId, 
      'Welcome to Todo List Bot!\n\n' +
      '📝 Commands:\n\n' +
      '1️⃣ /add - Add a new task\n' +
      'Example: /add Buy groceries\n\n' +
      '2️⃣ /list - Show all your tasks\n' +
      'Example: /list\n\n' +
      '3️⃣ /deadline - Set deadline for a task\n' +
      'Example: /deadline 1 2025-10-20\n' +
      '(Sets deadline for task #1)\n\n' +
      '✅ Click the Done button under any task to complete it\n\n' +
      '⏰ You will receive reminders at 12 AM, 6 AM, and 6 PM daily', env);
  }
}

async function handleCallbackQuery(callbackQuery, env) {
  const chatId = callbackQuery.message.chat.id;
  const messageId = callbackQuery.message.message_id;
  const data = callbackQuery.data;

  if (data.startsWith('done_')) {
    const taskId = parseInt(data.substring(5));
    await removeTask(chatId, taskId, env);
    await answerCallbackQuery(callbackQuery.id, 'Task completed!', env);
    await deleteMessage(chatId, messageId, env);
    await listTasks(chatId, env);
  }
}

async function addTask(chatId, taskText, env) {
  const tasks = await getTasks(chatId, env);
  const newTask = {
    id: Date.now(),
    text: taskText,
    deadline: null,
    created: new Date().toISOString()
  };
  tasks.push(newTask);
  await saveTasks(chatId, tasks, env);
}

async function removeTask(chatId, taskId, env) {
  const tasks = await getTasks(chatId, env);
  const filtered = tasks.filter(t => t.id !== taskId);
  await saveTasks(chatId, filtered, env);
}

async function setDeadline(chatId, taskNumber, deadline, env) {
  const tasks = await getTasks(chatId, env);
  if (taskNumber > 0 && taskNumber <= tasks.length) {
    tasks[taskNumber - 1].deadline = deadline;
    await saveTasks(chatId, tasks, env);
    await sendMessage(chatId, `✅ Deadline set for task ${taskNumber}: ${deadline}`, env);
    await listTasks(chatId, env);
  } else {
    await sendMessage(chatId, `❌ Invalid task number. Use /list to see task numbers.`, env);
  }
}

async function listTasks(chatId, env) {
  const tasks = await getTasks(chatId, env);
  
  if (tasks.length === 0) {
    await sendMessage(chatId, 'No tasks yet. Use /add to create one!', env);
    return;
  }

  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    let text = `${i + 1}. ${task.text}`;
    if (task.deadline) {
      text += `\n📅 Deadline: ${task.deadline}`;
    }
    
    const keyboard = {
      inline_keyboard: [[
        { text: '✅ Done', callback_data: `done_${task.id}` }
      ]]
    };
    
    await sendMessage(chatId, text, env, keyboard);
  }
}

async function getTasks(chatId, env) {
  const key = `tasks_${chatId}`;
  const data = await env.TASKS.get(key);
  return data ? JSON.parse(data) : [];
}

async function saveTasks(chatId, tasks, env) {
  const key = `tasks_${chatId}`;
  await env.TASKS.put(key, JSON.stringify(tasks));
}

async function sendMessage(chatId, text, env, replyMarkup = null) {
  const body = {
    chat_id: chatId,
    text: text
  };
  
  if (replyMarkup) {
    body.reply_markup = replyMarkup;
  }

  await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
}

async function deleteMessage(chatId, messageId, env) {
  await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/deleteMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      message_id: messageId
    })
  });
}

async function answerCallbackQuery(callbackQueryId, text, env) {
  await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      callback_query_id: callbackQueryId,
      text: text
    })
  });
}

async function registerUser(chatId, env) {
  const users = await getUsers(env);
  if (!users.includes(chatId)) {
    users.push(chatId);
    await saveUsers(users, env);
  }
}

async function getUsers(env) {
  const data = await env.TASKS.get('users');
  return data ? JSON.parse(data) : [];
}

async function saveUsers(users, env) {
  await env.TASKS.put('users', JSON.stringify(users));
}

async function sendScheduledReminders(env) {
  const users = await getUsers(env);
  
  for (const chatId of users) {
    const tasks = await getTasks(chatId, env);
    
    if (tasks.length === 0) {
      continue;
    }
    
    let message = '⏰ Your Tasks:\n\n';
    tasks.forEach((task, index) => {
      message += `${index + 1}. ${task.text}`;
      if (task.deadline) {
        message += ` 📅 ${task.deadline}`;
      }
      message += '\n';
    });
    
    await sendMessage(chatId, message, env);
  }
}

