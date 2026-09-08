package com.travel.ai.auth;

import com.travel.ai.common.BizException;
import com.travel.ai.common.Jsons;
import com.travel.ai.security.JwtService;
import java.sql.PreparedStatement;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class AuthService {
  private final JdbcTemplate jdbc;
  private final JwtService jwt;
  private final Jsons jsons;
  private final BCryptPasswordEncoder encoder = new BCryptPasswordEncoder(10);
  public AuthService(JdbcTemplate jdbc, JwtService jwt, Jsons jsons) { this.jdbc = jdbc; this.jwt = jwt; this.jsons = jsons; }

  public Map<String, Object> register(Map<String, Object> body) {
    String username = str(body, "username"); String password = str(body, "password"); String nickname = str(body, "nickname");
    if (username.isBlank() || password.isBlank()) throw new BizException("用户名和密码不能为空", 400);
    if (!username.matches("^[a-zA-Z0-9_]{3,20}$")) throw new BizException("用户名只能包含字母、数字、下划线，长度 3-20 位", 400);
    if (password.length() < 6) throw new BizException("密码长度不能少于 6 位", 400);
    if (jdbc.queryForObject("SELECT COUNT(*) FROM users WHERE username = ?", Integer.class, username) > 0) throw new BizException("该用户名已被注册", 409);
    KeyHolder holder = new GeneratedKeyHolder();
    String finalNickname = nickname.isBlank() ? username : nickname;
    jdbc.update(con -> { PreparedStatement ps = con.prepareStatement("INSERT INTO users(username,password,nickname) VALUES(?,?,?)", new String[]{"id"});
      ps.setString(1, username); ps.setString(2, encoder.encode(password)); ps.setString(3, finalNickname); return ps; }, holder);
    long id = holder.getKey().longValue();
    return Map.of("token", jwt.create(id), "user", Map.of("id", id, "username", username, "nickname", finalNickname));
  }

  public Map<String, Object> login(Map<String, Object> body) {
    String username = str(body, "username"); String password = str(body, "password");
    if (username.isBlank() || password.isBlank()) throw new BizException("用户名和密码不能为空", 400);
    var users = jdbc.queryForList("SELECT id,username,password,nickname,avatar FROM users WHERE username=? LIMIT 1", username);
    if (users.isEmpty()) throw new BizException("用户不存在", 401);
    Map<String, Object> user = users.get(0);
    if (!encoder.matches(password, String.valueOf(user.get("password")))) throw new BizException("密码错误", 401);
    Map<String, Object> publicUser = new LinkedHashMap<>();
    publicUser.put("id", user.get("id")); publicUser.put("username", user.get("username")); publicUser.put("nickname", user.get("nickname")); publicUser.put("avatar", user.get("avatar"));
    return Map.of("token", jwt.create(((Number) user.get("id")).longValue()), "user", publicUser);
  }

  public Map<String, Object> profile(long id) {
    var users = jdbc.queryForList("SELECT id,username,nickname,avatar,preferences,created_at FROM users WHERE id=? LIMIT 1", id);
    if (users.isEmpty()) throw new BizException("用户不存在", 404);
    Map<String, Object> user = new LinkedHashMap<>(users.get(0));
    user.put("preferences", jsons.map((String) user.get("preferences")));
    return user;
  }
  public Map<String, Object> updateProfile(long id, Map<String, Object> body) {
    String nickname = str(body, "nickname"); String avatar = str(body, "avatar");
    if (nickname.isBlank() && avatar.isBlank()) throw new BizException("没有需要更新的内容", 400);
    jdbc.update("UPDATE users SET nickname=COALESCE(?,nickname), avatar=COALESCE(?,avatar) WHERE id=?", nickname.isBlank() ? null : nickname, avatar.isBlank() ? null : avatar, id);
    return jdbc.queryForMap("SELECT id,username,nickname,avatar FROM users WHERE id=?", id);
  }
  public Map<String, Object> updatePreferences(long id, Map<String, Object> body) {
    Map<String, Object> pref = new LinkedHashMap<>();
    copyClamped(body, pref, "homeCity", 30, null, null); copyClamped(body, pref, "companion", 20, null, null);
    copyClamped(body, pref, "pacing", 10, null, null); copyClamped(body, pref, "defaultPreference", 100, null, null);
    copyClamped(body, pref, "defaultBudget", 0, 0d, 100000d); copyClamped(body, pref, "defaultDays", 0, 1d, 15d); copyClamped(body, pref, "defaultTravelers", 0, 1d, 20d);
    Object themes = body.get("themes"); if (themes instanceof java.util.List<?> list) pref.put("themes", list.stream().limit(10).map(v -> String.valueOf(v).substring(0, Math.min(20, String.valueOf(v).length()))).toList());
    if (pref.isEmpty()) throw new BizException("没有需要更新的偏好内容", 400);
    jdbc.update("UPDATE users SET preferences=? WHERE id=?", jsons.write(pref), id); return pref;
  }
  public void changePassword(long id, Map<String, Object> body) {
    String oldPassword = str(body, "oldPassword"), newPassword = str(body, "newPassword");
    if (oldPassword.isBlank() || newPassword.isBlank()) throw new BizException("请填写旧密码与新密码", 400);
    if (newPassword.length() < 6) throw new BizException("新密码长度不能少于 6 位", 400);
    if (oldPassword.equals(newPassword)) throw new BizException("新密码不能与旧密码相同", 400);
    var rows = jdbc.queryForList("SELECT password FROM users WHERE id=?", id); if (rows.isEmpty()) throw new BizException("用户不存在", 404);
    if (!encoder.matches(oldPassword, String.valueOf(rows.get(0).get("password")))) throw new BizException("旧密码不正确", 400);
    jdbc.update("UPDATE users SET password=? WHERE id=?", encoder.encode(newPassword), id);
  }
  private static String str(Map<String, Object> body, String key) { Object v = body.get(key); return v == null ? "" : String.valueOf(v).trim(); }
  private static void copyClamped(Map<String, Object> source, Map<String, Object> target, String key, int maxChars, Double min, Double max) {
    if (!source.containsKey(key)) return; Object val = source.get(key);
    if (min != null) { double number; try { number = Double.parseDouble(String.valueOf(val)); } catch (Exception e) { number = min; } target.put(key, Math.max(min, Math.min(max, number))); }
    else { String text = String.valueOf(val); target.put(key, text.substring(0, Math.min(maxChars, text.length()))); }
  }
}
