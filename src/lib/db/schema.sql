-- =====================================================================
-- StudyPlanner PostgreSQL Production Schema
-- Designed with AVG / GDPR Data Minimization (Article 5(1)(c) GDPR)
-- 
-- Explicitly excludes:
-- - Full names (names are optional pseudonyms or omitted)
-- - Physical addresses & school locations
-- - Student dates of birth / age
--
-- Only retains:
-- - id (UUIDv4)
-- - email (essential for authentication & notifications)
-- - created_at / updated_at
-- - subscription_status & Stripe billing references
-- - Pure academic schedule metadata (subjects, dates, session durations)
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. USERS TABLE
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    
    -- Subscription & Payment attributes
    is_pro BOOLEAN DEFAULT FALSE NOT NULL,
    subscription_status VARCHAR(50) DEFAULT 'free' NOT NULL CHECK (subscription_status IN ('free', 'active', 'past_due', 'canceled')),
    valid_until TIMESTAMPTZ DEFAULT NULL,
    stripe_customer_id VARCHAR(100) UNIQUE,
    stripe_subscription_id VARCHAR(100),

    -- Cryptographically secure public share token for read-only parent route
    share_token VARCHAR(64) UNIQUE,
    share_token_created_at TIMESTAMPTZ,

    -- Pacing preferences (metadata only, no personal tracking)
    daily_study_limit NUMERIC(3, 1) DEFAULT 4.0 CHECK (daily_study_limit BETWEEN 1.0 AND 12.0),
    soft_daily_limit NUMERIC(3, 1) DEFAULT 2.0 CHECK (soft_daily_limit BETWEEN 1.0 AND 12.0),
    session_duration_minutes INT DEFAULT 30 CHECK (session_duration_minutes BETWEEN 15 AND 120),
    academic_tier VARCHAR(50), -- e.g. 'vwo', 'havo' (no school or location name)
    
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Index for instant lookup on public parent share route
CREATE INDEX IF NOT EXISTS idx_users_share_token ON users(share_token) WHERE share_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_stripe_cust ON users(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;

-- 2. PARENT EMAIL SUBSCRIBERS TABLE
-- Stores consent-based parent emails for weekly progress updates
CREATE TABLE IF NOT EXISTS parent_subscribers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    parent_email VARCHAR(255) NOT NULL,
    subscribed_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    CONSTRAINT uq_user_parent_email UNIQUE (user_id, parent_email)
);

CREATE INDEX IF NOT EXISTS idx_parent_subscribers_user ON parent_subscribers(user_id);

-- 3. EXAMS TABLE (Schedule metadata)
CREATE TABLE IF NOT EXISTS exams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subject VARCHAR(120) NOT NULL,
    date TIMESTAMPTZ NOT NULL,
    color VARCHAR(20) DEFAULT '#9EC29A',
    is_completed BOOLEAN DEFAULT FALSE NOT NULL,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_exams_user_date ON exams(user_id, date);

-- 4. EXAM CHAPTERS / SYLLABUS TOPICS
CREATE TABLE IF NOT EXISTS exam_chapters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
    chapter_title VARCHAR(255) NOT NULL,
    difficulty INT DEFAULT 3 CHECK (difficulty BETWEEN 1 AND 5),
    confidence INT DEFAULT 3 CHECK (confidence BETWEEN 1 AND 5),
    estimated_hours NUMERIC(4, 2) DEFAULT 2.0,
    is_completed BOOLEAN DEFAULT FALSE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_exam_chapters_exam ON exam_chapters(exam_id);

-- 5. STUDY SESSIONS TABLE
CREATE TABLE IF NOT EXISTS study_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    exam_id UUID REFERENCES exams(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    short_title VARCHAR(120),
    subject VARCHAR(120) NOT NULL,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    is_completed BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_study_sessions_user_start ON study_sessions(user_id, start_time);
CREATE INDEX IF NOT EXISTS idx_study_sessions_exam ON study_sessions(exam_id);

-- 6. SESSION TASKS TABLE
CREATE TABLE IF NOT EXISTS session_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES study_sessions(id) ON DELETE CASCADE,
    task_text VARCHAR(255) NOT NULL,
    completed BOOLEAN DEFAULT FALSE NOT NULL,
    sort_order INT DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_session_tasks_session ON session_tasks(session_id);

-- 7. AUDIT & AI REQUEST LEDGER (Anonymized telemetry)
CREATE TABLE IF NOT EXISTS ai_request_ledger (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_ip_hash VARCHAR(64) NOT NULL, -- SHA-256 hashed IP for GDPR compliance
    endpoint VARCHAR(100) NOT NULL,
    model VARCHAR(50) NOT NULL,
    estimated_tokens INT NOT NULL,
    duration_ms INT NOT NULL,
    success BOOLEAN NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ai_ledger_created ON ai_request_ledger(created_at);
