/**
 * Direct seed script — run with: node scripts/seed.mjs
 * Seeds industries and job roles without requiring admin auth.
 */
import pkg from 'pg';
const { Client } = pkg;
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dir = dirname(__filename);

// Read DATABASE_URL from .env.local
const envPath = join(__dir, '..', '.env.local');
const envContent = readFileSync(envPath, 'utf-8');
const match = envContent.match(/^DATABASE_URL=(.+)$/m);
if (!match) { console.error('DATABASE_URL not found in .env.local'); process.exit(1); }
const DATABASE_URL = match[1].trim();

const client = new Client({ connectionString: DATABASE_URL });

const SEED_INDUSTRIES = [
  { name: 'Information & Communications Technology', description: 'Software, hardware, networking, cybersecurity, AI and data technologies' },
  { name: 'Finance & Banking', description: 'Banking, insurance, fintech, wealth management and financial services' },
  { name: 'Healthcare & Life Sciences', description: 'Hospitals, clinics, pharmaceuticals, biomedical and healthcare technology' },
  { name: 'Education & Training', description: 'Schools, tertiary institutions, private education and corporate training' },
  { name: 'Engineering & Manufacturing', description: 'Aerospace, precision engineering, electronics and advanced manufacturing' },
  { name: 'Marketing, PR & Communications', description: 'Digital marketing, brand management, public relations and content creation' },
  { name: 'Human Resources & Recruitment', description: 'Talent acquisition, HR management, learning and development' },
  { name: 'Legal & Compliance', description: 'Legal services, compliance, risk management and regulatory affairs' },
  { name: 'Retail & E-commerce', description: 'Retail operations, e-commerce, supply chain and customer experience' },
  { name: 'Logistics & Supply Chain', description: 'Freight, warehousing, supply chain management and last-mile delivery' },
  { name: 'Construction & Built Environment', description: 'Building, civil engineering, architecture and real estate' },
  { name: 'Media & Entertainment', description: 'Broadcasting, digital media, gaming and content production' },
  { name: 'Government & Public Services', description: 'Public administration, policy, social services and smart nation initiatives' },
  { name: 'Hospitality & Tourism', description: 'Hotels, F&B, travel and tourism management' },
  { name: 'Professional Services', description: 'Consulting, accounting, auditing and business advisory' },
];

const SEED_JOB_ROLES = {
  'Information & Communications Technology': [
    { name: 'Software Engineer', description: 'Design, develop and maintain software applications', skill_keywords: ['Python', 'JavaScript', 'Java', 'System Design', 'Git'] },
    { name: 'Senior Software Engineer', description: 'Lead software development teams and architect solutions', skill_keywords: ['System Architecture', 'Microservices', 'Leadership', 'Code Review', 'Cloud'] },
    { name: 'Data Analyst', description: 'Analyse data to derive business insights and recommendations', skill_keywords: ['SQL', 'Python', 'Tableau', 'Excel', 'Statistics'] },
    { name: 'Data Scientist', description: 'Build predictive models and AI solutions from data', skill_keywords: ['Machine Learning', 'Python', 'TensorFlow', 'Statistics', 'NLP'] },
    { name: 'Data Engineer', description: 'Build and maintain data pipelines and infrastructure', skill_keywords: ['Spark', 'Kafka', 'SQL', 'Python', 'Cloud Data Platforms'] },
    { name: 'Machine Learning Engineer', description: 'Deploy and optimise ML models in production', skill_keywords: ['MLOps', 'Python', 'TensorFlow', 'Docker', 'Kubernetes'] },
    { name: 'AI Engineer', description: 'Develop AI applications including generative AI and agents', skill_keywords: ['Generative AI', 'LLMs', 'Agentic AI', 'Python', 'Prompt Engineering'] },
    { name: 'Cybersecurity Analyst', description: 'Monitor, detect and respond to security threats', skill_keywords: ['SIEM', 'Threat Intelligence', 'Incident Response', 'Networking', 'CEH'] },
    { name: 'Security Engineer', description: 'Design and implement security architectures and controls', skill_keywords: ['Security Architecture', 'Penetration Testing', 'IAM', 'Cloud Security', 'CISSP'] },
    { name: 'Cloud Architect', description: 'Design and oversee cloud infrastructure and solutions', skill_keywords: ['AWS', 'Azure', 'GCP', 'Cloud Architecture', 'DevOps'] },
    { name: 'DevOps Engineer', description: 'Automate and streamline software delivery pipelines', skill_keywords: ['CI/CD', 'Docker', 'Kubernetes', 'Terraform', 'Linux'] },
    { name: 'Product Manager (Tech)', description: 'Own product roadmap and delivery for technology products', skill_keywords: ['Product Strategy', 'Agile', 'Stakeholder Management', 'User Research', 'Roadmapping'] },
    { name: 'UX/UI Designer', description: 'Design intuitive user experiences and interfaces', skill_keywords: ['Figma', 'User Research', 'Prototyping', 'Design Systems', 'Accessibility'] },
    { name: 'Full Stack Developer', description: 'Build end-to-end web applications front and back', skill_keywords: ['React', 'Node.js', 'Databases', 'REST APIs', 'TypeScript'] },
    { name: 'Blockchain Developer', description: 'Build decentralised applications and smart contracts', skill_keywords: ['Solidity', 'Ethereum', 'Web3.js', 'Smart Contracts', 'DeFi'] },
  ],
  'Finance & Banking': [
    { name: 'Financial Analyst', description: 'Analyse financial data and prepare investment reports', skill_keywords: ['Financial Modelling', 'Excel', 'Bloomberg', 'Valuation', 'CFA'] },
    { name: 'Risk Analyst', description: 'Identify and assess financial and operational risks', skill_keywords: ['Risk Management', 'Basel III', 'VaR', 'Excel', 'FRM'] },
    { name: 'Compliance Officer', description: 'Ensure regulatory compliance across banking operations', skill_keywords: ['MAS Regulations', 'AML/CFT', 'KYC', 'FATF', 'ICA'] },
    { name: 'FinTech Product Manager', description: 'Drive digital financial product innovation', skill_keywords: ['Payments', 'Digital Banking', 'Agile', 'Regulatory Sandbox', 'API Banking'] },
    { name: 'Investment Banker', description: 'Execute M&A deals and capital market transactions', skill_keywords: ['M&A', 'DCM', 'ECM', 'Financial Modelling', 'CFA'] },
    { name: 'Relationship Manager (Corporate)', description: 'Manage corporate client portfolios and banking needs', skill_keywords: ['Corporate Banking', 'Credit Analysis', 'Portfolio Management', 'KYC', 'CRM'] },
    { name: 'Quantitative Analyst', description: 'Develop mathematical models for trading and risk', skill_keywords: ['Python', 'R', 'Statistics', 'Derivatives', 'Machine Learning'] },
    { name: 'Actuarial Analyst', description: 'Assess financial risk using mathematical models', skill_keywords: ['Actuarial Science', 'R', 'Excel', 'SOA/CAS Exams', 'Statistics'] },
  ],
  'Healthcare & Life Sciences': [
    { name: 'Healthcare Data Analyst', description: 'Analyse clinical and operational healthcare data', skill_keywords: ['SQL', 'Python', 'HL7/FHIR', 'EMR Systems', 'Statistics'] },
    { name: 'Medical Affairs Manager', description: 'Bridge medical science and commercial activities', skill_keywords: ['Clinical Research', 'Medical Writing', 'Regulatory Affairs', 'KOL Management', 'MD/PhD'] },
    { name: 'Clinical Research Coordinator', description: 'Coordinate clinical trials and research studies', skill_keywords: ['GCP', 'ICH Guidelines', 'Clinical Trials', 'IRB', 'EDC Systems'] },
    { name: 'Health Informatics Specialist', description: 'Implement and manage healthcare information systems', skill_keywords: ['EMR/EHR', 'HL7', 'FHIR', 'HIMSS', 'Data Governance'] },
    { name: 'Pharmaceutical Sales Rep', description: 'Promote and sell pharmaceutical products to clinicians', skill_keywords: ['Pharmacology', 'CRM', 'Sales', 'Product Knowledge', 'Compliance'] },
    { name: 'Biomedical Engineer', description: 'Develop medical devices and healthcare technologies', skill_keywords: ['Medical Devices', 'FDA/HSA Regulations', 'CAD', 'Biocompatibility', 'QMS'] },
  ],
  'Education & Training': [
    { name: 'Instructional Designer', description: 'Design effective learning experiences and curricula', skill_keywords: ['ADDIE', 'Articulate Storyline', 'LMS', 'e-Learning', 'Learning Analytics'] },
    { name: 'Corporate Trainer', description: 'Facilitate workplace learning and development programmes', skill_keywords: ['Facilitation', 'Training Needs Analysis', 'WSQ', 'Adult Learning', 'LMS'] },
    { name: 'EdTech Product Manager', description: 'Lead educational technology product development', skill_keywords: ['Product Management', 'EdTech', 'LMS', 'Learning Analytics', 'Agile'] },
    { name: 'Learning & Development Manager', description: 'Manage L&D strategy and capability development', skill_keywords: ['L&D Strategy', 'Training Needs Analysis', 'Leadership Development', 'Budget Management', 'ACTA'] },
    { name: 'Academic Programme Director', description: 'Oversee academic programmes and curriculum development', skill_keywords: ['Curriculum Design', 'Academic Governance', 'Accreditation', 'Leadership', 'Research'] },
  ],
  'Engineering & Manufacturing': [
    { name: 'Mechanical Engineer', description: 'Design and develop mechanical systems and products', skill_keywords: ['CAD/CAM', 'SolidWorks', 'FEA', 'GD&T', 'Manufacturing Processes'] },
    { name: 'Electrical Engineer', description: 'Design electrical systems and power electronics', skill_keywords: ['PCB Design', 'Power Systems', 'PLC', 'AutoCAD Electrical', 'IEC Standards'] },
    { name: 'Process Engineer', description: 'Optimise manufacturing processes for efficiency and quality', skill_keywords: ['Lean Manufacturing', 'Six Sigma', 'FMEA', 'Statistical Process Control', 'Kaizen'] },
    { name: 'Quality Engineer', description: 'Ensure product and process quality standards', skill_keywords: ['ISO 9001', 'FMEA', 'SPC', 'Root Cause Analysis', 'Lean'] },
    { name: 'Aerospace Engineer', description: 'Design aircraft systems and aerospace components', skill_keywords: ['CATIA', 'Aerospace Regulations', 'Structural Analysis', 'Avionics', 'MRO'] },
    { name: 'Automation Engineer', description: 'Design and implement industrial automation systems', skill_keywords: ['PLC', 'SCADA', 'Robotics', 'Industry 4.0', 'Python'] },
  ],
  'Marketing, PR & Communications': [
    { name: 'Digital Marketing Manager', description: 'Lead digital marketing strategy across channels', skill_keywords: ['SEO/SEM', 'Google Ads', 'Social Media', 'Analytics', 'Content Strategy'] },
    { name: 'Content Strategist', description: 'Plan and manage content across digital platforms', skill_keywords: ['Content Marketing', 'SEO', 'Copywriting', 'CMS', 'Brand Voice'] },
    { name: 'Social Media Manager', description: 'Manage brand presence and engagement on social platforms', skill_keywords: ['Social Media Marketing', 'Content Creation', 'Analytics', 'Community Management', 'Paid Social'] },
    { name: 'PR Manager', description: 'Manage media relations and brand reputation', skill_keywords: ['Media Relations', 'Crisis Communications', 'Press Releases', 'Stakeholder Management', 'Brand Management'] },
    { name: 'Brand Manager', description: 'Develop and execute brand strategy and positioning', skill_keywords: ['Brand Strategy', 'Market Research', 'Campaign Management', 'Consumer Insights', 'Budget Management'] },
    { name: 'Performance Marketing Manager', description: 'Drive customer acquisition through data-driven paid channels', skill_keywords: ['Google Ads', 'Meta Ads', 'Programmatic', 'A/B Testing', 'Attribution Modelling'] },
  ],
  'Human Resources & Recruitment': [
    { name: 'HR Business Partner', description: 'Align HR strategies with business objectives', skill_keywords: ['Talent Management', 'OD', 'Employee Relations', 'Data Analytics', 'Business Acumen'] },
    { name: 'Talent Acquisition Specialist', description: 'Source, assess and hire top talent', skill_keywords: ['Sourcing', 'LinkedIn Recruiter', 'Interviewing', 'Employer Branding', 'ATS'] },
    { name: 'Compensation & Benefits Manager', description: 'Design and manage total rewards programmes', skill_keywords: ['Job Evaluation', 'Salary Benchmarking', 'MOM Regulations', 'Benefits Design', 'Analytics'] },
    { name: 'Learning & OD Specialist', description: 'Drive learning culture and organisational development', skill_keywords: ['L&D', 'Change Management', 'Coaching', 'Assessment Centres', 'ACTA/ACLP'] },
    { name: 'HR Analytics Manager', description: 'Leverage data to drive HR decisions', skill_keywords: ['HR Analytics', 'Python/R', 'HRIS', 'Dashboard', 'People Analytics'] },
  ],
  'Legal & Compliance': [
    { name: 'Legal Counsel', description: 'Provide legal advice and manage corporate legal matters', skill_keywords: ['Contract Law', 'Corporate Law', 'Legal Research', 'Negotiation', 'Singapore Bar'] },
    { name: 'Compliance Manager', description: 'Ensure regulatory compliance across business units', skill_keywords: ['MAS/PDPC Regulations', 'Risk Management', 'AML', 'Compliance Frameworks', 'Investigations'] },
    { name: 'Data Protection Officer', description: 'Manage personal data protection compliance under PDPA', skill_keywords: ['PDPA', 'GDPR', 'Data Governance', 'Privacy Impact Assessment', 'CIPM'] },
    { name: 'Paralegal', description: 'Support lawyers with legal research and documentation', skill_keywords: ['Legal Research', 'Contract Review', 'Court Filings', 'Case Management', 'LawNet'] },
  ],
  'Retail & E-commerce': [
    { name: 'E-commerce Manager', description: 'Manage online store operations and performance', skill_keywords: ['Shopify', 'Marketplace Management', 'Analytics', 'Digital Marketing', 'Inventory Management'] },
    { name: 'Category Manager', description: 'Manage product assortment, pricing and supplier relationships', skill_keywords: ['Category Strategy', 'Buyer Negotiation', 'Planogramming', 'Sales Analytics', 'Supplier Management'] },
    { name: 'Retail Operations Manager', description: 'Oversee store operations, staffing and performance', skill_keywords: ['Store Operations', 'POS Systems', 'Visual Merchandising', 'P&L Management', 'Customer Experience'] },
    { name: 'Supply Chain Analyst', description: 'Analyse and optimise supply chain operations', skill_keywords: ['Demand Planning', 'ERP Systems', 'Excel', 'Logistics Coordination', 'Inventory Optimisation'] },
  ],
  'Logistics & Supply Chain': [
    { name: 'Logistics Coordinator', description: 'Coordinate freight movements and delivery operations', skill_keywords: ['Freight Management', 'Incoterms', 'WMS', 'TMS', 'Customs Clearance'] },
    { name: 'Supply Chain Manager', description: 'Manage end-to-end supply chain operations', skill_keywords: ['Supply Chain Strategy', 'ERP', 'S&OP', 'Supplier Management', 'APICS CPIM'] },
    { name: 'Warehouse Manager', description: 'Manage warehouse operations, inventory and fulfilment', skill_keywords: ['WMS', 'Inventory Management', 'Lean', '5S', 'Safety Management'] },
    { name: 'Procurement Manager', description: 'Lead sourcing and procurement activities', skill_keywords: ['Strategic Sourcing', 'Contract Negotiation', 'Category Management', 'ERP', 'CIPS'] },
  ],
  'Construction & Built Environment': [
    { name: 'Civil Engineer', description: 'Design and oversee civil infrastructure projects', skill_keywords: ['AutoCAD', 'BIM', 'Structural Analysis', 'Project Management', 'PE Singapore'] },
    { name: 'Project Manager (Construction)', description: 'Lead construction projects from planning to completion', skill_keywords: ['BCA Regulations', 'BIM', 'Cost Management', 'Project Scheduling', 'PMP/PMC'] },
    { name: 'Quantity Surveyor', description: 'Manage costs and contracts for construction projects', skill_keywords: ['Cost Estimation', 'BOQ', 'Contract Administration', 'RICS', 'Primavera'] },
    { name: 'Building Information Modelling (BIM) Manager', description: 'Lead BIM implementation and digital delivery', skill_keywords: ['Revit', 'Navisworks', 'BIM Execution Plan', 'ISO 19650', 'Coordination'] },
  ],
  'Media & Entertainment': [
    { name: 'Video Producer/Director', description: 'Produce and direct video content for media platforms', skill_keywords: ['Video Production', 'Directing', 'Adobe Premiere', 'After Effects', 'Storytelling'] },
    { name: 'Game Designer', description: 'Design game mechanics, levels and player experiences', skill_keywords: ['Unity/Unreal', 'Game Mechanics', 'Level Design', 'UX', 'Prototyping'] },
    { name: 'Animator/Motion Graphics Designer', description: 'Create animations and motion graphics for media', skill_keywords: ['After Effects', 'Cinema 4D', 'Blender', 'Motion Design', '3D Animation'] },
    { name: 'Media Planner', description: 'Plan and buy media placements for advertising campaigns', skill_keywords: ['Media Planning', 'Programmatic', 'Nielsen', 'Campaign Analytics', 'OOH/Digital'] },
  ],
  'Government & Public Services': [
    { name: 'Policy Analyst', description: 'Research and develop public policy recommendations', skill_keywords: ['Policy Analysis', 'Research Methods', 'Stakeholder Engagement', 'Economics', 'Data Analysis'] },
    { name: 'Smart Nation Project Manager', description: 'Drive digital government and smart nation initiatives', skill_keywords: ['Digital Government', 'Agile', 'Stakeholder Management', 'Tech Policy', 'PMO'] },
    { name: 'Social Worker', description: 'Provide casework and community support services', skill_keywords: ['Case Management', 'Counselling', 'Community Development', 'MSW', 'NCSS'] },
    { name: 'Urban Planner', description: 'Plan land use and urban development strategies', skill_keywords: ['GIS', 'Urban Design', 'Master Planning', 'URA Regulations', 'Public Consultation'] },
  ],
  'Hospitality & Tourism': [
    { name: 'Hotel Operations Manager', description: 'Oversee hotel operations and guest experience', skill_keywords: ['Hotel PMS', 'Revenue Management', 'F&B Operations', 'Guest Relations', 'SHR Singapore'] },
    { name: 'Revenue Manager', description: 'Optimise hotel pricing and inventory management', skill_keywords: ['Revenue Management Systems', 'OTA Management', 'Forecasting', 'Pricing Strategy', 'Excel'] },
    { name: 'Tour & Travel Consultant', description: 'Plan and sell travel packages and experiences', skill_keywords: ['GDS Systems', 'IATA', 'Destination Knowledge', 'Customer Service', 'CRM'] },
    { name: 'F&B Manager', description: 'Manage food and beverage operations and teams', skill_keywords: ['Menu Planning', 'Cost Control', 'SFA Regulations', 'Team Management', 'Hospitality'] },
  ],
  'Professional Services': [
    { name: 'Management Consultant', description: 'Advise organisations on strategy and operations', skill_keywords: ['Strategy', 'Business Analysis', 'Stakeholder Management', 'Presentation', 'MBA'] },
    { name: 'Audit Manager', description: 'Lead financial and internal audit engagements', skill_keywords: ['IFRS/FRS', 'ISA', 'Risk Assessment', 'CPA/CA', 'Internal Controls'] },
    { name: 'Tax Consultant', description: 'Provide tax advisory and compliance services', skill_keywords: ['Singapore Tax', 'IRAS', 'GST', 'Transfer Pricing', 'SCTP/CTA'] },
    { name: 'Business Analyst', description: 'Analyse business needs and translate to solutions', skill_keywords: ['Requirements Gathering', 'Process Mapping', 'SQL', 'Agile', 'Stakeholder Management'] },
    { name: 'Strategy Manager', description: 'Drive corporate strategy and transformation initiatives', skill_keywords: ['Strategy Development', 'M&A', 'Market Analysis', 'Financial Modelling', 'Executive Reporting'] },
  ],
};

async function seed() {
  await client.connect();
  console.log('Connected to Neon. Seeding industries and job roles...\n');
  let industriesAdded = 0;
  let rolesAdded = 0;
  let industriesSkipped = 0;
  let rolesSkipped = 0;

  for (const industry of SEED_INDUSTRIES) {
    const existRes = await client.query('SELECT id FROM industries WHERE name = $1', [industry.name]);
    let industryId;

    if (existRes.rows.length === 0) {
      const res = await client.query(
        'INSERT INTO industries (name, description) VALUES ($1, $2) RETURNING id',
        [industry.name, industry.description]
      );
      industryId = res.rows[0].id;
      industriesAdded++;
      console.log(`  + Industry: ${industry.name}`);
    } else {
      industryId = existRes.rows[0].id;
      industriesSkipped++;
    }

    const roles = SEED_JOB_ROLES[industry.name] || [];
    for (const role of roles) {
      const existRole = await client.query(
        'SELECT id FROM job_roles WHERE industry_id = $1 AND name = $2',
        [industryId, role.name]
      );
      if (existRole.rows.length === 0) {
        await client.query(
          'INSERT INTO job_roles (industry_id, name, description, skill_keywords) VALUES ($1, $2, $3, $4)',
          [industryId, role.name, role.description, role.skill_keywords]
        );
        rolesAdded++;
      } else {
        rolesSkipped++;
      }
    }
  }

  await client.end();
  console.log(`\nDone!`);
  console.log(`Industries: ${industriesAdded} added, ${industriesSkipped} already existed`);
  console.log(`Job roles:  ${rolesAdded} added, ${rolesSkipped} already existed`);
}

seed().catch(err => { console.error('Seed failed:', err.message); process.exit(1); });
