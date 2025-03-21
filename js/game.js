class SnakeGame3D {
    constructor() {
        // Hide loading screen immediately if dependencies are loaded
        if (typeof THREE === 'undefined' || typeof TWEEN === 'undefined') {
            document.getElementById('error-message').classList.remove('hidden');
            throw new Error('Required dependencies not loaded');
        }

        // Hide loading screen
        document.getElementById('loading-screen').style.display = 'none';
        
        // Show game container
        document.getElementById('game-container').style.opacity = '1';

        // Initialize Three.js scene
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 2000);
        this.renderer = new THREE.WebGLRenderer({
            canvas: document.getElementById('gameCanvas'),
            antialias: true,
            powerPreference: 'high-performance'  // Optimize for performance
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.0;

        // Performance optimizations
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));  // Cap pixel ratio
        this.lastFrameTime = performance.now();
        this.frameCount = 0;
        
        // Touch control optimizations
        this.swipeThreshold = 20;  // Even lower threshold for faster response
        this.swipeTimeThreshold = 150;  // Shorter time threshold
        this.touchEnabled = 'ontouchstart' in window;
        this.currentTouchDirection = null;
        this.touchDebounceTimeout = null;

        // Game settings
        this.gridSize = 40;
        this.tileCount = 20;
        this.snake = [{x: 0, y: 0, z: 0}];
        this.direction = {x: 0, y: 0, z: 0};
        this.score = 0;
        this.gameSpeed = 150;
        this.gameLoop = null;
        this.isGameOver = false;
        this.isGameStarted = false;

        // Calculate view height here
        this.viewHeight = (this.tileCount * this.gridSize) * 1.2; // Add 20% margin

        // Set camera position for perfect top-down view
        this.camera.position.set(0, this.viewHeight, 0);  // Camera directly above
        this.camera.lookAt(0, 0, 0);  // Looking straight down
        this.camera.up.set(0, 0, -1);  // Set up vector to align with world coordinates

        // Handle window resize
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });

        // Initialize minimap
        this.minimapCanvas = document.getElementById('minimap');
        this.minimapCtx = this.minimapCanvas.getContext('2d');
        this.minimapCanvas.width = 150;  // Match CSS size
        this.minimapCanvas.height = 150;

        // Adjust for device pixel ratio
        const dpr = Math.min(window.devicePixelRatio, 2);
        this.minimapCanvas.width *= dpr;
        this.minimapCanvas.height *= dpr;
        this.minimapCtx.scale(dpr, dpr);

        // Setup scene
        this.setupScene();
        this.initializeControls();
        
        // Start animation loop immediately
        this.animate();
    }

    setupScene() {
        // Add lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6); // Increased ambient light
        this.scene.add(ambientLight);

        const sunLight = new THREE.DirectionalLight(0xffffff, 1.2);
        sunLight.position.set(0, this.viewHeight, 0); // Use this.viewHeight instead of viewHeight
        sunLight.target.position.set(0, 0, 0);
        sunLight.castShadow = true;
        sunLight.shadow.mapSize.width = 2048;
        sunLight.shadow.mapSize.height = 2048;
        sunLight.shadow.camera.near = 0.5;
        sunLight.shadow.camera.far = this.viewHeight * 2;
        sunLight.shadow.camera.left = -this.viewHeight;
        sunLight.shadow.camera.right = this.viewHeight;
        sunLight.shadow.camera.top = this.viewHeight;
        sunLight.shadow.camera.bottom = -this.viewHeight;
        this.scene.add(sunLight);
        this.scene.add(sunLight.target);

        // Add hemisphere light for better ambient lighting
        const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.4);
        hemiLight.position.set(0, this.viewHeight, 0);
        this.scene.add(hemiLight);

        // Create simple skybox color - lighter for better visibility
        this.scene.background = new THREE.Color(0x9fd5ff);

        // Create ground with texture
        const groundSize = this.gridSize * this.tileCount;
        const groundGeometry = new THREE.PlaneGeometry(groundSize, groundSize);
        const groundMaterial = new THREE.MeshStandardMaterial({
            color: 0x33aa33,
            roughness: 0.8,
            metalness: 0.2
        });
        this.ground = new THREE.Mesh(groundGeometry, groundMaterial);
        this.ground.rotation.x = -Math.PI / 2;  // Rotate to be flat
        this.ground.position.y = 0;
        this.ground.receiveShadow = true;
        this.scene.add(this.ground);

        // Add grass
        this.addGrass();

        // Initialize snake segments
        this.snakeSegments = [];
        this.addSnakeSegment();

        // Create food
        const foodGeometry = new THREE.SphereGeometry(this.gridSize * 0.4);
        const foodMaterial = new THREE.MeshStandardMaterial({
            color: 0xff0000,
            roughness: 0.2,
            metalness: 0.8,
            emissive: 0xff0000,
            emissiveIntensity: 0.5
        });
        this.foodMesh = new THREE.Mesh(foodGeometry, foodMaterial);
        this.foodMesh.castShadow = true;
        this.foodMesh.position.y = this.gridSize/2;
        this.scene.add(this.foodMesh);

        // Generate initial food position
        this.food = this.generateFood();
        this.updateFoodPosition();
    }

    addGrass() {
        const grassGeometry = new THREE.PlaneGeometry(5, 20);
        const grassMaterial = new THREE.MeshStandardMaterial({
            color: 0x44aa44,
            side: THREE.DoubleSide,
            transparent: true,
            alphaTest: 0.5
        });

        for (let i = 0; i < 1000; i++) {
            const grass = new THREE.Mesh(grassGeometry, grassMaterial);
            const x = (Math.random() - 0.5) * this.gridSize * this.tileCount;
            const z = (Math.random() - 0.5) * this.gridSize * this.tileCount;
            grass.position.set(x, 10, z);
            grass.rotation.y = Math.random() * Math.PI;
            grass.rotation.x = Math.random() * 0.2;
            this.scene.add(grass);
        }
    }

    addSnakeSegment() {
        const snakeGeometry = new THREE.BoxGeometry(this.gridSize * 0.8, this.gridSize * 0.8, this.gridSize * 0.8);
        const snakeMaterial = new THREE.MeshStandardMaterial({
            color: 0xffff00,
            roughness: 0.3,
            metalness: 0.7,
            emissive: 0xffff00,
            emissiveIntensity: 0.5
        });
        
        const segment = new THREE.Mesh(snakeGeometry, snakeMaterial);
        segment.castShadow = true;
        segment.receiveShadow = true;
        segment.position.y = this.gridSize/2;
        this.snakeSegments.push(segment);
        this.scene.add(segment);

        // Add scale-up animation for new segment
        segment.scale.set(0.01, 0.01, 0.01);
        new TWEEN.Tween(segment.scale)
            .to({ x: 1, y: 1, z: 1 }, 200)
            .easing(TWEEN.Easing.Back.Out)
            .start();
    }

    generateFood() {
        const x = Math.floor(Math.random() * (this.tileCount - 2)) - Math.floor(this.tileCount / 2) + 1;
        const z = Math.floor(Math.random() * (this.tileCount - 2)) - Math.floor(this.tileCount / 2) + 1;
        return {x, y: 0, z};
    }

    updateFoodPosition() {
        this.foodMesh.position.set(
            this.food.x * this.gridSize,
            this.gridSize/2,
            this.food.z * this.gridSize
        );
    }

    initializeControls() {
        if (this.touchEnabled) {
            // Optimized touch controls
            const canvas = document.getElementById('gameCanvas');
            
            const handleTouchStart = (e) => {
                e.preventDefault();
                const touch = e.touches[0];
                this.touchStart = { 
                    x: touch.clientX, 
                    y: touch.clientY,
                    time: performance.now()
                };
            };

            const handleTouchMove = (e) => {
                e.preventDefault();
                if (!this.touchStart || !this.isGameStarted || this.isGameOver) return;

                const touch = e.touches[0];
                const dx = touch.clientX - this.touchStart.x;
                const dy = touch.clientY - this.touchStart.y;
                const touchDuration = performance.now() - this.touchStart.time;

                // Process swipe immediately if it meets the threshold
                if (touchDuration <= this.swipeTimeThreshold) {
                    let newDirection = null;

                    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) >= this.swipeThreshold) {
                        newDirection = dx > 0 ? 'ArrowRight' : 'ArrowLeft';
                    } else if (Math.abs(dy) >= this.swipeThreshold) {
                        newDirection = dy > 0 ? 'ArrowDown' : 'ArrowUp';
                    }

                    if (newDirection && newDirection !== this.currentTouchDirection) {
                        this.currentTouchDirection = newDirection;
                        this.handleKeyPress(newDirection);
                        
                        this.touchStart = { 
                            x: touch.clientX, 
                            y: touch.clientY,
                            time: performance.now()
                        };
                    }
                }
            };

            const handleTouchEnd = () => {
                this.touchStart = null;
                this.currentTouchDirection = null;
            };

            // Add touch event listeners with passive: false for better performance
            canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
            canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
            canvas.addEventListener('touchend', handleTouchEnd, { passive: false });

            // Optimize button controls
            const touchButtons = {
                'upBtn': 'ArrowUp',
                'downBtn': 'ArrowDown',
                'leftBtn': 'ArrowLeft',
                'rightBtn': 'ArrowRight'
            };

            Object.entries(touchButtons).forEach(([btnId, key]) => {
                const btn = document.getElementById(btnId);
                const handleButtonTouch = (e) => {
                    e.preventDefault();
                    if (!this.touchDebounceTimeout) {
                        this.handleKeyPress(key);
                        // Add small debounce to prevent rapid firing
                        this.touchDebounceTimeout = setTimeout(() => {
                            this.touchDebounceTimeout = null;
                        }, 50);
                    }
                };
                btn.addEventListener('touchstart', handleButtonTouch, { passive: false });
            });
        }

        // Keyboard controls
        document.addEventListener('keydown', (e) => {
            this.handleKeyPress(e.key);
        });

        // Game start/restart controls
        ['startBtn', 'restartBtn'].forEach(btnId => {
            const btn = document.getElementById(btnId);
            const handleGameStart = (e) => {
                if (e.type === 'touchstart') e.preventDefault();
                this.startGame();
            };
            btn.addEventListener('touchstart', handleGameStart, { passive: false });
            btn.addEventListener('click', handleGameStart);
        });
    }

    handleKeyPress(key) {
        if (this.isGameOver) return;
        if (!this.isGameStarted) return;

        const newDirection = {...this.direction};

        switch(key) {
            case 'ArrowUp':
                if (this.direction.z !== 1) {  // Prevent reversing
                    newDirection.x = 0;
                    newDirection.z = -1;  // Move up in screen space
                }
                break;
            case 'ArrowDown':
                if (this.direction.z !== -1) {  // Prevent reversing
                    newDirection.x = 0;
                    newDirection.z = 1;  // Move down in screen space
                }
                break;
            case 'ArrowLeft':
                if (this.direction.x !== 1) {  // Prevent reversing
                    newDirection.x = -1;  // Move left in screen space
                    newDirection.z = 0;
                }
                break;
            case 'ArrowRight':
                if (this.direction.x !== -1) {  // Prevent reversing
                    newDirection.x = 1;  // Move right in screen space
                    newDirection.z = 0;
                }
                break;
        }

        if (newDirection.x !== this.direction.x || newDirection.z !== this.direction.z) {
            this.direction = newDirection;
        }
    }

    update() {
        if (this.isGameOver || !this.isGameStarted) return;

        // Only update if we have a direction
        if (this.direction.x === 0 && this.direction.z === 0) return;

        // Move snake
        const head = {
            x: this.snake[0].x + this.direction.x,
            y: 0,
            z: this.snake[0].z + this.direction.z
        };

        // Check collision with walls
        if (head.x < -this.tileCount/2 || head.x >= this.tileCount/2 || 
            head.z < -this.tileCount/2 || head.z >= this.tileCount/2) {
            this.gameOver();
            return;
        }

        // Check collision with self (skip the last segment as it will move)
        for (let i = 0; i < this.snake.length - 1; i++) {
            if (head.x === this.snake[i].x && head.z === this.snake[i].z) {
                this.gameOver();
                return;
            }
        }

        // Add new head
        this.snake.unshift(head);

        // Check if food is eaten
        if (head.x === this.food.x && head.z === this.food.z) {
            this.score += 10;
            document.getElementById('score').textContent = this.score;
            this.food = this.generateFood();
            this.updateFoodPosition();
            
            // Add new segment
            this.addSnakeSegment();

            // Increase speed
            this.gameSpeed = Math.max(50, this.gameSpeed - 2);
            if (this.gameLoop) {
                clearInterval(this.gameLoop);
                this.gameLoop = setInterval(() => this.update(), this.gameSpeed);
            }
        } else {
            this.snake.pop();
        }

        // Update snake segments positions
        this.updateSnakeSegments();
        
        // Update minimap
        this.updateMinimap();
    }

    updateSnakeSegments() {
        this.snake.forEach((segment, index) => {
            if (this.snakeSegments[index]) {
                const targetPosition = {
                    x: segment.x * this.gridSize,
                    y: this.gridSize/2,
                    z: segment.z * this.gridSize
                };

                // Faster animation for mobile
                const duration = this.gameSpeed * 0.5; // Reduced from 0.8 to 0.5
                
                new TWEEN.Tween(this.snakeSegments[index].position)
                    .to(targetPosition, duration)
                    .easing(TWEEN.Easing.Linear.None) // Changed to Linear for smoother movement
                    .start();
            }
        });
    }

    updateMinimap() {
        const ctx = this.minimapCtx;
        const scale = this.minimapCanvas.width / (this.tileCount * this.gridSize);
        const tileSize = Math.max(2, this.gridSize * scale);

        // Clear minimap with semi-transparent background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.fillRect(0, 0, this.minimapCanvas.width, this.minimapCanvas.height);

        // Draw grid lines (subtle)
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 0.5;
        for (let i = 0; i <= this.tileCount; i++) {
            const pos = i * this.gridSize * scale;
            ctx.beginPath();
            ctx.moveTo(pos, 0);
            ctx.lineTo(pos, this.minimapCanvas.height);
            ctx.moveTo(0, pos);
            ctx.lineTo(this.minimapCanvas.width, pos);
            ctx.stroke();
        }

        // Draw food with glow effect
        ctx.fillStyle = '#ff4444';
        ctx.shadowColor = '#ff0000';
        ctx.shadowBlur = 5;
        ctx.beginPath();
        ctx.arc(
            (this.food.x + this.tileCount/2) * this.gridSize * scale + tileSize/2,
            (this.food.z + this.tileCount/2) * this.gridSize * scale + tileSize/2,
            tileSize/2,
            0,
            Math.PI * 2
        );
        ctx.fill();

        // Reset shadow for snake
        ctx.shadowBlur = 0;

        // Draw snake with gradient
        const headIndex = 0;
        this.snake.forEach((segment, index) => {
            const alpha = 1 - (index / this.snake.length) * 0.5;
            ctx.fillStyle = index === headIndex ? '#ffff00' : `rgba(255, 255, 0, ${alpha})`;
            
            ctx.beginPath();
            ctx.arc(
                (segment.x + this.tileCount/2) * this.gridSize * scale + tileSize/2,
                (segment.z + this.tileCount/2) * this.gridSize * scale + tileSize/2,
                tileSize/2,
                0,
                Math.PI * 2
            );
            ctx.fill();
        });
    }

    gameOver() {
        this.isGameOver = true;
        clearInterval(this.gameLoop);
        
        // Show game over menu
        document.getElementById('game-menu').classList.add('hidden');
        document.getElementById('game-over').classList.remove('hidden');
        document.getElementById('final-score').textContent = this.score;

        // Add game over animation
        this.snakeSegments.forEach((segment, index) => {
            new TWEEN.Tween(segment.position)
                .to({ y: segment.position.y + 100 }, 500)
                .delay(index * 50)
                .easing(TWEEN.Easing.Quadratic.Out)
                .start();

            new TWEEN.Tween(segment.scale)
                .to({ x: 0.01, y: 0.01, z: 0.01 }, 500)
                .delay(index * 50 + 500)
                .easing(TWEEN.Easing.Back.In)
                .start();
        });
    }

    startGame() {
        // Hide menus
        document.getElementById('game-menu').classList.add('hidden');
        document.getElementById('game-over').classList.add('hidden');

        // Reset game state
        this.snake = [{x: 0, y: 0, z: 0}];
        this.direction = {x: 0, y: 0, z: 0};
        this.score = 0;
        this.gameSpeed = 150;
        this.isGameOver = false;
        this.isGameStarted = true;
        document.getElementById('score').textContent = '0';

        // Remove old snake segments
        this.snakeSegments.forEach(segment => {
            this.scene.remove(segment);
        });
        this.snakeSegments = [];

        // Create new head segment
        this.addSnakeSegment();

        // Generate new food
        this.food = this.generateFood();
        this.updateFoodPosition();

        // Clear existing game loop
        if (this.gameLoop) clearInterval(this.gameLoop);

        // Start game loop
        this.gameLoop = setInterval(() => {
            this.update();
        }, this.gameSpeed);
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        
        // Performance optimization: limit update rate on mobile
        const currentTime = performance.now();
        const deltaTime = currentTime - this.lastFrameTime;
        
        if (this.touchEnabled && deltaTime < (1000 / 60)) {  // Cap at 60fps on mobile
            return;
        }

        this.lastFrameTime = currentTime;
        this.frameCount++;

        // Optimize rendering
        TWEEN.update();
        this.renderer.render(this.scene, this.camera);

        // Monitor performance every second
        if (this.frameCount % 60 === 0) {
            const fps = 1000 / deltaTime;
            if (fps < 30 && this.renderer.getPixelRatio() > 1) {
                // Reduce quality if performance is poor
                this.renderer.setPixelRatio(1);
            }
        }
    }
}

// Update the window.onload handler at the bottom of the file
window.addEventListener('DOMContentLoaded', () => {
    try {
        // Check if dependencies are loaded
        if (typeof THREE === 'undefined') {
            throw new Error('Three.js is not loaded! Please check your internet connection.');
        }

        if (typeof TWEEN === 'undefined') {
            throw new Error('TWEEN.js is not loaded! Please check your internet connection.');
        }

        // Initialize game
        const game = new SnakeGame3D();
        console.log('Game initialized successfully!');

    } catch (error) {
        console.error('Error initializing game:', error);
        document.getElementById('loading-screen').style.display = 'none';
        document.getElementById('error-message').classList.remove('hidden');
        document.getElementById('error-details').textContent = error.message;
    }
});

// Add error handling for Three.js
window.addEventListener('error', function(e) {
    if (e.error?.toString().includes('THREE')) {
        console.error('Three.js error:', e.error);
        alert('An error occurred with the 3D rendering. Please refresh the page.');
    }
}); 