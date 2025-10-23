import React, { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { db } from "../../firebase";
import { collection, addDoc, doc, updateDoc } from "firebase/firestore";
import "./Curriculum.css";
import { HiArrowLeft, HiPlus, HiTrash } from "react-icons/hi2";
import { useNavigate } from "react-router-dom";

const emptyRow = {
  year: "", // Curriculum year (e.g., 2022) - identifies which curriculum version
  semester: "",
  level: "", // Year level (1, 2, 3, 4)
  programCode: "",
  courseCode: "",
  courseName: "",
  lec: "",
  lab: "",
  units: "",
  compLab: "",
};

const AddCurriculum = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const initialRows = location.state?.initialRows;
  const docId = location.state?.docId;
  const mode = location.state?.mode || (docId ? "edit" : "add");
  const status = location.state?.status; // Get curriculum status
  const isSubmitted = status === "submitted"; // Read-only if submitted
  const [rows, setRows] = useState(
    initialRows && initialRows.length > 0 ? initialRows : [{ ...emptyRow }]
  );
  // Track original row count for submitted curriculums (to determine which rows are newly added)
  const [originalRowCount] = useState(initialRows?.length || 0);

  // Allowed curriculum years (explicit range)
  const ALLOWED_YEAR_START = 2022;
  const ALLOWED_YEAR_END = 2026;

  // Validate curriculum year (only allow years 2022 through 2026)
  const isValidYear = (year) => {
    if (!year) return true; // Allow empty for now
    const yearNum = parseInt(year);
    if (isNaN(yearNum)) return false;
    return yearNum >= ALLOWED_YEAR_START && yearNum <= ALLOWED_YEAR_END;
  };
  
  // Generate school year based on curriculum year and level
  // Example: Curriculum 2022, Level 1 → School Year 2022-2023
  //          Curriculum 2022, Level 2 → School Year 2023-2024
  const generateSchoolYear = (curriculumYear, level) => {
    if (!curriculumYear || !level) return "";
    const yearNum = parseInt(curriculumYear);
    const levelNum = parseInt(level);
    if (isNaN(yearNum) || isNaN(levelNum)) return "";
    const schoolYearStart = yearNum + (levelNum - 1);
    return `${schoolYearStart}-${schoolYearStart + 1}`;
  };

  // Check if newly added rows are completely filled out
  const hasIncompleteNewRows = () => {
    if (!isSubmitted) return false; // Only check for submitted curriculums
    
    const newRows = rows.slice(originalRowCount); // Get only newly added rows
    if (newRows.length === 0) return false; // No new rows added
    
    // Check if any new row has empty required fields
    return newRows.some(row => 
      !row.year || 
      !row.semester || 
      !row.level || 
      !row.programCode || 
      !row.courseCode || 
      !row.courseName || 
      !row.lec || 
      !row.lab || 
      !row.units || 
      !row.compLab
    );
  };

  // Handle back button with validation
  const handleBack = () => {
    if (hasIncompleteNewRows()) {
      const confirmLeave = window.confirm(
        "You have incomplete new subjects. Please complete all fields or remove the incomplete rows before leaving.\n\nDo you want to leave anyway? (Incomplete rows will not be saved)"
      );
      if (!confirmLeave) return;
    }
    navigate(-1);
  };

  // Fetch all rows from Firestore in edit mode
  useEffect(() => {
    if (mode === "edit" && docId) {
      import("firebase/firestore").then(({ getDoc, doc: fsDoc }) => {
        getDoc(fsDoc(db, "curriculum", docId)).then((snap) => {
          if (snap.exists()) {
            const data = snap.data();
            if (Array.isArray(data.rows) && data.rows.length > 0) {
              // Fix: Auto-propagate year and programCode from first row to all rows
              const baseYear = data.rows[0]?.year || data.year || "";
              const baseProgramCode = data.rows[0]?.programCode || data.programCode || "";
              
              const fixedRows = data.rows.map(row => ({
                ...row,
                year: row.year || baseYear,           // Fill empty year with base year
                programCode: row.programCode || baseProgramCode  // Fill empty programCode
              }));
              
              setRows(fixedRows);
            } else {
              setRows([{ ...emptyRow, ...data }]);
            }
          }
        });
      });
    }
    // eslint-disable-next-line
  }, [mode, docId]);

  // Prevent navigation if there are incomplete new rows
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasIncompleteNewRows()) {
        e.preventDefault();
        e.returnValue = ''; // Required for Chrome
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [rows, isSubmitted, originalRowCount]);

  const addRow = () => {
    // Allow adding new rows even for submitted curriculums
    // Automatically copy year and programCode from first row to new row
    const baseYear = rows.length > 0 && rows[0].year ? rows[0].year : "";
    const baseProgramCode = rows.length > 0 && rows[0].programCode ? rows[0].programCode : "";
    const newRow = { 
      ...emptyRow, 
      year: baseYear,           // Copy curriculum year
      programCode: baseProgramCode  // Copy program code
    };
    const newRows = [...rows, newRow];
    setRows(newRows);
    
    // For NON-submitted curriculums, auto-save when adding a row
    if (mode === "edit" && docId && !isSubmitted) {
      updateDoc(doc(db, "curriculum", docId), {
        ...newRows[0],
        rows: newRows,
        updatedAt: new Date(),
      }).catch(err => {
        alert("Error updating curriculum: " + err.message);
      });
    }
  };

  // Save newly added subjects for submitted curriculums
  const handleSaveNewSubjects = async () => {
    // Validate newly added rows are complete
    if (hasIncompleteNewRows()) {
      alert("Please complete all fields for the new subjects before saving.");
      return;
    }

    // Get only newly added rows
    const newRows = rows.slice(originalRowCount);
    if (newRows.length === 0) {
      alert("No new subjects to save.");
      return;
    }

    // Check for duplicates in new rows
    const courseCodes = rows.map(r => r.courseCode?.trim().toUpperCase()).filter(Boolean);
    const duplicateCodes = courseCodes.filter((code, idx) => courseCodes.indexOf(code) !== idx);
    if (duplicateCodes.length > 0) {
      alert(`Duplicate course code found: ${duplicateCodes.join(', ')}. Each course code must be unique within the curriculum.`);
      return;
    }

    const courseNames = rows.map(r => r.courseName?.trim().toUpperCase()).filter(Boolean);
    const duplicateNames = courseNames.filter((name, idx) => courseNames.indexOf(name) !== idx);
    if (duplicateNames.length > 0) {
      alert(`Duplicate course name found: ${duplicateNames.join(', ')}. Each course name must be unique within the curriculum.`);
      return;
    }

    try {
      await updateDoc(doc(db, "curriculum", docId), {
        rows: rows,
        updatedAt: new Date(),
      });
      alert(`${newRows.length} new subject(s) saved successfully!`);
      navigate(-1); // Go back after successful save
    } catch (err) {
      alert("Error saving new subjects: " + err.message);
    }
  };
  const removeRow = async (idx) => {
    // Prevent deletion of ORIGINAL rows if curriculum is submitted
    // But allow deletion of NEWLY ADDED rows (idx >= originalRowCount)
    if (isSubmitted && idx < originalRowCount) {
      alert("Cannot delete existing subjects from a submitted curriculum. You can only delete newly added subjects.");
      return;
    }
    
    const newRows = rows.length > 1 ? rows.filter((_, i) => i !== idx) : rows;
    setRows(newRows);
    
    // Auto-save only for NON-submitted curriculums
    if (mode === "edit" && docId && !isSubmitted) {
      try {
        await updateDoc(doc(db, "curriculum", docId), {
          ...newRows[0],
          rows: newRows,
          updatedAt: new Date(),
        });
      } catch (err) {
        alert("Error updating curriculum: " + err.message);
      }
    }
  };
  const update = async (idx, key, value) => {
    // Prevent editing ORIGINAL rows if curriculum is submitted
    // But allow editing NEWLY ADDED rows (idx >= originalRowCount)
    if (isSubmitted && idx < originalRowCount) {
      alert("Cannot edit existing subjects in a submitted curriculum. You can only edit newly added subjects.");
      return;
    }
    
    // Real-time duplicate validation for courseCode
    if (key === "courseCode" && value.trim()) {
      const normalizedValue = value.trim().toUpperCase();
      const hasDuplicate = rows.some((row, i) => 
        i !== idx && row.courseCode?.trim().toUpperCase() === normalizedValue
      );
      if (hasDuplicate) {
        alert(`Course code "${value}" already exists in this curriculum. Please use a unique course code.`);
        return;
      }
    }
    
    // Real-time duplicate validation for courseName
    if (key === "courseName" && value.trim()) {
      const normalizedValue = value.trim().toUpperCase();
      const hasDuplicate = rows.some((row, i) => 
        i !== idx && row.courseName?.trim().toUpperCase() === normalizedValue
      );
      if (hasDuplicate) {
        alert(`Course name "${value}" already exists in this curriculum. Please use a unique course name.`);
        return;
      }
    }
    
    // Special handling for year field - only allow 4-digit curriculum year
    if (key === "year") {
      const numericYear = value.replace(/[^0-9]/g, "").slice(0, 4);
      if (numericYear.length === 4) {
        if (!isValidYear(numericYear)) {
          alert(`Curriculum year must be between 2000 and ${currentYear} (e.g., 2022, 2023, 2024, ... ${currentYear}).`);
          return;
        }
      }
      value = numericYear; // Store as simple year (e.g., "2022")
      
      // If updating year on first row, propagate to ALL rows
      if (idx === 0 && !isSubmitted) {
        const newRows = rows.map(row => ({ ...row, year: value }));
        setRows(newRows);
        if (mode === "edit" && docId) {
          try {
            await updateDoc(doc(db, "curriculum", docId), {
              ...newRows[0],
              rows: newRows,
              updatedAt: new Date(),
            });
          } catch (err) {
            alert("Error updating curriculum: " + err.message);
          }
        }
        return;
      }
    }
    
    // Special handling for programCode - propagate to all rows if updated on first row
    if (key === "programCode" && idx === 0 && !isSubmitted) {
      const newRows = rows.map(row => ({ ...row, programCode: value }));
      setRows(newRows);
      if (mode === "edit" && docId) {
        try {
          await updateDoc(doc(db, "curriculum", docId), {
            ...newRows[0],
            rows: newRows,
            updatedAt: new Date(),
          });
        } catch (err) {
          alert("Error updating curriculum: " + err.message);
        }
      }
      return;
    }
    
    const newRows = rows.map((row, i) => (i === idx ? { ...row, [key]: value } : row));
    setRows(newRows);
    
    // Auto-save only for NON-submitted curriculums
    if (mode === "edit" && docId && !isSubmitted) {
      try {
        await updateDoc(doc(db, "curriculum", docId), {
          ...newRows[0],
          rows: newRows,
          updatedAt: new Date(),
        });
      } catch (err) {
        alert("Error updating curriculum: " + err.message);
      }
    }
  };

  const handleSave = async () => {
    // Validate all curriculum years
    const invalidYears = rows.filter(row => row.year && !isValidYear(row.year));
    if (invalidYears.length > 0) {
      alert(`Invalid curriculum year. Please use years from ${ALLOWED_YEAR_START} to ${ALLOWED_YEAR_END} (e.g., ${ALLOWED_YEAR_START}, ${ALLOWED_YEAR_START + 1}, ... ${ALLOWED_YEAR_END}).`);
      return;
    }
    
    // Check for duplicate course codes
    const courseCodes = rows.map(r => r.courseCode?.trim().toUpperCase()).filter(Boolean);
    const duplicateCodes = courseCodes.filter((code, idx) => courseCodes.indexOf(code) !== idx);
    if (duplicateCodes.length > 0) {
      alert(`Duplicate course code found: ${duplicateCodes.join(', ')}. Each course code must be unique within the curriculum.`);
      return;
    }
    
    // Check for duplicate course names
    const courseNames = rows.map(r => r.courseName?.trim().toUpperCase()).filter(Boolean);
    const duplicateNames = courseNames.filter((name, idx) => courseNames.indexOf(name) !== idx);
    if (duplicateNames.length > 0) {
      alert(`Duplicate course name found: ${duplicateNames.join(', ')}. Each course name must be unique within the curriculum.`);
      return;
    }
    
    try {
      if (docId) {
        // Update existing document
        await updateDoc(doc(db, "curriculum", docId), {
          ...rows[0],
          rows,
          status: "archived",
          updatedAt: new Date(),
        });
        alert("Curriculum draft updated in Firestore!");
        navigate("/dashboard/academic-head/curriculum");
      } else {
        // Create a single document containing all rows (archive)
        await addDoc(collection(db, "curriculum"), {
          ...rows[0],
          rows,
          status: "archived",
          createdAt: new Date(),
        });
        alert("Curriculum archived to Firestore!");
        navigate("/dashboard/academic-head/curriculum");
      }
    } catch (err) {
      alert("Error saving draft: " + err.message);
    }
  };

  const handleSubmit = async () => {
    // Validate all curriculum years
    const invalidYears = rows.filter(row => row.year && !isValidYear(row.year));
    if (invalidYears.length > 0) {
      alert(`Invalid curriculum year. Please use years from ${ALLOWED_YEAR_START} to ${ALLOWED_YEAR_END} (e.g., ${ALLOWED_YEAR_START}, ${ALLOWED_YEAR_START + 1}, ... ${ALLOWED_YEAR_END}).`);
      return;
    }
    
    // Check for duplicate course codes
    const courseCodes = rows.map(r => r.courseCode?.trim().toUpperCase()).filter(Boolean);
    const duplicateCodes = courseCodes.filter((code, idx) => courseCodes.indexOf(code) !== idx);
    if (duplicateCodes.length > 0) {
      alert(`Duplicate course code found: ${duplicateCodes.join(', ')}. Each course code must be unique within the curriculum.`);
      return;
    }
    
    // Check for duplicate course names
    const courseNames = rows.map(r => r.courseName?.trim().toUpperCase()).filter(Boolean);
    const duplicateNames = courseNames.filter((name, idx) => courseNames.indexOf(name) !== idx);
    if (duplicateNames.length > 0) {
      alert(`Duplicate course name found: ${duplicateNames.join(', ')}. Each course name must be unique within the curriculum.`);
      return;
    }
    
    try {
      if (docId) {
        // Update existing document
        await updateDoc(doc(db, "curriculum", docId), {
          ...rows[0],
          rows,
          status: "submitted",
          updatedAt: new Date(),
        });
        alert("Curriculum submitted in Firestore!");
        navigate("/dashboard/academic-head/curriculum");
      } else {
        // Create a single document containing all rows (submit)
        await addDoc(collection(db, "curriculum"), {
          ...rows[0],
          rows,
          status: "submitted",
          createdAt: new Date(),
        });
        alert("Curriculum submitted to Firestore!");
        navigate("/dashboard/academic-head/curriculum");
      }
    } catch (err) {
      alert("Error submitting: " + err.message);
    }
  };

  return (
    <div className="curriculum-content-wrap">
      <div className="curriculum-content-header">
        <div className="curriculum-header-row">
          <button
            className="curriculum-back-btn"
            onClick={handleBack}
            aria-label="Back"
          >
            <HiArrowLeft />
          </button>
          <h2>
            {isSubmitted ? "View Academic (Read and Add only)" : mode === "edit" ? "Edit Academic" : "Add Academic"}
          </h2>
        </div>
        {isSubmitted ? (
          <div className="curriculum-btn-group">
            <button 
              className="curriculum-btn primary" 
              onClick={handleSaveNewSubjects}
              disabled={rows.length <= originalRowCount}
              style={{ opacity: rows.length <= originalRowCount ? 0.5 : 1 }}
            >
              Save New Subjects
            </button>
          </div>
        ) : (
          <div className="curriculum-btn-group">
            <button className="curriculum-btn success" onClick={handleSave}>
              Archive
            </button>
            <button className="curriculum-btn primary" onClick={handleSubmit}>
              SUBMIT
            </button>
          </div>
        )}
      </div>

      <div className="curriculum-card curriculum-form-table">
        <div className="curriculum-form-header">
          <div>Action</div>
          <div>Year</div>
          <div>Semester</div>
          <div>Level</div>
          <div>Program Code</div>
          <div>Course Code</div>
          <div>Course Name</div>
          <div>Lec</div>
          <div>Lab</div>
          <div>Units</div>
          <div>Comp Lab</div>
        </div>

        {rows.map((row, idx) => {
          const isOriginalRow = isSubmitted && idx < originalRowCount;
          const isNewRow = isSubmitted && idx >= originalRowCount;
          
          return (
            <div 
              className="curriculum-form-row" 
              key={idx} 
              style={{ 
                opacity: isOriginalRow ? 0.7 : 1,
                background: isNewRow ? '#fffbeb' : undefined // Light yellow for new rows
              }}
            >
              <div className="curriculum-action-cell">
                <button
                  className="curriculum-icon-btn add"
                  onClick={addRow}
                  title="Add row"
                >
                  <HiPlus />
                </button>
                <button
                  className="curriculum-icon-btn danger"
                  onClick={() => removeRow(idx)}
                  title={isOriginalRow ? "Cannot delete existing subjects" : "Remove row"}
                  disabled={isOriginalRow}
                  style={{ opacity: isOriginalRow ? 0.5 : 1, cursor: isOriginalRow ? 'not-allowed' : 'pointer' }}
                >
                  <HiTrash />
                </button>
              </div>
              <input
                className="curriculum-input"
                value={row.year}
                onChange={(e) => update(idx, "year", e.target.value)}
                placeholder={`e.g., ${ALLOWED_YEAR_START} - ${ALLOWED_YEAR_END}`}
                maxLength="4"
                title={row.level ? `School Year: ${generateSchoolYear(row.year, row.level)}` : "Curriculum Year"}
                disabled={isOriginalRow}
                readOnly={isOriginalRow}
              />
              <select
                className="curriculum-select"
                value={row.semester}
                onChange={(e) => update(idx, "semester", e.target.value)}
                disabled={isOriginalRow}
              >
                <option value="">Select</option>
                <option>1st</option>
                <option>2nd</option>
              </select>
              <select
                className="curriculum-select"
                value={row.level}
                onChange={(e) => update(idx, "level", e.target.value)}
                disabled={isOriginalRow}
              >
                <option value="">Select</option>
                <option>1</option>
                <option>2</option>
                <option>3</option>
                <option>4</option>
              </select>
              <select
                className="curriculum-select"
                value={row.programCode}
                onChange={(e) => update(idx, "programCode", e.target.value)}
                disabled={isOriginalRow}
              >
                <option value="">Select</option>
                <option>BSIT</option>
                <option>BSCS</option>
                <option>CPE</option>
              </select>
              <input
                className="curriculum-input"
                value={row.courseCode}
                onChange={(e) => update(idx, "courseCode", e.target.value)}
                placeholder="Code"
                disabled={isOriginalRow}
                readOnly={isOriginalRow}
              />
              <input
                className="curriculum-input"
                value={row.courseName}
                onChange={(e) => update(idx, "courseName", e.target.value)}
                placeholder="Course Name"
                disabled={isOriginalRow}
                readOnly={isOriginalRow}
              />
              <input
                type="number"
                className="curriculum-input"
                value={row.lec}
                onChange={(e) => update(idx, "lec", e.target.value)}
                placeholder="Lec (classes)"
                min="0"
                disabled={isOriginalRow}
                readOnly={isOriginalRow}
              />
              <input
                type="number"
                className="curriculum-input"
                value={row.lab}
                onChange={(e) => update(idx, "lab", e.target.value)}
                placeholder="Lab (classes)"
                min="0"
                disabled={isOriginalRow}
                readOnly={isOriginalRow}
              />
              <input
                className="curriculum-input"
                value={row.units}
                onChange={(e) => update(idx, "units", e.target.value)}
                placeholder="Units"
                disabled={isOriginalRow}
                readOnly={isOriginalRow}
              />
              <select
                className="curriculum-select"
                value={row.compLab}
                onChange={(e) => update(idx, "compLab", e.target.value)}
                disabled={isOriginalRow}
              >
                <option value="">Select</option>
                <option>Yes</option>
                <option>No</option>
              </select>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AddCurriculum;
