import api from "./api";
export const findFamilyCandidates=(query)=>api.get("/api/families/candidates",{params:{query}}).then(r=>r.data);
export const createFamily=(payload)=>api.post("/api/families",payload).then(r=>r.data);
export const getFamily=(id)=>api.get(`/api/families/${id}`).then(r=>r.data);
export const attachStudentToFamily=(familyId,studentId)=>api.post(`/api/families/${familyId}/students`,{student_id:studentId}).then(r=>r.data);
export const detachStudentFromFamily=(studentId)=>api.delete(`/api/students/${studentId}/family`).then(r=>r.data);
export const getStudentGuardians=(studentId)=>api.get(`/api/students/${studentId}/guardians`).then(r=>r.data);
export const addStudentGuardian=(studentId,payload)=>api.post(`/api/students/${studentId}/guardians`,payload).then(r=>r.data);
