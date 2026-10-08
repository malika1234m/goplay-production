import { cookies } from "next/headers";
import { isLang, LANG_COOKIE, localeOf, makeT, makeTN, type Lang } from "./core";

export async function getLang(): Promise<Lang> {
  const v = (await cookies()).get(LANG_COOKIE)?.value;
  return isLang(v) ? v : "en";
}

/** For server components: const { t } = await getT(); */
export async function getT() {
  const lang = await getLang();
  return { lang, t: makeT(lang), tn: makeTN(lang), locale: localeOf(lang) };
}
