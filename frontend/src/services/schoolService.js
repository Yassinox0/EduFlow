import api from "./api";

export const getCurrentSchool = async () => {
  const response = await api.get("/api/school/current");
  return response.data;
};
export const updateCurrentSchool = async (payload) => (await api.put("/api/school/current", payload)).data;
export const getActiveAcademicYear = async () => (await api.get("/api/school/current/active-academic-year")).data;
export const updateActiveAcademicYear = async (academic_year_id) => (await api.put("/api/school/current/active-academic-year", { academic_year_id })).data;
export const getCurrentSchoolLogo = async () => (await api.get("/api/school/current/logo")).data;
export const uploadCurrentSchoolLogo = async (file) => { const data = new FormData(); data.append("logo", file); const result = (await api.post("/api/school/current/logo", data)).data; window.dispatchEvent(new Event("school-logo-changed")); return result; };
export const deleteCurrentSchoolLogo = async () => { const result = (await api.delete("/api/school/current/logo")).data; window.dispatchEvent(new Event("school-logo-changed")); return result; };

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

export const deleteSchool = async (id) => {
  const response = await api.delete(`/api/schools/${id}`);
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

export const importSchoolData = async (schoolId, file, onProgress) => {
  const formData = new FormData();
  formData.append("school_data", file);

  const response = await api.post(`/api/schools/${schoolId}/import-data`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
    onUploadProgress: (event) => {
      if (!onProgress || !event.total) {
        return;
      }

      onProgress(Math.round((event.loaded * 100) / event.total));
    },
  });

  return response.data;
};

export const getSuperAdminDashboard = async () => {
  const response = await api.get("/api/super-admin/dashboard");
  return response.data;
};
