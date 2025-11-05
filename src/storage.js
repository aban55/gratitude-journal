import localforage from "localforage";
localforage.config({ name: "gratitude-journal", storeName: "data" });

const ENTRIES_KEY = "gratitudeEntries";
const AFFIRM_KEY  = "savedAffirmations";

export async function loadAll() {
  const [entries, aff] = await Promise.all([
    localforage.getItem(ENTRIES_KEY),
    localforage.getItem(AFFIRM_KEY),
  ]);
  return {
    savedEntries: entries || JSON.parse(localStorage.getItem(ENTRIES_KEY) || "[]"),
    savedAffirmations: aff || JSON.parse(localStorage.getItem(AFFIRM_KEY) || "[]"),
  };
}

export async function saveAll({ savedEntries, savedAffirmations }) {
  localStorage.setItem(ENTRIES_KEY, JSON.stringify(savedEntries));
  localStorage.setItem(AFFIRM_KEY,  JSON.stringify(savedAffirmations));
  await Promise.all([
    localforage.setItem(ENTRIES_KEY, savedEntries),
    localforage.setItem(AFFIRM_KEY,  savedAffirmations),
  ]);
}
