let settings;
let importanceChart;
let currentCustomerData = null;

function setStatus(msg) {
  const el = document.getElementById("status");
  if (el) el.textContent = msg || "";
}

function getApiBase() {
  const v = (document.getElementById("apiBase").value || "").trim();
  // If we are on Render, the API is at the root of the same domain
  return v || window.location.origin;
}

async function init() {
  try {
    await tableau.extensions.initializeAsync();
    settings = tableau.extensions.settings;

    const defaultApi = window.location.origin;
    document.getElementById("apiBase").value = settings.get("apiBase") || defaultApi;
    document.getElementById("slackEnabled").checked = (settings.get("slackEnabled") || "false") === "true";

    // Display User Info
    const user = tableau.extensions.viewer;
    if (user && user.name) {
      document.getElementById("userInfo").innerHTML = `User: <strong>${user.name}</strong><br/>${user.email || ""}`;
    }

    // Add event listeners for Tableau selections
    const dashboard = tableau.extensions.dashboardContent.dashboard;
    dashboard.worksheets.forEach(ws => {
      ws.addEventListener(tableau.TableauEventType.MarkSelectionChanged, onSelectionChange);
    });

    // Add Slider Listeners
    document.getElementById("usageSlider").addEventListener("input", runSimulation);
    document.getElementById("ticketSlider").addEventListener("input", runSimulation);

    setStatus("Initialized with Tableau.");
  } catch (e) {
    console.warn("Not running inside Tableau.", e);
    const errorMsg = e.message || e.toString();
    setStatus("Mode: Standalone (" + errorMsg.substring(0, 40) + ")");
    document.getElementById("apiBase").value = "http://localhost:8004";
  }
}

async function onSelectionChange(event) {
  try {
    console.log("Selection changed event triggered");
    const marks = await event.getMarksAsync();
    console.log("Marks data:", marks);

    if (!marks || marks.data.length === 0 || marks.data[0].data.length === 0) {
      console.log("No marks data available");
      return;
    }

    const data = marks.data[0];
    console.log("Available columns:", data.columns.map(c => c.fieldName));

    const customerIdIndex = data.columns.findIndex(c => c.fieldName.toLowerCase().includes("customer"));
    console.log("Customer ID index:", customerIdIndex);

    if (customerIdIndex === -1) {
      setStatus("Error: Customer ID column not found. Available: " + data.columns.map(c => c.fieldName).join(", "));
      return;
    }

    const customerId = data.data[0][customerIdIndex].value;
    console.log("Selected customer ID:", customerId);

    // Also try to grab existing features from the marks if available
    const features = {};
    data.columns.forEach((col, idx) => {
      features[col.fieldName] = data.data[0][idx].value;
    });

    currentCustomerData = features;
    console.log("Customer data:", currentCustomerData);
    analyzeCustomer(customerId);
  } catch (e) {
    console.error("Selection change error:", e);
    setStatus("Selection error: " + e.message);
  }
}

async function analyzeCustomer(customerId) {
  try {
    setStatus(`Analyzing Customer ${customerId}...`);
    const baseUrl = getApiBase().replace(/\/$/, "");

    // Show simulator
    document.getElementById("simulatorControls").style.display = "block";
    document.getElementById("simPlaceholder").style.display = "none";

    // 1. Get detailed counterfactual
    const cfRes = await fetch(`${baseUrl}/counterfactual`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customer_id: customerId,
        timing_days: parseInt(document.getElementById("timing").value, 10),
        action_type: document.getElementById("actionType").value
      })
    });
    const cfData = await cfRes.json();

    // 2. Get global feature importance
    const featRes = await fetch(`${baseUrl}/metadata/features`);
    const featData = await featRes.json();

    updateSelectedUI(cfData, featData.features);

    // Initialize sliders based on current data if we have it
    if (currentCustomerData) {
      const usage = currentCustomerData["usage_drop_30d_pct"] || 0;
      const tickets = currentCustomerData["tickets_30d"] || 0;
      document.getElementById("usageSlider").value = usage;
      document.getElementById("ticketSlider").value = tickets;
      document.getElementById("usageVal").textContent = Math.round(usage);
      document.getElementById("ticketVal").textContent = Math.round(tickets);
    }

    setStatus(`Analysis complete for ${customerId}`);
  } catch (e) {
    console.error(e);
    setStatus("Analysis failed: " + e.message);
  }
}

async function runSimulation() {
  if (!currentCustomerData) return;

  const usage = parseFloat(document.getElementById("usageSlider").value);
  const tickets = parseFloat(document.getElementById("ticketSlider").value);

  document.getElementById("usageVal").textContent = Math.round(usage);
  document.getElementById("ticketVal").textContent = Math.round(tickets);

  try {
    const baseUrl = getApiBase().replace(/\/$/, "");
    const res = await fetch(`${baseUrl}/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...currentCustomerData,
        usage_drop_30d_pct: usage,
        tickets_30d: tickets,
        customer_id: parseInt(currentCustomerData.customer_id || currentCustomerData.Customer_Id || 0)
      })
    });
    const data = await res.json();

    const simEl = document.getElementById("simResult");
    const risk = (data.churn_risk * 100).toFixed(1);
    const color = data.churn_risk >= 0.5 ? "#c2413b" : "#22c55e";
    simEl.innerHTML = `Simulated Risk: <strong style="color: ${color}">${risk}%</strong>`;
  } catch (e) {
    console.error("Simulation failed", e);
  }
}

function updateSelectedUI(cfData, features) {
  const el = document.getElementById("selectedCustomer");
  const riskClass = cfData.churn_risk_base >= 0.5 ? "risk-high" : "risk-low";
  const riskLabel = cfData.churn_risk_base >= 0.5 ? "HIGH" : "LOW";

  el.innerHTML = `
    Customer: <strong>${cfData.customer_id}</strong>
    <span class="risk-badge ${riskClass}">${riskLabel} RISK</span><br/>
    Base Risk: ${(cfData.churn_risk_base * 100).toFixed(1)}% | 
    With Action: ${(cfData.churn_risk_counterfactual * 100).toFixed(1)}%
  `;

  renderChart(features);
}

function renderChart(features) {
  const ctx = document.getElementById("importanceChart").getContext("2d");
  if (importanceChart) importanceChart.destroy();

  const topFeatures = features.slice(0, 5);

  importanceChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: topFeatures.map(f => f.feature),
      datasets: [{
        label: "Feature Importance",
        data: topFeatures.map(f => f.importance),
        backgroundColor: "rgba(45, 108, 223, 0.6)",
        borderColor: "rgba(45, 108, 223, 1)",
        borderWidth: 1
      }]
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: "#a9b6d3" } },
        y: { grid: { display: false }, ticks: { color: "#a9b6d3" } }
      }
    }
  });
}

async function saveSettings() {
  const apiBase = getApiBase();
  const slackEnabled = document.getElementById("slackEnabled").checked ? "true" : "false";
  if (settings) {
    settings.set("apiBase", apiBase);
    settings.set("slackEnabled", slackEnabled);
    await settings.saveAsync();
  }
  setStatus("Saved settings.");
}

async function refreshTopRegret() {
  try {
    const baseUrl = getApiBase().replace(/\/$/, "");
    const timing_days = parseInt(document.getElementById("timing").value, 10);
    const action_type = document.getElementById("actionType").value;
    const url = baseUrl + "/batch_counterfactual";

    console.log("Calling API:", url);
    setStatus(`Loading from ${baseUrl}...`);

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ timing_days, action_type, top_n: 20 })
    });

    console.log("Response status:", res.status);

    if (!res.ok) {
      const errorText = await res.text();
      console.error("API Error:", errorText);
      throw new Error(`API ${res.status}: ${errorText.substring(0, 100)}`);
    }

    const data = await res.json();
    console.log("Received data:", data);
    renderRows(data.rows || []);
    setStatus(`Loaded ${data.rows?.length || 0} customers.`);
  } catch (e) {
    console.error("refreshTopRegret error:", e);
    setStatus(`Failed: ${e.message || e.toString()}`);
    alert(`Error: ${e.message}\n\nCheck console (F12) for details.\n\nAPI URL: ${getApiBase()}`);
  }
}

function renderRows(rows) {
  const tbody = document.getElementById("rows");
  tbody.innerHTML = "";
  for (const r of rows) {
    const tr = document.createElement("tr");
    const cells = [
      r.customer_id,
      (r.churn_risk_base ?? 0).toFixed(3),
      (r.churn_risk_counterfactual ?? 0).toFixed(3),
      (r.delta_risk ?? 0).toFixed(3),
      Math.round(r.regret_score ?? 0).toLocaleString()
    ];
    for (const c of cells) {
      const td = document.createElement("td");
      td.textContent = String(c);
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }
}

async function triggerAction() {
  try {
    const slackEnabled = document.getElementById("slackEnabled").checked;
    if (!slackEnabled) { setStatus("Slack trigger disabled."); return; }

    const timing_days = parseInt(document.getElementById("timing").value, 10);
    const action_type = document.getElementById("actionType").value;

    const tbody = document.getElementById("rows");
    const ids = [];
    for (let i = 0; i < Math.min(5, tbody.children.length); i++) {
      const id = parseInt(tbody.children[i].children[0].textContent, 10);
      if (!Number.isNaN(id)) ids.push(id);
    }
    if (!ids.length) { setStatus("Refresh first."); return; }

    const url = getApiBase().replace(/\/$/, "") + "/action/trigger";
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customer_ids: ids, timing_days, action_type })
    });
    if (!res.ok) throw new Error("API " + res.status);
    setStatus("Triggered Slack for: " + ids.join(", "));
  } catch (e) {
    console.error(e);
    setStatus("Trigger failed: " + (e.message || e));
  }
}

document.getElementById("saveBtn").addEventListener("click", saveSettings);
document.getElementById("refreshBtn").addEventListener("click", refreshTopRegret);
document.getElementById("triggerBtn").addEventListener("click", triggerAction);

init();
