import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import Link from "next/link";

export default function FederationPage() {
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
              Interoperability & Governance
            </span>

            <h1 className="hero-display" style={{ marginBottom: "var(--spacing-md)" }}>
              Sovereign Federation.
            </h1>

            <p
              className="lead"
              style={{
                maxWidth: "760px",
                margin: "0 auto var(--spacing-xl) auto",
                color: "var(--color-ink-muted-48)",
              }}
            >
              Cross-border climate action without political friction. Delhi, Haryana, and Uttar Pradesh
              exchange cryptographic compliance proofs while keeping raw farm telemetry strictly sovereign.
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
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </div>

              <h3 className="display-md" style={{ fontSize: "24px", marginBottom: "8px" }}>
                Multi-State Zero-Knowledge Console
              </h3>

              <p className="body" style={{ color: "var(--color-ink-muted-48)", maxWidth: "520px", marginBottom: "var(--spacing-lg)" }}>
                This module will manage the federated model aggregation rounds between state pollution control boards,
                issue verifiable GRAP compliance tokens, and automate emergency municipal dispatch triggers.
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
