import React, { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { db } from "../../firebase";
import { collection, addDoc, doc, updateDoc } from "firebase/firestore";
import "./Curriculum.css";
import { HiArrowLeft, HiPlus, HiTrash } from "react-icons/hi2";
import { useNavigate } from "react-router-dom";

const emptyRow = {
  year: "",
  semester: "",
  level: "",
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
  const [rows, setRows] = useState(
    initialRows && initialRows.length > 0 ? initialRows : [{ ...emptyRow }]
  );

  // Get current year for validation
  const currentYear = new Date().getFullYear();
  
  // Format year input as school year range (e.g., "2022-2023")
  const formatSchoolYear = (year) => {
    if (!year) return "";
    const yearNum = parseInt(year.split("-")[0]); // Get first year if already formatted
    if (isNaN(yearNum)) return "";
    return `${yearNum}-${yearNum + 1}`;
  };
  
  // Validate if school year is allowed (2000 to current year only)
  const isValidSchoolYear = (year) => {
    if (!year) return true; // Allow empty for now
    const yearNum = parseInt(year.split("-")[0]);
    if (isNaN(yearNum)) return false;
    // Allow 2000 to current year only
    return yearNum >= 2000 && yearNum <= currentYear;
  };

  // Fetch all rows from Firestore in edit mode
  useEffect(() => {
    if (mode === "edit" && docId) {
      import("firebase/firestore").then(({ getDoc, doc: fsDoc }) => {
        getDoc(fsDoc(db, "curriculum", docId)).then((snap) => {
          if (snap.exists()) {
            const data = snap.data();
            if (Array.isArray(data.rows) && data.rows.length > 0) {
              setRows(data.rows);
            } else {
              setRows([{ ...emptyRow, ...data }]);
            }
          }
        });
      });
    }
    // eslint-disable-next-line
  }, [mode, docId]);

  const addRow = async () => {
    const newRows = [...rows, { ...emptyRow }];
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
  };
  const removeRow = async (idx) => {
    const newRows = rows.length > 1 ? rows.filter((_, i) => i !== idx) : rows;
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
  };
  const update = async (idx, key, value) => {
    // Special handling for year field
    if (key === "year") {
      // Extract numeric year from input (e.g., "2022" from "2022-2023" or just "2022")
      const numericYear = value.replace(/[^0-9]/g, "").slice(0, 4);
      if (numericYear.length === 4) {
        const formatted = formatSchoolYear(numericYear);
        if (!isValidSchoolYear(formatted)) {
          alert(`School year must be between 2000 and ${currentYear} (e.g., 2022-2023, 2023-2024, ... ${currentYear}-${currentYear + 1}).`);
          return;
        }
        value = formatted;
      } else {
        value = numericYear; // Allow partial input while typing
      }
    }
    
    const newRows = rows.map((row, i) => (i === idx ? { ...row, [key]: value } : row));
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
  };

  const handleSave = async () => {
    // Validate all years are properly formatted
    const invalidYears = rows.filter(row => row.year && !isValidSchoolYear(row.year));
    if (invalidYears.length > 0) {
      alert(`Invalid school year format. Please use years from 2000 to ${currentYear} (e.g., 2022-2023, 2023-2024, ... ${currentYear}-${currentYear + 1}).`);
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
    // Validate all years are properly formatted
    const invalidYears = rows.filter(row => row.year && !isValidSchoolYear(row.year));
    if (invalidYears.length > 0) {
      alert(`Invalid school year format. Please use years from 2000 to ${currentYear} (e.g., 2022-2023, 2023-2024, ... ${currentYear}-${currentYear + 1}).`);
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
            onClick={() => navigate(-1)}
            aria-label="Back"
          >
            <HiArrowLeft />
          </button>
          <h2>{mode === "edit" ? "Edit Curriculum" : "Add Curriculum"}</h2>
        </div>
        <div className="curriculum-btn-group">
          <button className="curriculum-btn success" onClick={handleSave}>
            Archive
          </button>
          <button className="curriculum-btn primary" onClick={handleSubmit}>
            SUBMIT
          </button>
        </div>
      </div>

      <div className="curriculum-card curriculum-form-table">
        <div className="curriculum-form-header">
          <div>Action</div>
          <div>Year</div>
          <div>Semester</div>
          <div>Level</div>
          <div>Program Code</div>
          <div>Program Code</div>
          <div>Program Name</div>
          <div>Lec</div>
          <div>Lab</div>
          <div>Units</div>
          <div>Comp Lab</div>
        </div>

        {rows.map((row, idx) => (
          <div className="curriculum-form-row" key={idx}>
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
                title="Remove row"
              >
                <HiTrash />
              </button>
            </div>
            <input
              className="curriculum-input"
              value={row.year}
              onChange={(e) => update(idx, "year", e.target.value)}
              placeholder={`e.g., 2022, 2023, ... ${currentYear}`}
              maxLength="9"
            />
            <select
              className="curriculum-select"
              value={row.semester}
              onChange={(e) => update(idx, "semester", e.target.value)}
            >
              <option value="">Select</option>
              <option>1st</option>
              <option>2nd</option>
              <option>Summer</option>
            </select>
            <select
              className="curriculum-select"
              value={row.level}
              onChange={(e) => update(idx, "level", e.target.value)}
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
            />
            <input
              className="curriculum-input"
              value={row.courseName}
              onChange={(e) => update(idx, "courseName", e.target.value)}
              placeholder="Course Name"
            />
            <input
              type="number"
              className="curriculum-input"
              value={row.lec}
              onChange={(e) => update(idx, "lec", e.target.value)}
              placeholder="Lec (classes)"
              min="0"
            />
            <input
              type="number"
              className="curriculum-input"
              value={row.lab}
              onChange={(e) => update(idx, "lab", e.target.value)}
              placeholder="Lab (classes)"
              min="0"
            />
            <input
              className="curriculum-input"
              value={row.units}
              onChange={(e) => update(idx, "units", e.target.value)}
              placeholder="Units"
            />
            <select
              className="curriculum-select"
              value={row.compLab}
              onChange={(e) => update(idx, "compLab", e.target.value)}
            >
              <option value="">Select</option>
              <option>Yes</option>
              <option>No</option>
            </select>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AddCurriculum;
