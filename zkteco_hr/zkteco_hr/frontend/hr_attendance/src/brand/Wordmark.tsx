/**
 * Wordmark-as-logo — the Dewey house mark. Type, not an icon: a monospace
 * lockup of the app's initials that rests collapsed and expands the full name
 * on hover, initials tinted with the brand green (+ optional orange accent).
 * Drop into your header; pass your app's words. Requires --brand-primary /
 * --brand-accent (from tokens.css) and Tailwind's `font-mono`.
 *
 *   <Wordmark
 *     words={[['G', 'eneral '], ['A', 'dmin '], ['R', 'equest']]}
 *     title="General Admin Request"
 *   />
 *
 * By default the 2nd initial gets the green and the 3rd the orange — echoing a
 * two-tone parent brand. Override `tint` for a different scheme.
 */

const GREEN = 'var(--brand-primary)'
const ACCENT = 'var(--brand-accent)'

/** [capital, lowercase-tail] per word, e.g. ['A', 'dmin '] */
type Word = [cap: string, tail: string]

export function Wordmark({
  words,
  title,
  tint = (i) => (i === 1 ? GREEN : i === 2 ? ACCENT : undefined),
}: {
  words: Word[]
  title?: string
  tint?: (i: number) => string | undefined
}) {
  const full = words.map(([c, t]) => c + t).join('')
  return (
    <span
      className="group inline-flex items-baseline font-mono text-[15px] font-bold tracking-tight text-foreground select-none"
      title={title ?? full}
      aria-label={title ?? full}
    >
      {words.map(([cap, tail], i) => (
        <span key={i} className="inline-flex items-baseline" aria-hidden style={{ color: tint(i) }}>
          {cap}
          <span
            className="inline-block max-w-0 overflow-hidden opacity-0 transition-[max-width,opacity] duration-500 ease-[cubic-bezier(.22,1,.36,1)] group-hover:max-w-[12ch] group-hover:opacity-100 motion-reduce:transition-none"
          >
            {tail}
          </span>
        </span>
      ))}
    </span>
  )
}
