/** The PBox mark (design/ in Pen, scheme F): a cube with one solid face. Inherits `currentColor`. */
export function Logo({ className }: { className?: string }): React.JSX.Element {
  return (
    <svg viewBox="0 7 96.12 105.2" className={className} aria-hidden fill="currentColor">
      <path d="M92.4 22.99549l-40.08-21.96c-2.52-1.32-5.64-1.44-8.4 0l-39.84 21.6c-2.4 1.08-4.08 3.72-4.08 6.84l0 45.96c0 2.88001 1.32 5.4 3.72 6.72l40.2 22.08001c1.2 0.59999 2.52 0.96 4.08 0.96 1.56 0 2.88-0.36001 4.32-1.08l40.08-21.24001c2.16-1.2 3.72-3.84 3.72-7.31999l0-46.20001c0-2.52001-1.56-5.28-3.72-6.36z m-47.76 74.64001l-38.16-21 0-44.76001 38.16 21.48 0 44.28001z m-34.8-71.16001l38.16-20.52 38.04 20.52-38.04 21.36001-38.16-21.36001z" />
    </svg>
  )
}
