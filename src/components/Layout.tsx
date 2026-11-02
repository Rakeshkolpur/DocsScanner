import { Link } from 'react-router-dom'
import { FileText } from 'lucide-react'
import type { ReactNode } from 'react'
import { BottomNav } from './BottomNav'
import './Layout.css'

export function Layout({ children }: { children: ReactNode }) {
  return (
    <>
      <header className="app-header">
        <div className="container app-header__inner">
          <Link to="/" className="app-header__brand">
            <FileText size={20} strokeWidth={2.25} />
            <span className="app-header__title">FileQuik</span>
          </Link>
        </div>
      </header>
      <main className="app-main">{children}</main>
      <BottomNav />
    </>
  )
}
