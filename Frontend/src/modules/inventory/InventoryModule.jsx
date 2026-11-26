import { useSearchParams } from 'react-router-dom'
import { PageHeader } from '../../components/ui.jsx'
import InventoryList from './InventoryList.jsx'
import StockHistory from './StockHistory.jsx'

const TABS = [
  { id: 'overview', label: 'Inventory Overview' },
  { id: 'history', label: 'Stock History' },
]

export default function InventoryModule({ readOnly = true }) {
  const [params, setParams] = useSearchParams()
  const activeTab = TABS.some((tab) => tab.id === params.get('tab')) ? params.get('tab') : 'overview'

  function selectTab(tab) {
    const next = new URLSearchParams(params)
    next.set('tab', tab)
    setParams(next)
  }

  return (
    <>
      <PageHeader title="Inventory" />
      <div className="stock-tabs inventory-module-tabs" role="tablist" aria-label="Inventory">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            id={`inventory-tab-${tab.id}`}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`inventory-panel-${tab.id}`}
            className={activeTab === tab.id ? 'active' : ''}
            onClick={() => selectTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <section id="inventory-panel-overview" role="tabpanel" aria-labelledby="inventory-tab-overview" hidden={activeTab !== 'overview'}>
        <InventoryList readOnly={readOnly} embedded />
      </section>
      <section id="inventory-panel-history" role="tabpanel" aria-labelledby="inventory-tab-history" hidden={activeTab !== 'history'}>
        <StockHistory embedded />
      </section>
    </>
  )
}
