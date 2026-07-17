import React, { useId, useState } from 'react';

type FloatingFieldProps = {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  as?: 'input' | 'textarea';
  rows?: number;
  min?: number;
  max?: number;
  id?: string;
};

/** Label floats from placeholder position on focus/value — 150ms, no bounce. */
export const FloatingField: React.FC<FloatingFieldProps> = ({
  label,
  value,
  onChange,
  type = 'text',
  required,
  disabled,
  as = 'input',
  rows = 3,
  min,
  max,
  id: idProp,
}) => {
  const autoId = useId();
  const id = idProp ?? autoId;
  const [focused, setFocused] = useState(false);
  const filled = String(value).length > 0;
  const floated = focused || filled;

  const shared =
    'peer w-full bg-transparent text-sm text-fg focus:outline-none border-none pt-5 pb-2 px-3.5 resize-none';

  return (
    <div
      className={`field relative ${focused ? 'ring-0' : ''}`}
      data-focused={focused || undefined}
    >
      <label
        htmlFor={id}
        className={`pointer-events-none absolute left-3.5 transition-all duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          floated
            ? 'top-1.5 text-[10px] font-medium text-accent-warm tracking-wide'
            : 'top-1/2 -translate-y-1/2 text-[13px] text-fg-subtle'
        } ${as === 'textarea' && !floated ? 'top-3.5 translate-y-0' : ''}`}
      >
        {label}
        {required ? ' *' : ''}
      </label>
      {as === 'textarea' ? (
        <textarea
          id={id}
          rows={rows}
          value={value}
          required={required}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className={shared}
        />
      ) : (
        <input
          id={id}
          type={type}
          min={min}
          max={max}
          value={value}
          required={required}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className={shared}
        />
      )}
    </div>
  );
};
