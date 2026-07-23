import { isAureonError } from "@buildaureon/sdk";

export function errorText(err: unknown): string {
  if (isAureonError(err)) {
    return `[${err.code}] ${err.message}`;
  }
  if (err instanceof Error) {
    return err.message;
  }
  return String(err);
}
