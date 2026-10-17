"use client";

import { CookingPot, SlidersHorizontal, Timer, X } from "lucide-react";
import { useState } from "react";
import type { SearchFilters } from "@/lib/recipe-search";
import type { RecipeDifficulty } from "@/types/recipe";
import styles from "./search-results.module.css";

const timeOptions = [
  { value: "all", label: "Всички", icon: CookingPot },
  { value: "quick", label: "До 30 мин", icon: Timer },
  { value: "medium", label: "30–60 мин", icon: Timer },
  { value: "long", label: "Над 60 мин", icon: Timer },
] as const;

type Props = {
  filters: SearchFilters;
  cuisines: string[];
  categories: string[];
  onChange: (next: SearchFilters) => void;
  onReset: () => void;
};

export function SearchFilterControls({ filters, cuisines, categories, onChange, onReset }: Props) {
  const [expanded, setExpanded] = useState(false);
  const activeCount = Object.values(filters).filter((value) => value !== "all").length;

  return (
    <div className={styles.filters}>
      <div className={styles.filterRow}>
        <div className={styles.timeFilters} role="group" aria-label="Време за готвене">
          {timeOptions.map(({ value, label, icon: Icon }) => <button key={value} type="button" aria-pressed={filters.time === value} onClick={() => value === "all" ? onReset() : onChange({ ...filters, time: value })}><Icon size={18} aria-hidden="true" />{label}</button>)}
        </div>
        <button type="button" className={styles.filterToggle} aria-label={`Допълнителни филтри${activeCount ? `, активни: ${activeCount}` : ""}`} aria-expanded={expanded} aria-controls="search-filter-options" onClick={() => setExpanded(!expanded)}><SlidersHorizontal size={19} aria-hidden="true" />{activeCount > 0 && <span className={styles.filterCount}>{activeCount}</span>}</button>
        <div id="search-filter-options" className={`${styles.selectFilters} ${expanded ? styles.selectFiltersExpanded : ""}`}>
          <label><span className="sr-only">Сложност</span><select value={filters.difficulty} onChange={(event) => onChange({ ...filters, difficulty: event.target.value as RecipeDifficulty | "all" })}><option value="all">Сложност</option><option value="Лесна">Лесна</option><option value="Средна">Средна</option></select></label>
          <label><span className="sr-only">Тип ястие</span><select value={filters.category} onChange={(event) => onChange({ ...filters, category: event.target.value })}><option value="all">Тип ястие</option>{categories.map((category) => <option key={category}>{category}</option>)}</select></label>
          <label><span className="sr-only">Кухня</span><select value={filters.cuisine} onChange={(event) => onChange({ ...filters, cuisine: event.target.value })}><option value="all">Кухня</option>{cuisines.map((cuisine) => <option key={cuisine}>{cuisine}</option>)}</select></label>
        </div>
      </div>
      {activeCount > 0 && <button type="button" className={styles.resetFilters} onClick={onReset}><X size={14} aria-hidden="true" />Изчисти филтрите ({activeCount})</button>}
    </div>
  );
}
