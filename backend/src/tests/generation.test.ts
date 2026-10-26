import { describe, expect, it } from "vitest";
import { Types } from "mongoose";
import {
  CATEGORY_VALUES,
  DIFFICULTY_VALUES,
  EVIDENCE_PREFERENCE_VALUES,
  type Category,
  type Difficulty,
  type EvidencePreference,
} from "@amr/shared";
import { buildMockBlueprint } from "../generation/mock-blueprint.js";
import { caseBlueprintSchema } from "../generation/blueprint.js";
import { buildGeneratedCaseDocuments } from "../generation/mapper.js";
import { buildGenerationPrompts } from "../generation/prompt.js";
import { STATIC_EVIDENCE_DIAGRAM } from "../generation/media.js";
import { validateCaseStructure } from "../services/case-validation.js";
import type { GenerationRequest } from "../generation/types.js";

const SCENARIO =
  "A signed first edition vanishes from a locked rare-books room during a private reading. Three collectors were inside; one had already tried to buy it twice.";

const PREFERENCE_SETS: EvidencePreference[][] = [
  [],
  ["chat_transcript", "witness_statement"],
  ["image", "cctv_log", "access_log"],
  ["cctv_transcript", "suspect_statement", "document", "access_log"],
];

function requestFor(
  category: Category,
  difficulty: Difficulty,
  evidencePreferences: EvidencePreference[],
): GenerationRequest {
  return { scenario: SCENARIO, category, difficulty, evidencePreferences };
}

function documentsFor(request: GenerationRequest) {
  const blueprint = buildMockBlueprint(request);
  const docs = buildGeneratedCaseDocuments({
    blueprint,
    request,
    caseId: new Types.ObjectId(),
    generationId: new Types.ObjectId(),
    creatorSessionId: "test-guest-hash",
    provider: "mock",
    hintLimit: 3,
  });
  return { blueprint, docs };
}

describe("mock case generation", () => {
  it("produces a structurally valid case for every category and preference mix", () => {
    let cases = 0;
    for (const category of CATEGORY_VALUES) {
      for (const [index, difficulty] of DIFFICULTY_VALUES.entries()) {
        const preferences = PREFERENCE_SETS[index % PREFERENCE_SETS.length] ?? [];
        const request = requestFor(category, difficulty, preferences);
        const { blueprint, docs } = documentsFor(request);

        expect(caseBlueprintSchema.safeParse(blueprint).success).toBe(true);
        expect(blueprint.category).toBe(category);
        expect(blueprint.difficulty).toBe(difficulty);
        expect(docs.caseDoc.title).toBe(blueprint.title);
        expect(docs.caseDoc.scenario).toBe(SCENARIO);
        expect(docs.suspectDocs.length).toBeGreaterThanOrEqual(3);
        expect(docs.suspectDocs.length).toBeLessThanOrEqual(6);
        expect(docs.evidenceDocs.length).toBeGreaterThanOrEqual(4);
        expect(docs.evidenceDocs.length).toBeLessThanOrEqual(14);
        expect(docs.evidenceDocs[0]?.exhibitNumber).toBe(1);
        expect(docs.solutionDoc.validationStatus).toBe("pending");

        const validation = validateCaseStructure(docs);
        expect(validation.issues).toEqual([]);
        expect(validation.valid).toBe(true);

        const image = docs.evidenceDocs.find((evidence) => evidence.type === "image");
        expect(image).toBeTruthy();
        expect(image?.mediaStatus).toBe("ready");
        expect(image?.mediaUrl).toBe(STATIC_EVIDENCE_DIAGRAM.url);
        expect(image?.altText).toBeTruthy();
        expect(image?.content).toMatchObject({
          format: "image",
          imageUrl: STATIC_EVIDENCE_DIAGRAM.url,
          simulated: true,
        });

        const culprit = docs.suspectDocs.find((suspect) =>
          suspect._id.equals(docs.solutionDoc.culpritSuspectId),
        );
        expect(culprit).toBeTruthy();
        expect(docs.caseDoc.suspectIds.map((id) => id.toString())).toContain(
          docs.solutionDoc.culpritSuspectId.toString(),
        );
        expect(docs.solutionDoc.hintTexts).toHaveLength(3);
        expect(docs.solutionDoc.explanation).toContain("EXH-");
        cases += 1;
      }
    }
    expect(cases).toBe(CATEGORY_VALUES.length * DIFFICULTY_VALUES.length);
  });

  it("prefers requested evidence types when they fit the template", () => {
    const { docs } = documentsFor(
      requestFor("theft", "medium", [
        "cctv_transcript",
        "suspect_statement",
        "chat_transcript",
      ]),
    );
    const types = docs.evidenceDocs.map((evidence) => evidence.type);
    expect(types).toContain("cctv_transcript");
    expect(types).toContain("suspect_statement");
    expect(types).toContain("chat_transcript");
  });

  it("is deterministic for the same brief", () => {
    const first = buildMockBlueprint(requestFor("fraud", "hard", []));
    const second = buildMockBlueprint(requestFor("fraud", "hard", []));
    expect(second.title).toBe(first.title);
    expect(second.culpritKey).toBe(first.culpritKey);
    expect(second.publicTimeline).toEqual(first.publicTimeline);
    expect(second.evidence.map((evidence) => evidence.key)).toEqual(
      first.evidence.map((evidence) => evidence.key),
    );
  });

  it("keeps public metadata and hints from naming the culprit", () => {
    const { blueprint, docs } = documentsFor(
      requestFor("missing_person", "medium", EVIDENCE_PREFERENCE_VALUES.slice(0, 3)),
    );
    const culprit = docs.suspectDocs.find((suspect) =>
      suspect._id.equals(docs.solutionDoc.culpritSuspectId),
    );
    if (!culprit) {
      throw new Error("missing culprit");
    }
    expect(blueprint.publicTimeline.map((event) => event.description).join(" ")).not.toContain(
      culprit.displayName,
    );
    expect(docs.solutionDoc.hintTexts.join(" ")).not.toContain(culprit.displayName);
    expect(
      docs.evidenceDocs.map((evidence) => evidence.title).join(" "),
    ).not.toContain(culprit.displayName);
  });

  it("builds a provider-neutral prompt without case secrets", () => {
    const prompts = buildGenerationPrompts(requestFor("sabotage", "hard", ["image"]));
    expect(prompts.systemPrompt).toContain("fictional detective puzzle");
    expect(prompts.systemPrompt).toContain("JSON Schema:");
    expect(prompts.userPrompt).toContain("<user_scenario>");
    expect(prompts.userPrompt).toContain(SCENARIO);
    expect(prompts.userPrompt).toContain("sabotage");
    expect(prompts.userPrompt).toContain("Image");
    expect(prompts.userPrompt).not.toContain("culpritKey:");
  });
});
