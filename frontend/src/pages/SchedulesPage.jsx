import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { getClassLevels } from "../services/classLevelService";
import {
  createSchedule,
  deleteSchedule,
  getSchedules,
  getScheduleWorkloads,
  moveSchedule,
  updateSchedule,
} from "../services/scheduleService";
import { getCurrentSchool, getSchoolById } from "../services/schoolService";
import { getSubjects } from "../services/subjectService";
import { createTeacher, deleteTeacher, getTeachers, updateTeacher } from "../services/teacherService";
import useAuth from "../hooks/useAuth";
import useI18n from "../hooks/useI18n";
import { buildSchedulePdf, downloadBlob } from "../utils/schedulePdfExport";

const API_URL = (import.meta.env.VITE_API_URL || "http://127.0.0.1:8080").replace(/\/+$/, "");

const resolveLogoUrl = (logoPath) => {
  if (!logoPath) {
    return "";
  }

  if (/^(https?:|data:image\/)/i.test(logoPath)) {
    return logoPath;
  }

  const normalized = String(logoPath).replace(/\\/g, "/").replace(/^\/+/, "");
  return `${API_URL}/${normalized}`;
};

const dayOptions = [
  { value: "MONDAY" },
  { value: "TUESDAY" },
  { value: "WEDNESDAY" },
  { value: "THURSDAY" },
  { value: "FRIDAY" },
  { value: "SATURDAY" },
];

const baseTimeSlots = [
  { start: "08:30", end: "09:30", label: "08:30 - 09:30" },
  { start: "09:30", end: "10:30", label: "09:30 - 10:30" },
  { start: "10:30", end: "11:30", label: "10:30 - 11:30" },
  { start: "11:30", end: "12:30", label: "11:30 - 12:30" },
  { start: "12:30", end: "14:30", label: "12:30 - 14:30", pause: true },
  { start: "14:30", end: "15:30", label: "14:30 - 15:30" },
  { start: "15:30", end: "16:30", label: "15:30 - 16:30" },
  { start: "16:30", end: "17:30", label: "16:30 - 17:30" },
  { start: "17:30", end: "18:30", label: "17:30 - 18:30" },
];

const monthKeys = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"];

const getAcademicYear = (date = new Date()) => (date.getMonth() >= 7 ? date.getFullYear() : date.getFullYear() - 1);

const schoolCalendarStart = (academicYear) => {
  const septemberFirst = new Date(Number(academicYear), 8, 1);
  const startDay = septemberFirst.getDay() || 7;
  const firstSeptemberWeekMonday = new Date(septemberFirst);
  firstSeptemberWeekMonday.setDate(septemberFirst.getDate() - startDay + 1);

  const firstSchoolWeekMonday = new Date(firstSeptemberWeekMonday);
  firstSchoolWeekMonday.setDate(firstSeptemberWeekMonday.getDate() - 7);
  return firstSchoolWeekMonday;
};

const getAcademicWeek = (date = new Date(), academicYear = getAcademicYear(date)) => {
  const firstWeekMonday = schoolCalendarStart(academicYear);
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.floor((target - firstWeekMonday) / 86400000);
  return Math.max(1, Math.min(53, Math.floor(diffDays / 7) + 1));
};

const currentYear = getAcademicYear();
const currentWeek = getAcademicWeek();
const yearOptions = Array.from({ length: 5 }, (_, index) => currentYear - 2 + index);
const weekOptions = Array.from({ length: 53 }, (_, index) => index + 1);

const academicYearLabel = (year) => `${year}-${Number(year) + 1}`;

const academicWeekStart = (academicYear, weekNumber) => {
  const firstWeekMonday = schoolCalendarStart(academicYear);
  const weekStart = new Date(firstWeekMonday);
  weekStart.setDate(firstWeekMonday.getDate() + (Number(weekNumber) - 1) * 7);
  return weekStart;
};

const formatDayMonth = (date, t) => `${String(date.getDate()).padStart(2, "0")} ${t(`months.${monthKeys[date.getMonth()]}`)}`;

const academicWeekLabel = (academicYear, weekNumber, t) => {
  const start = academicWeekStart(academicYear, weekNumber);
  const end = new Date(start);
  end.setDate(start.getDate() + 5);

  if (start.getMonth() === end.getMonth()) {
    return t("schedules.weekRangeSameMonth", {
      start: String(start.getDate()).padStart(2, "0"),
      end: formatDayMonth(end, t),
    });
  }

  return t("schedules.weekRangeDifferentMonths", { start: formatDayMonth(start, t), end: formatDayMonth(end, t) });
};

const emptyForm = {
  class_level_id: "",
  subject_id: "",
  teacher_id: "",
  teacher_name: "",
  room: "",
  notes: "",
  weekly_hours: "",
  year_value: String(currentYear),
  week_number: String(currentWeek),
  day_of_week: "MONDAY",
  start_time: "08:30",
  end_time: "09:30",
  is_external: false,
};

const emptyTeacherForm = {
  first_name: "",
  last_name: "",
  gender: "",
  phone: "",
  address: "",
  email: "",
  primary_school: "",
  class_level_ids: [],
  subject_ids: [],
  status: "ACTIVE",
};

const formatTime = (value) => String(value || "").slice(0, 5);

const timeToMinutes = (value) => {
  const [hour = "0", minute = "0"] = formatTime(value).split(":");
  return Number(hour) * 60 + Number(minute);
};

const timeRangesOverlap = (firstStart, firstEnd, secondStart, secondEnd) =>
  timeToMinutes(firstStart) < timeToMinutes(secondEnd) && timeToMinutes(firstEnd) > timeToMinutes(secondStart);

const addOneHour = (time) => {
  const [hour = "8", minute = "30"] = String(time || "08:30").split(":");
  const nextHour = Math.min(23, Number(hour) + 1);
  return `${String(nextHour).padStart(2, "0")}:${String(Number(minute)).padStart(2, "0")}`;
};

const addMinutes = (time, minutes) => {
  const total = Math.min(23 * 60 + 59, Math.max(0, timeToMinutes(time) + Number(minutes || 0)));
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
};

const normalizeSlot = (slot) => {
  if (typeof slot === "string") {
    return { start: slot, end: addOneHour(slot), label: `${slot} - ${addOneHour(slot)}` };
  }

  return slot;
};

const buildTimeSlots = (scheduleList = []) => {
  const slots = new Map(baseTimeSlots.map((slot) => [slot.start, slot]));

  scheduleList.forEach((schedule) => {
    const start = formatTime(schedule.start_time);
    if (!start || slots.has(start)) {
      return;
    }

    const end = formatTime(schedule.end_time) || addOneHour(start);
    slots.set(start, { start, end, label: `${start} - ${end}` });
  });

  return Array.from(slots.values()).map(normalizeSlot).sort((a, b) => a.start.localeCompare(b.start));
};

const teacherName = (teacher) => teacher?.name || `${teacher?.first_name || ""} ${teacher?.last_name || ""}`.trim();

const scheduleSubjectCode = (schedule) =>
  Number(schedule.is_external) === 1 || schedule.is_external === true
    ? "EXTERNAL"
    : schedule.subject_code || schedule.subject_abbreviation || schedule.subject || "-";

const isExternalBusy = (schedule) =>
  schedule?.schedule_type === "external_busy" || Number(schedule?.is_external) === 1 || schedule?.is_external === true;

const busyLabelForTeacher = (teacher, t) =>
  String(teacher?.gender || "").toUpperCase() === "FEMALE" ? t("schedules.busyFemale") : t("schedules.busyMale");

const subjectLabel = (subject) => subject?.code || subject?.abbreviation || subject?.name || "-";

const scheduleSessionLabel = (schedule) => {
  if (isExternalBusy(schedule)) {
    return "";
  }

  const current = Number(schedule.subject_session_number || 0);
  const total = Number(schedule.subject_weekly_hours || 0);
  return current > 0 && total > 0 ? `${current}/${total}` : "";
};

const subjectWeeklyHours = (subject) => {
  const value = Number(subject?.weekly_hours || 0);
  return value > 0 ? String(value) : "";
};

const teacherSubjectCodes = (teacher, scheduleList = []) => {
  const codes = scheduleList
    .filter((schedule) => scheduleMatchesTeacher(schedule, teacher) && !isExternalBusy(schedule))
    .map((schedule) => schedule.subject_code || schedule.subject_abbreviation || schedule.subject)
    .filter(Boolean);
  return Array.from(new Set(codes));
};

const classDisplayName = (item) => {
  if (!item) {
    return "-";
  }

  const level = item.level_name || "";
  const group = item.group_name || item.name || "";
  return level && group ? `${level} - ${group}` : level || group || "-";
};

const teacherClassLevelIds = (teacher) =>
  Array.isArray(teacher?.class_level_ids)
    ? teacher.class_level_ids.map((id) => String(id))
    : Array.isArray(teacher?.class_levels)
      ? teacher.class_levels.map((level) => String(level.id))
      : [];

const teacherClassLabels = (teacher) => {
  const levels = Array.isArray(teacher?.class_levels) ? teacher.class_levels : [];
  return levels.map((level) => abbreviateClassName(level)).filter(Boolean);
};

const teacherSubjectIds = (teacher) =>
  Array.isArray(teacher?.subject_ids)
    ? teacher.subject_ids.map((id) => String(id))
    : Array.isArray(teacher?.subjects)
      ? teacher.subjects.map((subject) => String(subject.id))
      : [];

const teacherSubjectLabels = (teacher) => {
  const subjects = Array.isArray(teacher?.subjects) ? teacher.subjects : [];
  return subjects.map((subject) => subjectLabel(subject)).filter(Boolean);
};

const teacherTeachesClass = (teacher, classLevelId) =>
  Boolean(classLevelId) && teacherClassLevelIds(teacher).includes(String(classLevelId));

const teacherTeachesSubject = (teacher, subjectId) =>
  Boolean(subjectId) && teacherSubjectIds(teacher).includes(String(subjectId));

const abbreviateClassName = (item) => {
  if (!item) {
    return "-";
  }

  const directCode = String(item.class_code || item.code || "").trim();
  const rawName = String(item.class_level_name || item.name || "").trim();
  const group = String(item.class_group_name || item.group_name || "").trim();
  const level = String(item.level_name || "").trim();
  const usableCode = directCode && !/^\d+$/.test(directCode) ? directCode : "";
  const normalized = (usableCode || rawName)
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/APIC/g, "AC")
    .replace(/-/g, "");

  if (/^\dAC\d?$/i.test(normalized) || /^TC\d?$/i.test(normalized) || /^\dBAC\d?$/i.test(normalized)) {
    return normalized + (group && !normalized.endsWith(group) ? group.replace(/\s+/g, "") : "");
  }

  const normalizedLevel = level.toLowerCase();
  const levelNumber = level.match(/\d+/)?.[0] || rawName.match(/\d+/)?.[0] || "";
  const groupLabel = group || (/^\d+$/.test(rawName) ? rawName : "");
  if (levelNumber && (normalizedLevel.includes("coll") || /\bac\b/i.test(level))) {
    return `${levelNumber}AC${groupLabel}`;
  }

  if (normalizedLevel.includes("tronc") || normalizedLevel.includes("tc")) {
    return `TC${groupLabel}`;
  }

  if (levelNumber && normalizedLevel.includes("bac")) {
    return `${levelNumber}BAC${groupLabel}`;
  }

  return normalized && !/^\d+$/.test(normalized) ? normalized : rawName || "-";
};

const compactClassName = (item) => {
  if (!item) {
    return "-";
  }

  const abbreviated = abbreviateClassName(item);
  if (abbreviated !== "-") {
    return abbreviated;
  }

  const code = String(item.code || "").trim();
  const level = String(item.level_name || item.name || "").trim();
  const group = String(item.group_name || "").trim();
  const compactLevel = code && !/^\d+$/.test(code) ? code : level.replace(/\s+/g, "").toUpperCase();

  if (compactLevel && group) {
    return `${compactLevel}-${group.replace(/\s+/g, "")}`;
  }

  return compactLevel || level || group || "-";
};

const courseTone = (schedule) => {
  if (isExternalBusy(schedule)) {
    return "external";
  }

  const code = scheduleSubjectCode(schedule);
  const tones = ["blue", "green", "amber", "rose", "violet", "cyan"];
  const index = String(code)
    .split("")
    .reduce((total, char) => total + char.charCodeAt(0), 0);
  return tones[index % tones.length];
};

const sameSchedule = (first, second) => {
  if (first?.id && second?.id) {
    return String(first.id) === String(second.id);
  }

  return (
    String(first?.class_level_id || "") === String(second?.class_level_id || "") &&
    String(first?.teacher_id || "") === String(second?.teacher_id || "") &&
    String(first?.teacher_name || "").toLowerCase() === String(second?.teacher_name || "").toLowerCase() &&
    String(first?.day_of_week || "") === String(second?.day_of_week || "") &&
    formatTime(first?.start_time) === formatTime(second?.start_time) &&
    formatTime(first?.end_time) === formatTime(second?.end_time)
  );
};

const uniqueSchedules = (...scheduleLists) => {
  const merged = [];
  scheduleLists.flat().filter(Boolean).forEach((schedule) => {
    if (!merged.some((item) => sameSchedule(item, schedule))) {
      merged.push(schedule);
    }
  });
  return merged;
};

const scheduleMatchesTeacher = (schedule, teacher) => {
  if (!teacher) {
    return false;
  }

  if (schedule.teacher_id && teacher.id) {
    return String(schedule.teacher_id) === String(teacher.id);
  }

  return String(schedule.teacher_name || "").trim().toLowerCase() === teacherName(teacher).trim().toLowerCase();
};

const scheduleOverlapsSlot = (schedule, day, startTime, endTime) =>
  schedule.day_of_week === day && timeRangesOverlap(schedule.start_time, schedule.end_time, startTime, endTime);

const scheduleErrorMessage = (error, t, fallbackKey) => {
  const code = error?.response?.data?.code;
  const translations = {
    CLASS_SLOT_CONFLICT: "schedules.classSlotConflict",
    TEACHER_SLOT_CONFLICT: "schedules.teacherSlotConflict",
    SUBJECT_WEEKLY_HOURS_EXCEEDED: "schedules.subjectHoursExceeded",
    TEACHER_WEEKLY_HOURS_EXCEEDED: "schedules.teacherHoursExceeded",
    INVALID_COURSE_DURATION: "schedules.invalidCourseDuration",
  };
  return translations[code] ? t(translations[code]) : error?.response?.data?.message || t(fallbackKey);
};

export default function SchedulesPage() {
  const [searchParams] = useSearchParams();
  const requestedTeacherId = searchParams.get("teacher_id") || "";
  const { user } = useAuth();
  const { language, t } = useI18n();
  const canDeleteTeachers = ["super_admin", "admin"].includes(user?.role);
  const canManageSchedules = user?.role === "admin";
  const scheduleBoardRef = useRef(null);
  const [mode, setMode] = useState(() => (user?.role === "admin" ? "class" : "teacher"));
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedTeacherId, setSelectedTeacherId] = useState(requestedTeacherId);
  const [selectedYear, setSelectedYear] = useState(String(currentYear));
  const [selectedWeek, setSelectedWeek] = useState(String(currentWeek));
  const [teacherForm, setTeacherForm] = useState(emptyTeacherForm);
  const [editingTeacherId, setEditingTeacherId] = useState(null);
  const [teacherModalOpen, setTeacherModalOpen] = useState(false);
  const [teacherSearch, setTeacherSearch] = useState("");
  const [teacherSubjectFilter, setTeacherSubjectFilter] = useState("");

  const [classes, setClasses] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [school, setSchool] = useState({ id: null, name: null, logo_path: null });
  const [schedules, setSchedules] = useState([]);
  const [weeklyTeacherSchedules, setWeeklyTeacherSchedules] = useState([]);
  const [workloads, setWorkloads] = useState([]);
  const [selectedPaletteTeacherId, setSelectedPaletteTeacherId] = useState("");
  const [dragOverCell, setDragOverCell] = useState("");
  const [movingSchedule, setMovingSchedule] = useState(false);

  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [subjectsLoading, setSubjectsLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfPreview, setPdfPreview] = useState({ open: false, url: "", filename: "", blob: null });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const selectedClass = useMemo(
    () => classes.find((item) => String(item.id) === String(selectedClassId)),
    [classes, selectedClassId]
  );

  const selectedTeacher = useMemo(
    () => teachers.find((item) => String(item.id) === String(selectedTeacherId)),
    [teachers, selectedTeacherId]
  );

  const selectedPaletteTeacher = useMemo(
    () => teachers.find((item) => String(item.id) === String(selectedPaletteTeacherId)),
    [teachers, selectedPaletteTeacherId]
  );

  const workloadByTeacher = useMemo(
    () => new Map(workloads.map((item) => [String(item.teacher_id), item])),
    [workloads]
  );

  const timeSlots = useMemo(() => {
    return buildTimeSlots(schedules);
  }, [schedules]);

  const targetLabel = mode === "class" ? compactClassName(selectedClass) : teacherName(selectedTeacher) || t("roles.professeur");
  const filteredTeachers = useMemo(() => {
    const search = teacherSearch.trim().toLowerCase();
    return teachers.filter((teacher) => {
      const matchesSearch =
        !search ||
        teacherName(teacher).toLowerCase().includes(search) ||
        String(teacher.phone || "").toLowerCase().includes(search);
      const matchesSubject =
        !teacherSubjectFilter ||
        teacherSubjectIds(teacher).includes(String(teacherSubjectFilter)) ||
        weeklyTeacherSchedules.some(
          (schedule) =>
            scheduleMatchesTeacher(schedule, teacher) &&
            !isExternalBusy(schedule) &&
            String(schedule.subject_id || "") === teacherSubjectFilter
        );
      return matchesSearch && matchesSubject;
    });
  }, [teachers, teacherSearch, teacherSubjectFilter, weeklyTeacherSchedules]);
  const [allSubjects, setAllSubjects] = useState([]);
  const activeTeachers = useMemo(
    () => teachers.filter((teacher) => String(teacher.status || "ACTIVE").toUpperCase() === "ACTIVE"),
    [teachers]
  );
  const teacherAllowedClasses = useMemo(() => {
    if (mode !== "teacher" || !selectedTeacher) {
      return classes;
    }

    const ids = teacherClassLevelIds(selectedTeacher);
    return ids.length ? classes.filter((item) => ids.includes(String(item.id))) : [];
  }, [classes, mode, selectedTeacher]);
  const courseClassOptions = useMemo(() => {
    const formTeacher = teachers.find((teacher) => String(teacher.id) === String(form.teacher_id));
    const targetTeacher = mode === "teacher" ? selectedTeacher : formTeacher;
    if (!targetTeacher) return classes;
    const ids = teacherClassLevelIds(targetTeacher);
    return ids.length ? classes.filter((item) => ids.includes(String(item.id))) : [];
  }, [classes, form.teacher_id, mode, selectedTeacher, teachers]);
  const filteredSubjects = useMemo(() => {
    const formTeacher = teachers.find((teacher) => String(teacher.id) === String(form.teacher_id));
    const targetTeacher = mode === "teacher" ? selectedTeacher : formTeacher;
    if (!targetTeacher) {
      return subjects;
    }

    const ids = teacherSubjectIds(targetTeacher);
    return ids.length ? subjects.filter((subject) => ids.includes(String(subject.id))) : [];
  }, [form.teacher_id, mode, selectedTeacher, subjects, teachers]);
  const courseTeacherOptions = useMemo(() => {
    if (mode === "class") {
      return activeTeachers.filter((teacher) => {
        const matchesClass = !form.class_level_id || teacherTeachesClass(teacher, form.class_level_id);
        const matchesSubject = !form.subject_id || teacherTeachesSubject(teacher, form.subject_id);
        return matchesClass && matchesSubject;
      });
    }

    if (!form.subject_id) {
      return activeTeachers;
    }

    return [...activeTeachers].sort((first, second) => {
      const firstLevelMatch = teacherClassLevelIds(first).includes(String(form.class_level_id));
      const secondLevelMatch = teacherClassLevelIds(second).includes(String(form.class_level_id));
      const firstSubjectMatch = teacherSubjectIds(first).includes(String(form.subject_id));
      const secondSubjectMatch = teacherSubjectIds(second).includes(String(form.subject_id));
      const firstHasSubject = weeklyTeacherSchedules.some(
        (schedule) =>
          scheduleMatchesTeacher(schedule, first) &&
          !isExternalBusy(schedule) &&
          String(schedule.subject_id || "") === String(form.subject_id)
      );
      const secondHasSubject = weeklyTeacherSchedules.some(
        (schedule) =>
          scheduleMatchesTeacher(schedule, second) &&
          !isExternalBusy(schedule) &&
          String(schedule.subject_id || "") === String(form.subject_id)
      );
      if (firstLevelMatch !== secondLevelMatch) {
        return Number(secondLevelMatch) - Number(firstLevelMatch);
      }
      if (firstSubjectMatch !== secondSubjectMatch) {
        return Number(secondSubjectMatch) - Number(firstSubjectMatch);
      }
      return Number(secondHasSubject) - Number(firstHasSubject);
    });
  }, [activeTeachers, form.class_level_id, form.subject_id, weeklyTeacherSchedules]);

  const loadReferenceData = async () => {
    setLoading(true);
    setError("");
    try {
      const [classData, teacherData, allSubjectData, schoolData] = await Promise.all([
        getClassLevels(),
        getTeachers(),
        getSubjects(),
        getCurrentSchool().catch(() => null),
      ]);
      const safeClasses = Array.isArray(classData) ? classData : [];
      const safeTeachers = Array.isArray(teacherData) ? teacherData : [];
      const safeSubjects = Array.isArray(allSubjectData) ? allSubjectData : [];

      setClasses(safeClasses);
      setTeachers(safeTeachers);
      setAllSubjects(safeSubjects);
      if (schoolData) {
        setSchool(schoolData);
      }
      setSelectedClassId((prev) => prev || String(safeClasses[0]?.id || ""));
      setSelectedTeacherId((prev) => prev || String(safeTeachers[0]?.id || ""));
      setSelectedPaletteTeacherId((prev) => prev || String(safeTeachers[0]?.id || ""));
    } catch (err) {
      setError(t("schedules.referenceLoadError"));
    } finally {
      setLoading(false);
    }
  };

  const teacherScheduleQuery = (teacher, teacherId = teacher?.id) => ({
    teacher_id: teacherId,
    teacher_name: teacher ? teacherName(teacher) : undefined,
    year_value: selectedYear,
    week_number: selectedWeek,
    status: "ACTIVE",
  });

  const loadGridSchedules = async () => {
    const target = mode === "class" ? selectedClassId : selectedTeacherId;
    if (!target || (mode === "class" && (!selectedYear || !selectedWeek))) {
      setSchedules([]);
      return;
    }

    setError("");
    try {
      const query =
        mode === "class"
          ? {
              class_level_id: selectedClassId,
              year_value: selectedYear,
              week_number: selectedWeek,
              status: "ACTIVE",
            }
          : teacherScheduleQuery(selectedTeacher, selectedTeacherId);
      const data = await getSchedules({
        ...query,
      });
      setSchedules(Array.isArray(data) ? data : []);
    } catch (err) {
      setSchedules([]);
      setError(t("schedules.schedulesLoadError"));
    }
  };

  const loadWeeklyTeacherOverview = async () => {
    try {
      const data = await getSchedules({
        status: "ACTIVE",
        year_value: selectedYear,
        week_number: selectedWeek,
      });
      setWeeklyTeacherSchedules(Array.isArray(data) ? data : []);
    } catch {
      setWeeklyTeacherSchedules([]);
    }
  };

  const loadWorkloads = async () => {
    if (!canManageSchedules || !selectedYear || !selectedWeek) {
      setWorkloads([]);
      return;
    }

    try {
      const data = await getScheduleWorkloads({ year_value: selectedYear, week_number: selectedWeek });
      setWorkloads(Array.isArray(data) ? data : []);
    } catch {
      setWorkloads([]);
      setError(t("schedules.workloadLoadError"));
    }
  };

  const loadSubjectsForClass = async (classLevelId, selectedSubjectId = "", teacherOverride = null) => {
    setSubjects([]);
    if (!classLevelId) {
      return;
    }

    setSubjectsLoading(true);
    try {
      const data = await getSubjects({ class_level_id: classLevelId });
      const safeSubjects = Array.isArray(data) ? data : [];
      setSubjects(safeSubjects);
      const targetTeacher = teacherOverride || (mode === "teacher" ? selectedTeacher : null);
      const allowedSubjectIds = targetTeacher ? teacherSubjectIds(targetTeacher) : [];
      const availableSubjects = allowedSubjectIds.length
        ? safeSubjects.filter((subject) => allowedSubjectIds.includes(String(subject.id)))
        : safeSubjects;
      const fallbackSubjectId = availableSubjects[0]?.id ? String(availableSubjects[0].id) : "";
      const nextSubject =
        availableSubjects.find((subject) => String(subject.id) === String(selectedSubjectId)) ||
        availableSubjects[0];
      setForm((prev) => ({
        ...prev,
        subject_id: availableSubjects.some((subject) => String(subject.id) === String(selectedSubjectId))
          ? String(selectedSubjectId)
          : fallbackSubjectId,
        weekly_hours: subjectWeeklyHours(nextSubject),
      }));
    } catch (err) {
      setError(t("schedules.subjectsLoadError"));
    } finally {
      setSubjectsLoading(false);
    }
  };

  useEffect(() => {
    loadReferenceData();
  }, [t]);

  useEffect(() => {
    loadGridSchedules();
  }, [mode, selectedClassId, selectedTeacherId, selectedYear, selectedWeek, teachers]);

  useEffect(() => {
    loadWeeklyTeacherOverview();
  }, [selectedYear, selectedWeek]);

  useEffect(() => {
    loadWorkloads();
  }, [selectedYear, selectedWeek, canManageSchedules]);

  const closeModal = () => {
    setModalOpen(false);
    setEditingId(null);
    setSubjects([]);
    setForm({
      ...emptyForm,
      year_value: selectedYear,
      week_number: selectedWeek,
    });
  };

  const closeTeacherModal = () => {
    setTeacherModalOpen(false);
    setEditingTeacherId(null);
    setTeacherForm({
      ...emptyTeacherForm,
      primary_school: school?.name || "",
    });
  };

  const openTeacherModal = (teacher = null) => {
    setMessage("");
    setError("");
    setEditingTeacherId(teacher?.id || null);
    setTeacherForm(
      teacher
        ? {
            first_name: teacher.first_name || "",
            last_name: teacher.last_name || "",
            gender: teacher.gender || "",
            phone: teacher.phone || "",
            address: teacher.address || "",
            email: teacher.email || "",
            primary_school: teacher.primary_school || school?.name || "",
            class_level_ids: teacherClassLevelIds(teacher),
            subject_ids: teacherSubjectIds(teacher),
            status: teacher.status || "ACTIVE",
          }
        : {
            ...emptyTeacherForm,
            primary_school: school?.name || "",
          }
    );
    setTeacherModalOpen(true);
  };

  const closePdfPreview = () => {
    if (pdfPreview.url) {
      URL.revokeObjectURL(pdfPreview.url);
    }
    setPdfPreview({ open: false, url: "", filename: "", blob: null });
  };

  const openCreateModal = (day, slot, teacherOverride = null) => {
    const selectedSlot = normalizeSlot(slot);
    const targetTeacher = teacherOverride || (mode === "teacher" ? selectedTeacher : selectedPaletteTeacher);
    const nextForm = {
      ...emptyForm,
      class_level_id: mode === "class" ? String(selectedClassId) : "",
      teacher_id: targetTeacher ? String(targetTeacher.id) : "",
      teacher_name: teacherName(targetTeacher),
      room: "",
      year_value: selectedYear,
      week_number: selectedWeek,
      day_of_week: day,
      start_time: selectedSlot.start,
      end_time: selectedSlot.end || addOneHour(selectedSlot.start),
      is_external: false,
    };

    setMessage("");
    setError("");
    setEditingId(null);
    setForm(nextForm);
    setModalOpen(true);
    if (mode === "teacher" && !nextForm.class_level_id && targetTeacher) {
      const firstAllowedClassId = teacherClassLevelIds(targetTeacher)[0] || "";
      if (firstAllowedClassId) {
        setForm((prev) => ({ ...prev, class_level_id: String(firstAllowedClassId) }));
        loadSubjectsForClass(firstAllowedClassId, "", targetTeacher);
      }
    } else if (nextForm.class_level_id) {
      loadSubjectsForClass(nextForm.class_level_id, "", targetTeacher);
    }
  };

  const openEditModal = (schedule) => {
    const scheduleTeacherId =
      schedule.teacher_id ||
      teachers.find((teacher) => teacherName(teacher).toLowerCase() === String(schedule.teacher_name || "").toLowerCase())?.id ||
      "";
    const nextForm = {
      class_level_id: String(schedule.class_level_id || ""),
      subject_id: String(schedule.subject_id || ""),
      teacher_id: String(scheduleTeacherId),
      teacher_name: schedule.teacher_name || "",
      room: schedule.room || "",
      notes: schedule.notes || "",
      weekly_hours: schedule.subject_weekly_hours ? String(schedule.subject_weekly_hours) : "",
      year_value: String(schedule.year_value || selectedYear),
      week_number: String(schedule.week_number || selectedWeek),
      day_of_week: schedule.day_of_week || "MONDAY",
      start_time: formatTime(schedule.start_time),
      end_time: formatTime(schedule.end_time),
      is_external: Boolean(schedule.is_external),
    };

    setMessage("");
    setError("");
    setEditingId(schedule.id);
    setForm(nextForm);
    setModalOpen(true);
    if (!nextForm.is_external && nextForm.class_level_id) {
      const scheduleTeacher = teachers.find((teacher) => String(teacher.id) === String(scheduleTeacherId));
      loadSubjectsForClass(nextForm.class_level_id, nextForm.subject_id, scheduleTeacher);
    }
  };

  const submitTeacher = async (e) => {
    e.preventDefault();
    setMessage("");
    setError("");

    if (!teacherForm.gender) {
      setError(t("schedules.genderRequired"));
      return;
    }

    try {
      const payload = {
        ...teacherForm,
        class_level_ids: teacherForm.class_level_ids.map((id) => Number(id)),
        subject_ids: teacherForm.subject_ids.map((id) => Number(id)),
        school_id: school?.id || undefined,
      };
      const saved = editingTeacherId ? await updateTeacher(editingTeacherId, payload) : await createTeacher(payload);
      const teacherData = await getTeachers();
      const safeTeachers = Array.isArray(teacherData) ? teacherData : [];
      setTeachers(safeTeachers);
      setSelectedTeacherId(String(saved.id || selectedTeacherId));
      closeTeacherModal();
      setMode("teacher");
      setMessage(editingTeacherId ? t("schedules.teacherUpdated") : t("schedules.teacherCreated"));
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error("Erreur création/modification professeur", {
          status: err?.response?.status,
          data: err?.response?.data,
          payload: teacherForm,
        });
      }
      setError(t("schedules.teacherSaveError"));
    }
  };

  const removeTeacher = async (teacher) => {
    if (!teacher?.id || !window.confirm(t("schedules.teacherDeleteConfirm"))) {
      return;
    }

    setMessage("");
    setError("");
    try {
      await deleteTeacher(teacher.id);
      const teacherData = await getTeachers();
      const safeTeachers = Array.isArray(teacherData) ? teacherData : [];
      setTeachers(safeTeachers);
      if (String(selectedTeacherId) === String(teacher.id)) {
        setSelectedTeacherId(String(safeTeachers[0]?.id || ""));
      }
      setMessage(t("schedules.teacherDeleted"));
    } catch (err) {
      setError(t("schedules.teacherDeleteError"));
    }
  };

  const findTeacherAvailabilityConflict = (teacher, day, startTime, endTime, ignoreId = null) => {
    if (!teacher) {
      return null;
    }

    const knownSchedules = uniqueSchedules(schedules, weeklyTeacherSchedules);
    return (
      knownSchedules.find((schedule) => {
        if (ignoreId && String(schedule.id) === String(ignoreId)) {
          return false;
        }

        return scheduleMatchesTeacher(schedule, teacher) && scheduleOverlapsSlot(schedule, day, startTime, endTime);
      }) || null
    );
  };

  const teacherAvailabilityMessage = (teacher, conflict) => {
    if (!conflict) {
      return "";
    }

    if (isExternalBusy(conflict)) {
      const isFemale = String(teacher?.gender || conflict.teacher_gender || "").toUpperCase() === "FEMALE";
      return t(isFemale ? "schedules.externalConflictFemale" : "schedules.externalConflictMale", {
        name: teacherName(teacher),
      });
    }

    return t("schedules.internalConflict");
  };

  const submitSchedule = async (e) => {
    e.preventDefault();
    setMessage("");
    setError("");

    const isExternal = mode === "teacher" && form.is_external;
    const effectiveTeacherId = mode === "teacher" ? selectedTeacherId : form.teacher_id;
    const effectiveTeacher = teachers.find((teacher) => String(teacher.id) === String(effectiveTeacherId));

    if (!effectiveTeacher) {
      setError(t("schedules.teacherRequired"));
      return;
    }

    const availabilityConflict = findTeacherAvailabilityConflict(
      effectiveTeacher,
      form.day_of_week,
      form.start_time,
      form.end_time,
      editingId
    );
    if (availabilityConflict) {
      setError(teacherAvailabilityMessage(effectiveTeacher, availabilityConflict));
      return;
    }

    const payload = {
      class_level_id: isExternal ? undefined : Number(form.class_level_id),
      subject_id: isExternal ? undefined : Number(form.subject_id),
      weekly_hours: isExternal ? undefined : Number(form.weekly_hours),
      teacher_id: Number(effectiveTeacher.id),
      teacher_name: teacherName(effectiveTeacher),
      room: form.room.trim(),
      school_id: isExternal ? effectiveTeacher.school_id || school?.id || undefined : undefined,
      year_value: Number(form.year_value),
      week_number: Number(form.week_number),
      day_of_week: form.day_of_week,
      start_time: form.start_time,
      end_time: form.end_time,
      is_external: isExternal,
      schedule_type: isExternal ? "external_busy" : "eduflow_course",
      notes: isExternal ? form.notes.trim() : "",
    };

    try {
      if (editingId) {
        await updateSchedule(editingId, payload);
        setMessage(t("schedules.slotUpdated"));
      } else {
        await createSchedule(payload);
        setMessage(t("schedules.slotCreated"));
      }

      closeModal();
      const teacherData = await getTeachers();
      setTeachers(Array.isArray(teacherData) ? teacherData : []);
      if (!selectedTeacherId && payload.teacher_id) {
        setSelectedTeacherId(String(payload.teacher_id));
      }
      await Promise.all([loadGridSchedules(), loadWeeklyTeacherOverview(), loadWorkloads()]);
    } catch (err) {
      setError(scheduleErrorMessage(err, t, "schedules.slotSaveError"));
    }
  };

  const removeSchedule = async () => {
    if (!editingId || !window.confirm(t("schedules.slotDeleteConfirm"))) {
      return;
    }

    setMessage("");
    setError("");
    try {
      await deleteSchedule(editingId);
      setMessage(t("schedules.slotDeleted"));
      closeModal();
      await Promise.all([loadGridSchedules(), loadWeeklyTeacherOverview(), loadWorkloads()]);
    } catch (err) {
      setError(err?.response?.data?.message || t("schedules.slotDeleteError"));
    }
  };

  const beginTeacherDrag = (event, teacher) => {
    if (!canManageSchedules) return;
    const payload = JSON.stringify({ type: "teacher", teacherId: teacher.id });
    event.dataTransfer.effectAllowed = "copy";
    event.dataTransfer.setData("application/x-onecore-planning", payload);
    event.dataTransfer.setData("text/plain", payload);
    setSelectedPaletteTeacherId(String(teacher.id));
  };

  const beginScheduleDrag = (event, schedule) => {
    if (!canManageSchedules) return;
    event.stopPropagation();
    const payload = JSON.stringify({ type: "schedule", scheduleId: schedule.id });
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("application/x-onecore-planning", payload);
    event.dataTransfer.setData("text/plain", payload);
  };

  const readPlanningDrop = (event) => {
    const raw = event.dataTransfer.getData("application/x-onecore-planning") || event.dataTransfer.getData("text/plain");
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  };

  const handleCellDrop = async (event, day, slot) => {
    event.preventDefault();
    setDragOverCell("");
    if (!canManageSchedules || slot.pause) return;

    const dropped = readPlanningDrop(event);
    if (dropped?.type === "teacher") {
      const teacher = teachers.find((item) => String(item.id) === String(dropped.teacherId));
      if (!teacher) return;
      setSelectedPaletteTeacherId(String(teacher.id));
      if (mode === "teacher") setSelectedTeacherId(String(teacher.id));
      openCreateModal(day, slot, teacher);
      return;
    }

    if (dropped?.type !== "schedule" || movingSchedule) return;
    const schedule = uniqueSchedules(schedules, weeklyTeacherSchedules).find(
      (item) => String(item.id) === String(dropped.scheduleId)
    );
    if (!schedule) return;

    const duration = Math.max(30, timeToMinutes(schedule.end_time) - timeToMinutes(schedule.start_time));
    setMovingSchedule(true);
    setMessage("");
    setError("");
    try {
      await moveSchedule(schedule.id, {
        year_value: Number(selectedYear),
        week_number: Number(selectedWeek),
        day_of_week: day,
        start_time: slot.start,
        end_time: addMinutes(slot.start, duration),
      });
      setMessage(t("schedules.courseMoved"));
      await Promise.all([loadGridSchedules(), loadWeeklyTeacherOverview(), loadWorkloads()]);
    } catch (err) {
      setError(scheduleErrorMessage(err, t, "schedules.slotSaveError"));
    } finally {
      setMovingSchedule(false);
    }
  };

  const viewTeacherSchedule = async (teacher) => {
    const nextTeacherId = String(teacher.id);
    setMessage("");
    setError("");
    setMode("teacher");
    setSelectedTeacherId(nextTeacherId);
    setSelectedPaletteTeacherId(nextTeacherId);
    setSchedules([]);

    try {
      const data = await getSchedules({
        ...teacherScheduleQuery(teacher, nextTeacherId),
      });
      setSchedules(Array.isArray(data) ? data : []);
      requestAnimationFrame(() => {
        scheduleBoardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    } catch (err) {
      setSchedules([]);
      setError(t("schedules.teacherScheduleLoadError"));
    }
  };

  const buildWeeklyPdf = async (targetMode = mode, teacherOverride = null) => {
    const isClassPdf = targetMode === "class";
    const targetTeacherId = teacherOverride ? String(teacherOverride.id) : selectedTeacherId;

    if (isClassPdf && !selectedClassId) {
      setError(t("schedules.classPdfRequired"));
      return null;
    }

    if (!isClassPdf && !targetTeacherId) {
      setError(t("schedules.teacherPdfRequired"));
      return null;
    }

    setError("");

    let weeklySchedules = [];
    try {
      const targetTeacher = teacherOverride || selectedTeacher;
      const query = isClassPdf
        ? {
            class_level_id: selectedClassId,
            year_value: selectedYear,
            week_number: selectedWeek,
            status: "ACTIVE",
          }
        : teacherScheduleQuery(targetTeacher, targetTeacherId);
      const data = await getSchedules(query);
      const apiSchedules = Array.isArray(data) ? data : [];
      const visibleSchedules = schedules.filter((schedule) => {
        if (isClassPdf && (String(schedule.year_value) !== String(selectedYear) || String(schedule.week_number) !== String(selectedWeek))) {
          return false;
        }

        if (isClassPdf) {
          return String(schedule.class_level_id) === String(selectedClassId);
        }

        return scheduleMatchesTeacher(schedule, targetTeacher);
      });
      weeklySchedules = uniqueSchedules(apiSchedules, visibleSchedules);
    } catch (err) {
      setError(t("schedules.pdfSlotsLoadError"));
      return null;
    }

    const pdfSlots = Array.from(
      buildTimeSlots(weeklySchedules)
    );

    try {
      let exportSchool = school;
      const targetSchoolId = isClassPdf ? selectedClass?.school_id : teacherOverride?.school_id || school?.id;
      if (targetSchoolId && String(targetSchoolId) !== String(school?.id || "")) {
        exportSchool = await getSchoolById(targetSchoolId).catch(() => school);
      }

      return await buildSchedulePdf({
        mode: targetMode,
        school: exportSchool,
        logoUrl: exportSchool?.logo_data_url || resolveLogoUrl(exportSchool?.logo_path),
        className: compactClassName(selectedClass),
        teacherName: !isClassPdf ? teacherName(teacherOverride || selectedTeacher) : "",
        weekLabel: academicWeekLabel(selectedYear, selectedWeek, t),
        yearLabel: academicYearLabel(selectedYear),
        schedules: weeklySchedules,
        days: dayOptions.map((day) => ({ ...day, label: t(`schedules.days.${day.value}`) })),
        timeSlots: pdfSlots,
        labels: {
          isRtl: language === "ar",
          school: t("common.school"),
          time: t("schedules.time"),
          break: t("schedules.break"),
          elsewhere: t("schedules.elsewhere"),
          otherSchool: t("schedules.otherSchool"),
          classTitle: t("schedules.pdfClassTitle", { name: compactClassName(selectedClass) }),
          teacherTitle: t("schedules.pdfTeacherTitle", { name: teacherName(teacherOverride || selectedTeacher) }),
          period: t("schedules.pdfPeriod", {
            week: academicWeekLabel(selectedYear, selectedWeek, t),
            year: academicYearLabel(selectedYear),
          }),
          filename: t(isClassPdf ? "schedules.pdfClassFilename" : "schedules.pdfTeacherFilename"),
        },
      });
    } catch (err) {
      setError(t("schedules.pdfError"));
      return null;
    }
  };

  const previewWeeklyPdf = async (targetMode = mode, teacherOverride = null) => {
    setPdfLoading(true);
    try {
      const pdf = await buildWeeklyPdf(targetMode, teacherOverride);
      if (!pdf) {
        return;
      }

      if (pdfPreview.url) {
        URL.revokeObjectURL(pdfPreview.url);
      }
      const url = URL.createObjectURL(pdf.blob);
      setPdfPreview({ open: true, url, filename: pdf.filename, blob: pdf.blob });
    } finally {
      setPdfLoading(false);
    }
  };

  const downloadWeeklyPdf = async (targetMode = mode, teacherOverride = null) => {
    setPdfLoading(true);
    try {
      const pdf = await buildWeeklyPdf(targetMode, teacherOverride);
      if (pdf) {
        downloadBlob(pdf.blob, pdf.filename);
      }
    } finally {
      setPdfLoading(false);
    }
  };

  const teacherCourseCount = (teacher) =>
    weeklyTeacherSchedules.filter((schedule) => scheduleMatchesTeacher(schedule, teacher) && !isExternalBusy(schedule)).length;

  const formatWorkloadHours = (value) =>
    new Intl.NumberFormat(language === "ar" ? "ar-MA" : "fr-MA", { maximumFractionDigits: 2 }).format(Number(value || 0));

  return (
    <div className="admin-grid">
      <section className="panel schedule-board-panel" ref={scheduleBoardRef}>
        <div className="schedule-board-header">
          <div>
            <p className="brand-kicker">{t("schedules.title")}</p>
            <h2>{mode === "class" ? t("schedules.byClass") : t("schedules.byTeacher")}</h2>
            <p className="muted">
              {t("schedules.summary", {
                target: targetLabel,
                week: academicWeekLabel(selectedYear, selectedWeek, t),
                year: academicYearLabel(selectedYear),
              })}
            </p>
          </div>
          <div className="schedule-mode-tabs" role="tablist" aria-label={t("schedules.displayMode")}>
            <button
              type="button"
              className={mode === "class" ? "active" : ""}
              onClick={() => setMode("class")}
            >
              {t("schedules.classMode")}
            </button>
            <button
              type="button"
              className={mode === "teacher" ? "active" : ""}
              onClick={() => setMode("teacher")}
            >
              {t("schedules.teacherMode")}
            </button>
          </div>
        </div>

        <div className="schedule-toolbar">
          {mode === "class" ? (
            <label>
              <span>{t("common.class")}</span>
              <select value={selectedClassId} onChange={(e) => setSelectedClassId(e.target.value)}>
                {classes.map((item) => (
                  <option key={item.id} value={item.id}>
                    {classDisplayName(item)}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <div className="schedule-teacher-picker">
              <label>
                <span>{t("roles.professeur")}</span>
                <select value={selectedTeacherId} onChange={(e) => setSelectedTeacherId(e.target.value)}>
                  <option value="">{t("schedules.selectTeacher")}</option>
                  {teachers.map((teacher) => (
                    <option key={teacher.id} value={teacher.id}>
                      {teacherName(teacher)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}

          <label>
            <span>{t("common.schoolYear")}</span>
            <select value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)}>
              {yearOptions.map((year) => (
                <option key={year} value={year}>
                  {academicYearLabel(year)}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>{t("schedules.week")}</span>
            <select value={selectedWeek} onChange={(e) => setSelectedWeek(e.target.value)}>
              {weekOptions.map((week) => (
                <option key={week} value={week}>
                  {academicWeekLabel(selectedYear, week, t)}
                </option>
              ))}
            </select>
          </label>

          <button type="button" className="secondary-btn schedule-pdf-btn" onClick={() => previewWeeklyPdf(mode)} disabled={pdfLoading}>
            {t("schedules.viewPdf")}
          </button>
          <button type="button" className="secondary-btn schedule-pdf-btn" onClick={() => downloadWeeklyPdf(mode)} disabled={pdfLoading}>
            {t("schedules.downloadPdf")}
          </button>
        </div>

        {loading && <p className="muted">{t("common.loading")}</p>}
        {message && <p className="success-text">{message}</p>}
        {error && <p className="error-text">{error}</p>}
        {!loading && mode === "teacher" && teachers.length === 0 && (
          <p className="muted">{t("schedules.teachersEmpty")}</p>
        )}

        {canManageSchedules && (
          <section className="schedule-planning-palette" aria-label={t("schedules.teacherPalette") }>
            <div className="schedule-palette-heading">
              <div>
                <h3>{t("schedules.teacherPalette")}</h3>
                <p className="muted">{t("schedules.dragTeacherHelp")}</p>
              </div>
              {selectedPaletteTeacher && (
                <span className="schedule-selected-teacher">
                  {t("schedules.selectedTeacher", { name: teacherName(selectedPaletteTeacher) })}
                </span>
              )}
            </div>

            <div className="schedule-palette-filters">
              <label>
                <span>{t("schedules.teacherSearch")}</span>
                <input
                  placeholder={t("schedules.teacherSearchPlaceholder")}
                  value={teacherSearch}
                  onChange={(event) => setTeacherSearch(event.target.value)}
                />
              </label>
              <label>
                <span>{t("common.subject")}</span>
                <select value={teacherSubjectFilter} onChange={(event) => setTeacherSubjectFilter(event.target.value)}>
                  <option value="">{t("schedules.allSubjects")}</option>
                  {allSubjects.map((subject) => (
                    <option key={subject.id} value={subject.id}>{subjectLabel(subject)}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="schedule-palette-track" tabIndex="0">
              {filteredTeachers
                .filter((teacher) => String(teacher.status || "ACTIVE").toUpperCase() === "ACTIVE")
                .map((teacher) => {
                  const workload = workloadByTeacher.get(String(teacher.id)) || {};
                  const assigned = Number(workload.assigned_hours || 0);
                  const scheduled = Number(workload.scheduled_hours || 0);
                  const remaining = Number(workload.remaining_hours || 0);
                  const overload = Number(workload.overload_hours || 0);
                  const progress = assigned > 0 ? Math.min(100, (scheduled / assigned) * 100) : scheduled > 0 ? 100 : 0;
                  const selected = String(selectedPaletteTeacherId) === String(teacher.id);
                  return (
                    <article
                      key={teacher.id}
                      role="button"
                      tabIndex="0"
                      draggable
                      aria-pressed={selected}
                      className={`schedule-palette-teacher ${selected ? "selected" : ""} ${overload > 0 ? "overloaded" : ""}`}
                      onClick={() => setSelectedPaletteTeacherId(String(teacher.id))}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") setSelectedPaletteTeacherId(String(teacher.id));
                      }}
                      onDragStart={(event) => beginTeacherDrag(event, teacher)}
                    >
                      <div className="schedule-palette-teacher-head">
                        <div>
                          <strong>{teacherName(teacher)}</strong>
                          <span>{teacherSubjectLabels(teacher).join(", ") || "-"}</span>
                        </div>
                        <button
                          type="button"
                          className="schedule-palette-view"
                          onClick={(event) => {
                            event.stopPropagation();
                            viewTeacherSchedule(teacher);
                          }}
                        >
                          {t("schedules.viewSchedule")}
                        </button>
                      </div>
                      <div className="schedule-workload-values">
                        <span><b>{formatWorkloadHours(assigned)} h</b>{t("schedules.assignedShort")}</span>
                        <span><b>{formatWorkloadHours(scheduled)} h</b>{t("schedules.scheduledShort")}</span>
                        <span className={overload > 0 ? "danger" : ""}>
                          <b>{formatWorkloadHours(overload > 0 ? overload : remaining)} h</b>
                          {t(overload > 0 ? "schedules.overloadShort" : "schedules.remainingShort")}
                        </span>
                      </div>
                      <div className="schedule-workload-track"><i style={{ width: `${progress}%` }} /></div>
                    </article>
                  );
                })}
              {filteredTeachers.filter((teacher) => String(teacher.status || "ACTIVE").toUpperCase() === "ACTIVE").length === 0 && (
                <p className="muted">{t("schedules.noTeacherMatch")}</p>
              )}
            </div>
            <p className="schedule-touch-help">{t("schedules.touchTeacherHelp")}</p>
          </section>
        )}

        <div className="schedule-grid-wrap">
          <table className="schedule-week-grid">
            <thead>
              <tr>
                <th>{t("schedules.time")}</th>
                {dayOptions.map((day) => (
                  <th key={day.value}>{t(`schedules.days.${day.value}`)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {timeSlots.map((slot) => (
                <tr key={slot.start} className={slot.pause ? "schedule-pause-row" : ""}>
                  <th>{slot.label}</th>
                  {dayOptions.map((day) => {
                    const slotEnd = slot.end || addOneHour(slot.start);
                    const items = schedules.filter(
                      (schedule) => scheduleOverlapsSlot(schedule, day.value, slot.start, slotEnd)
                    );

                    return (
                      <td key={`${day.value}-${slot.start}`}>
                        <div
                          className={`schedule-cell ${dragOverCell === `${day.value}-${slot.start}` ? "schedule-cell-drop-target" : ""}`}
                          onDragOver={(event) => {
                            if (!canManageSchedules || slot.pause) return;
                            event.preventDefault();
                            event.dataTransfer.dropEffect = "move";
                            setDragOverCell(`${day.value}-${slot.start}`);
                          }}
                          onDragLeave={() => setDragOverCell("")}
                          onDrop={(event) => handleCellDrop(event, day.value, slot)}
                        >
                          {slot.pause && <span className="schedule-pause-label">{t("schedules.break")}</span>}
                          {items.map((schedule) => (
                            <button
                              key={schedule.id}
                              type="button"
                              className={`schedule-course schedule-course-${courseTone(schedule)}`}
                              draggable={canManageSchedules}
                              onDragStart={(event) => beginScheduleDrag(event, schedule)}
                              onDragEnd={() => setDragOverCell("")}
                              onClick={() => canManageSchedules && openEditModal(schedule)}
                              title={canManageSchedules ? t("schedules.editSlot") : t("schedules.readOnly")}
                            >
                              <strong>{isExternalBusy(schedule) ? busyLabelForTeacher(selectedTeacher, t) : scheduleSubjectCode(schedule)}</strong>
                              {scheduleSessionLabel(schedule) && <em>{scheduleSessionLabel(schedule)}</em>}
                              <span>
                                {isExternalBusy(schedule)
                                  ? schedule.notes || t("schedules.otherSchool")
                                  : mode === "class"
                                    ? schedule.teacher_name
                                    : abbreviateClassName(schedule)}
                              </span>
                              <small>
                                {formatTime(schedule.start_time)} - {formatTime(schedule.end_time)}
                                {schedule.room ? ` · ${schedule.room}` : ""}
                              </small>
                            </button>
                          ))}
                          {canManageSchedules && !slot.pause && mode === "teacher" && items.length === 0 && (
                            <button
                              type="button"
                              className="schedule-empty-cell"
                              onClick={() => openCreateModal(day.value, slot, selectedTeacher)}
                              title={t("schedules.addSlot")}
                              disabled={!selectedTeacherId}
                            >
                              {t("common.add")}
                            </button>
                          )}
                          {canManageSchedules && !slot.pause && mode === "class" && (
                            <button
                              type="button"
                              className={items.length ? "schedule-add-mini" : "schedule-empty-cell"}
                              onClick={() => openCreateModal(day.value, slot)}
                              title={t("schedules.addCourse")}
                            >
                              {items.length ? "+" : t("common.add")}
                            </button>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {false && mode === "teacher" && (
        <section className="panel">
          <div className="panel-header compact-header">
            <div>
              <h3>{t("schedules.teachers")}</h3>
              <p className="muted">
                {t("schedules.weekCountersHelp", { week: academicWeekLabel(selectedYear, selectedWeek, t) })}
              </p>
            </div>
            <button type="button" className="schedule-add-teacher-btn" onClick={() => openTeacherModal()}>
              + {t("schedules.addTeacher")}
            </button>
          </div>

          <div className="schedule-teacher-filters">
            <label>
              <span>{t("schedules.teacherSearch")}</span>
              <input
                placeholder={t("schedules.teacherSearchPlaceholder")}
                value={teacherSearch}
                onChange={(e) => setTeacherSearch(e.target.value)}
              />
            </label>
            <label>
              <span>{t("common.subject")}</span>
              <select value={teacherSubjectFilter} onChange={(e) => setTeacherSubjectFilter(e.target.value)}>
                <option value="">{t("schedules.allSubjects")}</option>
                {allSubjects.map((subject) => (
                  <option key={subject.id} value={subject.id}>
                    {subjectLabel(subject)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="teacher-schedule-grid">
            {filteredTeachers.map((teacher) => (
              <article
                key={teacher.id}
                className={`teacher-schedule-card ${String(selectedTeacherId) === String(teacher.id) ? "teacher-schedule-card-active" : ""}`}
              >
                <div>
                  <p className="kpi-label">{teacherName(teacher)}</p>
                  <p className="muted">{t("schedules.subjectsLabel", { value: teacherSubjectLabels(teacher).join(", ") || teacherSubjectCodes(teacher, weeklyTeacherSchedules).join(", ") || "-" })}</p>
                  <p className="muted">{t("schedules.levelsLabel", { value: teacherClassLabels(teacher).join(", ") || "-" })}</p>
                  <p className="muted">{t("schedules.phoneLabel", { value: teacher.phone || "-" })}</p>
                  <p className="teacher-slot-count">{t(teacherCourseCount(teacher) > 1 ? "schedules.slotsThisWeekPlural" : "schedules.slotsThisWeek", { count: teacherCourseCount(teacher) })}</p>
                </div>
                <div className="teacher-card-actions">
                  <button type="button" className="secondary-btn" onClick={() => viewTeacherSchedule(teacher)}>
                    {t("schedules.viewSchedule")}
                  </button>
                  <button type="button" className="secondary-btn" onClick={() => openTeacherModal(teacher)}>
                    {t("common.edit")}
                  </button>
                  <button type="button" className="secondary-btn" onClick={() => downloadWeeklyPdf("teacher", teacher)} disabled={pdfLoading}>
                    PDF
                  </button>
                  {canDeleteTeachers && (
                    <button type="button" className="danger-btn" onClick={() => removeTeacher(teacher)}>
                      {t("common.delete")}
                    </button>
                  )}
                </div>
              </article>
            ))}
            {filteredTeachers.length === 0 && (
              <p className="muted">{t("schedules.noTeacherMatch")}</p>
            )}
          </div>
        </section>
      )}

      {false && teacherModalOpen && (
        <div className="schedule-modal-backdrop" role="presentation">
          <section className="schedule-modal" aria-modal="true" role="dialog">
            <div className="schedule-modal-header">
              <div>
                <p className="brand-kicker">{editingTeacherId ? t("common.edit") : t("common.add")}</p>
                <h3>{editingTeacherId ? t("schedules.editTeacher") : t("schedules.newTeacher")}</h3>
              </div>
              <button type="button" className="secondary-btn modal-close-btn" onClick={closeTeacherModal}>
                {t("common.close")}
              </button>
            </div>

            <form className="form-grid schedule-modal-form" onSubmit={submitTeacher}>
              <label>
                <span>{t("common.lastName")}</span>
                <input
                  value={teacherForm.last_name}
                  onChange={(e) => setTeacherForm((prev) => ({ ...prev, last_name: e.target.value }))}
                  required
                />
              </label>
              <label>
                <span>{t("common.firstName")}</span>
                <input
                  value={teacherForm.first_name}
                  onChange={(e) => setTeacherForm((prev) => ({ ...prev, first_name: e.target.value }))}
                  required
                />
              </label>
              <label>
                <span>{t("common.status")}</span>
                <select
                  value={teacherForm.status}
                  onChange={(e) => setTeacherForm((prev) => ({ ...prev, status: e.target.value }))}
                >
                  <option value="ACTIVE">{t("statuses.active")}</option>
                  <option value="INACTIVE">{t("statuses.inactive")}</option>
                </select>
              </label>

              <fieldset className="schedule-radio-group full-field">
                <legend>{t("schedules.gender")}</legend>
                <label>
                  <input
                    type="radio"
                    name="teacher-gender"
                    value="MALE"
                    checked={teacherForm.gender === "MALE"}
                    onChange={(e) => setTeacherForm((prev) => ({ ...prev, gender: e.target.value }))}
                    required
                  />
                  <span>{t("genders.man")}</span>
                </label>
                <label>
                  <input
                    type="radio"
                    name="teacher-gender"
                    value="FEMALE"
                    checked={teacherForm.gender === "FEMALE"}
                    onChange={(e) => setTeacherForm((prev) => ({ ...prev, gender: e.target.value }))}
                    required
                  />
                  <span>{t("genders.woman")}</span>
                </label>
              </fieldset>

              <label>
                <span>{t("common.phone")}</span>
                <input
                  value={teacherForm.phone}
                  onChange={(e) => setTeacherForm((prev) => ({ ...prev, phone: e.target.value }))}
                  required
                />
              </label>
              <label>
                <span>{t("schedules.optionalEmail")}</span>
                <input
                  type="email"
                  value={teacherForm.email}
                  onChange={(e) => setTeacherForm((prev) => ({ ...prev, email: e.target.value }))}
                />
              </label>
              <label className="full-field">
                <span>{t("common.address")}</span>
                <input
                  value={teacherForm.address}
                  onChange={(e) => setTeacherForm((prev) => ({ ...prev, address: e.target.value }))}
                  required
                />
              </label>
              <label className="full-field">
                <span>{t("schedules.primarySchool")}</span>
                <input
                  value={teacherForm.primary_school}
                  onChange={(e) => setTeacherForm((prev) => ({ ...prev, primary_school: e.target.value }))}
                  required
                />
              </label>

              <fieldset className="teacher-level-picker full-field">
                <legend>{t("schedules.taughtLevels")}</legend>
                {classes.map((item) => {
                  const id = String(item.id);
                  return (
                    <label key={item.id}>
                      <input
                        type="checkbox"
                        checked={teacherForm.class_level_ids.includes(id)}
                        onChange={(e) =>
                          setTeacherForm((prev) => ({
                            ...prev,
                            class_level_ids: e.target.checked
                              ? [...prev.class_level_ids, id]
                              : prev.class_level_ids.filter((classLevelId) => classLevelId !== id),
                          }))
                        }
                      />
                      <span>{abbreviateClassName(item)}</span>
                    </label>
                  );
                })}
                {classes.length === 0 && <p className="muted">{t("schedules.noClassAvailable")}</p>}
              </fieldset>

              <fieldset className="teacher-level-picker full-field">
                <legend>{t("schedules.taughtSubjects")}</legend>
                {allSubjects.map((subject) => {
                  const id = String(subject.id);
                  return (
                    <label key={subject.id}>
                      <input
                        type="checkbox"
                        checked={teacherForm.subject_ids.includes(id)}
                        onChange={(e) =>
                          setTeacherForm((prev) => ({
                            ...prev,
                            subject_ids: e.target.checked
                              ? [...prev.subject_ids, id]
                              : prev.subject_ids.filter((subjectId) => subjectId !== id),
                          }))
                        }
                      />
                      <span>{subjectLabel(subject)}</span>
                    </label>
                  );
                })}
                {allSubjects.length === 0 && <p className="muted">{t("schedules.noSubjectAvailable")}</p>}
              </fieldset>

              <div className="form-actions full-field">
                <button type="submit">{editingTeacherId ? t("common.save") : t("schedules.addTeacher")}</button>
              </div>
            </form>
          </section>
        </div>
      )}

      {modalOpen && (
        <div className="schedule-modal-backdrop" role="presentation">
          <section className="schedule-modal" aria-modal="true" role="dialog">
            <div className="schedule-modal-header">
              <div>
                <p className="brand-kicker">{editingId ? t("common.edit") : t("common.add")}</p>
                <h3>{editingId ? t("schedules.editCourse") : t("schedules.newCourse")}</h3>
              </div>
              <button type="button" className="secondary-btn modal-close-btn" onClick={closeModal}>
                {t("common.close")}
              </button>
            </div>

            <form className="form-grid schedule-modal-form" onSubmit={submitSchedule}>
              {mode === "teacher" && (
                <label className="full-field">
                  <span>{t("schedules.courseType")}</span>
                  <select
                    value={form.is_external ? "EXTERNAL" : "INTERNAL"}
                    onChange={(e) => {
                      const isExternal = e.target.value === "EXTERNAL";
                      setForm((prev) => ({
                        ...prev,
                        is_external: isExternal,
                        class_level_id: isExternal ? "" : prev.class_level_id,
                        subject_id: isExternal ? "" : prev.subject_id,
                        weekly_hours: isExternal ? "" : prev.weekly_hours,
                      }));
                      if (!isExternal && form.class_level_id) {
                        loadSubjectsForClass(form.class_level_id, form.subject_id, selectedTeacher);
                      }
                    }}
                  >
                    <option value="INTERNAL">{t("schedules.internalCourse")}</option>
                    <option value="EXTERNAL">{t("schedules.elsewhere")}</option>
                  </select>
                </label>
              )}

              {!form.is_external && (
                <label>
                  <span>{t("common.class")}</span>
                  <select
                    value={form.class_level_id}
                    onChange={(e) => {
                      const classLevelId = e.target.value;
                      setForm((prev) => ({ ...prev, class_level_id: classLevelId, subject_id: "", weekly_hours: "" }));
                      const currentTeacher = teachers.find((teacher) => String(teacher.id) === String(form.teacher_id));
                      loadSubjectsForClass(classLevelId, "", mode === "teacher" ? selectedTeacher : currentTeacher);
                    }}
                    required
                  >
                    <option value="">{t("schedules.selectClass")}</option>
                    {courseClassOptions.map((item) => (
                      <option key={item.id} value={item.id}>
                        {classDisplayName(item)}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              {mode === "teacher" && !form.is_external && teacherAllowedClasses.length === 0 && (
                <p className="error-text full-field">{t("schedules.taughtLevelsRequired")}</p>
              )}

              {!form.is_external && (
                <label>
                  <span>{t("common.subject")}</span>
                  <select
                    value={form.subject_id}
                    onChange={(e) => {
                      const subject = filteredSubjects.find((item) => String(item.id) === String(e.target.value));
                      setForm((prev) => {
                        const currentTeacher = teachers.find((teacher) => String(teacher.id) === String(prev.teacher_id));
                        const keepTeacher = mode !== "class" || (
                          currentTeacher
                          && teacherTeachesClass(currentTeacher, prev.class_level_id)
                          && teacherTeachesSubject(currentTeacher, e.target.value)
                        );
                        return {
                          ...prev,
                          subject_id: e.target.value,
                          weekly_hours: subjectWeeklyHours(subject),
                          teacher_id: keepTeacher ? prev.teacher_id : "",
                          teacher_name: keepTeacher ? prev.teacher_name : "",
                        };
                      });
                    }}
                    required
                    disabled={!form.class_level_id || subjectsLoading || filteredSubjects.length === 0}
                  >
                    <option value="">
                      {subjectsLoading ? t("schedules.loadingSubjects") : t("schedules.selectSubject")}
                    </option>
                    {filteredSubjects.map((subject) => (
                      <option key={subject.id} value={subject.id}>
                        {subjectLabel(subject)}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <label>
                <span>{t("schedules.day")}</span>
                <select value={form.day_of_week} onChange={(e) => setForm((prev) => ({ ...prev, day_of_week: e.target.value }))} required>
                  {dayOptions.map((day) => <option key={day.value} value={day.value}>{t(`schedules.days.${day.value}`)}</option>)}
                </select>
              </label>

              <label>
                <span>{t("schedules.startTime")}</span>
                <input type="time" value={form.start_time} onChange={(e) => setForm((prev) => ({ ...prev, start_time: e.target.value }))} required />
              </label>

              <label>
                <span>{t("schedules.endTime")}</span>
                <input type="time" value={form.end_time} onChange={(e) => setForm((prev) => ({ ...prev, end_time: e.target.value }))} required />
              </label>

              <label>
                <span>{t("schedules.room")}</span>
                <input value={form.room} onChange={(e) => setForm((prev) => ({ ...prev, room: e.target.value }))} placeholder={t("schedules.roomPlaceholder")} />
              </label>

              {mode === "teacher" && !form.is_external && form.class_level_id && !subjectsLoading && filteredSubjects.length === 0 && (
                <p className="error-text full-field">{t("schedules.taughtSubjectsRequired")}</p>
              )}

              {!form.is_external && (
                <label>
                  <span>{t("schedules.weeklyHours")}</span>
                  <input
                    type="number"
                    min="1"
                    max="40"
                    value={form.weekly_hours}
                    onChange={(e) => setForm((prev) => ({ ...prev, weekly_hours: e.target.value }))}
                    required
                  />
                </label>
              )}

              {mode === "class" && (
                <label>
                  <span>{t("roles.professeur")}</span>
                  <select
                    value={form.teacher_id}
                    onChange={(e) => {
                      const teacherId = e.target.value;
                      const teacher = teachers.find((item) => String(item.id) === String(teacherId));
                      setForm((prev) => ({ ...prev, teacher_id: teacherId, teacher_name: teacherName(teacher) }));
                    }}
                    required
                  >
                    <option value="">{t("schedules.selectTeacher")}</option>
                    {courseTeacherOptions.map((teacher) => (
                      <option key={teacher.id} value={teacher.id}>
                        {teacherName(teacher)}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              {mode === "class" && !form.is_external && form.subject_id && courseTeacherOptions.length === 0 && (
                <p className="error-text full-field">
                  {t("schedules.noQualifiedTeacher")}
                </p>
              )}

              {form.is_external && (
                <label className="full-field">
                  <span>{t("schedules.note")}</span>
                  <input
                    placeholder={t("schedules.otherSchool")}
                    value={form.notes}
                    onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                  />
                </label>
              )}

              {!form.is_external && form.class_level_id && !subjectsLoading && subjects.length === 0 && (
                <p className="error-text full-field">{t("schedules.noActiveSubject")}</p>
              )}
              <div className="form-actions full-field">
                <button type="submit">{editingId ? t("common.save") : t("schedules.createCourse")}</button>
                {editingId && (
                  <button type="button" className="danger-btn" onClick={removeSchedule}>
                    {t("common.delete")}
                  </button>
                )}
              </div>
            </form>
          </section>
        </div>
      )}

      {pdfPreview.open && (
        <div className="schedule-modal-backdrop" role="presentation">
          <section className="schedule-modal schedule-pdf-modal" aria-modal="true" role="dialog">
            <div className="schedule-modal-header">
              <div>
                <p className="brand-kicker">{t("schedules.preview")}</p>
                <h3>{t("schedules.viewPdf")}</h3>
              </div>
              <button type="button" className="secondary-btn modal-close-btn" onClick={closePdfPreview}>
                {t("common.close")}
              </button>
            </div>
            <object className="schedule-pdf-preview" data={pdfPreview.url} type="application/pdf">
              <iframe className="schedule-pdf-preview" src={pdfPreview.url} title={pdfPreview.filename} />
            </object>
            <div className="form-actions full-field">
              <button type="button" onClick={() => pdfPreview.blob && downloadBlob(pdfPreview.blob, pdfPreview.filename)}>
                {t("schedules.download")}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
