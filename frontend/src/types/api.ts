// Shapes returned by the FastAPI backend (see backend/app/schemas.py).

export type Role = 'donor' | 'recipient' | 'adminofficer';
export type UserStatus = 'pending' | 'active' | 'suspended';

export interface User {
  id: number;
  name: string;
  email: string;
  role: Role;
  phone_number?: string | null;
  location?: string | null;
  status: UserStatus;
  created_at?: string | null;
}

export type VerificationStatus = 'pending_review' | 'approved' | 'rejected';

export interface Listing {
  id: number;
  donor_id: number;
  food_name: string;
  quantity: string;
  expiry_date: string | null;
  location: string | null;
  description: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  image_path: string | null;
  status: string;
  verification_status: VerificationStatus;
  rejection_reason: string | null;
  accepted_by: string | null;
  requested_by: number | null;
  created_at: string | null;
  donor_name: string | null;
}

export interface FoodRequest {
  id: number;
  recipient_id: number;
  food_item: string;
  quantity: string;
  needed_by: string | null;
  location: string | null;
  description: string | null;
  image_path: string | null;
  listing_id: number | null;
  status: string;
  accepted_by: string | null;
  created_at: string | null;
  recipient_name?: string | null;
  recipient_email?: string | null;
  recipient_phone?: string | null;
  recipient_location?: string | null;
  donor_id?: number | null;
  donor_name?: string | null;
  donor_phone?: string | null;
  /** True once the recipient has left feedback for this delivery. */
  feedback_given?: boolean;
}

export interface Feedback {
  id: number;
  request_id: number | null;
  recipient_id: number;
  recipient_name: string;
  rating: number | null;
  comment: string;
  image_path: string | null;
  created_at: string | null;
}

export interface ListingsPage {
  success: boolean;
  total: number;
  page: number;
  limit: number;
  listings: Listing[];
}

export interface RequestsResponse {
  success: boolean;
  requests: FoodRequest[];
}

export interface CommunityEvent {
  id: number;
  title: string;
  description: string;
  location: string;
  /** Sri Lanka wall-clock time without a zone, e.g. "2026-10-13T08:00:00". */
  starts_at: string;
  ends_at: string | null;
  capacity: number | null;
  going: number;
  spots_left: number | null;
  full: boolean;
  is_past: boolean;
  /** True when the signed-in user has joined. */
  joined: boolean;
}

export interface Attendee {
  id: number;
  name: string;
  email: string;
  phone_number: string | null;
}

/** Standard FastAPI error body: a string, or a list of field errors (422). */
export interface ApiErrorBody {
  detail?: string | { loc?: (string | number)[]; msg?: string }[];
  message?: string;
}
