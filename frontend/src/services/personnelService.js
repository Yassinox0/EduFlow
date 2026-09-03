import api from "./api";

export const getPersonnel = async (params) => (await api.get("/api/personnel", { params })).data;
export const getPersonnelMember = async (id) => (await api.get(`/api/personnel/${id}`)).data;
export const getNextPersonnelNumber = async () => (await api.get("/api/personnel/next-number")).data;
export const createPersonnelMember = async (payload) => (await api.post("/api/personnel", payload)).data;
export const updatePersonnelMember = async (id, payload) => (await api.put(`/api/personnel/${id}`, payload)).data;
export const updatePersonnelStatus = async (id, status) => (await api.patch(`/api/personnel/${id}/status`, { status })).data;
