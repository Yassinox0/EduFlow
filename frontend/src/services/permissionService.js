import api from "./api";
export const getMyPermissions = async () => (await api.get("/api/me/permissions")).data;
