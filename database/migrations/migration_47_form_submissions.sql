-- Migration 47: Form Submissions Table
-- Stores website lead form submissions before they become clients

CREATE TABLE IF NOT EXISTS form_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Contact info from form
  full_name TEXT NOT NULL,
  email TEXT,
  phone_country_code TEXT,
  phone TEXT,
  description TEXT,
  
  -- Tracking data
  source TEXT,                    -- Which page/form they submitted from
  privacy_accepted BOOLEAN DEFAULT false,
  ip_address TEXT,
  city TEXT,
  country TEXT,
  user_agent TEXT,
  referrer TEXT,
  utm_campaign TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  
  -- Processing status
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'converted', 'spam', 'rejected')),
  notes TEXT,                     -- Internal notes about this submission
  
  -- Link to created client (if converted)
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  case_id UUID REFERENCES cases(id) ON DELETE SET NULL,
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,       -- When status changed from 'new'
  processed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  
  -- Store full raw payload for reference
  raw_payload JSONB
);

-- Index for quick lookups
CREATE INDEX idx_form_submissions_status ON form_submissions(status);
CREATE INDEX idx_form_submissions_created_at ON form_submissions(created_at DESC);
CREATE INDEX idx_form_submissions_client_id ON form_submissions(client_id);
CREATE INDEX idx_form_submissions_email ON form_submissions(email);

-- RLS Policies
ALTER TABLE form_submissions ENABLE ROW LEVEL SECURITY;

-- Authenticated users can view all submissions
CREATE POLICY "Users can view form submissions"
ON form_submissions FOR SELECT
TO authenticated
USING (true);

-- Authenticated users can update submissions (change status, add notes, link client)
CREATE POLICY "Users can update form submissions"
ON form_submissions FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Allow anonymous inserts (for webhook from website)
-- The webhook will use service role key, but we also allow anon for flexibility
CREATE POLICY "Anyone can submit forms"
ON form_submissions FOR INSERT
TO anon, authenticated
WITH CHECK (true);

COMMENT ON TABLE form_submissions IS 'Website lead form submissions. Can be converted to clients/cases.';
COMMENT ON COLUMN form_submissions.status IS 'new = unprocessed, contacted = reached out, converted = client created, spam/rejected = discarded';
COMMENT ON COLUMN form_submissions.client_id IS 'Links to client record if this submission was converted';
