// Fixed, decorative backdrop: drifting light rays and rising bubbles.
// Hidden from assistive tech; motion is disabled under prefers-reduced-motion.

const BUBBLES = [
  { left: 4, size: 6, duration: 19, delay: 0 },
  { left: 11, size: 10, duration: 24, delay: 6 },
  { left: 18, size: 4, duration: 16, delay: 11 },
  { left: 27, size: 8, duration: 22, delay: 3 },
  { left: 35, size: 5, duration: 18, delay: 14 },
  { left: 46, size: 12, duration: 28, delay: 8 },
  { left: 53, size: 4, duration: 15, delay: 2 },
  { left: 61, size: 7, duration: 21, delay: 17 },
  { left: 69, size: 5, duration: 17, delay: 5 },
  { left: 77, size: 9, duration: 25, delay: 12 },
  { left: 84, size: 4, duration: 14, delay: 9 },
  { left: 91, size: 6, duration: 20, delay: 1 },
  { left: 97, size: 8, duration: 23, delay: 15 },
];

export default function Ocean() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="caustics absolute -inset-x-20 top-0 h-[70vh]" />
      {BUBBLES.map((b, i) => (
        <span
          key={i}
          className="bubble"
          style={{
            left: `${b.left}%`,
            width: b.size,
            height: b.size,
            animationDuration: `${b.duration}s`,
            animationDelay: `${b.delay}s`,
          }}
        />
      ))}
    </div>
  );
}
