/**
 * DynamicRent - Data: Property Listings (js/data/propertyData.js)
 * Demo property dataset representing verified accommodations across Indian metropolitan locations.
 */

const INITIAL_PROPERTIES = [
  {
    id: "PROP001",
    name: "Green Valley Villa",
    location: "Hyderabad",
    area: "Gachibowli",
    type: "Villa",
    description: "A luxury modern villa nestled in tranquil green landscapes. Features private garden lawns, temperature-controlled pool, expansive open-plan interiors, and 24/7 security concierge.",
    pricePerNight: 4500,
    rating: 4.8,
    reviews: 124,
    guests: 6,
    bedrooms: 3,
    bathrooms: 2,
    amenities: [
      "WiFi",
      "Parking",
      "Air Conditioning",
      "Swimming Pool",
      "Garden Lawn",
      "Kitchen",
      "Power Backup"
    ],
    image: "https://images.unsplash.com/photo-1580587771525-78b9dba3b914?auto=format&fit=crop&w=1000&q=80",
    status: "available",
    ownerId: "OWN001",
    minPrice: 3200,
    maxPrice: 6800,
    currentPrice: 4500
  },
  {
    id: "PROP002",
    name: "Urban Heights Apartment",
    location: "Bangalore",
    area: "Indiranagar",
    type: "Apartment",
    description: "Sleek architectural high-rise apartment in prime Indiranagar. Floor-to-ceiling panoramic glass windows with breathtaking city skyline views, ergonomic workspace, and high-speed fiber internet.",
    pricePerNight: 3200,
    rating: 4.8,
    reviews: 98,
    guests: 2,
    bedrooms: 1,
    bathrooms: 1,
    amenities: [
      "WiFi",
      "Elevator",
      "Air Conditioning",
      "Gym Access",
      "Dedicated Workspace",
      "Smart TV"
    ],
    image: "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1000&q=80",
    status: "available",
    ownerId: "OWN001",
    minPrice: 2400,
    maxPrice: 4800,
    currentPrice: 3200
  },
  {
    id: "PROP003",
    name: "Lake View Residence",
    location: "Pune",
    area: "Koregaon Park",
    type: "House",
    description: "Serene lakeside family residence featuring a private observation balcony, lush floral grounds, open kitchen, and a relaxing sun deck ideal for evening retreats.",
    pricePerNight: 3800,
    rating: 4.9,
    reviews: 142,
    guests: 5,
    bedrooms: 3,
    bathrooms: 2,
    amenities: [
      "WiFi",
      "Parking",
      "Lake View",
      "Private Balcony",
      "Equipped Kitchen",
      "Pet Friendly"
    ],
    image: "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1000&q=80",
    status: "available",
    ownerId: "OWN001",
    minPrice: 2800,
    maxPrice: 5600,
    currentPrice: 3800
  },
  {
    id: "PROP004",
    name: "Luxury Garden House",
    location: "Delhi",
    area: "Vasant Vihar",
    type: "House",
    description: "An expansive private estate boasting manicured botanical gardens, luxury marble finishings, spacious master suites, and dedicated on-site security.",
    pricePerNight: 5200,
    rating: 4.7,
    reviews: 86,
    guests: 6,
    bedrooms: 3,
    bathrooms: 3,
    amenities: [
      "WiFi",
      "Parking",
      "Air Conditioning",
      "Private Lawn",
      "Security Guard",
      "Power Backup",
      "Barbecue"
    ],
    image: "https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&w=1000&q=80",
    status: "available",
    ownerId: "OWN001",
    minPrice: 4000,
    maxPrice: 7500,
    currentPrice: 5200
  },
  {
    id: "PROP005",
    name: "City Center Studio",
    location: "Mumbai",
    area: "Bandra West",
    type: "Studio",
    description: "Chic contemporary studio flat located minutes from Bandra Bandstand. Fully air-conditioned, featuring bespoke modular furniture, smart keyless entry, and quick metro connectivity.",
    pricePerNight: 2800,
    rating: 4.6,
    reviews: 110,
    guests: 2,
    bedrooms: 1,
    bathrooms: 1,
    amenities: [
      "WiFi",
      "Air Conditioning",
      "Smart TV",
      "Kitchenette",
      "Metro Access",
      "Elevator"
    ],
    image: "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1000&q=80",
    status: "available",
    ownerId: "OWN001",
    minPrice: 2000,
    maxPrice: 4200,
    currentPrice: 2800
  },
  {
    id: "PROP006",
    name: "Palm Residency",
    location: "Chennai",
    area: "ECR (East Coast Road)",
    type: "Villa",
    description: "Coastal luxury villa steps away from the scenic East Coast beach. Boasts a private plunge pool, breezy patio pergolas, coconut palm gardens, and spacious sun-lit bedrooms.",
    pricePerNight: 4900,
    rating: 4.9,
    reviews: 75,
    guests: 8,
    bedrooms: 4,
    bathrooms: 3,
    amenities: [
      "WiFi",
      "Parking",
      "Swimming Pool",
      "Beach Access",
      "Air Conditioning",
      "Patio & Gazebo"
    ],
    image: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1000&q=80",
    status: "available",
    ownerId: "OWN001",
    minPrice: 3600,
    maxPrice: 7200,
    currentPrice: 4900
  }
];

// Fallback image in case of network or image loading issues
const PROPERTY_IMAGE_FALLBACK = "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=1000&q=80";

/**
 * Initialize default property data into localStorage without duplicating
 */
function initDefaultProperties() {
  try {
    const raw = localStorage.getItem('dynamicRentProperties');
    if (!raw || JSON.parse(raw).length === 0) {
      localStorage.setItem('dynamicRentProperties', JSON.stringify(INITIAL_PROPERTIES));
      console.log('Seeded initial properties into localStorage (dynamicRentProperties)');
    }
  } catch (err) {
    console.error('Error initializing property data:', err);
    localStorage.setItem('dynamicRentProperties', JSON.stringify(INITIAL_PROPERTIES));
  }
}

// Auto-seed property listings when script is loaded
initDefaultProperties();
