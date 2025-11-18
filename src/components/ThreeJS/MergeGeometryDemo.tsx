import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';

const BOX_COUNT = 100000;
type RenderMode = 'manualMerge' | 'utilsMerge' | 'individual' | 'none';
const MODE_DESCRIPTIONS: Record<RenderMode, string> = {
	manualMerge: '单 Mesh 绘制 100000 个包围盒',
	utilsMerge: 'mergeGeometries 合并绘制',
	individual: '100000 个独立对象绘制',
	none: '不渲染立方体'
};

const MergeGeometryDemo: React.FC = () => {
	const mountRef = useRef<HTMLDivElement | null>(null);
	const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
	const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
	const controlsRef = useRef<OrbitControls | null>(null);
	const boxesGroupRef = useRef<THREE.Group | null>(null);
	const baseEdgesRef = useRef<THREE.EdgesGeometry | null>(null);
	const individualMaterialRef = useRef<THREE.LineBasicMaterial | null>(null);
	const mergedMaterialRef = useRef<THREE.LineBasicMaterial | null>(null);
	const mergedLineRef = useRef<THREE.LineSegments | null>(null);
	const centersRef = useRef<Float32Array | null>(null);
	const sizesRef = useRef<Float32Array | null>(null);
	const requestRef = useRef<number>(0);
	const [renderMode, setRenderMode] = useState<RenderMode>('none');
	const [stats, setStats] = useState<{ fps: number; memory?: string }>({ fps: 0 });
	const statsTrackerRef = useRef<{ frameCount: number; lastFpsUpdate: number }>({ frameCount: 0, lastFpsUpdate: 0 });

	const rebuildBoxes = useCallback((mode: RenderMode) => {
		const group = boxesGroupRef.current;
		const centers = centersRef.current;
		const sizes = sizesRef.current;
		const baseEdges = baseEdgesRef.current;
		const mergedMaterial = mergedMaterialRef.current;
		const individualMaterial = individualMaterialRef.current;

		if (!group) return;

		group.clear();

		if (mergedLineRef.current) {
			mergedLineRef.current.geometry.dispose();
			mergedLineRef.current = null;
		}

		if (mode === 'none') return;
		if (!centers || !sizes || !baseEdges || !mergedMaterial || !individualMaterial) return;

		if (mode === 'manualMerge') {
			const basePositions = baseEdges.attributes.position.array as Float32Array;
			const baseLength = basePositions.length;
			const mergedPositions = new Float32Array(baseLength * BOX_COUNT);

			for (let i = 0; i < BOX_COUNT; i++) {
				const offset = i * baseLength;
				const centerOffset = i * 3;
				const sx = sizes[centerOffset];
				const sy = sizes[centerOffset + 1];
				const sz = sizes[centerOffset + 2];
				const cx = centers[centerOffset];
				const cy = centers[centerOffset + 1];
				const cz = centers[centerOffset + 2];

				for (let j = 0; j < baseLength; j += 3) {
					const x = basePositions[j];
					const y = basePositions[j + 1];
					const z = basePositions[j + 2];
					mergedPositions[offset + j] = x * sx + cx;
					mergedPositions[offset + j + 1] = y * sy + cy;
					mergedPositions[offset + j + 2] = z * sz + cz;
				}
			}

			const mergedGeometry = new THREE.BufferGeometry();
			mergedGeometry.setAttribute('position', new THREE.BufferAttribute(mergedPositions, 3));
			mergedGeometry.computeBoundingSphere();

			const mergedLines = new THREE.LineSegments(mergedGeometry, mergedMaterial);
			mergedLines.frustumCulled = false;
			group.add(mergedLines);
			mergedLineRef.current = mergedLines;
		} else if (mode === 'utilsMerge') {
			const geometries: THREE.BufferGeometry[] = [];
			for (let i = 0; i < BOX_COUNT; i++) {
				const centerOffset = i * 3;
				const geometry = baseEdges.clone();
				geometry.scale(sizes[centerOffset], sizes[centerOffset + 1], sizes[centerOffset + 2]);
				geometry.translate(centers[centerOffset], centers[centerOffset + 1], centers[centerOffset + 2]);
				geometries.push(geometry);
			}
			const mergedGeometry = BufferGeometryUtils.mergeGeometries(geometries, false);
			geometries.forEach((geometry) => geometry.dispose());
			geometries.length = 0;
			if (!mergedGeometry) return;
			mergedGeometry.computeBoundingSphere();
			const mergedLines = new THREE.LineSegments(mergedGeometry, mergedMaterial);
			mergedLines.frustumCulled = false;
			group.add(mergedLines);
			mergedLineRef.current = mergedLines;
		} else {
			for (let i = 0; i < BOX_COUNT; i++) {
				const centerOffset = i * 3;
				const line = new THREE.LineSegments(baseEdges, individualMaterial);
				line.position.set(centers[centerOffset], centers[centerOffset + 1], centers[centerOffset + 2]);
				line.scale.set(sizes[centerOffset], sizes[centerOffset + 1], sizes[centerOffset + 2]);
				line.matrixAutoUpdate = false;
				line.updateMatrix();
				line.frustumCulled = false;
				group.add(line);
			}
		}
	}, []);

	const formatBytes = useCallback((bytes: number) => `${(bytes / 1048576).toFixed(1)} MB`, []);

	useEffect(() => {
		const container = mountRef.current;
		if (!container) return;

		const renderer = new THREE.WebGLRenderer({ antialias: true });
		renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
		renderer.setSize(container.clientWidth || 800, container.clientHeight || 480, false);
		renderer.setClearColor(0x050608, 1);
		renderer.domElement.style.width = '100%';
		renderer.domElement.style.height = '100%';
		container.appendChild(renderer.domElement);
		rendererRef.current = renderer;

		const scene = new THREE.Scene();
		scene.background = new THREE.Color(0x050608);

		const camera = new THREE.PerspectiveCamera(60, (container.clientWidth || 800) / (container.clientHeight || 480), 0.1, 2000);
		camera.position.set(0, 0, 320);
		cameraRef.current = camera;

		const controls = new OrbitControls(camera, renderer.domElement);
		controls.enableDamping = true;
		controls.dampingFactor = 0.08;
		controlsRef.current = controls;

		scene.add(new THREE.AmbientLight(0xffffff, 0.6));
		const keyLight = new THREE.DirectionalLight(0xffffff, 0.8);
		keyLight.position.set(120, 160, 90);
		scene.add(keyLight);

		const group = new THREE.Group();
		scene.add(group);
		boxesGroupRef.current = group;

		const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
		const edgesGeometry = new THREE.EdgesGeometry(boxGeometry);
		boxGeometry.dispose();
		baseEdgesRef.current = edgesGeometry;

		individualMaterialRef.current = new THREE.LineBasicMaterial({ color: 0x29b6f6, transparent: true, opacity: 0.7 });
		mergedMaterialRef.current = new THREE.LineBasicMaterial({ color: 0xffc400 });

		const centers = new Float32Array(BOX_COUNT * 3);
		const sizes = new Float32Array(BOX_COUNT * 3);
		for (let i = 0; i < BOX_COUNT; i++) {
			const offset = i * 3;
			centers[offset] = (Math.random() - 0.5) * 600;
			centers[offset + 1] = (Math.random() - 0.5) * 400;
			centers[offset + 2] = (Math.random() - 0.5) * 600;
			sizes[offset] = Math.random() * 6 + 0.5;
			sizes[offset + 1] = Math.random() * 6 + 0.5;
			sizes[offset + 2] = Math.random() * 6 + 0.5;
		}
		centersRef.current = centers;
		sizesRef.current = sizes;

		rebuildBoxes(renderMode);

		const handleResize = () => {
			if (!mountRef.current || !rendererRef.current || !cameraRef.current) return;
			const { clientWidth, clientHeight } = mountRef.current;
			if (clientWidth === 0 || clientHeight === 0) return;
			rendererRef.current.setSize(clientWidth, clientHeight, false);
			cameraRef.current.aspect = clientWidth / clientHeight;
			cameraRef.current.updateProjectionMatrix();
		};
		window.addEventListener('resize', handleResize);

		statsTrackerRef.current = { frameCount: 0, lastFpsUpdate: performance.now() };
		const updateStats = (time: number) => {
			const tracker = statsTrackerRef.current;
			if (!tracker) return;
			if (!tracker.lastFpsUpdate) tracker.lastFpsUpdate = time;
			tracker.frameCount += 1;
			const elapsed = time - tracker.lastFpsUpdate;
			if (elapsed >= 500) {
				const fps = (tracker.frameCount * 1000) / elapsed;
				let memoryText: string | undefined;
				const memoryInfo = (performance as any).memory;
				if (memoryInfo && typeof memoryInfo.usedJSHeapSize === 'number') {
					memoryText = `${formatBytes(memoryInfo.usedJSHeapSize)} / ${formatBytes(memoryInfo.totalJSHeapSize)}`;
				}
				setStats({ fps, memory: memoryText });
				tracker.frameCount = 0;
				tracker.lastFpsUpdate = time;
			}
		};

		const sceneRef = scene;
		const animate = (time: number) => {
			controls.update();
			renderer.render(sceneRef, camera);
			updateStats(time);
			requestRef.current = requestAnimationFrame(animate);
		};
		requestRef.current = requestAnimationFrame(animate);

		return () => {
			if (requestRef.current) cancelAnimationFrame(requestRef.current);
			window.removeEventListener('resize', handleResize);
			controls.dispose();
			if (mergedLineRef.current) {
				mergedLineRef.current.geometry.dispose();
				mergedLineRef.current = null;
			}
			individualMaterialRef.current?.dispose();
			individualMaterialRef.current = null;
			mergedMaterialRef.current?.dispose();
			mergedMaterialRef.current = null;
			baseEdgesRef.current?.dispose();
			baseEdgesRef.current = null;
			renderer.dispose();
			if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
		};
	}, [rebuildBoxes, renderMode, formatBytes]);

	useEffect(() => {
		rebuildBoxes(renderMode);
	}, [renderMode, rebuildBoxes]);

	return (
		<div
			ref={mountRef}
			style={{
				position: 'relative',
				width: '100%',
				minHeight: '480px',
				borderRadius: '8px',
				overflow: 'hidden',
				background: '#050608',
				border: '1px solid rgba(255,255,255,0.08)'
			}}
		>
			<div
				style={{
					position: 'absolute',
					top: '12px',
					left: '12px',
					display: 'flex',
					alignItems: 'center',
					gap: '0.6rem',
					padding: '0.45rem 0.7rem',
					borderRadius: '6px',
					background: 'rgba(0, 0, 0, 0.6)',
					color: '#e0e0e0',
					fontSize: '0.85rem',
					backdropFilter: 'blur(8px)',
					boxShadow: '0 8px 20px rgba(0, 0, 0, 0.35)',
					zIndex: 1
				}}
			>
				<select
					value={renderMode}
					onChange={(event) => setRenderMode(event.target.value as RenderMode)}
					style={{
						cursor: 'pointer',
						borderRadius: '4px',
						border: '1px solid rgba(255,255,255,0.2)',
						background: 'rgba(25, 25, 25, 0.6)',
						color: '#e0e0e0',
						padding: '0.25rem 0.4rem'
					}}
				>
					<option value="none">默认（无渲染）</option>
					<option value="utilsMerge">mergeGeometries</option>
					<option value="manualMerge">手动合并位置数组</option>
					<option value="individual">独立渲染</option>
				</select>
				<span>{MODE_DESCRIPTIONS[renderMode]}</span>
				<div
					style={{
						display: 'flex',
						flexDirection: 'column',
						lineHeight: '1.2',
						fontVariantNumeric: 'tabular-nums'
					}}
				>
					<span>FPS: {stats.fps > 0 ? stats.fps.toFixed(1) : '--'}</span>
					<span>内存: {stats.memory ?? '--'}</span>
				</div>
			</div>
		</div>
	);
};

export default MergeGeometryDemo;
