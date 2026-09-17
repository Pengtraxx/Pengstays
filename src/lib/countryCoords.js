// Approximate centroid [lat, lng] for each African country — used to place
// listings on the explore map (listings store country/state, not coordinates).
export const COUNTRY_COORDS = {
  "Algeria": [28.03, 1.66],
  "Angola": [-11.20, 17.87],
  "Benin": [9.31, 2.32],
  "Botswana": [-22.33, 24.68],
  "Burkina Faso": [12.24, -1.56],
  "Burundi": [-3.37, 29.92],
  "Cabo Verde": [16.00, -24.01],
  "Cameroon": [7.37, 12.35],
  "Central African Republic": [6.61, 20.94],
  "Chad": [15.45, 18.73],
  "Comoros": [-11.65, 43.33],
  "Congo": [-0.23, 15.83],
  "Democratic Republic of the Congo": [-4.04, 21.76],
  "Djibouti": [11.83, 42.59],
  "Egypt": [26.82, 30.80],
  "Equatorial Guinea": [1.65, 10.27],
  "Eritrea": [15.18, 39.78],
  "Eswatini": [-26.52, 31.47],
  "Ethiopia": [9.15, 40.49],
  "Gabon": [-0.80, 11.61],
  "Gambia": [13.44, -15.31],
  "Ghana": [7.95, -1.02],
  "Guinea": [9.95, -9.70],
  "Guinea-Bissau": [11.80, -15.18],
  "Ivory Coast": [7.54, -5.55],
  "Kenya": [-0.02, 37.91],
  "Lesotho": [-29.61, 28.23],
  "Liberia": [6.43, -9.43],
  "Libya": [26.34, 17.23],
  "Madagascar": [-18.77, 46.87],
  "Malawi": [-13.25, 34.30],
  "Mali": [17.57, -4.00],
  "Mauritania": [21.01, -10.94],
  "Mauritius": [-20.35, 57.55],
  "Morocco": [31.79, -7.09],
  "Mozambique": [-18.67, 35.53],
  "Namibia": [-22.96, 18.49],
  "Niger": [17.61, 8.08],
  "Nigeria": [9.08, 8.68],
  "Rwanda": [-1.94, 29.87],
  "Sao Tome and Principe": [0.19, 6.61],
  "Senegal": [14.50, -14.45],
  "Seychelles": [-4.68, 55.49],
  "Sierra Leone": [8.46, -11.78],
  "Somalia": [5.15, 46.20],
  "South Africa": [-30.56, 22.94],
  "South Sudan": [6.88, 31.31],
  "Sudan": [12.86, 30.22],
  "Tanzania": [-6.37, 34.89],
  "Togo": [8.62, 0.82],
  "Tunisia": [33.89, 9.54],
  "Uganda": [1.37, 32.29],
  "Zambia": [-13.13, 27.85],
  "Zimbabwe": [-19.02, 29.15]
};

// Finer placement for the states/regions we already list in locations.js.
export const STATE_COORDS = {
  "Nigeria|Lagos": [6.52, 3.38],
  "Nigeria|Abuja (FCT)": [9.06, 7.49],
  "Nigeria|Rivers": [4.81, 7.01],
  "Nigeria|Oyo": [7.85, 3.93],
  "Nigeria|Kano": [12.00, 8.52],
  "Nigeria|Enugu": [6.44, 7.50],
  "Nigeria|Delta": [5.53, 5.90],
  "Nigeria|Kaduna": [10.52, 7.44],
  "Nigeria|Ogun": [7.00, 3.35],
  "Nigeria|Edo": [6.34, 5.62],
  "Ghana|Greater Accra": [5.60, -0.19],
  "Ghana|Ashanti": [6.69, -1.62],
  "Ghana|Western": [5.00, -2.20],
  "Ghana|Central": [5.35, -1.10],
  "Ghana|Northern": [9.40, -0.85],
  "Kenya|Nairobi": [-1.29, 36.82],
  "Kenya|Mombasa": [-4.04, 39.67],
  "Kenya|Kisumu": [-0.09, 34.77],
  "Kenya|Nakuru": [-0.30, 36.08],
  "South Africa|Gauteng": [-26.20, 28.05],
  "South Africa|Western Cape": [-33.92, 18.42],
  "South Africa|KwaZulu-Natal": [-29.86, 31.02],
  "South Africa|Eastern Cape": [-33.02, 27.91],
  "Egypt|Cairo": [30.04, 31.24],
  "Egypt|Alexandria": [31.20, 29.92],
  "Egypt|Giza": [30.01, 31.21],
  "Egypt|Red Sea": [27.26, 33.81]
};

// Small deterministic offset so multiple listings in one place don't overlap.
export function coordsForListing(listing, index = 0) {
  const base =
    STATE_COORDS[`${listing.country}|${listing.state}`] || COUNTRY_COORDS[listing.country];
  if (!base) return null;
  const angle = index * 2.4;
  const r = index === 0 ? 0 : 0.12 + index * 0.03;
  return [base[0] + Math.sin(angle) * r, base[1] + Math.cos(angle) * r];
}