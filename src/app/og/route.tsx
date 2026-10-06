import { ImageResponse } from "next/og";

/**
 * The social card for every marketing page: the landing page's sky, the
 * wordmark, a small eyebrow and the page's title. Pages link to it through
 * ogImageUrl() in src/lib/marketing/seo.ts. Public (MARKETING_PREFIXES).
 */

const clamp = (value: string | null, max: number) => (value ?? "").slice(0, max);

export function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const title = clamp(searchParams.get("title"), 110) || "The open-source AI SDR";
  const eyebrow = clamp(searchParams.get("eyebrow"), 40);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background: "linear-gradient(170deg, #0b0a1a 0%, #120c3a 30%, #0f1669 50%, #1f3bad 68%, #335cff 84%, #739eff 100%)",
          color: "white",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: "#335cff", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "inset 0 0 0 2px rgba(255,255,255,0.25)" }}>
            {/* Shade, the ghost mark, reduced to its silhouette */}
            <svg width="34" height="34" viewBox="0 0 16 16">
              <path fill="white" d="M4 2h8v1h1v1h1v10h-2v-1h-1v1H9v-1H7v1H5v-1H4v1H2V4h1V3h1z" />
              <rect x="5" y="6" width="2" height="2" fill="#335cff" />
              <rect x="9" y="6" width="2" height="2" fill="#335cff" />
            </svg>
          </div>
          <div style={{ fontSize: 34, fontWeight: 600, letterSpacing: -1 }}>AgentSDR</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          {eyebrow ? (
            <div style={{ display: "flex", alignSelf: "flex-start", fontSize: 22, letterSpacing: 2, textTransform: "uppercase", padding: "8px 18px", borderRadius: 999, background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.85)" }}>{eyebrow}</div>
          ) : null}
          <div style={{ fontSize: title.length > 60 ? 60 : 74, fontWeight: 600, lineHeight: 1.08, letterSpacing: -2, maxWidth: 1000 }}>{title}</div>
        </div>
        <div style={{ display: "flex", fontSize: 24, color: "rgba(255,255,255,0.75)" }}>Open source · Email, LinkedIn & WhatsApp · AI CRM</div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
