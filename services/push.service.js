const webpush = require('web-push');
const prisma = require('../lib/prisma');

function pushConfigured() {
  return Boolean(
    process.env.VAPID_PUBLIC_KEY &&
    process.env.VAPID_PRIVATE_KEY &&
    process.env.VAPID_SUBJECT,
  );
}

if (pushConfigured()) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  );
}

async function sendToOwner(ownerId, payload) {
  if (!pushConfigured()) return { sent: 0, disabled: true };
  const subscriptions = await prisma.pushSubscription.findMany({
    where: { ownerId },
  });
  let sent = 0;
  for (const subscription of subscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.p256dh, auth: subscription.auth },
        },
        JSON.stringify(payload),
      );
      sent += 1;
    } catch (error) {
      if (error.statusCode === 404 || error.statusCode === 410) {
        await prisma.pushSubscription.delete({
          where: { id: subscription.id },
        });
      } else {
        console.error('Web Push:', error.message);
      }
    }
  }
  return { sent, disabled: false };
}

async function runReminderCycle() {
  const now = new Date();

  const personal = await prisma.personalTraining.findMany({
    where: {
      status: 'SCHEDULED',
      reminderMinutes: { not: null },
      reminderSentAt: null,
      startsAt: { gt: now },
    },
  });

  for (const training of personal) {
    const dueAt = new Date(
      training.startsAt.getTime() -
        training.reminderMinutes * 60 * 1000,
    );

    // Ещё не наступило точное время напоминания
    if (dueAt > now) continue;

    const isDayBefore = training.reminderMinutes === 1440;
    const isTwoHoursBefore = training.reminderMinutes === 120;

    const result = await sendToOwner(training.ownerId, {
      title: 'Персональная тренировка',
      body: isDayBefore
        ? 'Завтра запланирована персональная тренировка. Откройте приложение.'
        : isTwoHoursBefore
          ? 'Через 2 часа запланирована персональная тренировка. Откройте приложение.'
          : 'Скоро запланирована персональная тренировка. Откройте приложение.',
      url: '/admin/personal',
      tag: `personal-${training.id}`,
    });

    // Считаем напоминание отправленным только если
    // хотя бы на одно устройство push реально был отправлен
    if (result.sent > 0) {
      await prisma.personalTraining.update({
        where: { id: training.id },
        data: { reminderSentAt: now },
      });
    }
  }

  const tasks = await prisma.clubTask.findMany({
    where: {
      completed: false,
      reminderAt: { lte: now },
      reminderSentAt: null,
    },
  });

  if (tasks.length) {
    const owners = await prisma.user.findMany({
      where: {
        active: true,
        role: 'OWNER',
      },
      select: {
        id: true,
      },
    });

    for (const task of tasks) {
      let totalSent = 0;

      for (const owner of owners) {
        const result = await sendToOwner(owner.id, {
          title: 'Задача клуба',
          body: task.title,
          url: '/admin/tasks',
          tag: `task-${task.id}`,
        });

        totalSent += result.sent;
      }

      // Задача тоже не считается уведомлённой,
      // если push вообще никуда не ушёл
      if (totalSent > 0) {
        await prisma.clubTask.update({
          where: { id: task.id },
          data: { reminderSentAt: now },
        });
      }
    }
  }
}

module.exports = { pushConfigured, runReminderCycle, sendToOwner };
