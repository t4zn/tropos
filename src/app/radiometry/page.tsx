import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import Link from "next/link";

export default function RadiometryPage() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <Navigation />

      <main style={{ flex: 1 }}>
        <section className="product-tile-light">
          <div className="container">
            <span
              style={{
                fontSize: "17px",
                fontWeight: 600,
                color: "var(--color-primary)",
                letterSpacing: "-0.2px",
                marginBottom: "8px",
                display: "inline-block",
              }}
            >
              Citizen Sensing &bull; Innovation 03
            </span>

            <h1 className="hero-display" style={{ marginBottom: "var(--spacing-md)" }}>
              Camera Radiometry.
            </h1>

            <p
              className="lead"
              style={{
                maxWidth: "760px",
                margin: "0 auto var(--spacing-xl) auto",
                color: "var(--color-ink-muted-48)",
              }}
            >
              Zero physical sensors required. Converting standard smartphone camera EXIF exposure values
              into verified Aerosol Optical Depth directly in the browser for $0.
            </p>

            <div
              className="store-utility-card apple-product-elevation"
              style={{
                maxWidth: "960px",
                margin: "0 auto",
                minHeight: "360px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "#ffffff",
                textAlign: "center",
                padding: "var(--spacing-xxl)",
              }}
            >
              <div
                style={{
                  width: "56px",
                  height: "56px",
                  borderRadius: "50%",
                  backgroundColor: "rgba(0, 102, 204, 0.08)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: "var(--spacing-md)",
                }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0066cc" strokeWidth="2">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
              </div>

              <h3 className="display-md" style={{ fontSize: "24px", marginBottom: "8px" }}>
                Client-Side Optical Depth Calculator
              </h3>

              <p className="body" style={{ color: "var(--color-ink-muted-48)", maxWidth: "520px", marginBottom: "var(--spacing-lg)" }}>
                This module will support drag-and-drop sky photo uploads, extract raw F-number, ISO, and shutter speed,
                and run the Beer-Lambert optical attenuation formula with anti-spoofing validation.
              </p>

              <Link href="/" className="button-secondary-pill">
                &larr; Back to Master View
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Reusable Minimal Footer */}
      <Footer />
    </div>
  );
}
