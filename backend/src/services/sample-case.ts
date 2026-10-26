import { Types } from "mongoose";
import {
  SAMPLE_CASE_KEY,
  SAMPLE_FICTION_NOTICE,
  type Category,
  type Difficulty,
  type EvidenceContent,
  type EvidenceType,
  type PublicTimelineEvent,
  type Reliability,
  type MediaStatus,
} from "@amr/shared";
import type { CaseDocument } from "../models/Case.js";
import type { SuspectDocument } from "../models/Suspect.js";
import type { EvidenceDocument } from "../models/Evidence.js";
import type { CanonicalTimelineEvent, SolutionDocument } from "../models/Solution.js";

interface SampleSuspectDefinition {
  key: string;
  displayName: string;
  role: string;
  profile: string;
  motiveSummary: string;
  opportunitySummary: string;
  publicStatement: string;
  relationships: Array<{ suspectKey: string; relationship: string }>;
}

interface SampleEvidenceDefinition {
  key: string;
  exhibitNumber: number;
  type: EvidenceType;
  title: string;
  publicDescription: string;
  content: EvidenceContent;
  occurredAt?: string;
  sourceLabel: string;
  reliability: Reliability;
  relatedSuspectKeys: string[];
  relatedTimelineEventIds: string[];
  mediaStatus: MediaStatus;
  mediaUrl?: string;
  altText?: string;
}

interface CanonicalTimelineDefinition {
  eventId: string;
  at: string;
  location: string;
  description: string;
  involvedSuspectKeys: string[];
}

export interface SampleCaseDefinition {
  key: string;
  title: string;
  scenario: string;
  summary: string;
  category: Category;
  difficulty: Difficulty;
  incident: {
    location: string;
    occurredAt: string;
    description: string;
  };
  timezone: string;
  caseRules: string[];
  fictionNotice: string;
  suspects: SampleSuspectDefinition[];
  timeline: PublicTimelineEvent[];
  canonicalTimeline: CanonicalTimelineDefinition[];
  evidence: SampleEvidenceDefinition[];
  culpritKey: string;
  motive: string;
  method: string;
  explanation: string;
  supportingEvidenceKeys: string[];
  hintTexts: string[];
  contentSafetyFlags: string[];
}

export const SAMPLE_CASE_DEFINITION: SampleCaseDefinition = {
  key: SAMPLE_CASE_KEY,
  title: "The Meridian at Midnight",
  scenario:
    "A jeweled astronomical sphere vanishes from a sealed gallery during a private museum preview. The public doors were watched, but the service corridors were not.",
  summary:
    "Halcyon House has opened its doors for one private preview of the Meridian Sphere, a jeweled astronomical instrument on loan from a private collection. At 22:04 the display case is found open and the sphere is gone. Four people remain inside the locked house. One of them knows the service corridors well enough to make the room forget it was watched.",
  category: "theft",
  difficulty: "medium",
  incident: {
    location: "Halcyon House — Gallery 4",
    occurredAt: "2026-10-17T21:47:00-04:00",
    description:
      "The Meridian Sphere disappeared from a sealed display case between 21:44 and 22:04. The public gallery doors stayed locked; the service corridor did not.",
  },
  timezone: "America/New_York",
  caseRules: [
    "Every person, message, image, and record in this file is fictional.",
    "Times use Halcyon House local time (EDT) on Saturday, 17 October 2026.",
    "Credential and equipment identifiers can be cross-referenced between exhibits.",
    "You may review every exhibit before making one final accusation.",
  ],
  fictionNotice: SAMPLE_FICTION_NOTICE,
  suspects: [
    {
      key: "ada",
      displayName: "Ada Mercer",
      role: "Director, Halcyon House",
      profile:
        "Ada has spent three years turning a fading family house into a working museum. She is composed in public and relentless in private, and the preview was meant to secure the loan's future.",
      motiveSummary:
        "The Meridian's insured value would cover the house's renovation debt. An internal valuation memo shows Ada wanted that value increased.",
      opportunitySummary:
        "She knows every room in the house, but multiple witnesses place her in the East Salon giving the toast from 21:32 to 21:56.",
      publicStatement:
        "I was raising a glass when the lights flickered. If someone took the Meridian, they knew the service route better than any guest. I want this handled quietly until we know what we are dealing with.",
      relationships: [
        {
          suspectKey: "felix",
          relationship: "Rejected his private purchase offer three times.",
        },
        {
          suspectKey: "iona",
          relationship: "Pressed her to delay calling the police.",
        },
        {
          suspectKey: "jonah",
          relationship: "Approved his evening maintenance shift.",
        },
      ],
    },
    {
      key: "felix",
      displayName: "Felix Dorn",
      role: "Private collector",
      profile:
        "Felix collects rare instruments and dislikes being told a piece is not for sale. He arrived early, photographed the catalogue, and spent most of the evening near the main-hall fountain.",
      motiveSummary:
        "He has pursued the Meridian for years and was refused again last month. His offer letter is in the file.",
      opportunitySummary:
        "Camera 4 places him in the main hall at 21:51 and again at 22:00, on the opposite side of the sealed gallery.",
      publicStatement:
        "I came to look, not to steal. The piece belongs in a proper collection, but I was in the main hall all evening. Ask anyone who saw me by the fountain.",
      relationships: [
        {
          suspectKey: "ada",
          relationship: "Offered to buy the Meridian privately.",
        },
        {
          suspectKey: "iona",
          relationship: "Complained about the museum's search policy.",
        },
        {
          suspectKey: "jonah",
          relationship: "Asked him how the display case was secured.",
        },
      ],
    },
    {
      key: "iona",
      displayName: "Iona Vale",
      role: "Head of security",
      profile:
        "Iona runs the house's small security team with military precision. She wrote the camera-fault report herself, and she has been unusually defensive about the ninety-four-second gap in Camera 3.",
      motiveSummary:
        "Her report admits an earlier camera fault she failed to escalate. A theft on her watch would end her contract.",
      opportunitySummary:
        "She was at the front desk from 21:30 to 22:00, but she had access to the maintenance console and could have entered the override remotely.",
      publicStatement:
        "At 21:46 the service camera entered a maintenance loop. I assumed it was the old wiring until I saw the override source. I sealed the public doors immediately and started the incident log.",
      relationships: [
        {
          suspectKey: "ada",
          relationship: "Advised her to call the police immediately.",
        },
        {
          suspectKey: "felix",
          relationship: "Denied his request to inspect the display case.",
        },
        {
          suspectKey: "jonah",
          relationship: "Suspected him of bypassing a corridor sensor last month.",
        },
      ],
    },
    {
      key: "jonah",
      displayName: "Jonah Reed",
      role: "Exhibit technician",
      profile:
        "Jonah maintains the lighting, cases, and service equipment. He is certified on the Gallery 4 locks and the maintenance lift, and he asked the museum for another equipment advance the day before the preview.",
      motiveSummary:
        "He carries an unpaid equipment advance and asked for more on 16 October. The loading-dock transcript refers to payment once the piece is authenticated.",
      opportunitySummary:
        "EXH-04, his equipment credential, was signed out at 21:10. He claims he spent 21:40 to 22:00 resetting the east-wing dimmers.",
      publicStatement:
        "I was in the east wing from 21:40 until a little after 22:00. The dimmers there are always failing. I never went near Gallery 4, and I don't know why my credential is in that log.",
      relationships: [
        {
          suspectKey: "ada",
          relationship: "Approved his overtime for the preview.",
        },
        {
          suspectKey: "felix",
          relationship: "Showed him the Meridian's case mechanism.",
        },
        {
          suspectKey: "iona",
          relationship: "Was questioned by her after a sensor bypass last month.",
        },
      ],
    },
  ],
  timeline: [
    {
      eventId: "evt-2115",
      at: "2026-10-17T21:15:00-04:00",
      location: "Gallery 4",
      description: "The Meridian Sphere is sealed in its display case and logged by the registrar.",
    },
    {
      eventId: "evt-2132",
      at: "2026-10-17T21:32:00-04:00",
      location: "East Salon",
      description: "Guests gather for the director's toast.",
    },
    {
      eventId: "evt-2144",
      at: "2026-10-17T21:44:00-04:00",
      location: "Service panel G4",
      description: "The gallery circuit accepts a maintenance load.",
    },
    {
      eventId: "evt-2146",
      at: "2026-10-17T21:46:00-04:00",
      location: "Service corridor",
      description: "Camera 3 enters a ninety-four-second maintenance loop.",
    },
    {
      eventId: "evt-2148",
      at: "2026-10-17T21:48:00-04:00",
      location: "Service corridor S2",
      description: "The service corridor door unlocks with a technician credential.",
    },
    {
      eventId: "evt-2151",
      at: "2026-10-17T21:51:00-04:00",
      location: "Gallery 4 / service corridor",
      description: "A figure in coveralls enters the service corridor carrying an equipment case.",
    },
    {
      eventId: "evt-2157",
      at: "2026-10-17T21:57:00-04:00",
      location: "Event staff chat",
      description: "A staff message reports ongoing east-wing dimmer work.",
    },
    {
      eventId: "evt-2158",
      at: "2026-10-17T21:58:00-04:00",
      location: "Service corridor",
      description: "The figure leaves toward the maintenance lift with a visibly heavier case.",
    },
    {
      eventId: "evt-2204",
      at: "2026-10-17T22:04:00-04:00",
      location: "Gallery 4",
      description: "The display case is found open and the sphere is missing.",
    },
    {
      eventId: "evt-2209",
      at: "2026-10-17T22:09:00-04:00",
      location: "Loading dock L1",
      description: "The loading dock door opens and a case is loaded into a waiting van.",
    },
    {
      eventId: "evt-2212",
      at: "2026-10-17T22:12:00-04:00",
      location: "Security office",
      description: "Security files a report on the Camera 3 maintenance override.",
    },
  ],
  canonicalTimeline: [
    {
      eventId: "evt-2115",
      at: "2026-10-17T21:15:00-04:00",
      location: "Gallery 4",
      description: "The Meridian is sealed in its case by the registrar while Ada and Iona watch.",
      involvedSuspectKeys: ["ada", "iona"],
    },
    {
      eventId: "evt-2132",
      at: "2026-10-17T21:32:00-04:00",
      location: "East Salon",
      description: "Ada begins the toast. Felix stays in the main hall near the fountain.",
      involvedSuspectKeys: ["ada", "felix"],
    },
    {
      eventId: "evt-2144",
      at: "2026-10-17T21:44:00-04:00",
      location: "Service panel G4",
      description: "Jonah uses credential EXH-04 to place the gallery circuit under maintenance load.",
      involvedSuspectKeys: ["jonah"],
    },
    {
      eventId: "evt-2146",
      at: "2026-10-17T21:46:00-04:00",
      location: "Service corridor",
      description: "Jonah enters a 94-second Camera 3 loop from the maintenance console.",
      involvedSuspectKeys: ["jonah"],
    },
    {
      eventId: "evt-2148",
      at: "2026-10-17T21:48:00-04:00",
      location: "Service corridor S2",
      description: "Jonah unlocks the service corridor door with EXH-04.",
      involvedSuspectKeys: ["jonah"],
    },
    {
      eventId: "evt-2151",
      at: "2026-10-17T21:51:00-04:00",
      location: "Gallery 4 / service corridor",
      description: "Jonah enters wearing coveralls, carrying a hard equipment case with a false bottom.",
      involvedSuspectKeys: ["jonah"],
    },
    {
      eventId: "evt-2157",
      at: "2026-10-17T21:57:00-04:00",
      location: "Event staff chat",
      description: "Jonah sends a message claiming he is still working in the east wing.",
      involvedSuspectKeys: ["jonah"],
    },
    {
      eventId: "evt-2158",
      at: "2026-10-17T21:58:00-04:00",
      location: "Service corridor",
      description: "Jonah leaves toward the maintenance lift; the case now carries the sphere.",
      involvedSuspectKeys: ["jonah"],
    },
    {
      eventId: "evt-2204",
      at: "2026-10-17T22:04:00-04:00",
      location: "Gallery 4",
      description: "Iona finds the display case open and alerts Ada.",
      involvedSuspectKeys: ["ada", "iona"],
    },
    {
      eventId: "evt-2209",
      at: "2026-10-17T22:09:00-04:00",
      location: "Loading dock L1",
      description: "Jonah opens the loading dock with EXH-04 and loads the case into a waiting van.",
      involvedSuspectKeys: ["jonah"],
    },
    {
      eventId: "evt-2212",
      at: "2026-10-17T22:12:00-04:00",
      location: "Security office",
      description: "Iona files the camera override report; Ada asks her to delay the police call.",
      involvedSuspectKeys: ["ada", "iona"],
    },
  ],
  evidence: [
    {
      key: "chat",
      exhibitNumber: 1,
      type: "chat_transcript",
      title: "Event staff group chat, 21:12–22:05",
      publicDescription:
        "A simulated group chat recovered from the event staff channel. The messages place several people around the house and describe maintenance work in the east wing.",
      occurredAt: "2026-10-17T21:12:00-04:00",
      sourceLabel: "Simulated messaging interface — event staff channel",
      reliability: "medium",
      relatedSuspectKeys: ["ada", "iona", "jonah"],
      relatedTimelineEventIds: ["evt-2132", "evt-2151", "evt-2157", "evt-2204"],
      mediaStatus: "not_required",
      content: {
        format: "chat",
        channel: "Halcyon House — Event Staff",
        participants: ["Ada Mercer", "Iona Vale", "Jonah Reed", "Priya Nandakumar"],
        messages: [
          {
            at: "21:12",
            sender: "Iona Vale",
            text: "Gallery 4 is sealed. Public route only until the toast ends.",
          },
          {
            at: "21:24",
            sender: "Jonah Reed",
            text: "I'll reset the east wing dimmers after the toast. I won't be on the floor.",
          },
          {
            at: "21:32",
            sender: "Ada Mercer",
            text: "Toast in five. Phones on silent, please.",
          },
          {
            at: "21:49",
            sender: "Priya Nandakumar",
            text: "Service corridor light is out again. I'm using the kitchen route.",
          },
          {
            at: "21:51",
            sender: "Jonah Reed",
            text: "East wing breaker is being fussy. Still here.",
          },
          {
            at: "21:57",
            sender: "Jonah Reed",
            text: "Another ten minutes. The dimmers don't want to hold.",
          },
          {
            at: "22:03",
            sender: "Iona Vale",
            text: "Gallery 4 door is open. No one touches the case.",
          },
          {
            at: "22:05",
            sender: "Ada Mercer",
            text: "Call the police. And find the technician.",
          },
        ],
      },
    },
    {
      key: "access",
      exhibitNumber: 2,
      type: "access_log",
      title: "Service-level keycard events, 21:44–22:11",
      publicDescription:
        "A simulated export from the house access-control system. It records every service-level unlock, maintenance load, and lift call on the evening of the preview.",
      occurredAt: "2026-10-17T21:44:00-04:00",
      sourceLabel: "Halcyon House access-control system — simulated export",
      reliability: "high",
      relatedSuspectKeys: ["ada", "iona", "jonah"],
      relatedTimelineEventIds: ["evt-2144", "evt-2146", "evt-2148", "evt-2158", "evt-2209"],
      mediaStatus: "not_required",
      content: {
        format: "log",
        entries: [
          {
            at: "21:44",
            actor: "EXH-04",
            action: "Maintenance load accepted",
            location: "Service panel G4",
            note: "Gallery circuit toggled",
          },
          {
            at: "21:48",
            actor: "EXH-04",
            action: "Door unlocked",
            location: "Service corridor S2",
          },
          {
            at: "21:52",
            actor: "EXH-04",
            action: "Lift called to service floor",
            location: "Maintenance lift",
          },
          {
            at: "22:09",
            actor: "EXH-04",
            action: "Loading dock opened",
            location: "Loading dock L1",
          },
          {
            at: "22:10",
            actor: "External keypad",
            action: "Loading dock closed",
            location: "Loading dock L1",
          },
          {
            at: "22:11",
            actor: "EXH-04",
            action: "Service corridor locked",
            location: "Service corridor S2",
          },
        ],
      },
    },
    {
      key: "cctv",
      exhibitNumber: 3,
      type: "cctv_log",
      title: "Camera status and corridor log, 21:44–22:09",
      publicDescription:
        "A simulated CCTV operations log. Camera 3 covers the service corridor; Camera 7 covers the east wing. The log records a maintenance loop and the movement of a figure carrying an equipment case.",
      occurredAt: "2026-10-17T21:46:00-04:00",
      sourceLabel: "Halcyon House CCTV operations — simulated log",
      reliability: "high",
      relatedSuspectKeys: ["felix", "iona", "jonah"],
      relatedTimelineEventIds: ["evt-2146", "evt-2151", "evt-2158", "evt-2209"],
      mediaStatus: "not_required",
      content: {
        format: "log",
        entries: [
          {
            at: "21:44–22:02",
            action: "No movement recorded",
            location: "Camera 7 — east-wing corridor",
            note: "Continuous recording",
          },
          {
            at: "21:46",
            actor: "Maintenance console EXH-04",
            action: "Maintenance loop started",
            location: "Camera 3 — service corridor",
            note: "94-second recording repeated",
          },
          {
            at: "21:51",
            actor: "Figure in gray coveralls",
            action: "Entered service corridor with equipment case",
            location: "Camera 3 — service corridor",
            note: "Face obscured by cap; no name visible",
          },
          {
            at: "21:51",
            actor: "Felix Dorn",
            action: "Visible near main-hall fountain",
            location: "Camera 4 — main hall",
          },
          {
            at: "21:58",
            actor: "Figure in gray coveralls",
            action: "Exited toward maintenance lift; case appears heavier",
            location: "Camera 3 — service corridor",
          },
          {
            at: "22:00",
            actor: "Felix Dorn",
            action: "Still visible in main hall",
            location: "Camera 4 — main hall",
          },
          {
            at: "22:09",
            actor: "Figure in gray coveralls",
            action: "Loaded case into van with covered plate",
            location: "Camera 2 — loading dock",
          },
        ],
      },
    },
    {
      key: "witness",
      exhibitNumber: 4,
      type: "witness_statement",
      title: "Caterer statement — service corridor sighting",
      publicDescription:
        "A signed statement from the evening's caterer, recorded by security at 22:20. It describes a person in technician coveralls at the service door and a van at the loading dock.",
      occurredAt: "2026-10-17T22:20:00-04:00",
      sourceLabel: "Halcyon House incident file — simulated witness statement",
      reliability: "medium",
      relatedSuspectKeys: ["ada", "iona", "jonah"],
      relatedTimelineEventIds: ["evt-2148", "evt-2151", "evt-2158", "evt-2209"],
      mediaStatus: "not_required",
      content: {
        format: "statement",
        speaker: "Priya Nandakumar, caterer",
        recordedAt: "22:20",
        context: "Recorded by Iona Vale in the service kitchen.",
        statement:
          "At about 21:50 I came through the kitchen door and saw a man in gray coveralls at the service corridor door. He was carrying a hard black case and kept his face turned away. I recognized the coveralls from the exhibit team; he had been fixing lights in the east wing earlier. At 21:58 I heard the maintenance lift. When I left at 22:05, a dark van was at the loading dock with its engine running.",
      },
    },
    {
      key: "roster",
      exhibitNumber: 5,
      type: "document",
      title: "Evening maintenance roster and credential register",
      publicDescription:
        "Simulated operations paperwork for the preview. It lists staff assignments, the holder of equipment credential EXH-04, and the maintenance console sign-out.",
      occurredAt: "2026-10-17T21:10:00-04:00",
      sourceLabel: "Halcyon House operations — simulated register",
      reliability: "high",
      relatedSuspectKeys: ["ada", "iona", "jonah"],
      relatedTimelineEventIds: ["evt-2115", "evt-2144", "evt-2148"],
      mediaStatus: "not_required",
      content: {
        format: "document",
        heading: "Saturday preview — evening shift",
        sections: [
          {
            heading: "Equipment credential",
            body: [
              "EXH-04 — Jonah Reed — exhibit technician — clocked in 21:10.",
              "Assignment: east-wing dimmer reset, 21:40–22:05.",
              "Maintenance console key signed out at 21:10; returned at 22:14.",
            ],
          },
          {
            heading: "Supervisor notes",
            body: [
              "16 Oct: Reed requested another equipment advance. Request declined.",
              "12 Sep: Reed certified on Gallery 4 display locks, service lift, and maintenance console.",
            ],
          },
          {
            heading: "Other assignments",
            body: [
              "Iona Vale — security lead — front desk 21:30–22:00.",
              "Ada Mercer — director — East Salon toast 21:32–21:56.",
            ],
          },
        ],
        annotations: [
          "EXH-04 is an equipment-bay credential, not a visitor pass.",
          "This register is a simulated document created for the puzzle.",
        ],
      },
    },
    {
      key: "sightline",
      exhibitNumber: 6,
      type: "image",
      title: "Gallery 4 sightline diagram",
      publicDescription:
        "A simulated security briefing diagram showing the public hall, Gallery 4, the service corridor, the maintenance lift, and the loading dock. It is a diagram, not a photograph.",
      occurredAt: "2026-10-17T20:00:00-04:00",
      sourceLabel: "Halcyon House security briefing — simulated diagram",
      reliability: "high",
      relatedSuspectKeys: ["iona", "jonah"],
      relatedTimelineEventIds: ["evt-2146", "evt-2148", "evt-2209"],
      mediaStatus: "ready",
      mediaUrl: "/sample-assets/gallery-4-sightline.svg",
      altText:
        "Fictional floor-plan diagram of Gallery 4, a service corridor covered by Camera 3, a maintenance lift, and a loading dock. A dashed blind-spot path runs from the gallery to the dock.",
      content: {
        format: "image",
        imageUrl: "/sample-assets/gallery-4-sightline.svg",
        caption:
          "Security briefing diagram — Gallery 4 service route (simulated asset).",
        interpretation:
          "Camera 3 is the only camera covering the service corridor. During its maintenance loop, the route from Gallery 4 to the maintenance lift and loading dock is unobserved. The diagram does not show who used the route.",
        simulated: true,
      },
    },
    {
      key: "dock",
      exhibitNumber: 7,
      type: "cctv_transcript",
      title: "Loading dock audio transcript, 22:08–22:10",
      publicDescription:
        "A simulated transcript from the loading-dock microphone. Two unidentified voices discuss the weight of a case and payment after authentication.",
      occurredAt: "2026-10-17T22:08:00-04:00",
      sourceLabel: "Loading dock microphone 2 — simulated transcript",
      reliability: "medium",
      relatedSuspectKeys: ["ada", "felix", "jonah"],
      relatedTimelineEventIds: ["evt-2209"],
      mediaStatus: "not_required",
      content: {
        format: "transcript",
        source: "Loading dock microphone 2",
        lines: [
          { at: "22:08", speaker: "Ambient", text: "Rolling wheels and a van door opening." },
          {
            at: "22:08",
            speaker: "Voice A (unidentified)",
            text: "Careful. It's heavier than the listing said.",
          },
          {
            at: "22:08",
            speaker: "Voice B (unidentified)",
            text: "Keep it in the case until the auction house authenticates it.",
          },
          {
            at: "22:09",
            speaker: "Voice A (unidentified)",
            text: "And the rest of the payment?",
          },
          {
            at: "22:09",
            speaker: "Voice B (unidentified)",
            text: "After authentication. Tell them the service entrance is already clear.",
          },
          { at: "22:09", speaker: "Ambient", text: "A metal door closes." },
        ],
      },
    },
    {
      key: "valuation",
      exhibitNumber: 8,
      type: "document",
      title: "Internal valuation memo, 14 October",
      publicDescription:
        "A simulated internal memo about increasing the insured value of the Meridian. It establishes a financial motive for the museum director but does not place her at the gallery.",
      occurredAt: "2026-10-14T16:30:00-04:00",
      sourceLabel: "Halcyon House internal files — simulated memo",
      reliability: "high",
      relatedSuspectKeys: ["ada", "iona", "felix"],
      relatedTimelineEventIds: ["evt-2115"],
      mediaStatus: "not_required",
      content: {
        format: "document",
        heading: "Confidential draft — collection valuation",
        sections: [
          {
            body: [
              "The Meridian's current insured value no longer reflects its market interest.",
              "A revised valuation would allow the house to restructure the west-wing renovation debt.",
              "If the house is to survive, the collection must carry its weight.",
            ],
          },
        ],
        annotations: ["Draft only. No submission record is attached."],
      },
    },
  ],
  culpritKey: "jonah",
  motive:
    "Reed was carrying an unpaid equipment advance and had been refused more money the day before the preview. The loading-dock transcript refers to the rest of the payment after authentication, and the credential used throughout the theft was signed out to him.",
  method:
    "Reed used EXH-04 to put the gallery circuit under maintenance load, triggered a 94-second loop on Camera 3, opened the service corridor, and moved the sphere through the maintenance lift to a waiting van in a hard equipment case with a false bottom. He sent east-wing status messages while the east-wing camera recorded no movement.",
  explanation:
    "The sphere left Gallery 4 through the service corridor during the 94-second Camera 3 loop. Every service action in the relevant window used credential EXH-04: the gallery circuit maintenance load at 21:44, the Camera 3 override at 21:46, the corridor unlock at 21:48, the maintenance lift at 21:52, and the loading dock at 22:09. The maintenance roster identifies EXH-04 as Jonah Reed's equipment credential. Reed's statement and the staff chat place him in the east wing at 21:51 and 21:57, but Camera 7 recorded no movement there between 21:44 and 22:02. The caterer saw a technician in coveralls with an equipment case at the service door, and the loading-dock transcript describes that case being handed off for authentication and payment. Ada's valuation memo and Felix's offer are real motives, but the camera log places Felix in the main hall and the witness evidence places Ada at the toast. Reed had both the means and the contradictory alibi.",
  supportingEvidenceKeys: ["access", "cctv", "witness", "roster", "dock"],
  hintTexts: [
    "Start with time, not motive. Compare the service-level events between 21:44 and 21:52 with the staff chat. The building's record and the alibi do not agree.",
    "One credential appears on every service action: the gallery circuit, the corridor door, the lift, and the loading dock. The maintenance roster shows who signed for that credential.",
    "Camera 7 records no movement in the east wing while the staff chat claims the dimmer work is still underway. Seven minutes after the empty case is found, the same credential opens the loading dock.",
  ],
  contentSafetyFlags: ["fictional_names", "simulated_messages", "simulated_media"],
};

export interface InstantiatedSampleCase {
  caseDoc: Omit<CaseDocument, "createdAt" | "updatedAt">;
  suspectDocs: Array<Omit<SuspectDocument, "createdAt" | "updatedAt">>;
  evidenceDocs: Array<Omit<EvidenceDocument, "createdAt" | "updatedAt">>;
  solutionDoc: Omit<SolutionDocument, "createdAt" | "updatedAt">;
}

export function instantiateSampleCase(): InstantiatedSampleCase {
  const caseId = new Types.ObjectId();
  const generationId = new Types.ObjectId();
  const suspectIds = new Map<string, Types.ObjectId>();
  const evidenceIds = new Map<string, Types.ObjectId>();

  for (const suspect of SAMPLE_CASE_DEFINITION.suspects) {
    suspectIds.set(suspect.key, new Types.ObjectId());
  }
  for (const evidence of SAMPLE_CASE_DEFINITION.evidence) {
    evidenceIds.set(evidence.key, new Types.ObjectId());
  }

  const suspectDocs: InstantiatedSampleCase["suspectDocs"] =
    SAMPLE_CASE_DEFINITION.suspects.map((suspect) => ({
      _id: required(suspectIds.get(suspect.key), `suspect ${suspect.key}`),
      caseId,
      displayName: suspect.displayName,
      role: suspect.role,
      profile: suspect.profile,
      motiveSummary: suspect.motiveSummary,
      opportunitySummary: suspect.opportunitySummary,
      publicStatement: suspect.publicStatement,
      relationships: suspect.relationships.map((relationship) => ({
        otherSuspectId: required(
          suspectIds.get(relationship.suspectKey),
          `relationship suspect ${relationship.suspectKey}`,
        ),
        relationship: relationship.relationship,
      })),
    }));

  const evidenceDocs: InstantiatedSampleCase["evidenceDocs"] =
    SAMPLE_CASE_DEFINITION.evidence.map((evidence) => ({
      _id: required(evidenceIds.get(evidence.key), `evidence ${evidence.key}`),
      caseId,
      exhibitNumber: evidence.exhibitNumber,
      type: evidence.type,
      title: evidence.title,
      publicDescription: evidence.publicDescription,
      content: evidence.content,
      occurredAt: evidence.occurredAt ? new Date(evidence.occurredAt) : null,
      sourceLabel: evidence.sourceLabel,
      reliability: evidence.reliability,
      relatedSuspectIds: evidence.relatedSuspectKeys.map((key) =>
        required(suspectIds.get(key), `evidence suspect ${key}`),
      ),
      relatedTimelineEventIds: evidence.relatedTimelineEventIds,
      mediaStatus: evidence.mediaStatus,
      ...(evidence.mediaUrl ? { mediaUrl: evidence.mediaUrl } : {}),
      ...(evidence.altText ? { altText: evidence.altText } : {}),
    }));

  const canonicalTimeline: CanonicalTimelineEvent[] =
    SAMPLE_CASE_DEFINITION.canonicalTimeline.map((event) => ({
      eventId: event.eventId,
      at: event.at,
      location: event.location,
      description: event.description,
      involvedSuspectIds: event.involvedSuspectKeys.map((key) =>
        required(suspectIds.get(key), `timeline suspect ${key}`),
      ),
    }));

  const caseDoc: InstantiatedSampleCase["caseDoc"] = {
    _id: caseId,
    title: SAMPLE_CASE_DEFINITION.title,
    scenario: SAMPLE_CASE_DEFINITION.scenario,
    summary: SAMPLE_CASE_DEFINITION.summary,
    category: SAMPLE_CASE_DEFINITION.category,
    difficulty: SAMPLE_CASE_DEFINITION.difficulty,
    status: "ready",
    creatorSessionId: "",
    suspectIds: suspectDocs.map((suspect) => suspect._id),
    evidenceIds: evidenceDocs.map((evidence) => evidence._id),
    generationVersion: "sample-v1",
    generationId,
    isSample: true,
    isPublic: true,
    incident: SAMPLE_CASE_DEFINITION.incident,
    timezone: SAMPLE_CASE_DEFINITION.timezone,
    caseRules: SAMPLE_CASE_DEFINITION.caseRules,
    fictionNotice: SAMPLE_CASE_DEFINITION.fictionNotice,
    timeline: SAMPLE_CASE_DEFINITION.timeline,
  };

  const solutionDoc: InstantiatedSampleCase["solutionDoc"] = {
    _id: new Types.ObjectId(),
    caseId,
    culpritSuspectId: required(suspectIds.get(SAMPLE_CASE_DEFINITION.culpritKey), "culprit"),
    canonicalTimeline,
    motive: SAMPLE_CASE_DEFINITION.motive,
    method: SAMPLE_CASE_DEFINITION.method,
    explanation: SAMPLE_CASE_DEFINITION.explanation,
    supportingEvidenceIds: SAMPLE_CASE_DEFINITION.supportingEvidenceKeys.map((key) =>
      required(evidenceIds.get(key), `supporting evidence ${key}`),
    ),
    hintTexts: SAMPLE_CASE_DEFINITION.hintTexts,
    validationStatus: "valid",
    contentSafetyFlags: SAMPLE_CASE_DEFINITION.contentSafetyFlags,
  };

  return { caseDoc, suspectDocs, evidenceDocs, solutionDoc };
}

function required<T>(value: T | undefined, label: string): T {
  if (value === undefined) {
    throw new Error(`Sample case fixture is missing ${label}.`);
  }
  return value;
}
