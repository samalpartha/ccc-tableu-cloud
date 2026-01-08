let settings;
let importanceChart;
let currentCustomerData = null;


function getApiBase() {
  const v = (document.getElementById("apiBase").value || "").trim();
  // If we are on Render, the API is at the root of the same domain
  return v || window.location.origin;
}

async function init() {
  try {
    await tableau.extensions.initializeAsync();
    settings = tableau.extensions.settings;

    const defaultApi = "https://ccc-tableu-cloud.onrender.com";
    let apiVal = settings.get("apiBase") || defaultApi;

    // Auto-fix common typos (like the 'tablsu' typo discovered in user screenshots)
    if (apiVal.includes("tablsu")) {
      console.warn("Auto-fixing typo in API URL");
      apiVal = apiVal.replace("tablsu", "tableu");
    }

    document.getElementById("apiBase").value = apiVal;
    document.getElementById("slackEnable").checked = (settings.get("slackEnable") || "false") === "true";

    // Diagnostic: Tableau Connection
    const diagTab = document.getElementById("diagTableau");
    if (diagTab) {
      diagTab.innerHTML = "● Connected to Tableau";
      diagTab.style.color = "var(--success)";
    }

    checkApiHealth();

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
    document.getElementById("apiBase").value = "https://ccc-tableu-cloud.onrender.com";
  }
  // Auto-load data regardless of mode
  refreshTopRegret();
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

    const cols = data.columns.map(c => c.fieldName);
    console.log("Available columns:", cols);

    // Robust matching: Look for 'customer', 'id', 'account', or 'uid'
    const customerIdIndex = data.columns.findIndex(c => {
      const name = c.fieldName.toLowerCase();
      return name.includes("customer") || (name === "id") || name.includes("acc") || name.includes("uid");
    });
    console.log("Matched index:", customerIdIndex);

    const diagSel = document.getElementById("diagSelection");
    if (customerIdIndex === -1) {
      const errorMsg = `Error: No 'ID' column found. Available: ${cols.join(", ")}`;
      setStatus(errorMsg);
      if (diagSel) {
        diagSel.innerHTML = "× Selection Error: ID column missing";
        diagSel.style.color = "var(--danger)";
      }
      return;
    }

    if (diagSel) {
      diagSel.innerHTML = "● Selection Recognized";
      diagSel.style.color = "var(--success)";
    }

    const customerId = data.data[0][customerIdIndex].value;
    console.log("Selected customer ID:", customerId);

    // Immediately start analysis with the ID
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
    document.getElementById("recommendationPanel").style.display = "block";

    // 1. Get full golden record from backend FIRST (Essential for schema-accurate prediction)
    const custRes = await fetch(`${baseUrl}/customer/${customerId}`);
    if (!custRes.ok) {
      throw new Error(`Failed to load customer profile (API ${custRes.status})`);
    }
    currentCustomerData = await custRes.json();
    console.log("Full customer record loaded:", currentCustomerData);

    // 2. Get global feature importance
    const featRes = await fetch(`${baseUrl}/metadata/features`);
    const featData = await featRes.json();

    // 3. Get detailed counterfactual for initial view
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

    updateSelectedUI(cfData, featData.features);
    runSimulation(); // Trigger initial gauge render

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

function setStatus(msg) {
  const el = document.getElementById("status");
  if (el) {
    el.innerHTML = msg ? `<span class="pulse"></span>${msg}` : "";
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

    // Update Premium Gauge
    const risk = data.churn_risk;
    if (isNaN(risk) || risk === undefined) {
      gaugeVal.textContent = "N/A";
      gaugeVal.style.color = "var(--text-secondary)";
      return;
    }

    const riskPct = Math.round(risk * 100);

    // Animate Gauge: rotation from -90 (0%) to 90 (100%)
    const rotation = -90 + (risk * 180);
    const gaugeFill = document.getElementById("gaugeFill");
    const gaugeVal = document.getElementById("gaugeVal");

    gaugeFill.style.transform = `rotate(${rotation}deg)`;
    gaugeVal.textContent = `${riskPct}%`;

    // Dynamic color based on risk
    const color = risk >= 0.5 ? "var(--danger)" : "var(--success)";
    gaugeVal.style.color = color;

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
        backgroundColor: "rgba(59, 130, 246, 0.4)",
        borderColor: "rgba(59, 130, 246, 1)",
        borderWidth: 2,
        borderRadius: 8
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
        x: { grid: { color: "rgba(255,255,255,0.05)" }, ticks: { color: "#94a3b8", font: { weight: '600' } } },
        y: { grid: { display: false }, ticks: { color: "#fff", font: { weight: '600' } } }
      }
    }
  });
}

async function saveSettings() {
  const apiBase = getApiBase();
  const slackEnable = document.getElementById("slackEnable").checked ? "true" : "false";
  if (settings) {
    settings.set("apiBase", apiBase);
    settings.set("slackEnable", slackEnable);
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
  const tbody = document.querySelector("#regretTable tbody");
  tbody.innerHTML = "";
  if (!rows || rows.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--text-secondary);">No data available</td></tr>';
    return;
  }
  for (const r of rows) {
    const tr = document.createElement("tr");

    // Risk Badge for Counterfactual Risk
    const risk = r.churn_risk_counterfactual ?? 0;
    const riskClass = risk >= 0.5 ? "risk-high" : "risk-low";
    const improvement = ((r.delta_risk || 0) * 100).toFixed(1);

    tr.innerHTML = `
      <td style="font-weight: 700;">#${r.customer_id}</td>
      <td>${((r.churn_risk_base || 0) * 100).toFixed(1)}%</td>
      <td><span class="risk-badge ${riskClass}">${(risk * 100).toFixed(1)}%</span></td>
      <td style="color: ${improvement > 0 ? 'var(--success)' : 'var(--text-secondary)'}; font-weight: 700;">
        ${improvement > 0 ? '↑ ' : ''}${improvement}%
      </td>
    `;
    tbody.appendChild(tr);
  }
}

async function triggerAction() {
  try {
    const slackEnable = document.getElementById("slackEnable").checked;
    if (!slackEnable) { setStatus("Slack trigger disabled."); return; }

    const timing_days = parseInt(document.getElementById("timing").value, 10);
    const action_type = document.getElementById("actionType").value;

    const tbody = document.querySelector("#regretTable tbody");
    const ids = [];
    for (let i = 0; i < Math.min(5, tbody.children.length); i++) {
      let rawId = tbody.children[i].children[0].textContent || "";
      const id = parseInt(rawId.replace("#", ""), 10);
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

document.getElementById("saveConfig").addEventListener("click", () => {
  saveSettings();
  checkApiHealth();
});
document.getElementById("resetApi").addEventListener("click", () => {
  document.getElementById("apiBase").value = "https://ccc-tableu-cloud.onrender.com";
  saveSettings();
  checkApiHealth();
});
document.getElementById("refreshBtn").addEventListener("click", refreshTopRegret);
document.getElementById("slackBtn").addEventListener("click", triggerAction);
document.getElementById("optimizeBtn").addEventListener("click", handleOptimize);

async function handleOptimize() {
  if (!currentCustomerData) return;
  const customerId = parseInt(currentCustomerData.customer_id || currentCustomerData.Customer_Id || 0);
  if (!customerId) return;

  try {
    setStatus("AI is calculating optimal strategy...");
    const baseUrl = getApiBase().replace(/\/$/, "");
    const res = await fetch(`${baseUrl}/recommend/${customerId}`);
    const data = await res.json();

    if (data.best_action !== "none") {
      // Apply recommendation to UI
      document.getElementById("actionType").value = data.best_action;
      document.getElementById("timing").value = data.best_timing;

      // Update recommendation text
      const recText = document.getElementById("recommendationText");
      recText.innerHTML = `
        <strong>Strategy:</strong> ${data.best_action.replace("_", " ")} at day ${data.best_timing}.<br/>
        <strong>Impact:</strong> Churn risk dropped by ${(data.improvement * 100).toFixed(1)}%.<br/>
        <span style="color: var(--muted); font-style: italic;">"${data.reasoning}"</span>
      `;

      setStatus("Optimal strategy identified!");
    } else {
      setStatus("No significant improvement found.");
    }
  } catch (e) {
    console.error("Optimization failed", e);
    setStatus("AI optimization failed.");
  }
}

async function checkApiHealth() {
  const diag = document.getElementById("diagApi");
  if (!diag) return;

  try {
    const baseUrl = getApiBase().replace(/\/$/, "");
    diag.innerHTML = `○ Connecting to ${baseUrl}...`;
    // We use /metadata/features as a lightweight ping
    const res = await fetch(`${baseUrl}/metadata/features`, { signal: AbortSignal.timeout(5000) });
    if (res.ok) {
      diag.innerHTML = `● Backend API Online (${baseUrl.split('//')[1]})`;
      diag.style.color = "var(--success)";
    } else {
      throw new Error(`Status ${res.status}`);
    }
  } catch (e) {
    diag.innerHTML = `× API Connection Failed: ${e.message}`;
    diag.style.color = "var(--danger)";
  }
}

init();
