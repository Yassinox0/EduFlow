import api from "./api";

export const getPayments = async () => {
  const response = await api.get("/api/payments");
  return response.data;
};
