"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, ToasterProps } from "sonner"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme="light"
      className="toaster group"
      toastOptions={{
        style: {
          background: '#a7f3d0', // mint green
          color: '#000000', // black text
          border: '1px solid #000000', // black border
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
