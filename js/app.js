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
    // Default to Barangay Official if nothing is saved
    const savedRole = localStorage.getItem('relay-role') || 'Barangay Official';
    roleSelector.value = savedRole;
    applyRolePermissions(savedRole);

    roleSelector.addEventListener('change', (e) => {
      const newRole = e.target.value;
      localStorage.setItem('relay-role', newRole);
      applyRolePermissions(newRole);
    });
  }

  // 3. Modal Controls (for the Interactive Previews)
  window.openModal = function(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.style.display = 'flex';
  };

  window.closeModal = function(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.style.display = 'none';
  };

  // Close modal when clicking the dark background
  window.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) {
      e.target.style.display = 'none';
    }
  });

});

// =========================================
// PERMISSIONS LOGIC
// =========================================
function applyRolePermissions(role) {
  const isAdmin = role === 'Admin';
  const isBarangayOfficial = role === 'Barangay Official';
  const isPurokOfficer = role === 'Purok Officer';

  // --- 1. Verification Buttons ---
  // Only Admin and Barangay Official can verify records (UC-05)
  const verifyBtns = document.querySelectorAll('.btn-verify-action');
  verifyBtns.forEach(btn => {
    btn.style.display = (isAdmin || isBarangayOfficial) ? 'inline-flex' : 'none';
  });

  // --- 2. Add Household Buttons ---
  // Admin, Barangay Official, and Purok Officer can add records (UC-03)
  const addBtns = document.querySelectorAll('.btn-add-action');
  addBtns.forEach(btn => {
    btn.style.display = (isAdmin || isBarangayOfficial || isPurokOfficer) ? 'inline-flex' : 'none';
  });

  // --- 3. Edit/Update Buttons ---
  // Everyone can edit, but Purok Officers are restricted to their own purok (handled on page level)
  const editBtns = document.querySelectorAll('.btn-edit-action');
  editBtns.forEach(btn => {
    btn.style.display = 'inline-flex'; 
  });

  // --- 4. Workspace / Barangay Selector ---
  // Admin can switch barangays. Barangay Official is locked to their own.
  const workspaceSelector = document.getElementById('workspace-selector');
  if (workspaceSelector) {
    if (isAdmin) {
      workspaceSelector.innerHTML = `
        <option value="san-miguel">Barangay San Miguel</option>
        <option value="tibanga">Barangay Tibanga</option>
        <option value="saray">Barangay Saray</option>
      `;
      workspaceSelector.disabled = false;
    } else {
      // Lock to their specific barangay (e.g., San Miguel)
      workspaceSelector.innerHTML = `<option value="san-miguel">Barangay San Miguel</option>`;
      workspaceSelector.disabled = true; 
    }
  }
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
