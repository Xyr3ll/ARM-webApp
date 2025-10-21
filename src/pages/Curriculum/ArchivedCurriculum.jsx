import React, { useEffect, useState } from 'react';
import { db } from '../../firebase';
import { collection, getDocs, onSnapshot, query, where } from 'firebase/firestore';
import '../../styles/AcademicHeadDashboard.css';
import stiLogo from '../../assets/stilogo.png';
import { useNavigate } from 'react-router-dom';

const ArchivedCurriculum = () => {
  const [archivedCurriculums, setArchivedCurriculums] = useState([]);
  const [filterYear, setFilterYear] = useState('');

  // Format school year input
  const formatSchoolYear = (value) => {
    const cleaned = value.replace(/\D/g, '');
    if (cleaned.length === 4) {
      const year = parseInt(cleaned, 10);
      return `${year}-${year + 1}`;
    }
    return cleaned;
  };

  const handleYearChange = (e) => {
    const value = e.target.value;
    const cleaned = value.replace(/\D/g, '');
    
    // Validate year when 4 digits are entered
    if (cleaned.length === 4) {
      const year = parseInt(cleaned, 10);
      const currentYear = new Date().getFullYear();
      
      if (year < 2000) {
        alert('Year must be 2000 or later. Please enter a valid year.');
        return;
      }
      
      if (year > currentYear) {
        alert(`Cannot select a year beyond ${currentYear}. Please enter ${currentYear} or earlier.`);
        return;
      }
    }
    
    const formatted = formatSchoolYear(value);
    setFilterYear(formatted);
  };

  useEffect(() => {
    // Realtime query for archived curriculums only
    const q = query(collection(db, 'curriculum'), where('status', '==', 'archived'));
    const unsub = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setArchivedCurriculums(data);
    }, (err) => {
      console.error('Error fetching curriculums:', err);
    });
    return () => unsub();
  }, []);

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedCurriculum, setSelectedCurriculum] = useState(null);

  const navigate = useNavigate();
  const handleView = (curriculum) => {
    // Navigate to AddCurriculum with selected curriculum data and doc ID
    navigate('/dashboard/academic-head/curriculum/add', { state: { initialRows: [curriculum], docId: curriculum.id } });
  };

  // Filter curriculums by year
  const filteredCurriculums = archivedCurriculums.filter(curr => {
    if (!filterYear) return true; // Show all if no filter
    const currYear = curr.year || '';
    // Match both "YYYY" and "YYYY-YYYY" formats
    return currYear === filterYear || 
           currYear.startsWith(filterYear.split('-')[0]) ||
           filterYear.startsWith(currYear.split('-')[0]);
  });

  return (
    <div style={{ padding: '32px 0 0 0' }}>
      <h2 style={{ fontWeight: 700, fontSize: 28, marginBottom: 18 }}>Archived Curriculum</h2>
      
      {/* Filter Section */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, alignItems: 'center' }}>
        <label style={{ fontWeight: 600, fontSize: 16 }}>Filter by Year:</label>
        <input
          type="text"
          value={filterYear}
          onChange={handleYearChange}
          placeholder="e.g., 2019, 2020, 2025..."
          maxLength={9}
          style={{
            padding: '8px 14px',
            fontSize: 15,
            border: '1px solid #ccc',
            borderRadius: 6,
            minWidth: 180,
            fontWeight: 500
          }}
        />
        {filterYear && (
          <button
            onClick={() => setFilterYear('')}
            style={{
              background: '#ef4444',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              padding: '8px 16px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Clear Filter
          </button>
        )}
      </div>
      
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: 32 }}>
        <table style={{ minWidth: 1100, maxWidth: 1400, width: '100%', borderCollapse: 'collapse', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
          <thead>
            <tr style={{ background: '#d3d3d3' }}>
              <th style={{ padding: '14px 0', fontWeight: 700, fontSize: 16 }}>YEAR</th>
              <th style={{ padding: '14px 0', fontWeight: 700, fontSize: 16 }}>PROGRAM CODE</th>
              <th style={{ padding: '14px 0', fontWeight: 700, fontSize: 16 }}>COURSE CODE</th>
              <th style={{ padding: '14px 0', fontWeight: 700, fontSize: 16 }}>COURSE NAME</th>
              <th style={{ padding: '14px 0', fontWeight: 700, fontSize: 16 }}>LEC</th>
              <th style={{ padding: '14px 0', fontWeight: 700, fontSize: 16 }}>LAB</th>
              <th style={{ padding: '14px 0', fontWeight: 700, fontSize: 16 }}>UNITS</th>
              <th style={{ padding: '14px 0', fontWeight: 700, fontSize: 16 }}>COMP LAB</th>
              <th style={{ padding: '14px 0', fontWeight: 700, fontSize: 16 }}>ACTION</th>
            </tr>
          </thead>
          <tbody>
            {filteredCurriculums.length === 0 ? (
              <tr>
                <td colSpan="9" style={{ padding: '32px 0', textAlign: 'center', color: '#888', fontSize: 16 }}>
                  {filterYear ? 'No archived curriculums found for this year.' : 'No archived curriculums available.'}
                </td>
              </tr>
            ) : (
              filteredCurriculums.map((curr, idx) => (
                <tr key={idx} style={{ background: '#fff' }}>
                  <td style={{ padding: '16px 0', textAlign: 'center', fontWeight: 600 }}>{curr.year}</td>
                  <td style={{ padding: '16px 0', textAlign: 'center', fontWeight: 600 }}>{curr.programCode}</td>
                  <td style={{ padding: '16px 0', textAlign: 'center', fontWeight: 600 }}>{curr.courseCode}</td>
                  <td style={{ padding: '16px 0', textAlign: 'center', fontWeight: 600 }}>{curr.courseName}</td>
                  <td style={{ padding: '16px 0', textAlign: 'center', fontWeight: 600 }}>{curr.lec}</td>
                  <td style={{ padding: '16px 0', textAlign: 'center', fontWeight: 600 }}>{curr.lab}</td>
                  <td style={{ padding: '16px 0', textAlign: 'center', fontWeight: 600 }}>{curr.units}</td>
                  <td style={{ padding: '16px 0', textAlign: 'center', fontWeight: 600 }}>{curr.compLab}</td>
                  <td style={{ padding: '16px 0', textAlign: 'center' }}>
                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                      <button
                        style={{ background: '#1de782', color: '#222', border: 'none', borderRadius: 18, padding: '6px 18px', fontWeight: 700, fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
                        onClick={() => handleView(curr)}
                      >
                        <span role="img" aria-label="View" style={{ fontSize: 18 }}>👁️</span> View
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal for curriculum details */}
      {modalOpen && selectedCurriculum && (
        <div style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.35)', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center'}}>
          <div style={{background:'#fff', borderRadius:10, padding:32, minWidth:400, boxShadow:'0 8px 24px rgba(0,0,0,0.2)', position:'relative'}}>
            <button onClick={()=>setModalOpen(false)} style={{position:'absolute', top:16, right:16, background:'#eee', border:'none', borderRadius:'50%', width:32, height:32, fontSize:18, cursor:'pointer'}}>×</button>
            <h3 style={{marginTop:0, marginBottom:18}}>Curriculum Details</h3>
            <div style={{fontSize:16, marginBottom:8}}><b>Year:</b> {selectedCurriculum.year}</div>
            <div style={{fontSize:16, marginBottom:8}}><b>Program Code:</b> {selectedCurriculum.programCode}</div>
            <div style={{fontSize:16, marginBottom:8}}><b>Course Code:</b> {selectedCurriculum.courseCode}</div>
            <div style={{fontSize:16, marginBottom:8}}><b>Course Name:</b> {selectedCurriculum.courseName}</div>
            <div style={{fontSize:16, marginBottom:8}}><b>Lec:</b> {selectedCurriculum.lec}</div>
            <div style={{fontSize:16, marginBottom:8}}><b>Lab:</b> {selectedCurriculum.lab}</div>
            <div style={{fontSize:16, marginBottom:8}}><b>Units:</b> {selectedCurriculum.units}</div>
            <div style={{fontSize:16, marginBottom:8}}><b>Comp Lab:</b> {selectedCurriculum.compLab}</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ArchivedCurriculum;
