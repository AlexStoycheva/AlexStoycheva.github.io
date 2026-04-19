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
async function loadChart() {
    const token = getToken() || localStorage.getItem("token");

    const res = await fetch('/measurements/by-sensor/1', {
        headers: {
            "Authorization": "Bearer " + token
        }
    });

    const data = await res.json();

    const labels = data.map(x => x.ts);
    const values = data.map(x => x.value);

    new Chart(document.getElementById('chart'), {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Temperature',
                data: values
            }]
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

    document.getElementById("user-info").innerText =
        `Logged in as: ${data.email}`;
}


// LOGOUT
function logout() {
    // Clear cookie
    document.cookie = "token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    localStorage.removeItem("token");
    window.location.href = "/";
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

    await fetch("/alert-rules", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + token
        },
        body: JSON.stringify(payload)
    });

    alert("Alert saved!");
}

window.addEventListener("DOMContentLoaded", () => {
    if (document.getElementById("chart")) {
        loadChart();
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