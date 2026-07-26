#!/usr/bin/env python3
"""在 nginx.conf 的 yun.gxjugu.com server 块中追加 AiDesign 路由"""

import shutil

CONF = '/etc/nginx/nginx.conf'
BAK = '/etc/nginx/nginx.conf.bak-aidesign'
INSERT_MARKER = '        # frp 代理\n'

AIDESIGN_LOCATIONS = """        # === AiDesign 施工图 AI 平台 ===
        # API 代理：去掉 /aidesign 前缀，后端服务不感知子路径
        location /aidesign/api/bff/ {
            proxy_pass http://127.0.0.1:18060/;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_set_header X-Trace-Id $request_id;
            proxy_http_version 1.1;
            proxy_set_header Connection "";
        }

        location /aidesign/api/core/ {
            proxy_pass http://127.0.0.1:18040/;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Trace-Id $request_id;
        }

        location /aidesign/api/ai/ {
            proxy_pass http://127.0.0.1:18050/;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_read_timeout 60s;
        }

        # Next.js 静态资源：/aidesign/_next/ → 去掉前缀转发（Next.js 内部 /_next/）
        location /aidesign/_next/ {
            proxy_pass http://127.0.0.1:18070;
            proxy_set_header Host $host;
        }

        # 前端页面：保留 /aidesign 前缀转发（Next.js basePath 需要）
        # 注意：不带尾部斜杠以匹配 /aidesign 和 /aidesign/ 两种情况
        location /aidesign {
            proxy_pass http://127.0.0.1:18070/aidesign;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_set_header X-Trace-Id $request_id;
            proxy_http_version 1.1;
            proxy_set_header Connection "";
        }
        # === AiDesign END ===

"""

shutil.copy(CONF, BAK)
print(f"已备份: {BAK}")

with open(CONF, 'r') as f:
    content = f.read()

if AIDESIGN_LOCATIONS in content:
    print("AiDesign 路由已存在，跳过")
else:
    # 在 # frp 代理 前插入
    new_content = content.replace(INSERT_MARKER, AIDESIGN_LOCATIONS + INSERT_MARKER)
    if new_content == content:
        print("错误: 未找到插入标记 # frp 代理")
    else:
        with open(CONF, 'w') as f:
            f.write(new_content)
        print("AiDesign 路由已插入")
