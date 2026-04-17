import api from "./api";

export const getStudents = async () => {
  const response = await api.get("/api/students");
  return response.data;
};

export const createStudent = async (payload) => {
  const response = await api.post("/api/students", payload);
  return response.data;
};
