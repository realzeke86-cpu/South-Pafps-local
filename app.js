// --- LocalStorage CRUD for Orders ---
function smoothScroll(sectionId) {
  const el = document.getElementById(sectionId);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ── Print helper ─────────────────────────────────────────────
// Opens a clean popup with only the provided HTML, then triggers print.
// Use this instead of window.print() everywhere to avoid printing the
// sidebar, topbar, modal overlays, and action buttons.
function printContent(html, title) {
  title = title || 'South Pafps — Print';
  // Use hidden iframe to avoid popup blockers
  let iframe = document.getElementById('__print_iframe__');
  if (!iframe) {
    iframe = document.createElement('iframe');
    iframe.id = '__print_iframe__';
    iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:none;';
    document.body.appendChild(iframe);
  }
  const doc = iframe.contentDocument || iframe.contentWindow.document;
  doc.open();
  doc.write(`<!DOCTYPE html><html><head>
    <meta charset="utf-8">
    <title>${title}</title>
    <style>
      *{margin:0;padding:0;box-sizing:border-box}
      body{font-family:'Arial','Segoe UI',sans-serif;font-size:13px;color:#111;padding:24px;background:#fff}
      table{width:100%;border-collapse:collapse}
      th,td{padding:8px 12px;text-align:left;border-bottom:1px solid #e0e0e0}
      th{font-size:11px;text-transform:uppercase;letter-spacing:0.06em;color:#666;background:#f8f8f8}
      .receipt{max-width:320px;margin:0 auto;font-family:monospace}
      .receipt-header{text-align:center;margin-bottom:12px;padding-bottom:12px;border-bottom:1px dashed #999}
      .receipt-row{display:flex;justify-content:space-between;padding:3px 0}
      .receipt-row.total{border-top:1px dashed #999;margin-top:6px;padding-top:6px;font-weight:700;font-size:14px}
      .receipt-footer{text-align:center;margin-top:12px;padding-top:12px;border-top:1px dashed #999;font-size:11px;color:#666}
      h1,h2,h3{margin-bottom:8px}
      .btn,.btn-icon,.btn-close-modal,.modal-footer,button{display:none!important}
      .badge{display:inline-block!important;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:700;letter-spacing:0.03em}
      .badge-success{background:#d1fae5;color:#065f46}
      .badge-warning{background:#fef3c7;color:#92400e}
      .badge-danger{background:#fee2e2;color:#991b1b}
      .badge-neutral{background:#f3f4f6;color:#374151}
      .no-print{display:none!important}
      @media print{body{padding:0}@page{margin:1.5cm}}
    </style>
  </head><body>${html}</body></html>`);
  doc.close();
  setTimeout(function () { iframe.contentWindow.focus(); iframe.contentWindow.print(); }, 300);
}

function getOrders() {
  return JSON.parse(localStorage.getItem('orders') || '[]');
}
function saveOrders(orders) {
  localStorage.setItem('orders', JSON.stringify(orders));
}

// currentPage
var currentPage = null;
// All data is stored locally in localStorage (no server required)
// Used to prevent stale async renders from overwriting a newer page
var __navRenderId = 0;
const POS_SESSION_USER_KEY = 'pos_currentUser';
const POS_SESSION_PAGE_KEY = 'pos_currentPage';
const POS_SESSION_EXPANDED_GROUPS_KEY = 'pos_expandedGroups';
const VALID_USER_ROLES = ['admin', 'branch_manager', 'hr', 'cashier', 'inventory_staff', 'print'];
const ROLE_LABELS = {
  admin: 'Main Admin',
  branch_manager: 'Branch Manager',
  hr: 'HR / Master Payroll',
  cashier: 'Cashier',
  inventory_staff: 'Inventory Personnel',
  print: 'Production Personnel',
};

function normalizeRole(role) {
  if (role === 'team_leader') return 'branch_manager';
  if (role === 'staff') return 'cashier';
  return VALID_USER_ROLES.includes(role) ? role : 'cashier';
}

function normalizeUserRole(user) {
  if (!user) return user;
  return { ...user, role: normalizeRole(user.role) };
}

function getRoleLabel(role) {
  return ROLE_LABELS[normalizeRole(role)] || role || 'User';
}

function isAdminRole(role) {
  return normalizeRole(role) === 'admin';
}

function isHrRole(role) {
  return normalizeRole(role) === 'hr';
}

function isBranchManagerRole(role) {
  return normalizeRole(role) === 'branch_manager';
}

function isCashierRole(role) {
  return normalizeRole(role) === 'cashier';
}

function isInventoryStaffRole(role) {
  return normalizeRole(role) === 'inventory_staff';
}

function isPrintRole(role) {
  return normalizeRole(role) === 'print';
}

function isBranchStaffRole(role) {
  const normalized = normalizeRole(role);
  return normalized === 'branch_manager' || normalized === 'cashier' || normalized === 'inventory_staff';
}

function getPositionOptionsByRole(role) {
  const normalized = normalizeRole(role);
  return {
    branch_manager: ['Branch Manager'],
    hr: ['HR Officer', 'Payroll Officer'],
    cashier: ['Cashier'],
    inventory_staff: ['Inventory Staff', 'Inventory Clerk'],
    print: ['Printing Operator', 'Print Supervisor'],
  }[normalized] || ['Cashier'];
}

function roleCanBeMainBranchOnly(role) {
  const normalized = normalizeRole(role);
  return normalized === 'hr' || normalized === 'print';
}

function omCurrentUser() {
  return getState().currentUser || null;
}

function omRole(user) {
  return normalizeRole((user || {}).role);
}

function omIsAdminUser(user) {
  return omRole(user) === 'admin';
}

function omIsCashierUser(user) {
  return omRole(user) === 'cashier';
}

function omIsPrintUser(user) {
  return omRole(user) === 'print';
}

function omCanManagePayments(user) {
  const role = omRole(user);
  return role === 'admin' || role === 'cashier';
}

function omCanManageProduction(user) {
  const role = omRole(user);
  return role === 'admin' || role === 'print';
}

function omCanManageDispatch(user) {
  const role = omRole(user);
  return role === 'admin' || role === 'print';
}

function omCanOverrideDispatch(user) {
  return omRole(user) === 'admin';
}

function omCanCreateOrders(user) {
  const role = omRole(user);
  return role === 'admin' || role === 'cashier';
}

// ── Strict forward-only status flow ────────────────────────────────────────
// QC (for_qc / passed / failed) is a sub-state of 'production', not a
// separate flow step — it lives in order.qc_status.
const OM_STATUS_FLOW = ['pending', 'approved', 'production', 'dispatch', 'completed'];

function omNextAllowedStatuses(currentStatus) {
  var idx = OM_STATUS_FLOW.indexOf(currentStatus);
  if (idx === -1) return [currentStatus];
  var allowed = [currentStatus]; // always include current
  if (idx + 1 < OM_STATUS_FLOW.length) allowed.push(OM_STATUS_FLOW[idx + 1]);
  return allowed;
}

function omCanApproveOrder(user, order) {
  if (!user || !order) return false;
  return omIsAdminUser(user) && order.status === 'pending';
}

function omApproveOrder(orderId) {
  var _u = getState().currentUser;
  if (!_u || !omIsAdminUser(_u)) { showToast('Only the Main Admin can approve project orders.', 'error'); return; }
  var orders = getOrders();
  var o = orders.find(function (x) { return String(x.id) === String(orderId); });
  if (!o) return;
  if (o.status !== 'pending') { showToast('Only pending orders can be approved.', 'error'); return; }
  o.status = 'approved';
  o.approved_at = new Date().toISOString();
  o.approved_by = _u.id;
  o.updated_at = new Date().toISOString();
  saveOrders(orders);
  DB.updateOrder(o.id, { status: 'approved', approved_at: o.approved_at, approved_by: o.approved_by });
  var s = getState();
  recordAudit(s, { action: 'order_approved', message: 'Order #' + orderId + ' approved for production by ' + (_u.name || _u.username), referenceId: String(orderId), meta: { approvedBy: _u.id } });
  saveState(s);
  showToast('Order #' + String(orderId).padStart(6, '0') + ' approved. Production can now begin.', 'success');
  renderOrders();
}

function omCanEditOrder(user, order) {
  if (!user || !order) return false;
  if (omIsAdminUser(user)) return true;
  if (omIsCashierUser(user)) return order.status !== 'completed';
  return false;
}

function omCanAdvanceToProduction(order) {
  if (!order) return false;
  return order.status === 'approved';
}

function omCanMoveToForQc(order) {
  if (!order) return false;
  return order.status === 'production';
}

function omCanCompleteOrder(order) {
  if (!order) return false;
  return omIsDispatchReady(order) && (order.balance || 0) <= 0;
}

function omQcState(order, prod) {
  const qc = String((order && order.qc_status) || (prod && prod.qcResult) || '').toLowerCase();
  if (qc === 'passed' || qc === 'pass') return 'passed';
  if (qc === 'failed' || qc === 'fail') return 'failed';
  if (qc === 'rework') return 'rework';
  if (qc === 'for_qc') return 'for_qc';
  return '';
}

function omNeedsQcReview(order, prod) {
  if (!order || order.status !== 'production') return false;
  const qc = omQcState(order, prod);
  return qc !== 'failed' && qc !== 'rework' && qc !== 'passed';
}

function omIsDispatchReady(order, prod) {
  if (!order) return false;
  return order.status === 'dispatch' && omQcState(order, prod) === 'passed';
}

function omDispatchRecordStamp(d) {
  return new Date(d && (d.updatedAt || d.dispatchedAt || d.date || d.createdAt) || 0).getTime() || 0;
}

function omUniqueDispatchRecords(dispatches) {
  const bestByOrder = new Map();
  (dispatches || []).forEach(function (d) {
    if (!d) return;
    const key = String(d.orderId || d.orderNumber || d.id || '');
    if (!key) return;
    const current = bestByOrder.get(key);
    if (!current || omDispatchRecordStamp(d) >= omDispatchRecordStamp(current)) {
      bestByOrder.set(key, d);
    }
  });
  return Array.from(bestByOrder.values());
}

function omDisplayStatus(order, prod) {
  if (!order) return 'pending';
  const qc = omQcState(order, prod);
  if (order.status === 'production' && qc === 'for_qc') return 'for_qc';
  if (order.status === 'production' && qc === 'rework') return 'rework';
  return order.status;
}

function omDisplayStatusBadge(order, prod) {
  const display = omDisplayStatus(order, prod);
  if (display === 'for_qc') return '<span class="badge badge-warning">' + iconSvg('clock') + ' For QC</span>';
  if (display === 'rework') return '<span class="badge badge-warning">' + iconSvg('warning') + ' Rework</span>';
  return omStatusBadge(display);
}

function omQcBadge(order, prod) {
  const qc = omQcState(order, prod);
  if (qc === 'passed') return '<span class="badge badge-success">QC Passed</span>';
  if (qc === 'failed') return '<span class="badge badge-danger">QC Failed</span>';
  if (qc === 'rework') return '<span class="badge badge-warning">For Rework</span>';
  if (qc === 'for_qc') return '<span class="badge badge-warning">For QC</span>';
  return '<span class="badge badge-neutral">Pending</span>';
}

function omSyncDispatchPaymentStatus(orderId, paymentStatus, balance) {
  var dispatches = getDispatchRecords();
  var changed = false;
  dispatches.forEach(function (d) {
    if (String(d.orderId) === String(orderId)) {
      d.paymentStatus = paymentStatus || 'Pending';
      if (balance !== undefined) d.balance = balance || 0;
      d.updatedAt = new Date().toISOString();
      changed = true;
    }
  });
  if (changed) saveDispatchRecords(dispatches);
}

function getStoredSessionUser() {
  try {
    const raw = sessionStorage.getItem(POS_SESSION_USER_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { }
  try {
    const legacyRaw = localStorage.getItem(POS_SESSION_USER_KEY);
    if (legacyRaw) return JSON.parse(legacyRaw);
  } catch (e) { }
  return null;
}

function persistSessionUser(user) {
  try {
    if (user) sessionStorage.setItem(POS_SESSION_USER_KEY, JSON.stringify(user));
    else sessionStorage.removeItem(POS_SESSION_USER_KEY);
  } catch (e) { }
  try {
    localStorage.removeItem(POS_SESSION_USER_KEY);
  } catch (e) { }
}

function getStoredPage() {
  try {
    return sessionStorage.getItem(POS_SESSION_PAGE_KEY) || null;
  } catch (e) {
    return null;
  }
}

function persistCurrentPage(page) {
  try {
    if (page) sessionStorage.setItem(POS_SESSION_PAGE_KEY, page);
    else sessionStorage.removeItem(POS_SESSION_PAGE_KEY);
  } catch (e) { }
}

function getStoredExpandedGroups() {
  try {
    const raw = sessionStorage.getItem(POS_SESSION_EXPANDED_GROUPS_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (e) {
    return {};
  }
}

function persistExpandedGroups(groups) {
  try {
    const entries = Object.entries(groups || {}).filter(([, isOpen]) => !!isOpen);
    if (entries.length) sessionStorage.setItem(POS_SESSION_EXPANDED_GROUPS_KEY, JSON.stringify(Object.fromEntries(entries)));
    else sessionStorage.removeItem(POS_SESSION_EXPANDED_GROUPS_KEY);
  } catch (e) { }
}

function collectExpandableGroupIds(items, out) {
  (items || []).forEach(item => {
    if (!item || !item.id) return;
    if (item.type === 'group' || item.type === 'subgroup') out.push(item.id);
    if (Array.isArray(item.children)) collectExpandableGroupIds(item.children, out);
  });
  return out;
}

function restoreExpandedGroups() {
  const validIds = new Set(collectExpandableGroupIds(getNavItems(), []));
  const stored = getStoredExpandedGroups();
  expandedGroups = Object.fromEntries(
    Object.entries(stored).filter(([id, isOpen]) => validIds.has(id) && !!isOpen)
  );
}

function getNavRenderId() {
  return __navRenderId;
}

function setPageHtml(page, navId, html) {
  // If user already navigated elsewhere, ignore late async results
  if (navId !== __navRenderId || currentPage !== page) return false;
  const el = document.getElementById('page-content');
  if (!el) return false;
  el.innerHTML = html;
  // Many pages inject inline SVG icons
  applySvgToElement(el);
  return true;
}

function setPageError(page, navId, html) {
  return setPageHtml(page, navId, html);
}
// showOverview — overview page removed; redirect to login
function showOverview() {
  showLogin();
}

// showForgotPassword
function showForgotPassword(e) {
  if (e) e.preventDefault();
  showModal(`<div style="text-align:center;padding:12px 0 8px;">
    <div style="font-size:52px;margin-bottom:16px;">🔐</div>
    <h3 style="font-family:var(--font-head);font-size:20px;color:var(--ink);font-weight:700;margin-bottom:10px;">Forgot Password?</h3>
    <p style="color:var(--ink-60);font-size:14px;line-height:1.7;max-width:300px;margin:0 auto 24px;">
      Please contact your <strong>system administrator</strong> or <strong>branch manager</strong> to reset your password.
    </p>
    <button class="btn-primary" style="max-width:200px;margin:0 auto;" onclick="closeModal()">Got it</button>
  </div>`);
}

// Toggle password field visibility (eye icon)
function togglePwVisibility(inputId, btn) {
  const input = document.getElementById(inputId);
  if (!input) return;
  const isHidden = input.type === 'password';
  input.type = isHidden ? 'text' : 'password';
  const icon = btn.querySelector('svg');
  if (icon) {
    if (isHidden) {
      icon.innerHTML = '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/>';
    } else {
      icon.innerHTML = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>';
    }
  }
}

// expandedGroups
var expandedGroups = {};
// showApp
function showApp(targetPage) {
  // Hide login page, show app shell
  document.getElementById('login-page').classList.add('hidden');
  document.getElementById('app-page').classList.remove('hidden');
  document.getElementById('overview-page').classList.add('hidden');
  // Update sidebar and topbar with user info
  restoreExpandedGroups();
  buildSidebar();
  // Restore the last page for this tab when possible.
  navigateTo(targetPage || getStoredPage() || 'dashboard');
}
// Return the global POS state object
function getState() {
  if (window.posState) return window.posState;
  window.posState = normalizeState(initState());
  return window.posState;
}

// Save the global POS state object to localStorage
function saveState(state) {
  try {
    window.posState = state;
    localStorage.setItem('pos_state', JSON.stringify({ ...state, currentUser: null }));
  } catch (e) {
    console.error('Failed to save state:', e);
  }
}

// bindOverviewClickFallback
function bindOverviewClickFallback() { }
// Show login page/modal when Access System button is clicked
function showLogin() {
  document.getElementById('overview-page').classList.add('hidden');
  document.getElementById('app-page').classList.add('hidden');
  document.getElementById('login-page').classList.remove('hidden');
  // Clear fields and reset password visibility to prevent browser autofill display
  const uEl = document.getElementById('login-username');
  const pEl = document.getElementById('login-password');
  if (uEl) { uEl.value = ''; }
  if (pEl) { pEl.value = ''; pEl.type = 'password'; }
  const eyeIcon = document.querySelector('#login-password-eye-icon');
  if (eyeIcon) eyeIcon.innerHTML = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>';
  document.getElementById('login-error')?.classList.remove('show');
  setTimeout(() => uEl && uEl.focus(), 50);
}

function normalizeState(state) {
  if (!state || typeof state !== 'object') return initState();

  state.branches = Array.isArray(state.branches) ? state.branches : [];
  state.users = Array.isArray(state.users) ? state.users : [];
  state.products = Array.isArray(state.products) ? state.products : [];
  // Do NOT force-load default catalog — products come from the server/admin only
  applyDefaultCatalogPricing(state.products);
  state.shifts = Array.isArray(state.shifts) ? state.shifts : [];
  state.cashMovements = Array.isArray(state.cashMovements) ? state.cashMovements : [];
  state.sales = Array.isArray(state.sales) ? state.sales : [];
  state.cart = Array.isArray(state.cart) ? state.cart : [];
  state.shiftSchedules = state.shiftSchedules && typeof state.shiftSchedules === 'object' ? state.shiftSchedules : {};

  state.customers = Array.isArray(state.customers) ? state.customers : [];
  state.suppliers = Array.isArray(state.suppliers) ? state.suppliers : [];
  state.receivings = Array.isArray(state.receivings) ? state.receivings : [];
  state.reorderLogs = Array.isArray(state.reorderLogs) ? state.reorderLogs : [];
  state.promos = Array.isArray(state.promos) ? state.promos : [];
  state.orders = Array.isArray(state.orders) ? state.orders : [];
  state.arPayments = Array.isArray(state.arPayments) ? state.arPayments : [];
  state.auditLogs = Array.isArray(state.auditLogs) ? state.auditLogs : [];
  state.branchTransfers = Array.isArray(state.branchTransfers) ? state.branchTransfers : [];
  state.branchInventoryRequests = Array.isArray(state.branchInventoryRequests) ? state.branchInventoryRequests : [];
  state.payrollSubmissions = Array.isArray(state.payrollSubmissions) ? state.payrollSubmissions : [];
  state.payrollRuns = Array.isArray(state.payrollRuns) ? state.payrollRuns : [];
  state.handoverNotes = Array.isArray(state.handoverNotes) ? state.handoverNotes : [];
  state.employees = Array.isArray(state.employees) ? state.employees : [];
  state.timecards = Array.isArray(state.timecards) ? state.timecards : [];
  state.attendanceRecords = Array.isArray(state.attendanceRecords) ? state.attendanceRecords : [];
  state.leaves = Array.isArray(state.leaves) ? state.leaves : [];
  state.payslips = Array.isArray(state.payslips) ? state.payslips : [];
  state.printProducts = Array.isArray(state.printProducts) ? state.printProducts : [];
  state.dashboardPrefs = state.dashboardPrefs && typeof state.dashboardPrefs === 'object' ? state.dashboardPrefs : {};
  state.posDraft = state.posDraft && typeof state.posDraft === 'object' ? state.posDraft : {};

  state.scheduleView = 'weekly'; // Always weekly
  if (!state.scheduleDate) state.scheduleDate = toLocalDateString(new Date());
  if (!state.scheduleWeekStart) state.scheduleWeekStart = toLocalDateString(getMonday(new Date()));

  if (!Array.isArray(state.dashboardPrefs.pinnedKpis) || !state.dashboardPrefs.pinnedKpis.length) {
    state.dashboardPrefs.pinnedKpis = ['revenue', 'sales', 'activeShifts', 'pendingOrders', 'inProduction', 'delayed', 'lowStock', 'balanceDue'];
  }

  state.products.forEach(product => {
    (product.variants || []).forEach(variant => {
      if (typeof variant.reorderLevel !== 'number') variant.reorderLevel = 20;
      if (typeof variant.reserved !== 'number') variant.reserved = 0;
      if (!variant.branchStocks || typeof variant.branchStocks !== 'object') {
        const branchIds = state.branches.map(b => b.id);
        const split = Math.floor((variant.stock || 0) / Math.max(1, branchIds.length));
        let remainder = (variant.stock || 0) - split * branchIds.length;
        variant.branchStocks = {};
        branchIds.forEach((id, idx) => {
          variant.branchStocks[id] = split + (remainder > 0 ? 1 : 0);
          if (remainder > 0) remainder--;
        });
      } else {
        state.branches.forEach(branch => {
          if (typeof variant.branchStocks[branch.id] !== 'number') variant.branchStocks[branch.id] = 0;
        });
      }
      variant.stock = Object.values(variant.branchStocks).reduce((sum, qty) => sum + (parseInt(qty) || 0), 0);
    });
  });

  return state;
}

function isLegacyDefaultCatalog(products) {
  const legacyNames = ['Packaging Tape', 'Stretch Film', 'Bubble Wrap', 'Kraft Paper', 'Carton Box', 'Foam Sheet'];
  if (!Array.isArray(products) || products.length !== legacyNames.length) return false;
  return legacyNames.every((name, idx) => products[idx]?.name === name);
}

function skuPart(value, max = 6) {
  return ((value || '').match(/[A-Za-z0-9]+/g) || []).join('').toUpperCase().slice(0, max);
}

function buildVariantSku(productName, variantName, index) {
  const p = skuPart(productName, 4) || 'ITEM';
  const v = skuPart(variantName, 6) || String(index);
  return `${p}-${v}-${index}`;
}

function getDefaultPosProducts() {
  const catalog = [
    // ── CUPS ──────────────────────────────────────────────────────────────
    {
      type: 'Cup', name: 'Ripple Wall Cup (25s)', desc: '25s pack', variants: [
        { name: 'Black 8oz', size: '8oz', price: 90 },
        { name: 'Black 12oz', size: '12oz', price: 150 },
        { name: 'Black 16oz', size: '16oz', price: 200 },
      ]
    },
    {
      type: 'Cup', name: 'Double Wall Cup (25s)', desc: '25s pack', variants: [
        { name: 'Kraft 8oz', size: '8oz', price: 80 },
        { name: 'Kraft 12oz', size: '12oz', price: 140 },
        { name: 'Kraft 16oz', size: '16oz', price: 190 },
        { name: 'Black 8oz', size: '8oz', price: 80 },
        { name: 'Black 12oz', size: '12oz', price: 140 },
        { name: 'Black 16oz', size: '16oz', price: 190 },
      ]
    },
    {
      type: 'Cup', name: 'Hard Cup (50s)', desc: '50s pack', variants: [
        { name: '16oz', size: '16oz', price: 140 },
        { name: '22oz', size: '22oz', price: 200 },
      ]
    },
    {
      type: 'Cup', name: 'Slim Cup (50s)', desc: '50s pack', variants: [
        { name: '16oz', size: '16oz', price: 110 },
        { name: '22oz', size: '22oz', price: 160 },
      ]
    },
    {
      type: 'Cup', name: 'PP Cup (50s)', desc: '50s pack', variants: [
        { name: 'T-Cup 12oz', size: '12oz', price: 70 },
        { name: 'T-Cup 16oz', size: '16oz', price: 90 },
        { name: 'T-Cup 22oz', size: '22oz', price: 110 },
        { name: 'U-Cup 12oz', size: '12oz', price: 90 },
        { name: 'U-Cup 16oz', size: '16oz', price: 130 },
        { name: 'U-Cup 22oz', size: '22oz', price: 170 },
      ]
    },
    {
      type: 'Cup', name: 'PET 98mm (50s)', desc: '50s pack', variants: [
        { name: '16oz', size: '16oz', price: 120 },
        { name: '20oz', size: '20oz', price: 180 },
      ]
    },
    {
      type: 'Cup', name: 'Dabba Cup (40s)', desc: '40s pack', variants: [
        { name: '12oz', size: '12oz', price: 85 },
        { name: '16oz', size: '16oz', price: 110 },
        { name: '20oz', size: '20oz', price: 140 },
        { name: '22oz', size: '22oz', price: 180 },
        { name: '24oz', size: '24oz', price: 220 },
      ]
    },
    {
      type: 'Cup', name: 'Starcups', desc: 'Per piece', variants: [
        { name: '3oz', size: '3oz', price: 0 },
        { name: '6oz', size: '6oz', price: 0 },
        { name: '8oz', size: '8oz', price: 0 },
        { name: '10oz', size: '10oz', price: 0 },
        { name: '12oz', size: '12oz', price: 0 },
        { name: '16oz', size: '16oz', price: 0 },
        { name: '20oz', size: '20oz', price: 0 },
        { name: '22oz', size: '22oz', price: 0 },
      ]
    },
    {
      type: 'Cup', name: 'Star Cup (100s)', desc: '100s pack', variants: [
        { name: '3oz', size: '3oz', price: 15 },
        { name: '4oz', size: '4oz', price: 18 },
        { name: '8oz', size: '8oz', price: 23 },
        { name: '10oz', size: '10oz', price: 26 },
        { name: '12oz', size: '12oz', price: 30 },
        { name: '16oz', size: '16oz', price: 38 },
        { name: '22oz', size: '22oz', price: 46 },
        { name: '24oz', size: '24oz', price: 54 },
      ]
    },
    {
      type: 'Cup', name: 'Paper Cup (100s)', desc: '100s pack', variants: [
        { name: '3oz', size: '3oz', price: 28 },
        { name: '6.5oz', size: '6.5oz', price: 33 },
        { name: '8oz', size: '8oz', price: 40 },
        { name: '12oz', size: '12oz', price: 62 },
        { name: '16oz', size: '16oz', price: 86 },
        { name: '20oz', size: '20oz', price: 102 },
      ]
    },
    {
      type: 'Cup', name: 'Printed Cups', desc: 'Per piece — printed/customized', variants: [
        { name: 'Dabba PET / 12oz', size: '12oz', price: 4.25 },
        { name: 'Dabba PET / 16oz', size: '16oz', price: 4.35 },
        { name: 'Dabba PET / 22oz', size: '22oz', price: 4.95 },
        { name: 'Y-Cup / 12oz', size: '12oz', price: 3.65 },
        { name: 'Y-Cup / 16oz', size: '16oz', price: 3.80 },
        { name: 'Y-Cup / 22oz', size: '22oz', price: 3.95 },
        { name: 'U-Cup / 12oz', size: '12oz', price: 3.80 },
        { name: 'U-Cup / 16oz', size: '16oz', price: 4.20 },
        { name: 'U-Cup / 22oz', size: '22oz', price: 4.60 },
        { name: 'Double Wall / 8oz', size: '8oz', price: 6.90 },
        { name: 'Double Wall / 12oz', size: '12oz', price: 7.90 },
        { name: 'Double Wall / 16oz', size: '16oz', price: 8.50 },
        { name: 'Hard Cup / 16oz', size: '16oz', price: 4.70 },
        { name: 'Hard Cup / 22oz', size: '22oz', price: 5.70 },
        { name: 'Slim Cup / 16oz', size: '16oz', price: 3.60 },
        { name: 'Slim Cup / 22oz', size: '22oz', price: 4.10 },
        { name: 'Paper Cup / 8oz', size: '8oz', price: 3.00 },
        { name: 'Paper Cup / 12oz', size: '12oz', price: 3.50 },
      ]
    },
    // ── BOWLS ─────────────────────────────────────────────────────────────
    {
      type: 'Bowl', name: 'Paper Bowl (50s)', desc: '50s pack', variants: [
        { name: '220cc', size: '220cc', price: 52 },
        { name: '260cc', size: '260cc', price: 62 },
        { name: '390cc', size: '390cc', price: 70 },
        { name: '520cc', size: '520cc', price: 85 },
        { name: '750cc', size: '750cc', price: 110 },
        { name: '780cc', size: '780cc', price: 120 },
        { name: '850cc', size: '850cc', price: 135 },
        { name: '1000cc', size: '1000cc', price: 160 },
      ]
    },
    {
      type: 'Bowl', name: 'Printed Paper Bowl', desc: 'Per piece — printed/customized', variants: [
        { name: '260CC', size: '260CC', price: 3.20 },
        { name: '390CC', size: '390CC', price: 3.70 },
        { name: '520CC', size: '520CC', price: 3.90 },
        { name: '750CC', size: '750CC', price: 4.30 },
        { name: '780CC', size: '780CC', price: 4.50 },
        { name: '850CC', size: '850CC', price: 4.80 },
        { name: '1000CC', size: '1000CC', price: 5.30 },
      ]
    },
    // ── BOXES ─────────────────────────────────────────────────────────────
    {
      type: 'Box', name: 'Paper Boxes (10s)', desc: '10s pack', variants: [
        { name: 'Spaghetti Box', size: null, price: 30 },
        { name: 'Meal Box (Small)', size: null, price: 35 },
        { name: 'Meal Box (Medium)', size: null, price: 40 },
        { name: 'High Meal Box', size: null, price: 45 },
        { name: 'Chicken Box', size: null, price: 50 },
        { name: 'High Meal Box 1300cc', size: null, price: 60 },
      ]
    },
    {
      type: 'Box', name: 'Printed Paper Boxes', desc: 'Per piece — printed/customized', variants: [
        { name: 'Spaghetti Box', size: null, price: 4.50 },
        { name: 'Meal Box', size: null, price: 5.75 },
        { name: 'Meal 2D Box', size: null, price: 7.00 },
        { name: 'High Meal Box', size: null, price: 6.75 },
        { name: 'Chicken Box', size: null, price: 7.00 },
        { name: 'High Meal 1500cc', size: '1500cc', price: 9.00 },
      ]
    },
    // ── SLEEVES ───────────────────────────────────────────────────────────
    {
      type: 'Sleeve', name: 'Coffee Sleeves (50 pcs)', desc: '50pcs per pack', variants: [
        { name: 'Kraft Plain', size: null, price: 95 },
        { name: 'White Plain', size: null, price: 165 },
        { name: 'Black Plain', size: null, price: 200 },
        { name: 'Printed Kraft', size: null, price: 145 },
        { name: 'Printed White', size: null, price: 215 },
        { name: 'Printed Black', size: null, price: 250 },
      ]
    },
    // ── PAPER ─────────────────────────────────────────────────────────────
    {
      type: 'Paper', name: 'Greaseproof Paper (100s)', desc: '100s pack', variants: [
        { name: 'Plain', size: null, price: 85 },
        { name: 'Generic', size: null, price: 110 },
      ]
    },
    {
      type: 'Paper', name: 'Customized Greaseproof Paper', desc: 'Custom-printed greaseproof paper by quantity', variants: [
        { name: 'Customized (1000s) / 9X12', size: '9X12', price: 2500 },
        { name: 'Customized (1000s) / 12X12', size: '12X12', price: 3000 },
        { name: 'Customized (1000s) / 12X18', size: '12X18', price: 4000 },
        { name: 'Customized (5000s) / 9X12', size: '9X12', price: 11250 },
        { name: 'Customized (5000s) / 12X12', size: '12X12', price: 13750 },
        { name: 'Customized (5000s) / 12X18', size: '12X18', price: 18750 },
        { name: 'Customized (10000s) / 9X12', size: '9X12', price: 19000 },
        { name: 'Customized (10000s) / 12X12', size: '12X12', price: 32000 },
        { name: 'Customized (10000s) / 12X18', size: '12X18', price: 35000 },
      ]
    },
    // ── BAGS ──────────────────────────────────────────────────────────────
    {
      type: 'Bag', name: 'Ice Bag', desc: 'Ice bags by size', variants: [
        { name: '1¼', size: '1¼', price: 0 },
        { name: '1½', size: '1½', price: 0 },
        { name: '1x10', size: '1x10', price: 0 },
        { name: '2x10', size: '2x10', price: 0 },
        { name: '4x10', size: '4x10', price: 20 },
      ]
    },
  ];

  let variantIndex = 1;
  return catalog.map((product, productIdx) => ({
    id: `p${productIdx + 1}`,
    name: product.name,
    type: product.type || '',
    desc: product.desc,
    active: true,
    variants: product.variants.map((variant) => {
      const sku = buildVariantSku(product.name, variant.name, variantIndex);
      const variantItem = {
        id: `v${variantIndex}`,
        name: variant.name,
        size: variant.size || '',
        sku,
        price: variant.price,
        stock: 0,
      };
      variantIndex++;
      return variantItem;
    }),
  }));
}

function buildDefaultCatalogPriceMap() {
  const priceMap = new Map();
  getDefaultPosProducts().forEach(product => {
    const productKey = normalizeSearchText(product.name);
    const variantMap = new Map();
    (product.variants || []).forEach(variant => {
      variantMap.set(normalizeSearchText(variant.name), Number(variant.price) || 0);
    });
    priceMap.set(productKey, variantMap);
  });
  return priceMap;
}

function applyDefaultCatalogPricing(products) {
  const priceMap = buildDefaultCatalogPriceMap();
  (products || []).forEach(product => {
    const variantMap = priceMap.get(normalizeSearchText(product.name));
    if (!variantMap) return;
    (product.variants || []).forEach(variant => {
      const defaultPrice = variantMap.get(normalizeSearchText(variant.name));
      if (typeof defaultPrice !== 'number' || defaultPrice <= 0) return;
      const currentPrice = Number(variant.price);
      if (!Number.isFinite(currentPrice) || currentPrice <= 0) {
        variant.price = defaultPrice;
      }
    });
  });
}

function normalizeSearchText(text) {
  return (text || '').toString().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function matchesSearchQuery(query, ...fields) {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return true;
  const haystack = fields.map(normalizeSearchText).join(' ');
  return normalizedQuery.split(' ').every(token => haystack.includes(token));
}

function initState() {
  // Try to load from localStorage first (populated by loadStateFromServer on boot)
  try {
    const saved = localStorage.getItem('pos_state');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && typeof parsed === 'object' && Array.isArray(parsed.users)) {
        return parsed;
      }
    }
  } catch (e) { /* fall through to defaults */ }

  const state = {
    branches: [
      { id: 'b1', name: 'Main Branch', address: 'San Pedro, Laguna', contact: '049-123-4567', active: true },
      { id: 'b2', name: 'BPS Branch', address: 'Biñan, Laguna', contact: '049-234-5678', active: true },
      { id: 'b3', name: 'TPS Branch', address: 'Calamba, Laguna', contact: '049-345-6789', active: true },
    ],
    users: [
      { id: 'u1', name: 'Administrator', username: 'admin', password: 'admin123', role: 'admin', branchId: null },
    ],
    products: [],
    shifts: [],
    cashMovements: [],
    sales: [],
    cart: [],
    shiftSchedules: {},
    customers: [
      { id: 'c1', companyName: 'ABC Retail Supplies', contactPerson: 'Carlo Mendoza', phone: '0917-111-2233', email: '', address: 'San Pedro, Laguna', outstandingBalance: 0, notes: '' },
      { id: 'c2', companyName: 'Northlane Manufacturing', contactPerson: 'Liza Cruz', phone: '0918-204-8891', email: '', address: 'Calamba, Laguna', outstandingBalance: 0, notes: '' },
    ],
    suppliers: [
      { id: 'sup1', name: 'Packwell Industrial Supply', contact: '02-8123-4455' },
      { id: 'sup2', name: 'Laguna Packaging Source', contact: '049-998-7000' },
    ],
    receivings: [],
    reorderLogs: [],
    promos: [],
    orders: [],
    arPayments: [],
    employees: [],
    auditLogs: [],
    branchTransfers: [],
    branchInventoryRequests: [],
    payrollSubmissions: [],
    payrollRuns: [],
    handoverNotes: [],
    dashboardPrefs: { pinnedKpis: ['revenue', 'sales', 'activeShifts', 'lowStock'] },
    posDraft: {
      customerId: '',
      discountType: 'none',
      discountValue: 0,
      discountReason: '',
      payMode: 'regular',
    },
    currentUser: null,
    scheduleView: 'weekly',
    scheduleDate: toLocalDateString(new Date()),
    scheduleWeekStart: toLocalDateString(getMonday(new Date())),
  };
  return state;
}

function getMonday(d) {
  const dd = new Date(d);
  const day = dd.getDay();
  const diff = dd.getDate() - day + (day === 0 ? -6 : 1);
  dd.setDate(diff);
  return dd;
}

// FIX 1: toLocalDateString was missing its implementation body
function toLocalDateString(date) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// AUTH
async function doLogin() {
  const s = getState();
  const u = document.getElementById('login-username').value.trim();
  const p = document.getElementById('login-password').value;
  const errEl = document.getElementById('login-error');
  const btnEl = document.querySelector('.login-right .btn-primary');

  if (!u || !p) {
    errEl.textContent = 'Please enter your username and password.';
    errEl.classList.add('show');
    return;
  }

  if (btnEl) { btnEl.disabled = true; btnEl.textContent = 'Logging in…'; }

  try {
    let user = null;
    try {
      user = await DB.login(u, p);
    } catch (serverErr) {
      // Server auth failed — fall back to local password check (offline mode)
      const localUser = s.users.find(x => x.username === u && x.password === p);
      if (localUser) user = localUser;
    }

    if (!user) {
      errEl.textContent = 'Invalid username or password. Please try again.';
      errEl.classList.add('show');
      return;
    }

    user = normalizeUserRole(user);
    if (!user.role || !VALID_USER_ROLES.includes(user.role)) {
      user = { ...user, role: user.username === 'admin' ? 'admin' : 'cashier' };
    }

    errEl.classList.remove('show');
    s.currentUser = user;
    persistSessionUser(user);
    saveState(s);
    recordAudit(s, { action: 'login', message: `User logged in: ${user.username}`, userId: user.id, branchId: user.branchId || null });
    showApp(getStoredPage() || 'dashboard');

  } finally {
    if (btnEl) { btnEl.disabled = false; btnEl.textContent = 'Log In →'; }
  }
}

function doLogout() {
  closeAccountMenu();
  confirmModal({
    title: 'Log Out',
    message: 'Are you sure you want to log out of your account?',
    confirmText: 'Log Out',
    cancelText: 'Stay',
    icon: '🔒',
    danger: false,
    onConfirm: function () {
      const s = getState();
      if (s.currentUser) recordAudit(s, { action: 'logout', message: `User logged out: ${s.currentUser.username}`, userId: s.currentUser.id, branchId: s.currentUser.branchId || null });
      s.currentUser = null;
      saveState(s);
      persistSessionUser(null);
      persistCurrentPage(null);
      persistExpandedGroups({});
      showLogin();
    }
  });
}

function toggleAccountMenu(event) {
  if (event) event.stopPropagation();
  const account = document.getElementById('topbar-account');
  if (!account) return;
  account.classList.toggle('open');
}

function closeAccountMenu() {
  const account = document.getElementById('topbar-account');
  if (!account) return;
  account.classList.remove('open');
}

function openCurrentUserProfile() {
  const s = getState();
  const u = s.currentUser;
  if (!u) return;

  const branch = (s.branches || []).find(b => b.id === u.branchId);
  const roleLabel = getRoleLabel(u.role);
  const initial = (u.name || u.username || '?')[0].toUpperCase();

  showModal(`
    <div class="modal-header">
      <h2>${iconSvg('users')} My Profile</h2>
      <button class="btn-close-modal" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-body">
      <div style="display:flex;align-items:center;gap:16px;background:linear-gradient(135deg,var(--maroon),#a0263e);border-radius:var(--radius);padding:18px 22px;margin-bottom:18px;color:white;">
        <div style="width:56px;height:56px;border-radius:50%;background:rgba(255,255,255,0.25);display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:700;flex-shrink:0;">${initial}</div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:18px;font-weight:700;line-height:1.2">${u.name || u.username}</div>
          <div style="font-size:13px;opacity:0.85;margin-top:3px">${roleLabel}${branch ? ' · ' + branch.name : ''}</div>
          <div style="font-size:12px;opacity:0.8;margin-top:2px">@${u.username}</div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:4px;">
        <div style="background:var(--cream);border-radius:var(--radius-sm);padding:10px 14px;">
          <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--ink-40);margin-bottom:4px">Role</div>
          <div style="font-size:14px;font-weight:600;color:var(--ink)">${roleLabel}</div>
        </div>
        <div style="background:var(--cream);border-radius:var(--radius-sm);padding:10px 14px;">
          <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--ink-40);margin-bottom:4px">Branch</div>
          <div style="font-size:14px;font-weight:600;color:var(--ink)">${branch ? branch.name : (u.branchId || 'All Branches')}</div>
        </div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeModal()">Close</button>
      <button class="btn btn-maroon" onclick="closeModal(); doLogout();">Log Out</button>
    </div>
  `);
}

// SIDEBAR
function getNavItems() {
  const s = getState();
  const u = s.currentUser;
  if (!u) return [];
  const role = normalizeRole(u.role);

  if (role === 'admin') return [
    { type: 'item', id: 'dashboard', icon: 'home', label: 'Dashboard', page: 'dashboard' },
    { type: 'item', id: 'branch-inv-ov', icon: 'chart', label: 'Branch Inventory Overview', page: 'branch-inv-overview' },
    { type: 'item', id: 'product-catalog', icon: 'box', label: 'Product Catalog', page: 'product-catalog' },
    { type: 'item', id: 'inventory', icon: 'box', label: 'Branch Inventory', page: 'inventory' },
    { type: 'item', id: 'orders', icon: 'clipboard', label: 'Project Management', page: 'orders' },
    {
      type: 'group', id: 'personnel', icon: 'users', label: 'Personnel Management', page: 'personnel-mgmt', children: [
        { id: 'employee-records', icon: 'users', label: 'Employee Records', page: 'employee-records' },
        { id: 'schedule', icon: 'calendar', label: 'Scheduling', page: 'shift-schedule' },
        { id: 'attendance', icon: 'clock', label: 'Attendance', page: 'attendance' },
        {
          type: 'subgroup', id: 'payroll-sub', icon: 'money', label: 'Payroll', children: [
            { id: 'leave-mgmt', icon: 'receipt', label: 'Leave Management', page: 'leave-management' },
            { id: 'payroll', icon: 'money', label: 'Payroll Consolidation', page: 'payroll' },
            { id: 'admin-payslip-gen', icon: 'money', label: 'Payslip Generation', page: 'admin-payslip-gen' },
          ]
        },
      ]
    },
    { type: 'item', id: 'reports', icon: 'chart', label: 'Reports', page: 'admin-reports' },
    {
      type: 'group', id: 'settings', icon: 'key', label: 'Settings', page: 'users', children: [
        { id: 'users', icon: 'key', label: 'User & Role Management', page: 'users' },
        { id: 'system-config', icon: 'home', label: 'System Info', page: 'system-config' },
      ]
    },
  ];

  if (role === 'hr') return [
    { type: 'item', id: 'dashboard', icon: 'home', label: 'Dashboard', page: 'dashboard' },
    {
      type: 'group', id: 'personnel', icon: 'users', label: 'Personnel Management', children: [
        { id: 'employee-records', icon: 'users', label: 'Employee Records', page: 'employee-records' },
        { id: 'schedule', icon: 'calendar', label: 'Schedule', page: 'shift-schedule' },
        { id: 'attendance', icon: 'clock', label: 'Attendance', page: 'attendance' },
        {
          type: 'subgroup', id: 'payroll-sub', icon: 'money', label: 'Payroll', children: [
            { id: 'leave-mgmt', icon: 'receipt', label: 'Leave Management', page: 'leave-management' },
            { id: 'admin-payslip-gen', icon: 'money', label: 'Payslip Generation', page: 'admin-payslip-gen' },
          ]
        },
      ]
    },
  ];

  if (role === 'branch_manager') return [
    { type: 'item', id: 'dashboard', icon: 'home', label: 'Dashboard', page: 'dashboard' },
    {
      type: 'group', id: 'personnel', icon: 'users', label: 'Personnel Management', children: [
        { id: 'employee-records', icon: 'users', label: 'Staff & Employee Records', page: 'employee-records' },
        { id: 'schedule', icon: 'calendar', label: 'Schedule', page: 'shift-schedule' },
        { id: 'attendance', icon: 'clock', label: 'Attendance', page: 'attendance' },
        {
          type: 'subgroup', id: 'payroll-sub', icon: 'money', label: 'Payroll', children: [
            { id: 'leave-mgmt', icon: 'receipt', label: 'Leave Management', page: 'leave-management' },
            { id: 'payroll', icon: 'money', label: 'Branch Payroll', page: 'payroll' },
          ]
        },
      ]
    },
    { type: 'item', id: 'reports', icon: 'chart', label: 'Reports', page: 'staff-reports' },
  ];

  if (role === 'cashier') return [
    { type: 'item', id: 'dashboard', icon: 'home', label: 'Dashboard', page: 'dashboard' },
    {
      type: 'group', id: 'pos-group', icon: 'cart', label: 'POS', page: 'pos', children: [
        { id: 'pos-receipts', icon: 'clipboard', label: 'Receipt History', page: 'pos-receipts' },
        { id: 'cash-movement', icon: 'money', label: 'Cash Movement', page: 'shift' },
      ]
    },
    { type: 'item', id: 'orders-group', icon: 'clipboard', label: 'Project Management', page: 'orders' },
  ];

  if (role === 'inventory_staff') return [
    { type: 'item', id: 'dashboard', icon: 'home', label: 'Dashboard', page: 'dashboard' },
    { type: 'item', id: 'inventory', icon: 'box', label: 'Branch Inventory', page: 'inventory' },
  ];

  if (role === 'print') return [
    { type: 'item', id: 'dashboard', icon: 'home', label: 'Dashboard', page: 'dashboard' },
    { type: 'item', id: 'print-order-details', icon: 'clipboard', label: 'Project Details', page: 'orders' },
    {
      type: 'group', id: 'production-group', icon: 'printer', label: 'Production', page: 'production', children: [
        { id: 'production', icon: 'box', label: 'Production Queue', page: 'production' },
        { id: 'job-management', icon: 'clipboard', label: 'Job Management', page: 'print-job-management' },
        { id: 'quality-control', icon: 'check', label: 'Quality Check', page: 'print-qc' },
        { id: 'print-materials', icon: 'box', label: 'Printing Materials Inventory', page: 'print-materials' },
      ]
    },
    {
      type: 'group', id: 'personnel', icon: 'users', label: 'Personnel', children: [
        { id: 'schedule', icon: 'calendar', label: 'Schedule', page: 'shift-schedule' },
        {
          type: 'subgroup', id: 'payroll-sub', icon: 'money', label: 'Payroll', children: [
            { id: 'leave-mgmt', icon: 'receipt', label: 'Leave Application', page: 'leave-management' },
            { id: 'payslip', icon: 'money', label: 'My Payslip', page: 'print-payslip' },
          ]
        },
      ]
    },
    { type: 'item', id: 'reports', icon: 'chart', label: 'Reports', page: 'print-reports' },
  ];

  return [];
}

function buildSidebar() {
  const s = getState();
  const u = s.currentUser;
  if (!u) return;
  const role = normalizeRole(u.role);
  document.getElementById('sb-avatar').textContent = (u.name || u.username || '?')[0].toUpperCase();
  document.getElementById('sb-name').textContent = u.name;
  document.getElementById('sb-role').textContent = getRoleLabel(role);
  const branch = s.branches.find(b => b.id === u.branchId);
  document.getElementById('topbar-branch').textContent = role === 'admin' ? 'All Branches' : role === 'branch_manager' ? ('Branch Manager · ' + (branch?.name || 'Unassigned')) : (branch?.name || 'Unassigned');
  const _now = new Date();
  const _dateEl = document.getElementById('topbar-date');
  if (_dateEl) _dateEl.textContent = _now.toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

  const nav = document.getElementById('sidebar-nav');
  nav.innerHTML = '';

  function appendNavItem(item, container) {
    if (item.type === 'section') {
      return; // clean sidebar — no section labels
    } else if (item.type === 'item') {
      const el = document.createElement('div');
      el.className = 'nav-item';
      el.dataset.page = item.page;
      el.dataset.id = item.id;
      el.innerHTML = `<span class="nav-icon">${iconSvg(item.icon)}</span>${item.label}`;
      el.onclick = () => navigateTo(item.page);
      container.appendChild(el);
    } else if (item.type === 'group') {
      const el = document.createElement('div');
      el.className = 'nav-item' + (expandedGroups[item.id] ? ' expanded' : '');
      el.dataset.group = item.id;
      el.innerHTML = `<span class="nav-icon">${iconSvg(item.icon)}</span>${item.label}<span class="nav-chevron">›</span>`;
      el.onclick = () => { toggleGroup(item.id, item.page); };
      container.appendChild(el);
      const sub = document.createElement('div');
      sub.className = 'nav-sub' + (expandedGroups[item.id] ? ' open' : '');
      sub.id = 'group-' + item.id;
      (item.children || []).forEach(ch => {
        if (ch.type === 'subgroup') {
          const sg = document.createElement('div');
          sg.className = 'nav-sub-item nav-subgroup-header' + (expandedGroups[ch.id] ? ' expanded' : '');
          sg.dataset.subgroup = ch.id;
          sg.innerHTML = `<span class="nav-icon">${iconSvg(ch.icon)}</span>${ch.label}<span class="nav-chevron">›</span>`;
          sg.onclick = (e) => {
            e.stopPropagation();
            expandedGroups[ch.id] = !expandedGroups[ch.id];
            persistExpandedGroups(expandedGroups);
            buildSidebar();
          };
          sub.appendChild(sg);
          const sgSub = document.createElement('div');
          sgSub.className = 'nav-sub nav-sub-nested' + (expandedGroups[ch.id] ? ' open' : '');
          (ch.children || []).forEach(ni => {
            const ci = document.createElement('div');
            ci.className = 'nav-sub-item nav-sub-nested-item';
            ci.dataset.page = ni.page;
            ci.innerHTML = `<span class="nav-icon">${iconSvg(ni.icon)}</span>${ni.label}`;
            ci.onclick = (e) => { e.stopPropagation(); navigateTo(ni.page); };
            sgSub.appendChild(ci);
          });
          sub.appendChild(sgSub);
        } else {
          const ci = document.createElement('div');
          ci.className = 'nav-sub-item';
          ci.dataset.page = ch.page;
          ci.innerHTML = `<span class="nav-icon">${iconSvg(ch.icon)}</span>${ch.label}`;
          ci.onclick = () => navigateTo(ch.page);
          sub.appendChild(ci);
        }
      });
      container.appendChild(sub);
    }
  }

  getNavItems().forEach(item => appendNavItem(item, nav));
  updateNavActive();
}


// ROLE-BASED ACCESS CONTROL
// Page-level permission map
// Roles: admin, branch_manager, hr, cashier, inventory_staff, print
var PAGE_PERMISSIONS = {
  'dashboard': ['admin', 'branch_manager', 'hr', 'cashier', 'inventory_staff', 'print'],
  'shift-schedule': ['admin', 'branch_manager', 'hr', 'cashier', 'inventory_staff', 'print'],
  'attendance': ['admin', 'branch_manager', 'hr', 'cashier', 'inventory_staff', 'print'],
  'leave-management': ['admin', 'branch_manager', 'hr', 'cashier', 'inventory_staff', 'print'],
  'payslip': ['admin', 'cashier', 'inventory_staff', 'print'],
  'timecards': ['admin', 'branch_manager', 'hr', 'cashier', 'inventory_staff', 'print'],
  'receipts': ['admin', 'branch_manager', 'hr', 'cashier', 'inventory_staff', 'print'],

  'shift': ['admin', 'cashier'],
  'pos': ['admin', 'cashier'],
  'pos-customers': ['admin', 'cashier'],
  'pos-receipts': ['admin', 'cashier'],
  'inventory': ['admin', 'inventory_staff'],
  'sales': ['admin', 'cashier'],
  'customers': ['admin', 'cashier'],
  'staff-reports': ['admin', 'branch_manager'],

  'orders': ['admin', 'cashier', 'print'],
  'pickup': ['admin', 'cashier', 'print'],
  'dispatch': ['admin', 'cashier', 'print'],
  'customer-records': ['admin', 'cashier', 'print'],
  'om-customer-records': ['admin', 'cashier', 'print'],
  'om-payment': ['admin', 'cashier'],

  'employee-records': ['admin', 'branch_manager', 'hr'],
  'personnel-mgmt': ['admin', 'branch_manager', 'hr'],
  'payroll': ['admin', 'branch_manager', 'hr', 'cashier', 'inventory_staff', 'print'],
  'admin-payslip-gen': ['admin', 'hr'],
  'print-payslip': ['admin', 'print'],

  'product-mgmt': ['admin'],
  'product-catalog': ['admin'],
  'categories': ['admin'],
  'branch-inv-overview': ['admin'],
  'pos-overview': ['admin'],
  'branch-reports': ['admin'],
  'receiving': ['admin'],
  'reconcile': ['admin'],
  'reports': ['admin', 'branch_manager', 'print'],
  'admin-reports': ['admin'],
  'sales-reports': ['admin'],
  'inventory-reports': ['admin'],
  'custom-reports': ['admin'],
  'audit': ['admin'],
  'transfers': ['admin'],
  'users': ['admin', 'branch_manager'],
  'system-config': ['admin'],
  'branches': ['admin'],

  'production': ['admin', 'print'],
  'logo-upload': ['admin', 'print'],
  'print-orders': ['admin', 'print'],
  'print-qc': ['admin', 'print'],
  'print-job-management': ['admin', 'print'],
  'print-personnel': ['print'],
  'print-materials': ['admin', 'print'],
  'print-reports': ['admin', 'print'],
};

function canAccess(page) {
  const s = getState();
  const u = s.currentUser;
  if (!u) return false;
  const role = normalizeRole(u.role);
  if (role === 'admin') return true;
  const allowed = PAGE_PERMISSIONS[page];
  if (!allowed) return false;
  return allowed.includes(role);
}

function accessDenied(label) {
  const s = getState();
  const u = s.currentUser;
  const roleName = getRoleLabel(u.role);
  document.getElementById('page-content').innerHTML =
    '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:320px;gap:16px;text-align:center">' +
    '<div style="font-size:48px">🔒</div>' +
    '<h2 style="margin:0;color:var(--ink)">Access Restricted</h2>' +
    '<p style="color:var(--ink-60);max-width:360px;margin:0">The <strong>' + (label || 'this page') + '</strong> module is not available for the <strong>' + roleName + '</strong> role.</p>' +
    '<p style="color:var(--ink-40);font-size:13px;margin:0">Contact your Administrator if you need access.</p>' +
    '</div>';
}

function toggleGroup(id, page) {
  expandedGroups[id] = !expandedGroups[id];
  persistExpandedGroups(expandedGroups);
  if (expandedGroups[id] && page) navigateTo(page);
  buildSidebar();
}

function updateNavActive() {
  document.querySelectorAll('.nav-item[data-page]').forEach(el => {
    el.classList.toggle('active', el.dataset.page === currentPage);
  });
  document.querySelectorAll('.nav-sub-item[data-page]').forEach(el => {
    el.classList.toggle('active', el.dataset.page === currentPage);
  });
}

// ROUTING
function navigateTo(page) {
  // Role-based access check
  if (!canAccess(page)) {
    currentPage = page;
    __navRenderId++;
    updateNavActive();
    const s = getState();
    const pageTitleMap = {
      'pos': 'Point of Sale', 'pos-customers': 'Customer Records', 'pos-receipts': 'Receipt History', 'customers': 'Customer Records', 'orders': 'Project Management',
      'production': 'Production Queue', 'pickup': 'Ready for Pickup', 'product-mgmt': 'Product Management',
      'inventory': 'Stock & Inventory', 'receiving': 'Supplier Receiving', 'personnel-mgmt': 'Personnel',
      'shift-schedule': 'Shift Schedule', 'payroll': 'Payroll Management', 'reconcile': 'Cash Reconciliation',
      'reports': 'Reports & Analytics', 'audit': 'Audit Log', 'transfers': 'Branch Transfers',
      'users': 'User Management', 'branches': 'Branch Management', 'sales': 'Sales History',
      'staff-reports': 'Branch Reports', 'print-orders': 'Job Queue', 'print-qc': 'Quality Check', 'print-personnel': 'My Profile', 'print-payslip': 'My Payslip',
      'print-materials': 'Materials Log', 'shift': 'Cash Movement', 'receipts': 'Receipts', 'dashboard': 'Dashboard',
      'payslip': 'My Payroll',
    };
    accessDenied(pageTitleMap[page] || page);
    return;
  }
  currentPage = page;
  persistCurrentPage(page);
  __navRenderId++;
  updateNavActive();
  const pageContent = document.getElementById('page-content');
  if (pageContent) {
    // Basic fade to mask innerHTML swaps (doesn't require CSS changes)
    if (!pageContent.dataset || pageContent.dataset.fadeInit !== '1') {
      pageContent.style.transition = 'opacity 140ms ease';
      if (pageContent.dataset) pageContent.dataset.fadeInit = '1';
    }
    pageContent.style.opacity = '0';
    requestAnimationFrame(() => { pageContent.style.opacity = '1'; });
  }
  const pages = {
    'dashboard': renderDashboard,
    'pos': renderPOS,
    'customers': renderCustomers,
    'pos-customers': renderPosCustomers,
    'pos-receipts': renderPosReceipts,
    'orders': renderOrders,
    'production': renderProductionOversight,
    'pickup': renderReadyForPickup,
    'shift': renderShift,
    'sales': renderSales,
    'product-mgmt': renderProductMgmt,
    'product-catalog': renderProductMgmt,       // alias → same render
    'categories': renderCategories,
    'inventory': renderInventory,
    'receiving': renderReceiving,
    'personnel-mgmt': renderPersonnelMgmt,
    'employee-records': renderEmployeeRecords,
    'shift-schedule': renderShiftSchedule,
    'timecards': renderTimecards,
    'attendance': renderAttendance,
    'leave-management': renderLeaveManagement,
    'payroll': renderPayroll,
    'payslip': renderPayslip,
    'reconcile': renderReconciliation,
    'reports': renderReports,
    'sales-reports': renderSalesReports,
    'inventory-reports': renderInventoryReports,
    'custom-reports': renderCustomReports,
    'audit': renderAudit,
    'transfers': renderTransfers,
    'users': renderUsers,
    'branches': renderBranches,
    'receipts': renderReceipts,
    'staff-reports': renderStaffReports,
    'print-orders': renderPrintOrders,
    'print-qc': renderQualityControl,
    'print-personnel': renderPrintPersonnel,
    'print-payslip': renderPrintPayslip,
    'print-materials': renderMaterialsTracking,
    'pos-overview': renderPosOverview,
    'branch-inv-overview': renderBranchInvOverview,
    'branch-reports': renderBranchReports,
    'system-config': renderSystemConfig,
    'logo-upload': renderLogoUpload,
    'dispatch': renderDispatch,
    'om-customer-records': renderOmCustomerRecords,
    'om-payment': renderOmPaymentPage,
    'customer-records': renderCustomerRecordsManagement,
    'admin-reports': renderAdminReports,
    'print-reports': renderPrintReports,
    'admin-payslip-gen': renderAdminPayslipGen,
    'print-job-management': renderPrintJobManagement,
  };
  const pageTitles = {
    'dashboard': 'Dashboard',
    'pos': 'Point of Sale',
    'pos-customers': 'Customer Records',
    'pos-receipts': 'Receipt History',
    'customers': 'Customers',
    'orders': 'Project Management',
    'production': 'Production Queue',
    'pickup': 'Ready for Pickup',
    'dispatch': 'Daily Dispatch',
    'logo-upload': 'Logo Upload',
    'shift': 'Cash Movement',
    'sales': 'Sales History',
    'product-mgmt': 'Product Management',
    'product-catalog': 'Product Catalog',
    'categories': 'Categories',
    'inventory': 'Branch Inventory',
    'branch-inv-overview': 'Branch Inventory Overview',
    'pos-overview': 'POS Overview',
    'branch-reports': 'Branch Reports',
    'receiving': 'Supplier Receiving',
    'personnel-mgmt': 'Personnel Management',
    'employee-records': 'Employee Records',
    'shift-schedule': 'Schedule',
    'timecards': 'Time Cards',
    'attendance': 'Attendance',
    'leave-management': 'Leave Management',
    'payroll': 'Payroll',
    'payslip': 'Payslips',
    'reconcile': 'Cash Reconciliation',
    'reports': 'Reports & Analytics',
    'sales-reports': 'Sales Reports',
    'inventory-reports': 'Inventory Reports',
    'custom-reports': 'Custom Report',
    'audit': 'Audit Log',
    'transfers': 'Branch Transfers',
    'users': 'User & Role Management',
    'system-config': 'System Info',
    'branches': 'Branch Management',
    'receipts': 'Receipts',
    'staff-reports': 'Branch Reports',
    'print-orders': 'Production Queue',
    'print-qc': 'Quality Check',
    'print-job-management': 'Job Management',
    'print-materials': 'Printing Inventory',
    'print-personnel': 'My Profile',
    'print-payslip': 'My Payslip',
    'print-reports': 'Reports',
    'om-customer-records': 'Customer Records',
    'om-payment': 'Payment',
    'customer-records': 'Customer Records',
    'admin-reports': 'Reports',
    'admin-payslip-gen': 'Payslip Generation',
  };
  document.getElementById('topbar-page').textContent = pageTitles[page] || page;
  document.getElementById('topbar-sub').textContent = '';
  const fn = pages[page];
  if (typeof fn === 'function') {
    // Fallback: If dashboard, check if function is empty
    if (page === 'dashboard') {
      const fnStr = fn.toString().replace(/\s+/g, '');
      if (fnStr === 'functionrenderDashboard(){}') {
        document.getElementById('page-content').innerHTML = '<h2>Dashboard</h2><p>Welcome to the dashboard!</p>';
        return;
      }
    }
    fn();
  } else {
    // Render placeholder content for each module
    const content = document.getElementById('page-content');
    switch (page) {
      case 'dashboard':
        content.innerHTML = '<h2>Dashboard</h2><p>Welcome to the dashboard!</p>';
        break;
      case 'pos':
        content.innerHTML = '<h2>Point of Sale</h2><p>POS module goes here.</p>';
        break;
      case 'sales':
        content.innerHTML = '<h2>Sales History</h2><p>Sales history module goes here.</p>';
        break;
      case 'shift':
        content.innerHTML = '<h2>My Shift</h2><p>Shift management module goes here.</p>';
        break;
      case 'receipts':
      case 'pos-receipts':
        content.innerHTML = '<h2>Receipts</h2><p>Receipts module goes here.</p>';
        break;
      case 'reconcile':
        content.innerHTML = '<h2>Cash Reconciliation</h2><p>Reconciliation module goes here.</p>';
        break;
      case 'reports':
        content.innerHTML = '<h2>Reports</h2><p>Reports module goes here.</p>';
        break;
      case 'audit':
        content.innerHTML = '<h2>Audit Log</h2><p>Audit log module goes here.</p>';
        break;
      case 'transfers':
        content.innerHTML = '<h2>Branch Transfers</h2><p>Branch transfers module goes here.</p>';
        break;
      case 'users':
        content.innerHTML = '<h2>User Management</h2><p>User management module goes here.</p>';
        break;
      case 'branches':
        content.innerHTML = '<h2>Branch Management</h2><p>Branch management module goes here.</p>';
        break;
      default:
        content.innerHTML = '<h2>Page not found</h2>';
    }
  }
  // For async pages, SVGs are applied inside setPageHtml()
  applySvgToElement(document.getElementById('page-content'));
}

// OVERVIEW BRANCHES
function renderOverviewBranches() {
  const s = getState();
  const el = document.getElementById('ov-branches-list');
  if (!el) return;
  el.innerHTML = s.branches.map((b, i) => `
    <div class="ov-branch-card">
      <div class="ov-branch-badge">Branch ${i + 1}</div>
      <div class="ov-branch-name">${b.name}</div>
      <div class="ov-branch-addr">${iconSvg('pin')} ${b.address}<br>${iconSvg('phoneCall')} ${b.contact}</div>
      <div class="ov-branch-status">${b.active ? 'Active & Operational' : 'Inactive'}</div>
    </div>
  `).join('');
}

// DASHBOARD
function renderDashboard() {
  const s = getState();
  const u = s.currentUser;
  if (!u) {
    document.getElementById('page-content').innerHTML = '<div class="page-header"><h1 class="page-title">Welcome</h1><p class="page-subtitle">Please log in to view the dashboard.</p></div>';
    return;
  }
  const today = new Date().toDateString();
  const todaySales = s.sales.filter(x => !x.voided && new Date(x.createdAt).toDateString() === today);
  const todayRevenue = todaySales.reduce((a, b) => a + b.total, 0);
  const activeShifts = s.shifts.filter(x => x.status === 'open');
  const totalProducts = s.products.filter(p => p.active).length;
  const lowStockItems = s.products.flatMap(p => (p.variants || []).filter(v => v.stock <= (v.reorderLevel ?? 20)).map(v => ({ productName: p.name, variantName: v.name, stock: v.stock, reorderLevel: v.reorderLevel ?? 20 })));
  const pinnedKpis = s.dashboardPrefs?.pinnedKpis || ['revenue', 'sales', 'activeShifts', 'lowStock'];

  if (u.role === 'print') {
    renderPrintProductionDashboard();
    return;
  }

  if (['cashier', 'branch_manager', 'inventory_staff'].includes(normalizeRole(u.role))) {
    const myShift = s.shifts.find(x => x.userId === u.id && x.status === 'open');
    const mySales = s.sales.filter(x => !x.voided && x.userId === u.id && new Date(x.createdAt).toDateString() === today);
    const myRevenue = mySales.reduce((a, b) => a + b.total, 0);
    const orders = getOrders();
    const cfg = getSystemConfig();
    const branchOrders = orders.filter(o => o.status !== 'cancelled');
    const balanceDue = branchOrders.filter(o => (o.balance || 0) > 0).reduce((a, b) => a + (b.balance || 0), 0);
    const readyForPickup = orders.filter(o => omIsDispatchReady(o)).length;
    const now = new Date();
    const leadTimeWatch = orders.filter(o => o.due_date && o.status !== 'completed' && o.status !== 'cancelled').map(o => {
      const daysLeft = Math.ceil((new Date(o.due_date) - now) / 86400000);
      return { ...o, daysLeft };
    }).filter(o => o.daysLeft <= 3).sort((a, b) => a.daysLeft - b.daysLeft).slice(0, 5);
    document.getElementById('page-content').innerHTML = `
      <div class="page-header"><h1 class="page-title">Good ${getGreeting()}, ${u.name.split(' ')[0]}!</h1><p class="page-subtitle">${today}</p></div>
      ${myShift ? `<div class="alert alert-success">${iconSvg('check')} Shift is open — Started ${fmtTime(myShift.openedAt)} · Opening Cash: ₱${fmt(myShift.openingCash)}</div>` : (normalizeRole(u.role) === 'branch_manager' ? '' : `<div class="alert alert-warning">${iconSvg('warning')} No active shift. Open a shift before using the POS. <button class="btn btn-sm btn-gold" style="margin-left:12px" onclick="navigateTo('shift')">Open Shift</button></div>`)}
      <div class="kpi-grid">
        <div class="kpi-card"><div class="kpi-header"><div class="kpi-label">My Sales Today</div><div class="kpi-icon green">${iconSvg('cart')}</div></div><div class="kpi-value">${mySales.length}</div></div>
        <div class="kpi-card"><div class="kpi-header"><div class="kpi-label">My Revenue Today</div><div class="kpi-icon gold">${iconSvg('money')}</div></div><div class="kpi-value">₱${fmt(myRevenue)}</div></div>
        <div class="kpi-card" style="cursor:pointer" onclick="navigateTo('pickup')"><div class="kpi-header"><div class="kpi-label">Ready for Pickup</div><div class="kpi-icon blue">${iconSvg('truck')}</div></div><div class="kpi-value">${readyForPickup}</div></div>
        <div class="kpi-card"><div class="kpi-header"><div class="kpi-label">Balance Due (Branch)</div><div class="kpi-icon maroon">${iconSvg('receipt')}</div></div><div class="kpi-value" style="color:var(--danger)">₱${fmt(balanceDue)}</div></div>
        <div class="kpi-card"><div class="kpi-header"><div class="kpi-label">Shift Status</div><div class="kpi-icon maroon">${iconSvg('clock')}</div></div><div class="kpi-value" style="font-size:18px">${myShift ? `<span style="color:var(--success)">${iconSvg('statusOpen')} Open</span>` : `<span style="color:var(--danger)">${iconSvg('statusClosed')} Closed</span>`}</div></div>
      </div>
      ${leadTimeWatch.length ? `<div class="data-card">
        <div class="data-card-header"><span class="data-card-title" style="color:var(--warning)">${iconSvg('warning')} Lead Time Watch — Due Soon</span><button class="btn btn-sm btn-outline" onclick="navigateTo('orders')">View All →</button></div>
        <div class="data-card-body no-pad">
          <table class="data-table">
            <thead><tr><th>Order #</th><th>Customer</th><th>Product</th><th>Due</th><th>Days Left</th><th>Status</th></tr></thead>
            <tbody>${leadTimeWatch.map(o => `<tr ${o.daysLeft < 0 ? 'style="background:var(--danger-l)"' : o.daysLeft <= 1 ? 'style="background:var(--warning-l)"' : ''}>
              <td class="td-mono">${String(o.id).padStart(6, '0')}</td>
              <td>${o.customer_name || '—'}</td>
              <td>${o.product_type || o.product_category || '—'}</td>
              <td class="td-mono">${o.due_date}</td>
              <td style="font-weight:700;color:${o.daysLeft < 0 ? 'var(--danger)' : o.daysLeft <= 1 ? 'var(--warning)' : 'var(--success)'}">${o.daysLeft < 0 ? `${Math.abs(o.daysLeft)}d OVERDUE` : o.daysLeft === 0 ? 'DUE TODAY' : `${o.daysLeft} days`}</td>
              <td>${statusBadge(o.status)}</td>
            </tr>`).join('')}</tbody>
          </table>
        </div>
      </div>` : ''}`;
    return;
  }

  // Admin
  const branchRevs = s.branches.map(b => {
    const bSales = todaySales.filter(x => x.branchId === b.id);
    const bShift = activeShifts.filter(x => x.branchId === b.id);
    const bStaff = s.users.filter(x => x.branchId === b.id && ['cashier', 'branch_manager', 'inventory_staff'].includes(normalizeRole(x.role)));
    return { ...b, sales: bSales.length, revenue: bSales.reduce((a, c) => a + c.total, 0), shifts: bShift.length, staff: bStaff.length };
  });

  const orders = getOrders();
  const pendingOrders = orders.filter(o => o.status === 'pending').length;
  const approvedOrders = orders.filter(o => o.status === 'approved').length;
  const inProdOrders = orders.filter(o => o.status === 'production').length;
  const delayedOrders = orders.filter(o => o.due_date && new Date(o.due_date) < new Date() && o.status !== 'completed' && o.status !== 'cancelled').length;
  const balanceDueTotal = orders.filter(o => (o.balance || 0) > 0 && o.status !== 'cancelled').reduce((a, b) => a + (b.balance || 0), 0);
  const discountTotal = s.sales.filter(x => !x.voided && x.discountAmount > 0).reduce((a, b) => a + b.discountAmount, 0);

  const kpiDefs = {
    revenue: `<div class="kpi-card"><div class="kpi-header"><div class="kpi-label">Total Revenue Today</div><div class="kpi-icon gold">${iconSvg('money')}</div></div><div class="kpi-value">₱${fmt(todayRevenue)}</div></div>`,
    sales: `<div class="kpi-card"><div class="kpi-header"><div class="kpi-label">Total Sales Today</div><div class="kpi-icon green">${iconSvg('cart')}</div></div><div class="kpi-value">${todaySales.length}</div></div>`,
    activeShifts: `<div class="kpi-card"><div class="kpi-header"><div class="kpi-label">Active Shifts</div><div class="kpi-icon maroon">${iconSvg('clock')}</div></div><div class="kpi-value">${activeShifts.length}</div></div>`,
    products: `<div class="kpi-card"><div class="kpi-header"><div class="kpi-label">Active Products</div><div class="kpi-icon blue">${iconSvg('box')}</div></div><div class="kpi-value">${totalProducts}</div></div>`,
    lowStock: `<div class="kpi-card"><div class="kpi-header"><div class="kpi-label">Low Stock Alerts</div><div class="kpi-icon maroon">${iconSvg('warning')}</div></div><div class="kpi-value">${lowStockItems.length}</div></div>`,
    pendingOrders: `<div class="kpi-card" style="cursor:pointer" onclick="navigateTo('orders')"><div class="kpi-header"><div class="kpi-label">Pending Approval</div><div class="kpi-icon gold">${iconSvg('clock')}</div></div><div class="kpi-value" style="color:${pendingOrders > 0 ? 'var(--warning)' : 'inherit'}">${pendingOrders}</div></div>`,
    approvedOrders: `<div class="kpi-card" style="cursor:pointer" onclick="navigateTo('orders')"><div class="kpi-header"><div class="kpi-label">Approved (Ready)</div><div class="kpi-icon green">${iconSvg('check')}</div></div><div class="kpi-value" style="color:#0d9488">${approvedOrders}</div></div>`,
    inProduction: `<div class="kpi-card" style="cursor:pointer" onclick="navigateTo('production')"><div class="kpi-header"><div class="kpi-label">In Production</div><div class="kpi-icon maroon">${iconSvg('printer')}</div></div><div class="kpi-value">${inProdOrders}</div></div>`,
    delayed: `<div class="kpi-card" style="cursor:pointer" onclick="navigateTo('production')"><div class="kpi-header"><div class="kpi-label">Delayed Orders</div><div class="kpi-icon maroon">${iconSvg('warning')}</div></div><div class="kpi-value" style="color:${delayedOrders > 0 ? 'var(--danger)' : 'inherit'}">${delayedOrders}</div></div>`,
    balanceDue: `<div class="kpi-card"><div class="kpi-header"><div class="kpi-label">Total Balance Due</div><div class="kpi-icon maroon">${iconSvg('receipt')}</div></div><div class="kpi-value" style="color:var(--danger)">₱${fmt(balanceDueTotal)}</div></div>`,
    discounts: `<div class="kpi-card"><div class="kpi-header"><div class="kpi-label">Discounts Given</div><div class="kpi-icon gold">${iconSvg('money')}</div></div><div class="kpi-value" style="color:var(--warning)">₱${fmt(discountTotal)}</div></div>`,
  };

  const renderedKpis = pinnedKpis.filter(key => kpiDefs[key]).map(key => kpiDefs[key]).join('');

  document.getElementById('page-content').innerHTML = `
    <div class="page-header" style="display:flex;justify-content:space-between;align-items:flex-start">
      <div><h1 class="page-title">Admin Dashboard</h1><p class="page-subtitle">Multi-branch overview — ${today}</p></div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-sm btn-outline" onclick="showSystemConfigModal()">${iconSvg('key')} System Config</button>
        <button class="btn btn-sm btn-outline" onclick="dashboardPrefsModal()">${iconSvg('calculator')} Dashboard KPIs</button>
      </div>
    </div>
    <div class="kpi-grid">
      ${renderedKpis || `${kpiDefs.revenue}${kpiDefs.sales}${kpiDefs.activeShifts}${kpiDefs.lowStock}`}
    </div>
    ${lowStockItems.length ? `<div class="alert alert-error-box">${iconSvg('warning')} ${lowStockItems.length} variant(s) reached reorder level. <button class="btn btn-sm btn-outline" style="margin-left:10px" onclick="navigateTo('branch-inv-overview')">Open Inventory</button></div>` : ''}
    ${delayedOrders > 0 ? `<div class="alert alert-error-box">${iconSvg('warning')} ${delayedOrders} order(s) are past due date! <button class="btn btn-sm btn-danger" style="margin-left:10px" onclick="navigateTo('production')">View Production</button></div>` : ''}
    ${renderAdminProductionQueue()}
    <div class="branch-overview-grid">
      ${branchRevs.map((b, i) => `
        <div class="branch-ov-card b${i + 1}">
          <div class="branch-ov-name">${iconSvg('store')} ${b.name}</div>
          <div class="branch-ov-row"><span>Revenue Today</span><strong>₱${fmt(b.revenue)}</strong></div>
          <div class="branch-ov-row"><span>Sales Today</span><strong>${b.sales} txns</strong></div>
          <div class="branch-ov-row"><span>Active Shifts</span><strong>${b.shifts}</strong></div>
          <div class="branch-ov-row"><span>Staff Count</span><strong>${b.staff}</strong></div>
        </div>
      `).join('')}
    </div>
    <div class="data-card">
      <div class="data-card-header"><span class="data-card-title">Restock Recommendations (Daily)</span><button class="btn btn-sm btn-outline" onclick="navigateTo('receiving')">Log Receiving →</button></div>
      <div class="data-card-body no-pad">
        <table class="data-table">
          <thead><tr><th>Item</th><th>Current Stock</th><th>Reorder Level</th><th>Recommended Qty</th></tr></thead>
          <tbody>
            ${lowStockItems.length ? lowStockItems.slice(0, 12).map(item => `<tr><td>${item.productName} (${item.variantName})</td><td style="font-weight:700;color:var(--danger)">${item.stock}</td><td>${item.reorderLevel}</td><td>${Math.max(0, item.reorderLevel * 2 - item.stock)}</td></tr>`).join('') : '<tr><td colspan="4" style="text-align:center;padding:20px;color:var(--ink-60)">No restock recommendations today.</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
    <div class="data-card">
      <div class="data-card-header"><span class="data-card-title">Recent Sales — All Branches</span><button class="btn btn-sm btn-outline" onclick="navigateTo('admin-reports')">View Reports →</button></div>
      <div class="data-card-body no-pad">
        <table class="data-table">
          <thead><tr><th>Receipt #</th><th>Branch</th><th>Staff</th><th>Items</th><th>Total</th><th>Payment</th><th>Time</th><th>Status</th></tr></thead>
          <tbody>${renderSalesRows(todaySales, s)}</tbody>
        </table>
      </div>
    </div>`;
}

function renderSalesRows(sales, s) {
  if (!sales.length) return `<tr><td colspan="8" style="text-align:center;padding:28px;color:var(--ink-60)">No sales recorded yet.</td></tr>`;
  return [...sales].reverse().slice(0, 15).map(sale => {
    const branch = s.branches.find(b => b.id === sale.branchId);
    const staff = s.users.find(u => u.id === sale.userId);
    const payLabel = sale.payments.map(p => `${p.method === 'cash' ? iconSvg('cash') : iconSvg('phone')} ₱${fmt(p.amount)}`).join(' + ');
    return `<tr>
      <td class="td-mono">${sale.id.slice(-6).toUpperCase()}</td>
      <td>${branch?.name || '-'}</td>
      <td>${staff?.name || '-'}</td>
      <td>${sale.items.length}</td>
      <td class="td-mono" style="font-weight:700;color:var(--maroon)">₱${fmt(sale.total)}</td>
      <td style="font-size:12px">${payLabel}</td>
      <td class="td-mono">${fmtTime(sale.createdAt)}</td>
      <td>${sale.voided ? '<span class="badge badge-danger">Voided</span>' : '<span class="badge badge-success">Complete</span>'}</td>
    </tr>`;
  }).join('');
}

// POS
function renderPOS() {
  const s = getState();
  const u = s.currentUser;
  const myShift = u.role !== 'admin' ? s.shifts.find(x => x.userId === u.id && x.status === 'open') : true;
  if ((['cashier', 'branch_manager', 'inventory_staff'].includes(normalizeRole(u.role))) && !myShift) {
    document.getElementById('page-content').innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:400px;gap:16px">
        <div style="font-size:48px">${iconSvg('lock')}</div>
        <h2 style="font-family:var(--font-head);font-size:22px;color:var(--ink)">Shift Required</h2>
        <p style="color:var(--ink-60);font-size:14px">You must open a shift before accessing the POS.</p>
        <button class="btn btn-maroon" onclick="navigateTo('shift')">Open Shift</button>
      </div>`;
    return;
  }
  const products = s.products.filter(p => p.active);
  const cart = s.cart || [];
  const draft = s.posDraft || {};
  const branchId = getActiveBranchId(s, u);
  const subtotal = cartSubtotal(cart);
  const discountInfo = computeDiscount(subtotal, cart, draft, s, branchId);
  const payable = Math.max(0, subtotal - discountInfo.amount);

  document.getElementById('page-content').innerHTML = `
    <div class="pos-layout">
      <div class="pos-products-panel">
        <div class="pos-products-header">
          <div class="pos-search" style="position:relative;flex:1">
            ${iconSvg('search')}
            <input id="pos-search-input" placeholder="Search products or variants..." oninput="filterPosProducts(this.value)" autocomplete="off" onkeydown="posSearchKeyDown(event)">
            <div class="pos-search-dropdown" id="pos-search-dropdown" style="display:none"></div>
          </div>
          <button class="btn btn-sm btn-outline" onclick="filterPosProducts('')" style="white-space:nowrap">Show All</button>
          <span class="badge badge-neutral">${products.length} products</span>
        </div>
        <div class="pos-category-grid" id="pos-grid">${renderPosCategoryGrid(products)}</div>
      </div>
      <div class="pos-cart-panel">
        <div class="pos-cart-header">
          <span class="pos-cart-title">Cart</span>
          <span class="cart-count" id="cart-badge">${cart.length}</span>
          <button class="btn btn-sm btn-outline" title="Add / Search Customer" onclick="showCustomerModal()" style="margin-left:8px;display:flex;align-items:center;gap:4px;white-space:nowrap">
            ${iconSvg('users')} Customer
          </button>
          ${cart.length ? `<button class="btn btn-sm btn-outline" style="margin-left:8px" onclick="clearCart()">Clear</button>` : ''}
        </div>

        <div class="pos-cart-controls">
          <div id="pos-selected-customer" class="pos-customer-strip${draft.customerId ? '' : ' hidden'}">
            <div class="pos-customer-strip-name">
              ${iconSvg('users')}
              <span id="pos-selected-customer-name">${draft.customerId ? (s.customers.find(c => c.id === draft.customerId)?.companyName || '') : ''}</span>
            </div>
            <button class="btn-icon" onclick="posRemoveCustomer()" title="Remove customer">✕</button>
          </div>

        </div>
        <div class="pos-cart-items" id="cart-items-list">${renderCartItems(cart)}</div>
        <div class="pos-cart-footer">
          <div class="cart-subtotal"><span>Subtotal</span><span class="amount" id="cart-subtotal">₱${fmt(subtotal)}</span></div>
          <div class="cart-subtotal"><span>Total</span><span class="amount" id="cart-total">₱${fmt(payable)}</span></div>
          <div class="payment-row"><span class="payment-label">${iconSvg('cash')} Cash</span><input type="number" id="pay-cash" class="payment-input" placeholder="0.00" min="0" oninput="updateChange()"></div>
          <div id="gcash-pay-section" style="display:none">
            <div class="payment-row" style="align-items:center;gap:6px">
              <span class="payment-label">${iconSvg('phone')} GCash</span>
              <input type="number" id="pay-gcash" class="payment-input" placeholder="0.00" min="0" readonly style="background:var(--cream);cursor:default">
              <button class="btn btn-sm btn-outline" style="white-space:nowrap" onclick="showGCashQRModal(window._gcashBalance||0)">QR</button>
              <button onclick="cancelGCashPay()" title="Remove GCash" style="flex-shrink:0;width:28px;height:28px;border-radius:50%;border:none;background:var(--danger);color:#fff;font-size:14px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;opacity:0.85;transition:opacity .15s" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0.85">✕</button>
            </div>
            <div class="payment-row" style="margin-top:6px">
              <span class="payment-label" style="font-size:12px">Ref #</span>
              <input type="text" id="pay-gcash-ref" class="payment-input" placeholder="GCash Reference # (required)" style="font-family:var(--font-mono);font-size:13px">
            </div>
          </div>
          <div id="gcash-trigger-row" style="display:none;margin-top:6px">
            <button class="btn btn-outline" style="width:100%;border:1.5px dashed var(--maroon);color:var(--maroon);font-weight:600" onclick="activateGCashPay()">
              ${iconSvg('phone')} Pay remaining balance with GCash
            </button>
          </div>
          <div id="change-row" style="display:none;background:var(--success-l);border-radius:var(--radius-sm);padding:10px 12px;font-size:13.5px;font-weight:600;color:var(--success);margin-top:8px">
            ${iconSvg('cash')} Change: <span id="change-amount">₱0.00</span>
          </div>
          <button class="btn-checkout" onclick="doCheckout()" id="checkout-btn" ${cart.length === 0 ? 'disabled' : ''}>
            Checkout — ₱${fmt(payable)}
          </button>
        </div>
      </div>
    </div>`;
}

// POS Product Grid (category boxes)
var _posSelectedProduct = null;
var _posHighlightIdx = -1;

function renderPosCategoryGrid(products) {
  if (!products || !products.length) return '<div style="padding:40px;text-align:center;color:var(--ink-60)">No active products.</div>';
  return products.map(function (p) {
    var variants = p.variants || [];
    var available = variants.filter(function (v) { return (v.stock - (v.reserved || 0)) > 0; });
    var totalStock = variants.reduce(function (sum, v) { return sum + Math.max(0, v.stock - (v.reserved || 0)); }, 0);
    var prices = variants.map(function (v) { return v.price; }).filter(Boolean);
    var minPrice = prices.length ? Math.min.apply(null, prices) : 0;
    var maxPrice = prices.length ? Math.max.apply(null, prices) : 0;
    var isLow = totalStock > 0 && totalStock <= 20;
    var isOos = totalStock === 0;
    var stockClass = isOos ? ' oos' : isLow ? ' low' : '';
    var stockLabel = isOos ? '⚠ Out of Stock' : isLow ? '⚠ Low: ' + totalStock : totalStock + ' units';
    var priceLabel = minPrice === maxPrice ? '₱' + fmt(minPrice) : '₱' + fmt(minPrice) + ' – ₱' + fmt(maxPrice);
    var pills = available.slice(0, 4).map(function (v) { return '<span class="pos-cat-pill">' + v.name + '</span>'; }).join('');
    if (available.length > 4) pills += '<span class="pos-cat-pill pos-cat-pill-more">+' + (available.length - 4) + ' more</span>';
    return '<div class="pos-category-card' + (isOos ? ' pos-category-oos' : '') + '" data-pid="' + p.id + '" onclick="posSelectCategory(this.dataset.pid)">' +
      '<div class="pos-cat-top">' +
      '<div class="pos-cat-name">' + p.name + '</div>' +
      '<div class="pos-cat-stock' + stockClass + '">' + stockLabel + '</div>' +
      '</div>' +
      (p.desc ? '<div class="pos-cat-desc">' + p.desc + '</div>' : '') +
      '<div class="pos-cat-bottom">' +
      '<div class="pos-cat-variants">' + variants.length + ' variant' + (variants.length !== 1 ? 's' : '') + '</div>' +
      '<div class="pos-cat-price">' + priceLabel + '</div>' +
      '</div>' +
      '<div class="pos-cat-variant-pills">' + pills + '</div>' +
      '</div>';
  }).join('');
}

function posSelectCategory(productId) {
  var s = getState();
  var p = s.products.find(function (x) { return x.id === productId; });
  if (!p) return;
  _posSelectedProduct = productId;
  var input = document.getElementById('pos-search-input');
  if (input) { input.value = p.name; input.focus(); }
  showPosVariantDropdown(p, '');
}

function filterPosProducts(query) {
  var s = getState();
  var products = s.products.filter(function (p) { return p.active; });
  var q = (query || '').trim().toLowerCase();
  var dropdown = document.getElementById('pos-search-dropdown');
  var grid = document.getElementById('pos-grid');
  _posHighlightIdx = -1;

  if (!q) {
    if (dropdown) dropdown.style.display = 'none';
    if (grid) { grid.className = 'pos-category-grid'; grid.innerHTML = renderPosCategoryGrid(products); }
    _posSelectedProduct = null;
    return;
  }

  // If query exactly matches a product name — show its variants as dropdown
  var exactProduct = products.find(function (p) { return p.name.toLowerCase() === q; });
  if (exactProduct) {
    showPosVariantDropdown(exactProduct, '');
    if (grid) { grid.className = 'pos-category-grid'; grid.innerHTML = renderPosCategoryGrid([exactProduct]); }
    return;
  }

  // Build suggestion list
  var suggestions = [];
  products.forEach(function (p) {
    var productMatch = p.name.toLowerCase().includes(q) || (p.desc || '').toLowerCase().includes(q);
    (p.variants || []).forEach(function (v) {
      var avail = v.stock - (v.reserved || 0);
      if (avail <= 0) return;
      var variantMatch = v.name.toLowerCase().includes(q) || (v.sku || '').toLowerCase().includes(q);
      if (productMatch || variantMatch) suggestions.push({ product: p, variant: v, available: avail });
    });
  });

  if (dropdown && suggestions.length > 0) {
    dropdown.style.display = 'block';
    var rows = suggestions.slice(0, 12).map(function (item, idx) {
      var lowClass = item.available <= 10 ? ' low' : '';
      return '<div class="pos-suggest-item" tabindex="0" data-pid="' + item.product.id + '" data-vid="' + item.variant.id + '" data-idx="' + idx + '">' +
        '<div class="pos-suggest-main">' +
        '<span class="pos-suggest-product">' + item.product.name + '</span>' +
        '<span class="pos-suggest-variant">' + item.variant.name + '</span>' +
        '</div>' +
        '<div class="pos-suggest-right">' +
        '<span class="pos-suggest-price">₱' + fmt(item.variant.price) + '</span>' +
        '<span class="pos-suggest-stock' + lowClass + '">' + item.available + ' avail</span>' +
        '</div>' +
        '</div>';
    }).join('');
    if (suggestions.length > 12) rows += '<div class="pos-suggest-more">' + (suggestions.length - 12) + ' more — keep typing to narrow down</div>';
    dropdown.innerHTML = rows;
    // Bind click via event delegation
    dropdown.querySelectorAll('.pos-suggest-item').forEach(function (el) {
      el.addEventListener('mousedown', function (e) {
        e.preventDefault();
        addToCart(el.dataset.pid, el.dataset.vid);
        clearPosSearch();
      });
    });
  } else if (dropdown) {
    dropdown.style.display = 'none';
  }

  // Filter category cards
  var matching = products.filter(function (p) {
    return p.name.toLowerCase().includes(q) || (p.desc || '').toLowerCase().includes(q) ||
      (p.variants || []).some(function (v) { return v.name.toLowerCase().includes(q) || (v.sku || '').toLowerCase().includes(q); });
  });
  if (grid) {
    grid.className = 'pos-category-grid';
    grid.innerHTML = matching.length ? renderPosCategoryGrid(matching) : '<div style="padding:40px;text-align:center;color:var(--ink-60)">No matching products.</div>';
  }
}

function showPosVariantDropdown(product, filterText) {
  var dropdown = document.getElementById('pos-search-dropdown');
  if (!dropdown) return;
  var q = (filterText || '').toLowerCase();
  var variants = (product.variants || []).filter(function (v) {
    var avail = v.stock - (v.reserved || 0);
    if (avail <= 0) return false;
    if (!q) return true;
    return v.name.toLowerCase().includes(q) || (v.sku || '').toLowerCase().includes(q);
  });
  if (!variants.length) { dropdown.style.display = 'none'; return; }
  dropdown.style.display = 'block';
  var rows = variants.map(function (v, idx) {
    var avail = v.stock - (v.reserved || 0);
    var lowClass = avail <= 10 ? ' low' : '';
    return '<div class="pos-suggest-item" tabindex="0" data-pid="' + product.id + '" data-vid="' + v.id + '" data-idx="' + idx + '">' +
      '<div class="pos-suggest-main">' +
      '<span class="pos-suggest-variant" style="font-weight:600">' + v.name + '</span>' +
      (v.sku ? '<span class="pos-suggest-sku">SKU: ' + v.sku + '</span>' : '') +
      '</div>' +
      '<div class="pos-suggest-right">' +
      '<span class="pos-suggest-price">₱' + fmt(v.price) + '</span>' +
      '<span class="pos-suggest-stock' + lowClass + '">' + avail + ' avail</span>' +
      '</div>' +
      '</div>';
  }).join('');
  dropdown.innerHTML = '<div class="pos-suggest-header">' + product.name + ' — select a variant:</div>' + rows;
  dropdown.querySelectorAll('.pos-suggest-item').forEach(function (el) {
    el.addEventListener('mousedown', function (e) {
      e.preventDefault();
      addToCart(el.dataset.pid, el.dataset.vid);
      clearPosSearch();
    });
  });
}

function clearPosSearch() {
  var input = document.getElementById('pos-search-input');
  var dropdown = document.getElementById('pos-search-dropdown');
  var grid = document.getElementById('pos-grid');
  if (input) input.value = '';
  if (dropdown) dropdown.style.display = 'none';
  if (grid) {
    var s = getState();
    grid.className = 'pos-category-grid';
    grid.innerHTML = renderPosCategoryGrid(s.products.filter(function (p) { return p.active; }));
  }
  _posSelectedProduct = null;
  _posHighlightIdx = -1;
}

function posSearchKeyDown(e) {
  var dropdown = document.getElementById('pos-search-dropdown');
  if (!dropdown || dropdown.style.display === 'none') return;
  var items = dropdown.querySelectorAll('.pos-suggest-item');
  if (!items.length) return;
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    _posHighlightIdx = Math.min(_posHighlightIdx + 1, items.length - 1);
    items.forEach(function (el, i) { el.classList.toggle('highlighted', i === _posHighlightIdx); });
    items[_posHighlightIdx].scrollIntoView({ block: 'nearest' });
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    _posHighlightIdx = Math.max(_posHighlightIdx - 1, 0);
    items.forEach(function (el, i) { el.classList.toggle('highlighted', i === _posHighlightIdx); });
    items[_posHighlightIdx].scrollIntoView({ block: 'nearest' });
  } else if (e.key === 'Enter' && _posHighlightIdx >= 0) {
    e.preventDefault();
    items[_posHighlightIdx].dispatchEvent(new MouseEvent('mousedown'));
  } else if (e.key === 'Escape') {
    clearPosSearch();
  }
  if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') _posHighlightIdx = -1;
}

document.addEventListener('click', function (e) {
  var dropdown = document.getElementById('pos-search-dropdown');
  var input = document.getElementById('pos-search-input');
  if (dropdown && input && !dropdown.contains(e.target) && e.target !== input) {
    dropdown.style.display = 'none';
  }
});

function cartSubtotal(cart) { return cart.reduce((a, b) => a + b.price * b.qty, 0); }

function setPosDraftField(field, value) {
  const s = getState();
  s.posDraft = s.posDraft || {};
  if (field === 'discountValue') s.posDraft[field] = parseFloat(value) || 0;
  else s.posDraft[field] = value;
  saveState(s);
  refreshCart();
}

function computeDiscount(subtotal, cart, draft, state, branchId) {
  let amount = 0;
  let note = '';
  const type = draft.discountType || 'none';
  const val = parseFloat(draft.discountValue) || 0;
  const cfg = getSystemConfig();

  if (type === 'percent' && val > 0) {
    amount += subtotal * (Math.min(val, 100) / 100);
    note = `Manual discount: ${Math.min(val, 100)}%`;
  } else if (type === 'fixed' && val > 0) {
    amount += Math.min(val, subtotal);
    note = `Manual discount: ₱${fmt(Math.min(val, subtotal))}`;
  }

  const promo = (state.promos || []).find(p => p.enabled && (!p.branchId || p.branchId === branchId) && p.type === 'bulk_item');
  const bulkSource = promo ? { minQty: promo.minQty || 10, percent: promo.percent || 10 } : { minQty: 10, percent: 10 };
  let bulkDiscount = 0;
  cart.forEach(item => {
    if (item.qty >= bulkSource.minQty) bulkDiscount += (item.price * item.qty) * (bulkSource.percent / 100);
  });
  if (bulkDiscount > 0) {
    amount += bulkDiscount;
    note = note ? `${note} + Bulk promo` : `Bulk promo applied (${bulkSource.percent}% for qty ≥ ${bulkSource.minQty})`;
  }

  // Auto-discount tiers (configurable via System Config)
  if (type === 'none') {
    if (subtotal >= cfg.discount2Threshold) {
      const tierDisc = subtotal * (cfg.discount2Percent / 100);
      if (tierDisc > amount) { amount = tierDisc; note = `Auto-discount: ${cfg.discount2Percent}% (order ≥ ₱${fmt(cfg.discount2Threshold)})`; }
    } else if (subtotal >= cfg.discount1Threshold) {
      const tierDisc = subtotal * (cfg.discount1Percent / 100);
      if (tierDisc > amount) { amount = tierDisc; note = `Auto-discount: ${cfg.discount1Percent}% (order ≥ ₱${fmt(cfg.discount1Threshold)})`; }
    }
  }

  amount = Math.min(amount, subtotal);
  const isManual = (type === 'percent' || type === 'fixed') && val > 0;
  return { amount, note, isManual };
}

function renderCartItems(cart) {
  if (!cart.length) return `<div class="cart-empty"><div class="cart-empty-icon">${iconSvg('cart')}</div><span>Cart is empty</span></div>`;
  return cart.map((item, idx) => `
    <div class="cart-item">
      <div class="cart-item-info">
        <div class="cart-item-name">${item.productName}</div>
        <div class="cart-item-variant">${item.variantName}</div>
      </div>
      <div class="cart-qty-controls">
        <div class="qty-btn" onclick="changeQty(${idx}, -1)">−</div>
        <div class="qty-val">${item.qty}</div>
        <div class="qty-btn" onclick="changeQty(${idx}, 1)">+</div>
      </div>
      <div class="cart-item-price">₱${fmt(item.price * item.qty)}</div>
    </div>`).join('');
}

function addToCart(pid, vid) {
  const s = getState();
  const p = s.products.find(x => x.id === pid);
  const v = p?.variants.find(x => x.id === vid);
  if (!p || !v) return;
  const available = v.stock - (v.reserved || 0);
  if (available <= 0) { showToast('No available stock for this variant.', 'error'); return; }
  const cart = s.cart || [];
  const existing = cart.find(x => x.variantId === vid);
  if (existing) {
    if (existing.qty + 1 > available) { showToast('Insufficient available stock.', 'error'); return; }
    existing.qty++;
  }
  else cart.push({ productId: pid, variantId: vid, productName: p.name, variantName: v.name, price: v.price, qty: 1 });
  s.cart = cart;
  saveState(s);
  refreshCart();
  showToast(`${p.name} (${v.name}) added to cart`, 'success');
}

function changeQty(idx, delta) {
  const s = getState();
  const cart = s.cart || [];
  if (!cart[idx]) return;
  cart[idx].qty += delta;
  if (cart[idx].qty <= 0) cart.splice(idx, 1);
  s.cart = cart;
  saveState(s);
  refreshCart();
}

function clearCart() {
  confirmModal({
    title: 'Clear Cart',
    message: 'Are you sure you want to remove all items from the cart?',
    confirmText: 'Clear Cart',
    icon: '🛒',
    onConfirm: function () {
      const s = getState();
      s.cart = [];
      saveState(s);
      refreshCart();
    }
  });
}

function refreshCart() {
  const s = getState();
  const cart = s.cart || [];
  const draft = s.posDraft || {};
  const subtotal = cartSubtotal(cart);
  const discountInfo = computeDiscount(subtotal, cart, draft, s, getActiveBranchId(s, s.currentUser));
  const total = Math.max(0, subtotal - discountInfo.amount);
  const listEl = document.getElementById('cart-items-list');
  const badgeEl = document.getElementById('cart-badge');
  const totalEl = document.getElementById('cart-total');
  const subtotalEl = document.getElementById('cart-subtotal');
  const discountEl = document.getElementById('cart-discount');
  const discountNoteEl = document.getElementById('cart-discount-note');
  const checkoutBtn = document.getElementById('checkout-btn');
  if (listEl) listEl.innerHTML = renderCartItems(cart);
  if (badgeEl) badgeEl.textContent = cart.reduce((a, b) => a + b.qty, 0);
  if (subtotalEl) subtotalEl.textContent = '₱' + fmt(subtotal);
  if (discountEl) discountEl.textContent = '- ₱' + fmt(discountInfo.amount);
  if (totalEl) totalEl.textContent = '₱' + fmt(total);
  if (discountNoteEl) discountNoteEl.textContent = discountInfo.note || '';
  if (checkoutBtn) { checkoutBtn.disabled = cart.length === 0; checkoutBtn.textContent = `Checkout — ₱${fmt(total)}`; }
  updateChange();
}

function updateChange() {
  const s = getState();
  const cart = s.cart || [];
  const subtotal = cartSubtotal(cart);
  const discountInfo = computeDiscount(subtotal, cart, s.posDraft || {}, s, getActiveBranchId(s, s.currentUser));
  const total = Math.max(0, subtotal - discountInfo.amount);
  const cash = parseFloat(document.getElementById('pay-cash')?.value) || 0;
  const gcashSection = document.getElementById('gcash-pay-section');
  const gcashTrigger = document.getElementById('gcash-trigger-row');
  const changeEl = document.getElementById('change-row');
  const changeAmt = document.getElementById('change-amount');

  const remaining = total - cash;

  if (cash > 0 && remaining > 0) {
    // Cash entered but not enough — show GCash button for the remainder
    window._gcashBalance = remaining;
    if (gcashTrigger) gcashTrigger.style.display = 'block';
    if (gcashSection) gcashSection.style.display = 'none';
    if (changeEl) changeEl.style.display = 'none';
  } else if (cash >= total && total > 0) {
    // Fully covered by cash — hide GCash
    window._gcashBalance = 0;
    if (gcashTrigger) gcashTrigger.style.display = 'none';
    if (gcashSection) { gcashSection.style.display = 'none'; }
    const change = cash - total;
    if (changeEl) changeEl.style.display = 'block';
    if (changeAmt) changeAmt.textContent = '₱' + fmt(change);
  } else {
    // No cash entered yet — show GCash trigger so customer can pay fully via GCash
    window._gcashBalance = total;
    if (gcashTrigger) gcashTrigger.style.display = total > 0 ? 'block' : 'none';
    if (gcashSection) gcashSection.style.display = 'none';
    if (changeEl) changeEl.style.display = 'none';
  }
}

function activateGCashPay() {
  const s = getState();
  const cart = s.cart || [];
  const subtotal = cartSubtotal(cart);
  const discountInfo = computeDiscount(subtotal, cart, s.posDraft || {}, s, getActiveBranchId(s, s.currentUser));
  const total = Math.max(0, subtotal - discountInfo.amount);
  const cash = parseFloat(document.getElementById('pay-cash')?.value) || 0;
  const gcashAmount = Math.max(0, total - cash);

  // Fill in the GCash amount (read-only, auto-computed)
  const gcashInput = document.getElementById('pay-gcash');
  if (gcashInput) gcashInput.value = gcashAmount.toFixed(2);

  const gcashSection = document.getElementById('gcash-pay-section');
  const gcashTrigger = document.getElementById('gcash-trigger-row');
  if (gcashSection) gcashSection.style.display = 'block';
  if (gcashTrigger) gcashTrigger.style.display = 'none';

  // Focus the reference number field
  setTimeout(() => document.getElementById('pay-gcash-ref')?.focus(), 50);
}

function cancelGCashPay() {
  // Clear GCash fields
  const gcashInput = document.getElementById('pay-gcash');
  const gcashRef = document.getElementById('pay-gcash-ref');
  if (gcashInput) gcashInput.value = '';
  if (gcashRef) gcashRef.value = '';

  // Hide GCash section and re-run updateChange to show trigger/change correctly
  const gcashSection = document.getElementById('gcash-pay-section');
  if (gcashSection) gcashSection.style.display = 'none';
  updateChange();
}

function doCheckout() {
  const s = getState();
  const u = s.currentUser;
  const cart = s.cart || [];
  if (!cart.length) return;
  const draft = s.posDraft || {};
  const branchId = getActiveBranchId(s, u);
  const subtotal = cartSubtotal(cart);
  const discountInfo = computeDiscount(subtotal, cart, draft, s, branchId);
  // Staff cannot apply manual discounts — only auto promos allowed
  if (discountInfo.amount > 0 && (draft.discountType === 'percent' || draft.discountType === 'fixed') && u.role !== 'admin') {
    showToast('Only Administrators can apply manual discounts. Auto-promotions still apply.', 'error');
    return;
  }
  const total = Math.max(0, subtotal - discountInfo.amount);
  const cash = parseFloat(document.getElementById('pay-cash')?.value) || 0;
  const gcash = parseFloat(document.getElementById('pay-gcash')?.value) || 0;
  const gcashRef = (document.getElementById('pay-gcash-ref')?.value || '').trim();
  const isCredit = draft.payMode === 'credit';
  if (!isCredit && cash + gcash < total) { showToast('Insufficient payment amount!', 'error'); return; }
  if (gcash > 0 && !gcashRef) { showToast('GCash Reference # is required when paying with GCash.', 'error'); document.getElementById('pay-gcash-ref')?.focus(); return; }
  if (isCredit && !draft.customerId) { showToast('Select a customer for credit sale.', 'error'); return; }
  if (isCredit && s.currentUser && s.currentUser.role !== 'admin') {
    showToast('Only Administrators can authorize credit sales.', 'error');
    return;
  }
  if (discountInfo.isManual && discountInfo.amount > 0 && !(draft.discountReason || '').trim()) { showToast('Discount reason is required.', 'error'); return; }

  for (const item of cart) {
    const variant = findVariantById(s, item.variantId);
    if (!variant) { showToast('Some cart items are invalid.', 'error'); return; }
    const available = variant.stock - (variant.reserved || 0);
    if (item.qty > available) { showToast(`Insufficient stock: ${item.productName} (${item.variantName})`, 'error'); return; }
  }

  const myShift = s.shifts.find(x => x.userId === u.id && x.status === 'open');
  const sale = {
    id: 'sale_' + Date.now(),
    branchId,
    userId: u.id,
    shiftId: myShift?.id || null,
    customerId: draft.customerId || null,
    items: cart.map(c => ({ ...c, subtotal: c.price * c.qty })),
    payments: [],
    subtotal,
    discountAmount: discountInfo.amount,
    discountReason: (draft.discountReason || '').trim() || null,
    discountType: draft.discountType || 'none',
    discountValue: parseFloat(draft.discountValue) || 0,
    paymentMode: isCredit ? 'credit' : 'regular',
    total,
    voided: false,
    voidReason: null,
    createdAt: new Date().toISOString(),
  };
  if (!isCredit) {
    if (cash > 0) sale.payments.push({ method: 'cash', amount: cash });
    if (gcash > 0) sale.payments.push({ method: 'gcash', amount: gcash, reference: gcashRef });
  } else {
    sale.payments.push({ method: 'credit', amount: total });
    const customer = s.customers.find(c => c.id === draft.customerId);
    if (customer) customer.outstandingBalance = (customer.outstandingBalance || 0) + total;
  }

  sale.items.forEach(item => {
    const variant = findVariantById(s, item.variantId);
    if (variant) adjustVariantBranchStock(variant, branchId, -item.qty);
  });

  // Save sale locally
  s.sales.push(sale);
  s.cart = [];
  s.posDraft = { ...s.posDraft, discountReason: '', discountValue: 0, discountType: 'none', payMode: 'regular' };
  saveState(s);
  DB.saveSale(sale);
  showReceiptModal(sale, s);
}

function showReceiptModal(sale, s) {
  const branch = s.branches.find(b => b.id === sale.branchId);
  const cashPaid = sale.payments.find(p => p.method === 'cash')?.amount || 0;
  const gcashPayment = sale.payments.find(p => p.method === 'gcash');
  const gcashPaid = gcashPayment?.amount || 0;
  const gcashRef = gcashPayment?.reference || '';
  const change = cashPaid - Math.max(0, sale.total - gcashPaid);
  const staffUser = s.users.find(u => u.id === sale.userId);
  const staffName = staffUser?.name || staffUser?.username || '—';
  const html = `
    <div class="modal-overlay" onclick="if(event.target===this){closeModal();renderPOS();}">
      <div class="modal">
        <div class="modal-header"><h2>${iconSvg('receipt')} Sale Complete</h2><button class="btn-close-modal" onclick="closeModal();renderPOS()">✕</button></div>
        <div class="modal-body">
          <div class="receipt">
            <div class="receipt-header"><strong>South Pafps Packaging Supplies</strong><span>${branch?.name || ''}</span><br><span>${new Date(sale.createdAt).toLocaleString()}</span></div>
            ${sale.items.map(i => `<div class="receipt-row"><span>${i.productName} (${i.variantName}) x${i.qty}</span><span>₱${fmt(i.price * i.qty)}</span></div>`).join('')}
            <div class="receipt-row total"><span>TOTAL</span><span>₱${fmt(sale.total)}</span></div>
            ${cashPaid > 0 ? `<div class="receipt-row"><span>Cash</span><span>₱${fmt(cashPaid)}</span></div>` : ''}
            ${gcashPaid > 0 ? `<div class="receipt-row"><span>GCash</span><span>₱${fmt(gcashPaid)}</span></div>` : ''}
            ${gcashRef ? `<div class="receipt-row" style="font-size:11px;color:var(--ink-60)"><span>GCash Ref #</span><span style="font-family:var(--font-mono)">${gcashRef}</span></div>` : ''}
            ${change > 0 ? `<div class="receipt-row bold"><span>Change</span><span>₱${fmt(change)}</span></div>` : ''}
            <div class="receipt-footer">Receipt # ${sale.id.slice(-6).toUpperCase()}<br>Served by: ${staffName}<br>Thank you for your purchase!</div>
          </div>
        </div>
        <div class="modal-footer"><button class="btn btn-outline" onclick="printContent(document.querySelector('.receipt').outerHTML,'Receipt — South Pafps')">${iconSvg('printer')} Print</button><button class="btn btn-maroon" onclick="closeModal();renderPOS()">New Sale</button></div>
      </div>
    </div>`;
  document.getElementById('modal-container').innerHTML = html;
}

// SHIFT MANAGEMENT
function renderShift() {
  const s = getState();
  const u = s.currentUser;
  const isAdmin = u.role === 'admin';
  const myShift = isAdmin ? null : s.shifts.find(x => x.userId === u.id && x.status === 'open');
  const allShifts = isAdmin ? s.shifts : s.shifts.filter(x => x.userId === u.id);
  const activeShifts = s.shifts.filter(x => x.status === 'open');
  const latestHandover = !isAdmin ? [...s.handoverNotes].reverse().find(n => n.branchId === (u.branchId || 'b1')) : null;

  let html = `<div class="page-header"><h1 class="page-title">${isAdmin ? 'Shift Management' : 'Cash Movement'}</h1><p class="page-subtitle">${isAdmin ? 'View and manage all branch shifts' : 'Manage your shift and cash drawer'}</p></div>`;

  if (isAdmin) {
    html += `<div class="kpi-grid" style="grid-template-columns:repeat(3,1fr)">
      <div class="kpi-card"><div class="kpi-header"><div class="kpi-label">Active Shifts</div><div class="kpi-icon green">${iconSvg('statusOpen')}</div></div><div class="kpi-value">${activeShifts.length}</div></div>
      <div class="kpi-card"><div class="kpi-header"><div class="kpi-label">Total Shifts Today</div><div class="kpi-icon gold">${iconSvg('clipboard')}</div></div><div class="kpi-value">${allShifts.filter(x => new Date(x.openedAt).toDateString() === new Date().toDateString()).length}</div></div>
      <div class="kpi-card"><div class="kpi-header"><div class="kpi-label">Force Closed</div><div class="kpi-icon maroon">${iconSvg('warning')}</div></div><div class="kpi-value">${allShifts.filter(x => x.status === 'force_closed').length}</div></div>
    </div>`;
  } else {
    html += `<div class="shift-status-card">
      <div class="shift-status-icon ${myShift ? 'open' : 'closed'}">${myShift ? iconSvg('statusOpen') : iconSvg('statusClosed')}</div>
      <div class="shift-status-info">
        <h3>${myShift ? 'Shift Open' : 'No Active Shift'}</h3>
        <p>${myShift ? `Opened at ${fmtTime(myShift.openedAt)} · Opening Cash: ₱${fmt(myShift.openingCash)}` : 'Open a shift to start processing sales.'}</p>
      </div>
      <div class="shift-status-actions">
        ${!myShift ? `<button class="btn btn-maroon" onclick="openShiftModal()">Open Shift</button>` : `<button class="btn btn-outline" onclick="cashMoveModal()">Cash Movement</button><button class="btn btn-danger" onclick="closeShiftModal()">Close Shift</button>`}
      </div>
    </div>`;
    if (latestHandover) {
      html += `<div class="alert alert-info">${iconSvg('note')} Latest handover note (${fmtTime(latestHandover.createdAt)}): ${latestHandover.note}</div>`;
    }
    if (myShift) {
      const shiftSales = s.sales.filter(x => !x.voided && x.shiftId === myShift.id);
      const cashSales = shiftSales.reduce((a, b) => a + (b.payments.find(p => p.method === 'cash')?.amount || 0), 0);
      const gcashSales = shiftSales.reduce((a, b) => a + (b.payments.find(p => p.method === 'gcash')?.amount || 0), 0);
      const payin = s.cashMovements.filter(c => c.shiftId === myShift.id && c.type === 'payin').reduce((a, b) => a + b.amount, 0);
      const payout = s.cashMovements.filter(c => c.shiftId === myShift.id && c.type === 'payout').reduce((a, b) => a + b.amount, 0);
      const expected = myShift.openingCash + cashSales + payin - payout;
      html += `<div class="shift-summary-grid">
        <div class="shift-summary-item"><div class="shift-summary-label">Cash Sales</div><div class="shift-summary-value positive">₱${fmt(cashSales)}</div></div>
        <div class="shift-summary-item"><div class="shift-summary-label">GCash Sales</div><div class="shift-summary-value">₱${fmt(gcashSales)}</div></div>
        <div class="shift-summary-item"><div class="shift-summary-label">Pay-Ins</div><div class="shift-summary-value positive">₱${fmt(payin)}</div></div>
        <div class="shift-summary-item"><div class="shift-summary-label">Actual Cash</div><div class="shift-summary-value">₱${fmt(expected)}</div></div>
      </div>`;
    }
  }

  html += `<div class="data-card"><div class="data-card-header"><span class="data-card-title">${isAdmin ? 'All Shifts' : 'My Shift History'}</span></div><div class="data-card-body no-pad">
    <table class="data-table"><thead><tr><th>Staff</th><th>Branch</th><th>Opened At</th><th>Closed At</th><th>Opening Cash</th><th>Status</th>${isAdmin ? '<th>Actions</th>' : ''}</tr></thead>
    <tbody>${[...allShifts].reverse().slice(0, 20).map(sh => {
    const staff = s.users.find(u => u.id === sh.userId);
    const branch = s.branches.find(b => b.id === sh.branchId);
    return `<tr>
        <td>${staff?.name || '–'}</td>
        <td>${branch?.name || '–'}</td>
        <td class="td-mono">${fmtTime(sh.openedAt)}</td>
        <td class="td-mono">${sh.closedAt ? fmtTime(sh.closedAt) : '—'}</td>
        <td class="td-mono">₱${fmt(sh.openingCash)}</td>
        <td>${sh.status === 'open' ? '<span class="badge badge-success">Open</span>' : sh.status === 'force_closed' ? '<span class="badge badge-danger">Force Closed</span>' : '<span class="badge badge-neutral">Closed</span>'}</td>
        ${isAdmin ? `<td>${sh.status === 'open' ? `<button class="btn btn-sm btn-danger" onclick="forceCloseShift('${sh.id}')">Force Close</button>` : '—'}</td>` : ''}
      </tr>`;
  }).join('') || `<tr><td colspan="${isAdmin ? 7 : 6}" style="text-align:center;padding:28px;color:var(--ink-60)">No shifts recorded.</td></tr>`}</tbody>
    </table>
  </div></div>`;
  document.getElementById('page-content').innerHTML = html;
}

function openShiftModal() {
  const s = getState();
  const u = s.currentUser;
  const br = (s.branches || []).find(b => b.id === (u.branchId || 'b1'));
  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });
  const dateStr = now.toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  showModal(`<div class="modal-header"><h2>Open Shift</h2><button class="btn-close-modal" onclick="closeModal()">✕</button></div>
    <div class="modal-body">
      <div style="background:var(--cream);border-radius:var(--radius);padding:14px 16px;margin-bottom:18px;display:flex;align-items:center;gap:14px;">
        <div style="font-size:28px">⏰</div>
        <div>
          <div style="font-weight:700;font-size:15px">${u.name}</div>
          <div style="font-size:12px;color:var(--ink-60)">${br?.name || 'Branch'} · ${dateStr}</div>
          <div style="font-size:11px;color:var(--maroon);font-weight:600;margin-top:2px">Starting shift at ${timeStr}</div>
        </div>
      </div>
      <div class="form-group">
        <label>Opening Cash (₱) <span style="color:var(--danger)">*</span></label>
        <input type="number" id="opening-cash" class="form-control" placeholder="0.00" min="0" step="0.01" autofocus>
        <p style="font-size:12px;color:var(--ink-50);margin-top:6px">Count all bills and coins in the cash drawer and enter the total.</p>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
      <button class="btn btn-maroon" onclick="confirmOpenShift()">Open Shift</button>
    </div>`);
  setTimeout(() => document.getElementById('opening-cash')?.focus(), 80);
}

function confirmOpenShift() {
  const s = getState();
  const u = s.currentUser;
  const cash = parseFloat(document.getElementById('opening-cash').value) || 0;
  if (cash < 0) { showToast('Invalid cash amount', 'error'); return; }
  const shift = { id: 'shift_' + Date.now(), userId: u.id, branchId: u.branchId || 'b1', openingCash: cash, closingCash: null, status: 'open', openedAt: new Date().toISOString(), closedAt: null };
  s.shifts.push(shift);
  recordAudit(s, { action: 'shift_opened', message: `Shift opened by ${u.name}`, referenceId: shift.id, branchId: shift.branchId, meta: { openingCash: cash } });
  saveState(s);
  DB.openShift(shift);
  closeModal();
  showToast('Shift opened successfully!', 'success');
  renderShift();
}

function closeShiftModal() {
  const s = getState();
  const u = s.currentUser;
  const myShift = s.shifts.find(x => x.userId === u.id && x.status === 'open');
  const openedAt = myShift ? new Date(myShift.openedAt).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' }) : '—';
  const cashSales = myShift ? (s.sales || []).filter(x => !x.voided && x.shiftId === myShift.id)
    .reduce((sum, sale) => sum + (sale.payments?.find(p => p.method === 'cash')?.amount || 0), 0) : 0;
  showModal(`<div class="modal-header"><h2>Close Shift</h2><button class="btn-close-modal" onclick="closeModal()">✕</button></div>
    <div class="modal-body">
      <div class="alert alert-warning" style="margin-bottom:16px">${iconSvg('warning')} Count all physical cash in the drawer before closing.</div>
      <div style="background:var(--cream);border-radius:var(--radius);padding:12px 16px;margin-bottom:16px;display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:13px;">
        <div><span style="color:var(--ink-50)">Shift Opened</span><div style="font-weight:600">${openedAt}</div></div>
        <div><span style="color:var(--ink-50)">Opening Cash</span><div style="font-weight:600">₱${fmt(myShift?.openingCash || 0)}</div></div>
        <div><span style="color:var(--ink-50)">Cash Sales</span><div style="font-weight:600;color:var(--success)">₱${fmt(cashSales)}</div></div>
        <div><span style="color:var(--ink-50)">Expected in Drawer</span><div style="font-weight:700;color:var(--maroon)">₱${fmt((myShift?.openingCash || 0) + cashSales)}</div></div>
      </div>
      <div class="form-group">
        <label>Actual Closing Cash (₱) <span style="color:var(--danger)">*</span></label>
        <input type="number" id="closing-cash" class="form-control" placeholder="Count physical cash and enter total" min="0" step="0.01">
      </div>
      <div class="form-group">
        <label>Shift Handover Note</label>
        <textarea id="handover-note" class="form-control" rows="3" placeholder="Pending orders, low-stock items, customer concerns, equipment issues…"></textarea>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
      <button class="btn btn-danger" onclick="confirmCloseShift()">Close Shift</button>
    </div>`);
  setTimeout(() => document.getElementById('closing-cash')?.focus(), 80);
}

function confirmCloseShift() {
  const s = getState();
  const u = s.currentUser;
  const myShift = s.shifts.find(x => x.userId === u.id && x.status === 'open');
  if (!myShift) return;
  const cash = parseFloat(document.getElementById('closing-cash').value) || 0;
  const handoverNote = document.getElementById('handover-note').value.trim();
  myShift.closingCash = cash;
  myShift.status = 'closed';
  myShift.closedAt = new Date().toISOString();
  if (handoverNote) {
    const hn = { id: 'hn_' + Date.now(), branchId: myShift.branchId, shiftId: myShift.id, userId: u.id, note: handoverNote, createdAt: new Date().toISOString() };
    s.handoverNotes.push(hn);
    DB.saveHandoverNote(hn);
  }
  recordAudit(s, { action: 'shift_closed', message: `Shift closed by ${u.name}`, referenceId: myShift.id, branchId: myShift.branchId, meta: { closingCash: cash, handoverNote: handoverNote || null } });
  saveState(s);
  DB.closeShift(myShift.id, { closingCash: cash, status: 'closed', closedAt: myShift.closedAt, handoverNote: handoverNote || null });
  closeModal();
  showToast('Shift closed. Thank you!', 'success');
  renderShift();
}

function forceCloseShift(shiftId) {
  const s = getState();
  const shift = s.shifts.find(x => x.id === shiftId);
  if (!shift) return;
  shift.status = 'force_closed';
  shift.closedAt = new Date().toISOString();
  recordAudit(s, { action: 'shift_force_closed', message: `Shift force-closed (${shift.id.slice(-6).toUpperCase()})`, referenceId: shift.id, branchId: shift.branchId });
  saveState(s);
  DB.closeShift(shift.id, { status: 'force_closed', closedAt: shift.closedAt });
  showToast('Shift force-closed by admin.', 'warning');
  renderShift();
}

function cashMoveModal() {
  showModal(`<div class="modal-header"><h2>Cash Movement</h2><button class="btn-close-modal" onclick="closeModal()">✕</button></div>
    <div class="modal-body">
      <div class="form-group">
        <label>Type <span style="color:var(--danger)">*</span></label>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:6px">
          <label style="display:flex;align-items:center;gap:10px;padding:12px 14px;border:2px solid var(--ink-10);border-radius:var(--radius);cursor:pointer;transition:border-color .15s" onclick="this.style.borderColor='var(--success)';document.getElementById('cm-payout-lbl').style.borderColor='var(--ink-10)';document.getElementById('cm-type').value='payin'">
            <span style="font-size:20px">💵</span>
            <div><div style="font-weight:600;font-size:13px">Pay-In</div><div style="font-size:11px;color:var(--ink-50)">Add cash to drawer</div></div>
          </label>
          <label id="cm-payout-lbl" style="display:flex;align-items:center;gap:10px;padding:12px 14px;border:2px solid var(--ink-10);border-radius:var(--radius);cursor:pointer;transition:border-color .15s" onclick="this.style.borderColor='var(--danger)';document.getElementById('cm-type').value='payout';this.previousElementSibling.style.borderColor='var(--ink-10)'">
            <span style="font-size:20px">🏧</span>
            <div><div style="font-weight:600;font-size:13px">Pay-Out</div><div style="font-size:11px;color:var(--ink-50)">Remove cash from drawer</div></div>
          </label>
        </div>
        <input type="hidden" id="cm-type" value="payin">
      </div>
      <div class="form-group">
        <label>Amount (₱) <span style="color:var(--danger)">*</span></label>
        <input type="number" id="cm-amount" class="form-control" placeholder="0.00" min="0" step="0.01">
      </div>
      <div class="form-group">
        <label>Reason <span style="color:var(--danger)">*</span></label>
        <input type="text" id="cm-reason" class="form-control" placeholder="e.g. Change fund, petty cash for supplies…">
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
      <button class="btn btn-maroon" onclick="confirmCashMove()">Confirm</button>
    </div>`);
  setTimeout(() => document.getElementById('cm-amount')?.focus(), 80);
}

function confirmCashMove() {
  const s = getState();
  const u = s.currentUser;
  const myShift = s.shifts.find(x => x.userId === u.id && x.status === 'open');
  if (!myShift) return;
  const type = document.getElementById('cm-type').value;
  const amount = parseFloat(document.getElementById('cm-amount').value) || 0;
  const reason = document.getElementById('cm-reason').value;
  if (!amount || !reason) { showToast('Fill in all fields', 'error'); return; }
  const movement = { id: 'cm_' + Date.now(), shiftId: myShift.id, type, amount, reason, createdAt: new Date().toISOString() };
  s.cashMovements.push(movement);
  recordAudit(s, { action: 'cash_movement', message: `Cash ${type} posted`, referenceId: myShift.id, branchId: myShift.branchId, meta: { amount, reason } });
  saveState(s);
  DB.saveCashMovement(movement);
  closeModal();
  showToast(`Cash ${type === 'payin' ? 'Pay-In' : 'Pay-Out'} of ₱${fmt(amount)} recorded.`, 'success');
  renderShift();
}

// SALES HISTORY
function voidSaleModal(saleId) {
  const s = getState();
  const sale = s.sales.find(x => x.id === saleId);
  const saleTotal = sale ? `₱${fmt(sale.total)}` : '—';
  const saleDate = sale ? new Date(sale.createdAt).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
  showModal(`<div class="modal-header"><h2>Void Sale</h2><button class="btn-close-modal" onclick="closeModal()">✕</button></div>
    <div class="modal-body">
      <div class="alert alert-error-box" style="margin-bottom:16px">${iconSvg('warning')} <strong>This cannot be undone.</strong> Stock will be restored automatically.</div>
      <div style="background:var(--cream);border-radius:var(--radius);padding:12px 16px;margin-bottom:16px;display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:13px;">
        <div><span style="color:var(--ink-50)">Sale ID</span><div style="font-weight:600;font-family:var(--font-mono)">${saleId.slice(-8).toUpperCase()}</div></div>
        <div><span style="color:var(--ink-50)">Amount</span><div style="font-weight:700;color:var(--danger)">${saleTotal}</div></div>
        <div style="grid-column:1/-1"><span style="color:var(--ink-50)">Date</span><div style="font-weight:600">${saleDate}</div></div>
      </div>
      <div class="form-group">
        <label>Void Reason <span style="color:var(--danger)">*</span></label>
        <input type="text" id="void-reason" class="form-control" placeholder="e.g. Customer request, wrong item, duplicate…">
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
      <button class="btn btn-danger" onclick="confirmVoid('${saleId}')">Void Sale</button>
    </div>`);
  setTimeout(() => document.getElementById('void-reason')?.focus(), 80);
}

function confirmVoid(saleId) {
  const reason = document.getElementById('void-reason').value.trim();
  if (!reason) { showToast('Void reason is required!', 'error'); return; }
  const s = getState();
  if (!s.currentUser || s.currentUser.role !== 'admin') {
    showToast('Only Administrators can void sales.', 'error');
    closeModal();
    return;
  }
  const sale = s.sales.find(x => x.id === saleId);
  if (!sale) { showToast('Sale not found.', 'error'); return; }
  sale.voided = true;
  sale.status = 'voided';
  sale.voidReason = reason;
  sale.voidedAt = new Date().toISOString();

  // BUG FIX 1a: Restore stock for all items in the voided sale
  sale.items.forEach(item => {
    const variant = findVariantById(s, item.variantId);
    if (variant) adjustVariantBranchStock(variant, sale.branchId, +item.qty);
  });

  // BUG FIX 1b: Restore credit balance if this was a credit sale
  if (sale.paymentMode === 'credit' && sale.customerId) {
    const customer = s.customers.find(c => c.id === sale.customerId);
    if (customer) {
      customer.outstandingBalance = Math.max(0, (customer.outstandingBalance || 0) - sale.total);
      DB.updateCustomer(customer.id, { outstandingBalance: customer.outstandingBalance });
    }
  }

  recordAudit(s, { action: 'sale_voided', message: `Sale voided: ${saleId} — ${reason}`, referenceId: saleId });
  saveState(s);
  DB.voidSale(saleId, reason, sale.voidedAt);
  closeModal();
  showToast('Sale voided.', 'warning');
  renderSales();
}

// PRODUCT MANAGEMENT
function deleteProduct(pid) {
  const s = getState();
  if (!s.currentUser || s.currentUser.role !== 'admin') { showToast('Only Administrators can delete products.', 'error'); return; }
  const prod = s.products.find(p => p.id === pid);
  const prodName = prod ? (prod.productType || prod.name || 'this product') : 'this product';
  confirmModal({
    title: 'Delete Product',
    message: `Are you sure you want to delete <strong>${prodName}</strong>? This action cannot be undone.`,
    confirmText: 'Delete Product',
    icon: '🗑️',
    onConfirm: function () {
      const s2 = getState();
      s2.products = s2.products.filter(p => p.id !== pid);
      saveState(s2);
      DB.deleteProduct(pid);
      showToast('Product deleted!', 'success');
      renderProductMgmt();
    }
  });
}

var _pmTab = 'branch'; // 'branch' | 'print'
function switchPmTab(tab) { _pmTab = tab; _renderProductMgmtPage(); }

function renderProductMgmt() {
  const _pm = getState();
  if (!_pm.currentUser || _pm.currentUser.role !== 'admin') { accessDenied('Product Management'); return; }
  _renderProductMgmtPage();
}

function _renderProductMgmtPage() {
  const page = currentPage || 'product-mgmt';
  const navId = getNavRenderId();
  const s = getState();

  // Branch Products
  const products = s.products;
  const totalVariants = products.reduce((a, p) => a + (p.variants ? p.variants.length : 0), 0);
  const branchRows = products.map(function (p) {
    const prices = (p.variants || []).map(function (v) { return v.price; });
    const min = prices.length ? Math.min.apply(null, prices) : 0;
    const max = prices.length ? Math.max.apply(null, prices) : 0;
    const varCount = p.variants ? p.variants.length : 0;
    return '<tr>' +
      '<td><strong>' + p.name + '</strong><div style="font-size:12px;color:var(--ink-60)">' + (p.desc || '') + '</div></td>' +
      '<td>' + varCount + ' variant' + (varCount !== 1 ? 's' : '') + '</td>' +
      '<td class="td-mono">\u20b1' + fmt(min) + (min !== max ? ' \u2013 \u20b1' + fmt(max) : '') + '</td>' +
      '<td>' + (p.active ? '<span class="badge badge-success">Active</span>' : '<span class="badge badge-neutral">Inactive</span>') + '</td>' +
      '<td>' +
      '<button class="btn btn-sm btn-outline" onclick="editProductModal(\'' + p.id + '\')">Edit</button> ' +
      '<button class="btn btn-sm btn-icon" onclick="toggleProduct(\'' + p.id + '\')" title="' + (p.active ? 'Deactivate' : 'Activate') + '">' + (p.active ? iconSvg('lock') : iconSvg('lockOpen')) + '</button> ' +
      '<button class="btn btn-sm btn-icon" onclick="deleteProduct(\'' + p.id + '\')" title="Delete">' + iconSvg('error') + '</button>' +
      '</td></tr>';
  }).join('') || '<tr><td colspan="5" style="text-align:center;padding:28px;color:var(--ink-60)">No branch products found.</td></tr>';

  // Printing Products
  const printProducts = s.printProducts || [];
  const totalPrintVariants = printProducts.reduce((a, p) => a + (p.variants ? p.variants.length : 0), 0);
  const printRows = printProducts.map(function (p) {
    const prices = (p.variants || []).map(function (v) { return v.price; });
    const min = prices.length ? Math.min.apply(null, prices) : 0;
    const max = prices.length ? Math.max.apply(null, prices) : 0;
    const varCount = p.variants ? p.variants.length : 0;
    return '<tr>' +
      '<td><strong>' + p.name + '</strong><div style="font-size:12px;color:var(--ink-60)">' + (p.desc || '') + '</div></td>' +
      '<td>' + varCount + ' variant' + (varCount !== 1 ? 's' : '') + '</td>' +
      '<td class="td-mono">\u20b1' + fmt(min) + (min !== max ? ' \u2013 \u20b1' + fmt(max) : '') + '</td>' +
      '<td>' + (p.active ? '<span class="badge badge-success">Active</span>' : '<span class="badge badge-neutral">Inactive</span>') + '</td>' +
      '<td>' +
      '<button class="btn btn-sm btn-outline" onclick="editPrintProductModal(\'' + p.id + '\')">Edit</button> ' +
      '<button class="btn btn-sm btn-icon" onclick="togglePrintProduct(\'' + p.id + '\')" title="' + (p.active ? 'Deactivate' : 'Activate') + '">' + (p.active ? iconSvg('lock') : iconSvg('lockOpen')) + '</button> ' +
      '<button class="btn btn-sm btn-icon" onclick="deletePrintProduct(\'' + p.id + '\')" title="Delete">' + iconSvg('error') + '</button>' +
      '</td></tr>';
  }).join('') || '<tr><td colspan="5" style="text-align:center;padding:28px;color:var(--ink-60)">No printing materials found.</td></tr>';

  const isBranch = _pmTab !== 'print';

  const tabBar =
    '<div style="display:flex;gap:0;border-bottom:2px solid var(--ink-10);margin-bottom:20px">' +
    '<button onclick="switchPmTab(\'branch\')" style="padding:10px 22px;font-size:14px;font-weight:600;border:none;background:none;cursor:pointer;border-bottom:2px solid ' + (isBranch ? 'var(--maroon)' : 'transparent') + ';color:' + (isBranch ? 'var(--maroon)' : 'var(--ink-60)') + ';margin-bottom:-2px;transition:color .15s">Branch Products</button>' +
    '<button onclick="switchPmTab(\'print\')" style="padding:10px 22px;font-size:14px;font-weight:600;border:none;background:none;cursor:pointer;border-bottom:2px solid ' + (!isBranch ? 'var(--maroon)' : 'transparent') + ';color:' + (!isBranch ? 'var(--maroon)' : 'var(--ink-60)') + ';margin-bottom:-2px;transition:color .15s">Printing Products</button>' +
    '</div>';

  setPageHtml(page, navId,
    '<div class="page-header" style="display:flex;justify-content:space-between;align-items:flex-start">' +
    '<div><h1 class="page-title">' + (page === 'product-catalog' ? 'Product Catalog' : 'Product Management') + '</h1><p class="page-subtitle">' +
    (isBranch ? products.length + ' branch products \u00b7 ' + totalVariants + ' variants' : printProducts.length + ' printing materials \u00b7 ' + totalPrintVariants + ' variants') +
    '</p></div>' +
    (isBranch
      ? '<button class="btn btn-maroon" onclick="addProductModal()">+ Add Branch Product</button>'
      : '<button class="btn btn-maroon" onclick="addPrintProductModal()">+ Add Printing Material</button>') +
    '</div>' +
    tabBar +
    '<div class="data-card"><div class="data-card-body no-pad">' +
    '<table class="data-table"><thead><tr><th>' + (isBranch ? 'Product' : 'Material') + '</th><th>Variants</th><th>Price Range</th><th>Status</th><th>Actions</th></tr></thead>' +
    '<tbody>' + (isBranch ? branchRows : printRows) + '</tbody></table>' +
    '</div></div>'
  );
}

// Printing Product CRUD
function addPrintProductModal() {
  const _errSvg = iconSvg('error');
  const _varRow = '<div class="product-form-variant-row" style="grid-template-columns:1.2fr 0.8fr 0.8fr 0.7fr 0.8fr 0.7fr auto">'
    + '<input class="form-control vn-name" placeholder="Variant name">'
    + '<input class="form-control vn-size" placeholder="Size">'
    + '<input class="form-control vn-color" placeholder="Color name">'
    + '<input class="form-control vn-colorhex" placeholder="#000000" style="font-family:monospace">'
    + '<input class="form-control vn-sku" placeholder="SKU">'
    + '<input class="form-control vn-price" type="number" placeholder="Unit Cost">'
    + '<button class="btn-icon" onclick="this.closest(&quot;.product-form-variant-row&quot;).remove()">' + _errSvg + '</button>'
    + '</div>';
  showModal(
    '<div class="modal-header"><h2>Add Printing Material</h2><button class="btn-close-modal" onclick="closeModal()">&#x2715;</button></div>'
    + '<div class="modal-body">'
    + '<div class="form-group"><label>Material Type</label><input id="pnp-type" class="form-control" placeholder="e.g. Ink, Paper, Plate, Substrate"></div>'
    + '<div class="form-group"><label>Material Name</label><input id="pnp-name" class="form-control" placeholder="e.g. Kraft Paper Roll, UV Ink"></div>'
    + '<div class="form-group"><label>Description</label><input id="pnp-desc" class="form-control" placeholder="Short description..."></div>'
    + '<hr class="divider">'
    + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><strong style="font-size:14px">Variants</strong><button class="btn btn-sm btn-outline" onclick="addPrintVariantRow()">+ Add Variant</button></div>'
    + '<div style="font-size:11px;color:var(--ink-50);margin-bottom:10px">Name &middot; Size &middot; Color &middot; Color Hex &middot; SKU &middot; Unit Cost</div>'
    + '<div id="print-variant-rows">' + _varRow + '</div>'
    + '</div>'
    + '<div class="modal-footer"><button class="btn btn-outline" onclick="closeModal()">Cancel</button><button class="btn btn-maroon" onclick="confirmAddPrintProduct()">Add Material</button></div>',
    'modal-xl');
}

function addPrintVariantRow() {
  const html = `<div class="product-form-variant-row" style="grid-template-columns:1.2fr 0.8fr 0.8fr 0.7fr 0.8fr 0.7fr auto"><input class="form-control vn-name" placeholder="Variant name"><input class="form-control vn-size" placeholder="Size"><input class="form-control vn-color" placeholder="Color name"><input class="form-control vn-colorhex" placeholder="#000000" style="font-family:monospace"><input class="form-control vn-sku" placeholder="SKU"><input class="form-control vn-price" type="number" placeholder="Unit Cost"><button class="btn-icon" onclick="this.closest('.product-form-variant-row').remove()">${iconSvg('error')}</button></div>`;
  document.getElementById('print-variant-rows').insertAdjacentHTML('beforeend', html);
}

function confirmAddPrintProduct() {
  const name = document.getElementById('pnp-name').value.trim();
  const desc = document.getElementById('pnp-desc').value.trim();
  if (!name) { showToast('Material name required', 'error'); return; }
  const variants = [];
  document.querySelectorAll('#print-variant-rows .product-form-variant-row').forEach(row => {
    const vname = row.querySelector('.vn-name').value.trim();
    const size = (row.querySelector('.vn-size')?.value || '').trim();
    const color = (row.querySelector('.vn-color')?.value || '').trim();
    const colorHex = (row.querySelector('.vn-colorhex')?.value || '').trim();
    const sku = row.querySelector('.vn-sku').value.trim();
    const price = parseFloat(row.querySelector('.vn-price').value) || 0;
    if (vname) variants.push({ name: vname, size, color, colorHex, sku, price });
  });
  if (!variants.length) { showToast('At least one variant required', 'error'); return; }
  const materialType = (document.getElementById('pnp-type')?.value || '').trim();
  const s = getState();
  s.printProducts = s.printProducts || [];
  const newProduct = {
    id: 'pmat_' + Date.now(),
    name, desc, materialType, active: true,
    variants: variants.map(v => ({
      id: 'pvar_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      name: v.name, size: v.size, color: v.color, colorHex: v.colorHex, sku: v.sku, price: v.price, stock: 0, reorderLevel: 20
    }))
  };
  s.printProducts.push(newProduct);
  saveState(s);
  DB.savePrintProduct(newProduct).catch(function (e) { console.error('[DB] savePrintProduct:', e.message); });
  closeModal();
  showToast('Printing material added!', 'success');
  _pmTab = 'print';
  _renderProductMgmtPage();
}
function editPrintProductModal(pid) {
  const s = getState();
  const p = (s.printProducts || []).find(x => x.id === pid);
  if (!p) return;
  const errSvg = iconSvg('error');
  const varRows = p.variants.map(v =>
    '<div class="product-form-variant-row" data-vid="' + v.id + '" style="grid-template-columns:1.2fr 0.8fr 0.8fr 0.7fr 0.8fr 0.6fr 0.5fr auto;gap:8px;margin-bottom:8px">'
    + '<input class="form-control vn-name" value="' + (v.name || '').replace(/"/g, '&quot;') + '" placeholder="Variant name">'
    + '<input class="form-control vn-size" value="' + (v.size || '').replace(/"/g, '&quot;') + '" placeholder="Size">'
    + '<input class="form-control vn-color" value="' + (v.color || '').replace(/"/g, '&quot;') + '" placeholder="Color name">'
    + '<input class="form-control vn-colorhex" value="' + (v.colorHex || '').replace(/"/g, '&quot;') + '" placeholder="#000000" style="font-family:monospace">'
    + '<input class="form-control vn-sku" value="' + (v.sku || '').replace(/"/g, '&quot;') + '" placeholder="SKU">'
    + '<input class="form-control vn-price" type="number" value="' + (v.price || 0) + '" placeholder="Unit Cost">'
    + '<input class="form-control vn-stock" type="number" value="' + (v.stock || 0) + '" placeholder="Stock">'
    + '<button class="btn-icon" style="color:var(--danger)" onclick="this.closest(\'.product-form-variant-row\').remove()" title="Remove variant">' + errSvg + '</button>'
    + '</div>'
  ).join('');
  showModal(
    '<div class="modal-header"><h2>Edit Printing Material</h2><button class="btn-close-modal" onclick="closeModal()">&#x2715;</button></div>'
    + '<div class="modal-body">'
    + '<div class="form-group"><label>Material Type</label><input id="pep-type" class="form-control" value="' + (p.materialType || '').replace(/"/g, '&quot;') + '" placeholder="e.g. Ink, Paper, Plate"></div>'
    + '<div class="form-group"><label>Material Name</label><input id="pep-name" class="form-control" value="' + p.name.replace(/"/g, '&quot;') + '"></div>'
    + '<div class="form-group"><label>Description</label><input id="pep-desc" class="form-control" value="' + (p.desc || '').replace(/"/g, '&quot;') + '"></div>'
    + '<hr class="divider">'
    + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><strong style="font-size:14px">Variants</strong><button class="btn btn-sm btn-outline" onclick="addPrintEditVariantRow()">+ Add Variant</button></div>'
    + '<div style="font-size:11px;color:var(--ink-50);margin-bottom:10px">Name &middot; Size &middot; Color &middot; Color Hex &middot; SKU &middot; Unit Cost &middot; Stock</div>'
    + '<div id="pep-variant-rows">' + varRows + '</div>'
    + '</div>'
    + '<div class="modal-footer"><button class="btn btn-outline" onclick="closeModal()">Cancel</button><button class="btn btn-maroon" onclick="confirmEditPrintProduct(&quot;' + pid + '&quot;)">Save</button></div>',
    'modal-xl'
  );
}

function addPrintEditVariantRow() {
  const html = `<div class="product-form-variant-row" style="grid-template-columns:1.2fr 0.8fr 0.8fr 0.7fr 0.8fr 0.6fr 0.5fr auto;gap:8px;margin-bottom:8px">
    <input class="form-control vn-name" placeholder="Variant name">
    <input class="form-control vn-size" placeholder="Size">
    <input class="form-control vn-color" placeholder="Color name">
    <input class="form-control vn-colorhex" placeholder="#000000" style="font-family:monospace">
    <input class="form-control vn-sku" placeholder="SKU">
    <input class="form-control vn-price" type="number" placeholder="Unit Cost">
    <input class="form-control vn-stock" type="number" placeholder="Stock">
    <button class="btn-icon" style="color:var(--danger)" onclick="this.closest('.product-form-variant-row').remove()" title="Remove variant">${iconSvg('error')}</button>
  </div>`;
  document.getElementById('pep-variant-rows').insertAdjacentHTML('beforeend', html);
}


function confirmEditPrintProduct(pid) {
  const name = document.getElementById('pep-name').value.trim();
  const desc = document.getElementById('pep-desc').value.trim();
  const variants = [];
  document.querySelectorAll('#pep-variant-rows .product-form-variant-row').forEach(row => {
    const vname = row.querySelector('.vn-name').value.trim();
    const size = (row.querySelector('.vn-size')?.value || '').trim();
    const color = (row.querySelector('.vn-color')?.value || '').trim();
    const colorHex = (row.querySelector('.vn-colorhex')?.value || '').trim();
    const sku = row.querySelector('.vn-sku').value.trim();
    const price = parseFloat(row.querySelector('.vn-price').value) || 0;
    const stock = parseInt(row.querySelector('.vn-stock').value) || 0;
    const vid = row.getAttribute('data-vid');
    if (vname) variants.push({ id: vid, name: vname, size, color, colorHex, sku, price, stock });
  });
  const s = getState();
  const p = (s.printProducts || []).find(x => x.id === pid);
  if (!p) return;
  p.name = name; p.desc = desc;
  p.materialType = (document.getElementById('pep-type')?.value || '').trim();
  p.variants = variants.map(v => {
    const existing = p.variants.find(ev => ev.id === v.id) || {};
    return { ...existing, id: v.id || ('pvar_' + Date.now()), name: v.name, size: v.size, color: v.color, colorHex: v.colorHex, sku: v.sku, price: v.price, stock: v.stock };
  });
  saveState(s);
  DB.updatePrintProduct(pid, { name: p.name, desc: p.desc, materialType: p.materialType, variants: p.variants }).catch(function (e) { console.error('[DB] updatePrintProduct:', e.message); });
  closeModal();
  showToast('Printing material updated!', 'success');
  _pmTab = 'print';
  _renderProductMgmtPage();
}

function togglePrintProduct(pid) {
  const s = getState();
  const p = (s.printProducts || []).find(x => x.id === pid);
  if (p) { p.active = !p.active; saveState(s); DB.updatePrintProduct(pid, { active: p.active }).catch(function () { }); showToast(`Material ${p.active ? 'activated' : 'deactivated'}.`, 'success'); _pmTab = 'print'; _renderProductMgmtPage(); }
}

function deletePrintProduct(pid) {
  const s = getState();
  const prod = (s.printProducts || []).find(p => p.id === pid);
  const prodName = prod ? (prod.name || 'this printing material') : 'this printing material';
  confirmModal({
    title: 'Delete Printing Material',
    message: `Are you sure you want to delete <strong>${prodName}</strong>? This action cannot be undone.`,
    confirmText: 'Delete Material',
    icon: '🗑️',
    onConfirm: function () {
      const s2 = getState();
      s2.printProducts = (s2.printProducts || []).filter(p => p.id !== pid);
      saveState(s2);
      DB.deletePrintProduct(pid).catch(function () { });
      showToast('Printing material deleted!', 'success');
      _pmTab = 'print';
      _renderProductMgmtPage();
    }
  });
}


function addProductModal() {
  const suggestions = getDefaultPosProducts();
  window._pmSuggestions = suggestions;

  const suggestOpts = _buildSuggestOpts(suggestions);

  showModal(`<div class="modal-header"><h2>Add Product</h2><button class="btn-close-modal" onclick="closeModal()">✕</button></div>
    <div class="modal-body">
      <div class="form-group" style="margin-bottom:8px">
        <label>Quick-fill from Catalog</label>
        <div style="position:relative" id="np-suggest-wrap">
          <input id="np-suggest-input" class="form-control" placeholder="Search catalog suggestions…" autocomplete="off"
            oninput="filterProductSuggestions(this.value)"
            onfocus="document.getElementById('np-suggest-list').style.display='block'">
          <div id="np-suggest-list" class="product-suggest-list" style="display:none">${suggestOpts}</div>
        </div>
        <div class="text-xs text-muted" style="margin-top:4px">Select a suggestion to auto-fill, or fill in manually below.</div>
      </div>
      <hr class="divider">
      <div class="form-group"><label>Product Type</label><input id="np-type" class="form-control" placeholder="e.g. Cup, Box, Bag, Wrap"></div>
      <div class="form-group"><label>Product Name</label><input id="np-name" class="form-control" placeholder="e.g. Ripple Wall Cup (25s)"></div>
      <div class="form-group"><label>Description</label><input id="np-desc" class="form-control" placeholder="Short description..."></div>
      <hr class="divider">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px"><strong style="font-size:14px">Variants</strong><button class="btn btn-sm btn-outline" onclick="addVariantRow()">+ Add Variant</button></div>
      <div id="variant-rows">${_buildVariantRow()}</div>
    </div>
    <div class="modal-footer"><button class="btn btn-outline" onclick="closeModal()">Cancel</button><button class="btn btn-maroon" onclick="confirmAddProduct()">Add Product</button></div>`, 'modal-lg');

  // Close dropdown when clicking outside the suggest wrap
  setTimeout(() => {
    document.addEventListener('mousedown', _pmSuggestOutsideClick);
  }, 0);
}

function _buildVariantRow(variantName, size, sku, price) {
  const s = getState();
  const branchInputs = (s.branches || []).map(b =>
    `<div class="vn-branch-stock-row">
      <span class="vn-branch-label">${b.name}</span>
      <input type="number" class="form-control vn-branch-qty" data-branch="${b.id}" placeholder="0" min="0">
    </div>`
  ).join('');
  const branchSection = (s.branches || []).length
    ? `<div class="vn-branch-stocks">
        <div class="vn-branch-stocks-label">Initial Stock per Branch</div>
        ${branchInputs}
      </div>`
    : '';
  return `<div class="product-form-variant-row-wrap">
    <div class="product-form-variant-row">
      <input class="form-control vn-name" placeholder="Variant name (e.g. 8oz)" value="${variantName || ''}">
      <input class="form-control vn-size" placeholder="Size (e.g. 12oz)" value="${size || ''}">
      <input class="form-control vn-sku" placeholder="SKU" value="${sku || ''}">
      <input class="form-control vn-price" type="number" placeholder="Price" value="${price || ''}">
      <button class="btn-icon" onclick="this.closest('.product-form-variant-row-wrap').remove()">${iconSvg('error')}</button>
    </div>
    ${branchSection}
  </div>`;
}

function _buildSuggestOpts(suggestions) {
  return suggestions.map(p =>
    `<div class="product-suggest-item" onmousedown="event.preventDefault();applyProductSuggestion('${p.id}')">
      <span style="font-weight:600">${p.name}</span>
      ${p.type ? `<span class="badge badge-outline" style="font-size:10px;margin-left:6px;vertical-align:middle">${p.type}</span>` : ''}
      ${p.desc ? `<span class="text-xs text-muted" style="margin-left:6px">${p.desc}</span>` : ''}
    </div>`
  ).join('');
}

function _pmSuggestOutsideClick(e) {
  const wrap = document.getElementById('np-suggest-wrap');
  if (!wrap) { document.removeEventListener('mousedown', _pmSuggestOutsideClick); return; }
  if (!wrap.contains(e.target)) {
    const list = document.getElementById('np-suggest-list');
    if (list) list.style.display = 'none';
  }
}

function filterProductSuggestions(query) {
  const list = document.getElementById('np-suggest-list');
  if (!list) return;
  const q = query.trim().toLowerCase();
  const suggestions = window._pmSuggestions || getDefaultPosProducts();
  const filtered = q ? suggestions.filter(p => p.name.toLowerCase().includes(q)) : suggestions;
  list.innerHTML = filtered.length
    ? _buildSuggestOpts(filtered)
    : '<div class="product-suggest-item" style="color:var(--ink-40);cursor:default">No matches found</div>';
  list.style.display = 'block';
}

function applyProductSuggestion(pid) {
  const suggestions = window._pmSuggestions || getDefaultPosProducts();
  const p = suggestions.find(x => x.id === pid);
  if (!p) return;

  document.getElementById('np-name').value = p.name;
  document.getElementById('np-desc').value = p.desc || '';
  document.getElementById('np-suggest-input').value = p.name;
  // Fill Product Type from catalog entry
  const typeEl = document.getElementById('np-type');
  if (typeEl && p.type) typeEl.value = p.type;

  const list = document.getElementById('np-suggest-list');
  if (list) list.style.display = 'none';
  document.removeEventListener('mousedown', _pmSuggestOutsideClick);

  // Fill variant rows — carry name, size, sku, price
  const container = document.getElementById('variant-rows');
  container.innerHTML = '';
  p.variants.forEach(v => {
    const sku = buildVariantSku(p.name, v.name, Math.floor(Math.random() * 9000 + 1000));
    container.insertAdjacentHTML('beforeend', _buildVariantRow(v.name, v.size || '', sku, v.price));
  });
  applySvgToElement(container);
}

function addVariantRow() {
  const html = _buildVariantRow('', '', '', '');
  document.getElementById('variant-rows').insertAdjacentHTML('beforeend', html);
  applySvgToElement(document.getElementById('variant-rows'));
}

function confirmAddProduct() {
  const name = document.getElementById('np-name').value.trim();
  const desc = document.getElementById('np-desc').value.trim();
  const productType = (document.getElementById('np-type')?.value || '').trim();
  if (!name) { showToast('Product name required', 'error'); return; }
  const variants = [];
  document.querySelectorAll('.product-form-variant-row-wrap').forEach(wrap => {
    const vname = wrap.querySelector('.vn-name').value.trim();
    const size = (wrap.querySelector('.vn-size')?.value || '').trim();
    const sku = wrap.querySelector('.vn-sku').value.trim();
    const price = parseFloat(wrap.querySelector('.vn-price').value) || 0;
    if (!vname) return;
    const branchStocks = {};
    wrap.querySelectorAll('.vn-branch-qty').forEach(input => {
      branchStocks[input.dataset.branch] = Math.max(0, parseInt(input.value) || 0);
    });
    const totalStock = Object.values(branchStocks).reduce((sum, q) => sum + q, 0);
    variants.push({ name: vname, size, sku, price, branchStocks, stock: totalStock });
  });
  if (!variants.length) { showToast('At least one variant required', 'error'); return; }
  const s = getState();
  const newProduct = {
    id: 'prod_' + Date.now(),
    name, desc, productType, active: true,
    variants: variants.map(v => ({
      id: 'var_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      name: v.name, size: v.size, sku: v.sku, price: v.price,
      stock: v.stock,
      reorderLevel: 20, maxStock: 60, reserved: 0,
      branchStocks: v.branchStocks,
      lastCountDate: new Date().toISOString(),
    }))
  };
  s.products.push(newProduct);
  saveState(s);
  DB.saveProduct(newProduct);
  closeModal();
  showToast('Product added!', 'success');
  renderProductMgmt();
}

function toggleProduct(pid) {
  const s = getState();
  const p = s.products.find(x => x.id === pid);
  if (p) { p.active = !p.active; saveState(s); DB.updateProduct(p.id, { active: p.active }); renderProductMgmt(); showToast(`Product ${p.active ? 'activated' : 'deactivated'}.`, 'success'); }
}

function editProductModal(pid) {
  const s = getState();
  const p = s.products.find(x => x.id === pid);
  if (!p) return;
  const errSvg = iconSvg('error');
  showModal(`<div class="modal-header"><h2>Edit Product</h2><button class="btn-close-modal" onclick="closeModal()">✕</button></div>
    <div class="modal-body">
      <div class="form-group"><label>Product Type</label><input id="ep-type" class="form-control" value="${p.productType || ''}" placeholder="e.g. Cup, Box, Bag"></div>
      <div class="form-group"><label>Product Name</label><input id="ep-name" class="form-control" value="${p.name.replace(/"/g, '&quot;')}"></div>
      <div class="form-group"><label>Description</label><input id="ep-desc" class="form-control" value="${(p.desc || '').replace(/"/g, '&quot;')}"></div>
      <hr class="divider">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <strong style="font-size:14px">Variants</strong>
        <button class="btn btn-sm btn-outline" onclick="addEditVariantRow()">+ Add Variant</button>
      </div>
      <div style="font-size:11px;color:var(--ink-50);margin-bottom:10px">Name · Size · SKU · Price · Stock</div>
      <div id="ep-variant-rows">${p.variants.map(v => `<div class="product-form-variant-row" data-vid="${v.id}" style="grid-template-columns:1.4fr 100px 100px 90px 80px auto;gap:8px;margin-bottom:8px">
        <input class="form-control vn-name" value="${v.name.replace(/"/g, '&quot;')}" placeholder="Variant name">
        <input class="form-control vn-size" value="${(v.size || '').replace(/"/g, '&quot;')}" placeholder="Size">
        <input class="form-control vn-sku" value="${(v.sku || '').replace(/"/g, '&quot;')}" placeholder="SKU">
        <input class="form-control vn-price" type="number" value="${v.price}" placeholder="Price">
        <input class="form-control vn-stock" type="number" value="${v.stock}" placeholder="Stock">
        <button class="btn-icon" style="color:var(--danger)" onclick="this.closest('.product-form-variant-row').remove()" title="Remove variant">${errSvg}</button>
      </div>`).join('')}</div>
    </div>
    <div class="modal-footer"><button class="btn btn-outline" onclick="closeModal()">Cancel</button><button class="btn btn-maroon" onclick="confirmEditProduct('${pid}')">Save Changes</button></div>`, 'modal-lg');
}

function confirmEditProduct(pid) {
  const name = document.getElementById('ep-name').value.trim();
  const desc = document.getElementById('ep-desc').value.trim();
  const variants = [];
  document.querySelectorAll('#ep-variant-rows .product-form-variant-row').forEach(row => {
    const vname = row.querySelector('.vn-name').value.trim();
    const size = (row.querySelector('.vn-size')?.value || '').trim();
    const sku = row.querySelector('.vn-sku').value.trim();
    const price = parseFloat(row.querySelector('.vn-price').value) || 0;
    const stock = parseInt(row.querySelector('.vn-stock').value) || 0;
    const vid = row.getAttribute('data-vid');
    if (vname) variants.push({ id: vid, name: vname, size, sku, price, stock });
  });
  const s = getState();
  const p = s.products.find(x => x.id === pid);
  if (!p) return;
  p.name = name;
  p.desc = desc;
  p.productType = (document.getElementById('ep-type')?.value || '').trim();
  p.variants = variants.map(v => {
    const existing = p.variants.find(ev => ev.id === v.id) || {};
    return { ...existing, id: v.id || ('var_' + Date.now()), name: v.name, size: v.size, sku: v.sku, price: v.price, stock: v.stock };
  });
  saveState(s);
  DB.updateProduct(pid, { name: p.name, desc: p.desc, variants: p.variants });
  closeModal();
  showToast('Product updated!', 'success');
  renderProductMgmt();
}

function addEditVariantRow() {
  const html = `<div class="product-form-variant-row" style="grid-template-columns:1.4fr 100px 100px 90px 80px auto;gap:8px;margin-bottom:8px">
    <input class="form-control vn-name" placeholder="Variant name">
    <input class="form-control vn-size" placeholder="Size (e.g. 8oz)">
    <input class="form-control vn-sku" placeholder="SKU">
    <input class="form-control vn-price" type="number" placeholder="Price">
    <input class="form-control vn-stock" type="number" placeholder="Stock">
    <button class="btn-icon" style="color:var(--danger)" onclick="this.closest('.product-form-variant-row').remove()" title="Remove variant">${iconSvg('error')}</button>
  </div>`;
  document.getElementById('ep-variant-rows').insertAdjacentHTML('beforeend', html);
}

// INVENTORY
var _invFilter = { search: '', status: 'all', branch: null };
function clearInvFilter() { _invFilter = { search: '', status: 'all', branch: null }; _renderInventoryPage(); }

function renderInventory() {
  _invFilter = { search: '', status: 'all', branch: null };
  _renderInventoryPage();
}

function _renderInventoryPage() {
  const s = getState();
  const isAdmin = s.currentUser && s.currentUser.role === 'admin';
  const u = s.currentUser;

  // Admin can filter by branch; staff always sees only their own branch
  const viewBranchId = isAdmin ? (_invFilter.branch || null) : (u?.branchId || s.branches[0]?.id || null);

  const allVariants = s.products.filter(p => p.active).flatMap(p =>
    (p.variants || []).map(v => ({ p, v, reorderLevel: v.reorderLevel ?? 20 }))
  );

  const stockFor = (v) => {
    if (viewBranchId) return (v.branchStocks || {})[viewBranchId] ?? 0;
    return v.stock || 0;
  };

  const totalVariants = allVariants.length;
  const lowStockCount = allVariants.filter(({ v, reorderLevel }) => { const st = stockFor(v); return st > 0 && st <= reorderLevel; }).length;
  const outOfStockCount = allVariants.filter(({ v }) => stockFor(v) === 0).length;
  const healthyCount = totalVariants - lowStockCount - outOfStockCount;

  const q = (_invFilter.search || '').toLowerCase();
  const filtered = allVariants.filter(({ p, v, reorderLevel }) => {
    const matchSearch = !q ||
      p.name.toLowerCase().includes(q) ||
      (p.productType || '').toLowerCase().includes(q) ||
      v.name.toLowerCase().includes(q) ||
      (v.size || '').toLowerCase().includes(q) ||
      (v.sku || '').toLowerCase().includes(q);
    const st = stockFor(v);
    const lvl = st === 0 ? 'out' : st <= reorderLevel ? 'low' : 'ok';
    const matchStatus =
      _invFilter.status === 'all' ? true :
        _invFilter.status === 'low' ? lvl === 'low' :
          _invFilter.status === 'out' ? lvl === 'out' :
            _invFilter.status === 'ok' ? lvl === 'ok' : true;
    return matchSearch && matchStatus;
  });

  const showBranchCols = isAdmin && !viewBranchId;
  const branchLabel = viewBranchId ? (s.branches.find(b => b.id === viewBranchId)?.name || viewBranchId) : 'All Branches';
  const inventoryRequests = (s.branchInventoryRequests || []).filter(req => isAdmin || req.branchId === u?.branchId);
  const pendingRequests = inventoryRequests.filter(req => req.status === 'pending');
  const requestPanel = isAdmin
    ? `<div class="data-card" style="margin-bottom:18px"><div class="data-card-header"><span class="data-card-title">Branch Inventory Requests</span><span class="badge badge-warning">${pendingRequests.length} pending</span></div><div class="data-card-body no-pad"><table class="data-table"><thead><tr><th>Requested</th><th>Branch</th><th>Item</th><th>Qty</th><th>Requested By</th><th>Status</th><th>Action</th></tr></thead><tbody>${inventoryRequests.length ? [...inventoryRequests].reverse().map(req => { const branch = s.branches.find(b => b.id === req.branchId); return `<tr><td class="td-mono">${fmtTime(req.createdAt)}</td><td>${branch?.name || req.branchId || '—'}</td><td>${req.itemName || '—'}</td><td class="td-mono">${req.qty || 0}</td><td>${req.requestedByName || '—'}</td><td><span class="badge ${req.status === 'approved' ? 'badge-success' : req.status === 'rejected' ? 'badge-danger' : 'badge-warning'}">${req.status || 'pending'}</span></td><td>${req.status === 'pending' ? `<button class="btn btn-sm btn-maroon" onclick="approveInventoryRequest('${req.id}')">Approve</button> <button class="btn btn-sm btn-danger" onclick="rejectInventoryRequest('${req.id}')">Reject</button>` : '—'}</td></tr>`; }).join('') : '<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--ink-60)">No branch inventory requests yet.</td></tr>'}</tbody></table></div></div>`
    : `<div class="data-card" style="margin-bottom:18px"><div class="data-card-header"><span class="data-card-title">Branch Request Queue</span><button class="btn btn-sm btn-maroon" onclick="openInventoryRequestModal()">+ Request Inventory</button></div><div class="data-card-body no-pad"><table class="data-table"><thead><tr><th>Requested</th><th>Item</th><th>Qty</th><th>Status</th><th>Reviewed</th></tr></thead><tbody>${inventoryRequests.length ? [...inventoryRequests].reverse().map(req => `<tr><td class="td-mono">${fmtTime(req.createdAt)}</td><td>${req.itemName || '—'}</td><td class="td-mono">${req.qty || 0}</td><td><span class="badge ${req.status === 'approved' ? 'badge-success' : req.status === 'rejected' ? 'badge-danger' : 'badge-warning'}">${req.status || 'pending'}</span></td><td>${req.reviewedAt ? fmtTime(req.reviewedAt) : '—'}</td></tr>`).join('') : '<tr><td colspan="5" style="text-align:center;padding:24px;color:var(--ink-60)">No requests submitted yet.</td></tr>'}</tbody></table></div></div>`;

  const branchSelector = isAdmin ? `
    <select class="form-control" style="width:auto" onchange="_invFilter.branch=this.value||null;_renderInventoryPage()">
      <option value="">All Branches (Combined)</option>
      ${s.branches.map(b => `<option value="${b.id}" ${_invFilter.branch === b.id ? 'selected' : ''}>${b.name}</option>`).join('')}
    </select>` : '';

  const colCount = showBranchCols ? 6 + s.branches.length : 8;

  document.getElementById('page-content').innerHTML = `
    <div class="page-header" style="display:flex;justify-content:space-between;align-items:flex-start">
      <div><h1 class="page-title">Branch Inventory</h1><p class="page-subtitle">${isAdmin ? 'Consolidate requests and monitor full inventory - ' + branchLabel : 'Manage your branch stock and submit requests to Main Admin - ' + branchLabel}</p></div>
      ${isAdmin ? `<div style="display:flex;gap:8px"><button class="btn btn-maroon" onclick="addStockModal()">+ Add Stock</button></div>` : ''}
    </div>
    ${requestPanel}
    <div class="kpi-grid">
      <div class="kpi-card"><div class="kpi-header"><div class="kpi-label">Total Variants</div><div class="kpi-icon blue">${iconSvg('box')}</div></div><div class="kpi-value">${totalVariants}</div><div class="kpi-sub">${s.products.filter(p => p.active).length} active products</div></div>
      <div class="kpi-card"><div class="kpi-header"><div class="kpi-label">Healthy Stock</div><div class="kpi-icon green">${iconSvg('check')}</div></div><div class="kpi-value">${healthyCount}</div><div class="kpi-sub">Above reorder level</div></div>
      <div class="kpi-card" style="cursor:pointer" onclick="_invFilter.status='low';_renderInventoryPage()"><div class="kpi-header"><div class="kpi-label">Low Stock</div><div class="kpi-icon gold">${iconSvg('warning')}</div></div><div class="kpi-value" style="color:${lowStockCount > 0 ? 'var(--warning)' : 'inherit'}">${lowStockCount}</div><div class="kpi-sub">At or below reorder level</div></div>
      <div class="kpi-card" style="cursor:pointer" onclick="_invFilter.status='out';_renderInventoryPage()"><div class="kpi-header"><div class="kpi-label">Out of Stock</div><div class="kpi-icon maroon">${iconSvg('error')}</div></div><div class="kpi-value" style="color:${outOfStockCount > 0 ? 'var(--danger)' : 'inherit'}">${outOfStockCount}</div><div class="kpi-sub">Zero units remaining</div></div>
    </div>
    ${(lowStockCount + outOfStockCount) > 0 ? '<div class="alert alert-error-box">' + iconSvg('warning') + ' ' + (lowStockCount + outOfStockCount) + ' variant(s) need attention.</div>' : ''}
    <div class="data-card">
      <div class="data-card-header">
        <span class="data-card-title">Stock Levels</span>
        <span class="text-sm text-muted">${filtered.length} of ${totalVariants} variants</span>
      </div>
      <div class="data-card-body" style="padding:12px 16px;border-bottom:1px solid var(--ink-10);display:flex;gap:10px;flex-wrap:wrap;align-items:center">
        <input class="form-control" style="flex:1;min-width:180px;max-width:300px"
          placeholder="Search type, size, product..."
          value="${_invFilter.search}"
          oninput="_invFilter.search=this.value;_renderInventoryPage()">
        ${branchSelector}
        <select class="form-control" style="width:auto" onchange="_invFilter.status=this.value;_renderInventoryPage()">
          <option value="all" ${_invFilter.status === 'all' ? 'selected' : ''}>All Stock</option>
          <option value="ok"  ${_invFilter.status === 'ok' ? 'selected' : ''}>Healthy</option>
          <option value="low" ${_invFilter.status === 'low' ? 'selected' : ''}>Low Stock</option>
          <option value="out" ${_invFilter.status === 'out' ? 'selected' : ''}>Out of Stock</option>
        </select>
        ${_invFilter.search || _invFilter.status !== 'all' || _invFilter.branch ? '<button class="btn btn-sm btn-outline" onclick="clearInvFilter()">Clear</button>' : ''}
      </div>
      <div class="data-card-body no-pad">
        <table class="data-table">
          <thead><tr>
            <th>Product Type</th>
            <th>Size / Variant</th>
            ${showBranchCols
      ? s.branches.map(b => `<th style="text-align:center">${b.name}</th>`).join('')
      : '<th>Stock</th>'}
            <th>Reorder Pt.</th>
            <th>Max Stock</th>
            <th>Last Count</th>
            <th>Status</th>
            <th>Adjust</th>
          </tr></thead>
          <tbody>${filtered.length === 0 ? `
            <tr><td colspan="${colCount}" style="text-align:center;padding:32px;color:var(--ink-60)">
              ${_invFilter.search || _invFilter.status !== 'all' ? 'No variants match your search.' : 'No inventory data yet.'}
            </td></tr>` :
      filtered.map(({ p, v, reorderLevel }) => {
        const maxStock = v.maxStock ?? (reorderLevel * 3);
        const displayStock = stockFor(v);
        const stockColor = displayStock === 0 ? 'var(--danger)' : displayStock <= reorderLevel ? 'var(--warning)' : 'var(--success)';
        const statusBadge = displayStock === 0
          ? '<span class="badge badge-danger">Out of Stock</span>'
          : displayStock <= reorderLevel
            ? '<span class="badge badge-warning">Low Stock</span>'
            : '<span class="badge badge-success">Healthy</span>';
        const lastCount = v.lastCountDate
          ? new Date(v.lastCountDate).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })
          : '<span class="text-muted">\u2014</span>';
        const branchStockCols = showBranchCols
          ? s.branches.map(b => {
            const bSt = (v.branchStocks || {})[b.id] ?? 0;
            const bColor = bSt === 0 ? 'var(--danger)' : bSt <= reorderLevel ? 'var(--warning)' : 'var(--success)';
            return `<td class="td-mono" style="font-weight:700;color:${bColor};text-align:center">${bSt}</td>`;
          }).join('')
          : `<td class="td-mono" style="font-weight:700;color:${stockColor}">${displayStock}</td>`;
        const adjustBtn = isAdmin
          ? `<div style="display:flex;gap:6px;align-items:center"><button class="btn btn-sm btn-outline" onclick="adjustStockModal('${p.id}','${v.id}')">Adjust</button><button class="btn btn-sm btn-icon" title="Delete variant" onclick="deleteVariantFromInv('${p.id}','${v.id}')">${iconSvg('error')}</button></div>`
          : '<span class="badge badge-neutral">View Only</span>';
        return `<tr>
          <td><strong>${p.productType || p.name}</strong><div style="font-size:11px;color:var(--ink-50)">${p.name}</div></td>
          <td>${v.size || v.name}${v.sku ? '<div class="td-mono" style="font-size:11px;color:var(--ink-40)">' + v.sku + '</div>' : ''}</td>
          ${branchStockCols}
          <td class="td-mono">${reorderLevel}</td>
          <td class="td-mono">${maxStock}</td>
          <td class="td-mono" style="font-size:12px">${lastCount}</td>
          <td>${statusBadge}</td>
          <td>${adjustBtn}</td>
        </tr>`;
      }).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
}

function adjustStockModal(pid, vid) {
  const s = getState();
  if (!s.currentUser || normalizeRole(s.currentUser.role) !== 'admin') { showToast('Only Administrators can adjust stock.', 'error'); return; }
  const p = s.products.find(x => x.id === pid);
  const v = p?.variants.find(x => x.id === vid);
  if (!v) return;
  const maxStock = v.maxStock ?? ((v.reorderLevel ?? 20) * 3);

  const branchRows = s.branches.map(b => {
    const bSt = (v.branchStocks || {})[b.id] ?? 0;
    return `<div style="display:grid;grid-template-columns:1fr 100px 100px 100px;gap:8px;align-items:center;padding:8px 0;border-bottom:1px solid var(--ink-10)">
      <span style="font-weight:600;font-size:13px">${b.name}</span>
      <span class="td-mono" style="font-size:13px;color:${bSt === 0 ? 'var(--danger)' : bSt <= (v.reorderLevel ?? 20) ? 'var(--warning)' : 'var(--success)'}">${bSt} units</span>
      <select class="form-control adj-type-${b.id}" style="font-size:12px;padding:6px 8px">
        <option value="add">Add (+)</option>
        <option value="remove">Remove (−)</option>
        <option value="set">Set exact</option>
      </select>
      <input type="number" class="form-control adj-qty-${b.id}" placeholder="0" min="0" style="font-size:13px">
    </div>`;
  }).join('');

  showModal(`<div class="modal-header"><h2>Adjust Stock — ${p.productType || p.name} · ${v.size || v.name}</h2><button class="btn-close-modal" onclick="closeModal()">✕</button></div>
    <div class="modal-body">
      <div class="alert alert-info" style="margin-bottom:16px">Adjust stock per branch independently. Leave quantity blank to skip that branch.</div>
      <div style="display:grid;grid-template-columns:1fr 100px 100px 100px;gap:8px;align-items:center;padding:6px 0;margin-bottom:4px">
        <span style="font-size:11px;font-weight:700;text-transform:uppercase;color:var(--ink-60)">Branch</span>
        <span style="font-size:11px;font-weight:700;text-transform:uppercase;color:var(--ink-60)">Current</span>
        <span style="font-size:11px;font-weight:700;text-transform:uppercase;color:var(--ink-60)">Action</span>
        <span style="font-size:11px;font-weight:700;text-transform:uppercase;color:var(--ink-60)">Qty</span>
      </div>
      ${branchRows}
      <hr class="divider">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:4px">
        <div class="form-group"><label>Reorder Point</label><input type="number" id="adj-reorder" class="form-control" value="${v.reorderLevel ?? 20}" min="1"></div>
        <div class="form-group"><label>Max Stock</label><input type="number" id="adj-maxstock" class="form-control" value="${maxStock}" min="1"></div>
      </div>
    </div>
    <div class="modal-footer"><button class="btn btn-outline" onclick="closeModal()">Cancel</button><button class="btn btn-maroon" onclick="confirmAdjustStock('${pid}','${vid}')">Apply</button></div>`, 'modal-lg');
}

function confirmAdjustStock(pid, vid) {
  const s = getState();
  if (!s.currentUser || normalizeRole(s.currentUser.role) !== 'admin') { showToast('Only Administrators can adjust stock.', 'error'); return; }
  const reorderLevel = Math.max(1, parseInt(document.getElementById('adj-reorder').value) || 20);
  const maxStock = Math.max(1, parseInt(document.getElementById('adj-maxstock').value) || reorderLevel * 3);
  const prod = s.products.find(x => x.id === pid);
  const variant = prod?.variants.find(x => x.id === vid);
  if (!variant) { showToast('Variant not found.', 'error'); return; }

  variant.branchStocks = variant.branchStocks || {};
  let anyChange = false;
  s.branches.forEach(b => {
    const typeEl = document.querySelector(`.adj-type-${b.id}`);
    const qtyEl = document.querySelector(`.adj-qty-${b.id}`);
    if (!typeEl || !qtyEl || qtyEl.value === '') return;
    const qty = parseInt(qtyEl.value) || 0;
    const type = typeEl.value;
    const cur = variant.branchStocks[b.id] ?? 0;
    if (type === 'add') variant.branchStocks[b.id] = cur + qty;
    else if (type === 'remove') variant.branchStocks[b.id] = Math.max(0, cur - qty);
    else if (type === 'set') variant.branchStocks[b.id] = Math.max(0, qty);
    anyChange = true;
  });

  if (!anyChange) { showToast('No quantities entered.', 'warning'); return; }

  // Recalculate total stock from branch stocks
  variant.stock = Object.values(variant.branchStocks).reduce((sum, q) => sum + (parseInt(q) || 0), 0);
  variant.reorderLevel = reorderLevel;
  variant.maxStock = maxStock;
  variant.lastCountDate = new Date().toISOString();

  saveState(s);
  DB.updateProduct(pid, { name: prod.name, desc: prod.desc, variants: prod.variants });
  closeModal();
  showToast('Stock updated per branch.', 'success');
  renderInventory();
}

function deleteVariantFromInv(pid, vid) {
  const s = getState();
  if (!s.currentUser || normalizeRole(s.currentUser.role) !== 'admin') { showToast('Only Administrators can delete stock entries.', 'error'); return; }
  const prod = s.products.find(x => x.id === pid);
  if (!prod) return;
  const variant = prod.variants.find(x => x.id === vid);
  if (!variant) return;
  confirmModal({
    title: 'Delete Variant',
    message: `Are you sure you want to delete variant <strong>${variant.name || variant.size}</strong> from <strong>${prod.productType || prod.name}</strong>? This cannot be undone.`,
    confirmText: 'Delete Variant',
    icon: '🗑️',
    onConfirm: function () {
      const s2 = getState();
      const prod2 = s2.products.find(x => x.id === pid);
      if (!prod2) return;
      prod2.variants = prod2.variants.filter(x => x.id !== vid);
      saveState(s2);
      DB.updateProduct(pid, { name: prod2.name, desc: prod2.desc, variants: prod2.variants });
      showToast('Variant deleted.', 'success');
      renderInventory();
    }
  });
}

function addStockModal() {
  const s = getState();
  if (!s.currentUser || normalizeRole(s.currentUser.role) !== 'admin') { showToast('Only Administrators can add stock.', 'error'); return; }
  const productOptions = s.products.filter(p => p.active)
    .map(p => `<option value="${p.id}">${p.productType || p.name} — ${p.name}</option>`).join('');

  const branchStockInputs = s.branches.map(b => `
    <div style="display:flex;align-items:center;gap:12px;padding:8px 0;border-bottom:1px solid var(--ink-10)">
      <span style="flex:1;font-weight:600;font-size:13px">${b.name}</span>
      <input type="number" class="form-control addstock-branch-qty" data-branch="${b.id}" placeholder="0" min="0" style="width:100px;font-size:13px">
    </div>`).join('');

  showModal(`
    <div class="modal-header"><h2>Add Stock / New Variant</h2><button class="btn-close-modal" onclick="closeModal()">✕</button></div>
    <div class="modal-body">
      <div class="form-group">
        <label>Product</label>
        <select class="form-control" id="addstock-product">${productOptions}</select>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div class="form-group"><label>Variant Name / Size <span style="color:var(--danger)">*</span></label><input type="text" class="form-control" id="addstock-name" placeholder="e.g. Small, 10x12, Red"></div>
        <div class="form-group"><label>SKU</label><input type="text" class="form-control" id="addstock-sku" placeholder="Optional"></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px">
        <div class="form-group"><label>Unit Price (₱)</label><input type="number" class="form-control" id="addstock-price" placeholder="0.00" min="0" step="0.01"></div>
        <div class="form-group"><label>Reorder Point</label><input type="number" class="form-control" id="addstock-reorder" placeholder="20" min="1" value="20"></div>
        <div class="form-group"><label>Max Stock</label><input type="number" class="form-control" id="addstock-maxstock" placeholder="60" min="1" value="60"></div>
      </div>
      <hr class="divider">
      <div style="font-size:12px;font-weight:700;text-transform:uppercase;color:var(--ink-60);margin-bottom:8px">Initial Stock Per Branch</div>
      ${branchStockInputs}
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
      <button class="btn btn-maroon" onclick="confirmAddStock()">Add Variant</button>
    </div>`, 'modal-lg');
}

function confirmAddStock() {
  const s = getState();
  if (!s.currentUser || normalizeRole(s.currentUser.role) !== 'admin') { showToast('Only Administrators can add stock.', 'error'); return; }
  const pid = document.getElementById('addstock-product').value;
  const name = document.getElementById('addstock-name').value.trim();
  const sku = document.getElementById('addstock-sku').value.trim();
  const price = parseFloat(document.getElementById('addstock-price').value) || 0;
  const reorderLevel = Math.max(1, parseInt(document.getElementById('addstock-reorder').value) || 20);
  const maxStock = Math.max(1, parseInt(document.getElementById('addstock-maxstock').value) || 60);

  if (!name) { showToast('Variant name is required.', 'error'); return; }

  const prod = s.products.find(x => x.id === pid);
  if (!prod) { showToast('Product not found.', 'error'); return; }

  const branchStocks = {};
  document.querySelectorAll('.addstock-branch-qty').forEach(input => {
    const branchId = input.dataset.branch;
    branchStocks[branchId] = Math.max(0, parseInt(input.value) || 0);
  });
  const totalStock = Object.values(branchStocks).reduce((sum, q) => sum + q, 0);

  const newVariant = {
    id: 'pvar_' + Date.now(),
    name,
    size: name,
    sku,
    price,
    stock: totalStock,
    reorderLevel,
    maxStock,
    reserved: 0,
    branchStocks,
    lastCountDate: new Date().toISOString(),
  };

  prod.variants = prod.variants || [];
  prod.variants.push(newVariant);
  saveState(s);
  DB.updateProduct(pid, { name: prod.name, desc: prod.desc, variants: prod.variants });
  closeModal();
  showToast(`Variant "${name}" added to ${prod.productType || prod.name}.`, 'success');
  renderInventory();
}

function openInventoryRequestModal() {
  const s = getState();
  if (!s.currentUser || normalizeRole(s.currentUser.role) !== 'inventory_staff') {
    showToast('Only Inventory Personnel can submit branch inventory requests.', 'error');
    return;
  }
  const variants = s.products.flatMap(p => (p.variants || []).map(v => ({ product: p, variant: v })));
  showModal(`<div class="modal-header"><h2>Request Inventory</h2><button class="btn-close-modal" onclick="closeModal()">✕</button></div>
    <div class="modal-body">
      <div class="form-group"><label>Item</label><div class="form-select-wrap"><select id="invreq-variant" class="form-control">${variants.map(row => `<option value="${row.variant.id}">${row.product.productType || row.product.name} — ${row.variant.name || row.variant.size}</option>`).join('')}</select></div></div>
      <div class="form-row-2">
        <div class="form-group"><label>Quantity</label><input id="invreq-qty" type="number" min="1" value="1" class="form-control"></div>
        <div class="form-group"><label>Reason</label><input id="invreq-reason" class="form-control" placeholder="Urgent restock, client order, etc."></div>
      </div>
    </div>
    <div class="modal-footer"><button class="btn btn-outline" onclick="closeModal()">Cancel</button><button class="btn btn-maroon" onclick="submitInventoryRequest()">Submit Request</button></div>`);
}

function submitInventoryRequest() {
  const s = getState();
  if (!s.currentUser || normalizeRole(s.currentUser.role) !== 'inventory_staff') {
    showToast('Only Inventory Personnel can submit branch inventory requests.', 'error');
    return;
  }
  const variantId = document.getElementById('invreq-variant')?.value;
  const qty = parseInt(document.getElementById('invreq-qty')?.value, 10) || 0;
  const reason = document.getElementById('invreq-reason')?.value?.trim() || '';
  if (!variantId || qty <= 0) { showToast('Enter a valid request.', 'error'); return; }
  const found = findProductAndVariantByVariantId(s, variantId);
  if (!found) { showToast('Selected item was not found.', 'error'); return; }
  s.branchInventoryRequests.push({
    id: 'invreq_' + Date.now(),
    branchId: s.currentUser?.branchId || null,
    requestedBy: s.currentUser?.id || null,
    requestedByName: s.currentUser?.name || s.currentUser?.username || 'Branch User',
    productId: found.product.id,
    variantId,
    itemName: `${found.product.productType || found.product.name} — ${found.variant.name || found.variant.size}`,
    qty,
    reason,
    status: 'pending',
    createdAt: new Date().toISOString(),
  });
  saveState(s);
  closeModal();
  showToast('Inventory request sent to Main Admin.', 'success');
  renderInventory();
}

function approveInventoryRequest(requestId) {
  const s = getState();
  if (!s.currentUser || normalizeRole(s.currentUser.role) !== 'admin') {
    showToast('Only the Main Admin can approve inventory requests.', 'error');
    return;
  }
  const req = (s.branchInventoryRequests || []).find(x => x.id === requestId);
  if (!req || req.status !== 'pending') return;
  const found = findProductAndVariantByVariantId(s, req.variantId);
  if (!found) { showToast('Requested item was not found.', 'error'); return; }
  const mainBranchId = 'b1';
  const available = (found.variant.branchStocks || {})[mainBranchId] || 0;
  if (available < req.qty) { showToast(`Main Branch only has ${available} unit(s) available.`, 'error'); return; }
  adjustVariantBranchStock(found.variant, mainBranchId, -req.qty);
  adjustVariantBranchStock(found.variant, req.branchId, req.qty);
  req.status = 'approved';
  req.reviewedAt = new Date().toISOString();
  req.reviewedBy = s.currentUser?.id || null;
  s.branchTransfers.push({
    id: 'tr_' + Date.now(),
    fromBranchId: mainBranchId,
    toBranchId: req.branchId,
    productId: found.product.id,
    variantId: req.variantId,
    productName: found.product.name,
    variantName: found.variant.name || found.variant.size,
    qty: req.qty,
    createdAt: req.reviewedAt,
    createdBy: s.currentUser?.id || null,
  });
  saveState(s);
  DB.updateProduct(found.product.id, { name: found.product.name, desc: found.product.desc, variants: found.product.variants });
  DB.saveTransfer(s.branchTransfers[s.branchTransfers.length - 1]);
  showToast('Inventory request approved and transferred.', 'success');
  renderInventory();
}

function rejectInventoryRequest(requestId) {
  const s = getState();
  if (!s.currentUser || normalizeRole(s.currentUser.role) !== 'admin') {
    showToast('Only the Main Admin can reject inventory requests.', 'error');
    return;
  }
  const req = (s.branchInventoryRequests || []).find(x => x.id === requestId);
  if (!req || req.status !== 'pending') return;
  req.status = 'rejected';
  req.reviewedAt = new Date().toISOString();
  req.reviewedBy = s.currentUser?.id || null;
  saveState(s);
  showToast('Inventory request rejected.', 'warning');
  renderInventory();
}

// PERSONNEL MANAGEMENT
function renderPersonnelMgmt() {
  const s = getState();
  const me = s.currentUser;
  if (!me) { accessDenied('Personnel Management'); return; }

  // STAFF: show a simple landing page with links to their sub-pages
  if (['cashier', 'branch_manager', 'inventory_staff'].includes(normalizeRole(me.role))) {
    document.getElementById('page-content').innerHTML = `
      <div class="page-header"><h1 class="page-title">Personnel Management</h1><p class="page-subtitle">Your schedule, time cards, leave, and payroll.</p></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">
        <div class="data-card" style="cursor:pointer" onclick="navigateTo('shift-schedule')">
          <div class="data-card-header"><span class="data-card-title">${iconSvg('calendar')} Schedule</span><span class="badge badge-maroon">→</span></div>
          <div class="data-card-body"><p class="text-sm text-muted">View your monthly work schedule, rest days, and approved leaves.</p></div>
        </div>
        <div class="data-card" style="cursor:pointer" onclick="navigateTo('attendance')">
          <div class="data-card-header"><span class="data-card-title">${iconSvg('clock')} Time Cards</span><span class="badge badge-maroon">→</span></div>
          <div class="data-card-body"><p class="text-sm text-muted">Upload and track your time cards for payroll processing.</p></div>
        </div>
        <div class="data-card" style="cursor:pointer" onclick="navigateTo('leave-management')">
          <div class="data-card-header"><span class="data-card-title">${iconSvg('receipt')} Leave Management</span><span class="badge badge-maroon">→</span></div>
          <div class="data-card-body"><p class="text-sm text-muted">Apply for leave and view your leave history.</p></div>
        </div>
        <div class="data-card" style="cursor:pointer" onclick="navigateTo('payslip')">
          <div class="data-card-header"><span class="data-card-title">${iconSvg('money')} Payslips</span><span class="badge badge-maroon">→</span></div>
          <div class="data-card-body"><p class="text-sm text-muted">View and download your payslips.</p></div>
        </div>
      </div>`;
    return;
  }

  // PRINT: show print department staff overview
  if (me.role === 'print') {
    const printUsers = s.users.filter(u => u.role === 'print');
    document.getElementById('page-content').innerHTML = `
      <div class="page-header"><h1 class="page-title">Personnel Management</h1><p class="page-subtitle">Printing Department Staff</p></div>
      <div class="data-card"><div class="data-card-header"><span class="data-card-title">Print Department Staff</span><span class="badge badge-neutral">${printUsers.length} members</span></div>
        <div class="data-card-body no-pad">
          <table class="data-table"><thead><tr><th>Name</th><th>Username</th><th>Active Shift</th><th>Shifts This Month</th></tr></thead>
          <tbody>${printUsers.map(u => {
      const myShift = s.shifts.find(x => x.userId === u.id && x.status === 'open');
      const monthShifts = s.shifts.filter(x => x.userId === u.id && new Date(x.openedAt).getMonth() === new Date().getMonth()).length;
      return `<tr>
              <td><strong>${u.name}</strong></td>
              <td class="td-mono">${u.username}</td>
              <td>${myShift ? `<span class="badge badge-success">${iconSvg('statusOpen')} Open</span>` : '<span class="badge badge-neutral">Closed</span>'}</td>
              <td>${monthShifts}</td>
            </tr>`;
    }).join('')}</tbody>
          </table>
        </div>
      </div>`;
    return;
  }

  // Admin: full personnel management
  const staffUsers = s.users.filter(u => ['cashier', 'branch_manager', 'inventory_staff', 'print'].includes(normalizeRole(u.role)));
  document.getElementById('page-content').innerHTML = `
    <div class="page-header"><h1 class="page-title">Personnel Management</h1><p class="page-subtitle">Manage staff and monitor their shift activity.</p></div>
    <div class="data-card"><div class="data-card-header"><span class="data-card-title">All Staff</span><span class="badge badge-neutral">${staffUsers.length} staff members</span></div>
      <div class="data-card-body no-pad">
        <table class="data-table"><thead><tr><th>Name</th><th>Role</th><th>Position</th><th>Branch</th><th>Active Shift</th><th>Shifts This Month</th><th></th></tr></thead>
        <tbody>${staffUsers.length ? staffUsers.map(u => {
    const branch = s.branches.find(b => b.id === u.branchId);
    const myShift = s.shifts.find(x => x.userId === u.id && x.status === 'open');
    const monthShifts = s.shifts.filter(x => x.userId === u.id && new Date(x.openedAt).getMonth() === new Date().getMonth()).length;
    const roleBadge = u.role === 'print' ? '<span class="badge badge-info">Printing Dept</span>' : '<span class="badge badge-success">Branch Staff</span>';
    return `<tr>
            <td><strong>${u.name}</strong><div style="font-size:11px;color:var(--ink-40);font-family:var(--font-mono)">${u.username}</div></td>
            <td>${roleBadge}</td>
            <td>${u.position ? `<span style="font-size:12px">${u.position}</span>` : `<span style="color:var(--ink-30);font-size:12px;cursor:pointer" onclick="editUserModal('${u.id}')" title="Click to set position">Set position…</span>`}</td>
            <td>${branch?.name || '–'}</td>
            <td>${myShift ? `<span class="badge badge-success">${iconSvg('statusOpen')} Open</span>` : '<span class="badge badge-neutral">Closed</span>'}</td>
            <td>${monthShifts}</td>
            <td><button class="btn btn-sm btn-outline" onclick="editUserModal('${u.id}')">Edit</button></td>
          </tr>`;
  }).join('') : '<tr><td colspan="7" style="text-align:center;padding:32px;color:var(--ink-60)">No staff found.</td></tr>'}</tbody>
        </table>
      </div>
    </div>`;
}

// SHIFT SCHEDULE
// ── PH PUBLIC HOLIDAYS ────────────────────────────────────────────
const PH_HOLIDAYS = {
  '2025-01-01': "New Year's Day", '2025-04-09': 'Araw ng Kagitingan',
  '2025-04-17': 'Maundy Thursday', '2025-04-18': 'Good Friday', '2025-04-19': 'Black Saturday',
  '2025-05-01': 'Labor Day', '2025-06-12': 'Independence Day', '2025-08-25': 'National Heroes Day',
  '2025-11-01': "All Saints' Day", '2025-11-30': 'Bonifacio Day',
  '2025-12-08': 'Immaculate Conception', '2025-12-25': 'Christmas Day', '2025-12-30': 'Rizal Day',
  '2026-01-01': "New Year's Day", '2026-04-02': 'Maundy Thursday', '2026-04-03': 'Good Friday',
  '2026-04-04': 'Black Saturday', '2026-04-09': 'Araw ng Kagitingan',
  '2026-05-01': 'Labor Day', '2026-06-12': 'Independence Day', '2026-08-31': 'National Heroes Day',
  '2026-11-01': "All Saints' Day", '2026-11-02': "All Souls' Day", '2026-11-30': 'Bonifacio Day',
  '2026-12-08': 'Immaculate Conception', '2026-12-25': 'Christmas Day',
  '2026-12-30': 'Rizal Day', '2026-12-31': "New Year's Eve",
};

// ── DAY STATUS HELPERS ────────────────────────────────────────────
// status values stored in shiftSchedules: 'Work' | 'Rest Day' | 'Leave' | 'Holiday'
// 'Off' removed — 'Rest Day' covers that. Default Mon–Fri = Work, Sat–Sun = Rest Day.
const SCHED_STATUSES = ['Work', 'Rest Day', 'Leave', 'Holiday'];
const SCHED_COLORS = { Work: '#16a34a', 'Rest Day': '#7c3aed', Leave: '#d97706', Holiday: '#dc2626' };
const SCHED_CYCLE = ['Work', 'Rest Day', 'Leave', 'Holiday'];
const SCHED_BADGES = {
  Work: `<span style="background:#dcfce7;color:#16a34a;padding:2px 8px;border-radius:999px;font-size:10px;font-weight:700">WORK</span>`,
  'Rest Day': `<span style="background:#ede9fe;color:#7c3aed;padding:2px 8px;border-radius:999px;font-size:10px;font-weight:700">REST DAY</span>`,
  Leave: `<span style="background:#fef3c7;color:#d97706;padding:2px 8px;border-radius:999px;font-size:10px;font-weight:700">LEAVE</span>`,
  Holiday: `<span style="background:#fee2e2;color:#dc2626;padding:2px 8px;border-radius:999px;font-size:10px;font-weight:700">HOLIDAY</span>`,
};

function getSchedStatus(s, uid, dateStr) {
  const stored = (s.shiftSchedules || {})[`${uid}_${dateStr}`];
  if (stored) return stored;
  // Holidays always take priority if not manually overridden
  if (PH_HOLIDAYS[dateStr]) return 'Holiday';
  // Default: Mon–Fri = Work (8am–5pm), Sat–Sun = Rest Day
  const dow = new Date(dateStr + 'T00:00:00').getDay(); // 0=Sun, 6=Sat
  return (dow === 0 || dow === 6) ? 'Rest Day' : 'Work';
}

function saveSchedDay(uid, dateStr, val) {
  const s = getState();
  if (!s.shiftSchedules) s.shiftSchedules = {};
  s.shiftSchedules[`${uid}_${dateStr}`] = val;
  saveState(s);
  if (typeof DB !== 'undefined') DB.saveShiftSchedule(uid, dateStr, val);
}

function cycleSchedDay(uid, dateStr) {
  const s = getState();
  const current = getSchedStatus(s, uid, dateStr);
  const next = SCHED_CYCLE[(SCHED_CYCLE.indexOf(current) + 1) % SCHED_CYCLE.length];
  saveSchedDay(uid, dateStr, next);
  renderShiftSchedule();
}

// ── ADMIN SCHEDULING PAGE ─────────────────────────────────────────
function renderShiftSchedule() {
  const s = getState();
  if (!s.currentUser) { accessDenied('Scheduling'); return; }
  const role = normalizeRole(s.currentUser.role);
  const isPayrollAdmin = role === 'admin' || role === 'hr';
  const isBranchManager = role === 'branch_manager';
  if (!isPayrollAdmin && !isBranchManager) { renderPersonalSchedule(); return; }

  // Week navigation state
  if (!s.scheduleWeekStart) s.scheduleWeekStart = toLocalDateString(getMonday(new Date()));
  const weekStart = new Date(s.scheduleWeekStart + 'T00:00:00');
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart); d.setDate(weekStart.getDate() + i); return d;
  });
  const weekLabel = `${days[0].toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })} – ${days[6].toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  const todayStr = toLocalDateString(new Date());

  // Filter: which branch to show (default all)
  const filterBranch = isBranchManager ? (s.currentUser.branchId || 'all') : (window._schedBranchFilter || 'all');
  const allBranches = s.branches || [];
  const branchOpts = isBranchManager
    ? allBranches.filter(b => b.id === s.currentUser.branchId).map(b => `<option value="${b.id}" selected>${b.name}</option>`).join('')
    : [`<option value="all" ${filterBranch === 'all' ? 'selected' : ''}>All Branches</option>`,
    ...allBranches.map(b => `<option value="${b.id}" ${filterBranch === b.id ? 'selected' : ''}>${b.name}</option>`)].join('');

  // Build summary badges for top bar
  const allStaff = (s.users || []).filter(u => ['cashier', 'inventory_staff', 'branch_manager', 'print'].includes(normalizeRole(u.role)));
  let totalWork = 0, totalOff = 0, totalLeave = 0;
  allStaff.forEach(u => {
    days.forEach(d => {
      const st = getSchedStatus(s, u.id, toLocalDateString(d));
      if (st === 'Work') totalWork++;
      else if (st === 'Leave') totalLeave++;
      else totalOff++;
    });
  });

  // Build sections per branch + print dept
  const sections = [];

  // Branch staff sections
  allBranches.forEach(branch => {
    if (filterBranch !== 'all' && filterBranch !== branch.id) return;
    const staff = (s.users || []).filter(u => ['cashier', 'inventory_staff', 'branch_manager'].includes(normalizeRole(u.role)) && u.branchId === branch.id);
    sections.push(buildSchedSection(s, branch.name, '🏪', staff, days, todayStr));
  });

  // Print dept section — grouped per branch, respecting branch filter
  allBranches.forEach(branch => {
    if (filterBranch !== "all" && filterBranch !== branch.id) return;
    const branchPrintStaff = (s.users || []).filter(u => u.role === "print" && u.branchId === branch.id);
    if (branchPrintStaff.length) sections.push(buildSchedSection(s, branch.name + " — Print Dept", "🖨️", branchPrintStaff, days, todayStr));
  });
  // Also show print staff with no branch assigned (only when viewing all)
  if (filterBranch === "all") {
    const unassignedPrint = (s.users || []).filter(u => u.role === "print" && !u.branchId);
    if (unassignedPrint.length) sections.push(buildSchedSection(s, "Printing Department", "🖨️", unassignedPrint, days, todayStr));
  }

  document.getElementById('page-content').innerHTML = `
    <div class="page-header" style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:12px">
      <div>
        <h1 class="page-title">Weekly Schedule</h1>
        <p class="page-subtitle">Assign work days for each employee — weekly view</p>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
        <div class="form-select-wrap" style="min-width:180px">
          <select class="form-control" onchange="window._schedBranchFilter=this.value;renderShiftSchedule()">${branchOpts}</select>
        </div>
        <button class="btn btn-outline" onclick="schedClearWeek()">Clear Week</button>
        <button class="btn btn-maroon" onclick="schedAutoFillWeek()">Auto-Fill Week</button>
      </div>
    </div>

    <div style="display:flex;gap:12px;margin-bottom:20px;flex-wrap:wrap">
      <div class="kpi-card" style="flex:1;min-width:140px">
        <div class="kpi-header"><div class="kpi-label">Working This Week</div><div class="kpi-icon green">${iconSvg('check')}</div></div>
        <div class="kpi-value" style="color:var(--success)">${totalWork}</div>
      </div>
      <div class="kpi-card" style="flex:1;min-width:140px">
        <div class="kpi-header"><div class="kpi-label">On Leave</div><div class="kpi-icon gold">${iconSvg('clock')}</div></div>
        <div class="kpi-value" style="color:var(--warning)">${totalLeave}</div>
      </div>
      <div class="kpi-card" style="flex:1;min-width:140px">
        <div class="kpi-header"><div class="kpi-label">Rest / Holiday</div><div class="kpi-icon maroon">${iconSvg('error')}</div></div>
        <div class="kpi-value" style="color:var(--ink-60)">${totalOff}</div>
      </div>
    </div>

    <div class="data-card">
      <div class="data-card-header" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px">
        <div style="display:flex;align-items:center;gap:10px">
          <button class="btn btn-sm btn-outline" onclick="shiftWeek(-1)">← Prev</button>
          <span style="font-weight:700;font-size:15px">${weekLabel}</span>
          <button class="btn btn-sm btn-outline" onclick="shiftWeek(1)">Next →</button>
          <button class="btn btn-sm btn-outline" onclick="goToday()">Today</button>
        </div>
        <div style="display:flex;gap:8px;font-size:12px;align-items:center;flex-wrap:wrap">
          ${Object.entries(SCHED_BADGES).map(([k, v]) => `<div style="display:flex;align-items:center;gap:4px">${v}<span style="color:var(--ink-60)">${k}</span></div>`).join('')}
        </div>
      </div>
      <div class="data-card-body no-pad">
        ${sections.length ? sections.join('') : '<div style="text-align:center;padding:40px;color:var(--ink-40)">No employees found.</div>'}
      </div>
    </div>`;

  applySvgToElement(document.getElementById('page-content'));
}

function buildSchedSection(s, sectionName, icon, staff, days, todayStr) {
  if (!staff.length) return `
    <div style="padding:16px 20px;border-bottom:1px solid var(--border)">
      <div style="font-weight:700;font-size:13px;color:var(--ink-60);margin-bottom:2px">${icon} ${sectionName}</div>
      <div style="font-size:12px;color:var(--ink-40)">No employees assigned.</div>
    </div>`;

  const dayHeaders = days.map(d => {
    const ds = toLocalDateString(d);
    const isToday = ds === todayStr;
    const isHol = !!PH_HOLIDAYS[ds];
    return `<th style="text-align:center;min-width:90px;${isToday ? 'background:var(--maroon-10,#fdf2f2)' : ''}">
      <div style="font-weight:700;font-size:12px;${isToday ? 'color:var(--maroon)' : ''}">${d.toLocaleDateString('en-PH', { weekday: 'short' })}</div>
      <div style="font-weight:400;font-size:11px;color:var(--ink-50)">${d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}</div>
      ${isHol ? `<div style="font-size:10px;color:var(--danger);font-weight:600">Holiday</div>` : ''}
    </th>`;
  }).join('');

  const rows = staff.map(u => {
    const dayStatuses = days.map(d => {
      const ds = toLocalDateString(d);
      const val = getSchedStatus(s, u.id, ds);
      const isToday = ds === todayStr;
      const isDefault = !((s.shiftSchedules || {})[`${u.id}_${ds}`]);
      const badgeBg = { Work: '#dcfce7', 'Rest Day': '#ede9fe', Leave: '#fef3c7', Holiday: '#fee2e2' }[val] || '#f3f4f6';
      const badgeFg = SCHED_COLORS[val] || '#6b7280';
      const label = { Work: '✓ Work', 'Rest Day': '✕ Rest Day', Leave: '⏸ Leave', Holiday: '★ Holiday' }[val] || val;
      return `<td style="text-align:center;padding:6px 4px;${isToday ? 'background:var(--maroon-10,#fdf2f2)' : ''}">
        <button onclick="cycleSchedDay('${u.id}','${ds}')"
          title="Click to cycle: Work → Rest Day → Leave → Holiday"
          style="border:2px solid ${isDefault ? 'transparent' : badgeFg + '55'};cursor:pointer;border-radius:20px;
                 padding:5px 10px;font-size:11px;font-weight:700;background:${badgeBg};color:${badgeFg};
                 white-space:nowrap;opacity:${isDefault ? '0.72' : '1'};
                 transition:all .15s;min-width:82px;">
          ${label}
        </button>
      </td>`;
    }).join('');

    // Count work days this week
    const workDays = days.filter(d => getSchedStatus(s, u.id, toLocalDateString(d)) === 'Work').length;

    return `<tr>
      <td style="padding:10px 16px;min-width:160px;border-right:1px solid var(--border)">
        <div style="font-weight:700;font-size:13px">${u.name}</div>
        <div style="font-size:11px;color:var(--ink-50)">${u.username}</div>
        <div style="margin-top:4px;font-size:11px;color:${workDays > 0 ? 'var(--success)' : 'var(--ink-40)'};font-weight:600">${workDays} day${workDays !== 1 ? 's' : ''} this week</div>
      </td>
      ${dayStatuses}
    </tr>`;
  }).join('');

  return `
    <div style="padding:12px 20px 4px;border-bottom:1px solid var(--border);background:var(--cream)">
      <span style="font-weight:700;font-size:13px">${icon} ${sectionName}</span>
      <span style="font-size:12px;color:var(--ink-50);margin-left:8px">${staff.length} employee${staff.length !== 1 ? 's' : ''}</span>
    </div>
    <div style="overflow-x:auto">
      <table class="data-table" style="font-size:12.5px;min-width:700px">
        <thead><tr>
          <th style="min-width:160px;border-right:1px solid var(--border)">Employee</th>
          ${dayHeaders}
          <th style="text-align:center;min-width:80px">Days Worked</th>
        </tr></thead>
        <tbody>
          ${rows.replace(/<\/tr>/g, () => {
    // inject total work days column at end of each row
    return '</tr>';
  })}
        </tbody>
      </table>
    </div>`;
}

function shiftWeek(delta) {
  const s = getState();
  if (!s.scheduleWeekStart) s.scheduleWeekStart = toLocalDateString(getMonday(new Date()));
  const d = new Date(s.scheduleWeekStart + 'T00:00:00');
  d.setDate(d.getDate() + delta * 7);
  s.scheduleWeekStart = toLocalDateString(d);
  saveState(s);
  renderShiftSchedule();
}

function goToday() {
  const s = getState();
  s.scheduleWeekStart = toLocalDateString(getMonday(new Date()));
  saveState(s);
  renderShiftSchedule();
}

function schedAutoFillWeek() {
  const s = getState();
  if (!s.scheduleWeekStart) s.scheduleWeekStart = toLocalDateString(getMonday(new Date()));
  const weekStart = new Date(s.scheduleWeekStart + 'T00:00:00');
  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(weekStart); d.setDate(weekStart.getDate() + i); return d; });
  confirmModal({
    title: 'Auto-fill Week Schedule',
    message: 'Auto-fill this week for all employees?<br><br><strong>Mon–Fri</strong> → Work &nbsp;·&nbsp; <strong>Sat–Sun</strong> → Rest Day &nbsp;·&nbsp; <strong>Holidays</strong> → Holiday<br><br>This will overwrite all current assignments.',
    confirmText: 'Auto-fill Week',
    cancelText: 'Cancel',
    icon: '🗓️',
    danger: false,
    onConfirm: function () { _schedAutoFillWeekConfirmed(); }
  });
  return;
}
function _schedAutoFillWeekConfirmed() {
  const s = getState();
  if (!s.scheduleWeekStart) s.scheduleWeekStart = toLocalDateString(getMonday(new Date()));
  const weekStart = new Date(s.scheduleWeekStart + 'T00:00:00');
  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(weekStart); d.setDate(weekStart.getDate() + i); return d; });
  const allEmp = (s.users || []).filter(u => ['cashier', 'inventory_staff', 'branch_manager', 'print'].includes(normalizeRole(u.role)));
  allEmp.forEach(u => {
    days.forEach(d => {
      const ds = toLocalDateString(d);
      let val = 'Work';
      if (PH_HOLIDAYS[ds]) val = 'Holiday';
      else if (d.getDay() === 0 || d.getDay() === 6) val = 'Rest Day';
      saveSchedDay(u.id, ds, val);
    });
  });
  showToast('Week auto-filled: Mon–Fri Work, weekends Rest Day.', 'success');
  renderShiftSchedule();
}

function schedClearWeek() {
  const s = getState();
  if (!s.scheduleWeekStart) return;
  confirmModal({
    title: 'Clear Week Schedule',
    message: 'Are you sure you want to clear <strong>all schedule assignments</strong> for this week? This cannot be undone.',
    confirmText: 'Clear Week',
    icon: '🗓️',
    onConfirm: function () { _schedClearWeekConfirmed(); }
  });
  return;
}
function _schedClearWeekConfirmed() {
  const s = getState();
  if (!s.scheduleWeekStart) return;
  const weekStart = new Date(s.scheduleWeekStart + 'T00:00:00');
  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(weekStart); d.setDate(weekStart.getDate() + i); return d; });
  const allEmp = (s.users || []).filter(u => ['cashier', 'inventory_staff', 'branch_manager', 'print'].includes(normalizeRole(u.role)));
  allEmp.forEach(u => {
    days.forEach(d => {
      const ds = toLocalDateString(d);
      delete s.shiftSchedules[`${u.id}_${ds}`];
      if (typeof DB !== 'undefined') DB.saveShiftSchedule(u.id, ds, null);
    });
  });
  saveState(s);
  showToast('Week cleared.', 'success');
  renderShiftSchedule();
}

// ── PERSONAL SCHEDULE (Staff / Print view) ────────────────────────
function renderPersonalSchedule() {
  const s = getState();
  const u = s.currentUser;
  const br = (s.branches || []).find(b => b.id === u.branchId);

  if (!window._schedCalYear) { window._schedCalYear = new Date().getFullYear(); window._schedCalMonth = new Date().getMonth(); }
  const year = window._schedCalYear;
  const month = window._schedCalMonth;
  const monthLabel = new Date(year, month, 1).toLocaleDateString('en-PH', { month: 'long', year: 'numeric' });
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const todayStr = toLocalDateString(new Date());

  window._schedPrev = () => { if (window._schedCalMonth === 0) { window._schedCalYear--; window._schedCalMonth = 11; } else { window._schedCalMonth--; } renderPersonalSchedule(); };
  window._schedNext = () => { if (window._schedCalMonth === 11) { window._schedCalYear++; window._schedCalMonth = 0; } else { window._schedCalMonth++; } renderPersonalSchedule(); };

  // Count this month's stats
  let workCount = 0, leaveCount = 0, restCount = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const ds = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const st = getSchedStatus(s, u.id, ds);
    if (st === 'Work') workCount++;
    else if (st === 'Leave') leaveCount++;
    else if (st === 'Rest Day') restCount++;
    else restCount++; // Holiday also counted as non-work
  }

  // Holidays this month
  const monthHolidays = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const ds = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    if (PH_HOLIDAYS[ds]) monthHolidays.push({ ds, name: PH_HOLIDAYS[ds], d });
  }

  // Calendar grid
  const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  let cells = DOW.map(d => `<div style="text-align:center;font-size:11px;font-weight:700;color:var(--ink-50);padding:6px 0">${d}</div>`).join('');
  for (let i = 0; i < firstDay; i++) cells += '<div></div>';

  for (let d = 1; d <= daysInMonth; d++) {
    const ds = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const st = getSchedStatus(s, u.id, ds);
    const isToday = ds === todayStr;
    const isHol = !!PH_HOLIDAYS[ds];
    const color = SCHED_COLORS[st] || '#6b7280';
    const bgMap = { Work: '#f0fdf4', 'Rest Day': '#f5f3ff', Leave: '#fefce8', Holiday: '#fef2f2', Off: '#f9fafb' };
    const bg = isToday ? '#fdf2f2' : (bgMap[st] || '#f9fafb');
    cells += `
      <div style="border-radius:8px;background:${bg};border:${isToday ? '2px solid var(--maroon)' : '1px solid #e5e7eb'};padding:8px 6px;min-height:72px;position:relative">
        <div style="font-weight:${isToday ? '800' : '600'};font-size:13px;color:${isToday ? 'var(--maroon)' : 'var(--ink)'};margin-bottom:4px">${d}${isHol ? ' 🎌' : ''}</div>
        <div style="font-size:10px;font-weight:700;color:${color};text-transform:uppercase;letter-spacing:0.5px">${st}</div>
        ${isHol ? `<div style="font-size:9px;color:var(--danger);margin-top:2px;line-height:1.2">${PH_HOLIDAYS[ds]}</div>` : ''}
      </div>`;
  }

  document.getElementById('page-content').innerHTML = `
    <div class="page-header" style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:12px">
      <div>
        <h1 class="page-title">My Schedule</h1>
        <p class="page-subtitle">${u.name} · ${br?.name || 'Printing Department'}</p>
      </div>
      <button class="btn btn-outline" onclick="navigateTo('leave-management')">+ Request Leave</button>
    </div>

    <div style="display:flex;gap:12px;margin-bottom:20px;flex-wrap:wrap">
      <div class="kpi-card" style="flex:1;min-width:120px">
        <div class="kpi-header"><div class="kpi-label">Work Days</div><div class="kpi-icon green">${iconSvg('check')}</div></div>
        <div class="kpi-value" style="color:var(--success)">${workCount}</div>
      </div>
      <div class="kpi-card" style="flex:1;min-width:120px">
        <div class="kpi-header"><div class="kpi-label">Rest Days</div><div class="kpi-icon" style="background:#ede9fe">${iconSvg('home')}</div></div>
        <div class="kpi-value" style="color:#7c3aed">${restCount}</div>
      </div>
      <div class="kpi-card" style="flex:1;min-width:120px">
        <div class="kpi-header"><div class="kpi-label">On Leave</div><div class="kpi-icon gold">${iconSvg('clock')}</div></div>
        <div class="kpi-value" style="color:var(--warning)">${leaveCount}</div>
      </div>

    </div>

    <div class="data-card">
      <div class="data-card-header" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
        <div style="display:flex;align-items:center;gap:10px">
          <button class="btn btn-sm btn-outline" onclick="window._schedPrev()">← Prev</button>
          <span style="font-weight:700;font-size:16px">${monthLabel}</span>
          <button class="btn btn-sm btn-outline" onclick="window._schedNext()">Next →</button>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          ${Object.entries(SCHED_BADGES).map(([k, v]) => `<div style="display:flex;align-items:center;gap:3px">${v}</div>`).join('')}
        </div>
      </div>
      <div class="data-card-body" style="padding:16px">
        <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:6px">
          ${cells}
        </div>
      </div>
    </div>

    ${monthHolidays.length ? `
    <div class="data-card" style="margin-top:16px">
      <div class="data-card-header"><span class="data-card-title">🎌 Holidays This Month</span></div>
      <div class="data-card-body" style="display:flex;flex-direction:column;gap:8px">
        ${monthHolidays.map(h => `
          <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:var(--cream);border-radius:var(--radius)">
            <div><strong>${new Date(h.ds + 'T00:00:00').toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric' })}</strong> — ${h.name}</div>
            <span style="background:#fee2e2;color:#dc2626;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:700">Holiday Pay</span>
          </div>`).join('')}
      </div>
    </div>` : ''}`;
}

// legacy alias
function setScheduleView(v) { renderShiftSchedule(); }
function shiftDay(delta) { renderShiftSchedule(); }
function autoAssignWeek() { schedAutoFillWeek(); }

// PAYROLL
function getPayrollPeriodSortValue(periodKey) {
  if (!periodKey) return 0;
  if (String(periodKey).includes('__') || /^[0-9]{16}$/.test(String(periodKey))) {
    const bounds = parsePayrollPeriodBounds(periodKey, null);
    if (bounds && bounds.start) return bounds.start.getTime();
  }
  const parts = String(periodKey).split('-');
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  if (!year || !month) return 0;
  return new Date(year, month - 1, 1).getTime();
}

function getPayrollPeriodLabel(periodKey) {
  if (String(periodKey).includes('__') || /^[0-9]{16}$/.test(String(periodKey))) {
    const bounds = parsePayrollPeriodBounds(periodKey, null);
    if (bounds && bounds.start && bounds.end) return getPayrollDateRangeLabel(bounds.start, bounds.end);
  }
  const stamp = getPayrollPeriodSortValue(periodKey);
  if (!stamp) return periodKey || 'Unknown Period';
  return new Date(stamp).toLocaleDateString('en-PH', { month: 'long', year: 'numeric' });
}

function calcPayrollAmounts(attendanceDays, dailyRate) {
  const gross = attendanceDays * dailyRate;
  const sss = Math.round(gross * 0.045);
  const phic = Math.round(gross * 0.025);
  const hdmf = Math.min(100, Math.round(gross * 0.02));
  const deductions = sss + phic + hdmf;
  const net = gross - deductions;
  return { gross, sss, phic, hdmf, deductions, net };
}

function getDateOnlyKey(value) {
  if (!value) return '';
  if (typeof value === 'string') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    const m = value.match(/^(\d{4}-\d{2}-\d{2})/);
    if (m) return m[1];
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return toLocalDateString(d);
}

function getPayrollDateRangeKey(startDate, endDate) {
  const start = getDateOnlyKey(startDate);
  const end = getDateOnlyKey(endDate);
  return start && end ? `${start.replace(/-/g, '')}${end.replace(/-/g, '')}` : '';
}

function getPayrollDateRangeLabel(startDate, endDate) {
  const start = getDateOnlyKey(startDate);
  const end = getDateOnlyKey(endDate);
  if (!start || !end) return 'Custom Payroll Period';
  const startObj = new Date(start + 'T00:00:00');
  const endObj = new Date(end + 'T00:00:00');
  return `${startObj.toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })} - ${endObj.toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })}`;
}

function parsePayrollPeriodBounds(periodKey, payPeriod) {
  if (periodKey && /^[0-9]{16}$/.test(String(periodKey))) {
    const startKey = String(periodKey).slice(0, 8);
    const endKey = String(periodKey).slice(8);
    if (startKey && endKey) {
      return {
        start: new Date(`${startKey.slice(0, 4)}-${startKey.slice(4, 6)}-${startKey.slice(6)}T00:00:00`),
        end: new Date(`${endKey.slice(0, 4)}-${endKey.slice(4, 6)}-${endKey.slice(6)}T23:59:59`),
      };
    }
  }
  if (periodKey && String(periodKey).includes('__')) {
    const parts = String(periodKey).split('__');
    if (parts.length === 2) {
      const startKey = getDateOnlyKey(parts[0]);
      const endKey = getDateOnlyKey(parts[1]);
      if (startKey && endKey) {
        return {
          start: new Date(startKey + 'T00:00:00'),
          end: new Date(endKey + 'T23:59:59'),
        };
      }
    }
  }

  if (periodKey) {
    const parts = String(periodKey).split('-');
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const half = parts[2];
    if (year && !Number.isNaN(month)) {
      if (half === 'A' || half === 'B') {
        return {
          start: new Date(year, month, half === 'A' ? 1 : 16, 0, 0, 0),
          end: new Date(year, half === 'A' ? month : month + 1, half === 'A' ? 15 : 0, 23, 59, 59),
        };
      }
      return {
        start: new Date(year, month, 1, 0, 0, 0),
        end: new Date(year, month + 1, 0, 23, 59, 59),
      };
    }
  }

  if (payPeriod && /\d{4}/.test(payPeriod)) {
    const matches = payPeriod.match(/([A-Za-z]+ \d{1,2}, \d{4})/g);
    if (matches && matches.length >= 2) {
      const start = new Date(matches[0]);
      const end = new Date(matches[1]);
      if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) {
        end.setHours(23, 59, 59, 999);
        return { start, end };
      }
    }
  }

  return null;
}

function getAttendanceDaysForRange(userId, startDate, endDate) {
  const s = getState();
  const startKey = getDateOnlyKey(startDate);
  const endKey = getDateOnlyKey(endDate);
  if (!startKey || !endKey) return 0;
  const uniqueDays = new Set();
  (s.attendanceRecords || []).forEach(record => {
    if (record.userId !== userId || !record.timeIn || !record.timeOut) return;
    const dayKey = getDateOnlyKey(record.date || record.timeIn);
    if (!dayKey) return;
    if (dayKey >= startKey && dayKey <= endKey) uniqueDays.add(dayKey);
  });
  return uniqueDays.size;
}

function buildPayrollRowForDateRange(user, startDate, endDate) {
  const attendanceDays = getAttendanceDaysForRange(user.id, startDate, endDate);
  const dailyRate = user.dailyRate || 600;
  const calc = calcPayrollAmounts(attendanceDays, dailyRate);
  return {
    userId: user.id,
    name: user.name || user.username || 'Unnamed Employee',
    role: user.role,
    branchId: user.branchId || null,
    attendanceDays,
    dailyRate,
    gross: calc.gross,
    sss: calc.sss,
    phic: calc.phic,
    hdmf: calc.hdmf,
    deductions: calc.deductions,
    net: calc.net,
  };
}

function getCompanyPayrollUsers() {
  return (getState().users || []).filter(user => {
    const role = normalizeRole(user.role);
    return role !== 'admin' && user.active !== 0 && user.active !== false;
  });
}

function getPayrollSubmissionMonthKey(startDate, endDate) {
  const start = getDateOnlyKey(startDate);
  const end = getDateOnlyKey(endDate);
  if (!start || !end) return '';
  const startDateObj = new Date(start + 'T00:00:00');
  const endDateObj = new Date(end + 'T00:00:00');
  if (startDateObj.getDate() !== 1) return '';
  const lastDay = new Date(startDateObj.getFullYear(), startDateObj.getMonth() + 1, 0).getDate();
  if (
    endDateObj.getFullYear() !== startDateObj.getFullYear() ||
    endDateObj.getMonth() !== startDateObj.getMonth() ||
    endDateObj.getDate() !== lastDay
  ) {
    return '';
  }
  return `${startDateObj.getFullYear()}-${String(startDateObj.getMonth() + 1).padStart(2, '0')}`;
}

function getApprovedBranchSubmissionPayrollRows(startDate, endDate, branchId) {
  const s = getState();
  const periodKey = getPayrollDateRangeKey(startDate, endDate);
  if (!periodKey) return [];
  return (s.payrollSubmissions || [])
    .filter(sub => sub.status === 'approved' && sub.periodKey === periodKey && (!branchId || sub.branchId === branchId))
    .flatMap(sub => (sub.rows || []).map(row => ({
      ...row,
      branchId: row.branchId || sub.branchId || null,
      branchName: row.branchName || ((s.branches || []).find(b => b.id === sub.branchId)?.name || sub.branchId),
      submissionId: sub.id,
      submissionStatus: sub.status,
    })));
}

function getPayrollRowsForRange(startDate, endDate) {
  const companyRows = getCompanyPayrollUsers().map(user => buildPayrollRowForDateRange(user, startDate, endDate));
  const approvedRows = getApprovedBranchSubmissionPayrollRows(startDate, endDate);
  if (!approvedRows.length) return companyRows;
  const rowMap = new Map();
  approvedRows.forEach(row => { if (row.userId) rowMap.set(row.userId, row); });
  companyRows.forEach(row => { if (!rowMap.has(row.userId)) rowMap.set(row.userId, row); });
  return Array.from(rowMap.values());
}

function getPayrollRunsHistory() {
  return (getState().payrollRuns || []).slice().sort((a, b) => {
    const diff = getDateOnlyKey(b.periodStart).localeCompare(getDateOnlyKey(a.periodStart));
    if (diff !== 0) return diff;
    return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
  });
}

function buildPayrollRow(user, periodKey) {
  const s = getState();
  const monthKey = periodKey || new Date().toISOString().slice(0, 7);
  const attendanceDays = (s.attendanceRecords || []).filter(r =>
    r.userId === user.id && r.timeIn && r.timeOut && r.date && r.date.startsWith(monthKey)
  ).length;
  const dailyRate = user.dailyRate || 600;
  const calc = calcPayrollAmounts(attendanceDays, dailyRate);
  return {
    userId: user.id,
    name: user.name || user.username || 'Unnamed Employee',
    role: user.role,
    branchId: user.branchId || null,
    attendanceDays,
    dailyRate,
    gross: calc.gross,
    sss: calc.sss,
    phic: calc.phic,
    hdmf: calc.hdmf,
    deductions: calc.deductions,
    net: calc.net,
  };
}

function getPayrollStatusBadge(status) {
  const value = String(status || 'pending').toLowerCase();
  const cls = value === 'approved' || value === 'sent'
    ? 'badge-success'
    : value === 'partial'
      ? 'badge-warning'
      : value === 'rejected'
        ? 'badge-danger'
        : value === 'draft'
          ? 'badge-neutral'
          : 'badge-warning';
  return `<span class="badge ${cls}">${value}</span>`;
}

function getBranchPayrollHistory(branchId) {
  return (getState().payrollSubmissions || [])
    .filter(sub => sub.branchId === branchId)
    .slice()
    .sort((a, b) => {
      const diff = getPayrollPeriodSortValue(b.periodKey) - getPayrollPeriodSortValue(a.periodKey);
      if (diff !== 0) return diff;
      return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    });
}

function getEmployeePayrollHistory(userId) {
  const s = getState();
  const currentPeriodKey = new Date().toISOString().slice(0, 7);
  const history = (s.payrollSubmissions || []).reduce((list, sub) => {
    const row = (sub.rows || []).find(item => item.userId === userId);
    if (!row) return list;
    list.push({
      ...row,
      periodKey: sub.periodKey,
      status: sub.status || 'pending',
      reviewedAt: sub.reviewedAt || null,
    });
    return list;
  }, []);

  if (!history.some(item => item.periodKey === currentPeriodKey)) {
    const user = (s.users || []).find(u => u.id === userId);
    if (user) history.push({ ...buildPayrollRow(user, currentPeriodKey), periodKey: currentPeriodKey, status: 'draft', reviewedAt: null });
  }

  return history.sort((a, b) => getPayrollPeriodSortValue(b.periodKey) - getPayrollPeriodSortValue(a.periodKey));
}

function viewPayrollSubmissionDetails(submissionId) {
  const s = getState();
  const submission = (s.payrollSubmissions || []).find(item => item.id === submissionId);
  if (!submission) { showToast('Payroll submission not found.', 'error'); return; }
  const branch = (s.branches || []).find(b => b.id === submission.branchId);
  const rows = submission.rows || [];
  const totalDeductions = rows.reduce((sum, row) => sum + (row.deductions || (row.sss || 0) + (row.phic || 0) + (row.hdmf || 0)), 0);
  showModal(`
    <div class="modal-header"><h2>Payroll Details</h2><button class="btn-close-modal" onclick="closeModal()">X</button></div>
    <div class="modal-body">
      <div class="payroll-detail-grid">
        <div class="payroll-detail-card"><label>Branch</label><strong>${branch?.name || submission.branchId}</strong></div>
        <div class="payroll-detail-card"><label>Period</label><strong>${getPayrollPeriodLabel(submission.periodKey)}</strong></div>
        <div class="payroll-detail-card"><label>Status</label><strong>${submission.status || 'pending'}</strong></div>
        <div class="payroll-detail-card"><label>Total Net Pay</label><strong>PHP ${fmt(submission.totalNet || 0)}</strong></div>
      </div>
      <div class="alert alert-info" style="margin:16px 0 0">This list shows who will be paid and how much for the selected payroll period.</div>
      <div class="data-card" style="margin-top:16px">
        <div class="data-card-body no-pad">
          <table class="data-table">
            <thead><tr><th>Employee</th><th>Role</th><th>Days</th><th>Daily Rate</th><th>Gross</th><th>Deductions</th><th>Net</th></tr></thead>
            <tbody>${rows.length ? rows.map(row => `<tr>
              <td>${row.name}</td>
              <td>${getRoleLabel(row.role)}</td>
              <td class="td-mono">${row.attendanceDays || 0}</td>
              <td class="td-mono">PHP ${fmt(row.dailyRate || 0)}</td>
              <td class="td-mono">PHP ${fmt(row.gross || 0)}</td>
              <td class="td-mono" style="color:var(--danger)">PHP ${fmt(row.deductions || ((row.sss || 0) + (row.phic || 0) + (row.hdmf || 0)))}</td>
              <td class="td-mono" style="color:var(--success);font-weight:700">PHP ${fmt(row.net || 0)}</td>
            </tr>`).join('') : '<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--ink-60)">No payroll rows found.</td></tr>'}</tbody>
          </table>
        </div>
      </div>
      <div class="payroll-detail-footer">
        <span>Total employees: <strong>${submission.employeeCount || rows.length}</strong></span>
        <span>Total deductions: <strong>PHP ${fmt(totalDeductions)}</strong></span>
        <span>Total net pay: <strong>PHP ${fmt(submission.totalNet || 0)}</strong></span>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeModal()">Close</button>
    </div>`, 'modal-lg');
}

function setPayrollRunStartDate(value) {
  window._adminPayrollRunStartDate = value;
  if (currentPage === 'admin-payslip-gen') renderAdminPayslipGen();
  else renderPayroll();
}

function setPayrollRunEndDate(value) {
  window._adminPayrollRunEndDate = value;
  if (currentPage === 'admin-payslip-gen') renderAdminPayslipGen();
  else renderPayroll();
}

function viewPayrollRunDetails(runId) {
  const s = getState();
  const run = (s.payrollRuns || []).find(item => item.id === runId);
  if (!run) { showToast('Payroll list not found.', 'error'); return; }
  const rows = run.rows || [];
  showModal(`
    <div class="modal-header"><h2>Payroll List Details</h2><button class="btn-close-modal" onclick="closeModal()">X</button></div>
    <div class="modal-body">
      <div class="payroll-detail-grid">
        <div class="payroll-detail-card"><label>Payroll Period</label><strong>${run.periodLabel || getPayrollDateRangeLabel(run.periodStart, run.periodEnd)}</strong></div>
        <div class="payroll-detail-card"><label>Date Range</label><strong>${run.periodStart} → ${run.periodEnd}</strong></div>
        <div class="payroll-detail-card"><label>Status</label><strong>${run.status || 'draft'}</strong></div>
        <div class="payroll-detail-card"><label>Payslips Sent</label><strong>${run.payslipsSentCount || 0} / ${run.employeeCount || rows.length}</strong></div>
      </div>
      <div class="data-card" style="margin-top:16px">
        <div class="data-card-body no-pad">
          <table class="data-table">
            <thead><tr><th>Employee</th><th>Branch</th><th>Role</th><th>Days</th><th>Daily Rate</th><th>Gross</th><th>Deductions</th><th>Net</th></tr></thead>
            <tbody>${rows.length ? rows.map(row => {
    const branch = (s.branches || []).find(b => b.id === row.branchId);
    return `<tr>
                <td>${row.name}</td>
                <td>${branch?.name || row.branchId || 'Unassigned'}</td>
                <td>${getRoleLabel(row.role)}</td>
                <td class="td-mono">${row.attendanceDays || 0}</td>
                <td class="td-mono">PHP ${fmt(row.dailyRate || 0)}</td>
                <td class="td-mono">PHP ${fmt(row.gross || 0)}</td>
                <td class="td-mono" style="color:var(--danger)">PHP ${fmt(row.deductions || ((row.sss || 0) + (row.phic || 0) + (row.hdmf || 0)))}</td>
                <td class="td-mono" style="color:var(--success);font-weight:700">PHP ${fmt(row.net || 0)}</td>
              </tr>`;
  }).join('') : '<tr><td colspan="8" style="text-align:center;padding:24px;color:var(--ink-60)">No payroll rows found.</td></tr>'}</tbody>
          </table>
        </div>
      </div>
      <div class="payroll-detail-footer">
        <span>Total employees: <strong>${run.employeeCount || rows.length}</strong></span>
        <span>Total deductions: <strong>PHP ${fmt(run.totalDeductions || 0)}</strong></span>
        <span>Total net pay: <strong>PHP ${fmt(run.totalNet || 0)}</strong></span>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeModal()">Close</button>
      <button class="btn btn-maroon" onclick="closeModal();sendPayrollRunPayslips('${run.id}')">Send All Payslips</button>
    </div>`, 'modal-lg');
}

function showCreatePayrollPreviewModal() {
  const s = getState();
  const me = s.currentUser;
  if (!me || !['admin', 'hr'].includes(normalizeRole(me.role))) {
    showToast('Only Main Admin or HR can create a payroll list.', 'error');
    return;
  }

  const startDate = document.getElementById('admin-payroll-run-start')?.value || window._adminPayrollRunStartDate || '';
  const endDate = document.getElementById('admin-payroll-run-end')?.value || window._adminPayrollRunEndDate || '';
  if (!startDate || !endDate) { showToast('Please choose the payroll date range.', 'error'); return; }
  if (startDate > endDate) { showToast('Payroll start date cannot be later than end date.', 'error'); return; }

  const approvedRows = getApprovedBranchSubmissionPayrollRows(startDate, endDate);
  const previewRows = approvedRows;
  const totalGross = previewRows.reduce((sum, r) => sum + (r.gross || 0), 0);
  const totalDeductions = previewRows.reduce((sum, r) => sum + (r.deductions || 0), 0);
  const totalNet = previewRows.reduce((sum, r) => sum + (r.net || 0), 0);
  const periodLabel = getPayrollDateRangeLabel(startDate, endDate);

  const rowsHtml = previewRows.length
    ? previewRows.map(row => `
        <tr>
          <td><strong>${row.name}</strong><br><span style="font-size:11px;color:var(--ink-60)">${getRoleLabel(row.role)}</span></td>
          <td class="td-mono">${row.attendanceDays}</td>
          <td class="td-mono">PHP ${fmt(row.dailyRate)}</td>
          <td class="td-mono" style="color:var(--maroon);font-weight:600">PHP ${fmt(row.gross)}</td>
          <td class="td-mono" style="color:var(--danger)">PHP ${fmt(row.deductions)}</td>
          <td class="td-mono" style="color:var(--success);font-weight:700">PHP ${fmt(row.net)}</td>
        </tr>`).join('')
    : `<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--ink-60)">No employees found.</td></tr>`;

  showModal(`
    <div class="modal-header">
      <h2>${iconSvg('money')} Payroll Preview</h2>
      <button class="btn-close-modal" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-body" style="padding:0">
      <div style="padding:14px 20px 10px;background:var(--surface-2,#f9f9f9);border-bottom:1px solid var(--border)">
        <div style="font-size:13px;color:var(--ink-60);margin-bottom:2px">Payroll Period</div>
        <div style="font-weight:700;font-size:15px">${periodLabel}</div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:0;border-bottom:1px solid var(--border)">
        <div style="padding:12px 16px;border-right:1px solid var(--border)">
          <div style="font-size:11px;color:var(--ink-60);text-transform:uppercase;letter-spacing:.5px">Employees</div>
          <div style="font-size:20px;font-weight:700;margin-top:2px">${previewRows.length}</div>
        </div>
        <div style="padding:12px 16px;border-right:1px solid var(--border)">
          <div style="font-size:11px;color:var(--ink-60);text-transform:uppercase;letter-spacing:.5px">Total Gross</div>
          <div style="font-size:18px;font-weight:700;color:var(--maroon);margin-top:2px">PHP ${fmt(totalGross)}</div>
        </div>
        <div style="padding:12px 16px;border-right:1px solid var(--border)">
          <div style="font-size:11px;color:var(--ink-60);text-transform:uppercase;letter-spacing:.5px">Total Deductions</div>
          <div style="font-size:18px;font-weight:700;color:var(--danger);margin-top:2px">PHP ${fmt(totalDeductions)}</div>
        </div>
        <div style="padding:12px 16px">
          <div style="font-size:11px;color:var(--ink-60);text-transform:uppercase;letter-spacing:.5px">Total Net Pay</div>
          <div style="font-size:18px;font-weight:700;color:var(--success);margin-top:2px">PHP ${fmt(totalNet)}</div>
        </div>
      </div>
      ${approvedRows.length ? `<div class="alert alert-info" style="margin:0 16px 10px 16px">${iconSvg('check')} Using approved consolidated branch payroll submissions for ${periodLabel}.</div>` : `<div class="alert alert-warning" style="margin:0 16px 10px 16px">${iconSvg('info')} No approved consolidated branch payroll submissions were found for ${periodLabel}. Only approved payrolls can be included in this payroll run.</div>`}
      <div style="max-height:340px;overflow-y:auto">
        <table class="data-table" style="margin:0">
          <thead>
            <tr>
              <th>Employee</th>
              <th>Days</th>
              <th>Daily Rate</th>
              <th>Gross</th>
              <th>Deductions</th>
              <th>Net Pay</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>
      <div style="padding:10px 16px;background:var(--surface-2,#f9f9f9);border-top:1px solid var(--border);font-size:12px;color:var(--ink-60)">
        ${iconSvg('info')} Review the figures above. Click <strong>Confirm &amp; Create</strong> to save this payroll.
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
      <button class="btn btn-maroon" onclick="closeModal(); createPayrollRun()">${iconSvg('money')} Confirm &amp; Create Payroll</button>
    </div>
  `, 'modal-lg');
}

async function createPayrollRun() {
  const s = getState();
  const me = s.currentUser;
  if (!me || !['admin', 'hr'].includes(normalizeRole(me.role))) {
    showToast('Only Main Admin or HR can create a payroll list.', 'error');
    return;
  }

  const startDate = document.getElementById('admin-payroll-run-start')?.value || window._adminPayrollRunStartDate || '';
  const endDate = document.getElementById('admin-payroll-run-end')?.value || window._adminPayrollRunEndDate || '';
  if (!startDate || !endDate) { showToast('Please choose the payroll date range.', 'error'); return; }
  if (startDate > endDate) { showToast('Payroll start date cannot be later than end date.', 'error'); return; }

  const rows = getApprovedBranchSubmissionPayrollRows(startDate, endDate);
  if (!rows.length) { showToast('No approved payroll submissions found for this date range. Please approve branch payrolls first.', 'error'); return; }
  const periodKey = getPayrollDateRangeKey(startDate, endDate);
  const existing = (s.payrollRuns || []).find(run => run.periodKey === periodKey);
  const nowIso = new Date().toISOString();
  const payload = {
    id: existing?.id || ('prun_' + Date.now()),
    periodKey,
    periodLabel: getPayrollDateRangeLabel(startDate, endDate),
    periodStart: startDate,
    periodEnd: endDate,
    createdBy: me.id,
    createdByName: me.name || me.username,
    employeeCount: rows.length,
    totalGross: rows.reduce((sum, row) => sum + (row.gross || 0), 0),
    totalDeductions: rows.reduce((sum, row) => sum + (row.deductions || 0), 0),
    totalNet: rows.reduce((sum, row) => sum + (row.net || 0), 0),
    payslipsSentCount: existing?.payslipsSentCount || 0,
    rows,
    status: existing?.status || 'draft',
    sentAt: existing?.sentAt || null,
    createdAt: existing?.createdAt || nowIso,
    updatedAt: nowIso,
  };

  try {
    const saved = (typeof DB !== 'undefined' && DB.savePayrollRun) ? await DB.savePayrollRun(payload) : payload;
    const nextRun = {
      ...payload,
      ...(saved || {}),
      rows: Array.isArray(saved?.rows) ? saved.rows : rows,
    };
    s.payrollRuns = (s.payrollRuns || []).filter(run => run.id !== nextRun.id && run.periodKey !== nextRun.periodKey);
    s.payrollRuns.unshift(nextRun);
    saveState(s);
    showToast(`Payroll list created for ${nextRun.periodLabel}.`, 'success');
    if (currentPage === 'admin-payslip-gen') renderAdminPayslipGen();
    else renderPayroll();
  } catch (e) {
    showToast('Failed to create payroll list: ' + e.message, 'error');
  }
}


async function deletePayrollRun(runId) {
  const s = getState();
  const me = s.currentUser;
  if (!me || !['admin', 'hr'].includes(normalizeRole(me.role))) {
    showToast('Only Main Admin or HR can delete a payroll list.', 'error');
    return;
  }
  const run = (s.payrollRuns || []).find(r => r.id === runId);
  const label = run ? (run.periodLabel || (run.periodStart + ' to ' + run.periodEnd)) : runId;
  if (!confirm(`Delete payroll list "${label}"?\n\nThis action cannot be undone.`)) return;
  try {
    if (typeof DB !== 'undefined' && DB.deletePayrollRun) await DB.deletePayrollRun(runId);
    s.payrollRuns = (s.payrollRuns || []).filter(r => r.id !== runId);
    saveState(s);
    showToast('Payroll list deleted.', 'success');
    renderAdminPayslipGen();
  } catch (e) {
    showToast('Failed to delete payroll list: ' + e.message, 'error');
  }
}

async function sendPayrollRunPayslips(runId) {
  const s = getState();
  const me = s.currentUser;
  if (!me || !['admin', 'hr'].includes(normalizeRole(me.role))) {
    showToast('Only Main Admin or HR can send payroll payslips.', 'error');
    return;
  }

  const run = (s.payrollRuns || []).find(item => item.id === runId);
  if (!run) { showToast('Payroll list not found.', 'error'); return; }

  const existingSent = new Set((s.payslips || [])
    .filter(p => p.periodKey === run.periodKey)
    .map(p => `${p.userId}::${p.periodKey}`));
  const pendingRows = (run.rows || []).filter(row => !existingSent.has(`${row.userId}::${run.periodKey}`));
  if (!pendingRows.length) {
    showToast('All payslips for this payroll list were already sent.', 'warning');
    return;
  }

  const sentAt = new Date().toISOString();
  const sentPayslips = [];
  const failures = [];

  for (const row of pendingRows) {
    const employee = (s.users || []).find(user => user.id === row.userId);
    if (!employee) {
      failures.push(`${row.name}: employee record not found`);
      continue;
    }

    const payslip = {
      id: 'pslip_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      userId: employee.id,
      employeeName: employee.name || employee.username || row.name,
      payPeriod: run.periodLabel || getPayrollDateRangeLabel(run.periodStart, run.periodEnd),
      periodKey: run.periodKey,
      dailyRate: row.dailyRate || 0,
      daysPresent: row.attendanceDays || 0,
      daysAbsent: 0,
      incentives: 0,
      grossPay: row.gross || 0,
      deductions: row.deductions || ((row.sss || 0) + (row.phic || 0) + (row.hdmf || 0)),
      sss: row.sss || 0,
      philhealth: row.phic || 0,
      hdmf: row.hdmf || 0,
      netPay: row.net || 0,
      notes: `Generated from payroll list for ${run.periodStart} → ${run.periodEnd}.`,
      sentBy: me.id,
      sentAt,
      branchId: employee.branchId || row.branchId || null,
    };

    try {
      await DB.sendPayslip(payslip);
      sentPayslips.push(payslip);
    } catch (e) {
      if (/already exists/i.test(e.message || '')) continue;
      failures.push(`${row.name}: ${e.message}`);
    }
  }

  if (sentPayslips.length) {
    s.payslips = [...sentPayslips, ...(s.payslips || [])];
    saveState(s);
  }

  const sentCount = (run.rows || []).filter(row =>
    (s.payslips || []).some(p => p.userId === row.userId && p.periodKey === run.periodKey)
  ).length;
  const nextStatus = sentCount >= (run.employeeCount || 0)
    ? 'sent'
    : sentCount > 0
      ? 'partial'
      : 'draft';
  const updatePayload = {
    payslipsSentCount: sentCount,
    status: nextStatus,
    sentAt: sentCount ? sentAt : run.sentAt || null,
    updatedAt: new Date().toISOString(),
  };

  try {
    const saved = (typeof DB !== 'undefined' && DB.updatePayrollRun)
      ? await DB.updatePayrollRun(run.id, updatePayload)
      : updatePayload;
    Object.assign(run, saved || updatePayload);
    saveState(s);
    if (failures.length) {
      showToast(`Sent ${sentPayslips.length} payslip(s). ${failures.length} failed.`, 'warning');
    } else {
      showToast(`Sent ${sentPayslips.length} payslip(s) for ${run.periodLabel}.`, 'success');
    }
    if (currentPage === 'admin-payslip-gen') renderAdminPayslipGen();
    else renderPayroll();
  } catch (e) {
    showToast('Payslips were sent, but payroll history failed to update: ' + e.message, 'error');
  }
}

function setAdminPayrollPeriod(periodKey) {
  window._adminPayrollPeriodKey = periodKey;
  renderPayroll();
}

function setBranchPayrollStartDate(value) {
  window._branchPayrollStartDate = value;
  if (currentPage === 'admin-payslip-gen') renderAdminPayslipGen();
  else renderPayroll();
}

function setBranchPayrollEndDate(value) {
  window._branchPayrollEndDate = value;
  if (currentPage === 'admin-payslip-gen') renderAdminPayslipGen();
  else renderPayroll();
}

function renderPayroll() {
  const s = getState();
  const me = s.currentUser;
  if (!me) { accessDenied('Payroll'); return; }
  const role = normalizeRole(me.role);
  const now = new Date();
  const currentPeriodKey = now.toISOString().slice(0, 7);
  const currentPeriodLabel = getPayrollPeriodLabel(currentPeriodKey);

  if (role === 'cashier' || role === 'inventory_staff' || role === 'print') {
    const currentPayroll = buildPayrollRow(me, currentPeriodKey);
    const myPayslips = (s.payslips || []).filter(p => p.userId === me.id);
    const payrollHistory = getEmployeePayrollHistory(me.id);
    document.getElementById('page-content').innerHTML = `
      <div class="page-header"><h1 class="page-title">My Payroll</h1><p class="page-subtitle">Attendance-based payroll for ${currentPeriodLabel}, plus previous payroll history.</p></div>
      <div class="payroll-summary">
        <div class="payroll-item"><label>Days Present</label><strong>${currentPayroll.attendanceDays}</strong></div>
        <div class="payroll-item"><label>Daily Rate</label><strong>PHP ${fmt(currentPayroll.dailyRate)}</strong></div>
        <div class="payroll-item"><label>Gross Pay</label><strong>PHP ${fmt(currentPayroll.gross)}</strong></div>
        <div class="payroll-item"><label>SSS (4.5%)</label><strong style="color:var(--danger)">PHP ${fmt(currentPayroll.sss)}</strong></div>
        <div class="payroll-item"><label>PhilHealth (2.5%)</label><strong style="color:var(--danger)">PHP ${fmt(currentPayroll.phic)}</strong></div>
        <div class="payroll-item"><label>Pag-IBIG (2%)</label><strong style="color:var(--danger)">PHP ${fmt(currentPayroll.hdmf)}</strong></div>
        <div class="payroll-item"><label>Net Pay</label><strong style="color:var(--success);font-size:1.15em">PHP ${fmt(currentPayroll.net)}</strong></div>
      </div>
      <div class="alert alert-info" style="margin-top:16px;">${iconSvg('clock')} Based on <strong>${currentPayroll.attendanceDays}</strong> attendance records with completed time-in and time-out. Previous months such as April will appear in the history table below once payroll has been submitted.</div>
      <div class="data-card" style="margin-top:18px">
        <div class="data-card-header"><span class="data-card-title">Payroll History</span><span class="badge badge-neutral">${payrollHistory.length} period${payrollHistory.length !== 1 ? 's' : ''}</span></div>
        <div class="data-card-body no-pad">
          <table class="data-table">
            <thead><tr><th>Period</th><th>Days Worked</th><th>Gross</th><th>Deductions</th><th>Net</th><th>Status</th><th>Document</th></tr></thead>
            <tbody>${payrollHistory.length ? payrollHistory.map(row => {
      const payslip = myPayslips.find(p => p.periodKey === row.periodKey);
      return `<tr>
                <td><strong>${getPayrollPeriodLabel(row.periodKey)}</strong></td>
                <td class="td-mono">${row.attendanceDays || 0}</td>
                <td class="td-mono">PHP ${fmt(row.gross || 0)}</td>
                <td class="td-mono" style="color:var(--danger)">PHP ${fmt(row.deductions || ((row.sss || 0) + (row.phic || 0) + (row.hdmf || 0)))}</td>
                <td class="td-mono" style="color:var(--success);font-weight:700">PHP ${fmt(row.net || 0)}</td>
                <td>${getPayrollStatusBadge(row.status)}</td>
                <td>${payslip ? `<button class="btn btn-sm btn-maroon" onclick="viewSentPayslipModal('${payslip.id}')">View Payslip</button>` : '<span style="color:var(--ink-60)">Payroll record</span>'}</td>
              </tr>`;
    }).join('') : '<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--ink-60)">No payroll history available yet.</td></tr>'}</tbody>
          </table>
        </div>
      </div>`;
    return;
  }

  if (role === 'branch_manager') {
    const branch = (s.branches || []).find(b => b.id === me.branchId);
    const defaultStart = window._branchPayrollStartDate || toLocalDateString(new Date(now.getFullYear(), now.getMonth(), 1));
    const defaultEnd = window._branchPayrollEndDate || toLocalDateString(new Date(now.getFullYear(), now.getMonth() + 1, 0));
    const selectedStart = defaultStart;
    const selectedEnd = defaultEnd;
    window._branchPayrollStartDate = selectedStart;
    window._branchPayrollEndDate = selectedEnd;
    const selectedPeriodKey = getPayrollDateRangeKey(selectedStart, selectedEnd);
    const rows = buildBranchPayrollRows(me.branchId, selectedStart, selectedEnd);
    const existing = (s.payrollSubmissions || []).find(x => x.branchId === me.branchId && x.periodKey === selectedPeriodKey);
    const duplicateSubmission = (s.payrollSubmissions || []).find(x => x.branchId === me.branchId && x.periodKey === selectedPeriodKey);
    const isRangeValid = selectedStart && selectedEnd && selectedStart <= selectedEnd;
    const history = getBranchPayrollHistory(me.branchId);
    const totalGross = rows.reduce((sum, row) => sum + row.gross, 0);
    const totalNet = rows.reduce((sum, row) => sum + row.net, 0);
    document.getElementById('page-content').innerHTML = `
      <div class="page-header"><h1 class="page-title">Branch Payroll</h1><p class="page-subtitle">Prepare payroll with attendance and forward it to Main Admin for consolidation.</p></div>
      <div class="alert alert-info">${iconSvg('clock')} Branch: <strong>${branch?.name || me.branchId || 'Unassigned'}</strong> | Period: <strong>${getPayrollDateRangeLabel(selectedStart, selectedEnd)}</strong></div>
      <div class="data-card" style="margin-top:12px">
        <div class="data-card-header"><span class="data-card-title">Payroll Range</span></div>
        <div class="data-card-body" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;align-items:end">
          <div><label class="form-label">Start Date</label><input type="date" class="form-control" value="${selectedStart}" onchange="setBranchPayrollStartDate(this.value)"></div>
          <div><label class="form-label">End Date</label><input type="date" class="form-control" value="${selectedEnd}" onchange="setBranchPayrollEndDate(this.value)"></div>
          <div style="display:flex;flex-direction:column;gap:8px"><span class="form-label">Actions</span><button class="btn btn-sm btn-maroon" onclick="openBranchPayrollReviewModal()" ${!isRangeValid ? 'disabled' : ''}>${existing ? 'Review & Resubmit Payroll' : 'Review Payroll Before Submit'}</button></div>
        </div>
        <div class="data-card-body">
          <div class="alert ${isRangeValid ? 'alert-info' : 'alert-danger'}">${isRangeValid ? 'Choose the date range to submit and then review payroll for this branch.' : 'The selected payroll range is invalid. Please ensure the end date is on or after the start date.'}</div>
          ${duplicateSubmission ? `<div class="alert alert-warning">A payroll for this exact date range has already been submitted. Review or resubmit if you need to make updates.</div>` : ''}
        </div>
      </div>
      <div class="payroll-summary">
        <div class="payroll-item"><label>Employees To Pay</label><strong>${rows.length}</strong></div>
        <div class="payroll-item"><label>Total Gross</label><strong>PHP ${fmt(totalGross)}</strong></div>
        <div class="payroll-item"><label>Total Net</label><strong style="color:var(--success)">PHP ${fmt(totalNet)}</strong></div>
      </div>
      <div class="data-card"><div class="data-card-header"><span class="data-card-title">Payroll List</span></div>
        <div class="data-card-body"><div class="alert alert-info">This table answers who will be paid and how much for this branch for the selected date range.</div></div>
        <div class="data-card-body no-pad"><table class="data-table"><thead><tr><th>Employee</th><th>Role</th><th>Attendance Days</th><th>Daily Rate</th><th>Gross</th><th>Deductions</th><th>Net</th></tr></thead><tbody>${rows.length ? rows.map(row => `<tr><td>${row.name}</td><td>${getRoleLabel(row.role)}</td><td class="td-mono">${row.attendanceDays}</td><td class="td-mono">PHP ${fmt(row.dailyRate)}</td><td class="td-mono">PHP ${fmt(row.gross)}</td><td class="td-mono" style="color:var(--danger)">PHP ${fmt(row.deductions || 0)}</td><td class="td-mono" style="color:var(--success);font-weight:700">PHP ${fmt(row.net)}</td></tr>`).join('') : '<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--ink-60)">No branch personnel found.</td></tr>'}</tbody></table></div>
      </div>
      ${existing ? `<div class="alert alert-warning" style="margin-top:16px">Latest submission status: <strong>${existing.status}</strong>${existing.reviewedAt ? ` | Reviewed ${fmtTime(existing.reviewedAt)}` : ''}</div>` : ''}
      <div class="data-card" style="margin-top:18px">
        <div class="data-card-header"><span class="data-card-title">Payroll History</span><span class="badge badge-neutral">${history.length} submission${history.length !== 1 ? 's' : ''}</span></div>
        <div class="data-card-body no-pad"><table class="data-table"><thead><tr><th>Period</th><th>Employees</th><th>Total Gross</th><th>Total Net</th><th>Status</th><th>Reviewed</th><th>Action</th></tr></thead><tbody>${history.length ? history.map(sub => `<tr><td><strong>${getPayrollPeriodLabel(sub.periodKey)}</strong></td><td class="td-mono">${sub.employeeCount || 0}</td><td class="td-mono">PHP ${fmt(sub.totalGross || 0)}</td><td class="td-mono">PHP ${fmt(sub.totalNet || 0)}</td><td>${getPayrollStatusBadge(sub.status)}</td><td>${sub.reviewedAt ? fmtTime(sub.reviewedAt) : 'Pending Review'}</td><td><button class="btn btn-sm btn-outline" onclick="viewPayrollSubmissionDetails('${sub.id}')">View List</button></td></tr>`).join('') : '<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--ink-60)">No payroll history yet.</td></tr>'}</tbody></table></div>
      </div>`;
    return;
  }

  const submissions = (s.payrollSubmissions || []).slice().sort((a, b) => {
    const diff = getPayrollPeriodSortValue(b.periodKey) - getPayrollPeriodSortValue(a.periodKey);
    if (diff !== 0) return diff;
    return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
  });
  const payrollRuns = getPayrollRunsHistory();
  const employees = (s.users || []).filter(u => normalizeRole(u.role) !== 'admin');
  const availablePeriods = [...new Set(submissions.map(sub => sub.periodKey).filter(Boolean))]
    .sort((a, b) => getPayrollPeriodSortValue(b) - getPayrollPeriodSortValue(a));
  const activePeriodKey = availablePeriods.includes(window._adminPayrollPeriodKey)
    ? window._adminPayrollPeriodKey
    : (availablePeriods[0] || currentPeriodKey);
  const defaultRunStart = window._adminPayrollRunStartDate || toLocalDateString(new Date(now.getFullYear(), now.getMonth(), 1));
  const defaultRunEnd = window._adminPayrollRunEndDate || toLocalDateString(new Date(now.getFullYear(), now.getMonth() + 1, 0));
  window._adminPayrollRunStartDate = defaultRunStart;
  window._adminPayrollRunEndDate = defaultRunEnd;
  const payrollPreviewRows = defaultRunStart && defaultRunEnd && defaultRunStart <= defaultRunEnd
    ? getCompanyPayrollUsers().map(user => buildPayrollRowForDateRange(user, defaultRunStart, defaultRunEnd))
    : [];
  const previewGross = payrollPreviewRows.reduce((sum, row) => sum + (row.gross || 0), 0);
  const previewDeductions = payrollPreviewRows.reduce((sum, row) => sum + (row.deductions || 0), 0);
  const previewNet = payrollPreviewRows.reduce((sum, row) => sum + (row.net || 0), 0);
  window._adminPayrollPeriodKey = activePeriodKey;
  const consolidatedRows = submissions
    .filter(sub => sub.periodKey === activePeriodKey)
    .flatMap(sub => (sub.rows || []).map(row => {
      const branch = (s.branches || []).find(b => b.id === sub.branchId);
      return {
        ...row,
        submissionId: sub.id,
        submissionStatus: sub.status,
        branchName: branch?.name || sub.branchId,
      };
    }));
  const consolidatedNet = consolidatedRows.reduce((sum, row) => sum + (row.net || 0), 0);
  document.getElementById('page-content').innerHTML = `
    <div class="page-header"><h1 class="page-title">Payroll Consolidation</h1><p class="page-subtitle">Review branch submissions, approve payroll, and consolidate all branches.</p></div>
    <div class="kpi-grid" style="grid-template-columns:repeat(3,1fr)">
      <div class="kpi-card"><div class="kpi-header"><div class="kpi-label">Pending Submissions</div><div class="kpi-icon gold">${iconSvg('clock')}</div></div><div class="kpi-value">${submissions.filter(x => x.status === 'pending').length}</div></div>
      <div class="kpi-card"><div class="kpi-header"><div class="kpi-label">Approved Branch Payrolls</div><div class="kpi-icon green">${iconSvg('check')}</div></div><div class="kpi-value">${submissions.filter(x => x.status === 'approved').length}</div></div>
      <div class="kpi-card"><div class="kpi-header"><div class="kpi-label">Employees Consolidated</div><div class="kpi-icon blue">${iconSvg('users')}</div></div><div class="kpi-value">${employees.length}</div></div>
    </div>
    <div class="data-card" style="margin-top:18px">
      <div class="data-card-header">
        <span class="data-card-title">Payroll List</span>
        ${availablePeriods.length ? `<select class="form-control payroll-period-select" onchange="setAdminPayrollPeriod(this.value)">${availablePeriods.map(periodKey => `<option value="${periodKey}" ${periodKey === activePeriodKey ? 'selected' : ''}>${getPayrollPeriodLabel(periodKey)}</option>`).join('')}</select>` : '<span class="badge badge-neutral">No submitted months yet</span>'}
      </div>
      <div class="data-card-body"><div class="alert alert-info">Use this list to see who will be paid and how much for the selected payroll month.</div></div>
      <div class="data-card-body no-pad"><table class="data-table"><thead><tr><th>Employee</th><th>Branch</th><th>Role</th><th>Days</th><th>Daily Rate</th><th>Gross</th><th>Deductions</th><th>Net</th><th>Status</th></tr></thead><tbody>${consolidatedRows.length ? consolidatedRows.map(row => `<tr><td>${row.name}</td><td>${row.branchName}</td><td>${getRoleLabel(row.role)}</td><td class="td-mono">${row.attendanceDays || 0}</td><td class="td-mono">PHP ${fmt(row.dailyRate || 0)}</td><td class="td-mono">PHP ${fmt(row.gross || 0)}</td><td class="td-mono" style="color:var(--danger)">PHP ${fmt(row.deductions || ((row.sss || 0) + (row.phic || 0) + (row.hdmf || 0)))}</td><td class="td-mono" style="color:var(--success);font-weight:700">PHP ${fmt(row.net || 0)}</td><td>${getPayrollStatusBadge(row.submissionStatus)}</td></tr>`).join('') : '<tr><td colspan="9" style="text-align:center;padding:24px;color:var(--ink-60)">No payroll rows found for this month.</td></tr>'}</tbody></table></div>
      <div class="data-card-body"><div class="payroll-detail-footer"><span>Selected period: <strong>${getPayrollPeriodLabel(activePeriodKey)}</strong></span><span>Employees listed: <strong>${consolidatedRows.length}</strong></span><span>Total net pay: <strong>PHP ${fmt(consolidatedNet)}</strong></span></div></div>
    </div>
    <div class="data-card" style="margin-top:18px"><div class="data-card-header"><span class="data-card-title">Branch Payroll Submissions</span></div>
      <div class="data-card-body no-pad"><table class="data-table"><thead><tr><th>Branch</th><th>Period</th><th>Employees</th><th>Total Net</th><th>Status</th><th>Action</th></tr></thead><tbody>${submissions.length ? submissions.map(sub => {
    const branch = (s.branches || []).find(b => b.id === sub.branchId); const actionButtons = [];
    actionButtons.push(`<button class="btn btn-sm btn-outline" onclick="viewPayrollSubmissionDetails('${sub.id}')">View</button>`);
    if (sub.status === 'pending') {
      actionButtons.push(`<button class="btn btn-sm btn-maroon" onclick="approvePayrollSubmission('${sub.id}')">Approve</button>`);
      actionButtons.push(`<button class="btn btn-sm btn-danger" onclick="rejectPayrollSubmission('${sub.id}')">Reject</button>`);
    }
    return `<tr><td>${branch?.name || sub.branchId}</td><td>${getPayrollPeriodLabel(sub.periodKey)}</td><td class="td-mono">${sub.employeeCount || 0}</td><td class="td-mono">PHP ${fmt(sub.totalNet || 0)}</td><td><span class="badge ${sub.status === 'approved' ? 'badge-success' : sub.status === 'rejected' ? 'badge-danger' : 'badge-warning'}">${sub.status}</span></td><td>${actionButtons.join(' ')}</td></tr>`;
  }).join('') : '<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--ink-60)">No payroll submissions yet.</td></tr>'}</tbody></table></div>
    </div>`;
}

async function submitBranchPayroll() {
  const s = getState();
  const me = s.currentUser;
  if (!me || normalizeRole(me.role) !== 'branch_manager') {
    showToast('Only the Branch Manager can submit branch payroll.', 'error');
    return;
  }
  const startDate = window._branchPayrollStartDate;
  const endDate = window._branchPayrollEndDate;
  const periodKey = getPayrollDateRangeKey(startDate, endDate);
  if (!periodKey || !startDate || !endDate || startDate > endDate) {
    showToast('Please select a valid payroll date range before submitting.', 'error');
    return;
  }
  const existing = (s.payrollSubmissions || []).find(x => x.branchId === me.branchId && x.periodKey === periodKey);
  if (existing && (!window._branchPayrollReviewRows || !window._branchPayrollReviewRows.length)) {
    showToast('A payroll has already been submitted for this exact date range.', 'error');
    return;
  }
  const rows = (window._branchPayrollReviewRows || []).length ? window._branchPayrollReviewRows : buildBranchPayrollRows(me.branchId, startDate, endDate);
  const timestamp = new Date().toISOString();
  const payload = {
    id: (existing?.id) || ('paysub_' + Date.now()),
    branchId: me.branchId,
    periodKey,
    submittedBy: me.id,
    submittedByName: me.name || me.username,
    employeeCount: rows.length,
    totalGross: rows.reduce((sum, row) => sum + (row.gross || 0), 0),
    totalNet: rows.reduce((sum, row) => sum + row.net, 0),
    rows,
    status: 'pending',
    createdAt: existing?.createdAt || timestamp,
    updatedAt: timestamp,
  };
  try {
    const saved = (typeof DB !== 'undefined' && DB.savePayrollSubmission) ? await DB.savePayrollSubmission(payload) : payload;
    const nextSubmission = {
      ...payload,
      ...(saved || {}),
      rows: Array.isArray(saved?.rows) ? saved.rows : rows,
    };
    s.payrollSubmissions = (s.payrollSubmissions || []).filter(x => !(x.branchId === me.branchId && x.periodKey === periodKey));
    s.payrollSubmissions.push(nextSubmission);
    saveState(s);
    window._branchPayrollReviewRows = [];
    showToast('Branch payroll forwarded to Main Admin.', 'success');
    renderPayroll();
  } catch (e) {
    showToast('Failed to submit payroll: ' + e.message, 'error');
  }
}

function buildBranchPayrollRows(branchId, startDate, endDate) {
  const s = getState();
  // Exclude branch managers from their own payroll submission — HR handles manager pay
  const staffUsers = (s.users || []).filter(u => {
    const r = normalizeRole(u.role);
    return r !== 'admin' && r !== 'branch_manager' && u.branchId === branchId;
  });
  const rangeStart = startDate || toLocalDateString(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const rangeEnd = endDate || toLocalDateString(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0));
  return staffUsers.map(u => buildPayrollRowForDateRange(u, rangeStart, rangeEnd));
}

function openBranchPayrollReviewModal() {
  const s = getState();
  const me = s.currentUser;
  if (!me || normalizeRole(me.role) !== 'branch_manager') { showToast('Only the Branch Manager can review branch payroll.', 'error'); return; }
  const startDate = window._branchPayrollStartDate;
  const endDate = window._branchPayrollEndDate;
  const periodKey = getPayrollDateRangeKey(startDate, endDate);
  if (!startDate || !endDate || startDate > endDate) {
    showToast('Please select a valid payroll date range before reviewing.', 'error');
    return;
  }
  const rows = buildBranchPayrollRows(me.branchId, startDate, endDate);
  window._branchPayrollReviewRows = rows;
  showModal(`
    <div class="modal-header"><h2>Review Branch Payroll</h2><button class="btn-close-modal" onclick="closeModal()">✕</button></div>
    <div class="modal-body">
      <div class="alert alert-info">Review the attendance-based payroll details below before final submission for <strong>${getPayrollDateRangeLabel(startDate, endDate)}</strong>.</div>
      <table class="data-table">
        <thead><tr><th>Employee</th><th>Attendance Days</th><th>Daily Rate</th><th>Gross</th><th>Deductions</th><th>Net</th></tr></thead>
        <tbody>${rows.length ? rows.map((row, idx) => `<tr>
          <td>${row.name}</td>
          <td class="td-mono">${row.attendanceDays}</td>
          <td><input id="payrev-rate-${idx}" type="number" class="form-control" value="${row.dailyRate}" min="0" onchange="updateBranchPayrollReviewRow(${idx})"></td>
          <td class="td-mono" id="payrev-gross-${idx}">PHP ${fmt(row.gross)}</td>
          <td class="td-mono" id="payrev-deductions-${idx}" style="color:var(--danger)">PHP ${fmt(row.deductions || 0)}</td>
          <td class="td-mono" id="payrev-net-${idx}">PHP ${fmt(row.net)}</td>
        </tr>`).join('') : '<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--ink-60)">No branch personnel found.</td></tr>'}</tbody>
      </table>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
      <button class="btn btn-maroon" onclick="confirmBranchPayrollReview()">Submit Payroll</button>
    </div>`, 'modal-lg');
}

function updateBranchPayrollReviewRow(idx) {
  const rows = window._branchPayrollReviewRows || [];
  const row = rows[idx];
  if (!row) return;
  const rate = parseFloat((document.getElementById('payrev-rate-' + idx) || {}).value) || 0;
  const calc = calcPayrollAmounts(row.attendanceDays, rate);
  row.dailyRate = rate;
  row.gross = calc.gross;
  row.sss = calc.sss;
  row.phic = calc.phic;
  row.hdmf = calc.hdmf;
  row.deductions = calc.deductions;
  row.net = calc.net;
  const grossEl = document.getElementById('payrev-gross-' + idx);
  const deductionsEl = document.getElementById('payrev-deductions-' + idx);
  const netEl = document.getElementById('payrev-net-' + idx);
  if (grossEl) grossEl.textContent = `PHP ${fmt(row.gross)}`;
  if (deductionsEl) deductionsEl.textContent = `PHP ${fmt(row.deductions || 0)}`;
  if (netEl) netEl.textContent = `PHP ${fmt(row.net)}`;
}

function confirmBranchPayrollReview() {
  closeModal();
  submitBranchPayroll();
}

async function approvePayrollSubmission(submissionId) {
  const s = getState();
  if (!s.currentUser || !['admin', 'hr'].includes(normalizeRole(s.currentUser.role))) {
    showToast('Only the Main Admin or HR / Master Payroll can approve payroll submissions.', 'error');
    return;
  }
  const sub = (s.payrollSubmissions || []).find(x => x.id === submissionId);
  if (!sub) return;
  const payload = {
    status: 'approved',
    reviewedAt: new Date().toISOString(),
    reviewedBy: s.currentUser?.id || null,
    updatedAt: new Date().toISOString(),
  };
  try {
    const saved = (typeof DB !== 'undefined' && DB.updatePayrollSubmission) ? await DB.updatePayrollSubmission(submissionId, payload) : payload;
    Object.assign(sub, saved || payload);
    saveState(s);
    showToast('Payroll submission approved and consolidated.', 'success');
    renderPayroll();
  } catch (e) {
    showToast('Failed to approve payroll: ' + e.message, 'error');
  }
}

async function rejectPayrollSubmission(submissionId) {
  const s = getState();
  if (!s.currentUser || !['admin', 'hr'].includes(normalizeRole(s.currentUser.role))) {
    showToast('Only the Main Admin or HR / Master Payroll can reject payroll submissions.', 'error');
    return;
  }
  const sub = (s.payrollSubmissions || []).find(x => x.id === submissionId);
  if (!sub) return;
  const payload = {
    status: 'rejected',
    reviewedAt: new Date().toISOString(),
    reviewedBy: s.currentUser?.id || null,
    updatedAt: new Date().toISOString(),
  };
  try {
    const saved = (typeof DB !== 'undefined' && DB.updatePayrollSubmission) ? await DB.updatePayrollSubmission(submissionId, payload) : payload;
    Object.assign(sub, saved || payload);
    saveState(s);
    showToast('Payroll submission rejected.', 'warning');
    renderPayroll();
  } catch (e) {
    showToast('Failed to reject payroll: ' + e.message, 'error');
  }
}
function getPayPeriods(userId, shifts) {
  // Group closed shifts by semi-monthly pay period:
  //   Period A: 1st–15th  → Pay Date: last day of same month
  //   Period B: 16th–EOM  → Pay Date: 15th of next month
  const periodsMap = {};
  (shifts || []).filter(sh => sh.userId === userId && sh.status !== 'open').forEach(sh => {
    const d = new Date(sh.openedAt);
    const y = d.getFullYear();
    const m = d.getMonth();
    const day = d.getDate();
    const isA = day <= 15;
    const key = `${y}-${String(m + 1).padStart(2, '0')}-${isA ? 'A' : 'B'}`;
    if (!periodsMap[key]) {
      const periodStart = isA
        ? new Date(y, m, 1)
        : new Date(y, m, 16);
      const periodEnd = isA
        ? new Date(y, m, 15)
        : new Date(y, m + 1, 0);
      const payDate = isA
        ? new Date(y, m, new Date(y, m + 1, 0).getDate()) // last day of month
        : new Date(y, m + 1, 15);                          // 15th next month
      periodsMap[key] = {
        key,
        label: `${periodStart.toLocaleDateString('en-PH', { month: 'long', day: 'numeric' })} – ${periodEnd.toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })}`,
        payDateLabel: payDate.toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' }),
        shifts: [],
        year: y,
        month: m,
      };
    }
    periodsMap[key].shifts.push(sh);
  });
  return Object.values(periodsMap).sort((a, b) => b.key.localeCompare(a.key));
}

function calcPayslip(user, periodData, state) {
  const DAILY_RATE = user.dailyRate || 400;
  const COMMISSION_CUP_RATE = user.commissionCup || 300;
  const COMMISSION_GP_RATE = user.commissionGp || 150;

  const totalDays = periodData.shifts.length;
  const basicPay = totalDays * DAILY_RATE;

  // Commission days: Opening = Cups, Closing = GP
  const openingDays = periodData.shifts.filter(sh => {
    const sk = `${user.id}_${sh.openedAt ? sh.openedAt.slice(0, 10) : ''}`;
    return (state.shiftSchedules || {})[sk] === 'On';
  }).length;
  const closingDays = periodData.shifts.filter(sh => {
    const sk = `${user.id}_${sh.openedAt ? sh.openedAt.slice(0, 10) : ''}`;
    return (state.shiftSchedules || {})[sk] === 'On';
  }).length;

  const commissionCup = openingDays * COMMISSION_CUP_RATE;
  const commissionGp = closingDays * COMMISSION_GP_RATE;
  const grossPay = basicPay + commissionCup + commissionGp;

  // Philippine statutory deductions
  const sss = Math.round(grossPay * 0.045);
  const philhealth = Math.round(grossPay * 0.025);
  const hdmf = Math.min(Math.round(grossPay * 0.02), 100);
  const totalDeductions = sss + philhealth + hdmf;
  const netPay = grossPay - totalDeductions;

  return {
    totalDays, basicPay, openingDays, closingDays,
    commissionCup, commissionGp,
    grossPay, sss, philhealth, hdmf, totalDeductions, netPay,
    dailyRate: DAILY_RATE,
    commissionCupRate: COMMISSION_CUP_RATE,
    commissionGpRate: COMMISSION_GP_RATE,
  };
}

function getYTDEarnings(userId, shifts, state) {
  const s = state;
  const u = s.users.find(x => x.id === userId);
  if (!u) return { gross: 0, deductions: 0, net: 0, periods: 0 };
  const currentYear = new Date().getFullYear();
  const yearShifts = (shifts || []).filter(sh =>
    sh.userId === userId && sh.status !== 'open' && new Date(sh.openedAt).getFullYear() === currentYear
  );
  const DAILY_RATE = u.dailyRate || 600;
  const gross = yearShifts.length * DAILY_RATE;
  const sss = Math.round(gross * 0.045);
  const philhealth = Math.round(gross * 0.025);
  const hdmf = Math.min(Math.round(gross * 0.02), 100);
  const deductions = sss + philhealth + hdmf;
  return { gross, sss, philhealth, hdmf, deductions, net: gross - deductions, shifts: yearShifts.length };
}

function buildPayslipHtml(me, period, calc, COMPANY, empNum, positionLabel) {
  const periodStart = new Date(period.startDate || period.shifts[0]?.openedAt || Date.now())
    .toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' });
  const periodEnd = new Date(period.endDate || period.shifts[period.shifts.length - 1]?.openedAt || Date.now())
    .toLocaleDateString('en-PH', { day: 'numeric', year: 'numeric' });
  return `<div style="font-family:'Arial',sans-serif;font-size:12px;color:#111;padding:24px 32px;">
    <div style="display:flex;align-items:flex-start;gap:24px;margin-bottom:16px;">
      <div style="flex-shrink:0;width:90px;"><img src="logo.png" alt="South Pafps" style="width:90px;height:auto;display:block;" onerror="this.style.display='none'"></div>
      <div style="flex:1;padding-top:4px;"><div style="font-weight:700;font-size:13px;margin-bottom:4px;">${COMPANY.name}</div><div style="font-size:11px;line-height:1.8;color:#333;">${COMPANY.address1}<br>${COMPANY.address2}<br>${COMPANY.tel}</div></div>
    </div>
    <div style="text-align:center;font-weight:700;font-size:13px;letter-spacing:3px;margin:0 0 10px;">PAYSLIP</div>
    <table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:0;">
      <colgroup><col style="width:20%"><col style="width:30%"><col style="width:20%"><col style="width:30%"></colgroup>
      <tbody>
        <tr><td style="padding:4px 8px;border:1px solid #999;"><strong>Employee Name:</strong></td><td style="padding:4px 8px;border:1px solid #999;">${me.name || '—'}</td><td style="padding:4px 8px;border:1px solid #999;"><strong>SSS Number:</strong></td><td style="padding:4px 8px;border:1px solid #999;">${me.sssNumber || ''}</td></tr>
        <tr><td style="padding:4px 8px;border:1px solid #999;"><strong>Employee Number:</strong></td><td style="padding:4px 8px;border:1px solid #999;">${empNum}</td><td style="padding:4px 8px;border:1px solid #999;"><strong>PhilHealth Number:</strong></td><td style="padding:4px 8px;border:1px solid #999;">${me.philhealthNumber || ''}</td></tr>
        <tr><td style="padding:4px 8px;border:1px solid #999;"><strong>Position:</strong></td><td style="padding:4px 8px;border:1px solid #999;">${positionLabel}</td><td style="padding:4px 8px;border:1px solid #999;"><strong>Pag-IBIG Number:</strong></td><td style="padding:4px 8px;border:1px solid #999;">${me.hdmfNumber || ''}</td></tr>
        <tr><td style="padding:4px 8px;border:1px solid #999;"><strong>Pay Period:</strong></td><td style="padding:4px 8px;border:1px solid #999;">${period.label}</td><td style="padding:4px 8px;border:1px solid #999;"><strong>TIN Number:</strong></td><td style="padding:4px 8px;border:1px solid #999;">${me.tinNumber || ''}</td></tr>
        <tr><td style="padding:4px 8px;border:1px solid #999;"><strong>Pay Date:</strong></td><td style="padding:4px 8px;border:1px solid #999;">${period.payDateLabel || '—'}</td><td style="padding:4px 8px;border:1px solid #999;"></td><td style="padding:4px 8px;border:1px solid #999;"></td></tr>
      </tbody>
    </table>
    <table style="width:100%;border-collapse:collapse;font-size:12px;margin-top:-1px;">
      <colgroup><col style="width:34%"><col style="width:9%"><col style="width:13%"><col style="width:4px"><col style="width:auto"><col style="width:14%"></colgroup>
      <thead><tr>
        <th colspan="3" style="border:1px solid #999;padding:6px 8px;text-align:left;font-weight:700;">EARNINGS/INCOME</th>
        <td style="background:#333;width:4px;padding:0;"></td>
        <th colspan="2" style="border:1px solid #999;padding:6px 8px;text-align:left;font-weight:700;">DEDUCTIONS</th>
      </tr></thead>
      <tbody>
        <tr>
          <td style="border-left:1px solid #999;padding:5px 8px;">Basic Pay @ ₱${fmt(calc.dailyRate)}/day</td>
          <td style="border-left:1px solid #ddd;padding:5px 8px;text-align:right;">${calc.totalDays}</td>
          <td style="border-left:1px solid #ddd;border-right:1px solid #999;padding:5px 8px;text-align:right;">₱${fmt(calc.basicPay)}</td>
          <td style="background:#333;width:4px;padding:0;"></td>
          <td style="border-left:1px solid #999;padding:5px 8px;">SSS EE Contribution</td>
          <td style="border-right:1px solid #999;padding:5px 8px;text-align:right;">${calc.sss > 0 ? '₱' + fmt(calc.sss) : ''}</td>
        </tr>
        <tr>
          <td style="border-left:1px solid #999;padding:5px 8px;">${calc.commissionCups > 0 ? 'Commission (Cups)' : ''}</td>
          <td style="border-left:1px solid #ddd;padding:5px 8px;text-align:right;">${calc.commissionCupsQty > 0 ? calc.commissionCupsQty : ''}</td>
          <td style="border-left:1px solid #ddd;border-right:1px solid #999;padding:5px 8px;text-align:right;">${calc.commissionCups > 0 ? '₱' + fmt(calc.commissionCups) : ''}</td>
          <td style="background:#333;width:4px;padding:0;"></td>
          <td style="border-left:1px solid #999;padding:5px 8px;">PhilHealth EE Contribution</td>
          <td style="border-right:1px solid #999;padding:5px 8px;text-align:right;">${calc.philhealth > 0 ? '₱' + fmt(calc.philhealth) : ''}</td>
        </tr>
        <tr>
          <td style="border-left:1px solid #999;padding:5px 8px;">${calc.commissionGp > 0 ? 'Commission (GP)' : ''}</td>
          <td style="border-left:1px solid #ddd;padding:5px 8px;text-align:right;">${calc.commissionGpQty > 0 ? calc.commissionGpQty : ''}</td>
          <td style="border-left:1px solid #ddd;border-right:1px solid #999;padding:5px 8px;text-align:right;">${calc.commissionGp > 0 ? '₱' + fmt(calc.commissionGp) : ''}</td>
          <td style="background:#333;width:4px;padding:0;"></td>
          <td style="border-left:1px solid #999;padding:5px 8px;">Pag-IBIG Contribution</td>
          <td style="border-right:1px solid #999;padding:5px 8px;text-align:right;">${calc.hdmf > 0 ? '₱' + fmt(calc.hdmf) : ''}</td>
        </tr>
        <tr style="height:22px;">
          <td style="border-left:1px solid #999;"></td><td style="border-left:1px solid #ddd;"></td><td style="border-left:1px solid #ddd;border-right:1px solid #999;"></td>
          <td style="background:#333;padding:0;"></td>
          <td style="border-left:1px solid #999;"></td><td style="border-right:1px solid #999;"></td>
        </tr>
      </tbody>
      <tfoot>
        <tr style="font-weight:700;">
          <td colspan="2" style="border:1px solid #999;padding:6px 8px;">GROSS PAY</td>
          <td style="border:1px solid #999;padding:6px 8px;text-align:right;">₱${fmt(calc.grossPay)}</td>
          <td style="background:#333;width:4px;padding:0;"></td>
          <td style="border:1px solid #999;padding:6px 8px;">TOTAL DEDUCTION</td>
          <td style="border:1px solid #999;padding:6px 8px;text-align:right;">₱${fmt(calc.totalDeductions)}</td>
        </tr>
        <tr style="font-weight:700;">
          <td colspan="3" style="border:1px solid #999;padding:6px 8px;background:#fff;"></td>
          <td style="background:#333;width:4px;padding:0;"></td>
          <td style="border:1px solid #999;padding:6px 8px;">NET PAY</td>
          <td style="border:1px solid #999;padding:6px 8px;text-align:right;">₱${fmt(calc.netPay)}</td>
        </tr>
      </tfoot>
    </table>
    <div style="margin-top:16px;border-top:2px dashed #ccc;padding-top:4px;"></div>
  </div>`;
}

function viewPayslipModal(periodKey) {
  const s = getState();
  const me = s.currentUser;
  const periods = getPayPeriods(me.id, s.shifts);
  const period = periods.find(p => p.key === periodKey);
  if (!period) { showToast('Payslip not found.', 'error'); return; }
  const calc = calcPayslip(me, period, s);
  const positionLabel = ['cashier', 'branch_manager', 'inventory_staff'].includes(normalizeRole(me.role)) ? 'Branch Personnel' : 'Printing Personnel';
  const empNum = me.employeeNumber || ('BPS-' + String(me.id || '001').replace(/\D/g, '').padStart(3, '0'));
  const COMPANY = getCompanyInfo();
  const html = buildPayslipHtml(me, period, calc, COMPANY, empNum, positionLabel);
  showModal(`<div class="modal-header"><h2>📄 Payslip — ${period.label}</h2><button class="btn-close-modal" onclick="closeModal()">✕</button></div>
    <div class="modal-body" id="payslip-modal-doc" style="padding:0;max-height:75vh;overflow-y:auto;">${html}</div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeModal()">Close</button>
      <button class="btn btn-maroon" onclick="printContent(document.getElementById('payslip-modal-doc').innerHTML,'Payslip — South Pafps')">${iconSvg('printer')} Print Payslip</button>
    </div>`);
}

function renderPayslip() {
  const s = getState();
  const me = s.currentUser;
  if (!me || !['branch_manager', 'hr', 'cashier', 'inventory_staff', 'print'].includes(normalizeRole(me.role))) { accessDenied('My Payroll'); return; }

  // Only show payslips that admin has explicitly sent to this employee
  const myPayslips = (s.payslips || []).filter(p => p.userId === me.id);

  document.getElementById('page-content').innerHTML = `
    <div class="page-header">
      <h1 class="page-title">My Payslip</h1>
      <p class="page-subtitle">View and print your payslips sent by the admin</p>
    </div>
    <div class="data-card">
      <div class="data-card-header"><span class="data-card-title">${iconSvg('money')} My Payslips</span></div>
      <div class="data-card-body no-pad">
        <table class="data-table">
          <thead><tr><th>Pay Period</th><th>Daily Rate</th><th>Days Present</th><th>Net Pay</th><th>Sent</th><th>Action</th></tr></thead>
          <tbody>${myPayslips.length
      ? myPayslips.map(p => `<tr>
                <td><strong>${p.payPeriod}</strong></td>
                <td class="td-mono">₱${fmt(p.dailyRate)}</td>
                <td class="td-mono">${p.daysPresent}</td>
                <td class="td-mono" style="color:var(--success);font-weight:700">₱${fmt(p.netPay)}</td>
                <td style="font-size:12px;color:var(--ink-60)">${p.sentAt ? fmtTime(p.sentAt) : '—'}</td>
                <td><button class="btn btn-sm btn-maroon" onclick="viewSentPayslipModal('${p.id}')">${iconSvg('printer')} View &amp; Print</button></td>
              </tr>`).join('')
      : `<tr><td colspan="6" style="text-align:center;padding:32px;color:var(--ink-60)">
                <div style="font-size:28px;margin-bottom:10px">📄</div>
                No payslips available yet.<br>
                <span style="font-size:12px">Payslips will appear here once your admin sends them to you.</span>
              </td></tr>`
    }</tbody>
        </table>
      </div>
    </div>`;
}

function viewSentPayslipModal(payslipId) {
  const s = getState();
  const p = (s.payslips || []).find(x => x.id === payslipId);
  if (!p) { showToast('Payslip not found.', 'error'); return; }
  const me = s.currentUser;
  const branch = s.branches.find(b => b.id === (p.branchId || me?.branchId));
  const COMPANY = getCompanyInfo();
  const empNum = me?.employeeNumber || ('EMP-' + String(me?.id || '001').replace(/\D/g, '').padStart(3, '0'));
  const positionLabel = ['cashier', 'branch_manager', 'inventory_staff'].includes(normalizeRole(me?.role)) ? 'Branch Personnel' : normalizeRole(me?.role) === 'print' ? 'Printing Personnel' : (me?.role || '');

  // Derive pay date from sentAt or notes
  const payDateStr = p.sentAt ? new Date(p.sentAt).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' }) : '—';
  // Basic pay portion and commission portions
  const basicPay = p.daysPresent * p.dailyRate;
  // Commission (Cups): stored in incentives field; Commission (GP): additional incentive beyond cups
  // Use incentives as combined; split display as single incentive row if present
  const commissionCupsQty = p.commissionCupsQty ?? (p.incentives > 0 ? 1 : 0);
  const commissionCupsAmt = p.commissionCupsAmt ?? (p.incentives > 0 ? p.incentives : 0);
  const commissionGpQty = p.commissionGpQty ?? 0;
  const commissionGpAmt = p.commissionGpAmt ?? 0;

  const html = `<div style="font-family:'Arial',sans-serif;font-size:12px;color:#111;padding:24px 32px;">
    <div style="display:flex;align-items:flex-start;gap:24px;margin-bottom:16px;">
      <div style="flex-shrink:0;width:90px;"><img src="logo.png" alt="South Pafps" style="width:90px;height:auto;display:block;" onerror="this.style.display='none'"></div>
      <div style="flex:1;padding-top:4px;"><div style="font-weight:700;font-size:13px;margin-bottom:4px;">${COMPANY.name}</div><div style="font-size:11px;line-height:1.8;color:#333;">${COMPANY.address1}<br>${COMPANY.address2}<br>${COMPANY.tel}</div></div>
    </div>
    <div style="text-align:center;font-weight:700;font-size:13px;letter-spacing:3px;margin:0 0 10px;">PAYSLIP</div>
    <table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:0;">
      <colgroup><col style="width:20%"><col style="width:30%"><col style="width:20%"><col style="width:30%"></colgroup>
      <tbody>
        <tr><td style="padding:4px 8px;border:1px solid #999;"><strong>Employee Name:</strong></td><td style="padding:4px 8px;border:1px solid #999;">${p.employeeName}</td><td style="padding:4px 8px;border:1px solid #999;"><strong>SSS Number:</strong></td><td style="padding:4px 8px;border:1px solid #999;">${me?.sssNumber || ''}</td></tr>
        <tr><td style="padding:4px 8px;border:1px solid #999;"><strong>Employee Number:</strong></td><td style="padding:4px 8px;border:1px solid #999;">${empNum}</td><td style="padding:4px 8px;border:1px solid #999;"><strong>PhilHealth Number:</strong></td><td style="padding:4px 8px;border:1px solid #999;">${me?.philhealthNumber || ''}</td></tr>
        <tr><td style="padding:4px 8px;border:1px solid #999;"><strong>Position:</strong></td><td style="padding:4px 8px;border:1px solid #999;">${positionLabel}</td><td style="padding:4px 8px;border:1px solid #999;"><strong>Pag-IBIG Number:</strong></td><td style="padding:4px 8px;border:1px solid #999;">${me?.hdmfNumber || ''}</td></tr>
        <tr><td style="padding:4px 8px;border:1px solid #999;"><strong>Pay Period:</strong></td><td style="padding:4px 8px;border:1px solid #999;">${p.payPeriod}</td><td style="padding:4px 8px;border:1px solid #999;"><strong>TIN Number:</strong></td><td style="padding:4px 8px;border:1px solid #999;">${me?.tinNumber || ''}</td></tr>
        <tr><td style="padding:4px 8px;border:1px solid #999;"><strong>Pay Date:</strong></td><td style="padding:4px 8px;border:1px solid #999;">${payDateStr}</td><td style="padding:4px 8px;border:1px solid #999;"></td><td style="padding:4px 8px;border:1px solid #999;"></td></tr>
      </tbody>
    </table>
    <table style="width:100%;border-collapse:collapse;font-size:12px;margin-top:-1px;">
      <colgroup><col style="width:34%"><col style="width:9%"><col style="width:13%"><col style="width:4px"><col style="width:auto"><col style="width:14%"></colgroup>
      <thead><tr>
        <th colspan="3" style="border:1px solid #999;padding:6px 8px;text-align:left;font-weight:700;">EARNINGS/INCOME</th>
        <td style="background:#333;width:4px;padding:0;"></td>
        <th colspan="2" style="border:1px solid #999;padding:6px 8px;text-align:left;font-weight:700;">DEDUCTIONS</th>
      </tr></thead>
      <tbody>
        <tr>
          <td style="border-left:1px solid #999;padding:5px 8px;">Basic Pay @ ₱${fmt(p.dailyRate)}/day</td>
          <td style="border-left:1px solid #ddd;padding:5px 8px;text-align:right;">${p.daysPresent}</td>
          <td style="border-left:1px solid #ddd;border-right:1px solid #999;padding:5px 8px;text-align:right;">₱${fmt(basicPay)}</td>
          <td style="background:#333;width:4px;padding:0;"></td>
          <td style="border-left:1px solid #999;padding:5px 8px;">SSS EE Contribution</td>
          <td style="border-right:1px solid #999;padding:5px 8px;text-align:right;">${p.sss > 0 ? '₱' + fmt(p.sss) : ''}</td>
        </tr>
        <tr>
          <td style="border-left:1px solid #999;padding:5px 8px;">${commissionCupsQty > 0 ? 'Commission (Cups)' : ''}</td>
          <td style="border-left:1px solid #ddd;padding:5px 8px;text-align:right;">${commissionCupsQty > 0 ? commissionCupsQty : ''}</td>
          <td style="border-left:1px solid #ddd;border-right:1px solid #999;padding:5px 8px;text-align:right;">${commissionCupsQty > 0 ? '₱' + fmt(commissionCupsAmt) : ''}</td>
          <td style="background:#333;width:4px;padding:0;"></td>
          <td style="border-left:1px solid #999;padding:5px 8px;">PhilHealth EE Contribution</td>
          <td style="border-right:1px solid #999;padding:5px 8px;text-align:right;">${p.philhealth > 0 ? '₱' + fmt(p.philhealth) : ''}</td>
        </tr>
        <tr>
          <td style="border-left:1px solid #999;padding:5px 8px;">${commissionGpQty > 0 ? 'Commission (GP)' : ''}</td>
          <td style="border-left:1px solid #ddd;padding:5px 8px;text-align:right;">${commissionGpQty > 0 ? commissionGpQty : ''}</td>
          <td style="border-left:1px solid #ddd;border-right:1px solid #999;padding:5px 8px;text-align:right;">${commissionGpQty > 0 ? '₱' + fmt(commissionGpAmt) : ''}</td>
          <td style="background:#333;width:4px;padding:0;"></td>
          <td style="border-left:1px solid #999;padding:5px 8px;">Pag-IBIG Contribution</td>
          <td style="border-right:1px solid #999;padding:5px 8px;text-align:right;">${p.hdmf > 0 ? '₱' + fmt(p.hdmf) : ''}</td>
        </tr>
        <tr style="height:22px;">
          <td style="border-left:1px solid #999;"></td><td style="border-left:1px solid #ddd;"></td><td style="border-left:1px solid #ddd;border-right:1px solid #999;"></td>
          <td style="background:#333;padding:0;"></td>
          <td style="border-left:1px solid #999;"></td><td style="border-right:1px solid #999;"></td>
        </tr>
      </tbody>
      <tfoot>
        <tr style="font-weight:700;">
          <td colspan="2" style="border:1px solid #999;padding:6px 8px;">GROSS PAY</td>
          <td style="border:1px solid #999;padding:6px 8px;text-align:right;">₱${fmt(p.grossPay)}</td>
          <td style="background:#333;width:4px;padding:0;"></td>
          <td style="border:1px solid #999;padding:6px 8px;">TOTAL DEDUCTION</td>
          <td style="border:1px solid #999;padding:6px 8px;text-align:right;">₱${fmt(p.deductions)}</td>
        </tr>
        <tr style="font-weight:700;">
          <td colspan="3" style="border:1px solid #999;padding:6px 8px;background:#fff;"></td>
          <td style="background:#333;width:4px;padding:0;"></td>
          <td style="border:1px solid #999;padding:6px 8px;">NET PAY</td>
          <td style="border:1px solid #999;padding:6px 8px;text-align:right;">₱${fmt(p.netPay)}</td>
        </tr>
      </tfoot>
    </table>
    ${p.notes ? `<div style="margin-top:10px;font-size:11px;color:#666;border-top:1px solid #eee;padding-top:8px;">Notes: ${p.notes}</div>` : ''}
    <div style="margin-top:16px;border-top:2px dashed #ccc;padding-top:4px;"></div>
  </div>`;

  showModal(`<div class="modal-header"><h2>📄 Payslip — ${p.payPeriod}</h2><button class="btn-close-modal" onclick="closeModal()">✕</button></div>
    <div class="modal-body" id="payslip-modal-doc" style="padding:0;max-height:75vh;overflow-y:auto;">${html}</div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeModal()">Close</button>
      <button class="btn btn-maroon" onclick="printContent(document.getElementById('payslip-modal-doc').innerHTML,'Payslip — South Pafps')">${iconSvg('printer')} Print Payslip</button>
    </div>`, 'modal-lg');
}


// REPORTS
function renderReports() {
  const page = 'reports';
  const navId = getNavRenderId();
  const u = getState().currentUser;
  // Printing personnel get their own production reports
  if (u.role === 'print') {
    renderPrintReports();
    return;
  }
  {
    const s2 = getState();
    const sales = s2.sales || [];
    const today = new Date().toDateString();
    const filteredSales = u.role === 'admin' ? sales : sales.filter(x => x.userId === u.id || x.user_id === u.id);
    const todaySales = filteredSales.filter(x => !x.voided && x.status !== 'voided' && new Date(x.createdAt || x.created_at).toDateString() === today);
    const todayRevenue = todaySales.reduce((a, b) => a + (b.total || 0), 0);
    const cashRev = todaySales.reduce((a, b) => a + ((b.payments?.find?.(p => p.method === 'cash')?.amount) || 0), 0);
    const gcashRev = todaySales.reduce((a, b) => a + ((b.payments?.find?.(p => p.method === 'gcash')?.amount) || 0), 0);

    // Build last 7 days revenue chart data
    const last7 = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      const label = d.toLocaleDateString('en-PH', { weekday: 'short' });
      const dateStr = d.toDateString();
      const rev = filteredSales
        .filter(x => !x.voided && x.status !== 'voided' && new Date(x.createdAt || x.created_at).toDateString() === dateStr)
        .reduce((sum, x) => sum + (x.total || 0), 0);
      return { label, rev };
    });
    const maxRev = Math.max(...last7.map(d => d.rev), 1);

    // Top products by revenue
    const productRevMap = {};
    filteredSales.forEach(sale => {
      if (sale.status === 'voided') return;
      (sale.items || []).forEach(item => {
        const key = item.productName || item.product_name || 'Unknown';
        productRevMap[key] = (productRevMap[key] || 0) + (item.subtotal || item.price * (item.quantity || item.qty) || 0);
      });
    });
    const topProducts = Object.entries(productRevMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    setPageHtml(page, navId, `
        <div>
          <div class="page-header" style="display:flex;justify-content:space-between;align-items:flex-start">
            <div><h1 class="page-title">Reports & Analytics</h1><p class="page-subtitle">${u.role === 'admin' ? 'All branches' : 'My transactions'}</p></div>
            ${u.role === 'admin' ? `
              <div style="display:flex;gap:8px;flex-wrap:wrap">
                <button class="btn btn-outline" onclick="showDownpaymentReportModal()">50% Downpayment</button>
                <button class="btn btn-outline" onclick="showBalanceDueReportModal()">Balance Due</button>
                <button class="btn btn-outline" onclick="showPaidOrdersReportModal()">Paid Orders</button>
                <button class="btn btn-outline" onclick="showDiscountReportModal()">Discounts</button>
                <button class="btn btn-outline" onclick="showDiscountRulesModal()">Discount Rules</button>
              </div>` : ''}
          </div>
          <div class="kpi-grid">
            <div class="kpi-card"><div class="kpi-header"><div class="kpi-label">Today's Revenue</div><div class="kpi-icon gold">${iconSvg('money')}</div></div><div class="kpi-value">₱${fmt(todayRevenue)}</div></div>
            <div class="kpi-card"><div class="kpi-header"><div class="kpi-label">Today's Transactions</div><div class="kpi-icon green">${iconSvg('cart')}</div></div><div class="kpi-value">${todaySales.length}</div></div>
            <div class="kpi-card"><div class="kpi-header"><div class="kpi-label">Cash Revenue</div><div class="kpi-icon maroon">${iconSvg('cash')}</div></div><div class="kpi-value">₱${fmt(cashRev)}</div></div>
            <div class="kpi-card"><div class="kpi-header"><div class="kpi-label">GCash Revenue</div><div class="kpi-icon blue">${iconSvg('phone')}</div></div><div class="kpi-value">₱${fmt(gcashRev)}</div></div>
          </div>
          <div style="display:grid;grid-template-columns:2fr 1fr;gap:20px">
            <div class="data-card">
              <div class="data-card-header"><span class="data-card-title">Revenue — Last 7 Days</span></div>
              <div class="data-card-body">
                <div class="bar-chart">${last7.map(d => `<div class="bar" style="background:var(--maroon);height:${Math.max(6, (d.rev / maxRev) * 100)}%;opacity:${d.rev === 0 ? 0.2 : 1}" data-val="₱${fmt(d.rev)}"></div>`).join('')}</div>
                <div class="bar-labels">${last7.map(d => `<div class="bar-label">${d.label}</div>`).join('')}</div>
              </div>
            </div>
            <div class="data-card">
              <div class="data-card-header"><span class="data-card-title">Top Products</span></div>
              <div class="data-card-body">${topProducts.length ? topProducts.map((p, i) => `
                <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--ink-10)">
                  <div><span style="font-size:12px;color:var(--ink-60);margin-right:6px">#${i + 1}</span>${p[0]}</div>
                  <span class="td-mono" style="font-weight:700;color:var(--maroon)">₱${fmt(p[1])}</span>
                </div>`).join('') : '<p class="text-sm text-muted">No sales recorded yet.</p>'}
              </div>
            </div>
          </div>
          <div class="data-card"><div class="data-card-header"><span class="data-card-title">All Sales Log</span></div>
            <div class="data-card-body no-pad">
              <table class="data-table"><thead><tr><th>Receipt #</th><th>Customer</th><th>Items</th><th>Total</th><th>Paid</th><th>Status</th><th>Time</th></tr></thead>
              <tbody>${[...filteredSales].reverse().slice(0, 30).map(sale => {
      const customer = sale.customer ? (sale.customer.company || sale.customer.contact || '-') : '-';
      return `<tr>
                  <td class="td-mono">${String(sale.id).padStart(6, '0')}</td>
                  <td>${customer}</td>
                  <td>${sale.items ? sale.items.length : 0}</td>
                  <td class="td-mono" style="font-weight:700;color:var(--maroon)">₱${fmt(sale.total)}</td>
                  <td class="td-mono">₱${fmt(sale.paid)}</td>
                  <td>${sale.status ? sale.status : '-'}</td>
                  <td class="td-mono">${sale.created_at ? fmtTime(sale.created_at) : ''}</td>
                </tr>`;
    }).join('') || '<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--ink-60)">No sales found.</td></tr>'}
              </tbody>
            </table>
          </div>
        </div>
      </div>`);
  }
}

function showDiscountRulesModal() {
  // FIX 6: Show actual configured discount rules instead of TODO
  showModal(`<div class='modal-header'><h2>&#x1F4CB; Discount Rules</h2><button class='btn-close-modal' onclick='closeModal()'>✕</button></div>
    <div class='modal-body'>
      <div class='alert alert-info' style='margin-bottom:14px'>These are the current system-wide discount rules applied automatically during order creation.</div>
      <table class='data-table'>
        <thead><tr><th>Rule</th><th>Condition</th><th>Value</th></tr></thead>
        <tbody>
          <tr><td><strong>Bulk Order Discount</strong></td><td>Order subtotal &ge; &#x20B1;3,000</td><td><span class='badge badge-success'>5% off subtotal</span></td></tr>
          <tr><td><strong>Plate Charge (New Customer)</strong></td><td>Customer type = New</td><td>Product Fee + &#x20B1;550 plate</td></tr>
          <tr><td><strong>Plate Charge (New Logo)</strong></td><td>New logo flag checked</td><td>Product Fee + &#x20B1;550 plate</td></tr>
          <tr><td><strong>No Plate Charge</strong></td><td>Existing customer, same logo</td><td><span class='badge badge-neutral'>&#x20B1;0</span></td></tr>
        </tbody>
      </table>
      <p style='font-size:12px;color:var(--ink-60);margin-top:12px'>To change these values, update the <code>OM_DISCOUNT_THRESHOLD</code>, <code>OM_DISCOUNT_RATE</code>, and <code>OM_PLATE_PER_COLOR</code> constants in app.js.</p>
    </div>
    <div class='modal-footer'><button class='btn btn-outline' onclick='closeModal()'>Close</button></div>`);
}
function showDownpaymentReportModal() {
  // FIX 6: Show actual orders with downpayments recorded
  var orders = getOrders().filter(function (o) { return (o.downpayment || 0) > 0 && o.status !== 'cancelled'; });
  orders = [...orders].reverse();
  var rows = orders.length ? orders.map(function (o) {
    return '<tr>'
      + '<td class="td-mono">#' + String(o.id).padStart(6, '0') + '</td>'
      + '<td>' + (o.customer_name || '—') + '</td>'
      + '<td class="td-mono">&#x20B1;' + omFmt(o.total_amount || 0) + '</td>'
      + '<td class="td-mono">&#x20B1;' + omFmt(o.downpayment || 0) + '</td>'
      + '<td class="td-mono" style="color:' + ((o.balance || 0) > 0 ? 'var(--danger)' : 'var(--success)') + '">&#x20B1;' + omFmt(o.balance || 0) + '</td>'
      + '<td>' + omPayStatusBadge(o.payment_status) + '</td>'
      + '</tr>';
  }).join('') : '<tr><td colspan="6" style="text-align:center;padding:16px;color:var(--ink-60)">No orders with downpayments found.</td></tr>';
  var totalDP = orders.reduce(function (s, o) { return s + (o.downpayment || 0); }, 0);
  showModal(`<div class='modal-header'><h2>&#x1F4B3; Downpayment Report</h2><button class='btn-close-modal' onclick='closeModal()'>✕</button></div>
    <div class='modal-body' style='padding:0'>
      <div style='padding:12px 16px;background:var(--cream);border-bottom:1px solid var(--ink-10);display:flex;gap:24px'>
        <div><span style='font-size:11px;color:var(--ink-60)'>Orders with DP</span><div style='font-weight:700;font-size:18px'>${orders.length}</div></div>
        <div><span style='font-size:11px;color:var(--ink-60)'>Total Collected</span><div style='font-weight:700;font-size:18px;color:var(--success)'>&#x20B1;${omFmt(totalDP)}</div></div>
      </div>
      <div style='overflow-x:auto'>
      <table class='data-table'>
        <thead><tr><th>Order #</th><th>Customer</th><th>Total</th><th>Downpayment</th><th>Balance</th><th>Status</th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>
    </div>
    <div class='modal-footer'><button class='btn btn-outline' onclick='closeModal()'>Close</button></div>`, 'modal-lg');
}
function showBalanceDueReportModal() {
  // FIX 6: Show orders with outstanding balances
  var orders = getOrders().filter(function (o) { return (o.balance || 0) > 0 && o.status !== 'cancelled'; });
  orders = [...orders].sort(function (a, b) { return (b.balance || 0) - (a.balance || 0); });
  var rows = orders.length ? orders.map(function (o) {
    var isPastDue = o.due_date && new Date(o.due_date) < new Date() && o.status !== 'completed';
    return '<tr' + (isPastDue ? ' style="background:var(--danger-l)"' : '') + '>'
      + '<td class="td-mono">#' + String(o.id).padStart(6, '0') + '</td>'
      + '<td>' + (o.customer_name || '—') + '</td>'
      + '<td class="td-mono">&#x20B1;' + omFmt(o.total_amount || 0) + '</td>'
      + '<td class="td-mono">&#x20B1;' + omFmt(o.downpayment || 0) + '</td>'
      + '<td class="td-mono" style="color:var(--danger);font-weight:700">&#x20B1;' + omFmt(o.balance || 0) + '</td>'
      + '<td>' + omStatusBadge(o.status) + '</td>'
      + '<td class="td-mono">' + (o.due_date || '—') + (isPastDue ? ' <span class="badge badge-danger">PAST DUE</span>' : '') + '</td>'
      + '</tr>';
  }).join('') : '<tr><td colspan="7" style="text-align:center;padding:16px;color:var(--ink-60)">No outstanding balances. All orders are fully paid!</td></tr>';
  var totalBal = orders.reduce(function (s, o) { return s + (o.balance || 0); }, 0);
  showModal(`<div class='modal-header'><h2>&#x26A0;&#xFE0F; Balance Due Report</h2><button class='btn-close-modal' onclick='closeModal()'>✕</button></div>
    <div class='modal-body' style='padding:0'>
      <div style='padding:12px 16px;background:var(--cream);border-bottom:1px solid var(--ink-10);display:flex;gap:24px'>
        <div><span style='font-size:11px;color:var(--ink-60)'>Orders with Balance</span><div style='font-weight:700;font-size:18px'>${orders.length}</div></div>
        <div><span style='font-size:11px;color:var(--ink-60)'>Total Outstanding</span><div style='font-weight:700;font-size:18px;color:var(--danger)'>&#x20B1;${omFmt(totalBal)}</div></div>
      </div>
      <div style='overflow-x:auto'>
      <table class='data-table'>
        <thead><tr><th>Order #</th><th>Customer</th><th>Total</th><th>Paid</th><th>Balance</th><th>Order Status</th><th>Due Date</th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>
    </div>
    <div class='modal-footer'><button class='btn btn-outline' onclick='closeModal()'>Close</button></div>`, 'modal-lg');
}
function showPaidOrdersReportModal() {
  // FIX 6: Show fully paid orders
  var orders = getOrders().filter(function (o) { return o.payment_status === 'Fully Paid'; });
  orders = [...orders].reverse();
  var rows = orders.length ? orders.map(function (o) {
    return '<tr>'
      + '<td class="td-mono">#' + String(o.id).padStart(6, '0') + '</td>'
      + '<td>' + (o.customer_name || '—') + '</td>'
      + '<td>' + (o.product_type || o.product_category || '—') + '</td>'
      + '<td class="td-mono">&#x20B1;' + omFmt(o.total_amount || 0) + '</td>'
      + '<td>' + omStatusBadge(o.status) + '</td>'
      + '<td class="td-mono">' + (o.due_date || '—') + '</td>'
      + '</tr>';
  }).join('') : '<tr><td colspan="6" style="text-align:center;padding:16px;color:var(--ink-60)">No fully paid orders found.</td></tr>';
  var total = orders.reduce(function (s, o) { return s + (o.total_amount || 0); }, 0);
  showModal(`<div class='modal-header'><h2>&#x2705; Paid Orders Report</h2><button class='btn-close-modal' onclick='closeModal()'>✕</button></div>
    <div class='modal-body' style='padding:0'>
      <div style='padding:12px 16px;background:var(--cream);border-bottom:1px solid var(--ink-10);display:flex;gap:24px'>
        <div><span style='font-size:11px;color:var(--ink-60)'>Fully Paid Orders</span><div style='font-weight:700;font-size:18px'>${orders.length}</div></div>
        <div><span style='font-size:11px;color:var(--ink-60)'>Total Revenue</span><div style='font-weight:700;font-size:18px;color:var(--success)'>&#x20B1;${omFmt(total)}</div></div>
      </div>
      <div style='overflow-x:auto'>
      <table class='data-table'>
        <thead><tr><th>Order #</th><th>Customer</th><th>Product</th><th>Amount</th><th>Order Status</th><th>Due Date</th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>
    </div>
    <div class='modal-footer'><button class='btn btn-outline' onclick='closeModal()'>Close</button></div>`, 'modal-lg');
}
function showDiscountReportModal() {
  // FIX 6: Show orders where a discount was applied
  var orders = getOrders().filter(function (o) { return (o.discount_amount || 0) > 0; });
  orders = [...orders].reverse();
  var rows = orders.length ? orders.map(function (o) {
    return '<tr>'
      + '<td class="td-mono">#' + String(o.id).padStart(6, '0') + '</td>'
      + '<td>' + (o.customer_name || '—') + '</td>'
      + '<td class="td-mono">' + (o.quantity || '—') + '</td>'
      + '<td class="td-mono">&#x20B1;' + omFmt((o.quantity || 0) * (o.unit_price || 0)) + '</td>'
      + '<td class="td-mono" style="color:var(--success);font-weight:700">- &#x20B1;' + omFmt(o.discount_amount || 0) + '</td>'
      + '<td class="td-mono">&#x20B1;' + omFmt(o.total_amount || 0) + '</td>'
      + '</tr>';
  }).join('') : '<tr><td colspan="6" style="text-align:center;padding:16px;color:var(--ink-60)">No discounted orders found.</td></tr>';
  var totalDiscount = orders.reduce(function (s, o) { return s + (o.discount_amount || 0); }, 0);
  showModal(`<div class='modal-header'><h2>&#x1F3F7;&#xFE0F; Discount Report</h2><button class='btn-close-modal' onclick='closeModal()'>✕</button></div>
    <div class='modal-body' style='padding:0'>
      <div style='padding:12px 16px;background:var(--cream);border-bottom:1px solid var(--ink-10);display:flex;gap:24px'>
        <div><span style='font-size:11px;color:var(--ink-60)'>Discounted Orders</span><div style='font-weight:700;font-size:18px'>${orders.length}</div></div>
        <div><span style='font-size:11px;color:var(--ink-60)'>Total Discounts Given</span><div style='font-weight:700;font-size:18px;color:var(--success)'>&#x20B1;${omFmt(totalDiscount)}</div></div>
      </div>
      <div style='overflow-x:auto'>
      <table class='data-table'>
        <thead><tr><th>Order #</th><th>Customer</th><th>Qty</th><th>Subtotal</th><th>Discount</th><th>Final Total</th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>
    </div>
    <div class='modal-footer'><button class='btn btn-outline' onclick='closeModal()'>Close</button></div>`, 'modal-lg');
}

function viewReceiptModal(saleId) {
  const s = getState();
  const sale = s.sales.find(x => String(x.id) === String(saleId));
  if (!sale) { showToast('Receipt not found.', 'error'); return; }
  showReceiptModal(sale, s);
}

// View receipt for Order Management orders in POS receipt history
function omViewReceiptModal(saleId) {
  var s = getState();
  var sale = (s.sales || []).find(function (x) { return String(x.id) === String(saleId); });
  if (!sale) { showToast('Receipt not found.', 'error'); return; }
  var receiptNo = sale.receiptNo || String(sale.id).slice(-6).toUpperCase();
  var date = sale.createdAt ? new Date(sale.createdAt).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' }) : '—';
  var item = (sale.items && sale.items[0]) || {};
  showModal(
    '<div class="modal-header"><h2>\uD83D\uDCCB Receipt ' + receiptNo + '</h2>'
    + '<button class="btn-close-modal" onclick="closeModal()">✕</button></div>'
    + '<div class="modal-body" style="font-family:monospace;max-width:360px;margin:0 auto">'
    + '<div style="text-align:center;margin-bottom:12px">'
    + '<strong style="font-size:16px">SOUTH PAFPS</strong><br>'
    + '<span style="font-size:12px;color:var(--ink-60)">Packaging Supplies</span>'
    + '</div>'
    + '<hr style="border:none;border-top:1px dashed var(--ink-20);margin:10px 0">'
    + '<div style="font-size:12px;margin-bottom:8px">'
    + '<div style="display:flex;justify-content:space-between"><span>Receipt #</span><strong>' + receiptNo + '</strong></div>'
    + '<div style="display:flex;justify-content:space-between"><span>Date</span><span>' + date + '</span></div>'
    + '<div style="display:flex;justify-content:space-between"><span>Order #</span><span>#' + String(sale.omOrderId || '').padStart(6, '0') + '</span></div>'
    + '</div>'
    + '<hr style="border:none;border-top:1px dashed var(--ink-20);margin:10px 0">'
    + '<div style="font-size:12px;margin-bottom:8px">'
    + '<div><strong>' + omEsc(sale.omCustomerName || '—') + '</strong></div>'
    + (sale.omContactPerson ? '<div style="color:var(--ink-60)">' + omEsc(sale.omContactPerson) + '</div>' : '')
    + (sale.omPhone ? '<div style="color:var(--ink-60)">' + omEsc(sale.omPhone) + '</div>' : '')
    + '</div>'
    + '<hr style="border:none;border-top:1px dashed var(--ink-20);margin:10px 0">'
    + '<table style="width:100%;font-size:12px;border-collapse:collapse">'
    + '<tr style="color:var(--ink-60)"><td>Item</td><td style="text-align:center">Qty</td><td style="text-align:right">Amount</td></tr>'
    + '<tr><td>' + omEsc((item.productName || '') + (item.variantName ? ' — ' + item.variantName : '')) + '</td>'
    + '<td style="text-align:center">' + (item.qty || 1) + '</td>'
    + '<td style="text-align:right">₱' + omFmt(item.subtotal || sale.total || 0) + '</td></tr>'
    + (sale.omPlateCharge > 0 ? '<tr><td style="color:var(--ink-60)">Plate Charge</td><td></td><td style="text-align:right">₱' + omFmt(sale.omPlateCharge) + '</td></tr>' : '')
    + (sale.discountAmount > 0 ? '<tr><td style="color:var(--success)">Discount</td><td></td><td style="text-align:right;color:var(--success)">- ₱' + omFmt(sale.discountAmount) + '</td></tr>' : '')
    + '</table>'
    + '<hr style="border:none;border-top:1px dashed var(--ink-20);margin:10px 0">'
    + '<div style="font-size:13px">'
    + '<div style="display:flex;justify-content:space-between"><span>Total</span><strong style="color:var(--maroon)">₱' + omFmt(sale.total) + '</strong></div>'
    + '<div style="display:flex;justify-content:space-between"><span>Mode</span><span>' + omEsc(sale.paymentMode || 'Cash') + '</span></div>'
    + (sale.omBalance > 0 ? '<div style="display:flex;justify-content:space-between;color:var(--danger)"><span>Balance</span><span>₱' + omFmt(sale.omBalance) + '</span></div>' : '<div style="display:flex;justify-content:space-between;color:var(--success)"><span>Balance</span><span>Fully Paid</span></div>')
    + '</div>'
    + '<hr style="border:none;border-top:1px dashed var(--ink-20);margin:10px 0">'
    + '<div style="text-align:center;font-size:11px;color:var(--ink-60)">'
    + '<div>Thank you for your business!</div>'
    + '<div>South Pafps Packaging Supplies</div>'
    + '</div>'
    + '</div>'
    + '<div class="modal-footer">'
    + '<button class="btn btn-outline" onclick="closeModal()">Close</button>'
    + '<button class="btn btn-maroon" onclick="omPrintReceiptById(\'' + saleId + '\')">\uD83D\uDDB6\uFE0F Print</button>'
    + '</div>'
  );
}

function omPrintReceiptById(saleId) {
  var s = getState();
  var sale = (s.sales || []).find(function (x) { return String(x.id) === String(saleId); });
  if (!sale) return;
  var item = (sale.items && sale.items[0]) || {};
  var receiptNo = sale.receiptNo || String(sale.id).slice(-6).toUpperCase();
  var date = sale.createdAt ? new Date(sale.createdAt).toLocaleDateString() : new Date().toLocaleDateString();
  var w = window.open('', '_blank', 'width=400,height=650');
  w.document.write('<!DOCTYPE html><html><head><title>Receipt ' + receiptNo + '</title>'
    + '<style>body{font-family:monospace;padding:20px;max-width:320px;margin:0 auto}h2,p{text-align:center;margin:4px 0}hr{border:none;border-top:1px dashed #999;margin:10px 0}table{width:100%;font-size:13px}td{padding:3px 0}.footer{text-align:center;font-size:11px;margin-top:16px}</style>'
    + '</head><body>'
    + '<h2>SOUTH PAFPS</h2><p>Packaging Supplies</p><hr>'
    + '<p>Receipt # <strong>' + receiptNo + '</strong></p>'
    + '<p>Order # <strong>#' + String(sale.omOrderId || '').padStart(6, '0') + '</strong></p>'
    + '<p>Date: ' + date + '</p><hr>'
    + '<p><strong>' + (sale.omCustomerName || '') + '</strong></p>'
    + (sale.omContactPerson ? '<p>' + sale.omContactPerson + '</p>' : '')
    + '<hr>'
    + '<table>'
    + '<tr><td>' + ((item.productName || '') + (item.variantName ? ' - ' + item.variantName : '')) + '</td><td style="text-align:right">x' + (item.qty || 1) + '</td><td style="text-align:right">₱' + (item.subtotal || 0).toFixed(2) + '</td></tr>'
    + (sale.omPlateCharge > 0 ? '<tr><td>Plate Charge</td><td></td><td style="text-align:right">₱' + sale.omPlateCharge.toFixed(2) + '</td></tr>' : '')
    + (sale.discountAmount > 0 ? '<tr><td>Discount</td><td></td><td style="text-align:right">- ₱' + sale.discountAmount.toFixed(2) + '</td></tr>' : '')
    + '</table><hr>'
    + '<table><tr><td><strong>TOTAL</strong></td><td style="text-align:right"><strong>₱' + (sale.total || 0).toFixed(2) + '</strong></td></tr>'
    + '<tr><td>Mode</td><td style="text-align:right">' + (sale.paymentMode || 'Cash') + '</td></tr>'
    + '<tr><td>Balance</td><td style="text-align:right">' + (sale.omBalance > 0 ? '₱' + sale.omBalance.toFixed(2) : 'FULLY PAID') + '</td></tr>'
    + '</table><hr>'
    + '<div class="footer"><p>Thank you for your business!</p><p>South Pafps Packaging Supplies</p></div>'
    + '<script>window.onload=function(){window.print()}<\/script></body></html>');
  w.document.close();
}


// ─────────────────────────────────────────────────────────────
// POS → Customer Records
// Shows walk-in customers created through the POS terminal
// ─────────────────────────────────────────────────────────────
var _posCustFilter = { search: '', sort: 'recent' };

function renderPosCustomers() {
  const s = getState();
  const isAdmin = s.currentUser && s.currentUser.role === 'admin';
  const staffBranchId = !isAdmin ? s.currentUser?.branchId : null;

  // Build per-customer stats from sales
  const totalSpent = {};
  const visitCount = {};
  const lastVisit = {};
  const branchCustIds = new Set();

  (s.sales || []).forEach(sale => {
    if (sale.voided) return;
    if (sale.customerId) {
      totalSpent[sale.customerId] = (totalSpent[sale.customerId] || 0) + (sale.total || 0);
      visitCount[sale.customerId] = (visitCount[sale.customerId] || 0) + 1;
      if (!lastVisit[sale.customerId] || sale.createdAt > lastVisit[sale.customerId])
        lastVisit[sale.customerId] = sale.createdAt;
      if (staffBranchId && sale.branchId === staffBranchId)
        branchCustIds.add(sale.customerId);
    }
  });
  // Also include customers explicitly tagged to this branch
  if (staffBranchId) {
    (s.customers || []).forEach(c => { if (c.branchId === staffBranchId) branchCustIds.add(c.id); });
  }

  // Only POS-sourced customers
  let pool = (s.customers || []).filter(c => c.source === 'pos');
  if (staffBranchId) pool = pool.filter(c => branchCustIds.has(c.id));

  // Search
  const q = (_posCustFilter.search || '').toLowerCase();
  let filtered = pool.filter(c =>
    !q ||
    (c.companyName || '').toLowerCase().includes(q) ||
    (c.contactPerson || '').toLowerCase().includes(q) ||
    (c.phone || '').toLowerCase().includes(q)
  );

  // Sort
  filtered.sort((a, b) => {
    if (_posCustFilter.sort === 'name') return (a.companyName || a.contactPerson || '').localeCompare(b.companyName || b.contactPerson || '');
    if (_posCustFilter.sort === 'spent') return (totalSpent[b.id] || 0) - (totalSpent[a.id] || 0);
    if (_posCustFilter.sort === 'visits') return (visitCount[b.id] || 0) - (visitCount[a.id] || 0);
    // recent (default)
    return (lastVisit[b.id] || '').localeCompare(lastVisit[a.id] || '');
  });

  const totalRevenue = filtered.reduce((s, c) => s + (totalSpent[c.id] || 0), 0);
  const returningCount = filtered.filter(c => (visitCount[c.id] || 0) > 1).length;

  document.getElementById('page-content').innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">POS Customer Records</h1>
        <p class="page-subtitle">Walk-in customers punched through the POS terminal</p>
      </div>
    </div>

    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-header"><div class="kpi-label">Total Walk-ins</div><div class="kpi-icon blue">${iconSvg('users')}</div></div>
        <div class="kpi-value">${filtered.length}</div>
        <div class="kpi-sub">Unique POS customers</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-header"><div class="kpi-label">Returning</div><div class="kpi-icon green">${iconSvg('check')}</div></div>
        <div class="kpi-value">${returningCount}</div>
        <div class="kpi-sub">More than 1 visit</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-header"><div class="kpi-label">Total Revenue</div><div class="kpi-icon maroon">${iconSvg('money')}</div></div>
        <div class="kpi-value">₱${fmt(totalRevenue)}</div>
        <div class="kpi-sub">From walk-in sales</div>
      </div>
    </div>

    <div class="data-card">
      <div class="data-card-header">
        <span class="data-card-title">Walk-in Customers</span>
        <span class="text-sm text-muted">${filtered.length} record${filtered.length !== 1 ? 's' : ''}</span>
      </div>
      <div class="data-card-body" style="padding:12px 16px;border-bottom:1px solid var(--ink-10);display:flex;gap:10px;flex-wrap:wrap;align-items:center">
        <input class="form-control" style="flex:1;min-width:200px;max-width:340px"
          placeholder="Search name or phone..."
          value="${_posCustFilter.search}"
          oninput="_posCustFilter.search=this.value;renderPosCustomers()">
        <select class="form-control" style="width:auto" onchange="_posCustFilter.sort=this.value;renderPosCustomers()">
          <option value="recent"  ${_posCustFilter.sort === 'recent' ? 'selected' : ''}>Most Recent</option>
          <option value="spent"   ${_posCustFilter.sort === 'spent' ? 'selected' : ''}>Highest Spend</option>
          <option value="visits"  ${_posCustFilter.sort === 'visits' ? 'selected' : ''}>Most Visits</option>
          <option value="name"    ${_posCustFilter.sort === 'name' ? 'selected' : ''}>Name A–Z</option>
        </select>
      </div>
      <div class="data-card-body no-pad">
        <table class="data-table">
          <thead><tr>
            <th>Customer</th>
            <th>Phone</th>
            <th>Visits</th>
            <th>Total Spent</th>
            <th>Last Visit</th>
            <th>AR Balance</th>
            <th>Action</th>
          </tr></thead>
          <tbody>${filtered.length === 0
      ? '<tr><td colspan="7" style="text-align:center;padding:32px;color:var(--ink-60)">No walk-in customers found.</td></tr>'
      : filtered.map(c => {
        const balance = c.outstandingBalance || 0;
        const balCell = balance > 0
          ? '<span class="td-mono" style="color:var(--danger);font-weight:700">₱' + fmt(balance) + '</span>'
          : '<span class="badge badge-success">Clear</span>';
        return '<tr>' +
          '<td><strong>' + (c.companyName || c.contactPerson || 'Unknown') + '</strong>' +
          (c.contactPerson && c.companyName ? '<div style="font-size:11px;color:var(--ink-50)">' + c.contactPerson + '</div>' : '') +
          '</td>' +
          '<td class="td-mono">' + (c.phone || '—') + '</td>' +
          '<td class="td-mono">' + (visitCount[c.id] || 0) + '</td>' +
          '<td class="td-mono" style="font-weight:700;color:var(--maroon)">₱' + fmt(totalSpent[c.id] || 0) + '</td>' +
          '<td class="td-mono" style="font-size:12px">' + (lastVisit[c.id] ? fmtDate(lastVisit[c.id]) : '—') + '</td>' +
          '<td>' + balCell + '</td>' +
          '<td><button class="btn btn-sm btn-outline" onclick="viewPosCustomerModal(\'' + c.id + '\')">View</button></td>' +
          '</tr>';
      }).join('')
    }</tbody>
        </table>
      </div>
    </div>`;
}

function viewPosCustomerModal(cid) {
  const s = getState();
  const c = (s.customers || []).find(x => x.id === cid);
  if (!c) return;
  const custSales = (s.sales || []).filter(x => x.customerId === cid && !x.voided)
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  const totalSpent = custSales.reduce((sum, x) => sum + (x.total || 0), 0);
  const avgSpend = custSales.length ? totalSpent / custSales.length : 0;
  const lastSale = custSales[0];
  const balance = c.outstandingBalance || 0;
  const displayName = c.companyName || c.contactPerson || 'Unknown Customer';
  const initials = displayName.split(' ').slice(0, 2).map(w => w[0] || '').join('').toUpperCase() || '?';

  const salesHtml = custSales.slice(0, 10).map(sale =>
    '<tr>' +
    '<td class="td-mono" style="font-size:12px;font-weight:600">' + (sale.receiptNo || String(sale.id).slice(-6).toUpperCase()) + '</td>' +
    '<td class="td-mono" style="font-weight:700;color:var(--maroon)">\u20b1' + fmt(sale.total) + '</td>' +
    '<td style="font-size:12px;color:var(--ink-60)">' + fmtTime(sale.createdAt) + '</td>' +
    '<td style="text-align:right"><button class="btn btn-sm btn-outline" onclick="viewReceiptModal(\'' + sale.id + '\')">\uD83D\uDDDA Receipt</button></td>' +
    '</tr>'
  ).join('') || '<tr><td colspan="4" style="text-align:center;padding:28px;color:var(--ink-40)"><div style="font-size:28px;margin-bottom:6px">\uD83D\uDED2</div>No purchase history yet.</td></tr>';

  showModal(
    '<div class="modal-header" style="border-bottom:none;padding-bottom:0">' +
    '<button class="btn-close-modal" onclick="closeModal()" style="margin-left:auto">&#x2715;</button></div>' +

    '<div style="background:linear-gradient(135deg,var(--maroon) 0%,#a02040 100%);padding:28px 28px 22px;margin:-8px 0 0;position:relative;overflow:hidden">' +
    '<div style="position:absolute;top:-20px;right:-20px;width:120px;height:120px;background:rgba(255,255,255,0.06);border-radius:50%"></div>' +
    '<div style="display:flex;align-items:center;gap:16px;position:relative">' +
    '<div style="width:56px;height:56px;border-radius:50%;background:rgba(255,255,255,0.18);display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:800;color:#fff;flex-shrink:0;border:2px solid rgba(255,255,255,0.3)">' + initials + '</div>' +
    '<div style="flex:1;min-width:0">' +
    '<div style="font-size:18px;font-weight:700;color:#fff;margin-bottom:2px">' + omEsc(displayName) + '</div>' +
    (c.contactPerson && c.companyName ? '<div style="font-size:13px;color:rgba(255,255,255,0.72);margin-bottom:6px">' + omEsc(c.contactPerson) + '</div>' : '<div style="margin-bottom:6px"></div>') +
    '<div style="display:flex;gap:6px;flex-wrap:wrap">' +
    '<span style="background:rgba(255,255,255,0.15);color:#fff;padding:2px 10px;border-radius:99px;font-size:11px;font-weight:600">\uD83C\uDFEA POS Walk-in</span>' +
    (balance > 0
      ? '<span style="background:#ef4444;color:#fff;padding:2px 10px;border-radius:99px;font-size:11px;font-weight:600">\u26a0 Balance Due: \u20b1' + fmt(balance) + '</span>'
      : '<span style="background:rgba(34,197,94,0.28);color:#bbf7d0;padding:2px 10px;border-radius:99px;font-size:11px;font-weight:600">\u2713 No Balance</span>') +
    '</div></div></div></div>' +

    '<div class="modal-body" style="padding:20px 24px">' +

    '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:20px">' +
    '<div style="background:var(--cream);border-radius:10px;padding:14px;text-align:center"><div style="font-size:24px;font-weight:800;color:var(--maroon)">' + custSales.length + '</div><div style="font-size:10px;color:var(--ink-50);font-weight:600;text-transform:uppercase;letter-spacing:0.06em;margin-top:2px">Total Visits</div></div>' +
    '<div style="background:var(--cream);border-radius:10px;padding:14px;text-align:center"><div style="font-size:24px;font-weight:800;color:var(--maroon)">\u20b1' + fmt(totalSpent) + '</div><div style="font-size:10px;color:var(--ink-50);font-weight:600;text-transform:uppercase;letter-spacing:0.06em;margin-top:2px">Total Spent</div></div>' +
    '<div style="background:var(--cream);border-radius:10px;padding:14px;text-align:center"><div style="font-size:24px;font-weight:800;color:var(--ink)">\u20b1' + fmt(avgSpend) + '</div><div style="font-size:10px;color:var(--ink-50);font-weight:600;text-transform:uppercase;letter-spacing:0.06em;margin-top:2px">Avg / Visit</div></div>' +
    '</div>' +

    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:20px">' +
    _crInfoField('Phone', c.phone || '\u2014', true) +
    _crInfoField('Email', c.email || '\u2014') +
    _crInfoField('Address', c.address || '\u2014') +
    _crInfoField('Last Visit', lastSale ? fmtTime(lastSale.createdAt) : '\u2014') +
    (c.notes ? '<div style="grid-column:span 2">' + _crInfoField('Notes', c.notes) + '</div>' : '') +
    '</div>' +

    '<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;color:var(--ink-40);margin-bottom:8px">Purchase History</div>' +
    '<div style="border:1px solid var(--ink-10);border-radius:10px;overflow:hidden">' +
    '<table class="data-table" style="margin:0"><thead><tr><th>Receipt #</th><th>Amount</th><th>Date &amp; Time</th><th></th></tr></thead>' +
    '<tbody>' + salesHtml + '</tbody></table></div>' +
    '</div>' +

    '<div class="modal-footer">' +
    '<button class="btn btn-outline" onclick="closeModal()">Close</button>' +
    '<button class="btn btn-maroon" onclick="closeModal();crEditPosCustomer(\'' + cid + '\')">' + iconSvg('users') + ' Edit Customer</button>' +
    '</div>'
    , 'modal-lg');
}

// ─────────────────────────────────────────────────────────────
// POS → Receipt History
// Full searchable history of all POS receipts
// ─────────────────────────────────────────────────────────────
var _posReceiptFilter = { search: '', status: 'all', dateFrom: '', dateTo: '' };
function clearPosReceiptFilter() { _posReceiptFilter = { search: '', status: 'all', dateFrom: '', dateTo: '' }; renderPosReceipts(); }

function renderPosReceipts() {
  const s = getState();
  const isAdmin = s.currentUser && s.currentUser.role === 'admin';
  const staffBranchId = !isAdmin ? s.currentUser?.branchId : null;

  // All sales scoped to role
  let allSales = [...(s.sales || [])].reverse();
  if (staffBranchId) allSales = allSales.filter(x => x.branchId === staffBranchId);

  // Apply filters
  const q = (_posReceiptFilter.search || '').toLowerCase();
  const filtered = allSales.filter(sale => {
    const cust = (s.customers || []).find(c => c.id === sale.customerId);
    const custName = cust ? (cust.companyName || cust.contactPerson || '') : 'Walk-in';
    const receiptNo = (sale.receiptNo || String(sale.id).slice(-6)).toUpperCase();
    const matchSearch = !q || receiptNo.toLowerCase().includes(q) || custName.toLowerCase().includes(q);
    const isVoided = sale.voided || sale.status === 'voided';
    const matchStatus =
      _posReceiptFilter.status === 'all' ? true :
        _posReceiptFilter.status === 'paid' ? !isVoided :
          _posReceiptFilter.status === 'voided' ? isVoided : true;
    const saleDate = (sale.createdAt || '').slice(0, 10);
    const matchFrom = !_posReceiptFilter.dateFrom || saleDate >= _posReceiptFilter.dateFrom;
    const matchTo = !_posReceiptFilter.dateTo || saleDate <= _posReceiptFilter.dateTo;
    return matchSearch && matchStatus && matchFrom && matchTo;
  });

  const totalRevenue = filtered.filter(x => !x.voided && x.status !== 'voided').reduce((s, x) => s + (x.total || 0), 0);
  const voidedCount = filtered.filter(x => x.voided || x.status === 'voided').length;
  const paidCount = filtered.length - voidedCount;
  const hasFilter = q || _posReceiptFilter.status !== 'all' || _posReceiptFilter.dateFrom || _posReceiptFilter.dateTo;

  document.getElementById('page-content').innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Receipt History</h1>
        <p class="page-subtitle">Complete record of all POS charges and transactions</p>
      </div>
    </div>

    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-header"><div class="kpi-label">Total Receipts</div><div class="kpi-icon blue">${iconSvg('clipboard')}</div></div>
        <div class="kpi-value">${filtered.length}</div>
        <div class="kpi-sub">${hasFilter ? 'Matching filter' : 'All time'}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-header"><div class="kpi-label">Paid</div><div class="kpi-icon green">${iconSvg('check')}</div></div>
        <div class="kpi-value">${paidCount}</div>
        <div class="kpi-sub">Completed transactions</div>
      </div>
      <div class="kpi-card" style="${voidedCount > 0 ? 'cursor:pointer' : ''}" onclick="_posReceiptFilter.status='voided';renderPosReceipts()">
        <div class="kpi-header"><div class="kpi-label">Voided</div><div class="kpi-icon maroon">${iconSvg('error')}</div></div>
        <div class="kpi-value" style="color:${voidedCount > 0 ? 'var(--danger)' : 'inherit'}">${voidedCount}</div>
        <div class="kpi-sub">Cancelled receipts</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-header"><div class="kpi-label">Revenue</div><div class="kpi-icon gold">${iconSvg('money')}</div></div>
        <div class="kpi-value">₱${fmt(totalRevenue)}</div>
        <div class="kpi-sub">${hasFilter ? 'Filtered total' : 'All paid sales'}</div>
      </div>
    </div>

    <div class="data-card">
      <div class="data-card-header">
        <span class="data-card-title">All Receipts</span>
        <span class="text-sm text-muted">${filtered.length} of ${allSales.length} records</span>
      </div>
      <div class="data-card-body" style="padding:12px 16px;border-bottom:1px solid var(--ink-10);display:flex;gap:10px;flex-wrap:wrap;align-items:center">
        <input class="form-control" style="flex:1;min-width:180px;max-width:300px"
          placeholder="Search receipt # or customer..."
          value="${_posReceiptFilter.search}"
          oninput="_posReceiptFilter.search=this.value;renderPosReceipts()">
        <select class="form-control" style="width:auto" onchange="_posReceiptFilter.status=this.value;renderPosReceipts()">
          <option value="all"    ${_posReceiptFilter.status === 'all' ? 'selected' : ''}>All Status</option>
          <option value="paid"   ${_posReceiptFilter.status === 'paid' ? 'selected' : ''}>Paid</option>
          <option value="voided" ${_posReceiptFilter.status === 'voided' ? 'selected' : ''}>Voided</option>
        </select>
        <input type="date" class="form-control" style="width:auto"
          value="${_posReceiptFilter.dateFrom}"
          onchange="_posReceiptFilter.dateFrom=this.value;renderPosReceipts()"
          title="From date">
        <input type="date" class="form-control" style="width:auto"
          value="${_posReceiptFilter.dateTo}"
          onchange="_posReceiptFilter.dateTo=this.value;renderPosReceipts()"
          title="To date">
        ${hasFilter ? '<button class="btn btn-sm btn-outline" onclick="clearPosReceiptFilter()">Clear</button>' : ''}
      </div>
      <div class="data-card-body no-pad">
        <table class="data-table">
          <thead><tr>
            <th>Receipt #</th>
            <th>Customer</th>
            <th>Items</th>
            <th>Payment</th>
            <th>Total</th>
            <th>Status</th>
            <th>Date & Time</th>
            <th>Action</th>
          </tr></thead>
          <tbody>${filtered.length === 0
      ? '<tr><td colspan="8" style="text-align:center;padding:32px;color:var(--ink-60)">' + (hasFilter ? 'No receipts match your filter.' : 'No receipts yet.') + '</td></tr>'
      : filtered.map(sale => {
        const cust = (s.customers || []).find(c => c.id === sale.customerId);
        const custName = cust ? (cust.companyName || cust.contactPerson || 'Walk-in') : 'Walk-in';
        const isVoided = sale.voided || sale.status === 'voided';
        const receiptNo = sale.receiptNo || String(sale.id).slice(-6).toUpperCase();
        const payMethods = (sale.payments || []).map(p => p.method).join(', ') || (sale.paymentMode || '—');
        const itemCount = (sale.items || []).length;
        return '<tr>' +
          '<td class="td-mono" style="font-weight:600">' + receiptNo + '</td>' +
          '<td>' + (cust && cust.source === 'pos' ? '🛒 ' : '') + custName + '</td>' +
          '<td class="td-mono">' + itemCount + '</td>' +
          '<td style="text-transform:capitalize;font-size:12px">' + payMethods + '</td>' +
          '<td class="td-mono" style="font-weight:700;color:' + (isVoided ? 'var(--ink-40)' : 'var(--maroon)') + '">' +
          (isVoided ? '<s>₱' + fmt(sale.total) + '</s>' : '₱' + fmt(sale.total)) +
          '</td>' +
          '<td>' + (isVoided ? '<span class="badge badge-danger">Voided</span>' : '<span class="badge badge-success">Paid</span>') + '</td>' +
          '<td class="td-mono" style="font-size:12px">' + fmtTime(sale.createdAt || sale.created_at) + '</td>' +
          '<td><button class="btn btn-sm btn-outline" onclick="viewReceiptModal(\'' + sale.id + '\')">View</button></td>' +
          '</tr>';
      }).join('')
    }</tbody>
        </table>
      </div>
    </div>`;
}

// RECEIPTS (Printing Role)
function renderReceipts() {
  var page = 'receipts';
  var navId = getNavRenderId();
  var s = getState();
  var sales = (s.sales || []).slice().reverse().slice(0, 200);
  var rows = sales.map(function (sale) {
    var isOM = sale.source === 'order_management';
    var cust = s.customers ? s.customers.find(function (c) { return c.id === sale.customerId; }) : null;
    var customer = isOM
      ? (sale.omCustomerName || sale.omContactPerson || 'OM Customer')
      : (cust ? (cust.companyName || cust.contactPerson || 'Walk-in') : 'Walk-in');
    var sourceBadge = isOM
      ? '<span class="badge badge-info" style="font-size:10px">Order Mgmt</span>'
      : '<span class="badge badge-neutral" style="font-size:10px">POS</span>';
    var sid = String(sale.id).replace(/'/g, '');
    var actionBtn = isOM
      ? '<button class="btn btn-sm btn-outline" onclick="omViewReceiptModal(\'' + sid + '\')">View</button>'
      : '<button class="btn btn-sm btn-outline" onclick="viewReceiptModal(\'' + sid + '\')">View</button>';
    var statusBadge = (sale.voided || sale.status === 'voided')
      ? '<span class="badge badge-danger">Voided</span>'
      : '<span class="badge badge-success">Paid</span>';
    return '<tr>'
      + '<td class="td-mono" style="font-weight:700">' + (sale.receiptNo || String(sale.id).slice(-6).toUpperCase()) + '</td>'
      + '<td>' + sourceBadge + '</td>'
      + '<td>' + customer + '</td>'
      + '<td class="td-mono" style="font-weight:700;color:var(--maroon)">\u20b1' + fmt(sale.total) + '</td>'
      + '<td class="td-mono">' + fmtTime(sale.createdAt || sale.created_at) + '</td>'
      + '<td>' + statusBadge + '</td>'
      + '<td>' + actionBtn + '</td>'
      + '</tr>';
  }).join('') || '<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--ink-60)">No receipts found.</td></tr>';
  setPageHtml(page, navId,
    '<div class="page-header"><h1 class="page-title">Receipt History</h1><p class="page-subtitle">Browse and reprint receipts \u2014 POS sales and completed Order Management orders</p></div>'
    + '<div class="data-card"><div class="data-card-body no-pad">'
    + '<table class="data-table"><thead><tr><th>Receipt #</th><th>Source</th><th>Customer</th><th>Total</th><th>Date</th><th>Status</th><th>Action</th></tr></thead>'
    + '<tbody>' + rows + '</tbody></table>'
    + '</div></div>'
  );
}

// SALES HISTORY (staff view)
function editSaleModal(saleId) {
  const s = getState();
  const sale = s.sales.find(x => String(x.id) === String(saleId));
  if (!sale) { showToast('Sale not found.', 'error'); return; }
  showModal(`<div class="modal-header"><h2>Edit Sale</h2><button class="btn-close-modal" onclick="closeModal()">✕</button></div>
    <div class="modal-body">
      <div class="form-group"><label>Notes</label><textarea id="edit-sale-notes" class="form-control">${sale.notes || ''}</textarea></div>
    </div>
    <div class="modal-footer"><button class="btn btn-outline" onclick="closeModal()">Cancel</button><button class="btn btn-maroon" onclick="confirmEditSale('${sale.id}')">Save</button></div>`);
}

function confirmEditSale(saleId) {
  const s = getState();
  const sale = s.sales.find(x => String(x.id) === String(saleId));
  if (!sale) return;
  sale.notes = document.getElementById('edit-sale-notes').value;
  saveState(s);
  DB.editSale(saleId, sale.notes);
  closeModal();
  showToast('Sale updated!', 'success');
  renderSales();
}

function renderSales() {
  const page = 'sales';
  const navId = getNavRenderId();
  const s = getState();
  const u = s.currentUser;
  const s2 = getState();
  const u2 = s2.currentUser;
  const allSalesRaw = s2.sales || [];
  // Staff sees only their own sales; admin sees all
  const filteredByRole = u2.role === 'admin'
    ? allSalesRaw
    : allSalesRaw.filter(x => x.userId === u2.id || x.user_id === u2.id || x.branchId === u2.branchId);
  const allSales = [...filteredByRole].reverse().slice(0, 100);
  setPageHtml(page, navId, `
    <div class="page-header"><h1 class="page-title">Sales History</h1></div>
    <div class="data-card"><div class="data-card-body no-pad">
      <table class="data-table"><thead><tr><th>Receipt #</th><th>Customer</th><th>Items</th><th>Total</th><th>Status</th><th>Time</th>${u.role === 'admin' ? '<th>Actions</th>' : ''}</tr></thead>
      <tbody>${allSales.map(sale => {
    const cust = s2.customers.find(c => c.id === sale.customerId);
    const customer = cust ? (cust.companyName || cust.contactPerson) : 'Walk-in';
    return `<tr>
          <td class="td-mono">${sale.receiptNo || String(sale.id).slice(-6).toUpperCase()}</td>
          <td>${customer}</td>
          <td>${sale.items ? sale.items.length : 0}</td>
          <td class="td-mono" style="font-weight:700;color:var(--maroon)">₱${fmt(sale.total)}</td>
          <td><span class="badge ${sale.voided || sale.status === 'voided' ? 'badge-danger' : 'badge-success'}">${sale.voided || sale.status === 'voided' ? 'Voided' : 'Paid'}</span></td>
          <td class="td-mono">${fmtTime(sale.createdAt || sale.created_at)}</td>
          ${u.role === 'admin' ? `<td><button class="btn btn-sm btn-outline" onclick="editSaleModal('${sale.id}')">Edit</button> <button class="btn btn-sm btn-icon" onclick="voidSaleModal('${sale.id}')">${iconSvg('error')}</button></td>` : ''}
        </tr>`;
  }).join('') || `<tr><td colspan="${u.role === 'admin' ? 7 : 6}" style="text-align:center;padding:24px;color:var(--ink-60)">No sales found.</td></tr>`}
      </tbody></table>
    </div></div>`);
}

// CUSTOMERS / AR
// Customer Management State
var _custFilter = { search: '', status: 'all', sort: 'name' };

function renderCustomers() {
  _renderCustomerPage();
}

function _renderCustomerPage() {
  const page = 'customers';
  const navId = getNavRenderId();
  const s = getState();
  const u = s.currentUser;
  const isAdmin = u && u.role === 'admin';

  // Branch isolation: staff only see customers associated with their branch
  // A customer is "associated" if they have a sale at this branch, or were added at this branch
  const staffBranchId = (!isAdmin && u) ? u.branchId : null;

  // Build salesByCustomer (scoped to branch for staff)
  const salesByCustomer = {};
  const salesCountByCustomer = {};
  const lastSaleByCustomer = {};
  // Track which customers have activity at the staff's branch
  const branchCustomerIds = new Set();
  s.sales.forEach(sale => {
    if (!sale.customerId || sale.voided) return;
    // For branch scoping: track which customers transacted at the staff's branch
    if (staffBranchId && sale.branchId === staffBranchId) {
      branchCustomerIds.add(sale.customerId);
    }
    salesByCustomer[sale.customerId] = (salesByCustomer[sale.customerId] || 0) + sale.total;
    salesCountByCustomer[sale.customerId] = (salesCountByCustomer[sale.customerId] || 0) + 1;
    if (!lastSaleByCustomer[sale.customerId] || sale.createdAt > lastSaleByCustomer[sale.customerId]) {
      lastSaleByCustomer[sale.customerId] = sale.createdAt;
    }
  });

  // Also include customers explicitly tagged to this branch (e.g. added via POS at this branch)
  if (staffBranchId) {
    s.customers.forEach(c => {
      if (c.branchId === staffBranchId) branchCustomerIds.add(c.id);
    });
  }

  // AR Payments by customer
  const paidByCustomer = {};
  (s.arPayments || []).forEach(p => {
    paidByCustomer[p.customerId] = (paidByCustomer[p.customerId] || 0) + p.amount;
  });

  // For staff: only show customers linked to their branch
  const visibleCustomers = isAdmin
    ? s.customers
    : s.customers.filter(c => branchCustomerIds.has(c.id));

  const totalAR = visibleCustomers.reduce((sum, c) => sum + (c.outstandingBalance || 0), 0);
  const totalRevenue = visibleCustomers.reduce((sum, c) => sum + (salesByCustomer[c.id] || 0), 0);
  const blockedCount = visibleCustomers.filter(c => c.blocked).length;
  const activeCount = visibleCustomers.filter(c => !c.blocked).length;
  const posSourceCount = visibleCustomers.filter(c => c.source === 'pos').length;

  // Filter
  let filtered = visibleCustomers.filter(c => {
    const q = _custFilter.search.toLowerCase();
    const matchSearch = !q ||
      (c.companyName || '').toLowerCase().includes(q) ||
      (c.contactPerson || '').toLowerCase().includes(q) ||
      (c.phone || '').toLowerCase().includes(q) ||
      (c.email || '').toLowerCase().includes(q);
    const matchStatus =
      _custFilter.status === 'all' ? true :
        _custFilter.status === 'credit' ? (c.outstandingBalance || 0) > 0 :
          _custFilter.status === 'blocked' ? c.blocked :
            _custFilter.status === 'active' ? !c.blocked :
              _custFilter.status === 'pos' ? c.source === 'pos' : true;
    return matchSearch && matchStatus;
  });

  // Sort
  filtered.sort((a, b) => {
    if (_custFilter.sort === 'name') return (a.companyName || '').localeCompare(b.companyName || '');
    if (_custFilter.sort === 'balance') return (b.outstandingBalance || 0) - (a.outstandingBalance || 0);
    if (_custFilter.sort === 'purchases') return (salesByCustomer[b.id] || 0) - (salesByCustomer[a.id] || 0);
    if (_custFilter.sort === 'recent') return (lastSaleByCustomer[b.id] || '').localeCompare(lastSaleByCustomer[a.id] || '');
    return 0;
  });

  setPageHtml(page, navId, `
    <div class="page-header" style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:10px">
      <div>
        <h1 class="page-title">Customer Management</h1>
        <p class="page-subtitle">${isAdmin ? 'B2B customer accounts, purchase history, and accounts receivable' : ('Customers at your branch · ' + (staffBranchId ? (s.branches.find(b => b.id === staffBranchId)?.name || 'Branch') : 'Branch'))}</p>
      </div>
      <!-- Offline notice (hidden by default, shown by renderCustomers if API unreachable) -->
      <div id="cust-api-notice" style="display:none;align-items:center;gap:8px;background:#FEF3C7;border:1px solid #FCD34D;border-radius:8px;padding:8px 14px;font-size:13px;color:#92400E;margin-top:4px">
        ⚠️ <span>Running in <strong>offline/local mode</strong> — showing locally stored data. Changes save to your browser only until the server is reachable.</span>
      </div>
      <div class="customers-actions" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
        <button class="btn btn-maroon" onclick="addCustomerModal()">+ Add Customer</button>
        ${isAdmin ? '<button class="btn btn-outline" onclick="exportCustomersCSV()">⬇ Export CSV</button><button class="btn btn-outline" onclick="showMergeCustomersModal()">Merge Duplicates</button><button class="btn btn-outline" onclick="showSystemConfigModal()">System Config</button>' : ''}
      </div>
    </div>

    <!-- KPI Row -->
    <div class="kpi-grid" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr))">
      <div class="kpi-card"><div class="kpi-header"><div class="kpi-label">Total Customers</div><div class="kpi-icon blue">${iconSvg('building')}</div></div><div class="kpi-value">${visibleCustomers.length}</div><div class="kpi-sub">${posSourceCount} added via POS</div></div>
      <div class="kpi-card"><div class="kpi-header"><div class="kpi-label">Total Receivables</div><div class="kpi-icon maroon">${iconSvg('receipt')}</div></div><div class="kpi-value">₱${fmt(totalAR)}</div><div class="kpi-sub">${visibleCustomers.filter(c => (c.outstandingBalance || 0) > 0).length} clients with balance</div></div>
      <div class="kpi-card"><div class="kpi-header"><div class="kpi-label">Total Revenue</div><div class="kpi-icon green">${iconSvg('money')}</div></div><div class="kpi-value">₱${fmt(totalRevenue)}</div><div class="kpi-sub">All-time purchases</div></div>
      <div class="kpi-card"><div class="kpi-header"><div class="kpi-label">Active Accounts</div><div class="kpi-icon gold">${iconSvg('card')}</div></div><div class="kpi-value">${activeCount}</div><div class="kpi-sub">${blockedCount} blocked</div></div>
    </div>

    <!-- Search & Filter Bar -->
    <div class="data-card" style="margin-bottom:0">
      <div class="data-card-body" style="padding:14px 18px;display:flex;gap:10px;flex-wrap:wrap;align-items:center">
        <input class="form-control" style="flex:1;min-width:180px;max-width:320px" placeholder="Search company, contact, phone..."
          value="${_custFilter.search}" oninput="_custFilter.search=this.value;_renderCustomerPage()">
        <select class="form-control" style="width:auto" onchange="_custFilter.status=this.value;_renderCustomerPage()">
          <option value="all" ${_custFilter.status === 'all' ? 'selected' : ''}>All Status</option>
          <option value="active" ${_custFilter.status === 'active' ? 'selected' : ''}>Active</option>
          <option value="credit" ${_custFilter.status === 'credit' ? 'selected' : ''}>Has Balance</option>
          <option value="pos" ${_custFilter.status === 'pos' ? 'selected' : ''}>Added via POS</option>
          <option value="blocked" ${_custFilter.status === 'blocked' ? 'selected' : ''}>Blocked</option>
        </select>
        <select class="form-control" style="width:auto" onchange="_custFilter.sort=this.value;_renderCustomerPage()">
          <option value="name" ${_custFilter.sort === 'name' ? 'selected' : ''}>Sort: Name</option>
          <option value="balance" ${_custFilter.sort === 'balance' ? 'selected' : ''}>Sort: Balance ↓</option>
          <option value="purchases" ${_custFilter.sort === 'purchases' ? 'selected' : ''}>Sort: Purchases ↓</option>
          <option value="recent" ${_custFilter.sort === 'recent' ? 'selected' : ''}>Sort: Recent Sale</option>
        </select>
        <span style="color:var(--ink-60);font-size:13px;margin-left:4px">${filtered.length} of ${visibleCustomers.length} customers${!isAdmin ? ' (your branch)' : ''}</span>
      </div>
    </div>

    <!-- Customer Table -->
    <div class="data-card"><div class="data-card-body no-pad">
      <table class="data-table">
        <thead><tr>
          <th>Company</th>
          <th>Contact</th>
          <th>Phone / Email</th>
          <th>Address</th>
          <th>Transactions</th>
          <th>Total Purchases</th>
          <th>Outstanding AR</th>
          <th>Source</th>
          <th>Actions</th>
        </tr></thead>
        <tbody>${filtered.length === 0 ? `
          <tr><td colspan="9" style="text-align:center;padding:32px;color:var(--ink-60)">
            ${_custFilter.search || _custFilter.status !== 'all' ? 'No customers match your filter.' : isAdmin ? 'No customers yet. Add one above or via POS.' : 'No customers found for your branch yet. Add one above or via POS.'}
          </td></tr>` :
      filtered.map(c => {
        const bal = c.outstandingBalance || 0;
        const purchases = salesByCustomer[c.id] || 0;
        const txCount = salesCountByCustomer[c.id] || 0;
        const lastSale = lastSaleByCustomer[c.id];
        return `
            <tr style="${c.blocked ? 'opacity:0.55;' : ''}">
              <td>
                <strong style="display:flex;align-items:center;gap:6px">
                  ${c.blocked ? '<span title="Blocked" style="color:var(--danger)">🚫</span>' : ''}
                  ${c.companyName}
                </strong>
                <div class="text-xs text-muted">${c.source === 'pos' ? '🛒 Added via POS' : ''}${c.notes ? ` · 📝 ${c.notes.substring(0, 40)}${c.notes.length > 40 ? '…' : ''}` : ''}</div>
              </td>
              <td>${c.contactPerson}</td>
              <td>
                ${c.phone ? `<div class="td-mono text-xs">${c.phone}</div>` : ''}
                ${c.email ? `<div class="text-xs text-muted">${c.email}</div>` : '<div class="text-xs text-muted">No email</div>'}
              </td>
              <td style="max-width:140px;white-space:normal;font-size:12px">${c.address || '—'}</td>
              <td style="text-align:center">
                <span class="badge badge-blue">${txCount} sale${txCount !== 1 ? 's' : ''}</span>
                ${lastSale ? `<div class="text-xs text-muted" style="margin-top:2px">${fmtDate(lastSale)}</div>` : ''}
              </td>
              <td class="td-mono">₱${fmt(purchases)}</td>
              <td class="td-mono" style="font-weight:700;color:${bal > 0 ? 'var(--danger)' : 'var(--success)'}">
                ₱${fmt(bal)}
                ${bal > 0 ? `<div class="text-xs" style="color:var(--ink-60);font-weight:400">₱${fmt(paidByCustomer[c.id] || 0)} paid</div>` : ''}
              </td>
              <td><span class="badge ${c.source === 'pos' ? 'badge-gold' : 'badge-blue'}">${c.source === 'pos' ? 'POS' : 'Manual'}</span></td>
              <td>
                <div style="display:flex;flex-wrap:wrap;gap:4px">
                  <button class="btn btn-sm btn-outline" onclick="viewCustomerProfile('${c.id}')">Profile</button>
                  <button class="btn btn-sm btn-outline" onclick="editCustomerModal('${c.id}')">Edit</button>
                  ${bal > 0 ? `<button class="btn btn-sm btn-maroon" onclick="postARPaymentModal('${c.id}')">Post Payment</button>` : ''}
                  ${isAdmin ? `<button class="btn btn-sm btn-outline" style="color:${c.blocked ? 'var(--success)' : 'var(--danger)'}" onclick="toggleBlockCustomer('${c.id}')">${c.blocked ? 'Unblock' : 'Block'}</button>` : ''}
                </div>
              </td>
            </tr>`;
      }).join('')
    }</tbody>
      </table>
    </div></div>
  `);
}

function showSystemConfigModal() {
  showModal(`<div class='modal-header'><h2>System Configuration</h2><button class='btn-close-modal' onclick='closeModal()'>✕</button></div><div class='modal-body'>System configuration UI coming soon.</div><div class='modal-footer'><button class='btn btn-outline' onclick='closeModal()'>Close</button></div>`);
}

function showMergeCustomersModal() {
  const s = getState();
  const opts = s.customers.map(c => `<option value="${c.id}">${c.companyName} — ${c.contactPerson}</option>`).join('');
  showModal(`
    <div class="modal-header"><h2>Merge Duplicate Customers</h2><button class="btn-close-modal" onclick="closeModal()">✕</button></div>
    <div class="modal-body">
      <div class="alert alert-info" style="margin-bottom:12px">Select the duplicate customer to remove, and the master record to keep. All transactions from the duplicate will be reassigned to the master.</div>
      <div class="form-group"><label>Master Record (Keep)</label>
        <select id="merge-master" class="form-control">${opts}</select>
      </div>
      <div class="form-group"><label>Duplicate to Remove</label>
        <select id="merge-dupe" class="form-control">${opts}</select>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
      <button class="btn btn-maroon" onclick="confirmMergeCustomers()">Merge</button>
    </div>`);
}

function confirmMergeCustomers() {
  const s = getState();
  const masterId = document.getElementById('merge-master').value;
  const dupeId = document.getElementById('merge-dupe').value;
  if (masterId === dupeId) { showToast('Select two different customers.', 'error'); return; }
  const master = s.customers.find(c => c.id === masterId);
  const dupe = s.customers.find(c => c.id === dupeId);
  if (!master || !dupe) return;
  // Reassign sales
  s.sales.forEach(sale => { if (sale.customerId === dupeId) sale.customerId = masterId; });
  // Merge AR balance
  master.outstandingBalance = (master.outstandingBalance || 0) + (dupe.outstandingBalance || 0);
  // Merge AR payments
  (s.arPayments || []).forEach(p => { if (p.customerId === dupeId) p.customerId = masterId; });
  // Remove dupe
  s.customers = s.customers.filter(c => c.id !== dupeId);
  recordAudit(s, { action: 'customers_merged', message: `Merged ${dupe.companyName} → ${master.companyName}` });
  saveState(s);
  // FIX 5: Sync merged master balance + delete duplicate on server
  DB.updateCustomer(masterId, { outstandingBalance: master.outstandingBalance });
  DB.deleteCustomer(dupeId);
  closeModal();
  renderCustomers();
  showToast(`Merged "${dupe.companyName}" into "${master.companyName}".`, 'success');
}

function toggleBlockCustomer(customerId) {
  const s = getState();
  const c = s.customers.find(x => x.id === customerId);
  if (!c) return;
  const action = c.blocked ? 'unblock' : 'block';
  if (!c.blocked) {
    showModal(`
      <div class="modal-header"><h2>Block Customer</h2><button class="btn-close-modal" onclick="closeModal()">✕</button></div>
      <div class="modal-body">
        <div class="alert alert-error-box" style="margin-bottom:12px">Blocking <strong>${c.companyName}</strong> will prevent them from being selected at POS.</div>
        <div class="form-group"><label>Reason for blocking</label>
          <textarea id="block-reason" class="form-control" rows="3" placeholder="e.g. Non-payment, fraudulent activity..."></textarea>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
        <button class="btn btn-maroon" onclick="_confirmBlockCustomer('${customerId}')">Block Customer</button>
      </div>`);
  } else {
    c.blocked = false;
    c.blockReason = null;
    recordAudit(s, { action: 'customer_unblocked', message: `Customer unblocked: ${c.companyName}`, referenceId: c.id });
    saveState(s);
    DB.updateCustomer(c.id, { blocked: false });
    _renderCustomerPage();
    showToast(`${c.companyName} has been unblocked.`, 'success');
  }
}

function _confirmBlockCustomer(customerId) {
  const s = getState();
  const c = s.customers.find(x => x.id === customerId);
  if (!c) return;
  const reason = document.getElementById('block-reason').value.trim();
  if (!reason) { showToast('Please provide a reason.', 'error'); return; }
  c.blocked = true;
  c.blockReason = reason;
  recordAudit(s, { action: 'customer_blocked', message: `Customer blocked: ${c.companyName} — ${reason}`, referenceId: c.id });
  saveState(s);
  DB.updateCustomer(c.id, { blocked: true, blockReason: reason });
  closeModal();
  _renderCustomerPage();
  showToast(`${c.companyName} has been blocked.`, 'success');
}

// Customer Profile View
function viewCustomerProfile(customerId) {
  const s = getState();
  const c = s.customers.find(x => x.id === customerId);
  if (!c) return;

  const custSales = s.sales.filter(sale => sale.customerId === customerId && !sale.voided);
  const totalSpent = custSales.reduce((sum, sale) => sum + sale.total, 0);
  const arPayments = (s.arPayments || []).filter(p => p.customerId === customerId);
  const totalPaid = arPayments.reduce((sum, p) => sum + p.amount, 0);

  const salesRows = custSales.length === 0
    ? `<tr><td colspan="5" style="text-align:center;padding:16px;color:var(--ink-60)">No purchases yet.</td></tr>`
    : [...custSales].reverse().slice(0, 15).map(sale => `
        <tr>
          <td class="td-mono">${sale.receiptNo || sale.id}</td>
          <td>${fmtDate(sale.createdAt)}</td>
          <td>${(sale.items || []).length} item(s)</td>
          <td class="td-mono">₱${fmt(sale.total)}</td>
          <td><span class="badge ${sale.paymentMethod === 'credit' ? 'badge-gold' : 'badge-blue'}">${sale.paymentMethod || 'cash'}</span></td>
        </tr>`).join('');

  const arRows = arPayments.length === 0
    ? `<tr><td colspan="3" style="text-align:center;padding:12px;color:var(--ink-60)">No payments posted.</td></tr>`
    : [...arPayments].reverse().map(p => `
        <tr>
          <td>${fmtDate(p.createdAt)}</td>
          <td class="td-mono" style="color:var(--success)">₱${fmt(p.amount)}</td>
          <td>${p.note || '—'}</td>
        </tr>`).join('');

  showModal(`
    <div class="modal-header">
      <h2>${iconSvg('building')} ${c.companyName}</h2>
      <button class="btn-close-modal" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-body" style="max-height:75vh;overflow-y:auto">
      ${c.blocked ? `<div class="alert alert-error-box" style="margin-bottom:12px">🚫 This customer is blocked${c.blockReason ? ': ' + c.blockReason : ''}.</div>` : ''}

      <!-- Info Section -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px">
        <div>
          <div class="text-xs text-muted" style="margin-bottom:4px">CONTACT PERSON</div>
          <div style="font-weight:600">${c.contactPerson}</div>
        </div>
        <div>
          <div class="text-xs text-muted" style="margin-bottom:4px">PHONE</div>
          <div class="td-mono">${c.phone || '—'}</div>
        </div>
        <div>
          <div class="text-xs text-muted" style="margin-bottom:4px">EMAIL</div>
          <div>${c.email || '—'}</div>
        </div>
        <div>
          <div class="text-xs text-muted" style="margin-bottom:4px">ADDRESS</div>
          <div style="font-size:13px">${c.address || '—'}</div>
        </div>
        ${c.notes ? `<div style="grid-column:1/-1"><div class="text-xs text-muted" style="margin-bottom:4px">NOTES</div><div style="font-size:13px;background:var(--bg-3);padding:8px 10px;border-radius:6px">${c.notes}</div></div>` : ''}
        <div>
          <div class="text-xs text-muted" style="margin-bottom:4px">SOURCE</div>
          <span class="badge ${c.source === 'pos' ? 'badge-gold' : 'badge-blue'}">${c.source === 'pos' ? '🛒 Added via POS' : 'Manual Entry'}</span>
        </div>
        <div>
          <div class="text-xs text-muted" style="margin-bottom:4px">MEMBER SINCE</div>
          <div>${c.createdAt ? fmtDate(c.createdAt) : '—'}</div>
        </div>
      </div>

      <!-- AR Summary -->
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px">
        <div style="background:var(--bg-3);border-radius:8px;padding:12px;text-align:center">
          <div class="text-xs text-muted">Total Spent</div>
          <div style="font-size:18px;font-weight:700;color:var(--ink)">₱${fmt(totalSpent)}</div>
          <div class="text-xs text-muted">${custSales.length} transactions</div>
        </div>
        <div style="background:var(--bg-3);border-radius:8px;padding:12px;text-align:center">
          <div class="text-xs text-muted">Total Paid</div>
          <div style="font-size:18px;font-weight:700;color:var(--success)">₱${fmt(totalPaid)}</div>
        </div>
        <div style="background:var(--bg-3);border-radius:8px;padding:12px;text-align:center">
          <div class="text-xs text-muted">Outstanding</div>
          <div style="font-size:18px;font-weight:700;color:${(c.outstandingBalance || 0) > 0 ? 'var(--danger)' : 'var(--success)'}">₱${fmt(c.outstandingBalance || 0)}</div>
        </div>
      </div>

      <!-- Purchase History -->
      <div style="margin-bottom:16px">
        <div style="font-weight:600;margin-bottom:8px;font-size:14px">Purchase History (last 15)</div>
        <div style="overflow-x:auto">
          <table class="data-table" style="font-size:13px">
            <thead><tr><th>Receipt #</th><th>Date</th><th>Items</th><th>Total</th><th>Method</th></tr></thead>
            <tbody>${salesRows}</tbody>
          </table>
        </div>
      </div>

      <!-- AR Payment Log -->
      <div>
        <div style="font-weight:600;margin-bottom:8px;font-size:14px">AR Payment Log</div>
        <div style="overflow-x:auto">
          <table class="data-table" style="font-size:13px">
            <thead><tr><th>Date</th><th>Amount</th><th>Reference</th></tr></thead>
            <tbody>${arRows}</tbody>
          </table>
        </div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeModal()">Close</button>
      <button class="btn btn-outline" onclick="closeModal();editCustomerModal('${c.id}')">Edit</button>
      ${(c.outstandingBalance || 0) > 0 ? `<button class="btn btn-maroon" onclick="closeModal();postARPaymentModal('${c.id}')">Post Payment</button>` : ''}
    </div>
  `, 'lg');
}

// Export Customers CSV
function exportCustomersCSV() {
  const s = getState();
  const salesByCustomer = {};
  const salesCountByCustomer = {};
  s.sales.forEach(sale => {
    if (!sale.customerId || sale.voided) return;
    salesByCustomer[sale.customerId] = (salesByCustomer[sale.customerId] || 0) + sale.total;
    salesCountByCustomer[sale.customerId] = (salesCountByCustomer[sale.customerId] || 0) + 1;
  });
  const rows = [['ID', 'Company Name', 'Contact Person', 'Phone', 'Email', 'Address', 'Total Purchases', 'Outstanding Balance', 'Transactions', 'Source', 'Blocked', 'Notes']];
  s.customers.forEach(c => {
    rows.push([
      c.id, c.companyName, c.contactPerson, c.phone || '', c.email || '',
      (c.address || '').replace(/,/g, ''), salesByCustomer[c.id] || 0,
      c.outstandingBalance || 0, salesCountByCustomer[c.id] || 0,
      c.source || 'manual', c.blocked ? 'Yes' : 'No', (c.notes || '').replace(/,/g, '')
    ]);
  });
  const csv = rows.map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `customers_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  showToast('Customers exported to CSV.', 'success');
}

function addCustomerModal(fromPOS = false) {
  showModal(`
    <div class="modal-header"><h2>Add Customer</h2><button class="btn-close-modal" onclick="closeModal()">✕</button></div>
    <div class="modal-body">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:0 16px">
        <div class="form-group" style="grid-column:1/-1">
          <label>Name <span style="color:var(--danger)">*</span></label>
          <div style="position:relative">
            <input id="cust-company" class="form-control" placeholder="e.g. Juan dela Cruz" autocomplete="off"
              oninput="custNameSearch(this.value)" onblur="setTimeout(function(){var d=document.getElementById('cust-suggest');if(d)d.style.display='none';},180)">
            <div id="cust-suggest" style="display:none;position:absolute;top:100%;left:0;right:0;background:var(--white);border:1.5px solid var(--ink-10);border-radius:var(--radius);box-shadow:var(--shadow);z-index:9999;max-height:220px;overflow-y:auto"></div>
          </div>
        </div>
        <div class="form-group"><label>Phone</label><input id="cust-phone" class="form-control" placeholder="0917-xxx-xxxx"></div>
        <div class="form-group"><label>Email</label><input id="cust-email" class="form-control" type="email" placeholder="email@company.com"></div>
        <div class="form-group" style="grid-column:1/-1"><label>Address</label><input id="cust-address" class="form-control" placeholder="Business address"></div>
        <div class="form-group" style="grid-column:1/-1"><label>Notes</label><textarea id="cust-notes" class="form-control" rows="2" placeholder="Credit terms, special instructions, etc."></textarea></div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
      <button class="btn btn-maroon" onclick="confirmAddCustomer(${fromPOS})">${fromPOS ? 'Add &amp; Select' : 'Add Customer'}</button>
    </div>`);
}

function custNameSearch(val) {
  var drop = document.getElementById('cust-suggest');
  if (!drop) return;
  var q = (val || '').trim().toLowerCase();
  if (!q) { drop.style.display = 'none'; return; }

  // Pull from POS customers only — OM customers are separate and should not appear here
  var matches = (getState().customers || []).map(function (c) {
    return { _id: c.id, _src: 'pos', name: c.companyName || '', contact: c.contactPerson || '', phone: c.phone || '', email: c.email || '', address: c.address || '', notes: c.notes || '' };
  }).filter(function (c) {
    return c.name.toLowerCase().indexOf(q) !== -1 || c.contact.toLowerCase().indexOf(q) !== -1;
  }).slice(0, 8);

  if (!matches.length) { drop.style.display = 'none'; return; }

  drop.innerHTML = matches.map(function (c) {
    return '<div class="cust-suggest-item" onmousedown="custFillFromRecord(\'' + c._id + '\',\'' + c._src + '\')">'
      + '<div style="font-weight:600;font-size:13px">' + omEsc(c.name) + '</div>'
      + '<div style="font-size:11px;color:var(--ink-60)">'
      + (c.contact || '')
      + (c.phone ? ' · ' + c.phone : '')
      + '</div>'
      + '</div>';
  }).join('');
  drop.style.display = 'block';
}

function custFillFromRecord(custId, src) {
  var c = null;
  if (src === 'om') {
    c = (getCustomerRecords() || []).find(function (x) { return x.id === custId; });
    if (c) c = { companyName: c.businessName, contactPerson: c.contactPerson, phone: c.phone, email: c.email, address: c.address, notes: c.notes || '' };
  } else {
    c = (getState().customers || []).find(function (x) { return x.id === custId; });
  }
  if (!c) return;
  function sv(id, v) { var el = document.getElementById(id); if (el) el.value = v || ''; }
  sv('cust-company', c.companyName);
  sv('cust-contact', c.contactPerson);
  sv('cust-phone', c.phone);
  sv('cust-email', c.email);
  sv('cust-address', c.address);
  sv('cust-notes', c.notes);
  var drop = document.getElementById('cust-suggest');
  if (drop) drop.style.display = 'none';
}

function confirmAddCustomer(fromPOS = false) {
  const s = getState();
  const companyName = (document.getElementById('cust-company')?.value || '').trim();
  const contactPerson = (document.getElementById('cust-contact')?.value || '').trim();
  const phone = (document.getElementById('cust-phone')?.value || '').trim();
  const address = (document.getElementById('cust-address')?.value || '').trim();
  const emailEl = document.getElementById('cust-email');
  const notesEl = document.getElementById('cust-notes');
  const email = emailEl ? emailEl.value.trim() : '';
  const notes = notesEl ? notesEl.value.trim() : '';
  // Allow saving even with missing fields — name will default to "Unknown" if blank

  // Helper: save customer locally and proceed
  function _saveLocally(id) {
    const u = s.currentUser;
    const newCust = {
      id: id || ('cust_local_' + Date.now()),
      companyName: companyName || 'Unknown', contactPerson: contactPerson || '', phone, address, email, notes,
      outstandingBalance: 0,
      blocked: false,
      createdAt: new Date().toISOString(),
      source: fromPOS ? 'pos' : 'manual',
      // Tag the customer's branch so staff can see them later
      branchId: (u && u.role !== 'admin') ? (u.branchId || null) : null,
    };
    s.customers.push(newCust);
    recordAudit(s, { action: 'customer_added', message: 'Customer added (local): ' + companyName });
    saveState(s);
    DB.saveCustomer(newCust);
    closeModal();
    showToast('Customer added (saved locally).', 'success');
    if (fromPOS) { renderPOS(); } else { renderCustomers(); }
  }

  // Save directly to local state (no server required)
  _saveLocally(null);
}

function editCustomerModal(customerId) {
  const s = getState();
  const c = s.customers.find(x => x.id === customerId);
  if (!c) return;
  showModal(`<div class="modal-header"><h2>Edit Customer</h2><button class="btn-close-modal" onclick="closeModal()">✕</button></div>
    <div class="modal-body">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:0 16px">
        <div class="form-group" style="grid-column:1/-1"><label>Company / Business Name <span style="color:var(--danger)">*</span></label><input id="ec-company" class="form-control" value="${c.companyName}"></div>
        <div class="form-group"><label>Contact Person <span style="color:var(--danger)">*</span></label><input id="ec-contact" class="form-control" value="${c.contactPerson}"></div>
        <div class="form-group"><label>Phone</label><input id="ec-phone" class="form-control" value="${c.phone || ''}"></div>
        <div class="form-group"><label>Email</label><input id="ec-email" class="form-control" type="email" value="${c.email || ''}"></div>
        <div class="form-group" style="grid-column:1/-1"><label>Address</label><input id="ec-address" class="form-control" value="${c.address || ''}"></div>
        <div class="form-group" style="grid-column:1/-1"><label>Notes</label><textarea id="ec-notes" class="form-control" rows="2">${c.notes || ''}</textarea></div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
      <button class="btn btn-maroon" onclick="confirmEditCustomer('${customerId}')">Save Changes</button>
    </div>`);
}

function confirmEditCustomer(customerId) {
  const s = getState();
  const c = s.customers.find(x => x.id === customerId);
  if (!c) return;
  c.companyName = document.getElementById('ec-company').value.trim();
  c.contactPerson = document.getElementById('ec-contact').value.trim();
  c.phone = document.getElementById('ec-phone').value.trim();
  c.address = document.getElementById('ec-address').value.trim();
  c.email = document.getElementById('ec-email').value.trim();
  c.notes = document.getElementById('ec-notes').value.trim();
  // No required field enforcement — allow saving with partial data
  recordAudit(s, { action: 'customer_updated', message: `Customer updated: ${c.companyName}`, referenceId: c.id });
  saveState(s);
  DB.updateCustomer(c.id, { companyName: c.companyName, contactPerson: c.contactPerson, phone: c.phone, address: c.address, email: c.email, notes: c.notes });
  closeModal();
  _renderCustomerPage();
  showToast('Customer updated.', 'success');
}

function postARPaymentModal(customerId) {
  const s = getState();
  if (!s.currentUser || s.currentUser.role !== 'admin') {
    showToast('Only Administrators can post AR payments.', 'error');
    return;
  }
  const c = s.customers.find(x => x.id === customerId);
  if (!c) return;
  showModal(`<div class="modal-header"><h2>Post AR Payment</h2><button class="btn-close-modal" onclick="closeModal()">✕</button></div>
    <div class="modal-body">
      <div style="background:var(--cream);border-radius:var(--radius);padding:14px 16px;margin-bottom:16px;display:grid;grid-template-columns:1fr 1fr;gap:6px 16px;font-size:13px;">
        <div style="grid-column:1/-1"><span style="color:var(--ink-50)">Customer</span><div style="font-weight:700;font-size:15px;margin-top:2px">${c.companyName}</div></div>
        <div><span style="color:var(--ink-50)">Outstanding Balance</span><div style="font-weight:700;font-size:16px;color:var(--danger);margin-top:2px">₱${fmt(c.outstandingBalance || 0)}</div></div>
        <div><span style="color:var(--ink-50)">Contact</span><div style="font-weight:600;margin-top:2px">${c.contactPerson || '—'}</div></div>
      </div>
      <div class="form-row-2">
        <div class="form-group">
          <label>Payment Amount (₱) <span style="color:var(--danger)">*</span></label>
          <input id="ar-amount" type="number" class="form-control" min="0" step="0.01" placeholder="0.00">
        </div>
        <div class="form-group">
          <label>Reference / Receipt #</label>
          <input id="ar-note" class="form-control" placeholder="e.g. OR-001234">
        </div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
      <button class="btn btn-maroon" onclick="confirmARPayment('${customerId}')">Post Payment</button>
    </div>`);
}

function confirmARPayment(customerId) {
  const s = getState();
  const c = s.customers.find(x => x.id === customerId);
  if (!c) return;
  const amount = parseFloat(document.getElementById('ar-amount').value) || 0;
  if (amount <= 0) { showToast('Enter a valid payment amount.', 'error'); return; }
  c.outstandingBalance = Math.max(0, (c.outstandingBalance || 0) - amount);
  const payment = { id: 'arp_' + Date.now(), customerId, amount, note: document.getElementById('ar-note').value.trim(), createdAt: new Date().toISOString(), postedBy: s.currentUser?.id || null };
  s.arPayments.push(payment);
  recordAudit(s, { action: 'ar_payment_posted', message: `AR payment posted for ${c.companyName}`, referenceId: customerId, meta: { amount } });
  saveState(s);
  DB.postARPayment(payment);
  // BUG FIX 3: Sync updated customer outstanding balance to server
  DB.updateCustomer(c.id, { outstandingBalance: c.outstandingBalance });
  closeModal();
  _renderCustomerPage();
  showToast('AR payment posted.', 'success');
}

// SUPPLIER RECEIVING
function renderReceiving() {
  const s = getState();
  if (!s.currentUser || s.currentUser.role !== 'admin') { accessDenied('Supplier Receiving'); return; }
  document.getElementById('page-content').innerHTML = `
    <div class="page-header" style="display:flex;justify-content:space-between;align-items:flex-start">
      <div><h1 class="page-title">Supplier Receiving</h1><p class="page-subtitle">Log incoming deliveries and update inventory automatically</p></div>
      <button class="btn btn-maroon" onclick="receivingModal()">+ New Receiving</button>
    </div>
    <div class="data-card"><div class="data-card-body no-pad">
      <table class="data-table"><thead><tr><th>Date</th><th>Supplier</th><th>Branch</th><th>Item</th><th>Qty</th><th>Logged By</th></tr></thead>
      <tbody>${[...s.receivings].reverse().slice(0, 50).map(r => {
    const branch = s.branches.find(b => b.id === r.branchId);
    const user = s.users.find(u => u.id === r.createdBy);
    return `<tr><td class="td-mono">${fmtTime(r.receivedAt)}</td><td>${r.supplierName}</td><td>${branch?.name || '—'}</td><td>${r.productName} (${r.variantName})</td><td>${r.qty}</td><td>${user?.name || '—'}</td></tr>`;
  }).join('') || '<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--ink-60)">No receiving logs yet.</td></tr>'}</tbody>
      </table>
    </div></div>`;
}

function receivingModal() {
  const s = getState();
  const branchId = getActiveBranchId(s, s.currentUser);
  const variantOptions = s.products.flatMap(p => (p.variants || []).map(v => `<option value="${v.id}">${p.name} — ${v.name} (${v.sku})</option>`)).join('');
  showModal(`<div class="modal-header"><h2>Log Supplier Receiving</h2><button class="btn-close-modal" onclick="closeModal()">✕</button></div>
    <div class="modal-body">
      <div class="form-row-2">
        <div class="form-group">
          <label>Supplier Name <span style="color:var(--danger)">*</span></label>
          <input id="recv-supplier" class="form-control" placeholder="e.g. ABC Packaging Co.">
        </div>
        <div class="form-group">
          <label>Branch <span style="color:var(--danger)">*</span></label>
          <div class="form-select-wrap"><select id="recv-branch" class="form-control">${s.branches.map(b => `<option value="${b.id}" ${b.id === branchId ? 'selected' : ''}>${b.name}</option>`).join('')}</select></div>
        </div>
      </div>
      <div class="form-group">
        <label>Item Variant <span style="color:var(--danger)">*</span></label>
        <div class="form-select-wrap"><select id="recv-variant" class="form-control">${variantOptions}</select></div>
      </div>
      <div class="form-row-2">
        <div class="form-group">
          <label>Quantity Received <span style="color:var(--danger)">*</span></label>
          <input id="recv-qty" type="number" class="form-control" min="1" value="1">
        </div>
        <div class="form-group">
          <label>Date Received</label>
          <input id="recv-date" type="date" class="form-control" value="${new Date().toISOString().slice(0, 10)}">
        </div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
      <button class="btn btn-maroon" onclick="confirmReceiving()">Log Receiving</button>
    </div>`);
}

function confirmReceiving() {
  const s = getState();
  const supplierName = document.getElementById('recv-supplier').value.trim();
  const variantId = document.getElementById('recv-variant').value;
  const qty = parseInt(document.getElementById('recv-qty').value) || 0;
  const branchId = document.getElementById('recv-branch').value;
  const dateStr = document.getElementById('recv-date').value;
  if (!supplierName || !variantId || qty <= 0) { showToast('Complete all required fields.', 'error'); return; }
  const found = findProductAndVariantByVariantId(s, variantId);
  if (!found) { showToast('Invalid variant selected.', 'error'); return; }
  adjustVariantBranchStock(found.variant, branchId, qty);
  const receiving = {
    id: 'recv_' + Date.now(),
    supplierName,
    branchId,
    productId: found.product.id,
    variantId,
    productName: found.product.name,
    variantName: found.variant.name,
    qty,
    receivedAt: new Date(dateStr + 'T08:00:00').toISOString(),
    createdBy: s.currentUser?.id || null,
  };
  s.receivings.push(receiving);
  recordAudit(s, { action: 'supplier_receiving_logged', message: `Receiving logged: ${supplierName}`, meta: { product: found.product.name, variant: found.variant.name, qty } });
  saveState(s);
  DB.saveReceiving(receiving);
  closeModal();
  renderReceiving();
  showToast('Receiving logged and stock updated.', 'success');
}

// ORDERS / FULFILLMENT — Full Order Management System

// Data Helpers
function getCustomerRecords() { return JSON.parse(localStorage.getItem('om_customers') || '[]'); }
function saveCustomerRecords(d) { localStorage.setItem('om_customers', JSON.stringify(d)); }
function getLogoUploads() { return JSON.parse(localStorage.getItem('om_logos') || '[]'); }
function saveLogoUploads(d) { localStorage.setItem('om_logos', JSON.stringify(d)); }
function getPaymentRecords() { return JSON.parse(localStorage.getItem('om_payments') || '[]'); }
function savePaymentRecords(d) { localStorage.setItem('om_payments', JSON.stringify(d)); }
function getProductionRecords() { return JSON.parse(localStorage.getItem('om_production') || '[]'); }
function saveProductionRecords(d) { localStorage.setItem('om_production', JSON.stringify(d)); }
function getDispatchRecords() {
  var rows = JSON.parse(localStorage.getItem('om_dispatch') || '[]');
  var unique = omUniqueDispatchRecords(rows);
  if (unique.length !== rows.length) localStorage.setItem('om_dispatch', JSON.stringify(unique));
  return unique;
}
function saveDispatchRecords(d) { localStorage.setItem('om_dispatch', JSON.stringify(omUniqueDispatchRecords(d || []))); }

function omGenId(prefix) { return prefix + '_' + Date.now() + '_' + Math.floor(Math.random() * 10000); }
function omFmt(n) { return Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function omDate(iso) { if (!iso) return '\u2014'; var d = new Date(iso); return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }); }

var _omTab = 'orders';
var _omSearch = '';
var _omFilter = '';

// showCustomerModal — search existing or add new customer from POS
function showCustomerModal() {
  var s = getState();
  // POS cart customer picker — POS customers only, OM customers are separate
  var combined = [];
  (s.customers || []).forEach(function (c) {
    var n = (c.companyName || c.contactPerson || '').trim();
    if (n) combined.push({ id: c.id, src: 'pos', name: n, contact: c.contactPerson || '', phone: c.phone || '' });
  });

  function renderList(q) {
    var q2 = (q || '').toLowerCase().trim();
    var shown = q2 ? combined.filter(function (c) {
      return c.name.toLowerCase().indexOf(q2) !== -1 || c.contact.toLowerCase().indexOf(q2) !== -1;
    }) : combined;
    shown = shown.slice(0, 10);
    if (!shown.length) return '<div style="padding:20px;text-align:center;color:var(--ink-60);font-size:13px">' + (q2 ? 'No matching customers found.' : 'No customer records yet.') + '</div>';
    return shown.map(function (c) {
      return '<div class="cust-suggest-item" onclick="posSelectCustomer(\'' + c.id + '\',\'' + c.src + '\')" style="cursor:pointer;padding:12px 16px">'
        + '<div style="font-weight:600;font-size:13px">' + omEsc(c.name) + '</div>'
        + '<div style="font-size:11px;color:var(--ink-60)">' + (c.contact || '') + (c.phone ? ' · ' + c.phone : '') + '</div>'
        + '</div>';
    }).join('');
  }

  showModal(
    '<div class="modal-header"><h2>' + iconSvg('users') + ' Customer</h2><button class="btn-close-modal" onclick="closeModal()">✕</button></div>'
    + '<div class="modal-body" style="padding-bottom:8px">'
    + '<div style="display:flex;gap:8px;margin-bottom:12px">'
    + '<div style="position:relative;flex:1">'
    + '<span style="position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--ink-60)">' + iconSvg('search') + '</span>'
    + '<input id="pos-cust-search" class="form-control" style="padding-left:34px" placeholder="Search customer name…" autocomplete="off" oninput="posCustomerSearchRefresh(this.value)">'
    + '</div>'
    + '<button class="btn btn-maroon" onclick="posOpenNewCustomerForm()">+ New Customer</button>'
    + '</div>'
    + '<div id="pos-cust-list" style="max-height:320px;overflow-y:auto;border:1.5px solid var(--ink-10);border-radius:var(--radius)">'
    + renderList('')
    + '</div>'
    + '</div>'
  );

  // Store combined list for live search
  window._posCustList = combined;
}

function posCustomerSearchRefresh(q) {
  var list = window._posCustList || [];
  var q2 = (q || '').toLowerCase().trim();
  var shown = q2 ? list.filter(function (c) {
    return c.name.toLowerCase().indexOf(q2) !== -1 || c.contact.toLowerCase().indexOf(q2) !== -1;
  }) : list;
  shown = shown.slice(0, 10);
  var el = document.getElementById('pos-cust-list');
  if (!el) return;
  if (!shown.length) { el.innerHTML = '<div style="padding:20px;text-align:center;color:var(--ink-60);font-size:13px">' + (q2 ? 'No matching customers found.' : 'No customer records yet.') + '</div>'; return; }
  el.innerHTML = shown.map(function (c) {
    return '<div class="cust-suggest-item" onclick="posSelectCustomer(\'' + c.id + '\',\'' + c.src + '\')" style="cursor:pointer;padding:12px 16px">'
      + '<div style="font-weight:600;font-size:13px">' + omEsc(c.name) + '</div>'
      + '<div style="font-size:11px;color:var(--ink-60)">' + (c.contact || '') + (c.phone ? ' · ' + c.phone : '') + '</div>'
      + '</div>';
  }).join('');
}

function posSelectCustomer(custId, src) {
  var c = null;
  var name = '';
  if (src === 'om') {
    var rec = (getCustomerRecords() || []).find(function (x) { return x.id === custId; });
    if (rec) {
      name = rec.businessName || rec.contactPerson || '';
      // Mirror into pos customers so credit sales work
      var s = getState();
      var existing = s.customers.find(function (x) { return (x.companyName || '').toLowerCase() === name.toLowerCase(); });
      if (!existing) {
        var newC = { id: 'cust_om_' + custId, companyName: name, contactPerson: rec.contactPerson || '', phone: rec.phone || '', email: rec.email || '', address: rec.address || '', notes: rec.notes || '', outstandingBalance: 0, blocked: false, source: 'pos', createdAt: new Date().toISOString() };
        s.customers.push(newC);
        saveState(s);
        custId = newC.id;
        // Persist to DB so it appears in POS Customer Records
        DB.saveCustomer(newC).catch(function (e) { console.error('[DB] saveCustomer (cart mirror) failed:', e.message); });
      } else {
        custId = existing.id;
      }
    }
  } else {
    var s2 = getState();
    var posC = (s2.customers || []).find(function (x) { return x.id === custId; });
    if (posC) name = posC.companyName || posC.contactPerson || '';
  }

  var s3 = getState();
  s3.posDraft = s3.posDraft || {};
  s3.posDraft.customerId = custId;
  saveState(s3);

  // Update the cart strip without full re-render
  var strip = document.getElementById('pos-selected-customer');
  var nameEl = document.getElementById('pos-selected-customer-name');
  if (strip) strip.classList.remove('hidden');
  if (nameEl) nameEl.textContent = name;

  closeModal();
  showToast(name + ' selected.', 'success');
}

function posRemoveCustomer() {
  var s = getState();
  s.posDraft = s.posDraft || {};
  s.posDraft.customerId = '';
  saveState(s);
  var strip = document.getElementById('pos-selected-customer');
  if (strip) strip.classList.add('hidden');
}

function posOpenNewCustomerForm() {
  closeModal();
  addCustomerModal(true);
}

function dispatchOrder(orderId) {
  var orders = getOrders();
  var order = orders.find(function (o) { return String(o.id) === String(orderId); });
  if (!order) { showToast('Order not found.', 'error'); return; }
  if (!omIsDispatchReady(order)) { showToast('Only QC-passed jobs can be dispatched.', 'error'); return; }
  order.status = 'dispatch';
  saveOrders(orders);
  DB.updateOrder(order.id, { status: 'dispatch', qc_status: 'passed' });
  showToast('Order marked as dispatched.', 'success');
  renderOrders();
}

function editOrderModal(orderId) {
  omEditOrderModal(orderId);
}

function confirmEditOrder(orderId) {
  var orders = getOrders();
  var order = orders.find(function (o) { return String(o.id) === String(orderId); });
  if (order) {
    var due = document.getElementById('edit-order-due');
    var notes = document.getElementById('edit-order-notes');
    var status = document.getElementById('edit-order-status');
    if (due) order.due_date = due.value;
    if (notes) order.notes = notes.value;
    if (status) order.status = status.value;
    saveOrders(orders);
    DB.updateOrder(order.id, { due_date: order.due_date, notes: order.notes, status: order.status });
    closeModal();
    showToast('Order updated!', 'success');
    renderOrders();
  }
}

function voidOrderModal(orderId) {
  var _u = getState().currentUser; if (!_u || _u.role !== 'admin') { showToast('Admin access required.', 'error'); return; }
  showModal('<div class="modal-header"><h2>' + iconSvg('error') + ' Cancel Order</h2><button class="btn-close-modal" onclick="closeModal()">✕</button></div>'
    + '<div class="modal-body">'
    + '<div class="alert alert-error-box">' + iconSvg('warning') + ' This will cancel the order. This cannot be undone.</div>'
    + '<div class="form-group"><label>Reason (required)</label><input type="text" id="void-order-reason" class="form-control" placeholder="Enter reason..."></div>'
    + '</div>'
    + '<div class="modal-footer"><button class="btn btn-outline" onclick="closeModal()">Keep Order</button><button class="btn btn-danger" onclick="confirmVoidOrder(\'' + orderId + '\')">Cancel Order</button></div>');
}

function confirmVoidOrder(orderId) {
  var reasonEl = document.getElementById('void-order-reason');
  var reason = reasonEl ? reasonEl.value.trim() : '';
  if (!reason) { showToast('Reason is required.', 'error'); return; }
  var orders = getOrders();
  var order = orders.find(function (o) { return String(o.id) === String(orderId); });
  if (order) {
    order.status = 'cancelled';
    order.cancel_reason = reason;
    saveOrders(orders);
    DB.updateOrder(order.id, { status: 'cancelled', cancel_reason: reason });
    closeModal();
    showToast('Order cancelled.', 'warning');
    renderOrders();
  }
}

function fulfillOrder(orderId) {
  var orders = getOrders();
  var order = orders.find(function (o) { return String(o.id) === String(orderId); });
  if (order) {
    order.status = 'production';
    saveOrders(orders);
    DB.updateOrder(order.id, { status: 'production' });
    showToast('Order moved to production.', 'success');
    renderOrders();
  }
}

// STATUS BADGES
function omStatusBadge(status) {
  var map = {
    pending: '<span class="badge badge-warning">' + iconSvg('clock') + ' Pending</span>',
    approved: '<span class="badge badge-info" style="background:#0d9488;color:#fff;">' + iconSvg('check') + ' Approved</span>',
    cancelled: '<span class="badge badge-danger">' + iconSvg('error') + ' Cancelled</span>',
    production: '<span class="badge badge-info">' + iconSvg('printer') + ' In Production</span>',
    for_qc: '<span class="badge badge-warning">' + iconSvg('clock') + ' For QC</span>',
    dispatch: '<span class="badge badge-primary">' + iconSvg('truck') + ' Dispatch</span>',
    completed: '<span class="badge badge-success">' + iconSvg('check') + ' Completed</span>',
  };
  return map[status] || '<span class="badge badge-neutral">' + status + '</span>';
}

function omPayStatusBadge(s) {
  if (!s || s === 'Pending') return '<span class="badge badge-neutral">Pending</span>';
  if (s === 'Fully Paid') return '<span class="badge badge-success">Fully Paid</span>';
  if (s === '30%' || s === 'Partial') return '<span class="badge badge-warning">Partial</span>';
  return '<span class="badge badge-neutral">' + s + '</span>';
}

// Lightweight background sync: pull fresh orders + production records from server,
// update localStorage, then re-render the OM tab so all users see live status.
var _omSyncInFlight = false;
function omSyncFromServer(thenRender) {
  if (_omSyncInFlight) return;
  _omSyncInFlight = true;
  Promise.all([
    apiGet('/orders').catch(function () { return null; }),
    apiGet('/production').catch(function () { return null; }),
    apiGet('/dispatch').catch(function () { return null; }),
    apiGet('/order-payments').catch(function () { return null; }),
  ]).then(function (results) {
    var serverOrders = results[0];
    var serverProds = results[1];
    var serverDisps = results[2];
    var serverPays = results[3];

    if (serverOrders && Array.isArray(serverOrders)) {
      var local = JSON.parse(localStorage.getItem('orders') || '[]');
      var serverIds = new Set(serverOrders.map(function (o) { return String(o.id); }));
      var localOnly = local.filter(function (o) { return !serverIds.has(String(o.id)); });
      localStorage.setItem('orders', JSON.stringify([].concat(serverOrders, localOnly)));
    }

    if (serverProds && Array.isArray(serverProds)) {
      var localProds = JSON.parse(localStorage.getItem('om_production') || '[]');
      var serverProdIds = new Set(serverProds.map(function (p) { return String(p.id); }));
      var localOnlyProds = localProds.filter(function (p) { return !serverProdIds.has(String(p.id)); });
      var mappedProds = serverProds.map(function (p) {
        return {
          id: p.id,
          orderId: p.order_id,
          orderNumber: p.order_id,
          progress: parseInt(p.progress) || 0,
          qcResult: p.qc_status || null,
          qcStatus: p.qc_status || null,
          assignedTo: p.assigned_to || null,
          materialsUsed: p.materials_note || null,
          updatedAt: p.updated_at || null,
        };
      });
      localStorage.setItem('om_production', JSON.stringify([].concat(mappedProds, localOnlyProds)));
    }

    if (serverDisps && Array.isArray(serverDisps)) {
      var localDisps = JSON.parse(localStorage.getItem('om_dispatch') || '[]');
      var serverDispIds = new Set(serverDisps.map(function (d) { return String(d.id); }));
      var localOnlyDisps = localDisps.filter(function (d) { return !serverDispIds.has(String(d.id)); });
      var mappedDisps = serverDisps.map(function (d) {
        return {
          id: d.id,
          orderId: d.order_id,
          orderNumber: d.order_id,
          dispatchMethod: d.dispatch_method || null,
          dispatchedAt: d.dispatched_at || null,
          dispatchedBy: d.dispatched_by || null,
          notes: d.note || null,
          date: d.dispatched_at || null,
        };
      });
      localStorage.setItem('om_dispatch', JSON.stringify([].concat(mappedDisps, localOnlyDisps)));
    }

    if (serverPays && Array.isArray(serverPays)) {
      var localPays = JSON.parse(localStorage.getItem('om_payments') || '[]');
      var serverPayIds = new Set(serverPays.map(function (p) { return String(p.id); }));
      var localOnlyPays = localPays.filter(function (p) { return !serverPayIds.has(String(p.id)); });
      var mappedPays = serverPays.map(function (p) {
        return {
          id: p.id,
          orderId: p.order_id,
          orderNumber: p.order_id,
          customerId: p.customer_id || '',
          businessName: p.business_name || '',
          contactPerson: p.contact_person || '',
          totalAmount: parseFloat(p.total_amount) || 0,
          downpayment: parseFloat(p.downpayment) || 0,
          balance: parseFloat(p.balance) || 0,
          modeOfPayment: p.mode_of_payment || '',
          paymentStatus: p.payment_status || 'Pending',
          amountPaid: parseFloat(p.downpayment) || 0,
          note: p.note || '',
          date: p.date || '',
        };
      });
      localStorage.setItem('om_payments', JSON.stringify([].concat(mappedPays, localOnlyPays)));
    }

    _omSyncInFlight = false;
    if (thenRender) omRefreshTab();
  }).catch(function () { _omSyncInFlight = false; });
}

// MAIN RENDER
function renderOrders(filterStatus, searchQuery) {
  var s = getState();
  var u = s.currentUser;
  var isPrint = u && u.role === 'print';
  var isStaff = u && (u.role === 'cashier' || u.role === 'team_leader' || u.role === 'staff');

  // Always pull fresh data from server so cross-user changes (e.g. print QC → dispatch)
  // are visible immediately without requiring a full page reload.
  omSyncFromServer(true);

  if (filterStatus !== undefined) _omFilter = filterStatus;
  if (searchQuery !== undefined) _omSearch = searchQuery;

  var orders = getOrders();
  var crs = getCustomerRecords();
  var prods = getProductionRecords();
  var dispatches = getDispatchRecords();
  var payments = getPaymentRecords();
  var activeProductionCount = prods.filter(function (p) {
    var linkedOrder = orders.find(function (o) { return String(o.id) === String(p.orderId); });
    var orderDone = linkedOrder && (linkedOrder.status === 'completed' || omIsDispatchReady(linkedOrder));
    return !(p.status === 'completed' || orderDone);
  }).length;

  var pending = orders.filter(function (o) { return o.status === 'pending'; }).length;
  var inProd = orders.filter(function (o) { return o.status === 'production'; }).length;
  var dispCount = orders.filter(function (o) { return omIsDispatchReady(o); }).length;
  var done = orders.filter(function (o) { return o.status === 'completed'; }).length;
  var balDue = orders.reduce(function (sum, o) { return sum + (o.balance || 0); }, 0);

  // ── PRINT PERSONNEL: Production + Dispatch + Orders tabs ──────────────
  if (isPrint) {
    var printTabIds = ['orders', 'production', 'dispatch', 'completed'];
    if (!_omTab || !printTabIds.includes(_omTab)) {
      var storedPrintTab = sessionStorage.getItem('omTab');
      _omTab = (storedPrintTab && printTabIds.includes(storedPrintTab)) ? storedPrintTab : 'production';
    }
    var printKpi = '<div class="kpi-grid" style="margin-bottom:20px">'
      + '<div class="kpi-card"><div class="kpi-header"><div class="kpi-label">In Production</div><div class="kpi-icon maroon">' + iconSvg('printer') + '</div></div><div class="kpi-value" style="color:var(--info)">' + inProd + '</div></div>'
      + '<div class="kpi-card"><div class="kpi-header"><div class="kpi-label">In Dispatch</div><div class="kpi-icon gold">' + iconSvg('truck') + '</div></div><div class="kpi-value" style="color:var(--gold)">' + dispCount + '</div></div>'
      + '<div class="kpi-card"><div class="kpi-header"><div class="kpi-label">Completed</div><div class="kpi-icon green">' + iconSvg('check') + '</div></div><div class="kpi-value" style="color:var(--success)">' + done + '</div></div>'
      + '</div>';
    var printTabs = [
      { id: 'orders', label: '\uD83D\uDCCB Project Details', count: orders.length },
      { id: 'production', label: '\uD83D\uDDA8\uFE0F Production & QC', count: activeProductionCount },
      { id: 'dispatch', label: '\uD83D\uDE9A Release / Dispatch', count: dispatches.length },
      { id: 'completed', label: '\u2705 Completed', count: done },
    ];
    var printTabsHtml = printTabs.map(function (t) {
      return '<button class="om-tab' + (_omTab === t.id ? ' om-tab-active' : '') + '" onclick="omSwitchTab(\'' + t.id + '\')">' + t.label + (t.count > 0 ? ' <span class="om-tab-count">' + t.count + '</span>' : '') + '</button>';
    }).join('');
    var printTabContent = '';
    if (_omTab === 'orders') printTabContent = omRenderOrdersTab();
    else if (_omTab === 'production') printTabContent = omRenderProductionTab();
    else if (_omTab === 'dispatch') printTabContent = omRenderDispatchTab();
    else if (_omTab === 'completed') printTabContent = omRenderCompletedTab();
    var printHtml = '<div class="page-header" style="margin-bottom:16px">'
      + '<h1 class="page-title">Project Management</h1>'
      + '<p class="page-subtitle">Manage project intake, production, quality checking, and release.</p>'
      + '</div>'
      + printKpi
      + '<div class="om-tabs">' + printTabsHtml + '</div>'
      + '<div id="om-tab-content">' + printTabContent + '</div>';
    setPageHtml('orders', getNavRenderId(), printHtml);
    return;
  }

  // ── ADMIN / STAFF: full tabbed view ──────────────────────────────────
  // Default to 'orders' (Order Details) tab; persist via sessionStorage
  var allTabIds = ['orders', 'payment', 'production', 'dispatch', 'completed', 'cancelled'];
  if (!_omTab || !allTabIds.includes(_omTab)) {
    var storedTab = sessionStorage.getItem('omTab');
    _omTab = (storedTab && allTabIds.includes(storedTab)) ? storedTab : 'orders';
  }

  // customers tab moved to dedicated Customer Records page
  var cancelledOrders = orders.filter(function (o) { return o.status === 'cancelled'; });
  var activeOrders = orders.filter(function (o) { return o.status !== 'cancelled'; });
  var tabs = [
    { id: 'orders', label: '\uD83D\uDCCB Project Details', count: orders.length },
    { id: 'payment', label: '\uD83D\uDCB3 Payment (50% DP)', count: payments.length },
    { id: 'production', label: '\uD83D\uDDA8\uFE0F Production & QC', count: activeProductionCount },
    { id: 'dispatch', label: '\uD83D\uDE9A Release / Dispatch', count: dispatches.length },
    { id: 'completed', label: '\u2705 Completed', count: done },
    { id: 'cancelled', label: '\u274C Cancelled', count: cancelledOrders.length },
  ];

  var tabsHtml = tabs.map(function (t) {
    return '<button class="om-tab' + (_omTab === t.id ? ' om-tab-active' : '') + '" onclick="omSwitchTab(\'' + t.id + '\')">' + t.label + (t.count > 0 ? ' <span class="om-tab-count">' + t.count + '</span>' : '') + '</button>';
  }).join('');

  var tabContent = '';
  if (_omTab === 'logos' || _omTab === 'customers') _omTab = 'orders';
  if (_omTab === 'orders') tabContent = omRenderOrdersTab();
  else if (_omTab === 'payment') tabContent = omRenderPaymentsTab();
  else if (_omTab === 'production') tabContent = omRenderProductionTab();
  else if (_omTab === 'dispatch') tabContent = omRenderDispatchTab();
  else if (_omTab === 'completed') tabContent = omRenderCompletedTab();
  else if (_omTab === 'cancelled') tabContent = omRenderCancelledTab();

  var subtitle = isStaff
    ? 'Cashier access to project intake and payment updates. Production is view only.'
    : 'Full project lifecycle \u2014 from client request to production, quality check, and release.';

  // KPI strip: Admin=all 5, Staff=none
  var kpiHtml2 = '';
  if (!isStaff) {
    kpiHtml2 += '<div class="om-kpi-strip">';
    kpiHtml2 += '<div class="om-kpi"><div class="om-kpi-val">' + pending + '</div><div class="om-kpi-lbl">Pending</div></div>';
    kpiHtml2 += '<div class="om-kpi"><div class="om-kpi-val" style="color:var(--info)">' + inProd + '</div><div class="om-kpi-lbl">In Production</div></div>';
    kpiHtml2 += '<div class="om-kpi"><div class="om-kpi-val" style="color:var(--gold)">' + dispCount + '</div><div class="om-kpi-lbl">In Dispatch</div></div>';
    kpiHtml2 += '<div class="om-kpi"><div class="om-kpi-val" style="color:var(--success)">' + done + '</div><div class="om-kpi-lbl">Completed</div></div>';
    kpiHtml2 += '<div class="om-kpi"><div class="om-kpi-val" style="color:var(--danger)">\u20B1' + omFmt(balDue) + '</div><div class="om-kpi-lbl">Balance Due</div></div>';
    kpiHtml2 += '</div>';
  }

  var html = '<div class="page-header" style="margin-bottom:16px">'
    + '<h1 class="page-title">Project Management</h1>'
    + '<p class="page-subtitle">' + subtitle + '</p>'
    + '</div>'
    + kpiHtml2
    + '<div class="om-tabs">' + tabsHtml + '</div>'
    + '<div id="om-tab-content">' + tabContent + '</div>';

  var page = 'orders';
  var navId = getNavRenderId();
  setPageHtml(page, navId, html);
}

function omSwitchTab(tab) {
  _omTab = tab;
  _omSearch = '';
  sessionStorage.setItem('omTab', tab);
  renderOrders();
}

function omRefreshTab() {
  var el = document.getElementById('om-tab-content');
  if (!el) return;
  if (_omTab === 'orders') el.innerHTML = omRenderOrdersTab();
  else if (_omTab === 'payment') el.innerHTML = omRenderPaymentsTab();
  else if (_omTab === 'production') el.innerHTML = omRenderProductionTab();
  else if (_omTab === 'dispatch') el.innerHTML = omRenderDispatchTab();
  else if (_omTab === 'completed') el.innerHTML = omRenderCompletedTab();
  else if (_omTab === 'cancelled') el.innerHTML = omRenderCancelledTab();
}

// ── Shared helpers ────────────────────────────────────────────────────────────
function omEsc(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function omTable(headCols, bodyRows) {
  return '<div class="om-table-card">'
    + '<div class="om-table-scroll">'
    + '<table class="data-table om-table"><thead><tr>' + headCols + '</tr></thead>'
    + '<tbody>' + bodyRows + '</tbody></table>'
    + '</div></div>';
}

function omToolbar(leftHtml, rightHtml) {
  return '<div class="om-toolbar">'
    + '<div class="om-search-wrap">' + iconSvg('search') + leftHtml + '</div>'
    + '<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;">' + rightHtml + '</div>'
    + '</div>';
}

// ── TAB: LOGO UPLOAD ──────────────────────────────────────────────────────────
function omRenderLogoTab() {
  var logos = getLogoUploads();
  var q = (_omSearch || '').toLowerCase();
  var filtered = [...logos].reverse().filter(function (l) {
    return !q
      || (l.businessName || '').toLowerCase().indexOf(q) !== -1
      || String(l.orderNumber || '').indexOf(q) !== -1
      || (l.fileName || '').toLowerCase().indexOf(q) !== -1;
  });

  var rows = filtered.map(function (l) {
    return '<tr>'
      + '<td class="xs">' + omDate(l.uploadedAt) + '</td>'
      + '<td class="fw7">#' + String(l.orderNumber || l.orderId || '').padStart(6, '0') + '</td>'
      + '<td><div class="cell-primary">' + omEsc(l.businessName || '\u2014') + '</div></td>'
      + '<td class="truncate" title="' + omEsc(l.fileName || '') + '">' + omEsc(l.fileName || '\u2014') + '</td>'
      + '<td class="xs">' + omEsc(l.fileType || '\u2014') + '</td>'
      + '<td class="truncate xs" title="' + omEsc(l.notes || '') + '">' + omEsc(l.notes || '\u2014') + '</td>'
      + '<td class="actions-cell">'
      + (l.fileData
        ? '<a class="btn btn-sm btn-outline" href="' + l.fileData + '" download="' + omEsc(l.fileName || 'logo') + '">\u2193 Download</a> '
        : '')
      + '<button class="btn btn-sm btn-danger" onclick="omDeleteLogo(\'' + l.id + '\')">\u2715</button>'
      + '</td>'
      + '</tr>';
  }).join('') || '<tr><td colspan="7" class="empty-row">No logo uploads yet.</td></tr>';

  return omToolbar(
    '<input class="form-control pl34" placeholder="Search logos\u2026" value="' + (_omSearch || '') + '" oninput="_omSearch=this.value;omRefreshTab()">',
    '<button class="btn btn-maroon" onclick="omNewLogoModal()">\uD83D\uDDBC\uFE0F Upload Logo</button>'
  )
    + omTable(
      '<th class="wfix90">Date</th>'
      + '<th class="wfix80">Order #</th>'
      + '<th class="wgrow">Client Name</th>'
      + '<th class="wgrow">File Name</th>'
      + '<th class="wfix90">Type</th>'
      + '<th class="wgrow-sm">Notes</th>'
      + '<th class="wfix120">Actions</th>',
      rows
    );
}

function omNewLogoModal() {
  var orders = getOrders().filter(function (o) { return o.status !== 'cancelled'; });
  var orderOptions = orders.map(function (o) {
    return '<option value="' + o.id + '">#' + String(o.id).padStart(6, '0') + ' \u2014 ' + omEsc(o.customer_name || '') + '</option>';
  }).join('');
  showModal('<div class="modal-header"><h2>\uD83D\uDDBC\uFE0F Upload Logo</h2><button class="btn-close-modal" onclick="closeModal()">\u2715</button></div>'
    + '<div class="modal-body">'
    + '<div class="form-row-2"><div class="form-group"><label>Link to Order</label><div class="form-select-wrap"><select id="omlogo-order" class="form-control" onchange="omAutofillLogo(this.value)"><option value="">\u2014 Select Order (optional) \u2014</option>' + orderOptions + '</select></div></div>'
    + '<div class="form-group"><label>Client Name</label><input id="omlogo-business" class="form-control" placeholder="Auto-filled from order"></div></div>'
    + '<div class="form-group"><label>Logo File <span style="color:var(--danger)">*</span></label><input id="omlogo-file" type="file" class="form-control" accept="image/*,.pdf,.ai,.eps,.svg" onchange="omReadLogoFile(this)"></div>'
    + '<div id="omlogo-preview" style="margin-top:8px;display:none"><img id="omlogo-img" style="max-height:120px;border-radius:var(--radius-sm);border:1px solid var(--ink-10)" src=""></div>'
    + '<input type="hidden" id="omlogo-data"><input type="hidden" id="omlogo-fname"><input type="hidden" id="omlogo-ftype">'
    + '<div class="form-group" style="margin-top:12px"><label>Notes</label><textarea id="omlogo-notes" class="form-control" rows="2" placeholder="Color instructions, version notes, etc."></textarea></div>'
    + '</div>'
    + '<div class="modal-footer"><button class="btn btn-outline" onclick="closeModal()">Cancel</button><button class="btn btn-maroon" onclick="omSaveLogo()">Save Logo</button></div>');
}
function omAutofillLogo(orderId) {
  var o = getOrders().find(function (x) { return String(x.id) === String(orderId); });
  var el = document.getElementById('omlogo-business');
  if (el) el.value = o ? (o.customer_name || '') : '';
}
function omReadLogoFile(input) {
  var file = input.files && input.files[0];
  if (!file) return;
  document.getElementById('omlogo-fname').value = file.name;
  document.getElementById('omlogo-ftype').value = file.type || file.name.split('.').pop();
  var reader = new FileReader();
  reader.onload = function (e) {
    document.getElementById('omlogo-data').value = e.target.result;
    var prev = document.getElementById('omlogo-preview');
    var img = document.getElementById('omlogo-img');
    if (file.type.startsWith('image/') && prev && img) { img.src = e.target.result; prev.style.display = 'block'; }
  };
  reader.readAsDataURL(file);
}
function omSaveLogo() {
  function gv(id) { var el = document.getElementById(id); return el ? el.value : ''; }
  var fileName = gv('omlogo-fname').trim();
  if (!fileName) { showToast('Please select a file.', 'error'); return; }
  var logos = getLogoUploads();
  var orderId = gv('omlogo-order');
  var order = orderId ? getOrders().find(function (o) { return String(o.id) === String(orderId); }) : null;
  logos.push({
    id: omGenId('LG'), orderId: orderId || null, orderNumber: order ? order.id : null,
    businessName: gv('omlogo-business').trim() || (order ? order.customer_name : ''),
    fileName: fileName, fileType: gv('omlogo-ftype'), fileData: gv('omlogo-data'),
    notes: gv('omlogo-notes').trim(), uploadedAt: new Date().toISOString()
  });
  saveLogoUploads(logos);
  closeModal(); showToast('Logo uploaded!', 'success'); _omTab = 'logos'; renderOrders();
}
function omDeleteLogo(logoId) {
  confirmModal({
    title: 'Remove Logo',
    message: 'Are you sure you want to remove this logo upload?',
    confirmText: 'Remove Logo',
    icon: '🗑️',
    onConfirm: function () {
      saveLogoUploads(getLogoUploads().filter(function (l) { return l.id !== logoId; }));
      showToast('Logo removed.', 'warning'); renderOrders();
    }
  });
  return;
  saveLogoUploads(getLogoUploads().filter(function (l) { return l.id !== logoId; }));
  showToast('Logo removed.', 'warning'); renderOrders();
}

// ── TAB: ORDER DETAILS ────────────────────────────────────────────────────────
function omRenderOrdersTab() {
  var u = getState().currentUser;
  var orders = getOrders().filter(function (o) { return o.status !== 'cancelled'; });
  var sc = { pending: 0, approved: 0, production: 0, dispatch: 0, completed: 0 };
  orders.forEach(function (o) { if (o.status in sc) sc[o.status]++; });

  var filtered = orders.filter(function (o) {
    var ms = !_omFilter || o.status === _omFilter;
    var q = (_omSearch || '').toLowerCase();
    var mq = !q
      || (o.customer_name || '').toLowerCase().indexOf(q) !== -1
      || String(o.id).indexOf(q) !== -1
      || (o.product_type || '').toLowerCase().indexOf(q) !== -1;
    return ms && mq;
  });

  var isPrintRole = omIsPrintUser(u);
  var isCashier = omIsCashierUser(u);
  var isAdmin = omIsAdminUser(u);

  var rows = [...filtered].reverse().map(function (o) {
    var balance = o.balance || 0;
    // Cashier can view+edit non-completed orders; Print can view only
    var canViewOnly = isPrintRole || o.status === 'completed';
    var cashierCanEdit = isCashier && o.status !== 'completed';
    return '<tr>'
      + '<td class="fw7 xs">#' + String(o.id).padStart(6, '0') + '</td>'
      + '<td class="xs">' + omDate(o.created_at) + '</td>'
      + '<td class="wgrow"><div class="cell-primary">' + omEsc(o.customer_name || '\u2014') + '</div>'
      + (o.contact_person ? '<div class="cell-sub">' + omEsc(o.contact_person) + '</div>' : '') + '</td>'
      + '<td class="wgrow-sm truncate" title="' + omEsc(o.product_type || '') + '">' + omEsc(o.product_type || o.product_category || '\u2014') + '</td>'
      + '<td class="center xs">' + omEsc(String(o.quantity || '\u2014')) + '</td>'
      + '<td>' + omDisplayStatusBadge(o) + '</td>'
      + '<td class="fw7 maroon xs">\u20B1' + omFmt(o.total_amount) + '</td>'
      + '<td class="xs ' + (balance > 0 ? 'danger' : 'success') + '">\u20B1' + omFmt(balance) + '</td>'
      + '<td>' + omPayStatusBadge(o.payment_status) + '</td>'
      + '<td class="actions-cell">'
      + '<button class="btn btn-sm btn-outline" onclick="omViewOrderModal(\'' + o.id + '\')" title="View">\uD83D\uDC41</button>'
      + (isAdmin && o.status === 'pending'
        ? ' <button class="btn btn-sm btn-maroon" onclick="omApproveOrder(\'' + o.id + '\')" title="Approve for Production" style="background:#0d9488;border-color:#0d9488;">' + iconSvg('check') + ' Approve</button>'
        : '')
      + (canViewOnly ? '' :
        (omCanAdvanceToProduction(o) && omCanManageProduction(u) ? '<button class="btn btn-sm btn-maroon" onclick="omMoveToProduction(\'' + o.id + '\')" title="Start Production">' + iconSvg('printer') + '</button>' : '')
        + (cashierCanEdit || (isAdmin && o.status !== 'completed') ? '<button class="btn btn-sm btn-outline" onclick="omEditOrderModal(\'' + o.id + '\')">' + iconSvg('note') + '</button>' : '')
        + (isAdmin ? '<button class="btn btn-sm btn-danger" onclick="voidOrderModal(\'' + o.id + '\')">' + iconSvg('error') + '</button>' : ''))
      + '</td>'
      + '</tr>';
  }).join('') || '<tr><td colspan="10" class="empty-row">No orders found.</td></tr>';

  return omToolbar(
    '<input class="form-control pl34" placeholder="Search order, customer, product\u2026" value="' + (_omSearch || '') + '" oninput="_omSearch=this.value;omRefreshTab()">',
    '<div class="form-select-wrap" style="min-width:140px;">'
    + '<select class="form-control" onchange="_omFilter=this.value;omRefreshTab()">'
    + '<option value="" ' + (!_omFilter ? 'selected' : '') + '>All (' + orders.length + ')</option>'
    + '<option value="pending" ' + (_omFilter === 'pending' ? 'selected' : '') + '>Pending (' + sc.pending + ')</option>'
    + '<option value="approved" ' + (_omFilter === 'approved' ? 'selected' : '') + '>Approved (' + sc.approved + ')</option>'
    + '<option value="production" ' + (_omFilter === 'production' ? 'selected' : '') + '>Production (' + sc.production + ')</option>'
    + '<option value="dispatch" ' + (_omFilter === 'dispatch' ? 'selected' : '') + '>Dispatch (' + sc.dispatch + ')</option>'
    + '<option value="completed" ' + (_omFilter === 'completed' ? 'selected' : '') + '>Completed (' + sc.completed + ')</option>'
    + '</select></div>'
    + (omCanCreateOrders(u) ? '<button class="btn btn-maroon" onclick="omNewOrderModal()">+ New Order</button>' : '')
  )
    + omTable(
      '<th class="wfix80">Order #</th>'
      + '<th class="wfix90">Date</th>'
      + '<th class="wgrow">Customer</th>'
      + '<th class="wgrow">Product</th>'
      + '<th class="wfix40 center">Qty</th>'
      + '<th class="wfix110">Status</th>'
      + '<th class="wfix90">Total</th>'
      + '<th class="wfix90">Balance</th>'
      + '<th class="wfix100">Pay Status</th>'
      + '<th class="wfix120">Actions</th>',
      rows
    );
}

// ── TAB: CUSTOMER RECORDS ─────────────────────────────────────────────────────
function omRenderCustomersTab() {
  var crs = getCustomerRecords();
  var q = (_omSearch || '').toLowerCase();
  var filtered = crs.filter(function (c) {
    return !q
      || (c.businessName || '').toLowerCase().indexOf(q) !== -1
      || (c.contactPerson || '').toLowerCase().indexOf(q) !== -1
      || (c.phone || '').indexOf(q) !== -1;
  });

  var isPrint = (getState().currentUser || {}).role === 'print';

  var rows = filtered.map(function (c) {
    return '<tr>'
      + '<td class="wgrow"><div class="cell-primary">' + omEsc(c.businessName || '\u2014') + '</div>'
      + (c.contactPerson ? '<div class="cell-sub">' + omEsc(c.contactPerson) + '</div>' : '') + '</td>'
      + '<td class="xs">' + omEsc(c.phone || '\u2014') + '</td>'
      + '<td class="truncate xs" title="' + omEsc(c.email || '') + '">' + omEsc(c.email || '\u2014') + '</td>'
      + '<td class="truncate xs" title="' + omEsc(c.address || '') + '">' + omEsc(c.address || '\u2014') + '</td>'
      + '<td><span class="badge badge-neutral">' + omEsc(c.modeOfPayment || '\u2014') + '</span></td>'
      + '<td><span class="badge badge-neutral">' + omEsc(c.modeOfDelivery || '\u2014') + '</span></td>'
      + '<td class="xs">' + omDate(c.createdAt) + '</td>'
      + '<td class="actions-cell">'
      + (isPrint
        ? '<span style="color:var(--ink-40);font-size:12px;">View Only</span>'
        : '<button class="btn btn-sm btn-outline" onclick="omEditCustomerModal(\'' + c.id + '\')">Edit</button>'
        + ' <button class="btn btn-sm btn-danger" onclick="omDeleteCustomer(\'' + c.id + '\')">\u2715</button>')
      + '</td>'
      + '</tr>';
  }).join('') || '<tr><td colspan="8" class="empty-row">No customer records yet.</td></tr>';

  return omToolbar(
    '<input class="form-control pl34" placeholder="Search customers\u2026" value="' + (_omSearch || '') + '" oninput="_omSearch=this.value;omRefreshTab()">',
    isPrint ? '' : '<button class="btn btn-maroon" onclick="omNewCustomerModal()">+ New Customer</button>'
  )
    + omTable(
      '<th class="wgrow">Name / Contact</th>'
      + '<th class="wfix100">Phone</th>'
      + '<th class="wgrow-sm">Email</th>'
      + '<th class="wgrow">Address</th>'
      + '<th class="wfix90">Pay Mode</th>'
      + '<th class="wfix80">Delivery</th>'
      + '<th class="wfix90">Added</th>'
      + '<th class="wfix100">Actions</th>',
      rows
    );
}

// ── TAB: COMPLETED ───────────────────────────────────────────────────────────
function omRenderCompletedTab() {
  var orders = getOrders().filter(function (o) { return o.status === 'completed'; });
  var q = (_omSearch || '').toLowerCase();
  var filtered = orders.filter(function (o) {
    return !q
      || (o.customer_name || '').toLowerCase().indexOf(q) !== -1
      || String(o.id).indexOf(q) !== -1
      || (o.product_type || '').toLowerCase().indexOf(q) !== -1;
  });

  var totalRevenue = filtered.reduce(function (sum, o) { return sum + (o.total_amount || 0); }, 0);
  var fullyPaid = filtered.filter(function (o) { return o.payment_status === 'Fully Paid'; }).length;

  var rows = [...filtered].reverse().map(function (o) {
    var saleKey = 'om_order_' + o.id;
    var s = getState();
    var inReceipts = (s.sales || []).some(function (x) { return x.id === saleKey; });
    var receiptBtn = inReceipts
      ? '<button class="btn btn-sm btn-outline" onclick="omViewOrderReceipt(\'' + o.id + '\')" title="View Receipt">\uD83E\uDDFE</button>'
      : (o.payment_status === 'Fully Paid'
        ? '<button class="btn btn-sm btn-maroon" onclick="omForcePushReceipt(\'' + o.id + '\')" title="Push to Receipt History">\uD83D\uDDC2\uFE0F Push</button>'
        : '');
    return '<tr>'
      + '<td class="fw7 xs">#' + String(o.id).padStart(6, '0') + '</td>'
      + '<td class="xs">' + omDate(o.created_at) + '</td>'
      + '<td class="wgrow"><div class="cell-primary">' + omEsc(o.customer_name || '\u2014') + '</div>'
      + (o.contact_person ? '<div class="cell-sub">' + omEsc(o.contact_person) + '</div>' : '') + '</td>'
      + '<td class="wgrow-sm truncate" title="' + omEsc(o.product_type || '') + '">' + omEsc(o.product_type || o.product_category || '\u2014') + '</td>'
      + '<td class="center xs">' + omEsc(String(o.quantity || '\u2014')) + '</td>'
      + '<td class="fw7 maroon xs">\u20B1' + omFmt(o.total_amount) + '</td>'
      + '<td>' + omPayStatusBadge(o.payment_status) + '</td>'
      + '<td class="actions-cell">'
      + '<button class="btn btn-sm btn-outline" onclick="omViewOrderModal(\'' + o.id + '\')" title="View">\uD83D\uDC41</button>'
      + receiptBtn
      + '</td>'
      + '</tr>';
  }).join('') || '<tr><td colspan="8" class="empty-row">No completed orders yet.</td></tr>';

  var summary = '<div style="display:flex;gap:16px;margin-bottom:12px;flex-wrap:wrap;">'
    + '<div style="background:var(--success-bg,#e6f9f0);border:1px solid var(--success,#22a06b);border-radius:8px;padding:10px 18px;font-size:13px;">'
    + '\u2705 <strong>' + filtered.length + '</strong> completed &nbsp;&middot;&nbsp; <strong>' + fullyPaid + '</strong> fully paid &nbsp;&middot;&nbsp; Revenue: <strong>\u20B1' + omFmt(totalRevenue) + '</strong>'
    + '</div></div>';

  return omToolbar(
    '<input class="form-control pl34" placeholder="Search completed orders\u2026" value="' + (_omSearch || '') + '" oninput="_omSearch=this.value;omRefreshTab()">',
    '<span class="text-sm text-muted">' + filtered.length + ' order' + (filtered.length !== 1 ? 's' : '') + ' completed</span>'
  )
    + summary
    + omTable(
      '<th class="wfix80">Order #</th>'
      + '<th class="wfix90">Date</th>'
      + '<th class="wgrow">Customer</th>'
      + '<th class="wgrow">Product</th>'
      + '<th class="wfix40 center">Qty</th>'
      + '<th class="wfix90">Total</th>'
      + '<th class="wfix100">Pay Status</th>'
      + '<th class="wfix120">Actions</th>',
      rows
    );
}

function omForcePushReceipt(orderId) {
  var orders = getOrders();
  var o = orders.find(function (x) { return String(x.id) === String(orderId); });
  if (!o) return;
  if (o.payment_status !== 'Fully Paid') { showToast('Order must be Fully Paid to push receipt.', 'error'); return; }
  omPushToReceiptHistory(orderId);
  omRefreshTab();
}

function omViewOrderReceipt(orderId) {
  var saleKey = 'om_order_' + orderId;
  omViewReceiptModal(saleKey);
}

// ── TAB: CANCELLED ────────────────────────────────────────────────
function omRenderCancelledTab() {
  var orders = getOrders().filter(function (o) { return o.status === 'cancelled'; });
  var q = (_omSearch || '').toLowerCase();
  var filtered = orders.filter(function (o) {
    return !q
      || (o.customer_name || '').toLowerCase().indexOf(q) !== -1
      || String(o.id).indexOf(q) !== -1
      || (o.product_type || '').toLowerCase().indexOf(q) !== -1;
  });

  var rows = [...filtered].reverse().map(function (o) {
    var reason = o.cancel_reason || o.void_reason || '\u2014';
    return '<tr style="opacity:0.8">'
      + '<td class="fw7 xs">#' + String(o.id).padStart(6, '0') + '</td>'
      + '<td class="xs">' + omDate(o.created_at) + '</td>'
      + '<td class="wgrow"><div class="cell-primary">' + omEsc(o.customer_name || '\u2014') + '</div>'
      + (o.contact_person ? '<div class="cell-sub">' + omEsc(o.contact_person) + '</div>' : '') + '</td>'
      + '<td class="wgrow-sm truncate" title="' + omEsc(o.product_type || '') + '">' + omEsc(o.product_type || o.product_category || '\u2014') + '</td>'
      + '<td class="center xs">' + omEsc(String(o.quantity || '\u2014')) + '</td>'
      + '<td class="fw7 maroon xs">\u20B1' + omFmt(o.total_amount) + '</td>'
      + '<td style="max-width:200px;font-size:12px;color:var(--ink-60)">' + omEsc(reason) + '</td>'
      + '<td class="actions-cell">'
      + '<button class="btn btn-sm btn-outline" onclick="omViewOrderModal(\'' + o.id + '\')" title="View">\uD83D\uDC41</button>'
      + '</td>'
      + '</tr>';
  }).join('') || '<tr><td colspan="8" class="empty-row">No cancelled orders.</td></tr>';

  return omToolbar(
    '<input class="form-control pl34" placeholder="Search order, customer, product\u2026" value="' + (_omSearch || '') + '" oninput="_omSearch=this.value;omRefreshTab()">',
    '<span class="text-sm text-muted">' + filtered.length + ' cancelled order' + (filtered.length !== 1 ? 's' : '') + '</span>'
  )
    + omTable(
      '<th class="wfix80">Order #</th>'
      + '<th class="wfix90">Date</th>'
      + '<th class="wgrow">Customer</th>'
      + '<th class="wgrow">Product</th>'
      + '<th class="wfix40 center">Qty</th>'
      + '<th class="wfix90">Total</th>'
      + '<th>Cancel Reason</th>'
      + '<th class="wfix80"></th>',
      rows
    );
}

// ── TAB: PAYMENT (50% DP) ─────────────────────────────────────────────────────
function omRenderPaymentsTab() {
  var payments = getPaymentRecords();
  var orders = getOrders();

  // Deduplicate: show one row per order, using the order's current payment data
  // Build a map of orderId -> latest payment info
  var seenOrders = {};
  // First pass: group by orderId
  payments.forEach(function (p) {
    var oid = String(p.orderId);
    if (!seenOrders[oid]) {
      seenOrders[oid] = p;
    } else {
      // Keep the most recent
      if (new Date(p.date) > new Date(seenOrders[oid].date)) seenOrders[oid] = p;
    }
  });
  // Sync with live order data (for balance/status accuracy)
  var consolidated = Object.values(seenOrders).map(function (p) {
    var o = orders.find(function (x) { return String(x.id) === String(p.orderId); });
    if (o) {
      return Object.assign({}, p, {
        totalAmount: o.total_amount || p.totalAmount,
        downpayment: o.downpayment || p.downpayment,
        balance: o.balance !== undefined ? o.balance : p.balance,
        paymentStatus: o.payment_status || p.paymentStatus,
      });
    }
    return p;
  });

  var q = (_omSearch || '').toLowerCase();
  var filtered = [...consolidated].sort(function (a, b) { return new Date(b.date) - new Date(a.date); }).filter(function (p) {
    return !q
      || (p.businessName || '').toLowerCase().indexOf(q) !== -1
      || String(p.orderNumber || '').indexOf(q) !== -1;
  });

  var currentUser = omCurrentUser();
  var isPrint = omIsPrintUser(currentUser);

  var rows = filtered.map(function (p) {
    var isPaid = p.paymentStatus === 'Fully Paid';
    var bal = p.balance || 0;
    return '<tr>'
      + '<td class="xs">' + omDate(p.date) + '</td>'
      + '<td class="fw7 xs">#' + String(p.orderNumber || p.orderId || '').padStart(6, '0') + '</td>'
      + '<td class="wgrow"><div class="cell-primary">' + omEsc(p.businessName || '\u2014') + '</div>'
      + (p.contactPerson ? '<div class="cell-sub">' + omEsc(p.contactPerson) + '</div>' : '') + '</td>'
      + '<td class="fw7 maroon xs">\u20B1' + omFmt(p.totalAmount) + '</td>'
      + '<td class="xs">\u20B1' + omFmt(p.downpayment) + '</td>'
      + '<td class="xs ' + (bal > 0 ? 'danger' : 'success') + '">\u20B1' + omFmt(bal) + '</td>'
      + '<td>' + omPayStatusBadge(p.paymentStatus) + '</td>'
      + '<td class="truncate xs" title="' + omEsc(p.note || '') + '">' + omEsc(p.note || '\u2014') + '</td>'
      + '<td class="actions-cell">'
      + (isPrint
        ? (isPaid ? '<button class="btn btn-sm btn-outline" onclick="omPrintReceipt(\'' + p.id + '\')">\uD83D\uDDA8\uFE0F Receipt</button>' : '<span style="color:var(--ink-40);font-size:12px;">View Only</span>')
        : (isPaid
          ? '<button class="btn btn-sm btn-outline" onclick="omPrintReceipt(\'' + p.id + '\')">\uD83D\uDDA8\uFE0F Receipt</button>'
          : '<button class="btn btn-sm btn-maroon" onclick="omUpdatePaymentModal(\'' + p.id + '\')">+ Pay</button>'))
      + '</td>'
      + '</tr>';
  }).join('') || '<tr><td colspan="9" class="empty-row">No payment records yet.</td></tr>';

  return omToolbar(
    '<input class="form-control pl34" placeholder="Search payments\u2026" value="' + (_omSearch || '') + '" oninput="_omSearch=this.value;omRefreshTab()">',
    omCanManagePayments(currentUser) ? '<button class="btn btn-maroon" onclick="omNewPaymentModal()">+ Record Payment</button>' : ''
  )
    + omTable(
      '<th class="wfix90">Date</th>'
      + '<th class="wfix80">Order #</th>'
      + '<th class="wgrow">Customer</th>'
      + '<th class="wfix90">Total</th>'
      + '<th class="wfix80">Paid</th>'
      + '<th class="wfix80">Balance</th>'
      + '<th class="wfix100">Pay Status</th>'
      + '<th class="wgrow-sm">Note</th>'
      + '<th class="wfix110">Actions</th>',
      rows
    );
}

// ── TAB: PRODUCTION ───────────────────────────────────────────────────────────
function omRenderProductionTab() {
  var prods = getProductionRecords();
  var q = (_omSearch || '').toLowerCase();
  // Hide completed production records from the active list
  var filtered = [...prods].reverse().filter(function (p) {
    var linkedOrder = getOrders().find(function (o) { return String(o.id) === String(p.orderId); });
    var orderDone = linkedOrder && (linkedOrder.status === 'completed' || omIsDispatchReady(linkedOrder));
    if (p.status === 'completed' || orderDone) return false; // hide completed
    return !q
      || (p.businessName || '').toLowerCase().indexOf(q) !== -1
      || String(p.orderNumber || '').indexOf(q) !== -1;
  });

  var rows = filtered.map(function (p) {
    var pct = p.progress || 0;
    var pc = pct >= 100 ? 'var(--success)' : pct >= 60 ? 'var(--gold)' : 'var(--maroon)';
    // Resolve status from linked order if prod record is stale
    var _linkedOrd = getOrders().find(function (o) { return String(o.id) === String(p.orderId); });
    var qcB = omQcBadge(_linkedOrd, p);
    var displayStatus = p.status || 'pending';
    if (_linkedOrd) displayStatus = omDisplayStatus(_linkedOrd, p);
    var displayBiz = p.businessName || (_linkedOrd && _linkedOrd.customer_name) || '\u2014';
    return '<tr>'
      + '<td class="fw7 xs">#' + String(p.orderNumber || p.orderId || '').padStart(6, '0') + '</td>'
      + '<td class="wgrow"><div class="cell-primary">' + omEsc(displayBiz) + '</div></td>'
      + '<td class="xs">' + omEsc(p.assignedTo || '\u2014') + '</td>'
      + '<td style="min-width:110px;">'
      + '<div style="display:flex;align-items:center;gap:6px;">'
      + '<div style="flex:1;background:var(--ink-10);border-radius:99px;height:6px;">'
      + '<div style="width:' + pct + '%;background:' + pc + ';height:6px;border-radius:99px;"></div>'
      + '</div>'
      + '<span style="font-size:11px;font-weight:700;color:' + pc + ';white-space:nowrap;">' + pct + '%</span>'
      + '</div>'
      + '</td>'
      + '<td>' + (displayStatus === 'for_qc' ? '<span class="badge badge-warning">' + iconSvg('clock') + ' For QC</span>' : omStatusBadge(displayStatus)) + '</td>'
      + '<td>' + qcB + '</td>'
      + '<td class="truncate xs" title="' + omEsc(p.materialsUsed || '') + '">' + omEsc(p.materialsUsed || '\u2014') + '</td>'
      + '<td class="xs">' + omDate(p.completionDate) + '</td>'
      + '<td class="actions-cell">'
      + ((omIsCashierUser(getState().currentUser))
        ? '<span style="color:var(--ink-40);font-size:12px;">View Only</span>'
        : '<button class="btn btn-sm btn-outline" onclick="omUpdateProductionModal(\'' + p.id + '\')">Update</button>'
        + ' <button class="btn btn-sm btn-outline" onclick="omQCModal(\'' + p.id + '\')">QC</button>')
      + '</td>'
      + '</tr>';
  }).join('') || '<tr><td colspan="9" class="empty-row">No production records yet.</td></tr>';

  var isStaffUser = omIsCashierUser(getState().currentUser);
  return omToolbar(
    '<input class="form-control pl34" placeholder="Search production\u2026" value="' + (_omSearch || '') + '" oninput="_omSearch=this.value;omRefreshTab()">',
    isStaffUser ? '' : '<button class="btn btn-maroon" onclick="omNewProductionModal()">+ Assign Production</button>'
  )
    + omTable(
      '<th class="wfix80">Order #</th>'
      + '<th class="wgrow">Customer</th>'
      + '<th class="wgrow-sm">Assigned To</th>'
      + '<th style="min-width:120px;">Progress</th>'
      + '<th class="wfix110">Status</th>'
      + '<th class="wfix70">QC</th>'
      + '<th class="wgrow-sm">Materials</th>'
      + '<th class="wfix90">Completed</th>'
      + '<th class="wfix120">Actions</th>',
      rows
    );
}

// ── TAB: DAILY DISPATCH ───────────────────────────────────────────────────────
function omRenderDispatchTab() {
  var orders = getOrders();
  var dispatches = getDispatchRecords().map(function (d) {
    var order = orders.find(function (o) { return String(o.id) === String(d.orderId); });
    if (!order) return d;
    // Auto-derive payment status from balance to keep dispatch tab in sync
    var derivedPayStatus = order.payment_status;
    if (!derivedPayStatus || (order.balance === 0 && order.total_amount > 0)) {
      derivedPayStatus = order.balance === 0 ? 'Fully Paid' : (order.downpayment > 0 ? 'Partial' : 'Pending');
    }
    return Object.assign({}, d, {
      businessName: d.businessName || order.customer_name,
      paymentStatus: derivedPayStatus || d.paymentStatus || 'Pending',
      balance: order.balance !== undefined ? order.balance : (d.balance || 0),
    });
  });
  var q = (_omSearch || '').toLowerCase();
  var filtered = [...dispatches].reverse().filter(function (d) {
    var linkedOrder = orders.find(function (o) { return String(o.id) === String(d.orderId); });
    if (linkedOrder && linkedOrder.status !== 'completed' && !omIsDispatchReady(linkedOrder)) return false;
    return !q
      || (d.businessName || '').toLowerCase().indexOf(q) !== -1
      || String(d.orderNumber || '').indexOf(q) !== -1;
  });

  function dsBadge(s) {
    if (s === 'Delivered') return '<span class="badge badge-success">\u2713 Delivered</span>';
    if (s === 'Dispatched') return '<span class="badge badge-info">\u2192 Dispatched</span>';
    return '<span class="badge badge-warning">Scheduled</span>';
  }

  var rows = filtered.map(function (d) {
    var canOverride = omCanOverrideDispatch(omCurrentUser());
    return '<tr>'
      + '<td class="xs">' + omDate(d.date) + '</td>'
      + '<td class="fw7 xs">#' + String(d.orderNumber || '').padStart(6, '0') + '</td>'
      + '<td class="wgrow"><div class="cell-primary">' + omEsc(d.businessName || '\u2014') + '</div></td>'
      + '<td class="center xs">' + (d.customerNotified
        ? '<span class="success fw7">\u2713 Yes</span>'
        : '<span class="danger">\u2717 No</span>') + '</td>'
      + '<td>' + omPayStatusBadge(d.paymentStatus) + '</td>'
      + '<td><span class="badge badge-neutral">' + omEsc(d.dispatchMethod || '\u2014') + '</span></td>'
      + '<td>' + dsBadge(d.dispatchStatus) + '</td>'
      + '<td class="truncate xs" title="' + omEsc(d.notes || '') + '">' + omEsc(d.notes || '\u2014') + '</td>'
      + '<td class="actions-cell">'
      + ((omIsCashierUser(getState().currentUser))
        ? '<span style="color:var(--ink-40);font-size:12px;">View Only</span>'
        : '<button class="btn btn-sm btn-outline" onclick="omUpdateDispatchModal(\'' + d.id + '\')">' + (canOverride ? 'Override' : 'Update') + '</button>'
        + (d.paymentStatus === 'Fully Paid'
          ? ' <button class="btn btn-sm btn-outline" onclick="omPrintDispatchReceipt(\'' + d.id + '\')">\uD83D\uDDA8\uFE0F</button>'
          : ''))
      + '</td>'
      + '</tr>';
  }).join('') || '<tr><td colspan="9" class="empty-row">No dispatch records yet.</td></tr>';

  var isStaffUser2 = omIsCashierUser(getState().currentUser);
  return omToolbar(
    '<input class="form-control pl34" placeholder="Search dispatch\u2026" value="' + (_omSearch || '') + '" oninput="_omSearch=this.value;omRefreshTab()">',
    isStaffUser2 ? '' : '<button class="btn btn-maroon" onclick="omNewDispatchModal()">' + (omCanOverrideDispatch(omCurrentUser()) ? '+ Override Dispatch' : '+ Schedule Dispatch') + '</button>'
  )
    + omTable(
      '<th class="wfix90">Date</th>'
      + '<th class="wfix80">Order #</th>'
      + '<th class="wgrow">Customer</th>'
      + '<th class="wfix70 center">Notified</th>'
      + '<th class="wfix100">Pay Status</th>'
      + '<th class="wfix90">Method</th>'
      + '<th class="wfix100">Status</th>'
      + '<th class="wgrow-sm">Notes</th>'
      + '<th class="wfix110">Actions</th>',
      rows
    );
}

// ORDER MODALS
function addOrderModal() { omNewOrderModal(); }
function confirmOrder() { omConfirmNewOrder(); }

// ── OM Inventory Suggestion Helpers ──────────────────────────────────────────

function omGetBranchInventory(branchId) {
  var s = getState();
  var items = [];
  (s.products || []).forEach(function (p) {
    if (!p.active) return;
    (p.variants || []).forEach(function (v) {
      // Use per-branch stock if the branch key exists; otherwise fall back to
      // total v.stock so variants not yet split across branches still show up.
      var hasBranchEntry = v.branchStocks && typeof v.branchStocks[branchId] === 'number';
      var qty = hasBranchEntry ? v.branchStocks[branchId] : (v.stock || 0);
      // Include ALL variants (even zero stock) so the dropdown always shows
      // available sizes. Staff can still create orders for out-of-stock items.
      items.push({
        productId: p.id,
        variantId: v.id,
        productName: p.name,
        variantName: v.name,
        category: p.category || p.name,
        stock: qty,
        price: v.price || 0
      });
    });
  });
  return items;
}

function omBuildProductCategoryField(branchId) {
  var s = getState();
  var cats = [];
  var seen = {};
  (s.products || []).forEach(function (p) {
    if (!p.active) return;
    var cat = p.category || p.name;
    // Include category if it has ANY variants, regardless of stock level,
    // so staff can always see and select product categories in the dropdown.
    if (!seen[cat] && (p.variants || []).length > 0) {
      seen[cat] = true;
      cats.push(cat);
    }
  });
  var datalist = '<datalist id="om-prod-cat-list">' + cats.map(function (c) { return '<option value="' + c + '">'; }).join('') + '</datalist>';
  return '<div class="form-row-2">'
    + '<div class="form-group" style="position:relative">'
    + '<label>Product Category</label>'
    + '<input id="om-prod-cat" class="form-control" placeholder="e.g. Paper Cups, Boxes" list="om-prod-cat-list" autocomplete="off" oninput="omOnCatInput(this.value)">'
    + datalist
    + '</div>'
    + '<div class="form-group" style="position:relative">'
    + '<label>Product Type / Size <span style="color:var(--danger)">*</span></label>'
    + '<input id="om-prod-type" class="form-control" placeholder="e.g. Ripple Wall Cup 8oz" autocomplete="off" oninput="omOnTypeInput(this.value)" onfocus="omOnTypeInput(this.value)" onblur="setTimeout(function(){var d=document.getElementById(\'om-type-dropdown\');if(d)d.style.display=\'none\';},180)">'
    + '<div id="om-type-dropdown" style="display:none;position:absolute;left:0;right:0;top:calc(100% + 2px);background:#fff;border:1.5px solid var(--ink-20,#ddd);border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,0.10);z-index:9999;max-height:220px;overflow-y:auto;"></div>'
    + '</div>'
    + '</div>'
    + '<div id="om-inv-warn" style="display:none;margin-bottom:10px;padding:8px 13px;background:#fff3cd;border:1.5px solid #f0c040;border-radius:8px;font-size:12.5px;color:#7a5c00">'
    + '\u26A0\uFE0F <strong>Not found in branch inventory.</strong> You can still proceed, but stock won\u2019t be auto-deducted.'
    + '</div>';
}

function omBuildProductTypeField() {
  // Type field already built inline in omBuildProductCategoryField; this returns empty (compat shim)
  return '';
}

// Called when category input changes — refresh the type suggestions
function omOnCatInput(catVal) {
  var s = getState();
  var currentUser = s.currentUser || {};
  var branchId = getActiveBranchId(s, currentUser);
  var items = omGetBranchInventory(branchId);
  var q = (catVal || '').toLowerCase().trim();
  // Store current filtered items for the type dropdown to use
  window._omCatFilteredItems = q ? items.filter(function (i) { return i.category.toLowerCase().indexOf(q) !== -1; }) : items;
  omOnTypeInput(document.getElementById('om-prod-type') ? document.getElementById('om-prod-type').value : '');
}

// Render the custom dropdown with matching variants and their stock counts
function omRenderTypeDropdown(items, q) {
  var dd = document.getElementById('om-type-dropdown');
  if (!dd) return;
  var filtered = q
    ? items.filter(function (i) { return i.variantName.toLowerCase().indexOf(q) !== -1 || i.productName.toLowerCase().indexOf(q) !== -1; })
    : items;
  if (!filtered.length) { dd.style.display = 'none'; return; }
  dd.innerHTML = '';
  filtered.forEach(function (i) {
    var row = document.createElement('div');
    var outOfStock = i.stock <= 0;
    row.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:9px 14px;cursor:pointer;border-bottom:1px solid #f0f0f0;font-size:13px;' + (outOfStock ? 'opacity:0.65;' : '');
    row.addEventListener('mouseover', function () { row.style.background = '#f5f5f5'; });
    row.addEventListener('mouseout', function () { row.style.background = ''; });
    row.addEventListener('mousedown', function () { omSelectType(i.variantId, i.variantName, i.stock, i.price); });
    var nameSpan = document.createElement('span');
    nameSpan.style.cssText = 'font-weight:500;color:var(--ink)';
    nameSpan.textContent = i.variantName;
    var stockColor = i.stock === 0 ? 'var(--danger)' : i.stock <= 10 ? '#b45309' : '#1a8a4a';
    var stockBg = i.stock === 0 ? '#fee2e2' : i.stock <= 10 ? '#fef3c7' : '#dcfce7';
    var badge = document.createElement('span');
    badge.style.cssText = 'font-size:11px;font-weight:700;padding:2px 8px;border-radius:99px;background:' + stockBg + ';color:' + stockColor;
    badge.textContent = outOfStock ? 'Out of stock' : i.stock + ' in stock';
    row.appendChild(nameSpan);
    row.appendChild(badge);
    dd.appendChild(row);
  });
  dd.style.display = '';
}

// Called when user picks a suggestion from the dropdown
function omSelectType(variantId, variantName, stock, price) {
  var typeEl = document.getElementById('om-prod-type');
  if (typeEl) { typeEl.value = variantName; typeEl.dataset.variantId = variantId; }
  var dd = document.getElementById('om-type-dropdown');
  if (dd) dd.style.display = 'none';
  var warn = document.getElementById('om-inv-warn');
  if (warn) warn.style.display = 'none';
  // Auto-fill unit price if empty or zero
  var priceEl = document.getElementById('om-unit-price');
  if (priceEl && (parseFloat(priceEl.value) || 0) === 0 && price > 0) {
    priceEl.value = price;
    omCalcTotal();
  }
}

// Called when type/variant input changes — show custom dropdown with stock counts
function omOnTypeInput(typeVal) {
  var s = getState();
  var currentUser = s.currentUser || {};
  var branchId = getActiveBranchId(s, currentUser);
  var items = window._omCatFilteredItems || omGetBranchInventory(branchId);
  var q = (typeVal || '').toLowerCase().trim();
  var warn = document.getElementById('om-inv-warn');

  // Always show dropdown when field is focused (even empty = show all)
  omRenderTypeDropdown(items, q);

  if (!q) {
    if (warn) warn.style.display = 'none';
    var typeEl0 = document.getElementById('om-prod-type');
    if (typeEl0) delete typeEl0.dataset.variantId;
    return;
  }
  // Check for exact match to update warn and auto-fill price
  var match = items.find(function (i) { return i.variantName.toLowerCase() === q; });
  if (match) {
    if (warn) warn.style.display = 'none';
    var priceEl = document.getElementById('om-unit-price');
    if (priceEl && (parseFloat(priceEl.value) || 0) === 0 && match.price > 0) {
      priceEl.value = match.price;
      omCalcTotal();
    }
    var typeEl = document.getElementById('om-prod-type');
    if (typeEl) typeEl.dataset.variantId = match.variantId;
  } else {
    if (warn) warn.style.display = '';
    var typeEl2 = document.getElementById('om-prod-type');
    if (typeEl2) delete typeEl2.dataset.variantId;
  }
}

function omNewOrderModal() {
  var _u = getState().currentUser;
  if (!_u || !['admin', 'cashier'].includes(normalizeRole(_u.role))) { showToast('Only the Main Admin or Cashier can create project orders.', 'error'); return; }
  var s = getState();
  var crs = getCustomerRecords();
  var currentUser = s.currentUser || {};
  var currentRole = currentUser.role || '';
  var branchId = getActiveBranchId(s, currentUser);
  // Assigned staff = always the currently logged-in user only
  // (whoever is creating the order is the one assigned to it)
  var staffList = currentUser.name ? [currentUser] : [];
  var custOptions = crs.map(function (c) { return '<option value="' + c.id + '">' + c.businessName + ' (' + c.contactPerson + ')</option>'; }).join('');
  var staffOptions = staffList.map(function (u) { return '<option value="' + u.name + '" selected>' + u.name + '</option>'; }).join('');

  showModal(
    '<div class="modal-header"><h2>' + iconSvg('box') + ' Create New Order</h2><button class="btn-close-modal" onclick="closeModal()">\u2715</button></div>'
    + '<div class="modal-body">'

    // ── Customer Info ──
    + '<div class="om-modal-section-label">\uD83D\uDC65 Customer Information</div>'
    + '<div class="form-row-2" style="align-items:flex-end">'
    + '<div class="form-group" style="margin-bottom:0"><label>Customer <span style="color:var(--danger)">*</span></label>'
    + '<div class="form-select-wrap"><select id="om-cust-sel" class="form-control" onchange="omAutofillCustomer(this.value)">'
    + '<option value="new">\u2728 New Customer</option>' + custOptions
    + '</select></div>'
    + '</div>'
    + '<div class="form-group" style="margin-bottom:0"><label>Due Date</label><input id="om-due-date" type="date" class="form-control"></div>'
    + '</div>'
    + '<div id="om-new-customer-notice" style="margin-top:10px;margin-bottom:0;padding:9px 13px;background:linear-gradient(135deg,#fff8e1,#fff3cd);border:1.5px solid #f0c040;border-radius:8px;font-size:12.5px;color:#7a5c00;display:flex;align-items:center;gap:8px">'
    + '<span style="font-size:15px">\u2728</span>'
    + '<span><strong>New customer</strong> — fill in their details below. They will be saved to Customer Records automatically.</span>'
    + '</div>'
    + '<div id="om-cust-fields" style="margin-top:12px">'
    + '<div class="form-row-2">'
    + '<div class="form-group"><label>Business Name <span style="color:var(--danger)">*</span></label><input id="om-business" class="form-control" placeholder="Business or company name\u2026"></div>'
    + '<div class="form-group"><label>Contact Person</label><input id="om-contact" class="form-control" placeholder="Full name"></div>'
    + '</div>'
    + '<div class="form-row-2">'
    + '<div class="form-group"><label>Phone</label><input id="om-phone" class="form-control" placeholder="0917-xxx-xxxx"></div>'
    + '<div class="form-group"><label>Email</label><input id="om-email" type="email" class="form-control" placeholder="email@example.com"></div>'
    + '</div>'
    + '<div class="form-group"><label>Address</label><input id="om-address" class="form-control" placeholder="Business address"></div>'
    + '<div class="form-row-2">'
    + '<div class="form-group"><label>Mode of Payment</label><div class="form-select-wrap"><select id="om-mop" class="form-control"><option value="Cash">Cash</option><option value="GCash">GCash</option></select></div></div>'
    + '<div class="form-group"><label>Mode of Delivery</label><input id="om-mod" class="form-control" value="Pickup" readonly style="background:var(--cream);cursor:not-allowed;color:var(--ink-60)"></div>'
    + '</div>'
    + '<div class="form-row-2">'
    + '<div class="form-group"><label>Branch Staff in Charge</label><input id="om-staff" class="form-control" value="' + omEsc(currentUser.name || '') + '" readonly style="background:var(--cream);cursor:not-allowed;"></div>'
    + '</div>'
    + '</div>'

    + '<hr class="divider" style="margin:16px 0">'

    // ── Order Details ──
    + '<div class="om-modal-section-label">\uD83D\uDCE6 Order Details</div>'
    + omBuildProductCategoryField(branchId)
    + omBuildProductTypeField()
    + '<div class="form-row-3">'
    + '<div class="form-group"><label>Quantity <span style="color:var(--danger)">*</span></label><input id="om-qty" type="number" class="form-control" min="1" value="1" oninput="omCalcTotal()"></div>'
    + '<div class="form-group"><label>Unit Price (per pc)</label><input id="om-unit-price" type="number" class="form-control" min="0" value="0" oninput="omCalcTotal()"></div>'
    + '<div class="form-group"><label>Print Color</label><input id="om-print-color" class="form-control" placeholder="e.g. 1-color, Full Color"></div>'
    + '</div>'

    // ── Plate Section ──
    + '<div class="om-modal-section-label" style="margin-top:12px">\uD83C\uDFAF Plate Charge</div>'
    + '<div style="background:var(--cream);border:1.5px solid var(--ink-10);border-radius:var(--radius);padding:14px 16px;margin-bottom:14px">'
    + '<div class="form-row-3">'
    + '<div class="form-group" style="margin-bottom:0">'
    + '<label>Customer Type</label>'
    + '<div class="form-select-wrap"><select id="om-cust-type" class="form-control" onchange="omCalcTotal()">'
    + '<option value="new">New Customer</option>'
    + '<option value="old">Old Customer</option>'
    + '</select></div>'
    + '</div>'
    + '<div class="form-group" style="margin-bottom:0">'
    + '<label>New Logo? <span class="text-xs text-muted">(old customers)</span></label>'
    + '<div class="form-select-wrap"><select id="om-new-logo" class="form-control" onchange="omCalcTotal()">'
    + '<option value="0">No \u2014 Reuse existing</option>'
    + '<option value="1">Yes \u2014 New logo</option>'
    + '</select></div>'
    + '</div>'
    + '<div class="form-group" style="margin-bottom:0">'
    + '<label>Product Fee</label>'
    + '<input id="om-product-fee" type="number" class="form-control" min="0" value="0" placeholder="0.00" oninput="omCalcTotal()">'
    + '</div>'
    + '</div>'
    + '<div style="margin-top:10px;padding:10px 12px;background:var(--white);border-radius:var(--radius-sm);border:1px solid var(--ink-10);font-size:13px">'
    + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">'
    + '<span style="color:var(--ink-60)">Plate Charge:</span>'
    + '<strong id="om-plate-charge-display" style="color:var(--maroon)">\u20B10.00</strong>'
    + '</div>'
    + '<div id="om-plate-note-auto" class="text-xs text-muted"></div>'
    + '</div>'
    + '<div class="form-group" style="margin-top:10px;margin-bottom:0">'
    + '<label>Plate Note <span class="text-xs text-muted">(auto-filled, editable)</span></label>'
    + '<input id="om-plate-note" class="form-control" placeholder="e.g. New plate, Re-use">'
    + '</div>'
    + '</div>'

    + '<div class="form-group"><label>Order Notes</label><textarea id="om-notes" class="form-control" rows="2" placeholder="Special instructions\u2026"></textarea></div>'

    + '<hr class="divider" style="margin:16px 0">'

    // ── Payment Details ──
    + '<div class="om-modal-section-label">\uD83D\uDCB3 Payment Details</div>'
    + '<div style="background:var(--cream);border:1.5px solid var(--ink-10);border-radius:var(--radius);padding:14px 16px;margin-bottom:14px">'
    + '<div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:8px;margin-bottom:10px">'
    + '<div><div class="text-xs text-muted" style="margin-bottom:2px">Products Subtotal</div><div id="om-summary-products" style="font-weight:700;font-size:14px">\u20B10.00</div></div>'
    + '<div><div class="text-xs text-muted" style="margin-bottom:2px">Plate Charge</div><div id="om-summary-plate" style="font-weight:700;font-size:14px;color:var(--maroon)">\u20B10.00</div></div>'
    + '<div><div class="text-xs text-muted" style="margin-bottom:2px">Discount</div><div id="om-summary-discount" style="font-weight:700;font-size:14px;color:var(--success)">- \u20B10.00</div></div>'
    + '<div><div class="text-xs text-muted" style="margin-bottom:2px">Total</div><div id="om-summary-total" style="font-weight:800;font-size:16px;color:var(--maroon)">\u20B10.00</div></div>'
    + '</div>'
    + '<div id="om-discount-note" class="text-xs" style="color:var(--success);margin-bottom:8px;display:none"></div>'
    + '</div>'
    + '<div class="form-row-3">'
    + '<div class="form-group"><label>Total Amount</label><input id="om-total" type="number" class="form-control" min="0" value="0" oninput="omCalcBalance()" style="font-weight:700"></div>'
    + '<div class="form-group"><label>Downpayment</label><input id="om-downpayment" type="number" class="form-control" min="0" value="0" oninput="omCalcBalance()"></div>'
    + '<div class="form-group"><label>Balance</label><input id="om-balance" type="number" class="form-control" readonly style="background:var(--cream)"></div>'
    + '</div>'
    + '<div class="form-row-2">'
    + '<div class="form-group"><label>Payment Status</label><div class="form-select-wrap"><select id="om-pay-status" class="form-control" onchange="omOnPayStatusChange()"><option value="Pending">Pending</option><option value="30%">30% Downpayment</option><option value="Partial">Partial</option><option value="Fully Paid">Fully Paid</option></select></div></div>'
    + '</div>'

    + '</div>'
    + '<div class="modal-footer"><button class="btn btn-outline" onclick="closeModal()">Cancel</button><button class="btn btn-maroon" onclick="omConfirmNewOrder()">Create Order \u2192</button></div>'
  );

  // Auto-select current user in staff dropdown & init inventory suggestions
  setTimeout(function () {
    var staffSel = document.getElementById('om-staff');
    if (staffSel && currentUser && currentUser.name) {
      staffSel.value = currentUser.name;
    }
    // Default to new customer state on open
    omAutofillCustomer('new');
    // Populate type dropdown with all branch items initially
    omOnCatInput('');
    omCalcTotal();

    // ── SESSION STORAGE DRAFT RESTORE ──
    // Only restore draft if it was saved by the same user (avoid stale admin draft showing for branch staff)
    try {
      var draft = JSON.parse(sessionStorage.getItem('om_new_order_draft') || 'null');
      if (draft && draft._userId && draft._userId !== (currentUser.id || '')) draft = null;
      if (draft) {
        function sr(id, v) { var el = document.getElementById(id); if (el && v !== undefined && v !== null) el.value = v; }
        // Restore customer selection first so autofill + lock/unlock runs correctly
        var custSelEl = document.getElementById('om-cust-sel');
        if (custSelEl && draft.custSel) custSelEl.value = draft.custSel;
        omAutofillCustomer(draft.custSel || 'new');
        // Override with saved draft field values
        sr('om-business', draft.business);
        sr('om-contact', draft.contact);
        sr('om-phone', draft.phone);
        sr('om-email', draft.email);
        sr('om-address', draft.address);
        sr('om-mop', draft.mop);
        // om-staff is always the currently logged-in user — never restore from draft
        sr('om-due-date', draft.dueDate);
        sr('om-prod-cat', draft.prodCat);
        sr('om-prod-type', draft.prodType);
        sr('om-qty', draft.qty);
        sr('om-unit-price', draft.unitPrice);
        sr('om-print-color', draft.printColor);
        sr('om-cust-type', draft.custType);
        sr('om-new-logo', draft.newLogo);
        sr('om-product-fee', draft.productFee);
        sr('om-notes', draft.notes);
        sr('om-pay-status', draft.payStatus);
        omOnCatInput(draft.prodCat || '');
        omCalcTotal();
        if (draft.payStatus) omOnPayStatusChange();
        showToast('\uD83D\uDCDD Draft restored from your last session!', 'info');
      }
    } catch (e) { }

    // Attach draft-saving listeners to all form fields
    var draftFields = ['om-business', 'om-contact', 'om-phone', 'om-email', 'om-address', 'om-mop', 'om-staff', 'om-due-date', 'om-prod-cat', 'om-prod-type', 'om-qty', 'om-unit-price', 'om-print-color', 'om-cust-type', 'om-new-logo', 'om-product-fee', 'om-notes', 'om-pay-status', 'om-cust-sel'];
    draftFields.forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.addEventListener('change', omSaveNewOrderDraft);
      if (el && el.tagName === 'INPUT') el.addEventListener('input', omSaveNewOrderDraft);
    });
  }, 50);
}

// Pricing constants
var OM_PLATE_PER_COLOR = 550;

// Save new order form to sessionStorage so draft survives accidental close
function omSaveNewOrderDraft() {
  try {
    function gv(id) { var el = document.getElementById(id); return el ? el.value : ''; }
    sessionStorage.setItem('om_new_order_draft', JSON.stringify({
      _userId: currentUser.id || '',
      custSel: gv('om-cust-sel'), business: gv('om-business'), contact: gv('om-contact'),
      phone: gv('om-phone'), email: gv('om-email'), address: gv('om-address'),
      mop: gv('om-mop'), dueDate: gv('om-due-date'),
      prodCat: gv('om-prod-cat'), prodType: gv('om-prod-type'),
      qty: gv('om-qty'), unitPrice: gv('om-unit-price'), printColor: gv('om-print-color'),
      custType: gv('om-cust-type'), newLogo: gv('om-new-logo'), productFee: gv('om-product-fee'),
      notes: gv('om-notes'), payStatus: gv('om-pay-status'),
    }));
  } catch (e) { }
}
var OM_DISCOUNT_THRESHOLD = 3000;
var OM_DISCOUNT_RATE = 0.05; // 5% — adjust as needed

function omCalcTotal() {
  function gv(id) { var el = document.getElementById(id); return el ? el.value : ''; }
  function sv(id, v) { var el = document.getElementById(id); if (el) el.value = v; }
  function st(id, v) { var el = document.getElementById(id); if (el) el.textContent = v; }

  var qty = parseInt(gv('om-qty')) || 0;
  var unitPrice = parseFloat(gv('om-unit-price')) || 0;
  var productFee = parseFloat(gv('om-product-fee')) || 0;
  var custType = gv('om-cust-type'); // 'new' or 'old'
  var newLogo = gv('om-new-logo') === '1';

  // Product subtotal
  var productsSub = qty * unitPrice;

  // Plate charge logic:
  // New customer → product fee + 550
  // Old customer, new logo → product fee + 550
  // Old customer, reuse logo → 0
  var plateCharge = 0;
  var plateNote = '';
  if (custType === 'new') {
    plateCharge = productFee + OM_PLATE_PER_COLOR;
    plateNote = 'New customer: Product fee (\u20B1' + omFmt(productFee) + ') + Plate (\u20B1' + OM_PLATE_PER_COLOR + ')';
    sv('om-plate-note', 'New plate \u2014 \u20B1' + omFmt(productFee) + ' product fee + \u20B1' + OM_PLATE_PER_COLOR + ' plate charge');
  } else if (newLogo) {
    plateCharge = productFee + OM_PLATE_PER_COLOR;
    plateNote = 'New logo: Product fee (\u20B1' + omFmt(productFee) + ') + Plate (\u20B1' + OM_PLATE_PER_COLOR + ')';
    sv('om-plate-note', 'New logo \u2014 \u20B1' + omFmt(productFee) + ' product fee + \u20B1' + OM_PLATE_PER_COLOR + ' plate charge');
  } else {
    plateCharge = 0;
    plateNote = 'Old customer \u2014 no plate charge';
    sv('om-plate-note', 'Re-use existing plate');
  }

  // Subtotal before discount
  var subtotal = productsSub + plateCharge;

  // Discount: 5% if order >= 3,000 (on product subtotal only, not plate)
  var discountAmt = 0;
  var discountNote = '';
  if (productsSub >= OM_DISCOUNT_THRESHOLD) {
    discountAmt = Math.round(productsSub * OM_DISCOUNT_RATE * 100) / 100;
    discountNote = '\u2714 5% discount applied \u2014 order total \u20B1' + omFmt(productsSub) + ' \u2265 \u20B1' + omFmt(OM_DISCOUNT_THRESHOLD);
  }

  var total = Math.max(0, subtotal - discountAmt);

  // Update display
  var pcd = document.getElementById('om-plate-charge-display');
  if (pcd) pcd.textContent = '\u20B1' + omFmt(plateCharge);
  var pna = document.getElementById('om-plate-note-auto');
  if (pna) pna.textContent = plateNote;

  var sp = document.getElementById('om-summary-products');
  if (sp) sp.textContent = '\u20B1' + omFmt(productsSub);
  var spl = document.getElementById('om-summary-plate');
  if (spl) spl.textContent = '\u20B1' + omFmt(plateCharge);
  var sd = document.getElementById('om-summary-discount');
  if (sd) sd.textContent = '- \u20B1' + omFmt(discountAmt);
  var st2 = document.getElementById('om-summary-total');
  if (st2) { st2.textContent = '\u20B1' + omFmt(total); }

  var dn = document.getElementById('om-discount-note');
  if (dn) { dn.textContent = discountNote; dn.style.display = discountAmt > 0 ? 'block' : 'none'; }

  var totalEl = document.getElementById('om-total');
  if (totalEl) { totalEl.value = total.toFixed(2); }

  // Re-run pay status logic (e.g. if status is 30%, update downpayment)
  omOnPayStatusChange();
  omCalcBalance();
}

function omCalcBalance() {
  var total = parseFloat((document.getElementById('om-total') || {}).value) || 0;
  var down = parseFloat((document.getElementById('om-downpayment') || {}).value) || 0;
  var balEl = document.getElementById('om-balance');
  if (balEl) balEl.value = Math.max(0, total - down).toFixed(2);
}

// Auto-compute downpayment when payment status is set to 30%
function omOnPayStatusChange() {
  var status = (document.getElementById('om-pay-status') || {}).value;
  var total = parseFloat((document.getElementById('om-total') || {}).value) || 0;
  var downEl = document.getElementById('om-downpayment');
  if (!downEl) return;
  if (status === '30%' && total > 0) {
    downEl.value = (total * 0.3).toFixed(2);
    omCalcBalance();
  } else if (status === 'Fully Paid' && total > 0) {
    downEl.value = total.toFixed(2);
    omCalcBalance();
  } else if (status === 'Pending') {
    downEl.value = '0.00';
    omCalcBalance();
  }
}

function omAutofillCustomer(customerId) {
  var isNew = !customerId || customerId === 'new';
  var noticeEl = document.getElementById('om-new-customer-notice');
  var fieldsEl = document.getElementById('om-cust-fields');
  var ct = document.getElementById('om-cust-type');

  function sv(id, v) { var el = document.getElementById(id); if (el) el.value = v || ''; }
  function setReadonly(id, readonly) {
    var el = document.getElementById(id);
    if (!el) return;
    if (readonly) {
      el.setAttribute('readonly', true);
      el.style.background = 'var(--cream)';
      el.style.color = 'var(--ink-60)';
      el.style.cursor = 'not-allowed';
    } else {
      el.removeAttribute('readonly');
      el.style.background = '';
      el.style.color = '';
      el.style.cursor = '';
    }
  }

  if (isNew) {
    // New customer — show notice, clear fields, make all editable
    if (noticeEl) noticeEl.style.display = 'flex';
    sv('om-business', ''); sv('om-contact', ''); sv('om-phone', '');
    sv('om-email', ''); sv('om-address', '');
    ['om-business', 'om-contact', 'om-phone', 'om-email', 'om-address'].forEach(function (id) { setReadonly(id, false); });
    var mopSel = document.getElementById('om-mop'); if (mopSel) mopSel.disabled = false;
    if (ct) ct.value = 'new';
    omCalcTotal();
    return;
  }

  // Existing customer — autofill and lock fields
  var crs = getCustomerRecords();
  var c = crs.find(function (x) { return x.id === customerId; });
  if (!c) return;

  sv('om-business', c.businessName);
  sv('om-contact', c.contactPerson);
  sv('om-phone', c.phone);
  sv('om-email', c.email);
  sv('om-address', c.address);
  var mopSel = document.getElementById('om-mop');
  if (mopSel) { if (c.modeOfPayment) mopSel.value = c.modeOfPayment; mopSel.disabled = false; }
  var staffSel = document.getElementById('om-staff');
  if (staffSel && c.branchStaff) staffSel.value = c.branchStaff;

  // Lock the info fields so user can't accidentally edit an existing customer's record
  ['om-business', 'om-contact', 'om-phone', 'om-email', 'om-address'].forEach(function (id) { setReadonly(id, true); });

  if (noticeEl) noticeEl.style.display = 'none';
  if (ct) ct.value = 'old';
  omCalcTotal();
}

// Kept as no-op for compatibility (no longer needed with combined dropdown)
function omCheckNewCustomerNotice() { }

function omConfirmNewOrder() {
  var _u = getState().currentUser; if (!_u || !['admin', 'cashier'].includes(normalizeRole(_u.role))) { showToast('Only the Main Admin or Cashier can create project orders.', 'error'); return; }
  function gv(id) { var el = document.getElementById(id); return el ? el.value : ''; }
  var businessName = gv('om-business').trim();
  var qty = parseInt(gv('om-qty')) || 0;
  if (!businessName) { showToast('Business name is required.', 'error'); return; }
  if (qty <= 0) { showToast('Quantity must be at least 1.', 'error'); return; }
  // Capture the matched inventory variantId (if user selected from suggestions)
  var prodTypeEl = document.getElementById('om-prod-type');
  var linkedVariantId = (prodTypeEl && prodTypeEl.dataset && prodTypeEl.dataset.variantId) ? prodTypeEl.dataset.variantId : null;

  var total = parseFloat(gv('om-total')) || 0;
  var down = parseFloat(gv('om-downpayment')) || 0;
  var balance = Math.max(0, total - down);
  var customerRecordId = gv('om-cust-sel');
  if (customerRecordId === 'new') customerRecordId = ''; // 'new' means no existing record yet

  var orders = getOrders();
  var maxId = orders.length ? Math.max.apply(null, orders.map(function (o) { return Number(o.id) || 0; })) : 0;

  // Gather pricing breakdown for record-keeping
  var unitPrice = parseFloat(gv('om-unit-price')) || 0;
  var productFee = parseFloat(gv('om-product-fee')) || 0;
  var custType = gv('om-cust-type');
  var newLogo = gv('om-new-logo') === '1';
  var productsSub = qty * unitPrice;
  var plateCharge = (custType === 'new' || newLogo) ? (productFee + OM_PLATE_PER_COLOR) : 0;
  var discountAmt = productsSub >= OM_DISCOUNT_THRESHOLD ? Math.round(productsSub * OM_DISCOUNT_RATE * 100) / 100 : 0;

  var newOrder = {
    id: maxId + 1,
    customer_record_id: customerRecordId,
    customer_name: businessName,
    contact_person: gv('om-contact'),
    phone: gv('om-phone'),
    email: gv('om-email'),
    address: gv('om-address'),
    mode_of_payment: gv('om-mop'),
    mode_of_delivery: gv('om-mod'),
    branch_staff: gv('om-staff'),
    notes: gv('om-notes'),
    product_category: gv('om-prod-cat'),
    product_type: gv('om-prod-type'),
    quantity: qty,
    unit_price: unitPrice,
    product_fee: productFee,
    plate_charge: plateCharge,
    discount_amount: discountAmt,
    customer_type: custType,
    print_color: gv('om-print-color'),
    plate_note: gv('om-plate-note'),
    total_amount: total,
    status: 'pending',
    downpayment: down,
    balance: balance,
    payment_mode: gv('om-mop'),
    payment_status: gv('om-pay-status') || 'Pending',
    due_date: gv('om-due-date'),
    order_date: new Date().toISOString().slice(0, 10),
    created_at: new Date().toISOString(),
    linked_variant_id: linkedVariantId || null,
    linked_branch_id: linkedVariantId ? getActiveBranchId(getState(), getState().currentUser) : null,
    stock_deducted: false,
  };

  // Save to DB first to get the real MySQL AUTO_INCREMENT id back
  // FIX: Push to local array FIRST (optimistic), then update ID when server responds.
  // This preserves fast UI while ensuring the server ID is eventually correct.
  orders.push(newOrder);
  saveOrders(orders);

  DB.saveOrder(newOrder).then(function (result) {
    if (result && result.id) {
      var tempId = newOrder.id;
      var idx = orders.findIndex(function (o) { return String(o.id) === String(tempId); });
      if (idx !== -1) {
        orders[idx].id = result.id;
        newOrder.id = result.id;
        saveOrders(orders);
        // Update localStorage records that used the temp id
        var pays = getPaymentRecords();
        pays.forEach(function (p) { if (String(p.orderId) === String(tempId)) { p.orderId = result.id; p.orderNumber = result.id; } });
        savePaymentRecords(pays);
        var prods2 = getProductionRecords();
        prods2.forEach(function (p) { if (String(p.orderId) === String(tempId)) { p.orderId = result.id; p.orderNumber = result.id; } });
        saveProductionRecords(prods2);
        var disps2 = getDispatchRecords();
        disps2.forEach(function (d) { if (String(d.orderId) === String(tempId)) { d.orderId = result.id; d.orderNumber = result.id; } });
        saveDispatchRecords(disps2);
      }

      // ── NOW persist payment/production/dispatch to DB with the REAL order id ──
      // (Must be inside .then so order exists in DB before FK-constrained children)
      var realPays = getPaymentRecords();
      var payRec = realPays.find(function (p) { return String(p.orderId) === String(result.id); });
      if (payRec) {
        DB.saveOrderPayment({
          id: payRec.id,
          orderId: result.id,
          customerId: payRec.customerId || null,
          businessName: payRec.businessName || null,
          contactPerson: payRec.contactPerson || null,
          totalAmount: payRec.totalAmount || 0,
          downpayment: payRec.downpayment || 0,
          balance: payRec.balance || 0,
          modeOfPayment: payRec.modeOfPayment || null,
          paymentStatus: payRec.paymentStatus || 'Pending',
          note: payRec.note || null,
          date: payRec.date || new Date().toISOString(),
        }).catch(function () { });
      }

      var realProds = getProductionRecords();
      var prodRec = realProds.find(function (p) { return String(p.orderId) === String(result.id); });
      if (prodRec) {
        DB.saveProduction(prodRec).catch(function () { });
      }

      var realDisps = getDispatchRecords();
      var dispRec = realDisps.find(function (d) { return String(d.orderId) === String(result.id); });
      if (dispRec) {
        DB.saveDispatch(dispRec).catch(function () { });
      }
    }
  }).catch(function () { });

  // ── Auto-add new customer to Customer Records if not already there ──
  var crs = getCustomerRecords();
  var alreadyExists = customerRecordId
    ? crs.some(function (c) { return c.id === customerRecordId; })
    : crs.some(function (c) { return (c.businessName || '').toLowerCase().trim() === businessName.toLowerCase().trim(); });

  if (!alreadyExists) {
    var newCR = {
      id: omGenId('CR'),
      businessName: businessName,
      contactPerson: gv('om-contact') || '',
      phone: gv('om-phone') || '',
      email: gv('om-email') || '',
      address: gv('om-address') || '',
      modeOfPayment: gv('om-mop') || '',
      modeOfDelivery: gv('om-mod') || '',
      branchStaff: gv('om-staff') || '',
      notes: '',
      branchId: getActiveBranchId(getState(), getState().currentUser) || null,
      createdAt: new Date().toISOString()
    };
    crs.push(newCR);
    saveCustomerRecords(crs);
    // ── FIX: also persist new OM customer to the server DB ──
    DB.saveOMCustomer({
      id: newCR.id,
      businessName: newCR.businessName,
      contactPerson: newCR.contactPerson || '',
      phone: newCR.phone || '',
      email: newCR.email || '',
      address: newCR.address || '',
      modeOfPayment: newCR.modeOfPayment || '',
      modeOfDelivery: newCR.modeOfDelivery || '',
      branchStaff: newCR.branchStaff || '',
      notes: newCR.notes || '',
      branchId: newCR.branchId,
      createdAt: newCR.createdAt,
    });
    newOrder.customer_record_id = newCR.id;
    // Update order with new customer record id
    var oIdx = orders.findIndex(function (o) { return o.id === newOrder.id; });
    if (oIdx !== -1) orders[oIdx].customer_record_id = newCR.id;
    saveOrders(orders);
    showToast('\u2728 New customer \u201c' + businessName + '\u201d added to Customer Records!', 'info');
  }

  // Logo upload removed

  // ── Auto-create Payment record ──
  var payments = getPaymentRecords();
  payments.push({
    id: omGenId('pay'), orderId: newOrder.id, orderNumber: newOrder.id,
    customerId: newOrder.customer_record_id || customerRecordId, businessName: businessName,
    contactPerson: newOrder.contact_person, totalAmount: total,
    downpayment: down, balance: balance, modeOfPayment: newOrder.payment_mode,
    paymentStatus: newOrder.payment_status, date: new Date().toISOString(), note: ''
  });
  savePaymentRecords(payments);

  // ── Auto-create Production record (Pending status) ──
  var prods = getProductionRecords();
  prods.push({
    id: omGenId('prod'),
    orderId: newOrder.id,
    orderNumber: newOrder.id,
    customerId: newOrder.customer_record_id || customerRecordId,
    businessName: businessName,
    orderDate: newOrder.created_at,
    assignedTo: gv('om-staff') || '',
    progress: 0,
    status: 'pending',
    materialsUsed: '',
    notes: gv('om-notes') || '',
    qcResult: 'Pending',
    checkCount: 0,
    completionDate: gv('om-due-date') || null,
    createdAt: new Date().toISOString()
  });
  saveProductionRecords(prods);
  // NOTE: DB.saveProduction is called inside DB.saveOrder.then() to ensure order exists first

  // ── Auto-create Dispatch record (Scheduled status) — only if none exists yet ──
  // FIX 4: Guard against duplicate dispatch records (order creation vs manual schedule)
  var dispatches = getDispatchRecords();
  var alreadyHasDispatch = dispatches.some(function (d) { return String(d.orderId) === String(newOrder.id); });
  if (!alreadyHasDispatch) {
    dispatches.push({
      id: omGenId('disp'),
      orderId: newOrder.id,
      orderNumber: newOrder.id,
      customerId: newOrder.customer_record_id || customerRecordId,
      businessName: businessName,
      date: new Date().toISOString(),
      customerNotified: false,
      paymentStatus: newOrder.payment_status || 'Pending',
      dispatchMethod: gv('om-mod') || 'Pickup',
      dispatchStatus: 'Scheduled',
      notes: '',
      createdAt: new Date().toISOString()
    });
    saveDispatchRecords(dispatches);
    // NOTE: DB.saveDispatch is called inside DB.saveOrder.then() to ensure order exists first
  }

  // Push to POS receipt history if created as fully paid and completed
  omPushToReceiptHistory(newOrder.id);

  closeModal();
  // ── Clear draft on successful order creation ──
  try { sessionStorage.removeItem('om_new_order_draft'); } catch (e) { }
  showToast('Order #' + String(newOrder.id).padStart(6, '0') + ' created!', 'success');
  _omTab = 'orders';
  renderOrders();
}

function omViewOrderModal(orderId) {
  var orders = getOrders();
  var o = orders.find(function (x) { return String(x.id) === String(orderId); });
  if (!o) return;
  var logos = getLogoUploads().filter(function (l) { return String(l.orderId) === String(orderId); });
  var prods = getProductionRecords().filter(function (p) { return String(p.orderNumber) === String(orderId); });
  var dispatches = getDispatchRecords().filter(function (d) { return String(d.orderNumber) === String(orderId); });

  var extraHtml = '';
  if (logos.length) extraHtml += '<div style="margin-top:16px"><div class="om-detail-title">\uD83D\uDDBC\uFE0F Logos (' + logos.length + ')</div><div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:8px">' + logos.map(function (l) { return '<div style="background:var(--cream);border:1px solid var(--ink-10);border-radius:var(--radius-sm);padding:8px 12px;font-size:12px">\uD83D\uDCCE ' + l.fileName + '</div>'; }).join('') + '</div></div>';
  if (prods.length) extraHtml += '<div style="margin-top:16px"><div class="om-detail-title">\uD83D\uDDA8\uFE0F Production (' + prods.length + ' record(s))</div>' + prods.map(function (p) { return '<div style="background:var(--cream);border-radius:var(--radius-sm);padding:10px;margin-top:6px;font-size:13px"><strong>' + (p.assignedTo || 'Unassigned') + '</strong> \u00B7 ' + (p.progress || 0) + '% \u00B7 ' + (p.qcResult || 'QC Pending') + '</div>'; }).join('') + '</div>';
  if (dispatches.length) extraHtml += '<div style="margin-top:16px"><div class="om-detail-title">\uD83D\uDE9A Dispatch</div>' + dispatches.map(function (d) { return '<div style="background:var(--cream);border-radius:var(--radius-sm);padding:10px;margin-top:6px;font-size:13px">' + (d.dispatchMethod || '\u2014') + ' \u00B7 ' + (d.dispatchStatus || '\u2014') + ' \u00B7 Notified: ' + (d.customerNotified ? 'Yes' : 'No') + '</div>'; }).join('') + '</div>';

  showModal('<div class="modal-header"><h2>' + iconSvg('box') + ' Order #' + String(o.id).padStart(6, '0') + '</h2><button class="btn-close-modal" onclick="closeModal()">\u2715</button></div>'
    + '<div class="modal-body">'
    + '<div class="om-detail-grid">'
    + '<div class="om-detail-section"><div class="om-detail-title">Customer</div>'
    + '<div class="om-detail-row"><span>Business</span><strong>' + (o.customer_name || '\u2014') + '</strong></div>'
    + '<div class="om-detail-row"><span>Contact</span><span>' + (o.contact_person || '\u2014') + '</span></div>'
    + '<div class="om-detail-row"><span>Phone</span><span>' + (o.phone || '\u2014') + '</span></div>'
    + '<div class="om-detail-row"><span>Email</span><span>' + (o.email || '\u2014') + '</span></div>'
    + '<div class="om-detail-row"><span>Address</span><span>' + (o.address || '\u2014') + '</span></div>'
    + '<div class="om-detail-row"><span>Pay Mode</span><span>' + (o.mode_of_payment || '\u2014') + '</span></div>'
    + '<div class="om-detail-row"><span>Delivery</span><span>' + (o.mode_of_delivery || '\u2014') + '</span></div>'
    + '<div class="om-detail-row"><span>Staff</span><span>' + (o.branch_staff || '\u2014') + '</span></div>'
    + '</div>'
    + '<div class="om-detail-section"><div class="om-detail-title">Order Details</div>'
    + '<div class="om-detail-row"><span>Category</span><span>' + (o.product_category || '\u2014') + '</span></div>'
    + '<div class="om-detail-row"><span>Product</span><strong>' + (o.product_type || '\u2014') + '</strong></div>'
    + '<div class="om-detail-row"><span>Quantity</span><strong>' + (o.quantity || '\u2014') + '</strong></div>'
    + '<div class="om-detail-row"><span>Print Color</span><span>' + (o.print_color || '\u2014') + '</span></div>'
    + '<div class="om-detail-row"><span>Plate Note</span><span>' + (o.plate_note || '\u2014') + '</span></div>'
    + '<div class="om-detail-row"><span>Due Date</span><span>' + omDate(o.due_date) + '</span></div>'
    + '<div class="om-detail-row"><span>Status</span>' + omStatusBadge(o.status) + '</div>'
    + (o.notes ? '<div class="om-detail-row"><span>Notes</span><span>' + o.notes + '</span></div>' : '')
    + '</div>'
    + '<div class="om-detail-section"><div class="om-detail-title">Payment</div>'
    + '<div class="om-detail-row"><span>Total</span><strong style="color:var(--maroon)">\u20B1' + omFmt(o.total_amount) + '</strong></div>'
    + '<div class="om-detail-row"><span>Downpayment</span><span>\u20B1' + omFmt(o.downpayment) + '</span></div>'
    + '<div class="om-detail-row"><span>Balance</span><strong style="color:' + ((o.balance || 0) > 0 ? 'var(--danger)' : 'var(--success)') + '">\u20B1' + omFmt(o.balance) + '</strong></div>'
    + '<div class="om-detail-row"><span>Pay Status</span>' + omPayStatusBadge(o.payment_status) + '</div>'
    + '</div></div>'
    + extraHtml
    + '</div>'
    + '<div class="modal-footer"><button class="btn btn-outline" onclick="closeModal()">Close</button>'
    + (!(getState().currentUser && getState().currentUser.role === 'print')
      ? '<button class="btn btn-maroon" onclick="closeModal();omEditOrderModal(\'' + o.id + '\')">Edit Order</button>'
      : '')
    + '</div>');
}

function omEditOrderModal(orderId) {
  var _u = getState().currentUser; if (!_u || !['admin', 'cashier', 'print'].includes(normalizeRole(_u.role))) { showToast('Only the Main Admin, Cashier, or Production Personnel can edit project orders.', 'error'); return; }
  var _isPrintEdit = normalizeRole(_u.role) === 'print';
  var orders = getOrders();
  var o = orders.find(function (x) { return String(x.id) === String(orderId); });
  if (!o) { showToast('Order not found.', 'error'); return; }
  if (omIsCashierUser(_u) && o.status === 'completed') {
    showToast('Completed orders are view-only for Cashier.', 'error');
    omViewOrderModal(orderId);
    return;
  }

  // Print personnel: lock customer/pricing fields, only allow status, due date, notes, print color
  var _roAttr = _isPrintEdit ? ' readonly style="background:var(--cream);color:var(--ink-60)"' : '';
  showModal('<div class="modal-header"><h2>' + iconSvg('note') + ' Edit Order #' + String(o.id).padStart(6, '0') + '</h2><button class="btn-close-modal" onclick="closeModal()">\u2715</button></div>'
    + '<div class="modal-body">'
    + (_isPrintEdit ? '<div class="alert alert-info" style="margin-bottom:12px;font-size:12.5px">' + iconSvg('printer') + ' Print Personnel: you can update order status, due date, print color, and notes.</div>' : '')
    + '<div class="form-row-2"><div class="form-group"><label>Business Name</label><input id="ome-business" class="form-control" value="' + (o.customer_name || '') + '"' + _roAttr + '></div>'
    + '<div class="form-group"><label>Contact Person</label><input id="ome-contact" class="form-control" value="' + (o.contact_person || '') + '"' + _roAttr + '></div></div>'
    + '<div class="form-row-2"><div class="form-group"><label>Phone</label><input id="ome-phone" class="form-control" value="' + (o.phone || '') + '"' + _roAttr + '></div>'
    + '<div class="form-group"><label>Email</label><input id="ome-email" class="form-control" value="' + (o.email || '') + '"' + _roAttr + '></div></div>'
    + '<div class="form-group"><label>Address</label><input id="ome-address" class="form-control" value="' + (o.address || '') + '"' + _roAttr + '></div>'
    + '<div class="form-row-2"><div class="form-group"><label>Product Category</label><input id="ome-prod-cat" class="form-control" value="' + (o.product_category || '') + '"' + _roAttr + '></div>'
    + '<div class="form-group"><label>Product Type/Size</label><input id="ome-prod-type" class="form-control" value="' + (o.product_type || '') + '"' + _roAttr + '></div></div>'

    // ── Pricing fields (admin only; print sees readonly summary) ──
    + (!_isPrintEdit ? '<div class="om-modal-section-label" style="margin-top:8px">\uD83D\uDCB0 Pricing & Plate</div>' : '')
    + (!_isPrintEdit ? '<div class="form-row-3">'
      + '<div class="form-group"><label>Quantity</label><input id="ome-qty" type="number" class="form-control" value="' + (o.quantity || 1) + '" oninput="omEditCalcTotal()"></div>'
      + '<div class="form-group"><label>Unit Price (per pc)</label><input id="ome-unit-price" type="number" class="form-control" value="' + (o.unit_price || 0) + '" oninput="omEditCalcTotal()"></div>'
      + '<div class="form-group"><label>Print Color</label><input id="ome-print-color" class="form-control" value="' + (o.print_color || '') + '"></div>'
      + '</div>'
      : '<div class="form-group"><label>Print Color</label><input id="ome-print-color" class="form-control" value="' + (o.print_color || '') + '"></div>')
    + (!_isPrintEdit ? '<div class="form-row-3">'
      + '<div class="form-group"><label>Customer Type</label><div class="form-select-wrap"><select id="ome-cust-type" class="form-control" onchange="omEditCalcTotal()">'
      + '<option value="new" ' + (o.customer_type === 'new' ? 'selected' : '') + '>New Customer</option>'
      + '<option value="old" ' + (o.customer_type === 'old' ? 'selected' : '') + '>Old Customer</option>'
      + '</select></div></div>'
      + '<div class="form-group"><label>New Logo?</label><div class="form-select-wrap"><select id="ome-new-logo" class="form-control" onchange="omEditCalcTotal()">'
      + '<option value="0" ' + (!o.plate_note || o.plate_note.toLowerCase().indexOf('re-use') !== -1 ? 'selected' : '') + '>No — Reuse existing</option>'
      + '<option value="1" ' + (o.plate_note && o.plate_note.toLowerCase().indexOf('new logo') !== -1 ? 'selected' : '') + '>Yes — New logo</option>'
      + '</select></div></div>'
      + '<div class="form-group"><label>Product Fee</label><input id="ome-product-fee" type="number" class="form-control" value="' + (o.product_fee || 0) + '" oninput="omEditCalcTotal()"></div>'
      + '</div>'
      + '<div style="background:var(--cream);border:1px solid var(--ink-10);border-radius:var(--radius-sm);padding:10px 14px;margin-bottom:12px;font-size:13px">'
      + '<div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:8px">'
      + '<div><div class="text-xs text-muted">Products Sub</div><div id="ome-summary-products" style="font-weight:700">\u20B10.00</div></div>'
      + '<div><div class="text-xs text-muted">Plate Charge</div><div id="ome-summary-plate" style="font-weight:700;color:var(--maroon)">\u20B10.00</div></div>'
      + '<div><div class="text-xs text-muted">Discount</div><div id="ome-summary-discount" style="font-weight:700;color:var(--success)">- \u20B10.00</div></div>'
      + '<div><div class="text-xs text-muted">Total</div><div id="ome-summary-total" style="font-weight:800;color:var(--maroon)">\u20B10.00</div></div>'
      + '</div>'
      + '<div class="form-group" style="margin-top:10px;margin-bottom:0"><label>Plate Note <span class="text-xs text-muted">(auto-filled, editable)</span></label>'
      + '<input id="ome-plate-note" class="form-control" value="' + (o.plate_note || '') + '"></div>'
      + '</div>'
      + '<div class="form-row-3"><div class="form-group"><label>Total Amount</label><input id="ome-total" type="number" class="form-control" value="' + (o.total_amount || 0) + '" oninput="omEditCalcBalance()" style="font-weight:700"></div>'
      + '<div class="form-group"><label>Downpayment</label><input id="ome-down" type="number" class="form-control" value="' + (o.downpayment || 0) + '" oninput="omEditCalcBalance()"></div>'
      + '<div class="form-group"><label>Balance</label><input id="ome-balance" type="number" class="form-control" readonly style="background:var(--cream)" value="' + (o.balance || 0) + '"></div></div>'
      + '<div class="form-row-2"><div class="form-group"><label>Pay Mode</label><div class="form-select-wrap"><select id="ome-mop" class="form-control">'
      + '<option value="Cash" ' + (o.payment_mode === 'Cash' ? 'selected' : '') + '>Cash</option>'
      + '<option value="GCash" ' + (o.payment_mode === 'GCash' ? 'selected' : '') + '>GCash</option>'
      + '</select></div></div>'
      + '<div class="form-group"><label>Pay Status</label><div class="form-select-wrap"><select id="ome-pay-status" class="form-control">'
      + '<option value="Pending" ' + (o.payment_status === 'Pending' ? 'selected' : '') + '>Pending</option>'
      + '<option value="30%" ' + (o.payment_status === '30%' ? 'selected' : '') + '>30%</option>'
      + '<option value="Partial" ' + (o.payment_status === 'Partial' ? 'selected' : '') + '>Partial</option>'
      + '<option value="Fully Paid" ' + (o.payment_status === 'Fully Paid' ? 'selected' : '') + '>Fully Paid</option>'
      + '</select></div></div></div>' : '')
    + '<div class="form-row-2"><div class="form-group"><label>Due Date</label><input id="ome-due" type="date" class="form-control" value="' + (o.due_date || '') + '"></div>'
    + '<div class="form-group"><label>Order Status</label>'
    + (omIsAdminUser(_u)
      ? (function () {
        var allowed = omNextAllowedStatuses(o.status);
        var statusLabels = { pending: 'Pending', approved: 'Approved', production: 'In Production', dispatch: 'Dispatch', completed: 'Completed' };
        return '<div class="form-select-wrap"><select id="ome-status" class="form-control">'
          + allowed.map(function (st) { return '<option value="' + st + '"' + (o.status === st ? ' selected' : '') + '>' + (statusLabels[st] || st) + '</option>'; }).join('')
          + '</select></div><div style="font-size:11px;color:var(--ink-50);margin-top:3px">⚠ Status can only move forward. Override logged.</div>';
      })()
      : '<input id="ome-status" class="form-control" value="' + (omDisplayStatus(o) === 'for_qc' ? 'For QC' : (o.status || 'pending')) + '" readonly style="background:var(--cream)">')
    + '</div></div>'
    + '<div class="form-group"><label>Notes</label><textarea id="ome-notes" class="form-control" rows="2">' + (o.notes || '') + '</textarea></div>'
    + '<div class="form-group"><label>Upload Additional Logo(s)</label><input id="ome-logo-files" type="file" class="form-control" multiple accept="image/*,.pdf,.ai,.eps,.svg"></div>'
    + '</div>'
    + '<div class="modal-footer"><button class="btn btn-outline" onclick="closeModal()">Cancel</button><button class="btn btn-maroon" onclick="omSaveEditOrder(\'' + o.id + '\')">Save Changes</button></div>');

  // Run initial calc to populate summary with current values
  setTimeout(function () { omEditCalcTotal(); }, 30);
}

function omEditCalcBalance() {
  var total = parseFloat((document.getElementById('ome-total') || {}).value) || 0;
  var down = parseFloat((document.getElementById('ome-down') || {}).value) || 0;
  var balEl = document.getElementById('ome-balance');
  if (balEl) balEl.value = Math.max(0, total - down).toFixed(2);
}

// Full recalc for edit modal — mirrors omCalcTotal() but reads ome- fields
function omEditCalcTotal() {
  function gv(id) { var el = document.getElementById(id); return el ? el.value : ''; }
  function sv(id, v) { var el = document.getElementById(id); if (el) el.value = v; }
  function st(id, v) { var el = document.getElementById(id); if (el) el.textContent = v; }

  var qty = parseInt(gv('ome-qty')) || 0;
  var unitPrice = parseFloat(gv('ome-unit-price')) || 0;
  var productFee = parseFloat(gv('ome-product-fee')) || 0;
  var custType = gv('ome-cust-type');
  var newLogo = gv('ome-new-logo') === '1';

  var productsSub = qty * unitPrice;

  var plateCharge = 0;
  var plateNote = '';
  if (custType === 'new') {
    plateCharge = productFee + OM_PLATE_PER_COLOR;
    plateNote = 'New plate \u2014 \u20B1' + omFmt(productFee) + ' product fee + \u20B1' + OM_PLATE_PER_COLOR + ' plate charge';
  } else if (newLogo) {
    plateCharge = productFee + OM_PLATE_PER_COLOR;
    plateNote = 'New logo \u2014 \u20B1' + omFmt(productFee) + ' product fee + \u20B1' + OM_PLATE_PER_COLOR + ' plate charge';
  } else {
    plateCharge = 0;
    plateNote = 'Re-use existing plate';
  }

  var discountAmt = 0;
  if (productsSub >= OM_DISCOUNT_THRESHOLD) {
    discountAmt = Math.round(productsSub * OM_DISCOUNT_RATE * 100) / 100;
  }

  var total = Math.max(0, productsSub + plateCharge - discountAmt);

  // Update summary display
  st('ome-summary-products', '\u20B1' + omFmt(productsSub));
  st('ome-summary-plate', '\u20B1' + omFmt(plateCharge));
  st('ome-summary-discount', '- \u20B1' + omFmt(discountAmt));
  st('ome-summary-total', '\u20B1' + omFmt(total));

  // Auto-fill plate note (but only if it hasn't been manually edited yet)
  sv('ome-plate-note', plateNote);

  // Push computed total into total field and recalc balance
  sv('ome-total', total.toFixed(2));
  omEditCalcBalance();
}

function omSaveEditOrder(orderId) {
  var _u = getState().currentUser;
  if (!_u || !['admin', 'cashier', 'print'].includes(normalizeRole(_u.role))) { showToast('Only the Main Admin, Cashier, or Production Personnel can save project updates.', 'error'); return; }
  var _isPrintSave = _u && normalizeRole(_u.role) === 'print';
  var orders = getOrders();
  var o = orders.find(function (x) { return String(x.id) === String(orderId); });
  if (!o) return;
  if (omIsCashierUser(_u) && o.status === 'completed') { showToast('Completed orders are view-only for Cashier.', 'error'); return; }
  var prevStatus = o.status;
  function gv(id) { var el = document.getElementById(id); return el ? el.value : ''; }
  // Print personnel can only update: status, due date, print color, notes
  // Admin can update everything
  if (!_isPrintSave) {
    o.customer_name = gv('ome-business') || o.customer_name;
    o.contact_person = gv('ome-contact');
    o.phone = gv('ome-phone'); o.email = gv('ome-email'); o.address = gv('ome-address');
    o.product_category = gv('ome-prod-cat'); o.product_type = gv('ome-prod-type');
    o.quantity = parseInt(gv('ome-qty')) || o.quantity;
    o.unit_price = parseFloat(gv('ome-unit-price')) || o.unit_price || 0;
    o.product_fee = parseFloat(gv('ome-product-fee')) || 0;
    o.customer_type = gv('ome-cust-type') || o.customer_type;
    var productsSub = o.quantity * o.unit_price;
    var newLogo = gv('ome-new-logo') === '1';
    o.plate_charge = (o.customer_type === 'new' || newLogo) ? (o.product_fee + OM_PLATE_PER_COLOR) : 0;
    o.discount_amount = productsSub >= OM_DISCOUNT_THRESHOLD ? Math.round(productsSub * OM_DISCOUNT_RATE * 100) / 100 : 0;
    o.plate_note = gv('ome-plate-note');
    o.total_amount = parseFloat(gv('ome-total')) || 0;
    o.downpayment = parseFloat(gv('ome-down')) || 0;
    o.balance = parseFloat(gv('ome-balance')) || 0;
    o.payment_mode = gv('ome-mop'); o.payment_status = gv('ome-pay-status');
  }
  o.print_color = gv('ome-print-color');
  o.due_date = gv('ome-due'); o.notes = gv('ome-notes');
  if (omIsAdminUser(_u)) {
    var newStatus = gv('ome-status') || o.status;
    var allowedNext = omNextAllowedStatuses(prevStatus);
    if (newStatus !== prevStatus && allowedNext.indexOf(newStatus) === -1) {
      showToast('Status can only move forward: ' + prevStatus + ' → ' + allowedNext.filter(function (s) { return s !== prevStatus; }).join(', '), 'error');
      return;
    }
    if (newStatus !== prevStatus) {
      var s2 = getState();
      recordAudit(s2, { action: 'admin_status_override', message: 'Admin changed Order #' + orderId + ' status: ' + prevStatus + ' → ' + newStatus, referenceId: String(orderId), meta: { from: prevStatus, to: newStatus, by: _u.id } });
      saveState(s2);
    }
    if (newStatus === 'dispatch' && omQcState(o) !== 'passed') {
      showToast('Only QC-passed jobs can be set to dispatch.', 'error');
      return;
    }
    if (newStatus === 'completed' && !omIsDispatchReady(o) && prevStatus !== 'completed') {
      showToast('Only QC-passed dispatch jobs can be completed.', 'error');
      return;
    }
    o.status = newStatus;
  }
  o.updated_at = new Date().toISOString();
  saveOrders(orders);
  DB.updateOrder(o.id, o);
  omSyncDispatchPaymentStatus(o.id, o.payment_status, o.balance);

  // FIX: If order was just marked completed via edit, trigger stock deduction & receipt push
  if (o.status === 'completed' && prevStatus !== 'completed') {
    omDeductOrderStock(o.id);
    omPushToReceiptHistory(o.id);
  }

  // Logo upload removed
  if (false) {
    var logos = [];
    saveLogoUploads(logos);
  }
  closeModal(); showToast('Order updated!', 'success'); renderOrders();
}

function omMoveToProduction(orderId) {
  var _u = getState().currentUser; if (!_u || !['admin', 'print'].includes(normalizeRole(_u.role))) { showToast('Only the Main Admin or Production Personnel can move jobs to production.', 'error'); return; }
  var orders = getOrders();
  var o = orders.find(function (x) { return String(x.id) === String(orderId); });
  if (!o) return;
  if (!omCanAdvanceToProduction(o)) { showToast('Order must be approved by Admin before starting production.', 'error'); return; }
  o.status = 'production'; saveOrders(orders); DB.updateOrder(o.id, { status: 'production' });
  showToast('Order moved to production.', 'success'); renderOrders();
}

function omMoveToDispatch(orderId) {
  var _u = getState().currentUser; if (!_u || !['admin', 'print'].includes(normalizeRole(_u.role))) { showToast('Only the Main Admin or Production Personnel can move jobs to dispatch.', 'error'); return; }
  var orders = getOrders();
  var o = orders.find(function (x) { return String(x.id) === String(orderId); });
  if (!o) return;
  if (!omCanMoveToForQc(o)) { showToast('Only jobs in production can be moved forward.', 'error'); return; }
  o.qc_status = 'for_qc';
  saveOrders(orders);
  DB.updateOrder(o.id, { status: 'production', qc_status: 'for_qc' });
  showToast('Order forwarded to QC.', 'success'); renderOrders();
}

// CUSTOMER RECORD MODALS
function omNewCustomerModal() {
  var _u = getState().currentUser;
  if (!_u || !['admin', 'cashier'].includes(normalizeRole(_u.role))) { showToast('Only the Main Admin or Cashier can add project customers.', 'error'); return; }
  showModal(
    '<div class="modal-header" style="border-bottom:none;padding-bottom:0">'
    + '<button class="btn-close-modal" onclick="closeModal()" style="margin-left:auto">&#x2715;</button></div>'
    + '<div style="background:linear-gradient(135deg,var(--maroon) 0%,#a02040 100%);padding:20px 24px;margin:-8px 0 0">'
    + '<div style="display:flex;align-items:center;gap:14px">'
    + '<div style="width:44px;height:44px;border-radius:50%;background:rgba(255,255,255,0.2);display:flex;align-items:center;justify-content:center;font-size:22px;color:#fff;flex-shrink:0;border:2px solid rgba(255,255,255,0.3)">+</div>'
    + '<div><div style="font-size:16px;font-weight:700;color:#fff">New OM Client</div>'
    + '<div style="font-size:12px;color:rgba(255,255,255,0.7)">\uD83D\uDCCB Order Management Customer</div></div>'
    + '</div></div>'
    + '<div class="modal-body" style="padding:20px 24px">'
    + '<div class="form-row-2">'
    + '<div class="form-group"><label>Business / Client Name <span style="color:var(--danger)">*</span></label><input id="omcr-business" class="form-control" placeholder="e.g. Juan dela Cruz or ABC Corp"></div>'
    + '<div class="form-group"><label>Contact Person</label><input id="omcr-contact" class="form-control" placeholder="Person to contact"></div>'
    + '</div>'
    + '<div class="form-row-2">'
    + '<div class="form-group"><label>Phone</label><input id="omcr-phone" class="form-control" placeholder="0917-xxx-xxxx"></div>'
    + '<div class="form-group"><label>Email</label><input id="omcr-email" class="form-control" placeholder="email@example.com"></div>'
    + '</div>'
    + '<div class="form-group"><label>Address</label><input id="omcr-address" class="form-control" placeholder="Street, City"></div>'
    + '<div class="form-row-2">'
    + '<div class="form-group"><label>Mode of Payment</label><div class="form-select-wrap"><select id="omcr-mop" class="form-control"><option value="Cash">Cash</option><option value="GCash">GCash</option><option value="Cash+GCash">Cash + GCash</option><option value="Bank Transfer">Bank Transfer</option></select></div></div>'
    + '<div class="form-group"><label>Mode of Delivery</label><input id="omcr-mod" class="form-control" value="Pickup" readonly style="background:var(--cream);cursor:not-allowed;color:var(--ink-60)"></div>'
    + '</div>'
    + '<div class="form-group"><label>Branch Staff in Charge</label><input id="omcr-staff" class="form-control" placeholder="Name of assigned staff"></div>'
    + '<div class="form-group"><label>Notes</label><textarea id="omcr-notes" class="form-control" rows="2" placeholder="Any additional info..."></textarea></div>'
    + '</div>'
    + '<div class="modal-footer">'
    + '<button class="btn btn-outline" onclick="closeModal()">Cancel</button>'
    + '<button class="btn btn-maroon" onclick="omSaveCustomerRecord()">Save Customer</button>'
    + '</div>'
  );
}

function omSaveCustomerRecord() {
  var _u = getState().currentUser;
  if (!_u || !['admin', 'cashier'].includes(normalizeRole(_u.role))) { showToast('Only the Main Admin or Cashier can save project customers.', 'error'); return; }
  function gv(id) { var el = document.getElementById(id); return el ? el.value : ''; }
  var businessName = gv('omcr-business').trim();
  if (!businessName) { showToast('Business name is required.', 'error'); return; }
  var newCR = { id: omGenId('CR'), businessName: businessName, contactPerson: gv('omcr-contact'), phone: gv('omcr-phone'), email: gv('omcr-email'), address: gv('omcr-address'), modeOfPayment: gv('omcr-mop'), modeOfDelivery: gv('omcr-mod'), branchStaff: gv('omcr-staff'), notes: gv('omcr-notes'), createdAt: new Date().toISOString() };
  var crs = getCustomerRecords();
  crs.push(newCR);
  saveCustomerRecords(crs);
  var s = getState();
  var u = s.currentUser;
  // Save to dedicated OM customers endpoint (independent from POS customers)
  DB.saveOMCustomer({
    id: newCR.id,
    businessName: newCR.businessName,
    contactPerson: newCR.contactPerson || '',
    phone: newCR.phone || '',
    email: newCR.email || '',
    address: newCR.address || '',
    modeOfPayment: newCR.modeOfPayment || '',
    modeOfDelivery: newCR.modeOfDelivery || '',
    branchStaff: newCR.branchStaff || '',
    notes: newCR.notes || '',
    branchId: (u && u.role !== 'admin') ? (u.branchId || null) : null,
    createdAt: newCR.createdAt,
  });
  closeModal(); showToast('Customer record saved!', 'success');
  if (currentPage === 'customer-records') { renderCustomerRecordsManagement(); } else { _omTab = 'orders'; renderOrders(); }
}

function omEditCustomerModal(customerId) {
  var crs = getCustomerRecords();
  var c = crs.find(function (x) { return x.id === customerId; });
  if (!c) return;
  var displayName = c.businessName || c.contactPerson || 'Unknown';
  var initials = displayName.split(' ').slice(0, 2).map(function (w) { return w[0] || ''; }).join('').toUpperCase() || '?';
  showModal(
    '<div class="modal-header" style="border-bottom:none;padding-bottom:0">'
    + '<button class="btn-close-modal" onclick="closeModal()" style="margin-left:auto">&#x2715;</button></div>'
    + '<div style="background:linear-gradient(135deg,var(--maroon) 0%,#a02040 100%);padding:20px 24px;margin:-8px 0 0">'
    + '<div style="display:flex;align-items:center;gap:14px">'
    + '<div style="width:44px;height:44px;border-radius:50%;background:rgba(255,255,255,0.2);display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:800;color:#fff;flex-shrink:0;border:2px solid rgba(255,255,255,0.3)">' + initials + '</div>'
    + '<div><div style="font-size:16px;font-weight:700;color:#fff">' + omEsc(displayName) + '</div>'
    + '<div style="font-size:12px;color:rgba(255,255,255,0.7)">\uD83D\uDCCB Edit OM Client</div></div>'
    + '</div></div>'
    + '<div class="modal-body" style="padding:20px 24px">'
    + '<div class="form-row-2">'
    + '<div class="form-group"><label>Business / Client Name <span style="color:var(--danger)">*</span></label><input id="omce-business" class="form-control" value="' + omEsc(c.businessName || '') + '"></div>'
    + '<div class="form-group"><label>Contact Person</label><input id="omce-contact" class="form-control" value="' + omEsc(c.contactPerson || '') + '"></div>'
    + '</div>'
    + '<div class="form-row-2">'
    + '<div class="form-group"><label>Phone</label><input id="omce-phone" class="form-control" value="' + omEsc(c.phone || '') + '"></div>'
    + '<div class="form-group"><label>Email</label><input id="omce-email" class="form-control" value="' + omEsc(c.email || '') + '"></div>'
    + '</div>'
    + '<div class="form-group"><label>Address</label><input id="omce-address" class="form-control" value="' + omEsc(c.address || '') + '"></div>'
    + '<div class="form-row-2">'
    + '<div class="form-group"><label>Mode of Payment</label><div class="form-select-wrap"><select id="omce-mop" class="form-control">'
    + '<option value="Cash"' + (c.modeOfPayment === 'Cash' ? ' selected' : '') + '>Cash</option>'
    + '<option value="GCash"' + (c.modeOfPayment === 'GCash' ? ' selected' : '') + '>GCash</option>'
    + '<option value="Cash+GCash"' + (c.modeOfPayment === 'Cash+GCash' ? ' selected' : '') + '>Cash + GCash</option>'
    + '<option value="Bank Transfer"' + (c.modeOfPayment === 'Bank Transfer' ? ' selected' : '') + '>Bank Transfer</option>'
    + '</select></div></div>'
    + '<div class="form-group"><label>Mode of Delivery</label><input id="omce-mod" class="form-control" value="Pickup" readonly style="background:var(--cream);cursor:not-allowed;color:var(--ink-60)"></div>'
    + '</div>'
    + '<div class="form-group"><label>Branch Staff in Charge</label><input id="omce-staff" class="form-control" value="' + omEsc(c.branchStaff || '') + '"></div>'
    + '<div class="form-group"><label>Notes</label><textarea id="omce-notes" class="form-control" rows="2">' + omEsc(c.notes || '') + '</textarea></div>'
    + '</div>'
    + '<div class="modal-footer">'
    + '<button class="btn btn-outline" onclick="closeModal()">Cancel</button>'
    + '<button class="btn btn-maroon" onclick="omConfirmEditCustomer(\'' + customerId + '\')">Save Changes</button>'
    + '</div>'
  );
}

function omConfirmEditCustomer(customerId) {
  var crs = getCustomerRecords();
  var c = crs.find(function (x) { return x.id === customerId; });
  if (!c) return;
  function gv(id) { var el = document.getElementById(id); return el ? el.value : ''; }
  c.businessName = gv('omce-business'); c.contactPerson = gv('omce-contact'); c.phone = gv('omce-phone');
  c.email = gv('omce-email'); c.address = gv('omce-address'); c.modeOfPayment = gv('omce-mop');
  c.modeOfDelivery = gv('omce-mod'); c.branchStaff = gv('omce-staff'); c.notes = gv('omce-notes');
  c.updatedAt = new Date().toISOString();
  saveCustomerRecords(crs); closeModal(); showToast('Customer updated!', 'success');
  if (currentPage === 'customer-records') { renderCustomerRecordsManagement(); } else { renderOrders(); }
}

function omDeleteCustomer(customerId) {
  confirmModal({
    title: 'Delete Customer Record',
    message: 'Are you sure you want to delete this customer record? Their existing orders will remain unaffected.',
    confirmText: 'Delete Customer',
    icon: '👤',
    onConfirm: function () {
      saveCustomerRecords(getCustomerRecords().filter(function (c) { return c.id !== customerId; }));
      DB.deleteOMCustomer(customerId);
      showToast('Customer deleted.', 'warning'); renderOrders();
    }
  });
}

// PAYMENT MODALS
function omNewPaymentModal() {
  var _u = getState().currentUser;
  if (!_u || !omCanManagePayments(_u)) { showToast('Only the Main Admin or Cashier can record payments.', 'error'); return; }
  var orders = getOrders().filter(function (o) { return o.status !== 'cancelled'; });
  var orderOptions = orders.map(function (o) { return '<option value="' + o.id + '">#' + String(o.id).padStart(6, '0') + ' \u2014 ' + o.customer_name + '</option>'; }).join('');

  showModal('<div class="modal-header"><h2>' + iconSvg('money') + ' Record Payment</h2><button class="btn-close-modal" onclick="closeModal()">\u2715</button></div>'
    + '<div class="modal-body">'
    + '<div class="form-row-2"><div class="form-group"><label>Select Order <span style="color:var(--danger)">*</span></label><div class="form-select-wrap"><select id="ompay-order" class="form-control" onchange="omAutofillPayment(this.value)"><option value="">\u2014 Select Order \u2014</option>' + orderOptions + '</select></div></div>'
    + '<div class="form-group"><label>Date</label><input id="ompay-date" type="date" class="form-control" value="' + new Date().toISOString().slice(0, 10) + '"></div></div>'
    + '<div class="form-row-2"><div class="form-group"><label>Business Name</label><input id="ompay-business" class="form-control" readonly style="background:var(--cream)"></div>'
    + '<div class="form-group"><label>Contact Person</label><input id="ompay-contact" class="form-control" readonly style="background:var(--cream)"></div></div>'
    + '<div class="form-row-3"><div class="form-group"><label>Order Total</label><input id="ompay-total" type="number" class="form-control" readonly style="background:var(--cream)"></div>'
    + '<div class="form-group"><label>Payment Amount</label><input id="ompay-amount" type="number" class="form-control" min="0" value="0" oninput="omCalcNewBalance()"></div>'
    + '<div class="form-group"><label>Remaining Balance</label><input id="ompay-newbal" type="number" class="form-control" readonly style="background:var(--cream)"></div></div>'
    + '<div class="form-row-2"><div class="form-group"><label>Mode of Payment</label><div class="form-select-wrap"><select id="ompay-mop" class="form-control"><option value="Cash">Cash</option><option value="GCash">GCash</option><option value="Cash+GCash">Cash + GCash</option><option value="Bank Transfer">Bank Transfer</option></select></div></div>'
    + '<div class="form-group"><label>Payment Status</label><div class="form-select-wrap"><select id="ompay-status" class="form-control"><option value="Pending">Pending</option><option value="30%">30%</option><option value="Partial">Partial</option><option value="Fully Paid">Fully Paid</option></select></div></div></div>'
    + '<div class="form-group"><label>Note</label><input id="ompay-note" class="form-control" placeholder="Optional note"></div>'
    + '</div>'
    + '<div class="modal-footer"><button class="btn btn-outline" onclick="closeModal()">Cancel</button><button class="btn btn-maroon" onclick="omSavePayment()">Record Payment</button></div>');
}

function omAutofillPayment(orderId) {
  var o = getOrders().find(function (x) { return String(x.id) === String(orderId); });
  if (!o) return;
  function sv(id, v) { var el = document.getElementById(id); if (el) el.value = v || ''; }
  sv('ompay-business', o.customer_name); sv('ompay-contact', o.contact_person);
  sv('ompay-total', o.total_amount || 0); sv('ompay-amount', o.balance || 0); sv('ompay-newbal', 0);
}

function omCalcNewBalance() {
  var orderId = (document.getElementById('ompay-order') || { value: '' }).value;
  var o = orderId ? getOrders().find(function (x) { return String(x.id) === String(orderId); }) : null;
  var total = parseFloat((document.getElementById('ompay-total') || {}).value) || 0;
  var amount = parseFloat((document.getElementById('ompay-amount') || {}).value) || 0;
  var alreadyPaid = o ? (o.downpayment || 0) : 0;
  var el = document.getElementById('ompay-newbal');
  if (el) el.value = Math.max(0, total - alreadyPaid - amount).toFixed(2);
}

function omSavePayment() {
  var _u = getState().currentUser;
  if (!_u || !['admin', 'cashier'].includes(normalizeRole(_u.role))) { showToast('Only the Main Admin or Cashier can record payments.', 'error'); return; }
  function gv(id) { var el = document.getElementById(id); return el ? el.value : ''; }
  var orderId = gv('ompay-order');
  if (!orderId) { showToast('Select an order.', 'error'); return; }
  var amount = parseFloat(gv('ompay-amount')) || 0;
  if (amount <= 0) { showToast('Payment amount must be greater than 0.', 'error'); return; }

  var orders = getOrders();
  var o = orders.find(function (x) { return String(x.id) === String(orderId); });
  if (!o) return;
  o.downpayment = (o.downpayment || 0) + amount;
  o.balance = Math.max(0, (o.total_amount || 0) - o.downpayment);
  o.payment_mode = gv('ompay-mop');
  // FIX 1: Auto-derive payment_status from actual balance instead of trusting the dropdown
  // (prevents staff from manually setting "Fully Paid" when balance still exists)
  o.payment_status = o.balance === 0 ? 'Fully Paid' : (o.downpayment > 0 ? 'Partial' : 'Pending');
  saveOrders(orders);

  var payments = getPaymentRecords();
  var newPay = { id: omGenId('pay'), orderId: o.id, orderNumber: o.id, customerId: o.customer_record_id || '', businessName: o.customer_name, contactPerson: o.contact_person || '', totalAmount: o.total_amount || 0, downpayment: o.downpayment, balance: o.balance, modeOfPayment: o.payment_mode, paymentStatus: o.payment_status, amountPaid: amount, date: new Date().toISOString(), note: gv('ompay-note') };
  payments.push(newPay);
  savePaymentRecords(payments);
  omSyncDispatchPaymentStatus(o.id, o.payment_status, o.balance);
  // Persist payment record and updated order figures to the server
  DB.saveOrderPayment({
    id: newPay.id, orderId: o.id, customerId: o.customer_record_id || '',
    businessName: o.customer_name, contactPerson: o.contact_person || '',
    totalAmount: o.total_amount || 0, downpayment: o.downpayment, balance: o.balance,
    modeOfPayment: o.payment_mode, paymentStatus: o.payment_status,
    note: newPay.note, date: newPay.date,
  }).catch(function (e) { console.error('[DB] saveOrderPayment failed:', e.message); });
  DB.updateOrder(o.id, { downpayment: o.downpayment, balance: o.balance, payment_status: o.payment_status, payment_mode: o.payment_mode });
  // Also try pushing to receipt history if order is now fully paid and completed
  omPushToReceiptHistory(o.id);
  closeModal(); showToast('Payment recorded!', 'success'); _omTab = 'payment'; renderOrders();
}

function omUpdatePaymentModal(paymentId) {
  var p = getPaymentRecords().find(function (x) { return x.id === paymentId; });
  if (!p) return;
  var o = getOrders().find(function (x) { return String(x.id) === String(p.orderId); });
  if (!o) { showToast('Order not found.', 'error'); return; }

  showModal('<div class="modal-header"><h2>' + iconSvg('money') + ' Add Payment \u2014 Order #' + String(p.orderNumber || '').padStart(6, '0') + '</h2><button class="btn-close-modal" onclick="closeModal()">\u2715</button></div>'
    + '<div class="modal-body">'
    + '<div class="shift-summary-grid" style="grid-template-columns:repeat(3,1fr);margin-bottom:16px">'
    + '<div class="shift-summary-item"><div class="shift-summary-label">Order Total</div><div class="shift-summary-value">\u20B1' + omFmt(p.totalAmount) + '</div></div>'
    + '<div class="shift-summary-item"><div class="shift-summary-label">Already Paid</div><div class="shift-summary-value positive">\u20B1' + omFmt(o.downpayment || 0) + '</div></div>'
    + '<div class="shift-summary-item"><div class="shift-summary-label">Balance Due</div><div class="shift-summary-value negative">\u20B1' + omFmt(o.balance || 0) + '</div></div>'
    + '</div>'
    + '<div class="form-row-2"><div class="form-group"><label>Payment Amount</label><input id="omupdpay-amount" type="number" class="form-control" value="' + (o.balance || 0) + '" min="0"></div>'
    + '<div class="form-group"><label>Mode of Payment</label><div class="form-select-wrap"><select id="omupdpay-mop" class="form-control"><option value="Cash">Cash</option><option value="GCash">GCash</option></select></div></div></div>'
    + '<div class="form-group"><label>Note</label><input id="omupdpay-note" class="form-control" placeholder="Optional note"></div>'
    + '</div>'
    + '<div class="modal-footer"><button class="btn btn-outline" onclick="closeModal()">Cancel</button><button class="btn btn-maroon" onclick="omConfirmUpdatePayment(\'' + p.orderId + '\',\'' + paymentId + '\')">Record Payment</button></div>');
}

function omConfirmUpdatePayment(orderId, paymentId) {
  var _u = getState().currentUser;
  if (!_u || !['admin', 'cashier'].includes(normalizeRole(_u.role))) { showToast('Only the Main Admin or Cashier can update payments.', 'error'); return; }
  var amount = parseFloat((document.getElementById('omupdpay-amount') || { value: '0' }).value) || 0;
  if (amount <= 0) { showToast('Enter a valid amount.', 'error'); return; }
  var orders = getOrders();
  var o = orders.find(function (x) { return String(x.id) === String(orderId); });
  if (!o) return;
  o.downpayment = (o.downpayment || 0) + amount;
  o.balance = Math.max(0, (o.total_amount || 0) - o.downpayment);
  o.payment_mode = (document.getElementById('omupdpay-mop') || { value: 'Cash' }).value;
  o.payment_status = o.balance === 0 ? 'Fully Paid' : 'Partial';
  saveOrders(orders);
  var payments = getPaymentRecords();
  var newPay2 = { id: omGenId('pay'), orderId: o.id, orderNumber: o.id, customerId: o.customer_record_id || '', businessName: o.customer_name, contactPerson: o.contact_person || '', totalAmount: o.total_amount || 0, downpayment: o.downpayment, balance: o.balance, modeOfPayment: o.payment_mode, paymentStatus: o.payment_status, amountPaid: amount, date: new Date().toISOString(), note: (document.getElementById('omupdpay-note') || { value: '' }).value };
  payments.push(newPay2);
  savePaymentRecords(payments);
  omSyncDispatchPaymentStatus(o.id, o.payment_status, o.balance);
  // Persist payment record and updated order figures to the server
  DB.saveOrderPayment({
    id: newPay2.id, orderId: o.id, customerId: o.customer_record_id || '',
    businessName: o.customer_name, contactPerson: o.contact_person || '',
    totalAmount: o.total_amount || 0, downpayment: o.downpayment, balance: o.balance,
    modeOfPayment: o.payment_mode, paymentStatus: o.payment_status,
    note: newPay2.note, date: newPay2.date,
  }).catch(function (e) { console.error('[DB] saveOrderPayment failed:', e.message); });
  DB.updateOrder(o.id, { downpayment: o.downpayment, balance: o.balance, payment_status: o.payment_status, payment_mode: o.payment_mode });
  // Push to receipt history if order is now fully paid and completed
  omPushToReceiptHistory(o.id);
  closeModal(); showToast('Payment updated!', 'success'); renderOrders();
}

function omPrintReceipt(paymentId) {
  var p = getPaymentRecords().find(function (x) { return x.id === paymentId; });
  if (!p) return;
  var w = window.open('', '_blank', 'width=400,height=600');
  w.document.write('<!DOCTYPE html><html><head><title>Receipt</title><style>body{font-family:monospace;padding:20px;max-width:320px;margin:0 auto}h2{text-align:center}hr{border:none;border-top:1px dashed #999}table{width:100%}td{padding:4px 0}.footer{text-align:center;font-size:11px;margin-top:16px}</style></head><body>'
    + '<h2>SOUTH PAFPS</h2><p style="text-align:center">Packaging Supplies</p><hr>'
    + '<p>Receipt #' + p.id.slice(-8).toUpperCase() + '</p><p>Date: ' + new Date(p.date).toLocaleDateString() + '</p><hr>'
    + '<p><strong>' + (p.businessName || 'Customer') + '</strong></p><p>' + (p.contactPerson || '') + '</p><hr>'
    + '<table><tr><td>Order #</td><td style="text-align:right">#' + String(p.orderNumber || '').padStart(6, '0') + '</td></tr>'
    + '<tr><td>Total</td><td style="text-align:right">\u20B1' + omFmt(p.totalAmount) + '</td></tr>'
    + '<tr><td>Amount Paid</td><td style="text-align:right">\u20B1' + omFmt(p.downpayment) + '</td></tr>'
    + '<tr><td>Balance</td><td style="text-align:right">\u20B1' + omFmt(p.balance) + '</td></tr>'
    + '<tr><td>Mode</td><td style="text-align:right">' + (p.modeOfPayment || 'Cash') + '</td></tr></table>'
    + '<hr><p style="text-align:center;font-weight:bold">' + p.paymentStatus + '</p>'
    + '<div class="footer"><p>Thank you for your business!</p><p>South Pafps Packaging Supplies</p></div>'
    + '<scr' + 'ipt>window.onload=function(){window.print()}<\/scr' + 'ipt></body></html>');
  w.document.close();
}

// PRODUCTION MODALS
function omNewProductionModal() {
  var _u = getState().currentUser; if (!_u || !['admin', 'print'].includes(_u.role)) { showToast('Only Print Personnel or Admin can manage production.', 'error'); return; }
  var s = getState();
  var orders = getOrders().filter(function (o) { return o.status === 'pending' || o.status === 'production'; });
  var printPersonnel = s.users.filter(function (u) { return u.role === 'print' || u.role === 'admin'; });
  var orderOptions = orders.map(function (o) { return '<option value="' + o.id + '">#' + String(o.id).padStart(6, '0') + ' \u2014 ' + o.customer_name + '</option>'; }).join('');
  var personnelOptions = printPersonnel.map(function (u) { return '<option value="' + u.name + '">' + u.name + '</option>'; }).join('') + '<option value="Other">Other</option>';

  showModal('<div class="modal-header"><h2>' + iconSvg('printer') + ' Assign to Production</h2><button class="btn-close-modal" onclick="closeModal()">\u2715</button></div>'
    + '<div class="modal-body">'
    + '<div class="form-row-2"><div class="form-group"><label>Select Order <span style="color:var(--danger)">*</span></label><div class="form-select-wrap"><select id="omprod-order" class="form-control" onchange="omAutofillProd(this.value)"><option value="">\u2014 Select Order \u2014</option>' + orderOptions + '</select></div></div>'
    + '<div class="form-group"><label>Assign To <span style="color:var(--danger)">*</span></label><div class="form-select-wrap"><select id="omprod-assign" class="form-control"><option value="">\u2014 Select Personnel \u2014</option>' + personnelOptions + '</select></div></div></div>'
    + '<div id="omprod-info" style="background:var(--cream);border-radius:var(--radius-sm);padding:12px;margin-bottom:12px;display:none"><div style="font-size:13px;color:var(--ink-60)">Customer: <strong id="omprod-cust-name">\u2014</strong> \u00B7 Product: <strong id="omprod-prod-type">\u2014</strong> \u00B7 Qty: <strong id="omprod-qty">\u2014</strong></div></div>'
    + '<div class="form-row-2"><div class="form-group"><label>Progress (%)</label><input id="omprod-progress" type="number" class="form-control" min="0" max="100" value="0"></div>'
    + '<div class="form-group"><label>Status</label><div class="form-select-wrap"><select id="omprod-status" class="form-control"><option value="pending">Pending</option><option value="production" selected>In Production</option><option value="for_qc">For QC</option></select></div></div></div>'
    + '<div class="form-group"><label>Materials Used</label><input id="omprod-materials" class="form-control" placeholder="e.g. 500 sheets, 2 ink cartridges"></div>'
    + '<div class="form-group"><label>Notes</label><textarea id="omprod-notes" class="form-control" rows="2"></textarea></div>'
    + '<div class="form-group"><label>Target / Completion Date</label><input id="omprod-completion" type="date" class="form-control"></div>'
    + '</div>'
    + '<div class="modal-footer"><button class="btn btn-outline" onclick="closeModal()">Cancel</button><button class="btn btn-maroon" onclick="omSaveProduction()">Assign & Start</button></div>');
}

function omAutofillProd(orderId) {
  var o = getOrders().find(function (x) { return String(x.id) === String(orderId); });
  if (!o) return;
  var el = document.getElementById('omprod-info'); if (el) el.style.display = '';
  var cn = document.getElementById('omprod-cust-name'); if (cn) cn.textContent = o.customer_name || '\u2014';
  var pt = document.getElementById('omprod-prod-type'); if (pt) pt.textContent = o.product_type || o.product_category || '\u2014';
  var qq = document.getElementById('omprod-qty'); if (qq) qq.textContent = o.quantity || '\u2014';
}

function omSaveProduction() {
  var _u = getState().currentUser; if (!_u || !['admin', 'print'].includes(_u.role)) { showToast('Only Print Personnel or Admin can manage production.', 'error'); return; }
  function gv(id) { var el = document.getElementById(id); return el ? el.value : ''; }
  var orderId = gv('omprod-order'); var assignedTo = gv('omprod-assign');
  if (!orderId) { showToast('Select an order.', 'error'); return; }
  if (!assignedTo) { showToast('Select printing personnel.', 'error'); return; }
  var orders = getOrders();
  var o = orders.find(function (x) { return String(x.id) === String(orderId); });
  if (!o) return;
  var prodStatus = gv('omprod-status');
  o.status = 'production';
  o.qc_status = prodStatus === 'for_qc' ? 'for_qc' : '';
  saveOrders(orders);

  var prods = getProductionRecords();
  var _mProd = { id: omGenId('prod'), orderId: o.id, orderNumber: o.id, customerId: o.customer_record_id || '', businessName: o.customer_name, orderDate: o.created_at, assignedTo: assignedTo, progress: parseInt(gv('omprod-progress')) || 0, status: prodStatus, materialsUsed: gv('omprod-materials'), notes: gv('omprod-notes'), qcResult: 'Pending', checkCount: 0, completionDate: gv('omprod-completion') || null, createdAt: new Date().toISOString() };
  prods.push(_mProd);
  saveProductionRecords(prods);
  DB.saveProduction(_mProd).catch(function () { });
  // Also sync order status to DB
  DB.updateOrder(o.id, { status: 'production', qc_status: o.qc_status || null });
  closeModal(); showToast('Production record created!', 'success'); _omTab = 'production'; renderOrders();
}


// Wrapper: look up production record by ORDER id (used in Job Management table)
function omUpdateProductionByOrder(orderId) {
  var prods = getProductionRecords();
  var p = prods.find(function (x) { return String(x.orderId) === String(orderId); });
  if (p) {
    omUpdateProductionModal(p.id);
    return;
  }

  // No production record exists yet — offer to create one on the spot
  var orders = getOrders();
  var o = orders.find(function (x) { return String(x.id) === String(orderId); });
  if (!o) { showToast('Order not found.', 'error'); return; }

  var s = getState();
  var staffOptions = (s.users || [])
    .filter(function (u) { return u.role === 'print' || u.role === 'admin'; })
    .map(function (u) { return '<option value="' + u.name + '">' + u.name + '</option>'; }).join('');

  showModal('<div class="modal-header"><h2>' + iconSvg('printer') + ' Start Production Record</h2><button class="btn-close-modal" onclick="closeModal()">✕</button></div>'
    + '<div class="modal-body">'
    + '<div class="alert alert-info" style="margin-bottom:14px">No production record found for Order #'
    + String(o.id).padStart(6, '0') + ' · <strong>' + (o.customer_name || '—') + '</strong>.<br>'
    + '<small>Create one now to start tracking this job.</small></div>'
    + '<div class="form-row-2">'
    + '<div class="form-group"><label>Assigned To</label><div class="form-select-wrap">'
    + '<select id="jm-assigned" class="form-control"><option value="">— Unassigned —</option>' + staffOptions + '</select>'
    + '</div></div>'
    + '<div class="form-group"><label>Initial Status</label><div class="form-select-wrap">'
    + '<select id="jm-status" class="form-control">'
    + '<option value="pending">Pending</option><option value="production" selected>In Production</option><option value="for_qc">For QC</option>'
    + '</select></div></div>'
    + '</div>'
    + '<div class="form-group"><label>Notes</label>'
    + '<textarea id="jm-notes" class="form-control" rows="2" placeholder="Materials, special instructions…"></textarea>'
    + '</div>'
    + '</div>'
    + '<div class="modal-footer">'
    + '<button class="btn btn-outline" onclick="closeModal()">Cancel</button>'
    + '<button class="btn btn-maroon" onclick="_omCreateAndOpenProd(\'' + orderId + '\')">Create &amp; Open</button>'
    + '</div>');
}

// Helper called from the auto-create modal above
function _omCreateAndOpenProd(orderId) {
  var _u = getState().currentUser;
  if (!_u || !['admin', 'print'].includes(normalizeRole(_u.role))) { showToast('Only the Main Admin or Production Personnel can create production records.', 'error'); return; }
  function gv(id) { var el = document.getElementById(id); return el ? el.value : ''; }
  var orders = getOrders();
  var o = orders.find(function (x) { return String(x.id) === String(orderId); });
  if (!o) { closeModal(); showToast('Order not found.', 'error'); return; }

  var status = gv('jm-status') || 'pending';
  var newProd = {
    id: omGenId('prod'),
    orderId: o.id,
    orderNumber: o.id,
    customerId: o.customer_record_id || '',
    businessName: o.customer_name || '',
    orderDate: o.created_at,
    assignedTo: gv('jm-assigned') || '',
    progress: status === 'production' ? 10 : 0,
    status: status,
    materialsUsed: '',
    notes: gv('jm-notes') || '',
    qcResult: 'Pending',
    checkCount: 0,
    completionDate: null,
    createdAt: new Date().toISOString(),
  };

  var prods = getProductionRecords();
  prods.push(newProd);
  saveProductionRecords(prods);
  DB.saveProduction(newProd).catch(function (e) {
    console.warn('[omCreateAndOpenProd] DB.saveProduction failed:', e.message);
  });

  // Sync order status if moving to production
  if ((status === 'production' || status === 'for_qc') && (o.status === 'pending' || o.status === 'production')) {
    o.status = 'production';
    o.qc_status = status === 'for_qc' ? 'for_qc' : '';
    saveOrders(orders);
    DB.updateOrder(o.id, { status: 'production', qc_status: o.qc_status || null });
  }

  closeModal();
  showToast('Production record created!', 'success');
  omUpdateProductionModal(newProd.id);
}

function omUpdateProductionModal(prodId) {
  var _u = getState().currentUser; if (!_u || !['admin', 'print'].includes(_u.role)) { showToast('Only Print Personnel or Admin can update production.', 'error'); return; }
  var p = getProductionRecords().find(function (x) { return x.id === prodId; });
  if (!p) return;
  // Fallback: resolve businessName from the linked order if not stored on prod record
  var _orders = getOrders();
  var _linkedOrder = _orders.find(function (o) { return String(o.id) === String(p.orderId); });
  var displayName = p.businessName || (_linkedOrder && _linkedOrder.customer_name) || '—';
  var displayAssigned = p.assignedTo || '—';
  showModal('<div class="modal-header"><h2>' + iconSvg('printer') + ' Update Production</h2><button class="btn-close-modal" onclick="closeModal()">\u2715</button></div>'
    + '<div class="modal-body">'
    + '<div class="alert alert-info">Order #' + String(p.orderNumber || p.orderId || '').padStart(6, '0') + ' \u00B7 <strong>' + displayName + '</strong> \u00B7 Assigned to: <strong>' + displayAssigned + '</strong></div>'
    + '<div class="form-row-2"><div class="form-group"><label>Progress (%)</label><input id="omupd-progress" type="number" class="form-control" min="0" max="100" value="' + (p.progress || 0) + '"></div>'
    + '<div class="form-group"><label>Status</label><div class="form-select-wrap"><select id="omupd-status" class="form-control" onchange="omUpdAutoProgress(this.value)">'
    + '<option value="pending" ' + (p.status === 'pending' ? 'selected' : '') + '>Pending</option>'
    + '<option value="production" ' + (p.status === 'production' ? 'selected' : '') + '>In Production</option>'
    + '<option value="for_qc" ' + (p.status === 'for_qc' ? 'selected' : '') + '>For QC</option>'
    + '</select></div></div></div>'
    + '<div class="form-group"><label>Materials Used</label><input id="omupd-materials" class="form-control" value="' + (p.materialsUsed || '') + '"></div>'
    + '<div class="form-group"><label>Notes</label><textarea id="omupd-notes" class="form-control" rows="2">' + (p.notes || '') + '</textarea></div>'
    + '<div class="form-group"><label>Completion Date</label><input id="omupd-completion" type="date" class="form-control" value="' + (p.completionDate || '') + '"></div>'
    + '</div>'
    + '<div class="modal-footer"><button class="btn btn-outline" onclick="closeModal()">Cancel</button><button class="btn btn-maroon" onclick="omConfirmUpdateProd(\'' + prodId + '\')">Update</button></div>');
}

// Auto-set progress % when status changes
function omUpdAutoProgress(status) {
  var el = document.getElementById('omupd-progress');
  if (!el) return;
  if (status === 'pending') el.value = 0;
  if (status === 'production') el.value = el.value > 0 ? el.value : 50;
  if (status === 'for_qc') el.value = 100;
}

function omConfirmUpdateProd(prodId) {
  var _u = getState().currentUser; if (!_u || !['admin', 'print'].includes(_u.role)) { showToast('Only Print Personnel or Admin can update production.', 'error'); return; }
  var prods = getProductionRecords();
  var p = prods.find(function (x) { return x.id === prodId; });
  if (!p) return;
  function gv(id) { var el = document.getElementById(id); return el ? el.value : ''; }
  var prevStatus = p.status;
  p.progress = parseInt(gv('omupd-progress')) || 0; p.status = gv('omupd-status');
  p.materialsUsed = gv('omupd-materials'); p.notes = gv('omupd-notes');
  p.completionDate = gv('omupd-completion') || null; p.updatedAt = new Date().toISOString();
  saveProductionRecords(prods);
  // Persist to DB - include notes/materialsUsed
  DB.updateProduction(prodId, { progress: p.progress, qcStatus: p.qcResult, assignedTo: p.assignedTo, materialsUsed: p.materialsUsed, notes: p.notes }).catch(function () { });
  // Sync ORDER status to DB based on production status change
  if (p.status !== prevStatus) {
    var orders = getOrders();
    var o = orders.find(function (x) { return String(x.id) === String(p.orderId); });
    if (o) {
      if (p.status === 'production' && (o.status === 'pending' || o.status === 'production')) {
        o.status = 'production'; saveOrders(orders);
        o.qc_status = '';
        DB.updateOrder(o.id, { status: 'production', qc_status: null });
      } else if (p.status === 'for_qc') {
        o.status = 'production';
        o.qc_status = 'for_qc';
        saveOrders(orders);
        DB.updateOrder(o.id, { status: 'production', qc_status: 'for_qc' });
      }
    }
  }
  closeModal(); showToast('Production updated!', 'success'); renderOrders();
}

function omQCModal(prodId) {
  var _u = getState().currentUser; if (!_u || !['admin', 'print'].includes(_u.role)) { showToast('Only Print Personnel or Admin can perform QC checks.', 'error'); return; }
  var p = getProductionRecords().find(function (x) { return x.id === prodId; });
  if (!p) return;
  showModal('<div class="modal-header"><h2>Quality Control Check</h2><button class="btn-close-modal" onclick="closeModal()">\u2715</button></div>'
    + '<div class="modal-body">'
    + '<div class="alert alert-info">Order #' + String(p.orderNumber || '').padStart(6, '0') + ' \u00B7 <strong>' + p.businessName + '</strong></div>'
    + '<div style="margin-bottom:12px"><strong>Check Count: ' + (p.checkCount || 0) + '</strong></div>'
    + '<div class="form-group"><label>QC Result</label><div style="display:flex;gap:12px;margin-top:8px">'
    + '<button class="btn btn-maroon" style="flex:1;padding:14px" onclick="omSaveQC(\'' + prodId + '\',\'Pass\')">\u2713 PASS</button>'
    + '<button class="btn btn-danger" style="flex:1;padding:14px" onclick="omSaveQC(\'' + prodId + '\',\'Fail\')">\u2717 FAIL</button>'
    + '</div></div>'
    + '<div class="form-group"><label>QC Notes</label><textarea id="omqc-notes" class="form-control" rows="2" placeholder="Describe findings\u2026"></textarea></div>'
    + '</div>'
    + '<div class="modal-footer"><button class="btn btn-outline" onclick="closeModal()">Close</button></div>');
}

// Auto-deduct branch stock when an order is completed
// Push completed+paid OM order into POS Receipt History
function omPushToReceiptHistory(orderId) {
  var orders = getOrders();
  var o = orders.find(function (x) { return String(x.id) === String(orderId); });
  if (!o) return;
  if (o.payment_status !== 'Fully Paid') return;
  var s = getState();
  var saleKey = 'om_order_' + o.id;
  if ((s.sales || []).some(function (x) { return x.id === saleKey; })) return;
  var receiptNo = 'OM-' + String(o.id).padStart(6, '0');
  var sale = {
    id: saleKey,
    source: 'order_management',
    branchId: o.linked_branch_id || (s.currentUser && s.currentUser.branchId) || (s.branches && s.branches[0] && s.branches[0].id) || 'b1',
    userId: s.currentUser && s.currentUser.id,
    customerId: o.customer_record_id || null,
    receiptNo: receiptNo,
    items: [{
      productName: o.product_category || 'Order',
      variantName: o.product_type || ('#' + String(o.id).padStart(6, '0')),
      qty: o.quantity || 1,
      price: o.unit_price || 0,
      subtotal: o.total_amount || 0
    }],
    payments: [{ method: o.payment_mode || 'Cash', amount: o.total_amount || 0 }],
    subtotal: o.total_amount || 0,
    discountAmount: o.discount_amount || 0,
    total: o.total_amount || 0,
    paymentMode: o.payment_mode || 'Cash',
    voided: false,
    voidReason: null,
    omOrderId: o.id,
    omCustomerName: o.customer_name || '',
    omContactPerson: o.contact_person || '',
    omPhone: o.phone || '',
    omProductCategory: o.product_category || '',
    omProductType: o.product_type || '',
    omPlateCharge: o.plate_charge || 0,
    omBalance: o.balance || 0,
    createdAt: o.created_at || new Date().toISOString()
  };
  s.sales = s.sales || [];
  s.sales.push(sale);
  saveState(s);
  // Persist sale to DB so it shows in receipt history after page reload
  DB.saveSale(sale).catch(function (e) { console.error('[DB] Failed to save OM sale to receipt history:', e.message); });
  showToast('Receipt #' + receiptNo + ' added to POS Receipt History!', 'success');
}

function omDeductOrderStock(orderId) {
  var orders = getOrders();
  var o = orders.find(function (x) { return String(x.id) === String(orderId); });
  if (!o || o.stock_deducted || !o.linked_variant_id || !o.linked_branch_id) return;
  var s = getState();
  var found = findProductAndVariantByVariantId(s, o.linked_variant_id);
  if (!found) return;
  var available = (found.variant.branchStocks && found.variant.branchStocks[o.linked_branch_id]) || 0;
  var deductQty = Math.min(o.quantity || 1, available);
  if (deductQty <= 0) {
    showToast('\u26A0\uFE0F No stock to deduct for this order (already 0).', 'warning');
    return;
  }
  adjustVariantBranchStock(found.variant, o.linked_branch_id, -deductQty);
  saveState(s);
  o.stock_deducted = true;
  o.stock_deducted_qty = deductQty;
  o.stock_deducted_at = new Date().toISOString();
  saveOrders(orders);
  showToast('\uD83D\uDCE6 Stock deducted: ' + deductQty + 'x ' + found.variant.name + ' from branch inventory.', 'info');
}

function omSaveQC(prodId, result) {
  var _u = getState().currentUser; if (!_u || !['admin', 'print'].includes(_u.role)) { showToast('Access denied.', 'error'); return; }
  var prods = getProductionRecords();
  var p = prods.find(function (x) { return x.id === prodId; });
  if (!p) return;
  p.qcResult = result; p.checkCount = (p.checkCount || 0) + 1;
  p.qcNotes = (document.getElementById('omqc-notes') || { value: '' }).value;
  p.qcDate = new Date().toISOString();
  if (result === 'Pass') {
    p.status = 'for_qc';
    // Advance the parent order from Production/QC to Dispatch on QC pass
    var qcOrders = getOrders();
    var qcOrder = qcOrders.find(function (x) { return String(x.id) === String(p.orderId); });
    if (qcOrder && qcOrder.status === 'production') {
      qcOrder.status = 'dispatch';
      qcOrder.qc_status = 'passed';
      qcOrder.qc_passed_at = new Date().toISOString();
      saveOrders(qcOrders);
      DB.updateOrder(qcOrder.id, { status: 'dispatch', qc_status: 'passed', qc_passed_at: qcOrder.qc_passed_at });
    }
    // Auto-deduct branch stock on QC pass
    omDeductOrderStock(p.orderId);
    // Push to receipt history if fully paid
    omPushToReceiptHistory(p.orderId);
  } else if (result === 'Fail') {
    var qcOrders2 = getOrders();
    var qcOrder2 = qcOrders2.find(function (x) { return String(x.id) === String(p.orderId); });
    if (qcOrder2) {
      qcOrder2.status = 'production';
      qcOrder2.qc_status = 'failed';
      saveOrders(qcOrders2);
      DB.updateOrder(qcOrder2.id, { status: 'production', qc_status: 'failed', qc_fail_reason: p.qcNotes || '' });
    }
  }
  saveProductionRecords(prods);
  DB.updateProduction(prodId, { qcStatus: result, qcResult: result }).catch(function () { });
  closeModal();
  showToast('QC ' + result + ' recorded.', result === 'Pass' ? 'success' : 'error'); renderOrders();
}

// DISPATCH MODALS
function omNewDispatchModal() {
  var _u = getState().currentUser; if (!_u || !['admin', 'print'].includes(_u.role)) { showToast('Only Print Personnel or Admin can manage dispatch.', 'error'); return; }
  var orders = getOrders().filter(function (o) { return omIsDispatchReady(o); });
  var orderOptions = orders.map(function (o) { return '<option value="' + o.id + '">#' + String(o.id).padStart(6, '0') + ' \u2014 ' + o.customer_name + '</option>'; }).join('');

  showModal('<div class="modal-header"><h2>' + iconSvg('truck') + ' ' + (omCanOverrideDispatch(_u) ? 'Override Dispatch' : 'Schedule Dispatch') + '</h2><button class="btn-close-modal" onclick="closeModal()">\u2715</button></div>'
    + '<div class="modal-body">'
    + (omCanOverrideDispatch(_u) ? '<div class="alert alert-warning" style="margin-bottom:12px">Admin override: dispatch changes from this screen will be logged.</div>' : '')
    + '<div class="form-row-2"><div class="form-group"><label>Select Order <span style="color:var(--danger)">*</span></label><div class="form-select-wrap"><select id="omdisp-order" class="form-control" onchange="omAutofillDispatch(this.value)"><option value="">\u2014 Select Order \u2014</option>' + orderOptions + '</select></div></div>'
    + '<div class="form-group"><label>Date</label><input id="omdisp-date" type="date" class="form-control" value="' + new Date().toISOString().slice(0, 10) + '"></div></div>'
    + '<div id="omdisp-cust-info" style="background:var(--cream);border-radius:var(--radius-sm);padding:12px;margin-bottom:12px;display:none;font-size:13px"><strong id="omdisp-cust-name">\u2014</strong> \u00B7 <span id="omdisp-pay-status-info">\u2014</span><div style="margin-top:4px;font-weight:700" id="omdisp-balance-info"></div></div>'
    + '<div class="form-row-2"><div class="form-group"><label>Dispatch Method</label><input id="omdisp-method" class="form-control" value="Pickup" readonly style="background:var(--cream);cursor:not-allowed;color:var(--ink-60)"></div>'
    + '<div class="form-group"><label>Dispatch Status</label><div class="form-select-wrap"><select id="omdisp-status" class="form-control"><option value="Scheduled">Scheduled</option><option value="Dispatched">Dispatched</option><option value="Delivered">Delivered</option></select></div></div></div>'
    + '<div class="form-group"><label>Customer Notified?</label><div style="display:flex;gap:12px;margin-top:8px">'
    + '<label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="radio" name="omdisp-notified" id="omdisp-notified-yes" value="1"> Yes</label>'
    + '<label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="radio" name="omdisp-notified" id="omdisp-notified-no" value="0" checked> No</label>'
    + '</div></div>'
    + '<div class="form-group"><label>Notes</label><textarea id="omdisp-notes" class="form-control" rows="2"></textarea></div>'
    + '</div>'
    + '<div class="modal-footer"><button class="btn btn-outline" onclick="closeModal()">Cancel</button><button class="btn btn-maroon" onclick="omSaveDispatch()">' + (omCanOverrideDispatch(_u) ? 'Apply Override' : 'Schedule Dispatch') + '</button></div>');
}

function omAutofillDispatch(orderId) {
  var o = getOrders().find(function (x) { return String(x.id) === String(orderId); });
  if (!o) return;
  var infoEl = document.getElementById('omdisp-cust-info'); if (infoEl) infoEl.style.display = '';
  var cnEl = document.getElementById('omdisp-cust-name'); if (cnEl) cnEl.textContent = o.customer_name || '\u2014';
  var psEl = document.getElementById('omdisp-pay-status-info'); if (psEl) psEl.textContent = 'Pay Status: ' + (o.payment_status || '\u2014');
  var balEl = document.getElementById('omdisp-balance-info'); if (balEl) balEl.textContent = (o.balance || 0) > 0 ? '\u26A0\uFE0F Balance Due: \u20B1' + omFmt(o.balance) : '\u2713 Fully Paid';
}

function omSaveDispatch() {
  function gv(id) { var el = document.getElementById(id); return el ? el.value : ''; }
  var _u = getState().currentUser; if (!_u || !['admin', 'print'].includes(_u.role)) { showToast('Only Print Personnel or Admin can manage dispatch.', 'error'); return; }
  var orderId = gv('omdisp-order');
  if (!orderId) { showToast('Select an order.', 'error'); return; }
  var orders = getOrders();
  var o = orders.find(function (x) { return String(x.id) === String(orderId); });
  if (!o) return;
  if (!omIsDispatchReady(o)) { showToast('Only QC-passed orders can be scheduled for dispatch.', 'error'); return; }
  var dispStatus = gv('omdisp-status');
  if (dispStatus === 'Delivered' && (o.balance || 0) > 0) { showToast('Order cannot be completed until payment is fully settled.', 'error'); return; }
  if (dispStatus === 'Delivered') {
    o.status = 'completed'; saveOrders(orders);
    DB.updateOrder(o.id, { status: 'completed', qc_status: 'passed' });
    omDeductOrderStock(o.id);
    omPushToReceiptHistory(o.id);
  } else if (dispStatus === 'Dispatched') {
    o.status = 'dispatch'; saveOrders(orders);
    DB.updateOrder(o.id, { status: 'dispatch', qc_status: 'passed' });
  }
  if (omCanOverrideDispatch(_u)) {
    var s = getState();
    recordAudit(s, { action: 'dispatch_override', message: 'Admin override on dispatch for Order #' + o.id, referenceId: String(o.id), meta: { dispatchStatus: dispStatus } });
    saveState(s);
  }

  var dispatches = getDispatchRecords();
  var existingDisp = dispatches.find(function (d) { return String(d.orderId) === String(o.id); });
  if (existingDisp) {
    existingDisp.dispatchStatus = dispStatus;
    existingDisp.dispatchMethod = gv('omdisp-method');
    existingDisp.date = existingDisp.date || new Date().toISOString();
    existingDisp.customerNotified = !!(document.getElementById('omdisp-notified-yes') || {}).checked;
    existingDisp.paymentStatus = o.payment_status || 'Pending';
    existingDisp.notes = gv('omdisp-notes');
    existingDisp.updatedAt = new Date().toISOString();
    DB.saveDispatch(existingDisp).catch(function () { });
  } else {
    var _newD = { id: omGenId('disp'), orderId: o.id, orderNumber: o.id, customerId: o.customer_record_id || '', businessName: o.customer_name, date: new Date().toISOString(), customerNotified: !!(document.getElementById('omdisp-notified-yes') || {}).checked, paymentStatus: o.payment_status || 'Pending', dispatchMethod: gv('omdisp-method'), dispatchStatus: dispStatus, notes: gv('omdisp-notes'), createdAt: new Date().toISOString() };
    dispatches.push(_newD);
    DB.saveDispatch(_newD).catch(function () { });
  }
  saveDispatchRecords(dispatches);
  closeModal(); showToast(dispStatus === 'Delivered' ? 'Order completed from dispatch.' : 'Dispatch updated!', 'success'); _omTab = 'dispatch'; renderOrders();
}

function omUpdateDispatchModal(dispId) {
  var _u = getState().currentUser; if (!_u || !['admin', 'print'].includes(_u.role)) { showToast('Only Print Personnel or Admin can manage dispatch.', 'error'); return; }
  var d = getDispatchRecords().find(function (x) { return x.id === dispId; });
  if (!d) return;
  showModal('<div class="modal-header"><h2>' + iconSvg('truck') + ' Update Dispatch</h2><button class="btn-close-modal" onclick="closeModal()">\u2715</button></div>'
    + '<div class="modal-body">'
    + '<div class="alert alert-info">Order #' + String(d.orderNumber || '').padStart(6, '0') + ' \u00B7 <strong>' + d.businessName + '</strong></div>'
    + '<div class="form-row-2"><div class="form-group"><label>Dispatch Method</label><input id="omuddisp-method" class="form-control" value="Pickup" readonly style="background:var(--cream);cursor:not-allowed;color:var(--ink-60)"></div>'
    + '<div class="form-group"><label>Dispatch Status</label><div class="form-select-wrap"><select id="omuddisp-status" class="form-control">'
    + '<option value="Scheduled" ' + (d.dispatchStatus === 'Scheduled' ? 'selected' : '') + '>Scheduled</option>'
    + '<option value="Dispatched" ' + (d.dispatchStatus === 'Dispatched' ? 'selected' : '') + '>Dispatched</option>'
    + '<option value="Delivered" ' + (d.dispatchStatus === 'Delivered' ? 'selected' : '') + '>Delivered</option>'
    + '</select></div></div></div>'
    + '<div class="form-group"><label>Customer Notified?</label><div style="display:flex;gap:12px;margin-top:8px">'
    + '<label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="radio" name="omuddisp-notified" id="omuddisp-notified-yes" ' + (d.customerNotified ? 'checked' : '') + ' value="1"> Yes</label>'
    + '<label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="radio" name="omuddisp-notified" id="omuddisp-notified-no" ' + (!d.customerNotified ? 'checked' : '') + ' value="0"> No</label>'
    + '</div></div>'
    + '<div class="form-group"><label>Notes</label><textarea id="omuddisp-notes" class="form-control" rows="2">' + (d.notes || '') + '</textarea></div>'
    + '</div>'
    + '<div class="modal-footer"><button class="btn btn-outline" onclick="closeModal()">Cancel</button><button class="btn btn-maroon" onclick="omConfirmUpdateDispatch(\'' + dispId + '\')">Update</button></div>');
}

function omConfirmUpdateDispatch(dispId) {
  var _u = getState().currentUser; if (!_u || !['admin', 'print'].includes(_u.role)) { showToast('Only Print Personnel or Admin can manage dispatch.', 'error'); return; }
  var dispatches = getDispatchRecords();
  var d = dispatches.find(function (x) { return x.id === dispId; });
  if (!d) return;
  function gv(id) { var el = document.getElementById(id); return el ? el.value : ''; }
  var dispStatus = gv('omuddisp-status');
  var linkedOrder = getOrders().find(function (x) { return String(x.id) === String(d.orderId); });
  if ((dispStatus === 'Scheduled' || dispStatus === 'Dispatched' || dispStatus === 'Delivered') && linkedOrder && !omIsDispatchReady(linkedOrder) && linkedOrder.status !== 'completed') {
    showToast('Only QC-passed orders can stay in dispatch.', 'error');
    return;
  }
  if (dispStatus === 'Delivered' && linkedOrder && (linkedOrder.balance || 0) > 0) { showToast('Order cannot be completed until payment is fully settled.', 'error'); return; }
  d.dispatchMethod = gv('omuddisp-method'); d.dispatchStatus = dispStatus;
  d.customerNotified = !!(document.getElementById('omuddisp-notified-yes') || {}).checked;
  d.notes = gv('omuddisp-notes'); d.updatedAt = new Date().toISOString();
  saveDispatchRecords(dispatches);
  if (dispStatus === 'Delivered') {
    var _dOrders = getOrders();
    var _dO = _dOrders.find(function (x) { return String(x.id) === String(d.orderId); });
    if (_dO) {
      _dO.status = 'completed';
      saveOrders(_dOrders);
      DB.updateOrder(_dO.id, { status: 'completed', qc_status: 'passed' }); // persist to DB
      omDeductOrderStock(_dO.id);
      omPushToReceiptHistory(_dO.id);
    }
  } else if (dispStatus === 'Dispatched') {
    var _dOrders2 = getOrders();
    var _dO2 = _dOrders2.find(function (x) { return String(x.id) === String(d.orderId); });
    if (_dO2 && _dO2.status !== 'completed') {
      _dO2.status = 'dispatch'; saveOrders(_dOrders2);
      DB.updateOrder(_dO2.id, { status: 'dispatch', qc_status: 'passed' });
    }
  }
  if (omCanOverrideDispatch(_u)) {
    var s = getState();
    recordAudit(s, { action: 'dispatch_override', message: 'Admin override updated dispatch for Order #' + d.orderId, referenceId: String(d.orderId), meta: { dispatchStatus: dispStatus } });
    saveState(s);
  }
  DB.saveDispatch(d).catch(function () { }); // persist dispatch record update
  closeModal(); showToast('Dispatch updated!', 'success'); renderOrders();
}

function omPrintDispatchReceipt(dispId) {
  var d = getDispatchRecords().find(function (x) { return x.id === dispId; });
  if (!d) return;
  var orders = getOrders();
  var o = orders.find(function (x) { return String(x.id) === String(d.orderId); });
  var w = window.open('', '_blank', 'width=400,height=600');
  w.document.write('<!DOCTYPE html><html><head><title>Dispatch Receipt</title><style>body{font-family:monospace;padding:20px;max-width:320px;margin:0 auto}h2{text-align:center}hr{border:none;border-top:1px dashed #999}.footer{text-align:center;font-size:11px;margin-top:16px}</style></head><body>'
    + '<h2>SOUTH PAFPS</h2><p style="text-align:center">Packaging Supplies</p><hr>'
    + '<p><strong>DISPATCH RECEIPT</strong></p><p>Date: ' + new Date(d.date).toLocaleDateString() + '</p>'
    + '<p>Order #: #' + String(d.orderNumber || '').padStart(6, '0') + '</p><hr>'
    + '<p><strong>' + (d.businessName || 'Customer') + '</strong></p>'
    + '<p>Method: ' + d.dispatchMethod + '</p><p>Status: ' + d.dispatchStatus + '</p>'
    + '<p>Customer Notified: ' + (d.customerNotified ? 'Yes' : 'No') + '</p>'
    + (o ? '<p>Total: \u20B1' + omFmt(o.total_amount) + '</p><p>Balance: \u20B1' + omFmt(o.balance) + '</p>' : '')
    + (d.notes ? '<p>Notes: ' + d.notes + '</p>' : '')
    + '<div class="footer"><p>Thank you!</p><p>South Pafps Packaging Supplies</p></div>'
    + '<scr' + 'ipt>window.onload=function(){window.print()}<\/scr' + 'ipt></body></html>');
  w.document.close();
}

// CASH RECONCILIATION
function renderReconciliation() {
  const s = getState();
  if (!s.currentUser || s.currentUser.role !== 'admin') { accessDenied('Cash Reconciliation'); return; }
  const today = new Date().toDateString();
  const shifts = s.shifts.filter(sh => new Date(sh.openedAt).toDateString() === today);

  const rows = shifts.map(sh => {
    const branch = s.branches.find(b => b.id === sh.branchId);
    const staff = s.users.find(u => u.id === sh.userId);
    const shiftSales = s.sales.filter(x => !x.voided && x.shiftId === sh.id);
    const cashSales = shiftSales.reduce((sum, sale) => sum + (sale.payments.find(p => p.method === 'cash')?.amount || 0), 0);
    const gcashSales = shiftSales.reduce((sum, sale) => sum + (sale.payments.find(p => p.method === 'gcash')?.amount || 0), 0);
    const payins = s.cashMovements.filter(c => c.shiftId === sh.id && c.type === 'payin').reduce((a, b) => a + b.amount, 0);
    const payouts = s.cashMovements.filter(c => c.shiftId === sh.id && c.type === 'payout').reduce((a, b) => a + b.amount, 0);
    const expected = sh.openingCash + cashSales + payins - payouts;
    const actual = sh.closingCash || 0;
    const discrepancy = actual ? actual - expected : 0;
    return { branchName: branch?.name || '—', staffName: staff?.name || '—', opening: sh.openingCash || 0, cashSales, gcashSales, payins, payouts, expected, actual, discrepancy, status: sh.status };
  });

  document.getElementById('page-content').innerHTML = `
    <div class="page-header" style="display:flex;justify-content:space-between;align-items:flex-start">
      <div><h1 class="page-title">Daily Cash Reconciliation</h1><p class="page-subtitle">Printable end-of-day cash report (${new Date().toLocaleDateString('en-PH')})</p></div>
      <button class="btn btn-maroon" onclick="printContent(document.getElementById('page-content').innerHTML,'Cash Reconciliation — South Pafps')">${iconSvg('printer')} Print Report</button>
    </div>
    <div class="data-card"><div class="data-card-body no-pad">
      <table class="data-table"><thead><tr><th>Branch</th><th>Staff</th><th>Opening Cash</th><th>Cash Sales</th><th>GCash Sales</th><th>Pay-ins</th><th>Pay-outs</th><th>Expected Cash</th><th>Actual Cash</th><th>Discrepancy</th></tr></thead>
      <tbody>${rows.map(r => `<tr>
        <td>${r.branchName}</td><td>${r.staffName}</td>
        <td class="td-mono">₱${fmt(r.opening)}</td>
        <td class="td-mono">₱${fmt(r.cashSales)}</td>
        <td class="td-mono">₱${fmt(r.gcashSales)}</td>
        <td class="td-mono">₱${fmt(r.payins)}</td>
        <td class="td-mono">₱${fmt(r.payouts)}</td>
        <td class="td-mono" style="font-weight:700">₱${fmt(r.expected)}</td>
        <td class="td-mono">${r.actual ? `₱${fmt(r.actual)}` : '—'}</td>
        <td class="td-mono" style="color:${r.discrepancy === 0 ? 'var(--success)' : 'var(--danger)'}">${r.actual ? `₱${fmt(r.discrepancy)}` : '—'}</td>
      </tr>`).join('') || '<tr><td colspan="10" style="text-align:center;padding:24px;color:var(--ink-60)">No shift records for today.</td></tr>'}</tbody>
      </table>
    </div></div>`;
}

// AUDIT LOG
function renderAudit() {
  const s = getState();
  if (!s.currentUser || s.currentUser.role !== 'admin') { accessDenied('Audit Log'); return; }
  document.getElementById('page-content').innerHTML = `
    <div class="page-header"><h1 class="page-title">Audit Log</h1><p class="page-subtitle">User activity and accountability trail</p></div>
    <div class="data-card"><div class="data-card-body no-pad">
      <table class="data-table"><thead><tr><th>Time</th><th>User</th><th>Branch</th><th>Action</th><th>Description</th></tr></thead>
      <tbody>${[...s.auditLogs].reverse().slice(0, 200).map(log => {
    const user = s.users.find(u => u.id === log.userId);
    const branch = s.branches.find(b => b.id === log.branchId);
    return `<tr><td class="td-mono">${fmtTime(log.createdAt)}</td><td>${user?.name || 'System'}</td><td>${branch?.name || 'All'}</td><td><span class="badge badge-neutral">${log.action}</span></td><td>${log.message}</td></tr>`;
  }).join('') || '<tr><td colspan="5" style="text-align:center;padding:24px;color:var(--ink-60)">No audit logs yet.</td></tr>'}</tbody>
      </table>
    </div></div>`;
}

// BRANCH TRANSFER
function renderTransfers() {
  const s = getState();
  if (!s.currentUser || s.currentUser.role !== 'admin') { accessDenied('Branch Transfers'); return; }
  document.getElementById('page-content').innerHTML = `
    <div class="page-header" style="display:flex;justify-content:space-between;align-items:flex-start">
      <div><h1 class="page-title">Branch Transfer</h1><p class="page-subtitle">Move stock between branches with traceable logs</p></div>
      <button class="btn btn-maroon" onclick="branchTransferModal()">+ New Transfer</button>
    </div>
    <div class="data-card"><div class="data-card-body no-pad">
      <table class="data-table"><thead><tr><th>Date</th><th>From</th><th>To</th><th>Item</th><th>Qty</th><th>By</th></tr></thead>
      <tbody>${[...s.branchTransfers].reverse().map(t => {
    const from = s.branches.find(b => b.id === t.fromBranchId);
    const to = s.branches.find(b => b.id === t.toBranchId);
    const user = s.users.find(u => u.id === t.createdBy);
    return `<tr><td class="td-mono">${fmtTime(t.createdAt)}</td><td>${from?.name || '—'}</td><td>${to?.name || '—'}</td><td>${t.productName} (${t.variantName})</td><td>${t.qty}</td><td>${user?.name || '—'}</td></tr>`;
  }).join('') || '<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--ink-60)">No transfer logs yet.</td></tr>'}</tbody>
      </table>
    </div></div>`;
}

function branchTransferModal() {
  const _bt = getState();
  if (!_bt.currentUser || _bt.currentUser.role !== 'admin') { showToast('Only Administrators can initiate branch transfers.', 'error'); return; }
  const s = getState();
  const firstBranchId = s.branches[0]?.id || '';
  const allVariantsForTransfer = s.products.flatMap(p => (p.variants || []).map(v => ({ pid: p.id, pname: p.name, v })));
  function trVariantOptions(fromBranchId) {
    return allVariantsForTransfer.map(({ pname, v }) => {
      const bStock = (v.branchStocks || {})[fromBranchId] || 0;
      return `<option value="${v.id}">${pname} — ${v.name} (Branch Stock: ${bStock})</option>`;
    }).join('');
  }
  showModal(`<div class="modal-header"><h2>Branch Stock Transfer</h2><button class="btn-close-modal" onclick="closeModal()">✕</button></div>
    <div class="modal-body">
      <div class="form-group"><label>From Branch</label><div class="form-select-wrap"><select id="tr-from" class="form-control" onchange="(function(){var f=document.getElementById('tr-from').value;var sel=document.getElementById('tr-variant');if(sel){var s2=getState();var av=s2.products.flatMap(function(p){return(p.variants||[]).map(function(v){var bs=(v.branchStocks||{})[f]||0;return'<option value=\''+v.id+'\'>'+(p.name)+' — '+v.name+' (Branch Stock: '+bs+')</option>';});});sel.innerHTML=av.join('');}})();">${s.branches.map(b => `<option value="${b.id}">${b.name}</option>`).join('')}</select></div></div>
      <div class="form-group"><label>To Branch</label><div class="form-select-wrap"><select id="tr-to" class="form-control">${s.branches.map(b => `<option value="${b.id}">${b.name}</option>`).join('')}</select></div></div>
      <div class="form-group"><label>Variant</label><div class="form-select-wrap"><select id="tr-variant" class="form-control">${trVariantOptions(firstBranchId)}</select></div></div>
      <div class="form-group"><label>Quantity</label><input id="tr-qty" type="number" class="form-control" min="1" value="1"></div>
    </div>
    <div class="modal-footer"><button class="btn btn-outline" onclick="closeModal()">Cancel</button><button class="btn btn-maroon" onclick="confirmBranchTransfer()">Transfer</button></div>`);
}

function confirmBranchTransfer() {
  const s = getState();
  const fromBranchId = document.getElementById('tr-from').value;
  const toBranchId = document.getElementById('tr-to').value;
  const variantId = document.getElementById('tr-variant').value;
  const qty = parseInt(document.getElementById('tr-qty').value) || 0;
  if (fromBranchId === toBranchId) { showToast('Source and destination branches must be different.', 'error'); return; }
  if (qty <= 0) { showToast('Enter a valid transfer quantity.', 'error'); return; }
  const found = findProductAndVariantByVariantId(s, variantId);
  if (!found) { showToast('Invalid variant selected.', 'error'); return; }
  // BUG FIX 2: Validate against source-branch stock, not total stock
  const fromBranchStock = (found.variant.branchStocks || {})[fromBranchId] || 0;
  if (qty > fromBranchStock) { showToast(`Insufficient stock at source branch. Available: ${fromBranchStock}`, 'error'); return; }
  adjustVariantBranchStock(found.variant, fromBranchId, -qty);
  adjustVariantBranchStock(found.variant, toBranchId, qty);
  const transfer = { id: 'tr_' + Date.now(), fromBranchId, toBranchId, productId: found.product.id, variantId, productName: found.product.name, variantName: found.variant.name, qty, createdAt: new Date().toISOString(), createdBy: s.currentUser?.id || null };
  s.branchTransfers.push(transfer);
  recordAudit(s, { action: 'branch_transfer', message: `Branch transfer posted (${qty})`, meta: { fromBranchId, toBranchId, product: found.product.name, variant: found.variant.name } });
  saveState(s);
  DB.saveTransfer(transfer);
  closeModal();
  renderTransfers();
  showToast('Branch transfer logged.', 'success');
}

// USER MANAGEMENT
function ensureAdminUserManagementAccess() {
  const s = getState();
  const u = s.currentUser;
  const role = normalizeRole(u?.role);
  if (!u || (role !== 'admin' && role !== 'branch_manager')) {
    showToast('Only the Super Admin or a Branch Manager can manage staff accounts.', 'error');
    navigateTo('dashboard');
    return false;
  }
  return true;
}

function renderUsers() {
  if (!ensureAdminUserManagementAccess()) return;
  const s = getState();
  const u = s.currentUser;
  const role = normalizeRole(u.role);
  let staffUsers = s.users.filter(x => x.role !== 'admin');
  if (role === 'branch_manager') {
    staffUsers = staffUsers.filter(x => x.branchId === u.branchId && normalizeRole(x.role) !== 'hr');
  }
  const pageTitle = role === 'branch_manager' ? 'Branch Account Management' : 'Staff Account Management';
  document.getElementById('page-content').innerHTML = `
    <div class="page-header" style="display:flex;justify-content:space-between;align-items:flex-start">
      <div><h1 class="page-title">${pageTitle}</h1><p class="page-subtitle">${staffUsers.length} staff accounts</p></div>
      <button class="btn btn-maroon" onclick="addStaffAccountModal()">+ Create Staff Account</button>
    </div>
    <div class="data-card"><div class="data-card-body no-pad">
      <table class="data-table"><thead><tr><th>Name</th><th>Username</th><th>Role</th><th>Branch</th><th>Actions</th></tr></thead>
      <tbody>${staffUsers.map(u => {
    const branch = s.branches.find(b => b.id === u.branchId);
    const normalizedRole = normalizeRole(u.role);
    const roleBadge = normalizedRole === 'branch_manager' ? 'badge-warning' : (normalizedRole === 'cashier' || normalizedRole === 'inventory_staff') ? 'badge-success' : 'badge-info';
    const roleLabel = getRoleLabel(normalizedRole);
    return `<tr>
          <td><strong>${u.name}</strong></td>
          <td class="td-mono">${u.username}</td>
          <td><span class="badge ${roleBadge}">${roleLabel}</span></td>
          <td>${branch?.name || '—'}</td>
          <td><button class="btn btn-sm btn-outline" onclick="editUserModal('${u.id}')">Edit</button> <button class="btn btn-sm btn-outline" onclick="resetUserPasswordModal('${u.id}')">Reset Password</button> <button class="btn btn-sm btn-icon" onclick="deleteUser('${u.id}')" title="Delete">${iconSvg('error')}</button></td>
        </tr>`;
  }).join('') || '<tr><td colspan="5" class="text-center text-muted">No staff accounts yet. Create your first one.</td></tr>'}</tbody>
      </table>
    </div></div>`;
}

function nuUpdatePositions() {
  const role = document.getElementById('nu-role')?.value;
  const posSel = document.getElementById('nu-position');
  if (!posSel) return;
  const list = getPositionOptionsByRole(role);
  posSel.innerHTML = list.map(p => `<option value="${p}">${p}</option>`).join('');
}

function nuUpdateBranchForRole() {
  const role = document.getElementById('nu-role')?.value;
  const branchSel = document.getElementById('nu-branch');
  if (!branchSel) return;
  if (roleCanBeMainBranchOnly(role)) {
    branchSel.value = 'b1';
    branchSel.disabled = true;
    branchSel.title = `${getRoleLabel(role)} can only be assigned to the Main Branch`;
  } else {
    branchSel.disabled = false;
    branchSel.title = '';
  }
}

function addStaffAccountModal() {
  if (!ensureAdminUserManagementAccess()) return;
  const s = getState();
  const eyeSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
  showModal(`<div class="modal-header"><h2>Create Staff Account</h2><button class="btn-close-modal" onclick="closeModal()">✕</button></div>
    <div class="modal-body">
      <div class="form-row-2">
        <div class="form-group">
          <label>Full Name <span style="color:var(--danger)">*</span></label>
          <input id="nu-name" class="form-control" placeholder="e.g. Juan dela Cruz" autocomplete="off">
        </div>
        <div class="form-group">
          <label>Username <span style="color:var(--danger)">*</span></label>
          <input id="nu-uname" class="form-control" placeholder="Login username" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false">
        </div>
      </div>
      <div class="form-row-2">
        <div class="form-group">
          <label>Password <span style="color:var(--danger)">*</span></label>
          <div class="pw-wrap"><input id="nu-pass" type="password" class="form-control" placeholder="Min 6 characters" autocomplete="new-password"><button type="button" class="pw-eye" onclick="togglePwVisibility('nu-pass', this)" tabindex="-1">${eyeSvg}</button></div>
        </div>
        <div class="form-group">
          <label>Confirm Password <span style="color:var(--danger)">*</span></label>
          <div class="pw-wrap"><input id="nu-pass-confirm" type="password" class="form-control" placeholder="Re-enter password" autocomplete="new-password"><button type="button" class="pw-eye" onclick="togglePwVisibility('nu-pass-confirm', this)" tabindex="-1">${eyeSvg}</button></div>
        </div>
      </div>
      <div class="form-row-2">
        <div class="form-group">
          <label>Role <span style="color:var(--danger)">*</span></label>
          <div class="form-select-wrap"><select id="nu-role" class="form-control" onchange="nuUpdatePositions(); nuUpdateBranchForRole()"><option value="branch_manager">Branch Manager</option><option value="hr">HR</option><option value="cashier">Cashier</option><option value="inventory_staff">Inventory Staff</option><option value="print">Printing Personnel</option></select></div>
        </div>
        <div class="form-group">
          <label>Position <span style="color:var(--danger)">*</span></label>
          <div class="form-select-wrap"><select id="nu-position" class="form-control">
            <option value="Branch Manager">Branch Manager</option>
          </select></div>
        </div>
      </div>
      <div class="form-group">
        <label>Branch <span style="color:var(--danger)">*</span></label>
        <div class="form-select-wrap"><select id="nu-branch" class="form-control" >${s.branches.map(b => `<option value="${b.id}" ${b.id === s.currentUser.branchId ? 'selected' : ''}>${b.name}</option>`).join('')}</select></div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
      <button class="btn btn-maroon" onclick="confirmAddStaffAccount()">Create Account</button>
    </div>`);
  // For team leaders: ensure branch is locked to their branch
  // Lock branch to Main Branch for Printing Personnel
  nuUpdateBranchForRole();
}

async function confirmAddStaffAccount() {
  if (!ensureAdminUserManagementAccess()) return;
  const s = getState();
  const meRole = normalizeRole(s.currentUser?.role);
  const name = document.getElementById('nu-name').value.trim();
  const username = document.getElementById('nu-uname').value.trim();
  const password = document.getElementById('nu-pass').value;
  const confirmPassword = document.getElementById('nu-pass-confirm').value;
  const role = document.getElementById('nu-role').value;
  const normalizedRole = normalizeRole(role);
  const position = normalizedRole === 'branch_manager' ? 'Branch Manager' : (document.getElementById('nu-position')?.value || '');
  const branchId = document.getElementById('nu-branch')?.value;
  if (!name || !username || !password || !confirmPassword || !role || !branchId) { showToast('All fields required', 'error'); return; }
  if (password.length < 6) { showToast('Password must be at least 6 characters.', 'error'); return; }
  if (password !== confirmPassword) { showToast('Passwords do not match.', 'error'); return; }
  if (roleCanBeMainBranchOnly(role) && branchId !== 'b1') { showToast(`${getRoleLabel(role)} can only be assigned to the Main Branch.`, 'error'); return; }
  if (meRole === 'branch_manager' && branchId !== s.currentUser.branchId) { showToast('Branch Managers can only create accounts for their own branch.', 'error'); return; }
  if (meRole === 'branch_manager' && (normalizeRole(role) === 'hr' || normalizeRole(role) === 'branch_manager')) { showToast('Branch Managers can create cashier, inventory, and printing accounts only.', 'error'); return; }
  if (s.users.find(u => u.username.toLowerCase() === username.toLowerCase())) { showToast('Username already exists', 'error'); return; }
  // Save staff account locally
  const newUser = {
    id: 'usr_' + Date.now(),
    name,
    username,
    password,
    role,
    position,
    branchId,
  };
  s.users.push(newUser);
  recordAudit(s, {
    action: 'create_user',
    message: `Staff account created: ${username}`,
    userId: s.currentUser?.id || null,
    branchId,
    details: { createdRole: role, createdUsername: username },
  });
  saveState(s);
  try {
    await DB.saveUser(newUser);
  } catch (e) {
    // Roll back local state so it stays in sync with the server
    s.users = s.users.filter(u => u.id !== newUser.id);
    saveState(s);
    showToast('Failed to save user to server: ' + e.message, 'error');
    return;
  }
  closeModal();
  showToast('Staff account created!', 'success');
  renderUsers();
}

function editUserModal(uid) {
  if (!ensureAdminUserManagementAccess()) return;
  const s = getState();
  const u = s.users.find(x => x.id === uid);
  if (!u || u.role === 'admin') return;
  const posOpts = getPositionOptionsByRole(u.role).map(p =>
    `<option value="${p}" ${u.position === p ? 'selected' : ''}>${p}</option>`).join('');
  showModal(`<div class="modal-header"><h2>Edit Staff Account</h2><button class="btn-close-modal" onclick="closeModal()">✕</button></div>
    <div class="modal-body">
      <div style="background:var(--cream);border-radius:var(--radius);padding:12px 16px;margin-bottom:16px;font-size:13px;">
        <span style="color:var(--ink-50)">Username</span>
        <div style="font-weight:700;font-family:var(--font-mono);margin-top:2px">${u.username}</div>
      </div>
      <div class="form-row-2">
        <div class="form-group">
          <label>Full Name</label>
          <input id="eu-name" class="form-control" value="${u.name}">
        </div>
        <div class="form-group">
          <label>Branch</label>
          <div class="form-select-wrap"><select id="eu-branch" class="form-control">${s.branches.map(b => `<option value="${b.id}" ${b.id === u.branchId ? 'selected' : ''}>${b.name}</option>`).join('')}</select></div>
        </div>
      </div>
      <div class="form-row-2">
        <div class="form-group">
          <label>Position</label>
          <div class="form-select-wrap"><select id="eu-position" class="form-control">
            <option value="">— Not set —</option>
            ${posOpts}
          </select></div>
        </div>
        <div class="form-group">
          <label>Role</label>
          <div class="form-select-wrap"><select id="eu-role" class="form-control">
            <option value="branch_manager" ${normalizeRole(u.role) === 'branch_manager' ? 'selected' : ''}>Branch Manager</option>
            <option value="hr" ${normalizeRole(u.role) === 'hr' ? 'selected' : ''}>HR</option>
            <option value="cashier" ${normalizeRole(u.role) === 'cashier' ? 'selected' : ''}>Cashier</option>
            <option value="inventory_staff" ${normalizeRole(u.role) === 'inventory_staff' ? 'selected' : ''}>Inventory Staff</option>
            <option value="print" ${u.role === 'print' ? 'selected' : ''}>Printing Personnel</option>
          </select></div>
        </div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
      <button class="btn btn-maroon" onclick="confirmEditUser('${uid}')">Save Changes</button>
    </div>`);
}

function confirmEditUser(uid) {
  if (!ensureAdminUserManagementAccess()) return;
  const s = getState();
  const meRole = normalizeRole(s.currentUser?.role);
  const u = s.users.find(x => x.id === uid);
  if (!u || u.role === 'admin') return;
  const nextRole = document.getElementById('eu-role')?.value || u.role;
  u.name = document.getElementById('eu-name').value.trim();
  u.branchId = document.getElementById('eu-branch').value;
  u.role = nextRole;
  u.position = normalizeRole(nextRole) === 'branch_manager'
    ? 'Branch Manager'
    : (document.getElementById('eu-position')?.value || u.position || '');
  if (roleCanBeMainBranchOnly(u.role) && u.branchId !== 'b1') { showToast(`${getRoleLabel(u.role)} can only be assigned to the Main Branch.`, 'error'); return; }
  if (meRole === 'branch_manager' && u.branchId !== s.currentUser.branchId) { showToast('Branch Managers can only edit accounts in their own branch.', 'error'); return; }
  if (meRole === 'branch_manager' && (normalizeRole(u.role) === 'hr' || normalizeRole(u.role) === 'branch_manager')) { showToast('Branch Managers cannot assign HR or Branch Manager roles.', 'error'); return; }
  recordAudit(s, {
    action: 'update_user',
    message: `Staff account updated: ${u.username}`,
    userId: s.currentUser?.id || null,
    branchId: u.branchId || null,
    details: { updatedUserId: u.id },
  });
  saveState(s);
  DB.updateUser(uid, { name: u.name, branchId: u.branchId, position: u.position, role: u.role, employeeId: u.employeeId || null });
  closeModal();
  showToast('User updated!', 'success');
  renderUsers();
}

function deleteUser(uid) {
  if (!ensureAdminUserManagementAccess()) return;
  const s = getState();
  const userToDelete = s.users.find(u => u.id === uid);
  if (!userToDelete || userToDelete.role === 'admin') return;
  const userLabel = userToDelete.name || userToDelete.username || 'this user';
  confirmModal({
    title: 'Delete User Account',
    message: `Are you sure you want to delete <strong>${userLabel}</strong>'s account? This action cannot be undone.`,
    confirmText: 'Delete User',
    icon: '👤',
    onConfirm: function () { _deleteUserConfirmed(uid); }
  });
  return;
}
function _deleteUserConfirmed(uid) {
  if (!ensureAdminUserManagementAccess()) return;
  const s = getState();
  const userToDelete = s.users.find(u => u.id === uid);
  if (!userToDelete || userToDelete.role === 'admin') return;
  s.users = s.users.filter(u => u.id !== uid);
  recordAudit(s, {
    action: 'delete_user',
    message: `Staff account deleted: ${userToDelete.username}`,
    userId: s.currentUser?.id || null,
    branchId: userToDelete.branchId || null,
    details: { deletedUserId: uid },
  });
  saveState(s);
  // FIX 4: Sync deletion to server
  DB.deleteUser(uid);
  showToast('User deleted.', 'warning');
  renderUsers();
}

function resetUserPasswordModal(uid) {
  if (!ensureAdminUserManagementAccess()) return;
  const s = getState();
  const u = s.users.find(x => x.id === uid);
  if (!u || u.role === 'admin') return;
  const rpEyeSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
  showModal(`<div class="modal-header"><h2>Reset Password</h2><button class="btn-close-modal" onclick="closeModal()">✕</button></div>
    <div class="modal-body">
      <div style="background:var(--cream);border-radius:var(--radius);padding:12px 16px;margin-bottom:16px;font-size:13px;">
        <span style="color:var(--ink-50)">Resetting password for</span>
        <div style="font-weight:700;font-size:15px;margin-top:2px">${u.name} <span style="font-family:var(--font-mono);font-weight:400;color:var(--ink-60);font-size:13px">@${u.username}</span></div>
      </div>
      <div class="form-row-2">
        <div class="form-group">
          <label>New Password <span style="color:var(--danger)">*</span></label>
          <div class="pw-wrap"><input id="rp-pass" type="password" class="form-control" placeholder="Min 6 characters" autocomplete="new-password"><button type="button" class="pw-eye" onclick="togglePwVisibility('rp-pass', this)" tabindex="-1">${rpEyeSvg}</button></div>
        </div>
        <div class="form-group">
          <label>Confirm Password <span style="color:var(--danger)">*</span></label>
          <div class="pw-wrap"><input id="rp-pass-confirm" type="password" class="form-control" placeholder="Re-enter password" autocomplete="new-password"><button type="button" class="pw-eye" onclick="togglePwVisibility('rp-pass-confirm', this)" tabindex="-1">${rpEyeSvg}</button></div>
        </div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
      <button class="btn btn-maroon" onclick="confirmResetUserPassword('${uid}')">Reset Password</button>
    </div>`);
}

function confirmResetUserPassword(uid) {
  if (!ensureAdminUserManagementAccess()) return;
  const s = getState();
  const u = s.users.find(x => x.id === uid);
  if (!u || u.role === 'admin') return;
  const newPassword = document.getElementById('rp-pass')?.value || '';
  const confirmPassword = document.getElementById('rp-pass-confirm')?.value || '';
  if (!newPassword || !confirmPassword) { showToast('Both password fields are required.', 'error'); return; }
  if (newPassword.length < 6) { showToast('Password must be at least 6 characters.', 'error'); return; }
  if (newPassword !== confirmPassword) { showToast('Passwords do not match.', 'error'); return; }
  u.password = newPassword;
  recordAudit(s, {
    action: 'reset_password',
    message: `Password reset for staff account: ${u.username}`,
    userId: s.currentUser?.id || null,
    branchId: u.branchId || null,
    details: { resetUserId: u.id },
  });
  saveState(s);
  DB.updateUser(uid, { password: newPassword });
  closeModal();
  showToast('Password reset successful.', 'success');
}

// BRANCHES
function renderBranches() {
  const _bs = getState();
  if (!_bs.currentUser || _bs.currentUser.role !== 'admin') { accessDenied('Branch Management'); return; }
  const s = getState();
  document.getElementById('page-content').innerHTML = `
    <div class="page-header" style="display:flex;justify-content:space-between;align-items:flex-start">
      <div><h1 class="page-title">Branch Management</h1><p class="page-subtitle">${s.branches.length} branches registered</p></div>
      <button class="btn btn-maroon" onclick="addBranchModal()">+ Add Branch</button>
    </div>
    <div class="branch-overview-grid">${s.branches.map((b, i) => `
      <div class="branch-ov-card b${i + 1}">
        <div class="branch-ov-name">${iconSvg('store')} ${b.name} ${b.active ? '' : '<span class="badge badge-neutral">Inactive</span>'}</div>
        <div class="branch-ov-row"><span>Address</span><strong style="font-family:var(--font-body)">${b.address}</strong></div>
        <div class="branch-ov-row"><span>Contact</span><strong style="font-family:var(--font-body)">${b.contact}</strong></div>
        <div class="branch-ov-row"><span>Staff</span><strong>${s.users.filter(u => u.branchId === b.id && ['cashier', 'team_leader', 'staff'].includes(u.role)).length}</strong></div>
        <div style="margin-top:12px;display:flex;gap:8px">
          <button class="btn btn-sm btn-outline" onclick="editBranchModal('${b.id}')">Edit</button>
          <button class="btn btn-sm btn-outline" onclick="toggleBranch('${b.id}')">${b.active ? 'Deactivate' : 'Activate'}</button>
        </div>
      </div>`).join('')}
    </div>`;
}

function addBranchModal() {
  showModal(`<div class="modal-header"><h2>Add Branch</h2><button class="btn-close-modal" onclick="closeModal()">✕</button></div>
    <div class="modal-body">
      <div class="form-row-2">
        <div class="form-group">
          <label>Branch Name <span style="color:var(--danger)">*</span></label>
          <input id="nb-name" class="form-control" placeholder="e.g. East Branch">
        </div>
        <div class="form-group">
          <label>Contact Number</label>
          <input id="nb-contact" class="form-control" placeholder="e.g. 049-000-0000">
        </div>
      </div>
      <div class="form-group">
        <label>Address <span style="color:var(--danger)">*</span></label>
        <input id="nb-addr" class="form-control" placeholder="Full branch address">
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
      <button class="btn btn-maroon" onclick="confirmAddBranch()">Add Branch</button>
    </div>`);
}

function confirmAddBranch() {
  const s = getState();
  const name = document.getElementById('nb-name').value.trim();
  const address = document.getElementById('nb-addr').value.trim();
  const contact = document.getElementById('nb-contact').value.trim();
  if (!name || !address) { showToast('Name and address required', 'error'); return; }
  const newBranch = { id: 'b_' + Date.now(), name, address, contact, active: true };
  s.branches.push(newBranch);
  saveState(s);
  DB.saveBranch(newBranch);
  closeModal();
  showToast('Branch added!', 'success');
  renderBranches();
}

function editBranchModal(bid) {
  const s = getState();
  const b = s.branches.find(x => x.id === bid);
  if (!b) return;
  showModal(`<div class="modal-header"><h2>Edit Branch</h2><button class="btn-close-modal" onclick="closeModal()">✕</button></div>
    <div class="modal-body">
      <div class="form-row-2">
        <div class="form-group">
          <label>Branch Name</label>
          <input id="eb-name" class="form-control" value="${b.name}">
        </div>
        <div class="form-group">
          <label>Contact Number</label>
          <input id="eb-contact" class="form-control" value="${b.contact}">
        </div>
      </div>
      <div class="form-group">
        <label>Address</label>
        <input id="eb-addr" class="form-control" value="${b.address}">
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
      <button class="btn btn-maroon" onclick="confirmEditBranch('${bid}')">Save Changes</button>
    </div>`);
}

function confirmEditBranch(bid) {
  const s = getState();
  const b = s.branches.find(x => x.id === bid);
  if (!b) return;
  b.name = document.getElementById('eb-name').value.trim();
  b.address = document.getElementById('eb-addr').value.trim();
  b.contact = document.getElementById('eb-contact').value.trim();
  saveState(s);
  DB.updateBranch(bid, { name: b.name, address: b.address, contact: b.contact });
  closeModal();
  showToast('Branch updated!', 'success');
  renderBranches();
  buildSidebar();
}

function toggleBranch(bid) {
  const s = getState();
  const b = s.branches.find(x => x.id === bid);
  if (b) { b.active = !b.active; saveState(s); DB.updateBranch(b.id, { active: b.active }); renderBranches(); }
}

// DASHBOARD PREFERENCES
function dashboardPrefsModal() {
  const s = getState();
  const selected = s.dashboardPrefs?.pinnedKpis || [];
  const options = [
    { key: 'revenue', label: 'Revenue Today' },
    { key: 'sales', label: 'Sales Today' },
    { key: 'activeShifts', label: 'Active Shifts' },
    { key: 'products', label: 'Active Products' },
    { key: 'lowStock', label: 'Low Stock Count' },
  ];
  showModal(`<div class="modal-header"><h2>Dashboard KPI Customization</h2><button class="btn-close-modal" onclick="closeModal()">✕</button></div>
    <div class="modal-body">
      <p class="text-sm text-muted">Pin the KPI cards you want to show first on admin dashboard.</p>
      ${options.map(o => `<label style="display:flex;gap:10px;align-items:center;padding:6px 0"><input type="checkbox" class="kpi-pref" value="${o.key}" ${selected.includes(o.key) ? 'checked' : ''}> ${o.label}</label>`).join('')}
    </div>
    <div class="modal-footer"><button class="btn btn-outline" onclick="closeModal()">Cancel</button><button class="btn btn-maroon" onclick="saveDashboardPrefs()">Save</button></div>`);
}

function saveDashboardPrefs() {
  const s = getState();
  const checked = [...document.querySelectorAll('.kpi-pref:checked')].map(x => x.value);
  if (!checked.length) { showToast('Select at least one KPI.', 'error'); return; }
  s.dashboardPrefs = s.dashboardPrefs || {};
  s.dashboardPrefs.pinnedKpis = checked;
  saveState(s);
  closeModal();
  renderDashboard();
  showToast('Dashboard preferences saved.', 'success');
}

// HELPERS
function getActiveBranchId(state, user) {
  if (!user) return state.branches[0]?.id || 'b1';
  return user.branchId || state.branches[0]?.id || 'b1';
}

function findVariantById(state, variantId) {
  for (const product of state.products || []) {
    const variant = (product.variants || []).find(v => v.id === variantId);
    if (variant) return variant;
  }
  return null;
}

function findProductAndVariantByVariantId(state, variantId) {
  for (const product of state.products || []) {
    const variant = (product.variants || []).find(v => v.id === variantId);
    if (variant) return { product, variant };
  }
  return null;
}

function adjustVariantBranchStock(variant, branchId, delta) {
  if (!variant.branchStocks || typeof variant.branchStocks !== 'object') variant.branchStocks = {};
  if (typeof variant.branchStocks[branchId] !== 'number') variant.branchStocks[branchId] = 0;
  variant.branchStocks[branchId] = Math.max(0, (variant.branchStocks[branchId] || 0) + delta);
  variant.stock = Object.values(variant.branchStocks).reduce((sum, qty) => sum + (parseInt(qty) || 0), 0);
}

function recordAudit(state, entry) {
  const currentUser = state.currentUser;
  state.auditLogs = state.auditLogs || [];
  const log = {
    id: 'audit_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
    action: entry.action,
    message: entry.message,
    userId: entry.userId || currentUser?.id || null,
    branchId: entry.branchId || currentUser?.branchId || null,
    referenceId: entry.referenceId || null,
    meta: entry.meta || null,
    createdAt: new Date().toISOString(),
  };
  state.auditLogs.push(log);
  DB.saveAuditLog(log);
}

function iconSvg(name) {
  const paths = {
    cart: '<path d="M3 4h2l1.2 7.2A2 2 0 0 0 8.2 13H16a2 2 0 0 0 1.9-1.4L20 6H6"/><circle cx="9" cy="18" r="1.5"/><circle cx="16" cy="18" r="1.5"/>',
    building: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h2M12 7h2M16 7h0M8 11h2M12 11h2M8 15h2M12 15h2"/><path d="M10 21v-3h4v3"/>',
    box: '<path d="M3 8 12 3l9 5-9 5-9-5z"/><path d="M3 8v8l9 5 9-5V8"/><path d="M12 13v8"/>',
    chart: '<path d="M4 19h16"/><path d="M7 15v-4"/><path d="M12 15V8"/><path d="M17 15v-6"/>',
    truck: '<path d="M3 7h10v8H3z"/><path d="M13 10h4l2 2v3h-6"/><circle cx="8" cy="18" r="1.5"/><circle cx="17" cy="18" r="1.5"/>',
    users: '<circle cx="9" cy="8" r="3"/><circle cx="16" cy="9" r="2.5"/><path d="M4 19a5 5 0 0 1 10 0"/><path d="M13 19a4 4 0 0 1 7 0"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18"/><path d="M8 3v4M16 3v4"/>',
    money: '<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="3"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    calculator: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8"/><path d="M8 11h2M12 11h2M16 11h0M8 15h2M12 15h2M8 19h8"/>',
    clipboard: '<rect x="6" y="4" width="12" height="17" rx="2"/><rect x="9" y="2" width="6" height="4" rx="1"/>',
    transfer: '<path d="M4 7h13"/><path d="m14 4 3 3-3 3"/><path d="M20 17H7"/><path d="m10 14-3 3 3 3"/>',
    key: '<circle cx="8" cy="12" r="3"/><path d="M11 12h9"/><path d="M17 12v3M20 12v2"/>',
    store: '<path d="M4 9h16l-1-4H5z"/><path d="M5 9v10h14V9"/><path d="M9 19v-5h6v5"/>',
    home: '<path d="m3 11 9-7 9 7"/><path d="M5 10v10h14V10"/>',
    receipt: '<path d="M6 3h12v18l-2-1-2 1-2-1-2 1-2-1-2 1z"/><path d="M9 8h6M9 12h6M9 16h4"/>',
    printer: '<rect x="6" y="3" width="12" height="5"/><rect x="4" y="9" width="16" height="8" rx="2"/><path d="M7 14h10v7H7z"/>',
    lock: '<rect x="6" y="10" width="12" height="10" rx="2"/><path d="M8 10V8a4 4 0 0 1 8 0v2"/>',
    lockOpen: '<rect x="6" y="10" width="12" height="10" rx="2"/><path d="M16 10V8a4 4 0 0 0-8 0"/>',
    shield: '<path d="M12 3 5 6v6c0 5 3.5 7.5 7 9 3.5-1.5 7-4 7-9V6l-7-3z"/>',
    card: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3 10h18"/><path d="M7 15h4"/>',
    search: '<circle cx="11" cy="11" r="6"/><path d="m20 20-4-4"/>',
    cash: '<path d="M3 7h18v10H3z"/><path d="M12 10v4"/><path d="M10 11.5h4"/>',
    phone: '<rect x="8" y="3" width="8" height="18" rx="2"/><path d="M11 6h2M12 18h0"/>',
    check: '<path d="m5 12 4 4 10-10"/>',
    error: '<path d="M6 6l12 12M18 6 6 18"/>',
    warning: '<path d="M12 3 2.8 20h18.4L12 3z"/><path d="M12 9v4M12 16h.01"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 10v6M12 7h.01"/>',
    pin: '<path d="M12 21s7-6.5 7-12a7 7 0 1 0-14 0c0 5.5 7 12 7 12z"/><circle cx="12" cy="9" r="2.5"/>',
    phoneCall: '<path d="M6.5 4.5c1.5 3 3.5 5.5 6 8s5 4.5 8 6l2-2c.5-.5.5-1.3 0-1.8l-2.3-2.3c-.4-.4-1-.5-1.5-.2l-1.8 1c-1.5-.8-2.9-2.2-3.7-3.7l1-1.8c.3-.5.2-1.1-.2-1.5L11.8 2.5c-.5-.5-1.3-.5-1.8 0l-3.5 2z"/>',
    statusOpen: '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-5"/>',
    statusClosed: '<circle cx="12" cy="12" r="9"/><path d="M8 8l8 8M16 8l-8 8"/>',
    note: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 9h8M8 13h8M8 17h5"/>'
  };
  const d = paths[name] || paths.info;
  return `<svg class="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
}

const EMOJI_TO_ICON = {
  '🛒': 'cart', '🏢': 'building', '📦': 'box', '📊': 'chart', '🚚': 'truck', '👥': 'users', '📅': 'calendar', '💰': 'money',
  '⏰': 'clock', '🧮': 'calculator', '📜': 'clipboard', '🔁': 'transfer', '🔑': 'key', '🏪': 'store', '🏠': 'home', '🧾': 'receipt',
  '🖨️': 'printer', '🖨': 'printer', '🔒': 'lock', '🔍': 'search', '💵': 'cash', '📱': 'phone', '✅': 'check', '⚠️': 'warning',
  '⚠': 'warning', '✕': 'error', '🔴': 'warning', '📝': 'note', '📍': 'pin', '📞': 'phoneCall', '🟢': 'statusOpen',
  '⚪': 'statusClosed', '📋': 'clipboard', '🔓': 'lockOpen', '🔐': 'shield', '💳': 'card'
};

function applySvgToElement(element) {
  if (!element || typeof element.innerHTML !== 'string') return;
  let html = element.innerHTML;
  Object.entries(EMOJI_TO_ICON).forEach(([emoji, icon]) => {
    html = html.split(emoji).join(iconSvg(icon));
  });
  element.innerHTML = html;
}

function fmt(n) { return (Math.round(n * 100) / 100).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function fmtTime(iso) { return iso ? new Date(iso).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'; }
function fmtDate(iso) { return iso ? new Date(iso).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'; }
function getGreeting() { const h = new Date().getHours(); return h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening'; }
function updateTopbarDate() { const el = document.getElementById('topbar-date'); if (el) el.textContent = new Date().toLocaleString('en-PH', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); }

function showModal(html, cls = '') {
  document.getElementById('modal-container').innerHTML = `<div class="modal-overlay" onclick="if(event.target===this)closeModal()"><div class="modal ${cls}">${html}</div></div>`;
  applySvgToElement(document.getElementById('modal-container'));
}
function closeModal() {
  const modalContainer = document.getElementById('modal-container');
  if (!modalContainer) return;
  modalContainer.innerHTML = '';
}

/**
 * confirmModal(options)
 * Shows a styled confirmation dialog instead of the browser's native confirm().
 * options = {
 *   title: string,
 *   message: string,
 *   confirmText: string (default 'Confirm'),
 *   cancelText: string (default 'Cancel'),
 *   danger: bool (default true) — uses btn-danger for confirm button,
 *   icon: string (emoji or SVG key),
 *   onConfirm: function,
 *   onCancel: function (optional)
 * }
 */
function confirmModal({ title = 'Are you sure?', message = '', confirmText = 'Confirm', cancelText = 'Cancel', danger = true, icon = '⚠️', onConfirm, onCancel } = {}) {
  const btnClass = danger ? 'btn btn-danger' : 'btn btn-maroon';
  const iconHtml = icon ? `<div style="font-size:48px;text-align:center;margin-bottom:16px;line-height:1;">${icon}</div>` : '';
  showModal(`
    <div class="modal-header" style="border-bottom:none;padding-bottom:0;">
      <h2 style="font-size:18px;">${title}</h2>
      <button class="btn-close-modal" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-body" style="text-align:center;padding-top:8px;padding-bottom:8px;">
      ${iconHtml}
      <p style="color:var(--ink-60);font-size:14px;line-height:1.6;max-width:340px;margin:0 auto;">${message}</p>
    </div>
    <div class="modal-footer" style="justify-content:center;gap:12px;">
      <button class="btn btn-outline" style="min-width:100px;" onclick="${onCancel ? '_confirmModalCancel()' : 'closeModal()'}">${cancelText}</button>
      <button class="${btnClass}" style="min-width:120px;" onclick="_confirmModalConfirm()">${confirmText}</button>
    </div>
  `);
  window._confirmModalConfirm = function () { closeModal(); if (typeof onConfirm === 'function') onConfirm(); };
  window._confirmModalCancel = function () { closeModal(); if (typeof onCancel === 'function') onCancel(); };
}

function showToast(msg, type = 'success') {
  const c = document.getElementById('toast-container');
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  const iconKey = type === 'success' ? 'check' : type === 'error' ? 'error' : type === 'warning' ? 'warning' : 'info';
  t.innerHTML = `${iconSvg(iconKey)} ${msg}`;
  c.appendChild(t);
  setTimeout(() => { t.style.animation = 'toast-out 0.3s ease forwards'; setTimeout(() => t.remove(), 300); }, 3000);
}

// INIT
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeModal();
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    const checkoutBtn = document.getElementById('checkout-btn');
    if (checkoutBtn && !checkoutBtn.disabled) doCheckout();
  }

  // ── Login form: Enter key triggers log in ──
  const loginPage = document.getElementById('login-page');
  if (loginPage && !loginPage.classList.contains('hidden')) {
    if (e.key === 'Enter') {
      const active = document.activeElement;
      const isInLoginForm = active && (active.id === 'login-username' || active.id === 'login-password');
      if (isInLoginForm) { e.preventDefault(); doLogin(); return; }
    }
  }

  // ── Sidebar keyboard navigation (Arrow keys + Enter) ──
  // Only active when app is visible, no modal open, no input focused
  const appPage = document.getElementById('app-page');
  if (!appPage || appPage.classList.contains('hidden')) return;
  if (document.getElementById('modal-container')?.children.length) return;
  const active = document.activeElement;
  const tag = active ? active.tagName.toLowerCase() : '';
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

  if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'Enter') {
    const navItems = Array.from(document.querySelectorAll('#sidebar-nav .nav-item[data-page], #sidebar-nav .nav-sub-item[data-page]'));
    if (!navItems.length) return;

    // Find currently active/focused item
    let focusedIdx = navItems.findIndex(el => el.classList.contains('kb-focus'));
    if (focusedIdx === -1) focusedIdx = navItems.findIndex(el => el.classList.contains('active'));

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      const nextIdx = focusedIdx <= 0 ? navItems.length - 1 : focusedIdx - 1;
      setKbFocus(navItems, nextIdx);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const nextIdx = focusedIdx >= navItems.length - 1 ? 0 : focusedIdx + 1;
      setKbFocus(navItems, nextIdx);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (focusedIdx >= 0 && navItems[focusedIdx]) {
        const page = navItems[focusedIdx].dataset.page;
        if (page) navigateTo(page);
      }
    }
  }
});

function setKbFocus(navItems, idx) {
  navItems.forEach(el => el.classList.remove('kb-focus'));
  navItems[idx].classList.add('kb-focus');
  navItems[idx].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

// Clear kb-focus when mouse is used
document.addEventListener('mousemove', () => {
  document.querySelectorAll('.kb-focus').forEach(el => el.classList.remove('kb-focus'));
}, { passive: true });

document.addEventListener('click', e => {
  const account = document.getElementById('topbar-account');
  if (!account) return;
  if (!account.contains(e.target)) closeAccountMenu();
});

document.addEventListener('DOMContentLoaded', async () => {
  await window.loadStateFromServer();

  // ── Employee recovery: rebuild s.employees from linked user accounts ──────
  // state.php sends employees[] directly (built from users WHERE employee_id IS NOT NULL).
  // That is the primary source — the recovery below is only a safety net for cases
  // where the server returns employees[] as empty (e.g. brand-new install) but users
  // already have employee_id values stamped on them.
  //
  // NOTE: state.php's users[] query returns a slim set of fields (id, name, username,
  // role, branchId, active) — it does NOT include employeeId, position, etc.
  // So we can't reconstruct from s.users here. Instead we rely on state.php's
  // dedicated employees[] array which IS built from the full users table.
  (function recoverEmployeesFromUsers() {
    const s = getState();
    const serverEmployees = s.employees || [];

    // If server sent employees, nothing to recover
    if (serverEmployees.length > 0) {
      console.log('[App] Employees loaded from server:', serverEmployees.length);
      return;
    }

    // Server sent empty — try to rebuild from any local-storage copy that may
    // have survived (pre-refresh optimistic save). Don't wipe what we have.
    console.log('[App] No employees from server yet — checking local fallback.');
  })();
  // ─────────────────────────────────────────────────────────────────────────

  bindOverviewClickFallback();

  // Restore session — check pos_currentUser first, then fall back to pos_state.currentUser
  let restoredUser = getStoredSessionUser();

  if (restoredUser) {
    restoredUser = normalizeUserRole(restoredUser);
    const validRoles = VALID_USER_ROLES;
    if (!restoredUser.role || !validRoles.includes(restoredUser.role)) {
      restoredUser.role = restoredUser.username === 'admin' ? 'admin' : 'cashier';
    }
    // Re-stamp into state and re-save pos_currentUser so it survives future reloads
    const s = getState();
    s.currentUser = restoredUser;
    saveState(s);
    persistSessionUser(restoredUser);
    const restoredPage = getStoredPage();
    showApp(restoredPage && canAccess(restoredPage) ? restoredPage : 'dashboard');
  } else {
    persistCurrentPage(null);
    showOverview();
  }

  renderOverviewBranches();
  applySvgToElement(document.getElementById('overview-page'));
});
// SYSTEM CONFIGURATION (Admin)
function getSystemConfig() {
  const s = getState();
  if (!s.systemConfig) {
    s.systemConfig = {
      depositPercent: 50,
      leadTimeStandard: '4-7',
      leadTimeBulk: '7-10',
      bulkQtyThreshold: 10000,
      discount1Threshold: 3000,
      discount1Percent: 5,
      discount2Threshold: 5000,
      discount2Percent: 8,
      plateCharge: 550,
      holidays: [],
      balanceRequiredBeforeDelivery: true,
      gcashNumber: '0917-000-0000',
      gcashName: 'South Pafps Packaging',
    };
  }
  return s.systemConfig;
}

function getCompanyInfo() {
  const cfg = getSystemConfig();
  return {
    name: cfg.businessName || 'SOUTH PAFPS PACKAGING SUPPLIES',
    address1: cfg.bizAddress1 || 'Unit F&G FACL Commercial Building, Pasong Buaya 2 Road',
    address2: cfg.bizAddress2 || 'Pasong Buaya 2, Imus, Cavite',
    tel: cfg.bizTel || 'Tel: (046) 436-9414',
  };
}

function showSystemConfigModal() {
  const cfg = getSystemConfig();
  showModal(`
    <div class="modal-header"><h2>${iconSvg('key')} System Configuration</h2><button class="btn-close-modal" onclick="closeModal()">✕</button></div>
    <div class="modal-body">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
        <div>
          <h4 style="font-size:13px;font-weight:700;color:var(--maroon);margin-bottom:12px;text-transform:uppercase;letter-spacing:0.5px">Payment Rules</h4>
          <div class="form-group"><label>Deposit Required (%)</label><input id="cfg-deposit" class="form-control" type="number" min="0" max="100" value="${cfg.depositPercent}"></div>
          <div class="form-group"><label>Balance Required Before Delivery</label>
            <div class="form-select-wrap"><select id="cfg-balance-delivery" class="form-control">
              <option value="1" ${cfg.balanceRequiredBeforeDelivery ? 'selected' : ''}>Yes – Enforce</option>
              <option value="0" ${!cfg.balanceRequiredBeforeDelivery ? 'selected' : ''}>No – Optional</option>
            </select></div>
          </div>
          <div class="form-group"><label>GCash Number</label><input id="cfg-gcash-num" class="form-control" value="${cfg.gcashNumber || ''}"></div>
          <div class="form-group"><label>GCash Account Name</label><input id="cfg-gcash-name" class="form-control" value="${cfg.gcashName || ''}"></div>
          <div class="form-group"><label>Plate Charge (₱)</label><input id="cfg-plate" class="form-control" type="number" min="0" value="${cfg.plateCharge}"></div>
        </div>
        <div>
          <h4 style="font-size:13px;font-weight:700;color:var(--maroon);margin-bottom:12px;text-transform:uppercase;letter-spacing:0.5px">Lead Time Rules</h4>
          <div class="form-group"><label>Standard Lead Time</label>
            <div class="form-select-wrap"><select id="cfg-lead-std" class="form-control">
              <option value="4-7" ${cfg.leadTimeStandard === '4-7' ? 'selected' : ''}>4–7 Business Days</option>
              <option value="7-10" ${cfg.leadTimeStandard === '7-10' ? 'selected' : ''}>7–10 Business Days</option>
              <option value="3-5" ${cfg.leadTimeStandard === '3-5' ? 'selected' : ''}>3–5 Business Days (Rush)</option>
            </select></div>
          </div>
          <div class="form-group"><label>Bulk Order Lead Time</label>
            <div class="form-select-wrap"><select id="cfg-lead-bulk" class="form-control">
              <option value="7-10" ${cfg.leadTimeBulk === '7-10' ? 'selected' : ''}>7–10 Business Days</option>
              <option value="10-14" ${cfg.leadTimeBulk === '10-14' ? 'selected' : ''}>10–14 Business Days</option>
            </select></div>
          </div>
          <div class="form-group"><label>Bulk Qty Threshold (pcs)</label><input id="cfg-bulk-qty" class="form-control" type="number" min="1" value="${cfg.bulkQtyThreshold}"></div>
          <h4 style="font-size:13px;font-weight:700;color:var(--maroon);margin:16px 0 12px;text-transform:uppercase;letter-spacing:0.5px">Discount Rules</h4>
          <div style="display:grid;grid-template-columns:1fr 80px;gap:8px;margin-bottom:10px">
            <div class="form-group" style="margin:0"><label>Threshold 1 (₱)</label><input id="cfg-disc1-thresh" class="form-control" type="number" min="0" value="${cfg.discount1Threshold}"></div>
            <div class="form-group" style="margin:0"><label>Disc. %</label><input id="cfg-disc1-pct" class="form-control" type="number" min="0" max="100" value="${cfg.discount1Percent}"></div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 80px;gap:8px">
            <div class="form-group" style="margin:0"><label>Threshold 2 (₱)</label><input id="cfg-disc2-thresh" class="form-control" type="number" min="0" value="${cfg.discount2Threshold}"></div>
            <div class="form-group" style="margin:0"><label>Disc. %</label><input id="cfg-disc2-pct" class="form-control" type="number" min="0" max="100" value="${cfg.discount2Percent}"></div>
          </div>
        </div>
      </div>
      <hr class="divider">
      <h4 style="font-size:13px;font-weight:700;color:var(--maroon);margin-bottom:12px;text-transform:uppercase;letter-spacing:0.5px">Holiday Calendar</h4>
      <div style="display:flex;gap:8px;margin-bottom:10px">
        <input id="cfg-holiday-date" class="form-control" type="date" style="flex:1">
        <input id="cfg-holiday-name" class="form-control" placeholder="Holiday name" style="flex:2">
        <button class="btn btn-outline btn-sm" onclick="addHolidayEntry()">Add</button>
      </div>
      <div id="cfg-holiday-list" style="max-height:140px;overflow-y:auto">
        ${(cfg.holidays || []).length ? cfg.holidays.map((h, i) => `
          <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 10px;background:var(--cream);border-radius:var(--radius-sm);margin-bottom:4px;font-size:13px">
            <span>${h.date} — ${h.name}</span>
            <button class="btn btn-sm btn-icon" onclick="removeHoliday(${i})">${iconSvg('error')}</button>
          </div>`).join('') : '<p class="text-sm text-muted">No holidays configured.</p>'}
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
      <button class="btn btn-maroon" onclick="saveSystemConfig()">Save Configuration</button>
    </div>`, 'modal-lg');
}

function addHolidayEntry() {
  const date = document.getElementById('cfg-holiday-date').value;
  const name = document.getElementById('cfg-holiday-name').value.trim();
  if (!date || !name) { showToast('Date and name required.', 'error'); return; }
  const s = getState();
  const cfg = getSystemConfig();
  cfg.holidays = cfg.holidays || [];
  if (cfg.holidays.find(h => h.date === date)) { showToast('Holiday already exists for this date.', 'warning'); return; }
  cfg.holidays.push({ date, name });
  cfg.holidays.sort((a, b) => a.date.localeCompare(b.date));
  s.systemConfig = cfg;
  saveState(s);
  DB.saveSystemConfig(cfg);
  showSystemConfigModal();
}

function removeHoliday(idx) {
  confirmModal({
    title: 'Remove Holiday',
    message: 'Are you sure you want to remove this holiday entry?',
    confirmText: 'Remove Holiday',
    icon: '🗓️',
    onConfirm: function () {
      const s = getState();
      const cfg = getSystemConfig();
      cfg.holidays.splice(idx, 1);
      s.systemConfig = cfg;
      saveState(s);
      DB.saveSystemConfig(cfg);
      showSystemConfigModal();
    }
  });
}

function saveSystemConfig() {
  const s = getState();
  const cfg = getSystemConfig();
  cfg.depositPercent = parseFloat(document.getElementById('cfg-deposit').value) || 50;
  cfg.balanceRequiredBeforeDelivery = document.getElementById('cfg-balance-delivery').value === '1';
  cfg.gcashNumber = document.getElementById('cfg-gcash-num').value.trim();
  cfg.gcashName = document.getElementById('cfg-gcash-name').value.trim();
  cfg.plateCharge = parseFloat(document.getElementById('cfg-plate').value) || 550;
  cfg.leadTimeStandard = document.getElementById('cfg-lead-std').value;
  cfg.leadTimeBulk = document.getElementById('cfg-lead-bulk').value;
  cfg.bulkQtyThreshold = parseInt(document.getElementById('cfg-bulk-qty').value) || 10000;
  cfg.discount1Threshold = parseFloat(document.getElementById('cfg-disc1-thresh').value) || 3000;
  cfg.discount1Percent = parseFloat(document.getElementById('cfg-disc1-pct').value) || 5;
  cfg.discount2Threshold = parseFloat(document.getElementById('cfg-disc2-thresh').value) || 5000;
  cfg.discount2Percent = parseFloat(document.getElementById('cfg-disc2-pct').value) || 8;
  s.systemConfig = cfg;
  recordAudit(s, { action: 'system_config_updated', message: 'System configuration updated by admin.' });
  saveState(s);
  DB.saveSystemConfig(cfg);
  closeModal();
  showToast('System configuration saved!', 'success');
}

// DISCOUNT MANAGEMENT (Admin)
function showDiscountRulesModal() {
  const cfg = getSystemConfig();
  showModal(`
    <div class="modal-header"><h2>${iconSvg('money')} Discount Rules</h2><button class="btn-close-modal" onclick="closeModal()">✕</button></div>
    <div class="modal-body">
      <div class="alert alert-info" style="margin-bottom:16px">${iconSvg('info')} Discounts are applied automatically based on order total thresholds.</div>
      <div class="data-card" style="margin-bottom:12px">
        <div class="data-card-body">
          <table class="data-table">
            <thead><tr><th>Rule</th><th>Threshold</th><th>Discount %</th><th>Status</th></tr></thead>
            <tbody>
              <tr><td>Tier 1 Discount</td><td>₱${fmt(cfg.discount1Threshold)}+</td><td>${cfg.discount1Percent}%</td><td><span class="badge badge-success">Active</span></td></tr>
              <tr><td>Tier 2 Discount (GP/Wrap)</td><td>₱${fmt(cfg.discount2Threshold)}+</td><td>${cfg.discount2Percent}%</td><td><span class="badge badge-success">Active</span></td></tr>
            </tbody>
          </table>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div class="form-group"><label>Tier 1 Threshold (₱)</label><input id="dr-t1" class="form-control" type="number" value="${cfg.discount1Threshold}"></div>
        <div class="form-group"><label>Tier 1 Percent (%)</label><input id="dr-p1" class="form-control" type="number" value="${cfg.discount1Percent}"></div>
        <div class="form-group"><label>Tier 2 Threshold (₱)</label><input id="dr-t2" class="form-control" type="number" value="${cfg.discount2Threshold}"></div>
        <div class="form-group"><label>Tier 2 Percent (%)</label><input id="dr-p2" class="form-control" type="number" value="${cfg.discount2Percent}"></div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
      <button class="btn btn-maroon" onclick="saveDiscountRules()">Save Rules</button>
    </div>`);
}

function saveDiscountRules() {
  const s = getState();
  const cfg = getSystemConfig();
  cfg.discount1Threshold = parseFloat(document.getElementById('dr-t1').value) || 3000;
  cfg.discount1Percent = parseFloat(document.getElementById('dr-p1').value) || 5;
  cfg.discount2Threshold = parseFloat(document.getElementById('dr-t2').value) || 5000;
  cfg.discount2Percent = parseFloat(document.getElementById('dr-p2').value) || 8;
  s.systemConfig = cfg;
  recordAudit(s, { action: 'discount_rules_updated', message: 'Discount rules updated.' });
  saveState(s);
  DB.saveSystemConfig(cfg);
  closeModal();
  showToast('Discount rules saved!', 'success');
}

// PAYMENT MANAGEMENT — Reports
function showDownpaymentReportModal() {
  const orders = getOrders();
  const cfg = getSystemConfig();
  const pct = cfg.depositPercent || 50;
  const rows = orders.filter(o => o.downpayment > 0).map(o => {
    const required = (o.total_amount || 0) * pct / 100;
    const met = o.downpayment >= required;
    return `<tr>
      <td class="td-mono">${String(o.id).padStart(6, '0')}</td>
      <td>${o.customer_name || '—'}</td>
      <td class="td-mono">₱${fmt(o.total_amount || 0)}</td>
      <td class="td-mono">₱${fmt(required)}</td>
      <td class="td-mono" style="color:${met ? 'var(--success)' : 'var(--danger)'}">₱${fmt(o.downpayment || 0)}</td>
      <td>${met ? '<span class="badge badge-success">Met</span>' : '<span class="badge badge-danger">Shortfall</span>'}</td>
      <td>${o.created_at ? fmtTime(o.created_at) : ''}</td>
    </tr>`;
  });
  showModal(`
    <div class="modal-header"><h2>${iconSvg('money')} ${pct}% Downpayment Report</h2><button class="btn-close-modal" onclick="closeModal()">✕</button></div>
    <div class="modal-body">
      <div class="data-card"><div class="data-card-body no-pad">
        <table class="data-table">
          <thead><tr><th>Order #</th><th>Customer</th><th>Total</th><th>Required (${pct}%)</th><th>Paid DP</th><th>Status</th><th>Date</th></tr></thead>
          <tbody>${rows.join('') || '<tr><td colspan="7" class="text-center text-muted" style="padding:24px">No downpayment records found.</td></tr>'}</tbody>
        </table>
      </div></div>
    </div>
    <div class="modal-footer"><button class="btn btn-outline" onclick="printContent(document.querySelector('#modal-container .modal-body').innerHTML,'Report — South Pafps')">${iconSvg('printer')} Print</button><button class="btn btn-maroon" onclick="closeModal()">Close</button></div>`, 'modal-lg');
}

function showBalanceDueReportModal() {
  const orders = getOrders();
  const withBalance = orders.filter(o => (o.balance || 0) > 0 && o.status !== 'cancelled');
  const total = withBalance.reduce((s, o) => s + (o.balance || 0), 0);
  const rows = withBalance.map(o => `<tr>
    <td class="td-mono">${String(o.id).padStart(6, '0')}</td>
    <td>${o.customer_name || '—'}</td>
    <td class="td-mono">₱${fmt(o.total_amount || 0)}</td>
    <td class="td-mono">₱${fmt(o.downpayment || 0)}</td>
    <td class="td-mono" style="font-weight:700;color:var(--danger)">₱${fmt(o.balance || 0)}</td>
    <td>${statusBadge(o.status)}</td>
    <td>${o.due_date || '—'}</td>
  </tr>`);
  showModal(`
    <div class="modal-header"><h2>${iconSvg('receipt')} Balance Due Report</h2><button class="btn-close-modal" onclick="closeModal()">✕</button></div>
    <div class="modal-body">
      <div class="alert alert-warning" style="margin-bottom:12px">${iconSvg('warning')} Total Outstanding Balance: <strong>₱${fmt(total)}</strong> across ${withBalance.length} orders</div>
      <div class="data-card"><div class="data-card-body no-pad">
        <table class="data-table">
          <thead><tr><th>Order #</th><th>Customer</th><th>Total</th><th>Downpayment</th><th>Balance Due</th><th>Status</th><th>Due Date</th></tr></thead>
          <tbody>${rows.join('') || '<tr><td colspan="7" class="text-center text-muted" style="padding:24px">No outstanding balances.</td></tr>'}</tbody>
        </table>
      </div></div>
    </div>
    <div class="modal-footer"><button class="btn btn-outline" onclick="printContent(document.querySelector('#modal-container .modal-body').innerHTML,'Report — South Pafps')">${iconSvg('printer')} Print</button><button class="btn btn-maroon" onclick="closeModal()">Close</button></div>`, 'modal-lg');
}

function showPaidOrdersReportModal() {
  const orders = getOrders();
  const paid = orders.filter(o => o.payment_status === 'Fully Paid' || o.status === 'completed');
  const total = paid.reduce((s, o) => s + (o.total_amount || 0), 0);
  const rows = paid.map(o => `<tr>
    <td class="td-mono">${String(o.id).padStart(6, '0')}</td>
    <td>${o.customer_name || '—'}</td>
    <td class="td-mono" style="font-weight:700;color:var(--success)">₱${fmt(o.total_amount || 0)}</td>
    <td>${o.payment_mode || '—'}</td>
    <td>${statusBadge(o.status)}</td>
    <td>${o.created_at ? fmtTime(o.created_at) : ''}</td>
  </tr>`);
  showModal(`
    <div class="modal-header"><h2>${iconSvg('check')} Paid Orders Report</h2><button class="btn-close-modal" onclick="closeModal()">✕</button></div>
    <div class="modal-body">
      <div class="alert alert-success-box" style="margin-bottom:12px;background:var(--success-l);border:1px solid var(--success);border-radius:var(--radius-sm);padding:10px 14px;font-size:13px">${iconSvg('check')} ${paid.length} fully paid orders · Total: <strong>₱${fmt(total)}</strong></div>
      <div class="data-card"><div class="data-card-body no-pad">
        <table class="data-table">
          <thead><tr><th>Order #</th><th>Customer</th><th>Total</th><th>Payment Mode</th><th>Status</th><th>Date</th></tr></thead>
          <tbody>${rows.join('') || '<tr><td colspan="6" class="text-center text-muted" style="padding:24px">No fully paid orders yet.</td></tr>'}</tbody>
        </table>
      </div></div>
    </div>
    <div class="modal-footer"><button class="btn btn-outline" onclick="printContent(document.querySelector('#modal-container .modal-body').innerHTML,'Report — South Pafps')">${iconSvg('printer')} Print</button><button class="btn btn-maroon" onclick="closeModal()">Close</button></div>`, 'modal-lg');
}

function showDiscountReportModal() {
  const s = getState();
  const discountSales = s.sales.filter(x => !x.voided && x.discountAmount > 0);
  const totalDiscount = discountSales.reduce((sum, x) => sum + x.discountAmount, 0);
  const rows = discountSales.map(sale => {
    const staff = s.users.find(u => u.id === sale.userId);
    const branch = s.branches.find(b => b.id === sale.branchId);
    return `<tr>
      <td class="td-mono">${sale.id.slice(-6).toUpperCase()}</td>
      <td>${branch?.name || '—'}</td>
      <td>${staff?.name || '—'}</td>
      <td class="td-mono">₱${fmt(sale.subtotal)}</td>
      <td class="td-mono" style="color:var(--danger)">-₱${fmt(sale.discountAmount)}</td>
      <td class="td-mono">₱${fmt(sale.total)}</td>
      <td>${sale.discountReason || '—'}</td>
      <td class="td-mono">${fmtTime(sale.createdAt)}</td>
    </tr>`;
  });
  showModal(`
    <div class="modal-header"><h2>${iconSvg('money')} Discount Report</h2><button class="btn-close-modal" onclick="closeModal()">✕</button></div>
    <div class="modal-body">
      <div class="alert alert-warning" style="margin-bottom:12px">${iconSvg('warning')} Total discounts given: <strong>₱${fmt(totalDiscount)}</strong> across ${discountSales.length} transactions</div>
      <div class="data-card"><div class="data-card-body no-pad">
        <table class="data-table">
          <thead><tr><th>Receipt #</th><th>Branch</th><th>Staff</th><th>Subtotal</th><th>Discount</th><th>Total</th><th>Reason</th><th>Time</th></tr></thead>
          <tbody>${rows.join('') || '<tr><td colspan="8" class="text-center text-muted" style="padding:24px">No discounted transactions.</td></tr>'}</tbody>
        </table>
      </div></div>
    </div>
    <div class="modal-footer"><button class="btn btn-outline" onclick="printContent(document.querySelector('#modal-container .modal-body').innerHTML,'Report — South Pafps')">${iconSvg('printer')} Print</button><button class="btn btn-maroon" onclick="closeModal()">Close</button></div>`, 'modal-lg');
}

function showDiscountImpactReportModal() {
  const s = getState();
  const discountSales = s.sales.filter(x => !x.voided && x.discountAmount > 0);
  const totalRevenue = s.sales.filter(x => !x.voided).reduce((sum, x) => sum + x.total, 0);
  const totalDiscount = discountSales.reduce((sum, x) => sum + x.discountAmount, 0);
  const impactPct = totalRevenue > 0 ? (totalDiscount / (totalRevenue + totalDiscount) * 100).toFixed(1) : '0.0';
  showModal(`
    <div class="modal-header"><h2>${iconSvg('chart')} Discount Impact Report</h2><button class="btn-close-modal" onclick="closeModal()">✕</button></div>
    <div class="modal-body">
      <div class="kpi-grid" style="grid-template-columns:repeat(3,1fr);margin-bottom:16px">
        <div class="kpi-card"><div class="kpi-header"><div class="kpi-label">Total Revenue</div></div><div class="kpi-value">₱${fmt(totalRevenue)}</div></div>
        <div class="kpi-card"><div class="kpi-header"><div class="kpi-label">Total Discounts</div></div><div class="kpi-value" style="color:var(--danger)">₱${fmt(totalDiscount)}</div></div>
        <div class="kpi-card"><div class="kpi-header"><div class="kpi-label">Impact %</div></div><div class="kpi-value">${impactPct}%</div></div>
      </div>
      <p class="text-sm text-muted">Discounts reduced potential revenue by <strong>${impactPct}%</strong>. ${discountSales.length} of ${s.sales.filter(x => !x.voided).length} transactions had a discount applied.</p>
    </div>
    <div class="modal-footer"><button class="btn btn-maroon" onclick="closeModal()">Close</button></div>`);
}

// PRODUCTION OVERSIGHT — Admin (full), Print (full), Staff (view-only)
function renderProductionOversight() {
  const _po = getState();
  if (!_po.currentUser) { accessDenied('Production Queue'); return; }
  const role = _po.currentUser.role;
  if (role !== 'admin' && role !== 'staff' && role !== 'print') { accessDenied('Production Queue'); return; }
  const isViewOnly = ['cashier', 'team_leader', 'staff'].includes(role); // cashier/TL = view only; admin + print = full access
  const orders = getOrders();
  const cfg = getSystemConfig();
  const now = new Date();

  const production = orders.filter(o => o.status === 'production' || o.status === 'approved' || o.status === 'pending');
  const delayed = production.filter(o => o.due_date && new Date(o.due_date) < now && o.status !== 'completed');
  const pending = orders.filter(o => o.status === 'pending');
  const approved = orders.filter(o => o.status === 'approved');
  const inProd = orders.filter(o => o.status === 'production');
  const dispatched = orders.filter(o => omIsDispatchReady(o));
  const completed = orders.filter(o => o.status === 'completed');

  document.getElementById('page-content').innerHTML = `
    <div class="page-header" style="display:flex;justify-content:space-between;align-items:flex-start">
      <div>
        <h1 class="page-title">Production Queue</h1>
        <p class="page-subtitle">Monitor all orders across production stages${isViewOnly ? ' &nbsp;·&nbsp; <span style="color:var(--ink-40);font-size:12px;font-weight:600">VIEW ONLY</span>' : ''}</p>
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-outline" onclick="showOnTimePerformanceModal()">On-Time Report</button>
        <button class="btn btn-outline" onclick="navigateTo('orders')">Manage Orders</button>
      </div>
    </div>
    ${delayed.length ? `<div class="alert alert-error-box">${iconSvg('warning')} ${delayed.length} order(s) are past their due date! <button class="btn btn-sm btn-danger" style="margin-left:12px" onclick="scrollToDelayed()">View Delayed</button></div>` : ''}
    <div class="kpi-grid" style="grid-template-columns:repeat(6,1fr)">
      <div class="kpi-card"><div class="kpi-header"><div class="kpi-label">Pending Approval</div><div class="kpi-icon gold">${iconSvg('clock')}</div></div><div class="kpi-value" style="color:${pending.length > 0 ? 'var(--warning)' : 'inherit'}">${pending.length}</div></div>
      <div class="kpi-card"><div class="kpi-header"><div class="kpi-label">Approved</div><div class="kpi-icon green">${iconSvg('check')}</div></div><div class="kpi-value" style="color:#0d9488">${approved.length}</div></div>
      <div class="kpi-card"><div class="kpi-header"><div class="kpi-label">In Production</div><div class="kpi-icon maroon">${iconSvg('printer')}</div></div><div class="kpi-value">${inProd.length}</div></div>
      <div class="kpi-card"><div class="kpi-header"><div class="kpi-label">Dispatched</div><div class="kpi-icon blue">${iconSvg('truck')}</div></div><div class="kpi-value">${dispatched.length}</div></div>
      <div class="kpi-card"><div class="kpi-header"><div class="kpi-label">Delayed</div><div class="kpi-icon maroon">${iconSvg('warning')}</div></div><div class="kpi-value" style="color:var(--danger)">${delayed.length}</div></div>
      <div class="kpi-card"><div class="kpi-header"><div class="kpi-label">Completed</div><div class="kpi-icon green">${iconSvg('check')}</div></div><div class="kpi-value">${completed.length}</div></div>
    </div>
    <div class="data-card" id="delayed-section">
      <div class="data-card-header"><span class="data-card-title" style="color:var(--danger)">${iconSvg('warning')} Delayed Orders</span><span class="badge badge-danger">${delayed.length}</span></div>
      <div class="data-card-body no-pad">
        <table class="data-table">
          <thead><tr><th>Order #</th><th>Customer</th><th>Status</th><th>Due Date</th><th>Days Late</th>${!isViewOnly ? '<th>Actions</th>' : ''}</tr></thead>
          <tbody>${delayed.length ? delayed.map(o => {
    const daysLate = Math.floor((now - new Date(o.due_date)) / 86400000);
    return `<tr style="background:var(--danger-l)">
              <td class="td-mono">${String(o.id).padStart(6, '0')}</td>
              <td>${o.customer_name || '—'}</td>
              <td>${statusBadge(o.status)}</td>
              <td class="td-mono">${o.due_date}</td>
              <td style="color:var(--danger);font-weight:700">${daysLate} day${daysLate !== 1 ? 's' : ''}</td>
              ${!isViewOnly ? `<td><button class="btn btn-sm btn-outline" onclick="editOrderModal('${o.id}')">Adjust Date</button></td>` : ''}
            </tr>`;
  }).join('') : `<tr><td colspan="${isViewOnly ? 5 : 6}" style="text-align:center;padding:20px;color:var(--ink-60)">No delayed orders.</td></tr>`}</tbody>
        </table>
      </div>
    </div>
    <div class="data-card">
      <div class="data-card-header"><span class="data-card-title">Production Queue — All Orders</span></div>
      <div class="data-card-body no-pad">
        <table class="data-table">
          <thead><tr><th>Order #</th><th>Customer</th><th>Product</th><th>Qty</th><th>Status</th><th>Lead Time</th><th>Due</th><th>Priority</th>${!isViewOnly ? '<th>Actions</th>' : ''}</tr></thead>
          <tbody>${[...orders].reverse().map(o => {
    const isPastDue = o.due_date && new Date(o.due_date) < now && o.status !== 'completed' && o.status !== 'cancelled';
    const leadTime = (o.quantity || 0) >= cfg.bulkQtyThreshold ? cfg.leadTimeBulk : cfg.leadTimeStandard;
    return `<tr ${isPastDue ? 'style="background:var(--danger-l)"' : ''}>
              <td class="td-mono">${String(o.id).padStart(6, '0')}</td>
              <td>${o.customer_name || '—'}</td>
              <td>${o.product_type || o.product_category || '—'}</td>
              <td>${o.quantity || '—'}</td>
              <td>${statusBadge(o.status)}</td>
              <td class="text-xs text-muted">${leadTime} days</td>
              <td class="td-mono">${o.due_date || '—'}</td>
              <td>${isPastDue ? '<span class="badge badge-danger">Urgent</span>' : o.status === 'pending' ? '<span class="badge badge-neutral">Normal</span>' : '—'}</td>
              ${!isViewOnly ? `<td style="display:flex;gap:4px">
                ${o.status === 'pending' ? `<button class="btn btn-sm btn-maroon" onclick="fulfillOrder('${o.id}')">Start Prod.</button>` : ''}
                ${o.status === 'production' ? `<button class="btn btn-sm btn-outline" onclick="navigateTo('print-qc')">${o.qc_status === 'rework' ? 'Rework' : 'QC'}</button>` : ''}
                <button class="btn btn-sm btn-outline" onclick="editOrderModal('${o.id}')">Edit</button>
              </td>` : ''}
            </tr>`;
  }).join('') || `<tr><td colspan="${isViewOnly ? 8 : 9}" style="text-align:center;padding:24px">No orders.</td></tr>`}</tbody>
        </table>
      </div>
    </div>`;
}

function showOnTimePerformanceModal() {
  const orders = getOrders();
  const now = new Date();
  const completed = orders.filter(o => o.status === 'completed' && o.due_date);
  const onTime = completed.filter(o => {
    const due = new Date(o.due_date);
    const created = new Date(o.created_at);
    return due >= created;
  });
  const pct = completed.length > 0 ? ((onTime.length / completed.length) * 100).toFixed(1) : '0';
  showModal(`
    <div class="modal-header"><h2>${iconSvg('chart')} On-Time Performance</h2><button class="btn-close-modal" onclick="closeModal()">✕</button></div>
    <div class="modal-body">
      <div class="kpi-grid" style="grid-template-columns:repeat(3,1fr);margin-bottom:16px">
        <div class="kpi-card"><div class="kpi-header"><div class="kpi-label">Completed Orders</div></div><div class="kpi-value">${completed.length}</div></div>
        <div class="kpi-card"><div class="kpi-header"><div class="kpi-label">On-Time</div></div><div class="kpi-value" style="color:var(--success)">${onTime.length}</div></div>
        <div class="kpi-card"><div class="kpi-header"><div class="kpi-label">On-Time Rate</div></div><div class="kpi-value">${pct}%</div></div>
      </div>
      <div style="background:var(--cream);border-radius:var(--radius-sm);padding:20px;text-align:center">
        <div style="font-size:48px;font-weight:700;color:${parseFloat(pct) >= 85 ? 'var(--success)' : parseFloat(pct) >= 65 ? 'var(--warning)' : 'var(--danger)'}">${pct}%</div>
        <div class="text-sm text-muted">On-Time Delivery Rate</div>
      </div>
    </div>
    <div class="modal-footer"><button class="btn btn-maroon" onclick="closeModal()">Close</button></div>`);
}

// READY FOR PICKUP — Branch Staff
function renderReadyForPickup() {
  const s = getState();
  const u = s.currentUser;
  const orders = getOrders();
  const cfg = getSystemConfig();
  const branchOrders = u.role === 'admin' ? orders : orders.filter(o =>
    !o.branch_id || o.branch_id === u.branchId || o.branch_staff?.toLowerCase().includes(u.name?.toLowerCase())
  );
  const ready = branchOrders.filter(o => omIsDispatchReady(o));
  const withBalance = ready.filter(o => (o.balance || 0) > 0);

  document.getElementById('page-content').innerHTML = `
    <div class="page-header">
      <h1 class="page-title">Ready for Pickup</h1>
      <p class="page-subtitle">${ready.length} order(s) ready · ${withBalance.length} with outstanding balance</p>
    </div>
    ${withBalance.length && cfg.balanceRequiredBeforeDelivery ? `<div class="alert alert-warning">${iconSvg('warning')} ${withBalance.length} order(s) have unpaid balance. Balance must be settled before release per policy.</div>` : ''}
    <div class="data-card">
      <div class="data-card-header"><span class="data-card-title">Dispatch Queue</span></div>
      <div class="data-card-body no-pad">
        <table class="data-table">
          <thead><tr><th>Order #</th><th>Customer</th><th>Contact</th><th>Total</th><th>Balance Due</th><th>Payment Mode</th><th>Actions</th></tr></thead>
          <tbody>${ready.length ? ready.map(o => {
    const hasBalance = (o.balance || 0) > 0;
    return `<tr ${hasBalance ? 'style="background:var(--warning-l)"' : ''}>
              <td class="td-mono">${String(o.id).padStart(6, '0')}</td>
              <td><strong>${o.customer_name || '—'}</strong><div class="text-xs text-muted">${o.notes || ''}</div></td>
              <td>${o.contact_person || '—'}<div class="td-mono text-xs">${o.phone || ''}</div></td>
              <td class="td-mono">₱${fmt(o.total_amount || 0)}</td>
              <td class="td-mono" style="font-weight:700;color:${hasBalance ? 'var(--danger)' : 'var(--success)'}">${hasBalance ? '₱' + fmt(o.balance) : 'PAID'}</td>
              <td>${o.payment_mode || '—'}</td>
              <td style="display:flex;gap:4px;flex-wrap:wrap">
                ${hasBalance ? `<button class="btn btn-sm btn-maroon" onclick="processBalancePayment('${o.id}')">Collect Balance</button>` : ''}
                <button class="btn btn-sm btn-outline" onclick="notifyCustomer('${o.id}')">Notify</button>
                <button class="btn btn-sm btn-success" onclick="markDelivered('${o.id}')" ${hasBalance && cfg.balanceRequiredBeforeDelivery ? 'disabled title="Settle balance first"' : ''} style="${!hasBalance ? 'background:var(--success);color:white;border-color:var(--success)' : ''}">${iconSvg('check')} Mark Delivered</button>
              </td>
            </tr>`;
  }).join('') : '<tr><td colspan="7" style="text-align:center;padding:32px;color:var(--ink-60)">No orders ready for pickup.</td></tr>'}</tbody>
        </table>
      </div>
    </div>`;
}

function processBalancePayment(orderId) {
  const orders = getOrders();
  const o = orders.find(x => String(x.id) === String(orderId));
  if (!o) return;
  showModal(`
    <div class="modal-header"><h2>${iconSvg('cash')} Collect Balance Payment</h2><button class="btn-close-modal" onclick="closeModal()">✕</button></div>
    <div class="modal-body">
      <div class="alert alert-info">Order #${String(o.id).padStart(6, '0')} · Customer: <strong>${o.customer_name}</strong></div>
      <div class="shift-summary-grid" style="grid-template-columns:repeat(3,1fr);margin:12px 0">
        <div class="shift-summary-item"><div class="shift-summary-label">Order Total</div><div class="shift-summary-value">₱${fmt(o.total_amount || 0)}</div></div>
        <div class="shift-summary-item"><div class="shift-summary-label">Already Paid</div><div class="shift-summary-value positive">₱${fmt(o.downpayment || 0)}</div></div>
        <div class="shift-summary-item"><div class="shift-summary-label">Balance Due</div><div class="shift-summary-value negative">₱${fmt(o.balance || 0)}</div></div>
      </div>
      <div class="form-group"><label>Payment Method</label>
        <div class="form-select-wrap"><select id="bp-method" class="form-control">
          <option value="Cash">Cash</option>
          <option value="GCash">GCash</option>
          <option value="Cash+GCash">Cash + GCash</option>
        </select></div>
      </div>
      <div class="payment-row"><span class="payment-label">${iconSvg('cash')} Cash</span><input type="number" id="bp-cash" class="payment-input" placeholder="0.00" min="0" value="${o.balance || 0}"></div>
      <div class="payment-row"><span class="payment-label">${iconSvg('phone')} GCash</span><input type="number" id="bp-gcash" class="payment-input" placeholder="0.00" min="0" value="0"></div>
      <div class="form-group" style="margin-top:12px"><label>GCash Reference # (if applicable)</label><input id="bp-gcash-ref" class="form-control" placeholder="e.g. 1234567890"></div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
      <button class="btn btn-maroon" onclick="confirmBalancePayment('${orderId}')">Confirm Payment</button>
    </div>`);
}

function confirmBalancePayment(orderId) {
  const cash = parseFloat(document.getElementById('bp-cash').value) || 0;
  const gcash = parseFloat(document.getElementById('bp-gcash').value) || 0;
  const gcashRef = document.getElementById('bp-gcash-ref').value.trim();
  const orders = getOrders();
  const o = orders.find(x => String(x.id) === String(orderId));
  if (!o) return;
  const total = cash + gcash;
  if (total < (o.balance || 0)) { showToast('Payment is less than balance due.', 'error'); return; }
  o.downpayment = (o.downpayment || 0) + total;
  o.balance = Math.max(0, (o.balance || 0) - total);
  o.payment_status = o.balance === 0 ? 'Fully Paid' : 'Partial';
  if (gcashRef) o.gcash_ref = gcashRef;
  const s = getState();
  recordAudit(s, { action: 'balance_payment', message: `Balance payment collected for Order #${orderId}`, meta: { cash, gcash, gcashRef } });
  saveState(s);
  saveOrders(orders);
  omSyncDispatchPaymentStatus(orderId, o.payment_status, o.balance);
  DB.updateOrder(orderId, { downpayment: o.downpayment, balance: o.balance, payment_status: o.payment_status });
  closeModal();
  showToast('Balance payment recorded!', 'success');
  renderReadyForPickup();
}

function notifyCustomer(orderId) {
  const orders = getOrders();
  const o = orders.find(x => String(x.id) === String(orderId));
  if (!o) return;
  showModal(`
    <div class="modal-header"><h2>${iconSvg('phone')} Notify Customer</h2><button class="btn-close-modal" onclick="closeModal()">✕</button></div>
    <div class="modal-body">
      <div class="alert alert-info">Notifying: <strong>${o.customer_name}</strong>${o.phone ? ` — ${o.phone}` : ''}</div>
      <div class="form-group"><label>Notification Message</label>
        <textarea class="form-control" id="notif-msg" rows="4">Good day, ${o.customer_name}! Your order #${String(o.id).padStart(6, '0')} from South Pafps Packaging Supplies is ready for pickup.${(o.balance || 0) > 0 ? ` Please bring your remaining balance of ₱${fmt(o.balance)}.` : ''} Thank you!</textarea>
      </div>
      <p class="text-xs text-muted">Copy this message and send via SMS/Messenger/Viber to the customer.</p>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeModal()">Close</button>
      <button class="btn btn-maroon" onclick="copyNotification()">Copy Message</button>
    </div>`);
}

function copyNotification() {
  const msg = document.getElementById('notif-msg').value;
  navigator.clipboard?.writeText(msg).then(() => showToast('Message copied to clipboard!', 'success')).catch(() => showToast('Copy failed — please copy manually.', 'error'));
}

function markDelivered(orderId) {
  const orders = getOrders();
  const o = orders.find(x => String(x.id) === String(orderId));
  if (!o) return;
  const cfg = getSystemConfig();
  if ((o.balance || 0) > 0 && cfg.balanceRequiredBeforeDelivery) {
    showToast('Balance must be fully settled before marking as delivered.', 'error');
    return;
  }
  showModal(`
    <div class="modal-header"><h2>${iconSvg('check')} Mark as Delivered</h2><button class="btn-close-modal" onclick="closeModal()">✕</button></div>
    <div class="modal-body">
      <div class="form-group"><label>Delivery Date</label><input id="delivery-date" class="form-control" type="date" value="${new Date().toISOString().slice(0, 10)}"></div>
      <div class="form-group"><label>Received By (Customer Representative)</label><input id="delivery-receiver" class="form-control" placeholder="Name of person who received the order"></div>
      <div class="form-group"><label>Delivery Notes</label><textarea id="delivery-notes" class="form-control" rows="2" placeholder="Optional notes..."></textarea></div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
      <button class="btn btn-maroon" onclick="confirmDelivered('${orderId}')">Confirm Delivery</button>
    </div>`);
}

function confirmDelivered(orderId) {
  const deliveryDate = document.getElementById('delivery-date').value;
  const receiver = document.getElementById('delivery-receiver').value.trim();
  const notes = document.getElementById('delivery-notes').value.trim();
  const orders = getOrders();
  const o = orders.find(x => String(x.id) === String(orderId));
  if (!o) return;
  if (!omIsDispatchReady(o)) { showToast('Only QC-passed dispatch jobs can be delivered.', 'error'); return; }
  o.status = 'completed';
  o.delivery_date = deliveryDate;
  o.received_by = receiver;
  if (notes) o.delivery_notes = notes;
  const s = getState();
  recordAudit(s, { action: 'order_delivered', message: `Order #${orderId} marked as delivered`, meta: { deliveryDate, receiver } });
  saveState(s);
  saveOrders(orders);
  DB.updateOrder(orderId, { status: 'completed', qc_status: 'passed', delivery_date: o.delivery_date, received_by: o.received_by });
  // FIX 2: Deduct stock and push to receipt history on delivery (was missing here)
  omDeductOrderStock(orderId);
  omPushToReceiptHistory(orderId);
  closeModal();
  showToast('Order marked as delivered!', 'success');
  renderReadyForPickup();
}

// PRINTING PERSONNEL — Production Module
function renderPrintProductionDashboard() {
  const s = getState();
  const u = s.currentUser;
  const orders = getOrders();
  const today = new Date().toDateString();

  const pending = orders.filter(o => o.status === 'pending');
  const inProd = orders.filter(o => o.status === 'production');
  const dispatched = orders.filter(o => omIsDispatchReady(o));
  const completedToday = orders.filter(o => o.status === 'completed' && o.delivery_date && new Date(o.delivery_date).toDateString() === today);

  document.getElementById('page-content').innerHTML = `
    <div class="page-header">
      <h1 class="page-title">Production Dashboard</h1>
      <p class="page-subtitle">Good ${getGreeting()}, ${(u.name || u.username || 'there').split(' ')[0]}. Here's today's production status.</p>
    </div>
    <div class="kpi-grid">
      <div class="kpi-card"><div class="kpi-header"><div class="kpi-label">Pending Orders</div><div class="kpi-icon gold">${iconSvg('clock')}</div></div><div class="kpi-value">${pending.length}</div></div>
      <div class="kpi-card"><div class="kpi-header"><div class="kpi-label">In Production</div><div class="kpi-icon maroon">${iconSvg('printer')}</div></div><div class="kpi-value">${inProd.length}</div></div>
      <div class="kpi-card"><div class="kpi-header"><div class="kpi-label">Ready for Dispatch</div><div class="kpi-icon blue">${iconSvg('truck')}</div></div><div class="kpi-value">${dispatched.length}</div></div>
      <div class="kpi-card"><div class="kpi-header"><div class="kpi-label">Completed Today</div><div class="kpi-icon green">${iconSvg('check')}</div></div><div class="kpi-value">${completedToday.length}</div></div>
    </div>

    <div class="data-card">
      <div class="data-card-header"><span class="data-card-title">Urgent / Priority Orders</span></div>
      <div class="data-card-body no-pad">
        <table class="data-table">
          <thead><tr><th>Order #</th><th>Customer</th><th>Product</th><th>Qty</th><th>Due</th><th>Status</th><th>DP Verified</th><th>Action</th></tr></thead>
          <tbody>${[...pending, ...inProd].sort((a, b) => (a.due_date || '9999') > (b.due_date || '9999') ? 1 : -1).slice(0, 10).map(o => {
    const dpVerified = (o.downpayment || 0) > 0;
    const isPastDue = o.due_date && new Date(o.due_date) < new Date();
    return `<tr ${isPastDue ? 'style="background:var(--danger-l)"' : ''}>
              <td class="td-mono">${String(o.id).padStart(6, '0')}</td>
              <td>${o.customer_name || '—'}</td>
              <td>${o.product_type || o.product_category || '—'}</td>
              <td>${o.quantity || '—'}</td>
              <td class="td-mono">${o.due_date || '—'}</td>
              <td>${omDisplayStatusBadge(o)}</td>
              <td>${dpVerified ? '<span class="badge badge-success">Verified</span>' : '<span class="badge badge-danger">Not Paid</span>'}</td>
              <td>${o.status === 'pending' && dpVerified ? `<button class="btn btn-sm btn-maroon" onclick="acceptOrderForProduction('${o.id}')">Accept</button>` : o.status === 'production' ? `<button class="btn btn-sm btn-outline" onclick="navigateTo('print-qc')">${o.qc_status === 'rework' ? 'Rework' : 'QC'}</button>` : '<span class="text-muted text-xs">Awaiting DP</span>'}</td>
            </tr>`;
  }).join('') || '<tr><td colspan="8" style="text-align:center;padding:24px;color:var(--ink-60)">No pending or in-production orders.</td></tr>'}</tbody>
        </table>
      </div>
    </div>`;
}

function renderPrintOrders() {
  const _pr = getState();
  if (_pr.currentUser && ['cashier', 'team_leader', 'staff'].includes(_pr.currentUser.role)) { accessDenied('Production Queue'); return; }
  const s = getState();
  const orders = getOrders();
  const cfg = getSystemConfig();

  document.getElementById('page-content').innerHTML = `
    <div class="page-header">
      <h1 class="page-title">Production Queue</h1>
      <p class="page-subtitle">Orders assigned for printing & production</p>
    </div>
    <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap">
      <button class="btn btn-outline btn-sm" onclick="renderPrintOrders()">All</button>
      <button class="btn btn-outline btn-sm" onclick="filterPrintOrders('pending')">Pending</button>
      <button class="btn btn-outline btn-sm" onclick="filterPrintOrders('production')">In Production</button>
      <button class="btn btn-outline btn-sm" onclick="filterPrintOrders('dispatch')">Ready</button>
    </div>
    <div class="data-card"><div class="data-card-body no-pad">
      <table class="data-table" id="print-orders-table">
        <thead><tr><th>Order #</th><th>Customer</th><th>Product</th><th>Qty</th><th>Print Color</th><th>Lead Time</th><th>Due</th><th>DP</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>${renderPrintOrderRows(orders)}</tbody>
      </table>
    </div></div>`;
}

function renderPrintOrderRows(orders) {
  const cfg = getSystemConfig();
  if (!orders.length) return '<tr><td colspan="10" style="text-align:center;padding:24px;color:var(--ink-60)">No orders.</td></tr>';
  return [...orders].filter(o => o.status !== 'completed' && o.status !== 'cancelled').reverse().map(o => {
    const dpVerified = (o.downpayment || 0) > 0;
    const leadTime = (o.quantity || 0) >= cfg.bulkQtyThreshold ? cfg.leadTimeBulk : cfg.leadTimeStandard;
    const isPastDue = o.due_date && new Date(o.due_date) < new Date() && o.status !== 'completed';
    return `<tr ${isPastDue ? 'style="background:var(--danger-l)"' : ''}>
      <td class="td-mono">${String(o.id).padStart(6, '0')}</td>
      <td><strong>${o.customer_name || '—'}</strong><div class="text-xs text-muted">${o.contact_person || ''}</div></td>
      <td>${o.product_type || o.product_category || '—'}<div class="text-xs text-muted">${o.notes || ''}</div></td>
      <td>${o.quantity || '—'}</td>
      <td>${o.print_color || '—'}</td>
      <td class="text-xs text-muted">${leadTime} days</td>
      <td class="td-mono">${o.due_date || '—'}</td>
      <td>${dpVerified ? '<span class="badge badge-success">Paid</span>' : '<span class="badge badge-danger">Unpaid</span>'}</td>
      <td>${omDisplayStatusBadge(o)}</td>
      <td style="display:flex;gap:4px;flex-wrap:wrap">
        ${o.status === 'pending' ? `<button class="btn btn-sm btn-maroon" onclick="acceptOrderForProduction('${o.id}')" ${!dpVerified ? 'disabled title="Downpayment not verified"' : ''}>Accept</button>` : ''}
        ${o.status === 'production' ? `<button class="btn btn-sm btn-outline" onclick="navigateTo('print-qc')">${o.qc_status === 'rework' ? 'Rework' : 'QC'}</button>` : ''}
        <button class="btn btn-sm btn-outline" onclick="viewOrderDetails('${o.id}')">Details</button>
        ${o.status === 'production' ? `<button class="btn btn-sm btn-outline" onclick="reportDelayModal('${o.id}')">Report Delay</button>` : ''}
      </td>
    </tr>`;
  }).join('');
}

function filterPrintOrders(status) {
  const orders = getOrders().filter(o => status === 'dispatch' ? omIsDispatchReady(o) : o.status === status);
  document.querySelector('#print-orders-table tbody').innerHTML = renderPrintOrderRows(orders);
}

function acceptOrderForProduction(orderId) {
  const orders = getOrders();
  const o = orders.find(x => String(x.id) === String(orderId));
  if (!o) return;
  if (!(o.downpayment > 0)) { showToast('Cannot accept — downpayment not verified.', 'error'); return; }
  showModal(`
    <div class="modal-header"><h2>${iconSvg('printer')} Accept Order for Production</h2><button class="btn-close-modal" onclick="closeModal()">✕</button></div>
    <div class="modal-body">
      <div class="alert alert-info">
        <strong>Order #${String(o.id).padStart(6, '0')}</strong><br>
        Customer: ${o.customer_name}<br>
        Product: ${o.product_type || o.product_category || '—'} · Qty: ${o.quantity}<br>
        Print Color: ${o.print_color || '—'}<br>
        Notes: ${o.notes || 'None'}
      </div>
      <div class="form-group"><label>Production Notes</label><textarea id="prod-notes" class="form-control" rows="3" placeholder="Materials prepared, printer assigned, special instructions..."></textarea></div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
      <button class="btn btn-maroon" onclick="confirmAcceptProduction('${orderId}')">Start Production</button>
    </div>`);
}

function confirmAcceptProduction(orderId) {
  const notes = document.getElementById('prod-notes').value.trim();
  const orders = getOrders();
  const o = orders.find(x => String(x.id) === String(orderId));
  if (!o) return;
  o.status = 'production';
  if (notes) o.production_notes = notes;
  o.production_started_at = new Date().toISOString();
  const s = getState();
  recordAudit(s, { action: 'production_started', message: `Production started for Order #${orderId}`, meta: { notes } });
  saveState(s);
  saveOrders(orders);
  DB.updateOrder(orderId, { status: 'production', production_notes: o.production_notes, production_started_at: o.production_started_at });
  closeModal();
  showToast('Order accepted — Production started!', 'success');
  renderPrintOrders();
}

function viewOrderDetails(orderId) {
  const orders = getOrders();
  const o = orders.find(x => String(x.id) === String(orderId));
  if (!o) return;
  showModal(`
    <div class="modal-header"><h2>${iconSvg('clipboard')} Order #${String(o.id).padStart(6, '0')} Details</h2><button class="btn-close-modal" onclick="closeModal()">✕</button></div>
    <div class="modal-body">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
        <div>
          <h4 style="font-size:12px;text-transform:uppercase;letter-spacing:0.5px;color:var(--ink-60);margin-bottom:10px">Customer Info</h4>
          <div class="text-sm" style="line-height:2"><strong>Company:</strong> ${o.customer_name || '—'}<br><strong>Contact:</strong> ${o.contact_person || '—'}<br><strong>Phone:</strong> ${o.phone || '—'}<br><strong>Email:</strong> ${o.email || '—'}<br><strong>Address:</strong> ${o.address || '—'}</div>
        </div>
        <div>
          <h4 style="font-size:12px;text-transform:uppercase;letter-spacing:0.5px;color:var(--ink-60);margin-bottom:10px">Order Info</h4>
          <div class="text-sm" style="line-height:2"><strong>Category:</strong> ${o.product_category || '—'}<br><strong>Type/Size:</strong> ${o.product_type || '—'}<br><strong>Quantity:</strong> ${o.quantity || '—'}<br><strong>Print Color:</strong> ${o.print_color || '—'}<br><strong>Plate Note:</strong> ${o.plate_note || '—'}</div>
        </div>
      </div>
      <hr class="divider">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
        <div>
          <h4 style="font-size:12px;text-transform:uppercase;letter-spacing:0.5px;color:var(--ink-60);margin-bottom:10px">Payment</h4>
          <div class="text-sm" style="line-height:2"><strong>Total:</strong> ₱${fmt(o.total_amount || 0)}<br><strong>Downpayment:</strong> ₱${fmt(o.downpayment || 0)}<br><strong>Balance:</strong> ₱${fmt(o.balance || 0)}<br><strong>Mode:</strong> ${o.payment_mode || '—'}<br><strong>Status:</strong> ${o.payment_status || '—'}</div>
        </div>
        <div>
          <h4 style="font-size:12px;text-transform:uppercase;letter-spacing:0.5px;color:var(--ink-60);margin-bottom:10px">Production</h4>
          <div class="text-sm" style="line-height:2"><strong>Status:</strong> ${o.status}<br><strong>Due Date:</strong> ${o.due_date || '—'}<br><strong>Started:</strong> ${o.production_started_at ? fmtTime(o.production_started_at) : '—'}<br><strong>Notes:</strong> ${o.notes || '—'}<br><strong>Prod. Notes:</strong> ${o.production_notes || '—'}</div>
        </div>
      </div>
    </div>
    <div class="modal-footer"><button class="btn btn-outline" onclick="printContent(document.querySelector('#modal-container .modal-body').innerHTML,'Report — South Pafps')">${iconSvg('printer')} Print</button><button class="btn btn-maroon" onclick="closeModal()">Close</button></div>`, 'modal-lg');
}

function updateOrderStatus(orderId, newStatus) {
  const orders = getOrders();
  const o = orders.find(x => String(x.id) === String(orderId));
  if (!o) return;
  if (newStatus === 'dispatch' && !omIsDispatchReady(o)) {
    showToast('Only QC-passed jobs can be moved to dispatch.', 'error');
    return;
  }
  o.status = newStatus;
  const s = getState();
  recordAudit(s, { action: 'order_status_updated', message: `Order #${orderId} → ${newStatus}`, meta: { newStatus } });
  saveState(s);
  saveOrders(orders);
  DB.updateOrder(orderId, { status: newStatus });
  showToast(`Order moved to ${newStatus}.`, 'success');
  if (currentPage === 'print-orders') renderPrintOrders();
  else if (currentPage === 'print-qc') renderQualityControl();
  else renderOrders();
}

function reportDelayModal(orderId) {
  const orders = getOrders();
  const o = orders.find(x => String(x.id) === String(orderId));
  if (!o) return;
  showModal(`
    <div class="modal-header"><h2>${iconSvg('warning')} Report Delay — Order #${String(o.id).padStart(6, '0')}</h2><button class="btn-close-modal" onclick="closeModal()">✕</button></div>
    <div class="modal-body">
      <div class="form-group"><label>Reason for Delay</label><textarea id="delay-reason" class="form-control" rows="3" placeholder="Describe why the order is delayed..."></textarea></div>
      <div class="form-group"><label>New Expected Completion Date</label><input id="delay-new-date" class="form-control" type="date"></div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
      <button class="btn btn-danger" onclick="confirmReportDelay('${orderId}')">Submit Delay Report</button>
    </div>`);
}

function confirmReportDelay(orderId) {
  const reason = document.getElementById('delay-reason').value.trim();
  const newDate = document.getElementById('delay-new-date').value;
  if (!reason) { showToast('Reason is required.', 'error'); return; }
  const orders = getOrders();
  const o = orders.find(x => String(x.id) === String(orderId));
  if (!o) return;
  o.delay_reason = reason;
  if (newDate) o.due_date = newDate;
  const s = getState();
  recordAudit(s, { action: 'delay_reported', message: `Delay reported for Order #${orderId}: ${reason}`, meta: { reason, newDate } });
  saveState(s);
  saveOrders(orders);
  DB.updateOrder(orderId, { delay_reason: reason, due_date: o.due_date });
  closeModal();
  showToast('Delay reported.', 'warning');
  renderPrintOrders();
}

// QUALITY CONTROL — Printing Personnel
function renderQualityControl() {
  const _qc = getState();
  if (_qc.currentUser && ['cashier', 'team_leader', 'staff'].includes(_qc.currentUser.role)) { accessDenied('Quality Control'); return; }
  const orders = getOrders();
  const inProd = orders.filter(o => omNeedsQcReview(o));
  const qcPassed = orders.filter(o => o.qc_status === 'passed');
  const qcFailed = orders.filter(o => o.qc_status === 'failed');

  document.getElementById('page-content').innerHTML = `
    <div class="page-header">
      <h1 class="page-title">Quality Control</h1>
      <p class="page-subtitle">${inProd.length} orders awaiting QC inspection</p>
    </div>
    <div class="kpi-grid" style="grid-template-columns:repeat(3,1fr)">
      <div class="kpi-card"><div class="kpi-header"><div class="kpi-label">In Production (QC Pending)</div><div class="kpi-icon gold">${iconSvg('clock')}</div></div><div class="kpi-value">${inProd.length}</div></div>
      <div class="kpi-card"><div class="kpi-header"><div class="kpi-label">QC Passed</div><div class="kpi-icon green">${iconSvg('check')}</div></div><div class="kpi-value">${qcPassed.length}</div></div>
      <div class="kpi-card"><div class="kpi-header"><div class="kpi-label">QC Failed / Rework</div><div class="kpi-icon maroon">${iconSvg('error')}</div></div><div class="kpi-value">${qcFailed.length}</div></div>
    </div>
    <div class="data-card">
      <div class="data-card-header"><span class="data-card-title">Orders Awaiting Inspection</span></div>
      <div class="data-card-body no-pad">
        <table class="data-table">
          <thead><tr><th>Order #</th><th>Customer</th><th>Product</th><th>Qty</th><th>QC Status</th><th>Actions</th></tr></thead>
          <tbody>${inProd.length ? inProd.map(o => {
    const qcStatus = o.qc_status || 'pending';
    return `<tr>
              <td class="td-mono">${String(o.id).padStart(6, '0')}</td>
              <td><strong>${o.customer_name || '—'}</strong></td>
              <td>${o.product_type || o.product_category || '—'}</td>
              <td>${o.quantity || '—'}</td>
              <td>${qcStatus === 'passed' ? '<span class="badge badge-success">Passed</span>' : qcStatus === 'failed' ? '<span class="badge badge-danger">Failed</span>' : '<span class="badge badge-neutral">Pending</span>'}</td>
              <td style="display:flex;gap:4px">
                <button class="btn btn-sm btn-success" onclick="qcPass('${o.id}')" style="background:var(--success);color:white;border-color:var(--success)">${iconSvg('check')} Pass</button>
                <button class="btn btn-sm btn-danger" onclick="qcFailModal('${o.id}')">${iconSvg('error')} Fail</button>
                <button class="btn btn-sm btn-outline" onclick="viewOrderDetails('${o.id}')">Details</button>
              </td>
            </tr>`;
  }).join('') : '<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--ink-60)">No orders in production for QC.</td></tr>'}</tbody>
        </table>
      </div>
    </div>
    ${qcFailed.length ? `<div class="data-card">
      <div class="data-card-header"><span class="data-card-title" style="color:var(--danger)">Failed QC / Rework Required</span></div>
      <div class="data-card-body no-pad">
        <table class="data-table">
          <thead><tr><th>Order #</th><th>Customer</th><th>Fail Reason</th><th>Actions</th></tr></thead>
          <tbody>${qcFailed.map(o => `<tr style="background:var(--danger-l)">
            <td class="td-mono">${String(o.id).padStart(6, '0')}</td>
            <td>${o.customer_name || '—'}</td>
            <td>${o.qc_fail_reason || '—'}</td>
            <td><button class="btn btn-sm btn-maroon" onclick="qcRework('${o.id}')">Send to Rework</button></td>
          </tr>`).join('')}</tbody>
        </table>
      </div>
    </div>` : ''}`;
}

function qcPass(orderId) {
  const orders = getOrders();
  const o = orders.find(x => String(x.id) === String(orderId));
  if (!o) return;
  o.status = 'dispatch';
  o.qc_status = 'passed';
  o.qc_fail_reason = '';
  o.qc_passed_at = new Date().toISOString();
  const s = getState();
  recordAudit(s, { action: 'qc_passed', message: `QC passed for Order #${orderId}` });
  saveState(s);
  saveOrders(orders);
  DB.updateOrder(orderId, { status: 'dispatch', qc_status: 'passed', qc_passed_at: o.qc_passed_at, qc_fail_reason: null });
  showToast('QC passed! Order is ready for dispatch.', 'success');
  renderQualityControl();
}

function qcFailModal(orderId) {
  showModal(`
    <div class="modal-header"><h2>${iconSvg('error')} QC Failed — Order #${String(orderId).padStart(6, '0')}</h2><button class="btn-close-modal" onclick="closeModal()">✕</button></div>
    <div class="modal-body">
      <div class="form-group"><label>Defect / Fail Reason</label><textarea id="qc-fail-reason" class="form-control" rows="3" placeholder="Describe the defect (print misalignment, color issue, die-cut error...)"></textarea></div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
      <button class="btn btn-danger" onclick="confirmQcFail('${orderId}')">Mark as Failed</button>
    </div>`);
}

function confirmQcFail(orderId) {
  const reason = document.getElementById('qc-fail-reason').value.trim();
  if (!reason) { showToast('Please enter the fail reason.', 'error'); return; }
  const orders = getOrders();
  const o = orders.find(x => String(x.id) === String(orderId));
  if (!o) return;
  o.status = 'production';
  o.qc_status = 'failed';
  o.qc_fail_reason = reason;
  const s = getState();
  recordAudit(s, { action: 'qc_failed', message: `QC failed for Order #${orderId}: ${reason}`, meta: { reason } });
  saveState(s);
  saveOrders(orders);
  DB.updateOrder(orderId, { status: 'production', qc_status: 'failed', qc_fail_reason: reason });
  closeModal();
  showToast('Order marked as QC failed.', 'error');
  renderQualityControl();
}

function qcRework(orderId) {
  const orders = getOrders();
  const o = orders.find(x => String(x.id) === String(orderId));
  if (!o) return;
  o.qc_status = 'rework';
  o.status = 'production';
  const s = getState();
  recordAudit(s, { action: 'qc_rework', message: `Order #${orderId} sent for rework` });
  saveState(s);
  saveOrders(orders);
  DB.updateOrder(orderId, { qc_status: 'rework', status: 'production' });
  showToast('Order sent for rework.', 'warning');
  renderQualityControl();
}

// PRINTING INVENTORY — mirrors Branch Staff Inventory design
var _printInvFilter = { search: '', status: 'all' };
function clearPrintInvFilter() { _printInvFilter = { search: '', status: 'all' }; _renderPrintInventoryPage(); }

function renderMaterialsTracking() {
  _printInvFilter = { search: '', status: 'all' };
  _renderPrintInventoryPage();
}

function _renderPrintInventoryPage() {
  const s = getState();
  const isAdmin = s.currentUser && s.currentUser.role === 'admin';
  if (s.currentUser && ['cashier', 'team_leader', 'staff'].includes(s.currentUser.role)) { accessDenied('Printing Inventory'); return; }

  const allVariants = (s.printProducts || []).filter(p => p.active).flatMap(p =>
    (p.variants || []).map(v => ({ p, v, reorderLevel: v.reorderLevel ?? 20 }))
  );

  const totalVariants = allVariants.length;
  const lowStockCount = allVariants.filter(({ v, reorderLevel }) => v.stock > 0 && v.stock <= reorderLevel).length;
  const outOfStockCount = allVariants.filter(({ v }) => v.stock === 0).length;
  const healthyCount = totalVariants - lowStockCount - outOfStockCount;

  const q = (_printInvFilter.search || '').toLowerCase();
  const filtered = allVariants.filter(({ p, v, reorderLevel }) => {
    const matchSearch = !q ||
      p.name.toLowerCase().includes(q) ||
      (p.materialType || '').toLowerCase().includes(q) ||
      v.name.toLowerCase().includes(q) ||
      (v.size || '').toLowerCase().includes(q) ||
      (v.color || '').toLowerCase().includes(q) ||
      (v.sku || '').toLowerCase().includes(q);
    const lvl = v.stock === 0 ? 'out' : v.stock <= reorderLevel ? 'low' : 'ok';
    const matchStatus =
      _printInvFilter.status === 'all' ? true :
        _printInvFilter.status === 'low' ? lvl === 'low' :
          _printInvFilter.status === 'out' ? lvl === 'out' :
            _printInvFilter.status === 'ok' ? lvl === 'ok' : true;
    return matchSearch && matchStatus;
  });

  document.getElementById('page-content').innerHTML = `
    <div class="page-header" style="display:flex;justify-content:space-between;align-items:flex-start">
      <div><h1 class="page-title">Printing Inventory</h1><p class="page-subtitle">Stock monitoring for printing department materials</p></div>
    </div>

    <div class="kpi-grid">
      <div class="kpi-card"><div class="kpi-header"><div class="kpi-label">Total Variants</div><div class="kpi-icon blue">${iconSvg('box')}</div></div><div class="kpi-value">${totalVariants}</div><div class="kpi-sub">${(s.printProducts || []).filter(p => p.active).length} active materials</div></div>
      <div class="kpi-card"><div class="kpi-header"><div class="kpi-label">Healthy Stock</div><div class="kpi-icon green">${iconSvg('check')}</div></div><div class="kpi-value">${healthyCount}</div><div class="kpi-sub">Above reorder level</div></div>
      <div class="kpi-card" style="cursor:pointer" onclick="_printInvFilter.status='low';_renderPrintInventoryPage()"><div class="kpi-header"><div class="kpi-label">Low Stock</div><div class="kpi-icon gold">${iconSvg('warning')}</div></div><div class="kpi-value" style="color:${lowStockCount > 0 ? 'var(--warning)' : 'inherit'}">${lowStockCount}</div><div class="kpi-sub">At or below reorder level</div></div>
      <div class="kpi-card" style="cursor:pointer" onclick="_printInvFilter.status='out';_renderPrintInventoryPage()"><div class="kpi-header"><div class="kpi-label">Out of Stock</div><div class="kpi-icon maroon">${iconSvg('error')}</div></div><div class="kpi-value" style="color:${outOfStockCount > 0 ? 'var(--danger)' : 'inherit'}">${outOfStockCount}</div><div class="kpi-sub">Zero units remaining</div></div>
    </div>

    ${(lowStockCount + outOfStockCount) > 0 ? '<div class="alert alert-error-box">' + iconSvg('warning') + ' ' + (lowStockCount + outOfStockCount) + ' material variant(s) need attention. Click the KPI cards above to filter.</div>' : ''}

    <div class="data-card">
      <div class="data-card-header">
        <span class="data-card-title">Stock Levels</span>
        <span class="text-sm text-muted">${filtered.length} of ${totalVariants} variants</span>
      </div>
      <div class="data-card-body" style="padding:12px 16px;border-bottom:1px solid var(--ink-10);display:flex;gap:10px;flex-wrap:wrap;align-items:center">
        <input class="form-control" style="flex:1;min-width:200px;max-width:360px"
          placeholder="Search type, size, color, material..."
          value="${_printInvFilter.search}"
          oninput="_printInvFilter.search=this.value;_renderPrintInventoryPage()">
        <select class="form-control" style="width:auto" onchange="_printInvFilter.status=this.value;_renderPrintInventoryPage()">
          <option value="all" ${_printInvFilter.status === 'all' ? 'selected' : ''}>All Stock</option>
          <option value="ok" ${_printInvFilter.status === 'ok' ? 'selected' : ''}>Healthy</option>
          <option value="low" ${_printInvFilter.status === 'low' ? 'selected' : ''}>Low Stock</option>
          <option value="out" ${_printInvFilter.status === 'out' ? 'selected' : ''}>Out of Stock</option>
        </select>
        ${_printInvFilter.search || _printInvFilter.status !== 'all' ? '<button class="btn btn-sm btn-outline" onclick="clearPrintInvFilter()">Clear Filter</button>' : ''}
      </div>
      <div class="data-card-body no-pad">
        <table class="data-table">
          <thead><tr>
            <th>Material Type</th>
            <th>Product Size</th>
            <th>Color</th>
            <th>Current Stock</th>
            <th>Reorder Point</th>
            <th>Max Stock</th>
            <th>Last Count Date</th>
            <th>Adjust</th>
          </tr></thead>
          <tbody>${filtered.length === 0 ? `
            <tr><td colspan="8" style="text-align:center;padding:32px;color:var(--ink-60)">
              ${_printInvFilter.search || _printInvFilter.status !== 'all' ? 'No variants match your search.' : 'No printing materials yet. Add materials in Product Management \u2192 Printing Products.'}
            </td></tr>` :
      filtered.map(({ p, v, reorderLevel }) => {
        const maxStock = v.maxStock ?? (reorderLevel * 3);
        const stockColor = v.stock === 0 ? 'var(--danger)' : v.stock <= reorderLevel ? 'var(--warning)' : 'var(--success)';
        const lastCount = v.lastCountDate
          ? new Date(v.lastCountDate).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })
          : '<span class=\\"text-muted\\">\u2014</span>';
        const colorCell = v.color
          ? `<span style="display:inline-flex;align-items:center;gap:6px"><span style="width:12px;height:12px;border-radius:50%;background:${v.colorHex || '#888'};border:1px solid var(--ink-20);flex-shrink:0"></span>${v.color}</span>`
          : '<span class=\\"text-muted\\">\u2014</span>';
        return `<tr>
              <td><strong>${p.materialType || p.name}</strong><div style="font-size:11px;color:var(--ink-50)">${p.name}</div></td>
              <td>${v.size || v.name}</td>
              <td>${colorCell}</td>
              <td class="td-mono" style="font-weight:700;color:${stockColor}">${v.stock}</td>
              <td class="td-mono">${reorderLevel}</td>
              <td class="td-mono">${maxStock}</td>
              <td class="td-mono" style="font-size:12px">${lastCount}</td>
              <td>${isAdmin ? '<button class="btn btn-sm btn-outline" onclick="adjustPrintStockModal(\'' + p.id + '\',\'' + v.id + '\')">' + 'Adjust</button>' : '<span class="badge badge-neutral">View Only</span>'}</td>
            </tr>`;
      }).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
}

function adjustPrintStockModal(pid, vid) {
  const s = getState();
  if (!s.currentUser || s.currentUser.role !== 'admin') { showToast('Only Administrators can adjust stock.', 'error'); return; }
  const p = (s.printProducts || []).find(x => x.id === pid);
  const v = p?.variants.find(x => x.id === vid);
  if (!v) return;
  const maxStock = v.maxStock ?? ((v.reorderLevel ?? 20) * 3);
  showModal(`<div class="modal-header"><h2>Adjust Stock — ${p.materialType || p.name} · ${v.size || v.name}${v.color ? ' · ' + v.color : ''}</h2><button class="btn-close-modal" onclick="closeModal()">✕</button></div>
    <div class="modal-body">
      <div class="alert alert-info">Current stock: <strong>${v.stock} units</strong>${v.lastCountDate ? ' · Last count: ' + new Date(v.lastCountDate).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }) : ''}</div>
      <div class="form-group"><label>Adjustment Type</label><div class="form-select-wrap"><select id="padj-type" class="form-control"><option value="add">Add Stock (+)</option><option value="remove">Remove Stock (−)</option><option value="set">Set Exact Value</option></select></div></div>
      <div class="form-group"><label>Quantity</label><input type="number" id="padj-qty" class="form-control" placeholder="0" min="0"></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div class="form-group"><label>Reorder Point</label><input type="number" id="padj-reorder" class="form-control" placeholder="20" min="1" value="${v.reorderLevel ?? 20}"></div>
        <div class="form-group"><label>Max Stock</label><input type="number" id="padj-maxstock" class="form-control" placeholder="${maxStock}" min="1" value="${maxStock}"></div>
      </div>
    </div>
    <div class="modal-footer"><button class="btn btn-outline" onclick="closeModal()">Cancel</button><button class="btn btn-maroon" onclick="confirmAdjustPrintStock('${pid}','${vid}')">Apply</button></div>`);
}

function confirmAdjustPrintStock(pid, vid) {
  const type = document.getElementById('padj-type').value;
  const qty = parseInt(document.getElementById('padj-qty').value) || 0;
  const reorderLevel = Math.max(1, parseInt(document.getElementById('padj-reorder').value) || 20);
  const maxStock = Math.max(1, parseInt(document.getElementById('padj-maxstock').value) || reorderLevel * 3);
  const s = getState();
  const prod = (s.printProducts || []).find(x => x.id === pid);
  const variant = prod?.variants.find(x => x.id === vid);
  if (!variant) { showToast('Variant not found.', 'error'); return; }
  if (type === 'add') variant.stock = (variant.stock || 0) + qty;
  else if (type === 'remove') variant.stock = Math.max(0, (variant.stock || 0) - qty);
  else if (type === 'set') variant.stock = Math.max(0, qty);
  variant.reorderLevel = reorderLevel;
  variant.maxStock = maxStock;
  variant.lastCountDate = new Date().toISOString();
  saveState(s);
  // Persist updated stock + reorder levels to DB
  DB.updatePrintProduct(pid, { variants: prod.variants }).catch(function (e) { console.error('[DB] updatePrintProduct stock:', e.message); });
  closeModal();
  showToast('Stock updated.', 'success');
  _renderPrintInventoryPage();
}

function logMaterialUsageModal() {
  const orders = getOrders().filter(o => o.status === 'production');
  const s = getState();
  showModal(`
    <div class="modal-header"><h2>${iconSvg('box')} Log Material Usage</h2><button class="btn-close-modal" onclick="closeModal()">✕</button></div>
    <div class="modal-body">
      <div class="form-group"><label>Order (optional)</label>
        <div class="form-select-wrap"><select id="mat-order" class="form-control">
          <option value="">General / Not order-specific</option>
          ${orders.map(o => `<option value="${o.id}">#${String(o.id).padStart(6, '0')} — ${o.customer_name}</option>`).join('')}
        </select></div>
      </div>
      <div class="form-group"><label>Material / Item</label><input id="mat-item" class="form-control" placeholder="e.g. Kraft paper roll, Ink cartridge, Die plate"></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div class="form-group"><label>Units Used</label><input id="mat-used" class="form-control" type="number" min="0" value="0"></div>
        <div class="form-group"><label>Waste / Scrap</label><input id="mat-waste" class="form-control" type="number" min="0" value="0"></div>
      </div>
      <div class="form-group"><label>Notes</label><textarea id="mat-notes" class="form-control" rows="2" placeholder="Any additional notes..."></textarea></div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
      <button class="btn btn-maroon" onclick="confirmLogMaterial()">Log Usage</button>
    </div>`);
}

function confirmLogMaterial() {
  const s = getState();
  const material = document.getElementById('mat-item').value.trim();
  const used = parseFloat(document.getElementById('mat-used').value) || 0;
  const waste = parseFloat(document.getElementById('mat-waste').value) || 0;
  const orderId = document.getElementById('mat-order').value;
  const notes = document.getElementById('mat-notes').value.trim();
  if (!material) { showToast('Material name required.', 'error'); return; }
  s.materialsLog = s.materialsLog || [];
  s.materialsLog.push({ id: 'mat_' + Date.now(), orderId: orderId || null, material, used, waste, notes, userId: s.currentUser?.id, createdAt: new Date().toISOString() });
  recordAudit(s, { action: 'material_logged', message: `Material usage: ${material} (used: ${used}, waste: ${waste})`, meta: { orderId } });
  saveState(s);
  closeModal();
  showToast('Material usage logged.', 'success');
  renderMaterialsTracking();
}


// FULL ORDER MANAGEMENT — Advanced Admin Features
function showReassignPersonnelModal() {
  const orders = getOrders().filter(o => o.status === 'pending' || o.status === 'production');
  const s = getState();
  const printStaff = s.users.filter(u => u.role === 'print');
  showModal(`
    <div class="modal-header"><h2>${iconSvg('users')} Reassign Printing Personnel</h2><button class="btn-close-modal" onclick="closeModal()">✕</button></div>
    <div class="modal-body">
      <div class="form-group"><label>Select Order</label>
        <div class="form-select-wrap"><select id="ra-order" class="form-control">
          <option value="">-- Select Order --</option>
          ${orders.map(o => `<option value="${o.id}">#${String(o.id).padStart(6, '0')} — ${o.customer_name}</option>`).join('')}
        </select></div>
      </div>
      <div class="form-group"><label>Assign To</label>
        <div class="form-select-wrap"><select id="ra-staff" class="form-control">
          <option value="">-- Select Personnel --</option>
          ${printStaff.map(u => `<option value="${u.id}">${u.name}</option>`).join('')}
        </select></div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
      <button class="btn btn-maroon" onclick="confirmReassignPersonnel()">Reassign</button>
    </div>`);
}

function confirmReassignPersonnel() {
  const orderId = document.getElementById('ra-order').value;
  const staffId = document.getElementById('ra-staff').value;
  if (!orderId || !staffId) { showToast('Select both order and personnel.', 'error'); return; }
  const s = getState();
  const staff = s.users.find(u => u.id === staffId);
  const orders = getOrders();
  const o = orders.find(x => String(x.id) === String(orderId));
  if (!o) return;
  o.assigned_to = staffId;
  o.assigned_name = staff?.name || '';
  saveOrders(orders);
  DB.updateOrder(orderId, { assigned_to: staffId, assigned_name: o.assigned_name });
  recordAudit(s, { action: 'personnel_reassigned', message: `Order #${orderId} reassigned to ${staff?.name}` });
  saveState(s);
  closeModal();
  showToast(`Order reassigned to ${staff?.name}.`, 'success');
  renderOrders();
}

function showMergeOrdersModal() {
  const orders = getOrders().filter(o => o.status === 'pending');
  showModal(`
    <div class="modal-header"><h2>${iconSvg('transfer')} Merge Orders</h2><button class="btn-close-modal" onclick="closeModal()">✕</button></div>
    <div class="modal-body">
      <div class="alert alert-warning">${iconSvg('warning')} Merging will combine the selected orders into one. This cannot be undone.</div>
      <div class="form-group"><label>Primary Order (keep this one)</label>
        <div class="form-select-wrap"><select id="merge-primary" class="form-control">
          <option value="">-- Select Order --</option>
          ${orders.map(o => `<option value="${o.id}">#${String(o.id).padStart(6, '0')} — ${o.customer_name} (₱${fmt(o.total_amount || 0)})</option>`).join('')}
        </select></div>
      </div>
      <div class="form-group"><label>Order to Merge Into Primary</label>
        <div class="form-select-wrap"><select id="merge-secondary" class="form-control">
          <option value="">-- Select Order --</option>
          ${orders.map(o => `<option value="${o.id}">#${String(o.id).padStart(6, '0')} — ${o.customer_name} (₱${fmt(o.total_amount || 0)})</option>`).join('')}
        </select></div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
      <button class="btn btn-danger" onclick="confirmMergeOrders()">Merge Orders</button>
    </div>`);
}

function confirmMergeOrders() {
  const primaryId = document.getElementById('merge-primary').value;
  const secondaryId = document.getElementById('merge-secondary').value;
  if (!primaryId || !secondaryId) { showToast('Select both orders.', 'error'); return; }
  if (primaryId === secondaryId) { showToast('Cannot merge an order with itself.', 'error'); return; }
  const orders = getOrders();
  const primary = orders.find(x => String(x.id) === String(primaryId));
  const secondary = orders.find(x => String(x.id) === String(secondaryId));
  if (!primary || !secondary) return;
  primary.total_amount = (primary.total_amount || 0) + (secondary.total_amount || 0);
  primary.downpayment = (primary.downpayment || 0) + (secondary.downpayment || 0);
  primary.balance = (primary.balance || 0) + (secondary.balance || 0);
  primary.notes = [primary.notes, `(Merged from #${String(secondaryId).padStart(6, '0')}): ${secondary.notes || ''}`].filter(Boolean).join(' | ');
  secondary.status = 'cancelled';
  secondary.cancel_reason = `Merged into Order #${primaryId}`;
  const s = getState();
  recordAudit(s, { action: 'orders_merged', message: `Order #${secondaryId} merged into #${primaryId}` });
  saveState(s);
  saveOrders(orders);
  DB.updateOrder(primaryId, { total_amount: primary.total_amount, downpayment: primary.downpayment, balance: primary.balance, notes: primary.notes });
  DB.updateOrder(secondaryId, { status: 'cancelled', cancel_reason: secondary.cancel_reason });
  closeModal();
  showToast('Orders merged successfully.', 'success');
  renderOrders();
}

function showSplitOrderModal() {
  const orders = getOrders().filter(o => o.status === 'pending' && (o.quantity || 0) > 1);
  showModal(`
    <div class="modal-header"><h2>${iconSvg('transfer')} Split Order</h2><button class="btn-close-modal" onclick="closeModal()">✕</button></div>
    <div class="modal-body">
      <div class="form-group"><label>Select Order to Split</label>
        <div class="form-select-wrap"><select id="split-order" class="form-control" onchange="updateSplitInfo(this.value)">
          <option value="">-- Select Order --</option>
          ${orders.map(o => `<option value="${o.id}">#${String(o.id).padStart(6, '0')} — ${o.customer_name} · Qty: ${o.quantity}</option>`).join('')}
        </select></div>
      </div>
      <div id="split-info" style="display:none">
        <div class="form-group"><label>Quantity for First Order</label><input id="split-qty1" class="form-control" type="number" min="1" placeholder="0" oninput="updateSplitQty2()"></div>
        <div id="split-qty2-display" class="alert alert-info" style="font-size:13px"></div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
      <button class="btn btn-maroon" onclick="confirmSplitOrder()">Split Order</button>
    </div>`);
}

function updateSplitInfo(orderId) {
  if (!orderId) { document.getElementById('split-info').style.display = 'none'; return; }
  const o = getOrders().find(x => String(x.id) === String(orderId));
  if (!o) return;
  document.getElementById('split-info').style.display = 'block';
  document.getElementById('split-qty1').max = o.quantity - 1;
  document.getElementById('split-qty1').value = Math.floor(o.quantity / 2);
  updateSplitQty2();
}

function updateSplitQty2() {
  const orderId = document.getElementById('split-order').value;
  const qty1 = parseInt(document.getElementById('split-qty1').value) || 0;
  const o = getOrders().find(x => String(x.id) === String(orderId));
  if (!o) return;
  const qty2 = (o.quantity || 0) - qty1;
  document.getElementById('split-qty2-display').innerHTML = `Split: <strong>Part 1:</strong> ${qty1} pcs &nbsp;|&nbsp; <strong>Part 2:</strong> ${qty2} pcs`;
}

function confirmSplitOrder() {
  const orderId = document.getElementById('split-order').value;
  const qty1 = parseInt(document.getElementById('split-qty1').value) || 0;
  if (!orderId || qty1 < 1) { showToast('Select an order and enter valid quantity.', 'error'); return; }
  const orders = getOrders();
  const o = orders.find(x => String(x.id) === String(orderId));
  if (!o) return;
  const qty2 = (o.quantity || 0) - qty1;
  if (qty2 < 1) { showToast('Each split must have at least 1 unit.', 'error'); return; }
  const ratio = qty1 / o.quantity;
  const newOrder = {
    ...o,
    id: (Math.max(...orders.map(x => Number(x.id) || 0)) + 1),
    quantity: qty2,
    total_amount: Math.round((o.total_amount || 0) * (1 - ratio)),
    downpayment: Math.round((o.downpayment || 0) * (1 - ratio)),
    balance: Math.round((o.balance || 0) * (1 - ratio)),
    notes: `(Split from #${String(orderId).padStart(6, '0')}) ${o.notes || ''}`,
    created_at: new Date().toISOString(),
  };
  o.quantity = qty1;
  o.total_amount = Math.round((o.total_amount || 0) * ratio);
  o.downpayment = Math.round((o.downpayment || 0) * ratio);
  o.balance = Math.round((o.balance || 0) * ratio);
  o.notes = `(Split — Part 1) ${o.notes || ''}`;
  orders.push(newOrder);
  const s = getState();
  recordAudit(s, { action: 'order_split', message: `Order #${orderId} split into #${orderId} (qty:${qty1}) and #${newOrder.id} (qty:${qty2})` });
  saveState(s);
  saveOrders(orders);
  DB.updateOrder(orderId, { quantity: o.quantity, total_amount: o.total_amount, downpayment: o.downpayment, balance: o.balance, notes: o.notes });
  DB.saveOrder(newOrder);
  closeModal();
  showToast('Order split successfully.', 'success');
  renderOrders();
}

function showHoldOrderModal() {
  const orders = getOrders().filter(o => o.status === 'pending' || o.status === 'production');
  showModal(`
    <div class="modal-header"><h2>${iconSvg('lock')} Hold / Release Order</h2><button class="btn-close-modal" onclick="closeModal()">✕</button></div>
    <div class="modal-body">
      <div class="form-group"><label>Select Order</label>
        <div class="form-select-wrap"><select id="hold-order" class="form-control">
          <option value="">-- Select Order --</option>
          ${orders.map(o => `<option value="${o.id}">#${String(o.id).padStart(6, '0')} — ${o.customer_name} [${o.status}${o.on_hold ? ' · ON HOLD' : ''}]</option>`).join('')}
        </select></div>
      </div>
      <div class="form-group"><label>Reason (required for hold)</label><input id="hold-reason" class="form-control" placeholder="Reason for hold..."></div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
      <button class="btn btn-warning" onclick="confirmHoldRelease(true)" style="background:var(--warning);color:white;border:none;padding:8px 20px;border-radius:var(--radius-sm)">${iconSvg('lock')} Put on Hold</button>
      <button class="btn btn-success" onclick="confirmHoldRelease(false)" style="background:var(--success);color:white;border:none;padding:8px 20px;border-radius:var(--radius-sm)">${iconSvg('lockOpen')} Release Hold</button>
    </div>`);
}

function confirmHoldRelease(isHold) {
  const orderId = document.getElementById('hold-order').value;
  const reason = document.getElementById('hold-reason').value.trim();
  if (!orderId) { showToast('Select an order.', 'error'); return; }
  if (isHold && !reason) { showToast('Reason is required to put an order on hold.', 'error'); return; }
  const orders = getOrders();
  const o = orders.find(x => String(x.id) === String(orderId));
  if (!o) return;
  o.on_hold = isHold;
  o.hold_reason = isHold ? reason : null;
  const s = getState();
  recordAudit(s, { action: isHold ? 'order_held' : 'order_released', message: `Order #${orderId} ${isHold ? 'put on hold' : 'released from hold'}`, meta: { reason } });
  saveState(s);
  saveOrders(orders);
  DB.updateOrder(orderId, { on_hold: isHold, hold_reason: o.hold_reason });
  closeModal();
  showToast(`Order ${isHold ? 'put on hold' : 'released'}.`, isHold ? 'warning' : 'success');
  renderOrders();
}

function showAdjustLeadTimeModal() {
  const orders = getOrders().filter(o => o.status !== 'completed' && o.status !== 'cancelled');
  showModal(`
    <div class="modal-header"><h2>${iconSvg('clock')} Adjust Lead Time / Due Date</h2><button class="btn-close-modal" onclick="closeModal()">✕</button></div>
    <div class="modal-body">
      <div class="form-group"><label>Select Order</label>
        <div class="form-select-wrap"><select id="lt-order" class="form-control">
          <option value="">-- Select Order --</option>
          ${orders.map(o => `<option value="${o.id}">#${String(o.id).padStart(6, '0')} — ${o.customer_name} (Due: ${o.due_date || '—'})</option>`).join('')}
        </select></div>
      </div>
      <div class="form-group"><label>New Due Date</label><input id="lt-date" class="form-control" type="date"></div>
      <div class="form-group"><label>Reason</label><input id="lt-reason" class="form-control" placeholder="Reason for adjustment..."></div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
      <button class="btn btn-maroon" onclick="confirmAdjustLeadTime()">Update Due Date</button>
    </div>`);
}

function confirmAdjustLeadTime() {
  const orderId = document.getElementById('lt-order').value;
  const date = document.getElementById('lt-date').value;
  const reason = document.getElementById('lt-reason').value.trim();
  if (!orderId || !date) { showToast('Select order and enter new date.', 'error'); return; }
  const orders = getOrders();
  const o = orders.find(x => String(x.id) === String(orderId));
  if (!o) return;
  const oldDate = o.due_date;
  o.due_date = date;
  const s = getState();
  recordAudit(s, { action: 'lead_time_adjusted', message: `Order #${orderId} due date changed from ${oldDate} to ${date}. Reason: ${reason}`, meta: { reason } });
  saveState(s);
  saveOrders(orders);
  DB.updateOrder(orderId, { due_date: date });
  closeModal();
  showToast('Due date updated.', 'success');
  renderOrders();
}

function showOverridePriceModal() {
  const orders = getOrders().filter(o => o.status !== 'completed' && o.status !== 'cancelled');
  showModal(`
    <div class="modal-header"><h2>${iconSvg('money')} Override Order Price</h2><button class="btn-close-modal" onclick="closeModal()">✕</button></div>
    <div class="modal-body">
      <div class="alert alert-warning">${iconSvg('warning')} This will override the order total. Audit will be recorded.</div>
      <div class="form-group"><label>Select Order</label>
        <div class="form-select-wrap"><select id="op-order" class="form-control">
          <option value="">-- Select Order --</option>
          ${orders.map(o => `<option value="${o.id}">#${String(o.id).padStart(6, '0')} — ${o.customer_name} (₱${fmt(o.total_amount || 0)})</option>`).join('')}
        </select></div>
      </div>
      <div class="form-group"><label>New Total Amount (₱)</label><input id="op-price" class="form-control" type="number" min="0" placeholder="0.00"></div>
      <div class="form-group"><label>Override Reason</label><input id="op-reason" class="form-control" placeholder="Reason for price override..."></div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
      <button class="btn btn-maroon" onclick="confirmOverridePrice()">Override Price</button>
    </div>`);
}

function confirmOverridePrice() {
  const orderId = document.getElementById('op-order').value;
  const price = parseFloat(document.getElementById('op-price').value) || 0;
  const reason = document.getElementById('op-reason').value.trim();
  if (!orderId || price <= 0 || !reason) { showToast('All fields required.', 'error'); return; }
  const orders = getOrders();
  const o = orders.find(x => String(x.id) === String(orderId));
  if (!o) return;
  const oldPrice = o.total_amount;
  o.total_amount = price;
  o.balance = Math.max(0, price - (o.downpayment || 0));
  const s = getState();
  recordAudit(s, { action: 'price_overridden', message: `Order #${orderId} price changed from ₱${fmt(oldPrice)} to ₱${fmt(price)}. Reason: ${reason}`, meta: { oldPrice, newPrice: price, reason } });
  saveState(s);
  saveOrders(orders);
  DB.updateOrder(orderId, { total_amount: price, balance: o.balance });
  closeModal();
  showToast('Price overridden and recorded.', 'success');
  renderOrders();
}

function showOverrideDiscountModal() {
  const orders = getOrders().filter(o => o.status !== 'completed' && o.status !== 'cancelled');
  showModal(`
    <div class="modal-header"><h2>${iconSvg('money')} Override Discount</h2><button class="btn-close-modal" onclick="closeModal()">✕</button></div>
    <div class="modal-body">
      <div class="form-group"><label>Select Order</label>
        <div class="form-select-wrap"><select id="od-order" class="form-control">
          <option value="">-- Select Order --</option>
          ${orders.map(o => `<option value="${o.id}">#${String(o.id).padStart(6, '0')} — ${o.customer_name} (₱${fmt(o.total_amount || 0)})</option>`).join('')}
        </select></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div class="form-group"><label>Discount Type</label>
          <div class="form-select-wrap"><select id="od-type" class="form-control">
            <option value="percent">Percent (%)</option>
            <option value="fixed">Fixed Amount (₱)</option>
            <option value="none">Remove Discount</option>
          </select></div>
        </div>
        <div class="form-group"><label>Value</label><input id="od-value" class="form-control" type="number" min="0" placeholder="0"></div>
      </div>
      <div class="form-group"><label>Override Reason</label><input id="od-reason" class="form-control" placeholder="Reason for discount override..."></div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
      <button class="btn btn-maroon" onclick="confirmOverrideDiscount()">Apply Override</button>
    </div>`);
}

function confirmOverrideDiscount() {
  const orderId = document.getElementById('od-order').value;
  const discType = document.getElementById('od-type').value;
  const discVal = parseFloat(document.getElementById('od-value').value) || 0;
  const reason = document.getElementById('od-reason').value.trim();
  if (!orderId || !reason) { showToast('Select order and enter reason.', 'error'); return; }
  const orders = getOrders();
  const o = orders.find(x => String(x.id) === String(orderId));
  if (!o) return;
  let discAmount = 0;
  if (discType === 'percent') discAmount = (o.total_amount || 0) * discVal / 100;
  else if (discType === 'fixed') discAmount = discVal;
  const newTotal = Math.max(0, (o.total_amount || 0) - discAmount);
  o.discount_override = discAmount;
  o.discount_reason = reason;
  o.balance = Math.max(0, newTotal - (o.downpayment || 0));
  const s = getState();
  recordAudit(s, { action: 'discount_overridden', message: `Discount override on Order #${orderId}: ${discType} ${discVal}. Reason: ${reason}`, meta: { discType, discVal, discAmount, reason } });
  saveState(s);
  saveOrders(orders);
  DB.updateOrder(orderId, { discount_override: discAmount, discount_reason: reason, balance: o.balance });
  closeModal();
  showToast('Discount override applied.', 'success');
  renderOrders();
}

// BRANCH STAFF — REPORTING (Weekly/Monthly/Performance)
function buildStaffReportPreview(types) {
  const s = getState();
  const u = s.currentUser;
  const now = new Date();
  const todayStr = now.toDateString();
  const weekStart = getMonday(now);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const mySales = u.role === 'admin' ? s.sales : (s.sales || []).filter(x => x.userId === u.id);
  const orders = getOrders();
  const genDate = now.toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  let html = '';

  types.forEach(type => {
    if (type === 'Sales Report') {
      const daily = mySales.filter(x => !x.voided && new Date(x.createdAt).toDateString() === todayStr);
      const weekly = mySales.filter(x => !x.voided && new Date(x.createdAt) >= weekStart);
      const monthly = mySales.filter(x => !x.voided && new Date(x.createdAt) >= monthStart);
      const rev = arr => arr.reduce((a, b) => a + (b.total || 0), 0);
      html += `
        <div style="margin-bottom:24px">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;padding-bottom:10px;border-bottom:2px solid var(--maroon)">
            <img src="logo.png" alt="South Pafps" style="height:36px;width:auto;border-radius:6px;flex-shrink:0" onerror="this.style.display='none'">
            <div>
              <div style="font-size:14px;font-weight:700;color:var(--maroon)">Sales Report</div>
              <div style="font-size:11px;color:var(--ink-60)">South Pafps Packaging Supplies</div>
            </div>
            <span style="font-size:11px;color:var(--ink-40);margin-left:auto">Generated ${genDate}</span>
          </div>
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:12px">
            <div style="background:var(--cream);border-radius:var(--radius);padding:12px;text-align:center">
              <div style="font-size:18px;font-weight:700;color:var(--maroon)">₱${fmt(rev(daily))}</div>
              <div style="font-size:11px;color:var(--ink-60)">Today (${daily.length} txns)</div>
            </div>
            <div style="background:var(--cream);border-radius:var(--radius);padding:12px;text-align:center">
              <div style="font-size:18px;font-weight:700;color:var(--maroon)">₱${fmt(rev(weekly))}</div>
              <div style="font-size:11px;color:var(--ink-60)">This Week (${weekly.length} txns)</div>
            </div>
            <div style="background:var(--cream);border-radius:var(--radius);padding:12px;text-align:center">
              <div style="font-size:18px;font-weight:700;color:var(--maroon)">₱${fmt(rev(monthly))}</div>
              <div style="font-size:11px;color:var(--ink-60)">This Month (${monthly.length} txns)</div>
            </div>
          </div>
          <table class="data-table">
            <thead><tr><th>Receipt #</th><th>Customer</th><th>Items</th><th>Total</th><th>Payment</th><th>Time</th></tr></thead>
            <tbody>${daily.length ? [...daily].reverse().map(sale => {
        const payLabel = (sale.payments || []).map(p => `${p.method === 'cash' ? 'Cash' : 'GCash'}: ₱${fmt(p.amount)}`).join(' + ');
        return `<tr>
                <td class="td-mono">${sale.id.slice(-6).toUpperCase()}</td>
                <td>${sale.customerId ? (s.customers.find(c => c.id === sale.customerId)?.companyName || '—') : 'Walk-in'}</td>
                <td>${(sale.items || []).length}</td>
                <td class="td-mono" style="font-weight:700;color:var(--maroon)">₱${fmt(sale.total)}</td>
                <td class="text-xs">${payLabel}</td>
                <td class="td-mono">${fmtTime(sale.createdAt)}</td>
              </tr>`;
      }).join('') : '<tr><td colspan="6" style="text-align:center;padding:16px;color:var(--ink-60)">No transactions today.</td></tr>'}</tbody>
          </table>
        </div>`;
    }

    if (type === 'Inventory Report') {
      const products = (s.products || []).filter(p => p.active);
      html += `
        <div style="margin-bottom:24px">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;padding-bottom:10px;border-bottom:2px solid var(--maroon)">
            <img src="logo.png" alt="South Pafps" style="height:36px;width:auto;border-radius:6px;flex-shrink:0" onerror="this.style.display='none'">
            <div>
              <div style="font-size:14px;font-weight:700;color:var(--maroon)">Inventory Report</div>
              <div style="font-size:11px;color:var(--ink-60)">South Pafps Packaging Supplies</div>
            </div>
            <span style="font-size:11px;color:var(--ink-40);margin-left:auto">Generated ${genDate}</span>
          </div>
          <table class="data-table">
            <thead><tr><th>Product</th><th>Variant</th><th>SKU</th><th>Stock</th><th>Reorder Level</th><th>Status</th></tr></thead>
            <tbody>${products.flatMap(p => (p.variants || []).map(v => {
        const low = v.stock <= (v.reorderLevel ?? 20);
        const out = v.stock <= 0;
        const badge = out ? '<span class="badge badge-danger">Out of Stock</span>' : low ? '<span class="badge badge-warning">Low Stock</span>' : '<span class="badge badge-success">OK</span>';
        return `<tr>
                <td>${p.name}</td><td>${v.name}</td><td class="td-mono">${v.sku || '—'}</td>
                <td class="td-mono" style="${out ? 'color:var(--danger);font-weight:700' : low ? 'color:var(--warning);font-weight:700' : ''}">${v.stock}</td>
                <td class="td-mono">${v.reorderLevel ?? 20}</td><td>${badge}</td>
              </tr>`;
      })).join('') || '<tr><td colspan="6" style="text-align:center;padding:16px;color:var(--ink-60)">No products found.</td></tr>'}</tbody>
          </table>
        </div>`;
    }

    if (type === 'Orders Report') {
      const myOrders = u.role === 'admin' ? orders : orders.filter(o => o.branch_staff?.toLowerCase().includes(u.name?.toLowerCase()));
      const statuses = ['pending', 'production', 'dispatch', 'completed'];
      html += `
        <div style="margin-bottom:24px">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;padding-bottom:10px;border-bottom:2px solid var(--maroon)">
            <img src="logo.png" alt="South Pafps" style="height:36px;width:auto;border-radius:6px;flex-shrink:0" onerror="this.style.display='none'">
            <div>
              <div style="font-size:14px;font-weight:700;color:var(--maroon)">Orders Report</div>
              <div style="font-size:11px;color:var(--ink-60)">South Pafps Packaging Supplies</div>
            </div>
            <span style="font-size:11px;color:var(--ink-40);margin-left:auto">Generated ${genDate}</span>
          </div>
          <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:12px">
            ${statuses.map(st => `<div style="background:var(--cream);border-radius:var(--radius);padding:12px;text-align:center">
              <div style="font-size:18px;font-weight:700;color:var(--maroon)">${myOrders.filter(o => o.status === st).length}</div>
              <div style="font-size:11px;color:var(--ink-60)">${st.charAt(0).toUpperCase() + st.slice(1)}</div>
            </div>`).join('')}
          </div>
          <table class="data-table">
            <thead><tr><th>Order #</th><th>Customer</th><th>Product</th><th>Status</th><th>Total</th><th>Balance</th></tr></thead>
            <tbody>${myOrders.length ? [...myOrders].reverse().map(o => `<tr>
              <td class="td-mono">#${String(o.id).padStart(6, '0')}</td>
              <td>${o.customer_name || '—'}</td>
              <td>${o.product_type || '—'}</td>
              <td>${omStatusBadge(o.status)}</td>
              <td class="td-mono">₱${fmt(o.total_amount)}</td>
              <td class="td-mono" style="${(o.balance || 0) > 0 ? 'color:var(--danger)' : 'color:var(--success)'}">₱${fmt(o.balance || 0)}</td>
            </tr>`).join('') : '<tr><td colspan="6" style="text-align:center;padding:16px;color:var(--ink-60)">No orders found.</td></tr>'}</tbody>
          </table>
        </div>`;
    }

    if (type === 'Payroll Report') {
      const staffUsers = (s.users || []).filter(x => ['staff', 'print'].includes(x.role) && (!u.branchId || x.branchId === u.branchId));
      html += `
        <div style="margin-bottom:24px">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;padding-bottom:10px;border-bottom:2px solid var(--maroon)">
            <img src="logo.png" alt="South Pafps" style="height:36px;width:auto;border-radius:6px;flex-shrink:0" onerror="this.style.display='none'">
            <div>
              <div style="font-size:14px;font-weight:700;color:var(--maroon)">Payroll Report</div>
              <div style="font-size:11px;color:var(--ink-60)">South Pafps Packaging Supplies</div>
            </div>
            <span style="font-size:11px;color:var(--ink-40);margin-left:auto">Generated ${genDate}</span>
          </div>
          <table class="data-table">
            <thead><tr><th>Employee</th><th>Role</th><th>Daily Rate</th><th>Shifts This Month</th><th>Gross Pay</th></tr></thead>
            <tbody>${staffUsers.length ? staffUsers.map(emp => {
        const empShifts = (s.shifts || []).filter(sh => sh.userId === emp.id && sh.status !== 'open' && new Date(sh.openedAt) >= monthStart);
        const gross = empShifts.length * (emp.dailyRate || 400);
        return `<tr>
                <td>${emp.name || emp.username}</td>
                <td><span class="badge badge-neutral">${emp.role}</span></td>
                <td class="td-mono">₱${fmt(emp.dailyRate || 400)}</td>
                <td>${empShifts.length}</td>
                <td class="td-mono" style="font-weight:700;color:var(--maroon)">₱${fmt(gross)}</td>
              </tr>`;
      }).join('') : '<tr><td colspan="5" style="text-align:center;padding:16px;color:var(--ink-60)">No staff found.</td></tr>'}</tbody>
          </table>
        </div>`;
    }
  });

  return html || '<div style="text-align:center;padding:32px;color:var(--ink-40)">Check at least one report type above and click Generate.</div>';
}

function renderStaffReports() {
  const s = getState();
  const u = s.currentUser;
  if (u && u.role === 'print') { navigateTo('print-reports'); return; }

  const isMainBranch = u.branchId === 'b1';
  const allSubmitted = JSON.parse(localStorage.getItem('submitted_reports') || '[]');
  const printReports = allSubmitted.filter(r => r.type === 'print_dept');
  const pendingCount = printReports.filter(r => !r.forwardedToAdmin).length;

  // Build print inbox rows
  let printRows = '';
  if (printReports.length === 0) {
    printRows = '<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--ink-60)">No print department reports received yet.</td></tr>';
  } else {
    [...printReports].reverse().forEach(r => {
      const reportBadges = (r.reports || []).map(rp => '<span class="badge badge-info" style="margin-right:4px">' + rp + '</span>').join('');
      const statusBadge = r.forwardedToAdmin
        ? '<span class="badge badge-success">&#10003; Forwarded</span>'
        : '<span class="badge badge-warning">Pending</span>';
      const fwdBtn = !r.forwardedToAdmin
        ? '<button class="btn btn-sm btn-maroon" onclick="forwardPrintReportToAdmin(\'' + r.id + '\')">&#128228; Forward to Admin</button>'
        : '';
      printRows += '<tr>'
        + '<td class="td-mono">' + new Date(r.submittedAt).toLocaleString('en-PH') + '</td>'
        + '<td><strong>' + (r.submitterName || '&mdash;') + '</strong></td>'
        + '<td>' + reportBadges + '</td>'
        + '<td style="max-width:160px;font-size:12px;color:var(--ink-60)">' + (r.note || '&mdash;') + '</td>'
        + '<td>' + statusBadge + '</td>'
        + '<td style="display:flex;gap:6px;flex-wrap:wrap"><button class="btn btn-sm btn-outline" onclick="viewSubmittedReportStaff(\'' + r.id + '\')">View</button>' + fwdBtn + '</td>'
        + '</tr>';
    });
  }

  const printInboxSection = isMainBranch ? (
    '<div class="data-card" style="margin-top:20px">'
    + '<div class="data-card-header" style="align-items:center">'
    + '<span class="data-card-title">' + iconSvg('printer') + ' Reports Inbox &mdash; From Printing Personnel</span>'
    + (pendingCount > 0 ? '<span class="badge badge-danger" style="font-size:12px">' + pendingCount + ' pending</span>' : '<span class="badge badge-success">All forwarded</span>')
    + '</div>'
    + '<div class="data-card-body no-pad">'
    + '<table class="data-table"><thead><tr><th>Date &amp; Time</th><th>Submitted By</th><th>Reports</th><th>Note</th><th>Status</th><th>Actions</th></tr></thead>'
    + '<tbody>' + printRows + '</tbody></table>'
    + '</div></div>'
  ) : '';

  document.getElementById('page-content').innerHTML = `
    <div class="page-header">
      <h1 class="page-title">Reports</h1>
      <p class="page-subtitle">${u.role === 'admin' ? 'All branches' : 'Your performance & reports'}</p>
    </div>

    <div class="data-card">
      <div class="data-card-header" style="align-items:center">
        <span class="data-card-title">${iconSvg('clipboard')} Generate &amp; Send Reports to Admin</span>
      </div>
      <div class="data-card-body">
        <p style="font-size:13px;color:var(--ink-60);margin-bottom:14px">Select the type of report you want to generate, then send to the Administrator:</p>
        <div class="form-row-2" style="margin-bottom:14px">
          <div class="form-group" style="margin-bottom:0">
            <label>Report Type</label>
            <div class="form-select-wrap">
              <select id="rpt-type" class="form-control">
                <option value="">&mdash; Select a report type &mdash;</option>
                <option value="Sales Report">Sales Report &mdash; Daily transactions &amp; revenue</option>
                <option value="Inventory Report">Inventory Report &mdash; Current stock levels</option>
                <option value="Orders Report">Orders Report &mdash; Order status &amp; balances</option>
                <option value="Payroll Report">Payroll Report &mdash; Staff hours &amp; earnings</option>
                <option value="All Reports">All Reports &mdash; Generate all of the above</option>
              </select>
            </div>
          </div>
          <div class="form-group" style="margin-bottom:0">
            <label>Note to Admin (optional)</label>
            <input id="rpt-note" class="form-control" placeholder="Add any remarks or context for the admin...">
          </div>
        </div>
        <button class="btn btn-maroon" onclick="staffReportPreviewRefresh()" style="font-size:13px">${iconSvg('chart')} Generate Report</button>
      </div>
      <div id="staff-rpt-preview" style="display:none;border-top:1px solid var(--ink-10);padding:20px 24px 24px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:var(--ink-40)">Report Preview</div>
          <button class="btn btn-maroon" onclick="submitStaffReportsToAdmin()" style="font-size:13px">&#128228; Send to Admin</button>
        </div>
        <div id="staff-rpt-preview-body"></div>
      </div>
    </div>
    ${printInboxSection}`;
}

function staffReportPreviewRefresh() {
  const val = document.getElementById('rpt-type')?.value;
  const preview = document.getElementById('staff-rpt-preview');
  const body = document.getElementById('staff-rpt-preview-body');
  if (!preview || !body) return;
  if (!val) { showToast('Please select a report type first.', 'error'); return; }
  const types = val === 'All Reports'
    ? ['Sales Report', 'Inventory Report', 'Orders Report', 'Payroll Report']
    : [val];
  body.innerHTML = buildStaffReportPreview(types);
  preview.style.display = 'block';
}

function submitStaffReportsToAdmin() {
  const s = getState();
  const u = s.currentUser;
  const val = document.getElementById('rpt-type')?.value;
  if (!val) { showToast('Please select a report type first, then click Generate.', 'error'); return; }
  const selected = val === 'All Reports'
    ? ['Sales Report', 'Inventory Report', 'Orders Report', 'Payroll Report']
    : [val];
  const note = document.getElementById('rpt-note')?.value?.trim() || '';
  // Always regenerate fresh so saved HTML matches the selected type
  const freshHtml = buildStaffReportPreview(selected);
  const previewBody = document.getElementById('staff-rpt-preview-body');
  if (previewBody) previewBody.innerHTML = freshHtml;
  const reportHtml = freshHtml;
  // Guard against fallback/empty output
  if (!reportHtml || reportHtml.includes('Check at least one report type')) {
    showToast('Please select a report type first, then click Generate.', 'error');
    return;
  }
  const entry = {
    id: 'rpt_' + Date.now(),
    submittedBy: u.id,
    submitterName: u.name || u.username,
    role: u.role,
    branchId: u.branchId || null,
    reports: selected,
    reportHtml,
    note,
    submittedAt: new Date().toISOString(),
    type: 'branch_staff',
  };
  const existing = JSON.parse(localStorage.getItem('submitted_reports') || '[]');
  existing.push(entry);
  localStorage.setItem('submitted_reports', JSON.stringify(existing));
  recordAudit(s, { action: 'reports_submitted', message: `${u.name} submitted reports to admin: ${selected.join(', ')}`, userId: u.id });
  saveState(s);
  showToast('Reports submitted to Admin successfully!', 'success');
  // Hide preview after send
  const preview = document.getElementById('staff-rpt-preview');
  if (preview) preview.style.display = 'none';
}

function viewSubmittedReportStaff(reportId) {
  const submittedReports = JSON.parse(localStorage.getItem('submitted_reports') || '[]');
  const r = submittedReports.find(x => x.id === reportId);
  if (!r) return;
  const reportBadges = (r.reports || []).map(rp => '<span class="badge badge-info" style="margin-right:4px">' + rp + '</span>').join('');
  const noteHtml = r.note ? '<div style="margin-bottom:12px"><div class="text-xs text-muted" style="margin-bottom:4px">Note</div><div style="background:var(--cream);padding:10px;border-radius:var(--radius);font-size:13px">' + r.note + '</div></div>' : '';
  const fwdBtnHtml = (!r.forwardedToAdmin && r.type === 'print_dept')
    ? '<button class="btn btn-maroon" onclick="forwardPrintReportToAdmin(\'' + r.id + '\');closeModal()">&#128228; Forward to Admin</button>'
    : '';
  showModal(`
    <div class="modal-header"><h2>${iconSvg('clipboard')} Report from ${r.submitterName}</h2><button class="btn-close-modal" onclick="closeModal()">&#10005;</button></div>
    <div class="modal-body">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">
        <div><div class="text-xs text-muted">Submitted By</div><div style="font-weight:600">${r.submitterName}</div></div>
        <div><div class="text-xs text-muted">Date &amp; Time</div><div>${new Date(r.submittedAt).toLocaleString('en-PH')}</div></div>
      </div>
      <div style="margin-bottom:12px">
        <div class="text-xs text-muted" style="margin-bottom:6px">Reports Included</div>
        <div>${reportBadges}</div>
      </div>
      ${noteHtml}
      <div style="border-top:1px solid var(--ink-10);padding-top:12px">${r.reportHtml || '<p style="color:var(--ink-40);text-align:center">No report content attached.</p>'}</div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeModal()">Close</button>
      ${fwdBtnHtml}
    </div>`, 'modal-lg');
}

function forwardPrintReportToAdmin(reportId) {
  const s = getState();
  const u = s.currentUser;
  const existing = JSON.parse(localStorage.getItem('submitted_reports') || '[]');
  const idx = existing.findIndex(r => r.id === reportId);
  if (idx === -1) { showToast('Report not found.', 'error'); return; }
  existing[idx].forwardedToAdmin = true;
  existing[idx].forwardedBy = u.name || u.username;
  existing[idx].forwardedAt = new Date().toISOString();
  // Also create a new forwarded entry visible to admin with type branch_staff
  const orig = existing[idx];
  const forwardEntry = {
    id: 'rpt_fwd_' + Date.now(),
    submittedBy: orig.submittedBy,
    submitterName: orig.submitterName + ' (via Main Branch)',
    role: orig.role,
    branchId: orig.branchId,
    reports: orig.reports,
    reportHtml: orig.reportHtml,
    note: (orig.note ? orig.note + ' | ' : '') + 'Forwarded by Main Branch (' + (u.name || u.username) + ')',
    submittedAt: new Date().toISOString(),
    type: 'print_dept_forwarded',
    originalId: reportId,
  };
  existing.push(forwardEntry);
  localStorage.setItem('submitted_reports', JSON.stringify(existing));
  recordAudit(s, { action: 'report_forwarded', message: `${u.name} forwarded print dept report to admin (original from ${orig.submitterName})`, userId: u.id });
  saveState(s);
  showToast('Report forwarded to Admin successfully!', 'success');
  renderStaffReports();
}

// ADMIN DASHBOARD ENHANCEMENTS
function renderAdminProductionQueue() {
  const orders = getOrders();
  const pending = orders.filter(o => o.status === 'pending').length;
  const inProd = orders.filter(o => o.status === 'production').length;
  const dispatch = orders.filter(o => omIsDispatchReady(o)).length;
  const now = new Date();
  const delayed = orders.filter(o => o.due_date && new Date(o.due_date) < now && o.status !== 'completed' && o.status !== 'cancelled');
  return `<div class="data-card" style="margin-top:0">
    <div class="data-card-header">
      <span class="data-card-title">Production Queue</span>
      <button class="btn btn-sm btn-outline" onclick="renderProductionOversight()">View Full Queue →</button>
    </div>
    <div class="data-card-body" style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px">
      <div style="text-align:center;padding:12px;background:var(--warning-l);border-radius:var(--radius-sm)"><div style="font-size:24px;font-weight:700;color:var(--warning)">${pending}</div><div class="text-xs text-muted">Pending</div></div>
      <div style="text-align:center;padding:12px;background:var(--maroon-xs);border-radius:var(--radius-sm)"><div style="font-size:24px;font-weight:700;color:var(--maroon)">${inProd}</div><div class="text-xs text-muted">In Production</div></div>
      <div style="text-align:center;padding:12px;background:var(--info-l);border-radius:var(--radius-sm)"><div style="font-size:24px;font-weight:700;color:var(--info)">${dispatch}</div><div class="text-xs text-muted">Ready</div></div>
      <div style="text-align:center;padding:12px;background:${delayed.length ? 'var(--danger-l)' : 'var(--success-l)'};border-radius:var(--radius-sm)"><div style="font-size:24px;font-weight:700;color:${delayed.length ? 'var(--danger)' : 'var(--success)'}">${delayed.length}</div><div class="text-xs text-muted">Delayed</div></div>
    </div>
  </div>`;
}

function scrollToDelayed() {
  document.getElementById('delayed-section')?.scrollIntoView({ behavior: 'smooth' });
}

// PRINT PERSONNEL REPORTING
// ── PRINT PERSONNEL: My Profile ───────────────────────────────────────────────
function renderPrintPersonnel() {
  const s = getState();
  const me = s.currentUser;
  if (!me || me.role !== 'print') { accessDenied('Personnel Management'); return; }

  const myShift = s.shifts.find(x => x.userId === me.id && x.status === 'open');
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const myShiftsThisMonth = s.shifts.filter(x => x.userId === me.id && new Date(x.openedAt) >= monthStart);
  const myShiftsTotal = s.shifts.filter(x => x.userId === me.id);
  const recentShifts = [...myShiftsTotal].reverse().slice(0, 30);
  const myLeave = (s.leaveRequests || []).filter(l => l.userId === me.id);
  const timecards = JSON.parse(localStorage.getItem('timecard_' + me.id) || '[]');

  document.getElementById('page-content').innerHTML = `
    <div class="page-header">
      <h1 class="page-title">My Profile & Attendance</h1>
      <p class="page-subtitle">View your profile, attendance history, leave records, and upload timecards.</p>
    </div>
    <div style="display:grid;grid-template-columns:1fr 2fr;gap:20px;margin-bottom:20px;">
      <div class="data-card">
        <div class="data-card-header"><span class="data-card-title">${iconSvg('users')} My Profile</span></div>
        <div class="data-card-body" style="display:flex;flex-direction:column;gap:0;">
          <div style="display:flex;align-items:center;gap:14px;padding-bottom:14px;border-bottom:1px solid var(--ink-10);margin-bottom:8px;">
            <div style="width:52px;height:52px;border-radius:50%;background:var(--maroon);display:flex;align-items:center;justify-content:center;color:#fff;font-size:22px;font-weight:700;flex-shrink:0;">${(me.name || me.username || '?')[0].toUpperCase()}</div>
            <div><div style="font-size:16px;font-weight:700;">${me.name || me.username}</div><div style="font-size:12px;color:var(--ink-60);">Printing Personnel · @${me.username}</div></div>
          </div>
          <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--ink-10)"><span style="color:var(--ink-60);font-size:13px;">Status</span>${myShift ? '<span class="badge badge-success">● On Shift</span>' : '<span class="badge badge-neutral">Off Shift</span>'}</div>
          <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--ink-10)"><span style="color:var(--ink-60);font-size:13px;">This Month</span><strong>${myShiftsThisMonth.length} days</strong></div>
          <div style="display:flex;justify-content:space-between;padding:8px 0;"><span style="color:var(--ink-60);font-size:13px;">Total Shifts</span><strong>${myShiftsTotal.length}</strong></div>
        </div>
      </div>
      <div class="data-card">
        <div class="data-card-header"><span class="data-card-title">${iconSvg('calendar')} Recent Attendance</span><span class="badge badge-neutral">${myShiftsThisMonth.length} this month</span></div>
        <div class="data-card-body no-pad">
          <table class="data-table">
            <thead><tr><th>Date</th><th>In</th><th>Out</th><th>Duration</th><th>Status</th></tr></thead>
            <tbody>${recentShifts.length ? recentShifts.map(sh => {
    const opened = new Date(sh.openedAt);
    const closed = sh.closedAt ? new Date(sh.closedAt) : null;
    const dur = closed ? (Math.round((closed - opened) / 360000) / 10) + 'h' : '—';
    return `<tr>
                <td>${opened.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                <td class="td-mono">${opened.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}</td>
                <td class="td-mono">${closed ? closed.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                <td class="td-mono">${dur}</td>
                <td>${sh.status === 'open' ? '<span class="badge badge-success">Open</span>' : '<span class="badge badge-neutral">Closed</span>'}</td>
              </tr>`;
  }).join('') : '<tr><td colspan="5" style="text-align:center;padding:24px;color:var(--ink-60)">No shift records yet.</td></tr>'}</tbody>
          </table>
        </div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">
      <div class="data-card">
        <div class="data-card-header"><span class="data-card-title">${iconSvg('calendar')} Leave Requests</span><button class="btn btn-sm btn-maroon" onclick="printPersonnelLeaveModal()">+ File Leave</button></div>
        <div class="data-card-body no-pad">
          <table class="data-table">
            <thead><tr><th>Filed</th><th>Type</th><th>Date</th><th>Status</th></tr></thead>
            <tbody>${myLeave.length ? [...myLeave].reverse().map(l => `<tr>
              <td class="xs">${new Date(l.filedAt || l.createdAt || Date.now()).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}</td>
              <td>${l.type || 'Leave'}</td>
              <td>${l.date || '—'}</td>
              <td>${l.status === 'approved' ? '<span class="badge badge-success">Approved</span>' : l.status === 'rejected' ? '<span class="badge badge-danger">Rejected</span>' : '<span class="badge badge-warning">Pending</span>'}</td>
            </tr>`).join('') : '<tr><td colspan="4" style="text-align:center;padding:24px;color:var(--ink-60)">No leave requests yet.</td></tr>'}</tbody>
          </table>
        </div>
      </div>
      <div class="data-card">
        <div class="data-card-header"><span class="data-card-title">${iconSvg('clipboard')} Timecard Upload</span><button class="btn btn-sm btn-maroon" onclick="printPersonnelTimecardModal()">↑ Upload</button></div>
        <div class="data-card-body no-pad">
          <table class="data-table">
            <thead><tr><th>Uploaded</th><th>File</th><th>Period</th></tr></thead>
            <tbody>${timecards.length ? [...timecards].reverse().map(tc => `<tr>
              <td class="xs">${new Date(tc.uploadedAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
              <td class="truncate" style="max-width:140px;" title="${tc.fileName || ''}">${tc.fileName || '—'}</td>
              <td class="xs">${tc.period || '—'}</td>
            </tr>`).join('') : '<tr><td colspan="3" style="text-align:center;padding:24px;color:var(--ink-60)">No timecards uploaded yet.</td></tr>'}</tbody>
          </table>
        </div>
      </div>
    </div>`;
}

function printPersonnelLeaveModal() {
  showModal(`<div class="modal-header"><h2>File Leave Request</h2><button class="btn-close-modal" onclick="closeModal()">✕</button></div>
    <div class="modal-body">
      <div class="form-row-2">
        <div class="form-group"><label>Leave Type</label><div class="form-select-wrap"><select id="leave-type" class="form-control">
          <option>Sick Leave</option><option>Vacation Leave</option><option>Emergency Leave</option><option>Others</option>
        </select></div></div>
        <div class="form-group"><label>Date of Leave</label><input id="leave-date" type="date" class="form-control" value="${new Date().toISOString().slice(0, 10)}"></div>
      </div>
      <div class="form-group"><label>Reason</label><textarea id="leave-reason" class="form-control" rows="3" placeholder="Brief reason for leave..."></textarea></div>
    </div>
    <div class="modal-footer"><button class="btn btn-outline" onclick="closeModal()">Cancel</button><button class="btn btn-maroon" onclick="printPersonnelSaveLeave()">Submit Request</button></div>`);
}

function printPersonnelSaveLeave() {
  const s = getState(); const me = s.currentUser;
  const type = document.getElementById('leave-type').value;
  const date = document.getElementById('leave-date').value;
  const reason = document.getElementById('leave-reason').value.trim();
  if (!date) { showToast('Please select a date.', 'error'); return; }
  s.leaveRequests = s.leaveRequests || [];
  s.leaveRequests.push({ id: 'leave_' + Date.now(), userId: me.id, type, date, reason, status: 'pending', filedAt: new Date().toISOString() });
  saveState(s); closeModal(); showToast('Leave request submitted.', 'success'); renderPrintPersonnel();
}

function printPersonnelTimecardModal() {
  showModal(`<div class="modal-header"><h2>Upload Timecard</h2><button class="btn-close-modal" onclick="closeModal()">✕</button></div>
    <div class="modal-body">
      <div class="form-group"><label>Pay Period</label><input id="tc-period" class="form-control" placeholder="e.g. Feb 1–15, 2026"></div>
      <div class="form-group"><label>Timecard File <span style="color:var(--danger)">*</span></label><input id="tc-file" type="file" class="form-control" accept="image/*,.pdf" onchange="tcReadFile(this)"></div>
      <input type="hidden" id="tc-data"><input type="hidden" id="tc-fname">
    </div>
    <div class="modal-footer"><button class="btn btn-outline" onclick="closeModal()">Cancel</button><button class="btn btn-maroon" onclick="printPersonnelSaveTimecard()">Upload</button></div>`);
}

function tcReadFile(input) {
  var file = input.files && input.files[0];
  if (!file) return;
  document.getElementById('tc-fname').value = file.name;
  var reader = new FileReader();
  reader.onload = function (e) { document.getElementById('tc-data').value = e.target.result; };
  reader.readAsDataURL(file);
}

function printPersonnelSaveTimecard() {
  const me = getState().currentUser;
  const fname = document.getElementById('tc-fname').value;
  if (!fname) { showToast('Please select a file.', 'error'); return; }
  const key = 'timecard_' + me.id;
  const tcs = JSON.parse(localStorage.getItem(key) || '[]');
  tcs.push({ id: 'tc_' + Date.now(), fileName: fname, period: document.getElementById('tc-period').value.trim(), fileData: document.getElementById('tc-data').value, uploadedAt: new Date().toISOString() });
  localStorage.setItem(key, JSON.stringify(tcs));
  closeModal(); showToast('Timecard uploaded!', 'success'); renderPrintPersonnel();
}

// ── PRINT PERSONNEL: My Payslip ───────────────────────────────────────────────
function viewPrintPayslipModal(offset) {
  const s = getState();
  const me = s.currentUser;
  const DAILY_RATE = me.dailyRate || 400;
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() - offset, 1);
  const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
  const shifts = s.shifts.filter(x =>
    x.userId === me.id && x.status !== 'open' &&
    new Date(x.openedAt) >= d && new Date(x.openedAt) <= monthEnd
  );
  const basicPay = shifts.length * DAILY_RATE;
  const gross = basicPay;
  const sss = Math.round(gross * 0.045);
  const phil = Math.round(gross * 0.02);
  const hdmf = Math.min(Math.round(gross * 0.02), 100);
  const ded = sss + phil + hdmf;
  const net = Math.max(0, gross - ded);
  const pLabel = d.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' });
  const payDate = new Date(d.getFullYear(), d.getMonth() + 1, 15).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' });
  const empNum = me.employeeNumber || ('BPS-' + String(me.id || '001').replace(/\D/g, '').padStart(3, '0'));
  const COMPANY = getCompanyInfo();

  const html = `<div style="font-family:'Arial',sans-serif;font-size:12px;color:#111;padding:24px 32px;">
    <div style="display:flex;align-items:flex-start;gap:24px;margin-bottom:16px;">
      <div style="flex-shrink:0;width:90px;"><img src="logo.png" alt="South Pafps" style="width:90px;height:auto;display:block;" onerror="this.style.display='none'"></div>
      <div style="flex:1;padding-top:4px;"><div style="font-weight:700;font-size:13px;margin-bottom:4px;">${COMPANY.name}</div><div style="font-size:11px;line-height:1.8;color:#333;">${COMPANY.address1}<br>${COMPANY.address2}<br>${COMPANY.tel}</div></div>
    </div>
    <div style="text-align:center;font-weight:700;font-size:13px;letter-spacing:3px;margin:0 0 10px;">PAYSLIP</div>
    <table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:0;">
      <colgroup><col style="width:20%"><col style="width:30%"><col style="width:20%"><col style="width:30%"></colgroup>
      <tbody>
        <tr><td style="padding:4px 8px;border:1px solid #999;"><strong>Employee Name:</strong></td><td style="padding:4px 8px;border:1px solid #999;">${me.name || '—'}</td><td style="padding:4px 8px;border:1px solid #999;"><strong>SSS Number:</strong></td><td style="padding:4px 8px;border:1px solid #999;">${me.sssNumber || ''}</td></tr>
        <tr><td style="padding:4px 8px;border:1px solid #999;"><strong>Employee Number:</strong></td><td style="padding:4px 8px;border:1px solid #999;">${empNum}</td><td style="padding:4px 8px;border:1px solid #999;"><strong>PhilHealth Number:</strong></td><td style="padding:4px 8px;border:1px solid #999;">${me.philhealthNumber || ''}</td></tr>
        <tr><td style="padding:4px 8px;border:1px solid #999;"><strong>Position:</strong></td><td style="padding:4px 8px;border:1px solid #999;">Printing Personnel</td><td style="padding:4px 8px;border:1px solid #999;"><strong>Pag-IBIG Number:</strong></td><td style="padding:4px 8px;border:1px solid #999;">${me.hdmfNumber || ''}</td></tr>
        <tr><td style="padding:4px 8px;border:1px solid #999;"><strong>Pay Period:</strong></td><td style="padding:4px 8px;border:1px solid #999;">${pLabel}</td><td style="padding:4px 8px;border:1px solid #999;"><strong>TIN Number:</strong></td><td style="padding:4px 8px;border:1px solid #999;">${me.tinNumber || ''}</td></tr>
        <tr><td style="padding:4px 8px;border:1px solid #999;"><strong>Pay Date:</strong></td><td style="padding:4px 8px;border:1px solid #999;">${payDate}</td><td style="padding:4px 8px;border:1px solid #999;"></td><td style="padding:4px 8px;border:1px solid #999;"></td></tr>
      </tbody>
    </table>
    <table style="width:100%;border-collapse:collapse;font-size:12px;margin-top:-1px;">
      <colgroup><col style="width:34%"><col style="width:9%"><col style="width:13%"><col style="width:4px"><col style="width:auto"><col style="width:14%"></colgroup>
      <thead><tr>
        <th colspan="3" style="border:1px solid #999;padding:6px 8px;text-align:left;font-weight:700;">EARNINGS/INCOME</th>
        <td style="background:#333;width:4px;padding:0;"></td>
        <th colspan="2" style="border:1px solid #999;padding:6px 8px;text-align:left;font-weight:700;">DEDUCTIONS</th>
      </tr></thead>
      <tbody>
        <tr>
          <td style="border-left:1px solid #999;padding:5px 8px;">Basic Pay @ ₱${fmt(DAILY_RATE)}/day</td>
          <td style="border-left:1px solid #ddd;padding:5px 8px;text-align:right;">${shifts.length}</td>
          <td style="border-left:1px solid #ddd;border-right:1px solid #999;padding:5px 8px;text-align:right;">₱${fmt(basicPay)}</td>
          <td style="background:#333;width:4px;padding:0;"></td>
          <td style="border-left:1px solid #999;padding:5px 8px;">SSS EE Contribution</td>
          <td style="border-right:1px solid #999;padding:5px 8px;text-align:right;">${sss > 0 ? '₱' + fmt(sss) : ''}</td>
        </tr>
        <tr>
          <td style="border-left:1px solid #999;padding:5px 8px;"></td>
          <td style="border-left:1px solid #ddd;padding:5px 8px;"></td>
          <td style="border-left:1px solid #ddd;border-right:1px solid #999;padding:5px 8px;"></td>
          <td style="background:#333;width:4px;padding:0;"></td>
          <td style="border-left:1px solid #999;padding:5px 8px;">PhilHealth EE Contribution</td>
          <td style="border-right:1px solid #999;padding:5px 8px;text-align:right;">${phil > 0 ? '₱' + fmt(phil) : ''}</td>
        </tr>
        <tr>
          <td style="border-left:1px solid #999;padding:5px 8px;"></td>
          <td style="border-left:1px solid #ddd;padding:5px 8px;"></td>
          <td style="border-left:1px solid #ddd;border-right:1px solid #999;padding:5px 8px;"></td>
          <td style="background:#333;width:4px;padding:0;"></td>
          <td style="border-left:1px solid #999;padding:5px 8px;">Pag-IBIG Contribution</td>
          <td style="border-right:1px solid #999;padding:5px 8px;text-align:right;">${hdmf > 0 ? '₱' + fmt(hdmf) : ''}</td>
        </tr>
        <tr style="height:22px;">
          <td style="border-left:1px solid #999;"></td><td style="border-left:1px solid #ddd;"></td><td style="border-left:1px solid #ddd;border-right:1px solid #999;"></td>
          <td style="background:#333;padding:0;"></td>
          <td style="border-left:1px solid #999;"></td><td style="border-right:1px solid #999;"></td>
        </tr>
      </tbody>
      <tfoot>
        <tr style="font-weight:700;">
          <td colspan="2" style="border:1px solid #999;padding:6px 8px;">GROSS PAY</td>
          <td style="border:1px solid #999;padding:6px 8px;text-align:right;">₱${fmt(gross)}</td>
          <td style="background:#333;width:4px;padding:0;"></td>
          <td style="border:1px solid #999;padding:6px 8px;">TOTAL DEDUCTION</td>
          <td style="border:1px solid #999;padding:6px 8px;text-align:right;">₱${fmt(ded)}</td>
        </tr>
        <tr style="font-weight:700;">
          <td colspan="3" style="border:1px solid #999;padding:6px 8px;background:#fff;"></td>
          <td style="background:#333;width:4px;padding:0;"></td>
          <td style="border:1px solid #999;padding:6px 8px;">NET PAY</td>
          <td style="border:1px solid #999;padding:6px 8px;text-align:right;">₱${fmt(net)}</td>
        </tr>
      </tfoot>
    </table>
    <div style="margin-top:16px;border-top:2px dashed #ccc;padding-top:4px;"></div>
  </div>`;

  showModal(`<div class="modal-header"><h2>📄 Payslip — ${pLabel}</h2><button class="btn-close-modal" onclick="closeModal()">✕</button></div>
    <div class="modal-body" id="payslip-modal-doc" style="padding:0;max-height:75vh;overflow-y:auto;">${html}</div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeModal()">Close</button>
      <button class="btn btn-maroon" onclick="printContent(document.getElementById('payslip-modal-doc').innerHTML,'Payslip — South Pafps')">${iconSvg('printer')} Print Payslip</button>
    </div>`);
}

function renderPrintPayslip() {
  // Unified with renderPayslip — print users view admin-sent payslips the same way
  renderPayslip();
}

// renderPrintReports is defined below near print personnel functions

// GCASH QR / PAYMENT LINK
function showGCashQRModal(amount) {
  const cfg = getSystemConfig();
  const gcashNum = cfg.gcashNumber || '0917-000-0000';
  const gcashName = cfg.gcashName || 'South Pafps Packaging';
  const amountToShow = amount || 0;
  showModal(`
    <div class="modal-header"><h2>${iconSvg('phone')} GCash Payment</h2><button class="btn-close-modal" onclick="closeModal()">✕</button></div>
    <div class="modal-body" style="text-align:center">
      <div style="background:var(--cream);border:2px solid var(--maroon);border-radius:var(--radius);padding:24px;display:inline-block;margin-bottom:16px">
        <div style="font-size:48px;margin-bottom:8px">📱</div>
        <div style="font-size:14px;font-weight:700;color:var(--maroon);margin-bottom:4px">GCash Send Money</div>
        <div style="font-family:var(--font-mono);font-size:20px;font-weight:700;margin-bottom:4px">${gcashNum}</div>
        <div style="font-size:13px;color:var(--ink-60)">${gcashName}</div>
        ${amountToShow > 0 ? `<div style="font-size:22px;font-weight:700;color:var(--maroon);margin-top:8px">₱${fmt(amountToShow)}</div>` : ''}
      </div>
      <p class="text-sm text-muted">Have the customer send payment via GCash, then enter the reference number below.</p>
      <div class="form-group" style="max-width:280px;margin:12px auto 0">
        <label>GCash Reference #</label>
        <input id="gcash-ref-input" class="form-control" placeholder="e.g. 1234567890">
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeModal()">Close</button>
      <button class="btn btn-maroon" onclick="copyGCashRef()">Copy Reference</button>
    </div>`);
}

function copyGCashRef() {
  const ref = document.getElementById('gcash-ref-input')?.value.trim();
  if (!ref) { showToast('Please enter the reference number first.', 'error'); return; }
  // Copy to POS reference field if it exists (POS context)
  const posRefField = document.getElementById('pay-gcash-ref');
  if (posRefField) { posRefField.value = ref; }
  navigator.clipboard?.writeText(ref).then(() => showToast('Reference # saved.', 'success'));
  closeModal();
}

// HELPER: statusBadge (if not already defined)
if (typeof statusBadge === 'undefined') {
  window.statusBadge = function (status) {
    const map = {
      pending: 'badge-neutral',
      production: 'badge-maroon',
      dispatch: 'badge-info',
      completed: 'badge-success',
      cancelled: 'badge-danger',
    };
    const cls = map[status] || 'badge-neutral';
    return `<span class="badge ${cls}">${status || '—'}</span>`;
  };
}


// ─────────────────────────────────────────────────────────────────
// NEW PAGE STUBS & IMPLEMENTATIONS
// Added to support the restructured sidebar navigation
// ─────────────────────────────────────────────────────────────────

// ── PRODUCT CATALOG (reuses product-mgmt render) ─────────────────
// Already aliased in pages map → renderProductMgmt

// ── CATEGORIES ───────────────────────────────────────────────────
function renderCategories() {
  const s = getState();
  if (!s.currentUser || s.currentUser.role !== 'admin') { accessDenied('Categories'); return; }
  const cats = [...new Set((s.products || []).map(p => p.category).filter(Boolean))];
  document.getElementById('page-content').innerHTML = `
    <div class="page-header">
      <h1 class="page-title">Categories</h1>
      <p class="page-subtitle">Product groups used in orders and the catalog</p>
    </div>
    <div class="data-card">
      <div class="data-card-header">
        <span class="data-card-title">Product Groups</span>
      </div>
      <div class="data-card-body no-pad">
        <table class="data-table">
          <thead><tr><th>#</th><th>Category Name</th><th>Products</th></tr></thead>
          <tbody>
            ${cats.length ? cats.map((c, i) => {
    const count = s.products.filter(p => p.category === c && p.active).length;
    return `<tr><td>${i + 1}</td><td>${c}</td><td>${count}</td></tr>`;
  }).join('') : '<tr><td colspan="3" style="text-align:center;color:var(--ink-40);padding:32px">No categories found. Add products with categories first.</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>`;
}

// ── EMPLOYEE RECORDS ──────────────────────────────────────────────
function getEmployees() {
  const s = getState();
  if (!s.employees) s.employees = [];
  return s.employees;
}

function saveEmployees(employees) {
  const s = getState();
  s.employees = employees;
  saveState(s);
}

function renderEmployeeRecords() {
  const s = getState();
  const u = s.currentUser;
  const role = normalizeRole(u?.role);
  if (!u || !['admin', 'hr', 'branch_manager'].includes(role)) { accessDenied('Employee Records'); return; }

  let employees = getEmployees();
  if (role === 'branch_manager') {
    employees = employees.filter(e => e.branchId === u.branchId);
  }

  const pageSubtitle = role === 'branch_manager'
    ? `Staff & employee records for your branch`
    : `HR records — separate from system login accounts`;

  document.getElementById('page-content').innerHTML = `
    <div class="page-header" style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:12px;">
      <div><h1 class="page-title">Employee Records</h1><p class="page-subtitle">${pageSubtitle}</p></div>
      <button class="btn btn-maroon" onclick="showAddEmployeeModal()">+ Add Employee</button>
    </div>
    <div class="data-card">
      <div class="data-card-header">
        <input type="text" class="form-control" id="emp-search" placeholder="Search by name, position, or branch…" style="max-width:320px;" oninput="filterEmployeeRecords(this.value)">
      </div>
      <div class="data-card-body no-pad" id="emp-records-body">
        ${renderEmployeeRows(employees, '')}
      </div>
    </div>`;
}

function renderEmployeeRows(employees, query) {
  const s = getState();
  const filtered = query
    ? employees.filter(e =>
      (e.name || '').toLowerCase().includes(query.toLowerCase()) ||
      (e.position || '').toLowerCase().includes(query.toLowerCase()) ||
      (e.branchName || '').toLowerCase().includes(query.toLowerCase()))
    : employees;
  if (!filtered.length) return '<div style="text-align:center;color:var(--ink-40);padding:40px">No employee records yet. Click "+ Add Employee" to get started.</div>';
  return `<table class="data-table">
    <thead><tr><th>Name</th><th>Position</th><th>Branch</th><th>Employment Status</th><th>Status</th><th>Account</th><th>Action</th></tr></thead>
    <tbody>
      ${filtered.map(e => {
    const b = (s.branches || []).find(b => b.id === e.branchId);
    const linkedUser = (s.users || []).find(u => u.employeeId === e.id || (!u.employeeId && u.name === e.name && u.role === e.role && u.branchId === e.branchId));
    // Backfill employeeId on legacy accounts that matched by name/role
    if (linkedUser && !linkedUser.employeeId) { linkedUser.employeeId = e.id; saveState(s); }
    const accountBadge = linkedUser
      ? `<span class="badge badge-success" style="font-family:var(--font-mono);font-size:10px">@${linkedUser.username}</span>`
      : `<span class="badge badge-danger" style="font-size:10px;cursor:pointer" onclick="promptLinkAccount('${e.id}')" title="No login account — click to create one">No Account</span>`;
    return `<tr>
          <td><strong>${e.name || '—'}</strong>${e.email ? `<div style="font-size:11px;color:var(--ink-50)">${e.email}</div>` : ''}</td>
          <td>${e.position || '—'}</td>
          <td>${b ? b.name : (e.branchId ? e.branchId : '—')}</td>
          <td>${e.employmentStatus || '—'}</td>
          <td><span class="badge ${e.active !== false ? 'badge-success' : 'badge-danger'}">${e.active !== false ? 'Active' : 'Inactive'}</span></td>
          <td>${accountBadge}</td>
          <td>
            <button class="btn btn-sm btn-outline" onclick="showEmployeeDetail('${e.id}')">View</button>
            <button class="btn btn-sm btn-outline" onclick="editEmployeeModal('${e.id}')">Edit</button>
          </td>
        </tr>`;
  }).join('')}
    </tbody>
  </table>`;
}

function promptLinkAccount(empId) {
  const s = getState();
  const e = getEmployees().find(x => x.id === empId);
  if (!e) return;
  const eyeSvg = iconSvg('eye');
  showModal(`
    <div class="modal-header">
      <h2>${iconSvg('users')} Create Login Account</h2>
      <button class="btn-close-modal" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-body">
      <div style="background:var(--cream);border-radius:var(--radius);padding:12px 16px;margin-bottom:16px;font-size:13px;">
        Creating a system login account for <strong>${e.name}</strong>.
      </div>
      <div class="form-row-2">
        <div class="form-group">
          <label>Username <span style="color:var(--danger)">*</span></label>
          <input class="form-control" id="la-username" placeholder="e.g. juan.delacruz" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false">
        </div>
        <div class="form-group">
          <label>Password <span style="color:var(--danger)">*</span></label>
          <div class="pw-wrap">
            <input id="la-password" type="password" class="form-control" placeholder="Min 6 characters" autocomplete="new-password">
            <button type="button" class="pw-eye" onclick="togglePwVisibility('la-password', this)" tabindex="-1">${eyeSvg}</button>
          </div>
        </div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
      <button class="btn btn-maroon" onclick="confirmLinkAccount('${empId}')">Create Account</button>
    </div>
  `);
}

function confirmLinkAccount(empId) {
  const s = getState();
  const e = getEmployees().find(x => x.id === empId);
  if (!e) return;
  const username = document.getElementById('la-username')?.value.trim();
  const password = document.getElementById('la-password')?.value;
  if (!username) { showToast('Username is required.', 'error'); return; }
  if (!password || password.length < 6) { showToast('Password must be at least 6 characters.', 'error'); return; }
  if (s.users.find(u => u.username.toLowerCase() === username.toLowerCase())) {
    showToast('Username already taken.', 'error'); return;
  }
  const newUser = {
    id: 'usr_' + Date.now(),
    employeeId: empId,
    name: e.name,
    username,
    password,
    role: normalizeRole(e.role || 'cashier'),
    position: e.position || '',
    branchId: e.branchId || '',
  };
  s.users.push(newUser);
  recordAudit(s, {
    action: 'create_user',
    message: `Login account linked to existing employee: ${username}`,
    userId: s.currentUser?.id || null,
    branchId: e.branchId || null,
    details: { createdUsername: username, employeeId: empId },
  });
  saveState(s);
  DB.saveUser(newUser);
  closeModal();
  showToast(`Login account "@${username}" created for ${e.name}.`, 'success');
  renderEmployeeRecords();
}

function filterEmployeeRecords(query) {
  const el = document.getElementById('emp-records-body');
  if (el) el.innerHTML = renderEmployeeRows(getEmployees(), query);
}

function showEmployeeDetail(empId) {
  const s = getState();
  const u = getEmployees().find(x => x.id === empId);
  if (!u) return;
  const b = (s.branches || []).find(b => b.id === u.branchId);

  const field = (label, val) =>
    `<div style="background:var(--cream);border-radius:var(--radius-sm);padding:10px 14px;">
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--ink-40);margin-bottom:4px">${label}</div>
      <div style="font-size:14px;font-weight:600;color:var(--ink)">${val || '<span style=\'color:var(--ink-40)\'>—</span>'}</div>
    </div>`;

  const sectionHead = (icon, title) =>
    `<div style="grid-column:1/-1;display:flex;align-items:center;gap:8px;margin-top:16px;margin-bottom:4px;padding-bottom:8px;border-bottom:2px solid var(--maroon);">
      <span style="font-size:15px">${icon}</span>
      <span style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:var(--maroon)">${title}</span>
    </div>`;

  const initials = (u.name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();

  showModal(`
    <div class="modal-header">
      <h2>${iconSvg('users')} Employee Profile</h2>
      <button class="btn-close-modal" onclick="closeModal()">&#x2715;</button>
    </div>
    <div class="modal-body">
      <div style="display:flex;align-items:center;gap:16px;background:linear-gradient(135deg,var(--maroon),#a0263e);border-radius:var(--radius);padding:20px 24px;margin-bottom:20px;color:white;">
        <div style="width:56px;height:56px;border-radius:50%;background:rgba(255,255,255,0.25);display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:700;flex-shrink:0;">${initials}</div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:20px;font-weight:700;line-height:1.2">${u.name || '—'}</div>
          <div style="font-size:13px;opacity:0.85;margin-top:3px">${u.position || '—'} &nbsp;·&nbsp; ${b ? b.name : '—'}</div>
        </div>
        <div>${u.active !== false
      ? '<span style="background:rgba(255,255,255,0.2);color:white;padding:4px 12px;border-radius:999px;font-size:11px;font-weight:700;">ACTIVE</span>'
      : '<span style="background:rgba(0,0,0,0.3);color:#fca5a5;padding:4px 12px;border-radius:999px;font-size:11px;font-weight:700;">INACTIVE</span>'
    }</div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
        ${sectionHead('👤', 'Personal Information')}
        ${field('Full Name', u.name)}
        ${field('Email', u.email)}
        ${field('Birth Date', u.birthdate ? new Date(u.birthdate).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' }) : null)}
        ${field('Gender', u.gender)}
        ${field('Emergency Contact', u.emergencyContact)}
        <div style="grid-column:1/-1">${field('Home Address', u.address)}</div>

        ${sectionHead('💼', 'Employment Details')}
        ${field('Position / Title', u.position)}
        ${field('Branch', b ? b.name : '—')}
        ${field('Date Hired', u.dateHired ? new Date(u.dateHired).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' }) : null)}
        ${field('Employment Status', u.employmentStatus)}
        <div style="grid-column:1/-1">${field('Account Status', u.active !== false ? '<span class="badge badge-success">Active</span>' : '<span class="badge badge-danger">Inactive</span>')}</div>

        ${sectionHead('🏛️', 'Government Numbers')}
        ${field('SSS Number', u.sss)}
        ${field('PhilHealth', u.philhealth)}
        ${field('Pag-IBIG', u.pagibig)}
        ${field('TIN', u.tin)}
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeModal()">Close</button>
      <button class="btn btn-maroon" onclick="closeModal();editEmployeeModal('${empId}')">&#9998; Edit Record</button>
    </div>
  `, 'modal-lg');
}

function editEmployeeModal(empId) {
  const s = getState();
  const e = getEmployees().find(x => x.id === empId);
  if (!e) return;
  const branches = s.branches || [];
  const branchOpts = branches.map(b => `<option value="${b.id}" ${b.id === e.branchId ? 'selected' : ''}>${b.name}</option>`).join('');
  const secHead = (title) => `<div style="font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--maroon);padding:16px 0 8px;border-bottom:2px solid var(--maroon);margin-bottom:14px;margin-top:8px;">${title}</div>`;

  showModal(`
    <div class="modal-header">
      <h2>${iconSvg('users')} Edit Employee — ${e.name || ''}</h2>
      <button class="btn-close-modal" onclick="closeModal()">&#x2715;</button>
    </div>
    <div class="modal-body" style="max-height:70vh;overflow-y:auto;">
      ${secHead('Personal Information')}
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div class="form-group" style="grid-column:1/-1;">
          <label>Full Name <span style="color:var(--danger)">*</span></label>
          <input class="form-control" id="ee-name" value="${e.name || ''}">
        </div>
        <div class="form-group">
          <label>Email Address</label>
          <input class="form-control" id="ee-email" type="email" value="${e.email || ''}">
        </div>
        <div class="form-group">
          <label>Birth Date</label>
          <input class="form-control" type="date" id="ee-bday" value="${e.birthdate || ''}">
        </div>
        <div class="form-group">
          <label>Gender</label>
          <div class="form-select-wrap"><select class="form-control" id="ee-gender">
            <option value="">Select gender</option>
            <option ${e.gender === 'Male' ? 'selected' : ''}>Male</option>
            <option ${e.gender === 'Female' ? 'selected' : ''}>Female</option>
          </select></div>
        </div>
        <div class="form-group">
          <label>Emergency Contact</label>
          <input class="form-control" id="ee-emerg" value="${e.emergencyContact || ''}">
        </div>
        <div class="form-group" style="grid-column:1/-1;">
          <label>Home Address</label>
          <input class="form-control" id="ee-addr" value="${e.address || ''}">
        </div>
      </div>

      ${secHead('Employment Details')}
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div class="form-group">
          <label>Position / Job Title</label>
          <input class="form-control" id="ee-pos" value="${e.position || ''}">
        </div>
        <div class="form-group">
          <label>Branch</label>
          <div class="form-select-wrap"><select class="form-control" id="ee-branch">
            <option value="">Select branch…</option>
            ${branchOpts}
          </select></div>
        </div>
        <div class="form-group">
          <label>Date Hired</label>
          <input class="form-control" type="date" id="ee-hired" value="${e.dateHired || ''}">
        </div>
        <div class="form-group">
          <label>Employment Status</label>
          <div class="form-select-wrap"><select class="form-control" id="ee-empstatus">
            <option ${e.employmentStatus === 'Regular' ? 'selected' : ''}>Regular</option>
            <option ${e.employmentStatus === 'Probationary' ? 'selected' : ''}>Probationary</option>
            <option ${e.employmentStatus === 'Contractual' ? 'selected' : ''}>Contractual</option>
          </select></div>
        </div>
        <div class="form-group" style="grid-column:1/-1;">
          <label>Active Status</label>
          <div class="form-select-wrap"><select class="form-control" id="ee-active">
            <option value="1" ${e.active !== false ? 'selected' : ''}>Active</option>
            <option value="0" ${e.active === false ? 'selected' : ''}>Inactive</option>
          </select></div>
        </div>
      </div>

      ${secHead('Government Numbers')}
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div class="form-group"><label>SSS Number</label><input class="form-control" id="ee-sss" value="${e.sss || ''}"></div>
        <div class="form-group"><label>PhilHealth</label><input class="form-control" id="ee-phil" value="${e.philhealth || ''}"></div>
        <div class="form-group"><label>Pag-IBIG</label><input class="form-control" id="ee-pagibig" value="${e.pagibig || ''}"></div>
        <div class="form-group"><label>TIN</label><input class="form-control" id="ee-tin" value="${e.tin || ''}"></div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
      <button class="btn btn-danger" onclick="deleteEmployee('${empId}')" style="margin-right:auto">Delete Record</button>
      <button class="btn btn-maroon" onclick="saveEditEmployee('${empId}')">Save Changes</button>
    </div>
  `, 'modal-lg');
}

function saveEditEmployee(empId) {
  const employees = getEmployees();
  const e = employees.find(x => x.id === empId);
  if (!e) return;
  const name = document.getElementById('ee-name')?.value.trim();
  if (!name) { showToast('Full Name is required.', 'error'); return; }
  e.name = name;
  e.email = document.getElementById('ee-email')?.value.trim() || '';
  e.birthdate = document.getElementById('ee-bday')?.value || '';
  e.gender = document.getElementById('ee-gender')?.value || '';
  e.emergencyContact = document.getElementById('ee-emerg')?.value.trim() || '';
  e.address = document.getElementById('ee-addr')?.value.trim() || '';
  e.position = document.getElementById('ee-pos')?.value.trim() || '';
  e.branchId = document.getElementById('ee-branch')?.value || '';
  e.dateHired = document.getElementById('ee-hired')?.value || '';
  e.employmentStatus = document.getElementById('ee-empstatus')?.value || '';
  e.active = document.getElementById('ee-active')?.value === '1';
  e.sss = document.getElementById('ee-sss')?.value.trim() || '';
  e.philhealth = document.getElementById('ee-phil')?.value.trim() || '';
  e.pagibig = document.getElementById('ee-pagibig')?.value.trim() || '';
  e.tin = document.getElementById('ee-tin')?.value.trim() || '';
  e.updatedAt = new Date().toISOString();
  saveEmployees(employees);

  // Sync name, branch, role to the linked user account if one exists
  const s = getState();
  const linkedUser = s.users.find(u => u.employeeId === empId || (u.name === e.name && u.role === e.role));
  if (linkedUser) {
    linkedUser.name = e.name;
    linkedUser.branchId = e.branchId;
    linkedUser.position = e.position;
    saveState(s);
    DB.updateUser(linkedUser.id, { name: linkedUser.name, branchId: linkedUser.branchId, position: linkedUser.position });
  }

  // Persist all HR fields to the DB (via PUT /users/:linkedUserId)
  DB.updateEmployee(empId, { ...e, linkedUserId: linkedUser?.id });

  closeModal();
  showToast('Employee record updated!', 'success');
  renderEmployeeRecords();
}

function deleteEmployee(empId) {
  confirmModal({
    title: 'Delete Employee Record',
    message: 'Are you sure you want to delete this employee record? This cannot be undone.',
    confirmText: 'Delete Employee',
    icon: '👤',
    onConfirm: function () { _deleteEmployeeConfirmed(empId); }
  });
  return;
}
function _deleteEmployeeConfirmed(empId) {
  const employees = getEmployees().filter(x => x.id !== empId);
  saveEmployees(employees);

  // Delete the linked system login account — this also removes the employee_id
  // from the DB row, so state.php will no longer reconstruct this employee on reload
  const s = getState();
  const linkedUser = s.users.find(u => u.employeeId === empId);
  if (linkedUser) {
    s.users = s.users.filter(u => u.id !== linkedUser.id);
    saveState(s);
    DB.deleteUser(linkedUser.id);
  }

  closeModal();
  showToast('Employee record and login account deleted.', 'warning');
  renderEmployeeRecords();
}

function showAddEmployeeModal() {
  const s = getState();
  const me = s.currentUser;
  const branches = s.branches || [];
  const isTeamLeader = me && me.role === 'team_leader';
  const secHead = (title) => `<div style="font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--maroon);padding:16px 0 8px;border-bottom:2px solid var(--maroon);margin-bottom:14px;margin-top:8px;">${title}</div>`;

  showModal(`
    <div class="modal-header">
      <h2>${iconSvg('users')} Add New Employee</h2>
      <button class="btn-close-modal" onclick="closeModal()">&#x2715;</button>
    </div>
    <div class="modal-body" style="max-height:70vh;overflow-y:auto;">

      ${secHead('Personal Information')}
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div class="form-group" style="grid-column:1/-1;">
          <label>Full Name <span style="color:var(--danger)">*</span></label>
          <input class="form-control" id="ae-name" placeholder="e.g. Juan Dela Cruz">
        </div>
        <div class="form-group">
          <label>Email Address</label>
          <input class="form-control" id="ae-email" type="email" placeholder="juan@email.com">
        </div>
        <div class="form-group">
          <label>Birth Date</label>
          <input class="form-control" type="date" id="ae-bday">
        </div>
        <div class="form-group">
          <label>Gender</label>
          <div class="form-select-wrap"><select class="form-control" id="ae-gender">
            <option value="">Select gender</option>
            <option>Male</option>
            <option>Female</option>
          </select></div>
        </div>
        <div class="form-group">
          <label>Emergency Contact</label>
          <input class="form-control" id="ae-emerg" placeholder="Name / Number">
        </div>
        <div class="form-group" style="grid-column:1/-1;">
          <label>Home Address</label>
          <input class="form-control" id="ae-addr" placeholder="Street, City, Province">
        </div>
      </div>

      ${secHead('Employment Details')}
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div class="form-group">
          <label>Role / Department <span style="color:var(--danger)">*</span></label>
          <div class="form-select-wrap"><select class="form-control" id="ae-role" onchange="aeUpdatePositions(); aeUpdateBranchForRole()">
            <option value="cashier">Cashier</option>
            <option value="inventory_staff">Inventory Staff</option>
            <option value="branch_manager">Branch Manager</option>
            <option value="hr">HR</option>
            <option value="print">Printing Personnel</option>
          </select></div>
        </div>
        <div class="form-group">
          <label>Position / Job Title <span style="color:var(--danger)">*</span></label>
          <div class="form-select-wrap"><select class="form-control" id="ae-pos">
            <option value="Cashier">Cashier</option>
          </select></div>
        </div>
        <div class="form-group">
          <label>Branch</label>
          <div class="form-select-wrap"><select class="form-control" id="ae-branch">
            <option value="">Select branch…</option>
            ${branches.map(b => `<option value="${b.id}">${b.name}</option>`).join('')}
          </select></div>
        </div>
        <div class="form-group">
          <label>Date Hired</label>
          <input class="form-control" type="date" id="ae-hired">
        </div>
        <div class="form-group">
          <label>Employment Status</label>
          <div class="form-select-wrap"><select class="form-control" id="ae-empstatus">
            <option>Regular</option>
            <option>Probationary</option>
            <option>Contractual</option>
          </select></div>
        </div>
      </div>

      ${secHead('Government Numbers')}
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div class="form-group"><label>SSS Number</label><input class="form-control" id="ae-sss" placeholder="XX-XXXXXXX-X"></div>
        <div class="form-group"><label>PhilHealth</label><input class="form-control" id="ae-phil" placeholder="XXXX-XXXXX-X"></div>
        <div class="form-group"><label>Pag-IBIG</label><input class="form-control" id="ae-pagibig" placeholder="XXXX-XXXX-XXXX"></div>
        <div class="form-group"><label>TIN</label><input class="form-control" id="ae-tin" placeholder="XXX-XXX-XXX"></div>
      </div>

      ${secHead('System Login Account')}
      <div id="ae-account-section">
      <div style="background:var(--cream);border-radius:var(--radius);padding:12px 16px;margin-bottom:14px;font-size:13px;color:var(--ink-60);line-height:1.5;">
        This will create a login account so the employee can access the system (schedule, time card, leave requests).
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div class="form-group">
          <label>Username <span style="color:var(--danger)">*</span></label>
          <input class="form-control" id="ae-username" placeholder="e.g. juan.delacruz" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false">
        </div>
        <div class="form-group">
          <label>Password <span style="color:var(--danger)">*</span></label>
          <div class="pw-wrap">
            <input id="ae-password" type="password" class="form-control" placeholder="Min 6 characters" autocomplete="new-password">
            <button type="button" class="pw-eye" onclick="togglePwVisibility('ae-password', this)" tabindex="-1">${iconSvg('eye')}</button>
          </div>
        </div>
      </div>
      </div>

    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
      <button class="btn btn-maroon" onclick="saveNewEmployee()">${iconSvg('check')} Save Employee</button>
    </div>
  `, 'modal-lg');
}

function aeUpdatePositions() {
  const role = document.getElementById('ae-role')?.value;
  const posSel = document.getElementById('ae-pos');
  const accountSection = document.getElementById('ae-account-section');
  if (!posSel) return;
  const list = getPositionOptionsByRole(role);
  posSel.innerHTML = list.map(p => `<option value="${p}">${p}</option>`).join('');
}

function aeUpdateBranchForRole() {
  const role = document.getElementById('ae-role')?.value;
  const branchSel = document.getElementById('ae-branch');
  if (!branchSel) return;
  if (roleCanBeMainBranchOnly(role)) {
    branchSel.value = 'b1';
    branchSel.disabled = true;
    branchSel.title = `${getRoleLabel(role)} can only be assigned to the Main Branch`;
  } else {
    branchSel.disabled = false;
    branchSel.title = '';
  }
}

function saveNewEmployee() {
  const s = getState();
  const name = document.getElementById('ae-name')?.value.trim();
  const username = document.getElementById('ae-username')?.value.trim();
  const password = document.getElementById('ae-password')?.value;
  const role = document.getElementById('ae-role')?.value || 'cashier';
  const branchId = document.getElementById('ae-branch')?.value || '';

  if (!name) { showToast('Full Name is required.', 'error'); return; }
  if (!username) { showToast('Username is required.', 'error'); return; }
  if (!password || password.length < 6) { showToast('Password must be at least 6 characters.', 'error'); return; }
  if (s.users.find(u => u.username.toLowerCase() === username.toLowerCase())) {
    showToast('Username already taken — please choose another.', 'error'); return;
  }
  if (roleCanBeMainBranchOnly(role) && branchId !== 'b1') { showToast(`${getRoleLabel(role)} can only be assigned to the Main Branch.`, 'error'); return; }

  const empId = 'emp_' + Date.now();

  const newEmployee = {
    id: empId,
    name,
    email: document.getElementById('ae-email')?.value.trim() || '',
    birthdate: document.getElementById('ae-bday')?.value || '',
    gender: document.getElementById('ae-gender')?.value || '',
    emergencyContact: document.getElementById('ae-emerg')?.value.trim() || '',
    address: document.getElementById('ae-addr')?.value.trim() || '',
    role,
    position: document.getElementById('ae-pos')?.value || '',
    branchId,
    dateHired: document.getElementById('ae-hired')?.value || '',
    employmentStatus: document.getElementById('ae-empstatus')?.value || '',
    sss: document.getElementById('ae-sss')?.value.trim() || '',
    philhealth: document.getElementById('ae-phil')?.value.trim() || '',
    pagibig: document.getElementById('ae-pagibig')?.value.trim() || '',
    tin: document.getElementById('ae-tin')?.value.trim() || '',
    active: true,
    createdAt: new Date().toISOString(),
  };

  // Save employee record
  const employees = getEmployees();
  employees.push(newEmployee);
  saveEmployees(employees);

  // Create the linked system login account
  const newUser = {
    id: 'usr_' + Date.now(),
    employeeId: empId,
    name,
    username,
    password,
    role,
    position: newEmployee.position,
    branchId,
  };

  // Save user account first so the DB row exists before we stamp employee_id
  s.users.push(newUser);
  recordAudit(s, {
    action: 'create_user',
    message: `Staff account created via Employee Records: ${username}`,
    userId: s.currentUser?.id || null,
    branchId,
    details: { createdRole: role, createdUsername: username, employeeId: empId },
  });
  saveState(s);
  DB.saveUser(newUser);
  // Pass linkedUserId so the /api/employees handler can stamp employee_id on the correct user row
  DB.saveEmployee({ ...newEmployee, linkedUserId: newUser.id });
  showToast(`Employee "${name}" added with login account.`, 'success');

  closeModal();
  renderEmployeeRecords();
}

// ── TIME CARDS ────────────────────────────────────────────────────
function renderTimecards() {
  // Legacy timecards kept for backward compatibility – redirect to new attendance page
  renderAttendance();
}

// ── ATTENDANCE MODULE ────────────────────────────────────────────────────────
// Anti-cheat design:
//  • Time-in/out timestamps are set by the system clock at the moment of tap —
//    staff cannot type in a custom time.
//  • Each user can only have ONE open (no time-out) record per calendar day.
//    Attempting to time-in again on the same day is blocked.
//  • A unique session fingerprint (userAgent + screen + timezone) is captured
//    with every tap to help detect shared-device abuse.
//  • All taps are written to the audit log so admins can detect anomalies.
//  • Admins see every employee's record; staff/print only see their own.

function _attFingerprintStr() {
  try {
    return [
      navigator.userAgent || '',
      screen.width + 'x' + screen.height,
      Intl.DateTimeFormat().resolvedOptions().timeZone || '',
    ].join('|');
  } catch (e) { return 'unknown'; }
}

function _attTodayKey() {
  // Returns 'YYYY-MM-DD' in local time
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function _attDurationStr(timeIn, timeOut) {
  if (!timeIn || !timeOut) return '—';
  const diffMs = new Date(timeOut) - new Date(timeIn);
  if (diffMs < 0) return '—';
  const h = Math.floor(diffMs / 3600000);
  const m = Math.floor((diffMs % 3600000) / 60000);
  return h + 'h ' + m + 'm';
}

function _attFormatTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function _attFormatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
}

function renderAttendance() {
  const s = getState();
  const u = s.currentUser;
  if (!u) return;
  const role = normalizeRole(u.role);
  const isAdmin = role === 'admin' || role === 'hr';
  const isTeamLeader = role === 'branch_manager';

  if (!s.attendanceRecords) s.attendanceRecords = [];

  const today = _attTodayKey();
  const myRecord = s.attendanceRecords.find(r => r.userId === u.id && r.date === today);
  const hasTimedIn = !!myRecord;
  const hasTimedOut = !!(myRecord && myRecord.timeOut);

  // Which records to show
  const filterUserId = document.getElementById('att-filter-user')?.value || '';
  const filterMonth = document.getElementById('att-filter-month')?.value || '';

  let records;
  if (isAdmin) {
    records = [...s.attendanceRecords];
  } else if (isTeamLeader) {
    // TL sees all records for their branch
    const branchUserIds = new Set((s.users || []).filter(x => x.branchId === u.branchId).map(x => x.id));
    branchUserIds.add(u.id);
    records = s.attendanceRecords.filter(r => branchUserIds.has(r.userId) || r.branchId === u.branchId);
  } else {
    records = s.attendanceRecords.filter(r => r.userId === u.id);
  }

  if ((isAdmin || isTeamLeader) && filterUserId) records = records.filter(r => r.userId === filterUserId);
  if (filterMonth) records = records.filter(r => r.date && r.date.startsWith(filterMonth));
  records = [...records].sort((a, b) => b.date.localeCompare(a.date));

  const allStaff = isAdmin
    ? (s.users || []).filter(x => x.active !== false && x.role !== 'admin')
    : isTeamLeader
      ? (s.users || []).filter(x => x.active !== false && x.branchId === u.branchId && x.role !== 'admin')
      : [];

  // Stats for admin and team leader
  let statsHtml = '';
  if (isAdmin || isTeamLeader) {
    const presentToday = records.filter(r => r.date === today).length;
    const totalStaff = allStaff.length;
    const completedToday = records.filter(r => r.date === today && r.timeOut).length;
    const currentlyIn = presentToday - completedToday;
    statsHtml = `
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:20px;">
        <div style="background:var(--cream);border-radius:var(--radius);padding:14px 16px;text-align:center;">
          <div style="font-size:22px;font-weight:700;color:var(--maroon)">${totalStaff}</div>
          <div style="font-size:11px;color:var(--ink-60);margin-top:2px">Total Staff</div>
        </div>
        <div style="background:#d1fae5;border-radius:var(--radius);padding:14px 16px;text-align:center;">
          <div style="font-size:22px;font-weight:700;color:#065f46">${presentToday}</div>
          <div style="font-size:11px;color:#065f46;margin-top:2px">Present Today</div>
        </div>
        <div style="background:#fef3c7;border-radius:var(--radius);padding:14px 16px;text-align:center;">
          <div style="font-size:22px;font-weight:700;color:#92400e">${currentlyIn}</div>
          <div style="font-size:11px;color:#92400e;margin-top:2px">Currently Clocked In</div>
        </div>
        <div style="background:#ede9fe;border-radius:var(--radius);padding:14px 16px;text-align:center;">
          <div style="font-size:22px;font-weight:700;color:#5b21b6">${completedToday}</div>
          <div style="font-size:11px;color:#5b21b6;margin-top:2px">Completed Today</div>
        </div>
      </div>`;
  }

  // Tap panel for non-admin users
  let tapPanelHtml = '';
  if (!isAdmin) {
    const branch = (s.branches || []).find(b => b.id === u.branchId);
    const nowStr = new Date().toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
    const dateStr = new Date().toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    let statusBadge = `<span class="badge badge-neutral" style="font-size:13px;padding:6px 14px;">Not Yet Timed In</span>`;
    let timeInDisplay = '—';
    let timeOutDisplay = '—';
    let durationDisplay = '—';

    if (hasTimedIn) {
      timeInDisplay = _attFormatTime(myRecord.timeIn);
      if (hasTimedOut) {
        timeOutDisplay = _attFormatTime(myRecord.timeOut);
        durationDisplay = _attDurationStr(myRecord.timeIn, myRecord.timeOut);
        statusBadge = `<span class="badge badge-neutral" style="font-size:13px;padding:6px 14px;background:#ede9fe;color:#5b21b6;">✓ Shift Complete</span>`;
      } else {
        statusBadge = `<span class="badge badge-success" style="font-size:13px;padding:6px 14px;">● Currently Clocked In</span>`;
      }
    }

    let actionBtn = '';
    const isPending = hasTimedIn && myRecord._pending;
    const isClockingOut = hasTimedIn && !hasTimedOut && myRecord._clockingOut;

    if (!hasTimedIn) {
      actionBtn = `<button class="btn btn-maroon" style="padding:14px 32px;font-size:15px;font-weight:700;letter-spacing:0.02em;" onclick="attTimeIn()">
        ⏱ TAP TO TIME IN
      </button>`;
    } else if (isPending) {
      // Optimistic placeholder — API call still in flight
      actionBtn = `<button class="btn btn-maroon" disabled style="padding:14px 32px;font-size:15px;font-weight:700;letter-spacing:0.02em;opacity:0.6;cursor:not-allowed;">
        ⏳ Saving clock-in…
      </button>`;
    } else if (isClockingOut) {
      actionBtn = `<button class="btn" disabled style="padding:14px 32px;font-size:15px;font-weight:700;letter-spacing:0.02em;background:var(--warning);color:#fff;opacity:0.6;cursor:not-allowed;">
        ⏳ Saving clock-out…
      </button>`;
    } else if (!hasTimedOut) {
      actionBtn = `<button class="btn" style="padding:14px 32px;font-size:15px;font-weight:700;letter-spacing:0.02em;background:var(--warning);color:#fff;" onclick="attTimeOut()">
        ⏹ TAP TO TIME OUT
      </button>`;
    } else {
      actionBtn = `<div style="color:var(--ink-60);font-size:13px;text-align:center;padding:12px 0;">Attendance for today is complete. See you tomorrow!</div>`;
    }

    tapPanelHtml = `
      <div class="data-card" style="margin-bottom:20px;">
        <div class="data-card-header"><span class="data-card-title">📍 Today's Attendance</span></div>
        <div class="data-card-body">
          <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:16px;">
            <div>
              <div style="font-size:15px;font-weight:600;color:var(--ink)">${u.name}</div>
              <div style="font-size:12px;color:var(--ink-60)">${branch?.name || 'Unassigned'} · ${dateStr}</div>
            </div>
            ${statusBadge}
          </div>
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:18px;">
            <div style="background:var(--cream);border-radius:var(--radius-sm);padding:12px;text-align:center;">
              <div style="font-size:11px;color:var(--ink-50);text-transform:uppercase;letter-spacing:0.07em;margin-bottom:4px">Time In</div>
              <div style="font-size:17px;font-weight:700;color:var(--ink)">${timeInDisplay}</div>
            </div>
            <div style="background:var(--cream);border-radius:var(--radius-sm);padding:12px;text-align:center;">
              <div style="font-size:11px;color:var(--ink-50);text-transform:uppercase;letter-spacing:0.07em;margin-bottom:4px">Time Out</div>
              <div style="font-size:17px;font-weight:700;color:var(--ink)">${timeOutDisplay}</div>
            </div>
            <div style="background:var(--cream);border-radius:var(--radius-sm);padding:12px;text-align:center;">
              <div style="font-size:11px;color:var(--ink-50);text-transform:uppercase;letter-spacing:0.07em;margin-bottom:4px">Duration</div>
              <div style="font-size:17px;font-weight:700;color:var(--ink)">${durationDisplay}</div>
            </div>
          </div>
          <div style="display:flex;justify-content:center;">${actionBtn}</div>
          <div style="font-size:11px;color:var(--ink-40);text-align:center;margin-top:12px;">
            ⚠ Timestamps are recorded automatically by the system and cannot be manually edited.
          </div>
        </div>
      </div>`;
  }

  let teamLeaderStaffHtml = '';
  if (isTeamLeader) {
    const branchStaff = allStaff
      .filter(emp => emp.id !== u.id)
      .sort((a, b) => (a.name || a.username || '').localeCompare(b.name || b.username || ''));

    teamLeaderStaffHtml = `
      <div class="data-card" style="margin-bottom:20px;">
        <div class="data-card-header"><span class="data-card-title">Today's Branch Staff</span></div>
        <div class="data-card-body no-pad">
          <table class="data-table">
            <thead><tr>
              <th>Name</th>
              <th>Date</th>
              <th>Time In</th>
              <th>Time Out</th>
              <th>Duration</th>
              <th>Status</th>
              <th>Action</th>
            </tr></thead>
            <tbody>
              ${branchStaff.length ? branchStaff.map(emp => {
      const todayRecord = (s.attendanceRecords || []).find(r => r.userId === emp.id && r.date === today);
      const open = !!(todayRecord && todayRecord.timeIn && !todayRecord.timeOut);
      const complete = !!(todayRecord && todayRecord.timeIn && todayRecord.timeOut);
      const statusBadge = complete
        ? `<span class="badge badge-success">Complete</span>`
        : open
          ? `<span class="badge badge-warning">In Progress</span>`
          : `<span class="badge badge-neutral">Not Yet Timed In</span>`;
      const actionHtml = open
        ? `<button class="btn btn-sm btn-danger" onclick="attManagerTimeOut('${emp.id}')" title="Clock out employee">Time Out</button>`
        : `<button class="btn btn-sm btn-maroon" onclick="attManagerTimeIn('${emp.id}')" title="Clock in employee">Time In</button>`;
      const editHtml = todayRecord && todayRecord.timeIn && !todayRecord._pending
        ? ` <button class="btn btn-sm btn-outline" onclick="attEditTimeModal('${todayRecord.id}','branch_manager')" title="Edit employee attendance time">✏ Edit</button>`
        : '';

      return `<tr>
                  <td><strong>${emp.name || '—'}</strong><br><span style="font-size:11px;color:var(--ink-50)">${emp.username || ''}</span></td>
                  <td class="td-mono">${_attFormatDate(today + 'T00:00:00')}</td>
                  <td class="td-mono">${_attFormatTime(todayRecord?.timeIn)}</td>
                  <td class="td-mono">${_attFormatTime(todayRecord?.timeOut)}</td>
                  <td>${_attDurationStr(todayRecord?.timeIn, todayRecord?.timeOut)}</td>
                  <td>${statusBadge}</td>
                  <td><div style="display:flex;gap:4px;flex-wrap:wrap;">${actionHtml}${editHtml}</div></td>
                </tr>`;
    }).join('') : `<tr><td colspan="7" style="text-align:center;padding:32px;color:var(--ink-40)">No staff found in this branch.</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>`;
  }

  // Filters
  const filterHtml = `
    <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;margin-bottom:14px;">
      ${(isAdmin || isTeamLeader) ? `<div class="form-group" style="margin-bottom:0;min-width:180px;">
        <label style="font-size:11px;">Filter by Staff</label>
        <div class="form-select-wrap"><select class="form-control" id="att-filter-user" onchange="renderAttendance()" style="font-size:13px;padding:7px 10px;">
          <option value="">All Staff</option>
          ${allStaff.map(st => `<option value="${st.id}"${filterUserId === st.id ? ' selected' : ''}>${st.name || st.username}</option>`).join('')}
        </select></div>
      </div>` : ''}
      <div class="form-group" style="margin-bottom:0;min-width:150px;">
        <label style="font-size:11px;">Filter by Month</label>
        <input type="month" class="form-control" id="att-filter-month" value="${filterMonth}" onchange="renderAttendance()" style="font-size:13px;padding:7px 10px;">
      </div>
      ${isAdmin ? `<button class="btn btn-outline" style="font-size:12px;" onclick="attAdminExport()">⬇ Export CSV</button>` : ''}
    </div>`;

  // Records table
  const tableHtml = `
    <div class="data-card">
      <div class="data-card-header"><span class="data-card-title">${isAdmin ? 'All Attendance Records' : isTeamLeader ? 'Branch Attendance Records' : 'My Attendance History'}</span></div>
      <div class="data-card-body no-pad">
        ${filterHtml}
        <table class="data-table">
          <thead><tr>
            ${(isAdmin || isTeamLeader) ? '<th>Name</th>' : ''}
            ${isAdmin ? '<th>Branch</th>' : ''}
            <th>Date</th>
            <th>Time In</th>
            <th>Time Out</th>
            <th>Duration</th>
            <th>Status</th>
            ${isAdmin ? '<th>Device</th>' : ''}
            ${(isAdmin || isTeamLeader) ? '<th>Action</th>' : ''}
          </tr></thead>
          <tbody>
            ${records.length ? records.map(r => {
    const emp = (s.users || []).find(x => x.id === r.userId);
    const br = (s.branches || []).find(b => b.id === (emp?.branchId));
    const dur = _attDurationStr(r.timeIn, r.timeOut);
    const complete = !!(r.timeIn && r.timeOut);
    const open = !!(r.timeIn && !r.timeOut);
    const statusBadge = complete
      ? `<span class="badge badge-success">Complete</span>`
      : open
        ? `<span class="badge badge-warning">In Progress</span>`
        : `<span class="badge badge-neutral">Absent</span>`;
    const deviceInfo = r.device ? `<span title="${r.device}" style="font-size:11px;color:var(--ink-50);cursor:help;">📱 ${r.device.split('|')[0].slice(0, 30)}…</span>` : '—';
    return `<tr>
                ${(isAdmin || isTeamLeader) ? `<td><strong>${emp?.name || '—'}</strong><br><span style="font-size:11px;color:var(--ink-50)">${emp?.username || ''}</span></td>` : ''}
                ${isAdmin ? `<td style="font-size:12px;">${br?.name || '—'}</td>` : ''}
                <td class="td-mono">${_attFormatDate(r.date + 'T00:00:00')}</td>
                <td class="td-mono">${_attFormatTime(r.timeIn)}</td>
                <td class="td-mono">${_attFormatTime(r.timeOut)}</td>
                <td>${dur}</td>
                <td>${statusBadge}</td>
                ${isAdmin ? `<td style="max-width:140px;overflow:hidden;">${deviceInfo}</td>` : ''}
                ${(isAdmin || isTeamLeader) ? `<td>
                  ${isAdmin
          ? `<div style="display:flex;gap:4px;flex-wrap:wrap;">${open && !r._pending ? `<button class="btn btn-sm btn-danger" onclick="attAdminForceOut('${r.id}')" title="Force clock-out">Force Out</button>` : ''}${!r._pending && r.timeIn ? `<button class="btn btn-sm btn-outline" onclick="attEditTimeModal('${r.id}','admin')" title="Edit time-in / time-out">✏ Edit</button>` : (r._pending ? `<span style="font-size:11px;color:var(--ink-40);">Saving…</span>` : '—')}</div>`
          : (emp && emp.id !== u.id
            ? `<div style="display:flex;gap:4px;flex-wrap:wrap;">${open
              ? `<button class="btn btn-sm btn-danger" onclick="attManagerTimeOut('${emp.id}')" title="Clock out employee">Time Out</button>`
              : `<button class="btn btn-sm btn-maroon" onclick="attManagerTimeIn('${emp.id}')" title="Clock in employee">Time In</button>`}${!r._pending && r.timeIn ? `<button class="btn btn-sm btn-outline" onclick="attEditTimeModal('${r.id}','branch_manager')" title="Edit employee attendance time">✏ Edit</button>` : ''}</div>`
            : '<span style="font-size:11px;color:var(--ink-40)" title="Use the tap panel above to record your own attendance.">🔒 Self-service</span>')}
                </td>` : ''}
              </tr>`;
  }).join('') : `<tr><td colspan="${isAdmin ? 9 : isTeamLeader ? 7 : 5}" style="text-align:center;padding:32px;color:var(--ink-40)">No attendance records found.</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>`;

  document.getElementById('page-content').innerHTML = `
    <div class="page-header">
      <h1 class="page-title">${isAdmin ? 'Attendance Management' : isTeamLeader ? 'Branch Attendance' : 'My Attendance'}</h1>
      <p class="page-subtitle">${isAdmin ? 'Monitor and manage staff attendance. All timestamps are system-recorded.' : isTeamLeader ? 'View and manage attendance for all staff in your branch.' : 'Tap to clock in and out. Your time is recorded automatically.'}</p>
    </div>
    ${statsHtml}
    ${tapPanelHtml}
    ${teamLeaderStaffHtml}
    ${tableHtml}`;
}

function attTimeIn() {
  const s = getState();
  const u = s.currentUser;
  if (!u) return;
  const today = _attTodayKey();
  if (!s.attendanceRecords) s.attendanceRecords = [];

  // Anti-cheat: block duplicate time-in on same day (client-side fast-fail)
  const existing = s.attendanceRecords.find(r => r.userId === u.id && r.date === today);
  if (existing) {
    showToast('You have already timed in today.', 'error');
    return;
  }

  // Optimistic placeholder so the UI shows "clocked in" immediately
  const placeholder = {
    id: '_pending_' + u.id,
    userId: u.id,
    username: u.username,
    branchId: u.branchId,
    date: today,
    timeIn: new Date().toISOString(),
    timeOut: null,
    device: _attFingerprintStr(),
    createdAt: new Date().toISOString(),
    _pending: true,
  };
  s.attendanceRecords.push(placeholder);
  saveState(s);
  renderAttendance();

  // Persist to DB — server sets the authoritative timestamp
  DB.saveAttendance('time-in', _attFingerprintStr())
    .then(function (serverRecord) {
      // Replace optimistic placeholder with the real server record
      const st = getState();
      if (!st.attendanceRecords) st.attendanceRecords = [];
      const idx = st.attendanceRecords.findIndex(r => r.id === '_pending_' + u.id);
      const confirmed = {
        id: serverRecord.id,
        userId: u.id,
        username: u.username,
        branchId: u.branchId,
        date: serverRecord.date || today,
        timeIn: serverRecord.timeIn,
        timeOut: null,
        createdAt: serverRecord.timeIn,
      };
      if (idx !== -1) {
        st.attendanceRecords.splice(idx, 1, confirmed);
      } else {
        // Remove any duplicate pending, add confirmed
        st.attendanceRecords = st.attendanceRecords.filter(r => r.id !== '_pending_' + u.id);
        st.attendanceRecords.push(confirmed);
      }
      recordAudit(st, {
        action: 'attendance_time_in',
        message: `${u.name} clocked IN at ${_attFormatTime(confirmed.timeIn)} on ${confirmed.date}`,
        userId: u.id
      });
      saveState(st);
      showToast(`⏱ Clocked in at ${_attFormatTime(confirmed.timeIn)}`, 'success');
      renderAttendance();
    })
    .catch(function (err) {
      // Roll back the optimistic entry — server rejected (e.g. duplicate, offline)
      const st = getState();
      st.attendanceRecords = (st.attendanceRecords || []).filter(r => r.id !== '_pending_' + u.id);
      saveState(st);
      showToast('Clock-in failed: ' + (err.message || 'Server error. Please try again.'), 'error');
      renderAttendance();
    });
}

function attTimeOut() {
  const s = getState();
  const u = s.currentUser;
  if (!u) return;
  const today = _attTodayKey();
  if (!s.attendanceRecords) s.attendanceRecords = [];

  const record = s.attendanceRecords.find(r => r.userId === u.id && r.date === today && !r.timeOut);
  if (!record) {
    showToast('No open time-in record found for today.', 'error');
    return;
  }

  // Anti-cheat: minimum 1 minute between time-in and time-out (client-side fast-fail)
  const diffMs = Date.now() - new Date(record.timeIn).getTime();
  if (diffMs < 60000) {
    showToast('You must wait at least 1 minute before timing out.', 'error');
    return;
  }

  // Disable the button optimistically to prevent double-tap
  record._clockingOut = true;
  saveState(s);
  renderAttendance();

  DB.saveAttendance('time-out', _attFingerprintStr())
    .then(function (serverRecord) {
      const st = getState();
      const rec = (st.attendanceRecords || []).find(r => r.id === serverRecord.id ||
        (r.userId === u.id && r.date === today && !r.timeOut));
      if (rec) {
        rec.timeOut = serverRecord.timeOut;
        rec.id = serverRecord.id; // confirm server ID in case it differed
        delete rec._clockingOut;
        recordAudit(st, {
          action: 'attendance_time_out',
          message: `${u.name} clocked OUT at ${_attFormatTime(rec.timeOut)} on ${today}. Duration: ${_attDurationStr(rec.timeIn, rec.timeOut)}`,
          userId: u.id
        });
        saveState(st);
        showToast(`⏹ Clocked out at ${_attFormatTime(rec.timeOut)}. Total: ${_attDurationStr(rec.timeIn, rec.timeOut)}`, 'success');
      }
      renderAttendance();
    })
    .catch(function (err) {
      // Roll back optimistic state
      const st = getState();
      const rec = (st.attendanceRecords || []).find(r => r.userId === u.id && r.date === today);
      if (rec) { delete rec._clockingOut; }
      saveState(st);
      showToast('Clock-out failed: ' + (err.message || 'Server error. Please try again.'), 'error');
      renderAttendance();
    });
}

function attManagerTimeIn(userId) {
  const s = getState();
  const me = s.currentUser;
  if (!me || normalizeRole(me.role) !== 'branch_manager') { showToast('Only the Branch Manager can clock in staff.', 'error'); return; }
  const emp = (s.users || []).find(x => x.id === userId && x.branchId === me.branchId);
  if (!emp) { showToast('Employee not found in your branch.', 'error'); return; }
  if (emp.id === me.id) { showToast('Use your own attendance tap for your personal time-in.', 'error'); return; }
  DB.saveAttendance('time-in', _attFingerprintStr(), userId)
    .then(function (serverRecord) {
      const st = getState();
      st.attendanceRecords = (st.attendanceRecords || []).filter(r => !(r.userId === userId && r.date === (serverRecord.date || _attTodayKey())));
      st.attendanceRecords.push({
        id: serverRecord.id,
        userId: userId,
        username: emp.username,
        branchId: emp.branchId,
        date: serverRecord.date || _attTodayKey(),
        timeIn: serverRecord.timeIn,
        timeOut: null,
        createdAt: serverRecord.timeIn,
      });
      recordAudit(st, { action: 'attendance_manager_time_in', message: `${me.name} clocked in ${emp.name}`, userId: me.id, meta: { targetUserId: userId } });
      saveState(st);
      showToast(emp.name + ' timed in successfully.', 'success');
      renderAttendance();
    })
    .catch(function (err) {
      showToast('Clock-in failed: ' + (err.message || 'Server error. Please try again.'), 'error');
    });
}

function attManagerTimeOut(userId) {
  const s = getState();
  const me = s.currentUser;
  if (!me || normalizeRole(me.role) !== 'branch_manager') { showToast('Only the Branch Manager can clock out staff.', 'error'); return; }
  const emp = (s.users || []).find(x => x.id === userId && x.branchId === me.branchId);
  if (!emp) { showToast('Employee not found in your branch.', 'error'); return; }
  if (emp.id === me.id) { showToast('Use your own attendance tap for your personal time-out.', 'error'); return; }
  DB.saveAttendance('time-out', _attFingerprintStr(), userId)
    .then(function (serverRecord) {
      const st = getState();
      const rec = (st.attendanceRecords || []).find(r => r.id === serverRecord.id || (r.userId === userId && r.date === _attTodayKey() && !r.timeOut));
      if (rec) rec.timeOut = serverRecord.timeOut;
      recordAudit(st, { action: 'attendance_manager_time_out', message: `${me.name} clocked out ${emp.name}`, userId: me.id, meta: { targetUserId: userId } });
      saveState(st);
      showToast(emp.name + ' timed out successfully.', 'success');
      renderAttendance();
    })
    .catch(function (err) {
      showToast('Clock-out failed: ' + (err.message || 'Server error. Please try again.'), 'error');
    });
}

function attAdminForceOut(recordId) {
  const s = getState();
  const record = (s.attendanceRecords || []).find(r => r.id === recordId);
  if (!record) return;
  if (record.timeOut) { showToast('This record already has a time-out.', 'error'); return; }

  const emp = (s.users || []).find(x => x.id === record.userId);
  showModal(`<div class="modal-header"><h2>Force Clock-Out</h2><button class="btn-close-modal" onclick="closeModal()">✕</button></div>
    <div class="modal-body">
      <p style="color:var(--ink-60);font-size:14px;margin-bottom:16px;">
        Force clock-out <strong>${emp?.name || 'this employee'}</strong> for ${_attFormatDate(record.date + 'T00:00:00')}?<br>
        Time in was <strong>${_attFormatTime(record.timeIn)}</strong>. Current time will be used as time-out.
      </p>
      <div class="form-group">
        <label>Reason / Note <span style="color:var(--danger)">*</span></label>
        <textarea class="form-control" id="force-out-reason" rows="2" placeholder="e.g. Employee forgot to clock out, emergency departure…"></textarea>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
      <button class="btn btn-danger" onclick="attAdminForceOutConfirm('${recordId}')">Confirm Force Out</button>
    </div>`);
}

function attAdminForceOutConfirm(recordId) {
  const reason = document.getElementById('force-out-reason')?.value.trim();
  if (!reason) { showToast('Please enter a reason.', 'error'); return; }
  const s = getState();
  const record = (s.attendanceRecords || []).find(r => r.id === recordId);
  if (!record) return;

  // Guard: don't act on pending/unconfirmed records that haven't reached the server yet
  if (recordId.startsWith('_pending_')) {
    showToast('This record is still being saved. Please wait a moment and try again.', 'error');
    return;
  }

  closeModal();

  DB.updateAttendance(recordId, { forceOut: true, forceOutReason: reason })
    .then(function (serverRecord) {
      const st = getState();
      const rec = (st.attendanceRecords || []).find(r => r.id === recordId);
      if (rec) {
        rec.timeOut = serverRecord.timeOut;
        rec.forceOut = true;
        rec.forceOutReason = reason;
        rec.forceOutBy = st.currentUser?.id;
        rec.forceOutAt = serverRecord.timeOut;
        recordAudit(st, {
          action: 'attendance_force_out',
          message: `Admin force clock-out for user ${rec.userId} on ${rec.date}. Reason: ${reason}`,
          userId: st.currentUser?.id
        });
        saveState(st);
      }
      showToast('Employee has been clocked out.', 'success');
      renderAttendance();
    })
    .catch(function (err) {
      showToast('Force clock-out failed: ' + (err.message || 'Server error. Please try again.'), 'error');
      renderAttendance();
    });
}


// ── attEditTimeModal ──────────────────────────────────────────────────────────
// Opens a modal to edit time-in / time-out for an attendance record.
// mode = 'admin'          → Super Admin editing any record (including branch managers)
// mode = 'branch_manager' → Branch Manager editing employee records in their branch
function attEditTimeModal(recordId, mode) {
  const s = getState();
  const me = s.currentUser;
  const record = (s.attendanceRecords || []).find(r => r.id === recordId);
  if (!record) { showToast('Record not found.', 'error'); return; }

  const emp = (s.users || []).find(x => x.id === record.userId);
  const empName = emp?.name || 'Employee';

  // Guard: branch manager cannot edit their own record
  if (mode === 'branch_manager' && record.userId === me?.id) {
    showToast('You cannot edit your own attendance record. Please contact the Super Admin.', 'error');
    return;
  }

  // Parse existing times to HH:MM for the time inputs
  function toHHMM(dtStr) {
    if (!dtStr) return '';
    const d = new Date(dtStr);
    if (isNaN(d)) return '';
    return d.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', hour12: false });
  }

  const currentTimeIn = toHHMM(record.timeIn);
  const currentTimeOut = toHHMM(record.timeOut);
  const dateLabel = _attFormatDate(record.date + 'T00:00:00');

  showModal(`<div class="modal-header">
    <h2>✏ Edit Attendance Time</h2>
    <button class="btn-close-modal" onclick="closeModal()">✕</button>
  </div>
  <div class="modal-body">
    <div class="alert alert-info" style="margin-bottom:16px;">
      <strong>${empName}</strong> · ${dateLabel}
    </div>
    <div class="form-row-2">
      <div class="form-group">
        <label>Time In <span style="color:var(--danger)">*</span></label>
        <input type="time" id="att-edit-timein" class="form-control" value="${currentTimeIn}">
      </div>
      <div class="form-group">
        <label>Time Out <span style="color:var(--ink-50);font-size:11px;">(leave blank if still clocked in)</span></label>
        <input type="time" id="att-edit-timeout" class="form-control" value="${currentTimeOut}">
      </div>
    </div>
    <div class="form-group">
      <label>Reason for Edit <span style="color:var(--danger)">*</span></label>
      <textarea id="att-edit-reason" class="form-control" rows="2" placeholder="e.g. Employee forgot to clock in, wrong time recorded…"></textarea>
    </div>
    <div style="font-size:11px;color:var(--ink-50);margin-top:4px;">
      ⚠ This edit will be logged for audit purposes.
    </div>
  </div>
  <div class="modal-footer">
    <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
    <button class="btn btn-maroon" onclick="attEditTimeConfirm('${recordId}')">Save Changes</button>
  </div>`);
}

function attEditTimeConfirm(recordId) {
  const timeIn = document.getElementById('att-edit-timein')?.value.trim();
  const timeOut = document.getElementById('att-edit-timeout')?.value.trim();
  const reason = document.getElementById('att-edit-reason')?.value.trim();

  if (!timeIn) { showToast('Time In is required.', 'error'); return; }
  if (!reason) { showToast('Please enter a reason for the edit.', 'error'); return; }
  if (timeOut && timeOut <= timeIn) { showToast('Time Out must be after Time In.', 'error'); return; }

  closeModal();

  DB.editAttendanceTime(recordId, timeIn, timeOut || null, reason)
    .then(function (serverRecord) {
      const st = getState();
      const rec = (st.attendanceRecords || []).find(r => r.id === recordId);
      if (rec) {
        rec.timeIn = serverRecord.timeIn || rec.timeIn;
        rec.timeOut = serverRecord.timeOut !== undefined ? serverRecord.timeOut : rec.timeOut;
        recordAudit(st, {
          action: 'attendance_time_edited',
          message: `Attendance time edited for ${rec.userId} on ${rec.date}. Reason: ${reason}`,
          userId: st.currentUser?.id,
          meta: { recordId, newTimeIn: serverRecord.timeIn, newTimeOut: serverRecord.timeOut, reason }
        });
        saveState(st);
      }
      showToast('Attendance time updated successfully.', 'success');
      renderAttendance();
    })
    .catch(function (err) {
      showToast('Edit failed: ' + (err.message || 'Server error. Please try again.'), 'error');
      renderAttendance();
    });
}

function attAdminExport() {
  const s = getState();
  const filterUserId = document.getElementById('att-filter-user')?.value || '';
  const filterMonth = document.getElementById('att-filter-month')?.value || '';
  let records = s.attendanceRecords || [];
  if (filterUserId) records = records.filter(r => r.userId === filterUserId);
  if (filterMonth) records = records.filter(r => r.date && r.date.startsWith(filterMonth));
  records = [...records].sort((a, b) => b.date.localeCompare(a.date));

  const header = ['Name', 'Username', 'Branch', 'Date', 'Time In', 'Time Out', 'Duration (hrs)', 'Status', 'Force Out', 'Force Out Reason'];
  const rows = records.map(r => {
    const emp = (s.users || []).find(x => x.id === r.userId);
    const br = (s.branches || []).find(b => b.id === emp?.branchId);
    const diffMs = r.timeIn && r.timeOut ? new Date(r.timeOut) - new Date(r.timeIn) : 0;
    const hrs = diffMs > 0 ? (diffMs / 3600000).toFixed(2) : '';
    const status = r.timeIn && r.timeOut ? 'Complete' : r.timeIn ? 'In Progress' : 'Absent';
    return [
      emp?.name || '', emp?.username || '', br?.name || '', r.date || '',
      _attFormatTime(r.timeIn), _attFormatTime(r.timeOut), hrs, status,
      r.forceOut ? 'Yes' : 'No', r.forceOutReason || ''
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');
  });

  const csv = [header.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `attendance_${filterMonth || 'all'}_export.csv`;
  a.click();
  showToast('Attendance exported as CSV.', 'success');
}

function showUploadTimecardModal() {
  // Legacy stub — now replaced by tap-in/out system
  showToast('The old time card upload system has been replaced with the new Attendance tap system.', 'info');
}

function submitTimecard() { /* legacy stub */ }

function approveTimecard(id) {
  const s = getState();
  const tc = (s.timecards || []).find(x => x.id === id);
  if (tc) {
    tc.status = 'approved';
    tc.reviewedAt = new Date().toISOString();
    tc.reviewedBy = s.currentUser?.id || null;
    saveState(s);
    showToast('Time card approved.', 'success');
    renderAttendance();
  }
}

function rejectTimecard(id) {
  const s = getState();
  const tc = (s.timecards || []).find(x => x.id === id);
  if (tc) {
    tc.status = 'rejected';
    tc.reviewedAt = new Date().toISOString();
    tc.reviewedBy = s.currentUser?.id || null;
    saveState(s);
    showToast('Time card rejected.', 'error');
    renderAttendance();
  }
}

// ── LEAVE MANAGEMENT ──────────────────────────────────────────────
function renderLeaveManagement() {
  const s = getState();
  const u = s.currentUser;
  if (!u) return;
  const role = normalizeRole(u.role);
  const isAdmin = role === 'admin' || role === 'hr';
  const isBranchManager = role === 'branch_manager';

  // ── ADMIN VIEW: Approval Center ────────────────────────────────────────────
  if (isAdmin || isBranchManager) {
    const leaves = isBranchManager
      ? (s.leaves || []).filter(l => {
        const emp = (s.users || []).find(x => x.id === l.userId);
        return (emp?.branchId || l.branchId) === u.branchId;
      })
      : (s.leaves || []);
    const activeFilter = window._leaveFilter || 'pending';

    const pending = leaves.filter(l => l.status === 'pending');
    const approved = leaves.filter(l => l.status === 'approved');
    const rejected = leaves.filter(l => l.status === 'rejected');

    const filtered = activeFilter === 'all' ? leaves
      : leaves.filter(l => l.status === activeFilter);

    // Sort: newest first
    const sorted = [...filtered].sort((a, b) => new Date(b.submittedAt || 0) - new Date(a.submittedAt || 0));

    const filterBtns = [
      { id: 'pending', label: `Pending`, count: pending.length, cls: 'badge-gold' },
      { id: 'approved', label: `Approved`, count: approved.length, cls: 'badge-success' },
      { id: 'rejected', label: `Rejected`, count: rejected.length, cls: 'badge-danger' },
      { id: 'all', label: `All`, count: leaves.length, cls: 'badge-neutral' },
    ].map(f => `
      <button class="btn btn-sm ${activeFilter === f.id ? 'btn-maroon' : 'btn-outline'}"
        onclick="window._leaveFilter='${f.id}';renderLeaveManagement()">
        ${f.label} <span class="badge ${f.cls}" style="margin-left:4px;font-size:10px">${f.count}</span>
      </button>`).join('');

    const rows = sorted.length ? sorted.map(l => {
      const emp = (s.users || []).find(x => x.id === l.userId);
      const br = (s.branches || []).find(b => b.id === (emp?.branchId));
      const roleLabel = getRoleLabel(emp?.role);
      const statusCls = { pending: 'badge-gold', approved: 'badge-success', rejected: 'badge-danger' }[l.status || 'pending'] || 'badge-neutral';
      const reviewedBy = l.reviewedBy ? (s.users || []).find(x => x.id === l.reviewedBy)?.name || '—' : '—';
      const reviewedAt = l.reviewedAt ? new Date(l.reviewedAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

      return `<tr>
        <td>
          <div style="font-weight:600">${emp?.name || '—'}</div>
          <div style="font-size:11px;color:var(--ink-50)">${emp?.username || ''}</div>
        </td>
        <td>
          <div>${br?.name || '<span style="color:var(--ink-40)">—</span>'}</div>
          <div style="font-size:11px;color:var(--ink-50)">${roleLabel}</div>
        </td>
        <td>${l.type || '—'}</td>
        <td class="td-mono">${l.date || '—'}</td>
        <td style="max-width:200px;font-size:12px;color:var(--ink-60)">${l.notes || '<span style="color:var(--ink-30)">No reason given</span>'}</td>
        <td><span class="badge ${statusCls}" style="text-transform:capitalize">${l.status || 'pending'}</span></td>
        <td style="font-size:12px;color:var(--ink-50)">${l.status !== 'pending' ? `<div>${reviewedBy}</div><div>${reviewedAt}</div>` : '—'}</td>
        <td>
          ${l.status === 'pending' ? `
            <div style="display:flex;gap:6px">
              <button class="btn btn-sm btn-maroon" onclick="approveLeave('${l.id}')">✓ Approve</button>
              <button class="btn btn-sm btn-danger" onclick="rejectLeaveWithReason('${l.id}')">✕ Reject</button>
            </div>` : `
            <button class="btn btn-sm btn-outline" onclick="revertLeave('${l.id}')">Revert to Pending</button>`}
        </td>
      </tr>`;
    }).join('') : `<tr><td colspan="8" style="text-align:center;padding:40px;color:var(--ink-40)">
        ${activeFilter === 'pending' ? 'No pending leave applications.' : 'No leave records found.'}
      </td></tr>`;

    document.getElementById('page-content').innerHTML = `
      <div class="page-header">
        <h1 class="page-title">Leave Management</h1>
        <p class="page-subtitle">${isBranchManager ? 'Review and approve leave applications for your branch' : 'Review and approve leave applications from all branches'}</p>
      </div>

      <div class="kpi-grid" style="grid-template-columns:repeat(3,1fr);margin-bottom:20px">
        <div class="kpi-card" style="cursor:pointer;border:${activeFilter === 'pending' ? '2px solid var(--maroon)' : '2px solid transparent'}" onclick="window._leaveFilter='pending';renderLeaveManagement()">
          <div class="kpi-header"><div class="kpi-label">Pending Approval</div><div class="kpi-icon gold">${iconSvg('clock')}</div></div>
          <div class="kpi-value" style="color:${pending.length > 0 ? 'var(--warning)' : 'inherit'}">${pending.length}</div>
          <div style="font-size:12px;color:var(--ink-60);margin-top:4px">Awaiting your decision</div>
        </div>
        <div class="kpi-card" style="cursor:pointer;border:${activeFilter === 'approved' ? '2px solid var(--maroon)' : '2px solid transparent'}" onclick="window._leaveFilter='approved';renderLeaveManagement()">
          <div class="kpi-header"><div class="kpi-label">Approved</div><div class="kpi-icon green">${iconSvg('check')}</div></div>
          <div class="kpi-value" style="color:var(--success)">${approved.length}</div>
          <div style="font-size:12px;color:var(--ink-60);margin-top:4px">Total approved this period</div>
        </div>
        <div class="kpi-card" style="cursor:pointer;border:${activeFilter === 'rejected' ? '2px solid var(--maroon)' : '2px solid transparent'}" onclick="window._leaveFilter='rejected';renderLeaveManagement()">
          <div class="kpi-header"><div class="kpi-label">Rejected</div><div class="kpi-icon maroon">${iconSvg('error')}</div></div>
          <div class="kpi-value" style="color:var(--danger)">${rejected.length}</div>
          <div style="font-size:12px;color:var(--ink-60);margin-top:4px">Total rejected this period</div>
        </div>
      </div>

      ${pending.length > 0 ? `<div class="alert alert-warning" style="margin-bottom:16px">${iconSvg('warning')} <strong>${pending.length}</strong> leave application${pending.length > 1 ? 's' : ''} waiting for your review.</div>` : ''}

      <div class="data-card">
        <div class="data-card-header">
          <span class="data-card-title">Leave Applications</span>
          <div style="display:flex;gap:6px;flex-wrap:wrap">${filterBtns}</div>
        </div>
        <div class="data-card-body no-pad">
          <table class="data-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Branch / Dept</th>
                <th>Leave Type</th>
                <th>Date</th>
                <th>Reason</th>
                <th>Status</th>
                <th>Reviewed By</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>`;
    return;
  }

  // ── STAFF / PRINT VIEW: My Leave Applications ──────────────────────────────
  const leaves = s.leaves || [];
  const myLeaves = leaves.filter(l => l.userId === u.id);
  const activeFilter = window._leaveFilter || 'all';
  const filtered = activeFilter === 'all' ? myLeaves : myLeaves.filter(l => l.status === activeFilter);
  const sorted = [...filtered].sort((a, b) => new Date(b.submittedAt || 0) - new Date(a.submittedAt || 0));

  const pending = myLeaves.filter(l => l.status === 'pending').length;
  const approved = myLeaves.filter(l => l.status === 'approved').length;
  const rejected = myLeaves.filter(l => l.status === 'rejected').length;

  const filterBtns = ['all', 'pending', 'approved', 'rejected'].map(f =>
    `<button class="btn btn-sm ${activeFilter === f ? 'btn-maroon' : 'btn-outline'}" onclick="window._leaveFilter='${f}';renderLeaveManagement()">${f.charAt(0).toUpperCase() + f.slice(1)}</button>`
  ).join('');

  const branch = (s.branches || []).find(b => b.id === u.branchId);
  const roleLabel = getRoleLabel(u.role);

  const rows = sorted.length ? sorted.map(l => {
    const statusCls = { pending: 'badge-gold', approved: 'badge-success', rejected: 'badge-danger' }[l.status || 'pending'] || 'badge-neutral';
    const reviewedBy = l.reviewedBy ? (s.users || []).find(x => x.id === l.reviewedBy)?.name || 'Admin' : null;
    return `<tr>
      <td class="td-mono">${l.date || '—'}</td>
      <td>${l.type || '—'}</td>
      <td style="font-size:12px;color:var(--ink-60);max-width:200px">${l.notes || '<span style="color:var(--ink-30)">—</span>'}</td>
      <td><span class="badge ${statusCls}" style="text-transform:capitalize">${l.status || 'pending'}</span></td>
      <td style="font-size:12px;color:var(--ink-50)">${reviewedBy ? `<div>${reviewedBy}</div><div>${l.reviewedAt ? new Date(l.reviewedAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' }) : ''}</div>` : '—'}</td>
      <td>${l.status === 'pending' ? `<button class="btn btn-sm btn-danger" onclick="cancelLeave('${l.id}')">Cancel</button>` : '—'}</td>
    </tr>`;
  }).join('') : `<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--ink-40)">No leave applications yet.</td></tr>`;

  document.getElementById('page-content').innerHTML = `
    <div class="page-header" style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:12px">
      <div>
        <h1 class="page-title">Leave Application</h1>
        <p class="page-subtitle">${u.name} · ${branch?.name || roleLabel}</p>
      </div>
      <button class="btn btn-maroon" onclick="showApplyLeaveModal()">+ Apply for Leave</button>
    </div>

    <div class="kpi-grid" style="grid-template-columns:repeat(3,1fr);margin-bottom:20px">
      <div class="kpi-card">
        <div class="kpi-header"><div class="kpi-label">Pending</div><div class="kpi-icon gold">${iconSvg('clock')}</div></div>
        <div class="kpi-value" style="color:${pending > 0 ? 'var(--warning)' : 'inherit'}">${pending}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-header"><div class="kpi-label">Approved</div><div class="kpi-icon green">${iconSvg('check')}</div></div>
        <div class="kpi-value" style="color:var(--success)">${approved}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-header"><div class="kpi-label">Rejected</div><div class="kpi-icon maroon">${iconSvg('error')}</div></div>
        <div class="kpi-value" style="color:var(--danger)">${rejected}</div>
      </div>
    </div>

    <div class="data-card">
      <div class="data-card-header">
        <span class="data-card-title">My Applications</span>
        <div style="display:flex;gap:6px">${filterBtns}</div>
      </div>
      <div class="data-card-body no-pad">
        <table class="data-table">
          <thead>
            <tr><th>Date</th><th>Leave Type</th><th>Reason</th><th>Status</th><th>Reviewed By</th><th>Action</th></tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>`;
}

function showApplyLeaveModal() {
  const s = getState();
  const u = s.currentUser;
  // BUGFIX: br was undefined — resolve branch from state
  const br = (s.branches || []).find(b => b.id === u.branchId);
  const roleLabel = getRoleLabel(u.role);
  const positionValue = u.position || u.employmentStatus || roleLabel;
  showModal(`<div class="modal-header"><h2>Apply for Leave</h2><button class="btn-close-modal" onclick="closeModal()">✕</button></div>
    <div class="modal-body">
      <div style="background:var(--cream);border-radius:var(--radius);padding:14px 16px;margin-bottom:16px;display:grid;grid-template-columns:1fr 1fr;gap:6px 16px;font-size:13px;">
        <div><span style="color:var(--ink-50)">Full Name</span><div style="font-weight:600;margin-top:2px">${u.name}</div></div>
        <div><span style="color:var(--ink-50)">Username</span><div style="font-weight:600;margin-top:2px">${u.username}</div></div>
        <div><span style="color:var(--ink-50)">Branch</span><div style="font-weight:600;margin-top:2px">${br?.name || 'All Branches'}</div></div>
        <div><span style="color:var(--ink-50)">Position</span><div style="font-weight:600;margin-top:2px">${positionValue}</div></div>
      </div>
      <input type="hidden" id="lv-pos" value="${positionValue}">
      <div class="form-row-2">
        <div class="form-group">
          <label>Date <span style="color:var(--danger)">*</span></label>
          <input class="form-control" type="date" id="lv-date" value="${new Date().toISOString().split('T')[0]}">
        </div>
        <div class="form-group">
          <label>Leave Type <span style="color:var(--danger)">*</span></label>
          <div class="form-select-wrap"><select class="form-control" id="lv-type">
            <option>Vacation Leave</option>
            <option>Sick Leave</option>
            <option>Emergency Leave</option>
            <option>Maternity / Paternity Leave</option>
            <option>Others</option>
          </select></div>
        </div>
      </div>
      <div class="form-group">
        <label>Reason / Notes</label>
        <textarea class="form-control" id="lv-notes" rows="2" placeholder="Optional — describe your leave reason…"></textarea>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
      <button class="btn btn-maroon" onclick="submitLeave()">Submit Application</button>
    </div>`);
}

function submitLeave() {
  const s = getState();
  const u = s.currentUser;
  const date = document.getElementById('lv-date')?.value;
  const type = document.getElementById('lv-type')?.value;
  const notes = document.getElementById('lv-notes')?.value?.trim() || '';
  if (!date || !type) { showToast('Please fill all required fields.', 'error'); return; }
  if (!s.leaves) s.leaves = [];
  const leave = {
    id: 'lv' + Date.now(),
    userId: u.id,
    username: u.username,
    branchId: u.branchId,
    position: document.getElementById('lv-pos')?.value || '',
    date,
    type,
    notes,
    status: 'pending',
    submittedAt: new Date().toISOString()
  };
  s.leaves.push(leave);
  saveState(s);
  if (typeof DB !== 'undefined') DB.saveLeave(leave);
  closeModal();
  showToast('Leave application submitted.', 'success');
  renderLeaveManagement();
}

function approveLeave(id) {
  const s = getState();
  const l = (s.leaves || []).find(x => x.id === id);
  if (!l) return;
  l.status = 'approved';
  l.reviewedAt = new Date().toISOString();
  l.reviewedBy = s.currentUser?.id || null;
  saveState(s);
  if (typeof DB !== 'undefined') DB.reviewLeave(id, 'approved', l.reviewedBy);
  recordAudit(s, { action: 'leave_approved', message: `Leave approved for user ${l.userId}`, userId: s.currentUser?.id });
  showToast('Leave application approved.', 'success');
  renderLeaveManagement();
}

function rejectLeaveWithReason(id) {
  showModal(`
    <div class="modal-header"><h2>${iconSvg('error')} Reject Leave Application</h2><button class="btn-close-modal" onclick="closeModal()">✕</button></div>
    <div class="modal-body">
      <p style="font-size:13px;color:var(--ink-60);margin-bottom:14px">Please provide a reason for rejecting this leave application. The employee will be able to see this.</p>
      <div class="form-group">
        <label>Reason for Rejection <span style="color:var(--danger)">*</span></label>
        <textarea class="form-control" id="reject-reason" rows="3" placeholder="e.g. Insufficient staff coverage, peak season, etc."></textarea>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
      <button class="btn btn-danger" onclick="confirmRejectLeave('${id}')">Reject Application</button>
    </div>`);
}

function confirmRejectLeave(id) {
  const reason = document.getElementById('reject-reason')?.value?.trim();
  if (!reason) { showToast('Please provide a reason for rejection.', 'error'); return; }
  const s = getState();
  const l = (s.leaves || []).find(x => x.id === id);
  if (!l) return;
  l.status = 'rejected';
  l.rejectReason = reason;
  l.reviewedAt = new Date().toISOString();
  l.reviewedBy = s.currentUser?.id || null;
  saveState(s);
  if (typeof DB !== 'undefined') DB.reviewLeave(id, 'rejected', l.reviewedBy);
  recordAudit(s, { action: 'leave_rejected', message: `Leave rejected for user ${l.userId}. Reason: ${reason}`, userId: s.currentUser?.id });
  closeModal();
  showToast('Leave application rejected.', 'error');
  renderLeaveManagement();
}

function rejectLeave(id) {
  // Legacy alias — now opens reason modal
  rejectLeaveWithReason(id);
}

function revertLeave(id) {
  const s = getState();
  const l = (s.leaves || []).find(x => x.id === id);
  if (!l) return;
  confirmModal({
    title: 'Revert Leave to Pending',
    message: 'Are you sure you want to revert this leave back to <strong>Pending</strong> status?',
    confirmText: 'Revert to Pending',
    cancelText: 'Cancel',
    icon: '🔄',
    danger: false,
    onConfirm: function () {
      l.status = 'pending';
      l.reviewedAt = null;
      l.reviewedBy = null;
      l.rejectReason = null;
      saveState(s);
      if (typeof DB !== 'undefined') DB.reviewLeave(id, 'pending', null);
      showToast('Leave reverted to Pending.', 'success');
      renderLeaveManagement();
    }
  });
}

function cancelLeave(id) {
  const s = getState();
  const l = (s.leaves || []).find(x => x.id === id);
  if (!l || l.status !== 'pending') return;
  confirmModal({
    title: 'Cancel Leave Application',
    message: 'Are you sure you want to cancel this leave application? This action cannot be undone.',
    confirmText: 'Cancel Leave',
    icon: '📋',
    onConfirm: function () {
      s.leaves = s.leaves.filter(x => x.id !== id);
      saveState(s);
      if (typeof DB !== 'undefined') DB.deleteLeave(id);
      showToast('Leave application cancelled.', 'success');
      renderLeaveManagement();
    }
  });
}

// ── PAYSLIP HISTORY ───────────────────────────────────────────────
function renderPayslipHistory() {
  const s = getState();
  const u = s.currentUser;
  const role = normalizeRole(u?.role);
  if (!u || !['admin', 'branch_manager', 'hr', 'cashier', 'inventory_staff', 'print'].includes(role)) { accessDenied('Payslip History'); return; }

  const branches = s.branches || [];
  const isAdminOrHr = role === 'admin' || role === 'hr';
  const isBranchManager = role === 'branch_manager';

  // Determine base payslip pool: admin/HR see all, branch_manager sees their branch, others see own
  let basePayslips;
  if (isAdminOrHr) {
    basePayslips = s.payslips || [];
  } else if (isBranchManager) {
    basePayslips = (s.payslips || []).filter(p => p.branchId === u.branchId);
  } else {
    basePayslips = (s.payslips || []).filter(p => p.userId === u.id);
  }

  function filterPayslipsByDateRange(payslips, startDate, endDate) {
    if (!startDate && !endDate) return payslips;
    const from = startDate ? new Date(startDate + 'T00:00:00') : null;
    const to = endDate ? new Date(endDate + 'T23:59:59') : null;
    return payslips.filter(p => {
      const bounds = parsePayrollPeriodBounds(p.periodKey, p.payPeriod);
      if (!bounds) return true;
      return (!from || bounds.end >= from) && (!to || bounds.start <= to);
    });
  }

  // Get current filter values
  const startDate = document.getElementById('payslip-start-date')?.value || '';
  const endDate = document.getElementById('payslip-end-date')?.value || '';
  const selectedBranchId = document.getElementById('payslip-branch-filter')?.value || '';

  // Apply branch filter
  let branchFilteredPayslips = basePayslips;
  if (selectedBranchId) {
    branchFilteredPayslips = basePayslips.filter(p => p.branchId === selectedBranchId);
  }

  const filteredPayslips = filterPayslipsByDateRange(branchFilteredPayslips, startDate, endDate);
  const totalGross = filteredPayslips.reduce((sum, p) => sum + (p.grossPay || 0), 0);
  const totalDeductions = filteredPayslips.reduce((sum, p) => sum + (p.deductions || 0), 0);
  const totalNet = filteredPayslips.reduce((sum, p) => sum + (p.netPay || 0), 0);

  // Show branch column for admin/hr/branch_manager
  const showBranchCol = isAdminOrHr || isBranchManager;
  const colSpan = showBranchCol ? 8 : 7;

  const rows = filteredPayslips.length
    ? filteredPayslips.map(p => {
      const branchName = showBranchCol ? ((branches.find(b => b.id === p.branchId)?.name) || '—') : '';
      const empName = p.employeeName || '—';
      return `<tr>
          <td><strong>${p.payPeriod}</strong></td>
          <td>${empName}</td>
          ${showBranchCol ? `<td><span class="badge badge-neutral" style="font-size:11px">${branchName}</span></td>` : ''}
          <td class="td-mono">${p.daysPresent || '—'}</td>
          <td class="td-mono">₱${fmt(p.grossPay || 0)}</td>
          <td class="td-mono" style="color:var(--danger)">₱${fmt(p.deductions || 0)}</td>
          <td class="td-mono" style="color:var(--success);font-weight:700">₱${fmt(p.netPay || 0)}</td>
          <td><button class="btn btn-sm btn-maroon" onclick="viewSentPayslipModal('${p.id}')">${iconSvg('printer')} View</button></td>
        </tr>`;
    }).join('')
    : `<tr><td colspan="${colSpan}" style="text-align:center;color:var(--ink-40);padding:40px">No payslip history available for the selected filters.</td></tr>`;

  // Branch dropdown options: for branch_manager, only show their branch; for admin/hr show all
  const branchOptions = isBranchManager
    ? (branches.filter(b => b.id === u.branchId).map(b => `<option value="${b.id}" ${selectedBranchId === b.id ? 'selected' : ''}>${b.name}</option>`).join(''))
    : branches.map(b => `<option value="${b.id}" ${selectedBranchId === b.id ? 'selected' : ''}>${b.name}</option>`).join('');

  const subtitleText = (isAdminOrHr || isBranchManager) ? 'All Employees' : u.name;

  const clearAll = `
    document.getElementById('payslip-start-date').value='';
    document.getElementById('payslip-end-date').value='';
    document.getElementById('payslip-branch-filter').value='';
    renderPayslipHistory()`;

  document.getElementById('page-content').innerHTML = `
    <div class="page-header"><h1 class="page-title">Payslip History</h1><p class="page-subtitle">${subtitleText}</p></div>
    <div class="payroll-summary" style="margin-bottom:18px;display:grid;grid-template-columns:repeat(4,minmax(0,1fr)) !important;grid-auto-rows:minmax(120px,auto);gap:16px;">
      <div class="payroll-item"><label>Payslips in Range</label><strong>${filteredPayslips.length}</strong></div>
      <div class="payroll-item"><label>Total Gross</label><strong>PHP ${fmt(totalGross)}</strong></div>
      <div class="payroll-item"><label>Total Deductions</label><strong style="color:var(--danger)">PHP ${fmt(totalDeductions)}</strong></div>
      <div class="payroll-item"><label>Total Net Pay</label><strong style="color:var(--success)">PHP ${fmt(totalNet)}</strong></div>
    </div>
    <div class="data-card">
      <div class="data-card-header" style="flex-direction:column;gap:12px;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span class="data-card-title">All Pay Periods</span>
          <span class="badge badge-neutral">${filteredPayslips.length} payslip${filteredPayslips.length !== 1 ? 's' : ''}</span>
        </div>
        <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;">
          <label style="font-size:13px;color:var(--ink-70);">Filter by Branch:</label>
          <select id="payslip-branch-filter" class="form-control" style="width:180px;font-size:13px;" onchange="renderPayslipHistory()">
            <option value="">All Branches</option>
            ${branchOptions}
          </select>
          <label style="font-size:13px;color:var(--ink-70);">Date Range:</label>
          <div style="display:flex;gap:8px;align-items:center;">
            <input type="date" id="payslip-start-date" class="form-control" style="width:140px;font-size:13px;" value="${startDate}" onchange="renderPayslipHistory()">
            <span style="font-size:13px;color:var(--ink-50);">to</span>
            <input type="date" id="payslip-end-date" class="form-control" style="width:140px;font-size:13px;" value="${endDate}" onchange="renderPayslipHistory()">
            <button class="btn btn-sm btn-outline" onclick="${clearAll}">Clear All</button>
          </div>
        </div>
      </div>
      <div class="data-card-body no-pad">
        <table class="data-table">
          <thead><tr>
            <th>Period</th>
            <th>Name</th>
            ${showBranchCol ? '<th>Branch</th>' : ''}
            <th>Days Worked</th>
            <th>Gross Pay</th>
            <th>Deductions</th>
            <th>Net Pay</th>
            <th>Action</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>`;
}

// ── POS OVERVIEW ──────────────────────────────────────────────────
function renderPosOverview() {
  const s = getState();
  if (!s.currentUser || s.currentUser.role !== 'admin') { accessDenied('POS Overview'); return; }
  const branches = s.branches || [];
  const today = new Date().toDateString();
  const todaySales = (s.sales || []).filter(x => !x.voided && new Date(x.createdAt).toDateString() === today);

  const branchCards = branches.map(b => {
    const bSales = todaySales.filter(x => x.branchId === b.id);
    const bRevenue = bSales.reduce((a, x) => a + x.total, 0);
    const activeShift = (s.shifts || []).find(sh => sh.branchId === b.id && sh.status === 'open');
    return `
      <div class="data-card" style="flex:1;min-width:280px;cursor:pointer" onclick="navigateTo('pos')">
        <div class="data-card-header">
          <span class="data-card-title">${b.name}</span>
          <span class="badge ${activeShift ? 'badge-success' : 'badge-danger'}">${activeShift ? 'Shift Open' : 'No Active Shift'}</span>
        </div>
        <div class="data-card-body">
          <div class="kpi-grid" style="grid-template-columns:1fr 1fr;gap:12px;">
            <div class="kpi-card"><div class="kpi-header"><div class="kpi-label">Sales Today</div><div class="kpi-icon green">${iconSvg('cart')}</div></div><div class="kpi-value">${bSales.length}</div></div>
            <div class="kpi-card"><div class="kpi-header"><div class="kpi-label">Revenue Today</div><div class="kpi-icon gold">${iconSvg('money')}</div></div><div class="kpi-value">₱${fmt(bRevenue)}</div></div>
          </div>
          <div style="margin-top:12px;font-size:13px;color:var(--ink-60)">${iconSvg('pin')} ${b.address || '—'}</div>
        </div>
      </div>`;
  });

  document.getElementById('page-content').innerHTML = `
    <div class="page-header"><h1 class="page-title">POS Overview</h1><p class="page-subtitle">Live status across all branches</p></div>
    <div style="display:flex;flex-wrap:wrap;gap:16px;">
      ${branchCards.join('')}
    </div>`;
}

// ── BRANCH INVENTORY OVERVIEW ─────────────────────────────────────
function renderBranchInvOverview() {
  const s = getState();
  if (!s.currentUser || s.currentUser.role !== 'admin') { accessDenied('Branch Inventory Overview'); return; }
  const branches = s.branches || [];
  const products = s.products || [];

  const allVariants = products.flatMap(p => (p.variants || []).map(v => {
    const totalStock = Object.values(v.branchStocks || {}).reduce((a, b) => a + b, 0) || v.stock || 0;
    const reorder = v.reorderLevel || 20;
    return { p, v, totalStock, reorder };
  }));

  document.getElementById('page-content').innerHTML = `
    <div class="page-header"><h1 class="page-title">Branch Inventory Overview</h1><p class="page-subtitle">Stock levels across all branches</p></div>

    <div class="data-card">
      <div class="data-card-header" style="gap:10px;flex-wrap:wrap">
        <div style="display:flex;gap:8px;flex:1;flex-wrap:wrap;align-items:center">
          <input id="bio-search" class="form-control" placeholder="Search product or variant…" style="flex:1;min-width:200px;font-size:13px" oninput="bioApplyFilters()">
          <div class="form-select-wrap" style="width:160px">
            <select id="bio-status-filter" class="form-control" style="font-size:13px" onchange="bioApplyFilters()">
              <option value="all">All Statuses</option>
              <option value="ok">In Stock</option>
              <option value="low">Low Stock</option>
              <option value="out">Out of Stock</option>
            </select>
          </div>
          <div class="form-select-wrap" style="width:160px">
            <select id="bio-branch-filter" class="form-control" style="font-size:13px" onchange="bioApplyFilters()">
              <option value="">All Branches</option>
              ${branches.map(b => `<option value="${b.id}">${b.name}</option>`).join('')}
            </select>
          </div>
          <button class="btn btn-sm btn-outline" onclick="bioClearFilters()">Clear</button>
        </div>
      </div>
      <div class="data-card-body no-pad">
        <table class="data-table" id="bio-table">
          <thead><tr>
            <th>Product</th>
            <th>Variant</th>
            ${branches.map(b => `<th style="text-align:center">${b.name}</th>`).join('')}
            <th style="text-align:center">Total</th>
            <th style="text-align:center">Status</th>
          </tr></thead>
          <tbody id="bio-tbody"></tbody>
        </table>
      </div>
    </div>`;

  // Store data for live filtering
  window._bioData = { branches, allVariants };
  bioApplyFilters();
}

function _getBioStatusInfo(totalStock, reorder) {
  if (totalStock <= 0) return { key: 'out', label: 'Out of Stock', badgeClass: 'badge-danger' };
  if (totalStock <= reorder) return { key: 'low', label: 'Low Stock', badgeClass: 'badge-warning' };
  return { key: 'ok', label: 'In Stock', badgeClass: 'badge-success' };
}

function biofFilterStatus(status) {
  const sel = document.getElementById('bio-status-filter');
  if (sel) sel.value = status;
  // Update active stat card
  document.querySelectorAll('.bio-stat').forEach(el => el.classList.remove('bio-stat-active'));
  const map = { all: '.bio-stat-all', ok: '.bio-stat-ok', low: '.bio-stat-low', out: '.bio-stat-out' };
  const card = document.querySelector(map[status]);
  if (card) card.classList.add('bio-stat-active');
  bioApplyFilters();
}

function bioClearFilters() {
  const search = document.getElementById('bio-search');
  const statusSel = document.getElementById('bio-status-filter');
  const branchSel = document.getElementById('bio-branch-filter');
  if (search) search.value = '';
  if (statusSel) statusSel.value = 'all';
  if (branchSel) branchSel.value = '';
  document.querySelectorAll('.bio-stat').forEach(el => el.classList.remove('bio-stat-active'));
  const allCard = document.querySelector('.bio-stat-all');
  if (allCard) allCard.classList.add('bio-stat-active');
  bioApplyFilters();
}

function bioApplyFilters() {
  const data = window._bioData;
  if (!data) return;
  const { branches, allVariants } = data;

  const query = (document.getElementById('bio-search')?.value || '').toLowerCase().trim();
  const statusFilter = document.getElementById('bio-status-filter')?.value || 'all';
  const branchFilter = document.getElementById('bio-branch-filter')?.value || '';

  // Update active stat button to match dropdown
  document.querySelectorAll('.bio-stat').forEach(el => el.classList.remove('bio-stat-active'));
  const map = { all: '.bio-stat-all', ok: '.bio-stat-ok', low: '.bio-stat-low', out: '.bio-stat-out' };
  const activeCard = document.querySelector(map[statusFilter]);
  if (activeCard) activeCard.classList.add('bio-stat-active');

  let filtered = allVariants;

  // Search filter
  if (query) {
    filtered = filtered.filter(({ p, v }) =>
      p.name.toLowerCase().includes(query) ||
      (v.name || '').toLowerCase().includes(query) ||
      (v.sku || '').toLowerCase().includes(query)
    );
  }

  // Status filter — if a branch is selected, evaluate status for that branch only
  if (statusFilter !== 'all') {
    filtered = filtered.filter(({ v, totalStock, reorder }) => {
      const stockVal = branchFilter
        ? ((v.branchStocks || {})[branchFilter] ?? 0)
        : totalStock;
      const info = _getBioStatusInfo(stockVal, reorder);
      return info.key === statusFilter;
    });
  }

  const colSpan = 4 + branches.length;
  const tbody = document.getElementById('bio-tbody');
  if (!tbody) return;

  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="${colSpan}" style="text-align:center;color:var(--ink-40);padding:40px">No matching products found.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(({ p, v, totalStock, reorder }) => {
    const displayStock = branchFilter
      ? ((v.branchStocks || {})[branchFilter] ?? 0)
      : totalStock;
    const info = _getBioStatusInfo(displayStock, reorder);
    return `<tr>
      <td>${p.name}</td>
      <td>${v.name || '—'}${v.sku ? `<div style="font-size:11px;color:var(--ink-40)">${v.sku}</div>` : ''}</td>
      ${branches.map(b => {
      const bStock = (v.branchStocks || {})[b.id] ?? '—';
      const isNum = typeof bStock === 'number';
      const bReorder = v.reorderLevel || 20;
      const color = !isNum ? 'var(--ink-40)' : bStock <= 0 ? 'var(--danger)' : bStock <= bReorder ? 'var(--warning)' : 'var(--success)';
      return `<td style="text-align:center;font-weight:600;color:${color}">${bStock}</td>`;
    }).join('')}
      <td style="text-align:center;font-weight:700">${displayStock}</td>
      <td style="text-align:center"><span class="badge ${info.badgeClass}">${info.label}</span></td>
    </tr>`;
  }).join('');
}

// ── BRANCH REPORTS ────────────────────────────────────────────────
function renderBranchReports() {
  const s = getState();
  if (!s.currentUser || s.currentUser.role !== 'admin') { accessDenied('Branch Reports'); return; }
  const branches = s.branches || [];
  const today = new Date().toDateString();
  const todaySales = (s.sales || []).filter(x => !x.voided && new Date(x.createdAt).toDateString() === today);

  document.getElementById('page-content').innerHTML = `
    <div class="page-header"><h1 class="page-title">Branch Reports</h1><p class="page-subtitle">Daily performance by branch</p></div>
    <div style="display:flex;flex-wrap:wrap;gap:16px;">
      ${branches.map(b => {
    const bSales = todaySales.filter(x => x.branchId === b.id);
    const bRevenue = bSales.reduce((a, x) => a + x.total, 0);
    return `<div class="data-card" style="flex:1;min-width:260px;">
          <div class="data-card-header"><span class="data-card-title">${b.name}</span></div>
          <div class="data-card-body">
            <div style="font-size:28px;font-weight:700;color:var(--maroon)">₱${fmt(bRevenue)}</div>
            <div style="color:var(--ink-60);font-size:13px;margin-top:4px">${bSales.length} transactions today</div>
          </div>
        </div>`;
  }).join('')}
    </div>
    <div style="margin-top:16px;text-align:center;color:var(--ink-40);font-size:13px">Full historical branch reports available under Reports → Sales Reports</div>`;
}

// ── SALES REPORTS ─────────────────────────────────────────────────
function renderSalesReports() {
  // If admin, show in the tabbed admin reports page
  const s = getState();
  if (s.currentUser && s.currentUser.role === 'admin') { _adminReportsTab = 'sales'; renderAdminReports('sales'); return; }
  if (typeof renderReports === 'function') { renderReports(); return; }
  document.getElementById('page-content').innerHTML = '<div class="page-header"><h1 class="page-title">Sales Reports</h1></div>';
}

// ── INVENTORY REPORTS ─────────────────────────────────────────────
function renderInventoryReports() {
  const s = getState();
  if (s.currentUser && s.currentUser.role === 'admin') { _adminReportsTab = 'inventory'; renderAdminReports('inventory'); return; }
  if (typeof renderInventory === 'function') { renderInventory(); return; }
  document.getElementById('page-content').innerHTML = '<div class="page-header"><h1 class="page-title">Inventory Reports</h1></div>';
}

// ── CUSTOM REPORTS ────────────────────────────────────────────────
function renderCustomReports() {
  const s = getState();
  const branches = s.branches || [];
  const branchOptions = branches.map(b => `<option value="${b.id}">${b.name}</option>`).join('');

  document.getElementById('page-content').innerHTML = `
    <div class="page-header"><h1 class="page-title">Custom Report</h1><p class="page-subtitle">Select a report type and branch, then click Generate.</p></div>
    <div class="data-card" style="max-width:640px">
      <div class="data-card-body" style="display:grid;gap:14px;">
        <div class="form-group"><label>Report Type</label>
          <div class="form-select-wrap"><select class="form-control" id="cr-type">
            <option value="sales">Sales Report</option>
            <option value="inventory">Inventory Report</option>
            <option value="orders">Orders Report</option>
            <option value="payroll">Payroll Summary</option>
          </select></div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
          <div class="form-group"><label>From</label><input class="form-control" type="date" id="cr-from" value="${new Date(new Date().setDate(1)).toISOString().split('T')[0]}"></div>
          <div class="form-group"><label>To</label><input class="form-control" type="date" id="cr-to" value="${new Date().toISOString().split('T')[0]}"></div>
        </div>
        <div class="form-group"><label>Branch</label>
          <div class="form-select-wrap"><select class="form-control" id="cr-branch">
            <option value="">All Branches</option>
            ${branchOptions}
          </select></div>
        </div>
        <button class="btn btn-maroon" style="width:fit-content" onclick="generateCustomReport()">Generate Report</button>
      </div>
    </div>
    <div id="cr-result"></div>`;
}

function generateCustomReport() {
  const s = getState();
  const type = document.getElementById('cr-type')?.value;
  const from = document.getElementById('cr-from')?.value;
  const to = document.getElementById('cr-to')?.value;
  const branchId = document.getElementById('cr-branch')?.value;
  const branch = branchId ? (s.branches || []).find(b => b.id === branchId) : null;
  const branchLabel = branch ? branch.name : 'All Branches';

  const fromDate = from ? new Date(from + 'T00:00:00') : null;
  const toDate = to ? new Date(to + 'T23:59:59') : null;

  function inRange(dateStr) {
    if (!dateStr) return !fromDate; // no date = only include if no from filter
    const d = new Date(dateStr);
    if (fromDate && d < fromDate) return false;
    if (toDate && d > toDate) return false;
    return true;
  }

  function matchBranch(item) {
    if (!branchId) return true;
    return (item.branchId === branchId || item.branch_id === branchId);
  }

  const title = { sales: 'Sales Report', inventory: 'Inventory Report', orders: 'Orders Report', payroll: 'Payroll Summary' }[type] || 'Report';
  const rangeLabel = from && to ? from + ' \u2013 ' + to : from ? 'From ' + from : to ? 'Up to ' + to : 'All Time';
  const genDate = new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  let html = '<div class="data-card" style="margin-top:20px">'
    + '<div class="data-card-header">'
    + '<div style="display:flex;align-items:center;gap:10px;flex:1">'
    + '<img src="logo.png" alt="South Pafps" style="height:36px;width:auto;border-radius:6px;flex-shrink:0" onerror="this.style.display=\'none\'">'
    + '<div><div style="font-weight:700;font-size:14px;color:var(--maroon)">' + title + ' \u2014 ' + branchLabel + '</div>'
    + '<div style="font-size:11px;color:var(--ink-60)">South Pafps Packaging Supplies \u00b7 ' + rangeLabel + ' \u00b7 Generated ' + genDate + '</div></div>'
    + '</div>'
    + '<button class="btn btn-sm btn-outline" onclick="printContent(document.getElementById(\'cr-report-body\').innerHTML,\'' + title + ' \u2014 South Pafps\')">'
    + iconSvg('printer') + ' Print</button>'
    + '</div>'
    + '<div class="data-card-body" id="cr-report-body">';

  if (type === 'sales') {
    const sales = (s.sales || []).filter(sale => !sale.voided && inRange(sale.createdAt) && matchBranch(sale));
    const total = sales.reduce((sum, sale) => sum + (sale.total || 0), 0);
    const cashAmt = sales.reduce((sum, sale) => sum + ((sale.payments || []).find(p => p.method === 'cash')?.amount || 0), 0);
    const gcash = sales.reduce((sum, sale) => sum + ((sale.payments || []).find(p => p.method === 'gcash')?.amount || 0), 0);
    html += '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px">'
      + '<div class="kpi-card"><div class="kpi-header"><div class="kpi-label">Transactions</div></div><div class="kpi-value">' + sales.length + '</div></div>'
      + '<div class="kpi-card"><div class="kpi-header"><div class="kpi-label">Total Revenue</div></div><div class="kpi-value">\u20b1' + fmt(total) + '</div></div>'
      + '<div class="kpi-card"><div class="kpi-header"><div class="kpi-label">Cash</div></div><div class="kpi-value">\u20b1' + fmt(cashAmt) + '</div></div>'
      + '<div class="kpi-card"><div class="kpi-header"><div class="kpi-label">GCash</div></div><div class="kpi-value">\u20b1' + fmt(gcash) + '</div></div>'
      + '</div>';
    html += '<table class="data-table"><thead><tr><th>Date &amp; Time</th><th>Receipt #</th><th>Customer</th><th>Items</th><th>Total</th><th>Payment</th></tr></thead><tbody>';
    if (sales.length) {
      [...sales].reverse().forEach(sale => {
        const payLabel = (sale.payments || []).map(p => (p.method === 'cash' ? 'Cash' : 'GCash') + ': \u20b1' + fmt(p.amount)).join(' + ') || (sale.paymentMode || 'Cash');
        html += '<tr>'
          + '<td class="td-mono">' + new Date(sale.createdAt).toLocaleString('en-PH') + '</td>'
          + '<td class="td-mono">' + (sale.receiptNumber || sale.id || '\u2014') + '</td>'
          + '<td>' + (sale.customerName || (sale.customerId ? ((s.customers || []).find(c => c.id === sale.customerId)?.companyName || 'Customer') : 'Walk-in')) + '</td>'
          + '<td>' + (sale.items || []).length + '</td>'
          + '<td class="td-mono" style="font-weight:700;color:var(--maroon)">\u20b1' + fmt(sale.total || 0) + '</td>'
          + '<td class="text-xs">' + payLabel + '</td>'
          + '</tr>';
      });
    } else {
      html += '<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--ink-60)">No sales found for the selected filters.</td></tr>';
    }
    html += '</tbody></table>';

  } else if (type === 'inventory') {
    // Products store stock inside variants[], not on the product itself
    const products = (s.products || []).filter(p => p.active !== false);
    let totalVariants = 0, lowCount = 0, outCount = 0;
    products.forEach(p => { (p.variants || []).forEach(v => { totalVariants++; if (v.stock <= 0) outCount++; else if (v.stock <= (v.reorderLevel ?? 20)) lowCount++; }); });
    html += '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px">'
      + '<div class="kpi-card"><div class="kpi-header"><div class="kpi-label">Total SKUs</div></div><div class="kpi-value">' + totalVariants + '</div></div>'
      + '<div class="kpi-card"><div class="kpi-header"><div class="kpi-label">Low Stock</div></div><div class="kpi-value" style="color:var(--warning)">' + lowCount + '</div></div>'
      + '<div class="kpi-card"><div class="kpi-header"><div class="kpi-label">Out of Stock</div></div><div class="kpi-value" style="color:var(--danger)">' + outCount + '</div></div>'
      + '<div class="kpi-card"><div class="kpi-header"><div class="kpi-label">Products</div></div><div class="kpi-value">' + products.length + '</div></div>'
      + '</div>';
    html += '<table class="data-table"><thead><tr><th>Product</th><th>Variant</th><th>SKU</th><th>Price</th><th>Stock</th><th>Reorder At</th><th>Status</th></tr></thead><tbody>';
    let hasRows = false;
    products.forEach(p => {
      (p.variants || []).forEach(v => {
        hasRows = true;
        const out = v.stock <= 0;
        const low = !out && v.stock <= (v.reorderLevel ?? 20);
        const badge = out ? '<span class="badge badge-danger">Out of Stock</span>' : low ? '<span class="badge badge-warning">Low Stock</span>' : '<span class="badge badge-success">OK</span>';
        html += '<tr>'
          + '<td><strong>' + (p.name || '\u2014') + '</strong></td>'
          + '<td>' + (v.name || '\u2014') + '</td>'
          + '<td class="td-mono">' + (v.sku || '\u2014') + '</td>'
          + '<td class="td-mono">\u20b1' + fmt(v.price || p.price || 0) + '</td>'
          + '<td class="td-mono" style="' + (out ? 'color:var(--danger);font-weight:700' : low ? 'color:var(--warning);font-weight:700' : '') + '">' + (v.stock ?? 0) + '</td>'
          + '<td class="td-mono">' + (v.reorderLevel ?? 20) + '</td>'
          + '<td>' + badge + '</td>'
          + '</tr>';
      });
    });
    if (!hasRows) html += '<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--ink-60)">No products found.</td></tr>';
    html += '</tbody></table>';

  } else if (type === 'orders') {
    // Orders are in localStorage 'orders', NOT in state
    const allOrders = getOrders();
    const orders = allOrders.filter(o => inRange(o.created_at || o.createdAt) && matchBranch(o));
    const totalRev = orders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
    const totalBal = orders.reduce((sum, o) => sum + (o.balance || 0), 0);
    const byStatus = {};
    orders.forEach(o => { byStatus[o.status] = (byStatus[o.status] || 0) + 1; });
    html += '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px">'
      + '<div class="kpi-card"><div class="kpi-header"><div class="kpi-label">Total Orders</div></div><div class="kpi-value">' + orders.length + '</div></div>'
      + '<div class="kpi-card"><div class="kpi-header"><div class="kpi-label">Total Value</div></div><div class="kpi-value">\u20b1' + fmt(totalRev) + '</div></div>'
      + '<div class="kpi-card"><div class="kpi-header"><div class="kpi-label">Balance Due</div></div><div class="kpi-value" style="color:var(--danger)">\u20b1' + fmt(totalBal) + '</div></div>'
      + '<div class="kpi-card"><div class="kpi-header"><div class="kpi-label">Completed</div></div><div class="kpi-value" style="color:var(--success)">' + (byStatus['completed'] || 0) + '</div></div>'
      + '</div>';
    html += '<table class="data-table"><thead><tr><th>Order #</th><th>Customer</th><th>Product</th><th>Date</th><th>Total</th><th>Balance</th><th>Status</th></tr></thead><tbody>';
    if (orders.length) {
      [...orders].reverse().forEach(o => {
        html += '<tr>'
          + '<td class="td-mono">#' + String(o.id).padStart(6, '0') + '</td>'
          + '<td>' + (o.customer_name || '\u2014') + '</td>'
          + '<td>' + (o.product_type || '\u2014') + '</td>'
          + '<td class="td-mono">' + (o.created_at ? new Date(o.created_at).toLocaleDateString('en-PH') : '\u2014') + '</td>'
          + '<td class="td-mono">\u20b1' + fmt(o.total_amount || 0) + '</td>'
          + '<td class="td-mono" style="color:var(--danger)">\u20b1' + fmt(o.balance || 0) + '</td>'
          + '<td>' + omStatusBadge(o.status) + '</td>'
          + '</tr>';
      });
    } else {
      html += '<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--ink-60)">No orders found for the selected filters.</td></tr>';
    }
    html += '</tbody></table>';

  } else if (type === 'payroll') {
    const employees = (s.users || []).filter(u => u.role !== 'admin' && (!branchId || u.branchId === branchId));
    let totalGross = 0;
    html += '<table class="data-table"><thead><tr><th>Employee</th><th>Branch</th><th>Role</th><th>Daily Rate</th><th>Shifts</th><th>Gross Pay</th></tr></thead><tbody>';
    if (employees.length) {
      employees.forEach(emp => {
        const shifts = (s.shifts || []).filter(sh => sh.userId === emp.id && sh.status !== 'open' && inRange(sh.openedAt));
        const gross = shifts.length * (emp.dailyRate || 500);
        totalGross += gross;
        const branchName = (s.branches || []).find(b => b.id === emp.branchId)?.name || '\u2014';
        html += '<tr>'
          + '<td><strong>' + (emp.name || emp.username) + '</strong></td>'
          + '<td>' + branchName + '</td>'
          + '<td>' + ({ staff: 'Branch Staff', print: 'Printing Personnel', admin: 'Administrator' }[emp.role] || emp.role) + '</td>'
          + '<td class="td-mono">\u20b1' + fmt(emp.dailyRate || 500) + '</td>'
          + '<td class="td-mono">' + shifts.length + '</td>'
          + '<td class="td-mono" style="color:var(--maroon);font-weight:600">\u20b1' + fmt(gross) + '</td>'
          + '</tr>';
      });
      html += '<tr style="font-weight:700;background:var(--cream)">'
        + '<td colspan="5" style="text-align:right;padding-right:12px">Total Gross Payroll</td>'
        + '<td class="td-mono" style="color:var(--maroon)">\u20b1' + fmt(totalGross) + '</td>'
        + '</tr>';
    } else {
      html += '<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--ink-60)">No employees found.</td></tr>';
    }
    html += '</tbody></table>';
  }

  html += '</div></div>';
  const el = document.getElementById('cr-result');
  if (el) el.innerHTML = html;
}
// ── SYSTEM CONFIG ─────────────────────────────────────────────────
var _sysConfigTab = 'business';

function renderSystemConfig(tab) {
  const s = getState();
  if (!s.currentUser || s.currentUser.role !== 'admin') { accessDenied('System Info'); return; }
  if (tab) _sysConfigTab = tab;
  const cfg = getSystemConfig ? getSystemConfig() : (s.systemConfig || {});
  const branches = s.branches || [];

  // Build tab list: Business + one per branch
  const tabs = [
    { id: 'business', label: 'Business Info' },
    ...branches.map((b, i) => ({ id: b.id, label: b.name, branchIdx: i, branch: b }))
  ];

  const tabBar = `
    <div style="display:flex;gap:4px;border-bottom:2px solid var(--border);margin-bottom:24px;flex-wrap:wrap;">
      ${tabs.map(t => `
        <button onclick="renderSystemConfig('${t.id}')"
          style="padding:9px 18px;border:none;background:none;cursor:pointer;font-size:13px;font-weight:600;
                 border-bottom:${_sysConfigTab === t.id ? '2px solid var(--maroon)' : '2px solid transparent'};
                 color:${_sysConfigTab === t.id ? 'var(--maroon)' : 'var(--ink-60)'};
                 margin-bottom:-2px;border-radius:4px 4px 0 0;transition:color .15s;
                 ${t.branch ? '' : ''}
                 white-space:nowrap;">
          ${t.branch ? `<span style="display:inline-flex;align-items:center;gap:6px;">${t.label}${t.branch.active ? '' : ' <span style="font-size:10px;background:#f3f4f6;color:var(--ink-40);border-radius:8px;padding:1px 6px;">Inactive</span>'}</span>` : t.label}
        </button>`).join('')}
    </div>`;

  let panelHtml = '';

  if (_sysConfigTab === 'business') {
    panelHtml = `
      <div class="data-card" style="max-width:560px">
        <div class="data-card-header"><span class="data-card-title">Business Information</span></div>
        <div class="data-card-body" style="display:grid;gap:14px;">
          <div class="form-group"><label>Business Name</label><input class="form-control" id="cfg-biz-name" value="${cfg.businessName || 'South Pafps Packaging Supplies'}"></div>
          <div class="form-group"><label>Address Line 1</label><input class="form-control" id="cfg-biz-addr1" value="${cfg.bizAddress1 || 'Unit F&G FACL Commercial Building, Pasong Buaya 2 Road'}" placeholder="Street / Building"></div>
          <div class="form-group"><label>Address Line 2</label><input class="form-control" id="cfg-biz-addr2" value="${cfg.bizAddress2 || 'Pasong Buaya 2, Imus, Cavite'}" placeholder="City, Province"></div>
          <div class="form-group"><label>Phone / Tel</label><input class="form-control" id="cfg-biz-tel" value="${cfg.bizTel || 'Tel: (046) 436-9414'}" placeholder="e.g. Tel: (046) 436-9414"></div>
          <div class="form-group"><label>Default Currency Symbol</label><input class="form-control" id="cfg-currency" value="${cfg.currency || '₱'}" style="max-width:100px"></div>
          <div class="form-group"><label>Receipt Footer Note</label><textarea class="form-control" id="cfg-receipt-note" rows="2">${cfg.receiptNote || 'Thank you for your business!'}</textarea></div>
          <button class="btn btn-maroon" style="width:fit-content" onclick="saveSystemConfigLocal()">Save Settings</button>
        </div>
      </div>`;
  } else {
    const b = branches.find(br => br.id === _sysConfigTab);
    const i = branches.findIndex(br => br.id === _sysConfigTab);
    if (b) {
      panelHtml = `
        <div class="data-card" style="max-width:560px">
          <div class="data-card-header">
            <span class="data-card-title" style="display:flex;align-items:center;gap:8px;">
              <span style="background:var(--maroon);color:#fff;font-size:11px;font-weight:700;border-radius:20px;padding:2px 10px;letter-spacing:0.5px;">Branch ${i + 1}</span>
              ${omEsc(b.name)}
            </span>
            <span class="badge ${b.active ? 'badge-success' : 'badge-danger'}" style="font-size:11px;">${b.active ? 'Active' : 'Inactive'}</span>
          </div>
          <div class="data-card-body" style="display:grid;gap:14px;">
            <div class="form-group"><label>Branch Name</label><input class="form-control" id="branch-name-${b.id}" value="${omEsc(b.name || '')}"></div>
            <div class="form-group"><label>Address</label><input class="form-control" id="branch-address-${b.id}" value="${omEsc(b.address || '')}" placeholder="e.g. San Pedro, Laguna"></div>
            <div class="form-group"><label>Contact Number</label><input class="form-control" id="branch-contact-${b.id}" value="${omEsc(b.contact || '')}" placeholder="e.g. 049-123-4567"></div>
            <div class="form-group" style="flex-direction:row;align-items:center;gap:10px;display:flex;">
              <label style="margin:0;display:flex;align-items:center;gap:8px;cursor:pointer;font-weight:500;">
                <input type="checkbox" id="branch-active-${b.id}" ${b.active ? 'checked' : ''} style="width:16px;height:16px;accent-color:var(--maroon);">
                Branch is Active
              </label>
            </div>
            <button class="btn btn-maroon" style="width:fit-content" onclick="saveBranchInfoLocal('${b.id}')">Save Branch</button>
          </div>
        </div>`;
    }
  }

  document.getElementById('page-content').innerHTML = `
    <div class="page-header"><h1 class="page-title">System Info</h1><p class="page-subtitle">Global configuration for the POS system</p></div>
    ${tabBar}
    ${panelHtml}`;
}

function saveBranchInfoLocal(branchId) {
  const s = getState();
  const idx = (s.branches || []).findIndex(b => b.id === branchId);
  if (idx === -1) { showToast('Branch not found.', 'error'); return; }

  const name = document.getElementById('branch-name-' + branchId)?.value.trim() || '';
  const address = document.getElementById('branch-address-' + branchId)?.value.trim() || '';
  const contact = document.getElementById('branch-contact-' + branchId)?.value.trim() || '';
  const active = document.getElementById('branch-active-' + branchId)?.checked ?? true;

  if (!name) { showToast('Branch name cannot be empty.', 'error'); return; }

  s.branches[idx] = { ...s.branches[idx], name, address, contact, active };
  saveState(s);

  if (typeof DB !== 'undefined') DB.updateBranch(branchId, { name, address, contact, active });

  // Update topbar branch badge if the edited branch is the one being viewed
  const topbarBranch = document.getElementById('topbar-branch');
  if (topbarBranch && s.currentUser?.branchId === branchId) topbarBranch.textContent = name;

  showToast(`Branch "${name}" updated successfully.`, 'success');

  // Re-render keeping the current tab active
  renderSystemConfig(branchId);
}

function saveSystemConfigLocal() {
  const s = getState();
  if (!s.systemConfig) s.systemConfig = {};
  s.systemConfig.businessName = document.getElementById('cfg-biz-name')?.value || '';
  s.systemConfig.bizAddress1 = document.getElementById('cfg-biz-addr1')?.value || '';
  s.systemConfig.bizAddress2 = document.getElementById('cfg-biz-addr2')?.value || '';
  s.systemConfig.bizTel = document.getElementById('cfg-biz-tel')?.value || '';
  s.systemConfig.currency = document.getElementById('cfg-currency')?.value || '₱';
  s.systemConfig.receiptNote = document.getElementById('cfg-receipt-note')?.value || '';
  saveState(s);
  if (typeof DB !== 'undefined') DB.saveSystemConfig(s.systemConfig);
  showToast('System settings saved.', 'success');
}

// ── LOGO UPLOAD ───────────────────────────────────────────────────
function renderLogoUpload() {
  document.getElementById('page-content').innerHTML = `
    <div class="page-header"><h1 class="page-title">Logo Upload</h1><p class="page-subtitle">Upload customer artwork for printing orders</p></div>
    <div class="data-card" style="max-width:520px">
      <div class="data-card-body" style="display:grid;gap:14px;">
        <div class="form-group"><label>Order Reference</label><input class="form-control" id="lu-order" placeholder="Order ID or Customer Name"></div>
        <div class="form-group"><label>Logo / Artwork File</label><input class="form-control" type="file" id="lu-file" accept="image/*,.pdf,.ai,.svg"></div>
        <div class="form-group"><label>Notes</label><textarea class="form-control" id="lu-notes" rows="2" placeholder="Color specs, size requirements…"></textarea></div>
        <button class="btn btn-maroon" style="width:fit-content" onclick="showToast('Logo upload feature requires backend integration.','info')">Upload Logo</button>
      </div>
    </div>`;
}

// ── DISPATCH (existing) ──────────────────────────────────────────────────────
function renderDispatch() {
  const orders = getOrders ? getOrders() : [];
  const dispatchOrders = orders.filter(o => omIsDispatchReady(o));
  document.getElementById('page-content').innerHTML = `
    <div class="page-header"><h1 class="page-title">Daily Dispatch</h1><p class="page-subtitle">Orders ready for delivery or pickup today</p></div>
    <div class="data-card">
      <div class="data-card-body no-pad">
        <table class="data-table">
          <thead><tr><th>Order #</th><th>Customer</th><th>Branch</th><th>Items</th><th>Due Date</th><th>Action</th></tr></thead>
          <tbody>
            ${dispatchOrders.length ? dispatchOrders.map(o => `<tr>
              <td>#${o.id}</td>
              <td>${o.customer_name || '—'}</td>
              <td>${o.branch || '—'}</td>
              <td>${(o.items || []).length} item(s)</td>
              <td>${o.due_date || '—'}</td>
              <td><button class="btn btn-sm btn-maroon" onclick="omConfirmMarkDelivered('${o.id}')">Mark Delivered</button></td>
            </tr>`).join('') : '<tr><td colspan="6" style="text-align:center;color:var(--ink-40);padding:40px">No orders ready for dispatch today.</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>`;
}

// Confirm delivery from the Daily Dispatch page — properly syncs to DB and receipt history
function omConfirmMarkDelivered(orderId) {
  var orders = getOrders();
  var o = orders.find(function (x) { return String(x.id) === String(orderId); });
  if (!o) return;
  if (!omIsDispatchReady(o)) { showToast('Only QC-passed dispatch jobs can be delivered.', 'error'); return; }
  if (!confirm('Mark order #' + String(orderId).padStart(6, '0') + ' as Delivered/Completed?')) return;
  o.status = 'completed';
  o.delivery_date = new Date().toISOString().slice(0, 10);
  saveOrders(orders);
  DB.updateOrder(o.id, { status: 'completed', qc_status: 'passed', delivery_date: o.delivery_date });
  omDeductOrderStock(o.id);
  omPushToReceiptHistory(o.id);
  var s = getState();
  recordAudit(s, { action: 'order_delivered', message: 'Order #' + orderId + ' marked as delivered', referenceId: String(orderId) });
  saveState(s);
  showToast('Order #' + String(orderId).padStart(6, '0') + ' marked as delivered!', 'success');
  renderDispatch();
}

// ── OM CUSTOMER RECORDS (standalone sidebar page) ───────────────────────────

// ── ADMIN + STAFF: Customer Records Management ───────────────────────────────
var _crFilter = { search: '', tab: 'om' };

function renderCustomerRecordsManagement() {
  navigateTo('orders');
  return;
  var s = getState();
  var u = s.currentUser;
  if (!u || !['admin', 'staff', 'cashier'].includes(u.role)) { accessDenied('Customer Records'); return; }
  var isAdmin = u.role === 'admin';

  var omCrs = getCustomerRecords();
  var posCrs = (s.customers || []).filter(function (c) { return c.source === 'pos' || !c.source; });

  var q = (_crFilter.search || '').toLowerCase();
  var activeTab = _crFilter.tab || 'om';

  var totalSpentMap = {}, visitCountMap = {}, lastVisitMap = {};
  (s.sales || []).forEach(function (sale) {
    if (sale.voided || !sale.customerId) return;
    totalSpentMap[sale.customerId] = (totalSpentMap[sale.customerId] || 0) + (sale.total || 0);
    visitCountMap[sale.customerId] = (visitCountMap[sale.customerId] || 0) + 1;
    if (!lastVisitMap[sale.customerId] || sale.createdAt > lastVisitMap[sale.customerId])
      lastVisitMap[sale.customerId] = sale.createdAt;
  });

  var filteredOm = omCrs.filter(function (c) {
    return !q || (c.businessName || '').toLowerCase().indexOf(q) !== -1
      || (c.contactPerson || '').toLowerCase().indexOf(q) !== -1
      || (c.phone || '').indexOf(q) !== -1 || (c.email || '').toLowerCase().indexOf(q) !== -1;
  });
  var filteredPos = posCrs.filter(function (c) {
    return !q || (c.companyName || '').toLowerCase().indexOf(q) !== -1
      || (c.contactPerson || '').toLowerCase().indexOf(q) !== -1
      || (c.phone || '').indexOf(q) !== -1;
  });

  var orders = getOrders();
  var omRows = filteredOm.map(function (c) {
    var orderCount = orders.filter(function (o) { return o.customer_id === c.id || (o.customer_name && o.customer_name.toLowerCase() === (c.businessName || '').toLowerCase()); }).length;
    return '<tr>'
      + '<td class="wgrow"><div style="font-weight:600">' + omEsc(c.businessName || '\u2014') + '</div>'
      + (c.contactPerson ? '<div style="font-size:11px;color:var(--ink-50)">' + omEsc(c.contactPerson) + '</div>' : '') + '</td>'
      + '<td class="td-mono">' + omEsc(c.phone || '\u2014') + '</td>'
      + '<td>' + omEsc(c.email || '\u2014') + '</td>'
      + '<td>' + omEsc(c.address || '\u2014') + '</td>'
      + '<td><span class="badge badge-neutral">' + omEsc(c.modeOfPayment || '\u2014') + '</span></td>'
      + '<td class="td-mono">' + orderCount + '</td>'
      + '<td style="font-size:12px;color:var(--ink-50)">' + omDate(c.createdAt) + '</td>'
      + '<td class="actions-cell">'
      + '<button class="btn btn-sm btn-outline" onclick="crViewOmCustomer(\'' + c.id + '\')">View</button>'
      + (isAdmin ? ' <button class="btn btn-sm btn-maroon" onclick="omEditCustomerModal(\'' + c.id + '\')">Edit</button>' : '')
      + (isAdmin ? ' <button class="btn btn-sm btn-danger" onclick="crDeleteOmCustomer(\'' + c.id + '\')">\u00d7</button>' : '')
      + '</td></tr>';
  }).join('') || '<tr><td colspan="8" style="text-align:center;padding:32px;color:var(--ink-60)"><div style="font-size:28px;margin-bottom:8px">\uD83D\uDCC2</div>No order management customers yet.</td></tr>';

  var posRows = filteredPos.map(function (c) {
    var balance = c.outstandingBalance || 0;
    var balCell = balance > 0
      ? '<span class="td-mono" style="color:var(--danger);font-weight:700">\u20b1' + fmt(balance) + '</span>'
      : '<span class="badge badge-success">Clear</span>';
    return '<tr>'
      + '<td class="wgrow"><div style="font-weight:600">' + omEsc(c.companyName || c.contactPerson || 'Unknown') + '</div>'
      + (c.contactPerson && c.companyName ? '<div style="font-size:11px;color:var(--ink-50)">' + omEsc(c.contactPerson) + '</div>' : '') + '</td>'
      + '<td class="td-mono">' + omEsc(c.phone || '\u2014') + '</td>'
      + '<td class="td-mono">' + (visitCountMap[c.id] || 0) + '</td>'
      + '<td class="td-mono" style="font-weight:700;color:var(--maroon)">\u20b1' + fmt(totalSpentMap[c.id] || 0) + '</td>'
      + '<td>' + (lastVisitMap[c.id] ? fmtDate(lastVisitMap[c.id]) : '\u2014') + '</td>'
      + '<td>' + balCell + '</td>'
      + '<td class="actions-cell">'
      + '<button class="btn btn-sm btn-outline" onclick="viewPosCustomerModal(\'' + c.id + '\')">View</button>'
      + (isAdmin ? ' <button class="btn btn-sm btn-danger" onclick="crDeletePosCustomer(\'' + c.id + '\')">\u00d7</button>' : '')
      + '</td></tr>';
  }).join('') || '<tr><td colspan="7" style="text-align:center;padding:32px;color:var(--ink-60)"><div style="font-size:28px;margin-bottom:8px">\uD83C\uDFEA</div>No POS walk-in customers found.</td></tr>';

  var totalOm = omCrs.length, totalPos = posCrs.length;
  var totalRev = Object.values(totalSpentMap).reduce(function (a, b) { return a + b; }, 0);

  var tabToggle = '<div style="display:flex;gap:0;border:1px solid var(--ink-20);border-radius:var(--radius);overflow:hidden">'
    + '<button class="btn btn-sm" style="border-radius:0;border:none;padding:7px 16px;background:' + (activeTab === 'om' ? 'var(--maroon)' : 'transparent') + ';color:' + (activeTab === 'om' ? '#fff' : 'var(--ink)') + ';font-weight:600" onclick="_crFilter.tab=\'om\';renderCustomerRecordsManagement()">\uD83D\uDCCB OM Clients (' + totalOm + ')</button>'
    + '<button class="btn btn-sm" style="border-radius:0;border:none;padding:7px 16px;border-left:1px solid var(--ink-20);background:' + (activeTab === 'pos' ? 'var(--maroon)' : 'transparent') + ';color:' + (activeTab === 'pos' ? '#fff' : 'var(--ink)') + ';font-weight:600" onclick="_crFilter.tab=\'pos\';renderCustomerRecordsManagement()">\uD83C\uDFEA POS Walk-ins (' + totalPos + ')</button>'
    + '</div>';

  var tableSection = activeTab === 'om'
    ? '<div class="data-card-header" style="padding:10px 20px;border-bottom:1px solid var(--ink-10)">'
    + '<span class="data-card-title">' + iconSvg('clipboard') + ' Order Management Clients</span>'
    + '<span class="badge badge-neutral">' + filteredOm.length + ' record' + (filteredOm.length !== 1 ? 's' : '') + '</span>'
    + (isAdmin ? '<button class="btn btn-sm btn-maroon" style="margin-left:auto" onclick="omNewCustomerModal()">+ New Client</button>' : '')
    + '</div>'
    + '<div class="data-card-body no-pad"><table class="data-table"><thead><tr>'
    + '<th>Business / Contact</th><th>Phone</th><th>Email</th><th>Address</th><th>Pay Mode</th><th>Orders</th><th>Added</th><th>Actions</th>'
    + '</tr></thead><tbody>' + omRows + '</tbody></table></div>'
    : '<div class="data-card-header" style="padding:10px 20px;border-bottom:1px solid var(--ink-10)">'
    + '<span class="data-card-title">' + iconSvg('users') + ' POS Walk-in Customers</span>'
    + '<span class="badge badge-neutral">' + filteredPos.length + ' record' + (filteredPos.length !== 1 ? 's' : '') + '</span>'
    + '</div>'
    + '<div class="data-card-body no-pad"><table class="data-table"><thead><tr>'
    + '<th>Customer</th><th>Phone</th><th>Visits</th><th>Total Spent</th><th>Last Visit</th><th>AR Balance</th><th>Actions</th>'
    + '</tr></thead><tbody>' + posRows + '</tbody></table></div>';

  document.getElementById('page-content').innerHTML =
    '<div class="page-header" style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px">'
    + '<div><h1 class="page-title">Customer Records</h1>'
    + '<p class="page-subtitle">Manage all customers \u2014 Order Management clients and POS walk-ins</p></div>'
    + '</div>'
    + '<div class="kpi-grid" style="grid-template-columns:repeat(3,1fr);margin-bottom:20px">'
    + '<div class="kpi-card"><div class="kpi-header"><div class="kpi-label">OM Clients</div><div class="kpi-icon maroon">' + iconSvg('clipboard') + '</div></div><div class="kpi-value">' + totalOm + '</div><div class="kpi-sub">Order management customers</div></div>'
    + '<div class="kpi-card"><div class="kpi-header"><div class="kpi-label">POS Walk-ins</div><div class="kpi-icon blue">' + iconSvg('users') + '</div></div><div class="kpi-value">' + totalPos + '</div><div class="kpi-sub">Walk-in customers via POS</div></div>'
    + '<div class="kpi-card"><div class="kpi-header"><div class="kpi-label">Total POS Revenue</div><div class="kpi-icon green">' + iconSvg('money') + '</div></div><div class="kpi-value">\u20b1' + fmt(totalRev) + '</div><div class="kpi-sub">From all walk-in sales</div></div>'
    + '</div>'
    + '<div class="data-card">'
    + '<div class="data-card-body" style="padding:12px 20px;border-bottom:1px solid var(--ink-10);display:flex;gap:10px;flex-wrap:wrap;align-items:center">'
    + '<input class="form-control" style="flex:1;min-width:200px;max-width:320px" placeholder="Search customers\u2026" value="' + (_crFilter.search || '') + '" oninput="_crFilter.search=this.value;renderCustomerRecordsManagement()">'
    + tabToggle + '</div>'
    + tableSection + '</div>';
}

function crViewOmCustomer(id) {
  var crs = getCustomerRecords();
  var c = crs.find(function (x) { return x.id === id; });
  if (!c) return;
  var orders = getOrders().filter(function (o) { return o.customer_name && o.customer_name.toLowerCase() === (c.businessName || '').toLowerCase(); });
  var s = getState();
  var isAdmin = s.currentUser && s.currentUser.role === 'admin';
  var displayName = c.businessName || c.contactPerson || 'Unknown';
  var initials = displayName.split(' ').slice(0, 2).map(function (w) { return w[0] || ''; }).join('').toUpperCase() || '?';
  var totalOrderValue = orders.reduce(function (sum, o) { return sum + (o.total_amount || 0); }, 0);

  var ordersHtml = orders.slice(0, 8).map(function (o) {
    return '<tr>'
      + '<td class="td-mono" style="font-weight:600">#' + String(o.id).padStart(6, '0') + '</td>'
      + '<td>' + omEsc(o.product_type || '\u2014') + '</td>'
      + '<td class="td-mono">\u20b1' + omFmt(o.total_amount || 0) + '</td>'
      + '<td>' + omStatusBadge(o.status) + '</td>'
      + '<td style="font-size:12px;color:var(--ink-50)">' + omDate(o.created_at || o.createdAt) + '</td>'
      + '</tr>';
  }).join('') || '<tr><td colspan="5" style="text-align:center;padding:24px;color:var(--ink-40)"><div style="font-size:24px;margin-bottom:6px">\uD83D\uDCCB</div>No orders yet.</td></tr>';

  showModal(
    '<div class="modal-header" style="border-bottom:none;padding-bottom:0">'
    + '<button class="btn-close-modal" onclick="closeModal()" style="margin-left:auto">&#x2715;</button></div>'

    + '<div style="background:linear-gradient(135deg,var(--maroon) 0%,#a02040 100%);padding:28px 28px 22px;margin:-8px 0 0;position:relative;overflow:hidden">'
    + '<div style="position:absolute;top:-20px;right:-20px;width:120px;height:120px;background:rgba(255,255,255,0.06);border-radius:50%"></div>'
    + '<div style="display:flex;align-items:center;gap:16px;position:relative">'
    + '<div style="width:56px;height:56px;border-radius:50%;background:rgba(255,255,255,0.18);display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:800;color:#fff;flex-shrink:0;border:2px solid rgba(255,255,255,0.3)">' + initials + '</div>'
    + '<div style="flex:1;min-width:0">'
    + '<div style="font-size:18px;font-weight:700;color:#fff;margin-bottom:2px">' + omEsc(displayName) + '</div>'
    + (c.contactPerson && c.businessName ? '<div style="font-size:13px;color:rgba(255,255,255,0.72);margin-bottom:6px">' + omEsc(c.contactPerson) + '</div>' : '<div style="margin-bottom:6px"></div>')
    + '<div style="display:flex;gap:6px;flex-wrap:wrap">'
    + '<span style="background:rgba(255,255,255,0.15);color:#fff;padding:2px 10px;border-radius:99px;font-size:11px;font-weight:600">\uD83D\uDCCB OM Client</span>'
    + (c.modeOfPayment ? '<span style="background:rgba(255,255,255,0.12);color:rgba(255,255,255,0.9);padding:2px 10px;border-radius:99px;font-size:11px;font-weight:600">\uD83D\uDCB3 ' + omEsc(c.modeOfPayment) + '</span>' : '')
    + '</div>'
    + '</div></div></div>'

    + '<div class="modal-body" style="padding:20px 24px">'

    + '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:20px">'
    + '<div style="background:var(--cream);border-radius:10px;padding:14px;text-align:center"><div style="font-size:24px;font-weight:800;color:var(--maroon)">' + orders.length + '</div><div style="font-size:10px;color:var(--ink-50);font-weight:600;text-transform:uppercase;letter-spacing:0.06em;margin-top:2px">Total Orders</div></div>'
    + '<div style="background:var(--cream);border-radius:10px;padding:14px;text-align:center"><div style="font-size:24px;font-weight:800;color:var(--maroon)">\u20b1' + omFmt(totalOrderValue) + '</div><div style="font-size:10px;color:var(--ink-50);font-weight:600;text-transform:uppercase;letter-spacing:0.06em;margin-top:2px">Total Value</div></div>'
    + '<div style="background:var(--cream);border-radius:10px;padding:14px;text-align:center"><div style="font-size:24px;font-weight:800;color:var(--ink)">' + omDate(c.createdAt) + '</div><div style="font-size:10px;color:var(--ink-50);font-weight:600;text-transform:uppercase;letter-spacing:0.06em;margin-top:2px">Since</div></div>'
    + '</div>'

    + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:20px">'
    + _crInfoField('Phone', c.phone || '\u2014', true)
    + _crInfoField('Email', c.email || '\u2014')
    + _crInfoField('Address', c.address || '\u2014')
    + _crInfoField('Branch Staff', c.branchStaff || '\u2014')
    + _crInfoField('Mode of Delivery', c.modeOfDelivery || '\u2014')
    + _crInfoField('Mode of Payment', c.modeOfPayment || '\u2014')
    + (c.notes ? '<div style="grid-column:span 2">' + _crInfoField('Notes', c.notes) + '</div>' : '')
    + '</div>'

    + '<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;color:var(--ink-40);margin-bottom:8px">Order History</div>'
    + '<div style="border:1px solid var(--ink-10);border-radius:10px;overflow:hidden">'
    + '<table class="data-table" style="margin:0"><thead><tr><th>Order #</th><th>Product</th><th>Total</th><th>Status</th><th>Date</th></tr></thead>'
    + '<tbody>' + ordersHtml + '</tbody></table></div>'
    + '</div>'

    + '<div class="modal-footer">'
    + '<button class="btn btn-outline" onclick="closeModal()">Close</button>'
    + (isAdmin ? '<button class="btn btn-maroon" onclick="closeModal();omEditCustomerModal(\'' + id + '\')">' + iconSvg('users') + ' Edit Customer</button>' : '')
    + '</div>'
    , 'modal-lg');
}

function _crInfoField(label, value, mono) {
  return '<div style="background:var(--cream);border-radius:8px;padding:10px 14px">'
    + '<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;color:var(--ink-40);margin-bottom:3px">' + label + '</div>'
    + '<div style="font-size:13px;color:var(--ink);' + (mono ? 'font-family:monospace;' : '') + '">' + omEsc(String(value)) + '</div>'
    + '</div>';
}

function crDeleteOmCustomer(id) {
  confirmModal({
    title: 'Delete Client',
    message: 'Are you sure you want to delete this client? Their existing orders will remain unaffected.',
    confirmText: 'Delete Client',
    icon: '👤',
    onConfirm: function () {
      saveCustomerRecords(getCustomerRecords().filter(function (c) { return c.id !== id; }));
      try { DB.deleteOMCustomer(id); } catch (e) { }
      showToast('Customer deleted.', 'warning');
      renderCustomerRecordsManagement();
    }
  });
}

function crEditPosCustomer(id) {
  var s = getState();
  var c = (s.customers || []).find(function (x) { return x.id === id; });
  if (!c) return;
  var displayName = c.companyName || c.contactPerson || 'Customer';
  var initials = displayName.split(' ').slice(0, 2).map(function (w) { return w[0] || ''; }).join('').toUpperCase() || '?';
  showModal(
    '<div class="modal-header" style="border-bottom:none;padding-bottom:0">'
    + '<button class="btn-close-modal" onclick="closeModal()" style="margin-left:auto">&#x2715;</button></div>'
    + '<div style="background:linear-gradient(135deg,var(--maroon) 0%,#a02040 100%);padding:20px 24px;margin:-8px 0 0">'
    + '<div style="display:flex;align-items:center;gap:14px">'
    + '<div style="width:44px;height:44px;border-radius:50%;background:rgba(255,255,255,0.2);display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:800;color:#fff;flex-shrink:0;border:2px solid rgba(255,255,255,0.3)">' + initials + '</div>'
    + '<div><div style="font-size:16px;font-weight:700;color:#fff">' + omEsc(displayName) + '</div>'
    + '<div style="font-size:12px;color:rgba(255,255,255,0.7)">\uD83C\uDFEA POS Walk-in Customer</div></div>'
    + '</div></div>'
    + '<div class="modal-body" style="padding:20px 24px">'
    + '<div class="form-row-2">'
    + '<div class="form-group"><label>Company / Business Name</label><input id="crpos-company" class="form-control" value="' + omEsc(c.companyName || '') + '" placeholder="Company name (optional)"></div>'
    + '<div class="form-group"><label>Contact Person</label><input id="crpos-contact" class="form-control" value="' + omEsc(c.contactPerson || '') + '" placeholder="Full name"></div>'
    + '</div>'
    + '<div class="form-row-2">'
    + '<div class="form-group"><label>Phone</label><input id="crpos-phone" class="form-control" value="' + omEsc(c.phone || '') + '" placeholder="09XX-XXX-XXXX"></div>'
    + '<div class="form-group"><label>Email</label><input id="crpos-email" class="form-control" value="' + omEsc(c.email || '') + '" placeholder="email@example.com"></div>'
    + '</div>'
    + '<div class="form-group"><label>Address</label><input id="crpos-address" class="form-control" value="' + omEsc(c.address || '') + '" placeholder="Street, City"></div>'
    + '<div class="form-group"><label>Notes</label><textarea id="crpos-notes" class="form-control" rows="2" placeholder="Any additional notes...">' + omEsc(c.notes || '') + '</textarea></div>'
    + '</div>'
    + '<div class="modal-footer">'
    + '<button class="btn btn-outline" onclick="closeModal()">Cancel</button>'
    + '<button class="btn btn-maroon" onclick="crSavePosCustomer(\'' + id + '\')">Save Changes</button>'
    + '</div>'
  );
}

function crSavePosCustomer(id) {
  var s = getState();
  var c = (s.customers || []).find(function (x) { return x.id === id; });
  if (!c) return;
  function gv(eid) { var el = document.getElementById(eid); return el ? el.value.trim() : ''; }
  c.companyName = gv('crpos-company'); c.contactPerson = gv('crpos-contact');
  c.phone = gv('crpos-phone'); c.email = gv('crpos-email');
  c.address = gv('crpos-address'); c.notes = gv('crpos-notes');
  c.updatedAt = new Date().toISOString();
  saveState(s); closeModal();
  showToast('Customer updated!', 'success');
  renderCustomerRecordsManagement();
}

function crDeletePosCustomer(id) {
  confirmModal({
    title: 'Delete POS Customer',
    message: 'Are you sure you want to delete this POS customer? Their sales history will remain unaffected.',
    confirmText: 'Delete Customer',
    icon: '👤',
    onConfirm: function () {
      var s = getState();
      s.customers = (s.customers || []).filter(function (c) { return c.id !== id; });
      saveState(s); showToast('POS customer deleted.', 'warning');
      renderCustomerRecordsManagement();
    }
  });
}

function renderOmCustomerRecords() {
  var s = getState();
  var u = s.currentUser;
  if (!u) { accessDenied('Customer Records'); return; }
  // Redirect to OM with customers tab active
  _omTab = 'customers';
  sessionStorage.setItem('omTab', 'customers');
  currentPage = 'orders'; // point current page at orders so nav/breadcrumb match
  renderOrders();
}

// ── OM PAYMENT (standalone sidebar page) ────────────────────────────────────
function renderOmPaymentPage() {
  var s = getState();
  var u = s.currentUser;
  if (!u) { accessDenied('Payment'); return; }
  _omTab = 'payment';
  sessionStorage.setItem('omTab', 'payment');
  currentPage = 'orders';
  renderOrders();
}

// ── ADMIN REPORTS PAGE ───────────────────────────────────────────────────────
var _adminReportsTab = 'submissions';

function renderAdminReports(tab) {
  const s = getState();
  if (!s.currentUser || s.currentUser.role !== 'admin') { accessDenied('Reports'); return; }
  if (tab) _adminReportsTab = tab;

  const tabs = [
    { id: 'submissions', label: iconSvg('clipboard') + ' Submitted Reports' },
    { id: 'sales', label: iconSvg('money') + ' Sales Reports' },
    { id: 'inventory', label: iconSvg('box') + ' Inventory' },
    { id: 'custom', label: iconSvg('chart') + ' Custom Report' },
  ];

  const tabBar = '<div class="om-tabs" style="margin-bottom:20px">'
    + tabs.map(t => '<div class="om-tab' + (_adminReportsTab === t.id ? ' active' : '') + '" onclick="renderAdminReports(\'' + t.id + '\')">' + t.label + '</div>').join('')
    + '</div>';

  let tabContent = '';

  if (_adminReportsTab === 'submissions') {
    const submittedReports = JSON.parse(localStorage.getItem('submitted_reports') || '[]');
    const staffSubmissions = submittedReports.filter(r => r.type === 'branch_staff');
    const printFwdSubmissions = submittedReports.filter(r => r.type === 'print_dept_forwarded');
    const pendingFwd = submittedReports.filter(r => r.type === 'print_dept' && !r.forwardedToAdmin).length;
    const allAdminVisible = [...submittedReports].filter(r => r.type === 'branch_staff' || r.type === 'print_dept_forwarded').reverse();

    const warningBanner = pendingFwd > 0
      ? '<div style="background:var(--warning-l);border:1px solid var(--warning);border-radius:var(--radius);padding:12px 16px;margin-bottom:16px;font-size:13px;color:var(--ink-80)">&#9888; <strong>' + pendingFwd + ' print department report(s)</strong> are waiting to be reviewed and forwarded by Main Branch staff. They will appear here once forwarded.</div>'
      : '';

    let tableRows = '';
    if (!allAdminVisible.length) {
      tableRows = '<tr><td colspan="7" style="text-align:center;padding:32px;color:var(--ink-60)">No reports received yet.</td></tr>';
    } else {
      allAdminVisible.forEach(r => {
        const branch = s.branches.find(b => b.id === r.branchId);
        const isPrint = r.type === 'print_dept_forwarded';
        const sourceLabel = isPrint
          ? '<span class="badge badge-info">&#128247; Print Dept (via Main Branch)</span>'
          : '<span class="badge badge-neutral">&#128101; Branch Staff</span>';
        const reportBadges = (r.reports || []).map(rp => '<span class="badge badge-info" style="margin-right:4px">' + rp + '</span>').join('');
        tableRows += '<tr>'
          + '<td class="td-mono">' + new Date(r.submittedAt).toLocaleString('en-PH') + '</td>'
          + '<td><strong>' + (r.submitterName || '&mdash;') + '</strong></td>'
          + '<td>' + sourceLabel + '</td>'
          + '<td>' + (branch?.name || (isPrint ? 'Print Dept' : 'All')) + '</td>'
          + '<td>' + reportBadges + '</td>'
          + '<td style="max-width:200px;font-size:12px;color:var(--ink-60)">' + (r.note || '&mdash;') + '</td>'
          + '<td><button class="btn btn-sm btn-outline" onclick="viewSubmittedReport(\'' + r.id + '\')">View</button></td>'
          + '</tr>';
      });
    }

    const pendingKpiColor = pendingFwd > 0 ? 'var(--danger)' : 'var(--success)';

    tabContent = `
      <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr)">
        <div class="kpi-card"><div class="kpi-header"><div class="kpi-label">Total Received</div><div class="kpi-icon maroon">${iconSvg('clipboard')}</div></div><div class="kpi-value">${allAdminVisible.length}</div></div>
        <div class="kpi-card"><div class="kpi-header"><div class="kpi-label">From Branch Staff</div><div class="kpi-icon gold">${iconSvg('users')}</div></div><div class="kpi-value">${staffSubmissions.length}</div></div>
        <div class="kpi-card"><div class="kpi-header"><div class="kpi-label">From Print Dept (Fwd)</div><div class="kpi-icon blue">${iconSvg('printer')}</div></div><div class="kpi-value">${printFwdSubmissions.length}</div></div>
        <div class="kpi-card"><div class="kpi-header"><div class="kpi-label">Pending Forwarding</div><div class="kpi-icon maroon">${iconSvg('warning')}</div></div><div class="kpi-value" style="color:${pendingKpiColor}">${pendingFwd}</div></div>
      </div>
      ${warningBanner}
      <div class="data-card">
        <div class="data-card-header"><span class="data-card-title">${iconSvg('clipboard')} All Received Reports</span><span class="badge badge-neutral">${allAdminVisible.length} total</span></div>
        <div class="data-card-body no-pad">
          <table class="data-table">
            <thead><tr><th>Date &amp; Time</th><th>Submitted By</th><th>Source</th><th>Branch</th><th>Reports</th><th>Note</th><th>Action</th></tr></thead>
            <tbody>${tableRows}</tbody>
          </table>
        </div>
      </div>`;

  } else if (_adminReportsTab === 'sales') {
    // Inline sales report content
    const sales = (s.sales || []).filter(s2 => !s2.voided);
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const salesThisMonth = sales.filter(s2 => new Date(s2.createdAt) >= monthStart);
    const totalRevenue = sales.reduce((sum, s2) => sum + (s2.total || 0), 0);
    const monthRevenue = salesThisMonth.reduce((sum, s2) => sum + (s2.total || 0), 0);

    const branchSales = {};
    sales.forEach(s2 => {
      const b = s.branches.find(br => br.id === s2.branchId);
      const bName = b?.name || 'Unknown';
      branchSales[bName] = (branchSales[bName] || 0) + (s2.total || 0);
    });

    const branchRows = Object.entries(branchSales).sort((a, b) => b[1] - a[1]).map(([br, rev]) =>
      `<tr><td><strong>${br}</strong></td><td class="td-mono" style="font-weight:700;color:var(--maroon)">₱${fmt(rev)}</td><td class="td-mono">${sales.filter(s2 => (s.branches.find(b => b.id === s2.branchId)?.name || 'Unknown') === br).length}</td></tr>`
    ).join('') || '<tr><td colspan="3" style="text-align:center;padding:24px;color:var(--ink-60)">No sales data yet.</td></tr>';

    const recentRows = [...sales].reverse().slice(0, 30).map(s2 => {
      const b = s.branches.find(br => br.id === s2.branchId);
      const u2 = s.users.find(u2 => u2.id === s2.userId);
      return `<tr>
        <td class="td-mono" style="font-size:12px">${fmtTime(s2.createdAt)}</td>
        <td class="td-mono">${s2.receiptNo || '—'}</td>
        <td>${b?.name || '—'}</td>
        <td>${u2?.name || '—'}</td>
        <td>${s2.paymentMode || '—'}</td>
        <td class="td-mono" style="font-weight:700;color:var(--maroon)">₱${fmt(s2.total || 0)}</td>
      </tr>`;
    }).join('') || '<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--ink-60)">No sales yet.</td></tr>';

    tabContent = `
      <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr)">
        <div class="kpi-card"><div class="kpi-header"><div class="kpi-label">Total Revenue</div><div class="kpi-icon maroon">${iconSvg('money')}</div></div><div class="kpi-value">₱${fmt(totalRevenue)}</div></div>
        <div class="kpi-card"><div class="kpi-header"><div class="kpi-label">This Month</div><div class="kpi-icon gold">${iconSvg('chart')}</div></div><div class="kpi-value">₱${fmt(monthRevenue)}</div></div>
        <div class="kpi-card"><div class="kpi-header"><div class="kpi-label">Total Transactions</div><div class="kpi-icon blue">${iconSvg('receipt')}</div></div><div class="kpi-value">${sales.length}</div></div>
        <div class="kpi-card"><div class="kpi-header"><div class="kpi-label">This Month</div><div class="kpi-icon green">${iconSvg('check')}</div></div><div class="kpi-value">${salesThisMonth.length}</div></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
        <div class="data-card">
          <div class="data-card-header"><span class="data-card-title">${iconSvg('building')} Revenue by Branch</span></div>
          <div class="data-card-body no-pad">
            <table class="data-table">
              <thead><tr><th>Branch</th><th>Revenue</th><th>Transactions</th></tr></thead>
              <tbody>${branchRows}</tbody>
            </table>
          </div>
        </div>
        <div class="data-card">
          <div class="data-card-header"><span class="data-card-title">${iconSvg('receipt')} Recent Transactions</span></div>
          <div class="data-card-body no-pad" style="max-height:400px;overflow-y:auto">
            <table class="data-table">
              <thead><tr><th>Date</th><th>Receipt</th><th>Branch</th><th>Staff</th><th>Method</th><th>Total</th></tr></thead>
              <tbody>${recentRows}</tbody>
            </table>
          </div>
        </div>
      </div>`;

  } else if (_adminReportsTab === 'inventory') {
    const products = (s.products || []).filter(p => p.active);
    let invRows = '';
    products.forEach(p => {
      (p.variants || []).forEach(v => {
        const totalStock = Object.values(v.branchStocks || {}).reduce((a, b2) => a + (b2 || 0), 0);
        const low = totalStock > 0 && totalStock <= (v.reorderLevel || 20);
        const out = totalStock <= 0;
        const badge = out ? '<span class="badge badge-danger">Out of Stock</span>'
          : low ? '<span class="badge badge-warning">Low Stock</span>'
            : '<span class="badge badge-success">OK</span>';
        invRows += `<tr>
          <td><strong>${p.name}</strong></td>
          <td>${v.name}</td>
          <td class="td-mono">${v.sku || '—'}</td>
          <td class="td-mono" style="${out ? 'color:var(--danger);font-weight:700' : low ? 'color:var(--warning);font-weight:700' : ''}">${totalStock}</td>
          <td class="td-mono">${v.reorderLevel || 20}</td>
          <td>₱${fmt(v.price || 0)}</td>
          <td>${badge}</td>
        </tr>`;
      });
    });

    tabContent = `
      <div class="kpi-grid" style="grid-template-columns:repeat(3,1fr)">
        <div class="kpi-card"><div class="kpi-header"><div class="kpi-label">Total Products</div><div class="kpi-icon maroon">${iconSvg('box')}</div></div><div class="kpi-value">${products.length}</div></div>
        <div class="kpi-card"><div class="kpi-header"><div class="kpi-label">Low Stock</div><div class="kpi-icon gold">${iconSvg('warning')}</div></div><div class="kpi-value" style="color:var(--warning)">${products.flatMap(p => p.variants || []).filter(v => { const t = Object.values(v.branchStocks || {}).reduce((a, b2) => a + (b2 || 0), 0); return t > 0 && t <= (v.reorderLevel || 20); }).length}</div></div>
        <div class="kpi-card"><div class="kpi-header"><div class="kpi-label">Out of Stock</div><div class="kpi-icon maroon">${iconSvg('error')}</div></div><div class="kpi-value" style="color:var(--danger)">${products.flatMap(p => p.variants || []).filter(v => Object.values(v.branchStocks || {}).reduce((a, b2) => a + (b2 || 0), 0) <= 0).length}</div></div>
      </div>
      <div class="data-card">
        <div class="data-card-header"><span class="data-card-title">${iconSvg('box')} All Product Variants</span></div>
        <div class="data-card-body no-pad">
          <table class="data-table">
            <thead><tr><th>Product</th><th>Variant</th><th>SKU</th><th>Stock</th><th>Reorder Level</th><th>Price</th><th>Status</th></tr></thead>
            <tbody>${invRows || '<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--ink-60)">No products found.</td></tr>'}</tbody>
          </table>
        </div>
      </div>`;

  } else if (_adminReportsTab === 'custom') {
    const branchOptions = (s.branches || []).map(b => `<option value="${b.id}">${b.name}</option>`).join('');
    tabContent = `
      <div class="data-card" style="max-width:640px">
        <div class="data-card-header"><span class="data-card-title">${iconSvg('chart')} Custom Report Generator</span></div>
        <div class="data-card-body" style="display:grid;gap:14px;">
          <div class="form-group"><label>Report Type</label>
            <div class="form-select-wrap"><select class="form-control" id="cr-type">
              <option value="sales">Sales Report</option>
              <option value="inventory">Inventory Report</option>
              <option value="orders">Orders Report</option>
              <option value="payroll">Payroll Summary</option>
            </select></div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            <div class="form-group"><label>From</label><input class="form-control" type="date" id="cr-from" value="${new Date(new Date().setDate(1)).toISOString().split('T')[0]}"></div>
            <div class="form-group"><label>To</label><input class="form-control" type="date" id="cr-to" value="${new Date().toISOString().split('T')[0]}"></div>
          </div>
          <div class="form-group"><label>Branch</label>
            <div class="form-select-wrap"><select class="form-control" id="cr-branch">
              <option value="">All Branches</option>
              ${branchOptions}
            </select></div>
          </div>
          <button class="btn btn-maroon" style="width:fit-content" onclick="generateCustomReport()">Generate Report</button>
        </div>
      </div>
      <div id="cr-result"></div>`;
  }

  document.getElementById('page-content').innerHTML = `
    <div class="page-header">
      <h1 class="page-title">Reports</h1>
      <p class="page-subtitle">Analytics, inventory, and report submissions from staff &amp; print department</p>
    </div>
    ${tabBar}
    <div id="admin-reports-tab-content">${tabContent}</div>`;
}
function viewSubmittedReport(reportId) {
  const submittedReports = JSON.parse(localStorage.getItem('submitted_reports') || '[]');
  const r = submittedReports.find(x => x.id === reportId);
  if (!r) return;
  const s = getState();
  const branch = s.branches.find(b => b.id === r.branchId);
  const isPrint = r.type === 'print_dept_forwarded';
  const sourceLabel = isPrint ? 'Print Dept (via Main Branch)' : getRoleLabel(r.role);
  showModal(`
    <div class="modal-header"><h2>${iconSvg('clipboard')} Submitted Report — ${r.submitterName}</h2><button class="btn-close-modal" onclick="closeModal()">&#10005;</button></div>
    <div class="modal-body">
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:16px;padding-bottom:14px;border-bottom:1px solid var(--ink-10)">
        <div><div class="text-xs text-muted">Submitted By</div><div style="font-weight:600">${r.submitterName}</div></div>
        <div><div class="text-xs text-muted">Date &amp; Time</div><div>${new Date(r.submittedAt).toLocaleString('en-PH')}</div></div>
        <div><div class="text-xs text-muted">Source</div><div>${sourceLabel}</div></div>
        <div><div class="text-xs text-muted">Branch</div><div>${branch?.name || (isPrint ? 'Print Dept' : 'N/A')}</div></div>
        <div style="grid-column:span 2"><div class="text-xs text-muted" style="margin-bottom:4px">Reports Included</div><div style="display:flex;flex-wrap:wrap;gap:4px">${(r.reports || []).map(rp => `<span class="badge badge-info">${rp}</span>`).join('')}</div></div>
      </div>
      ${r.note ? `<div style="margin-bottom:14px"><div class="text-xs text-muted" style="margin-bottom:4px">Note</div><div style="background:var(--cream);padding:10px;border-radius:var(--radius);font-size:13px">${r.note}</div></div>` : ''}
      <div style="border-top:1px solid var(--ink-10);padding-top:14px">${r.reportHtml || '<div style="text-align:center;padding:32px;color:var(--ink-40)">No report content attached.</div>'}</div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="printContent(document.querySelector('#modal-container .modal-body').innerHTML,'Report — South Pafps')">${iconSvg('printer')} Print</button>
      <button class="btn btn-maroon" onclick="closeModal()">Close</button>
    </div>`, 'modal-lg');
}

// ── ADMIN PAYSLIP GENERATION ─────────────────────────────────────────────────
function renderAdminPayslipGenLegacyOld() {
  const s = getState();
  const role = normalizeRole(s.currentUser?.role);
  if (!s.currentUser || !['admin', 'hr', 'branch_manager'].includes(role)) { accessDenied('Payslip Generation'); return; }
  const employees = s.users.filter(u => {
    const userRole = normalizeRole(u.role);
    if (userRole === 'admin') return false;
    if (role === 'branch_manager') return u.branchId === s.currentUser.branchId && !['hr', 'branch_manager'].includes(userRole);
    return true;
  });
  const branches = (s.branches || []).filter(b => {
    if (role === 'branch_manager') return b.id === s.currentUser.branchId;
    return b.active !== false;
  });
  const now = new Date();
  const monthLabel = now.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' });
  const defaultRunStart = window._adminPayrollRunStartDate || toLocalDateString(new Date(now.getFullYear(), now.getMonth(), 1));
  const defaultRunEnd = window._adminPayrollRunEndDate || toLocalDateString(new Date(now.getFullYear(), now.getMonth() + 1, 0));
  window._adminPayrollRunStartDate = defaultRunStart;
  window._adminPayrollRunEndDate = defaultRunEnd;
  const activePayrollStart = defaultRunStart;
  const activePayrollEnd = defaultRunEnd;
  const activePayrollStartDate = activePayrollStart ? new Date(activePayrollStart + 'T00:00:00') : null;
  const activePayrollEndDate = activePayrollEnd ? new Date(activePayrollEnd + 'T23:59:59') : null;
  const sentPayslips = (s.payslips || []).filter(p => role === 'branch_manager' ? p.branchId === s.currentUser.branchId : true);
  const payrollRuns = role === 'branch_manager' ? [] : getPayrollRunsHistory();
  const filterStart = document.getElementById('admin-payslip-sent-start')?.value || '';
  const filterEnd = document.getElementById('admin-payslip-sent-end')?.value || '';

  function filterPayslipsByDateRange(items, startDate, endDate) {
    if (!startDate && !endDate) return items;
    const from = startDate ? new Date(startDate + 'T00:00:00') : null;
    const to = endDate ? new Date(endDate + 'T23:59:59') : null;
    return items.filter(p => {
      const bounds = parsePayrollPeriodBounds(p.periodKey, p.payPeriod);
      if (!bounds) return true;
      return (!from || bounds.end >= from) && (!to || bounds.start <= to);
    });
  }

  const sentPayslipsFiltered = filterPayslipsByDateRange(sentPayslips, filterStart, filterEnd);
  const filteredGross = sentPayslipsFiltered.reduce((sum, p) => sum + (p.grossPay || 0), 0);
  const filteredDeductions = sentPayslipsFiltered.reduce((sum, p) => sum + (p.deductions || 0), 0);
  const filteredNet = sentPayslipsFiltered.reduce((sum, p) => sum + (p.netPay || 0), 0);

  // Helper: check if a payslip was already sent for an employee+period
  function alreadySent(empId) {
    return sentPayslips.some(p => {
      if (p.userId !== empId) return false;
      const bounds = parsePayrollPeriodBounds(p.periodKey, p.payPeriod);
      if (bounds && bounds.start && bounds.end && activePayrollStartDate && activePayrollEndDate) {
        return bounds.start.getTime() === activePayrollStartDate.getTime() && bounds.end.getTime() === activePayrollEndDate.getTime();
      }
      if (p.payPeriod && currentPeriod.label && p.payPeriod === currentPeriod.label) return true;
      return false;
    });
  }

  // Compute current pay period key + label for display
  function currentPeriodInfo() {
    const start = activePayrollStartDate || new Date(now.getFullYear(), now.getMonth(), 1);
    const end = activePayrollEndDate || new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    const key = getPayrollDateRangeKey(activePayrollStart, activePayrollEnd) || `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${start.getDate() <= 15 ? 'A' : 'B'}`;
    const fmt2 = dt => dt.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
    const label = `${fmt2(start)} – ${fmt2(end)}, ${end.getFullYear()}`;
    const totalDays = Math.max(0, Math.round((end.setHours(0, 0, 0, 0) - start.setHours(0, 0, 0, 0)) / 86400000) + 1);
    return { key, label, startKey: getDateOnlyKey(start), endKey: getDateOnlyKey(end), totalDays, start, end };
  }
  const currentPeriod = currentPeriodInfo();
  if (!window._adminPayslipBranchId) window._adminPayslipBranchId = role === 'branch_manager' ? s.currentUser.branchId : (branches[0]?.id || '');
  const activeBranchId = role === 'branch_manager' ? s.currentUser.branchId : window._adminPayslipBranchId;
  const activeBranch = branches.find(b => b.id === activeBranchId);
  const visibleEmployees = employees.filter(emp => emp.branchId === activeBranchId);

  const genPayslipRows = () => visibleEmployees.map(emp => {
    const dailyRate = emp.dailyRate || 500;
    const daysPresent = getAttendanceDaysForRange(emp.id, currentPeriod.startKey, currentPeriod.endKey);
    const daysAbsent = Math.max(0, currentPeriod.totalDays - daysPresent);
    const calc = calcPayrollAmounts(daysPresent, dailyRate);
    const sent = alreadySent(emp.id);
    return `<tr>
      <td><strong>${emp.name || emp.username}</strong><br><span style="font-size:11px;color:var(--ink-60)">${emp.position || emp.role}</span></td>
      <td class="td-mono">₱${fmt(dailyRate)}</td>
      <td class="td-mono">${daysPresent}</td>
      <td class="td-mono" style="color:var(--danger)">${daysAbsent}</td>
      <td class="td-mono" style="color:var(--maroon);font-weight:600">₱${fmt(calc.gross)}</td>
      <td class="td-mono" style="color:var(--danger)">₱${fmt(calc.deductions)}</td>
      <td class="td-mono" style="color:var(--success);font-weight:700">₱${fmt(calc.net)}</td>
      <td>
        ${sent
        ? `<span class="badge badge-success" style="font-size:11px">✓ Sent</span>`
        : `<button class="btn btn-sm btn-outline" onclick="showPayslipDetailsModal('${emp.id}')">View Payslip</button>`
      }
      </td>
    </tr>`;
  }).join('');

  document.getElementById('page-content').innerHTML = `
    <div class="page-header" style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px">
      <div>
        <h1 class="page-title">Payslip Generation</h1>
        <p class="page-subtitle">Generate and send payslips by branch — <strong>${currentPeriod.label}</strong></p>
      </div>
    </div>
    <div class="data-card" style="margin-bottom:18px">
      <div class="data-card-header" style="justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap">
        <div>
          <span class="data-card-title">Create Payroll List</span>
          <div style="font-size:12px;color:var(--ink-60);margin-top:4px">Choose a payroll period, build the employee list, then generate payslips for everyone from the saved payroll.</div>
        </div>
        <button class="btn btn-maroon" onclick="showCreatePayrollPreviewModal()">${iconSvg('money')} Create Payroll</button>
      </div>
      <div class="data-card-body">
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;align-items:end">
          <div class="form-group" style="margin:0">
            <label class="form-label">Payroll Start Date</label>
            <input id="admin-payroll-run-start" type="date" class="form-control" value="${defaultRunStart}" onchange="setPayrollRunStartDate(this.value)">
          </div>
          <div class="form-group" style="margin:0">
            <label class="form-label">Payroll End Date</label>
            <input id="admin-payroll-run-end" type="date" class="form-control" value="${defaultRunEnd}" onchange="setPayrollRunEndDate(this.value)">
          </div>
          <div class="alert alert-info" style="margin:0">
            Payroll label: <strong>${getPayrollDateRangeLabel(defaultRunStart, defaultRunEnd)}</strong>
          </div>
        </div>
      </div>
    </div>
    ${payrollRuns.length ? `
    <div class="data-card" style="margin-bottom:18px">
      <div class="data-card-header"><span class="data-card-title">Saved Payroll Lists</span><span class="badge badge-neutral">${payrollRuns.length} payroll${payrollRuns.length !== 1 ? 's' : ''}</span></div>
      <div class="data-card-body no-pad">
        <table class="data-table">
          <thead><tr><th>Payroll Period</th><th>Pay Date Range</th><th>Employees</th><th>Total Net Pay</th><th>Payslips Sent</th><th>Status</th><th>Action</th></tr></thead>
          <tbody>${payrollRuns.map(run => `<tr>
            <td><strong>${run.periodLabel || getPayrollDateRangeLabel(run.periodStart, run.periodEnd)}</strong></td>
            <td class="td-mono">${run.periodStart} → ${run.periodEnd}</td>
            <td class="td-mono">${run.employeeCount || 0}</td>
            <td class="td-mono" style="color:var(--success);font-weight:600">PHP ${fmt(run.totalNet || 0)}</td>
            <td class="td-mono">${run.payslipsSentCount || 0} / ${run.employeeCount || 0}</td>
            <td>${getPayrollStatusBadge(run.status)}</td>
            <td><button class="btn btn-sm btn-outline" onclick="viewPayrollRunDetails('${run.id}')">View</button> <button class="btn btn-sm btn-maroon" onclick="sendPayrollRunPayslips('${run.id}')">Send All</button> <button class="btn btn-sm btn-danger" onclick="deletePayrollRun('${run.id}')">Delete</button></td>
          </tr>`).join('')}</tbody>
        </table>
      </div>
    </div>` : ''}
    <div class="data-card" style="margin-bottom:18px">
      <div class="data-card-header"><span class="data-card-title">Branches</span></div>
      <div class="data-card-body" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px">
        ${branches.map(branch => {
    const branchEmployees = employees.filter(emp => emp.branchId === branch.id);
    const active = branch.id === activeBranchId;
    return `<button class="btn ${active ? 'btn-maroon' : 'btn-outline'}" style="justify-content:space-between;padding:14px 16px" onclick="selectAdminPayslipBranch('${branch.id}')">
            <span>${branch.name}</span>
            <span>${branchEmployees.length}</span>
          </button>`;
  }).join('') || '<div style="color:var(--ink-60)">No branches available.</div>'}
      </div>
    </div>
    <div class="data-card">
      <div class="data-card-header">
        <span class="data-card-title">Employee Payroll — ${(activeBranch?.name || 'No Branch Selected')} · ${monthLabel}</span>
        <span style="display:flex;align-items:center;gap:8px">
          <span style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:var(--ink-60)">Pay Period:</span>
          <span style="background:var(--maroon);color:#fff;padding:3px 10px;border-radius:99px;font-size:12px;font-weight:700">${currentPeriod.label}</span>
        </span>
      </div>
      ${branchApprovedRows.length ? `<div class="data-card-body"><div class="alert alert-success" style="margin:0">${iconSvg('check')} Showing approved payroll submission for ${activeBranch?.name || 'selected branch'}.</div></div>` : `<div class="data-card-body"><div class="alert alert-warning" style="margin:0">${iconSvg('info')} No approved payroll submission found for this branch and date range. Only approved branch payrolls can be included.</div></div>`}
      <div class="data-card-body" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;align-items:end;padding-bottom:0">
        <div class="form-group" style="margin:0">
          <label class="form-label">Payroll Start Date</label>
          <input id="admin-payroll-run-start" type="date" class="form-control" value="${defaultRunStart}" onchange="setPayrollRunStartDate(this.value)">
        </div>
        <div class="form-group" style="margin:0">
          <label class="form-label">Payroll End Date</label>
          <input id="admin-payroll-run-end" type="date" class="form-control" value="${defaultRunEnd}" onchange="setPayrollRunEndDate(this.value)">
        </div>
        <div class="alert alert-info" style="margin:0">
          Payroll label: <strong>${getPayrollDateRangeLabel(defaultRunStart, defaultRunEnd)}</strong>
        </div>
      </div>
      <div class="data-card-body no-pad">
        <table class="data-table">
          <thead><tr>
            <th>Employee</th><th>Daily Rate</th><th>Days Present</th>
            <th>Days Absent</th><th>Gross Pay</th><th>Deductions</th>
            <th>Net Pay</th><th>Action</th>
          </tr></thead>
          <tbody>${visibleEmployees.length ? genPayslipRows() : '<tr><td colspan="8" style="text-align:center;padding:32px;color:var(--ink-60)">No employees found in this branch.</td></tr>'}</tbody>
        </table>
      </div>
    </div>
    <div class="data-card" style="margin-top:20px">
      <div class="data-card-header" style="flex-direction:column;gap:12px;">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">
          <span class="data-card-title">Sent Payslips History</span>
          <span class="badge badge-neutral">${sentPayslipsFiltered.length} of ${sentPayslips.length} sent</span>
        </div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
          <label style="font-size:13px;color:var(--ink-70);margin:0;">Filter by sent period:</label>
          <input class="form-control" type="date" id="admin-payslip-sent-start" value="${filterStart}" style="width:160px;font-size:13px;" onchange="renderAdminPayslipGen()">
          <span style="font-size:13px;color:var(--ink-50);">to</span>
          <input class="form-control" type="date" id="admin-payslip-sent-end" value="${filterEnd}" style="width:160px;font-size:13px;" onchange="renderAdminPayslipGen()">
          <button class="btn btn-sm btn-outline" style="white-space:nowrap" onclick="document.getElementById('admin-payslip-sent-start').value='';document.getElementById('admin-payslip-sent-end').value='';renderAdminPayslipGen()">Clear</button>
        </div>
      </div>
      <div class="data-card-body">
        <div class="payroll-summary">
          <div class="payroll-item"><label>Payslips in Range</label><strong>${sentPayslipsFiltered.length}</strong></div>
          <div class="payroll-item"><label>Total Gross</label><strong>PHP ${fmt(filteredGross)}</strong></div>
          <div class="payroll-item"><label>Total Deductions</label><strong style="color:var(--danger)">PHP ${fmt(filteredDeductions)}</strong></div>
          <div class="payroll-item"><label>Total Net Pay</label><strong style="color:var(--success)">PHP ${fmt(filteredNet)}</strong></div>
        </div>
      </div>
      <div class="data-card-body no-pad">
        <table class="data-table">
          <thead><tr><th>Employee</th><th>Pay Period</th><th>Gross Pay</th><th>Deductions</th><th>Net Pay</th><th>Sent At</th><th>Action</th></tr></thead>
          <tbody>${sentPayslipsFiltered.length ? [...sentPayslipsFiltered].map(p => `<tr>
            <td><strong>${p.employeeName}</strong></td>
            <td>${p.payPeriod}</td>
            <td class="td-mono" style="color:var(--success);font-weight:700">₱${fmt(p.netPay)}</td>
            <td class="td-mono" style="font-size:12px">${p.sentAt ? fmtTime(p.sentAt) : '—'}</td>
            <td>
              <button class="btn btn-sm btn-outline" onclick="adminViewSentPayslipModal('${p.id}')">View</button>
              <button class="btn btn-sm btn-danger" onclick="adminDeletePayslip('${p.id}','${(p.employeeName || '').replace(/'/g, '')}')" style="margin-left:4px">Retract</button>
            </td>
          </tr>`).join('') : '<tr><td colspan="5" style="text-align:center;padding:24px;color:var(--ink-60)">No payslips match the selected date range.</td></tr>'}</tbody>
        </table>
      </div>
    </div>`;
}

// ── +Payslip Details modal — manual entry form ─────────────────────────────
function renderAdminPayslipGen() {
  const s = getState();
  const role = normalizeRole(s.currentUser?.role);
  if (!s.currentUser || !['admin', 'hr', 'branch_manager'].includes(role)) { accessDenied('Payslip Generation'); return; }

  const employees = (s.users || []).filter(user => {
    const userRole = normalizeRole(user.role);
    if (userRole === 'admin') return false;
    if (role === 'branch_manager') return user.branchId === s.currentUser.branchId && !['hr', 'branch_manager'].includes(userRole);
    return true;
  });
  const branches = (s.branches || []).filter(branch => {
    if (role === 'branch_manager') return branch.id === s.currentUser.branchId;
    return branch.active !== false;
  });
  const payrollRuns = role === 'branch_manager' ? [] : getPayrollRunsHistory().filter(run => run.status !== 'sent');
  const now = new Date();
  const monthLabel = now.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' });
  const isAdminOrHr = role === 'admin' || role === 'hr';
  const payslipHistoryFilters = {
    startDate: document.getElementById('payslip-start-date')?.value || '',
    endDate: document.getElementById('payslip-end-date')?.value || '',
    selectedBranchId: document.getElementById('payslip-branch-filter')?.value || '',
  };
  const basePayslips = isAdminOrHr
    ? (s.payslips || [])
    : (s.payslips || []).filter(p => p.branchId === s.currentUser.branchId);

  const selectedRunStart = window._adminPayrollRunStartDate || '';
  const selectedRunEnd = window._adminPayrollRunEndDate || '';
  const selectedRunStartDate = selectedRunStart ? new Date(selectedRunStart + 'T00:00:00') : null;
  const selectedRunEndDate = selectedRunEnd ? new Date(selectedRunEnd + 'T23:59:59') : null;

  function filterPayslipsByDateRange(items, startDate, endDate) {
    if (!startDate && !endDate) return items;
    const from = startDate ? new Date(startDate + 'T00:00:00') : null;
    const to = endDate ? new Date(endDate + 'T23:59:59') : null;
    return items.filter(item => {
      const bounds = parsePayrollPeriodBounds(item.periodKey, item.payPeriod);
      if (!bounds) return true;
      return (!from || bounds.end >= from) && (!to || bounds.start <= to);
    });
  }

  function alreadySent(empId) {
    return (s.payslips || []).some(p => {
      if (p.userId !== empId) return false;
      const bounds = parsePayrollPeriodBounds(p.periodKey, p.payPeriod);
      if (bounds && selectedRunStartDate && selectedRunEndDate) {
        return bounds.start.getTime() === selectedRunStartDate.getTime() && bounds.end.getTime() === selectedRunEndDate.getTime();
      }
      if (p.periodKey && p.periodKey === currentPeriod.key) return true;
      if (p.payPeriod && currentPeriod.label && p.payPeriod === currentPeriod.label) return true;
      return false;
    });
  }

  function currentPeriodInfo() {
    const year = now.getFullYear();
    const month = now.getMonth();
    const half = now.getDate() <= 15 ? 'A' : 'B';
    const defaultKey = `${year}-${String(month + 1).padStart(2, '0')}-${half}`;
    const defaultBounds = parsePayrollPeriodBounds(defaultKey) || {
      start: new Date(year, month, half === 'A' ? 1 : 16),
      end: new Date(year, half === 'A' ? month : month + 1, half === 'A' ? 15 : 0, 23, 59, 59),
    };
    const start = selectedRunStartDate || defaultBounds.start;
    const end = selectedRunEndDate || defaultBounds.end;
    const key = (selectedRunStart && selectedRunEnd) ? getPayrollDateRangeKey(selectedRunStart, selectedRunEnd) : defaultKey;
    const shortFmt = date => date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
    return {
      key,
      startKey: getDateOnlyKey(start),
      endKey: getDateOnlyKey(end),
      totalDays: Math.max(1, Math.round((new Date(end).setHours(0, 0, 0, 0) - new Date(start).setHours(0, 0, 0, 0)) / 86400000) + 1),
      label: `${shortFmt(start)} - ${shortFmt(end)}, ${end.getFullYear()}`,
    };
  }

  const currentPeriod = currentPeriodInfo();
  if (!window._adminPayslipBranchId) window._adminPayslipBranchId = role === 'branch_manager' ? s.currentUser.branchId : (branches[0]?.id || '');
  const activeBranchId = role === 'branch_manager' ? s.currentUser.branchId : window._adminPayslipBranchId;
  const activeBranch = branches.find(branch => branch.id === activeBranchId);
  const visibleEmployees = employees.filter(emp => emp.branchId === activeBranchId);

  const defaultRunStart = window._adminPayrollRunStartDate || currentPeriod.startKey || toLocalDateString(new Date(now.getFullYear(), now.getMonth(), 1));
  const defaultRunEnd = window._adminPayrollRunEndDate || currentPeriod.endKey || toLocalDateString(new Date(now.getFullYear(), now.getMonth() + 1, 0));
  window._adminPayrollRunStartDate = defaultRunStart;
  window._adminPayrollRunEndDate = defaultRunEnd;
  const branchApprovedRows = getApprovedBranchSubmissionPayrollRows(defaultRunStart, defaultRunEnd, activeBranchId);
  const pendingEmployees = branchApprovedRows.filter(row => !alreadySent(row.userId));

  function datesOverlap(startA, endA, startB, endB) {
    return !(endA < startB || startA > endB);
  }

  function parseRunBounds(run) {
    const bounds = parsePayrollPeriodBounds(run.periodKey, run.periodLabel || run.payPeriod || getPayrollDateRangeLabel(run.periodStart, run.periodEnd));
    if (!bounds) return null;
    return bounds;
  }

  const selectedStart = defaultRunStart ? new Date(defaultRunStart + 'T00:00:00') : null;
  const selectedEnd = defaultRunEnd ? new Date(defaultRunEnd + 'T23:59:59') : null;
  const overlappingRun = selectedStart && selectedEnd
    ? getPayrollRunsHistory().find(run => {
      const bounds = parseRunBounds(run);
      return bounds && datesOverlap(selectedStart, selectedEnd, bounds.start, bounds.end);
    })
    : null;

  const payrollOverlapWarning = overlappingRun
    ? `<div class="alert alert-warning" style="margin-bottom:18px;">⚠️ This payroll range overlaps with an existing payroll list for <strong>${overlappingRun.periodLabel || getPayrollDateRangeLabel(overlappingRun.periodStart, overlappingRun.periodEnd)}</strong>. Creating a payroll with overlapping dates may create duplicate or conflicting payroll entries.</div>`
    : '';

  const branchFilteredPayslips = payslipHistoryFilters.selectedBranchId
    ? basePayslips.filter(p => p.branchId === payslipHistoryFilters.selectedBranchId)
    : basePayslips;
  const historyPayslips = filterPayslipsByDateRange(branchFilteredPayslips, payslipHistoryFilters.startDate, payslipHistoryFilters.endDate);
  const totalGross = historyPayslips.reduce((sum, p) => sum + (p.grossPay || 0), 0);
  const totalDeductions = historyPayslips.reduce((sum, p) => sum + (p.deductions || 0), 0);
  const totalNet = historyPayslips.reduce((sum, p) => sum + (p.netPay || 0), 0);
  const showBranchCol = true;
  const colSpan = showBranchCol ? 8 : 7;
  const branchOptions = isAdminOrHr
    ? branches.map(b => `<option value="${b.id}" ${payslipHistoryFilters.selectedBranchId === b.id ? 'selected' : ''}>${b.name}</option>`).join('')
    : branches.filter(b => b.id === s.currentUser.branchId).map(b => `<option value="${b.id}" ${payslipHistoryFilters.selectedBranchId === b.id ? 'selected' : ''}>${b.name}</option>`).join('');
  const historyRows = historyPayslips.length
    ? historyPayslips.map(p => {
      const branchName = showBranchCol ? ((branches.find(b => b.id === p.branchId)?.name) || '—') : '';
      return `<tr>
          <td><strong>${p.payPeriod}</strong></td>
          <td>${p.employeeName || '—'}</td>
          ${showBranchCol ? `<td><span class="badge badge-neutral" style="font-size:11px">${branchName}</span></td>` : ''}
          <td class="td-mono">${p.daysPresent || '—'}</td>
          <td class="td-mono">₱${fmt(p.grossPay || 0)}</td>
          <td class="td-mono" style="color:var(--danger)">₱${fmt(p.deductions || 0)}</td>
          <td class="td-mono" style="color:var(--success);font-weight:700">₱${fmt(p.netPay || 0)}</td>
          <td><button class="btn btn-sm btn-maroon" onclick="adminViewSentPayslipModal('${p.id}')">${iconSvg('printer')} View</button></td>
        </tr>`;
    }).join('')
    : `<tr><td colspan="${colSpan}" style="text-align:center;color:var(--ink-40);padding:40px">No payslip history available for the selected filters.</td></tr>`;

  const genPayslipRows = () => pendingEmployees.map(row => {
    const dailyRate = row.dailyRate || 500;
    const daysPresent = row.attendanceDays || 0;
    const daysAbsent = Math.max(0, currentPeriod.totalDays - daysPresent);
    return `<tr>
      <td><strong>${row.name}</strong><br><span style="font-size:11px;color:var(--ink-60)">${getRoleLabel(row.role)}</span></td>
      <td class="td-mono">PHP ${fmt(dailyRate)}</td>
      <td class="td-mono">${daysPresent}</td>
      <td class="td-mono" style="color:var(--danger)">${daysAbsent}</td>
      <td class="td-mono" style="color:var(--maroon);font-weight:600">PHP ${fmt(row.gross)}</td>
      <td class="td-mono" style="color:var(--danger)">PHP ${fmt(row.deductions)}</td>
      <td class="td-mono" style="color:var(--success);font-weight:700">PHP ${fmt(row.net)}</td>
      <td><button class="btn btn-sm btn-outline" onclick="showPayslipDetailsModal('${row.userId}')">View Payslip</button></td>
    </tr>`;
  }).join('');

  document.getElementById('page-content').innerHTML = `
    <div class="page-header" style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px">
      <div>
        <h1 class="page-title">Payslip Generation</h1>
        <p class="page-subtitle">Generate and send payslips by branch - <strong>${currentPeriod.label}</strong></p>
      </div>
    </div>
    <div class="data-card" style="margin-bottom:18px">
      <div class="data-card-header" style="justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap">
        <div>
          <span class="data-card-title">Create Payroll List</span>
          <div style="font-size:12px;color:var(--ink-60);margin-top:4px">Choose a payroll period, build the employee list, then generate payslips for everyone from the saved payroll.</div>
        </div>
        <button class="btn btn-maroon" onclick="showCreatePayrollPreviewModal()">${iconSvg('money')} Create Payroll</button>
      </div>
      <div class="data-card-body">
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;align-items:end">
          <div class="form-group" style="margin:0">
            <label class="form-label">Payroll Start Date</label>
            <input id="admin-payroll-run-start" type="date" class="form-control" value="${defaultRunStart}" onchange="setPayrollRunStartDate(this.value)">
          </div>
          <div class="form-group" style="margin:0">
            <label class="form-label">Payroll End Date</label>
            <input id="admin-payroll-run-end" type="date" class="form-control" value="${defaultRunEnd}" onchange="setPayrollRunEndDate(this.value)">
          </div>
          <div class="alert alert-info" style="margin:0">
            Payroll label: <strong>${getPayrollDateRangeLabel(defaultRunStart, defaultRunEnd)}</strong>
          </div>
        </div>
        ${payrollOverlapWarning}
      </div>
    </div>
    ${payrollRuns.length ? `
    <div class="data-card" style="margin-bottom:18px">
      <div class="data-card-header"><span class="data-card-title">Saved Payroll Lists</span><span class="badge badge-neutral">${payrollRuns.length} payroll${payrollRuns.length !== 1 ? 's' : ''}</span></div>
      <div class="data-card-body no-pad">
        <table class="data-table">
          <thead><tr><th>Payroll Period</th><th>Pay Date Range</th><th>Employees</th><th>Total Net Pay</th><th>Payslips Sent</th><th>Status</th><th>Action</th></tr></thead>
          <tbody>${payrollRuns.map(run => `<tr>
            <td><strong>${run.periodLabel || getPayrollDateRangeLabel(run.periodStart, run.periodEnd)}</strong></td>
            <td class="td-mono">${run.periodStart} → ${run.periodEnd}</td>
            <td class="td-mono">${run.employeeCount || 0}</td>
            <td class="td-mono" style="color:var(--success);font-weight:600">PHP ${fmt(run.totalNet || 0)}</td>
            <td class="td-mono">${run.payslipsSentCount || 0} / ${run.employeeCount || 0}</td>
            <td>${getPayrollStatusBadge(run.status)}</td>
            <td><button class="btn btn-sm btn-outline" onclick="viewPayrollRunDetails('${run.id}')">View</button> <button class="btn btn-sm btn-maroon" onclick="sendPayrollRunPayslips('${run.id}')">Send All</button> <button class="btn btn-sm btn-danger" onclick="deletePayrollRun('${run.id}')">Delete</button></td>
          </tr>`).join('')}</tbody>
        </table>
      </div>
    </div>` : ''}
    <div class="data-card" style="margin-bottom:18px">
      <div class="data-card-header"><span class="data-card-title">Branches</span></div>
      <div class="data-card-body" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px">
        ${branches.map(branch => {
    const branchEmployees = employees.filter(emp => emp.branchId === branch.id);
    const active = branch.id === activeBranchId;
    return `<button class="btn ${active ? 'btn-maroon' : 'btn-outline'}" style="justify-content:space-between;padding:14px 16px" onclick="selectAdminPayslipBranch('${branch.id}')">
            <span>${branch.name}</span>
            <span>${branchEmployees.length}</span>
          </button>`;
  }).join('') || '<div style="color:var(--ink-60)">No branches available.</div>'}
      </div>
    </div>
    <div class="data-card">
      <div class="data-card-header">
        <span class="data-card-title">Employee Payroll - ${(activeBranch?.name || 'No Branch Selected')} · ${monthLabel}</span>
        <span style="display:flex;align-items:center;gap:8px">
          <span style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:var(--ink-60)">Pay Period:</span>
          <span style="background:var(--maroon);color:#fff;padding:3px 10px;border-radius:99px;font-size:12px;font-weight:700">${currentPeriod.label}</span>
        </span>
      </div>
      <div class="data-card-body no-pad">
        <table class="data-table">
          <thead><tr><th>Employee</th><th>Daily Rate</th><th>Days Present</th><th>Days Absent</th><th>Gross Pay</th><th>Deductions</th><th>Net Pay</th><th>Action</th></tr></thead>
          <tbody>${pendingEmployees.length ? genPayslipRows() : '<tr><td colspan="8" style="text-align:center;padding:32px;color:var(--ink-60)">No pending payslips found in this branch.</td></tr>'}</tbody>
        </table>
      </div>
    </div>
    <div class="data-card" style="margin-top:20px">
      <div class="data-card-header" style="flex-direction:column;gap:12px;">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">
          <span class="data-card-title">Payslip History</span>
          <span class="badge badge-neutral">${historyPayslips.length} payslip${historyPayslips.length !== 1 ? 's' : ''}</span>
        </div>
        <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;">
          <label style="font-size:13px;color:var(--ink-70);">Filter by Branch:</label>
          <select id="payslip-branch-filter" class="form-control" style="width:180px;font-size:13px;" onchange="renderAdminPayslipGen()">
            <option value="">All Branches</option>
            ${branchOptions}
          </select>
          <label style="font-size:13px;color:var(--ink-70);">Date Range:</label>
          <div style="display:flex;gap:8px;align-items:center;">
            <input type="date" id="payslip-start-date" class="form-control" style="width:140px;font-size:13px;" value="${payslipHistoryFilters.startDate}" onchange="renderAdminPayslipGen()">
            <span style="font-size:13px;color:var(--ink-50);">to</span>
            <input type="date" id="payslip-end-date" class="form-control" style="width:140px;font-size:13px;" value="${payslipHistoryFilters.endDate}" onchange="renderAdminPayslipGen()">
            <button class="btn btn-sm btn-outline" onclick="document.getElementById('payslip-start-date').value='';document.getElementById('payslip-end-date').value='';document.getElementById('payslip-branch-filter').value='';renderAdminPayslipGen()">Clear All</button>
          </div>
        </div>
      </div>
      <div class="data-card-body">
        <div class="payroll-summary">
          <div class="payroll-item"><label>Payslips in Range</label><strong>${historyPayslips.length}</strong></div>
          <div class="payroll-item"><label>Total Gross</label><strong>PHP ${fmt(totalGross)}</strong></div>
          <div class="payroll-item"><label>Total Deductions</label><strong style="color:var(--danger)">PHP ${fmt(totalDeductions)}</strong></div>
          <div class="payroll-item"><label>Total Net Pay</label><strong style="color:var(--success)">PHP ${fmt(totalNet)}</strong></div>
        </div>
      </div>
      <div class="data-card-body no-pad">
        <table class="data-table">
          <thead><tr>
            <th>Period</th>
            <th>Name</th>
            ${showBranchCol ? '<th>Branch</th>' : ''}
            <th>Days Worked</th>
            <th>Gross Pay</th>
            <th>Deductions</th>
            <th>Net Pay</th>
            <th>Action</th>
          </tr></thead>
          <tbody>${historyRows}</tbody>
        </table>
      </div>
    </div>`;
}

function showPayslipDetailsModal(empId) {
  const s = getState();
  const emp = s.users.find(u => u.id === empId);
  if (!emp) { showToast('Employee not found.', 'error'); return; }

  const branchId = window._adminPayslipBranchId || emp.branchId;
  const branch = s.branches.find(b => b.id === branchId) || {};
  const startDate = window._adminPayrollRunStartDate || '';
  const endDate = window._adminPayrollRunEndDate || '';
  const payPeriod = (startDate && endDate) ? getPayrollDateRangeLabel(startDate, endDate) : getPayrollDateRangeLabel(new Date(), new Date());
  const bounds = window._adminPayrollRunStartDate && window._adminPayrollRunEndDate ? `${startDate} → ${endDate}` : '';
  const now = new Date();
  const payDateStr = now.toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' });

  const approvedRow = (startDate && endDate)
    ? getApprovedBranchSubmissionPayrollRows(startDate, endDate, branchId).find(r => r.userId === empId)
    : null;

  const dailyRate = approvedRow?.dailyRate || emp.dailyRate || 500;
  const daysPresent = approvedRow?.attendanceDays || 0;
  const { gross, sss, phic, hdmf, deductions, net } = calcPayrollAmounts(daysPresent, dailyRate);
  const employeeNumber = emp.employeeNumber || ('EMP-' + String(emp.id || '1').replace(/\D/g, '').padStart(3, '0'));
  const positionLabel = ['cashier', 'branch_manager', 'inventory_staff'].includes(normalizeRole(emp.role))
    ? 'Branch Personnel'
    : normalizeRole(emp.role) === 'print' ? 'Printing Personnel' : (emp.role || '');

  const html = `
    <div class="payslip-card">
      <div class="payslip-card-header">
        <div class="payslip-card-logo"><img src="logo.png" alt="South Pafps" onerror="this.style.display='none'"></div>
        <div class="payslip-card-company">
          <div class="payslip-card-company-name">${getCompanyInfo().name}</div>
          <div class="payslip-card-company-address">${getCompanyInfo().address1}<br>${getCompanyInfo().address2}<br>${getCompanyInfo().tel}</div>
        </div>
      </div>
      <div class="payslip-card-title">PAYSLIP</div>
      <table class="payslip-card-table">
        <colgroup><col style="width:22%"><col style="width:28%"><col style="width:22%"><col style="width:28%"></colgroup>
        <tbody>
          <tr><td><strong>Employee Name:</strong></td><td>${emp.name || emp.username || '—'}</td><td><strong>SSS Number:</strong></td><td>${emp.sss || '—'}</td></tr>
          <tr><td><strong>Employee Number:</strong></td><td>${employeeNumber}</td><td><strong>PhilHealth Number:</strong></td><td>${emp.philhealth || '—'}</td></tr>
          <tr><td><strong>Position:</strong></td><td>${positionLabel}</td><td><strong>Pag-IBIG Number:</strong></td><td>${emp.pagibig || '—'}</td></tr>
          <tr><td><strong>Pay Period:</strong></td><td>${payPeriod}</td><td><strong>TIN Number:</strong></td><td>${emp.tin || '—'}</td></tr>
          <tr><td><strong>Pay Date:</strong></td><td>${payDateStr}</td><td></td><td></td></tr>
        </tbody>
      </table>
      <table class="payslip-card-table payslip-card-earnings">
        <colgroup><col style="width:40%"><col style="width:12%"><col style="width:20%"><col style="width:4px"><col style="width:16%"><col style="width:8%"></colgroup>
        <thead>
          <tr>
            <th colspan="3">EARNINGS/INCOME</th>
            <th></th>
            <th colspan="2">DEDUCTIONS</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Basic Pay @ ₱${fmt(dailyRate)}/day</td>
            <td class="td-mono">${daysPresent}</td>
            <td class="td-mono">₱${fmt(gross)}</td>
            <td class="payslip-divider"></td>
            <td>SSS EE Contribution</td>
            <td class="td-mono">₱${fmt(sss)}</td>
          </tr>
          <tr>
            <td></td>
            <td></td>
            <td></td>
            <td class="payslip-divider"></td>
            <td>PhilHealth EE Contribution</td>
            <td class="td-mono">₱${fmt(phic)}</td>
          </tr>
          <tr>
            <td></td>
            <td></td>
            <td></td>
            <td class="payslip-divider"></td>
            <td>Pag-IBIG Contribution</td>
            <td class="td-mono">₱${fmt(hdmf)}</td>
          </tr>
        </tbody>
        <tfoot>
          <tr>
            <td colspan="3" class="payslip-summary-label">GROSS PAY</td>
            <td class="payslip-divider"></td>
            <td class="payslip-summary-label">TOTAL DEDUCTION</td>
            <td class="td-mono">₱${fmt(deductions)}</td>
          </tr>
          <tr>
            <td colspan="3"></td>
            <td class="payslip-divider"></td>
            <td class="payslip-summary-label">NET PAY</td>
            <td class="td-mono">₱${fmt(net)}</td>
          </tr>
        </tfoot>
      </table>
      ${bounds ? `<div class="payslip-card-note">Notes: Generated from payroll list for ${bounds}.</div>` : ''}
    </div>`;

  showModal(`
    <div class="modal-header"><h2>📄 Payslip — ${emp.name || emp.username}</h2><button class="btn-close-modal" onclick="closeModal()">✕</button></div>
    <div class="modal-body" id="payslip-modal-doc" style="padding:20px;max-height:80vh;overflow-y:auto;">${html}</div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeModal()">Close</button>
      <button class="btn btn-maroon" onclick="printContent(document.getElementById('payslip-modal-doc').innerHTML,'Payslip — ${emp.name ? emp.name.replace(/'/g, '') : 'Employee'}')">${iconSvg('printer')} Print</button>
    </div>
  `, 'modal-lg');
}

function selectAdminPayslipBranch(branchId) {
  window._adminPayslipBranchId = branchId;
  renderAdminPayslipGen();
}

function psAutoFillRate() {
  const sel = document.getElementById('ps-employee');
  const opt = sel.options[sel.selectedIndex];
  const rate = opt ? (opt.dataset.rate || 500) : 500;
  document.getElementById('ps-daily-rate').value = rate;
  psAutoComputeFromPeriod();
}

function psAutoComputeFromPeriod() {
  const s = getState();
  const empId = document.getElementById('ps-employee')?.value;
  const periodSel = document.getElementById('ps-period');
  const periodKey = periodSel?.value;
  if (!empId || !periodKey) { psRecalc(); return; }

  // Parse period key: YYYY-MM-A or YYYY-MM-B
  const [year, month, half] = periodKey.split('-');
  const y = parseInt(year), m = parseInt(month) - 1;
  const startDay = half === 'A' ? 1 : 16;
  const endDay = half === 'A' ? 15 : new Date(y, m + 1, 0).getDate();
  const periodStart = new Date(y, m, startDay);
  const periodEnd = new Date(y, m, endDay, 23, 59, 59);

  // Count attendance records within this period
  const attRecords = (s.attendanceRecords || []).filter(r => {
    if (r.userId !== empId || !r.timeIn || !r.timeOut) return false;
    const d = new Date(r.timeIn);
    return d >= periodStart && d <= periodEnd;
  });

  const daysPresent = attRecords.length;
  const workingDays = endDay - startDay + 1;
  const daysAbsent = Math.max(0, workingDays - daysPresent);

  const dpEl = document.getElementById('ps-days-present');
  const daEl = document.getElementById('ps-days-absent');
  if (dpEl) dpEl.value = daysPresent;
  if (daEl) daEl.value = daysAbsent;
  psRecalc();
}

function psRecalc() {
  const dailyRate = parseFloat(document.getElementById('ps-daily-rate')?.value) || 0;
  const daysPresent = parseFloat(document.getElementById('ps-days-present')?.value) || 0;
  const incentives = parseFloat(document.getElementById('ps-incentives')?.value) || 0;
  const basicPay = daysPresent * dailyRate;
  const grossPay = basicPay + incentives;
  const sss = grossPay > 0 ? Math.round(grossPay * 0.045) : 0;
  const phic = grossPay > 0 ? Math.round(grossPay * 0.025) : 0;
  const hdmf = grossPay > 0 ? Math.min(100, Math.round(grossPay * 0.02)) : 0;
  const deductions = sss + phic + hdmf;
  const netPay = grossPay - deductions;
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set('ps-gross', '₱' + fmt(grossPay));
  set('ps-sss', '- ₱' + fmt(sss));
  set('ps-phic', '- ₱' + fmt(phic));
  set('ps-hdmf', '- ₱' + fmt(hdmf));
  set('ps-net', '₱' + fmt(netPay));
}

async function psSubmitPayslip() {
  const s = getState();
  const empId = document.getElementById('ps-employee')?.value;
  const periodKey = document.getElementById('ps-period')?.value;
  const periodSel = document.getElementById('ps-period');
  const periodLabel = periodSel?.options[periodSel.selectedIndex]?.dataset.label || periodKey;
  const dailyRate = parseFloat(document.getElementById('ps-daily-rate')?.value) || 0;
  const daysPresent = parseInt(document.getElementById('ps-days-present')?.value) || 0;
  const daysAbsent = parseInt(document.getElementById('ps-days-absent')?.value) || 0;
  const incentives = parseFloat(document.getElementById('ps-incentives')?.value) || 0;
  const notes = document.getElementById('ps-notes')?.value?.trim() || '';

  if (!empId) { showToast('Please select an employee.', 'error'); return; }
  if (!periodKey) { showToast('Please select a pay period.', 'error'); return; }
  if (!daysPresent && !incentives) { showToast('Please enter days present or incentives.', 'error'); return; }

  const emp = s.users.find(u => u.id === empId);
  if (!emp) { showToast('Employee not found.', 'error'); return; }

  const grossPay = daysPresent * dailyRate + incentives;
  const sss = grossPay > 0 ? Math.round(grossPay * 0.045) : 0;
  const phic = grossPay > 0 ? Math.round(grossPay * 0.025) : 0;
  const hdmf = grossPay > 0 ? Math.min(100, Math.round(grossPay * 0.02)) : 0;
  const deductions = sss + phic + hdmf;
  const netPay = grossPay - deductions;
  const now = new Date().toISOString();

  const payslip = {
    id: 'pslip_' + Date.now(),
    userId: empId,
    employeeName: emp.name || emp.username,
    payPeriod: periodLabel,
    periodKey,
    dailyRate,
    daysPresent,
    daysAbsent,
    incentives,
    grossPay,
    deductions,
    sss,
    philhealth: phic,
    hdmf,
    netPay,
    notes,
    sentBy: s.currentUser?.id || 'admin',
    sentAt: now,
    branchId: emp.branchId || null,
  };

  try {
    await DB.sendPayslip(payslip);
    // Update local state
    s.payslips = [payslip, ...(s.payslips || [])];
    saveState(s);
    closeModal();
    showToast(`Payslip sent to ${emp.name || emp.username} for ${periodLabel}!`, 'success');
    renderAdminPayslipGen();
  } catch (e) {
    showToast('Failed to send payslip: ' + e.message, 'error');
  }
}

function adminViewSentPayslipModal(payslipId) {
  const s = getState();
  const p = (s.payslips || []).find(x => x.id === payslipId);
  if (!p) { showToast('Payslip not found.', 'error'); return; }
  const emp = s.users.find(u => u.id === p.userId) || {};
  const branch = s.branches.find(b => b.id === (p.branchId || emp.branchId));
  const COMPANY = getCompanyInfo();
  const empNum = emp.employeeNumber || ('EMP-' + String(emp.id || '001').replace(/\D/g, '').padStart(3, '0'));
  const positionLabel = ['cashier', 'branch_manager', 'inventory_staff'].includes(normalizeRole(emp.role)) ? 'Branch Personnel' : normalizeRole(emp.role) === 'print' ? 'Printing Personnel' : (emp.role || '');
  const payDateStr = p.sentAt ? new Date(p.sentAt).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' }) : '—';
  const basicPay = p.daysPresent * p.dailyRate;
  const commissionCupsQty = p.commissionCupsQty ?? (p.incentives > 0 ? 1 : 0);
  const commissionCupsAmt = p.commissionCupsAmt ?? (p.incentives > 0 ? p.incentives : 0);
  const commissionGpQty = p.commissionGpQty ?? 0;
  const commissionGpAmt = p.commissionGpAmt ?? 0;
  // Build a lightweight payslip view from stored data
  const html = `<div style="font-family:'Arial',sans-serif;font-size:12px;color:#111;padding:24px 32px;">
    <div style="display:flex;align-items:flex-start;gap:24px;margin-bottom:16px;">
      <div style="flex-shrink:0;width:90px;"><img src="logo.png" alt="South Pafps" style="width:90px;height:auto;display:block;" onerror="this.style.display='none'"></div>
      <div style="flex:1;padding-top:4px;"><div style="font-weight:700;font-size:13px;margin-bottom:4px;">${COMPANY.name}</div><div style="font-size:11px;line-height:1.8;color:#333;">${COMPANY.address1}<br>${COMPANY.address2}<br>${COMPANY.tel}</div></div>
    </div>
    <div style="text-align:center;font-weight:700;font-size:13px;letter-spacing:3px;margin:0 0 10px;">PAYSLIP</div>
    <table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:0;">
      <colgroup><col style="width:20%"><col style="width:30%"><col style="width:20%"><col style="width:30%"></colgroup>
      <tbody>
        <tr><td style="padding:4px 8px;border:1px solid #999;"><strong>Employee Name:</strong></td><td style="padding:4px 8px;border:1px solid #999;">${p.employeeName}</td><td style="padding:4px 8px;border:1px solid #999;"><strong>SSS Number:</strong></td><td style="padding:4px 8px;border:1px solid #999;">${emp.sss || ''}</td></tr>
        <tr><td style="padding:4px 8px;border:1px solid #999;"><strong>Employee Number:</strong></td><td style="padding:4px 8px;border:1px solid #999;">${empNum}</td><td style="padding:4px 8px;border:1px solid #999;"><strong>PhilHealth Number:</strong></td><td style="padding:4px 8px;border:1px solid #999;">${emp.philhealth || ''}</td></tr>
        <tr><td style="padding:4px 8px;border:1px solid #999;"><strong>Position:</strong></td><td style="padding:4px 8px;border:1px solid #999;">${positionLabel}</td><td style="padding:4px 8px;border:1px solid #999;"><strong>Pag-IBIG Number:</strong></td><td style="padding:4px 8px;border:1px solid #999;">${emp.pagibig || ''}</td></tr>
        <tr><td style="padding:4px 8px;border:1px solid #999;"><strong>Pay Period:</strong></td><td style="padding:4px 8px;border:1px solid #999;">${p.payPeriod}</td><td style="padding:4px 8px;border:1px solid #999;"><strong>TIN Number:</strong></td><td style="padding:4px 8px;border:1px solid #999;">${emp.tin || ''}</td></tr>
        <tr><td style="padding:4px 8px;border:1px solid #999;"><strong>Pay Date:</strong></td><td style="padding:4px 8px;border:1px solid #999;">${payDateStr}</td><td style="padding:4px 8px;border:1px solid #999;"></td><td style="padding:4px 8px;border:1px solid #999;"></td></tr>
      </tbody>
    </table>
    <table style="width:100%;border-collapse:collapse;font-size:12px;margin-top:-1px;">
      <colgroup><col style="width:34%"><col style="width:9%"><col style="width:13%"><col style="width:4px"><col style="width:auto"><col style="width:14%"></colgroup>
      <thead><tr>
        <th colspan="3" style="border:1px solid #999;padding:6px 8px;text-align:left;font-weight:700;">EARNINGS/INCOME</th>
        <td style="background:#333;width:4px;padding:0;"></td>
        <th colspan="2" style="border:1px solid #999;padding:6px 8px;text-align:left;font-weight:700;">DEDUCTIONS</th>
      </tr></thead>
      <tbody>
        <tr>
          <td style="border-left:1px solid #999;padding:5px 8px;">Basic Pay @ ₱${fmt(p.dailyRate)}/day</td>
          <td style="border-left:1px solid #ddd;padding:5px 8px;text-align:right;">${p.daysPresent}</td>
          <td style="border-left:1px solid #ddd;border-right:1px solid #999;padding:5px 8px;text-align:right;">₱${fmt(basicPay)}</td>
          <td style="background:#333;width:4px;padding:0;"></td>
          <td style="border-left:1px solid #999;padding:5px 8px;">SSS EE Contribution</td>
          <td style="border-right:1px solid #999;padding:5px 8px;text-align:right;">${p.sss > 0 ? '₱' + fmt(p.sss) : ''}</td>
        </tr>
        <tr>
          <td style="border-left:1px solid #999;padding:5px 8px;">${commissionCupsQty > 0 ? 'Commission (Cups)' : ''}</td>
          <td style="border-left:1px solid #ddd;padding:5px 8px;text-align:right;">${commissionCupsQty > 0 ? commissionCupsQty : ''}</td>
          <td style="border-left:1px solid #ddd;border-right:1px solid #999;padding:5px 8px;text-align:right;">${commissionCupsQty > 0 ? '₱' + fmt(commissionCupsAmt) : ''}</td>
          <td style="background:#333;width:4px;padding:0;"></td>
          <td style="border-left:1px solid #999;padding:5px 8px;">PhilHealth EE Contribution</td>
          <td style="border-right:1px solid #999;padding:5px 8px;text-align:right;">${p.philhealth > 0 ? '₱' + fmt(p.philhealth) : ''}</td>
        </tr>
        <tr>
          <td style="border-left:1px solid #999;padding:5px 8px;">${commissionGpQty > 0 ? 'Commission (GP)' : ''}</td>
          <td style="border-left:1px solid #ddd;padding:5px 8px;text-align:right;">${commissionGpQty > 0 ? commissionGpQty : ''}</td>
          <td style="border-left:1px solid #ddd;border-right:1px solid #999;padding:5px 8px;text-align:right;">${commissionGpQty > 0 ? '₱' + fmt(commissionGpAmt) : ''}</td>
          <td style="background:#333;width:4px;padding:0;"></td>
          <td style="border-left:1px solid #999;padding:5px 8px;">Pag-IBIG Contribution</td>
          <td style="border-right:1px solid #999;padding:5px 8px;text-align:right;">${p.hdmf > 0 ? '₱' + fmt(p.hdmf) : ''}</td>
        </tr>
        <tr style="height:22px;">
          <td style="border-left:1px solid #999;"></td><td style="border-left:1px solid #ddd;"></td><td style="border-left:1px solid #ddd;border-right:1px solid #999;"></td>
          <td style="background:#333;padding:0;"></td>
          <td style="border-left:1px solid #999;"></td><td style="border-right:1px solid #999;"></td>
        </tr>
      </tbody>
      <tfoot>
        <tr style="font-weight:700;">
          <td colspan="2" style="border:1px solid #999;padding:6px 8px;">GROSS PAY</td>
          <td style="border:1px solid #999;padding:6px 8px;text-align:right;">₱${fmt(p.grossPay)}</td>
          <td style="background:#333;width:4px;padding:0;"></td>
          <td style="border:1px solid #999;padding:6px 8px;">TOTAL DEDUCTION</td>
          <td style="border:1px solid #999;padding:6px 8px;text-align:right;">₱${fmt(p.deductions)}</td>
        </tr>
        <tr style="font-weight:700;">
          <td colspan="3" style="border:1px solid #999;padding:6px 8px;background:#fff;"></td>
          <td style="background:#333;width:4px;padding:0;"></td>
          <td style="border:1px solid #999;padding:6px 8px;">NET PAY</td>
          <td style="border:1px solid #999;padding:6px 8px;text-align:right;">₱${fmt(p.netPay)}</td>
        </tr>
      </tfoot>
    </table>
    ${p.notes ? `<div style="margin-top:10px;font-size:11px;color:#666;border-top:1px solid #eee;padding-top:8px;">Notes: ${p.notes}</div>` : ''}
    <div style="margin-top:16px;border-top:2px dashed #ccc;padding-top:4px;"></div>
  </div>`;

  showModal(`<div class="modal-header"><h2>📄 Payslip — ${p.employeeName}</h2><button class="btn-close-modal" onclick="closeModal()">✕</button></div>
    <div class="modal-body" id="payslip-modal-doc" style="padding:0;max-height:75vh;overflow-y:auto;">${html}</div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeModal()">Close</button>
      <button class="btn btn-maroon" onclick="printContent(document.getElementById('payslip-modal-doc').innerHTML,'Payslip — ${p.employeeName.replace(/'/g, '')}')">${iconSvg('printer')} Print</button>
    </div>`, 'modal-lg');
}

async function adminDeletePayslip(payslipId, empName) {
  confirmModal({
    title: 'Retract Payslip',
    message: `Are you sure you want to retract the payslip for <strong>${empName}</strong>? The employee will no longer be able to see this payslip.`,
    confirmText: 'Retract Payslip',
    icon: '📄',
    onConfirm: async function () {
      const s = getState();
      try {
        await DB.deletePayslip(payslipId);
        s.payslips = (s.payslips || []).filter(p => p.id !== payslipId);
        saveState(s);
        showToast('Payslip retracted.', 'success');
        renderAdminPayslipGen();
      } catch (e) {
        showToast('Failed to retract: ' + e.message, 'error');
      }
    }
  });
}

function adminGeneratePayslipModal(empId) {
  const s = getState();
  const emp = s.users.find(u => u.id === empId);
  if (!emp) return;
  const dailyRate = emp.dailyRate || 500;
  const attRecords = (s.attendanceRecords || []).filter(r => r.userId === emp.id && r.timeIn && r.timeOut);
  const workingDays = 26;
  const daysPresent = attRecords.length;
  const daysAbsent = Math.max(0, workingDays - daysPresent);
  const grossPay = daysPresent * dailyRate;
  const sss = grossPay > 0 ? Math.round(grossPay * 0.045) : 0;
  const phic = grossPay > 0 ? Math.round(grossPay * 0.025) : 0;
  const hdmf = grossPay > 0 ? Math.min(100, Math.round(grossPay * 0.02)) : 0;
  const deductions = sss + phic + hdmf;
  const netPay = grossPay - deductions;
  const now = new Date();
  const monthLabel = now.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' });
  const branch = s.branches.find(b => b.id === emp.branchId);

  const COMPANY = getCompanyInfo();
  const empNum = emp.employeeNumber || ('BPS-' + String(emp.id || '001').replace(/\D/g, '').padStart(3, '0'));
  const positionLabel = ['cashier', 'branch_manager', 'inventory_staff'].includes(normalizeRole(emp.role)) ? 'Branch Personnel' : normalizeRole(emp.role) === 'print' ? 'Printing Personnel' : (emp.role || '');
  const payDateStr = new Date(now.getFullYear(), now.getMonth() + 1, 15).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' });

  const payslipHtml = `<div style="font-family:'Arial',sans-serif;font-size:12px;color:#111;padding:24px 32px;">
    <div style="display:flex;align-items:flex-start;gap:24px;margin-bottom:16px;">
      <div style="flex-shrink:0;width:90px;"><img src="logo.png" alt="South Pafps" style="width:90px;height:auto;display:block;" onerror="this.style.display='none'"></div>
      <div style="flex:1;padding-top:4px;"><div style="font-weight:700;font-size:13px;margin-bottom:4px;">${COMPANY.name}</div><div style="font-size:11px;line-height:1.8;color:#333;">${COMPANY.address1}<br>${COMPANY.address2}<br>${COMPANY.tel}</div></div>
    </div>
    <div style="text-align:center;font-weight:700;font-size:13px;letter-spacing:3px;margin:0 0 10px;">PAYSLIP</div>
    <table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:0;">
      <colgroup><col style="width:20%"><col style="width:30%"><col style="width:20%"><col style="width:30%"></colgroup>
      <tbody>
        <tr><td style="padding:4px 8px;border:1px solid #999;"><strong>Employee Name:</strong></td><td style="padding:4px 8px;border:1px solid #999;">${emp.name || emp.username}</td><td style="padding:4px 8px;border:1px solid #999;"><strong>SSS Number:</strong></td><td style="padding:4px 8px;border:1px solid #999;">${emp.sss || ''}</td></tr>
        <tr><td style="padding:4px 8px;border:1px solid #999;"><strong>Employee Number:</strong></td><td style="padding:4px 8px;border:1px solid #999;">${empNum}</td><td style="padding:4px 8px;border:1px solid #999;"><strong>PhilHealth Number:</strong></td><td style="padding:4px 8px;border:1px solid #999;">${emp.philhealth || ''}</td></tr>
        <tr><td style="padding:4px 8px;border:1px solid #999;"><strong>Position:</strong></td><td style="padding:4px 8px;border:1px solid #999;">${positionLabel}</td><td style="padding:4px 8px;border:1px solid #999;"><strong>Pag-IBIG Number:</strong></td><td style="padding:4px 8px;border:1px solid #999;">${emp.pagibig || ''}</td></tr>
        <tr><td style="padding:4px 8px;border:1px solid #999;"><strong>Pay Period:</strong></td><td style="padding:4px 8px;border:1px solid #999;">${monthLabel}</td><td style="padding:4px 8px;border:1px solid #999;"><strong>TIN Number:</strong></td><td style="padding:4px 8px;border:1px solid #999;">${emp.tin || ''}</td></tr>
        <tr><td style="padding:4px 8px;border:1px solid #999;"><strong>Pay Date:</strong></td><td style="padding:4px 8px;border:1px solid #999;">${payDateStr}</td><td style="padding:4px 8px;border:1px solid #999;"></td><td style="padding:4px 8px;border:1px solid #999;"></td></tr>
      </tbody>
    </table>
    <table style="width:100%;border-collapse:collapse;font-size:12px;margin-top:-1px;">
      <colgroup><col style="width:34%"><col style="width:9%"><col style="width:13%"><col style="width:4px"><col style="width:auto"><col style="width:14%"></colgroup>
      <thead><tr>
        <th colspan="3" style="border:1px solid #999;padding:6px 8px;text-align:left;font-weight:700;">EARNINGS/INCOME</th>
        <td style="background:#333;width:4px;padding:0;"></td>
        <th colspan="2" style="border:1px solid #999;padding:6px 8px;text-align:left;font-weight:700;">DEDUCTIONS</th>
      </tr></thead>
      <tbody>
        <tr>
          <td style="border-left:1px solid #999;padding:5px 8px;">Basic Pay @ ₱${fmt(dailyRate)}/day</td>
          <td style="border-left:1px solid #ddd;padding:5px 8px;text-align:right;">${daysPresent}</td>
          <td style="border-left:1px solid #ddd;border-right:1px solid #999;padding:5px 8px;text-align:right;">₱${fmt(daysPresent * dailyRate)}</td>
          <td style="background:#333;width:4px;padding:0;"></td>
          <td style="border-left:1px solid #999;padding:5px 8px;">SSS EE Contribution</td>
          <td style="border-right:1px solid #999;padding:5px 8px;text-align:right;">${sss > 0 ? '₱' + fmt(sss) : ''}</td>
        </tr>
        <tr>
          <td style="border-left:1px solid #999;padding:5px 8px;"></td>
          <td style="border-left:1px solid #ddd;padding:5px 8px;"></td>
          <td style="border-left:1px solid #ddd;border-right:1px solid #999;padding:5px 8px;"></td>
          <td style="background:#333;width:4px;padding:0;"></td>
          <td style="border-left:1px solid #999;padding:5px 8px;">PhilHealth EE Contribution</td>
          <td style="border-right:1px solid #999;padding:5px 8px;text-align:right;">${phic > 0 ? '₱' + fmt(phic) : ''}</td>
        </tr>
        <tr>
          <td style="border-left:1px solid #999;padding:5px 8px;"></td>
          <td style="border-left:1px solid #ddd;padding:5px 8px;"></td>
          <td style="border-left:1px solid #ddd;border-right:1px solid #999;padding:5px 8px;"></td>
          <td style="background:#333;width:4px;padding:0;"></td>
          <td style="border-left:1px solid #999;padding:5px 8px;">Pag-IBIG Contribution</td>
          <td style="border-right:1px solid #999;padding:5px 8px;text-align:right;">${hdmf > 0 ? '₱' + fmt(hdmf) : ''}</td>
        </tr>
        <tr style="height:22px;">
          <td style="border-left:1px solid #999;"></td><td style="border-left:1px solid #ddd;"></td><td style="border-left:1px solid #ddd;border-right:1px solid #999;"></td>
          <td style="background:#333;padding:0;"></td>
          <td style="border-left:1px solid #999;"></td><td style="border-right:1px solid #999;"></td>
        </tr>
      </tbody>
      <tfoot>
        <tr style="font-weight:700;">
          <td colspan="2" style="border:1px solid #999;padding:6px 8px;">GROSS PAY</td>
          <td style="border:1px solid #999;padding:6px 8px;text-align:right;">₱${fmt(grossPay)}</td>
          <td style="background:#333;width:4px;padding:0;"></td>
          <td style="border:1px solid #999;padding:6px 8px;">TOTAL DEDUCTION</td>
          <td style="border:1px solid #999;padding:6px 8px;text-align:right;">₱${fmt(deductions)}</td>
        </tr>
        <tr style="font-weight:700;">
          <td colspan="3" style="border:1px solid #999;padding:6px 8px;background:#fff;"></td>
          <td style="background:#333;width:4px;padding:0;"></td>
          <td style="border:1px solid #999;padding:6px 8px;">NET PAY</td>
          <td style="border:1px solid #999;padding:6px 8px;text-align:right;">₱${fmt(netPay)}</td>
        </tr>
      </tfoot>
    </table>
    <div style="margin-top:16px;border-top:2px dashed #ccc;padding-top:4px;"></div>
  </div>`;

  showModal(`
    <div class="modal-header"><h2>${iconSvg('money')} Payslip — ${emp.name || emp.username}</h2><button class="btn-close-modal" onclick="closeModal()">✕</button></div>
    <div class="modal-body">${payslipHtml}</div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeModal()">Close</button>
      <button class="btn btn-maroon" onclick="printContent(document.querySelector('#modal-container .modal-body').innerHTML,'Payslip — ${(emp.name || emp.username).replace(/'/g, '')}')">🖨️ Print Payslip</button>
    </div>`, 'modal-lg');

  // Remove salary from table after generating payslip
  if (!emp._payslipGenerated) {
    emp._payslipGenerated = true;
    saveState(s);
  }
}

// ── PRINT JOB MANAGEMENT ──────────────────────────────────────────────────────
function renderPrintJobManagement() {
  const s = getState();
  if (!s.currentUser || !['admin', 'print'].includes(s.currentUser.role)) { accessDenied('Job Management'); return; }
  const orders = getOrders();
  const inProdOrders = orders.filter(o => o.status === 'production' || o.status === 'pending');

  document.getElementById('page-content').innerHTML = `
    <div class="page-header" style="display:flex;justify-content:space-between;align-items:flex-start">
      <div><h1 class="page-title">Job Management</h1><p class="page-subtitle">Manage and track active print jobs</p></div>
      <button class="btn btn-maroon" onclick="navigateTo('production')">View Production Queue</button>
    </div>
    <div class="kpi-grid" style="grid-template-columns:repeat(3,1fr)">
      <div class="kpi-card"><div class="kpi-header"><div class="kpi-label">Active Jobs</div><div class="kpi-icon maroon">${iconSvg('printer')}</div></div><div class="kpi-value">${inProdOrders.length}</div></div>
      <div class="kpi-card"><div class="kpi-header"><div class="kpi-label">In Production</div><div class="kpi-icon blue">${iconSvg('printer')}</div></div><div class="kpi-value">${orders.filter(o => o.status === 'production').length}</div></div>
      <div class="kpi-card"><div class="kpi-header"><div class="kpi-label">Pending Start</div><div class="kpi-icon gold">${iconSvg('clock')}</div></div><div class="kpi-value">${orders.filter(o => o.status === 'pending').length}</div></div>
    </div>
    <div class="data-card">
      <div class="data-card-header"><span class="data-card-title">Active Print Jobs</span></div>
      <div class="data-card-body no-pad">
        <table class="data-table">
          <thead><tr><th>Job #</th><th>Customer</th><th>Product</th><th>Qty</th><th>Status</th><th>Due Date</th><th>Actions</th></tr></thead>
          <tbody>${inProdOrders.length ? [...inProdOrders].reverse().map(o => {
    const isPastDue = o.due_date && new Date(o.due_date) < new Date() && o.status !== 'completed';
    return `<tr ${isPastDue ? 'style="background:var(--danger-l)"' : ''}>
      <td class="td-mono fw7">#${String(o.id).padStart(6, '0')}</td>
      <td>${o.customer_name || '—'}</td>
      <td>${o.product_type || o.product_category || '—'}</td>
      <td class="td-mono">${o.quantity || '—'}</td>
      <td>${statusBadge ? statusBadge(o.status) : o.status}</td>
      <td class="td-mono ${isPastDue ? 'danger' : ''}">${o.due_date || '—'}</td>
      <td>
        <button class="btn btn-sm btn-outline" onclick="omViewOrderModal('${o.id}')">View</button>
        <button class="btn btn-sm btn-maroon" onclick="omUpdateProductionByOrder('${o.id}')">Update</button>
      </td>
    </tr>`;
  }).join('') : '<tr><td colspan="7" style="text-align:center;padding:32px;color:var(--ink-60)">No active jobs.</td></tr>'}</tbody>
        </table>
      </div>
    </div>`;
}

// ── PRINT REPORTS PAGE (with send-to-admin) ───────────────────────────────────
function buildPrintReportPreview(types) {
  const s = getState();
  const orders = getOrders();
  const now = new Date();
  const todayStr = now.toDateString();
  const genDate = now.toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  let html = '';

  types.forEach(type => {
    if (type === 'Production Report') {
      const todayCompleted = orders.filter(o => o.status === 'completed' && o.delivery_date && new Date(o.delivery_date).toDateString() === todayStr);
      const inProd = orders.filter(o => o.status === 'production');
      const pending = orders.filter(o => o.status === 'pending');
      const dispatch = orders.filter(o => omIsDispatchReady(o));
      const qcPassed = orders.filter(o => o.qc_status === 'passed');
      const qcFailed = orders.filter(o => o.qc_status === 'failed');
      const passRate = (qcPassed.length + qcFailed.length) > 0 ? ((qcPassed.length / (qcPassed.length + qcFailed.length)) * 100).toFixed(1) + '%' : '—';
      html += `
        <div style="margin-bottom:24px">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;padding-bottom:10px;border-bottom:2px solid var(--maroon)">
            <img src="logo.png" alt="South Pafps" style="height:36px;width:auto;border-radius:6px;flex-shrink:0" onerror="this.style.display='none'">
            <div>
              <div style="font-size:14px;font-weight:700;color:var(--maroon)">Production Report</div>
              <div style="font-size:11px;color:var(--ink-60)">South Pafps Packaging Supplies</div>
            </div>
            <span style="font-size:11px;color:var(--ink-40);margin-left:auto">Generated ${genDate}</span>
          </div>
          <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:12px">
            <div style="background:var(--cream);border-radius:var(--radius);padding:12px;text-align:center">
              <div style="font-size:18px;font-weight:700;color:var(--success)">${todayCompleted.length}</div>
              <div style="font-size:11px;color:var(--ink-60)">Completed Today</div>
            </div>
            <div style="background:var(--cream);border-radius:var(--radius);padding:12px;text-align:center">
              <div style="font-size:18px;font-weight:700;color:var(--maroon)">${inProd.length}</div>
              <div style="font-size:11px;color:var(--ink-60)">In Production</div>
            </div>
            <div style="background:var(--cream);border-radius:var(--radius);padding:12px;text-align:center">
              <div style="font-size:18px;font-weight:700;color:var(--warning)">${pending.length}</div>
              <div style="font-size:11px;color:var(--ink-60)">Pending</div>
            </div>
            <div style="background:var(--cream);border-radius:var(--radius);padding:12px;text-align:center">
              <div style="font-size:18px;font-weight:700">${passRate}</div>
              <div style="font-size:11px;color:var(--ink-60)">QC Pass Rate</div>
            </div>
          </div>
          <table class="data-table">
            <thead><tr><th>Order #</th><th>Customer</th><th>Product</th><th>Qty</th><th>Status</th><th>QC</th></tr></thead>
            <tbody>${orders.length ? [...orders].reverse().slice(0, 30).map(o => `<tr>
              <td class="td-mono">#${String(o.id).padStart(6, '0')}</td>
              <td>${o.customer_name || '—'}</td>
              <td>${o.product_type || '—'}</td>
              <td>${o.quantity || '—'}</td>
              <td>${omStatusBadge(o.status)}</td>
              <td>${o.qc_status ? `<span class="badge ${o.qc_status === 'passed' ? 'badge-success' : 'badge-danger'}">${o.qc_status}</span>` : '—'}</td>
            </tr>`).join('') : '<tr><td colspan="6" style="text-align:center;padding:16px;color:var(--ink-60)">No orders found.</td></tr>'}</tbody>
          </table>
        </div>`;
    }

    if (type === 'Inventory Report') {
      const products = (s.products || []).filter(p => p.active);
      const materialsLog = (s.materialsLog || []).slice(-10).reverse();
      html += `
        <div style="margin-bottom:24px">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;padding-bottom:10px;border-bottom:2px solid var(--maroon)">
            <img src="logo.png" alt="South Pafps" style="height:36px;width:auto;border-radius:6px;flex-shrink:0" onerror="this.style.display='none'">
            <div>
              <div style="font-size:14px;font-weight:700;color:var(--maroon)">Inventory / Materials Report</div>
              <div style="font-size:11px;color:var(--ink-60)">South Pafps Packaging Supplies</div>
            </div>
            <span style="font-size:11px;color:var(--ink-40);margin-left:auto">Generated ${genDate}</span>
          </div>
          <table class="data-table" style="margin-bottom:12px">
            <thead><tr><th>Product</th><th>Variant</th><th>Stock</th><th>Reorder Level</th><th>Status</th></tr></thead>
            <tbody>${products.flatMap(p => (p.variants || []).map(v => {
        const low = v.stock <= (v.reorderLevel ?? 20);
        const out = v.stock <= 0;
        const badge = out ? '<span class="badge badge-danger">Out of Stock</span>' : low ? '<span class="badge badge-warning">Low Stock</span>' : '<span class="badge badge-success">OK</span>';
        return `<tr>
                <td>${p.name}</td><td>${v.name}</td>
                <td class="td-mono" style="${out ? 'color:var(--danger);font-weight:700' : low ? 'color:var(--warning);font-weight:700' : ''}">${v.stock}</td>
                <td class="td-mono">${v.reorderLevel ?? 20}</td><td>${badge}</td>
              </tr>`;
      })).join('') || '<tr><td colspan="5" style="text-align:center;padding:16px;color:var(--ink-60)">No products found.</td></tr>'}</tbody>
          </table>
          ${materialsLog.length ? `
          <div style="font-size:12px;font-weight:600;margin-bottom:8px;color:var(--ink-60)">Recent Material Usage</div>
          <table class="data-table">
            <thead><tr><th>Date</th><th>Order #</th><th>Material</th><th>Used</th><th>Waste</th></tr></thead>
            <tbody>${materialsLog.map(log => `<tr>
              <td class="td-mono">${fmtTime(log.createdAt)}</td>
              <td class="td-mono">${log.orderId ? '#' + String(log.orderId).padStart(6, '0') : '—'}</td>
              <td>${log.material}</td><td>${log.used}</td>
              <td style="color:var(--warning)">${log.waste || 0}</td>
            </tr>`).join('')}</tbody>
          </table>` : ''}
        </div>`;
    }
  });

  return html || '<div style="text-align:center;padding:32px;color:var(--ink-40)">Check at least one report type above and click Generate.</div>';
}

function renderPrintReports() {
  const s = getState();
  const u = s.currentUser;
  if (!u || !['admin', 'print'].includes(u.role)) { accessDenied('Reports'); return; }

  document.getElementById('page-content').innerHTML = `
    <div class="page-header">
      <h1 class="page-title">Reports</h1>
      <p class="page-subtitle">Generate &amp; send your production reports to the Main Branch</p>
    </div>

    <div class="data-card">
      <div class="data-card-header" style="align-items:center">
        <span class="data-card-title">${iconSvg('clipboard')} Generate &amp; Send Reports to Main Branch</span>
      </div>
      <div class="data-card-body">
        <p style="font-size:13px;color:var(--ink-60);margin-bottom:14px">Select the type of report you want to generate, then send to the Main Branch:</p>
        <div class="form-row-2" style="margin-bottom:14px">
          <div class="form-group" style="margin-bottom:0">
            <label>Report Type</label>
            <div class="form-select-wrap">
              <select id="prpt-type" class="form-control">
                <option value="">&#8212; Select a report type &#8212;</option>
                <option value="Production Report">Production Report &mdash; Job completion &amp; progress</option>
                <option value="Inventory Report">Inventory Report &mdash; Printing materials &amp; stock levels</option>
                <option value="All Reports">All Reports &mdash; Generate both of the above</option>
              </select>
            </div>
          </div>
          <div class="form-group" style="margin-bottom:0">
            <label>Note to Main Branch (optional)</label>
            <input id="prpt-note" class="form-control" placeholder="Any remarks for the main branch...">
          </div>
        </div>
        <button class="btn btn-maroon" onclick="printReportPreviewRefresh()" style="font-size:13px">${iconSvg('chart')} Generate Report</button>
      </div>
      <div id="print-rpt-preview" style="display:none;border-top:1px solid var(--ink-10);padding:20px 24px 24px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:var(--ink-40)">Report Preview</div>
          <button class="btn btn-maroon" onclick="submitPrintReportsToAdmin()" style="font-size:13px">&#128228; Send to Main Branch</button>
        </div>
        <div id="print-rpt-preview-body"></div>
      </div>
    </div>`;
}

function printReportPreviewRefresh() {
  const val = document.getElementById('prpt-type')?.value;
  const preview = document.getElementById('print-rpt-preview');
  const body = document.getElementById('print-rpt-preview-body');
  if (!preview || !body) return;
  if (!val) { showToast('Please select a report type first.', 'error'); return; }
  const types = val === 'All Reports'
    ? ['Production Report', 'Inventory Report']
    : [val];
  body.innerHTML = buildPrintReportPreview(types);
  preview.style.display = 'block';
}

function submitPrintReportsToAdmin() {
  const s = getState();
  const u = s.currentUser;
  const val = document.getElementById('prpt-type')?.value;
  if (!val) { showToast('Please select a report type and generate first.', 'error'); return; }
  const selected = val === 'All Reports'
    ? ['Production Report', 'Inventory Report']
    : [val];
  const note = document.getElementById('prpt-note')?.value?.trim() || '';
  // Always regenerate fresh so saved HTML always matches selected type
  const freshHtml = buildPrintReportPreview(selected);
  const previewBody = document.getElementById('print-rpt-preview-body');
  if (previewBody) previewBody.innerHTML = freshHtml;
  const reportHtml = freshHtml;
  if (!reportHtml || reportHtml.includes('Check at least one report type')) {
    showToast('Please select a report type first.', 'error');
    return;
  }
  const entry = {
    id: 'rpt_' + Date.now(),
    submittedBy: u.id,
    submitterName: u.name || u.username,
    role: u.role,
    branchId: u.branchId || null,
    reports: selected,
    reportHtml,
    note,
    submittedAt: new Date().toISOString(),
    type: 'print_dept',
    forwardedToAdmin: false,
  };
  const existing = JSON.parse(localStorage.getItem('submitted_reports') || '[]');
  existing.push(entry);
  localStorage.setItem('submitted_reports', JSON.stringify(existing));
  recordAudit(s, { action: 'print_reports_submitted', message: `${u.name} submitted print reports to main branch: ${selected.join(', ')}`, userId: u.id });
  saveState(s);
  showToast('Report sent to Main Branch successfully! The Main Branch staff will review and forward to Admin.', 'success');
  // Hide preview after send
  const preview = document.getElementById('print-rpt-preview');
  if (preview) preview.style.display = 'none';
}
