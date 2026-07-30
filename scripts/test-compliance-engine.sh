#!/bin/bash
# Test compliance check execution engine
set -e

API="http://127.0.0.1:18060/api/v1"
TID="00000000-0000-0000-0000-000000000001"
RS_ID="41d8a6f9-4981-4e39-aa05-08f5739869f0"

# 1. Login
echo "=== 1. Login ==="
LOGIN=$(curl -s -X POST "$API/auth/login" \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: $TID" \
  -d '{"email":"admin@aidesign.com","password":"Test@123456"}')
TOKEN=$(echo "$LOGIN" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d['data']['accessToken'])")
echo "OK"

# 2. Create check run
echo ""
echo "=== 2. Create Check Run ==="
CR_RESP=$(curl -s -X POST "$API/compliance-checks" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: $TID" \
  -d "{\"ruleSetId\":\"$RS_ID\",\"projectId\":null}")
CR_ID=$(echo "$CR_RESP" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d['data']['id'])")
echo "CheckRun ID: $CR_ID"

# 3. Execute
echo ""
echo "=== 3. Execute Check Run ==="
EXEC_RESP=$(curl -s -X POST "$API/compliance-checks/$CR_ID/execute" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: $TID")
echo "$EXEC_RESP" | python3 -c "
import sys,json
d=json.load(sys.stdin)
rd=d['data']
print('Status: ' + rd['status'])
outcome = rd.get('outcomeSummary','')
print('Outcome: ' + outcome[:120])
print('Executions: ' + str(len(rd.get('executions',[]))))
for ex in rd.get('executions',[]):
    rev = ex['revisionId'][:8]
    print('  [' + ex['status'] + '] rev=' + rev + ' P:' + str(ex['passCount']) + ' F:' + str(ex['failCount']) + ' NA:' + str(ex['notApplicableCount']) + ' E:' + str(ex['errorCount']) + ' MR:' + str(ex['manualReviewCount']) + ' | ' + str(ex.get('durationMs',0)) + 'ms')
"

# 4. Check findings
echo ""
echo "=== 4. Findings ==="
curl -s "$API/compliance-findings?page=1&pageSize=20" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: $TID" | python3 -c "
import sys,json
d=json.load(sys.stdin)
print('Total findings: ' + str(d['data']['total']))
"
