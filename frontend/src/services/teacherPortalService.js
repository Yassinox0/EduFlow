import api from "./api";

export const getTeacherDashboard = async () => (await api.get("/api/teacher/dashboard")).data;
export const getTeacherAssessments = async (params) => (await api.get("/api/teacher/assessments", { params })).data;
export const createTeacherAssessment = async (payload) => (await api.post("/api/teacher/assessments", payload)).data;
export const getAssessmentRoster = async (id) => (await api.get(`/api/teacher/assessments/${id}/students`)).data;
export const saveAssessmentGrades = async (id, grades) => (await api.put(`/api/teacher/assessments/${id}/grades`, { grades })).data;
export const updateAssessmentStatus = async (id, status) => (await api.put(`/api/teacher/assessments/${id}/status`, { status })).data;
export const getTeacherGradebook = async (params) => (await api.get("/api/teacher/gradebook", { params })).data;
export const downloadStudentReportCard = async (studentId, periodId, language) => {
  const response = await api.get(`/api/teacher/report-cards/${studentId}/pdf`, {
    params: { period_id: periodId, lang: language }, responseType: "blob",
  });
  const url = URL.createObjectURL(response.data);
  const link = document.createElement("a");
  link.href = url;
  link.download = `releve-${studentId}.pdf`;
  link.click();
  URL.revokeObjectURL(url);
};
export const getTeacherSessions = async (date) => (await api.get("/api/teacher/sessions", { params: { date } })).data;
export const getAttendanceRoster = async (scheduleId, date) => (await api.get(`/api/teacher/sessions/${scheduleId}/students`, { params: { date } })).data;
export const saveAttendance = async (scheduleId, sessionDate, absences) =>
  (await api.post(`/api/teacher/sessions/${scheduleId}/attendance`, { session_date: sessionDate, absences })).data;
