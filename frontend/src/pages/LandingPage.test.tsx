import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useParams } from "react-router-dom";
import { LandingPage } from "./LandingPage";

function CaseProbe() {
  const { caseId } = useParams();
  return <div data-testid="case-probe">Case {caseId}</div>;
}

function renderLanding() {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/case/:caseId" element={<CaseProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  window.sessionStorage.clear();
});

function createdSampleResponse() {
  return new Response(
    JSON.stringify({
      data: {
        case: { id: "case_123" },
        generationId: "gen_123",
        sample: true,
      },
    }),
    { status: 201, headers: { "content-type": "application/json" } },
  );
}

describe("LandingPage sample flow", () => {
  it("creates the sample case and navigates to its investigation room", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(createdSampleResponse());

    renderLanding();

    await user.click(
      screen.getAllByRole("button", { name: /play the sample case/i })[0]!,
    );

    expect(await screen.findByTestId("case-probe")).toHaveTextContent("Case case_123");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/cases",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ sample: true }),
        headers: expect.objectContaining({
          "Idempotency-Key": expect.stringMatching(/^sample-/),
        }),
      }),
    );
  });

  it("shows a recoverable error and retries without leaving the landing page", async () => {
    const user = userEvent.setup();
    fetchMock
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValueOnce(createdSampleResponse());

    renderLanding();

    await user.click(
      screen.getAllByRole("button", { name: /play the sample case/i })[0]!,
    );

    expect(
      await screen.findByRole("heading", {
        name: "The sample file could not be prepared",
      }),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("case-probe")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /try the sample again/i }));

    expect(await screen.findByTestId("case-probe")).toHaveTextContent("Case case_123");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
