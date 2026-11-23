import { ChevronDown } from "lucide-react";

import { FieldHint } from "./FieldHint";

interface SelectOption<T extends string> {
  value: T;
  label: string;
}

interface SelectFieldProps<T extends string> {
  label: string;
  value: T;
  options: ReadonlyArray<SelectOption<T>>;
  onChange: (value: T) => void;
  id?: string;
  hint?: string;
  selectClassName?: string;
}

const defaultSelectClass =
  "ui-control w-full appearance-none rounded-lg border border-line-strong bg-inset pr-9 pl-3 py-2 text-sm text-ink outline-none hover:border-line-strong focus:border-accent";

export function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
  id,
  hint,
  selectClassName,
}: SelectFieldProps<T>) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-medium text-ink-2">
        {label}
      </label>
      <div className="relative mt-1.5">
        <select
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value as T)}
          className={selectClassName ?? defaultSelectClass}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown
          size={14}
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-2"
        />
      </div>
      {hint && <FieldHint>{hint}</FieldHint>}
    </div>
  );
}
