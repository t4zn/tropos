import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import Link from "next/link";

export default function AttributionPage() {
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
              Atmospheric Physics &bull; Innovation 02
            </span>

            <h1 className="hero-display" style={{ marginBottom: "var(--spacing-md)" }}>
              Source Attribution.
            </h1>

            <p
              className="lead"
              style={{
                maxWidth: "760px",
                margin: "0 auto var(--spacing-xl) auto",
                color: "var(--color-ink-muted-48)",
              }}
            >
              Inverse Lagrangian wind dispersion. Tracing atmospheric particles backwards in time
              to mathematically prove who emitted the toxic plume.
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
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
              </div>

              <h3 className="display-md" style={{ fontSize: "24px", marginBottom: "8px" }}>
                Backward Trajectory Ray-Tracing Engine
              </h3>

              <p className="body" style={{ color: "var(--color-ink-muted-48)", maxWidth: "520px", marginBottom: "var(--spacing-lg)" }}>
                This module will execute the reverse HYSPLIT dispersion algorithm to render
                the 3D upwind probability cone connecting anomalous sensors to specific industrial clusters.
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
