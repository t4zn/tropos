"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";

interface FooterProps {
  isDark?: boolean;
}

export default function Footer({ isDark }: FooterProps) {
  const pathname = usePathname();
  // Auto-detect dark mode if on /insat or explicitly passed
  const darkMode = isDark !== undefined ? isDark : pathname === "/insat";

  const footerLinks = [
    { label: "Corridor", href: "/corridor" },
    { label: "Attribution", href: "/attribution" },
    { label: "INSAT", href: "/insat" },
    { label: "Radiometry", href: "/radiometry" },
    { label: "Advisor", href: "/advisor" },
  ];

  return (
    <footer
      style={{
        borderTop: darkMode
          ? "1px solid rgba(255, 255, 255, 0.08)"
          : "1px solid rgba(0, 0, 0, 0.06)",
        backgroundColor: darkMode ? "var(--color-ink)" : "var(--color-canvas)",
        color: darkMode ? "rgba(255, 255, 255, 0.45)" : "var(--color-ink-muted-48)",
        padding: "20px 0",
        fontSize: "12px",
        transition: "background-color 0.25s ease, color 0.25s ease",
        width: "100%",
      }}
    >
      <div
        className="container"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "16px",
        }}
      >
        {/* Left: Minimal Brand & Year */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <Image
            src="/logo.png"
            alt="Exur"
            width={16}
            height={16}
            style={{
              objectFit: "contain",
              display: "block",
              opacity: darkMode ? 0.9 : 0.8,
            }}
          />
          <span
            style={{
              fontWeight: 600,
              color: darkMode ? "#ffffff" : "var(--color-ink)",
              fontSize: "13px",
              letterSpacing: "-0.2px",
            }}
          >
            Exur
          </span>
          <span style={{ fontSize: "11px", opacity: 0.7 }}>
            &copy; {new Date().getFullYear()}
          </span>
        </div>

        {/* Center: Clean Minimal Links */}
        <div
          style={{
            display: "flex",
            gap: "18px",
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          {footerLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              style={{
                color: darkMode ? "rgba(255, 255, 255, 0.6)" : "var(--color-ink-muted-48)",
                textDecoration: "none",
                fontSize: "12px",
                transition: "color 0.15s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = darkMode ? "#ffffff" : "var(--color-ink)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = darkMode
                  ? "rgba(255, 255, 255, 0.6)"
                  : "var(--color-ink-muted-48)";
              }}
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Right: Quiet Tech Note */}
        <div
          style={{
            fontSize: "11px",
            color: darkMode ? "rgba(255, 255, 255, 0.35)" : "var(--color-ink-muted-48)",
            letterSpacing: "0.2px",
          }}
        >
          Hacktoberfest Indore &bull; PyData &bull; Google Gemma 4 &bull; ISRO 74&deg;E
        </div>
      </div>
    </footer>
  );
}
