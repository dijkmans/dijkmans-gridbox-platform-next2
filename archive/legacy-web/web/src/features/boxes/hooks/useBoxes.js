import { useState, useEffect } from "react";
import { fetchBoxes } from "../api/getBoxes";

export const useBoxes = () => {
  const [boxes, setBoxes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadBoxes = async () => {
      try {
        const data = await fetchBoxes();
        setBoxes(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadBoxes();
  }, []);

  return { boxes, loading, error };
};
