import React, { useEffect, useState } from 'react';
import '../../styles/AcademicHeadDashboard.css';
import { HiCalendarDays, HiUsers, HiBookOpen, HiArchiveBox } from 'react-icons/hi2';
import { useNavigate } from 'react-router-dom';
import { db } from '../../firebase';
import { collection, onSnapshot, query, where } from 'firebase/firestore';

const ProgramHeadHome = () => {
  const navigate = useNavigate();
  const [schedulesToAssign, setSchedulesToAssign] = useState(0);
  const [pendingReservations, setPendingReservations] = useState(0);

  // Count submitted schedules that need professor assignments
  useEffect(() => {
    const schedulesCol = collection(db, 'schedules');
    const q = query(schedulesCol, where('status', '==', 'submitted'));
    
    const unsub = onSnapshot(q, (snap) => {
      let needsAssignment = 0;
      snap.forEach((doc) => {
        const data = doc.data();
        const schedule = data.schedule || {};
        const professorAssignments = data.professorAssignments || {};
        
        // Count this section if it has at least one scheduled slot with no assigned professor
        const slotKeys = Object.keys(schedule).filter(k => schedule[k] && schedule[k].subject);
        const hasUnassignedSlot = slotKeys.some((key) => {
          const val = professorAssignments[key];
          return !(val && String(val).trim() !== '');
        });

        if (slotKeys.length > 0 && hasUnassignedSlot) {
          needsAssignment++;
        }
      });
      setSchedulesToAssign(needsAssignment);
    });

    return () => unsub();
  }, []);

  // Count pending reservations
  useEffect(() => {
    const reservationsCol = collection(db, 'reservations');
    const q = query(reservationsCol, where('status', '==', 'pending'));
    
    const unsub = onSnapshot(q, (snap) => {
      setPendingReservations(snap.size);
    });

    return () => unsub();
  }, []);

  return (
    <div style={{ padding: '0 0 32px 0' }}>
      <h2 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: 32, color: '#0a2f5c' }}>Dashboard</h2>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24 }}>
        {/* Faculty Scheduling Card */}
        <div
          onClick={() => navigate('faculty-scheduling')}
          style={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            borderRadius: 16,
            padding: 32,
            color: '#fff',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)',
            transition: 'transform 0.2s, box-shadow 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-4px)';
            e.currentTarget.style.boxShadow = '0 8px 16px rgba(102, 126, 234, 0.4)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.3)';
          }}
        >
          <HiCalendarDays style={{ fontSize: 48, marginBottom: 16 }} />
          <h3 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: 8 }}>Faculty Scheduling</h3>
          <p style={{ fontSize: '1rem', opacity: 0.9, marginBottom: 16 }}>Create and manage class schedules</p>
          <div style={{ fontSize: '2rem', fontWeight: 800 }}>TO ASSIGN: {schedulesToAssign}</div>
        </div>

        {/* Reservations Card */}
        <div
          onClick={() => navigate('reservations')}
          style={{
            background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
            borderRadius: 16,
            padding: 32,
            color: '#fff',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(240, 147, 251, 0.3)',
            transition: 'transform 0.2s, box-shadow 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-4px)';
            e.currentTarget.style.boxShadow = '0 8px 16px rgba(240, 147, 251, 0.4)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(240, 147, 251, 0.3)';
          }}
        >
          <HiBookOpen style={{ fontSize: 48, marginBottom: 16 }} />
          <h3 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: 8 }}>Reservations</h3>
          <p style={{ fontSize: '1rem', opacity: 0.9, marginBottom: 16 }}>Manage room reservations</p>
          <div style={{ fontSize: '2rem', fontWeight: 800 }}>TO REVIEW: {pendingReservations}</div>
        </div>
      </div>
    </div>
  );
};

export default ProgramHeadHome;
