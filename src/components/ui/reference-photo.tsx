import { referencePhotos, type ReferencePhotoName } from "@/lib/reference-photos";
import styles from "./reference-photo.module.css";

export function ReferencePhoto({ name, className = "" }: { name: ReferencePhotoName; className?: string }) {
  return (
    <svg aria-hidden="true" focusable="false" className={`${styles.photo} ${className}`} viewBox={referencePhotos[name].join(" ")} preserveAspectRatio="xMidYMid slice">
      <image href="/images/approved-home.png" width="1312" height="1199" />
    </svg>
  );
}
