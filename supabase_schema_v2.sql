-- ============================================
-- НОВАЯ СХЕМА ТРЕНИРОВОЧНЫХ ПРОГРАММ
-- Выполни в Supabase SQL Editor
-- ============================================

-- Удаляем старые таблицы (каскадно)
DROP TABLE IF EXISTS workout_logs CASCADE;
DROP TABLE IF EXISTS exercise_sets CASCADE;
DROP TABLE IF EXISTS exercises CASCADE;
DROP TABLE IF EXISTS workouts CASCADE;
DROP TABLE IF EXISTS training_programs CASCADE;

-- ============================================
-- ПРОГРАММЫ
-- ============================================
CREATE TABLE training_programs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE NOT NULL,
  trainer_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  start_date DATE,
  end_date DATE,
  is_active BOOLEAN DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ТРЕНИРОВОЧНЫЕ ДНИ
-- ============================================
CREATE TABLE workouts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  program_id UUID REFERENCES training_programs(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,           -- "День 1 — Понедельник (Ноги)"
  day_of_week INTEGER CHECK (day_of_week BETWEEN 1 AND 7),
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- УПРАЖНЕНИЯ
-- ============================================
CREATE TABLE exercises (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  workout_id UUID REFERENCES workouts(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,           -- "Присед в Гаке глубокий"
  order_index INTEGER DEFAULT 0,
  trainer_comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ПОДХОДЫ (плановые)
-- Тип: warmup (разминка) / failure (отказ) / near_failure (около отказ)
-- ============================================
CREATE TABLE exercise_sets (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  exercise_id UUID REFERENCES exercises(id) ON DELETE CASCADE NOT NULL,
  set_type TEXT NOT NULL CHECK (set_type IN ('warmup', 'failure', 'near_failure')),
  -- Плановые данные (заданные тренером)
  planned_weight NUMERIC(6,2),
  planned_reps INTEGER,
  set_number INTEGER NOT NULL DEFAULT 1,
  order_index INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,   -- активный подход (текущий)
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ЛОГИ ТРЕНИРОВОК (фактические результаты)
-- Создаётся когда клиент проводит тренировку
-- ============================================
CREATE TABLE workout_sessions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  schedule_id UUID REFERENCES schedule(id) ON DELETE CASCADE,
  workout_id UUID REFERENCES workouts(id) ON DELETE SET NULL,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE NOT NULL,
  trainer_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  session_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- РЕЗУЛЬТАТЫ ПО ПОДХОДАМ (факт)
-- ============================================
CREATE TABLE set_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  session_id UUID REFERENCES workout_sessions(id) ON DELETE CASCADE NOT NULL,
  exercise_set_id UUID REFERENCES exercise_sets(id) ON DELETE CASCADE NOT NULL,
  exercise_id UUID REFERENCES exercises(id) ON DELETE CASCADE NOT NULL,
  -- Фактические данные (что сделал клиент)
  actual_weight NUMERIC(6,2),
  actual_reps INTEGER,
  is_completed BOOLEAN DEFAULT FALSE,
  -- Если клиент меняет вес — старый set_log остаётся, новый exercise_set создаётся
  logged_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- RLS
-- ============================================
ALTER TABLE training_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE workouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercise_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE set_logs ENABLE ROW LEVEL SECURITY;

-- Training programs
CREATE POLICY "Trainer manages programs" ON training_programs FOR ALL USING (trainer_id = auth.uid());
CREATE POLICY "Client views own programs" ON training_programs FOR SELECT
  USING (client_id IN (SELECT id FROM clients WHERE profile_id = auth.uid()));

-- Workouts
CREATE POLICY "Trainer manages workouts" ON workouts FOR ALL
  USING (program_id IN (SELECT id FROM training_programs WHERE trainer_id = auth.uid()));
CREATE POLICY "Client views workouts" ON workouts FOR SELECT
  USING (program_id IN (SELECT id FROM training_programs
    WHERE client_id IN (SELECT id FROM clients WHERE profile_id = auth.uid())));

-- Exercises
CREATE POLICY "Trainer manages exercises" ON exercises FOR ALL
  USING (workout_id IN (SELECT w.id FROM workouts w
    JOIN training_programs tp ON tp.id = w.program_id WHERE tp.trainer_id = auth.uid()));
CREATE POLICY "Client views exercises" ON exercises FOR SELECT
  USING (workout_id IN (SELECT w.id FROM workouts w
    JOIN training_programs tp ON tp.id = w.program_id
    WHERE tp.client_id IN (SELECT id FROM clients WHERE profile_id = auth.uid())));

-- Exercise sets
CREATE POLICY "Trainer manages sets" ON exercise_sets FOR ALL
  USING (exercise_id IN (SELECT e.id FROM exercises e
    JOIN workouts w ON w.id = e.workout_id
    JOIN training_programs tp ON tp.id = w.program_id WHERE tp.trainer_id = auth.uid()));
CREATE POLICY "Client views sets" ON exercise_sets FOR SELECT
  USING (exercise_id IN (SELECT e.id FROM exercises e
    JOIN workouts w ON w.id = e.workout_id
    JOIN training_programs tp ON tp.id = w.program_id
    WHERE tp.client_id IN (SELECT id FROM clients WHERE profile_id = auth.uid())));

-- Workout sessions
CREATE POLICY "Trainer manages sessions" ON workout_sessions FOR ALL USING (trainer_id = auth.uid());
CREATE POLICY "Client views own sessions" ON workout_sessions FOR SELECT
  USING (client_id IN (SELECT id FROM clients WHERE profile_id = auth.uid()));

-- Set logs
CREATE POLICY "Trainer views logs" ON set_logs FOR SELECT
  USING (session_id IN (SELECT id FROM workout_sessions WHERE trainer_id = auth.uid()));
CREATE POLICY "Client manages own logs" ON set_logs FOR ALL
  USING (session_id IN (SELECT id FROM workout_sessions
    WHERE client_id IN (SELECT id FROM clients WHERE profile_id = auth.uid())));

-- ============================================
-- VIEW: тренировочный объём
-- ============================================
CREATE OR REPLACE VIEW training_volume AS
SELECT
  ws.client_id,
  ws.trainer_id,
  ws.session_date,
  sl.exercise_id,
  e.name AS exercise_name,
  es.set_type,
  sl.actual_weight,
  sl.actual_reps,
  COALESCE(sl.actual_weight, 0) * COALESCE(sl.actual_reps, 0) AS volume
FROM set_logs sl
JOIN workout_sessions ws ON ws.id = sl.session_id
JOIN exercise_sets es ON es.id = sl.exercise_set_id
JOIN exercises e ON e.id = sl.exercise_id
WHERE sl.is_completed = TRUE;
