import Form from "next/form";
import { Search } from "lucide-react";
import styles from "./home.module.css";

export function SearchForm({ defaultValue = "" }: { defaultValue?: string }) {
  return <Form action="/search" className={styles.search} role="search">
    <Search className={styles.searchIcon} size={22} aria-hidden="true" />
    <label className="sr-only" htmlFor="recipe-query">Търси рецепта, продукт или идея</label>
    <input id="recipe-query" name="q" type="search" defaultValue={defaultValue} placeholder="Напиши ястие, продукт или идея..." required maxLength={500} />
    <button type="submit">Търси</button>
  </Form>;
}
