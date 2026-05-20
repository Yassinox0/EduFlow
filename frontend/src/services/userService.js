import api from "./api";

export const getUsers = async () => {
  const response = await api.get("/api/users");
  return response.data;
};

export const createUser = async (payload) => {
  const response = await api.post("/api/users", payload);
  return response.data;
};

export const updateUser = async (id, payload) => {
  const response = await api.put(`/api/users/${id}`, payload);
  return response.data;
};

export const resetUserPassword = async (id) => {
  const response = await api.post(`/api/users/${id}/reset-password`);
  return response.data;
};
