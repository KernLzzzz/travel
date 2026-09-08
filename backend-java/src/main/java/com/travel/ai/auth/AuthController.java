package com.travel.ai.auth;

import com.travel.ai.common.ApiResponse;
import com.travel.ai.security.UserContext;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
  private final AuthService service;
  public AuthController(AuthService service) { this.service = service; }
  @PostMapping("/register") public ResponseEntity<ApiResponse<Map<String, Object>>> register(@RequestBody Map<String, Object> body) { return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok(service.register(body), "注册成功")); }
  @PostMapping("/login") public ApiResponse<Map<String, Object>> login(@RequestBody Map<String, Object> body) { return ApiResponse.ok(service.login(body), "登录成功"); }
  @GetMapping("/profile") public ApiResponse<Map<String, Object>> profile() { return ApiResponse.ok(service.profile(UserContext.getRequired()), "成功"); }
  @PutMapping("/profile") public ApiResponse<Map<String, Object>> updateProfile(@RequestBody Map<String, Object> body) { return ApiResponse.ok(service.updateProfile(UserContext.getRequired(), body), "资料更新成功"); }
  @PutMapping("/preferences") public ApiResponse<Map<String, Object>> preferences(@RequestBody Map<String, Object> body) { return ApiResponse.ok(service.updatePreferences(UserContext.getRequired(), body), "偏好已保存"); }
  @PostMapping("/change-password") public ApiResponse<Void> changePassword(@RequestBody Map<String, Object> body) { service.changePassword(UserContext.getRequired(), body); return ApiResponse.ok(null, "密码修改成功"); }
}
