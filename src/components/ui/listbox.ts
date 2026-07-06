import { useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";

export function getNextListboxOptionValue(options: string[], currentValue: string, direction: 1 | -1): string | null {
  if (!options.length) return null;
  const selectedIndex = Math.max(0, options.indexOf(currentValue));
  const nextIndex = (selectedIndex + direction + options.length) % options.length;
  return options[nextIndex];
}

export function useListboxDropdown({
  disabled = false,
  onChange,
  onOpen,
  options,
  value
}: {
  disabled?: boolean;
  onChange: (value: string) => void | Promise<void>;
  onOpen?: () => void;
  options: string[];
  value: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const canOpen = !disabled && options.length > 0;

  useEffect(() => {
    if (!isOpen) return;

    function closeOnOutsideClick(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    window.addEventListener("mousedown", closeOnOutsideClick);
    return () => window.removeEventListener("mousedown", closeOnOutsideClick);
  }, [isOpen]);

  function closeMenu() {
    setIsOpen(false);
  }

  function openMenu() {
    if (!canOpen) return;
    onOpen?.();
    setIsOpen(true);
  }

  function toggleMenu() {
    if (!canOpen) return;
    if (isOpen) {
      closeMenu();
      return;
    }
    openMenu();
  }

  function choose(nextValue: string) {
    void onChange(nextValue);
    closeMenu();
  }

  function moveSelection(direction: 1 | -1) {
    const nextValue = getNextListboxOptionValue(options, value, direction);
    if (nextValue) void onChange(nextValue);
  }

  function handleButtonKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!isOpen) {
        openMenu();
        return;
      }
      moveSelection(1);
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (!isOpen) {
        openMenu();
        return;
      }
      moveSelection(-1);
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      toggleMenu();
    }

    if (event.key === "Escape") {
      closeMenu();
    }
  }

  function getOptionProps(option: string) {
    return {
      "aria-selected": option === value,
      onClick: () => choose(option),
      role: "option" as const
    };
  }

  return {
    buttonProps: {
      "aria-controls": isOpen ? listboxId : undefined,
      "aria-expanded": isOpen,
      "aria-haspopup": "listbox" as const,
      onKeyDown: handleButtonKeyDown
    },
    closeMenu,
    containerRef,
    getOptionProps,
    isOpen,
    listboxProps: {
      id: listboxId,
      role: "listbox" as const
    },
    openMenu,
    setIsOpen,
    toggleMenu
  };
}
