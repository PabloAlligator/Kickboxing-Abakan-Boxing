# Содружество

Проект объединяет публичный сайт бойцовского клуба и закрытое веб-приложение `Sodruzhestvo Control`.

## Стек

- HTML5, SCSS, Vanilla JavaScript;
- Node.js 22+ / Express;
- Prisma 6 / SQLite;
- server-side sessions в SQLite;
- Argon2id, Helmet, CSP, rate limits, CSRF/origin protection;
- Web Push / PWA;
- PM2 + Nginx + SSL в production.

## Локальный запуск

1. Скопировать `.env.example` в `.env`.
2. Задать длинный `SESSION_SECRET` и два уникальных пароля OWNER.
3. Выполнить:

```bash
npm ci
npm run prisma:generate
npm run db:prepare
npm run prisma:deploy
npm run seed
npm run css:min
npm start
```

Публичный сайт: `http://localhost:3000/`.

Закрытая система: `http://localhost:3000/admin/login`.

Публичной регистрации нет. Seed создаёт или обновляет только двух владельцев из `.env`.

## Важная логика

- общие финансы = групповые оплаты − расходы;
- персональные тренировки никогда не входят в общие финансы;
- доход персоналок учитывается только по статусу `COMPLETED`;
- каждый запрос к персональным данным фильтруется по `ownerId` текущей сессии;
- финансовая история и посещения не каскадно удаляются вместе со спортсменом;
- спортсмены и группы архивируются.

## Web Push

Сгенерировать ключи:

```bash
npx web-push generate-vapid-keys
```

Заполнить `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`. Push API требует HTTPS, кроме localhost. После production-деплоя каждый OWNER должен открыть «Настройки» и разрешить уведомления на своём устройстве.

## Production

```bash
npm ci
npx prisma generate
npm run db:prepare
npx prisma migrate deploy
pm2 start ecosystem.config.cjs --env production
pm2 save
```

Nginx должен проксировать запросы на `127.0.0.1:3000`, передавать `Host`, `X-Forwarded-Proto`, `X-Forwarded-For` и обслуживать домен только по HTTPS.

Перед первым запуском:

- задать `APP_ORIGIN=https://ваш-домен` без завершающего слеша;
- задать `DATABASE_URL=file:../data/sodruzhestvo.db`;
- задать `SESSION_SECRET` не короче 64 случайных символов;
- выполнить seed с временно заданными OWNER-паролями, затем удалить значения паролей из `.env` или заменить их новыми защищённым административным способом;
- настроить VAPID.

## Проверки

```bash
npm test
npm audit --omit=dev
```

Тесты проверяют основные клубные сценарии, формулу финансов, статусы персоналок, CSRF/origin-защиту и прямые IDOR-попытки между двумя OWNER.
