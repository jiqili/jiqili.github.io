import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

const MatrixRainShader = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // 获取容器尺寸
    const width = containerRef.current.clientWidth;
    const height = 200;

    // 场景、相机、渲染器
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 自定义着色器材质
    const material = new THREE.ShaderMaterial({
      uniforms: {
        iTime: { value: 0 },
        iResolution: { value: new THREE.Vector3(width, height, 1) }
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 iResolution;
        uniform float iTime;

        #define TIMESCALE 0.25
        #define TILES 8.0
        #define COLOR 0.7, 1.6, 2.8

        varying vec2 vUv;

        // 伪随机生成器
        float pseudoRandom(vec2 gridPos) {
          float h = dot(gridPos, vec2(127.1, 311.7));
          return fract(sin(h) * 43758.5453);
        }

        void mainImage(out vec4 fragColor, in vec2 fragCoord) {
          vec2 uv = fragCoord.xy / iResolution.xy;
          uv.x *= iResolution.x / iResolution.y;
          
          // 计算方块索引
          vec2 gridIndex = floor(uv * TILES);
          
          // 用哈希替代纹理采样
          float randomValue = pseudoRandom(gridIndex);
          
          // 下落动画
          float p = 1.0 - mod(randomValue + iTime * TIMESCALE, 1.0);
          p = min(max(p * 3.0 - 1.8, 0.1), 2.0);
          
          // 圆形渐变
          vec2 r = mod(uv * TILES, 1.0);
          r = vec2(pow(r.x - 0.5, 2.0), pow(r.y - 0.5, 2.0));
          p *= 1.0 - pow(min(1.0, 12.0 * dot(r, r)), 2.0);

          fragColor = vec4(COLOR, 1.0) * p;
        }

        void main() {
          mainImage(gl_FragColor, gl_FragCoord.xy);
        }
      `
    });

    // 创建全屏平面
    const geometry = new THREE.PlaneGeometry(2, 2);
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    // 动画循环
    const clock = new THREE.Clock();
    const animate = () => {
      requestAnimationFrame(animate);
      material.uniforms.iTime.value = clock.getElapsedTime();
      renderer.render(scene, camera);
    };
    animate();

    // 响应式调整
    const handleResize = () => {
      if (!containerRef.current) return;
      const newWidth = containerRef.current.clientWidth;
      renderer.setSize(newWidth, height);
      material.uniforms.iResolution.value.set(newWidth, height, 1);
    };
    
    window.addEventListener('resize', handleResize);

    // 清理函数
    return () => {
      window.removeEventListener('resize', handleResize);
      if (containerRef.current && rendererRef.current) {
        containerRef.current.removeChild(rendererRef.current.domElement);
      }
      geometry.dispose();
      material.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <div 
      ref={containerRef} 
      style={{ 
        width: '100%',
        border: '2px solid #0f3',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0, 255, 51, 0.2), 0 0 20px rgba(0, 255, 51, 0.1)',
        overflow: 'hidden'
      }} 
    />
  );
};

export default MatrixRainShader;
