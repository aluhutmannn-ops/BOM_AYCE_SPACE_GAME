(() => {
  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  window.addEventListener("resize", resize);
  resize();

  let highScores = [];
  try { highScores = JSON.parse(localStorage.getItem("highScores") || "[]"); } catch (_) { highScores = []; }
  const MAX_HIGH_SCORES = 10;
  const PRIZE_FREQUENCY = 1;
  let _foodPngCounter = 0;
  const prizeImg = new Image();
  const bgImage = new Image();
  const heartImg = new Image();
  const sheepImg = new Image();
  const pigImg = new Image(); 
  const cowImg = new Image();
  bgImage.src = "background.png";
  heartImg.src = "Heart.png";

  sheepImg.src = "Sheep_Player.png";
  pigImg.src = "Pig_Player.png";
  cowImg.src = "Cow_Player.png";
  prizeImg.src = "prize.png";
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
    startScreen: {
      audio: new Audio('start_screen.mp3'),
      volume: 0.4 // adjust this as needed
    },
    buttonClick: {
      audio: new Audio('button_clicks.mp3'),
      volume: 0.4 
    },
    gameBG: {
      audio: new Audio('game_BG.mp3'),
      volume: 0.4 
    },
    eat: {
      audio: new Audio('eat.mp3'),
      volume: 0.4 
    },
    drink: {
      audio: new Audio('drink.mp3'),
      volume: 0.4 
    },
    explosion: {
      audio: new Audio('explosion.mp3'),
      volume: 0.4 
    },
    ending: {
      audio: new Audio('ending.mp3'),
      volume: 0.4 
    }
  };

  // loop background music
  sounds.startScreen.audio.loop = true;
  sounds.gameBG.audio.loop = true;

  // helpers
  function playSound(soundEntry, overrideVolume = null) {
    if (!soundEntry || !soundEntry.audio) return;
    const snd = soundEntry.audio;
    const volume = overrideVolume ?? soundEntry.volume ?? 1;
    if (!snd.loop || snd.paused) snd.currentTime = 0;
    snd.volume = volume;
    snd.play().catch(() => {}); // avoid autoplay errors
  }

  function stopSound(soundEntry) {
    if (!soundEntry || !soundEntry.audio) return;
    const snd = soundEntry.audio;
    snd.pause();
    snd.currentTime = 0;
  }

  let state = "intro";  // possible values: "intro", "start", "play", "gameover"

  let selectedPlayer = null, playerImg = null;
  let bgX, score, level, scrollSpeed, player, keys, items = [], enemies = [];
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

    // reset HS prompt flag 
    drawGameOver._didHS = false;
    levelBanner = null; 
  }

  function drawIntroScreen() {
    // draw background
    ctx.drawImage(bgImage, 0, 0, canvas.width, canvas.height);

    if (introImages.length > 0) {
      let gap = 30; // spacing between panels
      let panelHeight = canvas.height * 0.7; 
      let panelWidth = introImages[0].width * (panelHeight / introImages[0].height);
      let startX = (canvas.width - (panelWidth * introImages.length + gap * (introImages.length - 1))) / 2;
      let y = canvas.height * 0.1;

      // draw panels
      introImages.forEach((img, i) => {
        let x = startX + i * (panelWidth + gap);
        ctx.drawImage(img, x, y, panelWidth, panelHeight);
      });
    }

    // draw play button
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

    // store button bounds for click detection
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
    // Guard: don't try to draw if we don't have a playerImg yet
    if (!playerImg || !player) return;
    const playerWidth = canvas.width * 0.08;
    // Also guard in case image hasn't loaded dimensions yet
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
    // compute target size
    const maxWidth = canvas.width * 0.05;   // max width = 5% of canvas
    const maxHeight = canvas.height * 0.1;  // max height = 10% of canvas

    let width = maxWidth;
    let height = width * (choice.img.height / choice.img.width);

    if (height > maxHeight) {
      height = maxHeight;
      width = height * (choice.img.width / choice.img.height);
    }

    // normal food/drink push
    items.push({
      type: choice.type,
      x: canvas.width + n * 50,
      y: Math.random() * (canvas.height - height),
      width: width,
      height: height,
      img: choice.img,
      speed: scrollSpeed + 2 + level * 0.5
    });
  }
}
  function spawnEnemy(){
    const count = 1 + Math.floor(Math.random()*3); 
    for (let n=0;n<count;n++) {
      const r=Math.random(), choice = r<0.12? {img:chickenImg,type:"chicken"} : 
        [{img:mooImg,type:"moo"},{img:oinkImg,type:"oink"},{img:baaImg,type:"baa"}][Math.floor(Math.random()*3)];
      const enemyWidth=canvas.width*0.06, aspect=choice.img.height/choice.img.width, enemyHeight=enemyWidth*aspect;
      const base={type:choice.type,x:canvas.width+n*60,y:Math.random()*(canvas.height-enemyHeight),
        width:enemyWidth,height:enemyHeight,img:choice.img,speed:scrollSpeed+2+level*0.6};
      if(choice.type==="chicken"){
        base.speed+=2;
        base.vy=(Math.random()<0.5?-1:1)*(2+Math.random()*2);
        base.rotation=0;
        base.rotSpeed=(Math.random()<0.5?-1:1)*(0.03+Math.random()*0.15);
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
      if (it.type === "prize") {
        // collect prize: remove item and trigger prize flow
        items.splice(i,1);
        playSound(sounds.buttonClick, 0.8);
        // pause game by switching state so main loop doesn't process 'play' block
        const previousState = state;
        state = "prize"; // custom paused state

        // show email popup
        (function showEmailPopup(onDone){
          const dlg = document.createElement("div");
Object.assign(dlg.style, {
  position: "fixed",
  left: "50%",
  top: "50%",
  transform: "translate(-50%,-50%)",
  background:"#050a0a",
  color:"#00ff99",
  padding:"18px",
  border:"3px solid #00ff99",
  borderRadius:"8px",
  zIndex: 99999,
  minWidth:"280px",
  maxWidth:"92vw",
  textAlign:"center",
  fontFamily:"monospace"
});

const title = document.createElement("div");
title.textContent = "Congratulations!";
title.style.fontSize = "20px";
title.style.marginBottom = "8px";

const msg = document.createElement("div");
msg.textContent = "Enter your email for a chance to win a prize from BOM:";
msg.style.marginBottom = "12px";
msg.style.fontSize = "14px";

const input = document.createElement("input");
input.type = "email";
input.placeholder = "you@example.com";
Object.assign(input.style, {
  width:"92%",
  padding:"8px",
  fontSize:"15px",
  marginBottom:"12px",
  boxSizing:"border-box"
});

const submit = document.createElement("button");
submit.textContent = "Submit";
Object.assign(submit.style, { padding:"8px 14px", fontSize:"15px", marginRight:"8px" });

const cancel = document.createElement("button");
cancel.textContent = "Cancel";
Object.assign(cancel.style, { padding:"8px 14px", fontSize:"15px" });

dlg.appendChild(title);
dlg.appendChild(msg);
dlg.appendChild(input);
dlg.appendChild(submit);
dlg.appendChild(cancel);
document.body.appendChild(dlg);

function closeAndReturn(val) {
  try { document.body.removeChild(dlg); } catch(e){}
  onDone(val);
}

cancel.addEventListener("click", ()=> closeAndReturn(null));
submit.addEventListener("click", ()=> closeAndReturn(input.value.trim() || null));
input.addEventListener("keydown", e=>{
  if (e.key === "Enter") { submit.click(); e.preventDefault(); }
});
        })(async function(collectedEmail){
          if (collectedEmail) {
            try {
              const response = await fetch('https://script.google.com/macros/s/AKfycbynW0Z5Tx1Vq0XLoLn8Z8cJ2B7Y8x6v3wN9h1k5z0Q1x4oI7uM/exec', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: `email=${encodeURIComponent(collectedEmail)}`
              });
              if (response.ok) {
                console.log("Email submitted");
              } else {
                console.log("Email submit failed");
              }
            } catch(e) { console.log("Email submit error:", e); }
          }
          // resume game
          state = previousState;
        });
      } else {
        // normal collect
        items.splice(i,1);
        score += 10;
        playSound(sounds[it.type === "food" ? "eat" : "drink"], 0.8);
        if (score % 100 === 0) level++;

        // check prize spawn
        if (Math.random() < PRIZE_FREQUENCY / 100) {
          const prizeWidth = canvas.width * 0.05;
          const prizeHeight = prizeWidth * (prizeImg.height / prizeImg.width);
          items.push({
            type: "prize",
            x: canvas.width,
            y: Math.random() * (canvas.height - prizeHeight),
            width: prizeWidth,
            height: prizeHeight,
            img: prizeImg,
            speed: scrollSpeed + 2 + level * 0.5
          });
        }
      }
    }
  }
}
  function updateEnemies(){
    for(let i=enemies.length-1;i>=0;i--){
      const en = enemies[i];
      en.x -= en.speed;
      if (en.x + en.width < 0) { enemies.splice(i,1); continue; }
      if(en.type==="chicken"){
        en.y += en.vy;
        en.rotation += en.rotSpeed;
        if(en.y<0||en.y+en.height>canvas.height)en.vy=-en.vy;
      }
      if (player && isColliding(player, en)) {
        enemies.splice(i,1);
        player.lives--;
        explosion.x = player.x + player.width / 2;
        explosion.y = player.y + player.height / 2;
        explosion.visible = true;
        explosion.timer = 30;
        playSound(sounds.explosion, 0.8);
        player.flashCount = 5; 
        player.flashTimer = 10; 
        player.flashVisible = false; 
      }
    }
    if (player.lives <= 0 && !player.dead) {
      player.dead = true;
      stopSound(sounds.gameBG);
      playSound(sounds.explosion, 0.7);
      playSound(sounds.ending, 0.5);
      hideJoystick();
      state = "gameover";
      gameOverAnim = { timer: 0 };
    }
  }

  function drawItems(){
    items.forEach(it => ctx.drawImage(it.img, it.x, it.y, it.width, it.height));
  }
  function drawEnemies(){
    enemies.forEach(en => {
      if(en.type==="chicken"){
        ctx.save();
        ctx.translate(en.x + en.width/2, en.y + en.height/2);
        ctx.rotate(en.rotation);
        ctx.drawImage(en.img, -en.width/2, -en.height/2, en.width, en.height);
        ctx.restore();
      } else {
        ctx.drawImage(en.img, en.x, en.y, en.width, en.height);
      }
    });
  }

  function drawHUD(){
    ctx.fillStyle = "#fff";
    ctx.font = "24px Arial";
    ctx.textAlign = "left";
    ctx.fillText(`Score: ${score}`, 20, 40);
    ctx.fillText(`Level: ${level}`, 20, 70);

    // lives
    for (let i=0; i<player.lives; i++) {
      ctx.drawImage(heartImg, canvas.width - 40 - i*35, 20, 30, 30);
    }
  }

  function drawStartScreen() {
    drawBackground();
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(0,0,canvas.width,canvas.height);

    ctx.fillStyle = "#fff";
    ctx.font = "40px Arial";
    ctx.textAlign = "center";
    ctx.fillText("Choose Your Character", canvas.width/2, canvas.height*0.2);

    characterBounds = [];
    const charSize = Math.min(canvas.width*0.15, canvas.height*0.25);
    const gap = 40;
    const startX = (canvas.width - (charSize*3 + gap*2)) / 2;
    characters.forEach((char, i) => {
      const x = startX + i*(charSize + gap);
      const y = canvas.height/2 - charSize/2;
      ctx.drawImage(char.img, x, y, charSize, charSize);
      characterBounds.push({ x, y, w:charSize, h:charSize, index:i });
    });
  }

  // high score editing reset
  function resetHighScoreEditing() {
    drawHighScoreConsole._editingIndex = null;
  }

  function checkAndSaveHighScore(finalScore) {
    highScores.sort((a,b)=>b.score-a.score);
    let insertIdx = highScores.findIndex(h=>h.score < finalScore);
    if (insertIdx === -1) insertIdx = highScores.length;
    if (insertIdx < MAX_HIGH_SCORES || highScores.length < MAX_HIGH_SCORES) {
      highScores.splice(insertIdx, 0, { name: "AAA", score: finalScore });
      if (highScores.length > MAX_HIGH_SCORES) highScores.pop();
      drawHighScoreConsole._editingIndex = insertIdx;
      try { localStorage.setItem("highScores", JSON.stringify(highScores)); } catch(_) {}
    }
  }

  function drawHighScoreConsole() {
    const conW = Math.min(400, canvas.width * 0.8);
    const conH = Math.min(300, canvas.height * 0.6);
    const conX = (canvas.width - conW) / 2;
    const conY = canvas.height * 0.3;

    ctx.fillStyle = "#222";
    ctx.fillRect(conX, conY, conW, conH);
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.strokeRect(conX, conY, conW, conH);

    ctx.fillStyle = "#fff";
    ctx.font = "24px Arial";
    ctx.textAlign = "center";
    ctx.fillText("High Scores", conX + conW/2, conY + 35);

    const lineH = 28;
    const startY = conY + 60;
    highScores.forEach((hs, i) => {
      const isEditing = drawHighScoreConsole._editingIndex === i;
      let name = hs.name || "AAA";
      if (isEditing) name += "_"; // cursor

      ctx.textAlign = "left";
      ctx.fillText(`${i+1}. ${name}`, conX + 30, startY + i*lineH);
      ctx.textAlign = "right";
      ctx.fillText(`${hs.score}`, conX + conW - 30, startY + i*lineH);
    });

    // play again button
    const btnW = 150, btnH = 40;
    const btnX = conX + (conW - btnW)/2;
    const btnY = conY + conH - btnH - 20;
    ctx.fillStyle = "#444";
    ctx.fillRect(btnX, btnY, btnW, btnH);
    ctx.strokeRect(btnX, btnY, btnW, btnH);

    ctx.fillStyle = "#fff";
    ctx.font = "20px Arial";
    ctx.textAlign = "center";
    ctx.fillText("Play Again", btnX + btnW/2, btnY + btnH/2 + 2);

    drawHighScoreConsole._btn = { x:btnX, y:btnY, w:btnW, h:btnH };
  }
  drawHighScoreConsole._editingIndex = null;
  drawHighScoreConsole._btn = null;

  function drawGameOver() {
    drawBackground();

    // game over text animation
    if (!gameOverAnim) gameOverAnim = { timer: 0 };
    gameOverAnim.timer++;

    ctx.fillStyle = `rgba(255,0,0,${Math.sin(gameOverAnim.timer / 10) * 0.5 + 0.5})`;
    ctx.font = "60px Arial";
    ctx.textAlign = "center";
    ctx.fillText("GAME OVER", canvas.width/2, canvas.height/2 - 50);

    ctx.fillStyle = "#fff";
    ctx.font = "30px Arial";
    ctx.fillText(`Final Score: ${score}`, canvas.width/2, canvas.height/2);

    // check/save HS once
    if (!drawGameOver._didHS) {
      checkAndSaveHighScore(score);
      drawGameOver._didHS = true;
    }

    drawHighScoreConsole();
  }
  drawGameOver._didHS = false;

  function loop(){
    requestAnimationFrame(loop);
    ctx.clearRect(0,0,canvas.width,canvas.height);

    if (state === "intro") {
      drawIntroScreen();
    } else if (state === "start") {
      drawStartScreen();
    } else if (state === "play") {
      updateBackground();
      drawBackground();
      updatePlayer();
      drawPlayer();

      itemSpawnCounter++;
      if (itemSpawnCounter > 60 - level * 2) { spawnItem(); itemSpawnCounter = 0; }

      enemySpawnCounter++;
      if (enemySpawnCounter > 80 - level * 3) { spawnEnemy(); enemySpawnCounter = 0; }

      updateItems();
      updateEnemies();
      drawItems();
      drawEnemies();
      drawHUD();

      if (explosion.visible) {
        ctx.drawImage(explosionImage, explosion.x - 50, explosion.y - 50, 100, 100);
        explosion.timer--;
        if (explosion.timer <= 0) explosion.visible = false;
      }

      if (player.flashCount > 0) {
        player.flashTimer--;
        if (player.flashTimer <= 0) {
          player.flashVisible = !player.flashVisible;
          player.flashTimer = 10;
          if (!player.flashVisible) player.flashCount--;
        }
      }

      if (levelBanner) {
        // draw level up banner
        ctx.fillStyle = "rgba(0,255,0,0.8)";
        ctx.font = "40px Arial";
        ctx.textAlign = "center";
        ctx.fillText(`Level ${level}!`, canvas.width/2, canvas.height/2);
        levelBanner--;
        if (levelBanner <= 0) levelBanner = null;
      }
    } else if (state === "gameover") {
      drawGameOver();
    }
  }

  // characters
  const characters = [
    { img: sheepImg },
    { img: pigImg },
    { img: cowImg }
  ];

  // ===== MOBILE JOYSTICK =====
  let joyActive = false;

  const joystick = document.createElement("div");
  Object.assign(joystick.style, {
    position: "fixed",
    width: "100px",
    height: "100px",
    borderRadius: "50%",
    background: "rgba(200,200,200,0.3)",
    display: "none",
    pointerEvents: "none",
    zIndex: 1000
  });

  const stick = document.createElement("div");
  Object.assign(stick.style, {
    position: "absolute",
    left: "50%",
    top: "50%",
    transform: "translate(-50%,-50%)",
    width: "40px",
    height: "40px",
    borderRadius: "50%",
    background: "rgba(255,255,255,0.5)",
    pointerEvents: "none"
  });
  joystick.appendChild(stick);
  document.body.appendChild(joystick);
  hideJoystick();

  function showJoystick() {
    joystick.style.left = `20px`;
    joystick.style.bottom = `20px`;
    joystick.style.display = "block";
    stick.style.transform = "translate(-50%,-50%)";
  }

  function hideJoystick() {
    joystick.style.display = "none";
  }

  function getJoystickCenter() {
    const rect = joystick.getBoundingClientRect();
    return { cx: rect.left + rect.width/2, cy: rect.top + rect.height/2 };
  }

  // touch handlers
  canvas.addEventListener("touchstart", e=>{
    const touch = e.touches[0];
    const pos = { x: touch.clientX * (canvas.width / window.innerWidth), y: touch.clientY * (canvas.height / window.innerHeight) };

    // If in intro, check PLAY button
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

    // If in start screen, check character pick
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
            showJoystick();
          },200);
          e.preventDefault();
          return;
        }
      }
    }

    // If in gameover and Play Again tapped
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

    // If we reach here and state is play -> start joystick
    if (state !== "play") return;
    // reset stick to center visually
    stick.style.transform = "translate(-50%,-50%)";
    joyActive = true;
    e.preventDefault();
  }, { passive: false });

  canvas.addEventListener("touchmove", e=>{
    if(!joyActive) return;
    const t = e.touches[0];
    // compute delta relative to actual joystick center in viewport coords
    const center = getJoystickCenter();
    const dx = t.clientX - center.cx; // positive = right
    const dy = t.clientY - center.cy; // positive = down
    const dist = Math.hypot(dx, dy);
    const max = (joystick.getBoundingClientRect().width/2) - (stick.getBoundingClientRect().width/2) - 2; // fit inside circle
    const ratio = dist>max ? max/dist : 1;
    const rx = dx * ratio, ry = dy * ratio;
    // move the small stick visually
    stick.style.transform = `translate(calc(-50% + ${rx}px), calc(-50% + ${ry}px))`;
    // convert rx/ry into movement where full deflection = player.speed
    if (player) {
      player.x += (rx / max) * player.speed;
      player.y += (ry / max) * player.speed;
      // clamp player inside canvas
      if (player.x < 0) player.x = 0;
      if (player.y < 0) player.y = 0;
      if (player.x + player.width > canvas.width) player.x = canvas.width - player.width;
      if (player.y + player.height > canvas.height) player.y = canvas.height - player.height;
    }
    e.preventDefault();
  }, { passive: false });

  canvas.addEventListener("touchend", e=>{
    // release joystick
    joyActive = false;
    stick.style.transform = "translate(-50%,-50%)"; 
    e.preventDefault();
  }, { passive: false });

  // Keep mouse click handler for desktop
  canvas.addEventListener("click", e=>{
    const mx = e.offsetX, my = e.offsetY;

    if (state === "intro" && playButtonBounds) {
      if (
        mx >= playButtonBounds.x && mx <= playButtonBounds.x + playButtonBounds.w &&
        my >= playButtonBounds.y && my <= playButtonBounds.y + playButtonBounds.h
      ) {
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
            showJoystick();
          },200);
          break;
        }
      }
    } 
    else if (state === "gameover") {
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

  // keyboard
  window.addEventListener("keydown", e=>keys[e.key]=true);
  window.addEventListener("keyup", e=>keys[e.key]=false);

  // global editing key handler (only active when editing a high-score name)
  window.addEventListener("keydown", function(e){
    if (state === "gameover" && drawHighScoreConsole._editingIndex != null) {
      e.preventDefault();
      const idx = drawHighScoreConsole._editingIndex;
      const entry = highScores[idx];
      if (!entry) return;

      if (e.key === "Backspace") {
        entry.name = (entry.name || "").slice(0, -1);
      } else if (e.key === "Enter") {
        // finalize and save
        drawHighScoreConsole._editingIndex = null;
        resetHighScoreEditing(); 
        try { localStorage.setItem("highScores", JSON.stringify(highScores)); } catch(_) {}
      } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
        // append character (uppercase), max 20 chars
        if ((entry.name || "").length < 20) entry.name = (entry.name || "") + e.key.toUpperCase();
      }
    }
  });

  // start the loop
  loop();


  // ===== MOBILE ON-SCREEN KEYBOARD FOR HIGH-SCORE ENTRY =====
  (function(){
    const isMobile = ('ontouchstart' in window || navigator.maxTouchPoints > 0);

    if (!isMobile) return;

    const kb = document.createElement("div");
    kb.id = "onscreen-keyboard";
    Object.assign(kb.style, {
      position: "fixed",
      bottom: "0",
      left: "50%",
      transform: "translateX(-50%)",
      width: "fit-content",  
      display: "none",
      flexDirection: "column",
      alignItems: "center",
      flexWrap: "wrap",
      justifyContent: "center",
      padding: "6px",
      zIndex: "2000",
      border: "3px solid #00ff99",
      borderRadius: "10px",
      background: "transparent",
      fontFamily: "monospace",
      boxSizing: "border-box"
    });
    document.body.appendChild(kb);

    let shift = false;

function renderKeys() {
  kb.innerHTML = "";

  // each row is a flat array of strings (one value per button)
  const row1 = [..."1234567890","Back"];
  const row2 = [..."qwertyuiop","Enter"];
  const row3 = [..."asdfghjkl","Shift"];
  const row4 = [..."zxcvbnm","Space"];
  const rows = [row1, row2, row3, row4];

    // responsive key sizing: min = width of "W", otherwise grow to fit label + padding
  const fontPx = Math.max(14, Math.floor(window.innerWidth * 0.03));
  const keyHeight = Math.max(36, Math.round(window.innerHeight * 0.05));
  const fontSize = fontPx + "px";

  // safe canvas for text measurement
  const _measureCanvas = (window.__kbMeasureCanvas = window.__kbMeasureCanvas || document.createElement("canvas"));
  const _mctx = _measureCanvas.getContext("2d");
  _mctx.font = `${fontPx}px monospace`;
  function measureTextPx(t) { return Math.ceil(_mctx.measureText(String(t)).width); }

  // baseline: comfortable min width anchored to 'W'
  const wBaselinePx = Math.max(20, measureTextPx('W'));
  const padPx = Math.max(8, Math.round(fontPx * 0.5));

  rows.forEach(row => {
    const rowDiv = document.createElement("div");
    Object.assign(rowDiv.style, {
      display: "flex",
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      flexWrap: "nowrap",
      width: "100%",
      margin: "2px 0",
      overflowX: "auto",
      WebkitOverflowScrolling: "touch"
    });

    row.forEach(k => {
      const btn = document.createElement("button");
      const label = shift && k.length === 1 ? k.toUpperCase() : (k.length === 1 ? k.toLowerCase() : k);
      btn.textContent = label;

      // measure label and compute width: labelWidth + padding, but never smaller than W baseline+padding
      const textW = measureTextPx(label);
      const minKeyW = wBaselinePx + padPx * 2;
      let widthPx = Math.max(minKeyW, textW + padPx * 2);

      // soft clamp so a single key doesn't become larger than the keyboard area
      const keyboardMaxW = Math.max(220, Math.round(window.innerWidth * 0.9));
      widthPx = Math.min(widthPx, Math.round(keyboardMaxW * 0.95));

      Object.assign(btn.style, {
        margin: "2px",
        flex: "0 0 auto",
        width: widthPx + "px",
        height: keyHeight + "px",
        background: "#050a0a",
        color: "#00ff99",
        border: "1px solid #00ff99",
        borderRadius: "6px",
        fontSize: fontSize,
        boxSizing: "border-box",
        padding: "0"
      });

      btn.addEventListener("click", (e) => { e.preventDefault(); handleKeyPress(k); });
      rowDiv.appendChild(btn);
    });

    kb.appendChild(rowDiv);
  });
}


    function handleKeyPress(k) {
      const idx = drawHighScoreConsole._editingIndex;
      if (state !== "gameover" || idx==null) return;
      const entry = highScores[idx];

       if (k==="Shift") { shift=!shift; renderKeys(); return; }
      if (k==="Back") { entry.name = (entry.name||"").slice(0,-1); return; }
      if (k==="Space") { entry.name = (entry.name||"") + " "; return; }
      if (k==="Enter") {
        drawHighScoreConsole._editingIndex=null;
        resetHighScoreEditing();
        try { localStorage.setItem("highScores", JSON.stringify(highScores)); } catch(_){}
        hideKeyboard();
        return;
      }
      if ((entry.name||"").length<20) {
        entry.name = (entry.name||"") + (shift? k.toUpperCase(): k.toLowerCase());
      }
    }

    function showKeyboard(){ kb.style.display="flex"; renderKeys(); }
    function hideKeyboard(){ kb.style.display="none"; }

    // hook into when editing starts
    const origCheckAndSave = checkAndSaveHighScore;
    checkAndSaveHighScore = function(finalScore){
      origCheckAndSave(finalScore);
      if (state==="gameover" && drawHighScoreConsole._editingIndex!=null) {
        showKeyboard();
      }
    };

    // also ensure hiding when leaving gameover
    const origReset = resetHighScoreEditing;
    resetHighScoreEditing = function(){
      origReset();
      hideKeyboard();
    };

    // ensure "Play Again" also saves current name
    function autoSaveIfEditing() {
      if (state==="gameover" && drawHighScoreConsole._editingIndex!=null) {
        drawHighScoreConsole._editingIndex=null;
        resetHighScoreEditing();
        try { localStorage.setItem("highScores", JSON.stringify(highScores)); } catch(_){}
      }
    }
    window.addEventListener("resize", ()=>{ if(kb.style.display==="flex") renderKeys(); });
  })();


})();