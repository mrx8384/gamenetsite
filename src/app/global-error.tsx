"use client";

// Last-resort error boundary (replaces the root layout, so styles are inline).
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="fa" dir="rtl">
      <body style={{ fontFamily: "system-ui, sans-serif", background: "#FAF9F3", color: "#111", display: "grid", placeItems: "center", minHeight: "100vh", margin: 0 }}>
        <div style={{ textAlign: "center", padding: 24 }}>
          <h1 style={{ fontSize: 20 }}>خطای غیرمنتظره‌ای رخ داد</h1>
          <button onClick={reset} style={{ marginTop: 16, padding: "10px 20px", borderRadius: 10, border: 0, background: "#00C96B", color: "#111", cursor: "pointer", font: "inherit" }}>
            تلاش دوباره
          </button>
        </div>
      </body>
    </html>
  );
}
