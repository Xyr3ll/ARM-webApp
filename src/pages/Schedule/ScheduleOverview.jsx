import React, { useState, useEffect } from 'react';
import './Schedule.css';
import { HiArrowLeft, HiPrinter } from 'react-icons/hi2';
import { useNavigate } from 'react-router-dom';
import { db } from '../../firebase';
import { collection, query, where, onSnapshot, doc, getDocs, getDoc } from 'firebase/firestore';
import * as XLSX from 'xlsx';

const ScheduleOverview = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('sections');
  const [selectedProgram, setSelectedProgram] = useState('All');
  const [selectedSemester, setSelectedSemester] = useState('1st');
  const [selectedYearLevel, setSelectedYearLevel] = useState('1st Year');
  const [selectedYear, setSelectedYear] = useState('');
  // Final merged data shown in UI
  const [sectionsData, setSectionsData] = useState({});
  const [roomsData, setRoomsData] = useState({});
  const [selectedSection, setSelectedSection] = useState(null);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [isPrintAll, setIsPrintAll] = useState(false);
  // Root-based real-time data
  const [rootSectionsData, setRootSectionsData] = useState({});
  const [rootRoomsData, setRootRoomsData] = useState({});
  // Nested path fallback real-time data
  const [nestedSectionsData, setNestedSectionsData] = useState({});
  const [nestedRoomsData, setNestedRoomsData] = useState({});
  const [professorsData, setProfessorsData] = useState({});
  const [selectedProfessor, setSelectedProfessor] = useState(null);
  const [professorSearch, setProfessorSearch] = useState('');

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

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

      if (year > currentYear) {
        alert(`Cannot select a year beyond ${currentYear}. Please enter ${currentYear} or earlier.`);
        return;
      }
    }

    const formatted = formatSchoolYear(value);
    setSelectedYear(formatted);
  };

  // Fetch schedules from Firestore in real time (root collection)
  useEffect(() => {
    // build query but treat 'All' as no-filter
    let base = collection(db, 'schedules');
    let q = base;
    if (selectedProgram && selectedProgram !== 'All') {
      q = query(q, where('program', '==', selectedProgram));
    }
    if (selectedSemester && selectedSemester !== 'All') {
      q = query(q, where('semester', '==', selectedSemester));
    }
    if (selectedYearLevel && selectedYearLevel !== 'All') {
      q = query(q, where('yearLevel', '==', selectedYearLevel));
    }
    const unsub = onSnapshot(q, (snap) => {
      const sectionSchedules = {};
      const roomSchedules = {};
      snap.forEach((docSnap) => {
        const data = docSnap.data();
        // Skip archived schedules
        if (String(data?.status).toLowerCase() === 'archived') return;

        // Filter by year if specified
        if (selectedYear) {
          const docYear = data.year || '';
          const yearMatch = docYear === selectedYear ||
            docYear.startsWith(selectedYear.split('-')[0]) ||
            selectedYear.startsWith(docYear.split('-')[0]);
          if (!yearMatch) return;
        }

        const sectionName = data.sectionName || docSnap.id;
        const schedule = data.schedule || {};
        // Build section schedules
        const sectionItems = [];
        Object.entries(schedule).forEach(([key, val]) => {
          const [day, time] = key.split('_');
          if (val && val.subject) {
            sectionItems.push({
              day,
              startTime: time,
              endTime: val.endTime || '',
              durationSlots: val.durationSlots || undefined,
              subject: val.subject,
              room: val.room || ''
            });
          }
        });
        sectionSchedules[sectionName] = sectionItems;
        // Build room schedules
        sectionItems.forEach(item => {
          if (item.room) {
            if (!roomSchedules[item.room]) roomSchedules[item.room] = [];
            roomSchedules[item.room].push({
              day: item.day,
              startTime: item.startTime,
              endTime: item.endTime,
              durationSlots: item.durationSlots,
              subject: item.subject,
              section: sectionName
            });
          }
        });
      });
      setRootSectionsData(sectionSchedules);
      setRootRoomsData(roomSchedules);
    });
    return () => unsub();
  }, [selectedProgram, selectedSemester, selectedYearLevel, selectedYear]);

  // Also listen in real-time to nested schedule docs under gradeLevelSection/<program>/sections
  useEffect(() => {
    const programDoc = doc(db, 'gradeLevelSection', String(selectedProgram || ''));
    const sectionsCol = collection(programDoc, 'sections');
    const unsubscribers = [];

    const unsubSections = onSnapshot(sectionsCol, (sectionsSnap) => {
      setNestedSectionsData({});
      const localUnsubs = [];
      sectionsSnap.forEach((sec) => {
        const secName = (sec.data()?.sectionName) || sec.id;
        const schedDoc = doc(programDoc, 'sections', sec.id, 'schedule', 'calendar');
        const unsubSched = onSnapshot(schedDoc, (schedSnap) => {
          const data = schedSnap.data();
          // Skip archived schedules in nested path as well
          if (String(data?.status).toLowerCase() === 'archived') {
            setNestedSectionsData((prev) => ({ ...prev, [secName]: [] }));
            return;
          }
          const schedule = data?.schedule || {};
          // Only include schedules that match the selected semester and year level, if the fields exist
          // If user selects 'All', treat it as no-filter
          const matchesSemester = !data?.semester || selectedSemester === 'All' || data.semester === selectedSemester;
          const matchesYearLevel = !data?.yearLevel || selectedYearLevel === 'All' || data.yearLevel === selectedYearLevel;

          // Filter by year if specified
          let matchesYear = true;
          if (selectedYear && data?.year) {
            const docYear = data.year;
            matchesYear = docYear === selectedYear ||
              docYear.startsWith(selectedYear.split('-')[0]) ||
              selectedYear.startsWith(docYear.split('-')[0]);
          }

          const items = [];
          if (matchesSemester && matchesYearLevel && matchesYear) {
            Object.entries(schedule).forEach(([key, val]) => {
              const [day, time] = key.split('_');
              if (!val || !val.subject) return;
              items.push({
                day,
                startTime: time,
                endTime: val.endTime || '',
                durationSlots: val.durationSlots || undefined,
                subject: val.subject,
                room: val.room || ''
              });
            });
          }
          setNestedSectionsData((prev) => ({ ...prev, [secName]: items }));
        });
        localUnsubs.push(unsubSched);
      });
      unsubscribers.splice(0, unsubscribers.length, ...localUnsubs);
    });

    return () => {
      unsubSections();
      unsubscribers.forEach((u) => { try { u(); } catch { } });
    };
  }, [selectedProgram, selectedSemester, selectedYearLevel, selectedYear]);

  // Build nested rooms map whenever nested sections change
  useEffect(() => {
    const rooms = {};
    Object.entries(nestedSectionsData).forEach(([sectionName, items]) => {
      (items || []).forEach((item) => {
        if (!item.room) return;
        if (!rooms[item.room]) rooms[item.room] = [];
        rooms[item.room].push({ ...item, section: sectionName });
      });
    });
    setNestedRoomsData(rooms);
  }, [nestedSectionsData]);

  // Merge: prefer root schedules when present; otherwise use nested fallback
  useEffect(() => {
    const useRoot = Object.keys(rootSectionsData).length > 0;
    setSectionsData(useRoot ? rootSectionsData : nestedSectionsData);
    setRoomsData(useRoot ? rootRoomsData : nestedRoomsData);
  }, [rootSectionsData, nestedSectionsData, rootRoomsData, nestedRoomsData]);

  // Build professors data from schedules with professor assignments
  // For professors tab: fetch ALL schedules regardless of filters to show complete schedule
  useEffect(() => {
    const q = query(collection(db, 'schedules'));

    const unsubSchedules = onSnapshot(q, async (snap) => {
      const professorSchedules = {};

      // helper to process a schedule document's data
      const processScheduleDoc = (data, sectionName) => {
        if (!data) return;
        if (String(data?.status).toLowerCase() === 'archived') return;
        const schedule = data.schedule || {};
        const professorAssignments = data.professorAssignments || {};
        Object.entries(schedule).forEach(([key, val]) => {
          const [day, time] = key.split('_');
          let professor = professorAssignments && professorAssignments[key];
          if (!professor && val) {
            professor = val.professor || val.instructor || val.professorName || val.assignedProfessor || val.professorAssigned;
            if (typeof professor === 'object' && professor !== null) {
              professor = professor.name || professor.professor || professor.fullName || '';
            }
          }
          if (typeof professor === 'string') professor = professor.trim();
          if (professor && val && val.subject) {
            if (!professorSchedules[professor]) professorSchedules[professor] = [];
            professorSchedules[professor].push({
              day,
              startTime: time,
              endTime: val.endTime || '',
              durationSlots: val.durationSlots || undefined,
              subject: val.subject,
              room: val.room || '',
              section: sectionName,
              yearLevel: data.yearLevel,
              program: data.program,
              semester: data.semester
            });
          }
        });
      };

      // process root schedules
      snap.forEach((docSnap) => {
        const data = docSnap.data();
        const sectionName = data.sectionName || docSnap.id;
        processScheduleDoc(data, sectionName);
      });

      // Also include nested schedules under gradeLevelSection/*/sections/*/schedule/calendar (one-time fetch)
      try {
        const gradeLevelSnap = await getDocs(collection(db, 'gradeLevelSection'));
        for (const progDoc of gradeLevelSnap.docs) {
          const sectionsSnap = await getDocs(collection(db, 'gradeLevelSection', progDoc.id, 'sections'));
          for (const secDoc of sectionsSnap.docs) {
            const schedRef = doc(db, 'gradeLevelSection', progDoc.id, 'sections', secDoc.id, 'schedule', 'calendar');
            const schedSnap = await getDoc(schedRef);
            const schedData = schedSnap.exists() ? schedSnap.data() : null;
            const secName = secDoc.data()?.sectionName || secDoc.id;
            processScheduleDoc(schedData, secName);
          }
        }
      } catch (err) {
        console.warn('Failed to include nested schedules for professors:', err);
      }

      // Now fetch faculty data to add non-teaching hours AND filter archived faculty
      const facultyQuery = query(collection(db, 'faculty'));
      const unsubFaculty = onSnapshot(facultyQuery, (facultySnap) => {
        const archivedProfessors = new Set();
        facultySnap.forEach((facultyDoc) => {
          const facultyData = facultyDoc.data();
          const professorName = facultyData.professor;
          if (String(facultyData?.status).toLowerCase() === 'archived') {
            archivedProfessors.add(professorName);
            return;
          }
          const nonTeachingHours = facultyData.nonTeachingHours || [];
          if (professorName && nonTeachingHours.length > 0 && professorSchedules[professorName]) {
            nonTeachingHours.forEach((assignment) => {
              if (assignment.day && assignment.time && assignment.type) {
                professorSchedules[professorName].push({
                  day: assignment.day,
                  startTime: assignment.time,
                  endTime: '',
                  durationSlots: assignment.hours || 1,
                  subject: assignment.type === 'Consultation' ? 'CONSULTATION' : 'ADMIN',
                  room: '',
                  section: ''
                });
              }
            });
          }
        });
        archivedProfessors.forEach(prof => { delete professorSchedules[prof]; });
        setProfessorsData(professorSchedules);
      });

      // No explicit cleanup for unsubFaculty here because onSnapshot will return a function only within this handler scope
      // It will be cleaned up when the component unmounts via unsubSchedules above.
    });

    return () => unsubSchedules();
  }, []); // No dependencies - fetch all schedules

  const renderScheduleGrid = (scheduleData, entityName) => {
    // Enhanced time slots to cover full day
    const fullTimeSlots = [
      '7:00AM', '7:30AM', '8:00AM', '8:30AM', '9:00AM', '9:30AM', '10:00AM', '10:30AM',
      '11:00AM', '11:30AM', '12:00PM', '12:30PM', '1:00PM', '1:30PM', '2:00PM', '2:30PM',
      '3:00PM', '3:30PM', '4:00PM', '4:30PM', '5:00PM', '5:30PM', '6:00PM', '6:30PM', '7:00PM', '7:30PM', '8:00PM', '8:30PM'
    ];
    const rowHeight = 40; // keep in sync with .schedule-grid-row min-height
    const getTimeIndex = (t) => fullTimeSlots.indexOf(t);

    const getScheduleForSlot = (day, time) => scheduleData.find(item => item.day === day && item.startTime === time);
    const getVisualSlots = (item) => {
      if (!item) return 1;
      if (item.durationSlots && Number.isFinite(item.durationSlots)) return Math.max(1, item.durationSlots);
      // derive from endTime as exclusive boundary if needed
      if (item.endTime) {
        const s = getTimeIndex(item.startTime);
        const e = getTimeIndex(item.endTime);
        if (s !== -1 && e !== -1 && e > s) return (e - s) + 1; // +1 to align with editor visual span
      }
      return 1;
    };

    // Calculate end time based on duration slots
    const calculateEndTime = (startTime, durationSlots) => {
      const startIdx = getTimeIndex(startTime);
      if (startIdx === -1 || !durationSlots) return '';
      const endIdx = startIdx + Math.floor(durationSlots);
      return endIdx < fullTimeSlots.length ? fullTimeSlots[endIdx] : '';
    };

    const getCellStyle = (subject) => {
      if (!subject) return {};
      if (subject.includes('CONSULTATION')) return { background: '#93c5fd', color: '#1e3a8a' };
      if (subject.includes('ADMIN')) return { background: '#fca5a5', color: '#7f1d1d' };
      return { background: '#fef08a', color: '#000' };
    };

    return (
      <div className="schedule-grid-wrapper">
        <div className="schedule-grid-header">
          <div className="schedule-time-column-header"></div>
          {days.map(day => (
            <div key={day} className="schedule-day-header">{day}</div>
          ))}
        </div>
        <div className="schedule-grid-body">
          {fullTimeSlots.map(time => (
            <div key={time} className="schedule-grid-row">
              <div className="schedule-time-cell">{time}</div>
              {days.map(day => {
                const schedule = getScheduleForSlot(day, time);
                return (
                  <div key={`${day}-${time}`} className="schedule-cell">
                    {schedule && (() => {
                      const span = getVisualSlots(schedule);
                      const endTime = schedule.endTime || calculateEndTime(schedule.startTime, span);
                      const style = {
                        ...getCellStyle(schedule.subject),
                        position: 'absolute',
                        top: 0,
                        left: 4,
                        right: 4,
                        height: `${rowHeight * span - 4}px`,
                        zIndex: 2,
                        borderRadius: 4,
                        padding: 8,
                        boxSizing: 'border-box',
                        display: 'flex',
                        flexDirection: 'column',
                        fontSize: 11
                      };
                      return (
                        <div className="schedule-block" style={style}>
                          <div className="schedule-block-subject" style={{ fontWeight: 600, marginBottom: 4 }}>
                            {schedule.subject}
                          </div>
                          {schedule.room && (
                            <div className="schedule-block-room" style={{ fontSize: 10, opacity: 0.9, marginBottom: 2 }}>
                              {schedule.room}
                            </div>
                          )}
                          {schedule.section && (
                            <div className="schedule-block-section" style={{ fontSize: 10, opacity: 0.9, marginBottom: 2 }}>
                              {schedule.section}
                            </div>
                          )}
                          {schedule.startTime && (
                            <div style={{ fontSize: 10, opacity: 0.85, marginTop: 'auto', fontWeight: 500 }}>
                              {schedule.startTime}{endTime ? ` - ${endTime}` : ''}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    );
  };


  // Mini calendar card for section (summary, no grid)
  const renderMiniSectionCard = (section, schedule, isActive) => (
    <div
      key={section}
      className={`mini-section-card${isActive ? ' active' : ''}`}
      style={{
        background: '#fff',
        border: isActive ? '2px solid #eab308' : '1px solid #e5e7eb',
        borderRadius: 12,
        marginBottom: 18,
        boxShadow: '0 2px 8px #0001',
        cursor: 'pointer',
        padding: 18,
        minWidth: 200,
        maxWidth: 240,
        transition: 'border 0.2s',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
      }}
      onClick={() => setSelectedSection(section)}
    >
      <div style={{
        fontWeight: 700,
        marginBottom: 10,
        color: '#1e3a8a',
        fontSize: 18,
        letterSpacing: 0.5,
      }}>{section}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {schedule.slice(0, 6).map((item, idx) => (
          <div key={idx} style={{
            background: '#fef08a',
            color: '#000',
            borderRadius: 4,
            fontSize: 13,
            fontWeight: 500,
            padding: '6px 10px',
            marginBottom: 4,
            boxShadow: '0 1px 2px #0001',
            minWidth: 90,
            textAlign: 'center',
          }}>
            {item.subject.split('(')[0].trim()}
          </div>
        ))}
        {schedule.length > 6 && (
          <div style={{ fontSize: 12, color: '#888', alignSelf: 'center' }}>+{schedule.length - 6} more</div>
        )}
      </div>
    </div>
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'sections': {
        // Only show sections that have at least one schedule item
        const filteredSectionEntries = Object.entries(sectionsData).filter(([_, schedule]) => Array.isArray(schedule) && schedule.length > 0);
        if (filteredSectionEntries.length === 0) {
          return (
            <>
              <div className="schedule-filter-row" style={{ marginBottom: 18, display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  className="schedule-select"
                  value={selectedYear}
                  onChange={handleYearChange}
                  placeholder="e.g., 2019, 2020, 2025..."
                  maxLength={9}
                  style={{ minWidth: 160 }}
                />
                <select
                  className="schedule-select"
                  value={selectedProgram}
                  onChange={(e) => setSelectedProgram(e.target.value)}
                  style={{ minWidth: 120 }}
                >
                  <option value="All">All</option>
                  <option value="BSIT">BSIT</option>
                  <option value="BSCS">BSCS</option>
                </select>
                <select
                  className="schedule-select"
                  value={selectedYearLevel}
                  onChange={(e) => setSelectedYearLevel(e.target.value)}
                  style={{ minWidth: 120 }}
                >
                  <option value="All">All</option>
                  <option value="1st Year">1st Year</option>
                  <option value="2nd Year">2nd Year</option>
                  <option value="3rd Year">3rd Year</option>
                  <option value="4th Year">4th Year</option>
                </select>
                <select
                  className="schedule-select"
                  value={selectedSemester}
                  onChange={(e) => setSelectedSemester(e.target.value)}
                  style={{ minWidth: 120 }}
                >
                  <option value="All">All</option>
                  <option value="1st">1st Semester</option>
                  <option value="2nd">2nd Semester</option>
                </select>
              </div>
              <div style={{ textAlign: 'center', color: '#888', marginTop: 60, fontSize: 18 }}>
                No schedules found for this year level and semester.
              </div>
            </>
          );
        }
        // Default to first section if none selected
        const selected = selectedSection && sectionsData[selectedSection] && sectionsData[selectedSection].length > 0
          ? selectedSection
          : (filteredSectionEntries[0]?.[0] || null);
        // If selectedSection is not in data, update it
        if (selectedSection !== selected) setSelectedSection(selected);
        return (
          <>
            <div className="schedule-filter-row" style={{ marginBottom: 18, display: 'flex', gap: 8 }}>
              <input
                type="text"
                className="schedule-select"
                value={selectedYear}
                onChange={handleYearChange}
                placeholder="e.g., 2019, 2020, 2025..."
                maxLength={9}
                style={{ minWidth: 160 }}
              />
              <select
                className="schedule-select"
                value={selectedProgram}
                onChange={(e) => setSelectedProgram(e.target.value)}
                style={{ minWidth: 120 }}
              >
                <option value="All">All</option>
                <option value="BSIT">BSIT</option>
                <option value="BSCS">BSCS</option>
              </select>
              <select
                className="schedule-select"
                value={selectedYearLevel}
                onChange={(e) => setSelectedYearLevel(e.target.value)}
                style={{ minWidth: 120 }}
              >
                <option value="All">All</option>
                <option value="1st Year">1st Year</option>
                <option value="2nd Year">2nd Year</option>
                <option value="3rd Year">3rd Year</option>
                <option value="4th Year">4th Year</option>
              </select>
              <select
                className="schedule-select"
                value={selectedSemester}
                onChange={(e) => setSelectedSemester(e.target.value)}
                style={{ minWidth: 120 }}
              >
                <option value="All">All</option>
                <option value="1st">1st Semester</option>
                <option value="2nd">2nd Semester</option>
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 32, width: '100%' }}>
              <div style={{ flex: 1, minWidth: 0 }} className={isPrintAll ? '' : 'print-area'}>
                {selected && (
                  <div className="schedule-entity-card">
                    <h3 className="schedule-entity-title" style={{ color: '#1e3a8a', fontWeight: 700, fontSize: 24 }}>{selected}</h3>
                    {renderScheduleGrid(sectionsData[selected], selected)}
                  </div>
                )}
              </div>
              {isPrintAll && (
                <div
                  className="print-area print-all-container"
                  style={{ position: 'fixed', left: 0, top: 0, width: '100%', zIndex: 9999, background: '#fff', padding: 16 }}
                >
                  {filteredSectionEntries.map(([section, schedule]) => (
                    <div key={`printall-sec-${section}`} className="schedule-entity-card" style={{ marginBottom: 24, pageBreakAfter: 'always' }}>
                      <h3 className="schedule-entity-title" style={{ color: '#1e3a8a', fontWeight: 700, fontSize: 24 }}>{section}</h3>
                      {renderScheduleGrid(schedule, section)}
                    </div>
                  ))}
                </div>
              )}
              <div style={{ minWidth: 220, maxWidth: 260, maxHeight: 700, overflowY: 'auto', marginTop: 8, marginRight: 8 }}>
                {filteredSectionEntries.map(([section, schedule]) =>
                  renderMiniSectionCard(section, schedule, section === selected)
                )}
              </div>
            </div>
          </>
        );
      }
      case 'rooms': {
        // Only show rooms that have at least one schedule item
        const filteredRoomEntries = Object.entries(roomsData).filter(([_, schedule]) => Array.isArray(schedule) && schedule.length > 0);
        if (filteredRoomEntries.length === 0) {
          return (
            <>
              <div className="schedule-filter-row" style={{ marginBottom: 18, display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  className="schedule-select"
                  value={selectedYear}
                  onChange={handleYearChange}
                  placeholder="e.g., 2019, 2020, 2025..."
                  maxLength={9}
                  style={{ minWidth: 160 }}
                />
                <select
                  className="schedule-select"
                  value={selectedProgram}
                  onChange={(e) => setSelectedProgram(e.target.value)}
                  style={{ minWidth: 120 }}
                >
                  <option value="All">All</option>
                  <option value="BSIT">BSIT</option>
                  <option value="BSCS">BSCS</option>
                </select>
                <select
                  className="schedule-select"
                  value={selectedYearLevel}
                  onChange={(e) => setSelectedYearLevel(e.target.value)}
                  style={{ minWidth: 120 }}
                >
                  <option value="1st Year">1st Year</option>
                  <option value="2nd Year">2nd Year</option>
                  <option value="3rd Year">3rd Year</option>
                  <option value="4th Year">4th Year</option>
                </select>
                <select
                  className="schedule-select"
                  value={selectedSemester}
                  onChange={(e) => setSelectedSemester(e.target.value)}
                  style={{ minWidth: 120 }}
                >
                  <option value="1st">1st Semester</option>
                  <option value="2nd">2nd Semester</option>
                </select>
              </div>
              <div style={{ textAlign: 'center', color: '#888', marginTop: 60, fontSize: 18 }}>
                No room schedules found for this year level and semester.
              </div>
            </>
          );
        }

        // Determine selected room similar to sections behavior
        const selected = selectedRoom && roomsData[selectedRoom] && roomsData[selectedRoom].length > 0
          ? selectedRoom
          : (filteredRoomEntries[0]?.[0] || null);
        if (selectedRoom !== selected) setSelectedRoom(selected);

        // Mini card for rooms, mirroring sections UI
        const renderMiniRoomCard = (roomName, schedule, isActive) => (
          <div
            key={roomName}
            className={`mini-section-card${isActive ? ' active' : ''}`}
            style={{
              background: '#fff',
              border: isActive ? '2px solid #eab308' : '1px solid #e5e7eb',
              borderRadius: 12,
              marginBottom: 18,
              boxShadow: '0 2px 8px #0001',
              cursor: 'pointer',
              padding: 18,
              minWidth: 200,
              maxWidth: 240,
              transition: 'border 0.2s',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
            }}
            onClick={() => setSelectedRoom(roomName)}
          >
            <div style={{
              fontWeight: 700,
              marginBottom: 10,
              color: '#1e3a8a',
              fontSize: 18,
              letterSpacing: 0.5,
            }}>{roomName}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {schedule.slice(0, 6).map((item, idx) => (
                <div key={idx} style={{
                  background: '#fef08a',
                  color: '#000',
                  borderRadius: 4,
                  fontSize: 13,
                  fontWeight: 500,
                  padding: '6px 10px',
                  marginBottom: 4,
                  boxShadow: '0 1px 2px #0001',
                  minWidth: 90,
                  textAlign: 'center',
                }}>
                  {item.subject.split('(')[0].trim()}
                </div>
              ))}
              {schedule.length > 6 && (
                <div style={{ fontSize: 12, color: '#888', alignSelf: 'center' }}>+{schedule.length - 6} more</div>
              )}
            </div>
          </div>
        );

        return (
          <>
            <div className="schedule-filter-row" style={{ marginBottom: 18, display: 'flex', gap: 8 }}>
              <input
                type="text"
                className="schedule-select"
                value={selectedYear}
                onChange={handleYearChange}
                placeholder="e.g., 2019, 2020, 2025..."
                maxLength={9}
                style={{ minWidth: 160 }}
              />
              <select
                className="schedule-select"
                value={selectedProgram}
                onChange={(e) => setSelectedProgram(e.target.value)}
                style={{ minWidth: 120 }}
              >
                <option value="All">All</option>
                <option value="BSIT">BSIT</option>
                <option value="BSCS">BSCS</option>
              </select>
              <select
                className="schedule-select"
                value={selectedYearLevel}
                onChange={(e) => setSelectedYearLevel(e.target.value)}
                style={{ minWidth: 120 }}
              >
                <option value="All">All</option>
                <option value="1st Year">1st Year</option>
                <option value="2nd Year">2nd Year</option>
                <option value="3rd Year">3rd Year</option>
                <option value="4th Year">4th Year</option>
              </select>
              <select
                className="schedule-select"
                value={selectedSemester}
                onChange={(e) => setSelectedSemester(e.target.value)}
                style={{ minWidth: 120 }}
              >
                <option value="All">All</option>
                <option value="1st">1st Semester</option>
                <option value="2nd">2nd Semester</option>
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 32, width: '100%' }}>
              <div style={{ flex: 1, minWidth: 0 }} className={isPrintAll ? '' : 'print-area'}>
                {selected && (
                  <div className="schedule-entity-card">
                    <h3 className="schedule-entity-title" style={{ color: '#1e3a8a', fontWeight: 700, fontSize: 24 }}>{selected}</h3>
                    {renderScheduleGrid(roomsData[selected], selected)}
                  </div>
                )}
              </div>
              {isPrintAll && (
                <div
                  className="print-area print-all-container"
                  style={{ position: 'fixed', left: 0, top: 0, width: '100%', zIndex: 9999, background: '#fff', padding: 16 }}
                >
                  {filteredRoomEntries.map(([room, schedule]) => (
                    <div key={`printall-room-${room}`} className="schedule-entity-card" style={{ marginBottom: 24, pageBreakAfter: 'always' }}>
                      <h3 className="schedule-entity-title" style={{ color: '#1e3a8a', fontWeight: 700, fontSize: 24 }}>{room}</h3>
                      {renderScheduleGrid(schedule, room)}
                    </div>
                  ))}
                </div>
              )}
              <div style={{ minWidth: 220, maxWidth: 260, maxHeight: 700, overflowY: 'auto', marginTop: 8, marginRight: 8 }}>
                {filteredRoomEntries.map(([room, schedule]) =>
                  renderMiniRoomCard(room, schedule, room === selected)
                )}
              </div>
            </div>
          </>
        );
      }
      case 'professors': {
        // Only show professors that have at least one schedule item and match search
        const filteredProfessorEntries = Object.entries(professorsData).filter(([name, schedule]) => {
          if (!Array.isArray(schedule) || schedule.length === 0) return false;
          if (professorSearch && professorSearch.trim() !== '') {
            return String(name).toLowerCase().includes(professorSearch.trim().toLowerCase());
          }
          return true;
        });

        // If no matches, show a friendly message (search input is rendered at top-level)
        if (filteredProfessorEntries.length === 0) {
          return (
            <div style={{ textAlign: 'center', color: '#888', marginTop: 60, fontSize: 18 }}>
              No professor schedules found.
            </div>
          );
        }

        // Determine selected professor similar to sections behavior
        const selected = selectedProfessor && professorsData[selectedProfessor] && professorsData[selectedProfessor].length > 0
          ? selectedProfessor
          : (filteredProfessorEntries[0]?.[0] || null);
        if (selectedProfessor !== selected) setSelectedProfessor(selected);

        // Mini card for professors
        const renderMiniProfessorCard = (professorName, schedule, isActive) => (
          <div
            key={professorName}
            className={`mini-section-card${isActive ? ' active' : ''}`}
            style={{
              background: '#fff',
              border: isActive ? '2px solid #eab308' : '1px solid #e5e7eb',
              borderRadius: 12,
              marginBottom: 18,
              boxShadow: '0 2px 8px #0001',
              cursor: 'pointer',
              padding: 18,
              minWidth: 200,
              maxWidth: 240,
              transition: 'border 0.2s',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
            }}
            onClick={() => setSelectedProfessor(professorName)}
          >
            <div style={{
              fontWeight: 700,
              marginBottom: 10,
              color: '#1e3a8a',
              fontSize: 18,
              letterSpacing: 0.5,
            }}>{professorName}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {schedule.slice(0, 6).map((item, idx) => (
                <div key={idx} style={{
                  background: '#fef08a',
                  color: '#000',
                  borderRadius: 4,
                  fontSize: 13,
                  fontWeight: 500,
                  padding: '6px 10px',
                  marginBottom: 4,
                  boxShadow: '0 1px 2px #0001',
                  minWidth: 90,
                  textAlign: 'center',
                }}>
                  {item.subject.split('(')[0].trim()}
                </div>
              ))}
              {schedule.length > 6 && (
                <div style={{ fontSize: 12, color: '#888', alignSelf: 'center' }}>+{schedule.length - 6} more</div>
              )}
            </div>
          </div>
        );

        return (
          <>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 32, width: '100%' }}>
              <div style={{ flex: 1, minWidth: 0 }} className={isPrintAll ? '' : 'print-area'}>
                {selected && (
                  <div className="schedule-entity-card">
                    <h3 className="schedule-entity-title" style={{ color: '#1e3a8a', fontWeight: 700, fontSize: 24 }}>{selected}</h3>
                    {renderScheduleGrid(professorsData[selected], selected)}
                  </div>
                )}
              </div>
              {isPrintAll && (
                <div
                  className="print-area print-all-container"
                  style={{ position: 'fixed', left: 0, top: 0, width: '100%', zIndex: 9999, background: '#fff', padding: 16 }}
                >
                  {filteredProfessorEntries.map(([professor, schedule]) => (
                    <div key={`printall-prof-${professor}`} className="schedule-entity-card" style={{ marginBottom: 24, pageBreakAfter: 'always' }}>
                      <h3 className="schedule-entity-title" style={{ color: '#1e3a8a', fontWeight: 700, fontSize: 24 }}>{professor}</h3>
                      {renderScheduleGrid(schedule, professor)}
                    </div>
                  ))}
                </div>
              )}
              <div style={{ minWidth: 220, maxWidth: 260, maxHeight: 700, overflowY: 'auto', marginTop: 8, marginRight: 8 }}>
                {filteredProfessorEntries.map(([professor, schedule]) =>
                  renderMiniProfessorCard(professor, schedule, professor === selected)
                )}
              </div>
            </div>
          </>
        );
      }
      default:
        return null;
    }
  };


  const handlePrint = () => {
    // export current visible schedule as a formatted Excel timetable
    const fullTimeSlots = [
      '7:00AM', '7:30AM', '8:00AM', '8:30AM', '9:00AM', '9:30AM', '10:00AM', '10:30AM',
      '11:00AM', '11:30AM', '12:00PM', '12:30PM', '1:00PM', '1:30PM', '2:00PM', '2:30PM',
      '3:00PM', '3:30PM', '4:00PM', '4:30PM', '5:00PM', '5:30PM', '6:00PM', '6:30PM', '7:00PM', '7:30PM', '8:00PM', '8:30PM'
    ];

    const dayColumns = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    const dayIndex = (day) => dayColumns.indexOf(day);

    // helper to build a timetable sheet for a single entity (returns worksheet)
    const buildTimetableSheet = (scheduleArr = [], title = '') => {
      // create empty 2D array for AOA: header rows + time rows
      const headerRow = ['TIME', ...dayColumns];
      const aoa = [];
      aoa.push([title]);
      aoa.push([]);
      aoa.push(headerRow);
      // push time rows
      fullTimeSlots.forEach(t => {
        const row = [t];
        for (let i = 0; i < dayColumns.length; i++) row.push('');
        aoa.push(row);
      });

      const ws = XLSX.utils.aoa_to_sheet(aoa);

      // merges array
      const merges = [];

      // style helper (returns colors used for excel cell styling)
      const cellStyleFor = (subject) => {
        if (!subject) return { fill: { fgColor: { rgb: 'FFFFFFFF' } }, font: { bold: false, color: { rgb: 'FF000000' } } };
        const s = String(subject).toUpperCase();
        if (s.includes('CONSULTATION')) {
          return { fill: { fgColor: { rgb: 'FF93C5FD' } }, font: { bold: true, color: { rgb: 'FF1E3A8A' } } };
        }
        if (s.includes('ADMIN')) {
          return { fill: { fgColor: { rgb: 'FFFCA5A5' } }, font: { bold: true, color: { rgb: 'FF7F1D1D' } } };
        }
        // default
        return { fill: { fgColor: { rgb: 'FFFEF08A' } }, font: { bold: true, color: { rgb: 'FF000000' } } };
      };

      // map schedule items into grid
      (scheduleArr || []).forEach(item => {
        const dIdx = dayIndex(item.day);
        if (dIdx === -1) return;
        const startIdx = fullTimeSlots.indexOf(item.startTime);
        if (startIdx === -1) return;
        const duration = item.durationSlots && Number.isFinite(item.durationSlots) ? Math.max(1, Math.floor(item.durationSlots)) : 1;
        const rowStart = 4 + startIdx; // 1-based excel rows: title(1), blank(2), header(3), times start at 4
        const rowEnd = rowStart + duration - 1;
        const col = 2 + dIdx; // A=1 TIME, B=2 Monday

        // cell address for top cell
        const topAddr = XLSX.utils.encode_cell({ r: rowStart - 1, c: col - 1 });
        // compute end time for display: prefer explicit endTime, otherwise derive from durationSlots
        const computeEndTime = (start, dur, explicitEnd) => {
          if (explicitEnd) return explicitEnd;
          const sIdx = fullTimeSlots.indexOf(start);
          if (sIdx === -1) return '';
          const eIdx = sIdx + (dur && Number.isFinite(dur) ? Math.floor(dur) : 1);
          return eIdx < fullTimeSlots.length ? fullTimeSlots[eIdx] : '';
        };
        const endTime = computeEndTime(item.startTime, item.durationSlots, item.endTime);

        const displayTextParts = [];
        if (item.subject) displayTextParts.push(item.subject);
        const secondary = [];
        if (item.room) secondary.push(item.room);
        if (item.section) secondary.push(item.section);
        if (secondary.length) displayTextParts.push(secondary.join(' / '));
        // add time range as last line
        if (item.startTime) displayTextParts.push(`${item.startTime}${endTime ? ` - ${endTime}` : ''}`);
        ws[topAddr] = { t: 's', v: displayTextParts.join('\n') };

        // add merge if span > 1
        if (rowEnd > rowStart) {
          merges.push({ s: { r: rowStart - 1, c: col - 1 }, e: { r: rowEnd - 1, c: col - 1 } });
        }

        // apply richer style (fill, font color, alignment, wrap, border)
        const cs = cellStyleFor(item.subject) || {};
        const fg = (cs.fill && cs.fill.fgColor && cs.fill.fgColor.rgb) ? cs.fill.fgColor.rgb : 'FFFEF08A';
        const fontColor = (cs.font && cs.font.color && cs.font.color.rgb) ? cs.font.color.rgb : 'FF000000';
        ws[topAddr].s = {
          fill: { patternType: 'solid', fgColor: { rgb: fg } },
          font: { bold: true, color: { rgb: fontColor } },
          alignment: { wrapText: true, horizontal: 'center', vertical: 'center' },
          border: {
            top: { style: 'thin', color: { rgb: 'FFBBBBBB' } },
            bottom: { style: 'thin', color: { rgb: 'FFBBBBBB' } },
            left: { style: 'thin', color: { rgb: 'FFBBBBBB' } },
            right: { style: 'thin', color: { rgb: 'FFBBBBBB' } }
          }
        };
      });

      // set merges
      if (merges.length) ws['!merges'] = merges;

      // set column widths
      ws['!cols'] = [{ wch: 12 }, { wch: 30 }, { wch: 30 }, { wch: 30 }, { wch: 30 }, { wch: 30 }, { wch: 30 }];

      // add some formatting for headers
      const titleCell = 'A1';
      ws[titleCell].s = { font: { bold: true, sz: 14 }, alignment: { horizontal: 'center' } };
      // merge title across columns A:G
      ws['!merges'] = (ws['!merges'] || []).concat([{ s: { r: 0, c: 0 }, e: { r: 0, c: 6 } }]);

      // header row styling (row 3)
      for (let c = 0; c < 7; c++) {
        const addr = XLSX.utils.encode_cell({ r: 2, c });
        if (!ws[addr]) ws[addr] = { t: 's', v: headerRow[c] || '' };
        ws[addr].s = { font: { bold: true, color: { rgb: 'FF1E3A8A' } }, fill: { patternType: 'solid', fgColor: { rgb: 'FFE5E7EB' } }, alignment: { horizontal: 'center', vertical: 'center' }, border: { top: { style: 'thin', color: { rgb: 'FFCCCCCC' } }, bottom: { style: 'thin', color: { rgb: 'FFCCCCCC' } } } };
      }

      return ws;
    };

    try {
      const filenameSuffix = selectedYear ? `_${selectedYear.replace(/\s+/g, '')}` : '';
      const wb = XLSX.utils.book_new();

      if (activeTab === 'sections') {
        if (!selectedSection || !sectionsData[selectedSection]) {
          alert('No section selected or no data.');
          return;
        }
        const sheet = buildTimetableSheet(sectionsData[selectedSection], `SECTION: ${selectedSection}`);
        XLSX.utils.book_append_sheet(wb, sheet, `${selectedSection}`.slice(0, 31));
        XLSX.writeFile(wb, `section_${selectedSection}${filenameSuffix}.xlsx`);
      } else if (activeTab === 'rooms') {
        if (!selectedRoom || !roomsData[selectedRoom]) {
          alert('No room selected or no data.');
          return;
        }
        const sheet = buildTimetableSheet(roomsData[selectedRoom], `ROOM: ${selectedRoom}`);
        XLSX.utils.book_append_sheet(wb, sheet, `${selectedRoom}`.slice(0, 31));
        XLSX.writeFile(wb, `room_${selectedRoom}${filenameSuffix}.xlsx`);
      } else if (activeTab === 'professors') {
        if (!selectedProfessor || !professorsData[selectedProfessor]) {
          alert('No professor selected or no data.');
          return;
        }
        const sheet = buildTimetableSheet(professorsData[selectedProfessor], `PROF: ${selectedProfessor}`);
        XLSX.utils.book_append_sheet(wb, sheet, `${selectedProfessor}`.slice(0, 31));
        XLSX.writeFile(wb, `prof_${selectedProfessor}${filenameSuffix}.xlsx`);
      }
    } catch (e) {
      console.error('Export failed', e);
      alert('Unable to export.');
    }
  };

  const handlePrintAll = () => {
    // export ALL visible entities in current tab into a single workbook (each entity gets its own sheet)
    const fullTimeSlots = [
      '7:00AM', '7:30AM', '8:00AM', '8:30AM', '9:00AM', '9:30AM', '10:00AM', '10:30AM',
      '11:00AM', '11:30AM', '12:00PM', '12:30PM', '1:00PM', '1:30PM', '2:00PM', '2:30PM',
      '3:00PM', '3:30PM', '4:00PM', '4:30PM', '5:00PM', '5:30PM', '6:00PM', '6:30PM', '7:00PM', '7:30PM', '8:00PM', '8:30PM'
    ];
    const dayColumns = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    const buildTimetableSheet = (scheduleArr = [], title = '') => {
      const headerRow = ['TIME', ...dayColumns];
      const aoa = [];
      aoa.push([title]);
      aoa.push([]);
      aoa.push(headerRow);
      fullTimeSlots.forEach(t => {
        const row = [t];
        for (let i = 0; i < dayColumns.length; i++) row.push('');
        aoa.push(row);
      });
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      const merges = [];
      // small style helper for this builder as well
      const cellStyleFor = (subject) => {
        if (!subject) return { fill: { fgColor: { rgb: 'FFFFFFFF' } }, font: { bold: false, color: { rgb: 'FF000000' } } };
        const s = String(subject).toUpperCase();
        if (s.includes('CONSULTATION')) return { fill: { fgColor: { rgb: 'FF93C5FD' } }, font: { bold: true, color: { rgb: 'FF1E3A8A' } } };
        if (s.includes('ADMIN')) return { fill: { fgColor: { rgb: 'FFFCA5A5' } }, font: { bold: true, color: { rgb: 'FF7F1D1D' } } };
        return { fill: { fgColor: { rgb: 'FFFEF08A' } }, font: { bold: true, color: { rgb: 'FF000000' } } };
      };

      const dayIndex = (day) => dayColumns.indexOf(day);
      (scheduleArr || []).forEach(item => {
        const dIdx = dayIndex(item.day);
        if (dIdx === -1) return;
        const startIdx = fullTimeSlots.indexOf(item.startTime);
        if (startIdx === -1) return;
        const duration = item.durationSlots && Number.isFinite(item.durationSlots) ? Math.max(1, Math.floor(item.durationSlots)) : 1;
        const rowStart = 4 + startIdx;
        const rowEnd = rowStart + duration - 1;
        const col = 2 + dIdx;
        const topAddr = XLSX.utils.encode_cell({ r: rowStart - 1, c: col - 1 });
        const computeEndTime = (start, dur, explicitEnd) => {
          if (explicitEnd) return explicitEnd;
          const sIdx = fullTimeSlots.indexOf(start);
          if (sIdx === -1) return '';
          const eIdx = sIdx + (dur && Number.isFinite(dur) ? Math.floor(dur) : 1);
          return eIdx < fullTimeSlots.length ? fullTimeSlots[eIdx] : '';
        };
        const endTime = computeEndTime(item.startTime, item.durationSlots, item.endTime);
        const displayTextParts = [];
        if (item.subject) displayTextParts.push(item.subject);
        const secondary = [];
        if (item.room) secondary.push(item.room);
        if (item.section) secondary.push(item.section);
        if (secondary.length) displayTextParts.push(secondary.join(' / '));
        if (item.startTime) displayTextParts.push(`${item.startTime}${endTime ? ` - ${endTime}` : ''}`);
        ws[topAddr] = { t: 's', v: displayTextParts.join('\n') };
        // apply richer style
        const cs2 = cellStyleFor(item.subject) || {};
        const fg2 = (cs2.fill && cs2.fill.fgColor && cs2.fill.fgColor.rgb) ? cs2.fill.fgColor.rgb : 'FFFEF08A';
        const fontColor2 = (cs2.font && cs2.font.color && cs2.font.color.rgb) ? cs2.font.color.rgb : 'FF000000';
        ws[topAddr].s = {
          fill: { patternType: 'solid', fgColor: { rgb: fg2 } },
          font: { bold: true, color: { rgb: fontColor2 } },
          alignment: { wrapText: true, horizontal: 'center', vertical: 'center' },
          border: {
            top: { style: 'thin', color: { rgb: 'FFBBBBBB' } },
            bottom: { style: 'thin', color: { rgb: 'FFBBBBBB' } },
            left: { style: 'thin', color: { rgb: 'FFBBBBBB' } },
            right: { style: 'thin', color: { rgb: 'FFBBBBBB' } }
          }
        };
        if (rowEnd > rowStart) merges.push({ s: { r: rowStart - 1, c: col - 1 }, e: { r: rowEnd - 1, c: col - 1 } });
      });
      if (merges.length) ws['!merges'] = merges;
      ws['!cols'] = [{ wch: 12 }, { wch: 30 }, { wch: 30 }, { wch: 30 }, { wch: 30 }, { wch: 30 }, { wch: 30 }];
      ws['!merges'] = (ws['!merges'] || []).concat([{ s: { r: 0, c: 0 }, e: { r: 0, c: 6 } }]);
      return ws;
    };

    try {
      const filenameSuffix = selectedYear ? `_${selectedYear.replace(/\s+/g, '')}` : '';
      const wb = XLSX.utils.book_new();
      if (activeTab === 'sections') {
        const filtered = Object.entries(sectionsData).filter(([_, sched]) => Array.isArray(sched) && sched.length > 0);
        if (filtered.length === 0) { alert('No schedules to export.'); return; }
        filtered.forEach(([section, sched]) => {
          const sheet = buildTimetableSheet(sched, `SECTION: ${section}`);
          XLSX.utils.book_append_sheet(wb, sheet, `${section}`.slice(0, 31));
        });
        XLSX.writeFile(wb, `all_sections${filenameSuffix}.xlsx`);
      } else if (activeTab === 'rooms') {
        const filtered = Object.entries(roomsData).filter(([_, sched]) => Array.isArray(sched) && sched.length > 0);
        if (filtered.length === 0) { alert('No room schedules to export.'); return; }
        filtered.forEach(([room, sched]) => {
          const sheet = buildTimetableSheet(sched, `ROOM: ${room}`);
          XLSX.utils.book_append_sheet(wb, sheet, `${room}`.slice(0, 31));
        });
        XLSX.writeFile(wb, `all_rooms${filenameSuffix}.xlsx`);
      } else if (activeTab === 'professors') {
        const filtered = Object.entries(professorsData).filter(([_, sched]) => Array.isArray(sched) && sched.length > 0);
        if (filtered.length === 0) { alert('No professors schedules to export.'); return; }
        filtered.forEach(([prof, sched]) => {
          const sheet = buildTimetableSheet(sched, `PROF: ${prof}`);
          XLSX.utils.book_append_sheet(wb, sheet, `${prof}`.slice(0, 31));
        });
        XLSX.writeFile(wb, `all_professors${filenameSuffix}.xlsx`);
      }
    } catch (e) {
      console.error('Export-all failed', e);
      alert('Unable to export all.');
    }
  };

  return (
    <div className="schedule-overview-wrap">
      <div className="schedule-overview-header">
        <div className="schedule-header-left">
          <button className="schedule-back-btn" onClick={() => navigate(-1)}>
            <HiArrowLeft />
          </button>
          <h2 className="schedule-title">Schedules</h2>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="schedule-print-btn" onClick={handlePrint} title="Download current table (Excel)">
            <HiPrinter />
          </button>
          <button className="schedule-print-btn" onClick={handlePrintAll} title="Download all tables in this tab (Excel)" style={{ padding: '10px 12px' }}>
            <HiPrinter /> <span style={{ fontSize: 12, marginLeft: 6 }}>All</span>
          </button>
        </div>
      </div>

      <div className="schedule-tabs">
        <button
          className={`schedule-tab ${activeTab === 'sections' ? 'active' : ''}`}
          onClick={() => setActiveTab('sections')}
        >
          Sections
        </button>
        <button
          className={`schedule-tab ${activeTab === 'rooms' ? 'active' : ''}`}
          onClick={() => setActiveTab('rooms')}
        >
          Rooms
        </button>
        <button
          className={`schedule-tab ${activeTab === 'professors' ? 'active' : ''}`}
          onClick={() => setActiveTab('professors')}
        >
          Professors
        </button>

      </div>

      {activeTab === 'professors' && (
        <div style={{ padding: '12px 24px 0 24px' }}>
          <div className="schedule-filter-row" style={{ marginBottom: 12, display: 'flex', gap: 8 }}>
            <input
              type="text"
              className="schedule-select"
              value={professorSearch}
              onChange={(e) => setProfessorSearch(e.target.value)}
              placeholder="Search professor..."
              style={{ minWidth: 320 }}
            />
          </div>
        </div>
      )}

      {renderContent()}
    </div>
  );
};

export default ScheduleOverview;
