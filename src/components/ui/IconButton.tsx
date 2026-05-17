import type { ReactNode, MouseEvent } from "react";

export function IconButton({
  children,
  title,
  onClick
}: {
  children: ReactNode;
  title: string;
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
}) {
  return (
    <button
      className="inline-flex h-7 w-7 items-center justify-center rounded text-[#42526e] hover:bg-[#ebecf0] hover:text-[#172b4d]"
      title={title}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
