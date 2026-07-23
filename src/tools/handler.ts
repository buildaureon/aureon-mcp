import { formatJson } from "../format.js";
import { errorText } from "../errors.js";

export function ok(data: unknown) {
  return { content: [{ type: "text" as const, text: formatJson(data) }] };
}

export function fail(err: unknown) {
  return { content: [{ type: "text" as const, text: errorText(err) }], isError: true };
}
