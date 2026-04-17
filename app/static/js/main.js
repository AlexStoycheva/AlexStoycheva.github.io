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

    const data = await res.json();
    localStorage.setItem("token", data.access_token);
    window.location.href = "/dashboard";
});


// DASHBOARD
async function loadChart() {
    const token = localStorage.getItem("token");

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
    const token = localStorage.getItem("token");

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
    localStorage.removeItem("token");
    window.location.href = "/login-page";
}


// ALERT CREATE
async function createAlert() {
    const token = localStorage.getItem("token");
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