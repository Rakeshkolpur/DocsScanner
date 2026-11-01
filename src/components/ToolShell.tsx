import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import './ToolShell.css'

interface ToolShellProps {
  title: string
  description: string
  children: ReactNode
}

export function ToolShell({ title, description, children }: ToolShellProps) {
  return (
    <div className="container tool-shell">
      <Link to="/" className="tool-shell__back">
        <ArrowLeft size={14} /> Back to all tools
      </Link>
      <div className="tool-shell__header">
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {children}
    </div>
  )
}

export function ErrorBanner({ message }: { message: string }) {
  return <div className="tool-banner tool-banner--error">{message}</div>
}

export function SuccessBanner({ message }: { message: string }) {
  return <div className="tool-banner tool-banner--success">{message}</div>
}
