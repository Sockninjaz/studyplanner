// ─────────────────────────────────────────────────────────────────────────────
// Onboarding Data: Countries, Regions, Academic Tracks, Exam Boards
// ─────────────────────────────────────────────────────────────────────────────

export interface Country {
  code: string; // ISO 3166-1 alpha-2
  name: string;
  emoji: string;
}

export interface Region {
  code: string;
  name: string;
}

export interface AcademicTrack {
  id: string;
  label: string;
  description: string;
  icon: string; // lucide icon name
}

export interface Grade {
  id: string;
  label: string;
}

export interface ExamBoard {
  id: string;
  shortCode: string;
  label: string;
  description: string;
}

// ─── Country List ────────────────────────────────────────────────────────────

export const COUNTRIES: Country[] = [
  { code: "AF", name: "Afghanistan", emoji: "🇦🇫" },
  { code: "AL", name: "Albania", emoji: "🇦🇱" },
  { code: "DZ", name: "Algeria", emoji: "🇩🇿" },
  { code: "AD", name: "Andorra", emoji: "🇦🇩" },
  { code: "AO", name: "Angola", emoji: "🇦🇴" },
  { code: "AG", name: "Antigua and Barbuda", emoji: "🇦🇬" },
  { code: "AR", name: "Argentina", emoji: "🇦🇷" },
  { code: "AM", name: "Armenia", emoji: "🇦🇲" },
  { code: "AU", name: "Australia", emoji: "🇦🇺" },
  { code: "AT", name: "Austria", emoji: "🇦🇹" },
  { code: "AZ", name: "Azerbaijan", emoji: "🇦🇿" },
  { code: "BS", name: "Bahamas", emoji: "🇧🇸" },
  { code: "BH", name: "Bahrain", emoji: "🇧🇭" },
  { code: "BD", name: "Bangladesh", emoji: "🇧🇩" },
  { code: "BB", name: "Barbados", emoji: "🇧🇧" },
  { code: "BY", name: "Belarus", emoji: "🇧🇾" },
  { code: "BE", name: "Belgium", emoji: "🇧🇪" },
  { code: "BZ", name: "Belize", emoji: "🇧🇿" },
  { code: "BJ", name: "Benin", emoji: "🇧🇯" },
  { code: "BT", name: "Bhutan", emoji: "🇧🇹" },
  { code: "BO", name: "Bolivia", emoji: "🇧🇴" },
  { code: "BA", name: "Bosnia and Herzegovina", emoji: "🇧🇦" },
  { code: "BW", name: "Botswana", emoji: "🇧🇼" },
  { code: "BR", name: "Brazil", emoji: "🇧🇷" },
  { code: "BN", name: "Brunei", emoji: "🇧🇳" },
  { code: "BG", name: "Bulgaria", emoji: "🇧🇬" },
  { code: "BF", name: "Burkina Faso", emoji: "🇧🇫" },
  { code: "BI", name: "Burundi", emoji: "🇧🇮" },
  { code: "CV", name: "Cabo Verde", emoji: "🇨🇻" },
  { code: "KH", name: "Cambodia", emoji: "🇰🇭" },
  { code: "CM", name: "Cameroon", emoji: "🇨🇲" },
  { code: "CA", name: "Canada", emoji: "🇨🇦" },
  { code: "CF", name: "Central African Republic", emoji: "🇨🇫" },
  { code: "TD", name: "Chad", emoji: "🇹🇩" },
  { code: "CL", name: "Chile", emoji: "🇨🇱" },
  { code: "CN", name: "China", emoji: "🇨🇳" },
  { code: "CO", name: "Colombia", emoji: "🇨🇴" },
  { code: "KM", name: "Comoros", emoji: "🇰🇲" },
  { code: "CG", name: "Congo", emoji: "🇨🇬" },
  { code: "CR", name: "Costa Rica", emoji: "🇨🇷" },
  { code: "HR", name: "Croatia", emoji: "🇭🇷" },
  { code: "CU", name: "Cuba", emoji: "🇨🇺" },
  { code: "CY", name: "Cyprus", emoji: "🇨🇾" },
  { code: "CZ", name: "Czech Republic", emoji: "🇨🇿" },
  { code: "DK", name: "Denmark", emoji: "🇩🇰" },
  { code: "DJ", name: "Djibouti", emoji: "🇩🇯" },
  { code: "DM", name: "Dominica", emoji: "🇩🇲" },
  { code: "DO", name: "Dominican Republic", emoji: "🇩🇴" },
  { code: "EC", name: "Ecuador", emoji: "🇪🇨" },
  { code: "EG", name: "Egypt", emoji: "🇪🇬" },
  { code: "SV", name: "El Salvador", emoji: "🇸🇻" },
  { code: "GQ", name: "Equatorial Guinea", emoji: "🇬🇶" },
  { code: "ER", name: "Eritrea", emoji: "🇪🇷" },
  { code: "EE", name: "Estonia", emoji: "🇪🇪" },
  { code: "SZ", name: "Eswatini", emoji: "🇸🇿" },
  { code: "ET", name: "Ethiopia", emoji: "🇪🇹" },
  { code: "FJ", name: "Fiji", emoji: "🇫🇯" },
  { code: "FI", name: "Finland", emoji: "🇫🇮" },
  { code: "FR", name: "France", emoji: "🇫🇷" },
  { code: "GA", name: "Gabon", emoji: "🇬🇦" },
  { code: "GM", name: "Gambia", emoji: "🇬🇲" },
  { code: "GE", name: "Georgia", emoji: "🇬🇪" },
  { code: "DE", name: "Germany", emoji: "🇩🇪" },
  { code: "GH", name: "Ghana", emoji: "🇬🇭" },
  { code: "GR", name: "Greece", emoji: "🇬🇷" },
  { code: "GD", name: "Grenada", emoji: "🇬🇩" },
  { code: "GT", name: "Guatemala", emoji: "🇬🇹" },
  { code: "GN", name: "Guinea", emoji: "🇬🇳" },
  { code: "GW", name: "Guinea-Bissau", emoji: "🇬🇼" },
  { code: "GY", name: "Guyana", emoji: "🇬🇾" },
  { code: "HT", name: "Haiti", emoji: "🇭🇹" },
  { code: "HN", name: "Honduras", emoji: "🇭🇳" },
  { code: "HU", name: "Hungary", emoji: "🇭🇺" },
  { code: "IS", name: "Iceland", emoji: "🇮🇸" },
  { code: "IN", name: "India", emoji: "🇮🇳" },
  { code: "ID", name: "Indonesia", emoji: "🇮🇩" },
  { code: "IR", name: "Iran", emoji: "🇮🇷" },
  { code: "IQ", name: "Iraq", emoji: "🇮🇶" },
  { code: "IE", name: "Ireland", emoji: "🇮🇪" },
  { code: "IL", name: "Israel", emoji: "🇮🇱" },
  { code: "IT", name: "Italy", emoji: "🇮🇹" },
  { code: "JM", name: "Jamaica", emoji: "🇯🇲" },
  { code: "JP", name: "Japan", emoji: "🇯🇵" },
  { code: "JO", name: "Jordan", emoji: "🇯🇴" },
  { code: "KZ", name: "Kazakhstan", emoji: "🇰🇿" },
  { code: "KE", name: "Kenya", emoji: "🇰🇪" },
  { code: "KI", name: "Kiribati", emoji: "🇰🇮" },
  { code: "KP", name: "Korea, North", emoji: "🇰🇵" },
  { code: "KR", name: "Korea, South", emoji: "🇰🇷" },
  { code: "KW", name: "Kuwait", emoji: "🇰🇼" },
  { code: "KG", name: "Kyrgyzstan", emoji: "🇰🇬" },
  { code: "LA", name: "Laos", emoji: "🇱🇦" },
  { code: "LV", name: "Latvia", emoji: "🇱🇻" },
  { code: "LB", name: "Lebanon", emoji: "🇱🇧" },
  { code: "LS", name: "Lesotho", emoji: "🇱🇸" },
  { code: "LR", name: "Liberia", emoji: "🇱🇷" },
  { code: "LY", name: "Libya", emoji: "🇱🇾" },
  { code: "LI", name: "Liechtenstein", emoji: "🇱🇮" },
  { code: "LT", name: "Lithuania", emoji: "🇱🇹" },
  { code: "LU", name: "Luxembourg", emoji: "🇱🇺" },
  { code: "MG", name: "Madagascar", emoji: "🇲🇬" },
  { code: "MW", name: "Malawi", emoji: "🇲🇼" },
  { code: "MY", name: "Malaysia", emoji: "🇲🇾" },
  { code: "MV", name: "Maldives", emoji: "🇲🇻" },
  { code: "ML", name: "Mali", emoji: "🇲🇱" },
  { code: "MT", name: "Malta", emoji: "🇲🇹" },
  { code: "MH", name: "Marshall Islands", emoji: "🇲🇭" },
  { code: "MR", name: "Mauritania", emoji: "🇲🇷" },
  { code: "MU", name: "Mauritius", emoji: "🇲🇺" },
  { code: "MX", name: "Mexico", emoji: "🇲🇽" },
  { code: "FM", name: "Micronesia", emoji: "🇫🇲" },
  { code: "MD", name: "Moldova", emoji: "🇲🇩" },
  { code: "MC", name: "Monaco", emoji: "🇲🇨" },
  { code: "MN", name: "Mongolia", emoji: "🇲🇳" },
  { code: "ME", name: "Montenegro", emoji: "🇲🇪" },
  { code: "MA", name: "Morocco", emoji: "🇲🇦" },
  { code: "MZ", name: "Mozambique", emoji: "🇲🇿" },
  { code: "MM", name: "Myanmar", emoji: "🇲🇲" },
  { code: "NA", name: "Namibia", emoji: "🇳🇦" },
  { code: "NR", name: "Nauru", emoji: "🇳🇷" },
  { code: "NP", name: "Nepal", emoji: "🇳🇵" },
  { code: "NL", name: "Netherlands", emoji: "🇳🇱" },
  { code: "NZ", name: "New Zealand", emoji: "🇳🇿" },
  { code: "NI", name: "Nicaragua", emoji: "🇳🇮" },
  { code: "NE", name: "Niger", emoji: "🇳🇪" },
  { code: "NG", name: "Nigeria", emoji: "🇳🇬" },
  { code: "MK", name: "North Macedonia", emoji: "🇲🇰" },
  { code: "NO", name: "Norway", emoji: "🇳🇴" },
  { code: "OM", name: "Oman", emoji: "🇴🇲" },
  { code: "PK", name: "Pakistan", emoji: "🇵🇰" },
  { code: "PW", name: "Palau", emoji: "🇵🇼" },
  { code: "PA", name: "Panama", emoji: "🇵🇦" },
  { code: "PG", name: "Papua New Guinea", emoji: "🇵🇬" },
  { code: "PY", name: "Paraguay", emoji: "🇵🇾" },
  { code: "PE", name: "Peru", emoji: "🇵🇪" },
  { code: "PH", name: "Philippines", emoji: "🇵🇭" },
  { code: "PL", name: "Poland", emoji: "🇵🇱" },
  { code: "PT", name: "Portugal", emoji: "🇵🇹" },
  { code: "QA", name: "Qatar", emoji: "🇶🇦" },
  { code: "RO", name: "Romania", emoji: "🇷🇴" },
  { code: "RU", name: "Russia", emoji: "🇷🇺" },
  { code: "RW", name: "Rwanda", emoji: "🇷🇼" },
  { code: "KN", name: "Saint Kitts and Nevis", emoji: "🇰🇳" },
  { code: "LC", name: "Saint Lucia", emoji: "🇱🇨" },
  { code: "VC", name: "Saint Vincent and the Grenadines", emoji: "🇻🇨" },
  { code: "WS", name: "Samoa", emoji: "🇼🇸" },
  { code: "SM", name: "San Marino", emoji: "🇸🇲" },
  { code: "ST", name: "São Tomé and Príncipe", emoji: "🇸🇹" },
  { code: "SA", name: "Saudi Arabia", emoji: "🇸🇦" },
  { code: "SN", name: "Senegal", emoji: "🇸🇳" },
  { code: "RS", name: "Serbia", emoji: "🇷🇸" },
  { code: "SC", name: "Seychelles", emoji: "🇸🇨" },
  { code: "SL", name: "Sierra Leone", emoji: "🇸🇱" },
  { code: "SG", name: "Singapore", emoji: "🇸🇬" },
  { code: "SK", name: "Slovakia", emoji: "🇸🇰" },
  { code: "SI", name: "Slovenia", emoji: "🇸🇮" },
  { code: "SB", name: "Solomon Islands", emoji: "🇸🇧" },
  { code: "SO", name: "Somalia", emoji: "🇸🇴" },
  { code: "ZA", name: "South Africa", emoji: "🇿🇦" },
  { code: "SS", name: "South Sudan", emoji: "🇸🇸" },
  { code: "ES", name: "Spain", emoji: "🇪🇸" },
  { code: "LK", name: "Sri Lanka", emoji: "🇱🇰" },
  { code: "SD", name: "Sudan", emoji: "🇸🇩" },
  { code: "SR", name: "Suriname", emoji: "🇸🇷" },
  { code: "SE", name: "Sweden", emoji: "🇸🇪" },
  { code: "CH", name: "Switzerland", emoji: "🇨🇭" },
  { code: "SY", name: "Syria", emoji: "🇸🇾" },
  { code: "TW", name: "Taiwan", emoji: "🇹🇼" },
  { code: "TJ", name: "Tajikistan", emoji: "🇹🇯" },
  { code: "TZ", name: "Tanzania", emoji: "🇹🇿" },
  { code: "TH", name: "Thailand", emoji: "🇹🇭" },
  { code: "TL", name: "Timor-Leste", emoji: "🇹🇱" },
  { code: "TG", name: "Togo", emoji: "🇹🇬" },
  { code: "TO", name: "Tonga", emoji: "🇹🇴" },
  { code: "TT", name: "Trinidad and Tobago", emoji: "🇹🇹" },
  { code: "TN", name: "Tunisia", emoji: "🇹🇳" },
  { code: "TR", name: "Turkey", emoji: "🇹🇷" },
  { code: "TM", name: "Turkmenistan", emoji: "🇹🇲" },
  { code: "TV", name: "Tuvalu", emoji: "🇹🇻" },
  { code: "UG", name: "Uganda", emoji: "🇺🇬" },
  { code: "UA", name: "Ukraine", emoji: "🇺🇦" },
  { code: "AE", name: "United Arab Emirates", emoji: "🇦🇪" },
  { code: "GB", name: "United Kingdom", emoji: "🇬🇧" },
  { code: "US", name: "United States", emoji: "🇺🇸" },
  { code: "UY", name: "Uruguay", emoji: "🇺🇾" },
  { code: "UZ", name: "Uzbekistan", emoji: "🇺🇿" },
  { code: "VU", name: "Vanuatu", emoji: "🇻🇺" },
  { code: "VE", name: "Venezuela", emoji: "🇻🇪" },
  { code: "VN", name: "Vietnam", emoji: "🇻🇳" },
  { code: "YE", name: "Yemen", emoji: "🇾🇪" },
  { code: "ZM", name: "Zambia", emoji: "🇿🇲" },
  { code: "ZW", name: "Zimbabwe", emoji: "🇿🇼" },
];

// ─── Countries requiring a regional sub-step ─────────────────────────────────

export const COUNTRIES_WITH_REGIONS = new Set([
  "US", // States
  "CA", // Provinces
  "DE", // Bundesländer
  "AU", // States/Territories
  "IN", // States
  "BR", // States
  "MX", // States
  "CH", // Cantons
  "AT", // Bundesländer
  "BE", // Regions/Communities
  "ES", // Autonomous Communities
]);

// ─── Countries + tracks that trigger an exam-board step ──────────────────────

export const TRACKS_REQUIRING_EXAM_BOARD = new Set([
  "a-levels",
  "gcse",
  "ib",
]);

// ─── Regions by Country ───────────────────────────────────────────────────────

export const REGIONS_BY_COUNTRY: Record<string, Region[]> = {
  US: [
    { code: "AL", name: "Alabama" }, { code: "AK", name: "Alaska" },
    { code: "AZ", name: "Arizona" }, { code: "AR", name: "Arkansas" },
    { code: "CA", name: "California" }, { code: "CO", name: "Colorado" },
    { code: "CT", name: "Connecticut" }, { code: "DE", name: "Delaware" },
    { code: "FL", name: "Florida" }, { code: "GA", name: "Georgia" },
    { code: "HI", name: "Hawaii" }, { code: "ID", name: "Idaho" },
    { code: "IL", name: "Illinois" }, { code: "IN", name: "Indiana" },
    { code: "IA", name: "Iowa" }, { code: "KS", name: "Kansas" },
    { code: "KY", name: "Kentucky" }, { code: "LA", name: "Louisiana" },
    { code: "ME", name: "Maine" }, { code: "MD", name: "Maryland" },
    { code: "MA", name: "Massachusetts" }, { code: "MI", name: "Michigan" },
    { code: "MN", name: "Minnesota" }, { code: "MS", name: "Mississippi" },
    { code: "MO", name: "Missouri" }, { code: "MT", name: "Montana" },
    { code: "NE", name: "Nebraska" }, { code: "NV", name: "Nevada" },
    { code: "NH", name: "New Hampshire" }, { code: "NJ", name: "New Jersey" },
    { code: "NM", name: "New Mexico" }, { code: "NY", name: "New York" },
    { code: "NC", name: "North Carolina" }, { code: "ND", name: "North Dakota" },
    { code: "OH", name: "Ohio" }, { code: "OK", name: "Oklahoma" },
    { code: "OR", name: "Oregon" }, { code: "PA", name: "Pennsylvania" },
    { code: "RI", name: "Rhode Island" }, { code: "SC", name: "South Carolina" },
    { code: "SD", name: "South Dakota" }, { code: "TN", name: "Tennessee" },
    { code: "TX", name: "Texas" }, { code: "UT", name: "Utah" },
    { code: "VT", name: "Vermont" }, { code: "VA", name: "Virginia" },
    { code: "WA", name: "Washington" }, { code: "WV", name: "West Virginia" },
    { code: "WI", name: "Wisconsin" }, { code: "WY", name: "Wyoming" },
    { code: "DC", name: "Washington D.C." },
  ],
  CA: [
    { code: "AB", name: "Alberta" }, { code: "BC", name: "British Columbia" },
    { code: "MB", name: "Manitoba" }, { code: "NB", name: "New Brunswick" },
    { code: "NL", name: "Newfoundland and Labrador" }, { code: "NS", name: "Nova Scotia" },
    { code: "NT", name: "Northwest Territories" }, { code: "NU", name: "Nunavut" },
    { code: "ON", name: "Ontario" }, { code: "PE", name: "Prince Edward Island" },
    { code: "QC", name: "Quebec" }, { code: "SK", name: "Saskatchewan" },
    { code: "YT", name: "Yukon" },
  ],
  DE: [
    { code: "BW", name: "Baden-Württemberg" }, { code: "BY", name: "Bavaria (Bayern)" },
    { code: "BE", name: "Berlin" }, { code: "BB", name: "Brandenburg" },
    { code: "HB", name: "Bremen" }, { code: "HH", name: "Hamburg" },
    { code: "HE", name: "Hesse (Hessen)" }, { code: "MV", name: "Mecklenburg-Vorpommern" },
    { code: "NI", name: "Lower Saxony (Niedersachsen)" }, { code: "NW", name: "North Rhine-Westphalia (NRW)" },
    { code: "RP", name: "Rhineland-Palatinate" }, { code: "SL", name: "Saarland" },
    { code: "SN", name: "Saxony (Sachsen)" }, { code: "ST", name: "Saxony-Anhalt" },
    { code: "SH", name: "Schleswig-Holstein" }, { code: "TH", name: "Thuringia (Thüringen)" },
  ],
  AU: [
    { code: "NSW", name: "New South Wales" }, { code: "VIC", name: "Victoria" },
    { code: "QLD", name: "Queensland" }, { code: "WA", name: "Western Australia" },
    { code: "SA", name: "South Australia" }, { code: "TAS", name: "Tasmania" },
    { code: "ACT", name: "Australian Capital Territory" }, { code: "NT", name: "Northern Territory" },
  ],
  IN: [
    { code: "AP", name: "Andhra Pradesh" }, { code: "AR", name: "Arunachal Pradesh" },
    { code: "AS", name: "Assam" }, { code: "BR", name: "Bihar" },
    { code: "CT", name: "Chhattisgarh" }, { code: "GA", name: "Goa" },
    { code: "GJ", name: "Gujarat" }, { code: "HR", name: "Haryana" },
    { code: "HP", name: "Himachal Pradesh" }, { code: "JK", name: "Jammu and Kashmir" },
    { code: "JH", name: "Jharkhand" }, { code: "KA", name: "Karnataka" },
    { code: "KL", name: "Kerala" }, { code: "MP", name: "Madhya Pradesh" },
    { code: "MH", name: "Maharashtra" }, { code: "MN", name: "Manipur" },
    { code: "ML", name: "Meghalaya" }, { code: "MZ", name: "Mizoram" },
    { code: "NL", name: "Nagaland" }, { code: "OD", name: "Odisha" },
    { code: "PB", name: "Punjab" }, { code: "RJ", name: "Rajasthan" },
    { code: "SK", name: "Sikkim" }, { code: "TN", name: "Tamil Nadu" },
    { code: "TS", name: "Telangana" }, { code: "TR", name: "Tripura" },
    { code: "UP", name: "Uttar Pradesh" }, { code: "UK", name: "Uttarakhand" },
    { code: "WB", name: "West Bengal" }, { code: "DL", name: "Delhi" },
  ],
  BR: [
    { code: "AC", name: "Acre" }, { code: "AL", name: "Alagoas" },
    { code: "AP", name: "Amapá" }, { code: "AM", name: "Amazonas" },
    { code: "BA", name: "Bahia" }, { code: "CE", name: "Ceará" },
    { code: "ES", name: "Espírito Santo" }, { code: "GO", name: "Goiás" },
    { code: "MA", name: "Maranhão" }, { code: "MT", name: "Mato Grosso" },
    { code: "MS", name: "Mato Grosso do Sul" }, { code: "MG", name: "Minas Gerais" },
    { code: "PA", name: "Pará" }, { code: "PB", name: "Paraíba" },
    { code: "PR", name: "Paraná" }, { code: "PE", name: "Pernambuco" },
    { code: "PI", name: "Piauí" }, { code: "RJ", name: "Rio de Janeiro" },
    { code: "RN", name: "Rio Grande do Norte" }, { code: "RS", name: "Rio Grande do Sul" },
    { code: "RO", name: "Rondônia" }, { code: "RR", name: "Roraima" },
    { code: "SC", name: "Santa Catarina" }, { code: "SP", name: "São Paulo" },
    { code: "SE", name: "Sergipe" }, { code: "TO", name: "Tocantins" },
    { code: "DF", name: "Distrito Federal" },
  ],
  MX: [
    { code: "AGU", name: "Aguascalientes" }, { code: "BCN", name: "Baja California" },
    { code: "BCS", name: "Baja California Sur" }, { code: "CAM", name: "Campeche" },
    { code: "CHP", name: "Chiapas" }, { code: "CHH", name: "Chihuahua" },
    { code: "CMX", name: "Mexico City" }, { code: "COA", name: "Coahuila" },
    { code: "COL", name: "Colima" }, { code: "DUR", name: "Durango" },
    { code: "GUA", name: "Guanajuato" }, { code: "GRO", name: "Guerrero" },
    { code: "HID", name: "Hidalgo" }, { code: "JAL", name: "Jalisco" },
    { code: "MEX", name: "Mexico State" }, { code: "MIC", name: "Michoacán" },
    { code: "MOR", name: "Morelos" }, { code: "NAY", name: "Nayarit" },
    { code: "NLE", name: "Nuevo León" }, { code: "OAX", name: "Oaxaca" },
    { code: "PUE", name: "Puebla" }, { code: "QUE", name: "Querétaro" },
    { code: "ROO", name: "Quintana Roo" }, { code: "SLP", name: "San Luis Potosí" },
    { code: "SIN", name: "Sinaloa" }, { code: "SON", name: "Sonora" },
    { code: "TAB", name: "Tabasco" }, { code: "TAM", name: "Tamaulipas" },
    { code: "TLA", name: "Tlaxcala" }, { code: "VER", name: "Veracruz" },
    { code: "YUC", name: "Yucatán" }, { code: "ZAC", name: "Zacatecas" },
  ],
  CH: [
    { code: "AG", name: "Aargau" }, { code: "AR", name: "Appenzell Ausserrhoden" },
    { code: "AI", name: "Appenzell Innerrhoden" }, { code: "BL", name: "Basel-Landschaft" },
    { code: "BS", name: "Basel-Stadt" }, { code: "BE", name: "Bern" },
    { code: "FR", name: "Fribourg" }, { code: "GE", name: "Geneva" },
    { code: "GL", name: "Glarus" }, { code: "GR", name: "Graubünden" },
    { code: "JU", name: "Jura" }, { code: "LU", name: "Lucerne" },
    { code: "NE", name: "Neuchâtel" }, { code: "NW", name: "Nidwalden" },
    { code: "OW", name: "Obwalden" }, { code: "SG", name: "St. Gallen" },
    { code: "SH", name: "Schaffhausen" }, { code: "SZ", name: "Schwyz" },
    { code: "SO", name: "Solothurn" }, { code: "TG", name: "Thurgau" },
    { code: "TI", name: "Ticino" }, { code: "UR", name: "Uri" },
    { code: "VD", name: "Vaud" }, { code: "VS", name: "Valais" },
    { code: "ZG", name: "Zug" }, { code: "ZH", name: "Zürich" },
  ],
  AT: [
    { code: "B", name: "Burgenland" }, { code: "K", name: "Carinthia (Kärnten)" },
    { code: "NO", name: "Lower Austria (Niederösterreich)" }, { code: "OO", name: "Upper Austria (Oberösterreich)" },
    { code: "S", name: "Salzburg" }, { code: "ST", name: "Styria (Steiermark)" },
    { code: "T", name: "Tyrol (Tirol)" }, { code: "V", name: "Vorarlberg" },
    { code: "W", name: "Vienna (Wien)" },
  ],
  BE: [
    { code: "VLG", name: "Flemish Region" }, { code: "WAL", name: "Walloon Region" },
    { code: "BRU", name: "Brussels-Capital Region" },
  ],
  ES: [
    { code: "AN", name: "Andalusia" }, { code: "AR", name: "Aragon" },
    { code: "AS", name: "Asturias" }, { code: "CN", name: "Canary Islands" },
    { code: "CB", name: "Cantabria" }, { code: "CL", name: "Castile and León" },
    { code: "CM", name: "Castile-La Mancha" }, { code: "CT", name: "Catalonia" },
    { code: "EX", name: "Extremadura" }, { code: "GA", name: "Galicia" },
    { code: "IB", name: "Balearic Islands" }, { code: "LR", name: "La Rioja" },
    { code: "MD", name: "Community of Madrid" }, { code: "MC", name: "Region of Murcia" },
    { code: "NC", name: "Navarre" }, { code: "PV", name: "Basque Country" },
    { code: "VC", name: "Valencian Community" },
  ],
};

// ─── Academic Tracks by Country ───────────────────────────────────────────────

const DEFAULT_TRACKS: AcademicTrack[] = [
  { id: "secondary", label: "Secondary School", description: "High school or equivalent", icon: "BookOpen" },
  { id: "undergraduate", label: "Undergraduate", description: "Bachelor's degree programme", icon: "GraduationCap" },
  { id: "postgraduate", label: "Postgraduate", description: "Master's or PhD programme", icon: "Microscope" },
  { id: "vocational", label: "Vocational / Trade", description: "Apprenticeship or vocational training", icon: "Wrench" },
];

export const TRACKS_BY_COUNTRY: Record<string, AcademicTrack[]> = {
  NL: [
    { id: "vwo", label: "VWO", description: "Voorbereidend Wetenschappelijk Onderwijs", icon: "Landmark" },
    { id: "havo", label: "HAVO", description: "Hoger Algemeen Voortgezet Onderwijs", icon: "BookOpen" },
    { id: "mavo-vmbo", label: "MAVO / VMBO", description: "Middelbaar Algemeen Voortgezet Onderwijs", icon: "Pencil" },
    { id: "mbo", label: "MBO", description: "Middelbaar Beroepsonderwijs (vocational)", icon: "Wrench" },
    { id: "hbo", label: "HBO / University of Applied Sciences", description: "Hoger Beroepsonderwijs", icon: "GraduationCap" },
    { id: "university-nl", label: "Universiteit (WO)", description: "Research university bachelor's or master's", icon: "Microscope" },
  ],
  DE: [
    { id: "gymnasium", label: "Gymnasium", description: "University-preparatory secondary school", icon: "Landmark" },
    { id: "realschule", label: "Realschule", description: "Intermediate secondary school", icon: "BookOpen" },
    { id: "hauptschule", label: "Hauptschule", description: "Lower secondary school", icon: "Pencil" },
    { id: "berufsschule", label: "Berufsschule / Ausbildung", description: "Vocational training school", icon: "Wrench" },
    { id: "fachhochschule", label: "Fachhochschule (FH)", description: "University of applied sciences", icon: "GraduationCap" },
    { id: "universitaet", label: "Universität", description: "Research university", icon: "Microscope" },
  ],
  GB: [
    { id: "gcse", label: "GCSE", description: "General Certificate of Secondary Education (Year 10–11)", icon: "FileText" },
    { id: "a-levels", label: "A-Levels", description: "Advanced Level (Year 12–13)", icon: "Landmark" },
    { id: "btec", label: "BTEC", description: "Business and Technology Education Council", icon: "Clipboard" },
    { id: "scottish-highers", label: "Scottish Highers", description: "SQA Higher & Advanced Higher", icon: "Flag" },
    { id: "ib", label: "International Baccalaureate", description: "IB Diploma Programme", icon: "Globe" },
    { id: "university-uk", label: "University", description: "Undergraduate or postgraduate degree", icon: "GraduationCap" },
  ],
  AT: [
    { id: "gymnasium-at", label: "Gymnasium", description: "AHS — Allgemeinbildende Höhere Schule", icon: "Landmark" },
    { id: "hs-at", label: "Mittelschule", description: "Middle school (NMS)", icon: "BookOpen" },
    { id: "htl", label: "HTL / HAK", description: "Technical and commercial colleges", icon: "Wrench" },
    { id: "university-at", label: "Universität / FH", description: "University or Fachhochschule", icon: "GraduationCap" },
  ],
  AU: [
    { id: "years7-10", label: "Years 7–10", description: "Junior secondary school", icon: "BookOpen" },
    { id: "years11-12", label: "Years 11–12 (HSC/VCE)", description: "Senior secondary school with state-based exams", icon: "Landmark" },
    { id: "tafe", label: "TAFE / VET", description: "Vocational Education and Training", icon: "Wrench" },
    { id: "undergraduate-au", label: "University (Undergraduate)", description: "Bachelor's degree", icon: "GraduationCap" },
    { id: "postgraduate-au", label: "University (Postgraduate)", description: "Master's or PhD", icon: "Microscope" },
  ],
  US: [
    { id: "middle-school", label: "Middle School (Grades 6–8)", description: "Junior secondary education", icon: "BookOpen" },
    { id: "high-school", label: "High School (Grades 9–12)", description: "Senior secondary education", icon: "Landmark" },
    { id: "community-college", label: "Community College / Associate's", description: "Two-year college programme", icon: "BookOpen" },
    { id: "undergraduate-us", label: "College / University", description: "Four-year bachelor's degree", icon: "GraduationCap" },
    { id: "graduate-us", label: "Graduate School", description: "Master's or doctoral programme", icon: "Microscope" },
  ],
  FR: [
    { id: "college-fr", label: "Collège", description: "Middle school (6ème–3ème)", icon: "BookOpen" },
    { id: "lycee-general", label: "Lycée Général", description: "General baccalaureate track", icon: "Landmark" },
    { id: "lycee-techno", label: "Lycée Technologique", description: "Technological baccalaureate track", icon: "Wrench" },
    { id: "bts-iut", label: "BTS / IUT", description: "Short higher education (2 years)", icon: "Clipboard" },
    { id: "licence", label: "Licence (L1–L3)", description: "University undergraduate", icon: "GraduationCap" },
    { id: "master", label: "Master / Grandes Écoles", description: "Postgraduate education", icon: "Microscope" },
  ],
  JP: [
    { id: "junior-high-jp", label: "Junior High School", description: "Chūgakkō (Grades 7–9)", icon: "BookOpen" },
    { id: "high-school-jp", label: "High School", description: "Kōkō (Grades 10–12)", icon: "Landmark" },
    { id: "vocational-jp", label: "Vocational School", description: "Senmon gakkō", icon: "Wrench" },
    { id: "university-jp", label: "University", description: "Daigaku (Undergraduate)", icon: "GraduationCap" },
    { id: "graduate-jp", label: "Graduate School", description: "Daigakuin (Master's / PhD)", icon: "Microscope" },
  ],
};

// ─── Grades / Years by Country ───────────────────────────────────────────────

const DEFAULT_GRADES: Grade[] = Array.from({ length: 12 }, (_, i) => ({
  id: `year-${i + 1}`,
  label: `Year ${i + 1}`
})).concat([
  { id: "university-1", label: "University Year 1" },
  { id: "university-2", label: "University Year 2" },
  { id: "university-3", label: "University Year 3" },
  { id: "university-4+", label: "University Year 4+" }
]);

export const GRADES_BY_COUNTRY: Record<string, Grade[]> = {
  US: [
    { id: "grade-6", label: "Grade 6" }, { id: "grade-7", label: "Grade 7" }, { id: "grade-8", label: "Grade 8" },
    { id: "grade-9", label: "Grade 9 (Freshman)" }, { id: "grade-10", label: "Grade 10 (Sophomore)" },
    { id: "grade-11", label: "Grade 11 (Junior)" }, { id: "grade-12", label: "Grade 12 (Senior)" },
    { id: "college-freshman", label: "College Freshman" }, { id: "college-sophomore", label: "College Sophomore" },
    { id: "college-junior", label: "College Junior" }, { id: "college-senior", label: "College Senior" },
    { id: "graduate-student", label: "Graduate Student" },
  ],
  GB: [
    { id: "year-7", label: "Year 7" }, { id: "year-8", label: "Year 8" }, { id: "year-9", label: "Year 9" },
    { id: "year-10", label: "Year 10" }, { id: "year-11", label: "Year 11" },
    { id: "year-12", label: "Year 12 (Lower 6th)" }, { id: "year-13", label: "Year 13 (Upper 6th)" },
    { id: "uni-year-1", label: "University Year 1" }, { id: "uni-year-2", label: "University Year 2" },
    { id: "uni-year-3", label: "University Year 3" }, { id: "uni-year-4", label: "University Year 4+" },
  ],
  NL: [
    { id: "klas-1", label: "Klas 1" }, { id: "klas-2", label: "Klas 2" }, { id: "klas-3", label: "Klas 3" },
    { id: "klas-4", label: "Klas 4" }, { id: "klas-5", label: "Klas 5" }, { id: "klas-6", label: "Klas 6" },
    { id: "mbo-1", label: "MBO Leerjaar 1" }, { id: "mbo-2", label: "MBO Leerjaar 2" },
    { id: "mbo-3", label: "MBO Leerjaar 3" }, { id: "mbo-4", label: "MBO Leerjaar 4" },
    { id: "hbo-wo-1", label: "HBO/WO Eerstejaars" }, { id: "hbo-wo-2", label: "HBO/WO Tweedejaars" },
    { id: "hbo-wo-3", label: "HBO/WO Derdejaars" }, { id: "hbo-wo-4", label: "HBO/WO Vierdejaars+" },
  ],
  DE: [
    { id: "klasse-5", label: "Klasse 5" }, { id: "klasse-6", label: "Klasse 6" },
    { id: "klasse-7", label: "Klasse 7" }, { id: "klasse-8", label: "Klasse 8" },
    { id: "klasse-9", label: "Klasse 9" }, { id: "klasse-10", label: "Klasse 10" },
    { id: "klasse-11", label: "Klasse 11" }, { id: "klasse-12", label: "Klasse 12" },
    { id: "klasse-13", label: "Klasse 13" },
    { id: "studium-1", label: "Studium Semester 1-2" }, { id: "studium-3", label: "Studium Semester 3-4" },
    { id: "studium-5", label: "Studium Semester 5+" },
  ],
  FR: [
    { id: "6eme", label: "6ème" }, { id: "5eme", label: "5ème" },
    { id: "4eme", label: "4ème" }, { id: "3eme", label: "3ème" },
    { id: "seconde", label: "Seconde" }, { id: "premiere", label: "Première" }, { id: "terminale", label: "Terminale" },
    { id: "l1", label: "Licence 1 (L1)" }, { id: "l2", label: "Licence 2 (L2)" }, { id: "l3", label: "Licence 3 (L3)" },
    { id: "m1", label: "Master 1 (M1)" }, { id: "m2", label: "Master 2 (M2)" },
  ],
  JP: [
    { id: "jh-1", label: "Junior High Year 1 (Chū 1)" }, { id: "jh-2", label: "Junior High Year 2 (Chū 2)" },
    { id: "jh-3", label: "Junior High Year 3 (Chū 3)" },
    { id: "hs-1", label: "High School Year 1 (Kō 1)" }, { id: "hs-2", label: "High School Year 2 (Kō 2)" },
    { id: "hs-3", label: "High School Year 3 (Kō 3)" },
    { id: "uni-1", label: "University Year 1" }, { id: "uni-2", label: "University Year 2" },
    { id: "uni-3", label: "University Year 3" }, { id: "uni-4", label: "University Year 4" },
  ],
};

export function getGradesForCountry(countryCode: string): Grade[] {
  return GRADES_BY_COUNTRY[countryCode] ?? DEFAULT_GRADES;
}

// Fallback for any country not explicitly listed
export function getTracksForCountry(countryCode: string): AcademicTrack[] {
  return TRACKS_BY_COUNTRY[countryCode] ?? DEFAULT_TRACKS;
}

// ─── Exam Boards ─────────────────────────────────────────────────────────────

export const EXAM_BOARDS_BY_TRACK: Record<string, ExamBoard[]> = {
  "a-levels": [
    { id: "aqa", shortCode: "AQA", label: "Assessment and Qualifications Alliance", description: "England's largest awarding body" },
    { id: "edexcel", shortCode: "Edexcel", label: "Pearson Edexcel", description: "Pearson's UK exam board" },
    { id: "ocr", shortCode: "OCR", label: "Oxford, Cambridge and RSA", description: "Cambridge-affiliated board" },
    { id: "wjec", shortCode: "WJEC", label: "Welsh Joint Education Committee", description: "Wales-based board, also offered in England" },
    { id: "ccea", shortCode: "CCEA", label: "Council for the Curriculum, Examinations and Assessment", description: "Northern Ireland's awarding body" },
    { id: "caie-al", shortCode: "Cambridge Int'l", label: "Cambridge International AS & A Levels", description: "International Cambridge curriculum" },
  ],
  "gcse": [
    { id: "aqa-gcse", shortCode: "AQA", label: "AQA GCSE", description: "Most popular GCSE awarding body" },
    { id: "edexcel-gcse", shortCode: "Edexcel", label: "Pearson Edexcel GCSE", description: "Pearson's GCSE board" },
    { id: "ocr-gcse", shortCode: "OCR", label: "OCR GCSE", description: "Oxford, Cambridge and RSA GCSE" },
    { id: "wjec-gcse", shortCode: "WJEC", label: "WJEC GCSE", description: "Welsh GCSE board" },
    { id: "ccea-gcse", shortCode: "CCEA", label: "CCEA GCSE", description: "Northern Ireland GCSE" },
    { id: "caie-igcse", shortCode: "Cambridge IGCSE", label: "Cambridge IGCSE", description: "International GCSE by Cambridge" },
  ],
  "ib": [
    { id: "ib-dp", shortCode: "IB DP", label: "IB Diploma Programme", description: "Full two-year diploma" },
    { id: "ib-cp", shortCode: "IB CP", label: "IB Career-related Programme", description: "Career-focused IB pathway" },
    { id: "ib-myp", shortCode: "IB MYP", label: "IB Middle Years Programme", description: "Ages 11–16" },
  ],
};

export function getExamBoardsForTrack(trackId: string): ExamBoard[] {
  return EXAM_BOARDS_BY_TRACK[trackId] ?? [];
}

export function requiresRegion(countryCode: string): boolean {
  return COUNTRIES_WITH_REGIONS.has(countryCode);
}

export function requiresExamBoard(trackId: string): boolean {
  return TRACKS_REQUIRING_EXAM_BOARD.has(trackId);
}
