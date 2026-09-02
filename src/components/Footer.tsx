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
    { label: "Attribution", href: "/attribution" },
    { label: "INSAT", href: "/insat" },
    { label: "Radiometry", href: "/radiometry" },
    { label: "Corridor", href: "/corridor" },
    { label: "Federation", href: "/federation" },
  ];

  return (
    <footer
      style={{
        borderTop: darkMode
          ? "1px solid rgba(255, 255, 255, 0.08)"
          : "1px solid rgba(0, 0, 0, 0.07)",
        backgroundColor: darkMode ? "var(--color-ink)" : "var(--color-canvas)",
        color: darkMode ? "rgba(255, 255, 255, 0.45)" : "var(--color-ink-muted-48)",
        padding: "32px 0 28px 0",
        fontSize: "12px",
        transition: "background-color 0.25s ease, color 0.25s ease",
        width: "100%",
      }}
    >
      <div
        style={{
          maxWidth: "1024px",
          margin: "0 auto",
          padding: "0 24px",
        }}
      >
        {/* Top Row: Brand & Quick Links */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "16px",
            borderBottom: darkMode
              ? "1px solid rgba(255, 255, 255, 0.06)"
              : "1px solid rgba(0, 0, 0, 0.06)",
            paddingBottom: "18px",
            marginBottom: "18px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Image
              src="/logo.png"
              alt="Tropos Logo"
              width={16}
              height={16}
              style={{ objectFit: "contain", display: "block" }}
            />
            <span
              style={{
                fontWeight: 600,
                color: darkMode ? "#ffffff" : "var(--color-ink)",
                fontSize: "13px",
                letterSpacing: "-0.2px",
              }}
            >
              Tropos
            </span>
            <span style={{ fontSize: "12px" }}>
              &bull; Atmospheric Intelligence &bull; GDG Sustainability
            </span>
          </div>

          <div style={{ display: "flex", gap: "20px", alignItems: "center" }}>
            {footerLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                style={{
                  color: darkMode ? "rgba(255, 255, 255, 0.65)" : "var(--color-ink-muted-48)",
                  textDecoration: "none",
                  transition: "color 0.15s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = darkMode ? "#ffffff" : "var(--color-ink)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = darkMode
                    ? "rgba(255, 255, 255, 0.65)"
                    : "var(--color-ink-muted-48)";
                }}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>

        {/* Bottom Row: Copyright & Google Architecture Note */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "12px",
            fontSize: "11px",
            color: darkMode ? "rgba(255, 255, 255, 0.35)" : "var(--color-ink-muted-48)",
          }}
        >
          <div>
            &copy; {new Date().getFullYear()} Tropos Platform. Zero cloud billing overhead ($0 USD).
          </div>
          <div>
            Powered by ISRO 74&deg;E &bull; Google Earth Engine &bull; Gemini 1.5
          </div>
        </div>
      </div>
    </footer>
  );
}
