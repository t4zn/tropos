import { NextResponse } from "next/server";

/**
 * Gemini Vision Air Quality & Sky Haze Analysis API
 * 
 * Uses Google Gemini 1.5 Flash multimodal vision model to independently analyze
 * outdoor sky/horizon photos for particulate haze, cloud vs aerosol classification,
 * landmark extinction, and visual AQI.
 * 
 * Key stored securely in server-side process.env.GEMINI_API_KEY.
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
    const geminiKey = process.env.GEMINI_API_KEY;

    if (!groqKey && !geminiKey) {
      return NextResponse.json({
        success: false,
        isConfigured: false,
        fallbackReason: "Neither GROQ_API_KEY nor GEMINI_API_KEY is set in .env.local. Add one to enable live AI vision analysis.",
      });
    }

    let parsed: Record<string, unknown> | null = null;
    let providerUsed = "";

    const promptText = `You are an expert atmospheric scientist and computer vision specialist analyzing an outdoor sky and horizon photograph taken at ${locationName}.
The ground photometer or sensor recorded an aerosol optical depth (AOD / tau) of ~${opticalDepth} and an estimated AQI of ~${aqi}.

Carefully analyze the image for:
1. Sky clarity, color saturation, and horizon contrast degradation (Rayleigh scattering vs Mie aerosol extinction).
2. Distant landmark extinction distance and visual haze severity.
3. Discrimination between natural clouds (condensed water droplets/ice) and anthropogenic particulate aerosol/smog.
4. Sky turbidity rating.
5. Whether the visual evidence corroborates or contradicts the ground sensor's measured optical depth and AQI.

Respond ONLY with a valid JSON object strictly matching this schema:
{
  "hazeSeverity": "clean" | "low" | "moderate" | "heavy" | "severe" | "extreme",
  "hazeDescription": "Detailed 1-2 sentence description of particulate haze, horizon visibility, and atmospheric clarity.",
  "estimatedAodTau": <number, visual estimate of aerosol optical depth tau, e.g. 0.05 to 1.8>,
  "estimatedAqi": <number, visual estimate of AQI 0 to 500>,
  "aqiCategory": "Good" | "Moderate" | "Unhealthy for Sensitive Groups" | "Unhealthy" | "Very Unhealthy" | "Hazardous",
  "cloudCoveragePercent": <number between 0 and 100>,
  "cloudType": "Clear" | "Cirrus" | "Cumulus" | "Stratus" | "Overcast" | "Smog / Haze",
  "aerosolVsCloudConfidence": <number between 0.50 and 0.99 reflecting confidence in separating aerosol haze from meteorological clouds>,
  "skyTurbidityRating": "low" | "moderate" | "high" | "turbid" | "extreme",
  "visualClarity": "Description of horizon contrast, landmark extinction, and viewing range.",
  "radiometricCorroboration": "Analysis comparing visual findings to the ground sensor measurement (tau=${opticalDepth}, AQI=${aqi})."
}`;

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

    // 2. Fall back to Google Gemini if Groq wasn't configured or failed
    if (!parsed && geminiKey) {
      const apiKey = geminiKey;
      const isOAuthBearer = apiKey.startsWith("ya29.");
      const authHeaders: Record<string, string> = {
        "Content-Type": "application/json",
      };

      if (isOAuthBearer) {
        authHeaders["Authorization"] = `Bearer ${apiKey}`;
      } else {
        authHeaders["x-goog-api-key"] = apiKey;
      }

      // Dynamically detect which Gemini model is available for this credential
      let modelName = "gemini-3.6-flash";
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
            "models/gemini-3.6-flash",
            "models/gemini-3.5-flash",
            "models/gemini-flash-latest",
            "models/gemini-2.5-flash-lite",
            "models/gemini-2.0-flash",
            "models/gemini-1.5-flash",
            "models/gemini-1.5-flash-latest",
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
        console.error("[Gemini listModels exception]:", e);
      }

      const buildUrl = (model: string) =>
        isOAuthBearer
          ? `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`
          : `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

      const geminiPayload = {
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
          maxOutputTokens: 800,
        },
      };

      let res = await fetch(buildUrl(modelName), {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify(geminiPayload),
        signal: AbortSignal.timeout(15000),
      });

      // Fallback attempt with gemini-flash-latest if 404
      if (res.status === 404 && modelName !== "gemini-flash-latest") {
        res = await fetch(buildUrl("gemini-flash-latest"), {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify(geminiPayload),
          signal: AbortSignal.timeout(15000),
        });
      }

      if (res.ok) {
        const data = await res.json();
        const candidate = data.candidates?.[0];
        const textPart = candidate?.content?.parts?.[0]?.text;
        if (textPart) {
          const cleanJson = textPart.replace(/^```json\s*/i, "").replace(/\s*```$/, "").trim();
          parsed = JSON.parse(cleanJson);
          providerUsed = `Gemini (${modelName})`;
        }
      } else {
        const errText = await res.text().catch(() => "");
        console.error("[Gemini Vision API Error]:", res.status, errText);
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
      radiometricCorroboration: parsed.radiometricCorroboration || "Gemini visual analysis corroborates physical sensor.",
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Internal error";
    console.error("[Gemini Vision Exception]:", msg);
    return NextResponse.json({
      success: false,
      isConfigured: Boolean(process.env.GEMINI_API_KEY),
      fallbackReason: msg,
    });
  }
}
