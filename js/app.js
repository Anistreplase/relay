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

});

// =========================================
// SESSION TERMINATION LISTENER
// =========================================
window.addEventListener('storage', (e) => {
  // If the sessions list changes in another tab...
  if (e.key === 'relay-active-sessions') {
    const sessions = JSON.parse(e.newValue) || {};
    const currentSessionId = sessionStorage.getItem('relay-session-id');
    
    // Check if THIS tab's session was deleted from the list
    if (currentSessionId && !sessions[currentSessionId]) {
      alert("⚠️ Your session has been terminated by an administrator or another device.");
      localStorage.removeItem('relay-user');
      localStorage.removeItem('relay-role');
      window.location.href = 'index.html';
    }
  }
});

function updateUserProfile() {
  const savedRole = localStorage.getItem('relay-role') || 'Barangay Official';
  const nameEl = document.querySelector('.user-name');
  const roleEl = document.querySelector('.user-role');

  if (nameEl && roleEl) {
    if (savedRole === 'Admin') {
      nameEl.textContent = 'System Administrator'; roleEl.textContent = 'Full system access';
    } else if (savedRole === 'Purok Officer') {
      nameEl.textContent = 'Purok Officer'; roleEl.textContent = 'Data collection & updates';
    } else {
      nameEl.textContent = 'Barangay Official'; roleEl.textContent = 'Review & coordination';
    }
  }
}

function simulateLogin(event) {
  event.preventDefault();
  const email = document.getElementById('email').value;
  const selectedRole = document.getElementById('login-role').value; 
  if (email && selectedRole) {
    localStorage.setItem('relay-user', email);
    localStorage.setItem('relay-role', selectedRole);
    window.location.href = 'dashboard.html';
  }
}

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
  
  if (!navigator.onLine) {
    let offlineQueue = JSON.parse(localStorage.getItem('offline_queue')) || [];
    offlineQueue.push({ id: recordId, status: selectedStatus, timestamp: Date.now() });
    localStorage.setItem('offline_queue', JSON.stringify(offlineQueue));
    localStorage.setItem(`record_${recordId}`, selectedStatus);
    alert('Saved locally. It will sync when your connection returns.');
    window.location.href = 'records.html';
  } else {
    localStorage.setItem(`record_${recordId}`, selectedStatus);
    alert('Record updated successfully.');
    window.location.href = 'records.html';
  }
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
