import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import Link from "next/link";

export default function CorridorPage() {
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
              Spatial Intelligence
            </span>

            <h1 className="hero-display" style={{ marginBottom: "var(--spacing-md)" }}>
              Corridor Air-Shed.
            </h1>

            <p
              className="lead"
              style={{
                maxWidth: "760px",
                margin: "0 auto var(--spacing-xl) auto",
                color: "var(--color-ink-muted-48)",
              }}
            >
              Tracking CPCB continuous stations alongside verified hyper-local micro-hotspots
              across Punjab, Haryana, Delhi, and Uttar Pradesh.
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
                  <path d="M12 2v20M2 12h20M4.93 4.93l14.14 14.14M4.93 19.07l14.14-14.14" strokeLinecap="round" />
                </svg>
              </div>

              <h3 className="display-md" style={{ fontSize: "24px", marginBottom: "8px" }}>
                Interactive Corridor Map View
              </h3>

              <p className="body" style={{ color: "var(--color-ink-muted-48)", maxWidth: "520px", marginBottom: "var(--spacing-lg)" }}>
                This module will render the dynamic multi-layered GIS canvas with real-time CPCB baseline stations,
                hyper-local anomaly clusters, and live wind vector particle streamlines.
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
