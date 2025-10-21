import React, { useState, useEffect } from "react";
import { HiChevronLeft } from "react-icons/hi2";
import { useNavigate } from "react-router-dom";
import "./Reservations.css";
import { db } from "../../firebase";
import { collection, getDocs, doc, updateDoc, serverTimestamp } from "firebase/firestore";

const Reservations = () => {
  const navigate = useNavigate();
  

  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openNote, setOpenNote] = useState(null); // { id, text }

  useEffect(() => {
    const fetchReservations = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "reservations"));
        const data = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setReservations(data);
      } catch (error) {
        console.error("Error fetching reservations:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchReservations();
  }, []);


  const handleApprove = async (id) => {
    try {
      const reservationRef = doc(db, "reservations", id);
      await updateDoc(reservationRef, { 
        status: "approved",
        updatedAt: serverTimestamp()
      });
      setReservations((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status: "approved" } : r))
      );
      alert("Reservation approved successfully!");
    } catch (error) {
      console.error("Error approving reservation:", error);
      alert("Failed to approve reservation.");
    }
  };

  const handleDecline = async (id) => {
    try {
      const reservationRef = doc(db, "reservations", id);
      await updateDoc(reservationRef, { 
        status: "declined",
        updatedAt: serverTimestamp()
      });
      setReservations((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status: "declined" } : r))
      );
      alert("Reservation declined successfully!");
    } catch (error) {
      console.error("Error declining reservation:", error);
      alert("Failed to decline reservation.");
    }
  };

  const closeNote = () => setOpenNote(null);

  return (
    <div className="reservations-container">
      <div className="reservations-header">
        <button className="back-button" onClick={() => navigate(-1)}>
          <HiChevronLeft className="back-icon" />
          <span>Reservations</span>
        </button>
      </div>

      <div className="reservations-content">
        <h2 className="section-title">Details</h2>
        <div className="reservations-table-wrapper">
          {loading ? (
            <div style={{ padding: 32, textAlign: "center" }}>Loading...</div>
          ) : (
            <>
              {/* Group reservations by status */}
              {(() => {
                const pending = reservations.filter(r => !r.status || r.status === 'pending');
                const approved = reservations.filter(r => r.status === 'approved');
                const declined = reservations.filter(r => r.status === 'declined');

                const renderTable = (list, showActions = false) => (
                  <table className="reservations-table" style={{ marginBottom: 24 }}>
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Date</th>
                        <th>Slot Timing</th>
                        <th>Room</th>
                        <th>Room Type</th>
                        <th>Notes</th>
                        <th>{showActions ? 'Actions' : 'Status'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {list.length === 0 ? (
                        <tr><td colSpan={7} style={{ textAlign: 'center' }}>No entries.</td></tr>
                      ) : (
                        list.map(reservation => (
                          <tr key={reservation.id}>
                            <td className="name-cell">{reservation.requesterName || reservation.requester_name || reservation.requester || '-'}</td>
                            <td>{reservation.dateLabel || reservation.dateISO || '-'}</td>
                            <td>{reservation.timeSlot || reservation.slotTiming || '-'}</td>
                            <td>{reservation.roomName || reservation.roomname || reservation.from || '-'}</td>
                            <td>{reservation.roomType || reservation.roomtype || '-'}</td>
                            <td className="notes-cell" onClick={() => reservation.notes && setOpenNote({ id: reservation.id, text: reservation.notes })}>
                              {reservation.notes || '-'}
                            </td>
                            <td className="status-cell">
                              {showActions ? (
                                <>
                                  <button
                                    className="approve-btn"
                                    onClick={() => handleApprove(reservation.id)}
                                    disabled={reservation.status === 'approved'}
                                  >Approve</button>
                                  <button
                                    className="decline-btn"
                                    onClick={() => handleDecline(reservation.id)}
                                    disabled={reservation.status === 'declined'}
                                  >Decline</button>
                                </>
                              ) : (
                                <span className={`status-label ${reservation.status || 'pending'}`}>{(reservation.status || 'Pending').toUpperCase()}</span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                );

                return (
                  <>
                    <h3 style={{ marginTop: 6 }}>Pending</h3>
                    {renderTable(pending, true)}

                    <h3>Approved</h3>
                    {renderTable(approved, false)}

                    <h3>Declined</h3>
                    {renderTable(declined, false)}
                  </>
                );
              })()}
            </>
          )}
        </div>
        {openNote && (
          <div className="note-modal-backdrop" onClick={closeNote}>
            <div className="note-modal" onClick={(e) => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong>Note</strong>
                <button className="close-btn" onClick={closeNote}>Close</button>
              </div>
              <div className="note-content">{openNote.text}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Reservations;
