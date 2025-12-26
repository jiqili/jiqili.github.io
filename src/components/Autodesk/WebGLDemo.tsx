import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

type RendererType = 'webgl' | 'none';

const WebGLDemo: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [fps, setFps] = useState<number>(0);
  const [loadTime, setLoadTime] = useState<number>(0);
  const [rendererType, setRendererType] = useState<RendererType>('none');
  const rendererRef = useRef<any>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const animationIdRef = useRef<number | null>(null);
  const rendererTypeRef = useRef<RendererType>('none');
  const meshesGroupRef = useRef<THREE.Object3D | null>(null);
  const lastRendererTypeRef = useRef<RendererType>('none');
  
  // 场景规模参数
  const GRID_SIZE = 25;
  const SPACING = 1.2;

  // 固定随机种子函数，确保颜色一致
  const seededRandom = (seed: number): number => {
    const x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
  };

  // 构建独立 Mesh 的 Group（用于 WebGL 模式）
  const buildMeshesGroup = (gridSize = GRID_SIZE, spacing = SPACING) => {
    const geometry = new THREE.BoxGeometry(0.5, 0.5, 0.5);
    const group = new THREE.Group();
    const color = new THREE.Color();

    for (let x = 0; x < gridSize; x++) {
      for (let y = 0; y < gridSize; y++) {
        for (let z = 0; z < gridSize; z++) {
          const seed = x * 1000 + y * 100 + z;
          color.setHSL(seededRandom(seed), 0.7, 0.5);
          const material = new THREE.MeshBasicMaterial({ color: color.clone() });
          const mesh = new THREE.Mesh(geometry, material);
          mesh.position.set(
            (x - gridSize / 2) * spacing,
            (y - gridSize / 2) * spacing,
            (z - gridSize / 2) * spacing
          );
          group.add(mesh);
        }
      }
    }
    return group;
  };

  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;

    let isMounted = true;
    const container = containerRef.current;

    const initScene = async () => {
      const startTime = performance.now();
      
      // 初始化 Three.js 场景（用于 WebGL 和 相机计算）
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x222222);
      sceneRef.current = scene;
      
      const camera = new THREE.PerspectiveCamera(
        75,
        container.clientWidth / container.clientHeight,
        0.1,
        1000
      );
      camera.position.set(60, 60, 60);
      cameraRef.current = camera;
      
      // WebGL 需要灯光
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
      scene.add(ambientLight);
      const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
      directionalLight.position.set(10, 10, 10);
      scene.add(directionalLight);

      const endTime = performance.now();
      if (isMounted) {
        setLoadTime(endTime - startTime);
      }

      let frameCount = 0;
      let lastTime = performance.now();

      const animate = () => {
        if (!isMounted) return;
        animationIdRef.current = requestAnimationFrame(animate);

        // 清理逻辑
        if (lastRendererTypeRef.current !== 'none' && rendererTypeRef.current === 'none') {
          if (rendererRef.current && rendererRef.current.clear) {
            rendererRef.current.clear();
          }
        }
        lastRendererTypeRef.current = rendererTypeRef.current;

        if (rendererTypeRef.current !== 'none' && rendererRef.current) {
          // 更新控制器（无论是 WebGL 还是 WebGPU，都使用 OrbitControls 计算相机矩阵）
          if (controlsRef.current) {
            controlsRef.current.update();
          }

          // 旋转动画
          if (meshesGroupRef.current) {
            meshesGroupRef.current.rotation.y += 0.001;
          }

          // 渲染
          if (rendererTypeRef.current === 'webgl') {
             if (sceneRef.current && cameraRef.current) {
               rendererRef.current.render(sceneRef.current, cameraRef.current);
             }
          }

          // FPS 计算
          frameCount++;
          const currentTime = performance.now();
          if (currentTime >= lastTime + 1000) {
            if (isMounted) {
              setFps(Math.round((frameCount * 1000) / (currentTime - lastTime)));
            }
            frameCount = 0;
            lastTime = currentTime;
          }
        } else {
          if (fps !== 0 && isMounted) {
            setFps(0);
          }
        }
      };

      animate();

      const handleResize = () => {
        if (cameraRef.current && rendererRef.current && containerRef.current) {
          const container = containerRef.current;
          cameraRef.current.aspect = container.clientWidth / container.clientHeight;
          cameraRef.current.updateProjectionMatrix();
          rendererRef.current.setSize(container.clientWidth, container.clientHeight);
        }
      };

      window.addEventListener('resize', handleResize);
      return () => {
        isMounted = false;
        window.removeEventListener('resize', handleResize);
        if (animationIdRef.current) {
          cancelAnimationFrame(animationIdRef.current);
        }
        if (controlsRef.current) {
          controlsRef.current.dispose();
        }
        if (rendererRef.current && rendererRef.current.dispose) {
          rendererRef.current.dispose();
        }
        // 清理 Three.js 资源
        if (meshesGroupRef.current) {
          const mesh = meshesGroupRef.current;
          scene.remove(mesh);
          mesh.traverse((child: any) => {
            if (child.isMesh) {
              if (Array.isArray(child.material)) {
                child.material.forEach((m: any) => m.dispose());
              } else if (child.material) {
                child.material.dispose();
              }
              if (child.geometry) child.geometry.dispose();
            }
          });
          meshesGroupRef.current = null;
        }
      };
    };

    initScene();
  }, []);

  useEffect(() => {
    const switchRenderer = async () => {
      if (!canvasRef.current || !containerRef.current) return;

      const container = containerRef.current;
      const switchStartTime = performance.now();

      // 清理旧资源
      const cleanup = () => {
        if (meshesGroupRef.current && sceneRef.current) {
          const mesh = meshesGroupRef.current;
          sceneRef.current.remove(mesh);
          mesh.traverse((child: any) => {
            if (child.isMesh) {
              if (Array.isArray(child.material)) {
                child.material.forEach((m: any) => m.dispose());
              } else if (child.material) {
                child.material.dispose();
              }
              if (child.geometry) child.geometry.dispose();
            }
          });
          meshesGroupRef.current = null;
        }

        if (rendererRef.current && rendererRef.current.dispose) {
          rendererRef.current.dispose();
          rendererRef.current = null;
        }
        if (controlsRef.current) {
          controlsRef.current.dispose();
          controlsRef.current = null;
        }
      };

      cleanup();

      if (rendererType === 'webgl') {
        // --- WebGL (Three.js) 实现 ---
        const renderer = new THREE.WebGLRenderer({
          canvas: canvasRef.current,
          antialias: true,
        });
        renderer.setSize(container.clientWidth, container.clientHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
        rendererRef.current = renderer;
        
        const controls = new OrbitControls(cameraRef.current!, renderer.domElement);
        controls.enableDamping = true;
        controlsRef.current = controls;
        
        requestAnimationFrame(() => {
          if (!sceneRef.current) return;
          const group = buildMeshesGroup(GRID_SIZE, SPACING);
          sceneRef.current.add(group);
          meshesGroupRef.current = group;
        });

        setLoadTime(performance.now() - switchStartTime);

      } else {
        setLoadTime(0);
      }

      rendererTypeRef.current = rendererType;
    };

    switchRenderer();
  }, [rendererType]);

  const handleRendererChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setRendererType(e.target.value as RendererType);
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', height: '600px', border: '1px solid #444'}}>
      <canvas key={rendererType} ref={canvasRef} />
      
      {/* 悬浮UI */}
      <div style={{
        position: 'absolute',
        top: '20px',
        left: '20px',
        background: 'rgba(0, 0, 0, 0.7)',
        color: 'white',
        padding: '15px 20px',
        borderRadius: '8px',
        fontFamily: 'monospace',
        fontSize: '14px',
      }}>
        <div style={{ marginBottom: '10px' }}>
          <label style={{ display: 'block', marginBottom: '5px' }}>
            渲染模式:
          </label>
          <select
            value={rendererType}
            onChange={handleRendererChange}
            style={{
              width: '100%',
              padding: '5px 10px',
              borderRadius: '4px',
              border: 'none',
              background: '#333',
              color: 'white',
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            <option value="none">不渲染</option>
            <option value="webgl">WebGL (Three.js)</option>
          </select>
        </div>
        
        <div style={{ marginTop: '15px', lineHeight: '1.8' }}>
          <div><strong>当前渲染器:</strong> {
            rendererType === 'webgl' ? 'WebGL (Three.js)' : 
            '无'
          }</div>
          <div><strong>FPS:</strong> {fps}</div>
          <div><strong>初始化时间:</strong> {loadTime.toFixed(2)} ms</div>
          <div><strong>立方体数量:</strong> {(GRID_SIZE * GRID_SIZE * GRID_SIZE).toLocaleString()}</div>
          <div><strong>实现方式:</strong> {
             rendererType === 'webgl' ? '独立 Mesh (Draw Call 瓶颈)' : '-'
          }</div>
        </div>
      </div>
    </div>
  );
};

export default WebGLDemo;
