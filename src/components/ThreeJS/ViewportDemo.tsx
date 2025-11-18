import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

export default function ViewportDemo() {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const viewConfigRef = useRef({
    width: 140,
    height: 80,
    X: 0,
    Y: 0,
    cubeWidth: 1,
    cubeHeight: 1,
  });

  const [width, setWidth] = useState(140);
  const [height, setHeight] = useState(80);
  const [cubeWidth, setCubeWidth] = useState(1);
  const [cubeHeight, setCubeHeight] = useState(1);
  const [X, setX] = useState(0);
  const [Y, setY] = useState(0);

  useEffect(() => {
    viewConfigRef.current.width = width
    viewConfigRef.current.height = height
    viewConfigRef.current.X = X
    viewConfigRef.current.Y = Y
    viewConfigRef.current.cubeWidth = cubeWidth
    viewConfigRef.current.cubeHeight = cubeHeight
  }, [width, height, X, Y, cubeWidth, cubeHeight]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const renderer = new THREE.WebGLRenderer();
    renderer.setSize(container.clientWidth, container.clientHeight);
    setWidth(container.clientWidth / 5);
    setHeight(container.clientHeight / 5);
    
    Object.assign(renderer.domElement.style, {
      position: "absolute",
      inset: "0",
      width: "100%",
      height: "100%",
    });
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("rgba(0,0,0,0.1)");

    const camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      0.1,
      100
    );
    camera.position.set(0, 0, 6);
    const cube = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial({ color: "#ff7f50" }))
    scene.add(cube);

    const light = new THREE.DirectionalLight("#ffffff", 1.5);
    light.position.set(2, 3, 4);
    scene.add(light);

    let animationId: number;

    const renderLoop = () => {
      animationId = requestAnimationFrame(renderLoop);

      const { width, height, X, Y, cubeHeight, cubeWidth } = viewConfigRef.current;
      cube.scale.set(cubeWidth, cubeHeight, 1);
      renderer.setViewport(X, Y, width, height);
      renderer.render(scene, camera);
    };

    renderLoop();

    const resize = () => {
      const { clientWidth, clientHeight } = container;
      renderer.setSize(clientWidth, clientHeight);
      camera.aspect = clientWidth / clientHeight;
      camera.updateProjectionMatrix();
    };

    const observer = new ResizeObserver(resize);
    observer.observe(container);

    return () => {
      cancelAnimationFrame(animationId);
      observer.disconnect();
      renderer.setScissorTest(false);
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        width: "100%",
        aspectRatio: "16 / 9",
        minHeight: "320px",
        borderRadius: "16px",
        overflow: "hidden",
        margin: "24px 0",
        backgroundColor: "#111827",
        boxShadow: "0 20px 45px rgba(15, 23, 42, 0.25)",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: "16px",
          left: "16px",
          right: "16px",
          display: "grid",
          gridTemplateColumns: "repeat(2, 1fr)",
          gridTemplateRows: "repeat(2, auto)",
          padding: "12px",
          borderRadius: "12px",
          background: "rgba(132, 84, 84, 0.65)",
          color: "#e2e8f0",
          fontSize: "14px",
          zIndex: 1,
        }}
      >
        <label style={{display: 'flex', alignItems: 'center'}}>
          <span style={{width: 120, display: 'inline-block'}}>视口宽度：{width}</span>
          <input
            type="range"
            min={0}
            max={1000}
            value={width}
            onChange={(event) => setWidth(Number(event.target.value))}
          />
        </label>
        <label style={{display: 'flex', alignItems: 'center'}}>
          <span style={{width: 120, display: 'inline-block'}}>视口高度：{height}</span>
          <input
            type="range"
            min={0}
            max={1000}
            value={height}
            onChange={(event) => setHeight(Number(event.target.value))}
          />
        </label>
        <label style={{display: 'flex', alignItems: 'center'}}>
          <span style={{width: 120, display: 'inline-block'}}>水平坐标：{X}</span>
          <input
            type="range"
            min={0}
            max={1000}
            value={X}
            onChange={(event) => setX(Number(event.target.value))}
          />
        </label>
        <label style={{display: 'flex', alignItems: 'center'}}>
          <span style={{width: 120, display: 'inline-block'}}>垂直坐标：{Y}</span>
          <input
            type="range"
            min={0}
            max={1000}
            value={Y}
            onChange={(event) => setY(Number(event.target.value))}
          />
        </label>
        <label style={{display: 'flex', alignItems: 'center'}}>
          <span style={{width: 120, display: 'inline-block'}}>立方体宽度：{cubeWidth}</span>
          <input
            type="range"
            min={1}
            max={100}
            value={cubeWidth}
            onChange={(event) => setCubeWidth(Number(event.target.value))}
          />
        </label>
        <label style={{display: 'flex', alignItems: 'center'}}>
          <span style={{width: 120, display: 'inline-block'}}>立方体高度：{cubeHeight}</span>
          <input
            type="range"
            min={1}
            max={100}
            value={cubeHeight}
            onChange={(event) => setCubeHeight(Number(event.target.value))}
          />
        </label>
      </div>
    </div>
  );
}