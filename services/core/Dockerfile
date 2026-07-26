# Core Service Dockerfile — Java 21 + Spring Boot（多阶段构建，国内镜像加速）
# 使用 maven 预装镜像，避免 apk add maven 从 Alpine 源下载慢的问题
FROM maven:3.9-eclipse-temurin-21-alpine AS builder

# 配置 Maven 阿里云镜像加速
RUN mkdir -p /root/.m2 && \
    echo '<?xml version="1.0" encoding="UTF-8"?><settings xmlns="http://maven.apache.org/SETTINGS/1.0.0"><mirrors><mirror><id>aliyun</id><mirrorOf>central</mirrorOf><url>https://maven.aliyun.com/repository/public</url></mirror></mirrors></settings>' > /root/.m2/settings.xml

WORKDIR /app
COPY pom.xml .
# 先下载依赖（利用 Docker 层缓存，后续构建跳过此步）
RUN mvn dependency:go-offline -B -q || true
COPY src/ src/
RUN mvn clean package -DskipTests -B -q

FROM eclipse-temurin:21-jre-alpine

WORKDIR /app
COPY --from=builder /app/target/*.jar app.jar

RUN addgroup -S appgroup && adduser -S appuser -G appgroup && \
    chown -R appuser:appgroup /app

USER appuser

EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
