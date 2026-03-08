/**
 * CRM Data Migration Script
 * 
 * This script reads data from crm_migration_structured.xlsx and generates SQL 
 * for inserting into Supabase.
 * 
 * IMPORTANT: This script does NOT insert new countries/cities.
 * It only matches against EXISTING options in the database.
 * If no match is found, the field is set to NULL.
 * 
 * Run this script ONCE to generate the SQL, then review and execute it.
 * 
 * Usage: node migrate_crm_data.js > migration_output.sql
 */

const XLSX = require('xlsx');
const path = require('path');

// Read Excel file
const filePath = path.join(__dirname, 'crm_migration_structured.xlsx');
const workbook = XLSX.readFile(filePath);

const clientsSheet = workbook.Sheets['Clients'];
const casesSheet = workbook.Sheets['Cases'];

const clientsData = XLSX.utils.sheet_to_json(clientsSheet);
const casesData = XLSX.utils.sheet_to_json(casesSheet);

// ============================================================================
// CONFIGURATION: Only these assignees will be matched
// ============================================================================
const VALID_ASSIGNEES = ['Bismark', 'Marcel', 'Sarvan', 'Damjan'];

// Helper: Check if assignee name matches one of the valid assignees
function matchValidAssignee(name) {
  const nameLower = name.toLowerCase();
  for (const valid of VALID_ASSIGNEES) {
    if (nameLower.includes(valid.toLowerCase()) || valid.toLowerCase().includes(nameLower.split(' ')[0].toLowerCase())) {
      return valid;
    }
  }
  return null;
}

// Helper: Parse date strings like "Monday, August 4th 2025, 3:36:16 pm +02:00"
function parseDate(dateStr) {
  if (!dateStr) return null;
  
  // Remove ordinal suffixes (st, nd, rd, th)
  const cleaned = dateStr.replace(/(\d+)(st|nd|rd|th)/g, '$1');
  
  // Try to parse
  const date = new Date(cleaned);
  if (isNaN(date.getTime())) {
    console.error(`-- WARNING: Could not parse date: ${dateStr}`);
    return null;
  }
  return date.toISOString();
}

// Helper: Escape SQL string
function escapeSQL(str) {
  if (str === null || str === undefined || str === '') return 'NULL';
  return `'${String(str).replace(/'/g, "''")}'`;
}

// Helper: Parse assignee string like "[Bismark, Sarvan Najafli]"
function parseAssignees(assigneeStr) {
  if (!assigneeStr || assigneeStr === '[]') return [];
  const match = assigneeStr.match(/\[(.*)\]/);
  if (!match) return [];
  return match[1].split(',').map(s => s.trim()).filter(Boolean);
}

// Collect unique values for reporting
const uniqueCountries = [...new Set(clientsData.map(c => c.country_of_origin).filter(Boolean))];
const uniqueCities = [...new Set(clientsData.map(c => c.city_poland).filter(Boolean))];
const uniqueAssigneeNames = new Set();
casesData.forEach(c => {
  parseAssignees(c.assignee).forEach(name => uniqueAssigneeNames.add(name));
});

console.log('-- ============================================================================');
console.log('-- CRM DATA MIGRATION');
console.log('-- Generated: ' + new Date().toISOString());
console.log('-- Clients: ' + clientsData.length);
console.log('-- Cases: ' + casesData.length);
console.log('-- ============================================================================');
console.log('');
console.log('-- IMPORTANT: This script does NOT insert new countries/cities.');
console.log('-- It only matches against EXISTING options (case-insensitive).');
console.log('-- If no match is found, the field is set to NULL.');
console.log('--');
console.log('-- Valid assignees: ' + VALID_ASSIGNEES.join(', '));
console.log('-- Other assignees will be SKIPPED.');
console.log('');
console.log('-- IMPORTANT: Run this in a transaction and review carefully before committing!');
console.log('BEGIN;');
console.log('');

// NO STEP 1/2: We do NOT insert countries or cities
console.log('-- ============================================================================');
console.log('-- NOTE: Countries and cities are NOT being inserted.');
console.log('-- We only match against existing records in the database.');
console.log('-- ============================================================================');
console.log('');

// Step 1: Create temporary mapping table for client IDs
console.log('-- ============================================================================');
console.log('-- STEP 1: CREATE TEMPORARY MAPPING TABLE');
console.log('-- ============================================================================');
console.log('CREATE TEMP TABLE client_id_map (');
console.log('  internal_id INTEGER PRIMARY KEY,');
console.log('  new_uuid UUID');
console.log(');');
console.log('');

// Step 2: Insert clients (matching existing countries/cities only)
console.log('-- ============================================================================');
console.log('-- STEP 2: INSERT CLIENTS');
console.log('-- NOTE: country_of_origin and city_in_poland use case-insensitive');
console.log('-- matching against EXISTING records. If no match, NULL is used.');
console.log('-- ============================================================================');
clientsData.forEach(client => {
  const firstName = client.first_name || '';
  const lastName = client.last_name || '';
  const email = client.email || null;
  const phone = client.phone || null;
  const country = client.country_of_origin || null;
  const city = client.city_poland || null;
  const createdAt = parseDate(client.date_created);
  
  // Use ILIKE for case-insensitive matching, TRIM for whitespace
  const countryLookup = country 
    ? `(SELECT id FROM countries WHERE LOWER(TRIM(country)) = LOWER(TRIM(${escapeSQL(country)})) LIMIT 1)` 
    : 'NULL';
  const cityLookup = city 
    ? `(SELECT id FROM cities WHERE LOWER(TRIM(city)) = LOWER(TRIM(${escapeSQL(city)})) LIMIT 1)` 
    : 'NULL';
  
  console.log(`
WITH new_client AS (
  INSERT INTO clients (first_name, last_name, contact_email, contact_number, country_of_origin, city_in_poland, created_at)
  VALUES (
    ${escapeSQL(firstName)},
    NULLIF(${escapeSQL(lastName)}, ''),
    NULLIF(${escapeSQL(email)}, ''),
    NULL, -- phone goes to contact_numbers table
    ${countryLookup},
    ${cityLookup},
    ${createdAt ? escapeSQL(createdAt) : 'NOW()'}
  )
  RETURNING id
)
INSERT INTO client_id_map (internal_id, new_uuid)
SELECT ${client.client_internal_id}, id FROM new_client;`);

  // Insert phone number if provided
  if (phone) {
    // Parse country code if present (e.g., "+48 516 795 560")
    const phoneMatch = phone.match(/^(\+\d+)\s*(.*)$/);
    if (phoneMatch) {
      console.log(`
INSERT INTO contact_numbers (client_id, country_code, number, is_on_whatsapp)
SELECT new_uuid, ${escapeSQL(phoneMatch[1])}, ${escapeSQL(phoneMatch[2])}, false
FROM client_id_map WHERE internal_id = ${client.client_internal_id};`);
    } else {
      console.log(`
INSERT INTO contact_numbers (client_id, number, is_on_whatsapp)
SELECT new_uuid, ${escapeSQL(phone)}, false
FROM client_id_map WHERE internal_id = ${client.client_internal_id};`);
    }
  }
});
console.log('');

// Step 3: Create temporary mapping table for case IDs
console.log('-- ============================================================================');
console.log('-- STEP 3: CREATE CASE ID MAPPING TABLE');
console.log('-- ============================================================================');
console.log('CREATE TEMP TABLE case_id_map (');
console.log('  old_case_id TEXT PRIMARY KEY,');
console.log('  new_uuid UUID');
console.log(');');
console.log('');

// Step 4: Get default status (Lead or first available)
console.log('-- ============================================================================');
console.log('-- STEP 4: GET DEFAULT STATUS');
console.log('-- ============================================================================');
console.log("-- Using 'Lead' status or first available status as default");
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
console.log('');

// Step 5: Insert cases
console.log('-- ============================================================================');
console.log('-- STEP 5: INSERT CASES');
console.log('-- ============================================================================');
casesData.forEach(caseData => {
  const caseId = caseData.case_id;
  const clientInternalId = caseData.client_internal_id;
  const createdAt = parseDate(caseData.date_created);
  const source = caseData.source || 'unknown';
  const comments = caseData.comments || '';
  
  console.log(`
WITH new_case AS (
  INSERT INTO cases (client_id, status_id, created_at)
  SELECT 
    m.new_uuid,
    (current_setting('migration.default_status_id'))::uuid,
    ${createdAt ? escapeSQL(createdAt) : 'NOW()'}
  FROM client_id_map m
  WHERE m.internal_id = ${clientInternalId}
  RETURNING id
)
INSERT INTO case_id_map (old_case_id, new_uuid)
SELECT ${escapeSQL(caseId)}, id FROM new_case;`);
});
console.log('');

// Step 6: Insert case comments (storing source and original comments)
console.log('-- ============================================================================');
console.log('-- STEP 6: INSERT CASE COMMENTS (migration notes)');
console.log('-- ============================================================================');
casesData.forEach(caseData => {
  const caseId = caseData.case_id;
  const source = caseData.source || '';
  const comments = caseData.comments || '';
  const attachments = caseData.attachments || '';
  
  // Build migration note
  let migrationNote = `[Migrated from old CRM - Source: ${source}]`;
  if (comments && comments !== '0 | 0') {
    // Parse comments - format seems to be "0 | 0 | actual comment text"
    const commentParts = comments.split(' | ');
    const actualComment = commentParts.slice(2).join(' | ').trim();
    if (actualComment) {
      migrationNote += `\n\nOriginal notes: ${actualComment}`;
    }
  }
  if (attachments) {
    migrationNote += `\n\nAttachment references from old system: ${attachments}`;
  }
  
  if (migrationNote) {
    console.log(`
INSERT INTO comments (case_id, text, created_at)
SELECT m.new_uuid, ${escapeSQL(migrationNote)}, NOW()
FROM case_id_map m
WHERE m.old_case_id = ${escapeSQL(caseId)};`);
  }
});
console.log('');

// Step 7: Handle assignees - ONLY for valid assignees
console.log('-- ============================================================================');
console.log('-- STEP 7: ASSIGN CASES TO VALID USERS ONLY');
console.log('-- Valid assignees: ' + VALID_ASSIGNEES.join(', '));
console.log('-- ============================================================================');

// Track which assignees are being skipped
const skippedAssignees = new Set();
const usedAssignees = new Set();

casesData.forEach(caseData => {
  const caseId = caseData.case_id;
  const assignees = parseAssignees(caseData.assignee);
  
  assignees.forEach(assigneeName => {
    const matchedAssignee = matchValidAssignee(assigneeName);
    
    if (matchedAssignee) {
      usedAssignees.add(matchedAssignee);
      // Match by display_name containing the valid assignee name
      console.log(`
INSERT INTO case_assignees (case_id, user_id)
SELECT m.new_uuid, u.id
FROM case_id_map m, users u
WHERE m.old_case_id = ${escapeSQL(caseId)}
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
console.log('DROP TABLE IF EXISTS client_id_map;');
console.log('DROP TABLE IF EXISTS case_id_map;');
console.log('');

console.log('-- ============================================================================');
console.log('-- COMMIT OR ROLLBACK');
console.log('-- ============================================================================');
console.log('-- Review the results above, then:');
console.log('-- COMMIT;  -- to save changes');
console.log('-- or');
console.log('-- ROLLBACK;  -- to undo everything');
console.log('');
console.log('-- For safety, we default to COMMIT but you can change this:');
console.log('COMMIT;');

// Summary
console.error('\n=== MIGRATION SUMMARY ===');
console.error(`Clients to import: ${clientsData.length}`);
console.error(`Cases to import: ${casesData.length}`);
console.error(`Unique countries in Excel: ${uniqueCountries.length}`);
console.error(`Unique cities in Excel: ${uniqueCities.length}`);
console.error('');
console.error('=== ASSIGNEE HANDLING ===');
console.error(`Valid assignees (will be matched): ${VALID_ASSIGNEES.join(', ')}`);
console.error(`Assignees used in migration: ${[...usedAssignees].join(', ') || 'none'}`);
console.error(`Assignees SKIPPED (not in valid list): ${[...skippedAssignees].join(', ') || 'none'}`);
console.error('');
console.error('=== IMPORTANT NOTES ===');
console.error('1. Countries/cities are MATCHED against existing records (case-insensitive)');
console.error('   If no match found, the field is set to NULL.');
console.error('2. Only valid assignees are assigned. Others are skipped.');
console.error('3. Review the generated SQL carefully before running!');
console.error('4. Run BEGIN/COMMIT as a transaction for safety.');
