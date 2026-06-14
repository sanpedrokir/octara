import OpenAI from 'openai';
import type { SkillGap, RoadmapData, SsgCourse } from './types';

function getClient() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  return new OpenAI({ apiKey: key });
}

export async function analyzeSkillGaps(
  currentRole: string,
  currentSkills: string[],
  targetRole: string,
  targetIndustry: string,
  yearsExperience: number,
  resumeText?: string,
  studyProgram?: string
): Promise<{ skill_gaps: SkillGap[]; current_strengths: string[]; summary: string }> {
  const client = getClient();

  if (!client) {
    return getMockSkillAnalysis(currentRole, targetRole, targetIndustry, currentSkills);
  }

  const isStudent = currentRole.toLowerCase() === 'student';

  let contextBlock: string;
  if (isStudent) {
    const programLine = studyProgram ? `Academic Background: ${studyProgram}` : 'Academic Background: Not specified';
    const internshipLine = resumeText ? `Internship / Relevant Experience: ${resumeText.slice(0, 500)}` : '';
    contextBlock = `Persona: Student (preparing for first career entry)\n${programLine}${internshipLine ? '\n' + internshipLine : ''}`;
  } else {
    contextBlock = `Persona: Working Professional\nCurrent Role: ${currentRole}\nYears of Experience: ${yearsExperience}${resumeText ? `\nAdditional Context: ${resumeText.slice(0, 500)}` : ''}`;
  }

  const prompt = `You are a Singapore career advisor with deep knowledge of the Skills Framework for ICT, Finance, Legal, Healthcare, and other Singapore industries.

Perform a precise skill gap analysis for this person:

--- PERSON PROFILE ---
${contextBlock}
Current Skills (self-assessed): ${currentSkills.join(', ') || 'None listed'}

--- TARGET ---
Role: ${targetRole}
Industry: ${targetIndustry}

--- INSTRUCTIONS ---
1. Identify the SPECIFIC technical and professional skills required for ${targetRole} in Singapore's ${targetIndustry} sector.
2. Cross-reference with the person's academic background and current skills. A Finance student targeting a Legal role has VERY different gaps than a Law student targeting the same role.
3. For students: factor in what their academic program already covers vs what the job market expects beyond academia.
4. For each skill listed as "Beginner", treat it as a gap if the role requires Intermediate or above.
5. Be precise — name specific tools, frameworks, methodologies (e.g. "SkillsFuture Framework Mapping", "Bloomberg Terminal", "Westlaw", "Python for Finance") not vague categories.
6. Limit to exactly 6–8 skill gaps. Prioritise ruthlessly.

Return ONLY valid JSON:
{
  "skill_gaps": [
    { "skill": "specific skill name", "priority": "high|medium|low", "reason": "one sentence — why this specific gap matters for this specific role" }
  ],
  "current_strengths": ["strength directly relevant to the target role"],
  "summary": "2–3 sentences personalised to this person's background and target"
}`;

  try {
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      max_tokens: 1500,
    });

    const content = response.choices[0]?.message?.content || '{}';
    return JSON.parse(content);
  } catch (e) {
    console.error('[OpenAI analyzeSkillGaps] API call failed:', e instanceof Error ? e.message : e);
    return getMockSkillAnalysis(currentRole, targetRole, targetIndustry, currentSkills);
  }
}

export async function generateRoadmap(
  skillGaps: SkillGap[],
  coursesBySkill: Record<string, SsgCourse[]>,
  targetRole: string,
  targetIndustry: string
): Promise<RoadmapData> {
  const client = getClient();

  if (!client) {
    return getMockRoadmap(skillGaps, coursesBySkill, targetRole, targetIndustry);
  }

  const highSkills = skillGaps.filter(g => g.priority === 'high').map(g => g.skill);
  const medSkills = skillGaps.filter(g => g.priority === 'medium').map(g => g.skill);
  const lowSkills = skillGaps.filter(g => g.priority === 'low').map(g => g.skill);

  const prompt = `You are a Singapore career coach building a personalised learning roadmap.

Target Role: ${targetRole} in ${targetIndustry}
High Priority Skill Gaps: ${highSkills.join(', ') || 'none'}
Medium Priority Skill Gaps: ${medSkills.join(', ') || 'none'}
Lower Priority Skill Gaps: ${lowSkills.join(', ') || 'none'}

Available SkillsFuture Courses:
${Object.entries(coursesBySkill).slice(0, 6).map(([skill, courses]) =>
  `${skill}: ${courses.slice(0, 2).map(c => c.title).join(', ')}`
).join('\n')}

Create a phased learning roadmap grouped by priority (not by fixed months). Return ONLY valid JSON:
{
  "summary": "2-3 sentence personalised roadmap overview",
  "months": [
    {
      "month": 1,
      "label": "Phase 1: Core Foundations",
      "skills": ["skill1", "skill2"],
      "milestone": "what the learner can do after this phase"
    },
    {
      "month": 2,
      "label": "Phase 2: Build Competency",
      "skills": ["skill3", "skill4"],
      "milestone": "..."
    },
    {
      "month": 3,
      "label": "Phase 3: Advanced & Applied",
      "skills": ["skill5", "skill6"],
      "milestone": "..."
    }
  ],
  "current_strengths": ["strength"],
  "target_role": "${targetRole}",
  "target_industry": "${targetIndustry}"
}

Use exactly 3 phases. Assign high-priority gaps to Phase 1, medium to Phase 2, low to Phase 3.`;

  try {
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      max_tokens: 2000,
    });

    const content = response.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(content);

    // Attach courses to each month
    if (parsed.months) {
      parsed.months = parsed.months.map((m: { month: number; label: string; skills: string[]; milestone: string }) => ({
        ...m,
        courses: m.skills.flatMap((skill: string) =>
          (coursesBySkill[skill] || []).slice(0, 2)
        ).slice(0, 3),
      }));
    }

    return parsed;
  } catch {
    return getMockRoadmap(skillGaps, coursesBySkill, targetRole, targetIndustry);
  }
}

function getMockSkillAnalysis(currentRole: string, targetRole: string, targetIndustry: string, currentSkills: string[]) {
  const industry = targetIndustry.toLowerCase();
  const role = targetRole.toLowerCase();

  // Industry-specific skill sets — fallback when AI is unavailable
  const industrySkillMap: Record<string, string[]> = {
    legal: ['Legal Research & Analysis', 'Contract Drafting', 'Westlaw / LexisNexis', 'Regulatory Compliance', 'Legal Writing', 'Case Management'],
    finance: ['Financial Modelling', 'Bloomberg Terminal', 'Risk Management', 'Regulatory Reporting (MAS)', 'Data Analytics for Finance', 'CFA Fundamentals'],
    healthcare: ['Clinical Documentation', 'Healthcare Regulations (MOH)', 'Patient Data Management', 'Medical Terminology', 'Healthcare Analytics', 'Quality Assurance'],
    accounting: ['IFRS / FRS Accounting Standards', 'Audit Methodology', 'Tax Compliance (IRAS)', 'Financial Reporting', 'ERP Systems (SAP)', 'Data Analytics'],
    'human resources': ['Talent Acquisition', 'HR Analytics', 'Employment Act (Singapore)', 'Performance Management', 'Learning & Development', 'HRIS Systems'],
    marketing: ['Digital Marketing Strategy', 'SEO / SEM', 'Marketing Analytics', 'Content Strategy', 'Social Media Marketing', 'CRM Platforms'],
    logistics: ['Supply Chain Management', 'Warehouse Management Systems', 'Trade Compliance', 'Last-Mile Logistics', 'ERP Systems', 'Inventory Optimisation'],
    hospitality: ['Guest Experience Management', 'Revenue Management', 'Food & Beverage Operations', 'Property Management Systems', 'Service Excellence', 'Event Management'],
    education: ['Curriculum Design', 'Instructional Technology', 'Student Assessment', 'Differentiated Learning', 'Classroom Management', 'EdTech Platforms'],
    healthcare_life_sciences: ['GMP Compliance', 'Bioprocess Technology', 'Regulatory Affairs (HSA)', 'Quality Management Systems', 'Clinical Research', 'Lab Techniques'],
    media: ['Content Production', 'Video Editing', 'Copywriting', 'Audience Analytics', 'Social Media Strategy', 'Adobe Creative Suite'],
    retail: ['Retail Operations', 'Inventory Management', 'Customer Experience', 'E-commerce Platforms', 'Visual Merchandising', 'Retail Analytics'],
    ict: ['Python / Java', 'Cloud Architecture (AWS/Azure)', 'Cybersecurity Fundamentals', 'DevOps / CI-CD', 'AI/ML Concepts', 'Agile / Scrum'],
    engineering: ['AutoCAD / BIM', 'Project Management', 'Quality Control', 'Safety Management', 'Structural Analysis', 'Technical Documentation'],
    construction: ['BIM (Building Information Modelling)', 'Construction Project Management', 'WSH (Workplace Safety)', 'Cost Estimation', 'Contract Administration', 'Green Building Standards'],
  };

  // Match industry key
  const matchedKey = Object.keys(industrySkillMap).find(k =>
    industry.includes(k) || k.includes(industry.split(' ')[0])
  );

  // Role-specific overrides for common roles
  const roleSkillMap: Record<string, string[]> = {
    'legal research associate': ['Legal Research & Analysis', 'Westlaw / LexisNexis', 'Case Summarisation', 'Legal Writing', 'Regulatory Compliance', 'Contract Review'],
    'paralegal': ['Legal Documentation', 'Case Management Software', 'Legal Research', 'Contract Drafting Support', 'Court Filing Procedures', 'Client Communication'],
    'lawyer': ['Legal Research & Analysis', 'Advocacy & Litigation', 'Contract Negotiation', 'Westlaw / LexisNexis', 'Legal Writing', 'Regulatory Compliance'],
    'financial analyst': ['Financial Modelling', 'Bloomberg Terminal', 'Equity Research', 'Valuation Techniques', 'Data Analytics', 'MAS Regulatory Framework'],
    'software engineer': ['Python / Java', 'Cloud Architecture', 'System Design', 'DevOps / CI-CD', 'API Development', 'Agile Methodology'],
    'data analyst': ['SQL & Data Querying', 'Python for Data Analysis', 'Power BI / Tableau', 'Statistical Analysis', 'Data Storytelling', 'Machine Learning Basics'],
    'hr manager': ['Talent Management', 'Employment Act Compliance', 'HR Analytics', 'Compensation & Benefits', 'Organisational Development', 'HRIS Platforms'],
    'accountant': ['IFRS / FRS Standards', 'Tax Compliance (IRAS)', 'Financial Reporting', 'Audit Procedures', 'ERP Systems', 'Excel / Power BI'],
    'marketing manager': ['Digital Marketing Strategy', 'Marketing Analytics', 'Brand Management', 'SEO / SEM', 'CRM Platforms', 'Campaign Management'],
    'nurse': ['Clinical Assessment', 'Patient Safety Protocols', 'EMR / EHR Systems', 'Medication Administration', 'Healthcare Communication', 'Infection Control'],
  };

  const targetSkills =
    roleSkillMap[role] ||
    (matchedKey ? industrySkillMap[matchedKey] : null) ||
    ['Professional Communication', 'Critical Thinking', 'Digital Literacy', 'Project Management', 'Data Analysis', 'Stakeholder Management'];

  const gaps = targetSkills
    .filter(s => !currentSkills.map(c => c.toLowerCase()).includes(s.toLowerCase()))
    .slice(0, 6)
    .map((skill, i) => ({
      skill,
      priority: (i < 2 ? 'high' : i < 4 ? 'medium' : 'low') as 'high' | 'medium' | 'low',
      reason: `Core requirement for ${targetRole} in Singapore's ${targetIndustry} sector`,
    }));

  return {
    skill_gaps: gaps,
    current_strengths: currentSkills.slice(0, 3),
    summary: `To become a ${targetRole} in ${targetIndustry}, you need to build ${gaps.length} key competencies specific to this role. Note: connect a valid OpenAI API key for a personalised AI analysis based on your exact background.`,
  };
}

function getMockRoadmap(
  skillGaps: SkillGap[],
  coursesBySkill: Record<string, SsgCourse[]>,
  targetRole: string,
  targetIndustry: string
): RoadmapData {
  const highPriority = skillGaps.filter(g => g.priority === 'high');
  const medPriority  = skillGaps.filter(g => g.priority === 'medium');
  const lowPriority  = skillGaps.filter(g => g.priority === 'low');

  return {
    summary: `Your personalised roadmap to become a ${targetRole} in ${targetIndustry}. Work through the three phases in order — foundations first, then build competency, then apply advanced skills.`,
    months: [
      {
        month: 1,
        label: 'Phase 1: Core Foundations',
        skills: highPriority.map(g => g.skill),
        courses: highPriority.flatMap(g => (coursesBySkill[g.skill] || []).slice(0, 1)),
        milestone: 'Complete all high-priority skill courses and earn at least one certification',
      },
      {
        month: 2,
        label: 'Phase 2: Build Competency',
        skills: medPriority.map(g => g.skill),
        courses: medPriority.flatMap(g => (coursesBySkill[g.skill] || []).slice(0, 1)),
        milestone: 'Apply skills in projects or internship and add to portfolio',
      },
      {
        month: 3,
        label: 'Phase 3: Advanced & Applied',
        skills: lowPriority.map(g => g.skill),
        courses: lowPriority.flatMap(g => (coursesBySkill[g.skill] || []).slice(0, 1)),
        milestone: 'Ready to apply for target role with full skill set demonstrated',
      },
    ],
    current_strengths: [],
    target_role: targetRole,
    target_industry: targetIndustry,
  };
}
