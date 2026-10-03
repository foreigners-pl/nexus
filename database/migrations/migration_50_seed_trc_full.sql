-- Migration 50: Seed "TRC Full service" with its default step template.
-- For now this is the only service selectable at case creation.

INSERT INTO services (name)
SELECT 'TRC Full service'
WHERE NOT EXISTS (SELECT 1 FROM services WHERE name = 'TRC Full service');

INSERT INTO service_steps (service_id, name, position, is_required)
SELECT s.id, v.name, v.position, true
FROM services s
CROSS JOIN (VALUES
    ('Application submission', 0),
    ('Biometrics', 1),
    ('Decision', 2),
    ('TRC card issued', 3)
) AS v(name, position)
WHERE s.name = 'TRC Full service'
AND NOT EXISTS (SELECT 1 FROM service_steps ss WHERE ss.service_id = s.id);
