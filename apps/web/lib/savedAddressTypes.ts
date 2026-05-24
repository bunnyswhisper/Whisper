export type SavedAddress = {
  id: string;
  user_id: string;
  label: string;
  full_name: string;
  country_code: string;
  phone: string;
  city: string;
  area: string;
  street: string;
  notes: string | null;
  is_default: boolean;
};

export type SaveSavedAddressInput = {
  fullName: string;
  countryCode: string;
  phone: string;
  city: string;
  area: string;
  street: string;
  notes?: string;
  saveAddress?: boolean;
};
