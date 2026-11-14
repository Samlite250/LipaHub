import type { ReactNode } from 'react'

const markers = /(\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*)/g

export function renderInstructions(text: string): ReactNode {
  return text.split(markers).filter(Boolean).map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) return <strong key={index}>{part.slice(2, -2)}</strong>
    if (part.startsWith('__') && part.endsWith('__') && part.length > 4) return <u key={index}>{part.slice(2, -2)}</u>
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) return <em key={index}>{part.slice(1, -1)}</em>
    return part
  })
}
