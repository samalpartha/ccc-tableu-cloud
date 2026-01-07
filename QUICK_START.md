# Quick Deployment Checklist

## ✅ Pre-Deployment
- [ ] Code pushed to GitHub: https://github.com/samalpartha/ccc-tableu-cloud
- [ ] Render.com account created
- [ ] Tableau Cloud Developer site access

## 🚀 Render Deployment (5 minutes)

1. **Go to Render**: https://dashboard.render.com
2. **New Web Service** → Connect GitHub → Select `ccc-tableu-cloud`
3. **Settings**:
   - Name: `counterfactual-command-center`
   - Runtime: **Docker**
   - Branch: `main`
   - Instance: Free
4. **Deploy** → Wait 5-10 minutes
5. **Copy URL**: `https://YOUR-APP.onrender.com`
6. **Test**: Visit `https://YOUR-APP.onrender.com/health`

## 📊 Tableau Configuration (10 minutes)

### A. Upload Data
1. Generate data locally:
   ```bash
   python3 -m venv venv
   source venv/bin/activate
   pip install -r backend/requirements.txt
   export PYTHONPATH=$PYTHONPATH:.
   python3 scripts/run_demo.py
   ```
2. Upload `outputs/customers_scored_base.csv` to Tableau Cloud
3. Publish as "Customer Churn Data"

### B. Create Dashboard
1. New Workbook → Connect to data source
2. Create bar chart:
   - Rows: `Customer Id`
   - Columns: `Churn Risk Base`
   - Color: Red-Green
3. Save as "Churn Analysis Dashboard"

### C. Add Extension
1. Drag **Extension** object to dashboard
2. Upload `extension/counterfactual-command-center.trex`
3. **Settings** → **Extensions** → Add to safe list:
   ```
   https://YOUR-APP.onrender.com
   ```

### D. Configure Extension
1. API Base URL: `https://YOUR-APP.onrender.com`
2. Save settings
3. Test by clicking a customer bar

## 🎬 Demo Script

1. **Show dashboard** → "Here's our customer churn analysis"
2. **Click high-risk customer** → Extension loads
3. **Point to chart** → "These features drive the risk"
4. **Move sliders** → "What if we reduce support tickets?"
5. **Show risk drop** → "Real-time counterfactual analysis"
6. **Refresh batch** → "Top customers to target"
7. **Trigger Slack** → "One-click action"

## 🔧 Troubleshooting

| Issue | Solution |
|-------|----------|
| Extension won't load | Add Render URL to Tableau safe list |
| API errors | Check API Base URL in extension settings |
| Slow first load | Render free tier spins down (30-60s wake) |
| Build fails | Check Render logs, verify requirements.txt |

## 📱 Important URLs

- **GitHub**: https://github.com/samalpartha/ccc-tableu-cloud
- **Render Dashboard**: https://dashboard.render.com
- **Your API Docs**: `https://YOUR-APP.onrender.com/docs`
- **Tableau Cloud**: https://YOUR-SITE.online.tableau.com

## 💡 Pro Tips

- Test locally first: `uvicorn backend.main:app --reload --port 8004`
- Free tier sleeps after 15 min → First request slow
- Push to `main` branch auto-deploys to Render
- Check Render logs for debugging
- Use paid tier for demo day (no cold starts)
