import { NextRequest, NextResponse } from "next/server";
import { generateAtmosphericAdvice, NCR_SECTOR_INTELLIGENCE, CITY_BASELINES } from "@/lib/advisorEngine";
import { CORRIDOR_STATIONS } from "@/data/airData";

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { messages = [] } = body as { messages: ChatMessage[] };

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { success: false, error: "Messages array is required." },
        { status: 400 }
      );
    }

    const latestMessage = messages[messages.length - 1].content || "";

    // 1. Check for available LLM API keys
    const groqKey = process.env.GROQ_API_KEY;
    const geminiKey = process.env.GEMINI_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;

    let aiResponseText: string | null = null;
    let providerUsed = "Tropos Atmospheric Intelligence Engine";

    // System prompt grounding the model in Tropos scientific data
    const systemPrompt = `You are Tropos Citizen AI, an expert atmospheric scientist, environmental epidemiologist, and citizen air quality advisor for India's National Capital Region (Delhi-NCR) and the Indo-Gangetic Corridor.
Your mission is to translate complex atmospheric physics, ISRO INSAT-3DS satellite AOD imagery, CPCB monitoring station data, and industrial emission registries into clear, compassionate, and highly actionable advice for ordinary citizens.

Grounding Context from Tropos Atmospheric Engine:
- Indore (Vijay Nagar / Scheme 78): India's cleanest city (#1 Swachh Survekshan for 7+ years). Typical annual AQI 65-85 (PM2.5 ~38 µg/m³). High plateau ventilation, zero severe industrial smog traps in residential sectors.
- Delhi NCR Regional Baseline: Annual AQI ~235 (PM2.5 ~185 µg/m³), winter inversion peaks >450-700 µg/m³ when boundary layer compresses to 100-150m.
- Relocating an elderly parent with asthma from Indore to Delhi NCR is a high-risk medical decision requiring strict microclimate selection, air purifiers, and hospital proximity.
- Best Delhi NCR microclimates for asthma:
  1. Greater Noida Sector 150 & Pari Chowk Corridor (80% green cover, lowest density, >18km from industrial clusters, Jaypee/Yatharth hospital access).
  2. South Delhi Aravalli Ridge (Vasant Vihar, Chanakyapuri, Mehrauli - protected by dense forest canopy, near AIIMS/Max Saket).
  3. New Gurugram Golf Course Extension (Sectors 58-66 - elevated terrain near Aravalli foothills, near Medanta).
- High-danger zones to avoid for asthmatics: Anand Vihar/Ghazipur (diesel bus terminal + landfill smolder), Mundka/Bawana (plastic pyrolysis & smelting), Okhla/Wazirpur (industrial emissions).
- Core Medical Guidance: True HEPA H13/H14 purifiers with zero ozone; stay in Indore during winter (Oct 25-Jan 15) if possible; close proximity to tertiary pulmonology centers.

Style Guidelines:
- Write in clean, structured Markdown with clear headings (###), bullet points, and highlight badges.
- Be empathetic, scientific, and realistic. Never sugarcoat hazardous air quality for vulnerable respiratory patients.`;

    // ─── Provider 1: Groq LPU (Sub-second inference) ─────────────────────────
    if (groqKey && !aiResponseText) {
      try {
        const groqModel = process.env.GROQ_CHAT_MODEL || "llama-3.3-70b-versatile";
        const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${groqKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: groqModel,
            messages: [
              { role: "system", content: systemPrompt },
              ...messages.map((m) => ({ role: m.role, content: m.content })),
            ],
            temperature: 0.3,
            max_tokens: 1400,
          }),
          signal: AbortSignal.timeout(10000),
        });

        if (groqRes.ok) {
          const groqData = await groqRes.json();
          aiResponseText = groqData.choices?.[0]?.message?.content || null;
          if (aiResponseText) providerUsed = `Groq (${groqModel})`;
        }
      } catch (err) {
        console.warn("[Chat API] Groq attempt failed, trying next provider:", err);
      }
    }

    // ─── Provider 2: Google Gemini ───────────────────────────────────────────
    if (geminiKey && !aiResponseText) {
      try {
        const isOAuthBearer = geminiKey.startsWith("ya29.");
        const authHeaders: Record<string, string> = { "Content-Type": "application/json" };
        if (isOAuthBearer) authHeaders["Authorization"] = `Bearer ${geminiKey}`;

        const modelName = "gemini-2.0-flash";
        const geminiUrl = isOAuthBearer
          ? `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`
          : `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${encodeURIComponent(geminiKey)}`;

        // Convert messages to Gemini contents format
        const geminiContents = messages.map((m) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        }));

        const geminiRes = await fetch(geminiUrl, {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemPrompt }] },
            contents: geminiContents,
            generationConfig: {
              temperature: 0.3,
              maxOutputTokens: 1400,
            },
          }),
          signal: AbortSignal.timeout(12000),
        });

        if (geminiRes.ok) {
          const geminiData = await geminiRes.json();
          const candidate = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
          if (candidate) {
            aiResponseText = candidate;
            providerUsed = `Google Gemini (${modelName})`;
          }
        }
      } catch (err) {
        console.warn("[Chat API] Gemini attempt failed, falling back:", err);
      }
    }

    // ─── Provider 3: OpenAI ──────────────────────────────────────────────────
    if (openaiKey && !aiResponseText) {
      try {
        const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${openaiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [
              { role: "system", content: systemPrompt },
              ...messages.map((m) => ({ role: m.role, content: m.content })),
            ],
            temperature: 0.3,
            max_tokens: 1400,
          }),
          signal: AbortSignal.timeout(12000),
        });

        if (openaiRes.ok) {
          const openaiData = await openaiRes.json();
          aiResponseText = openaiData.choices?.[0]?.message?.content || null;
          if (aiResponseText) providerUsed = "OpenAI (gpt-4o-mini)";
        }
      } catch (err) {
        console.warn("[Chat API] OpenAI attempt failed, falling back:", err);
      }
    }

    // ─── Fallback: Tropos Deep Atmospheric Reasoning Engine ───────────────────
    if (!aiResponseText) {
      aiResponseText = generateAtmosphericAdvice(latestMessage);
      providerUsed = "Tropos Atmospheric Intelligence Engine";
    }

    // Dynamic contextual follow-up chips
    const suggestedFollowUps = getSuggestedFollowUps(latestMessage);

    return NextResponse.json({
      success: true,
      response: aiResponseText,
      provider: providerUsed,
      suggestedFollowUps,
    });
  } catch (err) {
    console.error("[Chat API Error]:", err);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to process question. Please try again.",
      },
      { status: 500 }
    );
  }
}

function getSuggestedFollowUps(query: string): string[] {
  const q = query.toLowerCase();
  if (q.includes("asthma") || q.includes("parent") || q.includes("father") || q.includes("shifting") || q.includes("indore")) {
    return [
      "Which air purifier should I buy for my father's room?",
      "Compare Greater Noida Sector 150 vs Vasant Vihar for living costs & clean air",
      "What are the nearest emergency pulmonary hospitals in Sector 150?",
      "How bad is the winter inversion in Delhi NCR between Nov and Jan?",
    ];
  }
  if (q.includes("sector") || q.includes("noida") || q.includes("gurgaon")) {
    return [
      "Are there brick kilns or factories upwind of Sector 150?",
      "Which areas in Delhi have the worst pollution to avoid?",
      "What is the average PM2.5 difference between South Delhi and Anand Vihar?",
    ];
  }
  return [
    "I want to relocate my elderly parents to Delhi NCR. Where is it safest?",
    "Why are Mundka and Anand Vihar pollution hotspots?",
    "How does Tropos use ISRO INSAT-3DS satellite data for city air quality?",
  ];
}
