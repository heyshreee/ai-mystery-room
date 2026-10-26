import { useCallback, useEffect, useState } from "react";
import type { EvidenceSummary, PublicCase } from "@amr/shared";
import { api } from "../lib/api";

interface PublicCaseState {
  caseData: PublicCase | null;
  evidence: EvidenceSummary[];
  loading: boolean;
  error: unknown;
}

export function usePublicCase(caseId: string) {
  const [state, setState] = useState<PublicCaseState>({
    caseData: null,
    evidence: [],
    loading: true,
    error: null,
  });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    setState((current) => ({ ...current, loading: true, error: null }));

    Promise.all([
      api.getCase(caseId, controller.signal),
      api.listEvidence(caseId, controller.signal),
    ])
      .then(([caseData, evidenceList]) => {
        if (!active) {
          return;
        }
        setState({
          caseData,
          evidence: evidenceList.evidence,
          loading: false,
          error: null,
        });
      })
      .catch((error: unknown) => {
        if (!active || (error instanceof DOMException && error.name === "AbortError")) {
          return;
        }
        setState((current) => ({ ...current, loading: false, error }));
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [caseId, reloadKey]);

  const reload = useCallback(() => {
    setReloadKey((value) => value + 1);
  }, []);

  return { ...state, reload };
}
