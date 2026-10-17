import type { ReactNode } from "react";
import { Header } from "./header";
import { FavoritesProvider } from "@/components/recipes/favorites-provider";
import styles from "./app-shell.module.css";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <FavoritesProvider><div className={styles.shell}>
      <a className={styles.skipLink} href="#main-content">Към съдържанието</a>
      <Header />
      <main id="main-content" className={styles.main} tabIndex={-1}>{children}</main>
      <footer className={styles.footer}>С щипка любопитство и много вкус.</footer>
    </div></FavoritesProvider>
  );
}
