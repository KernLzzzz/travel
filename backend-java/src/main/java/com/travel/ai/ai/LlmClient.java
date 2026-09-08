package com.travel.ai.ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.travel.ai.config.AppProperties;
import java.time.Duration;
import java.util.*;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.MediaType;
import org.springframework.http.codec.ServerSentEvent;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Flux;

/** OpenAI 兼容接口的轻量流式客户端；未配置 Key 时自动返回 Mock 流，方便完整联调。 */
@Service
public class LlmClient {
  private final AppProperties.Llm config; private final WebClient client;
  public LlmClient(AppProperties properties, WebClient.Builder builder) { this.config=properties.llm(); this.client=builder.baseUrl(config.baseUrl()).build(); }
  public boolean isMock() { return config.apiKey() == null || config.apiKey().isBlank(); }
  public Flux<String> stream(String system, String user, String mockText) {
    if (isMock()) return split(mockText == null ? "（Mock 模式）请配置 LLM_API_KEY 调用真实模型。" : mockText, 12, 30);
    Map<String,Object> payload=Map.of("model",config.model(),"stream",true,"temperature",config.temperature(),"max_tokens",config.maxTokens(),"messages",List.of(Map.of("role","system","content",system),Map.of("role","user","content",user)));
    return client.post().uri("/chat/completions").contentType(MediaType.APPLICATION_JSON).accept(MediaType.TEXT_EVENT_STREAM).header("Authorization","Bearer "+config.apiKey()).bodyValue(payload).retrieve()
        .bodyToFlux(new ParameterizedTypeReference<ServerSentEvent<String>>(){}).mapNotNull(event -> content(event.data())).filter(text -> !text.isBlank());
  }
  private String content(String data) { if(data==null||"[DONE]".equals(data))return null; try { JsonNode root=new com.fasterxml.jackson.databind.ObjectMapper().readTree(data); JsonNode node=root.path("choices").path(0).path("delta").path("content"); return node.isMissingNode()||node.isNull()?null:node.asText(); } catch(Exception e) { return null; } }
  private Flux<String> split(String text,int step,long delay){List<String> parts=new ArrayList<>();for(int i=0;i<text.length();i+=step)parts.add(text.substring(i,Math.min(text.length(),i+step)));return Flux.fromIterable(parts).delayElements(Duration.ofMillis(delay));}
  public Map<String,Object> info(){return Map.of("provider",config.provider(),"model",config.model(),"baseUrl",config.baseUrl(),"mock",isMock());}
}
