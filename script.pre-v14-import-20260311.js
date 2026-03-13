(() => {
  // Will be initialized in initGame()
  let canvas, ctx, startBtn, resetBtn, distanceEl, healthEl, gameStateEl, winTextEl

  // Game constants (px / s units for frame-rate independent physics)
  const GRAVITY = 1500           // px/s^2 (gravity)
  const JUMP_VELOCITY = 620      // px/s (initial jump velocity) - increased for higher jumps
  const MAX_SPEED = 260          // px/s (requested)
  const ACCEL = 1800             // px/s^2 (acceleration when pressing move)
  const FRICTION = 2200          // px/s^2 (ground friction / deceleration)
  const AIR_ACCEL_FACTOR = 0.6   // multiplier for horizontal accel while in air
  const WORLD_WIDTH = 5200
  const WORLD_HEIGHT = 600
  const CHARACTER_SIZE = 32
  const HEALTH_MAX = 3
  const GOAL_X = 4800
  const INVINCIBLE_TIME = 60   // Frames (1 second at 60fps)

  // Game state
  let running = false
  let gameOver = false
  let won = false
  let health = HEALTH_MAX
  let cloudImage = null
  let backgroundImage = null
  const debugMode = false  // Set to true to see hitboxes

  // Player
  const player = {
    x: 100,
    y: 520,  // Start on ground
    vx: 0,
    vy: 0,
    width: CHARACTER_SIZE,
    height: CHARACTER_SIZE,
    jumping: false,
    onGround: false,
    facingLeft: false,
    distanceTravelled: 0,
    invincible: false,
    invincibleCounter: 0
  }

  // Ground constant
  const GROUND_Y = 550  // Ground/bottom platform y position

  // Input tracking
  const keys = {}
  window.addEventListener('keydown', e => {
    keys[e.key.toLowerCase()] = true
    if (e.key === ' ') {
      e.preventDefault()
      if (player.onGround && running) {
        player.vy = -JUMP_VELOCITY
        player.jumping = true
        player.onGround = false
        playJumpSound()
      }
    }
  })
  window.addEventListener('keyup', e => {
    keys[e.key.toLowerCase()] = false
  })

  // Platforms
  const platforms = [
    { x: 0, y: 550, w: 200, h: 50 }, // start
    { x: 250, y: 480, w: 120, h: 20 },
    { x: 450, y: 420, w: 120, h: 20 },
    { x: 650, y: 380, w: 150, h: 20 },
    { x: 900, y: 450, w: 140, h: 20 },
    { x: 1200, y: 380, w: 180, h: 20 },
    { x: 1600, y: 420, w: 160, h: 20 },
    { x: 2000, y: 380, w: 200, h: 20 },
    { x: 2400, y: 450, w: 180, h: 20 },
    { x: 2800, y: 380, w: 200, h: 20 },
    { x: 3200, y: 420, w: 220, h: 20 },
    { x: 3600, y: 380, w: 200, h: 20 },
    { x: 4000, y: 450, w: 240, h: 20 },
    { x: 4400, y: 380, w: 200, h: 20 },
    { x: 4700, y: 500, w: 200, h: 50 } // goal area
  ]

  // Obstacles (spikes/enemy blocks)
  const obstacles = [
    { x: 350, y: 500, w: 40, h: 40 },
    { x: 750, y: 510, w: 40, h: 40 },
    { x: 1300, y: 500, w: 40, h: 40 },
    { x: 1800, y: 510, w: 40, h: 40 },
    { x: 2250, y: 500, w: 40, h: 40 },
    { x: 2900, y: 510, w: 40, h: 40 },
    { x: 3400, y: 500, w: 40, h: 40 },
    { x: 3900, y: 510, w: 40, h: 40 }
  ]

  // Goal (mama)
  const goal = {
    x: GOAL_X,
    y: 420,
    r: 20
  }

  // Camera
  let cameraX = 0
  let lastTime = 0
  let manualTimeMode = false

  // Load cloud image
  function loadCloudImage() {
    cloudImage = null
  }

  // Load background image
  function loadBackgroundImage() {
    backgroundImage = null
  }

  // Draw player (cloud character)
  function drawPlayer() {
    const screenX = player.x - cameraX
    const screenY = player.y

    ctx.save()
    
    // Visual blinking effect during invincibility (invincibleCounter in seconds)
    if (player.invincible) {
      ctx.globalAlpha = 0.5 + Math.sin(player.invincibleCounter * 20) * 0.4
    }
    
    ctx.translate(screenX + player.width / 2, screenY + player.height / 2)
    if (player.facingLeft) ctx.scale(-1, 1)
    ctx.translate(-(player.width / 2), -(player.height / 2))

    // Circle clip
    ctx.beginPath()
    ctx.arc(player.width / 2, player.height / 2, player.width / 2, 0, Math.PI * 2)
    ctx.clip()

    if (cloudImage) {
      ctx.drawImage(cloudImage, 0, 0, player.width, player.height)
    } else {
      // Fallback: gradient circle
      const grad = ctx.createLinearGradient(0, 0, player.width, player.height)
      grad.addColorStop(0, '#39ff14')
      grad.addColorStop(1, '#9b5cff')
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, player.width, player.height)
    }

    ctx.restore()
    ctx.globalAlpha = 1.0  // Reset alpha for other drawings

    // Eye
    ctx.fillStyle = '#000'
    ctx.beginPath()
    ctx.arc(screenX + player.width / 2 - 6, screenY + player.height / 2 - 4, 2, 0, Math.PI * 2)
    ctx.fill()

    // Debug: Draw player hitbox
    if (debugMode) {
      ctx.strokeStyle = 'rgba(0, 255, 255, 0.8)'
      ctx.lineWidth = 2
      ctx.strokeRect(screenX, screenY, player.width, player.height)
      ctx.fillStyle = 'rgba(0, 255, 255, 0.2)'
      ctx.fillRect(screenX, screenY, player.width, player.height)
    }
  }

  // Draw platforms
  function drawPlatforms() {
    // Draw infinite ground
    const groundPlatform = { x: 0, y: GROUND_Y, w: WORLD_WIDTH, h: 50 }
    const x = groundPlatform.x - cameraX
    ctx.fillStyle = '#2d5f2f'
    ctx.fillRect(x, groundPlatform.y, canvas.width + Math.abs(x), groundPlatform.h)
    
    // Draw ground pattern
    ctx.fillStyle = 'rgba(57, 255, 20, 0.1)'
    for (let xi = x; xi < x + canvas.width + 100; xi += 40) {
      ctx.fillRect(xi, groundPlatform.y, 20, 50)
    }

    // Draw platforms
    ctx.fillStyle = '#39ff14'
    for (let p of platforms) {
      const px = p.x - cameraX
      if (px + p.w > 0 && px < canvas.width) {
        ctx.fillRect(px, p.y, p.w, p.h)
        ctx.strokeStyle = 'rgba(155, 92, 255, 0.3)'
        ctx.lineWidth = 2
        ctx.strokeRect(px, p.y, p.w, p.h)
      }
    }

    // Debug: Draw ground hitbox
    if (debugMode) {
      ctx.strokeStyle = 'rgba(255, 0, 255, 0.5)'
      ctx.lineWidth = 1
      ctx.strokeRect(x, groundPlatform.y, canvas.width + Math.abs(x), groundPlatform.h)
    }
  }

  // Draw obstacles
  function drawObstacles() {
    ctx.fillStyle = '#ff4444'
    for (let obs of obstacles) {
      const x = obs.x - cameraX
      if (x + obs.w > 0 && x < canvas.width) {
        ctx.fillRect(x, obs.y, obs.w, obs.h)
        ctx.strokeStyle = '#ff0000'
        ctx.lineWidth = 2
        ctx.strokeRect(x, obs.y, obs.w, obs.h)
        
        // Debug: obstacle hitbox highlight
        if (debugMode) {
          ctx.fillStyle = 'rgba(255, 0, 0, 0.3)'
          ctx.fillRect(x, obs.y, obs.w, obs.h)
        }
      }
    }
  }

  // Draw goal (mama)
  function drawGoal() {
    const x = goal.x - cameraX
    if (x > -50 && x < canvas.width + 50) {
      // Glow effect
      ctx.fillStyle = 'rgba(255, 165, 0, 0.3)'
      ctx.beginPath()
      ctx.arc(x, goal.y, goal.r + 10, 0, Math.PI * 2)
      ctx.fill()

      // Mama circle
      ctx.fillStyle = '#ffa500'
      ctx.beginPath()
      ctx.arc(x, goal.y, goal.r, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = '#ff8c00'
      ctx.lineWidth = 2
      ctx.stroke()

      // Icon
      ctx.fillStyle = '#fff'
      ctx.font = 'bold 16px Arial'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('ğŸ–', x, goal.y)
    }
  }

  // Draw background and HUD
  function drawBackground() {
    // Draw sky
    const grad = ctx.createLinearGradient(0, 0, 0, canvas.height)
    grad.addColorStop(0, '#1a3a4d')     // darker sky at top
    grad.addColorStop(0.5, '#2d5a73')   // lighter in middle
    grad.addColorStop(1, '#1a4d3d')     // greenish at bottom
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Far mountains (slow parallax)
    if (backgroundImage) {
      const parallaxX = (cameraX * 0.2) % (backgroundImage.width)
      ctx.drawImage(backgroundImage, -parallaxX, 0, canvas.width, canvas.height / 2)
      ctx.drawImage(backgroundImage, canvas.width - parallaxX, 0, canvas.width, canvas.height / 2)
    } else {
      // Fallback: draw gradient mountains
      ctx.fillStyle = 'rgba(20, 60, 40, 0.4)'
      ctx.beginPath()
      ctx.moveTo(0, canvas.height * 0.6)
      ctx.bezierCurveTo(
        canvas.width * 0.3, canvas.height * 0.3,
        canvas.width * 0.7, canvas.height * 0.4,
        canvas.width, canvas.height * 0.5
      )
      ctx.lineTo(canvas.width, 0)
      ctx.lineTo(0, 0)
      ctx.fill()
    }

    // Trees (parallax, slower than camera)
    ctx.fillStyle = 'rgba(30, 80, 50, 0.6)'
    const treePattern = 300
    const parallaxTreeX = (cameraX * 0.5) % treePattern
    for (let txOffset = -parallaxTreeX; txOffset < canvas.width + treePattern; txOffset += treePattern) {
      // Tree trunk
      ctx.fillRect(txOffset + 100, canvas.height * 0.65, 20, 80)
      // Tree foliage
      ctx.beginPath()
      ctx.arc(txOffset + 110, canvas.height * 0.65, 40, 0, Math.PI * 2)
      ctx.fill()
    }

    // Ground color overlay
    ctx.fillStyle = 'rgba(30, 100, 60, 0.8)'
    ctx.fillRect(0, GROUND_Y, canvas.width, canvas.height - GROUND_Y)

    // Grid pattern for debugging world alignment
    if (debugMode) {
      ctx.strokeStyle = 'rgba(155, 92, 255, 0.1)'
      ctx.lineWidth = 1
      const gridSize = 100
      for (let xi = Math.floor(cameraX / gridSize) * gridSize; xi < cameraX + canvas.width + gridSize; xi += gridSize) {
        ctx.beginPath()
        ctx.moveTo(xi - cameraX, 0)
        ctx.lineTo(xi - cameraX, canvas.height)
        ctx.stroke()
      }
    }
  }

  // Update camera
  function updateCamera() {
    const targetCameraX = player.x - canvas.width / 3
    // Smoothly follow player without tying directly to player velocity
    cameraX += (targetCameraX - cameraX) * 0.06
    cameraX = Math.max(0, Math.min(cameraX, WORLD_WIDTH - canvas.width))
  }

  // Collision detection
  function checkCollisions() {
    // Infinite ground platform
    const groundPlatform = { x: 0, y: GROUND_Y, w: WORLD_WIDTH, h: 50 }
    
    // All platforms including ground
    const allPlatforms = [groundPlatform, ...platforms]
    
    // Reset ground state
    player.onGround = false
    
    for (let p of allPlatforms) {
      // AABB collision: Bottom collision (landing)
      if (player.vy >= 0 &&
          player.y + player.height >= p.y &&
          player.y + player.height <= p.y + 10 &&
          player.x + player.width > p.x &&
          player.x < p.x + p.w) {
        player.y = p.y - player.height
        player.vy = 0
        player.onGround = true
        player.jumping = false
      }
    }

    // Obstacle collisions
    for (let obs of obstacles) {
      if (player.x + player.width > obs.x &&
          player.x < obs.x + obs.w &&
          player.y + player.height > obs.y &&
          player.y < obs.y + obs.h) {
        takeDamage()
        player.x = 100
        player.y = GROUND_Y - player.height
        player.vx = 0
        player.vy = 0
      }
    }

    // Goal collision
    const dx = (player.x + player.width / 2) - goal.x
    const dy = (player.y + player.height / 2) - goal.y
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist < player.width / 2 + goal.r) {
      win()
    }

    // World bounds (fall off world)
    if (player.y > canvas.height + 100) {
      takeDamage()
      player.x = 100
      player.y = GROUND_Y - player.height
      player.vx = 0
      player.vy = 0
    }
  }

  // Take damage
  function takeDamage() {
    // If invincible, ignore damage
    if (player.invincible) return
    
    health--
    healthEl.textContent = health
    
    // Activate invincibility iFrame (convert frames -> seconds)
    player.invincible = true
    player.invincibleCounter = INVINCIBLE_TIME / 60
    
    if (health <= 0) {
      endGame()
    }
    playDamageSound()
  }

  // Win game
  function win() {
    won = true
    running = false
    winTextEl.classList.remove('hidden')
    playWinSound()
  }

  // End game
  function endGame() {
    running = false
    gameOver = true
    gameStateEl.textContent = 'Oyun Bitti! SaÄŸlÄ±k: 0'
    gameStateEl.classList.remove('hidden')
  }

  // Update player physics
  function updatePlayer(dt) {
    if (!running) return

    // Horizontal input
    let moveDir = 0
    if (keys['a'] || keys['arrowleft']) {
      moveDir -= 1
      player.facingLeft = true
    }
    if (keys['d'] || keys['arrowright']) {
      moveDir += 1
      player.facingLeft = false
    }

    // Apply horizontal acceleration (reduced in air)
    const effectiveAccel = ACCEL * (player.onGround ? 1 : AIR_ACCEL_FACTOR)
    if (moveDir !== 0) {
      player.vx += effectiveAccel * moveDir * dt
    } else if (player.onGround) {
      // Apply friction to slow down to zero when no input on ground
      const decel = FRICTION * dt
      if (player.vx > 0) {
        player.vx = Math.max(0, player.vx - decel)
      } else if (player.vx < 0) {
        player.vx = Math.min(0, player.vx + decel)
      }
    }

    // Cap max speed
    player.vx = Math.max(-MAX_SPEED, Math.min(MAX_SPEED, player.vx))

    // Apply gravity (px/s^2)
    player.vy += GRAVITY * dt

    // Update position using velocity (px/s -> px)
    player.x += player.vx * dt
    player.y += player.vy * dt

    // World bounds
    player.x = Math.max(0, Math.min(player.x, WORLD_WIDTH - player.width))

    // Update distance (pixel-based)
    player.distanceTravelled = Math.max(player.distanceTravelled, player.x)
    distanceEl.textContent = Math.floor(player.distanceTravelled)

    // Update invincibility counter (frames -> convert to seconds using dt)
    if (player.invincible) {
      // INVINCIBLE_TIME is in frames (60 frames = 1s). Convert to seconds.
      const invSec = INVINCIBLE_TIME / 60
      player.invincibleCounter -= dt
      if (player.invincibleCounter <= 0) {
        player.invincible = false
      }
    }

    checkCollisions()
  }

  // Start game
  function startGame() {
    console.log('start clicked')
    if (running) return
    running = true
    gameOver = false
    won = false
    health = HEALTH_MAX
    healthEl.textContent = health
    player.x = 100
    player.y = GROUND_Y - player.height
    player.vx = 0
    player.vy = 0
    player.invincible = false
    player.invincibleCounter = 0
    player.distanceTravelled = 0
    distanceEl.textContent = '0'
    gameStateEl.classList.add('hidden')
    winTextEl.classList.add('hidden')
    cameraX = 0
    // Start game loop
    requestAnimationFrame(gameLoop)
  }

  // Reset game
  function resetGame() {
    console.log('reset clicked')
    running = false
    gameOver = false
    won = false
    health = HEALTH_MAX
    healthEl.textContent = health
    player.x = 100
    player.y = GROUND_Y - player.height
    player.vx = 0
    player.vy = 0
    player.invincible = false
    player.invincibleCounter = 0
    player.distanceTravelled = 0
    distanceEl.textContent = '0'
    gameStateEl.classList.add('hidden')
    winTextEl.classList.add('hidden')
    cameraX = 0
  }

  // Sound effects
  function playJumpSound() {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)()
      const osc = audioCtx.createOscillator()
      const gain = audioCtx.createGain()
      osc.frequency.setValueAtTime(500, audioCtx.currentTime)
      osc.frequency.exponentialRampToValueAtTime(200, audioCtx.currentTime + 0.1)
      gain.gain.setValueAtTime(0.1, audioCtx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.1)
      osc.connect(gain)
      gain.connect(audioCtx.destination)
      osc.start(audioCtx.currentTime)
      osc.stop(audioCtx.currentTime + 0.1)
    } catch (e) {}
  }

  function playDamageSound() {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)()
      const osc = audioCtx.createOscillator()
      const gain = audioCtx.createGain()
      osc.frequency.setValueAtTime(200, audioCtx.currentTime)
      osc.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.2)
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.2)
      osc.connect(gain)
      gain.connect(audioCtx.destination)
      osc.start(audioCtx.currentTime)
      osc.stop(audioCtx.currentTime + 0.2)
    } catch (e) {}
  }

  function playWinSound() {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)()
      const osc = audioCtx.createOscillator()
      const gain = audioCtx.createGain()
      osc.frequency.setValueAtTime(800, audioCtx.currentTime)
      osc.frequency.exponentialRampToValueAtTime(1200, audioCtx.currentTime + 0.3)
      gain.gain.setValueAtTime(0.2, audioCtx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.3)
      osc.connect(gain)
      gain.connect(audioCtx.destination)
      osc.start(audioCtx.currentTime)
      osc.stop(audioCtx.currentTime + 0.3)
    } catch (e) {}
  }

  function renderFrame() {
    if (!canvas || !ctx) return

    if (!running) {
      ctx.fillStyle = 'rgba(10, 32, 26, 1)'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      return
    }

    drawBackground()
    drawPlatforms()
    drawObstacles()
    drawGoal()
    drawPlayer()
  }

  function stepGame(dt) {
    if (!running) return
    updatePlayer(dt)
    updateCamera()
    renderFrame()
  }

  function renderGameToText() {
    const payload = {
      coordinateSystem: 'origin top-left, +x right, +y down',
      running,
      gameOver,
      won,
      health,
      cameraX: Math.round(cameraX),
      player: {
        x: Math.round(player.x),
        y: Math.round(player.y),
        vx: Math.round(player.vx),
        vy: Math.round(player.vy),
        onGround: player.onGround,
        facingLeft: player.facingLeft,
        invincible: player.invincible
      },
      goal: { x: goal.x, y: goal.y, r: goal.r },
      distance: Math.floor(player.distanceTravelled),
      obstacles: obstacles.map((obs) => ({ x: obs.x, y: obs.y, w: obs.w, h: obs.h })),
      platforms: platforms.slice(0, 8).map((p) => ({ x: p.x, y: p.y, w: p.w, h: p.h }))
    }
    return JSON.stringify(payload)
  }

  // Main game loop (uses timestamp -> dt)
  function gameLoop(timestamp) {
    if (manualTimeMode) return
    if (!lastTime) lastTime = timestamp
    const dt = Math.min(0.05, (timestamp - lastTime) / 1000) // clamp to 50ms
    lastTime = timestamp

    stepGame(dt)

    requestAnimationFrame(gameLoop)
  }

  // Initialize and bind events
  function initGame() {
    console.log('Initializing game...')
    
    // Capture DOM elements now that DOM is ready
    canvas = document.getElementById('gameCanvas')
    ctx = canvas.getContext('2d')
    startBtn = document.getElementById('startBtn')
    resetBtn = document.getElementById('resetBtn')
    distanceEl = document.getElementById('distance')
    healthEl = document.getElementById('health')
    gameStateEl = document.getElementById('gameState')
    winTextEl = document.getElementById('winText')

    console.log('Canvas:', canvas)
    console.log('startBtn:', startBtn)
    console.log('resetBtn:', resetBtn)
    
    if (!canvas || !startBtn || !resetBtn) {
      console.error('Required elements not found!')
      return
    }

    // Load cloud image
    loadCloudImage()
    // Load background image
    loadBackgroundImage()

    startBtn.addEventListener('click', startGame)
    resetBtn.addEventListener('click', resetGame)

    console.log('Events bound successfully!')
    window.render_game_to_text = renderGameToText
    window.advanceTime = (ms) => {
      manualTimeMode = true
      const dt = 1 / 60
      const steps = Math.max(1, Math.round(ms / (1000 / 60)))
      for (let i = 0; i < steps; i += 1) {
        stepGame(dt)
      }
      renderFrame()
    }
    // Start the main loop
    requestAnimationFrame(gameLoop)
  }

  // Wait for DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initGame)
  } else {
    initGame()
  }
})()



