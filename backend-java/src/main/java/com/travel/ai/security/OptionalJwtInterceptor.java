package com.travel.ai.security;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

@Component
public class OptionalJwtInterceptor implements HandlerInterceptor {
  private final JwtService jwt;
  public OptionalJwtInterceptor(JwtService jwt) { this.jwt = jwt; }
  @Override public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
    String header = request.getHeader("Authorization");
    if (header != null && header.startsWith("Bearer ")) UserContext.set(jwt.parse(header.substring(7)));
    return true;
  }
  @Override public void afterCompletion(HttpServletRequest request, HttpServletResponse response, Object handler, Exception ex) { UserContext.clear(); }
}
