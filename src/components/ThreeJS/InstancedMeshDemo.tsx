import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
type RenderMode = 'none' | 'regular' | 'instanced';

const InstancedMeshDemo: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [renderMode, setRenderMode] = useState<RenderMode>('none');
  const [fps, setFps] = useState(0);
  const [cubeCount] = useState(10000);

  useEffect(() => {
    if (!containerRef.current) return;

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x222222);

    const camera = new THREE.PerspectiveCamera(
      75,
      containerRef.current.clientWidth / containerRef.current.clientHeight,
      0.1,
      1000
    );
    camera.position.set(15, 15, 15);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    containerRef.current.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 10, 10);
    scene.add(directionalLight);

    // Geometry and Material
    const geometry = new THREE.BoxGeometry(0.5, 0.5, 0.5);
    const material = new THREE.MeshPhongMaterial({ color: 0x44aa88 });

    let meshes: THREE.Mesh[] = [];
    let instancedMesh: THREE.InstancedMesh | null = null;
    const dummy = new THREE.Object3D();

    // Generate random positions
    const positions: THREE.Vector3[] = [];
    for (let i = 0; i < cubeCount; i++) {
      positions.push(
        new THREE.Vector3(
          (Math.random() - 0.5) * 30,
          (Math.random() - 0.5) * 30,
          (Math.random() - 0.5) * 30
        )
      );
    }

    const setupRegularMeshes = () => {
      meshes.forEach(mesh => scene.remove(mesh));
      meshes = [];
      
      positions.forEach(position => {
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.copy(position);
        scene.add(mesh);
        meshes.push(mesh);
      });
    };

    const setupInstancedMesh = () => {
      if (instancedMesh) scene.remove(instancedMesh);
      
      instancedMesh = new THREE.InstancedMesh(geometry, material, cubeCount);
      positions.forEach((position, i) => {
        dummy.position.copy(position);
        dummy.updateMatrix();
        instancedMesh!.setMatrixAt(i, dummy.matrix);
      });
      instancedMesh.instanceMatrix.needsUpdate = true;
      scene.add(instancedMesh);
    };

    const clearScene = () => {
      meshes.forEach(mesh => scene.remove(mesh));
      meshes = [];
      if (instancedMesh) {
        scene.remove(instancedMesh);
        instancedMesh = null;
      }
    };

    // FPS tracking
    let frameCount = 0;
    let lastTime = performance.now();

    const animate = () => {
      requestAnimationFrame(animate);

      // Update FPS
      frameCount++;
      const currentTime = performance.now();
      if (currentTime - lastTime >= 1000) {
        setFps(frameCount);
        frameCount = 0;
        lastTime = currentTime;
      }

      // Rotate cubes
      const time = Date.now() * 0.001;
      if (renderMode === 'regular') {
        meshes.forEach((mesh, i) => {
          mesh.rotation.x = time + i * 0.1;
          mesh.rotation.y = time * 0.5 + i * 0.1;
        });
      } else if (renderMode === 'instanced' && instancedMesh) {
        positions.forEach((position, i) => {
          dummy.position.copy(position);
          dummy.rotation.x = time + i * 0.1;
          dummy.rotation.y = time * 0.5 + i * 0.1;
          dummy.updateMatrix();
          instancedMesh!.setMatrixAt(i, dummy.matrix);
        });
        instancedMesh.instanceMatrix.needsUpdate = true;
      }

      controls.update();
      renderer.render(scene, camera);
    };

    // Handle mode changes
    clearScene();
    if (renderMode === 'regular') {
      setupRegularMeshes();
    } else if (renderMode === 'instanced') {
      setupInstancedMesh();
    }

    animate();

    // Cleanup
    return () => {
      clearScene();
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      containerRef.current?.removeChild(renderer.domElement);
    };
  }, [renderMode, cubeCount]);

  return (
    <div style={{ margin: '20px 0' }}>
      <div style={{ marginBottom: '10px' }}>
        <button
          onClick={() => setRenderMode('none')}
          style={{
            padding: '8px 16px',
            marginRight: '10px',
            backgroundColor: renderMode === 'none' ? '#4CAF50' : '#ddd',
            border: 'none',
            cursor: 'pointer',
            borderRadius: '4px'
          }}
        >
          不渲染 (No Rendering)
        </button>
        <button
          onClick={() => setRenderMode('regular')}
          style={{
            padding: '8px 16px',
            marginRight: '10px',
            backgroundColor: renderMode === 'regular' ? '#4CAF50' : '#ddd',
            border: 'none',
            cursor: 'pointer',
            borderRadius: '4px'
          }}
        >
          普通Mesh ({cubeCount}个)
        </button>
        <button
          onClick={() => setRenderMode('instanced')}
          style={{
            padding: '8px 16px',
            backgroundColor: renderMode === 'instanced' ? '#4CAF50' : '#ddd',
            border: 'none',
            cursor: 'pointer',
            borderRadius: '4px'
          }}
        >
          InstancedMesh ({cubeCount}个)
        </button>
        <span style={{ marginLeft: '20px', fontWeight: 'bold' }}>
          FPS: {fps}
        </span>
      </div>
      <div
        ref={containerRef}
        style={{
          width: '100%',
          height: '500px',
          border: '1px solid #ccc',
          borderRadius: '4px'
        }}
      />
    </div>
  );
};

export default InstancedMeshDemo;
