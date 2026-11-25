// =========================================
// RELAY PROTOTYPE - SHARED LOGIC
// =========================================

document.addEventListener('DOMContentLoaded', () => {
  
  // 1. Highlight active sidebar link
  const currentPath = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.sidebar-nav a').forEach(link => {
    if (link.getAttribute('href') === currentPath) link.classList.add('active');
  });

  // 2. Update User Profile
  updateUserProfile();

  // 3. Initialize Offline/Online Listener
  initNetworkListener();

  // 4. Button Listeners
  document.body.addEventListener('click', (e) => {
    if (e.target.closest('.btn-add-action')) window.location.href = 'add-household.html';
    
    const verifyBtn = e.target.closest('.btn-verify-action');
    if (verifyBtn) {
      const row = verifyBtn.closest('tr');
      if (row && row.hasAttribute('data-id')) {
        const recordId = row.getAttribute('data-id');
        localStorage.setItem('selected_household', recordId); 
        window.location.href = 'review.html';
      }
    }

    if (e.target.closest('.btn-export-action')) {
      // We now check if they are offline before letting them export
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

// =========================================
// MODALS
// =========================================
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
  
  // Simulate checking for internet
  if (!navigator.onLine) {
    // Save to offline queue
    let offlineQueue = JSON.parse(localStorage.getItem('offline_queue')) || [];
    offlineQueue.push({ id: recordId, status: selectedStatus, timestamp: Date.now() });
    localStorage.setItem('offline_queue', JSON.stringify(offlineQueue));
    
    // We still update local storage so the user sees the change immediately
    localStorage.setItem(`record_${recordId}`, selectedStatus);
    
    alert('Saved locally. It will sync when your connection returns.');
    window.location.href = 'records.html';
  } else {
    localStorage.setItem(`record_${recordId}`, selectedStatus);
    alert('Record updated successfully.');
    window.location.href = 'records.html';
  }
}

// =========================================
// GOOGLE DOCS STYLE OFFLINE SYNC LOGIC
// =========================================
function initNetworkListener() {
  // Create the banner element and inject it into the body
  let banner = document.createElement('div');
  banner.id = 'sync-banner';
  banner.className = 'global-banner';
  document.body.prepend(banner);
  
  const updateStatus = () => {
    const isOnline = navigator.onLine;
    const queue = JSON.parse(localStorage.getItem('offline_queue')) || [];
    
    if (!isOnline) {
      document.body.classList.add('has-banner');
      banner.className = 'global-banner offline';
      banner.innerHTML = `⚠️ <strong>Offline Mode:</strong> You can navigate, but changes are saved locally. ${queue.length > 0 ? `(${queue.length} changes pending)` : ''}`;
      
      // Disable save buttons visually
      document.querySelectorAll('button.btn-primary').forEach(btn => {
        if(btn.innerText.includes('Save') || btn.innerText.includes('Submit') || btn.innerText.includes('Download')) {
          btn.setAttribute('disabled', 'true');
        }
      });
    } else {
      banner.className = 'global-banner online';
      
      // If we have queued items, show syncing
      if (queue.length > 0) {
        banner.innerHTML = `🔄 <strong>Back online.</strong> Synchronizing ${queue.length} changes...`;
        
        // Wait 2 seconds to simulate uploading to server
        setTimeout(() => {
          localStorage.removeItem('offline_queue');
          banner.innerHTML = `✅ <strong>All changes synced.</strong>`;
          document.body.classList.remove('has-banner');
          setTimeout(() => { banner.style.display = 'none'; }, 3000);
        }, 2000);
      } else {
        banner.style.display = 'none';
        document.body.classList.remove('has-banner');
      }
      
      // Re-enable buttons
      document.querySelectorAll('button[disabled]').forEach(btn => btn.removeAttribute('disabled'));
    }
  };

  // Run on page load
  updateStatus();

  // Listen for actual network changes
  window.addEventListener('online', updateStatus);
  window.addEventListener('offline', updateStatus);
}
