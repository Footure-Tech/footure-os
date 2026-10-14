"use client"

import { Toaster as Sonner, type ToasterProps } from "sonner"
import { MdCheckCircle, MdError, MdInfo, MdWarning } from "react-icons/md"
import { Loader2Icon } from "lucide-react"
import { useTema } from "@/hooks/use-tema"

// Toast do handoff Footure Gestão: escuro (#09001a) nos dois temas, texto
// branco 14px/600, centralizado embaixo, some após 2,6s. A cor do ícone é o
// que diferencia sucesso/erro/aviso.
const Toaster = ({ ...props }: ToasterProps) => {
  const { tema } = useTema()

  return (
    <Sonner
      theme={tema}
      position="bottom-center"
      duration={2600}
      offset={24}
      className="toaster group"
      icons={{
        success: <MdCheckCircle className="size-[18px] text-green3" />,
        info: <MdInfo className="size-[18px] text-info" />,
        warning: <MdWarning className="size-[18px] text-orange" />,
        error: <MdError className="size-[18px] text-danger" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "#09001a",
          "--normal-text": "#ffffff",
          "--normal-border": "transparent",
          "--border-radius": "8px",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast !gap-2.5 !px-[18px] !py-3 !shadow-toast",
          title: "!text-sm !font-semibold",
          description: "!text-white/70",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
