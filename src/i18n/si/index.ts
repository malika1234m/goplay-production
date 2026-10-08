// Sinhala dictionary, split by area. Keys are the exact English text used in t("...").
import common  from "./common";
import owner   from "./owner";
import payments from "./payments";
import worker  from "./worker";
import publicSite from "./public";
import player  from "./player";

const si: Record<string, string> = { ...common, ...owner, ...payments, ...worker, ...publicSite, ...player };
export default si;
