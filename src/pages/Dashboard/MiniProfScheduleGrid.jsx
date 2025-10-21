import React, { useEffect, useState } from "react";
import { db } from "../../firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";

const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
 const timeSlots = [
    '7:00AM', '7:30AM', '8:00AM', '8:30AM', '9:00AM', '9:30AM',
    '10:00AM', '10:30AM', '11:00AM', '11:30AM', '12:00PM', '12:30PM',
    '1:00PM', '1:30PM', '2:00PM', '2:30PM', '3:00PM', '3:30PM',
    '4:00PM', '4:30PM', '5:00PM', '5:30PM', '6:00PM', '6:30PM',
    '7:00PM', '7:30PM', '8:00PM'
  ];

function getTimeIndex(t) {
  return timeSlots.indexOf(t);
}

function calculateEndTime(startTime, durationSlots) {
  const startIdx = getTimeIndex(startTime);
  if (startIdx === -1 || !durationSlots) return "";
  const endIdx = startIdx + Math.floor(durationSlots);
  return endIdx < timeSlots.length ? timeSlots[endIdx] : "";
}

export default function MiniProfScheduleGrid({ professor, program, semester, yearLevel, year, manualAssignments = [] }) {
  const [classBlocks, setClassBlocks] = useState([]);

  // Combine class blocks and manual assignments for display
  const allBlocks = React.useMemo(() => {
    // Map manual assignments to grid blocks
    const manualBlocks = (manualAssignments || []).filter(a => a.day && a.time && a.type).map(a => ({
      day: a.day,
      startTime: a.time,
      durationSlots: Math.round((a.hours || 0.5) * 2), // Convert hours to 30-min slots (0.5hr = 1 slot, 1hr = 2 slots)
      subject: a.type === 'Consultation' ? 'CONSULTATION' : 'ADMIN',
      room: '',
      section: '',
      isManual: true,
      color: a.type === 'Consultation' ? '#93c5fd' : '#fca5a5',
      textColor: a.type === 'Consultation' ? '#1e3a8a' : '#7f1d1d'
    }));
    // Class blocks (yellow)
    const classGridBlocks = classBlocks.map(b => ({ ...b, isManual: false, color: '#fef08a', textColor: '#1e293b' }));
    // Show manual blocks on top
    return [...classGridBlocks, ...manualBlocks];
  }, [classBlocks, manualAssignments]);

  useEffect(() => {
    if (!professor) return;
    let q = query(
      collection(db, "schedules"),
      where("program", "==", program),
      where("semester", "==", semester)
    );
    if (yearLevel) q = query(q, where("yearLevel", "==", yearLevel));
    if (year) q = query(q, where("year", "==", year));
    const unsub = onSnapshot(q, (snap) => {
      const blocks = [];
      snap.forEach((docSnap) => {
        const data = docSnap.data();
        const sectionName = data.sectionName || docSnap.id;
        const schedule = data.schedule || {};
        const professorAssignments = data.professorAssignments || {};
        Object.entries(schedule).forEach(([key, val]) => {
          const [day, time] = key.split("_");
          const assignedProf = professorAssignments[key];
          if (assignedProf === professor && val && val.subject) {
            blocks.push({
              day,
              startTime: time,
              durationSlots: val.durationSlots || 1,
              subject: val.subject,
              room: val.room || "",
              section: sectionName
            });
          }
        });
      });
      setClassBlocks(blocks);
    });
    return () => unsub();
  }, [professor, program, semester, yearLevel, year]);

  return (
    <div style={{ width: "100%", overflowX: "auto", margin: "16px 0" }}>
      <table style={{ borderCollapse: "collapse", width: "100%", background: "#fff" }}>
        <thead>
          <tr style={{ background: "#f1f5f9" }}>
            <th style={{ width: 70 }}></th>
            {days.map(day => (
              <th key={day} style={{ padding: 4, fontSize: 12, fontWeight: 700, color: "#1e293b" }}>{day}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {timeSlots.map(time => (
            <tr key={time}>
              <td style={{ fontSize: 11, color: "#64748b", textAlign: "right", paddingRight: 6 }}>{time}</td>
              {days.map(day => {
                // Find the topmost block (manual blocks take priority)
                const block = allBlocks.find(b => b.day === day && b.startTime === time);
                if (block) {
                  const endTime = calculateEndTime(block.startTime, block.durationSlots);
                  return (
                    <td
                      key={day + time}
                      rowSpan={block.durationSlots}
                      style={{
                        background: block.color,
                        color: block.textColor,
                        fontWeight: 600,
                        fontSize: 11,
                        border: "1px solid #e5e7eb",
                        minWidth: 80,
                        textAlign: "center",
                        position: "relative"
                      }}
                    >
                      <div>{block.subject}</div>
                      {block.room && <div style={{ fontSize: 10 }}>{block.room}</div>}
                      {block.section && <div style={{ fontSize: 10 }}>{block.section}</div>}
                      <div style={{ fontSize: 10, marginTop: 2 }}>{block.startTime}{endTime ? ` - ${endTime}` : ""}</div>
                    </td>
                  );
                }
                // If this slot is covered by a previous rowSpan, render nothing
                const isCovered = allBlocks.some(b => {
                  if (b.day !== day) return false;
                  const startIdx = getTimeIndex(b.startTime);
                  const slotIdx = getTimeIndex(time);
                  return slotIdx > startIdx && slotIdx < startIdx + (b.durationSlots || 1);
                });
                return isCovered ? null : <td key={day + time} style={{ border: "1px solid #e5e7eb", minWidth: 80 }}></td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
