import json
import urllib.request

BASE = 'http://127.0.0.1:8000/api/v1'

def req(url, method='GET', data=None, token=None):
    headers = {'Content-Type': 'application/json'}
    if token:
        headers['Authorization'] = f'Bearer {token}'
    data_bytes = json.dumps(data).encode('utf-8') if data else None
    r = urllib.request.Request(url, data=data_bytes, headers=headers, method=method)
    with urllib.request.urlopen(r) as response:
        return json.loads(response.read().decode('utf-8'))

# 1. Login Admin
login_res = req(f'{BASE}/auth/login', method='POST', data={'email': 'admin@stocksense.io', 'password': 'adminpassword123'})
print('1. Auth Login: SUCCESS -> User:', login_res['user']['name'], '| Role:', login_res['user']['role']['name'])
token = login_res['access_token']

# 2. Get Products
prods = req(f'{BASE}/products', token=token)
print('2. Products Catalog: SUCCESS -> Total SKUs:', len(prods), '| Available SKUs:', [p['sku'] for p in prods])
mcu_prod = next(p for p in prods if p['sku'] == 'MCU-STM32F4')
alum_prod = next(p for p in prods if p['sku'] == 'RAW-ALUM-2020')

# 3. Invariant Check
inv_res = req(f'{BASE}/inventory/invariant-check', token=token)
print('3. Invariant Check: SUCCESS -> is_valid:', inv_res['is_valid'], '| Discrepancies:', len(inv_res['discrepancies']))

# 4. Forecast for MCU-STM32F4 (Trending item)
fc_res = req(f"{BASE}/intelligence/forecast/{mcu_prod['id']}", token=token)
print('4. Forecast MCU-STM32F4: SUCCESS -> Trend:', fc_res['trend'], '| 7d MA:', round(fc_res['moving_avg_7d'],2), '| 28d MA:', round(fc_res['moving_avg_28d'],2))

# 5. Stockout Risk Overview
so_res = req(f'{BASE}/intelligence/stockout-risk', token=token)
print('5. Stockout Risk Overview: SUCCESS -> Evaluated SKUs:', len(so_res), '| High/Med Risk Items:', [x['sku'] for x in so_res if x['risk_tier'] in ['HIGH', 'MEDIUM']])

# 6. Reorder Recommendations
ro_res = req(f'{BASE}/intelligence/reorder-recommendations', token=token)
print('6. Reorder Recommendations: SUCCESS -> Actionable SKUs requiring reorder:', sum(1 for x in ro_res if x['recommended_reorder_qty'] > 0), '| Total SKUs:', len(ro_res))

# 7. Explainability Report
ex_res = req(f"{BASE}/intelligence/explain/{mcu_prod['id']}", token=token)
print('7. Explainability Bullets: SUCCESS ->', len(ex_res['explanation_bullets']), 'Auditable bullets generated:')
for b in ex_res['explanation_bullets']:
    print(f'   • {b}')

# 8. Anomaly Scan
an_scan = req(f'{BASE}/anomalies/detect', method='POST', token=token)
print('8. Anomaly Scan: SUCCESS ->', an_scan['message'])
an_list = req(f'{BASE}/anomalies', token=token)
print('   Detected Anomalies:', len(an_list), 'items | Flagged SKUs:', [a['sku'] for a in an_list])

# 9. Known Events
ke_list = req(f'{BASE}/anomalies/known-events', token=token)
print('9. Known Events: SUCCESS ->', [e['name'] for e in ke_list])

# 10. Stock Health Composite Score
sh_res = req(f'{BASE}/intelligence/stock-health-score', token=token)
print('10. Stock Health Composite Score: SUCCESS -> Score:', sh_res['overall_health_score'], '/ 100 | Status:', sh_res['status'])
print('    Sub-scores Breakdown:', sh_res['composite_sub_scores'])

# 11. Notifications Scan
nt_scan = req(f'{BASE}/notifications/scan', method='POST', token=token)
print('11. Notifications Scan: SUCCESS -> Generated Alerts:', nt_scan['new_notifications_count'])
nt_list = req(f'{BASE}/notifications', token=token)
print('    Active Notifications Feed:', len(nt_list), 'alerts in drawer')

# 12. Cold Start item check (RAW-ALUM-2020)
fc_alum = req(f"{BASE}/intelligence/forecast/{alum_prod['id']}", token=token)
print('12. Cold-Start Fallback (RAW-ALUM-2020): SUCCESS -> is_cold_start:', fc_alum.get('is_cold_start'), '| Forecast Rate:', round(fc_alum.get('forecasted_daily_demand'),2))
