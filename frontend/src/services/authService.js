import api from "./api";

export const loginRequest = async (payload) => {
  const response = await api.post("/api/login", payload);
  return response.data;
};
