import { Link } from 'react-router-dom'
import { useFetch } from '../../hooks.js'
import { Empty, ErrorBox, Loading, PageHeader, StockBadge } from '../../components/ui.jsx'
import { qty } from '../../utils.js'

export default function LowStock() {
  const { data, error, loading } = useFetch('/inventory/low', { poll: 30000 })

  return (
    <>
      <PageHeader title="Low Stock" subtitle="Items at or below their reorder level, most urgent first." />
      <ErrorBox message={error} />
      {loading && !data ? <Loading /> : data?.length === 0 ? <Empty>Every item is above its reorder level.</Empty> : (
        <div className="table-wrap">
          <table className="low-stock-table">
            <thead><tr><th>Item</th><th>Status</th><th className="num">On hand</th><th className="num">Reorder level</th><th className="num">Short by</th><th className="low-stock-action-heading" aria-label="Actions"></th></tr></thead>
            <tbody>
              {data?.map((i) => (
                <tr key={i.id}>
                  <td><strong>{i.name}</strong>{i.is_fresh ? <span className="tag">Fresh</span> : null}</td>
                  <td><StockBadge status={i.stock_status} /></td>
                  <td className="num">{qty(i.quantity)} {i.unit}</td>
                  <td className="num muted">{qty(i.reorder_level)} {i.unit}</td>
                  <td className="num">{qty(i.shortage)} {i.unit}</td>
                  <td className="low-stock-action-cell"><Link className="link" to={`/inventory/stock-in?item=${i.id}`}>Stock in</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
