"use client";

import { useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";

export function MfaCodeInput({
  value,
  onChange,
  disabled,
  autoFocus,
}: {
  value: string[];
  onChange(value: string[]): void;
  disabled?: boolean;
  autoFocus?: boolean;
}) {
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    if (autoFocus && value.every((digit) => !digit)) {
      inputRefs.current[0]?.focus();
    }
  }, [autoFocus, value]);

  function updateDigit(index: number, rawValue: string) {
    const digit = rawValue.replace(/\D/gu, "").slice(-1);
    const next = [...value];
    next[index] = digit;
    onChange(next);
    if (digit && index < 5) inputRefs.current[index + 1]?.focus();
  }

  function handleKeyDown(
    index: number,
    event: React.KeyboardEvent<HTMLInputElement>,
  ) {
    if (event.key === "Backspace" && !value[index] && index > 0) {
      event.preventDefault();
      const next = [...value];
      next[index - 1] = "";
      onChange(next);
      inputRefs.current[index - 1]?.focus();
    }
    if (event.key === "ArrowLeft" && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    if (event.key === "ArrowRight" && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handlePaste(event: React.ClipboardEvent<HTMLDivElement>) {
    const digits = event.clipboardData
      .getData("text")
      .replace(/\D/gu, "")
      .slice(0, 6)
      .split("");
    if (digits.length === 0) return;
    event.preventDefault();
    const next = Array(6).fill("");
    digits.forEach((digit, index) => {
      next[index] = digit;
    });
    onChange(next);
    inputRefs.current[Math.min(digits.length, 5)]?.focus();
  }

  return (
    <div
      role="group"
      aria-label="6 位动态安全码"
      className="flex justify-center gap-2"
      onPaste={handlePaste}
    >
      {value.map((digit, index) => (
        <Input
          key={index}
          ref={(element) => {
            inputRefs.current[index] = element;
          }}
          type="text"
          inputMode="numeric"
          autoComplete={index === 0 ? "one-time-code" : "off"}
          pattern="[0-9]"
          maxLength={1}
          value={digit}
          onChange={(event) => updateDigit(index, event.target.value)}
          onKeyDown={(event) => handleKeyDown(index, event)}
          disabled={disabled}
          autoFocus={autoFocus && index === 0}
          aria-label={`验证码第 ${index + 1} 位`}
          className="size-11 rounded-lg px-0 text-center font-mono text-lg font-semibold tracking-normal shadow-none"
        />
      ))}
    </div>
  );
}
