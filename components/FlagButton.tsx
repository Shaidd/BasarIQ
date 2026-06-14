'use client'

import { useState } from 'react'
import FlagModal from './FlagModal'

type Props = {
  observationId: string
  vendorName: string
  pricePerKg: number
  observedAt: string
}

export default function FlagButton({ observationId, vendorName, pricePerKg, observedAt }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Report this observation"
        className="text-gray-300 hover:text-red-400 transition-colors text-xs"
        aria-label="Report observation"
      >
        🚩
      </button>
      {open && (
        <FlagModal
          observationId={observationId}
          vendorName={vendorName}
          pricePerKg={pricePerKg}
          observedAt={observedAt}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}
