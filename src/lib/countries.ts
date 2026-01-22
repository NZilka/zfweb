// Country and subdivision (state/province) data for checkout
// Extensible structure - add new countries by adding entries to COUNTRIES array

export type Subdivision = {
  code: string;
  name: string;
};

export type Country = {
  code: string;
  name: string;
  subdivisionLabel: string; // "State", "Province", etc.
  postalCodeLabel: string; // "ZIP Code", "Postal Code", etc.
  subdivisions: Subdivision[];
};

// US States
const US_STATES: Subdivision[] = [
  { code: "AL", name: "Alabama" },
  { code: "AK", name: "Alaska" },
  { code: "AZ", name: "Arizona" },
  { code: "AR", name: "Arkansas" },
  { code: "CA", name: "California" },
  { code: "CO", name: "Colorado" },
  { code: "CT", name: "Connecticut" },
  { code: "DE", name: "Delaware" },
  { code: "DC", name: "District of Columbia" },
  { code: "FL", name: "Florida" },
  { code: "GA", name: "Georgia" },
  { code: "HI", name: "Hawaii" },
  { code: "ID", name: "Idaho" },
  { code: "IL", name: "Illinois" },
  { code: "IN", name: "Indiana" },
  { code: "IA", name: "Iowa" },
  { code: "KS", name: "Kansas" },
  { code: "KY", name: "Kentucky" },
  { code: "LA", name: "Louisiana" },
  { code: "ME", name: "Maine" },
  { code: "MD", name: "Maryland" },
  { code: "MA", name: "Massachusetts" },
  { code: "MI", name: "Michigan" },
  { code: "MN", name: "Minnesota" },
  { code: "MS", name: "Mississippi" },
  { code: "MO", name: "Missouri" },
  { code: "MT", name: "Montana" },
  { code: "NE", name: "Nebraska" },
  { code: "NV", name: "Nevada" },
  { code: "NH", name: "New Hampshire" },
  { code: "NJ", name: "New Jersey" },
  { code: "NM", name: "New Mexico" },
  { code: "NY", name: "New York" },
  { code: "NC", name: "North Carolina" },
  { code: "ND", name: "North Dakota" },
  { code: "OH", name: "Ohio" },
  { code: "OK", name: "Oklahoma" },
  { code: "OR", name: "Oregon" },
  { code: "PA", name: "Pennsylvania" },
  { code: "RI", name: "Rhode Island" },
  { code: "SC", name: "South Carolina" },
  { code: "SD", name: "South Dakota" },
  { code: "TN", name: "Tennessee" },
  { code: "TX", name: "Texas" },
  { code: "UT", name: "Utah" },
  { code: "VT", name: "Vermont" },
  { code: "VA", name: "Virginia" },
  { code: "WA", name: "Washington" },
  { code: "WV", name: "West Virginia" },
  { code: "WI", name: "Wisconsin" },
  { code: "WY", name: "Wyoming" },
];

// Canadian Provinces and Territories
const CA_PROVINCES: Subdivision[] = [
  { code: "AB", name: "Alberta" },
  { code: "BC", name: "British Columbia" },
  { code: "MB", name: "Manitoba" },
  { code: "NB", name: "New Brunswick" },
  { code: "NL", name: "Newfoundland and Labrador" },
  { code: "NS", name: "Nova Scotia" },
  { code: "NT", name: "Northwest Territories" },
  { code: "NU", name: "Nunavut" },
  { code: "ON", name: "Ontario" },
  { code: "PE", name: "Prince Edward Island" },
  { code: "QC", name: "Quebec" },
  { code: "SK", name: "Saskatchewan" },
  { code: "YT", name: "Yukon" },
];

// All supported countries - add new countries here
export const COUNTRIES: Country[] = [
  {
    code: "US",
    name: "United States",
    subdivisionLabel: "State",
    postalCodeLabel: "ZIP Code",
    subdivisions: US_STATES,
  },
  {
    code: "CA",
    name: "Canada",
    subdivisionLabel: "Province",
    postalCodeLabel: "Postal Code",
    subdivisions: CA_PROVINCES,
  },
  // To add more countries:
  // {
  //   code: "GB",
  //   name: "United Kingdom",
  //   subdivisionLabel: "County",
  //   postalCodeLabel: "Postcode",
  //   subdivisions: [...],
  // },
];

// Helper to get country by code
export function getCountryByCode(code: string): Country | undefined {
  return COUNTRIES.find((c) => c.code === code);
}

// Helper to get subdivisions for a country
export function getSubdivisionsForCountry(countryCode: string): Subdivision[] {
  return getCountryByCode(countryCode)?.subdivisions ?? [];
}

// Helper to get subdivision label for a country
export function getSubdivisionLabel(countryCode: string): string {
  return getCountryByCode(countryCode)?.subdivisionLabel ?? "State/Province";
}

// Helper to get postal code label for a country
export function getPostalCodeLabel(countryCode: string): string {
  return getCountryByCode(countryCode)?.postalCodeLabel ?? "Postal Code";
}
