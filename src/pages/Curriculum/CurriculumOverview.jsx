import React, { useEffect, useState } from 'react';
import { db } from '../../firebase';
import { collection, updateDoc, doc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import './Curriculum.css';
import { HiPlus, HiEye, HiArchiveBox } from 'react-icons/hi2';
import { useNavigate } from 'react-router-dom';

const CurriculumOverview = () => {
  const navigate = useNavigate();
  const [curriculums, setCurriculums] = useState([]);
  const PROGRAM_NAMES = {
    BSIT: 'Bachelor of Science in Information Technology',
    BSCS: 'Bachelor of Science in Computer Science',
    CPE: 'Bachelor of Science in Computer Engineering'
  };
  const getProgramName = (code, fallback) => PROGRAM_NAMES[code] || fallback || '';

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'curriculum'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Only show non-archived curriculums
      setCurriculums(data.filter(c => c.status !== 'archived'));
    });
    return () => unsub();
  }, []);

  // Group curriculums by year and program
  const groupedCurriculums = curriculums.reduce((acc, curr) => {
    const key = `${curr.year || 'Unknown'}_${curr.programCode || 'Unknown'}`;
    if (!acc[key]) {
      acc[key] = {
        year: curr.year,
        programCode: curr.programCode,
        programName: getProgramName(curr.programCode, curr.programName),
        id: curr.id,
        rows: curr.rows || [],
        totalSubjects: 0
      };
    }
    // Count total subjects from rows array
    if (Array.isArray(curr.rows)) {
      acc[key].totalSubjects = curr.rows.length;
    }
    return acc;
  }, {});

  const groupedArray = Object.values(groupedCurriculums);

  // Handler for View button
  const handleView = (curriculum) => {
    // Navigate to AddCurriculum in edit mode
    // Pass status to determine if curriculum is read-only (submitted) or editable (archived)
    navigate('add', { 
      state: { 
        initialRows: curriculum.rows, 
        docId: curriculum.id, 
        mode: 'edit',
        status: curriculum.status || 'submitted' // Pass the status
      } 
    });
  };

  // Handler for Archive button
  const handleArchive = async (curriculum) => {
    try {
      // Set status to 'archived' in Firestore
      const { id } = curriculum;
      await updateDoc(doc(db, 'curriculum', id), {
        status: 'archived',
        archivedAt: serverTimestamp()
      });
      alert('Curriculum archived!');
      // Optimistically remove from UI while realtime updates arrive
      setCurriculums((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      alert('Error archiving: ' + err.message);
    }
  };
  return (
    <div className="curriculum-content-wrap">
      <div className="curriculum-content-header">
        <h2>Academic Overview</h2>
        <button className="curriculum-btn primary" onClick={() => navigate('add')}><HiPlus /> Add Academic</button>
      </div>

      <div className="curriculum-card">
        <table style={{ width: '100%', borderCollapse: 'collapse', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
          <thead>
            <tr style={{ background: '#d3d3d3' }}>
              <th style={{ padding: '14px 0', fontWeight: 700, fontSize: 16 }}>ACADEMIC YEAR</th>
              <th style={{ padding: '14px 0', fontWeight: 700, fontSize: 16 }}>PROGRAM CODE</th>
              <th style={{ padding: '14px 0', fontWeight: 700, fontSize: 16 }}>PROGRAM NAME</th>
              <th style={{ padding: '14px 0', fontWeight: 700, fontSize: 16 }}>TOTAL SUBJECTS</th>
              <th style={{ padding: '14px 0', fontWeight: 700, fontSize: 16 }}>ACTION</th>
            </tr>
          </thead>
          <tbody>
            {groupedArray.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: '24px', textAlign: 'center', color: '#666' }}>
                  No Academic found. Click "Add Academic" to create one.
                </td>
              </tr>
            ) : (
              groupedArray.map((curr, idx) => {
                return (
                  <tr key={idx} style={{ background: idx % 2 === 0 ? '#fff' : '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                    <td style={{ padding: '18px 0', textAlign: 'center', fontWeight: 700, fontSize: 18, color: '#0a2f5c' }}>
                      {curr.year || 'N/A'}
                    </td>
                    <td style={{ padding: '18px 0', textAlign: 'center', fontWeight: 600, fontSize: 16 }}>
                      {curr.programCode || 'N/A'}
                    </td>
                    <td style={{ padding: '18px 0', textAlign: 'center', fontWeight: 600, fontSize: 15 }}>
                      {curr.programName || 'N/A'}
                    </td>
                    <td style={{ padding: '18px 0', textAlign: 'center', fontWeight: 600, fontSize: 16 }}>
                      {curr.totalSubjects} subjects
                    </td>
                    <td style={{ padding: '18px 0', textAlign: 'center' }}>
                      <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
                        <button className="curriculum-badge success" onClick={() => handleView(curr)}>
                          <HiEye /> View
                        </button>
                        <button className="curriculum-badge danger" onClick={() => handleArchive(curr)}>
                          <HiArchiveBox /> Archive
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default CurriculumOverview;
