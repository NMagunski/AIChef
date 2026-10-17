import { searchPhotos, type SearchPhotoName } from "@/lib/search-photos";
import styles from "./search-results.module.css";

export function SearchPhoto({ name }: { name: SearchPhotoName }) {
  return (
    <svg aria-hidden="true" focusable="false" className={styles.referencePhoto} viewBox={searchPhotos[name].join(" ")} preserveAspectRatio="xMidYMid slice">
      <image href="/images/approved-search.png" width="1312" height="1199" />
    </svg>
  );
}
