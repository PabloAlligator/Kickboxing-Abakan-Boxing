const TelegramBot = require('node-telegram-bot-api');

// ВСТАВЬ СВОЙ ТОКЕН
const token = '8328958019:AAGS4gaY4iVq31RHTFk2GbjVILKmRj-Okhw';
const bot = new TelegramBot(token, { polling: true });

// ТВОЙ TELEGRAM ID
const ADMIN_ID = 619964626;

// Хранилище данных
const userStates = {};
const userData = {};

// Тренеры
const COACHES = [
    'Байкалов Артём Владимирович',
    'Харюшин Всеволод Евгеньевич',
    'Прокофьев Максим Александрович'
];

// Команда /start
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const firstName = msg.from.first_name || 'друг';
    
    bot.sendMessage(chatId, 
        `👋 Привет, ${firstName}!\n\n🥊 Добро пожаловать в клуб «СОДРУЖЕСТВО»!\n\nХочешь присоединиться? Нажми кнопку ниже.`,
        {
            reply_markup: {
                keyboard: [[{ text: '✅ ПРИСОЕДИНИТЬСЯ' }]],
                resize_keyboard: true,
                one_time_keyboard: true
            }
        }
    );
    userStates[chatId] = 'waiting_for_join';
});

// Обработка сообщений
bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;
    
    if (text === '/start') return;
    
    const state = userStates[chatId];
    
    // Шаг 1: Нажатие кнопки
    if (state === 'waiting_for_join' && text === '✅ ПРИСОЕДИНИТЬСЯ') {
        userStates[chatId] = 'waiting_for_name_age';
        bot.sendMessage(chatId,
            '📝 Напиши имя, фамилию и возраст через пробел.\nНапример: Иван Петров 25',
            { reply_markup: { remove_keyboard: true } }
        );
        return;
    }
    
    // Шаг 2: Имя, фамилия и возраст
    if (state === 'waiting_for_name_age') {
        const parts = text.trim().split(/\s+/);
        
        if (parts.length >= 3 && !isNaN(parts[parts.length - 1])) {
            const age = parts.pop();
            const firstName = parts[0];
            const lastName = parts.slice(1).join(' ');
            
            if (age > 0 && age < 120) {
                userData[chatId] = { 
                    firstName: firstName,
                    lastName: lastName,
                    fullName: firstName + ' ' + lastName,
                    age: age 
                };
                userStates[chatId] = 'waiting_for_phone';
                
                // Запрашиваем номер телефона с кнопкой
                bot.sendMessage(chatId,
                    `✅ Спасибо, ${firstName} ${lastName}!\n\n📱 Теперь отправь свой номер телефона.`,
                    {
                        reply_markup: {
                            keyboard: [
                                [{ text: '📱 Отправить номер телефона', request_contact: true }]
                            ],
                            resize_keyboard: true,
                            one_time_keyboard: true
                        }
                    }
                );
            } else {
                bot.sendMessage(chatId, '❌ Возраст должен быть от 1 до 120 лет');
            }
        } else {
            bot.sendMessage(chatId, 
                '❌ Напиши имя, фамилию и возраст через пробел.\nНапример: Иван Петров 25'
            );
        }
        return;
    }
    
    // Шаг 3: Получение номера телефона
    if (state === 'waiting_for_phone') {
        let phoneNumber = '';
        
        // Если пользователь нажал кнопку "Отправить номер"
        if (msg.contact) {
            phoneNumber = msg.contact.phone_number;
        } 
        // Если ввел номер вручную
        else if (text && text.match(/^[\d\s\+\-\(\)]+$/)) {
            phoneNumber = text.trim();
        } else {
            bot.sendMessage(chatId, '❌ Пожалуйста, отправь номер телефона, нажав кнопку или введя вручную');
            return;
        }
        
        userData[chatId].phone = phoneNumber;
        userStates[chatId] = 'waiting_for_training_type';
        
        bot.sendMessage(chatId,
            `✅ Спасибо! Теперь выбери тип тренировки:`,
            {
                reply_markup: {
                    keyboard: [
                        [{ text: '🥊 Групповая' }],
                        [{ text: '👤 Индивидуальная' }]
                    ],
                    resize_keyboard: true,
                    one_time_keyboard: true
                }
            }
        );
        return;
    }
    
    // Шаг 4: Тип тренировки
    if (state === 'waiting_for_training_type') {
        if (text === '🥊 Групповая') {
            bot.sendMessage(chatId,
                '✅ Ты записан на групповые тренировки!\n\n' +
                '📅 Расписание:\n' +
                '• Пн-Пт: 17:30 - 21:00\n' +
                '• Сб: 11:00 - 16:00\n\n' +
                '💰 Стоимость: от 4000 руб/мес\n\n' +
                '🎁 Первая тренировка — бесплатно!',
                { reply_markup: { remove_keyboard: true } }
            );
            
            // Отправка уведомления админу с полной информацией
            const user = msg.from;
            bot.sendMessage(ADMIN_ID, 
                `🔥 НОВАЯ ЗАЯВКА!\n\n` +
                `👤 Имя: ${userData[chatId]?.fullName || 'Неизвестно'}\n` +
                `🎂 Возраст: ${userData[chatId]?.age || '?'}\n` +
                `📱 Телефон: ${userData[chatId]?.phone || 'Не указан'}\n` +
                `🥊 Тип: Групповая тренировка\n\n` +
                `📱 Telegram: @${user.username || 'нет username'}\n` +
                `🆔 ID: ${chatId}\n` +
                `🔗 Ссылка: https://t.me/${user.username || ''}`
            );
            
            delete userStates[chatId];
        } 
        else if (text === '👤 Индивидуальная') {
            userStates[chatId] = 'waiting_for_coach';
            const keyboard = COACHES.map(coach => [{ text: coach }]);
            bot.sendMessage(chatId, '👤 Выбери тренера:', {
                reply_markup: { 
                    keyboard: keyboard,
                    resize_keyboard: true, 
                    one_time_keyboard: true 
                }
            });
        } else {
            bot.sendMessage(chatId, '❌ Пожалуйста, выбери кнопку ниже');
        }
        return;
    }
    
    // Шаг 5: Выбор тренера
    if (state === 'waiting_for_coach') {
        if (COACHES.includes(text)) {
            let price = text === COACHES[1] ? 'от 1500 руб.' : 'от 2000 руб.';
            bot.sendMessage(chatId,
                `✅ Ты выбрал тренера:\n\n👤 ${text}\n💰 ${price}\n\n📞 С тобой свяжутся.\n\n🎁 Первая тренировка — бесплатно!`,
                { reply_markup: { remove_keyboard: true } }
            );
            
            // Отправка уведомления админу с полной информацией
            const user = msg.from;
            bot.sendMessage(ADMIN_ID, 
                `🔥 НОВАЯ ЗАЯВКА!\n\n` +
                `👤 Имя: ${userData[chatId]?.fullName || 'Неизвестно'}\n` +
                `🎂 Возраст: ${userData[chatId]?.age || '?'}\n` +
                `📱 Телефон: ${userData[chatId]?.phone || 'Не указан'}\n` +
                `🥊 Тип: Индивидуальная\n` +
                `👨‍🏫 Тренер: ${text}\n\n` +
                `📱 Telegram: @${user.username || 'нет username'}\n` +
                `🆔 ID: ${chatId}\n` +
                `🔗 Ссылка: https://t.me/${user.username || ''}`
            );
            
            console.log('Новый клиент:', userData[chatId]);
            delete userStates[chatId];
        } else {
            bot.sendMessage(chatId, '❌ Выбери тренера из списка');
        }
        return;
    }
});

console.log('🤖 Бот запущен... Жду команды');