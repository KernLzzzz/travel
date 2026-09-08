package com.travel.ai.security;

public final class UserContext {
  private static final ThreadLocal<Long> USER_ID = new ThreadLocal<>();
  private UserContext() {}
  public static void set(Long id) { USER_ID.set(id); }
  public static Long getRequired() { Long id = USER_ID.get(); if (id == null) throw new IllegalStateException("未认证用户"); return id; }
  public static Long getOptional() { return USER_ID.get(); }
  public static void clear() { USER_ID.remove(); }
}
