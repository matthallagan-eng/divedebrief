// The unlockable creatures (app/achievements.py), one drawing each. They face
// right. The body fills with currentColor and the details with var(--accent),
// so the same drawing works as a faint background shape and in full colour.

import type { ReactNode } from "react";

const A = "var(--accent)";
const EYE = "var(--eye, #030d15)";

function Svg({ w, h, children }: { w: number; h: number; children: ReactNode }) {
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-full w-full overflow-visible" fill="currentColor">
      {children}
    </svg>
  );
}

const Eye = ({ x, y, r = 2.4 }: { x: number; y: number; r?: number }) => <circle cx={x} cy={y} r={r} fill={EYE} />;

// ---------- Common ----------

export const Clownfish = () => (
  <Svg w={100} h={56}>
    <path d="M20 28 L3 12 Q8 28 3 44 Z" />
    <path d="M38 12 Q52 -1 68 11 Z" />
    <ellipse cx={55} cy={28} rx={38} ry={19} />
    <path d="M40 46 Q50 56 58 46 Z" />
    <path fill={A} d="M36 12 Q31 28 36 44 L43 46 Q38 28 43 10 Z" />
    <path fill={A} d="M60 9 Q55 28 60 47 L67 46 Q62 28 67 10 Z" />
    <path fill={A} d="M84 16 Q81 28 84 40 L88 37 Q86 28 88 19 Z" />
    <Eye x={82} y={24} />
  </Svg>
);

export const SergeantMajor = () => (
  <Svg w={120} h={60}>
    {[
      [0, 18, 1],
      [38, 2, 0.85],
      [60, 32, 0.75],
    ].map(([x, y, s], i) => (
      <g key={i} transform={`translate(${x} ${y}) scale(${s})`}>
        <path d="M10 18 L0 6 L2 18 L0 30 Z" />
        <ellipse cx={30} cy={18} rx={22} ry={13} />
        <path d="M20 6 Q32 -2 42 7 Z" />
        {[20, 28, 36, 44].map((sx) => (
          <rect key={sx} x={sx} y={6} width={2.6} height={24} rx={1.3} fill={A} />
        ))}
        <Eye x={46} y={15} r={1.8} />
      </g>
    ))}
  </Svg>
);

export const HermitCrab = () => (
  <Svg w={90} h={60}>
    {/* Spiral shell carried on its back */}
    <path fill={A} d="M8 44 C2 24 18 6 40 8 C60 10 66 30 56 42 C50 50 32 52 8 44 Z" />
    <path d="M20 36 C18 24 30 18 40 22 C48 26 46 36 38 38 C32 40 28 34 32 30" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" />
    <path d="M52 40 C60 34 70 34 74 40 L74 46 L52 48 Z" />
    <path d="M70 34 L76 22 M74 34 L82 24" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" />
    <circle cx={76} cy={21} r={2.2} fill={EYE} />
    <circle cx={82} cy={23} r={2.2} fill={EYE} />
    <path d="M74 42 C84 40 88 46 84 50 C80 52 76 50 74 46 Z" />
    {[54, 60, 66].map((x) => (
      <path key={x} d={`M${x} 46 L${x - 6} 58`} stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" />
    ))}
  </Svg>
);

export const Starfish = () => (
  <Svg w={60} h={60}>
    <path d="M30 2 C33 14 36 20 44 21 C52 22 58 23 58 24 C50 30 44 34 46 42 C48 50 50 57 49 58 C42 52 36 48 30 48 C24 48 18 52 11 58 C10 57 12 50 14 42 C16 34 10 30 2 24 C2 23 8 22 16 21 C24 20 27 14 30 2 Z" />
    {[
      [30, 12], [30, 18], [46, 25], [40, 27], [42, 48], [38, 41], [18, 48], [22, 41], [14, 25], [20, 27], [30, 30],
    ].map(([x, y], i) => (
      <circle key={i} cx={x} cy={y} r={1.6} fill={A} />
    ))}
  </Svg>
);

export const BlueTang = () => (
  <Svg w={100} h={60}>
    <path fill={A} d="M22 30 L4 12 Q10 30 4 48 Z" />
    <path d="M18 30 C30 6 62 0 82 14 C92 21 96 28 96 32 C90 44 70 56 46 54 C32 52 22 42 18 30 Z" />
    <path fill={A} d="M24 30 L28 28 L28 33 Z" />
    <path d="M40 10 Q50 34 34 44 Q58 40 70 18" fill="none" stroke={EYE} strokeOpacity={0.55} strokeWidth={4} strokeLinecap="round" />
    <Eye x={84} y={24} />
  </Svg>
);

export const Butterflyfish = () => (
  <Svg w={80} h={70}>
    <path d="M14 36 L2 26 L4 36 L2 46 Z" />
    <path d="M10 36 C14 10 44 2 62 18 C70 25 76 32 78 36 C74 42 70 48 62 54 C44 70 14 62 10 36 Z" />
    <path d="M62 30 L78 33 L62 38 Z" />
    <path fill={A} d="M54 14 L60 16 L60 56 L54 58 Z" />
    <circle cx={30} cy={44} r={5} fill={EYE} opacity={0.7} />
    <Eye x={67} y={30} r={2} />
  </Svg>
);

export const CleanerShrimp = () => (
  <Svg w={100} h={50}>
    <path d="M10 30 C10 18 28 14 46 16 C64 18 80 22 84 28 C80 34 64 38 46 38 C30 38 18 40 10 30 Z" />
    <path d="M10 30 L2 22 L4 30 L2 38 Z" />
    <path fill={A} d="M30 16 L34 16 L34 38 L30 38 Z M48 16 L52 16 L52 38 L48 38 Z M64 18 L68 19 L68 36 L64 37 Z" />
    {/* Long white feelers, its "come and get cleaned" signal */}
    <path d="M84 26 C92 10 96 4 99 2 M84 28 C94 20 98 18 100 18" fill="none" stroke={A} strokeWidth={1.4} strokeLinecap="round" />
    {[36, 46, 56, 66].map((x) => (
      <path key={x} d={`M${x} 38 L${x - 4} 48`} stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" />
    ))}
    <Eye x={80} y={25} r={2} />
  </Svg>
);

export const Pufferfish = () => (
  <Svg w={84} h={70}>
    <path d="M14 35 L2 25 L5 35 L2 45 Z" />
    <circle cx={44} cy={35} r={30} />
    {Array.from({ length: 16 }, (_, i) => {
      const a = (i / 16) * Math.PI * 2;
      const x = 44 + Math.cos(a) * 30;
      const y = 35 + Math.sin(a) * 30;
      return <path key={i} d={`M${x} ${y} L${44 + Math.cos(a) * 36} ${35 + Math.sin(a) * 36}`} stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" />;
    })}
    {[
      [30, 22], [40, 18], [52, 22], [26, 34], [36, 30], [48, 32], [34, 44], [46, 46], [24, 46],
    ].map(([x, y], i) => (
      <circle key={i} cx={x} cy={y} r={2.4} fill={A} />
    ))}
    <circle cx={64} cy={28} r={5} fill="#f6efe6" opacity={0.9} />
    <Eye x={65} y={28} r={2.6} />
    <ellipse cx={74} cy={40} rx={3} ry={2} fill={EYE} opacity={0.6} />
  </Svg>
);

export const MoonJellyfish = () => (
  <Svg w={70} h={90}>
    <path d="M4 32 C4 10 22 2 35 2 C48 2 66 10 66 32 C58 36 46 34 35 36 C24 34 12 36 4 32 Z" opacity={0.85} />
    {/* The four pale rings that give it its name */}
    {[[24, 20], [46, 20], [30, 28], [40, 28]].map(([x, y], i) => (
      <circle key={i} cx={x} cy={y} r={5} fill="none" stroke={A} strokeWidth={2.2} />
    ))}
    {[10, 20, 30, 40, 50, 60].map((x, i) => (
      <path key={x} d={`M${x} 34 C${x + (i % 2 ? 4 : -4)} 50 ${x + (i % 2 ? -4 : 4)} 66 ${x} 88`} fill="none" stroke="currentColor" strokeWidth={1.4} opacity={0.7} />
    ))}
    <path d="M28 36 C26 52 32 60 30 74 M42 36 C44 52 38 60 40 74" fill="none" stroke={A} strokeWidth={3} strokeLinecap="round" opacity={0.8} />
  </Svg>
);

export const Bluegill = () => (
  <Svg w={100} h={64}>
    <path d="M20 32 L4 16 Q9 32 4 48 Z" />
    <path d="M16 32 C26 6 64 2 84 18 C92 24 96 30 96 33 C92 42 76 58 52 58 C32 58 20 46 16 32 Z" />
    <path d="M34 8 C46 0 60 2 70 8 L60 14 Z" />
    {[36, 46, 56, 66].map((x) => (
      <path key={x} d={`M${x} 12 C${x - 3} 30 ${x - 3} 40 ${x} 54`} fill="none" stroke={EYE} strokeOpacity={0.25} strokeWidth={3} />
    ))}
    {/* The dark "ear" flap behind the gill */}
    <ellipse cx={74} cy={32} rx={5} ry={4} fill={A} />
    <Eye x={84} y={26} />
  </Svg>
);

export const SeaUrchin = () => (
  <Svg w={70} h={56}>
    {Array.from({ length: 19 }, (_, i) => {
      const a = Math.PI + (i / 18) * Math.PI;
      return <path key={i} d={`M35 40 L${35 + Math.cos(a) * 34} ${40 + Math.sin(a) * 36}`} stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" />;
    })}
    <ellipse cx={35} cy={44} rx={20} ry={12} />
    {[24, 31, 38, 45].map((x) => (
      <circle key={x} cx={x} cy={42} r={1.6} fill={A} />
    ))}
  </Svg>
);

export const ScubaDiver = () => (
  <Svg w={130} h={60}>
    {/* Fins, legs, body with a tank, head with a mask, one arm forward */}
    <path d="M2 18 L22 26 L22 34 L2 44 L8 31 Z" />
    <path d="M20 26 C34 22 46 24 58 26 L58 36 C46 38 34 38 20 34 Z" />
    <path d="M56 22 C70 16 90 16 100 22 C104 26 104 34 100 38 C90 42 70 42 56 38 Z" />
    <rect x={62} y={10} width={30} height={11} rx={5.5} fill={A} />
    <circle cx={110} cy={28} r={10} />
    <path d="M110 22 L120 22 Q123 28 120 32 L110 32 Z" fill={A} opacity={0.9} />
    <path d="M96 34 C108 40 118 44 126 42" fill="none" stroke="currentColor" strokeWidth={5} strokeLinecap="round" />
    <path d="M92 14 C100 8 106 10 110 18" fill="none" stroke="currentColor" strokeWidth={2.2} />
    {[[104, 10, 3], [100, 4, 2.2], [107, 1, 1.6]].map(([x, y, r], i) => (
      <circle key={i} cx={x} cy={y} r={r} fill="none" stroke={A} strokeWidth={1.2} />
    ))}
  </Svg>
);

// ---------- Uncommon ----------

const OCTOPUS_ARMS = [
  "M46 32 C36 30 26 22 14 26 C6 29 6 38 13 37",
  "M47 36 C36 38 26 34 16 40 C8 45 10 54 17 51",
  "M50 38 C42 46 34 46 26 54 C20 60 24 68 30 64",
  "M54 39 C50 50 44 54 42 62 C40 68 46 70 49 66",
  "M58 38 C60 48 56 56 60 62 C63 67 69 64 67 60",
  "M44 30 C38 24 32 14 22 12 C14 11 12 18 18 19",
];


export const Seahorse = () => (
  <Svg w={50} h={90}>
    <path d="M30 4 C40 4 46 10 44 18 L56 20 L44 26 C42 32 36 36 34 44 C32 52 38 58 36 66 C34 76 24 84 18 82 C12 80 14 72 20 72 C26 72 26 78 22 78 C30 72 26 62 22 54 C18 46 18 36 22 28 C24 22 20 16 22 10 C24 6 26 4 30 4 Z" />
    <path d="M24 14 L16 10 L20 18 Z M20 32 L12 32 L20 38 Z M20 48 L12 50 L20 54 Z" fill={A} />
    {[34, 40, 46, 52, 58].map((y) => (
      <path key={y} d={`M22 ${y} L34 ${y - 2}`} stroke={A} strokeWidth={1.4} opacity={0.7} />
    ))}
    <Eye x={34} y={12} r={2} />
  </Svg>
);

export const Octopus = () => (
  <Svg w={90} h={70}>
    {/* Jetting along, mantle first, arms trailing in curls */}
    {OCTOPUS_ARMS.map((d, i) => (
      <path key={i} d={d} fill="none" stroke="currentColor" strokeWidth={4.6 - (i % 3) * 0.6} strokeLinecap="round" />
    ))}
    <ellipse cx={64} cy={22} rx={21} ry={16} transform="rotate(-24 64 22)" />
    {[[30, 54], [36, 49], [44, 58], [24, 44]].map(([x, y], i) => (
      <circle key={i} cx={x} cy={y} r={1.3} fill={A} />
    ))}
    {[[66, 14], [74, 20], [60, 22]].map(([x, y], i) => (
      <circle key={i} cx={x} cy={y} r={2.4} fill={A} />
    ))}
    <Eye x={56} y={31} r={2.6} />
  </Svg>
);

export const GreenTurtle = () => (
  <Svg w={110} h={64}>
    <path d="M30 22 C20 8 10 4 4 4 C10 12 16 20 26 28 Z" />
    <path d="M30 42 C20 54 12 60 6 60 C12 52 18 46 28 38 Z" />
    <path d="M78 22 C88 8 98 2 104 4 C98 12 92 20 84 26 Z" />
    <path d="M80 42 C88 52 92 58 96 60 C90 58 82 50 76 44 Z" />
    <path d="M86 28 C96 24 108 28 108 32 C108 36 96 40 86 36 Z" />
    <ellipse cx={56} cy={32} rx={32} ry={20} fill={A} />
    {/* Shell plates */}
    <path d="M44 16 L56 24 L68 16 M56 24 L56 40 M44 48 L56 40 L68 48 M32 32 L44 28 L56 24 M80 32 L68 28 L56 24 M44 28 L44 38 L56 40 M68 28 L68 38 L56 40" fill="none" stroke="currentColor" strokeWidth={1.6} opacity={0.6} />
    <Eye x={100} y={30} r={1.8} />
  </Svg>
);

export const Parrotfish = () => (
  <Svg w={110} h={56}>
    <path d="M22 28 L4 10 Q12 28 4 46 Z" />
    <path d="M18 28 C28 8 64 4 88 14 C98 18 104 24 106 30 C102 38 92 46 70 50 C46 54 26 46 18 28 Z" />
    {/* Scale pattern and the beak it crunches coral with */}
    {[34, 46, 58, 70].map((x) =>
      [18, 30, 42].map((y) => <path key={`${x}-${y}`} d={`M${x} ${y} q5 -5 10 0`} fill="none" stroke={A} strokeWidth={1.8} />),
    )}
    <path d="M98 24 L108 28 L100 34 Z" fill={A} />
    <path d="M40 46 Q56 58 64 48 Z" />
    <Eye x={92} y={22} />
  </Svg>
);

export const MorayEel = () => (
  <Svg w={140} h={50}>
    <path d="M2 30 C20 20 34 38 52 30 C70 22 84 18 104 20 C116 20 128 22 136 28 C132 34 120 36 108 34 C90 32 74 40 56 40 C38 40 22 34 2 30 Z" />
    <path d="M30 26 C50 16 80 12 110 16" fill="none" stroke="currentColor" strokeWidth={3} />
    {Array.from({ length: 22 }, (_, i) => (
      <circle key={i} cx={14 + i * 5.4} cy={28 + Math.sin(i) * 3} r={1.4} fill={A} />
    ))}
    <path d="M124 30 L136 28 L126 33 Z" fill={EYE} opacity={0.7} />
    <Eye x={120} y={24} />
  </Svg>
);

export const Cuttlefish = () => (
  <Svg w={110} h={50}>
    {/* The rippling fin skirt it hovers with, then a body that flashes stripes */}
    <path d="M8 24 C10 4 32 0 56 1 C78 2 92 8 96 22 C92 40 78 48 56 48 C32 48 10 44 8 24 Z" fill={A} opacity={0.55} />
    <path d="M12 24 C12 10 30 6 56 6 C76 6 88 12 92 24 C88 36 76 42 56 42 C30 42 12 38 12 24 Z" />
    {[30, 44, 58, 72].map((x) => (
      <path key={x} d={`M${x} 12 q4 12 0 24`} fill="none" stroke={A} strokeWidth={2} opacity={0.7} />
    ))}
    {[0, 1, 2, 3].map((i) => (
      <path key={i} d={`M92 ${18 + i * 4} C100 ${16 + i * 5} 104 ${18 + i * 5} 108 ${16 + i * 6}`} fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" />
    ))}
    <Eye x={84} y={20} r={2.6} />
  </Svg>
);

export const Nudibranch = () => (
  <Svg w={90} h={40}>
    <path d="M4 34 C10 22 30 18 50 18 C66 18 78 22 84 30 C86 34 82 36 76 36 L8 36 Z" />
    <path d="M6 34 C20 30 40 30 60 32 C70 33 78 34 84 32" fill="none" stroke={A} strokeWidth={2.4} />
    {/* Rhinophores up front, a frilly gill plume behind */}
    <path d="M70 20 L74 6 M76 22 L82 8" stroke={A} strokeWidth={3} strokeLinecap="round" />
    {[[18, 18], [22, 12], [26, 16], [14, 14], [30, 20]].map(([x, y], i) => (
      <path key={i} d={`M22 22 L${x} ${y}`} stroke={A} strokeWidth={2.4} strokeLinecap="round" />
    ))}
    {[40, 50, 60].map((x) => (
      <circle key={x} cx={x} cy={26} r={2} fill={A} />
    ))}
  </Svg>
);

export const Stingray = () => (
  <Svg w={120} h={70}>
    <path d="M60 4 C80 6 100 24 114 34 C100 44 80 62 60 64 C40 62 24 50 22 34 C24 18 40 6 60 4 Z" />
    <path d="M24 34 C14 34 8 34 2 34" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" />
    <path d="M8 34 L14 30 L14 38 Z" fill={A} />
    <path d="M36 34 C50 26 74 26 96 34" fill="none" stroke={A} strokeWidth={1.6} opacity={0.6} />
    <Eye x={88} y={28} r={2} />
    <Eye x={88} y={40} r={2} />
  </Svg>
);

export const Barracuda = () => (
  <Svg w={150} h={36}>
    <path d="M18 18 L2 6 L8 18 L2 30 Z" />
    <path d="M14 18 C30 8 80 6 120 10 C134 12 144 16 148 18 C144 22 134 25 120 26 C80 30 30 28 14 18 Z" />
    <path d="M50 10 L58 2 L64 9 Z M86 9 L92 3 L96 9 Z M60 27 L66 34 L70 27 Z" />
    {Array.from({ length: 9 }, (_, i) => (
      <path key={i} d={`M${34 + i * 10} 11 l-3 12`} stroke={A} strokeWidth={2} opacity={0.7} />
    ))}
    <path d="M134 19 L148 18" stroke={EYE} strokeWidth={1} />
    <Eye x={130} y={15} r={2} />
  </Svg>
);

export const GoliathGrouper = () => (
  <Svg w={130} h={70}>
    <path d="M26 36 L4 20 Q10 36 4 52 Z" />
    <path d="M20 36 C28 12 60 6 92 10 C112 12 124 22 128 34 C126 48 112 60 88 62 C58 66 28 58 20 36 Z" />
    <path d="M38 12 C56 2 78 2 94 8 L84 14 Z" />
    {/* Mottled bands and a wide mouth */}
    {[40, 58, 76].map((x) => (
      <path key={x} d={`M${x} 14 C${x - 6} 30 ${x + 4} 44 ${x - 2} 60`} fill="none" stroke={A} strokeWidth={6} strokeLinecap="round" opacity={0.6} />
    ))}
    <path d="M112 42 C120 44 126 42 128 38" fill="none" stroke={EYE} strokeWidth={2} />
    <Eye x={112} y={26} r={3} />
  </Svg>
);

export const CleanerWrasse = () => (
  <Svg w={100} h={30}>
    <path d="M14 15 L2 6 L5 15 L2 24 Z" />
    <path d="M10 15 C24 4 64 4 84 8 C92 10 98 13 98 15 C98 17 92 20 84 22 C64 26 24 26 10 15 Z" />
    {/* The black stripe nose to tail that tells reef fish "I'm the cleaner" */}
    <path d="M6 15 C30 13 60 13 96 14 L96 17 C60 18 30 18 6 17 Z" fill={A} />
    <Eye x={88} y={12} r={1.8} />
  </Svg>
);

export const LargemouthBass = () => (
  <Svg w={120} h={50}>
    <path d="M22 25 L4 10 Q10 25 4 40 Z" />
    <path d="M18 25 C28 8 62 4 94 8 C108 10 116 16 118 22 C116 32 104 42 84 44 C56 48 28 42 18 25 Z" />
    <path d="M40 8 L48 0 L56 7 Z M60 7 L70 2 L78 7 Z" />
    <path d="M20 26 C40 30 70 30 104 24" fill="none" stroke={A} strokeWidth={4} strokeDasharray="7 3" />
    {/* The big mouth it's named for */}
    <path d="M104 28 L120 26 L112 34 Z" fill={EYE} opacity={0.5} />
    <Eye x={104} y={18} />
  </Svg>
);

export const Crayfish = () => (
  <Svg w={110} h={50}>
    <path d="M4 26 L14 18 L14 34 Z" />
    <path d="M12 26 C14 18 30 16 44 18 L76 18 C84 20 88 24 88 26 C88 28 84 32 76 34 L44 34 C30 36 14 34 12 26 Z" />
    {[22, 30, 38].map((x) => (
      <path key={x} d={`M${x} 18 L${x} 34`} stroke={A} strokeWidth={1.6} opacity={0.7} />
    ))}
    <path d="M80 20 C90 10 100 8 104 10 C102 14 96 16 90 18 Z M80 32 C90 42 100 44 104 42 C102 38 96 36 90 34 Z" />
    <path d="M86 22 C96 16 104 16 108 18 M86 30 C96 36 104 36 108 34" fill="none" stroke="currentColor" strokeWidth={1.2} />
    {[50, 58, 66].map((x) => (
      <path key={x} d={`M${x} 34 L${x - 4} 44`} stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
    ))}
    <Eye x={82} y={23} r={1.8} />
  </Svg>
);

export const Lionfish = () => (
  <Svg w={110} h={80}>
    <path d="M22 40 L8 30 L10 40 L8 50 Z" />
    <path d="M18 40 C24 28 50 24 74 28 C88 30 96 36 98 40 C96 46 86 52 72 52 C50 54 26 50 18 40 Z" />
    {/* Venomous spines fanned over the back, feathery fins below */}
    {Array.from({ length: 11 }, (_, i) => (
      <path key={i} d={`M${34 + i * 4} 30 L${22 + i * 6} ${2 + Math.abs(i - 5) * 2}`} stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" />
    ))}
    {Array.from({ length: 7 }, (_, i) => (
      <path key={i} d={`M64 48 C${56 - i * 4} ${58 + i * 2} ${46 - i * 4} ${66 + i} ${38 - i * 4} ${70 + i}`} fill="none" stroke="currentColor" strokeWidth={1.6} />
    ))}
    {[34, 44, 54, 64, 74].map((x) => (
      <path key={x} d={`M${x} 28 C${x - 3} 38 ${x - 3} 44 ${x} 52`} fill="none" stroke={A} strokeWidth={3} />
    ))}
    <Eye x={88} y={36} />
  </Svg>
);

// ---------- Rare ----------

export const MantaRay = () => (
  <Svg w={140} h={70}>
    <path d="M70 24 C90 22 112 10 138 2 C126 22 108 40 88 46 C82 48 76 52 70 52 C64 52 58 48 52 46 C32 40 14 22 2 2 C28 10 50 22 70 24 Z" />
    <path d="M70 52 C70 60 68 66 64 70" fill="none" stroke="currentColor" strokeWidth={2} />
    {/* Cephalic fins and the pale shoulder marks every manta has */}
    <path d="M62 24 C60 16 62 12 64 10 M78 24 C80 16 78 12 76 10" stroke="currentColor" strokeWidth={4} strokeLinecap="round" />
    <path d="M50 28 C44 26 38 22 34 18 C42 20 48 22 52 24 Z M90 28 C96 26 102 22 106 18 C98 20 92 22 88 24 Z" fill={A} />
  </Svg>
);

export const EagleRay = () => (
  <Svg w={140} h={80}>
    <path d="M80 24 C98 22 118 14 138 8 C128 28 110 44 92 50 C86 54 80 56 72 56 C64 56 58 52 54 48 C36 44 18 30 6 10 C28 18 46 24 62 26 C68 22 74 22 80 24 Z" />
    <path d="M56 50 C42 58 28 66 14 72" fill="none" stroke="currentColor" strokeWidth={1.8} />
    <path d="M80 30 C88 30 94 34 96 38 C92 38 86 36 80 34 Z" />
    {[[70, 36], [80, 40], [62, 38], [96, 30], [106, 26], [48, 34], [38, 30], [88, 42], [56, 42], [114, 22], [28, 26]].map(([x, y], i) => (
      <circle key={i} cx={x} cy={y} r={2} fill={A} />
    ))}
  </Svg>
);

export const BlacktipShark = () => (
  <Svg w={140} h={50}>
    <path d="M22 26 L2 6 L10 26 L4 44 Z" />
    <path d="M14 26 C34 16 74 12 106 16 C122 18 134 22 140 27 C132 31 120 33 104 33 C80 35 40 35 14 28 Z" />
    <path d="M64 15 L76 2 L82 15 Z" />
    <path d="M86 32 L74 48 L98 33 Z" />
    {/* Black tips on every fin */}
    <path d="M73 5 L76 2 L78 8 Z M78 44 L74 48 L82 44 Z M3 7 L2 6 L8 12 Z M4 44 L6 38 L8 40 Z" fill={A} />
    <Eye x={124} y={23} r={1.6} />
  </Svg>
);

export const Dolphins = () => (
  <Svg w={170} h={70}>
    {[
      [0, 26, 1],
      [60, 4, 0.85],
      [86, 38, 0.75],
    ].map(([x, y, s], i) => (
      <g key={i} transform={`translate(${x} ${y}) scale(${s})`}>
        <path d="M14 22 L2 10 L6 22 L2 34 Z" />
        <path d="M10 22 C24 10 52 6 74 10 C84 12 92 16 96 20 L106 20 C104 22 100 24 96 24 C88 30 70 34 48 32 C30 32 16 28 10 22 Z" />
        <path d="M50 10 C54 2 60 0 64 0 C60 4 58 8 58 12 Z" />
        <path d="M56 30 L48 40 L64 31 Z" />
        <path d="M22 24 C40 28 70 28 92 22" fill="none" stroke={A} strokeWidth={2.2} opacity={0.7} />
        <Eye x={86} y={17} r={1.6} />
      </g>
    ))}
  </Svg>
);

export const SeaLion = () => (
  <Svg w={130} h={56}>
    <path d="M16 30 L2 18 L6 32 L2 44 Z" />
    <path d="M10 32 C20 20 46 14 76 14 C96 14 110 16 118 20 C126 22 128 28 124 32 C118 36 108 34 100 36 C80 42 44 44 10 32 Z" />
    <path d="M64 36 C60 46 52 54 44 56 C50 50 54 44 54 38 Z" />
    <path d="M118 20 C120 18 124 18 126 20" fill="none" stroke={A} strokeWidth={1.4} />
    {[[122, 26], [122, 29]].map(([x, y], i) => (
      <path key={i} d={`M${x} ${y} l8 ${i ? 2 : -1}`} stroke={A} strokeWidth={0.8} />
    ))}
    <Eye x={114} y={22} r={2} />
  </Svg>
);

export const Frogfish = () => (
  <Svg w={80} h={70}>
    <path d="M10 40 C6 22 20 8 40 8 C60 8 74 20 74 38 C74 56 60 66 40 66 C22 66 12 56 10 40 Z" />
    {/* The lure on its head, and stubby "hands" it walks on */}
    <path d="M54 12 C58 4 64 2 68 2" fill="none" stroke="currentColor" strokeWidth={1.6} />
    <circle cx={68} cy={3} r={3} fill={A} />
    <path d="M30 64 C28 70 20 70 18 66 M50 64 C52 70 60 70 62 66" fill="none" stroke="currentColor" strokeWidth={5} strokeLinecap="round" />
    {[[24, 24], [34, 40], [22, 46], [46, 54], [30, 56], [44, 28], [56, 46]].map(([x, y], i) => (
      <circle key={i} cx={x} cy={y} r={3.4} fill={A} opacity={0.7} />
    ))}
    <path d="M58 46 C64 48 70 46 72 42" fill="none" stroke={EYE} strokeWidth={2} />
    <Eye x={62} y={26} r={3} />
  </Svg>
);

export const Mandarinfish = () => (
  <Svg w={90} h={50}>
    <path d="M16 26 L2 14 L6 26 L2 38 Z" />
    <path d="M12 26 C20 10 46 6 66 10 C78 12 86 18 88 26 C86 34 78 40 66 42 C46 46 20 42 12 26 Z" />
    <path d="M36 10 C40 2 48 0 54 4 L50 10 Z" />
    {/* Psychedelic swirls */}
    {[[30, 20], [48, 18], [40, 32], [60, 30], [22, 28], [70, 20]].map(([x, y], i) => (
      <path key={i} d={`M${x} ${y} c4 -6 10 -2 8 3 c-2 4 -8 3 -6 -1`} fill="none" stroke={A} strokeWidth={2.4} strokeLinecap="round" />
    ))}
    <Eye x={78} y={22} r={2.4} />
  </Svg>
);

export const LeafySeadragon = () => (
  <Svg w={130} h={70}>
    <path d="M4 40 C16 34 30 40 44 36 C60 32 72 28 86 30 C96 32 102 30 108 26 L126 24 L110 32 C100 36 90 38 80 40 C64 44 50 46 36 46 C22 46 12 44 4 40 Z" />
    {/* Leafy camouflage sprouting everywhere */}
    {[
      [20, 40, -1], [34, 38, -1], [52, 34, -1], [70, 30, -1], [88, 30, -1],
      [26, 44, 1], [46, 44, 1], [64, 42, 1], [82, 40, 1],
    ].map(([x, y, d], i) => (
      <path key={i} d={`M${x} ${y} C${x - 6} ${y + d * 10} ${x + 2} ${y + d * 18} ${x + 8} ${y + d * 20} C${x + 6} ${y + d * 12} ${x + 4} ${y + d * 6} ${x + 2} ${y}`} fill={A} />
    ))}
    <Eye x={104} y={27} r={1.8} />
  </Svg>
);

export const SpanishDancer = () => (
  <Svg w={110} h={60}>
    {/* A nudibranch that swims by flexing its frilled mantle like a flamenco skirt */}
    <path d="M10 30 C20 6 50 2 74 10 C90 16 104 22 106 30 C104 38 90 46 74 50 C50 58 20 54 10 30 Z" />
    <path d="M10 30 C14 12 30 2 50 4 C40 8 30 14 24 22 M10 30 C14 48 30 58 50 56 C40 52 30 46 24 38" fill="none" stroke={A} strokeWidth={4} strokeLinecap="round" />
    <path d="M30 6 C50 2 80 8 100 22 M30 54 C50 58 80 52 100 38" fill="none" stroke={A} strokeWidth={2.4} strokeDasharray="6 4" />
    <path d="M100 24 L108 14 M102 34 L110 30" stroke={A} strokeWidth={2.4} strokeLinecap="round" />
  </Svg>
);

export const NapoleonWrasse = () => (
  <Svg w={140} h={76}>
    <path d="M26 40 L4 24 Q12 40 4 56 Z" />
    <path d="M20 40 C26 18 56 8 88 8 C104 8 116 4 124 10 C134 18 138 30 136 42 C132 58 112 68 84 68 C52 70 28 60 20 40 Z" />
    {/* The bulging forehead hump and maze of lines on its face */}
    <path d="M104 8 C116 0 128 4 130 14 Z" />
    {[[104, 32], [110, 40], [100, 46]].map(([x, y], i) => (
      <path key={i} d={`M${x} ${y} c6 -3 10 2 16 -1 c4 -2 8 0 10 2`} fill="none" stroke={A} strokeWidth={1.8} />
    ))}
    {[40, 52, 64, 76, 88].map((x) => (
      <path key={x} d={`M${x} 16 C${x - 4} 34 ${x - 4} 50 ${x} 64`} fill="none" stroke={A} strokeWidth={1.4} opacity={0.6} />
    ))}
    <path d="M126 44 C132 46 136 44 136 40" fill="none" stroke={EYE} strokeWidth={2.4} />
    <Eye x={122} y={26} r={2.6} />
  </Svg>
);

export const Batfish = () => (
  <Svg w={140} h={80}>
    {[
      [0, 10, 1],
      [56, 0, 0.8],
      [72, 38, 0.85],
    ].map(([x, y, s], i) => (
      <g key={i} transform={`translate(${x} ${y}) scale(${s})`}>
        <path d="M10 34 L2 26 L4 34 L2 42 Z" />
        <path d="M8 34 C10 26 18 18 30 16 C38 6 44 0 48 0 C46 10 46 14 48 18 C54 22 58 28 58 34 C58 40 54 46 48 50 C46 54 46 58 48 68 C44 68 38 62 30 52 C18 50 10 42 8 34 Z" />
        <path d="M40 20 C38 30 38 40 40 50 M50 22 C48 30 48 38 50 46" fill="none" stroke={A} strokeWidth={3.2} />
        <Eye x={52} y={30} r={1.8} />
      </g>
    ))}
  </Svg>
);

export const GardenEels = () => (
  <Svg w={120} h={70}>
    {/* A colony swaying up out of their burrows in the sand */}
    {[
      [10, 40, 1], [30, 22, -1], [52, 34, 1], [74, 18, -1], [96, 30, 1],
    ].map(([x, top, d], i) => (
      <g key={i}>
        <path d={`M${x} 70 C${x} 60 ${x + d * 6} ${top + 22} ${x + d * 2} ${top + 6} C${x} ${top} ${x + d * 6} ${top - 4} ${x + d * 10} ${top + 2}`} fill="none" stroke="currentColor" strokeWidth={5} strokeLinecap="round" />
        {[0.3, 0.55, 0.8].map((t) => (
          <circle key={t} cx={x + d * 3 * t} cy={70 - (70 - top) * t} r={1.4} fill={A} />
        ))}
        <ellipse cx={x} cy={69} rx={7} ry={2} fill={A} opacity={0.4} />
      </g>
    ))}
  </Svg>
);

export const OceanSunfish = () => (
  <Svg w={100} h={110}>
    {/* The mola: a huge round body that just... ends, with tall fins top and bottom */}
    <path d="M14 55 C14 26 40 14 64 16 C84 18 96 34 96 55 C96 76 84 92 64 94 C40 96 14 84 14 55 Z" />
    <path d="M50 18 C52 8 56 2 62 0 C64 6 64 12 62 18 Z M50 92 C52 102 56 108 62 110 C64 104 64 98 62 92 Z" />
    <path d="M14 40 C8 44 6 50 8 56 C6 62 8 68 14 72" fill={A} />
    <path d="M30 40 C40 46 50 48 64 44 M30 70 C40 64 50 62 64 66" fill="none" stroke={A} strokeWidth={1.6} opacity={0.6} />
    <Eye x={80} y={48} r={3} />
  </Svg>
);

// ---------- Epic ----------

export const WhaleShark = () => (
  <Svg w={220} h={70}>
    <path d="M36 34 L4 8 L16 34 L6 60 Z" />
    <path d="M26 34 C56 18 120 12 170 14 C192 16 210 22 218 32 C212 40 196 46 170 48 C120 52 60 50 26 36 Z" />
    <path d="M98 16 L114 2 L122 16 Z" />
    <path d="M136 46 L116 66 L150 47 Z" />
    {/* Checkerboard of spots and pale lines, a different pattern on every whale shark */}
    {Array.from({ length: 36 }, (_, i) => {
      const x = 60 + (i % 12) * 12 + (Math.floor(i / 12) % 2) * 6;
      const y = 22 + Math.floor(i / 12) * 8;
      return <circle key={i} cx={x} cy={y} r={2} fill={A} />;
    })}
    <path d="M200 38 L218 36" stroke={EYE} strokeWidth={2} />
    <Eye x={198} y={28} r={2} />
  </Svg>
);

export const Hammerheads = () => (
  <Svg w={190} h={80}>
    {[
      [0, 30, 1],
      [70, 4, 0.75],
      [90, 46, 0.7],
      [120, 22, 0.6],
    ].map(([x, y, s], i) => (
      <g key={i} transform={`translate(${x} ${y}) scale(${s})`}>
        <path d="M18 22 L2 4 L8 22 L4 36 Z" />
        <path d="M12 22 C30 14 64 10 92 12 C100 12 104 14 106 18 L106 26 C104 30 98 30 92 30 C64 32 30 30 12 24 Z" />
        <path d="M54 12 L64 0 L70 12 Z" />
        {/* The hammer */}
        <path d="M100 6 L112 4 L112 34 L100 32 Z" />
        <circle cx={111} cy={6} r={1.8} fill={EYE} />
        <circle cx={111} cy={32} r={1.8} fill={EYE} />
        <path d="M72 30 L64 40 L80 31 Z" fill={A} />
      </g>
    ))}
  </Svg>
);

export const Orcas = () => (
  <Svg w={200} h={80}>
    {[
      [0, 30, 1],
      [80, 10, 0.8],
      [100, 48, 0.65],
    ].map(([x, y, s], i) => (
      <g key={i} transform={`translate(${x} ${y}) scale(${s})`}>
        <path d="M20 26 L2 12 L8 26 L2 40 Z" />
        <path d="M14 26 C30 12 66 6 96 10 C110 12 118 18 120 26 C118 34 108 40 92 42 C64 46 30 42 14 26 Z" />
        <path d="M60 10 C62 -6 66 -12 70 -14 C70 -4 70 4 72 12 Z" />
        <path d="M80 40 L68 54 L92 42 Z" />
        {/* White eye patch, belly and saddle */}
        <ellipse cx={100} cy={20} rx={8} ry={3.6} fill={A} transform="rotate(-10 100 20)" />
        <path d="M60 36 C80 42 104 36 116 30 C110 38 96 42 76 42 C68 42 62 40 60 36 Z" fill={A} />
        <path d="M54 14 C60 12 70 12 76 14 C70 18 60 18 54 14 Z" fill={A} opacity={0.6} />
      </g>
    ))}
  </Svg>
);

export const GreatWhite = () => (
  <Svg w={200} h={70}>
    <path d="M30 34 L4 4 L16 34 L6 62 Z" />
    <path d="M22 34 C50 18 110 10 156 14 C178 16 192 24 198 34 C192 42 176 48 156 48 C110 54 50 50 22 36 Z" />
    <path d="M90 16 L108 0 L114 16 Z" />
    <path d="M124 46 L104 68 L140 47 Z" />
    {/* Pale belly line and a toothy grin */}
    <path d="M40 38 C80 44 140 46 194 36 C186 46 160 50 130 50 C90 50 60 46 40 38 Z" fill={A} />
    <path d="M168 40 L192 37" stroke={EYE} strokeWidth={2} />
    {[172, 177, 182, 187].map((x) => (
      <path key={x} d={`M${x} 39 l2 3 l2 -3`} fill={A} />
    ))}
    <Eye x={176} y={27} r={2.2} />
  </Svg>
);

export const SeaOtter = () => (
  <Svg w={140} h={64}>
    {/* Floating on its back, cracking a shell on its chest */}
    <path d="M2 46 C10 42 18 40 26 42 L24 48 C16 48 8 48 2 46 Z" />
    <path d="M20 44 C24 30 52 24 82 26 C102 27 114 30 118 38 C114 48 94 52 72 52 C46 52 26 52 20 44 Z" />
    <path d="M34 36 C50 28 80 28 106 32 C98 40 72 42 52 42 C44 42 38 40 34 36 Z" fill={A} opacity={0.6} />
    <ellipse cx={34} cy={32} rx={4} ry={6} transform="rotate(-20 34 32)" />
    <ellipse cx={42} cy={30} rx={4} ry={6} transform="rotate(-10 42 30)" />
    <circle cx={124} cy={34} r={13} />
    <circle cx={115} cy={23} r={3.6} />
    <circle cx={128} cy={22} r={3.6} />
    <ellipse cx={128} cy={39} rx={7} ry={5} fill={A} />
    <circle cx={131} cy={37} r={1.8} fill={EYE} />
    <Eye x={124} y={31} r={1.8} />
    <ellipse cx={96} cy={24} rx={7} ry={4.6} fill={A} />
    <circle cx={89} cy={27} r={3.4} />
    <circle cx={103} cy={27} r={3.4} />
    <path d="M10 56 C30 52 50 60 70 56 C90 52 110 60 130 56" fill="none" stroke={A} strokeWidth={1.6} opacity={0.5} />
  </Svg>
);

export const Narwhal = () => (
  <Svg w={220} h={60}>
    <path d="M20 30 L2 16 L8 30 L2 44 Z" />
    <path d="M14 30 C30 16 70 12 104 14 C122 16 134 22 138 30 C134 38 122 44 102 46 C70 48 30 44 14 30 Z" />
    <path d="M90 44 L80 56 L100 45 Z" />
    {/* The spiral tusk, a tooth up to 3 m long */}
    <path d="M136 26 L218 20 L218 22 L136 31 Z" fill={A} />
    {Array.from({ length: 10 }, (_, i) => (
      <path key={i} d={`M${144 + i * 7.5} ${25.6 - i * 0.55} l3 4`} stroke="currentColor" strokeOpacity={0.5} strokeWidth={1} />
    ))}
    {[[40, 22], [56, 28], [72, 20], [88, 26], [104, 22], [64, 36], [96, 36]].map(([x, y], i) => (
      <circle key={i} cx={x} cy={y} r={2.4} fill={A} opacity={0.5} />
    ))}
    <Eye x={124} y={28} r={1.8} />
  </Svg>
);

export const ThresherShark = () => (
  <Svg w={220} h={70}>
    {/* That tail: the upper lobe is as long as the shark, used to stun prey */}
    <path d="M86 36 C60 30 30 16 2 2 C24 22 50 36 82 42 Z" />
    <path d="M80 38 L66 50 L84 42 Z" />
    <path d="M78 38 C96 28 136 24 166 26 C186 28 200 32 206 38 C200 44 186 48 166 48 C136 52 98 48 78 40 Z" />
    <path d="M128 27 L140 12 L148 27 Z" />
    <path d="M162 46 L148 64 L176 47 Z" />
    <path d="M30 18 C50 28 64 34 84 40" fill="none" stroke={A} strokeWidth={1.4} opacity={0.6} />
    <Eye x={190} y={34} r={3} />
  </Svg>
);

export const Leatherback = () => (
  <Svg w={150} h={80}>
    {/* The biggest turtle alive: no hard shell, a leathery teardrop with ridges, and huge front flippers */}
    <path d="M100 28 C92 12 80 4 62 0 C72 10 82 22 92 32 Z" />
    <path d="M100 52 C92 68 80 76 62 80 C72 70 82 58 92 48 Z" />
    <path d="M36 30 C30 22 22 20 16 22 C20 28 26 32 34 34 Z" />
    <path d="M36 50 C30 58 22 60 16 58 C20 52 26 48 34 46 Z" />
    <path d="M6 40 C20 22 60 16 92 20 C110 22 118 30 118 40 C118 50 110 58 92 60 C60 64 20 58 6 40 Z" />
    {[30, 35, 40, 45, 50].map((y) => (
      <path key={y} d={`M12 40 C40 ${y - (40 - y) * 0.6} 80 ${y - (40 - y) * 0.4} 112 ${y}`} fill="none" stroke={A} strokeWidth={1.6} opacity={0.75} />
    ))}
    <path d="M116 36 C122 32 132 32 138 36 C142 40 140 46 134 48 C126 50 120 46 116 44 Z" />
    {[[60, 26], [80, 28], [70, 54], [50, 52], [96, 50]].map(([x, y], i) => (
      <circle key={i} cx={x} cy={y} r={1.8} fill={A} opacity={0.6} />
    ))}
    <Eye x={132} y={38} r={1.8} />
  </Svg>
);

export const Plankton = () => (
  <Svg w={120} h={80}>
    {/* A cloud of bioluminescent specks; the glow comes from the scene */}
    {Array.from({ length: 40 }, (_, i) => {
      const a = i * 2.39996;
      const r = Math.sqrt(i) * 6.2;
      return <circle key={i} cx={60 + Math.cos(a) * r * 1.4} cy={40 + Math.sin(a) * r * 0.9} r={i % 5 === 0 ? 2.6 : 1.4} fill={i % 3 ? "currentColor" : A} />;
    })}
  </Svg>
);

export const ResearchSub = () => (
  <Svg w={170} h={70}>
    <path d="M24 40 C24 26 50 20 90 20 C130 20 156 28 160 40 C156 52 130 60 90 60 C50 60 24 54 24 40 Z" />
    <path d="M70 20 L76 6 L104 6 L110 20 Z" />
    <path d="M88 6 L88 0 L96 0" fill="none" stroke="currentColor" strokeWidth={2} />
    <path d="M24 40 L10 30 L10 50 Z" />
    <path d="M2 32 L10 30 L10 50 L2 48 Z" fill={A} />
    {[60, 84, 108].map((x) => (
      <circle key={x} cx={x} cy={38} r={6} fill={A} />
    ))}
    <path d="M150 40 L168 34 L168 46 Z" fill={A} opacity={0.6} />
  </Svg>
);

// ---------- Legendary ----------

export const BlueWhale = () => (
  <Svg w={300} h={90}>
    <path d="M38 44 L2 22 L16 44 L4 68 Z" />
    <path d="M28 44 C70 22 160 14 230 18 C266 20 290 30 298 42 C292 54 266 62 230 64 C160 70 70 62 28 46 Z" />
    <path d="M150 20 L158 12 L164 20 Z" />
    <path d="M196 60 L172 84 L214 62 Z" />
    {/* Throat pleats and the mottled blue-grey skin */}
    {[0, 1, 2, 3, 4].map((i) => (
      <path key={i} d={`M${220 - i * 4} ${52 + i * 2} C${248} ${56 + i * 2} 276 ${54 + i} 294 ${46 + i}`} fill="none" stroke={A} strokeWidth={1.2} opacity={0.7} />
    ))}
    {Array.from({ length: 24 }, (_, i) => (
      <ellipse key={i} cx={60 + (i * 37) % 170} cy={30 + ((i * 13) % 22)} rx={4} ry={2} fill={A} opacity={0.4} />
    ))}
    <Eye x={262} y={38} r={2.2} />
  </Svg>
);

export const GiantOctopus = () => (
  <Svg w={160} h={110}>
    <g transform="translate(-4 -6) scale(1.7)">
      {[...OCTOPUS_ARMS, "M56 40 C66 48 72 56 80 58 C86 60 88 54 84 52", "M52 40 C54 52 50 60 52 66"].map((d, i) => (
        <path key={i} d={d} fill="none" stroke="currentColor" strokeWidth={4.4 - (i % 3) * 0.5} strokeLinecap="round" />
      ))}
      <ellipse cx={64} cy={22} rx={22} ry={17} transform="rotate(-24 64 22)" />
      {/* Warty, textured skin */}
      {[[58, 12], [66, 10], [74, 16], [70, 24], [60, 22], [78, 24], [52, 20], [64, 30]].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={1.6} fill={A} opacity={0.85} />
      ))}
      {[[30, 54], [36, 49], [44, 58], [24, 44], [20, 30], [16, 46], [44, 64], [62, 60]].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={1.1} fill={A} />
      ))}
      <Eye x={55} y={32} r={2.2} />
    </g>
  </Svg>
);

export const Oarfish = () => (
  <Svg w={300} h={60}>
    {/* The longest bony fish, a silver ribbon with a red crest; the "sea serpent" of old sailors */}
    <path d="M2 34 C40 26 70 40 110 34 C150 28 190 22 240 24 C262 25 282 26 296 30 C286 36 266 38 240 38 C190 40 150 44 110 44 C70 44 40 42 2 34 Z" />
    <path d="M10 30 C50 22 80 34 120 28 C160 22 200 18 252 20 L262 22" fill="none" stroke={A} strokeWidth={4} />
    {Array.from({ length: 5 }, (_, i) => (
      <path key={i} d={`M${260 + i * 5} 24 C${262 + i * 5} ${10 - i} ${266 + i * 6} ${2 + i} ${272 + i * 6} 0`} fill="none" stroke={A} strokeWidth={2.4} strokeLinecap="round" />
    ))}
    <Eye x={284} y={29} r={2} />
  </Svg>
);

export const Anglerfish = () => (
  <Svg w={110} h={80}>
    <path d="M18 44 L2 32 L6 44 L2 56 Z" />
    <path d="M14 44 C16 22 40 14 62 16 C86 18 100 30 104 44 C100 60 86 72 62 72 C40 72 16 64 14 44 Z" />
    {/* The glowing lure on a rod, and teeth like needles */}
    <path d="M70 18 C76 4 92 0 100 6" fill="none" stroke="currentColor" strokeWidth={2} />
    <circle cx={100} cy={9} r={7} fill={A} opacity={0.35} />
    <circle cx={100} cy={9} r={3.4} fill={A} />
    <path d="M72 54 C84 58 96 56 104 48 C96 64 82 66 72 60 Z" fill={EYE} opacity={0.8} />
    {[78, 84, 90, 96].map((x, i) => (
      <path key={x} d={`M${x} ${55 - i} l2 6 l2 -6.5`} fill="#f6efe6" />
    ))}
    <circle cx={84} cy={34} r={5} fill="#f6efe6" opacity={0.15} />
    <Eye x={84} y={34} r={2.8} />
  </Svg>
);

export const Coelacanth = () => (
  <Svg w={170} h={70}>
    {/* A "living fossil" with fleshy lobed fins, thought extinct until 1938 */}
    <path d="M26 36 L14 26 L4 34 L14 46 Z" />
    <path d="M20 36 C32 16 80 8 120 12 C144 14 160 24 166 36 C160 48 144 58 120 60 C80 64 32 56 20 36 Z" />
    {[
      [60, 12, -1], [80, 10, -1], [66, 60, 1], [90, 60, 1], [104, 56, 1], [40, 22, -1],
    ].map(([x, y, d], i) => (
      <path key={i} d={`M${x} ${y} C${x - 10} ${y + d * 4} ${x - 16} ${y + d * 12} ${x - 12} ${y + d * 16} C${x - 6} ${y + d * 14} ${x - 2} ${y + d * 8} ${x + 4} ${y + d * 2} Z`} />
    ))}
    {[[50, 26], [70, 34], [92, 24], [110, 40], [126, 28], [80, 48], [56, 44], [138, 42]].map(([x, y], i) => (
      <path key={i} d={`M${x} ${y} l3 -2 l3 2 l-3 3 Z`} fill={A} />
    ))}
    <Eye x={148} y={32} r={3} />
  </Svg>
);

export const Submersible = () => (
  <Svg w={140} h={90}>
    {/* A deep-diving research sub, like Alvin, with its sample arm out */}
    <path d="M18 44 C18 22 44 10 74 10 C104 10 126 24 126 46 C126 66 104 76 74 76 C44 76 18 66 18 44 Z" />
    <path d="M56 10 L60 0 L84 0 L88 10 Z" fill={A} />
    <circle cx={108} cy={52} r={9} fill={EYE} opacity={0.7} />
    <circle cx={108} cy={52} r={5} fill={A} opacity={0.6} />
    <path d="M18 44 L6 36 L6 54 Z" fill={A} />
    <path d="M112 66 L126 82 L136 78 M126 82 L130 90" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" />
    <path d="M118 30 L140 24 L140 40 Z" fill={A} opacity={0.35} />
    <path d="M30 30 C50 22 80 20 104 26" fill="none" stroke={A} strokeWidth={3} opacity={0.5} />
  </Svg>
);

export const GoldenManta = () => (
  <Svg w={140} h={70}>
    <path d="M70 24 C90 22 112 10 138 2 C126 22 108 40 88 46 C82 48 76 52 70 52 C64 52 58 48 52 46 C32 40 14 22 2 2 C28 10 50 22 70 24 Z" />
    <path d="M70 52 C70 60 68 66 64 70" fill="none" stroke="currentColor" strokeWidth={2} />
    <path d="M62 24 C60 16 62 12 64 10 M78 24 C80 16 78 12 76 10" stroke="currentColor" strokeWidth={4} strokeLinecap="round" />
    {[[30, 16], [50, 28], [90, 28], [110, 16], [70, 38], [60, 32], [80, 32]].map(([x, y], i) => (
      <path key={i} d={`M${x} ${y - 3} l1 2 l2 1 l-2 1 l-1 2 l-1 -2 l-2 -1 l2 -1 Z`} fill={A} />
    ))}
  </Svg>
);

export const Kraken = () => (
  <Svg w={180} h={120}>
    <path d="M90 2 C116 2 132 18 132 42 C132 60 120 70 104 72 L76 72 C60 70 48 60 48 42 C48 18 64 2 90 2 Z" />
    {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
      const x = 56 + i * 9.5;
      const side = i < 4 ? -1 : 1;
      const reach = (i < 4 ? 4 - i : i - 3) * 14;
      return (
        <path
          key={i}
          d={`M${x} 68 C${x + side * reach * 0.4} 88 ${x + side * reach} 84 ${x + side * reach * 1.1} 104 C${x + side * reach * 1.2} 116 ${x + side * (reach + 14)} 118 ${x + side * (reach + 20)} 108`}
          fill="none"
          stroke="currentColor"
          strokeWidth={8 - Math.abs(i - 3.5)}
          strokeLinecap="round"
        />
      );
    })}
    <path d="M72 32 C76 26 84 28 84 34 M96 34 C96 28 104 26 108 32" fill="none" stroke={A} strokeWidth={3} strokeLinecap="round" />
    <circle cx={78} cy={36} r={4} fill={A} />
    <circle cx={102} cy={36} r={4} fill={A} />
    <path d="M60 14 C70 6 80 4 90 4 M120 14 C112 8 104 6 96 6" fill="none" stroke={A} strokeWidth={2} opacity={0.5} />
  </Svg>
);
