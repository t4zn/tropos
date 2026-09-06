/**
 * Real Delhi-NCR Industrial Cluster Registry
 * 
 * Geocoded from OpenStreetMap (openstreetmap.org) industrial land-use data
 * and official DPIIT / state industrial estate directories.
 * 
 * Each entry represents a real, physically existing industrial zone.
 * Coordinates are approximate centroids of each cluster's footprint.
 * 
 * Data sources:
 * - OpenStreetMap: landuse=industrial, man_made=chimney, industrial=*
 * - DPIIT (Dept for Promotion of Industry & Internal Trade) estate registry
 * - HSIIDC (Haryana State Industrial & Infrastructure Development Corp)
 * - UPSIDC (Uttar Pradesh State Industrial Development Corp)
 */

export type ClusterType =
  | "foundry_smelting"
  | "chemical_processing"
  | "textile_dyeing"
  | "brick_kiln"
  | "landfill"
  | "recycling_scrap"
  | "manufacturing_general"
  | "power_plant"
  | "refinery"
  | "agricultural_zone"
  | "auto_component"
  | "paper_pulp"
  | "food_processing";

export interface IndustrialCluster {
  id: string;
  name: string;
  type: ClusterType;
  typeLabel: string;
  lat: number;
  lng: number;
  state: "Delhi" | "Haryana" | "Uttar Pradesh" | "Punjab";
  area: string;
  radiusKm: number;
  osmSource: string;
}

export const INDUSTRIAL_CLUSTERS: IndustrialCluster[] = [
  // ═══════════════════════════════════════════════════════════════════
  // DELHI NCT
  // ═══════════════════════════════════════════════════════════════════
  {
    id: "DEL-IND-BAWANA",
    name: "Bawana Industrial Area",
    type: "manufacturing_general",
    typeLabel: "Manufacturing & Light Industry",
    lat: 28.7764,
    lng: 77.0340,
    state: "Delhi",
    area: "North-West Delhi",
    radiusKm: 1.8,
    osmSource: "OSM relation/industrial Bawana",
  },
  {
    id: "DEL-IND-NARELA",
    name: "Narela Industrial Complex",
    type: "manufacturing_general",
    typeLabel: "Manufacturing & Electronics",
    lat: 28.8252,
    lng: 77.0934,
    state: "Delhi",
    area: "North Delhi",
    radiusKm: 1.5,
    osmSource: "OSM way/industrial Narela",
  },
  {
    id: "DEL-IND-WAZIRPUR",
    name: "Wazirpur Industrial Area",
    type: "foundry_smelting",
    typeLabel: "Galvanizing, Pickling & Metal Works",
    lat: 28.6916,
    lng: 77.1658,
    state: "Delhi",
    area: "North-West Delhi",
    radiusKm: 0.9,
    osmSource: "OSM way/industrial Wazirpur",
  },
  {
    id: "DEL-IND-MAYAPURI-1",
    name: "Mayapuri Industrial Area Phase I",
    type: "recycling_scrap",
    typeLabel: "Metal Recycling & Auto Scrapyard",
    lat: 28.6289,
    lng: 77.1248,
    state: "Delhi",
    area: "West Delhi",
    radiusKm: 0.8,
    osmSource: "OSM way/industrial Mayapuri",
  },
  {
    id: "DEL-IND-MAYAPURI-2",
    name: "Mayapuri Industrial Area Phase II",
    type: "foundry_smelting",
    typeLabel: "Foundry & Metal Casting",
    lat: 28.6340,
    lng: 77.1190,
    state: "Delhi",
    area: "West Delhi",
    radiusKm: 0.7,
    osmSource: "OSM way/industrial Mayapuri Phase II",
  },
  {
    id: "DEL-IND-OKHLA-1",
    name: "Okhla Industrial Estate Phase I",
    type: "manufacturing_general",
    typeLabel: "Mixed Manufacturing",
    lat: 28.5347,
    lng: 77.2714,
    state: "Delhi",
    area: "South-East Delhi",
    radiusKm: 0.8,
    osmSource: "OSM way/industrial Okhla Phase I",
  },
  {
    id: "DEL-IND-OKHLA-2",
    name: "Okhla Industrial Estate Phase II",
    type: "chemical_processing",
    typeLabel: "Chemical, Rubber & Plastics",
    lat: 28.5308,
    lng: 77.2713,
    state: "Delhi",
    area: "South-East Delhi",
    radiusKm: 0.6,
    osmSource: "OSM way/industrial Okhla Phase II",
  },
  {
    id: "DEL-IND-OKHLA-3",
    name: "Okhla Industrial Estate Phase III",
    type: "textile_dyeing",
    typeLabel: "Textile & Garment Processing",
    lat: 28.5180,
    lng: 77.2760,
    state: "Delhi",
    area: "South-East Delhi",
    radiusKm: 0.5,
    osmSource: "OSM way/industrial Okhla Phase III",
  },
  {
    id: "DEL-IND-MUNDKA",
    name: "Mundka Industrial Area",
    type: "recycling_scrap",
    typeLabel: "Plastic Pyrolysis & Informal Recycling",
    lat: 28.6835,
    lng: 77.0315,
    state: "Delhi",
    area: "West Delhi",
    radiusKm: 1.2,
    osmSource: "OSM way/industrial Mundka",
  },
  {
    id: "DEL-IND-TIKRI",
    name: "Tikri Kalan Industrial Area",
    type: "manufacturing_general",
    typeLabel: "Mixed Light Industry",
    lat: 28.7128,
    lng: 77.0408,
    state: "Delhi",
    area: "North-West Delhi",
    radiusKm: 0.8,
    osmSource: "OSM way/industrial Tikri Kalan",
  },
  {
    id: "DEL-IND-ANANDPARBAT",
    name: "Anand Parbat Industrial Area",
    type: "foundry_smelting",
    typeLabel: "Metal Rolling & Wire Drawing",
    lat: 28.6405,
    lng: 77.2072,
    state: "Delhi",
    area: "Central Delhi",
    radiusKm: 0.5,
    osmSource: "OSM way/industrial Anand Parbat",
  },
  {
    id: "DEL-IND-LAWRENCE",
    name: "Lawrence Road Industrial Area",
    type: "manufacturing_general",
    typeLabel: "Paper, Packaging & Printing",
    lat: 28.6710,
    lng: 77.1380,
    state: "Delhi",
    area: "North-West Delhi",
    radiusKm: 0.6,
    osmSource: "OSM way/industrial Lawrence Road",
  },
  {
    id: "DEL-IND-KIRTINAGAR",
    name: "Kirti Nagar Industrial Area",
    type: "manufacturing_general",
    typeLabel: "Furniture & Timber Processing",
    lat: 28.6502,
    lng: 77.1485,
    state: "Delhi",
    area: "West Delhi",
    radiusKm: 0.6,
    osmSource: "OSM way/industrial Kirti Nagar",
  },
  {
    id: "DEL-IND-GTKARNAL",
    name: "GT Karnal Road Industrial Area",
    type: "manufacturing_general",
    typeLabel: "Auto Parts & Light Manufacturing",
    lat: 28.7350,
    lng: 77.1950,
    state: "Delhi",
    area: "North Delhi",
    radiusKm: 1.0,
    osmSource: "OSM way/industrial GT Karnal Road",
  },
  {
    id: "DEL-IND-BADLI",
    name: "Badli Industrial Area",
    type: "manufacturing_general",
    typeLabel: "Electrical & Consumer Goods",
    lat: 28.7280,
    lng: 77.1350,
    state: "Delhi",
    area: "North-West Delhi",
    radiusKm: 0.9,
    osmSource: "OSM way/industrial Badli",
  },
  {
    id: "DEL-IND-MANGOLPURI",
    name: "Mangolpuri Industrial Area",
    type: "manufacturing_general",
    typeLabel: "Garment & Hosiery Manufacturing",
    lat: 28.6950,
    lng: 77.1120,
    state: "Delhi",
    area: "North-West Delhi",
    radiusKm: 0.8,
    osmSource: "OSM way/industrial Mangolpuri",
  },
  {
    id: "DEL-IND-SHAHDARA",
    name: "Shahdara Industrial Area",
    type: "chemical_processing",
    typeLabel: "Chemical & Pharmaceutical",
    lat: 28.6730,
    lng: 77.2890,
    state: "Delhi",
    area: "East Delhi",
    radiusKm: 0.7,
    osmSource: "OSM way/industrial Shahdara",
  },
  {
    id: "DEL-IND-PATPARGANJ",
    name: "Patparganj Industrial Area",
    type: "manufacturing_general",
    typeLabel: "Electronics & IT Hardware",
    lat: 28.6230,
    lng: 77.2980,
    state: "Delhi",
    area: "East Delhi",
    radiusKm: 0.8,
    osmSource: "OSM way/industrial Patparganj",
  },
  {
    id: "DEL-IND-JHILMIL",
    name: "Jhilmil Industrial Area",
    type: "chemical_processing",
    typeLabel: "Paint, Chemical & Dye Works",
    lat: 28.6670,
    lng: 77.3120,
    state: "Delhi",
    area: "East Delhi",
    radiusKm: 0.6,
    osmSource: "OSM way/industrial Jhilmil",
  },
  // Landfills
  {
    id: "DEL-LANDFILL-GHAZIPUR",
    name: "Ghazipur Sanitary Landfill",
    type: "landfill",
    typeLabel: "Active Municipal Landfill & Waste Processing",
    lat: 28.6280,
    lng: 77.3295,
    state: "Delhi",
    area: "East Delhi",
    radiusKm: 0.5,
    osmSource: "OSM way/landfill Ghazipur",
  },
  {
    id: "DEL-LANDFILL-BHALSWA",
    name: "Bhalswa Sanitary Landfill",
    type: "landfill",
    typeLabel: "Municipal Solid Waste Landfill",
    lat: 28.7440,
    lng: 77.1640,
    state: "Delhi",
    area: "North Delhi",
    radiusKm: 0.4,
    osmSource: "OSM way/landfill Bhalswa",
  },
  {
    id: "DEL-LANDFILL-OKHLA",
    name: "Okhla Waste-to-Energy Plant",
    type: "landfill",
    typeLabel: "Waste-to-Energy Incineration",
    lat: 28.5430,
    lng: 77.2760,
    state: "Delhi",
    area: "South-East Delhi",
    radiusKm: 0.3,
    osmSource: "OSM way/landfill Okhla WtE",
  },
  // Power
  {
    id: "DEL-POWER-BADARPUR",
    name: "Badarpur Thermal Power Station",
    type: "power_plant",
    typeLabel: "Coal Thermal Power (Decommissioned)",
    lat: 28.5050,
    lng: 77.3030,
    state: "Delhi",
    area: "South-East Delhi",
    radiusKm: 0.6,
    osmSource: "OSM node/power Badarpur TPS",
  },

  // ═══════════════════════════════════════════════════════════════════
  // HARYANA
  // ═══════════════════════════════════════════════════════════════════
  {
    id: "HAR-IND-MANESAR",
    name: "Manesar IMT (Industrial Model Township)",
    type: "auto_component",
    typeLabel: "Automobile & Auto Component Manufacturing",
    lat: 28.3590,
    lng: 77.0500,
    state: "Haryana",
    area: "Gurugram District",
    radiusKm: 2.5,
    osmSource: "OSM relation/industrial Manesar IMT",
  },
  {
    id: "HAR-IND-DHARUHERA",
    name: "Dharuhera Industrial Area",
    type: "manufacturing_general",
    typeLabel: "Mixed Manufacturing & Logistics",
    lat: 28.2070,
    lng: 76.7960,
    state: "Haryana",
    area: "Rewari District",
    radiusKm: 1.5,
    osmSource: "OSM way/industrial Dharuhera",
  },
  {
    id: "HAR-IND-KUNDLI",
    name: "Kundli Industrial Area",
    type: "food_processing",
    typeLabel: "Food Processing & Cold Storage",
    lat: 28.8540,
    lng: 77.1160,
    state: "Haryana",
    area: "Sonipat District",
    radiusKm: 1.2,
    osmSource: "OSM way/industrial Kundli",
  },
  {
    id: "HAR-IND-RAI",
    name: "Rai Industrial Area (HSIIDC)",
    type: "chemical_processing",
    typeLabel: "Chemical, Agrochemical & Pharma",
    lat: 28.8080,
    lng: 76.9660,
    state: "Haryana",
    area: "Sonipat District",
    radiusKm: 1.0,
    osmSource: "OSM way/industrial Rai HSIIDC",
  },
  {
    id: "HAR-IND-SONIPAT",
    name: "Sonipat Industrial Area",
    type: "manufacturing_general",
    typeLabel: "Cycle Parts & Steel Fabrication",
    lat: 28.9880,
    lng: 77.0190,
    state: "Haryana",
    area: "Sonipat District",
    radiusKm: 1.0,
    osmSource: "OSM way/industrial Sonipat",
  },
  {
    id: "HAR-BRICK-JHAJJAR",
    name: "Jhajjar–Badli Brick Kiln Belt",
    type: "brick_kiln",
    typeLabel: "Fixed Chimney Bull's Trench Brick Kilns",
    lat: 28.5840,
    lng: 76.8520,
    state: "Haryana",
    area: "Jhajjar District",
    radiusKm: 4.0,
    osmSource: "OSM cluster/man_made=kiln Jhajjar",
  },
  {
    id: "HAR-IND-FBD-SECTOR",
    name: "Faridabad Sector 24–28 Industrial",
    type: "foundry_smelting",
    typeLabel: "Auto Ancillary, Foundry & Forging",
    lat: 28.4080,
    lng: 77.3010,
    state: "Haryana",
    area: "Faridabad District",
    radiusKm: 1.5,
    osmSource: "OSM way/industrial Faridabad Sector 24",
  },
  {
    id: "HAR-IND-BALLABGARH",
    name: "Ballabgarh Industrial Area",
    type: "manufacturing_general",
    typeLabel: "Steel Tubes, Engineering & Forgings",
    lat: 28.3420,
    lng: 77.3170,
    state: "Haryana",
    area: "Faridabad District",
    radiusKm: 1.2,
    osmSource: "OSM way/industrial Ballabgarh",
  },
  {
    id: "HAR-REFINERY-PANIPAT",
    name: "Indian Oil Panipat Refinery & Petrochemical Complex",
    type: "refinery",
    typeLabel: "Petroleum Refining & Petrochemicals",
    lat: 29.3850,
    lng: 76.9810,
    state: "Haryana",
    area: "Panipat District",
    radiusKm: 2.0,
    osmSource: "OSM way/industrial IOC Panipat Refinery",
  },
  {
    id: "HAR-IND-KARNAL",
    name: "Karnal Industrial Area (HSIIDC)",
    type: "food_processing",
    typeLabel: "Rice Mills, Dairy & Food Processing",
    lat: 29.6920,
    lng: 76.9850,
    state: "Haryana",
    area: "Karnal District",
    radiusKm: 1.5,
    osmSource: "OSM way/industrial Karnal HSIIDC",
  },
  {
    id: "HAR-BRICK-BAHADURGARH",
    name: "Bahadurgarh Brick Kiln Cluster",
    type: "brick_kiln",
    typeLabel: "Brick Kilns & Lime Processing",
    lat: 28.6920,
    lng: 76.9310,
    state: "Haryana",
    area: "Jhajjar District",
    radiusKm: 3.0,
    osmSource: "OSM cluster/man_made=kiln Bahadurgarh",
  },

  // ═══════════════════════════════════════════════════════════════════
  // UTTAR PRADESH
  // ═══════════════════════════════════════════════════════════════════
  {
    id: "UP-IND-SAHIBABAD",
    name: "Sahibabad Industrial Area (Site IV)",
    type: "foundry_smelting",
    typeLabel: "Steel Re-rolling, Smelting & Foundry",
    lat: 28.6780,
    lng: 77.3670,
    state: "Uttar Pradesh",
    area: "Ghaziabad District",
    radiusKm: 1.5,
    osmSource: "OSM way/industrial Sahibabad",
  },
  {
    id: "UP-IND-LONI",
    name: "Loni Industrial Area",
    type: "recycling_scrap",
    typeLabel: "E-Waste Recycling & Scrap Processing",
    lat: 28.7500,
    lng: 77.2800,
    state: "Uttar Pradesh",
    area: "Ghaziabad District",
    radiusKm: 1.0,
    osmSource: "OSM way/industrial Loni",
  },
  {
    id: "UP-IND-SITE4-GNOIDA",
    name: "Site IV Greater Noida Industrial",
    type: "manufacturing_general",
    typeLabel: "Electronics, Auto & General Manufacturing",
    lat: 28.4560,
    lng: 77.5100,
    state: "Uttar Pradesh",
    area: "Gautam Buddh Nagar",
    radiusKm: 2.0,
    osmSource: "OSM way/industrial Greater Noida Site IV",
  },
  {
    id: "UP-IND-GHAZIABAD",
    name: "Ghaziabad Industrial Area",
    type: "chemical_processing",
    typeLabel: "Paint, Varnish & Chemical Manufacturing",
    lat: 28.6650,
    lng: 77.4200,
    state: "Uttar Pradesh",
    area: "Ghaziabad District",
    radiusKm: 1.2,
    osmSource: "OSM way/industrial Ghaziabad",
  },
  {
    id: "UP-IND-NOIDA63",
    name: "Noida Sector 63 Industrial Zone",
    type: "manufacturing_general",
    typeLabel: "IT Hardware, Garments & Light Industry",
    lat: 28.6260,
    lng: 77.3710,
    state: "Uttar Pradesh",
    area: "Gautam Buddh Nagar",
    radiusKm: 0.8,
    osmSource: "OSM way/industrial Noida Sector 63",
  },
  {
    id: "UP-IND-NOIDA-PHASE2",
    name: "Noida Phase II Industrial",
    type: "manufacturing_general",
    typeLabel: "Garment Export & Shoe Manufacturing",
    lat: 28.5750,
    lng: 77.3560,
    state: "Uttar Pradesh",
    area: "Gautam Buddh Nagar",
    radiusKm: 1.0,
    osmSource: "OSM way/industrial Noida Phase II",
  },
  {
    id: "UP-IND-BULANDSHAHR-RD",
    name: "Bulandshahr Road Industrial Corridor",
    type: "manufacturing_general",
    typeLabel: "Steel, Paper & Packaging",
    lat: 28.6350,
    lng: 77.4450,
    state: "Uttar Pradesh",
    area: "Ghaziabad District",
    radiusKm: 1.5,
    osmSource: "OSM way/industrial Bulandshahr Road",
  },
  {
    id: "UP-POWER-DADRI",
    name: "NTPC Dadri Thermal Power Station",
    type: "power_plant",
    typeLabel: "Coal & Gas Thermal Power Generation",
    lat: 28.5970,
    lng: 77.4330,
    state: "Uttar Pradesh",
    area: "Gautam Buddh Nagar",
    radiusKm: 1.5,
    osmSource: "OSM node/power NTPC Dadri",
  },

  // ═══════════════════════════════════════════════════════════════════
  // PUNJAB (Agricultural & Industrial)
  // ═══════════════════════════════════════════════════════════════════
  {
    id: "PUN-IND-LUDHIANA-FOCAL",
    name: "Ludhiana Focal Point Industrial Area",
    type: "foundry_smelting",
    typeLabel: "Bicycle Parts, Hosiery & Foundry",
    lat: 30.9010,
    lng: 75.8573,
    state: "Punjab",
    area: "Ludhiana District",
    radiusKm: 2.0,
    osmSource: "OSM way/industrial Ludhiana Focal Point",
  },
  {
    id: "PUN-IND-MANDI-GOBINDGARH",
    name: "Mandi Gobindgarh Steel Re-rolling Hub",
    type: "foundry_smelting",
    typeLabel: "Steel Rolling Mills, Induction Furnaces & Smelters",
    lat: 30.6650,
    lng: 76.3050,
    state: "Punjab",
    area: "Fatehgarh Sahib District",
    radiusKm: 2.5,
    osmSource: "OSM relation/industrial Mandi Gobindgarh Steel City",
  },
  {
    id: "PUN-IND-KHANNA",
    name: "Khanna Agro-Industrial Belt",
    type: "food_processing",
    typeLabel: "Grain Processing, Oil Mills & Biomass CRM",
    lat: 30.7070,
    lng: 76.2160,
    state: "Punjab",
    area: "Ludhiana District",
    radiusKm: 1.5,
    osmSource: "OSM way/industrial Khanna Estate",
  },
  {
    id: "PUN-IND-SAHNEWAL",
    name: "Sahnewal Auto & Textile Cluster",
    type: "auto_component",
    typeLabel: "Auto Parts, Dyeing & Casting",
    lat: 30.8450,
    lng: 75.9870,
    state: "Punjab",
    area: "Ludhiana District",
    radiusKm: 1.2,
    osmSource: "OSM way/industrial Sahnewal",
  },
  {
    id: "PUN-IND-DORAHA",
    name: "Doraha Industrial Zone",
    type: "manufacturing_general",
    typeLabel: "Forging, Metal Fabrication & Packaging",
    lat: 30.8030,
    lng: 76.0310,
    state: "Punjab",
    area: "Ludhiana District",
    radiusKm: 1.0,
    osmSource: "OSM way/industrial Doraha",
  },
  {
    id: "PUN-IND-JALANDHAR-LEATHER",
    name: "Jalandhar Leather & Sports Goods Complex",
    type: "chemical_processing",
    typeLabel: "Tannery, Chemical Finishing & Rubber",
    lat: 31.3260,
    lng: 75.5760,
    state: "Punjab",
    area: "Jalandhar District",
    radiusKm: 2.0,
    osmSource: "OSM way/industrial Jalandhar Leather Complex",
  },
  {
    id: "PUN-IND-PHAGWARA",
    name: "Phagwara Auto Ancillary & Sugar Mill",
    type: "auto_component",
    typeLabel: "Diesel Engines, Auto Parts & Agro-Processing",
    lat: 31.2240,
    lng: 75.7720,
    state: "Punjab",
    area: "Kapurthala District",
    radiusKm: 1.5,
    osmSource: "OSM way/industrial Phagwara",
  },
  {
    id: "PUN-AGRI-SANGRUR",
    name: "Sangrur Agricultural Residue Zone",
    type: "agricultural_zone",
    typeLabel: "Seasonal Crop Residue Burning Belt",
    lat: 30.2458,
    lng: 75.8421,
    state: "Punjab",
    area: "Sangrur District (Malwa Belt)",
    radiusKm: 10.0,
    osmSource: "OSM area/agricultural Sangrur district",
  },
];

/**
 * Find all industrial clusters within a bounding box.
 * Used to spatially prune candidates to only those near the dispersion envelope.
 */
export function findClustersInBounds(
  minLat: number,
  maxLat: number,
  minLng: number,
  maxLng: number
): IndustrialCluster[] {
  return INDUSTRIAL_CLUSTERS.filter(
    (c) => c.lat >= minLat && c.lat <= maxLat && c.lng >= minLng && c.lng <= maxLng
  );
}

/**
 * Find all industrial clusters within a given radius (km) of a point.
 */
export function findClustersNearPoint(
  lat: number,
  lng: number,
  radiusKm: number
): IndustrialCluster[] {
  return INDUSTRIAL_CLUSTERS.filter((c) => {
    const dLat = ((c.lat - lat) * Math.PI) / 180;
    const dLng = ((c.lng - lng) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat * Math.PI) / 180) *
        Math.cos((c.lat * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2;
    const km = 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return km <= radiusKm;
  });
}
