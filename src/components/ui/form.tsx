"use client";

import * as React from "react";
import {
  Controller,
  FormProvider,
  useFormContext,
  useFormState,
  type ControllerProps,
  type FieldPath,
  type FieldValues,
} from "react-hook-form";
import { Slot } from "radix-ui";
import { cn } from "@/lib/utils";
import { Label } from "./label";

/** React Hook Form integration (shadcn/ui pattern). */
export const Form = FormProvider;

type FormFieldContextValue = { name: string };
const FormFieldContext = React.createContext<FormFieldContextValue | null>(null);
const FormItemContext = React.createContext<{ id: string } | null>(null);

export function FormField<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
  TTransformedValues = TFieldValues,
>(props: ControllerProps<TFieldValues, TName, TTransformedValues>) {
  return (
    <FormFieldContext.Provider value={{ name: props.name }}>
      <Controller {...props} />
    </FormFieldContext.Provider>
  );
}

export function useFormField() {
  const field = React.useContext(FormFieldContext);
  const item = React.useContext(FormItemContext);
  const { getFieldState } = useFormContext();
  const formState = useFormState({ name: field?.name });
  if (!field || !item) throw new Error("useFormField must be used inside <FormField> and <FormItem>");
  const state = getFieldState(field.name, formState);
  return {
    name: field.name,
    id: item.id,
    controlId: `${item.id}-control`,
    descriptionId: `${item.id}-description`,
    messageId: `${item.id}-message`,
    ...state,
  };
}

export function FormItem({ className, ...props }: React.ComponentProps<"div">) {
  const id = React.useId();
  return (
    <FormItemContext.Provider value={{ id }}>
      <div className={cn("grid gap-1.5", className)} {...props} />
    </FormItemContext.Provider>
  );
}

export function FormLabel({ className, ...props }: React.ComponentProps<typeof Label>) {
  const { error, controlId } = useFormField();
  return <Label htmlFor={controlId} className={cn(error && "text-destructive", className)} {...props} />;
}

export function FormControl(props: React.ComponentProps<typeof Slot.Root>) {
  const { error, controlId, descriptionId, messageId } = useFormField();
  return (
    <Slot.Root
      id={controlId}
      aria-describedby={error ? `${descriptionId} ${messageId}` : descriptionId}
      aria-invalid={!!error}
      {...props}
    />
  );
}

export function FormDescription({ className, ...props }: React.ComponentProps<"p">) {
  const { descriptionId } = useFormField();
  return <p id={descriptionId} className={cn("text-xs leading-6 text-muted-foreground", className)} {...props} />;
}

export function FormMessage({ className, children, ...props }: React.ComponentProps<"p">) {
  const { error, messageId } = useFormField();
  const body = error ? String(error.message ?? "") : children;
  if (!body) return null;
  return (
    <p id={messageId} role="alert" className={cn("text-xs leading-6 font-medium text-destructive", className)} {...props}>
      {body}
    </p>
  );
}
