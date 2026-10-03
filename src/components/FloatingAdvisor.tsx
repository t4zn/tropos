"use client";

import React, { useState, useRef, useEffect } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import ChatMarkdown from "@/components/ChatMarkdown";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  provider?: string;
  suggestedFollowUps?: string[];
  timestamp: string;
}

export default function FloatingAdvisor() {
  const pathname = usePathname();
  // Don't show the floating widget if the user is already on the dedicated /advisor page
  const isAdvisorPage = pathname === "/advisor";

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputQuery, setInputQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen, isLoading, streamingMessageId]);

  if (isAdvisorPage) return null;

  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || inputQuery).trim();
    if (!query || isLoading) return;

    setInputQuery("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    const userMsg: Message = {
      id: "u-" + Date.now(),
      role: "user",
      content: query,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    const newMsgs = [...messages, userMsg];
    const assistantId = "a-" + Date.now();
    const placeholderAssistant: Message = {
      id: assistantId,
      role: "assistant",
      content: "",
      provider: "Connecting...",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages([...newMsgs, placeholderAssistant]);
    setIsLoading(true);
    setStreamingMessageId(assistantId);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMsgs.map((m) => ({ role: m.role, content: m.content })),
          stream: true,
        }),
        signal: controller.signal,
      });

      if (!res.ok) throw new Error("API failed");

      if (res.body) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let accumulated = "";
        let finalProvider = "Exur Intelligence Engine";
        let finalFollowUps: string[] = [];

        let buffer = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith("data: ")) {
              try {
                const data = JSON.parse(trimmed.slice(6));
                if (data.token) {
                  accumulated += data.token;
                  setMessages((prev) =>
                    prev.map((m) => (m.id === assistantId ? { ...m, content: accumulated } : m))
                  );
                }
                if (data.done) {
                  if (data.provider) finalProvider = data.provider;
                  if (data.suggestedFollowUps) finalFollowUps = data.suggestedFollowUps;
                }
              } catch {
                // ignore
              }
            }
          }
        }

        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  content: accumulated || "No response received.",
                  provider: finalProvider,
                  suggestedFollowUps: finalFollowUps,
                }
              : m
          )
        );
      }
    } catch (err: any) {
      if (err.name === "AbortError") {
        console.log("Floating stream aborted.");
      } else {
        console.error(err);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  content: "⚠️ Atmospheric intelligence temporarily unavailable. Please try again.",
                }
              : m
          )
        );
      }
    } finally {
      setIsLoading(false);
      setStreamingMessageId(null);
      abortControllerRef.current = null;
    }
  };

  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsLoading(false);
    setStreamingMessageId(null);
  };

  const samplePrompt =
    "I am moving my asthmatic father from Indore (Scheme 78) to Delhi NCR. Best place to live?";

  return (
    <>
      {/* ─── Floating Trigger Button (Bottom-Right Apple Capsule) ───────────── */}
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
            gap: "10px",
            padding: "10px 18px",
            borderRadius: "9999px",
            backgroundColor: "rgba(18, 18, 22, 0.9)",
            color: "#ffffff",
            border: "1px solid rgba(255, 255, 255, 0.16)",
            backdropFilter: "blur(24px) saturate(180%)",
            WebkitBackdropFilter: "blur(24px) saturate(180%)",
            boxShadow:
              "0 12px 36px rgba(0, 0, 0, 0.55), 0 0 20px rgba(41, 151, 255, 0.28)",
            cursor: "pointer",
            fontSize: "13px",
            fontWeight: 600,
            transition: "all 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "scale(1.04)";
            e.currentTarget.style.borderColor = "rgba(41, 151, 255, 0.6)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "scale(1)";
            e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.16)";
          }}
        >
          {/* Apple Intelligence Aura Glyph */}
          <div
            style={{
              width: "18px",
              height: "18px",
              borderRadius: "50%",
              background:
                "conic-gradient(from 180deg, #00f2fe, #4facfe, #0071e3, #f093fb, #00f2fe)",
              boxShadow: "0 0 10px rgba(41, 151, 255, 0.5)",
            }}
          />
          <span>✦ Exur</span>
        </button>
      )}

      {/* ─── Apple Popover Floating Glass Window (ChatGPT Experience) ─────────── */}
      {isOpen && (
        <div
          style={{
            position: "fixed",
            bottom: "20px",
            right: "20px",
            width: "440px",
            maxWidth: "calc(100vw - 32px)",
            height: "620px",
            maxHeight: "calc(100vh - 40px)",
            backgroundColor: "rgba(18, 18, 22, 0.95)",
            backdropFilter: "blur(32px) saturate(200%)",
            WebkitBackdropFilter: "blur(32px) saturate(200%)",
            border: "1px solid rgba(255, 255, 255, 0.16)",
            borderRadius: "24px",
            boxShadow:
              "0 28px 72px rgba(0, 0, 0, 0.75), 0 0 36px rgba(41, 151, 255, 0.16)",
            zIndex: 1000,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            animation: "fadeIn 0.25s ease-out",
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
            <div style={{ display: "flex", alignItems: "center", gap: "9px" }}>
              <div
                style={{
                  width: "16px",
                  height: "16px",
                  borderRadius: "50%",
                  background:
                    "conic-gradient(from 180deg, #00f2fe, #4facfe, #0071e3, #f093fb, #00f2fe)",
                }}
              />
              <span style={{ fontSize: "14px", fontWeight: 650, color: "#ffffff" }}>
                Exur
              </span>
              <span
                style={{
                  fontSize: "10px",
                  backgroundColor: "rgba(41, 151, 255, 0.15)",
                  color: "#2997ff",
                  padding: "2px 7px",
                  borderRadius: "999px",
                  fontWeight: 600,
                }}
              >
                LPU Live
              </span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              {/* Fullscreen Advisor Link */}
              <Link
                href="/advisor"
                title="Open Fullscreen ChatGPT Mode"
                style={{
                  color: "rgba(255, 255, 255, 0.6)",
                  textDecoration: "none",
                  fontSize: "12px",
                  padding: "4px 8px",
                  borderRadius: "6px",
                  backgroundColor: "rgba(255, 255, 255, 0.05)",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                <span>↗ Fullscreen</span>
              </Link>

              {/* Close Button */}
              <button
                onClick={() => setIsOpen(false)}
                title="Close"
                style={{
                  background: "transparent",
                  border: "none",
                  color: "rgba(255, 255, 255, 0.5)",
                  cursor: "pointer",
                  padding: "4px",
                  fontSize: "14px",
                }}
              >
                ✕
              </button>
            </div>
          </div>

          {/* Messages Stream */}
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "16px",
              display: "flex",
              flexDirection: "column",
              gap: "16px",
            }}
          >
            {messages.length === 0 && (
              <div style={{ textAlign: "center", padding: "28px 12px" }}>
                <div
                  style={{
                    width: "44px",
                    height: "44px",
                    borderRadius: "50%",
                    background:
                      "conic-gradient(from 180deg, #00f2fe, #4facfe, #0071e3, #f093fb, #00f2fe)",
                    boxShadow: "0 0 20px rgba(41, 151, 255, 0.4)",
                    margin: "0 auto 16px auto",
                  }}
                />
                <div
                  style={{
                    fontSize: "15px",
                    fontWeight: 650,
                    color: "#ffffff",
                    marginBottom: "6px",
                  }}
                >
                  Atmospheric Intelligence
                </div>
                <p
                  style={{
                    fontSize: "13px",
                    color: "rgba(255, 255, 255, 0.55)",
                    lineHeight: 1.45,
                    marginBottom: "20px",
                  }}
                >
                  Ask about family relocation, asthma protection, or neighborhood air pollution.
                </p>

                <button
                  onClick={() => handleSendMessage(samplePrompt)}
                  style={{
                    width: "100%",
                    backgroundColor: "rgba(41, 151, 255, 0.08)",
                    border: "1px solid rgba(41, 151, 255, 0.25)",
                    borderRadius: "14px",
                    padding: "12px 14px",
                    textAlign: "left",
                    color: "rgba(255, 255, 255, 0.9)",
                    fontSize: "12px",
                    cursor: "pointer",
                    lineHeight: 1.4,
                  }}
                >
                  <div style={{ fontWeight: 600, color: "#2997ff", marginBottom: "4px" }}>
                    Try Popular Query:
                  </div>
                  "{samplePrompt}" &rarr;
                </button>
              </div>
            )}

            {messages.map((m) => {
              const isUser = m.role === "user";
              const isStreamingThis = m.id === streamingMessageId;

              return (
                <div
                  key={m.id}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: isUser ? "flex-end" : "flex-start",
                    width: "100%",
                  }}
                >
                  {isUser ? (
                    <div
                      style={{
                        maxWidth: "85%",
                        backgroundColor: "rgba(255, 255, 255, 0.1)",
                        border: "1px solid rgba(255, 255, 255, 0.12)",
                        borderRadius: "18px 18px 4px 18px",
                        padding: "10px 14px",
                        fontSize: "14px",
                        color: "#ffffff",
                        lineHeight: 1.45,
                        wordBreak: "break-word",
                      }}
                    >
                      {m.content}
                    </div>
                  ) : (
                    <div style={{ width: "100%" }}>
                      <div
                        style={{
                          fontSize: "11px",
                          color: "rgba(255, 255, 255, 0.4)",
                          marginBottom: "4px",
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                        }}
                      >
                        <span style={{ color: "#2997ff", fontWeight: 600 }}>Exur</span>
                        <span>&bull;</span>
                        <span>{m.timestamp}</span>
                      </div>

                      <ChatMarkdown content={m.content} isStreaming={isStreamingThis} />

                      {/* Follow-up chips */}
                      {!isStreamingThis &&
                        m.suggestedFollowUps &&
                        m.suggestedFollowUps.length > 0 && (
                          <div
                            style={{
                              display: "flex",
                              flexWrap: "wrap",
                              gap: "6px",
                              marginTop: "10px",
                            }}
                          >
                            {m.suggestedFollowUps.slice(0, 2).map((fu, fIdx) => (
                              <button
                                key={fIdx}
                                onClick={() => handleSendMessage(fu)}
                                style={{
                                  backgroundColor: "rgba(41, 151, 255, 0.08)",
                                  border: "1px solid rgba(41, 151, 255, 0.2)",
                                  borderRadius: "12px",
                                  padding: "4px 10px",
                                  fontSize: "11px",
                                  color: "rgba(255, 255, 255, 0.85)",
                                  cursor: "pointer",
                                  textAlign: "left",
                                }}
                              >
                                {fu} &rarr;
                              </button>
                            ))}
                          </div>
                        )}
                    </div>
                  )}
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Capsule Dock */}
          <div
            style={{
              padding: "12px 14px 14px",
              borderTop: "1px solid rgba(255, 255, 255, 0.08)",
              backgroundColor: "rgba(14, 14, 18, 0.9)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "flex-end",
                gap: "8px",
                backgroundColor: "rgba(255, 255, 255, 0.06)",
                border: "1px solid rgba(255, 255, 255, 0.12)",
                borderRadius: "20px",
                padding: "6px 8px 6px 14px",
              }}
            >
              <textarea
                ref={textareaRef}
                rows={1}
                value={inputQuery}
                onChange={(e) => setInputQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                placeholder="Ask Exur..."
                style={{
                  flex: 1,
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  color: "#ffffff",
                  fontSize: "14px",
                  lineHeight: 1.4,
                  maxHeight: "120px",
                  resize: "none",
                  padding: "5px 0",
                  fontFamily: "inherit",
                }}
              />

              {isLoading ? (
                <button
                  onClick={handleStopGeneration}
                  title="Stop"
                  style={{
                    width: "30px",
                    height: "30px",
                    borderRadius: "50%",
                    backgroundColor: "#ffffff",
                    border: "none",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                  }}
                >
                  <div
                    style={{
                      width: "10px",
                      height: "10px",
                      backgroundColor: "#0d0d0f",
                      borderRadius: "2px",
                    }}
                  />
                </button>
              ) : (
                <button
                  onClick={() => handleSendMessage()}
                  disabled={!inputQuery.trim()}
                  title="Send"
                  style={{
                    width: "30px",
                    height: "30px",
                    borderRadius: "50%",
                    backgroundColor: inputQuery.trim() ? "#0071e3" : "rgba(255, 255, 255, 0.1)",
                    border: "none",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: inputQuery.trim() ? "pointer" : "default",
                    color: "#ffffff",
                    fontSize: "14px",
                    fontWeight: 700,
                  }}
                >
                  &uarr;
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
