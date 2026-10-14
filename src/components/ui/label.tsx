"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

// variante "campo" = rótulo micro do Footlink DS acima de inputs/selects
// (11px/700, maiúsculas, +0.06em, --gray). "padrao" fica para rótulos
// inline, ao lado de checkboxes.
function Label({
  className,
  variante = "padrao",
  ...props
}: React.ComponentProps<"label"> & { variante?: "padrao" | "campo" }) {
  return (
    <label
      data-slot="label"
      className={cn(
        "flex items-center gap-2 select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
        variante === "campo"
          ? "text-[11px] leading-tight font-bold tracking-[0.06em] text-gray uppercase"
          : "text-sm leading-none font-medium",
        className
      )}
      {...props}
    />
  )
}

export { Label }
