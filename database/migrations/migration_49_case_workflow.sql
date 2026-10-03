-- Migration 49: Case workflow system
-- Steps (service templates + per-case), step board entries (notes/actions),
-- queries, and case assignment fields (csr_id, current_step_id).

-- ============================================================
-- 1. Service step templates
-- ============================================================
CREATE TABLE IF NOT EXISTS service_steps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    position INTEGER NOT NULL DEFAULT 0,
    is_required BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_service_steps_service ON service_steps(service_id);

-- ============================================================
-- 2. Steps on a case (system: presale/consultation, service, custom)
-- ============================================================
CREATE TABLE IF NOT EXISTS case_steps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    position INTEGER NOT NULL DEFAULT 0,
    is_required BOOLEAN NOT NULL DEFAULT true,
    step_type TEXT NOT NULL DEFAULT 'service', -- 'presale' | 'consultation' | 'service' | 'custom'
    service_id UUID REFERENCES services(id) ON DELETE SET NULL,
    completed_at TIMESTAMPTZ,
    completed_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_case_steps_case ON case_steps(case_id);

-- ============================================================
-- 3. Step board entries: notes now, actions (one open at a time)
-- ============================================================
CREATE TABLE IF NOT EXISTS case_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    step_id UUID REFERENCES case_steps(id) ON DELETE SET NULL,
    kind TEXT NOT NULL DEFAULT 'note', -- 'note' | 'action' | 'query'
    body TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    -- action fields
    due_date DATE,
    waiting_on TEXT,
    completed_at TIMESTAMPTZ,
    completed_by UUID REFERENCES users(id),
    -- query link
    query_id UUID
);
CREATE INDEX IF NOT EXISTS idx_case_entries_case ON case_entries(case_id);
CREATE INDEX IF NOT EXISTS idx_case_entries_step ON case_entries(step_id);
CREATE INDEX IF NOT EXISTS idx_case_entries_open_action
    ON case_entries(case_id) WHERE kind = 'action' AND completed_at IS NULL;

-- ============================================================
-- 4. Queries (CSR <-> legal threads anchored to a step)
-- ============================================================
CREATE TABLE IF NOT EXISTS case_queries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    step_id UUID REFERENCES case_steps(id) ON DELETE SET NULL,
    opened_by UUID REFERENCES users(id),
    assigned_to UUID REFERENCES users(id),
    direction TEXT NOT NULL, -- 'csr_to_legal' | 'legal_to_csr'
    status TEXT NOT NULL DEFAULT 'open', -- 'open' | 'answered' | 'closed'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    closed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_case_queries_case ON case_queries(case_id);
CREATE INDEX IF NOT EXISTS idx_case_queries_assignee ON case_queries(assigned_to, status);

CREATE TABLE IF NOT EXISTS case_query_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    query_id UUID NOT NULL REFERENCES case_queries(id) ON DELETE CASCADE,
    author_id UUID REFERENCES users(id),
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_case_query_messages_query ON case_query_messages(query_id);

-- ============================================================
-- 5. Case columns
-- ============================================================
ALTER TABLE cases ADD COLUMN IF NOT EXISTS csr_id UUID REFERENCES users(id);
ALTER TABLE cases ADD COLUMN IF NOT EXISTS current_step_id UUID REFERENCES case_steps(id) ON DELETE SET NULL;

-- ============================================================
-- 6. RLS — match existing permissive authenticated policies
-- ============================================================
ALTER TABLE service_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage service_steps"
ON service_steps FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE case_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage case_steps"
ON case_steps FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE case_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage case_entries"
ON case_entries FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE case_queries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage case_queries"
ON case_queries FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE case_query_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage case_query_messages"
ON case_query_messages FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- 7. Backfill existing cases
-- ============================================================
-- Every existing case gets Pre-sale (already done) + Consultation steps
INSERT INTO case_steps (case_id, name, position, is_required, step_type)
SELECT c.id, 'Pre-sale', -2, true, 'presale' FROM cases c
WHERE NOT EXISTS (
    SELECT 1 FROM case_steps s WHERE s.case_id = c.id AND s.step_type = 'presale'
);

INSERT INTO case_steps (case_id, name, position, is_required, step_type)
SELECT c.id, 'Consultation', -1, false, 'consultation' FROM cases c
WHERE NOT EXISTS (
    SELECT 1 FROM case_steps s WHERE s.case_id = c.id AND s.step_type = 'consultation'
);

-- Existing cases are already sold: pre-sale completed
UPDATE case_steps SET completed_at = COALESCE(completed_at, NOW())
WHERE step_type = 'presale';

-- Copy each attached service's template steps onto the case.
-- Services are ordered by when they were added; each service gets a 100-slot
-- position block so its steps stay grouped.
INSERT INTO case_steps (case_id, name, position, is_required, step_type, service_id)
SELECT ordered.case_id, ss.name, ss.position + (ordered.idx * 100), ss.is_required, 'service', ss.service_id
FROM (
    SELECT case_id, service_id,
           (ROW_NUMBER() OVER (PARTITION BY case_id ORDER BY created_at) - 1) AS idx
    FROM case_services
) ordered
JOIN service_steps ss ON ss.service_id = ordered.service_id;

-- Existing cases start at their first service step (or pre-sale if none)
UPDATE cases c SET current_step_id = (
    SELECT s.id FROM case_steps s
    WHERE s.case_id = c.id AND s.step_type IN ('service','custom')
    ORDER BY s.position LIMIT 1
)
WHERE c.current_step_id IS NULL;

UPDATE cases c SET current_step_id = (
    SELECT s.id FROM case_steps s
    WHERE s.case_id = c.id AND s.step_type = 'presale'
    LIMIT 1
)
WHERE c.current_step_id IS NULL;
