import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

// Footlink DS (components/core/Button.jsx): radius 8px, 14px/600; botões
// coloridos não mudam de cor no hover — só ganham sombra; foco é o anel roxo
// de 3px a 12%, nunca outline. "default" = primário roxo; "secondary" =
// branco com borda roxa; "white" = branco com borda cinza (ex.: "Salvar
// rascunho", "Renegociar" no handoff).
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-lg border bg-clip-padding text-sm font-semibold whitespace-nowrap transition-all duration-200 ease-in-out outline-none select-none focus-visible:shadow-focus disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:shadow-focus-error [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground hover:shadow-btn-hover",
        outline:
          "border-lightPurple1 bg-transparent text-purple-text hover:bg-lightPurple4",
        secondary:
          "border-lightPurple1 bg-surface text-purple-text hover:shadow-btn-hover",
        white:
          "border-gray5 bg-surface text-purple-text hover:shadow-btn-hover",
        ghost:
          "border-transparent bg-transparent text-foreground hover:bg-accent",
        destructive:
          "border-transparent bg-destructive text-white hover:shadow-btn-hover",
        link: "border-transparent bg-transparent text-purple-text p-0! h-auto! underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 gap-1.5 px-5",
        xs: "h-7 gap-1 px-3 text-xs",
        sm: "h-[34px] gap-1.5 px-4 text-[13px]",
        lg: "h-12 gap-2 px-7 text-base",
        icon: "size-10",
        "icon-xs": "size-7",
        "icon-sm": "size-8",
        "icon-lg": "size-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
