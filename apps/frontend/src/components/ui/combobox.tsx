'use client';

import * as React from 'react';
import { Command as CommandPrimitive } from 'cmdk';
import { Check, ChevronDown } from 'lucide-react';
import { Popover as PopoverPrimitive } from 'radix-ui';

import { cn } from '@/lib/utils';

/** Generic option carried by the combobox. `value` is the unique key. */
export interface ComboboxOption<T = unknown> {
    value: string;
    label: string;
    data?: T;
}

interface ComboboxProps<T> {
    options: ComboboxOption<T>[];
    /** Currently selected value (option.value). */
    value?: string;
    onValueChange: (value: string, option: ComboboxOption<T>) => void;
    /** Placeholder for the trigger button when nothing is selected. */
    placeholder?: string;
    /** Search field placeholder. */
    searchPlaceholder?: string;
    /** Text shown when no option matches the query. */
    emptyText?: string;
    /** Render a custom option row. Default: the option `label`. */
    renderOption?: (option: ComboboxOption<T>) => React.ReactNode;
    /** Disable specific options (e.g. already-added items). */
    isOptionDisabled?: (option: ComboboxOption<T>) => boolean;
    buttonClassName?: string;
    contentClassName?: string;
    disabled?: boolean;
}

/**
 * Shadcn-style searchable combobox built on cmdk + the existing Popover.
 * Client-side filtering (fuzzy by label) via cmdk's built-in filter.
 */
export function Combobox<T>({
    options,
    value,
    onValueChange,
    placeholder = 'Выберите…',
    searchPlaceholder = 'Поиск…',
    emptyText = 'Ничего не найдено',
    renderOption,
    isOptionDisabled,
    buttonClassName,
    contentClassName,
    disabled,
}: ComboboxProps<T>) {
    const [open, setOpen] = React.useState(false);
    const [query, setQuery] = React.useState('');

    const selected = options.find((o) => o.value === value) ?? null;

    const reset = React.useCallback(() => {
        // Сбрасываем поисковый запрос при закрытии поповера.
        setQuery('');
    }, []);

    return (
        <PopoverPrimitive.Root
            open={open}
            onOpenChange={(o) => {
                setOpen(o);
                if (!o) reset();
            }}
        >
            <PopoverPrimitive.Trigger asChild>
                <button
                    type="button"
                    disabled={disabled}
                    aria-expanded={open}
                    aria-haspopup="listbox"
                    className={cn(
                        'flex h-9 w-full items-center justify-between gap-2 rounded-lg border border-border bg-bg-card px-3 text-left text-13-regular text-fg-primary transition-colors',
                        'hover:border-border-strong focus-visible:border-border-strong focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:outline-none',
                        'disabled:cursor-not-allowed disabled:opacity-50',
                        '[&>span]:line-clamp-1',
                        buttonClassName,
                    )}
                >
                    <span className="min-w-0">
                        {selected ? selected.label : <span className="text-fg-tertiary">{placeholder}</span>}
                    </span>
                    <ChevronDown className={cn('size-4 shrink-0 text-fg-tertiary transition-transform', open && 'rotate-180')} />
                </button>
            </PopoverPrimitive.Trigger>
            <PopoverPrimitive.Portal>
                <PopoverPrimitive.Content
                    align="start"
                    sideOffset={4}
                    className={cn(
                        // Ширина фиксирована по триггеру, чтобы длинные имена не расширяли
                        // поповер — контент обрезается через truncate внутри опций.
                        'z-50 flex min-w-[14rem] w-[var(--radix-popover-trigger-width)] flex-col overflow-hidden rounded-xl border border-border bg-bg-card p-0 shadow-md',
                        'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0',
                        contentClassName,
                    )}
                >
                    <CommandPrimitive shouldFilter={true}>
                        <div className="flex items-center gap-2 border-b border-border-soft px-3">
                            <CommandPrimitive.Input
                                value={query}
                                onValueChange={setQuery}
                                placeholder={searchPlaceholder}
                                className="h-9 flex-1 bg-transparent text-13-regular text-fg-primary placeholder:text-fg-tertiary focus-visible:outline-none"
                            />
                        </div>
                        <CommandPrimitive.List className="max-h-72 overflow-y-auto p-1">
                            <CommandPrimitive.Empty className="py-6 text-center text-13-regular text-fg-tertiary">
                                {emptyText}
                            </CommandPrimitive.Empty>
                            {options.map((option) => {
                                const isDisabled = isOptionDisabled?.(option) ?? false;
                                const isSelected = option.value === value;
                                return (
                                    <CommandPrimitive.Item
                                        key={option.value}
                                        value={option.label}
                                        disabled={isDisabled}
                                        onSelect={() => {
                                            if (isDisabled) return;
                                            onValueChange(option.value, option);
                                            setOpen(false);
                                        }}
                                        className={cn(
                                            'flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-13-regular text-fg-primary',
                                            'data-[selected=true]:bg-bg-soft',
                                            'data-[disabled=true]:cursor-not-allowed data-[disabled=true]:opacity-50 data-[disabled=true]:hover:bg-transparent',
                                        )}
                                    >
                                        <Check
                                            className={cn('size-4 shrink-0 text-primary', isSelected ? 'opacity-100' : 'opacity-0')}
                                        />
                                        <span className="min-w-0 flex-1 truncate">
                                            {renderOption ? renderOption(option) : option.label}
                                        </span>
                                    </CommandPrimitive.Item>
                                );
                            })}
                        </CommandPrimitive.List>
                    </CommandPrimitive>
                </PopoverPrimitive.Content>
            </PopoverPrimitive.Portal>
        </PopoverPrimitive.Root>
    );
}
