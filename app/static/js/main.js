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

    // Token is now set as cookie by the server, just redirect
    window.location.href = "/dashboard";
});


// DASHBOARD
let chartInstance = null;

async function loadChart() {
    const token = getToken() || localStorage.getItem("token");
    
    const sensorId = document.getElementById("chartSensorSelect").value;
    const hours = document.getElementById("timeRange").value;
    
    if (!sensorId) {
        return;
    }

    const res = await fetch(`/measurements/by-sensor/${sensorId}?hours=${hours}`, {
        headers: {
            "Authorization": "Bearer " + token
        }
    });

    const data = await res.json();
    
    if (data.length === 0) {
        document.getElementById("currentValue").textContent = "No data";
        document.getElementById("currentUnit").textContent = "";
        if (chartInstance) {
            chartInstance.destroy();
            chartInstance = null;
        }
        return;
    }

    // Get the latest reading
    const latest = data[data.length - 1];
    document.getElementById("currentValue").textContent = parseFloat(latest.value).toFixed(1);
    
    // Get unit from measurement type
    const sensorRes = await fetch(`/sensors/${sensorId}`, {
        headers: { "Authorization": "Bearer " + token }
    });
    if (sensorRes.ok) {
        const sensor = await sensorRes.json();
        // Need to get measurement type info
        const mtRes = await fetch(`/measurement-types/${sensor.measurement_type_id}`, {
            headers: { "Authorization": "Bearer " + token }
        });
        if (mtRes.ok) {
            const mt = await mtRes.json();
            document.getElementById("currentUnit").textContent = mt.unit;
        }
    }

    const labels = data.map(x => x.ts);
    const values = data.map(x => x.value);

    const ctx = document.getElementById('chart').getContext('2d');
    
    if (chartInstance) {
        chartInstance.destroy();
    }

    chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Value',
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
                    ticks: { maxTicksLimit: 10 }
                }
            }
        }
    });
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
    if (document.getElementById("chart")) {
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
        
        // Populate chart sensor dropdown with all sensors
        const chartSensorSelect = document.getElementById("chartSensorSelect");
        if (chartSensorSelect && typeof devices !== 'undefined') {
            // Fetch all sensors
            fetch("/sensors", {
                headers: { "Authorization": "Bearer " + (getToken() || localStorage.getItem("token")) }
            })
            .then(res => res.json())
            .then(sensors => {
                sensors.forEach(sensor => {
                    const option = document.createElement("option");
                    option.value = sensor.id;
                    option.textContent = sensor.name;
                    chartSensorSelect.appendChild(option);
                });
            });
        }
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