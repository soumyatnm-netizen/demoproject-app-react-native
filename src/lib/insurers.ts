// Insurer logo mapping
import zurichLogo from "@/assets/insurers/zurich-logo.png";
import axaLogo from "@/assets/insurers/axa-logo.png";
import chubbLogo from "@/assets/insurers/chubb-logo.png";
import rsaLogo from "@/assets/insurers/rsa-logo.png";
import allianzLogo from "@/assets/insurers/allianz-logo.png";

// Placeholder function to generate logo URL from insurer name
const generateLogoPlaceholder = (name: string) => {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&size=200&background=1e40af&color=fff&bold=true`;
};

export interface InsurerInfo {
  name: string;
  logo: string;
  altText: string;
}

// Map insurer names to their logos and info
export const insurerMapping: Record<string, InsurerInfo> = {
  "Zurich Insurance": {
    name: "Zurich Insurance",
    logo: zurichLogo,
    altText: "Zurich Insurance logo"
  },
  "Zurich Commercial": {
    name: "Zurich Commercial", 
    logo: zurichLogo,
    altText: "Zurich Commercial logo"
  },
  "AXA Insurance": {
    name: "AXA Insurance",
    logo: axaLogo,
    altText: "AXA Insurance logo"
  },
  "AXA Insurance UK": {
    name: "AXA Insurance UK",
    logo: axaLogo,
    altText: "AXA Insurance UK logo"
  },
  "AXA Commercial": {
    name: "AXA Commercial",
    logo: axaLogo,
    altText: "AXA Commercial logo"
  },
  "Chubb Insurance": {
    name: "Chubb Insurance",
    logo: chubbLogo,
    altText: "Chubb Insurance logo"
  },
  "Chubb Commercial": {
    name: "Chubb Commercial",
    logo: chubbLogo,
    altText: "Chubb Commercial logo"
  },
  "Allianz Commercial": {
    name: "Allianz Commercial",
    logo: allianzLogo,
    altText: "Allianz Commercial logo"
  },
  "RSA Insurance Group": {
    name: "RSA Insurance Group",
    logo: rsaLogo,
    altText: "RSA Insurance Group logo"
  },
  "Hiscox Insurance": {
    name: "Hiscox Insurance", 
    logo: generateLogoPlaceholder("Hiscox"),
    altText: "Hiscox Insurance logo"
  },
  "Hiscox": {
    name: "Hiscox",
    logo: generateLogoPlaceholder("Hiscox"),
    altText: "Hiscox logo"
  },
  "CFC Underwriting": {
    name: "CFC Underwriting",
    logo: generateLogoPlaceholder("CFC"),
    altText: "CFC Underwriting logo"
  },
  "CFC": {
    name: "CFC",
    logo: generateLogoPlaceholder("CFC"),
    altText: "CFC logo"
  },
  "Aviva": {
    name: "Aviva",
    logo: generateLogoPlaceholder("Aviva"),
    altText: "Aviva logo"
  },
  "Aviva Insurance": {
    name: "Aviva Insurance",
    logo: generateLogoPlaceholder("Aviva"),
    altText: "Aviva Insurance logo"
  },
  "Aviva Commercial": {
    name: "Aviva Commercial",
    logo: generateLogoPlaceholder("Aviva"),
    altText: "Aviva Commercial logo"
  },
  "QBE": {
    name: "QBE",
    logo: generateLogoPlaceholder("QBE"),
    altText: "QBE logo"
  },
  "QBE Insurance": {
    name: "QBE Insurance",
    logo: generateLogoPlaceholder("QBE"),
    altText: "QBE Insurance logo"
  },
  "Markel": {
    name: "Markel",
    logo: generateLogoPlaceholder("Markel"),
    altText: "Markel logo"
  },
  "Markel International": {
    name: "Markel International",
    logo: generateLogoPlaceholder("Markel"),
    altText: "Markel International logo"
  },
  "Liberty Mutual": {
    name: "Liberty Mutual",
    logo: generateLogoPlaceholder("Liberty"),
    altText: "Liberty Mutual logo"
  },
  "Beazley": {
    name: "Beazley",
    logo: generateLogoPlaceholder("Beazley"),
    altText: "Beazley logo"
  },
  "Travelers": {
    name: "Travelers",
    logo: generateLogoPlaceholder("Travelers"),
    altText: "Travelers logo"
  },
  "Axis": {
    name: "Axis",
    logo: generateLogoPlaceholder("Axis"),
    altText: "Axis logo"
  },
  "Hartford": {
    name: "Hartford",
    logo: generateLogoPlaceholder("Hartford"),
    altText: "Hartford logo"
  },
  "Ecclesiastical": {
    name: "Ecclesiastical",
    logo: generateLogoPlaceholder("Ecclesiastical"),
    altText: "Ecclesiastical logo"
  }
};

/**
 * Get insurer information by name with fuzzy matching
 */
export const getInsurerInfo = (insurerName: string): InsurerInfo => {
  // Direct match first
  if (insurerMapping[insurerName]) {
    return insurerMapping[insurerName];
  }

  // Fuzzy matching for common variations
  const lowerName = insurerName.toLowerCase();
  
  if (lowerName.includes('zurich')) {
    return insurerMapping["Zurich Insurance"];
  }
  if (lowerName.includes('axa')) {
    return insurerMapping["AXA Insurance UK"];
  }
  if (lowerName.includes('chubb')) {
    return insurerMapping["Chubb Insurance"];
  }
  if (lowerName.includes('allianz')) {
    return insurerMapping["Allianz Commercial"];
  }
  if (lowerName.includes('hiscox')) {
    return insurerMapping["Hiscox"];
  }
  if (lowerName.includes('rsa')) {
    return insurerMapping["RSA Insurance Group"];
  }
  if (lowerName.includes('cfc')) {
    return insurerMapping["CFC"];
  }
  if (lowerName.includes('aviva')) {
    return insurerMapping["Aviva"];
  }
  if (lowerName.includes('qbe')) {
    return insurerMapping["QBE"];
  }
  if (lowerName.includes('markel')) {
    return insurerMapping["Markel"];
  }
  if (lowerName.includes('liberty')) {
    return insurerMapping["Liberty Mutual"];
  }
  if (lowerName.includes('beazley')) {
    return insurerMapping["Beazley"];
  }
  if (lowerName.includes('travelers')) {
    return insurerMapping["Travelers"];
  }
  if (lowerName.includes('axis')) {
    return insurerMapping["Axis"];
  }
  if (lowerName.includes('hartford')) {
    return insurerMapping["Hartford"];
  }
  if (lowerName.includes('ecclesiastical')) {
    return insurerMapping["Ecclesiastical"];
  }

  // Default fallback - generate placeholder logo
  return {
    name: insurerName,
    logo: generateLogoPlaceholder(insurerName),
    altText: `${insurerName} logo`
  };
};