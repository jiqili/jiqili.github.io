import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

type RenderMode = 'solid' | 'wire' | 'none';

export default function ReduceFragmentDemo() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<RenderMode>('none');
  const [fps, setFps] = useState(0);
  const sceneRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    controls: OrbitControls;
    solidGroup: THREE.Group;
    wireGroup: THREE.Group;
    frameCount: number;
    lastTime: number;
  } | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a1a);

    const camera = new THREE.PerspectiveCamera(
      75,
      containerRef.current.clientWidth / containerRef.current.clientHeight,
      0.1,
      1000
    );
    camera.position.set(50, 50, 50);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    containerRef.current.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight.position.set(10, 10, 5);
    scene.add(directionalLight);

    const solidGroup = new THREE.Group();
    const wireGroup = new THREE.Group();
    scene.add(solidGroup);
    scene.add(wireGroup);

    const cubeCount = 10000;
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshPhongMaterial({ color: 0x00ff00 });
    const edgesGeometry = new THREE.EdgesGeometry(geometry);
    const lineMaterial = new THREE.LineBasicMaterial({ color: 0x00ff00 });

    for (let i = 0; i < cubeCount; i++) {
      const x = (Math.random() - 0.5) * 200;
      const y = (Math.random() - 0.5) * 200;
      const z = (Math.random() - 0.5) * 200;

      const solidMesh = new THREE.Mesh(geometry, material);
      solidMesh.position.set(x, y, z);
      solidGroup.add(solidMesh);

      const wireframe = new THREE.LineSegments(edgesGeometry, lineMaterial);
      wireframe.position.set(x, y, z);
      wireGroup.add(wireframe);
    }

    wireGroup.visible = false;
    solidGroup.visible = false;

    sceneRef.current = {
      scene,
      camera,
      renderer,
      controls,
      solidGroup,
      wireGroup,
      frameCount: 0,
      lastTime: performance.now(),
    };

    let animationId: number;
    const animate = () => {
      animationId = requestAnimationFrame(animate);

      if (sceneRef.current) {
        const { controls, renderer, scene, camera, wireGroup, solidGroup } = sceneRef.current;
        
        // 检查是否有可见的对象需要渲染
        const shouldRender = wireGroup.visible || solidGroup.visible;
        
        if (shouldRender) {
          controls.update();
          renderer.render(scene, camera);

          sceneRef.current.frameCount++;
          const currentTime = performance.now();
          if (currentTime - sceneRef.current.lastTime >= 1000) {
            setFps(sceneRef.current.frameCount);
            sceneRef.current.frameCount = 0;
            sceneRef.current.lastTime = currentTime;
          }
        }
      }
    };

    animate();

    const handleResize = () => {
      if (!containerRef.current || !sceneRef.current) return;
      const { camera, renderer } = sceneRef.current;
      camera.aspect = containerRef.current.clientWidth / containerRef.current.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationId);
      if (sceneRef.current) {
        sceneRef.current.renderer.dispose();
        geometry.dispose();
        material.dispose();
        edgesGeometry.dispose();
        lineMaterial.dispose();
        containerRef.current?.removeChild(sceneRef.current.renderer.domElement);
      }
    };
  }, []);

  useEffect(() => {
    if (sceneRef.current) {
      const { wireGroup, solidGroup, renderer } = sceneRef.current;
      
      if (mode === 'wire') {
        // 切换到线框模式：清除实心立方体，显示线框
        solidGroup.clear();
        wireGroup.visible = true;
      } else if (mode === 'solid') {
        // 切换到实心模式：重新创建实心立方体（如果被清除了），显示实心，隐藏线框
        if (solidGroup.children.length === 0) {
          const geometry = new THREE.BoxGeometry(1, 1, 1);
          const material = new THREE.MeshPhongMaterial({ color: 0x00ff00 });
          
          wireGroup.children.forEach((wireframe) => {
            const solidMesh = new THREE.Mesh(geometry, material);
            solidMesh.position.copy(wireframe.position);
            solidGroup.add(solidMesh);
          });
        }
        solidGroup.visible = true;
        wireGroup.visible = false;
      } else {
        // 不渲染模式：隐藏所有内容并清除画布
        solidGroup.visible = false;
        wireGroup.visible = false;
        renderer.clear();
        setFps(0);
      }
    }
  }, [mode]);

  return (
    <div style={{ width: '100%', marginBottom: '20px' }}>
      <div style={{ marginBottom: '10px', display: 'flex', gap: '10px', alignItems: 'center' }}>
        <button
          onClick={() => setMode('solid')}
          style={{
            padding: '8px 16px',
            backgroundColor: mode === 'solid' ? '#4CAF50' : '#888',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          实心立方体
        </button>
        <button
          onClick={() => setMode('wire')}
          style={{
            padding: '8px 16px',
            backgroundColor: mode === 'wire' ? '#4CAF50' : '#888',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          线框立方体
        </button>
        <button
          onClick={() => setMode('none')}
          style={{
            padding: '8px 16px',
            backgroundColor: mode === 'none' ? '#4CAF50' : '#888',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          不渲染
        </button>
        <div style={{ marginLeft: '20px', fontSize: '16px', fontWeight: 'bold' }}>
          FPS: {fps}
        </div>
      </div>
      <div ref={containerRef} style={{ width: '100%', height: '500px', border: '1px solid #ccc' }} />
      <p style={{ marginTop: '10px', fontSize: '14px', color: '#666' }}>
        共 10,000 个立方体。线框模式只渲染边缘，大幅减少片元填充，性能更高。
      </p>
    </div>
  );
}
