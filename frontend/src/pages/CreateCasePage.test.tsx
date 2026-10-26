import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useParams } from "react-router-dom";
import {
  SCENARIO_MIN_LENGTH,
  type GenerationStatusView,
} from "@amr/shared";
import { CreateCasePage } from "./CreateCasePage";

const VALID_SCENARIO =
  "A signed first edition vanishes from a locked rare-books room during a private reading.";

const GENERATION_ID = "a".repeat(24);
const CASE_ID = "b".repeat(24);

function CaseProbe() {
  const { caseId } = useParams();
  return <div data-testid="case-probe">Case {caseId}</div>;
}

function renderCreatePage() {
  return render(
    <MemoryRouter initialEntries={["/create"]}>
      <Routes>
        <Route path="/create" element={<CreateCasePage />} />
        <Route path="/case/:caseId" element={<CaseProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function accepted(generation: GenerationStatusView): Response {
  return jsonResponse({ data: generation }, 202);
}

function statusResponse(generation: GenerationStatusView): Response {
  return jsonResponse({ data: generation });
}

function generation(
  overrides: Partial<GenerationStatusView> = {},
): GenerationStatusView {
  return {
    id: GENERATION_ID,
    caseId: CASE_ID,
    status: "pending",
    stage: "normalizing_brief",
    provider: "mock",
    message: "Reading the brief.",
    createdAt: "2026-10-26T10:00:00.000Z",
    ...overrides,
  };
}

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function postCalls() {
  return fetchMock.mock.calls.filter(
    ([, init]) => (init as RequestInit | undefined)?.method === "POST",
  );
}

async function submitValidBrief(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Scenario"), VALID_SCENARIO);
  await user.click(screen.getByRole("button", { name: "Create the case" }));
}

describe("CreateCaseForm", () => {
  it("blocks an empty submission with accessible client-side validation", async () => {
    const user = userEvent.setup();
    renderCreatePage();

    await user.click(screen.getByRole("button", { name: "Create the case" }));

    expect(
      screen.getByText(`Scenario must be at least ${SCENARIO_MIN_LENGTH} characters.`),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Scenario")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("Scenario")).toHaveFocus();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows honest stage progress, provider disclosure, and locks the form", async () => {
    const user = userEvent.setup();
    fetchMock
      .mockResolvedValueOnce(accepted(generation()))
      .mockResolvedValueOnce(
        statusResponse(
          generation({
            stage: "drafting_blueprint",
            message: "Drafting the suspects and exhibits.",
          }),
        ),
      );

    renderCreatePage();
    await submitValidBrief(user);

    expect(
      await screen.findByRole("heading", { name: "Building the case file" }),
    ).toBeInTheDocument();
    expect(
      await screen.findByText("Drafting the suspects and exhibits."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Mock generator — deterministic, no network"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/No percentage is shown because the server reports stages/),
    ).toBeInTheDocument();

    const activeStep = screen.getByText("Draft the case").closest("li");
    expect(activeStep).toHaveAttribute("aria-current", "step");
    expect(screen.getByText("Read the brief").closest("li")).not.toHaveAttribute(
      "aria-current",
    );

    expect(screen.getByLabelText("Scenario")).toBeDisabled();
    expect(screen.getByLabelText("Category")).toBeDisabled();
    const submit = screen.getByRole("button", { name: "Preparing the case…" });
    expect(submit).toBeDisabled();

    expect(postCalls()).toHaveLength(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/cases");
    expect(fetchMock.mock.calls[1]?.[0]).toBe(`/api/generation/${GENERATION_ID}`);
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(String(init.body))).toEqual({
      scenario: VALID_SCENARIO,
      category: "theft",
      difficulty: "medium",
      evidencePreferences: [],
    });
    expect(init.headers).toMatchObject({
      "Idempotency-Key": expect.stringMatching(/^case-/),
    });
  });

  it("advances staged polling and opens the ready investigation room", async () => {
    const user = userEvent.setup();
    fetchMock
      .mockResolvedValueOnce(accepted(generation()))
      .mockResolvedValueOnce(statusResponse(generation()))
      .mockResolvedValueOnce(
        statusResponse(
          generation({
            stage: "validating_case",
            message: "Checking every clue against the timeline.",
          }),
        ),
      )
      .mockResolvedValueOnce(
        statusResponse(
          generation({
            status: "ready",
            stage: "published",
            message: "The case file is ready.",
            completedAt: "2026-10-26T10:00:04.000Z",
          }),
        ),
      );

    renderCreatePage();
    await submitValidBrief(user);

    expect(await screen.findByText("Reading the brief.")).toBeInTheDocument();
    expect(
      await screen.findByText("Checking every clue against the timeline.", {}, {
        timeout: 3_000,
      }),
    ).toBeInTheDocument();
    expect(await screen.findByTestId("case-probe", {}, { timeout: 3_000 })).toHaveTextContent(
      `Case ${CASE_ID}`,
    );
    expect(postCalls()).toHaveLength(1);
  });

  it("reports a definitive failure and retries with a fresh idempotency key", async () => {
    const user = userEvent.setup();
    fetchMock
      .mockResolvedValueOnce(accepted(generation()))
      .mockResolvedValueOnce(
        statusResponse(
          generation({
            status: "failed",
            stage: "failed",
            errorCode: "INVALID_AI_OUTPUT",
            message:
              "The generator produced a case that failed validation. No partial case was published; the sample remains available.",
            completedAt: "2026-10-26T10:00:04.000Z",
          }),
        ),
      )
      .mockResolvedValueOnce(
        accepted(
          generation({
            id: "c".repeat(24),
            stage: "normalizing_brief",
            message: "Reading the brief again.",
          }),
        ),
      )
      .mockResolvedValueOnce(
        statusResponse(
          generation({
            id: "c".repeat(24),
            stage: "drafting_blueprint",
            message: "Drafting the suspects and exhibits.",
          }),
        ),
      );

    renderCreatePage();
    await submitValidBrief(user);

    expect(
      await screen.findByRole("heading", { name: "The case was not published" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Output rejected by validation")).toBeInTheDocument();
    expect(
      screen.getByText(/No partial case was published; the sample remains available/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/A retry uses a new request key/),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("case-probe")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Try this brief again" }));

    await screen.findByRole("heading", { name: "Building the case file" });

    const posts = postCalls();
    expect(posts).toHaveLength(2);
    const firstKey = (posts[0]?.[1] as RequestInit).headers as Record<string, string>;
    const secondKey = (posts[1]?.[1] as RequestInit).headers as Record<string, string>;
    expect(firstKey["Idempotency-Key"]).toMatch(/^case-/);
    expect(secondKey["Idempotency-Key"]).toMatch(/^case-/);
    expect(secondKey["Idempotency-Key"]).not.toBe(firstKey["Idempotency-Key"]);
    expect(JSON.parse(String((posts[1]?.[1] as RequestInit).body))).toEqual(
      JSON.parse(String((posts[0]?.[1] as RequestInit).body)),
    );
  });

  it("recovers from an interrupted progress check without resubmitting", async () => {
    const user = userEvent.setup();
    fetchMock
      .mockResolvedValueOnce(accepted(generation()))
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(
        statusResponse(
          generation({
            stage: "validating_case",
            message: "Checking every clue against the timeline.",
          }),
        ),
      );

    renderCreatePage();
    await submitValidBrief(user);

    expect(
      await screen.findByRole("heading", { name: "Progress check interrupted" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/The case may still be generating on the server/)).toBeInTheDocument();
    expect(screen.getByLabelText("Scenario")).toBeDisabled();
    expect(postCalls()).toHaveLength(1);

    await user.click(screen.getByRole("button", { name: "Check again" }));

    expect(
      await screen.findByText("Checking every clue against the timeline."),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Progress check interrupted" }),
    ).not.toBeInTheDocument();
    expect(postCalls()).toHaveLength(1);
  });

  it("reuses the request key after an ambiguous submission failure", async () => {
    const user = userEvent.setup();
    fetchMock
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(accepted(generation()))
      .mockResolvedValueOnce(
        statusResponse(
          generation({
            stage: "drafting_blueprint",
            message: "Drafting the suspects and exhibits.",
          }),
        ),
      );

    renderCreatePage();
    await submitValidBrief(user);

    expect(
      await screen.findByRole("heading", { name: "The case could not be submitted" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Check your connection and try again/),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Submit the brief again" }));

    await screen.findByRole("heading", { name: "Building the case file" });

    const posts = postCalls();
    expect(posts).toHaveLength(2);
    const firstKey = ((posts[0]?.[1] as RequestInit).headers as Record<string, string>)[
      "Idempotency-Key"
    ];
    const secondKey = ((posts[1]?.[1] as RequestInit).headers as Record<string, string>)[
      "Idempotency-Key"
    ];
    expect(secondKey).toBe(firstKey);
  });

  it("maps server field errors back onto the brief", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "The case brief is invalid.",
            details: [
              {
                field: "scenario",
                message: "Scenario was rejected by the case validator.",
              },
            ],
            requestId: "req_validation",
          },
        },
        400,
      ),
    );

    renderCreatePage();

    await user.type(screen.getByLabelText("Scenario"), VALID_SCENARIO);
    await user.click(screen.getByRole("button", { name: "Create the case" }));

    await waitFor(() => {
      expect(
        screen.getByText("Scenario was rejected by the case validator."),
      ).toBeInTheDocument();
    });
    expect(screen.getByLabelText("Scenario")).toHaveAttribute("aria-invalid", "true");
    expect(
      screen.getByRole("heading", { name: "The case could not be submitted" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Building the case file" })).not.toBeInTheDocument();
  });
});
