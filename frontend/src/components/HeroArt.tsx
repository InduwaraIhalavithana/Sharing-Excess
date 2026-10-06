/** Original hero illustration: a basket of shared food under a heart. Pure SVG, no image download. */
export default function HeroArt() {
  return (
    <svg
      className="hero-art"
      viewBox="0 0 480 360"
      role="img"
      aria-label="A basket of fresh bread, fruit and vegetables with a heart above it"
    >
      <defs>
        <linearGradient id="ha-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#dcfce7" />
          <stop offset="1" stopColor="#99f6e4" />
        </linearGradient>
        <linearGradient id="ha-basket" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#d9a05b" />
          <stop offset="1" stopColor="#b97a35" />
        </linearGradient>
        <linearGradient id="ha-heart" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fb7185" />
          <stop offset="1" stopColor="#e11d48" />
        </linearGradient>
      </defs>

      <rect width="480" height="360" rx="28" fill="url(#ha-bg)" />
      <circle cx="400" cy="70" r="46" fill="#fde68a" opacity=".85" />
      <circle cx="70" cy="300" r="60" fill="#86efac" opacity=".55" />
      <path d="M0 290 Q120 250 240 285 T480 270 V360 H0 Z" fill="#4ade80" opacity=".45" />

      {/* floating heart */}
      <g transform="translate(0 -26)">
      <g className="hero-art__heart">
        <path
          d="M240 118c-18-26-58-12-52 18 5 22 34 40 52 52 18-12 47-30 52-52 6-30-34-44-52-18z"
          fill="url(#ha-heart)"
        />
        <path d="M214 120c6-8 16-8 20-2" stroke="#fff" strokeWidth="5" strokeLinecap="round" fill="none" opacity=".6" />
      </g>
      </g>

      {/* basket back rim */}
      <ellipse cx="240" cy="236" rx="118" ry="22" fill="#a3672a" />

      {/* produce */}
      <g transform="translate(0 -30)">
      <g className="hero-art__produce">
        {/* baguette */}
        <g transform="rotate(-24 190 220)">
          <rect x="120" y="198" width="150" height="38" rx="19" fill="#e9b872" />
          <path d="M150 208l16 20M180 206l16 22M210 206l16 22" stroke="#c98f45" strokeWidth="5" strokeLinecap="round" />
        </g>
        {/* carrots */}
        <g transform="rotate(18 300 210)">
          <path d="M280 196h54l-27 66z" fill="#fb923c" />
          <path d="M296 204l8 8M310 214l8 8" stroke="#ea580c" strokeWidth="3" strokeLinecap="round" />
          <path d="M298 196c-6-14-2-22 6-26 4 8 4 16 3 26zM314 196c0-12 6-20 16-22-2 10-6 18-12 22z" fill="#22c55e" />
        </g>
        {/* apple */}
        <circle cx="236" cy="214" r="30" fill="#ef4444" />
        <path d="M236 184c0-10 6-16 14-18" stroke="#78350f" strokeWidth="4" strokeLinecap="round" fill="none" />
        <path d="M242 186c10-10 22-8 26-4-4 10-16 14-26 4z" fill="#22c55e" />
        <ellipse cx="224" cy="204" rx="7" ry="11" fill="#fff" opacity=".28" transform="rotate(20 224 204)" />
        {/* lemon */}
        <ellipse cx="160" cy="226" rx="26" ry="19" fill="#facc15" transform="rotate(-14 160 226)" />
        {/* tomato */}
        <circle cx="318" cy="232" r="22" fill="#f43f5e" />
        <path d="M308 216l10 6 10-6-4 10h-12z" fill="#16a34a" />
      </g>
      </g>

      {/* basket front */}
      <path d="M118 236h244l-24 96a14 14 0 0 1-14 11H156a14 14 0 0 1-14-11z" fill="url(#ha-basket)" />
      <g stroke="#8c5a24" strokeWidth="4" strokeLinecap="round" opacity=".55" fill="none">
        <path d="M130 266h220M138 296h204M148 324h184" />
        <path d="M168 240l8 100M214 240l4 104M262 240l-4 104M308 240l-8 100" />
      </g>
      <path d="M118 236h244" stroke="#8c5a24" strokeWidth="9" strokeLinecap="round" />

      {/* sparkles */}
      <g fill="#fff" opacity=".9">
        <path className="hero-art__spark" d="M96 96l5 12 12 5-12 5-5 12-5-12-12-5 12-5z" />
        <path className="hero-art__spark hero-art__spark--2" d="M392 168l4 9 9 4-9 4-4 9-4-9-9-4 9-4z" />
        <path className="hero-art__spark hero-art__spark--3" d="M60 190l3 7 7 3-7 3-3 7-3-7-7-3 7-3z" />
      </g>
    </svg>
  );
}
