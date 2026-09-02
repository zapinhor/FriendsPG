import { type ButtonHTMLAttributes, forwardRef } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary";
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", className = "", ...props }, ref) => {
    const base = variant === "primary" ? "btn-primary" : "btn-secondary";
    return <button ref={ref} className={`${base} ${className}`} {...props} />;
  }
);

Button.displayName = "Button";
