import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { db } from '../../firebase';
import { collection, onSnapshot, query, where, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import './FacultyLoading.css';

export default function ProfessorAssignment() {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Get data from navigation state
  const { sectionId, sectionName, yearLevel, program, year, semester, viewOnly } = location.state || {};
  
  const [schedule, setSchedule] = useState({});
  const [faculty, setFaculty] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [assignedProfessors, setAssignedProfessors] = useState({});
  const [scheduleDocId, setScheduleDocId] = useState(null);
  const [isDirty, setIsDirty] = useState(false);
  const [allSchedules, setAllSchedules] = useState([]); // Store all schedules for conflict checking

  const timeSlots = useMemo(() => [
    '7:00AM', '7:30AM', '8:00AM', '8:30AM', '9:00AM', '9:30AM',
    '10:00AM', '10:30AM', '11:00AM', '11:30AM', '12:00PM', '12:30PM',
    '1:00PM', '1:30PM', '2:00PM', '2:30PM', '3:00PM', '3:30PM',
    '4:00PM', '4:30PM', '5:00PM', '5:30PM', '6:00PM', '6:30PM',
    '7:00PM', '7:30PM', '8:00PM', '8:30PM'
  ], []);

  const days = useMemo(() => ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'], []);

  // Fetch schedule for this section from schedules collection
  useEffect(() => {
    if (!sectionName || !program || !year || !semester || !yearLevel) {
      console.log('Missing data:', { sectionName, program, year, semester, yearLevel });
      setLoading(false);
      return;
    }

    // Convert semester format: "1st Semester" -> "1st"
    const semesterShort = semester.includes('Semester') 
      ? semester.split(' ')[0] 
      : semester;

    console.log('Querying with:', { 
      program, 
      sectionName, 
      year, 
      semester: semesterShort, 
      yearLevel 
    });

    // Query schedules collection
    const schedulesCol = collection(db, 'schedules');
    const q = query(
      schedulesCol,
      where('program', '==', program),
      where('sectionName', '==', sectionName),
      where('year', '==', year),
      where('semester', '==', semesterShort),
      where('yearLevel', '==', yearLevel)
    );

    const unsub = onSnapshot(q, (snap) => {
      if (!snap.empty) {
        const doc = snap.docs[0];
        const data = doc.data();
        console.log('Schedule data loaded:', data);
        const scheduleData = data.schedule || {};
        setSchedule(scheduleData);
        setAssignedProfessors(data.professorAssignments || {});
        setScheduleDocId(doc.id);
        console.log('Schedule keys:', Object.keys(scheduleData));
      } else {
        console.log('No schedule found for this section');
        setSchedule({});
      }
      setLoading(false);
    });

    return () => unsub();
  }, [sectionName, program, year, semester, yearLevel]);

  // Fetch all faculty
  useEffect(() => {
    const q = query(collection(db, 'faculty'));
    
    const unsub = onSnapshot(q, (snap) => {
      const facultyList = [];
      snap.forEach((d) => {
        const data = d.data();
        facultyList.push({
          id: d.id,
          professor: data.professor || '',
          shift: data.shift || 'FULL-TIME',
          units: data.units || 0,
          courses: data.courses || []
        });
      });
      
      // Sort by professor name
      facultyList.sort((a, b) => a.professor.localeCompare(b.professor));
      setFaculty(facultyList);
      console.log('Faculty loaded:', facultyList);
    });

    return () => unsub();
  }, []);

  // Fetch ALL schedules for conflict checking
  useEffect(() => {
    const schedulesCol = collection(db, 'schedules');
    
    const unsub = onSnapshot(schedulesCol, (snap) => {
      const schedulesList = [];
      snap.forEach((d) => {
        const data = d.data();
        schedulesList.push({
          id: d.id,
          schedule: data.schedule || {},
          professorAssignments: data.professorAssignments || {},
          sectionName: data.sectionName || '',
          yearLevel: data.yearLevel || '',
          program: data.program || ''
        });
      });
      setAllSchedules(schedulesList);
      console.log('All schedules loaded:', schedulesList.length);
    });

    return () => unsub();
  }, []);

  // Filter faculty by search
  const filteredFaculty = useMemo(() => {
    if (!searchTerm) return faculty;
    return faculty.filter(f => 
      f.professor.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [faculty, searchTerm]);

  const handleProfessorChange = async (day, time, professorName) => {
    const key = `${day}_${time}`; // Use underscore to match your format
    // Do not allow changes in view-only mode
    if (viewOnly) {
      alert('This schedule is view-only and cannot be modified.');
      return;
    }

    // Allow edits locally and mark dirty — do not auto-save yet
    const newAssignments = { ...assignedProfessors, [key]: professorName };
    setAssignedProfessors(newAssignments);
    setIsDirty(true);
  };

  const handleSave = async () => {
    // Prevent saving if not all required slots have an assigned professor
    if (!allSlotsAssigned) {
      alert('Please assign a professor to every subject before saving.');
      return;
    }

    if (!isDirty) {
      alert('No changes to save.');
      return;
    }

    const confirmed = window.confirm('Are you sure you want to save these professor assignments?');
    if (!confirmed) return;

    try {
      if (!scheduleDocId) {
        alert('Unable to find schedule document to save.');
        return;
      }
      const ref = doc(db, 'schedules', scheduleDocId);
      await updateDoc(ref, { professorAssignments: assignedProfessors, updatedAt: serverTimestamp() });
      setIsDirty(false);
      alert('Professor assignments saved successfully!');
      navigate(-1);
    } catch (e) {
      console.error('Failed to save assignments', e);
      alert('Failed to save assignments. Please try again.');
    }
  };

  const getCellStyle = (day, time) => {
    const key = `${day}_${time}`;
    const cellData = schedule?.[key];
    
    if (!cellData || !cellData.subject) {
      return { 
        background: '#fff', 
        border: '1px solid #e5e7eb',
        padding: '6px',
        minHeight: 50,
        position: 'relative'
      };
    }

    // Calculate row span based on duration
    const duration = cellData.durationSlots || 1;
    const rowHeight = 50; // Reduced from 80 to 50
    const totalHeight = rowHeight * duration;

    return {
      background: '#fef08a',
      border: '1px solid #facc15',
      padding: '6px',
      fontSize: 10,
      verticalAlign: 'top',
      minHeight: totalHeight,
      height: totalHeight,
      position: 'relative'
    };
  };

  // Check if a cell should be hidden because it's covered by a multi-slot subject above it
  const isCellCovered = (day, time) => {
    const timeIndex = timeSlots.indexOf(time);
    if (timeIndex === -1) return false;

    // Check all earlier time slots on the same day
    for (let i = 0; i < timeIndex; i++) {
      const earlierTime = timeSlots[i];
      const earlierKey = `${day}_${earlierTime}`;
      const earlierCell = schedule?.[earlierKey];

      if (earlierCell && earlierCell.subject) {
        const duration = earlierCell.durationSlots || 1;
        const coverageEnd = i + duration;

        // If current time slot is within the coverage of earlier cell
        if (timeIndex < coverageEnd) {
          return true;
        }
      }
    }

    return false;
  };

  // Helper function to check if two time slots overlap
  const timeSlotsOverlap = (time1, duration1, time2, duration2) => {
    const time1Index = timeSlots.indexOf(time1);
    const time2Index = timeSlots.indexOf(time2);
    
    if (time1Index === -1 || time2Index === -1) return false;
    
    const time1End = time1Index + (duration1 || 1);
    const time2End = time2Index + (duration2 || 1);
    
    // Check if time ranges overlap
    return time1Index < time2End && time2Index < time1End;
  };

  const renderCellContent = (day, time) => {
    const key = `${day}_${time}`; // Use underscore to match your format
    const cellData = schedule?.[key];
    const professor = assignedProfessors?.[key] || '';

    if (!cellData || !cellData.subject) return null;

    // Extract course code from subject (e.g., "TESTT (LEC)" -> "TESTT")
    const subjectMatch = cellData.subject.match(/^([^\(]+)/);
    const courseCode = subjectMatch ? subjectMatch[1].trim() : cellData.subject;

    // Get duration of current cell
    const currentDuration = cellData.durationSlots || 1;

    // Calculate end time
    const timeIndex = timeSlots.indexOf(time);
    const endTimeIndex = timeIndex + currentDuration;
    const endTime = endTimeIndex < timeSlots.length ? timeSlots[endTimeIndex] : '';

    // Filter faculty who have this course in their courses array
    // Match by flexible rules: courseCode exact match OR courseName substring match (ignore parentheses and case)
    const qualifiedFaculty = faculty.filter(prof => {
      if (!prof.courses || !Array.isArray(prof.courses)) return false;

      const normalize = (s = '') => String(s).toLowerCase().replace(/[()]/g, '').replace(/\s+/g, ' ').trim();
      const subjectNorm = normalize(courseCode);

      // First check if they're qualified for this course
      const hasQualification = prof.courses.some(course => {
        const code = (course.courseCode || '').toLowerCase().trim();
        const nameNorm = normalize(course.courseName || course.course || '');

        // Exact code match
        if (code && subjectNorm === code) return true;

        // Subject could be a short name extracted from a long course name with inner parentheses.
        // Accept if either normalized course name contains the subject text or vice-versa.
        if (nameNorm && (nameNorm.includes(subjectNorm) || subjectNorm.includes(nameNorm))) return true;

        // Also accept if subject contains the course code token
        if (code && subjectNorm.includes(code)) return true;

        return false;
      });

      if (!hasQualification) return false;
      
      // Check if professor has conflicting schedule across ALL schedules
      for (const scheduleDoc of allSchedules) {
        const assignments = scheduleDoc.professorAssignments || {};
        const scheduleData = scheduleDoc.schedule || {};

        for (const [assignedKey, assignedProf] of Object.entries(assignments)) {
          if (assignedProf !== prof.professor) continue; // Skip if not this professor

          const [assignedDay, assignedTime] = assignedKey.split('_');

          // Skip if different day
          if (assignedDay !== day) continue;

          // Skip if it's the same cell in the current section (allowing reassignment)
          if (assignedKey === key && scheduleDoc.sectionName === sectionName) continue;

          // Do NOT treat different yearLevel as blocking — allow cross-year checks only by time overlap
          // (This relaxes the previous behavior that implicitly filtered by year level.)

          // Get duration of assigned schedule
          const assignedCellData = scheduleData?.[assignedKey];
          const assignedDuration = assignedCellData?.durationSlots || 1;

          // Check if times overlap
          if (timeSlotsOverlap(time, currentDuration, assignedTime, assignedDuration)) {
            console.log(`Conflict found for ${prof.professor}: ${assignedDay} ${assignedTime} (${scheduleDoc.sectionName}) overlaps with ${day} ${time}`);
            return false; // Professor has conflict
          }
        }
      }
      
      return true; // Qualified and no conflicts
    });

    return (
      <div>
        <div style={{ 
          fontWeight: 700, 
          marginBottom: 3,
          fontSize: 19,
          color: '#1e3a8a'
        }}>
          {courseCode}
        </div>
        <div style={{ 
          fontSize: 14, 
          color: '#666', 
          marginBottom: 4,
          lineHeight: 1.2
        }}>
          {cellData.subject}
        </div>
        {cellData.room && (
          <div style={{ 
            fontSize: 14, 
            color: '#666', 
            marginBottom: 4,
            fontWeight: 600
          }}>
             {cellData.room}
          </div>
        )}
        {endTime && (
          <div style={{ 
            fontSize: 14, 
            color: '#1e3a8a', 
            marginBottom: 6,
            fontWeight: 600
          }}>
             {time} - {endTime}
          </div>
        )}
        <select
          value={professor}
          onChange={(e) => handleProfessorChange(day, time, e.target.value)}
          style={{
            width: '100%',
            padding: '4px 6px',
            borderRadius: 4,
            border: '1px solid #d1d5db',
            fontSize: 10,
            fontWeight: 600,
            cursor: viewOnly ? 'not-allowed' : 'pointer',
            background: professor ? '#10b981' : '#ef4444',
            color: '#fff',
            outline: 'none'
          }}
          onClick={(e) => e.stopPropagation()}
          disabled={viewOnly}
        >
          <option value="" style={{ background: '#fff', color: '#000' }}>
            {qualifiedFaculty.length > 0 ? 'Select Professor' : 'No qualified faculty'}
          </option>
          {qualifiedFaculty.map((prof) => (
            <option 
              key={prof.id} 
              value={prof.professor}
              style={{ background: '#fff', color: '#000' }}
            >
              {prof.professor}
            </option>
          ))}
        </select>
      </div>
    );
  };

  // Determine if any professor is already assigned in this schedule
  const hasAnyAssignedProfessor = React.useMemo(() => {
    return Object.values(assignedProfessors || {}).some(v => v && String(v).trim() !== '');
  }, [assignedProfessors]);

  // Determine if all required slots (slots with a subject) have an assigned professor
  const allSlotsAssigned = React.useMemo(() => {
    if (!schedule) return false;
    const keys = Object.keys(schedule || {});
    const requiredKeys = keys.filter(k => schedule[k] && schedule[k].subject);
    if (requiredKeys.length === 0) return false;
    return requiredKeys.every(k => assignedProfessors && assignedProfessors[k] && String(assignedProfessors[k]).trim() !== '');
  }, [schedule, assignedProfessors]);

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <div style={{ fontSize: 18, color: '#666' }}>Loading schedule...</div>
      </div>
    );
  }

  if (!sectionId || !sectionName) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <div style={{ fontSize: 18, color: '#ef4444', marginBottom: 16 }}>
          No section data available
        </div>
        <button
          onClick={() => navigate(-1)}
          style={{
            background: '#3b82f6',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            padding: '10px 24px',
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div style={{ background: '#f9fafb', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{
        background: '#fff',
        padding: '16px 32px',
        borderBottom: '2px solid #e5e7eb',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button
            onClick={() => navigate(-1)}
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: 24,
              cursor: 'pointer',
              padding: '4px 8px'
            }}
          >
            ←
          </button>
          <h2 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>
            Professor Assignment
          </h2>
        </div>
        <button
          onClick={handleSave}
          // allow saving if there are unsaved changes (isDirty) even when allSlotsAssigned is true
          // Enable save only when not view-only, there are unsaved changes, and all required slots are assigned
          disabled={Boolean(viewOnly) || !isDirty || !allSlotsAssigned}
          style={{
              background: (viewOnly || !isDirty || !allSlotsAssigned) ? '#94a3b8' : '#10b981',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            padding: '10px 24px',
            fontWeight: 700,
            fontSize: 15,
              cursor: (viewOnly || !isDirty || !allSlotsAssigned) ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8
          }}
        >
            {viewOnly ? 'Locked' : (!allSlotsAssigned ? 'Fill all slots' : (isDirty ? 'Save' : 'No changes'))}
        </button>
      </div>

      <div style={{ display: 'flex', height: 'calc(100vh - 120px)' }}>
        {/* Sidebar - Faculty List */}
        <div style={{
          width: 280,
          background: '#3b82f6',
          padding: 20,
          overflowY: 'auto'
        }}>
          <div style={{ marginBottom: 16 }}>
            <input
              type="text"
              placeholder="Search faculty..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 14px',
                border: 'none',
                borderRadius: 6,
                fontSize: 14,
                outline: 'none'
              }}
            />
          </div>

          <div style={{ color: '#fff', fontSize: 13, fontWeight: 600, marginBottom: 12 }}>
            {filteredFaculty.length} Faculty Member{filteredFaculty.length !== 1 ? 's' : ''}
          </div>

          {filteredFaculty.map((prof) => {
            const courseCodes = prof.courses
              ? prof.courses.map(c => c.courseCode).filter(Boolean).join(', ')
              : 'No courses';
            
            return (
              <div
                key={prof.id}
                style={{
                  background: 'rgba(255,255,255,0.15)',
                  padding: '12px',
                  borderRadius: 6,
                  marginBottom: 8,
                  border: '1px solid rgba(255,255,255,0.2)'
                }}
              >
                <div style={{
                  fontWeight: 700,
                  fontSize: 13,
                  color: '#fff',
                  marginBottom: 4
                }}>
                  {prof.professor}
                </div>
                <div style={{
                  fontSize: 11,
                  color: 'rgba(255,255,255,0.85)',
                  marginBottom: 4
                }}>
                  {prof.shift} • {prof.units} units
                </div>
                <div style={{
                  fontSize: 10,
                  color: 'rgba(255,255,255,0.7)',
                  fontStyle: 'italic'
                }}>
                  {courseCodes}
                </div>
              </div>
            );
          })}

          {filteredFaculty.length === 0 && (
            <div style={{
              color: 'rgba(255,255,255,0.7)',
              fontSize: 13,
              textAlign: 'center',
              marginTop: 20
            }}>
              No faculty found
            </div>
          )}
        </div>

        {/* Main Content - Schedule Grid */}
        <div style={{ flex: 1, padding: 20, overflowY: 'auto' }}>
          {/* Section Info */}
          <div style={{
            background: '#fff',
            padding: '16px 20px',
            borderRadius: 8,
            marginBottom: 20,
            display: 'flex',
            gap: 24,
            flexWrap: 'wrap',
            alignItems: 'center'
          }}>
            <div style={{
              background: '#1e3a8a',
              color: '#fff',
              padding: '8px 16px',
              borderRadius: 6,
              fontWeight: 700,
              fontSize: 14
            }}>
              {program}
            </div>
            <div style={{ fontWeight: 600, fontSize: 15 }}>
              {yearLevel} - {semester}
            </div>
            <div style={{ fontWeight: 700, fontSize: 16, color: '#1e3a8a' }}>
              {sectionName}
            </div>
          </div>

          {/* Schedule Grid */}
          <div style={{
            background: '#fff',
            borderRadius: 8,
            overflow: 'hidden',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
          }}>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: 12
            }}>
              <thead>
                <tr>
                  <th style={{
                    position: 'sticky',
                    top: 0,
                    left: 0,
                    background: '#1e3a8a',
                    color: '#fff',
                    padding: '12px 8px',
                    border: '1px solid #1e3a8a',
                    fontWeight: 700,
                    minWidth: 80,
                    zIndex: 3
                  }}>
                    Time
                  </th>
                  {days.map((day) => (
                    <th key={day} style={{
                      position: 'sticky',
                      top: 0,
                      background: '#1e3a8a',
                      color: '#fff',
                      padding: '12px 8px',
                      border: '1px solid #1e3a8a',
                      fontWeight: 700,
                      minWidth: 140,
                      zIndex: 2
                    }}>
                      {day}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {timeSlots.map((time) => (
                  <tr key={time}>
                    <td style={{
                      position: 'sticky',
                      left: 0,
                      background: '#f3f4f6',
                      padding: '6px',
                      border: '1px solid #e5e7eb',
                      fontWeight: 600,
                      fontSize: 10,
                      zIndex: 1,
                      height: 50
                    }}>
                      {time}
                    </td>
                    {days.map((day) => {
                      // Skip rendering if this cell is covered by a multi-slot subject above
                      if (isCellCovered(day, time)) {
                        return null;
                      }

                      const key = `${day}_${time}`;
                      const cellData = schedule?.[key];
                      const rowSpan = cellData?.durationSlots || 1;

                      return (
                        <td 
                          key={`${day}-${time}`} 
                          style={getCellStyle(day, time)}
                          rowSpan={rowSpan}
                        >
                          {renderCellContent(day, time)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
