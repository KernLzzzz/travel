package com.travel.ai.common;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class GlobalExceptionHandler {
  @ExceptionHandler(BizException.class)
  public ResponseEntity<ApiResponse<Void>> biz(BizException e) {
    return ResponseEntity.status(e.status()).body(new ApiResponse<>(e.status(), e.getMessage(), null));
  }
  @ExceptionHandler(DataIntegrityViolationException.class)
  public ResponseEntity<ApiResponse<Void>> duplicate(DataIntegrityViolationException e) {
    return ResponseEntity.status(409).body(new ApiResponse<>(409, "数据已存在或关联数据无效", null));
  }
  @ExceptionHandler(Exception.class)
  public ResponseEntity<ApiResponse<Void>> unknown(Exception e) {
    return ResponseEntity.status(500).body(new ApiResponse<>(500, "服务内部错误", null));
  }
}
