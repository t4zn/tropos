import { NextResponse } from "next/server";

/**
 * Google Gemma 4 Vision Air Quality & Sky Haze Analysis API
 * 
 * Uses Google Gemma 4 multimodal vision model to independently analyze
 * outdoor sky/horizon photos for particulate haze, cloud vs aerosol classification,
 * landmark extinction, and visual AQI.
 * 
 * Key stored securely in server-side process.env.GEMMA_API_KEY or process.env.GEMINI_API_KEY.
 */

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { imageBase64, mimeType = "image/jpeg", opticalDepth = 0.3, aqi = 100, locationName = "India" } = body;

    if (!imageBase64) {
      return NextResponse.json(
        { success: false, error: "Missing imageBase64 in request body." },
        { status: 400 }
      );
    }

    const groqKey = process.env.GROQ_API_KEY;
    const gemmaKey = process.env.GEMMA_API_KEY || process.env.GEMINI_API_KEY;

    if (!groqKey && !gemmaKey) {
      return NextResponse.json({
        success: false,
        isConfigured: false,
        fallbackReason: "Neither GROQ_API_KEY nor GEMMA_API_KEY is set in .env.local. Add one to enable live AI vision analysis.",
      });
    }

    const promptText = `
You are an atmospheric scientist and expert in optical remote sensing and aerosol physics.
Analyze this outdoor sky/horizon photograph to assess air pollution, aerosol loading, and visibility.

Physical optical depth calculated from camera CMOS sensor: ${Number(opticalDepth).toFixed(3)}
Baseline physical estimated AQI: ${Math.round(Number(aqi))}
Location context: ${locationName}

Task:
1. Distinguish natural water vapor clouds from particulate aerosol haze/smog/smoke.
2. Estimate horizontal visibility distance and visual landmark contrast.
3. Identify dominant atmospheric optical characteristics (e.g. photochemical smog, dust suspension, biomass burning smoke, or clean Rayleigh atmosphere).
4. Provide an independent visual AQI estimate on the 0-500 Indian/US standard scale.

Return ONLY valid JSON with no markdown backticks, matching this exact structure:
{
  "hazeSeverity": "pristine" | "light" | "moderate" | "heavy" | "severe",
  "hazeDescription": "1-2 concise sentences summarizing the atmospheric conditions and particulate load",
  "estimatedAodTau": number between 0.05 and 3.0,
  "estimatedAqi": integer between 0 and 500,
  "aqiCategory": "Good" | "Moderate" | "Poor" | "Very Poor" | "Severe" | "Hazardous",
  "cloudCoveragePercent": number between 0 and 100,
  "cloudType": "Clear" | "Cirrus" | "Cumulus" | "Stratus" | "Overcast" | "Inversion Smog Layer",
  "aerosolVsCloudConfidence": number between 0.5 and 0.99,
  "skyTurbidityRating": "low" | "moderate" | "high" | "extreme",
  "visualClarity": "e.g. Horizon contrast indicates ~3.2 km visibility",
  "radiometricCorroboration": "brief explanation comparing visual haze with the physical optical depth ${Number(opticalDepth).toFixed(3)}"
}
`;

    let parsed: Record<string, unknown> | null = null;
    let providerUsed = "";

    // 1. Try Groq Vision first if GROQ_API_KEY is configured (ultra-fast sub-second LPU)
    if (groqKey) {
      try {
        const groqModel = process.env.GROQ_VISION_MODEL || "llama-3.2-11b-vision-preview";
        const groqPayload = {
          model: groqModel,
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: promptText },
                {
                  type: "image_url",
                  image_url: {
                    url: `data:${mimeType};base64,${imageBase64}`,
                  },
                },
              ],
            },
          ],
          response_format: { type: "json_object" },
          temperature: 0.15,
          max_tokens: 800,
        };

        const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${groqKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(groqPayload),
          signal: AbortSignal.timeout(12000),
        });

        if (groqRes.ok) {
          const groqData = await groqRes.json();
          const content = groqData.choices?.[0]?.message?.content;
          if (content) {
            const cleanJson = content.replace(/^```json\s*/i, "").replace(/\s*```$/, "").trim();
            parsed = JSON.parse(cleanJson);
            providerUsed = `Groq (${groqModel})`;
          }
        } else {
          const errText = await groqRes.text().catch(() => "");
          console.warn("[Groq Vision API Error]:", groqRes.status, errText);
        }
      } catch (groqErr) {
        console.warn("[Groq Vision Exception]:", groqErr);
      }
    }

    // 2. Fall back to Google Gemma 4 if Groq wasn't configured or failed
    if (!parsed && gemmaKey) {
      const apiKey = gemmaKey;
      const isOAuthBearer = apiKey.startsWith("ya29.");
      const authHeaders: Record<string, string> = {
        "Content-Type": "application/json",
      };

      if (isOAuthBearer) {
        authHeaders["Authorization"] = `Bearer ${apiKey}`;
      } else {
        authHeaders["x-goog-api-key"] = apiKey;
      }

      // Prioritize Google Gemma 4 open weights models
      let modelName = "gemma-4-26b-a4b-it";
      try {
        const listUrl = isOAuthBearer
          ? "https://generativelanguage.googleapis.com/v1beta/models"
          : `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`;

        const listRes = await fetch(listUrl, {
          headers: authHeaders,
          signal: AbortSignal.timeout(4000),
        });

        if (listRes.ok) {
          const listData = await listRes.json();
          const models = (listData.models || []) as Array<{ name: string; supportedGenerationMethods?: string[] }>;
          const candidates = [
            "models/gemma-4-26b-a4b-it",
            "models/gemma-4-31b-it",
            "models/gemini-2.5-flash",
            "models/gemini-flash-latest",
          ];
          const match = candidates.find((c) =>
            models.some((m) => m.name === c && m.supportedGenerationMethods?.includes("generateContent"))
          );
          if (match) {
            modelName = match.replace("models/", "");
          } else {
            const anyGen = models.find((m) => m.supportedGenerationMethods?.includes("generateContent"));
            if (anyGen) {
              modelName = anyGen.name.replace("models/", "");
            }
          }
        }
      } catch (e) {
        console.error("[Gemma listModels exception]:", e);
      }

      const buildUrl = (model: string) =>
        isOAuthBearer
          ? `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`
          : `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

      const gemmaPayload = {
        contents: [
          {
            parts: [
              { text: promptText },
              {
                inlineData: {
                  mimeType,
                  data: imageBase64,
                },
              },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.15,
          maxOutputTokens: 1200,
        },
      };

      let res = await fetch(buildUrl(modelName), {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify(gemmaPayload),
        signal: AbortSignal.timeout(15000),
      });

      // Fallback attempt with gemma-4-31b-it if 404
      if (res.status === 404 && modelName !== "gemma-4-31b-it") {
        res = await fetch(buildUrl("gemma-4-31b-it"), {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify(gemmaPayload),
          signal: AbortSignal.timeout(15000),
        });
      }

      if (res.ok) {
        const data = await res.json();
        const candidate = data.candidates?.[0];
        const parts = candidate?.content?.parts || [];
        const nonThought = parts.filter((p: any) => !p.thought);
        const textPart = (nonThought.length > 0 ? nonThought : parts)
          .map((p: any) => p.text || "")
          .join("")
          .trim();

        if (textPart) {
          const cleanJson = textPart.replace(/^```json\s*/i, "").replace(/\s*```$/, "").trim();
          parsed = JSON.parse(cleanJson);
          providerUsed = `Google Gemma 4 (${modelName})`;
        }
      } else {
        const errText = await res.text().catch(() => "");
        console.error("[Gemma Vision API Error]:", res.status, errText);
      }
    }

    if (!parsed) {
      return NextResponse.json({
        success: false,
        isConfigured: true,
        fallbackReason: "Vision AI model did not return any candidate content.",
      });
    }

    return NextResponse.json({
      success: true,
      isConfigured: true,
      isSynthetic: false,
      hazeSeverity: parsed.hazeSeverity || "moderate",
      hazeDescription: parsed.hazeDescription || "Atmospheric aerosol analysis completed.",
      estimatedAodTau: Number(parsed.estimatedAodTau) || Number(opticalDepth),
      estimatedAqi: Math.round(Number(parsed.estimatedAqi)) || Math.round(Number(aqi)),
      aqiCategory: parsed.aqiCategory || "Moderate",
      cloudCoveragePercent: Math.round(Number(parsed.cloudCoveragePercent) || 0),
      cloudType: parsed.cloudType || "Clear",
      aerosolVsCloudConfidence: Math.min(0.99, Math.max(0.5, Number(parsed.aerosolVsCloudConfidence) || 0.85)),
      skyTurbidityRating: parsed.skyTurbidityRating || "moderate",
      visualClarity: parsed.visualClarity || "Visibility consistent with atmospheric baseline",
      radiometricCorroboration: parsed.radiometricCorroboration || "Google Gemma 4 visual analysis corroborates physical sensor.",
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Internal error";
    console.error("[Gemma Vision Exception]:", msg);
    return NextResponse.json({
      success: false,
      isConfigured: Boolean(process.env.GEMMA_API_KEY || process.env.GEMINI_API_KEY),
      fallbackReason: msg,
    });
  }
}
