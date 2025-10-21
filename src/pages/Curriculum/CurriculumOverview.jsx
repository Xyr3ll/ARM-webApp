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

  // Handler for View button
  const handleView = (curriculum) => {
    // Navigate to AddCurriculum but in edit mode
    navigate('add', { state: { initialRows: [curriculum], docId: curriculum.id, mode: 'edit' } });
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
        <h2>Curriculum Overview</h2>
        <button className="curriculum-btn primary" onClick={() => navigate('add')}><HiPlus /> Add Curriculum</button>
      </div>

      <div className="curriculum-card">
        <table style={{ width: '100%', borderCollapse: 'collapse', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
          <thead>
            <tr style={{ background: '#d3d3d3' }}>
              <th style={{ padding: '14px 0', fontWeight: 700, fontSize: 16 }}>YEAR</th>
              <th style={{ padding: '14px 0', fontWeight: 700, fontSize: 16 }}>PROGRAM CODE</th>
              <th style={{ padding: '14px 0', fontWeight: 700, fontSize: 16 }}>PROGRAM NAME</th>
              <th style={{ padding: '14px 0', fontWeight: 700, fontSize: 16 }}>LEC</th>
              <th style={{ padding: '14px 0', fontWeight: 700, fontSize: 16 }}>LAB</th>
              <th style={{ padding: '14px 0', fontWeight: 700, fontSize: 16 }}>UNITS</th>
              <th style={{ padding: '14px 0', fontWeight: 700, fontSize: 16 }}>COMP LAB</th>
              <th style={{ padding: '14px 0', fontWeight: 700, fontSize: 16 }}>ACTION</th>
            </tr>
          </thead>
          <tbody>
            {curriculums.map((curr, idx) => (
              <tr key={idx} style={{ background: '#fff' }}>
                <td style={{ padding: '16px 0', textAlign: 'center', fontWeight: 600 }}>{curr.year}</td>
                <td style={{ padding: '16px 0', textAlign: 'center', fontWeight: 600 }}>{curr.programCode}</td>
                <td style={{ padding: '16px 0', textAlign: 'center', fontWeight: 600 }}>{getProgramName(curr.programCode, curr.programName)}</td>
                <td style={{ padding: '16px 0', textAlign: 'center', fontWeight: 600 }}>{curr.lec}</td>
                <td style={{ padding: '16px 0', textAlign: 'center', fontWeight: 600 }}>{curr.lab}</td>
                <td style={{ padding: '16px 0', textAlign: 'center', fontWeight: 600 }}>{curr.units}</td>
                <td style={{ padding: '16px 0', textAlign: 'center', fontWeight: 600 }}>{curr.compLab}</td>
                <td style={{ padding: '16px 0', textAlign: 'center' }}>
                  <button className="curriculum-badge success" onClick={() => handleView(curr)}><HiEye /> View</button>
                  <button className="curriculum-badge danger" onClick={() => handleArchive(curr)}><HiArchiveBox /> Archive</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default CurriculumOverview;
