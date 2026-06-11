export type StatusTone = "success" | "warning" | "info" | "neutral" | "danger"

export const dashboardStats = [
  {
    label: "Occupied rooms",
    value: "18 / 24",
    detail: "75% occupancy",
    progress: 75,
    tone: "success" as StatusTone,
  },
  {
    label: "Today arrivals",
    value: "7",
    detail: "3 already checked in",
    progress: 42,
    tone: "info" as StatusTone,
  },
  {
    label: "Open balances",
    value: "$1,280",
    detail: "5 pending payments",
    progress: 28,
    tone: "warning" as StatusTone,
  },
  {
    label: "Maintenance",
    value: "2",
    detail: "Rooms need attention",
    progress: 12,
    tone: "danger" as StatusTone,
  },
]

export const rooms = [
  { id: "R-101", name: "Room 101", type: "Deluxe Double", floor: "Ground", rate: "$32", status: "Available", tone: "success" as StatusTone },
  { id: "R-102", name: "Room 102", type: "Twin Garden", floor: "Ground", rate: "$28", status: "Occupied", tone: "neutral" as StatusTone },
  { id: "R-204", name: "Room 204", type: "Family Suite", floor: "Second", rate: "$52", status: "Reserved", tone: "info" as StatusTone },
  { id: "R-207", name: "Room 207", type: "Standard Queen", floor: "Second", rate: "$24", status: "Cleaning", tone: "warning" as StatusTone },
  { id: "R-301", name: "Room 301", type: "Balcony King", floor: "Third", rate: "$46", status: "Maintenance", tone: "danger" as StatusTone },
]

export const guests = [
  { id: "G-2101", name: "Maya Chen", phone: "+855 12 304 221", nationality: "Singapore", stay: "Room 204", status: "In house", tone: "success" as StatusTone },
  { id: "G-2102", name: "Daniel Weber", phone: "+49 170 882 103", nationality: "Germany", stay: "Arrives today", status: "Expected", tone: "info" as StatusTone },
  { id: "G-2103", name: "Sreypov Lim", phone: "+855 77 552 801", nationality: "Cambodia", stay: "Room 102", status: "In house", tone: "success" as StatusTone },
  { id: "G-2104", name: "Aiko Tanaka", phone: "+81 90 1124 5609", nationality: "Japan", stay: "Departed", status: "Past guest", tone: "neutral" as StatusTone },
]

export const bookings = [
  { id: "B-8841", guest: "Maya Chen", room: "Room 204", dates: "Jun 6 - Jun 9", source: "Walk-in", status: "Checked in", tone: "success" as StatusTone },
  { id: "B-8842", guest: "Daniel Weber", room: "Room 101", dates: "Jun 6 - Jun 8", source: "Agoda", status: "Confirmed", tone: "info" as StatusTone },
  { id: "B-8843", guest: "Nora Smith", room: "Room 301", dates: "Jun 7 - Jun 12", source: "Booking.com", status: "Needs room", tone: "warning" as StatusTone },
  { id: "B-8844", guest: "Sreypov Lim", room: "Room 102", dates: "Jun 4 - Jun 7", source: "Phone", status: "Checkout due", tone: "warning" as StatusTone },
]

export const payments = [
  { id: "P-3301", guest: "Maya Chen", method: "Cash", amount: "$96", reference: "B-8841", status: "Paid", tone: "success" as StatusTone },
  { id: "P-3302", guest: "Daniel Weber", method: "Card", amount: "$64", reference: "B-8842", status: "Authorized", tone: "info" as StatusTone },
  { id: "P-3303", guest: "Sreypov Lim", method: "ABA Transfer", amount: "$72", reference: "B-8836", status: "Pending", tone: "warning" as StatusTone },
  { id: "P-3304", guest: "Nora Smith", method: "Unassigned", amount: "$260", reference: "B-8843", status: "Unpaid", tone: "danger" as StatusTone },
]

export const users = [
  { id: "U-001", name: "Sot Samban", email: "owner@sotsamban.local", role: "Owner", status: "Active", tone: "success" as StatusTone },
  { id: "U-002", name: "Kanha Sok", email: "frontdesk@sotsamban.local", role: "Reception", status: "Active", tone: "success" as StatusTone },
  { id: "U-003", name: "Dara Chea", email: "housekeeping@sotsamban.local", role: "Housekeeping", status: "On duty", tone: "info" as StatusTone },
  { id: "U-004", name: "Admin Backup", email: "backup@sotsamban.local", role: "Manager", status: "Invited", tone: "warning" as StatusTone },
]
