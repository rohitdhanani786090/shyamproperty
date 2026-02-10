// --- Global Data Storage & Counters ---
// These variables now hold the application's state fetched from Firebase.
let employees = [];
let properties = [];
// The following IDs are now for storing the Firebase Document ID (string)
let editingPropertyId = null;
let editingEmployeeId = null;
let db; // Firestore database reference

// --- Firebase Integration: Configuration ---

// Your web app's Firebase configuration
const firebaseConfig = {
    // NOTE: This key is exposed, which is a security risk for production apps.
    apiKey: "AIzaSyC-8DGxz2aABfonDbHvlIwQuicSqckjufc",
    authDomain: "property-manager-326bf.firebaseapp.com",
    projectId: "property-manager-326bf",
    storageBucket: "property-manager-326bf.appspot.com",
    messagingSenderId: "1060819586713",
    appId: "1:1060819586713:web:9ec3fcc365d931cb4f7208"
};

// Initialize Firebase
try {
    // This assumes the Firebase compat SDK scripts are included in your HTML <head>
    firebase.initializeApp(firebaseConfig);
    // Get a reference to the database service
    db = firebase.firestore();
    showToast('Firebase connection successful!', 'success');
} catch (error) {
    console.error("Firebase initialization error:", error);
    showToast(`Firebase connection failed: ${error.message}`, 'error');
}

// --- NEW Data Loading Function (Reads from Firestore) ---
async function loadInitialData() {
    if (!db) return; // Exit if DB connection failed
    showToast('Loading data from Firebase...', 'info');

    try {
        // 1. Fetch Properties from 'properties' collection
        const propertySnapshot = await db.collection("properties").get();
        properties = propertySnapshot.docs.map(doc => ({
            id: doc.id, // Use Firestore's unique ID
            ...doc.data()
        }));

        // 2. Fetch Employees from 'employees' collection
        const employeeSnapshot = await db.collection("employees").get();
        employees = employeeSnapshot.docs.map(doc => ({
            id: doc.id, // Use Firestore's unique ID
            ...doc.data()
        }));

        showToast('Data loaded successfully!', 'success');
        updateEmployeeDropdown();
        updateDashboard();
        // Force display refresh if user is on these pages
        if (!document.getElementById('properties-page').classList.contains('hidden')) {
            displayProperties();
        }
        if (!document.getElementById('employees-page').classList.contains('hidden')) {
            displayEmployees();
        }

    } catch (error) {
        console.error("Error loading data from Firestore:", error);
        showToast(`Error loading data from cloud: ${error.message}`, 'error');
    }
}

// Navigation
function navigateTo(page) {
    // Hide all pages
    document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));

    // Remove active class from all nav links
    document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));

    // Show selected page
    switch (page) {
        case 'dashboard':
            document.getElementById('dashboard-page').classList.remove('hidden');
            document.querySelectorAll('.nav-link')[0].classList.add('active');
            updateDashboard();
            break;
        case 'properties':
            document.getElementById('properties-page').classList.remove('hidden');
            document.querySelectorAll('.nav-link')[1].classList.add('active');
            displayProperties();
            break;
        case 'add-property':
            document.getElementById('add-property-page').classList.remove('hidden');
            document.querySelectorAll('.nav-link')[2].classList.add('active');
            resetPropertyForm();
            break;
        case 'employees':
            document.getElementById('employees-page').classList.remove('hidden');
            document.querySelectorAll('.nav-link')[3].classList.add('active');
            displayEmployees();
            break;
        case 'add-employee':
            document.getElementById('add-employee-page').classList.remove('hidden');
            document.querySelectorAll('.nav-link')[4].classList.add('active');
            resetEmployeeForm();
            break;
    }

    // Close mobile menu
    if (window.innerWidth <= 768) {
        document.getElementById('sidebar').classList.remove('open');
    }
}

// Toggle Sidebar for Mobile
function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
}

// Update Dashboard Statistics
function updateDashboard() {
    document.getElementById('total-properties').textContent = properties.length;
    document.getElementById('properties-for-sale').textContent = properties.filter(p => p.listingType === 'For Sale').length;
    document.getElementById('properties-for-rent').textContent = properties.filter(p => p.listingType === 'For Rent').length;
    document.getElementById('total-employees').textContent = employees.length;

    // Display recent properties
    const recentContainer = document.getElementById('recent-properties-container');
    // Sort properties by dateAdded (assuming it's a server timestamp or ISO string)
    const sortedProperties = [...properties].sort((a, b) => {
        // Handle Firebase ServerTimestamp objects by checking if they have a toDate method
        const dateA = a.dateAdded && typeof a.dateAdded.toDate === 'function' ? a.dateAdded.toDate().getTime() : new Date(a.dateAdded).getTime();
        const dateB = b.dateAdded && typeof b.dateAdded.toDate === 'function' ? b.dateAdded.toDate().getTime() : new Date(b.dateAdded).getTime();
        return dateB - dateA; // Newest first
    });
    const recentProperties = sortedProperties.slice(0, 5);


    if (recentProperties.length === 0) {
        recentContainer.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🏢</div><p>No properties added yet</p></div>';
    } else {
        recentContainer.innerHTML = '<div class="properties-grid">' +
            recentProperties.map(property => `
                    <div class="property-card">
                        <div class="property-card-header">
                            <div>
                                <div class="property-card-title">${property.propertyName}</div>
                                <div class="property-card-detail">📍 ${property.location}</div>
                            </div>
                            <span class="badge ${property.listingType === 'For Sale' ? 'badge-sale' : 'badge-rent'}">
                                ${property.listingType}
                            </span>
                        </div>
                        <div class="property-card-detail">🏠 ${property.propertyType} • ${property.bhkType}</div>
                        <div class="property-card-detail">📐 ${property.areaSqft} sq ft</div>
                        <div class="property-card-detail">👤 ${property.assignedEmployee}</div>
                        <div class="property-card-price">₹${formatNumber(property.price)}</div>
                    </div>
                `).join('') +
            '</div>';
    }
}

// Format number with commas
function formatNumber(num) {
    if (typeof num !== 'number' && typeof num !== 'string') return 'N/A';
    // Convert to number if it's a string, then format
    const numberValue = typeof num === 'string' ? parseFloat(num.replace(/,/g, '')) : num;
    if (isNaN(numberValue)) return 'N/A';
    return numberValue.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}


// Update Employee Dropdown
function updateEmployeeDropdown() {
    const select = document.getElementById('assigned-employee');
    if (select) {
        select.innerHTML = '<option value="">Select Employee</option>' +
            employees.map(emp => `<option value="${emp.name}">${emp.name} (${emp.employeeId})</option>`).join('');
    }
}

// --- Save Property (Writes to Firestore) ---
async function saveProperty(event) {
    event.preventDefault(); // Stop page reload
    
    // 1. Get the button and show loading text
    const btn = document.getElementById('submit-property-btn');
    const originalText = btn.innerText;
    btn.innerText = "Saving...";
    btn.disabled = true;

    if (!db) return showToast('Database connection failed.', 'error');

    // 2. Collect data (INCLUDING THE NEW IMAGE LINK)
    const propertyData = {
        propertyName: document.getElementById('property-name').value,
        ownerName: document.getElementById('owner-name').value,
        assignedEmployee: document.getElementById('assigned-employee').value,
        
        // --- THIS IS THE NEW PART ---
        imageUrl: document.getElementById('property-image').value, 
        // -----------------------------
        
        bhkType: document.getElementById('bhk-type').value,
        price: parseFloat(document.getElementById('price').value) || 0,
        listingType: document.querySelector('input[name="listing-type"]:checked')?.value || '',
        propertyType: document.getElementById('property-type').value,
        areaSqft: parseInt(document.getElementById('area-sqft').value) || 0,
        location: document.getElementById('location').value,
        description: document.getElementById('description').value,
        dateAdded: firebase.firestore.FieldValue.serverTimestamp()
    };

    try {
        if (editingPropertyId) {
            await db.collection("properties").doc(editingPropertyId).update(propertyData);
            showToast('Property updated successfully!', 'success');
            editingPropertyId = null;
        } else {
            await db.collection("properties").add(propertyData);
            showToast('Property added successfully!', 'success');
        }
    } catch (error) {
        console.error("Error saving property:", error);
        showToast(`Failed to save: ${error.message}`, 'error');
    }

    // 3. Reset everything
    resetPropertyForm();
    await loadInitialData();
    navigateTo('properties');
    
    // Restore button
    btn.innerText = originalText;
    btn.disabled = false;
}

// Reset Property Form
function resetPropertyForm() {
    const form = document.getElementById('property-form');
    if (form) form.reset();
    editingPropertyId = null;
    const formTitle = document.getElementById('property-form-title');
    if (formTitle) formTitle.textContent = 'Add New Property';
    const submitBtn = document.getElementById('submit-property-btn');
    if (submitBtn) submitBtn.innerHTML = '✓ Save Property';
}

// Edit Property
function editProperty(id) {
    const property = properties.find(p => p.id === id);
    if (!property) return;

    editingPropertyId = id;
    document.getElementById('property-name').value = property.propertyName;
    document.getElementById('owner-name').value = property.ownerName;
    document.getElementById('assigned-employee').value = property.assignedEmployee;
    document.getElementById('bhk-type').value = property.bhkType;
    document.getElementById('price').value = property.price;
    document.querySelector(`input[name="listing-type"][value="${property.listingType}"]`).checked = true;
    document.getElementById('property-type').value = property.propertyType;
    document.getElementById('area-sqft').value = property.areaSqft;
    document.getElementById('location').value = property.location;
    document.getElementById('description').value = property.description || '';
    document.getElementById('property-image').value = property.imageUrl || '';

    document.getElementById('property-form-title').textContent = 'Edit Property';
    document.getElementById('submit-property-btn').innerHTML = '✓ Update Property';

    navigateTo('add-property');
}

// --- Delete Property (Deletes from Firestore) ---
function deleteProperty(id) {
    if (!db) return showToast('Database connection failed. Cannot delete.', 'error');

    showConfirmModal(
        'Delete Property',
        'Are you sure you want to delete this property? This action cannot be undone and will be removed from the cloud database.',
        async () => { // The callback function is now asynchronous
            try {
                // Delete the document using its Firestore ID
                await db.collection("properties").doc(id).delete();
                showToast('Property deleted successfully from cloud!', 'success');
                await loadInitialData(); // Reload all data to ensure UI is updated
                displayProperties();
            } catch (error) {
                console.error("Error deleting property:", error);
                showToast(`Failed to delete property: ${error.message}`, 'error');
            }
        }
    );
}

// Display Properties (Uses the 'properties' array fetched from Firestore)
function displayProperties() {
    const tbody = document.getElementById('properties-table-body');
    const noPropertiesMsg = document.getElementById('no-properties-message');

    if (properties.length === 0) {
        if (tbody) tbody.innerHTML = '';
        if (noPropertiesMsg) noPropertiesMsg.classList.remove('hidden');
        return;
    }

    if (noPropertiesMsg) noPropertiesMsg.classList.add('hidden');
    if (tbody) {
        tbody.innerHTML = properties.map(property => `
                <tr>
                    <td><strong>${property.propertyName}</strong></td>
                    <td>${property.ownerName}</td>
                    <td>${property.propertyType}</td>
                    <td>${property.bhkType}</td>
                    <td>${property.location}</td>
                    <td><strong>₹${formatNumber(property.price)}</strong></td>
                    <td><span class="badge ${property.listingType === 'For Sale' ? 'badge-sale' : 'badge-rent'}">${property.listingType}</span></td>
                    <td>${property.assignedEmployee}</td>
                    <td>
                        <div class="action-buttons">
                            <button class="btn btn-secondary btn-sm" onclick="editProperty('${property.id}')" title="Edit">
                                ✏️
                            </button>
                            <button class="btn btn-danger btn-sm" onclick="deleteProperty('${property.id}')" title="Delete">
                                🗑️
                            </button>
                        </div>
                    </td>
                </tr>
            `).join('');
    }
}

// Filter Properties
function filterProperties() {
    const searchTerm = document.getElementById('search-properties')?.value.toLowerCase() || '';
    const listingTypeFilter = document.getElementById('filter-listing-type')?.value || '';
    const propertyTypeFilter = document.getElementById('filter-property-type')?.value || '';

    const filtered = properties.filter(property => {
        const matchesSearch = property.propertyName.toLowerCase().includes(searchTerm) ||
            property.ownerName.toLowerCase().includes(searchTerm) ||
            property.location.toLowerCase().includes(searchTerm) ||
            property.assignedEmployee.toLowerCase().includes(searchTerm);
        const matchesListingType = !listingTypeFilter || property.listingType === listingTypeFilter;
        const matchesPropertyType = !propertyTypeFilter || property.propertyType === propertyTypeFilter;

        return matchesSearch && matchesListingType && matchesPropertyType;
    });

    const tbody = document.getElementById('properties-table-body');
    if (!tbody) return;

    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="text-center" style="padding: 48px;"><div class="empty-state"><div class="empty-state-icon">🔍</div><h3>No Properties Found</h3><p>Try adjusting your filters</p></div></td></tr>';
    } else {
        tbody.innerHTML = filtered.map(property => `
                <tr>
                    <td><strong>${property.propertyName}</strong></td>
                    <td>${property.ownerName}</td>
                    <td>${property.propertyType}</td>
                    <td>${property.bhkType}</td>
                    <td>${property.location}</td>
                    <td><strong>₹${formatNumber(property.price)}</strong></td>
                    <td><span class="badge ${property.listingType === 'For Sale' ? 'badge-sale' : 'badge-rent'}">${property.listingType}</span></td>
                    <td>${property.assignedEmployee}</td>
                    <td>
                        <div class="action-buttons">
                            <button class="btn btn-secondary btn-sm" onclick="editProperty('${property.id}')" title="Edit">
                                ✏️
                            </button>
                            <button class="btn btn-danger btn-sm" onclick="deleteProperty('${property.id}')" title="Delete">
                                🗑️
                            </button>
                        </div>
                    </td>
                </tr>
            `).join('');
    }
}

// Export to Excel
function exportToExcel() {
    if (typeof XLSX === 'undefined' || properties.length === 0) {
        showToast('No properties to export or XLSX library is missing!', 'error');
        return;
    }

    const excelData = properties.map(property => ({
        'Property Name': property.propertyName,
        'Owner Name': property.ownerName,
        'Property Type': property.propertyType,
        'BHK Configuration': property.bhkType,
        'Area (sq ft)': property.areaSqft,
        'Location': property.location,
        'Price (₹)': property.price,
        'Listing Type': property.listingType,
        'Assigned Employee': property.assignedEmployee,
        'Description': property.description || '',
        // Format dateAdded from Firebase Timestamp/ISO string
        'Date Added': (property.dateAdded && typeof property.dateAdded.toDate === 'function')
            ? property.dateAdded.toDate().toLocaleDateString()
            : (property.dateAdded ? new Date(property.dateAdded).toLocaleDateString() : 'N/A')
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(excelData);

    ws['!cols'] = [
        { wch: 25 }, { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 12 },
        { wch: 30 }, { wch: 15 }, { wch: 12 }, { wch: 20 }, { wch: 40 }, { wch: 12 }
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Properties');

    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `PropertyPro_Data_${timestamp}.xlsx`;

    XLSX.writeFile(wb, filename);
    showToast('Excel file downloaded successfully!', 'success');
}

// --- Save Employee (Writes to Firestore) ---
async function saveEmployee(event) {
    event.preventDefault();
    if (!db) return showToast('Database connection failed. Cannot save.', 'error');

    const employeeData = {
        employeeId: document.getElementById('employee-id').value,
        name: document.getElementById('employee-name').value,
        contact: document.getElementById('employee-contact').value,
        email: document.getElementById('employee-email').value,
        role: document.getElementById('employee-role').value
    };

    try {
        if (editingEmployeeId) {
            // Update existing employee
            const oldName = employees.find(e => e.id === editingEmployeeId)?.name;

            await db.collection("employees").doc(editingEmployeeId).update(employeeData);
            showToast('Employee updated successfully in cloud!', 'success');

            // IMPORTANT: If the employee name changes, update all assigned properties in Firestore.
            if (oldName && oldName !== employeeData.name) {
                const batch = db.batch();
                properties.filter(p => p.assignedEmployee === oldName).forEach(property => {
                    const propertyRef = db.collection("properties").doc(property.id);
                    batch.update(propertyRef, { assignedEmployee: employeeData.name });
                });
                await batch.commit();
            }

            editingEmployeeId = null;
        } else {
            // Add new employee
            await db.collection("employees").add(employeeData);
            showToast('Employee added successfully to cloud!', 'success');
        }
    } catch (error) {
        console.error("Error saving employee:", error);
        showToast(`Failed to save employee: ${error.message}`, 'error');
    }

    resetEmployeeForm();
    await loadInitialData(); // Reload all data and update UI
    navigateTo('employees');
}

// Reset Employee Form
function resetEmployeeForm() {
    const form = document.getElementById('employee-form');
    if (form) form.reset();
    editingEmployeeId = null;
    const formTitle = document.getElementById('employee-form-title');
    if (formTitle) formTitle.textContent = 'Add New Employee';
    const submitBtn = document.getElementById('submit-employee-btn');
    if (submitBtn) submitBtn.innerHTML = '✓ Save Employee';
}

// Edit Employee
function editEmployee(id) {
    const employee = employees.find(e => e.id === id);
    if (!employee) return;

    editingEmployeeId = id;
    document.getElementById('employee-id').value = employee.employeeId;
    document.getElementById('employee-name').value = employee.name;
    document.getElementById('employee-contact').value = employee.contact;
    document.getElementById('employee-email').value = employee.email;
    document.getElementById('employee-role').value = employee.role;

    document.getElementById('employee-form-title').textContent = 'Edit Employee';
    document.getElementById('submit-employee-btn').innerHTML = '✓ Update Employee';

    navigateTo('add-employee');
}

// --- Delete Employee (Deletes from Firestore) ---
function deleteEmployee(id) {
    if (!db) return showToast('Database connection failed. Cannot delete.', 'error');
    const employee = employees.find(e => e.id === id);
    if (!employee) return;

    // Check assigned properties locally (after initial load)
    const propertiesCount = properties.filter(p => p.assignedEmployee === employee.name).length;

    if (propertiesCount > 0) {
        showToast(`Cannot delete employee with ${propertiesCount} assigned properties! Reassign properties first.`, 'error');
        return;
    }

    showConfirmModal(
        'Delete Employee',
        `Are you sure you want to delete employee ${employee.name}?`,
        async () => { // The callback function is now asynchronous
            try {
                // Delete the document using its Firestore ID
                await db.collection("employees").doc(id).delete();
                showToast('Employee deleted successfully from cloud!', 'success');
                await loadInitialData(); // Reload all data to ensure UI is updated
                displayEmployees();
            } catch (error) {
                console.error("Error deleting employee:", error);
                showToast(`Failed to delete employee: ${error.message}`, 'error');
            }
        }
    );
}

// Display Employees (Uses the 'employees' array fetched from Firestore)
function displayEmployees() {
    const tbody = document.getElementById('employees-table-body');
    const noEmployeesMsg = document.getElementById('no-employees-message');

    if (employees.length === 0) {
        if (tbody) tbody.innerHTML = '';
        if (noEmployeesMsg) noEmployeesMsg.classList.remove('hidden');
        return;
    }

    if (noEmployeesMsg) noEmployeesMsg.classList.add('hidden');
    if (tbody) {
        tbody.innerHTML = employees.map(employee => {
            const propertyCount = properties.filter(p => p.assignedEmployee === employee.name).length;
            return `
                    <tr>
                        <td><strong>${employee.employeeId}</strong></td>
                        <td>${employee.name}</td>
                        <td>${employee.contact}</td>
                        <td>${employee.email}</td>
                        <td>${employee.role}</td>
                        <td><span class="badge badge-sale">${propertyCount}</span></td>
                        <td>
                            <div class="action-buttons">
                                <button class="btn btn-secondary btn-sm" onclick="editEmployee('${employee.id}')" title="Edit">
                                    ✏️
                                </button>
                                <button class="btn btn-danger btn-sm" onclick="deleteEmployee('${employee.id}')" title="Delete">
                                    🗑️
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
        }).join('');
    }
}

// Filter Employees
function filterEmployees() {
    const searchTerm = document.getElementById('search-employees')?.value.toLowerCase() || '';

    const filtered = employees.filter(employee => {
        return employee.name.toLowerCase().includes(searchTerm) ||
            employee.employeeId.toLowerCase().includes(searchTerm) ||
            employee.email.toLowerCase().includes(searchTerm) ||
            employee.role.toLowerCase().includes(searchTerm);
    });

    const tbody = document.getElementById('employees-table-body');
    if (!tbody) return;

    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center" style="padding: 48px;"><div class="empty-state"><div class="empty-state-icon">🔍</div><h3>No Employees Found</h3><p>Try adjusting your search</p></div></td></tr>';
    } else {
        tbody.innerHTML = filtered.map(employee => {
            const propertyCount = properties.filter(p => p.assignedEmployee === employee.name).length;
            return `
                    <tr>
                        <td><strong>${employee.employeeId}</strong></td>
                        <td>${employee.name}</td>
                        <td>${employee.contact}</td>
                        <td>${employee.email}</td>
                        <td>${employee.role}</td>
                        <td><span class="badge badge-sale">${propertyCount}</span></td>
                        <td>
                            <div class="action-buttons">
                                <button class="btn btn-secondary btn-sm" onclick="editEmployee('${employee.id}')" title="Edit">
                                    ✏️
                                </button>
                                <button class="btn btn-danger btn-sm" onclick="deleteEmployee('${employee.id}')" title="Delete">
                                    🗑️
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
        }).join('');
    }
}

// Show Toast Notification
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const icons = {
        success: '✓',
        error: '✗',
        info: 'ℹ'
    };

    toast.innerHTML = `
            <span class="toast-icon">${icons[type] || icons.info}</span>
            <span class="toast-message">${message}</span>
            <span class="toast-close" onclick="this.parentElement.remove()">×</span>
        `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 4000);
}

// Show Confirm Modal
function showConfirmModal(title, message, onConfirm) {
    const container = document.getElementById('modal-container');
    if (!container) return;

    // Remove any existing modal first
    closeModal();

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
            <div class="modal">
                <div class="modal-header">
                    <h2 class="modal-title">${title}</h2>
                    <button class="modal-close" onclick="closeModal()">×</button>
                </div>
                <div class="modal-body">
                    <p>${message}</p>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
                    <button class="btn btn-danger" onclick="confirmModalAction()">Confirm</button>
                </div>
            </div>
        `;

    container.appendChild(modal);

    window.currentModalCallback = onConfirm;

    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal();
        }
    });
}

function closeModal() {
    const container = document.getElementById('modal-container');
    if (container) {
        container.innerHTML = '';
    }
    window.currentModalCallback = null;
}

function confirmModalAction() {
    if (window.currentModalCallback) {
        // The callback is executed here
        window.currentModalCallback();
    }
    closeModal();
}

// Initialize App
window.onload = function () {
    // Attach event listeners to forms for save functions
    const propertyForm = document.getElementById('property-form');
    if (propertyForm) propertyForm.addEventListener('submit', saveProperty);

    const employeeForm = document.getElementById('employee-form');
    if (employeeForm) employeeForm.addEventListener('submit', saveEmployee);

    // Attach event listeners for filtering/searching
    const searchProperties = document.getElementById('search-properties');
    if (searchProperties) searchProperties.addEventListener('input', filterProperties);

    const filterListing = document.getElementById('filter-listing-type');
    if (filterListing) filterListing.addEventListener('change', filterProperties);

    const filterPropertyType = document.getElementById('filter-property-type');
    if (filterPropertyType) filterPropertyType.addEventListener('change', filterProperties);

    const searchEmployees = document.getElementById('search-employees');
    if (searchEmployees) searchEmployees.addEventListener('input', filterEmployees);

    // Expose functions to the global window object for use in inline onclick handlers
    window.navigateTo = navigateTo;
    window.toggleSidebar = toggleSidebar;
    window.editProperty = editProperty;
    window.deleteProperty = deleteProperty;
    window.filterProperties = filterProperties;
    window.editEmployee = editEmployee;
    window.deleteEmployee = deleteEmployee;
    window.filterEmployees = filterEmployees;
    window.exportToExcel = exportToExcel;
    window.closeModal = closeModal;
    window.confirmModalAction = confirmModalAction;

    // Start by loading data from Firebase
    loadInitialData();
    navigateTo('dashboard');

};

