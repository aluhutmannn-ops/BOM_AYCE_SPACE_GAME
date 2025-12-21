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
          // store email locally (restaurant can export later)
          try {
            const arr = JSON.parse(localStorage.getItem("prizeEmails")||"[]");
            if (collectedEmail) {
              arr.unshift({ email: collectedEmail, time: (new Date()).toISOString() });
              // keep recent only
              localStorage.setItem("prizeEmails", JSON.stringify(arr.slice(0,1000)));
            }
          } catch(e){}

          // show countdown overlay 3-2-1 GO
          await (function runCountdown() {
            return new Promise(res => {
              const ov = document.createElement("div");
              Object.assign(ov.style, {
                position:"fixed", left:0, top:0, width:"100vw", height:"100vh",
                display:"flex", alignItems:"center", justifyContent:"center",
background:"transparent", zIndex:99998, color:"#fff", fontFamily:"monospace"
              });
              const txt = document.createElement("div");
              Object.assign(txt.style, { fontSize:"48px", color:"#00ff99", textAlign:"center" });
              ov.appendChild(txt);
              document.body.appendChild(ov);
const seq = ["3","2","1","GO!"];
let i = 0;

const tick = () => {
  txt.textContent = seq[i];
  i++;

  if (i < seq.length) {
    setTimeout(tick, 800);
  } else {
    setTimeout(() => {
      document.body.removeChild(ov);
      res();
    }, 800);
  }
};

tick();
            });
          })();

          // grant invincibility exactly like bombed behaviour
          if (player) {
            player.flashTimer = 15;
            player.flashCount = 8;
            player.flashVisible = false;
            player.flashActive = true;
          }

         // resume play
state = "play";

// recalc joystick layout for current canvas size
layoutJoystick();
joystick.style.display = 'block';
stick.style.transform = 'translate(-50%,-50%)';
joyActive = false;

// ensure player stays within visible canvas
if (player) {
  player.x = Math.min(Math.max(player.x, 0), canvas.width - player.width);
  player.y = Math.min(Math.max(player.y, 0), canvas.height - player.height);
}

        });

        // prize processed; don't also award normal food/drink points
        continue;
      }

// ordinary food/drink collision
if (it.type === "food") {

  // detect EXACT food.png (not food1.png etc.)
  const src = it.img?.src ?? "";
  const isFoodPng = src.endsWith("food.png");

  // if this is the exact food.png, increment collected counter
  if (isFoodPng) {
    _foodPngCounter++;

    // if reached prize trigger
    if (_foodPngCounter >= PRIZE_FREQUENCY) {
      _foodPngCounter = 0;

      // spawn the prize now
      const pw = Math.max(28, Math.round(canvas.width * 0.08));
      const ph = pw;
      items.push({
        type: "prize",
        x: canvas.width,
        y: Math.random() * (canvas.height - ph),
        width: pw,
        height: ph,
        img: prizeImg,
        speed: scrollSpeed + 2 + level * 0.5
      });
    }
  }

  score += 50;
  playSound(sounds.eat, 0.7);
} else {
  // drink
  score += 20;
  playSound(sounds.drink, 0.7);
}

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

        if (player.lives <= 0) {
          player.dead = true;
        }

        // start flashing (invulnerability period)
        player.flashTimer = 15;   // speed of flashing
        player.flashCount = 8;   // how many flashes happen
        player.flashVisible = false;
        player.flashActive = true;  // <-- new flag to mark invulnerable

        break; // important: stop after first collision
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

    // move towards target
    if (levelBanner.x > levelBanner.targetX) {
      levelBanner.x -= levelBanner.speed;
      if (levelBanner.x <= levelBanner.targetX) {
        levelBanner.x = levelBanner.targetX;
        // vanish after short delay
        setTimeout(() => {
          levelBanner = null;
          // (spawning handled by frame counters in loop)
        }, 1000); // 1 second pause at center
      }
    }
    ctx.restore();
  }

  function checkLevelUp() {
    const newLevel = Math.floor(score / 100) + 1;
    if (newLevel > level) {
      level = newLevel;
      scrollSpeed = 3 + (level - 1) * 1.2;

      // create a banner
      const text = "LEVEL " + level;
      const fontSize = Math.max(canvas.height * 0.15, 48);
      ctx.font = fontSize + "px Arial Black"; // measure using same font
      const textWidth = ctx.measureText(text).width;

      levelBanner = {
        text,
        fontSize,
        x: canvas.width, // start offscreen
        y: canvas.height / 2,
        targetX: (canvas.width - textWidth) / 2,
        speed: scrollSpeed, // now matches world scroll
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
    ctx.fillText('using the arrow keys/joystick',canvas.width/2,canvas.height*0.09);
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
    updateBackground(); // keep scrolling

    if (!gameOverAnim) {
      // initialize once
      gameOverAnim = {
        scale: 0.1,
        target: 1.5,
        speed: 0.02,
        done: false,
        timer: 0
      };
      stopSound(sounds.gameBG);
      playSound(sounds.ending, 0.8);
    }

    // if animation finished + enough delay, don’t draw text anymore
    if (gameOverAnim.done && gameOverAnim.timer > 120) {
      return;
    }

    if (!gameOverAnim.done) {
      gameOverAnim.scale += gameOverAnim.speed;
      if (gameOverAnim.scale >= gameOverAnim.target) {
        gameOverAnim.scale = gameOverAnim.target;
        gameOverAnim.done = true;
      }
    } else {
      gameOverAnim.timer++;
      if (gameOverAnim.timer > 120 && !drawGameOver._didHS) { // ~2s after zoom
        checkAndSaveHighScore(score);
        drawGameOver._didHS = true;
      }
    }

    // draw zoom text
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

    // character label (avoid duplicate 'char' declarations)
    const charLabel = selectedPlayer != null ? characters[selectedPlayer].label.toUpperCase() : "-";

    // find insert position (so entries below shift down)
    let insertIndex = highScores.findIndex(e => finalScore > e.score);
    if (insertIndex === -1) insertIndex = highScores.length;

    // insert placeholder entry (empty name) and trim to MAX
    const newEntry = { score: finalScore, name: "", char: charLabel };
    highScores.splice(insertIndex, 0, newEntry);
    highScores.splice(MAX_HIGH_SCORES);

    // start editing that new entry (cursor state)
    drawHighScoreConsole._editingIndex = insertIndex;
    drawHighScoreConsole._cursorVisible = true;
    drawHighScoreConsole._cursorTimer = 0;
  }

  function resetHighScoreEditing() {
    drawHighScoreConsole._editingIndex = null;
    drawHighScoreConsole._cursorVisible = false;
    drawHighScoreConsole._cursorTimer = 0;
  }

  function drawHighScoreConsole(){
const H = canvas.height * 0.8;
const rowFontPx = Math.max(16, canvas.height * 0.024);
const charWidthEstimate = rowFontPx * 0.65;
const desiredNamePx = 20 * charWidthEstimate;
const extraPaddingPx = rowFontPx * 4;
const requiredWFromName = Math.ceil((desiredNamePx + extraPaddingPx) / 0.45);
const W = Math.max(Math.round(canvas.width * 0.35), requiredWFromName);
const X = (canvas.width - W) / 2;
const Y = (canvas.height - H) / 2;

    ctx.save();
    // Panel background
    ctx.globalAlpha = 0.88;
    ctx.fillStyle = "#050a0a";
    ctx.fillRect(X, Y, W, H);

    // Border glow
    ctx.globalAlpha = 1;
    ctx.strokeStyle = "#00ff99";
    ctx.lineWidth = Math.max(3, canvas.width*0.003);
    ctx.shadowColor = "#00ff99";
    ctx.shadowBlur = 12;
    ctx.strokeRect(X, Y, W, H);
    ctx.shadowBlur = 0;

    // Fake scanlines
    ctx.globalAlpha = 0.08;
    ctx.fillStyle = "#00ff99";
    for (let yy = Y+30; yy < Y+H-20; yy += 4) {
      ctx.fillRect(X+10, yy, W-20, 1);
    }
    ctx.globalAlpha = 1;

    // Header
    ctx.fillStyle = "#00ff99";
    ctx.font = Math.max(18, canvas.height * 0.03) + "px monospace";
    ctx.textAlign = "center";
    const headerTop = Y + H * 0.04;
    ctx.fillText("HIGH SCORES", X + W / 2, headerTop);

    // Column headers
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

    // Rows (single loop — includes editing)
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
        // editing row: show typed name + blinking cursor
        let nameText = entry.name || "";
        if (drawHighScoreConsole._cursorVisible) nameText += "_";
        ctx.fillText(nameText, nameLeft, y);
      } else {
        ctx.fillText(entry.name || "-", nameLeft, y);
      }
    }

    // Decorative knobs/buttons
    const knob = (kx,ky,r,fill) => { ctx.beginPath(); ctx.fillStyle = fill; ctx.arc(kx,ky,r,0,Math.PI*2); ctx.fill(); ctx.closePath(); };
    knob(X+18, Y+18, 6, "#888");
    knob(X+W-18, Y+18, 6, "#888");
    knob(X+18, Y+H-18, 6, "#888");
    knob(X+W-18, Y+H-18, 6, "#888");

    // Play Again button
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

    // save play-again bounds for clicks
    drawHighScoreConsole._btn = { x: btnX, y: btnY, w: btnW, h: btnH };

    // blinking cursor timer (advance only when editing)
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

  // --- Resume ONLY the background music (no rewinds) when the page/tab wakes ---
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      try {
        const bg = sounds && sounds.gameBG && sounds.gameBG.audio;
        const start = sounds && sounds.startScreen && sounds.startScreen.audio;

        if (state === "play" && bg && bg.paused) {
          // resume in-game background music where it left off
          bg.play().catch(()=>{});
        }

        if (state === "start" && start && start.paused) {
          // resume start-screen music (don't rewind)
          start.play().catch(()=>{});
        }
      } catch (e) {
        // ignore any errors
      }
    }
  });

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

      // frame-based spawning (device-proof)
      itemSpawnCounter++;
      enemySpawnCounter++;

      const itemRate = Math.max(50, 200 - level * 5); 
      const enemyRate = Math.max(60, 300 - level * 5);

      if (itemSpawnCounter >= itemRate) { 
        spawnItem(); 
        itemSpawnCounter = 0; 
      }
      if (enemySpawnCounter >= enemyRate) { 
        spawnEnemy(); 
        enemySpawnCounter = 0; 
      }

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

        ctx.drawImage(
          explosionImage,
          explosion.x - (expWidth - player.width)/2,
          explosion.y - (expHeight - player.height)/2,
          expWidth,
          expHeight
        );

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
      if (player.flashCount > 0) {
        player.flashTimer--;
        if (player.flashTimer <= 0) {
          player.flashVisible = !player.flashVisible;
          player.flashTimer = 15; 
          player.flashCount--;
        }
      } else {
        // flashing is finished
        player.flashVisible = true;   
        player.flashActive = false;   
      }
    } else if (state === "prize") {
      // draw frozen visuals while email dialog is up
      drawBackground();
      drawPlayer();
      drawItems();
      drawEnemies();
      drawHUD();
      updateAndDrawLevelBanner();

    } else if (state === "gameover") {
      drawGameOver();

      if (drawGameOver._didHS) {
        drawHighScoreConsole();
        drawHUD();
      }
    }

    requestAnimationFrame(loop);
  }

  // ===== Joystick & Touch Handling (device-proof) =====

  const joystick = document.createElement("div");
  const stick = document.createElement("div");
  function layoutJoystick() {
  const size = Math.min(canvas.width, canvas.height) * 0.18;
  const inner = size * 0.42;

  Object.assign(joystick.style, {
    position: "absolute",
    left: `${canvas.width * 0.04}px`,
    bottom: `${canvas.height * 0.06}px`,
    width: `${size}px`,
    height: `${size}px`,
    background: "rgba(255,255,255,0.3)",
    borderRadius: "50%",
    display: "block",
    zIndex: 1000,
    touchAction: "none"
  });

  Object.assign(stick.style, {
    position: "absolute",
    left: "50%",
    top: "50%",
    width: `${inner}px`,
    height: `${inner}px`,
    background: "rgba(255,255,255,0.6)",
    borderRadius: "50%",
    transform: "translate(-50%, -50%)"
  });
}
 layoutJoystick();
window.addEventListener("resize", layoutJoystick);
 joystick.appendChild(stick);
  document.body.appendChild(joystick);

  let joyActive = false;

  // === helper to get canvas-relative coords ===
  function getTouchPosOnCanvas(touch) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: touch.clientX - rect.left,
      y: touch.clientY - rect.top
    };
  }

  // helper to get joystick center in viewport coords
  function getJoystickCenter() {
    const r = joystick.getBoundingClientRect();
    return { cx: r.left + r.width/2, cy: r.top + r.height/2 };
  }

  // Touch start (also used for mobile Play button etc)
  canvas.addEventListener("touchstart", e=>{
    // handle short-circuit for start/intro/gameover interactions below
    const t = e.touches[0];
    const pos = getTouchPosOnCanvas(t);

    // If intro and play button tapped on mobile -> same behavior as click
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
            // spawning via frame counters will handle auto-spawn
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
    const touch = e.touches[0];
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
    joystick.style.left = `100px`;
    joystick.style.bottom = `100px`;
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
            // frame-based spawning handles automatic spawning
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
