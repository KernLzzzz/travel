package com.travel.ai.travel;

import com.travel.ai.ai.AiGateway;
import com.travel.ai.ai.LlmClient;
import com.travel.ai.common.ApiResponse;
import com.travel.ai.common.Jsons;
import com.travel.ai.security.UserContext;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.*;
import java.util.concurrent.atomic.AtomicReference;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import reactor.core.Disposable;

@RestController
@RequestMapping("/api/travel")
public class TravelController {
  private final TravelService travel; private final LlmClient llm; private final AiGateway gateway; private final Jsons jsons;
  public TravelController(TravelService travel,LlmClient llm,AiGateway gateway,Jsons jsons){this.travel=travel;this.llm=llm;this.gateway=gateway;this.jsons=jsons;}
  @PostMapping(value="/recommend",produces=MediaType.TEXT_EVENT_STREAM_VALUE)
  public SseEmitter recommend(@RequestBody Map<String,Object> body, HttpServletRequest request, HttpServletResponse response){
    Map<String,Object> params=travel.validate(body); response.setHeader("Cache-Control","no-cache, no-transform");response.setHeader("X-Accel-Buffering","no");response.setHeader("Connection","keep-alive"); SseEmitter emitter=new SseEmitter(125000L); String rateKey=UserContext.getOptional()!=null?"user:"+UserContext.getOptional():"ip:"+request.getRemoteAddr(); String cacheKey="itinerary:"+AiGateway.hash(params.toString()); String traceId=UUID.randomUUID().toString(); StringBuilder raw=new StringBuilder(); AtomicReference<Disposable> subscription=new AtomicReference<>();
    try { emitter.send(SseEmitter.event().name("start").data(Map.of("message","正在生成旅游规划...","traceId",traceId))); } catch(IOException e){emitter.completeWithError(e);return emitter;}
    Disposable disposable=gateway.stream(rateKey,cacheKey,()->llm.stream(travel.systemPrompt(),travel.userPrompt(params),travel.mock(params))).subscribe(chunk->{raw.append(chunk);try{emitter.send(SseEmitter.event().name("chunk").data(Map.of("content",chunk)));}catch(IOException e){Disposable d=subscription.get();if(d!=null)d.dispose();}},error->{sendError(emitter,error.getMessage());},()->{try{emitter.send(SseEmitter.event().name("done").data(Map.of("itinerary",travel.normalize(raw.toString(),params))));emitter.complete();}catch(Exception e){sendError(emitter,e.getMessage());}});
    subscription.set(disposable); emitter.onCompletion(()->{Disposable d=subscription.get();if(d!=null)d.dispose();}); emitter.onTimeout(()->{Disposable d=subscription.get();if(d!=null)d.dispose();}); return emitter;
  }
  @GetMapping("/meta") public ApiResponse<Map<String,Object>> meta(){return ApiResponse.ok(Map.of("hotCities",List.of("北京","上海","广州","深圳","成都","杭州","西安","重庆","南京","武汉","苏州","长沙","天津","青岛","厦门","三亚"),"quickQuestions",List.of("帮我推荐适合周末游的城市","第一次去北京怎么玩")),"成功");}
  @PostMapping("/swap") public ApiResponse<Map<String,Object>> swap(@RequestBody Map<String,Object> body,HttpServletRequest request){
    String city=String.valueOf(body.getOrDefault("city","")).trim(); Object current=body.get("current"); if(city.isBlank()||!(current instanceof Map<?,?> currentMap)||!currentMap.containsKey("spot")) throw new com.travel.ai.common.BizException("缺少目的地城市或当前景点信息",400);
    String rateKey=UserContext.getOptional()!=null?"user:"+UserContext.getOptional():"ip:"+request.getRemoteAddr(); String prompt="为"+city+"的旅游行程替换景点。当前景点："+currentMap.get("spot")+"。请仅返回 JSON：{\"spot\":\"地点\",\"duration\":\"时长\",\"ticket\":\"费用\",\"transportation\":\"交通\",\"description\":\"理由\"}"; StringBuilder full=new StringBuilder();
    gateway.stream(rateKey,null,()->llm.stream("你是旅游规划师，只返回 JSON。",prompt,"{\"spot\":\"城市艺术街区\",\"duration\":\"约2小时\",\"ticket\":\"免费\",\"transportation\":\"地铁直达\",\"description\":\"与原安排类型不同，适合轻松游览。\"}")).doOnNext(full::append).blockLast();
    Map<String,Object> slot=jsons.map(full.toString()); if(slot==null)throw new com.travel.ai.common.BizException("模型返回内容无法解析，请重试",502); return ApiResponse.ok(Map.of("slot",slot),"已为你换了一个新去处");
  }
  private void sendError(SseEmitter emitter,String message){try{emitter.send(SseEmitter.event().name("error").data(Map.of("message",message==null?"生成失败，请稍后重试":message)));}catch(IOException ignored){}emitter.complete();}
}
