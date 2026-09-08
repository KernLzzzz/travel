package com.travel.ai.security;

import com.travel.ai.common.BizException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

@Component
public class JwtInterceptor implements HandlerInterceptor {
  private final JwtService jwt;
  public JwtInterceptor(JwtService jwt) { this.jwt = jwt; }
  @Override public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
    String header = request.getHeader("Authorization");
    if (header == null || !header.startsWith("Bearer ")) throw new BizException("请先登录", 401);
    UserContext.set(jwt.parse(header.substring(7)));
    return true;
  }
  @Override public void afterCompletion(HttpServletRequest request, HttpServletResponse response, Object handler, Exception ex) { UserContext.clear(); }
}
