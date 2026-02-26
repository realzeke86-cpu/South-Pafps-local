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
const API_BASE = window.location.origin.includes('localhost')
  ? 'http://localhost/South-Pafps/api'
  : window.location.origin + '/api';

// ─────────────────────────────────────────────
// Low-level fetch helpers
// ─────────────────────────────────────────────
// Common headers for all API requests — bypasses ngrok browser-warning interstitial
const API_HEADERS = {
  'Content-Type': 'application/json',
  'ngrok-skip-browser-warning': 'true',
};

async function apiGet(path) {
  const res = await fetch(API_BASE + path, { headers: API_HEADERS });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'API error');
  return json.data;
}

async function apiPost(path, body) {
  const res = await fetch(API_BASE + path, {
    method: 'POST',
    headers: API_HEADERS,
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'API error');
  return json.data;
}

async function apiPut(path, body) {
  const res = await fetch(API_BASE + path, {
    method: 'PUT',
    headers: API_HEADERS,
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'API error');
  return json.data;
}

async function apiDelete(path) {
  const res = await fetch(API_BASE + path, { method: 'DELETE', headers: API_HEADERS });
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

    // Merge shifts: keep any local open shifts not yet confirmed on the server
    const serverShiftIds = new Set((serverState.shifts || []).map(sh => sh.id));
    const localOnlyShifts = (local.shifts || []).filter(sh => !serverShiftIds.has(sh.id));
    const mergedShifts = [...(serverState.shifts || []), ...localOnlyShifts];

    // Merge sales: keep any local sales not yet on the server
    const serverSaleIds = new Set((serverState.sales || []).map(s => s.id));
    const localOnlySales = (local.sales || []).filter(s => !serverSaleIds.has(s.id));
    const mergedSales = [...(serverState.sales || []), ...localOnlySales];

    // Merge cash movements similarly
    const serverCmIds = new Set((serverState.cashMovements || []).map(c => c.id));
    const localOnlyCms = (local.cashMovements || []).filter(c => !serverCmIds.has(c.id));
    const mergedCashMovements = [...(serverState.cashMovements || []), ...localOnlyCms];

    // FIX: Sync om_customers — preserve ALL fields including branchId
    if (serverState.omCustomers && serverState.omCustomers.length >= 0) {
      const omCustomers = (serverState.omCustomers || []).map(c => ({
        id:             c.id,
        businessName:   c.businessName   || '',
        contactPerson:  c.contactPerson  || '',
        phone:          c.phone          || '',
        email:          c.email          || '',
        address:        c.address        || '',
        notes:          c.notes          || '',
        modeOfPayment:  c.modeOfPayment  || '',
        modeOfDelivery: c.modeOfDelivery || '',
        branchStaff:    c.branchStaff    || '',
        branchId:       c.branchId       || null,   // ← was missing, caused branch filtering to break
        createdAt:      c.createdAt      || '',
      }));
      localStorage.setItem('om_customers', JSON.stringify(omCustomers));
    }

    // Merge shiftSchedules: server is source of truth, but keep any local keys
    // that the server doesn't know about yet (optimistic saves not yet confirmed)
    const serverSchedules = serverState.shiftSchedules || {};
    const localSchedules  = local.shiftSchedules || {};
    const mergedSchedules = { ...localSchedules, ...serverSchedules }; // server wins on conflict

    const merged = {
      ...serverState,
      shifts:          mergedShifts,
      sales:           mergedSales,
      cashMovements:   mergedCashMovements,
      shiftSchedules:  mergedSchedules,
      cart:            local.cart            || [],
      posDraft:        local.posDraft        || {},
      scheduleView:    local.scheduleView    || 'daily',
      scheduleDate:    local.scheduleDate    || null,
      scheduleWeekStart: local.scheduleWeekStart || null,
      dashboardPrefs:  local.dashboardPrefs  || {},
      currentUser:     local.currentUser     || null, // restore from localStorage if present
      // Employees come from server; fall back to local copy if server is unreachable
      employees:       serverState.employees || local.employees || [],
    };

    // Payslips come entirely from server — no local merge needed
    // (employees only see what admin has explicitly sent)

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

DB.voidSale = async function (saleId, voidReason, voidedAt) {
  try {
    await apiPut('/sales/' + saleId, { voided: true, voidReason, voidedAt: voidedAt || new Date().toISOString() });
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
// Customers (POS)
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

DB.deleteCustomer = async function (id) {
  try {
    await apiDelete('/customers/' + id);
  } catch (e) {
    console.error('[DB] deleteCustomer failed:', e.message);
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
// Suppliers
// ─────────────────────────────────────────────
DB.saveSupplier = async function (supplier) {
  try {
    await apiPost('/suppliers', supplier);
  } catch (e) {
    console.error('[DB] saveSupplier failed:', e.message);
  }
};

DB.updateSupplier = async function (id, payload) {
  try {
    await apiPut('/suppliers/' + id, payload);
  } catch (e) {
    console.error('[DB] updateSupplier failed:', e.message);
  }
};

DB.deleteSupplier = async function (id) {
  try {
    await apiDelete('/suppliers/' + id);
  } catch (e) {
    console.error('[DB] deleteSupplier failed:', e.message);
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

DB.deleteOrder = async function (id) {
  try {
    await apiDelete('/orders/' + id);
  } catch (e) {
    console.error('[DB] deleteOrder failed:', e.message);
  }
};

// ─────────────────────────────────────────────
// Order Payments
// ─────────────────────────────────────────────
DB.saveOrderPayment = async function (payment) {
  try {
    await apiPost('/order-payments', payment);
  } catch (e) {
    console.error('[DB] saveOrderPayment failed:', e.message);
  }
};

DB.updateOrderPayment = async function (id, payload) {
  try {
    await apiPut('/order-payments/' + id, payload);
  } catch (e) {
    console.error('[DB] updateOrderPayment failed:', e.message);
  }
};

// ─────────────────────────────────────────────
// Production
// ─────────────────────────────────────────────
DB.saveProduction = async function (record) {
  try {
    await apiPost('/production', record);
  } catch (e) {
    console.error('[DB] saveProduction failed:', e.message);
  }
};

DB.updateProduction = async function (id, payload) {
  try {
    await apiPut('/production/' + id, payload);
  } catch (e) {
    console.error('[DB] updateProduction failed:', e.message);
  }
};

// ─────────────────────────────────────────────
// Dispatch
// ─────────────────────────────────────────────
DB.saveDispatch = async function (record) {
  try {
    await apiPost('/dispatch', record);
  } catch (e) {
    console.error('[DB] saveDispatch failed:', e.message);
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
    if (window.showToast) showToast('Schedule not saved to server: ' + e.message, 'error');
  }
};

// ─────────────────────────────────────────────
// Time Cards
// ─────────────────────────────────────────────
DB.saveTimecard = async function (timecard) {
  try {
    await apiPost('/timecards', timecard);
  } catch (e) {
    console.error('[DB] saveTimecard failed:', e.message);
  }
};

DB.reviewTimecard = async function (id, status, reviewedBy) {
  try {
    await apiPut('/timecards/' + id, { status, reviewedBy });
  } catch (e) {
    console.error('[DB] reviewTimecard failed:', e.message);
  }
};

DB.deleteTimecard = async function (id) {
  try {
    await apiDelete('/timecards/' + id);
  } catch (e) {
    console.error('[DB] deleteTimecard failed:', e.message);
  }
};

// ─────────────────────────────────────────────
// Leaves
// ─────────────────────────────────────────────
DB.saveLeave = async function (leave) {
  try {
    await apiPost('/leaves', leave);
  } catch (e) {
    console.error('[DB] saveLeave failed:', e.message);
  }
};

DB.reviewLeave = async function (id, status, reviewedBy) {
  try {
    await apiPut('/leaves/' + id, { status, reviewedBy });
  } catch (e) {
    console.error('[DB] reviewLeave failed:', e.message);
  }
};

DB.deleteLeave = async function (id) {
  try {
    await apiDelete('/leaves/' + id);
  } catch (e) {
    console.error('[DB] deleteLeave failed:', e.message);
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

DB.deleteUser = async function (id) {
  try {
    await apiDelete('/users/' + id);
  } catch (e) {
    console.error('[DB] deleteUser failed:', e.message);
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

// ─────────────────────────────────────────────
// OM Customers (Order Management)
// ─────────────────────────────────────────────
DB.saveOMCustomer = async function (customer) {
  try {
    await apiPost('/om-customers', customer);
  } catch (e) {
    console.error('[DB] saveOMCustomer failed:', e.message);
  }
};

DB.updateOMCustomer = async function (id, payload) {
  try {
    await apiPut('/om-customers/' + id, payload);
  } catch (e) {
    console.error('[DB] updateOMCustomer failed:', e.message);
  }
};

DB.deleteOMCustomer = async function (id) {
  try {
    await apiDelete('/om-customers/' + id);
  } catch (e) {
    console.error('[DB] deleteOMCustomer failed:', e.message);
  }
};

// ─────────────────────────────────────────────
// Payslips (admin sends; employees receive)
// ─────────────────────────────────────────────
DB.sendPayslip = async function (payslip) {
  try {
    return await apiPost('/payslips', payslip);
  } catch (e) {
    console.error('[DB] sendPayslip failed:', e.message);
    throw e; // re-throw so UI can show feedback
  }
};

DB.deletePayslip = async function (id) {
  try {
    await apiDelete('/payslips/' + id);
  } catch (e) {
    console.error('[DB] deletePayslip failed:', e.message);
    throw e;
  }
};

// ─────────────────────────────────────────────
// Employees (HR records — separate from login accounts)
// ─────────────────────────────────────────────
DB.saveEmployee = async function (employee) {
  try {
    await apiPost('/employees', employee);
  } catch (e) {
    console.error('[DB] saveEmployee failed:', e.message);
  }
};

DB.updateEmployee = async function (id, payload) {
  try {
    await apiPut('/employees/' + id, payload);
  } catch (e) {
    console.error('[DB] updateEmployee failed:', e.message);
  }
};

DB.deleteEmployee = async function (id) {
  try {
    await apiDelete('/employees/' + id);
  } catch (e) {
    console.error('[DB] deleteEmployee failed:', e.message);
  }
};

console.log('[DB] db.js loaded — API base:', API_BASE);
