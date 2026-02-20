// db.js — API client for South Pafps POS
// Place this file next to index.html and add:
//   <script src="db.js"></script>
// BEFORE your <script src="app.js"></script>
//
// This file:
//  1. Defines the API base URL
//  2. Provides loadStateFromServer() which replaces localStorage on boot
//  3. Provides DB.* methods called by app.js instead of saveState()
//  4. Falls back to localStorage if the server is unreachable

// ─────────────────────────────────────────────
// CONFIG — adjust if your Laragon folder differs
// ─────────────────────────────────────────────
const API_BASE = 'http://localhost/South-Pafps/api';

// ─────────────────────────────────────────────
// Low-level fetch helpers
// ─────────────────────────────────────────────
async function apiGet(path) {
  const res = await fetch(API_BASE + path);
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'API error');
  return json.data;
}

async function apiPost(path, body) {
  const res = await fetch(API_BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'API error');
  return json.data;
}

async function apiPut(path, body) {
  const res = await fetch(API_BASE + path, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'API error');
  return json.data;
}

async function apiDelete(path) {
  const res = await fetch(API_BASE + path, { method: 'DELETE' });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'API error');
  return json.data;
}

// ─────────────────────────────────────────────
// Boot — load full state from server
// Called once on page load from app.js init
// ─────────────────────────────────────────────
window.loadStateFromServer = async function () {
  try {
    const serverState = await apiGet('/state');

    // Merge with any local-only keys (cart, posDraft, scheduleView, etc.)
    const local = JSON.parse(localStorage.getItem('pos_state') || '{}');

    const merged = {
      ...serverState,
      // Keep UI-only state from localStorage
      cart:            local.cart || [],
      posDraft:        local.posDraft || {},
      scheduleView:    local.scheduleView || 'daily',
      scheduleDate:    local.scheduleDate || null,
      scheduleWeekStart: local.scheduleWeekStart || null,
      dashboardPrefs:  local.dashboardPrefs || {},
      currentUser:     null, // always re-login
    };

    localStorage.setItem('pos_state', JSON.stringify(merged));
    console.log('[DB] State loaded from server ✓');
    return true;
  } catch (err) {
    console.warn('[DB] Server unreachable, using localStorage fallback:', err.message);
    return false;
  }
};

// ─────────────────────────────────────────────
// Auth
// ─────────────────────────────────────────────
window.DB = window.DB || {};

DB.login = async function (username, password) {
  return apiPost('/auth', { username, password });
};

// ─────────────────────────────────────────────
// Sales
// ─────────────────────────────────────────────
DB.saveSale = async function (sale) {
  try {
    await apiPost('/sales', sale);
  } catch (e) {
    console.error('[DB] saveSale failed:', e.message);
  }
};

DB.voidSale = async function (saleId, voidReason) {
  try {
    await apiPut('/sales/' + saleId, { voided: true, voidReason });
  } catch (e) {
    console.error('[DB] voidSale failed:', e.message);
  }
};

DB.editSale = async function (saleId, notes) {
  try {
    await apiPut('/sales/' + saleId, { notes });
  } catch (e) {
    console.error('[DB] editSale failed:', e.message);
  }
};

// ─────────────────────────────────────────────
// Shifts
// ─────────────────────────────────────────────
DB.openShift = async function (shift) {
  try {
    await apiPost('/shifts', shift);
  } catch (e) {
    console.error('[DB] openShift failed:', e.message);
  }
};

DB.closeShift = async function (shiftId, payload) {
  try {
    await apiPut('/shifts/' + shiftId, payload);
  } catch (e) {
    console.error('[DB] closeShift failed:', e.message);
  }
};

// ─────────────────────────────────────────────
// Cash Movements
// ─────────────────────────────────────────────
DB.saveCashMovement = async function (movement) {
  try {
    await apiPost('/cash-movements', movement);
  } catch (e) {
    console.error('[DB] saveCashMovement failed:', e.message);
  }
};

// ─────────────────────────────────────────────
// Handover Notes
// ─────────────────────────────────────────────
DB.saveHandoverNote = async function (note) {
  try {
    await apiPost('/handover-notes', note);
  } catch (e) {
    console.error('[DB] saveHandoverNote failed:', e.message);
  }
};

// ─────────────────────────────────────────────
// Customers
// ─────────────────────────────────────────────
DB.saveCustomer = async function (customer) {
  try {
    await apiPost('/customers', customer);
  } catch (e) {
    console.error('[DB] saveCustomer failed:', e.message);
  }
};

DB.updateCustomer = async function (id, payload) {
  try {
    await apiPut('/customers/' + id, payload);
  } catch (e) {
    console.error('[DB] updateCustomer failed:', e.message);
  }
};

// ─────────────────────────────────────────────
// AR Payments
// ─────────────────────────────────────────────
DB.postARPayment = async function (payment) {
  try {
    await apiPost('/ar-payments', payment);
  } catch (e) {
    console.error('[DB] postARPayment failed:', e.message);
  }
};

// ─────────────────────────────────────────────
// Products
// ─────────────────────────────────────────────
DB.saveProduct = async function (product) {
  try {
    await apiPost('/products', product);
  } catch (e) {
    console.error('[DB] saveProduct failed:', e.message);
  }
};

DB.updateProduct = async function (id, payload) {
  try {
    await apiPut('/products/' + id, payload);
  } catch (e) {
    console.error('[DB] updateProduct failed:', e.message);
  }
};

DB.deleteProduct = async function (id) {
  try {
    await apiDelete('/products/' + id);
  } catch (e) {
    console.error('[DB] deleteProduct failed:', e.message);
  }
};

// ─────────────────────────────────────────────
// Orders
// ─────────────────────────────────────────────
DB.saveOrder = async function (order) {
  try {
    const result = await apiPost('/orders', order);
    return result; // returns { id: newId }
  } catch (e) {
    console.error('[DB] saveOrder failed:', e.message);
  }
};

DB.updateOrder = async function (id, payload) {
  try {
    await apiPut('/orders/' + id, payload);
  } catch (e) {
    console.error('[DB] updateOrder failed:', e.message);
  }
};

// ─────────────────────────────────────────────
// Branch Transfers
// ─────────────────────────────────────────────
DB.saveTransfer = async function (transfer) {
  try {
    await apiPost('/transfers', transfer);
  } catch (e) {
    console.error('[DB] saveTransfer failed:', e.message);
  }
};

// ─────────────────────────────────────────────
// Receivings
// ─────────────────────────────────────────────
DB.saveReceiving = async function (receiving) {
  try {
    await apiPost('/receivings', receiving);
  } catch (e) {
    console.error('[DB] saveReceiving failed:', e.message);
  }
};

// ─────────────────────────────────────────────
// Shift Schedules
// ─────────────────────────────────────────────
DB.saveShiftSchedule = async function (userId, date, assignment) {
  try {
    await apiPost('/shift-schedules', { userId, date, assignment });
  } catch (e) {
    console.error('[DB] saveShiftSchedule failed:', e.message);
  }
};

// ─────────────────────────────────────────────
// Audit Logs
// ─────────────────────────────────────────────
DB.saveAuditLog = async function (log) {
  try {
    await apiPost('/audit', log);
  } catch (e) {
    // Audit failure is non-critical, silent
  }
};

// ─────────────────────────────────────────────
// System Config
// ─────────────────────────────────────────────
DB.saveSystemConfig = async function (cfg) {
  try {
    await apiPut('/config', cfg);
  } catch (e) {
    console.error('[DB] saveSystemConfig failed:', e.message);
  }
};

// ─────────────────────────────────────────────
// Users / Branches (admin only)
// ─────────────────────────────────────────────
DB.saveUser = async function (user) {
  try {
    await apiPost('/users', user);
  } catch (e) {
    console.error('[DB] saveUser failed:', e.message);
  }
};

DB.updateUser = async function (id, payload) {
  try {
    await apiPut('/users/' + id, payload);
  } catch (e) {
    console.error('[DB] updateUser failed:', e.message);
  }
};

DB.saveBranch = async function (branch) {
  try {
    await apiPost('/branches', branch);
  } catch (e) {
    console.error('[DB] saveBranch failed:', e.message);
  }
};

DB.updateBranch = async function (id, payload) {
  try {
    await apiPut('/branches/' + id, payload);
  } catch (e) {
    console.error('[DB] updateBranch failed:', e.message);
  }
};

console.log('[DB] db.js loaded — API base:', API_BASE);
