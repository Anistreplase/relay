// =========================================
// RELAY PROTOTYPE - SHARED LOGIC
// =========================================

document.addEventListener('DOMContentLoaded', () => {
  
  // 1. Highlight active link
  const currentPath = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.sidebar-nav a').forEach(link => {
    if (link.getAttribute('href') === currentPath) link.classList.add('active');
  });

  // 2. User Profile
  updateUserProfile();

  // 3. Button Listeners
  document.body.addEventListener('click', (e) => {
    if (e.target.closest('.btn-add-action')) window.location.href = 'add-household.html';
    
    // SAVE WHICH HOUSEHOLD WAS CLICKED
    const verifyBtn = e.target.closest('.btn-verify-action');
    if (verifyBtn) {
      const row = verifyBtn.closest('tr');
      if (row && row.hasAttribute('data-id')) {
        const recordId = row.getAttribute('data-id');
        localStorage.setItem('selected_household', recordId); // Save the ID
        window.location.href = 'review.html';
      }
    }

    if (e.target.closest('.btn-export-action')) alert('Export started.');
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
// SAVE VERIFICATION (NOW DYNAMIC)
// =========================================
function saveVerification() {
  const selectedStatus = document.querySelector('input[name="verification"]:checked').value;
  const recordId = localStorage.getItem('selected_household');
  
  let statusText = "Unverified";
  if (selectedStatus === "verified") statusText = "Verified";
  if (selectedStatus === "needs-correction") statusText = "Needs Correction";
  if (selectedStatus === "unable") statusText = "Unable to Verify";

  // Save status specifically to the selected household ID
  if (recordId) {
    localStorage.setItem(`record_${recordId}`, statusText);
  }

  alert('Record updated to: ' + statusText);
  window.location.href = 'records.html';
}
