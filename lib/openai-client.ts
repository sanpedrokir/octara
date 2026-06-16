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
    // ICT
    'information': ['Python / Java', 'Cloud Architecture (AWS/Azure)', 'Cybersecurity Fundamentals', 'DevOps / CI-CD', 'AI/ML Concepts', 'Agile / Scrum'],
    // Finance
    'finance': ['Financial Modelling', 'Bloomberg Terminal', 'Risk Management', 'Regulatory Reporting (MAS)', 'Data Analytics for Finance', 'CFA Fundamentals'],
    'banking': ['Financial Modelling', 'Bloomberg Terminal', 'Risk Management', 'MAS Regulatory Framework', 'Credit Analysis', 'AML Compliance'],
    'insurance': ['Actuarial Analysis', 'Underwriting', 'Risk Assessment', 'Insurance Regulations (MAS)', 'Claims Management', 'Financial Modelling'],
    // Legal
    'legal': ['Legal Research & Analysis', 'Contract Drafting', 'Westlaw / LexisNexis', 'Regulatory Compliance', 'Legal Writing', 'Case Management'],
    // Healthcare
    'healthcare': ['Clinical Documentation', 'Healthcare Regulations (MOH)', 'Patient Data Management', 'Medical Terminology', 'Healthcare Analytics', 'Quality Assurance'],
    'biopharmaceutical': ['GMP Compliance', 'Bioprocess Technology', 'Regulatory Affairs (HSA)', 'Quality Management Systems', 'Clinical Research', 'Lab Techniques'],
    // Accountancy
    'accountancy': ['IFRS / FRS Accounting Standards', 'Audit Methodology', 'Tax Compliance (IRAS)', 'Financial Reporting', 'ERP Systems (SAP)', 'Data Analytics'],
    'accounting': ['IFRS / FRS Accounting Standards', 'Audit Methodology', 'Tax Compliance (IRAS)', 'Financial Reporting', 'ERP Systems (SAP)', 'Data Analytics'],
    // HR
    'human resource': ['Talent Acquisition', 'HR Analytics', 'Employment Act (Singapore)', 'Performance Management', 'Learning & Development', 'HRIS Systems'],
    // Marketing
    'marketing': ['Digital Marketing Strategy', 'SEO / SEM', 'Marketing Analytics', 'Content Strategy', 'Social Media Marketing', 'CRM Platforms'],
    // Logistics
    'logistics': ['Supply Chain Management', 'Warehouse Management Systems', 'Trade Compliance', 'Last-Mile Logistics', 'ERP Systems', 'Inventory Optimisation'],
    'wholesale': ['Trade Finance', 'Commodity Trading', 'Supply Chain Management', 'Contract Negotiation', 'Import/Export Regulations', 'Market Analysis'],
    // Hospitality & Tourism
    'hospitality': ['Guest Experience Management', 'Revenue Management', 'Food & Beverage Operations', 'Property Management Systems', 'Service Excellence', 'Event Management'],
    'hotel': ['Property Management Systems (PMS)', 'Revenue Management', 'Guest Relations', 'Housekeeping Operations', 'F&B Management', 'Front Office Operations'],
    'tourism': ['Destination Marketing', 'Tour Operations', 'MICE Management', 'Customer Experience', 'Travel Technology', 'Sustainable Tourism'],
    // Aviation & Transport
    'air transport': ['Aviation Revenue Management', 'Airline Pricing Strategy', 'Demand Forecasting & Optimisation', 'GDS / Amadeus / Sabre', 'IATA Regulations', 'Data Analytics for Aviation', 'Yield Management', 'Commercial Aviation Finance'],
    'aerospace': ['Aircraft Maintenance', 'Aviation Safety Standards (CAAS)', 'Avionics Systems', 'Quality Assurance (AS9100)', 'Technical Documentation', 'Engineering Analysis'],
    'sea transport': ['Maritime Regulations (MPA)', 'Vessel Operations', 'Port Management', 'Marine Engineering', 'Cargo Operations', 'Ship Management'],
    'public transport': ['Transport Operations', 'Safety Management Systems', 'Fleet Maintenance', 'Passenger Experience', 'Transport Planning', 'Regulatory Compliance (LTA)'],
    'transport': ['Transport Operations Management', 'Logistics Planning', 'Fleet Management', 'Transport Regulations', 'Safety Management', 'Stakeholder Management'],
    // Education
    'education': ['Curriculum Design', 'Instructional Technology', 'Student Assessment', 'Differentiated Learning', 'Classroom Management', 'EdTech Platforms'],
    'early childhood': ['Child Development', 'Early Childhood Curriculum', 'Classroom Management', 'Parent Engagement', 'ECDA Regulations', 'Inclusive Education'],
    'training': ['Instructional Design', 'Adult Learning Principles', 'Training Needs Analysis', 'SkillsFuture Framework', 'Facilitation Skills', 'E-Learning Development'],
    // Engineering
    'engineering': ['AutoCAD / BIM', 'Project Management', 'Quality Control', 'Safety Management (WSH)', 'Structural Analysis', 'Technical Documentation'],
    'precision': ['CNC Machining', 'CAD/CAM', 'Metrology', 'Quality Control (ISO 9001)', 'Automation', 'Lean Manufacturing'],
    'electronics': ['PCB Design', 'Embedded Systems', 'Hardware Engineering', 'Quality Management', 'Semiconductor Processes', 'Testing & Measurement'],
    'marine': ['Naval Architecture', 'Marine Engineering', 'Offshore Structures', 'HSE Management', 'Classification Standards', 'Project Management'],
    // Construction
    'construction': ['BIM (Building Information Modelling)', 'Construction Project Management', 'WSH (Workplace Safety)', 'Cost Estimation', 'Contract Administration', 'Green Building Standards'],
    'built environment': ['BIM (Building Information Modelling)', 'Construction Project Management', 'WSH (Workplace Safety)', 'Cost Estimation', 'Contract Administration', 'Green Building Standards'],
    // Energy
    'energy': ['Energy Management', 'Renewable Energy Systems', 'Power Systems Engineering', 'HSE Management', 'Regulatory Compliance (EMA)', 'Data Analytics'],
    // Environmental
    'environmental': ['Environmental Compliance', 'Sustainability Reporting (GRI/ESG)', 'Carbon Management', 'Waste Management', 'Environmental Impact Assessment', 'Green Procurement'],
    // Media & Design
    'media': ['Content Production', 'Video Editing', 'Copywriting', 'Audience Analytics', 'Social Media Strategy', 'Adobe Creative Suite'],
    'design': ['Adobe Creative Suite', 'UX/UI Design', 'Design Thinking', 'Prototyping', 'Brand Identity', 'Typography'],
    'arts': ['Project Management', 'Arts Programming', 'Audience Development', 'Grant Writing', 'Community Engagement', 'Digital Content Creation'],
    // Retail
    'retail': ['Retail Operations', 'Inventory Management', 'Customer Experience', 'E-commerce Platforms', 'Visual Merchandising', 'Retail Analytics'],
    // Food
    'food': ['Food Safety (HACCP)', 'Food Technology', 'Quality Control', 'Regulatory Compliance (SFA)', 'Supply Chain Management', 'R&D'],
    // Government & Public Services
    'government': ['Policy Analysis', 'Public Administration', 'Stakeholder Engagement', 'Data Analytics', 'Programme Management', 'Communications'],
    'public service': ['Policy Analysis', 'Public Administration', 'Stakeholder Engagement', 'Data Analytics', 'Programme Management', 'Digital Government'],
    // Social Service
    'social': ['Case Management', 'Counselling', 'Community Development', 'Social Work Regulations (SSA)', 'Volunteer Management', 'Programme Evaluation'],
    // Security
    'security': ['Security Operations', 'Risk Assessment', 'Incident Management', 'Cybersecurity', 'Crisis Management', 'Regulatory Compliance'],
    // Landscape
    'landscape': ['Horticultural Science', 'Landscape Design', 'Project Management', 'Environmental Sustainability', 'Arboriculture', 'Irrigation Systems'],
    // Professional Services
    'professional': ['Management Consulting', 'Business Analysis', 'Change Management', 'Data Analytics', 'Stakeholder Management', 'Strategy Development'],
  };

  // Improved industry matching — try full phrase first, then word-by-word
  const matchedKey = Object.keys(industrySkillMap).find(k => industry.includes(k))
    ?? Object.keys(industrySkillMap).find(k => industry.split(/[\s&,/]+/).some(word => word.length > 3 && k.includes(word)));

  // Role-specific overrides for common roles
  const roleSkillMap: Record<string, string[]> = {
    // Legal
    'legal research associate': ['Legal Research & Analysis', 'Westlaw / LexisNexis', 'Case Summarisation', 'Legal Writing', 'Regulatory Compliance', 'Contract Review'],
    'paralegal': ['Legal Documentation', 'Case Management Software', 'Legal Research', 'Contract Drafting Support', 'Court Filing Procedures', 'Client Communication'],
    'lawyer': ['Legal Research & Analysis', 'Advocacy & Litigation', 'Contract Negotiation', 'Westlaw / LexisNexis', 'Legal Writing', 'Regulatory Compliance'],
    'corporate lawyer': ['Corporate Law', 'M&A Transactions', 'Contract Drafting', 'Securities Law', 'Due Diligence', 'Regulatory Compliance'],
    'compliance manager': ['Regulatory Compliance', 'Risk Management', 'AML/KYC', 'MAS Guidelines', 'Policy Development', 'Audit Management'],
    'compliance officer': ['Regulatory Compliance', 'Risk Assessment', 'AML/KYC Procedures', 'MAS Guidelines', 'Compliance Monitoring', 'Reporting'],
    'data protection officer': ['PDPA (Singapore)', 'GDPR', 'Data Governance', 'Privacy Impact Assessment', 'Incident Response', 'Policy Development'],
    // Finance & Banking
    'financial analyst': ['Financial Modelling', 'Bloomberg Terminal', 'Equity Research', 'Valuation Techniques', 'Data Analytics', 'MAS Regulatory Framework'],
    'investment analyst': ['Financial Modelling', 'Bloomberg Terminal', 'Portfolio Analysis', 'Equity Research', 'Valuation Techniques', 'Risk Analysis'],
    'investment banker': ['M&A Advisory', 'Financial Modelling', 'DCF Valuation', 'Capital Markets', 'Deal Structuring', 'Client Relationship Management'],
    'risk analyst': ['Risk Modelling', 'Quantitative Analysis', 'Basel III/IV', 'Market Risk', 'Credit Risk', 'Excel / Python for Risk'],
    'risk manager': ['Enterprise Risk Management', 'Risk Modelling', 'Regulatory Reporting', 'Basel III/IV', 'Scenario Analysis', 'Stakeholder Management'],
    'credit analyst': ['Credit Risk Analysis', 'Financial Statement Analysis', 'Loan Structuring', 'MAS Credit Guidelines', 'Excel / Power BI', 'Industry Analysis'],
    'wealth manager': ['Portfolio Management', 'Financial Planning', 'Tax Planning', 'Estate Planning', 'Client Relationship Management', 'CFA / CFP'],
    'private banker': ['Wealth Management', 'Portfolio Construction', 'Tax & Estate Planning', 'Client Relationship Management', 'MAS Regulations', 'Alternative Investments'],
    'trade finance specialist': ['Trade Finance Instruments', 'Letters of Credit', 'Import/Export Regulations', 'UCP 600', 'Risk Assessment', 'SWIFT Messaging'],
    'actuary': ['Actuarial Science', 'Statistical Modelling', 'Risk Assessment', 'Regulatory Reporting (MAS)', 'Excel / R / Python', 'Insurance Products'],
    // Accountancy
    'accountant': ['IFRS / FRS Standards', 'Tax Compliance (IRAS)', 'Financial Reporting', 'Audit Procedures', 'ERP Systems', 'Excel / Power BI'],
    'senior accountant': ['IFRS / FRS Standards', 'Financial Consolidation', 'Tax Planning (IRAS)', 'ERP Systems (SAP/Oracle)', 'Internal Controls', 'Management Reporting'],
    'tax consultant': ['Singapore Tax Law (IRAS)', 'GST Compliance', 'Corporate Tax Planning', 'Transfer Pricing', 'Tax Reporting', 'Client Advisory'],
    'tax manager': ['Singapore Tax Law (IRAS)', 'Transfer Pricing', 'GST Management', 'Tax Strategy', 'Cross-border Tax', 'Team Leadership'],
    'internal auditor': ['Audit Methodology', 'Risk-Based Auditing', 'Internal Controls', 'Data Analytics', 'Regulatory Compliance', 'Audit Reporting'],
    'external auditor': ['SFRS / IFRS', 'Audit Standards (SSA)', 'Financial Statement Analysis', 'Risk Assessment', 'Sampling Methods', 'Audit Software'],
    'financial controller': ['Financial Reporting', 'Budgeting & Forecasting', 'Internal Controls', 'ERP Systems', 'IFRS / FRS', 'Team Leadership'],
    'cfo': ['Financial Strategy', 'Capital Management', 'Investor Relations', 'M&A', 'Risk Management', 'Board Reporting'],
    'chief financial officer': ['Financial Strategy', 'Capital Management', 'Investor Relations', 'M&A', 'Risk Management', 'Board Reporting'],
    'treasury analyst': ['Cash Management', 'FX Risk Management', 'Financial Instruments', 'Bloomberg Terminal', 'Bank Relationship Management', 'Treasury Systems'],
    // ICT
    'software engineer': ['Python / Java', 'Cloud Architecture', 'System Design', 'DevOps / CI-CD', 'API Development', 'Agile Methodology'],
    'senior software engineer': ['System Architecture', 'Python / Java / Go', 'Cloud (AWS/Azure/GCP)', 'DevOps / CI-CD', 'Code Review', 'Technical Leadership'],
    'data analyst': ['SQL & Data Querying', 'Python for Data Analysis', 'Power BI / Tableau', 'Statistical Analysis', 'Data Storytelling', 'Machine Learning Basics'],
    'data scientist': ['Machine Learning', 'Python / R', 'Deep Learning', 'Feature Engineering', 'Statistical Modelling', 'MLOps'],
    'data engineer': ['SQL / NoSQL', 'Apache Spark / Kafka', 'ETL Pipelines', 'Cloud Data Platforms (AWS/GCP)', 'Python', 'Data Architecture'],
    'ai engineer': ['Machine Learning', 'Python / TensorFlow / PyTorch', 'LLM Fine-tuning', 'MLOps', 'AI Ethics', 'Cloud AI Services'],
    'machine learning engineer': ['Machine Learning', 'Python / TensorFlow / PyTorch', 'Feature Engineering', 'Model Deployment', 'MLOps', 'Cloud Platforms'],
    'devops engineer': ['CI/CD Pipelines', 'Docker / Kubernetes', 'Cloud Infrastructure (AWS/Azure)', 'Infrastructure as Code', 'Monitoring & Observability', 'Linux/Shell Scripting'],
    'cloud architect': ['Cloud Architecture (AWS/Azure/GCP)', 'Microservices', 'Infrastructure as Code', 'Security Architecture', 'Cost Optimisation', 'Solution Design'],
    'cybersecurity analyst': ['Threat Detection & Response', 'SIEM Tools', 'Vulnerability Assessment', 'Network Security', 'Incident Response', 'Security Frameworks (ISO 27001)'],
    'cyber security analyst': ['Threat Detection & Response', 'SIEM Tools', 'Vulnerability Assessment', 'Network Security', 'Incident Response', 'Security Frameworks (ISO 27001)'],
    'security engineer': ['Security Architecture', 'Penetration Testing', 'Cloud Security', 'Identity & Access Management', 'SIEM / SOAR', 'DevSecOps'],
    'chief information officer': ['IT Strategy & Governance', 'Digital Transformation', 'Enterprise Architecture', 'Cybersecurity Strategy', 'IT Budget Management', 'Stakeholder Management'],
    'cto': ['Technology Strategy', 'Product Architecture', 'Engineering Leadership', 'Cloud Strategy', 'AI & Emerging Technologies', 'Vendor Management'],
    'product manager': ['Product Strategy', 'Agile / Scrum', 'User Research', 'Roadmap Planning', 'Stakeholder Management', 'Data-Driven Decision Making'],
    'ux/ui designer': ['User Research', 'Figma / Sketch', 'Wireframing & Prototyping', 'Usability Testing', 'Design Systems', 'Accessibility Standards'],
    'business analyst': ['Requirements Gathering', 'Process Mapping', 'Data Analysis', 'Agile / Waterfall', 'SQL', 'Stakeholder Management'],
    'solutions architect': ['Solution Design', 'Cloud Architecture (AWS/Azure)', 'API Design', 'Enterprise Integration', 'Security Architecture', 'Technical Presales'],
    'network engineer': ['TCP/IP Networking', 'Cisco / Juniper', 'Network Security', 'Routing & Switching', 'SD-WAN', 'Network Monitoring'],
    'frontend developer': ['React / Vue / Angular', 'HTML / CSS / JavaScript', 'Responsive Design', 'Web Performance', 'REST APIs', 'Testing'],
    'backend developer': ['Python / Java / Node.js', 'REST / GraphQL APIs', 'Database Design', 'Cloud Services', 'Authentication & Security', 'Microservices'],
    'full stack developer': ['React / Vue', 'Node.js / Python', 'REST APIs', 'Database Design (SQL/NoSQL)', 'Cloud Deployment', 'DevOps Basics'],
    'blockchain developer': ['Solidity / Smart Contracts', 'Ethereum / Hyperledger', 'Web3.js / Ethers.js', 'DeFi Concepts', 'Cryptography', 'Blockchain Architecture'],
    'mobile app developer': ['React Native / Flutter', 'iOS (Swift) / Android (Kotlin)', 'Mobile UI/UX', 'API Integration', 'App Store Deployment', 'Performance Optimisation'],
    // HR
    'hr manager': ['Talent Management', 'Employment Act Compliance', 'HR Analytics', 'Compensation & Benefits', 'Organisational Development', 'HRIS Platforms'],
    'hr business partner': ['Strategic HR Planning', 'Talent Management', 'Employee Relations', 'Change Management', 'HR Analytics', 'Employment Act (Singapore)'],
    'talent acquisition specialist': ['Sourcing Strategies', 'Interviewing Techniques', 'Employer Branding', 'ATS Systems', 'LinkedIn Recruiter', 'Onboarding'],
    'learning & development manager': ['Training Needs Analysis', 'Instructional Design', 'LMS Platforms', 'SkillsFuture Framework', 'Leadership Development', 'ROI of Learning'],
    'compensation & benefits manager': ['Job Evaluation', 'Market Benchmarking', 'CPF Regulations', 'Benefits Design', 'HR Analytics', 'Employment Act (Singapore)'],
    'learning development manager': ['Training Needs Analysis', 'Instructional Design', 'LMS Platforms', 'SkillsFuture Framework', 'Leadership Development', 'ROI of Learning'],
    // Marketing
    'marketing manager': ['Digital Marketing Strategy', 'Marketing Analytics', 'Brand Management', 'SEO / SEM', 'CRM Platforms', 'Campaign Management'],
    'digital marketing manager': ['SEO / SEM', 'Performance Marketing', 'Google Analytics', 'Social Media Marketing', 'Email Marketing', 'Marketing Automation'],
    'brand manager': ['Brand Strategy', 'Consumer Insights', 'Campaign Management', 'Market Research', 'Budget Management', 'Agency Management'],
    'seo specialist': ['Technical SEO', 'Keyword Research', 'Content Strategy', 'Link Building', 'Google Search Console', 'Analytics'],
    'content marketing specialist': ['Content Strategy', 'SEO Writing', 'Social Media', 'Email Marketing', 'Analytics', 'CMS Platforms'],
    'pr manager': ['Media Relations', 'Crisis Communications', 'Press Releases', 'Stakeholder Management', 'Brand Reputation', 'Social Media'],
    'crm manager': ['CRM Platforms (Salesforce/HubSpot)', 'Customer Segmentation', 'Marketing Automation', 'Data Analytics', 'Customer Lifecycle Management', 'A/B Testing'],
    // Healthcare
    'nurse': ['Clinical Assessment', 'Patient Safety Protocols', 'EMR / EHR Systems', 'Medication Administration', 'Healthcare Communication', 'Infection Control'],
    'staff nurse': ['Clinical Assessment', 'Patient Safety Protocols', 'EMR / EHR Systems', 'Medication Administration', 'Healthcare Communication', 'Infection Control'],
    'enrolled nurse': ['Basic Clinical Care', 'Patient Monitoring', 'Medication Assistance', 'Documentation', 'Infection Control', 'Communication'],
    'occupational therapist': ['Functional Assessment', 'Rehabilitation Planning', 'Assistive Technology', 'Patient Education', 'MOH Regulations', 'Documentation'],
    'speech therapist': ['Speech & Language Assessment', 'Dysphagia Management', 'Communication Disorders', 'Treatment Planning', 'Documentation', 'Patient/Family Education'],
    'healthcare administrator': ['Healthcare Operations', 'Healthcare Regulations (MOH)', 'Budget Management', 'HR Management', 'Quality Management', 'Patient Experience'],
    'health informatics analyst': ['HL7 / FHIR Standards', 'Healthcare IT Systems (EMR/EHR)', 'Data Analytics', 'Healthcare Regulations', 'SQL', 'Process Improvement'],
    'biomedical engineer': ['Medical Device Design', 'Regulatory Affairs (HSA)', 'Biomedical Instrumentation', 'Clinical Trials Support', 'Quality Management (ISO 13485)', 'Technical Documentation'],
    // Aviation & Transport
    'airline revenue manager': ['Revenue Management Systems (RMS)', 'Airline Pricing Strategy', 'Demand Forecasting & Optimisation', 'Inventory Control (O&D)', 'GDS / Amadeus / Sabre', 'IATA Regulations & Standards', 'Data Analytics for Aviation', 'Yield Management'],
    'airport revenue manager': ['Revenue Management Systems (RMS)', 'Airport Commercial Strategy', 'Retail & Concession Management', 'Demand Forecasting', 'Contract Negotiation', 'IATA Regulations & Standards', 'Data Analytics', 'Stakeholder Management'],
    'air traffic controller': ['Air Traffic Management', 'ICAO Procedures', 'Radar Operations', 'Emergency Procedures', 'Communication Protocols', 'Situational Awareness'],
    'pilot': ['Flight Operations', 'ICAO / CAAS Regulations', 'Instrument Flying', 'Crew Resource Management', 'Aircraft Systems', 'Safety Management'],
    'captain': ['Flight Operations Leadership', 'ICAO / CAAS Regulations', 'Crew Resource Management', 'Safety Management Systems', 'Aircraft Systems', 'Decision Making'],
    'airport operations executive': ['Airport Operations Management', 'ICAO / CAAS Standards', 'Ground Handling', 'Safety & Security Compliance', 'Emergency Response', 'Stakeholder Coordination'],
    'cabin crew': ['Passenger Safety & Emergency Procedures', 'Inflight Service Excellence', 'First Aid', 'CRM (Crew Resource Management)', 'Aviation Regulations', 'Cultural Awareness'],
    'cargo officer': ['Cargo Operations', 'IATA Dangerous Goods Regulations', 'Customs Compliance', 'Air Waybill Processing', 'Inventory Management', 'Safety Compliance'],
    // Aerospace
    'aerospace engineer': ['Aerospace Systems Design', 'CAD (CATIA/SolidWorks)', 'Structural Analysis (FEA)', 'Aerodynamics', 'AS9100 Quality Standards', 'Project Management'],
    'aircraft maintenance engineer (airframe)': ['Aircraft Structural Maintenance', 'CAAS Part 145', 'Technical Documentation', 'NDT Techniques', 'Safety Management', 'Quality Assurance'],
    'aircraft maintenance engineer (avionics)': ['Avionics Systems', 'CAAS Part 145', 'Electrical Troubleshooting', 'Navigation Systems', 'Technical Documentation', 'Safety Management'],
    // Education & Training
    'teacher': ['Curriculum Design', 'Classroom Management', 'Student Assessment', 'Differentiated Instruction', 'EdTech Integration', 'MOE Framework'],
    'instructional designer': ['ADDIE / SAM Model', 'E-Learning Development (Articulate/Adobe)', 'Learning Needs Analysis', 'LMS Administration', 'Adult Learning Principles', 'Evaluation Methods'],
    'corporate trainer': ['Training Needs Analysis', 'Facilitation Skills', 'Instructional Design', 'SkillsFuture Framework', 'Adult Learning Principles', 'Training Evaluation'],
    'adult educator': ['Adult Learning Principles (Andragogy)', 'Facilitation Techniques', 'Curriculum Development', 'ACTA / ACLP Certification', 'Assessment Design', 'E-Learning Tools'],
    'l&d manager': ['Training Strategy', 'Instructional Design', 'LMS Platforms', 'SkillsFuture Credits Administration', 'ROI of Learning', 'Stakeholder Management'],
    'pre-school teacher': ['Early Childhood Development', 'ECDA Curriculum Framework', 'Play-Based Learning', 'Parent Engagement', 'Inclusive Education', 'Classroom Management'],
    'preschool teacher': ['Early Childhood Development', 'ECDA Curriculum Framework', 'Play-Based Learning', 'Parent Engagement', 'Inclusive Education', 'Classroom Management'],
    // Logistics & Supply Chain
    'supply chain manager': ['Supply Chain Strategy', 'Demand Planning', 'Supplier Management', 'ERP Systems', 'Trade Compliance', 'Cost Optimisation'],
    'logistics coordinator': ['Freight Management', 'Customs Documentation', 'Warehouse Operations', 'Transport Planning', 'ERP / WMS Systems', 'Vendor Coordination'],
    'warehouse manager': ['Warehouse Management Systems (WMS)', 'Inventory Control', 'Lean Operations', 'Team Management', 'Safety Compliance (WSH)', 'KPI Reporting'],
    'procurement manager': ['Strategic Sourcing', 'Contract Negotiation', 'Supplier Relationship Management', 'ERP Systems', 'Cost Analysis', 'Risk Management'],
    'customs clearance executive': ['Singapore Customs Regulations', 'TradeNet / Tradexlink', 'HS Code Classification', 'Import/Export Documentation', 'GST on Imports', 'Trade Compliance'],
    // Engineering & Construction
    'civil engineer': ['AutoCAD / Civil 3D', 'Structural Design', 'Project Management', 'WSH Act Compliance', 'BIM', 'Contract Administration'],
    'mechanical engineer': ['CAD / SolidWorks', 'Thermal / Fluid Analysis', 'Manufacturing Processes', 'Project Management', 'Quality Control', 'Technical Documentation'],
    'electrical engineer': ['Electrical System Design', 'AutoCAD Electrical', 'Power Systems', 'PLC Programming', 'Safety Standards (SS638)', 'Project Management'],
    'project manager (construction)': ['BIM', 'Construction Project Management', 'Contract Administration', 'Cost Management', 'WSH Management', 'Stakeholder Engagement'],
    'quantity surveyor': ['Cost Estimation', 'Tendering & Procurement', 'Contract Law', 'BIM for QS', 'Value Engineering', 'Financial Reporting'],
    'facilities manager': ['Facilities Management', 'Building Systems (M&E)', 'WSH Compliance', 'Energy Management', 'Vendor Management', 'CMMS Software'],
    'green building consultant': ['Green Mark Certification', 'Energy Modelling', 'BIM', 'Sustainability Reporting', 'Building Performance Analysis', 'WSH Compliance'],
    // Hospitality & Tourism
    'hotel manager': ['Hotel Operations Management', 'Revenue Management', 'Guest Experience', 'P&L Management', 'HR Management', 'OTA Channel Management'],
    'revenue manager': ['Revenue Management Systems', 'OTA Channel Management', 'Demand Forecasting', 'Pricing Strategy', 'STR Reports Analysis', 'GDS Management'],
    'hotel revenue manager': ['Revenue Management Systems', 'OTA Channel Management', 'Demand Forecasting', 'Pricing Strategy', 'STR Reports Analysis', 'GDS Management'],
    'front office manager': ['Property Management Systems (PMS)', 'Guest Relations', 'Reservations Management', 'Revenue Optimisation', 'Team Leadership', 'Complaint Resolution'],
    'f&b manager': ['Food & Beverage Operations', 'Menu Engineering', 'Cost Control', 'HACCP', 'Team Management', 'Customer Experience'],
    'event coordinator': ['Event Planning', 'Vendor Management', 'Budget Management', 'MICE Operations', 'Stakeholder Coordination', 'Marketing'],
    'tour manager': ['Tour Operations', 'Travel Logistics', 'Customer Service', 'Destination Knowledge', 'Crisis Management', 'Budgeting'],
    // Food Services
    'head chef': ['Culinary Arts', 'Menu Development', 'Kitchen Operations', 'HACCP / Food Safety', 'Cost Control', 'Team Leadership'],
    'restaurant manager': ['F&B Operations', 'Customer Experience', 'Staff Management', 'POS Systems', 'Cost Control', 'HACCP Compliance'],
    'food technologist': ['Food Science', 'Product Development', 'HACCP', 'SFA Regulations', 'Sensory Evaluation', 'Quality Assurance'],
    // Marine & Offshore
    'marine engineer': ['Marine Engineering Systems', 'MPA Regulations', 'Preventive Maintenance', 'STCW Standards', 'Troubleshooting', 'Safety Management (ISM Code)'],
    'naval architect': ['Ship Design (AutoCAD/NAPA)', 'Structural Analysis', 'Hydrodynamics', 'Classification Rules (ABS/DNV)', 'Project Management', 'Technical Documentation'],
    'ship captain': ['Vessel Navigation', 'STCW Convention', 'ISM Code', 'COLREGS', 'Cargo Operations', 'Emergency Management'],
    'offshore engineer': ['Offshore Structural Design', 'FEED / EPCI Projects', 'HSE Management', 'Classification Standards', 'Project Management', 'Technical Documentation'],
    // Environmental & Energy
    'sustainability manager': ['ESG Reporting (GRI/TCFD)', 'Carbon Footprint Analysis', 'Sustainability Strategy', 'Green Certification', 'Stakeholder Engagement', 'Data Analytics'],
    'environmental consultant': ['Environmental Impact Assessment', 'NEA Regulations', 'Carbon Management', 'Environmental Monitoring', 'Sustainability Reporting', 'Stakeholder Management'],
    'energy analyst': ['Energy Modelling', 'Data Analytics', 'Power Systems', 'EMA Regulations', 'Renewable Energy', 'Energy Auditing'],
    'renewable energy engineer': ['Solar PV Design', 'Wind Energy Systems', 'Grid Integration', 'EMA Regulations', 'Project Management', 'Energy Storage Systems'],
    // Security
    'cybersecurity manager': ['Security Operations Centre (SOC)', 'Incident Response', 'Risk Management', 'PDPA / Cybersecurity Act', 'Security Architecture', 'Team Leadership'],
    'security manager': ['Security Operations', 'Risk Assessment', 'Crisis Management', 'Team Leadership', 'Regulatory Compliance (PLRD)', 'Incident Investigation'],
    'threat intelligence analyst': ['Threat Intelligence Platforms', 'SIEM Analysis', 'Malware Analysis', 'MITRE ATT&CK Framework', 'Threat Hunting', 'Reporting'],
    // Social Service
    'social worker': ['Case Management', 'Counselling Techniques', 'Social Work Act Compliance', 'Community Resources', 'Crisis Intervention', 'Documentation'],
    'counsellor': ['Counselling Theories (CBT/Person-Centred)', 'Mental Health Assessment', 'Crisis Intervention', 'Case Documentation', 'Ethics in Counselling', 'Group Facilitation'],
    'case manager': ['Case Management', 'Assessment & Care Planning', 'Resource Coordination', 'Documentation', 'Community Networking', 'Crisis Intervention'],
    // Government
    'policy analyst': ['Policy Research & Analysis', 'Quantitative / Qualitative Methods', 'Stakeholder Consultation', 'Report Writing', 'Data Analytics', 'Public Administration'],
    'urban planner': ['Urban Planning (URA Framework)', 'GIS Software', 'Land Use Planning', 'Stakeholder Engagement', 'Environmental Impact Assessment', 'Development Control'],
    // Retail
    'retail operations manager': ['Retail Operations', 'P&L Management', 'Inventory Management', 'Team Leadership', 'Customer Experience', 'ERP / POS Systems'],
    'e-commerce manager': ['E-Commerce Platforms (Shopify/Lazada/Shopee)', 'Digital Marketing', 'Logistics Coordination', 'Data Analytics', 'Customer Experience', 'SEO'],
    'merchandising manager': ['Merchandise Planning', 'Open-to-Buy Planning', 'Supplier Negotiation', 'Inventory Optimisation', 'Trend Analysis', 'Data Analytics'],
    // Design
    'ux designer': ['User Research', 'Wireframing / Prototyping (Figma)', 'Usability Testing', 'Design Systems', 'Information Architecture', 'Accessibility'],
    'graphic designer': ['Adobe Creative Suite', 'Typography', 'Brand Identity', 'Print & Digital Design', 'Layout Design', 'Client Communication'],
    'interior designer': ['AutoCAD / SketchUp / Revit', 'Space Planning', 'Material & Finish Specification', 'Project Management', 'BCA Regulations', 'Client Presentation'],
    // Professional Services
    'management consultant': ['Business Strategy', 'Problem Solving Frameworks', 'Data Analytics', 'Change Management', 'Stakeholder Management', 'Presentation Skills'],
    'strategy consultant': ['Strategic Analysis', 'Market Research', 'Financial Modelling', 'Competitive Intelligence', 'Stakeholder Management', 'Executive Communication'],
    'digital transformation consultant': ['Digital Strategy', 'Change Management', 'Technology Assessment', 'Agile / Design Thinking', 'Stakeholder Management', 'Data Analytics'],
    // Wholesale Trade
    'commodity trader': ['Commodity Markets', 'Trading Platforms', 'Risk Management', 'Contract Negotiation', 'Market Analysis', 'Regulatory Compliance'],
    'trade finance executive': ['Trade Finance Instruments (LC/BG)', 'UCP 600', 'Risk Assessment', 'Documentation', 'MAS Regulations', 'Banking Operations'],
    // Landscape
    'landscape architect': ['Landscape Design (AutoCAD/SketchUp)', 'Horticulture', 'Urban Greenery (NParks)', 'Project Management', 'Environmental Sustainability', 'Client Presentation'],
    'horticulturist': ['Plant Science', 'Landscape Maintenance', 'NParks Regulations', 'Irrigation Systems', 'Pest & Disease Management', 'Sustainability Practices'],
    // Media
    'digital content manager': ['Content Strategy', 'SEO', 'Social Media Management', 'Analytics (GA4)', 'Video Production', 'Editorial Planning'],
    'game designer': ['Game Design Principles', 'Unity / Unreal Engine', 'Level Design', 'Narrative Design', 'Prototyping', 'Player Experience'],
    'video producer': ['Video Production', 'Adobe Premiere / Final Cut Pro', 'Scriptwriting', 'Directing', 'Motion Graphics', 'Audience Analytics'],
  };

  // Fuzzy role match: exact → partial-key → partial-word
  const matchedRole = roleSkillMap[role]
    ? role
    : Object.keys(roleSkillMap).find(k => role.includes(k) || k.includes(role))
    ?? Object.keys(roleSkillMap).find(k => k.split(' ').some(w => w.length > 4 && role.includes(w)));

  const targetSkills =
    (matchedRole ? roleSkillMap[matchedRole] : null) ||
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
