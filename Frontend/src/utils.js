import { UNITS } from '../../Shared/units.js'

const numberFormatter = new Intl.NumberFormat('en-PH', { maximumFractionDigits: 6 })
const currencyNumberFormatter = new Intl.NumberFormat('en-PH', {
  maximumFractionDigits: 2,
})
const currencyAxisNumberFormatter = new Intl.NumberFormat('en-PH', {
  maximumFractionDigits: 0,
})

export const formatNumber = (value) => numberFormatter.format(Number(value ?? 0))
export const formatCurrency = (value) => `₱${currencyNumberFormatter.format(Number(value ?? 0))}`
export const formatCurrencyAxis = (value) => `₱${currencyAxisNumberFormatter.format(Number(value ?? 0))}`

// Backward-compatible names for modules that already use these helpers.
export const peso = formatCurrency
export const qty = formatNumber

export const dateTime = (d) =>
  d ? new Date(d).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '–'

export const dateOnly = (d) =>
  d ? new Date(d).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : '–'

export function timeAgo(d) {
  if (!d) return ''
  const mins = Math.max(0, Math.round((Date.now() - new Date(d).getTime()) / 60000))
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs} hr ago`
  return `${Math.floor(hrs / 24)} d ago`
}

// Date for <input type="datetime-local">
export function toLocalInput(d) {
  if (!d) return ''
  const date = new Date(d)
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export const ORDER_TYPES = {
  dine_in: 'Dine-in',
  takeout: 'Take-out',
  reservation: 'Reservation',
  buffet: 'Buffet',
  birthday: 'Birthday celebration',
  special_event: 'Special event',
  advance_order: 'Advance order',
}
export const NEEDS_SCHEDULE = ['reservation', 'buffet', 'birthday', 'special_event', 'advance_order']
export const HAS_TABLE = ['dine_in', 'reservation', 'buffet', 'birthday', 'special_event']

export const STATUS_LABEL = {
  pending: 'Not sent yet',
  sent: 'Sent to kitchen',
  preparing: 'Preparing',
  ready: 'Ready',
  served: 'Served',
  cancelled: 'Cancelled',
}

export const ROLE_LABEL = {
  cashier: 'Cashier / Service staff',
  kitchen: 'Kitchen personnel',
  inventory: 'Inventory personnel',
  owner: 'Café owner',
}

export const INVENTORY_CATEGORIES = ['Seafood', 'Meat', 'Vegetables', 'Dairy', 'Dry Goods', 'Beverages', 'Other']
export { UNITS }
