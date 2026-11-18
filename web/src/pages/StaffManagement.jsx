import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
import ManagementShell from "../components/ManagementShell.jsx";
import PasswordInput from "../components/PasswordInput.jsx";
import { staffRoles, initialRoleDefinitions } from "../data/staff.js";
import {
  staffStatus,
  initials,
  managementDate,
  validateStaff,
  generateTemporaryPassword,
} from "../utils/staffSettings.js";
import { shiftsApi, attendanceApi } from "../utils/api.js";

function StaffDialog({ title, onClose, children, wide = false }) {
  const ref = useRef(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className={"ss-dialog" + (wide ? " ss-dialog-wide" : "")}
      aria-label={title}
      onCancel={onClose}
    >
      <button
        type="button"
        className="inventory-close"
        aria-label="Close staff dialog"
        onClick={onClose}
      >
        ×
      </button>
      {children}
    </dialog>
  );
}

const AVAILABLE_MODULES = [
  "Inbound Dock",
  "Outbound Fulfillment",
  "Inventory Management",
  "Putaway & Racking",
  "Barcode & QR Scanner",
  "Cycle Count & Opname",
  "Issue Resolution",
  "Stock Alerts",
  "Audit Log View",
];

const MAX_SHIFT_PACKAGES = 10;
const MAX_PACKAGE_NAME_LEN = 25;
const MAX_SHORT_NAME_LEN = 10;

const PRESET_HEX_SWATCHES = [
  "#5c732b", // Olive Susuno
  "#0891b2", // Cyan Inbound
  "#d97706", // Amber Outbound
  "#9333ea", // Purple Office
  "#e11d48", // Rose Alert
  "#2563eb", // Blue
  "#059669", // Emerald
  "#475569", // Slate Charcoal
];

const DEFAULT_SHIFT_PACKAGES = [];

const CALENDAR_WEEKDAYS = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];
const PACKAGE_NUMBERS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];

function calculateDuration(start, end) {
  if (!start || !end) return "";
  const [sh, sm] = String(start).split(":").map(Number);
  const [eh, em] = String(end).split(":").map(Number);
  if (isNaN(sh) || isNaN(sm) || isNaN(eh) || isNaN(em)) return "";
  let startMin = sh * 60 + sm;
  let endMin = eh * 60 + em;
  if (endMin < startMin) {
    endMin += 24 * 60; // Shift malam melewati tengah malam
  }
  const diff = endMin - startMin;
  const h = Math.floor(diff / 60);
  const m = diff % 60;
  if (h > 0 && m > 0) return `${h} jam ${m} mnt`;
  if (h > 0) return `${h} jam kerja`;
  return `${m} menit`;
}

function findMatchingPackage(sh, packages) {
  const sStart = sh.start_time ? String(sh.start_time).slice(0, 5) : "";
  const sEnd = sh.end_time ? String(sh.end_time).slice(0, 5) : "";
  if (sh.package_id) {
    const byId = packages.find((p) => p.id === sh.package_id);
    if (byId) return byId;
  }
  const byTime = packages.find((p) => p.startTime === sStart && p.endTime === sEnd);
  if (byTime) return byTime;
  return {
    id: "custom",
    name: "Kustom",
    shortName: "Kustom",
    icon: "#",
    color: "#5c732b",
    startTime: sStart,
    endTime: sEnd,
  };
}

const emptyForm = () => ({
  fullName: "",
  role: "Staf",
  contact: "",
  warehouse: "",
  username: "",
  password: "",
});

function StaffManagement({
  manager,
  warehouse,
  staff,
  warehouses,
  regional,
  onNavigate,
  onSignOut,
  onCreate,
  onEdit,
  onReset,
  onSuspend,
  initialStaffId = null,
}) {
  const warehouseList =
    warehouses && warehouses.length > 0
      ? warehouses
      : [warehouse?.warehouseName || "Main Warehouse"];

  // Top-level Navigation Tab State
  const [activeTab, setActiveTab] = useState("accounts"); // 'accounts' | 'shifts' | 'roles'
  const [tabPill, setTabPill] = useState({ left: 0, width: 0, ready: false });
  const tabRefs = useRef({});

  useEffect(() => {
    const updatePill = () => {
      const el = tabRefs.current[activeTab];
      if (el) {
        setTabPill({
          left: el.offsetLeft,
          width: el.offsetWidth,
          ready: true,
        });
      }
    };
    updatePill();
    const timer = setTimeout(updatePill, 60);
    window.addEventListener("resize", updatePill);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", updatePill);
    };
  }, [activeTab]);

  // Accounts Tab State
  const [view, setView] = useState(initialStaffId ? "detail" : "list");
  const [selected, setSelected] = useState(initialStaffId);
  const [query, setQuery] = useState("");
  const [role, setRole] = useState("All Roles");
  const [status, setStatus] = useState("All Status");
  const [page, setPage] = useState(1);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [modal, setModal] = useState(null);
  const [secret, setSecret] = useState(null);
  const [edit, setEdit] = useState({ role: "Staf", warehouse: "" });
  const [notice, setNotice] = useState("");
  const lock = useRef(false);

  // Roles Tab State (Semua role bisa dihapus, tanpa pembeda sistem/kustom)
  const [rolesList, setRolesList] = useState(() => {
    try {
      const saved = localStorage.getItem("susuno_staff_roles_v2");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [roleModal, setRoleModal] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [roleToDelete, setRoleToDelete] = useState(null);
  const [roleForm, setRoleForm] = useState({
    name: "",
    description: "",
    modules: ["Inventory Management", "Stock Alerts"],
  });
  const [roleErrors, setRoleErrors] = useState({});

  // Master Shift Packages State (Maksimal 10 Paket, Bisa Pilih Warna Sendiri, Bisa Dihapus)
  const [shiftPackages, setShiftPackages] = useState(() => {
    try {
      const saved = localStorage.getItem("susuno_shift_packages_v2");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.map((pkg, idx) => ({
            ...pkg,
            icon: /^\d+$/.test(String(pkg.icon)) ? String(pkg.icon) : String(idx + 1),
          }));
        }
      }
      return [];
    } catch {
      return [];
    }
  });
  const [packageModal, setPackageModal] = useState(null); // 'create' | 'edit' | 'delete'
  const [packageToDelete, setPackageToDelete] = useState(null);
  const [packageForm, setPackageForm] = useState({
    id: "",
    name: "",
    shortName: "",
    icon: "1",
    startTime: "07:00",
    endTime: "15:00",
    color: "#5c732b",
    description: "",
  });
  const [packageErrors, setPackageErrors] = useState({});

  // Shifts Tab State
  const [shifts, setShifts] = useState([]);
  const [shiftsLoading, setShiftsLoading] = useState(false);
  const [shiftView, setShiftView] = useState("calendar"); // 'calendar' | 'table' | 'attendance'
  const [calDate, setCalDate] = useState(() => new Date());
  const [shiftFilterDate, setShiftFilterDate] = useState("");
  const [shiftFilterStaff, setShiftFilterStaff] = useState("all");
  const [shiftModal, setShiftModal] = useState(null); // 'create' | 'edit' | 'delete'
  const [shiftTarget, setShiftTarget] = useState(null);

  // Attendances Tab State (Riwayat Shift)
  const [attendances, setAttendances] = useState([]);
  const [attendancesLoading, setAttendancesLoading] = useState(false);
  const [attendanceQuery, setAttendanceQuery] = useState("");
  const [attendanceFilterStaff, setAttendanceFilterStaff] = useState("all");
  const [attendanceFilterDate, setAttendanceFilterDate] = useState(() => {
    try {
      return new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Jakarta",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date());
    } catch {
      return new Date().toISOString().slice(0, 10);
    }
  });
  const [expandedShifts, setExpandedShifts] = useState({ 0: true, 1: true, 2: true });
  const [shiftForm, setShiftForm] = useState({
    id: null,
    userId: "",
    userIds: [],
    selectMode: "name", // 'name' | 'role'
    packageId: "pkg-morning",
    shiftDate: new Date().toISOString().split("T")[0],
    startTime: "07:00",
    endTime: "15:00",
  });
  const [shiftErrors, setShiftErrors] = useState({});

  // Available roles for dropdowns (dinamis mengikuti rolesList, selalu sertakan "Staf")
  const availableRoles = useMemo(() => {
    const list = ["Staf", ...rolesList.map((r) => r.name)];
    return Array.from(new Set(list));
  }, [rolesList]);

  // Notifikasi staf yang sudah terjadwal di hari yang sama
  const conflictingStaffNames = useMemo(() => {
    if (!shiftForm.shiftDate) return [];
    if (shiftModal === "edit") {
      if (!shiftForm.userId) return [];
      const conflict = shifts.some((s) => {
        if (s.id === shiftForm.id) return false;
        const sDate = s.shift_date ? String(s.shift_date).slice(0, 10) : "";
        return Number(s.user_id) === Number(shiftForm.userId) && sDate === shiftForm.shiftDate;
      });
      if (!conflict) return [];
      const st = staff.find((x) => Number(x.id) === Number(shiftForm.userId));
      return [st?.fullName || `Staf ID ${shiftForm.userId}`];
    }

    if (!shiftForm.userIds || shiftForm.userIds.length === 0) return [];
    return shiftForm.userIds
      .filter((uid) =>
        shifts.some((s) => {
          const sDate = s.shift_date ? String(s.shift_date).slice(0, 10) : "";
          return Number(s.user_id) === Number(uid) && sDate === shiftForm.shiftDate;
        })
      )
      .map((uid) => {
        const st = staff.find((x) => Number(x.id) === Number(uid));
        return st?.fullName || `Staf ID ${uid}`;
      });
  }, [shiftForm.shiftDate, shiftForm.userId, shiftForm.userIds, shifts, staff, shiftModal, shiftForm.id]);

  // Load shifts from live backend database (No dummy data!)
  const loadShifts = useCallback(async () => {
    setShiftsLoading(true);
    try {
      localStorage.removeItem("susuno_shifts_cache");
      const data = await shiftsApi.getAll();
      if (Array.isArray(data)) {
        setShifts(data);
      } else {
        setShifts([]);
      }
    } catch (err) {
      console.error("[Susuno Shifts] Failed to load shifts:", err);
      setShifts([]);
    } finally {
      setShiftsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadShifts();
  }, [loadShifts]);

  // Load attendances from live backend MySQL database
  const loadAttendances = useCallback(async () => {
    setAttendancesLoading(true);
    try {
      const data = await attendanceApi.getAll();
      if (Array.isArray(data)) {
        setAttendances(data);
      } else {
        setAttendances([]);
      }
    } catch (err) {
      console.error("[Susuno Attendances] Failed to load attendances:", err);
      setAttendances([]);
    } finally {
      setAttendancesLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAttendances();
  }, [loadAttendances]);

  const formatClockTime = (dateInput) => {
    if (!dateInput) return "--:--";
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return "--:--";
    return (
      d
        .toLocaleTimeString("id-ID", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
          timeZone: "Asia/Jakarta",
        })
        .replace(".", ":") + " WIB"
    );
  };

  const formatSessionDuration = (startIso, endIso) => {
    if (!startIso) return "-";
    const s = new Date(startIso).getTime();
    const e = endIso ? new Date(endIso).getTime() : Date.now();
    if (isNaN(s) || isNaN(e) || e < s) return "-";
    const totalMinutes = Math.floor((e - s) / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours === 0) return `${minutes} mnt`;
    return `${hours} jam ${minutes} mnt`;
  };

  const sessionDate = (dateInput) => {
    if (!dateInput) return "-";
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return "-";
    return new Intl.DateTimeFormat("id-ID", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "Asia/Jakarta",
    }).format(d);
  };

  // Group and pair raw attendance logs (check_in & check_out) per staff member
  const pairedSessions = useMemo(() => {
    if (!Array.isArray(attendances) || attendances.length === 0) return [];

    const byUser = {};
    for (const log of attendances) {
      const uid = String(log.user_id);
      if (!byUser[uid]) byUser[uid] = [];
      byUser[uid].push(log);
    }

    const sessions = [];
    const now = Date.now();

    for (const uid in byUser) {
      const userLogs = byUser[uid].slice().sort((a, b) => new Date(a.scan_time) - new Date(b.scan_time));
      let openSession = null;

      for (const log of userLogs) {
        if (log.type === "check_in") {
          if (openSession) {
            sessions.push(openSession);
          }
          openSession = {
            id: `sess-${log.id}`,
            userId: log.user_id,
            userName: log.user_name || "",
            userEmail: log.user_email || "",
            userRole: log.user_role_title || log.user_role || "Staf Gudang",
            checkIn: log,
            checkOut: null,
          };
        } else if (log.type === "check_out") {
          if (openSession) {
            openSession.checkOut = log;
            sessions.push(openSession);
            openSession = null;
          } else {
            sessions.push({
              id: `sess-out-${log.id}`,
              userId: log.user_id,
              userName: log.user_name || "",
              userEmail: log.user_email || "",
              userRole: log.user_role_title || log.user_role || "Staf Gudang",
              checkIn: null,
              checkOut: log,
            });
          }
        }
      }

      if (openSession) {
        sessions.push(openSession);
      }
    }

    return sessions
      .map((sess) => {
        const stf = staff.find((s) => String(s.id) === String(sess.userId));
        const sName = sess.userName || stf?.fullName || `Staf #${sess.userId}`;
        const sEmail = sess.userEmail || stf?.contact || "";
        const sRole = stf?.role || sess.userRole || "Staf Gudang";

        let statusLabel = "Selesai Shift";
        let statusCls = "ss-shift-status past";
        let isWorkingNow = false;

        if (sess.checkIn && sess.checkOut) {
          statusLabel = "Selesai Shift";
          statusCls = "ss-shift-status past";
        } else if (sess.checkIn && !sess.checkOut) {
          const checkInTime = new Date(sess.checkIn.scan_time).getTime();
          const diffHours = (now - checkInTime) / (1000 * 60 * 60);
          if (diffHours <= 18) {
            statusLabel = "Sedang Bekerja";
            statusCls = "ss-shift-status current";
            isWorkingNow = true;
          } else {
            statusLabel = "Belum Check-Out";
            statusCls = "ss-shift-status upcoming";
          }
        } else if (!sess.checkIn && sess.checkOut) {
          statusLabel = "Check-Out Saja";
          statusCls = "ss-shift-status upcoming";
        }

        return {
          ...sess,
          userName: sName,
          userEmail: sEmail,
          userRole: sRole,
          statusLabel,
          statusCls,
          isWorkingNow,
          dateSort: new Date(sess.checkIn?.scan_time || sess.checkOut?.scan_time || 0).getTime(),
        };
      })
      .sort((a, b) => b.dateSort - a.dateSort);
  }, [attendances, staff]);

  // Filtered attendance sessions for tab view
  const filteredSessions = useMemo(() => {
    return pairedSessions.filter((sess) => {
      if (attendanceFilterStaff !== "all" && String(sess.userId) !== String(attendanceFilterStaff)) {
        return false;
      }
      if (attendanceFilterDate) {
        const sDate = new Date(sess.dateSort).toISOString().slice(0, 10);
        if (sDate !== attendanceFilterDate) return false;
      }
      if (attendanceQuery.trim()) {
        const q = attendanceQuery.trim().toLowerCase();
        const matchName = sess.userName.toLowerCase().includes(q);
        const matchEmail = sess.userEmail.toLowerCase().includes(q);
        const matchRole = sess.userRole.toLowerCase().includes(q);
        if (!matchName && !matchEmail && !matchRole) return false;
      }
      return true;
    });
  }, [pairedSessions, attendanceFilterStaff, attendanceFilterDate, attendanceQuery]);

  const shiftIsoDate = (dateStr, days) => {
    const base = dateStr || new Date().toISOString().slice(0, 10);
    const parts = String(base).split("-").map(Number);
    if (parts.length !== 3 || parts.some(isNaN)) {
      return new Date().toISOString().slice(0, 10);
    }
    const [y, m, d] = parts;
    const utcDate = new Date(Date.UTC(y, m - 1, d));
    utcDate.setUTCDate(utcDate.getUTCDate() + days);
    return utcDate.toISOString().slice(0, 10);
  };

  const handlePrevDate = () => {
    const base = attendanceFilterDate || new Date().toISOString().slice(0, 10);
    const d = new Date(base + "T00:00:00");
    d.setDate(d.getDate() - 1);
    setAttendanceFilterDate(d.toISOString().slice(0, 10));
    setAttendanceFilterDate((cur) => shiftIsoDate(cur, -1));
  };

  const handleNextDate = () => {
    const base = attendanceFilterDate || new Date().toISOString().slice(0, 10);
    const d = new Date(base + "T00:00:00");
    d.setDate(d.getDate() + 1);
    setAttendanceFilterDate(d.toISOString().slice(0, 10));
    setAttendanceFilterDate((cur) => shiftIsoDate(cur, 1));
  };

  const handleTodayDate = () => {
    try {
      setAttendanceFilterDate(
        new Intl.DateTimeFormat("en-CA", {
          timeZone: "Asia/Jakarta",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(new Date())
      );
    } catch {
      setAttendanceFilterDate(new Date().toISOString().slice(0, 10));
    }
  };

  const formatHeaderDate = (dateStr) => {
    if (!dateStr) return "";
    try {
      const d = new Date(dateStr + "T00:00:00");
      return new Intl.DateTimeFormat("id-ID", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(d);
      const parts = String(dateStr).split("-").map(Number);
      if (parts.length === 3 && !parts.some(isNaN)) {
        const [y, m, d] = parts;
        const utcDate = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
        return new Intl.DateTimeFormat("id-ID", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
          timeZone: "UTC",
        }).format(utcDate);
      }
      return dateStr;
    } catch {
      return dateStr;
    }
  };

  const toggleShiftAccordion = (idx) => {
    setExpandedShifts((prev) => ({
      ...prev,
      [idx]: !prev[idx],
    }));
  };

  const toggleAllShiftAccordions = (expand) => {
    setExpandedShifts({ 0: expand, 1: expand, 2: expand });
  };

  // Grouping 3 baris shift kerja dengan siapa saja yang masuk, jam check-in, check-out, & total jam kerja
  const threeShiftGroups = useMemo(() => {
    const todayDefault = (() => {
      try {
        return new Intl.DateTimeFormat("en-CA", {
          timeZone: "Asia/Jakarta",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(new Date());
      } catch {
        return new Date().toISOString().slice(0, 10);
      }
    })();
    const targetDate = attendanceFilterDate || todayDefault;

    // 3 Macam Shift Operasional Gudang
    const shiftDefs = [
      {
        id: "shift-1",
        name: "Shift 1 (Pagi)",
        shortName: "Pagi",
        icon: "1",
        startTime: "07:00",
        endTime: "15:00",
        color: "#5c732b",
      },
      {
        id: "shift-2",
        name: "Shift 2 (Siang)",
        shortName: "Siang",
        icon: "2",
        startTime: "15:00",
        endTime: "23:00",
        color: "#0891b2",
      },
      {
        id: "shift-3",
        name: "Shift 3 (Malam)",
        shortName: "Malam",
        icon: "3",
        startTime: "23:00",
        endTime: "07:00",
        color: "#d97706",
      },
    ];

    if (Array.isArray(shiftPackages) && shiftPackages.length >= 3) {
      [0, 1, 2].forEach((idx) => {
        const p = shiftPackages[idx];
        if (p) {
          shiftDefs[idx].name = p.name || shiftDefs[idx].name;
          shiftDefs[idx].shortName = p.shortName || shiftDefs[idx].shortName;
          shiftDefs[idx].icon = p.icon || String(idx + 1);
          shiftDefs[idx].startTime = p.startTime || shiftDefs[idx].startTime;
          shiftDefs[idx].endTime = p.endTime || shiftDefs[idx].endTime;
          shiftDefs[idx].color = p.color || shiftDefs[idx].color;
        }
      });
    }

    // Filter sesi kehadiran pada tanggal yang dipilih
    const dateSessions = pairedSessions.filter((sess) => {
      const rawTime = sess.checkIn?.scan_time || sess.checkOut?.scan_time;
      if (!rawTime) return false;
      try {
        const d = new Date(rawTime);
        const sDate = new Intl.DateTimeFormat("en-CA", {
          timeZone: "Asia/Jakarta",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(d);
        return sDate === targetDate;
      } catch {
        return String(rawTime).slice(0, 10) === targetDate;
      }
    });

    // Jadwal shift resmi yang terdaftar pada tanggal yang dipilih
    const targetShifts = shifts.filter((sh) => {
      const sDate = sh.shift_date ? String(sh.shift_date).slice(0, 10) : "";
      return sDate === targetDate;
    });

    return shiftDefs.map((def, idx) => {
      // 1. Staf yang hadir / check-in pada shift ini
      const attendedStaff = dateSessions.filter((sess) => {
        const assigned = targetShifts.find(
          (sh) => String(sh.user_id) === String(sess.userId)
        );
        if (assigned) {
          const sStart = assigned.start_time ? String(assigned.start_time).slice(0, 5) : "";
          if (assigned.package_id === def.id || sStart === def.startTime) {
            return true;
          }
        }

        const rawTime = sess.checkIn?.scan_time || sess.checkOut?.scan_time;
        if (rawTime) {
          const d = new Date(rawTime);
          const hourStr = new Intl.DateTimeFormat("en-GB", {
            hour: "2-digit",
            hour12: false,
            timeZone: "Asia/Jakarta",
          }).format(d);
          const hour = parseInt(hourStr, 10);
          if (idx === 0) return hour >= 5 && hour < 13;
          if (idx === 1) return hour >= 13 && hour < 21;
          if (idx === 2) return hour >= 21 || hour < 5;
        }
        return idx === 0;
      });

      // 2. Staf yang terjadwal namun belum check-in
      const attendedUserIds = new Set(attendedStaff.map((s) => String(s.userId)));
      const notCheckedInScheduled = targetShifts
        .filter((sh) => {
          const sStart = sh.start_time ? String(sh.start_time).slice(0, 5) : "";
          const isThisShift = sh.package_id === def.id || sStart === def.startTime;
          return isThisShift && !attendedUserIds.has(String(sh.user_id));
        })
        .map((sh) => {
          const stf = staff.find((s) => String(s.id) === String(sh.user_id));
          return {
            id: `sched-${sh.id}`,
            userId: sh.user_id,
            userName: sh.user_name || stf?.fullName || `Staf #${sh.user_id}`,
            userEmail: stf?.contact || "",
            userRole: stf?.role || sh.user_system_role || "Staf Gudang",
            checkIn: null,
            checkOut: null,
            isScheduledOnly: true,
            statusLabel: "Belum Check-In",
            statusCls: "ss-shift-status upcoming",
          };
        });

      return {
        ...def,
        attendedCount: attendedStaff.length,
        workingNowCount: attendedStaff.filter((s) => s.isWorkingNow).length,
        finishedCount: attendedStaff.filter((s) => s.checkOut).length,
        staffList: [...attendedStaff, ...notCheckedInScheduled],
      };
    });
  }, [pairedSessions, shifts, staff, shiftPackages, attendanceFilterDate]);

  // Sync selected staffId with browser URL query params
  useEffect(() => {
    if (typeof window !== "undefined") {
      const currentUrl = new URL(window.location.href);
      if (selected && activeTab === "accounts") {
        currentUrl.searchParams.set("staffId", selected);
      } else {
        currentUrl.searchParams.delete("staffId");
      }
      if (currentUrl.pathname === "/staff-management") {
        window.history.replaceState(null, "", currentUrl.pathname + currentUrl.search);
      }
    }
  }, [selected, activeTab]);

  useEffect(() => setPage(1), [query, role, status]);

  // Filtered accounts
  const person = staff.find((row) => row.id === selected);
  const filteredStaff = staff.filter(
    (row) =>
      `${row.fullName} ${row.contact} ${row.username} ${row.role}`
        .toLowerCase()
        .includes(query.toLowerCase()) &&
      (role === "All Roles" || row.role === role) &&
      (status === "All Status" || staffStatus(row) === status)
  );
  const pages = Math.max(1, Math.ceil(filteredStaff.length / 4));
  const active = Math.min(page, pages);
  const visibleStaff = filteredStaff.slice((active - 1) * 4, active * 4);

  // Today string YYYY-MM-DD
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  // Filtered shifts for table view
  const filteredShifts = shifts.filter((s) => {
    const sDate = s.shift_date ? String(s.shift_date).slice(0, 10) : "";
    const matchesDate = !shiftFilterDate || sDate === shiftFilterDate;
    const matchesStaff =
      shiftFilterStaff === "all" ||
      String(s.user_id) === String(shiftFilterStaff);
    return matchesDate && matchesStaff;
  });

  const shiftsTodayCount = shifts.filter(
    (s) => s.shift_date && String(s.shift_date).slice(0, 10) === todayStr
  ).length;

  const assignedStaffIds = new Set(shifts.map((s) => s.user_id));

  // Live real-time clock state (Berdetak setiap detik)
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const nowTimeFormatted = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")} WIB`;

  // Helper mengecek apakah shift sedang aktif / bekerja saat ini
  const isShiftActiveNow = useCallback((startTime, endTime) => {
    if (!startTime || !endTime) return false;
    const [sh, sm] = String(startTime).split(":").map(Number);
    const [eh, em] = String(endTime).split(":").map(Number);
    if (isNaN(sh) || isNaN(sm) || isNaN(eh) || isNaN(em)) return false;
    const curH = now.getHours();
    const curM = now.getMinutes();
    const curTotal = curH * 60 + curM;
    const startTotal = sh * 60 + sm;
    let endTotal = eh * 60 + em;
    if (endTotal < startTotal) {
      // Shift malam melewati tengah malam (misal 23:00 - 07:00)
      return curTotal >= startTotal || curTotal < endTotal;
    }
    return curTotal >= startTotal && curTotal < endTotal;
  }, [now]);

  // Paket shift yang sedang aktif saat ini
  const activeNowPackage = useMemo(() => {
    return shiftPackages.find((pkg) => isShiftActiveNow(pkg.startTime, pkg.endTime));
  }, [shiftPackages, isShiftActiveNow]);

  // Staf yang sedang aktif bekerja di lapangan saat ini
  const staffWorkingNow = useMemo(() => {
    return shifts.filter((s) => {
      const sDate = s.shift_date ? String(s.shift_date).slice(0, 10) : "";
      if (sDate !== todayStr) return false;
      const sStart = s.start_time ? String(s.start_time).slice(0, 5) : "";
      const sEnd = s.end_time ? String(s.end_time).slice(0, 5) : "";
      return isShiftActiveNow(sStart, sEnd);
    });
  }, [shifts, todayStr, isShiftActiveNow]);

  const [showPackages, setShowPackages] = useState(true);

  // Calendar calculations (Month Matrix)
  const calYear = calDate.getFullYear();
  const calMonth = calDate.getMonth();

  const calMonthTitle = new Intl.DateTimeFormat("id-ID", {
    month: "long",
    year: "numeric",
  }).format(calDate);

  const calendarDays = useMemo(() => {
    const firstDayOfMonth = new Date(calYear, calMonth, 1);
    const daysInCurrentMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(calYear, calMonth, 0).getDate();
    const startDayOffset = (firstDayOfMonth.getDay() + 6) % 7;
    const days = [];

    // Prev month padding
    for (let i = startDayOffset - 1; i >= 0; i--) {
      const dayNum = daysInPrevMonth - i;
      const prevDate = new Date(calYear, calMonth - 1, dayNum);
      const dateStr = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
      days.push({
        dayNum,
        dateStr,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
      });
    }

    // Current month days
    for (let dayNum = 1; dayNum <= daysInCurrentMonth; dayNum++) {
      const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
      days.push({
        dayNum,
        dateStr,
        isCurrentMonth: true,
        isToday: dateStr === todayStr,
      });
    }

    // Next month padding
    const remaining = (7 - (days.length % 7)) % 7;
    for (let dayNum = 1; dayNum <= remaining; dayNum++) {
      const nextDate = new Date(calYear, calMonth + 1, dayNum);
      const dateStr = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
      days.push({
        dayNum,
        dateStr,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
      });
    }

    return days;
  }, [calYear, calMonth, todayStr]);

  // Calendar navigation
  function calPrevMonth() {
    setCalDate((cur) => new Date(cur.getFullYear(), cur.getMonth() - 1, 1));
  }
  function calNextMonth() {
    setCalDate((cur) => new Date(cur.getFullYear(), cur.getMonth() + 1, 1));
  }
  function calGoToToday() {
    setCalDate(new Date());
  }

  // Handlers for Accounts
  function field(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: void 0 }));
  }

  function back() {
    setView("list");
    setSelected(null);
    setForm(emptyForm());
    setErrors({});
    setNotice("");
  }

  function close() {
    setModal(null);
    setSecret(null);
    setNotice("");
  }

  function add() {
    setForm(emptyForm());
    setErrors({});
    setView("add");
    setNotice("");
  }

  async function create(e) {
    e.preventDefault();
    const roleFinal = form.role && form.role.trim() !== "" ? form.role.trim() : "Staf";
    const payload = { ...form, role: roleFinal };
    const next = validateStaff(payload, staff, warehouses);
    setErrors(next);
    if (Object.keys(next).length || lock.current) return;
    lock.current = true;
    const result = await onCreate(payload);
    lock.current = false;
    if (result.error) {
      setErrors({ submit: result.error });
      return;
    }
    setSelected(result.staff.id);
    setSecret({
      fullName: result.staff.fullName,
      role: result.staff.role,
      username: result.staff.username,
      password: form.password,
    });
    setForm((current) => ({ ...current, password: "" }));
    setModal("ready");
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(`SUSUNO Staff Account
Nama: ${secret.fullName}
Role: ${secret.role}
Email / Username: ${secret.username}
Password Sementara: ${secret.password}
Akun terhubung ke database SUSUNO.`);
      setNotice("Credentials copied.");
    } catch {
      setNotice("Copy is unavailable. Select the username and password shown above manually.");
    }
  }

  function action(kind) {
    setNotice("");
    setModal(kind);
    if (kind === "edit") {
      setEdit({ role: person.role || "Staf", warehouse: person.warehouse });
    }
  }

  async function saveEdit(e) {
    e.preventDefault();
    const roleFinal = edit.role && edit.role.trim() !== "" ? edit.role.trim() : "Staf";
    const result = await onEdit(person.id, { ...edit, role: roleFinal });
    if (result.error) {
      setNotice(result.error);
      return;
    }
    setModal(null);
    setNotice(result.unchanged ? "No account details changed." : "Staff assignment updated.");
  }

  async function reset() {
    const password = generateTemporaryPassword();
    const result = await onReset(person.id, password);
    if (result.error) {
      setNotice(result.error);
      return;
    }
    setSecret({
      fullName: person.fullName,
      role: person.role,
      username: person.username,
      password,
    });
    setModal("ready");
  }

  async function suspend() {
    const result = await onSuspend(person.id, !person.suspended);
    if (result.error) {
      setNotice(result.error);
      return;
    }
    setModal(null);
    setNotice(
      person.suspended
        ? "Akses mobile staf diaktifkan kembali."
        : "Akses mobile staf dinonaktifkan."
    );
  }

  // Handlers for Master Shift Packages (Row Macam-Macam Shift)
  function openCreatePackage() {
    if (shiftPackages.length >= MAX_SHIFT_PACKAGES) {
      setNotice(`Batas maksimal ${MAX_SHIFT_PACKAGES} macam paket shift telah tercapai.`);
      return;
    }
    setPackageForm({
      id: `pkg-${Date.now()}`,
      name: "",
      shortName: "",
      icon: String(shiftPackages.length + 1),
      startTime: "08:00",
      endTime: "16:00",
      color: "#5c732b",
      description: "",
    });
    setPackageErrors({});
    setPackageModal("create");
  }

  function openEditPackage(pkg) {
    setPackageForm({ ...pkg, icon: String(pkg.icon || "1") });
    setPackageErrors({});
    setPackageModal("edit");
  }

  function savePackage(e) {
    e.preventDefault();
    const errs = {};
    const trimmedName = packageForm.name.trim();
    const trimmedShort = packageForm.shortName.trim();

    if (!trimmedName) {
      errs.name = "Nama paket shift wajib diisi.";
    } else if (trimmedName.length > MAX_PACKAGE_NAME_LEN) {
      errs.name = `Nama paket terlalu panjang (maksimal ${MAX_PACKAGE_NAME_LEN} karakter).`;
    }

    if (trimmedShort.length > MAX_SHORT_NAME_LEN) {
      errs.shortName = `Label singkat terlalu panjang (maksimal ${MAX_SHORT_NAME_LEN} karakter).`;
    }

    if (!packageForm.startTime) errs.startTime = "Tentukan jam mulai.";
    if (!packageForm.endTime) errs.endTime = "Tentukan jam selesai.";

    if (Object.keys(errs).length) {
      setPackageErrors(errs);
      return;
    }

    const shortNameFinal =
      trimmedShort ||
      trimmedName.slice(0, MAX_SHORT_NAME_LEN) ||
      "Shift";

    let updatedPackages;
    if (packageModal === "edit") {
      updatedPackages = shiftPackages.map((p) =>
        p.id === packageForm.id
          ? {
              ...p,
              ...packageForm,
              name: trimmedName,
              shortName: shortNameFinal,
            }
          : p
      );
      setNotice(`Paket shift "${trimmedName}" berhasil diperbarui.`);
    } else {
      const newPkg = {
        ...packageForm,
        name: trimmedName,
        shortName: shortNameFinal,
      };
      updatedPackages = [...shiftPackages, newPkg];
      setNotice(`Paket shift baru "${newPkg.name}" berhasil ditambahkan.`);
    }

    setShiftPackages(updatedPackages);
    try {
      localStorage.setItem("susuno_shift_packages_v2", JSON.stringify(updatedPackages));
    } catch {
      // ignore
    }
    setPackageModal(null);
  }

  function openDeletePackageConfirm(pkg) {
    setPackageToDelete(pkg);
    setPackageModal("delete");
  }

  function confirmDeletePackage() {
    if (!packageToDelete) return;
    const updated = shiftPackages.filter((p) => p.id !== packageToDelete.id);
    setShiftPackages(updated);
    try {
      localStorage.setItem("susuno_shift_packages_v2", JSON.stringify(updated));
    } catch {
      // ignore
    }
    setNotice(`Paket shift "${packageToDelete.name}" telah dihapus.`);
    setPackageToDelete(null);
    setPackageModal(null);
  }

  // Handlers for Shifts (Granular Time & Date Control)
  function openCreateShift(prefilledDate = null, prefilledUserId = null, prefilledPackageId = null) {
    const chosenUser = prefilledUserId || (staff.length > 0 ? staff[0].id : "");
    const chosenDate = prefilledDate || todayStr;
    const defaultPkg =
      (prefilledPackageId && shiftPackages.find((p) => p.id === prefilledPackageId)) ||
      (shiftPackages.length > 0 ? shiftPackages[0] : null);

    setShiftForm({
      id: null,
      userId: prefilledUserId || chosenUser || "",
      userIds: prefilledUserId ? [prefilledUserId] : [],
      selectMode: "name", // 'name' | 'role'
      packageId: defaultPkg?.id || (shiftPackages[0]?.id || ""),
      shiftDate: chosenDate,
      startTime: defaultPkg?.startTime || "07:00",
      endTime: defaultPkg?.endTime || "15:00",
    });
    setShiftErrors({});
    setShiftModal("create");
  }

  function openEditShift(sh, e) {
    if (e) e.stopPropagation();
    setShiftTarget(sh);
    const startTimeFormatted = sh.start_time ? String(sh.start_time).slice(0, 5) : "07:00";
    const endTimeFormatted = sh.end_time ? String(sh.end_time).slice(0, 5) : "15:00";
    const sDate = sh.shift_date ? String(sh.shift_date).slice(0, 10) : todayStr;
    const matchingPkg = findMatchingPackage(sh, shiftPackages);

    setShiftForm({
      id: sh.id,
      userId: sh.user_id,
      userIds: [sh.user_id],
      selectMode: "name",
      packageId: matchingPkg?.id || (shiftPackages[0]?.id || ""),
      shiftDate: sDate,
      startTime: matchingPkg?.startTime || startTimeFormatted,
      endTime: matchingPkg?.endTime || endTimeFormatted,
    });
    setShiftErrors({});
    setShiftModal("edit");
  }

  function selectShiftPackageInForm(pkg) {
    setShiftForm((cur) => ({
      ...cur,
      packageId: pkg.id,
      startTime: pkg.startTime,
      endTime: pkg.endTime,
    }));
    setShiftErrors((cur) => ({ ...cur, package: undefined }));
  }

  function toggleStaffSelection(userId) {
    setShiftForm((cur) => {
      const exists = cur.userIds.some((id) => Number(id) === Number(userId));
      const nextUserIds = exists
        ? cur.userIds.filter((id) => Number(id) !== Number(userId))
        : [...cur.userIds, userId];
      return { ...cur, userIds: nextUserIds };
    });
    setShiftErrors((cur) => ({ ...cur, userId: undefined, submit: undefined }));
  }

  function selectAllStaff() {
    setShiftForm((cur) => ({
      ...cur,
      userIds: staff.map((s) => s.id),
    }));
    setShiftErrors((cur) => ({ ...cur, userId: undefined, submit: undefined }));
  }

  function clearStaffSelection() {
    setShiftForm((cur) => ({
      ...cur,
      userIds: [],
    }));
    setShiftErrors((cur) => ({ ...cur, userId: undefined, submit: undefined }));
  }

  function toggleRoleSelection(roleName) {
    const staffWithRole = staff.filter((s) => (s.role || "Staf").toLowerCase() === roleName.toLowerCase());
    const idsWithRole = staffWithRole.map((s) => s.id);
    setShiftForm((cur) => {
      const allSelected = idsWithRole.length > 0 && idsWithRole.every((id) => cur.userIds.some((uId) => Number(uId) === Number(id)));
      let nextUserIds;
      if (allSelected) {
        nextUserIds = cur.userIds.filter((id) => !idsWithRole.some((rId) => Number(rId) === Number(id)));
      } else {
        const set = new Set([...cur.userIds.map(Number), ...idsWithRole.map(Number)]);
        nextUserIds = Array.from(set);
      }
      return { ...cur, userIds: nextUserIds };
    });
    setShiftErrors((cur) => ({ ...cur, userId: undefined, submit: undefined }));
  }

  function isRoleFullySelected(roleName) {
    const staffWithRole = staff.filter((s) => (s.role || "Staf").toLowerCase() === roleName.toLowerCase());
    if (staffWithRole.length === 0) return false;
    return staffWithRole.every((s) => shiftForm.userIds.some((uId) => Number(uId) === Number(s.id)));
  }

  async function saveShift(e) {
    e.preventDefault();
    const errs = {};
    if (!shiftForm.shiftDate) errs.shiftDate = "Tentukan tanggal shift.";

    const selectedPkg = shiftPackages.find((p) => p.id === shiftForm.packageId) || shiftPackages[0];
    if (!selectedPkg) errs.package = "Pilih salah satu paket shift.";

    const sStart = selectedPkg ? selectedPkg.startTime : shiftForm.startTime;
    const sEnd = selectedPkg ? selectedPkg.endTime : shiftForm.endTime;
    const startTimeSec = sStart.length === 5 ? `${sStart}:00` : sStart;
    const endTimeSec = sEnd.length === 5 ? `${sEnd}:00` : sEnd;

    if (shiftModal === "edit" && shiftForm.id) {
      if (!shiftForm.userId) errs.userId = "Pilih akun staf yang bertugas.";
      if (Object.keys(errs).length) {
        setShiftErrors(errs);
        return;
      }

      // Check conflict on the same date for notification
      const conflict = shifts.find((s) => {
        if (s.id === shiftForm.id) return false;
        const sDate = s.shift_date ? String(s.shift_date).slice(0, 10) : "";
        return Number(s.user_id) === Number(shiftForm.userId) && sDate === shiftForm.shiftDate;
      });

      const assignedStaff = staff.find((s) => Number(s.id) === Number(shiftForm.userId));
      try {
        const res = await shiftsApi.update(shiftForm.id, {
          user_id: Number(shiftForm.userId),
          shift_date: shiftForm.shiftDate,
          start_time: startTimeSec,
          end_time: endTimeSec,
        });

        if (!res.success && res.status >= 400) {
          throw new Error(res.message || res.data?.message || "Gagal memperbarui shift di server");
        }

        setShifts((cur) =>
          cur.map((s) =>
            s.id === shiftForm.id
              ? {
                  ...s,
                  user_id: Number(shiftForm.userId),
                  package_id: selectedPkg?.id || s.package_id,
                  user_name: assignedStaff?.fullName || s.user_name,
                  user_email: assignedStaff?.contact || s.user_email,
                  user_system_role: assignedStaff?.role || s.user_system_role,
                  shift_date: shiftForm.shiftDate,
                  start_time: startTimeSec,
                  end_time: endTimeSec,
                }
              : s
          )
        );
        setShiftModal(null);
        const conflictNotice = conflict ? ` (Peringatan: ${assignedStaff?.fullName || "staf"} memiliki jadwal shift lain di hari yang sama)` : "";
        setNotice(`Shift untuk ${assignedStaff?.fullName || "staf"} berhasil diperbarui.${conflictNotice}`);
      } catch (err) {
        setShiftErrors({ submit: "Gagal memperbarui shift di server: " + err.message });
      }
    } else {
      // CREATE MODE: Multi-staff support
      const targetUserIds = shiftForm.userIds;
      if (!targetUserIds || targetUserIds.length === 0) {
        errs.userId = "Pilih minimal satu staf yang bertugas.";
      }
      if (Object.keys(errs).length) {
        setShiftErrors(errs);
        return;
      }

      // Check duplicate / conflict for all chosen staff on the same date
      const conflicts = [];
      for (const uid of targetUserIds) {
        const conflict = shifts.find((s) => {
          const sDate = s.shift_date ? String(s.shift_date).slice(0, 10) : "";
          return Number(s.user_id) === Number(uid) && sDate === shiftForm.shiftDate;
        });
        if (conflict) {
          const st = staff.find((x) => Number(x.id) === Number(uid));
          conflicts.push(`${st?.fullName || `ID ${uid}`}`);
        }
      }

      try {
        const newItems = [];
        for (const uid of targetUserIds) {
          const assignedStaff = staff.find((s) => Number(s.id) === Number(uid));
          const res = await shiftsApi.create({
            user_id: Number(uid),
            shift_date: shiftForm.shiftDate,
            start_time: startTimeSec,
            end_time: endTimeSec,
          });

          if (!res.success && res.status >= 400) {
            throw new Error(res.message || res.data?.message || "Gagal membuat jadwal di database");
          }

          const newId = res.data?.shiftId || res.shiftId || Date.now() + Math.random();
          newItems.push({
            id: newId,
            user_id: Number(uid),
            package_id: selectedPkg?.id || shiftForm.packageId,
            user_name: assignedStaff?.fullName || "Staff",
            user_email: assignedStaff?.contact || "",
            user_system_role: assignedStaff?.role || "staf",
            shift_date: shiftForm.shiftDate,
            start_time: startTimeSec,
            end_time: endTimeSec,
          });
        }

        setShifts((cur) => [...newItems, ...cur]);
        setShiftModal(null);
        const noticeSuffix = conflicts.length > 0 ? ` (Peringatan: ${conflicts.join(", ")} terjadwal ganda pada hari yang sama)` : "";
        setNotice(`Berhasil menjadwalkan ${newItems.length} staf untuk ${selectedPkg?.name || "shift"}.${noticeSuffix}`);
      } catch (err) {
        setShiftErrors({ submit: "Gagal menyimpan shift ke database: " + err.message });
      }
    }
  }

  async function confirmDeleteShift() {
    if (!shiftTarget) return;
    try {
      await shiftsApi.delete(shiftTarget.id);
    } catch (err) {
      console.warn("Delete API error, updating state locally:", err);
    }
    setShifts((cur) => cur.filter((s) => s.id !== shiftTarget.id));
    setShiftModal(null);
    setShiftTarget(null);
    setNotice("Shift kerja berhasil dihapus dari jadwal.");
  }

  // Handlers for Roles (Semua role bisa diedit dan dihapus)
  function openCreateRole() {
    setEditingRole(null);
    setRoleForm({
      name: "",
      description: "",
      modules: ["Inventory Management", "Stock Alerts"],
    });
    setRoleErrors({});
    setRoleModal(true);
  }

  function openEditRole(r) {
    setEditingRole(r);
    setRoleForm({
      name: r.name,
      description: r.description || "",
      modules: r.modules ? [...r.modules] : [],
    });
    setRoleErrors({});
    setRoleModal(true);
  }

  function toggleRoleModule(mod) {
    setRoleForm((cur) => {
      const exists = cur.modules.includes(mod);
      const nextModules = exists
        ? cur.modules.filter((m) => m !== mod)
        : [...cur.modules, mod];
      return { ...cur, modules: nextModules };
    });
    setRoleErrors((cur) => ({ ...cur, modules: void 0 }));
  }

  function saveRole(e) {
    e.preventDefault();
    const errs = {};
    const trimmedName = roleForm.name.trim();
    if (!trimmedName) errs.name = "Nama role wajib diisi.";
    else if (trimmedName.length < 3)
      errs.name = "Nama role minimal 3 karakter.";
    else if (
      rolesList.some(
        (r) =>
          r.name.toLowerCase() === trimmedName.toLowerCase() &&
          (!editingRole || r.id !== editingRole.id)
      )
    )
      errs.name = "Nama role sudah ada.";

    if (!roleForm.description.trim())
      errs.description = "Deskripsi tugas wajib diisi.";
    if (!roleForm.modules.length)
      errs.modules = "Pilih minimal 1 hak akses modul operasional.";

    if (Object.keys(errs).length) {
      setRoleErrors(errs);
      return;
    }

    if (editingRole) {
      const oldName = editingRole.name;
      const updatedRole = {
        ...editingRole,
        name: trimmedName,
        description: roleForm.description.trim(),
        modules: roleForm.modules,
      };

      const updated = rolesList.map((r) =>
        r.id === editingRole.id ? updatedRole : r
      );
      setRolesList(updated);
      try {
        localStorage.setItem("susuno_staff_roles_v2", JSON.stringify(updated));
      } catch {
        // ignore
      }

      // Jika nama role berubah, perbarui juga data staf yang memiliki role ini
      if (oldName.toLowerCase() !== trimmedName.toLowerCase()) {
        setStaff((prev) =>
          prev.map((s) =>
            s.role && s.role.toLowerCase() === oldName.toLowerCase()
              ? { ...s, role: trimmedName }
              : s
          )
        );
      }

      setRoleModal(false);
      setEditingRole(null);
      setNotice(`Role "${updatedRole.name}" berhasil diperbarui.`);
    } else {
      const newRole = {
        id: `role-${Date.now()}`,
        name: trimmedName,
        description: roleForm.description.trim(),
        modules: roleForm.modules,
      };

      const updated = [...rolesList, newRole];
      setRolesList(updated);
      try {
        localStorage.setItem("susuno_staff_roles_v2", JSON.stringify(updated));
      } catch {
        // ignore
      }

      setRoleModal(false);
      setNotice(`Role baru "${newRole.name}" berhasil dibuat dan tersedia di form staf.`);
    }
  }

  function openDeleteRoleConfirm(r) {
    setRoleToDelete(r);
  }

  function confirmDeleteRole() {
    if (!roleToDelete) return;
    const deletedName = roleToDelete.name;
    const updated = rolesList.filter((r) => r.id !== roleToDelete.id);
    setRolesList(updated);
    try {
      localStorage.setItem("susuno_staff_roles_v2", JSON.stringify(updated));
    } catch {
      // ignore
    }
    // Update any staff member with this role to "Staf"
    staff.forEach((s) => {
      if (s.role && s.role.toLowerCase() === deletedName.toLowerCase()) {
        onEdit(s.id, { role: "Staf", warehouse: s.warehouse });
      }
    });
    setNotice(`Role "${deletedName}" berhasil dihapus. Staf terkait otomatis dialihkan ke peran "Staf".`);
    setRoleToDelete(null);
  }

  // Helpers
  const statusTag = (row) => (
    <span className={"ss-status ss-" + staffStatus(row).toLowerCase()}>
      {staffStatus(row)}
    </span>
  );

  const getShiftTimingStatus = (shiftDate) => {
    const sDate = shiftDate ? String(shiftDate).slice(0, 10) : "";
    if (sDate === todayStr) return { label: "Hari Ini", cls: "ss-shift-today" };
    if (sDate > todayStr) return { label: "Mendatang", cls: "ss-shift-upcoming" };
    return { label: "Selesai", cls: "ss-shift-past" };
  };

  const formatTime = (t) => (t ? String(t).slice(0, 5) : "--:--");

  const profile = (
    <span className="ss-avatar">{initials(person?.fullName || "Staff")}</span>
  );

  const personShifts = person
    ? shifts.filter((s) => String(s.user_id) === String(person.id))
    : [];

  const personSessions = person
    ? pairedSessions.filter((sess) => String(sess.userId) === String(person.id))
    : [];

  return (
    <ManagementShell
      page="Staff Management"
      title={
        activeTab === "shifts"
          ? "Shift Management"
          : activeTab === "roles"
          ? "Role Management"
          : view === "add"
          ? "Add Staff Account"
          : view === "detail"
          ? "Staff Account Detail"
          : "Staff Management"
      }
      eyebrow={
        activeTab === "shifts"
          ? "STAFF MANAGEMENT / WORK SCHEDULES"
          : activeTab === "roles"
          ? "STAFF MANAGEMENT / ACCESS CONTROL"
          : view === "add"
          ? "STAFF MANAGEMENT / ADD ACCOUNT"
          : "TEAM AND ACCESS"
      }
      description={
        activeTab === "shifts"
          ? "Pantau shift aktif secara real-time, kelola macam-macam paket shift (maks 10 paket), dan jadwalkan staf gudang visual ala Google Calendar."
          : activeTab === "roles"
          ? "Kelola peran operasional staf gudang, tentukan modul hak akses, dan tetapkan struktur wewenang tim."
          : view === "add"
          ? "Create login credentials and assign mobile access for a warehouse staff member."
          : view === "detail"
          ? "Review staff information, access status, and security actions."
          : "Create and manage staff accounts for the SUSUNO mobile application."
      }
      manager={manager}
      warehouse={warehouse}
      regional={regional}
      query={query}
      onSearch={setQuery}
      onNavigate={onNavigate}
      onSignOut={onSignOut}
    >
      {/* Tab Navigation Sejajar: Staff Accounts, Shift Management, Role Management */}
      <nav
        className="dashboard-card ss-tabs"
        aria-label="Staff Management Sections"
      >
        <div
          className="ss-tab-sliding-pill"
          style={{
            transform: `translateX(${tabPill.left}px)`,
            width: `${tabPill.width}px`,
            opacity: tabPill.ready ? 1 : 0,
            transition: tabPill.ready
              ? "transform 0.28s cubic-bezier(0.22, 1, 0.36, 1), width 0.28s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.2s ease"
              : "none",
          }}
          aria-hidden="true"
        />
        <button
          ref={(node) => { if (node) tabRefs.current.accounts = node; }}
          type="button"
          className={activeTab === "accounts" ? "selected" : ""}
          onClick={() => {
            setActiveTab("accounts");
            setView("list");
            setNotice("");
          }}
        >
          Staff Accounts
        </button>
        <button
          ref={(node) => { if (node) tabRefs.current.shifts = node; }}
          type="button"
          className={activeTab === "shifts" ? "selected" : ""}
          onClick={() => {
            setActiveTab("shifts");
            setNotice("");
          }}
        >
          Shift Management
        </button>
        <button
          ref={(node) => { if (node) tabRefs.current.roles = node; }}
          type="button"
          className={activeTab === "roles" ? "selected" : ""}
          onClick={() => {
            setActiveTab("roles");
            setNotice("");
          }}
        >
          Role Management
        </button>
      </nav>

      {/* ========================================================================= */}
      {/* TAB 1: STAFF ACCOUNTS                                                     */}
      {/* ========================================================================= */}
      {activeTab === "accounts" && (
        <div key="accounts" className="ss-tab-content-animate">
          {view === "list" && (
            <>
              <section className="ss-metrics">
                {[
                  ["Total Staff", staff.length, "Registered staff accounts", "green"],
                  [
                    "Active",
                    staff.filter((row) => staffStatus(row) === "Active").length,
                    "Active staff accounts",
                    "green",
                  ],
                  [
                    "First Login Pending",
                    staff.filter((row) => staffStatus(row) === "Pending").length,
                    "Password change required",
                    "rose",
                  ],
                ].map(([label, value, caption, tone]) => (
                  <article className={"ss-metric metric-" + tone} key={label}>
                    <h2>{label}</h2>
                    <strong>{value}</strong>
                    <small>{caption}</small>
                  </article>
                ))}
              </section>

              <section className="dashboard-card ss-card">
                <h2>Staff Accounts</h2>
                <p className="ss-muted">
                  Manage staff identities and access assignments for the mobile app.
                </p>

                <div className="ss-list-filters">
                  <input
                    aria-label="Search staff accounts"
                    placeholder="Search staff name, role, or username..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                  <select
                    aria-label="Filter staff role"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                  >
                    <option>All Roles</option>
                    {availableRoles.map((value) => (
                      <option key={value}>{value}</option>
                    ))}
                  </select>
                  <select
                    aria-label="Filter staff status"
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                  >
                    {["All Status", "Active", "Pending", "Suspended"].map(
                      (value) => (
                        <option key={value}>{value}</option>
                      )
                    )}
                  </select>
                  <button className="inbound-primary" onClick={add}>
                    + Add Staff Account
                  </button>
                </div>

                <div className="inventory-table-wrap">
                  <table className="ss-staff-table">
                    <thead>
                      <tr>
                        {[
                          "Staff",
                          "Role",
                          "Username",
                          "Warehouse",
                          "Last login",
                          "Status",
                          "Action",
                        ].map((label) => (
                          <th key={label}>{label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {visibleStaff.map((row) => (
                        <tr key={row.id}>
                          <td>
                            <div className="ss-person">
                              <span className="ss-avatar small">
                                {initials(row.fullName)}
                              </span>
                              <div>
                                <strong>{row.fullName}</strong>
                                <small>{row.contact}</small>
                              </div>
                            </div>
                          </td>
                          <td>{row.role}</td>
                          <td>{row.username}</td>
                          <td>{row.warehouseCode || row.warehouse}</td>
                          <td>
                            {row.lastLogin
                              ? managementDate(row.lastLogin, regional, true)
                              : "Not signed in"}
                          </td>
                          <td>{statusTag(row)}</td>
                          <td>
                            <button
                              className="dashboard-link"
                              aria-label={`View staff ${row.fullName}`}
                              onClick={() => {
                                setSelected(row.id);
                                setView("detail");
                                setNotice("");
                              }}
                            >
                              View ›
                            </button>
                          </td>
                        </tr>
                      ))}
                      {!visibleStaff.length && (
                        <tr>
                          <td colSpan="7">
                            No staff accounts match these filters.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="inventory-pagination">
                  <span>
                    Showing{" "}
                    {filteredStaff.length ? (active - 1) * 4 + 1 : 0}–
                    {Math.min(active * 4, filteredStaff.length)} of{" "}
                    {filteredStaff.length} staff accounts
                  </span>
                  <div>
                    {Array.from({ length: pages }, (_, i) => (
                      <button
                        key={i}
                        className={active === i + 1 ? "active-page" : ""}
                        aria-label={`Staff page ${i + 1}`}
                        onClick={() => setPage(i + 1)}
                      >
                        {i + 1}
                      </button>
                    ))}
                  </div>
                </div>
              </section>
            </>
          )}

          {view === "add" && (
            <form
              className="dashboard-card ss-card ss-staff-form"
              onSubmit={create}
              noValidate
            >
              <button type="button" className="ss-back" onClick={back}>
                ‹ Cancel and return to Staff Management
              </button>
              <h2>Staff Information</h2>
              <div className="ss-fields">
                <label>
                  Full name *
                  <input
                    aria-label="Full name *"
                    value={form.fullName}
                    onChange={(e) => field("fullName", e.target.value)}
                    maxLength={100}
                    placeholder="Enter staff full name"
                    aria-invalid={!!errors.fullName}
                  />
                  {errors.fullName && (
                    <span className="field-error">{errors.fullName}</span>
                  )}
                </label>
                <label>
                  Staff role
                  <select
                    aria-label="Staff role"
                    value={form.role || "Staf"}
                    onChange={(e) => field("role", e.target.value)}
                  >
                    <option value="Staf">Staf (Umum / Tidak Ditempatkan)</option>
                    {availableRoles.filter((v) => v !== "Staf").map((value) => (
                      <option key={value} value={value}>{value}</option>
                    ))}
                  </select>
                  {errors.role && (
                    <span className="field-error">{errors.role}</span>
                  )}
                </label>
                <label>
                  Email or phone *
                  <input
                    aria-label="Email or phone *"
                    value={form.contact}
                    onChange={(e) => field("contact", e.target.value)}
                    placeholder="Enter work email or phone"
                    maxLength={254}
                  />
                  {errors.contact && (
                    <span className="field-error">{errors.contact}</span>
                  )}
                </label>
                <label>
                  Assigned warehouse *
                  <select
                    aria-label="Assigned warehouse *"
                    value={form.warehouse}
                    onChange={(e) => field("warehouse", e.target.value)}
                  >
                    <option value="">Select assigned warehouse</option>
                    {warehouseList.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                  {errors.warehouse && (
                    <span className="field-error">{errors.warehouse}</span>
                  )}
                </label>
              </div>
              <hr />
              <h2>Login Credentials</h2>
              <p className="ss-muted">
                These credentials are prepared for the SUSUNO mobile
                application.
              </p>
              <div className="ss-fields">
                <label>
                  Username *
                  <input
                    aria-label="Username *"
                    value={form.username}
                    onChange={(e) => field("username", e.target.value)}
                    placeholder="Enter a unique username"
                    autoComplete="off"
                    maxLength={30}
                  />
                  {errors.username && (
                    <span className="field-error">{errors.username}</span>
                  )}
                </label>
                <div>
                  <PasswordInput
                    id="staff-password"
                    label="Temporary password *"
                    placeholder="Generate or enter temporary password"
                    value={form.password}
                    onChange={(e) => field("password", e.target.value)}
                    error={errors.password}
                    autoComplete="new-password"
                    maxLength={128}
                  />
                  <button
                    type="button"
                    className="dashboard-link ss-generate"
                    onClick={() =>
                      field("password", generateTemporaryPassword())
                    }
                  >
                    Generate
                  </button>
                </div>
              </div>
              <section className="ss-callout rose">
                <strong>First-login security</strong>
                <p>
                  ✓ Require a new password after the first successful mobile
                  login.
                </p>
                <small>
                  The temporary password is shown once after creation. Do not
                  use a real personal password in this demo.
                </small>
              </section>
              {errors.submit && (
                <p role="alert" className="field-error">
                  {errors.submit}
                </p>
              )}
              <div className="ss-actions">
                <button
                  type="button"
                  className="inbound-secondary"
                  onClick={back}
                >
                  Cancel
                </button>
                <button className="inbound-primary">
                  Create Staff Account
                </button>
              </div>
            </form>
          )}

          {view === "detail" && person && (
            <section className="dashboard-card ss-card">
              <button className="ss-back" onClick={back}>
                ‹ Back to Staff Management
              </button>
              <div className="ss-staff-heading">
                {profile}
                <div>
                  <h2>{person.fullName}</h2>
                  <p className="ss-muted">
                    {person.role} · {person.warehouse}
                  </p>
                </div>
                {statusTag(person)}
              </div>
              <div className="ss-detail-grid">
                <section className="ss-inset">
                  <h2>Account Information</h2>
                  <dl className="ss-information">
                    {[
                      ["Full name", person.fullName],
                      ["Role", person.role],
                      ["Username", person.username],
                      [
                        person.contact?.includes("@") ? "Email" : "Phone",
                        person.contact,
                      ],
                      [
                        "Created",
                        managementDate(person.createdAt, regional) +
                          " · " +
                          (person.createdBy || "Manager"),
                      ],
                      [
                        "Last login",
                        person.lastLogin
                          ? managementDate(person.lastLogin, regional, true)
                          : "Not signed in",
                      ],
                    ].map(([lbl, val]) => (
                      <div key={lbl}>
                        <dt>{lbl}</dt>
                        <dd>{val}</dd>
                      </div>
                    ))}
                  </dl>
                </section>
                <section className="ss-access">
                  <h2>Mobile Access</h2>
                  <div
                    className={
                      "ss-callout" +
                      (staffStatus(person) === "Active" ? "" : " rose")
                    }
                  >
                    <strong>
                      {person.suspended
                        ? "Mobile access suspended"
                        : person.requirePasswordChange
                        ? person.lastLogin
                          ? "Password change pending"
                          : "Waiting for first login"
                        : "Mobile access active"}
                    </strong>
                    <p>
                      {person.suspended
                        ? "Reactivate this demo account to restore its previous access state."
                        : person.requirePasswordChange
                        ? "A temporary credential has been issued. Mobile first login is not connected."
                        : `Password changed on ${managementDate(
                            person.passwordChangedAt,
                            regional
                          )} · Sample record`}
                    </p>
                  </div>
                  <h3>Security actions</h3>
                  <button
                    className="inbound-secondary"
                    disabled={person.suspended}
                    onClick={() => action("reset")}
                  >
                    Reset Temporary Password
                  </button>
                  <button
                    className="inbound-secondary"
                    onClick={() => action("edit")}
                  >
                    Edit Role or Warehouse
                  </button>
                  <button
                    className={person.suspended ? "inbound-secondary" : "ss-danger"}
                    onClick={() => action("suspend")}
                  >
                    {person.suspended
                      ? "Reactivate Mobile Access"
                      : "Suspend Mobile Access"}
                  </button>
                </section>
              </div>

              {/* Seksi Relasi Jadwal Shift Staf Terkait */}
              <section className="ss-card" style={{ marginTop: "24px", border: "1px solid var(--ss-border, #dfe4d9)", borderRadius: "12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", flexWrap: "wrap", gap: "10px" }}>
                  <div>
                    <h3 style={{ margin: 0 }}>Jadwal Shift Kerja Staf Ini</h3>
                    <p className="ss-muted" style={{ margin: "4px 0 0" }}>
                      Penugasan jam kerja aktif untuk {person.fullName}.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="inbound-primary"
                    onClick={() => {
                      setActiveTab("shifts");
                      openCreateShift(null, person.id);
                    }}
                  >
                    + Jadwalkan Shift Staf Ini
                  </button>
                </div>

                {personShifts.length > 0 ? (
                  <div className="inventory-table-wrap">
                    <table className="ss-staff-table">
                      <thead>
                        <tr>
                          <th>Paket Shift</th>
                          <th>Tanggal</th>
                          <th>Jam Kerja</th>
                          <th>Durasi</th>
                          <th>Status</th>
                          <th>Aksi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {personShifts.map((ps) => {
                          const timing = getShiftTimingStatus(ps.shift_date);
                          const pkg = findMatchingPackage(ps, shiftPackages);
                          const hex = pkg.color || "#5c732b";
                          return (
                            <tr key={ps.id}>
                              <td>
                                <span
                                  className="ss-cal-event"
                                  style={{
                                    display: "inline-flex",
                                    borderLeft: `4px solid ${hex}`,
                                    backgroundColor: `${hex}18`,
                                    color: hex,
                                    fontWeight: 700,
                                  }}
                                >
                                  #{pkg.icon || "1"} {pkg.name}
                                </span>
                              </td>
                              <td>
                                <strong>{managementDate(ps.shift_date, regional)}</strong>
                              </td>
                              <td>
                                <span className="ss-time-badge">
                                  {formatTime(ps.start_time)} – {formatTime(ps.end_time)}
                                </span>
                              </td>
                              <td>
                                <span className="ss-duration-badge">
                                  {calculateDuration(ps.start_time, ps.end_time)}
                                </span>
                              </td>
                              <td>
                                <span className={`ss-shift-status ${timing.cls}`}>
                                  {timing.label}
                                </span>
                              </td>
                              <td>
                                <button
                                  type="button"
                                  className="dashboard-link"
                                  onClick={(e) => openEditShift(ps, e)}
                                >
                                  Edit ›
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="ss-muted" style={{ margin: "10px 0" }}>
                    Belum ada jadwal shift yang dibuat untuk {person.fullName}. Klik tombol di atas untuk menjadwalkan shift.
                  </p>
                )}
              </section>

              {/* Riwayat Absensi Staf Ini */}
              <section className="ss-card" style={{ marginTop: "24px", border: "1px solid var(--ss-border, #dfe4d9)", borderRadius: "12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", flexWrap: "wrap", gap: "10px" }}>
                  <div>
                    <h3 style={{ margin: 0 }}>Riwayat Absensi Staf Ini</h3>
                    <p className="ss-muted" style={{ margin: "4px 0 0" }}>
                      Waktu check-in dan check-out aktual {person.fullName} dari aplikasi mobile.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="dashboard-link"
                    onClick={loadAttendances}
                    title="Muat ulang data absensi"
                  >
                    🔄 Refresh
                  </button>
                </div>

                {personSessions.length > 0 ? (
                  <div className="inventory-table-wrap">
                    <table className="ss-staff-table">
                      <thead>
                        <tr>
                          <th>Tanggal</th>
                          <th>Jam Check-In</th>
                          <th>Jam Check-Out</th>
                          <th>Durasi Kerja</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {personSessions.map((sess) => (
                          <tr key={sess.id}>
                            <td>
                              <strong>{sessionDate(sess.checkIn?.scan_time || sess.checkOut?.scan_time)}</strong>
                            </td>
                            <td>
                              {sess.checkIn ? (
                                <span className="ss-time-badge check-in">
                                  🟢 {formatClockTime(sess.checkIn.scan_time)}
                                </span>
                              ) : (
                                <span className="ss-muted">–</span>
                              )}
                            </td>
                            <td>
                              {sess.checkOut ? (
                                <span className="ss-time-badge check-out">
                                  🔴 {formatClockTime(sess.checkOut.scan_time)}
                                </span>
                              ) : sess.checkIn ? (
                                <span className="ss-shift-status current">
                                  ⏳ Sedang Bekerja
                                </span>
                              ) : (
                                <span className="ss-muted">–</span>
                              )}
                            </td>
                            <td>
                              <span className="ss-duration-badge">
                                {formatSessionDuration(sess.checkIn?.scan_time, sess.checkOut?.scan_time)}
                              </span>
                            </td>
                            <td>
                              <span className={sess.statusCls}>
                                {sess.statusLabel}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="ss-muted" style={{ margin: "10px 0" }}>
                    Belum ada riwayat check-in / check-out untuk {person.fullName}.
                  </p>
                )}
              </section>

              <section className="ss-callout" style={{ marginTop: "16px" }}>
                <strong>Access principle</strong>
                <p>
                  Akun staf tersimpan di database MySQL dan dapat digunakan
                  untuk autentikasi aplikasi mobile.
                </p>
              </section>
            </section>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: SHIFT MANAGEMENT                                                   */}
      {/* ========================================================================= */}
      {activeTab === "shifts" && (
        <div key="shifts" className="ss-tab-content-animate">
          {/* Metrik Shift */}
          <section className="ss-metrics" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
            <article className="ss-metric metric-green">
              <h2>Total Shifts</h2>
              <strong>{shifts.length}</strong>
              <small>Jadwal shift aktif di database</small>
            </article>
            <article className="ss-metric metric-green">
              <h2>Shift Aktif Saat Ini</h2>
              <strong style={{ color: activeNowPackage ? "#15803d" : "#737b6c" }}>
                {activeNowPackage ? `#${activeNowPackage.icon} ${activeNowPackage.name}` : "Tidak Ada Shift Aktif"}
              </strong>
              <small>
                {activeNowPackage
                  ? `${activeNowPackage.startTime} – ${activeNowPackage.endTime} · ${staffWorkingNow.length} staf bertugas`
                  : "Di luar jadwal operasional shift"}
              </small>
            </article>
            <article className="ss-metric metric-green">
              <h2>Staf Terjadwal</h2>
              <strong>
                {assignedStaffIds.size} / {staff.length}
              </strong>
              <small>Staf memiliki alokasi shift</small>
            </article>
          </section>

          {/* ===================================================================== */}
          {/* ROW KHUSUS: PENGATURAN MACAM-MACAM SHIFT (DAPAT DI-COLLAPSE)          */}
          {/* ===================================================================== */}
          <section className="dashboard-card ss-packages-section">
            <div className="ss-packages-header">
              <div>
                <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700 }}>
                  Pengaturan Macam-Macam Shift
                </h3>
                <p className="ss-muted" style={{ margin: "4px 0 0" }}>
                  Kelola paket shift kerja, jam operasional, warna penanda, dan pantau staf yang sedang bekerja di lapangan.
                </p>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                <button
                  type="button"
                  className="dashboard-link"
                  onClick={() => setShowPackages((cur) => !cur)}
                  style={{ fontSize: "13px", fontWeight: 600 }}
                >
                  {showPackages ? "▲ Sembunyikan Panel" : "▼ Tampilkan Macam Shift"}
                </button>
                <button
                  type="button"
                  className="inbound-primary"
                  onClick={openCreatePackage}
                  disabled={shiftPackages.length >= MAX_SHIFT_PACKAGES}
                  title={
                    shiftPackages.length >= MAX_SHIFT_PACKAGES
                      ? "Batas maksimal 10 macam shift tercapai"
                      : "Kelola macam shift"
                  }
                >
                  Kelola Shift {shiftPackages.length >= MAX_SHIFT_PACKAGES ? "(Penuh)" : ""}
                </button>
              </div>
            </div>

            {showPackages && (
              <div className="ss-packages-grid">
                {shiftPackages.length === 0 ? (
                  <div style={{ padding: "2.5rem 1.5rem", textAlign: "center", color: "#737b6c", gridColumn: "1 / -1", background: "#f8f9f5", borderRadius: "14px", border: "1px dashed #d1d5db" }}>
                    <p style={{ margin: 0, fontWeight: 700, fontSize: "14px", color: "#191d17" }}>Belum ada paket shift yang dibuat.</p>
                    <p style={{ margin: "6px 0 0", fontSize: "12px" }}>Klik tombol <strong>+ Buat Paket Shift Baru</strong> di atas untuk menambahkan jadwal kerja.</p>
                  </div>
                ) : (
                  shiftPackages.map((pkg) => {
                  const isActive = isShiftActiveNow(pkg.startTime, pkg.endTime);
                  const hex = pkg.color || "#5c732b";

                  // Cari staf yang bertugas di shift ini HARI INI
                  const todayStaffInShift = shifts.filter((s) => {
                    const sDate = s.shift_date ? String(s.shift_date).slice(0, 10) : "";
                    if (sDate !== todayStr) return false;
                    const m = findMatchingPackage(s, shiftPackages);
                    return m.id === pkg.id;
                  });

                  // Total alokasi keseluruhan shift ini
                  const totalAssignedCount = shifts.filter((s) => {
                    const m = findMatchingPackage(s, shiftPackages);
                    return m.id === pkg.id;
                  }).length;

                  return (
                    <div
                      key={pkg.id}
                      className={`ss-pkg-card ${isActive ? "ss-pkg-card-active" : ""}`}
                      style={{ borderTopColor: hex, cursor: "pointer" }}
                      onClick={() => openEditPackage(pkg)}
                      title={`Klik untuk edit paket shift ${pkg.name}`}
                    >
                      <div className="ss-pkg-top">
                        <span
                          className="ss-pkg-num-badge"
                          style={{
                            backgroundColor: `${hex}18`,
                            color: hex,
                            borderColor: hex,
                          }}
                        >
                          #{pkg.icon || "1"}
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "6px" }}>
                            <strong style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {pkg.name}
                            </strong>
                            <span
                              style={{
                                fontSize: "10.5px",
                                fontWeight: 700,
                                padding: "2px 6px",
                                borderRadius: "4px",
                                backgroundColor: `${hex}20`,
                                color: hex,
                                whiteSpace: "nowrap",
                              }}
                            >
                              {pkg.shortName}
                            </span>
                          </div>
                          <small className="ss-pkg-desc">{pkg.description || "Standar operasional gudang"}</small>
                        </div>
                      </div>

                      <div className="ss-pkg-body">
                        <span className="ss-pkg-time">
                          {pkg.startTime} – {pkg.endTime}
                        </span>
                        <span className="ss-duration-badge">
                          {calculateDuration(pkg.startTime, pkg.endTime)}
                        </span>
                      </div>

                      {/* Status Live: Apakah sedang bekerja saat ini? */}
                      <div style={{ margin: "2px 0" }}>
                        {isActive ? (
                          <div className="ss-on-duty-banner">
                            <span className="ss-pulse-dot" />
                            <span>🟢 Sedang Bekerja Sekarang</span>
                          </div>
                        ) : (
                          <div className="ss-off-duty-banner">
                            <span>⚪ Menunggu Jadwal Kerja</span>
                          </div>
                        )}
                      </div>

                      {/* Tunjukkan Staf yang Sedang/Akan Bekerja di Shift ini Hari Ini */}
                      <div className="ss-pkg-staff-today">
                        <small style={{ display: "block", fontWeight: 700, marginBottom: "4px", color: "var(--ss-text, #191d17)" }}>
                          Staf Bertugas Hari Ini ({todayStaffInShift.length}):
                        </small>
                        {todayStaffInShift.length > 0 ? (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                            {todayStaffInShift.map((s) => {
                              const staffObj = staff.find((u) => String(u.id) === String(s.user_id));
                              const sName = s.user_name || staffObj?.fullName || `Staf #${s.user_id}`;
                              return (
                                <span
                                  key={s.id}
                                  className="ss-staff-chip-pill"
                                  title={`Bertugas hari ini: ${sName}`}
                                >
                                  👤 {sName}
                                </span>
                              );
                            })}
                          </div>
                        ) : (
                          <small className="ss-muted" style={{ fontStyle: "italic", fontSize: "11px" }}>
                            Belum ada staf bertugas hari ini
                          </small>
                        )}
                      </div>

                      <div
                        className="ss-pkg-footer"
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <small>{totalAssignedCount} total alokasi</small>
                        <button
                          type="button"
                          className="dashboard-link"
                          style={{ fontSize: "12px", fontWeight: 600, padding: 0 }}
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditPackage(pkg);
                          }}
                        >
                          ✏ Edit Shift
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            )}
          </section>

          {/* ===================================================================== */}
          {/* KALENDER SHIFT (ALA GOOGLE CALENDAR) & TABEL JADWAL                   */}
          {/* ===================================================================== */}
          <section className="dashboard-card ss-card">
            {/* Top Bar: Navigasi Kalender + Jam Digital Real-Time + Toggle View + Tombol Buat Shift */}
            <div className="ss-cal-topbar">
              <div className="ss-cal-nav-group">
                <button
                  type="button"
                  className="ss-cal-nav-btn ss-cal-nav-arrow"
                  onClick={calPrevMonth}
                  title="Bulan sebelumnya"
                >
                  ‹
                </button>
                <button
                  type="button"
                  className="ss-cal-nav-btn"
                  onClick={calGoToToday}
                >
                  Hari Ini
                </button>
                <button
                  type="button"
                  className="ss-cal-nav-btn ss-cal-nav-arrow"
                  onClick={calNextMonth}
                  title="Bulan berikutnya"
                >
                  ›
                </button>
                <h2 className="ss-cal-month-title">{calMonthTitle}</h2>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                {/* Switcher Tampilan: Kalender vs Tabel vs Riwayat Absensi */}
                <div className="ss-view-toggle" role="group" aria-label="Pilih tampilan jadwal">
                  <button
                    type="button"
                    className={shiftView === "calendar" ? "active" : ""}
                    onClick={() => setShiftView("calendar")}
                  >
                    📅 Kalender
                  </button>
                  <button
                    type="button"
                    className={shiftView === "table" ? "active" : ""}
                    onClick={() => setShiftView("table")}
                  >
                    📋 Jadwal Shift
                  </button>
                  <button
                    type="button"
                    className={shiftView === "attendance" ? "active" : ""}
                    onClick={() => {
                      setShiftView("attendance");
                      loadAttendances();
                    }}
                  >
                    ⏱️ Riwayat Shift
                  </button>
                </div>

                <button
                  type="button"
                  className="inbound-primary"
                  onClick={() => openCreateShift()}
                >
                  + Jadwalkan Staf
                </button>
              </div>
            </div>

            <p className="ss-muted" style={{ margin: "-10px 0 16px" }}>
              {shiftView === "calendar"
                ? "💡 Warna dan label chip di kalender otomatis mengikuti Macam-Macam Shift di atas. Klik kotak tanggal untuk menambah shift, atau klik chip shift staf untuk mengeditnya."
                : shiftView === "table"
                ? "Daftar jadwal seluruh staf dengan filter dan aksi cepat."
                : "Pantau riwayat shift per tanggal dengan rincian kehadiran 3 shift operasional, status check-in dan check-out, serta total jam kerja staf."}
            </p>

            {/* VIEW 1: GOOGLE CALENDAR MONTH GRID */}
            {shiftView === "calendar" && (
              <div className="ss-cal-wrapper">
                <div className="ss-cal-grid-container">
                  {/* Nama-Nama Hari */}
                  <div className="ss-cal-weekdays">
                    {CALENDAR_WEEKDAYS.map((wd) => (
                      <div key={wd} className="ss-cal-weekday">
                        {wd}
                      </div>
                    ))}
                  </div>

                  {/* Grid Sel Hari */}
                  <div className="ss-cal-grid">
                    {calendarDays.map((cell) => {
                      const dayShifts = shifts.filter((s) => {
                        const sDate = s.shift_date
                          ? String(s.shift_date).slice(0, 10)
                          : "";
                        return sDate === cell.dateStr;
                      });

                      return (
                        <div
                          key={cell.dateStr}
                          className={`ss-cal-day ${
                            !cell.isCurrentMonth ? "ss-cal-day-other-month" : ""
                          } ${cell.isToday ? "ss-cal-day-today" : ""}`}
                          onClick={() => openCreateShift(cell.dateStr)}
                          title={`Klik untuk menjadwalkan shift pada tanggal ${cell.dateStr}`}
                        >
                          <div className="ss-cal-day-header">
                            <span className="ss-cal-day-number">
                              {cell.dayNum}
                            </span>
                            {cell.isToday && (
                              <span
                                style={{
                                  fontSize: "10px",
                                  fontWeight: 700,
                                  color: "#5c732b",
                                  textTransform: "uppercase",
                                }}
                              >
                                Hari Ini
                              </span>
                            )}
                          </div>

                          {/* Event Chips ala Google Calendar terhubung dengan Shift Packages & Custom Color */}
                          <div className="ss-cal-events-list">
                            {dayShifts.map((sh) => {
                              const stf = staff.find(
                                (s) => String(s.id) === String(sh.user_id)
                              );
                              const staffName =
                                sh.user_name || stf?.fullName || `Staf #${sh.user_id}`;
                              const staffRole =
                                stf?.role || sh.user_system_role || "Staff";
                              const pkg = findMatchingPackage(sh, shiftPackages);
                              const hex = pkg.color || "#5c732b";

                              return (
                                <div
                                  key={sh.id}
                                  className="ss-cal-event"
                                  style={{
                                    borderLeft: `4px solid ${hex}`,
                                    backgroundColor: `${hex}18`,
                                    color: hex,
                                  }}
                                  onClick={(e) => openEditShift(sh, e)}
                                  title={`[${pkg.name}] ${staffName} (${staffRole}): ${formatTime(
                                    sh.start_time
                                  )} - ${formatTime(sh.end_time)} · Klik untuk edit`}
                                >
                                  <span className="ss-cal-event-time">
                                    #{pkg.icon || "1"} {pkg.shortName} {formatTime(sh.start_time)}
                                  </span>
                                  <span className="ss-cal-event-name" style={{ color: "var(--ss-text, #191d17)" }}>
                                    {staffName}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* VIEW 2: TABLE VIEW */}
            {shiftView === "table" && (
              <>
                <div
                  className="ss-list-filters"
                  style={{
                    marginTop: "10px",
                    gridTemplateColumns: "1fr 200px 160px auto",
                  }}
                >
                  <select
                    aria-label="Filter staf"
                    value={shiftFilterStaff}
                    onChange={(e) => setShiftFilterStaff(e.target.value)}
                  >
                    <option value="all">Semua Staf Lapangan</option>
                    {staff.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.fullName} ({s.role})
                      </option>
                    ))}
                  </select>

                  <input
                    type="date"
                    aria-label="Filter tanggal shift"
                    value={shiftFilterDate}
                    onChange={(e) => setShiftFilterDate(e.target.value)}
                    title="Pilih tanggal shift"
                  />

                  {shiftFilterDate && (
                    <button
                      type="button"
                      className="inbound-secondary"
                      onClick={() => setShiftFilterDate("")}
                    >
                      Reset Tanggal
                    </button>
                  )}
                </div>

                <div className="inventory-table-wrap">
                  <table className="ss-staff-table">
                    <thead>
                      <tr>
                        <th>Paket Shift</th>
                        <th>Staf Bertugas</th>
                        <th>Role / Posisi</th>
                        <th>Tanggal Shift</th>
                        <th>Jam Kerja</th>
                        <th>Durasi</th>
                        <th>Status</th>
                        <th>Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredShifts.map((sh) => {
                        const stf = staff.find(
                          (s) => String(s.id) === String(sh.user_id)
                        );
                        const staffName =
                          sh.user_name || stf?.fullName || `Staf #${sh.user_id}`;
                        const staffRole =
                          stf?.role || sh.user_system_role || "Staff Gudang";
                        const staffEmail = sh.user_email || stf?.contact || "";
                        const timing = getShiftTimingStatus(sh.shift_date);
                        const duration = calculateDuration(sh.start_time, sh.end_time);
                        const pkg = findMatchingPackage(sh, shiftPackages);
                        const hex = pkg.color || "#5c732b";

                        return (
                          <tr key={sh.id}>
                            <td>
                              <span
                                className="ss-cal-event"
                                style={{
                                  display: "inline-flex",
                                  borderLeft: `4px solid ${hex}`,
                                  backgroundColor: `${hex}18`,
                                  color: hex,
                                  fontWeight: 700,
                                }}
                              >
                                #{pkg.icon || "1"} {pkg.name}
                              </span>
                            </td>
                            <td>
                              <div className="ss-person">
                                <span className="ss-avatar small">
                                  {initials(staffName)}
                                </span>
                                <div>
                                  <strong>{staffName}</strong>
                                  <small>{staffEmail}</small>
                                </div>
                              </div>
                            </td>
                            <td>{staffRole}</td>
                            <td>
                              <strong>
                                {managementDate(sh.shift_date, regional)}
                              </strong>
                            </td>
                            <td>
                              <span className="ss-time-badge">
                                {formatTime(sh.start_time)} – {formatTime(sh.end_time)}
                              </span>
                            </td>
                            <td>
                              <span className="ss-duration-badge">
                                {duration}
                              </span>
                            </td>
                            <td>
                              <span className={`ss-shift-status ${timing.cls}`}>
                                {timing.label}
                              </span>
                            </td>
                            <td>
                              <button
                                type="button"
                                className="dashboard-link"
                                onClick={(e) => openEditShift(sh, e)}
                              >
                                Edit ›
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                      {!filteredShifts.length && (
                        <tr>
                          <td colSpan="8" style={{ textAlign: "center", padding: "36px" }}>
                            {shiftsLoading ? (
                              "Memuat data shift dari server..."
                            ) : (
                              <div>
                                <p style={{ fontWeight: 600, margin: "0 0 6px" }}>
                                  Belum ada jadwal shift kerja staf.
                                </p>
                                <small className="ss-muted">
                                  Klik "+ Buat Shift Baru" atau klik "+ Jadwalkan" pada salah satu paket shift di atas.
                                  Klik "+ Jadwalkan Staf" atau klik "+ Jadwalkan" pada salah satu paket shift di atas.
                                </small>
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {/* VIEW 3: RIWAYAT SHIFT (3 ROW DENGAN DROPDOWN ACCORDION & NAVIGASI TANGGAL) */}
            {shiftView === "attendance" && (
              <>
                {/* BARIS TANGGAL & AKSI CEPAT */}
                <div className="ss-history-datebar">
                  <div className="ss-history-date-nav">
                    <button
                      type="button"
                      className="ss-cal-nav-btn ss-cal-nav-arrow"
                      onClick={handlePrevDate}
                      title="Lihat hari sebelumnya"
                    >
                      ‹
                    </button>
                    <input
                      type="date"
                      className="ss-history-date-input"
                      value={attendanceFilterDate}
                      onChange={(e) => setAttendanceFilterDate(e.target.value)}
                      aria-label="Pilih tanggal riwayat shift"
                    />
                    <button
                      type="button"
                      className="ss-cal-nav-btn ss-cal-nav-arrow"
                      onClick={handleNextDate}
                      title="Lihat hari berikutnya"
                    >
                      ›
                    </button>
                    <button
                      type="button"
                      className="ss-cal-nav-btn"
                      onClick={handleTodayDate}
                      title="Kembali ke hari ini"
                    >
                      Hari Ini
                    </button>
                    <span className="ss-history-date-label">
                      {formatHeaderDate(attendanceFilterDate)}
                    </span>
                  </div>

                  <div className="ss-history-actions">
                    <button
                      type="button"
                      className="dashboard-link"
                      onClick={() => {
                        const allOpen = Object.values(expandedShifts).every(Boolean);
                        toggleAllShiftAccordions(!allOpen);
                      }}
                      style={{ fontSize: "12.5px", fontWeight: 600 }}
                    >
                      {Object.values(expandedShifts).every(Boolean)
                        ? "▲ Tutup Semua Dropdown"
                        : "▼ Buka Semua Dropdown"}
                    </button>
                    <button
                      type="button"
                      className="inbound-secondary"
                      onClick={loadAttendances}
                      title="Muat ulang absensi dari database"
                    >
                      🔄 Refresh Data
                    </button>
                  </div>
                </div>

                {/* 3 ROW SHIFT DENGAN DROPDOWN ACCORDION */}
                <div className="ss-history-shift-list">
                  {threeShiftGroups.map((group, idx) => {
                    const isExpanded = !!expandedShifts[idx];
                    return (
                      <div key={group.id} className="ss-history-shift-card">
                        {/* HEADER ROW / DROPDOWN TRIGGER */}
                        <div
                          className="ss-history-shift-header"
                          onClick={() => toggleShiftAccordion(idx)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              toggleShiftAccordion(idx);
                            }
                          }}
                        >
                          <div className="ss-history-shift-left">
                            <span
                              className="ss-history-shift-badge"
                              style={{
                                backgroundColor: `${group.color}20`,
                                color: group.color,
                                borderColor: `${group.color}40`,
                              }}
                            >
                              #{group.icon}
                            </span>
                            <div>
                              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                                <h3 className="ss-history-shift-title">{group.name}</h3>
                                <span className="ss-history-shift-time">
                                  ⏱️ {group.startTime} – {group.endTime} WIB
                                </span>
                              </div>
                              <div className="ss-history-shift-meta">
                                <span className="ss-badge-attended">
                                  👥 <strong>{group.attendedCount}</strong> Staf Masuk
                                </span>
                                {group.workingNowCount > 0 && (
                                  <span className="ss-badge-working">
                                    🟢 {group.workingNowCount} Sedang Bekerja
                                  </span>
                                )}
                                {group.finishedCount > 0 && (
                                  <span className="ss-badge-finished">
                                    ✅ {group.finishedCount} Selesai Shift
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="ss-history-shift-right">
                            <button
                              type="button"
                              className="ss-accordion-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleShiftAccordion(idx);
                              }}
                            >
                              <span>{isExpanded ? "▲ Sembunyikan Staf" : "▼ Tampilkan Staf"}</span>
                              <span className="ss-accordion-count">({group.staffList.length})</span>
                            </button>
                          </div>
                        </div>

                        {/* DROPDOWN EXPANDED CONTENT: DAFTAR SIAPA SAJA YANG MASUK */}
                        {isExpanded && (
                          <div className="ss-history-shift-body">
                            {group.staffList.length > 0 ? (
                              <div className="inventory-table-wrap">
                                <table className="ss-staff-table">
                                  <thead>
                                    <tr>
                                      <th>Staf Lapangan</th>
                                      <th>Role / Posisi</th>
                                      <th>Jam Check-In</th>
                                      <th>Jam Check-Out</th>
                                      <th>Total Jam Kerja</th>
                                      <th>Status</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {group.staffList.map((item) => (
                                      <tr key={item.id}>
                                        <td>
                                          <div className="ss-person">
                                            <span className="ss-avatar small">
                                              {initials(item.userName)}
                                            </span>
                                            <div>
                                              <strong>{item.userName}</strong>
                                              <small>{item.userEmail || "–"}</small>
                                            </div>
                                          </div>
                                        </td>
                                        <td>{item.userRole}</td>
                                        <td>
                                          {item.checkIn ? (
                                            <span className="ss-time-badge check-in">
                                              🟢 {formatClockTime(item.checkIn.scan_time)}
                                            </span>
                                          ) : (
                                            <span className="ss-muted">–</span>
                                          )}
                                        </td>
                                        <td>
                                          {item.checkOut ? (
                                            <span className="ss-time-badge check-out">
                                              🔴 {formatClockTime(item.checkOut.scan_time)}
                                            </span>
                                          ) : item.checkIn ? (
                                            <span className="ss-shift-status current">
                                              ⏳ Sedang Bekerja
                                            </span>
                                          ) : (
                                            <span className="ss-muted">–</span>
                                          )}
                                        </td>
                                        <td>
                                          {item.checkIn ? (
                                            <span className="ss-duration-badge">
                                              {formatSessionDuration(
                                                item.checkIn?.scan_time,
                                                item.checkOut?.scan_time
                                              )}
                                            </span>
                                          ) : (
                                            <span className="ss-muted">–</span>
                                          )}
                                        </td>
                                        <td>
                                          <span className={item.statusCls || "ss-shift-status upcoming"}>
                                            {item.statusLabel || "–"}
                                          </span>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            ) : (
                              <div className="ss-history-empty-row">
                                <p>⚪ Belum ada staf yang masuk pada shift ini.</p>
                                <small className="ss-muted">
                                  Data absensi otomatis masuk saat staf melakukan check-in melalui aplikasi mobile.
                                </small>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}

          </section>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: ROLE MANAGEMENT (TANPA KARTU SISTEM/KUSTOM, SEMUA BISA DIHAPUS)   */}
      {/* ========================================================================= */}
      {activeTab === "roles" && (
        <div key="roles" className="ss-tab-content-animate">
          {/* Metrik Role Bersih (Tanpa Card Standar Sistem / Role Kustom) */}
          <section className="ss-metrics" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
            <article className="ss-metric metric-green">
              <h2>Total Roles Terdaftar</h2>
              <strong>{rolesList.length}</strong>
              <small>Posisi & peran operasional gudang</small>
            </article>
            <article className="ss-metric metric-green">
              <h2>Total Staf Terdaftar</h2>
              <strong>{staff.length}</strong>
              <small>Personil tim di seluruh gudang</small>
            </article>
          </section>

          <section className="dashboard-card ss-card">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "12px",
              }}
            >
              <div>
                <h2>Daftar Peran Staf & Wewenang</h2>
                <p className="ss-muted" style={{ margin: "4px 0 0" }}>
                  Kelola dan sesuaikan wewenang modul untuk seluruh peran staf gudang. Semua role dapat diedit atau dihapus.
                </p>
              </div>
              <button className="inbound-primary" onClick={openCreateRole}>
                + Buat Role Baru
              </button>
            </div>

            <div className="ss-roles-grid">
              {rolesList.length === 0 ? (
                <div style={{ padding: "2.5rem 1.5rem", textAlign: "center", color: "#737b6c", gridColumn: "1 / -1", background: "#f8f9f5", borderRadius: "14px", border: "1px dashed #d1d5db" }}>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: "14px", color: "#191d17" }}>Belum ada role / jabatan staf yang dibuat.</p>
                  <p style={{ margin: "6px 0 0", fontSize: "12px" }}>Klik tombol <strong>+ Buat Role Baru</strong> di atas untuk menambahkan peran staf baru.</p>
                </div>
              ) : (
                rolesList.map((r) => {
                const memberCount = staff.filter(
                  (s) => s.role?.toLowerCase() === r.name.toLowerCase()
                ).length;

                return (
                  <article key={r.id} className="ss-role-card">
                    <div>
                      <div className="ss-role-card-header">
                        <h3>{r.name}</h3>
                        <span className="ss-role-count">
                          {memberCount} Staf Terdaftar
                        </span>
                      </div>
                      <p className="ss-role-desc">{r.description}</p>
                      <div className="ss-module-badges">
                        {r.modules.map((mod) => (
                          <span key={mod} className="ss-module-badge">
                            {mod}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div
                      className="ss-role-footer"
                      style={{
                        display: "flex",
                        justifyContent: "flex-end",
                        alignItems: "center",
                        gap: "12px",
                      }}
                    >
                      <button
                        type="button"
                        className="dashboard-link"
                        onClick={() => openEditRole(r)}
                        aria-label={`Edit role ${r.name}`}
                      >
                        ✏ Edit Role
                      </button>
                      <button
                        type="button"
                        className="dashboard-link ss-red"
                        onClick={() => openDeleteRoleConfirm(r)}
                        aria-label={`Hapus role ${r.name}`}
                      >
                        Hapus Role
                      </button>
                    </div>
                  </article>
                );
              })
            )}
          </div>

            <section className="ss-callout" style={{ marginTop: "24px" }}>
              <strong>Keterkaitan Role & Akun</strong>
              <p>
                Setiap role yang terdaftar di tab ini otomatis muncul sebagai
                pilihan pada saat membuat atau mengedit akun staf. Jika role
                dihapus, role tersebut tidak akan lagi tersedia di pilihan formulir.
              </p>
            </section>
          </section>
        </div>
      )}

      {notice && !modal && <p role="status" className="form-notice">{notice}</p>}

      {/* ========================================================================= */}
      {/* MODAL: ACCOUNT MODALS (Ready, Edit, Reset, Suspend)                       */}
      {/* ========================================================================= */}
      {modal && (
        <StaffDialog
          title={
            modal === "ready"
              ? "Account is ready"
              : modal === "edit"
              ? "Edit Role or Warehouse"
              : modal === "reset"
              ? "Reset Temporary Password"
              : "Confirm Mobile Access"
          }
          onClose={close}
          wide={modal === "ready"}
        >
          {modal === "ready" && secret ? (
            <>
              <div className="ss-success">✓</div>
              <h2>Account is ready</h2>
              <p className="ss-muted ss-center">
                Kredensial staf berhasil dibuat dan tersimpan di database SUSUNO.
              </p>
              <section className="ss-inset ss-credentials">
                <small>STAFF</small>
                <strong>
                  {secret.fullName} · {secret.role}
                </strong>
                <dl className="ss-information">
                  <div>
                    <dt>Username / Email</dt>
                    <dd>{secret.username}</dd>
                  </div>
                  <div>
                    <dt>Temporary password</dt>
                    <dd className="ss-secret">{secret.password}</dd>
                  </div>
                </dl>
                <small className="ss-red">
                  Tersimpan di database · Dapat digunakan login di Mobile
                </small>
              </section>
              <section className="ss-callout">
                <strong>Next step for staff</strong>
                <p>
                  Gunakan kredensial ini untuk login di aplikasi mobile SUSUNO.
                </p>
              </section>
              {notice && <p role="status" className="form-notice">{notice}</p>}
              <div className="ss-actions three">
                <button className="inbound-secondary" onClick={copy}>
                  Copy Credentials
                </button>
                <button
                  className="inbound-secondary"
                  onClick={() => {
                    close();
                    setView("detail");
                  }}
                >
                  View Staff Detail
                </button>
                <button
                  className="inbound-primary"
                  onClick={() => {
                    close();
                    back();
                  }}
                >
                  Done
                </button>
              </div>
            </>
          ) : modal === "edit" ? (
            <form onSubmit={saveEdit}>
              <h2>Edit Role or Warehouse</h2>
              <div className="ss-fields single">
                <label>
                  Staff role
                  <select
                    aria-label="Staff role"
                    value={edit.role || "Staf"}
                    onChange={(e) =>
                      setEdit({ ...edit, role: e.target.value })
                    }
                  >
                    <option value="Staf">Staf (Umum / Tidak Ditempatkan)</option>
                    {availableRoles.filter((v) => v !== "Staf").map((value) => (
                      <option key={value} value={value}>{value}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Assigned warehouse
                  <select
                    aria-label="Assigned warehouse"
                    value={edit.warehouse}
                    onChange={(e) =>
                      setEdit({ ...edit, warehouse: e.target.value })
                    }
                  >
                    <option value="">Select assigned warehouse</option>
                    {warehouseList.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              {notice && <p role="alert" className="field-error">{notice}</p>}
              <div className="ss-actions">
                <button
                  type="button"
                  className="inbound-secondary"
                  onClick={close}
                >
                  Cancel
                </button>
                <button className="inbound-primary">Save Assignment</button>
              </div>
            </form>
          ) : (
            <>
              <h2>
                {modal === "reset"
                  ? "Reset Temporary Password"
                  : person?.suspended
                  ? "Reactivate Mobile Access"
                  : "Suspend Mobile Access"}
              </h2>
              <p className="ss-muted">
                {modal === "reset"
                  ? "Prepare a new temporary credential and mark this account as pending password change."
                  : person?.suspended
                  ? "Restore the previous demo access state for this staff account?"
                  : "Suspend this staff account in the demo. Its history is retained."}
              </p>
              <p>
                <strong>{person?.fullName}</strong>
              </p>
              {notice && <p role="alert" className="field-error">{notice}</p>}
              <div className="ss-actions">
                <button className="inbound-secondary" onClick={close}>
                  Cancel
                </button>
                <button
                  className="inbound-primary"
                  onClick={modal === "reset" ? reset : suspend}
                >
                  {modal === "reset" ? "Reset Password" : "Confirm"}
                </button>
              </div>
            </>
          )}
        </StaffDialog>
      )}

      {/* ========================================================================= */}
      {/* MODAL: EDIT / TAMBAH PAKET SHIFT (PILIH WARNA SENDIRI & VALIDASI MAX 10)  */}
      {/* ========================================================================= */}
      {(packageModal === "create" || packageModal === "edit") && (
        <StaffDialog
          title={packageModal === "edit" ? "Edit Paket Shift" : "Tambah Macam Shift Baru"}
          onClose={() => setPackageModal(null)}
          wide={true}
        >
          <form onSubmit={savePackage} noValidate>
            <h2>{packageModal === "edit" ? "Edit Paket Shift" : "Tambah Macam Shift Baru"}</h2>
            <p className="ss-muted">
              Atur jam kerja, nama, dan pilih warna penanda sendiri untuk 1 paket shift ini (Maksimal 10 macam shift).
            </p>

            <div className="ss-fields">
              <div>
                <label>
                  Nama Paket Shift *
                  <input
                    aria-label="Nama paket shift"
                    placeholder="Contoh: Shift Pagi, Shift Lembur"
                    value={packageForm.name}
                    onChange={(e) => {
                      const val = e.target.value;
                      setPackageForm({ ...packageForm, name: val });
                      if (val.trim().length > MAX_PACKAGE_NAME_LEN) {
                        setPackageErrors({
                          ...packageErrors,
                          name: `Nama paket terlalu panjang (maksimal ${MAX_PACKAGE_NAME_LEN} karakter).`,
                        });
                      } else {
                        setPackageErrors({ ...packageErrors, name: void 0 });
                      }
                    }}
                    maxLength={MAX_PACKAGE_NAME_LEN + 10}
                  />
                </label>
                <span
                  className={`ss-char-counter ${
                    packageForm.name.length > MAX_PACKAGE_NAME_LEN
                      ? "error"
                      : packageForm.name.length >= MAX_PACKAGE_NAME_LEN - 3
                      ? "warning"
                      : ""
                  }`}
                >
                  {packageForm.name.length}/{MAX_PACKAGE_NAME_LEN} karakter
                </span>
                {packageErrors.name && (
                  <span className="field-error" style={{ display: "block", marginTop: "2px" }}>
                    {packageErrors.name}
                  </span>
                )}
              </div>

              <div>
                <label>
                  Label Singkat Kalender (Maks 10 huruf) *
                  <input
                    aria-label="Label singkat kalender"
                    placeholder="Contoh: Pagi, Siang, Lembur"
                    value={packageForm.shortName}
                    onChange={(e) => {
                      const val = e.target.value;
                      setPackageForm({ ...packageForm, shortName: val });
                      if (val.trim().length > MAX_SHORT_NAME_LEN) {
                        setPackageErrors({
                          ...packageErrors,
                          shortName: `Label singkat terlalu panjang (maksimal ${MAX_SHORT_NAME_LEN} karakter).`,
                        });
                      } else {
                        setPackageErrors({ ...packageErrors, shortName: void 0 });
                      }
                    }}
                    maxLength={MAX_SHORT_NAME_LEN + 5}
                  />
                </label>
                <span
                  className={`ss-char-counter ${
                    packageForm.shortName.length > MAX_SHORT_NAME_LEN
                      ? "error"
                      : packageForm.shortName.length >= MAX_SHORT_NAME_LEN - 2
                      ? "warning"
                      : ""
                  }`}
                >
                  {packageForm.shortName.length}/{MAX_SHORT_NAME_LEN} karakter
                </span>
                {packageErrors.shortName && (
                  <span className="field-error" style={{ display: "block", marginTop: "2px" }}>
                    {packageErrors.shortName}
                  </span>
                )}
              </div>
            </div>

            <div className="ss-fields" style={{ marginTop: "10px" }}>
              <label>
                Jam Mulai *
                <input
                  type="time"
                  aria-label="Jam mulai paket"
                  value={packageForm.startTime}
                  onChange={(e) => {
                    setPackageForm({ ...packageForm, startTime: e.target.value });
                    setPackageErrors({ ...packageErrors, startTime: void 0 });
                  }}
                />
                {packageErrors.startTime && (
                  <span className="field-error">{packageErrors.startTime}</span>
                )}
              </label>

              <label>
                Jam Selesai *
                <input
                  type="time"
                  aria-label="Jam selesai paket"
                  value={packageForm.endTime}
                  onChange={(e) => {
                    setPackageForm({ ...packageForm, endTime: e.target.value });
                    setPackageErrors({ ...packageErrors, endTime: void 0 });
                  }}
                />
                {packageErrors.endTime && (
                  <span className="field-error">{packageErrors.endTime}</span>
                )}
              </label>
            </div>

            {/* Pilihan Warna Penanda Sendiri (Custom Color Picker + Swatches) */}
            <div style={{ marginTop: "14px" }}>
              <label style={{ fontWeight: 600, fontSize: "13px", display: "block", marginBottom: "4px" }}>
                Pilih Warna Penanda Sendiri:
              </label>
              <div className="ss-color-picker-group">
                <div className="ss-color-input-wrapper">
                  <input
                    type="color"
                    className="ss-color-native-input"
                    value={packageForm.color.startsWith("#") ? packageForm.color : "#5c732b"}
                    onChange={(e) => setPackageForm({ ...packageForm, color: e.target.value })}
                    title="Klik untuk memilih warna kustom bebas"
                  />
                  <span style={{ fontFamily: "monospace", fontSize: "12px", fontWeight: 700 }}>
                    {packageForm.color}
                  </span>
                </div>

                <div className="ss-swatch-list">
                  {PRESET_HEX_SWATCHES.map((hex) => (
                    <button
                      key={hex}
                      type="button"
                      className={`ss-swatch-btn ${packageForm.color.toLowerCase() === hex.toLowerCase() ? "active" : ""}`}
                      style={{ backgroundColor: hex }}
                      onClick={() => setPackageForm({ ...packageForm, color: hex })}
                      title={`Pilih warna ${hex}`}
                    />
                  ))}
                </div>

                {/* Preview Chip Kalender */}
                <div style={{ marginLeft: "auto" }}>
                  <span
                    className="ss-cal-event"
                    style={{
                      borderLeft: `4px solid ${packageForm.color}`,
                      backgroundColor: `${packageForm.color}20`,
                      color: packageForm.color,
                      fontWeight: 700,
                      padding: "4px 10px",
                    }}
                  >
                    #{packageForm.icon || "1"} {packageForm.shortName || "Preview"} {packageForm.startTime}
                  </span>
                </div>
              </div>
            </div>

            <div style={{ marginTop: "14px" }}>
              <label style={{ fontWeight: 600, fontSize: "13px", display: "block", marginBottom: "6px" }}>
                Pilih Nomor Penanda Shift (1 – 10):
              </label>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                {PACKAGE_NUMBERS.map((num) => (
                  <button
                    key={num}
                    type="button"
                    className={`ss-preset-btn ${String(packageForm.icon) === num ? "active" : ""}`}
                    onClick={() => setPackageForm({ ...packageForm, icon: num })}
                    style={{ fontSize: "13.5px", fontWeight: 700, padding: "6px 14px", minWidth: "44px" }}
                  >
                    #{num}
                  </button>
                ))}
              </div>
            </div>

            <div className="ss-fields single" style={{ marginTop: "14px" }}>
              <label>
                Deskripsi Operasional
                <input
                  aria-label="Deskripsi operasional"
                  placeholder="Keterangan singkat fungsi shift ini..."
                  value={packageForm.description}
                  onChange={(e) =>
                    setPackageForm({ ...packageForm, description: e.target.value })
                  }
                  maxLength={120}
                />
              </label>
            </div>

            <div
              style={{
                marginTop: "14px",
                padding: "10px 14px",
                background: "#f8fafc",
                borderRadius: "8px",
                fontSize: "13px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span>Total Jam Kerja Paket Ini:</span>
              <strong style={{ color: "#5c732b" }}>
                {calculateDuration(packageForm.startTime, packageForm.endTime)}
              </strong>
            </div>

            <div className="ss-actions" style={{ marginTop: "24px" }}>
              {packageModal === "edit" && (
                <button
                  type="button"
                  className="dashboard-link ss-red"
                  style={{ marginRight: "auto", fontSize: "14px", fontWeight: 600, padding: "8px 0" }}
                  onClick={() => openDeletePackageConfirm(packageForm)}
                >
                  🗑️ Hapus Paket Shift Ini
                </button>
              )}
              <button
                type="button"
                className="inbound-secondary"
                onClick={() => setPackageModal(null)}
              >
                Batal
              </button>
              <button className="inbound-primary">Simpan Paket</button>
            </div>
          </form>
        </StaffDialog>
      )}

      {/* MODAL KONFIRMASI HAPUS PAKET SHIFT */}
      {packageModal === "delete" && packageToDelete && (
        <StaffDialog
          title="Hapus Paket Shift"
          onClose={() => setPackageModal(null)}
        >
          <h2>Konfirmasi Hapus Paket Shift</h2>
          <p className="ss-muted">
            Apakah Anda yakin ingin menghapus paket shift ini dari daftar macam-macam shift?
          </p>
          <div
            className="ss-inset"
            style={{ padding: "16px", marginBottom: "18px" }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span
                className="ss-pkg-num-badge"
                style={{
                  backgroundColor: `${packageToDelete.color || "#5c732b"}18`,
                  color: packageToDelete.color || "#5c732b",
                  borderColor: packageToDelete.color || "#5c732b",
                }}
              >
                #{packageToDelete.icon}
              </span>
              <div>
                <strong>{packageToDelete.name} ({packageToDelete.shortName})</strong>
                <p style={{ margin: "2px 0 0", fontSize: "13px", color: "var(--ss-muted)" }}>
                  Jam Kerja: {packageToDelete.startTime} – {packageToDelete.endTime}
                </p>
              </div>
            </div>
          </div>
          <p style={{ fontSize: "12px", color: "var(--ss-muted)", marginBottom: "16px" }}>
            Catatan: Jadwal shift staf yang sudah pernah dibuat di kalender sebelumnya tetap tersimpan di database.
          </p>
          <div className="ss-actions">
            <button
              type="button"
              className="inbound-secondary"
              onClick={() => setPackageModal("edit")}
            >
              Batal
            </button>
            <button
              type="button"
              className="ss-danger"
              onClick={confirmDeletePackage}
            >
              Hapus Paket
            </button>
          </div>
        </StaffDialog>
      )}

      {/* ========================================================================= */}
      {/* MODAL: JADWALKAN STAF ATAU EDIT PENUGASAN SHIFT                          */}
      {/* ========================================================================= */}
      {(shiftModal === "create" || shiftModal === "edit") && (
        <StaffDialog
          title={shiftModal === "edit" ? "Edit Penugasan Shift" : "Jadwalkan Staf"}
          onClose={() => setShiftModal(null)}
          wide={true}
        >
          <form onSubmit={saveShift} noValidate>
            <h2>{shiftModal === "edit" ? "Edit Penugasan Shift" : "Jadwalkan Staf"}</h2>
            <p className="ss-muted">
              {shiftModal === "edit"
                ? "Sesuaikan paket shift, tanggal, atau staf yang bertugas."
                : "Pilih tanggal, macam paket shift, dan staf yang bertugas."}
            </p>

            {/* Tanggal Shift */}
            <div style={{ marginBottom: "16px" }}>
              <label style={{ fontWeight: 600, fontSize: "13px", display: "block", marginBottom: "8px" }}>
                Tanggal Shift *
              </label>
              <input
                type="date"
                aria-label="Tanggal shift"
                value={shiftForm.shiftDate}
                onChange={(e) => {
                  setShiftForm({ ...shiftForm, shiftDate: e.target.value });
                  setShiftErrors({ ...shiftErrors, shiftDate: void 0, submit: void 0 });
                }}
                style={{ maxWidth: "260px" }}
              />
              {shiftErrors.shiftDate && (
                <span className="field-error">{shiftErrors.shiftDate}</span>
              )}
            </div>

            {/* Pilihan Paket Shift (Waktu otomatis mengikuti paket) */}
            <div style={{ marginBottom: "18px" }}>
              <label style={{ fontWeight: 600, fontSize: "13px", display: "block", marginBottom: "8px" }}>
                Pilih Macam Paket Shift *:
              </label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                {shiftPackages.map((pkg) => (
                  <button
                    key={pkg.id}
                    type="button"
                    className={`ss-preset-btn ${
                      shiftForm.packageId === pkg.id ? "active" : ""
                    }`}
                    onClick={() => selectShiftPackageInForm(pkg)}
                  >
                    #{pkg.icon || "1"} {pkg.name} ({pkg.startTime} – {pkg.endTime})
                  </button>
                ))}
              </div>
              {(() => {
                const selectedPkg = shiftPackages.find((p) => p.id === shiftForm.packageId) || shiftPackages[0];
                if (!selectedPkg) return null;
                return (
                  <div className="ss-selected-pkg-info">
                    ⏰ Jam Kerja Terpilih: <strong>#{selectedPkg.icon || "1"} {selectedPkg.name} ({selectedPkg.startTime} – {selectedPkg.endTime})</strong> · Durasi {calculateDuration(selectedPkg.startTime, selectedPkg.endTime)}
                  </div>
                );
              })()}
              {shiftErrors.package && (
                <span className="field-error">{shiftErrors.package}</span>
              )}
            </div>

            {/* PEMILIHAN STAF BERTUGAS */}
            {shiftModal === "edit" ? (
              <div style={{ marginTop: "16px" }}>
                <label style={{ fontWeight: 600, fontSize: "13px", display: "block", marginBottom: "8px" }}>
                  Staf Bertugas *
                </label>
                <select
                  aria-label="Pilih staf bertugas"
                  value={shiftForm.userId}
                  onChange={(e) => {
                    setShiftForm({ ...shiftForm, userId: e.target.value });
                    setShiftErrors({ ...shiftErrors, userId: void 0, submit: void 0 });
                  }}
                >
                  <option value="">-- Pilih Staf --</option>
                  {staff.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.fullName} ({s.role || "Staf"})
                    </option>
                  ))}
                </select>
                {shiftErrors.userId && (
                  <span className="field-error">{shiftErrors.userId}</span>
                )}
              </div>
            ) : (
              <div style={{ marginTop: "16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px", flexWrap: "wrap", gap: "8px" }}>
                  <label style={{ fontWeight: 600, fontSize: "13px", margin: 0 }}>
                    Staf Bertugas * <span style={{ fontWeight: 400, color: "#737b6c" }}>({shiftForm.userIds.length} staf terpilih)</span>
                  </label>
                  {shiftForm.selectMode === "name" && (
                    <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                      <button
                        type="button"
                        className="dashboard-link"
                        style={{ fontSize: "12px", fontWeight: 600 }}
                        onClick={selectAllStaff}
                      >
                        Pilih Semua
                      </button>
                      <span style={{ color: "#cbd5e1" }}>·</span>
                      <button
                        type="button"
                        className="dashboard-link"
                        style={{ fontSize: "12px", fontWeight: 600, color: "#64748b" }}
                        onClick={clearStaffSelection}
                      >
                        Batal Pilih
                      </button>
                    </div>
                  )}
                </div>

                {/* 2 Opsi Mode Pemilihan: Berdasarkan Nama vs Berdasarkan Role */}
                <div className="ss-staff-select-mode-toggle">
                  <button
                    type="button"
                    className={`ss-toggle-btn ${shiftForm.selectMode === "name" ? "active" : ""}`}
                    onClick={() => setShiftForm({ ...shiftForm, selectMode: "name" })}
                  >
                    👤 Berdasarkan Nama Staf
                  </button>
                  <button
                    type="button"
                    className={`ss-toggle-btn ${shiftForm.selectMode === "role" ? "active" : ""}`}
                    onClick={() => setShiftForm({ ...shiftForm, selectMode: "role" })}
                  >
                    🏷️ Berdasarkan Role Staf
                  </button>
                </div>

                {/* Opsi 1: Berdasarkan Nama Staf */}
                {shiftForm.selectMode === "name" && (
                  <div className="ss-staff-checklist">
                    {staff.map((s) => {
                      const isSelected = shiftForm.userIds.some((id) => Number(id) === Number(s.id));
                      const existingShift = shifts.find((sh) => {
                        const sDate = sh.shift_date ? String(sh.shift_date).slice(0, 10) : "";
                        return Number(sh.user_id) === Number(s.id) && sDate === shiftForm.shiftDate;
                      });

                      return (
                        <div
                          key={s.id}
                          className={`ss-staff-check-row ${isSelected ? "selected" : ""}`}
                          onClick={() => toggleStaffSelection(s.id)}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleStaffSelection(s.id)}
                              onClick={(e) => e.stopPropagation()}
                            />
                            <span style={{ fontWeight: 600, fontSize: "13px", color: "#191d17" }}>
                              {s.fullName}
                            </span>
                            <span className="ss-role-chip">
                              {s.role || "Staf"}
                            </span>
                          </div>
                          {existingShift && (
                            <span
                              className="ss-conflict-warning"
                              title={`Sudah terjadwal di hari yang sama: ${String(existingShift.start_time).slice(0, 5)}–${String(existingShift.end_time).slice(0, 5)}`}
                            >
                              ⚠️ Sudah Terjadwal ({String(existingShift.start_time).slice(0, 5)}–{String(existingShift.end_time).slice(0, 5)})
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Opsi 2: Berdasarkan Role Staf */}
                {shiftForm.selectMode === "role" && (
                  <div className="ss-staff-checklist">
                    {availableRoles.map((roleName) => {
                      const staffInRole = staff.filter((s) => (s.role || "Staf").toLowerCase() === roleName.toLowerCase());
                      const isSelected = isRoleFullySelected(roleName);
                      const hasAnySelected = staffInRole.some((s) => shiftForm.userIds.some((id) => Number(id) === Number(s.id)));
                      const conflictingInRole = staffInRole.filter((s) =>
                        shifts.some((sh) => {
                          const sDate = sh.shift_date ? String(sh.shift_date).slice(0, 10) : "";
                          return Number(sh.user_id) === Number(s.id) && sDate === shiftForm.shiftDate;
                        })
                      );

                      return (
                        <div
                          key={roleName}
                          className={`ss-staff-check-row ${isSelected ? "selected" : ""}`}
                          onClick={() => toggleRoleSelection(roleName)}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              ref={(el) => {
                                if (el) el.indeterminate = !isSelected && hasAnySelected;
                              }}
                              onChange={() => toggleRoleSelection(roleName)}
                              onClick={(e) => e.stopPropagation()}
                            />
                            <span style={{ fontWeight: 600, fontSize: "13px", color: "#191d17" }}>
                              {roleName}
                            </span>
                            <span style={{ fontSize: "12px", color: "#64748b" }}>
                              ({staffInRole.length} staf)
                            </span>
                          </div>
                          {conflictingInRole.length > 0 && (
                            <span className="ss-conflict-warning">
                              ⚠️ {conflictingInRole.length} staf sudah terjadwal
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {shiftErrors.userId && (
                  <span className="field-error" style={{ display: "block", marginTop: "6px" }}>
                    {shiftErrors.userId}
                  </span>
                )}
              </div>
            )}

            {conflictingStaffNames.length > 0 && (
              <div
                role="status"
                className="ss-conflict-banner"
                style={{
                  marginTop: "14px",
                  padding: "10px 14px",
                  borderRadius: "8px",
                  background: "#fef3c7",
                  border: "1px solid #fde68a",
                  color: "#92400e",
                  fontSize: "12.5px",
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                }}
              >
                <span style={{ fontSize: "18px" }}>⚠️</span>
                <div>
                  <strong>Notifikasi Jadwal Bersamaan:</strong> Staf berikut sudah memiliki jadwal shift pada tanggal {shiftForm.shiftDate}: <strong>{conflictingStaffNames.join(", ")}</strong>.
                </div>
              </div>
            )}

            {shiftErrors.submit && (
              <p role="alert" className="field-error" style={{ marginTop: "14px", padding: "8px 12px", background: "#fef2f2", borderRadius: "6px" }}>
                {shiftErrors.submit}
              </p>
            )}

            <div className="ss-actions" style={{ marginTop: "24px" }}>
              {shiftModal === "edit" && (
                <button
                  type="button"
                  className="dashboard-link ss-red"
                  style={{ marginRight: "auto", fontSize: "14px", fontWeight: 600, padding: "8px 0" }}
                  onClick={() => {
                    const target = shifts.find((s) => s.id === shiftForm.id) || shiftTarget;
                    if (target) {
                      setShiftTarget(target);
                      setShiftModal("delete");
                    }
                  }}
                >
                  🗑️ Hapus Shift Ini
                </button>
              )}
              <button
                type="button"
                className="inbound-secondary"
                onClick={() => setShiftModal(null)}
              >
                Batal
              </button>
              <button className="inbound-primary">
                {shiftModal === "edit" ? "Simpan Perubahan" : `Simpan Shift ${shiftForm.userIds.length > 0 ? `(${shiftForm.userIds.length} Staf)` : ""}`}
              </button>
            </div>
          </form>
        </StaffDialog>
      )}

      {/* MODAL KONFIRMASI HAPUS SHIFT */}
      {shiftModal === "delete" && shiftTarget && (
        <StaffDialog
          title="Hapus Shift Kerja"
          onClose={() => setShiftModal(null)}
        >
          <h2>Konfirmasi Hapus Shift</h2>
          <p className="ss-muted">
            Apakah Anda yakin ingin menghapus jadwal shift kerja ini dari database?
          </p>
          <div
            className="ss-inset"
            style={{ padding: "16px", marginBottom: "18px" }}
          >
            <strong>
              {shiftTarget.user_name || `Staf #${shiftTarget.user_id}`}
            </strong>
            <p style={{ margin: "4px 0 0", fontSize: "13px" }}>
              Tanggal: {managementDate(shiftTarget.shift_date, regional)} (
              {formatTime(shiftTarget.start_time)} –{" "}
              {formatTime(shiftTarget.end_time)})
            </p>
          </div>
          <div className="ss-actions">
            <button
              type="button"
              className="inbound-secondary"
              onClick={() => {
                setShiftModal("edit");
              }}
            >
              Batal
            </button>
            <button
              type="button"
              className="ss-danger"
              onClick={confirmDeleteShift}
            >
              Hapus Shift
            </button>
          </div>
        </StaffDialog>
      )}

      {/* ========================================================================= */}
      {/* MODAL: BUAT / EDIT ROLE                                                   */}
      {/* ========================================================================= */}
      {roleModal && (
        <StaffDialog
          title={editingRole ? "Edit Role Staf" : "Buat Role Staf Baru"}
          onClose={() => {
            setRoleModal(false);
            setEditingRole(null);
          }}
          wide={true}
        >
          <form onSubmit={saveRole} noValidate>
            <h2>{editingRole ? "Edit Role Staf" : "Buat Role Staf Baru"}</h2>
            <p className="ss-muted">
              {editingRole
                ? "Perbarui nama peran, deskripsi tugas, dan hak akses modul di SUSUNO."
                : "Definisikan posisi operasional baru dan hak akses modul di SUSUNO."}
            </p>

            <div className="ss-fields single">
              <label>
                Nama Role *
                <input
                  aria-label="Nama role"
                  placeholder="Contoh: Dok Supervisor, Forklift Specialist, QC Inspector"
                  value={roleForm.name}
                  onChange={(e) => {
                    setRoleForm({ ...roleForm, name: e.target.value });
                    setRoleErrors({ ...roleErrors, name: void 0 });
                  }}
                  maxLength={60}
                />
                {roleErrors.name && (
                  <span className="field-error">{roleErrors.name}</span>
                )}
              </label>

              <label>
                Deskripsi Tanggung Jawab *
                <textarea
                  aria-label="Deskripsi tanggung jawab role"
                  placeholder="Jelaskan ruang lingkup kerja dan tanggung jawab harian peran ini di gudang..."
                  rows={3}
                  value={roleForm.description}
                  onChange={(e) => {
                    setRoleForm({ ...roleForm, description: e.target.value });
                    setRoleErrors({ ...roleErrors, description: void 0 });
                  }}
                  maxLength={250}
                />
                {roleErrors.description && (
                  <span className="field-error">{roleErrors.description}</span>
                )}
              </label>
            </div>

            <div style={{ marginTop: "16px" }}>
              <label style={{ fontWeight: 600, fontSize: "13px", display: "block", marginBottom: "8px" }}>
                Pilih Hak Akses & Modul Operasional:
              </label>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                  gap: "10px",
                }}
              >
                {AVAILABLE_MODULES.map((mod) => {
                  const checked = roleForm.modules.includes(mod);
                  return (
                    <label
                      key={mod}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        padding: "8px 12px",
                        borderRadius: "8px",
                        border: "1px solid var(--ss-border, #dfe4d9)",
                        background: checked ? "#eef3e9" : "var(--ss-card, #fff)",
                        cursor: "pointer",
                        fontSize: "13px",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleRoleModule(mod)}
                      />
                      <span>{mod}</span>
                    </label>
                  );
                })}
              </div>
              {roleErrors.modules && (
                <span className="field-error" style={{ display: "block", marginTop: "6px" }}>
                  {roleErrors.modules}
                </span>
              )}
            </div>

            <div className="ss-actions" style={{ marginTop: "24px" }}>
              <button
                type="button"
                className="inbound-secondary"
                onClick={() => {
                  setRoleModal(false);
                  setEditingRole(null);
                }}
              >
                Batal
              </button>
              <button className="inbound-primary">
                {editingRole ? "Simpan Perubahan Role" : "Simpan Role Baru"}
              </button>
            </div>
          </form>
        </StaffDialog>
      )}

      {/* MODAL KONFIRMASI HAPUS ROLE */}
      {roleToDelete && (
        <StaffDialog
          title="Hapus Role Staf"
          onClose={() => setRoleToDelete(null)}
        >
          <h2>Konfirmasi Hapus Role</h2>
          <p className="ss-muted">
            Apakah Anda yakin ingin menghapus role ini dari sistem?
          </p>
          <div
            className="ss-inset"
            style={{ padding: "16px", marginBottom: "18px" }}
          >
            <strong>{roleToDelete.name}</strong>
            <p style={{ margin: "4px 0 0", fontSize: "13px", color: "var(--ss-muted)" }}>
              {roleToDelete.description}
            </p>
          </div>
          <p style={{ fontSize: "12px", color: "#e11d48", marginBottom: "16px", fontWeight: 600 }}>
            ⚠️ Peringatan: Staf yang saat ini terdaftar dengan role ini akan tetap memiliki akun, namun role tersebut tidak akan lagi tersedia di dropdown.
          </p>
          <div className="ss-actions">
            <button
              type="button"
              className="inbound-secondary"
              onClick={() => setRoleToDelete(null)}
            >
              Batal
            </button>
            <button
              type="button"
              className="ss-danger"
              onClick={confirmDeleteRole}
            >
              Hapus Role
            </button>
          </div>
        </StaffDialog>
      )}
    </ManagementShell>
  );
}

export { StaffManagement as default };
