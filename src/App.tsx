import { lazy, Suspense } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import Login from './pages/Login'
const Dashboard = lazy(() => import('./pages/Dashboard'))
const ExecutiveDashboard = lazy(() => import('./pages/ExecutiveDashboard'))
const Chat = lazy(() => import('./pages/Chat'))
const Notices = lazy(() => import('./pages/Notices'))
const StaffPage = lazy(() => import('./pages/Staff'))
const Employees = lazy(() => import('./pages/Employees'))
const KeyAccounts = lazy(() => import('./pages/KeyAccounts'))
const KeyAccountManage = lazy(() => import('./pages/KeyAccountManage'))
const Clients = lazy(() => import('./pages/Clients'))
const ClientForm = lazy(() => import('./pages/ClientForm'))
const ClientDetails = lazy(() => import('./pages/ClientDetails'))
const PartCategories = lazy(() => import('./pages/PartCategories'))
const PartDetails = lazy(() => import('./pages/PartDetails'))
const Vendors = lazy(() => import('./pages/Vendors'))
const VendorLedger = lazy(() => import('./pages/VendorLedger'))
const PurchaseOrders = lazy(() => import('./pages/PurchaseOrders'))
const NewPurchaseOrder = lazy(() => import('./pages/NewPurchaseOrder'))
const AddVehicle = lazy(() => import('./pages/AddVehicle'))
const EditVehicle = lazy(() => import('./pages/EditVehicle'))
const VehicleDetails = lazy(() => import('./pages/VehicleDetails'))
const InspectionDetails = lazy(() => import('./pages/InspectionDetails'))
const InspectionForm = lazy(() => import('./pages/InspectionForm'))
const ChecklistTemplates = lazy(() => import('./pages/ChecklistTemplates'))
const Vehicles = lazy(() => import('./pages/Vehicles'))
const ExternalVehicles = lazy(() => import('./pages/ExternalVehicles'))
const SalesDailyGraph = lazy(() => import('./pages/SalesDailyGraph'))
const ExternalVehicleOwners = lazy(() => import('./pages/ExternalVehicleOwners'))
const ExternalVehicleOwnerDetails = lazy(() => import('./pages/ExternalVehicleOwnerDetails'))
const Parts = lazy(() => import('./pages/Parts'))
const Services = lazy(() => import('./pages/Services'))
const Stores = lazy(() => import('./pages/Stores'))
const Categories = lazy(() => import('./pages/Categories'))
const Regions = lazy(() => import('./pages/Regions'))
const Stations = lazy(() => import('./pages/Stations'))
const FuelPrices = lazy(() => import('./pages/FuelPrices'))
const Inventory = lazy(() => import('./pages/Inventory'))
const InventoryReport = lazy(() => import('./pages/InventoryReport'))
const LpgInventory = lazy(() => import('./pages/LpgInventory'))
const StationLpgLedger = lazy(() => import('./pages/StationLpgLedger'))
const StationExpenses = lazy(() => import('./pages/StationExpenses'))
const PostSale = lazy(() => import('./pages/PostSale'))
const KeyAccountLedgerReport = lazy(() => import('./pages/KeyAccountLedgerReport'))
const SalesReport = lazy(() => import('./pages/SalesReport'))
const SalesSummaryReport = lazy(() => import('./pages/SalesSummaryReport'))
const StationSalesDetail = lazy(() => import('./pages/StationSalesDetail'))
const StationDaySales = lazy(() => import('./pages/StationDaySales'))
const StationVarianceReport = lazy(() => import('./pages/StationVarianceReport'))
const WeeklySalesReport = lazy(() => import('./pages/WeeklySalesReport'))
const VehicleFuelReport = lazy(() => import('./pages/VehicleFuelReport'))
const Conversion = lazy(() => import('./pages/Conversion'))
const JobCards = lazy(() => import('./pages/JobCards'))
const JobCardForm = lazy(() => import('./pages/JobCardForm'))
const JobCardInvoice = lazy(() => import('./pages/JobCardInvoice'))
const Invoices = lazy(() => import('./pages/Invoices'))
const Payments = lazy(() => import('./pages/Payments'))
const ProfitLoss = lazy(() => import('./pages/ProfitLoss'))
const Quotations = lazy(() => import('./pages/Quotations'))
const Accounts = lazy(() => import('./pages/Accounts'))
const Calendar = lazy(() => import('./pages/Calendar'))
const Attendance = lazy(() => import('./pages/Attendance'))
const WorkingDays = lazy(() => import('./pages/WorkingDays'))
const MenuCategories = lazy(() => import('./pages/MenuCategories'))
const MenuItems = lazy(() => import('./pages/MenuItems'))
const StaffShifts = lazy(() => import('./pages/StaffShifts'))
const ReportsHome = lazy(() => import('./pages/ReportsHome'))
const ReportView = lazy(() => import('./pages/ReportView'))
const SaleDetail = lazy(() => import('./pages/SaleDetail'))
const BreakdownSales = lazy(() => import('./pages/BreakdownSales'))
const RestaurantStaff = lazy(() => import('./pages/RestaurantStaff'))
const RestaurantTrips = lazy(() => import('./pages/RestaurantTrips'))
const AuditEvents = lazy(() => import('./pages/AuditEvents'))
const ProductPerformance = lazy(() => import('./pages/ProductPerformance'))
const PaymentCollections = lazy(() => import('./pages/PaymentCollections'))
const CollectionPayments = lazy(() => import('./pages/CollectionPayments'))
const RestaurantModule = lazy(() => import('./pages/RestaurantModule'))
import Layout from './components/Layout'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth()
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    )
  }
  
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />
}

function AppContent() {
  const { isAuthenticated, loading, user } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  const homeRoute = user?.role?.toLowerCase() === 'executive' ? '/executive-dashboard' : '/dashboard'

  return (
    <Routes>
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to={homeRoute} replace /> : <Login />}
      />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <Layout>
              <Suspense fallback={<div className="flex justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div></div>}>
              <Routes>
                <Route path="/" element={<Navigate to={homeRoute} replace />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/restaurant/menu/categories" element={<MenuCategories />} />
                <Route path="/restaurant/menu/items" element={<MenuItems />} />
                <Route path="/restaurant/shifts/staff" element={<StaffShifts />} />
                <Route path="/restaurant/staff" element={<RestaurantStaff />} />
                <Route path="/restaurant/trips" element={<RestaurantTrips />} />
                <Route path="/restaurant/audit" element={<AuditEvents />} />
                <Route path="/restaurant/collections" element={<PaymentCollections />} />
                <Route path="/restaurant/collections/payments" element={<CollectionPayments />} />
                <Route path="/restaurant/reports" element={<ReportsHome />} />
                <Route path="/restaurant/reports/breakdown/sales" element={<BreakdownSales />} />
                <Route path="/restaurant/reports/products/performance" element={<ProductPerformance />} />
                <Route path="/restaurant/reports/:report" element={<ReportView />} />
                <Route path="/restaurant/sales/:saleId" element={<SaleDetail />} />
                <Route path="/restaurant/:slug" element={<RestaurantModule />} />
                <Route path="/executive-dashboard" element={<ExecutiveDashboard />} />
                <Route path="/categories" element={<Categories />} />
                <Route path="/regions" element={<Regions />} />
                <Route path="/stations" element={<Stations />} />
                <Route path="/stations/:stationId/fuel-prices" element={<FuelPrices />} />
                <Route path="/inventory" element={<Inventory />} />
                <Route path="/part-categories" element={<PartCategories />} />
                <Route path="/inventory/:partId" element={<PartDetails />} />
                <Route path="/vendors" element={<Vendors />} />
                <Route path="/vendors/:vendorId/ledger" element={<VendorLedger />} />
                <Route path="/purchase-orders" element={<PurchaseOrders />} />
                <Route path="/purchase-orders/new" element={<NewPurchaseOrder />} />
                <Route path="/inventory/report" element={<InventoryReport />} />
                <Route path="/inventory/lpg" element={<LpgInventory />} />
                <Route path="/inventory/lpg/:stationId" element={<StationLpgLedger />} />
                <Route path="/station-expenses" element={<StationExpenses />} />
                <Route path="/sales/post" element={<PostSale />} />
                <Route path="/sales/report" element={<SalesReport />} />
                <Route path="/sales/report/daily" element={<SalesDailyGraph />} />
                <Route path="/sales/report/summary" element={<SalesSummaryReport />} />
                <Route path="/sales/report/summary/:stationId" element={<StationSalesDetail />} />
                <Route path="/sales/report/summary/:stationId/day/:date" element={<StationDaySales />} />
                <Route path="/sales/report/summary/:stationId/variance-report" element={<StationVarianceReport />} />
                <Route path="/sales/report/weekly" element={<WeeklySalesReport />} />
                <Route path="/sales/report/fuel" element={<VehicleFuelReport />} />
                <Route path="/conversion" element={<Conversion />} />
                <Route path="/calendar" element={<Calendar />} />
                <Route path="/attendance" element={<Attendance />} />
                <Route path="/working-days" element={<WorkingDays />} />
                <Route path="/key-accounts/ledger" element={<KeyAccountLedgerReport />} />
               <Route path="/staff" element={<StaffPage />} />
                <Route path="/employees" element={<Employees />} />
                <Route path="/key-accounts" element={<KeyAccounts />} />
                <Route path="/key-accounts/:id/manage" element={<KeyAccountManage />} />
                <Route path="/clients" element={<Clients />} />
                <Route path="/clients/new" element={<ClientForm />} />
                <Route path="/clients/:clientId/edit" element={<ClientForm />} />
                <Route path="/clients/:clientId" element={<ClientDetails />} />
                <Route path="/clients/:clientId/vehicles/new" element={<AddVehicle />} />
                <Route path="/clients/:clientId/vehicles/:vehicleId/edit" element={<EditVehicle />} />
                <Route path="/clients/:clientId/vehicles/:vehicleId" element={<VehicleDetails />} />
                <Route path="/checklist-templates" element={<ChecklistTemplates />} />
                <Route path="/inspections/new" element={<InspectionForm />} />
                <Route path="/inspections/:templateId/edit" element={<InspectionForm />} />
                <Route path="/clients/:clientId/vehicles/:vehicleId/inspections/:inspectionId" element={<InspectionDetails />} />
                <Route path="/vehicles" element={<Vehicles />} />
                <Route path="/vehicles/new" element={<AddVehicle />} />
                <Route path="/external-vehicles" element={<ExternalVehicles />} />
                <Route path="/external-vehicles/owners" element={<ExternalVehicleOwners />} />
                <Route path="/external-vehicles/owners/:ownerId" element={<ExternalVehicleOwnerDetails />} />
                <Route path="/parts" element={<Parts />} />
                <Route path="/services" element={<Services />} />
                <Route path="/job-cards" element={<JobCards />} />
                <Route path="/job-cards/new" element={<JobCardForm />} />
                <Route path="/job-cards/:id" element={<JobCardForm />} />
                <Route path="/job-cards/:id/invoice" element={<JobCardInvoice />} />
                <Route path="/invoices" element={<Invoices />} />
                <Route path="/payments" element={<Payments />} />
                <Route path="/accounts/profit-loss" element={<ProfitLoss />} />
                <Route path="/quotations" element={<Quotations />} />
                <Route path="/accounts" element={<Accounts />} />
                <Route path="/stores" element={<Stores />} />
                <Route path="/chat" element={<Chat />} />
                <Route path="/notices" element={<Notices />} />
              </Routes>
              </Suspense>
            </Layout>
          </ProtectedRoute>
        }
      />
    </Routes>
  )
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </Router>
  )
}

export default App
