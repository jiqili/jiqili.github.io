import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import styles from './OffscreenDemo.module.css';

type RenderMode = 'none' | 'offscreen' | 'main';

interface PerformanceStats {
  fps: number;
  avgFrameTime: string;
  droppedFrames: number;
  maxDelay: string;
  interactionDelay: string;
}

const OffscreenDemo: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const workerRef = useRef<Worker | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const objectsRef = useRef<THREE.Mesh[]>([]);
  const animationFrameRef = useRef<number | null>(null);

  const [currentMode, setCurrentMode] = useState<RenderMode>('none');
  const objectCount = 20000; // 固定物体数量为两万
  const [stats, setStats] = useState<PerformanceStats>({
    fps: 0,
    avgFrameTime: '0',
    droppedFrames: 0,
    maxDelay: '0',
    interactionDelay: '0'
  });

  // 性能监控变量
  const perfRef = useRef({
    lastTime: performance.now(),
    frames: 0,
    frameTimes: [] as number[],
    droppedFrames: 0,
    maxDelay: 0,
    lastInteractionTime: 0,
    interactionDelay: 0,
    interactionDelays: [] as number[]  // 记录交互延迟历史
  });

  const TARGET_FRAME_TIME = 1000 / 60;

  // 初始化离屏渲染
  const initOffscreenMode = () => {
    cleanupMainThread();

    if (!canvasRef.current || !containerRef.current) return;

    // 移除旧 canvas
    const oldCanvas = containerRef.current.querySelector('canvas');
    if (oldCanvas) {
      oldCanvas.remove();
    }

    // 创建新 canvas
    const newCanvas = document.createElement('canvas');
    newCanvas.className = styles.canvas;
    containerRef.current.insertBefore(
      newCanvas,
      containerRef.current.querySelector(`.${styles.stats}`)
    );

    const offscreen = newCanvas.transferControlToOffscreen();
    const worker = new Worker(
      new URL('./offscreen-worker.ts', import.meta.url),
      { type: 'module' }
    );
    workerRef.current = worker;

    worker.postMessage(
      {
        type: 'init',
        canvas: offscreen,
        width: newCanvas.clientWidth,
        height: newCanvas.clientHeight,
        pixelRatio: window.devicePixelRatio,
        objectCount: objectCount
      },
      [offscreen]
    );

    worker.onmessage = (e) => {
      if (e.data.type === 'stats') {
        setStats(e.data);
      }
    };

    setupOffscreenControls(newCanvas, worker);
  };

  // 设置离屏模式控制器
  const setupOffscreenControls = (canvas: HTMLCanvasElement, worker: Worker) => {
    let isDragging = false;
    let lastMouseX = 0;
    let lastMouseY = 0;

    const handleMouseDown = (e: MouseEvent) => {
      isDragging = true;
      lastMouseX = e.clientX;
      lastMouseY = e.clientY;
      console.log('鼠标按下', Date.now());
      worker.postMessage({
        type: 'interaction',
        action: 'start',
        timestamp: Date.now()  // 使用 Date.now() 作为全局时间戳
      });
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;

      const deltaX = e.clientX - lastMouseX;
      const deltaY = e.clientY - lastMouseY;
      lastMouseX = e.clientX;
      lastMouseY = e.clientY;

      worker.postMessage({
        type: 'interaction',
        action: 'rotate',
        deltaX,
        deltaY
      });
    };

    const handleMouseUp = () => {
      isDragging = false;

      worker.postMessage({
        type: 'interaction',
        action: 'end'
      });
    };

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();

      worker.postMessage({
        type: 'interaction',
        action: 'zoom',
        delta: e.deltaY,
        timestamp: Date.now()  // 使用 Date.now() 作为全局时间戳
      });
    };

    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('wheel', handleWheel);
  };

  // 初始化主线程渲染
  const initMainThreadMode = () => {
    cleanupWorker();

    if (!containerRef.current) return;

    // 移除旧 canvas
    const oldCanvas = containerRef.current.querySelector('canvas');
    if (oldCanvas) {
      oldCanvas.remove();
    }

    // 创建新 canvas
    const newCanvas = document.createElement('canvas');
    newCanvas.className = styles.canvas;
    containerRef.current.insertBefore(
      newCanvas,
      containerRef.current.querySelector(`.${styles.stats}`)
    );

    // 初始化 Three.js
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      75,
      newCanvas.clientWidth / newCanvas.clientHeight,
      0.1,
      1000
    );
    const renderer = new THREE.WebGLRenderer({ canvas: newCanvas, antialias: true });

    renderer.setSize(newCanvas.clientWidth, newCanvas.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    camera.position.z = 30;

    // 添加轨道控制器
    const controls = new OrbitControls(camera, newCanvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;

    controls.addEventListener('start', () => {
      perfRef.current.lastInteractionTime = Date.now();  // 使用 Date.now() 保持一致
    });

    sceneRef.current = scene;
    cameraRef.current = camera;
    rendererRef.current = renderer;
    controlsRef.current = controls;

    createScene();
    animate();
  };

  // 创建场景
  const createScene = () => {
    const scene = sceneRef.current;
    if (!scene) return;

    // 清空场景
    while (scene.children.length > 0) {
      scene.remove(scene.children[0]);
    }
    objectsRef.current = [];

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
      objectsRef.current.push(cube);
    }
  };

  // 主线程动画循环
  const animate = () => {
    if (currentMode !== 'main') return;

    animationFrameRef.current = requestAnimationFrame(animate);

    const frameStart = performance.now();
    const perf = perfRef.current;

    // 更新控制器
    controlsRef.current?.update();

    // 计算交互延迟（使用平滑处理）
    if (perf.lastInteractionTime > 0) {
      const currentDelay = Date.now() - perf.lastInteractionTime;
      perf.interactionDelays.push(currentDelay);
      if (perf.interactionDelays.length > 30) perf.interactionDelays.shift();
      
      // 使用平均值
      perf.interactionDelay = perf.interactionDelays.reduce((a, b) => a + b, 0) / perf.interactionDelays.length;
      perf.lastInteractionTime = 0;
    }

    // 更新物体
    objectsRef.current.forEach((obj) => {
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

    rendererRef.current?.render(sceneRef.current!, cameraRef.current!);

    const frameTime = performance.now() - frameStart;
    perf.frameTimes.push(frameTime);
    if (perf.frameTimes.length > 60) perf.frameTimes.shift();

    if (frameTime > TARGET_FRAME_TIME) {
      perf.droppedFrames++;
    }
    perf.maxDelay = Math.max(perf.maxDelay, frameTime);

    // 计算 FPS
    perf.frames++;
    const now = performance.now();
    if (now >= perf.lastTime + 1000) {
      const fps = Math.round((perf.frames * 1000) / (now - perf.lastTime));
      perf.frames = 0;
      perf.lastTime = now;

      const avgFrameTime =
        perf.frameTimes.reduce((a, b) => a + b, 0) / perf.frameTimes.length;

      setStats({
        fps,
        avgFrameTime: avgFrameTime.toFixed(2),
        droppedFrames: perf.droppedFrames,
        maxDelay: perf.maxDelay.toFixed(2),
        interactionDelay: perf.interactionDelay.toFixed(2)
      });

      // 重置统计
      perf.droppedFrames = 0;
      perf.maxDelay = 0;
    }
  };

  // 清理函数
  const cleanupWorker = () => {
    if (workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = null;
    }
  };

  const cleanupMainThread = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (rendererRef.current) {
      rendererRef.current.dispose();
      rendererRef.current = null;
    }
    if (controlsRef.current) {
      controlsRef.current.dispose();
      controlsRef.current = null;
    }
    sceneRef.current = null;
    cameraRef.current = null;
    objectsRef.current = [];
  };

  // 切换渲染模式
  const toggleRenderMode = () => {
    // 重置性能统计
    perfRef.current = {
      lastTime: performance.now(),
      frames: 0,
      frameTimes: [],
      droppedFrames: 0,
      maxDelay: 0,
      lastInteractionTime: 0,
      interactionDelay: 0,
      interactionDelays: []
    };

    if (currentMode === 'none') {
      setCurrentMode('offscreen');
    } else if (currentMode === 'offscreen') {
      setCurrentMode('main');
    } else {
      setCurrentMode('none');
    }
  };

  // 清除画布
  const clearCanvas = () => {
    const canvas = containerRef.current?.querySelector('canvas');
    if (canvas) {
      // 尝试用 WebGL 清除
      const gl = canvas.getContext('webgl') || canvas.getContext('webgl2');
      if (gl) {
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        perfRef.current = {
            lastTime: performance.now(),
            frames: 0,
            frameTimes: [],
            droppedFrames: 0,
            maxDelay: 0,
            lastInteractionTime: 0,
            interactionDelay: 0,
            interactionDelays: []
        };
      }
    }
  };

  // 模拟主线程繁重任务
  const addMainThreadWork = () => {
    console.log('🔥 开始执行主线程繁重任务...');
    let count = 0;
    const interval = setInterval(() => {
      let sum = 0;
      for (let i = 0; i < 20000000; i++) {
        sum += Math.sqrt(i) * Math.sin(i);
      }
      count++;
      console.log(`主线程任务进度: ${count * 10}%`);
      if (count >= 10) {
        clearInterval(interval);
        console.log('✅ 主线程任务完成');
      }
    }, 100);
  };

  // 初始化和清理
  useEffect(() => {
    if (currentMode === 'offscreen') {
      initOffscreenMode();
    } else if (currentMode === 'main') {
      initMainThreadMode();
    } else {
      // none 模式：清理所有内容
      cleanupWorker();
      cleanupMainThread();
      clearCanvas();
    }

    return () => {
      cleanupWorker();
      cleanupMainThread();
    };
  }, [currentMode]);

  // 响应式调整
  useEffect(() => {
    const handleResize = () => {
      const canvas = containerRef.current?.querySelector('canvas');
      if (!canvas) return;

      const width = canvas.clientWidth;
      const height = canvas.clientHeight;

      if (currentMode === 'offscreen' && workerRef.current) {
        workerRef.current.postMessage({
          type: 'resize',
          width,
          height
        });
      } else if (cameraRef.current && rendererRef.current) {
        cameraRef.current.aspect = width / height;
        cameraRef.current.updateProjectionMatrix();
        rendererRef.current.setSize(width, height);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [currentMode]);

  const getStatClass = (value: number, thresholds: [number, number]) => {
    if (value <= thresholds[0]) return styles.statGood;
    if (value <= thresholds[1]) return styles.statWarning;
    return styles.statBad;
  };

  return (
    <div className={styles.wrapper}>

      <div
        ref={containerRef}
        className={`${styles.canvasContainer} ${
          currentMode === 'offscreen' ? styles.modeOffscreen : currentMode === 'main' ? styles.modeMain : styles.modeNone
        }`}
      >
        <div className={styles.label}>
          <span className={styles.modeIndicator}>
            {currentMode === 'offscreen' ? '离屏模式' : currentMode === 'main' ? '主线程模式' : '无渲染'}
          </span>
          <div className={styles.labelButtons}>
            <button className={styles.toggleBtn} onClick={toggleRenderMode}>
              切换到{' '}
              {currentMode === 'none' ? '离屏渲染' : currentMode === 'offscreen' ? '主线程渲染' : '停止渲染'}
            </button>
            <button className={styles.dangerBtn} onClick={addMainThreadWork}>
              🔥 模拟主线程繁重任务
            </button>
          </div>
        </div>
        <canvas ref={canvasRef} className={styles.canvas}></canvas>
        <div className={styles.stats}>
          <h4>性能监控</h4>
          <div className={styles.statRow}>
            <span className={styles.statLabel}>FPS:</span>
            <span className={getStatClass(60 - stats.fps, [5, 30])}>
              {stats.fps}
            </span>
          </div>
          <div className={styles.statRow}>
            <span className={styles.statLabel}>帧时间:</span>
            <span
              className={getStatClass(parseFloat(stats.avgFrameTime), [16.67, 33])}
            >
              {stats.avgFrameTime}ms
            </span>
          </div>
          <div className={styles.statRow}>
            <span className={styles.statLabel}>掉帧数:</span>
            <span className={getStatClass(stats.droppedFrames, [0, 10])}>
              {stats.droppedFrames}
            </span>
          </div>
          <div className={styles.statRow}>
            <span className={styles.statLabel}>最大延迟:</span>
            <span className={styles.statWarning}>{stats.maxDelay}ms</span>
          </div>
          <div className={styles.statRow}>
            <span className={styles.statLabel}>交互延迟:</span>
            <span
              className={getStatClass(
                parseFloat(stats.interactionDelay),
                [50, 100]
              )}
            >
              {stats.interactionDelay}ms
            </span>
          </div>
        </div>
        <div className={styles.interactionHint}>
          🖱️ 拖拽旋转场景 | 滚轮缩放 | 观察交互延迟
        </div>
      </div>
    </div>
  );
};

export default OffscreenDemo;
