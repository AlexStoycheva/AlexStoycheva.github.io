// Helper function to get token from cookie
function getToken() {
    const name = "token=";
    const decodedCookie = decodeURIComponent(document.cookie);
    const ca = decodedCookie.split(';');
    for(let i = 0; i < ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) == ' ') {
            c = c.substring(1);
        }
        if (c.indexOf(name) == 0) {
            return c.substring(name.length, c.length);
        }
    }
    return null;
}

// LOGIN
document.getElementById("loginForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;

    const res = await fetch("/login", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ email, password })
    });

    if (!res.ok) {
        document.getElementById("error").innerText = "Invalid login";
        return;
    }

    // Get token for FastAPI docs
    const data = await res.json();
    console.log("Your API token (for FastAPI docs):", data.access_token);
    console.log("Use: Bearer " + data.access_token);

    // Token is now set as cookie by the server, just redirect
    window.location.href = "/dashboard";
});


// DASHBOARD - Multiple charts
let chartInstances = {};

async function loadAllCharts() {
    const token = getToken() || localStorage.getItem("token");
    const hours = document.getElementById("timeRange").value;
    const container = document.getElementById("chartsContainer");
    
    // Destroy existing charts
    Object.values(chartInstances).forEach(chart => chart.destroy());
    chartInstances = {};
    
    // Get all sensors for user
    const sensorsRes = await fetch("/sensors", {
        headers: { "Authorization": "Bearer " + token }
    });
    const sensors = await sensorsRes.json();
    
    if (sensors.length === 0) {
        container.innerHTML = "<p>No sensors available.</p>";
        return;
    }
    
    container.innerHTML = "";
    
    // Get measurement types for units
    const mtRes = await fetch("/measurement-types");
    const measurementTypes = await mtRes.json();
    const mtMap = {};
    measurementTypes.forEach(mt => mtMap[mt.id] = mt);
    
    // Create a chart for each sensor
    for (const sensor of sensors) {
        // Create card
        const card = document.createElement("div");
        card.className = "chart-card";
        card.onclick = () => expandChart(sensor.id);
        card.innerHTML = `
            <h4>${sensor.name}</h4>
            <div class="current-value" id="value-${sensor.id}">--<span class="unit"></span></div>
            <canvas id="chart-${sensor.id}"></canvas>
        `;
        container.appendChild(card);
        
        // Fetch measurements
        const res = await fetch(`/measurements/by-sensor/${sensor.id}?hours=${hours}`, {
            headers: { "Authorization": "Bearer " + token }
        });
        const data = await res.json();
        
        // Update current value
        const valueEl = document.getElementById(`value-${sensor.id}`);
        if (data.length > 0) {
            const latest = data[data.length - 1];
            const mt = mtMap[sensor.measurement_type_id];
            valueEl.innerHTML = `${parseFloat(latest.value).toFixed(1)}<span class="unit"> ${mt ? mt.unit : ''}</span>`;
        } else {
            valueEl.innerHTML = "No data<span class='unit'></span>";
        }
        
        // Create chart
        const labels = data.map(x => x.ts);
        const values = data.map(x => x.value);
        
        const ctx = document.getElementById(`chart-${sensor.id}`).getContext('2d');
        chartInstances[sensor.id] = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: sensor.name,
                    data: values,
                    borderColor: '#4CAF50',
                    backgroundColor: 'rgba(76, 175, 80, 0.1)',
                    fill: true,
                    tension: 0.3
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    x: { 
                        ticks: { maxTicksLimit: 8 }
                    }
                }
            }
        });
    }
}

// Expand chart to fullscreen modal
async function expandChart(sensorId) {
    const token = getToken() || localStorage.getItem("token");
    const hours = document.getElementById("timeRange").value;
    
    // Get sensor info
    const sensorRes = await fetch(`/sensors/${sensorId}`, {
        headers: { "Authorization": "Bearer " + token }
    });
    const sensor = await sensorRes.json();
    
    // Get measurement type
    const mtRes = await fetch(`/measurement-types/${sensor.measurement_type_id}`, {
        headers: { "Authorization": "Bearer " + token }
    });
    const mt = await mtRes.json();
    
    // Get measurements
    const dataRes = await fetch(`/measurements/by-sensor/${sensorId}?hours=${hours}`, {
        headers: { "Authorization": "Bearer " + token }
    });
    const data = await dataRes.json();
    
    // Show modal
    const overlay = document.getElementById("modalOverlay");
    let modal = document.getElementById("expandChartModal");
    
    if (!modal) {
        overlay.innerHTML += `
            <div id="expandChartModal" class="modal" style="width: 90%; max-width: 1000px;">
                <div class="modal-header">
                    <h3 id="expandChartTitle">Chart</h3>
                    <button type="button" class="close-modal" onclick="closeExpandModal()">×</button>
                </div>
                <div class="modal-body">
                    <div class="current-value" id="expandCurrentValue" style="text-align: center; margin-bottom: 20px;"></div>
                    <canvas id="expandChart"></canvas>
                </div>
            </div>
        `;
        modal = document.getElementById("expandChartModal");
    }
    
    document.getElementById("expandChartTitle").textContent = sensor.name;
    
    // Current value
    const valueEl = document.getElementById("expandCurrentValue");
    if (data.length > 0) {
        const latest = data[data.length - 1];
        valueEl.innerHTML = `Current: <strong>${parseFloat(latest.value).toFixed(1)} ${mt.unit}</strong>`;
    } else {
        valueEl.innerHTML = "No data";
    }
    
    overlay.style.display = "flex";
    modal.style.display = "block";
    
    // Create expanded chart
    const labels = data.map(x => x.ts);
    const values = data.map(x => x.value);
    
    const ctx = document.getElementById("expandChart").getContext('2d');
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: sensor.name,
                data: values,
                borderColor: '#4CAF50',
                backgroundColor: 'rgba(76, 175, 80, 0.1)',
                fill: true,
                tension: 0.3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                x: { 
                    ticks: { maxTicksLimit: 15 }
                }
            }
        }
    });
}

function closeExpandModal() {
    document.getElementById("modalOverlay").style.display = "none";
    document.getElementById("expandChartModal").style.display = "none";
}


// USER INFO
async function loadUser() {
    const token = getToken() || localStorage.getItem("token");

    const res = await fetch("/me", {
        headers: {
            "Authorization": "Bearer " + token
        }
    });

    const data = await res.json();

    const userInfoEl = document.getElementById("user-info");
    if (userInfoEl) {
        userInfoEl.innerText = `Logged in as: ${data.email}`;
    }
}


// LOGOUT
async function logout() {
    const token = getToken() || localStorage.getItem("token");
    
    await fetch("/logout", {
        method: "POST",
        headers: {
            "Authorization": "Bearer " + token
        }
    });
    
    localStorage.removeItem("token");
    window.location.href = "/login-page";
}


// ALERT CREATE
async function createAlert() {
    const token = getToken() || localStorage.getItem("token");
    
    const sensorId = document.getElementById("sensorSelect").value;
    const alertType = document.getElementById("alertType").value;
    const alertValue = document.getElementById("alertValue").value;

    if (!sensorId || !alertValue) {
        alert("Please fill all fields");
        return;
    }

    const payload = {
        sensor_id: parseInt(sensorId),
    };

    if (alertType === "max") {
        payload.max_value = parseFloat(alertValue);
    } else {
        payload.min_value = parseFloat(alertValue);
    }

    const res = await fetch("/alert-rules", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + token
        },
        body: JSON.stringify(payload)
    });

    if (res.ok) {
        alert("Alert saved!");
    } else {
        const error = await res.json();
        alert("Error: " + (error.detail || "Failed to create alert"));
    }
}

window.addEventListener("DOMContentLoaded", () => {
    if (document.getElementById("chartsContainer")) {
        loadUser();
        
        // Populate devices dropdown
        const deviceSelect = document.getElementById("deviceSelect");
        if (deviceSelect && typeof devices !== 'undefined') {
            devices.forEach(device => {
                const option = document.createElement("option");
                option.value = device.id;
                option.textContent = `${device.name} (${device.location})`;
                deviceSelect.appendChild(option);
            });
        }
        
        // Populate measurement types dropdown
        const measurementTypeSelect = document.getElementById("measurementTypeSelect");
        if (measurementTypeSelect && typeof measurementTypes !== 'undefined') {
            measurementTypes.forEach(mt => {
                const option = document.createElement("option");
                option.value = mt.id;
                option.textContent = `${mt.name} (${mt.unit})`;
                measurementTypeSelect.appendChild(option);
            });
        }
        
        // Load all charts for all sensors
        loadAllCharts();
    }
});

// Load sensors when device is selected
async function loadSensors() {
    const deviceId = document.getElementById("deviceSelect").value;
    const measurementTypeId = document.getElementById("measurementTypeSelect").value;
    const sensorSelect = document.getElementById("sensorSelect");
    
    // Clear existing options
    sensorSelect.innerHTML = '<option value="">Select Sensor</option>';
    
    if (!deviceId || !measurementTypeId) return;
    
    const token = getToken() || localStorage.getItem("token");
    
    const res = await fetch(`/sensors?device_id=${deviceId}&measurement_type_id=${measurementTypeId}`, {
        headers: {
            "Authorization": "Bearer " + token
        }
    });
    
    const sensors = await res.json();
    
    sensors.forEach(sensor => {
        const option = document.createElement("option");
        option.value = sensor.id;
        option.textContent = sensor.name;
        sensorSelect.appendChild(option);
    });
}

function updateSensorOptions() {
    loadSensors();
}

// ========== MANAGEMENT MODALS ==========

function closeModals() {
    document.getElementById("modalOverlay").style.display = "none";
    document.querySelectorAll(".modal").forEach(m => m.style.display = "none");
}

// Show Add Device Modal
async function showAddDeviceModal() {
    closeModals();
    document.getElementById("modalOverlay").style.display = "flex";
    document.getElementById("addDeviceModal").style.display = "block";
    
    // Populate measurement type checkboxes
    const container = document.getElementById("sensorCheckboxes");
    container.innerHTML = "";
    
    if (typeof measurementTypes !== 'undefined') {
        measurementTypes.forEach(mt => {
            const label = document.createElement("label");
            label.innerHTML = `<input type="checkbox" value="${mt.id}"> ${mt.name} (${mt.unit})`;
            container.appendChild(label);
        });
    }
}

// Create Device with Sensors
async function createDevice() {
    const token = getToken() || localStorage.getItem("token");
    
    const name = document.getElementById("newDeviceName").value;
    const serial = document.getElementById("newDeviceSerial").value;
    const location = document.getElementById("newDeviceLocation").value;
    
    // Get selected measurement types
    const checkboxes = document.querySelectorAll("#sensorCheckboxes input:checked");
    const selectedTypes = Array.from(checkboxes).map(cb => parseInt(cb.value));
    
    if (!name) {
        alert("Please enter a device name");
        return;
    }
    if (selectedTypes.length === 0) {
        alert("Please select at least one sensor type");
        return;
    }
    
    // Create device first
    const deviceRes = await fetch("/devices", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + token
        },
        body: JSON.stringify({
            name: name,
            serial_number: serial,
            location_name: location
        })
    });
    
    if (!deviceRes.ok) {
        const err = await deviceRes.json();
        alert("Error creating device: " + (err.detail || "Unknown error"));
        return;
    }
    
    const device = await deviceRes.json();
    
    // Create sensors for each selected measurement type
    for (const measTypeId of selectedTypes) {
        const measType = measurementTypes.find(mt => mt.id === measTypeId);
        await fetch("/sensors", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + token
            },
            body: JSON.stringify({
                device_id: device.id,
                measurement_type_id: measTypeId,
                name: `${name} - ${measType.name}`,
                location: location || "unknown"
            })
        });
    }
    
    alert("Device and sensors created successfully!");
    closeModals();
    location.reload();
}

// Show Add Measurement Type Modal
function showAddMeasurementTypeModal() {
    closeModals();
    document.getElementById("modalOverlay").style.display = "flex";
    document.getElementById("addMeasurementTypeModal").style.display = "block";
}

// Create Measurement Type
async function createMeasurementType() {
    const token = getToken() || localStorage.getItem("token");
    
    const name = document.getElementById("newMeasTypeName").value.trim();
    const unit = document.getElementById("newMeasTypeUnit").value.trim();
    
    if (!name || !unit) {
        alert("Please enter both name and unit");
        return;
    }
    
    const res = await fetch("/measurement-types", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + token
        },
        body: JSON.stringify({ name, unit })
    });
    
    if (res.ok) {
        alert("Measurement type created!");
        closeModals();
        location.reload();
    } else {
        const err = await res.json();
        alert("Error: " + (err.detail || "Failed to create measurement type"));
    }
}

// Show Remove Sensor Modal
async function showRemoveSensorModal() {
    closeModals();
    document.getElementById("modalOverlay").style.display = "flex";
    document.getElementById("removeSensorModal").style.display = "block";
    
    const token = getToken() || localStorage.getItem("token");
    const select = document.getElementById("sensorToRemove");
    select.innerHTML = "<option value=''>Loading...</option>";
    
    const res = await fetch("/sensors", {
        headers: { "Authorization": "Bearer " + token }
    });
    const sensors = await res.json();
    
    select.innerHTML = "";
    sensors.forEach(sensor => {
        const option = document.createElement("option");
        option.value = sensor.id;
        option.textContent = sensor.name;
        select.appendChild(option);
    });
}

// Delete Sensor
async function deleteSensor() {
    const token = getToken() || localStorage.getItem("token");
    const sensorId = document.getElementById("sensorToRemove").value;
    
    if (!sensorId) {
        alert("Please select a sensor");
        return;
    }
    
    const res = await fetch(`/sensors/${sensorId}`, {
        method: "DELETE",
        headers: { "Authorization": "Bearer " + token }
    });
    
    if (res.ok) {
        alert("Sensor deleted!");
        closeModals();
        location.reload();
    } else {
        const err = await res.json();
        alert("Error: " + (err.detail || "Failed to delete sensor"));
    }
}

// Show Remove Device Modal
async function showRemoveDeviceModal() {
    closeModals();
    document.getElementById("modalOverlay").style.display = "flex";
    document.getElementById("removeDeviceModal").style.display = "block";
    
    const token = getToken() || localStorage.getItem("token");
    const select = document.getElementById("deviceToRemove");
    select.innerHTML = "<option value=''>Loading...</option>";
    
    const res = await fetch("/devices", {
        headers: { "Authorization": "Bearer " + token }
    });
    const devices = await res.json();
    
    select.innerHTML = "";
    devices.forEach(device => {
        const option = document.createElement("option");
        option.value = device.id;
        option.textContent = `${device.name} (${device.location || 'no location'})`;
        select.appendChild(option);
    });
}

// Delete Device
async function deleteDevice() {
    const token = getToken() || localStorage.getItem("token");
    const deviceId = document.getElementById("deviceToRemove").value;
    
    if (!deviceId) {
        alert("Please select a device");
        return;
    }
    
    if (!confirm("Are you sure? This will delete all sensors for this device!")) {
        return;
    }
    
    const res = await fetch(`/devices/${deviceId}`, {
        method: "DELETE",
        headers: { "Authorization": "Bearer " + token }
    });
    
    if (res.ok) {
        alert("Device deleted!");
        closeModals();
        location.reload();
    } else {
        const err = await res.json();
        alert("Error: " + (err.detail || "Failed to delete device"));
    }
}

// Show Alerts Modal
async function showAlertsModal() {
    closeModals();
    document.getElementById("modalOverlay").style.display = "flex";
    document.getElementById("alertsModal").style.display = "block";
    
    const token = getToken() || localStorage.getItem("token");
    const container = document.getElementById("alertsList");
    container.innerHTML = "Loading...";
    
    // Get user's sensors first
    const sensorsRes = await fetch("/sensors", {
        headers: { "Authorization": "Bearer " + token }
    });
    const sensors = await sensorsRes.json();
    const sensorIds = sensors.map(s => s.id);
    
    // Get all alert rules
    const rulesRes = await fetch("/alert-rules", {
        headers: { "Authorization": "Bearer " + token }
    });
    const rules = await rulesRes.json();
    
    // Filter to user's sensors (or all if admin)
    const userRules = rules.filter(r => sensorIds.includes(r.sensor_id));
    
    if (userRules.length === 0) {
        container.innerHTML = "<p>No alerts found.</p>";
        return;
    }
    
    // Get sensor names for display
    const sensorMap = {};
    sensors.forEach(s => sensorMap[s.id] = s.name);
    
    container.innerHTML = userRules.map(rule => `
        <div class="alert-item">
            <div class="alert-sensor">Sensor: ${sensorMap[rule.sensor_id] || 'Unknown'}</div>
            <div class="alert-rule">
                ${rule.min_value ? `Min: ${rule.min_value}` : ''}
                ${rule.max_value ? `Max: ${rule.max_value}` : ''}
            </div>
            <div class="alert-status ${rule.is_active ? 'active' : 'resolved'}">
                ${rule.is_active ? 'Active' : 'Inactive'}
            </div>
        </div>
    `).join("");
}