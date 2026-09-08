package com.travel.ai;

import com.travel.ai.ai.AiGateway;
import com.travel.ai.ai.LlmClient;
import com.travel.ai.common.ApiResponse;
import java.util.Map;
import javax.sql.DataSource;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class HealthController {
  private final DataSource source; private final AiGateway gateway; private final LlmClient llm;
  public HealthController(DataSource source,AiGateway gateway,LlmClient llm){this.source=source;this.gateway=gateway;this.llm=llm;}
  @GetMapping("/api/health") public ApiResponse<Map<String,Object>> health(){boolean db;try(var con=source.getConnection()){db=con.isValid(2);}catch(Exception e){db=false;}return ApiResponse.ok(Map.of("status","ok","database",db,"llm",llm.info(),"aiGateway",gateway.metrics()),"成功");}
}
