"use client";

import { useRouter } from "next/navigation";
import { ChevronRight, Dices } from "lucide-react";
import { useTransition } from "react";
import { recipes } from "@/lib/recipes";
import styles from "./home.module.css";

export function SurpriseButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function surprise() {
    startTransition(() => {
      const recipe = recipes[Math.floor(Math.random() * recipes.length)];
      router.push(`/recipes/${recipe.id}`);
    });
  }

  return (
    <button type="button" className={styles.surpriseButton} disabled={pending} aria-label={pending ? "Избираме рецепта…" : "Изненадай ме"} onClick={surprise}>
      <Dices size={25} strokeWidth={1.7} aria-hidden="true" />
      <span className={styles.surpriseButtonLabel}>{pending ? "Избираме рецепта…" : "Изненадай ме"}</span>
      <ChevronRight className={styles.surpriseChevron} size={18} aria-hidden="true" />
    </button>
  );
}
