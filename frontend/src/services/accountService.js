import api from "./api";

export const getAccountProfile = async () => (await api.get("/api/account/profile")).data;

export const changeAccountPassword = async (payload) =>
  (await api.put("/api/account/password", payload)).data;

export const uploadAccountPhoto = async (file) => {
  const formData = new FormData();
  formData.append("photo", file);
  return (await api.post("/api/account/photo", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  })).data;
};
