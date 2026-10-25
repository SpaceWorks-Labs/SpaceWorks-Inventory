import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CollapsibleCard } from "@/components/ui/collapsible";

type Props = Omit<Parameters<typeof CollapsibleCard>[0], "children">;

function render(props: Partial<Props> = {}) {
  const all: Props = { id: "queue", title: "Loan requests", ...props };
  return renderToStaticMarkup(createElement(CollapsibleCard as (p: Props) => ReturnType<typeof CollapsibleCard>, all, createElement("p", null, "Body")));
}

describe("CollapsibleCard", () => {
  it("renders open by default with the title in a named toggle", () => {
    const html = render();
    expect(html).toMatch(/<button[^>]*aria-expanded="true"/);
    expect(html).toContain("Loan requests");
    expect(html).not.toMatch(/<div[^>]*hidden=""/);
  });

  it("starts folded when defaultOpen is false and hides the body", () => {
    const html = render({ defaultOpen: false });
    expect(html).toMatch(/<button[^>]*aria-expanded="false"/);
    expect(html).toMatch(/<div[^>]*hidden=""[^>]*>.*Body/);
  });

  it("points the toggle at the body it controls", () => {
    const html = render();
    const controls = html.match(/aria-controls="([^"]+)"/)?.[1];
    expect(controls).toBeTruthy();
    expect(html).toContain(`id="${controls}"`);
  });

  it("shows the count, including zero, and keeps the action outside the toggle", () => {
    const html = render({ count: 0, action: createElement("a", { href: "/all" }, "View all") });
    expect(html).toMatch(/tabular-nums[^>]*>0</);
    expect(html.indexOf("</button>")).toBeLessThan(html.indexOf("View all"));
  });
});
