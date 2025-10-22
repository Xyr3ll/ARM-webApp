import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { db } from "../../firebase";
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  where,
  serverTimestamp,
  doc,
  updateDoc,
  getDocs,
} from "firebase/firestore";
import "./FacultyLoading.css";

export default function AddFaculty() {
  const navigate = useNavigate();
  const location = useLocation();
  const editFaculty = location.state?.faculty || null;
  const [professor, setProfessor] = useState(editFaculty?.professor || "");
  const [profSuggestions, setProfSuggestions] = useState([]);
  const [showProfSuggestions, setShowProfSuggestions] = useState(false);
  const profInputRef = useRef();
  const [shift, setShift] = useState(editFaculty?.shift || "");
  const [program, setProgram] = useState(editFaculty?.program || "");
  const [semester, setSemester] = useState(editFaculty?.semester || "1st");
  const [courses, setCourses] = useState(
    editFaculty?.courses && editFaculty.courses.length > 0
      ? editFaculty.courses.map((c) => ({
          courseCode: c.courseCode || "",
          courseName: c.courseName || "",
          units: c.units || 0,
        }))
      : [{ courseCode: "", courseName: "", units: 0 }]
  );
  const [availableCourses, setAvailableCourses] = useState([]);
  const [courseSuggestionRow, setCourseSuggestionRow] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Autocomplete: fetch matching professors from users collection as user types
  useEffect(() => {
    if (!professor.trim()) {
      setProfSuggestions([]);
      return;
    }
    let ignore = false;
    const fetchSuggestions = async () => {
      const snap = await getDocs(collection(db, "users"));
      const matches = [];
      const search = professor.trim().toLowerCase();
      snap.forEach((doc) => {
        const data = doc.data();
        let candidate = "";
        if (
          typeof data.name === "string" &&
          data.name.toLowerCase().includes(search)
        ) {
          candidate = data.name;
        } else if (
          typeof data.professor === "string" &&
          data.professor.toLowerCase().includes(search)
        ) {
          candidate = data.professor;
        } else if (
          typeof data.fullName === "string" &&
          data.fullName.toLowerCase().includes(search)
        ) {
          candidate = data.fullName;
        } else if (
          typeof data.username === "string" &&
          data.username.toLowerCase().includes(search)
        ) {
          candidate = data.username;
        }
        if (candidate && !matches.includes(candidate)) {
          matches.push(candidate);
        }
      });
      if (!ignore) setProfSuggestions(matches);
    };
    fetchSuggestions();
    return () => {
      ignore = true;
    };
  }, [professor]);

  // Hide suggestions when clicking outside
  useEffect(() => {
    const handleClick = (e) => {
      if (profInputRef.current && !profInputRef.current.contains(e.target)) {
        setShowProfSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // ...existing code...
  useEffect(() => {
    // Require semester to filter rows, but allow program to be empty so users can search across programs
    if (!semester) {
      setAvailableCourses([]);
      return;
    }

    // Include archived and submitted curricula so older/archived curriculum rows still appear
    // If program is not selected, query all programs for submitted/archived docs to allow typing-wide search
    const q = program
      ? query(
          collection(db, "curriculum"),
          where("programCode", "==", program),
          where("status", "in", ["submitted", "archived"])
        )
      : query(
          collection(db, "curriculum"),
          where("status", "in", ["submitted", "archived"])
        );

    const unsub = onSnapshot(q, (snap) => {
      const coursesList = [];
      const seenCourses = new Set(); // Track unique courses to avoid duplicates

      snap.forEach((doc) => {
        const data = doc.data();

        // Handle array-based curriculum (rows array)
        if (Array.isArray(data.rows) && data.rows.length > 0) {
          data.rows.forEach((row) => {
            const rowSem = String(row?.semester || "").toLowerCase();
            const targetSem = String(semester).toLowerCase();
            const courseCode = row.courseCode || "";

            // Match semester and avoid duplicates
            if (
              (rowSem === targetSem || rowSem.startsWith(targetSem)) &&
              courseCode &&
              !seenCourses.has(courseCode)
            ) {
              seenCourses.add(courseCode);
              coursesList.push({
                courseCode: courseCode,
                courseName: row.courseName || "",
                units: parseFloat(row.units) || 0,
                lec: parseFloat(row.lec) || 0,
                lab: parseFloat(row.lab) || 0,
                compLab: row.compLab || "No",
                level: row.level || "",
                programCode: data.programCode || program,
              });
            }
          });
        }

        // Fallback: Handle legacy single-row document format (if rows array doesn't exist or is empty)
        if (!data.rows || data.rows.length === 0) {
          const docSem = String(data?.semester || "").toLowerCase();
          const targetSem = String(semester).toLowerCase();
          const courseCode = data.courseCode || "";

          if (
            (docSem === targetSem || docSem.startsWith(targetSem)) &&
            courseCode &&
            !seenCourses.has(courseCode)
          ) {
            seenCourses.add(courseCode);
            coursesList.push({
              courseCode: courseCode,
              courseName: data.courseName || "",
              units: parseFloat(data.units) || 0,
              lec: parseFloat(data.lec) || 0,
              lab: parseFloat(data.lab) || 0,
              compLab: data.compLab || "No",
              level: data.level || "",
              programCode: data.programCode || program,
            });
          }
        }
      });

      // Sort by course code for better UX
      coursesList.sort((a, b) => a.courseCode.localeCompare(b.courseCode));
      setAvailableCourses(coursesList);
    });

    return () => unsub();
  }, [program, semester]);

  const handleAddCourse = () => {
    setCourses((c) => [...c, { courseCode: "", courseName: "", units: 0 }]);
  };

  const handleRemoveCourse = (idx) => {
    setCourses((c) => c.filter((_, i) => i !== idx));
  };

  const handleCourseChange = (idx, courseCode) => {
    const selectedCourse = availableCourses.find(
      (c) => c.courseCode === courseCode
    );
    if (selectedCourse) {
      setCourses((c) =>
        c.map((row, i) =>
          i === idx
            ? {
                courseCode: selectedCourse.courseCode,
                courseName: selectedCourse.courseName,
                units: selectedCourse.units,
              }
            : row
        )
      );
    }
  };

  // Suggestions helpers for course name typing
  const getCourseSuggestions = (query) => {
    // If query is empty, return a limited set so user can browse options on focus
    if (!query) return availableCourses.slice(0, 200);
    const q = query.trim().toLowerCase();
    return availableCourses.filter(
      (c) =>
        (c.courseName || "").toLowerCase().includes(q) ||
        (c.courseCode || "").toLowerCase().includes(q)
    );
  };

  const handleCourseNameInput = (idx, value) => {
    setCourses((c) =>
      c.map((row, i) => (i === idx ? { ...row, courseName: value } : row))
    );
    setCourseSuggestionRow(idx);
  };

  const applyCourseSuggestion = (idx, course) => {
    setCourses((c) =>
      c.map((row, i) =>
        i === idx
          ? {
              courseCode: course.courseCode,
              courseName: course.courseName,
              units: course.units,
            }
          : row
      )
    );
    // update top-level program to match the selected course's programCode if available
    try {
      if (course.programCode && course.programCode !== program)
        setProgram(course.programCode);
    } catch (e) {}
    setCourseSuggestionRow(null);
  };

  // Close course suggestions when clicking outside inputs
  useEffect(() => {
    const handleClickOutside = (e) => {
      // if click is not inside an input or list item, close suggestions
      const tag = e.target && e.target.tagName;
      if (
        tag !== "INPUT" &&
        tag !== "LI" &&
        tag !== "OPTION" &&
        tag !== "SELECT"
      ) {
        setCourseSuggestionRow(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const calculateTotalUnits = () => {
    return courses.reduce(
      (sum, course) => sum + (parseFloat(course.units) || 0),
      0
    );
  };

  const validateForm = () => {
    if (!professor.trim()) {
      setError("Professor name is required");
      return false;
    }
    if (!shift) {
      setError("Please select a shift");
      return false;
    }
    if (!program) {
      setError("Please select a program");
      return false;
    }
    if (courses.some((c) => !c.courseCode)) {
      setError("Please select all course codes");
      return false;
    }

    const totalUnits = calculateTotalUnits();
    const maxUnits = shift === "FULL-TIME" ? 24 : 15;

    // Check part-time limit (strict)
    if (shift === "PART-TIME" && totalUnits > 15) {
      setError("Part-time faculty cannot exceed 15 units");
      return false;
    }

    // Check full-time overload limit
    if (shift === "FULL-TIME" && totalUnits > 30) {
      setError("Full-time faculty cannot exceed 30 units (including overload)");
      return false;
    }

    // Warn about overload for full-time (25+ units)
    if (shift === "FULL-TIME" && totalUnits >= 25) {
      const confirmed = window.confirm(
        `This faculty will be overloaded with ${totalUnits} units (exceeds 24 units limit). Continue?`
      );
      if (!confirmed) return false;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!validateForm()) return;

    setLoading(true);
    try {
      // Check if professor exists in users collection
      const snap = await getDocs(collection(db, "users"));
      const search = professor.trim().toLowerCase();
      let found = false;
      snap.forEach((doc) => {
        const data = doc.data();
        if (
          (typeof data.name === "string" &&
            data.name.toLowerCase() === search) ||
          (typeof data.professor === "string" &&
            data.professor.toLowerCase() === search) ||
          (typeof data.fullName === "string" &&
            data.fullName.toLowerCase() === search) ||
          (typeof data.username === "string" &&
            data.username.toLowerCase() === search)
        ) {
          found = true;
        }
      });
      if (!found) {
        setError("Professor name must match an existing user.");
        setLoading(false);
        return;
      }

      // Check for duplicate professor in faculty collection (case-insensitive).
      // Ignore archived entries and allow updating the same document when editing.
      const facultySnap = await getDocs(collection(db, "faculty"));
      const searchLower = professor.trim().toLowerCase();
      let duplicate = false;
      facultySnap.forEach((fDoc) => {
        const fData = fDoc.data();
        const fName = String(fData.professor || "")
          .trim()
          .toLowerCase();
        // ignore archived entries
        const isArchived = fData.status === "archived";
        if (!isArchived && fName && fName === searchLower) {
          // if editing, allow same document
          if (editFaculty && editFaculty.id && fDoc.id === editFaculty.id) {
            return;
          }
          duplicate = true;
        }
      });
      if (duplicate) {
        setError("A faculty with that name already exists.");
        setLoading(false);
        return;
      }

      const totalUnits = calculateTotalUnits();
      const payload = {
        professor: professor.trim(),
        shift,
        program,
        semester,
        courses,
        units: totalUnits,
        updatedAt: serverTimestamp(),
      };
      if (editFaculty && editFaculty.id) {
        // Update existing faculty document
        await updateDoc(doc(db, "faculty", editFaculty.id), payload);
        alert("Faculty updated successfully!");
      } else {
        // Add new faculty
        payload.createdAt = serverTimestamp();
        await addDoc(collection(db, "faculty"), payload);
        alert("Faculty added successfully!");
      }
      navigate(-1);
    } catch (err) {
      console.error("Error saving faculty:", err);
      setError("Failed to save faculty: " + (err.message || "Unknown error"));
    } finally {
      setLoading(false);
    }
  };

  const handleArchive = async () => {
    if (!editFaculty || !editFaculty.id) return;

    const confirmed = window.confirm(
      `Are you sure you want to archive ${professor}? This faculty member will be moved to the archive.`
    );

    if (!confirmed) return;

    setLoading(true);
    try {
      await updateDoc(doc(db, "faculty", editFaculty.id), {
        status: "archived",
        archivedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      alert("Faculty archived successfully!");
      navigate(-1);
    } catch (err) {
      console.error("Error archiving faculty:", err);
      setError(
        "Failed to archive faculty: " + (err.message || "Unknown error")
      );
    } finally {
      setLoading(false);
    }
  };

  const totalUnits = calculateTotalUnits();
  const maxUnits = shift === "FULL-TIME" ? 24 : shift === "PART-TIME" ? 15 : 0;
  const isOverLimit = shift && totalUnits > maxUnits;
  const isOverloaded = shift === "FULL-TIME" && totalUnits > 24;

  const pageTitle = editFaculty ? "Edit Faculty" : "Add Faculty";
  return (
    <div className="faculty-loading-container">
      <h3
        className="add-faculty-title"
        style={{ cursor: "pointer" }}
        onClick={() => navigate(-1)}
      >
        &lt; {pageTitle}
      </h3>
      <form onSubmit={handleSubmit}>
        <div className="add-faculty-grid">
          <div className="field">
            <label>Professor Name</label>
            <div style={{ position: "relative" }} ref={profInputRef}>
              <input
                value={professor}
                onChange={(e) => {
                  setProfessor(e.target.value);
                  setShowProfSuggestions(true);
                }}
                type="text"
                placeholder="Enter professor name"
                required
                autoComplete="off"
                onFocus={() => setShowProfSuggestions(true)}
                style={{ width: "100%" }}
              />
              {showProfSuggestions && profSuggestions.length > 0 && (
                <ul
                  style={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                    top: "100%",
                    background: "#fff",
                    border: "1px solid #ddd",
                    borderRadius: 6,
                    zIndex: 10,
                    maxHeight: 180,
                    overflowY: "auto",
                    margin: 0,
                    padding: 0,
                    listStyle: "none",
                    boxShadow: "0 2px 8px #0002",
                  }}
                >
                  {profSuggestions.map((name, idx) => (
                    <li
                      key={idx}
                      style={{
                        padding: "8px 16px",
                        cursor: "pointer",
                        borderBottom:
                          idx !== profSuggestions.length - 1
                            ? "1px solid #eee"
                            : "none",
                        fontWeight: 500,
                        color: "#1e3a8a",
                        background: name === professor ? "#f3f4f6" : "#fff",
                      }}
                      onMouseDown={() => {
                        setProfessor(name);
                        setShowProfSuggestions(false);
                      }}
                    >
                      {name}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          <div className="field">
            <label>Shift</label>
            <select
              value={shift}
              onChange={(e) => setShift(e.target.value)}
              required
            >
              <option value="">Select a shift</option>
              <option value="FULL-TIME">FULL-TIME</option>
              <option value="PART-TIME">PART-TIME</option>
            </select>
          </div>
        </div>

        <div className="add-faculty-grid">
          <div className="field">
            <label>Program Code</label>
            <select
              value={program}
              onChange={(e) => setProgram(e.target.value)}
              required
            >
              <option value="">Select a program</option>
              <option value="BSIT">BSIT</option>
              <option value="BSCS">BSCS</option>
              <option value="CPE">CPE</option>
            </select>
          </div>
          <div className="field">
            <label>Semester</label>
            <select
              value={semester}
              onChange={(e) => setSemester(e.target.value)}
              required
            >
              <option value="1st">1st Semester</option>
              <option value="2nd">2nd Semester</option>
            </select>
          </div>
        </div>

        {/* Total Units Display */}
        {shift && (
          <div
            style={{
              padding: "12px 16px",
              background: isOverLimit
                ? "#fee"
                : isOverloaded
                ? "#fff4e5"
                : "#f0f9ff",
              borderRadius: 8,
              marginBottom: 16,
              border: `2px solid ${
                isOverLimit ? "#ef4444" : isOverloaded ? "#f59e0b" : "#3b82f6"
              }`,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span style={{ fontWeight: 600, fontSize: 16 }}>
                Total Units:
              </span>
              <span
                style={{
                  fontWeight: 700,
                  fontSize: 18,
                  color: isOverLimit
                    ? "#ef4444"
                    : isOverloaded
                    ? "#f59e0b"
                    : "#000",
                }}
              >
                {totalUnits} / {maxUnits}
                {isOverloaded && (
                  <span style={{ fontSize: 14, marginLeft: 8 }}>
                    (OVERLOAD)
                  </span>
                )}
                {isOverLimit && shift === "PART-TIME" && (
                  <span style={{ fontSize: 14, marginLeft: 8 }}>
                    (EXCEEDED)
                  </span>
                )}
              </span>
            </div>
            {shift === "FULL-TIME" && (
              <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>
                Regular: 24 units | Maximum with overload: 30 units
              </div>
            )}
            {shift === "PART-TIME" && (
              <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>
                Maximum: 15 units (No overload allowed)
              </div>
            )}
          </div>
        )}

        {error && (
          <div
            style={{
              padding: "12px 16px",
              background: "#fee",
              color: "#c62828",
              borderRadius: 8,
              marginBottom: 16,
              border: "1px solid #ef4444",
            }}
          >
            {error}
          </div>
        )}

        <table
          className="faculty-loading-table"
          style={{
            width: "100%",
            tableLayout: "fixed",
            borderCollapse: "collapse",
          }}
        >
          <thead>
            <tr>
              <th style={{ textAlign: "left", padding: "12px 8px" }}>
                Course Name
              </th>
              <th style={{ width: 100, textAlign: "center" }}>Units</th>
              <th style={{ width: 110, textAlign: "center" }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {courses.map((course, idx) => (
              <tr key={idx} style={{ height: 56, verticalAlign: "middle" }}>
                <td
                  style={{
                    padding: "8px",
                    position: "relative",
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  <input
                    type="text"
                    value={course.courseName}
                    onChange={(e) => handleCourseNameInput(idx, e.target.value)}
                    onFocus={() => setCourseSuggestionRow(idx)}
                    placeholder="Type to search subjects (e.g., P.E)"
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      border: "1px solid #ccc",
                      borderRadius: 4,
                      height: 40,
                    }}
                  />
                  {courseSuggestionRow === idx &&
                    (() => {
                      const suggestions = getCourseSuggestions(
                        course.courseName
                      );
                      if (!suggestions || suggestions.length === 0) return null;
                      return (
                        <ul
                          style={{
                            position: "absolute",
                            left: 0,
                            right: 0,
                            top: "calc(100% + 4px)",
                            background: "#fff",
                            border: "1px solid #ddd",
                            borderRadius: 6,
                            zIndex: 10,
                            maxHeight: 200,
                            overflowY: "auto",
                            margin: 0,
                            padding: 0,
                            listStyle: "none",
                            boxShadow: "0 2px 8px #0002",
                          }}
                        >
                          {suggestions.map((s, si) => (
                            <li
                              key={si}
                              style={{
                                padding: "8px 16px",
                                cursor: "pointer",
                                borderBottom:
                                  si !== suggestions.length - 1
                                    ? "1px solid #eee"
                                    : "none",
                                fontWeight: 500,
                                color:
                                  s.courseName === course.courseName
                                    ? "#1e3a8a"
                                    : "inherit",
                                background:
                                  s.courseName === course.courseName
                                    ? "#f3f4f6"
                                    : "#fff",
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                              }}
                              onMouseDown={() => applyCourseSuggestion(idx, s)}
                            >
                              <div>
                                <div style={{ fontWeight: 700 }}>
                                  {s.courseName}
                                </div>
                                <div style={{ fontSize: 12, color: "#666" }}>
                                  {s.courseCode} • {s.programCode || ""}
                                </div>
                              </div>
                              <div style={{ fontWeight: 700 }}>
                                {s.units || 0}
                              </div>
                            </li>
                          ))}
                        </ul>
                      );
                    })()}
                </td>
                <td
                  style={{
                    width: 100,
                    textAlign: "center",
                    fontWeight: 600,
                    padding: "8px",
                    height: 56,
                    verticalAlign: "middle",
                  }}
                >
                  {course.units || 0}
                </td>
                <td
                  style={{
                    width: 110,
                    textAlign: "center",
                    padding: "8px",
                    height: 56,
                    verticalAlign: "middle",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "center",
                      gap: 8,
                    }}
                  >
                    <button
                      type="button"
                      className="btn green"
                      onClick={handleAddCourse}
                    >
                      +
                    </button>
                    {courses.length > 1 && (
                      <button
                        type="button"
                        className="btn danger"
                        onClick={() => handleRemoveCourse(idx)}
                      >
                        🗑
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="form-actions">
          <button type="submit" className="btn primary" disabled={loading}>
            {loading ? "SUBMITTING..." : "SUBMIT"}
          </button>
          <button type="button" className="btn" onClick={() => navigate(-1)}>
            Cancel
          </button>
          {editFaculty && editFaculty.id && (
            <button
              type="button"
              className="btn danger"
              onClick={handleArchive}
              disabled={loading}
              style={{ marginLeft: "auto" }}
            >
              🗄️ Archive
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
