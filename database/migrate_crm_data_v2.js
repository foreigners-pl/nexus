/**
 * CRM Data Migration Script v2
 * 
 * This script:
 * 1. Imports clients from Clients sheet with codes CL000208+
 * 2. Matches cases to clients by name/phone
 * 3. Creates new clients for unmatched cases
 * 4. Imports cases with codes C0000196+
 * 
 * SAFE: Does NOT insert new countries/cities - only matches existing ones.
 * 
 * Usage: node migrate_crm_data_v2.js > migration_v2.sql
 */

const XLSX = require('xlsx');
const path = require('path');

// ============================================================================
// CONFIGURATION
// ============================================================================
const VALID_ASSIGNEES = ['Bismark', 'Marcel', 'Sarvan', 'Damjan'];
const NEXT_CLIENT_CODE = 209;  // CL000209
const NEXT_CASE_CODE = 197;    // C0000197

// Read Excel file
const filePath = path.join(__dirname, 'crm_migration_fixed.xlsx');
const workbook = XLSX.readFile(filePath);

const clientsData = XLSX.utils.sheet_to_json(workbook.Sheets['Clients']);
const casesData = XLSX.utils.sheet_to_json(workbook.Sheets['Cases']);

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function parseDate(dateStr) {
  if (!dateStr) return null;
  const cleaned = dateStr.replace(/(\d+)(st|nd|rd|th)/g, '$1');
  const date = new Date(cleaned);
  if (isNaN(date.getTime())) {
    console.error(`-- WARNING: Could not parse date: ${dateStr}`);
    return null;
  }
  return date.toISOString();
}

function escapeSQL(str) {
  if (str === null || str === undefined || str === '') return 'NULL';
  return `'${String(str).replace(/'/g, "''")}'`;
}

function parseAssignees(assigneeStr) {
  if (!assigneeStr || assigneeStr === '[]') return [];
  const match = assigneeStr.match(/\[(.*)\]/);
  if (!match) return [];
  return match[1].split(',').map(s => s.trim()).filter(Boolean);
}

function matchValidAssignee(name) {
  const nameLower = name.toLowerCase();
  for (const valid of VALID_ASSIGNEES) {
    if (nameLower.includes(valid.toLowerCase()) || valid.toLowerCase().includes(nameLower.split(' ')[0].toLowerCase())) {
      return valid;
    }
  }
  return null;
}

function normalizePhone(phone) {
  if (!phone) return null;
  return phone.replace(/[\s\-\(\)]/g, '').trim();
}

// Parse phone into country code and number
function parsePhone(phone) {
  if (!phone) return { countryCode: null, number: null };
  
  let trimmed = phone.trim();
  
  // Handle missing + prefix
  if (!trimmed.startsWith('+') && trimmed.match(/^\d/)) {
    // Assume Polish number if starts with 48
    if (trimmed.startsWith('48 ') || trimmed.startsWith('48') && trimmed.length > 10) {
      trimmed = '+' + trimmed;
    }
  }
  
  // If has space after country code: "+48 516 795 560"
  const spaceMatch = trimmed.match(/^(\+\d{1,4})\s+(.+)$/);
  if (spaceMatch) {
    return { countryCode: spaceMatch[1], number: spaceMatch[2].replace(/\s+/g, ' ').trim() };
  }
  
  // No space - need to intelligently split based on country code length
  // Country codes by length (match LONGEST first):
  
  // 4 digits (rare)
  const fourDigit = ['+1242', '+1246', '+1264', '+1268', '+1284', '+1340', '+1345', '+1441', '+1473', '+1649', '+1664', '+1670', '+1671', '+1684', '+1721', '+1758', '+1767', '+1784', '+1787', '+1809', '+1829', '+1849', '+1868', '+1869', '+1876', '+1939'];
  
  // 3 digits
  const threeDigit = [
    '+212', '+213', '+216', '+218', '+220', '+221', '+222', '+223', '+224', '+225', '+226', '+227', '+228', '+229',
    '+230', '+231', '+232', '+233', '+234', '+235', '+236', '+237', '+238', '+239', '+240', '+241', '+242', '+243',
    '+244', '+245', '+246', '+247', '+248', '+249', '+250', '+251', '+252', '+253', '+254', '+255', '+256', '+257',
    '+258', '+260', '+261', '+262', '+263', '+264', '+265', '+266', '+267', '+268', '+269', '+290', '+291', '+297',
    '+298', '+299', '+350', '+351', '+352', '+353', '+354', '+355', '+356', '+357', '+358', '+359', '+370', '+371',
    '+372', '+373', '+374', '+375', '+376', '+377', '+378', '+379', '+380', '+381', '+382', '+383', '+385', '+386',
    '+387', '+389', '+420', '+421', '+423', '+500', '+501', '+502', '+503', '+504', '+505', '+506', '+507', '+508',
    '+509', '+590', '+591', '+592', '+593', '+594', '+595', '+596', '+597', '+598', '+599', '+670', '+672', '+673',
    '+674', '+675', '+676', '+677', '+678', '+679', '+680', '+681', '+682', '+683', '+685', '+686', '+687', '+688',
    '+689', '+690', '+691', '+692', '+850', '+852', '+853', '+855', '+856', '+870', '+880', '+881', '+882', '+883',
    '+886', '+960', '+961', '+962', '+963', '+964', '+965', '+966', '+967', '+968', '+970', '+971', '+972', '+973',
    '+974', '+975', '+976', '+977', '+992', '+993', '+994', '+995', '+996', '+998', '+818'
  ];
  
  // 2 digits
  const twoDigit = [
    '+20', '+27', '+30', '+31', '+32', '+33', '+34', '+36', '+39', '+40', '+41', '+43', '+44', '+45', '+46', '+47',
    '+48', '+49', '+51', '+52', '+53', '+54', '+55', '+56', '+57', '+58', '+60', '+61', '+62', '+63', '+64', '+65',
    '+66', '+81', '+82', '+84', '+86', '+90', '+91', '+92', '+93', '+94', '+95', '+98'
  ];
  
  // 1 digit
  const oneDigit = ['+1', '+7'];
  
  // Try matching in order of specificity (longest first)
  for (const code of fourDigit) {
    if (trimmed.startsWith(code)) {
      const number = trimmed.substring(code.length);
      if (number.length >= 5) return { countryCode: code, number: number };
    }
  }
  
  for (const code of threeDigit) {
    if (trimmed.startsWith(code)) {
      const number = trimmed.substring(code.length);
      if (number.length >= 5) return { countryCode: code, number: number };
    }
  }
  
  for (const code of twoDigit) {
    if (trimmed.startsWith(code)) {
      const number = trimmed.substring(code.length);
      if (number.length >= 5) return { countryCode: code, number: number };
    }
  }
  
  for (const code of oneDigit) {
    if (trimmed.startsWith(code)) {
      const number = trimmed.substring(code.length);
      if (number.length >= 5) return { countryCode: code, number: number };
    }
  }
  
  // Last resort: just return as number without country code
  return { countryCode: null, number: trimmed.startsWith('+') ? trimmed.substring(1) : trimmed };
}

function normalizeName(name) {
  if (!name) return null;
  return name.toLowerCase().trim();
}

function formatClientCode(num) {
  return `CL${String(num).padStart(6, '0')}`;
}

function formatCaseCode(num) {
  return `C${String(num).padStart(7, '0')}`;
}

// ============================================================================
// BUILD CLIENT LOOKUP FROM CLIENTS SHEET
// ============================================================================
const clientLookup = new Map(); // phone -> client
const clientNameLookup = new Map(); // normalized name -> client

clientsData.forEach((client, index) => {
  client._migrationIndex = index;
  
  const phone = normalizePhone(client.phone);
  if (phone) {
    clientLookup.set(phone, client);
  }
  
  // Build full name
  const fullName = [client.first_name, client.last_name].filter(Boolean).join(' ');
  const normalizedName = normalizeName(fullName);
  if (normalizedName) {
    clientNameLookup.set(normalizedName, client);
  }
});

// ============================================================================
// MATCH CASES TO CLIENTS OR CREATE NEW ONES
// ============================================================================
const casesToClients = new Map(); // case_id -> client (existing or new)
const newClientsFromCases = []; // clients created from case data
const matchedByPhone = [];
const matchedByName = [];
const createdNew = [];

casesData.forEach(caseData => {
  const casePhone = normalizePhone(caseData.title_phone);
  const caseName = normalizeName(caseData.title_name);
  
  let matchedClient = null;
  
  // Try phone match first (most reliable)
  if (casePhone && clientLookup.has(casePhone)) {
    matchedClient = clientLookup.get(casePhone);
    matchedByPhone.push({ case: caseData.case_id, client: matchedClient.first_name });
  }
  // Try name match
  else if (caseName && clientNameLookup.has(caseName)) {
    matchedClient = clientNameLookup.get(caseName);
    matchedByName.push({ case: caseData.case_id, client: matchedClient.first_name });
  }
  // Also try partial name match (first name only)
  else if (caseName) {
    for (const [name, client] of clientNameLookup.entries()) {
      if (name.includes(caseName) || caseName.includes(name.split(' ')[0])) {
        matchedClient = client;
        matchedByName.push({ case: caseData.case_id, client: matchedClient.first_name, partial: true });
        break;
      }
    }
  }
  
  // If still no match, create new client from case data
  if (!matchedClient) {
    const newClient = {
      _isNew: true,
      _fromCaseId: caseData.case_id,
      first_name: caseData.title_name || 'Unknown',
      phone: caseData.title_phone || null,
      date_created: caseData.date_created
    };
    newClientsFromCases.push(newClient);
    matchedClient = newClient;
    createdNew.push({ case: caseData.case_id, name: newClient.first_name });
    
    // Add to lookups so subsequent cases can match
    const phone = normalizePhone(newClient.phone);
    if (phone) clientLookup.set(phone, newClient);
    const name = normalizeName(newClient.first_name);
    if (name) clientNameLookup.set(name, newClient);
  }
  
  casesToClients.set(caseData.case_id, matchedClient);
});

// ============================================================================
// GENERATE SQL
// ============================================================================

console.log('-- ============================================================================');
console.log('-- CRM DATA MIGRATION v2');
console.log('-- Generated: ' + new Date().toISOString());
console.log('-- ============================================================================');
console.log('-- Existing clients from sheet: ' + clientsData.length);
console.log('-- New clients from cases: ' + newClientsFromCases.length);
console.log('-- Total cases: ' + casesData.length);
console.log('-- ');
console.log('-- Client codes starting: ' + formatClientCode(NEXT_CLIENT_CODE));
console.log('-- Case codes starting: ' + formatCaseCode(NEXT_CASE_CODE));
console.log('-- ');
console.log('-- Matched by phone: ' + matchedByPhone.length);
console.log('-- Matched by name: ' + matchedByName.length);
console.log('-- Created new: ' + createdNew.length);
console.log('-- ============================================================================');
console.log('');
console.log('BEGIN;');
console.log('');

// Create mapping tables
console.log('-- ============================================================================');
console.log('-- STEP 1: CREATE MAPPING TABLES');
console.log('-- ============================================================================');
console.log('CREATE TEMP TABLE client_migration_map (');
console.log('  migration_key TEXT PRIMARY KEY,');
console.log('  new_uuid UUID');
console.log(');');
console.log('');
console.log('CREATE TEMP TABLE case_migration_map (');
console.log('  old_case_id TEXT PRIMARY KEY,');
console.log('  new_uuid UUID');
console.log(');');
console.log('');

// Get default status
console.log('-- ============================================================================');
console.log('-- STEP 2: GET DEFAULT STATUS');
console.log('-- ============================================================================');
console.log(`
DO $$
DECLARE
  default_status_id UUID;
BEGIN
  SELECT id INTO default_status_id FROM status WHERE name = 'Lead' LIMIT 1;
  IF default_status_id IS NULL THEN
    SELECT id INTO default_status_id FROM status ORDER BY position LIMIT 1;
  END IF;
  PERFORM set_config('migration.default_status_id', default_status_id::text, false);
END $$;
`);

// Insert existing clients from sheet
console.log('-- ============================================================================');
console.log('-- STEP 3: INSERT CLIENTS FROM SHEET (' + clientsData.length + ' clients)');
console.log('-- ============================================================================');

let clientCodeCounter = NEXT_CLIENT_CODE;

clientsData.forEach((client, index) => {
  const clientCode = formatClientCode(clientCodeCounter++);
  const firstName = client.first_name || '';
  const lastName = client.last_name || '';
  const email = client.email || null;
  const phone = client.phone || null;
  const country = client.country_of_origin || null;
  const city = client.city_poland || null;
  const createdAt = parseDate(client.date_created);
  
  const migrationKey = `sheet_${client.client_internal_id}`;
  client._migrationKey = migrationKey;
  
  const countryLookup = country 
    ? `(SELECT id FROM countries WHERE LOWER(TRIM(country)) = LOWER(TRIM(${escapeSQL(country)})) LIMIT 1)` 
    : 'NULL';
  const cityLookup = city 
    ? `(SELECT id FROM cities WHERE LOWER(TRIM(city)) = LOWER(TRIM(${escapeSQL(city)})) LIMIT 1)` 
    : 'NULL';
  
  console.log(`
-- Client ${index + 1}: ${firstName} ${lastName || ''} -> ${clientCode}
WITH new_client AS (
  INSERT INTO clients (client_code, first_name, last_name, contact_email, country_of_origin, city_in_poland, created_at)
  VALUES (
    ${escapeSQL(clientCode)},
    ${escapeSQL(firstName)},
    NULLIF(${escapeSQL(lastName)}, ''),
    NULLIF(${escapeSQL(email)}, ''),
    ${countryLookup},
    ${cityLookup},
    ${createdAt ? escapeSQL(createdAt) : 'NOW()'}
  )
  RETURNING id
)
INSERT INTO client_migration_map (migration_key, new_uuid)
SELECT ${escapeSQL(migrationKey)}, id FROM new_client;`);

  // Insert phone number if provided
  if (phone) {
    const parsed = parsePhone(phone);
    if (parsed.countryCode && parsed.number) {
      console.log(`
INSERT INTO contact_numbers (client_id, country_code, number, is_on_whatsapp)
SELECT new_uuid, ${escapeSQL(parsed.countryCode)}, ${escapeSQL(parsed.number)}, false
FROM client_migration_map WHERE migration_key = ${escapeSQL(migrationKey)};`);
    } else if (parsed.number) {
      console.log(`
INSERT INTO contact_numbers (client_id, number, is_on_whatsapp)
SELECT new_uuid, ${escapeSQL(parsed.number)}, false
FROM client_migration_map WHERE migration_key = ${escapeSQL(migrationKey)};`);
    }
  }
});
console.log('');

// Insert new clients created from cases
if (newClientsFromCases.length > 0) {
  console.log('-- ============================================================================');
  console.log('-- STEP 4: INSERT NEW CLIENTS FROM CASES (' + newClientsFromCases.length + ' clients)');
  console.log('-- ============================================================================');
  
  newClientsFromCases.forEach((client, index) => {
    const clientCode = formatClientCode(clientCodeCounter++);
    const migrationKey = `case_${client._fromCaseId}`;
    client._migrationKey = migrationKey;
    
    const createdAt = parseDate(client.date_created);
    
    console.log(`
-- New client for case ${client._fromCaseId}: ${client.first_name} -> ${clientCode}
WITH new_client AS (
  INSERT INTO clients (client_code, first_name, created_at)
  VALUES (
    ${escapeSQL(clientCode)},
    ${escapeSQL(client.first_name)},
    ${createdAt ? escapeSQL(createdAt) : 'NOW()'}
  )
  RETURNING id
)
INSERT INTO client_migration_map (migration_key, new_uuid)
SELECT ${escapeSQL(migrationKey)}, id FROM new_client;`);

    if (client.phone) {
      const parsed = parsePhone(client.phone);
      if (parsed.countryCode && parsed.number) {
        console.log(`
INSERT INTO contact_numbers (client_id, country_code, number, is_on_whatsapp)
SELECT new_uuid, ${escapeSQL(parsed.countryCode)}, ${escapeSQL(parsed.number)}, false
FROM client_migration_map WHERE migration_key = ${escapeSQL(migrationKey)};`);
      } else if (parsed.number) {
        console.log(`
INSERT INTO contact_numbers (client_id, number, is_on_whatsapp)
SELECT new_uuid, ${escapeSQL(parsed.number)}, false
FROM client_migration_map WHERE migration_key = ${escapeSQL(migrationKey)};`);
      }
    }
  });
  console.log('');
}

// Insert cases
console.log('-- ============================================================================');
console.log('-- STEP 5: INSERT CASES (' + casesData.length + ' cases)');
console.log('-- ============================================================================');

let caseCodeCounter = NEXT_CASE_CODE;

casesData.forEach((caseData, index) => {
  const caseCode = formatCaseCode(caseCodeCounter++);
  const createdAt = parseDate(caseData.date_created);
  const linkedClient = casesToClients.get(caseData.case_id);
  const clientMigrationKey = linkedClient._migrationKey || `sheet_${linkedClient.client_internal_id}`;
  
  console.log(`
-- Case ${index + 1}: ${caseData.case_id} -> ${caseCode} (client: ${linkedClient.first_name})
WITH new_case AS (
  INSERT INTO cases (case_code, client_id, status_id, created_at)
  SELECT 
    ${escapeSQL(caseCode)},
    m.new_uuid,
    (current_setting('migration.default_status_id'))::uuid,
    ${createdAt ? escapeSQL(createdAt) : 'NOW()'}
  FROM client_migration_map m
  WHERE m.migration_key = ${escapeSQL(clientMigrationKey)}
  RETURNING id
)
INSERT INTO case_migration_map (old_case_id, new_uuid)
SELECT ${escapeSQL(caseData.case_id)}, id FROM new_case;`);
});
console.log('');

// Insert case comments
console.log('-- ============================================================================');
console.log('-- STEP 6: INSERT CASE COMMENTS');
console.log('-- ============================================================================');

casesData.forEach(caseData => {
  const source = caseData.source || '';
  const comments = caseData.comments || '';
  const attachments = caseData.attachments || '';
  
  // Parse comments - could be "notes text" or "0 | 0 | notes text"
  let notesText = '';
  if (comments) {
    const parts = comments.split(' | ');
    // Take everything after the first two pipe-separated numbers
    if (parts.length > 2) {
      notesText = parts.slice(2).join(' | ').trim();
    } else if (parts.length === 1 && !comments.match(/^\d+\s*\|\s*\d+$/)) {
      notesText = comments.trim();
    }
  }
  
  let migrationNote = `[Migrated from old CRM - Source: ${source}]`;
  if (notesText) {
    migrationNote += `\n\n${notesText}`;
  }
  if (attachments) {
    migrationNote += `\n\nAttachment references: ${attachments}`;
  }
  
  console.log(`
INSERT INTO comments (case_id, text, created_at)
SELECT m.new_uuid, ${escapeSQL(migrationNote)}, NOW()
FROM case_migration_map m
WHERE m.old_case_id = ${escapeSQL(caseData.case_id)};`);
});
console.log('');

// Assign cases to valid users
console.log('-- ============================================================================');
console.log('-- STEP 7: ASSIGN CASES (only: ' + VALID_ASSIGNEES.join(', ') + ')');
console.log('-- ============================================================================');

const skippedAssignees = new Set();

casesData.forEach(caseData => {
  const assignees = parseAssignees(caseData.assignee);
  
  assignees.forEach(assigneeName => {
    const matchedAssignee = matchValidAssignee(assigneeName);
    
    if (matchedAssignee) {
      console.log(`
INSERT INTO case_assignees (case_id, user_id)
SELECT m.new_uuid, u.id
FROM case_migration_map m, users u
WHERE m.old_case_id = ${escapeSQL(caseData.case_id)}
  AND u.display_name ILIKE ${escapeSQL('%' + matchedAssignee + '%')}
ON CONFLICT (case_id, user_id) DO NOTHING;`);
    } else {
      skippedAssignees.add(assigneeName);
    }
  });
});
console.log('');

// Cleanup
console.log('-- ============================================================================');
console.log('-- STEP 8: CLEANUP');
console.log('-- ============================================================================');
console.log('DROP TABLE IF EXISTS client_migration_map;');
console.log('DROP TABLE IF EXISTS case_migration_map;');
console.log('');
console.log('COMMIT;');

// Summary to stderr
console.error('\n=== MIGRATION SUMMARY ===');
console.error(`Existing clients from sheet: ${clientsData.length}`);
console.error(`New clients created from cases: ${newClientsFromCases.length}`);
console.error(`Total clients: ${clientsData.length + newClientsFromCases.length}`);
console.error(`Total cases: ${casesData.length}`);
console.error('');
console.error(`Client codes: ${formatClientCode(NEXT_CLIENT_CODE)} to ${formatClientCode(clientCodeCounter - 1)}`);
console.error(`Case codes: ${formatCaseCode(NEXT_CASE_CODE)} to ${formatCaseCode(caseCodeCounter - 1)}`);
console.error('');
console.error('=== MATCHING RESULTS ===');
console.error(`Matched by phone: ${matchedByPhone.length}`);
console.error(`Matched by name: ${matchedByName.length}`);
console.error(`Created new client: ${createdNew.length}`);
console.error('');
console.error('=== ASSIGNEES ===');
console.error(`Valid assignees used: ${VALID_ASSIGNEES.join(', ')}`);
console.error(`Skipped assignees: ${[...skippedAssignees].join(', ') || 'none'}`);
console.error('');
console.error('=== IMPORTANT ===');
console.error('1. Countries/cities are MATCHED to existing records only');
console.error('2. Review the SQL before running!');
