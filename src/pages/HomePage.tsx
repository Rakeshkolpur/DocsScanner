import { Link } from 'react-router-dom'
import {
  ScanLine,
  Images,
  Scissors,
  Combine,
  Stamp,
  RotateCw,
  ListOrdered,
  FileOutput,
} from 'lucide-react'
import './HomePage.css'

const primaryActions = [
  { to: '/scan', icon: ScanLine, title: 'Scan Document', desc: 'Capture with your camera and export a clean PDF.' },
  { to: '/images-to-pdf', icon: Images, title: 'Images to PDF', desc: 'Turn photos or screenshots into a PDF.' },
]

const secondaryTools = [
  { to: '/split', icon: Scissors, title: 'Split PDF', desc: 'Break a PDF into pages or custom ranges.' },
  { to: '/merge', icon: Combine, title: 'Merge PDF', desc: 'Combine multiple PDFs into one file.' },
  { to: '/watermark', icon: Stamp, title: 'Add Watermark', desc: 'Stamp your own text or logo — nothing forced.' },
  { to: '/rotate', icon: RotateCw, title: 'Rotate Pages', desc: 'Fix sideways or upside-down pages.' },
  { to: '/reorder', icon: ListOrdered, title: 'Reorder Pages', desc: 'Drag pages into the right order, or delete some.' },
  { to: '/extract', icon: FileOutput, title: 'Extract Pages', desc: 'Pull out the pages you need.' },
]

export default function HomePage() {
  return (
    <div className="container home">
      <section className="home__hero">
        <h1>Documents, simplified.</h1>
        <p>Scan, organize and manage your documents without unnecessary complications.</p>
      </section>

      <section className="home__primary">
        {primaryActions.map(({ to, icon: Icon, title, desc }) => (
          <Link key={to} to={to} className="home__primary-card">
            <Icon size={26} strokeWidth={1.75} />
            <div>
              <h2>{title}</h2>
              <p>{desc}</p>
            </div>
          </Link>
        ))}
      </section>

      <section className="home__secondary">
        <h3 className="home__section-title">PDF Tools</h3>
        <div className="home__grid">
          {secondaryTools.map(({ to, icon: Icon, title, desc }) => (
            <Link key={to} to={to} className="home__tool-card">
              <Icon size={20} strokeWidth={1.75} />
              <div>
                <h4>{title}</h4>
                <p>{desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}
