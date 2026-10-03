"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";

export default function Navigation() {
  const pathname = usePathname();
  const isDarkPage = pathname === "/insat" || pathname === "/advisor";
  const [isOverDark, setIsOverDark] = useState<boolean>(isDarkPage);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);

  // Close mobile menu whenever the route changes
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    // Synchronize html and body backgrounds for elastic overscroll / rubber-banding
    if (isDarkPage) {
      setIsOverDark(true);
      document.documentElement.style.backgroundColor = "#161617";
      document.body.style.backgroundColor = "#161617";

      let metaTheme = document.querySelector('meta[name="theme-color"]');
      if (!metaTheme) {
        metaTheme = document.createElement("meta");
        metaTheme.setAttribute("name", "theme-color");
        document.head.appendChild(metaTheme);
      }
      metaTheme.setAttribute("content", "#161617");

      return () => {
        document.documentElement.style.backgroundColor = "#ffffff";
        document.body.style.backgroundColor = "#ffffff";
        const meta = document.querySelector('meta[name="theme-color"]');
        if (meta) meta.setAttribute("content", "#ffffff");
      };
    } else {
      document.documentElement.style.backgroundColor = "#ffffff";
      document.body.style.backgroundColor = "#ffffff";
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute("content", "#ffffff");
    }

    const handleScroll = () => {
      const darkEl = document.getElementById("innovations");
      if (darkEl) {
        const rect = darkEl.getBoundingClientRect();
        // If the top of the dark section is at or above the header line and bottom is below it
        const inDark = rect.top <= 52 && rect.bottom >= 52;
        setIsOverDark(inDark);
      } else {
        setIsOverDark(false);
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, [isDarkPage]);

  const navItems = [
    { label: "Corridor", href: "/corridor" },
    { label: "Attribution", href: "/attribution" },
    { label: "INSAT", href: "/insat" },
    { label: "Radiometry", href: "/radiometry" },
    { label: "Advisor", href: "/advisor" },
  ];

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 100,
        height: "52px",
        backgroundColor: isOverDark ? "rgba(22, 22, 23, 0.72)" : "rgba(255, 255, 255, 0.72)",
        backdropFilter: "blur(20px) saturate(180%)",
        WebkitBackdropFilter: "blur(20px) saturate(180%)",
        borderBottom: isOverDark
          ? "1px solid rgba(255, 255, 255, 0.1)"
          : "1px solid rgba(0, 0, 0, 0.07)",
        transition: "background-color 0.25s ease, border-color 0.25s ease",
        width: "100%",
      }}
    >
      <div className="nav-header-container">
        {/* Left: Clean Brand Wordmark */}
        <Link
          href="/"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            textDecoration: "none",
            color: "inherit",
            zIndex: 2,
            flexShrink: 0,
          }}
        >
          <Image
            src="/logo.png"
            alt="Exur Logo"
            width={22}
            height={22}
            style={{
              objectFit: "contain",
              display: "block",
            }}
            priority
          />
          <span
            style={{
              fontSize: "16px",
              fontWeight: 600,
              letterSpacing: "-0.3px",
              color: isOverDark ? "#ffffff" : "var(--color-ink)",
              transition: "color 0.25s ease",
            }}
          >
            Exur
          </span>
        </Link>

        {/* Center / Track: Centered on PC (Desktop Only) */}
        <nav className="nav-links-track desktop-only-nav">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const darkClass = isOverDark ? "dark" : "";
            const activeClass = isActive ? "active" : "";
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`apple-nav-item ${darkClass} ${activeClass}`.trim()}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Right on PC: Official Gemma 4 Badge */}
        <div
          className="desktop-only-nav"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            fontSize: "13px",
            fontWeight: 650,
            color: isOverDark ? "rgba(255, 255, 255, 0.95)" : "var(--color-ink)",
            letterSpacing: "-0.2px",
            zIndex: 2,
          }}
        >
          <Image
            src="/gemma-icon.png"
            alt="Google Gemma 4"
            width={26}
            height={26}
            style={{
              width: "26px",
              height: "26px",
              objectFit: "contain",
              display: "block",
              filter: isOverDark
                ? "brightness(0.62) contrast(1.25) saturate(1.15)"
                : "brightness(0.52) contrast(1.3) saturate(1.2)",
              transition: "filter 0.25s ease",
            }}
          />
          <span>Gemma 4</span>
        </div>

        {/* Right on Mobile: Apple Minimalist Morphing Hamburger Button */}
        <button
          type="button"
          className="mobile-hamburger-btn"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
          aria-expanded={isMobileMenuOpen}
        >
          <div className={`hamburger-icon ${isMobileMenuOpen ? "open" : ""} ${isOverDark ? "dark" : ""}`}>
            <span className="line line-top" />
            <span className="line line-bottom" />
          </div>
        </button>
      </div>

      {/* Mobile Full-Width Frosted Glass Dropdown */}
      {isMobileMenuOpen && (
        <div className={`mobile-nav-dropdown ${isOverDark ? "dark" : ""}`}>
          <div className="mobile-nav-links">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`mobile-nav-link ${isActive ? "active" : ""}`}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <span>{item.label}</span>
                  {isActive && <span className="active-dot">&bull;</span>}
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </header>
  );
}
