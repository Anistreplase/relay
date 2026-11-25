// =========================================
// RELAY PROTOTYPE - SHARED LOGIC
// =========================================

document.addEventListener('DOMContentLoaded', () => {
  
  // 1. Highlight the active sidebar link
  const currentPath = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.sidebar-nav a').forEach(link => {
    if (link.getAttribute('href') === currentPath) link.classList.add('active');
  });

  // 2. Update User Profile Name
  updateUserProfile();

  // 3. Button Listeners (Using event delegation so it never breaks)
  document.body.addEventListener('click', (e) => {
    // Add Household
    if (e.target.closest('.btn-add-action')) {
      window.location.href = 'add-household.html';
    }
    // Verify / View / Edit (Records & Dashboard)
    if (e.target.closest('.btn-verify-action')) {
      if (!e.target.closest('button').hasAttribute('onclick')) {
        window.location.href = 'review.html';
      }
    }
    // Export
    if (e.target.closest('.btn-export-action')) {
      alert('Export started. In the full system, this would download a CSV file.');
    }
    // Pagination
    if (e.target.closest('.page-btn')) {
      alert('Page changed! (Simulated pagination)');
    }
  });

});

// =========================================
// UPDATE USER PROFILE
// =========================================
function updateUserProfile() {
  const savedRole = localStorage.getItem('relay-role') || 'Barangay Official';
  const nameEl = document.querySelector('.user-name');
  const roleEl = document.querySelector('.user-role');

  if (nameEl && roleEl) {
    if (savedRole === 'Admin') {
      nameEl.textContent = 'System Administrator';
      roleEl.textContent = 'Full system access';
    } else if (savedRole === 'Purok Officer') {
      nameEl.textContent = 'Purok Officer';
      roleEl.textContent = 'Data collection & updates';
    } else {
      nameEl.textContent = 'Barangay Official';
      roleEl.textContent = 'Review & coordination';
    }
  }
}

// =========================================
// LOGIN SIMULATION
// =========================================
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
// SAVE VERIFICATION (THE FIX)
// =========================================
function saveVerification() {
  // Get the selected radio button
  const selectedStatus = document.querySelector('input[name="verification"]:checked').value;
  
  // Map the value to the display text
  let statusText = "Unverified";
  if (selectedStatus === "verified") statusText = "Verified";
  if (selectedStatus === "needs-correction") statusText = "Needs Correction";
  if (selectedStatus === "unable") statusText = "Unable to Verify";

  // Save to browser memory
  localStorage.setItem('record_HH-SM-0248', statusText);

  // Redirect back to records
  alert('Record status updated to: ' + statusText);
  window.location.href = 'records.html';
}
