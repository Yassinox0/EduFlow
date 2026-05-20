import api from "./api";

export const getPayments = async () => {
  const response = await api.get("/api/payments");
  return response.data;
};

export const createPayment = async (payload) => {
  const response = await api.post("/api/payments", payload);
  return response.data;
};
