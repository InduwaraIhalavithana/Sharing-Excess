import './HungerScene.css';

/**
 * Original illustration (pure SVG, nothing downloaded) used as a background.
 * It tells one story without showing anyone's suffering: green Sri Lankan paddy fields on the left
 * dry out into cracked earth on the right, where an empty bowl sits beside a wilting plant,
 * while a low sun still lights the horizon.
 */

// Deterministic "random" so the stars do not move between renders.
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}
const rand = seeded(42);
const STARS = Array.from({ length: 34 }, () => ({
  x: Math.round(rand() * 1600),
  y: Math.round(rand() * 260),
  r: +(0.8 + rand() * 1.6).toFixed(1),
  d: +(2.4 + rand() * 3).toFixed(1),
  delay: +(rand() * 4).toFixed(1),
}));
const DUST = Array.from({ length: 16 }, () => ({
  x: Math.round(300 + rand() * 1100),
  y: Math.round(380 + rand() * 180),
  r: +(1.2 + rand() * 2).toFixed(1),
  d: +(7 + rand() * 6).toFixed(1),
  delay: +(rand() * 6).toFixed(1),
}));

function Palm({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g className="hs-palm" transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M0 0 C6 -60 -6 -120 8 -190" stroke="#2b1b3a" strokeWidth="9" strokeLinecap="round" fill="none" />
      <g stroke="#1f3b2a" strokeWidth="6" strokeLinecap="round" fill="none">
        <path d="M8 -190 C-30 -214 -78 -196 -104 -160" />
        <path d="M8 -190 C-18 -226 -60 -232 -92 -214" />
        <path d="M8 -190 C26 -230 62 -238 96 -218" />
        <path d="M8 -190 C46 -214 92 -196 112 -158" />
        <path d="M8 -190 C-6 -216 -4 -240 14 -254" />
      </g>
    </g>
  );
}

export default function HungerScene({ className = '' }: { className?: string }) {
  return (
    <svg
      className={`hunger-scene ${className}`}
      viewBox="0 0 1600 640"
      preserveAspectRatio="xMidYMax slice"
      role="img"
      aria-label="Green paddy fields fading into cracked dry earth, with an empty bowl beside a wilting plant under a setting sun"
    >
      <defs>
        <linearGradient id="hs-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0f0c29" />
          <stop offset=".45" stopColor="#3a1c5c" />
          <stop offset=".72" stopColor="#b8456a" />
          <stop offset="1" stopColor="#fb923c" />
        </linearGradient>
        <radialGradient id="hs-sun" cx=".5" cy=".5" r=".5">
          <stop offset="0" stopColor="#fff7d6" />
          <stop offset=".35" stopColor="#fcd34d" />
          <stop offset="1" stopColor="#fb923c" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="hs-hills" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#4c2a6e" />
          <stop offset="1" stopColor="#2a1648" />
        </linearGradient>
        <linearGradient id="hs-terrace" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#22c55e" />
          <stop offset=".38" stopColor="#65a30d" />
          <stop offset=".66" stopColor="#ca8a04" />
          <stop offset="1" stopColor="#a16207" />
        </linearGradient>
        <linearGradient id="hs-terrace2" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#15803d" />
          <stop offset=".4" stopColor="#4d7c0f" />
          <stop offset=".7" stopColor="#a16207" />
          <stop offset="1" stopColor="#854d0e" />
        </linearGradient>
        <linearGradient id="hs-earth" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#c58a4e" />
          <stop offset="1" stopColor="#6b4220" />
        </linearGradient>
        <linearGradient id="hs-bowl" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#d6a164" />
          <stop offset="1" stopColor="#8a5524" />
        </linearGradient>
        <linearGradient id="hs-beam" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fde68a" stopOpacity=".38" />
          <stop offset="1" stopColor="#fde68a" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* sky */}
      <rect width="1600" height="640" fill="url(#hs-sky)" />
      {STARS.map((s, i) => (
        <circle key={i} className="hs-star" cx={s.x} cy={s.y} r={s.r} fill="#fff" style={{ ['--d' as string]: `${s.d}s`, animationDelay: `${s.delay}s` }} />
      ))}

      {/* sun + slow rays */}
      <circle className="hs-glow" cx="760" cy="410" r="230" fill="url(#hs-sun)" />
      <g className="hs-rays" opacity=".3" stroke="#fde68a" strokeWidth="3" strokeLinecap="round">
        {Array.from({ length: 16 }, (_, i) => {
          const a = (i / 16) * Math.PI * 2;
          return <line key={i} x1={760 + Math.cos(a) * 120} y1={410 + Math.sin(a) * 120} x2={760 + Math.cos(a) * 200} y2={410 + Math.sin(a) * 200} />;
        })}
      </g>
      <circle cx="760" cy="410" r="74" fill="#fff3c4" />

      {/* hill country */}
      <path d="M0 410 C140 330 280 380 430 340 C580 300 690 380 850 350 C1000 322 1140 392 1300 352 C1450 316 1530 372 1600 346 V560 H0 Z" fill="url(#hs-hills)" />
      <path d="M0 450 C180 400 330 440 520 412 C700 386 820 446 1000 420 C1180 396 1330 440 1600 410 V560 H0 Z" fill="#33185a" opacity=".9" />

      {/* light beam from the sun to the bowl: hope */}
      <polygon points="800,420 1090,520 1090,600 800,430" fill="url(#hs-beam)" />

      {/* paddy terraces: green on the left, drying out to the right */}
      <path d="M0 482 C200 446 450 466 700 456 C900 448 1100 470 1300 464 C1450 460 1520 468 1600 464 V600 H0 Z" fill="url(#hs-terrace)" />
      <path d="M0 520 C220 486 460 506 720 498 C940 490 1120 514 1340 506 C1470 502 1540 508 1600 504 V610 H0 Z" fill="url(#hs-terrace2)" />
      <g stroke="#0b3d1d" strokeWidth="2" opacity=".35" fill="none">
        <path d="M0 500 C220 466 460 486 720 478" />
        <path d="M0 538 C220 506 460 526 720 518" />
      </g>

      <Palm x={230} y={490} s={1.05} />
      <Palm x={360} y={500} s={0.8} />
      <Palm x={1470} y={514} s={0.7} />

      {/* cracked earth foreground */}
      <path d="M0 548 C200 532 400 546 600 538 C800 530 1000 544 1200 534 C1400 526 1500 538 1600 530 V640 H0 Z" fill="url(#hs-earth)" />
      <g stroke="#4a2c12" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity=".62">
        <path d="M120 600 L184 574 L236 606 L310 580 M236 606 L252 640" strokeWidth="3" />
        <path d="M420 590 L480 612 L548 586 L620 604 M480 612 L470 640" strokeWidth="3" />
        <path d="M700 596 L760 574 L828 600 L900 578 M828 600 L846 640" strokeWidth="3.5" />
        <path d="M1180 600 L1240 578 L1310 604 L1390 582 M1310 604 L1296 640" strokeWidth="3" />
        <path d="M1460 590 L1520 612 L1580 588 M1520 612 L1532 640" strokeWidth="2.5" />
        <path d="M40 560 L92 580 L150 556" strokeWidth="2" />
        <path d="M560 560 L610 570 L664 552" strokeWidth="2" />
        <path d="M1000 616 L1050 630 L1108 612" strokeWidth="2.5" />
      </g>

      {/* empty bowl + spoon */}
      <ellipse cx="1030" cy="610" rx="104" ry="12" fill="#000" opacity=".32" />
      <path d="M950 566 C954 622 1106 622 1110 566 Z" fill="url(#hs-bowl)" />
      <ellipse cx="1030" cy="566" rx="80" ry="17" fill="#e1b27a" />
      <ellipse cx="1030" cy="568" rx="70" ry="12" fill="#2f1b0b" />
      <path d="M1134 612 L1196 596" stroke="#caa06a" strokeWidth="7" strokeLinecap="round" />
      <ellipse cx="1128" cy="614" rx="14" ry="8" fill="#caa06a" transform="rotate(-18 1128 614)" />

      {/* wilting plant */}
      <g className="hs-plant">
        <path d="M1232 598 C1234 560 1244 532 1268 512 C1284 500 1296 506 1300 524" stroke="#7a8b2e" strokeWidth="6" strokeLinecap="round" fill="none" />
        <ellipse cx="1262" cy="548" rx="22" ry="8" fill="#8a9a3a" transform="rotate(-38 1262 548)" />
        <ellipse cx="1246" cy="572" rx="20" ry="7" fill="#9a8a3a" transform="rotate(30 1246 572)" />
        <ellipse cx="1302" cy="534" rx="10" ry="16" fill="#a3763a" transform="rotate(14 1302 534)" />
      </g>

      {/* birds */}
      <g className="hs-bird" fill="none" stroke="#1a1030" strokeWidth="3" strokeLinecap="round">
        <path d="M0 0 q12 -12 24 0 q12 -12 24 0" transform="translate(300 170)" />
        <path d="M0 0 q9 -9 18 0 q9 -9 18 0" transform="translate(360 196)" />
        <path d="M0 0 q8 -8 16 0 q8 -8 16 0" transform="translate(262 210)" />
      </g>

      {/* drifting dust */}
      <g fill="#fcd9a0">
        {DUST.map((d, i) => (
          <circle key={i} className="hs-dust" cx={d.x} cy={d.y} r={d.r} opacity=".5" style={{ ['--d' as string]: `${d.d}s`, animationDelay: `${d.delay}s` }} />
        ))}
      </g>
    </svg>
  );
}
