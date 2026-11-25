// =========================================
// RELAY PROTOTYPE - SHARED LOGIC
// =========================================

document.addEventListener('DOMContentLoaded', () => {
  
  // 1. Highlight the active sidebar link based on the current URL
  const currentPath = window.location.pathname.split('/').pop() || 'index.html';
  const navLinks = document.querySelectorAll('.sidebar-nav a');
  
  navLinks.forEach(link => {
    const linkPath = link.getAttribute('href');
    if (linkPath === currentPath) {
      link.classList.add('active');
    }
  });

  // 2. Role Swapping & Permissions (3 Roles)
  const roleSelector = document.getElementById('role-selector');
  if (roleSelector) {
    const savedRole = localStorage.getItem('relay-role') || 'Barangay Official';
    roleSelector.value = savedRole;
    applyRolePermissions(savedRole);

    roleSelector.addEventListener('change', (e) => {
      const newRole = e.target.value;
      localStorage.setItem('relay-role', newRole);
      applyRolePermissions(newRole);
      updateUserProfile(); // Update name instantly
    });
  }

  // 3. Modal Controls
  window.openModal = function(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.style.display = 'flex';
  };

  window.closeModal = function(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.style.display = 'none';
  };

  window.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) {
      e.target.style.display = 'none';
    }
  });

  // 4. Update User Profile Name on Load
  updateUserProfile();

  // 5. Make "Add Household" buttons work
  document.querySelectorAll('.btn-add-action').forEach(btn => {
    btn.addEventListener('click', () => {
      window.location.href = 'add-household.html';
    });
  });

  // 6. Make "Review" buttons work
  document.querySelectorAll('.btn-verify-action').forEach(btn => {
    // If it's an <a> tag, it already has an href. If it's a <button>, add logic.
    if (btn.tagName === 'BUTTON') {
      btn.addEventListener('click', () => {
        window.location.href = 'review.html';
      });
    }
  });

  // 7. Make "Export" buttons work (Simulated)
  document.querySelectorAll('.btn-export-action').forEach(btn => {
    btn.addEventListener('click', () => {
      alert('Export started. In the full system, this would download a CSV file.');
    });
  });

  // 8. Make Pagination work (Simulated)
  document.querySelectorAll('.page-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      alert('Page changed! (Simulated pagination)');
    });
  });

});

// =========================================
// UPDATE USER PROFILE IN TOPBAR
// =========================================
function updateUserProfile() {
  const savedRole = localStorage.getItem('relay-role') || 'Barangay Official';
  
  const userNameElement = document.querySelector('.user-name');
  const userRoleElement = document.querySelector('.user-role');

  if (userNameElement && userRoleElement) {
    if (savedRole === 'Admin') {
      userNameElement.textContent = 'System Administrator';
      userRoleElement.textContent = 'Full system access';
    } else if (savedRole === 'Purok Officer') {
      userNameElement.textContent = 'Purok Officer';
      userRoleElement.textContent = 'Data collection & updates';
    } else {
      userNameElement.textContent = 'Barangay Official';
      userRoleElement.textContent = 'Review & coordination';
    }
  }
}

// =========================================
// PERMISSIONS LOGIC
// =========================================
function applyRolePermissions(role) {
  const isAdmin = role === 'Admin';
  const isBarangayOfficial = role === 'Barangay Official';
  const isPurokOfficer = role === 'Purok Officer';

  // Verify Buttons
  const verifyBtns = document.querySelectorAll('.btn-verify-action');
  verifyBtns.forEach(btn => {
    btn.style.display = (isAdmin || isBarangayOfficial) ? 'inline-flex' : 'none';
  });

  // Add Household Buttons
  const addBtns = document.querySelectorAll('.btn-add-action');
  addBtns.forEach(btn => {
    btn.style.display = (isAdmin || isBarangayOfficial || isPurokOfficer) ? 'inline-flex' : 'none';
  });

  // Edit Buttons
  const editBtns = document.querySelectorAll('.btn-edit-action');
  editBtns.forEach(btn => {
    btn.style.display = (isAdmin || isBarangayOfficial || isPurokOfficer) ? 'inline-flex' : 'none';
  });
}

// Simple login simulation
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
