// Silhouettes for the background scene. Each faces right and fills with
// currentColor, so the scene sets colour and opacity in one place.

export function Fish() {
  return (
    <svg viewBox="0 0 44 20" className="h-full w-full" fill="currentColor">
      <path d="M8 10 L0 2 L2 10 L0 18 Z" />
      <path d="M6 10 C12 2 30 0 40 8 C42 9 42 11 40 12 C30 20 12 18 6 10 Z" />
      <path d="M20 4 L24 0 L28 3 Z" />
    </svg>
  );
}

export function Shark() {
  return (
    <svg viewBox="0 0 140 48" className="h-full w-full" fill="currentColor">
      {/* Tail, body, dorsal fin, pectoral fin */}
      <path d="M22 24 L2 4 L10 24 L4 42 Z" />
      <path d="M14 24 C34 14 74 10 106 14 C122 16 134 20 140 25 C132 29 120 31 104 31 C80 33 40 33 14 26 Z" />
      <path d="M64 13 L78 0 L84 13 Z" />
      <path d="M86 30 L74 46 L98 31 Z" />
      <path d="M40 30 L36 38 L48 31 Z" />
    </svg>
  );
}

export function Whale() {
  return (
    <svg viewBox="0 0 260 100" className="h-full w-full" fill="currentColor">
      <path d="M40 52 L6 30 L16 52 L4 76 Z" />
      <path d="M30 52 C56 34 110 22 170 22 C220 22 254 36 258 52 C260 66 228 78 176 78 C120 78 66 70 30 54 Z" />
      <path d="M160 74 L138 98 L182 77 Z" />
      {/* Throat grooves, cut out of the silhouette */}
      <path d="M190 66 C215 68 238 64 250 58" fill="none" stroke="var(--color-abyss)" strokeOpacity="0.5" strokeWidth="2" />
    </svg>
  );
}

export function Lobster() {
  return (
    <svg viewBox="0 0 70 30" className="h-full w-full" fill="currentColor">
      {/* Tail fan and segments, body, claws, antennae, legs */}
      <path d="M2 16 L8 10 L8 22 Z" />
      <path d="M8 12 C16 9 24 9 30 11 L30 21 C24 23 16 23 8 20 Z" />
      <path d="M28 10 C36 8 46 9 50 13 C52 16 50 19 46 20 C40 22 34 22 28 21 Z" />
      <path d="M48 12 C54 8 60 4 66 5 C62 8 58 10 54 13 Z" />
      <path d="M48 19 C54 22 60 26 66 25 C62 22 58 20 54 17 Z" />
      <path d="M50 14 C58 10 66 6 70 0" fill="none" stroke="currentColor" strokeWidth="1" />
      <path d="M50 16 C58 14 64 14 70 12" fill="none" stroke="currentColor" strokeWidth="1" />
      <path d="M32 21 L30 28 M38 21 L37 29 M44 20 L45 28" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function Shipwreck() {
  return (
    <svg viewBox="0 0 320 130" className="h-full w-full" fill="currentColor">
      {/* A hull settled at an angle, a snapped mast and a few spars */}
      <path d="M8 96 L36 70 L290 58 L314 74 L296 112 C220 124 120 126 40 120 Z" />
      <path d="M60 72 L66 56 L130 52 L134 66 Z" />
      <path d="M150 64 L158 10 L164 11 L158 62 Z" />
      <path d="M156 24 L196 30 L195 34 L155 28 Z" />
      <path d="M232 60 L246 30 L251 32 L238 60 Z" />
      {/* Portholes */}
      <g fill="var(--color-abyss)" fillOpacity="0.6">
        <circle cx="90" cy="96" r="4" />
        <circle cx="130" cy="94" r="4" />
        <circle cx="170" cy="92" r="4" />
        <circle cx="210" cy="90" r="4" />
      </g>
    </svg>
  );
}

/** Rocks, coral and sea grass along the bottom of the screen. */
export function Reef() {
  return (
    <svg viewBox="0 0 1440 170" preserveAspectRatio="xMidYMax slice" className="h-full w-full">
      <g fill="#0a2738">
        <path d="M0 170 L0 120 C40 104 90 100 140 112 C180 96 230 94 280 110 C330 100 380 104 420 120 L460 170 Z" />
        <path d="M980 170 L1000 128 C1040 108 1100 104 1150 118 C1190 100 1250 98 1300 112 C1350 104 1400 110 1440 122 L1440 170 Z" />
      </g>
      <g fill="#0d3045">
        <ellipse cx="560" cy="160" rx="90" ry="26" />
        <ellipse cx="700" cy="164" rx="60" ry="18" />
        <ellipse cx="860" cy="158" rx="110" ry="30" />
        <ellipse cx="1220" cy="160" rx="70" ry="20" />
      </g>
      {/* Branching coral */}
      <g fill="none" stroke="#124158" strokeWidth="6" strokeLinecap="round">
        <path d="M180 112 L180 70 M180 92 L156 66 M180 84 L204 58 M156 66 L148 50 M204 58 L214 44" />
        <path d="M1120 118 L1120 76 M1120 98 L1098 74 M1120 90 L1142 66 M1142 66 L1150 50" />
      </g>
      {/* Fan coral */}
      <g fill="#103a50">
        <path d="M330 110 C300 80 300 50 330 36 C360 50 360 80 330 110 Z" />
        <path d="M1320 112 C1294 86 1296 60 1320 48 C1344 60 1346 86 1320 112 Z" />
      </g>
      {/* Sea grass sways gently */}
      <g className="sea-grass" fill="none" stroke="#0f3a4f" strokeWidth="4" strokeLinecap="round">
        <path d="M470 168 C460 140 478 120 466 96" />
        <path d="M484 168 C478 146 494 128 488 108" />
        <path d="M960 168 C950 142 968 122 956 100" />
        <path d="M974 168 C970 150 984 134 980 116" />
      </g>
    </svg>
  );
}
