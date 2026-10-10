-- Migration 52: Add service closure as the final step on every case

-- Backfill: add a Service closure step at the end of every case that doesn't have one.
INSERT INTO case_steps (case_id, name, position, is_required, step_type)
SELECT c.id, 'Service closure', 1000000, true, 'closure'
FROM cases c
WHERE NOT EXISTS (
    SELECT 1 FROM case_steps s WHERE s.case_id = c.id AND s.step_type = 'closure'
);
