package com.travel.ai.chat;

import com.travel.ai.ai.AiGateway;
import com.travel.ai.ai.LlmClient;
import com.travel.ai.common.ApiResponse;
import com.travel.ai.common.BizException;
import com.travel.ai.security.UserContext;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.*;
import java.util.concurrent.atomic.AtomicReference;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import reactor.core.Disposable;

/** 保留原聊天 API：游客可对话，登录用户可持久化会话与最近 20 条上下文。 */
@RestController
@RequestMapping("/api/chat")
public class ChatController {
  private final JdbcTemplate jdbc; private final LlmClient llm; private final AiGateway gateway;
  public ChatController(JdbcTemplate jdbc,LlmClient llm,AiGateway gateway){this.jdbc=jdbc;this.llm=llm;this.gateway=gateway;}
  @PostMapping(value="/completions",produces=MediaType.TEXT_EVENT_STREAM_VALUE)
  public SseEmitter complete(@RequestBody Map<String,Object> body,HttpServletRequest request,HttpServletResponse response){
    String message=String.valueOf(body.getOrDefault("message","")).trim(),sessionId=body.get("sessionId")==null?null:String.valueOf(body.get("sessionId")); if(message.isBlank())throw new BizException("消息内容不能为空",400); Long user=UserContext.getOptional(); if(sessionId!=null&&user!=null)assertOwned(sessionId,user);
    List<Map<String,Object>> history=sessionId==null?List.of():jdbc.queryForList("SELECT role,content FROM chat_messages WHERE session_id=? ORDER BY created_at ASC,id ASC",sessionId); String context=history.stream().skip(Math.max(0,history.size()-20)).map(m->m.get("role")+":"+m.get("content")).reduce("",(a,b)->a+"\n"+b); String userPrompt=(context.isBlank()?"":("历史对话："+context+"\n"))+"用户问题："+message;
    response.setHeader("Cache-Control","no-cache, no-transform");response.setHeader("X-Accel-Buffering","no");SseEmitter emitter=new SseEmitter(125000L);String rateKey=user==null?"ip:"+request.getRemoteAddr():"user:"+user;String cacheKey=history.isEmpty()?"chat:"+AiGateway.hash(message):null;StringBuilder full=new StringBuilder();AtomicReference<Disposable> ref=new AtomicReference<>();
    try{emitter.send(SseEmitter.event().name("start").data(data("traceId",UUID.randomUUID().toString(),"sessionId",sessionId)));}catch(IOException e){emitter.completeWithError(e);return emitter;}
    Disposable d=gateway.stream(rateKey,cacheKey,()->llm.stream("你是专业、友好、务实的中文旅游顾问。直接给结论；不确定的实时信息不得编造。",userPrompt,"你问的是："+message+"\n\n这是 Mock 模式的旅游建议。配置 LLM_API_KEY 后可获得真实模型回答。")) .subscribe(chunk->{full.append(chunk);try{emitter.send(SseEmitter.event().name("chunk").data(Map.of("content",chunk)));}catch(IOException e){Disposable x=ref.get();if(x!=null)x.dispose();}},err->sendError(emitter,err.getMessage()),()->{if(sessionId!=null&&user!=null){save(sessionId,"user",message);save(sessionId,"assistant",full.toString());jdbc.update("UPDATE chat_sessions SET title=CASE WHEN title='新的对话' THEN ? ELSE title END WHERE id=?",message.substring(0,Math.min(20,message.length())),sessionId);}try{emitter.send(SseEmitter.event().name("done").data(data("reply",full.toString(),"sessionId",sessionId)));emitter.complete();}catch(IOException e){sendError(emitter,e.getMessage());}});ref.set(d);emitter.onCompletion(()->{Disposable x=ref.get();if(x!=null)x.dispose();});return emitter;
  }
  @GetMapping("/sessions") public ApiResponse<List<Map<String,Object>>> sessions(){return ApiResponse.ok(jdbc.queryForList("SELECT id,title,created_at,updated_at FROM chat_sessions WHERE user_id=? ORDER BY updated_at DESC LIMIT 50",UserContext.getRequired()),"成功");}
  @PostMapping("/sessions") public ApiResponse<Map<String,Object>> create(@RequestBody(required=false) Map<String,Object> body){String id=UUID.randomUUID().toString(),title=body==null?"新的对话":String.valueOf(body.getOrDefault("title","新的对话"));jdbc.update("INSERT INTO chat_sessions(id,user_id,title) VALUES(?,?,?)",id,UserContext.getRequired(),title);return ApiResponse.ok(Map.of("id",id,"title",title),"会话创建成功");}
  @GetMapping("/sessions/{id}/messages") public ApiResponse<List<Map<String,Object>>> messages(@PathVariable String id){assertOwned(id,UserContext.getRequired());return ApiResponse.ok(jdbc.queryForList("SELECT id,role,content,created_at FROM chat_messages WHERE session_id=? ORDER BY created_at ASC,id ASC",id),"成功");}
  @DeleteMapping("/sessions/{id}") public ApiResponse<Void> delete(@PathVariable String id){if(jdbc.update("DELETE FROM chat_sessions WHERE id=? AND user_id=?",id,UserContext.getRequired())==0)throw new BizException("会话不存在或无权删除",404);return ApiResponse.ok(null,"会话已删除");}
  @GetMapping("/quick-questions") public ApiResponse<List<String>> quick(){return ApiResponse.ok(List.of("北京有哪些必去的景点？","上海三日游怎么安排最合理？","成都的特色美食推荐","带老人出行需要注意什么？"),"成功");}
  private void assertOwned(String id,long user){Integer count=jdbc.queryForObject("SELECT COUNT(*) FROM chat_sessions WHERE id=? AND user_id=?",Integer.class,id,user);if(count==null||count==0)throw new BizException("会话不存在或无权访问",404);}private void save(String id,String role,String content){jdbc.update("INSERT INTO chat_messages(session_id,role,content) VALUES(?,?,?)",id,role,content);}private void sendError(SseEmitter e,String msg){try{e.send(SseEmitter.event().name("error").data(Map.of("message",msg==null?"对话失败，请稍后重试":msg)));}catch(IOException ignored){}e.complete();}private Map<String,Object> data(Object... values){Map<String,Object> map=new LinkedHashMap<>();for(int i=0;i<values.length;i+=2)map.put(String.valueOf(values[i]),values[i+1]);return map;}
}
