import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

const SEGMENT_OPTIONS = [1, 4, 512] as const;

const roundifyBox = (geometry: THREE.BoxGeometry, strength: number) => {
	const positions = geometry.attributes.position;
	for (let i = 0; i < positions.count; i++) {
		const x = positions.getX(i);
		const y = positions.getY(i);
		const z = positions.getZ(i);
		const length = Math.hypot(x, y, z) || 1;
		const offset = strength / length;
		positions.setXYZ(i, x + x * offset, y + y * offset, z + z * offset);
	}
	positions.needsUpdate = true;
	geometry.computeVertexNormals();
};

const buildRoundedBox = (segments: number) => {
	const geometry = new THREE.BoxGeometry(1, 1, 1, segments, segments, segments);
	const strength = Math.min(0.32, 0.08 + segments * 0.01);
	roundifyBox(geometry, 0.32);
	return geometry;
};


const ThreeCubeDemo = () => {
	const containerRef = useRef(null);
	const [rotationDeg, setRotationDeg] = useState(0);
	const [segmentsIndex, setSegmentsIndex] = useState(1);
	const cubeRef = useRef<THREE.Mesh | null>(null);
	const geometryRef = useRef<THREE.BoxGeometry | null>(null);
	const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
	const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
	const sceneRef = useRef<THREE.Scene | null>(null);

	useEffect(() => {
		const container = containerRef.current;
		if (!container) return;

		const scene = new THREE.Scene();
		scene.background = new THREE.Color('#0f172a');

		const camera = new THREE.PerspectiveCamera(
			45,
			container.clientWidth / container.clientHeight,
			0.1,
			100,
		);
		camera.position.set(0, 0, 5);

		const renderer = new THREE.WebGLRenderer({ antialias: true });
		renderer.setSize(container.clientWidth, container.clientHeight);
		renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
		container.appendChild(renderer.domElement);
		Object.assign(renderer.domElement.style, {
			position: 'absolute',
			inset: '0',
			width: '100%',
			height: '100%',
			zIndex: '0',
		});

		const segments = SEGMENT_OPTIONS[segmentsIndex];
		const geometry = buildRoundedBox(segments);
		geometryRef.current = geometry;

		const material = new THREE.MeshStandardMaterial({
			color: '#93c5fd',
			roughness: 0.3,
			metalness: 0.35,
		});

		const cube = new THREE.Mesh(geometry, material);
		scene.add(cube);
		cubeRef.current = cube;
		sceneRef.current = scene;
		cameraRef.current = camera;
		rendererRef.current = renderer;

		const ambientLight = new THREE.AmbientLight(0xffffff, 0.18);
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1.6);
        directionalLight.position.set(10, 0, 0);
		scene.add(ambientLight, directionalLight);

		const renderScene = () => {
			renderer.render(scene, camera);
		};

		const handleResize = () => {
			if (!container) return;
			const { clientWidth, clientHeight } = container;
			renderer.setSize(clientWidth, clientHeight);
			camera.aspect = clientWidth / clientHeight;
			camera.updateProjectionMatrix();
			renderScene();
		};

		renderScene();
		window.addEventListener('resize', handleResize);

		return () => {
			window.removeEventListener('resize', handleResize);
			geometryRef.current?.dispose();
			material.dispose();
			renderer.dispose();
			if (container.contains(renderer.domElement)) {
				container.removeChild(renderer.domElement);
			}
			cubeRef.current = null;
			rendererRef.current = null;
			cameraRef.current = null;
			sceneRef.current = null;
		};
	}, []);

	useEffect(() => {
		const cube = cubeRef.current;
		const renderer = rendererRef.current;
		const camera = cameraRef.current;
		const scene = sceneRef.current;
		if (!cube || !renderer || !camera || !scene) return;

		const rotation = THREE.MathUtils.degToRad(rotationDeg);
		cube.rotation.y = rotation;
		renderer.render(scene, camera);
	}, [rotationDeg]);

	useEffect(() => {
		const cube = cubeRef.current;
		const renderer = rendererRef.current;
		const camera = cameraRef.current;
		const scene = sceneRef.current;
		if (!cube || !renderer || !camera || !scene) return;

		const segments = SEGMENT_OPTIONS[segmentsIndex];
		const newGeometry = buildRoundedBox(segments);
		const oldGeometry = cube.geometry as THREE.BoxGeometry;
		cube.geometry = newGeometry;
		geometryRef.current = newGeometry;
		oldGeometry.dispose();
		renderer.render(scene, camera);
	}, [segmentsIndex]);

	return (
		<div
			ref={containerRef}
			style={{
				position: 'relative',
				width: '100%',
				aspectRatio: '16 / 9',
				minHeight: '320px',
				borderRadius: '16px',
				overflow: 'hidden',
				boxShadow: '0 20px 45px rgba(15, 23, 42, 0.25)',
			}}
		>
			<div
				style={{
					position: 'absolute',
					top: '16px',
					left: '16px',
					right: '16px',
					display: 'flex',
					gap: '12px',
					alignItems: 'center',
					zIndex: 1,
				}}
			>
				<input
					type="range"
					min={-180}
					max={180}
					value={rotationDeg}
					onChange={(event) => setRotationDeg(Number(event.target.value))}
					style={{ flex: 1 }}
				/>
				<button
					type="button"
					onClick={() => setSegmentsIndex((index) => (index + 1) % SEGMENT_OPTIONS.length)}
				>
					切换分段 ({SEGMENT_OPTIONS[segmentsIndex]}×{SEGMENT_OPTIONS[segmentsIndex]})
				</button>
			</div>
		</div>
	);
};
export default ThreeCubeDemo;