const SENSOR_COLORS = {
    1: { border: "#2ecc71", bg: "rgba(46, 204, 113, 0.2)" },
    2: { border: "#3498db", bg: "rgba(52, 152, 219, 0.2)" },
    3: { border: "#e67e22", bg: "rgba(230, 126, 34, 0.2)" },
    4: { border: "#9b59b6", bg: "rgba(155, 89, 182, 0.2)" }
};

const UNIT_MAP = {
    celsius: "°C",
    fahrenheit: "°F",
    percent: "%",
    pressure: "hPa"
};

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

    const data = await res.json();
    console.log("Your API token (for FastAPI docs):", data.access_token);
    console.log("Use: Bearer " + data.access_token);

    window.location.href = "/dashboard";
});


let chartInstances = {};

function capitalizeFirstLetter(val) {
    return String(val).charAt(0).toUpperCase() + String(val).slice(1);
}

async function loadAllCharts() {
    const token = getToken() || localStorage.getItem("token");
    const hours = document.getElementById("timeRange").value;
    const container = document.getElementById("chartsContainer");
    
    Object.values(chartInstances).forEach(chart => chart.destroy());
    chartInstances = {};
    
    const sensorsRes = await fetch("/sensors", {
        headers: { "Authorization": "Bearer " + token }
    });
    const sensors = await sensorsRes.json();
    
    if (sensors.length === 0) {
        container.innerHTML = "<p>No sensors available.</p>";
        return;
    }
    
    container.innerHTML = "";
    
    const mtRes = await fetch("/measurement-types");
    const measurementTypes = await mtRes.json();
    const mtMap = {};
    measurementTypes.forEach(mt => mtMap[mt.id] = mt);
    
    for (const sensor of sensors) {
        const card = document.createElement("div");
        card.className = "chart-card";
        card.onclick = () => expandChart(sensor.id);
        card.innerHTML = `
            <h4>${sensor.name} - ${capitalizeFirstLetter(sensor.location)}</h4>
            <div class="current-value" id="value-${sensor.id}">--<span class="unit"></span></div>
            <canvas id="chart-${sensor.id}"></canvas>
        `;
        container.appendChild(card);
        
        const res = await fetch(`/measurements/by-sensor/${sensor.id}?hours=${hours}`, {
            headers: { "Authorization": "Bearer " + token }
        });
        const data = await res.json();
        const colors = SENSOR_COLORS[sensor.measurement_type_id] || { border: "#95a5a6", bg: "rgba(149, 165, 166, 0.2)"};
        const valueEl = document.getElementById(`value-${sensor.id}`);

        if (data.length > 0) {
            const latest = data[data.length - 1];
            const mt = mtMap[sensor.measurement_type_id];
            const unit = mt ? UNIT_MAP[mt.unit] || mt.unit : '';
            valueEl.innerHTML = `${parseFloat(latest.value).toFixed(1)}<span class="unit"> ${unit}</span>`;
            valueEl.style.color = colors.border;
        } else {
            valueEl.innerHTML = "No data<span class='unit'></span>";
        }
        
        const labels = data.map(x => formatTime(x.ts));
        const values = data.map(x => x.value);
        
        const ctx = document.getElementById(`chart-${sensor.id}`).getContext('2d');
        chartInstances[sensor.id] = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: sensor.name,
                    data: values,
                    borderColor: colors.border,
                    backgroundColor: colors.bg,
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

function formatTime(ts) {
    const date = new Date(ts);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

async function expandChart(sensorId) {
    const token = getToken() || localStorage.getItem("token");
    const hours = document.getElementById("timeRange").value;
    
    const sensorRes = await fetch(`/sensors/${sensorId}`, {
        headers: { "Authorization": "Bearer " + token }
    });
    const sensor = await sensorRes.json();
    
    const mtRes = await fetch(`/measurement-types/${sensor.measurement_type_id}`, {
        headers: { "Authorization": "Bearer " + token }
    });
    const mt = await mtRes.json();
    
    const dataRes = await fetch(`/measurements/by-sensor/${sensorId}?hours=${hours}`, {
        headers: { "Authorization": "Bearer " + token }
    });
    const data = await dataRes.json();
    
    const overlay = document.getElementById("modalOverlay");
    let modal = document.getElementById("expandChartModal");
    
    if (!modal) {
        overlay.innerHTML += `
            <div id="expandChartModal" class="modal" style="width: 90%; max-width: 1100px; max-height: 80vh;">
                <div class="modal-header">
                    <h3 id="expandChartTitle">Chart</h3>
                    <button type="button" class="close-modal" onclick="closeExpandModal()">×</button>
                </div>
                <div class="modal-body" style="max-height: calc(80vh - 60px); overflow-y: auto;">
                    <div class="current-value" id="expandCurrentValue" style="text-align: center; margin-bottom: 15px;"></div>
                    <canvas id="expandChart" style="max-height: 50vh;"></canvas>
                </div>
            </div>
        `;
        modal = document.getElementById("expandChartModal");
    }
    
    document.getElementById("expandChartTitle").textContent = sensor.name;
    
    const valueEl = document.getElementById("expandCurrentValue");
    if (data.length > 0) {
        const latest = data[data.length - 1];
        valueEl.innerHTML = `Current: <strong>${parseFloat(latest.value).toFixed(1)} ${mt.unit}</strong>`;
    } else {
        valueEl.innerHTML = "No data";
    }
    
    overlay.style.display = "flex";
    modal.style.display = "block";
    
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

window.addEventListener("DOMContentLoaded", () => {
    if (document.getElementById("chartsContainer")) {
        loadUser();
        
        const deviceSelect = document.getElementById("deviceSelect");
        if (deviceSelect && typeof devices !== 'undefined') {
            devices.forEach(device => {
                const option = document.createElement("option");
                option.value = device.id;
                option.textContent = `${device.name} (${device.location})`;
                deviceSelect.appendChild(option);
            });
        }
        
        const measurementTypeSelect = document.getElementById("measurementTypeSelect");
        if (measurementTypeSelect && typeof measurementTypes !== 'undefined') {
            measurementTypes.forEach(mt => {
                const option = document.createElement("option");
                option.value = mt.id;
                option.textContent = `${mt.name} (${mt.unit})`;
                measurementTypeSelect.appendChild(option);
            });
        }
        
        loadAllCharts();
    }
});

async function loadSensors() {
    const deviceId = document.getElementById("deviceSelect").value;
    const measurementTypeId = document.getElementById("measurementTypeSelect").value;
    const sensorSelect = document.getElementById("sensorSelect");
    
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

function closeModals() {
    document.getElementById("modalOverlay").style.display = "none";
    document.querySelectorAll(".modal").forEach(m => m.style.display = "none");
}

async function showAddDeviceModal() {
    closeModals();
    document.getElementById("modalOverlay").style.display = "flex";
    document.getElementById("addDeviceModal").style.display = "block";
    
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

async function createDevice() {
    const token = getToken() || localStorage.getItem("token");
    
    const name = document.getElementById("newDeviceName").value;
    const serial = document.getElementById("newDeviceSerial").value;
    const passkey = document.getElementById("newDevicePasskey").value;
    const location = document.getElementById("newDeviceLocation").value;
    
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
    
    const deviceRes = await fetch("/devices", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + token
        },
        body: JSON.stringify({
            name: name,
            passkey: passkey,
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
    window.location.reload();
}

function showAddMeasurementTypeModal() {
    closeModals();
    document.getElementById("modalOverlay").style.display = "flex";
    document.getElementById("addMeasurementTypeModal").style.display = "block";
}

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

async function showAlertsModal() {
    closeModals();
    document.getElementById("modalOverlay").style.display = "flex";
    document.getElementById("alertsModal").style.display = "block";
    
    const token = getToken() || localStorage.getItem("token");
    const container = document.getElementById("alertsList");
    const sensorSelect = document.getElementById("newAlertSensor");
    container.innerHTML = "Loading...";
    
    const sensorsRes = await fetch("/sensors", {
        headers: { "Authorization": "Bearer " + token }
    });
    const sensors = await sensorsRes.json();
    const sensorIds = sensors.map(s => s.id);
    
    sensorSelect.innerHTML = '<option value="">Select Sensor</option>' + 
        sensors.map(s => `<option value="${s.id}">${s.name}</option>`).join("");
    
    const rulesRes = await fetch("/alert-rules", {
        headers: { "Authorization": "Bearer " + token }
    });
    const rules = await rulesRes.json();
    
    const userRules = rules.filter(r => sensorIds.includes(r.sensor_id));
    
    if (userRules.length === 0) {
        container.innerHTML = "<p>No alerts found.</p>";
        return;
    }
    
    const sensorMap = {};
    sensors.forEach(s => sensorMap[s.id] = s.name);
    
    container.innerHTML = userRules.map(rule => `
        <div class="alert-item" data-id="${rule.id}">
            <div class="alert-item-content">
                <div class="alert-sensor">Sensor: ${sensorMap[rule.sensor_id] || 'Unknown'}</div>
                <div class="alert-rule">
                    ${rule.min_value ? `Min: ${rule.min_value}` : ''}
                    ${rule.max_value ? `Max: ${rule.max_value}` : ''}
                </div>
                <div class="alert-status ${rule.is_active ? 'active' : 'resolved'}">
                    ${rule.is_active ? 'Active' : 'Inactive'}
                </div>
            </div>
            <div class="alert-item-actions">
                <button class="edit-btn" onclick="editAlert(${rule.id}, ${rule.sensor_id}, ${rule.min_value || 'null'}, ${rule.max_value || 'null'}, ${rule.is_active})">Edit</button>
                <button class="delete-btn" onclick="deleteAlert(${rule.id})">Delete</button>
            </div>
        </div>
    `).join("");
}

async function createAlertFromModal() {
    const token = getToken() || localStorage.getItem("token");
    const sensor_id = document.getElementById("newAlertSensor").value;
    const alertType = document.getElementById("newAlertType").value;
    const value = parseFloat(document.getElementById("newAlertValue").value);
    
    if (!sensor_id || isNaN(value)) {
        alert("Please select a sensor and enter a value");
        return;
    }
    
    const payload = {
        sensor_id: parseInt(sensor_id),
        min_value: alertType === "min" ? value : null,
        max_value: alertType === "max" ? value : null
    };
    
    try {
        const res = await fetch("/alert-rules", {
            method: "POST",
            headers: {
                "Authorization": "Bearer " + token,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });
        
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.detail || "Failed to create alert");
        }
        
        document.getElementById("newAlertSensor").value = "";
        document.getElementById("newAlertValue").value = "";
        
        showAlertsModal();
    } catch (err) {
        alert("Error: " + err.message);
    }
}

async function editAlert(ruleId, sensorId, minValue, maxValue, isActive) {
    const token = getToken() || localStorage.getItem("token");
    
    const sensorsRes = await fetch("/sensors", {
        headers: { "Authorization": "Bearer " + token }
    });
    const sensors = await sensorsRes.json();
    
    const currentMin = minValue === 'null' ? '' : minValue;
    const currentMax = maxValue === 'null' ? '' : maxValue;
    const alertType = maxValue !== 'null' ? 'max' : 'min';
    const currentValue = maxValue !== 'null' ? maxValue : minValue;
    
    const newSensorId = prompt("Sensor ID:", sensorId);
    if (newSensorId === null) return;
    
    const newAlertType = prompt("Alert type (max/min):", alertType);
    if (newAlertType === null) return;
    
    const newValue = prompt("Value:", currentValue);
    if (newValue === null) return;
    
    const payload = {
        sensor_id: parseInt(newSensorId),
        min_value: newAlertType === "min" ? parseFloat(newValue) : null,
        max_value: newAlertType === "max" ? parseFloat(newValue) : null
    };
    
    try {
        const res = await fetch(`/alert-rules/${ruleId}`, {
            method: "PUT",
            headers: {
                "Authorization": "Bearer " + token,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });
        
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.detail || "Failed to update alert");
        }
        
        showAlertsModal();
    } catch (err) {
        alert("Error: " + err.message);
    }
}

async function deleteAlert(ruleId) {
    if (!confirm("Are you sure you want to delete this alert rule?")) return;
    
    const token = getToken() || localStorage.getItem("token");
    
    try {
        const res = await fetch(`/alert-rules/${ruleId}`, {
            method: "DELETE",
            headers: { "Authorization": "Bearer " + token }
        });
        
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.detail || "Failed to delete alert");
        }
        
        showAlertsModal();
    } catch (err) {
        alert("Error: " + err.message);
    }
}