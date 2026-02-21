// --- LocalStorage CRUD for Orders ---
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
// showOverview
function showOverview() {
  document.getElementById('overview-page').classList.remove('hidden');
  document.getElementById('login-page').classList.add('hidden');
  document.getElementById('app-page').classList.add('hidden');
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
function showApp() {
  // Hide login page, show app shell
  document.getElementById('login-page').classList.add('hidden');
  document.getElementById('app-page').classList.remove('hidden');
  document.getElementById('overview-page').classList.add('hidden');
  // Update sidebar and topbar with user info
  buildSidebar();
  // Show dashboard page by default
  navigateTo('dashboard');
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
    localStorage.setItem('pos_state', JSON.stringify(state));
  } catch (e) {
    console.error('Failed to save state:', e);
  }
}

// bindOverviewClickFallback
function bindOverviewClickFallback() { }
// Show login page/modal when Access System button is clicked
function showLogin() {
  document.getElementById('overview-page').classList.add('hidden');
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
  state.handoverNotes = Array.isArray(state.handoverNotes) ? state.handoverNotes : [];
  state.printProducts = Array.isArray(state.printProducts) ? state.printProducts : [];
  state.dashboardPrefs = state.dashboardPrefs && typeof state.dashboardPrefs === 'object' ? state.dashboardPrefs : {};
  state.posDraft = state.posDraft && typeof state.posDraft === 'object' ? state.posDraft : {};

  if (!state.scheduleView) state.scheduleView = 'daily';
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
    {
      name: 'Ripple Wall Cup (25s)', desc: '25s pack', variants: [
        { name: 'Black 8oz', price: 90 },
        { name: 'Black 12oz', price: 150 },
        { name: 'Black 16oz', price: 200 },
      ]
    },
    {
      name: 'Double Wall Cup (25s)', desc: '25s pack', variants: [
        { name: 'Kraft 8oz', price: 80 },
        { name: 'Kraft 12oz', price: 140 },
        { name: 'Kraft 16oz', price: 190 },
        { name: 'Black 8oz', price: 80 },
        { name: 'Black 12oz', price: 140 },
        { name: 'Black 16oz', price: 190 },
      ]
    },
    {
      name: 'Hard Cup (50s)', desc: '50s pack', variants: [
        { name: '16oz', price: 140 },
        { name: '22oz', price: 200 },
      ]
    },
    {
      name: 'Slim Cup (50s)', desc: '50s pack', variants: [
        { name: '16oz', price: 110 },
        { name: '22oz', price: 160 },
      ]
    },
    {
      name: 'PP Cup (50s)', desc: '50s pack', variants: [
        { name: 'T-Cup 12oz', price: 70 },
        { name: 'T-Cup 16oz', price: 90 },
        { name: 'T-Cup 22oz', price: 110 },
        { name: 'U-Cup 12oz', price: 90 },
        { name: 'U-Cup 16oz', price: 130 },
        { name: 'U-Cup 22oz', price: 170 },
      ]
    },
    {
      name: 'PET 98mm (50s)', desc: '50s pack', variants: [
        { name: '16oz', price: 120 },
        { name: '20oz', price: 180 },
      ]
    },
    {
      name: 'Dabba Cup (40s)', desc: '40s pack', variants: [
        { name: '12oz', price: 85 },
        { name: '16oz', price: 110 },
        { name: '20oz', price: 140 },
        { name: '22oz', price: 180 },
        { name: '24oz', price: 220 },
      ]
    },
    {
      name: 'Star Cup (100s)', desc: '100s pack', variants: [
        { name: '3oz', price: 15 },
        { name: '4oz', price: 18 },
        { name: '8oz', price: 23 },
        { name: '10oz', price: 26 },
        { name: '12oz', price: 30 },
        { name: '16oz', price: 38 },
        { name: '22oz', price: 46 },
        { name: '24oz', price: 54 },
      ]
    },
    {
      name: 'Greaseproof Paper (100s)', desc: '100s pack', variants: [
        { name: 'Plain', price: 85 },
        { name: 'Generic', price: 110 },
      ]
    },
    {
      name: 'Paper Cup (100s)', desc: '100s pack', variants: [
        { name: '3oz', price: 28 },
        { name: '6.5oz', price: 33 },
        { name: '8oz', price: 40 },
        { name: '12oz', price: 62 },
        { name: '16oz', price: 86 },
        { name: '20oz', price: 102 },
      ]
    },
    {
      name: 'Paper Bowl (50s)', desc: '50s pack', variants: [
        { name: '220cc', price: 52 },
        { name: '260cc', price: 62 },
        { name: '390cc', price: 70 },
        { name: '520cc', price: 85 },
        { name: '750cc', price: 110 },
        { name: '780cc', price: 120 },
        { name: '850cc', price: 135 },
        { name: '1000cc', price: 160 },
      ]
    },
    {
      name: 'Paper Boxes (10s)', desc: '10s pack', variants: [
        { name: 'Spaghetti Box', price: 30 },
        { name: 'Meal Box (Small)', price: 35 },
        { name: 'Meal Box (Medium)', price: 40 },
        { name: 'High Meal Box', price: 45 },
        { name: 'Chicken Box', price: 50 },
        { name: 'High Meal Box 1300cc', price: 60 },
      ]
    },
  ];

  let variantIndex = 1;
  return catalog.map((product, productIdx) => ({
    id: `p${productIdx + 1}`,
    name: product.name,
    desc: product.desc,
    active: true,
    variants: product.variants.map((variant) => {
      const sku = buildVariantSku(product.name, variant.name, variantIndex);
      const variantItem = {
        id: `v${variantIndex}`,
        name: variant.name,
        sku,
        price: variant.price,
        stock: 120,
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
      { id: 'b2', name: 'South Branch', address: 'Biñan, Laguna', contact: '049-234-5678', active: true },
      { id: 'b3', name: 'North Branch', address: 'Calamba, Laguna', contact: '049-345-6789', active: true },
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
    auditLogs: [],
    branchTransfers: [],
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
    scheduleView: 'daily',
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

  if (btnEl) { btnEl.disabled = true; btnEl.textContent = 'Signing in…'; }

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

    if (!user.role || !['admin', 'staff', 'print'].includes(user.role)) {
      user = { ...user, role: user.username === 'admin' ? 'admin' : 'staff' };
    }

    errEl.classList.remove('show');
    s.currentUser = user;
    localStorage.setItem('pos_currentUser', JSON.stringify(user));
    recordAudit(s, { action: 'login', message: `User logged in: ${user.username}`, userId: user.id, branchId: user.branchId || null });
    showApp();

  } finally {
    if (btnEl) { btnEl.disabled = false; btnEl.textContent = 'Sign In →'; }
  }
}

function doLogout() {
  closeAccountMenu();
  const s = getState();
  if (s.currentUser) recordAudit(s, { action: 'logout', message: `User logged out: ${s.currentUser.username}`, userId: s.currentUser.id, branchId: s.currentUser.branchId || null });
  s.currentUser = null;
  saveState(s);
  localStorage.removeItem('pos_currentUser');
  showOverview();
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

// SIDEBAR
function getNavItems() {
  const s = getState();
  const u = s.currentUser;
  if (!u) return [];

  // ADMINISTRATOR
  if (u.role === 'admin') return [
    { type: 'section', label: 'Overview' },
    { type: 'item', id: 'dashboard', icon: 'home', label: 'Dashboard', page: 'dashboard' },
    {
      type: 'group', id: 'pos-group', icon: 'cart', label: 'POS', page: 'pos', children: [
        { id: 'pos-customers', icon: 'users', label: 'Customer Records', page: 'pos-customers' },
        { id: 'pos-receipts',  icon: 'clipboard', label: 'Receipt History',  page: 'pos-receipts' },
      ]
    },

    { type: 'section', label: 'Products & Orders' },
    {
      type: 'group', id: 'products', icon: 'box', label: 'Product Management', page: 'product-mgmt', children: [
        { id: 'inventory', icon: 'chart', label: 'Branch Inventory', page: 'inventory' },
        { id: 'print-materials', icon: 'box', label: 'Printing Inventory', page: 'print-materials' },
      ]
    },
    { type: 'item', id: 'orders', icon: 'clipboard', label: 'Order Management', page: 'orders' },

    { type: 'section', label: 'People' },
    {
      type: 'group', id: 'personnel', icon: 'users', label: 'Personnel Management', page: 'personnel-mgmt', children: [
        { id: 'schedule', icon: 'calendar', label: 'Shift Management', page: 'shift-schedule' },
        { id: 'payroll', icon: 'money', label: 'Payroll', page: 'payroll' },
      ]
    },
    { type: 'item', id: 'users', icon: 'key', label: 'User Management', page: 'users' },

    { type: 'section', label: 'Analytics' },
    { type: 'item', id: 'reports', icon: 'chart', label: 'Reports', page: 'reports' },
  ];

  // BRANCH STAFF (Cashier)
  if (u.role === 'staff') return [
    { type: 'section', label: 'My Workspace' },
    { type: 'item', id: 'dashboard', icon: 'home', label: 'Dashboard', page: 'dashboard' },
    {
      type: 'group', id: 'pos-group', icon: 'cart', label: 'POS', page: 'pos', children: [
        { id: 'pos-customers', icon: 'users', label: 'Customer Records', page: 'pos-customers' },
        { id: 'pos-receipts',  icon: 'clipboard', label: 'Receipt History',  page: 'pos-receipts' },
      ]
    },
    { type: 'item', id: 'shift', icon: 'clock', label: 'Shift', page: 'shift' },
    { type: 'item', id: 'payslip', icon: 'money', label: 'Payroll', page: 'payslip' },

    { type: 'section', label: 'Reports' },
    { type: 'item', id: 'staff-reports', icon: 'chart', label: 'Report', page: 'staff-reports' },
  ];

  // PRINTING DEPARTMENT
  if (u.role === 'print') return [
    { type: 'section', label: 'Operations' },
    { type: 'item', id: 'orders', icon: 'clipboard', label: 'Order Management', page: 'orders' },
    { type: 'item', id: 'print-materials', icon: 'box', label: 'Printing Inventory', page: 'print-materials' },

    { type: 'section', label: 'People' },
    { type: 'item', id: 'print-personnel', icon: 'users', label: 'Personnel Management', page: 'print-personnel' },
    { type: 'item', id: 'print-payroll', icon: 'money', label: 'Payroll', page: 'print-payslip' },

    { type: 'section', label: 'Analytics' },
    { type: 'item', id: 'reports', icon: 'chart', label: 'Reports', page: 'reports' },
  ];

  return [];
}

function buildSidebar() {
  const s = getState();
  const u = s.currentUser;
  if (!u) return;
  document.getElementById('sb-avatar').textContent = (u.name || u.username || '?')[0].toUpperCase();
  document.getElementById('sb-name').textContent = u.name;
  const _roleLabels = { admin: 'Administrator', staff: 'Branch Staff', print: 'Printing Personnel' };
  document.getElementById('sb-role').textContent = _roleLabels[u.role] || u.role;
  const branch = s.branches.find(b => b.id === u.branchId);
  document.getElementById('topbar-branch').textContent = u.role === 'admin' ? 'All Branches' : (branch?.name || 'Unassigned');
  // Update topbar date
  const _now = new Date();
  const _dateEl = document.getElementById('topbar-date');
  if (_dateEl) _dateEl.textContent = _now.toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

  const nav = document.getElementById('sidebar-nav');
  nav.innerHTML = '';
  getNavItems().forEach(item => {
    if (item.type === 'section') {
      const el = document.createElement('div');
      el.className = 'nav-section-label';
      el.textContent = item.label;
      nav.appendChild(el);
    } else if (item.type === 'item') {
      const el = document.createElement('div');
      el.className = 'nav-item';
      el.dataset.page = item.page;
      el.dataset.id = item.id;
      el.innerHTML = `<span class="nav-icon">${iconSvg(item.icon)}</span>${item.label}`;
      el.onclick = () => navigateTo(item.page);
      nav.appendChild(el);
    } else if (item.type === 'group') {
      const el = document.createElement('div');
      el.className = 'nav-item' + (expandedGroups[item.id] ? ' expanded' : '');
      el.dataset.group = item.id;
      el.innerHTML = `<span class="nav-icon">${iconSvg(item.icon)}</span>${item.label}<span class="nav-chevron">›</span>`;
      el.onclick = (e) => { toggleGroup(item.id, item.page); };
      nav.appendChild(el);
      const sub = document.createElement('div');
      sub.className = 'nav-sub' + (expandedGroups[item.id] ? ' open' : '');
      sub.id = 'group-' + item.id;
      item.children.forEach(ch => {
        const ci = document.createElement('div');
        ci.className = 'nav-sub-item';
        ci.dataset.page = ch.page;
        ci.innerHTML = `<span class="nav-icon">${iconSvg(ch.icon)}</span>${ch.label}`;
        ci.onclick = () => navigateTo(ch.page);
        sub.appendChild(ci);
      });
      nav.appendChild(sub);
    }
  });
  updateNavActive();
}


// ROLE-BASED ACCESS CONTROL
// Page-level permission map
var PAGE_PERMISSIONS = {
  // All roles
  'dashboard': ['admin', 'staff', 'print'],
  'shift': ['admin', 'staff'],
  'receipts': ['admin', 'staff', 'print'],

  // Admin + Staff
  'pos': ['admin', 'staff'],
  'pos-customers': ['admin', 'staff'],
  'pos-receipts':  ['admin', 'staff'],
  'customers': ['admin', 'staff'],
  'orders': ['admin', 'staff'],
  'pickup': ['admin', 'staff', 'print'],
  'production': ['admin'],
  'product-mgmt': ['admin'],
  'inventory': ['admin', 'staff'],   // staff: read-only enforced in render
  'receiving': ['admin'],
  'personnel-mgmt': ['admin', 'print'],
  'shift-schedule': ['admin'],
  'payroll': ['admin', 'staff', 'print'],  // staff/print: own payroll view
  'payslip': ['staff', 'print'],           // personal payslip module
  'reconcile': ['admin'],
  'reports': ['admin', 'staff', 'print'],
  'audit': ['admin'],
  'transfers': ['admin'],
  'users': ['admin'],
  'branches': ['admin'],
  'sales': ['admin', 'staff'],
  'staff-reports': ['admin', 'staff'],

  // Print
  'print-orders': ['admin', 'print'],
  'print-qc': ['admin', 'print'],
  'print-personnel': ['print'],
  'print-payslip': ['print'],
  'print-materials': ['admin', 'print'],
};

function canAccess(page) {
  const s = getState();
  const u = s.currentUser;
  if (!u) return false;
  if (u.role === 'admin') return true; // admin can access everything
  const allowed = PAGE_PERMISSIONS[page];
  if (!allowed) return false;
  return allowed.includes(u.role);
}

function accessDenied(label) {
  const s = getState();
  const u = s.currentUser;
  const roleName = u.role === 'staff' ? 'Branch Staff' : u.role === 'print' ? 'Printing Personnel' : u.role;
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
  if (expandedGroups[id]) navigateTo(page);
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
      'pos': 'Point of Sale', 'pos-customers': 'Customer Records', 'pos-receipts': 'Receipt History', 'customers': 'Customer Records', 'orders': 'Order Management',
      'production': 'Production Oversight', 'pickup': 'Ready for Pickup', 'product-mgmt': 'Product Management',
      'inventory': 'Stock & Inventory', 'receiving': 'Supplier Receiving', 'personnel-mgmt': 'Personnel',
      'shift-schedule': 'Shift Schedule', 'payroll': 'Payroll Management', 'reconcile': 'Cash Reconciliation',
      'reports': 'Reports & Analytics', 'audit': 'Audit Log', 'transfers': 'Branch Transfers',
      'users': 'User Management', 'branches': 'Branch Management', 'sales': 'Sales History',
      'staff-reports': 'My Reports', 'print-orders': 'Job Queue', 'print-qc': 'Quality Control', 'print-personnel': 'My Profile', 'print-payslip': 'My Payslip',
      'print-materials': 'Materials Log', 'shift': 'Shift Management', 'receipts': 'Receipts', 'dashboard': 'Dashboard',
      'payslip': 'My Payroll',
    };
    accessDenied(pageTitleMap[page] || page);
    return;
  }
  currentPage = page;
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
    'pos-receipts':  renderPosReceipts,
    'orders': renderOrders,
    'production': renderProductionOversight,
    'pickup': renderReadyForPickup,
    'shift': renderShift,
    'sales': renderSales,
    'product-mgmt': renderProductMgmt,
    'inventory': renderInventory,
    'receiving': renderReceiving,
    'personnel-mgmt': renderPersonnelMgmt,
    'shift-schedule': renderShiftSchedule,
    'payroll': renderPayroll,
    'payslip': renderPayslip,
    'reconcile': renderReconciliation,
    'reports': renderReports,
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
  };
  const pageTitles = {
    'dashboard': 'Dashboard', 'pos': 'Point of Sale', 'pos-customers': 'Customer Records', 'pos-receipts': 'Receipt History', 'customers': 'Customers', 'orders': 'Order Management',
    'production': 'Production Oversight', 'pickup': 'Ready for Pickup',
    'shift': 'Shift Management', 'sales': 'Sales History',
    'product-mgmt': 'Product Management', 'inventory': 'Inventory Module', 'personnel-mgmt': 'Personnel Management',
    'receiving': 'Supplier Receiving', 'shift-schedule': 'Shift Schedule', 'payroll': 'Payroll',
    'payslip': 'My Payroll',
    'reconcile': 'Cash Reconciliation', 'reports': 'Reports & Analytics',
    'audit': 'Audit Log', 'transfers': 'Branch Transfers', 'users': 'User Management', 'branches': 'Branch Management',
    'receipts': 'Receipts', 'staff-reports': 'My Reports',
    'print-orders': 'Production Queue', 'print-qc': 'Quality Control', 'print-materials': 'Materials Tracking', 'print-personnel': 'My Profile', 'print-payslip': 'My Payslip',
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

  if (u.role === 'staff') {
    const myShift = s.shifts.find(x => x.userId === u.id && x.status === 'open');
    const mySales = s.sales.filter(x => !x.voided && x.userId === u.id && new Date(x.createdAt).toDateString() === today);
    const myRevenue = mySales.reduce((a, b) => a + b.total, 0);
    const orders = getOrders();
    const cfg = getSystemConfig();
    const branchOrders = orders.filter(o => o.status !== 'cancelled');
    const balanceDue = branchOrders.filter(o => (o.balance || 0) > 0).reduce((a, b) => a + (b.balance || 0), 0);
    const readyForPickup = orders.filter(o => o.status === 'dispatch').length;
    const now = new Date();
    const leadTimeWatch = orders.filter(o => o.due_date && o.status !== 'completed' && o.status !== 'cancelled').map(o => {
      const daysLeft = Math.ceil((new Date(o.due_date) - now) / 86400000);
      return { ...o, daysLeft };
    }).filter(o => o.daysLeft <= 3).sort((a, b) => a.daysLeft - b.daysLeft).slice(0, 5);
    document.getElementById('page-content').innerHTML = `
      <div class="page-header"><h1 class="page-title">Good ${getGreeting()}, ${u.name.split(' ')[0]}!</h1><p class="page-subtitle">${today}</p></div>
      ${myShift ? `<div class="alert alert-success">${iconSvg('check')} Shift is open — Started ${fmtTime(myShift.openedAt)} · Opening Cash: ₱${fmt(myShift.openingCash)}</div>` : `<div class="alert alert-warning">${iconSvg('warning')} No active shift. Open a shift before using the POS. <button class="btn btn-sm btn-gold" style="margin-left:12px" onclick="navigateTo('shift')">Open Shift</button></div>`}
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
    const bStaff = s.users.filter(x => x.branchId === b.id && x.role === 'staff');
    return { ...b, sales: bSales.length, revenue: bSales.reduce((a, c) => a + c.total, 0), shifts: bShift.length, staff: bStaff.length };
  });

  const orders = getOrders();
  const pendingOrders = orders.filter(o => o.status === 'pending').length;
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
    pendingOrders: `<div class="kpi-card" style="cursor:pointer" onclick="navigateTo('orders')"><div class="kpi-header"><div class="kpi-label">Pending Orders</div><div class="kpi-icon gold">${iconSvg('clock')}</div></div><div class="kpi-value">${pendingOrders}</div></div>`,
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
    ${lowStockItems.length ? `<div class="alert alert-error-box">${iconSvg('warning')} ${lowStockItems.length} variant(s) reached reorder level. <button class="btn btn-sm btn-outline" style="margin-left:10px" onclick="navigateTo('inventory')">Open Inventory</button></div>` : ''}
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
      <div class="data-card-header"><span class="data-card-title">Recent Sales — All Branches</span><button class="btn btn-sm btn-outline" onclick="navigateTo('reports')">View Reports →</button></div>
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
  if (u.role === 'staff' && !myShift) {
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
              <span id="pos-selected-customer-name">${draft.customerId ? (s.customers.find(c=>c.id===draft.customerId)?.companyName||'') : ''}</span>
            </div>
            <button class="btn-icon" onclick="posRemoveCustomer()" title="Remove customer">✕</button>
          </div>

        </div>
        <div class="pos-cart-items" id="cart-items-list">${renderCartItems(cart)}</div>
        <div class="pos-cart-footer">
          <div class="cart-subtotal"><span>Subtotal</span><span class="amount" id="cart-subtotal">₱${fmt(subtotal)}</span></div>
          <div class="cart-subtotal"><span>Total</span><span class="amount" id="cart-total">₱${fmt(payable)}</span></div>
          <div class="payment-row"><span class="payment-label">${iconSvg('cash')} Cash</span><input type="number" id="pay-cash" class="payment-input" placeholder="0.00" min="0" oninput="updateChange()"></div>
          <div class="payment-row"><span class="payment-label">${iconSvg('phone')} GCash</span><input type="number" id="pay-gcash" class="payment-input" placeholder="0.00" min="0" oninput="updateChange()"><button class="btn btn-sm btn-outline" style="white-space:nowrap;margin-left:4px" onclick="showGCashQRModal(document.getElementById('cart-total')?.textContent?.replace(/[₱,]/g,''))">QR</button></div>
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
  return { amount, note };
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
  const s = getState();
  s.cart = [];
  saveState(s);
  refreshCart();
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
  const gcash = parseFloat(document.getElementById('pay-gcash')?.value) || 0;
  const paid = cash + gcash;
  const changeEl = document.getElementById('change-row');
  const changeAmt = document.getElementById('change-amount');
  if (cash > 0 && paid >= total) {
    const change = cash - Math.max(0, total - gcash);
    if (changeEl) changeEl.style.display = 'block';
    if (changeAmt) changeAmt.textContent = '₱' + fmt(Math.max(0, change));
  } else {
    if (changeEl) changeEl.style.display = 'none';
  }
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
  const isCredit = draft.payMode === 'credit';
  if (!isCredit && cash + gcash < total) { showToast('Insufficient payment amount!', 'error'); return; }
  if (isCredit && !draft.customerId) { showToast('Select a customer for credit sale.', 'error'); return; }
  if (isCredit && s.currentUser && s.currentUser.role !== 'admin') {
    showToast('Only Administrators can authorize credit sales.', 'error');
    return;
  }
  if (discountInfo.amount > 0 && !(draft.discountReason || '').trim()) { showToast('Discount reason is required.', 'error'); return; }

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
    items: cart.map(c => ({ ...c })),
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
    if (gcash > 0) sale.payments.push({ method: 'gcash', amount: gcash });
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
  const gcashPaid = sale.payments.find(p => p.method === 'gcash')?.amount || 0;
  const change = cashPaid - Math.max(0, sale.total - gcashPaid);
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
            ${change > 0 ? `<div class="receipt-row bold"><span>Change</span><span>₱${fmt(change)}</span></div>` : ''}
            <div class="receipt-footer">Receipt # ${sale.id.slice(-6).toUpperCase()}<br>Thank you for your purchase!</div>
          </div>
        </div>
        <div class="modal-footer"><button class="btn btn-outline" onclick="window.print()">${iconSvg('printer')} Print</button><button class="btn btn-maroon" onclick="closeModal();renderPOS()">New Sale</button></div>
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

  let html = `<div class="page-header"><h1 class="page-title">${isAdmin ? 'Shift Management' : 'My Shift'}</h1><p class="page-subtitle">${isAdmin ? 'View and manage all branch shifts' : 'Manage your shift and cash drawer'}</p></div>`;

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
        <div class="shift-summary-item"><div class="shift-summary-label">Expected Cash</div><div class="shift-summary-value">₱${fmt(expected)}</div></div>
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
  showModal(`<div class="modal-header"><h2>Open Shift</h2><button class="btn-close-modal" onclick="closeModal()">✕</button></div>
    <div class="modal-body">
      <div class="form-group"><label>Opening Cash (₱)</label><input type="number" id="opening-cash" class="form-control" placeholder="e.g. 5000.00" min="0" step="0.01"></div>
      <p class="text-sm text-muted">Enter the amount of cash in the drawer at the start of this shift.</p>
    </div>
    <div class="modal-footer"><button class="btn btn-outline" onclick="closeModal()">Cancel</button><button class="btn btn-maroon" onclick="confirmOpenShift()">Open Shift</button></div>`);
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
  showModal(`<div class="modal-header"><h2>Close Shift</h2><button class="btn-close-modal" onclick="closeModal()">✕</button></div>
    <div class="modal-body">
      <div class="form-group"><label>Closing Cash (₱)</label><input type="number" id="closing-cash" class="form-control" placeholder="Physical cash in drawer" min="0" step="0.01"></div>
      <div class="form-group"><label>Shift Handover Note</label><textarea id="handover-note" class="form-control" rows="3" placeholder="Pending orders, low-stock observations, customer concerns, equipment issues..."></textarea></div>
      <div class="alert alert-warning">${iconSvg('warning')} Count all physical cash in the drawer and enter the total below.</div>
    </div>
    <div class="modal-footer"><button class="btn btn-outline" onclick="closeModal()">Cancel</button><button class="btn btn-danger" onclick="confirmCloseShift()">Close Shift</button></div>`);
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
      <div class="form-group"><label>Type</label><div class="form-select-wrap"><select id="cm-type" class="form-control"><option value="payin">Pay-In (add cash)</option><option value="payout">Pay-Out (remove cash)</option></select></div></div>
      <div class="form-group"><label>Amount (₱)</label><input type="number" id="cm-amount" class="form-control" placeholder="0.00" min="0" step="0.01"></div>
      <div class="form-group"><label>Reason</label><input type="text" id="cm-reason" class="form-control" placeholder="Describe the reason..."></div>
    </div>
    <div class="modal-footer"><button class="btn btn-outline" onclick="closeModal()">Cancel</button><button class="btn btn-maroon" onclick="confirmCashMove()">Confirm</button></div>`);
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
  showModal(`<div class="modal-header"><h2>Void Sale</h2><button class="btn-close-modal" onclick="closeModal()">✕</button></div>
    <div class="modal-body">
      <div class="alert alert-error-box">${iconSvg('warning')} This action cannot be undone. The sale will be marked as voided.</div>
      <div class="form-group"><label>Void Reason (Required)</label><input type="text" id="void-reason" class="form-control" placeholder="Enter reason for voiding..."></div>
    </div>
    <div class="modal-footer"><button class="btn btn-outline" onclick="closeModal()">Cancel</button><button class="btn btn-danger" onclick="confirmVoid('${saleId}')">Void Sale</button></div>`);
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
  recordAudit(s, { action: 'sale_voided', message: `Sale voided: ${saleId} — ${reason}`, referenceId: saleId });
  saveState(s);
  DB.voidSale(saleId, reason);
  closeModal();
  showToast('Sale voided.', 'warning');
  renderSales();
}

// PRODUCT MANAGEMENT
function deleteProduct(pid) {
  if (!confirm('Delete this product? This cannot be undone.')) return;
  const s = getState();
  if (!s.currentUser || s.currentUser.role !== 'admin') { showToast('Only Administrators can delete products.', 'error'); return; }
  s.products = s.products.filter(p => p.id !== pid);
  saveState(s);
  DB.deleteProduct(pid);
  showToast('Product deleted!', 'success');
  renderProductMgmt();
}

var _pmTab = 'branch'; // 'branch' | 'print'
function switchPmTab(tab) { _pmTab = tab; _renderProductMgmtPage(); }

function renderProductMgmt() {
  const _pm = getState();
  if (!_pm.currentUser || _pm.currentUser.role !== 'admin') { accessDenied('Product Management'); return; }
  _renderProductMgmtPage();
}

function _renderProductMgmtPage() {
  const page = 'product-mgmt';
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
      '<button class="btn btn-sm btn-outline" onclick="editProductModal(\\"' + p.id + '\\")">Edit</button> ' +
      '<button class="btn btn-sm btn-icon" onclick="toggleProduct(\\"' + p.id + '\\")" title="' + (p.active ? 'Deactivate' : 'Activate') + '">' + (p.active ? iconSvg('lock') : iconSvg('lockOpen')) + '</button> ' +
      '<button class="btn btn-sm btn-icon" onclick="deleteProduct(\\"' + p.id + '\\")" title="Delete">' + iconSvg('error') + '</button>' +
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
      '<button class="btn btn-sm btn-outline" onclick="editPrintProductModal(\\"' + p.id + '\\")">Edit</button> ' +
      '<button class="btn btn-sm btn-icon" onclick="togglePrintProduct(\\"' + p.id + '\\")" title="' + (p.active ? 'Deactivate' : 'Activate') + '">' + (p.active ? iconSvg('lock') : iconSvg('lockOpen')) + '</button> ' +
      '<button class="btn btn-sm btn-icon" onclick="deletePrintProduct(\\"' + p.id + '\\")" title="Delete">' + iconSvg('error') + '</button>' +
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
    '<div><h1 class="page-title">Product Management</h1><p class="page-subtitle">' +
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
    'modal-lg');
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
  closeModal();
  showToast('Printing material added!', 'success');
  _pmTab = 'print';
  _renderProductMgmtPage();
}

function editPrintProductModal(pid) {
  const s = getState();
  const p = (s.printProducts || []).find(x => x.id === pid);
  if (!p) return;
  const varRows = p.variants.map(v =>
    '<div class="product-form-variant-row" data-vid="' + v.id + '" style="grid-template-columns:1.2fr 0.8fr 0.8fr 0.7fr 0.8fr 0.6fr 0.5fr auto">'
    + '<input class="form-control vn-name" value="' + (v.name||''   ).replace(/"/g,'&quot;') + '" placeholder="Variant name">'
    + '<input class="form-control vn-size" value="' + (v.size||''   ).replace(/"/g,'&quot;') + '" placeholder="Size">'
    + '<input class="form-control vn-color" value="' + (v.color||''  ).replace(/"/g,'&quot;') + '" placeholder="Color name">'
    + '<input class="form-control vn-colorhex" value="' + (v.colorHex||'').replace(/"/g,'&quot;') + '" placeholder="#000000" style="font-family:monospace">'
    + '<input class="form-control vn-sku" value="' + (v.sku||''    ).replace(/"/g,'&quot;') + '" placeholder="SKU">'
    + '<input class="form-control vn-price" type="number" value="' + (v.price||0) + '" placeholder="Unit Cost">'
    + '<input class="form-control vn-stock" type="number" value="' + (v.stock||0) + '" placeholder="Stock">'
    + '</div>'
  ).join('');
  showModal(
    '<div class="modal-header"><h2>Edit Printing Material</h2><button class="btn-close-modal" onclick="closeModal()">&#x2715;</button></div>'
    + '<div class="modal-body">'
    + '<div class="form-group"><label>Material Type</label><input id="pep-type" class="form-control" value="' + (p.materialType||'').replace(/"/g,'&quot;') + '" placeholder="e.g. Ink, Paper, Plate"></div>'
    + '<div class="form-group"><label>Material Name</label><input id="pep-name" class="form-control" value="' + p.name.replace(/"/g,'&quot;') + '"></div>'
    + '<div class="form-group"><label>Description</label><input id="pep-desc" class="form-control" value="' + (p.desc||'').replace(/"/g,'&quot;') + '"></div>'
    + '<hr class="divider">'
    + '<div style="margin-bottom:8px"><strong style="font-size:14px">Variants</strong></div>'
    + '<div style="font-size:11px;color:var(--ink-50);margin-bottom:10px">Name &middot; Size &middot; Color &middot; Color Hex &middot; SKU &middot; Unit Cost &middot; Stock</div>'
    + '<div id="pep-variant-rows">' + varRows + '</div>'
    + '</div>'
    + '<div class="modal-footer"><button class="btn btn-outline" onclick="closeModal()">Cancel</button><button class="btn btn-maroon" onclick="confirmEditPrintProduct(&quot;' + pid + '&quot;)">Save</button></div>'
  );
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
  closeModal();
  showToast('Printing material updated!', 'success');
  _pmTab = 'print';
  _renderProductMgmtPage();
}

function togglePrintProduct(pid) {
  const s = getState();
  const p = (s.printProducts || []).find(x => x.id === pid);
  if (p) { p.active = !p.active; saveState(s); showToast(`Material ${p.active ? 'activated' : 'deactivated'}.`, 'success'); _pmTab = 'print'; _renderProductMgmtPage(); }
}

function deletePrintProduct(pid) {
  if (!confirm('Delete this printing material? This cannot be undone.')) return;
  const s = getState();
  s.printProducts = (s.printProducts || []).filter(p => p.id !== pid);
  saveState(s);
  showToast('Printing material deleted!', 'success');
  _pmTab = 'print';
  _renderProductMgmtPage();
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
      <div id="variant-rows"><div class="product-form-variant-row"><input class="form-control vn-name" placeholder="Variant name (e.g. 8oz)"><input class="form-control vn-sku" placeholder="SKU"><input class="form-control vn-price" type="number" placeholder="Price"><button class="btn-icon" onclick="this.closest('.product-form-variant-row').remove()">${iconSvg('error')}</button></div></div>
    </div>
    <div class="modal-footer"><button class="btn btn-outline" onclick="closeModal()">Cancel</button><button class="btn btn-maroon" onclick="confirmAddProduct()">Add Product</button></div>`, 'modal-lg');

  // Close dropdown when clicking outside the suggest wrap
  setTimeout(() => {
    document.addEventListener('mousedown', _pmSuggestOutsideClick);
  }, 0);
}

function _buildSuggestOpts(suggestions) {
  return suggestions.map(p =>
    `<div class="product-suggest-item" onmousedown="event.preventDefault();applyProductSuggestion('${p.id}')">${p.name} <span class="text-xs text-muted">${p.desc || ''}</span></div>`
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
  const list = document.getElementById('np-suggest-list');
  if (list) list.style.display = 'none';
  document.removeEventListener('mousedown', _pmSuggestOutsideClick);

  // Fill variant rows
  const container = document.getElementById('variant-rows');
  container.innerHTML = '';
  p.variants.forEach(v => {
    const sku = buildVariantSku(p.name, v.name, Math.floor(Math.random() * 9000 + 1000));
    const row = document.createElement('div');
    row.className = 'product-form-variant-row';
    row.innerHTML = `<input class="form-control vn-name" placeholder="Variant name" value="${v.name}"><input class="form-control vn-sku" placeholder="SKU" value="${sku}"><input class="form-control vn-price" type="number" placeholder="Price" value="${v.price}"><button class="btn-icon" onclick="this.closest('.product-form-variant-row').remove()">${iconSvg('error')}</button>`;
    container.appendChild(row);
  });
  applySvgToElement(container);
}

function addVariantRow() {
  const html = `<div class="product-form-variant-row"><input class="form-control vn-name" placeholder="Variant name"><input class="form-control vn-size" placeholder="Size (e.g. 8oz)"><input class="form-control vn-sku" placeholder="SKU"><input class="form-control vn-price" type="number" placeholder="Price"><button class="btn-icon" onclick="this.closest('.product-form-variant-row').remove()">${iconSvg('error')}</button></div>`;
  document.getElementById('variant-rows').insertAdjacentHTML('beforeend', html);
}

function confirmAddProduct() {
  const name = document.getElementById('np-name').value.trim();
  const desc = document.getElementById('np-desc').value.trim();
  const productType = (document.getElementById('np-type')?.value || '').trim();
  if (!name) { showToast('Product name required', 'error'); return; }
  const variants = [];
  document.querySelectorAll('.product-form-variant-row').forEach(row => {
    const vname = row.querySelector('.vn-name').value.trim();
    const size = (row.querySelector('.vn-size')?.value || '').trim();
    const sku = row.querySelector('.vn-sku').value.trim();
    const price = parseFloat(row.querySelector('.vn-price').value) || 0;
    if (vname) variants.push({ name: vname, size, sku, price, stock: 100 });
  });
  if (!variants.length) { showToast('At least one variant required', 'error'); return; }
  const s = getState();
  const newProduct = {
    id: 'prod_' + Date.now(),
    name, desc, productType, active: true,
    variants: variants.map(v => ({
      id: 'var_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      name: v.name, size: v.size, sku: v.sku, price: v.price, stock: v.stock || 100,
      reorderLevel: 20, reserved: 0, branchStocks: {}
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
  showModal(`<div class="modal-header"><h2>Edit Product</h2><button class="btn-close-modal" onclick="closeModal()">✕</button></div>
    <div class="modal-body">
      <div class="form-group"><label>Product Type</label><input id="ep-type" class="form-control" value="${p.productType || ''}" placeholder="e.g. Cup, Box, Bag"></div>
      <div class="form-group"><label>Product Name</label><input id="ep-name" class="form-control" value="${p.name}"></div>
      <div class="form-group"><label>Description</label><input id="ep-desc" class="form-control" value="${p.desc || ''}"></div>
      <hr class="divider">
      <div style="margin-bottom:12px"><strong style="font-size:14px">Variants</strong></div>
      <div id="ep-variant-rows">${p.variants.map(v => `<div class="product-form-variant-row" data-vid="${v.id}">
        <input class="form-control vn-name" value="${v.name}" placeholder="Variant name">
        <input class="form-control vn-size" value="${v.size || ''}" placeholder="Size (e.g. 8oz)">
        <input class="form-control vn-sku" value="${v.sku}" placeholder="SKU">
        <input class="form-control vn-price" type="number" value="${v.price}" placeholder="Price">
        <input class="form-control vn-stock" type="number" value="${v.stock}" placeholder="Stock" style="width:80px">
      </div>`).join('')}</div>
    </div>
    <div class="modal-footer"><button class="btn btn-outline" onclick="closeModal()">Cancel</button><button class="btn btn-maroon" onclick="confirmEditProduct('${pid}')">Save</button></div>`);
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

// INVENTORY
var _invFilter = { search: '', status: 'all' };
function clearInvFilter() { _invFilter = { search: '', status: 'all' }; _renderInventoryPage(); }

function renderInventory() {
  _invFilter = { search: '', status: 'all' };
  _renderInventoryPage();
}

function _renderInventoryPage() {
  const s = getState();
  const isAdmin = s.currentUser && s.currentUser.role === 'admin';

  const allVariants = s.products.filter(p => p.active).flatMap(p =>
    (p.variants || []).map(v => ({ p, v, reorderLevel: v.reorderLevel ?? 20 }))
  );

  const totalVariants = allVariants.length;
  const lowStockCount = allVariants.filter(({ v, reorderLevel }) => v.stock > 0 && v.stock <= reorderLevel).length;
  const outOfStockCount = allVariants.filter(({ v }) => v.stock === 0).length;
  const healthyCount = totalVariants - lowStockCount - outOfStockCount;

  const q = (_invFilter.search || '').toLowerCase();
  const filtered = allVariants.filter(({ p, v, reorderLevel }) => {
    const matchSearch = !q ||
      p.name.toLowerCase().includes(q) ||
      (p.productType || '').toLowerCase().includes(q) ||
      v.name.toLowerCase().includes(q) ||
      (v.size || '').toLowerCase().includes(q) ||
      (v.sku || '').toLowerCase().includes(q);
    const lvl = v.stock === 0 ? 'out' : v.stock <= reorderLevel ? 'low' : 'ok';
    const matchStatus =
      _invFilter.status === 'all' ? true :
        _invFilter.status === 'low' ? lvl === 'low' :
          _invFilter.status === 'out' ? lvl === 'out' :
            _invFilter.status === 'ok' ? lvl === 'ok' : true;
    return matchSearch && matchStatus;
  });

  document.getElementById('page-content').innerHTML = `
    <div class="page-header" style="display:flex;justify-content:space-between;align-items:flex-start">
      <div><h1 class="page-title">Branch Inventory</h1><p class="page-subtitle">Stock monitoring across all branch products</p></div>
    </div>

    <div class="kpi-grid">
      <div class="kpi-card"><div class="kpi-header"><div class="kpi-label">Total Variants</div><div class="kpi-icon blue">${iconSvg('box')}</div></div><div class="kpi-value">${totalVariants}</div><div class="kpi-sub">${s.products.filter(p => p.active).length} active products</div></div>
      <div class="kpi-card"><div class="kpi-header"><div class="kpi-label">Healthy Stock</div><div class="kpi-icon green">${iconSvg('check')}</div></div><div class="kpi-value">${healthyCount}</div><div class="kpi-sub">Above reorder level</div></div>
      <div class="kpi-card" style="cursor:pointer" onclick="_invFilter.status='low';_renderInventoryPage()"><div class="kpi-header"><div class="kpi-label">Low Stock</div><div class="kpi-icon gold">${iconSvg('warning')}</div></div><div class="kpi-value" style="color:${lowStockCount > 0 ? 'var(--warning)' : 'inherit'}">${lowStockCount}</div><div class="kpi-sub">At or below reorder level</div></div>
      <div class="kpi-card" style="cursor:pointer" onclick="_invFilter.status='out';_renderInventoryPage()"><div class="kpi-header"><div class="kpi-label">Out of Stock</div><div class="kpi-icon maroon">${iconSvg('error')}</div></div><div class="kpi-value" style="color:${outOfStockCount > 0 ? 'var(--danger)' : 'inherit'}">${outOfStockCount}</div><div class="kpi-sub">Zero units remaining</div></div>
    </div>

    ${(lowStockCount + outOfStockCount) > 0 ? '<div class="alert alert-error-box">' + iconSvg('warning') + ' ' + (lowStockCount + outOfStockCount) + ' variant(s) need attention. Click the KPI cards above to filter.</div>' : ''}

    <div class="data-card">
      <div class="data-card-header">
        <span class="data-card-title">Stock Levels</span>
        <span class="text-sm text-muted">${filtered.length} of ${totalVariants} variants</span>
      </div>
      <div class="data-card-body" style="padding:12px 16px;border-bottom:1px solid var(--ink-10);display:flex;gap:10px;flex-wrap:wrap;align-items:center">
        <input class="form-control" style="flex:1;min-width:200px;max-width:360px"
          placeholder="Search type, size, product..."
          value="${_invFilter.search}"
          oninput="_invFilter.search=this.value;_renderInventoryPage()">
        <select class="form-control" style="width:auto" onchange="_invFilter.status=this.value;_renderInventoryPage()">
          <option value="all" ${_invFilter.status === 'all' ? 'selected' : ''}>All Stock</option>
          <option value="ok" ${_invFilter.status === 'ok' ? 'selected' : ''}>Healthy</option>
          <option value="low" ${_invFilter.status === 'low' ? 'selected' : ''}>Low Stock</option>
          <option value="out" ${_invFilter.status === 'out' ? 'selected' : ''}>Out of Stock</option>
        </select>
        ${_invFilter.search || _invFilter.status !== 'all' ? '<button class="btn btn-sm btn-outline" onclick="clearInvFilter()">Clear Filter</button>' : ''}
      </div>
      <div class="data-card-body no-pad">
        <table class="data-table">
          <thead><tr>
            <th>Product Type</th>
            <th>Product Size</th>
            <th>Current Stock</th>
            <th>Reorder Point</th>
            <th>Max Stock</th>
            <th>Last Count Date</th>
            <th>Status</th>
            <th>Adjust</th>
          </tr></thead>
          <tbody>${filtered.length === 0 ? `
            <tr><td colspan="8" style="text-align:center;padding:32px;color:var(--ink-60)">
              ${_invFilter.search || _invFilter.status !== 'all' ? 'No variants match your search.' : 'No inventory data yet.'}
            </td></tr>` :
      filtered.map(({ p, v, reorderLevel }) => {
        const maxStock = v.maxStock ?? (reorderLevel * 3);
        const stockColor = v.stock === 0 ? 'var(--danger)' : v.stock <= reorderLevel ? 'var(--warning)' : 'var(--success)';
        const statusBadge = v.stock === 0
          ? '<span class="badge badge-danger">Out of Stock</span>'
          : v.stock <= reorderLevel
            ? '<span class="badge badge-warning">Low Stock</span>'
            : '<span class="badge badge-success">Healthy</span>';
        const lastCount = v.lastCountDate
          ? new Date(v.lastCountDate).toLocaleDateString('en-PH', { year:'numeric', month:'short', day:'numeric' })
          : '<span class="text-muted">\u2014</span>';
        return `<tr>
                <td><strong>${p.productType || p.name}</strong><div style="font-size:11px;color:var(--ink-50)">${p.name}</div></td>
                <td>${v.size || v.name}</td>
                <td class="td-mono" style="font-weight:700;color:${stockColor}">${v.stock}</td>
                <td class="td-mono">${reorderLevel}</td>
                <td class="td-mono">${maxStock}</td>
                <td class="td-mono" style="font-size:12px">${lastCount}</td>
                <td>${statusBadge}</td>
                <td>${isAdmin ? '<button class="btn btn-sm btn-outline" onclick="adjustStockModal(\'' + p.id + '\',\'' + v.id + '\')">' + 'Adjust</button>' : '<span class="badge badge-neutral">View Only</span>'}</td>
              </tr>`;
      }).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
}

function adjustStockModal(pid, vid) {
  const s = getState();
  if (!s.currentUser || s.currentUser.role !== 'admin') { showToast('Only Administrators can adjust stock.', 'error'); return; }
  const p = s.products.find(x => x.id === pid);
  const v = p?.variants.find(x => x.id === vid);
  if (!v) return;
  const maxStock = v.maxStock ?? ((v.reorderLevel ?? 20) * 3);
  showModal(`<div class="modal-header"><h2>Adjust Stock — ${p.productType || p.name} · ${v.size || v.name}</h2><button class="btn-close-modal" onclick="closeModal()">✕</button></div>
    <div class="modal-body">
      <div class="alert alert-info">Current stock: <strong>${v.stock} units</strong>${v.lastCountDate ? ' · Last count: ' + new Date(v.lastCountDate).toLocaleDateString('en-PH', {year:'numeric',month:'short',day:'numeric'}) : ''}</div>
      <div class="form-group"><label>Adjustment Type</label><div class="form-select-wrap"><select id="adj-type" class="form-control"><option value="add">Add Stock (+)</option><option value="remove">Remove Stock (−)</option><option value="set">Set Exact Value</option></select></div></div>
      <div class="form-group"><label>Quantity</label><input type="number" id="adj-qty" class="form-control" placeholder="0" min="0"></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div class="form-group"><label>Reorder Point</label><input type="number" id="adj-reorder" class="form-control" placeholder="20" min="1" value="${v.reorderLevel ?? 20}"></div>
        <div class="form-group"><label>Max Stock</label><input type="number" id="adj-maxstock" class="form-control" placeholder="${maxStock}" min="1" value="${maxStock}"></div>
      </div>
    </div>
    <div class="modal-footer"><button class="btn btn-outline" onclick="closeModal()">Cancel</button><button class="btn btn-maroon" onclick="confirmAdjustStock('${pid}','${vid}')">Apply</button></div>`);
}

function confirmAdjustStock(pid, vid) {
  const type = document.getElementById('adj-type').value;
  const qty = parseInt(document.getElementById('adj-qty').value) || 0;
  const reorderLevel = Math.max(1, parseInt(document.getElementById('adj-reorder').value) || 20);
  const maxStock = Math.max(1, parseInt(document.getElementById('adj-maxstock').value) || reorderLevel * 3);

  const s = getState();
  const prod = s.products.find(x => x.id === pid);
  const variant = prod?.variants.find(x => x.id === vid);
  if (!variant) { showToast('Variant not found.', 'error'); return; }
  if (type === 'add') variant.stock = (variant.stock || 0) + qty;
  else if (type === 'remove') variant.stock = Math.max(0, (variant.stock || 0) - qty);
  else if (type === 'set') variant.stock = Math.max(0, qty);
  variant.reorderLevel = reorderLevel;
  variant.maxStock = maxStock;
  variant.lastCountDate = new Date().toISOString();

  const branchIds = (s.branches || []).map(b => b.id);
  const split = Math.floor(variant.stock / Math.max(1, branchIds.length));
  let remainder = variant.stock - split * branchIds.length;
  variant.branchStocks = variant.branchStocks || {};
  branchIds.forEach((bid) => {
    variant.branchStocks[bid] = split + (remainder > 0 ? 1 : 0);
    if (remainder > 0) remainder--;
  });

  saveState(s);
  DB.updateProduct(pid, { name: prod.name, desc: prod.desc, variants: prod.variants });
  closeModal();
  showToast('Stock updated.', 'success');
  renderInventory();
}

// PERSONNEL MANAGEMENT
function renderPersonnelMgmt() {
  const s = getState();
  const me = s.currentUser;
  if (!me || !['admin', 'print'].includes(me.role)) { accessDenied('Personnel Management'); return; }

  // Print role: show only print department personnel
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
  const staffUsers = s.users.filter(u => u.role === 'staff');
  document.getElementById('page-content').innerHTML = `
    <div class="page-header"><h1 class="page-title">Personnel Management</h1><p class="page-subtitle">Manage staff, schedules, and payroll.</p></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:24px">
      <div class="data-card" style="cursor:pointer" onclick="navigateTo('shift-schedule')">
        <div class="data-card-header"><span class="data-card-title">${iconSvg('calendar')} Shift Schedule</span><span class="badge badge-maroon">→</span></div>
        <div class="data-card-body"><p class="text-sm text-muted">Assign Opening and Closing shifts to staff per day or week across all branches.</p></div>
      </div>
      <div class="data-card" style="cursor:pointer" onclick="navigateTo('payroll')">
        <div class="data-card-header"><span class="data-card-title">${iconSvg('money')} Payroll</span><span class="badge badge-maroon">→</span></div>
        <div class="data-card-body"><p class="text-sm text-muted">View payroll estimates based on shift hours and assigned rates per branch.</p></div>
      </div>
    </div>
    <div class="data-card"><div class="data-card-header"><span class="data-card-title">All Staff</span><span class="badge badge-neutral">${staffUsers.length} staff members</span></div>
      <div class="data-card-body no-pad">
        <table class="data-table"><thead><tr><th>Name</th><th>Username</th><th>Branch</th><th>Active Shift</th><th>Shifts This Month</th></tr></thead>
        <tbody>${staffUsers.map(u => {
    const branch = s.branches.find(b => b.id === u.branchId);
    const myShift = s.shifts.find(x => x.userId === u.id && x.status === 'open');
    const monthShifts = s.shifts.filter(x => x.userId === u.id && new Date(x.openedAt).getMonth() === new Date().getMonth()).length;
    return `<tr>
            <td><strong>${u.name}</strong></td>
            <td class="td-mono">${u.username}</td>
            <td>${branch?.name || '–'}</td>
            <td>${myShift ? `<span class="badge badge-success">${iconSvg('statusOpen')} Open</span>` : '<span class="badge badge-neutral">Closed</span>'}</td>
            <td>${monthShifts}</td>
          </tr>`;
  }).join('')}</tbody>
        </table>
      </div>
    </div>`;
}

// SHIFT SCHEDULE
function renderShiftSchedule() {
  const s = getState();
  if (!s.currentUser || s.currentUser.role !== 'admin') { accessDenied('Shift Schedule'); return; }
  const view = s.scheduleView || 'daily';
  const today = new Date();

  const branchCards = s.branches.map((b, i) => {
    const staffCount = s.users.filter(u => u.branchId === b.id && u.role === 'staff').length;
    const dateKey = s.scheduleDate;
    const assigned = s.users.filter(u => u.branchId === b.id && u.role === 'staff')
      .filter(u => s.shiftSchedules[`${u.id}_${dateKey}`] && s.shiftSchedules[`${u.id}_${dateKey}`] !== 'Off').length;
    return `<div class="branch-card-mini b${i + 1}"><strong>${iconSvg('store')} ${b.name}</strong><span>${staffCount} staff · ${assigned} assigned on selected date</span></div>`;
  }).join('');

  let tableHtml = '';
  if (view === 'daily') {
    const dateLabel = new Date(s.scheduleDate + 'T00:00:00').toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    tableHtml = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">
        <div class="schedule-nav">
          <button class="btn btn-sm btn-outline" onclick="shiftDay(-1)">← Prev Day</button>
          <span class="schedule-date-label">${dateLabel}</span>
          <button class="btn btn-sm btn-outline" onclick="shiftDay(1)">Next Day →</button>
        </div>
        <button class="btn btn-sm btn-outline" onclick="goToday()">Today</button>
      </div>
      <div class="data-card">
        ${s.branches.map((branch, bi) => {
      const branchStaff = s.users.filter(u => u.branchId === branch.id && u.role === 'staff');
      return `<div class="branch-section-header"><h3>${iconSvg('store')} ${branch.name}</h3><span>${branch.address} · ${branchStaff.length} staff</span></div>
          <table class="data-table schedule-table">
            <thead><tr><th>Staff Member</th><th>Shift Assignment</th><th>Notes</th></tr></thead>
            <tbody>${branchStaff.map(u => {
        const key = `${u.id}_${s.scheduleDate}`;
        const val = s.shiftSchedules[key] || 'Off';
        const color = val === 'Opening' ? 'var(--success)' : val === 'Closing' ? 'var(--maroon)' : 'var(--ink-60)';
        return `<tr>
                <td><strong>${u.name}</strong><div class="text-xs text-muted">${u.username}</div></td>
                <td>
                  <select class="shift-select" style="color:${color};font-size:11.5px;padding:4px 22px 4px 8px" data-uid="${u.id}" data-date="${s.scheduleDate}" onchange="saveSchedule(this)">
                    <option ${val === 'Off' ? 'selected' : ''}>Off</option>
                    <option ${val === 'Opening' ? 'selected' : ''}>Opening</option>
                    <option ${val === 'Closing' ? 'selected' : ''}>Closing</option>
                  </select>
                </td>
                <td class="text-xs text-muted">${val === 'Opening' ? '7:30 AM – 4:30 PM' : val === 'Closing' ? '10:30 AM – 7:30 PM' : '—'}</td>
              </tr>`;
      }).join('') || `<tr><td colspan="3" style="text-align:center;padding:20px;color:var(--ink-60)">No staff in this branch.</td></tr>`}
            </tbody>
          </table>`;
    }).join('')}
      </div>`;
  } else {
    // Weekly
    const weekStart = new Date(s.scheduleWeekStart + 'T00:00:00');
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      return d;
    });
    const weekLabel = `${days[0].toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })} – ${days[6].toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    tableHtml = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">
        <div class="schedule-nav">
          <button class="btn btn-sm btn-outline" onclick="shiftWeek(-1)">← Prev Week</button>
          <span class="schedule-date-label">${weekLabel}</span>
          <button class="btn btn-sm btn-outline" onclick="shiftWeek(1)">Next Week →</button>
        </div>
        <button class="btn btn-sm btn-outline" onclick="goToday()">This Week</button>
      </div>
      <div class="data-card">
        ${s.branches.map((branch, bi) => {
      const branchStaff = s.users.filter(u => u.branchId === branch.id && u.role === 'staff');
      return `<div class="branch-section-header"><h3>${iconSvg('store')} ${branch.name}</h3><span>${branch.address}</span></div>
          <table class="data-table schedule-table" style="font-size:12.5px">
            <thead><tr><th>Staff</th>${days.map(d => `<th style="text-align:center">${d.toLocaleDateString('en-PH', { weekday: 'short' })}<br><span style="font-weight:400;color:var(--ink-60)">${d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}</span></th>`).join('')}<th>Summary</th></tr></thead>
            <tbody>${branchStaff.map(u => {
        const vals = days.map(d => {
          const key = `${u.id}_${toLocalDateString(d)}`;
          return s.shiftSchedules[key] || 'Off';
        });
        const opens = vals.filter(v => v === 'Opening').length;
        const closes = vals.filter(v => v === 'Closing').length;
        return `<tr>
                <td><strong>${u.name}</strong></td>
                ${days.map((d, di) => {
          const dateStr = d.toISOString().slice(0, 10);
          const key = `${u.id}_${dateStr}`;
          const val = s.shiftSchedules[key] || 'Off';
          const color = val === 'Opening' ? 'var(--success)' : val === 'Closing' ? 'var(--maroon)' : 'var(--ink-60)';
          return `<td style="text-align:center">
                    <select class="shift-select" style="color:${color};font-size:11.5px;padding:4px 22px 4px 8px" data-uid="${u.id}" data-date="${dateStr}" onchange="saveSchedule(this)">
                      <option ${val === 'Off' ? 'selected' : ''}>Off</option>
                      <option ${val === 'Opening' ? 'selected' : ''}>Opening</option>
                      <option ${val === 'Closing' ? 'selected' : ''}>Closing</option>
                    </select>
                  </td>`;
        }).join('')}
                <td><span class="badge badge-success" style="font-size:11px">${opens} Open</span> <span class="badge badge-maroon" style="font-size:11px">${closes} Close</span></td>
              </tr>`;
      }).join('') || `<tr><td colspan="${days.length + 2}" style="text-align:center;padding:20px;color:var(--ink-60)">No staff in this branch.</td></tr>`}
            </tbody>
          </table>`;
    }).join('')}
      </div>`;
  }

  document.getElementById('page-content').innerHTML = `
    <div class="page-header" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
      <div><h1 class="page-title">Shift Schedule</h1><p class="page-subtitle">Assign Opening / Closing shifts per branch</p></div>
      <div style="display:flex;align-items:center;gap:10px">
        <button class="btn btn-sm btn-outline" onclick="autoAssignWeek()">Auto-Assign Week</button>
        <div class="schedule-view-toggle">
        <button class="view-toggle-btn ${view === 'daily' ? 'active' : ''}" onclick="setScheduleView('daily')">${iconSvg('calendar')} Daily</button>
        <button class="view-toggle-btn ${view === 'weekly' ? 'active' : ''}" onclick="setScheduleView('weekly')">${iconSvg('note')} Weekly</button>
        </div>
      </div>
    </div>
    <div style="display:flex;gap:12px;margin-bottom:20px">${branchCards}</div>
    ${tableHtml}`;

  applySvgToElement(document.getElementById('page-content'));
}

function saveSchedule(selectEl) {
  const s = getState();
  const uid = selectEl.dataset.uid;
  const date = selectEl.dataset.date;
  const val = selectEl.value;
  const allowed = ['Off', 'Opening', 'Closing'];
  const staffUser = s.users.find(u => u.id === uid && u.role === 'staff');
  if (!staffUser) { showToast('Invalid staff selected.', 'error'); return; }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) { showToast('Invalid schedule date.', 'error'); return; }
  if (!allowed.includes(val)) { showToast('Invalid shift value.', 'error'); return; }
  s.shiftSchedules[`${uid}_${date}`] = val;
  const color = val === 'Opening' ? 'var(--success)' : val === 'Closing' ? 'var(--maroon)' : 'var(--ink-60)';
  selectEl.style.color = color;
  selectEl.style.borderColor = val === 'Opening' ? 'var(--success)' : val === 'Closing' ? 'var(--maroon)' : 'var(--ink-10)';
  selectEl.style.backgroundColor = val === 'Opening' ? 'var(--success-l)' : val === 'Closing' ? 'var(--maroon-xs)' : 'var(--white)';
  saveState(s);
  DB.saveShiftSchedule(uid, date, val);
  showToast(`Saved: ${selectEl.dataset.date} → ${val}`, 'success');
}

function setScheduleView(v) {
  const s = getState();
  s.scheduleView = v;
  saveState(s);
  renderShiftSchedule();
}
function shiftDay(delta) {
  const s = getState();
  const d = new Date(s.scheduleDate + 'T00:00:00');
  d.setDate(d.getDate() + delta);
  s.scheduleDate = toLocalDateString(d);
  saveState(s);
  renderShiftSchedule();
}
function shiftWeek(delta) {
  const s = getState();
  const d = new Date(s.scheduleWeekStart + 'T00:00:00');
  d.setDate(d.getDate() + delta * 7);
  s.scheduleWeekStart = toLocalDateString(d);
  saveState(s);
  renderShiftSchedule();
}
function goToday() {
  const s = getState();
  s.scheduleDate = toLocalDateString(new Date());
  s.scheduleWeekStart = toLocalDateString(getMonday(new Date()));
  saveState(s);
  renderShiftSchedule();
}

function autoAssignWeek() {
  const s = getState();
  const weekAnchor = s.scheduleView === 'weekly'
    ? new Date((s.scheduleWeekStart || toLocalDateString(getMonday(new Date()))) + 'T00:00:00')
    : getMonday(new Date((s.scheduleDate || toLocalDateString(new Date())) + 'T00:00:00'));

  if (!confirm('Auto-assign Opening/Closing shifts for this week? This will overwrite existing assignments for the week.')) return;

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekAnchor);
    d.setDate(weekAnchor.getDate() + i);
    return d;
  });

  const branches = s.branches || [];
  let assignedCount = 0;

  branches.forEach(branch => {
    const staff = (s.users || []).filter(u => u.role === 'staff' && u.branchId === branch.id).sort((a, b) => a.id.localeCompare(b.id));
    if (!staff.length) return;

    days.forEach((day, dayIndex) => {
      const dateStr = toLocalDateString(day);

      staff.forEach(user => {
        s.shiftSchedules[`${user.id}_${dateStr}`] = 'Off';
      });

      if (staff.length === 1) {
        const only = staff[0];
        s.shiftSchedules[`${only.id}_${dateStr}`] = dayIndex % 2 === 0 ? 'Opening' : 'Closing';
        assignedCount += 1;
      } else {
        const openingUser = staff[dayIndex % staff.length];
        const closingUser = staff[(dayIndex + 1) % staff.length];
        s.shiftSchedules[`${openingUser.id}_${dateStr}`] = 'Opening';
        s.shiftSchedules[`${closingUser.id}_${dateStr}`] = 'Closing';
        assignedCount += 2;
      }
    });
  });

  s.scheduleWeekStart = toLocalDateString(getMonday(weekAnchor));
  saveState(s);
  renderShiftSchedule();
  showToast(`Auto-assigned ${assignedCount} shifts for the selected week.`, 'success');
}

// PAYROLL
function renderPayroll() {
  const s = getState();
  const me = s.currentUser;
  if (!me) { accessDenied('Payroll'); return; }

  // Staff: show only their own payroll row
  if (me.role === 'staff') {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const DAILY_RATE = 600;
    const monthShifts = s.shifts.filter(x => x.userId === me.id && new Date(x.openedAt) >= monthStart && x.status !== 'open');
    const gross = monthShifts.length * DAILY_RATE;
    const sss = Math.round(gross * 0.045);
    const net = gross - sss;
    document.getElementById('page-content').innerHTML = `
      <div class="page-header"><h1 class="page-title">My Payroll</h1><p class="page-subtitle">${now.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' })}</p></div>
      <div class="payroll-summary">
        <div class="payroll-item"><label>Shifts Worked</label><strong>${monthShifts.length}</strong></div>
        <div class="payroll-item"><label>Gross Pay</label><strong>₱${fmt(gross)}</strong></div>
        <div class="payroll-item"><label>SSS Deduction</label><strong style="color:var(--danger)">₱${fmt(sss)}</strong></div>
        <div class="payroll-item"><label>Net Pay</label><strong style="color:var(--success)">₱${fmt(net)}</strong></div>
      </div>
      <div class="data-card"><div class="data-card-header"><span class="data-card-title">Shift History This Month</span></div>
        <div class="data-card-body no-pad">
          <table class="data-table"><thead><tr><th>Date</th><th>Opened</th><th>Closed</th><th>Sales</th></tr></thead>
          <tbody>${monthShifts.length ? monthShifts.map(sh => `<tr>
            <td>${new Date(sh.openedAt).toLocaleDateString('en-PH')}</td>
            <td>${fmtTime(sh.openedAt)}</td>
            <td>${sh.closedAt ? fmtTime(sh.closedAt) : '<span class="badge badge-success">Open</span>'}</td>
            <td>${s.sales.filter(x => x.shiftId === sh.id && !x.voided).length}</td>
          </tr>`).join('') : '<tr><td colspan="4" style="text-align:center;padding:16px;color:var(--ink-60)">No shifts this month.</td></tr>'}</tbody>
          </table>
        </div>
      </div>`;
    return;
  }

  // Print role: show print personnel payroll
  if (me.role === 'print') {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const DAILY_RATE = 600;
    const printUsers = s.users.filter(u => u.role === 'print');
    const payrollData = printUsers.map(u => {
      const monthShifts = s.shifts.filter(x => x.userId === u.id && new Date(x.openedAt) >= monthStart && x.status !== 'open');
      const gross = monthShifts.length * DAILY_RATE;
      const sss = Math.round(gross * 0.045);
      const net = gross - sss;
      return { user: u, totalDays: monthShifts.length, gross, sss, net };
    });
    const totalGross = payrollData.reduce((a, b) => a + b.gross, 0);
    const totalNet = payrollData.reduce((a, b) => a + b.net, 0);
    document.getElementById('page-content').innerHTML = `
      <div class="page-header"><h1 class="page-title">Payroll</h1><p class="page-subtitle">${now.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' })} · Printing Department</p></div>
      <div class="payroll-summary">
        <div class="payroll-item"><label>Total Gross</label><strong>₱${fmt(totalGross)}</strong></div>
        <div class="payroll-item"><label>Deductions</label><strong style="color:var(--danger)">₱${fmt(totalGross - totalNet)}</strong></div>
        <div class="payroll-item"><label>Total Net</label><strong>₱${fmt(totalNet)}</strong></div>
      </div>
      <div class="data-card"><div class="data-card-header"><span class="data-card-title">Personnel Payroll Breakdown</span></div>
        <div class="data-card-body no-pad">
          <table class="data-table"><thead><tr><th>Name</th><th>Shifts</th><th>Gross</th><th>SSS</th><th>Net Pay</th></tr></thead>
          <tbody>${payrollData.map(row => `<tr>
            <td><strong>${row.user.name}</strong></td>
            <td>${row.totalDays}</td>
            <td class="td-mono">₱${fmt(row.gross)}</td>
            <td class="td-mono" style="color:var(--danger)">– ₱${fmt(row.sss)}</td>
            <td class="td-mono" style="font-weight:700;color:var(--success)">₱${fmt(row.net)}</td>
          </tr>`).join('')}
          </tbody></table>
        </div>
      </div>`;
    return;
  }

  // Admin: full payroll view
  const staffUsers = s.users.filter(u => u.role === 'staff');
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const DAILY_RATE = 600;
  const OT_RATE = 90;

  const payrollData = staffUsers.map(u => {
    const branch = s.branches.find(b => b.id === u.branchId);
    const monthShifts = s.shifts.filter(x => x.userId === u.id && new Date(x.openedAt) >= monthStart && x.status !== 'open');
    const openings = Object.entries(s.shiftSchedules).filter(([k, v]) => k.startsWith(u.id + '_') && v === 'Opening').length;
    const closings = Object.entries(s.shiftSchedules).filter(([k, v]) => k.startsWith(u.id + '_') && v === 'Closing').length;
    const totalDays = monthShifts.length;
    const gross = totalDays * DAILY_RATE;
    const sss = Math.round(gross * 0.045);
    const net = gross - sss;
    return { user: u, branch, totalDays, openings, closings, gross, sss, net };
  });

  const totalGross = payrollData.reduce((a, b) => a + b.gross, 0);
  const totalNet = payrollData.reduce((a, b) => a + b.net, 0);

  document.getElementById('page-content').innerHTML = `
    <div class="page-header"><h1 class="page-title">Payroll</h1><p class="page-subtitle">${now.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' })} · Based on closed shifts</p></div>
    <div class="payroll-summary">
      <div class="payroll-item"><label>Total Gross Pay</label><strong>₱${fmt(totalGross)}</strong></div>
      <div class="payroll-item"><label>Total Deductions (SSS est.)</label><strong style="color:var(--danger)">₱${fmt(totalGross - totalNet)}</strong></div>
      <div class="payroll-item"><label>Total Net Pay</label><strong>₱${fmt(totalNet)}</strong></div>
    </div>
    <div class="data-card"><div class="data-card-header"><span class="data-card-title">Staff Payroll Breakdown</span><span class="text-sm text-muted">Daily rate: ₱${DAILY_RATE} · SSS: 4.5%</span></div>
      <div class="data-card-body no-pad">
        <table class="data-table"><thead><tr><th>Staff</th><th>Branch</th><th>Shifts (Month)</th><th>Opening</th><th>Closing</th><th>Gross</th><th>SSS Deduction</th><th>Net Pay</th></tr></thead>
        <tbody>${payrollData.map(row => `
          <tr>
            <td><strong>${row.user.name}</strong></td>
            <td>${row.branch?.name || '–'}</td>
            <td style="font-weight:700">${row.totalDays}</td>
            <td><span class="badge badge-success">${row.openings}</span></td>
            <td><span class="badge badge-maroon">${row.closings}</span></td>
            <td class="td-mono">₱${fmt(row.gross)}</td>
            <td class="td-mono" style="color:var(--danger)">– ₱${fmt(row.sss)}</td>
            <td class="td-mono" style="font-weight:700;color:var(--success)">₱${fmt(row.net)}</td>
          </tr>`).join('')}
        </tbody>
        </table>
      </div>
    </div>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// PAYSLIP MODULE  (Staff & Print roles)
// ─────────────────────────────────────────────────────────────────────────────
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
  const DAILY_RATE          = user.dailyRate    || 400;
  const COMMISSION_CUP_RATE = user.commissionCup || 300;
  const COMMISSION_GP_RATE  = user.commissionGp  || 150;

  const totalDays = periodData.shifts.length;
  const basicPay  = totalDays * DAILY_RATE;

  // Commission days: Opening = Cups, Closing = GP
  const openingDays = periodData.shifts.filter(sh => {
    const sk = `${user.id}_${sh.openedAt ? sh.openedAt.slice(0,10) : ''}`;
    return (state.shiftSchedules || {})[sk] === 'Opening';
  }).length;
  const closingDays = periodData.shifts.filter(sh => {
    const sk = `${user.id}_${sh.openedAt ? sh.openedAt.slice(0,10) : ''}`;
    return (state.shiftSchedules || {})[sk] === 'Closing';
  }).length;

  const commissionCup = openingDays * COMMISSION_CUP_RATE;
  const commissionGp  = closingDays * COMMISSION_GP_RATE;
  const grossPay      = basicPay + commissionCup + commissionGp;

  // Philippine statutory deductions
  const sss         = Math.round(grossPay * 0.045);
  const philhealth  = Math.round(grossPay * 0.02);
  const hdmf        = Math.min(Math.round(grossPay * 0.02), 100);
  const totalDeductions = sss + philhealth + hdmf;
  const netPay      = grossPay - totalDeductions;

  return {
    totalDays, basicPay, openingDays, closingDays,
    commissionCup, commissionGp,
    grossPay, sss, philhealth, hdmf, totalDeductions, netPay,
    dailyRate: DAILY_RATE,
    commissionCupRate: COMMISSION_CUP_RATE,
    commissionGpRate:  COMMISSION_GP_RATE,
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
  const philhealth = Math.round(gross * 0.02);
  const hdmf = Math.min(Math.round(gross * 0.02), 100);
  const deductions = sss + philhealth + hdmf;
  return { gross, sss, philhealth, hdmf, deductions, net: gross - deductions, shifts: yearShifts.length };
}

function renderPayslip() {
  const s = getState();
  const me = s.currentUser;
  if (!me || !['staff', 'print'].includes(me.role)) { accessDenied('My Payroll'); return; }

  const branch = s.branches.find(b => b.id === me.branchId);
  const periods = getPayPeriods(me.id, s.shifts);
  const ytd = getYTDEarnings(me.id, s.shifts, s);

  // Default to most recent period
  const latestKey = periods.length ? periods[0].key : null;
  const selectedKey = window._payslipSelectedKey || latestKey;
  window._payslipSelectedKey = selectedKey;

  const selectedPeriod = periods.find(p => p.key === selectedKey) || periods[0] || null;
  const calc = selectedPeriod ? calcPayslip(me, selectedPeriod, s) : null;

  const positionLabel = me.role === 'staff' ? 'Sales Associate' : 'Printing Personnel';
  // Generate a deterministic employee number from user id
  const empNum = (me.employeeNumber) || ('BPS-' + String(me.id || '001').replace(/\D/g,'').padStart(3,'0'));

  const COMPANY = {
    name: 'SOUTH PAFPS PACKAGING SUPPLIES',
    address1: 'Unit F&G FACL Commercial Building, Pasong Buaya 2 Road',
    address2: 'Pasong Buaya 2, Imus, Cavite',
    tel: 'Tel: (046) 436-9414',
  };

  document.getElementById('page-content').innerHTML = `
    <div class="page-header" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px">
      <div>
        <h1 class="page-title">My Payroll</h1>
        <p class="page-subtitle">View, download, and print your payslips</p>
      </div>
    </div>

    <!-- Pay Period Selector + YTD Strip -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px">
      <div class="data-card" style="margin:0">
        <div class="data-card-header"><span class="data-card-title">${iconSvg('calendar')} Select Pay Period</span></div>
        <div class="data-card-body">
          ${periods.length === 0
            ? `<p class="text-sm text-muted">No completed shifts found. Payslips are generated from closed shifts.</p>`
            : `<div class="form-select-wrap"><select class="form-control" onchange="window._payslipSelectedKey=this.value;renderPayslip()">
                ${periods.map(p => `<option value="${p.key}" ${p.key === selectedKey ? 'selected' : ''}>${p.label}</option>`).join('')}
              </select></div>
              ${selectedPeriod ? `<div class="text-sm text-muted" style="margin-top:8px">${iconSvg('check')} Pay Date: <strong>${selectedPeriod.payDateLabel}</strong></div>` : ''}`
          }
        </div>
      </div>
      <div class="data-card" style="margin:0">
        <div class="data-card-header"><span class="data-card-title">${iconSvg('chart')} Year-to-Date Earnings (${new Date().getFullYear()})</span></div>
        <div class="data-card-body">
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;text-align:center">
            <div style="background:var(--cream);border-radius:var(--radius-sm);padding:10px">
              <div style="font-size:11px;color:var(--ink-60);margin-bottom:4px">Shifts Worked</div>
              <div style="font-size:20px;font-weight:700;color:var(--ink)">${ytd.shifts}</div>
            </div>
            <div style="background:var(--success-l);border-radius:var(--radius-sm);padding:10px">
              <div style="font-size:11px;color:var(--ink-60);margin-bottom:4px">Gross Earned</div>
              <div style="font-size:18px;font-weight:700;color:var(--success)">₱${fmt(ytd.gross)}</div>
            </div>
            <div style="background:var(--maroon-xs);border-radius:var(--radius-sm);padding:10px">
              <div style="font-size:11px;color:var(--ink-60);margin-bottom:4px">Net Pay (YTD)</div>
              <div style="font-size:18px;font-weight:700;color:var(--maroon)">₱${fmt(ytd.net)}</div>
            </div>
          </div>
          <div style="margin-top:10px;display:flex;gap:10px;font-size:12px;color:var(--ink-60);justify-content:center">
            <span>SSS: <strong>₱${fmt(ytd.sss)}</strong></span>
            <span>·</span>
            <span>PhilHealth: <strong>₱${fmt(ytd.philhealth)}</strong></span>
            <span>·</span>
            <span>HDMF: <strong>₱${fmt(ytd.hdmf)}</strong></span>
          </div>
        </div>
      </div>
    </div>

    ${!calc ? `
    <div class="data-card">
      <div class="data-card-body" style="text-align:center;padding:40px;color:var(--ink-60)">
        <div style="font-size:40px;margin-bottom:12px">📄</div>
        <p>No payslip available yet. Payslips are generated once your shifts are closed by the admin.</p>
      </div>
    </div>` : `

    <!-- Action buttons -->
    <div style="display:flex;gap:10px;margin-bottom:16px;flex-wrap:wrap">
      <button class="btn btn-maroon" onclick="printPayslip()">
        ${iconSvg('printer')} Print Payslip
      </button>
      <button class="btn btn-outline" onclick="downloadPayslip()">
        ↓ Download PDF
      </button>
    </div>

    <!-- PAYSLIP DOCUMENT -->
    <div class="data-card" id="payslip-document" style="margin-bottom:24px;max-width:860px;">
      <div class="data-card-body" style="padding:32px 40px;font-family:'Arial',sans-serif;font-size:12px;color:#111;">

        <!-- ── HEADER ── -->
        <div style="display:flex;align-items:flex-start;gap:24px;margin-bottom:16px;">
          <div style="flex-shrink:0;width:100px;">
            <img src="logo.png" alt="South Pafps" style="width:100px;height:auto;display:block;" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
            <div style="display:none;width:100px;height:76px;background:var(--maroon);border-radius:8px;align-items:center;justify-content:center;color:#fff;font-size:9px;font-weight:700;text-align:center;padding:8px;box-sizing:border-box;">SOUTH<br>PAFPS<br><span style="font-size:7px;opacity:.8">PACKAGING SUPPLIES</span></div>
          </div>
          <div style="flex:1;">
            <div style="font-weight:700;font-size:13px;margin-bottom:4px;">${COMPANY.name}</div>
            <div style="font-size:11px;line-height:1.7;color:#333;">
              ${COMPANY.address1}<br>
              ${COMPANY.address2}<br>
              ${COMPANY.tel}
            </div>
          </div>
        </div>

        <!-- ── PAYSLIP TITLE ── -->
        <div style="text-align:center;font-weight:700;font-size:13px;letter-spacing:3px;margin:0 0 14px;">PAYSLIP</div>

        <!-- ── EMPLOYEE INFO ── -->
        <table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:0;">
          <colgroup><col style="width:22%"><col style="width:28%"><col style="width:22%"><col style="width:28%"></colgroup>
          <tbody>
            <tr>
              <td style="padding:4px 8px;border:1px solid #999;"><strong>Employee Name:</strong></td>
              <td style="padding:4px 8px;border:1px solid #999;">${me.name || '—'}</td>
              <td style="padding:4px 8px;border:1px solid #999;"><strong>SSS Number:</strong></td>
              <td style="padding:4px 8px;border:1px solid #999;">${me.sssNumber || ''}</td>
            </tr>
            <tr>
              <td style="padding:4px 8px;border:1px solid #999;"><strong>Employee Number:</strong></td>
              <td style="padding:4px 8px;border:1px solid #999;">${empNum}</td>
              <td style="padding:4px 8px;border:1px solid #999;"><strong>Philhealth Number:</strong></td>
              <td style="padding:4px 8px;border:1px solid #999;">${me.philhealthNumber || ''}</td>
            </tr>
            <tr>
              <td style="padding:4px 8px;border:1px solid #999;"><strong>Position:</strong></td>
              <td style="padding:4px 8px;border:1px solid #999;">${positionLabel}</td>
              <td style="padding:4px 8px;border:1px solid #999;"><strong>HDMF Number:</strong></td>
              <td style="padding:4px 8px;border:1px solid #999;">${me.hdmfNumber || ''}</td>
            </tr>
            <tr>
              <td style="padding:4px 8px;border:1px solid #999;"><strong>Pay Period:</strong></td>
              <td style="padding:4px 8px;border:1px solid #999;">${selectedPeriod.label}</td>
              <td style="padding:4px 8px;border:1px solid #999;"><strong>TIN Number:</strong></td>
              <td style="padding:4px 8px;border:1px solid #999;">${me.tinNumber || ''}</td>
            </tr>
            <tr>
              <td style="padding:4px 8px;border:1px solid #999;"><strong>Pay Date:</strong></td>
              <td style="padding:4px 8px;border:1px solid #999;">${selectedPeriod.payDateLabel}</td>
              <td style="padding:4px 8px;border:1px solid #999;"></td>
              <td style="padding:4px 8px;border:1px solid #999;"></td>
            </tr>
          </tbody>
        </table>

        <!-- ── EARNINGS / DEDUCTIONS ── -->
        <table style="width:100%;border-collapse:collapse;font-size:12px;margin-top:-1px;">
          <colgroup>
            <col style="width:34%">
            <col style="width:10%">
            <col style="width:14%">
            <col style="width:3px">
            <col style="width:auto">
            <col style="width:14%">
          </colgroup>
          <thead>
            <tr>
              <th colspan="3" style="border:1px solid #999;padding:6px 8px;text-align:left;background:#e8e8e8;font-weight:700;">EARNINGS/INCOME</th>
              <td style="border-top:1px solid #333;border-bottom:1px solid #333;padding:0;width:3px;background:#333;"></td>
              <th colspan="2" style="border:1px solid #999;padding:6px 8px;text-align:left;background:#e8e8e8;font-weight:700;">DEDUCTIONS</th>
            </tr>
          </thead>
          <tbody>
            <!-- Basic Pay row -->
            <tr>
              <td style="border-left:1px solid #999;padding:5px 8px;">Basic Pay @ ₱${fmt(calc.dailyRate)}/day</td>
              <td style="border-left:1px solid #ddd;padding:5px 8px;text-align:right;">${calc.totalDays}</td>
              <td style="border-left:1px solid #ddd;border-right:1px solid #999;padding:5px 8px;text-align:right;">₱${fmt(calc.basicPay)}</td>
              <td style="background:#333;width:3px;padding:0;"></td>
              <td style="border-left:1px solid #999;padding:5px 8px;">SSS EE Contribution</td>
              <td style="border-right:1px solid #999;padding:5px 8px;text-align:right;">${calc.sss > 0 ? '₱'+fmt(calc.sss) : ''}</td>
            </tr>
            <!-- Commission Cups row -->
            ${calc.commissionCup > 0 ? `<tr>
              <td style="border-left:1px solid #999;padding:5px 8px;">Commission (Cups)</td>
              <td style="border-left:1px solid #ddd;padding:5px 8px;text-align:right;">${calc.openingDays}</td>
              <td style="border-left:1px solid #ddd;border-right:1px solid #999;padding:5px 8px;text-align:right;">₱${fmt(calc.commissionCup)}</td>
              <td style="background:#333;width:3px;padding:0;"></td>
              <td style="border-left:1px solid #999;padding:5px 8px;">NHIP EE Contribution</td>
              <td style="border-right:1px solid #999;padding:5px 8px;text-align:right;">${calc.philhealth > 0 ? '₱'+fmt(calc.philhealth) : ''}</td>
            </tr>` : `<tr>
              <td style="border-left:1px solid #999;padding:5px 8px;"></td>
              <td style="border-left:1px solid #ddd;padding:5px 8px;"></td>
              <td style="border-left:1px solid #ddd;border-right:1px solid #999;padding:5px 8px;"></td>
              <td style="background:#333;width:3px;padding:0;"></td>
              <td style="border-left:1px solid #999;padding:5px 8px;">NHIP EE Contribution</td>
              <td style="border-right:1px solid #999;padding:5px 8px;text-align:right;">${calc.philhealth > 0 ? '₱'+fmt(calc.philhealth) : ''}</td>
            </tr>`}
            <!-- Commission GP row -->
            ${calc.commissionGp > 0 ? `<tr>
              <td style="border-left:1px solid #999;padding:5px 8px;">Commission (GP)</td>
              <td style="border-left:1px solid #ddd;padding:5px 8px;text-align:right;">${calc.closingDays}</td>
              <td style="border-left:1px solid #ddd;border-right:1px solid #999;padding:5px 8px;text-align:right;">₱${fmt(calc.commissionGp)}</td>
              <td style="background:#333;width:3px;padding:0;"></td>
              <td style="border-left:1px solid #999;padding:5px 8px;">HDMF Contribution</td>
              <td style="border-right:1px solid #999;padding:5px 8px;text-align:right;">${calc.hdmf > 0 ? '₱'+fmt(calc.hdmf) : ''}</td>
            </tr>` : `<tr>
              <td style="border-left:1px solid #999;padding:5px 8px;"></td>
              <td style="border-left:1px solid #ddd;padding:5px 8px;"></td>
              <td style="border-left:1px solid #ddd;border-right:1px solid #999;padding:5px 8px;"></td>
              <td style="background:#333;width:3px;padding:0;"></td>
              <td style="border-left:1px solid #999;padding:5px 8px;">HDMF Contribution</td>
              <td style="border-right:1px solid #999;padding:5px 8px;text-align:right;">${calc.hdmf > 0 ? '₱'+fmt(calc.hdmf) : ''}</td>
            </tr>`}
            <!-- Filler rows to match document height -->
            <tr style="height:22px;">
              <td style="border-left:1px solid #999;"></td><td style="border-left:1px solid #ddd;"></td>
              <td style="border-left:1px solid #ddd;border-right:1px solid #999;"></td>
              <td style="background:#333;width:3px;padding:0;"></td>
              <td style="border-left:1px solid #999;"></td><td style="border-right:1px solid #999;"></td>
            </tr>
            <tr style="height:22px;">
              <td style="border-left:1px solid #999;"></td><td style="border-left:1px solid #ddd;"></td>
              <td style="border-left:1px solid #ddd;border-right:1px solid #999;"></td>
              <td style="background:#333;width:3px;padding:0;"></td>
              <td style="border-left:1px solid #999;"></td><td style="border-right:1px solid #999;"></td>
            </tr>
          </tbody>
          <tfoot>
            <!-- GROSS PAY / TOTAL DEDUCTION -->
            <tr style="font-weight:700;background:#e8e8e8;">
              <td colspan="2" style="border:1px solid #999;padding:6px 8px;">GROSS PAY</td>
              <td style="border:1px solid #999;padding:6px 8px;text-align:right;">₱${fmt(calc.grossPay)}</td>
              <td style="background:#333;width:3px;padding:0;"></td>
              <td style="border:1px solid #999;padding:6px 8px;">TOTAL DEDUCTION</td>
              <td style="border:1px solid #999;padding:6px 8px;text-align:right;">₱${fmt(calc.totalDeductions)}</td>
            </tr>
            <!-- NET PAY -->
            <tr style="font-weight:700;">
              <td colspan="3" style="border:1px solid #999;padding:6px 8px;background:#fff;"></td>
              <td style="background:#333;width:3px;padding:0;"></td>
              <td style="border:1px solid #999;padding:6px 8px;">NET PAY</td>
              <td style="border:1px solid #999;padding:6px 8px;text-align:right;color:var(--maroon);">₱${fmt(calc.netPay)}</td>
            </tr>
          </tfoot>
        </table>

        <!-- ── CUT LINE ── -->
        <div style="margin-top:28px;border-top:2px dashed #ccc;text-align:center;padding-top:4px;font-size:10px;color:#aaa;letter-spacing:2px;">
          · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · ·
        </div>

      </div>
    </div>

    <!-- Shift Detail Table -->
    <div class="data-card" style="max-width:860px">
      <div class="data-card-header">
        <span class="data-card-title">Shifts in This Pay Period</span>
        <span class="badge badge-neutral">${selectedPeriod.shifts.length} shifts</span>
      </div>
      <div class="data-card-body no-pad">
        <table class="data-table">
          <thead><tr><th>Date</th><th>Opened</th><th>Closed</th><th>Sales</th><th>Earnings</th></tr></thead>
          <tbody>
            ${selectedPeriod.shifts.length ? selectedPeriod.shifts.map(sh => {
              const shiftSales = s.sales.filter(x => x.shiftId === sh.id && !x.voided).length;
              return `<tr>
                <td>${new Date(sh.openedAt).toLocaleDateString('en-PH', { weekday:'short', month:'short', day:'numeric' })}</td>
                <td>${fmtTime(sh.openedAt)}</td>
                <td>${sh.closedAt ? fmtTime(sh.closedAt) : '<span class="badge badge-success">Open</span>'}</td>
                <td>${shiftSales}</td>
                <td class="td-mono">₱${fmt(calc.dailyRate)}</td>
              </tr>`;
            }).join('') : '<tr><td colspan="5" style="text-align:center;padding:16px;color:var(--ink-60)">No shifts in this period.</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
    `}`;
}

function printPayslip() {
  const doc = document.getElementById('payslip-document');
  if (!doc) return;
  const win = window.open('', '_blank');
  win.document.write(`<!DOCTYPE html><html><head><title>Payslip - South Pafps</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Times New Roman',serif;font-size:12px;padding:30px}
    table{width:100%;border-collapse:collapse}
    td,th{padding:5px 10px}
    @media print{body{padding:15px}}
  </style></head><body>
  ${doc.innerHTML}
  <script>window.onload=function(){window.print();window.close()}<\/script>
  </body></html>`);
  win.document.close();
}

function downloadPayslip() {
  const doc = document.getElementById('payslip-document');
  if (!doc) return;
  const s = getState();
  const me = s.currentUser;
  const win = window.open('', '_blank');
  win.document.write(`<!DOCTYPE html><html><head><title>Payslip - ${me?.name || 'Employee'}</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Times New Roman',serif;font-size:12px;padding:30px}
    table{width:100%;border-collapse:collapse}
    td,th{padding:5px 10px}
  </style></head><body>
  ${doc.innerHTML}
  <script>
    window.onload=function(){
      setTimeout(function(){
        var a=document.createElement('a');
        a.href='data:text/html;charset=utf-8,'+encodeURIComponent(document.documentElement.outerHTML);
        a.download='Payslip_${(me?.name || 'employee').replace(/\s+/g,'_')}.html';
        a.click();
      },300);
    }
  <\/script>
  </body></html>`);
  win.document.close();
  showToast('Payslip downloaded as HTML — open in browser then Save as PDF.', 'success');
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
  showModal(`<div class='modal-header'><h2>Discount Rules Configuration</h2><button class='btn-close-modal' onclick='closeModal()'>✕</button></div><div class='modal-body'>TODO: Configure discount thresholds, percentages, and rules here.</div><div class='modal-footer'><button class='btn btn-outline' onclick='closeModal()'>Close</button></div>`);
}
function showDownpaymentReportModal() {
  showModal(`<div class='modal-header'><h2>50% Downpayment Report</h2><button class='btn-close-modal' onclick='closeModal()'>✕</button></div><div class='modal-body'>TODO: Show all orders/payments with 50% downpayment.</div><div class='modal-footer'><button class='btn btn-outline' onclick='closeModal()'>Close</button></div>`);
}
function showBalanceDueReportModal() {
  showModal(`<div class='modal-header'><h2>Balance Due Report</h2><button class='btn-close-modal' onclick='closeModal()'>✕</button></div><div class='modal-body'>TODO: Show all orders with outstanding balance.</div><div class='modal-footer'><button class='btn btn-outline' onclick='closeModal()'>Close</button></div>`);
}
function showPaidOrdersReportModal() {
  showModal(`<div class='modal-header'><h2>Paid Orders Report</h2><button class='btn-close-modal' onclick='closeModal()'>✕</button></div><div class='modal-body'>TODO: Show all fully paid orders.</div><div class='modal-footer'><button class='btn btn-outline' onclick='closeModal()'>Close</button></div>`);
}
function showDiscountReportModal() {
  showModal(`<div class='modal-header'><h2>Discount Report</h2><button class='btn-close-modal' onclick='closeModal()'>✕</button></div><div class='modal-body'>TODO: Show all orders/transactions with discounts applied.</div><div class='modal-footer'><button class='btn btn-outline' onclick='closeModal()'>Close</button></div>`);
}

function viewReceiptModal(saleId) {
  const s = getState();
  const sale = s.sales.find(x => String(x.id) === String(saleId));
  if (!sale) { showToast('Receipt not found.', 'error'); return; }
  showReceiptModal(sale, s);
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
  const totalSpent   = {};
  const visitCount   = {};
  const lastVisit    = {};
  const branchCustIds = new Set();

  (s.sales || []).forEach(sale => {
    if (sale.voided) return;
    if (sale.customerId) {
      totalSpent[sale.customerId]  = (totalSpent[sale.customerId]  || 0) + (sale.total || 0);
      visitCount[sale.customerId]  = (visitCount[sale.customerId]  || 0) + 1;
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
    (c.companyName    || '').toLowerCase().includes(q) ||
    (c.contactPerson  || '').toLowerCase().includes(q) ||
    (c.phone          || '').toLowerCase().includes(q)
  );

  // Sort
  filtered.sort((a, b) => {
    if (_posCustFilter.sort === 'name')    return (a.companyName || a.contactPerson || '').localeCompare(b.companyName || b.contactPerson || '');
    if (_posCustFilter.sort === 'spent')   return (totalSpent[b.id] || 0) - (totalSpent[a.id] || 0);
    if (_posCustFilter.sort === 'visits')  return (visitCount[b.id] || 0) - (visitCount[a.id] || 0);
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
          <option value="recent"  ${_posCustFilter.sort === 'recent'  ? 'selected' : ''}>Most Recent</option>
          <option value="spent"   ${_posCustFilter.sort === 'spent'   ? 'selected' : ''}>Highest Spend</option>
          <option value="visits"  ${_posCustFilter.sort === 'visits'  ? 'selected' : ''}>Most Visits</option>
          <option value="name"    ${_posCustFilter.sort === 'name'    ? 'selected' : ''}>Name A–Z</option>
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
  const salesHtml = custSales.slice(0, 10).map(sale =>
    '<tr>' +
    '<td class="td-mono" style="font-size:12px">' + (sale.receiptNo || String(sale.id).slice(-6).toUpperCase()) + '</td>' +
    '<td class="td-mono">₱' + fmt(sale.total) + '</td>' +
    '<td class="td-mono" style="font-size:12px">' + fmtTime(sale.createdAt) + '</td>' +
    '<td><button class="btn btn-sm btn-outline" onclick="viewReceiptModal(\'' + sale.id + '\')">Receipt</button></td>' +
    '</tr>'
  ).join('') || '<tr><td colspan="4" style="text-align:center;padding:16px;color:var(--ink-60)">No sales found.</td></tr>';

  showModal(
    '<div class="modal-header"><h2>' + iconSvg('users') + ' ' + (c.companyName || c.contactPerson || 'Customer') + '</h2>' +
    '<button class="btn-close-modal" onclick="closeModal()">&#x2715;</button></div>' +
    '<div class="modal-body">' +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">' +
    '<div class="form-group" style="margin:0"><label>Contact Person</label><div class="form-control-static">' + (c.contactPerson || '—') + '</div></div>' +
    '<div class="form-group" style="margin:0"><label>Phone</label><div class="form-control-static td-mono">' + (c.phone || '—') + '</div></div>' +
    '<div class="form-group" style="margin:0"><label>Total Visits</label><div class="form-control-static td-mono">' + custSales.length + '</div></div>' +
    '<div class="form-group" style="margin:0"><label>Total Spent</label><div class="form-control-static td-mono" style="color:var(--maroon);font-weight:700">₱' + fmt(totalSpent) + '</div></div>' +
    '</div>' +
    '<div style="font-weight:600;margin-bottom:8px;font-size:13px">Recent Purchases</div>' +
    '<table class="data-table"><thead><tr><th>Receipt</th><th>Total</th><th>Date</th><th></th></tr></thead>' +
    '<tbody>' + salesHtml + '</tbody></table>' +
    '</div>' +
    '<div class="modal-footer"><button class="btn btn-outline" onclick="closeModal()">Close</button></div>'
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
      _posReceiptFilter.status === 'all'    ? true :
      _posReceiptFilter.status === 'paid'   ? !isVoided :
      _posReceiptFilter.status === 'voided' ? isVoided : true;
    const saleDate = (sale.createdAt || '').slice(0, 10);
    const matchFrom = !_posReceiptFilter.dateFrom || saleDate >= _posReceiptFilter.dateFrom;
    const matchTo   = !_posReceiptFilter.dateTo   || saleDate <= _posReceiptFilter.dateTo;
    return matchSearch && matchStatus && matchFrom && matchTo;
  });

  const totalRevenue  = filtered.filter(x => !x.voided && x.status !== 'voided').reduce((s, x) => s + (x.total || 0), 0);
  const voidedCount   = filtered.filter(x => x.voided || x.status === 'voided').length;
  const paidCount     = filtered.length - voidedCount;
  const hasFilter     = q || _posReceiptFilter.status !== 'all' || _posReceiptFilter.dateFrom || _posReceiptFilter.dateTo;

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
          <option value="all"    ${_posReceiptFilter.status === 'all'    ? 'selected' : ''}>All Status</option>
          <option value="paid"   ${_posReceiptFilter.status === 'paid'   ? 'selected' : ''}>Paid</option>
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
  const page = 'receipts';
  const navId = getNavRenderId();
  const s = getState();
  const sales = [...(s.sales || [])].reverse().slice(0, 50);
  setPageHtml(page, navId, `
    <div class="page-header"><h1 class="page-title">Receipts</h1><p class="page-subtitle">Browse and reprint sale receipts</p></div>
    <div class="data-card"><div class="data-card-body no-pad">
      <table class="data-table"><thead><tr><th>Receipt #</th><th>Customer</th><th>Total</th><th>Time</th><th>Status</th><th>Action</th></tr></thead>
      <tbody>${[...sales].map(sale => {
    const cust = s.customers.find(c => c.id === sale.customerId);
    const customer = cust ? (cust.companyName || cust.contactPerson || '-') : 'Walk-in';
    return '<tr>' +
      '<td class="td-mono">' + (sale.receiptNo || String(sale.id).slice(-6).toUpperCase()) + '</td>' +
      '<td>' + customer + '</td>' +
      '<td class="td-mono">₱' + fmt(sale.total) + '</td>' +
      '<td class="td-mono">' + fmtTime(sale.createdAt || sale.created_at) + '</td>' +
      '<td>' + (sale.voided || sale.status === 'voided' ? '<span class="badge badge-danger">Voided</span>' : '<span class="badge badge-success">Paid</span>') + '</td>' +
      '<td><button class="btn btn-sm btn-outline" onclick="viewReceiptModal(this.dataset.id)" data-id="' + sale.id + '">View</button></td>' +
      '</tr>';
  }).join('') || '<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--ink-60)">No receipts found.</td></tr>'}
      </tbody></table>
    </div></div>`);
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
          <td><span class="badge ${sale.voided||sale.status==='voided'?'badge-danger':'badge-success'}">${sale.voided||sale.status==='voided'?'Voided':'Paid'}</span></td>
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

  // Pull from both stores and normalise to a common shape
  var posCustomers = (getState().customers || []).map(function(c) {
    return { _id: c.id, _src: 'pos', name: c.companyName || '', contact: c.contactPerson || '', phone: c.phone || '', email: c.email || '', address: c.address || '', notes: c.notes || '' };
  });
  var omCustomers = (getCustomerRecords() || []).map(function(c) {
    return { _id: c.id, _src: 'om', name: c.businessName || '', contact: c.contactPerson || '', phone: c.phone || '', email: c.email || '', address: c.address || '', notes: c.notes || '' };
  });

  // Combine, deduplicate by name, filter by query
  var seen = {};
  var matches = posCustomers.concat(omCustomers).filter(function(c) {
    var key = c.name.toLowerCase();
    if (seen[key]) return false;
    seen[key] = true;
    return c.name.toLowerCase().indexOf(q) !== -1 || c.contact.toLowerCase().indexOf(q) !== -1;
  }).slice(0, 8);

  if (!matches.length) { drop.style.display = 'none'; return; }

  drop.innerHTML = matches.map(function(c) {
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
    c = (getCustomerRecords() || []).find(function(x) { return x.id === custId; });
    if (c) c = { companyName: c.businessName, contactPerson: c.contactPerson, phone: c.phone, email: c.email, address: c.address, notes: c.notes || '' };
  } else {
    c = (getState().customers || []).find(function(x) { return x.id === custId; });
  }
  if (!c) return;
  function sv(id, v) { var el = document.getElementById(id); if (el) el.value = v || ''; }
  sv('cust-company',  c.companyName);
  sv('cust-contact',  c.contactPerson);
  sv('cust-phone',    c.phone);
  sv('cust-email',    c.email);
  sv('cust-address',  c.address);
  sv('cust-notes',    c.notes);
  var drop = document.getElementById('cust-suggest');
  if (drop) drop.style.display = 'none';
}

function confirmAddCustomer(fromPOS = false) {
  const s = getState();
  const companyName = document.getElementById('cust-company').value.trim();
  const contactPerson = document.getElementById('cust-contact').value.trim();
  const phone = document.getElementById('cust-phone').value.trim();
  const address = document.getElementById('cust-address').value.trim();
  const emailEl = document.getElementById('cust-email');
  const notesEl = document.getElementById('cust-notes');
  const email = emailEl ? emailEl.value.trim() : '';
  const notes = notesEl ? notesEl.value.trim() : '';
  if (!companyName || !contactPerson) { showToast('Company and contact are required.', 'error'); return; }

  // Helper: save customer locally and proceed
  function _saveLocally(id) {
    const u = s.currentUser;
    const newCust = {
      id: id || ('cust_local_' + Date.now()),
      companyName, contactPerson, phone, address, email, notes,
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
  if (!c.companyName || !c.contactPerson) { showToast('Company and contact are required.', 'error'); return; }
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
      <div class="alert alert-info">Customer: <strong>${c.companyName}</strong><br>Outstanding: <strong>₱${fmt(c.outstandingBalance || 0)}</strong></div>
      <div class="form-group"><label>Payment Amount</label><input id="ar-amount" type="number" class="form-control" min="0" step="0.01"></div>
      <div class="form-group"><label>Reference Note</label><input id="ar-note" class="form-control" placeholder="Receipt/Reference"></div>
    </div>
    <div class="modal-footer"><button class="btn btn-outline" onclick="closeModal()">Cancel</button><button class="btn btn-maroon" onclick="confirmARPayment('${customerId}')">Post Payment</button></div>`);
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
      <div class="form-group"><label>Supplier Name</label><input id="recv-supplier" class="form-control" placeholder="Supplier"></div>
      <div class="form-group"><label>Branch</label><div class="form-select-wrap"><select id="recv-branch" class="form-control">${s.branches.map(b => `<option value="${b.id}" ${b.id === branchId ? 'selected' : ''}>${b.name}</option>`).join('')}</select></div></div>
      <div class="form-group"><label>Item Variant</label><div class="form-select-wrap"><select id="recv-variant" class="form-control">${variantOptions}</select></div></div>
      <div class="form-group"><label>Quantity Received</label><input id="recv-qty" type="number" class="form-control" min="1" value="1"></div>
      <div class="form-group"><label>Date Received</label><input id="recv-date" type="date" class="form-control" value="${new Date().toISOString().slice(0, 10)}"></div>
    </div>
    <div class="modal-footer"><button class="btn btn-outline" onclick="closeModal()">Cancel</button><button class="btn btn-maroon" onclick="confirmReceiving()">Log Receiving</button></div>`);
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
function getDispatchRecords() { return JSON.parse(localStorage.getItem('om_dispatch') || '[]'); }
function saveDispatchRecords(d) { localStorage.setItem('om_dispatch', JSON.stringify(d)); }

function omGenId(prefix) { return prefix + '_' + Date.now() + '_' + Math.floor(Math.random() * 10000); }
function omFmt(n) { return Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function omDate(iso) { if (!iso) return '\u2014'; var d = new Date(iso); return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }); }

var _omTab = 'orders';
var _omSearch = '';
var _omFilter = '';

// showCustomerModal — search existing or add new customer from POS
function showCustomerModal() {
  var s = getState();
  var allPOS = (s.customers || []);
  var allOM  = (getCustomerRecords() || []);

  // Build combined list normalised to { id, src, name, contact, phone }
  var combined = [];
  var seenNames = {};
  allPOS.forEach(function(c) {
    var n = (c.companyName || c.contactPerson || '').trim();
    if (n && !seenNames[n.toLowerCase()]) { seenNames[n.toLowerCase()] = true; combined.push({ id: c.id, src: 'pos', name: n, contact: c.contactPerson || '', phone: c.phone || '' }); }
  });
  allOM.forEach(function(c) {
    var n = (c.businessName || c.contactPerson || '').trim();
    if (n && !seenNames[n.toLowerCase()]) { seenNames[n.toLowerCase()] = true; combined.push({ id: c.id, src: 'om', name: n, contact: c.contactPerson || '', phone: c.phone || '' }); }
  });

  function renderList(q) {
    var q2 = (q || '').toLowerCase().trim();
    var shown = q2 ? combined.filter(function(c) {
      return c.name.toLowerCase().indexOf(q2) !== -1 || c.contact.toLowerCase().indexOf(q2) !== -1;
    }) : combined;
    shown = shown.slice(0, 10);
    if (!shown.length) return '<div style="padding:20px;text-align:center;color:var(--ink-60);font-size:13px">' + (q2 ? 'No matching customers found.' : 'No customer records yet.') + '</div>';
    return shown.map(function(c) {
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
  var shown = q2 ? list.filter(function(c) {
    return c.name.toLowerCase().indexOf(q2) !== -1 || c.contact.toLowerCase().indexOf(q2) !== -1;
  }) : list;
  shown = shown.slice(0, 10);
  var el = document.getElementById('pos-cust-list');
  if (!el) return;
  if (!shown.length) { el.innerHTML = '<div style="padding:20px;text-align:center;color:var(--ink-60);font-size:13px">' + (q2 ? 'No matching customers found.' : 'No customer records yet.') + '</div>'; return; }
  el.innerHTML = shown.map(function(c) {
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
    var rec = (getCustomerRecords() || []).find(function(x) { return x.id === custId; });
    if (rec) {
      name = rec.businessName || rec.contactPerson || '';
      // Mirror into pos customers so credit sales work
      var s = getState();
      var existing = s.customers.find(function(x) { return (x.companyName || '').toLowerCase() === name.toLowerCase(); });
      if (!existing) {
        var newC = { id: 'cust_om_' + custId, companyName: name, contactPerson: rec.contactPerson || '', phone: rec.phone || '', email: rec.email || '', address: rec.address || '', notes: rec.notes || '', outstandingBalance: 0, blocked: false, source: 'pos', createdAt: new Date().toISOString() };
        s.customers.push(newC);
        saveState(s);
        custId = newC.id;
      } else {
        custId = existing.id;
      }
    }
  } else {
    var s2 = getState();
    var posC = (s2.customers || []).find(function(x) { return x.id === custId; });
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
  order.status = 'dispatch';
  saveOrders(orders);
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
    closeModal();
    showToast('Order updated!', 'success');
    renderOrders();
  }
}

function voidOrderModal(orderId) {
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
    showToast('Order moved to production.', 'success');
    renderOrders();
  }
}

// STATUS BADGES
function omStatusBadge(status) {
  var map = {
    pending: '<span class="badge badge-warning">' + iconSvg('clock') + ' Pending</span>',
    cancelled: '<span class="badge badge-danger">' + iconSvg('error') + ' Cancelled</span>',
    production: '<span class="badge badge-info">' + iconSvg('printer') + ' In Production</span>',
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

// MAIN RENDER
function renderOrders(filterStatus, searchQuery) {
  var s = getState();
  var u = s.currentUser;
  var isPrint = u && u.role === 'print';

  // Print personnel: force to production tab, restrict available tabs
  if (isPrint && (_omTab === 'customers' || _omTab === 'orders' || _omTab === 'logos' || _omTab === 'payment')) {
    _omTab = 'production';
  }
  _omTab = _omTab || (isPrint ? 'production' : 'orders');
  if (filterStatus !== undefined) _omFilter = filterStatus;
  if (searchQuery !== undefined) _omSearch = searchQuery;

  var orders = getOrders();
  var crs = getCustomerRecords();
  var prods = getProductionRecords();
  var dispatches = getDispatchRecords();
  var payments = getPaymentRecords();
  var logos = getLogoUploads();

  var pending  = orders.filter(function (o) { return o.status === 'pending'; }).length;
  var inProd   = orders.filter(function (o) { return o.status === 'production'; }).length;
  var dispCount= orders.filter(function (o) { return o.status === 'dispatch'; }).length;
  var done     = orders.filter(function (o) { return o.status === 'completed'; }).length;
  var balDue   = orders.reduce(function (sum, o) { return sum + (o.balance || 0); }, 0);

  // Print role only sees Production + Dispatch
  var tabs = isPrint ? [
    { id: 'production', label: '\uD83D\uDDA8\uFE0F Production',  count: prods.length },
    { id: 'dispatch',   label: '\uD83D\uDE9A Daily Dispatch',     count: dispatches.length },
  ] : [
    { id: 'customers',  label: '\uD83D\uDC65 Customer Records',   count: crs.length },
    { id: 'orders',     label: '\uD83D\uDCCB Order Details',      count: orders.length },
    { id: 'logos',      label: '\uD83D\uDDBC\uFE0F Logo Upload', count: logos.length },
    { id: 'payment',    label: '\uD83D\uDCB3 Payment (50% DP)',   count: payments.length },
    { id: 'production', label: '\uD83D\uDDA8\uFE0F Production',  count: prods.length },
    { id: 'dispatch',   label: '\uD83D\uDE9A Daily Dispatch',     count: dispatches.length },
  ];

  var tabsHtml = tabs.map(function (t) {
    return '<button class="om-tab' + (_omTab === t.id ? ' om-tab-active' : '') + '" onclick="omSwitchTab(\'' + t.id + '\')">' + t.label + ' <span class="om-tab-count">' + t.count + '</span></button>';
  }).join('');

  var tabContent = '';
  if (_omTab === 'orders') tabContent = omRenderOrdersTab();
  else if (_omTab === 'customers') tabContent = omRenderCustomersTab();
  else if (_omTab === 'logos') tabContent = omRenderLogoTab();
  else if (_omTab === 'payment') tabContent = omRenderPaymentsTab();
  else if (_omTab === 'production') tabContent = omRenderProductionTab();
  else if (_omTab === 'dispatch') tabContent = omRenderDispatchTab();

  var subtitle = isPrint
    ? 'Update production status and manage daily dispatch.'
    : 'Full order lifecycle \u2014 from customer records to dispatch.';

  var html = '<div class="page-header" style="margin-bottom:16px">'
    + '<h1 class="page-title">Order Management</h1>'
    + '<p class="page-subtitle">' + subtitle + '</p>'
    + '</div>'
    + '<div class="om-kpi-strip">'
    + '<div class="om-kpi"><div class="om-kpi-val">' + pending + '</div><div class="om-kpi-lbl">Pending</div></div>'
    + '<div class="om-kpi"><div class="om-kpi-val" style="color:var(--info)">' + inProd + '</div><div class="om-kpi-lbl">In Production</div></div>'
    + '<div class="om-kpi"><div class="om-kpi-val" style="color:var(--gold)">' + dispCount + '</div><div class="om-kpi-lbl">In Dispatch</div></div>'
    + '<div class="om-kpi"><div class="om-kpi-val" style="color:var(--success)">' + done + '</div><div class="om-kpi-lbl">Completed</div></div>'
    + (!isPrint ? '<div class="om-kpi"><div class="om-kpi-val" style="color:var(--danger)">\u20B1' + omFmt(balDue) + '</div><div class="om-kpi-lbl">Balance Due</div></div>' : '')
    + '</div>'
    + '<div class="om-tabs">' + tabsHtml + '</div>'
    + '<div id="om-tab-content">' + tabContent + '</div>';

  var page = 'orders';
  var navId = getNavRenderId();
  setPageHtml(page, navId, html);
}

function omSwitchTab(tab) {
  _omTab = tab;
  _omSearch = '';
  renderOrders();
}

function omRefreshTab() {
  var el = document.getElementById('om-tab-content');
  if (!el) return;
  if (_omTab === 'orders') el.innerHTML = omRenderOrdersTab();
  else if (_omTab === 'customers') el.innerHTML = omRenderCustomersTab();
  else if (_omTab === 'logos') el.innerHTML = omRenderLogoTab();
  else if (_omTab === 'payment') el.innerHTML = omRenderPaymentsTab();
  else if (_omTab === 'production') el.innerHTML = omRenderProductionTab();
  else if (_omTab === 'dispatch') el.innerHTML = omRenderDispatchTab();
}

// ── Shared helpers ────────────────────────────────────────────────────────────
function omEsc(str) {
  return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function omTable(headCols, bodyRows) {
  return '<div class="om-table-card">'
    +'<div class="om-table-scroll">'
    +'<table class="data-table om-table"><thead><tr>'+headCols+'</tr></thead>'
    +'<tbody>'+bodyRows+'</tbody></table>'
    +'</div></div>';
}

function omToolbar(leftHtml, rightHtml) {
  return '<div class="om-toolbar">'
    +'<div class="om-search-wrap">'+iconSvg('search')+leftHtml+'</div>'
    +'<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;">'+rightHtml+'</div>'
    +'</div>';
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
      + '<td class="fw7">#' + String(l.orderNumber || l.orderId || '').padStart(6,'0') + '</td>'
      + '<td><div class="cell-primary">' + omEsc(l.businessName || '\u2014') + '</div></td>'
      + '<td class="truncate" title="' + omEsc(l.fileName||'') + '">' + omEsc(l.fileName || '\u2014') + '</td>'
      + '<td class="xs">' + omEsc(l.fileType || '\u2014') + '</td>'
      + '<td class="truncate xs" title="' + omEsc(l.notes||'') + '">' + omEsc(l.notes || '\u2014') + '</td>'
      + '<td class="actions-cell">'
        + (l.fileData
          ? '<a class="btn btn-sm btn-outline" href="' + l.fileData + '" download="' + omEsc(l.fileName||'logo') + '">\u2193 Download</a> '
          : '')
        + '<button class="btn btn-sm btn-danger" onclick="omDeleteLogo(\'' + l.id + '\')">\u2715</button>'
      + '</td>'
      + '</tr>';
  }).join('') || '<tr><td colspan="7" class="empty-row">No logo uploads yet.</td></tr>';

  return omToolbar(
    '<input class="form-control pl34" placeholder="Search logos\u2026" value="' + (_omSearch||'') + '" oninput="_omSearch=this.value;omRefreshTab()">',
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
    return '<option value="' + o.id + '">#' + String(o.id).padStart(6,'0') + ' \u2014 ' + omEsc(o.customer_name||'') + '</option>';
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
  var o = getOrders().find(function(x){return String(x.id)===String(orderId);});
  var el = document.getElementById('omlogo-business');
  if (el) el.value = o ? (o.customer_name||'') : '';
}
function omReadLogoFile(input) {
  var file = input.files && input.files[0];
  if (!file) return;
  document.getElementById('omlogo-fname').value = file.name;
  document.getElementById('omlogo-ftype').value = file.type || file.name.split('.').pop();
  var reader = new FileReader();
  reader.onload = function(e) {
    document.getElementById('omlogo-data').value = e.target.result;
    var prev = document.getElementById('omlogo-preview');
    var img  = document.getElementById('omlogo-img');
    if (file.type.startsWith('image/') && prev && img) { img.src = e.target.result; prev.style.display = 'block'; }
  };
  reader.readAsDataURL(file);
}
function omSaveLogo() {
  function gv(id){var el=document.getElementById(id);return el?el.value:'';}
  var fileName = gv('omlogo-fname').trim();
  if (!fileName) { showToast('Please select a file.','error'); return; }
  var logos = getLogoUploads();
  var orderId = gv('omlogo-order');
  var order = orderId ? getOrders().find(function(o){return String(o.id)===String(orderId);}) : null;
  logos.push({ id:omGenId('LG'), orderId:orderId||null, orderNumber:order?order.id:null,
    businessName:gv('omlogo-business').trim()||(order?order.customer_name:''),
    fileName:fileName, fileType:gv('omlogo-ftype'), fileData:gv('omlogo-data'),
    notes:gv('omlogo-notes').trim(), uploadedAt:new Date().toISOString() });
  saveLogoUploads(logos);
  closeModal(); showToast('Logo uploaded!','success'); _omTab='logos'; renderOrders();
}
function omDeleteLogo(logoId) {
  if (!confirm('Remove this logo upload?')) return;
  saveLogoUploads(getLogoUploads().filter(function(l){return l.id!==logoId;}));
  showToast('Logo removed.','warning'); renderOrders();
}

// ── TAB: ORDER DETAILS ────────────────────────────────────────────────────────
function omRenderOrdersTab() {
  var u = getState().currentUser;
  var orders = getOrders();
  var sc = { pending:0, production:0, dispatch:0, completed:0, cancelled:0 };
  orders.forEach(function(o){ if(o.status in sc) sc[o.status]++; });

  var filtered = orders.filter(function(o){
    var ms = !_omFilter || o.status === _omFilter;
    var q  = (_omSearch||'').toLowerCase();
    var mq = !q
      || (o.customer_name||'').toLowerCase().indexOf(q) !== -1
      || String(o.id).indexOf(q) !== -1
      || (o.product_type||'').toLowerCase().indexOf(q) !== -1;
    return ms && mq;
  });

  var rows = [...filtered].reverse().map(function(o){
    var balance = o.balance || 0;
    return '<tr>'
      + '<td class="fw7 xs">#' + String(o.id).padStart(6,'0') + '</td>'
      + '<td class="xs">' + omDate(o.created_at) + '</td>'
      + '<td class="wgrow"><div class="cell-primary">' + omEsc(o.customer_name||'\u2014') + '</div>'
        + (o.contact_person ? '<div class="cell-sub">' + omEsc(o.contact_person) + '</div>' : '') + '</td>'
      + '<td class="wgrow-sm truncate" title="' + omEsc(o.product_type||'') + '">' + omEsc(o.product_type||o.product_category||'\u2014') + '</td>'
      + '<td class="center xs">' + omEsc(String(o.quantity||'\u2014')) + '</td>'
      + '<td>' + omStatusBadge(o.status) + '</td>'
      + '<td class="fw7 maroon xs">\u20B1' + omFmt(o.total_amount) + '</td>'
      + '<td class="xs ' + (balance>0?'danger':'success') + '">\u20B1' + omFmt(balance) + '</td>'
      + '<td>' + omPayStatusBadge(o.payment_status) + '</td>'
      + '<td class="actions-cell">'
        + '<button class="btn btn-sm btn-outline" onclick="omViewOrderModal(\'' + o.id + '\')" title="View">\uD83D\uDC41</button>'
        + (o.status==='pending' ? '<button class="btn btn-sm btn-maroon" onclick="omMoveToProduction(\'' + o.id + '\')" title="To Production">' + iconSvg('printer') + '</button>' : '')
        + (o.status==='production' ? '<button class="btn btn-sm btn-maroon" onclick="omMoveToDispatch(\'' + o.id + '\')" title="Dispatch">' + iconSvg('truck') + '</button>' : '')
        + '<button class="btn btn-sm btn-outline" onclick="omEditOrderModal(\'' + o.id + '\')">' + iconSvg('note') + '</button>'
        + '<button class="btn btn-sm btn-danger" onclick="voidOrderModal(\'' + o.id + '\')">' + iconSvg('error') + '</button>'
      + '</td>'
      + '</tr>';
  }).join('') || '<tr><td colspan="10" class="empty-row">No orders found.</td></tr>';

  return omToolbar(
    '<input class="form-control pl34" placeholder="Search order, customer, product\u2026" value="' + (_omSearch||'') + '" oninput="_omSearch=this.value;omRefreshTab()">',
    '<div class="form-select-wrap" style="min-width:140px;">'
      + '<select class="form-control" onchange="_omFilter=this.value;omRefreshTab()">'
      + '<option value="" ' + (!_omFilter?'selected':'') + '>All (' + orders.length + ')</option>'
      + '<option value="pending" ' + (_omFilter==='pending'?'selected':'') + '>Pending (' + sc.pending + ')</option>'
      + '<option value="production" ' + (_omFilter==='production'?'selected':'') + '>Production (' + sc.production + ')</option>'
      + '<option value="dispatch" ' + (_omFilter==='dispatch'?'selected':'') + '>Dispatch (' + sc.dispatch + ')</option>'
      + '<option value="completed" ' + (_omFilter==='completed'?'selected':'') + '>Completed (' + sc.completed + ')</option>'
      + '<option value="cancelled" ' + (_omFilter==='cancelled'?'selected':'') + '>Cancelled (' + sc.cancelled + ')</option>'
      + '</select></div>'
      + (u.role!=='print' ? '<button class="btn btn-maroon" onclick="omNewOrderModal()">+ New Order</button>' : '')
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
  var q = (_omSearch||'').toLowerCase();
  var filtered = crs.filter(function(c){
    return !q
      || (c.businessName||'').toLowerCase().indexOf(q) !== -1
      || (c.contactPerson||'').toLowerCase().indexOf(q) !== -1
      || (c.phone||'').indexOf(q) !== -1;
  });

  var rows = filtered.map(function(c){
    return '<tr>'
      + '<td class="wgrow"><div class="cell-primary">' + omEsc(c.businessName||'\u2014') + '</div>'
        + (c.contactPerson ? '<div class="cell-sub">' + omEsc(c.contactPerson) + '</div>' : '') + '</td>'
      + '<td class="xs">' + omEsc(c.phone||'\u2014') + '</td>'
      + '<td class="truncate xs" title="' + omEsc(c.email||'') + '">' + omEsc(c.email||'\u2014') + '</td>'
      + '<td class="truncate xs" title="' + omEsc(c.address||'') + '">' + omEsc(c.address||'\u2014') + '</td>'
      + '<td><span class="badge badge-neutral">' + omEsc(c.modeOfPayment||'\u2014') + '</span></td>'
      + '<td><span class="badge badge-neutral">' + omEsc(c.modeOfDelivery||'\u2014') + '</span></td>'
      + '<td class="xs">' + omDate(c.createdAt) + '</td>'
      + '<td class="actions-cell">'
        + '<button class="btn btn-sm btn-outline" onclick="omEditCustomerModal(\'' + c.id + '\')">Edit</button>'
        + ' <button class="btn btn-sm btn-danger" onclick="omDeleteCustomer(\'' + c.id + '\')">\u2715</button>'
      + '</td>'
      + '</tr>';
  }).join('') || '<tr><td colspan="8" class="empty-row">No customer records yet.</td></tr>';

  return omToolbar(
    '<input class="form-control pl34" placeholder="Search customers\u2026" value="' + (_omSearch||'') + '" oninput="_omSearch=this.value;omRefreshTab()">',
    '<button class="btn btn-maroon" onclick="omNewCustomerModal()">+ New Customer</button>'
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

// ── TAB: PAYMENT (50% DP) ─────────────────────────────────────────────────────
function omRenderPaymentsTab() {
  var payments = getPaymentRecords();
  var q = (_omSearch||'').toLowerCase();
  var filtered = [...payments].reverse().filter(function(p){
    return !q
      || (p.businessName||'').toLowerCase().indexOf(q) !== -1
      || String(p.orderNumber||'').indexOf(q) !== -1;
  });

  var rows = filtered.map(function(p){
    var isPaid = p.paymentStatus === 'Fully Paid';
    var bal = p.balance || 0;
    return '<tr>'
      + '<td class="xs">' + omDate(p.date) + '</td>'
      + '<td class="fw7 xs">#' + String(p.orderNumber||p.orderId||'').padStart(6,'0') + '</td>'
      + '<td class="wgrow"><div class="cell-primary">' + omEsc(p.businessName||'\u2014') + '</div>'
        + (p.contactPerson ? '<div class="cell-sub">' + omEsc(p.contactPerson) + '</div>' : '') + '</td>'
      + '<td class="fw7 maroon xs">\u20B1' + omFmt(p.totalAmount) + '</td>'
      + '<td class="xs">\u20B1' + omFmt(p.downpayment) + '</td>'
      + '<td class="xs ' + (bal>0?'danger':'success') + '">\u20B1' + omFmt(bal) + '</td>'
      + '<td>' + omPayStatusBadge(p.paymentStatus) + '</td>'
      + '<td class="truncate xs" title="' + omEsc(p.note||'') + '">' + omEsc(p.note||'\u2014') + '</td>'
      + '<td class="actions-cell">'
        + (isPaid
          ? '<button class="btn btn-sm btn-outline" onclick="omPrintReceipt(\'' + p.id + '\')">\uD83D\uDDA8\uFE0F Receipt</button>'
          : '<button class="btn btn-sm btn-maroon" onclick="omUpdatePaymentModal(\'' + p.id + '\')">+ Pay</button>')
      + '</td>'
      + '</tr>';
  }).join('') || '<tr><td colspan="9" class="empty-row">No payment records yet.</td></tr>';

  return omToolbar(
    '<input class="form-control pl34" placeholder="Search payments\u2026" value="' + (_omSearch||'') + '" oninput="_omSearch=this.value;omRefreshTab()">',
    '<button class="btn btn-maroon" onclick="omNewPaymentModal()">+ Record Payment</button>'
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
  var q = (_omSearch||'').toLowerCase();
  var filtered = [...prods].reverse().filter(function(p){
    return !q
      || (p.businessName||'').toLowerCase().indexOf(q) !== -1
      || String(p.orderNumber||'').indexOf(q) !== -1;
  });

  var rows = filtered.map(function(p){
    var pct = p.progress || 0;
    var pc  = pct>=100 ? 'var(--success)' : pct>=60 ? 'var(--gold)' : 'var(--maroon)';
    var qcB = p.qcResult==='Pass' ? '<span class="badge badge-success">\u2713 Pass</span>'
            : p.qcResult==='Fail' ? '<span class="badge badge-danger">\u2717 Fail</span>'
            : '<span class="badge badge-neutral">Pending</span>';
    return '<tr>'
      + '<td class="fw7 xs">#' + String(p.orderNumber||'').padStart(6,'0') + '</td>'
      + '<td class="wgrow"><div class="cell-primary">' + omEsc(p.businessName||'\u2014') + '</div></td>'
      + '<td class="xs">' + omEsc(p.assignedTo||'\u2014') + '</td>'
      + '<td style="min-width:110px;">'
        + '<div style="display:flex;align-items:center;gap:6px;">'
          + '<div style="flex:1;background:var(--ink-10);border-radius:99px;height:6px;">'
            + '<div style="width:' + pct + '%;background:' + pc + ';height:6px;border-radius:99px;"></div>'
          + '</div>'
          + '<span style="font-size:11px;font-weight:700;color:' + pc + ';white-space:nowrap;">' + pct + '%</span>'
        + '</div>'
      + '</td>'
      + '<td>' + omStatusBadge(p.status||'pending') + '</td>'
      + '<td>' + qcB + '</td>'
      + '<td class="truncate xs" title="' + omEsc(p.materialsUsed||'') + '">' + omEsc(p.materialsUsed||'\u2014') + '</td>'
      + '<td class="xs">' + omDate(p.completionDate) + '</td>'
      + '<td class="actions-cell">'
        + '<button class="btn btn-sm btn-outline" onclick="omUpdateProductionModal(\'' + p.id + '\')">Update</button>'
        + ' <button class="btn btn-sm btn-outline" onclick="omQCModal(\'' + p.id + '\')">QC</button>'
      + '</td>'
      + '</tr>';
  }).join('') || '<tr><td colspan="9" class="empty-row">No production records yet.</td></tr>';

  var isPrintUser = (getState().currentUser || {}).role === 'print';
  return omToolbar(
    '<input class="form-control pl34" placeholder="Search production\u2026" value="' + (_omSearch||'') + '" oninput="_omSearch=this.value;omRefreshTab()">',
    isPrintUser ? '' : '<button class="btn btn-maroon" onclick="omNewProductionModal()">+ Assign Production</button>'
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
  var dispatches = getDispatchRecords();
  var q = (_omSearch||'').toLowerCase();
  var filtered = [...dispatches].reverse().filter(function(d){
    return !q
      || (d.businessName||'').toLowerCase().indexOf(q) !== -1
      || String(d.orderNumber||'').indexOf(q) !== -1;
  });

  function dsBadge(s){
    if (s==='Delivered') return '<span class="badge badge-success">\u2713 Delivered</span>';
    if (s==='Dispatched') return '<span class="badge badge-info">\u2192 Dispatched</span>';
    return '<span class="badge badge-warning">Scheduled</span>';
  }

  var rows = filtered.map(function(d){
    return '<tr>'
      + '<td class="xs">' + omDate(d.date) + '</td>'
      + '<td class="fw7 xs">#' + String(d.orderNumber||'').padStart(6,'0') + '</td>'
      + '<td class="wgrow"><div class="cell-primary">' + omEsc(d.businessName||'\u2014') + '</div></td>'
      + '<td class="center xs">' + (d.customerNotified
          ? '<span class="success fw7">\u2713 Yes</span>'
          : '<span class="danger">\u2717 No</span>') + '</td>'
      + '<td>' + omPayStatusBadge(d.paymentStatus) + '</td>'
      + '<td><span class="badge badge-neutral">' + omEsc(d.dispatchMethod||'\u2014') + '</span></td>'
      + '<td>' + dsBadge(d.dispatchStatus) + '</td>'
      + '<td class="truncate xs" title="' + omEsc(d.notes||'') + '">' + omEsc(d.notes||'\u2014') + '</td>'
      + '<td class="actions-cell">'
        + '<button class="btn btn-sm btn-outline" onclick="omUpdateDispatchModal(\'' + d.id + '\')">Update</button>'
        + (d.paymentStatus==='Fully Paid'
          ? ' <button class="btn btn-sm btn-outline" onclick="omPrintDispatchReceipt(\'' + d.id + '\')">\uD83D\uDDA8\uFE0F</button>'
          : '')
      + '</td>'
      + '</tr>';
  }).join('') || '<tr><td colspan="9" class="empty-row">No dispatch records yet.</td></tr>';

  var isPrintUser2 = (getState().currentUser || {}).role === 'print';
  return omToolbar(
    '<input class="form-control pl34" placeholder="Search dispatch\u2026" value="' + (_omSearch||'') + '" oninput="_omSearch=this.value;omRefreshTab()">',
    isPrintUser2 ? '' : '<button class="btn btn-maroon" onclick="omNewDispatchModal()">+ Schedule Dispatch</button>'
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

function omNewOrderModal() {
  var s = getState();
  var crs = getCustomerRecords();
  var staffList = s.users.filter(function (u) { return u.role === 'staff' || u.role === 'admin'; });
  var custOptions = crs.map(function (c) { return '<option value="' + c.id + '">' + c.businessName + ' (' + c.contactPerson + ')</option>'; }).join('');
  var staffOptions = staffList.map(function (u) { return '<option value="' + u.name + '">' + u.name + '</option>'; }).join('');

  showModal(
    '<div class="modal-header"><h2>' + iconSvg('box') + ' Create New Order</h2><button class="btn-close-modal" onclick="closeModal()">\u2715</button></div>'
    + '<div class="modal-body">'

    // ── Customer Info ──
    + '<div class="om-modal-section-label">\uD83D\uDC65 Customer Information</div>'
    + '<div class="form-row-2">'
    +   '<div class="form-group"><label>Select Existing Customer</label>'
    +     '<div class="form-select-wrap"><select id="om-cust-sel" class="form-control" onchange="omAutofillCustomer(this.value)">'
    +       '<option value="">\u2014 New Customer \u2014</option>' + custOptions
    +     '</select></div>'
    +   '</div>'
    +   '<div class="form-group"><label>Order Date</label><input id="om-order-date" type="date" class="form-control" value="' + new Date().toISOString().slice(0, 10) + '"></div>'
    + '</div>'
    + '<div class="form-row-2">'
    +   '<div class="form-group"><label>Business Name <span style="color:var(--danger)">*</span></label><input id="om-business" class="form-control" placeholder="Business or company name"></div>'
    +   '<div class="form-group"><label>Contact Person</label><input id="om-contact" class="form-control" placeholder="Full name"></div>'
    + '</div>'
    + '<div class="form-row-2">'
    +   '<div class="form-group"><label>Phone</label><input id="om-phone" class="form-control" placeholder="0917-xxx-xxxx"></div>'
    +   '<div class="form-group"><label>Email</label><input id="om-email" type="email" class="form-control" placeholder="email@example.com"></div>'
    + '</div>'
    + '<div class="form-group"><label>Address</label><input id="om-address" class="form-control" placeholder="Business address"></div>'
    + '<div class="form-row-2">'
    +   '<div class="form-group"><label>Mode of Payment</label><div class="form-select-wrap"><select id="om-mop" class="form-control"><option value="Cash">Cash</option><option value="GCash">GCash</option><option value="Cash+GCash">Cash + GCash</option><option value="Bank Transfer">Bank Transfer</option></select></div></div>'
    +   '<div class="form-group"><label>Mode of Delivery</label><div class="form-select-wrap"><select id="om-mod" class="form-control"><option value="Pickup">Pickup</option><option value="Delivery">Delivery</option></select></div></div>'
    + '</div>'
    + '<div class="form-row-2">'
    +   '<div class="form-group"><label>Branch Staff in Charge</label><div class="form-select-wrap"><select id="om-staff" class="form-control"><option value="">\u2014 None \u2014</option>' + staffOptions + '</select></div></div>'
    +   '<div class="form-group"><label>Due Date</label><input id="om-due-date" type="date" class="form-control"></div>'
    + '</div>'

    + '<hr class="divider" style="margin:16px 0">'

    // ── Order Details ──
    + '<div class="om-modal-section-label">\uD83D\uDCE6 Order Details</div>'
    + '<div class="form-row-2">'
    +   '<div class="form-group"><label>Product Category</label><input id="om-prod-cat" class="form-control" placeholder="e.g. Paper Cups, Boxes"></div>'
    +   '<div class="form-group"><label>Product Type / Size <span style="color:var(--danger)">*</span></label><input id="om-prod-type" class="form-control" placeholder="e.g. Ripple Wall Cup 8oz"></div>'
    + '</div>'
    + '<div class="form-row-3">'
    +   '<div class="form-group"><label>Quantity <span style="color:var(--danger)">*</span></label><input id="om-qty" type="number" class="form-control" min="1" value="1" oninput="omCalcTotal()"></div>'
    +   '<div class="form-group"><label>Unit Price (per pc)</label><input id="om-unit-price" type="number" class="form-control" min="0" value="0" oninput="omCalcTotal()"></div>'
    +   '<div class="form-group"><label>Print Color</label><input id="om-print-color" class="form-control" placeholder="e.g. 1-color, Full Color"></div>'
    + '</div>'

    // ── Plate Section ──
    + '<div class="om-modal-section-label" style="margin-top:12px">\uD83C\uDFAF Plate Charge</div>'
    + '<div style="background:var(--cream);border:1.5px solid var(--ink-10);border-radius:var(--radius);padding:14px 16px;margin-bottom:14px">'
    +   '<div class="form-row-3">'
    +     '<div class="form-group" style="margin-bottom:0">'
    +       '<label>Customer Type</label>'
    +       '<div class="form-select-wrap"><select id="om-cust-type" class="form-control" onchange="omCalcTotal()">'
    +         '<option value="new">New Customer</option>'
    +         '<option value="old">Old Customer</option>'
    +       '</select></div>'
    +     '</div>'
    +     '<div class="form-group" style="margin-bottom:0">'
    +       '<label>New Logo? <span class="text-xs text-muted">(old customers)</span></label>'
    +       '<div class="form-select-wrap"><select id="om-new-logo" class="form-control" onchange="omCalcTotal()">'
    +         '<option value="0">No \u2014 Reuse existing</option>'
    +         '<option value="1">Yes \u2014 New logo</option>'
    +       '</select></div>'
    +     '</div>'
    +     '<div class="form-group" style="margin-bottom:0">'
    +       '<label>Product Fee</label>'
    +       '<input id="om-product-fee" type="number" class="form-control" min="0" value="0" placeholder="0.00" oninput="omCalcTotal()">'
    +     '</div>'
    +   '</div>'
    +   '<div style="margin-top:10px;padding:10px 12px;background:var(--white);border-radius:var(--radius-sm);border:1px solid var(--ink-10);font-size:13px">'
    +     '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">'
    +       '<span style="color:var(--ink-60)">Plate Charge:</span>'
    +       '<strong id="om-plate-charge-display" style="color:var(--maroon)">\u20B10.00</strong>'
    +     '</div>'
    +     '<div id="om-plate-note-auto" class="text-xs text-muted"></div>'
    +   '</div>'
    +   '<div class="form-group" style="margin-top:10px;margin-bottom:0">'
    +     '<label>Plate Note <span class="text-xs text-muted">(auto-filled, editable)</span></label>'
    +     '<input id="om-plate-note" class="form-control" placeholder="e.g. New plate, Re-use">'
    +   '</div>'
    + '</div>'

    + '<div class="form-group"><label>Order Notes</label><textarea id="om-notes" class="form-control" rows="2" placeholder="Special instructions\u2026"></textarea></div>'

    + '<hr class="divider" style="margin:16px 0">'

    // ── Logo Upload ──
    + '<div class="om-modal-section-label">\uD83D\uDDBC\uFE0F Logo Upload</div>'
    + '<div class="form-group"><label>Upload Logo File(s)</label><input id="om-logo-files" type="file" class="form-control" multiple accept="image/*,.pdf,.ai,.eps,.svg"><div class="text-xs text-muted" style="margin-top:4px">Accepted: Images, PDF, AI, EPS, SVG.</div></div>'

    + '<hr class="divider" style="margin:16px 0">'

    // ── Payment Details ──
    + '<div class="om-modal-section-label">\uD83D\uDCB3 Payment Details</div>'
    + '<div style="background:var(--cream);border:1.5px solid var(--ink-10);border-radius:var(--radius);padding:14px 16px;margin-bottom:14px">'
    +   '<div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:8px;margin-bottom:10px">'
    +     '<div><div class="text-xs text-muted" style="margin-bottom:2px">Products Subtotal</div><div id="om-summary-products" style="font-weight:700;font-size:14px">\u20B10.00</div></div>'
    +     '<div><div class="text-xs text-muted" style="margin-bottom:2px">Plate Charge</div><div id="om-summary-plate" style="font-weight:700;font-size:14px;color:var(--maroon)">\u20B10.00</div></div>'
    +     '<div><div class="text-xs text-muted" style="margin-bottom:2px">Discount</div><div id="om-summary-discount" style="font-weight:700;font-size:14px;color:var(--success)">- \u20B10.00</div></div>'
    +     '<div><div class="text-xs text-muted" style="margin-bottom:2px">Total</div><div id="om-summary-total" style="font-weight:800;font-size:16px;color:var(--maroon)">\u20B10.00</div></div>'
    +   '</div>'
    +   '<div id="om-discount-note" class="text-xs" style="color:var(--success);margin-bottom:8px;display:none"></div>'
    + '</div>'
    + '<div class="form-row-3">'
    +   '<div class="form-group"><label>Total Amount</label><input id="om-total" type="number" class="form-control" min="0" value="0" oninput="omCalcBalance()" style="font-weight:700"></div>'
    +   '<div class="form-group"><label>Downpayment</label><input id="om-downpayment" type="number" class="form-control" min="0" value="0" oninput="omCalcBalance()"></div>'
    +   '<div class="form-group"><label>Balance</label><input id="om-balance" type="number" class="form-control" readonly style="background:var(--cream)"></div>'
    + '</div>'
    + '<div class="form-row-2">'
    +   '<div class="form-group"><label>Payment Status</label><div class="form-select-wrap"><select id="om-pay-status" class="form-control"><option value="Pending">Pending</option><option value="30%">30% Downpayment</option><option value="Partial">Partial</option><option value="Fully Paid">Fully Paid</option></select></div></div>'
    +   '<div class="form-group"><label>Order Status</label><div class="form-select-wrap"><select id="om-order-status" class="form-control"><option value="pending">Pending</option><option value="production">In Production</option></select></div></div>'
    + '</div>'

    + '</div>'
    + '<div class="modal-footer"><button class="btn btn-outline" onclick="closeModal()">Cancel</button><button class="btn btn-maroon" onclick="omConfirmNewOrder()">Create Order \u2192</button></div>'
  );

  // Run initial calc after modal renders
  setTimeout(omCalcTotal, 50);
}

// Pricing constants
var OM_PLATE_PER_COLOR = 550;
var OM_DISCOUNT_THRESHOLD = 3000;
var OM_DISCOUNT_RATE = 0.05; // 5% — adjust as needed

function omCalcTotal() {
  function gv(id) { var el = document.getElementById(id); return el ? el.value : ''; }
  function sv(id, v) { var el = document.getElementById(id); if (el) el.value = v; }
  function st(id, v) { var el = document.getElementById(id); if (el) el.textContent = v; }

  var qty      = parseInt(gv('om-qty')) || 0;
  var unitPrice = parseFloat(gv('om-unit-price')) || 0;
  var productFee = parseFloat(gv('om-product-fee')) || 0;
  var custType = gv('om-cust-type'); // 'new' or 'old'
  var newLogo  = gv('om-new-logo') === '1';

  // Product subtotal
  var productsSub = qty * unitPrice;

  // Plate charge logic:
  // New customer → product fee + 550
  // Old customer, new logo → product fee + 550
  // Old customer, reuse logo → 0
  var plateCharge = 0;
  var plateNote   = '';
  if (custType === 'new') {
    plateCharge = productFee + OM_PLATE_PER_COLOR;
    plateNote   = 'New customer: Product fee (\u20B1' + omFmt(productFee) + ') + Plate (\u20B1' + OM_PLATE_PER_COLOR + ')';
    sv('om-plate-note', 'New plate \u2014 \u20B1' + omFmt(productFee) + ' product fee + \u20B1' + OM_PLATE_PER_COLOR + ' plate charge');
  } else if (newLogo) {
    plateCharge = productFee + OM_PLATE_PER_COLOR;
    plateNote   = 'New logo: Product fee (\u20B1' + omFmt(productFee) + ') + Plate (\u20B1' + OM_PLATE_PER_COLOR + ')';
    sv('om-plate-note', 'New logo \u2014 \u20B1' + omFmt(productFee) + ' product fee + \u20B1' + OM_PLATE_PER_COLOR + ' plate charge');
  } else {
    plateCharge = 0;
    plateNote   = 'Old customer \u2014 no plate charge';
    sv('om-plate-note', 'Re-use existing plate');
  }

  // Subtotal before discount
  var subtotal = productsSub + plateCharge;

  // Discount: 5% if order >= 3,000 (on product subtotal only, not plate)
  var discountAmt = 0;
  var discountNote = '';
  if (productsSub >= OM_DISCOUNT_THRESHOLD) {
    discountAmt  = Math.round(productsSub * OM_DISCOUNT_RATE * 100) / 100;
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

  omCalcBalance();
}

function omCalcBalance() {
  var total = parseFloat((document.getElementById('om-total') || {}).value) || 0;
  var down  = parseFloat((document.getElementById('om-downpayment') || {}).value) || 0;
  var balEl = document.getElementById('om-balance');
  if (balEl) balEl.value = Math.max(0, total - down).toFixed(2);
}

function omAutofillCustomer(customerId) {
  if (!customerId) {
    // Reset to new customer
    var ct = document.getElementById('om-cust-type');
    if (ct) ct.value = 'new';
    omCalcTotal();
    return;
  }
  var crs = getCustomerRecords();
  var c = crs.find(function (x) { return x.id === customerId; });
  if (!c) return;
  function sv(id, v) { var el = document.getElementById(id); if (el) el.value = v || ''; }
  sv('om-business', c.businessName);
  sv('om-contact', c.contactPerson);
  sv('om-phone', c.phone);
  sv('om-email', c.email);
  sv('om-address', c.address);
  var mopSel = document.getElementById('om-mop'); if (mopSel && c.modeOfPayment) mopSel.value = c.modeOfPayment;
  var modSel = document.getElementById('om-mod'); if (modSel && c.modeOfDelivery) modSel.value = c.modeOfDelivery;
  var staffSel = document.getElementById('om-staff'); if (staffSel && c.branchStaff) staffSel.value = c.branchStaff;
  // Mark as old customer since they exist in records
  var ct = document.getElementById('om-cust-type'); if (ct) ct.value = 'old';
  omCalcTotal();
}

function omConfirmNewOrder() {
  function gv(id) { var el = document.getElementById(id); return el ? el.value : ''; }
  var businessName = gv('om-business').trim();
  var qty = parseInt(gv('om-qty')) || 0;
  if (!businessName) { showToast('Business name is required.', 'error'); return; }
  if (qty <= 0)       { showToast('Quantity must be at least 1.', 'error'); return; }

  var total   = parseFloat(gv('om-total'))       || 0;
  var down    = parseFloat(gv('om-downpayment')) || 0;
  var balance = Math.max(0, total - down);
  var customerRecordId = gv('om-cust-sel');

  var orders = getOrders();
  var maxId  = orders.length ? Math.max.apply(null, orders.map(function (o) { return Number(o.id) || 0; })) : 0;

  // Gather pricing breakdown for record-keeping
  var unitPrice  = parseFloat(gv('om-unit-price')) || 0;
  var productFee = parseFloat(gv('om-product-fee')) || 0;
  var custType   = gv('om-cust-type');
  var newLogo    = gv('om-new-logo') === '1';
  var productsSub = qty * unitPrice;
  var plateCharge = (custType === 'new' || newLogo) ? (productFee + OM_PLATE_PER_COLOR) : 0;
  var discountAmt = productsSub >= OM_DISCOUNT_THRESHOLD ? Math.round(productsSub * OM_DISCOUNT_RATE * 100) / 100 : 0;

  var newOrder = {
    id: maxId + 1,
    customer_record_id: customerRecordId,
    customer_name:   businessName,
    contact_person:  gv('om-contact'),
    phone:           gv('om-phone'),
    email:           gv('om-email'),
    address:         gv('om-address'),
    mode_of_payment: gv('om-mop'),
    mode_of_delivery: gv('om-mod'),
    branch_staff:    gv('om-staff'),
    notes:           gv('om-notes'),
    product_category: gv('om-prod-cat'),
    product_type:    gv('om-prod-type'),
    quantity:        qty,
    unit_price:      unitPrice,
    product_fee:     productFee,
    plate_charge:    plateCharge,
    discount_amount: discountAmt,
    customer_type:   custType,
    print_color:     gv('om-print-color'),
    plate_note:      gv('om-plate-note'),
    total_amount:    total,
    status:          gv('om-order-status') || 'pending',
    downpayment:     down,
    balance:         balance,
    payment_mode:    gv('om-mop'),
    payment_status:  gv('om-pay-status') || 'Pending',
    due_date:        gv('om-due-date'),
    order_date:      gv('om-order-date'),
    created_at:      new Date().toISOString(),
  };

  orders.push(newOrder);
  saveOrders(orders);
  DB.saveOrder(newOrder);

  var logoInput = document.getElementById('om-logo-files');
  if (logoInput && logoInput.files && logoInput.files.length > 0) {
    var logos = getLogoUploads();
    Array.from(logoInput.files).forEach(function (f) {
      logos.push({ id: omGenId('logo'), orderId: newOrder.id, customerId: customerRecordId, businessName: businessName, fileName: f.name, fileSize: f.size, uploadedAt: new Date().toISOString() });
    });
    saveLogoUploads(logos);
  }

  var payments = getPaymentRecords();
  payments.push({
    id: omGenId('pay'), orderId: newOrder.id, orderNumber: newOrder.id,
    customerId: customerRecordId, businessName: businessName,
    contactPerson: newOrder.contact_person, totalAmount: total,
    downpayment: down, balance: balance, modeOfPayment: newOrder.payment_mode,
    paymentStatus: newOrder.payment_status, date: new Date().toISOString(), note: ''
  });
  savePaymentRecords(payments);

  closeModal();
  showToast('Order #' + String(newOrder.id).padStart(6,'0') + ' created!', 'success');
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
    + '<div class="modal-footer"><button class="btn btn-outline" onclick="closeModal()">Close</button><button class="btn btn-maroon" onclick="closeModal();omEditOrderModal(\'' + o.id + '\')">Edit Order</button></div>');
}

function omEditOrderModal(orderId) {
  var orders = getOrders();
  var o = orders.find(function (x) { return String(x.id) === String(orderId); });
  if (!o) { showToast('Order not found.', 'error'); return; }

  showModal('<div class="modal-header"><h2>' + iconSvg('note') + ' Edit Order #' + String(o.id).padStart(6, '0') + '</h2><button class="btn-close-modal" onclick="closeModal()">\u2715</button></div>'
    + '<div class="modal-body">'
    + '<div class="form-row-2"><div class="form-group"><label>Business Name</label><input id="ome-business" class="form-control" value="' + (o.customer_name || '') + '"></div>'
    + '<div class="form-group"><label>Contact Person</label><input id="ome-contact" class="form-control" value="' + (o.contact_person || '') + '"></div></div>'
    + '<div class="form-row-2"><div class="form-group"><label>Phone</label><input id="ome-phone" class="form-control" value="' + (o.phone || '') + '"></div>'
    + '<div class="form-group"><label>Email</label><input id="ome-email" class="form-control" value="' + (o.email || '') + '"></div></div>'
    + '<div class="form-group"><label>Address</label><input id="ome-address" class="form-control" value="' + (o.address || '') + '"></div>'
    + '<div class="form-row-2"><div class="form-group"><label>Product Category</label><input id="ome-prod-cat" class="form-control" value="' + (o.product_category || '') + '"></div>'
    + '<div class="form-group"><label>Product Type/Size</label><input id="ome-prod-type" class="form-control" value="' + (o.product_type || '') + '"></div></div>'
    + '<div class="form-row-3"><div class="form-group"><label>Quantity</label><input id="ome-qty" type="number" class="form-control" value="' + (o.quantity || 1) + '"></div>'
    + '<div class="form-group"><label>Print Color</label><input id="ome-print-color" class="form-control" value="' + (o.print_color || '') + '"></div>'
    + '<div class="form-group"><label>Plate Note</label><input id="ome-plate-note" class="form-control" value="' + (o.plate_note || '') + '"></div></div>'
    + '<div class="form-row-3"><div class="form-group"><label>Total Amount</label><input id="ome-total" type="number" class="form-control" value="' + (o.total_amount || 0) + '" oninput="omEditCalcBalance()"></div>'
    + '<div class="form-group"><label>Downpayment</label><input id="ome-down" type="number" class="form-control" value="' + (o.downpayment || 0) + '" oninput="omEditCalcBalance()"></div>'
    + '<div class="form-group"><label>Balance</label><input id="ome-balance" type="number" class="form-control" readonly style="background:var(--cream)" value="' + (o.balance || 0) + '"></div></div>'
    + '<div class="form-row-2"><div class="form-group"><label>Pay Mode</label><div class="form-select-wrap"><select id="ome-mop" class="form-control">'
    + '<option value="Cash" ' + (o.payment_mode === 'Cash' ? 'selected' : '') + '>Cash</option>'
    + '<option value="GCash" ' + (o.payment_mode === 'GCash' ? 'selected' : '') + '>GCash</option>'
    + '<option value="Cash+GCash" ' + (o.payment_mode === 'Cash+GCash' ? 'selected' : '') + '>Cash + GCash</option>'
    + '<option value="Bank Transfer" ' + (o.payment_mode === 'Bank Transfer' ? 'selected' : '') + '>Bank Transfer</option>'
    + '</select></div></div>'
    + '<div class="form-group"><label>Pay Status</label><div class="form-select-wrap"><select id="ome-pay-status" class="form-control">'
    + '<option value="Pending" ' + (o.payment_status === 'Pending' ? 'selected' : '') + '>Pending</option>'
    + '<option value="30%" ' + (o.payment_status === '30%' ? 'selected' : '') + '>30%</option>'
    + '<option value="Partial" ' + (o.payment_status === 'Partial' ? 'selected' : '') + '>Partial</option>'
    + '<option value="Fully Paid" ' + (o.payment_status === 'Fully Paid' ? 'selected' : '') + '>Fully Paid</option>'
    + '</select></div></div></div>'
    + '<div class="form-row-2"><div class="form-group"><label>Due Date</label><input id="ome-due" type="date" class="form-control" value="' + (o.due_date || '') + '"></div>'
    + '<div class="form-group"><label>Order Status</label><div class="form-select-wrap"><select id="ome-status" class="form-control">'
    + '<option value="pending" ' + (o.status === 'pending' ? 'selected' : '') + '>Pending</option>'
    + '<option value="production" ' + (o.status === 'production' ? 'selected' : '') + '>In Production</option>'
    + '<option value="dispatch" ' + (o.status === 'dispatch' ? 'selected' : '') + '>Dispatch</option>'
    + '<option value="completed" ' + (o.status === 'completed' ? 'selected' : '') + '>Completed</option>'
    + '<option value="cancelled" ' + (o.status === 'cancelled' ? 'selected' : '') + '>Cancelled</option>'
    + '</select></div></div></div>'
    + '<div class="form-group"><label>Notes</label><textarea id="ome-notes" class="form-control" rows="2">' + (o.notes || '') + '</textarea></div>'
    + '<div class="form-group"><label>Upload Additional Logo(s)</label><input id="ome-logo-files" type="file" class="form-control" multiple accept="image/*,.pdf,.ai,.eps,.svg"></div>'
    + '</div>'
    + '<div class="modal-footer"><button class="btn btn-outline" onclick="closeModal()">Cancel</button><button class="btn btn-maroon" onclick="omSaveEditOrder(\'' + o.id + '\')">Save Changes</button></div>');
}

function omEditCalcBalance() {
  var total = parseFloat((document.getElementById('ome-total') || {}).value) || 0;
  var down = parseFloat((document.getElementById('ome-down') || {}).value) || 0;
  var balEl = document.getElementById('ome-balance');
  if (balEl) balEl.value = Math.max(0, total - down).toFixed(2);
}

function omSaveEditOrder(orderId) {
  var orders = getOrders();
  var o = orders.find(function (x) { return String(x.id) === String(orderId); });
  if (!o) return;
  function gv(id) { var el = document.getElementById(id); return el ? el.value : ''; }
  o.customer_name = gv('ome-business') || o.customer_name;
  o.contact_person = gv('ome-contact');
  o.phone = gv('ome-phone'); o.email = gv('ome-email'); o.address = gv('ome-address');
  o.product_category = gv('ome-prod-cat'); o.product_type = gv('ome-prod-type');
  o.quantity = parseInt(gv('ome-qty')) || o.quantity;
  o.print_color = gv('ome-print-color'); o.plate_note = gv('ome-plate-note');
  o.total_amount = parseFloat(gv('ome-total')) || 0;
  o.downpayment = parseFloat(gv('ome-down')) || 0;
  o.balance = parseFloat(gv('ome-balance')) || 0;
  o.payment_mode = gv('ome-mop'); o.payment_status = gv('ome-pay-status');
  o.due_date = gv('ome-due'); o.status = gv('ome-status'); o.notes = gv('ome-notes');
  o.updated_at = new Date().toISOString();
  saveOrders(orders);
  DB.updateOrder(o.id, o);

  var logoInput = document.getElementById('ome-logo-files');
  if (logoInput && logoInput.files && logoInput.files.length > 0) {
    var logos = getLogoUploads();
    Array.from(logoInput.files).forEach(function (f) { logos.push({ id: omGenId('logo'), orderId: o.id, customerId: o.customer_record_id || '', businessName: o.customer_name, fileName: f.name, fileSize: f.size, uploadedAt: new Date().toISOString() }); });
    saveLogoUploads(logos);
  }
  closeModal(); showToast('Order updated!', 'success'); renderOrders();
}

function omMoveToProduction(orderId) {
  var orders = getOrders();
  var o = orders.find(function (x) { return String(x.id) === String(orderId); });
  if (!o) return;
  o.status = 'production'; saveOrders(orders); DB.updateOrder(o.id, { status: 'production' });
  showToast('Order moved to production.', 'success'); renderOrders();
}

function omMoveToDispatch(orderId) {
  var orders = getOrders();
  var o = orders.find(function (x) { return String(x.id) === String(orderId); });
  if (!o) return;
  o.status = 'dispatch'; saveOrders(orders); DB.updateOrder(o.id, { status: 'dispatch' });
  showToast('Order moved to dispatch.', 'success'); renderOrders();
}

// CUSTOMER RECORD MODALS
function omNewCustomerModal() {
  showModal('<div class="modal-header"><h2>' + iconSvg('users') + ' New Customer Record (Print Client)</h2><button class="btn-close-modal" onclick="closeModal()">\u2715</button></div>'
    + '<div class="modal-body">'
    + '<div class="form-row-2"><div class="form-group"><label>Name <span style="color:var(--danger)">*</span></label><input id="omcr-business" class="form-control" placeholder="e.g. Juan dela Cruz or ABC Corp"></div>'
    + '<div class="form-group"><label>Contact Person</label><input id="omcr-contact" class="form-control" placeholder="Person to contact"></div></div>'
    + '<div class="form-row-2"><div class="form-group"><label>Phone</label><input id="omcr-phone" class="form-control" placeholder="0917-xxx-xxxx"></div>'
    + '<div class="form-group"><label>Email</label><input id="omcr-email" class="form-control"></div></div>'
    + '<div class="form-group"><label>Address</label><input id="omcr-address" class="form-control"></div>'
    + '<div class="form-row-2"><div class="form-group"><label>Mode of Payment</label><div class="form-select-wrap"><select id="omcr-mop" class="form-control"><option value="Cash">Cash</option><option value="GCash">GCash</option><option value="Cash+GCash">Cash + GCash</option><option value="Bank Transfer">Bank Transfer</option></select></div></div>'
    + '<div class="form-group"><label>Mode of Delivery</label><div class="form-select-wrap"><select id="omcr-mod" class="form-control"><option value="Pickup">Pickup</option><option value="Delivery">Delivery</option></select></div></div></div>'
    + '<div class="form-group"><label>Branch Staff in Charge</label><input id="omcr-staff" class="form-control"></div>'
    + '<div class="form-group"><label>Notes</label><textarea id="omcr-notes" class="form-control" rows="2"></textarea></div>'
    + '</div>'
    + '<div class="modal-footer"><button class="btn btn-outline" onclick="closeModal()">Cancel</button><button class="btn btn-maroon" onclick="omSaveCustomerRecord()">Save Customer</button></div>');
}

function omSaveCustomerRecord() {
  function gv(id) { var el = document.getElementById(id); return el ? el.value : ''; }
  var businessName = gv('omcr-business').trim();
  if (!businessName) { showToast('Business name is required.', 'error'); return; }
  var crs = getCustomerRecords();
  crs.push({ id: omGenId('CR'), businessName: businessName, contactPerson: gv('omcr-contact'), phone: gv('omcr-phone'), email: gv('omcr-email'), address: gv('omcr-address'), modeOfPayment: gv('omcr-mop'), modeOfDelivery: gv('omcr-mod'), branchStaff: gv('omcr-staff'), notes: gv('omcr-notes'), createdAt: new Date().toISOString() });
  saveCustomerRecords(crs);
  closeModal(); showToast('Customer record saved!', 'success'); _omTab = 'customers'; renderOrders();
}

function omEditCustomerModal(customerId) {
  var crs = getCustomerRecords();
  var c = crs.find(function (x) { return x.id === customerId; });
  if (!c) return;
  showModal('<div class="modal-header"><h2>Edit Customer: ' + c.businessName + '</h2><button class="btn-close-modal" onclick="closeModal()">\u2715</button></div>'
    + '<div class="modal-body">'
    + '<div class="form-row-2"><div class="form-group"><label>Business Name</label><input id="omce-business" class="form-control" value="' + (c.businessName || '') + '"></div>'
    + '<div class="form-group"><label>Contact Person</label><input id="omce-contact" class="form-control" value="' + (c.contactPerson || '') + '"></div></div>'
    + '<div class="form-row-2"><div class="form-group"><label>Phone</label><input id="omce-phone" class="form-control" value="' + (c.phone || '') + '"></div>'
    + '<div class="form-group"><label>Email</label><input id="omce-email" class="form-control" value="' + (c.email || '') + '"></div></div>'
    + '<div class="form-group"><label>Address</label><input id="omce-address" class="form-control" value="' + (c.address || '') + '"></div>'
    + '<div class="form-row-2"><div class="form-group"><label>Mode of Payment</label><div class="form-select-wrap"><select id="omce-mop" class="form-control">'
    + '<option value="Cash" ' + (c.modeOfPayment === 'Cash' ? 'selected' : '') + '>Cash</option>'
    + '<option value="GCash" ' + (c.modeOfPayment === 'GCash' ? 'selected' : '') + '>GCash</option>'
    + '<option value="Cash+GCash" ' + (c.modeOfPayment === 'Cash+GCash' ? 'selected' : '') + '>Cash + GCash</option>'
    + '<option value="Bank Transfer" ' + (c.modeOfPayment === 'Bank Transfer' ? 'selected' : '') + '>Bank Transfer</option>'
    + '</select></div></div>'
    + '<div class="form-group"><label>Mode of Delivery</label><div class="form-select-wrap"><select id="omce-mod" class="form-control">'
    + '<option value="Pickup" ' + (c.modeOfDelivery === 'Pickup' ? 'selected' : '') + '>Pickup</option>'
    + '<option value="Delivery" ' + (c.modeOfDelivery === 'Delivery' ? 'selected' : '') + '>Delivery</option>'
    + '</select></div></div></div>'
    + '<div class="form-group"><label>Branch Staff</label><input id="omce-staff" class="form-control" value="' + (c.branchStaff || '') + '"></div>'
    + '<div class="form-group"><label>Notes</label><textarea id="omce-notes" class="form-control" rows="2">' + (c.notes || '') + '</textarea></div>'
    + '</div>'
    + '<div class="modal-footer"><button class="btn btn-outline" onclick="closeModal()">Cancel</button><button class="btn btn-maroon" onclick="omConfirmEditCustomer(\'' + customerId + '\')">Save</button></div>');
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
  saveCustomerRecords(crs); closeModal(); showToast('Customer updated!', 'success'); renderOrders();
}

function omDeleteCustomer(customerId) {
  if (!confirm('Delete this customer record? Their orders will be unaffected.')) return;
  saveCustomerRecords(getCustomerRecords().filter(function (c) { return c.id !== customerId; }));
  showToast('Customer deleted.', 'warning'); renderOrders();
}

// PAYMENT MODALS
function omNewPaymentModal() {
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
  o.payment_status = gv('ompay-status');
  saveOrders(orders);

  var payments = getPaymentRecords();
  payments.push({ id: omGenId('pay'), orderId: o.id, orderNumber: o.id, customerId: o.customer_record_id || '', businessName: o.customer_name, contactPerson: o.contact_person || '', totalAmount: o.total_amount || 0, downpayment: o.downpayment, balance: o.balance, modeOfPayment: o.payment_mode, paymentStatus: o.payment_status, amountPaid: amount, date: new Date().toISOString(), note: gv('ompay-note') });
  savePaymentRecords(payments);
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
    + '<div class="form-group"><label>Mode of Payment</label><div class="form-select-wrap"><select id="omupdpay-mop" class="form-control"><option value="Cash">Cash</option><option value="GCash">GCash</option><option value="Cash+GCash">Cash + GCash</option></select></div></div></div>'
    + '<div class="form-group"><label>Note</label><input id="omupdpay-note" class="form-control" placeholder="Optional note"></div>'
    + '</div>'
    + '<div class="modal-footer"><button class="btn btn-outline" onclick="closeModal()">Cancel</button><button class="btn btn-maroon" onclick="omConfirmUpdatePayment(\'' + p.orderId + '\',\'' + paymentId + '\')">Record Payment</button></div>');
}

function omConfirmUpdatePayment(orderId, paymentId) {
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
  payments.push({ id: omGenId('pay'), orderId: o.id, orderNumber: o.id, customerId: o.customer_record_id || '', businessName: o.customer_name, contactPerson: o.contact_person || '', totalAmount: o.total_amount || 0, downpayment: o.downpayment, balance: o.balance, modeOfPayment: o.payment_mode, paymentStatus: o.payment_status, amountPaid: amount, date: new Date().toISOString(), note: (document.getElementById('omupdpay-note') || { value: '' }).value });
  savePaymentRecords(payments);
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
    + '<div class="form-group"><label>Status</label><div class="form-select-wrap"><select id="omprod-status" class="form-control"><option value="pending">Pending</option><option value="production" selected>In Production</option><option value="completed">Completed</option></select></div></div></div>'
    + '<div class="form-group"><label>Materials Used</label><input id="omprod-materials" class="form-control" placeholder="e.g. 500 sheets, 2 ink cartridges"></div>'
    + '<div class="form-group"><label>Notes</label><textarea id="omprod-notes" class="form-control" rows="2"></textarea></div>'
    + '<div class="form-group"><label>Completion Date (if completed)</label><input id="omprod-completion" type="date" class="form-control"></div>'
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
  function gv(id) { var el = document.getElementById(id); return el ? el.value : ''; }
  var orderId = gv('omprod-order'); var assignedTo = gv('omprod-assign');
  if (!orderId) { showToast('Select an order.', 'error'); return; }
  if (!assignedTo) { showToast('Select printing personnel.', 'error'); return; }
  var orders = getOrders();
  var o = orders.find(function (x) { return String(x.id) === String(orderId); });
  if (!o) return;
  var prodStatus = gv('omprod-status');
  if (prodStatus === 'production') { o.status = 'production'; saveOrders(orders); }
  else if (prodStatus === 'completed') { o.status = 'dispatch'; saveOrders(orders); }

  var prods = getProductionRecords();
  prods.push({ id: omGenId('prod'), orderId: o.id, orderNumber: o.id, customerId: o.customer_record_id || '', businessName: o.customer_name, orderDate: o.created_at, assignedTo: assignedTo, progress: parseInt(gv('omprod-progress')) || 0, status: prodStatus, materialsUsed: gv('omprod-materials'), notes: gv('omprod-notes'), qcResult: 'Pending', checkCount: 0, completionDate: gv('omprod-completion') || null, createdAt: new Date().toISOString() });
  saveProductionRecords(prods);
  closeModal(); showToast('Production record created!', 'success'); _omTab = 'production'; renderOrders();
}

function omUpdateProductionModal(prodId) {
  var p = getProductionRecords().find(function (x) { return x.id === prodId; });
  if (!p) return;
  showModal('<div class="modal-header"><h2>' + iconSvg('printer') + ' Update Production</h2><button class="btn-close-modal" onclick="closeModal()">\u2715</button></div>'
    + '<div class="modal-body">'
    + '<div class="alert alert-info">Order #' + String(p.orderNumber || '').padStart(6, '0') + ' \u00B7 <strong>' + p.businessName + '</strong> \u00B7 Assigned to: <strong>' + p.assignedTo + '</strong></div>'
    + '<div class="form-row-2"><div class="form-group"><label>Progress (%)</label><input id="omupd-progress" type="number" class="form-control" min="0" max="100" value="' + (p.progress || 0) + '"></div>'
    + '<div class="form-group"><label>Status</label><div class="form-select-wrap"><select id="omupd-status" class="form-control">'
    + '<option value="pending" ' + (p.status === 'pending' ? 'selected' : '') + '>Pending</option>'
    + '<option value="production" ' + (p.status === 'production' ? 'selected' : '') + '>In Production</option>'
    + '<option value="completed" ' + (p.status === 'completed' ? 'selected' : '') + '>Completed</option>'
    + '</select></div></div></div>'
    + '<div class="form-group"><label>Materials Used</label><input id="omupd-materials" class="form-control" value="' + (p.materialsUsed || '') + '"></div>'
    + '<div class="form-group"><label>Notes</label><textarea id="omupd-notes" class="form-control" rows="2">' + (p.notes || '') + '</textarea></div>'
    + '<div class="form-group"><label>Completion Date</label><input id="omupd-completion" type="date" class="form-control" value="' + (p.completionDate || '') + '"></div>'
    + '</div>'
    + '<div class="modal-footer"><button class="btn btn-outline" onclick="closeModal()">Cancel</button><button class="btn btn-maroon" onclick="omConfirmUpdateProd(\'' + prodId + '\')">Update</button></div>');
}

function omConfirmUpdateProd(prodId) {
  var prods = getProductionRecords();
  var p = prods.find(function (x) { return x.id === prodId; });
  if (!p) return;
  function gv(id) { var el = document.getElementById(id); return el ? el.value : ''; }
  p.progress = parseInt(gv('omupd-progress')) || 0; p.status = gv('omupd-status');
  p.materialsUsed = gv('omupd-materials'); p.notes = gv('omupd-notes');
  p.completionDate = gv('omupd-completion') || null; p.updatedAt = new Date().toISOString();
  saveProductionRecords(prods); closeModal(); showToast('Production updated!', 'success'); renderOrders();
}

function omQCModal(prodId) {
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

function omSaveQC(prodId, result) {
  var prods = getProductionRecords();
  var p = prods.find(function (x) { return x.id === prodId; });
  if (!p) return;
  p.qcResult = result; p.checkCount = (p.checkCount || 0) + 1;
  p.qcNotes = (document.getElementById('omqc-notes') || { value: '' }).value;
  p.qcDate = new Date().toISOString();
  if (result === 'Pass') p.status = 'completed';
  saveProductionRecords(prods); closeModal();
  showToast('QC ' + result + ' recorded.', result === 'Pass' ? 'success' : 'error'); renderOrders();
}

// DISPATCH MODALS
function omNewDispatchModal() {
  var orders = getOrders().filter(function (o) { return o.status === 'dispatch' || o.status === 'production'; });
  var orderOptions = orders.map(function (o) { return '<option value="' + o.id + '">#' + String(o.id).padStart(6, '0') + ' \u2014 ' + o.customer_name + '</option>'; }).join('');

  showModal('<div class="modal-header"><h2>' + iconSvg('truck') + ' Schedule Dispatch</h2><button class="btn-close-modal" onclick="closeModal()">\u2715</button></div>'
    + '<div class="modal-body">'
    + '<div class="form-row-2"><div class="form-group"><label>Select Order <span style="color:var(--danger)">*</span></label><div class="form-select-wrap"><select id="omdisp-order" class="form-control" onchange="omAutofillDispatch(this.value)"><option value="">\u2014 Select Order \u2014</option>' + orderOptions + '</select></div></div>'
    + '<div class="form-group"><label>Date</label><input id="omdisp-date" type="date" class="form-control" value="' + new Date().toISOString().slice(0, 10) + '"></div></div>'
    + '<div id="omdisp-cust-info" style="background:var(--cream);border-radius:var(--radius-sm);padding:12px;margin-bottom:12px;display:none;font-size:13px"><strong id="omdisp-cust-name">\u2014</strong> \u00B7 <span id="omdisp-pay-status-info">\u2014</span><div style="margin-top:4px;font-weight:700" id="omdisp-balance-info"></div></div>'
    + '<div class="form-row-2"><div class="form-group"><label>Dispatch Method</label><div class="form-select-wrap"><select id="omdisp-method" class="form-control"><option value="Pickup">Pickup</option><option value="Delivery">Delivery</option></select></div></div>'
    + '<div class="form-group"><label>Dispatch Status</label><div class="form-select-wrap"><select id="omdisp-status" class="form-control"><option value="Scheduled">Scheduled</option><option value="Dispatched">Dispatched</option><option value="Delivered">Delivered</option></select></div></div></div>'
    + '<div class="form-group"><label>Customer Notified?</label><div style="display:flex;gap:12px;margin-top:8px">'
    + '<label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="radio" name="omdisp-notified" id="omdisp-notified-yes" value="1"> Yes</label>'
    + '<label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="radio" name="omdisp-notified" id="omdisp-notified-no" value="0" checked> No</label>'
    + '</div></div>'
    + '<div class="form-group"><label>Notes</label><textarea id="omdisp-notes" class="form-control" rows="2"></textarea></div>'
    + '</div>'
    + '<div class="modal-footer"><button class="btn btn-outline" onclick="closeModal()">Cancel</button><button class="btn btn-maroon" onclick="omSaveDispatch()">Schedule Dispatch</button></div>');
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
  var orderId = gv('omdisp-order');
  if (!orderId) { showToast('Select an order.', 'error'); return; }
  var orders = getOrders();
  var o = orders.find(function (x) { return String(x.id) === String(orderId); });
  if (!o) return;
  var dispStatus = gv('omdisp-status');
  if (dispStatus === 'Delivered') { o.status = 'completed'; saveOrders(orders); }
  else if (dispStatus === 'Dispatched') { o.status = 'dispatch'; saveOrders(orders); }

  var dispatches = getDispatchRecords();
  dispatches.push({ id: omGenId('disp'), orderId: o.id, orderNumber: o.id, customerId: o.customer_record_id || '', businessName: o.customer_name, date: new Date().toISOString(), customerNotified: !!(document.getElementById('omdisp-notified-yes') || {}).checked, paymentStatus: o.payment_status || 'Pending', dispatchMethod: gv('omdisp-method'), dispatchStatus: dispStatus, notes: gv('omdisp-notes'), createdAt: new Date().toISOString() });
  saveDispatchRecords(dispatches);
  closeModal(); showToast('Dispatch scheduled!', 'success'); _omTab = 'dispatch'; renderOrders();
}

function omUpdateDispatchModal(dispId) {
  var d = getDispatchRecords().find(function (x) { return x.id === dispId; });
  if (!d) return;
  showModal('<div class="modal-header"><h2>' + iconSvg('truck') + ' Update Dispatch</h2><button class="btn-close-modal" onclick="closeModal()">\u2715</button></div>'
    + '<div class="modal-body">'
    + '<div class="alert alert-info">Order #' + String(d.orderNumber || '').padStart(6, '0') + ' \u00B7 <strong>' + d.businessName + '</strong></div>'
    + '<div class="form-row-2"><div class="form-group"><label>Dispatch Method</label><div class="form-select-wrap"><select id="omuddisp-method" class="form-control">'
    + '<option value="Pickup" ' + (d.dispatchMethod === 'Pickup' ? 'selected' : '') + '>Pickup</option>'
    + '<option value="Delivery" ' + (d.dispatchMethod === 'Delivery' ? 'selected' : '') + '>Delivery</option>'
    + '</select></div></div>'
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
  var dispatches = getDispatchRecords();
  var d = dispatches.find(function (x) { return x.id === dispId; });
  if (!d) return;
  function gv(id) { var el = document.getElementById(id); return el ? el.value : ''; }
  var dispStatus = gv('omuddisp-status');
  d.dispatchMethod = gv('omuddisp-method'); d.dispatchStatus = dispStatus;
  d.customerNotified = !!(document.getElementById('omuddisp-notified-yes') || {}).checked;
  d.notes = gv('omuddisp-notes'); d.updatedAt = new Date().toISOString();
  saveDispatchRecords(dispatches);
  if (dispStatus === 'Delivered') { var orders = getOrders(); var o = orders.find(function (x) { return String(x.id) === String(d.orderId); }); if (o) { o.status = 'completed'; saveOrders(orders); } }
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
      <button class="btn btn-maroon" onclick="window.print()">${iconSvg('printer')} Print Report</button>
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
  const variants = s.products.flatMap(p => (p.variants || []).map(v => `<option value="${v.id}">${p.name} — ${v.name} (Stock: ${v.stock})</option>`)).join('');
  showModal(`<div class="modal-header"><h2>Branch Stock Transfer</h2><button class="btn-close-modal" onclick="closeModal()">✕</button></div>
    <div class="modal-body">
      <div class="form-group"><label>From Branch</label><div class="form-select-wrap"><select id="tr-from" class="form-control">${s.branches.map(b => `<option value="${b.id}">${b.name}</option>`).join('')}</select></div></div>
      <div class="form-group"><label>To Branch</label><div class="form-select-wrap"><select id="tr-to" class="form-control">${s.branches.map(b => `<option value="${b.id}">${b.name}</option>`).join('')}</select></div></div>
      <div class="form-group"><label>Variant</label><div class="form-select-wrap"><select id="tr-variant" class="form-control">${variants}</select></div></div>
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
  if (qty > found.variant.stock) { showToast('Insufficient stock for transfer.', 'error'); return; }
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
  if (!s.currentUser || s.currentUser.role !== 'admin') {
    showToast('Only admins can manage staff accounts.', 'error');
    navigateTo('dashboard');
    return false;
  }
  return true;
}

function renderUsers() {
  if (!ensureAdminUserManagementAccess()) return;
  const s = getState();
  const staffUsers = s.users.filter(u => u.role !== 'admin');
  document.getElementById('page-content').innerHTML = `
    <div class="page-header" style="display:flex;justify-content:space-between;align-items:flex-start">
      <div><h1 class="page-title">Staff Account Management</h1><p class="page-subtitle">${staffUsers.length} staff accounts</p></div>
      <button class="btn btn-maroon" onclick="addStaffAccountModal()">+ Create Staff Account</button>
    </div>
    <div class="data-card"><div class="data-card-body no-pad">
      <table class="data-table"><thead><tr><th>Name</th><th>Username</th><th>Role</th><th>Branch</th><th>Actions</th></tr></thead>
      <tbody>${staffUsers.map(u => {
    const branch = s.branches.find(b => b.id === u.branchId);
    const roleBadge = u.role === 'staff' ? 'badge-success' : 'badge-info';
    const roleLabel = u.role === 'staff' ? 'Branch Staff' : 'Printing';
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

function addStaffAccountModal() {
  if (!ensureAdminUserManagementAccess()) return;
  const s = getState();
  showModal(`<div class="modal-header"><h2>Create Staff Account</h2><button class="btn-close-modal" onclick="closeModal()">✕</button></div>
    <div class="modal-body">
      <div class="form-group"><label>Full Name</label><input id="nu-name" class="form-control" placeholder="Full name" autocomplete="off"></div>
      <div class="form-group"><label>Username</label><input id="nu-uname" class="form-control" placeholder="Username (for login)" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"></div>
      <div class="form-group"><label>Password</label><div class="pw-wrap"><input id="nu-pass" type="password" class="form-control" placeholder="Password (min 6 chars)" autocomplete="new-password"><button type="button" class="pw-eye" onclick="togglePwVisibility('nu-pass', this)" tabindex="-1" aria-label="Toggle password visibility"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button></div></div>
      <div class="form-group"><label>Confirm Password</label><div class="pw-wrap"><input id="nu-pass-confirm" type="password" class="form-control" placeholder="Re-enter password" autocomplete="new-password"><button type="button" class="pw-eye" onclick="togglePwVisibility('nu-pass-confirm', this)" tabindex="-1" aria-label="Toggle password visibility"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button></div></div>
      <div class="form-group"><label>Role</label><div class="form-select-wrap"><select id="nu-role" class="form-control"><option value="staff">Branch Staff</option><option value="print">Printing Personnel</option></select></div></div>
      <div class="form-group"><label>Branch</label><div class="form-select-wrap"><select id="nu-branch" class="form-control">${s.branches.map(b => `<option value="${b.id}">${b.name}</option>`).join('')}</select></div></div>
    </div>
    <div class="modal-footer"><button class="btn btn-outline" onclick="closeModal()">Cancel</button><button class="btn btn-maroon" onclick="confirmAddStaffAccount()">Create Account</button></div>`);
}

function confirmAddStaffAccount() {
  if (!ensureAdminUserManagementAccess()) return;
  const s = getState();
  const name = document.getElementById('nu-name').value.trim();
  const username = document.getElementById('nu-uname').value.trim();
  const password = document.getElementById('nu-pass').value;
  const confirmPassword = document.getElementById('nu-pass-confirm').value;
  const role = document.getElementById('nu-role').value;
  const branchId = document.getElementById('nu-branch')?.value;
  if (!name || !username || !password || !confirmPassword || !role || !branchId) { showToast('All fields required', 'error'); return; }
  if (password.length < 6) { showToast('Password must be at least 6 characters.', 'error'); return; }
  if (password !== confirmPassword) { showToast('Passwords do not match.', 'error'); return; }
  if (s.users.find(u => u.username.toLowerCase() === username.toLowerCase())) { showToast('Username already exists', 'error'); return; }
  // Save staff account locally
  const newUser = {
    id: 'usr_' + Date.now(),
    name,
    username,
    password,
    role,
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
  DB.saveUser(newUser);
  closeModal();
  showToast('Staff account created!', 'success');
  renderUsers();
}

function editUserModal(uid) {
  if (!ensureAdminUserManagementAccess()) return;
  const s = getState();
  const u = s.users.find(x => x.id === uid);
  if (!u || u.role === 'admin') return;
  showModal(`<div class="modal-header"><h2>Edit User — ${u.name}</h2><button class="btn-close-modal" onclick="closeModal()">✕</button></div>
    <div class="modal-body">
      <div class="form-group"><label>Full Name</label><input id="eu-name" class="form-control" value="${u.name}"></div>
      <div class="form-group"><label>Branch</label><div class="form-select-wrap"><select id="eu-branch" class="form-control">${s.branches.map(b => `<option value="${b.id}" ${b.id === u.branchId ? 'selected' : ''}>${b.name}</option>`).join('')}</select></div></div>
    </div>
    <div class="modal-footer"><button class="btn btn-outline" onclick="closeModal()">Cancel</button><button class="btn btn-maroon" onclick="confirmEditUser('${uid}')">Save</button></div>`);
}

function confirmEditUser(uid) {
  if (!ensureAdminUserManagementAccess()) return;
  const s = getState();
  const u = s.users.find(x => x.id === uid);
  if (!u || u.role === 'admin') return;
  u.name = document.getElementById('eu-name').value.trim();
  u.branchId = document.getElementById('eu-branch').value;
  recordAudit(s, {
    action: 'update_user',
    message: `Staff account updated: ${u.username}`,
    userId: s.currentUser?.id || null,
    branchId: u.branchId || null,
    details: { updatedUserId: u.id },
  });
  saveState(s);
  DB.updateUser(uid, { name: u.name, branchId: u.branchId });
  closeModal();
  showToast('User updated!', 'success');
  renderUsers();
}

function deleteUser(uid) {
  if (!ensureAdminUserManagementAccess()) return;
  const s = getState();
  const userToDelete = s.users.find(u => u.id === uid);
  if (!userToDelete || userToDelete.role === 'admin') return;
  if (!confirm('Delete this user?')) return;
  s.users = s.users.filter(u => u.id !== uid);
  recordAudit(s, {
    action: 'delete_user',
    message: `Staff account deleted: ${userToDelete.username}`,
    userId: s.currentUser?.id || null,
    branchId: userToDelete.branchId || null,
    details: { deletedUserId: uid },
  });
  saveState(s);
  showToast('User deleted.', 'warning');
  renderUsers();
}

function resetUserPasswordModal(uid) {
  if (!ensureAdminUserManagementAccess()) return;
  const s = getState();
  const u = s.users.find(x => x.id === uid);
  if (!u || u.role === 'admin') return;
  showModal(`<div class="modal-header"><h2>Reset Password — ${u.name}</h2><button class="btn-close-modal" onclick="closeModal()">✕</button></div>
    <div class="modal-body">
      <div class="form-group"><label>New Password</label><input id="rp-pass" type="password" class="form-control" placeholder="Enter new password"></div>
      <div class="form-group"><label>Confirm Password</label><input id="rp-pass-confirm" type="password" class="form-control" placeholder="Confirm new password"></div>
    </div>
    <div class="modal-footer"><button class="btn btn-outline" onclick="closeModal()">Cancel</button><button class="btn btn-maroon" onclick="confirmResetUserPassword('${uid}')">Reset Password</button></div>`);
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
        <div class="branch-ov-row"><span>Staff</span><strong>${s.users.filter(u => u.branchId === b.id && u.role === 'staff').length}</strong></div>
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
      <div class="form-group"><label>Branch Name</label><input id="nb-name" class="form-control" placeholder="e.g. East Branch"></div>
      <div class="form-group"><label>Address</label><input id="nb-addr" class="form-control" placeholder="Full address"></div>
      <div class="form-group"><label>Contact Number</label><input id="nb-contact" class="form-control" placeholder="e.g. 049-000-0000"></div>
    </div>
    <div class="modal-footer"><button class="btn btn-outline" onclick="closeModal()">Cancel</button><button class="btn btn-maroon" onclick="confirmAddBranch()">Add Branch</button></div>`);
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
      <div class="form-group"><label>Branch Name</label><input id="eb-name" class="form-control" value="${b.name}"></div>
      <div class="form-group"><label>Address</label><input id="eb-addr" class="form-control" value="${b.address}"></div>
      <div class="form-group"><label>Contact Number</label><input id="eb-contact" class="form-control" value="${b.contact}"></div>
    </div>
    <div class="modal-footer"><button class="btn btn-outline" onclick="closeModal()">Cancel</button><button class="btn btn-maroon" onclick="confirmEditBranch('${bid}')">Save</button></div>`);
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

  // ── Login form: Enter key triggers sign in ──
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
  bindOverviewClickFallback();

  // Restore session — check pos_currentUser first, then fall back to pos_state.currentUser
  let restoredUser = null;
  try {
    const raw = localStorage.getItem('pos_currentUser');
    if (raw) restoredUser = JSON.parse(raw);
  } catch { }

  // Second fallback: read from pos_state directly
  if (!restoredUser) {
    try {
      const raw = localStorage.getItem('pos_state');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.currentUser) restoredUser = parsed.currentUser;
      }
    } catch { }
  }

  if (restoredUser) {
    // Ensure role is always valid
    if (!restoredUser.role || !['admin','staff','print'].includes(restoredUser.role)) {
      restoredUser.role = restoredUser.username === 'admin' ? 'admin' : 'staff';
    }
    // Re-stamp into state and re-save pos_currentUser so it survives future reloads
    const s = getState();
    s.currentUser = restoredUser;
    saveState(s);
    localStorage.setItem('pos_currentUser', JSON.stringify(restoredUser));
    showApp();
  } else {
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
  const s = getState();
  const cfg = getSystemConfig();
  cfg.holidays.splice(idx, 1);
  s.systemConfig = cfg;
  saveState(s);
  DB.saveSystemConfig(cfg);
  showSystemConfigModal();
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
    <div class="modal-footer"><button class="btn btn-outline" onclick="window.print()">${iconSvg('printer')} Print</button><button class="btn btn-maroon" onclick="closeModal()">Close</button></div>`, 'modal-lg');
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
    <div class="modal-footer"><button class="btn btn-outline" onclick="window.print()">${iconSvg('printer')} Print</button><button class="btn btn-maroon" onclick="closeModal()">Close</button></div>`, 'modal-lg');
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
    <div class="modal-footer"><button class="btn btn-outline" onclick="window.print()">${iconSvg('printer')} Print</button><button class="btn btn-maroon" onclick="closeModal()">Close</button></div>`, 'modal-lg');
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
    <div class="modal-footer"><button class="btn btn-outline" onclick="window.print()">${iconSvg('printer')} Print</button><button class="btn btn-maroon" onclick="closeModal()">Close</button></div>`, 'modal-lg');
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

// PRODUCTION OVERSIGHT — Admin
function renderProductionOversight() {
  const _po = getState();
  if (!_po.currentUser || _po.currentUser.role !== 'admin') { accessDenied('Production Oversight'); return; }
  const orders = getOrders();
  const cfg = getSystemConfig();
  const now = new Date();

  const production = orders.filter(o => o.status === 'production' || o.status === 'pending');
  const delayed = production.filter(o => o.due_date && new Date(o.due_date) < now && o.status !== 'completed');
  const pending = orders.filter(o => o.status === 'pending');
  const inProd = orders.filter(o => o.status === 'production');
  const dispatched = orders.filter(o => o.status === 'dispatch');
  const completed = orders.filter(o => o.status === 'completed');

  document.getElementById('page-content').innerHTML = `
    <div class="page-header" style="display:flex;justify-content:space-between;align-items:flex-start">
      <div><h1 class="page-title">Production Oversight</h1><p class="page-subtitle">Monitor all orders across production stages</p></div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-outline" onclick="showOnTimePerformanceModal()">On-Time Report</button>
        <button class="btn btn-outline" onclick="navigateTo('orders')">Manage Orders</button>
      </div>
    </div>
    ${delayed.length ? `<div class="alert alert-error-box">${iconSvg('warning')} ${delayed.length} order(s) are past their due date! <button class="btn btn-sm btn-danger" style="margin-left:12px" onclick="scrollToDelayed()">View Delayed</button></div>` : ''}
    <div class="kpi-grid" style="grid-template-columns:repeat(5,1fr)">
      <div class="kpi-card"><div class="kpi-header"><div class="kpi-label">Pending</div><div class="kpi-icon gold">${iconSvg('clock')}</div></div><div class="kpi-value">${pending.length}</div></div>
      <div class="kpi-card"><div class="kpi-header"><div class="kpi-label">In Production</div><div class="kpi-icon maroon">${iconSvg('printer')}</div></div><div class="kpi-value">${inProd.length}</div></div>
      <div class="kpi-card"><div class="kpi-header"><div class="kpi-label">Dispatched</div><div class="kpi-icon blue">${iconSvg('truck')}</div></div><div class="kpi-value">${dispatched.length}</div></div>
      <div class="kpi-card"><div class="kpi-header"><div class="kpi-label">Delayed</div><div class="kpi-icon maroon">${iconSvg('warning')}</div></div><div class="kpi-value" style="color:var(--danger)">${delayed.length}</div></div>
      <div class="kpi-card"><div class="kpi-header"><div class="kpi-label">Completed</div><div class="kpi-icon green">${iconSvg('check')}</div></div><div class="kpi-value">${completed.length}</div></div>
    </div>
    <div class="data-card" id="delayed-section">
      <div class="data-card-header"><span class="data-card-title" style="color:var(--danger)">${iconSvg('warning')} Delayed Orders</span><span class="badge badge-danger">${delayed.length}</span></div>
      <div class="data-card-body no-pad">
        <table class="data-table">
          <thead><tr><th>Order #</th><th>Customer</th><th>Status</th><th>Due Date</th><th>Days Late</th><th>Actions</th></tr></thead>
          <tbody>${delayed.length ? delayed.map(o => {
    const daysLate = Math.floor((now - new Date(o.due_date)) / 86400000);
    return `<tr style="background:var(--danger-l)">
              <td class="td-mono">${String(o.id).padStart(6, '0')}</td>
              <td>${o.customer_name || '—'}</td>
              <td>${statusBadge(o.status)}</td>
              <td class="td-mono">${o.due_date}</td>
              <td style="color:var(--danger);font-weight:700">${daysLate} day${daysLate !== 1 ? 's' : ''}</td>
              <td><button class="btn btn-sm btn-outline" onclick="editOrderModal('${o.id}')">Adjust Date</button></td>
            </tr>`;
  }).join('') : '<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--ink-60)">No delayed orders.</td></tr>'}</tbody>
        </table>
      </div>
    </div>
    <div class="data-card">
      <div class="data-card-header"><span class="data-card-title">Production Queue — All Orders</span></div>
      <div class="data-card-body no-pad">
        <table class="data-table">
          <thead><tr><th>Order #</th><th>Customer</th><th>Product</th><th>Qty</th><th>Status</th><th>Lead Time</th><th>Due</th><th>Priority</th><th>Actions</th></tr></thead>
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
              <td style="display:flex;gap:4px">
                ${o.status === 'pending' ? `<button class="btn btn-sm btn-maroon" onclick="fulfillOrder('${o.id}')">Start Prod.</button>` : ''}
                ${o.status === 'production' ? `<button class="btn btn-sm btn-maroon" onclick="dispatchOrder('${o.id}')">Dispatch</button>` : ''}
                <button class="btn btn-sm btn-outline" onclick="editOrderModal('${o.id}')">Edit</button>
              </td>
            </tr>`;
  }).join('') || '<tr><td colspan="9" style="text-align:center;padding:24px">No orders.</td></tr>'}</tbody>
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
  const ready = branchOrders.filter(o => o.status === 'dispatch');
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
  o.status = 'completed';
  o.delivery_date = deliveryDate;
  o.received_by = receiver;
  if (notes) o.delivery_notes = notes;
  const s = getState();
  recordAudit(s, { action: 'order_delivered', message: `Order #${orderId} marked as delivered`, meta: { deliveryDate, receiver } });
  saveState(s);
  saveOrders(orders);
  DB.updateOrder(orderId, { status: 'completed', delivery_date: o.delivery_date, received_by: o.received_by });
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
  const dispatched = orders.filter(o => o.status === 'dispatch');
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
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
      <div class="print-card" onclick="navigateTo('print-orders')"><div class="print-card-icon">${iconSvg('clipboard')}</div><div class="print-card-info"><strong>My Production Queue</strong><span>${pending.length + inProd.length} orders to process</span></div><div class="print-card-action"><span class="badge badge-maroon">→</span></div></div>
      <div class="print-card" onclick="navigateTo('print-qc')"><div class="print-card-icon">${iconSvg('check')}</div><div class="print-card-info"><strong>Quality Control</strong><span>Inspect and approve orders</span></div><div class="print-card-action"><span class="badge badge-maroon">→</span></div></div>
      <div class="print-card" onclick="navigateTo('print-materials')"><div class="print-card-icon">${iconSvg('box')}</div><div class="print-card-info"><strong>Materials Tracking</strong><span>Check stock and record usage</span></div><div class="print-card-action"><span class="badge badge-maroon">→</span></div></div>
      <div class="print-card" onclick="navigateTo('reports')"><div class="print-card-icon">${iconSvg('chart')}</div><div class="print-card-info"><strong>My Reports</strong><span>Daily production summary</span></div><div class="print-card-action"><span class="badge badge-maroon">→</span></div></div>
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
              <td>${statusBadge(o.status)}</td>
              <td>${dpVerified ? '<span class="badge badge-success">Verified</span>' : '<span class="badge badge-danger">Not Paid</span>'}</td>
              <td>${o.status === 'pending' && dpVerified ? `<button class="btn btn-sm btn-maroon" onclick="acceptOrderForProduction('${o.id}')">Accept</button>` : o.status === 'production' ? `<button class="btn btn-sm btn-outline" onclick="updateOrderStatus('${o.id}','dispatch')">Complete</button>` : '<span class="text-muted text-xs">Awaiting DP</span>'}</td>
            </tr>`;
  }).join('') || '<tr><td colspan="8" style="text-align:center;padding:24px;color:var(--ink-60)">No pending or in-production orders.</td></tr>'}</tbody>
        </table>
      </div>
    </div>`;
}

function renderPrintOrders() {
  const _pr = getState();
  if (_pr.currentUser && _pr.currentUser.role === 'staff') { accessDenied('Production Queue'); return; }
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
      <td>${statusBadge(o.status)}</td>
      <td style="display:flex;gap:4px;flex-wrap:wrap">
        ${o.status === 'pending' ? `<button class="btn btn-sm btn-maroon" onclick="acceptOrderForProduction('${o.id}')" ${!dpVerified ? 'disabled title="Downpayment not verified"' : ''}>Accept</button>` : ''}
        ${o.status === 'production' ? `<button class="btn btn-sm btn-outline" onclick="navigateTo('print-qc')">QC</button><button class="btn btn-sm btn-maroon" onclick="updateOrderStatus('${o.id}','dispatch')">Dispatch</button>` : ''}
        <button class="btn btn-sm btn-outline" onclick="viewOrderDetails('${o.id}')">Details</button>
        ${o.status === 'production' ? `<button class="btn btn-sm btn-outline" onclick="reportDelayModal('${o.id}')">Report Delay</button>` : ''}
      </td>
    </tr>`;
  }).join('');
}

function filterPrintOrders(status) {
  const orders = getOrders().filter(o => o.status === status);
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
    <div class="modal-footer"><button class="btn btn-outline" onclick="window.print()">${iconSvg('printer')} Print</button><button class="btn btn-maroon" onclick="closeModal()">Close</button></div>`, 'modal-lg');
}

function updateOrderStatus(orderId, newStatus) {
  const orders = getOrders();
  const o = orders.find(x => String(x.id) === String(orderId));
  if (!o) return;
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
  if (_qc.currentUser && _qc.currentUser.role === 'staff') { accessDenied('Quality Control'); return; }
  const orders = getOrders();
  const inProd = orders.filter(o => o.status === 'production');
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
  o.qc_status = 'passed';
  o.qc_passed_at = new Date().toISOString();
  const s = getState();
  recordAudit(s, { action: 'qc_passed', message: `QC passed for Order #${orderId}` });
  saveState(s);
  saveOrders(orders);
  DB.updateOrder(orderId, { qc_status: 'passed', qc_passed_at: o.qc_passed_at });
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
  o.qc_status = 'failed';
  o.qc_fail_reason = reason;
  const s = getState();
  recordAudit(s, { action: 'qc_failed', message: `QC failed for Order #${orderId}: ${reason}`, meta: { reason } });
  saveState(s);
  saveOrders(orders);
  DB.updateOrder(orderId, { qc_status: 'failed', qc_fail_reason: reason });
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
  if (s.currentUser && s.currentUser.role === 'staff') { accessDenied('Printing Inventory'); return; }

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
        ? new Date(v.lastCountDate).toLocaleDateString('en-PH', { year:'numeric', month:'short', day:'numeric' })
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
      <div class="alert alert-info">Current stock: <strong>${v.stock} units</strong>${v.lastCountDate ? ' · Last count: ' + new Date(v.lastCountDate).toLocaleDateString('en-PH', {year:'numeric',month:'short',day:'numeric'}) : ''}</div>
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
function renderStaffReports() {
  const s = getState();
  const u = s.currentUser;
  // Print personnel should use their own production reports page
  if (u && u.role === 'print') { navigateTo('reports'); return; }
  const now = new Date();
  const todayStr = now.toDateString();
  const weekStart = getMonday(now);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const mySales = u.role === 'admin' ? s.sales : s.sales.filter(x => x.userId === u.id);
  const dailySales = mySales.filter(x => !x.voided && new Date(x.createdAt).toDateString() === todayStr);
  const weeklySales = mySales.filter(x => !x.voided && new Date(x.createdAt) >= weekStart);
  const monthlySales = mySales.filter(x => !x.voided && new Date(x.createdAt) >= monthStart);

  const dailyRev = dailySales.reduce((a, b) => a + b.total, 0);
  const weeklyRev = weeklySales.reduce((a, b) => a + b.total, 0);
  const monthlyRev = monthlySales.reduce((a, b) => a + b.total, 0);

  const orders = getOrders();
  const myOrders = u.role === 'admin' ? orders : orders.filter(o => o.branch_staff?.toLowerCase().includes(u.name?.toLowerCase()));
  const balanceDue = myOrders.filter(o => (o.balance || 0) > 0 && o.status !== 'cancelled').reduce((a, b) => a + (b.balance || 0), 0);
  const discountTotal = mySales.filter(x => !x.voided && x.discountAmount > 0).reduce((a, b) => a + b.discountAmount, 0);

  document.getElementById('page-content').innerHTML = `
    <div class="page-header">
      <h1 class="page-title">My Reports</h1>
      <p class="page-subtitle">${u.role === 'admin' ? 'All branches' : 'Your personal performance'}</p>
    </div>
    <div class="kpi-grid">
      <div class="kpi-card"><div class="kpi-header"><div class="kpi-label">Today's Revenue</div><div class="kpi-icon gold">${iconSvg('money')}</div></div><div class="kpi-value">₱${fmt(dailyRev)}</div><div style="font-size:12px;color:var(--ink-60);margin-top:4px">${dailySales.length} transactions</div></div>
      <div class="kpi-card"><div class="kpi-header"><div class="kpi-label">This Week</div><div class="kpi-icon green">${iconSvg('calendar')}</div></div><div class="kpi-value">₱${fmt(weeklyRev)}</div><div style="font-size:12px;color:var(--ink-60);margin-top:4px">${weeklySales.length} transactions</div></div>
      <div class="kpi-card"><div class="kpi-header"><div class="kpi-label">This Month</div><div class="kpi-icon maroon">${iconSvg('chart')}</div></div><div class="kpi-value">₱${fmt(monthlyRev)}</div><div style="font-size:12px;color:var(--ink-60);margin-top:4px">${monthlySales.length} transactions</div></div>
      <div class="kpi-card"><div class="kpi-header"><div class="kpi-label">Balance Due</div><div class="kpi-icon maroon">${iconSvg('receipt')}</div></div><div class="kpi-value" style="color:var(--danger)">₱${fmt(balanceDue)}</div></div>
      <div class="kpi-card"><div class="kpi-header"><div class="kpi-label">Discounts Given</div><div class="kpi-icon gold">${iconSvg('money')}</div></div><div class="kpi-value" style="color:var(--warning)">₱${fmt(discountTotal)}</div></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
      <div class="data-card">
        <div class="data-card-header"><span class="data-card-title">Payment Collection</span></div>
        <div class="data-card-body no-pad">
          <table class="data-table">
            <thead><tr><th>Period</th><th>Cash</th><th>GCash</th><th>Credit</th><th>Total</th></tr></thead>
            <tbody>
              ${[['Today', dailySales], ['This Week', weeklySales], ['This Month', monthlySales]].map(([period, sales]) => {
    const cash = sales.reduce((a, b) => a + (b.payments?.find(p => p.method === 'cash')?.amount || 0), 0);
    const gcash = sales.reduce((a, b) => a + (b.payments?.find(p => p.method === 'gcash')?.amount || 0), 0);
    const credit = sales.reduce((a, b) => a + (b.payments?.find(p => p.method === 'credit')?.amount || 0), 0);
    return `<tr><td><strong>${period}</strong></td><td class="td-mono">₱${fmt(cash)}</td><td class="td-mono">₱${fmt(gcash)}</td><td class="td-mono">₱${fmt(credit)}</td><td class="td-mono" style="font-weight:700">₱${fmt(cash + gcash + credit)}</td></tr>`;
  }).join('')}
            </tbody>
          </table>
        </div>
      </div>
      <div class="data-card">
        <div class="data-card-header"><span class="data-card-title">Performance Summary</span></div>
        <div class="data-card-body">
          ${[['Today', dailySales, dailyRev], ['This Week', weeklySales, weeklyRev], ['This Month', monthlySales, monthlyRev]].map(([period, sales, rev]) => {
    const avgTxn = sales.length ? rev / sales.length : 0;
    return `<div style="padding:10px 0;border-bottom:1px solid var(--ink-10)">
              <div style="display:flex;justify-content:space-between;margin-bottom:4px"><strong style="font-size:13px">${period}</strong><span class="td-mono" style="color:var(--maroon);font-weight:700">₱${fmt(rev)}</span></div>
              <div class="text-xs text-muted">${sales.length} txns · Avg ₱${fmt(avgTxn)} per txn</div>
            </div>`;
  }).join('')}
        </div>
      </div>
    </div>
    <div class="data-card">
      <div class="data-card-header"><span class="data-card-title">Today's Transactions</span></div>
      <div class="data-card-body no-pad">
        <table class="data-table">
          <thead><tr><th>Receipt #</th><th>Customer</th><th>Items</th><th>Subtotal</th><th>Discount</th><th>Total</th><th>Payment</th><th>Time</th></tr></thead>
          <tbody>${dailySales.length ? [...dailySales].reverse().map(sale => {
    const payLabel = sale.payments.map(p => `${p.method === 'cash' ? 'Cash' : 'GCash'}: ₱${fmt(p.amount)}`).join(' + ');
    return `<tr>
              <td class="td-mono">${sale.id.slice(-6).toUpperCase()}</td>
              <td>${sale.customerId ? (s.customers.find(c => c.id === sale.customerId)?.companyName || '—') : 'Walk-in'}</td>
              <td>${sale.items.length}</td>
              <td class="td-mono">₱${fmt(sale.subtotal)}</td>
              <td class="td-mono" style="color:var(--danger)">${sale.discountAmount > 0 ? '-₱' + fmt(sale.discountAmount) : '—'}</td>
              <td class="td-mono" style="font-weight:700;color:var(--maroon)">₱${fmt(sale.total)}</td>
              <td class="text-xs">${payLabel}</td>
              <td class="td-mono">${fmtTime(sale.createdAt)}</td>
            </tr>`;
  }).join('') : '<tr><td colspan="8" style="text-align:center;padding:24px;color:var(--ink-60)">No transactions today.</td></tr>'}</tbody>
        </table>
      </div>
    </div>`;
}

// ADMIN DASHBOARD ENHANCEMENTS
function renderAdminProductionQueue() {
  const orders = getOrders();
  const pending = orders.filter(o => o.status === 'pending').length;
  const inProd = orders.filter(o => o.status === 'production').length;
  const dispatch = orders.filter(o => o.status === 'dispatch').length;
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
            <div style="width:52px;height:52px;border-radius:50%;background:var(--maroon);display:flex;align-items:center;justify-content:center;color:#fff;font-size:22px;font-weight:700;flex-shrink:0;">${(me.name||me.username||'?')[0].toUpperCase()}</div>
            <div><div style="font-size:16px;font-weight:700;">${me.name||me.username}</div><div style="font-size:12px;color:var(--ink-60);">Printing Personnel · @${me.username}</div></div>
          </div>
          <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--ink-10)"><span style="color:var(--ink-60);font-size:13px;">Status</span>${myShift?'<span class="badge badge-success">● On Shift</span>':'<span class="badge badge-neutral">Off Shift</span>'}</div>
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
              const dur = closed ? (Math.round((closed-opened)/360000)/10)+'h' : '—';
              return `<tr>
                <td>${opened.toLocaleDateString('en-PH',{month:'short',day:'numeric',year:'numeric'})}</td>
                <td class="td-mono">${opened.toLocaleTimeString('en-PH',{hour:'2-digit',minute:'2-digit'})}</td>
                <td class="td-mono">${closed?closed.toLocaleTimeString('en-PH',{hour:'2-digit',minute:'2-digit'}):'—'}</td>
                <td class="td-mono">${dur}</td>
                <td>${sh.status==='open'?'<span class="badge badge-success">Open</span>':'<span class="badge badge-neutral">Closed</span>'}</td>
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
              <td class="xs">${new Date(l.filedAt||l.createdAt||Date.now()).toLocaleDateString('en-PH',{month:'short',day:'numeric'})}</td>
              <td>${l.type||'Leave'}</td>
              <td>${l.date||'—'}</td>
              <td>${l.status==='approved'?'<span class="badge badge-success">Approved</span>':l.status==='rejected'?'<span class="badge badge-danger">Rejected</span>':'<span class="badge badge-warning">Pending</span>'}</td>
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
              <td class="xs">${new Date(tc.uploadedAt).toLocaleDateString('en-PH',{month:'short',day:'numeric',year:'numeric'})}</td>
              <td class="truncate" style="max-width:140px;" title="${tc.fileName||''}">${tc.fileName||'—'}</td>
              <td class="xs">${tc.period||'—'}</td>
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
        <div class="form-group"><label>Date of Leave</label><input id="leave-date" type="date" class="form-control" value="${new Date().toISOString().slice(0,10)}"></div>
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
  s.leaveRequests.push({ id: 'leave_'+Date.now(), userId: me.id, type, date, reason, status: 'pending', filedAt: new Date().toISOString() });
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
  reader.onload = function(e) { document.getElementById('tc-data').value = e.target.result; };
  reader.readAsDataURL(file);
}

function printPersonnelSaveTimecard() {
  const me = getState().currentUser;
  const fname = document.getElementById('tc-fname').value;
  if (!fname) { showToast('Please select a file.', 'error'); return; }
  const key = 'timecard_' + me.id;
  const tcs = JSON.parse(localStorage.getItem(key) || '[]');
  tcs.push({ id: 'tc_'+Date.now(), fileName: fname, period: document.getElementById('tc-period').value.trim(), fileData: document.getElementById('tc-data').value, uploadedAt: new Date().toISOString() });
  localStorage.setItem(key, JSON.stringify(tcs));
  closeModal(); showToast('Timecard uploaded!', 'success'); renderPrintPersonnel();
}

// ── PRINT PERSONNEL: My Payslip ───────────────────────────────────────────────
function renderPrintPayslip() {
  const s = getState();
  const me = s.currentUser;
  if (!me || me.role !== 'print') { accessDenied('Payroll'); return; }

  const DAILY_RATE = me.dailyRate || 400;
  const now = new Date();
  const empNum = me.employeeNumber || ('BPS-' + String(me.id||'001').replace(/\D/g,'').padStart(3,'0'));
  const COMPANY = {
    name: 'SOUTH PAFPS PACKAGING SUPPLIES',
    address1: 'Unit F&G FACL Commercial Building, Pasong Buaya 2 Road',
    address2: 'Pasong Buaya 2, Imus, Cavite',
    tel: 'Tel: (046) 436-9414',
  };

  // Build 3 months of data for history
  const months = [0, 1, 2].map(offset => {
    const d = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
    const shifts = s.shifts.filter(x =>
      x.userId === me.id && x.status !== 'open' &&
      new Date(x.openedAt) >= d && new Date(x.openedAt) <= monthEnd
    );
    const basicPay = shifts.length * DAILY_RATE;
    const gross    = basicPay;
    const sss      = Math.round(gross * 0.045);
    const phil     = Math.round(gross * 0.02);
    const hdmf     = Math.min(Math.round(gross * 0.02), 100);
    const ded      = sss + phil + hdmf;
    const net      = Math.max(0, gross - ded);
    // Pay period label: 1st–15th / 16th–end
    const pLabel   = d.toLocaleDateString('en-PH',{month:'long',year:'numeric'});
    const payDate  = new Date(d.getFullYear(), d.getMonth() + 1, 15)
                      .toLocaleDateString('en-PH',{month:'long',day:'numeric',year:'numeric'});
    return { label: pLabel, payDate, days: shifts.length, basicPay, gross, sss, phil, hdmf, ded, net, isCurrent: offset===0 };
  });

  const cur = months[0];
  // Format pay period like sample: "Month 1 - 28, Year"
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1)
    .toLocaleDateString('en-PH',{month:'long',day:'numeric',year:'numeric'});
  const periodEnd = new Date(now.getFullYear(), now.getMonth()+1, 0)
    .toLocaleDateString('en-PH',{day:'numeric',year:'numeric'});
  const periodLabel = periodStart + ' - ' + periodEnd;

  document.getElementById('page-content').innerHTML = `
    <div class="page-header" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px">
      <div><h1 class="page-title">My Payslip</h1><p class="page-subtitle">${me.name} · Printing Personnel</p></div>
      <button class="btn btn-maroon" onclick="window.print()">${iconSvg('printer')} Print</button>
    </div>

    <!-- PAYSLIP DOCUMENT -->
    <div class="data-card" id="payslip-document" style="margin-bottom:24px;max-width:860px;">
      <div class="data-card-body" style="padding:32px 40px;font-family:'Arial',sans-serif;font-size:12px;color:#111;">

        <!-- Header -->
        <div style="display:flex;align-items:flex-start;gap:24px;margin-bottom:16px;">
          <div style="flex-shrink:0;width:100px;">
            <img src="logo.png" alt="South Pafps" style="width:100px;height:auto;display:block;" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
            <div style="display:none;width:100px;height:76px;background:var(--maroon);border-radius:8px;align-items:center;justify-content:center;color:#fff;font-size:9px;font-weight:700;text-align:center;padding:8px;box-sizing:border-box;">SOUTH<br>PAFPS<br><span style="font-size:7px;opacity:.8">PACKAGING SUPPLIES</span></div>
          </div>
          <div style="flex:1;">
            <div style="font-weight:700;font-size:13px;margin-bottom:4px;">${COMPANY.name}</div>
            <div style="font-size:11px;line-height:1.7;color:#333;">${COMPANY.address1}<br>${COMPANY.address2}<br>${COMPANY.tel}</div>
          </div>
        </div>

        <!-- Title -->
        <div style="text-align:center;font-weight:700;font-size:13px;letter-spacing:3px;margin:0 0 14px;">PAYSLIP</div>

        <!-- Employee Info -->
        <table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:0;">
          <colgroup><col style="width:22%"><col style="width:28%"><col style="width:22%"><col style="width:28%"></colgroup>
          <tbody>
            <tr>
              <td style="padding:4px 8px;border:1px solid #999;"><strong>Employee Name:</strong></td>
              <td style="padding:4px 8px;border:1px solid #999;">${me.name||'—'}</td>
              <td style="padding:4px 8px;border:1px solid #999;"><strong>SSS Number:</strong></td>
              <td style="padding:4px 8px;border:1px solid #999;">${me.sssNumber||''}</td>
            </tr>
            <tr>
              <td style="padding:4px 8px;border:1px solid #999;"><strong>Employee Number:</strong></td>
              <td style="padding:4px 8px;border:1px solid #999;">${empNum}</td>
              <td style="padding:4px 8px;border:1px solid #999;"><strong>Philhealth Number:</strong></td>
              <td style="padding:4px 8px;border:1px solid #999;">${me.philhealthNumber||''}</td>
            </tr>
            <tr>
              <td style="padding:4px 8px;border:1px solid #999;"><strong>Position:</strong></td>
              <td style="padding:4px 8px;border:1px solid #999;">Printing Personnel</td>
              <td style="padding:4px 8px;border:1px solid #999;"><strong>HDMF Number:</strong></td>
              <td style="padding:4px 8px;border:1px solid #999;">${me.hdmfNumber||''}</td>
            </tr>
            <tr>
              <td style="padding:4px 8px;border:1px solid #999;"><strong>Pay Period:</strong></td>
              <td style="padding:4px 8px;border:1px solid #999;">${periodLabel}</td>
              <td style="padding:4px 8px;border:1px solid #999;"><strong>TIN Number:</strong></td>
              <td style="padding:4px 8px;border:1px solid #999;">${me.tinNumber||''}</td>
            </tr>
            <tr>
              <td style="padding:4px 8px;border:1px solid #999;"><strong>Pay Date:</strong></td>
              <td style="padding:4px 8px;border:1px solid #999;">${cur.payDate}</td>
              <td style="padding:4px 8px;border:1px solid #999;"></td>
              <td style="padding:4px 8px;border:1px solid #999;"></td>
            </tr>
          </tbody>
        </table>

        <!-- Earnings / Deductions -->
        <table style="width:100%;border-collapse:collapse;font-size:12px;margin-top:-1px;">
          <colgroup>
            <col style="width:34%"><col style="width:10%"><col style="width:14%">
            <col style="width:3px">
            <col style="width:auto"><col style="width:14%">
          </colgroup>
          <thead>
            <tr>
              <th colspan="3" style="border:1px solid #999;padding:6px 8px;text-align:left;background:#e8e8e8;font-weight:700;">EARNINGS/INCOME</th>
              <td style="background:#333;width:3px;padding:0;"></td>
              <th colspan="2" style="border:1px solid #999;padding:6px 8px;text-align:left;background:#e8e8e8;font-weight:700;">DEDUCTIONS</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="border-left:1px solid #999;padding:5px 8px;">Basic Pay @ ₱${fmt(DAILY_RATE)}/day</td>
              <td style="border-left:1px solid #ddd;padding:5px 8px;text-align:right;">${cur.days}</td>
              <td style="border-left:1px solid #ddd;border-right:1px solid #999;padding:5px 8px;text-align:right;">₱${fmt(cur.basicPay)}</td>
              <td style="background:#333;width:3px;padding:0;"></td>
              <td style="border-left:1px solid #999;padding:5px 8px;">SSS EE Contribution</td>
              <td style="border-right:1px solid #999;padding:5px 8px;text-align:right;">${cur.sss>0?'₱'+fmt(cur.sss):''}</td>
            </tr>
            <tr>
              <td style="border-left:1px solid #999;padding:5px 8px;"></td>
              <td style="border-left:1px solid #ddd;padding:5px 8px;"></td>
              <td style="border-left:1px solid #ddd;border-right:1px solid #999;padding:5px 8px;"></td>
              <td style="background:#333;width:3px;padding:0;"></td>
              <td style="border-left:1px solid #999;padding:5px 8px;">NHIP EE Contribution</td>
              <td style="border-right:1px solid #999;padding:5px 8px;text-align:right;">${cur.phil>0?'₱'+fmt(cur.phil):''}</td>
            </tr>
            <tr>
              <td style="border-left:1px solid #999;padding:5px 8px;"></td>
              <td style="border-left:1px solid #ddd;padding:5px 8px;"></td>
              <td style="border-left:1px solid #ddd;border-right:1px solid #999;padding:5px 8px;"></td>
              <td style="background:#333;width:3px;padding:0;"></td>
              <td style="border-left:1px solid #999;padding:5px 8px;">HDMF Contribution</td>
              <td style="border-right:1px solid #999;padding:5px 8px;text-align:right;">${cur.hdmf>0?'₱'+fmt(cur.hdmf):''}</td>
            </tr>
            <tr style="height:22px;"><td style="border-left:1px solid #999;"></td><td style="border-left:1px solid #ddd;"></td><td style="border-left:1px solid #ddd;border-right:1px solid #999;"></td><td style="background:#333;padding:0;"></td><td style="border-left:1px solid #999;"></td><td style="border-right:1px solid #999;"></td></tr>
            <tr style="height:22px;"><td style="border-left:1px solid #999;"></td><td style="border-left:1px solid #ddd;"></td><td style="border-left:1px solid #ddd;border-right:1px solid #999;"></td><td style="background:#333;padding:0;"></td><td style="border-left:1px solid #999;"></td><td style="border-right:1px solid #999;"></td></tr>
          </tbody>
          <tfoot>
            <tr style="font-weight:700;background:#e8e8e8;">
              <td colspan="2" style="border:1px solid #999;padding:6px 8px;">GROSS PAY</td>
              <td style="border:1px solid #999;padding:6px 8px;text-align:right;">₱${fmt(cur.gross)}</td>
              <td style="background:#333;width:3px;padding:0;"></td>
              <td style="border:1px solid #999;padding:6px 8px;">TOTAL DEDUCTION</td>
              <td style="border:1px solid #999;padding:6px 8px;text-align:right;">₱${fmt(cur.ded)}</td>
            </tr>
            <tr style="font-weight:700;">
              <td colspan="3" style="border:1px solid #999;padding:6px 8px;background:#fff;"></td>
              <td style="background:#333;width:3px;padding:0;"></td>
              <td style="border:1px solid #999;padding:6px 8px;">NET PAY</td>
              <td style="border:1px solid #999;padding:6px 8px;text-align:right;color:var(--maroon);">₱${fmt(cur.net)}</td>
            </tr>
          </tfoot>
        </table>

        <div style="margin-top:28px;border-top:2px dashed #ccc;text-align:center;padding-top:4px;font-size:10px;color:#aaa;letter-spacing:2px;">
          · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · ·
        </div>
      </div>
    </div>

    <!-- History table -->
    <div class="data-card" style="max-width:860px;">
      <div class="data-card-header"><span class="data-card-title">Payslip History</span></div>
      <div class="data-card-body no-pad">
        <table class="data-table">
          <thead><tr><th>Period</th><th>Days Worked</th><th>Gross</th><th>Deductions</th><th>Net Pay</th></tr></thead>
          <tbody>${months.map(m => `<tr ${m.isCurrent?'style="background:var(--cream);"':''}>
            <td><strong>${m.label}</strong>${m.isCurrent?' <span class="badge badge-maroon" style="font-size:10px;">Current</span>':''}</td>
            <td>${m.days}</td>
            <td class="td-mono">₱${fmt(m.gross)}</td>
            <td class="td-mono" style="color:var(--danger);">– ₱${fmt(m.ded)}</td>
            <td class="td-mono" style="font-weight:700;color:var(--success);">₱${fmt(m.net)}</td>
          </tr>`).join('')}</tbody>
        </table>
      </div>
    </div>`;
}

function renderPrintReports() {
  const s = getState();
  const u = s.currentUser;
  const orders = getOrders();
  const today = new Date().toDateString();
  const todayCompleted = orders.filter(o => o.status === 'completed' && o.delivery_date && new Date(o.delivery_date).toDateString() === today);
  const inProd = orders.filter(o => o.status === 'production');
  const pending = orders.filter(o => o.status === 'pending');
  const qcPassed = orders.filter(o => o.qc_status === 'passed');
  const qcFailed = orders.filter(o => o.qc_status === 'failed');
  const materialsLog = s.materialsLog || [];

  document.getElementById('page-content').innerHTML = `
    <div class="page-header">
      <h1 class="page-title">Production Reports</h1>
      <p class="page-subtitle">Daily production and quality summary</p>
    </div>
    <div class="kpi-grid">
      <div class="kpi-card"><div class="kpi-header"><div class="kpi-label">Completed Today</div><div class="kpi-icon green">${iconSvg('check')}</div></div><div class="kpi-value">${todayCompleted.length}</div></div>
      <div class="kpi-card"><div class="kpi-header"><div class="kpi-label">In Production</div><div class="kpi-icon maroon">${iconSvg('printer')}</div></div><div class="kpi-value">${inProd.length}</div></div>
      <div class="kpi-card"><div class="kpi-header"><div class="kpi-label">QC Pass Rate</div><div class="kpi-icon gold">${iconSvg('check')}</div></div><div class="kpi-value">${(qcPassed.length + qcFailed.length) > 0 ? ((qcPassed.length / (qcPassed.length + qcFailed.length)) * 100).toFixed(0) + '%' : '—'}</div></div>
      <div class="kpi-card"><div class="kpi-header"><div class="kpi-label">Pending Orders</div><div class="kpi-icon gold">${iconSvg('clock')}</div></div><div class="kpi-value">${pending.length}</div></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
      <div class="data-card">
        <div class="data-card-header"><span class="data-card-title">Today's Completed</span></div>
        <div class="data-card-body no-pad">
          <table class="data-table">
            <thead><tr><th>Order #</th><th>Customer</th><th>Product</th><th>Qty</th></tr></thead>
            <tbody>${todayCompleted.length ? todayCompleted.map(o => `<tr>
              <td class="td-mono">${String(o.id).padStart(6, '0')}</td>
              <td>${o.customer_name || '—'}</td>
              <td>${o.product_type || o.product_category || '—'}</td>
              <td>${o.quantity || '—'}</td>
            </tr>`).join('') : '<tr><td colspan="4" style="text-align:center;padding:16px;color:var(--ink-60)">No orders completed today.</td></tr>'}</tbody>
          </table>
        </div>
      </div>
      <div class="data-card">
        <div class="data-card-header"><span class="data-card-title">Quality Summary</span></div>
        <div class="data-card-body">
          <div style="padding:10px 0;border-bottom:1px solid var(--ink-10);display:flex;justify-content:space-between"><span>QC Passed</span><strong style="color:var(--success)">${qcPassed.length}</strong></div>
          <div style="padding:10px 0;border-bottom:1px solid var(--ink-10);display:flex;justify-content:space-between"><span>QC Failed</span><strong style="color:var(--danger)">${qcFailed.length}</strong></div>
          <div style="padding:10px 0;display:flex;justify-content:space-between"><span>Pass Rate</span><strong>${(qcPassed.length + qcFailed.length) > 0 ? ((qcPassed.length / (qcPassed.length + qcFailed.length)) * 100).toFixed(1) + '%' : '—'}</strong></div>
        </div>
      </div>
    </div>
    <div class="data-card">
      <div class="data-card-header"><span class="data-card-title">Material Usage (Recent)</span></div>
      <div class="data-card-body no-pad">
        <table class="data-table">
          <thead><tr><th>Date</th><th>Order #</th><th>Material</th><th>Used</th><th>Waste</th></tr></thead>
          <tbody>${materialsLog.slice(-20).reverse().map(log => `<tr>
            <td class="td-mono">${fmtTime(log.createdAt)}</td>
            <td class="td-mono">${log.orderId ? String(log.orderId).padStart(6, '0') : '—'}</td>
            <td>${log.material}</td>
            <td>${log.used}</td>
            <td style="color:var(--warning)">${log.waste || 0}</td>
          </tr>`).join('') || '<tr><td colspan="5" style="text-align:center;padding:16px;color:var(--ink-60)">No material logs yet.</td></tr>'}</tbody>
        </table>
      </div>
    </div>`;
}

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
  const ref = document.getElementById('gcash-ref-input')?.value;
  if (ref) navigator.clipboard?.writeText(ref).then(() => showToast('Reference # copied.', 'success'));
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

