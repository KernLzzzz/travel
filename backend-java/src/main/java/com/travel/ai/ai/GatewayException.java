package com.travel.ai.ai;

public class GatewayException extends RuntimeException {
  private final int status;
  public GatewayException(String message, int status) { super(message); this.status = status; }
  public int status() { return status; }
}
