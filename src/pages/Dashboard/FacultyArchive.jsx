import React, { useEffect, useState } from "react";
import { HiOutlineEye } from "react-icons/hi";
import { db } from "../../firebase";
import { collection, onSnapshot, query, where, doc, updateDoc, deleteField, getDoc, serverTimestamp, addDoc } from "firebase/firestore";
import "../../App.css";
import "./FacultyArchive.css";

export default function FacultyArchive() {
  const [archivedFacultyList, setArchivedFacultyList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedFaculty, setSelectedFaculty] = useState(null);
  const [showViewModal, setShowViewModal] = useState(false);
  // Archived substitutions
  const [archivedSubstitutions, setArchivedSubstitutions] = useState([]);
  const [loadingSubs, setLoadingSubs] = useState(true);
  const [selectedSubstitution, setSelectedSubstitution] = useState(null);
  const [showSubModal, setShowSubModal] = useState(false);

  // Fetch archived faculty from Firestore
  useEffect(() => {
    const q = query(
      collection(db, 'faculty'),
      where('status', '==', 'archived')
    );
    
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setArchivedFacultyList(data);
      setLoading(false);
    });
    
    return () => unsub();
  }, []);

  // Fetch archived substitutions from archived schedule documents
  useEffect(() => {
    setLoadingSubs(true);
    // Only listen to the centralized history-substitution collection
    const historyQuery = query(collection(db, 'history-substitution'));
    const historyUnsub = onSnapshot(historyQuery, (snap) => {
      const hist = [];
      snap.forEach(docSnap => {
        const data = docSnap.data();
        hist.push({
          id: docSnap.id,
          docKey: data.docKey || null,
          section: data.section || '',
          program: data.program || '',
          day: data.day || '',
          startTime: data.startTime || '',
          endTime: data.endTime || '',
          subject: data.subject || '',
          substituteTeacher: data.substituteTeacher || '',
          originalProfessor: data.originalProfessor || '',
          archivedAt: data.archivedAt || null
        });
      });
      // sort by archivedAt desc
      hist.sort((a, b) => {
        const ta = a.archivedAt && a.archivedAt.toMillis ? a.archivedAt.toMillis() : (a.archivedAt ? new Date(a.archivedAt).getTime() : 0);
        const tb = b.archivedAt && b.archivedAt.toMillis ? b.archivedAt.toMillis() : (b.archivedAt ? new Date(b.archivedAt).getTime() : 0);
        return tb - ta;
      });
      setArchivedSubstitutions(hist);
      setLoadingSubs(false);
    }, (err) => {
      console.error('Failed to load history substitutions', err);
      setLoadingSubs(false);
    });

    return () => { historyUnsub(); };
  }, []);

  const handleViewFaculty = (faculty) => {
    setSelectedFaculty(faculty);
    setShowViewModal(true);
  };

  const handleCloseModal = () => {
    setShowViewModal(false);
    setSelectedFaculty(null);
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleRecoverFaculty = async () => {
    if (!selectedFaculty || !selectedFaculty.id) return;

    const confirmed = window.confirm(
      `Are you sure you want to recover ${selectedFaculty.professor}? This faculty member will be restored to the active list.`
    );

    if (!confirmed) return;

    try {
      const facultyRef = doc(db, 'faculty', selectedFaculty.id);
      await updateDoc(facultyRef, {
        status: deleteField(), // Remove the status field
        archivedAt: deleteField() // Remove the archivedAt field
      });
      alert('Faculty recovered successfully!');
      handleCloseModal();
    } catch (error) {
      console.error('Error recovering faculty:', error);
      alert('Failed to recover faculty. Please try again.');
    }
  };

  return (
    <div className="faculty-archive-container">
      <div className="faculty-archive-header">
        <h2>Archived Faculties</h2>
        <button className="sort-btn">Sort <span>▼</span></button>
      </div>
      <div className="faculty-archive-table-wrapper">
        <div className="faculty-archive-scroll">
          <table className="faculty-archive-table">
          <thead>
            <tr>
              <th>PROGRAM</th>
              <th>PROFESSOR</th>
              <th>SHIFT</th>
              <th>UNITS</th>
              <th>ACTION</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '20px', color: '#666' }}>
                  Loading archived faculty...
                </td>
              </tr>
            ) : archivedFacultyList.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '20px', color: '#666' }}>
                  No archived faculty found
                </td>
              </tr>
            ) : (
              archivedFacultyList.map((faculty, idx) => (
                <tr key={faculty.id || idx}>
                  <td>{faculty.program}</td>
                  <td>{faculty.professor}</td>
                  <td>{faculty.shift}</td>
                  <td>{faculty.units || 0}</td>
                  <td>
                    <button className="view-btn" onClick={() => handleViewFaculty(faculty)}>
                      <HiOutlineEye /> View
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
          </table>
        </div>
      </div>
          
          {/* Archived Substitutions Table */}
          <div className="faculty-archive-header" style={{ marginTop: 28 }}>
            <h2>Archived Substitutions</h2>
          </div>
          <div className="faculty-archive-substitutions-wrapper">
            <div className="faculty-archive-substitutions-scroll">
              <table className="faculty-archive-table">
              <thead>
                <tr>
                  <th>PROGRAM</th>
                  <th>SECTION</th>
                  <th>DAY</th>
                  <th>TIME</th>
                  <th>SUBJECT</th>
                  <th>ORIGINAL</th>
                  <th>SUBSTITUTE</th>
                  <th>ARCHIVED AT</th>
                </tr>
              </thead>
              <tbody>
                {loadingSubs ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '20px', color: '#666' }}>
                      Loading archived substitutions...
                    </td>
                  </tr>
                ) : archivedSubstitutions.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '20px', color: '#666' }}>
                      No archived substitutions found
                    </td>
                  </tr>
                ) : (
                  archivedSubstitutions.map((s, i) => (
                    <tr key={`${s.id}-${s.docKey}-${i}`}>
                      <td>{s.program}</td>
                      <td>{s.section}</td>
                      <td>{s.day}</td>
                      <td>{s.startTime}{s.endTime ? ` - ${s.endTime}` : ''}</td>
                      <td>{s.subject}</td>
                      <td>{s.originalProfessor}</td>
                      <td>{s.substituteTeacher}</td>
                      <td>{formatDate(s.archivedAt)}</td>
                    </tr>
                  ))
                )}
              </tbody>
              </table>
            </div>
          </div>

      {/* View Faculty Modal */}
      {showViewModal && selectedFaculty && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999
        }}>
          <div style={{
            background: '#fff',
            borderRadius: 12,
            padding: 32,
            width: '90%',
            maxWidth: 700,
            boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
            maxHeight: '90vh',
            overflowY: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h3 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>
                Archived Faculty Details
              </h3>
              <button
                onClick={handleCloseModal}
                style={{
                  background: '#eee',
                  border: 'none',
                  borderRadius: '50%',
                  width: 32,
                  height: 32,
                  fontSize: 18,
                  cursor: 'pointer'
                }}
              >×</button>
            </div>

            {/* Faculty Information */}
            <div style={{ marginBottom: 24, padding: 16, background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
              <h4 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, color: '#1e293b' }}>
                📋 Faculty Information
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>Professor Name</div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: '#1e293b' }}>{selectedFaculty.professor}</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>Shift</div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: '#1e293b' }}>{selectedFaculty.shift}</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>Program</div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: '#1e293b' }}>{selectedFaculty.program}</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>Semester</div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: '#1e293b' }}>{selectedFaculty.semester || 'N/A'}</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>Total Units</div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: '#1e293b' }}>{selectedFaculty.units || 0}</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>Archived Date</div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: '#ef4444' }}>{formatDate(selectedFaculty.archivedAt)}</div>
                </div>
              </div>
            </div>

            {/* Courses Table */}
            {selectedFaculty.courses && selectedFaculty.courses.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <h4 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, color: '#1e293b' }}>
                  📚 Assigned Courses
                </h4>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    background: '#fff',
                    border: '1px solid #e2e8f0',
                    borderRadius: 6,
                    overflow: 'hidden'
                  }}>
                    <thead>
                      <tr style={{ background: '#1e40af' }}>
                        <th style={{ padding: '12px 8px', color: '#fff', fontWeight: 600, fontSize: 13, textAlign: 'left' }}>Course Code</th>
                        <th style={{ padding: '12px 8px', color: '#fff', fontWeight: 600, fontSize: 13, textAlign: 'left' }}>Course Name</th>
                        <th style={{ padding: '12px 8px', color: '#fff', fontWeight: 600, fontSize: 13, textAlign: 'center' }}>Units</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedFaculty.courses.map((course, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                          <td style={{ padding: '10px 8px', fontSize: 13 }}>{course.courseCode}</td>
                          <td style={{ padding: '10px 8px', fontSize: 13 }}>{course.courseName}</td>
                          <td style={{ padding: '10px 8px', fontSize: 13, textAlign: 'center', fontWeight: 600 }}>{course.units}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Non-Teaching Hours */}
            {selectedFaculty.nonTeachingHours && selectedFaculty.nonTeachingHours.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <h4 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, color: '#1e293b' }}>
                  ⏰ Non-Teaching Hours
                </h4>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    background: '#fff',
                    border: '1px solid #e2e8f0',
                    borderRadius: 6,
                    overflow: 'hidden'
                  }}>
                    <thead>
                      <tr style={{ background: '#1e40af' }}>
                        <th style={{ padding: '12px 8px', color: '#fff', fontWeight: 600, fontSize: 13, textAlign: 'left' }}>Day</th>
                        <th style={{ padding: '12px 8px', color: '#fff', fontWeight: 600, fontSize: 13, textAlign: 'left' }}>Time</th>
                        <th style={{ padding: '12px 8px', color: '#fff', fontWeight: 600, fontSize: 13, textAlign: 'left' }}>Type</th>
                        <th style={{ padding: '12px 8px', color: '#fff', fontWeight: 600, fontSize: 13, textAlign: 'center' }}>Hours</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedFaculty.nonTeachingHours.map((nthour, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                          <td style={{ padding: '10px 8px', fontSize: 13 }}>{nthour.day}</td>
                          <td style={{ padding: '10px 8px', fontSize: 13 }}>{nthour.time}</td>
                          <td style={{ padding: '10px 8px', fontSize: 13 }}>
                            <span style={{
                              background: nthour.type === 'Consultation' ? '#dbeafe' : '#fce7f3',
                              color: nthour.type === 'Consultation' ? '#1e40af' : '#9f1239',
                              padding: '4px 8px',
                              borderRadius: 4,
                              fontSize: 12,
                              fontWeight: 600
                            }}>
                              {nthour.type}
                            </span>
                          </td>
                          <td style={{ padding: '10px 8px', fontSize: 13, textAlign: 'center', fontWeight: 600 }}>{nthour.hours}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Close Button */}
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginTop: 24 }}>
              <button
                onClick={handleRecoverFaculty}
                style={{
                  background: '#10b981',
                  color: '#fff',
                  border: 'none',
                  padding: '12px 28px',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: 14,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8
                }}
              >
                ♻️ Recover Faculty
              </button>
              <button
                onClick={handleCloseModal}
                style={{
                  background: '#64748b',
                  color: '#fff',
                  border: 'none',
                  padding: '12px 28px',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: 14
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Substitution View Modal */}
      {showSubModal && selectedSubstitution && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999
        }}>
          <div style={{
            background: '#fff',
            borderRadius: 12,
            padding: 24,
            width: '90%',
            maxWidth: 600,
            boxShadow: '0 10px 30px rgba(0,0,0,0.2)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Archived Substitution</h3>
              <button onClick={() => { setShowSubModal(false); setSelectedSubstitution(null); }} style={{ background: '#eee', border: 'none', borderRadius: '50%', width: 32, height: 32, fontSize: 18, cursor: 'pointer' }}>×</button>
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 13, color: '#64748b' }}>Program</div>
              <div style={{ fontWeight: 700 }}>{selectedSubstitution.program}</div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 13, color: '#64748b' }}>Section</div>
              <div style={{ fontWeight: 700 }}>{selectedSubstitution.section}</div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 13, color: '#64748b' }}>Subject</div>
              <div style={{ fontWeight: 700 }}>{selectedSubstitution.subject}</div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 13, color: '#64748b' }}>Time</div>
              <div style={{ fontWeight: 700 }}>{selectedSubstitution.startTime}{selectedSubstitution.endTime ? ` - ${selectedSubstitution.endTime}` : ''}</div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 13, color: '#64748b' }}>Original Professor</div>
              <div style={{ fontWeight: 700 }}>{selectedSubstitution.originalProfessor || 'N/A'}</div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 13, color: '#64748b' }}>Substitute</div>
              <div style={{ fontWeight: 700, color: '#1e293b' }}>{selectedSubstitution.substituteTeacher}</div>
            </div>

            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 12 }}>
              <button onClick={() => { setShowSubModal(false); setSelectedSubstitution(null); }} style={{ background: '#64748b', color: '#fff', padding: '10px 16px', borderRadius: 8, border: 'none', fontWeight: 700 }}>Close</button>
              <button onClick={async () => {
                // Archive the substitute in the schedule slot instead of deleting it
                try {
                  const docRef = doc(db, 'schedules', selectedSubstitution.id);
                  const snap = await getDoc(docRef);
                  if (!snap.exists()) {
                    alert('Document not found');
                    return;
                  }
                  const data = snap.data();
                  const schedule = { ...(data.schedule || {}) };
                  const key = selectedSubstitution.docKey;
                  if (schedule[key] && (schedule[key].substituteTeacher || schedule[key].substituteArchivedTeacher)) {
                    // choose the name to archive
                    const archivedName = schedule[key].substituteTeacher || schedule[key].substituteArchivedTeacher;
                    const professorAssignments = data.professorAssignments || {};
                    const original = professorAssignments[key] || schedule[key].professor || schedule[key].instructor || '';
                    // Create history-substitution doc
                    const history = {
                      scheduleId: docSnap.id,
                      docKey: key,
                      section: data.sectionName || docSnap.id,
                      program: data.program || '',
                      day: selectedSubstitution.day || '',
                      startTime: selectedSubstitution.startTime || '',
                      endTime: selectedSubstitution.endTime || '',
                      subject: selectedSubstitution.subject || '',
                      originalProfessor: original,
                      substituteTeacher: archivedName,
                      archivedAt: serverTimestamp()
                    };
                    await addDoc(collection(db, 'history-substitution'), history);

                    // Remove substitute and archive markers from the schedule (history centralized)
                    delete schedule[key].substituteTeacher;
                    delete schedule[key].substituteArchivedTeacher;
                    delete schedule[key].substituteStatus;
                    delete schedule[key].substituteArchivedAt;

                    await updateDoc(docRef, { schedule, updatedAt: serverTimestamp() });
                    alert('Substitution archived to history.');
                    setShowSubModal(false);
                    setSelectedSubstitution(null);
                  } else {
                    alert('No substitution found in that slot.');
                  }
                } catch (err) {
                  console.error('Failed to archive substitution', err);
                  alert('Unable to archive substitution.');
                }
              }} style={{ background: '#ef4444', color: '#fff', padding: '10px 16px', borderRadius: 8, border: 'none', fontWeight: 700 }}>Archive Substitute</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
