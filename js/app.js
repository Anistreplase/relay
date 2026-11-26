// =========================================
// RELAY PROTOTYPE - SHARED LOGIC
// =========================================

let pendingDeleteHouseholdId = null;
let pendingDeleteCallback = null;

document.addEventListener('DOMContentLoaded', () => {
  const currentPath = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.sidebar-nav a').forEach(link => {
    const href = link.getAttribute('href');
    if (
      href === currentPath ||
      (currentPath === 'user.html' && href === 'users.html') ||
      (currentPath === 'users.html' && href === 'user.html')
    ) {
      link.classList.add('active');
    }
  });

  removeDemoBadge();
  updateUserProfile();
  initNetworkListener();
  initNotifications();
  initGlobalSearch();
  ensureDeleteRecordModal();

  const sidebarLogo = document.querySelector('.sidebar-logo');
  if (sidebarLogo) {
    sidebarLogo.style.cursor = 'pointer';
    sidebarLogo.addEventListener('click', () => {
      window.location.href = 'dashboard.html';
    });
  }

  document.body.addEventListener('click', (e) => {
    if (e.target.closest('.btn-add-action')) {
      window.location.href = 'add-household.html';
    }

    const verifyBtn = e.target.closest('.btn-verify-action');
    if (verifyBtn) {
      const row = verifyBtn.closest('tr');
      if (row && row.hasAttribute('data-id')) {
        localStorage.setItem('selected_household', row.getAttribute('data-id'));
        window.location.href = 'review.html';
      }
    }

    if (e.target.closest('.btn-export-action')) {
      if (!navigator.onLine) {
        alert('You are currently offline. This action cannot be completed until you reconnect.');
      } else if (typeof showModal === 'function') {
        showModal('modal-export');
      } else {
        alert('Export started.');
      }
    }

    if (e.target.closest('.page-btn')) {
      alert('Page changed! (Simulated pagination)');
    }
  });

  document.addEventListener('click', (e) => {
    const dropdown = document.getElementById('notif-dropdown');
    if (dropdown && dropdown.style.display === 'block' && !e.target.closest('#notif-container')) {
      dropdown.style.display = 'none';
    }

    const searchWrap = document.getElementById('global-search-container');
    const searchResults = document.getElementById('global-search-results');
    if (searchResults && searchWrap && !searchWrap.contains(e.target)) {
      searchResults.style.display = 'none';
    }
  });
});

function removeDemoBadge() {
  document.querySelectorAll('.demo-badge').forEach(badge => badge.remove());
}

// =========================================
// WORKSPACE & RECORD HELPERS
// =========================================
function getActiveBarangayName() {
  const role = localStorage.getItem('relay-role') || 'Barangay Official';
  const workspace = localStorage.getItem('relay-workspace') || 'Barangay San Miguel';
  if (role === 'Admin' && workspace === 'City-Wide Administration') {
    return null;
  }
  return workspace.replace(/^Barangay\s+/i, '').trim();
}

function getAllActiveHouseholds(householdsObj) {
  const custom = JSON.parse(localStorage.getItem('custom_households')) || {};
  const deleted = JSON.parse(localStorage.getItem('deleted_households')) || {};
  return [
    ...Object.values(householdsObj || {}),
    ...Object.values(custom)
  ]
    .filter(hh => hh && hh.id && !deleted[hh.id])
    .map(hh => ({
      ...hh,
      barangay: hh.barangay || 'San Miguel'
    }));
}

function getScopedHouseholds(householdsObj) {
  const activeBarangay = getActiveBarangayName();
  const combined = getAllActiveHouseholds(householdsObj);
  if (!activeBarangay) {
    return combined;
  }
  return combined.filter(hh => String(hh.barangay || '').toLowerCase() === activeBarangay.toLowerCase());
}

function normalizeDupKeyPart(val) {
  return String(val || '')
    .toLowerCase()
    .replace(/\b(household|barangay|brgy\.?|purok)\b/gi, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

function findDuplicateHouseholds(targetHh) {
  if (!targetHh || !targetHh.id) return [];
  const pool = typeof households !== 'undefined'
    ? getAllActiveHouseholds(households)
    : getAllActiveHouseholds({});

  const targetHead = normalizeDupKeyPart(targetHh.head);
  const targetBrgy = normalizeDupKeyPart(targetHh.barangay);
  const targetPurok = normalizeDupKeyPart(targetHh.purok);
  const targetAddr = normalizeDupKeyPart(targetHh.address);

  return pool.filter(other => {
    if (!other || other.id === targetHh.id) return false;
    const otherHead = normalizeDupKeyPart(other.head);
    const otherBrgy = normalizeDupKeyPart(other.barangay);
    const otherPurok = normalizeDupKeyPart(other.purok);
    const otherAddr = normalizeDupKeyPart(other.address);

    if (!targetHead || otherHead !== targetHead) return false;
    const sameBrgy = !targetBrgy || !otherBrgy || otherBrgy === targetBrgy;
    const sameLocation =
      (targetAddr && otherAddr && otherAddr === targetAddr) ||
      (targetPurok && otherPurok && otherPurok === targetPurok);

    return sameBrgy && sameLocation;
  });
}

function canDeleteHouseholdRecord(hh) {
  const role = localStorage.getItem('relay-role') || 'Barangay Official';
  const workspace = localStorage.getItem('relay-workspace') || 'Barangay San Miguel';
  if (role === 'Admin') {
    return true;
  }
  const activeBarangay = getActiveBarangayName() || workspace.replace(/^Barangay\s+/i, '').trim();
  const recordBarangay = String((hh && hh.barangay) || 'San Miguel').replace(/^Barangay\s+/i, '').trim();
  return activeBarangay.toLowerCase() === recordBarangay.toLowerCase();
}

function ensureDeleteRecordModal() {
  if (document.getElementById('modal-delete-record')) return;

  const wrapper = document.createElement('div');
  wrapper.innerHTML = `
    <div id="modal-delete-record" class="modal-overlay">
      <div class="modal-box" style="max-width: 500px;">
        <div class="modal-eyebrow" id="modal-delete-eyebrow">Duplicate Check & Removal</div>
        <div class="modal-title" id="modal-delete-title">Delete household record?</div>
        <div id="modal-delete-dup-warning" style="display:none; background:#FEF3C7; border:1px solid #F59E0B; color:#92400E; padding:10px 12px; border-radius:6px; font-size:12px; margin-bottom:12px; line-height:1.45;"></div>
        <div class="modal-desc" id="modal-delete-record-desc">
          Remove this household record? This cannot be undone.
        </div>
        <div class="modal-footer">
          <div class="modal-footer-text">Action applies to your active workspace.</div>
          <div class="modal-actions">
            <button type="button" class="btn btn-secondary" onclick="cancelDeleteHouseholdModal()">Cancel</button>
            <button type="button" class="btn btn-primary" id="confirm-delete-record-btn" onclick="confirmDeleteHouseholdModal()">Delete record</button>
          </div>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(wrapper.firstElementChild);
}

function cancelDeleteHouseholdModal() {
  pendingDeleteHouseholdId = null;
  pendingDeleteCallback = null;
  hideModal('modal-delete-record');
}

function executeDeleteHouseholdRecord(hhId) {
  if (!hhId) return false;
  const custom = JSON.parse(localStorage.getItem('custom_households')) || {};

  if (custom[hhId]) {
    delete custom[hhId];
    localStorage.setItem('custom_households', JSON.stringify(custom));
  }

  const deleted = JSON.parse(localStorage.getItem('deleted_households')) || {};
  deleted[hhId] = Date.now();
  localStorage.setItem('deleted_households', JSON.stringify(deleted));
  localStorage.removeItem(`record_${hhId}`);

  if (localStorage.getItem('selected_household') === hhId) {
    localStorage.removeItem('selected_household');
  }

  sessionStorage.removeItem('notifs-read');

  if (!navigator.onLine) {
    const offlineQueue = JSON.parse(localStorage.getItem('offline_queue')) || [];
    offlineQueue.push({ id: hhId, action: 'delete', timestamp: Date.now() });
    localStorage.setItem('offline_queue', JSON.stringify(offlineQueue));
  }

  if (typeof generateNotifications === 'function') {
    generateNotifications();
  }

  return true;
}

function confirmDeleteHouseholdModal() {
  const idToDelete = pendingDeleteHouseholdId;
  const callback = pendingDeleteCallback;
  cancelDeleteHouseholdModal();

  if (!idToDelete) return;
  const deletedOk = executeDeleteHouseholdRecord(idToDelete);
  if (deletedOk && typeof callback === 'function') {
    callback(idToDelete);
  }
}

function deleteHouseholdRecord(hhId, onAfterDelete) {
  if (!hhId) return false;
  const custom = JSON.parse(localStorage.getItem('custom_households')) || {};
  const recordObj = custom[hhId] || (typeof households !== 'undefined' ? households[hhId] : null);

  if (!canDeleteHouseholdRecord(recordObj)) {
    alert('You can only delete household records within your assigned barangay workspace.');
    return false;
  }

  ensureDeleteRecordModal();
  pendingDeleteHouseholdId = hhId;
  pendingDeleteCallback = typeof onAfterDelete === 'function' ? onAfterDelete : null;

  const duplicates = recordObj ? findDuplicateHouseholds(recordObj) : [];
  const eyebrowEl = document.getElementById('modal-delete-eyebrow');
  const titleEl = document.getElementById('modal-delete-title');
  const warnEl = document.getElementById('modal-delete-dup-warning');
  const descEl = document.getElementById('modal-delete-record-desc');
  const headLabel = recordObj && recordObj.head ? `${recordObj.head} household (${hhId})` : hhId;

  if (duplicates.length > 0) {
    const dupSummary = duplicates
      .map(d => `${d.head || 'Household'} (${d.id} · ${d.purok || d.barangay || ''})`)
      .join(', ');
    if (eyebrowEl) eyebrowEl.textContent = 'Duplicate Record Warning';
    if (titleEl) titleEl.textContent = 'Potential duplicate detected';
    if (warnEl) {
      warnEl.style.display = 'block';
      warnEl.innerHTML = `<strong>Warning:</strong> Matching record(s) found: ${escapeSearchHtml(dupSummary)}. Confirm below to remove the duplicate entry.`;
    }
  } else {
    if (eyebrowEl) eyebrowEl.textContent = 'Duplicate Check & Removal';
    if (titleEl) titleEl.textContent = 'Delete household record?';
    if (warnEl) {
      warnEl.style.display = 'none';
      warnEl.innerHTML = '';
    }
  }

  if (descEl) {
    descEl.textContent = `Remove ${headLabel}? This action cannot be undone.`;
  }

  showModal('modal-delete-record');
  return true;
}

function resolveHouseholdBarangay(selectedBarangayValue) {
  const role = localStorage.getItem('relay-role') || 'Barangay Official';
  const workspace = localStorage.getItem('relay-workspace') || 'Barangay San Miguel';
  const isCityWideAdmin = role === 'Admin' && workspace === 'City-Wide Administration';

  if (isCityWideAdmin) {
    const chosen = String(selectedBarangayValue || '').trim();
    if (!chosen) {
      return { ok: false, error: 'Barangay is required for City-Wide Administration accounts.' };
    }
    return { ok: true, barangay: chosen.replace(/^Barangay\s+/i, '').trim() };
  }

  return {
    ok: true,
    barangay: workspace.replace(/^Barangay\s+/i, '').trim()
  };
}

// =========================================
// USER ACCOUNTS SEED & HELPER
// =========================================
const DEFAULT_RELAY_USERS = [
  {
    id: 'USR-01',
    name: 'M. Santos',
    email: 'official@sanmiguel.gov.ph',
    role: 'Barangay Official',
    workspace: 'Barangay San Miguel',
    barangay: 'San Miguel',
    purok: 'Purok 3',
    status: 'Active'
  },
  {
    id: 'USR-02',
    name: 'J. Reyes',
    email: 'purok3@sanmiguel.gov.ph',
    role: 'Purok Officer',
    workspace: 'Barangay San Miguel',
    barangay: 'San Miguel',
    purok: 'Purok 3',
    status: 'Active'
  },
  {
    id: 'USR-03',
    name: 'R. Mendoza',
    email: 'official@tibanga.gov.ph',
    role: 'Barangay Official',
    workspace: 'Barangay Tibanga',
    barangay: 'Tibanga',
    purok: 'Purok 2',
    status: 'Active'
  },
  {
    id: 'USR-04',
    name: 'T. Odicta',
    email: 'purok@tibanga.gov.ph',
    role: 'Purok Officer',
    workspace: 'Barangay Tibanga',
    barangay: 'Tibanga',
    purok: 'Purok 2',
    status: 'Active'
  },
  {
    id: 'USR-05',
    name: 'K. Lim',
    email: 'official@saray.gov.ph',
    role: 'Barangay Official',
    workspace: 'Barangay Saray',
    barangay: 'Saray',
    purok: 'Purok 4',
    status: 'Active'
  },
  {
    id: 'USR-06',
    name: 'E. Ramos',
    email: 'purok@saray.gov.ph',
    role: 'Purok Officer',
    workspace: 'Barangay Saray',
    barangay: 'Saray',
    purok: 'Purok 4',
    status: 'Active'
  }
];

function getRelayUsers() {
  const saved = JSON.parse(localStorage.getItem('relay_users'));
  if (!Array.isArray(saved) || saved.length === 0) {
    const fresh = DEFAULT_RELAY_USERS.map(u => ({ ...u }));
    localStorage.setItem('relay_users', JSON.stringify(fresh));
    return fresh;
  }

  const defaultById = Object.fromEntries(DEFAULT_RELAY_USERS.map(u => [u.id, u]));
  const merged = saved.map(u => {
    if (defaultById[u.id]) {
      const def = defaultById[u.id];
      return {
        ...def,
        ...u,
        workspace: u.workspace && u.workspace !== 'Barangay San Miguel' ? u.workspace : def.workspace,
        barangay: u.barangay && u.barangay !== 'San Miguel' ? u.barangay : def.barangay,
        purok: u.purok || def.purok
      };
    }
    return u;
  });

  localStorage.setItem('relay_users', JSON.stringify(merged));
  return merged;
}

// =========================================
// SMART LOGIN LOGIC
// =========================================
function inferWorkspaceFromEmail(emailStr) {
  const lower = String(emailStr || '').trim().toLowerCase();
  if (lower.includes('tibanga')) return 'Barangay Tibanga';
  if (lower.includes('saray')) return 'Barangay Saray';
  if (lower.includes('sanmiguel') || lower.includes('san miguel')) return 'Barangay San Miguel';
  return null;
}

function simulateLogin(event) {
  if (event && typeof event.preventDefault === 'function') {
    event.preventDefault();
  }
  const emailInput = document.getElementById('email');
  const email = (emailInput ? emailInput.value : '').trim().toLowerCase();
  if (!email) return;

  let assignedRole = 'Barangay Official';
  let assignedWorkspace = 'Barangay San Miguel';

  if (email.includes('admin') || email.includes('citydrrm')) {
    assignedRole = 'Admin';
    assignedWorkspace = 'City-Wide Administration';
  } else if (email.includes('purok')) {
    assignedRole = 'Purok Officer';
    assignedWorkspace = inferWorkspaceFromEmail(email) || 'Barangay San Miguel';
  } else {
    assignedRole = 'Barangay Official';
    assignedWorkspace = inferWorkspaceFromEmail(email) || 'Barangay San Miguel';
  }

  localStorage.setItem('relay-user', email);
  localStorage.setItem('relay-role', assignedRole);
  localStorage.setItem('relay-workspace', assignedWorkspace);

  window.location.href = assignedRole === 'Purok Officer' ? 'records.html' : 'dashboard.html';
}

// =========================================
// USER PROFILE & DYNAMIC SIDEBAR INJECTION
// =========================================
function updateUserProfile() {
  const savedRole = localStorage.getItem('relay-role') || 'Barangay Official';
  const savedUserEmail = (localStorage.getItem('relay-user') || '').trim().toLowerCase();
  let savedWorkspace = localStorage.getItem('relay-workspace') || 'Barangay San Miguel';

  const inferredFromUser = inferWorkspaceFromEmail(savedUserEmail);
  if (savedRole !== 'Admin' && inferredFromUser) {
    savedWorkspace = inferredFromUser;
    localStorage.setItem('relay-workspace', savedWorkspace);
  } else if (savedRole !== 'Admin' && savedWorkspace === 'City-Wide Administration') {
    savedWorkspace = 'Barangay San Miguel';
    localStorage.setItem('relay-workspace', savedWorkspace);
  }

  const nameEl = document.querySelector('.user-name');
  const roleEl = document.querySelector('.user-role');
  const workspaceSelector = document.getElementById('workspace-selector');

  let navUsers = document.getElementById('nav-users');
  const targetUserHref = document.querySelector('a[href="user.html"]') ? 'user.html' : 'users.html';
  if (!navUsers) {
    const footerNav = document.querySelector('.sidebar-footer .sidebar-nav');
    if (footerNav) {
      navUsers = document.createElement('a');
      navUsers.href = targetUserHref;
      navUsers.id = 'nav-users';
      navUsers.innerHTML = '<span class="nav-icon">👤</span> Manage Users';
      navUsers.style.display = 'none';

      const settingsLink = footerNav.querySelector('a[href="settings.html"]');
      if (settingsLink) {
        footerNav.insertBefore(navUsers, settingsLink);
      } else {
        footerNav.prepend(navUsers);
      }
    }
  }

  const setNav = (href, visible) => {
    const link = document.querySelector(`.sidebar-nav a[href="${href}"]`);
    if (link) link.style.display = visible ? 'flex' : 'none';
  };

  if (nameEl && roleEl) {
    if (savedRole === 'Admin') {
      nameEl.textContent = 'City DRRM Admin';
      roleEl.textContent = 'Full system access';

      if (workspaceSelector) {
        workspaceSelector.innerHTML = `
          <option value="City-Wide Administration">City-Wide Administration</option>
          <option value="Barangay San Miguel">Barangay San Miguel</option>
          <option value="Barangay Tibanga">Barangay Tibanga</option>
          <option value="Barangay Saray">Barangay Saray</option>
        `;
        workspaceSelector.value = savedWorkspace;
        workspaceSelector.disabled = false;
        workspaceSelector.style.cursor = 'pointer';
        workspaceSelector.onchange = (e) => {
          localStorage.setItem('relay-workspace', e.target.value);
          window.location.reload();
        };
      }

      setNav('dashboard.html', true);
      setNav('records.html', true);
      setNav('verify.html', true);
      setNav('preparedness.html', true);
      setNav('evacuation.html', true);
      setNav('revalidation.html', true);
      setNav('reports.html', true);

      if (navUsers) {
        navUsers.style.display = 'flex';
      }
    } else if (savedRole === 'Purok Officer') {
      const barangayShort = savedWorkspace.replace(/^Barangay\s+/i, '');
      nameEl.textContent = `${barangayShort} Purok Officer`;
      roleEl.textContent = 'Data collection & updates';

      if (workspaceSelector) {
        workspaceSelector.innerHTML = `<option value="${savedWorkspace}" selected>${savedWorkspace}</option>`;
        workspaceSelector.value = savedWorkspace;
        workspaceSelector.disabled = true;
        workspaceSelector.style.cursor = 'not-allowed';
      }

      setNav('dashboard.html', false);
      setNav('records.html', true);
      setNav('verify.html', false);
      setNav('preparedness.html', false);
      setNav('evacuation.html', false);
      setNav('revalidation.html', true);
      setNav('reports.html', false);

      if (navUsers) {
        navUsers.style.display = 'none';
      }
    } else {
      const barangayShort = savedWorkspace.replace(/^Barangay\s+/i, '');
      nameEl.textContent = `${barangayShort} Official`;
      roleEl.textContent = 'Review & coordination';

      if (workspaceSelector) {
        workspaceSelector.innerHTML = `<option value="${savedWorkspace}" selected>${savedWorkspace}</option>`;
        workspaceSelector.value = savedWorkspace;
        workspaceSelector.disabled = true;
        workspaceSelector.style.cursor = 'not-allowed';
      }

      setNav('dashboard.html', true);
      setNav('records.html', true);
      setNav('verify.html', true);
      setNav('preparedness.html', true);
      setNav('evacuation.html', true);
      setNav('revalidation.html', true);
      setNav('reports.html', true);

      if (navUsers) {
        navUsers.style.display = 'none';
      }
    }
  }
}

// =========================================
// TOPBAR SEARCH
// =========================================
function escapeSearchHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function initGlobalSearch() {
  const searchBar = document.querySelector('.topbar-left .search-bar');
  if (!searchBar) return;

  const currentPath = window.location.pathname.split('/').pop() || '';
  const isUserPage = currentPath === 'user.html' || currentPath === 'users.html';

  searchBar.id = 'global-search-container';
  searchBar.innerHTML = `
    <span>🔍</span>
    <input
      type="text"
      id="global-search-input"
      class="global-search-input"
      placeholder="${isUserPage ? 'Search users, emails, workspaces...' : 'Search households, puroks, records...'}"
      autocomplete="off"
    >
    <div id="global-search-results" class="global-search-results"></div>
  `;

  const input = document.getElementById('global-search-input');
  const resultsBox = document.getElementById('global-search-results');
  if (!input || !resultsBox) return;

  const runSearch = () => {
    const query = input.value.trim().toLowerCase();

    if (isUserPage && typeof loadUsers === 'function') {
      const pageUserSearch = document.getElementById('user-search');
      if (pageUserSearch) {
        pageUserSearch.value = input.value;
        loadUsers();
      }
    }

    if (!query) {
      resultsBox.style.display = 'none';
      resultsBox.innerHTML = '';
      return;
    }

    const scoped = typeof households !== 'undefined' ? getScopedHouseholds(households) : [];
    const matches = scoped.filter(hh => {
      const memberNames = Array.isArray(hh.members)
        ? hh.members.map(m => `${m.name || ''} ${m.category || ''} ${m.needs || ''}`).join(' ')
        : '';
      const haystack = `${hh.id || ''} ${hh.head || ''} ${hh.purok || ''} ${hh.barangay || ''} ${hh.address || ''} ${memberNames}`.toLowerCase();
      return haystack.includes(query);
    });

    if (matches.length === 0) {
      resultsBox.innerHTML = `<div class="global-search-item" style="cursor:default; color:var(--text-muted); font-size:12px;">No matching households found for "${escapeSearchHtml(input.value)}".</div>`;
      resultsBox.style.display = 'block';
      return;
    }

    resultsBox.innerHTML = matches.slice(0, 8).map(hh => {
      const status = localStorage.getItem(`record_${hh.id}`) || 'Unverified';
      return `
        <div class="global-search-item" data-hh-id="${escapeSearchHtml(hh.id)}">
          <div>
            <div style="font-size:13px; font-weight:600;">${escapeSearchHtml(hh.head)} household</div>
            <div style="font-size:11px; color:var(--text-muted);">${escapeSearchHtml(hh.id)} · ${escapeSearchHtml(hh.purok || '')}${hh.barangay ? ', ' + escapeSearchHtml(hh.barangay) : ''}</div>
          </div>
          <span class="pill pill-unverified" style="font-size:10px;">${escapeSearchHtml(status)}</span>
        </div>
      `;
    }).join('');

    resultsBox.style.display = 'block';
  };

  input.addEventListener('input', runSearch);
  input.addEventListener('focus', () => {
    if (input.value.trim()) runSearch();
  });

  resultsBox.addEventListener('click', (e) => {
    const item = e.target.closest('.global-search-item[data-hh-id]');
    if (!item) return;
    localStorage.setItem('selected_household', item.getAttribute('data-hh-id'));
    window.location.href = 'review.html';
  });
}

// =========================================
// NOTIFICATIONS
// =========================================
function initNotifications() {
  const topbarRight = document.querySelector('.topbar-right');
  if (!topbarRight) return;

  const bellHTML = `
    <div id="notif-container" style="position: relative; cursor: pointer;">
      <span id="notif-bell" style="font-size: 18px; position: relative;">🔔
        <span id="notif-badge" style="display: none; position: absolute; top: -2px; right: -2px; width: 8px; height: 8px; background: #EF4444; border-radius: 50%; border: 2px solid var(--white);"></span>
      </span>
      <div id="notif-dropdown" style="display: none; position: absolute; top: 30px; right: -10px; width: 320px; background: var(--white); border: 1px solid var(--border); border-radius: 8px; box-shadow: 0 10px 25px rgba(0,0,0,0.1); z-index: 1000; padding: 16px;">
        <h4 style="font-size: 14px; font-weight: 600; margin-bottom: 12px; display: flex; justify-content: space-between;">
          Notifications <span style="font-size: 11px; color: var(--maroon); cursor: pointer;" onclick="clearNotifications()">Mark all as read</span>
        </h4>
        <div id="notif-list" style="display: flex; flex-direction: column; gap: 12px;"></div>
      </div>
    </div>
  `;

  const bellElement = Array.from(topbarRight.children).find(el => el.textContent.includes('🔔'));
  if (bellElement) {
    bellElement.outerHTML = bellHTML;
  }

  const bell = document.getElementById('notif-bell');
  if (bell) {
    bell.addEventListener('click', (e) => {
      e.stopPropagation();
      const dropdown = document.getElementById('notif-dropdown');
      dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
    });
  }

  generateNotifications();
}

function generateNotifications() {
  const isRead = sessionStorage.getItem('notifs-read') === 'true';
  const scoped = typeof households !== 'undefined' ? getScopedHouseholds(households) : [];
  const pendingQueue = scoped.filter(hh => {
    const status = localStorage.getItem(`record_${hh.id}`) || 'Unverified';
    return status === 'Unverified' || status === 'Needs Correction';
  });
  const verified = scoped.filter(hh => (localStorage.getItem(`record_${hh.id}`) || 'Unverified') === 'Verified');
  const listEl = document.getElementById('notif-list');
  const badge = document.getElementById('notif-badge');

  if (!listEl) return;

  const items = [];

  if (pendingQueue.length > 0) {
    items.push(`
      <div style="background: #FFFDF5; border: 1px solid #FCD34D; padding: 12px; border-radius: 6px; cursor: pointer;" onclick="window.location.href='verify.html'">
        <div style="font-size: 13px; font-weight: 600; color: #92400E; margin-bottom: 4px;">Verification Queue Pending</div>
        <div style="font-size: 12px; color: #92400E;">${pendingQueue.length} ${pendingQueue.length === 1 ? 'record is' : 'records are'} waiting for review and validation.</div>
        <div style="font-size: 11px; color: #92400E; margin-top: 8px; text-decoration: underline;">Open verification queue →</div>
      </div>
    `);
  }

  if (verified.length > 0) {
    items.push(`
      <div style="background: #FEF3C7; border: 1px solid #FCD34D; padding: 12px; border-radius: 6px; cursor: pointer;" onclick="window.location.href='revalidation.html'">
        <div style="font-size: 13px; font-weight: 600; color: #92400E; margin-bottom: 4px;">Revalidation Due</div>
        <div style="font-size: 12px; color: #92400E;">${verified.length} verified ${verified.length === 1 ? 'household is' : 'households are'} due for review.</div>
        <div style="font-size: 11px; color: #92400E; margin-top: 8px; text-decoration: underline;">Open work queue →</div>
      </div>
    `);
  }

  if (items.length === 0) {
    listEl.innerHTML = `<div style="font-size: 13px; color: var(--text-muted); text-align: center; padding: 20px 0;">You're all caught up!</div>`;
    if (badge) badge.style.display = 'none';
  } else {
    listEl.innerHTML = items.join('');
    if (badge) {
      badge.style.display = isRead ? 'none' : 'block';
    }
  }
}

function clearNotifications() {
  sessionStorage.setItem('notifs-read', 'true');
  const badge = document.getElementById('notif-badge');
  if (badge) badge.style.display = 'none';
  const dropdown = document.getElementById('notif-dropdown');
  if (dropdown) dropdown.style.display = 'none';
}

// =========================================
// SESSION TERMINATION & MODALS
// =========================================
window.addEventListener('storage', (e) => {
  if (e.key === 'relay-active-sessions') {
    const sessions = JSON.parse(e.newValue) || {};
    const currentSessionId = sessionStorage.getItem('relay-session-id');
    if (currentSessionId && !sessions[currentSessionId]) {
      alert('Your session has been terminated by an administrator or another device.');
      localStorage.removeItem('relay-user');
      localStorage.removeItem('relay-role');
      window.location.href = 'index.html';
    }
  }
});

function showModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.style.display = 'flex';
}

function hideModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.style.display = 'none';
}

function saveVerification() {
  const selectedStatus = document.querySelector('input[name="verification"]:checked').value;
  const recordId = localStorage.getItem('selected_household');

  localStorage.setItem(`record_${recordId}`, selectedStatus);
  sessionStorage.removeItem('notifs-read');

  if (!navigator.onLine) {
    const offlineQueue = JSON.parse(localStorage.getItem('offline_queue')) || [];
    offlineQueue.push({ id: recordId, status: selectedStatus, timestamp: Date.now() });
    localStorage.setItem('offline_queue', JSON.stringify(offlineQueue));
  }

  window.location.href = 'records.html';
}

function initNetworkListener() {
  let banner = document.getElementById('sync-banner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'sync-banner';
    banner.className = 'global-banner';
    document.body.prepend(banner);
  }

  const updateStatus = () => {
    const isOnline = navigator.onLine;
    const queue = JSON.parse(localStorage.getItem('offline_queue')) || [];
    const statusCard = document.querySelector('.status-card');

    if (!isOnline) {
      document.body.classList.add('has-banner');
      banner.className = 'global-banner offline';
      banner.innerHTML = `⚠️ <strong>Offline Mode:</strong> You can navigate, but changes are saved locally. ${queue.length > 0 ? `(${queue.length} changes pending)` : ''}`;

      if (statusCard) {
        statusCard.innerHTML = `<div class="status-title" style="color: #F59E0B;"><div class="status-dot" style="background-color: #F59E0B;"></div> Offline Mode</div>Saving locally<br>${queue.length} changes pending`;
      }

      document.querySelectorAll('button.btn-primary').forEach(btn => {
        if (btn.innerText.includes('Save') || btn.innerText.includes('Submit') || btn.innerText.includes('Download')) {
          btn.setAttribute('disabled', 'true');
        }
      });
    } else {
      banner.className = 'global-banner online';

      if (queue.length > 0) {
        banner.innerHTML = `🔄 <strong>Back online.</strong> Synchronizing ${queue.length} changes...`;
        if (statusCard) {
          statusCard.innerHTML = `<div class="status-title" style="color: #10B981;"><div class="status-dot"></div> Syncing...</div>Uploading changes<br>Please wait`;
        }

        setTimeout(() => {
          localStorage.removeItem('offline_queue');
          banner.innerHTML = '✅ <strong>All changes synced.</strong>';
          document.body.classList.remove('has-banner');
          setTimeout(() => {
            banner.style.display = 'none';
          }, 3000);

          if (statusCard) {
            const now = new Date();
            const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
            statusCard.innerHTML = `<div class="status-title"><div class="status-dot"></div> System operational</div>Last synced at ${timeStr}<br>Household records up to date`;
          }
        }, 2000);
      } else {
        banner.style.display = 'none';
        document.body.classList.remove('has-banner');
        if (statusCard) {
          const now = new Date();
          const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
          statusCard.innerHTML = `<div class="status-title"><div class="status-dot"></div> System operational</div>Last synced at ${timeStr}<br>Household records up to date`;
        }
      }

      document.querySelectorAll('button[disabled]').forEach(btn => btn.removeAttribute('disabled'));
    }
  };

  updateStatus();
  window.addEventListener('online', updateStatus);
  window.addEventListener('offline', updateStatus);
}
