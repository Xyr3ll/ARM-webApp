import React, { useEffect, useMemo, useState } from "react";
import "./Schedule.css";
import stiLogo from "../../assets/stilogo.png";
import { db } from "../../firebase";
import {
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";

const filterChips = [
  // kept for reference; UI below uses dynamic chips computed from props
];

const roomOptions = [
  // LABORATORY ROOMS
  "COMP LAB 101",
  "COMP LAB 601",
  "COMP LAB 602",
  "COMP LAB 603",
  "COMP LAB 604",
  "COMP LAB 605",
  "COMP LAB 606",
  "COMP LAB 607",
  "COMP LAB 609",
  // LECTURE ROOMS
  "ROOM 102",
  "ROOM 103",
  "ROOM 104",
  "ROOM 301",
  "ROOM 302",
  "ROOM 303",
  "ROOM 304",
  "ROOM 305",
  "ROOM 306",
  "ROOM 307",
  "ROOM 308",
  "ROOM 309",
  "ROOM 310",
  "ROOM 311",
  "ROOM 312",
  "ROOM 401",
  "ROOM 402",
  "ROOM 403",
  "ROOM 404",
  "ROOM 405",
  "ROOM 406",
  "ROOM 407",
  "ROOM 408",
  "ROOM 409-A",
  "ROOM 409-B",
  "ROOM 410",
  "ROOM 501",
  "ROOM 502",
  "ROOM 503",
  "ROOM 504",
  "ROOM 505",
  "ROOM 506",
  "ROOM 507",
  "ROOM 508",
  "ROOM 509",
  "ROOM 510",
  "ROOM 511",
  "ROOM 512",
  "ROOM 801",
  "ROOM 802",
  "ROOM 803",
  "ROOM 804",
  "ROOM 805",
  "ROOM 901",
  "ROOM 904",
  "ROOM 906",
];

// P.E. / GYM ROOMS
const peRooms = [
  "COURT",
  "PENTHOUSE",
];

const FullScheduleEditor = ({
  sectionId,
  sectionName,
  subjectsFromCurriculum = [],
  program,
  semester,
  yearLevel,
  year,
  isSubmitted = false,
}) => {
  const [draggedSubject, setDraggedSubject] = useState(null);
  const [draggedCellKey, setDraggedCellKey] = useState(null);
  const [search, setSearch] = useState("");
  const [schedule, setSchedule] = useState({});
  const [allSubjects, setAllSubjects] = useState(subjectsFromCurriculum);
  const [peerConflicts, setPeerConflicts] = useState({}); // { [day]: Array<{startIdx,endIdx,subject,section}> }

  // Compute chips from props so the header reflects selected program/year/semester
  const semLabel = useMemo(() => {
    const s = String(semester || "").toLowerCase();
    if (s.startsWith("2")) return "2nd Semester";
    if (s.startsWith("sum")) return "Summer";
    if (s.startsWith("1")) return "1st Semester";
    // already like '1st' / '2nd' / 'Summer'
    if (s === "1st") return "1st Semester";
    if (s === "2nd") return "2nd Semester";
    return semester || "";
  }, [semester]);
  const headerChips = useMemo(() => {
    const chips = [];
    if (program) chips.push({ label: String(program), color: "#2196f3" });
    const yl = yearLevel ? String(yearLevel) : "";
    const ylSem = [yl, semLabel].filter(Boolean).join(", ");
    if (ylSem) chips.push({ label: ylSem, color: "#2196f3" });
    return chips;
  }, [program, yearLevel, semLabel]);

  // Helpers to normalize subject shape coming from curriculum
  const getSubjectName = (s) => {
    if (typeof s === "string") return s;
    return s?.name || s?.courseName || s?.courseCode || "";
  };
  const parseName = (name) => {
    const raw = String(name || "");
    const lecMatch = /(.*)\(\s*lec\s*\)\s*$/i;
    const labMatch = /(.*)\(\s*lab\s*\)\s*$/i;
    if (labMatch.test(raw))
      return { base: raw.replace(labMatch, "$1").trim(), kind: "LAB" };
    if (lecMatch.test(raw))
      return { base: raw.replace(lecMatch, "$1").trim(), kind: "LEC" };
    return { base: raw.trim(), kind: null };
  };
  const findSubjectRecord = (name) => {
    const { base } = parseName(name);
    return allSubjects.find((s) => {
      const candidate = getSubjectName(s);
      const { base: cbase } = parseName(candidate);
      return cbase === base;
    });
  };
  const getCounts = (name) => {
    const { kind } = parseName(name);
    const r = findSubjectRecord(name) || {};
    const lec = Number(r?.lec ?? 0) || 0;
    const lab = Number(r?.lab ?? 0) || 0;
    const compLab = String(r?.compLab || "").toLowerCase() === "yes";
    // If name explicitly marks LEC or LAB, zero-out the other side for display/duration
    const out = { lec, lab, compLab, kind };
    if (kind === "LEC") out.lab = 0;
    if (kind === "LAB") out.lec = 0;
    return out;
  };

  // Subjects shown in sidebar = all subjects minus those already placed in the grid
  const placedSubjects = useMemo(
    () =>
      new Set(
        Object.values(schedule)
          .map((e) => e?.subject)
          .filter(Boolean)
      ),
    [schedule]
  );
  const sidebarSubjects = useMemo(
    () => allSubjects.filter((s) => !placedSubjects.has(getSubjectName(s))),
    [allSubjects, placedSubjects]
  );

  const times = useMemo(
    () => [
      "7:00AM",
      "7:30AM",
      "8:00AM",
      "8:30AM",
      "9:00AM",
      "9:30AM",
      "10:00AM",
      "10:30AM",
      "11:00AM",
      "11:30AM",
      "12:00PM",
      "12:30PM",
      "1:00PM",
      "1:30PM",
      "2:00PM",
      "2:30PM",
      "3:00PM",
      "3:30PM",
      "4:00PM",
      "4:30PM",
      "5:00PM",
      "5:30PM",
      "6:00PM",
      "6:30PM",
      "7:00PM",
      "7:30PM",
      "8:00PM",
      "8:30PM",
    ],
    []
  );
  const getTimeIndex = (t) => times.indexOf(t);

  // Visual row height for each 30-minute slot (in px)
  const ROW_HEIGHT = 40;

  const defaultSlots = 4; // 2 hours fallback
  // Duration from lec/lab counts (30-min slots): 1 class = 1 hour = 2 slots
  const getSlotsForSubject = (subjectName) => {
    const { lec, lab, compLab, kind } = getCounts(subjectName);
    let total = 0;
    if (kind === "LEC") {
      total = lec * 2;
    } else if (kind === "LAB") {
      total = lab * 2;
    } else {
      total = lec * 2 + (compLab ? lab * 2 : 0);
    }
    return Math.max(2, total || defaultSlots); // at least 1 hour
  };

  // Room option sets
  const labRooms = useMemo(
    () => roomOptions.filter((r) => r.toUpperCase().includes("LAB")),
    []
  );
  const lecRooms = useMemo(
    () => roomOptions.filter((r) => !r.toUpperCase().includes("LAB")),
    []
  );
  
  // Helper to check if subject is P.E.
  const isPESubject = (subjectName) => {
    const name = String(subjectName || "").toUpperCase();
    return name.includes("P.E") || name.includes("PE") || name.includes("PHYSICAL EDUCATION");
  };

  // Helper to check if subject is PATHFIT / PATHFIT 1-4 specifically
  const isPathfitSubject = (subjectName) => {
    const name = String(subjectName || "").toUpperCase();
    // Match exact PATHFIT keywords or patterns like 'PATHFIT 1', 'PATHFIT 2', etc.
    return /PATHFIT\s*(?:[1-4])?/.test(name) || name.includes("PATHFIT");
  };

  // Unified room options resolver: ensure P.E. and PATHFIT subjects only get peRooms (COURT, PENTHOUSE)
  const getRoomOptionsForSubject = (subjectName) => {
    const meta = getCounts(subjectName);
    // PATHFIT and P.E. must only use peRooms
    if (isPathfitSubject(subjectName) || isPESubject(subjectName)) return peRooms;
    const isLab = meta.kind === "LAB" || (meta.compLab && meta.lab > 0);
    return isLab ? labRooms : lecRooms;
  };

  // Load other sections' schedules for the same program/semester/yearLevel to prevent same-subject time overlaps across sections
  useEffect(() => {
    if (!program || !semester || !yearLevel) return;
    const q = query(
      collection(db, "schedules"),
      where("program", "==", String(program)),
      where("semester", "==", String(semester)),
      where("yearLevel", "==", String(yearLevel))
    );
    const unsub = onSnapshot(q, (snap) => {
      const map = {
        Monday: [],
        Tuesday: [],
        Wednesday: [],
        Thursday: [],
        Friday: [],
        Saturday: [],
      };
      snap.forEach((docSnap) => {
        const data = docSnap.data() || {};
        if (String(data.sectionName || "") === String(sectionName || ""))
          return; // skip current section
        if (String(data.status || "").toLowerCase() === "archived") return; // ignore archived
        const sched = data.schedule || {};
        for (const [key, v] of Object.entries(sched)) {
          if (!v || !v.subject) continue;
          const [day, startT] = String(key).split("_");
          if (!map[day]) continue;
          const sIdx = times.indexOf(v.startTime || startT);
          if (sIdx === -1) continue;
          let eIdx = -1;
          if (v.endTime) {
            eIdx = times.indexOf(v.endTime);
          } else {
            const slots = Number(v.durationSlots || 1);
            eIdx = sIdx + Math.max(1, slots);
          }
          if (eIdx < sIdx) eIdx = sIdx;
          map[day].push({
            startIdx: sIdx,
            endIdx: eIdx,
            subject: v.subject,
            room: v.room || '',
            section: data.sectionName || docSnap.id,
          });
        }
      });
      setPeerConflicts(map);
    });
    return () => unsub();
  }, [program, semester, yearLevel, sectionName, times]);

  // Load saved schedule (if any) for this section and semester; read from root schedules only
  useEffect(() => {
    if (!sectionId) return;
    const semKey = (() => {
      const s = String(semester || "").toLowerCase();
      if (s.startsWith("2")) return "2nd";
      if (s.startsWith("sum")) return "Summer";
      return "1st";
    })();
    const rootSpecificRef = doc(
      db,
      "schedules",
      `${String(sectionId)}_${semKey}`
    );
    const prune = (obj) => {
      const seen = new Set();
      const out = {};
      for (const [k, v] of Object.entries(obj || {})) {
        if (!v || !v.subject) continue;
        if (seen.has(v.subject)) continue;
        seen.add(v.subject);
        out[k] = v;
      }
      return out;
    };
    let primaryLoaded = false;
    const unsubRootSpecific = onSnapshot(rootSpecificRef, (snap) => {
      const data = snap.data();
      // If archived, do not load into calendar; allow fallback to try non-archived docs
      const isArchived =
        String(data?.status || "").toLowerCase() === "archived";
      if (
        data &&
        !isArchived &&
        data.schedule &&
        Object.keys(data.schedule || {}).length > 0
      ) {
        primaryLoaded = true;
        setSchedule(prune(data.schedule));
      } else {
        setSchedule({});
      }
    });
    // Fallback: find by sectionName + program + semester (and yearLevel) for older docs saved under a different sectionId
    let unsubFallback = () => {};
    if (sectionName) {
      const q = query(
        collection(db, "schedules"),
        where("program", "==", String(program || "")),
        where("semester", "==", String(semester || "")),
        where("sectionName", "==", String(sectionName || ""))
      );
      unsubFallback = onSnapshot(q, (snap) => {
        if (primaryLoaded) return; // prefer primary
        let used = false;
        snap.forEach((docSnap) => {
          const data = docSnap.data();
          const isArchived =
            String(data?.status || "").toLowerCase() === "archived";
          if (isArchived) return; // skip archived docs in fallback
          if (
            data &&
            data.schedule &&
            Object.keys(data.schedule || {}).length > 0
          ) {
            // If yearLevel filter is provided, match it
            if (
              yearLevel &&
              data.yearLevel &&
              String(data.yearLevel) !== String(yearLevel)
            )
              return;
            setSchedule(prune(data.schedule));
            used = true;
          }
        });
        if (!used) setSchedule({});
      });
    }
    return () => {
      unsubRootSpecific();
      try {
        unsubFallback();
      } catch {}
    };
  }, [sectionId, sectionName, program, semester, yearLevel]);

  // Keep subjects synced with curriculum when provided
  useEffect(() => {
    setAllSubjects(subjectsFromCurriculum);
  }, [subjectsFromCurriculum]);

  const handleDragStart = (subject, sourceCellKey = null) => {
    if (isSubmitted) return; // Prevent dragging if submitted
    setDraggedSubject(subject);
    setDraggedCellKey(sourceCellKey);
  };
  const handleDragEnd = () => {
    setDraggedSubject(null);
    setDraggedCellKey(null);
  };
  const handleDragOver = (e) => {
    if (isSubmitted) return; // Prevent drop zones if submitted
    e.preventDefault();
  };

  // When dragging a subject, return the peer conflict entry covering this time (room conflict across sections)
  const getPeerConflictAt = (day, timeIdx, roomToCheck) => {
    if (!roomToCheck) return null;
    const peers = peerConflicts[day] || [];
    return (
      peers.find(
        (p) =>
          String(p.room || '').toUpperCase() === String(roomToCheck || '').toUpperCase() &&
          timeIdx >= p.startIdx &&
          timeIdx <= p.endIdx
      ) || null
    );
  };

  const isCovered = (day, timeIdx) => {
    for (const [key, val] of Object.entries(schedule)) {
      const [d, t] = key.split("_");
      if (d !== day) continue;
      const startIdx = getTimeIndex(t);
      if (startIdx === -1) continue;

      const baseSlots =
        val?.durationSlots || getSlotsForSubject(val?.subject) || 1;
      const visualSlots = Math.min(baseSlots, times.length - startIdx);

      if (timeIdx >= startIdx && timeIdx < startIdx + visualSlots) return true;
    }
    return false;
  };

  const availableSlotsFrom = (day, startIdx, desiredSlots, excludeKey) => {
    const want = Math.max(1, Math.floor(Number(desiredSlots) || 1));
    let max = Math.min(want, times.length - startIdx);
    let nextStart = times.length;
    for (const [key] of Object.entries(schedule)) {
      if (key === excludeKey) continue;
      const [d, t] = key.split("_");
      if (d !== day) continue;
      const sIdx = getTimeIndex(t);
      if (sIdx > startIdx && sIdx < nextStart) nextStart = sIdx;
    }
    if (nextStart < times.length) max = Math.min(max, nextStart - startIdx);
    return Math.max(1, Math.floor(max));
  };

  const handleDrop = (e, time, day) => {
    e.preventDefault();
    if (isSubmitted) return; // Prevent drops if submitted
    const timeIdx = getTimeIndex(time);
    if (!draggedSubject || timeIdx === -1) return;
    const targetKey = `${day}_${time}`;
    const overlaps = (aStart, aEnd, bStart, bEnd) =>
      aStart <= bEnd && bStart <= aEnd;
    // Prevent placing the same subject more than once across the calendar
    if (!draggedCellKey) {
      const exists = Object.values(schedule).some(
        (v) => v?.subject === draggedSubject
      );
      if (exists) {
        alert(
          "This subject is already scheduled. Move the existing block instead of adding another."
        );
        setDraggedSubject(null);
        setDraggedCellKey(null);
        return;
      }
    }
    if (schedule[targetKey] || isCovered(day, timeIdx)) {
      setDraggedSubject(null);
      setDraggedCellKey(null);
      return;
    }
    // Compute intended slots for this placement (bounded by current section's own availability)
    const intendedSlots = (() => {
      // Always use subject-derived slots (ignore carried duration to avoid stale/float values)
      const desired = getSlotsForSubject(draggedSubject);
      return availableSlotsFrom(day, timeIdx, desired, draggedCellKey);
    })();
    
    // Note: Room conflict validation will happen after room is selected, not at drop time
    // Allow drop without room assignment first
    
    setSchedule((prev) => {
      const next = { ...prev };
      // Remove any existing occurrence of this subject first (global uniqueness)
      for (const [k, v] of Object.entries(next)) {
        if (k !== draggedCellKey && v?.subject === draggedSubject)
          delete next[k];
      }
      if (draggedCellKey && next[draggedCellKey]?.subject === draggedSubject) {
        const carried = next[draggedCellKey] || {};
        delete next[draggedCellKey];
        const slots = intendedSlots;
        next[targetKey] = {
          subject: draggedSubject,
          room: carried.room || "",
          durationSlots: slots,
        };
      } else {
        const slots = intendedSlots;
        next[targetKey] = {
          subject: draggedSubject,
          room: "",
          durationSlots: slots,
        };
      }
      return next;
    });
    setDraggedSubject(null);
    setDraggedCellKey(null);
  };

  const handleSidebarDrop = (e) => {
    e.preventDefault();
    if (isSubmitted) return; // Prevent removing subjects if submitted
    if (!draggedCellKey) {
      setDraggedSubject(null);
      setDraggedCellKey(null);
      return;
    }
    setSchedule((prev) => {
      const next = { ...prev };
      const entry = next[draggedCellKey];
      if (entry) {
        delete next[draggedCellKey];
      }
      return next;
    });
    setDraggedSubject(null);
    setDraggedCellKey(null);
  };

  const updateCellRoom = (cellKey, room) => {
    if (isSubmitted) return; // Prevent room changes if submitted
    setSchedule((prev) => ({
      ...prev,
      [cellKey]: { ...(prev[cellKey] || {}), room },
    }));
  };
  // No duration UI now; durationSlots still supported internally via drops/moves

  // Validate before submitting: every scheduled block must have a valid room
  const getSubmitValidationIssues = () => {
    const issues = [];
    for (const [key, v] of Object.entries(schedule || {})) {
      if (!v || !v.subject) continue;
      const [day, startTime] = key.split("_");
      const options = getRoomOptionsForSubject(v.subject);
      const valid = v.room && options.includes(v.room);
      if (!valid) issues.push({ day, startTime, subject: v.subject });
    }
    return issues;
  };

  const handleSubmit = async () => {
    const issues = getSubmitValidationIssues();
    if (issues.length > 0) {
      const preview = issues
        .slice(0, 6)
        .map((i) => `• ${i.subject} — ${i.day} ${i.startTime}`)
        .join("\n");
      const more = issues.length > 6 ? `\n…and ${issues.length - 6} more.` : "";
      alert(
        `Please select a room for the following before submitting:\n\n${preview}${more}`
      );
      return;
    }
    const ok = window.confirm("Submit this schedule now?");
    if (!ok) return;
    
    // Save the schedule first
    await handleSave();
    
    // Then mark it as submitted
    try {
      const semKey = (() => {
        const s = String(semester || "").toLowerCase();
        if (s.startsWith("2")) return "2nd";
        if (s.startsWith("sum")) return "Summer";
        return "1st";
      })();
      const rootRef = doc(db, "schedules", `${String(sectionId)}_${semKey}`);
      await setDoc(
        rootRef,
        { status: "submitted", updatedAt: serverTimestamp() },
        { merge: true }
      );
      alert("Schedule submitted successfully!");
    } catch (e) {
      alert("Failed to submit: " + (e?.message || e));
    }
  };

  const handleSave = async () => {
    if (!sectionId) return;
    try {
      const semKey = (() => {
        const s = String(semester || "").toLowerCase();
        if (s.startsWith("2")) return "2nd";
        if (s.startsWith("sum")) return "Summer";
        return "1st";
      })();
      const rootRef = doc(db, "schedules", `${String(sectionId)}_${semKey}`);
      // Prune duplicates and add endTime before persisting
      const pruned = (() => {
        const seen = new Set();
        const out = {};
        for (const [k, v] of Object.entries(schedule || {})) {
          if (!v || !v.subject) continue;
          if (seen.has(v.subject)) continue;
          seen.add(v.subject);
          // Calculate endTime from startTime + durationSlots
          const [day, startTime] = k.split("_");
          const startIdx = times.indexOf(startTime);
          // Normalize slots: integer and based on subject when missing/invalid
          let slots = Math.floor(Number(v.durationSlots));
          if (!slots || slots < 1)
            slots = Math.floor(Number(getSlotsForSubject(v.subject)) || 1);
          // For N slots of 30 minutes, endTime = times[startIdx + slots]
          const endTime =
            times[Math.min(startIdx + slots, times.length)] ||
            times[times.length - 1];
          out[k] = { ...v, durationSlots: slots, startTime, endTime };
        }
        return out;
      })();

      // --- Preserve professorAssignments if present ---

      // Correct Firestore doc fetch for web v9+ (use getDoc)
      let professorAssignments = undefined;
      try {
        const { getDoc } = await import('firebase/firestore');
        const existingSnap = await getDoc(rootRef);
        if (existingSnap.exists() && existingSnap.data().professorAssignments) {
          professorAssignments = existingSnap.data().professorAssignments;
        }
      } catch {}

      const payload = {
        schedule: pruned,
        sectionName: sectionName || "",
        program: program || "",
        semester: semester || "",
        yearLevel: yearLevel || "",
        year: year || "",
        updatedAt: serverTimestamp(),
      };
      if (professorAssignments) {
        payload.professorAssignments = professorAssignments;
      }
      await setDoc(rootRef, payload, { merge: false });
      alert("Schedule saved");
    } catch (e) {
      alert("Failed to save: " + (e?.message || e));
    }
  };

  // Archive function: set status to 'archived' in Firestore
  const archiveSchedule = async () => {
    if (!sectionId) return;
    try {
      const semKey = (() => {
        const s = String(semester || "").toLowerCase();
        if (s.startsWith("2")) return "2nd";
        if (s.startsWith("sum")) return "Summer";
        return "1st";
      })();
      const rootRef = doc(db, "schedules", `${String(sectionId)}_${semKey}`);

      // Prune current schedule like handleSave
      const pruned = (() => {
        const seen = new Set();
        const out = {};
        for (const [k, v] of Object.entries(schedule || {})) {
          if (!v || !v.subject) continue;
          if (seen.has(v.subject)) continue;
          seen.add(v.subject);
          const [day, startTime] = k.split("_");
          const startIdx = times.indexOf(startTime);
          let slots = Math.floor(Number(v.durationSlots));
          if (!slots || slots < 1)
            slots = Math.floor(Number(getSlotsForSubject(v.subject)) || 1);
          const endTime =
            times[Math.min(startIdx + slots, times.length)] ||
            times[times.length - 1];
          out[k] = { ...v, durationSlots: slots, startTime, endTime };
        }
        return out;
      })();

      // Preserve existing professorAssignments if present on the doc
      let professorAssignments = undefined;
      try {
        const { getDoc } = await import("firebase/firestore");
        const existingSnap = await getDoc(rootRef);
        if (existingSnap.exists() && existingSnap.data().professorAssignments) {
          professorAssignments = existingSnap.data().professorAssignments;
        }
      } catch (err) {
        console.error("Failed to fetch existing professorAssignments for archive:", err);
      }

      const payload = {
        schedule: pruned,
        sectionName: sectionName || "",
        program: program || "",
        semester: semester || "",
        yearLevel: yearLevel || "",
        year: year || "",
        status: "archived",
        updatedAt: serverTimestamp(),
      };
      if (professorAssignments) payload.professorAssignments = professorAssignments;

      // Write archived payload (overwrite to ensure schedule is present)
      await setDoc(rootRef, payload, { merge: false });
      alert("Schedule archived");
    } catch (e) {
      alert("Failed to archive: " + (e?.message || e));
    }
  };

  return (
    <div style={{ display: "flex", height: "100%", background: "#222" }}>
      {/* Sidebar */}
      <div
        style={{
          width: 320,
          background: "#2b2b2b",
          color: "#fff",
          padding: 16,
          display: "flex",
          flexDirection: "column",
          height: "100%",
          overflowY: "auto",
        }}
        onDrop={handleSidebarDrop}
        onDragOver={handleDragOver}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 16,
          }}
        >
          <img src={stiLogo} alt="STI" style={{ height: 32 }} />
          <span style={{ fontWeight: 700, fontSize: 18 }}>Subjects</span>
        </div>
        {/* Entire sidebar acts as drop target; removed dedicated drop zone design */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 12,
            width: "100%",
          }}
        >
          {sidebarSubjects
            .filter((s) => {
              const name = getSubjectName(s);
              return name.toLowerCase().includes(search.toLowerCase());
            })
            .map((subject) => {
              const name = getSubjectName(subject);
              const meta = getCounts(name);
              return (
                <div
                  key={name}
                  draggable={!isSubmitted}
                  onDragStart={() => !isSubmitted && handleDragStart(name)}
                  onDragEnd={handleDragEnd}
                  style={{
                    background: "#ffe600",
                    color: "#222",
                    fontWeight: "bold",
                    borderRadius: 8,
                    padding: "16px 8px",
                    textAlign: "center",
                    cursor: isSubmitted ? "not-allowed" : "grab",
                    boxShadow:
                      draggedSubject === name
                        ? "0 0 0 2px #1565c0"
                        : "0 2px 8px rgba(0,0,0,0.08)",
                    opacity: isSubmitted ? 0.6 : 1,
                  }}
                >
                  <div>{name}</div>
                  <div style={{ fontSize: 11, marginTop: 4, opacity: 0.85 }}>
                    {meta.kind === "LAB"
                      ? `Lab: ${meta.lab || 0}`
                      : meta.kind === "LEC"
                      ? `Lec: ${meta.lec || 0}`
                      : `Lec: ${meta.lec || 0}${
                          meta.compLab ? ` • Lab: ${meta.lab || 0}` : ""
                        }`}
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      {/* Main Content */}
      <div
        style={{
          flex: 1,
          background: "#fff",
          borderRadius: "0 0 8px 8px",
          padding: "32px 32px 0 32px",
          display: "flex",
          flexDirection: "column",
          height: "100%",
          minHeight: 0,
        }}
      >
        {/* Header */}
        <div
          style={{ display: "flex", alignItems: "center", marginBottom: 24 }}
        >
        </div>
        {/* Filter Chips */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 16,
          }}
        >
          {headerChips.map((chip) => (
            <span
              key={chip.label}
              style={{
                background: chip.color,
                color: "#fff",
                borderRadius: 16,
                padding: "6px 18px",
                fontWeight: 600,
                fontSize: 16,
              }}
            >
              {chip.label}
            </span>
          ))}
          {sectionName && (
            <span
              style={{
                background: "#2196f3",
                color: "#fff",
                borderRadius: 16,
                padding: "6px 18px",
                fontWeight: 700,
                fontSize: 16,
              }}
            >
              {sectionName}
            </span>
          )}
          {isSubmitted && (
            <span
              style={{
                background: "#4caf50",
                color: "#fff",
                borderRadius: 16,
                padding: "6px 18px",
                fontWeight: 700,
                fontSize: 16,
                marginLeft: 8,
              }}
            >
              SUBMITTED (READ-ONLY)
            </span>
          )}
        </div>

        {/* Schedule Grid - scrolls internally so footer stays visible */}
        <div style={{ width: "100%", overflow: "auto", flex: 1, minHeight: 0 }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontFamily: "Alata, sans-serif",
            }}
          >
            <thead>
              <tr>
                <th
                  style={{
                    border: "1px solid #ccc",
                    padding: "4px 8px",
                    background: "#f5f5f5",
                    fontWeight: 700,
                  }}
                >
                  Time
                </th>
                <th
                  style={{
                    border: "1px solid #ccc",
                    padding: "4px 8px",
                    background: "#f5f5f5",
                  }}
                >
                  Monday
                </th>
                <th
                  style={{
                    border: "1px solid #ccc",
                    padding: "4px 8px",
                    background: "#f5f5f5",
                  }}
                >
                  Tuesday
                </th>
                <th
                  style={{
                    border: "1px solid #ccc",
                    padding: "4px 8px",
                    background: "#f5f5f5",
                  }}
                >
                  Wednesday
                </th>
                <th
                  style={{
                    border: "1px solid #ccc",
                    padding: "4px 8px",
                    background: "#f5f5f5",
                  }}
                >
                  Thursday
                </th>
                <th
                  style={{
                    border: "1px solid #ccc",
                    padding: "4px 8px",
                    background: "#f5f5f5",
                  }}
                >
                  Friday
                </th>
                <th
                  style={{
                    border: "1px solid #ccc",
                    padding: "4px 8px",
                    background: "#f5f5f5",
                  }}
                >
                  Saturday
                </th>
              </tr>
            </thead>
            <tbody>
              {times.map((time, ti) => (
                <tr key={time}>
                  <td
                    style={{
                      border: "1px solid #ccc",
                      padding: "4px 8px",
                      fontWeight: "bold",
                      background: "#f5f5f5",
                      // Standardize each 30-min row height so rowSpan stacks precisely
                      height: ROW_HEIGHT,
                    }}
                  >
                    {time}
                  </td>
                  {[
                    "Monday",
                    "Tuesday",
                    "Wednesday",
                    "Thursday",
                    "Friday",
                    "Saturday",
                  ].map((day, i) => {
                    const cellKey = `${day}_${time}`;
                    const scheduled = schedule[cellKey];
                    // Don't show peer conflicts in empty cells anymore (room conflicts checked on room selection)
                    const peer = null;
                    const taken = false;
                    if (!scheduled && isCovered(day, ti)) return null;
                    const computedSpan = scheduled
                      ? Math.max(
                          1,
                          Math.floor(
                            scheduled.durationSlots ||
                              getSlotsForSubject(scheduled.subject) ||
                              1
                          )
                        )
                      : 1;
                    return (
                      <td
                        key={i}
                        // Render full duration in 30-minute slots (e.g., 3 hours = 6 slots)
                        rowSpan={computedSpan}
                        style={{
                          border: "1px solid #ccc",
                          padding: "4px 8px",
                          background: scheduled
                            ? "#ffe600"
                            : taken
                            ? "#ffebee"
                            : "#fff",
                          minWidth: 100,
                          // For unscheduled single cells, keep row height consistent; for scheduled blocks, let rowSpan control height
                          height: scheduled ? undefined : ROW_HEIGHT,
                          position: "relative",
                        }}
                        onDrop={(e) => handleDrop(e, time, day)}
                        onDragOver={handleDragOver}
                      >
                        {!scheduled && taken && (
                          <>
                            <div
                              style={{
                                position: "absolute",
                                inset: 2,
                                background: "rgba(255,205,210,0.35)",
                                border: "1px dashed #ef9a9a",
                                borderRadius: 6,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                textAlign: "center",
                                padding: 4,
                                pointerEvents: "none",
                              }}
                            >
                              <div style={{ lineHeight: 1.1 }}>
                                <div
                                  style={{
                                    fontSize: 11,
                                    fontWeight: 800,
                                    color: "#b71c1c",
                                  }}
                                >
                                  {peer?.subject}
                                </div>
                                {peer?.section && (
                                  <div
                                    style={{
                                      fontSize: 10,
                                      color: "#9c2b2b",
                                      marginTop: 2,
                                    }}
                                  >
                                    {peer.section}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div
                              style={{
                                position: "absolute",
                                top: 4,
                                right: 6,
                                background: "#ffcdd2",
                                color: "#b71c1c",
                                borderRadius: 4,
                                padding: "2px 6px",
                                fontSize: 10,
                                fontWeight: 800,
                                letterSpacing: 0.3,
                                pointerEvents: "none",
                              }}
                            >
                              Taken
                            </div>
                          </>
                        )}
                        {scheduled && (
                          <div
                            draggable={!isSubmitted}
                            onDragStart={() =>
                              !isSubmitted && handleDragStart(scheduled.subject, cellKey)
                            }
                            onDragEnd={handleDragEnd}
                            style={{
                              color: "#222",
                              fontWeight: "bold",
                              borderRadius: 0,
                              padding: "6px 6px",
                              textAlign: "center",
                              cursor: isSubmitted ? "default" : "grab",
                            }}
                          >
                            <div
                              style={{
                                fontSize: 12,
                                lineHeight: 1.1,
                                marginBottom: 6,
                              }}
                            >
                              {scheduled.subject}
                            </div>
                            {/* Show time range for quick verification */}
                            <div
                              style={{
                                fontSize: 11,
                                fontWeight: 700,
                                marginBottom: 6,
                              }}
                            >
                              {(() => {
                                const startIdx = getTimeIndex(time);
                                const slots = computedSpan; // use same computedSpan above
                                const endIdx = Math.min(
                                  startIdx + slots,
                                  times.length - 1
                                );
                                const endLabel =
                                  times[endIdx] || times[times.length - 1];
                                return `${time} - ${endLabel}`;
                              })()}
                            </div>
                            <div
                              style={{
                                display: "flex",
                                gap: 6,
                                justifyContent: "center",
                              }}
                            >
                              {(() => {
                                const meta = getCounts(scheduled.subject);
                                const isPE = isPESubject(scheduled.subject);
                                const isLab =
                                  meta.kind === "LAB" ||
                                  (meta.compLab && meta.lab > 0);
                                // Resolve options using unified helper (PATHFIT -> peRooms only)
                                const options = getRoomOptionsForSubject(scheduled.subject);
                                // If current room isn't allowed for type, show as empty
                                const value = options.includes(scheduled.room) ? scheduled.room : "";
                                
                                // Get occupied rooms for this time slot
                                const startIdx = getTimeIndex(time);
                                const slots = computedSpan;
                                const endIdx = Math.min(startIdx + slots - 1, times.length - 1);
                                const peers = peerConflicts[day] || [];
                                const occupiedRooms = new Set();
                                peers.forEach(p => {
                                  const timeOverlap = startIdx <= p.endIdx && p.startIdx <= endIdx;
                                  if (timeOverlap && p.room) {
                                    occupiedRooms.add(String(p.room).toUpperCase());
                                  }
                                });
                                
                                return (
                                  <select
                                    value={value}
                                    onChange={(e) =>
                                      updateCellRoom(cellKey, e.target.value)
                                    }
                                    disabled={isSubmitted}
                                    style={{
                                      appearance: "none",
                                      WebkitAppearance: "none",
                                      MozAppearance: "none",
                                      background: isSubmitted ? "#e0e0e0" : "#f5f5f5",
                                      border: "1px solid #c7c7c7",
                                      borderRadius: 6,
                                      padding: "2px 10px",
                                      fontWeight: 600,
                                      fontSize: 12,
                                      cursor: isSubmitted ? "not-allowed" : "pointer",
                                    }}
                                  >
                                    <option value="">Select room</option>
                                    {options.map((r) => {
                                      const isOccupied = occupiedRooms.has(String(r).toUpperCase());
                                      return (
                                        <option 
                                          key={r} 
                                          value={r}
                                          disabled={isOccupied}
                                          style={{
                                            color: isOccupied ? '#999' : 'inherit',
                                            fontStyle: isOccupied ? 'italic' : 'normal'
                                          }}
                                        >
                                          {r}{isOccupied ? ' (Occupied)' : ''}
                                        </option>
                                      );
                                    })}
                                  </select>
                                );
                              })()}
                            </div>
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!isSubmitted && (
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              marginTop: 16,
              paddingBottom: 16,
            }}
          >
            <button
              onClick={handleSubmit}
              style={{
                background: "#1565c0",
                color: "#fff",
                border: "none",
                borderRadius: 6,
                padding: "10px 32px",
                fontWeight: 700,
                fontSize: 18,
                letterSpacing: 1,
                boxShadow: "0 2px 8px rgba(21,101,192,0.12)",
                cursor: "pointer",
              }}
            >
              SUBMIT
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default FullScheduleEditor;
