import { type InputHTMLAttributes, type TextareaHTMLAttributes, forwardRef } from "react";

interface FieldWrapperProps {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}

function FieldWrapper({ label, hint, error, children }: FieldWrapperProps) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm text-ink-muted">{label}</span>
      {children}
      {hint && !error && <span className="block text-xs text-ink-muted">{hint}</span>}
      {error && <span className="block text-xs text-danger">{error}</span>}
    </label>
  );
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, hint, error, className = "", ...props }, ref) => (
    <FieldWrapper label={label} hint={hint} error={error}>
      <input ref={ref} className={`input-field ${className}`} {...props} />
    </FieldWrapper>
  )
);
Input.displayName = "Input";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  hint?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, hint, error, className = "", ...props }, ref) => (
    <FieldWrapper label={label} hint={hint} error={error}>
      <textarea ref={ref} className={`input-field ${className}`} {...props} />
    </FieldWrapper>
  )
);
Textarea.displayName = "Textarea";
