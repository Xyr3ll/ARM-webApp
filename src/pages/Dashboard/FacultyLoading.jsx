import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { HiOutlineUser, HiOutlineArchive, HiOutlinePencilAlt } from "react-icons/hi";
import { db } from "../../firebase";
import { collection, onSnapshot, query, where, doc, updateDoc, serverTimestamp, getDocs } from "firebase/firestore";
import "../../App.css";
import "./FacultyLoading.css";
import NonTeachingModal from "./NonTeachingModal";

export default function FacultyLoading() {
  const navigate = useNavigate();
  const [facultyList, setFacultyList] = useState([]);
  const [showNonTeachingModal, setShowNonTeachingModal] = useState(false);
  const [selectedFaculty, setSelectedFaculty] = useState(null);
  const [manualAssignments, setManualAssignments] = useState([]);
  const [modalReadOnly, setModalReadOnly] = useState(false);

  // Fetch faculty from Firestore (exclude archived)
  useEffect(() => {
    const q = query(collection(db, 'faculty'));
    const unsub = onSnapshot(q, async (snap) => {
      const facultyData = snap.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(f => f.status !== 'archived');

      // Fetch all schedules
      const scheduleSnap = await getDocs(collection(db, 'schedules'));
      const allSchedules = scheduleSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // Attach schedules to each faculty
      const facultyWithSchedules = facultyData.map(faculty => {
        // Find schedules where professorAssignments includes this faculty
        const schedulesForFaculty = allSchedules.filter(sch => {
          if (!sch.professorAssignments) return false;
          // Check if any assignment matches faculty.professor
          return Object.values(sch.professorAssignments).some(name => name === faculty.professor);
        });
        return { ...faculty, schedules: schedulesForFaculty };
      });
      setFacultyList(facultyWithSchedules);
    });
    return () => unsub();
  }, []);

  const handleAssignNonTeaching = (faculty) => {
    setSelectedFaculty(faculty);
    // Load existing non-teaching assignments if any
    setManualAssignments(faculty.nonTeachingHours || []);
    // If there are already saved non-teaching hours, open modal in read-only mode
    setModalReadOnly(Boolean(faculty.nonTeachingHours && faculty.nonTeachingHours.length > 0));
    setShowNonTeachingModal(true);
  };

  // Edit faculty handler
  const handleEditFaculty = (faculty) => {
    navigate("add", { state: { faculty } });
  };

  // Archive faculty handler
  const handleArchiveFaculty = async (faculty) => {
    const confirmed = window.confirm(
      `Are you sure you want to archive ${faculty.professor}? This faculty member will be moved to the archive.`
    );

    if (!confirmed) return;

    try {
      const facultyRef = doc(db, 'faculty', faculty.id);
      await updateDoc(facultyRef, {
        status: 'archived',
        archivedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      alert('Faculty archived successfully!');
    } catch (error) {
      console.error('Error archiving faculty:', error);
      alert('Failed to archive faculty. Please try again.');
    }
  };

  // Calculate automatic administrative hours from lab subjects
  const calculateAutoAdminHours = (faculty) => {
    if (!faculty || !faculty.schedules || !Array.isArray(faculty.schedules)) return 0;

    let totalAdminHours = 0;
    faculty.schedules.forEach(scheduleDoc => {
      if (!scheduleDoc.schedule) return;
      Object.entries(scheduleDoc.schedule).forEach(([key, value]) => {
        if (value && value.subject && value.subject.toLowerCase().includes('lab')) {
          // Each durationSlot is 30 minutes, so half of 2 slots = 1 slot = 30 minutes = 0.5 hour
          const durationSlots = value.durationSlots || 1;
          const slotMinutes = 30;
          const totalMinutes = (durationSlots / 2) * slotMinutes;
          totalAdminHours += totalMinutes / 60; // convert to hours
        }
      });
    });
    return totalAdminHours;
  };

  // Handle manual assignment changes
  const handleManualChange = (idx, field, value) => {
    setManualAssignments(assignments => 
      assignments.map((a, i) => i === idx ? { ...a, [field]: value } : a)
    );
  };

  const handleAddManual = () => {
    setManualAssignments(assignments => [
      ...assignments, 
      { day: '', time: '', type: 'Consultation', hours: 1 }
    ]);
  };

  const handleRemoveManual = (idx) => {
    setManualAssignments(assignments => assignments.filter((_, i) => i !== idx));
  };

  // Save non-teaching hours to Firestore
  const handleSaveNonTeaching = async () => {
    if (!selectedFaculty) return;

    const autoAdminHours = calculateAutoAdminHours(selectedFaculty);
    const manualConsultation = manualAssignments
      .filter(a => a.type === 'Consultation')
      .reduce((sum, a) => sum + (a.hours || 0), 0);
    const manualAdmin = manualAssignments
      .filter(a => a.type === 'Administrative')
      .reduce((sum, a) => sum + (a.hours || 0), 0);
    
    const totalConsultation = manualConsultation;
    const totalAdmin = autoAdminHours + manualAdmin;

    // Validate requirements
    if (totalConsultation < 6) {
      alert(`Consultation hours must be at least 6. Current: ${totalConsultation}`);
      return;
    }
    if (totalAdmin < 10) {
      alert(`Administrative hours must be at least 10. Current: ${totalAdmin}`);
      return;
    }

    // Validate all manual assignments have required fields
    const incompleteAssignments = manualAssignments.filter(a => !a.day || !a.time || !a.type);
    if (incompleteAssignments.length > 0) {
      alert('Please complete all assignment fields (Day, Time, Type)');
      return;
    }

    // Note: Conflict checking is handled in NonTeachingModal component before reaching here
    
    try {
      const facultyRef = doc(db, 'faculty', selectedFaculty.id);
      await updateDoc(facultyRef, {
        nonTeachingHours: manualAssignments,
        updatedAt: new Date()
      });
      
      alert('Non-teaching hours saved successfully!');
      setShowNonTeachingModal(false);
      setManualAssignments([]);
    } catch (error) {
      console.error('Error saving non-teaching hours:', error);
      alert('Failed to save non-teaching hours. Please try again.');
    }
  };

  return (
    <div className="faculty-loading-container">
      <div className="faculty-loading-header">
        <h2>Faculty Loading</h2>
        <button
          className="add-faculty-btn"
          onClick={() => navigate("add")}
        >
          + Add Faculty
        </button>
      </div>
      <div className="faculty-loading-table-wrapper">
        <table className="faculty-loading-table">
          <thead>
            <tr>
              <th>PROGRAM</th>
              <th>PROFESSOR</th>
              <th>SHIFT</th>
              <th>UNITS</th>
              <th>NON-TEACHING</th>
              <th>ACTION</th>
            </tr>
          </thead>
          <tbody>
            {facultyList.map((faculty, idx) => {
              const totalUnits = faculty.units || 0;
              const shift = faculty.shift || '';
              const maxUnits = shift === 'FULL-TIME' ? 24 : 15;
              const isOverloaded = shift === 'FULL-TIME' ? totalUnits > 24 : totalUnits > 15;
              const unitColor = isOverloaded ? '#ef4444' : totalUnits >= maxUnits ? '#f59e0b' : '#000';
              
              return (
                <tr key={faculty.id || idx}>
                  <td>{faculty.program}</td>
                  <td>{faculty.professor}</td>
                  <td>{faculty.shift}</td>
                  <td style={{ color: unitColor, fontWeight: isOverloaded ? 700 : 600 }}>
                    {totalUnits} / {maxUnits}
                    {isOverloaded && <span style={{ fontSize: 11, marginLeft: 6 }}>(OVERLOAD)</span>}
                  </td>
                  <td>
                    <button 
                      className="assign-btn"
                      onClick={() => handleAssignNonTeaching(faculty)}
                    >
                      ASSIGN
                    </button>
                  </td>
                  <td>
                    <button className="edit-btn" onClick={() => handleEditFaculty(faculty)}>
                      <HiOutlinePencilAlt /> Edit
                    </button>
                    <button className="archive-btn" onClick={() => handleArchiveFaculty(faculty)}>
                      <HiOutlineArchive /> Archive
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Non-Teaching Hours Assignment Modal */}
      {showNonTeachingModal && selectedFaculty && (
        <NonTeachingModal
          faculty={selectedFaculty}
          manualAssignments={manualAssignments}
          setManualAssignments={setManualAssignments}
          onClose={() => {
            setShowNonTeachingModal(false);
            setManualAssignments([]);
            setModalReadOnly(false);
          }}
          onSave={handleSaveNonTeaching}
          calculateAutoAdminHours={calculateAutoAdminHours}
          readOnly={modalReadOnly}
        />
      )}
    </div>
  );
}
