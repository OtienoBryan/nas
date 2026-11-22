// Admin API service for backend communication
import { clearQueryCache } from './queryCache'
import { auditWrite, flushAudit, recordAuditEvent } from './audit'
import { mockCategories, mockProducts, mockUsers, mockOrders, mockDashboardStats } from './mockData'

// Restaurant Connect API (https://orbitoperable.co.ke). Leave VITE_API_URL empty to use the dev proxy / Vercel rewrite.
const API_BASE_URL = (import.meta.env.VITE_API_URL ?? '') + '/api/v1/restaurant'

// Standard response envelope returned by every Restaurant Connect endpoint
interface ApiEnvelope<T> {
  success: boolean
  message?: string
  code?: string
  data: T
  errors?: Array<string | { message?: string; field?: string }>
  correlationId?: string
}

export interface StaffSession {
  token: string
  expiresAtUtc: string
  sessionId: string
  deviceCode: string
  mustChangePassword: boolean
  staff: {
    id: string
    staffNumber: string
    fullName: string
    username: string
    role: string
    status: string
  }
  permissions: string[]
}

export interface MenuCategory {
  id: string
  code: string
  name: string
  sortOrder: number
  isActive: boolean
}

export type MenuCategoryInput = Omit<MenuCategory, 'id'>

export interface MenuItem {
  id: string
  itemCode: string
  name: string
  description: string | null
  imageUrl: string | null
  categoryId: string
  categoryName: string
  price: number
  taxRatePercent: number
  isAvailable: boolean
  isActive: boolean
  createdDate: string
  modifiedDate: string | null
}

export interface MenuItemPage {
  items: MenuItem[]
  total: number
  page: number
  pageSize: number
}

export interface MenuItemListQuery {
  search?: string
  categoryId?: string
  isAvailable?: '' | 'true' | 'false'
  includeRetired?: boolean
  page?: number
  pageSize?: number
}

export interface MenuItemCreateInput {
  itemCode: string
  name: string
  description: string
  imageUrl: string
  categoryId: string
  price: number
  taxRatePercent: number
  isAvailable: boolean
}

export interface MenuItemUpdateInput {
  itemCode?: string // sent only when the code was changed
  name: string
  description: string
  imageUrl: string
  categoryId: string
  isActive: boolean
}

export interface PriceHistoryEntry {
  price: number
  taxRatePercent: number
  effectiveFromUtc: string
  effectiveToUtc: string | null
  reason: string | null
  changedBy: string | null
}

export interface StaffMember {
  id: string
  staffNumber: string
  fullName: string
  username: string
  role: string
  status: string
}

export interface ShiftInfo {
  id: string
  staffId: string
  staffNumber: string
  staffName: string
  deviceCode: string
  serviceTripId: string | null
  serviceType: string
  serviceNumber: string | null
  route: string | null
  serviceDate: string | null
  status: string
  startedAtUtc: string
  endedAtUtc: string | null
  startedOffline: boolean
  openingFloat: number
  requiresReview: boolean
  reviewReason: string | null
  closingComment: string | null
  reviewedBy: string | null
  reviewedAtUtc: string | null
  reopenCount: number
}

export interface ShiftDetail {
  shift: ShiftInfo
  currency: string
  saleCount: number
  grossSales: number
  voidTotal: number
  refundTotal: number
  netSales: number
  openingFloat: number
  paidOuts: number
  depositsAndRemittances: number
  expectedCash: number
  pendingElectronic: number
  methods: Array<{ methodCode: string; kind: string; recorded: number; confirmed: number; pending: number; failed: number; refunds: number; expected: number }>
  declarations: Array<{ methodCode: string; expected: number; declared: number; variance: number }>
  totalExpected: number
  totalDeclared: number
  totalVariance: number
  cashMovements: Array<{ id: string; type: string; amount: number; reason: string | null; reference: string | null; occurredAtUtc: string; capturedOffline: boolean }>
}

export interface ShiftReportRow {
  shiftId: string
  staffId: string
  staffNumber: string
  staffName: string
  deviceCode: string
  serviceNumber: string | null
  route: string | null
  serviceDate: string | null
  status: string
  startedAtUtc: string
  endedAtUtc: string | null
  saleCount: number
  netSales: number
  expectedTotal: number
  declaredTotal: number
  varianceTotal: number
  requiresReview: boolean
}

export interface ReportFilters {
  from: string // inclusive day, YYYY-MM-DD
  to: string // inclusive day, YYYY-MM-DD
  staffId?: string
  shiftId?: string
  groupBy?: string
  saleStatus?: string
  methodCode?: string
  serviceNumber?: string
  page?: number
  pageSize?: number
}

export interface ReportSummary {
  from: string
  to: string
  currency: string
  sales: {
    transactionCount: number
    grossSales: number
    voidCount: number
    voidTotal: number
    refundTotal: number
    discountTotal: number
    taxTotal: number
    netSales: number
  }
  collections: Array<{ methodCode: string; confirmed: number; pending: number; failed: number; refunds: number; net: number }>
  collectionsTotal: number
  shifts: { open: number; pendingReview: number; closed: number; withVariance: number }
  pendingPaymentCount: number
  pendingPaymentAmount: number
  flaggedSaleCount: number
  unresolvedSyncExceptions: number
}

export interface BreakdownRow {
  key: string
  label: string
  transactionCount: number
  quantity: number
  grossSales: number
  netSales: number
}

export interface CollectionRow {
  groupKey: string
  groupLabel: string
  methodCode: string
  expected: number
  declared: number
  variance: number
}

export interface TransactionRow {
  saleId: string
  saleReference: string
  receiptNumber: string
  occurredAtUtc: string
  receivedAtUtc: string
  staffId: string
  staffNumber: string
  staffName: string
  shiftId: string
  deviceCode: string
  serviceNumber: string | null
  route: string | null
  seatNumber: string | null
  tableNumber: string | null
  itemCount: number
  total: number
  refundedAmount: number
  status: string
  paymentState: string
  paymentMethods: string | null
  capturedOffline: boolean
  requiresReview: boolean
}

export interface SaleItem {
  menuItemId: string
  itemCode: string
  itemName: string
  quantity: number
  unitPrice: number
  catalogUnitPrice: number
  taxRatePercent: number
  lineSubtotal: number
  lineTax: number
  lineTotal: number
}

export interface SalePayment {
  id: string
  methodCode: string
  methodKind: string
  amount: number
  tenderedAmount: number | null
  changeGiven: number | null
  reference: string | null
  status: string
  occurredAtUtc: string
  confirmedAtUtc: string | null
}

export interface SaleAdjustment {
  id: string
  type: string
  amount: number
  paymentMethodCode: string | null
  reason: string | null
  actorName: string | null
  occurredAtUtc: string
}

export interface SaleDetail {
  id: string
  saleReference: string
  receiptNumber: string
  staffName: string
  deviceCode: string
  serviceNumber: string | null
  seatNumber: string | null
  tableNumber: string | null
  occurredAtUtc: string
  capturedOffline: boolean
  subtotal: number
  discountAmount: number
  discountReason: string | null
  taxAmount: number
  total: number
  refundedAmount: number
  status: string
  paymentState: string
  requiresReview: boolean
  reviewReason: string | null
  notes: string | null
  items: SaleItem[]
  payments: SalePayment[]
  adjustments: SaleAdjustment[]
}

export type ReportExportKind = 'Transactions' | 'Shifts' | 'Collections' | 'SalesBreakdown'
export type ReportExportFormat = 'Csv' | 'Xlsx' | 'Pdf'

export interface StaffRecord extends StaffMember {
  phone: string | null
  email: string | null
  mustChangePassword: boolean
  lastLoginAtUtc: string | null
  lockedUntilUtc: string | null
  deactivatedAtUtc: string | null
  deactivationReason: string | null
  createdDate: string
}

export interface StaffListQuery {
  search?: string
  role?: string
  status?: string
  page?: number
  pageSize?: number
}

export interface StaffCreateInput {
  staffNumber: string
  fullName: string
  username: string
  phone: string
  email: string
  role: string
  temporaryPassword: string
}

export interface StaffUpdateInput {
  fullName: string
  phone: string
  email: string
  role: string
}

export interface TripRecord {
  id: string
  serviceType: string
  serviceNumber: string
  serviceDate: string
  route: string | null
  origin: string | null
  destination: string | null
  base: string | null
  status: string
  notes: string | null
}

export type TripInput = Omit<TripRecord, 'id'>

// Shift schedules (/shift-schedules). Input fields follow the documented payload; id/isActive are assumed on responses.
export interface ShiftScheduleRecord {
  id: string
  serviceNumber: string
  tripCode: string
  origin: string
  destination: string
  departureTime: string
  arrivalTime: string
  isActive: boolean
}

export type ShiftScheduleInput = Omit<ShiftScheduleRecord, 'id' | 'isActive'>

export interface TripListQuery {
  from?: string
  to?: string
  serviceType?: string
  status?: string
  search?: string
  page?: number
  pageSize?: number
}

export interface PaymentMethodInfo {
  id: string
  code: string
  name: string
  kind: string
  isActive: boolean
  sortOrder: number
}

export interface AuthUser {
  id: string
  username: string
  fullName: string
  role: string
  staffNumber?: string
  deviceCode?: string
  isPortalUser?: boolean
  mustChangePassword?: boolean
  permissions: string[]
}
const USE_MOCK_DATA = false // Set to false when database is connected

export interface SubCategory {
  id: number
  name: string
  description: string
  isActive: boolean
  categoryId: number
  category: Category
  createdAt: string
  updatedAt: string
}

export interface Brand {
  id?: number
  name: string
  description?: string
  logo?: string
  website?: string
  country?: string
  foundedYear?: number
  categoryId?: number
  category?: Category
  productCount?: number
  isActive?: boolean
  createdAt?: string
  updatedAt?: string
}

export interface Category {
  id: number
  name: string
  description?: string | null
  subcategories?: SubCategory[]
}

export interface Task {
  id: number
  title: string
  description: string
  createdAt: string
  completedAt?: string | null
  isCompleted: boolean
  priority: 'low' | 'medium' | 'high'
  status: 'pending' | 'in-progress' | 'completed' | 'cancelled'
  salesRepId?: string // JSON string of sales rep IDs
  assignedById?: number
  date: string
  salesReps?: SalesRep[] // Array of sales reps
  assignedBy?: SalesRep
}

export interface CreateTaskDto {
  title: string
  description: string
  priority: 'low' | 'medium' | 'high'
  status: 'pending' | 'in-progress' | 'completed' | 'cancelled'
  salesRepId?: string // JSON string of sales rep IDs
  assignedById?: number
  date: string
}

export interface UpdateTaskDto {
  title?: string
  description?: string
  priority?: 'low' | 'medium' | 'high'
  status?: 'pending' | 'in-progress' | 'completed' | 'cancelled'
  salesRepId?: string // JSON string of sales rep IDs
  assignedById?: number
  date?: string
  isCompleted?: boolean
}

export interface TaskStats {
  total: number
  completed: number
  pending: number
  inProgress: number
  cancelled: number
}

export interface Product {
  id: number
  name: string
  description: string
  price: number
  originalPrice?: number
  stock: number
  image: string
  images?: string[]
  brand: string
  brandId?: number
  alcoholContent: string
  volume: string
  origin: string
  tags: string[]
  rating: number
  reviewCount: number
  isActive: boolean
  isFeatured: boolean
  requiresAgeVerification: boolean
  category: Category
  categoryId: number
  createdAt: string
  updatedAt: string
}

export interface DatabaseProduct {
  id: number
  product_name: string
  product_code: string
  description: string
  category: string
  unit_of_measure: string
  cost_price: number
  selling_price: number
  tax_type: string
  reorder_level: number
  current_stock: number
  is_active: boolean
  created_at: string
  updated_at: string
  image_url: string | null
}

export interface Aircraft {
  id: number
  name: string
  registration: string
  capacity: number | null
  max_cargo_weight: number | null
  category_id: number | null
  category?: Category | null
  created_by: number | null
  createdByStaff?: {
    id: number
    name: string
  } | null
  status: string
  created_at: string
  updated_at: string
}

export interface Destination {
  id: number
  code: string
  name: string
  country_id: number | null
  country?: {
    id: number
    name: string
  } | null
  longitude: number | null
  latitude: number | null
  timezone: string | null
  status: string
  father_code: string | null
  destination: string | null
  created_at: string
  updated_at: string
}

export interface FlightSeries {
  id: number
  flt: string
  aircraft_id: number | null
  aircraft?: {
    id: number
    name: string
    registration: string
  } | null
  flight_type: string
  start_date: string
  end_date: string
  std: string | null
  sta: string | null
  number_of_seats: number | null
  from_destination_id: number | null
  fromDestination?: {
    id: number
    code: string
    name: string
  } | null
  from_terminal: string | null
  to_terminal: string | null
  via_destination_id: number | null
  viaDestination?: {
    id: number
    code: string
    name: string
  } | null
  via_std: string | null
  via_sta: string | null
  to_destination_id: number | null
  toDestination?: {
    id: number
    code: string
    name: string
  } | null
  adult_fare: number | null
  child_fare: number | null
  infant_fare: number | null
  created_at: string
  updated_at: string
}

export interface SeatReservation {
  id: number
  flight_series_id: number
  passenger_id?: number | null
  flightSeries?: {
    id: number
    flt: string
    flight_type: string
    fromDestination?: {
      id: number
      code: string
      name: string
    } | null
    toDestination?: {
      id: number
      code: string
      name: string
    } | null
    viaDestination?: {
      id: number
      code: string
      name: string
    } | null
  } | null
  passenger?: {
    id: number
    pnr: string
    name: string
    email: string | null
    contact: string | null
  } | null
  number_of_seats: number
  passenger_name: string
  passenger_email: string | null
  passenger_phone: string | null
  booking_reference: string
  status: string
  reservation_date: string
  notes: string | null
  created_at: string
  updated_at: string
}

export interface BookingPassenger {
  id: number
  booking_id: number
  passenger_id: number
  passenger?: Passenger | null
  passenger_type: string
  fare_amount: number
  created_at: string
}

export interface Booking {
  id: number
  booking_reference: string
  flight_series_id: number
  flightSeries?: FlightSeries | null
  passenger_id: number | null
  passenger?: Passenger | null
  bookingPassengers?: BookingPassenger[] | null
  passenger_name: string
  passenger_email: string | null
  passenger_phone: string | null
  passenger_type: string
  number_of_passengers: number
  fare_per_passenger: number
  total_amount: number
  payment_method: string
  payment_status: string
  booking_date: string
  notes: string | null
  created_at: string
  updated_at: string
}

export interface Passenger {
  id: number
  pnr: string
  name: string
  email: string | null
  contact: string | null
  nationality: string | null
  identification: string | null
  age: number | null
  title: string | null
  booking_status: string | null
  created_at: string
  updated_at: string
}

export interface SalesPageParams {
  page?: number
  pageSize?: number
  stationId?: number
  keyAccountId?: number
  conversionClientId?: number
  startDate?: string
  endDate?: string
  shift?: 'shift1' | 'shift2'
  search?: string
}

export interface DailySalesTotal {
  /** Business day (7am–7am), YYYY-MM-DD */
  date: string
  totalSales: number
  totalQuantity: number
  totalRevenue: number
}

export interface SalesPageResult {
  data: Sale[]
  total: number
  page: number
  pageSize: number
  summary: {
    totalSales: number
    totalQuantity: number
    totalRevenue: number
    uniqueVehicles: number
  }
}

export interface Country {
  id: number
  name: string
  status?: number
}

export interface Region {
  id: number
  name: string
  countryId: number
  country?: Country
  status: number
}

export interface Station {
  id: number
  name: string
  regionId: number
  region?: Region
  contact: string | null
  price: number | null
  lpgQuantity?: number
}

export interface StationExpense {
  id: number
  user_id: number
  user?: Staff
  station_id: number
  station?: Station
  amount: number
  expense_date: string
  comment: string
  payment_method: string
  created_at: string
}

export interface StationTank {
  id: number
  station_id: number
  name: string
  capacity: number
  current_quantity: number
  status: 'active' | 'inactive' | 'maintenance'
  created_at: string
  updated_at: string
}

export interface StationLpgLedgerEntry {
  id: number
  stationId: number
  transactionType: 'IN' | 'OUT' | 'ADJUSTMENT'
  quantityIn: number
  quantityOut: number
  balance: number
  quantity: number
  previousQuantity: number
  newQuantity: number
  referenceNumber?: string | null
  notes?: string | null
  createdBy?: number | null
  createdByStaff?: Staff
  created_at: string
}

export interface Shift {
  id: number
  date: string
  time: string
  userId: number | null
  userName: string
  station_id: number
  station_name: string
  status: number
  checkInTime: string | null
  latitude: number | null
  longitude: number | null
  imageUrl: string | null
  notes: string | null
  pump_number: number
  checkoutLatitude: number | null
  checkoutLongitude: number | null
  checkoutTime: string | null
  showUpdateLocation: number
  routeId: number | null
  createdAt: string
  updatedAt: string
  outlet_address: string
  approvedAt: string
}

export interface StaffLeave {
  id: number
  staff_id: number
  leave_type_id: number
  start_date: string
  end_date: string
  reason: string | null
  attachment_url: string | null
  status: 'pending' | 'approved' | 'rejected' | 'cancelled'
  is_half_day: number
  approved_by: number | null
  applied_at: string
  updated_at: string
}

export interface SalesPosting {
  id: number
  station_id: number
  period_start: string
  period_end: string
  cash_posted: number | string
  card_posted: number | string
  mpesa_posted: number | string
  credit_posted: number | string
  other_posted: number | string
  cash_system: number | string
  card_system: number | string
  mpesa_system: number | string
  credit_system: number | string
  other_system: number | string
  notes: string | null
  posted_by: number | null
  created_at: string
}

export interface CreateSalesPostingPayload {
  station_id: number
  period_start: string
  period_end: string
  cash_posted: number
  card_posted: number
  mpesa_posted: number
  credit_posted: number
  other_posted: number
  cash_system: number
  card_system: number
  mpesa_system: number
  credit_system: number
  other_system: number
  notes?: string
}

export interface KeyAccount {
  id: number
  name: string
  email: string
  contact: string
  description: string | null
  account_number: string | null
  type?: 'client' | 'key_account'
  category?: 'individual' | 'company'
  region?: string | null
  is_active: number
  created_at: string
  updated_at: string
}

export interface ConversionClient {
  id: number
  name: string
  vehicle_count?: number
  first_name?: string | null
  middle_name?: string | null
  surname?: string | null
  relationship_status?: 'single' | 'married' | 'divorced' | 'widowed' | 'other' | null
  email: string | null
  contact: string
  address: string | null
  country?: string | null
  description?: string | null
  region: string | null
  category: 'individual' | 'company'
  organization_type?: 'individual' | 'sacco' | 'company' | null
  organization_name?: string | null
  tax_pin: string | null
  referral_source?: string | null
  referral_notes?: string | null
  tax_exempt?: number
  apply_discount?: number
  discount_rate?: string | number | null
  labour_rate_override?: number
  labour_rate?: string | number | null
  parts_markup_override?: number
  parts_markup?: string | number | null
  payment_terms_override?: number
  payment_terms?: string | null
  account_number: string
  is_active: number
  created_at: string
  updated_at: string
}

export interface Vehicle {
  id: number
  key_account_id: number
  registration_number: string
  vin_serial_number?: string
  vehicle_type?: string
  year?: number
  make?: string
  model: string
  trim_option?: string
  transmission_type?: string
  driven_wheel?: string
  current_odo?: number
  color?: string
  driver_name: string
  driver_contact: string
  created_at: string
  updated_at: string
  keyAccount?: KeyAccount
}

export interface ConversionVehicle {
  id: number
  conversion_client_id: number
  registration_number: string
  vin_serial_number?: string
  vehicle_type?: string
  year?: number
  make?: string
  model: string
  trim_option?: string
  transmission_type?: string
  driven_wheel?: string
  engine?: string
  engine_capacity?: string
  engine_code?: string
  current_odo?: number
  odo_unit: 'KM' | 'Miles'
  color?: string
  unit_number?: string
  tank_capacity?: string
  tank_year_of_production?: number
  tank_serial_number?: string
  kit_serial_number?: string
  telemetry_status?: string
  notes?: string
  photo_url?: string
  photo_urls?: string[]
  vsa_url?: string
  logbook_url?: string
  documents?: { title: string; url: string }[]
  labels?: string[]
  created_at: string
  updated_at: string
  conversionClient?: ConversionClient
}

export interface VendorLedgerEntry {
  id: number
  vendor_id: number
  transaction_type: 'PURCHASE' | 'PAYMENT' | 'ADJUSTMENT'
  debit: number
  credit: number
  balance: number
  reference_number?: string | null
  description?: string | null
  notes?: string | null
  created_by?: number | null
  created_at: string
}

export interface POItem {
  id?: number
  part_id: number
  quantity: number
  unit_price: number
  total_price: number
  part?: Part
}

export interface PurchaseOrder {
  id: number
  po_number: string
  vendor_id?: number
  store_id?: number | null
  order_date: string
  expected_delivery_date?: string | null
  status: 'draft' | 'sent' | 'received' | 'cancelled'
  subtotal: number
  total_amount: number
  notes?: string | null
  created_at: string
  updated_at: string
  items?: POItem[]
}

export interface PartLedgerEntry {
  id: number
  inventory_id: number
  store_id: number
  part_id: number
  transaction_type: 'IN' | 'OUT' | 'ADJUSTMENT' | 'TRANSFER_IN' | 'TRANSFER_OUT'
  quantity: number
  previous_quantity: number
  new_quantity: number
  reference_number?: string | null
  notes?: string | null
  created_by?: number | null
  created_at: string
  store?: { id: number; name: string }
}

export interface Vendor {
  id: number
  name: string
  tax_pin?: string | null
  current_balance: number
  status: string
  email?: string | null
  phone?: string | null
  contact_person?: string | null
  created_at: string
  updated_at: string
}

export interface PartCategory {
  id: number
  name: string
  description?: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Part {
  id: number
  part_number: string
  name: string
  description?: string | null
  category?: string | null
  manufacturer?: string | null
  unit_price?: number | null
  unit_price_usd?: number | null
  stock_quantity?: number | null
  min_stock_level?: number | null
  location?: string | null
  unit?: string | null
  purchase_cost?: number | null
  selling_price?: number | null
  selling_price_usd?: number | null
  status?: string | null
  notes?: string | null
  image_url?: string | null
  created_at: string
  updated_at: string
}

export interface Service {
  id: number
  title: string
  description?: string | null
  rate: number
  pricing_type: 'fixed' | 'hourly'
  is_active: number
  created_at: string
  updated_at: string
}

export interface JobCardItem {
  id?: number
  job_card_id?: number
  item_type: 'part' | 'labor'
  part_id?: number | null
  service_id?: number | null
  assigned_staff_id?: number | null
  assigned_at?: string | null
  description: string
  cost?: number
  price: number
  quantity: number
  taxable?: number
  amount: number
  part?: Part
  service?: Service
  assignedStaff?: Staff
  created_at?: string
}

export interface JobCard {
  id: number
  conversion_client_id?: number | null
  conversion_vehicle_id?: number | null
  status: 'open' | 'sent' | 'approved' | 'not_paid' | 'paid' | 'warranty' | 'special_order' | 'written_off' | 'voided'
  vat_enabled: number
  vat_rate: number
  discount: number
  other_charges: number
  amount_paid: number
  notes?: string | null
  items?: JobCardItem[]
  conversionClient?: ConversionClient
  conversionVehicle?: ConversionVehicle
  created_at: string
  updated_at: string
}

export type JobCardPaymentMethod = 'cash' | 'mobile_money' | 'card' | 'bank_transfer' | 'cheque' | 'other'

export interface JobCardPayment {
  id: number
  job_card_id: number
  amount: number
  payment_method: JobCardPaymentMethod
  reference?: string | null
  payment_date: string
  notes?: string | null
  posted_by?: number | null
  postedBy?: Staff
  jobCard?: JobCard
  created_at: string
}

export interface VehicleInspection {
  id: number
  conversion_vehicle_id: number
  conversion_client_id: number
  assigned_staff_id: number
  inspection_date: string
  status: 'pending' | 'in_progress' | 'completed'
  summary?: string | null
  checklist?: string | null
  issues_found?: number
  technician?: Staff
  conversionClient?: ConversionClient
  conversionVehicle?: ConversionVehicle
  created_at: string
  updated_at: string
}

export interface ChecklistTemplate {
  id: number
  title: string
  checklist?: string | null
  created_at: string
  updated_at: string
}

export interface Appointment {
  id: number
  title: string
  description?: string | null
  location?: string | null
  appointment_date: string
  end_date?: string | null
  conversion_client_id?: number | null
  conversion_vehicle_id?: number | null
  status: 'scheduled' | 'completed' | 'cancelled'
  conversionClient?: ConversionClient
  conversionVehicle?: ConversionVehicle
  created_at: string
  updated_at: string
}

export interface Store {
  id: number
  store_code: string
  store_name: string
  address?: string | null
  country_id: number
  is_active?: boolean | null
  created_at: string
}

export interface Inventory {
  id: number
  store_id: number
  part_id: number
  quantity: number
  min_stock_level?: number | null
  location?: string | null
  last_updated: string
  store?: Station
  part?: Part
}

export interface FuelPrice {
  id: number
  stationId: number
  station?: Station
  price: number
  fuelType: string | null
  /** Effective window. endDate null = still in force. */
  startDate?: string | null
  endDate?: string | null
  notes: string | null
  created_at: string
}

export interface InventoryLedger {
  id: number
  stationId: number
  station?: Station
  transactionType?: 'IN' | 'OUT' | 'ADJUSTMENT' // Legacy field
  quantity?: number // Legacy field
  previousQuantity?: number // Legacy field
  newQuantity?: number // Legacy field
  quantityIn: number
  quantityOut: number
  balance: number
  referenceNumber: string | null
  notes: string | null
  createdBy: number | null
  created_at: string
}

export interface StationInventory extends Station {
  lpgQuantity: number
  ledgerCount?: number
}

export interface KeyAccountLedger {
  id: number
  keyAccountId: number
  keyAccount?: KeyAccount
  vehicleId?: number
  vehicle?: Vehicle
  stationId: number
  station?: Station
  transactionDate: string
  transactionType: 'SALE' | 'PAYMENT' | 'ADJUSTMENT'
  quantity: number
  unitPrice: number
  totalAmount: number
  debit: number
  credit: number
  balance: number
  referenceNumber?: string
  description?: string
  notes?: string
  createdBy?: number
  createdAt: string
  updatedAt: string
}

export interface Sale {
  id: number
  stationId: number
  station?: Station
  clientType: 'regular' | 'key_account'
  keyAccountId?: number
  keyAccount?: KeyAccount
  vehicleId?: number
  vehicle?: Vehicle
  conversionClientId?: number
  conversionClient?: ConversionClient
  conversionVehicleId?: number
  conversionVehicle?: ConversionVehicle
  quantity: number
  unitPrice: number
  totalAmount: number
  paymentMethod?: 'CASH' | 'CARD' | 'MPESA' | 'CREDIT' | 'other'
  saleDate: string
  referenceNumber?: string
  notes?: string
  imagePath?: string
  createdBy?: number
  createdAt: string
  updatedAt: string
}

export interface WeeklyReportVehicle {
  key: string
  vehicleId: number | null
  conversionVehicleId: number | null
  regNo: string
  org: string
  driver: string
  tel: string
  daily: Record<string, number>
  totalQuantity: number
  totalAmount: number
}

export interface WeeklySalesReport {
  startDate: string
  endDate: string
  vehicles: WeeklyReportVehicle[]
}

export interface FuelReportVehicle {
  key: string
  vehicleId: number | null
  conversionVehicleId: number | null
  regNo: string
  org: string
  driver: string
  tel: string
  dailyFills: Record<string, number>
  totalFills: number
  totalQuantity: number
  totalAmount: number
}

export interface VehicleFuelReport {
  startDate: string
  endDate: string
  vehicles: FuelReportVehicle[]
}

export interface Conversion {
  id: number
  ownerFullName: string
  nationalId?: string
  passportId?: string
  contact: string
  email?: string
  vehicleRegistration: string
  make?: string
  model?: string
  yearOfManufacture?: number
  engineCapacity?: number
  vinChassisNumber?: string
  currentFuelType: 'petrol' | 'diesel' | 'hybrid'
  logbookNumber?: string
  scheduledDate?: string
  status: 'pending' | 'approved' | 'declined' | 'completed'
  comment?: string
  conversionDescription?: string
  conversionDate?: string
  createdBy?: number
  createdAt: string
  updatedAt: string
}

export interface User {
  id: number
  email: string
  firstName: string
  lastName: string
  phone: string
  dateOfBirth: string
  isActive: boolean
  isEmailVerified: boolean
  createdAt: string
  updatedAt: string
}

export interface SalesOrder {
  id: number
  soNumber: string
  clientId: number
  orderDate: string
  expectedDeliveryDate?: string
  subtotal: number
  taxAmount: number
  totalAmount: number
  netPrice: number
  notes?: string
  createdBy?: string
  salesrep?: number
  createdAt: string
  updatedAt: string
  riderId?: number
  assignedAt?: string
  recipientsName?: string
  recipientsContact?: string
  dispatchedBy?: number
  status: 'draft' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled' | 'in payment' | 'paid'
  myStatus: number
  receivedIntoStock: boolean
  deliveredAt?: string
  deliveryNotes: string
  receivedBy: number
  receivedAt?: string
  deliveryImage?: string
  returnedAt?: string
  clientName?: string
  clientEmail?: string
  clientPhone?: string
}

export interface OrderItem {
  id: number
  salesOrderId: number
  productId: number
  productName: string
  quantity: number
  unitPrice: number
  totalPrice: number
  orderDate: string
  soNumber: string
}

export interface ProductPerformanceData {
  productId: number
  productName: string
  totalQuantitySold: number
  totalRevenue: number
  averagePrice: number
  orderCount: number
  lastSoldDate: string
  monthlyData: {
    month: string
    monthNumber: number
    quantity: number
    revenue: number
    orderCount: number
  }[]
}

export interface ProductPerformanceSummary {
  totalProducts: number
  totalRevenue: number
  totalQuantitySold: number
  averageOrderValue: number
  topPerformingProduct: {
    productName: string
    revenue: number
  }
}

export interface ReceivableAgingData {
  clientId: number;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  totalOutstanding: number;
  current: number; // 0-30 days
  days31to60: number; // 31-60 days
  days61to90: number; // 61-90 days
  days91to120: number; // 91-120 days
  over120Days: number; // Over 120 days
  lastPaymentDate: Date | null;
  lastPaymentAmount: number;
}

export interface ReceivableAgingSummary {
  totalOutstanding: number;
  totalClients: number;
  currentTotal: number;
  days31to60Total: number;
  days61to90Total: number;
  days91to120Total: number;
  over120DaysTotal: number;
}

export interface InvoiceData {
  id: number;
  soNumber: string;
  clientId: number;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  orderDate: Date;
  expectedDeliveryDate: Date | null;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  netPrice: number;
  notes: string | null;
  createdBy: string | null;
  salesrep: number | null;
  createdAt: Date;
  updatedAt: Date;
  riderId: number | null;
  assignedAt: Date | null;
  recipientsName: string | null;
  recipientsContact: string | null;
  dispatchedBy: number | null;
  status: string;
  myStatus: number;
  receivedIntoStock: boolean;
  deliveredAt: Date | null;
  deliveryNotes: string | null;
  receivedBy: number | null;
  receivedAt: Date | null;
  deliveryImage: string | null;
  returnedAt: Date | null;
}

export interface InvoiceSummary {
  totalInvoices: number;
  totalAmount: number;
  totalSubtotal: number;
  totalTax: number;
  statusCounts: {
    draft: number;
    confirmed: number;
    shipped: number;
    delivered: number;
    cancelled: number;
    inPayment: number;
    paid: number;
  };
  myStatusCounts: {
    status1: number;
    status2: number;
    status3: number;
    status4: number;
    status5: number;
  };
}

export interface Order {
  id: number
  orderNumber: string
  userId: number
  user: User
  items: OrderItem[]
  subtotal: number
  tax: number
  shipping: number
  total: number
  status: 'pending' | 'assigned' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'refunded' // Updated to include 'assigned'
  paymentStatus: 'pending' | 'paid' | 'failed' | 'refunded'
  shippingAddress: string
  billingAddress?: string
  notes?: string
  riderId?: number
  rider?: Rider
  assignedAt?: string
  createdAt: string
  updatedAt: string
}

export interface Rider {
  id: number
  name: string
  contact: string
  cashLimit: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface DashboardStats {
  totalProducts: number
  totalCategories: number
  totalOrders: number
  totalUsers: number
  recentOrders: Order[]
}

export interface Country {
  id: number
  name: string
  status: number
}

export interface Notice {
  id: number
  title: string
  content: string
  countryId: number
  country?: Country
  createdAt: string
  status: number
}

export interface NoticeStats {
  total: number
  active: number
  inactive: number
}

export interface SalesRep {
  id: number
  name: string
  email: string
  phoneNumber: string
  password?: string // Exclude from display
  photoUrl?: string // Profile photo URL
  countryId: number
  country: string
  region_id: number
  region: string
  route_id: number
  route: string
  route_id_update: number
  route_name_update: string
  visits_targets: number
  new_clients: number
  vapes_targets: number
  pouches_targets: number
  role: string
  manager_type: number
  status: number
  createdAt: string
}

export interface SalesRepStats {
  total: number
  active: number
  inactive: number
  byCountry: Record<string, number>
  byRegion: Record<string, number>
}

export interface AttendanceRecord {
  id: number
  userId: number
  salesRepName: string
  salesRepEmail: string
  timezone: string
  duration: number
  status: number
  sessionStart: string
  sessionEnd: string
  country: string
  region: string
  route: string
}

export interface AttendanceStats {
  totalSessions: number
  totalDuration: number
  averageSessionDuration: number
  activeSalesReps: number
  byStatus: Record<number, number>
  byCountry: Record<string, number>
  byRegion: Record<string, number>
}

export interface Region {
  id: number
  name: string
  countryId: number
  status: number
}

export interface Route {
  id: number
  name: string
  region: number
  region_name: string
  country_id: number
  country_name: string
  sales_rep_id: number
  sales_rep_name: string
  leader_id: number
  leader_name: string
  status: number
}

export interface Staff {
  id: number
  name: string
  photo_url: string
  empl_no: string
  id_no: string
  role: string
  designation: string
  phone_number: string
  password: string
  department: string
  department_id: number
  station_id?: number | null
  business_email: string
  department_email: string
  salary: number
  employment_type: string
  gender: 'Male' | 'Female' | 'Other'
  created_at: string
  updated_at: string
  is_active: number
  avatar_url: string
  status: number
}

export interface StaffStats {
  total: number
  active: number
  inactive: number
  byDepartment: Record<string, number>
  byRole: Record<string, number>
  byGender: Record<string, number>
  byEmploymentType: Record<string, number>
}

export interface Department {
  id: number
  name: string
  created_at: string
  updated_at: string
}

export interface Crew {
  id: number
  name: string
  contact: string | null
  role: string
  nationality: string | null
  id_number: string | null
  license_number: string | null
  license_issue_date: string | null
  medical_class: string | null
  medical_date: string | null
  fixed_wing_training_date: string | null
  rotorcraft_asel: string | null
  rotorcraft_amel: string | null
  rotorcraft_ases: string | null
  rotorcraft_ames: string | null
  created_at: string
  updated_at: string
}

export interface Supplier {
  id: number
  supplier_code: string
  company_name: string
  contact_person?: string
  email?: string
  phone?: string
  address?: string
  tax_id?: string
  payment_terms: number
  credit_limit: number
  is_active: boolean
  created_at?: string
  updated_at?: string
}

export interface SupplierStats {
  total: number
  active: number
  inactive: number
  totalCreditLimit: number
}

export interface PurchaseOrder {
  id: number
  po_number: string
  invoice_number: string
  supplier_id: number
  order_date: string
  expected_delivery_date?: string
  status: 'draft' | 'sent' | 'received' | 'cancelled'
  subtotal: number
  tax_amount: number
  total_amount: number
  amount_paid: number
  balance: number
  notes?: string
  created_by: number
  created_at?: string
  updated_at?: string
  supplier?: Supplier
  creator?: {
    id: number
    name: string
    business_email: string
  }
}

export interface PurchaseOrderStats {
  total: number
  draft: number
  sent: number
  received: number
  cancelled: number
  totalAmount: number
  totalPaid: number
  totalBalance: number
  totalValue: number
  recentOrders: PurchaseOrder[]
}

export interface SupplierInvoiceStats {
  totalOrders: number
  totalAmount: number
  totalPaid: number
  totalBalance: number
  recentOrders: PurchaseOrder[]
}

export interface PurchaseOrderItem {
  id: number
  purchase_order_id: number
  product_id: number
  quantity: number
  unit_price: number
  total_price: number
  received_quantity?: number
  tax_amount?: number
  tax_type?: string
  product?: {
    id: number
    product_name: string
    product_code: string
    description?: string
    category?: string
    unit_of_measure?: string
    cost_price?: number
    selling_price?: number
    tax_type?: string
  }
}

export type ExternalOwnershipType = 'individual' | 'company' | 'sacco'

export const EXTERNAL_VEHICLE_FUEL_TYPES = ['Petrol', 'Diesel', 'LPG', 'Petrol/LPG', 'Hybrid', 'Electric'] as const
export type ExternalVehicleFuelType = (typeof EXTERNAL_VEHICLE_FUEL_TYPES)[number]

export interface ExternalVehicleOwner {
  id: number
  ownership_type: ExternalOwnershipType
  name: string
  id_number?: string | null
  contact_person?: string | null
  phone?: string | null
  email?: string | null
  address?: string | null
  vehicle_count?: number
}

export interface ExternalVehicle {
  id: number
  registration_number: string
  make: string
  model: string
  fuel_type: ExternalVehicleFuelType
  location?: string | null
  owner_id: number
  owner?: ExternalVehicleOwner
}

// Short-lived GET cache + in-flight dedupe for every page; any write clears it.
const GET_TTL_MS = 15000
const getCache = new Map<string, { at: number; data: unknown }>()
const getInflight = new Map<string, Promise<unknown>>()
const clearGetCache = () => { getCache.clear(); getInflight.clear() }

class AdminApiService {
  private authToken: string | null = null

  constructor() {
    this.authToken = localStorage.getItem('adminToken')
  }

  async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const method = (options.method ?? 'GET').toUpperCase()
    if (method !== 'GET') {
      try {
        const result = await this.doRequest<T>(endpoint, options)
        clearGetCache()
        auditWrite(method, endpoint, 'success')
        return result
      } catch (error) {
        auditWrite(method, endpoint, 'failure', (error as { status?: number })?.status, (error as Error)?.message)
        throw error
      }
    }

    const key = `${this.authToken ?? ''}|${endpoint}`
    const hit = getCache.get(key)
    if (hit && Date.now() - hit.at < GET_TTL_MS) return structuredClone(hit.data) as T
    const pending = getInflight.get(key) as Promise<T> | undefined
    if (pending) return pending.then(d => structuredClone(d))

    const promise = this.doRequest<T>(endpoint, options)
      .then(data => {
        getCache.set(key, { at: Date.now(), data })
        return data
      })
      .finally(() => { getInflight.delete(key) })
    getInflight.set(key, promise)
    return promise.then(d => structuredClone(d))
  }

  private async doRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`
    
    // Create AbortController for timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 second timeout
    
    // Check if body is FormData - if so, don't set Content-Type (browser will set it with boundary)
    const isFormData = options.body instanceof FormData
    
    const config: RequestInit = {
      headers: {
        // Only set Content-Type for non-FormData requests
        ...(!isFormData && { 'Content-Type': 'application/json' }),
        ...(this.authToken && { 'Authorization': `Bearer ${this.authToken}` }),
        ...options.headers,
      },
      signal: controller.signal,
      ...options,
    }
    
    try {
      const response = await fetch(url, config)

      clearTimeout(timeoutId)

      if (!response.ok) {
        let errorMessage = `HTTP error! status: ${response.status}`
        let serverMessage: string | string[] | null = null
        
        const isAuthEndpoint = endpoint.startsWith('/auth/')
        try {
          const errorText = await response.text()
          if (!isAuthEndpoint) console.error(`❌ HTTP error! status: ${response.status}, body: ${errorText}`)

          // Try to parse as JSON for structured error messages
          try {
            const errorData = JSON.parse(errorText)
            
            // Restaurant Connect envelope: { success:false, message, code, errors[] }
            if (Array.isArray(errorData.errors) && errorData.errors.length) {
              const details = errorData.errors.map((e: any) => (typeof e === 'string' ? e : e?.message)).filter(Boolean)
              serverMessage = details
              errorMessage = details.join(', ') || errorData.message || errorMessage
            }
            // Handle validation errors (array of messages)
            else if (Array.isArray(errorData.message)) {
              serverMessage = errorData.message
              errorMessage = errorData.message.join(', ')
            }
            // Handle single error message
            else if (errorData.message) {
              serverMessage = errorData.message
              errorMessage = errorData.message
            }
            // Handle error array (alternative format)
            else if (Array.isArray(errorData)) {
              serverMessage = errorData
              errorMessage = errorData.join(', ')
            }
          } catch {
            // If JSON parsing fails, use the raw text
            if (errorText) {
              serverMessage = errorText
              errorMessage = errorText.length > 200 ? `${errorText.substring(0, 200)}...` : errorText
            }
          }
        } catch (parseError) {
          console.error(`❌ Failed to parse error response:`, parseError)
        }

        // Only use generic messages if we didn't get a specific error message from the server
        if (!serverMessage) {
          switch (response.status) {
            case 401:
              errorMessage = 'Invalid credentials. Please check your email and password.'
              break
            case 403:
              errorMessage = 'Access denied. You do not have permission to access this resource.'
              break
            case 404:
              errorMessage = 'Service not found. Please contact support.'
              break
            case 500:
              errorMessage = 'Server error. Please try again later or contact support.'
              break
            case 503:
              errorMessage = 'Service temporarily unavailable. Please try again later.'
              break
          }
        }

        // Session expired or revoked: drop the token so the app returns to login
        if (response.status === 401 && endpoint !== '/auth/portal/login') {
          this.authToken = null
          localStorage.removeItem('adminToken')
        }

        const error = new Error(errorMessage) as any
        error.status = response.status
        error.serverMessage = serverMessage
        throw error
      }

      const text = await response.text()
      const data = text ? JSON.parse(text) : null
      // Unwrap the standard envelope so callers receive `data` directly
      if (data && typeof data === 'object' && typeof data.success === 'boolean' && 'data' in data) {
        if (!data.success) {
          const error = new Error(data.message || 'Request failed') as any
          error.status = response.status
          error.code = data.code
          throw error
        }
        return (data as ApiEnvelope<T>).data
      }
      return data
    } catch (error) {
      clearTimeout(timeoutId)
      
      if (error.name === 'AbortError') {
        console.error(`❌ Request timeout for ${endpoint}`)
        throw new Error('Request timeout. Please check your internet connection and try again.')
      }
      
      if (error.message.includes('Failed to fetch')) {
        console.error(`❌ Network error for ${endpoint}`)
        throw new Error('Network error. Please check your internet connection and try again.')
      }
      
      console.error(`❌ Admin API request failed for ${endpoint}:`, error)
      throw error
    }
  }

  // Authentication (Restaurant Connect staff auth)
  private storeSession(session: StaffSession): AuthUser {
    this.authToken = session.token
    localStorage.setItem('adminToken', session.token)
    return {
      id: session.staff.id,
      username: session.staff.username,
      fullName: session.staff.fullName,
      role: session.staff.role,
      staffNumber: session.staff.staffNumber,
      deviceCode: session.deviceCode,
      mustChangePassword: session.mustChangePassword,
      permissions: session.permissions ?? [],
    }
  }

  async login(username: string, password: string, retryCount: number = 0): Promise<{ token: string; user: AuthUser }> {
    const maxRetries = 2

    try {
      if (!username || !password) {
        throw new Error('Username and password are required')
      }

      const session = await this.request<StaffSession>('/auth/portal/login', {
        method: 'POST',
        body: JSON.stringify({ username: username.trim(), password }),
      })

      clearQueryCache()
      clearGetCache()
      return { token: session.token, user: this.storeSession(session) }
    } catch (error) {
      // Retry only transient network failures, never bad credentials
      if (retryCount < maxRetries &&
          ((error as any).message?.includes('Network error') ||
           (error as any).message?.includes('Request timeout'))) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)))
        return this.login(username, password, retryCount + 1)
      }

      throw error
    }
  }

  async getCurrentUser(): Promise<AuthUser> {
    const me = await this.request<{
      actorKey: string
      name: string
      staffId: string
      role: string
      deviceCode: string
      isPortalUser: boolean
      permissions: string[]
    }>('/auth/me')
    return {
      id: me.staffId,
      username: me.actorKey,
      fullName: me.name,
      role: me.role,
      deviceCode: me.deviceCode,
      isPortalUser: me.isPortalUser,
      permissions: me.permissions ?? [],
    }
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<AuthUser> {
    const session = await this.request<StaffSession>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    })
    return this.storeSession(session)
  }

  async logout(): Promise<void> {
    clearQueryCache()
    clearGetCache()
    await flushAudit(true).catch(() => {})
    try {
      if (this.authToken) {
        await this.request<void>('/auth/logout', { method: 'POST' })
      }
    } catch (error) {
      console.warn('[Logout] Server logout failed, clearing local session anyway', error)
    } finally {
      this.authToken = null
      localStorage.removeItem('adminToken')
    }
  }

  // Restaurant menu categories
  async getMenuCategories(): Promise<MenuCategory[]> {
    const data = await this.request<MenuCategory[]>('/menu/categories')
    return Array.isArray(data) ? data : []
  }

  // Restaurant menu items (products)
  async getMenuItems(q: MenuItemListQuery = {}): Promise<MenuItemPage> {
    const params = new URLSearchParams()
    if (q.search) params.set('Search', q.search)
    if (q.categoryId) params.set('CategoryId', q.categoryId)
    if (q.isAvailable) params.set('IsAvailable', q.isAvailable)
    if (q.includeRetired) params.set('IncludeRetired', 'true')
    if (q.page) params.set('Page', String(q.page))
    if (q.pageSize) params.set('PageSize', String(q.pageSize))
    const qs = params.toString()
    const data = await this.request<MenuItemPage>(`/menu/items${qs ? `?${qs}` : ''}`)
    return { items: data?.items ?? [], total: data?.total ?? 0, page: data?.page ?? 1, pageSize: data?.pageSize ?? 0 }
  }

  getMenuItem(id: string): Promise<MenuItem> {
    return this.request<MenuItem>(`/menu/items/${encodeURIComponent(id)}`)
  }

  async createMenuItem(input: MenuItemCreateInput): Promise<void> {
    await this.request<void>('/menu/items', { method: 'POST', body: JSON.stringify(input) })
  }

  async updateMenuItem(id: string, input: MenuItemUpdateInput): Promise<void> {
    await this.request<void>(`/menu/items/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(input) })
  }

  async setMenuItemAvailability(id: string, isAvailable: boolean): Promise<void> {
    await this.request<void>(`/menu/items/${encodeURIComponent(id)}/availability`, { method: 'PUT', body: JSON.stringify({ isAvailable }) })
  }

  async updateMenuItemPrice(id: string, input: { price: number; taxRatePercent: number; reason: string }): Promise<void> {
    await this.request<void>(`/menu/items/${encodeURIComponent(id)}/price`, { method: 'PUT', body: JSON.stringify(input) })
  }

  async getMenuItemPriceHistory(id: string): Promise<PriceHistoryEntry[]> {
    const data = await this.request<PriceHistoryEntry[]>(`/menu/items/${encodeURIComponent(id)}/price-history`)
    return Array.isArray(data) ? data : []
  }

  // Payment methods
  async getRestaurantPaymentMethods(): Promise<PaymentMethodInfo[]> {
    const data = await this.request<PaymentMethodInfo[]>('/payment-methods')
    return Array.isArray(data) ? data : []
  }

  // Trips
  async getTripsPage(q: TripListQuery = {}): Promise<{ items: TripRecord[]; total: number }> {
    const params = new URLSearchParams()
    if (q.from) params.set('From', q.from)
    if (q.to) params.set('To', q.to)
    if (q.serviceType) params.set('ServiceType', q.serviceType)
    if (q.status) params.set('Status', q.status)
    if (q.search) params.set('Search', q.search)
    if (q.page) params.set('Page', String(q.page))
    if (q.pageSize) params.set('PageSize', String(q.pageSize))
    const qs = params.toString()
    const data = await this.request<{ items: TripRecord[]; total: number }>(`/trips${qs ? `?${qs}` : ''}`)
    return { items: data?.items ?? [], total: data?.total ?? 0 }
  }

  async createTrip(input: TripInput): Promise<void> {
    await this.request<unknown>('/trips', { method: 'POST', body: JSON.stringify(input) })
  }

  async updateTrip(id: string, input: TripInput): Promise<void> {
    await this.request<unknown>(`/trips/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(input) })
  }

  // Shift schedules
  async getShiftSchedules(activeOnly = true): Promise<ShiftScheduleRecord[]> {
    const data = await this.request<ShiftScheduleRecord[] | { items: ShiftScheduleRecord[] }>(`/shift-schedules?activeOnly=${activeOnly}`)
    return Array.isArray(data) ? data : data?.items ?? []
  }

  async getAvailableShiftSchedules(): Promise<ShiftScheduleRecord[]> {
    const data = await this.request<ShiftScheduleRecord[]>('/shift-schedules/available')
    return Array.isArray(data) ? data : []
  }

  async createShiftSchedule(input: ShiftScheduleInput): Promise<void> {
    await this.request<unknown>('/shift-schedules', { method: 'POST', body: JSON.stringify(input) })
  }

  async updateShiftSchedule(id: string, input: ShiftScheduleInput): Promise<void> {
    await this.request<unknown>(`/shift-schedules/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(input) })
  }

  async deactivateShiftSchedule(id: string): Promise<void> {
    await this.request<unknown>(`/shift-schedules/${encodeURIComponent(id)}`, { method: 'DELETE' })
  }

  // Staff management
  async getStaffPage(q: StaffListQuery = {}): Promise<{ items: StaffRecord[]; total: number }> {
    const params = new URLSearchParams()
    if (q.search) params.set('Search', q.search)
    if (q.role) params.set('Role', q.role)
    if (q.status) params.set('Status', q.status)
    if (q.page) params.set('Page', String(q.page))
    if (q.pageSize) params.set('PageSize', String(q.pageSize))
    const qs = params.toString()
    const data = await this.request<{ items: StaffRecord[]; total: number }>(`/staff${qs ? `?${qs}` : ''}`)
    return { items: data?.items ?? [], total: data?.total ?? 0 }
  }

  getStaffMember(id: string): Promise<StaffRecord> {
    return this.request<StaffRecord>(`/staff/${encodeURIComponent(id)}`)
  }

  async createStaffMember(input: StaffCreateInput): Promise<void> {
    await this.request<unknown>('/staff', { method: 'POST', body: JSON.stringify(input) })
  }

  async updateStaffMember(id: string, input: StaffUpdateInput): Promise<void> {
    await this.request<void>(`/staff/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(input) })
  }

  async activateStaff(id: string): Promise<void> {
    await this.request<void>(`/staff/${encodeURIComponent(id)}/activate`, { method: 'POST' })
  }

  async deactivateStaff(id: string, reason: string): Promise<void> {
    await this.request<void>(`/staff/${encodeURIComponent(id)}/deactivate`, { method: 'POST', body: JSON.stringify({ reason }) })
  }

  // Restaurant staff (used to show names instead of ids)
  async getRestaurantStaff(): Promise<StaffMember[]> {
    const data = await this.request<{ items: StaffMember[] }>('/staff?PageSize=200')
    return data?.items ?? []
  }

  // Shifts
  async getCurrentShift(): Promise<ShiftDetail | null> {
    try {
      return await this.request<ShiftDetail | null>('/shifts/current')
    } catch (error) {
      // No open shift is not an error for the page
      if ((error as any)?.status === 404) return null
      throw error
    }
  }

  getShift(shiftId: string): Promise<ShiftDetail> {
    return this.request<ShiftDetail>(`/shifts/${encodeURIComponent(shiftId)}`)
  }

  // `from`/`to` are inclusive calendar days (YYYY-MM-DD). The API treats `To` as exclusive and caps the period at 366 days.
  async getShiftReport(from: string, to: string, staffId: string, page: number, pageSize: number): Promise<{ items: ShiftReportRow[]; total: number }> {
    const end = new Date(`${to}T00:00:00`)
    end.setDate(end.getDate() + 1)
    const apiTo = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`
    const data = await this.request<{ items: ShiftReportRow[]; total: number }>(
      `/reports/shifts?From=${from}&To=${apiTo}${staffId ? `&StaffId=${encodeURIComponent(staffId)}` : ''}&Page=${page}&PageSize=${pageSize}`
    )
    return { items: data?.items ?? [], total: data?.total ?? 0 }
  }

  // Reports. `to` is an inclusive day; the API's `To` is exclusive, so one day is added.
  private reportQuery(f: ReportFilters): string {
    const end = new Date(`${f.to}T00:00:00`)
    end.setDate(end.getDate() + 1)
    const to = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`
    const q = new URLSearchParams({ From: f.from, To: to })
    if (f.staffId) q.set('StaffId', f.staffId)
    if (f.shiftId) q.set('ShiftId', f.shiftId)
    if (f.groupBy) q.set('groupBy', f.groupBy)
    if (f.saleStatus) q.set('SaleStatus', f.saleStatus)
    if (f.methodCode) q.set('MethodCode', f.methodCode)
    if (f.serviceNumber) q.set('ServiceNumber', f.serviceNumber)
    if (f.page) q.set('Page', String(f.page))
    if (f.pageSize) q.set('PageSize', String(f.pageSize))
    return q.toString()
  }

  getReportSummary(f: ReportFilters): Promise<ReportSummary> {
    return this.request<ReportSummary>(`/reports/summary?${this.reportQuery(f)}`)
  }

  async getReportBreakdown(f: ReportFilters): Promise<BreakdownRow[]> {
    const data = await this.request<BreakdownRow[]>(`/reports/breakdown?${this.reportQuery(f)}`)
    return Array.isArray(data) ? data : []
  }

  async getReportCollections(f: ReportFilters): Promise<CollectionRow[]> {
    const data = await this.request<CollectionRow[]>(`/reports/collections?${this.reportQuery(f)}`)
    return Array.isArray(data) ? data : []
  }

  async getReportTransactions(f: ReportFilters): Promise<{ items: TransactionRow[]; total: number }> {
    const data = await this.request<{ items: TransactionRow[]; total: number }>(`/reports/transactions?${this.reportQuery(f)}`)
    return { items: data?.items ?? [], total: data?.total ?? 0 }
  }

  getRestaurantSale(saleId: string): Promise<SaleDetail> {
    return this.request<SaleDetail>(`/sales/${encodeURIComponent(saleId)}`)
  }

  // Downloads the file the API generates (not JSON, so it bypasses request())
  async exportReport(report: ReportExportKind, format: ReportExportFormat, f: ReportFilters): Promise<string> {
    const q = new URLSearchParams(this.reportQuery({ ...f, page: undefined, pageSize: undefined }))
    q.set('report', report)
    q.set('format', format)
    const res = await fetch(`${API_BASE_URL}/reports/export?${q}`, {
      headers: this.authToken ? { Authorization: `Bearer ${this.authToken}` } : {},
    })
    const details = { report, format, from: f.from, to: f.to }
    if (!res.ok) {
      let message = `Export failed (${res.status})`
      try { message = (await res.json()).message || message } catch { /* not JSON */ }
      recordAuditEvent({ action: 'export_requested', entityType: 'report', outcome: 'failure', details: { ...details, httpStatus: res.status } })
      throw new Error(message)
    }
    recordAuditEvent({ action: 'export_requested', entityType: 'report', outcome: 'success', details })
    const disposition = res.headers.get('Content-Disposition') ?? ''
    const filename = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition)?.[1] ?? `${report}.${format.toLowerCase()}`
    const url = URL.createObjectURL(await res.blob())
    const a = document.createElement('a')
    a.href = url
    a.download = decodeURIComponent(filename)
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
    return filename
  }

  async createMenuCategory(input: MenuCategoryInput): Promise<void> {
    await this.request<void>('/menu/categories', { method: 'POST', body: JSON.stringify(input) })
  }

  async updateMenuCategory(categoryId: string, input: MenuCategoryInput): Promise<void> {
    await this.request<void>(`/menu/categories/${encodeURIComponent(categoryId)}`, { method: 'PUT', body: JSON.stringify(input) })
  }

  // Categories Management
  async getCategories(): Promise<Category[]> {
    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 500)) // Simulate network delay
      return [...mockCategories]
    }
    return this.request<Category[]>('/admin/categories')
  }

  async getCategoryById(id: number): Promise<Category> {
    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 300))
      const category = mockCategories.find(c => c.id === id)
      if (!category) throw new Error('Category not found')
      return category
    }
    return this.request<Category>(`/admin/categories/${id}`)
  }

  async createCategory(categoryData: Omit<Category, 'id' | 'createdAt' | 'updatedAt'>): Promise<Category> {
    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 500))
      const newCategory: Category = {
        ...categoryData,
        id: Math.max(...mockCategories.map(c => c.id)) + 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
      mockCategories.push(newCategory)
      return newCategory
    }
    return this.request<Category>('/admin/categories', {
      method: 'POST',
      body: JSON.stringify(categoryData),
    })
  }

  async updateCategory(id: number, categoryData: Partial<Omit<Category, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Category> {
    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 500))
      const index = mockCategories.findIndex(c => c.id === id)
      if (index === -1) throw new Error('Category not found')
      mockCategories[index] = { ...mockCategories[index], ...categoryData, updatedAt: new Date().toISOString() }
      return mockCategories[index]
    }
    return this.request<Category>(`/admin/categories/${id}`, {
      method: 'PUT',
      body: JSON.stringify(categoryData),
    })
  }

  async deleteCategory(id: number): Promise<void> {
    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 500))
      const index = mockCategories.findIndex(c => c.id === id)
      if (index === -1) throw new Error('Category not found')
      mockCategories.splice(index, 1)
      return
    }
    return this.request<void>(`/admin/categories/${id}`, {
      method: 'DELETE',
    })
  }

  // SubCategories Management
  async getSubCategories(categoryId?: number): Promise<SubCategory[]> {
    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 500))
      return []
    }
    const url = categoryId ? `/subcategories?categoryId=${categoryId}` : '/subcategories'

    const result = await this.request<SubCategory[]>(url)

    return result
  }

  async getSubCategoryById(id: number): Promise<SubCategory> {
    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 300))
      throw new Error('SubCategory not found')
    }
    return this.request<SubCategory>(`/subcategories/${id}`)
  }

  async createSubCategory(subCategoryData: Omit<SubCategory, 'id' | 'createdAt' | 'updatedAt' | 'category'>): Promise<SubCategory> {
    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 500))
      const newSubCategory: SubCategory = {
        ...subCategoryData,
        id: Math.floor(Math.random() * 1000) + 1,
        category: mockCategories.find(c => c.id === subCategoryData.categoryId) || {} as Category,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
      return newSubCategory
    }
    return this.request<SubCategory>('/subcategories', {
      method: 'POST',
      body: JSON.stringify(subCategoryData),
    })
  }

  async updateSubCategory(id: number, subCategoryData: Partial<Omit<SubCategory, 'id' | 'createdAt' | 'updatedAt' | 'category'>>): Promise<SubCategory> {
    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 500))
      throw new Error('SubCategory not found')
    }
    return this.request<SubCategory>(`/subcategories/${id}`, {
      method: 'PUT',
      body: JSON.stringify(subCategoryData),
    })
  }

  async deleteSubCategory(id: number): Promise<void> {
    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 500))
      return
    }
    return this.request<void>(`/subcategories/${id}`, {
      method: 'DELETE',
    })
  }

  async toggleSubCategoryStatus(id: number): Promise<SubCategory> {
    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 500))
      throw new Error('SubCategory not found')
    }
    return this.request<SubCategory>(`/subcategories/${id}/toggle-active`, {
      method: 'PUT',
    })
  }

  // Products Management
  async getProducts(page: number = 1, limit: number = 10): Promise<{ products: DatabaseProduct[], total: number }> {
    if (USE_MOCK_DATA) {

      await new Promise(resolve => setTimeout(resolve, 200))

      const mockProducts: DatabaseProduct[] = [
        {
          id: 1,
          product_name: 'Ice Watermelon Bliss 3000puffs',
          product_code: 'Ice Watermelon Bliss',
          description: 'High-quality electronic component for industrial use',
          category: '3000 puffs',
          unit_of_measure: 'PCS',
          cost_price: 800.00,
          selling_price: 1200.00,
          tax_type: '16%',
          reorder_level: 10,
          current_stock: 0,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          image_url: null
        },
        {
          id: 2,
          product_name: 'Kiwi Dragon Strawberry 9000puffs',
          product_code: 'Kiwi Dragon Strawber',
          description: 'Durable industrial component for heavy machinery',
          category: '9000 puffs',
          unit_of_measure: 'PCS',
          cost_price: 15.00,
          selling_price: 25.00,
          tax_type: '16%',
          reorder_level: 50,
          current_stock: 100,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          image_url: null
        },
        {
          id: 3,
          product_name: 'Minty Snow 3000puffs',
          product_code: 'Minty Snow 3000puffs',
          description: 'Advanced circuit board with multiple layers',
          category: '3000 puffs',
          unit_of_measure: 'PCS',
          cost_price: 60.00,
          selling_price: 95.00,
          tax_type: '16%',
          reorder_level: 20,
          current_stock: 34,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          image_url: null
        }
      ]

      return { products: mockProducts, total: mockProducts.length }
    }

    try {
      const result = await this.request<{ products: Product[], total: number }>(`/admin/products?page=${page}&limit=${limit}`)

      return result
    } catch (error) {

      throw error
    }
  }

  async getProductById(id: number): Promise<Product> {
    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 300))
      const product = mockProducts.find(p => p.id === id)
      if (!product) throw new Error('Product not found')
      return product
    }
    return this.request<Product>(`/admin/products/${id}`)
  }

  async createProduct(productData: Omit<Product, 'id' | 'createdAt' | 'updatedAt' | 'category'>): Promise<Product> {
    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 500))
      const category = mockCategories.find(c => c.id === productData.categoryId)
      if (!category) throw new Error('Category not found')

      const newProduct: Product = {
        ...productData,
        id: Math.max(...mockProducts.map(p => p.id)) + 1,
        category,
        images: productData.images || [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
      mockProducts.push(newProduct as any)
      return newProduct
    }
    return this.request<Product>('/admin/products', {
      method: 'POST',
      body: JSON.stringify(productData),
    })
  }

  async updateProduct(id: number, productData: Partial<Omit<Product, 'id' | 'createdAt' | 'updatedAt' | 'category'>>): Promise<Product> {
    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 500))
      const index = mockProducts.findIndex(p => p.id === id)
      if (index === -1) throw new Error('Product not found')

      const category = productData.categoryId ? 
        mockCategories.find(c => c.id === productData.categoryId) || mockProducts[index].category :
        mockProducts[index].category

      mockProducts[index] = { 
        ...mockProducts[index], 
        ...productData, 
        category,
        updatedAt: new Date().toISOString() 
      }
      return mockProducts[index]
    }
    return this.request<Product>(`/admin/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(productData),
    })
  }

  async deleteProduct(id: number): Promise<void> {
    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 500))
      const index = mockProducts.findIndex(p => p.id === id)
      if (index === -1) throw new Error('Product not found')
      mockProducts.splice(index, 1)
      return
    }
    return this.request<void>(`/admin/products/${id}`, {
      method: 'DELETE',
    })
  }

  // Orders Management
  async getOrders(): Promise<Order[]> {
    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 500))
      return [...mockOrders]
    }
    return this.request<Order[]>('/admin/orders')
  }

  async getOrderById(id: number): Promise<Order> {
    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 300))
      const order = mockOrders.find(o => o.id === id)
      if (!order) throw new Error('Order not found')
      return order
    }
    return this.request<Order>(`/admin/orders/${id}`)
  }

  async updateOrderStatus(id: number, status: Order['status'], paymentStatus: Order['paymentStatus']): Promise<Order> {
    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 500))
      const index = mockOrders.findIndex(o => o.id === id)
      if (index === -1) throw new Error('Order not found')
      const updatedOrder = { 
        ...mockOrders[index], 
        status, 
        paymentStatus,
        updatedAt: new Date().toISOString() 
      } as Order
      mockOrders[index] = updatedOrder as any
      return mockOrders[index]
    }
    return this.request<Order>(`/admin/orders/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status, paymentStatus }),
    })
  }

  async assignRider(orderId: number, riderId: number): Promise<Order> {
    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 500))
      const index = mockOrders.findIndex(o => o.id === orderId)
      if (index === -1) throw new Error('Order not found')
      const updatedOrder = { 
        ...mockOrders[index], 
        riderId,
        status: 'assigned' as const,
        assignedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString() 
      } as Order
      mockOrders[index] = updatedOrder as any
      return mockOrders[index]
    }
    return this.request<Order>(`/orders/${orderId}/assign-rider`, {
      method: 'PUT',
      body: JSON.stringify({ riderId }),
    })
  }

  async unassignRider(orderId: number): Promise<Order> {
    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 500))
      const index = mockOrders.findIndex(o => o.id === orderId)
      if (index === -1) throw new Error('Order not found')
      const updatedOrder = { 
        ...mockOrders[index], 
        riderId: undefined,
        status: 'pending' as const,
        assignedAt: undefined,
        updatedAt: new Date().toISOString() 
      } as Order
      mockOrders[index] = updatedOrder as any
      return mockOrders[index]
    }
    return this.request<Order>(`/orders/${orderId}/unassign-rider`, {
      method: 'PUT',
    })
  }

  async deleteOrder(id: number): Promise<void> {
    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 500))
      const index = mockOrders.findIndex(o => o.id === id)
      if (index === -1) throw new Error('Order not found')
      mockOrders.splice(index, 1)
      return
    }
    return this.request<void>(`/admin/orders/${id}`, {
      method: 'DELETE',
    })
  }

  // Users/Clients Management
  async getUsers(): Promise<User[]> {
    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 500))
      return [...mockUsers]
    }
    return this.request<User[]>('/admin/users')
  }

  async getUserById(id: number): Promise<User> {
    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 300))
      const user = mockUsers.find(u => u.id === id)
      if (!user) throw new Error('User not found')
      return user
    }
    return this.request<User>(`/admin/users/${id}`)
  }

  async updateUser(id: number, userData: Partial<Omit<User, 'id' | 'createdAt' | 'updatedAt'>>): Promise<User> {
    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 500))
      const index = mockUsers.findIndex(u => u.id === id)
      if (index === -1) throw new Error('User not found')
      mockUsers[index] = { ...mockUsers[index], ...userData, updatedAt: new Date().toISOString() }
      return mockUsers[index]
    }
    return this.request<User>(`/admin/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(userData),
    })
  }

  async deleteUser(id: number): Promise<void> {
    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 500))
      const index = mockUsers.findIndex(u => u.id === id)
      if (index === -1) throw new Error('User not found')
      mockUsers.splice(index, 1)
      return
    }
    return this.request<void>(`/admin/users/${id}`, {
      method: 'DELETE',
    })
  }

  async toggleUserStatus(id: number): Promise<User> {
    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 500))
      const index = mockUsers.findIndex(u => u.id === id)
      if (index === -1) throw new Error('User not found')
      mockUsers[index] = { 
        ...mockUsers[index], 
        isActive: !mockUsers[index].isActive,
        updatedAt: new Date().toISOString() 
      }
      return mockUsers[index]
    }
    return this.request<User>(`/admin/users/${id}/toggle-status`, {
      method: 'PUT',
    })
  }

  // Riders Management
  async getRiders(): Promise<Rider[]> {
    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 500))
      return []
    }
    return this.request<Rider[]>('/riders')
  }

  async getRiderById(id: number): Promise<Rider> {
    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 300))
      throw new Error('Rider not found')
    }
    return this.request<Rider>(`/riders/${id}`)
  }

  async createRider(riderData: Omit<Rider, 'id' | 'createdAt' | 'updatedAt'>): Promise<Rider> {
    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 500))
      const newRider: Rider = {
        ...riderData,
        id: Math.floor(Math.random() * 1000) + 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
      return newRider
    }
    return this.request<Rider>('/riders', {
      method: 'POST',
      body: JSON.stringify(riderData),
    })
  }

  async updateRider(id: number, riderData: Partial<Omit<Rider, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Rider> {
    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 500))
      throw new Error('Rider not found')
    }
    return this.request<Rider>(`/riders/${id}`, {
      method: 'PUT',
      body: JSON.stringify(riderData),
    })
  }

  async deleteRider(id: number): Promise<void> {
    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 500))
      return
    }
    return this.request<void>(`/riders/${id}`, {
      method: 'DELETE',
    })
  }

  async toggleRiderStatus(id: number): Promise<Rider> {
    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 500))
      throw new Error('Rider not found')
    }
    return this.request<Rider>(`/riders/${id}/toggle-active`, {
      method: 'PUT',
    })
  }

  // Dashboard Statistics
  async getDashboardStats(): Promise<DashboardStats> {
    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 500))
      return { ...mockDashboardStats }
    }
    return this.request<DashboardStats>('/admin/dashboard')
  }

  // Brands Management
  async getBrands(): Promise<Brand[]> {

    if (USE_MOCK_DATA) {

      await new Promise(resolve => setTimeout(resolve, 500))
      return []
    }

    const result = await this.request<Brand[]>('/admin/brands')

    return result
  }

  async getBrandById(id: number): Promise<Brand> {
    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 500))
      throw new Error('Brand not found')
    }
    return this.request<Brand>(`/admin/brands/${id}`)
  }

  async createBrand(brandData: Omit<Brand, 'id' | 'createdAt' | 'updatedAt'>): Promise<Brand> {
    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 500))
      const newBrand: Brand = {
        ...brandData,
        id: Math.floor(Math.random() * 1000) + 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
      return newBrand
    }
    return this.request<Brand>('/admin/brands', {
      method: 'POST',
      body: JSON.stringify(brandData),
    })
  }

  async updateBrand(id: number, brandData: Partial<Omit<Brand, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Brand> {
    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 500))
      const updatedBrand: Brand = {
        ...brandData,
        id,
        updatedAt: new Date().toISOString()
      } as Brand
      return updatedBrand
    }
    return this.request<Brand>(`/admin/brands/${id}`, {
      method: 'PUT',
      body: JSON.stringify(brandData),
    })
  }

  async deleteBrand(id: number): Promise<{ success: boolean }> {
    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 500))
      return { success: true }
    }
    return this.request<{ success: boolean }>(`/admin/brands/${id}`, {
      method: 'DELETE',
    })
  }

  // Notices Management
  async getNotices(countryId?: number, status?: number, limit?: number, offset?: number): Promise<Notice[]> {

    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 500))
      return []
    }

    const params = new URLSearchParams()
    if (countryId) params.append('countryId', countryId.toString())
    if (status !== undefined) params.append('status', status.toString())
    if (limit) params.append('limit', limit.toString())
    if (offset) params.append('offset', offset.toString())

    const url = `/notices${params.toString() ? `?${params.toString()}` : ''}`
    return this.request<Notice[]>(url)
  }

  async getActiveNotices(countryId?: number, limit?: number): Promise<Notice[]> {

    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 500))
      return []
    }

    const params = new URLSearchParams()
    if (countryId) params.append('countryId', countryId.toString())
    if (limit) params.append('limit', limit.toString())

    const url = `/notices/active${params.toString() ? `?${params.toString()}` : ''}`
    return this.request<Notice[]>(url)
  }

  async getNoticeById(id: number): Promise<Notice> {
    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 300))
      throw new Error('Notice not found')
    }
    return this.request<Notice>(`/notices/${id}`)
  }

  async createNotice(noticeData: Omit<Notice, 'id' | 'createdAt'>): Promise<Notice> {
    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 500))
      const newNotice: Notice = {
        ...noticeData,
        id: Math.floor(Math.random() * 1000) + 1,
        createdAt: new Date().toISOString()
      }
      return newNotice
    }
    return this.request<Notice>('/notices', {
      method: 'POST',
      body: JSON.stringify(noticeData),
    })
  }

  async updateNotice(id: number, noticeData: Partial<Omit<Notice, 'id' | 'createdAt'>>): Promise<Notice> {
    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 500))
      const updatedNotice: Notice = {
        ...noticeData,
        id,
        createdAt: new Date().toISOString()
      } as Notice
      return updatedNotice
    }
    return this.request<Notice>(`/notices/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(noticeData),
    })
  }

  async deleteNotice(id: number): Promise<{ success: boolean }> {
    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 500))
      return { success: true }
    }
    return this.request<{ success: boolean }>(`/notices/${id}`, {
      method: 'DELETE',
    })
  }

  async toggleNoticeStatus(id: number): Promise<Notice> {
    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 500))
      throw new Error('Notice not found')
    }
    return this.request<Notice>(`/notices/${id}/toggle-status`, {
      method: 'PATCH',
    })
  }

  async getNoticeStats(): Promise<NoticeStats> {
    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 500))
      return { total: 0, active: 0, inactive: 0 }
    }
    return this.request<NoticeStats>('/notices/stats')
  }

  // Countries Management
  async getCountries(): Promise<Country[]> {

    if (USE_MOCK_DATA) {

      await new Promise(resolve => setTimeout(resolve, 500))
      return [
        { id: 1, name: 'United States', status: 1 },
        { id: 2, name: 'Canada', status: 1 },
        { id: 3, name: 'United Kingdom', status: 1 }
      ]
    }

    try {
      const result = await this.request<Country[]>('/countries')

      return result
    } catch (error) {

      // Fallback to mock data if API fails

      return [
        { id: 1, name: 'United States', status: 1 },
        { id: 2, name: 'Canada', status: 1 },
        { id: 3, name: 'United Kingdom', status: 1 },
        { id: 4, name: 'Germany', status: 1 },
        { id: 5, name: 'France', status: 1 },
        { id: 6, name: 'Japan', status: 1 },
        { id: 7, name: 'Australia', status: 1 },
        { id: 8, name: 'Brazil', status: 1 },
        { id: 9, name: 'India', status: 1 },
        { id: 10, name: 'China', status: 1 }
      ]
    }
  }

  async getCountryById(id: number): Promise<Country> {
    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 300))
      throw new Error('Country not found')
    }
    return this.request<Country>(`/countries/${id}`)
  }

  async getCountryByName(name: string): Promise<Country> {
    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 300))
      throw new Error('Country not found')
    }
    return this.request<Country>(`/countries/name/${name}`)
  }

  // External Vehicle Database
  async getExternalVehicles(): Promise<ExternalVehicle[]> {
    return this.request<ExternalVehicle[]>('/external-vehicles')
  }

  async createExternalVehicle(data: Omit<ExternalVehicle, 'id' | 'owner'>): Promise<ExternalVehicle> {
    return this.request<ExternalVehicle>('/external-vehicles', { method: 'POST', body: JSON.stringify(data) })
  }

  async updateExternalVehicle(id: number, data: Partial<Omit<ExternalVehicle, 'id' | 'owner'>>): Promise<ExternalVehicle> {
    return this.request<ExternalVehicle>(`/external-vehicles/${id}`, { method: 'PUT', body: JSON.stringify(data) })
  }

  async deleteExternalVehicle(id: number): Promise<void> {
    return this.request<void>(`/external-vehicles/${id}`, { method: 'DELETE' })
  }

  async getExternalVehicleOwners(type?: ExternalOwnershipType): Promise<ExternalVehicleOwner[]> {
    return this.request<ExternalVehicleOwner[]>(`/external-vehicles/owners${type ? `?type=${type}` : ''}`)
  }

  async createExternalVehicleOwner(data: Omit<ExternalVehicleOwner, 'id'>): Promise<ExternalVehicleOwner> {
    return this.request<ExternalVehicleOwner>('/external-vehicles/owners', { method: 'POST', body: JSON.stringify(data) })
  }

  // Regions Management
  async getRegions(): Promise<Region[]> {

    if (USE_MOCK_DATA) {

      await new Promise(resolve => setTimeout(resolve, 500))
      return [
        { id: 1, name: 'North America', countryId: 1, status: 1 },
        { id: 2, name: 'Europe', countryId: 3, status: 1 },
        { id: 3, name: 'Asia Pacific', countryId: 6, status: 1 }
      ]
    }

    try {
      const result = await this.request<Region[]>('/regions')

      return result
    } catch (error) {

      return []
    }
  }

  async createRegion(regionData: Omit<Region, 'id'>): Promise<Region> {
    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 500))
      return { id: Date.now(), ...regionData }
    }
    return this.request<Region>('/regions', {
      method: 'POST',
      body: JSON.stringify(regionData)
    })
  }

  async updateRegion(id: number, regionData: Partial<Region>): Promise<Region> {
    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 500))
      return { id, ...regionData } as Region
    }
    return this.request<Region>(`/regions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(regionData)
    })
  }

  async deleteRegion(id: number): Promise<void> {
    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 500))
      return
    }
    return this.request<void>(`/regions/${id}`, {
      method: 'DELETE'
    })
  }

  // Stations Management
  // Station expenses
  async getStationExpenses(stationId?: number): Promise<StationExpense[]> {
    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 200))
      return []
    }
    const qs = stationId ? `?stationId=${stationId}` : ''
    try {
      return await this.request<StationExpense[]>(`/station-expenses${qs}`)
    } catch (error) {

      return []
    }
  }

  async createStationExpense(data: {
    station_id: number
    amount: number
    expense_date: string
    comment?: string
    payment_method: string
  }): Promise<StationExpense> {
    return this.request<StationExpense>('/station-expenses', {
      method: 'POST',
      body: JSON.stringify(data)
    })
  }

  async updateStationExpense(id: number, data: Partial<StationExpense>): Promise<StationExpense> {
    return this.request<StationExpense>(`/station-expenses/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    })
  }

  async deleteStationExpense(id: number): Promise<void> {
    return this.request<void>(`/station-expenses/${id}`, { method: 'DELETE' })
  }

  // Station LPG tanks
  async getStationTanks(stationId?: number): Promise<StationTank[]> {
    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 200))
      return []
    }
    const qs = stationId ? `?stationId=${stationId}` : ''
    try {
      return await this.request<StationTank[]>(`/station-tanks${qs}`)
    } catch (error) {

      return []
    }
  }

  async createStationTank(data: Partial<StationTank>): Promise<StationTank> {
    return this.request<StationTank>('/station-tanks', {
      method: 'POST',
      body: JSON.stringify(data)
    })
  }

  async updateStationTank(id: number, data: Partial<StationTank>): Promise<StationTank> {
    return this.request<StationTank>(`/station-tanks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    })
  }

  async deleteStationTank(id: number): Promise<void> {
    return this.request<void>(`/station-tanks/${id}`, { method: 'DELETE' })
  }

  async getStationLpgLedger(stationId: number): Promise<StationLpgLedgerEntry[]> {

    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 300))
      return []
    }
    try {
      return await this.request<StationLpgLedgerEntry[]>(`/stations/${stationId}/lpg-ledger`)
    } catch (error) {

      return []
    }
  }

  async getStations(): Promise<Station[]> {

    if (USE_MOCK_DATA) {

      await new Promise(resolve => setTimeout(resolve, 500))
      return [
        { id: 1, name: 'Main Station', regionId: 1, contact: '123-456-7890' },
        { id: 2, name: 'North Station', regionId: 2, contact: '234-567-8901' },
        { id: 3, name: 'South Station', regionId: 1, contact: '345-678-9012' }
      ]
    }

    try {
      const result = await this.request<Station[]>('/stations')

      return result
    } catch (error) {

      return []
    }
  }

  async createStation(stationData: Omit<Station, 'id'>): Promise<Station> {
    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 500))
      return { id: Date.now(), ...stationData }
    }
    return this.request<Station>('/stations', {
      method: 'POST',
      body: JSON.stringify(stationData)
    })
  }

  async updateStation(id: number, stationData: Partial<Station>): Promise<Station> {
    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 500))
      return { id, ...stationData } as Station
    }
    return this.request<Station>(`/stations/${id}`, {
      method: 'PUT',
      body: JSON.stringify(stationData)
    })
  }

  async deleteStation(id: number): Promise<void> {
    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 500))
      return
    }
    return this.request<void>(`/stations/${id}`, {
      method: 'DELETE'
    })
  }

  // Shifts / Attendance
  async getShifts(stationId?: number, startDate?: string, endDate?: string): Promise<Shift[]> {

    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 500))
      return []
    }
    const params = new URLSearchParams()
    if (stationId) params.append('stationId', String(stationId))
    if (startDate) params.append('startDate', startDate)
    if (endDate) params.append('endDate', endDate)
    const query = params.toString()
    const url = query ? `/shifts?${query}` : '/shifts'
    try {
      return await this.request<Shift[]>(url)
    } catch (error) {

      return []
    }
  }

  async getStaffLeaves(staffId?: number, startDate?: string, endDate?: string): Promise<StaffLeave[]> {

    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 500))
      return []
    }
    const params = new URLSearchParams()
    if (staffId) params.append('staffId', String(staffId))
    if (startDate) params.append('startDate', startDate)
    if (endDate) params.append('endDate', endDate)
    const query = params.toString()
    const url = query ? `/staff-leaves?${query}` : '/staff-leaves'
    try {
      return await this.request<StaffLeave[]>(url)
    } catch (error) {

      return []
    }
  }

  async getSalesPostings(stationId?: number): Promise<SalesPosting[]> {

    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 500))
      return []
    }
    const query = stationId ? `?stationId=${stationId}` : ''
    try {
      return await this.request<SalesPosting[]>(`/sales-postings${query}`)
    } catch (error) {

      return []
    }
  }

  async createSalesPosting(payload: CreateSalesPostingPayload): Promise<SalesPosting> {

    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 500))
      return { id: Date.now(), ...payload, notes: payload.notes || null, posted_by: null, created_at: new Date().toISOString() }
    }
    return this.request<SalesPosting>('/sales-postings', {
      method: 'POST',
      body: JSON.stringify(payload)
    })
  }

  async updateSalesPosting(id: number, payload: CreateSalesPostingPayload): Promise<SalesPosting> {

    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 500))
      return { id, ...payload, notes: payload.notes || null, posted_by: null, created_at: new Date().toISOString() }
    }
    return this.request<SalesPosting>(`/sales-postings/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    })
  }

  // Key Accounts Management
  async getKeyAccounts(): Promise<KeyAccount[]> {

    if (USE_MOCK_DATA) {

      await new Promise(resolve => setTimeout(resolve, 500))
      return [
        { 
          id: 1, 
          name: 'ABC Corporation', 
          email: 'contact@abccorp.com', 
          contact: '123-456-7890', 
          account_number: 'ACC001',
          description: 'Major corporate client',
          is_active: 1,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        { 
          id: 2, 
          name: 'XYZ Industries', 
          email: 'info@xyzind.com', 
          contact: '234-567-8901', 
          account_number: 'ACC002',
          description: 'Long-term partner',
          is_active: 1,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ]
    }

    try {
      const result = await this.request<KeyAccount[]>('/key-accounts')

      return result
    } catch (error) {

      return []
    }
  }

  async createKeyAccount(keyAccountData: Omit<KeyAccount, 'id' | 'created_at' | 'updated_at'>): Promise<KeyAccount> {
    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 500))
      return { 
        id: Date.now(), 
        ...keyAccountData,
        is_active: keyAccountData.is_active !== undefined ? keyAccountData.is_active : 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    }
    return this.request<KeyAccount>('/key-accounts', {
      method: 'POST',
      body: JSON.stringify(keyAccountData)
    })
  }

  async updateKeyAccount(id: number, keyAccountData: Partial<KeyAccount>): Promise<KeyAccount> {
    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 500))
      const existing = await this.getKeyAccounts()
      const account = existing.find(a => a.id === id)
      if (!account) throw new Error('Key account not found')
      return { 
        ...account, 
        ...keyAccountData,
        updated_at: new Date().toISOString()
      }
    }
    return this.request<KeyAccount>(`/key-accounts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(keyAccountData)
    })
  }

  async deleteKeyAccount(id: number): Promise<void> {
    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 500))
      return
    }
    return this.request<void>(`/key-accounts/${id}`, {
      method: 'DELETE'
    })
  }

  // Conversion Clients Management
  async getConversionClients(): Promise<ConversionClient[]> {

    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 500))
      return []
    }
    try {
      return await this.request<ConversionClient[]>('/conversion-clients')
    } catch (error) {

      return []
    }
  }

  async getConversionClient(id: number): Promise<ConversionClient | null> {

    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 300))
      return null
    }
    try {
      return await this.request<ConversionClient>(`/conversion-clients/${id}`)
    } catch (error) {

      return null
    }
  }

  async createConversionClient(clientData: Omit<ConversionClient, 'id' | 'account_number' | 'created_at' | 'updated_at'> & { account_number?: string }): Promise<ConversionClient> {
    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 500))
      return {
        id: Date.now(),
        account_number: `MT-${String(Date.now()).slice(-4)}`,
        ...clientData,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    }
    return this.request<ConversionClient>('/conversion-clients', {
      method: 'POST',
      body: JSON.stringify(clientData)
    })
  }

  async updateConversionClient(id: number, clientData: Partial<ConversionClient>): Promise<ConversionClient> {
    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 500))
      const existing = await this.getConversionClients()
      const client = existing.find(c => c.id === id)
      if (!client) throw new Error('Conversion client not found')
      return {
        ...client,
        ...clientData,
        updated_at: new Date().toISOString()
      }
    }
    return this.request<ConversionClient>(`/conversion-clients/${id}`, {
      method: 'PUT',
      body: JSON.stringify(clientData)
    })
  }

  async deleteConversionClient(id: number): Promise<void> {
    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 500))
      return
    }
    return this.request<void>(`/conversion-clients/${id}`, {
      method: 'DELETE'
    })
  }

  // Vehicles Management
  async getAllVehicles(): Promise<Vehicle[]> {

    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 300))
      return [
        {
          id: 1,
          key_account_id: 1,
          registration_number: 'ABC-1234',
          model: 'Toyota Camry',
          driver_name: 'John Doe',
          driver_contact: '555-0101',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ]
    }
    return this.request<Vehicle[]>('/vehicles')
  }

  async getVehiclesByKeyAccount(keyAccountId: number): Promise<Vehicle[]> {

    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 300))
      return [
        {
          id: 1,
          key_account_id: keyAccountId,
          registration_number: 'ABC-1234',
          model: 'Toyota Camry',
          driver_name: 'John Doe',
          driver_contact: '555-0101',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ]
    }
    return this.request<Vehicle[]>(`/vehicles?keyAccountId=${keyAccountId}`)
  }

  async createVehicle(vehicleData: Omit<Vehicle, 'id' | 'created_at' | 'updated_at'>): Promise<Vehicle> {
    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 500))
      return {
        id: Date.now(),
        ...vehicleData,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    }
    return this.request<Vehicle>('/vehicles', {
      method: 'POST',
      body: JSON.stringify(vehicleData)
    })
  }

  async updateVehicle(id: number, vehicleData: Partial<Vehicle>): Promise<Vehicle> {
    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 500))
      const vehicles = await this.getVehiclesByKeyAccount(vehicleData.key_account_id || 0)
      const vehicle = vehicles.find(v => v.id === id)
      if (!vehicle) throw new Error('Vehicle not found')
      return {
        ...vehicle,
        ...vehicleData,
        updated_at: new Date().toISOString()
      }
    }
    return this.request<Vehicle>(`/vehicles/${id}`, {
      method: 'PUT',
      body: JSON.stringify(vehicleData)
    })
  }

  async deleteVehicle(id: number): Promise<void> {
    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 500))
      return
    }
    return this.request<void>(`/vehicles/${id}`, {
      method: 'DELETE'
    })
  }

  // Conversion Vehicles Management
  async getAllConversionVehicles(): Promise<ConversionVehicle[]> {
    try {
      return await this.request<ConversionVehicle[]>('/conversion-vehicles')
    } catch (error) {

      return []
    }
  }

  async getConversionVehiclesByClient(conversionClientId: number): Promise<ConversionVehicle[]> {

    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 300))
      return []
    }
    try {
      return await this.request<ConversionVehicle[]>(`/conversion-vehicles?conversionClientId=${conversionClientId}`)
    } catch (error) {

      return []
    }
  }

  async getConversionVehicle(id: number): Promise<ConversionVehicle | null> {

    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 300))
      return null
    }
    try {
      return await this.request<ConversionVehicle>(`/conversion-vehicles/${id}`)
    } catch (error) {

      return null
    }
  }

  async createConversionVehicle(vehicleData: Omit<ConversionVehicle, 'id' | 'created_at' | 'updated_at'>): Promise<ConversionVehicle> {
    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 500))
      return {
        id: Date.now(),
        ...vehicleData,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    }
    return this.request<ConversionVehicle>('/conversion-vehicles', {
      method: 'POST',
      body: JSON.stringify(vehicleData)
    })
  }

  async updateConversionVehicle(id: number, vehicleData: Partial<ConversionVehicle>): Promise<ConversionVehicle> {
    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 500))
      const vehicles = await this.getConversionVehiclesByClient(vehicleData.conversion_client_id || 0)
      const vehicle = vehicles.find(v => v.id === id)
      if (!vehicle) throw new Error('Conversion vehicle not found')
      return {
        ...vehicle,
        ...vehicleData,
        updated_at: new Date().toISOString()
      }
    }
    return this.request<ConversionVehicle>(`/conversion-vehicles/${id}`, {
      method: 'PUT',
      body: JSON.stringify(vehicleData)
    })
  }

  async deleteConversionVehicle(id: number): Promise<void> {
    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 500))
      return
    }
    return this.request<void>(`/conversion-vehicles/${id}`, {
      method: 'DELETE'
    })
  }

  async analyzeVehicleImage(imageUrl: string): Promise<any> {
    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 800))
      return {
        registration_number: null,
        vin_serial_number: null,
        vehicle_type: 'SUV',
        year: 2022,
        make: 'Toyota',
        model: 'Highlander',
        trim_option: null,
        transmission_type: 'Automatic',
        driven_wheel: 'AWD',
        engine: null,
        color: 'Silver',
        confidence: 'medium',
        extractedDetails: ['vehicle_type', 'year', 'color']
      }
    }
    try {
      return await this.request<any>('/conversion-vehicles/analyze-image', {
        method: 'POST',
        body: JSON.stringify({ imageUrl })
      })
    } catch (error) {

      return null
    }
  }

  // Parts Management
  /* ── Purchase Orders ── */
  async getPurchaseOrders(): Promise<PurchaseOrder[]> {
    try { return await this.request<PurchaseOrder[]>('/part-purchase-orders') } catch { return [] }
  }
  async getPurchaseOrder(id: number): Promise<PurchaseOrder> {
    return this.request<PurchaseOrder>(`/part-purchase-orders/${id}`)
  }
  async getNextPONumber(): Promise<string> {
    const r = await this.request<{ po_number: string }>('/part-purchase-orders/next-po')
    return r.po_number
  }
  async createPurchaseOrder(data: Omit<PurchaseOrder, 'id' | 'po_number' | 'subtotal' | 'total_amount' | 'created_at' | 'updated_at'>): Promise<PurchaseOrder> {
    return this.request<PurchaseOrder>('/part-purchase-orders', { method: 'POST', body: JSON.stringify(data) })
  }
  async updatePOStatus(id: number, status: string, storeId?: number): Promise<PurchaseOrder> {
    return this.request<PurchaseOrder>(`/part-purchase-orders/${id}/status`, { method: 'PUT', body: JSON.stringify({ status, store_id: storeId }) })
  }
  async deletePurchaseOrder(id: number): Promise<void> {
    return this.request<void>(`/part-purchase-orders/${id}`, { method: 'DELETE' })
  }

  async getInventoryByPart(partId: number): Promise<any[]> {
    try { return await this.request<any[]>(`/inventory?partId=${partId}`) }
    catch { return [] }
  }

  async getInventoryByStore2(storeId: number): Promise<any[]> {
    try { return await this.request<any[]>(`/inventory?storeId=${storeId}`) }
    catch { return [] }
  }

  async getPartLedger(partId: number): Promise<PartLedgerEntry[]> {
    try { return await this.request<PartLedgerEntry[]>(`/inventory/ledger?partId=${partId}`) }
    catch { return [] }
  }

  /* ── Vendor Ledger ── */
  async getVendorLedger(vendorId: number): Promise<VendorLedgerEntry[]> {
    try { return await this.request<VendorLedgerEntry[]>(`/vendors/${vendorId}/ledger`) } catch { return [] }
  }

  /* ── Vendors ── */
  async getVendors(): Promise<Vendor[]> {
    try { return await this.request<Vendor[]>('/vendors') } catch { return [] }
  }
  async createVendor(data: Partial<Vendor>): Promise<Vendor> {
    return this.request<Vendor>('/vendors', { method: 'POST', body: JSON.stringify(data) })
  }
  async updateVendor(id: number, data: Partial<Vendor>): Promise<Vendor> {
    return this.request<Vendor>(`/vendors/${id}`, { method: 'PUT', body: JSON.stringify(data) })
  }
  async deleteVendor(id: number): Promise<void> {
    return this.request<void>(`/vendors/${id}`, { method: 'DELETE' })
  }

  /* ── Part Categories ── */
  async getPartCategories(): Promise<PartCategory[]> {
    try { return await this.request<PartCategory[]>('/part-categories') }
    catch { return [] }
  }
  async createPartCategory(data: Partial<PartCategory>): Promise<PartCategory> {
    return this.request<PartCategory>('/part-categories', { method: 'POST', body: JSON.stringify(data) })
  }
  async updatePartCategory(id: number, data: Partial<PartCategory>): Promise<PartCategory> {
    return this.request<PartCategory>(`/part-categories/${id}`, { method: 'PUT', body: JSON.stringify(data) })
  }
  async deletePartCategory(id: number): Promise<void> {
    return this.request<void>(`/part-categories/${id}`, { method: 'DELETE' })
  }

  async getParts(): Promise<Part[]> {

    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 300))
      return []
    }
    return this.request<Part[]>('/parts')
  }

  async getPartById(id: number): Promise<Part> {

    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 300))
      throw new Error('Part not found')
    }
    return this.request<Part>(`/parts/${id}`)
  }

  async createPart(partData: Omit<Part, 'id' | 'created_at' | 'updated_at'>): Promise<Part> {

    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 500))
      return {
        id: Date.now(),
        ...partData,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    }
    return this.request<Part>('/parts', {
      method: 'POST',
      body: JSON.stringify(partData)
    })
  }

  async updatePart(id: number, partData: Partial<Part>): Promise<Part> {

    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 500))
      return {
        id,
        ...partData,
        updated_at: new Date().toISOString()
      } as Part
    }
    return this.request<Part>(`/parts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(partData)
    })
  }

  async deletePart(id: number): Promise<void> {

    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 500))
      return
    }
    return this.request<void>(`/parts/${id}`, {
      method: 'DELETE'
    })
  }

  // Services (labour) Management
  async getServices(): Promise<Service[]> {

    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 300))
      return []
    }
    return this.request<Service[]>('/services')
  }

  async createService(serviceData: Omit<Service, 'id' | 'created_at' | 'updated_at'>): Promise<Service> {

    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 500))
      return {
        id: Date.now(),
        ...serviceData,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    }
    return this.request<Service>('/services', {
      method: 'POST',
      body: JSON.stringify(serviceData)
    })
  }

  async updateService(id: number, serviceData: Partial<Service>): Promise<Service> {

    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 500))
      return {
        id,
        ...serviceData,
        updated_at: new Date().toISOString()
      } as Service
    }
    return this.request<Service>(`/services/${id}`, {
      method: 'PUT',
      body: JSON.stringify(serviceData)
    })
  }

  async deleteService(id: number): Promise<void> {

    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 500))
      return
    }
    return this.request<void>(`/services/${id}`, {
      method: 'DELETE'
    })
  }

  // Job Cards Management
  async getJobCards(conversionVehicleId?: number, conversionClientId?: number): Promise<JobCard[]> {

    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 300))
      return []
    }
    const params = new URLSearchParams()
    if (conversionVehicleId) params.set('conversionVehicleId', String(conversionVehicleId))
    if (conversionClientId) params.set('conversionClientId', String(conversionClientId))
    const qs = params.toString()
    return this.request<JobCard[]>(`/job-cards${qs ? `?${qs}` : ''}`)
  }

  async getJobCard(id: number): Promise<JobCard> {

    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 300))
      throw new Error('Job card not found')
    }
    return this.request<JobCard>(`/job-cards/${id}`)
  }

  async createJobCard(data: Partial<JobCard>): Promise<JobCard> {

    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 500))
      return {
        id: Date.now(),
        ...data,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      } as JobCard
    }
    return this.request<JobCard>('/job-cards', {
      method: 'POST',
      body: JSON.stringify(data)
    })
  }

  async updateJobCard(id: number, data: Partial<JobCard>): Promise<JobCard> {

    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 500))
      return {
        id,
        ...data,
        updated_at: new Date().toISOString()
      } as JobCard
    }
    return this.request<JobCard>(`/job-cards/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    })
  }

  async deleteJobCard(id: number): Promise<void> {

    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 500))
      return
    }
    return this.request<void>(`/job-cards/${id}`, {
      method: 'DELETE'
    })
  }

  async convertJobCardToInvoice(id: number, data: { update_inventory: boolean; store_id?: number }): Promise<JobCard> {

    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 500))
      return { id, status: 'not_paid' } as JobCard
    }
    return this.request<JobCard>(`/job-cards/${id}/convert-to-invoice`, {
      method: 'POST',
      body: JSON.stringify(data)
    })
  }

  // Job Card Payments
  async getAllPayments(): Promise<JobCardPayment[]> {

    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 300))
      return []
    }
    return this.request<JobCardPayment[]>('/payments')
  }

  async getJobCardPayments(jobCardId: number): Promise<JobCardPayment[]> {

    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 300))
      return []
    }
    return this.request<JobCardPayment[]>(`/job-cards/${jobCardId}/payments`)
  }

  async createJobCardPayment(
    jobCardId: number,
    data: {
      amount: number
      payment_method: JobCardPaymentMethod
      payment_date: string
      reference?: string
      notes?: string
    }
  ): Promise<JobCardPayment> {

    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 500))
      return {
        id: Date.now(),
        job_card_id: jobCardId,
        ...data,
        created_at: new Date().toISOString()
      } as JobCardPayment
    }
    return this.request<JobCardPayment>(`/job-cards/${jobCardId}/payments`, {
      method: 'POST',
      body: JSON.stringify(data)
    })
  }

  // Vehicle Inspections
  async getVehicleInspections(conversionVehicleId: number): Promise<VehicleInspection[]> {

    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 300))
      return []
    }
    return this.request<VehicleInspection[]>(`/vehicle-inspections?conversionVehicleId=${conversionVehicleId}`)
  }

  async getVehicleInspection(id: number): Promise<VehicleInspection> {

    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 300))
      throw new Error('Inspection not found')
    }
    return this.request<VehicleInspection>(`/vehicle-inspections/${id}`)
  }

  async createVehicleInspection(data: Partial<VehicleInspection>): Promise<VehicleInspection> {

    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 500))
      return {
        id: Date.now(),
        ...data,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      } as VehicleInspection
    }
    return this.request<VehicleInspection>('/vehicle-inspections', {
      method: 'POST',
      body: JSON.stringify(data)
    })
  }

  async updateVehicleInspection(id: number, data: Partial<VehicleInspection>): Promise<VehicleInspection> {

    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 500))
      return {
        id,
        ...data,
        updated_at: new Date().toISOString()
      } as VehicleInspection
    }
    return this.request<VehicleInspection>(`/vehicle-inspections/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    })
  }

  async deleteVehicleInspection(id: number): Promise<void> {

    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 500))
      return
    }
    return this.request<void>(`/vehicle-inspections/${id}`, {
      method: 'DELETE'
    })
  }

  // Checklist Templates
  async getChecklistTemplates(): Promise<ChecklistTemplate[]> {

    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 300))
      return []
    }
    return this.request<ChecklistTemplate[]>('/checklist-templates')
  }

  async getChecklistTemplate(id: number): Promise<ChecklistTemplate> {

    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 300))
      throw new Error('Checklist template not found')
    }
    return this.request<ChecklistTemplate>(`/checklist-templates/${id}`)
  }

  async createChecklistTemplate(data: Partial<ChecklistTemplate>): Promise<ChecklistTemplate> {

    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 500))
      return {
        id: Date.now(),
        ...data,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      } as ChecklistTemplate
    }
    return this.request<ChecklistTemplate>('/checklist-templates', {
      method: 'POST',
      body: JSON.stringify(data)
    })
  }

  async updateChecklistTemplate(id: number, data: Partial<ChecklistTemplate>): Promise<ChecklistTemplate> {

    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 500))
      return {
        id,
        ...data,
        updated_at: new Date().toISOString()
      } as ChecklistTemplate
    }
    return this.request<ChecklistTemplate>(`/checklist-templates/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    })
  }

  async deleteChecklistTemplate(id: number): Promise<void> {

    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 500))
      return
    }
    return this.request<void>(`/checklist-templates/${id}`, {
      method: 'DELETE'
    })
  }

  // Appointments
  async getAppointments(): Promise<Appointment[]> {

    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 300))
      return []
    }
    return this.request<Appointment[]>('/appointments')
  }

  async createAppointment(data: Partial<Appointment>): Promise<Appointment> {

    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 500))
      return {
        id: Date.now(),
        ...data,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      } as Appointment
    }
    return this.request<Appointment>('/appointments', {
      method: 'POST',
      body: JSON.stringify(data)
    })
  }

  async updateAppointment(id: number, data: Partial<Appointment>): Promise<Appointment> {

    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 500))
      return {
        id,
        ...data,
        updated_at: new Date().toISOString()
      } as Appointment
    }
    return this.request<Appointment>(`/appointments/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    })
  }

  async deleteAppointment(id: number): Promise<void> {

    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 500))
      return
    }
    return this.request<void>(`/appointments/${id}`, {
      method: 'DELETE'
    })
  }

  // Stores Management
  async getStores(): Promise<Store[]> {

    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 300))
      return []
    }
    return this.request<Store[]>('/stores')
  }

  async getStoreById(id: number): Promise<Store> {

    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 300))
      throw new Error('Store not found')
    }
    return this.request<Store>(`/stores/${id}`)
  }

  async createStore(storeData: Omit<Store, 'id' | 'created_at'>): Promise<Store> {

    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 500))
      return {
        id: Date.now(),
        ...storeData,
        created_at: new Date().toISOString()
      }
    }
    return this.request<Store>('/stores', {
      method: 'POST',
      body: JSON.stringify(storeData)
    })
  }

  async updateStore(id: number, storeData: Partial<Store>): Promise<Store> {

    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 500))
      return {
        id,
        ...storeData,
        created_at: new Date().toISOString()
      } as Store
    }
    return this.request<Store>(`/stores/${id}`, {
      method: 'PUT',
      body: JSON.stringify(storeData)
    })
  }

  async deleteStore(id: number): Promise<void> {

    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 500))
      return
    }
    return this.request<void>(`/stores/${id}`, {
      method: 'DELETE'
    })
  }

  // Parts Inventory Management
  async getInventory(storeId?: number, partId?: number): Promise<Inventory[]> {

    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 300))
      return []
    }
    let url = '/inventory'
    const params = new URLSearchParams()
    if (storeId) params.append('storeId', storeId.toString())
    if (partId) params.append('partId', partId.toString())
    if (params.toString()) url += `?${params.toString()}`
    return this.request<Inventory[]>(url)
  }

  async getInventoryById(id: number): Promise<Inventory> {

    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 300))
      throw new Error('Inventory not found')
    }
    return this.request<Inventory>(`/inventory/${id}`)
  }

  async createInventory(inventoryData: Omit<Inventory, 'id' | 'last_updated'>): Promise<Inventory> {

    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 500))
      return {
        id: Date.now(),
        ...inventoryData,
        last_updated: new Date().toISOString()
      }
    }
    return this.request<Inventory>('/inventory', {
      method: 'POST',
      body: JSON.stringify(inventoryData)
    })
  }

  async updateInventory(id: number, inventoryData: Partial<Inventory>): Promise<Inventory> {

    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 500))
      return {
        id,
        ...inventoryData,
        last_updated: new Date().toISOString()
      } as Inventory
    }
    return this.request<Inventory>(`/inventory/${id}`, {
      method: 'PUT',
      body: JSON.stringify(inventoryData)
    })
  }

  async deleteInventory(id: number): Promise<void> {

    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 500))
      return
    }
    return this.request<void>(`/inventory/${id}`, {
      method: 'DELETE'
    })
  }

  // Records a stock movement against the audit ledger (parts_inventory_ledger)
  // instead of silently overwriting the quantity — use this for any user-facing
  // stock change so there's a "who/when/why" trail.
  async recordInventoryTransaction(transaction: {
    store_id: number
    part_id: number
    transaction_type: 'IN' | 'OUT' | 'ADJUSTMENT' | 'TRANSFER_IN' | 'TRANSFER_OUT'
    quantity: number
    reference_number?: string
    notes?: string
    created_by?: number
  }): Promise<{ inventory: Inventory; ledger: PartLedgerEntry }> {

    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 500))
      const now = new Date().toISOString()
      return {
        inventory: { id: Date.now(), store_id: transaction.store_id, part_id: transaction.part_id, quantity: transaction.quantity, last_updated: now },
        ledger: {
          id: Date.now(), inventory_id: Date.now(), store_id: transaction.store_id, part_id: transaction.part_id,
          transaction_type: transaction.transaction_type, quantity: transaction.quantity,
          previous_quantity: 0, new_quantity: transaction.quantity,
          reference_number: transaction.reference_number || null, notes: transaction.notes || null,
          created_by: transaction.created_by || null, created_at: now
        }
      }
    }
    return this.request<{ inventory: Inventory; ledger: PartLedgerEntry }>('/inventory/transaction', {
      method: 'POST',
      body: JSON.stringify(transaction)
    })
  }

  // Fuel Prices Management
  async createFuelPrice(fuelPriceData: Omit<FuelPrice, 'id' | 'created_at'>): Promise<FuelPrice> {
    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 500))
      return { 
        id: Date.now(), 
        ...fuelPriceData, 
        created_at: new Date().toISOString() 
      }
    }
    return this.request<FuelPrice>('/fuel-prices', {
      method: 'POST',
      body: JSON.stringify(fuelPriceData)
    })
  }

  async getFuelPricesByStation(stationId: number): Promise<FuelPrice[]> {

    if (USE_MOCK_DATA) {

      await new Promise(resolve => setTimeout(resolve, 500))
      return [
        { 
          id: 1, 
          stationId, 
          price: 2.50, 
          fuelType: 'Regular', 
          notes: 'Initial price',
          created_at: new Date().toISOString()
        },
        { 
          id: 2, 
          stationId, 
          price: 2.75, 
          fuelType: 'Regular', 
          notes: 'Price increase',
          created_at: new Date(Date.now() - 86400000).toISOString()
        }
      ]
    }

    try {
      const result = await this.request<FuelPrice[]>(`/fuel-prices/station/${stationId}`)

      return result
    } catch (error) {

      return []
    }
  }

  async updateFuelPrice(id: number, fuelPriceData: Partial<FuelPrice>): Promise<FuelPrice> {
    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 500))
      return { id, ...fuelPriceData } as FuelPrice
    }
    return this.request<FuelPrice>(`/fuel-prices/${id}`, {
      method: 'PUT',
      body: JSON.stringify(fuelPriceData)
    })
  }

  async deleteFuelPrice(id: number): Promise<void> {
    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 500))
      return
    }
    return this.request<void>(`/fuel-prices/${id}`, {
      method: 'DELETE'
    })
  }

  // Inventory
  async getStationInventory(): Promise<StationInventory[]> {

    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 500))
      return []
    }
    return this.request<StationInventory[]>('/inventory/stations')
  }

  async getInventoryLedger(stationId?: number): Promise<InventoryLedger[]> {

    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 500))
      return []
    }
    const url = stationId ? `/inventory?stationId=${stationId}` : '/inventory'
    return this.request<InventoryLedger[]>(url)
  }

  async getInventoryReport(): Promise<InventoryLedger[]> {

    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 500))
      return []
    }
    return this.request<InventoryLedger[]>('/inventory/report')
  }

  async createInventoryLedger(ledgerData: {
    stationId: number
    transactionType: 'IN' | 'OUT' | 'ADJUSTMENT'
    quantity: number
    referenceNumber?: string
    notes?: string
    createdBy?: number
  }): Promise<InventoryLedger> {

    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 500))
      return {
        id: 1,
        ...ledgerData,
        previousQuantity: 0,
        newQuantity: ledgerData.quantity,
        referenceNumber: ledgerData.referenceNumber || null,
        notes: ledgerData.notes || null,
        createdBy: ledgerData.createdBy || null,
        created_at: new Date().toISOString()
      } as InventoryLedger
    }
    return this.request<InventoryLedger>('/inventory', {
      method: 'POST',
      body: JSON.stringify(ledgerData)
    })
  }

  async updateInventoryLedger(id: number, ledgerData: Partial<InventoryLedger>): Promise<InventoryLedger> {
    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 500))
      return { id, ...ledgerData } as InventoryLedger
    }
    return this.request<InventoryLedger>(`/inventory/${id}`, {
      method: 'PUT',
      body: JSON.stringify(ledgerData)
    })
  }

  async deleteInventoryLedger(id: number): Promise<void> {
    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 500))
      return
    }
    return this.request<void>(`/inventory/${id}`, {
      method: 'DELETE'
    })
  }

  // Key Account Ledger Management
  async getKeyAccountLedger(keyAccountId?: number): Promise<KeyAccountLedger[]> {

    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 500))
      return []
    }
    const url = keyAccountId ? `/key-account-ledger?keyAccountId=${keyAccountId}` : '/key-account-ledger'
    return this.request<KeyAccountLedger[]>(url)
  }

  async getKeyAccountLedgerByKeyAccount(keyAccountId: number): Promise<KeyAccountLedger[]> {

    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 500))
      return []
    }
    return this.request<KeyAccountLedger[]>(`/key-account-ledger/key-account/${keyAccountId}`)
  }

  async createKeyAccountLedger(ledgerData: {
    keyAccountId: number
    vehicleId?: number
    stationId: number
    transactionDate: string
    transactionType: 'SALE' | 'PAYMENT' | 'ADJUSTMENT'
    quantity?: number
    unitPrice?: number
    totalAmount: number
    debit?: number
    credit?: number
    referenceNumber?: string
    description?: string
    notes?: string
    createdBy?: number
  }): Promise<KeyAccountLedger> {

    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 500))
      return {
        id: 1,
        ...ledgerData,
        quantity: ledgerData.quantity || 0,
        unitPrice: ledgerData.unitPrice || 0,
        debit: ledgerData.debit || 0,
        credit: ledgerData.credit || 0,
        balance: ledgerData.totalAmount,
        referenceNumber: ledgerData.referenceNumber || null,
        description: ledgerData.description || null,
        notes: ledgerData.notes || null,
        createdBy: ledgerData.createdBy || null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      } as KeyAccountLedger
    }
    return this.request<KeyAccountLedger>('/key-account-ledger', {
      method: 'POST',
      body: JSON.stringify(ledgerData)
    })
  }

  // Sales Management
  async createSale(saleData: {
    stationId: number
    clientType: 'regular' | 'key_account'
    keyAccountId?: number
    vehicleId?: number
    quantity: number
    unitPrice: number
    totalAmount: number
    saleDate: string
    referenceNumber?: string
    notes?: string
    createdBy?: number
  }): Promise<Sale> {

    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 500))
      return {
        id: 1,
        ...saleData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      } as Sale
    }
    return this.request<Sale>('/sales', {
      method: 'POST',
      body: JSON.stringify(saleData)
    })
  }

  async getSales(stationId?: number, keyAccountId?: number, conversionClientId?: number): Promise<Sale[]> {

    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 500))
      return []
    }
    const params = new URLSearchParams()
    if (stationId) params.append('stationId', String(stationId))
    if (keyAccountId) params.append('keyAccountId', String(keyAccountId))
    if (conversionClientId) params.append('conversionClientId', String(conversionClientId))
    const query = params.toString()
    const url = query ? `/sales?${query}` : '/sales'
    return this.request<Sale[]>(url)
  }

  async getDailySalesTotals(params: SalesPageParams): Promise<DailySalesTotal[]> {
    const qs = new URLSearchParams()
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') qs.append(k, String(v))
    })
    return this.request<DailySalesTotal[]>(`/sales/report/daily?${qs.toString()}`)
  }

  async getSalesPage(params: SalesPageParams): Promise<SalesPageResult> {
    const qs = new URLSearchParams()
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') qs.append(k, String(v))
    })
    return this.request<SalesPageResult>(`/sales/report/list?${qs.toString()}`)
  }

  async getWeeklySalesReport(startDate: string, endDate: string, stationId?: number): Promise<WeeklySalesReport> {

    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 500))
      return { startDate, endDate, vehicles: [] }
    }
    const params = new URLSearchParams({ startDate, endDate })
    if (stationId) params.append('stationId', String(stationId))
    return this.request<WeeklySalesReport>(`/sales/report/weekly?${params.toString()}`)
  }

  async getVehicleFuelReport(startDate: string, endDate: string, stationId?: number): Promise<VehicleFuelReport> {

    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 500))
      return { startDate, endDate, vehicles: [] }
    }
    const params = new URLSearchParams({ startDate, endDate })
    if (stationId) params.append('stationId', String(stationId))
    return this.request<VehicleFuelReport>(`/sales/report/fuel?${params.toString()}`)
  }

  // Conversions Management
  async createConversion(conversionData: {
    ownerFullName: string
    nationalId?: string
    passportId?: string
    contact: string
    email?: string
    vehicleRegistration: string
    make?: string
    model?: string
    yearOfManufacture?: number
    engineCapacity?: number
    vinChassisNumber?: string
    currentFuelType: 'petrol' | 'diesel' | 'hybrid'
    logbookNumber?: string
    createdBy?: number
  }): Promise<Conversion> {

    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 500))
      return {
        id: 1,
        ...conversionData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      } as Conversion
    }
    return this.request<Conversion>('/conversions', {
      method: 'POST',
      body: JSON.stringify(conversionData)
    })
  }

  async getConversions(): Promise<Conversion[]> {

    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 500))
      return []
    }
    return this.request<Conversion[]>('/conversions')
  }

  async getConversionById(id: number): Promise<Conversion> {

    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 500))
      throw new Error('Conversion not found')
    }
    return this.request<Conversion>(`/conversions/${id}`)
  }

  async updateConversion(id: number, updateData: Partial<Conversion>): Promise<Conversion> {

    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 500))
      return {
        id,
        ...updateData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      } as Conversion
    }
    return this.request<Conversion>(`/conversions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updateData)
    })
  }

  // Sales Analytics
  async getSalesAnalytics(year?: number): Promise<{
    totalRevenue: number
    totalOrders: number
    averageOrderValue: number
    monthlyData: Array<{
      month: string
      revenue: number
      orders: number
    }>
    topClients: Array<{
      client: User
      totalOrders: number
      totalRevenue: number
    }>
  }> {
    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 500))
      const orders = await this.getOrders()

      const targetYear = year || new Date().getFullYear()
      const filteredOrders = orders.filter(order => 
        new Date(order.createdAt).getFullYear() === targetYear
      )

      const monthlyData = Array.from({ length: 12 }, (_, i) => {
        const month = new Date(0, i).toLocaleString('default', { month: 'short' })
        const monthOrders = filteredOrders.filter(order => 
          new Date(order.createdAt).getMonth() === i
        )
        return {
          month,
          revenue: monthOrders.reduce((sum, order) => sum + order.total, 0),
          orders: monthOrders.length
        }
      })

      const clientMap = new Map<number, { client: User; totalOrders: number; totalRevenue: number }>()

      filteredOrders.forEach(order => {
        if (!clientMap.has(order.userId)) {
          clientMap.set(order.userId, {
            client: order.user,
            totalOrders: 0,
            totalRevenue: 0
          })
        }
        const clientData = clientMap.get(order.userId)!
        clientData.totalOrders++
        clientData.totalRevenue += order.total
      })

      const topClients = Array.from(clientMap.values())
        .sort((a, b) => b.totalRevenue - a.totalRevenue)
        .slice(0, 10)

      return {
        totalRevenue: filteredOrders.reduce((sum, order) => sum + order.total, 0),
        totalOrders: filteredOrders.length,
        averageOrderValue: filteredOrders.length > 0 
          ? filteredOrders.reduce((sum, order) => sum + order.total, 0) / filteredOrders.length 
          : 0,
        monthlyData,
        topClients
      }
    }
    return this.request<{
      totalRevenue: number
      totalOrders: number
      averageOrderValue: number
      monthlyData: Array<{
        month: string
        revenue: number
        orders: number
      }>
      topClients: Array<{
        client: User
        totalOrders: number
        totalRevenue: number
      }>
    }>(`/admin/sales/analytics${year ? `?year=${year}` : ''}`)
  }

  // Sales Orders API (using sales_orders table)
  async getSalesOrders(year?: number, limit?: number, offset?: number): Promise<SalesOrder[]> {
    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 500))
      return []
    }

    const params = new URLSearchParams()
    if (year) params.append('year', year.toString())
    if (limit) params.append('limit', limit.toString())
    if (offset) params.append('offset', offset.toString())

    const url = `/admin/sales/orders${params.toString() ? `?${params.toString()}` : ''}`
    return this.request<SalesOrder[]>(url)
  }

  // Get all clients from Clients table
  async getAllClients(): Promise<Array<{
    id: number
    name: string
    email?: string
    contact: string
    address?: string
    region: string
    regionId: number
    routeName?: string
    routeId?: number
    balance?: number
    latitude?: number
    longitude?: number
  }>> {
    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 500))

      // Mock clients data based on the schema
      const mockClients = [
        {
          id: 1,
          name: 'ABC Corporation',
          email: 'contact@abccorp.com',
          contact: '+1-555-0101',
          address: '123 Business St, New York, NY 10001',
          region: 'North Region',
          regionId: 1,
          routeName: 'Route A',
          routeId: 1,
          balance: 5000.00,
          latitude: 40.7128,
          longitude: -74.0060
        },
        {
          id: 2,
          name: 'XYZ Industries',
          email: 'orders@xyzind.com',
          contact: '+1-555-0102',
          address: '456 Industrial Ave, Los Angeles, CA 90210',
          region: 'West Region',
          regionId: 2,
          routeName: 'Route B',
          routeId: 2,
          balance: 3200.50,
          latitude: 34.0522,
          longitude: -118.2437
        },
        {
          id: 3,
          name: 'Tech Solutions Ltd',
          email: 'info@techsolutions.com',
          contact: '+1-555-0103',
          address: '789 Tech Blvd, San Francisco, CA 94105',
          region: 'West Region',
          regionId: 2,
          routeName: 'Route C',
          routeId: 3,
          balance: 7500.75,
          latitude: 37.7749,
          longitude: -122.4194
        },
        {
          id: 4,
          name: 'Global Trading Co',
          email: 'sales@globaltrading.com',
          contact: '+1-555-0104',
          address: '321 Trade Center, Chicago, IL 60601',
          region: 'Central Region',
          regionId: 3,
          routeName: 'Route D',
          routeId: 4,
          balance: 2100.25,
          latitude: 41.8781,
          longitude: -87.6298
        },
        {
          id: 5,
          name: 'Local Restaurant',
          email: 'manager@localrestaurant.com',
          contact: '+1-555-0105',
          address: '654 Main St, Boston, MA 02101',
          region: 'East Region',
          regionId: 4,
          routeName: 'Route E',
          routeId: 5,
          balance: 1200.00,
          latitude: 42.3601,
          longitude: -71.0589
        },
        {
          id: 6,
          name: 'New Client Inc',
          email: 'new@newclient.com',
          contact: '+1-555-0106',
          address: '999 New St, Miami, FL 33101',
          region: 'South Region',
          regionId: 5,
          routeName: 'Route F',
          routeId: 6,
          balance: 0.00,
          latitude: 25.7617,
          longitude: -80.1918
        }
      ]

      return mockClients
    }

    const url = '/admin/sales/clients-list'
    return this.request<Array<{
      id: number
      name: string
      email?: string
      contact: string
      address?: string
      region: string
      regionId: number
      routeName?: string
      routeId?: number
      balance?: number
      latitude?: number
      longitude?: number
    }>>(url)
  }

  // Get sales data for a specific client
  async getClientSalesData(clientId: number, year?: number): Promise<{
    clientId: number
    clientName: string
    clientEmail: string
    clientPhone: string
    clientCompany?: string
    clientStatus: string
    monthlyData: Array<{
      month: string
      year: number
      monthNumber: number
      totalOrders: number
      totalAmount: number
      orders: SalesOrder[]
    }>
    totalOrders: number
    totalAmount: number
    averageOrderValue: number
  } | null> {
    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 500))

      // Return mock sales data for the client
      const mockSalesData = {
        clientId,
        clientName: `Client ${clientId}`,
        clientEmail: `client${clientId}@example.com`,
        clientPhone: `+1-555-0${100 + clientId}`,
        clientCompany: `Company ${clientId}`,
        clientStatus: 'active',
        monthlyData: Array.from({ length: 12 }, (_, i) => ({
          month: new Date(0, i).toLocaleString('default', { month: 'short' }),
          year: year || 2025,
          monthNumber: i,
          totalOrders: Math.floor(Math.random() * 5),
          totalAmount: Math.floor(Math.random() * 10000),
          orders: []
        })),
        totalOrders: Math.floor(Math.random() * 50),
        totalAmount: Math.floor(Math.random() * 100000),
        averageOrderValue: Math.floor(Math.random() * 5000)
      }

      return mockSalesData
    }

    const url = `/admin/sales/client/${clientId}/sales${year ? `?year=${year}` : ''}`
    return this.request<{
      clientId: number
      clientName: string
      clientEmail: string
      clientPhone: string
      clientCompany?: string
      clientStatus: string
      monthlyData: Array<{
        month: string
        year: number
        monthNumber: number
        totalOrders: number
        totalAmount: number
        orders: SalesOrder[]
      }>
      totalOrders: number
      totalAmount: number
      averageOrderValue: number
    } | null>(url)
  }

  // Get order items for a specific client and month
  async getClientOrderItems(clientId: number, year: number, month: number): Promise<OrderItem[]> {

    if (USE_MOCK_DATA) {

      await new Promise(resolve => setTimeout(resolve, 300))

      // Mock order items data
      const mockOrderItems: OrderItem[] = [
        {
          id: 1,
          salesOrderId: 1,
          productId: 1,
          productName: 'Craft IPA Beer - Premium Blend',
          quantity: 2,
          unitPrice: 8.99,
          totalPrice: 17.98,
          orderDate: '2025-01-15',
          soNumber: 'SO-001'
        },
        {
          id: 2,
          salesOrderId: 1,
          productId: 2,
          productName: 'Cabernet Sauvignon - Reserve 2020',
          quantity: 1,
          unitPrice: 24.99,
          totalPrice: 24.99,
          orderDate: '2025-01-15',
          soNumber: 'SO-001'
        },
        {
          id: 3,
          salesOrderId: 2,
          productId: 3,
          productName: 'Wheat Beer - Organic',
          quantity: 3,
          unitPrice: 7.99,
          totalPrice: 23.97,
          orderDate: '2025-01-20',
          soNumber: 'SO-002'
        },
        {
          id: 4,
          salesOrderId: 2,
          productId: 4,
          productName: 'Chardonnay - White Wine',
          quantity: 2,
          unitPrice: 19.99,
          totalPrice: 39.98,
          orderDate: '2025-01-20',
          soNumber: 'SO-002'
        },
        {
          id: 5,
          salesOrderId: 3,
          productId: 5,
          productName: 'Premium Vodka - Distilled',
          quantity: 1,
          unitPrice: 45.99,
          totalPrice: 45.99,
          orderDate: '2025-01-25',
          soNumber: 'SO-003'
        }
      ]

      return mockOrderItems
    }

    const url = `/admin/sales/client/${clientId}/order-items?year=${year}&month=${month}`

    try {
      const result = await this.request<OrderItem[]>(url)

      return result
    } catch (error) {

      throw error
    }
  }

  // Get sales data for multiple clients at once (optimized)
  async getBulkClientSalesData(clientIds: number[], year?: number): Promise<Array<{
    clientId: number
    clientName: string
    clientEmail: string
    clientPhone: string
    clientCompany?: string
    clientStatus: string
    monthlyData: Array<{
      month: string
      year: number
      monthNumber: number
      totalOrders: number
      totalAmount: number
      orders: SalesOrder[]
    }>
    totalOrders: number
    totalAmount: number
    averageOrderValue: number
  }>> {
    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 300))

      // Return mock sales data for multiple clients
      return clientIds.map(clientId => ({
        clientId,
        clientName: `Client ${clientId}`,
        clientEmail: `client${clientId}@example.com`,
        clientPhone: `+1-555-0${100 + clientId}`,
        clientCompany: `Company ${clientId}`,
        clientStatus: 'active',
        monthlyData: Array.from({ length: 12 }, (_, i) => ({
          month: new Date(0, i).toLocaleString('default', { month: 'short' }),
          year: year || 2025,
          monthNumber: i + 1,
          totalOrders: Math.floor(Math.random() * 5),
          totalAmount: Math.floor(Math.random() * 10000),
          orders: []
        })),
        totalOrders: Math.floor(Math.random() * 50),
        totalAmount: Math.floor(Math.random() * 100000),
        averageOrderValue: Math.floor(Math.random() * 5000)
      }))
    }

    const url = `/admin/sales/bulk-sales-data`
    return this.request<Array<{
      clientId: number
      clientName: string
      clientEmail: string
      clientPhone: string
      clientCompany?: string
      clientStatus: string
      monthlyData: Array<{
        month: string
        year: number
        monthNumber: number
        totalOrders: number
        totalAmount: number
        orders: SalesOrder[]
      }>
      totalOrders: number
      totalAmount: number
      averageOrderValue: number
    }>>(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ clientIds, year })
    })
  }

  // Get product performance data
  async getProductPerformance(year?: number): Promise<ProductPerformanceData[]> {

    if (USE_MOCK_DATA) {

      await new Promise(resolve => setTimeout(resolve, 500))

      // Mock product performance data
      const mockProductPerformance: ProductPerformanceData[] = [
        {
          productId: 1,
          productName: 'Craft IPA Beer',
          totalQuantitySold: 45,
          totalRevenue: 404.55,
          averagePrice: 8.99,
          orderCount: 12,
          lastSoldDate: '2025-01-25',
          monthlyData: [
            { month: 'January', monthNumber: 1, quantity: 45, revenue: 404.55, orderCount: 12 },
            { month: 'February', monthNumber: 2, quantity: 0, revenue: 0, orderCount: 0 },
            { month: 'March', monthNumber: 3, quantity: 0, revenue: 0, orderCount: 0 },
            { month: 'April', monthNumber: 4, quantity: 0, revenue: 0, orderCount: 0 },
            { month: 'May', monthNumber: 5, quantity: 0, revenue: 0, orderCount: 0 },
            { month: 'June', monthNumber: 6, quantity: 0, revenue: 0, orderCount: 0 },
            { month: 'July', monthNumber: 7, quantity: 0, revenue: 0, orderCount: 0 },
            { month: 'August', monthNumber: 8, quantity: 0, revenue: 0, orderCount: 0 },
            { month: 'September', monthNumber: 9, quantity: 0, revenue: 0, orderCount: 0 },
            { month: 'October', monthNumber: 10, quantity: 0, revenue: 0, orderCount: 0 },
            { month: 'November', monthNumber: 11, quantity: 0, revenue: 0, orderCount: 0 },
            { month: 'December', monthNumber: 12, quantity: 0, revenue: 0, orderCount: 0 }
          ]
        },
        {
          productId: 2,
          productName: 'Cabernet Sauvignon',
          totalQuantitySold: 18,
          totalRevenue: 449.82,
          averagePrice: 24.99,
          orderCount: 8,
          lastSoldDate: '2025-01-20',
          monthlyData: [
            { month: 'January', monthNumber: 1, quantity: 18, revenue: 449.82, orderCount: 8 },
            { month: 'February', monthNumber: 2, quantity: 0, revenue: 0, orderCount: 0 },
            { month: 'March', monthNumber: 3, quantity: 0, revenue: 0, orderCount: 0 },
            { month: 'April', monthNumber: 4, quantity: 0, revenue: 0, orderCount: 0 },
            { month: 'May', monthNumber: 5, quantity: 0, revenue: 0, orderCount: 0 },
            { month: 'June', monthNumber: 6, quantity: 0, revenue: 0, orderCount: 0 },
            { month: 'July', monthNumber: 7, quantity: 0, revenue: 0, orderCount: 0 },
            { month: 'August', monthNumber: 8, quantity: 0, revenue: 0, orderCount: 0 },
            { month: 'September', monthNumber: 9, quantity: 0, revenue: 0, orderCount: 0 },
            { month: 'October', monthNumber: 10, quantity: 0, revenue: 0, orderCount: 0 },
            { month: 'November', monthNumber: 11, quantity: 0, revenue: 0, orderCount: 0 },
            { month: 'December', monthNumber: 12, quantity: 0, revenue: 0, orderCount: 0 }
          ]
        },
        {
          productId: 3,
          productName: 'Wheat Beer',
          totalQuantitySold: 32,
          totalRevenue: 255.68,
          averagePrice: 7.99,
          orderCount: 10,
          lastSoldDate: '2025-01-22',
          monthlyData: [
            { month: 'January', monthNumber: 1, quantity: 32, revenue: 255.68, orderCount: 10 },
            { month: 'February', monthNumber: 2, quantity: 0, revenue: 0, orderCount: 0 },
            { month: 'March', monthNumber: 3, quantity: 0, revenue: 0, orderCount: 0 },
            { month: 'April', monthNumber: 4, quantity: 0, revenue: 0, orderCount: 0 },
            { month: 'May', monthNumber: 5, quantity: 0, revenue: 0, orderCount: 0 },
            { month: 'June', monthNumber: 6, quantity: 0, revenue: 0, orderCount: 0 },
            { month: 'July', monthNumber: 7, quantity: 0, revenue: 0, orderCount: 0 },
            { month: 'August', monthNumber: 8, quantity: 0, revenue: 0, orderCount: 0 },
            { month: 'September', monthNumber: 9, quantity: 0, revenue: 0, orderCount: 0 },
            { month: 'October', monthNumber: 10, quantity: 0, revenue: 0, orderCount: 0 },
            { month: 'November', monthNumber: 11, quantity: 0, revenue: 0, orderCount: 0 },
            { month: 'December', monthNumber: 12, quantity: 0, revenue: 0, orderCount: 0 }
          ]
        }
      ]

      return mockProductPerformance
    }

    const url = `/admin/sales/products/performance${year ? `?year=${year}` : ''}`

    try {
      const result = await this.request<ProductPerformanceData[]>(url)

      return result
    } catch (error) {

      throw error
    }
  }

  // Get product performance summary
  async getProductPerformanceSummary(year?: number): Promise<ProductPerformanceSummary> {

    if (USE_MOCK_DATA) {

      await new Promise(resolve => setTimeout(resolve, 200))

      const mockSummary: ProductPerformanceSummary = {
        totalProducts: 3,
        totalRevenue: 1110.05,
        totalQuantitySold: 95,
        averageOrderValue: 37.00,
        topPerformingProduct: {
          productName: 'Cabernet Sauvignon',
          revenue: 449.82
        }
      }

      return mockSummary
    }

    const url = `/admin/sales/products/performance/summary${year ? `?year=${year}` : ''}`

    try {
      const result = await this.request<ProductPerformanceSummary>(url)

      return result
    } catch (error) {

      throw error
    }
  }

  async getAllClientSalesData(year?: number): Promise<Array<{
    clientId: number
    clientName: string
    clientEmail: string
    clientPhone: string
    clientCompany?: string
    clientStatus: string
    monthlyData: Array<{
      month: string
      year: number
      monthNumber: number
      totalOrders: number
      totalAmount: number
      orders: SalesOrder[]
    }>
    totalOrders: number
    totalAmount: number
    averageOrderValue: number
  }>> {
    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 500))

      // Mock clients data - showing ALL clients (even those with no sales)
      const mockClients = [
        {
          clientId: 1,
          clientName: 'ABC Corporation',
          clientEmail: 'contact@abccorp.com',
          clientPhone: '+1-555-0101',
          clientCompany: 'ABC Corporation',
          clientStatus: 'active',
          monthlyData: [
            { month: 'Jan', year: 2025, monthNumber: 0, totalOrders: 2, totalAmount: 15000, orders: [] },
            { month: 'Feb', year: 2025, monthNumber: 1, totalOrders: 3, totalAmount: 22000, orders: [] },
            { month: 'Mar', year: 2025, monthNumber: 2, totalOrders: 2, totalAmount: 18000, orders: [] },
            { month: 'Apr', year: 2025, monthNumber: 3, totalOrders: 4, totalAmount: 25000, orders: [] },
            { month: 'May', year: 2025, monthNumber: 4, totalOrders: 5, totalAmount: 30000, orders: [] },
            { month: 'Jun', year: 2025, monthNumber: 5, totalOrders: 4, totalAmount: 28000, orders: [] },
            { month: 'Jul', year: 2025, monthNumber: 6, totalOrders: 6, totalAmount: 32000, orders: [] },
            { month: 'Aug', year: 2025, monthNumber: 7, totalOrders: 7, totalAmount: 35000, orders: [] },
            { month: 'Sep', year: 2025, monthNumber: 8, totalOrders: 5, totalAmount: 29000, orders: [] },
            { month: 'Oct', year: 2025, monthNumber: 9, totalOrders: 6, totalAmount: 31000, orders: [] },
            { month: 'Nov', year: 2025, monthNumber: 10, totalOrders: 5, totalAmount: 27000, orders: [] },
            { month: 'Dec', year: 2025, monthNumber: 11, totalOrders: 7, totalAmount: 33000, orders: [] }
          ],
          totalOrders: 56,
          totalAmount: 320000,
          averageOrderValue: 5714.29
        },
        {
          clientId: 2,
          clientName: 'XYZ Industries',
          clientEmail: 'orders@xyzind.com',
          clientPhone: '+1-555-0102',
          clientCompany: 'XYZ Industries',
          clientStatus: 'active',
          monthlyData: [
            { month: 'Jan', year: 2025, monthNumber: 0, totalOrders: 2, totalAmount: 12000, orders: [] },
            { month: 'Feb', year: 2025, monthNumber: 1, totalOrders: 3, totalAmount: 15000, orders: [] },
            { month: 'Mar', year: 2025, monthNumber: 2, totalOrders: 0, totalAmount: 0, orders: [] },
            { month: 'Apr', year: 2025, monthNumber: 3, totalOrders: 4, totalAmount: 20000, orders: [] },
            { month: 'May', year: 2025, monthNumber: 4, totalOrders: 5, totalAmount: 25000, orders: [] },
            { month: 'Jun', year: 2025, monthNumber: 5, totalOrders: 3, totalAmount: 18000, orders: [] },
            { month: 'Jul', year: 2025, monthNumber: 6, totalOrders: 4, totalAmount: 22000, orders: [] },
            { month: 'Aug', year: 2025, monthNumber: 7, totalOrders: 6, totalAmount: 28000, orders: [] },
            { month: 'Sep', year: 2025, monthNumber: 8, totalOrders: 5, totalAmount: 24000, orders: [] },
            { month: 'Oct', year: 2025, monthNumber: 9, totalOrders: 6, totalAmount: 26000, orders: [] },
            { month: 'Nov', year: 2025, monthNumber: 10, totalOrders: 4, totalAmount: 19000, orders: [] },
            { month: 'Dec', year: 2025, monthNumber: 11, totalOrders: 7, totalAmount: 30000, orders: [] }
          ],
          totalOrders: 49,
          totalAmount: 240000,
          averageOrderValue: 4897.96
        },
        {
          clientId: 3,
          clientName: 'Tech Solutions Ltd',
          clientEmail: 'info@techsolutions.com',
          clientPhone: '+1-555-0103',
          clientCompany: 'Tech Solutions Ltd',
          clientStatus: 'active',
          monthlyData: [
            { month: 'Jan', year: 2025, monthNumber: 0, totalOrders: 1, totalAmount: 8000, orders: [] },
            { month: 'Feb', year: 2025, monthNumber: 1, totalOrders: 2, totalAmount: 12000, orders: [] },
            { month: 'Mar', year: 2025, monthNumber: 2, totalOrders: 3, totalAmount: 15000, orders: [] },
            { month: 'Apr', year: 2025, monthNumber: 3, totalOrders: 4, totalAmount: 18000, orders: [] },
            { month: 'May', year: 2025, monthNumber: 4, totalOrders: 0, totalAmount: 0, orders: [] },
            { month: 'Jun', year: 2025, monthNumber: 5, totalOrders: 5, totalAmount: 20000, orders: [] },
            { month: 'Jul', year: 2025, monthNumber: 6, totalOrders: 6, totalAmount: 25000, orders: [] },
            { month: 'Aug', year: 2025, monthNumber: 7, totalOrders: 5, totalAmount: 22000, orders: [] },
            { month: 'Sep', year: 2025, monthNumber: 8, totalOrders: 7, totalAmount: 28000, orders: [] },
            { month: 'Oct', year: 2025, monthNumber: 9, totalOrders: 8, totalAmount: 30000, orders: [] },
            { month: 'Nov', year: 2025, monthNumber: 10, totalOrders: 6, totalAmount: 24000, orders: [] },
            { month: 'Dec', year: 2025, monthNumber: 11, totalOrders: 9, totalAmount: 35000, orders: [] }
          ],
          totalOrders: 56,
          totalAmount: 229000,
          averageOrderValue: 4089.29
        },
        {
          clientId: 4,
          clientName: 'Global Trading Co',
          clientEmail: 'sales@globaltrading.com',
          clientPhone: '+1-555-0104',
          clientCompany: 'Global Trading Co',
          clientStatus: 'active',
          monthlyData: [
            { month: 'Jan', year: 2025, monthNumber: 0, totalOrders: 0, totalAmount: 0, orders: [] },
            { month: 'Feb', year: 2025, monthNumber: 1, totalOrders: 0, totalAmount: 0, orders: [] },
            { month: 'Mar', year: 2025, monthNumber: 2, totalOrders: 2, totalAmount: 10000, orders: [] },
            { month: 'Apr', year: 2025, monthNumber: 3, totalOrders: 3, totalAmount: 15000, orders: [] },
            { month: 'May', year: 2025, monthNumber: 4, totalOrders: 4, totalAmount: 20000, orders: [] },
            { month: 'Jun', year: 2025, monthNumber: 5, totalOrders: 3, totalAmount: 18000, orders: [] },
            { month: 'Jul', year: 2025, monthNumber: 6, totalOrders: 5, totalAmount: 22000, orders: [] },
            { month: 'Aug', year: 2025, monthNumber: 7, totalOrders: 6, totalAmount: 25000, orders: [] },
            { month: 'Sep', year: 2025, monthNumber: 8, totalOrders: 7, totalAmount: 28000, orders: [] },
            { month: 'Oct', year: 2025, monthNumber: 9, totalOrders: 8, totalAmount: 30000, orders: [] },
            { month: 'Nov', year: 2025, monthNumber: 10, totalOrders: 9, totalAmount: 32000, orders: [] },
            { month: 'Dec', year: 2025, monthNumber: 11, totalOrders: 10, totalAmount: 35000, orders: [] }
          ],
          totalOrders: 57,
          totalAmount: 225000,
          averageOrderValue: 3947.37
        },
        {
          clientId: 5,
          clientName: 'Local Restaurant',
          clientEmail: 'manager@localrestaurant.com',
          clientPhone: '+1-555-0105',
          clientCompany: 'Local Restaurant',
          clientStatus: 'active',
          monthlyData: [
            { month: 'Jan', year: 2025, monthNumber: 0, totalOrders: 1, totalAmount: 5000, orders: [] },
            { month: 'Feb', year: 2025, monthNumber: 1, totalOrders: 1, totalAmount: 6000, orders: [] },
            { month: 'Mar', year: 2025, monthNumber: 2, totalOrders: 1, totalAmount: 7000, orders: [] },
            { month: 'Apr', year: 2025, monthNumber: 3, totalOrders: 1, totalAmount: 8000, orders: [] },
            { month: 'May', year: 2025, monthNumber: 4, totalOrders: 1, totalAmount: 9000, orders: [] },
            { month: 'Jun', year: 2025, monthNumber: 5, totalOrders: 1, totalAmount: 10000, orders: [] },
            { month: 'Jul', year: 2025, monthNumber: 6, totalOrders: 1, totalAmount: 11000, orders: [] },
            { month: 'Aug', year: 2025, monthNumber: 7, totalOrders: 1, totalAmount: 12000, orders: [] },
            { month: 'Sep', year: 2025, monthNumber: 8, totalOrders: 1, totalAmount: 13000, orders: [] },
            { month: 'Oct', year: 2025, monthNumber: 9, totalOrders: 1, totalAmount: 14000, orders: [] },
            { month: 'Nov', year: 2025, monthNumber: 10, totalOrders: 1, totalAmount: 15000, orders: [] },
            { month: 'Dec', year: 2025, monthNumber: 11, totalOrders: 1, totalAmount: 16000, orders: [] }
          ],
          totalOrders: 12,
          totalAmount: 126000,
          averageOrderValue: 10500.00
        },
        {
          clientId: 6,
          clientName: 'Inactive Client',
          clientEmail: 'old@inactive.com',
          clientPhone: '+1-555-0106',
          clientCompany: 'Inactive Corp',
          clientStatus: 'inactive',
          monthlyData: Array.from({ length: 12 }, (_, i) => ({
            month: new Date(0, i).toLocaleString('default', { month: 'short' }),
            year: 2025,
            monthNumber: i,
            totalOrders: 0,
            totalAmount: 0,
            orders: []
          })),
          totalOrders: 0,
          totalAmount: 0,
          averageOrderValue: 0
        },
        {
          clientId: 7,
          clientName: 'New Client',
          clientEmail: 'new@newclient.com',
          clientPhone: '+1-555-0107',
          clientCompany: 'New Client Inc',
          clientStatus: 'active',
          monthlyData: Array.from({ length: 12 }, (_, i) => ({
            month: new Date(0, i).toLocaleString('default', { month: 'short' }),
            year: 2025,
            monthNumber: i,
            totalOrders: 0,
            totalAmount: 0,
            orders: []
          })),
          totalOrders: 0,
          totalAmount: 0,
          averageOrderValue: 0
        },
        {
          clientId: 8,
          clientName: 'Suspended Client',
          clientEmail: 'suspended@client.com',
          clientPhone: '+1-555-0108',
          clientCompany: 'Suspended Corp',
          clientStatus: 'suspended',
          monthlyData: Array.from({ length: 12 }, (_, i) => ({
            month: new Date(0, i).toLocaleString('default', { month: 'short' }),
            year: 2025,
            monthNumber: i,
            totalOrders: 0,
            totalAmount: 0,
            orders: []
          })),
          totalOrders: 0,
          totalAmount: 0,
          averageOrderValue: 0
        }
      ]

      return mockClients
    }

    const url = `/admin/sales/clients${year ? `?year=${year}` : ''}`
    return this.request<Array<{
      clientId: number
      clientName: string
      clientEmail: string
      clientPhone: string
      clientCompany?: string
      clientStatus: string
      monthlyData: Array<{
        month: string
        year: number
        monthNumber: number
        totalOrders: number
        totalAmount: number
        orders: SalesOrder[]
      }>
      totalOrders: number
      totalAmount: number
      averageOrderValue: number
    }>>(url)
  }

  // Receivable Aging API methods
  async getReceivableAging(): Promise<ReceivableAgingData[]> {
    const url = '/admin/receivable-aging';

    return this.request<ReceivableAgingData[]>(url);
  }

  async getReceivableAgingSummary(): Promise<ReceivableAgingSummary> {
    const url = '/admin/receivable-aging/summary';

    return this.request<ReceivableAgingSummary>(url);
  }

  // Invoices API methods
  async getInvoices(page: number = 1, limit: number = 10, search?: string, status?: string, myStatus?: number): Promise<{ invoices: InvoiceData[], total: number }> {

    if (USE_MOCK_DATA) {

      const mockInvoices: InvoiceData[] = [
        {
          id: 1,
          soNumber: 'SO-001',
          clientId: 1,
          clientName: 'ABC Company Ltd',
          clientEmail: 'contact@abccompany.com',
          clientPhone: '+1234567890',
          orderDate: new Date('2024-12-01'),
          expectedDeliveryDate: new Date('2024-12-05'),
          subtotal: 4300,
          taxAmount: 700,
          totalAmount: 5000,
          netPrice: 4300,
          notes: 'Urgent delivery required',
          createdBy: 'admin',
          salesrep: 1,
          createdAt: new Date('2024-12-01'),
          updatedAt: new Date('2024-12-01'),
          riderId: 1,
          assignedAt: new Date('2024-12-01'),
          recipientsName: 'John Doe',
          recipientsContact: '+1234567890',
          dispatchedBy: 1,
          status: 'confirmed',
          myStatus: 3,
          receivedIntoStock: false,
          deliveredAt: null,
          deliveryNotes: null,
          receivedBy: null,
          receivedAt: null,
          deliveryImage: null,
          returnedAt: null,
        },
        {
          id: 2,
          soNumber: 'SO-002',
          clientId: 2,
          clientName: 'XYZ Corporation',
          clientEmail: 'billing@xyzcorp.com',
          clientPhone: '+1987654321',
          orderDate: new Date('2024-12-02'),
          expectedDeliveryDate: new Date('2024-12-06'),
          subtotal: 2800,
          taxAmount: 400,
          totalAmount: 3200,
          netPrice: 2800,
          notes: 'Standard delivery',
          createdBy: 'admin',
          salesrep: 2,
          createdAt: new Date('2024-12-02'),
          updatedAt: new Date('2024-12-02'),
          riderId: 2,
          assignedAt: new Date('2024-12-02'),
          recipientsName: 'Jane Smith',
          recipientsContact: '+1987654321',
          dispatchedBy: 2,
          status: 'shipped',
          myStatus: 3,
          receivedIntoStock: true,
          deliveredAt: null,
          deliveryNotes: null,
          receivedBy: null,
          receivedAt: null,
          deliveryImage: null,
          returnedAt: null,
        },
        {
          id: 3,
          soNumber: 'SO-003',
          clientId: 3,
          clientName: 'Global Industries',
          clientEmail: 'accounts@globalind.com',
          clientPhone: '+1122334455',
          orderDate: new Date('2024-12-03'),
          expectedDeliveryDate: new Date('2024-12-07'),
          subtotal: 6500,
          taxAmount: 1000,
          totalAmount: 7500,
          netPrice: 6500,
          notes: 'Bulk order - priority',
          createdBy: 'admin',
          salesrep: 1,
          createdAt: new Date('2024-12-03'),
          updatedAt: new Date('2024-12-03'),
          riderId: 3,
          assignedAt: new Date('2024-12-03'),
          recipientsName: 'Bob Johnson',
          recipientsContact: '+1122334455',
          dispatchedBy: 3,
          status: 'delivered',
          myStatus: 3,
          receivedIntoStock: true,
          deliveredAt: new Date('2024-12-07'),
          deliveryNotes: 'Delivered successfully',
          receivedBy: 1,
          receivedAt: new Date('2024-12-07'),
          deliveryImage: 'delivery_001.jpg',
          returnedAt: null,
        },
        {
          id: 4,
          soNumber: 'SO-004',
          clientId: 1,
          clientName: 'ABC Company Ltd',
          clientEmail: 'contact@abccompany.com',
          clientPhone: '+1234567890',
          orderDate: new Date('2024-12-04'),
          expectedDeliveryDate: new Date('2024-12-08'),
          subtotal: 1800,
          taxAmount: 300,
          totalAmount: 2100,
          netPrice: 1800,
          notes: 'Follow-up order',
          createdBy: 'admin',
          salesrep: 2,
          createdAt: new Date('2024-12-04'),
          updatedAt: new Date('2024-12-04'),
          riderId: 1,
          assignedAt: new Date('2024-12-04'),
          recipientsName: 'Alice Brown',
          recipientsContact: '+1555666777',
          dispatchedBy: 1,
          status: 'paid',
          myStatus: 3,
          receivedIntoStock: true,
          deliveredAt: new Date('2024-12-08'),
          deliveryNotes: 'Payment received',
          receivedBy: 2,
          receivedAt: new Date('2024-12-08'),
          deliveryImage: 'delivery_002.jpg',
          returnedAt: null,
        },
        {
          id: 5,
          soNumber: 'SO-005',
          clientId: 2,
          clientName: 'XYZ Corporation',
          clientEmail: 'billing@xyzcorp.com',
          clientPhone: '+1987654321',
          orderDate: new Date('2024-12-05'),
          expectedDeliveryDate: new Date('2024-12-09'),
          subtotal: 4200,
          taxAmount: 600,
          totalAmount: 4800,
          netPrice: 4200,
          notes: 'Payment pending',
          createdBy: 'admin',
          salesrep: 1,
          createdAt: new Date('2024-12-05'),
          updatedAt: new Date('2024-12-05'),
          riderId: 2,
          assignedAt: new Date('2024-12-05'),
          recipientsName: 'Charlie Wilson',
          recipientsContact: '+1444333222',
          dispatchedBy: 2,
          status: 'in payment',
          myStatus: 2,
          receivedIntoStock: false,
          deliveredAt: null,
          deliveryNotes: null,
          receivedBy: null,
          receivedAt: null,
          deliveryImage: null,
          returnedAt: null,
        }
      ];

      // Apply filters
      let filteredInvoices = mockInvoices;

      if (search) {
        const searchLower = search.toLowerCase();
        filteredInvoices = filteredInvoices.filter(invoice =>
          invoice.soNumber.toLowerCase().includes(searchLower) ||
          invoice.clientName.toLowerCase().includes(searchLower) ||
          invoice.clientEmail.toLowerCase().includes(searchLower) ||
          invoice.clientPhone.toString().includes(search)
        );
      }

      if (status) {
        filteredInvoices = filteredInvoices.filter(invoice => invoice.status === status);
      }

      if (myStatus !== undefined) {
        filteredInvoices = filteredInvoices.filter(invoice => invoice.myStatus === myStatus);
      }

      // Apply pagination
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedInvoices = filteredInvoices.slice(startIndex, endIndex);

      return {
        invoices: paginatedInvoices,
        total: filteredInvoices.length
      };
    }

    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });

    if (search) params.append('search', search);
    if (status) params.append('status', status);
    if (myStatus) params.append('myStatus', myStatus);

    const url = `/admin/invoices?${params.toString()}`;

    try {
      const response = await this.request<{ invoices: InvoiceData[], total: number }>(url);

      return response;
    } catch (error) {

      throw error;
    }
  }

  async getInvoiceSummary(): Promise<InvoiceSummary> {
    if (USE_MOCK_DATA) {

      return {
        totalInvoices: 5,
        totalAmount: 22600,
        totalSubtotal: 19600,
        totalTax: 3000,
        statusCounts: {
          draft: 0,
          confirmed: 1,
          shipped: 1,
          delivered: 1,
          cancelled: 0,
          inPayment: 1,
          paid: 1,
        },
        myStatusCounts: {
          status1: 0,
          status2: 1,
          status3: 4,
          status4: 0,
          status5: 0,
        }
      };
    }

    const url = '/admin/invoices/summary';

    return this.request<InvoiceSummary>(url);
  }

  async getInvoiceById(id: number): Promise<InvoiceData | null> {
    if (USE_MOCK_DATA) {

      // Return the first mock invoice for any ID
      return {
        id: 1,
        soNumber: 'SO-001',
        clientId: 1,
        clientName: 'ABC Company Ltd',
        clientEmail: 'contact@abccompany.com',
        clientPhone: '+1234567890',
        orderDate: new Date('2024-12-01'),
        expectedDeliveryDate: new Date('2024-12-05'),
        subtotal: 4300,
        taxAmount: 700,
        totalAmount: 5000,
        netPrice: 4300,
        notes: 'Urgent delivery required',
        createdBy: 'admin',
        salesrep: 1,
        createdAt: new Date('2024-12-01'),
        updatedAt: new Date('2024-12-01'),
        riderId: 1,
        assignedAt: new Date('2024-12-01'),
        recipientsName: 'John Doe',
        recipientsContact: '+1234567890',
        dispatchedBy: 1,
        status: 'confirmed',
        myStatus: 3,
        receivedIntoStock: false,
        deliveredAt: null,
        deliveryNotes: null,
        receivedBy: null,
        receivedAt: null,
        deliveryImage: null,
        returnedAt: null,
      };
    }

    const url = `/admin/invoices/${id}`;

    return this.request<InvoiceData | null>(url);
  }

  async getInvoiceOrderItems(id: number): Promise<any[]> {
    if (USE_MOCK_DATA) {

      return [
        {
          id: 1,
          salesOrderId: id,
          productId: 1,
          productName: 'Premium Wine - Cabernet Sauvignon',
          quantity: 2,
          unitPrice: 45.00,
          taxAmount: 14.40,
          totalPrice: 104.40,
          taxType: '16%',
          netPrice: 90.00,
          unitCost: 30.00,
          costPrice: 60.00,
          shippedQuantity: 2
        },
        {
          id: 2,
          salesOrderId: id,
          productId: 2,
          productName: 'Craft Beer - IPA',
          quantity: 6,
          unitPrice: 8.50,
          taxAmount: 8.16,
          totalPrice: 59.16,
          taxType: '16%',
          netPrice: 51.00,
          unitCost: 5.00,
          costPrice: 30.00,
          shippedQuantity: 6
        },
        {
          id: 3,
          salesOrderId: id,
          productId: 3,
          productName: 'Premium Vodka - Distilled',
          quantity: 1,
          unitPrice: 65.00,
          taxAmount: 10.40,
          totalPrice: 75.40,
          taxType: '16%',
          netPrice: 65.00,
          unitCost: 40.00,
          costPrice: 40.00,
          shippedQuantity: 1
        }
      ];
    }

    const url = `/admin/invoices/${id}/order-items`;

    return this.request<any[]>(url);
  }

  // Sales Representatives Management
  async getSalesReps(): Promise<SalesRep[]> {

    if (USE_MOCK_DATA) {

      await new Promise(resolve => setTimeout(resolve, 500))

      // Mock sales reps data based on the schema
      const mockSalesReps: SalesRep[] = [
        {
          id: 1,
          name: 'John Smith',
          email: 'john.smith@moonsun.com',
          phoneNumber: '+1-555-0101',
          photoUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face',
          countryId: 1,
          country: 'United States',
          region_id: 1,
          region: 'North Region',
          route_id: 1,
          route: 'Route A',
          route_id_update: 1,
          route_name_update: 'Route A Updated',
          visits_targets: 50,
          new_clients: 10,
          vapes_targets: 200,
          pouches_targets: 150,
          role: 'SALES_REP',
          manager_type: 1,
          status: 1,
          createdAt: '2024-01-15T10:00:00Z'
        },
        {
          id: 2,
          name: 'Sarah Johnson',
          email: 'sarah.johnson@moonsun.com',
          phoneNumber: '+1-555-0102',
          photoUrl: 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=150&h=150&fit=crop&crop=face',
          countryId: 1,
          country: 'United States',
          region_id: 2,
          region: 'West Region',
          route_id: 2,
          route: 'Route B',
          route_id_update: 2,
          route_name_update: 'Route B Updated',
          visits_targets: 45,
          new_clients: 8,
          vapes_targets: 180,
          pouches_targets: 120,
          role: 'SENIOR_SALES_REP',
          manager_type: 2,
          status: 1,
          createdAt: '2024-02-01T14:30:00Z'
        },
        {
          id: 3,
          name: 'Mike Wilson',
          email: 'mike.wilson@moonsun.com',
          phoneNumber: '+1-555-0103',
          photoUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face',
          countryId: 2,
          country: 'Canada',
          region_id: 3,
          region: 'Central Region',
          route_id: 3,
          route: 'Route C',
          route_id_update: 3,
          route_name_update: 'Route C Updated',
          visits_targets: 40,
          new_clients: 12,
          vapes_targets: 160,
          pouches_targets: 140,
          role: 'SALES_REP',
          manager_type: 1,
          status: 0,
          createdAt: '2024-02-15T09:15:00Z'
        },
        {
          id: 4,
          name: 'Emily Davis',
          email: 'emily.davis@moonsun.com',
          phoneNumber: '+1-555-0104',
          countryId: 1,
          country: 'United States',
          region_id: 4,
          region: 'East Region',
          route_id: 4,
          route: 'Route D',
          route_id_update: 4,
          route_name_update: 'Route D Updated',
          visits_targets: 55,
          new_clients: 15,
          vapes_targets: 220,
          pouches_targets: 180,
          role: 'SALES_MANAGER',
          manager_type: 3,
          status: 1,
          createdAt: '2024-03-01T11:45:00Z'
        },
        {
          id: 5,
          name: 'David Brown',
          email: 'david.brown@moonsun.com',
          phoneNumber: '+1-555-0105',
          countryId: 3,
          country: 'United Kingdom',
          region_id: 5,
          region: 'South Region',
          route_id: 5,
          route: 'Route E',
          route_id_update: 5,
          route_name_update: 'Route E Updated',
          visits_targets: 35,
          new_clients: 6,
          vapes_targets: 140,
          pouches_targets: 100,
          role: 'SALES_REP',
          manager_type: 1,
          status: 1,
          createdAt: '2024-03-15T16:20:00Z'
        }
      ]

      return mockSalesReps
    }

    return this.request<SalesRep[]>('/sales-reps')
  }

  async getSalesRepById(id: number): Promise<SalesRep> {
    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 300))
      const salesReps = await this.getSalesReps()
      const salesRep = salesReps.find(rep => rep.id === id)
      if (!salesRep) throw new Error('Sales representative not found')
      return salesRep
    }
    return this.request<SalesRep>(`/sales-reps/${id}`)
  }

  async createSalesRep(salesRepData: Omit<SalesRep, 'id' | 'createdAt'>): Promise<SalesRep> {
    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 500))
      const newSalesRep: SalesRep = {
        ...salesRepData,
        id: Math.floor(Math.random() * 1000) + 100,
        createdAt: new Date().toISOString()
      }
      return newSalesRep
    }
    return this.request<SalesRep>('/sales-reps', {
      method: 'POST',
      body: JSON.stringify(salesRepData),
    })
  }

  async updateSalesRep(id: number, salesRepData: Partial<Omit<SalesRep, 'id' | 'createdAt'>>): Promise<SalesRep> {
    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 500))
      const salesReps = await this.getSalesReps()
      const salesRep = salesReps.find(rep => rep.id === id)
      if (!salesRep) throw new Error('Sales representative not found')
      const updatedSalesRep = { ...salesRep, ...salesRepData }
      return updatedSalesRep
    }
    return this.request<SalesRep>(`/sales-reps/${id}`, {
      method: 'PUT',
      body: JSON.stringify(salesRepData),
    })
  }

  async deleteSalesRep(id: number): Promise<{ message: string }> {
    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 500))
      return { message: 'Sales representative deleted successfully' }
    }
    return this.request<{ message: string }>(`/sales-reps/${id}`, {
      method: 'DELETE',
    })
  }

  async getSalesRepStats(): Promise<SalesRepStats> {
    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 300))
      const salesReps = await this.getSalesReps()

      const total = salesReps.length
      const active = salesReps.filter(rep => rep.status === 1).length
      const inactive = total - active

      const byCountry = salesReps.reduce((acc, rep) => {
        acc[rep.country] = (acc[rep.country] || 0) + 1
        return acc
      }, {} as Record<string, number>)

      const byRegion = salesReps.reduce((acc, rep) => {
        acc[rep.region] = (acc[rep.region] || 0) + 1
        return acc
      }, {} as Record<string, number>)

      return {
        total,
        active,
        inactive,
        byCountry,
        byRegion
      }
    }

    return this.request<SalesRepStats>('/sales-reps/stats')
  }

  async getSalesRepCountries(): Promise<Country[]> {

    if (USE_MOCK_DATA) {

      await new Promise(resolve => setTimeout(resolve, 300))

      // Mock countries data
      const mockCountries: Country[] = [
        { id: 1, name: 'United States', status: 1 },
        { id: 2, name: 'Canada', status: 1 },
        { id: 3, name: 'United Kingdom', status: 1 },
        { id: 4, name: 'Germany', status: 1 },
        { id: 5, name: 'France', status: 1 },
        { id: 6, name: 'Japan', status: 1 },
        { id: 7, name: 'Australia', status: 1 },
        { id: 8, name: 'Brazil', status: 1 },
        { id: 9, name: 'India', status: 1 },
        { id: 10, name: 'China', status: 1 }
      ]

      return mockCountries
    }

    try {
      const result = await this.request<Country[]>('/sales-reps/countries')

      return result
    } catch (error) {

      throw error
    }
  }

  async getSalesRepRegions(countryId?: number): Promise<Region[]> {

    if (USE_MOCK_DATA) {

      await new Promise(resolve => setTimeout(resolve, 300))

      // Mock regions data
      const mockRegions: Region[] = [
        { id: 1, name: 'Nairobi', countryId: 1, status: 1 },
        { id: 2, name: 'Mombasa', countryId: 1, status: 1 },
        { id: 3, name: 'Tanzania', countryId: 2, status: 1 },
        { id: 4, name: 'North Region', countryId: 1, status: 1 },
        { id: 5, name: 'West Region', countryId: 1, status: 1 }
      ]

      const filteredRegions = countryId 
        ? mockRegions.filter(region => region.countryId === countryId)
        : mockRegions

      return filteredRegions
    }

    const url = countryId 
      ? `/sales-reps/regions?countryId=${countryId}`
      : '/sales-reps/regions'

    try {
      const result = await this.request<Region[]>(url)

      return result
    } catch (error) {

      throw error
    }
  }

  async getSalesRepRoutes(regionId?: number): Promise<Route[]> {

    if (USE_MOCK_DATA) {

      await new Promise(resolve => setTimeout(resolve, 300))

      // Mock routes data
      const mockRoutes: Route[] = [
        {
          id: 1,
          name: 'NANYUKI/NYERI/MERU/EMBU',
          region: 1,
          region_name: 'Nairobi',
          country_id: 1,
          country_name: 'Kenya',
          sales_rep_id: 1,
          sales_rep_name: 'Benjamin',
          leader_id: 0,
          leader_name: '',
          status: 1
        },
        {
          id: 2,
          name: 'NAROK TOWN/MAASAI MARA/KERICHO/KISII/BOMET',
          region: 1,
          region_name: 'Nairobi',
          country_id: 1,
          country_name: 'Kenya',
          sales_rep_id: 1,
          sales_rep_name: 'Benjamin',
          leader_id: 0,
          leader_name: '',
          status: 1
        },
        {
          id: 3,
          name: 'NAIVASHA/NYANDARUA/MAI MAHIU/NAKURU',
          region: 1,
          region_name: 'Nairobi',
          country_id: 1,
          country_name: 'Kenya',
          sales_rep_id: 0,
          sales_rep_name: '',
          leader_id: 0,
          leader_name: '',
          status: 1
        }
      ]

      const filteredRoutes = regionId 
        ? mockRoutes.filter(route => route.region === regionId)
        : mockRoutes

      return filteredRoutes
    }

    const url = regionId 
      ? `/sales-reps/routes?regionId=${regionId}`
      : '/sales-reps/routes'

    try {
      const result = await this.request<Route[]>(url)

      return result
    } catch (error) {

      throw error
    }
  }

  // Sales Rep Attendance Management
  async getSalesRepAttendanceRecords(
    salesRepId?: number,
    startDate?: string,
    endDate?: string,
    status?: number,
    limit: number = 50,
    offset: number = 0
  ): Promise<AttendanceRecord[]> {

    if (USE_MOCK_DATA) {

      await new Promise(resolve => setTimeout(resolve, 500))

      // Mock attendance records
      const today = new Date().toISOString().split('T')[0]
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]

      const mockRecords: AttendanceRecord[] = [
        {
          id: 1,
          userId: 1,
          salesRepName: 'John Doe',
          salesRepEmail: 'john.doe@example.com',
          timezone: 'UTC',
          duration: 480, // 8 hours in minutes
          status: 1,
          sessionStart: `${today} 08:00:00`,
          sessionEnd: `${today} 16:00:00`,
          country: 'Kenya',
          region: 'Nairobi',
          route: 'NANYUKI/NYERI/MERU/EMBU'
        },
        {
          id: 2,
          userId: 2,
          salesRepName: 'Jane Smith',
          salesRepEmail: 'jane.smith@example.com',
          timezone: 'UTC',
          duration: 360, // 6 hours in minutes
          status: 1,
          sessionStart: `${today} 09:00:00`,
          sessionEnd: `${today} 15:00:00`,
          country: 'Kenya',
          region: 'Mombasa',
          route: 'MOMBASA/KILIFI'
        },
        {
          id: 3,
          userId: 3,
          salesRepName: 'Mike Johnson',
          salesRepEmail: 'mike.johnson@example.com',
          timezone: 'UTC',
          duration: 420, // 7 hours in minutes
          status: 1,
          sessionStart: `${today} 08:30:00`,
          sessionEnd: `${today} 15:30:00`,
          country: 'Kenya',
          region: 'Nairobi',
          route: 'NAIROBI/CENTRAL'
        },
        {
          id: 4,
          userId: 4,
          salesRepName: 'Sarah Wilson',
          salesRepEmail: 'sarah.wilson@example.com',
          timezone: 'UTC',
          duration: 300, // 5 hours in minutes
          status: 0,
          sessionStart: `${today} 10:00:00`,
          sessionEnd: `${today} 15:00:00`,
          country: 'Uganda',
          region: 'Kampala',
          route: 'KAMPALA/NORTH'
        },
        {
          id: 5,
          userId: 5,
          salesRepName: 'David Brown',
          salesRepEmail: 'david.brown@example.com',
          timezone: 'UTC',
          duration: 540, // 9 hours in minutes
          status: 1,
          sessionStart: `${today} 07:00:00`,
          sessionEnd: `${today} 16:00:00`,
          country: 'Tanzania',
          region: 'Dar es Salaam',
          route: 'DAR_ES_SALAAM/CENTRAL'
        },
        {
          id: 6,
          userId: 6,
          salesRepName: 'Alice Johnson',
          salesRepEmail: 'alice.johnson@example.com',
          timezone: 'UTC',
          duration: 480, // 8 hours in minutes
          status: 1,
          sessionStart: `${yesterday} 09:00:00`,
          sessionEnd: `${yesterday} 17:00:00`,
          country: 'Kenya',
          region: 'Nairobi',
          route: 'NAIROBI/WEST'
        },
        {
          id: 7,
          userId: 7,
          salesRepName: 'Bob Wilson',
          salesRepEmail: 'bob.wilson@example.com',
          timezone: 'UTC',
          duration: 360, // 6 hours in minutes
          status: 0,
          sessionStart: `${tomorrow} 10:00:00`,
          sessionEnd: `${tomorrow} 16:00:00`,
          country: 'Uganda',
          region: 'Kampala',
          route: 'KAMPALA/SOUTH'
        }
      ]

      // Apply filters
      let filteredRecords = mockRecords

      if (salesRepId) {

        filteredRecords = filteredRecords.filter(record => record.userId === salesRepId)
      }

      if (status !== undefined) {

        filteredRecords = filteredRecords.filter(record => record.status === status)
      }

      if (startDate) {

        // Extract just the date part from sessionStart for comparison
        filteredRecords = filteredRecords.filter(record => {
          const recordDate = record.sessionStart.split(' ')[0] // Get YYYY-MM-DD part
          const result = recordDate >= startDate

          return result
        })

      }

      if (endDate) {

        // Extract just the date part from sessionStart for comparison
        filteredRecords = filteredRecords.filter(record => {
          const recordDate = record.sessionStart.split(' ')[0] // Get YYYY-MM-DD part
          const result = recordDate <= endDate

          return result
        })

      }

      // Apply pagination
      const paginatedRecords = filteredRecords.slice(offset, offset + limit)

      return paginatedRecords
    }

    const params = new URLSearchParams()
    if (salesRepId) params.append('salesRepId', salesRepId.toString())
    if (startDate) params.append('startDate', startDate)
    if (endDate) params.append('endDate', endDate)
    if (status !== undefined) params.append('status', status.toString())
    params.append('limit', limit.toString())
    params.append('offset', offset.toString())

    const url = `/sales-reps/attendance/records?${params.toString()}`

    try {
      const result = await this.request<AttendanceRecord[]>(url)

      return result
    } catch (error) {

      throw error
    }
  }

  async getSalesRepAttendanceStats(
    startDate?: string,
    endDate?: string
  ): Promise<AttendanceStats> {

    if (USE_MOCK_DATA) {

      await new Promise(resolve => setTimeout(resolve, 300))

      const mockStats: AttendanceStats = {
        totalSessions: 5,
        totalDuration: 2100, // 35 hours in minutes (sum of all durations)
        averageSessionDuration: 420, // 7 hours in minutes
        activeSalesReps: 5,
        byStatus: {
          1: 4, // Active sessions
          0: 1   // Inactive sessions
        },
        byCountry: {
          'Kenya': 3,
          'Uganda': 1,
          'Tanzania': 1
        },
        byRegion: {
          'Nairobi': 2,
          'Mombasa': 1,
          'Kampala': 1,
          'Dar es Salaam': 1
        }
      }

      return mockStats
    }

    const params = new URLSearchParams()
    if (startDate) params.append('startDate', startDate)
    if (endDate) params.append('endDate', endDate)

    const url = `/sales-reps/attendance/stats?${params.toString()}`

    try {
      const result = await this.request<AttendanceStats>(url)

      return result
    } catch (error) {

      throw error
    }
  }

  // Staff Management
  async getStaff(role?: string): Promise<Staff[]> {

    if (USE_MOCK_DATA) {

      await new Promise(resolve => setTimeout(resolve, 500))

      // Mock staff data based on the schema
      const mockStaff: Staff[] = [
        {
          id: 1,
          name: 'John Smith',
          photo_url: '/avatars/john-smith.jpg',
          empl_no: 'EMP001',
          id_no: '12345678',
          role: 'Manager',
          designation: 'Sales Manager',
          phone_number: '+1-555-0101',
          password: 'hashed_password',
          department: 'Sales',
          department_id: 1,
          business_email: 'john.smith@moonsun.com',
          department_email: 'sales@moonsun.com',
          salary: 75000.00,
          employment_type: 'Contract',
          gender: 'Male',
          created_at: '2024-01-15T08:00:00Z',
          updated_at: '2024-01-15T08:00:00Z',
          is_active: 1,
          avatar_url: '/avatars/john-smith.jpg',
          status: 1
        },
        {
          id: 2,
          name: 'Sarah Johnson',
          photo_url: '/avatars/sarah-johnson.jpg',
          empl_no: 'EMP002',
          id_no: '87654321',
          role: 'Developer',
          designation: 'Senior Developer',
          phone_number: '+1-555-0102',
          password: 'hashed_password',
          department: 'IT',
          department_id: 2,
          business_email: 'sarah.johnson@moonsun.com',
          department_email: 'it@moonsun.com',
          salary: 85000.00,
          employment_type: 'Consultant',
          gender: 'Female',
          created_at: '2024-01-16T08:00:00Z',
          updated_at: '2024-01-16T08:00:00Z',
          is_active: 1,
          avatar_url: '/avatars/sarah-johnson.jpg',
          status: 1
        },
        {
          id: 3,
          name: 'Mike Wilson',
          photo_url: '/avatars/mike-wilson.jpg',
          empl_no: 'EMP003',
          id_no: '11223344',
          role: 'Accountant',
          designation: 'Senior Accountant',
          phone_number: '+1-555-0103',
          password: 'hashed_password',
          department: 'Finance',
          department_id: 3,
          business_email: 'mike.wilson@moonsun.com',
          department_email: 'finance@moonsun.com',
          salary: 65000.00,
          employment_type: 'Contract',
          gender: 'Male',
          created_at: '2024-01-17T08:00:00Z',
          updated_at: '2024-01-17T08:00:00Z',
          is_active: 1,
          avatar_url: '/avatars/mike-wilson.jpg',
          status: 1
        },
        {
          id: 4,
          name: 'Emily Davis',
          photo_url: '/avatars/emily-davis.jpg',
          empl_no: 'EMP004',
          id_no: '55667788',
          role: 'HR Manager',
          designation: 'Human Resources Manager',
          phone_number: '+1-555-0104',
          password: 'hashed_password',
          department: 'Human Resources',
          department_id: 4,
          business_email: 'emily.davis@moonsun.com',
          department_email: 'hr@moonsun.com',
          salary: 70000.00,
          employment_type: 'Contract',
          gender: 'Female',
          created_at: '2024-01-18T08:00:00Z',
          updated_at: '2024-01-18T08:00:00Z',
          is_active: 1,
          avatar_url: '/avatars/emily-davis.jpg',
          status: 1
        },
        {
          id: 5,
          name: 'David Brown',
          photo_url: '/avatars/david-brown.jpg',
          empl_no: 'EMP005',
          id_no: '99887766',
          role: 'Intern',
          designation: 'Marketing Intern',
          phone_number: '+1-555-0105',
          password: 'hashed_password',
          department: 'Marketing',
          department_id: 5,
          business_email: 'david.brown@moonsun.com',
          department_email: 'marketing@moonsun.com',
          salary: 25000.00,
          employment_type: 'Probation',
          gender: 'Male',
          created_at: '2024-01-19T08:00:00Z',
          updated_at: '2024-01-19T08:00:00Z',
          is_active: 1,
          avatar_url: '/avatars/david-brown.jpg',
          status: 1
        }
      ]

      return mockStaff
    }

    try {
      const url = role ? `/staff?role=${encodeURIComponent(role)}` : '/staff'
      const result = await this.request<Staff[]>(url)

      return result
    } catch (error) {

      throw error
    }
  }

  async getStaffById(id: number): Promise<Staff> {
    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 300))
      const staff = await this.getStaff()
      const staffMember = staff.find(member => member.id === id)
      if (!staffMember) throw new Error('Staff member not found')
      return staffMember
    }
    return this.request<Staff>(`/staff/${id}`)
  }

  async createStaff(staffData: Omit<Staff, 'id' | 'created_at' | 'updated_at'>): Promise<Staff> {
    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 500))
      const newStaff: Staff = {
        ...staffData,
        id: Math.floor(Math.random() * 1000) + 100,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
      return newStaff
    }
    return this.request<Staff>('/staff', {
      method: 'POST',
      body: JSON.stringify(staffData),
    })
  }

  async updateStaff(id: number, staffData: Partial<Omit<Staff, 'id' | 'created_at' | 'updated_at'>>): Promise<Staff> {
    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 500))
      const staff = await this.getStaff()
      const staffMember = staff.find(member => member.id === id)
      if (!staffMember) throw new Error('Staff member not found')
      const updatedStaff = { ...staffMember, ...staffData }
      return updatedStaff
    }
    return this.request<Staff>(`/staff/${id}`, {
      method: 'PUT',
      body: JSON.stringify(staffData),
    })
  }

  async deleteStaff(id: number): Promise<{ message: string }> {
    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 500))
      return { message: 'Staff member deleted successfully' }
    }
    return this.request<{ message: string }>(`/staff/${id}`, {
      method: 'DELETE',
    })
  }

  async getStaffStats(): Promise<StaffStats> {
    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 300))
      const staff = await this.getStaff()

      const total = staff.length
      const active = staff.filter(member => member.is_active === 1).length
      const inactive = total - active

      const byDepartment = staff.reduce((acc, member) => {
        const dept = member.department || 'Unknown'
        acc[dept] = (acc[dept] || 0) + 1
        return acc
      }, {} as Record<string, number>)

      const byRole = staff.reduce((acc, member) => {
        const role = member.role || 'Unknown'
        acc[role] = (acc[role] || 0) + 1
        return acc
      }, {} as Record<string, number>)

      const byGender = staff.reduce((acc, member) => {
        const gender = member.gender || 'Unknown'
        acc[gender] = (acc[gender] || 0) + 1
        return acc
      }, {} as Record<string, number>)

      const byEmploymentType = staff.reduce((acc, member) => {
        const empType = member.employment_type || 'Unknown'
        acc[empType] = (acc[empType] || 0) + 1
        return acc
      }, {} as Record<string, number>)

      return {
        total,
        active,
        inactive,
        byDepartment,
        byRole,
        byGender,
        byEmploymentType
      }
    }
    return this.request<StaffStats>('/staff/stats')
  }

  async searchStaff(searchTerm: string): Promise<Staff[]> {
    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 300))
      const staff = await this.getStaff()
      return staff.filter(member => 
        member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        member.empl_no.toLowerCase().includes(searchTerm.toLowerCase()) ||
        member.role.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (member.department && member.department.toLowerCase().includes(searchTerm.toLowerCase()))
      )
    }
    return this.request<Staff[]>(`/staff/search?q=${encodeURIComponent(searchTerm)}`)
  }

  // Image Upload
  async uploadStaffImage(imageFile: File): Promise<{ url: string; public_id: string }> {

    const formData = new FormData()
    formData.append('image', imageFile)

    try {
      const result = await this.request<{ url: string; public_id: string }>('/staff/upload-image', {
        method: 'POST',
        body: formData
        // Don't pass headers - request method will handle FormData correctly
      })

      return result
    } catch (error) {

      throw error
    }
  }

  async uploadStaffImageBase64(base64Data: string): Promise<{ url: string; public_id: string }> {

    try {
      const result = await this.request<{ url: string; public_id: string }>('/staff/upload-image-base64', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ image: base64Data })
      })

      return result
    } catch (error) {

      throw error
    }
  }

  // Crew Management
  async getCrew(page: number = 1, limit: number = 50): Promise<{ crew: Crew[], total: number }> {

    return this.request<{ crew: Crew[], total: number }>(`/admin/crew?page=${page}&limit=${limit}`)
  }

  async getCrewById(id: number): Promise<Crew> {
    return this.request<Crew>(`/admin/crew/${id}`)
  }

  async createCrew(crewData: Omit<Crew, 'id' | 'created_at' | 'updated_at'>): Promise<Crew> {
    return this.request<Crew>('/admin/crew', {
      method: 'POST',
      body: JSON.stringify(crewData),
    })
  }

  async updateCrew(id: number, crewData: Partial<Omit<Crew, 'id' | 'created_at' | 'updated_at'>>): Promise<Crew> {
    return this.request<Crew>(`/admin/crew/${id}`, {
      method: 'PUT',
      body: JSON.stringify(crewData),
    })
  }

  async deleteCrew(id: number): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/admin/crew/${id}`, {
      method: 'DELETE',
    })
  }

  // Department Management
  async getDepartments(): Promise<Department[]> {

    if (USE_MOCK_DATA) {

      await new Promise(resolve => setTimeout(resolve, 300))

      // Mock departments data
      const mockDepartments: Department[] = [
        { id: 1, name: 'Sales', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
        { id: 2, name: 'IT', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
        { id: 3, name: 'Finance', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
        { id: 4, name: 'Human Resources', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
        { id: 5, name: 'Marketing', created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
      ]

      return mockDepartments
    }

    try {
      const result = await this.request<Department[]>('/staff/departments')

      return result
    } catch (error) {

      throw error
    }
  }

  async getDepartmentById(id: number): Promise<Department> {
    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 300))
      const departments = await this.getDepartments()
      const department = departments.find(dept => dept.id === id)
      if (!department) throw new Error('Department not found')
      return department
    }
    return this.request<Department>(`/staff/departments/${id}`)
  }

  async createDepartment(departmentData: Omit<Department, 'id' | 'created_at' | 'updated_at'>): Promise<Department> {
    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 500))
      const newDepartment: Department = {
        ...departmentData,
        id: Math.floor(Math.random() * 1000) + 100,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
      return newDepartment
    }
    return this.request<Department>('/staff/departments', {
      method: 'POST',
      body: JSON.stringify(departmentData),
    })
  }

  async updateDepartment(id: number, departmentData: Partial<Omit<Department, 'id' | 'created_at' | 'updated_at'>>): Promise<Department> {
    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 500))
      const departments = await this.getDepartments()
      const department = departments.find(dept => dept.id === id)
      if (!department) throw new Error('Department not found')
      const updatedDepartment = { ...department, ...departmentData }
      return updatedDepartment
    }
    return this.request<Department>(`/staff/departments/${id}`, {
      method: 'PUT',
      body: JSON.stringify(departmentData),
    })
  }

  async deleteDepartment(id: number): Promise<{ message: string }> {
    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 500))
      return { message: 'Department deleted successfully' }
    }
    return this.request<{ message: string }>(`/staff/departments/${id}`, {
      method: 'DELETE',
    })
  }

  // Suppliers API methods
  async getSuppliers(page: number = 1, limit: number = 10, search?: string, status?: string): Promise<{ suppliers: Supplier[], total: number }> {
    if (USE_MOCK_DATA) {

      await new Promise(resolve => setTimeout(resolve, 300))

      const mockSuppliers: Supplier[] = [
        {
          id: 1,
          supplier_code: 'SUP001',
          company_name: 'ABC Electronics Ltd',
          contact_person: 'John Smith',
          email: 'john@abcelectronics.com',
          phone: '+1-555-0123',
          address: '123 Tech Street, Silicon Valley, CA 94000',
          tax_id: 'TAX123456789',
          payment_terms: 30,
          credit_limit: 50000.00,
          is_active: true,
          created_at: '2024-01-15T10:00:00Z',
          updated_at: '2024-01-15T10:00:00Z'
        },
        {
          id: 2,
          supplier_code: 'SUP002',
          company_name: 'Global Components Inc',
          contact_person: 'Sarah Johnson',
          email: 'sarah@globalcomponents.com',
          phone: '+1-555-0456',
          address: '456 Industrial Ave, Detroit, MI 48201',
          tax_id: 'TAX987654321',
          payment_terms: 45,
          credit_limit: 75000.00,
          is_active: true,
          created_at: '2024-01-20T14:30:00Z',
          updated_at: '2024-01-20T14:30:00Z'
        },
        {
          id: 3,
          supplier_code: 'SUP003',
          company_name: 'Tech Solutions Corp',
          contact_person: 'Mike Chen',
          email: 'mike@techsolutions.com',
          phone: '+1-555-0789',
          address: '789 Innovation Blvd, Austin, TX 73301',
          tax_id: 'TAX456789123',
          payment_terms: 30,
          credit_limit: 100000.00,
          is_active: false,
          created_at: '2024-02-01T09:15:00Z',
          updated_at: '2024-02-01T09:15:00Z'
        }
      ]

      let filteredSuppliers = mockSuppliers

      if (search) {
        filteredSuppliers = mockSuppliers.filter(supplier => 
          supplier.company_name.toLowerCase().includes(search.toLowerCase()) ||
          supplier.contact_person?.toLowerCase().includes(search.toLowerCase()) ||
          supplier.email?.toLowerCase().includes(search.toLowerCase()) ||
          supplier.supplier_code.toLowerCase().includes(search.toLowerCase())
        )
      }

      if (status === 'active') {
        filteredSuppliers = filteredSuppliers.filter(supplier => supplier.is_active)
      } else if (status === 'inactive') {
        filteredSuppliers = filteredSuppliers.filter(supplier => !supplier.is_active)
      }

      const startIndex = (page - 1) * limit
      const endIndex = startIndex + limit
      const paginatedSuppliers = filteredSuppliers.slice(startIndex, endIndex)

      return { suppliers: paginatedSuppliers, total: filteredSuppliers.length }
    }

    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        ...(search && { search }),
        ...(status && { status })
      })

      const result = await this.request<{ suppliers: Supplier[], total: number }>(`/admin/suppliers?${params}`)

      return result
    } catch (error) {

      throw error
    }
  }

  async getSupplierStats(): Promise<SupplierStats> {
    if (USE_MOCK_DATA) {

      await new Promise(resolve => setTimeout(resolve, 200))

      const mockStats: SupplierStats = {
        total: 3,
        active: 2,
        inactive: 1,
        totalCreditLimit: 225000.00
      }

      return mockStats
    }

    try {
      const result = await this.request<SupplierStats>('/admin/suppliers/stats')

      return result
    } catch (error) {

      throw error
    }
  }

  async getSupplierById(id: number): Promise<Supplier> {
    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 200))
      const suppliers = await this.getSuppliers()
      const supplier = suppliers.suppliers.find(s => s.id === id)
      if (!supplier) throw new Error('Supplier not found')
      return supplier
    }
    return this.request<Supplier>(`/admin/suppliers/${id}`)
  }

  async createSupplier(supplierData: Omit<Supplier, 'id' | 'created_at' | 'updated_at'>): Promise<Supplier> {
    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 500))
      const newSupplier: Supplier = {
        ...supplierData,
        id: Math.floor(Math.random() * 1000) + 100,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
      return newSupplier
    }
    return this.request<Supplier>('/admin/suppliers', {
      method: 'POST',
      body: JSON.stringify(supplierData),
    })
  }

  async updateSupplier(id: number, supplierData: Partial<Omit<Supplier, 'id' | 'created_at' | 'updated_at'>>): Promise<Supplier> {
    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 500))
      const suppliers = await this.getSuppliers()
      const supplier = suppliers.suppliers.find(s => s.id === id)
      if (!supplier) throw new Error('Supplier not found')
      const updatedSupplier = { ...supplier, ...supplierData }
      return updatedSupplier
    }
    return this.request<Supplier>(`/admin/suppliers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(supplierData),
    })
  }

  async deleteSupplier(id: number): Promise<{ message: string }> {
    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 500))
      return { message: 'Supplier deleted successfully' }
    }
    return this.request<{ message: string }>(`/admin/suppliers/${id}`, {
      method: 'DELETE',
    })
  }

  // Purchase Orders API methods
  async getLegacyPurchaseOrders(page: number = 1, limit: number = 10, search?: string, status?: string, supplierId?: number): Promise<{ purchaseOrders: PurchaseOrder[], total: number }> {
    if (USE_MOCK_DATA) {

      await new Promise(resolve => setTimeout(resolve, 300))

      const mockPurchaseOrders: PurchaseOrder[] = [
        {
          id: 1,
          po_number: 'PO-2024-001',
          invoice_number: 'INV-2024-001',
          supplier_id: 1,
          order_date: '2024-01-15',
          expected_delivery_date: '2024-01-25',
          status: 'received',
          subtotal: 45000.00,
          tax_amount: 4500.00,
          total_amount: 49500.00,
          amount_paid: 49500.00,
          balance: 0.00,
          notes: 'Electronics components order',
          created_by: 1,
          created_at: '2024-01-15T10:00:00Z',
          updated_at: '2024-01-15T10:00:00Z',
          supplier: {
            id: 1,
            supplier_code: 'SUP001',
            company_name: 'ABC Electronics Ltd',
            contact_person: 'John Smith',
            email: 'john@abcelectronics.com',
            phone: '+1-555-0123',
            address: '123 Tech Street, Silicon Valley, CA 94000',
            tax_id: 'TAX123456789',
            payment_terms: 30,
            credit_limit: 50000.00,
            is_active: true,
            created_at: '2024-01-15T10:00:00Z',
            updated_at: '2024-01-15T10:00:00Z'
          }
        },
        {
          id: 2,
          po_number: 'PO-2024-002',
          invoice_number: 'INV-2024-002',
          supplier_id: 2,
          order_date: '2024-01-20',
          expected_delivery_date: '2024-02-01',
          status: 'sent',
          subtotal: 25000.00,
          tax_amount: 2500.00,
          total_amount: 27500.00,
          amount_paid: 0.00,
          balance: 27500.00,
          notes: 'Industrial components',
          created_by: 1,
          created_at: '2024-01-20T14:30:00Z',
          updated_at: '2024-01-20T14:30:00Z',
          supplier: {
            id: 2,
            supplier_code: 'SUP002',
            company_name: 'Global Components Inc',
            contact_person: 'Sarah Johnson',
            email: 'sarah@globalcomponents.com',
            phone: '+1-555-0456',
            address: '456 Industrial Ave, Detroit, MI 48201',
            tax_id: 'TAX987654321',
            payment_terms: 45,
            credit_limit: 75000.00,
            is_active: true,
            created_at: '2024-01-20T14:30:00Z',
            updated_at: '2024-01-20T14:30:00Z'
          }
        }
      ]

      let filteredOrders = mockPurchaseOrders

      if (search) {
        filteredOrders = mockPurchaseOrders.filter(order => 
          order.po_number.toLowerCase().includes(search.toLowerCase()) ||
          order.invoice_number.toLowerCase().includes(search.toLowerCase()) ||
          order.supplier?.company_name.toLowerCase().includes(search.toLowerCase())
        )
      }

      if (status) {
        filteredOrders = filteredOrders.filter(order => order.status === status)
      }

      if (supplierId) {
        filteredOrders = filteredOrders.filter(order => order.supplier_id === supplierId)
      }

      const startIndex = (page - 1) * limit
      const endIndex = startIndex + limit
      const paginatedOrders = filteredOrders.slice(startIndex, endIndex)

      return { purchaseOrders: paginatedOrders, total: filteredOrders.length }
    }

    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        ...(search && { search }),
        ...(status && { status }),
        ...(supplierId && { supplierId: supplierId.toString() })
      })

      const result = await this.request<{ purchaseOrders: PurchaseOrder[], total: number }>(`/admin/purchase-orders?${params}`)

      return result
    } catch (error) {

      throw error
    }
  }

  async getSupplierInvoices(supplierId: number): Promise<PurchaseOrder[]> {
    if (USE_MOCK_DATA) {

      await new Promise(resolve => setTimeout(resolve, 200))

      const mockInvoices: PurchaseOrder[] = [
        {
          id: 1,
          po_number: 'PO-2024-001',
          invoice_number: 'INV-2024-001',
          supplier_id: supplierId,
          order_date: '2024-01-15',
          expected_delivery_date: '2024-01-25',
          status: 'received',
          subtotal: 45000.00,
          tax_amount: 4500.00,
          total_amount: 49500.00,
          amount_paid: 49500.00,
          balance: 0.00,
          notes: 'Electronics components order',
          created_by: 1,
          created_at: '2024-01-15T10:00:00Z',
          updated_at: '2024-01-15T10:00:00Z'
        },
        {
          id: 2,
          po_number: 'PO-2024-002',
          invoice_number: 'INV-2024-002',
          supplier_id: supplierId,
          order_date: '2024-01-20',
          expected_delivery_date: '2024-02-01',
          status: 'sent',
          subtotal: 25000.00,
          tax_amount: 2500.00,
          total_amount: 27500.00,
          amount_paid: 0.00,
          balance: 27500.00,
          notes: 'Industrial components',
          created_by: 1,
          created_at: '2024-01-20T14:30:00Z',
          updated_at: '2024-01-20T14:30:00Z'
        }
      ]

      return mockInvoices
    }

    try {
      const result = await this.request<PurchaseOrder[]>(`/admin/purchase-orders/supplier/${supplierId}`)

      return result
    } catch (error) {

      throw error
    }
  }

  async getSupplierInvoiceStats(supplierId: number): Promise<SupplierInvoiceStats> {
    if (USE_MOCK_DATA) {

      await new Promise(resolve => setTimeout(resolve, 200))

      const mockStats: SupplierInvoiceStats = {
        totalOrders: 2,
        totalAmount: 77000.00,
        totalPaid: 49500.00,
        totalBalance: 27500.00,
        recentOrders: [
          {
            id: 1,
            po_number: 'PO-2024-001',
            invoice_number: 'INV-2024-001',
            supplier_id: supplierId,
            order_date: '2024-01-15',
            expected_delivery_date: '2024-01-25',
            status: 'received',
            subtotal: 45000.00,
            tax_amount: 4500.00,
            total_amount: 49500.00,
            amount_paid: 49500.00,
            balance: 0.00,
            notes: 'Electronics components order',
            created_by: 1,
            created_at: '2024-01-15T10:00:00Z',
            updated_at: '2024-01-15T10:00:00Z'
          },
          {
            id: 2,
            po_number: 'PO-2024-002',
            invoice_number: 'INV-2024-002',
            supplier_id: supplierId,
            order_date: '2024-01-20',
            expected_delivery_date: '2024-02-01',
            status: 'sent',
            subtotal: 25000.00,
            tax_amount: 2500.00,
            total_amount: 27500.00,
            amount_paid: 0.00,
            balance: 27500.00,
            notes: 'Industrial components',
            created_by: 1,
            created_at: '2024-01-20T14:30:00Z',
            updated_at: '2024-01-20T14:30:00Z'
          }
        ]
      }

      return mockStats
    }

    try {
      const result = await this.request<SupplierInvoiceStats>(`/admin/purchase-orders/supplier/${supplierId}/stats`)

      return result
    } catch (error) {

      throw error
    }
  }

  async getPurchaseOrderItems(purchaseOrderId: number): Promise<PurchaseOrderItem[]> {
    if (USE_MOCK_DATA) {

      await new Promise(resolve => setTimeout(resolve, 200))

      const mockItems: PurchaseOrderItem[] = [
        {
          id: 1,
          purchase_order_id: purchaseOrderId,
          product_id: 1,
          quantity: 10,
          unit_price: 150.00,
          total_price: 1500.00,
          received_quantity: 10,
          tax_amount: 150.00,
          tax_type: 'VAT',
          product: {
            id: 1,
            product_name: 'Ice Watermelon Bliss 3000puffs',
            product_code: 'Ice Watermelon Bliss',
            description: 'High-quality electronic component',
            category: '3000 puffs',
            unit_of_measure: 'PCS',
            cost_price: 800.00,
            selling_price: 1200.00,
            tax_type: '16%'
          }
        },
        {
          id: 2,
          purchase_order_id: purchaseOrderId,
          product_id: 2,
          quantity: 5,
          unit_price: 200.00,
          total_price: 1000.00,
          received_quantity: 5,
          tax_amount: 100.00,
          tax_type: 'VAT',
          product: {
            id: 2,
            product_name: 'Kiwi Dragon Strawberry 9000puffs',
            product_code: 'Kiwi Dragon Strawber',
            description: 'Durable industrial component',
            category: '9000 puffs',
            unit_of_measure: 'PCS',
            cost_price: 15.00,
            selling_price: 25.00,
            tax_type: '16%'
          }
        }
      ]

      return mockItems
    }

    try {
      const result = await this.request<PurchaseOrderItem[]>(`/admin/purchase-orders/${purchaseOrderId}/items`)

      return result
    } catch (error) {

      throw error
    }
  }

  async createPurchaseOrderWithItems(data: {
    po_number: string;
    invoice_number: string;
    supplier_id: number;
    order_date: string;
    expected_delivery_date?: string;
    notes?: string;
    created_by: number;
    items: {
      product_id: number;
      quantity: number;
      unit_price: number;
      tax_amount?: number;
      tax_type?: string;
    }[];
  }): Promise<PurchaseOrder> {

    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 500))

      const mockPurchaseOrder: PurchaseOrder = {
        id: Math.floor(Math.random() * 1000) + 1,
        po_number: data.po_number,
        invoice_number: data.invoice_number,
        supplier_id: data.supplier_id,
        order_date: data.order_date,
        expected_delivery_date: data.expected_delivery_date,
        status: 'draft',
        subtotal: data.items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0),
        tax_amount: data.items.reduce((sum, item) => sum + (item.tax_amount || 0), 0),
        total_amount: 0,
        amount_paid: 0,
        balance: 0,
        notes: data.notes,
        created_by: data.created_by,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      mockPurchaseOrder.total_amount = mockPurchaseOrder.subtotal + mockPurchaseOrder.tax_amount
      mockPurchaseOrder.balance = mockPurchaseOrder.total_amount

      return mockPurchaseOrder
    }

    try {
      const result = await this.request<PurchaseOrder>('/admin/purchase-orders/create-with-items', {
        method: 'POST',
        body: JSON.stringify(data)
      })

      return result
    } catch (error) {

      throw error
    }
  }

  async getPurchaseOrdersV2(page: number = 1, limit: number = 10, search?: string, status?: string): Promise<{ purchaseOrders: PurchaseOrder[], total: number }> {

    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 200))

      const mockPurchaseOrders: PurchaseOrder[] = [
        {
          id: 1,
          po_number: 'PO-2024-001',
          invoice_number: 'INV-2024-001',
          supplier_id: 1,
          order_date: '2024-01-15',
          expected_delivery_date: '2024-01-25',
          status: 'draft',
          subtotal: 2500.00,
          tax_amount: 250.00,
          total_amount: 2750.00,
          amount_paid: 0.00,
          balance: 2750.00,
          notes: 'Electronics components order',
          created_by: 1,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          supplier: {
            id: 1,
            company_name: 'ABC Electronics Ltd',
            supplier_code: 'SUP001',
            contact_person: 'John Smith',
            email: 'john@abcelectronics.com',
            phone: '+1-555-0123',
            address: '123 Tech Street, Silicon Valley, CA 94000',
            tax_id: 'TAX123456789',
            payment_terms: 30,
            credit_limit: 50000.00,
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
        },
        {
          id: 2,
          po_number: 'PO-2024-002',
          invoice_number: 'INV-2024-002',
          supplier_id: 2,
          order_date: '2024-01-20',
          expected_delivery_date: '2024-02-01',
          status: 'draft',
          subtotal: 1504.00,
          tax_amount: 150.40,
          total_amount: 1654.40,
          amount_paid: 0.00,
          balance: 1654.40,
          notes: 'Industrial components',
          created_by: 1,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          supplier: {
            id: 2,
            company_name: 'Tech Solutions Inc',
            supplier_code: 'SUP002',
            contact_person: 'Jane Doe',
            email: 'jane@techsolutions.com',
            phone: '+1-555-0456',
            address: '456 Innovation Drive, Tech City, TC 12345',
            tax_id: 'TAX987654321',
            payment_terms: 45,
            credit_limit: 75000.00,
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
        },
        {
          id: 3,
          po_number: 'PO-2024-003',
          invoice_number: 'INV-2024-003',
          supplier_id: 3,
          order_date: '2024-01-25',
          expected_delivery_date: '2024-02-05',
          status: 'draft',
          subtotal: 3200.00,
          tax_amount: 320.00,
          total_amount: 3520.00,
          amount_paid: 0.00,
          balance: 3520.00,
          notes: 'Office supplies and equipment',
          created_by: 1,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          supplier: {
            id: 3,
            company_name: 'Global Supplies Co',
            supplier_code: 'SUP003',
            contact_person: 'Mike Johnson',
            email: 'mike@globalsupplies.com',
            phone: '+1-555-0789',
            address: '789 Business Park, Commerce City, CC 67890',
            tax_id: 'TAX456789123',
            payment_terms: 30,
            credit_limit: 100000.00,
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
        }
      ]

      return { purchaseOrders: mockPurchaseOrders, total: mockPurchaseOrders.length }
    }

    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        ...(search && { search }),
        ...(status && { status })
      })

      const result = await this.request<{ purchaseOrders: PurchaseOrder[], total: number }>(`/admin/purchase-orders?${params}`)

      return result
    } catch (error) {

      throw error
    }
  }

  async getPurchaseOrderStats(): Promise<PurchaseOrderStats> {

    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 200))

      const mockStats: PurchaseOrderStats = {
        total: 25,
        draft: 8,
        sent: 12,
        received: 4,
        cancelled: 1,
        totalValue: 125000.00,
        totalBalance: 45000.00,
        recentOrders: []
      }

      return mockStats
    }

    try {
      const result = await this.request<PurchaseOrderStats>('/admin/purchase-orders/stats')

      return result
    } catch (error) {

      throw error
    }
  }

  // Task Management
  async getTasks(): Promise<Task[]> {
    return this.request<Task[]>('/admin/tasks')
  }

  async getTask(id: number): Promise<Task> {
    return this.request<Task>(`/admin/tasks/${id}`)
  }

  async createTask(taskData: CreateTaskDto): Promise<Task> {
    return this.request<Task>('/admin/tasks', {
      method: 'POST',
      body: JSON.stringify(taskData)
    })
  }

  async updateTask(id: number, taskData: UpdateTaskDto): Promise<Task> {

    // Ensure isCompleted is properly converted to boolean
    const processedData = {
      ...taskData,
      isCompleted: taskData.isCompleted !== undefined ? Boolean(taskData.isCompleted) : undefined
    }

    const result = await this.request<Task>(`/admin/tasks/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(processedData)
    })

    return result
  }

  async deleteTask(id: number): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/admin/tasks/${id}`, {
      method: 'DELETE'
    })
  }

  async getTaskStats(): Promise<TaskStats> {
    return this.request<TaskStats>('/admin/tasks/stats')
  }

  async getTasksBySalesRep(salesRepId: number): Promise<Task[]> {
    return this.request<Task[]>(`/admin/tasks/sales-rep/${salesRepId}`)
  }

  async getTasksByStatus(status: string): Promise<Task[]> {
    return this.request<Task[]>(`/admin/tasks/status/${status}`)
  }

  async getTasksByPriority(priority: string): Promise<Task[]> {
    return this.request<Task[]>(`/admin/tasks/priority/${priority}`)
  }

  // Inventory Management (legacy alias — use getInventory() above)
  async getInventoryLegacy(): Promise<any[]> {

    try {
      const result = await this.request<any[]>('/inventory')

      return result
    } catch (error: any) {

      throw error
    }
  }

  async getInventoryStores(): Promise<any[]> {

    try {
      const result = await this.request<any[]>('/admin/inventory/stores')

      return result
    } catch (error: any) {

      throw error
    }
  }

  async getInventoryProducts(): Promise<any[]> {

    try {
      const result = await this.request<any[]>('/admin/inventory/products')

      return result
    } catch (error: any) {

      throw error
    }
  }

  async getInventoryByStore(storeId: number): Promise<any[]> {
    return this.request<any[]>(`/admin/inventory/store/${storeId}`)
  }

  async getInventoryByProduct(productId: number): Promise<any[]> {
    return this.request<any[]>(`/admin/inventory/product/${productId}`)
  }

  async updateInventoryQuantity(id: number, quantity: number): Promise<any> {

    try {
      const result = await this.request<any>(`/admin/inventory/${id}/quantity`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ quantity })
      });

      return result;
    } catch (error) {

      throw error;
    }
  }

  // Aircrafts Management
  async getAircrafts(page: number = 1, limit: number = 50): Promise<{ aircrafts: Aircraft[], total: number }> {

    return this.request<{ aircrafts: Aircraft[], total: number }>(`/admin/aircrafts?page=${page}&limit=${limit}`);
  }

  async getAircraftById(id: number): Promise<Aircraft> {
    return this.request<Aircraft>(`/admin/aircrafts/${id}`);
  }

  async createAircraft(aircraftData: Partial<Aircraft>): Promise<Aircraft> {
    return this.request<Aircraft>('/admin/aircrafts', {
      method: 'POST',
      body: JSON.stringify(aircraftData),
    });
  }

  async updateAircraft(id: number, aircraftData: Partial<Aircraft>): Promise<Aircraft> {
    return this.request<Aircraft>(`/admin/aircrafts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(aircraftData),
    });
  }

  async deleteAircraft(id: number): Promise<void> {
    return this.request<void>(`/admin/aircrafts/${id}`, {
      method: 'DELETE',
    });
  }

  // Destinations Management
  async getDestinations(page: number = 1, limit: number = 50): Promise<{ destinations: Destination[], total: number }> {

    return this.request<{ destinations: Destination[], total: number }>(`/admin/destinations?page=${page}&limit=${limit}`);
  }

  async getDestinationById(id: number): Promise<Destination> {
    return this.request<Destination>(`/admin/destinations/${id}`);
  }

  async createDestination(destinationData: Partial<Destination>): Promise<Destination> {
    return this.request<Destination>('/admin/destinations', {
      method: 'POST',
      body: JSON.stringify(destinationData),
    });
  }

  async updateDestination(id: number, destinationData: Partial<Destination>): Promise<Destination> {
    return this.request<Destination>(`/admin/destinations/${id}`, {
      method: 'PUT',
      body: JSON.stringify(destinationData),
    });
  }

  async deleteDestination(id: number): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/admin/destinations/${id}`, {
      method: 'DELETE',
    });
  }

  // Flight Series Management
  async getFlightSeries(page: number = 1, limit: number = 50): Promise<{ flightSeries: FlightSeries[], total: number }> {

    return this.request<{ flightSeries: FlightSeries[], total: number }>(`/admin/flight-series?page=${page}&limit=${limit}`);
  }

  async getFlightSeriesById(id: number): Promise<FlightSeries> {
    return this.request<FlightSeries>(`/admin/flight-series/${id}`);
  }

  async createFlightSeries(flightSeriesData: Partial<FlightSeries>): Promise<FlightSeries> {
    return this.request<FlightSeries>('/admin/flight-series', {
      method: 'POST',
      body: JSON.stringify(flightSeriesData),
    });
  }

  async updateFlightSeries(id: number, flightSeriesData: Partial<FlightSeries>): Promise<FlightSeries> {
    return this.request<FlightSeries>(`/admin/flight-series/${id}`, {
      method: 'PUT',
      body: JSON.stringify(flightSeriesData),
    });
  }

  async deleteFlightSeries(id: number): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/admin/flight-series/${id}`, {
      method: 'DELETE',
    });
  }

  // Seat Reservations Management
  async getSeatReservations(page: number = 1, limit: number = 50, flightSeriesId?: number): Promise<{ reservations: SeatReservation[], total: number }> {
    const queryParams = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });
    if (flightSeriesId) {
      queryParams.append('flightSeriesId', flightSeriesId.toString());
    }
    return this.request<{ reservations: SeatReservation[], total: number }>(`/admin/seat-reservations?${queryParams}`);
  }

  async getSeatReservationsByFlightSeries(flightSeriesId: number): Promise<SeatReservation[]> {
    return this.request<SeatReservation[]>(`/admin/seat-reservations/flight-series/${flightSeriesId}`);
  }

  async getSeatReservationById(id: number): Promise<SeatReservation> {
    return this.request<SeatReservation>(`/admin/seat-reservations/${id}`);
  }

  async createSeatReservation(reservationData: Partial<SeatReservation>): Promise<SeatReservation> {
    return this.request<SeatReservation>('/admin/seat-reservations', {
      method: 'POST',
      body: JSON.stringify(reservationData),
    });
  }

  async updateSeatReservation(id: number, reservationData: Partial<SeatReservation>): Promise<SeatReservation> {
    return this.request<SeatReservation>(`/admin/seat-reservations/${id}`, {
      method: 'PUT',
      body: JSON.stringify(reservationData),
    });
  }

  async deleteSeatReservation(id: number): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/admin/seat-reservations/${id}`, {
      method: 'DELETE',
    });
  }

  // Bookings Management
  async createBooking(bookingData: {
    flight_series_id: number
    seat_reservation_id?: number
    passengers: Array<{
      name: string
      email?: string
      contact?: string
      nationality?: string
      identification?: string
      age?: string
      title?: string
      passenger_type: 'adult' | 'child' | 'infant'
    }>
    payment_method: string
    payment_status?: string
    booking_date: string
    notes?: string
  }): Promise<Booking> {
    return this.request<Booking>('/admin/bookings', {
      method: 'POST',
      body: JSON.stringify(bookingData),
    });
  }

  async getBookings(page: number = 1, limit: number = 50): Promise<{ bookings: Booking[], total: number }> {
    return this.request<{ bookings: Booking[], total: number }>(`/admin/bookings?page=${page}&limit=${limit}`);
  }

  async getBookingById(id: number): Promise<Booking> {
    return this.request<Booking>(`/admin/bookings/${id}`);
  }

  // Passengers API methods
  async getPassengers(page: number = 1, limit: number = 50): Promise<{ passengers: Passenger[], total: number }> {
    return this.request<{ passengers: Passenger[], total: number }>(`/admin/passengers?page=${page}&limit=${limit}`);
  }

  async getPassengerById(id: number): Promise<Passenger> {
    return this.request<Passenger>(`/admin/passengers/${id}`);
  }

  async createPassenger(passengerData: Partial<Passenger>): Promise<Passenger> {
    return this.request<Passenger>('/admin/passengers', {
      method: 'POST',
      body: JSON.stringify(passengerData),
    });
  }

  async updatePassenger(id: number, passengerData: Partial<Passenger>): Promise<Passenger> {
    return this.request<Passenger>(`/admin/passengers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(passengerData),
    });
  }

  async deletePassenger(id: number): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/admin/passengers/${id}`, {
      method: 'DELETE',
    });
  }
}

export const adminApiService = new AdminApiService()
export default adminApiService
