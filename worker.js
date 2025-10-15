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
    await checkScheduledMessages(env);
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

  const waitingState = await getWaitingState(chatId, env);
  
  if (waitingState === 'add_task' && !text.startsWith('/')) {
    await addTask(chatId, text, env);
    await clearWaitingState(chatId, env);
    await sendMessage(chatId, `✅ Task added: ${text}`, env);
    return;
  }
  
  if (waitingState === 'custom_reminder' && !text.startsWith('/')) {
    await setWaitingState(chatId, `reminder_text_${text}`, env);
    await sendMessage(chatId, `Reminder text: "${text}"\n\nNow select date:`, env);
    await showCalendar(chatId, env);
    return;
  }
  
  if (waitingState && waitingState.startsWith('time_') && !text.startsWith('/')) {
    // User typed time manually
    const timeMatch = text.match(/^(\d{1,2}):(\d{2})$/);
    if (timeMatch) {
      const hours = parseInt(timeMatch[1]);
      const minutes = parseInt(timeMatch[2]);
      
      if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
        const timeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
        await handleTimeSelection(chatId, timeStr, env);
        return;
      } else {
        await sendMessage(chatId, 'Invalid time. Hours: 0-23, Minutes: 0-59', env);
        return;
      }
    } else {
      await sendMessage(chatId, 'Invalid time format. Use HH:MM (e.g., 10:45 or 22:30)', env);
      return;
    }
  }
  
  if (waitingState && waitingState.includes('reminder_text_') && waitingState.includes('_time_') && !text.startsWith('/')) {
    // User typed time manually for custom reminder
    const timeMatch = text.match(/^(\d{1,2}):(\d{2})$/);
    if (timeMatch) {
      const hours = parseInt(timeMatch[1]);
      const minutes = parseInt(timeMatch[2]);
      
      if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
        const timeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
        await handleTimeSelection(chatId, timeStr, env);
        return;
      } else {
        await sendMessage(chatId, 'Invalid time. Hours: 0-23, Minutes: 0-59', env);
        return;
      }
    } else {
      await sendMessage(chatId, 'Invalid time format. Use HH:MM (e.g., 10:45 or 22:30)', env);
      return;
    }
  }

  if (text === '/add') {
    await setWaitingState(chatId, 'add_task', env);
    await sendMessage(chatId, 'Type your task:', env);
  } else if (text.startsWith('/add ')) {
    const task = text.substring(5).trim();
    if (task) {
      await addTask(chatId, task, env);
      await sendMessage(chatId, `✅ Task added: ${task}`, env);
    }
  } else if (text === '/list') {
    await listTasks(chatId, env);
  } else if (text === '/reminder') {
    await showAllReminders(chatId, env);
  } else if (text === '/setreminder') {
    await setWaitingState(chatId, 'custom_reminder', env);
    await sendMessage(chatId, 'Type your reminder text:', env);
  } else if (text === '/testreminders') {
    await testReminders(env);
    await sendMessage(chatId, 'Reminder check completed', env);
  } else if (text === '/forcecheck') {
    const scheduledMessages = await getScheduledMessages(env);
    await forceCheckScheduledMessages(env);
    await sendMessage(chatId, `Checked ${scheduledMessages.length} scheduled messages`, env);
  } else if (text === '/debugreminders') {
    const scheduledMessages = await getScheduledMessages(env);
    const now = Math.floor(Date.now() / 1000);
    let debugMsg = `Total scheduled: ${scheduledMessages.length}\n\n`;
    scheduledMessages.slice(0, 5).forEach(m => {
      const timeLeft = m.scheduleTime - now;
      debugMsg += `- ${m.text.substring(0, 30)}\n  Time: ${m.scheduleTime}\n  Left: ${Math.floor(timeLeft/60)} mins\n\n`;
    });
    await sendMessage(chatId, debugMsg, env);
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
      '4️⃣ /reminder - Show all your reminders\n' +
      '5️⃣ /setreminder - Set new custom reminder\n\n' +
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
  } else if (data.startsWith('reminder_')) {
    const taskId = parseInt(data.substring(9));
    await setWaitingState(chatId, `reminder_${taskId}`, env);
    await answerCallbackQuery(callbackQuery.id, 'Select reminder time:', env);
    await showCalendar(chatId, env);
  } else if (data.startsWith('calendar_')) {
    const dateStr = data.substring(9);
    await handleCalendarSelection(chatId, dateStr, env);
  } else if (data.startsWith('time_')) {
    const timeStr = data.substring(5);
    await handleTimeSelection(chatId, timeStr, env);
  } else if (data.startsWith('month_')) {
    const monthData = data.substring(6);
    await handleMonthChange(chatId, monthData, env);
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
      const daysLeft = calculateDaysLeft(task.deadline);
      text += `\n📅 Deadline: ${task.deadline} (${daysLeft})`;
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
  
  // Get current Tehran time
  const now = new Date();
  const tehranOffset = 3.5 * 60; // 3.5 hours in minutes
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const tehranTime = new Date(utc + (tehranOffset * 60000));
  const currentHour = tehranTime.getHours();
  const currentMinute = tehranTime.getMinutes();
  
  // Check if it's one of the reminder times (12 AM, 6 AM, 12 PM, 6 PM Tehran time) and at minute 0
  if ((currentHour !== 0 && currentHour !== 6 && currentHour !== 12 && currentHour !== 18) || currentMinute !== 0) {
    return;
  }
  
  for (const chatId of users) {
    const tasks = await getTasks(chatId, env);
    
    if (tasks.length === 0) {
      continue;
    }
    
    let message = '⏰ Daily Task Alert:\n\n';
    tasks.forEach((task, index) => {
      message += `${index + 1}. ${task.text}`;
      if (task.deadline) {
        const daysLeft = calculateDaysLeft(task.deadline);
        message += ` 📅 ${task.deadline} (${daysLeft})`;
      }
      message += '\n';
    });
    
    await sendMessage(chatId, message, env);
  }
}

async function setWaitingState(chatId, state, env) {
  const key = `waiting_${chatId}`;
  await env.TASKS.put(key, state);
}

async function getWaitingState(chatId, env) {
  const key = `waiting_${chatId}`;
  return await env.TASKS.get(key);
}

async function clearWaitingState(chatId, env) {
  const key = `waiting_${chatId}`;
  await env.TASKS.delete(key);
}

async function showReminderMenu(chatId, env) {
  const tasks = await getTasks(chatId, env);
  
  if (tasks.length === 0) {
    await sendMessage(chatId, 'No tasks available for reminders. Add some tasks first!', env);
    return;
  }
  
  let message = '📅 Select a task to set reminder:\n\n';
  const keyboard = {
    inline_keyboard: []
  };
  
  tasks.forEach((task, index) => {
    message += `${index + 1}. ${task.text}\n`;
    keyboard.inline_keyboard.push([{
      text: `Set Reminder for: ${task.text.substring(0, 20)}...`,
      callback_data: `reminder_${task.id}`
    }]);
  });
  
  await sendMessage(chatId, message, env, keyboard);
}

async function showCalendar(chatId, env, month = null, year = null) {
  const now = new Date();
  const tehranTime = getTehranTime(now);
  const currentMonth = month !== null ? month : tehranTime.getMonth();
  const currentYear = year !== null ? year : tehranTime.getFullYear();
  
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDay = new Date(currentYear, currentMonth, 1).getDay();
  
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  let calendar = `📅 ${monthNames[currentMonth]} ${currentYear}\n\n`;
  calendar += weekDays.join(' ') + '\n';
  
  const keyboard = {
    inline_keyboard: []
  };
  
  // Add month navigation
  const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
  const nextMonth = currentMonth === 11 ? 0 : currentMonth + 1;
  const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
  const nextYear = currentMonth === 11 ? currentYear + 1 : currentYear;
  
  keyboard.inline_keyboard.push([
    { text: '◀️ Previous', callback_data: `month_${prevMonth}_${prevYear}` },
    { text: 'Next ▶️', callback_data: `month_${nextMonth}_${nextYear}` }
  ]);
  
  // Add empty cells for days before month starts
  let row = [];
  for (let i = 0; i < firstDay; i++) {
    row.push({ text: ' ', callback_data: 'empty' });
  }
  
  // Add day buttons
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    row.push({ text: String(day), callback_data: `calendar_${dateStr}` });
    
    if (row.length === 7) {
      keyboard.inline_keyboard.push(row);
      row = [];
    }
  }
  
  if (row.length > 0) {
    while (row.length < 7) {
      row.push({ text: ' ', callback_data: 'empty' });
    }
    keyboard.inline_keyboard.push(row);
  }
  
  await sendMessage(chatId, calendar, env, keyboard);
}

async function handleCalendarSelection(chatId, dateStr, env) {
  const waitingState = await getWaitingState(chatId, env);
  
  if (waitingState && waitingState.startsWith('reminder_text_')) {
    await setWaitingState(chatId, `reminder_text_${waitingState.substring(13)}_time_${dateStr}`, env);
    await sendMessage(chatId, `Selected date: ${dateStr}\n\nType time in HH:MM format (e.g., 12:30 or 22:30):`, env);
  } else {
    await setWaitingState(chatId, `time_${dateStr}`, env);
    await sendMessage(chatId, `Selected date: ${dateStr}\n\nType time in HH:MM format (e.g., 12:30 or 22:30):`, env);
  }
}

async function handleMonthChange(chatId, monthData, env) {
  const [month, year] = monthData.split('_').map(Number);
  await showCalendar(chatId, env, month, year);
}

async function showAllReminders(chatId, env) {
  const reminders = await getReminders(env);
  const now = new Date();
  
  // Filter and separate active and overdue reminders
  const activeReminders = [];
  const overdueReminders = [];
  
  for (const reminder of reminders) {
    if (reminder.chatId === chatId) {
      // Parse reminder dateTime correctly for Tehran timezone
      const [datePart, timePart] = reminder.dateTime.split(' ');
      const [year, month, day] = datePart.split('-').map(Number);
      const [hour, minute] = timePart.split(':').map(Number);
      
      const tehranOffsetMs = 3.5 * 60 * 60 * 1000;
      const reminderDate = new Date(Date.UTC(year, month - 1, day, hour, minute) - tehranOffsetMs);
      
      const timeDiff = reminderDate - now;
      
      // Consider overdue if more than 5 minutes past
      if (timeDiff > -300000) {
        activeReminders.push(reminder);
      } else {
        overdueReminders.push(reminder);
      }
    }
  }
  
  // Remove overdue reminders
  if (overdueReminders.length > 0) {
    const allReminders = await getReminders(env);
    const overdueIds = overdueReminders.map(r => r.id);
    const cleanedReminders = allReminders.filter(r => !overdueIds.includes(r.id));
    await saveReminders(cleanedReminders, env);
    
    await sendMessage(chatId, `🗑️ Removed ${overdueReminders.length} overdue reminder(s)`, env);
  }
  
  if (activeReminders.length === 0) {
    await sendMessage(chatId, 'No active reminders. Use /setreminder to create one.', env);
    return;
  }
  
  let message = '📅 Your Reminders:\n\n';
  
  for (let i = 0; i < activeReminders.length; i++) {
    const reminder = activeReminders[i];
    
    // Parse reminder dateTime correctly for Tehran timezone
    const [datePart, timePart] = reminder.dateTime.split(' ');
    const [year, month, day] = datePart.split('-').map(Number);
    const [hour, minute] = timePart.split(':').map(Number);
    
    const tehranOffsetMs = 3.5 * 60 * 60 * 1000;
    const reminderDate = new Date(Date.UTC(year, month - 1, day, hour, minute) - tehranOffsetMs);
    
    const timeDiff = reminderDate - now;
    
    const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
    
    let timeLeft = '';
    if (timeDiff < 0) {
      timeLeft = 'In progress';
    } else if (days > 0) {
      timeLeft = `${days} days, ${hours} hours left`;
    } else if (hours > 0) {
      timeLeft = `${hours} hours, ${minutes} minutes left`;
    } else {
      timeLeft = `${minutes} minutes left`;
    }
    
    const text = reminder.isCustom ? reminder.text : 'Task reminder';
    message += `${i + 1}. ${text}\n`;
    message += `   📅 ${reminder.dateTime} (Tehran time)\n`;
    message += `   ⏰ ${timeLeft}\n\n`;
  }
  
  message += 'Use /setreminder to add new reminder';
  
  await sendMessage(chatId, message, env);
}

// Removed showTimePicker function - now using manual time input

async function handleTimeSelection(chatId, timeStr, env) {
  const waitingState = await getWaitingState(chatId, env);
  
  if (waitingState && waitingState.includes('reminder_text_') && waitingState.includes('_time_')) {
    // Custom reminder
    const parts = waitingState.split('_time_');
    const reminderText = parts[0].substring(13); // Remove 'reminder_text_' prefix
    const dateStr = parts[1];
    const fullDateTime = `${dateStr} ${timeStr}`;
    
    await setCustomReminder(chatId, reminderText, fullDateTime, env);
    await clearWaitingState(chatId, env);
    await sendMessage(chatId, `✅ Custom reminder set: "${reminderText}" at ${fullDateTime} (Tehran time)`, env);
    return;
  }
  
  if (waitingState && waitingState.startsWith('time_')) {
    const dateStr = waitingState.substring(5);
    const fullDateTime = `${dateStr} ${timeStr}`;
    
    // Find the task for this reminder
    const tasks = await getTasks(chatId, env);
    const reminderTask = tasks.find(task => {
      const reminderState = `reminder_${task.id}`;
      return waitingState.includes(reminderState);
    });
    
    if (reminderTask) {
      await setReminder(chatId, reminderTask.id, fullDateTime, env);
      await clearWaitingState(chatId, env);
      await sendMessage(chatId, `✅ Reminder set for "${reminderTask.text}" at ${fullDateTime} (Tehran time)`, env);
    }
  } else {
    await sendMessage(chatId, 'Error: No waiting state found', env);
  }
}

async function setReminder(chatId, taskId, dateTime, env) {
  const reminders = await getReminders(env);
  const reminder = {
    id: Date.now(),
    chatId: chatId,
    taskId: taskId,
    dateTime: dateTime,
    timezone: 'Asia/Tehran',
    created: new Date().toISOString()
  };
  
  reminders.push(reminder);
  await saveReminders(reminders, env);
}

async function setCustomReminder(chatId, text, dateTime, env) {
  const reminders = await getReminders(env);
  const reminder = {
    id: Date.now(),
    chatId: chatId,
    text: text,
    dateTime: dateTime,
    timezone: 'Asia/Tehran',
    isCustom: true,
    created: new Date().toISOString()
  };
  
  reminders.push(reminder);
  await saveReminders(reminders, env);
  
  // Schedule reminders using Telegram's scheduled message API
  await scheduleReminderMessages(chatId, text, dateTime, env);
}

async function scheduleReminderMessages(chatId, text, dateTime, env) {
  // Parse Tehran time correctly
  const [datePart, timePart] = dateTime.split(' ');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hour, minute] = timePart.split(':').map(Number);
  
  // Treat input as Tehran time (UTC+3:30) and convert to UTC
  const tehranOffsetMs = 3.5 * 60 * 60 * 1000;
  const reminderDate = new Date(Date.UTC(year, month - 1, day, hour, minute) - tehranOffsetMs);
  
  const now = new Date();
  
  // Calculate reminder times
  const reminderTimes = [
    { minutes: 1440, label: '24 hours' },
    { minutes: 720, label: '12 hours' },
    { minutes: 360, label: '6 hours' },
    { minutes: 120, label: '2 hours' },
    { minutes: 60, label: '1 hour' },
    { minutes: 30, label: '30 minutes' },
    { minutes: 15, label: '15 minutes' },
    { minutes: 5, label: '5 minutes' },
    { minutes: 1, label: '1 minute' },
    { minutes: 0, label: 'NOW' }
  ];
  
  for (const reminder of reminderTimes) {
    const reminderTime = new Date(reminderDate.getTime() - (reminder.minutes * 60 * 1000));
    
    if (reminderTime > now) {
      const unixTimestamp = Math.floor(reminderTime.getTime() / 1000);
      
      let message = `🔔 REMINDER: ${text}`;
      if (reminder.minutes > 0) {
        message += `\n⏰ ${reminder.label} left!`;
      }
      
      await scheduleMessage(chatId, message, unixTimestamp, env);
    }
  }
}

async function scheduleMessage(chatId, text, unixTimestamp, env) {
  // Telegram Bot API doesn't support schedule_date parameter
  // We need to use a different approach - store scheduled messages and check them periodically
  const scheduledMessage = {
    id: Date.now() + Math.random(),
    chatId: chatId,
    text: text,
    scheduleTime: unixTimestamp,
    sent: false
  };
  
  const scheduledMessages = await getScheduledMessages(env);
  scheduledMessages.push(scheduledMessage);
  await saveScheduledMessages(scheduledMessages, env);
}

async function getScheduledMessages(env) {
  const data = await env.TASKS.get('scheduled_messages');
  return data ? JSON.parse(data) : [];
}

async function saveScheduledMessages(messages, env) {
  await env.TASKS.put('scheduled_messages', JSON.stringify(messages));
}

async function getReminders(env) {
  const data = await env.TASKS.get('reminders');
  return data ? JSON.parse(data) : [];
}

async function saveReminders(reminders, env) {
  await env.TASKS.put('reminders', JSON.stringify(reminders));
}

function getTehranTime(date) {
  const tehranOffset = 3.5 * 60; // 3.5 hours in minutes
  const utc = date.getTime() + (date.getTimezoneOffset() * 60000);
  return new Date(utc + (tehranOffset * 60000));
}

function calculateDaysLeft(deadline) {
  try {
    const deadlineDate = new Date(deadline);
    const today = new Date();
    
    // Convert to Tehran timezone (UTC+3:30)
    const tehranOffset = 3.5 * 60; // 3.5 hours in minutes
    const utc = today.getTime() + (today.getTimezoneOffset() * 60000);
    const tehranTime = new Date(utc + (tehranOffset * 60000));
    
    today.setHours(0, 0, 0, 0);
    deadlineDate.setHours(0, 0, 0, 0);
    
    const diffTime = deadlineDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) {
      return 'overdue';
    } else if (diffDays === 0) {
      return 'today';
    } else if (diffDays === 1) {
      return '1 day left';
    } else {
      return `${diffDays} days left`;
    }
  } catch (error) {
    return 'invalid date';
  }
}

async function checkReminders(env) {
  const reminders = await getReminders(env);
  const now = getTehranTime(new Date());
  
  for (const reminder of reminders) {
    try {
      const reminderDate = new Date(reminder.dateTime);
      const timeDiff = reminderDate - now;
      const timeDiffMinutes = Math.floor(timeDiff / (1000 * 60));
      
      // Check for different reminder intervals - send if within 1 minute of target time
      const intervals = [1440, 720, 120, 60, 30, 15, 5, 1, 0]; // minutes before
      const intervalLabels = ['1 day', '12 hours', '2 hours', '1 hour', '30 minutes', '15 minutes', '5 minutes', '1 minute', 'NOW'];
      
      for (let i = 0; i < intervals.length; i++) {
        const targetMinutes = intervals[i];
        const timeDiffToTarget = Math.abs(timeDiffMinutes - targetMinutes);
        
        // Send reminder if we're within 1 minute of the target time
        if (timeDiffToTarget <= 1 && timeDiff >= 0) {
          let message = '';
          
          if (reminder.isCustom) {
            message = `🔔 REMINDER: ${reminder.text}`;
            if (targetMinutes > 0) {
              message += `\n⏰ ${intervalLabels[i]} left!`;
            }
          } else {
            const tasks = await getTasks(reminder.chatId, env);
            const task = tasks.find(t => t.id === reminder.taskId);
            if (task) {
              message = `🔔 REMINDER: ${task.text}`;
              if (targetMinutes > 0) {
                message += `\n⏰ ${intervalLabels[i]} left!`;
              }
            }
          }
          
          if (message) {
            await sendMessage(reminder.chatId, message, env);
          }
          
          // Remove the reminder only after the final reminder (NOW)
          if (targetMinutes === 0) {
            const updatedReminders = reminders.filter(r => r.id !== reminder.id);
            await saveReminders(updatedReminders, env);
          }
        }
      }
    } catch (error) {
      console.error('Error checking reminder:', error);
    }
  }
}

// Test function to check reminders manually
async function testReminders(env) {
  await checkReminders(env);
}

async function checkScheduledMessages(env) {
  const scheduledMessages = await getScheduledMessages(env);
  const now = Math.floor(Date.now() / 1000);
  
  const toSend = [];
  const toKeep = [];
  
  for (const message of scheduledMessages) {
    if (!message.sent && message.scheduleTime <= now && message.scheduleTime >= (now - 120)) {
      toSend.push(message);
    } else if (!message.sent && message.scheduleTime > now) {
      toKeep.push(message);
    }
  }
  
  for (const message of toSend) {
    try {
      await sendMessage(message.chatId, message.text, env);
      console.log(`Sent scheduled message at ${now}: ${message.text}`);
    } catch (error) {
      console.error('Error sending scheduled message:', error);
    }
  }
  
  await saveScheduledMessages(toKeep, env);
}

// Force check scheduled messages every minute
async function forceCheckScheduledMessages(env) {
  await checkScheduledMessages(env);
}

