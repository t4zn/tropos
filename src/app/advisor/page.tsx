"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
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

interface ChatSession {
  id: string;
  title: string;
  createdAt: number;
  messages: Message[];
}

const PRESET_TILES = [
  {
    category: "Asthma & Relocation",
    title: "Indore (LIC Tower / Scheme 78) ➔ Delhi NCR with Asthma",
    prompt:
      "I am attending Hacktoberfest at Walkover, LIC Tower Indore. I am thinking of shifting my parents to Delhi NCR, but my father has chronic asthma. Using Gemma 4 atmospheric models and CPCB stations, which microclimate sector is safest?",
    icon: "📍",
  },
  {
    category: "Microclimate Safety",
    title: "Cleanest Sectors in Noida / Greater Noida",
    prompt:
      "Which sectors in Noida or Greater Noida have the cleanest air, lowest industrial smokestack pollution, and maximum green buffer?",
    icon: "🍃",
  },
  {
    category: "Smog Physics",
    title: "Why are Anand Vihar & Mundka so hazardous?",
    prompt:
      "Explain the meteorological and emissions reasons why Anand Vihar and Mundka consistently exceed 400 AQI compared to South Delhi or Greater Noida.",
    icon: "🏭",
  },
  {
    category: "Health Defense",
    title: "HEPA Purifier & CADR Sizing Specs",
    prompt:
      "What specific CADR rating and true HEPA filter should I buy for an elderly asthma patient in Delhi NCR, and why must ionizers and ozone generators be avoided?",
    icon: "🛡️",
  },
];

const LOCAL_STORAGE_KEY = "exur_advisor_sessions_v2";

const DEFAULT_SESSION: ChatSession = {
  id: "session-init",
  title: "New Conversation",
  createdAt: 0,
  messages: [],
};

export default function AdvisorPage() {
  // Chat Sessions & History (ChatGPT style)
  const [sessions, setSessions] = useState<ChatSession[]>([DEFAULT_SESSION]);
  const [currentSessionId, setCurrentSessionId] = useState<string>(DEFAULT_SESSION.id);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [searchHistoryQuery, setSearchHistoryQuery] = useState("");

  // Input & Streaming State
  const [inputQuery, setInputQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<"auto" | "gemma" | "groq">("gemma");
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);

  // Audio / Speech Synthesis state
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);

  // Copy feedback state
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Abort controller ref for stopping generation
  const abortControllerRef = useRef<AbortController | null>(null);

  // DOM Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ─── Initialize Sessions from LocalStorage ──────────────────────────────────
  useEffect(() => {
    try {
      const stored =
        localStorage.getItem(LOCAL_STORAGE_KEY) ||
        localStorage.getItem("tropos_advisor_sessions_v2");
      if (stored) {
        const parsed: ChatSession[] = JSON.parse(stored);
        if (parsed.length > 0) {
          setSessions(parsed);
          setCurrentSessionId(parsed[0].id);
          return;
        }
      }
    } catch (e) {
      console.warn("Failed to load past sessions", e);
    }

    // Default new session if none exists
    const initialSession: ChatSession = {
      id: "session-" + Date.now(),
      title: "New Conversation",
      createdAt: Date.now(),
      messages: [],
    };
    setSessions([initialSession]);
    setCurrentSessionId(initialSession.id);
  }, []);

  // Save sessions to LocalStorage on updates
  useEffect(() => {
    if (sessions.length > 0) {
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(sessions));
      } catch (e) {
        console.warn("Failed to save sessions to localStorage", e);
      }
    }
  }, [sessions]);

  // Active session
  const currentSession =
    sessions.find((s) => s.id === currentSessionId) || sessions[0] || DEFAULT_SESSION;
  const messages = currentSession?.messages || [];

  // Auto-scroll to bottom smoothly
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading, streamingMessageId]);

  // Auto-resize textarea
  const handleTextareaInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputQuery(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 180) + "px";
    }
  };

  // Keyboard shortcut listener (Cmd+N for new chat, Cmd+S for sidebar)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        handleCreateNewChat();
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        setIsSidebarOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // ─── Chat Session Management ───────────────────────────────────────────────
  const handleCreateNewChat = () => {
    // If current session is already empty, just focus
    if (currentSession && currentSession.messages.length === 0) {
      textareaRef.current?.focus();
      return;
    }
    const newSession: ChatSession = {
      id: "session-" + Date.now(),
      title: "New Conversation",
      createdAt: Date.now(),
      messages: [],
    };
    setSessions((prev) => [newSession, ...prev]);
    setCurrentSessionId(newSession.id);
    setInputQuery("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.focus();
    }
  };

  const handleDeleteSession = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const remaining = sessions.filter((s) => s.id !== sessionId);
    if (remaining.length === 0) {
      const fresh: ChatSession = {
        id: "session-" + Date.now(),
        title: "New Conversation",
        createdAt: Date.now(),
        messages: [],
      };
      setSessions([fresh]);
      setCurrentSessionId(fresh.id);
    } else {
      setSessions(remaining);
      if (currentSessionId === sessionId) {
        setCurrentSessionId(remaining[0].id);
      }
    }
  };

  // ─── Sending & Streaming Messages ──────────────────────────────────────────
  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || inputQuery).trim();
    if (!query || isLoading) return;

    // Reset textarea height
    setInputQuery("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    const userMessage: Message = {
      id: "user-" + Date.now(),
      role: "user",
      content: query,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    // Auto-generate session title from first user query
    let updatedTitle = currentSession?.title || "New Conversation";
    if (messages.length === 0 || updatedTitle === "New Conversation") {
      updatedTitle = query.slice(0, 32) + (query.length > 32 ? "..." : "");
    }

    const updatedMessages = [...messages, userMessage];

    // Placeholder assistant message for streaming
    const assistantId = "assistant-" + Date.now();
    const initialAssistantMessage: Message = {
      id: assistantId,
      role: "assistant",
      content: "",
      provider: "Connecting...",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    // Update session state
    setSessions((prev) =>
      prev.map((s) =>
        s.id === currentSessionId
          ? {
              ...s,
              title: updatedTitle,
              messages: [...updatedMessages, initialAssistantMessage],
            }
          : s
      )
    );

    setIsLoading(true);
    setStreamingMessageId(assistantId);

    // Setup AbortController
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: updatedMessages.map((m) => ({ role: m.role, content: m.content })),
          stream: true,
          modelPreference: selectedModel,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error("HTTP error " + response.status);
      }

      // Read Server-Sent Events stream
      if (response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let accumulatedText = "";
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
                  accumulatedText += data.token;
                  // Update current message content
                  setSessions((prev) =>
                    prev.map((s) =>
                      s.id === currentSessionId
                        ? {
                            ...s,
                            messages: s.messages.map((m) =>
                              m.id === assistantId ? { ...m, content: accumulatedText } : m
                            ),
                          }
                        : s
                    )
                  );
                }
                if (data.done) {
                  if (data.provider) finalProvider = data.provider;
                  if (data.suggestedFollowUps) finalFollowUps = data.suggestedFollowUps;
                }
              } catch {
                // ignore parsing edge cases
              }
            }
          }
        }

        // Finalize message with metadata
        setSessions((prev) =>
          prev.map((s) =>
            s.id === currentSessionId
              ? {
                  ...s,
                  messages: s.messages.map((m) =>
                    m.id === assistantId
                      ? {
                          ...m,
                          content: accumulatedText || "No response received.",
                          provider: finalProvider,
                          suggestedFollowUps: finalFollowUps,
                        }
                      : m
                  ),
                }
              : s
          )
        );
      }
    } catch (err: any) {
      if (err.name === "AbortError") {
        console.log("Stream generation stopped by user.");
      } else {
        console.error("Chat error:", err);
        setSessions((prev) =>
          prev.map((s) =>
            s.id === currentSessionId
              ? {
                  ...s,
                  messages: s.messages.map((m) =>
                    m.id === assistantId
                      ? {
                          ...m,
                          content:
                            m.content ||
                            "⚠️ Could not complete response. Please check your connection or choose another model.",
                        }
                      : m
                  ),
                }
              : s
          )
        );
      }
    } finally {
      setIsLoading(false);
      setStreamingMessageId(null);
      abortControllerRef.current = null;
      textareaRef.current?.focus();
    }
  };

  // Stop Generation
  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsLoading(false);
    setStreamingMessageId(null);
  };

  // Regenerate Response
  const handleRegenerate = (index: number) => {
    if (isLoading) return;
    const lastUserMessage = [...messages.slice(0, index)]
      .reverse()
      .find((m) => m.role === "user");
    if (lastUserMessage) {
      handleSendMessage(lastUserMessage.content);
    }
  };

  // Copy full message
  const handleCopyMessage = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Text to Speech
  const handleSpeak = (id: string, text: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

    if (speakingMessageId === id) {
      window.speechSynthesis.cancel();
      setSpeakingMessageId(null);
      return;
    }

    window.speechSynthesis.cancel();
    // Clean markdown before speaking
    const cleanText = text
      .replace(/#+\s+/g, "")
      .replace(/\*\*/g, "")
      .replace(/`+/g, "")
      .replace(/\|/g, " ");

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1.05;
    utterance.pitch = 1.0;
    utterance.onend = () => setSpeakingMessageId(null);
    utterance.onerror = () => setSpeakingMessageId(null);

    setSpeakingMessageId(id);
    window.speechSynthesis.speak(utterance);
  };

  // Filtered session list
  const filteredSessions = sessions.filter((s) =>
    s.title.toLowerCase().includes(searchHistoryQuery.toLowerCase())
  );

  return (
    <div
      style={{
        display: "flex",
        height: "100vh",
        width: "100vw",
        overflow: "hidden",
        backgroundColor: "#0d0d0f",
        color: "#ffffff",
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', sans-serif",
      }}
    >
      {/* ───────────────────────────────────────────────────────────────────────
          APPLE SEQUOIA / CHATGPT SIDEBAR
          ─────────────────────────────────────────────────────────────────────── */}
      <aside
        style={{
          width: isSidebarOpen ? "260px" : "0px",
          minWidth: isSidebarOpen ? "260px" : "0px",
          height: "100%",
          backgroundColor: "rgba(18, 18, 22, 0.95)",
          backdropFilter: "blur(30px)",
          WebkitBackdropFilter: "blur(30px)",
          borderRight: "1px solid rgba(255, 255, 255, 0.08)",
          display: "flex",
          flexDirection: "column",
          transition: "all 0.28s cubic-bezier(0.16, 1, 0.3, 1)",
          overflow: "hidden",
          zIndex: 40,
        }}
      >
        {/* Sidebar Header & New Chat Button */}
        <div style={{ padding: "16px 14px 10px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "12px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              {/* Apple Intelligence Aura Glyph */}
              <div
                style={{
                  width: "22px",
                  height: "22px",
                  borderRadius: "50%",
                  background:
                    "conic-gradient(from 180deg, #00f2fe, #4facfe, #0071e3, #f093fb, #00f2fe)",
                  boxShadow: "0 0 12px rgba(41, 151, 255, 0.4)",
                }}
              />
              <span style={{ fontSize: "14px", fontWeight: 650, letterSpacing: "-0.2px" }}>
                Exur Advisor
              </span>
            </div>

            <button
              onClick={() => setIsSidebarOpen(false)}
              title="Close Sidebar (⌘B)"
              style={{
                background: "none",
                border: "none",
                color: "rgba(255, 255, 255, 0.5)",
                cursor: "pointer",
                padding: "6px",
                borderRadius: "6px",
                display: "flex",
                alignItems: "center",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#ffffff")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255, 255, 255, 0.5)")}
            >
              <SidebarIcon />
            </button>
          </div>

          {/* "+ New chat" Apple Pill */}
          <button
            onClick={handleCreateNewChat}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "10px 14px",
              backgroundColor: "rgba(255, 255, 255, 0.08)",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              borderRadius: "10px",
              color: "#ffffff",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.14)";
              e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.22)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.08)";
              e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.12)";
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "16px" }}>+</span>
              <span>New chat</span>
            </div>
            <span
              style={{
                fontSize: "11px",
                color: "rgba(255, 255, 255, 0.4)",
                padding: "2px 6px",
                borderRadius: "4px",
                backgroundColor: "rgba(255, 255, 255, 0.06)",
              }}
            >
              ⌘K
            </span>
          </button>
        </div>

        {/* Search Past Chats */}
        <div style={{ padding: "0 14px 10px" }}>
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchHistoryQuery}
            onChange={(e) => setSearchHistoryQuery(e.target.value)}
            style={{
              width: "100%",
              backgroundColor: "rgba(255, 255, 255, 0.04)",
              border: "1px solid rgba(255, 255, 255, 0.06)",
              borderRadius: "8px",
              padding: "7px 10px",
              fontSize: "12px",
              color: "#ffffff",
              outline: "none",
            }}
          />
        </div>

        {/* Sessions List */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "0 10px 14px",
            display: "flex",
            flexDirection: "column",
            gap: "2px",
          }}
        >
          <div
            style={{
              fontSize: "11px",
              fontWeight: 650,
              color: "rgba(255, 255, 255, 0.35)",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
              padding: "8px 10px 4px",
            }}
          >
            Recent Chats
          </div>

          {filteredSessions.map((s) => {
            const isActive = s.id === currentSessionId;
            return (
              <div
                key={s.id}
                onClick={() => setCurrentSessionId(s.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "9px 12px",
                  borderRadius: "8px",
                  cursor: "pointer",
                  backgroundColor: isActive ? "rgba(41, 151, 255, 0.14)" : "transparent",
                  border: isActive
                    ? "1px solid rgba(41, 151, 255, 0.3)"
                    : "1px solid transparent",
                  transition: "all 0.15s ease",
                  position: "relative",
                }}
                onMouseEnter={(e) => {
                  if (!isActive) e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.04)";
                }}
                onMouseLeave={(e) => {
                  if (!isActive) e.currentTarget.style.backgroundColor = "transparent";
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "9px",
                    overflow: "hidden",
                    flex: 1,
                  }}
                >
                  <span style={{ fontSize: "14px", opacity: isActive ? 1 : 0.6 }}>💬</span>
                  <span
                    style={{
                      fontSize: "13px",
                      color: isActive ? "#ffffff" : "rgba(255, 255, 255, 0.75)",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      fontWeight: isActive ? 600 : 400,
                    }}
                  >
                    {s.title}
                  </span>
                </div>

                {/* Delete button */}
                <button
                  onClick={(e) => handleDeleteSession(s.id, e)}
                  title="Delete chat"
                  style={{
                    background: "none",
                    border: "none",
                    color: "rgba(255, 255, 255, 0.35)",
                    cursor: "pointer",
                    fontSize: "13px",
                    padding: "2px 4px",
                    borderRadius: "4px",
                    marginLeft: "4px",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "#ff453a")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255, 255, 255, 0.35)")}
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>

        {/* Sidebar Footer */}
        <div
          style={{
            padding: "14px",
            borderTop: "1px solid rgba(255, 255, 255, 0.08)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: "12px",
            color: "rgba(255, 255, 255, 0.45)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span
              style={{
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                backgroundColor: "#30d158",
                boxShadow: "0 0 8px #30d158",
              }}
            />
            <span>ISRO 74°E &bull; Neural LPU</span>
          </div>

          <Link
            href="/corridor"
            style={{
              color: "#2997ff",
              textDecoration: "none",
              fontSize: "11px",
              fontWeight: 600,
            }}
          >
            Corridor &rarr;
          </Link>
        </div>
      </aside>

      {/* ───────────────────────────────────────────────────────────────────────
          MAIN WORKSPACE
          ─────────────────────────────────────────────────────────────────────── */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          height: "100%",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Top Header Bar (Frosted Glass) */}
        <header
          style={{
            height: "52px",
            borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 18px",
            backgroundColor: "rgba(13, 13, 15, 0.8)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            zIndex: 30,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            {!isSidebarOpen && (
              <button
                onClick={() => setIsSidebarOpen(true)}
                title="Open Sidebar (⌘B)"
                style={{
                  background: "none",
                  border: "none",
                  color: "rgba(255, 255, 255, 0.7)",
                  cursor: "pointer",
                  padding: "6px",
                  borderRadius: "6px",
                  display: "flex",
                  alignItems: "center",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#ffffff")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255, 255, 255, 0.7)")}
              >
                <SidebarIcon />
              </button>
            )}

            {/* Apple Model Selector Dropdown */}
            <div style={{ position: "relative" }}>
              <button
                onClick={() => setModelDropdownOpen((prev) => !prev)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "7px",
                  backgroundColor: "rgba(255, 255, 255, 0.06)",
                  border: "1px solid rgba(255, 255, 255, 0.12)",
                  borderRadius: "8px",
                  padding: "6px 12px",
                  color: "#ffffff",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                <span
                  style={{
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    background:
                      selectedModel === "gemma"
                        ? "#2997ff"
                        : selectedModel === "groq"
                        ? "#f59e0b"
                        : "#30d158",
                  }}
                />
                <span>
                  {selectedModel === "gemma"
                    ? "Google Gemma 4 (26B IT)"
                    : selectedModel === "groq"
                    ? "Exur LPU (Groq Accelerated)"
                    : "Exur Intelligence (Auto)"}
                </span>
                <span style={{ fontSize: "10px", opacity: 0.6 }}>▼</span>
              </button>

              {modelDropdownOpen && (
                <div
                  style={{
                    position: "absolute",
                    top: "115%",
                    left: 0,
                    width: "250px",
                    backgroundColor: "#1c1c20",
                    border: "1px solid rgba(255, 255, 255, 0.14)",
                    borderRadius: "12px",
                    boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
                    padding: "6px",
                    zIndex: 50,
                  }}
                >
                  <div
                    onClick={() => {
                      setSelectedModel("gemma");
                      setModelDropdownOpen(false);
                    }}
                    style={{
                      padding: "8px 10px",
                      borderRadius: "6px",
                      cursor: "pointer",
                      fontSize: "12px",
                      backgroundColor: selectedModel === "gemma" ? "rgba(41, 151, 255, 0.15)" : "transparent",
                      color: "#ffffff",
                    }}
                  >
                    <div style={{ fontWeight: 600 }}>💎 Google Gemma 4 (26B Open Weights)</div>
                    <div style={{ fontSize: "11px", color: "rgba(255, 255, 255, 0.5)" }}>
                      Deep reasoning with official Gemma 4 weights
                    </div>
                  </div>

                  <div
                    onClick={() => {
                      setSelectedModel("auto");
                      setModelDropdownOpen(false);
                    }}
                    style={{
                      padding: "8px 10px",
                      borderRadius: "6px",
                      cursor: "pointer",
                      fontSize: "12px",
                      backgroundColor: selectedModel === "auto" ? "rgba(41, 151, 255, 0.15)" : "transparent",
                      color: "#ffffff",
                    }}
                  >
                    <div style={{ fontWeight: 600 }}>✦ Exur Intelligence (Auto)</div>
                    <div style={{ fontSize: "11px", color: "rgba(255, 255, 255, 0.5)" }}>
                      Gemma 4 with sub-second LPU acceleration
                    </div>
                  </div>

                  <div
                    onClick={() => {
                      setSelectedModel("groq");
                      setModelDropdownOpen(false);
                    }}
                    style={{
                      padding: "8px 10px",
                      borderRadius: "6px",
                      cursor: "pointer",
                      fontSize: "12px",
                      backgroundColor: selectedModel === "groq" ? "rgba(41, 151, 255, 0.15)" : "transparent",
                      color: "#ffffff",
                    }}
                  >
                    <div style={{ fontWeight: 600 }}>⚡ Groq LPU (Qwen 3.8 27B)</div>
                    <div style={{ fontSize: "11px", color: "rgba(255, 255, 255, 0.5)" }}>
                      Ultra-low latency streaming inference
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Title */}
            <span
              style={{
                fontSize: "13px",
                color: "rgba(255, 255, 255, 0.5)",
                maxWidth: "280px",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {currentSession?.title || "New Conversation"}
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <button
              onClick={handleCreateNewChat}
              style={{
                background: "none",
                border: "none",
                color: "rgba(255, 255, 255, 0.7)",
                cursor: "pointer",
                padding: "6px 10px",
                borderRadius: "6px",
                fontSize: "12px",
                display: "flex",
                alignItems: "center",
                gap: "4px",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#ffffff")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255, 255, 255, 0.7)")}
            >
              <span>+ New</span>
            </button>

            <Link
              href="/"
              style={{
                fontSize: "12px",
                color: "rgba(255, 255, 255, 0.6)",
                textDecoration: "none",
                padding: "6px 10px",
                borderRadius: "6px",
                backgroundColor: "rgba(255, 255, 255, 0.05)",
              }}
            >
              Exit &larr;
            </Link>
          </div>
        </header>

        {/* ─────────────────────────────────────────────────────────────────────
            SCROLLABLE MESSAGES CONTAINER
            ───────────────────────────────────────────────────────────────────── */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            padding: "24px 20px 140px",
          }}
        >
          <div style={{ width: "100%", maxWidth: "780px" }}>
            {/* ─── Empty State: Apple Intelligence Welcome Screen ────────────── */}
            {messages.length === 0 && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  minHeight: "56vh",
                  textAlign: "center",
                  animation: "fadeIn 0.4s ease",
                }}
              >
                {/* Glowing Apple Intelligence Aura Ring */}
                <div
                  style={{
                    position: "relative",
                    width: "64px",
                    height: "64px",
                    marginBottom: "24px",
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      borderRadius: "50%",
                      background:
                        "conic-gradient(from 180deg, #00f2fe, #4facfe, #0071e3, #f093fb, #00f2fe)",
                      filter: "blur(14px)",
                      opacity: 0.65,
                      animation: "exurRotate 8s linear infinite",
                    }}
                  />
                  <div
                    style={{
                      position: "relative",
                      width: "100%",
                      height: "100%",
                      borderRadius: "50%",
                      background:
                        "conic-gradient(from 180deg, #00f2fe, #4facfe, #0071e3, #f093fb, #00f2fe)",
                      boxShadow: "0 0 30px rgba(41, 151, 255, 0.5)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <div
                      style={{
                        width: "36px",
                        height: "36px",
                        borderRadius: "50%",
                        backgroundColor: "#0d0d0f",
                      }}
                    />
                  </div>
                </div>

                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "4px 12px",
                    borderRadius: "999px",
                    backgroundColor: "rgba(41, 151, 255, 0.1)",
                    border: "1px solid rgba(41, 151, 255, 0.25)",
                    fontSize: "11px",
                    fontWeight: 650,
                    color: "#2997ff",
                    letterSpacing: "0.4px",
                    textTransform: "uppercase",
                    marginBottom: "16px",
                  }}
                >
                  <span>✦</span>
                  <span>Hacktoberfest Indore &bull; Gemma 4 Challenge</span>
                </div>

                <h1
                  style={{
                    fontSize: "clamp(26px, 4vw, 36px)",
                    fontWeight: 700,
                    letterSpacing: "-0.6px",
                    marginBottom: "10px",
                  }}
                >
                  What atmospheric guidance do you need?
                </h1>

                <p
                  style={{
                    fontSize: "15px",
                    color: "rgba(255, 255, 255, 0.65)",
                    maxWidth: "580px",
                    lineHeight: 1.5,
                    marginBottom: "36px",
                  }}
                >
                  Powered by <strong style={{ color: "#ffffff" }}>Google Gemma 4</strong> through the Gemini API.
                  Translating ISRO INSAT-3DS satellite radiometry, CPCB monitoring feeds,
                  and Indore vs Delhi-NCR microclimates into compassionate, actionable citizen intelligence.
                </p>

                {/* 4 Apple Glass Suggestion Tiles */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                    gap: "12px",
                    width: "100%",
                    textAlign: "left",
                  }}
                >
                  {PRESET_TILES.map((t, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSendMessage(t.prompt)}
                      style={{
                        backgroundColor: "rgba(255, 255, 255, 0.03)",
                        border: "1px solid rgba(255, 255, 255, 0.08)",
                        borderRadius: "16px",
                        padding: "16px 18px",
                        cursor: "pointer",
                        transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
                        display: "flex",
                        flexDirection: "column",
                        gap: "6px",
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
                      <div
                        style={{
                          fontSize: "11px",
                          fontWeight: 700,
                          color: "#2997ff",
                          textTransform: "uppercase",
                          letterSpacing: "0.5px",
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                        }}
                      >
                        <span>{t.icon}</span>
                        <span>{t.category}</span>
                      </div>
                      <div
                        style={{
                          fontSize: "14px",
                          fontWeight: 600,
                          color: "#ffffff",
                          lineHeight: 1.35,
                        }}
                      >
                        {t.title}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ─── Active Conversation Stream ─────────────────────────────────── */}
            {messages.map((m, idx) => {
              const isUser = m.role === "user";
              const isStreamingThis = m.id === streamingMessageId;

              return (
                <div
                  key={m.id}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: isUser ? "flex-end" : "flex-start",
                    marginBottom: "24px",
                    width: "100%",
                  }}
                >
                  {/* User Bubble */}
                  {isUser ? (
                    <div
                      style={{
                        maxWidth: "80%",
                        backgroundColor: "rgba(255, 255, 255, 0.09)",
                        border: "1px solid rgba(255, 255, 255, 0.12)",
                        borderRadius: "20px 20px 4px 20px",
                        padding: "12px 18px",
                        fontSize: "15px",
                        color: "#ffffff",
                        lineHeight: 1.5,
                        boxShadow: "0 2px 8px rgba(0, 0, 0, 0.2)",
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                      }}
                    >
                      {m.content}
                    </div>
                  ) : (
                    /* Assistant Message */
                    <div style={{ width: "100%", display: "flex", gap: "14px" }}>
                      {/* Avatar */}
                      <div
                        style={{
                          width: "30px",
                          height: "30px",
                          minWidth: "30px",
                          borderRadius: "50%",
                          background:
                            "conic-gradient(from 180deg, #00f2fe, #4facfe, #0071e3, #f093fb, #00f2fe)",
                          boxShadow: "0 0 14px rgba(41, 151, 255, 0.3)",
                          marginTop: "2px",
                        }}
                      />

                      <div style={{ flex: 1, minWidth: 0 }}>
                        {/* Header Tag */}
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            marginBottom: "6px",
                          }}
                        >
                          <span style={{ fontSize: "13px", fontWeight: 650, color: "#ffffff" }}>
                            Exur
                          </span>
                          {m.provider && (
                            <span
                              style={{
                                fontSize: "11px",
                                color: "rgba(255, 255, 255, 0.4)",
                                backgroundColor: "rgba(255, 255, 255, 0.06)",
                                padding: "1px 6px",
                                borderRadius: "4px",
                              }}
                            >
                              {m.provider}
                            </span>
                          )}
                          <span style={{ fontSize: "11px", color: "rgba(255, 255, 255, 0.3)" }}>
                            {m.timestamp}
                          </span>
                        </div>

                        {/* Message Body with Rich Markdown */}
                        <ChatMarkdown content={m.content} isStreaming={isStreamingThis} />

                        {/* Action Bar (ChatGPT Style: Copy, Regenerate, Audio) */}
                        {!isStreamingThis && m.content && (
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "8px",
                              marginTop: "12px",
                              paddingTop: "6px",
                            }}
                          >
                            {/* Copy button */}
                            <button
                              onClick={() => handleCopyMessage(m.id, m.content)}
                              style={{
                                background: "none",
                                border: "none",
                                color: copiedId === m.id ? "#30d158" : "rgba(255, 255, 255, 0.45)",
                                fontSize: "12px",
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                gap: "4px",
                                padding: "4px 8px",
                                borderRadius: "6px",
                                backgroundColor: "rgba(255, 255, 255, 0.04)",
                                transition: "all 0.15s ease",
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.color = "#ffffff")}
                              onMouseLeave={(e) =>
                                (e.currentTarget.style.color =
                                  copiedId === m.id ? "#30d158" : "rgba(255, 255, 255, 0.45)")
                              }
                            >
                              <span>{copiedId === m.id ? "✓" : "📋"}</span>
                              <span>{copiedId === m.id ? "Copied" : "Copy"}</span>
                            </button>

                            {/* Regenerate button */}
                            <button
                              onClick={() => handleRegenerate(idx)}
                              style={{
                                background: "none",
                                border: "none",
                                color: "rgba(255, 255, 255, 0.45)",
                                fontSize: "12px",
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                gap: "4px",
                                padding: "4px 8px",
                                borderRadius: "6px",
                                backgroundColor: "rgba(255, 255, 255, 0.04)",
                                transition: "all 0.15s ease",
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.color = "#ffffff")}
                              onMouseLeave={(e) =>
                                (e.currentTarget.style.color = "rgba(255, 255, 255, 0.45)")
                              }
                            >
                              <span>🔄</span>
                              <span>Regenerate</span>
                            </button>

                            {/* Speech Synthesis Audio Button */}
                            <button
                              onClick={() => handleSpeak(m.id, m.content)}
                              style={{
                                background: "none",
                                border: "none",
                                color:
                                  speakingMessageId === m.id
                                    ? "#2997ff"
                                    : "rgba(255, 255, 255, 0.45)",
                                fontSize: "12px",
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                gap: "4px",
                                padding: "4px 8px",
                                borderRadius: "6px",
                                backgroundColor:
                                  speakingMessageId === m.id
                                    ? "rgba(41, 151, 255, 0.15)"
                                    : "rgba(255, 255, 255, 0.04)",
                                transition: "all 0.15s ease",
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.color = "#ffffff")}
                              onMouseLeave={(e) =>
                                (e.currentTarget.style.color =
                                  speakingMessageId === m.id
                                    ? "#2997ff"
                                    : "rgba(255, 255, 255, 0.45)")
                              }
                            >
                              <span>{speakingMessageId === m.id ? "⏹" : "🔊"}</span>
                              <span>{speakingMessageId === m.id ? "Stop voice" : "Read aloud"}</span>
                            </button>
                          </div>
                        )}

                        {/* Dynamic Follow-Up Prompt Chips */}
                        {!isStreamingThis &&
                          m.suggestedFollowUps &&
                          m.suggestedFollowUps.length > 0 && (
                            <div
                              style={{
                                display: "flex",
                                flexWrap: "wrap",
                                gap: "8px",
                                marginTop: "14px",
                              }}
                            >
                              {m.suggestedFollowUps.map((fu, fIdx) => (
                                <button
                                  key={fIdx}
                                  onClick={() => handleSendMessage(fu)}
                                  style={{
                                    backgroundColor: "rgba(41, 151, 255, 0.06)",
                                    border: "1px solid rgba(41, 151, 255, 0.2)",
                                    borderRadius: "14px",
                                    padding: "6px 12px",
                                    fontSize: "12px",
                                    color: "rgba(255, 255, 255, 0.85)",
                                    cursor: "pointer",
                                    textAlign: "left",
                                    transition: "all 0.15s ease",
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor =
                                      "rgba(41, 151, 255, 0.16)";
                                    e.currentTarget.style.borderColor = "rgba(41, 151, 255, 0.4)";
                                    e.currentTarget.style.color = "#ffffff";
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor =
                                      "rgba(41, 151, 255, 0.06)";
                                    e.currentTarget.style.borderColor = "rgba(41, 151, 255, 0.2)";
                                    e.currentTarget.style.color = "rgba(255, 255, 255, 0.85)";
                                  }}
                                >
                                  {fu} &rarr;
                                </button>
                              ))}
                            </div>
                          )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* ─────────────────────────────────────────────────────────────────────
            DOCKED APPLE CAPSULE INPUT BAR (CHATGPT STYLE)
            ───────────────────────────────────────────────────────────────────── */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            padding: "16px 20px 20px",
            background: "linear-gradient(to top, rgba(13, 13, 15, 0.96) 60%, transparent)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            zIndex: 35,
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "780px",
              backgroundColor: "rgba(26, 26, 32, 0.82)",
              backdropFilter: "blur(28px)",
              WebkitBackdropFilter: "blur(28px)",
              border: "1px solid rgba(255, 255, 255, 0.14)",
              borderRadius: "26px",
              padding: "8px 12px 8px 16px",
              display: "flex",
              alignItems: "flex-end",
              gap: "10px",
              boxShadow: "0 10px 30px rgba(0, 0, 0, 0.4)",
              transition: "border-color 0.2s ease, box-shadow 0.2s ease",
            }}
          >
            {/* Context action / Satellite glyph */}
            <button
              onClick={() => handleSendMessage(PRESET_TILES[0].prompt)}
              title="Quick Scenario: Indore to NCR"
              style={{
                background: "none",
                border: "none",
                color: "rgba(255, 255, 255, 0.45)",
                fontSize: "16px",
                cursor: "pointer",
                padding: "8px 4px",
                display: "flex",
                alignItems: "center",
                transition: "color 0.15s ease",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#2997ff")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255, 255, 255, 0.45)")}
            >
              ✦
            </button>

            {/* Auto-growing Textarea */}
            <textarea
              ref={textareaRef}
              rows={1}
              value={inputQuery}
              onChange={handleTextareaInput}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder="Ask anything about Delhi-NCR air quality, microclimates, or health defense..."
              style={{
                flex: 1,
                background: "transparent",
                border: "none",
                outline: "none",
                color: "#ffffff",
                fontSize: "15px",
                lineHeight: 1.45,
                maxHeight: "180px",
                resize: "none",
                padding: "7px 0",
                fontFamily: "inherit",
              }}
            />

            {/* Send OR Stop Button */}
            {isLoading ? (
              <button
                onClick={handleStopGeneration}
                title="Stop generating"
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "50%",
                  backgroundColor: "#ffffff",
                  border: "none",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  transition: "transform 0.15s ease",
                }}
              >
                {/* Stop square icon */}
                <div
                  style={{
                    width: "12px",
                    height: "12px",
                    backgroundColor: "#0d0d0f",
                    borderRadius: "2px",
                  }}
                />
              </button>
            ) : (
              <button
                onClick={() => handleSendMessage()}
                disabled={!inputQuery.trim()}
                title="Send message"
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "50%",
                  backgroundColor: inputQuery.trim() ? "#0071e3" : "rgba(255, 255, 255, 0.1)",
                  border: "none",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: inputQuery.trim() ? "pointer" : "default",
                  color: "#ffffff",
                  fontSize: "16px",
                  fontWeight: 700,
                  transition: "all 0.15s ease",
                  transform: inputQuery.trim() ? "scale(1)" : "scale(0.95)",
                }}
              >
                &uarr;
              </button>
            )}
          </div>

          {/* Footnote Disclaimer */}
          <div
            style={{
              fontSize: "11px",
              color: "rgba(255, 255, 255, 0.35)",
              marginTop: "8px",
              textAlign: "center",
            }}
          >
            Exur can make mistakes. Verify critical respiratory decisions with a medical pulmonologist.
          </div>
        </div>
      </div>

      {/* Global CSS for Animations */}
      <style jsx global>{`
        @keyframes exurRotate {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
        @keyframes exurPulse {
          0%,
          100% {
            opacity: 1;
          }
          50% {
            opacity: 0.2;
          }
        }
        @keyframes troposPulse {
          0%,
          100% {
            opacity: 1;
          }
          50% {
            opacity: 0.2;
          }
        }
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}

// ─── Sidebar Toggle Icon (Apple Style [|]) ────────────────────────────────────
function SidebarIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="4" />
      <line x1="9" y1="3" x2="9" y2="21" />
    </svg>
  );
}
