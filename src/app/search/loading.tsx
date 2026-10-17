import styles from "@/components/search/search-results.module.css";

export default function SearchLoading() {
  return <section className={styles.loading} role="status" aria-live="polite"><p>Подготвяме рецептите…</p><div className={styles.skeletonGrid} aria-hidden="true">{[0, 1, 2].map((item) => <div key={item} />)}</div></section>;
}
