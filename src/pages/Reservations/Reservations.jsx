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
m     
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
    } catch (error) {
      console.error("Error declining reservation:", error);
      alert("Failed to decline reservation.");
    }
  };

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
            <table className="reservations-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Date</th>
                  <th>Slot Timing</th>
                  <th>Room</th>
                  <th>Room Type</th>
                  <th>Notes</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {reservations.length === 0 ? (
                  <tr><td colSpan={7} style={{ textAlign: "center" }}>No reservations found.</td></tr>
                ) : (
                  reservations.map((reservation) => (
                    <tr key={reservation.id}>
                      <td className="name-cell">{reservation.requesterName || reservation.requester_name || reservation.requester || "-"}</td>
                      <td>{reservation.dateLabel || reservation.dateISO || "-"}</td>
                      <td>{reservation.timeSlot || reservation.slotTiming || "-"}</td>
                      <td>{reservation.roomName || reservation.roomname || reservation.from || "-"}</td>
                      <td>{reservation.roomType || reservation.roomtype || "-"}</td>
                      <td className="notes-cell">{reservation.notes || "-"}</td>
                      <td className="status-cell">
                        <button
                          className="approve-btn"
                          onClick={() => handleApprove(reservation.id)}
                          disabled={reservation.status === "approved"}
                        >
                          Approve
                        </button>
                        <button
                          className="decline-btn"
                          onClick={() => handleDecline(reservation.id)}
                          disabled={reservation.status === "declined"}
                        >
                          Decline
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default Reservations;
