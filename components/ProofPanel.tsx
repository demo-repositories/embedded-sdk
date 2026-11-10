'use client'

import { useState } from 'react'
import DocList, { type DocRow } from './DocList'
import TitleEditor from './TitleEditor'

export default function ProofPanel() {
  const [selected, setSelected] = useState<DocRow | null>(null)

  return (
    <>
      <h2>Documents (production, 10 most recent)</h2>
      <DocList onSelect={setSelected} />
      {selected ? (
        <TitleEditor key={selected._id} documentId={selected._id} documentType={selected._type} />
      ) : null}
    </>
  )
}
