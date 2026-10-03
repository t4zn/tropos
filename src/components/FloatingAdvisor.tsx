"use client";

import { useState, useRef, useEffect } from "react";
import { usePathname } from "next/navigation";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  provider?: string;
  suggestedFollowUps?: string[];
}

export default function FloatingAdvisor() {
  const pathname = usePathname();
  // Don't show the floating widget if the user is already on the dedicated /advisor page
  const isAdvisorPage = pathname === "/advisor";

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputQuery, setInputQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen, isLoading]);

  if (isAdvisorPage) return null;

  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || inputQuery).trim();
    if (!query || isLoading) return;

    const userMsg: Message = {
      id: "u-" + Date.now(),
      role: "user",
      content: query,
    };

    const newMsgs = [...messages, userMsg];
    setMessages(newMsgs);
    setInputQuery("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMsgs.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (!res.ok) throw new Error("API failed");
      const data = await res.json();

      setMessages((prev) => [
        ...prev,
        {
          id: "a-" + Date.now(),
          role: "assistant",
          content: data.response,
          provider: data.provider,
          suggestedFollowUps: data.suggestedFollowUps,
        },
      ]);
    } catch (err) {
      console.error(err);
      setMessages((prev) => [
        ...prev,
        {
          id: "err-" + Date.now(),
          role: "assistant",
          content: "⚠️ Atmospheric intelligence temporarily unavailable. Please try again.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const samplePrompt = "I am moving my asthmatic father from Indore (Scheme 78) to Delhi NCR. Best place to live?";

  return (
    <>
      {/* Floating Trigger Button (Bottom-Right) */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          style={{
            position: "fixed",
            bottom: "24px",
            right: "24px",
            zIndex: 999,
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "10px 18px",
            borderRadius: "9999px",
            backgroundColor: "rgba(18, 18, 22, 0.88)",
            color: "#ffffff",
            border: "1px solid rgba(41, 151, 255, 0.35)",
            backdropFilter: "blur(20px) saturate(180%)",
            boxShadow: "0 10px 32px rgba(0, 0, 0, 0.5), 0 0 16px rgba(41, 151, 255, 0.25)",
            cursor: "pointer",
            fontSize: "13px",
            fontWeight: 600,
            transition: "all 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "scale(1.04)";
            e.currentTarget.style.borderColor = "#2997ff";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "scale(1)";
            e.currentTarget.style.borderColor = "rgba(41, 151, 255, 0.35)";
          }}
        >
          <span
            style={{
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              backgroundColor: "#2997ff",
              boxShadow: "0 0 10px #2997ff",
            }}
          />
          <span>✦ Ask Tropos AI</span>
        </button>
      )}

      {/* Popover Glass Chat Drawer */}
      {isOpen && (
        <div
          style={{
            position: "fixed",
            bottom: "20px",
            right: "20px",
            width: "410px",
            maxWidth: "calc(100vw - 40px)",
            height: "580px",
            maxHeight: "calc(100vh - 60px)",
            backgroundColor: "rgba(14, 14, 18, 0.94)",
            backdropFilter: "blur(30px) saturate(190%)",
            border: "1px solid rgba(255, 255, 255, 0.15)",
            borderRadius: "20px",
            boxShadow: "0 24px 64px rgba(0, 0, 0, 0.7), 0 0 32px rgba(41, 151, 255, 0.15)",
            zIndex: 1000,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            animation: "slide-up 0.25s ease-out",
          }}
        >
          {/* Drawer Header */}
          <div
            style={{
              padding: "14px 18px",
              borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              backgroundColor: "rgba(255, 255, 255, 0.02)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span
                style={{
                  width: "7px",
                  height: "7px",
                  borderRadius: "50%",
                  backgroundColor: "#2997ff",
                  boxShadow: "0 0 8px #2997ff",
                }}
              />
              <span style={{ fontSize: "13px", fontWeight: 700, color: "#ffffff" }}>
                Tropos Citizen AI
              </span>
              <span
                style={{
                  fontSize: "10px",
                  backgroundColor: "rgba(41, 151, 255, 0.15)",
                  color: "#2997ff",
                  padding: "2px 6px",
                  borderRadius: "4px",
                  fontWeight: 600,
                }}
              >
                Intelligence Engine
              </span>
            </div>

            <button
              onClick={() => setIsOpen(false)}
              title="Close chat"
              style={{
                background: "transparent",
                border: "none",
                color: "rgba(255, 255, 255, 0.6)",
                cursor: "pointer",
                padding: "4px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: "6px",
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>

          {/* Message List */}
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "16px",
              display: "flex",
              flexDirection: "column",
              gap: "14px",
            }}
          >
            {messages.length === 0 && (
              <div style={{ textAlign: "center", padding: "20px 8px" }}>
                <div style={{ fontSize: "28px", marginBottom: "8px" }}>🌿</div>
                <div style={{ fontSize: "14px", fontWeight: 600, color: "#fff", marginBottom: "4px" }}>
                  Plain-Language Atmospheric Answers
                </div>
                <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.5)", lineHeight: 1.4, marginBottom: "16px" }}>
                  Ask about family relocation, asthma protection, or neighborhood air pollution.
                </p>

                <button
                  onClick={() => handleSendMessage(samplePrompt)}
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: "12px",
                    backgroundColor: "rgba(41, 151, 255, 0.08)",
                    border: "1px solid rgba(41, 151, 255, 0.25)",
                    color: "#ffffff",
                    fontSize: "12px",
                    textAlign: "left",
                    cursor: "pointer",
                    lineHeight: 1.4,
                  }}
                >
                  <span style={{ color: "#2997ff", fontWeight: 600 }}>Try this question:</span><br />
                  &ldquo;{samplePrompt}&rdquo;
                </button>
              </div>
            )}

            {messages.map((m) => (
              <div
                key={m.id}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: m.role === "user" ? "flex-end" : "flex-start",
                }}
              >
                <div
                  style={{
                    maxWidth: "88%",
                    backgroundColor: m.role === "user" ? "#0066cc" : "rgba(255, 255, 255, 0.05)",
                    border: m.role === "user" ? "none" : "1px solid rgba(255, 255, 255, 0.08)",
                    borderRadius: m.role === "user" ? "14px 14px 2px 14px" : "14px 14px 14px 2px",
                    padding: "10px 14px",
                    color: "#ffffff",
                    fontSize: "13px",
                    lineHeight: 1.5,
                  }}
                >
                  {m.role === "user" ? (
                    <div>{m.content}</div>
                  ) : (
                    <div
                      style={{ overflowWrap: "break-word" }}
                      dangerouslySetInnerHTML={{ __html: renderFloatingMarkdown(m.content) }}
                    />
                  )}
                </div>

                {m.suggestedFollowUps && m.suggestedFollowUps.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "8px" }}>
                    {m.suggestedFollowUps.slice(0, 2).map((chip, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSendMessage(chip)}
                        style={{
                          backgroundColor: "rgba(255, 255, 255, 0.04)",
                          border: "1px solid rgba(255, 255, 255, 0.1)",
                          borderRadius: "9999px",
                          padding: "4px 10px",
                          fontSize: "11px",
                          color: "rgba(255, 255, 255, 0.7)",
                          cursor: "pointer",
                        }}
                      >
                        {chip}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#2997ff", fontSize: "12px" }}>
                <span style={{ animation: "pulse 1s infinite" }}>●</span>
                <span>Synthesizing air quality & clinical microclimates…</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Box */}
          <div
            style={{
              padding: "12px",
              borderTop: "1px solid rgba(255, 255, 255, 0.08)",
              backgroundColor: "rgba(20, 20, 24, 0.8)",
              display: "flex",
              gap: "8px",
            }}
          >
            <input
              type="text"
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
              placeholder="Ask a question..."
              style={{
                flex: 1,
                backgroundColor: "rgba(255, 255, 255, 0.06)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                borderRadius: "10px",
                padding: "8px 12px",
                color: "#ffffff",
                fontSize: "13px",
                outline: "none",
              }}
            />
            <button
              onClick={() => handleSendMessage()}
              disabled={!inputQuery.trim() || isLoading}
              style={{
                padding: "8px 14px",
                borderRadius: "10px",
                backgroundColor: inputQuery.trim() && !isLoading ? "#0066cc" : "rgba(255, 255, 255, 0.08)",
                border: "none",
                color: "#ffffff",
                fontSize: "12px",
                fontWeight: 600,
                cursor: inputQuery.trim() && !isLoading ? "pointer" : "default",
              }}
            >
              Send
            </button>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes slide-up {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  );
}

function renderFloatingMarkdown(md: string): string {
  if (!md) return "";
  return md
    .replace(/^### (.*$)/gim, '<div style="font-weight:700;margin:6px 0 3px;color:#fff;">$1</div>')
    .replace(/^#### (.*$)/gim, '<div style="font-weight:600;margin:4px 0 2px;color:#2997ff;">$1</div>')
    .replace(/\*\*(.*?)\*\*/gim, "<strong>$1</strong>")
    .replace(/^---$/gim, '<hr style="border:none;height:1px;background:rgba(255,255,255,0.1);margin:8px 0;"/>')
    .replace(/^\* (.*$)/gim, "• $1<br/>")
    .replace(/\n/g, "<br/>");
}
