package com.travel.ai.itinerary;

import com.travel.ai.common.ApiResponse;
import com.travel.ai.security.UserContext;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/itinerary")
public class ItineraryController {
  private final ItineraryService service;
  public ItineraryController(ItineraryService service) { this.service = service; }
  @PostMapping public ResponseEntity<ApiResponse<Map<String,Object>>> create(@RequestBody Map<String,Object> body) { return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok(service.create(UserContext.getRequired(), body), "行程保存成功")); }
  @GetMapping public ApiResponse<Map<String,Object>> list(@RequestParam Map<String,String> query) { return ApiResponse.ok(service.list(UserContext.getRequired(), query), "成功"); }
  @GetMapping("/stats") public ApiResponse<Map<String,Object>> stats() { return ApiResponse.ok(service.stats(UserContext.getRequired()), "成功"); }
  @GetMapping("/{id}") public ApiResponse<Map<String,Object>> detail(@PathVariable long id) { return ApiResponse.ok(service.detail(UserContext.getRequired(), id), "成功"); }
  @PutMapping("/{id}") public ApiResponse<Void> update(@PathVariable long id,@RequestBody Map<String,Object> body) { service.update(UserContext.getRequired(),id,body); return ApiResponse.ok(null,"行程已更新"); }
  @DeleteMapping("/{id}") public ApiResponse<Void> delete(@PathVariable long id) { service.delete(UserContext.getRequired(),id); return ApiResponse.ok(null,"行程已删除"); }
  @PostMapping("/{id}/favorite") public ApiResponse<Map<String,Object>> favorite(@PathVariable long id) { Map<String,Object> data=service.toggleFavorite(UserContext.getRequired(),id); return ApiResponse.ok(Map.of("isFavorite",data.get("isFavorite")),String.valueOf(data.get("message"))); }
}
