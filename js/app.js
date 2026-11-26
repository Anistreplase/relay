// =========================================
// RELAY PROTOTYPE - SHARED LOGIC
// =========================================

let pendingDeleteHouseholdId = null;
let pendingDeleteCallback = null;
let pendingExportCallback = null;
let parsedImportRows = [];
let pendingImportFileName = '';
let activeDuplicateContext = null;

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
  ensureExportConfirmModal();
  ensureImportRecordsModal();
  ensureDuplicateResolveModal();

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

    const exportBtn = e.target.closest('.btn-export-action');
    if (exportBtn) {
      e.preventDefault();
      const label = (exportBtn.textContent || 'export').trim().toLowerCase();
      openExportConfirmModal(label, () => {
        if (typeof runExportAction === 'function') {
          runExportAction(label);
        } else {
          alert(`Exported ${label}.`);
        }
      });
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

function getDuplicateDismissedMap() {
  return JSON.parse(localStorage.getItem('relay_not_duplicates')) || {};
}

function makeDuplicatePairKey(idA, idB) {
  return [String(idA || ''), String(idB || '')].sort().join('__');
}

function isMarkedNotDuplicate(idA, idB) {
  const map = getDuplicateDismissedMap();
  return Boolean(map[makeDuplicatePairKey(idA, idB)]);
}

function findDuplicateHouseholds(targetHh, options = {}) {
  if (!targetHh || !targetHh.id) return [];
  const includeDismissed = Boolean(options.includeDismissed);
  const pool = typeof households !== 'undefined'
    ? getAllActiveHouseholds(households)
    : getAllActiveHouseholds({});

  const targetHead = normalizeDupKeyPart(targetHh.head);
  const targetBrgy = normalizeDupKeyPart(targetHh.barangay);
  const targetPurok = normalizeDupKeyPart(targetHh.purok);
  const targetAddr = normalizeDupKeyPart(targetHh.address);
  const targetContact = normalizeDupKeyPart(targetHh.contact || targetHh.contactNo);

  return pool.filter(other => {
    if (!other || other.id === targetHh.id) return false;
    if (!includeDismissed && isMarkedNotDuplicate(targetHh.id, other.id)) return false;

    const otherHead = normalizeDupKeyPart(other.head);
    const otherBrgy = normalizeDupKeyPart(other.barangay);
    const otherPurok = normalizeDupKeyPart(other.purok);
    const otherAddr = normalizeDupKeyPart(other.address);
    const otherContact = normalizeDupKeyPart(other.contact || other.contactNo);

    const sameHead = Boolean(targetHead && otherHead && otherHead === targetHead);
    const sameContact = Boolean(targetContact && otherContact && otherContact === targetContact);
    const sameBrgy = !targetBrgy || !otherBrgy || otherBrgy === targetBrgy;
    const sameLocation =
      (targetAddr && otherAddr && otherAddr === targetAddr) ||
      (targetPurok && otherPurok && otherPurok === targetPurok);

    return (sameHead && sameBrgy && sameLocation) || (sameContact && sameHead);
  });
}

function findAllDuplicatePairsInScope() {
  const pool = typeof households !== 'undefined'
    ? getScopedHouseholds(households)
    : getAllActiveHouseholds({});

  const pairs = [];
  const seen = new Set();

  for (let i = 0; i < pool.length; i++) {
    const a = pool[i];
    const matches = findDuplicateHouseholds(a);
    matches.forEach(b => {
      const key = makeDuplicatePairKey(a.id, b.id);
      if (!seen.has(key)) {
        seen.add(key);
        pairs.push({ recordA: a, recordB: b });
      }
    });
  }

  return pairs;
}

function appendRecordHistory(hhId, entry) {
  if (!hhId) return;
  const historyMap = JSON.parse(localStorage.getItem('relay_record_history')) || {};
  const list = Array.isArray(historyMap[hhId]) ? historyMap[hhId] : [];
  list.unshift({
    ...entry,
    timestamp: new Date().toISOString(),
    actor: localStorage.getItem('relay-user') || (document.querySelector('.user-name')?.textContent || 'Barangay Official')
  });
  historyMap[hhId] = list;
  localStorage.setItem('relay_record_history', JSON.stringify(historyMap));
}

function logDuplicateAudit(resolution, recordAId, recordBId, extra = {}) {
  const logs = JSON.parse(localStorage.getItem('relay_audit_logs')) || [];
  logs.unshift({
    action: `DUPLICATE_${String(resolution || '').toUpperCase().replace(/\s+/g, '_')}`,
    recordAId,
    recordBId,
    timestamp: new Date().toISOString(),
    actor: localStorage.getItem('relay-user') || 'Barangay Official',
    ...extra
  });
  localStorage.setItem('relay_audit_logs', JSON.stringify(logs));
}

// =========================================
// FULL DUPLICATE RESOLUTION MODAL (UC-06)
// =========================================
function ensureDuplicateResolveModal() {
  if (document.getElementById('modal-duplicate-resolve')) return;

  const wrapper = document.createElement('div');
  wrapper.innerHTML = `
    <div id="modal-duplicate-resolve" class="modal-overlay">
      <div class="modal-box" style="max-width: 720px; max-height: 90vh; overflow-y: auto;">
        <div class="modal-eyebrow">UC-06 · Detect & Resolve Duplicate Records</div>
        <div class="modal-title" id="dup-modal-title">Side-by-side duplicate comparison</div>
        <div class="modal-desc" id="dup-modal-desc" style="margin-bottom: 12px;">
          Compare conflicting fields between records. Choose which value to keep when merging, or select Keep Both, Not a Duplicate, or Flag For Validation.
        </div>

        <div id="dup-pair-switcher" style="display:none; margin-bottom: 12px; gap: 8px; align-items: center; flex-wrap: wrap;">
          <label for="dup-pair-select" style="font-size: 12px; font-weight: 600;">Detected pair:</label>
          <select id="dup-pair-select" onchange="switchDuplicatePair(this.value)" style="padding: 6px 10px; border: 1px solid var(--border); border-radius: 6px; font-size: 12px; background: var(--white);"></select>
        </div>

        <div id="dup-cross-brgy-banner" style="display:none; background:#FEF3C7; border:1px solid #F59E0B; color:#92400E; padding:10px 12px; border-radius:6px; font-size:12px; margin-bottom:14px; line-height:1.45;"></div>

        <div id="dup-comparison-table" style="border: 1px solid var(--border); border-radius: 8px; overflow: hidden; margin-bottom: 16px;"></div>

        <div class="modal-footer" style="flex-direction: column; align-items: stretch; gap: 12px;">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
            <div class="modal-footer-text" id="dup-modal-status">Select a resolution action below.</div>
            <div class="modal-actions" style="flex-wrap: wrap;">
              <button type="button" class="btn btn-secondary" onclick="closeDuplicateResolveModal()">Close</button>
              <button type="button" class="btn btn-secondary" onclick="resolveDuplicateFlagForValidation()">Flag For Validation</button>
              <button type="button" class="btn btn-secondary" onclick="resolveDuplicateNotDuplicate()">Not a Duplicate</button>
              <button type="button" class="btn btn-secondary" onclick="resolveDuplicateKeepBoth()">Keep Both</button>
              <button type="button" class="btn btn-primary" onclick="resolveDuplicateMerge()">Merge Records</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(wrapper.firstElementChild);
}

function getLatestRecordById(hhId) {
  if (!hhId) return null;
  const deleted = JSON.parse(localStorage.getItem('deleted_households')) || {};
  if (deleted[hhId]) return null;
  const custom = JSON.parse(localStorage.getItem('custom_households')) || {};
  if (custom[hhId]) return { ...custom[hhId], barangay: custom[hhId].barangay || 'San Miguel' };
  if (typeof households !== 'undefined' && households[hhId]) {
    return { ...households[hhId], barangay: households[hhId].barangay || 'San Miguel' };
  }
  return null;
}

function openDuplicateResolveModal(primaryHh, candidates = [], onResolved = null) {
  ensureDuplicateResolveModal();

  const list = Array.isArray(candidates) && candidates.length > 0 ? candidates : [];
  if (!primaryHh || list.length === 0) {
    alert('No duplicate candidate records found for this household.');
    return;
  }

  activeDuplicateContext = {
    primaryId: primaryHh.id,
    candidates: list,
    selectedIndex: 0,
    onResolved: typeof onResolved === 'function' ? onResolved : null
  };

  const switcher = document.getElementById('dup-pair-switcher');
  const selectEl = document.getElementById('dup-pair-select');
  if (switcher && selectEl) {
    if (list.length > 1) {
      switcher.style.display = 'flex';
      selectEl.innerHTML = list
        .map((c, idx) => `<option value="${idx}">${escapeSearchHtml(c.head || c.id)} (${escapeSearchHtml(c.id)} · ${escapeSearchHtml(c.purok || c.barangay || '')})</option>`)
        .join('');
      selectEl.value = '0';
    } else {
      switcher.style.display = 'none';
    }
  }

  renderDuplicateComparisonView();
  showModal('modal-duplicate-resolve');
}

function openDuplicateCenterModal(onResolved = null) {
  const pairs = findAllDuplicatePairsInScope();
  if (pairs.length === 0) {
    alert('No active possible duplicate pairs detected in your current workspace.');
    return;
  }

  ensureDuplicateResolveModal();
  activeDuplicateContext = {
    mode: 'center',
    pairs,
    selectedIndex: 0,
    onResolved: typeof onResolved === 'function' ? onResolved : null
  };

  const switcher = document.getElementById('dup-pair-switcher');
  const selectEl = document.getElementById('dup-pair-select');
  if (switcher && selectEl) {
    switcher.style.display = 'flex';
    selectEl.innerHTML = pairs
      .map((p, idx) => `<option value="${idx}">Pair ${idx + 1}: ${escapeSearchHtml(p.recordA.head)} (${escapeSearchHtml(p.recordA.id)}) vs ${escapeSearchHtml(p.recordB.head)} (${escapeSearchHtml(p.recordB.id)})</option>`)
      .join('');
    selectEl.value = '0';
  }

  renderDuplicateComparisonView();
  showModal('modal-duplicate-resolve');
}

function switchDuplicatePair(indexVal) {
  if (!activeDuplicateContext) return;
  const idx = Number(indexVal) || 0;
  activeDuplicateContext.selectedIndex = idx;
  renderDuplicateComparisonView();
}

function getActiveDuplicatePair() {
  if (!activeDuplicateContext) return null;
  if (activeDuplicateContext.mode === 'center') {
    const pair = activeDuplicateContext.pairs[activeDuplicateContext.selectedIndex] || activeDuplicateContext.pairs[0];
    if (!pair) return null;
    const recA = getLatestRecordById(pair.recordA.id) || pair.recordA;
    const recB = getLatestRecordById(pair.recordB.id) || pair.recordB;
    return { recA, recB };
  }

  const recA = getLatestRecordById(activeDuplicateContext.primaryId);
  const candRaw = activeDuplicateContext.candidates[activeDuplicateContext.selectedIndex] || activeDuplicateContext.candidates[0];
  const recB = candRaw ? (getLatestRecordById(candRaw.id) || candRaw) : null;
  if (!recA || !recB) return null;
  return { recA, recB };
}

function renderDuplicateComparisonView() {
  const pairData = getActiveDuplicatePair();
  const tableContainer = document.getElementById('dup-comparison-table');
  const bannerEl = document.getElementById('dup-cross-brgy-banner');
  const statusEl = document.getElementById('dup-modal-status');

  if (!pairData || !tableContainer) return;
  const { recA, recB } = pairData;

  const brgyA = String(recA.barangay || 'San Miguel').trim();
  const brgyB = String(recB.barangay || 'San Miguel').trim();

  if (bannerEl) {
    if (brgyA.toLowerCase() !== brgyB.toLowerCase()) {
      bannerEl.style.display = 'block';
      bannerEl.innerHTML = `<strong>Cross-Barangay Match:</strong> Record <strong>${escapeSearchHtml(recA.id)}</strong> belongs to <strong>${escapeSearchHtml(brgyA)}</strong> and <strong>${escapeSearchHtml(recB.id)}</strong> belongs to <strong>${escapeSearchHtml(brgyB)}</strong>. Coordinating officials from both barangays should confirm which record is current before merging.`;
    } else {
      bannerEl.style.display = 'none';
      bannerEl.innerHTML = '';
    }
  }

  const getPrimaryNeed = (hh) => {
    if (!Array.isArray(hh.members) || hh.members.length === 0) return 'None reported';
    const needs = hh.members
      .map(m => m && m.needs)
      .filter(n => n && n !== 'None' && n !== 'None reported');
    return needs.length > 0 ? needs.join(', ') : 'None reported';
  };

  const fields = [
    { key: 'head', label: 'Household Head', valA: recA.head || '', valB: recB.head || '' },
    { key: 'barangay', label: 'Barangay', valA: brgyA, valB: brgyB },
    { key: 'purok', label: 'Purok', valA: recA.purok || '', valB: recB.purok || '' },
    { key: 'address', label: 'Address', valA: recA.address || '', valB: recB.address || '' },
    { key: 'contact', label: 'Contact No.', valA: recA.contact || recA.contactNo || 'Not provided', valB: recB.contact || recB.contactNo || 'Not provided' },
    { key: 'tenure', label: 'Tenure', valA: recA.tenure || 'Owner', valB: recB.tenure || 'Owner' },
    { key: 'needs', label: 'Assistance Needs', valA: getPrimaryNeed(recA), valB: getPrimaryNeed(recB) }
  ];

  tableContainer.innerHTML = `
    <table style="width:100%; border-collapse:collapse; font-size:12px;">
      <thead style="background:#F9FAFB;">
        <tr>
          <th style="padding:10px 12px; width:140px;">Field</th>
          <th style="padding:10px 12px;">Record A (${escapeSearchHtml(recA.id)})</th>
          <th style="padding:10px 12px;">Record B (${escapeSearchHtml(recB.id)})</th>
        </tr>
      </thead>
      <tbody>
        ${fields.map(f => {
          const differs = normalizeDupKeyPart(f.valA) !== normalizeDupKeyPart(f.valB);
          return `
            <tr style="${differs ? 'background:#FFFDF5;' : ''}">
              <td style="padding:10px 12px; font-weight:600; border-bottom:1px solid var(--border);">${escapeSearchHtml(f.label)}</td>
              <td style="padding:10px 12px; border-bottom:1px solid var(--border);">
                <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
                  <input type="radio" name="dup_field_${escapeSearchHtml(f.key)}" value="A" checked>
                  <span>${escapeSearchHtml(f.valA)}</span>
                </label>
              </td>
              <td style="padding:10px 12px; border-bottom:1px solid var(--border);">
                <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
                  <input type="radio" name="dup_field_${escapeSearchHtml(f.key)}" value="B">
                  <span>${escapeSearchHtml(f.valB)}</span>
                </label>
              </td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  `;

  if (statusEl) {
    statusEl.textContent = `Comparing ${recA.id} and ${recB.id}`;
  }
}

function closeDuplicateResolveModal() {
  activeDuplicateContext = null;
  hideModal('modal-duplicate-resolve');
}

function finishDuplicateResolution(refreshFn) {
  const cb = activeDuplicateContext && activeDuplicateContext.onResolved;
  closeDuplicateResolveModal();
  if (typeof refreshFn === 'function') refreshFn();
  if (typeof cb === 'function') cb();
}

function resolveDuplicateMerge() {
  const pairData = getActiveDuplicatePair();
  if (!pairData) return;
  const { recA, recB } = pairData;

  const pickField = (key, fallbackA, fallbackB) => {
    const checked = document.querySelector(`input[name="dup_field_${key}"]:checked`);
    return checked && checked.value === 'B' ? fallbackB : fallbackA;
  };

  const needA = Array.isArray(recA.members) && recA.members[0] ? (recA.members[0].needs || 'None reported') : 'None reported';
  const needB = Array.isArray(recB.members) && recB.members[0] ? (recB.members[0].needs || 'None reported') : 'None reported';

  const mergedHead = pickField('head', recA.head, recB.head);
  const mergedBarangay = pickField('barangay', recA.barangay || 'San Miguel', recB.barangay || 'San Miguel');
  const mergedPurok = pickField('purok', recA.purok || '', recB.purok || '');
  const mergedAddress = pickField('address', recA.address || '', recB.address || '');
  const mergedContact = pickField('contact', recA.contact || recA.contactNo || '', recB.contact || recB.contactNo || '');
  const mergedTenure = pickField('tenure', recA.tenure || 'Owner', recB.tenure || 'Owner');
  const mergedNeed = pickField('needs', needA, needB);

  const custom = JSON.parse(localStorage.getItem('custom_households')) || {};
  const mergedMembers = Array.isArray(recA.members) && recA.members.length > 0
    ? recA.members.map((m, i) => i === 0 ? { ...m, needs: mergedNeed } : m)
    : [{ name: mergedHead, category: 'Household Head', needs: mergedNeed }];

  custom[recA.id] = {
    ...recA,
    head: mergedHead,
    barangay: mergedBarangay,
    purok: mergedPurok,
    address: mergedAddress,
    contact: mergedContact,
    tenure: mergedTenure,
    members: mergedMembers,
    lastUpdated: new Date().toISOString().slice(0, 10),
    mergedFrom: [recA.id, recB.id]
  };
  localStorage.setItem('custom_households', JSON.stringify(custom));

  // Archive secondary record B and preserve history of both
  const deleted = JSON.parse(localStorage.getItem('deleted_households')) || {};
  deleted[recB.id] = Date.now();
  localStorage.setItem('deleted_households', JSON.stringify(deleted));
  localStorage.removeItem(`record_${recB.id}`);

  appendRecordHistory(recA.id, {
    action: 'MERGED_DUPLICATE',
    mergedRecordId: recB.id,
    previousRecordB: recB
  });
  logDuplicateAudit('Merged', recA.id, recB.id, { mergedInto: recA.id });

  finishDuplicateResolution(() => {
    if (typeof renderRecordsPage === 'function') renderRecordsPage();
  });
}

function resolveDuplicateKeepBoth() {
  const pairData = getActiveDuplicatePair();
  if (!pairData) return;
  const { recA, recB } = pairData;

  const keptList = JSON.parse(localStorage.getItem('relay_kept_duplicates')) || [];
  keptList.push({
    recordAId: recA.id,
    recordBId: recB.id,
    timestamp: new Date().toISOString()
  });
  localStorage.setItem('relay_kept_duplicates', JSON.stringify(keptList));

  appendRecordHistory(recA.id, { action: 'KEPT_BOTH_RECORDS', companionId: recB.id });
  appendRecordHistory(recB.id, { action: 'KEPT_BOTH_RECORDS', companionId: recA.id });
  logDuplicateAudit('Keep Both', recA.id, recB.id);

  finishDuplicateResolution(() => {
    if (typeof renderRecordsPage === 'function') renderRecordsPage();
  });
}

function resolveDuplicateNotDuplicate() {
  const pairData = getActiveDuplicatePair();
  if (!pairData) return;
  const { recA, recB } = pairData;

  const dismissed = getDuplicateDismissedMap();
  dismissed[makeDuplicatePairKey(recA.id, recB.id)] = Date.now();
  localStorage.setItem('relay_not_duplicates', JSON.stringify(dismissed));

  appendRecordHistory(recA.id, { action: 'MARKED_NOT_DUPLICATE', companionId: recB.id });
  appendRecordHistory(recB.id, { action: 'MARKED_NOT_DUPLICATE', companionId: recA.id });
  logDuplicateAudit('Not a Duplicate', recA.id, recB.id);

  finishDuplicateResolution(() => {
    if (typeof renderRecordsPage === 'function') renderRecordsPage();
  });
}

function resolveDuplicateFlagForValidation() {
  const pairData = getActiveDuplicatePair();
  if (!pairData) return;
  const { recA, recB } = pairData;

  const heldMerges = JSON.parse(localStorage.getItem('relay_held_duplicate_merges')) || {};
  heldMerges[makeDuplicatePairKey(recA.id, recB.id)] = {
    recordAId: recA.id,
    recordBId: recB.id,
    status: 'For Validation',
    flaggedAt: new Date().toISOString()
  };
  localStorage.setItem('relay_held_duplicate_merges', JSON.stringify(heldMerges));

  localStorage.setItem(`record_${recA.id}`, 'Unverified');
  localStorage.setItem(`record_${recB.id}`, 'Unverified');
  sessionStorage.removeItem('notifs-read');

  appendRecordHistory(recA.id, { action: 'FLAGGED_FOR_VALIDATION_MERGE_HELD', companionId: recB.id });
  appendRecordHistory(recB.id, { action: 'FLAGGED_FOR_VALIDATION_MERGE_HELD', companionId: recA.id });
  logDuplicateAudit('Flag For Validation', recA.id, recB.id);

  finishDuplicateResolution(() => {
    if (typeof generateNotifications === 'function') generateNotifications();
    if (typeof renderRecordsPage === 'function') renderRecordsPage();
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
            <button type="button" class="btn btn-secondary" id="compare-delete-dup-btn" style="display:none;" onclick="compareDetectedDuplicateFromDelete()">Compare & Resolve</button>
            <button type="button" class="btn btn-primary" id="confirm-delete-record-btn" onclick="confirmDeleteHouseholdModal()">Delete record</button>
          </div>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(wrapper.firstElementChild);
}

function compareDetectedDuplicateFromDelete() {
  const idToCheck = pendingDeleteHouseholdId;
  const afterCb = pendingDeleteCallback;
  if (!idToCheck) return;
  const rec = getLatestRecordById(idToCheck);
  const dups = rec ? findDuplicateHouseholds(rec) : [];
  cancelDeleteHouseholdModal();
  if (rec && dups.length > 0) {
    openDuplicateResolveModal(rec, dups, afterCb);
  }
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
  const recordObj = getLatestRecordById(hhId);

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
  const compareBtn = document.getElementById('compare-delete-dup-btn');
  const headLabel = recordObj && recordObj.head ? `${recordObj.head} household (${hhId})` : hhId;

  if (duplicates.length > 0) {
    const dupSummary = duplicates
      .map(d => `${d.head || 'Household'} (${d.id} · ${d.purok || d.barangay || ''})`)
      .join(', ');
    if (eyebrowEl) eyebrowEl.textContent = 'Duplicate Record Warning';
    if (titleEl) titleEl.textContent = 'Potential duplicate detected';
    if (warnEl) {
      warnEl.style.display = 'block';
      warnEl.innerHTML = `<strong>Warning:</strong> Matching record(s) found: ${escapeSearchHtml(dupSummary)}. You can compare side-by-side or remove this record below.`;
    }
    if (compareBtn) compareBtn.style.display = 'inline-flex';
  } else {
    if (eyebrowEl) eyebrowEl.textContent = 'Duplicate Check & Removal';
    if (titleEl) titleEl.textContent = 'Delete household record?';
    if (warnEl) {
      warnEl.style.display = 'none';
      warnEl.innerHTML = '';
    }
    if (compareBtn) compareBtn.style.display = 'none';
  }

  if (descEl) {
    descEl.textContent = `Remove ${headLabel}? This action cannot be undone.`;
  }

  showModal('modal-delete-record');
  return true;
}

// =========================================
// EXPORT CONFIRMATION & CSV HELPERS
// =========================================
function ensureExportConfirmModal() {
  if (document.getElementById('modal-export')) return;

  const wrapper = document.createElement('div');
  wrapper.innerHTML = `
    <div id="modal-export" class="modal-overlay">
      <div class="modal-box" style="max-width: 480px;">
        <div class="modal-eyebrow">Export Confirmation</div>
        <div class="modal-title" id="modal-export-title">Confirm export?</div>
        <div class="modal-desc" id="modal-export-desc">
          Generate and export the current workspace records for your active barangay scope?
        </div>
        <div class="modal-footer">
          <div class="modal-footer-text" id="modal-export-meta">Scoped to active workspace</div>
          <div class="modal-actions">
            <button type="button" class="btn btn-secondary" onclick="cancelExportConfirmModal()">Cancel</button>
            <button type="button" class="btn btn-primary" id="confirm-export-btn" onclick="confirmExportModal()">Confirm export</button>
          </div>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(wrapper.firstElementChild);
}

function cancelExportConfirmModal() {
  pendingExportCallback = null;
  hideModal('modal-export');
}

function confirmExportModal() {
  const cb = pendingExportCallback;
  cancelExportConfirmModal();
  if (typeof cb === 'function') {
    cb();
  }
}

function openExportConfirmModal(exportLabel, onConfirm) {
  if (!navigator.onLine) {
    alert('You are currently offline. Export cannot be completed until you reconnect.');
    return;
  }

  ensureExportConfirmModal();
  pendingExportCallback = typeof onConfirm === 'function' ? onConfirm : null;

  const workspace = localStorage.getItem('relay-workspace') || 'Barangay San Miguel';
  const titleEl = document.getElementById('modal-export-title');
  const descEl = document.getElementById('modal-export-desc');
  const metaEl = document.getElementById('modal-export-meta');

  if (titleEl) titleEl.textContent = `Confirm ${exportLabel || 'export'}?`;
  if (descEl) {
    descEl.textContent = `Export ${exportLabel || 'report data'} for ${workspace} using current household and status records?`;
  }
  if (metaEl) metaEl.textContent = `Workspace: ${workspace}`;

  showModal('modal-export');
}

function downloadRelayCsv(filename, rows) {
  const csvContent = rows
    .map(row => row.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// =========================================
// IMPORT EXISTING RECORDS (UC-14 / FRQ-14)
// =========================================
function ensureImportRecordsModal() {
  if (document.getElementById('modal-import-records')) return;

  const wrapper = document.createElement('div');
  wrapper.innerHTML = `
    <div id="modal-import-records" class="modal-overlay">
      <div class="modal-box" style="max-width: 620px;">
        <div class="modal-eyebrow">UC-14 · Import Existing Records</div>
        <div class="modal-title">Import household records</div>
        <div class="modal-desc">
          Upload a CSV or JSON file. Records are previewed for missing fields and possible duplicates, tagged with their source, and saved as <strong>Unverified</strong>.
        </div>

        <div style="display: flex; flex-direction: column; gap: 12px; margin-bottom: 16px;">
          <div>
            <label for="import-file-input" style="display:block; font-size:12px; font-weight:600; margin-bottom:6px;">Select CSV or JSON file</label>
            <input type="file" id="import-file-input" accept=".csv,.json,text/csv,application/json" onchange="handleImportFileSelected(event)" style="font-size:12px; width:100%;">
          </div>
          <div>
            <label for="import-source-label" style="display:block; font-size:12px; font-weight:600; margin-bottom:6px;">Source tag (e.g. PWD List, Senior List, CBMS)</label>
            <input type="text" id="import-source-label" placeholder="e.g., Senior Citizens / PWD Registry" style="width:100%; padding:8px 12px; border:1px solid var(--border); border-radius:6px; font-size:13px; font-family:inherit;">
          </div>
          <div id="import-error-msg" style="display:none; background:#FEE2E2; border:1px solid #EF4444; color:#991B1B; padding:10px 12px; border-radius:6px; font-size:12px;"></div>
          <div id="import-preview-box" style="display:none; max-height:220px; overflow-y:auto; border:1px solid var(--border); border-radius:6px; background:#F9FAFB; padding:12px; font-size:12px;"></div>
        </div>

        <div class="modal-footer">
          <div class="modal-footer-text" id="import-summary-text">No file selected yet.</div>
          <div class="modal-actions">
            <button type="button" class="btn btn-secondary" onclick="closeImportRecordsModal()">Cancel</button>
            <button type="button" class="btn btn-primary" id="btn-confirm-import" onclick="confirmImportRecords()" disabled>Import as Unverified</button>
          </div>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(wrapper.firstElementChild);
}

function openImportRecordsModal() {
  if (!navigator.onLine) {
    alert('You are currently offline. Connect to import record files.');
    return;
  }
  ensureImportRecordsModal();
  parsedImportRows = [];
  pendingImportFileName = '';

  const fileInput = document.getElementById('import-file-input');
  const sourceInput = document.getElementById('import-source-label');
  const errBox = document.getElementById('import-error-msg');
  const previewBox = document.getElementById('import-preview-box');
  const summaryText = document.getElementById('import-summary-text');
  const confirmBtn = document.getElementById('btn-confirm-import');

  if (fileInput) fileInput.value = '';
  if (sourceInput) sourceInput.value = '';
  if (errBox) {
    errBox.style.display = 'none';
    errBox.textContent = '';
  }
  if (previewBox) {
    previewBox.style.display = 'none';
    previewBox.innerHTML = '';
  }
  if (summaryText) summaryText.textContent = 'No file selected yet.';
  if (confirmBtn) confirmBtn.disabled = true;

  showModal('modal-import-records');
}

function closeImportRecordsModal() {
  parsedImportRows = [];
  pendingImportFileName = '';
  hideModal('modal-import-records');
}

function parseCsvLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function parseImportFileText(text, ext) {
  if (ext === 'json') {
    const parsed = JSON.parse(text);
    const list = Array.isArray(parsed) ? parsed : (Array.isArray(parsed.households) ? parsed.households : []);
    if (!Array.isArray(list) || list.length === 0) {
      throw new Error('JSON must contain a non-empty array of household records.');
    }
    return list;
  }

  const lines = text
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    throw new Error('CSV must include a header row and at least one record row.');
  }

  const headers = parseCsvLine(lines[0]).map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ''));
  return lines.slice(1).map(line => {
    const cols = parseCsvLine(line);
    const obj = {};
    headers.forEach((key, idx) => {
      obj[key] = cols[idx] ?? '';
    });
    return {
      head: obj.head || obj.householdhead || obj.name || '',
      purok: obj.purok || '',
      address: obj.address || '',
      barangay: obj.barangay || '',
      contact: obj.contact || obj.contactno || obj.phone || '',
      tenure: obj.tenure || 'Owner',
      needs: obj.needs || obj.assistanceneeds || obj.need || 'None reported'
    };
  });
}

function handleImportFileSelected(event) {
  const file = event.target && event.target.files ? event.target.files[0] : null;
  const errBox = document.getElementById('import-error-msg');
  const previewBox = document.getElementById('import-preview-box');
  const summaryText = document.getElementById('import-summary-text');
  const confirmBtn = document.getElementById('btn-confirm-import');

  parsedImportRows = [];
  if (errBox) {
    errBox.style.display = 'none';
    errBox.textContent = '';
  }
  if (confirmBtn) confirmBtn.disabled = true;

  if (!file) {
    if (summaryText) summaryText.textContent = 'No file selected yet.';
    return;
  }

  const lowerName = file.name.toLowerCase();
  const ext = lowerName.endsWith('.json') ? 'json' : (lowerName.endsWith('.csv') ? 'csv' : '');
  if (!ext) {
    if (errBox) {
      errBox.style.display = 'block';
      errBox.textContent = 'Unsupported file format. Please upload a .csv or .json file.';
    }
    return;
  }

  pendingImportFileName = file.name;
  const sourceInput = document.getElementById('import-source-label');
  if (sourceInput && !sourceInput.value.trim()) {
    sourceInput.value = file.name;
  }

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const rawItems = parseImportFileText(String(reader.result || ''), ext);
      const resolved = resolveHouseholdBarangay('');
      const defaultBrgy = resolved.ok && resolved.barangay ? resolved.barangay : 'San Miguel';

      parsedImportRows = rawItems.map((item, index) => {
        const head = String(item.head || '').trim();
        const purok = String(item.purok || '').trim();
        const barangay = String(item.barangay || '').trim() || defaultBrgy;
        const address = String(item.address || '').trim();
        const missing = [];
        if (!head) missing.push('Household Head');
        if (!purok) missing.push('Purok');

        const candidate = {
          id: `IMP-PREVIEW-${index + 1}`,
          head,
          barangay,
          purok,
          address
        };
        const dups = head ? findDuplicateHouseholds(candidate) : [];

        return {
          head,
          purok,
          barangay,
          address,
          contact: String(item.contact || '').trim(),
          tenure: String(item.tenure || 'Owner').trim() || 'Owner',
          needs: String(item.needs || 'None reported').trim() || 'None reported',
          missing,
          duplicates: dups
        };
      });

      const validCount = parsedImportRows.filter(r => r.missing.length === 0).length;
      const dupCount = parsedImportRows.filter(r => r.duplicates.length > 0).length;

      if (previewBox) {
        previewBox.style.display = 'block';
        previewBox.innerHTML = parsedImportRows.map((row, idx) => {
          const badges = [];
          if (row.missing.length > 0) {
            badges.push(`<span style="color:#991B1B; font-weight:600;">Missing: ${escapeSearchHtml(row.missing.join(', '))}</span>`);
          } else {
            badges.push('<span style="color:#065F46; font-weight:600;">Ready (Unverified)</span>');
          }
          if (row.duplicates.length > 0) {
            badges.push(`<span style="color:#92400E; font-weight:600;">Possible duplicate (${row.duplicates.length})</span>`);
          }
          return `<div style="padding:6px 0; border-bottom:1px solid #E5E7EB;">
            <strong>#${idx + 1} ${escapeSearchHtml(row.head || '(Unnamed Head)')}</strong> · ${escapeSearchHtml(row.purok || 'No Purok')} (${escapeSearchHtml(row.barangay)})<br>
            ${badges.join(' · ')}
          </div>`;
        }).join('');
      }

      if (summaryText) {
        summaryText.textContent = `${validCount} valid of ${parsedImportRows.length} row(s) · ${dupCount} with possible duplicate(s)`;
      }
      if (confirmBtn) {
        confirmBtn.disabled = validCount === 0;
      }
    } catch (err) {
      if (errBox) {
        errBox.style.display = 'block';
        errBox.textContent = err.message || 'Could not parse the selected file.';
      }
      if (previewBox) {
        previewBox.style.display = 'none';
        previewBox.innerHTML = '';
      }
    }
  };
  reader.readAsText(file);
}

function confirmImportRecords() {
  const validRows = parsedImportRows.filter(r => r.missing.length === 0);
  if (validRows.length === 0) return;

  const sourceInput = document.getElementById('import-source-label');
  const sourceTag = (sourceInput && sourceInput.value.trim()) || pendingImportFileName || 'Imported List';
  const custom = JSON.parse(localStorage.getItem('custom_households')) || {};
  const todayStr = new Date().toISOString().slice(0, 10);

  let importedCount = 0;
  validRows.forEach((row, i) => {
    const uniqueId = `HH-IMP-${Date.now().toString().slice(-6)}-${i + 1}`;
    custom[uniqueId] = {
      id: uniqueId,
      head: row.head,
      barangay: row.barangay,
      purok: row.purok,
      address: row.address || row.purok,
      contact: row.contact,
      tenure: row.tenure,
      importSource: sourceTag,
      lastUpdated: todayStr,
      locationConfirmed: false,
      members: [
        {
          name: row.head,
          category: 'Imported Resident',
          needs: row.needs
        }
      ]
    };
    localStorage.setItem(`record_${uniqueId}`, 'Unverified');
    appendRecordHistory(uniqueId, { action: 'IMPORTED_RECORD', source: sourceTag });
    importedCount++;
  });

  localStorage.setItem('custom_households', JSON.stringify(custom));
  sessionStorage.removeItem('notifs-read');

  const importLogs = JSON.parse(localStorage.getItem('relay_import_batches')) || [];
  importLogs.unshift({
    importedAt: new Date().toISOString(),
    fileName: pendingImportFileName || 'import',
    source: sourceTag,
    count: importedCount
  });
  localStorage.setItem('relay_import_batches', JSON.stringify(importLogs));

  closeImportRecordsModal();
  if (typeof renderRecordsPage === 'function') {
    renderRecordsPage();
  } else {
    window.location.reload();
  }
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
          Notifications <span style="font-size: 11px; color: var(--red); cursor: pointer;" onclick="clearNotifications()">Mark all as read</span>
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
