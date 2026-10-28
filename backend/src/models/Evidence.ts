import type {
  EvidenceContent,
  EvidenceType,
  MediaStatus,
  Reliability,
} from "@amr/shared";

export interface EvidenceDocument {
  _id: string;
  caseId: string;
  exhibitNumber: number;
  type: EvidenceType;
  title: string;
  publicDescription: string;
  content: EvidenceContent;
  occurredAt: Date | null;
  sourceLabel: string;
  reliability: Reliability;
  relatedSuspectIds: string[];
  relatedTimelineEventIds: string[];
  mediaStatus: MediaStatus;
  mediaUrl?: string;
  altText?: string;
  createdAt?: Date;
  updatedAt?: Date;
}
