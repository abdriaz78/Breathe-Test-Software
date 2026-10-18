// Decorative, slowly drifting breath waves. Each layer is a seamless wave drawn
// across 200% width and translated by -50%, so the loop has no visible seam.
// Purely decorative: hidden from assistive tech, stilled by reduced-motion.

/** A filled wave over a 2400×200 box; `len` must divide 1200 for a seamless loop. */
function wavePath(amp: number, mid: number, len: number): string {
  let d = `M0 ${mid}`;
  for (let x = 0; x < 2400; x += len) {
    d += ` q ${len / 4} ${-amp} ${len / 2} 0 t ${len / 2} 0`;
  }
  return `${d} V 200 H 0 Z`;
}

const BACK = wavePath(26, 110, 600);
const FRONT = wavePath(18, 135, 400);

export function BreathWaves({ className = "" }: { className?: string }) {
  return (
    <div aria-hidden className={`pointer-events-none absolute inset-x-0 bottom-0 overflow-hidden ${className}`}>
      <svg className="absolute inset-0 block h-full w-[200%] animate-wave-slow" viewBox="0 0 2400 200" preserveAspectRatio="none">
        <path d={BACK} fill="currentColor" opacity="0.10" />
      </svg>
      <svg className="absolute inset-0 block h-full w-[200%] animate-wave" viewBox="0 0 2400 200" preserveAspectRatio="none">
        <path d={FRONT} fill="currentColor" opacity="0.14" />
      </svg>
    </div>
  );
}
