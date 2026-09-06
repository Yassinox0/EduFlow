export const MONTH_OPTIONS = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"]
  .map((value) => ({ value }));

export const SCHOOL_YEAR_MONTH_OPTIONS = ["09", "10", "11", "12", "01", "02", "03", "04", "05", "06"]
  .map((value) => ({ value }));

export const DEFAULT_LEVEL_OPTIONS = [
  { value: "Maternelle", translationKey: "levels.kindergarten" },
  { value: "Petite Section", translationKey: "levels.smallSection" },
  { value: "Moyenne Section", translationKey: "levels.middleSection" },
  { value: "Grande Section", translationKey: "levels.largeSection" },
  { value: "CP", translationKey: "levels.cp" },
  { value: "CE1", translationKey: "levels.ce1" },
  { value: "CE2", translationKey: "levels.ce2" },
  { value: "CM1", translationKey: "levels.cm1" },
  { value: "CM2", translationKey: "levels.cm2" },
  { value: "6ème", translationKey: "levels.sixth" },
  { value: "5ème", translationKey: "levels.fifth" },
  { value: "4ème", translationKey: "levels.fourth" },
  { value: "3ème", translationKey: "levels.third" },
  { value: "Tronc Commun", translationKey: "levels.commonCore" },
  { value: "1ère Bac", translationKey: "levels.firstBac" },
  { value: "2ème Bac", translationKey: "levels.secondBac" },
];

// Contract shared with the backend importer. These headers must remain stable.
export const STUDENT_IMPORT_HEADERS = [
  "Nom",
  "Prénom",
  "Date de naissance",
  "Sexe",
  "Classe",
  "Niveau scolaire",
  "Nom du parent",
  "Téléphone",
  "Adresse",
  "Montant de la mensualité",
];

export const normalizeSearch = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
