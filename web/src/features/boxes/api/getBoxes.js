import { db } from "../../../lib/firebase";
import { collection, getDocs } from "firebase/firestore";

/**
 * Haalt alle gridboxen op uit Firestore
 */
export const fetchBoxes = async () => {
  try {
    const boxesCol = collection(db, "boxes");
    const boxSnapshot = await getDocs(boxesCol);
    const boxList = boxSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    return boxList;
  } catch (error) {
    console.error("Fout bij het ophalen van boxen:", error);
    throw error;
  }
};
