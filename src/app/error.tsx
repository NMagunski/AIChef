"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return <section role="alert"><h1>Нещо се обърка.</h1><p>Не успяхме да заредим страницата. Опитай отново.</p><button type="button" onClick={reset}>Опитай отново</button></section>;
}
