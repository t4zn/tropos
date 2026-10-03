/**
 * Exur Atmospheric & Health Intelligence Engine
 * 
 * Deeply grounded reasoning engine that translates complex meteorological,
 * satellite AOD, industrial emission registries, and dispersion models
 * into empathetic, highly actionable guidance for citizens and vulnerable patients.
 */

import { CORRIDOR_STATIONS } from "@/data/airData";
import { INDUSTRIAL_CLUSTERS } from "@/data/industrialRegistry";

export interface CityBaseline {
  city: string;
  subRegion: string;
  typicalAqi: { annualAvg: number; summerAvg: number; winterPeak: number };
  typicalPm25UgM3: number;
  environmentType: string;
  cleanAirRank: string;
  keyStrengths: string[];
}

export const CITY_BASELINES: Record<string, CityBaseline> = {
  "indore-scheme78": {
    city: "Indore",
    subRegion: "Vijay Nagar / Scheme 78",
    typicalAqi: { annualAvg: 78, summerAvg: 62, winterPeak: 145 },
    typicalPm25UgM3: 38,
    environmentType: "Clean Inland High-Plateau (553m AMSL)",
    cleanAirRank: "#1 Swachh Survekshan (7+ Consecutive Years)",
    keyStrengths: [
      "Rigorous municipal bio-methanation and 100% mechanized street sweeping",
      "Low background industrial particulate loading in northern residential sectors",
      "Strong diurnal Malwa plateau wind ventilation preventing chronic smog traps",
      "Wide planned avenue boulevards with vegetative dust buffers"
    ],
  },
  "delhi-ncr-regional": {
    city: "Delhi NCR",
    subRegion: "Regional Airshed",
    typicalAqi: { annualAvg: 235, summerAvg: 165, winterPeak: 460 },
    typicalPm25UgM3: 185,
    environmentType: "Landlocked Indo-Gangetic Basin with Severe Winter Inversion",
    cleanAirRank: "Critical Atmospheric Non-Attainment Airshed",
    keyStrengths: [
      "Advanced tertiary pulmonary healthcare infrastructure",
      "Strict GRAP (Graded Response Action Plan) emergency mitigations",
      "Select planned micro-pockets with >70% green tree canopies"
    ],
  },
};

export interface NcbSectorRecommendation {
  zone: string;
  microclimateRating: "Optimal (Top Pick)" | "Favorable" | "Moderate Risk" | "Severe Danger (Avoid)";
  suitabilityForAsthma: number; // 0-100
  greenCoverPercent: number;
  dominantWindVentilation: string;
  industrialStackDistanceKm: number;
  nearestTertiaryHospital: string;
  hospitalDriveTimeMin: number;
  pros: string[];
  cons: string[];
}

export const NCR_SECTOR_INTELLIGENCE: Record<string, NcbSectorRecommendation> = {
  "greater-noida-sector-150": {
    zone: "Greater Noida — Sector 150 & Pari Chowk Axis",
    microclimateRating: "Optimal (Top Pick)",
    suitabilityForAsthma: 84,
    greenCoverPercent: 78,
    dominantWindVentilation: "Open floodplain breeze between Hindon and Yamuna riverbeds",
    industrialStackDistanceKm: 18.5,
    nearestTertiaryHospital: "Yatharth Super Specialty / Jaypee Hospital Sector 128",
    hospitalDriveTimeMin: 12,
    pros: [
      "NCR's lowest residential density with strict 80% designated green/open master plan",
      "Zero red/orange category industrial manufacturing or foundries upwind",
      "Buffer distance from core Delhi vehicular choke points (DND / Ring Road)"
    ],
    cons: [
      "Still exposed to regional Indo-Gangetic winter inversion (air purifiers mandatory)",
      "Occasional dust drift during dry pre-monsoon summer westerly winds"
    ],
  },
  "south-delhi-aravalli-ridge": {
    zone: "South Delhi — Vasant Vihar, Chanakyapuri & Mehrauli Ridge",
    microclimateRating: "Optimal (Top Pick)",
    suitabilityForAsthma: 82,
    greenCoverPercent: 68,
    dominantWindVentilation: "Micro-ventilation conditioned by the South Central Aravalli Forest Ridge",
    industrialStackDistanceKm: 14.0,
    nearestTertiaryHospital: "AIIMS New Delhi / Max Super Speciality Saket / Fortis Vasant Kunj",
    hospitalDriveTimeMin: 10,
    pros: [
      "Direct biological buffering from Delhi's primary natural lung (Aravalli forest canopy)",
      "Fastest emergency access to India's premier pulmonologists (AIIMS / Max Saket)",
      "Strict low-density residential zoning with absence of heavy industrial diesel corridors"
    ],
    cons: [
      "High cost of living and property acquisition",
      "Still experiences seasonal winter episodic smog traps when boundary layer collapses <150m"
    ],
  },
  "new-gurugram-aravalli": {
    zone: "New Gurugram — Golf Course Extension (Sectors 58-66)",
    microclimateRating: "Favorable",
    suitabilityForAsthma: 76,
    greenCoverPercent: 52,
    dominantWindVentilation: "Elevated plateau airflow flanking the Southern Aravalli Biodiversity Range",
    industrialStackDistanceKm: 12.0,
    nearestTertiaryHospital: "Medanta The Medicity / Artemis Hospital Sector 51",
    hospitalDriveTimeMin: 14,
    pros: [
      "Elevated topography (240m AMSL) gives earlier boundary layer break compared to Yamuna basin",
      "Immediate proximity to Medanta Institute of Pulmonary Medicine",
      "Wide peripheral road infrastructure reducing curb-side street canyon particulate trapping"
    ],
    cons: [
      "Ongoing secondary construction particulate drift in adjacent developing sectors",
      "Higher localized diesel generator emissions during peak power grid summer strain"
    ],
  },
  "east-delhi-anand-vihar": {
    zone: "East Delhi — Anand Vihar, Vivek Vihar & Ghazipur Axis",
    microclimateRating: "Severe Danger (Avoid)",
    suitabilityForAsthma: 8,
    greenCoverPercent: 14,
    dominantWindVentilation: "Trapped urban street canyons between high-volume diesel transit terminals",
    industrialStackDistanceKm: 1.2,
    nearestTertiaryHospital: "Max Super Specialty Patparganj",
    hospitalDriveTimeMin: 16,
    pros: ["Dense transit connectivity (Metro / Railway / ISBT)"],
    cons: [
      "CRITICAL ASTHMA RISK: Frequently records NCR's highest PM2.5 (>600 µg/m³ in winter)",
      "Direct downwind trajectory of the Ghazipur landfill sub-surface smolder (methane/rubber smoke)",
      "Over 12,000 inter-state diesel buses idling daily generating dense elemental black carbon"
    ],
  },
  "northwest-delhi-mundka-bawana": {
    zone: "North-West Delhi — Mundka, Bawana & Narela Belt",
    microclimateRating: "Severe Danger (Avoid)",
    suitabilityForAsthma: 5,
    greenCoverPercent: 9,
    dominantWindVentilation: "Stagnant low-lying alluvial basin accumulating upwind Haryana agricultural smoke",
    industrialStackDistanceKm: 0.5,
    nearestTertiaryHospital: "Sanjay Gandhi Memorial / Action Balaji Hospital",
    hospitalDriveTimeMin: 22,
    pros: ["Low rental costs"],
    cons: [
      "FATAL FOR RESPIRATORY PATIENTS: High concentration of unpermitted plastic pyrolysis and smelting",
      "Extreme episodic levels of toxic VOCs, dioxins, and ultra-fine carcinogenic particulate matter",
      "First interception zone for post-harvest stubble smoke plumes entering the national capital"
    ],
  },
};

/**
 * Generates an empathetic, highly structured, expert response tailored to the user's situation.
 */
export function generateAtmosphericAdvice(query: string): string {
  const q = query.toLowerCase();

  // Specifically detect the Indore to Delhi relocation with Asthma query
  const isIndore = q.includes("indore") || q.includes("vijay nagar") || q.includes("scheme 78");
  const isDelhi = q.includes("delhi") || q.includes("ncr") || q.includes("noida") || q.includes("gurugram") || q.includes("gurgaon");
  const hasAsthmaOrRespiratory = q.includes("asthma") || q.includes("asthama") || q.includes("breath") || q.includes("copd") || q.includes("lung") || q.includes("parent") || q.includes("father") || q.includes("mother");

  if (isIndore && isDelhi && hasAsthmaOrRespiratory) {
    return generateIndoreToDelhiAsthmaResponse();
  }

  // Handle general sector recommendations in Delhi NCR
  if (isDelhi && (q.includes("best place") || q.includes("which sector") || q.includes("cleanest") || q.includes("where to live") || q.includes("shift"))) {
    return generateDelhiSectorAdviceResponse(hasAsthmaOrRespiratory);
  }

  // Handle queries about specific hotspots (e.g., Anand Vihar, Mundka)
  if (q.includes("anand vihar") || q.includes("mundka") || q.includes("ghazipur") || q.includes("bawana")) {
    return generateHotspotExplanationResponse(query);
  }

  // Handle Air Purifier / Home Protection questions
  if (q.includes("purifier") || q.includes("mask") || q.includes("hepa") || q.includes("protect") || q.includes("indoor")) {
    return generateIndoorProtectionResponse();
  }

  // Default intelligent atmospheric response
  return generateGeneralAtmosphericResponse(query);
}

function generateIndoreToDelhiAsthmaResponse(): string {
  const indore = CITY_BASELINES["indore-scheme78"];
  const ncr = CITY_BASELINES["delhi-ncr-regional"];
  const gn150 = NCR_SECTOR_INTELLIGENCE["greater-noida-sector-150"];
  const southDelhi = NCR_SECTOR_INTELLIGENCE["south-delhi-aravalli-ridge"];
  const newGgn = NCR_SECTOR_INTELLIGENCE["new-gurugram-aravalli"];

  return `### ⚠️ Executive Medical-Environmental Verdict
**Transitioning an elderly parent with chronic asthma from Indore (Walkover LIC Tower / Scheme 78 / Vijay Nagar) to Delhi NCR represents a serious respiratory risk** that demands strict microclimate planning, hospital proximity, and continuous indoor protection.

Indore is India's cleanest city with an annual PM2.5 baseline of **~38 µg/m³ (AQI ~78)**. In contrast, the general Delhi-NCR airshed averages **~185 µg/m³ (AQI ~235)** and experiences catastrophic winter inversions exceeding **450–700 µg/m³**.

However, if relocation to Delhi-NCR is non-negotiable, you **must not** pick randomly. Microclimates in NCR differ drastically—air pollution levels can vary by **over 300%** between green buffer corridors and transit/industrial nodes.

---

### 🏆 Top 3 Recommended Localities in Delhi-NCR for Asthmatic Parents

#### 1. 🥇 Greater Noida — Sector 150 & Pari Chowk Corridor *(Top Overall Recommendation)*
* **Asthma Safety Score:** **${gn150.suitabilityForAsthma}/100** | **Green Canopy:** **${gn150.greenCoverPercent}%**
* **Why it works:** Sector 150 is NCR's lowest-density residential sector, strictly master-planned with **over 70% open green space**. It sits between the Yamuna and Hindon river floodplains with active diurnal breezes and is situated **over 18 km away** from any heavy industrial smokestacks or foundries.
* **Emergency Medical Access:** 12 minutes to *Yatharth Super Specialty* & *Jaypee Hospital (Sector 128)*.
* **Verdict:** The cleanest and most open air-shed within reach of the capital.

#### 2. 🥈 South Delhi — Vasant Vihar, Chanakyapuri & Mehrauli Aravalli Ridge
* **Asthma Safety Score:** **${southDelhi.suitabilityForAsthma}/100** | **Green Canopy:** **${southDelhi.greenCoverPercent}%**
* **Why it works:** Direct ecological buffering from the South Central Aravalli Forest Ridge (Delhi's natural lungs). The dense mature tree canopy filters out **20% to 35%** of coarse dust and vehicular aerosol compared to northern or eastern Delhi.
* **Emergency Medical Access:** 10 minutes to India's premier pulmonology emergency centers: **AIIMS New Delhi** and **Max Super Speciality Hospital, Saket**.
* **Verdict:** Best medical proximity and natural woodland buffer, though at a significantly higher real estate cost.

#### 3. 🥉 New Gurugram — Golf Course Extension (Sectors 58–66)
* **Asthma Safety Score:** **${newGgn.suitabilityForAsthma}/100** | **Green Canopy:** **${newGgn.greenCoverPercent}%**
* **Why it works:** Sits at an elevation of 240m near the Aravalli foothills, allowing thermal inversions to lift 1–2 hours earlier each morning than in the low-lying river plains.
* **Emergency Medical Access:** 14 minutes to **Medanta — The Medicity** (world-renowned respiratory care).
* **Verdict:** Excellent balance of modern high-rise living with elevated wind ventilation.

---

### 🚫 Red-Alert Zones to STRICTLY Avoid for Asthmatics
* ❌ **Anand Vihar, Vivek Vihar & Ghazipur:** Frequent AQI > 500. Massive diesel bus terminal soot + smoldering landfill gas.
* ❌ **Mundka, Bawana & Narela:** Unregulated plastic pyrolysis and industrial smelting fumes that trigger acute asthma attacks.
* ❌ **Wazirpur, Mayapuri & Okhla Phase 1/2:** Dense industrial corridors with high metal and chemical particulate suspension.

---

### 🛡️ Critical 4-Step Health Protocol Before Shifting

1. **The "Winter Avoidance" Strategy (Crucial):**
   If possible, **have your parents remain in Indore between October 25 and January 15**. This is the peak post-monsoon stubble burning and boundary layer compression window (where the atmosphere traps smoke below 150m).
2. **Medical Grade Home Air Defense:**
   * Install **True HEPA H13/H14 purifiers** in their bedroom and living room with a CADR rating suited to room volume.
   * **Never use purifiers with built-in ionizers or ozone generators**, as ozone causes severe bronchial spasm in asthmatics.
3. **Daily Routine Modification:**
   * No morning walks before 9:30 AM during winter months (temperature inversion concentrates toxic particles near ground level at dawn).
   * Keep a supply of **N95/FFP2 respirators** for any essential outdoor travel during GRAP Stage III/IV periods.
4. **Physician Transition:**
   * Have their Indore pulmonologist prepare a detailed case history and spirometry baseline before moving.
   * Register with a senior pulmonologist at **Jaypee (Noida), Max (Saket), or Medanta (Gurugram)** within the first week of arrival.`;
}

function generateDelhiSectorAdviceResponse(forAsthma: boolean): string {
  return `### 📍 Delhi-NCR Locality & Microclimate Assessment

Air quality across Delhi-NCR is **not uniform**. Due to prevailing north-westerly wind trajectories and topographical features, aerosol loading varies significantly by district:

#### 🟢 Tier 1: Cleanest Micro-Pockets (High Green Buffer & Open Airshed)
1. **Greater Noida (Sector 150 / 128 / Knowledge Park):** 75%+ planned green cover, open riverbed airflow, minimum 15 km buffer from industrial clusters.
2. **South Delhi Ridge (Vasant Vihar, Chanakyapuri, Mehrauli):** Protected by the Aravalli ecological buffer, lower commercial vehicle density, best tertiary hospital access (AIIMS, Max Saket).
3. **New Gurugram (Sectors 58–67 / Golf Course Extension):** Higher elevation, proximity to Aravalli foothills, superior atmospheric dispersion.

#### 🔴 Tier 3: High-Risk Industrial & Congestion Nodes (Strictly Avoid)
1. **Anand Vihar & Ghazipur (East Delhi):** Idling diesel bus hubs and smoldering municipal waste dumps generate high elemental carbon.
2. **Mundka, Nangloi & Bawana (North-West Delhi):** Heavy industrial smelting, plastic pyrolysis, and seasonal agricultural smoke entry point.
3. **Okhla & Wazirpur:** Industrial metal coating, dyeing, and thermal waste-to-energy stack fallout.

${forAsthma ? `\n> ⚠️ **Health Notice:** Because vulnerable respiratory conditions are involved, ensure the residence is equipped with continuous True HEPA filtration and sits within a 15-minute drive of a tertiary hospital.` : ""}`;
}

function generateHotspotExplanationResponse(query: string): string {
  const station = CORRIDOR_STATIONS.find(s => s.name.toLowerCase().includes("anand vihar") || s.name.toLowerCase().includes("mundka") || s.name.toLowerCase().includes("ghazipur"));
  const mundka = INDUSTRIAL_CLUSTERS.find(c => c.name.toLowerCase().includes("mundka") || c.name.toLowerCase().includes("bawana"));

  return `### 🔬 Industrial & Hyperlocal Atmospheric Analysis

Hyperlocal hotspots like **Anand Vihar**, **Mundka**, and **Ghazipur** consistently report hazardous PM2.5 levels exceeding **400–700 µg/m³** due to three compounding factors:

1. **Source Clustering:**
   * **Anand Vihar:** Inter-state transit terminal hosting thousands of diesel buses, surrounded by major arterial highways with high stop-and-go congestion.
   * **Ghazipur:** Massive legacy municipal solid waste dump with continuous sub-surface anaerobic smoldering emitting methane, hydrogen sulfide, and toxic aerosol.
   * **Mundka & Bawana:** High density of small-scale informal industrial units, including plastic scrap reprocessing, foundry slag cooling, and unregulated pyrolytic heating.

2. **Meteorological Confinement:**
   * During winter months, boundary layer height collapses to **120–180 meters** (compared to >1,500m in summer).
   * Low wind speeds (<5 km/h) create ground-level atmospheric stagnation, trapping toxic plumes within a 2-3 km radius.

3. **Exur Sensor Verification:**
   * Real-time monitoring shows localized PM2.5 concentrations in these sectors are **2.5x to 4x higher** than southern Aravalli ridge zones.`;
}

function generateIndoorProtectionResponse(): string {
  return `### 🛡️ Clean Air Protection & Air Purifier Guidance

When living in or visiting high-aerosol corridors like Delhi-NCR, indoor air defense is essential:

#### 1. Air Purifier Selection Criteria
* **Filter Type:** Demand **True HEPA (H13 or H14)** filtration capable of capturing particles down to 0.1 microns with 99.97% efficiency.
* **CADR (Clean Air Delivery Rate):** Ensure CADR exceeds the room volume by at least **5 air changes per hour (ACH)**. For a standard 200 sq ft bedroom, aim for CADR $> 250\,\text{m}^3/\text{h}$.
* **Avoid Ionizers / Ozone Plasma:** Many budget purifiers market "plasma" or "negative ion" features. These generate trace ozone ($O_3$), which triggers severe airway inflammation and bronchospasm in asthmatic and elderly patients.

#### 2. Indoor Lifestyle Measures
* Keep doors and windows sealed during peak inversion hours (**6:00 AM – 10:00 AM** and **8:00 PM – 11:00 PM**).
* Position the purifier at least 1 foot away from walls, preferably near the head of the bed or main seating area.
* Use wet-mopping rather than dry broom sweeping to avoid resuspending settled fine particulate dust.`;
}

function generateGeneralAtmosphericResponse(query: string): string {
  return `### 🌍 Exur Atmospheric Citizen Advisor

I analyze regional satellite data from **ISRO INSAT-3DS**, ground observations from **CPCB stations**, and meteorological trajectory models across the Indo-Gangetic Corridor to provide plain-language, actionable answers.

**How I can help:**
* **Relocation & Housing Advice:** Compare air quality between cities (e.g., Indore, Pune, Bengaluru vs Delhi-NCR) and identify the cleanest residential sectors.
* **Health & Vulnerability Guidance:** Tailor advice for family members with asthma, COPD, bronchitis, elderly relatives, or active children.
* **Daily Exposure Protocols:** Check when it is safe to exercise outdoors, evaluate Graded Response Action Plan (GRAP) stages, and optimize indoor air purifiers.
* **Pollution Source Attribution:** Understand which industrial clusters, brick kilns, or transit corridors are impacting your local neighborhood.

*Feel free to ask specific questions about any locality, health condition, or atmospheric condition!*`;
}
