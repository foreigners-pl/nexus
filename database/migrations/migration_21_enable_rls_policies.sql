-- Migration 21: Enable RLS and create policies for all tables
-- This secures the database so only authenticated users can access data

-- ============================================
-- CLIENTS & RELATED
-- ============================================

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage clients"
ON clients FOR ALL TO authenticated
USING (true) WITH CHECK (true);

ALTER TABLE contact_numbers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage contact_numbers"
ON contact_numbers FOR ALL TO authenticated
USING (true) WITH CHECK (true);

ALTER TABLE client_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage client_notes"
ON client_notes FOR ALL TO authenticated
USING (true) WITH CHECK (true);

-- ============================================
-- CASES & RELATED
-- ============================================

ALTER TABLE cases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage cases"
ON cases FOR ALL TO authenticated
USING (true) WITH CHECK (true);

ALTER TABLE case_services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage case_services"
ON case_services FOR ALL TO authenticated
USING (true) WITH CHECK (true);

ALTER TABLE case_assignees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage case_assignees"
ON case_assignees FOR ALL TO authenticated
USING (true) WITH CHECK (true);

ALTER TABLE case_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage case_attachments"
ON case_attachments FOR ALL TO authenticated
USING (true) WITH CHECK (true);

-- ============================================
-- PAYMENTS
-- ============================================

ALTER TABLE installments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage installments"
ON installments FOR ALL TO authenticated
USING (true) WITH CHECK (true);

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage invoices"
ON invoices FOR ALL TO authenticated
USING (true) WITH CHECK (true);

-- ============================================
-- NOTIFICATIONS
-- ============================================

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage notifications"
ON notifications FOR ALL TO authenticated
USING (true) WITH CHECK (true);

ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage notification_preferences"
ON notification_preferences FOR ALL TO authenticated
USING (true) WITH CHECK (true);

ALTER TABLE user_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage user_notifications"
ON user_notifications FOR ALL TO authenticated
USING (true) WITH CHECK (true);

-- ============================================
-- REFERENCE DATA (read-only for most users)
-- ============================================

ALTER TABLE services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read services"
ON services FOR SELECT TO authenticated
USING (true);
CREATE POLICY "Authenticated users can manage services"
ON services FOR ALL TO authenticated
USING (true) WITH CHECK (true);

ALTER TABLE status ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage status"
ON status FOR ALL TO authenticated
USING (true) WITH CHECK (true);

ALTER TABLE cities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read cities"
ON cities FOR SELECT TO authenticated
USING (true);

ALTER TABLE countries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read countries"
ON countries FOR SELECT TO authenticated
USING (true);

ALTER TABLE themes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read themes"
ON themes FOR SELECT TO authenticated
USING (true);

ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read roles"
ON roles FOR SELECT TO authenticated
USING (true);

-- ============================================
-- WIKI
-- ============================================

ALTER TABLE wiki_folders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage wiki_folders"
ON wiki_folders FOR ALL TO authenticated
USING (true) WITH CHECK (true);

ALTER TABLE wiki_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage wiki_documents"
ON wiki_documents FOR ALL TO authenticated
USING (true) WITH CHECK (true);

ALTER TABLE wiki_folder_access ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage wiki_folder_access"
ON wiki_folder_access FOR ALL TO authenticated
USING (true) WITH CHECK (true);

ALTER TABLE wiki_document_access ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage wiki_document_access"
ON wiki_document_access FOR ALL TO authenticated
USING (true) WITH CHECK (true);

-- ============================================
-- COMMENTS (already has RLS, but ensure policy exists)
-- ============================================

-- Comments table might already have RLS enabled
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'comments' AND policyname = 'Authenticated users can manage comments'
  ) THEN
    ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "Authenticated users can manage comments"
    ON comments FOR ALL TO authenticated
    USING (true) WITH CHECK (true);
  END IF;
END $$;