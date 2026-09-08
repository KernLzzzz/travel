package com.travel.ai.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app")
public record AppProperties(Jwt jwt, String corsOrigin, Llm llm, Ai ai) {
  public record Jwt(String secret, String expiresIn) {}
  public record Llm(String provider, String apiKey, String model, String baseUrl, double temperature, int maxTokens) {}
  public record Ai(int maxConcurrency, long timeoutMs, long stallMs, int rateCapacity,
                   double rateRefillPerSec, int cacheMax, long cacheTtlMs) {}
}
