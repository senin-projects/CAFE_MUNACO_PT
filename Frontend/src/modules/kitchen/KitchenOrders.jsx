import { useSearchParams } from 'react-router-dom'
import KitchenQueue from './KitchenQueue.jsx'

const ORDER_STAGES = [
  { status: 'sent', label: 'Incoming', className: 'incoming' },
  { status: 'preparing', label: 'Preparing', className: 'preparing' },
  { status: 'ready', label: 'Ready', className: 'ready' },
]

export default function KitchenOrders() {
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedStatus = searchParams.get('status')
  const activeStatus = ORDER_STAGES.some((stage) => stage.status === requestedStatus) ? requestedStatus : 'sent'
  const activeStage = ORDER_STAGES.find((stage) => stage.status === activeStatus)

  const toolbar = (
    <div className="kitchen-status-tabs" role="group" aria-label="Filter orders by status">
      {ORDER_STAGES.map((stage) => (
        <button
          key={stage.status}
          type="button"
          className={`btn kitchen-status-button kitchen-status-${stage.className}`}
          aria-pressed={activeStatus === stage.status}
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
