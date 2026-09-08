package com.travel.ai.security;

import com.travel.ai.common.BizException;
import com.travel.ai.config.AppProperties;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Date;
import javax.crypto.SecretKey;
import org.springframework.stereotype.Service;

@Service
public class JwtService {
  private final AppProperties.Jwt config;
  public JwtService(AppProperties properties) { this.config = properties.jwt(); }
  private SecretKey key() {
    byte[] bytes = config.secret().getBytes(StandardCharsets.UTF_8);
    if (bytes.length < 32) throw new BizException("JWT_SECRET 长度至少为 32 字节", 500);
    return Keys.hmacShaKeyFor(bytes);
  }
  public String create(Long userId) {
    return Jwts.builder().subject(String.valueOf(userId)).issuedAt(new Date())
        .expiration(new Date(System.currentTimeMillis() + duration().toMillis())).signWith(key()).compact();
  }
  public Long parse(String token) {
    try { return Long.valueOf(Jwts.parser().verifyWith(key()).build().parseSignedClaims(token).getPayload().getSubject()); }
    catch (Exception e) { throw new BizException("登录已过期或 Token 无效", 401); }
  }
  private Duration duration() {
    String raw = config.expiresIn();
    try {
      if (raw.endsWith("d")) return Duration.ofDays(Long.parseLong(raw.substring(0, raw.length() - 1)));
      if (raw.endsWith("h")) return Duration.ofHours(Long.parseLong(raw.substring(0, raw.length() - 1)));
      return Duration.ofSeconds(Long.parseLong(raw));
    } catch (Exception e) { return Duration.ofDays(7); }
  }
}
