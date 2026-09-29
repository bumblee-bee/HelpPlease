let token = localStorage.getItem("helpPleaseToken");
let currentUser = JSON.parse(
    localStorage.getItem("helpPleaseUser") || "null"
);

let messageBox = document.getElementById("message");

function showMessage(text) {
    if (!messageBox) {
        console.log(text);
        return;
    }

    messageBox.innerHTML = `<div class="message-box">${text}</div>`;

    setTimeout(() => {
        if (messageBox) {
            messageBox.innerHTML = "";
        }
    }, 3000);
}


/* ================================
   AUTH SCREEN
================================ */

function showLogin() {
    const loginForm = document.getElementById("loginForm");
    const registerForm = document.getElementById("registerForm");
    const volunteerForm = document.getElementById("volunteerForm");

    if (loginForm) loginForm.classList.remove("hidden");
    if (registerForm) registerForm.classList.add("hidden");
    if (volunteerForm) volunteerForm.classList.add("hidden");

    const loginTab = document.getElementById("loginTab");
    const registerTab = document.getElementById("registerTab");
    const volunteerTab = document.getElementById("volunteerTab");

    if (loginTab) loginTab.classList.add("active");
    if (registerTab) registerTab.classList.remove("active");
    if (volunteerTab) volunteerTab.classList.remove("active");
}


function showRegister() {
    const loginForm = document.getElementById("loginForm");
    const registerForm = document.getElementById("registerForm");
    const volunteerForm = document.getElementById("volunteerForm");

    if (loginForm) loginForm.classList.add("hidden");
    if (registerForm) registerForm.classList.remove("hidden");
    if (volunteerForm) volunteerForm.classList.add("hidden");

    const loginTab = document.getElementById("loginTab");
    const registerTab = document.getElementById("registerTab");
    const volunteerTab = document.getElementById("volunteerTab");

    if (loginTab) loginTab.classList.remove("active");
    if (registerTab) registerTab.classList.add("active");
    if (volunteerTab) volunteerTab.classList.remove("active");
}


function showVolunteerRegister() {
    const loginForm = document.getElementById("loginForm");
    const registerForm = document.getElementById("registerForm");
    const volunteerForm = document.getElementById("volunteerForm");

    if (loginForm) loginForm.classList.add("hidden");
    if (registerForm) registerForm.classList.add("hidden");
    if (volunteerForm) volunteerForm.classList.remove("hidden");

    const loginTab = document.getElementById("loginTab");
    const registerTab = document.getElementById("registerTab");
    const volunteerTab = document.getElementById("volunteerTab");

    if (loginTab) loginTab.classList.remove("active");
    if (registerTab) registerTab.classList.remove("active");
    if (volunteerTab) volunteerTab.classList.add("active");
}


/* ================================
   APP SCREEN
================================ */

function showApp() {
    const authSection = document.getElementById("authSection");
    const appSection = document.getElementById("appSection");

    if (authSection) authSection.classList.add("hidden");
    if (appSection) appSection.classList.remove("hidden");

    const userInfo = document.getElementById("userInfo");

    if (userInfo && currentUser) {
        userInfo.textContent =
            `${currentUser.name} • ${currentUser.role} • ID: ${currentUser.user_id}`;
    }

    const requestHelpCard =
        document.getElementById("requestHelpCard");

    const requestsTitle =
        document.getElementById("requestsTitle");

    if (currentUser && currentUser.role === "VOLUNTEER") {

        if (requestHelpCard) {
            requestHelpCard.classList.add("hidden");
        }

        if (requestsTitle) {
            requestsTitle.textContent =
                "Available Help Requests";
        }

        startVolunteerLocationTracking();

    } else {

        if (requestHelpCard) {
            requestHelpCard.classList.remove("hidden");
        }

        if (requestsTitle) {
            requestsTitle.textContent =
                "My Help Requests";
        }
    }

    showProfile();
    loadRequests();
}


function showAuth() {
    const authSection = document.getElementById("authSection");
    const appSection = document.getElementById("appSection");

    if (authSection) authSection.classList.remove("hidden");
    if (appSection) appSection.classList.add("hidden");
}


/* ================================
   API
================================ */

async function apiRequest(url, options = {}) {

    const headers = {
        "Content-Type": "application/json",
        ...(options.headers || {})
    };

    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(url, {
        ...options,
        headers
    });

    let data;

    try {
        data = await response.json();
    } catch {
        data = {};
    }

    if (!response.ok) {
        throw new Error(
            data.message || "Something went wrong"
        );
    }

    return data;
}


/* ================================
   PROFILE
================================ */

function showProfile() {

    const profile =
        document.getElementById("profileCard");

    if (!profile || !currentUser) {
        return;
    }

    const firstLetter =
        currentUser.name
            ? currentUser.name.charAt(0).toUpperCase()
            : "?";

    profile.innerHTML = `
        <div class="profile-avatar">
            ${firstLetter}
        </div>

        <div class="profile-details">

            <h2>${escapeHTML(currentUser.name)}</h2>

            <p>${escapeHTML(currentUser.email)}</p>

            <div class="profile-grid">

                <div>
                    <span>User ID</span>
                    <strong>${currentUser.user_id}</strong>
                </div>

                <div>
                    <span>Account</span>
                    <strong>${currentUser.role}</strong>
                </div>

                ${
                    currentUser.volunteer_id
                        ? `
                        <div>
                            <span>Volunteer ID</span>
                            <strong>
                                ${currentUser.volunteer_id}
                            </strong>
                        </div>
                        `
                        : ""
                }

            </div>

        </div>
    `;
}


/* ================================
   LOGIN
================================ */

const loginForm =
    document.getElementById("loginForm");

if (loginForm) {

    loginForm.addEventListener(
        "submit",
        async event => {

            event.preventDefault();

            try {

                const data =
                    await apiRequest("/api/login", {
                        method: "POST",

                        body: JSON.stringify({
                            email:
                                document.getElementById(
                                    "loginEmail"
                                ).value,

                            password:
                                document.getElementById(
                                    "loginPassword"
                                ).value
                        })
                    });

                token = data.token;
                currentUser = data.user;

                localStorage.setItem(
                    "helpPleaseToken",
                    token
                );

                localStorage.setItem(
                    "helpPleaseUser",
                    JSON.stringify(currentUser)
                );

                showMessage("Welcome back!");

                showApp();

            } catch (error) {

                showMessage(error.message);
            }
        }
    );
}


/* ================================
   USER REGISTER
================================ */

const registerForm =
    document.getElementById("registerForm");

if (registerForm) {

    registerForm.addEventListener(
        "submit",
        async event => {

            event.preventDefault();

            try {

                const data =
                    await apiRequest("/api/register", {
                        method: "POST",

                        body: JSON.stringify({
                            name:
                                document.getElementById(
                                    "registerName"
                                ).value,

                            email:
                                document.getElementById(
                                    "registerEmail"
                                ).value,

                            password:
                                document.getElementById(
                                    "registerPassword"
                                ).value
                        })
                    });

                showMessage(data.message);

                registerForm.reset();

                showLogin();

            } catch (error) {

                showMessage(error.message);
            }
        }
    );
}


/* ================================
   VOLUNTEER REGISTER
================================ */

const volunteerForm =
    document.getElementById("volunteerForm");

if (volunteerForm) {

    volunteerForm.addEventListener(
        "submit",
        async event => {

            event.preventDefault();

            try {

                const data =
                    await apiRequest(
                        "/api/register-volunteer",
                        {
                            method: "POST",

                            body: JSON.stringify({
                                name:
                                    document.getElementById(
                                        "volunteerName"
                                    ).value,

                                email:
                                    document.getElementById(
                                        "volunteerEmail"
                                    ).value,

                                password:
                                    document.getElementById(
                                        "volunteerPassword"
                                    ).value,

                                phone:
                                    document.getElementById(
                                        "volunteerPhone"
                                    ).value
                            })
                        }
                    );

                showMessage(
                    `Volunteer created. Volunteer ID: ${data.volunteer.volunteer_id}`
                );

                volunteerForm.reset();

                showLogin();

            } catch (error) {

                showMessage(error.message);
            }
        }
    );
}


/* ================================
   HELP REQUEST
================================ */

const helpForm =
    document.getElementById("helpForm");

if (helpForm) {

    helpForm.addEventListener(
        "submit",
        async event => {

            event.preventDefault();

            try {

                const data =
                    await apiRequest(
                        "/api/help-request",
                        {
                            method: "POST",

                            body: JSON.stringify({

                                task_description:
                                    document.getElementById(
                                        "taskDescription"
                                    ).value,

                                location_text:
                                    document.getElementById(
                                        "locationText"
                                    ).value,

                                latitude:
                                    document.getElementById(
                                        "latitude"
                                    ).value || null,

                                longitude:
                                    document.getElementById(
                                        "longitude"
                                    ).value || null
                            })
                        }
                    );

                showMessage(
                    `Help request #${data.request.request_id} created`
                );

                helpForm.reset();

                loadRequests();

            } catch (error) {

                showMessage(error.message);
            }
        }
    );
}


/* ================================
   LOAD REQUESTS
================================ */

async function loadRequests() {

    if (!token || !currentUser) {
        return;
    }

    try {

        const data =
            await apiRequest("/api/help-requests");

        const container =
            document.getElementById("requestsList");

        if (!container) {
            return;
        }

        container.innerHTML = "";

        let requests = data.requests || [];

        if (currentUser.role === "VOLUNTEER") {

            /*
             * Show pending requests.
             * Also show accepted requests belonging
             * to this volunteer so chat/work-done remains visible.
             */

            requests = requests.filter(request => {

                if (request.status === "PENDING") {
                    return true;
                }

                if (
                    request.status === "ACCEPTED" &&
                    Number(request.accepted_by) ===
                        Number(currentUser.volunteer_id)
                ) {
                    return true;
                }

                return false;
            });

        } else {

            requests = requests.filter(request =>
                Number(request.user_id) ===
                Number(currentUser.user_id)
            );
        }


        if (!requests.length) {

            container.innerHTML = `
                <div class="empty-state">
                    <h3>No requests yet</h3>
                    <p>Help requests will appear here.</p>
                </div>
            `;

            return;
        }


        requests.forEach(request => {

            const card =
                document.createElement("div");

            card.className = "request-card";

            let action = "";


            /* ==========================
               VOLUNTEER ACCEPT
            ========================== */

            if (
                currentUser.role === "VOLUNTEER" &&
                request.status === "PENDING"
            ) {

                action = `
                    <button
                        type="button"
                        onclick="acceptRequest(${request.request_id})"
                    >
                        Accept Request
                    </button>
                `;
            }


            /* ==========================
               VOLUNTEER ACCEPTED
            ========================== */

            if (
                currentUser.role === "VOLUNTEER" &&
                request.status === "ACCEPTED" &&
                Number(request.accepted_by) ===
                    Number(currentUser.volunteer_id)
            ) {

                action = `
                    <div class="request-actions">

                        <button
                            type="button"
                            onclick="openChat(${request.request_id})"
                        >
                            Open Chat
                        </button>

                        <button
                            type="button"
                            onclick="workDone(${request.request_id})"
                        >
                            Work Done
                        </button>

                    </div>
                `;
            }


            /* ==========================
               USER ACCEPTED
            ========================== */

            if (
                currentUser.role !== "VOLUNTEER" &&
                request.status === "ACCEPTED"
            ) {

                action = `
                    <div class="request-actions">

                        <button
                            type="button"
                            onclick="openChat(${request.request_id})"
                        >
                            Open Chat
                        </button>

                        <button
                            type="button"
                            onclick="loadVolunteerLocation(${request.request_id})"
                        >
                            View Volunteer Location
                        </button>

                    </div>
                `;
            }


            /* ==========================
               USER CONFIRMATION
            ========================== */

            if (
                currentUser.role !== "VOLUNTEER" &&
                request.status === "WAITING_CONFIRMATION"
            ) {

                action = `
                    <div class="confirmation-box">

                        <p>
                            Volunteer says the work is done.
                        </p>

                        <button
                            type="button"
                            onclick="openChat(${request.request_id})"
                        >
                            Open Chat
                        </button>

                        <button
                            type="button"
                            onclick="confirmCompletion(${request.request_id})"
                        >
                            Yes, Help Is Done
                        </button>

                    </div>
                `;
            }


            /* ==========================
               COMPLETED
            ========================== */

            if (
                request.status === "COMPLETED"
            ) {

                action = `
                    <div class="completed-box">
                        Help request completed.
                    </div>
                `;
            }


            card.innerHTML = `

                <div class="request-top">

                    <div>

                        <h3>
                            Help Request #${request.request_id}
                        </h3>

                        <p class="requester">
                            ${escapeHTML(
                                request.requester_name || ""
                            )}
                        </p>

                    </div>

                    <span class="status ${String(
                        request.status
                    ).toLowerCase()}">

                        ${String(
                            request.status
                        ).replaceAll("_", " ")}

                    </span>

                </div>


                <div class="request-content">

                    <p>
                        <strong>Help needed:</strong>
                    </p>

                    <p>
                        ${escapeHTML(
                            request.task_description || ""
                        )}
                    </p>

                    <p>
                        <strong>Location:</strong>
                        ${escapeHTML(
                            request.location_text || ""
                        )}
                    </p>

                    <p>
                        <strong>User ID:</strong>
                        ${request.user_id}
                    </p>

                    <p>
                        <strong>Volunteer ID:</strong>
                        ${
                            request.accepted_by ||
                            "Not assigned"
                        }
                    </p>

                </div>

                ${action}
            `;

            container.appendChild(card);
        });

    } catch (error) {

        showMessage(error.message);
    }
}


/* ================================
   ACCEPT REQUEST
================================ */

async function acceptRequest(requestId) {

    try {

        const data =
            await apiRequest(
                `/api/help-request/${requestId}/accept`,
                {
                    method: "POST"
                }
            );

        showMessage(data.message);

        loadRequests();

    } catch (error) {

        showMessage(error.message);
    }
}


/* ================================
   WORK DONE
================================ */

async function workDone(requestId) {

    try {

        const data =
            await apiRequest(
                `/api/help-request/${requestId}/work-done`,
                {
                    method: "POST"
                }
            );

        showMessage(data.message);

        loadRequests();

    } catch (error) {

        showMessage(error.message);
    }
}


/* ================================
   CONFIRM COMPLETION
================================ */

async function confirmCompletion(requestId) {

    try {

        const data =
            await apiRequest(
                `/api/help-request/${requestId}/confirm`,
                {
                    method: "POST"
                }
            );

        showMessage(data.message);

        loadRequests();

    } catch (error) {

        showMessage(error.message);
    }
}


/* ================================
   LOCATION
================================ */

function getUserLocation() {

    if (!navigator.geolocation) {

        showMessage(
            "Location is not supported by this browser"
        );

        return;
    }

    navigator.geolocation.getCurrentPosition(

        position => {

            const latitude =
                document.getElementById("latitude");

            const longitude =
                document.getElementById("longitude");

            if (latitude) {
                latitude.value =
                    position.coords.latitude;
            }

            if (longitude) {
                longitude.value =
                    position.coords.longitude;
            }

            showMessage(
                "Location added successfully"
            );
        },

        () => {

            showMessage(
                "Please allow location access"
            );
        },

        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        }
    );
}


/* ================================
   VOLUNTEER LIVE LOCATION
================================ */

let volunteerLocationTimer = null;

function startVolunteerLocationTracking() {

    if (
        !currentUser ||
        currentUser.role !== "VOLUNTEER"
    ) {
        return;
    }

    if (!navigator.geolocation) {
        return;
    }

    updateVolunteerLocation();

    if (volunteerLocationTimer) {
        clearInterval(volunteerLocationTimer);
    }

    volunteerLocationTimer =
        setInterval(
            updateVolunteerLocation,
            30000
        );
}


function updateVolunteerLocation() {

    if (
        !currentUser ||
        currentUser.role !== "VOLUNTEER"
    ) {
        return;
    }

    navigator.geolocation.getCurrentPosition(

        async position => {

            try {

                await apiRequest(
                    "/api/volunteer/location",
                    {
                        method: "POST",

                        body: JSON.stringify({
                            latitude:
                                position.coords.latitude,

                            longitude:
                                position.coords.longitude
                        })
                    }
                );

            } catch (error) {

                console.log(
                    "Volunteer location update failed:",
                    error.message
                );
            }
        },

        error => {

            console.log(
                "Location permission:",
                error.message
            );
        },

        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 10000
        }
    );
}


/* ================================
   GET VOLUNTEER LOCATION
================================ */

async function loadVolunteerLocation(requestId) {

    try {

        const data =
            await apiRequest(
                `/api/help-request/${requestId}/volunteer-location`
            );

        const volunteer =
            data.volunteer;

        showLocationPanel(
            volunteer,
            requestId
        );

    } catch (error) {

        showMessage(error.message);
    }
}


function showLocationPanel(
    volunteer,
    requestId
) {

    const existing =
        document.getElementById(
            "volunteerLocationPanel"
        );

    if (existing) {
        existing.remove();
    }

    const panel =
        document.createElement("div");

    panel.id =
        "volunteerLocationPanel";

    panel.className =
        "chat-overlay";

    panel.innerHTML = `

        <div class="chat-window">

            <div class="chat-header">

                <div>
                    <strong>
                        Volunteer Location
                    </strong>

                    <small>
                        ${escapeHTML(
                            volunteer.volunteer_name || ""
                        )}
                    </small>
                </div>

                <button
                    type="button"
                    onclick="closeVolunteerLocation()"
                >
                    Close
                </button>

            </div>

            <div class="location-content">

                <p>
                    Latitude:
                    ${volunteer.latitude}
                </p>

                <p>
                    Longitude:
                    ${volunteer.longitude}
                </p>

                ${
                    volunteer.location_updated_at
                        ? `
                        <p>
                            Last updated:
                            ${new Date(
                                volunteer.location_updated_at
                            ).toLocaleString()}
                        </p>
                        `
                        : ""
                }

                <a
                    href="https://www.google.com/maps?q=${volunteer.latitude},${volunteer.longitude}"
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    Open Location in Google Maps
                </a>

            </div>

        </div>
    `;

    document.body.appendChild(panel);
}


function closeVolunteerLocation() {

    const panel =
        document.getElementById(
            "volunteerLocationPanel"
        );

    if (panel) {
        panel.remove();
    }
}


/* ================================
   CHAT
================================ */

async function openChat(requestId) {

    createChatWindow(requestId);

    await loadChatMessages(requestId);
}


function createChatWindow(requestId) {

    const existing =
        document.getElementById(
            "helpPleaseChat"
        );

    if (existing) {
        existing.remove();
    }

    const overlay =
        document.createElement("div");

    overlay.id =
        "helpPleaseChat";

    overlay.className =
        "chat-overlay";

    overlay.innerHTML = `

        <div class="chat-window">

            <div class="chat-header">

                <div>

                    <strong>
                        Help Please Chat
                    </strong>

                    <small>
                        Request #${requestId}
                    </small>

                </div>

                <button
                    type="button"
                    onclick="closeChat()"
                >
                    Close
                </button>

            </div>


            <div
                id="chatMessages"
                class="chat-messages"
            >
                <div class="chat-loading">
                    Loading messages...
                </div>
            </div>


            <form
                id="chatForm"
                class="chat-form"
            >

                <input
                    type="text"
                    id="chatInput"
                    placeholder="Write a message..."
                    autocomplete="off"
                    required
                >

                <button
                    type="submit"
                >
                    Send
                </button>

            </form>

        </div>
    `;

    document.body.appendChild(overlay);

    const chatForm =
        document.getElementById("chatForm");

    if (chatForm) {

        chatForm.addEventListener(
            "submit",
            async event => {

                event.preventDefault();

                await sendChatMessage(requestId);
            }
        );
    }

    const chatInput =
        document.getElementById("chatInput");

    if (chatInput) {
        chatInput.focus();
    }
}


async function loadChatMessages(requestId) {

    const container =
        document.getElementById(
            "chatMessages"
        );

    if (!container) {
        return;
    }

    try {

        const data =
            await apiRequest(
                `/api/chat/${requestId}`
            );

        const messages =
            data.messages || [];

        container.innerHTML = "";

        if (!messages.length) {

            container.innerHTML = `
                <div class="chat-empty">
                    No messages yet.
                </div>
            `;

            return;
        }


        messages.forEach(message => {

            const messageElement =
                document.createElement("div");

            const mine =
                Number(message.sender_id) ===
                Number(currentUser.user_id);

            messageElement.className =
                mine
                    ? "chat-message mine"
                    : "chat-message";

            messageElement.innerHTML = `

                <div class="chat-message-author">
                    ${escapeHTML(
                        message.sender_type || ""
                    )}
                </div>

                <div class="chat-message-text">
                    ${escapeHTML(
                        message.message || ""
                    )}
                </div>

                <div class="chat-message-time">
                    ${
                        message.created_at
                            ? new Date(
                                message.created_at
                              ).toLocaleTimeString(
                                  [],
                                  {
                                      hour: "2-digit",
                                      minute: "2-digit"
                                  }
                              )
                            : ""
                    }
                </div>
            `;

            container.appendChild(
                messageElement
            );
        });

        container.scrollTop =
            container.scrollHeight;

    } catch (error) {

        container.innerHTML = `
            <div class="chat-error">
                ${escapeHTML(error.message)}
            </div>
        `;
    }
}


/* ================================
   SEND CHAT MESSAGE
================================ */

async function sendChatMessage(requestId) {

    const input =
        document.getElementById(
            "chatInput"
        );

    if (!input) {
        return;
    }

    const message =
        input.value.trim();

    if (!message) {
        return;
    }

    input.disabled = true;

    try {

        await apiRequest(
            `/api/chat/${requestId}`,
            {
                method: "POST",

                body: JSON.stringify({
                    message
                })
            }
        );

        input.value = "";

        await loadChatMessages(
            requestId
        );

    } catch (error) {

        showMessage(error.message);

    } finally {

        input.disabled = false;
        input.focus();
    }
}


function closeChat() {

    const chat =
        document.getElementById(
            "helpPleaseChat"
        );

    if (chat) {
        chat.remove();
    }
}


/* ================================
   LOGOUT
================================ */

function logout() {

    if (volunteerLocationTimer) {

        clearInterval(
            volunteerLocationTimer
        );

        volunteerLocationTimer = null;
    }

    closeChat();
    closeVolunteerLocation();

    localStorage.removeItem(
        "helpPleaseToken"
    );

    localStorage.removeItem(
        "helpPleaseUser"
    );

    token = null;
    currentUser = null;

    showAuth();
    showLogin();
}


/* ================================
   ESCAPE HTML
================================ */

function escapeHTML(value) {

    if (value === null ||
        value === undefined) {
        return "";
    }

    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}


/* ================================
   AUTO LOGIN
================================ */

if (token && currentUser) {

    showApp();

} else {

    showAuth();
    showLogin();
}/* ================================
   AUTH TAB BUTTONS
================================ */

document.addEventListener("DOMContentLoaded", () => {

    const loginTab = document.getElementById("loginTab");
    const registerTab = document.getElementById("registerTab");
    const volunteerTab = document.getElementById("volunteerTab");

    if (loginTab) {
        loginTab.addEventListener("click", (event) => {
            event.preventDefault();
            showLogin();
        });
    }

    if (registerTab) {
        registerTab.addEventListener("click", (event) => {
            event.preventDefault();
            showRegister();
        });
    }

    if (volunteerTab) {
        volunteerTab.addEventListener("click", (event) => {
            event.preventDefault();
            showVolunteerRegister();
        });
    }

});
/* =========================================================
   FINAL AUTH + VOLUNTEER LOCATION + CHAT SUPPORT
========================================================= */

document.addEventListener("DOMContentLoaded", () => {

    const loginTab = document.getElementById("loginTab");
    const registerTab = document.getElementById("registerTab");
    const volunteerTab = document.getElementById("volunteerTab");

    if (loginTab) {
        loginTab.onclick = () => showLogin();
    }

    if (registerTab) {
        registerTab.onclick = () => showRegister();
    }

    if (volunteerTab) {
        volunteerTab.onclick = () => showVolunteerRegister();
    }

});


/* =========================================================
   VOLUNTEER LIVE LOCATION
========================================================= */

let locationWatcher = null;

function startVolunteerLocation() {

    if (!currentUser || currentUser.role !== "VOLUNTEER") {
        return;
    }

    if (!navigator.geolocation) {
        showMessage("Location is not supported by this browser.");
        return;
    }

    if (locationWatcher !== null) {
        navigator.geolocation.clearWatch(locationWatcher);
    }

    locationWatcher = navigator.geolocation.watchPosition(
        async position => {

            try {

                await apiRequest("/api/volunteer/location", {
                    method: "POST",
                    body: JSON.stringify({
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude
                    })
                });

            } catch (error) {
                console.error("Location update:", error.message);
            }

        },
        error => {
            console.error("Location permission:", error.message);
        },
        {
            enableHighAccuracy: true,
            maximumAge: 5000,
            timeout: 10000
        }
    );
}


function stopVolunteerLocation() {

    if (locationWatcher !== null) {
        navigator.geolocation.clearWatch(locationWatcher);
        locationWatcher = null;
    }

}


/* =========================================================
   GET VOLUNTEER LOCATION
========================================================= */

async function loadVolunteerLocation(requestId) {

    try {

        const data = await apiRequest(
            `/api/help-request/${requestId}/volunteer-location`
        );

        const volunteer = data.volunteer;

        const existing =
            document.getElementById("volunteerLocationPanel");

        if (existing) {
            existing.remove();
        }

        const panel = document.createElement("div");

        panel.id = "volunteerLocationPanel";
        panel.className = "chat-overlay";

        panel.innerHTML = `
            <div class="chat-window">

                <div class="chat-header">

                    <div>
                        <strong>Volunteer Location</strong>
                        <small>
                            ${escapeHTML(
                                volunteer.volunteer_name || "Volunteer"
                            )}
                        </small>
                    </div>

                    <button
                        type="button"
                        onclick="closeVolunteerLocation()"
                    >
                        Close
                    </button>

                </div>

                <div class="location-content">

                    <p>
                        Latitude:
                        ${volunteer.latitude}
                    </p>

                    <p>
                        Longitude:
                        ${volunteer.longitude}
                    </p>

                    <p>
                        Last updated:
                        ${
                            volunteer.location_updated_at
                                ? new Date(
                                    volunteer.location_updated_at
                                ).toLocaleString()
                                : "Unknown"
                        }
                    </p>

                    <a
                        href="https://www.google.com/maps?q=${volunteer.latitude},${volunteer.longitude}"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        Open Location in Google Maps
                    </a>

                </div>

            </div>
        `;

        document.body.appendChild(panel);

    } catch (error) {

        showMessage(error.message);

    }

}


function closeVolunteerLocation() {

    const panel =
        document.getElementById("volunteerLocationPanel");

    if (panel) {
        panel.remove();
    }

}


/* =========================================================
   PATCH SHOW APP
========================================================= */

const originalShowApp = showApp;

showApp = function () {

    originalShowApp();

    if (
        currentUser &&
        currentUser.role === "VOLUNTEER"
    ) {
        startVolunteerLocation();
    }

};


/* =========================================================
   PATCH LOGOUT
========================================================= */

const originalLogout = logout;

logout = function () {

    stopVolunteerLocation();

    originalLogout();

};


/* =========================================================
   CHAT
========================================================= */

async function openChat(requestId) {

    const oldChat =
        document.getElementById("helpPleaseChat");

    if (oldChat) {
        oldChat.remove();
    }

    const overlay = document.createElement("div");

    overlay.id = "helpPleaseChat";
    overlay.className = "chat-overlay";

    overlay.innerHTML = `
        <div class="chat-window">

            <div class="chat-header">

                <div>
                    <strong>Help Please Chat</strong>
                    <small>
                        Request #${requestId}
                    </small>
                </div>

                <button
                    type="button"
                    onclick="closeChat()"
                >
                    Close
                </button>

            </div>

            <div
                id="chatMessages"
                class="chat-messages"
            >
                Loading messages...
            </div>

            <form
                id="chatForm"
                class="chat-form"
            >

                <input
                    id="chatInput"
                    type="text"
                    placeholder="Write a message..."
                    autocomplete="off"
                    required
                >

                <button type="submit">
                    Send
                </button>

            </form>

        </div>
    `;

    document.body.appendChild(overlay);

    await loadChatMessages(requestId);

    const form =
        document.getElementById("chatForm");

    if (form) {

        form.onsubmit = async event => {

            event.preventDefault();

            const input =
                document.getElementById("chatInput");

            const message =
                input.value.trim();

            if (!message) return;

            try {

                await apiRequest(
                    `/api/chat/${requestId}`,
                    {
                        method: "POST",
                        body: JSON.stringify({
                            message
                        })
                    }
                );

                input.value = "";

                await loadChatMessages(requestId);

            } catch (error) {

                showMessage(error.message);

            }

        };

    }

}


async function loadChatMessages(requestId) {

    try {

        const data =
            await apiRequest(
                `/api/chat/${requestId}`
            );

        const container =
            document.getElementById("chatMessages");

        if (!container) return;

        container.innerHTML = "";

        if (!data.messages.length) {

            container.innerHTML =
                `<div class="chat-empty">
                    No messages yet.
                </div>`;

            return;
        }

        data.messages.forEach(item => {

            const div =
                document.createElement("div");

            div.className =
                item.sender_type ===
                (
                    currentUser.role === "VOLUNTEER"
                        ? "VOLUNTEER"
                        : "USER"
                )
                    ? "chat-message mine"
                    : "chat-message";

            div.innerHTML = `
                <div class="chat-message-text">
                    ${escapeHTML(item.message)}
                </div>

                <small>
                    ${new Date(
                        item.created_at
                    ).toLocaleTimeString()}
                </small>
            `;

            container.appendChild(div);

        });

        container.scrollTop =
            container.scrollHeight;

    } catch (error) {

        const container =
            document.getElementById("chatMessages");

        if (container) {
            container.innerHTML =
                `<div class="chat-empty">
                    ${escapeHTML(error.message)}
                </div>`;
        }

    }

}


function closeChat() {

    const chat =
        document.getElementById("helpPleaseChat");

    if (chat) {
        chat.remove();
    }

}


/* =========================================================
   SAFE HTML
========================================================= */

function escapeHTML(value) {

    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");

}async function openChat(requestId) {
    const old = document.getElementById("helpPleaseChat");
    if (old) old.remove();

    const overlay = document.createElement("div");
    overlay.id = "helpPleaseChat";
    overlay.className = "chat-overlay";

    overlay.innerHTML = `
        <div class="chat-window">
            <div class="chat-header">
                <div>
                    <strong>Help Please Chat</strong>
                    <small>Request #${requestId}</small>
                </div>
                <button type="button" onclick="closeChat()">Close</button>
            </div>

            <div id="chatMessages" class="chat-messages">
                Loading messages...
            </div>

            <form id="chatForm" class="chat-form">
                <input
                    id="chatInput"
                    type="text"
                    placeholder="Write a message..."
                    autocomplete="off"
                    required
                >
                <button type="submit">Send</button>
            </form>
        </div>
    `;

    document.body.appendChild(overlay);

    await loadChatMessages(requestId);

    const form = document.getElementById("chatForm");

    if (form) {
        form.onsubmit = async function(event) {
            event.preventDefault();

            const input = document.getElementById("chatInput");
            const message = input.value.trim();

            if (!message) return;

            try {
                await apiRequest(`/api/chat/${requestId}`, {
                    method: "POST",
                    body: JSON.stringify({
                        message: message
                    })
                });

                input.value = "";
                await loadChatMessages(requestId);

            } catch (error) {
                console.error(error);
                showMessage(error.message);
            }
        };
    }
}

async function loadChatMessages(requestId) {
    const container = document.getElementById("chatMessages");

    if (!container) return;

    try {
        const response = await fetch(`/api/chat/${requestId}`, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            }
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || "Could not load chat");
        }

        container.innerHTML = "";

        const messages = Array.isArray(data.messages)
            ? data.messages
            : [];

        if (messages.length === 0) {
            container.innerHTML = `
                <div class="chat-empty">
                    No messages yet.
                </div>
            `;
            return;
        }

        messages.forEach(message => {
            const item = document.createElement("div");

            const mine =
                String(message.sender_id) ===
                String(currentUser.user_id);

            item.className = mine
                ? "chat-message mine"
                : "chat-message";

            item.innerHTML = `
                <div class="chat-message-author">
                    ${escapeHTML(message.sender_type)}
                </div>

                <div class="chat-message-text">
                    ${escapeHTML(message.message)}
                </div>

                <div class="chat-message-time">
                    ${
                        message.created_at
                            ? new Date(message.created_at)
                                .toLocaleTimeString([], {
                                    hour: "2-digit",
                                    minute: "2-digit"
                                })
                            : ""
                    }
                </div>
            `;

            container.appendChild(item);
        });

        container.scrollTop = container.scrollHeight;

    } catch (error) {
        console.error(error);

        container.innerHTML = `
            <div class="chat-error">
                ${escapeHTML(error.message)}
            </div>
        `;
    }
}

function closeChat() {
    const chat = document.getElementById("helpPleaseChat");

    if (chat) {
        chat.remove();
    }
}
let locationWatchId = null;

function startVolunteerLocation() {
    if (!currentUser || currentUser.role !== "VOLUNTEER") return;

    if (!navigator.geolocation) {
        showMessage("Location is not supported.");
        return;
    }

    if (locationWatchId !== null) {
        navigator.geolocation.clearWatch(locationWatchId);
    }

    locationWatchId = navigator.geolocation.watchPosition(
        async position => {
            try {
                await apiRequest("/api/volunteer/location", {
                    method: "POST",
                    body: JSON.stringify({
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude
                    })
                });
            } catch (error) {
                console.error(error);
            }
        },
        error => {
            console.error(error);
        },
        {
            enableHighAccuracy: true,
            maximumAge: 5000,
            timeout: 10000
        }
    );
}

function stopVolunteerLocation() {
    if (locationWatchId !== null) {
        navigator.geolocation.clearWatch(locationWatchId);
        locationWatchId = null;
    }
}

async function viewVolunteerLocation(requestId) {
    try {
        const data = await apiRequest(
            `/api/help-request/${requestId}/volunteer-location`
        );

        if (
            !data.volunteer ||
            data.volunteer.latitude == null ||
            data.volunteer.longitude == null
        ) {
            showMessage("Volunteer location is not available yet.");
            return;
        }

        const latitude = data.volunteer.latitude;
        const longitude = data.volunteer.longitude;

        const old = document.getElementById("locationModal");
        if (old) old.remove();

        const modal = document.createElement("div");
        modal.id = "locationModal";
        modal.className = "chat-overlay";

        modal.innerHTML = `
            <div class="chat-window">
                <div class="chat-header">
                    <div>
                        <strong>Volunteer Location</strong>
                        <small>${escapeHTML(
                            data.volunteer.volunteer_name || "Volunteer"
                        )}</small>
                    </div>
                    <button type="button" onclick="closeLocationModal()">Close</button>
                </div>

                <div class="location-content">
                    <p>Latitude: ${latitude}</p>
                    <p>Longitude: ${longitude}</p>

                    <a
                        href="https://www.google.com/maps?q=${latitude},${longitude}"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        Open in Google Maps
                    </a>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

    } catch (error) {
        showMessage(error.message);
    }
}

function closeLocationModal() {
    const modal = document.getElementById("locationModal");
    if (modal) modal.remove();
}

const oldShowAppForLocation = showApp;

showApp = function() {
    oldShowAppForLocation();

    if (currentUser && currentUser.role === "VOLUNTEER") {
        startVolunteerLocation();
    }
};

const oldLogoutForLocation = logout;

logout = function() {
    stopVolunteerLocation();
    oldLogoutForLocation();
};
const forgotPasswordBox =
    document.getElementById("forgotPasswordBox");

const forgotPasswordForm =
    document.getElementById("forgotPasswordForm");

const backToLoginBtn =
    document.getElementById("backToLoginBtn");

if (forgotPasswordBox) {
    forgotPasswordBox.classList.add("hidden");
}

const forgotPasswordLink =
    document.getElementById("forgotPasswordLink");

if (forgotPasswordLink) {
    forgotPasswordLink.addEventListener("click", event => {
        event.preventDefault();

        document.getElementById("loginForm")
            ?.classList.add("hidden");

        document.getElementById("googleLoginBox")
            ?.classList.add("hidden");

        forgotPasswordBox
            ?.classList.remove("hidden");
    });
}

if (backToLoginBtn) {
    backToLoginBtn.addEventListener("click", () => {
        forgotPasswordBox
            ?.classList.add("hidden");

        document.getElementById("loginForm")
            ?.classList.remove("hidden");

        document.getElementById("googleLoginBox")
            ?.classList.remove("hidden");
    });
}

if (forgotPasswordForm) {
    forgotPasswordForm.addEventListener(
        "submit",
        async event => {
            event.preventDefault();

            const email =
                document.getElementById("forgotEmail")
                    .value
                    .trim();

            try {
                const data =
                    await apiRequest(
                        "/api/forgot-password",
                        {
                            method: "POST",
                            body: JSON.stringify({
                                email
                            })
                        }
                    );

                showMessage(data.message);

                forgotPasswordForm.reset();

            } catch (error) {
                showMessage(error.message);
            }
        }
    );
}

async function handleGoogleLogin(response) {
    try {
        const data =
            await apiRequest(
                "/api/google-login",
                {
                    method: "POST",
                    body: JSON.stringify({
                        credential:
                            response.credential
                    })
                }
            );

        token = data.token;
        currentUser = data.user;

        localStorage.setItem(
            "helpPleaseToken",
            token
        );

        localStorage.setItem(
            "helpPleaseUser",
            JSON.stringify(currentUser)
        );

        showMessage(
            "Google login successful"
        );

        showApp();

    } catch (error) {
        showMessage(error.message);
    }
}
document.addEventListener("click", async function (event) {

    const button = event.target.closest(".work-done-btn");

    if (!button) return;

    const requestId = button.dataset.requestId;

    if (!requestId) {
        showMessage("Request ID not found");
        return;
    }

    if (!confirm("Mark this help request as completed?")) {
        return;
    }

    try {

        button.disabled = true;
        button.textContent = "Completing...";

        const data = await apiRequest(
            `/api/help-request/${requestId}/complete`,
            {
                method: "POST"
            }
        );

        showMessage(
            data.message || "Help request completed successfully"
        );

        await loadRequests();

    } catch (error) {

        button.disabled = false;
        button.textContent = "Work Done";

        showMessage(error.message);
    }
});