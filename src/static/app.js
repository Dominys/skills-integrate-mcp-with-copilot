document.addEventListener("DOMContentLoaded", () => {
  const activitiesList = document.getElementById("activities-list");
  const activitySelect = document.getElementById("activity");
  const signupForm = document.getElementById("signup-form");
  const messageDiv = document.getElementById("message");
  const userMenuBtn = document.getElementById("user-menu-btn");
  const authPanel = document.getElementById("auth-panel");
  const authStatus = document.getElementById("auth-status");
  const openLoginBtn = document.getElementById("open-login-btn");
  const logoutBtn = document.getElementById("logout-btn");
  const loginModal = document.getElementById("login-modal");
  const loginForm = document.getElementById("login-form");
  const cancelLoginBtn = document.getElementById("cancel-login-btn");
  const signupLockedMessage = document.getElementById("signup-locked-message");

  let teacherToken = localStorage.getItem("teacherToken");
  let teacherUsername = localStorage.getItem("teacherUsername");

  function getAuthHeaders() {
    return teacherToken ? { Authorization: `Bearer ${teacherToken}` } : {};
  }

  function showMessage(text, type) {
    messageDiv.textContent = text;
    messageDiv.className = type;
    messageDiv.classList.remove("hidden");
    setTimeout(() => {
      messageDiv.classList.add("hidden");
    }, 5000);
  }

  function updateAuthUi() {
    const loggedIn = Boolean(teacherToken && teacherUsername);
    authStatus.textContent = loggedIn
      ? `Logged in as ${teacherUsername}`
      : "Browsing as student";

    openLoginBtn.classList.toggle("hidden", loggedIn);
    logoutBtn.classList.toggle("hidden", !loggedIn);
    signupForm.classList.toggle("hidden", !loggedIn);
    signupLockedMessage.classList.toggle("hidden", loggedIn);
  }

  function clearAuthState() {
    teacherToken = null;
    teacherUsername = null;
    localStorage.removeItem("teacherToken");
    localStorage.removeItem("teacherUsername");
    updateAuthUi();
  }

  async function validateSession() {
    if (!teacherToken) {
      updateAuthUi();
      return;
    }

    try {
      const response = await fetch("/auth/me", {
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        clearAuthState();
      } else {
        const data = await response.json();
        teacherUsername = data.username;
        localStorage.setItem("teacherUsername", teacherUsername);
        updateAuthUi();
      }
    } catch {
      clearAuthState();
    }
  }

  // Function to fetch activities from API
  async function fetchActivities() {
    try {
      const response = await fetch("/activities");
      const activities = await response.json();

      // Clear loading message
      activitiesList.innerHTML = "";

      // Populate activities list
      Object.entries(activities).forEach(([name, details]) => {
        const activityCard = document.createElement("div");
        activityCard.className = "activity-card";
        const canManage = Boolean(teacherToken && teacherUsername);

        const spotsLeft =
          details.max_participants - details.participants.length;

        // Create participants HTML with delete icons instead of bullet points
        const participantsHTML =
          details.participants.length > 0
            ? `<div class="participants-section">
              <h5>Participants:</h5>
              <ul class="participants-list">
                ${details.participants
                  .map(
                    (email) =>
                      `<li><span class="participant-email">${email}</span>${
                        canManage
                          ? `<button class="delete-btn" data-activity="${name}" data-email="${email}">❌</button>`
                          : ""
                      }</li>`
                  )
                  .join("")}
              </ul>
            </div>`
            : `<p><em>No participants yet</em></p>`;

        activityCard.innerHTML = `
          <h4>${name}</h4>
          <p>${details.description}</p>
          <p><strong>Schedule:</strong> ${details.schedule}</p>
          <p><strong>Availability:</strong> ${spotsLeft} spots left</p>
          <div class="participants-container">
            ${participantsHTML}
          </div>
        `;

        activitiesList.appendChild(activityCard);

        // Add option to select dropdown
        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        activitySelect.appendChild(option);
      });

      // Add event listeners to delete buttons
      document.querySelectorAll(".delete-btn").forEach((button) => {
        button.addEventListener("click", handleUnregister);
      });
    } catch (error) {
      activitiesList.innerHTML =
        "<p>Failed to load activities. Please try again later.</p>";
      console.error("Error fetching activities:", error);
    }
  }

  // Handle unregister functionality
  async function handleUnregister(event) {
    if (!teacherToken) {
      showMessage("Teacher login required", "error");
      return;
    }

    const button = event.target;
    const activity = button.getAttribute("data-activity");
    const email = button.getAttribute("data-email");

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/unregister?email=${encodeURIComponent(email)}`,
        {
          method: "DELETE",
          headers: getAuthHeaders(),
        }
      );

      const result = await response.json();

      if (response.ok) {
        showMessage(result.message, "success");

        // Refresh activities list to show updated participants
        fetchActivities();
      } else {
        showMessage(result.detail || "An error occurred", "error");
      }
    } catch (error) {
      showMessage("Failed to unregister. Please try again.", "error");
      console.error("Error unregistering:", error);
    }
  }

  // Handle form submission
  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!teacherToken) {
      showMessage("Teacher login required", "error");
      return;
    }

    const email = document.getElementById("email").value;
    const activity = document.getElementById("activity").value;

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/signup?email=${encodeURIComponent(email)}`,
        {
          method: "POST",
          headers: getAuthHeaders(),
        }
      );

      const result = await response.json();

      if (response.ok) {
        showMessage(result.message, "success");
        signupForm.reset();

        // Refresh activities list to show updated participants
        fetchActivities();
      } else {
        showMessage(result.detail || "An error occurred", "error");
      }
    } catch (error) {
      showMessage("Failed to sign up. Please try again.", "error");
      console.error("Error signing up:", error);
    }
  });

  userMenuBtn.addEventListener("click", () => {
    authPanel.classList.toggle("hidden");
  });

  openLoginBtn.addEventListener("click", () => {
    loginModal.classList.remove("hidden");
    authPanel.classList.add("hidden");
  });

  cancelLoginBtn.addEventListener("click", () => {
    loginModal.classList.add("hidden");
    loginForm.reset();
  });

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const username = document.getElementById("teacher-username").value;
    const password = document.getElementById("teacher-password").value;

    try {
      const response = await fetch(
        `/auth/login?username=${encodeURIComponent(
          username
        )}&password=${encodeURIComponent(password)}`,
        { method: "POST" }
      );

      const result = await response.json();

      if (!response.ok) {
        showMessage(result.detail || "Login failed", "error");
        return;
      }

      teacherToken = result.token;
      teacherUsername = result.username;
      localStorage.setItem("teacherToken", teacherToken);
      localStorage.setItem("teacherUsername", teacherUsername);

      updateAuthUi();
      loginModal.classList.add("hidden");
      loginForm.reset();
      fetchActivities();
      showMessage(`Logged in as ${teacherUsername}`, "success");
    } catch {
      showMessage("Login failed. Please try again.", "error");
    }
  });

  logoutBtn.addEventListener("click", async () => {
    if (!teacherToken) {
      clearAuthState();
      return;
    }

    try {
      await fetch("/auth/logout", {
        method: "POST",
        headers: getAuthHeaders(),
      });
    } catch {
      // noop
    }

    clearAuthState();
    fetchActivities();
    showMessage("Logged out", "success");
  });

  document.addEventListener("click", (event) => {
    if (!event.target.closest(".user-menu")) {
      authPanel.classList.add("hidden");
    }
  });

  // Initialize app
  validateSession().then(fetchActivities);
});
