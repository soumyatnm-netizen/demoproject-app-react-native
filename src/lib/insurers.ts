// Insurer logo mapping
import zurichLogo from "@/assets/insurers/zurich-logo.png";
import axaLogo from "@/assets/insurers/axa-logo.png";
import chubbLogo from "@/assets/insurers/chubb-logo.png";

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
    logo: "", // Placeholder - add when available
    altText: "Allianz Commercial logo"
  },
  "Hiscox Insurance": {
    name: "Hiscox Insurance", 
    logo: "", // Placeholder - add when available
    altText: "Hiscox Insurance logo"
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
    return insurerMapping["AXA Insurance"];
  }
  if (lowerName.includes('chubb')) {
    return insurerMapping["Chubb Insurance"];
  }
  if (lowerName.includes('allianz')) {
    return insurerMapping["Allianz Commercial"];
  }
  if (lowerName.includes('hiscox')) {
    return insurerMapping["Hiscox Insurance"];
  }

  // Default fallback
  return {
    name: insurerName,
    logo: "",
    altText: `${insurerName} logo`
  };
};