import api from "./api";
export const getAcademicYears=async()=> (await api.get("/api/academic-years")).data;
