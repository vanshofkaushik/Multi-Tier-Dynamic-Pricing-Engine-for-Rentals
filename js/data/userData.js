/**
 * DynamicRent - Data Schema: Users
 * Seed user profiles for Customers and Property Owners.
 * Note: Storing plain passwords in localStorage is strictly for this frontend learning prototype.
 */

const DEFAULT_DEMO_USERS = [
  {
    id: "USR_DEMO",
    name: "Demo Customer",
    email: "customer@dynamicrent.com",
    password: "123456",
    role: "customer"
  },
  {
    id: "OWN001",
    name: "Demo Owner",
    email: "owner@dynamicrent.com",
    password: "123456",
    role: "owner"
  }
];

/**
 * Initialize default demo accounts in localStorage if not already present.
 * Ensures demo users are not duplicated on repeated page loads.
 */
function initDefaultUsers() {
  const STORAGE_KEY = "dynamicRentUsers";
  let existingUsers = [];

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      existingUsers = JSON.parse(raw);
    }
  } catch (e) {
    console.error("Error parsing existing users from localStorage:", e);
    existingUsers = [];
  }

  let modified = false;

  DEFAULT_DEMO_USERS.forEach(demoUser => {
    const userIndex = existingUsers.findIndex(u => u.email.toLowerCase() === demoUser.email.toLowerCase());
    if (userIndex === -1) {
      existingUsers.push(demoUser);
      modified = true;
    } else if (existingUsers[userIndex].role === 'owner' && existingUsers[userIndex].id !== 'OWN001') {
      existingUsers[userIndex].id = 'OWN001';
      modified = true;
    }
  });

  if (modified || !localStorage.getItem(STORAGE_KEY)) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(existingUsers));
    console.log("Default demo users initialized in localStorage.");
  }
}
