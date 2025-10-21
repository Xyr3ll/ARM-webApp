import React, { useEffect, useState } from "react";
import MiniProfScheduleGrid from "./MiniProfScheduleGrid";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../../firebase";

export default function NonTeachingModal({
  faculty,
  manualAssignments,
  setManualAssignments,
  onClose,
  onSave,
  calculateAutoAdminHours
  ,
  readOnly = false
}) {
  const [classBlocks, setClassBlocks] = useState([]);

  // Modal requirements
  const requiredConsultation = 6;
  const requiredAdmin = 10;

  // Calculate totals
  const manualConsultation = manualAssignments
    .filter(a => a.type === 'Consultation')
    .reduce((sum, a) => sum + (a.hours || 0), 0);
  const manualAdmin = manualAssignments
    .filter(a => a.type === 'Administrative')
    .reduce((sum, a) => sum + (a.hours || 0), 0);
  const autoAdminHours = calculateAutoAdminHours(faculty);
  const totalConsultation = manualConsultation;
  const totalAdmin = autoAdminHours + manualAdmin;
  const remainingConsultation = Math.max(0, requiredConsultation - totalConsultation);
  const remainingAdmin = Math.max(0, requiredAdmin - totalAdmin);

  // Time slots and days for dropdown
  const timeSlots = [
    '7:00AM', '7:30AM', '8:00AM', '8:30AM', '9:00AM', '9:30AM',
    '10:00AM', '10:30AM', '11:00AM', '11:30AM', '12:00PM', '12:30PM',
    '1:00PM', '1:30PM', '2:00PM', '2:30PM', '3:00PM', '3:30PM',
    '4:00PM', '4:30PM', '5:00PM', '5:30PM', '6:00PM'
  ];
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  // Fetch class blocks for conflict checking
  useEffect(() => {
    if (!faculty) return;
    let q = query(
      collection(db, "schedules"),
      where("program", "==", faculty.program),
      where("semester", "==", faculty.semester || "")
    );
    if (faculty.yearLevel) q = query(q, where("yearLevel", "==", faculty.yearLevel));
    if (faculty.year) q = query(q, where("year", "==", faculty.year));
    const unsub = onSnapshot(q, (snap) => {
      const blocks = [];
      snap.forEach((docSnap) => {
        const data = docSnap.data();
        const schedule = data.schedule || {};
        const professorAssignments = data.professorAssignments || {};
        Object.entries(schedule).forEach(([key, val]) => {
          const [day, time] = key.split("_");
          const assignedProf = professorAssignments[key];
          if (assignedProf === faculty.professor && val && val.subject) {
            blocks.push({
              day,
              startTime: time,
              durationSlots: val.durationSlots || 1
            });
          }
        });
      });
      setClassBlocks(blocks);
    });
    return () => unsub();
  }, [faculty]);

  // Conflict detection
  function hasConflict(assignments, classBlocks) {
    const occupied = {};
    
    // Mark all class block time slots as occupied
    function markSlots(day, start, duration) {
      const idx = timeSlots.indexOf(start);
      for (let i = 0; i < duration; i++) {
        const slot = timeSlots[idx + i];
        if (!slot) break;
        occupied[`${day}_${slot}`] = true;
      }
    }
    
    // Mark all class blocks
    classBlocks.forEach(b => markSlots(b.day, b.startTime, b.durationSlots || 1));
    
    // Check each assignment for conflicts
    assignments.forEach((a) => {
      if (!a.day || !a.time || !a.hours) {
        a.conflict = false;
        return;
      }
      
      // Check if any slot in this assignment overlaps with occupied slots
      let hasConflictFlag = false;
      const duration = Math.round(a.hours * 2); // Convert hours to 30-min slots (0.5hr = 1 slot, 1hr = 2 slots)
      const startIdx = timeSlots.indexOf(a.time);
      
      for (let i = 0; i < duration; i++) {
        const slot = timeSlots[startIdx + i];
        if (!slot) break;
        const key = `${a.day}_${slot}`;
        if (occupied[key]) {
          hasConflictFlag = true;
          break;
        }
      }
      
      a.conflict = hasConflictFlag;
      
      // If no conflict, mark these slots as occupied for future assignments
      if (!hasConflictFlag) {
        for (let i = 0; i < duration; i++) {
          const slot = timeSlots[startIdx + i];
          if (!slot) break;
          occupied[`${a.day}_${slot}`] = true;
        }
      }
    });
    
    return assignments.some(a => a.conflict);
  }
  const hasAnyConflict = hasConflict(manualAssignments, classBlocks);

  // Handlers for manual assignment changes
  const handleManualChange = (idx, field, value) => {
    if (readOnly) return;
    setManualAssignments(assignments =>
      assignments.map((a, i) => i === idx ? { ...a, [field]: value } : a)
    );
  };
  const handleAddManual = () => {
    if (readOnly) return;
    setManualAssignments(assignments => [
      ...assignments,
      { day: '', time: '', type: 'Consultation', hours: 1 }
    ]);
  };
  const handleRemoveManual = (idx) => {
    if (readOnly) return;
    setManualAssignments(assignments => assignments.filter((_, i) => i !== idx));
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999
    }}>
      <div style={{
        background: '#fff', borderRadius: 12, padding: 32, width: '90%', maxWidth: 900,
        boxShadow: '0 10px 30px rgba(0,0,0,0.2)', maxHeight: '90vh', overflowY: 'auto'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h3 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>
            Non-Teaching Hours - {faculty.professor}
          </h3>
          <button
            onClick={onClose}
            style={{
              background: '#eee', border: 'none', borderRadius: '50%',
              width: 32, height: 32, fontSize: 18, cursor: 'pointer'
            }}
          >×</button>
        </div>
        {/* Requirements and Summary */}
        <div style={{ marginBottom: 24, padding: 16, background: '#f0f9ff', borderRadius: 8, border: '1px solid #bae6fd' }}>
          <p style={{ color: '#0c4a6e', fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
            📋 Requirements: Consultation: 6 hours | Administrative: 10 hours
          </p>
          <p style={{ color: '#0369a1', fontSize: 13, marginBottom: 16 }}>
            💡 Note: Half of laboratory hours automatically count as administrative hours
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 12 }}>
            <div style={{ padding: 12, background: '#fff', borderRadius: 6, border: '1px solid #cbd5e1' }}>
              <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>Auto Administrative (Lab ÷ 2)</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#0ea5e9' }}>{autoAdminHours.toFixed(1)} hrs</div>
            </div>
            <div style={{ padding: 12, background: '#fff', borderRadius: 6, border: '1px solid #cbd5e1' }}>
              <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>Manual Administrative</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#8b5cf6' }}>{manualAdmin.toFixed(1)} hrs</div>
            </div>
            <div style={{ padding: 12, background: '#fff', borderRadius: 6, border: '1px solid #cbd5e1' }}>
              <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>Total Administrative</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: totalAdmin >= 10 ? '#10b981' : '#ef4444' }}>
                {totalAdmin.toFixed(1)} / 10 hrs
              </div>
            </div>
            <div style={{ padding: 12, background: '#fff', borderRadius: 6, border: '1px solid #cbd5e1' }}>
              <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>Total Consultation</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: totalConsultation >= 6 ? '#10b981' : '#ef4444' }}>
                {totalConsultation.toFixed(1)} / 6 hrs
              </div>
            </div>
          </div>
          <div style={{ marginTop: 12, display: 'flex', gap: 16 }}>
            <div style={{
              fontSize: 14,
              color: remainingConsultation > 0 ? '#dc2626' : '#059669',
              fontWeight: 600
            }}>
              {remainingConsultation > 0
                ? `⚠️ Need ${remainingConsultation.toFixed(1)} more consultation hours`
                : '✓ Consultation requirement met'}
            </div>
            <div style={{
              fontSize: 14,
              color: remainingAdmin > 0 ? '#dc2626' : '#059669',
              fontWeight: 600
            }}>
              {remainingAdmin > 0
                ? `⚠️ Need ${remainingAdmin.toFixed(1)} more admin hours`
                : '✓ Administrative requirement met'}
            </div>
          </div>
        </div>
        {/* Mini schedule grid for professor's class schedule */}
        <div style={{ margin: '32px 0 12px 0' }}>
          <h4 style={{ fontWeight: 700, fontSize: 15, color: '#1e293b', marginBottom: 8 }}>
            🗓️ Current Class Schedule
          </h4>
          <MiniProfScheduleGrid
            professor={faculty.professor}
            program={faculty.program}
            semester={faculty.semester || ''}
            yearLevel={faculty.yearLevel || ''}
            year={faculty.year || ''}
            manualAssignments={manualAssignments}
          />
        </div>
        {/* Conflict Warning */}
        {hasAnyConflict && (
          <div style={{ 
            marginTop: 16, 
            padding: 12, 
            background: '#fee2e2', 
            borderRadius: 8, 
            border: '2px solid #ef4444',
            display: 'flex',
            alignItems: 'center',
            gap: 8
          }}>
            <span style={{ fontSize: 20 }}>⚠️</span>
            <div style={{ color: '#991b1b', fontSize: 14, fontWeight: 600 }}>
              Schedule Conflict Detected! Manual assignments overlap with existing class schedule. Please adjust the time slots.
            </div>
          </div>
        )}
        {/* Manual Assignment Grid */}
        <div style={{ marginTop: 24, background: '#f8fafc', borderRadius: 8, padding: 20, border: '1px solid #e2e8f0' }}>
          <h4 style={{ marginBottom: 16, fontSize: 16, fontWeight: 700, color: '#1e293b' }}>
            📅 Manual Assignment Schedule
          </h4>
          <div style={{ overflowX: 'auto' }}>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              marginBottom: 16,
              background: '#fff',
              borderRadius: 6,
              overflow: 'hidden'
            }}>
              <thead>
                <tr style={{ background: '#1e40af' }}>
                  <th style={{ padding: '12px 8px', color: '#fff', fontWeight: 600, fontSize: 13, textAlign: 'left' }}>Day</th>
                  <th style={{ padding: '12px 8px', color: '#fff', fontWeight: 600, fontSize: 13, textAlign: 'left' }}>Time</th>
                  <th style={{ padding: '12px 8px', color: '#fff', fontWeight: 600, fontSize: 13, textAlign: 'left' }}>Type</th>
                  <th style={{ padding: '12px 8px', color: '#fff', fontWeight: 600, fontSize: 13, textAlign: 'left' }}>Hours</th>
                  <th style={{ padding: '12px 8px', color: '#fff', fontWeight: 600, fontSize: 13, textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {manualAssignments.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{
                      padding: 24,
                      textAlign: 'center',
                      color: '#94a3b8',
                      fontSize: 14
                    }}>
                      No assignments yet. Click "Add Assignment" to begin.
                    </td>
                  </tr>
                ) : (
                  manualAssignments.map((row, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0', background: row.conflict ? '#fee2e2' : undefined }}>
                      <td style={{ padding: '10px 8px' }}>
                          <select
                          value={row.day}
                          onChange={e => handleManualChange(idx, 'day', e.target.value)}
                          style={{
                            width: '100%',
                            padding: '8px 10px',
                            borderRadius: 6,
                            border: '1px solid #cbd5e1',
                            fontSize: 13,
                            cursor: 'pointer',
                            background: row.conflict ? '#fecaca' : undefined
                          }}
                          disabled={readOnly}
                        >
                          <option value="">Select day</option>
                          {days.map(day => <option key={day} value={day}>{day}</option>)}
                        </select>
                      </td>
                      <td style={{ padding: '10px 8px' }}>
                        <select
                          value={row.time}
                          onChange={e => handleManualChange(idx, 'time', e.target.value)}
                          style={{
                            width: '100%',
                            padding: '8px 10px',
                            borderRadius: 6,
                            border: '1px solid #cbd5e1',
                            fontSize: 13,
                            cursor: 'pointer',
                            background: row.conflict ? '#fecaca' : undefined
                          }}
                          disabled={readOnly}
                        >
                          <option value="">Select time</option>
                          {timeSlots.map(time => <option key={time} value={time}>{time}</option>)}
                        </select>
                      </td>
                      <td style={{ padding: '10px 8px' }}>
                        <select
                          value={row.type}
                          onChange={e => handleManualChange(idx, 'type', e.target.value)}
                          style={{
                            width: '100%',
                            padding: '8px 10px',
                            borderRadius: 6,
                            border: '1px solid #cbd5e1',
                            fontSize: 13,
                            cursor: 'pointer',
                            background: row.type === 'Consultation' ? '#dbeafe' : '#fce7f3',
                            fontWeight: 600
                          }}
                          disabled={readOnly}
                        >
                          <option value="Consultation">Consultation</option>
                          <option value="Administrative">Administrative</option>
                        </select>
                      </td>
                      <td style={{ padding: '10px 8px' }}>
                        <input
                          type="number"
                          min={0.5}
                          max={4}
                          step={0.5}
                          value={row.hours}
                          onChange={e => handleManualChange(idx, 'hours', parseFloat(e.target.value) || 1)}
                          style={{
                            width: 80,
                            padding: '8px 10px',
                            borderRadius: 6,
                            border: '1px solid #cbd5e1',
                            fontSize: 13,
                            textAlign: 'center',
                            background: row.conflict ? '#fecaca' : undefined
                          }}
                          disabled={readOnly}
                        />
                      </td>
                      <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                        {!readOnly && (
                          <button
                            type="button"
                            onClick={() => handleRemoveManual(idx)}
                            style={{
                              background: '#ef4444',
                              color: '#fff',
                              border: 'none',
                              borderRadius: 6,
                              padding: '6px 12px',
                              cursor: 'pointer',
                              fontSize: 13,
                              fontWeight: 600
                            }}
                          >
                            🗑 Remove
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {!readOnly && (
            <button
              type="button"
              onClick={handleAddManual}
              style={{
                background: '#10b981',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                padding: '10px 20px',
                fontWeight: 600,
                fontSize: 14,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              <span style={{ fontSize: 16 }}>+</span> Add Assignment
            </button>
          )}
        </div>
        {/* Action Buttons */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24 }}>
          <button
            onClick={onClose}
            style={{
              background: '#e5e7eb',
              border: 'none',
              padding: '12px 28px',
              borderRadius: 6,
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: 14,
              color: '#374151'
            }}
          >
            Cancel
          </button>
          {!readOnly && (
            <button
              onClick={onSave}
              style={{
                background: hasAnyConflict || remainingConsultation > 0 || remainingAdmin > 0 ? '#94a3b8' : '#1565c0',
                color: '#fff',
                border: 'none',
                padding: '12px 28px',
                borderRadius: 6,
                cursor: hasAnyConflict || remainingConsultation > 0 || remainingAdmin > 0 ? 'not-allowed' : 'pointer',
                fontWeight: 600,
                fontSize: 14
              }}
              disabled={hasAnyConflict || remainingConsultation > 0 || remainingAdmin > 0}
            >
              💾 Save Non-Teaching Hours
            </button>
          )}
        </div>
        {readOnly && (
          <div style={{ marginTop: 12, color: '#475569', fontSize: 13 }}>
            Note: These non-teaching hours are saved and cannot be edited. Contact admin to change.
          </div>
        )}
      </div>
    </div>
  );
}
