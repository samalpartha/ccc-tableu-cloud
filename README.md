# Counterfactual Command Center — Tableau Cloud E2E (Frontend + Backend)
A complete, hackathon-grade end-to-end solution for Tableau Cloud + Developer Platform.

## What you can demo
- Tableau dashboard reads scenario CSVs and shows:
  - Base vs Counterfactual churn risk
  - Customers saved
  - Revenue recovered
  - Decision regret score
- Dashboard Extension (Tableau Developer Platform) provides:
  - API Base URL config
  - “Refresh Top Regret” (calls backend)
  - “Trigger Retention Action” (posts to Slack via backend)

## Access & credentials (Option 1)
Required
- Tableau Cloud site (trial OK) with permissions to publish and add extensions.

Recommended (Actionable Analytics)
- Slack workspace + Incoming Webhook URL (set SLACK_WEBHOOK_URL).

Not required
- Tableau Next org
- Salesforce org admin credentials

## Run locally
1) Install
    pip install -r backend/requirements.txt

2) Generate data + train + export CSVs
    python scripts/run_demo.py

3) Start API
    source venv/bin/activate
    export PYTHONPATH=$PYTHONPATH:.
    uvicorn backend.main:app --reload --port 8004

4) Start Extension UI (Static Server)
    cd extension
    python3 -m http.server 3004

Open:
- API docs: http://127.0.0.1:8004/docs
- Extension: http://127.0.0.1:3004/index.html

## Tableau Cloud steps
1) Upload a scenario CSV from `outputs/` into Tableau Cloud and build the dashboard.
2) Add the extension using `extension/counterfactual-command-center.trex`
   - Update the <url> inside the .trex to your HTTPS-hosted extension URL for the final submission.

## Deploy (recommended)
Host backend + extension on the same HTTPS domain (Render/Fly/Railway) to avoid CORS friction.

Env vars
- SLACK_WEBHOOK_URL (optional)
- MODEL_PATH, BASE_CUSTOMERS_CSV (optional)
