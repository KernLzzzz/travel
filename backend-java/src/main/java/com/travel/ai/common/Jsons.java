package com.travel.ai.common;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.stereotype.Component;

@Component
public class Jsons {
  private final ObjectMapper mapper;
  public Jsons(ObjectMapper mapper) { this.mapper = mapper; }
  public String write(Object value) { try { return mapper.writeValueAsString(value); } catch (Exception e) { throw new BizException("JSON 序列化失败", 500); } }
  public Map<String, Object> map(String value) {
    if (value == null) return null;
    try { return mapper.readValue(value, new TypeReference<LinkedHashMap<String, Object>>() {}); }
    catch (Exception e) { return null; }
  }
  public ObjectMapper mapper() { return mapper; }
}
