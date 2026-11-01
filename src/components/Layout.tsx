import { Link } from 'react-router-dom'
import { ShieldCheck, FileText } from 'lucide-react'
import type { ReactNode } from 'react'
import './Layout.css'

export function Layout({ children }: { children: ReactNode }) {
  return (
    <>
      <header className="app-header">
        <div className="container app-header__inner">
          <Link to="/" className="app-header__brand">
            <FileText size={20} strokeWidth={2.25} />
            <span className="app-header__title">
              FileQuik <span className="app-header__subtitle">Scan &amp; PDF Studio</span>
            </span>
          </Link>
          <div className="app-header__privacy" title="All processing happens in your browser. Nothing is uploaded.">
            <ShieldCheck size={16} />
            <span>Private &amp; offline</span>
          </div>
        </div>
      </header>
      <main className="app-main">{children}</main>
      <footer className="app-footer">
        <div className="container app-footer__inner">
          <span>FileQuik — Your Documents. Your Control.</span>
          <span className="app-footer__dot">No account. No uploads. No tracking.</span>
        </div>
      </footer>
    </>
  )
}
