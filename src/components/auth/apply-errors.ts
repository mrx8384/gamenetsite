import type { FieldValues, Path, UseFormSetError } from "react-hook-form";

/** Maps server-side field errors onto react-hook-form fields. */
export function applyFieldErrors<T extends FieldValues>(setError: UseFormSetError<T>, fieldErrors?: Record<string, string>) {
  if (!fieldErrors) return;
  for (const [field, message] of Object.entries(fieldErrors)) {
    setError(field as Path<T>, { type: "server", message });
  }
}
