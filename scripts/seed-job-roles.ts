import { readFileSync } from 'fs';
import path from 'path';

const env = readFileSync(path.join(process.cwd(), '.env.local'), 'utf8');
for (const line of env.split('\n')) {
  const eqIdx = line.indexOf('=');
  if (eqIdx > 0) process.env[line.slice(0, eqIdx).trim()] = line.slice(eqIdx + 1).trim();
}

import { db } from '../lib/db';

// Singapore Skills Framework-aligned job roles per industry
const ROLES_BY_INDUSTRY: Record<string, string[]> = {
  'Accountancy': [
    'Accountant', 'Senior Accountant', 'Audit Associate', 'Senior Auditor', 'External Auditor',
    'Internal Auditor', 'Tax Consultant', 'Tax Manager', 'Management Accountant',
    'Financial Controller', 'Chief Financial Officer', 'Treasury Analyst', 'Treasury Manager',
    'Forensic Accountant', 'Compliance Officer', 'Finance Business Partner',
    'Accounts Payable Executive', 'Accounts Receivable Executive',
  ],
  'Aerospace': [
    'Aerospace Engineer', 'Aircraft Maintenance Engineer (Airframe)', 'Aircraft Maintenance Engineer (Avionics)',
    'Aircraft Maintenance Engineer (Engine)', 'Avionics Technician', 'Quality Assurance Engineer',
    'Materials Engineer', 'Systems Integration Engineer', 'Aerospace Test Engineer',
    'Supply Chain Analyst', 'Technical Services Engineer', 'Licensed Aircraft Engineer',
    'Ground Support Equipment Technician', 'Aerospace Manufacturing Engineer',
  ],
  'Air Transport': [
    'Pilot', 'First Officer', 'Cabin Crew', 'Flight Operations Officer',
    'Air Traffic Controller', 'Airport Operations Executive', 'Ground Handling Supervisor',
    'Cargo Operations Executive', 'Safety & Quality Assurance Officer', 'Airline Revenue Manager',
  ],
  'Arts and Entertainment': [
    'Arts Administrator', 'Curator', 'Exhibition Designer', 'Film Director', 'Film Producer',
    'Music Producer', 'Sound Engineer', 'Events Manager', 'Creative Producer',
    'Theatre Director', 'Lighting Designer', 'Costume Designer', 'Set Designer',
    'Content Creator', 'Games Designer', 'Animation Director', 'Production Manager',
    'Cultural Programme Manager', 'Heritage Specialist',
  ],
  'Biopharmaceuticals Manufacturing': [
    'Bioprocess Engineer', 'Quality Assurance Manager', 'Quality Control Analyst',
    'Regulatory Affairs Specialist', 'Manufacturing Scientist', 'Validation Engineer',
    'Cell Culture Scientist', 'Downstream Processing Scientist', 'Technical Transfer Specialist',
    'GMP Compliance Officer', 'Supply Chain Analyst', 'Environmental Health & Safety Manager',
  ],
  'Construction & Built Environment': [
    'Civil Engineer', 'Structural Engineer', 'Mechanical & Electrical Engineer',
    'Project Manager', 'Quantity Surveyor', 'Building Information Modelling (BIM) Manager',
    'Site Supervisor', 'Safety Officer', 'Architect', 'Contracts Manager',
    'Facilities Manager', 'Green Building Consultant',
  ],
  'Design': [
    'Graphic Designer', 'UX Designer', 'UI Designer', 'Product Designer',
    'Industrial Designer', 'Interior Designer', 'Fashion Designer',
    'Brand Designer', 'Motion Graphics Designer', 'Service Designer',
    'Design Strategist', 'Creative Director', 'Art Director',
  ],
  'Early Childhood Care and Education': [
    'Preschool Teacher', 'Senior Preschool Teacher', 'Lead Teacher',
    'Centre Director', 'Assistant Director (Curriculum)', 'Curriculum Developer',
    'Special Needs Educator', 'Learning Support Educator', 'Vice Principal', 'Principal',
  ],
  'Education & Training': [
    'Teacher', 'Senior Teacher', 'Lead Teacher', 'Head of Department',
    'School Counsellor', 'Educational Psychologist', 'Corporate Trainer',
    'Training Consultant', 'Instructional Designer', 'Curriculum Developer',
    'Learning & Development Manager', 'Adult Educator',
  ],
  'Electronics': [
    'Electronics Engineer', 'Hardware Engineer', 'Embedded Systems Engineer',
    'Test & Measurement Engineer', 'Process Engineer', 'Product Engineer',
    'Reliability Engineer', 'Systems Engineer', 'R&D Engineer',
    'IC Design Engineer', 'PCB Design Engineer', 'Manufacturing Engineer',
  ],
  'Energy and Chemicals': [
    'Chemical Engineer', 'Process Engineer', 'Plant Manager', 'Operations Engineer',
    'HSE Manager', 'Environmental Engineer', 'Quality Control Engineer',
    'Energy Analyst', 'Petrochemical Engineer', 'Laboratory Analyst',
    'Instrumentation Engineer', 'Maintenance Engineer', 'Project Engineer',
    'Refinery Engineer', 'Polymer Scientist',
  ],
  'Energy and Power': [
    'Electrical Engineer', 'Power Systems Engineer', 'Renewable Energy Engineer',
    'Grid Operations Engineer', 'Energy Analyst', 'Asset Manager',
    'Project Manager (Power)', 'Instrumentation & Control Engineer',
    'Solar Energy Specialist', 'Battery Storage Engineer',
  ],
  'Engineering & Manufacturing': [
    'Mechanical Engineer', 'Manufacturing Engineer', 'Industrial Engineer',
    'Quality Engineer', 'Process Improvement Engineer', 'Automation Engineer',
    'Robotics Engineer', 'Supply Chain Manager', 'Operations Manager',
    'Production Supervisor', 'Maintenance Engineer', 'R&D Engineer',
  ],
  'Environmental Services': [
    'Environmental Engineer', 'Waste Management Specialist', 'Environmental Consultant',
    'Sustainability Manager', 'Environmental Compliance Officer',
    'Circular Economy Specialist', 'Carbon Management Analyst',
    'Environmental Data Analyst', 'Green Procurement Specialist',
  ],
  'Finance & Banking': [
    'Relationship Manager', 'Investment Analyst', 'Financial Planner',
    'Risk Analyst', 'Compliance Manager', 'Treasury Dealer',
    'Private Banker', 'Retail Banker', 'Trade Finance Specialist',
    'Wealth Manager', 'FinTech Product Manager', 'AML Specialist',
  ],
  'Food Manufacturing': [
    'Food Technologist', 'Food Scientist', 'Quality Assurance Manager',
    'Production Supervisor', 'R&D Manager', 'Regulatory Affairs Executive',
    'Supply Chain Manager', 'Food Safety Auditor', 'Nutrition Scientist',
    'Process Engineer (Food)', 'Sensory Scientist',
  ],
  'Food Services': [
    'Restaurant Manager', 'Head Chef', 'Sous Chef', 'Pastry Chef',
    'F&B Operations Manager', 'Food & Beverage Director',
    'Kitchen Manager', 'Catering Manager', 'Culinary Instructor',
    'Food Safety Officer', 'Barista', 'Sommelier',
  ],
  'Government & Public Services': [
    'Policy Analyst', 'Public Service Officer', 'Urban Planner',
    'Public Communications Officer', 'Programme Manager', 'Data Analyst (Public Sector)',
    'Digital Government Specialist', 'Social Worker', 'Community Development Officer',
    'Regulatory Officer', 'Intelligence Analyst',
  ],
  'Hospitality & Tourism': [
    'Hotel Manager', 'Front Office Manager', 'Revenue Manager',
    'Guest Relations Manager', 'Concierge', 'Event Coordinator',
    'Tour Manager', 'Travel Consultant', 'MICE Executive',
    'Housekeeping Manager', 'Spa Manager',
  ],
  'Hotel and Accommodation Services': [
    'General Manager', 'Front Desk Executive', 'Reservations Manager',
    'Food & Beverage Manager', 'Banquet Manager', 'Revenue Analyst',
    'Housekeeping Supervisor', 'Butler', 'Duty Manager',
    'Sales & Marketing Manager', 'Digital Marketing Executive',
  ],
  'Human Resources & Recruitment': [
    'HR Business Partner', 'Talent Acquisition Specialist', 'Compensation & Benefits Manager',
    'Learning & Development Manager', 'HR Analytics Specialist',
    'Employee Engagement Manager', 'HR Director', 'Payroll Manager',
    'Organisational Development Consultant', 'HR Technology Specialist',
  ],
  'Information & Communications Technology': [
    'Software Engineer', 'Senior Software Engineer', 'Frontend Developer',
    'Backend Developer', 'Mobile App Developer', 'DevOps Engineer',
    'Site Reliability Engineer', 'Cloud Architect', 'Solutions Architect',
    'Data Analyst', 'Data Engineer', 'Data Scientist', 'Machine Learning Engineer',
    'AI Engineer', 'Business Analyst', 'Product Manager', 'IT Project Manager',
    'Cybersecurity Analyst', 'Security Engineer', 'Network Engineer',
    'Infrastructure Engineer', 'Database Administrator', 'Technical Lead',
    'Engineering Manager', 'CTO',
  ],
  'Insurance': [
    'Insurance Agent', 'Financial Adviser', 'Underwriter', 'Claims Adjuster',
    'Actuary', 'Risk Manager', 'Reinsurance Analyst', 'Insurance Product Manager',
    'Compliance Manager', 'Insurance Data Analyst', 'Loss Adjuster',
    'Life Insurance Consultant', 'General Insurance Manager',
  ],
  'Landscape': [
    'Landscape Architect', 'Landscape Designer', 'Horticulturist',
    'Parks Manager', 'Arborist', 'Urban Farmer',
    'Landscape Project Manager', 'Turf Specialist', 'Irrigation Engineer',
    'Environmental Planner',
  ],
  'Legal': [
    'Legal Associate', 'Senior Associate', 'Partner',
    'In-house Counsel', 'Corporate Lawyer', 'Litigation Lawyer',
    'Conveyancing Lawyer', 'IP Lawyer', 'Employment Lawyer',
    'Legal Research Associate', 'Paralegal', 'Legal Executive',
    'Compliance Counsel', 'Contract Manager', 'Legal Technology Specialist',
  ],
  'Logistics & Supply Chain': [
    'Supply Chain Analyst', 'Logistics Coordinator', 'Warehouse Manager',
    'Freight Forwarding Executive', 'Customs Clearance Executive',
    'Procurement Manager', 'Inventory Manager', 'Last-Mile Delivery Manager',
    'Supply Chain Planner', 'Trade Compliance Specialist',
    'Cold Chain Logistics Specialist', 'E-Commerce Fulfilment Manager',
  ],
  'Marine and Offshore Engineering': [
    'Naval Architect', 'Marine Engineer', 'Offshore Engineer',
    'Structural Engineer (Marine)', 'Piping Engineer', 'HSE Manager',
    'Marine Operations Manager', 'Shipbuilding Project Manager',
    'Marine Electrical Engineer', 'Classification Surveyor',
  ],
  'Marketing, PR & Communications': [
    'Digital Marketing Manager', 'Content Marketing Specialist',
    'Brand Manager', 'PR Manager', 'SEO Specialist',
    'Performance Marketing Manager', 'Social Media Manager',
    'Growth Hacker', 'Creative Director', 'Marketing Analytics Manager',
    'CRM Manager', 'Influencer Marketing Manager',
  ],
  'Media & Entertainment': [
    'Journalist', 'Editor', 'Video Producer', 'Content Strategist',
    'Broadcast Engineer', 'Digital Content Manager', 'UX Writer',
    'Creative Copywriter', 'Podcast Producer', 'Social Media Content Creator',
    'Documentary Filmmaker', 'Game Developer', 'Game Artist',
  ],
  'Precision Engineering': [
    'Precision Engineer', 'CNC Machinist', 'Quality Inspector',
    'Manufacturing Engineer', 'Tooling Engineer', 'Metrology Engineer',
    'Process Engineer (Precision)', 'Automation Specialist',
    'CAD/CAM Engineer', 'Polymer Engineer', 'Additive Manufacturing Engineer',
  ],
  'Professional Services': [
    'Management Consultant', 'Strategy Consultant', 'Business Process Analyst',
    'Change Management Consultant', 'IT Consultant', 'Financial Consultant',
    'Operations Consultant', 'ESG Consultant', 'Data Analytics Consultant',
    'Digital Transformation Consultant',
  ],
  'Public Service (Education)': [
    'Teacher', 'Senior Teacher', 'Head of Department', 'Vice Principal', 'Principal',
    'Education Officer', 'Curriculum Specialist', 'School Counsellor',
    'Educational Researcher', 'Training & Development Officer',
  ],
  'Public Transport': [
    'Train Operations Controller', 'Station Manager', 'Bus Operations Planner',
    'Fleet Engineer', 'Maintenance Technician', 'Transport Planner',
    'Passenger Experience Manager', 'Safety Officer (Transport)',
    'Ticketing Systems Engineer', 'Sustainability Manager (Transport)',
  ],
  'Retail & E-commerce': [
    'Store Manager', 'Retail Operations Manager', 'E-Commerce Manager',
    'Merchandising Manager', 'Category Manager', 'Retail Buyer',
    'Customer Experience Manager', 'Visual Merchandiser',
    'Retail Data Analyst', 'Digital Commerce Specialist', 'Omnichannel Manager',
  ],
  'Sea Transport': [
    'Ship Captain', 'Chief Officer', 'Marine Superintendent',
    'Port Operations Manager', 'Vessel Traffic Services Officer',
    'Maritime Lawyer', 'Ship Broker', 'Cargo Superintendent',
    'Port State Control Officer', 'Marine Surveyor', 'Harbour Pilot',
  ],
  'Security': [
    'Security Manager', 'Security Consultant', 'Threat Intelligence Analyst',
    'Physical Security Specialist', 'Crisis Management Officer',
    'Executive Protection Specialist', 'Investigations Manager',
    'Security Systems Technician', 'Cybersecurity Manager',
  ],
  'Social Service': [
    'Social Worker', 'Senior Social Worker', 'Case Manager',
    'Family Service Practitioner', 'Medical Social Worker',
    'Community Development Officer', 'Counsellor', 'Psychologist',
    'Programme Manager (Social Service)', 'Volunteer Manager',
    'Youth Worker', 'Senior Programme Executive',
  ],
  'Tourism': [
    'Tourism Product Manager', 'MICE Specialist', 'Tour Guide',
    'Destination Marketing Manager', 'Travel Technology Specialist',
    'Sustainable Tourism Manager', 'Hotel Revenue Manager',
    'Visitor Experience Designer', 'Tourism Data Analyst',
    'Cultural Heritage Manager', 'Cruise Operations Manager',
  ],
  'Training and Adult Education': [
    'Corporate Trainer', 'Adult Educator', 'Instructional Designer',
    'Learning Experience Designer', 'SkillsFuture Advisor',
    'Training Manager', 'E-Learning Developer', 'Training Needs Analyst',
    'Facilitation Specialist', 'Career Coach',
  ],
  'Wholesale Trade': [
    'Business Development Manager', 'Trade Sales Executive',
    'Supply Chain Manager', 'Procurement Executive',
    'Export Manager', 'Import Manager', 'Trade Finance Executive',
    'Category Manager', 'Account Manager', 'Logistics Coordinator',
    'Commodity Trader', 'Market Analyst',
  ],
};

async function main() {
  const sql = db();
  let added = 0;
  let skipped = 0;

  for (const [industryName, roles] of Object.entries(ROLES_BY_INDUSTRY)) {
    const [industry] = await sql`SELECT id FROM industries WHERE name = ${industryName}`;
    if (!industry) {
      console.log(`  ⚠️  Industry not found: ${industryName}`);
      continue;
    }

    const existing = await sql`SELECT name FROM job_roles WHERE industry_id = ${industry.id}`;
    const existingNames = new Set(existing.map(r => (r.name as string).toLowerCase()));

    for (const role of roles) {
      if (existingNames.has(role.toLowerCase())) {
        skipped++;
      } else {
        await sql`INSERT INTO job_roles (industry_id, name) VALUES (${industry.id}, ${role})`;
        added++;
      }
    }
  }

  console.log(`\n✅ Done: ${added} roles added, ${skipped} already existed`);

  // Final count per industry
  console.log('\n=== Updated role counts ===');
  const counts = await sql`
    SELECT i.name, COUNT(jr.id) AS c
    FROM industries i LEFT JOIN job_roles jr ON jr.industry_id = i.id
    GROUP BY i.id, i.name ORDER BY i.name
  `;
  for (const r of counts) console.log(`  ${String(r.c).padStart(3)}  ${r.name}`);

  process.exit(0);
}

main().catch(e => { console.error('Failed:', e.message); process.exit(1); });
