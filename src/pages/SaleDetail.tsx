import { useNavigate, useParams } from 'react-router-dom'
import { adminApiService, SaleDetail as SaleDetailData } from '../services/api'
import { useCachedQuery } from '../hooks/useCachedQuery'
import { saleKey } from '../services/queryKeys'
import { ArrowLeft, AlertTriangle, Loader2, LucideIcon, RefreshCw, Smartphone, User, Wifi, WifiOff } from 'lucide-react'

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

const STATUS_STYLES: Record<string, string> = {
  Completed: 'bg-green-100 text-green-700',
  Voided: 'bg-red-100 text-red-700',
  Refunded: 'bg-amber-100 text-amber-700',
  PartiallyRefunded: 'bg-amber-100 text-amber-700',
}
const PAYMENT_STYLES: Record<string, string> = {
  Confirmed: 'bg-green-100 text-green-700',
  Pending: 'bg-amber-100 text-amber-700',
  Failed: 'bg-red-100 text-red-700',
}
const ADJUSTMENT_STYLES: Record<string, string> = {
  Void: 'bg-red-100 text-red-700',
  Refund: 'bg-amber-100 text-amber-700',
}
const Badge: React.FC<{ value: string; styles: Record<string, string> }> = ({ value, styles }) => (
  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap ${styles[value] ?? 'bg-gray-100 text-gray-600'}`}>{value}</span>
)

// The sale's overall payment state isn't the same closed enum as a single payment's status (Confirmed/Pending/Failed),
// so match it by keyword instead of an exact lookup that would otherwise just fall back to gray.
const paymentStateStyle = (state: string) => {
  const s = state.toLowerCase()
  if (s.includes('refund')) return 'bg-amber-100 text-amber-700'
  if (s.includes('unpaid') || s.includes('fail') || s.includes('declin')) return 'bg-red-100 text-red-700'
  if (s.includes('partial') || s.includes('pending') || s.includes('await')) return 'bg-amber-100 text-amber-700'
  if (s.includes('paid') || s.includes('complete') || s.includes('confirm')) return 'bg-green-100 text-green-700'
  return 'bg-gray-100 text-gray-600'
}
const PaymentStateBadge: React.FC<{ value: string }> = ({ value }) => (
  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap ${paymentStateStyle(value)}`}>{value}</span>
)

const SaleDetail: React.FC = () => {
  const navigate = useNavigate()
  const { saleId = '' } = useParams()
  const { data: sale, loading, error, refetch, refreshing } = useCachedQuery<SaleDetailData>(saleKey(saleId), () => adminApiService.getRestaurantSale(saleId))

  // Go back to wherever the user came from (a report), or to the reports page when opened directly
  const back = () => (window.history.state?.idx > 0 ? navigate(-1) : navigate('/restaurant/reports/transactions'))

  const totals: Array<[string, number, boolean?]> = sale
    ? [
        ['Subtotal', sale.subtotal - sale.taxAmount],
        ...(sale.discountAmount ? [[`Discount${sale.discountReason ? ` (${sale.discountReason})` : ''}`, -sale.discountAmount] as [string, number]] : []),
        ['Tax', sale.taxAmount],
        ['Total', sale.total, true],
        ...(sale.refundedAmount ? [['Refunded', sale.refundedAmount] as [string, number]] : []),
      ]
    : []

  const meta: Array<[string, string, LucideIcon | null]> = sale
    ? [
        ['Sold by', sale.staffName, User],
        ['Sale time', when(sale.occurredAtUtc), null],
        ['Service', sale.serviceNumber || '—', null],
        ['Seat / table', sale.seatNumber || sale.tableNumber || '—', null],
        ['Device', sale.deviceCode, Smartphone],
        ['Source', sale.capturedOffline ? 'Captured offline' : 'Online', sale.capturedOffline ? WifiOff : Wifi],
      ]
    : []

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <button onClick={back} className="p-1.5 rounded-lg hover:bg-gray-100 mt-0.5" aria-label="Back">
          <ArrowLeft className="h-4 w-4 text-gray-600" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-bold text-gray-900">Sale {sale?.receiptNumber ?? ''}</h1>
            {sale && <Badge value={sale.status} styles={STATUS_STYLES} />}
            {sale && <PaymentStateBadge value={sale.paymentState} />}
            {sale?.requiresReview && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700">
                <AlertTriangle className="h-3 w-3" /> Needs review
              </span>
            )}
          </div>
          {sale && <p className="text-xs text-gray-500 font-mono mt-0.5">{sale.saleReference}</p>}
        </div>
        {sale && (
          <div className="text-right">
            <div className="text-[11px] font-medium text-gray-400">Total</div>
            <div className="text-xl font-bold text-gray-900">{num(sale.total)}</div>
          </div>
        )}
        <button onClick={() => refetch()} disabled={refreshing} className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-50 mt-0.5" title="Refresh">
          <RefreshCw className={`h-4 w-4 text-gray-600 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {loading ? (
        <div className="py-16 text-center text-gray-400"><Loader2 className="h-5 w-5 animate-spin inline" /></div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-4 py-2">{error}</div>
      ) : sale ? (
        <>
          {sale.requiresReview && sale.reviewReason && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-lg px-4 py-2.5">
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
              <div><span className="font-semibold">Flagged for review:</span> {sale.reviewReason}</div>
            </div>
          )}

          <Card>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-x-6 gap-y-3 text-xs p-5">
              {meta.map(([k, v, Icon]) => (
                <div key={k}>
                  <span className="flex items-center gap-1 text-[10px] font-medium text-gray-400 uppercase tracking-wide">
                    {Icon && <Icon className="h-3 w-3" />} {k}
                  </span>
                  <div className="text-gray-900 font-semibold mt-0.5">{v}</div>
                </div>
              ))}
            </div>
          </Card>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              ['Items', String(sale.items.length)],
              ['Subtotal', num(sale.subtotal - sale.taxAmount)],
              ['Tax', num(sale.taxAmount)],
              ...(sale.discountAmount ? [['Discount', num(sale.discountAmount)]] : []),
              ...(sale.refundedAmount ? [['Refunded', num(sale.refundedAmount)]] : []),
            ].map(([k, v]) => (
              <div key={k} className="rounded-xl bg-white border border-gray-100 shadow-sm px-4 py-3">
                <div className="text-[11px] font-medium text-gray-500">{k}</div>
                <div className="text-base font-bold text-gray-900 mt-0.5">{v}</div>
              </div>
            ))}
            <div className="rounded-xl bg-blue-600 shadow-sm px-4 py-3">
              <div className="text-[11px] font-medium text-blue-100">Total</div>
              <div className="text-base font-bold text-white mt-0.5">{num(sale.total)}</div>
            </div>
          </div>

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
                    <tr key={`${i.menuItemId}-${idx}`} className="hover:bg-gray-50">
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
            <div className="flex justify-end p-5">
              <div className="w-full max-w-xs space-y-1 text-xs bg-gray-50 rounded-lg p-4">
                {totals.map(([k, v, strong]) => (
                  <div key={k} className={`flex justify-between ${strong ? 'border-t border-gray-200 pt-1.5 mt-1 text-sm font-bold text-gray-900' : 'text-gray-600'}`}>
                    <span>{k}</span><span>{num(v)}</span>
                  </div>
                ))}
              </div>
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
                      <tr key={p.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2 font-medium">{p.methodCode}</td>
                        <td className="px-3 py-2 text-right font-semibold">{num(p.amount)}</td>
                        <td className="px-3 py-2 text-right">{p.tenderedAmount != null ? num(p.tenderedAmount) : '—'}</td>
                        <td className="px-3 py-2 text-right">{p.changeGiven != null ? num(p.changeGiven) : '—'}</td>
                        <td className="px-3 py-2 text-gray-600">{p.reference || '—'}</td>
                        <td className="px-3 py-2"><Badge value={p.status} styles={PAYMENT_STYLES} /></td>
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
                      <tr key={a.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2"><Badge value={a.type} styles={ADJUSTMENT_STYLES} /></td>
                        <td className="px-3 py-2 text-right font-semibold">{num(a.amount)}</td>
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

          {sale.notes && (
            <Card title="Notes">
              <p className="text-xs text-gray-600 p-5">{sale.notes}</p>
            </Card>
          )}
        </>
      ) : null}
    </div>
  )
}

export default SaleDetail
