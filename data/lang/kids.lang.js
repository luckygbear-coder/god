(() => {
  const root = (window.WW_DATA = window.WW_DATA || {});

  /* =========================================
     小朋友模式｜文字轉換器
  ========================================= */

  function nightScript(script, kidsMode){
    if(!kidsMode) return script;

    return script
      .replace(/狼人/g, "調皮的影子")
      .replace(/刀誰？/g, "要去找誰？")
      .replace(/殺/g, "讓人離開")
      .replace(/天黑請閉眼/g, "夜晚來了，大家先休息一下")
      .replace(/請睜眼/g, "慢慢醒來囉")
      .replace(/死亡/g, "離開")
      .replace(/死/g, "離開");
  }

  function publicAnnouncement(text, context){
    if(!context.kidsMode) return text;

    let hint = "";

    // 平安夜推測
    if(context.resolved?.deaths?.length === 0){
      if(context.night?.witchSave){
        hint = "昨晚有人受傷，但被溫柔地照顧好了。";
      } else if(context.night?.guardTarget){
        hint = "昨晚有人被好好守護著。";
      } else {
        hint = "昨晚很平靜，大家都睡得很好。";
      }
    }

    // 有人離開
    if(context.resolved?.deaths?.length === 1){
      hint = "昨晚有一位夥伴先離開去休息了。";
    }

    if(context.resolved?.deaths?.length >= 2){
      hint = "昨晚發生了很多事情，有幾位夥伴離開了。";
    }

    return (
      text
        .replace(/死亡/g, "離開")
        .replace(/處刑/g, "送去休息")
        .replace(/殺/g, "讓人離開")
      + "\n\n🐻 熊熊提醒：" + hint
    );
  }

  root.kidsLang = {
    nightScript,
    publicAnnouncement
  };
})();
