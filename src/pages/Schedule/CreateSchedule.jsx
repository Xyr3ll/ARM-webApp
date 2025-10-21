import React, { useEffect, useMemo, useState } from 'react';
import FullScheduleEditor from './FullScheduleEditor';
import './Schedule.css';
import { HiPlus } from 'react-icons/hi2';
import { HiTrash } from 'react-icons/hi';
import { db } from '../../firebase';
import { addDoc, collection, deleteDoc, doc, onSnapshot, query, serverTimestamp, setDoc, where } from 'firebase/firestore';

const CreateSchedule = () => {
  const [year, setYear] = useState('2025-2026');
  const [program, setProgram] = useState('BSIT');
  const [semester, setSemester] = useState('1st Semester');
  const [activeSectionId, setActiveSectionId] = useState(null);
  const [activeSectionName, setActiveSectionName] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showAddSectionModal, setShowAddSectionModal] = useState(false);
  const [newSectionName, setNewSectionName] = useState('');
  const [sectionError, setSectionError] = useState('');
  const [draggedSubject, setDraggedSubject] = useState(null);
  const [pendingYearLevel, setPendingYearLevel] = useState('1st Year');
  const [activeYearLevel, setActiveYearLevel] = useState('1st Year');
  const [curriculumRows, setCurriculumRows] = useState([]);

  // Format year input as school year range (e.g., "2019-2020")
  const formatSchoolYear = (inputYear) => {
    if (!inputYear) return "";
    const yearNum = parseInt(inputYear.split("-")[0]); // Get first year if already formatted
    if (isNaN(yearNum)) return "";
    return `${yearNum}-${yearNum + 1}`;
  };

  // Handler for year input with auto-formatting
  const handleYearChange = (e) => {
    const value = e.target.value;
    // Extract numeric year from input (e.g., "2019" from "2019-2020" or just "2019")
    const numericYear = value.replace(/[^0-9]/g, "").slice(0, 4);
    if (numericYear.length === 4) {
      const formatted = formatSchoolYear(numericYear);
      setYear(formatted);
    } else {
      setYear(numericYear); // Allow partial input while typing
    }
  };

  // Real-time sections pulled from Firestore grouped by year level for the selected program
  const [sectionsByYear, setSectionsByYear] = useState({});
  const yearLevels = useMemo(() => ['1st Year', '2nd Year', '3rd Year', '4th Year'], []);

  // Map levels to numeric strings like curriculum uses
  const levelMap = useMemo(() => ({ '1st Year': '1', '2nd Year': '2', '3rd Year': '3', '4th Year': '4' }), []);

  // Compute which year levels have curriculum for the selected program/semester
  const hasCurrForLevel = useMemo(() => {
    const map = {};
    yearLevels.forEach((yl) => {
      const lv = levelMap[yl];
      map[yl] = curriculumRows.some((r) => String(r.level) === String(lv));
    });
    return map;
  }, [curriculumRows, yearLevels, levelMap]);

  useEffect(() => {
    const programDoc = doc(db, 'gradeLevelSection', program);
    const sectionsCol = collection(programDoc, 'sections');
    // Only show sections for the selected academic year and semester
    const q = query(
      sectionsCol,
      where('academicYear', '==', year),
      where('semester', '==', semester)
    );
    const unsub = onSnapshot(q, (snap) => {
      const grouped = {};
      snap.forEach((d) => {
        const data = d.data();
        const yl = data.yearLevel || 'Unassigned';
        if (!grouped[yl]) grouped[yl] = [];
        grouped[yl].push({ id: d.id, name: data.sectionName });
      });
      // Sort sections within each year level by name (client-side)
      Object.keys(grouped).forEach((yl) => {
        grouped[yl].sort((a, b) => a.name.localeCompare(b.name));
      });
      setSectionsByYear(grouped);
    });
    return () => unsub();
  }, [program, year, semester]);

  // Fetch curriculum rows (submitted) for selected program/year; filter semester at row-level to support mixed-semester rows in a document
  useEffect(() => {
    const semShort = semester.startsWith('1st') ? '1st' : (semester.startsWith('2nd') ? '2nd' : 'Summer');
    const startYear = (year || '').includes('-') ? (year || '').split('-')[0].trim() : (year || '').trim();
    const q = query(
      collection(db, 'curriculum'),
      where('programCode', '==', program),
      where('status', '==', 'submitted')
    );
    const unsub = onSnapshot(q, (snap) => {
      const flattened = [];
      snap.forEach((d) => {
        const data = d.data();
        if (Array.isArray(data.rows) && data.rows.length > 0) {
          data.rows.forEach((r, idx) => {
            const rowSem = String(r?.semester ?? '').toLowerCase();
            const targetSem = String(semShort).toLowerCase();
            const rowYear = String(r?.year ?? '');
            // Match either "2019" or "2019-2020" format
            const yearMatches = rowYear === startYear || rowYear === year || rowYear.startsWith(startYear + '-');
            if (rowSem === targetSem && yearMatches) {
              flattened.push({ ...r, _parentId: d.id, _rowIndex: idx });
            }
          });
        } else {
          // Legacy single-row document
          const docSem = String(data?.semester ?? '').toLowerCase();
          const targetSem = String(semShort).toLowerCase();
          const docYear = String(data?.year ?? '');
          const yearMatches = docYear === startYear || docYear === year || docYear.startsWith(startYear + '-');
          if (docSem === targetSem && yearMatches) {
            flattened.push({ id: d.id, ...data });
          }
        }
      });
      setCurriculumRows(flattened);
    });
    return () => unsub();
  }, [program, semester, year]);

  // Dedicated handler for semester dropdown: update state and reset modal/selection
  const handleSemesterChange = (e) => {
    const next = e.target.value;
    setSemester(next);
    // Close editor so new semester data is loaded when reopened
    if (showModal) setShowModal(false);
    setActiveSectionId(null);
    setActiveSectionName('');
  };

  const handleAddSection = (sectionId, targetYearLevel, sectionName) => {
    // If sectionId exists from list, open editor directly
    if (sectionId) {
      setActiveSectionId(sectionId);
      if (sectionName) setActiveSectionName(sectionName);
      if (targetYearLevel) setActiveYearLevel(targetYearLevel);
      setShowModal(true);
      return;
    }
    // Otherwise, open modal to input a new section name
    setNewSectionName('');
    setSectionError('');
    setPendingYearLevel(targetYearLevel || '1st Year');
    setShowAddSectionModal(true);
  };

  const submitNewSection = async () => {
    const valid = /^[A-Za-z]{2}\d{4}$/.test(newSectionName.trim());
    if (!valid) {
      setSectionError('Invalid format. Use 2 letters + 4 numbers (e.g., BT1101).');
      return;
    }
    try {
      // Ensure program doc exists, then add to subcollection 'sections'
      const programDoc = doc(db, 'gradeLevelSection', program);
      await setDoc(programDoc, { program }, { merge: true });
      const sectionsCol = collection(programDoc, 'sections');
      const docRef = await addDoc(sectionsCol, {
        sectionName: newSectionName.trim(),
        yearLevel: pendingYearLevel,
        academicYear: year,
        semester,
        createdAt: serverTimestamp(),
      });
      // Launch editor with the section name
      setActiveSectionId(docRef.id);
      setActiveSectionName(newSectionName.trim());
  setActiveYearLevel(pendingYearLevel);
      setShowAddSectionModal(false);
      setShowModal(true);
    } catch (e) {
      setSectionError(e.message || 'Failed to add section');
    }
  };

  // Drag and drop handlers
  const subjects = [
    'Mobile Systems & Technologies (LAB)',
    'Mobile Systems & Technologies (LEC)',
    'Information Assurance & Security (LAB)',
    'Information Assurance & Security (LEC)'
  ];
  const handleDragStart = (subject) => {
    setDraggedSubject(subject);
  };
  const handleDragEnd = () => {
    setDraggedSubject(null);
  };
  const handleDrop = (e, time, day) => {
    e.preventDefault();
    // TODO: Assign draggedSubject to grid cell (implement state)
    setDraggedSubject(null);
    alert(`Dropped '${draggedSubject}' on ${day} at ${time}`);
  };
  const handleDragOver = (e) => {
    e.preventDefault();
  };

  // Edit flow removed per request; Add continues to open the editor for the selected section

  const handleDelete = async (sectionId) => {
    const ok = window.confirm('Delete this section and its schedule? This cannot be undone.');
    if (!ok) return;
    try {
      const programDoc = doc(db, 'gradeLevelSection', program);
      const sectionDocRef = doc(programDoc, 'sections', String(sectionId));
      const nestedSchedDocRef = doc(sectionDocRef, 'schedule', 'calendar');
      const rootSchedDocRef = doc(db, 'schedules', String(sectionId));
      await Promise.all([
        // Delete schedule docs first (ignore if missing)
        deleteDoc(nestedSchedDocRef).catch(() => {}),
        deleteDoc(rootSchedDocRef).catch(() => {}),
        // Then delete the section document
        deleteDoc(sectionDocRef),
      ]);
      // If this section is currently open in the editor, close it
      if (activeSectionId === sectionId) {
        setShowModal(false);
        setActiveSectionId(null);
        setActiveSectionName('');
      }
      alert('Section deleted');
    } catch (e) {
      alert('Failed to delete: ' + (e?.message || e));
    }
  };

  return (
    <div className="schedule-content-wrap">
      <div className="schedule-header">
        <h2 className="schedule-title">Create Schedule</h2>
      </div>

      <div className="schedule-filters">
        <input
          type="text"
          className="schedule-input"
          value={year}
          onChange={handleYearChange}
          placeholder="e.g., 2019, 2020, 2025..."
          maxLength="9"
        />
        <select
          className="schedule-select"
          value={program}
          onChange={(e) => setProgram(e.target.value)}
        >
          <option value="BSIT">BSIT</option>
          <option value="BSCS">BSCS</option>
        </select>
        <select
          className="schedule-select"
          value={semester}
          onChange={handleSemesterChange}
        >
          <option value="1st Semester">1st Semester</option>
          <option value="2nd Semester">2nd Semester</option>
          <option value="Summer">Summer</option>
        </select>
        {year && (
          <button
            onClick={() => setYear('')}
            style={{
              background: '#ef4444',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              padding: '8px 16px',
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: 15
            }}
          >
            Clear Filter
          </button>
        )}
      </div>

      <h3 className="schedule-program-title">
        {program === 'BSIT' && `Bachelor of Science in Information Technology (${year} - ${semester})`}
        {program === 'BSCS' && `Bachelor of Science in Computer Science (${year} - ${semester})`}
      </h3>

      <div className="schedule-years-container">
        {yearLevels.map((yearLevel) => {
          const sectionList = sectionsByYear[yearLevel] || [];
          return (
          <div key={yearLevel} className="schedule-year-card">
            <div className="schedule-year-header">
              <h4 className="schedule-year-title">{yearLevel}</h4>
              <button
                className="schedule-add-section-btn"
                onClick={() => hasCurrForLevel[yearLevel] && handleAddSection(null, yearLevel)}
                disabled={!hasCurrForLevel[yearLevel]}
                title={!hasCurrForLevel[yearLevel] ? 'No submitted curriculum for this year level and semester' : 'Add Section'}
                style={!hasCurrForLevel[yearLevel] ? { opacity: 0.6, cursor: 'not-allowed' } : undefined}
              >
                Add Section
              </button>
            </div>
            {!hasCurrForLevel[yearLevel] && (
              <div style={{ color: '#888', fontSize: 12, marginTop: 6 }}>
                Cannot add section: curriculum not submitted for {yearLevel} ({semester}).
              </div>
            )}
            <div className="schedule-sections-table">
              <div className="schedule-table-header">
                <div>SECTION</div>
                <div>ACTION</div>
              </div>
              {sectionList.map((section) => (
                <div key={section.id} className="schedule-section-row">
                  <div className="schedule-section-name">{section.name}</div>
                  <div className="schedule-actions">
                    <button
                      className="schedule-action-btn add"
                      onClick={() => handleAddSection(section.id, yearLevel, section.name)}
                      title="Open to add schedule entries"
                    >
                      <HiPlus /> Add
                    </button>
                    {/* Edit button removed */}
                    <button
                      className="schedule-action-btn delete"
                      onClick={() => handleDelete(section.id)}
                    >
                      <HiTrash /> Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          );
        })}
      </div>

      {/* Add Section Modal */}
      {showAddSectionModal && (
        <div style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.35)', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center'}}>
          <div style={{background:'#fff', borderRadius:10, padding:24, width:420, boxShadow:'0 8px 24px rgba(0,0,0,0.2)'}}>
            <h3 style={{marginTop:0, marginBottom:12}}>Add Section</h3>
            <div style={{display:'flex', gap:12}}>
              <div style={{flex:1}}>
                <label style={{display:'block', fontWeight:600, marginBottom:6}}>Program</label>
                <input value={program} disabled style={{width:'100%', padding:'10px 12px', border:'1px solid #ccc', borderRadius:8, fontSize:16, background:'#f5f5f5'}} />
              </div>
              <div style={{flex:1}}>
                <label style={{display:'block', fontWeight:600, marginBottom:6}}>Year Level</label>
                <input value={pendingYearLevel} disabled style={{width:'100%', padding:'10px 12px', border:'1px solid #ccc', borderRadius:8, fontSize:16, background:'#f5f5f5'}} />
              </div>
            </div>
            <label style={{display:'block', fontWeight:600, marginBottom:6}}>Section Name</label>
            <input
              type="text"
              placeholder="e.g., BT1101"
              value={newSectionName}
              onChange={(e)=>{ setNewSectionName(e.target.value.toUpperCase()); setSectionError(''); }}
              style={{width:'100%', padding:'10px 12px', border:'1px solid #ccc', borderRadius:8, fontSize:16}}
            />
            {sectionError && <div style={{color:'#c62828', marginTop:8, fontSize:13}}>{sectionError}</div>}
            <div style={{display:'flex', justifyContent:'flex-end', gap:8, marginTop:16}}>
              <button onClick={()=>setShowAddSectionModal(false)} style={{background:'#e0e0e0', border:'none', padding:'8px 16px', borderRadius:6, cursor:'pointer'}}>Cancel</button>
              <button onClick={submitNewSection} style={{background:'#1565c0', color:'#fff', border:'none', padding:'8px 16px', borderRadius:6, cursor:'pointer'}}>Continue</button>
            </div>
          </div>
        </div>
      )}

      {/* Show FullScheduleEditor as modal */}
      {showModal && (
        <div style={{position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.25)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
          <div style={{position: 'relative', width: '90vw', height: '90vh', background: 'transparent'}}>
            <button onClick={() => setShowModal(false)} style={{position: 'absolute', top: 16, right: 16, background: '#eee', border: 'none', borderRadius: '50%', width: 32, height: 32, fontSize: 18, cursor: 'pointer', zIndex: 10000}}>×</button>
            <FullScheduleEditor
              sectionId={activeSectionId}
              sectionName={activeSectionName}
              yearLevel={activeYearLevel}
              program={program}
              semester={(semester.startsWith('1st') ? '1st' : (semester.startsWith('2nd') ? '2nd' : 'Summer'))}
              year={year}
              subjectsFromCurriculum={(() => {
                // Map '1st Year' -> '1', etc.
                const levelMap = { '1st Year': '1', '2nd Year': '2', '3rd Year': '3', '4th Year': '4' };
                const levelVal = levelMap[activeYearLevel] || undefined;
                const rows = levelVal ? curriculumRows.filter(r => String(r.level) === String(levelVal)) : curriculumRows;
                // Build subjects list with subjectHours metadata
                const list = [];
                rows.forEach(r => {
                  const hours = parseFloat(r.subjectHours) || 3;
                  const base = r.courseName || r.courseCode || '';
                  const payload = {
                    hours,
                    courseName: r.courseName,
                    courseCode: r.courseCode,
                    lec: r.lec,
                    lab: r.lab,
                    compLab: r.compLab,
                  };
                  if (parseInt(r.lec) > 0) list.push({ name: `${base} (LEC)`, ...payload });
                  if (parseInt(r.lab) > 0) list.push({ name: `${base} (LAB)`, ...payload });
                });
                return list;
              })()}
            />
          </div>
        </div>
      )}

      {/* View modal removed */}
    </div>
  );
};

export default CreateSchedule;
