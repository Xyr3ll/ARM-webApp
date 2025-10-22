import React, { useEffect, useMemo, useState } from 'react';
import '../../styles/AcademicHeadDashboard.css';
import stiLogo from '../../assets/stilogo.png';
import { db } from '../../firebase';
import { collection, doc, onSnapshot, query, serverTimestamp, setDoc, where, getDocs } from 'firebase/firestore';

const ArchivedClassSchedule = () => {
  const [year, setYear] = useState('2025-2026');
  const [program, setProgram] = useState('BSIT');
  const [archivedGroups, setArchivedGroups] = useState({});
  const [viewing, setViewing] = useState(null); // { id, name, schedule }

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

  // Map short semester to label suffix
  const semesterLabel = (sem) => {
    if (String(sem).toLowerCase().startsWith('1')) return '1st Semester';
    if (String(sem).toLowerCase().startsWith('2')) return '2nd Semester';
    if (String(sem).toLowerCase().startsWith('sum')) return 'Summer';
    return String(sem || '');
  };

  // Real-time: fetch archived schedules for selected program from root collection only
  useEffect(() => {
    const q = query(
      collection(db, 'schedules'),
      where('program', '==', program),
      where('status', '==', 'archived')
    );
    const unsub = onSnapshot(q, (snap) => {
      const groups = {};
      snap.forEach((docSnap) => {
        const data = docSnap.data() || {};
        
        // Filter by year if specified
        if (year) {
          const docYear = data.year || '';
          const yearMatch = docYear === year || 
                           docYear.startsWith(year.split('-')[0]) ||
                           year.startsWith(docYear.split('-')[0]);
          if (!yearMatch) return;
        }
        
        const sectionName = data.sectionName || docSnap.id;
        const yl = data.yearLevel || 'Unknown Year';
        const sem = semesterLabel(data.semester || '');
        const groupKey = sem === 'Summer' ? `${yl} - Summer` : `${yl} - ${sem}`;
        if (!groups[groupKey]) groups[groupKey] = [];
        groups[groupKey].push({ id: docSnap.id, name: sectionName, schedule: data.schedule || {} });
      });
      // Sort group sections alphabetically for stable UI
      Object.keys(groups).forEach((k) => {
        groups[k].sort((a, b) => String(a.name).localeCompare(String(b.name)));
      });
      setArchivedGroups(groups);
    });
    return () => unsub();
  }, [program, year]);

  const handleView = async (sectionId) => {
    // Find the first match across groups
    let found = null;
    for (const sections of Object.values(archivedGroups)) {
      const f = (sections || []).find((s) => s.id === sectionId);
      if (f) {
        found = f;
        break;
      }
    }
    if (!found) return;

    // If schedule is present, show it
    if (found.schedule && Object.keys(found.schedule).length > 0) {
      setViewing(found);
      return;
    }

    // Fallback: try to query schedules collection by sectionName + program to find any schedule stored elsewhere
    try {
      const q = query(
        collection(db, 'schedules'),
        where('sectionName', '==', found.name),
        where('program', '==', program)
      );
      const snap = await getDocs(q);
      let used = false;
      snap.forEach((docSnap) => {
        if (used) return;
        const data = docSnap.data() || {};
        const sched = data.schedule || {};
        const isArchived = String(data.status || '').toLowerCase() === 'archived';
        // prefer non-archived with schedule, but accept archived as fallback
        if (sched && Object.keys(sched).length > 0) {
          setViewing({ id: docSnap.id, name: found.name, schedule: sched });
          used = true;
        }
      });
      if (!used) {
        alert('No schedule data found for this archived section.');
      }
    } catch (e) {
      console.error(e);
      alert('Failed to load schedule');
    }
  };

  const handleSubmit = async (sectionDocId) => {
    try {
      const ok = window.confirm('Submit this schedule now? It will be removed from Archived.');
      if (!ok) return;
      const ref = doc(db, 'schedules', sectionDocId);
      await setDoc(ref, { status: 'submitted', updatedAt: serverTimestamp() }, { merge: true });
      // onSnapshot will auto-refresh and remove it from the list
    } catch (e) {
      alert('Failed to submit: ' + (e?.message || e));
    }
  };

  // Helpers to render read-only timetable
  const timeSlots = useMemo(
    () => [
      '7:00AM','7:30AM','8:00AM','8:30AM','9:00AM','9:30AM','10:00AM','10:30AM',
      '11:00AM','11:30AM','12:00PM','12:30PM','1:00PM','1:30PM','2:00PM','2:30PM',
      '3:00PM','3:30PM','4:00PM','4:30PM','5:00PM','5:30PM','6:00PM','6:30PM',
      '7:00PM','7:30PM','8:00PM','8:30PM','9:00PM'
    ],
    []
  );
  const days = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const getTimeIndex = (t) => timeSlots.indexOf(t);

  const deriveSpan = (entryKey, entryVal) => {
    // Prefer stored durationSlots; fallback to endTime-derived span
    if (entryVal?.durationSlots && Number.isFinite(entryVal.durationSlots)) {
      return Math.max(1, Number(entryVal.durationSlots));
    }
    const [, startTime] = String(entryKey).split('_');
    const sIdx = getTimeIndex(startTime);
    const eIdx = getTimeIndex(entryVal?.endTime);
    if (sIdx !== -1 && eIdx !== -1 && eIdx > sIdx) return (eIdx - sIdx) + 1; // +1 to align to table rows
    return 1;
  };
  const isCovered = (sched, day, timeIdx) => {
    for (const [k, v] of Object.entries(sched || {})) {
      const [d, t] = String(k).split('_');
      if (d !== day) continue;
      const sIdx = getTimeIndex(t);
      if (sIdx === -1) continue;
      const span = deriveSpan(k, v);
      if (timeIdx > sIdx && timeIdx < sIdx + span) return true;
    }
    return false;
  };

  return (
    <div style={{ padding: '32px 0 0 0' }}>
      <h2 style={{ fontWeight: 700, fontSize: 28, marginBottom: 18 }}>Archived Classes</h2>
      <div style={{ display: 'flex', gap: 12, marginBottom: 18 }}>
        <input
          type="text"
          value={year} 
          onChange={handleYearChange}
          placeholder="e.g., 2019, 2020, 2025..."
          maxLength={9}
          style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #ccc', fontSize: 16, minWidth: 180 }}
        />
        <select
          value={program}
          onChange={e => setProgram(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #ccc', fontSize: 16 }}
        >
          <option value="BSIT">BSIT</option>
          <option value="BSCS">BSCS</option>
          <option value="CPE">CPE</option>
        </select>
      </div>
      <h3 style={{ fontWeight: 700, fontSize: 20, marginBottom: 24 }}>
        {program === 'BSIT' && 'Bachelor of Science in Information Technology'}
        {program === 'BSCS' && 'Bachelor of Science in Computer Science'}
        {program === 'CPE' && 'Bachelor of Science in Computer Engineering'}
        ({year || new Date().getFullYear()})
      </h3>
      <div style={{ display: 'flex', gap: 32 }}>
        {Object.entries(archivedGroups).map(([group, sections]) => (
          <div key={group} style={{ minWidth: 340 }}>
            <div style={{ background: '#1565c0', color: '#fff', borderRadius: '6px 6px 0 0', padding: '8px 18px', fontWeight: 700, fontSize: 18, marginBottom: 0 }}>
              {group}
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
              <thead>
                <tr style={{ background: '#f5f5f5' }}>
                  <th style={{ padding: '10px 0', fontWeight: 700, fontSize: 16 }}>SECTION</th>
                  <th style={{ padding: '10px 0', fontWeight: 700, fontSize: 16 }}>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {sections.map(section => (
                  <tr key={section.id} style={{ background: '#fff' }}>
                    <td style={{ padding: '12px 0', textAlign: 'center', fontWeight: 600 }}>{section.name}</td>
                    <td style={{ padding: '12px 0', textAlign: 'center' }}>
                      <div style={{ display: 'flex', justifyContent: 'center', gap: 10 }}>
                        <button
                          style={{ background: '#1de782', color: '#222', border: 'none', borderRadius: 18, padding: '6px 18px', fontWeight: 700, fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
                          onClick={() => handleView(section.id)}
                        >
                          <span role="img" aria-label="View" style={{ fontSize: 18 }}>👁️</span> View
                        </button>
                        <button
                          style={{ background: '#1565c0', color: '#fff', border: 'none', borderRadius: 18, padding: '6px 18px', fontWeight: 700, fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
                          onClick={() => handleSubmit(section.id)}
                          title="Submit to restore from archive"
                        >
                          Submit
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>

      {viewing && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
          }}
          onClick={() => setViewing(null)}
        >
          <div
            style={{
              background: '#fff', borderRadius: 12, width: '90%', maxWidth: 1100,
              maxHeight: '85vh', overflow: 'hidden', boxShadow: '0 10px 30px rgba(0,0,0,0.2)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid #e5e7eb' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <img src={stiLogo} alt="STI" style={{ height: 28 }} />
                <div style={{ fontWeight: 800, fontSize: 18 }}>{viewing.name}</div>
              </div>
              <button
                onClick={() => setViewing(null)}
                style={{ background: '#111', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 12px', fontWeight: 700, cursor: 'pointer' }}
              >Close</button>
            </div>

            <div style={{ padding: 16, overflow: 'auto', maxHeight: 'calc(85vh - 56px)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'Alata, sans-serif' }}>
                <thead>
                  <tr>
                    <th style={{ border: '1px solid #ddd', padding: '6px 8px', background: '#f5f5f5', fontWeight: 800 }}>Time</th>
                    {days.map((d) => (
                      <th key={d} style={{ border: '1px solid #ddd', padding: '6px 8px', background: '#f5f5f5', fontWeight: 700 }}>{d}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {timeSlots.map((time, ti) => (
                    <tr key={time}>
                      <td style={{ border: '1px solid #ddd', padding: '6px 8px', fontWeight: 700, background: '#fafafa' }}>{time}</td>
                      {days.map((day) => {
                        const key = `${day}_${time}`;
                        const scheduled = viewing?.schedule?.[key];
                        if (!scheduled && isCovered(viewing?.schedule, day, ti)) return null;
                        const span = scheduled ? deriveSpan(key, scheduled) : 1;
                        return (
                          <td
                            key={key}
                            rowSpan={span}
                            style={{
                              border: '1px solid #ddd', padding: '6px 8px', minWidth: 120,
                              background: scheduled ? '#fef08a' : '#fff', position: 'relative'
                            }}
                          >
                            {scheduled && (
                              <div style={{ fontWeight: 700, color: '#111' }}>
                                <div style={{ marginBottom: 6 }}>{scheduled.subject}</div>
                                <div style={{ fontSize: 12, opacity: 0.85 }}>
                                  {time}{scheduled.endTime ? ` - ${scheduled.endTime}` : ''}
                                  {scheduled.room ? ` • ${scheduled.room}` : ''}
                                </div>
                              </div>
                            )}
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
      )}
    </div>
  );
};

export default ArchivedClassSchedule;
