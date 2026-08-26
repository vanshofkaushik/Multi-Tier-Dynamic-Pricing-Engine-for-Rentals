# Multi-Tier-Dynamic-Pricing-Engine-for-Rentals

# DynamicRent 🏡⚡
### Smart Property Rental & Rule-Based Dynamic Pricing Platform
#### Live Demo: https://multi-tier-dynamic-pricing-engine-f.vercel.app/

**DynamicRent** is a property rental platform that combines property booking with a rule-based dynamic pricing engine. Customers can browse properties and make bookings, while property owners can manage bookings and optimize rental prices based on occupancy, demand, seasonality, day of week and property amenities.

---

## 📌 Problem Statement
Traditional vacation and short-term rental management relies on static, manual rate configuration. Property owners often struggle with:
1. **Lost Revenue during High Demand:** Undercharging during peak holiday seasons, weekends, and high-occupancy periods.
2. **Vacant Inventory during Low Demand:** Overpricing during low-season or midweek periods, causing listings to sit unoccupied.
3. **Lack of Transparency in Algorithmic Pricing:** Black-box AI pricing systems adjust rates without human-readable explanations or owner consent, eroding host trust.
4. **Data Fragmentation:** Lack of integrated booking management, occupancy tracking, price audit trails, and revenue analytics in one unified platform.

---

## 💡 Solution
DynamicRent delivers an end-to-end rental marketplace coupled with an explainable, transparent, rule-based **Dynamic Pricing Decision Support Cockpit**:
- **Explainable Multipliers:** Calculates transparent rate adjustments based on 5 verified market factors (Occupancy, Demand, Season, Day of Week, Amenities).
- **Owner-in-the-Loop Governance:** Generates recommended rates and dynamic explanations, but strictly requires explicit owner approval before updating live property rates.
- **Price Snapshot Preservation:** Locks historical rates on confirmed/pending bookings so active reservations are never retroactively altered.
- **Closed-Loop Feedback:** Live bookings feed occupancy and demand, which guide pricing recommendations, driving approved rate adjustments that flow directly into revenue analytics.

---

## 🚀 Core Features

### 👤 Customer Portal
- **Browse & Filter Listings:** Search rental listings across India with live filters by location, price range, bedrooms, and amenities.
- **Dynamic Live Pricing:** View active market prices (`currentPrice`) updated in real-time.
- **Interactive Booking Flow:** Select stay windows, choose guest counts, review subtotal breakdowns, and submit booking requests.
- **My Bookings Dashboard:** Track real-time status of reservations (`Pending`, `Confirmed`, `Rejected`, `Cancelled`).
- **Data Privacy:** Customers only see active market prices; internal algorithms, base prices, occupancy rates, and demand scores remain confidential.

### 🏢 Property Owner Portal (White + Green SaaS Cockpit)
- **Executive Dashboard:** 5 KPI cards (Total Properties, Booking Requests, Confirmed Bookings, Total Revenue, Portfolio Occupancy), Occupancy progress bar, and listing performance cards.
- **Booking Management:** Review incoming guest requests with instant **Confirm** and modal-guarded **Reject** workflows.
- **Occupancy Engine:** Computes occupied calendar nights vs total capacity (excluding checkout days) without double-counting.
- **Demand Engine:** Generates 0–100 composite demand scores and tiers (`Low`, `Medium`, `High`, `Very High`).
- **Dynamic Pricing Engine:** Multi-factor rate recommendations with safety bounds, nearest ₹50 rounding, and transparent price breakdown tables.
- **Price History Audit Log:** Immutable chronological audit trail recording old price, new price, percentage change, and algorithmic rationale.
- **Visual Analytics Dashboard:** Interactive Chart.js visualizations for Revenue Trends, Booking Status distribution, Occupancy benchmarks, Property Revenue rankings, and Price History timelines.

---

## ⚙️ How the Dynamic Pricing Engine Works

### Pricing Formula
$$\text{Recommended Price} = \text{Base Price} \times (1 + \text{OccAdj}) \times (1 + \text{DemAdj}) \times (1 + \text{SeasonAdj}) \times (1 + \text{DayAdj}) \times (1 + \text{AmenityAdj})$$

1. **Base Reference Price:** Starting anchor representing the property's intrinsic baseline value.
2. **Occupancy Adjustment:**
   - Occupancy $< 30\%$: **$-10\%$** (Volume incentive)
   - $30\% - 59\%$: **$0\%$** (Normal baseline)
   - $60\% - 79\%$: **$+10\%$** (High demand)
   - $80\% - 89\%$: **$+20\%$** (High scarcity)
   - $\ge 90\%$: **$+30\%$** (Near capacity)
3. **Demand Adjustment:**
   - Low (0–39): **$-5\%$** | Medium (40–59): **$0\%$** | High (60–79): **$+10\%$** | Very High (80–100): **$+20\%$**
4. **Seasonal Adjustment:**
   - December: **$+15\%$ (Peak)** | April–May: **$+10\%$ (Summer)** | Oct–Nov: **$+5\%$ (Festive)** | Jun–Sep: **$0\%$** | Jan–Mar: **$-5\%$**
5. **Day of Week Adjustment (Weekend Premium):**
   - Friday: **$+5\%$** | Saturday: **$+10\%$** | Sunday: **$+5\%$** | Mon–Thu: **$0\%$**
6. **Amenity Premium:**
   - Swimming Pool (+5%), AC (+3%), Gym (+3%), Scenic View (+4%), Power Backup/Lawn (+2%), capped at **$+15\%$** maximum.
7. **Safety Limits & Rounding:**
   - Clamped strictly within `[property.minPrice, property.maxPrice]`.
   - Rounded to the nearest **₹50** for clean consumer presentation.

---

## 🛠️ Technology Stack
- **Frontend Architecture:** Semantic HTML5, Vanilla JavaScript (ES6+ Modules), Vanilla CSS3.
- **UI Design System:** Modern White + Green SaaS theme with custom typography (`Outfit` & `Plus Jakarta Sans`).
- **Data Visualizations:** Chart.js (Responsive Canvas charts).
- **Client Storage:** `localStorage` (Persistence for properties, bookings, users, price history) and `sessionStorage` (Active auth session).

---

## 📂 Project Structure
```
Dyanmic Rent Final/
├── index.html                   # Landing page with hero, search, features & Viva workflow
├── login.html                   # Authentication login portal (Customer & Owner roles)
├── register.html                # User registration portal
├── README.md                    # Project documentation and architectural guide
├── css/
│   ├── style.css                # Global design system tokens, layout & toast notifications
│   ├── auth.css                 # Login and registration authentication styles
│   ├── customer.css             # Customer portal layouts and booking components
│   └── owner.css                # Owner SaaS dashboard, tables, badges, and pricing cockpit
├── customer/
│   ├── dashboard.html           # Customer dashboard overview & stats
│   ├── properties.html          # Marketplace listings directory with dynamic filters
│   ├── property-details.html    # Property details, amenities, and live price display
│   ├── booking.html             # Date selection & price calculation booking cockpit
│   └── my-bookings.html         # Customer reservation status and itinerary cards
├── owner/
│   ├── dashboard.html           # Executive property management dashboard
│   ├── properties.html          # Owner listings catalog
│   ├── bookings.html            # Guest booking requests management & actions
│   ├── pricing.html             # Dynamic Pricing Cockpit & approval workflow
│   ├── analytics.html           # Revenue, occupancy & price trend visual dashboard
│   └── price-history.html       # Immutable price history audit trail
└── js/
    ├── app.js                   # Landing page controller & demo helpers
    ├── auth/
    │   ├── authGuard.js         # Role-based route guards & redirection checks
    │   ├── login.js             # Login authentication handler & demo quick-fill
    │   ├── logout.js            # Session clearance & logout helper
    │   └── register.js          # User creation & registration validator
    ├── customer/
    │   ├── customerDashboard.js # Customer dashboard controller
    │   ├── properties.js        # Marketplace search & filter controller
    │   ├── propertyDetails.js   # Listing detail renderer
    │   ├── booking.js           # Booking submission & live calculation engine
    │   └── myBookings.js        # Customer reservations table renderer
    ├── data/
    │   ├── propertyData.js      # Default property catalog seed
    │   ├── bookingData.js       # Dynamic relative-date demo bookings seed
    │   └── userData.js          # Demo customer and owner credentials
    ├── owner/
    │   ├── occupancy.js         # Calendar-accurate Occupancy Engine
    │   ├── demandEngine.js      # Composite 0-100 Demand Engine
    │   ├── seasonRules.js       # Month-based season and weekend rules
    │   ├── pricingEngine.js     # Core Dynamic Pricing calculation engine
    │   ├── pricingPage.js       # Pricing cockpit UI & approval workflow
    │   ├── priceHistory.js      # Price History Manager & audit log controller
    │   ├── analytics.js         # Analytics data calculations & performance tiers
    │   ├── analyticsCharts.js   # Chart.js visualization engine (White + Green)
    │   ├── ownerDashboard.js    # Owner dashboard UI controller
    │   ├── ownerProperties.js   # Owner property cards renderer
    │   └── ownerBookings.js     # Booking approval & modal-guarded rejection
    ├── shared/
    │   ├── toast.js             # Accessible toast notification system
    │   └── mobileNav.js         # Mobile drawer navigation handler
    └── utils/
        ├── storage.js           # Safe localStorage/sessionStorage CRUD utility
        ├── dateUtils.js         # Date formatting & calendar night calculations
        └── validation.js        # Form and booking input validation helpers
```

---

## 🏃 How to Run Locally
1. Clone or extract the repository folder:
   ```bash
   cd "Dyanmic Rent Final"
   ```
2. Open `index.html` directly in any modern browser (Chrome, Edge, Firefox, Safari), or serve with a local static server:
   ```bash
   # Using npx serve or Live Server:
   npx serve .
   ```
3. Use the preconfigured Demo Accounts on `login.html`:
   - **Property Owner:** `owner@dynamicrent.com` (Password: `123456`)
   - **Customer:** `customer@dynamicrent.com` (Password: `123456`)

---

## 🔮 Future Improvements (Roadmap)
- **Backend Infrastructure:** Node.js / Express REST API and PostgreSQL / MongoDB database.
- **Payment Gateway:** Razorpay / Stripe integration with escrow hold until check-in.
- **Machine Learning Pricing:** Predictive time-series forecasting (Prophet / XGBoost) trained on historical local market comps.
- **Automated Notifications:** Webhook-driven transactional email and SMS booking updates.
- **Competitor Intelligence:** Real-time external market scraping APIs for localized rate benchmarking.
