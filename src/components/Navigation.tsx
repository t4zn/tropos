"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";

export default function Navigation() {
  const pathname = usePathname();
  const isInsatPage = pathname === "/insat";
  const [isOverDark, setIsOverDark] = useState<boolean>(isInsatPage);

  useEffect(() => {
    // Synchronize html and body backgrounds for elastic overscroll / rubber-banding
    if (isInsatPage) {
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
  }, [isInsatPage]);

  const navItems = [
    { label: "Attribution", href: "/attribution" },
    { label: "INSAT", href: "/insat" },
    { label: "Radiometry", href: "/radiometry" },
    { label: "Corridor", href: "/corridor" },
    { label: "Federation", href: "/federation" },
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
      <div
        style={{
          maxWidth: "1024px",
          margin: "0 auto",
          height: "100%",
          padding: "0 24px",
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
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
          }}
        >
          <Image
            src="/logo.png"
            alt="Tropos Logo"
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
            Tropos
          </span>
        </Link>

        {/* Center: Exactly Centered Translucent Navigation Links */}
        <nav
          style={{
            position: "absolute",
            left: "50%",
            transform: "translateX(-50%)",
            display: "flex",
            gap: "28px",
            alignItems: "center",
          }}
        >
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

        {/* Right: Invisible Spacer for Exact Visual Balance */}
        <div style={{ width: "68px", zIndex: 1 }} aria-hidden="true" />
      </div>
    </header>
  );
}
