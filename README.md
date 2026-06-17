# Trainer CRM

Полноценное CRM-приложение для персонального тренера.
Стек: React · Supabase · Recharts · FullCalendar

---

## Быстрый старт

### 1. Установите зависимости

```bash
npm install
```

### 2. Настройте Supabase

1. Зарегистрируйтесь на [supabase.com](https://supabase.com) и создайте новый проект
2. Перейдите в **SQL Editor** и выполните весь код из файла `supabase_schema.sql`
3. В настройках проекта перейдите в **Settings → API** и скопируйте:
   - **Project URL** (`https://xxxx.supabase.co`)
   - **anon public** ключ

### 3. Создайте файл .env

```bash
cp .env.example .env
```

Откройте `.env` и вставьте ваши данные:

```
REACT_APP_SUPABASE_URL=https://your-project-id.supabase.co
REACT_APP_SUPABASE_ANON_KEY=your-anon-key-here
```

### 4. Запустите приложение

```bash
npm start
```

Откройте [http://localhost:3000](http://localhost:3000)

---

## Структура проекта

```
trainer-crm/
├── public/
│   └── index.html
├── src/
│   ├── components/
│   │   ├── clients/
│   │   │   └── ClientModal.js        # Форма добавления/редактирования клиента
│   │   ├── layout/
│   │   │   └── Sidebar.js            # Навигация
│   │   ├── payments/
│   │   │   └── PaymentsTab.js        # Вкладка оплат в карточке клиента
│   │   ├── programs/
│   │   │   └── ProgramsTab.js        # Вкладка программ
│   │   ├── schedule/
│   │   │   └── ScheduleTab.js        # Вкладка расписания клиента
│   │   └── stats/
│   │       └── StatsTab.js           # Вкладка статистики клиента
│   ├── hooks/
│   │   ├── useAuth.js                # Аутентификация + профиль
│   │   ├── useClients.js             # CRUD клиентов
│   │   ├── usePayments.js            # CRUD оплат + баланс
│   │   ├── usePrograms.js            # CRUD программ, тренировок, упражнений
│   │   ├── useSchedule.js            # CRUD расписания
│   │   └── useStats.js               # Расчёт объёма, статистика
│   ├── lib/
│   │   └── supabase.js               # Клиент Supabase
│   ├── pages/
│   │   ├── AuthPage.js               # Вход / регистрация
│   │   ├── ClientDetailPage.js       # Карточка клиента с вкладками
│   │   ├── ClientPortalPage.js       # Кабинет клиента
│   │   ├── ClientsPage.js            # Список клиентов
│   │   ├── DashboardPage.js          # Главный дашборд тренера
│   │   ├── PaymentsPage.js           # Страница оплат (все клиенты)
│   │   ├── SchedulePage.js           # Полный календарь
│   │   └── StatsPage.js              # Общая статистика
│   ├── styles/
│   │   └── global.css                # Дизайн-система (CSS переменные)
│   ├── types/
│   │   └── index.js                  # Константы и метки
│   ├── App.js                        # Роутинг
│   └── index.js                      # Точка входа
├── supabase_schema.sql               # SQL схема базы данных
├── .env.example                      # Пример переменных окружения
└── package.json
```

---

## Возможности

### Тренер
- ✅ Регистрация и авторизация
- ✅ Список клиентов с поиском и фильтрацией
- ✅ Карточка клиента: данные, цель, статус
- ✅ Тренировочные программы: дни → упражнения → подходы
- ✅ Расписание с полным календарём (день/неделя/месяц)
- ✅ Управление статусами тренировок (проведена/пропущена/отменена)
- ✅ Учёт оплат и пакетов тренировок
- ✅ Автоматическое списание тренировок при статусе "Проведена"
- ✅ Статистика тренировочного объёма
- ✅ Предупреждение о заканчивающихся тренировках
- ✅ Аналитика по всем клиентам с графиками

### Клиент
- ✅ Личный кабинет с просмотром программы
- ✅ Расписание тренировок
- ✅ Баланс оставшихся тренировок
- ✅ История посещений

---

## Деплой (Vercel)

```bash
npm install -g vercel
vercel
```

При деплое добавьте переменные окружения:
- `REACT_APP_SUPABASE_URL`
- `REACT_APP_SUPABASE_ANON_KEY`

---

## База данных

Схема включает:
- `profiles` — расширенные профили пользователей (Supabase Auth)
- `clients` — клиенты тренера
- `training_programs` — программы
- `workouts` — тренировочные дни
- `exercises` — упражнения
- `exercise_sets` — подходы (плановые)
- `schedule` — сессии в календаре
- `workout_logs` — фактические результаты
- `payments` — оплаты
- Views: `client_session_balance`, `session_volume`
- Триггеры: автосоздание профиля, автосписание тренировок
- Row Level Security на всех таблицах
