const mappings = [
  ["All password fields are required", "requiredPasswords"],
  ["Password confirmation does not match", "passwordMismatch"],
  ["Password must contain", "weakPassword"],
  ["Current password is incorrect", "wrongCurrentPassword"],
  ["New password must be different", "samePassword"],
  ["Future attendance cannot be recorded", "futureAttendance"],
  ["does not belong to the connected teacher", "forbiddenCourse"],
  ["does not match the selected date", "forbiddenCourse"],
  ["not enrolled in this class", "invalidStudent"],
  ["Published or locked results", "publishedLocked"],
  ["All students need a grade", "incompleteGrades"],
  ["score exceeds", "scoreExceedsScale"],
  ["grading period is invalid or closed", "closedPeriod"],
];

export default function teacherPortalError(error, t, fallbackKey = "teacherPortal.saveError") {
  const message = String(error?.response?.data?.message || "");
  const match = mappings.find(([fragment]) => message.includes(fragment));
  return match ? t(`teacherErrors.${match[1]}`) : t(fallbackKey);
}
