import api from "./api";

export const getChargeCategories = async () => (await api.get("/api/charge-categories")).data;
export const getActiveAcademicYear = async () => (await api.get("/api/school/current/active-academic-year")).data;
