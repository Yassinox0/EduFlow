import api from "./api";

export const getStudents = async () => {
  const response = await api.get("/api/students");
  return response.data;
};

export const createStudent = async (payload) => {
  const response = await api.post("/api/students", payload);
  return response.data;
};

export const updateStudent = async (id, payload) => {
  const response = await api.put(`/api/students/${id}`, payload);
  return response.data;
};

export const deleteStudent = async (id) => {
  const response = await api.delete(`/api/students/${id}`);
  return response.data;
};
