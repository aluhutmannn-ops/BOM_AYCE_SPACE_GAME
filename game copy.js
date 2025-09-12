(() => {
  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  window.addEventListener("resize", resize);
  resize();

  // === HIGH SCORE STATE (stored in localStorage) ===
  let highScores = [];
  try { highScores = JSON.parse(localStorage.getItem("highScores") || "[]"); } catch (_) { highScores = []; }
  const MAX_HIGH_SCORES = 10;

  const bgImage = new Image(); bgImage.src = "background.png";
  const heartImg = new Image(); heartImg.src = "Heart.png";
  const sheepImg = new Image(); sheepImg.src = "Sheep_Player.png";
  const pigImg = new Image(); pigImg.src = "Pig_Player.png";
  const cowImg = new Image(); cowImg.src = "Cow_Player.png";
  const foodImgs = ["food.png","food1.png","food2.png","food3.png","food4.png","food5.png"]
    .map(src => { const i = new Image(); i.src = src; return i; });
  const drinkImgs = ["drink.png","drink1.png","drink2.png","drink3.png","drink4.png"]
    .map(src => { const i = new Image(); i.src = src; return i; });
  const chickenImg = new Image(); chickenImg.src = "crazy_chicken.png";
  const mooImg = new Image(); mooImg.src = "moo.png";
  const oinkImg = new Image(); oinkImg.src = "oink.png";
  const baaImg = new Image(); baaImg.src = "baa.png";
  const explosionImage = new Image(); explosionImage.src = "explosion.png";

  let itemSpawnCounter = 0;
  let enemySpawnCounter = 0;
  let gameOverAnim = null;
  let introImages = [];
  let introLoaded = 0;
  let introFilenames = ["intro.png", "intro1.png", "intro2.png"];

  introFilenames.forEach((file, i) => {
    let img = new Image();
    img.src = file;
    img.onload = () => {
      introLoaded++;
      if (introLoaded === introFilenames.length) {
        console.log("Intro images loaded");
      }
    };
    introImages.push(img);
  });

  // sound manager
  const sounds = {
    startScreen: { audio: new Audio('start_screen.mp3'), volume: 0.4 },
    buttonClick: { audio: new Audio('button_clicks.mp3'), volume: 0.4 },
    gameBG: { audio: new Audio('game_BG.mp3'), volume: 0.4 },
    eat: { audio: new Audio('eat.mp3'), volume: 0.4 },
    drink: { audio: new Audio('drink.mp3'), volume: 0.4 },
    explosion: { audio: new Audio('explosion.mp3'), volume: 0.4 },
    ending: { audio: new Audio('ending.mp3'), volume: 0.4 }
  };
  sounds.startScreen.audio.loop = true;
  sounds.gameBG.audio.loop = true;

  // helpers
  function playSound(soundEntry, overrideVolume = null) {
    if (!soundEntry || !soundEntry.audio) return;
    const snd = soundEntry.audio;
    const volume = overrideVolume ?? soundEntry.volume ?? 1;
    snd.currentTime = 0;
    snd.volume = volume;
    snd.play().catch(()=>{});
  }
  function stopSound(soundEntry) {
    if (!soundEntry || !soundEntry.audio) return;
    const snd = soundEntry.audio;
    snd.pause();
    snd.currentTime = 0;
  }

  // game state
  let state = "intro"; // "intro", "start", "play", "gameover"
  let selectedPlayer = null, playerImg = null;
  let bgX = 0, score = 0, level = 1, scrollSpeed = 4;
  let player = null;
  let keys = {};                 // initialize here so keyboard events don't crash
  let items = [], enemies = [];
  let characterBounds = [];
  let explosion = { x: 0, y: 0, visible: false, timer: 0 };
  let playButtonBounds = null;
  let levelBanner = null;

  function resetGame() {
    bgX = 0; score = 0; level = 1; scrollSpeed = 4;
    keys = {}; items = []; enemies = [];
    const playerWidth = canvas.width * 0.08;
    player = { x:100, y:canvas.height/2, width:playerWidth, height:playerWidth, speed:8, lives:3 };
    explosion.visible = false;
    explosion.timer = 0;
    explosion.x = 0;
    explosion.y = 0;
    player.dead = false;
    player.flashTimer = 0;
    player.flashCount = 0;
    player.flashVisible = true;
    drawGameOver._didHS = false;
    levelBanner = null;
  }

  // drawing / update functions (kept as in your working code)
  function drawIntroScreen() {
    ctx.drawImage(bgImage, 0, 0, canvas.width, canvas.height);
    if (introImages.length > 0) {
      let gap = 30;
      let panelHeight = canvas.height * 0.7;
      let panelWidth = introImages[0].width * (panelHeight / introImages[0].height);
      let startX = (canvas.width - (panelWidth * introImages.length + gap * (introImages.length - 1))) / 2;
      let y = canvas.height * 0.1;
      introImages.forEach((img, i) => {
        let x = startX + i * (panelWidth + gap);
        ctx.drawImage(img, x, y, panelWidth, panelHeight);
      });
    }
    let btnW = 200, btnH = 60;
    let btnX = (canvas.width - btnW) / 2;
    let btnY = canvas.height - btnH - 40;
    ctx.fillStyle = "#222";
    ctx.fillRect(btnX, btnY, btnW, btnH);
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 3;
    ctx.strokeRect(btnX, btnY, btnW, btnH);
    ctx.fillStyle = "#fff";
    ctx.font = "30px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("PLAY", btnX + btnW/2, btnY + btnH/2);
    playButtonBounds = { x: btnX, y: btnY, w: btnW, h: btnH };
  }

  function drawBackground(){
    ctx.drawImage(bgImage,bgX,0,canvas.width,canvas.height);
    ctx.drawImage(bgImage,bgX+canvas.width,0,canvas.width,canvas.height);
  }
  function updateBackground(){
    const bgSpeed = 3 + (level - 1) * 1.5;
    bgX -= bgSpeed;
    if (bgX <= -canvas.width) bgX = 0;
  }

  function updatePlayer(){
    if (!player) return;
    if (keys["ArrowUp"] && player.y > 0) player.y -= player.speed;
    if (keys["ArrowDown"] && player.y + player.height < canvas.height) player.y += player.speed;
    if (keys["ArrowLeft"] && player.x > 0) player.x -= player.speed;
    if (keys["ArrowRight"] && player.x + player.width < canvas.width) player.x += player.speed;
  }

  function drawPlayer(){
    if (!playerImg || !player) return;
    const playerWidth = canvas.width * 0.08;
    const aspect = (playerImg.height && playerImg.width) ? (playerImg.height / playerImg.width) : 1;
    const playerHeight = playerWidth * aspect;
    if (player.flashCount === 0 || player.flashVisible) {
      ctx.drawImage(playerImg, player.x, player.y, playerWidth, playerHeight);
    }
    player.width = playerWidth;
    player.height = playerHeight;
  }

  function spawnItem(){
    const pool = [
      ...foodImgs.map(img => ({ img, type:"food" })),
      ...drinkImgs.map(img => ({ img, type:"drink" }))
    ];
    const count = 1 + Math.floor(Math.random()*3);
    for (let n=0;n<count;n++) {
      const choice = pool[Math.floor(Math.random()*pool.length)];
      const maxWidth = canvas.width * 0.05;
      const maxHeight = canvas.height * 0.1;
      let width = maxWidth;
      let height = width * (choice.img.height / choice.img.width || 1);
      if (height > maxHeight) {
        height = maxHeight;
        width = height * (choice.img.width / choice.img.height || 1);
      }
      items.push({
        type: choice.type,
        x: canvas.width + n * 50,
        y: Math.random() * (canvas.height - height),
        width,
        height,
        img: choice.img,
        speed: scrollSpeed + 2 + level * 0.5
      });
    }
  }

  function spawnEnemy(){
    const count = 1 + Math.floor(Math.random()*3);
    for (let n=0;n<count;n++) {
      const r=Math.random();
      const choice = r<0.12? {img:chickenImg,type:"chicken"} :
        [{img:mooImg,type:"moo"},{img:oinkImg,type:"oink"},{img:baaImg,type:"baa"}][Math.floor(Math.random()*3)];
      const enemyWidth = canvas.width*0.06;
      const aspect = (choice.img.height && choice.img.width) ? (choice.img.height/choice.img.width) : 1;
      const enemyHeight = enemyWidth * aspect;
      const base = {
        type:choice.type,
        x:canvas.width + n*60,
        y:Math.random()*(canvas.height-enemyHeight),
        width:enemyWidth,
        height:enemyHeight,
        img:choice.img,
        speed:scrollSpeed + 2 + level * 0.6
      };
      if (choice.type === "chicken") {
        base.speed += 2;
        base.vy = (Math.random()<0.5 ? -1 : 1) * (2 + Math.random()*2);
        base.rotation = 0;
        base.rotSpeed = (Math.random()<0.5 ? -1 : 1) * (0.03 + Math.random()*0.15);
      }
      enemies.push(base);
    }
  }

  function isColliding(a,b){
    return a.x<b.x+b.width && a.x+a.width>b.x && a.y<b.y+b.height && a.y+a.height>b.y;
  }

  function updateItems(){
    for(let i=items.length-1;i>=0;i--){
      const it = items[i];
      it.x -= it.speed;
      if (it.x + it.width < 0) { items.splice(i,1); continue; }
      if (player && isColliding(player, it)) {
        score += it.type === "food" ? 5 : 2;
        playSound(it.type === "food" ? sounds.eat : sounds.drink, 0.7);
        items.splice(i,1);
      }
    }
  }

  function drawItems(){
    for(const it of items) ctx.drawImage(it.img,it.x,it.y,it.width,it.height);
  }

  function updateEnemies() {
    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i];
      e.x -= e.speed;
      if (e.type === "chicken") {
        e.y += e.vy;
        if (e.y <= 0) { e.y = 0; e.vy *= -1; }
        if (e.y + e.height >= canvas.height) { e.y = canvas.height - e.height; e.vy *= -1; }
        e.rotation += e.rotSpeed;
      }
      if (e.x + e.width < 0) {
        enemies.splice(i, 1);
        continue;
      }
      if (player && !player.flashActive && isColliding(player, e)) {
        player.lives--;
        explosion.x = player.x;
        explosion.y = player.y;
        explosion.visible = true;
        explosion.timer = 25;
        playSound(sounds.explosion, 0.9);
        enemies.splice(i, 1);
        if (player.lives <= 0) player.dead = true;
        player.flashTimer = 15;
        player.flashCount = 8;
        player.flashVisible = false;
        player.flashActive = true;
        break;
      }
    }
  }

  function drawEnemies(){
    for(const e of enemies){
      if(e.type==="chicken"){
        const cx=e.x+e.width/2, cy=e.y+e.height/2;
        ctx.save();
        ctx.translate(cx,cy);
        ctx.rotate(e.rotation);
        ctx.drawImage(e.img,-e.width/2,-e.height/2,e.width,e.height);
        ctx.restore();
      } else {
        ctx.drawImage(e.img,e.x,e.y,e.width,e.height);
      }
    }
  }

  function drawHUD(){
    if (!player) return;
    ctx.save();
    ctx.fillStyle='white';
    const fontSize = Math.max(canvas.height*0.025,16);
    ctx.font=fontSize+'px Arial';
    const padX=canvas.width*0.02, padY=canvas.height*0.02;
    let x=padX, y=padY+fontSize*0.2;
    ctx.textAlign='left'; ctx.textBaseline='top';
    ctx.fillText('Lives:', x, y);
    x += ctx.measureText('Lives:').width+canvas.width*0.01;
    const heartSize=Math.max(canvas.height*0.03,18), gap=Math.max(canvas.width*0.01,8);
    for(let i=0;i<player.lives;i++) ctx.drawImage(heartImg, x+i*(heartSize+gap), padY, heartSize, heartSize);
    x+=player.lives*(heartSize+gap)+canvas.width*0.02;
    ctx.fillText('Level: '+level,x,y);
    x+=ctx.measureText('Level: '+level).width+canvas.width*0.02;
    ctx.fillText('Score: '+score,x,y);
    ctx.restore();
  }

  function updateAndDrawLevelBanner() {
    if (!levelBanner) return;
    ctx.save();
    ctx.fillStyle = "yellow";
    ctx.font = levelBanner.fontSize + "px Arial Black";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(levelBanner.text, levelBanner.x, levelBanner.y);
    if (levelBanner.x > levelBanner.targetX) {
      levelBanner.x -= levelBanner.speed;
      if (levelBanner.x <= levelBanner.targetX) {
        levelBanner.x = levelBanner.targetX;
        setTimeout(() => {
          levelBanner = null;
        }, 1000);
      }
    }
    ctx.restore();
  }

  function checkLevelUp() {
    const newLevel = Math.floor(score / 100) + 1;
    if (newLevel > level) {
      level = newLevel;
      scrollSpeed = 3 + (level - 1) * 1.2;
      const text = "LEVEL " + level;
      const fontSize = Math.max(canvas.height * 0.15, 48);
      ctx.font = fontSize + "px Arial Black"; // measure using same font
      const textWidth = ctx.measureText(text).width;
      levelBanner = {
        text,
        fontSize,
        x: canvas.width,
        y: canvas.height / 2,
        targetX: (canvas.width - textWidth) / 2,
        speed: scrollSpeed,
        done: false
      };
    }
  }

  const characters=[
    {img:sheepImg,label:"Baa",name:"sheep"},
    {img:pigImg,label:"Oink",name:"pig"},
    {img:cowImg,label:"Moo",name:"cow"}
  ];

  function drawStartScreen(){
    drawBackground();
    ctx.save(); ctx.fillStyle='white'; ctx.textAlign='center';
    const titleSize=Math.max(canvas.height*0.06,24);
    ctx.font=titleSize+'px Arial';
    ctx.fillText('using the arrow keys',canvas.width/2,canvas.height*0.09);
    ctx.fillText('Dodge the farmyard animals to rescue food for Moon Base 1',canvas.width/2,canvas.height*0.09+titleSize*1.2);
    ctx.fillText('but watch out for that Crazy Chicken!!',canvas.width/2,canvas.height*0.09+titleSize*2.4);
    const subSize=Math.max(canvas.height*0.045,18);
    ctx.font=subSize+'px Arial'; ctx.fillText('Choose Player',canvas.width/2,canvas.height*0.32);
    const imgSize=Math.max(canvas.height*0.16,100), labelSize=Math.max(canvas.height*0.04,16);
    const spacing=Math.min(canvas.width*0.28,imgSize*1.6), startX=canvas.width/2-spacing, yImg=canvas.height*0.42;
    characterBounds.length=0;
    characters.forEach((ch,i)=>{
      const xCenter=startX+i*spacing, xImg=xCenter-imgSize/2;
      ctx.drawImage(ch.img,xImg,yImg,imgSize,imgSize);
      ctx.font=labelSize+'px Arial';
      const labelY=yImg+imgSize+labelSize*1.2;
      ctx.fillText(ch.label,xCenter,labelY);
      const pad=imgSize*0.1, textHeight=labelSize*1.2;
      const blockLeft=xImg-pad, blockWidth=imgSize+pad*2;
      characterBounds.push({x:blockLeft,y:yImg-pad,w:blockWidth,h:imgSize+textHeight+pad*2,index:i});
      if(selectedPlayer===i){
        ctx.strokeStyle='yellow';
        ctx.lineWidth=Math.max(canvas.height*0.005,3);
        ctx.strokeRect(blockLeft,yImg-pad,blockWidth,imgSize+textHeight+pad*2);
      }
    });
    ctx.restore();
  }

  function drawGameOver() {
    drawBackground();
    updateBackground();
    if (!gameOverAnim) {
      gameOverAnim = { scale: 0.1, target: 1.5, speed: 0.02, done: false, timer: 0 };
      stopSound(sounds.gameBG);
      playSound(sounds.ending, 0.8);
    }
    if (gameOverAnim.done && gameOverAnim.timer > 120) return;
    if (!gameOverAnim.done) {
      gameOverAnim.scale += gameOverAnim.speed;
      if (gameOverAnim.scale >= gameOverAnim.target) {
        gameOverAnim.scale = gameOverAnim.target;
        gameOverAnim.done = true;
      }
    } else {
      gameOverAnim.timer++;
      if (gameOverAnim.timer > 120 && !drawGameOver._didHS) {
        checkAndSaveHighScore(score);
        drawGameOver._didHS = true;
      }
    }
    ctx.save();
    ctx.fillStyle = "red";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const baseSize = Math.max(canvas.height * 0.12, 48);
    ctx.font = `${baseSize * gameOverAnim.scale}px Arial Black`;
    ctx.fillText("GAME OVER", canvas.width / 2, canvas.height / 2);
    ctx.restore();
  }

  // === HIGH SCORE HELPERS ===
  function qualifiesForHighScore(s){
    if (MAX_HIGH_SCORES <= 0) return false;
    if (highScores.length < MAX_HIGH_SCORES) return s > 0;
    return s > (highScores[highScores.length-1]?.score || 0);
  }

  function checkAndSaveHighScore(finalScore){
    if (!qualifiesForHighScore(finalScore)) return;
    const charLabel = selectedPlayer != null ? characters[selectedPlayer].label.toUpperCase() : "-";
    let insertIndex = highScores.findIndex(e => finalScore > e.score);
    if (insertIndex === -1) insertIndex = highScores.length;
    const newEntry = { score: finalScore, name: "", char: charLabel };
    highScores.splice(insertIndex, 0, newEntry);
    highScores.splice(MAX_HIGH_SCORES);
    drawHighScoreConsole._editingIndex = insertIndex;
    drawHighScoreConsole._cursorVisible = true;
    drawHighScoreConsole._cursorTimer = 0;
    // If on a touch device, show the on-screen keyboard now (so iOS users get the keyboard)
    if ('ontouchstart' in window) {
      showVirtualKeyboard(insertIndex);
    }
  }

  function resetHighScoreEditing() {
    drawHighScoreConsole._editingIndex = null;
    drawHighScoreConsole._cursorVisible = false;
    drawHighScoreConsole._cursorTimer = 0;
    hideVirtualKeyboard();
  }

  function drawHighScoreConsole(){
    const W = canvas.width * 0.35;
    const H = canvas.height * 0.8;
    const X = (canvas.width - W) / 2;
    const Y = (canvas.height - H) / 2;
    ctx.save();
    ctx.globalAlpha = 0.88;
    ctx.fillStyle = "#050a0a";
    ctx.fillRect(X, Y, W, H);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = "#00ff99";
    ctx.lineWidth = Math.max(3, canvas.width*0.003);
    ctx.shadowColor = "#00ff99";
    ctx.shadowBlur = 12;
    ctx.strokeRect(X, Y, W, H);
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 0.08;
    ctx.fillStyle = "#00ff99";
    for (let yy = Y+30; yy < Y+H-20; yy += 4) {
      ctx.fillRect(X+10, yy, W-20, 1);
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#00ff99";
    ctx.font = Math.max(18, canvas.height * 0.03) + "px monospace";
    ctx.textAlign = "center";
    const headerTop = Y + H * 0.04;
    ctx.fillText("HIGH SCORES", X + W / 2, headerTop);
    const headerY = Y + H * 0.09;
    ctx.font = Math.max(14, canvas.height * 0.022) + "px monospace";
    const rankLeft = X + W * 0.10;
    const charLeft = X + W * 0.20;
    const scoreLeft = X + W * 0.40;
    const nameLeft  = X + W * 0.55;
    ctx.textAlign = "left";
    ctx.fillText("RANK", rankLeft, headerY);
    ctx.fillText("CHARACTER", charLeft, headerY);
    ctx.fillText("SCORE", scoreLeft, headerY);
    ctx.fillText("NAME", nameLeft, headerY);
    const rowH = canvas.height * 0.04;
    ctx.font = Math.max(16, canvas.height * 0.024) + "px monospace";
    const rows = highScores.slice(0, MAX_HIGH_SCORES);
    for (let i = 0; i < rows.length; i++) {
      const entry = rows[i];
      const y = Y + H * 0.14 + i * rowH;
      ctx.textAlign = "left";
      ctx.fillText(String(i + 1), rankLeft, y);
      ctx.fillText(entry.char || "-", charLeft, y);
      ctx.fillText(String(entry.score), scoreLeft, y);
      if (drawHighScoreConsole._editingIndex === i) {
        let nameText = entry.name || "";
        if (drawHighScoreConsole._cursorVisible) nameText += "_";
        ctx.fillText(nameText, nameLeft, y);
      } else {
        ctx.fillText(entry.name || "-", nameLeft, y);
      }
    }
    const knob = (kx,ky,r,fill) => { ctx.beginPath(); ctx.fillStyle = fill; ctx.arc(kx,ky,r,0,Math.PI*2); ctx.fill(); ctx.closePath(); };
    knob(X+22, Y+22, 8, "#ff3355");
    knob(X+44, Y+22, 8, "#ffaa00");
    knob(X+66, Y+22, 8, "#33ddff");
    knob(X+W-22, Y+22, 8, "#66ff66");
    knob(X+W-44, Y+22, 8, "#ff66ff");
    knob(X+18, Y+H-18, 6, "#888");
    knob(X+W-18, Y+H-18, 6, "#888");
    const btnW = W * 0.4;
    const btnH = H * 0.08;
    const btnX = X + (W - btnW) / 2;
    const btnY = Y + H - btnH - 30;
    ctx.fillStyle = "#050a0a";
    ctx.fillRect(btnX, btnY, btnW, btnH);
    ctx.strokeStyle = "#00ff99";
    ctx.lineWidth = 3;
    ctx.strokeRect(btnX, btnY, btnW, btnH);
    ctx.fillStyle = "#00ff99";
    ctx.font = Math.max(18, canvas.height * 0.03) + "px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("PLAY AGAIN", btnX + btnW / 2, btnY + btnH / 2);
    drawHighScoreConsole._btn = { x: btnX, y: btnY, w: btnW, h: btnH };
    if (drawHighScoreConsole._editingIndex != null) {
      if (typeof drawHighScoreConsole._cursorTimer === "undefined") drawHighScoreConsole._cursorTimer = 0;
      if (typeof drawHighScoreConsole._cursorVisible === "undefined") drawHighScoreConsole._cursorVisible = true;
      drawHighScoreConsole._cursorTimer++;
      if (drawHighScoreConsole._cursorTimer > 30) {
        drawHighScoreConsole._cursorVisible = !drawHighScoreConsole._cursorVisible;
        drawHighScoreConsole._cursorTimer = 0;
      }
    }
    ctx.restore();
  }



// ===== Responsive virtual keyboard (QWERTY, numbers, SHIFT, SPACE, BACK, ENTER) =====
(function(){
  // helper to avoid duplicate keyboards
  function _removeExistingKeyboard() {
    const ex = document.getElementById('virtual-keyboard');
    if (ex) ex.remove();
  }

  function _makeBtnLabel(key, shiftOn) {
    // letters toggle case, numbers remain number
    if (key.length === 1 && /[A-Z]/.test(key)) return shiftOn ? key : key.toLowerCase();
    return key;
  }

  // call this to show the keyboard for a given highScores index
  window.showVirtualKeyboard = function(editingIndex){
    if (editingIndex == null) return;
    if (!window.highScores) return;
    _removeExistingKeyboard();

    const shiftState = { on: false }; // mutable so inner handlers can toggle
    const maxChars = 20;

    const container = document.createElement('div');
    container.id = 'virtual-keyboard';
    // overall container styling (matches console look)
    Object.assign(container.style, {
      position: 'fixed',
      left: '50%',
      transform: 'translateX(-50%)',
      bottom: '2vh',
      width: '94vw',
      maxWidth: '1100px',
      zIndex: 99999,
      background: '#050a0a',
      border: '2px solid #00ff99',
      borderRadius: '10px',
      padding: '0.6vh 0.6vw',
      boxSizing: 'border-box',
      boxShadow: '0 6px 18px rgba(0,255,153,0.08)',
      touchAction: 'none',
      userSelect: 'none'
    });

    // rows definition (top-to-bottom). Use upper-case letters in definition for clarity.
    const rows = [
      "1234567890".split(''),
      "QWERTYUIOP".split(''),
      "ASDFGHJKL".split(''),
      "ZXCVBNM".split(''),
      ["SHIFT", "SPACE", "BACK", "ENTER"]
    ];

    // common key style factory
    function styleKeyEl(el) {
      Object.assign(el.style, {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        margin: '0.35vh 0.35vw',
        borderRadius: '6px',
        border: '1px solid rgba(255,255,255,0.06)',
        background: '#111',
        color: '#fff',
        fontFamily: 'monospace, Arial',
        fontWeight: '600',
        fontSize: '3.2vw', // viewport relative, scales on phones
        minHeight: '6.5vh',
        boxSizing: 'border-box',
        cursor: 'pointer',
        touchAction: 'manipulation',
        transition: 'transform 0.06s ease, box-shadow 0.06s ease, background 0.06s ease'
      });
      // responsive clamp for font-size on larger screens
      if (window.innerWidth > 800) el.style.fontSize = '18px';
    }

    // press visual feedback
    function pressVisual(el) {
      el.style.transform = 'translateY(3px) scale(0.99)';
      el.style.boxShadow = 'inset 0 0 0 2px rgba(0,255,153,0.06)';
    }
    function releaseVisual(el) {
      el.style.transform = '';
      el.style.boxShadow = '';
    }

    // build rows
    rows.forEach((rowKeys) => {
      const row = document.createElement('div');
      Object.assign(row.style, {
        display: 'flex',
        width: '100%',
        boxSizing: 'border-box',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: '0.4vh'
      });

      rowKeys.forEach((k) => {
        const btn = document.createElement('button');
        btn.setAttribute('type','button');
        btn.setAttribute('aria-label','vk-'+k);
        btn.dataset.key = k;
        styleKeyEl(btn);

        // sizing: SPACE larger, SHIFT/BACK/ENTER slightly wider, others equal per row
        if (k === 'SPACE') {
          btn.style.flex = '4';
          btn.style.borderRadius = '6px';
          btn.style.background = '#0b1f0b';
          btn.style.color = '#00ff99';
        } else if (k === 'SHIFT' || k === 'BACK' || k === 'ENTER') {
          btn.style.flex = '1.2';
        } else {
          btn.style.flex = '1';
        }

        // apply console-green border highlight for special keys
        if (k === 'ENTER') {
          btn.style.border = '1px solid rgba(0,255,153,0.22)';
        }

        // initial label (respect shift state)
        btn.textContent = _makeBtnLabel(k, shiftState.on);

        // pointer handlers (covers touch & mouse)
        const down = (ev) => {
          ev.preventDefault();
          pressVisual(btn);
        };
        const up = (ev) => {
          ev.preventDefault();
          releaseVisual(btn);
          handleKeyPress(k);
        };

        btn.addEventListener('pointerdown', down, { passive: false });
        btn.addEventListener('pointerup', up);
        // fallback for some browsers
        btn.addEventListener('touchstart', down, { passive: false });
        btn.addEventListener('touchend', up);

        // small hover for desktops
        btn.addEventListener('mouseenter', ()=> { btn.style.filter = 'brightness(1.05)'; });
        btn.addEventListener('mouseleave', ()=> { btn.style.filter = ''; releaseVisual(btn); });

        row.appendChild(btn);
      });

      container.appendChild(row);
    });

    // attach to DOM
    document.body.appendChild(container);

    // update labels function when shift toggles
    function updateCaseDisplay() {
      const btns = container.querySelectorAll('button');
      btns.forEach(b=>{
        const k = b.dataset.key;
        if (k && k.length === 1 && /[A-Z]/.test(k)) {
          b.textContent = _makeBtnLabel(k, shiftState.on);
        }
        // style SHIFT to indicate active
        if (k === 'SHIFT') {
          b.style.background = shiftState.on ? '#00ff99' : '#111';
          b.style.color = shiftState.on ? '#002211' : '#fff';
        }
      });
    }

    // key action implementation (mutates highScores[editingIndex].name)
    function handleKeyPress(k) {
      const entry = window.highScores && window.highScores[editingIndex];
      if (!entry) return;

      if (k === 'BACK') {
        entry.name = (entry.name || '').slice(0, -1);
        return;
      }
      if (k === 'ENTER') {
        // finalize & save (keeps behavior same as physical Enter)
        window.drawHighScoreConsole && (window.drawHighScoreConsole._editingIndex = null);
        // reset editing state in your code
        try { window.resetHighScoreEditing && window.resetHighScoreEditing(); } catch(_) {}
        // persist
        try { localStorage.setItem('highScores', JSON.stringify(window.highScores)); } catch(_) {}
        _removeExistingKeyboard();
        return;
      }
      if (k === 'SHIFT') {
        shiftState.on = !shiftState.on;
        updateCaseDisplay();
        return;
      }
      if (k === 'SPACE') {
        if ((entry.name || '').length < maxChars) entry.name = (entry.name || '') + ' ';
        return;
      }

      // letter or number key
      if (k.length === 1) {
        const ch = (/[A-Z]/.test(k)) ? (shiftState.on ? k : k.toLowerCase()) : k;
        if ((entry.name || '').length < maxChars) entry.name = (entry.name || '') + ch;
        // do NOT automatically turn off SHIFT (keeps it toggled until pressed again)
        return;
      }
    }

    // prevent page scrolling while keyboard present on touchmove inside the keyboard
    container.addEventListener('touchmove', (e)=>{ e.stopPropagation(); }, { passive: false });

    // close keyboard if user taps outside (optional safe behaviour)
    const outsideHandler = (ev) => {
      const target = ev.target;
      if (!container.contains(target)) {
        // don't auto-finalize — preserve current editing index but hide keyboard
        _removeExistingKeyboard();
        document.removeEventListener('pointerdown', outsideHandler);
      }
    };
    document.addEventListener('pointerdown', outsideHandler);

    // initial case paint
    updateCaseDisplay();
  };

  // call this to hide the keyboard
  window.hideVirtualKeyboard = function(){
    _removeExistingKeyboard();
  };
})();




  // --- Resume ONLY the background music (no rewinds) when the page/tab wakes ---
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      try {
        const bg = sounds && sounds.gameBG && sounds.gameBG.audio;
        const start = sounds && sounds.startScreen && sounds.startScreen.audio;
        if (state === "play" && bg && bg.paused) { bg.play().catch(()=>{}); }
        if (state === "start" && start && start.paused) { start.play().catch(()=>{}); }
      } catch (e) {}
    }
  });

 
  // ===== Main loop =====
  function loop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (state === "intro") {
      drawIntroScreen();
    } else if (state === "start") {
      drawStartScreen();
    } else if (state === "play") {
      drawBackground();
      updateBackground();
      updatePlayer();

      // frame-based spawning
      itemSpawnCounter++;
      enemySpawnCounter++;
      const itemRate = Math.max(50, 200 - level * 5);
      const enemyRate = Math.max(60, 300 - level * 5);
      if (itemSpawnCounter >= itemRate) { spawnItem(); itemSpawnCounter = 0; }
      if (enemySpawnCounter >= enemyRate) { spawnEnemy(); enemySpawnCounter = 0; }

      drawPlayer();
      updateItems();
      drawItems();
      updateEnemies();
      drawEnemies();
      drawHUD();
      checkLevelUp();
      updateAndDrawLevelBanner();

      if (explosion.visible) {
        const scale = 2;
        const expWidth = player.width * scale;
        const expHeight = player.height * scale;
        ctx.drawImage(explosionImage,
          explosion.x - (expWidth - player.width)/2,
          explosion.y - (expHeight - player.height)/2,
          expWidth, expHeight);
        explosion.timer--;
        if (explosion.timer <= 0) {
          explosion.visible = false;
          if (player.dead) {
            state = "gameover";
            player.dead = false;
            stopSound(sounds.gameBG);
            playSound(sounds.ending, 0.8);
          }
        }
      }

      if (player && player.flashCount > 0) {
        player.flashTimer--;
        if (player.flashTimer <= 0) {
          player.flashVisible = !player.flashVisible;
          player.flashTimer = 15;
          player.flashCount--;
        }
      } else if (player) {
        player.flashVisible = true;
        player.flashActive = false;
      }

    } else if (state === "gameover") {
      drawGameOver();
      if (drawGameOver._didHS) {
        drawHighScoreConsole();
        drawHUD();
      }
    }

    requestAnimationFrame(loop);
  }

  // ===== Joystick & Touch Handling (keeps original behavior) =====
  const joystick = document.createElement("div");
  const stick = document.createElement("div");
  Object.assign(joystick.style, {
    position: "absolute", left: "20px", bottom: "20px",
    width: "120px", height: "120px",
    background: "rgba(255,255,255,0.3)",
    borderRadius: "50%", display: "none", zIndex: 1000, touchAction: "none"
  });
  Object.assign(stick.style, {
    position: "absolute", left: "50%", top: "50%",
    width: "50px", height: "50px",
    background: "rgba(255,255,255,0.8)",
    borderRadius: "50%",
    transform: "translate(-50%,-50%)",
    touchAction: "none"
  });
  joystick.appendChild(stick);
  document.body.appendChild(joystick);

  let joyActive = false;
  function getTouchPosOnCanvas(touch) {
    const rect = canvas.getBoundingClientRect();
    return { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
  }
  function getJoystickCenter() {
    const r = joystick.getBoundingClientRect();
    return { cx: r.left + r.width/2, cy: r.top + r.height/2 };
  }

  // Touch handlers for joystick + mobile button handling
  canvas.addEventListener("touchstart", e=>{
    const t = e.touches[0];
    const pos = getTouchPosOnCanvas(t);

    // Intro play button (mobile)
    if (state === "intro" && playButtonBounds) {
      if (pos.x >= playButtonBounds.x && pos.x <= playButtonBounds.x + playButtonBounds.w &&
          pos.y >= playButtonBounds.y && pos.y <= playButtonBounds.y + playButtonBounds.h) {
        playSound(sounds.buttonClick);
        stopSound(sounds.gameBG);
        stopSound(sounds.ending);
        playSound(sounds.startScreen, 0.5);
        bgX = 0;
        state = "start";
        e.preventDefault();
        return;
      }
    }

    // Start screen character pick
    if (state === "start") {
      for (const b of characterBounds) {
        if (pos.x >= b.x && pos.x <= b.x+b.w && pos.y >= b.y && pos.y <= b.y+b.h) {
          playSound(sounds.buttonClick);
          selectedPlayer = b.index;
          playerImg = characters[b.index].img;
          setTimeout(()=>{
            resetGame();
            stopSound(sounds.startScreen);
            playSound(sounds.gameBG, 0.6);
            state = "play";
          },200);
          e.preventDefault();
          return;
        }
      }
    }

    // Gameover "Play Again" on mobile
    if (state === "gameover") {
      const b = drawHighScoreConsole._btn;
      if (b && pos.x >= b.x && pos.x <= b.x+b.w && pos.y >= b.y && pos.y <= b.y+b.h) {
        playSound(sounds.buttonClick);
        setTimeout(()=>{
          resetGame();
          resetHighScoreEditing();
          gameOverAnim = null;
          selectedPlayer = null;
          bgX = 0;
          stopSound(sounds.gameBG);
          playSound(sounds.startScreen, 0.5);
          state = "start";
        }, 200);
        e.preventDefault();
        return;
      }
    }

    // If we get here and state is play -> start joystick
    if (state !== "play") return;
    joystick.style.left = `20px`;
    joystick.style.bottom = `20px`;
    joystick.style.display = "block";
    stick.style.transform = "translate(-50%,-50%)";
    joyActive = true;
    e.preventDefault();
  }, { passive: false });

  canvas.addEventListener("touchmove", e=>{
    if(!joyActive) return;
    const t = e.touches[0];
    const center = getJoystickCenter();
    const dx = t.clientX - center.cx;
    const dy = t.clientY - center.cy;
    const dist = Math.hypot(dx, dy);
    const max = (joystick.getBoundingClientRect().width/2) - (stick.getBoundingClientRect().width/2) - 2;
    const ratio = dist>max ? max/dist : 1;
    const rx = dx * ratio, ry = dy * ratio;
    stick.style.transform = `translate(calc(-50% + ${rx}px), calc(-50% + ${ry}px))`;
    if (player) {
      player.x += (rx / max) * player.speed;
      player.y += (ry / max) * player.speed;
      if (player.x < 0) player.x = 0;
      if (player.y < 0) player.y = 0;
      if (player.x + player.width > canvas.width) player.x = canvas.width - player.width;
      if (player.y + player.height > canvas.height) player.y = canvas.height - player.height;
    }
    e.preventDefault();
  }, { passive: false });

  canvas.addEventListener("touchend", e=>{
    joyActive = false;
    joystick.style.left = `20px`;
    joystick.style.bottom = `20px`;
    stick.style.transform = "translate(-50%,-50%)";
    e.preventDefault();
  }, { passive: false });

  // Desktop mouse click handler (leave as your working behavior)
  canvas.addEventListener("click", e=>{
    const mx = e.offsetX, my = e.offsetY;
    if (state === "intro" && playButtonBounds) {
      if (mx >= playButtonBounds.x && mx <= playButtonBounds.x + playButtonBounds.w &&
          my >= playButtonBounds.y && my <= playButtonBounds.y + playButtonBounds.h) {
        playSound(sounds.buttonClick);
        stopSound(sounds.gameBG);
        stopSound(sounds.ending);
        playSound(sounds.startScreen, 0.5);
        bgX = 0;
        state = "start";
        return;
      }
    }
    if (state === "start") {
      for (const b of characterBounds) {
        if (mx >= b.x && mx <= b.x+b.w && my >= b.y && my <= b.y+b.h) {
          playSound(sounds.buttonClick);
          selectedPlayer = b.index;
          playerImg = characters[b.index].img;
          setTimeout(()=>{
            resetGame();
            stopSound(sounds.startScreen);
            playSound(sounds.gameBG, 0.6);
            state = "play";
          },200);
          break;
        }
      }
    } else if (state === "gameover") {
      const b = drawHighScoreConsole._btn;
      if (b && mx >= b.x && mx <= b.x+b.w && my >= b.y && my <= b.y+b.h) {
        playSound(sounds.buttonClick);
        setTimeout(()=>{
          resetGame();
          resetHighScoreEditing();
          gameOverAnim = null;
          selectedPlayer = null;
          bgX = 0;
          stopSound(sounds.gameBG);
          playSound(sounds.startScreen, 0.5);
          state = "start";
        }, 200);
      }
    }
  });

  // keyboard (physical)
  window.addEventListener("keydown", e => {
    if (!e.key) return;
    keys[e.key] = true;
  });
  window.addEventListener("keyup", e => {
    if (!e.key) return;
    keys[e.key] = false;
  });

  // global editing key handler (physical keyboard)
  window.addEventListener("keydown", function(e){
    // only when editing a high score row
    if (state === "gameover" && drawHighScoreConsole._editingIndex != null) {
      e.preventDefault();
      const idx = drawHighScoreConsole._editingIndex;
      const entry = highScores[idx];
      if (!entry) return;
      if (e.key === "Backspace") {
        entry.name = (entry.name || "").slice(0, -1);
      } else if (e.key === "Enter") {
        drawHighScoreConsole._editingIndex = null;
        resetHighScoreEditing();
        try { localStorage.setItem("highScores", JSON.stringify(highScores)); } catch(_) {}
      } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
        if ((entry.name || "").length < 20) entry.name = (entry.name || "") + e.key.toUpperCase();
      }
    }
  });

  // start the loop
  loop();
})();
