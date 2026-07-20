/**
 * Reusable password input with show/hide toggle.
 * Does NOT store or log the password value.
 */
import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Lock, Eye, EyeOff } from "lucide-react";

export default function PasswordField({ id, label, value, onChange, autoFocus, placeholder = "••••••••", autoComplete = "new-password" }) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" aria-hidden="true" />
      <Input
        id={id}
        type={visible ? "text" : "password"}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        className="pl-10 pr-10 h-12"
        required
        aria-label={label}
      />
      <button
        type="button"
        onClick={() => setVisible(v => !v)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
        aria-label={visible ? "Hide password" : "Show password"}
        tabIndex={0}
      >
        {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
}