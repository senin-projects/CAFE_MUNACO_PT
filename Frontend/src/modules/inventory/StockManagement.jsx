import { useSearchParams } from 'react-router-dom'
import { PageHeader } from '../../components/ui.jsx'
import StockForm from './StockForm.jsx'
import StockHistory from './StockHistory.jsx'

const TABS = [
  { id: 'in', label: 'Stock In' },
  { id: 'out', label: 'Stock Out' },
  { id: 'history', label: 'Stock History' },
]

export default function StockManagement() {
  const [params, setParams] = useSearchParams()
  const activeTab = TABS.some((tab) => tab.id === params.get('tab')) ? params.get('tab') : 'in'

  function selectTab(tab) {
    const next = new URLSearchParams(params)
    next.set('tab', tab)
    setParams(next)
  }

  return (
    <>
      <PageHeader title="Stock Management" />
      <div className="stock-tabs" role="tablist" aria-label="Stock management">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            id={`stock-tab-${tab.id}`}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`stock-panel-${tab.id}`}
            className={activeTab === tab.id ? 'active' : ''}
            onClick={() => selectTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <section id="stock-panel-in" role="tabpanel" aria-labelledby="stock-tab-in" hidden={activeTab !== 'in'}>
        <StockForm type="in" embedded />
      </section>
      <section id="stock-panel-out" role="tabpanel" aria-labelledby="stock-tab-out" hidden={activeTab !== 'out'}>
        <StockForm type="out" embedded />
      </section>
      <section id="stock-panel-history" role="tabpanel" aria-labelledby="stock-tab-history" hidden={activeTab !== 'history'}>
        <StockHistory embedded />
      </section>
    </>
  )
}
