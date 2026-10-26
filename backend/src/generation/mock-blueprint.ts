import type { Category, EvidencePreference } from "@amr/shared";
import {
  caseBlueprintSchema,
  type CaseBlueprint,
} from "./blueprint.js";
import type { GenerationRequest } from "./types.js";

const VENUES = [
  "Ashcroft Hall",
  "Briarwood House",
  "Larkspur Museum",
  "Northgate Gallery",
  "Cinderwick Manor",
] as const;

const CASE_DAY = [3, 7, 11, 14, 18, 21] as const;

interface IncidentProfile {
  artifact: string;
  room: string;
  titleWord: string;
  incident: string;
  discovery: string;
  motive: string;
  method: string;
  resolution?: string;
}

const INCIDENTS: Record<Category, IncidentProfile> = {
  theft: {
    artifact: "the Ashcroft ledger",
    room: "the Archive Room",
    titleWord: "Missing Ledger",
    incident:
      "A signed ledger disappears from a sealed display during a private preview. The public doors were watched; the service route was not.",
    discovery: "The ledger is found missing from its display and the preview is sealed.",
    motive:
      "The ledger was valued at more than the house could repay, and the holder had already been refused an advance against it.",
    method:
      "The ledger was moved through the service corridor in a hard equipment case, then handed off at the loading dock while the camera was in a maintenance loop.",
  },
  missing_person: {
    artifact: "the missing guest",
    room: "the East Parlour",
    titleWord: "Empty Chair",
    incident:
      "A guest vanishes from a private preview. Their coat is still on the chair, but the service route was not searched until the house was sealed.",
    discovery: "The guest is reported missing and the preview is sealed.",
    motive:
      "The guest had discovered a forged provenance record and was about to take it to the registrar.",
    method:
      "The guest was led into the service corridor, kept out of sight until the preview ended, and moved through the maintenance lift while the camera was in a maintenance loop.",
    resolution:
      "The guest was later found unharmed in the service corridor; the concealment was intended to stop the provenance record from reaching the registrar.",
  },
  fraud: {
    artifact: "the provenance ledger",
    room: "the Records Room",
    titleWord: "Altered Ledger",
    incident:
      "A provenance ledger is replaced with a convincing forgery during a private preview. The public doors were watched; the records route was not.",
    discovery: "The forged ledger is found in the Records Room and the preview is sealed.",
    motive:
      "The forged provenance made a worthless piece look authentic, and the substitution was about to be checked by an outside registrar.",
    method:
      "The original ledger was carried through the service corridor in a document case, then handed off at the loading dock while the camera was in a maintenance loop.",
  },
  sabotage: {
    artifact: "the prototype",
    room: "the Workshop",
    titleWord: "Broken Prototype",
    incident:
      "A prototype fails during a private demonstration. The public doors were watched; the service route was not.",
    discovery: "The prototype is found damaged and the preview is sealed.",
    motive:
      "A rival contract depended on the prototype failing in public, and the saboteur had already been passed over for its licence.",
    method:
      "The prototype's service panel was placed under a maintenance load, its safety check was overridden, and the damaged part was carried out through the loading dock while the camera was in a maintenance loop.",
  },
  other: {
    artifact: "the sealed collection box",
    room: "the Map Room",
    titleWord: "Opened Box",
    incident:
      "A sealed collection box is opened during a private preview. The public doors were watched; the service route was not.",
    discovery: "The opened box is found in the Map Room and the preview is sealed.",
    motive:
      "The box held a private letter that could end a inheritance claim, and the holder needed it removed before the registrar arrived.",
    method:
      "The letter was removed from the box and carried through the service corridor in a document case, then handed off at the loading dock while the camera was in a maintenance loop.",
  },
};

interface SuspectTemplate {
  key: string;
  displayName: string;
  role: string;
  credential: string;
  claimLocation: string;
  claimCamera: string;
  claimMessage: string;
  publicStatement: string;
  profile: string;
  motiveNote: string;
  motiveSummary: string;
  opportunity: string;
}

const SUSPECTS: SuspectTemplate[] = [
  {
    key: "celia",
    displayName: "Celia Ward",
    role: "Director of the preview",
    credential: "DIR-01",
    claimLocation: "the East Salon",
    claimCamera: "Camera 4 — East Salon",
    claimMessage: "Toast is winding down in the East Salon. I will be here until the room clears.",
    publicStatement:
      "I was in the East Salon giving the toast when the lights flickered. If something has been taken, it went through the service side. I want this handled quietly until we know what we are dealing with.",
    profile:
      "Celia built the private preview around a single valuable loan. She is composed in public, relentless about the house's debts, and knows every room on the service route.",
    motiveNote:
      "The house's renovation debt is overdue. A revised valuation was approved for the preview object, but no repayment plan is attached.",
    motiveSummary:
      "The preview object's insured value would cover the house's renovation debt. The internal valuation file shows Celia wanted that value increased before the event.",
    opportunity:
      "She holds the director's master credential and knows every service route, but the front-desk and gallery records place her at the toast.",
  },
  {
    key: "marcus",
    displayName: "Marcus Pell",
    role: "Visiting collector",
    credential: "VIS-02",
    claimLocation: "the main hall",
    claimCamera: "Camera 4 — main hall",
    claimMessage: "Still by the main-hall display. The light here is better for the catalogue photographs.",
    publicStatement:
      "I came to look, not to interfere. I was in the main hall all evening, near the fountain. Ask anyone who saw me with the catalogue.",
    profile:
      "Marcus collects rare pieces and dislikes being told a work is not for sale. He arrived early, photographed the catalogue, and spent most of the evening in the public rooms.",
    motiveNote:
      "Marcus made a private offer for the preview object twice. Both offers were declined in writing, the second one a week before the preview.",
    motiveSummary:
      "He has pursued the preview object for years and was refused again last week. His signed offer letters are in the file.",
    opportunity:
      "His temporary preview credential was configured for all public rooms, and the access register shows it was not used on the service side.",
  },
  {
    key: "priya",
    displayName: "Priya Raman",
    role: "Head of security",
    credential: "SEC-03",
    claimLocation: "the front desk",
    claimCamera: "Camera 6 — front desk",
    claimMessage: "Front desk is quiet. The service panel is logging again; I am watching it from here.",
    publicStatement:
      "At 19:46 the service camera entered a maintenance loop. I assumed it was the old wiring until I saw the override source. I sealed the public doors immediately and started the incident log.",
    profile:
      "Priya runs the preview's small security team with military precision. She wrote the camera-fault note herself and has been unusually defensive about the service panel.",
    motiveNote:
      "Priya's earlier camera-fault note was never escalated. A public incident on her watch would end her contract.",
    motiveSummary:
      "Her report admits an earlier camera fault she failed to escalate. A public incident on her watch would end her contract.",
    opportunity:
      "She controls the maintenance console remotely and can request a camera loop from the front desk, but the desk camera places her there throughout the theft window.",
  },
  {
    key: "theo",
    displayName: "Theo Finch",
    role: "Building technician",
    credential: "TEC-04",
    claimLocation: "the east wing",
    claimCamera: "Camera 7 — east wing",
    claimMessage: "East-wing breaker is still fussy. I am not on the public floor.",
    publicStatement:
      "I was in the east wing from 19:40 until a little after 20:00. The dimmers there are always failing. I never went near the service corridor, and I do not know why my credential is in that log.",
    profile:
      "Theo maintains the lighting, cases, and service equipment. He is certified on the service locks, the maintenance lift, and the camera console, and he asked for another equipment advance the day before the preview.",
    motiveNote:
      "Theo carries an unpaid equipment advance and asked for more on the day before the preview. The request was declined.",
    motiveSummary:
      "He carries an unpaid equipment advance and asked for more the day before the preview. The loading-dock transcript refers to payment once the piece is authenticated.",
    opportunity:
      "He is certified on the service locks, the lift, and the maintenance console. The east-wing camera records whether he stayed at the claimed dimmer panel.",
  },
];

export function buildMockBlueprint(request: GenerationRequest): CaseBlueprint {
  const hash = hashString(
    `${request.scenario}\u0000${request.category}\u0000${request.difficulty}`,
  );
  const venue = VENUES[hash % VENUES.length] ?? VENUES[0];
  const incident = INCIDENTS[request.category];
  const culpritIndex = hash % SUSPECTS.length;
  const culprit = required(SUSPECTS[culpritIndex], "mock culprit");
  const innocentSuspects = SUSPECTS.filter((suspect) => suspect.key !== culprit.key);
  const day = CASE_DAY[hash % CASE_DAY.length] ?? CASE_DAY[0];
  const base = Date.UTC(2027, 4, day, 19, 0, 0);
  const at = (minutes: number) => new Date(base + minutes * 60_000).toISOString();
  const dateLabel = new Date(base).toISOString().slice(0, 10);

  const evidence: unknown[] = [
    buildChatEvidence(request.evidencePreferences, culprit, innocentSuspects, at),
    buildAccessEvidence(culprit, at),
    buildCctvEvidence(culprit, innocentSuspects, at),
    buildWitnessEvidence(culprit, innocentSuspects, venue, at),
    buildRosterEvidence(culprit, at),
    buildImageEvidence(culprit, venue, at),
  ];

  if (request.evidencePreferences.includes("cctv_transcript")) {
    evidence.push(buildDockTranscriptEvidence(culprit, at));
  }
  if (request.evidencePreferences.includes("suspect_statement")) {
    evidence.push(
      buildInnocentStatementEvidence(
        innocentSuspects[0] ?? culprit,
        innocentSuspects[1] ?? innocentSuspects[0] ?? culprit,
        at,
      ),
    );
  }

  const motive = `${culprit.displayName} had a documented reason to act: ${incident.motive}`;
  const method = `${culprit.displayName} used preview credential ${culprit.credential} to place the service panel under a maintenance load at 19:44, request the Camera 3 loop at 19:46, unlock the corridor at 19:48, and call the lift at 19:52. ${incident.method}`;
  const resolution = incident.resolution ? ` ${incident.resolution}` : "";
  const explanation =
    `The incident turns on the service-level record, not on motive. Every service action in the relevant window used credential ${culprit.credential}: the panel load at 19:44, the camera override at 19:46, the corridor unlock at 19:48, the lift call at 19:52, and the loading-dock opening at 20:09. The preview register identifies ${culprit.credential} as ${culprit.displayName}'s credential. ` +
    `${culprit.displayName} claimed to be at ${culprit.claimLocation}, but the camera covering that location recorded no movement during the theft window, and the staff chat repeats the same claim at 19:57. The witness saw a person in a dark service coat with a hard case at the corridor door, and the service log shows the same credential at the lift and the loading dock. ` +
    `The other suspects have visible alibis or credentials that do not appear in the service log during the critical window.${resolution}`;

  const blueprint = {
    title: `The ${incident.titleWord} at ${venue}`,
    summary: `${request.scenario.slice(0, 900)}${
      request.scenario.length > 900 ? "…" : ""
    } ${venue} has one valuable preview, four people with access, and a service record that does not agree with the staff chat.`,
    category: request.category,
    difficulty: request.difficulty,
    timezone: "UTC",
    incident: {
      location: `${venue} — ${incident.room}`,
      occurredAt: at(64),
      description: `${incident.incident} The preview object is ${incident.artifact}.`,
    },
    caseRules: [
      "Every person, message, image, and record in this file is fictional.",
      `Times use UTC on ${dateLabel}.`,
      "Credential identifiers can be cross-referenced between exhibits.",
      "The image exhibit is an approved static fictional diagram, not a generated photograph.",
      "You may review every exhibit before making one final accusation.",
    ],
    suspects: SUSPECTS.map((suspect) => ({
      key: suspect.key,
      displayName: suspect.displayName,
      role: suspect.role,
      profile: `${suspect.profile} The preview is at ${venue}.`,
      motiveSummary: suspect.motiveSummary,
      opportunitySummary: suspect.opportunity,
      publicStatement: suspect.publicStatement,
      relationships: SUSPECTS.filter((other) => other.key !== suspect.key).map(
        (other) => ({
          suspectKey: other.key,
          relationship: relationshipFor(suspect, other),
        }),
      ),
    })),
    publicTimeline: [
      {
        eventId: "evt-setup",
        at: at(0),
        location: incident.room,
        description: `The preview object is secured in ${incident.room} and logged by the registrar.`,
      },
      {
        eventId: "evt-gather",
        at: at(32),
        location: "East Salon",
        description: "Guests gather for the director's toast.",
      },
      {
        eventId: "evt-panel",
        at: at(44),
        location: "Service panel G4",
        description: "The service circuit accepts a maintenance load from a preview credential.",
      },
      {
        eventId: "evt-loop",
        at: at(46),
        location: "Service corridor",
        description: "Camera 3 enters a ninety-four-second maintenance loop.",
      },
      {
        eventId: "evt-door",
        at: at(48),
        location: "Service corridor S2",
        description: "The service corridor door unlocks with a preview credential.",
      },
      {
        eventId: "evt-move",
        at: at(51),
        location: "Service corridor",
        description:
          "A figure in a dark service coat enters the corridor carrying a hard equipment case.",
      },
      {
        eventId: "evt-chat",
        at: at(57),
        location: "Event staff chat",
        description: "A staff message reports ongoing work on the east-side circuits.",
      },
      {
        eventId: "evt-exit",
        at: at(58),
        location: "Service corridor",
        description: "The figure leaves toward the maintenance lift; the case appears heavier.",
      },
      {
        eventId: "evt-found",
        at: at(64),
        location: incident.room,
        description: incident.discovery,
      },
      {
        eventId: "evt-depart",
        at: at(69),
        location: "Loading dock L1",
        description: "A service door opens at the loading dock and the case is loaded into a waiting van.",
      },
      {
        eventId: "evt-report",
        at: at(72),
        location: "Security office",
        description: "Security files a report on the camera override.",
      },
    ],
    canonicalTimeline: [
      {
        eventId: "evt-setup",
        at: at(0),
        location: incident.room,
        description: `The preview object is secured while Celia Ward and Priya Raman watch.`,
        involvedSuspectKeys: ["celia", "priya"],
      },
      {
        eventId: "evt-gather",
        at: at(32),
        location: "East Salon",
        description:
          "Celia begins the toast. Marcus stays near the main-hall display, Priya is at the front desk, and Theo is in the east wing.",
        involvedSuspectKeys: ["celia", "marcus", "priya", "theo"],
      },
      {
        eventId: "evt-panel",
        at: at(44),
        location: "Service panel G4",
        description: `${culprit.displayName} uses credential ${culprit.credential} to place the service circuit under a maintenance load.`,
        involvedSuspectKeys: [culprit.key],
      },
      {
        eventId: "evt-loop",
        at: at(46),
        location: "Service corridor",
        description: `${culprit.displayName} requests the ninety-four-second Camera 3 loop from the maintenance console.`,
        involvedSuspectKeys: [culprit.key],
      },
      {
        eventId: "evt-door",
        at: at(48),
        location: "Service corridor S2",
        description: `${culprit.displayName} unlocks the service corridor with ${culprit.credential}.`,
        involvedSuspectKeys: [culprit.key],
      },
      {
        eventId: "evt-move",
        at: at(51),
        location: "Service corridor",
        description: `${culprit.displayName} enters wearing a dark service coat and carrying a hard case.`,
        involvedSuspectKeys: [culprit.key],
      },
      {
        eventId: "evt-chat",
        at: at(57),
        location: "Event staff chat",
        description: `${culprit.displayName} sends a message claiming to be at ${culprit.claimLocation}.`,
        involvedSuspectKeys: [culprit.key],
      },
      {
        eventId: "evt-exit",
        at: at(58),
        location: "Service corridor",
        description: `${culprit.displayName} leaves toward the lift; the case is heavier than when it arrived.`,
        involvedSuspectKeys: [culprit.key],
      },
      {
        eventId: "evt-found",
        at: at(64),
        location: incident.room,
        description: "The preview object is discovered missing and the preview is sealed.",
        involvedSuspectKeys: ["celia", "priya"],
      },
      {
        eventId: "evt-depart",
        at: at(69),
        location: "Loading dock L1",
        description: `${culprit.displayName} opens the loading dock with ${culprit.credential} and loads the case into a waiting van.`,
        involvedSuspectKeys: [culprit.key],
      },
      {
        eventId: "evt-report",
        at: at(72),
        location: "Security office",
        description: "Priya files the camera override report while Celia asks her to delay the police call.",
        involvedSuspectKeys: ["celia", "priya"],
      },
    ],
    evidence,
    culpritKey: culprit.key,
    motive,
    method,
    explanation,
    supportingEvidenceKeys: ["access", "cctv", "witness", "roster"],
    hintTexts: [
      "Start with time, not motive. Compare the service-level events between 19:44 and 19:52 with the staff chat. The building record and the claimed location do not agree.",
      "One preview credential appears on every service action: the panel, the camera console, the corridor door, the lift, and the loading dock. The evening roster shows who signed for that credential.",
      "The camera covering the claimed location records no movement during the theft window. Seven minutes after the preview object is found missing, the same credential opens the loading dock.",
    ],
    contentSafetyFlags: [
      "fictional_names",
      "simulated_messages",
      "simulated_media",
      "static_media_fallback",
    ],
  };

  return caseBlueprintSchema.parse(blueprint);
}

function buildChatEvidence(
  _preferences: EvidencePreference[],
  culprit: SuspectTemplate,
  innocentSuspects: SuspectTemplate[],
  at: (minutes: number) => string,
) {
  const innocent = innocentSuspects[0];
  return {
    key: "chat",
    type: "chat_transcript" as const,
    title: "Event staff group chat, 19:12–20:05",
    publicDescription:
      "A simulated group chat recovered from the event staff channel. The messages place several people around the venue and repeat a claim about work on the east-side circuits.",
    occurredAt: at(12),
    sourceLabel: "Simulated messaging interface — event staff channel",
    reliability: "medium" as const,
    relatedSuspectKeys: ["celia", "marcus", "priya", "theo"],
    relatedTimelineEventIds: ["evt-gather", "evt-move", "evt-chat", "evt-found"],
    content: {
      format: "chat" as const,
      channel: "Preview — Event Staff",
      participants: [
        "Celia Ward",
        "Marcus Pell",
        "Priya Raman",
        "Theo Finch",
        "Nadia Okafor",
      ],
      messages: [
        {
          at: "19:12",
          sender: "Priya Raman",
          text: "Preview rooms are sealed. Public route only until the toast ends.",
        },
        {
          at: "19:24",
          sender: culprit.displayName,
          text: culprit.claimMessage,
        },
        {
          at: "19:32",
          sender: "Celia Ward",
          text: "Toast in five. Phones on silent, please.",
        },
        {
          at: "19:49",
          sender: "Nadia Okafor",
          text: "Service corridor light is out again. I am using the kitchen route.",
        },
        ...(innocent
          ? [
              {
                at: "19:51",
                sender: innocent.displayName,
                text: `Still at ${innocent.claimLocation}. Nothing moving here.`,
              },
            ]
          : []),
        {
          at: "19:57",
          sender: culprit.displayName,
          text: culprit.claimMessage,
        },
        {
          at: "20:03",
          sender: "Priya Raman",
          text: "Preview room door is open. No one touches the display.",
        },
        {
          at: "20:05",
          sender: "Celia Ward",
          text: "Call the police. And keep everyone in the public rooms.",
        },
      ],
    },
  };
}

function buildAccessEvidence(culprit: SuspectTemplate, at: (minutes: number) => string) {
  return {
    key: "access",
    type: "access_log" as const,
    title: `Service-level credential events, 19:44–20:10`,
    publicDescription:
      "A simulated export from the venue access-control system. It records every service-level unlock, maintenance load, lift call, and loading-dock opening on the evening of the preview.",
    occurredAt: at(44),
    sourceLabel: "Venue access-control system — simulated export",
    reliability: "high" as const,
    relatedSuspectKeys: ["celia", "marcus", "priya", "theo"],
    relatedTimelineEventIds: [
      "evt-panel",
      "evt-loop",
      "evt-door",
      "evt-exit",
      "evt-depart",
    ],
    content: {
      format: "log" as const,
      entries: [
        {
          at: "19:44",
          actor: culprit.credential,
          action: "Maintenance load accepted",
          location: "Service panel G4",
          note: "Service circuit toggled",
        },
        {
          at: "19:46",
          actor: culprit.credential,
          action: "Camera override requested",
          location: "Maintenance console",
          note: "Camera 3 loop, 94 seconds",
        },
        {
          at: "19:48",
          actor: culprit.credential,
          action: "Door unlocked",
          location: "Service corridor S2",
        },
        {
          at: "19:52",
          actor: culprit.credential,
          action: "Lift called to service floor",
          location: "Maintenance lift",
        },
        {
          at: "20:09",
          actor: culprit.credential,
          action: "Loading dock opened",
          location: "Loading dock L1",
        },
        {
          at: "20:10",
          actor: "External keypad",
          action: "Loading dock closed",
          location: "Loading dock L1",
        },
      ],
    },
  };
}

function buildCctvEvidence(
  culprit: SuspectTemplate,
  innocentSuspects: SuspectTemplate[],
  at: (minutes: number) => string,
) {
  const entries = [
    {
      at: "19:44–20:02",
      action: "No movement recorded",
      location: culprit.claimCamera,
      note: `Claimed location: ${culprit.claimLocation}`,
    },
    ...innocentSuspects.map((suspect) => ({
      at: "19:51",
      actor: suspect.displayName,
      action: "Visible at the claimed location",
      location: suspect.claimCamera,
      note: suspect.claimLocation,
    })),
    {
      at: "19:46",
      actor: "Maintenance console",
      action: "Maintenance loop started",
      location: "Camera 3 — service corridor",
      note: "94-second recording repeated",
    },
    {
      at: "19:51",
      actor: "Figure in dark service coat",
      action: "Entered service corridor with equipment case",
      location: "Camera 3 — service corridor",
      note: "Face obscured; no name visible",
    },
    {
      at: "19:58",
      actor: "Figure in dark service coat",
      action: "Exited toward maintenance lift; case appears heavier",
      location: "Camera 3 — service corridor",
    },
    ...innocentSuspects.map((suspect) => ({
      at: "20:00",
      actor: suspect.displayName,
      action: "Still visible at the claimed location",
      location: suspect.claimCamera,
    })),
    {
      at: "20:09",
      actor: "Figure in dark service coat",
      action: "Loaded case into van with covered plate",
      location: "Camera 2 — loading dock",
    },
  ];

  return {
    key: "cctv",
    type: "cctv_log" as const,
    title: "Camera status and corridor log, 19:44–20:09",
    publicDescription:
      "A simulated CCTV operations log. Camera 3 covers the service corridor; the other cameras cover the public rooms and staff positions. The log records a maintenance loop and the movement of a figure carrying an equipment case.",
    occurredAt: at(46),
    sourceLabel: "Venue CCTV operations — simulated log",
    reliability: "high" as const,
    relatedSuspectKeys: ["celia", "marcus", "priya", "theo"],
    relatedTimelineEventIds: ["evt-loop", "evt-move", "evt-exit", "evt-depart"],
    content: {
      format: "log" as const,
      entries,
    },
  };
}

function buildWitnessEvidence(
  culprit: SuspectTemplate,
  innocentSuspects: SuspectTemplate[],
  venue: string,
  at: (minutes: number) => string,
) {
  const corroborated = innocentSuspects[0] ?? culprit;
  return {
    key: "witness",
    type: "witness_statement" as const,
    title: "Caterer statement — service corridor sighting",
    publicDescription:
      "A signed statement from the evening's caterer, recorded by security after the preview was sealed. It describes a person in a service coat at the corridor door and a van at the loading dock.",
    occurredAt: at(80),
    sourceLabel: "Incident file — simulated witness statement",
    reliability: "medium" as const,
    relatedSuspectKeys: [culprit.key, corroborated.key],
    relatedTimelineEventIds: ["evt-door", "evt-move", "evt-exit", "evt-depart"],
    content: {
      format: "statement" as const,
      speaker: "Nadia Okafor, caterer",
      recordedAt: "20:20",
      context: `Recorded by security in the service kitchen at ${venue}.`,
      statement: `At about 19:50 I came through the kitchen door and saw a person in a dark service coat at the corridor door. They were carrying a hard black case and kept their face turned. I recognised the credential clip from the preview badges, but not the person. At 19:58 I heard the maintenance lift. When I left at 20:05, a dark van was at the loading dock with its engine running. I also saw ${corroborated.displayName} near ${corroborated.claimLocation} around 19:51; they were not near the service door.`,
    },
  };
}

function buildRosterEvidence(
  culprit: SuspectTemplate,
  at: (minutes: number) => string,
) {
  return {
    key: "roster",
    type: "document" as const,
    title: "Preview roster and credential register",
    publicDescription:
      "Simulated operations paperwork for the private preview. It lists the four preview credentials, staff assignments, and the notes attached to each holder.",
    occurredAt: at(10),
    sourceLabel: "Venue operations — simulated register",
    reliability: "high" as const,
    relatedSuspectKeys: ["celia", "marcus", "priya", "theo"],
    relatedTimelineEventIds: ["evt-setup", "evt-panel", "evt-door"],
    content: {
      format: "document" as const,
      heading: "Private preview — evening roster",
      sections: [
        {
          heading: "Preview credentials",
          body: [
            "DIR-01 — Celia Ward — director — all areas.",
            "VIS-02 — Marcus Pell — visiting collector — public rooms, with a temporary service endorsement for the preview.",
            "SEC-03 — Priya Raman — head of security — public rooms, front desk, maintenance console.",
            "TEC-04 — Theo Finch — building technician — service corridor, lift, maintenance console.",
            "The service panel accepts any preview credential. The log records the credential, not the person.",
          ],
        },
        {
          heading: "Assignments",
          body: [
            "Celia Ward — East Salon toast, 19:32–19:56.",
            "Marcus Pell — main-hall display, 19:30–20:05.",
            "Priya Raman — front desk, 19:30–20:00.",
            "Theo Finch — east-wing dimmer reset, 19:40–20:05.",
          ],
        },
        {
          heading: "Supervisor notes",
          body: SUSPECTS.map((suspect) => `${suspect.displayName}: ${suspect.motiveNote}`),
        },
      ],
      annotations: [
        "This register is a simulated document created for the puzzle.",
        "The credential used in the access log belongs to exactly one holder on this roster.",
        `${culprit.credential} is listed above; the access log records that credential on every service action in the critical window.`,
      ],
    },
  };
}

function buildImageEvidence(
  culprit: SuspectTemplate,
  venue: string,
  at: (minutes: number) => string,
) {
  return {
    key: "sightline",
    type: "image" as const,
    title: "Service route and sightline diagram",
    publicDescription:
      "An approved static fictional diagram of the public rooms, the service corridor, the maintenance lift, and the loading dock. It is a diagram, not a photograph.",
    occurredAt: at(0),
    sourceLabel: "Approved static fictional diagram — not generated for this case",
    reliability: "high" as const,
    relatedSuspectKeys: [culprit.key, "priya"],
    relatedTimelineEventIds: ["evt-loop", "evt-door", "evt-move", "evt-depart"],
    content: {
      format: "image" as const,
      caption: `${venue} service route — approved static fictional asset.`,
      interpretation:
        "Camera 3 is the only camera covering the service corridor. During its maintenance loop, the route from the preview room to the lift and loading dock is unobserved. The diagram does not show who used the route.",
      altText:
        "Approved static fictional floor-plan diagram. It shows the preview room, a service corridor covered by Camera 3, a maintenance lift, and a loading dock. A dashed blind-spot path runs from the room to the dock. It is not a generated photograph.",
    },
  };
}

function buildDockTranscriptEvidence(
  culprit: SuspectTemplate,
  at: (minutes: number) => string,
) {
  return {
    key: "dock",
    type: "cctv_transcript" as const,
    title: "Loading dock audio transcript, 20:08–20:10",
    publicDescription:
      "A simulated transcript from the loading-dock microphone. Two unidentified voices discuss the weight of a case and payment after authentication.",
    occurredAt: at(68),
    sourceLabel: "Loading dock microphone 2 — simulated transcript",
    reliability: "medium" as const,
    relatedSuspectKeys: [culprit.key],
    relatedTimelineEventIds: ["evt-depart"],
    content: {
      format: "transcript" as const,
      source: "Loading dock microphone 2",
      lines: [
        { at: "20:08", speaker: "Ambient", text: "Rolling wheels and a van door opening." },
        {
          at: "20:08",
          speaker: "Voice A (unidentified)",
          text: "Careful. It's heavier than the listing said.",
        },
        {
          at: "20:08",
          speaker: "Voice B (unidentified)",
          text: "Keep it in the case until the buyer authenticates it.",
        },
        {
          at: "20:09",
          speaker: "Voice A (unidentified)",
          text: "And the rest of the payment?",
        },
        {
          at: "20:09",
          speaker: "Voice B (unidentified)",
          text: "After authentication. The service entrance is clear.",
        },
        { at: "20:09", speaker: "Ambient", text: "A metal door closes." },
      ],
    },
  };
}

function buildInnocentStatementEvidence(
  speaker: SuspectTemplate,
  corroborated: SuspectTemplate,
  at: (minutes: number) => string,
) {
  return {
    key: "statement",
    type: "suspect_statement" as const,
    title: "Recorded statement — public-room alibi",
    publicDescription:
      "A simulated statement recorded after the preview was sealed. It describes the speaker's position and another guest's position during the theft window.",
    occurredAt: at(90),
    sourceLabel: "Incident file — simulated suspect statement",
    reliability: "medium" as const,
    relatedSuspectKeys: [speaker.key, corroborated.key],
    relatedTimelineEventIds: ["evt-gather", "evt-move", "evt-chat"],
    content: {
      format: "statement" as const,
      speaker: speaker.displayName,
      recordedAt: "20:30",
      context: "Recorded by security after the public rooms were sealed.",
      statement: `I stayed at ${speaker.claimLocation} through the toast. I saw ${corroborated.displayName} near ${corroborated.claimLocation} when the service corridor light flickered. I did not see anyone leave the public rooms, but the service door is not visible from where I was standing.`,
    },
  };
}

function relationshipFor(left: SuspectTemplate, right: SuspectTemplate): string {
  const role = right.role.toLowerCase();
  if (left.key === "celia") {
    return `Works with the ${role} on the preview arrangements.`;
  }
  if (left.key === "marcus") {
    return `Has questioned the ${role} about the preview object's ownership.`;
  }
  if (left.key === "priya") {
    return `Coordinates preview security with the ${role}.`;
  }
  return `Maintains the service equipment used by the ${role}.`;
}

function hashString(value: string): number {
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
}

function required<T>(value: T | undefined, label: string): T {
  if (value === undefined) {
    throw new Error(`Mock generation is missing ${label}.`);
  }
  return value;
}
