/**
 * DynamicRent - Data Schema: Bookings (js/data/bookingData.js)
 * Defines initial demo booking records with dynamic current-month dates so that
 * Occupancy & Demand calculations immediately demonstrate live metrics.
 */

/**
 * Generate relative date string for the current month
 * @param {number} dayOfMonth 1-31
 * @returns {string} YYYY-MM-DD
 */
function getRelativeDateStr(dayOfMonth) {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(Math.max(1, Math.min(28, dayOfMonth))).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const INITIAL_BOOKINGS = [
  {
    id: "BOOK001",
    propertyId: "PROP001",
    propertyName: "Green Valley Villa",
    propertyLocation: "Hyderabad",
    customerId: "USR_DEMO",
    customerName: "Rahul Sharma",
    customerEmail: "rahul.sharma@gmail.com",
    checkIn: getRelativeDateStr(2),
    checkOut: getRelativeDateStr(8),
    nights: 6,
    guests: 4,
    pricePerNight: 4500,
    subtotal: 27000,
    serviceFee: 0,
    totalPrice: 27000,
    status: "confirmed",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 60).toISOString()
  },
  {
    id: "BOOK002",
    propertyId: "PROP001",
    propertyName: "Green Valley Villa",
    propertyLocation: "Hyderabad",
    customerId: "USR_DEMO",
    customerName: "Priya Patel",
    customerEmail: "priya.patel@outlook.com",
    checkIn: getRelativeDateStr(10),
    checkOut: getRelativeDateStr(17),
    nights: 7,
    guests: 6,
    pricePerNight: 4500,
    subtotal: 31500,
    serviceFee: 0,
    totalPrice: 31500,
    status: "confirmed",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString()
  },
  {
    id: "BOOK003",
    propertyId: "PROP001",
    propertyName: "Green Valley Villa",
    propertyLocation: "Hyderabad",
    customerId: "USR_DEMO",
    customerName: "Amitabh Sen",
    customerEmail: "amitabh.sen@tcs.com",
    checkIn: getRelativeDateStr(19),
    checkOut: getRelativeDateStr(26),
    nights: 7,
    guests: 5,
    pricePerNight: 4500,
    subtotal: 31500,
    serviceFee: 0,
    totalPrice: 31500,
    status: "confirmed",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString()
  },
  {
    id: "BOOK004",
    propertyId: "PROP001",
    propertyName: "Green Valley Villa",
    propertyLocation: "Hyderabad",
    customerId: "USR_DEMO",
    customerName: "Ananya Deshmukh",
    customerEmail: "ananya.d@gmail.com",
    checkIn: getRelativeDateStr(27),
    checkOut: getRelativeDateStr(30),
    nights: 3,
    guests: 5,
    pricePerNight: 4500,
    subtotal: 13500,
    serviceFee: 0,
    totalPrice: 13500,
    status: "pending",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString()
  },
  {
    id: "BOOK005",
    propertyId: "PROP002",
    propertyName: "Urban Heights Apartment",
    propertyLocation: "Bangalore",
    customerId: "USR_DEMO",
    customerName: "Vikram Malhotra",
    customerEmail: "vikram.m@techcorp.in",
    checkIn: getRelativeDateStr(3),
    checkOut: getRelativeDateStr(12),
    nights: 9,
    guests: 2,
    pricePerNight: 3200,
    subtotal: 28800,
    serviceFee: 0,
    totalPrice: 28800,
    status: "confirmed",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 50).toISOString()
  },
  {
    id: "BOOK006",
    propertyId: "PROP002",
    propertyName: "Urban Heights Apartment",
    propertyLocation: "Bangalore",
    customerId: "USR_DEMO",
    customerName: "Rohan Verma",
    customerEmail: "rohan.verma@startup.io",
    checkIn: getRelativeDateStr(14),
    checkOut: getRelativeDateStr(22),
    nights: 8,
    guests: 2,
    pricePerNight: 3200,
    subtotal: 25600,
    serviceFee: 0,
    totalPrice: 25600,
    status: "confirmed",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 30).toISOString()
  },
  {
    id: "BOOK007",
    propertyId: "PROP002",
    propertyName: "Urban Heights Apartment",
    propertyLocation: "Bangalore",
    customerId: "USR_DEMO",
    customerName: "Meera Nair",
    customerEmail: "meera.nair@infosys.com",
    checkIn: getRelativeDateStr(23),
    checkOut: getRelativeDateStr(29),
    nights: 6,
    guests: 2,
    pricePerNight: 3200,
    subtotal: 19200,
    serviceFee: 0,
    totalPrice: 19200,
    status: "confirmed",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 18).toISOString()
  },
  {
    id: "BOOK008",
    propertyId: "PROP003",
    propertyName: "Lake View Residence",
    propertyLocation: "Pune",
    customerId: "USR_DEMO",
    customerName: "Sneha Reddy",
    customerEmail: "sneha.reddy@yahoo.com",
    checkIn: getRelativeDateStr(10),
    checkOut: getRelativeDateStr(17),
    nights: 7,
    guests: 4,
    pricePerNight: 3800,
    subtotal: 26600,
    serviceFee: 0,
    totalPrice: 26600,
    status: "confirmed",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 20).toISOString()
  },
  {
    id: "BOOK009",
    propertyId: "PROP004",
    propertyName: "Luxury Garden House",
    propertyLocation: "Delhi",
    customerId: "USR_DEMO",
    customerName: "Arjun Kapoor",
    customerEmail: "arjun.kapoor@gmail.com",
    checkIn: getRelativeDateStr(6),
    checkOut: getRelativeDateStr(14),
    nights: 8,
    guests: 6,
    pricePerNight: 5200,
    subtotal: 41600,
    serviceFee: 0,
    totalPrice: 41600,
    status: "confirmed",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 28).toISOString()
  },
  {
    id: "BOOK010",
    propertyId: "PROP005",
    propertyName: "City Center Studio",
    propertyLocation: "Mumbai",
    customerId: "USR_DEMO",
    customerName: "Kavita Rao",
    customerEmail: "kavita.rao@gmail.com",
    checkIn: getRelativeDateStr(20),
    checkOut: getRelativeDateStr(25),
    nights: 5,
    guests: 2,
    pricePerNight: 2800,
    subtotal: 14000,
    serviceFee: 0,
    totalPrice: 14000,
    status: "pending",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString()
  },
  {
    id: "BOOK011",
    propertyId: "PROP006",
    propertyName: "Palm Residency",
    propertyLocation: "Chennai",
    customerId: "USR_DEMO",
    customerName: "Deepak Sundaram",
    customerEmail: "deepak.s@chennai.org",
    checkIn: getRelativeDateStr(1),
    checkOut: getRelativeDateStr(4),
    nights: 3,
    guests: 4,
    pricePerNight: 4900,
    subtotal: 14700,
    serviceFee: 0,
    totalPrice: 14700,
    status: "rejected",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString()
  }
];

/**
 * Initialize default booking seed records into localStorage
 */
function initDefaultBookings() {
  try {
    const raw = localStorage.getItem('dynamicRentBookings');
    if (!raw || JSON.parse(raw).length === 0) {
      localStorage.setItem('dynamicRentBookings', JSON.stringify(INITIAL_BOOKINGS));
      console.log('Seeded initial demo bookings into localStorage (dynamicRentBookings)');
    }
  } catch (err) {
    console.error('Error seeding booking data:', err);
    localStorage.setItem('dynamicRentBookings', JSON.stringify(INITIAL_BOOKINGS));
  }
}

// Auto-seed demo bookings on script load
initDefaultBookings();
