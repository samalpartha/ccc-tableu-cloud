# Counterfactual Command Center — Tableau Cloud E2E

A world-class, hackathon-grade end-to-end solution for Tableau Cloud + AI. This project demonstrates how to integrate real-time Machine Learning and Counterfactual Analysis directly into the flow of work using the Tableau Developer Platform.

## 🚀 "World-Class" Features
- **Predictive Churn Engine**: Uses a HistGradientBoosting model to predict churn risk based on 30-day behavior metrics.
- **Agentic AI Recommender**: A new intelligence layer that automatically identifies the optimal intervention strategy (Action + Timing) to maximize retention for a specific customer.
- **Premium Visual Polish**: Features a state-of-the-art **Glassmorphism** design system, premium **Outfit** typography, and smooth micro-animations.
- **Animated Risk Gauge**: A real-time CSS-based semi-circular gauge that visually represents simulated risk changes as you adjust sliders.
- **Interactive "What-If" Simulator**: Real-time sliders in the Tableau Dashboard allow users to simulate how changes in customer behavior impact their risk score.
- **Explainable AI (XAI)**: Integrated feature importance charts and **Natural Language Reasoning** for AI recommendations to explain *why* an action is suggested.
- **Deep Tableau Integration**: Listens to `MarkSelectionChanged` events for instant, context-aware analysis.
- **Actionable Analytics**: One-click "Trigger Retention Action" that posts high-regret customers to Slack via webhooks.

## 🏗️ Architecture

### Complete System Architecture
```mermaid
flowchart TB
    subgraph Tableau["Tableau Cloud"]
        TC[Tableau Dashboard]
        DS[Published Data Source]
        EXT[Dashboard Extension]
    end
    
    subgraph Frontend["Frontend - Premium UI"]
        HTML[index.html - Glassmorphism]
        JS[app.js Extension Logic]
        CSS[styles.css - Premium Design]
        GAUGE[Animated Risk Gauge]
        CHART[Chart.js Visualizations]
    end
    
    subgraph Backend["Backend - FastAPI Server"]
        API[FastAPI Application]
        HEALTH[Health Check]
        PREDICT[Predict Endpoint]
        REC[AI Recommend Endpoint]
        EXPLAIN[Explain Endpoint]
        CF[Counterfactual Endpoint]
        BATCH[Batch Counterfactual]
        META[Metadata Features]
        ACTION[Action Trigger]
        MODEL[model.py ML Engine]
        COUNTER[counterfactual.py]
    end
    
    subgraph ML["ML Pipeline"]
        TRAIN[Training Data Generator]
        HGBOOST[HistGradientBoosting]
        FEATURES[Feature Importance]
    end
    
    subgraph External["External Services"]
        SLACK[Slack Webhooks]
    end
    
    TC -->|Mark Selection| EXT
    EXT -->|Extensions API| JS
    JS -->|HTTP Requests| API
    
    API --> PREDICT
    API --> REC
    API --> EXPLAIN
    API --> CF
    API --> BATCH
    API --> META
    API --> ACTION
    
    REC --> MODEL
    REC --> COUNTER
    PREDICT --> MODEL
    EXPLAIN --> MODEL
    CF --> MODEL
    CF --> COUNTER
    BATCH --> MODEL
    BATCH --> COUNTER
    META --> FEATURES
    
    ACTION --> SLACK
    
    TRAIN --> HGBOOST
    HGBOOST --> MODEL
    
    DS -.->|CSV Upload| TC
    JS --> GAUGE
    CHART -.->|Render| JS
    
    style TC fill:#2d6cdf,color:#fff
    style API fill:#22c55e,color:#fff
    style MODEL fill:#c2413b,color:#fff
    style SLACK fill:#611f69,color:#fff
    style GAUGE fill:#f59e0b,color:#fff
```

### Backend Architecture
```mermaid
graph LR
    subgraph "FastAPI Backend (Port 8004)"
        MAIN[main.py - Application Entry]
        
        subgraph "Request Handlers"
            H1[Health Check]
            H2[Prediction Engine]
            H3[AI Recommender]
            H4[Explainability Engine]
            H5[Counterfactual Engine]
            H6[Batch Processing]
            H7[Slack Integration]
            H8[Customer Retriever]
        end
        
        subgraph "Business Logic"
            ML[model.py]
            CF[counterfactual.py]
            SC[schemas.py]
        end
        
        subgraph "Data Layer"
            CSV1[customers_base.csv]
            CSV2[train_churn_synth.csv]
            PKL[churn_model.pkl]
        end
    end
    
    CLIENT[Client Requests] -->|HTTP/JSON| MAIN
    
    MAIN --> H1
    MAIN --> H2
    MAIN --> H3
    MAIN --> H4
    MAIN --> H5
    MAIN --> H6
    MAIN --> H7
    MAIN --> H8
    
    H2 --> ML
    H3 --> ML
    H3 --> CF
    H4 --> ML
    H5 --> ML
    H5 --> CF
    H6 --> ML
    H6 --> CF
    H8 --> CSV1
    
    ML --> PKL
    ML --> CSV2
    CF --> CSV1
    
    H7 -->|Webhook POST| SLACK[Slack API]
    
    style MAIN fill:#2d6cdf,color:#fff
    style ML fill:#c2413b,color:#fff
    style CF fill:#f59e0b,color:#fff
    style H3 fill:#22c55e,color:#fff
```

### Frontend Extension Architecture
```mermaid
flowchart TB
    subgraph Extension["Tableau Dashboard Extension"]
        INIT[Extension Initialization]
        SEL[Mark Selection Listener]
        OPTIMIZE[AI Auto-Optimize Click]
        SLIDE[Slider Input Listeners]
        BTN[Button Click Handlers]
        STATUS[Status Display - Pulse]
        CUST[Customer Info Panel]
        GAUGE[Animated Risk Gauge]
        CHART2[Feature Importance Chart]
        TABLE[Top Regret Table]
        CONFIG[Settings Panel]
        FETCH1[API: Counterfactual]
        FETCH2[API: Predict]
        FETCH3[API: Recommend]
        FETCH4[API: Metadata]
        STATE[Current Customer Data]
    end
    
    INIT -->|initializeAsync| SEL
    
    SEL -->|getMarksAsync| FETCH4
    FETCH4 --> CHART2
    
    OPTIMIZE --> FETCH3
    FETCH3 --> GAUGE
    FETCH3 --> STATE
    
    SLIDE -->|Real-time| FETCH2
    FETCH2 --> GAUGE
    
    BTN -->|Refresh| FETCH1
    FETCH1 --> TABLE
    
    STATE -.->|Store| CUST
    STATE -.->|Update| GAUGE
    
    style INIT fill:#2d6cdf,color:#fff
    style SEL fill:#22c55e,color:#fff
    style GAUGE fill:#f59e0b,color:#fff
    style CHART2 fill:#8b5cf6,color:#fff
    style OPTIMIZE fill:#22c55e,color:#fff
```

## 🛠 Setup & Local Development

### 1) Prerequisites
- Python 3.11+
- Tableau Cloud Developer Site (Get one at [tableau.com/developer](https://tableau.com/developer))

### 2) Install Dependencies
```bash
python3 -m venv venv
source venv/bin/activate
pip install -r backend/requirements.txt
```

### 3) Generate Data & Train Model
This script generates synthetic customer data, trains the ML model, and exports the base scenario CSVs to the `outputs/` folder.
```bash
export PYTHONPATH=$PYTHONPATH:.
python3 scripts/run_demo.py
```

### 4) Start the Application
You need to run the Backend and the Extension UI simultaneously.

**Backend (Port 8004):**
```bash
source venv/bin/activate
export PYTHONPATH=$PYTHONPATH:.
uvicorn backend.main:app --reload --port 8004
```

**Extension UI (Port 3004):**
```bash
cd extension
python3 -m http.server 3004
```

## ☁️ Deployment (Render.com)
This project is pre-configured for **Docker-based deployment** on Render.

1. **GitHub**: Push this repository to GitHub.
2. **Render**: Create a new **Web Service** on [Render.com](https://render.com).
3. **Config**: 
   - Environment: **Docker**
   - Environment Variable: `PORT` = `8004`
4. **Tableau**: Once deployed, update the `url` in `extension/counterfactual-command-center.trex` to your Render URL.

## 📊 Tableau Cloud Integration
1. **Data**: Upload `outputs/customers_scored_base.csv` as a Published Data Source.
2. **Dashboard**: Create a workbook, add a bar chart of `Customer Id` vs `Churn Risk Base`.
3. **Extension**: Drag the "Extension" object onto your dashboard and select the `extension/counterfactual-command-center.trex` file.
4. **Security**: Add your extension URL (Localhost or Render) to the **Safe List** under Site Settings -> Extensions.

## 🎥 Submission Requirements
- **Video**: Record a 3-5 minute demo showing the "What-If" simulator and Slack trigger.
- **Documentation**: Use the Devpost "Project Story" to explain the Decision Regret logic.
- **Deadline**: Monday, January 12th @ 12:00pm PST.

## 🔑 Environment Variables
- `SLACK_WEBHOOK_URL`: (Optional) URL for Slack notifications.
- `MODEL_PATH`: (Optional) Custom path to saved model.
- `BASE_CUSTOMERS_CSV`: (Optional) Custom path to customer data.
