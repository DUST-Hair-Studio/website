"use client"

import { Toaster as Sonner, ToasterProps } from "sonner"

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      toastOptions={{
        style: {
          background: '#04D96A',
          color: '#000000', // black text
          border: '1px solid #000000', // black border
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
