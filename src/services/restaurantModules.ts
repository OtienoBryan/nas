// Modules and endpoints of the Restaurant Connect API (mirrors the Bruno collection)
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE'

export interface ModuleEndpoint {
  method: HttpMethod
  path: string // full path from the host root, with :params
  description: string
  page?: string // dedicated UI page for this endpoint
}

export interface RestaurantModule {
  slug: string
  name: string
  icon: string // lucide-react icon name, resolved in the dashboard
  color: string // tailwind color name
  endpoints: ModuleEndpoint[]
}

const R = '/api/v1/restaurant'

export const RESTAURANT_MODULES: RestaurantModule[] = [
  {
    slug: 'menu', name: 'Menu', icon: 'UtensilsCrossed', color: 'orange',
    endpoints: [
      { method: 'GET', path: `${R}/menu/categories`, description: 'List menu categories', page: '/restaurant/menu/categories' },
      { method: 'POST', path: `${R}/menu/categories`, description: 'Create a category', page: '/restaurant/menu/categories' },
      { method: 'PUT', path: `${R}/menu/categories/:categoryId`, description: 'Update a category', page: '/restaurant/menu/categories' },
      { method: 'GET', path: `${R}/menu/items`, description: 'List menu items', page: '/restaurant/menu/items' },
      { method: 'POST', path: `${R}/menu/items`, description: 'Create a menu item', page: '/restaurant/menu/items' },
      { method: 'GET', path: `${R}/menu/items/:menuItemId`, description: 'Get a menu item', page: '/restaurant/menu/items' },
      { method: 'PUT', path: `${R}/menu/items/:menuItemId`, description: 'Update a menu item', page: '/restaurant/menu/items' },
      { method: 'PUT', path: `${R}/menu/items/:menuItemId/availability`, description: 'Set item availability', page: '/restaurant/menu/items' },
      { method: 'PUT', path: `${R}/menu/items/:menuItemId/price`, description: 'Change price for new sales (history kept)', page: '/restaurant/menu/items' },
      { method: 'GET', path: `${R}/menu/items/:menuItemId/price-history`, description: 'Item price history', page: '/restaurant/menu/items' },
      { method: 'GET', path: `${R}/menu/pos`, description: 'Menu for the POS (supports sinceVersion)' },
      { method: 'POST', path: `${R}/menu/import`, description: 'Bulk upload CSV/XLSX (dryRun supported)' },
      { method: 'GET', path: `${R}/menu/import/template`, description: 'Empty upload template' },
    ],
  },
  {
    slug: 'sales', name: 'Sales', icon: 'ShoppingCart', color: 'emerald',
    endpoints: [
      { method: 'POST', path: `${R}/sales`, description: 'Record a sale with its payments' },
      { method: 'GET', path: `${R}/sales/mine`, description: "The caller's own sales, newest first" },
      { method: 'GET', path: `${R}/sales/:saleId`, description: 'Get a sale' },
      { method: 'GET', path: `${R}/sales/:saleId/receipt`, description: 'Sale receipt' },
      { method: 'POST', path: `${R}/sales/:saleId/receipt/prints`, description: 'Log a receipt/slip print' },
      { method: 'POST', path: `${R}/sales/:saleId/payments`, description: 'Add a payment (split allowed)' },
      { method: 'POST', path: `${R}/sales/:saleId/lipa-na-bank/lookup`, description: 'Verify customer bank account' },
      { method: 'POST', path: `${R}/sales/:saleId/refund`, description: 'Refund a sale' },
      { method: 'POST', path: `${R}/sales/:saleId/void`, description: 'Void a sale' },
    ],
  },
  {
    slug: 'shifts', name: 'Shifts', icon: 'Clock', color: 'blue',
    endpoints: [
      { method: 'POST', path: `${R}/shifts`, description: "Start the caller's shift" },
      { method: 'GET', path: `${R}/shifts/current`, description: 'Current shift', page: '/restaurant/shifts/staff' },
      { method: 'GET', path: `${R}/shifts/:shiftId`, description: 'Get a shift', page: '/restaurant/shifts/staff' },
      { method: 'POST', path: `${R}/shifts/:shiftId/cash-movements`, description: 'Float, paid-out, deposit or remittance' },
      { method: 'POST', path: `${R}/shifts/:shiftId/close`, description: 'Submit shift with declared amounts' },
      { method: 'GET', path: `${R}/shifts/:shiftId/reconciliation`, description: 'Shift reconciliation' },
      { method: 'POST', path: `${R}/shifts/:shiftId/approve`, description: 'Approve a shift' },
      { method: 'POST', path: `${R}/shifts/:shiftId/reopen`, description: 'Reopen a shift' },
      { method: 'POST', path: `${R}/shifts/:shiftId/notes`, description: 'Add a shift note' },
    ],
  },
  {
    slug: 'payments', name: 'Payments', icon: 'CreditCard', color: 'amber',
    endpoints: [
      { method: 'GET', path: `${R}/payments/dpo-notifications`, description: 'DPO payment updates for reconciliation' },
      { method: 'GET', path: `${R}/payments/:paymentId`, description: 'Latest payment state' },
      { method: 'GET', path: `${R}/payments/:paymentId/slip`, description: 'Payment slip' },
      { method: 'POST', path: `${R}/payments/:paymentId/confirm`, description: 'Accountant confirms a payment' },
      { method: 'POST', path: `${R}/payments/:paymentId/fail`, description: 'Accountant fails a payment' },
      { method: 'POST', path: `${R}/payments/:paymentId/refresh`, description: 'Ask the rail for the latest state' },
      { method: 'POST', path: `${R}/payments/:paymentId/mpesa/prompt`, description: 'Re-send M-Pesa prompt via DPO' },
      { method: 'POST', path: `${R}/payments/:paymentId/terminal-result`, description: 'N-Genius terminal result' },
      { method: 'POST', path: `${R}/payments/results`, description: 'Outcome from a trusted Orbit service' },
    ],
  },
  {
    slug: 'payment-methods', name: 'Payment Methods', icon: 'Wallet', color: 'teal',
    endpoints: [
      { method: 'GET', path: `${R}/payment-methods`, description: 'List payment methods' },
      { method: 'PUT', path: `${R}/payment-methods/:code`, description: 'Create or update a method by code' },
    ],
  },
  {
    slug: 'reports', name: 'Reports', icon: 'BarChart3', color: 'pink',
    endpoints: [
      { method: 'GET', path: `${R}/reports/summary`, description: 'Sales, collections, shifts, open exceptions' },
      { method: 'GET', path: `${R}/reports/breakdown`, description: 'Sales by day, trip, staff, shift, item or method' },
      { method: 'GET', path: `${R}/reports/collections`, description: 'Expected vs declared collections' },
      { method: 'GET', path: `${R}/reports/shifts`, description: 'Shifts report' },
      { method: 'GET', path: `${R}/reports/transactions`, description: 'Transactions report' },
      { method: 'GET', path: `${R}/reports/export`, description: 'Export as CSV, XLSX or PDF' },
    ],
  },
  {
    slug: 'staff', name: 'Staff', icon: 'UserCheck', color: 'indigo',
    endpoints: [
      { method: 'GET', path: `${R}/staff`, description: 'List staff', page: '/restaurant/staff' },
      { method: 'POST', path: `${R}/staff`, description: 'Register staff (temporary password)', page: '/restaurant/staff' },
      { method: 'GET', path: `${R}/staff/:staffId`, description: 'Get a staff member', page: '/restaurant/staff' },
      { method: 'PUT', path: `${R}/staff/:staffId`, description: 'Update a staff member', page: '/restaurant/staff' },
      { method: 'POST', path: `${R}/staff/:staffId/activate`, description: 'Activate account', page: '/restaurant/staff' },
      { method: 'POST', path: `${R}/staff/:staffId/deactivate`, description: 'Deactivate account and end sessions', page: '/restaurant/staff' },
      { method: 'POST', path: `${R}/staff/:staffId/reset-password`, description: 'Reset password' },
      { method: 'POST', path: `${R}/staff/:staffId/revoke-sessions`, description: 'Revoke sessions' },
    ],
  },
  {
    slug: 'devices', name: 'Devices', icon: 'Smartphone', color: 'cyan',
    endpoints: [
      { method: 'GET', path: `${R}/devices`, description: 'List devices' },
      { method: 'POST', path: `${R}/devices`, description: 'Register a device' },
      { method: 'POST', path: `${R}/devices/:deviceId/block`, description: 'Block a device' },
      { method: 'POST', path: `${R}/devices/:deviceId/unblock`, description: 'Unblock a device' },
    ],
  },
  {
    slug: 'trips', name: 'Shift schedules', icon: 'MapPin', color: 'lime',
    endpoints: [
      { method: 'GET', path: `${R}/shift-schedules`, description: 'List shifts (?activeOnly=false includes deactivated)', page: '/restaurant/trips' },
      { method: 'GET', path: `${R}/shift-schedules/available`, description: 'Shifts a waiter can start now (POS picker)', page: '/restaurant/trips' },
      { method: 'GET', path: `${R}/shift-schedules/:id`, description: 'Get a shift' },
      { method: 'POST', path: `${R}/shift-schedules`, description: 'Create a shift', page: '/restaurant/trips' },
      { method: 'PUT', path: `${R}/shift-schedules/:id`, description: 'Update a shift', page: '/restaurant/trips' },
      { method: 'DELETE', path: `${R}/shift-schedules/:id`, description: 'Deactivate a shift (history kept)', page: '/restaurant/trips' },
    ],
  },
  {
    slug: 'sync', name: 'Sync', icon: 'RefreshCw', color: 'purple',
    endpoints: [
      { method: 'GET', path: `${R}/sync/logs`, description: 'Sync logs' },
      { method: 'POST', path: `${R}/sync/batches`, description: 'Upload offline items in order' },
      { method: 'POST', path: `${R}/sync/logs/:syncLogId/resolve`, description: 'Resolve a rejected item' },
      { method: 'POST', path: `${R}/sync/logs/:syncLogId/replay`, description: 'Replay a rejected item' },
    ],
  },
  {
    slug: 'dpo', name: 'DPO', icon: 'Landmark', color: 'red',
    endpoints: [
      { method: 'GET', path: `${R}/dpo/payments/pending`, description: 'M-Pesa payments waiting for DPO' },
      { method: 'GET', path: `${R}/dpo/payments/:paymentId`, description: 'One payment by companyRef' },
      { method: 'POST', path: `${R}/dpo/payments/notifications`, description: 'Payment update from DPO' },
    ],
  },
  {
    slug: 'audit', name: 'Audit', icon: 'ShieldCheck', color: 'slate',
    endpoints: [
      { method: 'POST', path: '/api/v1/audit/ui-events', description: 'Record UI actions for the user/terminal', page: '/restaurant/audit' },
    ],
  },
  {
    slug: 'health', name: 'Health', icon: 'Activity', color: 'green',
    endpoints: [
      { method: 'GET', path: '/api/v1/health', description: 'API health' },
      { method: 'GET', path: '/api/v1/readiness', description: 'Readiness' },
      { method: 'GET', path: '/health', description: 'Basic health' },
    ],
  },
]
