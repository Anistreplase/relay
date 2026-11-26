// =========================================
// RELAY PROTOTYPE - SHARED LOGIC
// =========================================

document.addEventListener('DOMContentLoaded', () => {
  
  const currentPath = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.sidebar-nav a').forEach(link => {
    if (link.getAttribute('href') === currentPath) link.classList.add('active');
  });

  updateUserProfile();
  initNetworkListener();
  initNotifications();

  const sidebarLogo = document.querySelector('.sidebar-logo');
  if (sidebarLogo) {
    sidebarLogo.style.cursor = 'pointer';
    sidebarLogo.addEventListener('click', () => {
      window.location.href = 'dashboard.html';
    });
  }

  document.body.addEventListener('click', (e) => {
    if (e.target.closest('.btn-add-action')) window.location.href = 'add-household.html';
    
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
        alert("You are currently offline. This action cannot be completed until you reconnect.");
      } else {
        if(typeof showModal === 'function') showModal('modal-export');
        else alert('Export started.');
      }
    }
    if (e.target.closest('.page-btn')) alert('Page changed! (Simulated pagination)');
  });

  document.addEventListener('click', (e) => {
    const dropdown = document.getElementById('notif-dropdown');
    if (dropdown && dropdown.style.display === 'block' && !e.target.closest('#notif-container')) {
      dropdown.style.display = 'none';
    }
  });
});

// =========================================
// SMART LOGIN LOGIC
// =========================================
function simulateLogin(event) {
  event.preventDefault();
  const email = document.getElementById('email').value.toLowerCase();
  
  if (!email) return;

  let assignedRole = 'Barangay Official';
  let assignedWorkspace = 'Barangay San Miguel';

  if (email.includes('admin') || email.includes('citydrrm')) {
    assignedRole = 'Admin';
    assignedWorkspace = 'City-Wide Administration';
  } else if (email.includes('purok')) {
    assignedRole = 'Purok Officer';
  } else {
    assignedRole = 'Barangay Official';
  }

  if (email.includes('tibanga')) {
    assignedWorkspace = 'Barangay Tibanga';
  } else if (email.includes('saray')) {
    assignedWorkspace = 'Barangay Saray';
  } else if (email.includes('sanmiguel')) {
    assignedWorkspace = 'Barangay San Miguel';
  }

  localStorage.setItem('relay-user', email);
  localStorage.setItem('relay-role', assignedRole);
  localStorage.setItem('relay-workspace', assignedWorkspace);
  
  window.location.href = 'dashboard.html';
}

// =========================================
// USER PROFILE & DYNAMIC SIDEBAR INJECTION
// =========================================
function updateUserProfile() {
  const savedRole = localStorage.getItem('relay-role') || 'Barangay Official';
  const savedWorkspace = localStorage.getItem('relay-workspace') || 'Barangay San Miguel';
  
  const nameEl = document.querySelector('.user-name');
  const roleEl = document.querySelector('.user-role');
  const workspaceSelector = document.getElementById('workspace-selector');

  // 1. DYNAMICALLY INSERT "MANAGE USERS" LINK IF IT DOESN'T EXIST
  let navUsers = document.getElementById('nav-users');
  if (!navUsers) {
    const footerNav = document.querySelector('.sidebar-footer .sidebar-nav');
    if (footerNav) {
      // Create the link element
      navUsers = document.createElement('a');
      navUsers.href = 'users.html';
      navUsers.id = 'nav-users';
      navUsers.innerHTML = '<span class="nav-icon">👤</span> Manage Users';
      navUsers.style.display = 'none';
      
      // Insert it before the Settings link
      const settingsLink = footerNav.querySelector('a[href="settings.html"]');
      if (settingsLink) {
        footerNav.insertBefore(navUsers, settingsLink);
      } else {
        footerNav.prepend(navUsers);
      }
    }
  }

  // Helper to show/hide regular sidebar links
  const setNav = (href, visible) => {
    const link = document.querySelector(`.sidebar-nav a[href="${href}"]`);
    if (link) link.style.display = visible ? 'flex' : 'none';
  };

  if (nameEl && roleEl) {
    
    // --- ROLE: ADMIN ---
    if (savedRole === 'Admin') {
      nameEl.textContent = 'System Administrator'; 
      roleEl.textContent = 'Full system access';
      
      if (workspaceSelector) {
        workspaceSelector.innerHTML = `
          <option>City-Wide Administration</option>
          <option>Barangay San Miguel</option>
          <option>Barangay Tibanga</option>
          <option>Barangay Saray</option>
        `;
        workspaceSelector.disabled = false;
        workspaceSelector.style.cursor = 'pointer';
      }
      
      // Admin sees EVERYTHING
      setNav('dashboard.html', true);
      setNav('records.html', true);
      setNav('verify.html', true);
      setNav('preparedness.html', true);
      setNav('evacuation.html', true);
      setNav('revalidation.html', true);
      setNav('reports.html', true);
      
      // Show the Manage Users link
      if (navUsers) navUsers.style.display = 'flex';

    } 
    // --- ROLE: PUROK OFFICER ---
    else if (savedRole === 'Purok Officer') {
      nameEl.textContent = 'Purok Officer'; 
      roleEl.textContent = 'Data collection & updates';
      
      if (workspaceSelector) {
        workspaceSelector.innerHTML = `<option>${savedWorkspace}</option>`;
        workspaceSelector.disabled = true;
        workspaceSelector.style.cursor = 'not-allowed';
      }

      // Purok Officers only collect data
      setNav('dashboard.html', false);
      setNav('records.html', true);
      setNav('verify.html', false);
      setNav('preparedness.html', false);
      setNav('evacuation.html', false);
      setNav('revalidation.html', true); 
      setNav('reports.html', false);
      
      if (navUsers) navUsers.style.display = 'none';

    } 
    // --- ROLE: BARANGAY OFFICIAL ---
    else {
      nameEl.textContent = 'Barangay Official'; 
      roleEl.textContent = 'Review & coordination';
      
      if (workspaceSelector) {
        workspaceSelector.innerHTML = `<option>${savedWorkspace}</option>`;
        workspaceSelector.disabled = true;
        workspaceSelector.style.cursor = 'not-allowed';
      }

      // Barangay Officials manage records and verify, AND see evacuation
      setNav('dashboard.html', true);
      setNav('records.html', true);
      setNav('verify.html', true);
      setNav('preparedness.html', true);
      setNav('evacuation.html', true); 
      setNav('revalidation.html', true);
      setNav('reports.html', true);
      
      if (navUsers) navUsers.style.display = 'none';
    }
  }
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

  const topbarRightChildren = Array.from(topbarRight.children);
  const bellElement = topbarRightChildren.find(el => el.textContent.includes('🔔'));
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
  let all = [];
  if (typeof households !== 'undefined') {
    for (const key in households) all.push(households[key]);
  }
  const custom = JSON.parse(localStorage.getItem('custom_households')) || {};
  for (const key in custom) all.push(custom[key]);
  
  const verified = all.filter(hh => (localStorage.getItem(`record_${hh.id}`) || "Unverified") === 'Verified');
  const listEl = document.getElementById('notif-list');
  const badge = document.getElementById('notif-badge');

  if (!listEl) return;

  if (verified.length === 0) {
    listEl.innerHTML = `<div style="font-size: 13px; color: var(--text-muted); text-align: center; padding: 20px 0;">You're all caught up!</div>`;
    if (badge) badge.style.display = 'none';
  } else {
    if (!isRead && badge) badge.style.display = 'block';
    listEl.innerHTML = `
      <div style="background: #FEF3C7; border: 1px solid #FCD34D; padding: 12px; border-radius: 6px; cursor: pointer;" onclick="window.location.href='revalidation.html'">
        <div style="font-size: 13px; font-weight: 600; color: #92400E; margin-bottom: 4px;">Revalidation Due</div>
        <div style="font-size: 12px; color: #92400E;">${verified.length} verified households are due for review.</div>
        <div style="font-size: 11px; color: #92400E; margin-top: 8px; text-decoration: underline;">Open work queue →</div>
      </div>
    `;
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
      alert("⚠️ Your session has been terminated by an administrator or another device.");
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
  
  if (!navigator.onLine) {
    let offlineQueue = JSON.parse(localStorage.getItem('offline_queue')) || [];
    offlineQueue.push({ id: recordId, status: selectedStatus, timestamp: Date.now() });
    localStorage.setItem('offline_queue', JSON.stringify(offlineQueue));
  }

  window.location.href = 'records.html';
}

function initNetworkListener() {
  let banner = document.createElement('div');
  banner.id = 'sync-banner';
  banner.className = 'global-banner';
  document.body.prepend(banner);
  
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
        if(btn.innerText.includes('Save') || btn.innerText.includes('Submit') || btn.innerText.includes('Download')) {
          btn.setAttribute('disabled', 'true');
        }
      });

    } else {
      banner.className = 'global-banner online';
      
      if (queue.length > 0) {
        banner.innerHTML = `🔄 <strong>Back online.</strong> Synchronizing ${queue.length} changes...`;
        if (statusCard) statusCard.innerHTML = `<div class="status-title" style="color: #10B981;"><div class="status-dot"></div> Syncing...</div>Uploading changes<br>Please wait`;

        setTimeout(() => {
          localStorage.removeItem('offline_queue');
          banner.innerHTML = `✅ <strong>All changes synced.</strong>`;
          document.body.classList.remove('has-banner');
          setTimeout(() => { banner.style.display = 'none'; }, 3000);
          
          if (statusCard) {
            const now = new Date();
            const timeStr = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
            statusCard.innerHTML = `<div class="status-title"><div class="status-dot"></div> System operational</div>Last synced at ${timeStr}<br>Household records up to date`;
          }
        }, 2000);
      } else {
        banner.style.display = 'none';
        document.body.classList.remove('has-banner');
        if (statusCard) {
          const now = new Date();
          const timeStr = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
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
