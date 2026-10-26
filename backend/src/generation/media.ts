export const STATIC_EVIDENCE_DIAGRAM = {
  url: "/case-assets/evidence-map.svg",
  mimeType: "image/svg+xml",
  altText:
    "Approved static fictional floor-plan diagram. It shows a preview room, a service corridor covered by one camera, a maintenance lift, and a loading dock. It is a diagram, not a generated photograph.",
} as const;

export interface MediaProvider {
  readonly id: string;
  generateImage?(input: {
    prompt: string;
    aspectRatio?: string;
  }): Promise<{ url: string; mimeType: string }>;
  generateVideo?(input: {
    prompt: string;
    durationSeconds?: number;
  }): Promise<{ url: string; mimeType: string }>;
}

/**
 * The current media contract deliberately exposes no live image or video
 * generator. Image exhibits use an approved static fictional diagram, and the
 * exhibit text says so. A live provider can be added behind this interface
 * without changing case generation or persistence.
 */
export class StaticMediaProvider implements MediaProvider {
  readonly id = "static";
}
