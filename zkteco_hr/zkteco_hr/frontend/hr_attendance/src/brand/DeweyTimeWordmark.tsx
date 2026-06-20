import { Wordmark } from "./Wordmark";

/**
 * The Dewey Time house mark: monospace "DT" that expands to "Dewey Time" on
 * hover, D in brand green, T in brand orange. Single source of truth for the
 * header logo — keep the words/tint here, not inline in the shell.
 */
export function DeweyTimeWordmark() {
  return (
    <Wordmark
      words={[
        ["D", "ewey "],
        ["T", "ime"],
      ]}
      title="Dewey Time"
      tint={(i) => (i === 0 ? "var(--brand-primary)" : "var(--brand-accent)")}
    />
  );
}
