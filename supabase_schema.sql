-- ============================================
-- TRAINER CRM — Supabase Schema
-- Run this in Supabase SQL Editor
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- USERS (handled by Supabase Auth)
-- Extended profile table
-- ============================================
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  role TEXT NOT NULL CHECK (role IN ('trainer', 'client')),
  full_name TEXT NOT NULL,
  avatar_url TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- CLIENTS
-- ============================================
CREATE TABLE clients (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  trainer_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  avatar_url TEXT,
  goal TEXT CHECK (goal IN ('weight_loss', 'muscle_gain', 'recomposition', 'competition')),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'pause', 'finished')),
  birth_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TRAINING PROGRAMS
-- ============================================
CREATE TABLE training_programs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE NOT NULL,
  trainer_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  start_date DATE,
  end_date DATE,
  sessions_per_week INTEGER DEFAULT 3,
  is_active BOOLEAN DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- WORKOUTS (days within a program)
-- ============================================
CREATE TABLE workouts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  program_id UUID REFERENCES training_programs(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL, -- e.g. "День A — Верх тела"
  day_of_week INTEGER CHECK (day_of_week BETWEEN 1 AND 7), -- 1=Mon, 7=Sun
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- EXERCISES
-- ============================================
CREATE TABLE exercises (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  workout_id UUID REFERENCES workouts(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  order_index INTEGER DEFAULT 0,
  trainer_comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- EXERCISE SETS (planned)
-- ============================================
CREATE TABLE exercise_sets (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  exercise_id UUID REFERENCES exercises(id) ON DELETE CASCADE NOT NULL,
  set_number INTEGER NOT NULL,
  planned_weight NUMERIC(6,2),
  planned_reps INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- SCHEDULE (calendar sessions)
-- ============================================
CREATE TABLE schedule (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE NOT NULL,
  trainer_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  workout_id UUID REFERENCES workouts(id) ON DELETE SET NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER DEFAULT 60,
  status TEXT DEFAULT 'planned' CHECK (status IN ('planned', 'completed', 'cancelled', 'missed')),
  client_comment TEXT,
  trainer_comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- WORKOUT LOGS (actual performance)
-- ============================================
CREATE TABLE workout_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  schedule_id UUID REFERENCES schedule(id) ON DELETE CASCADE NOT NULL,
  exercise_id UUID REFERENCES exercises(id) ON DELETE CASCADE NOT NULL,
  set_number INTEGER NOT NULL,
  actual_weight NUMERIC(6,2),
  actual_reps INTEGER,
  is_completed BOOLEAN DEFAULT FALSE,
  logged_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PAYMENTS
-- ============================================
CREATE TABLE payments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE NOT NULL,
  trainer_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  package_size INTEGER CHECK (package_size IN (4, 8, 12, 16)),
  sessions_used INTEGER DEFAULT 0,
  payment_date DATE NOT NULL,
  status TEXT DEFAULT 'paid' CHECK (status IN ('paid', 'pending', 'overdue')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- VIEWS
-- ============================================

-- Client sessions balance
CREATE VIEW client_session_balance AS
SELECT
  c.id AS client_id,
  c.full_name,
  COALESCE(SUM(p.package_size), 0) AS total_purchased,
  COALESCE(SUM(p.sessions_used), 0) AS total_used,
  COALESCE(SUM(p.package_size), 0) - COALESCE(SUM(p.sessions_used), 0) AS sessions_remaining
FROM clients c
LEFT JOIN payments p ON p.client_id = c.id AND p.status = 'paid'
GROUP BY c.id, c.full_name;

-- Training volume per session
CREATE VIEW session_volume AS
SELECT
  wl.schedule_id,
  SUM(wl.actual_weight * wl.actual_reps) AS total_volume,
  COUNT(*) FILTER (WHERE wl.is_completed) AS sets_completed,
  COUNT(*) AS sets_total
FROM workout_logs wl
WHERE wl.is_completed = TRUE
GROUP BY wl.schedule_id;

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE workouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercise_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Profiles: own row
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Clients: trainer sees own clients; client sees self
CREATE POLICY "Trainer sees own clients" ON clients FOR ALL USING (trainer_id = auth.uid());
CREATE POLICY "Client sees own record" ON clients FOR SELECT USING (profile_id = auth.uid());

-- Programs: trainer owns, client can view
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

-- Schedule
CREATE POLICY "Trainer manages schedule" ON schedule FOR ALL USING (trainer_id = auth.uid());
CREATE POLICY "Client views own schedule" ON schedule FOR SELECT
  USING (client_id IN (SELECT id FROM clients WHERE profile_id = auth.uid()));
CREATE POLICY "Client updates own session comment" ON schedule FOR UPDATE
  USING (client_id IN (SELECT id FROM clients WHERE profile_id = auth.uid()));

-- Workout logs
CREATE POLICY "Trainer views logs" ON workout_logs FOR SELECT
  USING (schedule_id IN (SELECT id FROM schedule WHERE trainer_id = auth.uid()));
CREATE POLICY "Client manages own logs" ON workout_logs FOR ALL
  USING (schedule_id IN (SELECT s.id FROM schedule s
    WHERE s.client_id IN (SELECT id FROM clients WHERE profile_id = auth.uid())));

-- Payments
CREATE POLICY "Trainer manages payments" ON payments FOR ALL USING (trainer_id = auth.uid());
CREATE POLICY "Client views own payments" ON payments FOR SELECT
  USING (client_id IN (SELECT id FROM clients WHERE profile_id = auth.uid()));

-- ============================================
-- FUNCTIONS & TRIGGERS
-- ============================================

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, role, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'role', 'client'),
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Auto-decrease sessions_used when session is marked completed
CREATE OR REPLACE FUNCTION decrement_sessions_on_complete()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    UPDATE payments
    SET sessions_used = sessions_used + 1
    WHERE id = (
      SELECT id FROM payments
      WHERE client_id = NEW.client_id
        AND status = 'paid'
        AND sessions_used < package_size
      ORDER BY created_at ASC
      LIMIT 1
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_session_completed
  AFTER UPDATE ON schedule
  FOR EACH ROW EXECUTE FUNCTION decrement_sessions_on_complete();

-- Update clients.updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER clients_updated_at
  BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
