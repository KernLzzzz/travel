package com.travel.ai.common;

public class BizException extends RuntimeException {
  private final int status;
  public BizException(String message, int status) { super(message); this.status = status; }
  public int status() { return status; }
}
