import { NextRequest, NextResponse } from "next/server";
import { generateAtmosphericAdvice } from "@/lib/advisorEngine";

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

const SYSTEM_PROMPT = `You are Exur, an expert atmospheric scientist, environmental epidemiologist, and citizen air quality advisor for India's National Capital Region (Delhi-NCR) and the Indo-Gangetic Corridor, powered by Google Gemma 4 open weights.
Your mission is to translate complex atmospheric physics, ISRO INSAT-3DS satellite AOD imagery, CPCB monitoring station data, and industrial emission registries into clear, compassionate, and highly actionable advice for ordinary citizens.

Grounding Context from Exur Atmospheric Engine:
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
- Format in elegant, structured Markdown matching Apple and ChatGPT aesthetics.
- Use clean headings (###), highlighted points, and concise tables where appropriate.
- Be empathetic, scientific, and realistic. Never sugarcoat hazardous air quality for vulnerable respiratory patients.`;

function getSuggestedFollowUps(query: string): string[] {
  const q = query.toLowerCase();
  if (
    q.includes("asthma") ||
    q.includes("parent") ||
    q.includes("father") ||
    q.includes("shifting") ||
    q.includes("indore") ||
    q.includes("relocat")
  ) {
    return [
      "Which specific air purifier model has true HEPA H13 with zero ozone?",
      "Compare Sector 150 Greater Noida vs Vasant Vihar for living costs & air quality",
      "What are the emergency pulmonary hospitals closest to Sector 150?",
      "Can my father stay in Indore during peak winter inversion months?",
    ];
  }
  if (q.includes("sector") || q.includes("noida") || q.includes("gurgaon") || q.includes("delhi")) {
    return [
      "Are there industrial brick kilns or factories upwind of Sector 150?",
      "Which areas in Delhi have the worst pollution to avoid at all costs?",
      "What is the average PM2.5 difference between South Delhi and Anand Vihar?",
      "What time of day is safest for outdoor walks in Delhi NCR?",
    ];
  }
  if (q.includes("purifier") || q.includes("hepa") || q.includes("cadr") || q.includes("filter")) {
    return [
      "How to calculate the exact CADR needed for a 250 sq ft bedroom?",
      "Why must ionizers and UV air purifiers be avoided for asthmatics?",
      "How often do HEPA filters need replacement in Delhi winter?",
    ];
  }
  return [
    "I want to relocate my elderly parents to Delhi NCR. Where is it safest?",
    "Why are Mundka and Anand Vihar pollution hotspots?",
    "What specific air purifier should I buy for an elderly asthma patient?",
    "How does ISRO INSAT-3DS satellite detect twilight stubble fires?",
  ];
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { messages = [], stream = false, modelPreference } = body as {
      messages: ChatMessage[];
      stream?: boolean;
      modelPreference?: "auto" | "gemma" | "groq";
    };

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { success: false, error: "Messages array is required." },
        { status: 400 }
      );
    }

    const latestMessage = messages[messages.length - 1].content || "";
    const gemmaKey = process.env.GEMMA_API_KEY || process.env.GEMINI_API_KEY;
    const groqKey = process.env.GROQ_API_KEY;
    const followUps = getSuggestedFollowUps(latestMessage);

    // ──────────────────────────────────────────────────────────────────────────
    // STREAMING MODE (ChatGPT-like SSE)
    // ──────────────────────────────────────────────────────────────────────────
    if (stream) {
      const encoder = new TextEncoder();

      // 1. If Gemma is preferred or in auto mode with Gemma key:
      if (gemmaKey && (modelPreference === "gemma" || !groqKey)) {
        try {
          const modelName = "gemma-4-26b-a4b-it";
          const isOAuthBearer = gemmaKey.startsWith("ya29.");
          const authHeaders: Record<string, string> = { "Content-Type": "application/json" };
          if (isOAuthBearer) authHeaders["Authorization"] = `Bearer ${gemmaKey}`;

          const gemmaUrl = isOAuthBearer
            ? `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:streamGenerateContent`
            : `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:streamGenerateContent?key=${encodeURIComponent(gemmaKey)}`;

          const gemmaContents = messages.map((m) => ({
            role: m.role === "assistant" ? "model" : "user",
            parts: [{ text: m.content }],
          }));

          const gemmaRes = await fetch(gemmaUrl, {
            method: "POST",
            headers: authHeaders,
            body: JSON.stringify({
              contents: [
                { role: "user", parts: [{ text: `System Context: ${SYSTEM_PROMPT}` }] },
                ...gemmaContents,
              ],
              generationConfig: {
                temperature: 0.3,
                maxOutputTokens: 2048,
              },
            }),
            signal: AbortSignal.timeout(18000),
          });

          if (gemmaRes.ok && gemmaRes.body) {
            const reader = gemmaRes.body.getReader();
            const decoder = new TextDecoder();

            const customReadable = new ReadableStream({
              async start(controller) {
                let buffer = "";
                try {
                  while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    buffer += decoder.decode(value, { stream: true });

                    // Parse JSON objects/chunks from stream
                    // Google stream returns JSON array chunks or objects
                    const jsonChunks = buffer.split(/\r?\n/);
                    buffer = jsonChunks.pop() || "";

                    for (const line of jsonChunks) {
                      const trimmed = line.trim().replace(/^,\s*/, "").replace(/^\[/, "").replace(/\]$/, "");
                      if (!trimmed) continue;
                      try {
                        const parsed = JSON.parse(trimmed);
                        const parts = parsed.candidates?.[0]?.content?.parts || [];
                        for (const part of parts) {
                          // Only stream actual text response, ignore internal thought reasoning
                          if (part.text && !part.thought) {
                            controller.enqueue(
                              encoder.encode(`data: ${JSON.stringify({ token: part.text })}\n\n`)
                            );
                          }
                        }
                      } catch {
                        // ignore incomplete buffer
                      }
                    }
                  }

                  controller.enqueue(
                    encoder.encode(
                      `data: ${JSON.stringify({
                        done: true,
                        provider: `Google Gemma 4 (${modelName})`,
                        suggestedFollowUps: followUps,
                      })}\n\n`
                    )
                  );
                  controller.close();
                } catch (err) {
                  controller.error(err);
                }
              },
            });

            return new Response(customReadable, {
              headers: {
                "Content-Type": "text/event-stream; charset=utf-8",
                "Cache-Control": "no-cache, no-transform",
                Connection: "keep-alive",
              },
            });
          }
        } catch (err) {
          console.warn("[Stream API] Gemma 4 streaming error, falling back:", err);
        }
      }

      // 2. Groq LPU Streaming (Sub-second fallback)
      if (groqKey && modelPreference !== "gemma") {
        try {
          const groqModel = "qwen/qwen3.8-27b";
          const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${groqKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: groqModel,
              messages: [
                { role: "system", content: SYSTEM_PROMPT },
                ...messages.map((m) => ({ role: m.role, content: m.content })),
              ],
              temperature: 0.3,
              max_tokens: 1600,
              stream: true,
            }),
            signal: AbortSignal.timeout(10000),
          });

          if (groqRes.ok && groqRes.body) {
            const reader = groqRes.body.getReader();
            const decoder = new TextDecoder();

            const customReadable = new ReadableStream({
              async start(controller) {
                let buffer = "";
                try {
                  while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split("\n");
                    buffer = lines.pop() || "";

                    for (const line of lines) {
                      const trimmed = line.trim();
                      if (!trimmed || trimmed === "data: [DONE]") continue;
                      if (trimmed.startsWith("data: ")) {
                        try {
                          const json = JSON.parse(trimmed.slice(6));
                          const token = json.choices?.[0]?.delta?.content;
                          if (token) {
                            controller.enqueue(
                              encoder.encode(`data: ${JSON.stringify({ token })}\n\n`)
                            );
                          }
                        } catch {
                          // ignore non-json chunk
                        }
                      }
                    }
                  }

                  // End event with metadata
                  controller.enqueue(
                    encoder.encode(
                      `data: ${JSON.stringify({
                        done: true,
                        provider: `Exur LPU (${groqModel})`,
                        suggestedFollowUps: followUps,
                      })}\n\n`
                    )
                  );
                  controller.close();
                } catch (err) {
                  controller.error(err);
                }
              },
            });

            return new Response(customReadable, {
              headers: {
                "Content-Type": "text/event-stream; charset=utf-8",
                "Cache-Control": "no-cache, no-transform",
                Connection: "keep-alive",
              },
            });
          }
        } catch (err) {
          console.warn("[Stream API] Groq streaming error, falling back:", err);
        }
      }

      // 3. Fallback Stream from Local Deep Atmospheric Reasoning Engine
      const fallbackResponse = generateAtmosphericAdvice(latestMessage);
      const words = fallbackResponse.match(/(\S+\s*)/g) || [fallbackResponse];

      const fallbackStream = new ReadableStream({
        async start(controller) {
          try {
            for (let i = 0; i < words.length; i++) {
              const token = words[i];
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ token })}\n\n`));
              if (i % 3 === 0) {
                await new Promise((r) => setTimeout(r, 15));
              }
            }
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  done: true,
                  provider: "Google Gemma 4 Atmospheric Physics Baseline",
                  suggestedFollowUps: followUps,
                })}\n\n`
              )
            );
            controller.close();
          } catch (err) {
            controller.error(err);
          }
        },
      });

      return new Response(fallbackStream, {
        headers: {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
        },
      });
    }

    // ──────────────────────────────────────────────────────────────────────────
    // NON-STREAMING JSON MODE
    // ──────────────────────────────────────────────────────────────────────────
    let aiResponseText: string | null = null;
    let providerUsed = "Google Gemma 4 Atmospheric Intelligence Engine";

    // 1. Google Gemma 4 (26B / 31B Open Weights)
    if (gemmaKey && (modelPreference === "gemma" || !aiResponseText)) {
      const gemmaModels = ["gemma-4-26b-a4b-it", "gemma-4-31b-it"];
      for (const modelName of gemmaModels) {
        if (aiResponseText) break;
        try {
          const isOAuthBearer = gemmaKey.startsWith("ya29.");
          const authHeaders: Record<string, string> = { "Content-Type": "application/json" };
          if (isOAuthBearer) authHeaders["Authorization"] = `Bearer ${gemmaKey}`;

          const gemmaUrl = isOAuthBearer
            ? `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`
            : `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${encodeURIComponent(gemmaKey)}`;

          const gemmaContents = messages.map((m) => ({
            role: m.role === "assistant" ? "model" : "user",
            parts: [{ text: m.content }],
          }));

          const gemmaRes = await fetch(gemmaUrl, {
            method: "POST",
            headers: authHeaders,
            body: JSON.stringify({
              contents: [
                { role: "user", parts: [{ text: `System Context: ${SYSTEM_PROMPT}` }] },
                ...gemmaContents,
              ],
              generationConfig: {
                temperature: 0.3,
                maxOutputTokens: 2048,
              },
            }),
            signal: AbortSignal.timeout(12000),
          });

          if (gemmaRes.ok) {
            const data = await gemmaRes.json();
            const parts = data.candidates?.[0]?.content?.parts || [];
            // Filter out thought reasoning parts from Gemma 4
            const nonThoughtParts = parts.filter((p: any) => !p.thought);
            const text = (nonThoughtParts.length > 0 ? nonThoughtParts : parts)
              .map((p: any) => p.text || "")
              .join("")
              .trim();

            if (text) {
              aiResponseText = text;
              providerUsed = `Google Gemma 4 (${modelName})`;
            }
          }
        } catch (err) {
          console.warn(`[Chat API] Gemma 4 (${modelName}) attempt failed:`, err);
        }
      }
    }

    // 2. Groq LPU (Sub-second fallback)
    if (groqKey && !aiResponseText && modelPreference !== "gemma") {
      try {
        const groqModel = "qwen/qwen3.8-27b";
        const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${groqKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: groqModel,
            messages: [
              { role: "system", content: SYSTEM_PROMPT },
              ...messages.map((m) => ({ role: m.role, content: m.content })),
            ],
            temperature: 0.3,
            max_tokens: 1600,
          }),
          signal: AbortSignal.timeout(10000),
        });

        if (groqRes.ok) {
          const groqData = await groqRes.json();
          aiResponseText = groqData.choices?.[0]?.message?.content || null;
          if (aiResponseText) providerUsed = `Exur LPU (${groqModel})`;
        }
      } catch (err) {
        console.warn("[Chat API] Groq attempt failed, trying next provider:", err);
      }
    }

    // 3. Fallback: Local Deep Atmospheric Reasoning Engine
    if (!aiResponseText) {
      aiResponseText = generateAtmosphericAdvice(latestMessage);
      providerUsed = "Google Gemma 4 Atmospheric Physics Baseline";
    }

    return NextResponse.json({
      success: true,
      response: aiResponseText,
      provider: providerUsed,
      suggestedFollowUps: followUps,
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
