import { DashboardPage, MapPage, ReportsPage, SessionsPage } from './OverviewPages'
import { EditSlotPage, SlotsPage } from './SlotPages'
import RatesPage from './RatesPage'
import TransactionsPage from './TransactionsPage'
import AttendantsPage from './AttendantsPage'
import SettingsPage from './SettingsPage'
import { match } from '../lib/router'

export default function Admin({ path, params }: { path: string; params: URLSearchParams }) {
  const edit = match('/admin/slots/:id', path)
  if (edit) return <EditSlotPage key={edit.id} id={edit.id} />
  switch (path) {
    case '/admin/map':
      return <MapPage key={params.toString()} params={params} />
    case '/admin/slots':
      return <SlotsPage />
    case '/admin/sessions':
      return <SessionsPage key={params.toString()} params={params} />
    case '/admin/rates':
      return <RatesPage />
    case '/admin/transactions':
      return <TransactionsPage key={params.toString()} params={params} />
    case '/admin/reports':
      return <ReportsPage />
    case '/admin/attendants':
      return <AttendantsPage />
    case '/admin/settings':
      return <SettingsPage />
    default:
      return <DashboardPage />
  }
}
