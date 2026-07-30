#!/bin/bash
# 合规规则种子数据导入脚本
# 通过 BFF API 创建 6 条示例规则 + 1 个规则集
# 使用方式：bash scripts/seed-compliance-rules.sh

set -e

API_BASE="http://127.0.0.1:18060/api/v1"
TENANT_ID="00000000-0000-0000-0000-000000000001"
EMAIL="admin@aidesign.com"
PASSWORD="Test@123456"

# ── 1. 登录获取 token ──
echo ">>> 登录获取 Token..."
LOGIN_RESP=$(curl -s -X POST "${API_BASE}/auth/login" \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: ${TENANT_ID}" \
  -d "{\"email\":\"${EMAIL}\",\"password\":\"${PASSWORD}\"}")

TOKEN=$(echo "$LOGIN_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['accessToken'])" 2>/dev/null)
if [ -z "$TOKEN" ]; then
  echo "错误：登录失败 - $LOGIN_RESP"
  exit 1
fi
echo "Token: ${TOKEN:0:20}..."

AUTH_HEADERS=(-H "Authorization: Bearer $TOKEN" -H "x-tenant-id: $TENANT_ID" -H "Content-Type: application/json")

# ── 2. 创建 6 条合规规则（含 DSL JSON 版本） ──
echo ""
echo ">>> 创建合规规则..."

create_rule() {
  local code=$1 name=$2 category=$3 desc=$4 dsl=$5
  echo "  - $code: $name"
  
  # 创建规则
  RULE_RESP=$(curl -s -X POST "${API_BASE}/compliance-rules" \
    "${AUTH_HEADERS[@]}" \
    -d "{\"ruleCode\":\"$code\",\"name\":\"$name\",\"category\":\"$category\",\"description\":\"$desc\"}")

  RULE_ID=$(echo "$RULE_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])" 2>/dev/null)
  if [ -z "$RULE_ID" ]; then
    echo "    错误: $RULE_RESP"
    return 1
  fi

  # 创建修订版本（含 DSL JSON）
  REV_RESP=$(curl -s -X POST "${API_BASE}/compliance-rules/${RULE_ID}/revisions" \
    "${AUTH_HEADERS[@]}" \
    -d "{\"dslJson\":$(echo "$dsl" | python3 -c 'import sys,json; print(json.dumps(sys.stdin.read()))'),\"engineProfile\":\"v0-prototype\",\"basis\":\"ISO 19650 / NFPA 101\"}")

  REV_ID=$(echo "$REV_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])" 2>/dev/null)
  echo "    ruleId=$RULE_ID revisionId=$REV_ID"
  echo "$REV_ID"
}

# DSL1: 属性检查 - 办公面积下限
R1_ID=$(create_rule "BUA-MIN-OFFICE-001" "办公空间最小面积" "Geometry" \
  "办公空间净面积不得小于 10 m²" \
  '{"ruleType":"PROPERTY_CHECK","targetProperty":"area","operator":"GREATER_THAN_OR_EQUAL","threshold":10.0,"unit":"m2","objectType":"Space"}')

# DSL2: 数量检查 - 每层最少卫生间
R2_ID=$(create_rule "BUA-SANITARY-COUNT-001" "每层卫生设施数量" "Spatial" \
  "每层至少设置 2 组卫生间（男+女）" \
  '{"ruleType":"COUNT_CHECK","filterProperty":"spaceType","filterValue":"RESTROOM","minCount":2,"perLevel":true,"objectType":"Space"}')

# DSL3: 范围检查 - 走廊宽度
R3_ID=$(create_rule "FIRE-CORRIDOR-WIDTH-001" "疏散走廊最小净宽" "FireSafety" \
  "疏散走廊净宽不得小于 1100mm" \
  '{"ruleType":"RANGE_CHECK","targetProperty":"netWidth","minValue":1100,"maxValue":null,"unit":"mm","objectType":"Corridor"}')

# DSL4: 属性检查 - 层高
R4_ID=$(create_rule "BUA-FLOOR-HEIGHT-001" "办公楼层最小净高" "Geometry" \
  "办公楼层净高不得小于 2700mm" \
  '{"ruleType":"PROPERTY_CHECK","targetProperty":"clearHeight","operator":"GREATER_THAN_OR_EQUAL","threshold":2700,"unit":"mm","objectType":"Level"}')

# DSL5: 数量检查 - 疏散楼梯
R5_ID=$(create_rule "FIRE-STAIR-COUNT-001" "疏散楼梯数量" "FireSafety" \
  "地上层数>=5层时至少设置 2 部疏散楼梯" \
  '{"ruleType":"COUNT_CHECK","filterProperty":"stairType","filterValue":"EGRESS","minCount":2,"condition":{"targetProperty":"aboveGroundFloors","operator":"GREATER_THAN_OR_EQUAL","threshold":5},"objectType":"Stair"}')

# DSL6: 范围检查 - 防火分区面积
R6_ID=$(create_rule "FIRE-COMPARTMENT-AREA-001" "防火分区最大面积" "FireSafety" \
  "高层办公建筑防火分区最大允许建筑面积 1500 m²" \
  '{"ruleType":"RANGE_CHECK","targetProperty":"grossArea","minValue":null,"maxValue":1500,"unit":"m2","objectType":"Compartment"}')

echo ""
echo ">>> 规则创建完成："
echo "  R1 (属性检查-面积): $R1_ID"
echo "  R2 (数量检查-卫生间): $R2_ID"
echo "  R3 (范围检查-走廊): $R3_ID"
echo "  R4 (属性检查-层高): $R4_ID"
echo "  R5 (数量检查-楼梯): $R5_ID"
echo "  R6 (范围检查-防火分区): $R6_ID"

# ── 3. 创建规则集 ──
echo ""
echo ">>> 创建规则集..."
RS_RESP=$(curl -s -X POST "${API_BASE}/rule-sets" \
  "${AUTH_HEADERS[@]}" \
  -d "{\"name\":\"中小型办公建筑消防与空间合规规则集\",\"description\":\"V0 测试用规则集，覆盖消防疏散与基本空间规范\",\"stageCode\":\"SD\",\"initialRules\":[{\"revisionId\":\"$R1_ID\",\"priority\":1},{\"revisionId\":\"$R2_ID\",\"priority\":2},{\"revisionId\":\"$R3_ID\",\"priority\":3},{\"revisionId\":\"$R4_ID\",\"priority\":4},{\"revisionId\":\"$R5_ID\",\"priority\":5},{\"revisionId\":\"$R6_ID\",\"priority\":6}]}")

RS_ID=$(echo "$RS_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])" 2>/dev/null)
echo "  规则集 ID: $RS_ID"
echo "  规则集名称: 中小型办公建筑消防与空间合规规则集"

# ── 4. 验证 ──
echo ""
echo ">>> 验证数据..."
RULE_COUNT=$(curl -s "${API_BASE}/compliance-rules?page=1&pageSize=20" "${AUTH_HEADERS[@]}" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data']['total'])" 2>/dev/null)
RS_COUNT=$(curl -s "${API_BASE}/rule-sets?page=1&pageSize=20" "${AUTH_HEADERS[@]}" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data']['total'])" 2>/dev/null)
echo "  规则总数: $RULE_COUNT"
echo "  规则集数: $RS_COUNT"

if [ "$RULE_COUNT" -ge 6 ] && [ "$RS_COUNT" -ge 1 ]; then
  echo ""
  echo "✅ 种子数据导入成功!"
  echo "  规则集 ID: $RS_ID (可用于创建合规检查运行)"
else
  echo ""
  echo "❌ 验证失败，请检查 API 响应"
  exit 1
fi
