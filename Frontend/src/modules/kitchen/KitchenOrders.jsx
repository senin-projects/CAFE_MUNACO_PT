import { useSearchParams } from 'react-router-dom'
import KitchenQueue from './KitchenQueue.jsx'

const ORDER_STAGES = [
  { status: 'sent', label: 'Incoming' },
  { status: 'preparing', label: 'Preparing' },
  { status: 'ready', label: 'Ready' },
]

export default function KitchenOrders() {
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedStatus = searchParams.get('status')
  const activeStatus = ORDER_STAGES.some((stage) => stage.status === requestedStatus) ? requestedStatus : 'sent'
  const activeStage = ORDER_STAGES.find((stage) => stage.status === activeStatus)

  const toolbar = (
    <div className="stock-tabs kitchen-status-tabs" role="tablist" aria-label="Filter orders by status">
      {ORDER_STAGES.map((stage) => (
        <button
          key={stage.status}
          type="button"
          role="tab"
          className={activeStatus === stage.status ? 'active' : ''}
          aria-selected={activeStatus === stage.status}
          onClick={() => setSearchParams({ status: stage.status })}
        >
          {stage.label}
        </button>
      ))}
    </div>
  )

  const emptyMessages = {
    sent: 'No new orders. They appear here as soon as the cashier sends them.',
    preparing: 'Nothing is being prepared right now.',
    ready: 'No orders are waiting for service.',
  }

  return <KitchenQueue status={activeStatus} title="Orders" empty={emptyMessages[activeStatus]} toolbar={toolbar} />
}
