"use client";

import {
  Children,
  isValidElement,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/shared/utils/shadcn_utils";

type Option = { value: string; label: string; disabled: boolean };

function optionText(node: ReactNode): string {
  return Children.toArray(node)
    .map((child) =>
      isValidElement<{ children?: ReactNode }>(child)
        ? optionText(child.props.children)
        : String(child),
    )
    .join("");
}

function readOptions(children: ReactNode, disabled = false): Option[] {
  return Children.toArray(children).flatMap((child) => {
    if (!isValidElement<ComponentProps<"option">>(child)) return [];
    if (child.type === "option") {
      const label = child.props.label ?? optionText(child.props.children);
      return [
        {
          value: String(child.props.value ?? label),
          label,
          disabled: disabled || !!child.props.disabled,
        },
      ];
    }
    return readOptions(
      child.props.children,
      disabled || !!child.props.disabled,
    );
  });
}

type SelectProps = ComponentProps<"select"> & {
  searchable?: boolean;
  searchPlaceholder?: string;
};

function normalizeSearch(text: string) {
  return text.normalize("NFC").replace(/\s/g, "").toLocaleLowerCase();
}

/** A custom dropdown, backed by a native select for form semantics. */
export function Select({
  className,
  children,
  value,
  defaultValue,
  onChange,
  id,
  disabled,
  required,
  ref,
  searchable = false,
  searchPlaceholder = "검색어를 입력해 주세요",
  ...props
}: SelectProps) {
  const generatedId = useId();
  const triggerId = id ?? `select-${generatedId}`;
  const menuId = `${triggerId}-options`;
  const options = readOptions(children);
  const [internalValue, setInternalValue] = useState(
    String(defaultValue ?? options[0]?.value ?? ""),
  );
  const selectedValue = String(value ?? internalValue);
  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === selectedValue),
  );
  const selected = options[selectedIndex];
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(selectedIndex);
  const [query, setQuery] = useState("");
  const searchTokens = query.trim().split(/\s+/).map(normalizeSearch);
  const visibleOptions = options
    .map((option, index) => ({ ...option, index }))
    .filter(
      (option) =>
        !searchable ||
        searchTokens.every((token) =>
          normalizeSearch(option.label).includes(token),
        ),
    );
  const visibleActiveIndex = visibleOptions.some(
    (option) => option.index === activeIndex && !option.disabled,
  )
    ? activeIndex
    : (visibleOptions.find((option) => !option.disabled)?.index ?? -1);
  const searchInput = useRef<HTMLInputElement>(null);
  const composing = useRef(false);
  const [invalid, setInvalid] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const native = useRef<HTMLSelectElement>(null);
  const search = useRef({ text: "", time: 0 });

  function close() {
    search.current = { text: "", time: 0 };
    menu.current?.hidePopover?.();
    setOpen(false);
  }

  function show(index = selectedIndex) {
    if (disabled) return;
    const enabledIndex = options[index]?.disabled
      ? options.findIndex((option) => !option.disabled)
      : index;
    setQuery("");
    setActiveIndex(enabledIndex);
    setOpen(true);
  }

  function choose(index: number) {
    const option = options[index];
    if (disabled || !option || option.disabled || !native.current) return;
    native.current.value = option.value;
    native.current.dispatchEvent(new Event("change", { bubbles: true }));
    close();
    trigger.current?.focus();
  }

  useLayoutEffect(() => {
    if (!open || !menu.current || !trigger.current) return;
    const list = menu.current;
    const button = trigger.current;
    function position() {
      const bounds = button.getBoundingClientRect();
      const viewport = window.visualViewport;
      const top = viewport?.offsetTop ?? 0;
      const left = viewport?.offsetLeft ?? 0;
      const width = viewport?.width ?? window.innerWidth;
      const height = viewport?.height ?? window.innerHeight;
      const below = top + height - bounds.bottom - 12;
      const above = bounds.top - top - 12;
      const placeAbove = below < 220 && above > below;
      const available = Math.max(0, placeAbove ? above : below);
      list.style.width = `${Math.min(Math.max(bounds.width, 192), width - 24)}px`;
      list.style.maxHeight = `${Math.min(320, available)}px`;
      list.style.left = `${Math.max(left + 12, Math.min(bounds.left, left + width - list.offsetWidth - 12))}px`;
      list.style.top = `${placeAbove ? bounds.top - list.offsetHeight - 6 : bounds.bottom + 6}px`;
    }
    list.showPopover?.();
    position();
    if (searchable) searchInput.current?.focus({ preventScroll: true });
    const handleScroll = (event: Event) => {
      if (!list.contains(event.target as Node)) position();
    };
    const dismiss = (event: PointerEvent) => {
      if (
        !list.contains(event.target as Node) &&
        !button.contains(event.target as Node)
      ) {
        list.hidePopover?.();
        setOpen(false);
      }
    };
    window.addEventListener("resize", position);
    window.addEventListener("scroll", handleScroll, true);
    window.visualViewport?.addEventListener("resize", position);
    window.visualViewport?.addEventListener("scroll", position);
    document.addEventListener("pointerdown", dismiss);
    const observer = new ResizeObserver(position);
    observer.observe(button);
    observer.observe(list);
    return () => {
      list.hidePopover?.();
      window.removeEventListener("resize", position);
      window.removeEventListener("scroll", handleScroll, true);
      window.visualViewport?.removeEventListener("resize", position);
      window.visualViewport?.removeEventListener("scroll", position);
      document.removeEventListener("pointerdown", dismiss);
      observer.disconnect();
    };
  }, [open, searchable]);

  useEffect(() => {
    if (open)
      menu.current
        ?.querySelector<HTMLElement>(`[data-index="${visibleActiveIndex}"]`)
        ?.scrollIntoView({ block: "nearest" });
  }, [open, visibleActiveIndex]);

  useEffect(() => {
    const select = native.current;
    const form = select?.form;
    if (!select || !form) return;
    const reset = (event: Event) => {
      queueMicrotask(() => {
        if (event.defaultPrevented) return;
        if (value !== undefined) select.value = String(value);
        else setInternalValue(select.value);
        setInvalid(false);
        setOpen(false);
      });
    };
    form.addEventListener("reset", reset);
    return () => form.removeEventListener("reset", reset);
  }, [value, props.form]);

  return (
    <>
      <button
        ref={trigger}
        id={triggerId}
        type="button"
        role={searchable ? undefined : "combobox"}
        aria-label={props["aria-label"]}
        aria-labelledby={props["aria-labelledby"]}
        aria-describedby={props["aria-describedby"]}
        aria-invalid={props["aria-invalid"] ?? (invalid || undefined)}
        aria-required={required || undefined}
        aria-expanded={open}
        aria-controls={menuId}
        aria-haspopup="listbox"
        aria-activedescendant={
          !searchable && open && activeIndex >= 0
            ? `${menuId}-${activeIndex}`
            : undefined
        }
        disabled={disabled}
        title={props.title}
        autoFocus={props.autoFocus}
        tabIndex={props.tabIndex}
        className={cn(
          "border-input text-foreground focus:border-primary focus:ring-primary/15 aria-invalid:border-destructive aria-invalid:ring-destructive/20 flex h-11 w-full min-w-0 items-center justify-between gap-3 rounded-lg border bg-white px-3 text-left text-sm font-normal shadow-xs transition-[border-color,box-shadow] outline-none hover:border-slate-400 focus:ring-3 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-50",
          open && "border-primary ring-primary/15 ring-3",
          className,
        )}
        onClick={() => (open ? close() : show())}
        onBlur={(event) => {
          if (open && !menu.current?.contains(event.relatedTarget)) close();
        }}
        onKeyDown={(event) => {
          if (
            event.nativeEvent.isComposing ||
            event.nativeEvent.keyCode === 229
          )
            return;
          if (
            searchable &&
            event.key.length === 1 &&
            event.key !== " " &&
            !event.ctrlKey &&
            !event.metaKey &&
            !event.altKey
          ) {
            event.preventDefault();
            show();
            setQuery(event.key);
            return;
          }
          if (event.key === "Tab") {
            close();
            return;
          }
          if (event.key === "Escape" && open) {
            event.preventDefault();
            event.stopPropagation();
            close();
            return;
          }
          if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
            event.preventDefault();
            const direction =
              event.key === "ArrowUp" || event.key === "End" ? -1 : 1;
            let index =
              event.key === "Home"
                ? -1
                : event.key === "End"
                  ? options.length
                  : open
                    ? activeIndex
                    : selectedIndex;
            if (
              !open &&
              (event.key === "ArrowDown" || event.key === "ArrowUp")
            ) {
              show();
              return;
            }
            do {
              index += direction;
            } while (
              index >= 0 &&
              index < options.length &&
              options[index].disabled
            );
            if (index >= 0 && index < options.length) {
              if (!open) show(index);
              else setActiveIndex(index);
            }
            return;
          }
          if (
            event.key === "Enter" ||
            (event.key === " " &&
              (!search.current.text || Date.now() - search.current.time > 700))
          ) {
            event.preventDefault();
            if (open) choose(activeIndex);
            else show();
            return;
          }
          if (
            event.key.length === 1 &&
            !event.ctrlKey &&
            !event.metaKey &&
            !event.altKey &&
            !event.nativeEvent.isComposing
          ) {
            event.preventDefault();
            const now = Date.now();
            search.current.text =
              now - search.current.time > 700
                ? event.key
                : search.current.text + event.key;
            search.current.time = now;
            const query = search.current.text.toLocaleLowerCase();
            const prefix = [...query].every(
              (character) => character === query[0],
            )
              ? query[0]
              : query;
            const start = open ? activeIndex : selectedIndex;
            const index = options.findIndex((_, offset) => {
              const option = options[(start + offset + 1) % options.length];
              return (
                !option.disabled &&
                option.label.toLocaleLowerCase().startsWith(prefix)
              );
            });
            if (index >= 0) {
              const match = (start + index + 1) % options.length;
              if (open) setActiveIndex(match);
              else show(match);
            }
          }
        }}
      >
        <span className="truncate">{selected?.label ?? "선택해 주세요"}</span>
        <ChevronDown
          aria-hidden="true"
          className={cn(
            "size-4 shrink-0 text-slate-500 transition-transform",
            open && "rotate-180",
          )}
        />
      </button>
      <select
        {...props}
        ref={(element) => {
          native.current = element;
          if (typeof ref === "function") return ref(element);
          if (ref) ref.current = element;
        }}
        hidden
        aria-hidden="true"
        tabIndex={-1}
        autoFocus={false}
        disabled={disabled}
        required={required}
        value={value}
        defaultValue={defaultValue}
        onChange={(event) => {
          setInternalValue(event.target.value);
          setInvalid(!event.target.validity.valid);
          onChange?.(event);
        }}
        onInvalid={(event) => {
          props.onInvalid?.(event);
          event.preventDefault();
          setInvalid(true);
          trigger.current?.focus();
          show();
        }}
      >
        {children}
      </select>
      <div
        ref={menu}
        popover="manual"
        hidden={!open}
        className={cn(
          "border-input text-foreground fixed inset-auto z-50 m-0 overflow-y-auto overscroll-contain rounded-xl border bg-white p-1.5 shadow-xl outline-none",
          searchable && open && "flex flex-col overflow-hidden",
        )}
        onBlur={(event) => {
          if (
            !event.currentTarget.contains(event.relatedTarget) &&
            event.relatedTarget !== trigger.current
          )
            close();
        }}
        onPointerDown={(event) => {
          if (!(event.target instanceof HTMLInputElement))
            event.preventDefault();
        }}
        onClick={(event) => {
          event.stopPropagation();
        }}
      >
        {searchable && (
          <input
            ref={searchInput}
            type="text"
            role="combobox"
            aria-label={
              props["aria-label"]
                ? `${props["aria-label"]} 검색`
                : searchPlaceholder
            }
            aria-describedby={props["aria-describedby"]}
            aria-expanded={open}
            aria-controls={menuId}
            aria-autocomplete="list"
            aria-activedescendant={
              open && visibleActiveIndex >= 0
                ? `${menuId}-${visibleActiveIndex}`
                : undefined
            }
            autoComplete="off"
            placeholder={searchPlaceholder}
            value={query}
            className="border-input focus:border-primary mb-1.5 h-10 w-full shrink-0 rounded-lg border bg-white px-3 text-sm outline-none"
            onChange={(event) => {
              setQuery(event.target.value);
              setActiveIndex(-1);
            }}
            onCompositionStart={() => {
              composing.current = true;
            }}
            onCompositionEnd={() => {
              composing.current = false;
            }}
            onKeyDown={(event) => {
              if (
                composing.current ||
                event.nativeEvent.isComposing ||
                event.nativeEvent.keyCode === 229
              )
                return;
              if (event.key === "Escape") {
                event.preventDefault();
                event.stopPropagation();
                close();
                trigger.current?.focus();
              } else if (event.key === "Tab") {
                // Continue normal tab navigation from the dropdown's trigger.
                trigger.current?.focus();
                close();
              } else if (event.key === "Enter") {
                event.preventDefault();
                choose(visibleActiveIndex);
              } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                event.preventDefault();
                const enabled = visibleOptions.filter(
                  (option) => !option.disabled,
                );
                const current = enabled.findIndex(
                  (option) => option.index === visibleActiveIndex,
                );
                const next = current + (event.key === "ArrowDown" ? 1 : -1);
                const option =
                  enabled[Math.max(0, Math.min(enabled.length - 1, next))];
                if (option) setActiveIndex(option.index);
              }
            }}
          />
        )}
        <div
          id={menuId}
          role="listbox"
          aria-label={props["aria-label"]}
          aria-labelledby={
            props["aria-labelledby"] ??
            (props["aria-label"] ? undefined : triggerId)
          }
          className={
            searchable
              ? "min-h-0 overflow-y-auto overscroll-contain"
              : undefined
          }
        >
          {visibleOptions.map((option) => (
            <div
              key={`${option.value}-${option.index}`}
              id={`${menuId}-${option.index}`}
              role="option"
              aria-selected={selectedValue === option.value}
              aria-disabled={option.disabled || undefined}
              data-index={option.index}
              className={cn(
                "flex min-h-10 cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-sm font-normal break-words",
                option.index === visibleActiveIndex && "bg-slate-100",
                selectedValue === option.value && "text-primary font-semibold",
                option.disabled && "cursor-not-allowed opacity-40",
              )}
              onPointerMove={() => {
                if (!option.disabled) setActiveIndex(option.index);
              }}
              onClick={() => choose(option.index)}
            >
              <span>{option.label}</span>
              {selectedValue === option.value && (
                <Check aria-hidden="true" className="size-4 shrink-0" />
              )}
            </div>
          ))}
        </div>
        {searchable && visibleOptions.length === 0 && (
          <p role="status" className="px-3 py-4 text-sm text-slate-500">
            검색 결과가 없습니다.
          </p>
        )}
      </div>
    </>
  );
}
