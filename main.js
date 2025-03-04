import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Water } from 'three/examples/jsm/objects/Water';
import { Sky } from 'three/examples/jsm/objects/Sky';

// Socket.IO setup
const socket = io(window.location.origin);

// Global variables
let roomCode = null;
let playerName = null;
let isHunter = false;
let hunterId = null;
let isRoomCreator = false;
const otherPlayers = {};
let scene = null;

// Add loading manager
const loadingManager = new THREE.LoadingManager();
let loadingScreen;
const collisionObjects = [];
const islandRadius = 145;

// Notification div
let notificationDiv = null;

function showNotification(message) {
    if (!notificationDiv) {
        notificationDiv = document.createElement('div');
        notificationDiv.style.position = 'fixed';
        notificationDiv.style.top = '50%';
        notificationDiv.style.left = '50%';
        notificationDiv.style.transform = 'translate(-50%, -50%)';
        notificationDiv.style.background = 'rgba(0, 0, 0, 0.8)';
        notificationDiv.style.color = 'white';
        notificationDiv.style.padding = '20px';
        notificationDiv.style.borderRadius = '8px';
        notificationDiv.style.zIndex = '1001';
        document.body.appendChild(notificationDiv);
    }
    notificationDiv.textContent = message;
    notificationDiv.style.display = 'block';
    setTimeout(() => {
        notificationDiv.style.display = 'none';
    }, 3000);
}

// Loading screen functions
function createLoadingScreen() {
    loadingScreen = document.createElement('div');
    loadingScreen.style.position = 'fixed';
    loadingScreen.style.top = '0';
    loadingScreen.style.left = '0';
    loadingScreen.style.width = '100%';
    loadingScreen.style.height = '100%';
    loadingScreen.style.background = '#000000';
    loadingScreen.style.display = 'flex';
    loadingScreen.style.flexDirection = 'column';
    loadingScreen.style.alignItems = 'center';
    loadingScreen.style.justifyContent = 'center';
    loadingScreen.style.zIndex = '1000';

    const spinner = document.createElement('div');
    spinner.style.width = '50px';
    spinner.style.height = '50px';
    spinner.style.border = '5px solid #333';
    spinner.style.borderTop = '5px solid #fff';
    spinner.style.borderRadius = '50%';
    spinner.style.animation = 'spin 1s linear infinite';

    const loadingText = document.createElement('div');
    loadingText.textContent = 'Loading...';
    loadingText.style.color = '#ffffff';
    loadingText.style.marginTop = '20px';
    loadingText.style.fontSize = '20px';

    const progressText = document.createElement('div');
    progressText.id = 'loading-progress';
    progressText.style.color = '#ffffff';
    progressText.style.marginTop = '10px';
    progressText.style.fontSize = '16px';

    const style = document.createElement('style');
    style.textContent = `
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    `;
    document.head.appendChild(style);

    loadingScreen.appendChild(spinner);
    loadingScreen.appendChild(loadingText);
    loadingScreen.appendChild(progressText);
    document.body.appendChild(loadingScreen);
}

loadingManager.onProgress = function(url, itemsLoaded, itemsTotal) {
    const progress = Math.round((itemsLoaded / itemsTotal) * 100);
    const progressText = document.getElementById('loading-progress');
    if (progressText) progressText.textContent = `${progress}%`;
};

loadingManager.onLoad = function() {
    if (loadingScreen) {
        loadingScreen.style.display = 'none';
        document.body.removeChild(loadingScreen);
    }
};

// UI functions (exposed to global scope)
function createRoom() {
    playerName = document.getElementById('playerNameInput').value.trim();
    if (!playerName) return alert('Please enter a name');
    socket.emit('createRoom', playerName, (code) => {
        roomCode = code;
        isRoomCreator = true;
        document.getElementById('menu').classList.add('hidden');
        document.getElementById('roomLobby').classList.remove('hidden');
        document.getElementById('roomCode').textContent = roomCode;
    });
}

function showJoinRoom() {
    document.getElementById('roomCodeInput').style.display = 'block';
    document.getElementById('joinRoomBtn').style.display = 'inline';
}

function joinRoom() {
    playerName = document.getElementById('playerNameInput').value.trim();
    const code = document.getElementById('roomCodeInput').value.trim().toUpperCase();
    if (!playerName || !code) return alert('Please enter name and room code');
    socket.emit('joinRoom', code, playerName, (response) => {
        if (response.success) {
            roomCode = response.roomCode;
            isRoomCreator = false;
            document.getElementById('menu').classList.add('hidden');
            document.getElementById('roomLobby').classList.remove('hidden');
            document.getElementById('roomCode').textContent = roomCode;
        } else {
            alert(response.message);
        }
    });
}

function startGame() {
    if (!isRoomCreator) {
        alert('Only the room creator can start the game!');
        return;
    }
    socket.emit('startGame', roomCode);
}

// Assign functions to window object to make them globally accessible
window.createRoom = createRoom;
window.showJoinRoom = showJoinRoom;
window.joinRoom = joinRoom;
window.startGame = startGame;

// Socket.IO events
socket.on('playerList', (players) => {
    const playerList = document.getElementById('playerList');
    playerList.innerHTML = '<h4>Players:</h4>' + players.map(p => `<p>${p.name}</p>`).join('');

    if (scene) {
        players.forEach(player => {
            if (player.id !== socket.id && !otherPlayers[player.id]) {
                const otherPlayer = createCharacter(player.name);
                otherPlayer.position.set(player.position.x, player.position.y, player.position.z);
                otherPlayer.userData.caught = player.caught;
                if (player.id === hunterId) {
                    otherPlayer.userData.nameSprite.material.color.set(0xff0000);
                }
                otherPlayer.userData.isWaving = player.isWaving || false;
                otherPlayer.userData.waveTime = player.waveTime || 0;
                otherPlayer.userData.isCrouching = player.isCrouching || false;
                otherPlayer.userData.crouchAmount = player.crouchAmount || 0;
                otherPlayer.userData.isMoving = player.isMoving || false;
                otherPlayer.userData.animationTime = player.animationTime || 0;
                scene.add(otherPlayer);
                otherPlayers[player.id] = otherPlayer;
            } else if (otherPlayers[player.id]) {
                otherPlayers[player.id].position.set(player.position.x, player.position.y, player.position.z);
                otherPlayers[player.id].userData.caught = player.caught;
                otherPlayers[player.id].userData.isWaving = player.isWaving || false;
                otherPlayers[player.id].userData.waveTime = player.waveTime || 0;
                otherPlayers[player.id].userData.isCrouching = player.isCrouching || false;
                otherPlayers[player.id].userData.crouchAmount = player.crouchAmount || 0;
                otherPlayers[player.id].userData.isMoving = player.isMoving || false;
                otherPlayers[player.id].userData.animationTime = player.animationTime || 0;
            }
        });

        for (const id in otherPlayers) {
            if (!players.some(p => p.id === id)) {
                scene.remove(otherPlayers[id]);
                delete otherPlayers[id];
            }
        }
    }
});

socket.on('gameStarted', ({ hunter }) => {
    isHunter = socket.id === hunter;
    hunterId = hunter;
    document.getElementById('roomLobby').classList.add('hidden');
    document.getElementById('gameFrame').style.display = 'none';
    createLoadingScreen();
    loadGame(playerName);
});

socket.on('playerMoved', ({ id, position, animationState }) => {
    if (otherPlayers[id]) {
        otherPlayers[id].position.set(position.x, position.y, position.z);
        if (animationState) {
            otherPlayers[id].userData.isWaving = animationState.isWaving || false;
            otherPlayers[id].userData.waveTime = animationState.waveTime || 0;
            otherPlayers[id].userData.isCrouching = animationState.isCrouching || false;
            otherPlayers[id].userData.crouchAmount = animationState.crouchAmount || 0;
            otherPlayers[id].userData.isMoving = animationState.isMoving || false;
            otherPlayers[id].userData.animationTime = animationState.animationTime || 0;
        }
    }
});

socket.on('playerCaught', (taggedPlayerId) => {
    if (otherPlayers[taggedPlayerId]) {
        otherPlayers[taggedPlayerId].userData.nameSprite.material.color.set(0xff0000);
        otherPlayers[taggedPlayerId].userData.caught = true;
    }
    if (socket.id === taggedPlayerId) {
        showNotification('You have been caught!');
    }
});

socket.on('gameOver', ({ winner }) => {
    alert(`Game Over! ${winner === 'hunter' ? 'Hunter wins!' : 'Players escaped!'}`);
    location.reload();
});

// Define createNameSprite before createCharacter
function createNameSprite(name) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 256;
    canvas.height = 64;

    ctx.fillStyle = 'rgba(0, 0, 0, 0)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.font = 'bold 32px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.strokeStyle = 'white';
    ctx.lineWidth = 4;
    ctx.strokeText(name, canvas.width / 2, canvas.height / 2);

    ctx.fillStyle = '#4CAF50';
    ctx.fillText(name, canvas.width / 2, canvas.height / 2);

    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(2, 0.5, 1);
    return sprite;
}

function createCharacter(name = 'Player') {
    const character = new THREE.Group();
    const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0x000000 });
    const headMaterial = new THREE.MeshStandardMaterial({ color: 0xffcc99 });
    const eyeMaterial = new THREE.MeshStandardMaterial({ color: 0x000000 });

    const addShadowsToMesh = (mesh) => {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
    };

    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.6, 0.2), bodyMaterial);
    torso.position.y = 0.9;
    addShadowsToMesh(torso);
    character.add(torso);

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.25, 0.25), headMaterial);
    head.position.y = 1.325;
    addShadowsToMesh(head);
    character.add(head);

    const leftEye = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.05), eyeMaterial);
    leftEye.position.set(-0.08, 1.35, 0.125);
    addShadowsToMesh(leftEye);
    character.add(leftEye);

    const rightEye = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.05), eyeMaterial);
    rightEye.position.set(0.08, 1.35, 0.125);
    addShadowsToMesh(rightEye);
    character.add(rightEye);

    const leftArm = new THREE.Group();
    const leftUpperArm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.2, 0.17), bodyMaterial);
    leftUpperArm.position.y = 0;
    addShadowsToMesh(leftUpperArm);
    leftArm.add(leftUpperArm);

    const leftLowerArm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.3, 0.17), headMaterial);
    leftLowerArm.position.y = -0.25;
    addShadowsToMesh(leftLowerArm);
    leftArm.add(leftLowerArm);
    leftArm.position.set(-0.25, 1.05, 0);
    character.add(leftArm);

    const rightArm = new THREE.Group();
    const rightUpperArm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.2, 0.17), bodyMaterial);
    rightUpperArm.position.y = 0;
    addShadowsToMesh(rightUpperArm);
    rightArm.add(rightUpperArm);

    const rightLowerArm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.3, 0.17), headMaterial);
    rightLowerArm.position.y = -0.25;
    addShadowsToMesh(rightLowerArm);
    rightArm.add(rightLowerArm);
    rightArm.position.set(0.25, 1.05, 0);
    character.add(rightArm);

    const leftLeg = new THREE.Group();
    const leftUpperLeg = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.4, 0.15), bodyMaterial);
    leftUpperLeg.position.y = 0;
    addShadowsToMesh(leftUpperLeg);
    leftLeg.add(leftUpperLeg);

    const leftLowerLeg = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.2, 0.15), headMaterial);
    leftLowerLeg.position.y = -0.3;
    addShadowsToMesh(leftLowerLeg);
    leftLeg.add(leftLowerLeg);
    leftLeg.position.set(-0.12, 0.5, 0);
    character.add(leftLeg);

    const rightLeg = new THREE.Group();
    const rightUpperLeg = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.4, 0.15), bodyMaterial);
    rightUpperLeg.position.y = 0;
    addShadowsToMesh(rightUpperLeg);
    rightLeg.add(rightUpperLeg);

    const rightLowerLeg = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.2, 0.15), headMaterial);
    rightLowerLeg.position.y = -0.3;
    addShadowsToMesh(rightLowerLeg);
    rightLeg.add(rightLowerLeg);
    rightLeg.position.set(0.12, 0.5, 0);
    character.add(rightLeg);

    const nameSprite = createNameSprite(name);
    nameSprite.position.set(0, 2, 0);
    character.add(nameSprite);

    character.userData = {
        leftArm, rightArm, leftLeg, rightLeg, head, torso, nameSprite, leftEye, rightEye,
        leftUpperLeg, leftLowerLeg, rightUpperLeg, rightLowerLeg, 
        caught: false, isWaving: false, waveTime: 0, isCrouching: false, 
        crouchAmount: 0, isMoving: false, animationTime: 0
    };

    return character;
}

function animateCharacter(character) {
    const { leftArm, rightArm, leftLeg, rightLeg, head, torso, nameSprite, leftEye, rightEye, leftUpperLeg, leftLowerLeg, rightUpperLeg, rightLowerLeg } = character.userData;

    // Handle crouching
    if (character.userData.isCrouching) {
        character.userData.crouchAmount = Math.min(character.userData.crouchAmount + 0.1, 1);
    } else {
        character.userData.crouchAmount = Math.max(character.userData.crouchAmount - 0.1, 0);
    }

    const baseHeight = 2.4;
    const crouchHeight = 2.4;
    const currentHeight = baseHeight - (character.userData.crouchAmount * (baseHeight - crouchHeight));

    if (character.userData.crouchAmount > 0) {
        character.position.y = currentHeight;
        const crouchFactor = character.userData.crouchAmount;
        torso.position.y = 0.9 - (0.3 * crouchFactor);
        head.position.y = 1.325 - (0.3 * crouchFactor);
        leftEye.position.y = 1.35 - (0.3 * crouchFactor);
        rightEye.position.y = 1.35 - (0.3 * crouchFactor);
        leftArm.position.y = 1.05 - (0.3 * crouchFactor);
        rightArm.position.y = 1.05 - (0.3 * crouchFactor);
        leftArm.rotation.x = -(Math.PI / 4) * crouchFactor;
        rightArm.rotation.x = -(Math.PI / 4) * crouchFactor;
        leftLowerLeg.rotation.x = (Math.PI / 2) * crouchFactor;
        rightLowerLeg.rotation.x = (Math.PI / 2) * crouchFactor;
        nameSprite.position.y = 2 - (0.6 * crouchFactor);
    } else {
        character.position.y = baseHeight;
        torso.position.y = 0.9;
        head.position.y = 1.325;
        leftEye.position.y = 1.35;
        rightEye.position.y = 1.35;
        leftEye.position.z = 0.13;
        rightEye.position.z = 0.13;
        leftArm.position.y = 1.05;
        rightArm.position.y = 1.05;
        nameSprite.position.y = 2;
        torso.rotation.x = 0;
        head.rotation.x = 0;
        leftArm.rotation.x = 0;
        rightArm.rotation.x = 0;
        leftLeg.rotation.x = 0;
        rightLeg.rotation.x = 0;
    }

    // Handle waving emote
    if (character.userData.isWaving) {
        character.userData.waveTime += 1; // Increment every frame
        if (character.userData.waveTime < 90) {
            const waveProgress = character.userData.waveTime / 90;
            const wavePhase = Math.sin(waveProgress * Math.PI * 8) * Math.PI;
            leftArm.rotation.x = Math.PI;
            leftArm.rotation.z = wavePhase / 16;
        } else {
            leftArm.rotation.set(0, 0, 0);
            character.userData.isWaving = false;
            character.userData.waveTime = 0; // Reset waveTime
        }
    } else if (character.userData.isMoving) {
        character.userData.animationTime += 0.1;
        const swingAngle = Math.sin(character.userData.animationTime) * 1;
        leftArm.rotation.x = -swingAngle;
        rightArm.rotation.x = swingAngle;
        leftLeg.rotation.x = swingAngle * 0.5;
        rightLeg.rotation.x = -swingAngle * 0.5;
    } else {
        leftArm.rotation.x = 0;
        rightArm.rotation.x = 0;
        leftLeg.rotation.x = 0;
        rightLeg.rotation.x = 0;
    }
}

function loadGame(name) {
    scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.5;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.body.appendChild(renderer.domElement);

    const sky = new Sky();
    sky.scale.setScalar(50000);
    scene.add(sky);
    const sun = new THREE.Vector3();
    const sunUniforms = sky.material.uniforms;
    sunUniforms['exposure'] = 0.18;
    let sunX = -90;
    const updateInterval = 0.1;

    const sunLight = new THREE.DirectionalLight(0xffffff, 10);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 500;
    sunLight.shadow.camera.left = -100;
    sunLight.shadow.camera.right = 100;
    sunLight.shadow.camera.top = 100;
    sunLight.shadow.camera.bottom = -100;
    scene.add(sunLight);

    function updateSun() {
        sunX += updateInterval;
        sunLight.position.set(sun.x * 100, sun.y * 100, sun.z * 100);
        let phi = THREE.MathUtils.degToRad(sunX);
        const theta = THREE.MathUtils.degToRad(90);
        sun.setFromSphericalCoords(1, phi, theta);
        sunUniforms.sunPosition.value.copy(sun);
    }
    updateSun();

    const moon = new THREE.Vector3();
    const moonUniforms = sky.material.uniforms;
    let moonX = 90;

    const moonLight = new THREE.DirectionalLight(0x3686a0, 2.5);
    moonLight.castShadow = true;
    moonLight.shadow.mapSize.width = 2048;
    moonLight.shadow.mapSize.height = 2048;
    moonLight.shadow.camera.near = 0.5;
    moonLight.shadow.camera.far = 500;
    moonLight.shadow.camera.left = -100;
    moonLight.shadow.camera.right = 100;
    moonLight.shadow.camera.top = 100;
    moonLight.shadow.camera.bottom = -100;
    scene.add(moonLight);

    function updateMoon() {
        moonX += updateInterval;
        moonLight.position.set(moon.x * 100, moon.y * 100, moon.z * 100);
        let phi = THREE.MathUtils.degToRad(moonX);
        const theta = THREE.MathUtils.degToRad(90);
        moon.setFromSphericalCoords(1, phi, theta);
        moonUniforms.sunPosition.value.copy(moon);
    }
    updateMoon();

    const waterGeometry = new THREE.PlaneGeometry(10000, 10000);
    const normalMapTexture = new THREE.TextureLoader(loadingManager).load('/waterNormals.jpg', (texture) => {
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    });
    normalMapTexture.encoding = THREE.LinearEncoding;

    const water = new Water(waterGeometry, {
        textureWidth: 512,
        textureHeight: 512,
        waterNormals: normalMapTexture,
        sunDirection: new THREE.Vector3(),
        sunColor: 0xffffff,
        waterColor: 0x001e0f,
        distortionScale: 3.7,
        fog: scene.fog !== undefined
    });
    water.rotation.x = -Math.PI / 2;
    water.receiveShadow = true;
    scene.add(water);

    const textureLoader = new THREE.TextureLoader(loadingManager);
    const grassTexture = textureLoader.load('grass_texture.jpg');
    grassTexture.wrapS = grassTexture.wrapT = THREE.RepeatWrapping;
    grassTexture.repeat.set(4, 4);

    const islandGeometry = new THREE.CylinderGeometry(150, 150, 5, 64, 64);
    const islandMaterial = new THREE.MeshStandardMaterial({ map: grassTexture });
    const island = new THREE.Mesh(islandGeometry, islandMaterial);
    island.position.set(0, 0, 0);
    island.receiveShadow = true;
    scene.add(island);

    class Grass {
        constructor(scene) {
            this.scene = scene;
            this.count = 1000;
            this.radius = 140;
            this.height = 2.2;
        }

        getPosition() {
            let angle = Math.random() * Math.PI * 2;
            let distance = Math.random() * this.radius;
            return { x: Math.cos(angle) * distance, z: Math.sin(angle) * distance };
        }

        createGrass(model) {
            let grass = model.clone();
            let pos = this.getPosition();
            let scale = 0.8 + Math.random() * 0.4;
            grass.scale.set(scale, scale, scale);
            grass.rotation.y = Math.random() * Math.PI * 2;
            grass.position.set(pos.x, this.height, pos.z);
            return grass;
        }

        setup() {
            let loader = new GLTFLoader();
            loader.load('Grass.glb', (model) => {
                model.scene.traverse((part) => {
                    if (part.isMesh) {
                        part.castShadow = true;
                        part.receiveShadow = true;
                    }
                });
                for (let i = 0; i < this.count; i++) {
                    let grass = this.createGrass(model.scene);
                    this.scene.add(grass);
                }
            });
        }
    }
    let grass = new Grass(scene);
    grass.setup();

    const character = createCharacter(name);
    character.position.set(Math.floor(Math.random() * 101), 2.4, 0);
    scene.add(character);
    

    
    if (isHunter) {
        character.userData.nameSprite.material.color.set(0xff0000);
    }

    const characterState = {
        velocity: new THREE.Vector3(),
        height: 1,
        direction: new THREE.Vector3(),
        animationTime: 0,
        isWaving: false,
        waveTime: 0,
        waveDuration: 90,
        isCrouching: false,
        crouchAmount: 0,
        normalHeight: 2.4,
        crouchHeight: 1.8,
        crouchTransitionSpeed: 0.1
    };
    const cameraState = {
        distance: 5,
        rotationX: 0,
        rotationY: Math.PI / 6,
        sensitivity: 0.06
    };
    let moveSpeed = 0.5;
    const jumpForce = 0.15;
    const gravity = -0.01;
    const keys = {};

    document.addEventListener('keydown', (event) => {
        if (character.userData.caught) return;
        keys[event.key.toLowerCase()] = true;
        keys[event.key] = true;
        if (event.key.toLowerCase() === 'e' && !character.userData.isWaving) {
            characterState.isWaving = true;
            characterState.waveTime = 0;
            character.userData.isWaving = true;
            character.userData.waveTime = 0;
        }
        if (event.key.toLowerCase() === 'c') {
            characterState.isCrouching = true;
            character.userData.isCrouching = true;
            moveSpeed = 0.3;
        }
    });

    document.addEventListener('keyup', (event) => {
        if (character.userData.caught) return;
        keys[event.key.toLowerCase()] = false;
        keys[event.key] = false;
        if (event.key.toLowerCase() === 'c') {
            characterState.isCrouching = false;
            character.userData.isCrouching = false;
            moveSpeed = 0.5;
        }
    });

    function updateCharacter() {
        if (character.userData.caught) return;

        const cameraDirection = new THREE.Vector3();
        camera.getWorldDirection(cameraDirection);
        cameraDirection.y = 0;
        cameraDirection.normalize();

        const right = new THREE.Vector3();
        right.crossVectors(camera.up, cameraDirection).normalize();

        characterState.direction.set(0, 0, 0);

        // Allow movement even while waving
        if (keys['w']) characterState.direction.add(cameraDirection);
        if (keys['s']) characterState.direction.sub(cameraDirection);

        if (characterState.direction.length() > 0) {
            characterState.direction.normalize();
            const currentMoveSpeed = characterState.isCrouching ? moveSpeed * 0.5 : moveSpeed;
            const newPosition = new THREE.Vector3(
                character.position.x + characterState.direction.x * currentMoveSpeed,
                character.position.y,
                character.position.z + characterState.direction.z * currentMoveSpeed
            );

            if (checkCollisions(newPosition)) {
                character.position.copy(newPosition);
                character.userData.isMoving = true;
                character.rotation.y = Math.atan2(characterState.direction.x, characterState.direction.z);
            } else {
                character.userData.isMoving = false;
            }
        } else {
            character.userData.isMoving = false;
        }

        // Always send position and animation state updates
        socket.emit('updatePosition', roomCode, {
            x: character.position.x,
            y: character.position.y,
            z: character.position.z
        }, {
            isWaving: character.userData.isWaving,
            waveTime: character.userData.waveTime,
            isCrouching: character.userData.isCrouching,
            crouchAmount: character.userData.crouchAmount,
            isMoving: character.userData.isMoving,
            animationTime: character.userData.animationTime
        });

        // Check for tagging
        for (const id in otherPlayers) {
            const otherPlayer = otherPlayers[id];
            const dx = character.position.x - otherPlayer.position.x;
            const dz = character.position.z - otherPlayer.position.z;
            const distance = Math.sqrt(dx * dx + dz * dz);
            if (distance < 1 && !otherPlayer.userData.caught) {
                if (isHunter) {
                    socket.emit('playerTagged', roomCode, id);
                } else if (id === hunterId) {
                    socket.emit('playerTagged', roomCode, socket.id);
                }
            }
        }
    }

    function updateCamera() {
        if (keys['ArrowRight']) cameraState.rotationX -= cameraState.sensitivity;
        if (keys['ArrowLeft']) cameraState.rotationX += cameraState.sensitivity;

        camera.position.x = character.position.x + Math.sin(cameraState.rotationX) * cameraState.distance;
        camera.position.z = character.position.z + Math.cos(cameraState.rotationX) * cameraState.distance;
        camera.position.y = character.position.y + Math.sin(cameraState.rotationY) * cameraState.distance;
        camera.lookAt(character.position);
    }

    const rockGeometry = new THREE.DodecahedronGeometry(2);
    const rockMaterial = new THREE.MeshStandardMaterial({ color: 0x666666 });
    const rockPositions = [
        { radius: 120, count: 10 },
        { radius: 80, count: 8 },
        { radius: 40, count: 3 }
    ];
    rockPositions.forEach(circle => {
        const angleStep = (Math.PI * 2) / circle.count;
        for (let i = 0; i < circle.count; i++) {
            const rock = new THREE.Mesh(rockGeometry, rockMaterial);
            const angle = i * angleStep;
            rock.position.x = Math.cos(angle) * circle.radius;
            rock.position.z = Math.sin(angle) * circle.radius;
            rock.position.y = 2.5;
            rock.rotation.y = angle + (Math.PI / 4);
            rock.rotation.z = Math.PI * 0.05;
            rock.castShadow = true;
            rock.receiveShadow = true;
            rock.userData.collisionRadius = 2;
            collisionObjects.push(rock);
            scene.add(rock);
        }
    });

    const treeLoader = new GLTFLoader(loadingManager);
    treeLoader.load('/tree.glb', function(gltf) {
        const treeModel = gltf.scene;
        treeModel.scale.set(1, 1, 1);
        treeModel.traverse((node) => {
            if (node.isMesh) {
                node.castShadow = true;
                node.receiveShadow = true;
            }
        });

        const numberOfTrees = 100;
        const innerRadius = 20;
        const outerRadius = 100;
        const goldenAngle = Math.PI * (3 - Math.sqrt(5));
        const fibonacci = [2, 11, 17, 22, 36, 22, 27, 33, 30, 13, 19, 16, 23, 29];

        for (let i = 0; i < numberOfTrees; i++) {
            const angle = i * goldenAngle;
            const fiboIndex = i % fibonacci.length;
            const radiusFactor = fibonacci[fiboIndex] / fibonacci[fibonacci.length - 1];
            const radius = innerRadius + (outerRadius - innerRadius) * radiusFactor;
            const x = Math.cos(angle) * radius;
            const z = Math.sin(angle) * radius;
            const rotation = (angle + Math.atan2(z, x)) * (i % 3 + 1);
            const tree = treeModel.clone();
            tree.position.set(x, 2.5, z);
            tree.rotation.y = rotation;
            const scaleFactor = 1 + (Math.cos(angle * 2.4) * 0.2);
            tree.scale.set(scaleFactor, scaleFactor, scaleFactor);
            tree.userData.collisionRadius = 1;
            collisionObjects.push(tree);
            scene.add(tree);
        }
    }, undefined, function(error) {
        console.error('Error loading tree:', error);
    });

    function checkCollisions(newPosition) {
        const distanceFromCenter = Math.sqrt(newPosition.x * newPosition.x + newPosition.z * newPosition.z);
        if (distanceFromCenter > islandRadius) return false;

        for (const obj of collisionObjects) {
            const collisionRadius = obj.userData.collisionRadius || 2;
            const dx = newPosition.x - obj.position.x;
            const dz = newPosition.z - obj.position.z;
            const distance = Math.sqrt(dx * dx + dz * dz);
            if (distance < collisionRadius) return false;
        }
        return true;
    }

    function animate(timestamp) {
        requestAnimationFrame(animate);
        water.material.uniforms['time'].value += 1.0 / 60.0;
        updateCamera();
        updateCharacter();
        animateCharacter(character);
        for (const id in otherPlayers) {
            animateCharacter(otherPlayers[id]);
        }
        updateMoon();
        updateSun();
        character.userData.nameSprite.quaternion.copy(camera.quaternion);
        renderer.render(scene, camera);
    }

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    animate();
}
