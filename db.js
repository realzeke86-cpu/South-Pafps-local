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
const API_BASE = new URL('./api', window.location.href).toString().replace(/\/$/, '');

// ─────────────────────────────────────────────
// Low-level fetch helpers
// ─────────────────────────────────────────────
// Common headers for all API requests — bypasses ngrok browser-warning interstitial
// X-User-Id is read by attendance.php (and any other server-side auth checks) since
// the app does not use PHP sessions — the logged-in user lives in localStorage only.
function getStoredSessionUser() {
  try {
    const raw = sessionStorage.getItem('pos_currentUser');
    if (raw) return JSON.parse(raw);
  } catch (e) { }
  try {
    const legacyRaw = localStorage.getItem('pos_currentUser');
    if (legacyRaw) return JSON.parse(legacyRaw);
  } catch (e) { }
  return null;
}

function getApiHeaders() {
  const sessionUser = getStoredSessionUser();
  const state = JSON.parse(localStorage.getItem('pos_state') || '{}');
  const userId = sessionUser?.id || state.currentUser?.id || '';
  return {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true',
    ...(userId ? { 'X-User-Id': userId } : {}),
  };
}
const API_HEADERS = getApiHeaders; // kept as function so headers refresh on each call

async function apiRequest(path, options = {}) {
  const res = await fetch(API_BASE + path, {
    ...options,
    headers: {
      ...getApiHeaders(),
      ...(options.headers || {}),
    },
  });

  const raw = await res.text();
  let json = null;

  try {
    json = raw ? JSON.parse(raw) : null;
  } catch (err) {
    const preview = raw.trim().slice(0, 220) || '(empty response)';
    throw new Error(`Unexpected API response (${res.status} ${res.statusText}): ${preview}`);
  }

  if (!res.ok || !json || !json.ok) {
    throw new Error(json?.error || `API request failed (${res.status} ${res.statusText})`);
  }

  return json.data;
}

async function apiGet(path) {
  return apiRequest(path);
}

async function apiPost(path, body) {
  return apiRequest(path, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

async function apiPut(path, body) {
  return apiRequest(path, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

async function apiDelete(path) {
  return apiRequest(path, {
    method: 'DELETE',
  });
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

    // Sync order payment records into localStorage('om_payments')
    if (serverState.orderPayments && Array.isArray(serverState.orderPayments)) {
      const localPays = JSON.parse(localStorage.getItem('om_payments') || '[]');
      const serverPayIds = new Set(serverState.orderPayments.map(p => String(p.id)));
      const localOnlyPays = localPays.filter(p => !serverPayIds.has(String(p.id)));
      const mergedPays = [...serverState.orderPayments.map(p => ({
        id:            p.id,
        orderId:       p.order_id,
        orderNumber:   p.order_id,
        customerId:    p.customer_id    || '',
        businessName:  p.business_name  || '',
        contactPerson: p.contact_person || '',
        totalAmount:   parseFloat(p.total_amount)  || 0,
        downpayment:   parseFloat(p.downpayment)   || 0,
        balance:       parseFloat(p.balance)        || 0,
        modeOfPayment: p.mode_of_payment || '',
        paymentStatus: p.payment_status  || 'Pending',
        amountPaid:    parseFloat(p.downpayment)   || 0,
        note:          p.note            || '',
        date:          p.date            || '',
      })), ...localOnlyPays];
      localStorage.setItem('om_payments', JSON.stringify(mergedPays));
    }

    // Sync production records into localStorage('om_production')
    if (serverState.productionRecords && Array.isArray(serverState.productionRecords)) {
      const localProds = JSON.parse(localStorage.getItem('om_production') || '[]');
      const serverProdIds = new Set(serverState.productionRecords.map(p => String(p.id)));
      const localOnlyProds = localProds.filter(p => !serverProdIds.has(String(p.id)));
      const mergedProds = [...serverState.productionRecords.map(p => ({
        id:            p.id,
        orderId:       p.order_id,
        orderNumber:   p.order_id,
        progress:      parseInt(p.progress)   || 0,
        qcResult:      p.qc_status            || null,
        qcStatus:      p.qc_status            || null,
        assignedTo:    p.assigned_to          || null,
        materialsUsed: p.materials_note       || null,
        updatedAt:     p.updated_at           || null,
      })), ...localOnlyProds];
      localStorage.setItem('om_production', JSON.stringify(mergedProds));
    }

    // Sync dispatch records into localStorage('om_dispatch')
    if (serverState.dispatchRecords && Array.isArray(serverState.dispatchRecords)) {
      const localDisps = JSON.parse(localStorage.getItem('om_dispatch') || '[]');
      const serverDispIds = new Set(serverState.dispatchRecords.map(d => String(d.id)));
      const localOnlyDisps = localDisps.filter(d => !serverDispIds.has(String(d.id)));
      const mergedDisps = [...serverState.dispatchRecords.map(d => ({
        id:             d.id,
        orderId:        d.order_id,
        orderNumber:    d.order_id,
        dispatchMethod: d.dispatch_method  || null,
        dispatchedAt:   d.dispatched_at    || null,
        dispatchedBy:   d.dispatched_by    || null,
        notes:          d.note             || null,
        date:           d.dispatched_at    || null,
      })), ...localOnlyDisps];
      localStorage.setItem('om_dispatch', JSON.stringify(mergedDisps));
    }

    // FIX: Sync orders from server into the separate 'orders' localStorage key
    // app.js uses getOrders()/saveOrders() which read/write localStorage('orders'),
    // NOT pos_state. So we must explicitly sync them here on boot.
    if (serverState.orders && Array.isArray(serverState.orders)) {
      const local = JSON.parse(localStorage.getItem('orders') || '[]');
      const serverOrderIds = new Set(serverState.orders.map(o => String(o.id)));
      // Keep any local orders not yet confirmed on the server (optimistic creates)
      const localOnly = local.filter(o => !serverOrderIds.has(String(o.id)));
      const mergedOrders = [...serverState.orders, ...localOnly];
      localStorage.setItem('orders', JSON.stringify(mergedOrders));
    }

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

    // Merge printProducts: server wins if it has data; preserve local if server is empty
    // (local ones exist until they've been persisted to DB)
    const serverPrintProds = serverState.printProducts || [];
    const localPrintProds  = local.printProducts || [];
    let mergedPrintProducts;
    if (serverPrintProds.length > 0) {
      // Server has data — merge: server wins on conflict, keep any local-only products
      const serverPrintIds = new Set(serverPrintProds.map(p => p.id));
      const localOnlyPrints = localPrintProds.filter(p => !serverPrintIds.has(p.id));
      mergedPrintProducts = [...serverPrintProds, ...localOnlyPrints];
    } else {
      // Server returned empty — keep local data (not yet synced to DB)
      mergedPrintProducts = localPrintProds;
    }

    // Merge payroll submissions: server is the source of truth, but preserve
    // local-only entries that were created while offline and not yet synced.
    const serverPayrollSubs = serverState.payrollSubmissions || [];
    const localPayrollSubs = Array.isArray(local.payrollSubmissions) ? local.payrollSubmissions : [];
    const serverPayrollIds = new Set(serverPayrollSubs.map(p => String(p.id)));
    const localOnlyPayrollSubs = localPayrollSubs.filter(p => !serverPayrollIds.has(String(p.id)));
    const mergedPayrollSubmissions = [...serverPayrollSubs, ...localOnlyPayrollSubs];

    // Merge payroll runs: server is source of truth, but keep local-only batches
    // that may have been created while offline and not synced yet.
    const serverPayrollRuns = serverState.payrollRuns || [];
    const localPayrollRuns = Array.isArray(local.payrollRuns) ? local.payrollRuns : [];
    const serverPayrollRunIds = new Set(serverPayrollRuns.map(p => String(p.id)));
    const localOnlyPayrollRuns = localPayrollRuns.filter(p => !serverPayrollRunIds.has(String(p.id)));
    const mergedPayrollRuns = [...serverPayrollRuns, ...localOnlyPayrollRuns];

    // Map payslips from snake_case (DB columns) to camelCase (app expects)
    // Without this, p.userId is always undefined and employees see no payslips
    const mappedPayslips = (serverState.payslips || []).map(function(p) {
      return {
        id:           p.id,
        userId:       p.user_id,
        employeeName: p.employee_name,
        payPeriod:    p.pay_period,
        periodKey:    p.period_key,
        dailyRate:    parseFloat(p.daily_rate)  || 0,
        daysPresent:  parseInt(p.days_present)  || 0,
        daysAbsent:   parseInt(p.days_absent)   || 0,
        incentives:   parseFloat(p.incentives)  || 0,
        grossPay:     parseFloat(p.gross_pay)   || 0,
        deductions:   parseFloat(p.deductions)  || 0,
        sss:          parseFloat(p.sss)         || 0,
        philhealth:   parseFloat(p.philhealth)  || 0,
        hdmf:         parseFloat(p.hdmf)        || 0,
        netPay:       parseFloat(p.net_pay)     || 0,
        notes:        p.notes                   || '',
        sentBy:       p.sent_by,
        sentAt:       p.sent_at,
        branchId:     p.branch_id               || null,
      };
    });

    const merged = {
      ...serverState,
      shifts:          mergedShifts,
      sales:           mergedSales,
      cashMovements:   mergedCashMovements,
      shiftSchedules:  mergedSchedules,
      printProducts:   mergedPrintProducts,
      payrollSubmissions: mergedPayrollSubmissions,
      payrollRuns:     mergedPayrollRuns,
      payslips:        mappedPayslips,
      cart:            local.cart            || [],
      posDraft:        local.posDraft        || {},
      scheduleView:    local.scheduleView    || 'daily',
      scheduleDate:    local.scheduleDate    || null,
      scheduleWeekStart: local.scheduleWeekStart || null,
      dashboardPrefs:  local.dashboardPrefs  || {},
      currentUser:     getStoredSessionUser() || null,
      // Employees come from server; fall back to local copy if server is unreachable
      employees:       serverState.employees || local.employees || [],
      // Attendance: server is now the single source of truth.
      // Drop any stale _pending placeholders that survived a previous session crash.
      attendanceRecords: (serverState.attendanceRecords || []).filter(r => !r._pending),
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
  await apiPost('/users', user);
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

DB.savePayrollSubmission = async function (submission) {
  try {
    return await apiPost('/payroll-submissions', submission);
  } catch (e) {
    console.error('[DB] savePayrollSubmission failed:', e.message);
    throw e;
  }
};

DB.updatePayrollSubmission = async function (id, payload) {
  try {
    return await apiPut('/payroll-submissions/' + id, payload);
  } catch (e) {
    console.error('[DB] updatePayrollSubmission failed:', e.message);
    throw e;
  }
};

DB.savePayrollRun = async function (payrollRun) {
  try {
    return await apiPost('/payroll-runs', payrollRun);
  } catch (e) {
    console.error('[DB] savePayrollRun failed:', e.message);
    throw e;
  }
};

DB.deletePayrollRun = async function (id) {
  try {
    return await apiDelete('/payroll-runs/' + id);
  } catch (e) {
    console.error('[DB] deletePayrollRun failed:', e.message);
  }
};

DB.updatePayrollRun = async function (id, payload) {
  try {
    return await apiPut('/payroll-runs/' + id, payload);
  } catch (e) {
    console.error('[DB] updatePayrollRun failed:', e.message);
    throw e;
  }
};

// ─────────────────────────────────────────────
// Employees (HR records — stored on the users table via employee_id + HR fields)
// There is no separate /employees endpoint. All employee data is stamped on
// the users row. state.php reconstructs employees[] from users WHERE employee_id IS NOT NULL.
// ─────────────────────────────────────────────
DB.saveEmployee = async function (employee) {
  // employee.linkedUserId is the users.id of the linked login account.
  // We stamp employee_id + all HR fields onto that user row.
  const userId = employee.linkedUserId;
  if (!userId) {
    console.warn('[DB] saveEmployee: no linkedUserId — cannot persist to DB.');
    return;
  }
  try {
    await apiPut('/users/' + userId, {
      employeeId:       employee.id,
      email:            employee.email            || null,
      birthdate:        employee.birthdate         || null,
      gender:           employee.gender            || null,
      address:          employee.address           || null,
      emergencyContact: employee.emergencyContact  || null,
      position:         employee.position          || null,
      dateHired:        employee.dateHired         || null,
      employmentStatus: employee.employmentStatus  || null,
      sss:              employee.sss               || null,
      philhealth:       employee.philhealth        || null,
      pagibig:          employee.pagibig           || null,
      tin:              employee.tin               || null,
    });
  } catch (e) {
    console.error('[DB] saveEmployee (PUT /users) failed:', e.message);
  }
};

DB.updateEmployee = async function (id, payload) {
  // id here is the employee record id (emp_xxx).
  // We need the linked user's id to call PUT /users/:userId.
  // The payload should include linkedUserId when called from the app.
  const userId = payload.linkedUserId;
  if (!userId) {
    console.warn('[DB] updateEmployee: no linkedUserId in payload — cannot persist to DB.');
    return;
  }
  try {
    await apiPut('/users/' + userId, {
      employeeId:       id,
      email:            payload.email            || null,
      birthdate:        payload.birthdate         || null,
      gender:           payload.gender            || null,
      address:          payload.address           || null,
      emergencyContact: payload.emergencyContact  || null,
      position:         payload.position          || null,
      dateHired:        payload.dateHired         || null,
      employmentStatus: payload.employmentStatus  || null,
      sss:              payload.sss               || null,
      philhealth:       payload.philhealth        || null,
      pagibig:          payload.pagibig           || null,
      tin:              payload.tin               || null,
    });
  } catch (e) {
    console.error('[DB] updateEmployee (PUT /users) failed:', e.message);
  }
};

DB.deleteEmployee = async function (id) {
  // Deleting an employee record = clearing employee_id + HR fields from the user row.
  // We don't have the userId here directly; the caller (app.js deleteEmployee) must
  // pass it via a separate DB.updateUser call. This is a no-op at the API level
  // since there is no /employees route — app.js handles it by calling DB.deleteUser.
  console.log('[DB] deleteEmployee called for emp id:', id, '— handled by app.js via DB.deleteUser');
};

// ─────────────────────────────────────────────
// Print Products (Printing Inventory)
// ─────────────────────────────────────────────
DB.savePrintProduct = async function (product) {
  try {
    await apiPost('/print-products', product);
  } catch (e) {
    console.error('[DB] savePrintProduct failed:', e.message);
  }
};

DB.updatePrintProduct = async function (id, payload) {
  try {
    await apiPut('/print-products/' + id, payload);
  } catch (e) {
    console.error('[DB] updatePrintProduct failed:', e.message);
  }
};

DB.deletePrintProduct = async function (id) {
  try {
    await apiDelete('/print-products/' + id);
  } catch (e) {
    console.error('[DB] deletePrintProduct failed:', e.message);
  }
};

// ─────────────────────────────────────────────
// Attendance Records
// POST /attendance  { action: "time-in",  deviceFp: "..." }
// POST /attendance  { action: "time-out", deviceFp: "..." }
// PUT  /attendance/:id  (admin force clock-out)
// The server always sets its own timestamps — we never send a client timestamp.
// ─────────────────────────────────────────────
DB.saveAttendance = async function (action, deviceFp, targetUserId) {
  // action must be "time-in" or "time-out"
  return await apiPost('/attendance', { action, deviceFp: deviceFp || '', targetUserId: targetUserId || null });
};

DB.updateAttendance = async function (id, payload) {
  // Used for admin force clock-out: { forceOut: true, forceOutReason: "..." }
  return await apiPut('/attendance/' + id, payload);
};

DB.editAttendanceTime = async function (id, editTimeIn, editTimeOut, editReason) {
  // Used by Admin (any record) and Branch Manager (employee records in their branch).
  // editTimeIn / editTimeOut are "HH:MM" strings (24-hour). Pass null to leave unchanged.
  const payload = { editReason };
  if (editTimeIn  !== null) payload.editTimeIn  = editTimeIn;
  if (editTimeOut !== null) payload.editTimeOut = editTimeOut;
  return await apiPut('/attendance/' + id, payload);
};

console.log('[DB] db.js loaded — API base:', API_BASE);
