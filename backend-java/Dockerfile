FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /app
COPY pom.xml .
RUN mvn -q -DskipTests dependency:go-offline
COPY src src
RUN mvn -q -DskipTests package

FROM eclipse-temurin:17-jre
WORKDIR /app
RUN useradd --system --create-home spring \
    && apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*
COPY --from=build /app/target/travel-ai-backend-1.0.0.jar app.jar
USER spring
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --start-period=30s --retries=10 CMD curl -fsS http://localhost:3000/api/health || exit 1
ENTRYPOINT ["java", "-jar", "app.jar"]
