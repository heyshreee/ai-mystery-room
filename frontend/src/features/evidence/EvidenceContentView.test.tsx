import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { EvidenceContent } from "@amr/shared";
import { EvidenceContentView } from "./EvidenceContentView";

const IMAGE: Extract<EvidenceContent, { format: "image" }> = {
  format: "image",
  imageUrl: "/case-assets/evidence-map.svg",
  caption: "Approved static fictional service-route diagram",
  interpretation:
    "The dashed route is unobserved while Camera 3 loops, so the corridor does not identify a person.",
  simulated: true,
};

describe("EvidenceContentView image fallback", () => {
  it("renders the approved diagram with its written interpretation", () => {
    render(<EvidenceContentView content={IMAGE} altText="Fictional service route" />);

    const image = screen.getByRole("img", { name: "Fictional service route" });
    expect(image).toHaveAttribute("src", "/case-assets/evidence-map.svg");
    expect(screen.getByText("Simulated asset")).toBeInTheDocument();
    expect(screen.getByText(IMAGE.interpretation)).toBeInTheDocument();
  });

  it("keeps the written exhibit when the image fails to load", () => {
    render(<EvidenceContentView content={IMAGE} altText="Fictional service route" />);

    fireEvent.error(screen.getByRole("img", { name: "Fictional service route" }));

    expect(screen.getByText("Exhibit image unavailable")).toBeInTheDocument();
    expect(
      screen.getByText(/The written description and interpretation below remain/),
    ).toBeInTheDocument();
    expect(screen.getByText(IMAGE.caption)).toBeInTheDocument();
    expect(screen.getByText(IMAGE.interpretation)).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("starts in the written fallback when no image URL exists", () => {
    render(<EvidenceContentView content={{ ...IMAGE, imageUrl: "" }} />);

    expect(screen.getByText("Exhibit image unavailable")).toBeInTheDocument();
    expect(screen.getByText(IMAGE.interpretation)).toBeInTheDocument();
  });
});
