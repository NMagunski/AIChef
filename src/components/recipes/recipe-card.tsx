"use client";

import Link from "next/link";
import { Clock3, Users, CookingPot, Heart, Timer, ChefHat } from "lucide-react";
import type { Recipe } from "@/lib/recipes";
import { ReferencePhoto } from "@/components/ui/reference-photo";
import { useFavorites } from "./favorites-provider";
import styles from "./recipe-card.module.css";

export function RecipeCard({ recipe, compact = false }: { recipe: Recipe; compact?: boolean }) {
  const { ids, toggle } = useFavorites();
  const saved = ids.includes(recipe.id);
  const BadgeIcon = recipe.badgeTone === "yellow" ? Timer : ChefHat;

  return (
    <article className={`${styles.card} ${compact ? styles.compact : ""}`}>
      <Link href={`/recipes/${recipe.id}`} className={styles.link}>
        <div className={styles.photo}>
          <ReferencePhoto name={recipe.photo} />
          {recipe.badge && !compact && <span className={`${styles.badge} ${styles[recipe.badgeTone ?? "green"]}`}><BadgeIcon size={14} aria-hidden="true" />{recipe.badge}</span>}
        </div>
        <div className={styles.body}>
          <h3>{recipe.title}</h3>
          <div className={styles.meta}>
            <span><Clock3 size={16} aria-hidden="true" />{recipe.minutes} мин</span>
            <span><Users size={16} aria-hidden="true" />{recipe.servings} порции</span>
            <span><CookingPot size={16} aria-hidden="true" />{recipe.difficulty}</span>
          </div>
          {!compact && <p className={styles.description}>{recipe.description}</p>}
        </div>
      </Link>
      <button className={`${styles.favorite} ${saved ? styles.saved : ""}`} type="button" onClick={() => toggle(recipe.id)} aria-pressed={saved} aria-label={`${saved ? "Премахни от" : "Добави в"} любими: ${recipe.title}`}>
        <Heart size={22} fill={saved ? "currentColor" : "none"} strokeWidth={1.6} aria-hidden="true" />
      </button>
    </article>
  );
}
