# Содружество

Публичный сайт бойцовского клуба + закрытая внутренняя система `Sodruzhestvo Control`.

Архитектура приведена к тому же принципу, что и production-проекты ShumDev/RioCar: публичная часть отделена от админских страниц, backend разбит по доменам, middleware/services вынесены отдельно.

## Структура

```text
public/                 публичные HTML/robots/sitemap
admin-pages/            отдельные закрытые страницы Control
site/
  styles/               SCSS публичной части и admin
  css/                  собранные CSS
  scripts/              публичный JS и admin JS
  img/                   локальные изображения/PWA icons
routes/                  доменные Express routes
middleware/              auth / CSRF / Origin
services/                sessions / audit / Web Push
config/                  security config
prisma/                  schema + production baseline migration
data/                    production SQLite (не хранится в Git/архиве)
scripts/                 служебные CLI-скрипты
```

## Стек

- HTML5 / SCSS / Vanilla JavaScript;
- Node.js 22+ / Express 5;
- Prisma 6.19 / SQLite;
- server-side sessions в SQLite;
- Argon2id;
- Helmet / CSP / rate limits / CSRF + Origin validation;
- Web Push / Service Worker / PWA;
- PM2 / Nginx / SSL.

React/Vue не используются.

## Локальный запуск

```bash
copy .env.example .env
npm ci
npm run prisma:generate
npm run prisma:deploy
npm run owner:create
npm run owner:create
npm run css:min
npm start
```

Два запуска `owner:create` — для двух равноправных владельцев (Артём и Всеволод). Публичной регистрации и управления «командой» из Control нет.

- сайт: `http://localhost:3000/`
- Control: `http://localhost:3000/admin/login`

## ENV

Обязательно заполнить:

```env
DATABASE_URL="file:../data/sodruzhestvo.db"
SESSION_SECRET=<минимум 64 случайных символа>
APP_ORIGIN=https://содружество-абакан.рф
CLUB_TIMEZONE=Asia/Krasnoyarsk
PUBLIC_PHONE=<точный телефон клуба>
TELEGRAM_URL=https://t.me/<группа_или_канал_клуба>
```

Владельцы и их пароли в `.env` не хранятся. Они создаются через `npm run owner:create`.

Для Web Push:

```bash
npx web-push generate-vapid-keys
```

и заполнить `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`.

## Бизнес-логика

- общая часть доступна обоим OWNER;
- общие финансы = групповые оплаты − расходы;
- персональные тренировки не входят в общие финансы;
- каждый OWNER видит только собственных персональных клиентов/тренировки/доход;
- ownership персоналок проверяется backend, а не только UI;
- доход персоналок считается только по `COMPLETED`;
- задачи общие и не имеют ответственного;
- способы оплаты («наличные/перевод») не хранятся;
- отдельной сущности «абонемент» нет;
- деньги хранятся целыми копейками.

## Public

Публичной формы заявки и Telegram-бота нет. Телефон и Telegram-группа берутся из ENV через read-only `/api/public/config`, поэтому в HTML нет разных захардкоженных номеров или личных Telegram-аккаунтов.

Новостной слайдер работает на Vanilla JS; внешний CDN Swiper удалён.

## Production deploy

```bash
npm ci
npm run prisma:generate
npm run prisma:deploy
npm run css:min
npm run owner:create   # только если владельцы ещё не созданы
pm2 start ecosystem.config.cjs --env production
pm2 save
```

После этого:

1. настроить Nginx по `nginx.sodruzhestvo.example.conf`;
2. выпустить/подключить SSL;
3. проверить `curl https://содружество-абакан.рф/health`;
4. войти обоими OWNER и проверить изоляцию персоналок;
5. включить Web Push на каждом нужном устройстве;
6. выполнить `npm test` и `npm audit --omit=dev` уже в среде с установленными зависимостями и доступом к npm registry.

## Важное перед реальным деплоем

В исходном архиве Work присутствовали `.env` и готовая SQLite-база. В production-пакете они удалены. Если исходный архив передавался третьим лицам, секреты из него следует считать потенциально раскрытыми и сгенерировать заново (`SESSION_SECRET`, VAPID, пароли владельцев и любые старые интеграционные ключи).

Перед публикацией также нужно подтвердить два бизнес-реквизита, которые в исходном сайте противоречили друг другу/отсутствовали:

- точный телефон клуба;
- точная Telegram-группа/канал клуба.

Их нужно просто внести в `.env`.

## Безопасный запуск тестов

`npm test` и `npm run test:security` всегда создают отдельную временную SQLite-базу `prisma/test.db`, накатывают в неё миграции и удаляют её после завершения. Рабочая база из `DATABASE_URL` не используется тестами.

Внутри `tests/security.test.js` есть дополнительная аварийная защита: прямой запуск теста с любой БД, кроме `file:./test.db`, останавливается **до любых `deleteMany()`**. Поэтому рабочие пользователи, спортсмены, оплаты и персоналки не должны удаляться тестами.

Если владелец был удалён из БД вручную, старая браузерная сессия автоматически становится недействительной и следующий защищённый запрос потребует войти заново.
