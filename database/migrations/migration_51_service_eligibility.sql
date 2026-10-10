-- Migration 51: Service eligibility checklist and case agreement

-- ============================================================
-- 1. Eligibility checklist templates per service
-- ============================================================
CREATE TABLE IF NOT EXISTS service_eligibility (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('status', 'documents')),
    title TEXT NOT NULL,
    description TEXT,
    position INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_service_eligibility_service ON service_eligibility(service_id);

-- ============================================================
-- 2. Per-case completion tracking for the two eligibility checks
-- ============================================================
CREATE TABLE IF NOT EXISTS case_eligibility (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    service_id UUID REFERENCES services(id) ON DELETE SET NULL,
    type TEXT NOT NULL CHECK (type IN ('status', 'documents')),
    completed_at TIMESTAMPTZ,
    completed_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (case_id, type)
);
CREATE INDEX IF NOT EXISTS idx_case_eligibility_case ON case_eligibility(case_id);

-- ============================================================
-- 3. RLS
-- ============================================================
ALTER TABLE service_eligibility ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage service_eligibility"
ON service_eligibility FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE case_eligibility ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage case_eligibility"
ON case_eligibility FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- 4. Backfill: add an Eligibility step before Pre-sale on every case
-- ============================================================
INSERT INTO case_steps (case_id, name, position, is_required, step_type)
SELECT c.id, 'Eligibility check', -3, true, 'eligibility'
FROM cases c
WHERE NOT EXISTS (
    SELECT 1 FROM case_steps s WHERE s.case_id = c.id AND s.step_type = 'eligibility'
);

-- ============================================================
-- 5. Backfill: create status/documents tracking rows from case_services
-- ============================================================
INSERT INTO case_eligibility (case_id, service_id, type)
SELECT cs.case_id, cs.service_id, 'status'
FROM (SELECT DISTINCT case_id, service_id FROM case_services WHERE service_id IS NOT NULL) cs
ON CONFLICT (case_id, type) DO NOTHING;

INSERT INTO case_eligibility (case_id, service_id, type)
SELECT cs.case_id, cs.service_id, 'documents'
FROM (SELECT DISTINCT case_id, service_id FROM case_services WHERE service_id IS NOT NULL) cs
ON CONFLICT (case_id, type) DO NOTHING;
