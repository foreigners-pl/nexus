# Database Migration Order

Run these migrations in the Supabase SQL Editor in the following order:

## 1. Fix Contact Numbers Relationship
**File:** `migration_01_fix_contact_numbers.sql`
- Migrates phone numbers from TEXT column to contact_numbers table
- Establishes proper many-to-many relationship
- **Important:** Run this first if you have existing clients with phone numbers

## 2. Create Client Notes Table
**File:** `migration_03_client_notes.sql`
- Creates client_notes table for internal staff notes
- Adds pinning functionality for important notes
- Includes automatic timestamp updates

## 3. Populate Countries
**File:** `migration_04_populate_countries.sql`
- Inserts all 195+ countries into the countries table
- Includes UN recognized countries and common territories
- Safe to run multiple times (uses ON CONFLICT DO NOTHING)

## 4. Populate Cities
**File:** `migration_05_populate_cities.sql`
- Inserts all major Polish cities (10,000+ population)
- Over 250 cities included
- Safe to run multiple times (uses ON CONFLICT DO NOTHING)

## 5. Add Custom Client Codes
**File:** `migration_06_add_client_codes.sql`
- Adds `client_code` column to clients table (e.g., CL000001, CL000002)
- Creates auto-increment sequence for clean URLs
- Updates existing clients with codes
- Creates trigger for automatic code generation on new clients

## 6. Add Custom Case Codes
**File:** `migration_07_add_case_codes.sql`
- Adds `case_code` column to cases table (e.g., C0000001, C0000002)
- Creates auto-increment sequence for clean URLs
- Updates existing cases with codes
- Creates trigger for automatic code generation on new cases

## 7. Make Client Names Nullable
**File:** `migration_08_make_names_nullable.sql`
- Makes `first_name` and `last_name` nullable in clients table
- Allows creating clients with only email or phone number
- Application logic enforces: at least one of first_name, last_name, email, or phone must be provided

## Notes
- All migrations are idempotent (safe to run multiple times)
- Countries and cities migrations use INSERT with ON CONFLICT to prevent duplicates
- Make sure to run migrations 1-3 before using the client detail page features
- Migrations 4-5 are required for the location editing dropdown to work
- Migrations 6-7 add human-readable codes for cleaner URLs (e.g., /clients/CL000001 instead of UUID)

## Verification
After running all migrations, you should have:
- Contact numbers properly separated from clients table
- Client notes table ready for use
- 195+ countries in the countries table
- 250+ Polish cities in the cities table
- Client codes like CL000001, CL000002, etc.
- Case codes like C0000001, C0000002, etc.
