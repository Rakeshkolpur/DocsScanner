import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ScanLine, FileText, Trash2 } from 'lucide-react'
import { listDocuments, deleteDocument, type StoredDocument } from '../lib/docStore'
import './HomePage.css'

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function HomePage() {
  const [docs, setDocs] = useState<StoredDocument[] | null>(null)

  useEffect(() => {
    refresh()
  }, [])

  function refresh() {
    listDocuments().then(setDocs)
  }

  async function handleDelete(e: React.MouseEvent, id: string) {
    e.preventDefault()
    e.stopPropagation()
    if (!confirm('Delete this document? This cannot be undone.')) return
    await deleteDocument(id)
    refresh()
  }

  return (
    <div className="container docs-page">
      <div className="docs-page__header">
        <h1>My Documents</h1>
        {docs && docs.length > 0 && (
          <span className="docs-page__count">{docs.length} doc{docs.length === 1 ? '' : 's'}</span>
        )}
      </div>

      {docs === null && <p className="tool-hint">Loading…</p>}

      {docs !== null && docs.length === 0 && (
        <div className="docs-page__empty">
          <FileText size={36} strokeWidth={1.25} />
          <h2>No documents yet</h2>
          <p>Scan your first document — it'll show up here.</p>
          <Link to="/scan" className="btn btn-primary">
            <ScanLine size={16} /> Scan a document
          </Link>
        </div>
      )}

      {docs !== null && docs.length > 0 && (
        <div className="docs-page__list">
          {docs.map((doc) => (
            <Link to={`/doc/${doc.id}`} key={doc.id} className="docs-page__item">
              <div className="docs-page__thumb">
                {doc.pages[0] && <img src={doc.pages[0].dataUrl} alt="" />}
              </div>
              <div className="docs-page__meta">
                <span className="docs-page__name">{doc.name}</span>
                <span className="docs-page__sub">
                  {doc.pages.length} page{doc.pages.length === 1 ? '' : 's'} · {formatDate(doc.updatedAt)}
                </span>
              </div>
              <button className="docs-page__delete" onClick={(e) => handleDelete(e, doc.id)} aria-label="Delete document">
                <Trash2 size={16} />
              </button>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
