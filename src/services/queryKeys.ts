// Cache keys for useCachedQuery / prefetchQuery
export const MENU_CATEGORIES_KEY = 'menu:categories'

export const menuItemsKey = (q: { search?: string; categoryId?: string; isAvailable?: string; includeRetired?: boolean; page?: number; pageSize?: number }) =>
  `menu:items:${JSON.stringify(q)}`
export const STAFF_KEY = 'staff:list'
export const SHIFT_CURRENT_KEY = 'shifts:current'
export const shiftKey = (id: string) => `shifts:${id}`
export const shiftReportKey = (from: string, to: string, staffId: string, page: number, pageSize: number) => `shifts:report:${from}:${to}:${staffId}:${page}:${pageSize}`
export const reportKey = (name: string, f: object) => `reports:${name}:${JSON.stringify(f)}`
export const saleKey = (id: string) => `sales:${id}`
export const staffPageKey = (q: object) => `staff:page:${JSON.stringify(q)}`
export const staffMemberKey = (id: string) => `staff:${id}`
export const shiftSchedulesKey = (activeOnly: boolean, available = false) => `shift-schedules:${available ? 'available' : activeOnly ? 'active' : 'all'}`
export const tripsKey =(q: object) => `trips:${JSON.stringify(q)}`
export const PAYMENT_METHODS_KEY = 'payment-methods'
