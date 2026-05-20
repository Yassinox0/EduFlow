import api from "./api";

export const getMonthlyFees = async (params) => {
  const response = await api.get("/api/monthly-fees", { params });
  return response.data;
};

export const getUnpaidMonthlyFees = async () => {
  const response = await api.get("/api/monthly-fees/unpaid");
  return response.data;
};
