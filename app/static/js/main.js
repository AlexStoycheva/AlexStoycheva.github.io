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
    const maxValue = document.getElementById("maxValue").value;

    await fetch("/alert-rules", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + token
        },
        body: JSON.stringify({
            sensor_id: 1,
            max_value: parseFloat(maxValue)
        })
    });

    alert("Saved");
}

window.addEventListener("DOMContentLoaded", () => {
    if (document.getElementById("chart")) {
        loadChart();
        loadUser();
    }
});