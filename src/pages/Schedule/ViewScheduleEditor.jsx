import React, { useMemo } from 'react';
import './Schedule.css';
import stiLogo from '../../assets/stilogo.png';

const filterChips = [
  { label: 'BSIT', color: '#2196f3' },
  { label: '1st Year, 1st Semester', color: '#2196f3' },
  { label: 'BT1101', color: '#2196f3' }
];

const roomOptions = ['RM101', 'RM103', 'RM104', 'COMP LAB 601', 'COMP LAB 602', 'ROOM 201', 'ROOM 202'];

const ViewScheduleEditor = ({ sectionName, schedule }) => {
  const times = useMemo(() => [
    '7:00AM','7:30AM','8:00AM','8:30AM','9:00AM','9:30AM','10:00AM','10:30AM','11:00AM','11:30AM','12:00PM','12:30PM','1:00PM','1:30PM','2:00PM','2:30PM','3:00PM','3:30PM','4:00PM','4:30PM','5:00PM','5:30PM','6:00PM','6:30PM','7:00PM','7:30PM','8:00PM','8:30PM'
  ], []);
  const getTimeIndex = (t) => times.indexOf(t);

  // Helper to check if a cell is covered by a rowSpan above
  const isCovered = (day, timeIdx) => {
    for (const [key, val] of Object.entries(schedule)) {
      const [d, t] = key.split('_');
      if (d !== day) continue;
      const startIdx = getTimeIndex(t);
      if (startIdx === -1) continue;
      const slots = val?.durationSlots || 1;
      if (timeIdx > startIdx && timeIdx < startIdx + slots) return true;
    }
    return false;
  };

  return (
    <div style={{display: 'flex', height: '100vh', background: '#222'}}>
      {/* Sidebar (read-only) */}
      <div style={{width: 320, background: '#2b2b2b', color: '#fff', padding: 16, display: 'flex', flexDirection: 'column'}}>
        <div style={{display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16}}>
          <img src={stiLogo} alt="STI" style={{height: 32}} />
          <span style={{fontWeight: 700, fontSize: 18}}>Subjects</span>
        </div>
        {/* No subject list in view mode */}
      </div>

      {/* Main Content */}
      <div style={{flex: 1, background: '#fff', borderRadius: '0 0 8px 8px', padding: '32px 32px 0 32px', display: 'flex', flexDirection: 'column'}}>
        {/* Header */}
        <div style={{display: 'flex', alignItems: 'center', marginBottom: 24}}>
          <span style={{fontSize: 28, fontWeight: 700, fontFamily: 'Alata, sans-serif', marginRight: 24}}>Academic Resource Management</span>
          <div style={{marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 16}}>
            <span style={{fontWeight: 500, fontSize: 18}}>Academic Head</span>
          </div>
        </div>
        {/* Filter Chips */}
        <div style={{display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16}}>
          {filterChips.map(chip => (
            <span key={chip.label} style={{background: chip.color, color: '#fff', borderRadius: 16, padding: '6px 18px', fontWeight: 600, fontSize: 16}}>{chip.label}</span>
          ))}
          {sectionName && (
            <span style={{background: '#2196f3', color: '#fff', borderRadius: 16, padding: '6px 18px', fontWeight: 700, fontSize: 16}}>{sectionName}</span>
          )}
        </div>

        {/* Schedule Grid (read-only) */}
        <div style={{width: '100%', overflowX: 'auto'}}>
          <table style={{width: '100%', borderCollapse: 'collapse', fontFamily: 'Alata, sans-serif'}}>
            <thead>
              <tr>
                <th style={{border: '1px solid #ccc', padding: '4px 8px', background: '#f5f5f5', fontWeight: 700}}>Time</th>
                <th style={{border: '1px solid #ccc', padding: '4px 8px', background: '#f5f5f5'}}>Monday</th>
                <th style={{border: '1px solid #ccc', padding: '4px 8px', background: '#f5f5f5'}}>Tuesday</th>
                <th style={{border: '1px solid #ccc', padding: '4px 8px', background: '#f5f5f5'}}>Wednesday</th>
                <th style={{border: '1px solid #ccc', padding: '4px 8px', background: '#f5f5f5'}}>Thursday</th>
                <th style={{border: '1px solid #ccc', padding: '4px 8px', background: '#f5f5f5'}}>Friday</th>
                <th style={{border: '1px solid #ccc', padding: '4px 8px', background: '#f5f5f5'}}>Saturday</th>
              </tr>
            </thead>
            <tbody>
              {times.map((time, ti) => (
                <tr key={time}>
                  <td style={{border: '1px solid #ccc', padding: '4px 8px', fontWeight: 'bold', background: '#f5f5f5'}}>{time}</td>
                  {['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'].map((day, i) => {
                    const cellKey = `${day}_${time}`;
                    const scheduled = schedule[cellKey];
                    if (!scheduled && isCovered(day, ti)) return null;
                    return (
                      <td
                        key={i}
                        rowSpan={scheduled?.durationSlots || 1}
                        style={{
                          border: '1px solid #ccc',
                          padding: '4px 8px',
                          background: scheduled ? '#ffe600' : '#fff',
                          minWidth: 100,
                          height: scheduled ? undefined : 40,
                          position: 'relative'
                        }}
                      >
                        {scheduled && (
                          <div style={{color: '#222', fontWeight: 'bold', borderRadius: 0, padding: '6px 6px', textAlign: 'center'}}>
                            <div style={{fontSize: 12, lineHeight: 1.1, marginBottom: 6}}>{scheduled.subject}</div>
                            <div style={{display:'flex', gap:6, justifyContent:'center'}}>
                              <span style={{background:'#fff', border:'1px solid #c7c7c7', borderRadius:6, padding:'2px 10px', fontWeight:600, fontSize:12}}>{scheduled.room}</span>
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
  );
};

export default ViewScheduleEditor;
