import type { ToolRunBody } from "./tools.js";
import type { ToolContext } from "./tools.js";
import { expandExtendSchema, type ExpandExtend } from "./expand-extend.js";

export function mergeExpandToolContext(
  toolId: string,
  body: Pick<ToolRunBody, "toolContext" | "extend">,
): ToolContext | undefined {
  if (toolId !== "expand") {
    return body.toolContext;
  }

  const extend: ExpandExtend =
    body.extend ??
    body.toolContext?.extend ??
    expandExtendSchema.parse({ direction: "all" });

  return {
    toolId: "expand",
    masks: body.toolContext?.masks ?? [],
    extend,
  };
}
