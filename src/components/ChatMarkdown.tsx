"use client";

import React, { useState } from "react";

interface ChatMarkdownProps {
  content: string;
  isStreaming?: boolean;
}

export default function ChatMarkdown({ content, isStreaming }: ChatMarkdownProps) {
  // If content is empty and streaming, show cursor
  if (!content && isStreaming) {
    return (
      <span
        style={{
          display: "inline-block",
          width: "8px",
          height: "16px",
          backgroundColor: "#2997ff",
          marginLeft: "2px",
          animation: "troposPulse 1s ease-in-out infinite",
          verticalAlign: "middle",
        }}
      />
    );
  }

  // Parse blocks: code blocks, tables, headings, blockquotes, lists, paragraphs
  const blocks = parseMarkdownBlocks(content);

  return (
    <div
      style={{
        lineHeight: 1.68,
        fontSize: "15px",
        color: "rgba(255, 255, 255, 0.92)",
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Helvetica Neue', sans-serif",
      }}
    >
      {blocks.map((block, idx) => {
        switch (block.type) {
          case "code":
            return <CodeBlock key={idx} language={block.language} code={block.content} />;
          case "table":
            return <TableBlock key={idx} headers={block.headers} rows={block.rows} />;
          case "heading":
            return (
              <HeadingBlock
                key={idx}
                level={block.level}
                text={block.content}
              />
            );
          case "blockquote":
            return (
              <blockquote
                key={idx}
                style={{
                  margin: "14px 0",
                  padding: "10px 18px",
                  borderLeft: "3px solid #2997ff",
                  backgroundColor: "rgba(41, 151, 255, 0.06)",
                  borderRadius: "0 10px 10px 0",
                  color: "rgba(255, 255, 255, 0.8)",
                  fontSize: "14px",
                }}
              >
                <InlineMarkdown text={block.content} />
              </blockquote>
            );
          case "list":
            return (
              <ul
                key={idx}
                style={{
                  margin: "10px 0 14px 20px",
                  padding: 0,
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px",
                }}
              >
                {block.items.map((item, i) => (
                  <li key={i} style={{ color: "rgba(255, 255, 255, 0.88)" }}>
                    <InlineMarkdown text={item} />
                  </li>
                ))}
              </ul>
            );
          case "orderedList":
            return (
              <ol
                key={idx}
                style={{
                  margin: "10px 0 14px 22px",
                  padding: 0,
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px",
                }}
              >
                {block.items.map((item, i) => (
                  <li key={i} style={{ color: "rgba(255, 255, 255, 0.88)" }}>
                    <InlineMarkdown text={item} />
                  </li>
                ))}
              </ol>
            );
          case "hr":
            return (
              <hr
                key={idx}
                style={{
                  border: "none",
                  borderTop: "1px solid rgba(255, 255, 255, 0.1)",
                  margin: "20px 0",
                }}
              />
            );
          default:
            return (
              <p
                key={idx}
                style={{
                  margin: "0 0 12px 0",
                  whiteSpace: "pre-line",
                  wordBreak: "break-word",
                }}
              >
                <InlineMarkdown text={block.content} />
                {idx === blocks.length - 1 && isStreaming && (
                  <span
                    style={{
                      display: "inline-block",
                      width: "7px",
                      height: "15px",
                      backgroundColor: "#2997ff",
                      marginLeft: "3px",
                      animation: "troposPulse 1s ease-in-out infinite",
                      verticalAlign: "middle",
                    }}
                  />
                )}
              </p>
            );
        }
      })}
    </div>
  );
}

// ─── Inline Markdown Formatter ────────────────────────────────────────────────
function InlineMarkdown({ text }: { text: string }) {
  if (!text) return null;

  // Split by inline code: `code`
  const parts = text.split(/(`[^`]+`)/g);

  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("`") && part.endsWith("`") && part.length > 1) {
          return (
            <code
              key={i}
              style={{
                backgroundColor: "rgba(255, 255, 255, 0.08)",
                padding: "2px 6px",
                borderRadius: "5px",
                fontSize: "0.9em",
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                color: "#79c0ff",
                border: "1px solid rgba(255, 255, 255, 0.06)",
              }}
            >
              {part.slice(1, -1)}
            </code>
          );
        }

        // Process bold and italics within regular text
        return <FormattedText key={i} text={part} />;
      })}
    </>
  );
}

function FormattedText({ text }: { text: string }) {
  // Replace **bold**
  const boldParts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {boldParts.map((part, idx) => {
        if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
          return (
            <strong key={idx} style={{ color: "#ffffff", fontWeight: 650 }}>
              {part.slice(2, -2)}
            </strong>
          );
        }
        // Replace *italic*
        const italicParts = part.split(/(\*[^*]+\*)/g);
        return (
          <span key={idx}>
            {italicParts.map((it, j) => {
              if (it.startsWith("*") && it.endsWith("*") && it.length > 2) {
                return <em key={j}>{it.slice(1, -1)}</em>;
              }
              return it;
            })}
          </span>
        );
      })}
    </>
  );
}

// ─── Heading Block ────────────────────────────────────────────────────────────
function HeadingBlock({ level, text }: { level: number; text: string }) {
  const styles: Record<number, React.CSSProperties> = {
    1: { fontSize: "22px", fontWeight: 700, margin: "24px 0 12px", color: "#ffffff", letterSpacing: "-0.4px" },
    2: { fontSize: "19px", fontWeight: 700, margin: "20px 0 10px", color: "#ffffff", letterSpacing: "-0.3px" },
    3: { fontSize: "16px", fontWeight: 650, margin: "16px 0 8px", color: "#2997ff", letterSpacing: "-0.2px" },
    4: { fontSize: "14px", fontWeight: 650, margin: "14px 0 6px", color: "rgba(255, 255, 255, 0.9)" },
  };

  const currentStyle = styles[level] || styles[3];

  return (
    <div style={currentStyle}>
      <InlineMarkdown text={text} />
    </div>
  );
}

// ─── Code Block with Apple Copy Button ─────────────────────────────────────────
function CodeBlock({ language, code }: { language: string; code: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      style={{
        margin: "14px 0",
        borderRadius: "12px",
        overflow: "hidden",
        backgroundColor: "#16161a",
        border: "1px solid rgba(255, 255, 255, 0.08)",
      }}
    >
      {/* Code Header Bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "8px 14px",
          backgroundColor: "rgba(255, 255, 255, 0.03)",
          borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
          fontSize: "11px",
          color: "rgba(255, 255, 255, 0.45)",
          textTransform: "uppercase",
          letterSpacing: "0.5px",
        }}
      >
        <span>{language || "code"}</span>
        <button
          onClick={handleCopy}
          style={{
            background: "none",
            border: "none",
            color: copied ? "#30d158" : "rgba(255, 255, 255, 0.6)",
            fontSize: "11px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "5px",
            padding: "2px 8px",
            borderRadius: "6px",
            backgroundColor: "rgba(255, 255, 255, 0.05)",
            transition: "all 0.15s ease",
          }}
        >
          {copied ? "✓ Copied" : "Copy code"}
        </button>
      </div>

      {/* Code Content */}
      <pre
        style={{
          margin: 0,
          padding: "14px 16px",
          overflowX: "auto",
          fontSize: "13px",
          lineHeight: 1.5,
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
          color: "#e6edf3",
        }}
      >
        <code>{code}</code>
      </pre>
    </div>
  );
}

// ─── Table Block ──────────────────────────────────────────────────────────────
function TableBlock({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div
      style={{
        margin: "16px 0",
        overflowX: "auto",
        borderRadius: "10px",
        border: "1px solid rgba(255, 255, 255, 0.1)",
        backgroundColor: "rgba(255, 255, 255, 0.02)",
      }}
    >
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: "13px",
          textAlign: "left",
        }}
      >
        <thead>
          <tr style={{ backgroundColor: "rgba(255, 255, 255, 0.05)", borderBottom: "1px solid rgba(255, 255, 255, 0.1)" }}>
            {headers.map((h, i) => (
              <th
                key={i}
                style={{
                  padding: "10px 14px",
                  fontWeight: 650,
                  color: "#ffffff",
                  whiteSpace: "nowrap",
                }}
              >
                <InlineMarkdown text={h.trim()} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rIdx) => (
            <tr
              key={rIdx}
              style={{
                borderBottom: rIdx < rows.length - 1 ? "1px solid rgba(255, 255, 255, 0.04)" : "none",
                backgroundColor: rIdx % 2 === 1 ? "rgba(255, 255, 255, 0.01)" : "transparent",
              }}
            >
              {row.map((cell, cIdx) => (
                <td
                  key={cIdx}
                  style={{
                    padding: "9px 14px",
                    color: "rgba(255, 255, 255, 0.8)",
                  }}
                >
                  <InlineMarkdown text={cell.trim()} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Markdown Parser Helper ───────────────────────────────────────────────────
type ParsedBlock =
  | { type: "code"; language: string; content: string }
  | { type: "table"; headers: string[]; rows: string[][] }
  | { type: "heading"; level: number; content: string }
  | { type: "blockquote"; content: string }
  | { type: "list"; items: string[] }
  | { type: "orderedList"; items: string[] }
  | { type: "hr" }
  | { type: "p"; content: string };

function parseMarkdownBlocks(md: string): ParsedBlock[] {
  if (!md) return [];

  const lines = md.split("\n");
  const blocks: ParsedBlock[] = [];
  let inCode = false;
  let codeLang = "";
  let codeBuffer: string[] = [];

  let inList = false;
  let listItems: string[] = [];

  let inOrderedList = false;
  let orderedItems: string[] = [];

  let inTable = false;
  let tableHeaders: string[] = [];
  let tableRows: string[][] = [];

  let paragraphBuffer: string[] = [];

  const flushParagraph = () => {
    if (paragraphBuffer.length > 0) {
      blocks.push({ type: "p", content: paragraphBuffer.join("\n").trim() });
      paragraphBuffer = [];
    }
  };

  const flushList = () => {
    if (listItems.length > 0) {
      blocks.push({ type: "list", items: listItems });
      listItems = [];
      inList = false;
    }
  };

  const flushOrderedList = () => {
    if (orderedItems.length > 0) {
      blocks.push({ type: "orderedList", items: orderedItems });
      orderedItems = [];
      inOrderedList = false;
    }
  };

  const flushTable = () => {
    if (tableHeaders.length > 0) {
      blocks.push({ type: "table", headers: tableHeaders, rows: tableRows });
      tableHeaders = [];
      tableRows = [];
      inTable = false;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Code blocks
    if (line.trim().startsWith("```")) {
      if (inCode) {
        blocks.push({ type: "code", language: codeLang, content: codeBuffer.join("\n") });
        inCode = false;
        codeBuffer = [];
        codeLang = "";
      } else {
        flushParagraph();
        flushList();
        flushOrderedList();
        flushTable();
        inCode = true;
        codeLang = line.trim().slice(3).trim();
      }
      continue;
    }

    if (inCode) {
      codeBuffer.push(line);
      continue;
    }

    // Horizontal Rule
    if (/^---$|^___$|^\*\*\*$/.test(line.trim())) {
      flushParagraph();
      flushList();
      flushOrderedList();
      flushTable();
      blocks.push({ type: "hr" });
      continue;
    }

    // Headings
    const headingMatch = line.match(/^(#{1,4})\s+(.*)$/);
    if (headingMatch) {
      flushParagraph();
      flushList();
      flushOrderedList();
      flushTable();
      blocks.push({
        type: "heading",
        level: headingMatch[1].length,
        content: headingMatch[2],
      });
      continue;
    }

    // Blockquotes
    if (line.trim().startsWith(">")) {
      flushParagraph();
      flushList();
      flushOrderedList();
      flushTable();
      blocks.push({
        type: "blockquote",
        content: line.replace(/^>\s?/, ""),
      });
      continue;
    }

    // Tables
    if (line.trim().startsWith("|") && line.trim().endsWith("|")) {
      const parts = line.split("|").slice(1, -1);
      if (line.includes("---")) {
        // separator row
        continue;
      }
      if (!inTable) {
        flushParagraph();
        flushList();
        flushOrderedList();
        inTable = true;
        tableHeaders = parts;
      } else {
        tableRows.push(parts);
      }
      continue;
    } else if (inTable) {
      flushTable();
    }

    // Bullet lists
    if (/^[-*]\s+/.test(line.trim())) {
      flushParagraph();
      flushOrderedList();
      flushTable();
      inList = true;
      listItems.push(line.trim().replace(/^[-*]\s+/, ""));
      continue;
    } else if (inList) {
      flushList();
    }

    // Ordered lists
    if (/^\d+\.\s+/.test(line.trim())) {
      flushParagraph();
      flushList();
      flushTable();
      inOrderedList = true;
      orderedItems.push(line.trim().replace(/^\d+\.\s+/, ""));
      continue;
    } else if (inOrderedList) {
      flushOrderedList();
    }

    // Empty lines
    if (!line.trim()) {
      flushParagraph();
      continue;
    }

    // Regular paragraph
    paragraphBuffer.push(line);
  }

  flushParagraph();
  flushList();
  flushOrderedList();
  flushTable();

  return blocks;
}
