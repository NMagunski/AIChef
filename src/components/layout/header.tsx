"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, ChefHat, Heart, House, Search, SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import { ReferencePhoto } from "@/components/ui/reference-photo";
import { site } from "@/lib/site";
import styles from "./app-shell.module.css";

const links = [
  { href: "/", label: "Начало", mobileLabel: "Начало", icon: House },
  { href: "/search", label: "Открий рецепти", mobileLabel: "Търсене", icon: Search },
  { href: "/favorites", label: "Любими", mobileLabel: "Любими", icon: Heart },
  { href: "/menu", label: "Моето меню", mobileLabel: "Меню", icon: SlidersHorizontal },
];

export function Header() {
  const pathname = usePathname();
  const activeHref = pathname.startsWith("/recipes/") ? "/search" : pathname;
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  return (
    <>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link href="/" className={styles.brand} aria-label={`${site.name} — Начало`}>
            <ChefHat className={styles.brandIcon} size={48} strokeWidth={1.35} aria-hidden="true" />
            <span className={styles.brandName}>{site.name}<span className={styles.brandTagline}>Рецепти с вдъхновение</span></span>
          </Link>
          <nav aria-label="Основна навигация" className={styles.nav}>
            {links.map(({ href, label }) => (
              <Link key={href} href={href} aria-current={activeHref === href ? "page" : undefined}>{label}</Link>
            ))}
          </nav>
          <div className={styles.utilities}>
            <Link href="/search" className={`${styles.iconButton} ${styles.desktopSearch}`} aria-label="Търси рецепти"><Search size={22} strokeWidth={1.7} /></Link>
            <div className={styles.notificationWrap}>
              <button type="button" className={styles.iconButton} aria-label="Известия" aria-expanded={notificationsOpen} aria-controls="notifications" onClick={() => setNotificationsOpen(!notificationsOpen)} onKeyDown={(event) => { if (event.key === "Escape") setNotificationsOpen(false); }}>
                <Bell size={21} strokeWidth={1.6} aria-hidden="true" /><span className={styles.notificationDot} />
              </button>
              {notificationsOpen && <div id="notifications" className={styles.notifications} role="status">Нямаш нови известия.</div>}
            </div>
            <span className={styles.avatar} role="img" aria-label="Примерен профил"><ReferencePhoto name="avatar" /></span>
          </div>
        </div>
      </header>
      <nav aria-label="Мобилна навигация" className={styles.bottomNav}>
        {links.map(({ href, mobileLabel, icon: Icon }) => (
          <Link key={href} href={href} aria-current={activeHref === href ? "page" : undefined}>
            <Icon size={23} strokeWidth={1.5} fill={activeHref === href && href === "/" ? "currentColor" : "none"} aria-hidden="true" />
            <span>{mobileLabel}</span>
          </Link>
        ))}
      </nav>
    </>
  );
}
