package com.travel.ai.travel;

import com.travel.ai.common.BizException;
import com.travel.ai.common.Jsons;
import java.util.*;
import org.springframework.stereotype.Service;

@Service
public class TravelService {
  private final Jsons jsons;
  public TravelService(Jsons jsons) { this.jsons = jsons; }
  public Map<String,Object> validate(Map<String,Object> body) {
    String city = text(body,"city"); int budget = number(body.get("budget"),0), days = number(body.get("days"),0);
    if(city.isBlank())throw new BizException("请填写目的地城市",400); if(budget<=0)throw new BizException("预算必须是大于 0 的数字",400); if(days<1||days>15)throw new BizException("旅行天数必须是 1 到 15 之间的整数",400);
    Map<String,Object> params = new LinkedHashMap<>(); params.put("city",city);params.put("budget",budget);params.put("days",days);
    copyText(body,params,"startDate",20);copyText(body,params,"companion",20);copyText(body,params,"pacing",10);copyText(body,params,"preference",200); if(body.containsKey("travelers"))params.put("travelers",number(body.get("travelers"),1));
    if(body.get("themes") instanceof List<?> themes) params.put("themes",themes.stream().map(String::valueOf).map(String::trim).filter(s->!s.isEmpty()).limit(6).toList()); else params.put("themes",List.of());
    return params;
  }
  public String systemPrompt(){return "你是一位专业旅游规划师。只输出可被 JSON.parse 解析的 JSON，不要 Markdown。预算明细各项之和必须等于用户总预算；每一天都包含 morning、afternoon、evening。";}
  public String userPrompt(Map<String,Object> p){return "请生成旅游行程：目的地="+p.get("city")+"；总预算="+p.get("budget")+"元；天数="+p.get("days")+"；同行人="+p.getOrDefault("companion","未指定")+"；节奏="+p.getOrDefault("pacing","适中")+"；主题="+p.get("themes")+"。JSON 字段应为 city,days,totalBudget,summary,dailyItinerary,budgetBreakdown,tips,warnings。";}
  public String mock(Map<String,Object> p){int budget=(int)p.get("budget"),days=(int)p.get("days"); List<Map<String,Object>> daily=new ArrayList<>(); for(int i=1;i<=days;i++)daily.add(Map.of("day",i,"date","第"+i+"天","theme","经典路线","morning",slot("城市博物馆"),"afternoon",slot("历史老街"),"evening",slot("特色美食街"))); int accommodation=Math.round(budget*.35f),food=Math.round(budget*.25f),transportation=Math.round(budget*.15f),tickets=Math.round(budget*.15f); Map<String,Object> result=new LinkedHashMap<>();result.put("city",p.get("city"));result.put("days",days);result.put("totalBudget",budget);result.put("summary",String.valueOf(p.get("city"))+days+"日经典行程");result.put("dailyItinerary",daily);result.put("budgetBreakdown",Map.of("accommodation",accommodation,"food",food,"transportation",transportation,"tickets",tickets,"other",budget-accommodation-food-transportation-tickets));result.put("tips",List.of("热门景点建议预约"));result.put("warnings",List.of("出行前核实开放时间"));return jsons.write(result);}
  @SuppressWarnings("unchecked") public Map<String,Object> normalize(String raw,Map<String,Object> params){Map<String,Object> parsed=jsons.map(extractJson(raw));if(parsed==null)throw new BizException("模型返回内容无法解析为有效行程，请重试",502);int days=(int)params.get("days"),budget=(int)params.get("budget");List<?> original=parsed.get("dailyItinerary") instanceof List<?> v?v:List.of();List<Map<String,Object>> daily=new ArrayList<>();for(int i=0;i<days;i++){Map<String,Object> day=i<original.size()&&original.get(i) instanceof Map<?,?> m?new LinkedHashMap<>((Map<String,Object>)m):new LinkedHashMap<>();day.put("day",i+1);day.putIfAbsent("date","第"+(i+1)+"天");day.putIfAbsent("theme","第"+(i+1)+"天行程");day.putIfAbsent("morning",slot("自由安排"));day.putIfAbsent("afternoon",slot("自由安排"));day.putIfAbsent("evening",slot("自由活动"));daily.add(day);}Map<String,Object> out=new LinkedHashMap<>();out.put("city",parsed.getOrDefault("city",params.get("city")));out.put("days",days);out.put("totalBudget",budget);out.put("summary",parsed.getOrDefault("summary",params.get("city")+"行程"));out.put("dailyItinerary",daily);out.put("budgetBreakdown",normalizeBudget(parsed.get("budgetBreakdown"),budget));out.put("tips",parsed.getOrDefault("tips",List.of("建议提前预约热门景点")));out.put("warnings",parsed.getOrDefault("warnings",List.of("行程仅供参考")));return out;}
  private Map<String,Object> normalizeBudget(Object input,int budget){String[] keys={"accommodation","food","transportation","tickets","other"};Map<String,Object> raw=input instanceof Map<?,?> map?(Map<String,Object>)map:Map.of();double sum=0;double[] values=new double[5];for(int i=0;i<5;i++){values[i]=number(raw.get(keys[i]),0);sum+=values[i];}Map<String,Object> out=new LinkedHashMap<>();if(sum==0){values=new double[]{budget*.35,budget*.25,budget*.15,budget*.15,budget*.10};sum=budget;}int allocated=0;for(int i=0;i<keys.length;i++){int value=i==keys.length-1?budget-allocated:(int)Math.round(values[i]/sum*budget);out.put(keys[i],value);allocated+=value;}return out;}
  private static Map<String,Object> slot(String name){return Map.of("spot",name,"duration","约 2 小时","ticket","待定","transportation","公共交通","description","可根据实际情况调整");}
  private static String extractJson(String raw){int first=raw.indexOf('{'),last=raw.lastIndexOf('}');return first>=0&&last>first?raw.substring(first,last+1):raw;}
  private static int number(Object v,int d){try{return Integer.parseInt(String.valueOf(v));}catch(Exception e){return d;}} private static String text(Map<String,Object>b,String k){return String.valueOf(b.getOrDefault(k," ")).trim();}private static void copyText(Map<String,Object>from,Map<String,Object>to,String key,int max){if(from.containsKey(key)){String s=String.valueOf(from.get(key)).trim();to.put(key,s.substring(0,Math.min(max,s.length())));}}
}
