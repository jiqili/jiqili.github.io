import * as THREE from 'three';

let scene: THREE.Scene;
let camera: THREE.PerspectiveCamera;
let renderer: THREE.WebGLRenderer;
let objects: THREE.Mesh[] = [];
let objectCount = 100;
let lastTime = performance.now();
let frames = 0;
let fps = 0;
let frameTimes: number[] = [];
let droppedFrames = 0;
let maxDelay = 0;
let lastInteractionTime = 0;
let interactionDelay = 0;
let interactionDelays: number[] = [];  // 记录最近的交互延迟
const TARGET_FRAME_TIME = 1000 / 60; // 16.67ms

// 相机旋转状态
let cameraRotation = { x: 0, y: 0 };
let cameraRotationTarget = { x: 0, y: 0 };  // 目标旋转（阻尼效果）
let cameraDistance = 30;
let cameraDistanceTarget = 30;  // 目标距离（阻尼效果）
let isDragging = false;
const dampingFactor = 0.05;  // 阻尼系数，越小越平滑（0.05-0.2）

self.onmessage = function(e) {
    const { type } = e.data;

    if (type === 'init') {
        const { canvas, width, height, pixelRatio, objectCount: count } = e.data;
        objectCount = count || 100;
        
        scene = new THREE.Scene();
        camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
        renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
        
        renderer.setSize(width, height, false);
        renderer.setPixelRatio(pixelRatio);
        updateCameraPosition();

        createScene();
        animate();
    } else if (type === 'resize') {
        const { width, height } = e.data;
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height, false);
    } else if (type === 'updateCount') {
        objectCount = e.data.count;
        createScene();
    } else if (type === 'interaction') {
        handleInteraction(e.data);
    }
};

// 处理交互事件
function handleInteraction(data: any) {
    const { action, timestamp } = data;
    
    if (action === 'start') {
        isDragging = true;
        // 使用主线程传递的 Date.now() 时间戳（全局统一时间）
        if (timestamp) {
            lastInteractionTime = timestamp;
        }
    } else if (action === 'rotate' && isDragging) {
        const { deltaX, deltaY } = data;
        // 更新目标旋转角度（反转方向，让拖拽更自然）
        cameraRotationTarget.y -= deltaX * 0.005;  // 向左拖拽 -> 相机向左
        cameraRotationTarget.x += deltaY * 0.005;  // 向上拖拽 -> 相机向上
        cameraRotationTarget.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, cameraRotationTarget.x));
    } else if (action === 'end') {
        isDragging = false;
    } else if (action === 'zoom') {
        const { delta } = data;
        // 更新目标距离
        cameraDistanceTarget += delta * 0.05;
        cameraDistanceTarget = Math.max(10, Math.min(100, cameraDistanceTarget));
        // 使用主线程传递的 Date.now() 时间戳
        if (timestamp) {
            lastInteractionTime = timestamp;
        }
    }
}

// 更新相机位置（应用阻尼效果）
function updateCameraPosition() {
    // 平滑插值到目标值（阻尼效果）
    cameraRotation.x += (cameraRotationTarget.x - cameraRotation.x) * dampingFactor;
    cameraRotation.y += (cameraRotationTarget.y - cameraRotation.y) * dampingFactor;
    cameraDistance += (cameraDistanceTarget - cameraDistance) * dampingFactor;
    
    // 更新相机位置
    camera.position.x = cameraDistance * Math.sin(cameraRotation.y) * Math.cos(cameraRotation.x);
    camera.position.y = cameraDistance * Math.sin(cameraRotation.x);
    camera.position.z = cameraDistance * Math.cos(cameraRotation.y) * Math.cos(cameraRotation.x);
    camera.lookAt(0, 0, 0);
}

function createScene() {
    // 清空场景
    while(scene.children.length > 0) { 
        scene.remove(scene.children[0]); 
    }
    objects.length = 0;

    // 添加光照
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight.position.set(10, 10, 10);
    scene.add(directionalLight);

    // 创建物体
    for (let i = 0; i < objectCount; i++) {
        const geometry = new THREE.BoxGeometry(1, 1, 1);
        const material = new THREE.MeshStandardMaterial({
            color: Math.random() * 0xffffff,
            metalness: 0.5,
            roughness: 0.5
        });
        const cube = new THREE.Mesh(geometry, material);
        
        cube.position.x = (Math.random() - 0.5) * 50;
        cube.position.y = (Math.random() - 0.5) * 50;
        cube.position.z = (Math.random() - 0.5) * 50;
        
        cube.userData.velocity = {
            x: (Math.random() - 0.5) * 0.02,
            y: (Math.random() - 0.5) * 0.02,
            z: (Math.random() - 0.5) * 0.02,
            rx: (Math.random() - 0.5) * 0.05,
            ry: (Math.random() - 0.5) * 0.05,
            rz: (Math.random() - 0.5) * 0.05
        };
        
        scene.add(cube);
        objects.push(cube);
    }
}

function animate() {
    const frameStart = performance.now();

    // 持续应用阻尼效果（即使不拖拽也会平滑移动）
    updateCameraPosition();

    // 计算交互延迟（使用 Date.now() 确保主线程和 Worker 时间同步）
    if (lastInteractionTime > 0) {
        const currentDelay = Date.now() - lastInteractionTime;
        interactionDelays.push(currentDelay);
        if (interactionDelays.length > 30) interactionDelays.shift();  // 保留最近30次交互
        
        // 使用平均值或中位数作为显示值
        interactionDelay = interactionDelays.reduce((a, b) => a + b, 0) / interactionDelays.length;
        
        console.log('当前交互延迟:', currentDelay, 'ms, 平均:', interactionDelay.toFixed(2), 'ms');
        lastInteractionTime = 0;
    }

    // 更新物体
    objects.forEach(obj => {
        obj.position.x += obj.userData.velocity.x;
        obj.position.y += obj.userData.velocity.y;
        obj.position.z += obj.userData.velocity.z;
        
        if (Math.abs(obj.position.x) > 25) obj.userData.velocity.x *= -1;
        if (Math.abs(obj.position.y) > 25) obj.userData.velocity.y *= -1;
        if (Math.abs(obj.position.z) > 25) obj.userData.velocity.z *= -1;
        
        obj.rotation.x += obj.userData.velocity.rx;
        obj.rotation.y += obj.userData.velocity.ry;
        obj.rotation.z += obj.userData.velocity.rz;
    });

    renderer.render(scene, camera);

    const frameTime = performance.now() - frameStart;
    frameTimes.push(frameTime);
    if (frameTimes.length > 60) frameTimes.shift();
    
    if (frameTime > TARGET_FRAME_TIME) {
        droppedFrames++;
    }
    maxDelay = Math.max(maxDelay, frameTime);

    // 计算 FPS
    frames++;
    const now = performance.now();
    if (now >= lastTime + 1000) {
        fps = Math.round(frames * 1000 / (now - lastTime));
        frames = 0;
        lastTime = now;
        
        const avgFrameTime = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
        
        // 发送性能数据到主线程
        self.postMessage({
            type: 'stats',
            fps,
            avgFrameTime: avgFrameTime.toFixed(2),
            droppedFrames,
            maxDelay: maxDelay.toFixed(2),
            interactionDelay: interactionDelay.toFixed(2)
        });
        
        // 重置统计
        droppedFrames = 0;
        maxDelay = 0;
    }

    requestAnimationFrame(animate);
}

export {};
