// ─── Auth ────────────────────────────────────────────────
export interface JwtPayload {
  userId: number;
  email: string;
  role: string;
}

export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
}

// ─── Users ───────────────────────────────────────────────
export interface User {
  id: number;
  email: string;
  name: string;
  role: 'learner' | 'admin' | 'coach' | 'employer';
  status: 'active' | 'suspended' | 'deleted';
  subscription_tier: 'free' | 'premium' | 'enterprise';
  avatar_url: string | null;
  email_verified: boolean;
  last_login: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Profiles ────────────────────────────────────────────
export interface Profile {
  id: number;
  user_id: number;
  bio: string | null;
  phone: string | null;
  location: string | null;
  linkedin_url: string | null;
  resume_text: string | null;
  nationality: string | null;
  date_of_birth: string | null;
  skillsfuture_credit_bal: number | null;
  preferred_learning_mode: 'classroom' | 'online' | 'hybrid' | null;
  nric_fin_last4: string | null;
}

// ─── Education ───────────────────────────────────────────
export interface Education {
  id: number;
  user_id: number;
  institution: string;
  degree: string | null;
  field_of_study: string | null;
  start_year: number | null;
  end_year: number | null;
  is_current: boolean;
  grade: string | null;
  activities: string | null;
  certificate_url: string | null;
}

// ─── Work Experience ─────────────────────────────────────
export interface WorkExperience {
  id: number;
  user_id: number;
  company: string;
  title: string;
  employment_type: 'full-time' | 'part-time' | 'contract' | 'freelance' | null;
  work_location: string | null;
  start_date: string | null;
  end_date: string | null;
  is_current: boolean;
  description: string | null;
  industry_id: number | null;
}

// ─── Industries & Job Roles ──────────────────────────────
export interface Industry {
  id: number;
  name: string;
  description: string | null;
  created_at: string;
}

export interface JobRole {
  id: number;
  industry_id: number;
  name: string;
  description: string | null;
  skill_keywords: string[] | null;
  ssoc_code: string | null;
  ssg_framework_track: string | null;
  salary_min: number | null;
  salary_max: number | null;
  demand_level: 'high' | 'medium' | 'low' | null;
  future_readiness_score: number | null;
  created_at: string;
}

// ─── Skills ──────────────────────────────────────────────
export interface SkillCategory {
  id: number;
  name: string;
  description: string | null;
  color: string | null;
}

export interface UserSkill {
  id: number;
  user_id: number;
  skill_name: string;
  category_id: number | null;
  proficiency_level: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  years_of_experience: number | null;
  is_verified: boolean;
  source: 'self' | 'ai_analysis' | 'assessment' | 'certification' | null;
  created_at: string;
  updated_at: string;
}

export interface SkillAssessment {
  id: number;
  user_id: number;
  assessment_type: 'ai' | 'self' | 'external';
  current_job_title: string | null;
  target_role: string | null;
  target_industry: string | null;
  skill_gaps: SkillGap[] | null;
  strengths: string[] | null;
  summary: string | null;
  ai_model_used: string | null;
  created_at: string;
}

export interface SkillGap {
  skill: string;
  priority: 'high' | 'medium' | 'low';
  reason: string;
}

// ─── Certifications ──────────────────────────────────────
export interface CertificationCatalogue {
  id: number;
  name: string;
  issuing_body: string | null;
  category: string | null;
  validity_years: number | null;
  ssg_recognised: boolean;
  url: string | null;
  created_at: string;
}

export interface UserCertification {
  id: number;
  user_id: number;
  catalogue_id: number | null;
  custom_name: string | null;
  issuing_body: string | null;
  issued_date: string | null;
  expiry_date: string | null;
  credential_id: string | null;
  certificate_url: string | null;
  status: 'active' | 'expired' | 'in_progress';
  created_at: string;
}

// ─── Career ──────────────────────────────────────────────
export interface CareerAspiration {
  id: number;
  user_id: number;
  industry_id: number | null;
  job_role_id: number | null;
  catalog_job_role_id: number | null;
  notes: string | null;
  is_active: boolean;
  priority: number;
  created_at: string;
  updated_at: string;
  industry_name?: string;
  job_role_name?: string;
  catalog_track?: string | null;
}

// ─── Courses & Learning ──────────────────────────────────
export interface TrackedCourse {
  id: number;
  user_id: number;
  course_reference_number: string | null;
  course_title: string;
  provider_name: string | null;
  course_url: string | null;
  fee: number | null;
  skill_name: string | null;
  skillsfuture_credit_used: number | null;
  mode_of_training: 'classroom' | 'e-learning' | 'blended' | null;
  status: 'in_progress' | 'completed';
  start_date: string | null;
  expected_end_date: string | null;
  actual_end_date: string | null;
  rating: number | null;
  notes: string | null;
  certificate_url: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface LearningRoadmap {
  id: number;
  user_id: number;
  title: string | null;
  roadmap_data: RoadmapData;
  skill_gaps: SkillGap[];
  status: 'active' | 'paused' | 'completed' | 'archived';
  progress_percentage: number;
  created_at: string;
  updated_at: string;
}

export interface LearningMilestone {
  id: number;
  roadmap_id: number;
  user_id: number;
  month_number: number;
  title: string;
  description: string | null;
  status: 'pending' | 'in_progress' | 'completed';
  target_date: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface RoadmapMonth {
  month: number;
  label: string;
  skills: string[];
  courses: SsgCourse[];
  milestone: string;
}

export interface RoadmapData {
  summary: string;
  months: RoadmapMonth[];
  current_strengths: string[];
  target_role: string;
  target_industry: string;
}

// ─── SSG / SkillsFuture ──────────────────────────────────
export interface SsgCourse {
  referenceNumber: string;
  title: string;
  providerName: string;
  totalCostOfTrainingPerTrainee: number;
  subsidisedFee?: number;
  url?: string;
  category?: string;
  modeOfTraining?: string;
  duration?: string;
  skillsFrameworkSkillCode?: string;
}

// ─── Employers & Jobs ────────────────────────────────────
export interface Employer {
  id: number;
  user_id: number | null;
  company_name: string;
  industry_id: number | null;
  uen: string | null;
  website: string | null;
  logo_url: string | null;
  description: string | null;
  company_size: 'startup' | 'sme' | 'large' | 'mnc' | null;
  is_verified: boolean;
  status: 'active' | 'inactive';
  created_at: string;
}

export interface JobListing {
  id: number;
  employer_id: number;
  job_role_id: number | null;
  title: string;
  description: string | null;
  requirements: string | null;
  employment_type: 'full-time' | 'part-time' | 'contract' | null;
  location: string | null;
  is_remote: boolean;
  salary_min: number | null;
  salary_max: number | null;
  required_skills: string[] | null;
  experience_years: number | null;
  status: 'open' | 'closed' | 'filled';
  expires_at: string | null;
  views_count: number;
  created_at: string;
  updated_at: string;
  company_name?: string;
}

export interface InternshipListing {
  id: number;
  employer_id: number;
  title: string;
  description: string | null;
  industry_id: number | null;
  location: string | null;
  is_remote: boolean;
  stipend_monthly: number | null;
  duration_months: number | null;
  required_skills: string[] | null;
  status: 'open' | 'closed';
  application_deadline: string | null;
  start_date: string | null;
  created_at: string;
  company_name?: string;
}

export interface JobApplication {
  id: number;
  user_id: number;
  listing_id: number;
  listing_type: 'job' | 'internship';
  cover_letter: string | null;
  resume_url: string | null;
  status: 'applied' | 'shortlisted' | 'interviewed' | 'offered' | 'rejected' | 'withdrawn';
  employer_notes: string | null;
  applied_at: string;
  updated_at: string;
}

// ─── Coaching ────────────────────────────────────────────
export interface Coach {
  id: number;
  user_id: number;
  specialisations: string[] | null;
  industries: number[] | null;
  bio: string | null;
  hourly_rate_sgd: number | null;
  is_premium_only: boolean;
  rating_avg: number;
  sessions_count: number;
  is_approved: boolean;
  approved_at: string | null;
  created_at: string;
  name?: string;
  avatar_url?: string | null;
}

export interface CoachingSession {
  id: number;
  learner_id: number;
  coach_id: number;
  session_type: string | null;
  scheduled_at: string | null;
  duration_mins: number;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';
  meeting_link: string | null;
  notes: string | null;
  learner_rating: number | null;
  learner_review: string | null;
  fee_sgd: number | null;
  completed_at: string | null;
  created_at: string;
}

// ─── Gamification ────────────────────────────────────────
export interface Badge {
  id: number;
  name: string;
  description: string | null;
  icon: string | null;
  criteria: string | null;
  badge_type: 'milestone' | 'streak' | 'skill' | 'engagement' | null;
  created_at: string;
}

export interface UserBadge {
  id: number;
  user_id: number;
  badge_id: number;
  earned_at: string;
  badge?: Badge;
}

// ─── Notifications ───────────────────────────────────────
export interface Notification {
  id: number;
  user_id: number;
  title: string;
  body: string | null;
  type: 'course_reminder' | 'badge_earned' | 'job_match' | 'coach_session' | 'system' | null;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

// ─── Subscriptions ───────────────────────────────────────
export interface Subscription {
  id: number;
  user_id: number;
  plan_name: 'free' | 'premium' | 'enterprise';
  status: 'active' | 'cancelled' | 'expired' | 'trial';
  billing_cycle: 'monthly' | 'annual' | null;
  amount_sgd: number | null;
  started_at: string;
  expires_at: string | null;
  stripe_customer_id: string | null;
  stripe_sub_id: string | null;
  cancelled_at: string | null;
  created_at: string;
}
