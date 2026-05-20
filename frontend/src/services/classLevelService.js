import api from "./api";

export const getClassLevels = async (schoolId) => {
  const params = schoolId ? { school_id: schoolId } : undefined;
  const response = await api.get("/api/class-levels", { params });
  return response.data;
};

export const createClassLevel = async (payload) => {
  const response = await api.post("/api/class-levels", payload);
  return response.data;
};
