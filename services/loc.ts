
export const generateLocCallNumber = (
  category: string,
  author: string,
  title: string,
  year: string
): string => {
  // 1. Determine Class Number based on Category
  // We use a comprehensive local mapping of keywords to LCC Classes
  let classNum = "Z"; // Default class (General/Bibliography)
  const catUpper = category.toUpperCase().trim();
  
  const mapping: Record<string, string> = {
    // A - General Works
    "GENERAL": "AE1",
    "ENCYCLOPEDIA": "AE5",
    "DICTIONARY": "AG5",
    "MUSEUM": "AM1",
    "NEWSPAPER": "AN",

    // B - Philosophy, Psychology, Religion
    "PHILOSOPHY": "B1",
    "LOGIC": "BC1",
    "METAPHYSICS": "BD10",
    "PSYCHOLOGY": "BF1",
    "AESTHETICS": "BH1",
    "ETHICS": "BJ1",
    "RELIGION": "BL1",
    "MYTHOLOGY": "BL300",
    "JUDAISM": "BM1",
    "ISLAM": "BP1",
    "BUDDHISM": "BQ1",
    "CHRISTIANITY": "BR1",
    "BIBLE": "BS1",
    "THEOLOGY": "BT1",

    // C - Auxiliary Sciences of History
    "ARCHAEOLOGY": "CC1",
    "HISTORY AUX": "C1",
    "GENEALOGY": "CS1",
    "BIOGRAPHY": "CT21",

    // D - World History
    "HISTORY": "D1",
    "WORLD HISTORY": "D20",
    "ANCIENT": "D51",
    "MEDIEVAL": "D111",
    "MODERN HISTORY": "D201",
    "WORLD WAR": "D501",
    "EUROPE": "D901",
    "ENGLAND": "DA1",
    "UK": "DA1",
    "FRANCE": "DC1",
    "GERMANY": "DD1",
    "ASIA": "DS1",
    "CHINA": "DS701",
    "JAPAN": "DS801",
    "INDIA": "DS401",
    "AFRICA": "DT1",

    // E & F - History of the Americas
    "AMERICA": "E11",
    "UNITED STATES": "E151",
    "US HISTORY": "E171",
    "CIVIL WAR": "E456",
    "CANADA": "F1001",
    "MEXICO": "F1201",
    "LATIN AMERICA": "F1401",
    "SOUTH AMERICA": "F2201",

    // G - Geography, Anthropology, Recreation
    "GEOGRAPHY": "G1",
    "MAPS": "G1001",
    "ATLAS": "G1001",
    "OCEANOGRAPHY": "GC1",
    "ANTHROPOLOGY": "GN1",
    "FOLKLORE": "GR1",
    "CULTURE": "GT1",
    "SPORTS": "GV557",
    "RECREATION": "GV1",
    "DANCE": "GV1580",

    // H - Social Sciences
    "SOCIAL SCIENCE": "H1",
    "STATISTICS": "HA1",
    "ECONOMICS": "HB1",
    "MICROECONOMICS": "HB172",
    "MACROECONOMICS": "HB172.5",
    "COMMERCE": "HF1",
    "BUSINESS": "HF5001",
    "MANAGEMENT": "HD30",
    "MARKETING": "HF5410",
    "ACCOUNTING": "HF5601",
    "FINANCE": "HG1",
    "MONEY": "HG201",
    "INVESTMENT": "HG4501",
    "SOCIOLOGY": "HM1",
    "COMMUNITY": "HM756",
    "FAMILY": "HQ1",
    "WOMEN": "HQ1101",
    "CRIMINOLOGY": "HV6001",
    "SOCIAL WORK": "HV1",

    // J - Political Science
    "POLITICAL SCIENCE": "JA1",
    "POLITICS": "JA1",
    "GOVERNMENT": "JF1",
    "INTERNATIONAL RELATIONS": "JZ1",
    "DIPLOMACY": "JZ1305",

    // K - Law
    "LAW": "K1",
    "INTERNATIONAL LAW": "KZ1",
    
    // L - Education
    "EDUCATION": "L1",
    "SCHOOL": "LB1",
    "TEACHING": "LB1025",
    "HIGHER EDUCATION": "LB2300",
    
    // M - Music
    "MUSIC": "M1",
    "INSTRUMENT": "M500",
    "VOCAL": "M1495",
    
    // N - Fine Arts
    "ART": "N1",
    "VISUAL ARTS": "N1",
    "ARCHITECTURE": "NA1",
    "SCULPTURE": "NB1",
    "DRAWING": "NC1",
    "PAINTING": "ND1",
    "PRINT": "NE1",
    "DESIGN": "NK1",
    
    // P - Language and Literature
    "LANGUAGE": "P1",
    "LINGUISTICS": "P1",
    "COMMUNICATION": "P87",
    "LITERATURE": "PN1",
    "DRAMA": "PN1601",
    "THEATER": "PN2000",
    "JOURNALISM": "PN4699",
    "POETRY": "PN1010",
    "FICTION": "PN3311",
    "FANTASY": "PZ7", // Juvenile fiction often classified PZ
    "SCI-FI": "PS3550", // Often placed in American Lit (PS) or General Lit
    "SCIENCE FICTION": "PS3550",
    "HORROR": "PS374",
    "NOVEL": "PN3311",
    "SATIRE": "PN6149",
    "ENGLISH": "PE1",
    "CLASSIC": "PA3001",
    "ROMANCE": "PN6071",
    "AMERICAN LIT": "PS1",
    "ENGLISH LIT": "PR1",
    
    // Q - Science
    "SCIENCE": "Q1",
    "MATH": "QA1",
    "MATHEMATICS": "QA1",
    "ALGEBRA": "QA150",
    "ANALYSIS": "QA300",
    "COMPUTER": "QA76",
    "SOFTWARE": "QA76.76",
    "PROGRAMMING": "QA76.6",
    "ALGORITHM": "QA76.9",
    "AI": "QA76.9",
    "ARTIFICIAL INTELLIGENCE": "Q335",
    "ASTRONOMY": "QB1",
    "PHYSICS": "QC1",
    "MECHANICS": "QC120",
    "ELECTRICITY": "QC501",
    "CHEMISTRY": "QD1",
    "GEOLOGY": "QE1",
    "BIOLOGY": "QH301",
    "GENETICS": "QH426",
    "BOTANY": "QK1",
    "ZOOLOGY": "QL1",
    "ANATOMY": "QM1",
    "PHYSIOLOGY": "QP1",
    "MICROBIOLOGY": "QR1",

    // R - Medicine
    "MEDICINE": "R1",
    "PUBLIC HEALTH": "RA1",
    "PATHOLOGY": "RB1",
    "INTERNAL MEDICINE": "RC31",
    "PSYCHIATRY": "RC435",
    "SURGERY": "RD1",
    "OPHTHALMOLOGY": "RE1",
    "NURSING": "RT1",
    "PHARMACY": "RS1",

    // S - Agriculture
    "AGRICULTURE": "S1",
    "FORESTRY": "SD1",
    "FARMING": "S560",
    "GARDENING": "SB450",
    "ANIMAL": "SF1",
    "VETERINARY": "SF601",
    "AQUACULTURE": "SH1",

    // T - Technology
    "TECHNOLOGY": "T1",
    "ENGINEERING": "TA1",
    "CIVIL": "TA1",
    "HYDRAULIC": "TC1",
    "ENVIRONMENTAL": "TD1",
    "BUILDING": "TH1",
    "MECHANICAL": "TJ1",
    "ELECTRICAL": "TK1",
    "ELECTRONICS": "TK7800",
    "TELECOMMUNICATION": "TK5101",
    "INTERNET": "TK5105",
    "WEB": "TK5105",
    "MOTOR": "TL1",
    "AERONAUTICS": "TL500",
    "SPACE": "TL787",
    "MINING": "TN1",
    "CHEMICAL": "TP1",
    "PHOTOGRAPHY": "TR1",
    "MANUFACTURING": "TS1",
    "METAL": "TS200",
    "TEXTILE": "TS1300",
    "HANDICRAFT": "TT1",
    "COOKING": "TX651",
    "COOKBOOK": "TX651",
    "HOME ECONOMICS": "TX1",
    "NUTRITION": "TX341",

    // U - Military Science
    "MILITARY": "U1",
    "STRATEGY": "U162",
    "ARMY": "UA1",
    
    // V - Naval Science
    "NAVAL": "V1",
    "NAVY": "VA1",
    "NAVIGATION": "VK1",
    "SHIP": "VM1",

    // Z - Bibliography, Library Science
    "BIBLIOGRAPHY": "Z1001",
    "LIBRARY": "Z665",
    "INFORMATION SCIENCE": "Z665",
  };

  // Logic to find best match
  let found = false;
  
  // 1. Direct Lookup
  if (mapping[catUpper]) {
      classNum = mapping[catUpper];
      found = true;
  }

  // 2. Contains Keyword Lookup (e.g., "Software Engineering" contains "SOFTWARE")
  if (!found) {
      // Sort keys by length desc to match longest specific keyword first
      const keys = Object.keys(mapping).sort((a, b) => b.length - a.length);
      
      for (const key of keys) {
          // Check if category contains the keyword (as a whole word ideally, but includes is decent)
          if (catUpper.includes(key)) {
              classNum = mapping[key];
              found = true;
              break; 
          }
      }
  }
  
  // 3. Fallback: Generate pseudo-class if no match found
  if (!found && catUpper.length >= 2) {
      // Use first 1-2 letters of category + deterministic number based on title length
      // This ensures we at least get a valid-looking format like "SO15" for "Something"
      const prefix = catUpper.substring(0, 2).replace(/[^A-Z]/g, 'X');
      classNum = prefix + (100 + (title.length % 900)).toString();
  }

  // 2. Determine Cutter Number based on Author
  // Format: .[First Initial][Number calculated from name]
  const surname = author.split(" ").pop() || author;
  const initial = surname.charAt(0).toUpperCase().replace(/[^A-Z]/, 'A');
  
  // Simple hash for the second part of cutter to make it look realistic and deterministic
  let hash = 0;
  for (let i = 0; i < surname.length; i++) {
    hash = surname.charCodeAt(i) + ((hash << 5) - hash);
  }
  // Ensure 3 digits roughly
  const cutterNum = Math.abs(hash % 899) + 100; 
  const cutter = `.${initial}${cutterNum}`;

  // 3. Assemble Final Call Number
  return `${classNum} ${cutter} ${year}`;
};
