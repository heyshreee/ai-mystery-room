import { useCallback, useEffect, useRef, useState } from "react";
import type { GameSessionView } from "@amr/shared";
import { api, ApiError } from "../lib/api";
import {
  clearStoredSessionId,
  readStoredSessionId,
  storeSessionId,
} from "../lib/session-storage";

interface SessionState {
  session: GameSessionView | null;
  loading: boolean;
  error: unknown;
}

interface SessionPromiseCache {
  caseId: string;
  promise: Promise<GameSessionView>;
}

async function initializeSession(caseId: string): Promise<GameSessionView> {
  const storedId = readStoredSessionId(caseId);

  if (storedId) {
    try {
      return await api.getSession(storedId);
    } catch (error) {
      if (
        error instanceof ApiError &&
        (error.code === "SESSION_NOT_FOUND" || error.code === "SESSION_EXPIRED")
      ) {
        clearStoredSessionId(caseId);
      } else {
        throw error;
      }
    }
  }

  const session = await api.createSession(caseId);
  storeSessionId(caseId, session.id);
  return session;
}

export function useCaseSession(caseId: string) {
  const [state, setState] = useState<SessionState>({
    session: null,
    loading: true,
    error: null,
  });
  const [reloadKey, setReloadKey] = useState(0);
  const promiseRef = useRef<SessionPromiseCache | null>(null);

  useEffect(() => {
    let active = true;
    setState((current) => ({ ...current, loading: true, error: null }));

    if (!promiseRef.current || promiseRef.current.caseId !== caseId) {
      promiseRef.current = {
        caseId,
        promise: initializeSession(caseId),
      };
    }

    promiseRef.current.promise
      .then((session) => {
        if (active) {
          setState({ session, loading: false, error: null });
        }
      })
      .catch((error: unknown) => {
        if (!active) {
          return;
        }
        promiseRef.current = null;
        setState({ session: null, loading: false, error });
      });

    return () => {
      active = false;
    };
  }, [caseId, reloadKey]);

  const reload = useCallback(() => {
    promiseRef.current = null;
    setReloadKey((value) => value + 1);
  }, []);

  const setSession = useCallback((session: GameSessionView) => {
    setState({ session, loading: false, error: null });
  }, []);

  const updateSession = useCallback(
    (updater: (session: GameSessionView) => GameSessionView) => {
      setState((current) =>
        current.session
          ? { ...current, session: updater(current.session) }
          : current,
      );
    },
    [],
  );

  return { ...state, reload, setSession, updateSession };
}
