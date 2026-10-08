// Shapes returned by the FastAPI backend (see backend/app/routers/*.py).

type Role = 'donor' | 'recipient' | 'ngo' | 'admin';
type UserStatus = 'pending' | 'active' | 'suspended';
type NgoStatus = 'pending' | 'approved' | 'rejected';

export interface User {
  id: number;
  name: string;
  email: string;
  role: Role;
  phone_number?: string | null;
  location?: string | null;
  district?: string | null;
  status: UserStatus;
  notify_districts?: string[];
  notify_food_types?: string[];
  notify_email?: boolean;
  org_name?: string | null;
  org_description?: string | null;
  org_logo?: string | null;
  /** The picture to show for this account (an NGO's logo, otherwise the profile photo). */
  photo?: string | null;
  ngo_status?: NgoStatus | null;
  created_at?: string | null;
}

type ListingStatus = 'active' | 'sold_out' | 'expired' | 'closed';
type Fulfilment = 'pickup' | 'delivery' | 'both';
type Proximity = 'same_district' | 'neighbouring' | 'other';

interface Rating { average: number; count: number }

interface DonorContact {
  name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
}

export interface Listing {
  id: number;
  donor_id: number;
  donor_name: string | null;
  donor_photo?: string | null;
  donor_rating: Rating | null;
  food_name: string;
  description: string | null;
  category: string;
  quantity_total: number;
  quantity_available: number;
  unit: string;
  district: string;
  area: string | null;
  expires_at: string;
  prepared_at: string | null;
  fulfilment: Fulfilment;
  images: string[];
  status: ListingStatus;
  created_at: string | null;
  proximity: Proximity | null;
  /** Only for the donor and the admin. */
  pickup_address?: string | null;
  contact_phone?: string | null;
  safety_confirmed?: boolean;
  /** Only for a recipient whose request the donor accepted. */
  contact?: DonorContact;
}

export interface ListingsPage {
  success: boolean;
  total: number;
  page: number;
  limit: number;
  near: string | null;
  listings: Listing[];
}

type RequestStatus =
  | 'pending' | 'accepted' | 'declined' | 'cancelled' | 'collected' | 'completed' | 'no_show' | 'expired';

export interface FoodRequest {
  id: number;
  listing: {
    id: number;
    food_name: string;
    unit: string;
    district: string;
    area: string | null;
    category: string;
    image: string | null;
    status: ListingStatus;
    expires_at: string;
    fulfilment: Fulfilment;
  };
  quantity_requested: number;
  message: string | null;
  status: RequestStatus;
  decline_reason: string | null;
  created_at: string | null;
  responded_at: string | null;
  collected_at: string | null;
  completed_at: string | null;
  recipient: {
    id: number; name: string; kind: 'person' | 'ngo'; org_name: string | null; district: string | null; photo?: string | null;
    phone?: string | null; email?: string | null;
  };
  donor: { id: number; name: string; photo?: string | null; phone?: string | null; email?: string | null; address?: string | null };
  i_am: 'donor' | 'recipient' | 'admin';
  can_rate: boolean;
}

export interface RequestsResponse {
  success: boolean;
  requests: FoodRequest[];
}

export interface Meta {
  districts: string[];
  categories: string[];
  units: string[];
  fulfilment: Fulfilment[];
  event_types: string[];
  neighbours: Record<string, string[]>;
}

export interface AppNotification {
  id: number;
  kind: string;
  title: string;
  body: string;
  link: string | null;
  is_read: boolean;
  created_at: string | null;
}

export interface CommunityEvent {
  id: number;
  title: string;
  description: string;
  event_type: string;
  location: string;
  district: string;
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
  images: string[];
  status: 'published' | 'cancelled';
  contact: { name: string | null; phone: string | null; email: string | null };
  organiser: { id: number; name: string; logo: string | null } | null;
  owner_id: number | null;
}

export interface Attendee {
  id: number;
  name: string;
  email: string;
  phone_number: string | null;
}

export interface NgoCard {
  id: number;
  org_name: string;
  description: string | null;
  logo: string | null;
  district: string | null;
  upcoming_events: number;
}

export interface RatingSummary {
  success: boolean;
  user: { id: number; name: string; role: Role; photo?: string | null };
  average: number | null;
  count: number;
  recent: { score: number; comment: string; from: string; created_at: string | null }[];
}

/** Standard FastAPI error body: a string, or a list of field errors (422). */
export interface ApiErrorBody {
  detail?: string | { loc?: (string | number)[]; msg?: string }[];
  message?: string;
}
