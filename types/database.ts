// Database TypeScript types
// These match your Supabase schema

export interface Client {
  id: string
  client_code?: string         // Custom ID like CL000001
  first_name?: string           // Nullable - at least one of first_name, last_name, email, or phone required
  last_name?: string            // Nullable - at least one of first_name, last_name, email, or phone required
  created_at: string
  contact_email?: string
  country_of_origin?: string  // UUID reference to countries table
  city_in_poland?: string      // UUID reference to cities table
  stripe_customer_id?: string  // Stripe Customer ID for invoicing
}

export interface ContactNumber {
  id: string
  client_id: string
  number: string
  is_on_whatsapp: boolean
}

export interface ClientDocument {
  id: string
  client_id: string
  filename: string
  file_path: string
  file_type?: string
  file_size?: number
  uploaded_by?: string
  uploaded_at: string
  description?: string
  document_category?: string
}

export interface ClientNote {
  id: string
  client_id: string
  user_id: string
  note: string
  is_pinned?: boolean
  created_at: string
  updated_at: string
}

export interface Case {
  id: string
  case_code?: string           // Custom ID like C0000001
  client_id: string
  created_at: string
  status_id?: string
  assigned_to?: string
  attachments?: string
  due_date?: string            // Optional due date for the case
  position?: number            // Position within status column for ordering
  case_assignees?: (CaseAssignee & { users?: User })[]  // Assignees with user details
}

export interface CaseService {
  id: string
  case_id: string
  service_id: string
  custom_price?: number  // For services with individual pricing
  created_at: string
}

export interface CaseAssignee {
  id: string
  case_id: string
  user_id: string
  created_at: string
}

export interface Installment {
  id: string
  case_id: string
  amount: number
  due_date?: string
  automatic_invoice: boolean  // If true, auto-send invoice on due_date
  is_down_payment: boolean
  position: number
  paid: boolean
  created_at: string
  updated_at: string
  parent_installment_id?: string  // For refunds: references original installment
  refund_reason?: string          // Reason for refund
}

export interface CaseAttachment {
  id: string
  case_id: string
  file_name: string
  file_path: string
  file_size?: number
  file_type?: string
  uploaded_by?: string
  created_at: string
}

export interface User {
  id: string
  email: string
  display_name?: string
  contact_number?: string
  theme?: string
  role?: string
  created_at: string
  updated_at: string
}

export interface Status {
  id: string
  name: string
  position?: number
  notifyees?: string[]
}

export interface Service {
  id: string
  name: string
  category?: string
  gross_price?: number
  price?: number
  created_at?: string
}

export interface Comment {
  id: string
  case_id?: string
  user_id?: string
  text?: string
  created_at: string
  users?: {
    id: string
    email: string
    display_name?: string
  }
}

export interface Country {
  id: string
  country: string
}

export interface City {
  id: string
  city: string
}

export interface Invoice {
  id: string
  case_id: string
  installment_id?: string
  invoice_number?: string
  invoice_name: string
  amount: number
  status: 'draft' | 'sent' | 'viewed' | 'paid' | 'overdue' | 'cancelled' | 'void' | 'uncollectible'
  stripe_invoice_id?: string
  stripe_payment_intent_id?: string
  payment_link?: string
  sent_at?: string
  paid_at?: string
  due_date?: string
  created_at: string
  updated_at: string
  // Stripe integration fields
  currency?: string                    // ISO 4217 currency code (default: 'pln')
  collection_method?: 'send_invoice' | 'charge_automatically'
  stripe_hosted_invoice_url?: string   // URL for customer to pay
  stripe_invoice_pdf?: string          // URL to PDF version
  voided_at?: string                   // When invoice was voided
  payment_method?: string              // How payment was made
  notes?: string                       // Internal notes
}

// ============================================
// BOARDS SYSTEM TYPES
// ============================================

export interface Board {
  id: string
  name: string
  description?: string
  is_system: boolean
  owner_id?: string
  created_at: string
  updated_at: string
}

export interface BoardAccess {
  id: string
  board_id: string
  user_id: string
  access_level: 'owner' | 'editor' | 'viewer'
  granted_by?: string
  granted_at: string
}

export interface BoardStatus {
  id: string
  board_id: string
  name: string
  position: number
  color?: string
  created_at: string
  updated_at: string
}

export interface Card {
  id: string
  board_id: string
  status_id: string
  title: string
  description?: string
  position: number
  due_date?: string
  created_by?: string
  created_at: string
  updated_at: string
}

export interface CardAssignee {
  id: string
  card_id: string
  user_id: string
  assigned_at: string
}

export interface WikiDocument {
  id: string
  title: string
  content: any // jsonb - Rich text editor output, table data, or whiteboard data
  document_type?: 'rich-text' | 'table' | 'whiteboard' // Type of document
  owner_id?: string
  folder_id?: string // The folder/wiki this document belongs to
  position: number
  created_at: string
  updated_at: string
  is_shared: boolean
  shared_with?: string[] // Array of user IDs
}

export interface WikiFolder {
  id: string
  name: string
  owner_id?: string
  is_shared: boolean
  shared_with?: string[] // Array of user IDs
  position: number
  created_at: string
  updated_at: string
}

// Extended types with relations
export interface BoardWithRelations extends Board {
  owner?: User
  board_access?: BoardAccess[]
  board_statuses?: BoardStatus[]
}

export interface CardWithRelations extends Card {
  board_statuses?: BoardStatus
  created_by_user?: User
  card_assignees?: (CardAssignee & { users?: User })[]
}

export interface WikiFolderWithRelations extends WikiFolder {
  owner?: User
  documents?: WikiDocument[] // Documents in this folder
  document_count?: number // Number of documents
}

export interface WikiDocumentWithRelations extends WikiDocument {
  owner?: User
  folder?: WikiFolder // The folder this document belongs to
}

// ============================================
// ACTIVITY LOG TYPES
// ============================================

export interface ActivityLog {
  id: string
  user_id: string
  actor_id?: string
  action_type: 'assigned' | 'unassigned' | 'comment' | 'status_change' | 'payment_received' | 'payment_due' | 'due_reminder' | 'overdue' | 'claimed' | 'buzz'
  entity_type: 'case' | 'card' | 'installment' | 'invoice' | 'conversation'
  entity_id: string
  message: string
  metadata?: {
    case_code?: string
    client_name?: string
    card_title?: string
    board_name?: string
    actor_name?: string
    amount?: number
    comment_preview?: string
    sender_name?: string
    sender_id?: string
    [key: string]: any
  }
  is_read: boolean
  created_at: string
}

export interface ActivityLogWithActor extends ActivityLog {
  actor?: User
}

// User Activity Preferences
export interface UserActivityPreferences {
  id: string
  user_id: string
  show_in_feed: string[]
  email_notifications: string[]
  created_at: string
  updated_at: string
}
// Form Submissions (website leads)
export interface FormSubmission {
  id: string
  full_name: string
  email?: string
  phone_country_code?: string
  phone?: string
  description?: string
  source?: string
  privacy_accepted: boolean
  ip_address?: string
  city?: string
  country?: string
  user_agent?: string
  referrer?: string
  utm_campaign?: string
  utm_source?: string
  utm_medium?: string
  status: 'new' | 'contacted' | 'converted' | 'spam' | 'rejected'
  notes?: string
  client_id?: string
  case_id?: string
  created_at: string
  processed_at?: string
  processed_by?: string
  raw_payload?: Record<string, unknown>
}