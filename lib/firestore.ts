import { 
  collection, 
  addDoc, 
  getDocs, 
  doc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  Timestamp 
} from "firebase/firestore"
import { db } from "./firebase"
import type { Reservation, ReservationRequest } from "./types"

// Reservations collection
const RESERVATIONS_COLLECTION = "reservations"

export async function createReservation(data: ReservationRequest): Promise<string> {
  try {
    const docRef = await addDoc(collection(db, RESERVATIONS_COLLECTION), {
      ...data,
      status: "pending",
      createdAt: new Date(),
      date: Timestamp.fromDate(data.date),
    })
    return docRef.id
  } catch (error) {
    console.error("Error creating reservation:", error)
    throw new Error("Failed to create reservation")
  }
}

export async function getReservations(): Promise<Reservation[]> {
  try {
    const q = query(
      collection(db, RESERVATIONS_COLLECTION),
      orderBy("createdAt", "desc")
    )
    const querySnapshot = await getDocs(q)
    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      date: doc.data().date.toDate(),
      createdAt: doc.data().createdAt.toDate(),
    })) as Reservation[]
  } catch (error) {
    console.error("Error fetching reservations:", error)
    throw new Error("Failed to fetch reservations")
  }
}

export async function getUserReservations(userId: string): Promise<Reservation[]> {
  try {
    const q = query(
      collection(db, RESERVATIONS_COLLECTION),
      where("userId", "==", userId),
      orderBy("createdAt", "desc")
    )
    const querySnapshot = await getDocs(q)
    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      date: doc.data().date.toDate(),
      createdAt: doc.data().createdAt.toDate(),
    })) as Reservation[]
  } catch (error) {
    console.error("Error fetching user reservations:", error)
    throw new Error("Failed to fetch user reservations")
  }
}

export async function updateReservationStatus(
  reservationId: string, 
  status: "approved" | "rejected"
): Promise<void> {
  try {
    const reservationRef = doc(db, RESERVATIONS_COLLECTION, reservationId)
    await updateDoc(reservationRef, {
      status,
      updatedAt: new Date(),
    })
  } catch (error) {
    console.error("Error updating reservation status:", error)
    throw new Error("Failed to update reservation status")
  }
}

export async function deleteReservation(reservationId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, RESERVATIONS_COLLECTION, reservationId))
  } catch (error) {
    console.error("Error deleting reservation:", error)
    throw new Error("Failed to delete reservation")
  }
}

export async function getReservationsForDate(date: Date): Promise<Reservation[]> {
  try {
    const startOfDay = new Date(date)
    startOfDay.setHours(0, 0, 0, 0)
    
    const endOfDay = new Date(date)
    endOfDay.setHours(23, 59, 59, 999)

    const q = query(
      collection(db, RESERVATIONS_COLLECTION),
      where("date", ">=", Timestamp.fromDate(startOfDay)),
      where("date", "<=", Timestamp.fromDate(endOfDay)),
      where("status", "==", "approved")
    )
    
    const querySnapshot = await getDocs(q)
    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      date: doc.data().date.toDate(),
      createdAt: doc.data().createdAt.toDate(),
    })) as Reservation[]
  } catch (error) {
    console.error("Error fetching reservations for date:", error)
    throw new Error("Failed to fetch reservations for date")
  }
}
