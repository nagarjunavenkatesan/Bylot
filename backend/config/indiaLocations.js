/**
 * Canonical India States and Union Territories Dataset for Bylot
 * Supports all 28 States and 8 Union Territories in accordance with
 * Government of India standard administrative classifications.
 */

const INDIA_STATES = [
  { code: 'AP', name: 'Andhra Pradesh', type: 'state' },
  { code: 'AR', name: 'Arunachal Pradesh', type: 'state' },
  { code: 'AS', name: 'Assam', type: 'state' },
  { code: 'BR', name: 'Bihar', type: 'state' },
  { code: 'CG', name: 'Chhattisgarh', type: 'state' },
  { code: 'GA', name: 'Goa', type: 'state' },
  { code: 'GJ', name: 'Gujarat', type: 'state' },
  { code: 'HR', name: 'Haryana', type: 'state' },
  { code: 'HP', name: 'Himachal Pradesh', type: 'state' },
  { code: 'JH', name: 'Jharkhand', type: 'state' },
  { code: 'KA', name: 'Karnataka', type: 'state' },
  { code: 'KL', name: 'Kerala', type: 'state' },
  { code: 'MP', name: 'Madhya Pradesh', type: 'state' },
  { code: 'MH', name: 'Maharashtra', type: 'state' },
  { code: 'MN', name: 'Manipur', type: 'state' },
  { code: 'ML', name: 'Meghalaya', type: 'state' },
  { code: 'MZ', name: 'Mizoram', type: 'state' },
  { code: 'NL', name: 'Nagaland', type: 'state' },
  { code: 'OD', name: 'Odisha', type: 'state' },
  { code: 'PB', name: 'Punjab', type: 'state' },
  { code: 'RJ', name: 'Rajasthan', type: 'state' },
  { code: 'SK', name: 'Sikkim', type: 'state' },
  { code: 'TN', name: 'Tamil Nadu', type: 'state' },
  { code: 'TS', name: 'Telangana', type: 'state' },
  { code: 'TR', name: 'Tripura', type: 'state' },
  { code: 'UP', name: 'Uttar Pradesh', type: 'state' },
  { code: 'UK', name: 'Uttarakhand', type: 'state' },
  { code: 'WB', name: 'West Bengal', type: 'state' }
];

const INDIA_UNION_TERRITORIES = [
  { code: 'AN', name: 'Andaman and Nicobar Islands', type: 'union_territory' },
  { code: 'CH', name: 'Chandigarh', type: 'union_territory' },
  { code: 'DN', name: 'Dadra and Nagar Haveli and Daman and Diu', type: 'union_territory' },
  { code: 'DL', name: 'Delhi', type: 'union_territory' },
  { code: 'JK', name: 'Jammu and Kashmir', type: 'union_territory' },
  { code: 'LA', name: 'Ladakh', type: 'union_territory' },
  { code: 'LD', name: 'Lakshadweep', type: 'union_territory' },
  { code: 'PY', name: 'Puducherry', type: 'union_territory' }
];

const ALL_INDIA_REGIONS = [...INDIA_STATES, ...INDIA_UNION_TERRITORIES];

// Fast normalized lookups
const NORM_LOOKUP = new Map();

ALL_INDIA_REGIONS.forEach((region) => {
  const normCode = region.code.trim().toUpperCase();
  const normName = region.name.trim().toLowerCase();
  NORM_LOOKUP.set(normCode, region);
  NORM_LOOKUP.set(normName, region);
  // Also register common acronyms/aliases
  if (region.code === 'TN') NORM_LOOKUP.set('tamilnadu', region);
  if (region.code === 'WB') NORM_LOOKUP.set('westbengal', region);
  if (region.code === 'UP') NORM_LOOKUP.set('uttarpradesh', region);
  if (region.code === 'MP') NORM_LOOKUP.set('madhyapradesh', region);
  if (region.code === 'AP') NORM_LOOKUP.set('andhra', region);
  if (region.code === 'HP') NORM_LOOKUP.set('himachal', region);
  if (region.code === 'DL') NORM_LOOKUP.set('nct of delhi', region);
  if (region.code === 'DN') NORM_LOOKUP.set('daman and diu', region);
  if (region.code === 'JK') NORM_LOOKUP.set('j&k', region);
});

// Curated districts / major cities for key states
const DISTRICTS_MAP = {
  TN: ['Chennai', 'Coimbatore', 'Madurai', 'Tiruchirappalli', 'Salem', 'Tirunelveli', 'Erode', 'Vellore', 'Thanjavur', 'Dindigul', 'Thoothukudi', 'Kanchipuram', 'Cuddalore', 'Karur', 'Namakkal', 'Other'],
  KA: ['Bengaluru Urban', 'Bengaluru Rural', 'Mysuru', 'Hubballi-Dharwad', 'Mangaluru (Dakshina Kannada)', 'Belagavi', 'Kalaburagi', 'Davanagere', 'Ballari', 'Shivamogga', 'Tumakuru', 'Udupi', 'Hassan', 'Other'],
  MH: ['Mumbai City', 'Mumbai Suburban', 'Pune', 'Nagpur', 'Thane', 'Nashik', 'Chhatrapati Sambhajinagar (Aurangabad)', 'Solapur', 'Amravati', 'Kolhapur', 'Navi Mumbai', 'Other'],
  DL: ['Central Delhi', 'New Delhi', 'North Delhi', 'South Delhi', 'East Delhi', 'West Delhi', 'North East Delhi', 'South West Delhi', 'North West Delhi', 'Shahdara', 'Other'],
  KL: ['Thiruvananthapuram', 'Ernakulam (Kochi)', 'Kozhikode', 'Thrissur', 'Kollam', 'Palakkad', 'Alappuzha', 'Malappuram', 'Kannur', 'Kottayam', 'Kasaragod', 'Other'],
  TS: ['Hyderabad', 'Warangal', 'Nizamabad', 'Karimnagar', 'Khammam', 'Rangareddy', 'Medchal-Malkajgiri', 'Sangareddy', 'Other'],
  AP: ['Visakhapatnam', 'Vijayawada (NTR)', 'Guntur', 'Nellore', 'Kurnool', 'Tirupati', 'Kakinada', 'Rajahmundry', 'Anantapur', 'Kadapa', 'Other'],
  GJ: ['Ahmedabad', 'Surat', 'Vadodara', 'Rajkot', 'Bhavnagar', 'Jamnagar', 'Gandhinagar', 'Junagadh', 'Anand', 'Navsari', 'Other'],
  RJ: ['Jaipur', 'Jodhpur', 'Kota', 'Bikaner', 'Ajmer', 'Udaipur', 'Bhilwara', 'Alwar', 'Bharatpur', 'Sikar', 'Other'],
  UP: ['Lucknow', 'Kanpur', 'Varanasi', 'Prayagraj (Allahabad)', 'Agra', 'Meerut', 'Noida (Gautam Buddha Nagar)', 'Ghaziabad', 'Bareilly', 'Aligarh', 'Moradabad', 'Gorakhpur', 'Other'],
  WB: ['Kolkata', 'Howrah', 'North 24 Parganas', 'South 24 Parganas', 'Hooghly', 'Purba Bardhaman', 'Paschim Medinipur', 'Darjeeling', 'Siliguri', 'Murshidabad', 'Other'],
  MP: ['Indore', 'Bhopal', 'Jabalpur', 'Gwalior', 'Ujjain', 'Sagar', 'Dewas', 'Satna', 'Ratlam', 'Rewa', 'Other'],
  HR: ['Gurugram (Gurgaon)', 'Faridabad', 'Panipat', 'Ambala', 'Yamunanagar', 'Rohtak', 'Hisar', 'Karnal', 'Sonipat', 'Panchkula', 'Other'],
  PB: ['Ludhiana', 'Amritsar', 'Jalandhar', 'Patiala', 'Bathinda', 'Mohali (SAS Nagar)', 'Hoshiarpur', 'Pathankot', 'Moga', 'Other'],
  BR: ['Patna', 'Gaya', 'Bhagalpur', 'Muzaffarpur', 'Purnia', 'Darbhanga', 'Bihar Sharif', 'Arrah', 'Begusarai', 'Katihar', 'Other'],
  CH: ['Chandigarh Central', 'Chandigarh North', 'Chandigarh South', 'Chandigarh East', 'Chandigarh West'],
  GA: ['North Goa', 'South Goa'],
  JK: ['Srinagar', 'Jammu', 'Anantnag', 'Baramulla', 'Kathua', 'Udhampur', 'Budgam', 'Other'],
  PY: ['Puducherry', 'Karaikal', 'Mahe', 'Yanam']
};

/**
 * Validates whether the given string or code represents a canonical Indian State or UT.
 * @param {string} input - State name or 2-letter code
 * @returns {boolean}
 */
function isValidStateOrUT(input) {
  if (!input || typeof input !== 'string') return false;
  const clean = input.trim().toLowerCase();
  return NORM_LOOKUP.has(clean) || NORM_LOOKUP.has(input.trim().toUpperCase());
}

/**
 * Resolves a state/UT name or code to its canonical canonical display name.
 * Returns null if invalid.
 * @param {string} input
 * @returns {string|null}
 */
function resolveCanonicalState(input) {
  if (!input || typeof input !== 'string') return null;
  const clean = input.trim().toLowerCase();
  const found = NORM_LOOKUP.get(clean) || NORM_LOOKUP.get(input.trim().toUpperCase());
  return found ? found.name : null;
}

/**
 * Resolves a state/UT to its canonical record { code, name, type }.
 * @param {string} input
 * @returns {object|null}
 */
function getRegionDetails(input) {
  if (!input || typeof input !== 'string') return null;
  const clean = input.trim().toLowerCase();
  return NORM_LOOKUP.get(clean) || NORM_LOOKUP.get(input.trim().toUpperCase()) || null;
}

/**
 * Returns the list of districts for a state or UT.
 * Falls back to generic list if state is valid but no specific district map exists.
 * @param {string} input
 * @returns {string[]}
 */
function getDistrictsForRegion(input) {
  const region = getRegionDetails(input);
  if (!region) return [];
  if (DISTRICTS_MAP[region.code]) {
    return DISTRICTS_MAP[region.code];
  }
  // Default regional hubs
  return [
    `${region.name} Central / Capital`,
    `${region.name} North`,
    `${region.name} South`,
    `${region.name} East`,
    `${region.name} West`,
    'Other'
  ];
}

module.exports = {
  INDIA_STATES,
  INDIA_UNION_TERRITORIES,
  ALL_INDIA_REGIONS,
  isValidStateOrUT,
  resolveCanonicalState,
  getRegionDetails,
  getDistrictsForRegion
};
