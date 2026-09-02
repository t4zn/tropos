import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import Link from "next/link";

export default function InsatPage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "var(--color-ink)",
        color: "#ffffff",
      }}
    >
      {/* Same Unified Navigation (renders in dark translucent mode on /insat) */}
      <Navigation />

      <main style={{ flex: 1, backgroundColor: "var(--color-ink)" }}>
        <section className="product-tile-dark" style={{ backgroundColor: "var(--color-ink)" }}>
          <div className="container">
            <span
              style={{
                fontSize: "17px",
                fontWeight: 600,
                color: "var(--color-primary-on-dark)",
                letterSpacing: "-0.2px",
                marginBottom: "8px",
                display: "inline-block",
              }}
            >
              Orbital Cadence &bull; Innovation 01
            </span>

            <h1 className="hero-display" style={{ color: "#ffffff", marginBottom: "var(--spacing-md)" }}>
              ISRO INSAT-3DR.
            </h1>

            <p
              className="lead-airy"
              style={{
                maxWidth: "760px",
                margin: "0 auto var(--spacing-xl) auto",
              }}
            >
              15-minute continuous geostationary scans at 74&deg;E. Eliminating the 10-hour daytime
              blind spot of polar satellites where twilight evasion plumes erupt.
            </p>

            <div
              style={{
                maxWidth: "960px",
                margin: "0 auto",
                minHeight: "360px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "var(--color-surface-tile-2)",
                borderRadius: "var(--rounded-lg)",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                textAlign: "center",
                padding: "var(--spacing-xxl)",
              }}
            >
              <div
                style={{
                  width: "56px",
                  height: "56px",
                  borderRadius: "50%",
                  backgroundColor: "rgba(41, 151, 255, 0.12)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: "var(--spacing-md)",
                }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2997ff" strokeWidth="2">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 3a9 9 0 0 0 9 9M12 7a5 5 0 0 0 5 5" strokeLinecap="round" />
                </svg>
              </div>

              <h3 className="tagline" style={{ color: "#ffffff", fontSize: "24px", marginBottom: "8px" }}>
                Geostationary Telemetry Scanner
              </h3>

              <p className="caption" style={{ color: "var(--color-body-muted)", maxWidth: "520px", marginBottom: "var(--spacing-lg)" }}>
                This module will house the high-resolution INSAT-3DR Aerosol Optical Depth (AOD)
                timeseries engine and the live NASA FIRMS blind spot comparison toggle.
              </p>

              <Link href="/" className="text-link-on-dark">
                &larr; Back to Master View
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Reusable Minimal Dark Footer */}
      <Footer isDark={true} />
    </div>
  );
}
