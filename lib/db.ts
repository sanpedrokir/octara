import { Pool } from 'pg';

let _pool: Pool | null = null;

export function getPool(): Pool {
  if (!_pool) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL environment variable is not set');
    _pool = new Pool({
      connectionString: url,
      // keepAlive prevents Neon from silently dropping idle TCP connections
      keepAlive: true,
      keepAliveInitialDelayMillis: 10000,
      idleTimeoutMillis: 240000, // close idle clients after 4 min (before Neon's 5-min sleep)
      max: 10,
    });
    _pool.on('error', () => {
      // Drop the pool so the next db() call gets a fresh one
      _pool = null;
    });
  }
  return _pool;
}

type SqlValue = string | number | boolean | null | string[] | number[];

function makeSql(pool: Pool) {
  return async function sql(
    strings: TemplateStringsArray,
    ...values: SqlValue[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): Promise<Record<string, any>[]> {
    let text = '';
    strings.forEach((s, i) => {
      text += s;
      if (i < values.length) text += `$${i + 1}`;
    });
    try {
      const result = await pool.query(text, values);
      return result.rows;
    } catch (err) {
      // If the connection died (Neon woke from sleep, stale TCP), reset and retry once
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('Connection') || msg.includes('connect') || msg.includes('ECONNRESET')) {
        _pool = null;
        const fresh = getPool();
        const result = await fresh.query(text, values);
        return result.rows;
      }
      throw err;
    }
  };
}

export function db() {
  return makeSql(getPool());
}

export const DB_SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id                SERIAL PRIMARY KEY,
  email             VARCHAR(255) UNIQUE NOT NULL,
  password_hash     VARCHAR(255) NOT NULL,
  name              VARCHAR(255) NOT NULL,
  role              VARCHAR(50)  NOT NULL DEFAULT 'learner',
  status            VARCHAR(20)  NOT NULL DEFAULT 'active',
  subscription_tier VARCHAR(20)  NOT NULL DEFAULT 'free',
  avatar_url        VARCHAR(500),
  email_verified    BOOLEAN      NOT NULL DEFAULT false,
  last_login        TIMESTAMP,
  created_at        TIMESTAMP    NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS industries (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(255) UNIQUE NOT NULL,
  description TEXT,
  created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS profiles (
  id                      SERIAL PRIMARY KEY,
  user_id                 INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  bio                     TEXT,
  phone                   VARCHAR(50),
  location                VARCHAR(255),
  linkedin_url            VARCHAR(500),
  resume_text             TEXT,
  nationality             VARCHAR(100),
  date_of_birth           DATE,
  skillsfuture_credit_bal DECIMAL(8,2),
  preferred_learning_mode VARCHAR(20),
  nric_fin_last4          VARCHAR(4),
  user_type               VARCHAR(30),
  UNIQUE(user_id)
);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS user_type VARCHAR(30);

CREATE TABLE IF NOT EXISTS education (
  id              SERIAL PRIMARY KEY,
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  institution     VARCHAR(255) NOT NULL,
  degree          VARCHAR(255),
  field_of_study  VARCHAR(255),
  start_year      INTEGER,
  end_year        INTEGER,
  is_current      BOOLEAN NOT NULL DEFAULT false,
  grade           VARCHAR(50),
  activities      TEXT,
  certificate_url TEXT
);

CREATE TABLE IF NOT EXISTS work_experience (
  id              SERIAL PRIMARY KEY,
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company         VARCHAR(255) NOT NULL,
  title           VARCHAR(255) NOT NULL,
  employment_type VARCHAR(30),
  work_location   VARCHAR(255),
  start_date      VARCHAR(20),
  end_date        VARCHAR(20),
  is_current      BOOLEAN NOT NULL DEFAULT false,
  description     TEXT,
  industry_id     INTEGER REFERENCES industries(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS job_roles (
  id                     SERIAL PRIMARY KEY,
  industry_id            INTEGER NOT NULL REFERENCES industries(id) ON DELETE CASCADE,
  name                   VARCHAR(255) NOT NULL,
  description            TEXT,
  skill_keywords         TEXT[],
  ssoc_code              VARCHAR(20),
  ssg_framework_track    VARCHAR(255),
  salary_min             INTEGER,
  salary_max             INTEGER,
  demand_level           VARCHAR(10),
  future_readiness_score SMALLINT,
  created_at             TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS skill_categories (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  color       VARCHAR(7)
);

CREATE TABLE IF NOT EXISTS certifications_catalogue (
  id             SERIAL PRIMARY KEY,
  name           VARCHAR(255) UNIQUE NOT NULL,
  issuing_body   VARCHAR(255),
  category       VARCHAR(100),
  validity_years SMALLINT,
  ssg_recognised BOOLEAN NOT NULL DEFAULT false,
  url            TEXT,
  created_at     TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS badges (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  icon        VARCHAR(10),
  criteria    TEXT,
  badge_type  VARCHAR(30),
  created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS career_aspirations (
  id              SERIAL PRIMARY KEY,
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  industry_id     INTEGER REFERENCES industries(id) ON DELETE SET NULL,
  job_role_id     INTEGER REFERENCES job_roles(id) ON DELETE SET NULL,
  target_timeline VARCHAR(20) NOT NULL DEFAULT '12months',
  notes           TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  priority        SMALLINT NOT NULL DEFAULT 1,
  created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);
CREATE INDEX IF NOT EXISTS idx_career_aspirations_user ON career_aspirations(user_id);

CREATE TABLE IF NOT EXISTS user_skills (
  id                  SERIAL PRIMARY KEY,
  user_id             INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  skill_name          VARCHAR(150) NOT NULL,
  category_id         INTEGER REFERENCES skill_categories(id) ON DELETE SET NULL,
  proficiency_level   VARCHAR(20) NOT NULL DEFAULT 'beginner',
  years_of_experience DECIMAL(4,1),
  is_verified         BOOLEAN NOT NULL DEFAULT false,
  source              VARCHAR(50),
  created_at          TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, skill_name)
);
CREATE INDEX IF NOT EXISTS idx_user_skills_user ON user_skills(user_id);

CREATE TABLE IF NOT EXISTS sector_scenario_questions (
  id             SERIAL PRIMARY KEY,
  sector         TEXT NOT NULL,
  question       TEXT NOT NULL,
  option_a       TEXT NOT NULL,
  option_b       TEXT NOT NULL,
  option_c       TEXT NOT NULL,
  option_d       TEXT NOT NULL,
  correct_answer TEXT NOT NULL,
  explanation    TEXT,
  difficulty     TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ssq_sector ON sector_scenario_questions(sector);

CREATE TABLE IF NOT EXISTS skill_quiz_results (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL,
  skill_name VARCHAR(255),
  score      INTEGER NOT NULL,
  total      INTEGER NOT NULL,
  passed     BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_quiz_results_user ON skill_quiz_results(user_id);

CREATE TABLE IF NOT EXISTS user_certifications (
  id              SERIAL PRIMARY KEY,
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  catalogue_id    INTEGER REFERENCES certifications_catalogue(id) ON DELETE SET NULL,
  custom_name     VARCHAR(255),
  issuing_body    VARCHAR(255),
  issued_date     DATE,
  expiry_date     DATE,
  credential_id   VARCHAR(255),
  certificate_url TEXT,
  status          VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tracked_courses (
  id                       SERIAL PRIMARY KEY,
  user_id                  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_reference_number  VARCHAR(255),
  course_title             VARCHAR(500) NOT NULL,
  provider_name            VARCHAR(255),
  course_url               TEXT,
  fee                      DECIMAL(10,2),
  skillsfuture_credit_used DECIMAL(8,2),
  mode_of_training         VARCHAR(30),
  status                   VARCHAR(20) NOT NULL DEFAULT 'in_progress',
  start_date               DATE,
  expected_end_date        DATE,
  actual_end_date          DATE,
  rating                   SMALLINT,
  notes                    TEXT,
  certificate_url          TEXT,
  completed_at             TIMESTAMP,
  created_at               TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tracked_courses_user ON tracked_courses(user_id);


CREATE TABLE IF NOT EXISTS employers (
  id           SERIAL PRIMARY KEY,
  user_id      INTEGER REFERENCES users(id) ON DELETE SET NULL,
  company_name VARCHAR(255) NOT NULL,
  industry_id  INTEGER REFERENCES industries(id) ON DELETE SET NULL,
  uen          VARCHAR(20) UNIQUE,
  website      TEXT,
  logo_url     TEXT,
  description  TEXT,
  company_size VARCHAR(20),
  is_verified  BOOLEAN NOT NULL DEFAULT false,
  status       VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at   TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS job_listings (
  id               SERIAL PRIMARY KEY,
  employer_id      INTEGER NOT NULL REFERENCES employers(id) ON DELETE CASCADE,
  job_role_id      INTEGER REFERENCES job_roles(id) ON DELETE SET NULL,
  title            VARCHAR(255) NOT NULL,
  description      TEXT,
  requirements     TEXT,
  employment_type  VARCHAR(30),
  location         VARCHAR(255),
  is_remote        BOOLEAN NOT NULL DEFAULT false,
  salary_min       INTEGER,
  salary_max       INTEGER,
  required_skills  TEXT[],
  experience_years SMALLINT,
  status           VARCHAR(20) NOT NULL DEFAULT 'open',
  expires_at       DATE,
  views_count      INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_job_listings_employer ON job_listings(employer_id);
CREATE INDEX IF NOT EXISTS idx_job_listings_status   ON job_listings(status);

CREATE TABLE IF NOT EXISTS internship_listings (
  id                   SERIAL PRIMARY KEY,
  employer_id          INTEGER NOT NULL REFERENCES employers(id) ON DELETE CASCADE,
  title                VARCHAR(255) NOT NULL,
  description          TEXT,
  industry_id          INTEGER REFERENCES industries(id) ON DELETE SET NULL,
  location             VARCHAR(255),
  is_remote            BOOLEAN NOT NULL DEFAULT false,
  stipend_monthly      INTEGER,
  duration_months      SMALLINT,
  required_skills      TEXT[],
  status               VARCHAR(20) NOT NULL DEFAULT 'open',
  application_deadline DATE,
  start_date           DATE,
  created_at           TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS job_applications (
  id             SERIAL PRIMARY KEY,
  user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  listing_id     INTEGER NOT NULL,
  listing_type   VARCHAR(15) NOT NULL,
  cover_letter   TEXT,
  resume_url     TEXT,
  status         VARCHAR(30) NOT NULL DEFAULT 'applied',
  employer_notes TEXT,
  applied_at     TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, listing_id, listing_type)
);
CREATE INDEX IF NOT EXISTS idx_applications_user ON job_applications(user_id);

CREATE TABLE IF NOT EXISTS coaches (
  id              SERIAL PRIMARY KEY,
  user_id         INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  specialisations TEXT[],
  industries      INTEGER[],
  bio             TEXT,
  hourly_rate_sgd DECIMAL(8,2),
  is_premium_only BOOLEAN NOT NULL DEFAULT false,
  rating_avg      DECIMAL(3,2) NOT NULL DEFAULT 0,
  sessions_count  INTEGER NOT NULL DEFAULT 0,
  is_approved     BOOLEAN NOT NULL DEFAULT false,
  approved_at     TIMESTAMP,
  created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS coaching_sessions (
  id             SERIAL PRIMARY KEY,
  learner_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  coach_id       INTEGER NOT NULL REFERENCES coaches(id) ON DELETE CASCADE,
  session_type   VARCHAR(30),
  scheduled_at   TIMESTAMP,
  duration_mins  SMALLINT NOT NULL DEFAULT 60,
  status         VARCHAR(20) NOT NULL DEFAULT 'pending',
  meeting_link   TEXT,
  notes          TEXT,
  learner_rating SMALLINT,
  learner_review TEXT,
  fee_sgd        DECIMAL(8,2),
  completed_at   TIMESTAMP,
  created_at     TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_coaching_sessions_learner ON coaching_sessions(learner_id);
CREATE INDEX IF NOT EXISTS idx_coaching_sessions_coach   ON coaching_sessions(coach_id);

CREATE TABLE IF NOT EXISTS user_badges (
  id        SERIAL PRIMARY KEY,
  user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  badge_id  INTEGER NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
  earned_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, badge_id)
);

CREATE TABLE IF NOT EXISTS notifications (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title      VARCHAR(255) NOT NULL,
  body       TEXT,
  type       VARCHAR(30),
  link       TEXT,
  is_read    BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read);

CREATE TABLE IF NOT EXISTS subscriptions (
  id                 SERIAL PRIMARY KEY,
  user_id            INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_name          VARCHAR(50) NOT NULL,
  status             VARCHAR(20) NOT NULL DEFAULT 'active',
  billing_cycle      VARCHAR(10),
  amount_sgd         DECIMAL(8,2),
  started_at         TIMESTAMP NOT NULL DEFAULT NOW(),
  expires_at         TIMESTAMP,
  stripe_customer_id VARCHAR(255),
  stripe_sub_id      VARCHAR(255),
  cancelled_at       TIMESTAMP,
  created_at         TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id);

CREATE TABLE IF NOT EXISTS user_activity_log (
  id          BIGSERIAL PRIMARY KEY,
  user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action      VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50),
  entity_id   INTEGER,
  metadata    JSONB,
  ip_address  INET,
  created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_activity_user    ON user_activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_created ON user_activity_log(created_at DESC);

DELETE FROM career_aspirations
  WHERE id NOT IN (
    SELECT MAX(id) FROM career_aspirations GROUP BY user_id
  );
ALTER TABLE career_aspirations DROP COLUMN IF EXISTS target_timeline;
ALTER TABLE tracked_courses ADD COLUMN IF NOT EXISTS skill_name VARCHAR(255);
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token      VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'career_aspirations_user_id_key'
      AND conrelid = 'career_aspirations'::regclass
  ) THEN
    ALTER TABLE career_aspirations ADD CONSTRAINT career_aspirations_user_id_key UNIQUE (user_id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS job_role_catalog (
  id                      SERIAL PRIMARY KEY,
  sector                  TEXT NOT NULL,
  track                   TEXT,
  job_role                TEXT NOT NULL,
  job_role_description    TEXT,
  performance_expectation TEXT,
  created_at              TIMESTAMP NOT NULL DEFAULT NOW()
);
ALTER TABLE job_role_catalog ALTER COLUMN sector TYPE TEXT;
ALTER TABLE job_role_catalog ALTER COLUMN track TYPE TEXT;
ALTER TABLE job_role_catalog ALTER COLUMN job_role TYPE TEXT;
CREATE INDEX IF NOT EXISTS idx_job_role_catalog_sector ON job_role_catalog(sector);

CREATE TABLE IF NOT EXISTS job_role_catalog_uploads (
  id            SERIAL PRIMARY KEY,
  filename      VARCHAR(255),
  row_count     INTEGER NOT NULL,
  skipped_count INTEGER NOT NULL DEFAULT 0,
  uploaded_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS jobs_skills_mapping (
  id                       SERIAL PRIMARY KEY,
  skill_code               TEXT,
  skill_title               TEXT NOT NULL,
  skill_desc                TEXT,
  skill_proficiency_level   TEXT,
  proficiency_level_desc    TEXT,
  previous_skill_title      TEXT,
  previous_skill_desc       TEXT,
  previous_sfs_status       TEXT,
  previous_casl_status      TEXT,
  previous_skill_type       TEXT,
  updated_skill_title       TEXT,
  updated_skill_desc        TEXT,
  updated_skill_sfs_status  TEXT,
  updated_casl_status       TEXT,
  updated_skill_type        TEXT,
  updated_sector_tagging    TEXT,
  created_at                TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_jobs_skills_mapping_sector ON jobs_skills_mapping(updated_sector_tagging);
CREATE INDEX IF NOT EXISTS idx_jobs_skills_mapping_code ON jobs_skills_mapping(skill_code);

CREATE TABLE IF NOT EXISTS jobs_skills_mapping_uploads (
  id            SERIAL PRIMARY KEY,
  filename      VARCHAR(255),
  row_count     INTEGER NOT NULL,
  skipped_count INTEGER NOT NULL DEFAULT 0,
  uploaded_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMP NOT NULL DEFAULT NOW()
);

ALTER TABLE career_aspirations ADD COLUMN IF NOT EXISTS catalog_job_role_id INTEGER REFERENCES job_role_catalog(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS job_role_cwf_kt (
  id                      SERIAL PRIMARY KEY,
  sector                  TEXT NOT NULL,
  track                   TEXT,
  job_role                TEXT NOT NULL,
  critical_work_function  TEXT NOT NULL,
  key_task                TEXT,
  created_at              TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_job_role_cwf_kt_lookup ON job_role_cwf_kt(sector, track, job_role);

CREATE TABLE IF NOT EXISTS job_role_tsc_ccs (
  id                 SERIAL PRIMARY KEY,
  sector             TEXT NOT NULL,
  track              TEXT,
  job_role           TEXT NOT NULL,
  skill_title        TEXT NOT NULL,
  skill_type         TEXT,
  proficiency_level  TEXT,
  skill_code         TEXT,
  created_at         TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_job_role_tsc_ccs_lookup ON job_role_tsc_ccs(sector, track, job_role);

CREATE TABLE IF NOT EXISTS course_recommendations (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  courses    JSONB NOT NULL DEFAULT '[]',
  youtube    JSONB NOT NULL DEFAULT '{}',
  mooc       JSONB NOT NULL DEFAULT '[]',
  sector     TEXT,
  role       TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE TABLE IF NOT EXISTS institutions (
  id         SERIAL PRIMARY KEY,
  name       VARCHAR(255) UNIQUE NOT NULL,
  slug       VARCHAR(100) UNIQUE,
  logo_url   TEXT,
  is_active  BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS institution_courses (
  id             SERIAL PRIMARY KEY,
  institution_id INTEGER NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  title          VARCHAR(500) NOT NULL,
  description    TEXT,
  url            TEXT,
  duration       VARCHAR(100),
  cost           VARCHAR(100),
  skills_covered TEXT[] NOT NULL DEFAULT '{}',
  is_active      BOOLEAN NOT NULL DEFAULT true,
  created_at     TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_inst_courses_institution ON institution_courses(institution_id);
CREATE INDEX IF NOT EXISTS idx_inst_courses_active ON institution_courses(institution_id, is_active);

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS institution_id INTEGER REFERENCES institutions(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS salary_cache (
  id         SERIAL PRIMARY KEY,
  role_key   VARCHAR(500) NOT NULL UNIQUE,
  data       JSONB NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
`;
