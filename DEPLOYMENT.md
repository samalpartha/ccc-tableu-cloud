# Deployment Guide - Render.com + Tableau Cloud

This guide walks you through deploying the Counterfactual Command Center to Render.com and configuring it in Tableau Cloud.

## 📋 Prerequisites

- GitHub account with this repository pushed
- Render.com account (free tier works)
- Tableau Cloud Developer site
- (Optional) Slack webhook URL for notifications

## 🚀 Part 1: Deploy to Render.com

### Step 1: Create a New Web Service

1. Go to [Render.com](https://render.com) and sign in
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub account if not already connected
4. Select this repository: `ccc-tableu-cloud`

### Step 2: Configure the Service

Use these settings:

| Setting | Value |
|---------|-------|
| **Name** | `counterfactual-command-center` (or your choice) |
| **Region** | Choose closest to you |
| **Branch** | `main` |
| **Runtime** | `Docker` |
| **Instance Type** | `Free` (or paid for better performance) |

### Step 3: Environment Variables (Optional)

Add these environment variables if needed:

| Key | Value | Description |
|-----|-------|-------------|
| `SLACK_WEBHOOK_URL` | `https://hooks.slack.com/services/...` | Optional: For Slack notifications |
| `PORT` | Auto-set by Render | Don't set manually |

### Step 4: Deploy

1. Click **"Create Web Service"**
2. Render will automatically:
   - Build the Docker image
   - Run `scripts/run_demo.py` to generate data and train the model
   - Start the FastAPI server
3. Wait 5-10 minutes for the first deployment
4. Once deployed, you'll get a URL like: `https://counterfactual-command-center.onrender.com`

### Step 5: Verify Deployment

Test your deployment:

```bash
# Health check
curl https://YOUR-RENDER-URL.onrender.com/health

# API docs
# Visit: https://YOUR-RENDER-URL.onrender.com/docs
```

## 📊 Part 2: Configure Tableau Cloud

### Step 1: Prepare Your Data

1. Download the generated customer data:
   - If running locally first: Use `outputs/customers_scored_base.csv`
   - Or generate it by running locally:
     ```bash
     python3 -m venv venv
     source venv/bin/activate
     pip install -r backend/requirements.txt
     export PYTHONPATH=$PYTHONPATH:.
     python3 scripts/run_demo.py
     ```

2. The CSV will contain columns like:
   - `customer_id`
   - `churn_risk_base`
   - `usage_drop_30d_pct`
   - `tickets_30d`
   - `arpu`
   - etc.

### Step 2: Upload Data to Tableau Cloud

1. Sign in to your Tableau Cloud site
2. Go to **Explore** → **Publish** → **Data Source**
3. Upload `customers_scored_base.csv`
4. Name it: `Customer Churn Data`
5. Click **Publish**

### Step 3: Create a Dashboard

1. Create a new **Workbook**
2. Connect to your published data source
3. Create a simple visualization:
   - **Rows**: `Customer Id`
   - **Columns**: `Churn Risk Base`
   - **Mark Type**: Bar
   - **Color**: `Churn Risk Base` (Red-Green diverging)
4. Save the workbook as: `Churn Analysis Dashboard`

### Step 4: Add the Extension

1. In your dashboard, drag the **Extension** object from the left panel
2. Click **"My Extensions"** → **"Add Extension"**
3. You'll need to add the `.trex` file:

   **Option A: Use the deployed URL**
   - Update `extension/counterfactual-command-center.trex` line 10:
     ```xml
     <url>https://YOUR-RENDER-URL.onrender.com/extension/index.html</url>
     ```
   - Commit and push the change
   - Download the `.trex` file from GitHub
   - Upload it to Tableau

   **Option B: Use local file (for testing)**
   - Use the `.trex` file as-is with relative URL
   - This only works if extension is served from same domain

4. Select the extension and click **"Add"**

### Step 5: Configure Extension Security

1. Go to **Settings** → **Extensions**
2. Under **Dashboard Extensions**, select **"Enable specific extensions"**
3. Add your Render URL to the safe list:
   ```
   https://YOUR-RENDER-URL.onrender.com
   ```
4. Click **"Save"**

### Step 6: Configure the Extension

Once the extension loads in your dashboard:

1. **API Base URL**: Should auto-populate with your Render URL
   - If not, enter: `https://YOUR-RENDER-URL.onrender.com`
2. **Slack Enabled**: Check if you configured the webhook
3. Click **"Save Settings"**

## 🎯 Part 3: Test the Integration

### Test 1: Mark Selection
1. Click on a customer bar in your Tableau visualization
2. The extension should display:
   - Customer ID and risk level
   - Feature importance chart
   - What-If simulator with sliders

### Test 2: What-If Simulation
1. After selecting a customer, adjust the sliders:
   - **Usage Drop %**: Simulate behavior changes
   - **Support Tickets**: Simulate support load
2. Watch the simulated risk update in real-time

### Test 3: Batch Analysis
1. Click **"Refresh Top Regret"**
2. Should display a table of high-risk customers
3. Shows counterfactual analysis for each

### Test 4: Slack Integration (if configured)
1. Enable Slack in settings
2. Click **"Trigger Retention Action"**
3. Check your Slack channel for the notification

## 🔧 Troubleshooting

### Extension Won't Load
- **Check**: Is your Render URL in the Tableau safe list?
- **Check**: Is the Render service running? (Visit the URL directly)
- **Check**: Browser console for CORS errors

### API Calls Failing
- **Check**: API Base URL in extension settings
- **Check**: Render logs for errors
- **Check**: Network tab in browser dev tools

### No Data in Extension
- **Check**: Did you select a mark in Tableau?
- **Check**: Does your data have a `customer_id` column?
- **Check**: Backend logs on Render

### Render Build Failing
- **Check**: All files committed and pushed to GitHub
- **Check**: `requirements.txt` has all dependencies
- **Check**: Render build logs for specific errors

## 📝 Update Extension URL Script

Here's a quick script to update the `.trex` file with your Render URL:

```bash
# Replace YOUR_RENDER_URL with your actual URL
RENDER_URL="https://counterfactual-command-center.onrender.com"

# Update the .trex file
sed -i '' "s|/extension/index.html|${RENDER_URL}/extension/index.html|g" extension/counterfactual-command-center.trex

# Commit and push
git add extension/counterfactual-command-center.trex
git commit -m "Update extension URL for Render deployment"
git push
```

## 🎥 Demo Flow for Video

1. **Show Tableau Dashboard** with customer churn bars
2. **Click a high-risk customer** → Extension loads analysis
3. **Explain the feature importance chart** → Why is this customer at risk?
4. **Use What-If sliders** → "What if we reduced their support tickets?"
5. **Show risk dropping** in real-time
6. **Click Refresh** → Show batch analysis of top regret customers
7. **Trigger Slack action** → Show notification in Slack
8. **Explain the value** → Proactive retention, data-driven decisions

## 🔗 Useful Links

- **Render Dashboard**: https://dashboard.render.com
- **Tableau Developer**: https://tableau.com/developer
- **API Documentation**: `https://YOUR-RENDER-URL.onrender.com/docs`
- **GitHub Repository**: https://github.com/samalpartha/ccc-tableu-cloud

## 💡 Tips

- **Free Tier**: Render free tier spins down after inactivity. First request may take 30-60 seconds.
- **Logs**: Check Render logs for debugging: Dashboard → Your Service → Logs
- **Updates**: Push to GitHub `main` branch to auto-deploy updates
- **Testing**: Test locally first with `uvicorn backend.main:app --reload --port 8004`
