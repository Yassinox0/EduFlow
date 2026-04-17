import api from "./api";

export const getCurrentSchool = async () => {
  const response = await api.get("/api/school/current");
  return response.data;
};

export const getSchools = async () => {
  const response = await api.get("/api/schools");
  return response.data;
};

export const createSchool = async (payload) => {
  const response = await api.post("/api/schools", payload);
  return response.data;
};

export const getSchoolById = async (id) => {
  const response = await api.get(`/api/schools/${id}`);
  return response.data;
};

export const updateSchool = async (id, payload) => {
  const response = await api.put(`/api/schools/${id}`, payload);
  return response.data;
};

export const createSchoolAdmin = async (id, payload) => {
  const response = await api.post(`/api/schools/${id}/admin`, payload);
  return response.data;
};

export const uploadSchoolLogo = async (file) => {
  const formData = new FormData();
  formData.append("logo", file);

  const response = await api.post("/api/schools/logo", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });

  return response.data;
};

export const getSuperAdminDashboard = async () => {
  const response = await api.get("/api/super-admin/dashboard");
  return response.data;
};
