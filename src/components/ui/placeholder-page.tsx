import Link from "next/link";
import { Sprout } from "lucide-react";
import { FadeIn } from "@/components/motion/fade-in";
import styles from "./placeholder-page.module.css";

type PlaceholderPageProps = {
  title: string;
  description: string;
  action?: { href: string; label: string };
};

export function PlaceholderPage({ title, description, action }: PlaceholderPageProps) {
  return (
    <FadeIn>
      <section className={styles.panel}>
        <span className={styles.badge}><Sprout size={16} aria-hidden="true" />В процес на разработка</span>
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.description}>{description}</p>
        {action && <Link className={styles.action} href={action.href}>{action.label}</Link>}
      </section>
    </FadeIn>
  );
}
