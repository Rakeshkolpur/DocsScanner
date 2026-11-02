import { Link } from 'react-router-dom'
import {
  Images,
  Scissors,
  Combine,
  Stamp,
  RotateCw,
  ListOrdered,
  FileOutput,
} from 'lucide-react'
import './ToolsPage.css'

const tools = [
  { to: '/images-to-pdf', icon: Images, label: 'Images to PDF' },
  { to: '/split', icon: Scissors, label: 'Split PDF' },
  { to: '/merge', icon: Combine, label: 'Merge PDF' },
  { to: '/watermark', icon: Stamp, label: 'Watermark' },
  { to: '/rotate', icon: RotateCw, label: 'Rotate Pages' },
  { to: '/reorder', icon: ListOrdered, label: 'Reorder Pages' },
  { to: '/extract', icon: FileOutput, label: 'Extract Pages' },
]

export default function ToolsPage() {
  return (
    <div className="container tools-page">
      <h1 className="tools-page__title">Tools</h1>
      <div className="tools-page__grid">
        {tools.map(({ to, icon: Icon, label }) => (
          <Link key={to} to={to} className="tools-page__card">
            <span className="tools-page__icon">
              <Icon size={22} strokeWidth={1.75} />
            </span>
            <span className="tools-page__label">{label}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
