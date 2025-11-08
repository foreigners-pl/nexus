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
  price?: number
}

export interface Comment {
  id: string
  user_id?: string
  text?: string
  created_at: string
}

export interface Country {
  id: string
  country: string
}

export interface City {
  id: string
  city: string
}
