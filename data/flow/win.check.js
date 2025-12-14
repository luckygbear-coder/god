(() => {
  const root = (window.WW_DATA = window.WW_DATA || {});

  function checkWin(players){
    const alive = players.filter(p => p.alive);
    const wolves = alive.filter(p => p.team === "wolf");
    const good   = alive.filter(p => p.team === "villager");

    if(wolves.length === 0){
      return { ended:true, winner:"good" };
    }
    if(wolves.length >= good.length){
      return { ended:true, winner:"wolf" };
    }
    return { ended:false };
  }

  root.winCheck = { checkWin };
})();
