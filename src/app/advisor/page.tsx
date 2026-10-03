"use client";

import { useState, useRef, useEffect } from "react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  provider?: string;
  suggestedFollowUps?: string[];
  timestamp: string;
}

const PRESET_QUERIES = [
  {
    title: "Indore (Scheme 78) ➔ Delhi NCR with Asthma",
    desc: "Relocating parents: Which sector in NCR is safest for asthma?",
    query:
      "I am a citizen of Indore Vijay Nagar Scheme 78 and I am thinking of shifting my parents to Delhi NCR region but my father has asthma so what will be the best place for them?",
  },
  {
    title: "Cleanest Sectors in Noida / Greater Noida",
    desc: "Evaluating low-density green zones & industrial buffer distances",
    query: "Which sectors in Noida or Greater Noida have the cleanest air and lowest industrial smokestack pollution?",
  },
  {
    title: "High-Risk Hotspot Explanation",
    desc: "Why are Anand Vihar, Mundka, and Ghazipur so hazardous?",
    query: "Explain why Anand Vihar and Mundka have hazardous air compared to South Delhi or Greater Noida.",
  },
  {
    title: "Asthma Air Defense & HEPA Purifiers",
    desc: "CADR sizing, room volume, and why ozone/ionizers must be avoided",
    query: "What specific air purifier should I buy for an elderly asthma patient in Delhi NCR?",
  },
];

export default function AdvisorPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputQuery, setInputQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || inputQuery).trim();
    if (!query || isLoading) return;

    const userMessage: Message = {
      id: "user-" + Date.now(),
      role: "user",
      content: query,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInputQuery("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (!res.ok) throw new Error("Server returned error: " + res.status);

      const data = await res.json();
      const assistantMessage: Message = {
        id: "assistant-" + Date.now(),
        role: "assistant",
        content: data.response,
        provider: data.provider,
        suggestedFollowUps: data.suggestedFollowUps,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      console.error("[Chat Error]:", err);
      const errorMessage: Message = {
        id: "assistant-err-" + Date.now(),
        role: "assistant",
        content:
          "⚠️ I encountered an issue connecting to the atmospheric intelligence engine. Please check your network and try again.",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleClearChat = () => {
    setMessages([]);
    inputRef.current?.focus();
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#0a0a0c",
        color: "#ffffff",
      }}
    >
      <Navigation />

      <main style={{ flex: 1, display: "flex", flexDirection: "column", maxWidth: "1040px", width: "100%", margin: "0 auto", padding: "32px 18px 48px" }}>
        {/* Header Hero */}
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "4px 14px",
              borderRadius: "9999px",
              backgroundColor: "rgba(41, 151, 255, 0.1)",
              border: "1px solid rgba(41, 151, 255, 0.25)",
              marginBottom: "16px",
            }}
          >
            <span
              style={{
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                backgroundColor: "#2997ff",
                boxShadow: "0 0 10px #2997ff",
              }}
            />
            <span style={{ fontSize: "11px", fontWeight: 700, color: "#2997ff", letterSpacing: "0.5px", textTransform: "uppercase" }}>
              Tropos AI Citizen Advisor
            </span>
          </div>

          <h1
            style={{
              fontSize: "clamp(30px, 5vw, 44px)",
              fontWeight: 700,
              letterSpacing: "-0.8px",
              lineHeight: 1.15,
              marginBottom: "12px",
            }}
          >
            Ask Anything. <span style={{ color: "#2997ff" }}>Breathe Safer.</span>
          </h1>

          <p
            style={{
              fontSize: "16px",
              color: "rgba(255, 255, 255, 0.6)",
              maxWidth: "680px",
              margin: "0 auto",
              lineHeight: 1.5,
            }}
          >
            No complex satellite grids or attribution math needed. Ask personal questions about relocation, asthmatic parents, children, or neighborhood air quality in plain language.
          </p>
        </div>

        {/* Empty State: Presets */}
        {messages.length === 0 && (
          <div style={{ marginBottom: "28px" }}>
            <div
              style={{
                fontSize: "12px",
                fontWeight: 600,
                color: "rgba(255, 255, 255, 0.4)",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
                marginBottom: "14px",
                textAlign: "center",
              }}
            >
              Popular Citizen Inquiries & Scenarios
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                gap: "12px",
              }}
            >
              {PRESET_QUERIES.map((p, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendMessage(p.query)}
                  style={{
                    backgroundColor: "rgba(255, 255, 255, 0.03)",
                    border: "1px solid rgba(255, 255, 255, 0.08)",
                    borderRadius: "14px",
                    padding: "16px",
                    textAlign: "left",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = "rgba(41, 151, 255, 0.08)";
                    e.currentTarget.style.borderColor = "rgba(41, 151, 255, 0.3)";
                    e.currentTarget.style.transform = "translateY(-2px)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.03)";
                    e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.08)";
                    e.currentTarget.style.transform = "none";
                  }}
                >
                  <div style={{ fontSize: "14px", fontWeight: 600, color: "#ffffff", marginBottom: "6px" }}>
                    {p.title}
                  </div>
                  <div style={{ fontSize: "12px", color: "rgba(255, 255, 255, 0.5)", lineHeight: 1.4 }}>
                    {p.desc}
                  </div>
                  <div
                    style={{
                      fontSize: "11px",
                      color: "#2997ff",
                      fontWeight: 600,
                      marginTop: "12px",
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    Ask this question &rarr;
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Chat History Stream */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "20px", marginBottom: "24px" }}>
          {messages.map((m) => (
            <div
              key={m.id}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: m.role === "user" ? "flex-end" : "flex-start",
              }}
            >
              {/* Message Header */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  marginBottom: "6px",
                  fontSize: "11px",
                  color: "rgba(255, 255, 255, 0.4)",
                }}
              >
                <span style={{ fontWeight: 600, color: m.role === "user" ? "rgba(255,255,255,0.7)" : "#2997ff" }}>
                  {m.role === "user" ? "You (Citizen)" : "Tropos AI Advisor"}
                </span>
                <span>•</span>
                <span>{m.timestamp}</span>
                {m.provider && (
                  <>
                    <span>•</span>
                    <span
                      style={{
                        backgroundColor: "rgba(41, 151, 255, 0.12)",
                        color: "#2997ff",
                        padding: "1px 6px",
                        borderRadius: "4px",
                        fontSize: "10px",
                        fontWeight: 600,
                      }}
                    >
                      {m.provider}
                    </span>
                  </>
                )}
              </div>

              {/* Message Bubble */}
              <div
                style={{
                  maxWidth: m.role === "user" ? "80%" : "100%",
                  backgroundColor: m.role === "user" ? "#0066cc" : "rgba(22, 22, 24, 0.85)",
                  border: m.role === "user" ? "none" : "1px solid rgba(255, 255, 255, 0.1)",
                  borderRadius: m.role === "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                  padding: m.role === "user" ? "12px 18px" : "22px 24px",
                  color: "#ffffff",
                  fontSize: "15px",
                  lineHeight: 1.6,
                  backdropFilter: "blur(20px)",
                  boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3)",
                }}
              >
                {m.role === "user" ? (
                  <div>{m.content}</div>
                ) : (
                  <div className="advisor-markdown-body" dangerouslySetInnerHTML={{ __html: renderMarkdown(m.content) }} />
                )}
              </div>

              {/* Suggested Follow-up chips */}
              {m.suggestedFollowUps && m.suggestedFollowUps.length > 0 && (
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "8px",
                    marginTop: "12px",
                    maxWidth: "90%",
                  }}
                >
                  <span style={{ fontSize: "11px", color: "rgba(255, 255, 255, 0.35)", alignSelf: "center", marginRight: "4px" }}>
                    Suggested:
                  </span>
                  {m.suggestedFollowUps.map((chip, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSendMessage(chip)}
                      style={{
                        backgroundColor: "rgba(255, 255, 255, 0.05)",
                        border: "1px solid rgba(255, 255, 255, 0.12)",
                        borderRadius: "9999px",
                        padding: "5px 12px",
                        fontSize: "12px",
                        color: "rgba(255, 255, 255, 0.8)",
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = "rgba(41, 151, 255, 0.15)";
                        e.currentTarget.style.borderColor = "#2997ff";
                        e.currentTarget.style.color = "#ffffff";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.05)";
                        e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.12)";
                        e.currentTarget.style.color = "rgba(255, 255, 255, 0.8)";
                      }}
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}

          {/* Loading Indicator */}
          {isLoading && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "8px" }}>
              <div style={{ fontSize: "11px", color: "#2997ff", fontWeight: 600 }}>
                Tropos Atmospheric Engine reasoning…
              </div>
              <div
                style={{
                  backgroundColor: "rgba(22, 22, 24, 0.85)",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  borderRadius: "18px 18px 18px 4px",
                  padding: "16px 20px",
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                }}
              >
                <div style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "#2997ff", animation: "pulse-dot 1.2s infinite ease-in-out" }} />
                <div style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "#2997ff", animation: "pulse-dot 1.2s infinite ease-in-out 0.2s" }} />
                <div style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "#2997ff", animation: "pulse-dot 1.2s infinite ease-in-out 0.4s" }} />
                <span style={{ fontSize: "13px", color: "rgba(255, 255, 255, 0.5)", marginLeft: "6px" }}>
                  Synthesizing CPCB monitors, satellite AOD, and clinical microclimates…
                </span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div
          style={{
            position: "sticky",
            bottom: "16px",
            zIndex: 10,
            backgroundColor: "rgba(18, 18, 20, 0.85)",
            backdropFilter: "blur(24px) saturate(180%)",
            border: "1px solid rgba(255, 255, 255, 0.15)",
            borderRadius: "18px",
            padding: "8px 12px 8px 16px",
            boxShadow: "0 20px 48px rgba(0, 0, 0, 0.6)",
            display: "flex",
            alignItems: "flex-end",
            gap: "10px",
          }}
        >
          <textarea
            ref={inputRef}
            rows={1}
            value={inputQuery}
            onChange={(e) => {
              setInputQuery(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
            }}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question (e.g. 'I am moving my asthmatic father from Indore to Delhi NCR, where should we live?')..."
            style={{
              flex: 1,
              backgroundColor: "transparent",
              border: "none",
              outline: "none",
              color: "#ffffff",
              fontSize: "14px",
              lineHeight: 1.5,
              resize: "none",
              maxHeight: "120px",
              padding: "6px 0",
              fontFamily: "inherit",
            }}
          />

          <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
            {messages.length > 0 && (
              <button
                onClick={handleClearChat}
                title="Clear conversation"
                style={{
                  padding: "8px 12px",
                  borderRadius: "10px",
                  backgroundColor: "rgba(255, 255, 255, 0.05)",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  color: "rgba(255, 255, 255, 0.5)",
                  fontSize: "12px",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                Clear
              </button>
            )}

            <button
              onClick={() => handleSendMessage()}
              disabled={!inputQuery.trim() || isLoading}
              style={{
                padding: "8px 18px",
                borderRadius: "10px",
                backgroundColor: inputQuery.trim() && !isLoading ? "#0066cc" : "rgba(255, 255, 255, 0.08)",
                border: "none",
                color: inputQuery.trim() && !isLoading ? "#ffffff" : "rgba(255, 255, 255, 0.3)",
                fontSize: "13px",
                fontWeight: 600,
                cursor: inputQuery.trim() && !isLoading ? "pointer" : "default",
                transition: "all 0.2s ease",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <span>Ask</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"></line>
                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
              </svg>
            </button>
          </div>
        </div>
      </main>

      <Footer />

      <style jsx global>{`
        @keyframes pulse-dot {
          0%, 100% { opacity: 0.2; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1.2); }
        }
        .advisor-markdown-body h3 {
          font-size: 18px;
          font-weight: 700;
          color: #ffffff;
          margin: 18px 0 10px 0;
          letter-spacing: -0.3px;
        }
        .advisor-markdown-body h3:first-child {
          margin-top: 0;
        }
        .advisor-markdown-body h4 {
          font-size: 15px;
          font-weight: 600;
          color: #2997ff;
          margin: 14px 0 6px 0;
        }
        .advisor-markdown-body p {
          margin: 8px 0;
          color: rgba(255, 255, 255, 0.85);
        }
        .advisor-markdown-body ul, .advisor-markdown-body ol {
          margin: 8px 0 12px 20px;
          padding: 0;
        }
        .advisor-markdown-body li {
          margin: 4px 0;
          color: rgba(255, 255, 255, 0.8);
        }
        .advisor-markdown-body strong {
          color: #ffffff;
          font-weight: 600;
        }
        .advisor-markdown-body hr {
          border: none;
          height: 1px;
          background: rgba(255, 255, 255, 0.1);
          margin: 18px 0;
        }
        .advisor-markdown-body blockquote {
          border-left: 3px solid #ff9f0a;
          background: rgba(255, 159, 10, 0.08);
          padding: 8px 14px;
          margin: 10px 0;
          border-radius: 4px;
        }
      `}</style>
    </div>
  );
}

/**
 * Lightweight client-side Markdown formatter for clean HTML rendering
 */
function renderMarkdown(md: string): string {
  if (!md) return "";
  let html = md
    .replace(/^### (.*$)/gim, "<h3>$1</h3>")
    .replace(/^#### (.*$)/gim, "<h4>$1</h4>")
    .replace(/^> (.*$)/gim, "<blockquote>$1</blockquote>")
    .replace(/\*\*(.*?)\*\*/gim, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/gim, "<em>$1</em>")
    .replace(/^---$/gim, "<hr/>")
    .replace(/^\* (.*$)/gim, "<li>$1</li>")
    .replace(/^\d+\. (.*$)/gim, "<li>$1</li>");

  // Wrap loose <li> tags in <ul>
  html = html.replace(/(<li>[\s\S]*?<\/li>)/gim, "<ul>$1</ul>");
  // Clean up nested consecutive uls
  html = html.replace(/<\/ul>\s*<ul>/gim, "");

  // Convert double newlines into paragraphs
  const paragraphs = html.split(/\n\n+/);
  return paragraphs
    .map((p) => {
      const trimmed = p.trim();
      if (!trimmed) return "";
      if (
        trimmed.startsWith("<h") ||
        trimmed.startsWith("<ul") ||
        trimmed.startsWith("<ol") ||
        trimmed.startsWith("<blockquote") ||
        trimmed.startsWith("<hr")
      ) {
        return trimmed;
      }
      return `<p>${trimmed.replace(/\n/g, "<br/>")}</p>`;
    })
    .join("");
}
