import styles from "./AtomWorldEntryButton.module.css";

/** «🎮 ورود به دنیای سه‌بعدی اتم» — the button that opens /atom-world from the main site. */
export function AtomWorldEntryButton({ className }: { className?: string }) {
  return (
    <a href="/atom-world" className={`${styles.button} ${className ?? ""}`}>
      <span aria-hidden>🎮</span> ورود به دنیای سه‌بعدی اتم
    </a>
  );
}
