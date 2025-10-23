
import React, { useState, useEffect } from 'react';
import { FaUserEdit } from 'react-icons/fa';
import { collection, onSnapshot, query, where, getDocs, updateDoc, serverTimestamp, addDoc } from 'firebase/firestore';
import { db } from '../../firebase';



export default function Substitution() {
  const [faculty, setFaculty] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedProf, setSelectedProf] = useState(null);
  const [subjects, setSubjects] = useState([]);
  const [substitutes, setSubstitutes] = useState({});
  const [professorSchedules, setProfessorSchedules] = useState({});
  const [successMessage, setSuccessMessage] = useState('');

  // Fetch faculty
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'faculty'), (snap) => {
      const list = [];
      snap.forEach((doc) => {
        const data = doc.data();
        if (data.professor) list.push({
          name: data.professor,
          courses: data.courses || [],
        });
      });
      setFaculty(list);
    });
    return () => unsub();
  }, []);

  // Fetch all professor schedules (teaching, admin, consultation)
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'schedules'), (snap) => {
      const schedules = {};
      snap.forEach((docSnap) => {
        const data = docSnap.data();
        if (String(data?.status).toLowerCase() === 'archived') return;
        const schedule = data.schedule || {};
        const professorAssignments = data.professorAssignments || {};
        Object.entries(schedule).forEach(([key, val]) => {
          const [day, time] = key.split('_');
          // Resolve professor from several possible sources: professorAssignments mapping OR properties on the schedule entry itself
          let professor = professorAssignments[key];
          if (!professor && val) {
            // Common property names that might hold the assigned professor
            professor = val.professor || val.instructor || val.professorName || val.assignedProfessor || val.professorAssigned || '';
          }
          if (professor && val && val.subject) {
            const pname = String(professor || '').trim();
            if (!schedules[pname]) schedules[pname] = [];
            schedules[pname].push({
              day,
              startTime: String(time || '').trim(),
              endTime: val.endTime || '',
              subject: val.subject,
              section: data.sectionName || docSnap.id,
            });
          }
        });
      });
      setProfessorSchedules(schedules);
    });
    return () => unsub();
  }, []);

  // Fetch actual schedule slots for selected professor
  const handleSubstituteClick = async (profName) => {
    setSelectedProf(profName);
    // Find all schedule slots assigned to this professor, including program and courseCode if available
    const slots = [];
    const newSubstitutes = {};
    // To get the latest substituteTeacher, fetch all schedules for this professor's sections
    const allSectionNames = new Set();
    Object.entries(professorSchedules).forEach(([prof, scheds]) => {
      if (prof === profName) {
        scheds.forEach(slot => {
          if (slot.section) allSectionNames.add(slot.section);
        });
      }
    });
    // Fetch all schedules for these sections
    let scheduleDocs = [];
    if (allSectionNames.size > 0) {
      const sectionArr = Array.from(allSectionNames);
      for (let i = 0; i < sectionArr.length; i++) {
        const q = query(collection(db, 'schedules'), where('sectionName', '==', sectionArr[i]));
        const snap = await getDocs(q);
        snap.forEach(docSnap => {
          scheduleDocs.push(docSnap.data());
        });
      }
    }
    Object.entries(professorSchedules).forEach(([prof, scheds]) => {
      if (prof === profName) {
        scheds.forEach((slot, idx) => {
          // Find the scheduleDoc for this section
          const schedDoc = scheduleDocs.find(d => d.sectionName === slot.section);
          let substituteTeacher = '';
          if (schedDoc && schedDoc.schedule) {
            const key = `${slot.day}_${slot.startTime}`;
            if (schedDoc.schedule[key] && schedDoc.schedule[key].substituteTeacher) {
              substituteTeacher = schedDoc.schedule[key].substituteTeacher;
            }
          }
          // Determine endTime for this slot from the schedule document if available
          let slotEndTime = '';
          if (schedDoc && schedDoc.schedule) {
            const key = `${slot.day}_${slot.startTime}`;
            if (schedDoc.schedule[key] && schedDoc.schedule[key].endTime) {
              slotEndTime = schedDoc.schedule[key].endTime;
            }
          }

          slots.push({
            program: slot.program || 'BSIT',
            courseName: slot.subject,
            courseCode: slot.subject && slot.subject.match(/^[^\s(]+/) ? slot.subject.match(/^[^\s(]+/)[0] : '',
            section: slot.section,
            day: slot.day,
            startTime: slot.startTime,
            endTime: slotEndTime || slot.endTime || '',
            substituteTeacher,
          });
          // Pre-fill the substitute dropdown with the current substituteTeacher if any
          if (substituteTeacher) {
            newSubstitutes[idx] = substituteTeacher;
          }
        });
      }
    });
    setSubjects(slots);
    setSubstitutes(newSubstitutes);
    setShowModal(true);
  };

  const handleSubstituteChange = (idx, value) => {
    setSubstitutes(prev => ({ ...prev, [idx]: value }));
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedProf(null);
    setSubjects([]);
    setSubstitutes({});
    setSuccessMessage('');
  };

  // Save handler
  const handleSave = async () => {
    let updated = false;
    const updatePromises = [];
    for (let i = 0; i < subjects.length; i++) {
      const substituteName = substitutes[i];
      const subj = subjects[i];
      if (substituteName && subj.section && subj.day && subj.startTime) {
        const q = query(collection(db, 'schedules'), where('sectionName', '==', subj.section));
        const snap = await getDocs(q);
        snap.forEach((docSnap) => {
          const docRef = docSnap.ref;
          const data = docSnap.data();
          const professorAssignments = { ...(data.professorAssignments || {}) };
          const schedule = { ...(data.schedule || {}) };
          const key = `${subj.day}_${subj.startTime}`;
          // Do NOT change professorAssignments, only add substituteTeacher to the schedule slot
          if (schedule[key]) {
            schedule[key].substituteTeacher = substituteName;
          }
          updatePromises.push(updateDoc(docRef, { 
            schedule,
            updatedAt: serverTimestamp()
          }));
          updated = true;
        });
      }
    }
    if (updatePromises.length > 0) {
      await Promise.all(updatePromises);
    }
    if (updated) {
      setSuccessMessage('Successfully added substitute!');
      setTimeout(() => {
        setSuccessMessage('');
        closeModal();
      }, 1500);
    } else {
      closeModal();
    }
  };

  // Clear all substitutions for selectedProf
  // Remove substituteTeacher and restore original professor in schedules
  const handleClearAll = async () => {
    // Instead of deleting the substitute, create a history record and mark the substitution as archived on the schedule slot
    const updatePromises = [];
    const historyPromises = [];
    for (let i = 0; i < subjects.length; i++) {
      const subj = subjects[i];
      if (subj.section && subj.day && subj.startTime) {
        const q = query(collection(db, 'schedules'), where('sectionName', '==', subj.section));
        const snap = await getDocs(q);
        snap.forEach((docSnap) => {
          const docRef = docSnap.ref;
          const data = docSnap.data();
          const schedule = { ...(data.schedule || {}) };
          const key = `${subj.day}_${subj.startTime}`;
          // Do NOT change professorAssignments; instead create history entry, archive the substitute value and mark substitution as archived
          if (schedule[key] && schedule[key].substituteTeacher) {
            const archivedName = schedule[key].substituteTeacher;
            const professorAssignments = data.professorAssignments || {};
            const original = professorAssignments[key] || schedule[key].professor || schedule[key].instructor || '';
            // Create a history-substitution document for global archive
            const history = {
              scheduleId: docSnap.id,
              docKey: key,
              section: data.sectionName || docSnap.id,
              program: data.program || '',
              day: subj.day,
              startTime: subj.startTime,
              endTime: schedule[key].endTime || subj.endTime || '',
              subject: schedule[key].subject || subj.courseName || '',
              originalProfessor: original,
              substituteTeacher: archivedName,
              archivedAt: serverTimestamp()
            };
            historyPromises.push(addDoc(collection(db, 'history-substitution'), history));

            // Remove the visible substitute and any archive markers from the schedule so history is centralized
            delete schedule[key].substituteTeacher;
            delete schedule[key].substituteArchivedTeacher;
            delete schedule[key].substituteStatus;
            delete schedule[key].substituteArchivedAt;
          }
          updatePromises.push(updateDoc(docRef, { 
            schedule,
            updatedAt: serverTimestamp()
          }));
        });
      }
    }
    if (updatePromises.length > 0) {
      await Promise.all(updatePromises);
    }
    if (historyPromises.length > 0) {
      await Promise.all(historyPromises);
    }
    closeModal();
  };

  return (
    <div style={{ padding: '32px 0', maxWidth: 900, margin: '0 auto' }}>
      <h2 style={{ textAlign: 'center', fontWeight: 700, fontSize: 32, marginBottom: 32 }}>
        Substitution
      </h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 2px 8px #0001' }}>
        <thead>
          <tr style={{ background: '#e5e7eb' }}>
            <th style={{ padding: '16px 0', fontSize: 18, fontWeight: 700, color: '#1e3a8a', letterSpacing: 1 }}>PROFESSOR</th>
            <th style={{ padding: '16px 0', fontSize: 18, fontWeight: 700, color: '#1e3a8a', letterSpacing: 1 }}>ACTION</th>
          </tr>
        </thead>
        <tbody>
          {faculty.map((prof, idx) => (
            <tr key={prof.name} style={{ borderBottom: '1px solid #e5e7eb' }}>
              <td style={{ padding: '18px 0', textAlign: 'center', fontWeight: 700, fontSize: 18, color: '#222', letterSpacing: 1 }}>{prof.name}</td>
              <td style={{ padding: '18px 0', textAlign: 'center' }}>
                <button style={{
                  background: '#fde68a',
                  color: '#1e3a8a',
                  border: 'none',
                  borderRadius: 8,
                  padding: '8px 22px',
                  fontWeight: 700,
                  fontSize: 16,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  boxShadow: '0 1px 4px #0001',
                  cursor: 'pointer',
                  transition: 'background 0.2s',
                }}
                  onClick={() => handleSubstituteClick(prof.name)}
                >
                  <FaUserEdit style={{ fontSize: 18, marginRight: 2 }} /> Substitute
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Modal for substitution details */}
  {showModal && (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      background: 'rgba(0,0,0,0.18)',
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <div style={{
        background: '#fff',
        borderRadius: 16,
        boxShadow: '0 2px 16px #0002',
        minWidth: 900,
        maxWidth: 1200,
        // Constrain height and make content scrollable when it overflows the viewport
        maxHeight: 'calc(100vh - 80px)',
        overflowY: 'auto',
        padding: 32,
        position: 'relative',
      }}>
        {successMessage && (
          <div style={{
            background: '#22c55e',
            color: '#fff',
            fontWeight: 700,
            fontSize: 18,
            borderRadius: 8,
            padding: '10px 24px',
            marginBottom: 18,
            textAlign: 'center',
            letterSpacing: 1,
            boxShadow: '0 1px 4px #0001',
          }}>
            {successMessage}
          </div>
        )}
            <button onClick={closeModal} style={{ position: 'absolute', top: 18, right: 18, fontSize: 22, background: 'none', border: 'none', cursor: 'pointer', color: '#1e3a8a', fontWeight: 700 }}>×</button>
            <div style={{ fontWeight: 700, fontSize: 22, color: '#fff', background: '#1e3a8a', borderRadius: 8, padding: '10px 32px', marginBottom: 18, textAlign: 'center', letterSpacing: 1 }}>{selectedProf}</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: 10, overflow: 'hidden', boxShadow: '0 1px 4px #0001' }}>
              <thead>
                <tr style={{ background: '#f3f4f6' }}>
                  <th style={{ padding: '12px 0', fontSize: 15, fontWeight: 700, color: '#1e3a8a', letterSpacing: 1 }}>PROGRAM</th>
                  <th style={{ padding: '12px 0', fontSize: 15, fontWeight: 700, color: '#1e3a8a', letterSpacing: 1 }}>COURSE NAME</th>
                  <th style={{ padding: '12px 0', fontSize: 15, fontWeight: 700, color: '#1e3a8a', letterSpacing: 1 }}>SECTION</th>
                  <th style={{ padding: '12px 0', fontSize: 15, fontWeight: 700, color: '#1e3a8a', letterSpacing: 1 }}>SUBSTITUTE INSTRUCTOR</th>
                </tr>
              </thead>
              <tbody>
                {subjects.map((subj, idx) => {
                  // DEBUG: Log subject and all faculty with their courses
                  console.log('DEBUG: Subject', subj);
                  faculty.forEach(f => {
                    console.log('DEBUG: Faculty', f.name, f.courses);
                  });
                  // Compute qualified faculty for this subject
                  const qualifiedFaculty = faculty.filter(f => {
                    if (f.name === selectedProf) return false;
                    const norm = s => String(s || '').replace(/\s+/g, '').toLowerCase();
                    const subjCourseName = norm(subj.courseName);
                    const subjCourseCode = norm(subj.courseCode);
                    const subjProgram = norm(subj.program);
                    const teachesSubject = f.courses.some(c => {
                      const courseNameNorm = norm(c.courseName);
                      const courseCodeNorm = norm(c.courseCode);
                      const courseProgramNorm = norm(c.program);
                      const codeMatch = courseCodeNorm && (courseCodeNorm === subjCourseCode || subjCourseName.includes(courseCodeNorm));
                      const nameMatch = courseNameNorm && (courseNameNorm === subjCourseName || subjCourseName.includes(courseNameNorm) || courseNameNorm.includes(subjCourseName));
                      const programMatch = !subjProgram || !courseProgramNorm || courseProgramNorm === subjProgram;
                      return (codeMatch || nameMatch) && programMatch;
                    });
                    if (!teachesSubject) {
                      console.log('DEBUG: Faculty', f.name, 'NOT QUALIFIED for', subj.courseName, subj.courseCode, subj.program);
                      return false;
                    }
                    const origSchedule = subjects[idx];
                    const schedules = professorSchedules[f.name] || [];
                    // Robust time overlap detection
                    const parseToMinutes = (label) => {
                      if (!label) return null;
                      // Normalize e.g., '7:00AM', '7:00 AM', '07:00', '7:30pm'
                      const raw = String(label).trim().toLowerCase().replace(/\s+/g, '');
                      const m = raw.match(/^(\d{1,2}):(\d{2})(am|pm)?$/i) || raw.match(/^(\d{1,2})(am|pm)$/i);
                      if (m) {
                        let hh = parseInt(m[1], 10);
                        let mm = m[2] ? parseInt(m[2], 10) : 0;
                        const ampm = (m[3] || m[2] && m[2].match(/(am|pm)/i) ? (m[2].match(/(am|pm)/i) || [])[0] : '') || '';
                        const suffix = (m[3] || '').toLowerCase();
                        if (suffix === 'pm' && hh !== 12) hh += 12;
                        if (suffix === 'am' && hh === 12) hh = 0;
                        return hh * 60 + mm;
                      }
                      // Try 24-hour with colon
                      const m2 = raw.match(/^(\d{1,2}):(\d{2})$/);
                      if (m2) {
                        const hh = parseInt(m2[1], 10);
                        const mm = parseInt(m2[2], 10);
                        return hh * 60 + mm;
                      }
                      return null;
                    };

                    const origDay = String(origSchedule.day || '').toLowerCase();
                    const origStartMin = parseToMinutes(origSchedule.startTime);
                    const origEndMin = parseToMinutes(origSchedule.endTime || origSchedule.startTime);

                    const conflict = schedules.some(sched => {
                      const sDay = String(sched.day || '').toLowerCase();
                      if (sDay !== origDay) return false;
                      const sStartMin = parseToMinutes(sched.startTime);
                      const sEndMin = parseToMinutes(sched.endTime || sched.startTime);
                      if (origStartMin === null || sStartMin === null) {
                        // Fallback to exact string compare when parsing fails
                        const normalizeTime = t => String(t || '').replace(/\s/g, '').toLowerCase();
                        if (normalizeTime(sched.startTime) === normalizeTime(origSchedule.startTime)) return true;
                        return false;
                      }
                      // If we have both ranges, check overlap: [start, end)
                      return origStartMin < sEndMin && sStartMin < origEndMin;
                    });
                    if (conflict) {
                      console.log('DEBUG: Faculty', f.name, 'CONFLICT for', subj.courseName, subj.day, subj.startTime);
                    }
                    return !conflict;
                  });
                  console.log('DEBUG: Qualified faculty for', subj.courseName, qualifiedFaculty.map(f => f.name));
                  return (
                    <tr key={idx} style={{ borderBottom: '1px solid #e5e7eb' }}>
                      <td style={{ padding: '12px 0', textAlign: 'center', fontWeight: 600, fontSize: 15 }}>{subj.program}</td>
                      <td style={{ padding: '12px 0', textAlign: 'center', fontWeight: 600, fontSize: 15 }}>{subj.courseName}</td>
                      <td style={{ padding: '12px 0', textAlign: 'center', fontWeight: 600, fontSize: 15 }}>{subj.section}</td>
                      <td style={{ padding: '12px 0', textAlign: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
                          <select
                            value={substitutes[idx] || ''}
                            onChange={e => handleSubstituteChange(idx, e.target.value)}
                            style={{
                              padding: '6px 18px',
                              borderRadius: 6,
                              border: '1px solid #d1d5db',
                              fontSize: 15,
                              fontWeight: 600,
                              textAlign: 'center',
                              background: '#f3f4f6',
                            }}
                          >
                            <option value="">Select substitute...</option>
                            {qualifiedFaculty.map(f => (
                              <option key={f.name} value={f.name}>{f.name}</option>
                            ))}
                          </select>

                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
              <button
                onClick={handleSave}
                style={{
                  background: '#1e3a8a',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  padding: '10px 32px',
                  fontWeight: 700,
                  fontSize: 18,
                  cursor: 'pointer',
                  boxShadow: '0 1px 4px #0001',
                  letterSpacing: 1,
                  flex: 1
                }}
              >Save</button>
              <button
                onClick={handleClearAll}
                style={{
                  background: '#ef4444',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  padding: '10px 32px',
                  fontWeight: 700,
                  fontSize: 18,
                  cursor: 'pointer',
                  boxShadow: '0 1px 4px #0001',
                  letterSpacing: 1,
                  flex: 1
                }}
              >Archive All</button>
            </div>

            {/* List of current substitute assignments for this professor */}
            <div style={{ marginTop: 36 }}>
              <h3 style={{ fontWeight: 700, fontSize: 18, color: '#1e3a8a', marginBottom: 12 }}>Current Substitutes</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse', background: '#f9fafb', borderRadius: 8, overflow: 'hidden', boxShadow: '0 1px 4px #0001' }}>
                <thead>
                  <tr style={{ background: '#e5e7eb' }}>
                    <th style={{ padding: '10px 0', fontSize: 15, fontWeight: 700, color: '#1e3a8a' }}>PROGRAM</th>
                    <th style={{ padding: '10px 0', fontSize: 15, fontWeight: 700, color: '#1e3a8a' }}>COURSE NAME</th>
                    <th style={{ padding: '10px 0', fontSize: 15, fontWeight: 700, color: '#1e3a8a' }}>SECTION</th>
                    <th style={{ padding: '10px 0', fontSize: 15, fontWeight: 700, color: '#1e3a8a' }}>DAY</th>
                    <th style={{ padding: '10px 0', fontSize: 15, fontWeight: 700, color: '#1e3a8a' }}>TIME</th>
                    <th style={{ padding: '10px 0', fontSize: 15, fontWeight: 700, color: '#1e3a8a' }}>SUBSTITUTE INSTRUCTOR</th>
                  </tr>
                </thead>
                <tbody>
                  {subjects.filter(subj => subj.substituteTeacher).map((subj, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #e5e7eb' }}>
                      <td style={{ padding: '10px 0', textAlign: 'center', fontWeight: 600 }}>{subj.program}</td>
                      <td style={{ padding: '10px 0', textAlign: 'center', fontWeight: 600 }}>{subj.courseName}</td>
                      <td style={{ padding: '10px 0', textAlign: 'center', fontWeight: 600 }}>{subj.section}</td>
                      <td style={{ padding: '10px 0', textAlign: 'center', fontWeight: 600 }}>{subj.day}</td>
                      <td style={{ padding: '10px 0', textAlign: 'center', fontWeight: 600 }}>
                        {subj.startTime}{subj.endTime ? ` - ${subj.endTime}` : ''}
                      </td>
                      <td style={{ padding: '10px 0', textAlign: 'center', fontWeight: 600 }}>
                        <span style={{ color: '#22c55e', fontWeight: 700 }}>{subj.substituteTeacher}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}