"use client";

import dynamic from "next/dynamic";
import styles from "./styles/atomWorld.module.css";

/** Loads the 3D experience on the client only (three.js never runs on the server). */
const AtomWorldApp = dynamic(() => import("./AtomWorldApp").then((m) => m.AtomWorldApp), {
  ssr: false,
  loading: () => (
    <div className={styles.root}>
      <div className={styles.loading}>
        <div className={styles.loadingInner}>
          <div className={styles.spinner} />
          <span>در حال آماده‌سازی دنیای اتم…</span>
        </div>
      </div>
    </div>
  ),
});

export function AtomWorldLoader() {
  return <AtomWorldApp />;
}
