import './globals.css';

export const metadata = {
  title: 'CrimeScope AI — Real-Time Crime Intelligence Platform',
  description: 'AI-powered crime intelligence and geospatial heatmap platform for real-time crime detection, analysis, and visualization. Built for smart city law enforcement.',
  keywords: 'crime intelligence, geospatial heatmap, NLP, crime detection, law enforcement, smart city, AI analytics',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" style={{ height: '100%', width: '100%', overflow: 'hidden' }}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
        <link
          rel="stylesheet"
          href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
          integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
          crossOrigin=""
        />
      </head>
      <body style={{ height: '100%', width: '100%', overflow: 'hidden', margin: 0, padding: 0 }}>
        {/*
          GT mounts its widget here. Must be in <body>, server-rendered,
          NOT inside a React component — avoids duplicate-ID hydration issues.
          The <script> is injected client-side by GoogleTranslate.jsx.
        */}
        <div id="google_translate_element" style={{ display: 'none' }} />
        {children}
      </body>
    </html>
  );
}
