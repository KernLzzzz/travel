package com.travel.ai.itinerary;

import com.travel.ai.common.BizException;
import com.travel.ai.common.Jsons;
import java.sql.PreparedStatement;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Service;

@Service
public class ItineraryService {
  private final JdbcTemplate jdbc; private final Jsons jsons;
  public ItineraryService(JdbcTemplate jdbc, Jsons jsons) { this.jdbc = jdbc; this.jsons = jsons; }
  public Map<String, Object> create(long userId, Map<String, Object> body) {
    String city = text(body, "city"); Object content = body.get("content");
    if (city.isBlank() || content == null) throw new BizException("城市和行程内容不能为空", 400);
    int budget = number(body.get("budget"), 0), days = Math.max(1, number(body.get("days"), 1));
    String title = text(body, "title"); if (title.isBlank()) title = city + days + "日游";
    String finalTitle = title; KeyHolder holder = new GeneratedKeyHolder();
    jdbc.update(con -> { PreparedStatement ps = con.prepareStatement("INSERT INTO itineraries(user_id,title,city,budget,days,content) VALUES(?,?,?,?,?,?)", new String[]{"id"});
      ps.setLong(1, userId); ps.setString(2, finalTitle); ps.setString(3, city); ps.setInt(4, budget); ps.setInt(5, days); ps.setString(6, jsons.write(content)); return ps; }, holder);
    return Map.of("id", holder.getKey().longValue(), "title", title);
  }
  public Map<String, Object> list(long userId, Map<String, String> query) {
    int page = Math.max(1, integer(query.get("page"), 1)); int pageSize = Math.min(50, Math.max(1, integer(query.get("pageSize"), 10))); int offset = (page - 1) * pageSize;
    List<Object> args = new ArrayList<>(); args.add(userId); List<String> conditions = new ArrayList<>(List.of("user_id=?"));
    if ("1".equals(query.get("favorite")) || "true".equals(query.get("favorite"))) conditions.add("is_favorite=1");
    String city = trim(query.get("city")); if (!city.isBlank()) { conditions.add("city=?"); args.add(city); }
    String q = trim(query.get("q")); if (!q.isBlank()) { conditions.add("(title LIKE ? OR city LIKE ?)"); args.add("%" + q + "%"); args.add("%" + q + "%"); }
    String where = " WHERE " + String.join(" AND ", conditions);
    String orderBy = Map.of("budget_desc", "budget DESC", "budget_asc", "budget ASC", "days_desc", "days DESC", "days_asc", "days ASC").getOrDefault(query.get("sort"), "created_at DESC");
    List<Object> dataArgs = new ArrayList<>(args); dataArgs.add(pageSize); dataArgs.add(offset);
    List<Map<String, Object>> list = jdbc.queryForList("SELECT id,title,city,budget,days,is_favorite,created_at,JSON_UNQUOTE(JSON_EXTRACT(content,'$.summary')) AS summary FROM itineraries" + where + " ORDER BY " + orderBy + " LIMIT ? OFFSET ?", dataArgs.toArray());
    Integer total = jdbc.queryForObject("SELECT COUNT(*) FROM itineraries" + where, Integer.class, args.toArray());
    List<String> cities = jdbc.queryForList("SELECT city FROM itineraries WHERE user_id=? AND city IS NOT NULL AND city != '' GROUP BY city ORDER BY MAX(created_at) DESC", String.class, userId);
    return Map.of("list", list, "cities", cities, "pagination", Map.of("page", page, "pageSize", pageSize, "total", total, "totalPages", (int) Math.ceil(total / (double) pageSize)));
  }
  public Map<String, Object> detail(long userId, long id) {
    List<Map<String, Object>> rows = jdbc.queryForList("SELECT * FROM itineraries WHERE id=? AND user_id=? LIMIT 1", id, userId);
    if (rows.isEmpty()) throw new BizException("行程不存在或无权访问", 404);
    Map<String, Object> item = new LinkedHashMap<>(rows.get(0)); item.put("content", jsons.map((String) item.get("content"))); return item;
  }
  public void update(long userId, long id, Map<String, Object> body) {
    if (!body.containsKey("content") && !body.containsKey("title") && !body.containsKey("budget")) throw new BizException("没有需要更新的内容", 400);
    if (body.containsKey("content") && !(body.get("content") instanceof Map<?, ?>)) throw new BizException("行程内容格式不正确", 400);
    List<String> fields = new ArrayList<>(); List<Object> args = new ArrayList<>();
    if (body.containsKey("content")) { fields.add("content=?"); args.add(jsons.write(body.get("content"))); }
    if (body.containsKey("title")) { String title = text(body, "title"); if (title.isBlank()) throw new BizException("标题不能为空", 400); fields.add("title=?"); args.add(title); }
    if (body.containsKey("budget")) { int budget = number(body.get("budget"), -1); if (budget < 0) throw new BizException("预算格式不正确", 400); fields.add("budget=?"); args.add(budget); }
    args.add(id); args.add(userId); if (jdbc.update("UPDATE itineraries SET " + String.join(",", fields) + " WHERE id=? AND user_id=?", args.toArray()) == 0) throw new BizException("行程不存在或无权操作", 404);
  }
  public void delete(long userId, long id) { if (jdbc.update("DELETE FROM itineraries WHERE id=? AND user_id=?", id, userId) == 0) throw new BizException("行程不存在或无权删除", 404); }
  public Map<String, Object> toggleFavorite(long userId, long id) {
    List<Map<String, Object>> rows = jdbc.queryForList("SELECT is_favorite FROM itineraries WHERE id=? AND user_id=?", id, userId); if (rows.isEmpty()) throw new BizException("行程不存在或无权操作", 404);
    boolean next = !Boolean.TRUE.equals(rows.get(0).get("is_favorite")) && ((Number) rows.get(0).get("is_favorite")).intValue() == 0; jdbc.update("UPDATE itineraries SET is_favorite=? WHERE id=?", next, id);
    return Map.of("isFavorite", next, "message", next ? "已收藏" : "已取消收藏");
  }
  public Map<String, Object> stats(long userId) {
    Map<String, Object> overview = jdbc.queryForMap("SELECT COUNT(*) tripCount,COALESCE(SUM(days),0) totalDays,COALESCE(SUM(budget),0) totalBudget,COALESCE(SUM(is_favorite),0) favoriteCount FROM itineraries WHERE user_id=?", userId);
    List<Map<String, Object>> cities = jdbc.queryForList("SELECT city,COUNT(*) tripCount,COALESCE(SUM(days),0) totalDays,COALESCE(SUM(budget),0) totalBudget FROM itineraries WHERE user_id=? AND city IS NOT NULL AND city != '' GROUP BY city ORDER BY tripCount DESC,totalBudget DESC LIMIT 12", userId);
    List<Map<String, Object>> recent = jdbc.queryForList("SELECT id,title,city,days,budget,created_at FROM itineraries WHERE user_id=? ORDER BY created_at DESC LIMIT 6", userId);
    return Map.of("overview", overview, "cities", cities, "recent", recent);
  }
  private static String text(Map<String,Object> data,String key){ Object value=data.get(key); return value==null?"":String.valueOf(value).trim(); }
  private static String trim(String value){ return value==null?"":value.trim(); }
  private static int integer(String value,int fallback){ try{return Integer.parseInt(value);}catch(Exception e){return fallback;} }
  private static int number(Object value,int fallback){ try { return Integer.parseInt(String.valueOf(value)); } catch(Exception e) { return fallback; } }
}
