import { NavLink } from 'react-router-dom'
import { FileStack, ScanLine, Grid3x3 } from 'lucide-react'
import './BottomNav.css'

export function BottomNav() {
  return (
    <nav className="bottom-nav">
      <NavLink to="/" end className={({ isActive }) => `bottom-nav__item${isActive ? ' bottom-nav__item--active' : ''}`}>
        <FileStack size={20} />
        <span>Docs</span>
      </NavLink>
      <NavLink to="/scan" className={({ isActive }) => `bottom-nav__fab${isActive ? ' bottom-nav__fab--active' : ''}`}>
        <ScanLine size={22} />
      </NavLink>
      <NavLink to="/tools" className={({ isActive }) => `bottom-nav__item${isActive ? ' bottom-nav__item--active' : ''}`}>
        <Grid3x3 size={20} />
        <span>Tools</span>
      </NavLink>
    </nav>
  )
}
