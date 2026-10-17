import Link from "next/link";
import { ChefHat, ChevronRight, Soup, Utensils, Salad, CakeSlice, Zap, CookingPot, Dices, Heart } from "lucide-react";
import { SearchForm } from "@/components/home/search-form";
import { SurpriseButton } from "@/components/home/surprise-button";
import { RecipeCard } from "@/components/recipes/recipe-card";
import { ReferencePhoto } from "@/components/ui/reference-photo";
import { FadeIn } from "@/components/motion/fade-in";
import { recommendations, seasonalRecipes, searchHref } from "@/lib/recipes";
import type { ReferencePhotoName } from "@/lib/reference-photos";
import styles from "@/components/home/home.module.css";

const suggestions = ["Пиле с ориз", "Бърза вечеря", "Имам картофи и яйца", "Българска кухня", "Здравословни рецепти"];
const categories = [
  { name: "Супи", mobile: "Супи", icon: Soup, photo: "soup", color: "orange" },
  { name: "Основни ястия", mobile: "Основни", icon: ChefHat, photo: "main", color: "green" },
  { name: "Салати", mobile: "Салати", icon: Salad, photo: "salad", color: "sage" },
  { name: "Десерти", mobile: "Десерти", icon: CakeSlice, photo: "dessert", color: "pink" },
  { name: "Бързи рецепти", mobile: "Бързи", icon: Zap, photo: "quick", color: "yellow" },
  { name: "Българска кухня", mobile: "Българска кухня", icon: CookingPot, photo: "bulgarian", color: "orange" },
] satisfies { name: string; mobile: string; icon: typeof Utensils; photo: ReferencePhotoName; color: string }[];

export default function HomePage() {
  return (
    <div className={styles.home} data-home>
      <section className={styles.hero} aria-labelledby="hero-title">
        <div className={styles.heroPhoto}><ReferencePhoto name="hero" /></div>
        <div className={styles.mobileHeroPhoto}><ReferencePhoto name="mobileHero" /></div>
        <div className={styles.heroShade} />
        <div className={styles.heroInner}>
          <div className={styles.heroContent}>
            <h1 id="hero-title">Какво ще <br />готвим днес?</h1>
            <p>Открий любимата си рецепта или опиши какво имаш в хладилника.</p>
            <SearchForm />
            <div className={styles.suggestions} aria-label="Идеи за търсене">
              {suggestions.map((text) => <Link href={searchHref(text)} key={text}>{text}</Link>)}
            </div>
          </div>
          <span className={styles.heroNote}>Вдъхновение<br />за всеки ден<Heart size={32} strokeWidth={1.2} aria-hidden="true" /></span>
        </div>
      </section>

      <div className={styles.content}>
        <FadeIn>
          <section className={styles.section} aria-labelledby="categories-title">
            <div className={styles.sectionHeading}>
              <h2 id="categories-title">Популярни категории</h2>
              <Link href="/search" className={styles.textLink}>Виж всички<ChevronRight size={16} aria-hidden="true" /></Link>
            </div>
            <div className={styles.categories} tabIndex={0} role="region" aria-label="Категории — превърти за още">
              {categories.map(({ name, mobile, icon: Icon, photo, color }) => (
                <Link href={searchHref(name)} key={name} className={styles.category} aria-label={name}>
                  <span className={styles.categoryPhoto}><ReferencePhoto name={photo} /></span>
                  <span className={styles.categoryLabel}>
                    <span className={`${styles.categoryIcon} ${styles[color]}`}><Icon size={18} strokeWidth={1.8} aria-hidden="true" /></span>
                    <span className={styles.desktopCategoryName}>{name}</span><span className={styles.mobileCategoryName}>{mobile}</span>
                  </span>
                </Link>
              ))}
            </div>
          </section>
        </FadeIn>

        <FadeIn>
          <section className={styles.section} aria-labelledby="recommendations-title">
            <div className={styles.sectionHeading}>
              <div><h2 id="recommendations-title">Какво да сготвя днес?</h2><p className={styles.sectionSubtitle}>Подбрани предложения специално за теб.</p></div>
              <Link href="/search" className={`${styles.textLink} ${styles.moreButton}`}><span className={styles.desktopMore}>Още предложения</span><span className={styles.mobileMore}>Още</span><ChevronRight size={16} aria-hidden="true" /></Link>
            </div>
            <div className={`${styles.recipeGrid} ${styles.recommendations}`} tabIndex={0} role="region" aria-label="Предложения за днес — превърти за още">
              {recommendations.map((recipe) => <RecipeCard key={recipe.id} recipe={recipe} />)}
            </div>
          </section>
        </FadeIn>

        <FadeIn>
          <section className={styles.surprise} aria-labelledby="surprise-title">
            <span className={styles.surpriseIcon}><Dices size={36} strokeWidth={1.5} aria-hidden="true" /></span>
            <div className={styles.surpriseText}><h2 id="surprise-title">Изненадай ме!</h2><p>Няма идея какво да сготвиш? Натисни бутона и ще ти предложим случайна, но вкусна рецепта.</p></div>
            <SurpriseButton />
            <div className={styles.surpriseGarnish}><ReferencePhoto name="garnish" /></div>
          </section>
        </FadeIn>

        <FadeIn>
          <section className={styles.section} aria-labelledby="seasonal-title">
            <div className={styles.sectionHeading}><h2 id="seasonal-title">Сезонни рецепти</h2><Link href={searchHref("Есен")} className={styles.textLink}>Виж всички<ChevronRight size={16} aria-hidden="true" /></Link></div>
            <div className={styles.seasonal} tabIndex={0} role="region" aria-label="Сезонни рецепти — превърти хоризонтално">
              {seasonalRecipes.map((recipe) => <RecipeCard key={recipe.id} recipe={recipe} compact />)}
            </div>
          </section>
        </FadeIn>
      </div>
    </div>
  );
}
