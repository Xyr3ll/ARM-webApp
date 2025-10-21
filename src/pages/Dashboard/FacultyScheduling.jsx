import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../../firebase';
import { collection, onSnapshot, query, where, doc } from 'firebase/firestore';
import './FacultyLoading.css';

export default function FacultyScheduling() {
  const navigate = useNavigate();
  const [year, setYear] = useState('2025-2026');
  const [program, setProgram] = useState('BSIT');
  const [semester, setSemester] = useState('1st Semester');
  const [sectionsByYear, setSectionsByYear] = useState({});
  const [assignedSections, setAssignedSections] = useState({});
  
  const yearLevels = useMemo(() => ['1st Year', '2nd Year', '3rd Year', '4th Year'], []);

  // Format school year input
  const formatSchoolYear = (value) => {
    const cleaned = value.replace(/\D/g, '');
    if (cleaned.length === 4) {
      const yearNum = parseInt(cleaned, 10);
      return `${yearNum}-${yearNum + 1}`;
    }
    return cleaned;
  };

  const handleYearChange = (e) => {
    const value = e.target.value;
    const cleaned = value.replace(/\D/g, '');
    
    // Validate year when 4 digits are entered
    if (cleaned.length === 4) {
      const yearNum = parseInt(cleaned, 10);
      const currentYear = new Date().getFullYear();
      
      if (yearNum < 2000) {
        alert('Year must be 2000 or later. Please enter a valid year.');
        return;
      }
      
      if (yearNum > currentYear) {
        alert(`Cannot select a year beyond ${currentYear}. Please enter ${currentYear} or earlier.`);
        return;
      }
    }
    
    const formatted = formatSchoolYear(value);
    setYear(formatted);
  };

  // Fetch sections for selected program/year/semester
  useEffect(() => {
    const programDoc = doc(db, 'gradeLevelSection', program);
    const sectionsCol = collection(programDoc, 'sections');
    
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
        grouped[yl].push({ 
          id: d.id, 
          name: data.sectionName,
          yearLevel: data.yearLevel 
        });
      });
      
      // Sort sections within each year level by name
      Object.keys(grouped).forEach((yl) => {
        grouped[yl].sort((a, b) => a.name.localeCompare(b.name));
      });
      
      setSectionsByYear(grouped);
    });
    
    return () => unsub();
  }, [program, year, semester]);

  // Subscribe to schedules for the selected program/year/semester to determine
  // which sections already have professor assignments. Disabled Assign button for those.
  useEffect(() => {
    const schedulesCol = collection(db, 'schedules');
    // Normalize semester to match how it's stored in schedules documents
    const normalizeSemester = (s) => {
      if (!s) return s;
      const lower = String(s).toLowerCase();
      if (lower.includes('1st')) return '1st';
      if (lower.includes('2nd')) return '2nd';
      if (lower.includes('summer')) return 'Summer';
      return s;
    };

    const scheduleSem = normalizeSemester(semester);

    const q = query(
      schedulesCol,
      where('program', '==', program),
      where('year', '==', year),
      where('semester', '==', scheduleSem)
    );

    const unsub = onSnapshot(q, (snap) => {
      const assigned = {};
      snap.forEach((d) => {
        const data = d.data();
        const sectionName = data.sectionName || d.id;
        // Skip archived schedules
        if (String(data?.status).toLowerCase() === 'archived') return;

        // If professorAssignments contains any non-empty value, consider section assigned
        const profAssign = data.professorAssignments || {};
        const hasAssigned = Object.values(profAssign).some(v => v && String(v).trim() !== '');
        if (hasAssigned) assigned[sectionName] = true;
      });
      setAssignedSections(assigned);
    });

    return () => unsub();
  }, [program, year, semester]);

  const handleEdit = (sectionId, sectionName, yearLevel) => {
    navigate('professor-assignment', {
      state: {
        sectionId,
        sectionName,
        yearLevel,
        program,
        year,
        semester
      }
    });
  };

  const handleView = (sectionId, sectionName, yearLevel) => {
    // Navigate to professor-assignment route in read-only/view mode
    navigate('professor-assignment', {
      state: {
        sectionId,
        sectionName,
        yearLevel,
        program,
        year,
        semester,
        viewOnly: true
      }
    });
  };

  return (
    <div className="faculty-loading-container">
      <div className="faculty-loading-header">
        <h2>Faculty Scheduling</h2>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
        <input
          type="text"
          value={year}
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
        <select
          value={program}
          onChange={(e) => setProgram(e.target.value)}
          style={{
            padding: '8px 14px',
            fontSize: 15,
            border: '1px solid #ccc',
            borderRadius: 6,
            minWidth: 140,
            fontWeight: 500
          }}
        >
          <option value="BSIT">BSIT</option>
          <option value="BSCS">BSCS</option>
        </select>
        <select
          value={semester}
          onChange={(e) => setSemester(e.target.value)}
          style={{
            padding: '8px 14px',
            fontSize: 15,
            border: '1px solid #ccc',
            borderRadius: 6,
            minWidth: 160,
            fontWeight: 500
          }}
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

      {/* Program Title */}
      <h3 style={{ fontWeight: 700, fontSize: 22, marginBottom: 32, color: '#1e3a8a' }}>
        {program === 'BSIT' && `Bachelor of Science in Information Technology (${year})`}
        {program === 'BSCS' && `Bachelor of Science in Computer Science (${year})`}
      </h3>

      {/* Year Level Cards */}
      <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap' }}>
        {yearLevels.map((yearLevel) => {
          const sections = sectionsByYear[yearLevel] || [];
          
          return (
            <div key={yearLevel} style={{ flex: '1 1 400px', minWidth: 400 }}>
              <div style={{
                background: '#1e3a8a',
                color: '#fff',
                borderRadius: '8px 8px 0 0',
                padding: '12px 20px',
                fontWeight: 700,
                fontSize: 18
              }}>
                {yearLevel} - {semester}
              </div>
              
              <div style={{
                background: '#fff',
                borderRadius: '0 0 8px 8px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                overflow: 'hidden'
              }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f5f5f5' }}>
                      <th style={{
                        padding: '14px 20px',
                        textAlign: 'left',
                        fontWeight: 700,
                        fontSize: 16,
                        borderBottom: '2px solid #e5e7eb'
                      }}>SECTION</th>
                      <th style={{
                        padding: '14px 20px',
                        textAlign: 'center',
                        fontWeight: 700,
                        fontSize: 16,
                        borderBottom: '2px solid #e5e7eb'
                      }}>ACTION</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sections.length === 0 ? (
                      <tr>
                        <td colSpan="2" style={{
                          padding: '32px 20px',
                          textAlign: 'center',
                          color: '#888',
                          fontSize: 14
                        }}>
                          No sections available for this year level
                        </td>
                      </tr>
                    ) : (
                      sections.map((section) => (
                        <tr key={section.id} style={{
                          borderBottom: '1px solid #e5e7eb',
                          transition: 'background 0.2s'
                        }}>
                          <td style={{
                            padding: '16px 20px',
                            fontWeight: 600,
                            fontSize: 15
                          }}>
                            {section.name}
                          </td>
                          <td style={{
                            padding: '16px 20px',
                            textAlign: 'center'
                          }}>
                            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                              <button
                                onClick={() => handleEdit(section.id, section.name, section.yearLevel)}
                                disabled={Boolean(assignedSections[section.name])}
                                style={{
                                  background: assignedSections[section.name] ? '#9ca3af' : '#3b82f6',
                                  color: '#fff',
                                  border: 'none',
                                  borderRadius: 18,
                                  padding: '8px 20px',
                                  fontWeight: 700,
                                  fontSize: 14,
                                  cursor: assignedSections[section.name] ? 'not-allowed' : 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 6,
                                  transition: 'background 0.2s',
                                  opacity: assignedSections[section.name] ? 0.8 : 1
                                }}
                                onMouseOver={(e) => {
                                  if (!assignedSections[section.name]) e.currentTarget.style.background = '#2563eb';
                                }}
                                onMouseOut={(e) => {
                                  if (!assignedSections[section.name]) e.currentTarget.style.background = '#3b82f6';
                                }}
                              >
                                {assignedSections[section.name] ? 'Assigned' : 'Assign'}
                              </button>
                              <button
                                onClick={() => handleView(section.id, section.name, section.yearLevel)}
                                style={{
                                  background: '#10b981',
                                  color: '#fff',
                                  border: 'none',
                                  borderRadius: 18,
                                  padding: '8px 20px',
                                  fontWeight: 700,
                                  fontSize: 14,
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 6,
                                  transition: 'background 0.2s'
                                }}
                                onMouseOver={(e) => e.currentTarget.style.background = '#059669'}
                                onMouseOut={(e) => e.currentTarget.style.background = '#10b981'}
                              >
                                 View
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>

      {/* Empty State */}
      {Object.keys(sectionsByYear).length === 0 && (
        <div style={{
          textAlign: 'center',
          padding: '60px 20px',
          color: '#888',
          fontSize: 16
        }}>
          <p style={{ marginBottom: 12 }}>No sections found for the selected filters.</p>
          <p style={{ fontSize: 14 }}>
            Try selecting a different year, program, or semester.
          </p>
        </div>
      )}
    </div>
  );
}
