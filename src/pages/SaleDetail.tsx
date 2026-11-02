import { useNavigate, useParams } from 'react-router-dom'
import { adminApiService, SaleDetail as SaleDetailData } from '../services/api'
import { useCachedQuery } from '../hooks/useCachedQuery'
import { saleKey } from '../services/queryKeys'
import { ArrowLeft, Loader2 } from 'lucide-react'

const num = (n: number | null | undefined) =>
  Number(n ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const when = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString(undefined, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'

const Th: React.FC<{ children?: React.ReactNode; right?: boolean }> = ({ children, right }) => (
  <th className={`px-3 py-2 font-semibold ${right ? 'text-right' : ''}`}>{children}</th>
)

const Card: React.FC<{ title?: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
    {title && <div className="px-5 py-3 border-b border-gray-100 text-sm font-bold text-gray-900">{title}</div>}
    {children}
  </div>
)

const SaleDetail: React.FC = () => {
  const navigate = useNavigate()
  const { saleId = '' } = useParams()
  const { data: sale, loading, error } = useCachedQuery<SaleDetailData>(saleKey(saleId), () => adminApiService.getRestaurantSale(saleId))

  // Go back to wherever the user came from (a report), or to the reports page when opened directly
  const back = () => (window.history.state?.idx > 0 ? navigate(-1) : navigate('/restaurant/reports/transactions'))

  const totals: Array<[string, number, boolean?]> = sale
    ? [
        ['Subtotal', sale.subtotal],
        ...(sale.discountAmount ? [[`Discount${sale.discountReason ? ` (${sale.discountReason})` : ''}`, -sale.discountAmount] as [string, number]] : []),
        ['Tax (included)', sale.taxAmount],
        ['Total', sale.total, true],
        ...(sale.refundedAmount ? [['Refunded', sale.refundedAmount] as [string, number]] : []),
      ]
    : []

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={back} className="p-1.5 rounded-lg hover:bg-gray-100" aria-label="Back">
          <ArrowLeft className="h-4 w-4 text-gray-600" />
        </button>
        <div>
          <h1 className="text-lg font-bold text-gray-900">Sale {sale?.receiptNumber ?? ''}</h1>
          {sale && <p className="text-xs text-gray-500">{sale.saleReference}</p>}
        </div>
      </div>

      {loading ? (
        <div className="py-16 text-center text-gray-400"><Loader2 className="h-5 w-5 animate-spin inline" /></div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-4 py-2">{error}</div>
      ) : sale ? (
        <>
          <Card>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-3 text-xs p-5">
              {[
                ['Sold by', sale.staffName],
                ['Sale time', when(sale.occurredAtUtc)],
                ['Service', sale.serviceNumber || '—'],
                ['Seat / table', sale.seatNumber || sale.tableNumber || '—'],
                ['Device', sale.deviceCode],
                ['Status', sale.status],
                ['Payment', sale.paymentState],
                ['Source', sale.capturedOffline ? 'Captured offline' : 'Online'],
              ].map(([k, v]) => (
                <div key={k}><span className="text-gray-400">{k}</span><div className="text-gray-800 font-medium">{v}</div></div>
              ))}
            </div>
            {sale.requiresReview && (
              <div className="bg-amber-50 border-t border-amber-200 text-amber-800 text-xs px-5 py-2">
                Flagged for review{sale.reviewReason ? `: ${sale.reviewReason}` : ''}
              </div>
            )}
          </Card>

          <Card title="Items sold">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 text-gray-500 text-left">
                  <tr><Th>Item</Th><Th>Code</Th><Th right>Qty</Th><Th right>Unit price</Th><Th right>Tax %</Th><Th right>Tax</Th><Th right>Total</Th></tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {sale.items.length === 0 ? (
                    <tr><td colSpan={7} className="px-3 py-8 text-center text-gray-400">No items.</td></tr>
                  ) : sale.items.map((i, idx) => (
                    <tr key={`${i.menuItemId}-${idx}`}>
                      <td className="px-3 py-2 font-medium text-gray-900">{i.itemName}</td>
                      <td className="px-3 py-2 font-mono text-gray-600">{i.itemCode}</td>
                      <td className="px-3 py-2 text-right">{i.quantity}</td>
                      <td className="px-3 py-2 text-right">
                        {num(i.unitPrice)}
                        {i.unitPrice !== i.catalogUnitPrice && <div className="text-[10px] text-amber-600">catalog {num(i.catalogUnitPrice)}</div>}
                      </td>
                      <td className="px-3 py-2 text-right">{i.taxRatePercent}%</td>
                      <td className="px-3 py-2 text-right">{num(i.lineTax)}</td>
                      <td className="px-3 py-2 text-right font-semibold">{num(i.lineTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="ml-auto max-w-xs space-y-1 text-xs p-5">
              {totals.map(([k, v, strong]) => (
                <div key={k} className={`flex justify-between ${strong ? 'border-t border-gray-200 pt-1.5 text-sm font-bold text-gray-900' : 'text-gray-600'}`}>
                  <span>{k}</span><span>{num(v)}</span>
                </div>
              ))}
            </div>
          </Card>

          {sale.payments.length > 0 && (
            <Card title="Payments">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 text-gray-500 text-left">
                    <tr><Th>Method</Th><Th right>Amount</Th><Th right>Tendered</Th><Th right>Change</Th><Th>Reference</Th><Th>Status</Th><Th>Confirmed</Th></tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {sale.payments.map(p => (
                      <tr key={p.id}>
                        <td className="px-3 py-2 font-medium">{p.methodCode}</td>
                        <td className="px-3 py-2 text-right">{num(p.amount)}</td>
                        <td className="px-3 py-2 text-right">{p.tenderedAmount != null ? num(p.tenderedAmount) : '—'}</td>
                        <td className="px-3 py-2 text-right">{p.changeGiven != null ? num(p.changeGiven) : '—'}</td>
                        <td className="px-3 py-2 text-gray-600">{p.reference || '—'}</td>
                        <td className="px-3 py-2">{p.status}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{when(p.confirmedAtUtc)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {sale.adjustments.length > 0 && (
            <Card title="Voids & refunds">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 text-gray-500 text-left">
                    <tr><Th>Type</Th><Th right>Amount</Th><Th>Method</Th><Th>Reason</Th><Th>By</Th><Th>When</Th></tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {sale.adjustments.map(a => (
                      <tr key={a.id}>
                        <td className="px-3 py-2 font-medium">{a.type}</td>
                        <td className="px-3 py-2 text-right">{num(a.amount)}</td>
                        <td className="px-3 py-2">{a.paymentMethodCode || '—'}</td>
                        <td className="px-3 py-2 text-gray-600">{a.reason || '—'}</td>
                        <td className="px-3 py-2">{a.actorName || '—'}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{when(a.occurredAtUtc)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {sale.notes && <p className="text-xs text-gray-600"><span className="text-gray-400">Notes</span> {sale.notes}</p>}
        </>
      ) : null}
    </div>
  )
}

export default SaleDetail
