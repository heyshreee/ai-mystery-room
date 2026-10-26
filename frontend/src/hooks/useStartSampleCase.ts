import { useCallback, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { createRequestKey } from "../lib/id";

export function useStartSampleCase() {
  const navigate = useNavigate();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const pendingRef = useRef(false);

  const start = useCallback(async () => {
    if (pendingRef.current) {
      return;
    }
    pendingRef.current = true;
    setPending(true);
    setError(null);
    try {
      const created = await api.createSampleCase(createRequestKey("sample"));
      navigate(`/case/${created.case.id}`);
    } catch (caught) {
      if (!(caught instanceof DOMException && caught.name === "AbortError")) {
        setError(caught);
      }
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  }, [navigate]);

  return {
    start,
    pending,
    error,
    clearError: () => setError(null),
  };
}
