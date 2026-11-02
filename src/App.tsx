import { Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Layout } from './components/Layout'
import { PageLoading } from './components/PageLoading'

const HomePage = lazy(() => import('./pages/HomePage'))
const ToolsPage = lazy(() => import('./pages/ToolsPage'))
const DocumentViewPage = lazy(() => import('./pages/DocumentViewPage'))
const ScannerPage = lazy(() => import('./pages/ScannerPage'))
const ImagesToPdfPage = lazy(() => import('./pages/ImagesToPdfPage'))
const SplitPage = lazy(() => import('./pages/SplitPage'))
const MergePage = lazy(() => import('./pages/MergePage'))
const WatermarkPage = lazy(() => import('./pages/WatermarkPage'))
const RotatePage = lazy(() => import('./pages/RotatePage'))
const ReorderPage = lazy(() => import('./pages/ReorderPage'))
const ExtractPage = lazy(() => import('./pages/ExtractPage'))

function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Suspense fallback={<PageLoading />}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/tools" element={<ToolsPage />} />
            <Route path="/doc/:id" element={<DocumentViewPage />} />
            <Route path="/scan" element={<ScannerPage />} />
            <Route path="/images-to-pdf" element={<ImagesToPdfPage />} />
            <Route path="/split" element={<SplitPage />} />
            <Route path="/merge" element={<MergePage />} />
            <Route path="/watermark" element={<WatermarkPage />} />
            <Route path="/rotate" element={<RotatePage />} />
            <Route path="/reorder" element={<ReorderPage />} />
            <Route path="/extract" element={<ExtractPage />} />
          </Routes>
        </Suspense>
      </Layout>
    </BrowserRouter>
  )
}

export default App
