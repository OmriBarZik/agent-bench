import type { CdpParams, CdpSession } from "../cdp.types";
import type { PagePoint } from "../chrome-check.types";

/**
 * The middle of the element with this `id` anywhere in the page (shadow roots and frames included), or null when
 * no such element exists or it has no box, as with a tab hidden in an overflow menu. Read through the DevTools
 * protocol only.
 */
export async function elementCenterById({
  page,
  elementId,
}: {
  page: CdpSession;
  elementId: string;
}): Promise<PagePoint | null> {
  const tree = await page.send("DOM.getDocument", { depth: -1, pierce: true });
  const backendNodeId = findById({ node: tree.root as CdpParams, elementId });

  if (backendNodeId == null) {
    return null;
  }

  try {
    const box = await page.send("DOM.getBoxModel", { backendNodeId });
    const quad = ((box.model as CdpParams | undefined)?.border as number[] | undefined) ?? [];
    const xs = [quad[0] ?? 0, quad[2] ?? 0, quad[4] ?? 0, quad[6] ?? 0];
    const ys = [quad[1] ?? 0, quad[3] ?? 0, quad[5] ?? 0, quad[7] ?? 0];
    const width = Math.max(...xs) - Math.min(...xs);

    return width > 0 ? { x: Math.min(...xs) + width / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 } : null;
  } catch {
    // DOM.getBoxModel throws for an element that is not rendered; that is the same as no element to click.
    return null;
  }
}

function findById({ node, elementId }: { node: CdpParams; elementId: string }): number | null {
  const attributes = (node.attributes as string[] | undefined) ?? [];

  for (let i = 0; i + 1 < attributes.length; i += 2) {
    if (attributes[i] === "id" && attributes[i + 1] === elementId && typeof node.backendNodeId === "number") {
      return node.backendNodeId;
    }
  }

  const children = [
    ...((node.children as CdpParams[] | undefined) ?? []),
    ...((node.shadowRoots as CdpParams[] | undefined) ?? []),
    ...(node.contentDocument ? [node.contentDocument as CdpParams] : []),
  ];

  for (const child of children) {
    const found = findById({ node: child, elementId });

    if (found != null) {
      return found;
    }
  }

  return null;
}
