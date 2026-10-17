"use client";

import { useState, useSyncExternalStore, type ReactNode } from "react";
import { ChevronDown, type LucideIcon } from "lucide-react";
import styles from "./recipe-details.module.css";

function subscribe(callback: () => void) {
  const media = window.matchMedia("(min-width: 901px)");
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}
const desktopSnapshot = () => window.matchMedia("(min-width: 901px)").matches;
const serverSnapshot = () => true;

export function CollapsibleSection({ id, title, icon: Icon, children, action, defaultOpen = false, tint = false }: { id: string; title: string; icon?: LucideIcon; children: ReactNode; action?: ReactNode; defaultOpen?: boolean; tint?: boolean }) {
  const desktop = useSyncExternalStore(subscribe, desktopSnapshot, serverSnapshot);
  const [expanded, setExpanded] = useState(defaultOpen);
  const open = desktop || expanded;
  return (
    <section className={`${styles.panel} ${tint ? styles.tintedPanel : ""}`} aria-labelledby={`${id}-title`}>
      <div className={styles.panelHeading}>
        <h2 id={`${id}-title`}><button type="button" disabled={desktop} aria-expanded={open} aria-controls={`${id}-body`} onClick={() => setExpanded(!expanded)}>{Icon && <Icon size={20} aria-hidden="true" />}<span>{title}</span><ChevronDown className={styles.collapseChevron} size={18} aria-hidden="true" /></button></h2>
        {action && <div className={styles.panelAction}>{action}</div>}
      </div>
      <div id={`${id}-body`} className={styles.panelBody} hidden={!open}>{children}</div>
    </section>
  );
}
