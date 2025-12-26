import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

type RendererType = 'webgpu' | 'none';

const WebGPUDemo: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [fps, setFps] = useState<number>(0);
  const [loadTime, setLoadTime] = useState<number>(0);
  const [rendererType, setRendererType] = useState<RendererType>('none');
  
  const deviceRef = useRef<GPUDevice | null>(null);
  const contextRef = useRef<GPUCanvasContext | null>(null);
  const pipelineRef = useRef<GPURenderPipeline | null>(null);
  const vertexBufferRef = useRef<GPUBuffer | null>(null);
  const frameUniformBufferRef = useRef<GPUBuffer | null>(null);
  const objectUniformBufferRef = useRef<GPUBuffer | null>(null);
  const frameBindGroupRef = useRef<GPUBindGroup | null>(null);
  const objectBindGroupRef = useRef<GPUBindGroup | null>(null);
  
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const sceneRotationRef = useRef<number>(0);
  
  const animationIdRef = useRef<number | null>(null);
  const rendererTypeRef = useRef<RendererType>('none');
  const isMountedRef = useRef<boolean>(true);

  const GRID_SIZE = 25;
  const SPACING = 1.2;
  const CUBE_SIZE = 0.5;

  const seededRandom = (seed: number): number => {
    const x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
  };

  const shaderCode = `
    struct FrameUniforms {
      viewProjectionMatrix : mat4x4<f32>,
      modelMatrix : mat4x4<f32>,
    }

    @group(0) @binding(0) var<uniform> frame : FrameUniforms;

    struct ObjectUniforms {
      position : vec4<f32>,
      color : vec4<f32>,
    }

    @group(1) @binding(0) var<uniform> object : ObjectUniforms;

    struct VertexInput {
      @location(0) position : vec3<f32>,
    }

    struct VertexOutput {
      @builtin(position) Position : vec4<f32>,
      @location(0) color : vec3<f32>,
    }

    @vertex
    fn vs_main(
      input : VertexInput
    ) -> VertexOutput {
      let worldPos = frame.modelMatrix * vec4<f32>(input.position + object.position.xyz, 1.0);
      var output : VertexOutput;
      output.Position = frame.viewProjectionMatrix * worldPos;
      output.color = object.color.xyz;
      return output;
    }

    @fragment
    fn fs_main(@location(0) color : vec3<f32>) -> @location(0) vec4<f32> {
      return vec4<f32>(color, 1.0);
    }
  `;

  useEffect(() => {
    isMountedRef.current = true;
    if (containerRef.current) {
        const aspect = containerRef.current.clientWidth / containerRef.current.clientHeight;
        const camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000);
        camera.position.set(60, 60, 60);
        cameraRef.current = camera;
    }
    return () => {
      isMountedRef.current = false;
      if (animationIdRef.current) cancelAnimationFrame(animationIdRef.current);
      if (controlsRef.current) controlsRef.current.dispose();
    };
  }, []);

  useEffect(() => {
    const initWebGPU = async () => {
      if (rendererType !== 'webgpu') {
          if (contextRef.current) contextRef.current.unconfigure();
          return;
      }
      
      if (!canvasRef.current || !containerRef.current) return;
      
      const startTime = performance.now();

      if (!navigator.gpu) {
        console.error("WebGPU not supported");
        return;
      }

      const adapter = await navigator.gpu.requestAdapter();
      if (!adapter) {
        console.error("No WebGPU adapter found");
        return;
      }

      const device = deviceRef.current || await adapter.requestDevice();
      deviceRef.current = device;

      const context = canvasRef.current.getContext('webgpu');
      if (!context) return;
      contextRef.current = context;

      const presentationFormat = navigator.gpu.getPreferredCanvasFormat();
      context.configure({
        device,
        format: presentationFormat,
        alphaMode: 'premultiplied',
      });

      const frameBindGroupLayout = device.createBindGroupLayout({
        entries: [{
          binding: 0,
          visibility: GPUShaderStage.VERTEX,
          buffer: { type: 'uniform' },
        }],
      });

      const objectBindGroupLayout = device.createBindGroupLayout({
        entries: [{
          binding: 0,
          visibility: GPUShaderStage.VERTEX,
          buffer: { type: 'uniform', hasDynamicOffset: true },
        }],
      });

      const pipeline = device.createRenderPipeline({
        layout: device.createPipelineLayout({
          bindGroupLayouts: [frameBindGroupLayout, objectBindGroupLayout],
        }),
        vertex: {
          module: device.createShaderModule({ code: shaderCode }),
          entryPoint: 'vs_main',
          buffers: [{
            arrayStride: 3 * 4,
            attributes: [{
              shaderLocation: 0,
              offset: 0,
              format: 'float32x3',
            }],
          }],
        },
        fragment: {
          module: device.createShaderModule({ code: shaderCode }),
          entryPoint: 'fs_main',
          targets: [{ format: presentationFormat }],
        },
        primitive: {
          topology: 'triangle-list',
          cullMode: 'none',
        },
        depthStencil: {
          depthWriteEnabled: true,
          depthCompare: 'less',
          format: 'depth24plus',
        },
      });
      pipelineRef.current = pipeline;

      const boxGeo = new THREE.BoxGeometry(CUBE_SIZE, CUBE_SIZE, CUBE_SIZE).toNonIndexed();
      const positionAttribute = boxGeo.attributes.position;
      const vertexData = new Float32Array(positionAttribute.array);
      const vertexCount = positionAttribute.count;
      
      const vertexBuffer = device.createBuffer({
        size: vertexData.byteLength,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      });
      device.queue.writeBuffer(vertexBuffer, 0, vertexData);
      vertexBufferRef.current = vertexBuffer;
      
      // Store vertex count for draw call
      (vertexBufferRef.current as any).vertexCount = vertexCount;

      const instanceCount = GRID_SIZE * GRID_SIZE * GRID_SIZE;
      
      // Align to 256 bytes
      const objectUniformSize = 256; 
      const objectBufferSize = instanceCount * objectUniformSize;
      const objectData = new Float32Array(objectBufferSize / 4);
      
      const color = new THREE.Color();
      
      for (let x = 0; x < GRID_SIZE; x++) {
        for (let y = 0; y < GRID_SIZE; y++) {
          for (let z = 0; z < GRID_SIZE; z++) {
             const index = x * GRID_SIZE * GRID_SIZE + y * GRID_SIZE + z;
             const offset = index * (objectUniformSize / 4);
             
             const seed = x * 1000 + y * 100 + z;
             color.setHSL(seededRandom(seed), 0.7, 0.5);
             
             // Position (vec4)
             objectData[offset + 0] = (x - GRID_SIZE / 2) * SPACING;
             objectData[offset + 1] = (y - GRID_SIZE / 2) * SPACING;
             objectData[offset + 2] = (z - GRID_SIZE / 2) * SPACING;
             objectData[offset + 3] = 0;
             
             // Color (vec4)
             objectData[offset + 4] = color.r;
             objectData[offset + 5] = color.g;
             objectData[offset + 6] = color.b;
             objectData[offset + 7] = 1;
          }
        }
      }

      const objectUniformBuffer = device.createBuffer({
        size: objectData.byteLength,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });
      device.queue.writeBuffer(objectUniformBuffer, 0, objectData);
      objectUniformBufferRef.current = objectUniformBuffer;

      const frameUniformBufferSize = 2 * 16 * 4; // ViewProj + Model
      const frameUniformBuffer = device.createBuffer({
        size: frameUniformBufferSize,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });
      frameUniformBufferRef.current = frameUniformBuffer;

      const frameBindGroup = device.createBindGroup({
        layout: frameBindGroupLayout,
        entries: [
          { binding: 0, resource: { buffer: frameUniformBuffer } },
        ],
      });
      frameBindGroupRef.current = frameBindGroup;

      const objectBindGroup = device.createBindGroup({
        layout: objectBindGroupLayout,
        entries: [
          { binding: 0, resource: { buffer: objectUniformBuffer, size: 256 } },
        ],
      });
      objectBindGroupRef.current = objectBindGroup;

      if (cameraRef.current && canvasRef.current) {
          if (controlsRef.current) controlsRef.current.dispose();
          const controls = new OrbitControls(cameraRef.current, canvasRef.current);
          controls.enableDamping = true;
          controlsRef.current = controls;
      }

      setLoadTime(performance.now() - startTime);
    };

    initWebGPU();
  }, [rendererType]);

  useEffect(() => {
      const handleResize = () => {
          if (!containerRef.current || !canvasRef.current || !cameraRef.current) return;
          const width = containerRef.current.clientWidth;
          const height = containerRef.current.clientHeight;
          
          canvasRef.current.width = width;
          canvasRef.current.height = height;
          
          cameraRef.current.aspect = width / height;
          cameraRef.current.updateProjectionMatrix();
          
          if (rendererType === 'webgpu' && contextRef.current && deviceRef.current) {
             contextRef.current.configure({
                device: deviceRef.current,
                format: navigator.gpu.getPreferredCanvasFormat(),
                alphaMode: 'premultiplied',
             });
          }
      };
      window.addEventListener('resize', handleResize);
      handleResize();
      return () => window.removeEventListener('resize', handleResize);
  }, [rendererType]);

  useEffect(() => {
      let depthTexture: GPUTexture | null = null;
      let currentWidth = 0;
      let currentHeight = 0;

      let frameCount = 0;
      let lastTime = performance.now();

      const render = () => {
          if (!isMountedRef.current) return;
          animationIdRef.current = requestAnimationFrame(render);
          
          if (rendererTypeRef.current !== 'webgpu') {
              if (fps !== 0) setFps(0);
              return;
          }
          
          const device = deviceRef.current;
          const context = contextRef.current;
          const pipeline = pipelineRef.current;
          const frameUniformBuffer = frameUniformBufferRef.current;
          const frameBindGroup = frameBindGroupRef.current;
          const objectBindGroup = objectBindGroupRef.current;
          const vertexBuffer = vertexBufferRef.current;
          const camera = cameraRef.current;
          
          if (!device || !context || !pipeline || !frameUniformBuffer || !frameBindGroup || !objectBindGroup || !vertexBuffer || !camera || !canvasRef.current) return;

          if (controlsRef.current) controlsRef.current.update();
          
          sceneRotationRef.current += 0.001;
          
          const modelMatrix = new THREE.Matrix4().makeRotationY(sceneRotationRef.current);
          const viewMatrix = camera.matrixWorldInverse;
          const projectionMatrix = camera.projectionMatrix.clone();
          
          // WebGPU clip space Z is [0, 1], while Three.js uses [-1, 1] (OpenGL style)
          // We need to convert the range.
          // Matrix to convert [-1, 1] to [0, 1]:
          // Scale by 0.5, Translate by 0.5
          // [ 1, 0, 0, 0 ]
          // [ 0, 1, 0, 0 ]
          // [ 0, 0, 0.5, 0.5 ]
          // [ 0, 0, 0, 1 ]
          // But we apply it to the projection matrix.
          // NewProj = Correction * OldProj
          
          // Actually, let's just use a simple manual fix or a helper if available.
          // Or just construct the matrix manually.
          const correction = new THREE.Matrix4().set(
             1, 0, 0, 0,
             0, 1, 0, 0,
             0, 0, 0.5, 0.5,
             0, 0, 0, 1
          );
          projectionMatrix.premultiply(correction);

          const viewProjectionMatrix = new THREE.Matrix4().multiplyMatrices(projectionMatrix, viewMatrix);
          
          const frameUniformData = new Float32Array(32);
          frameUniformData.set(viewProjectionMatrix.elements, 0);
          frameUniformData.set(modelMatrix.elements, 16);
          
          device.queue.writeBuffer(frameUniformBuffer, 0, frameUniformData);

          const width = canvasRef.current.width;
          const height = canvasRef.current.height;
          if (width !== currentWidth || height !== currentHeight || !depthTexture) {
              if (depthTexture) depthTexture.destroy();
              depthTexture = device.createTexture({
                  size: [width, height],
                  format: 'depth24plus',
                  usage: GPUTextureUsage.RENDER_ATTACHMENT,
              });
              currentWidth = width;
              currentHeight = height;
          }

          const commandEncoder = device.createCommandEncoder();
          const textureView = context.getCurrentTexture().createView();
          
          const renderPassDescriptor: GPURenderPassDescriptor = {
              colorAttachments: [{
                  view: textureView,
                  clearValue: { r: 0.13, g: 0.13, b: 0.13, a: 1.0 },
                  loadOp: 'clear',
                  storeOp: 'store',
              }],
              depthStencilAttachment: {
                  view: depthTexture.createView(),
                  depthClearValue: 1.0,
                  depthLoadOp: 'clear',
                  depthStoreOp: 'store',
              },
          };
          
          const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
          passEncoder.setPipeline(pipeline);
          passEncoder.setBindGroup(0, frameBindGroup);
          passEncoder.setVertexBuffer(0, vertexBuffer);
          
          const vertexCount = (vertexBuffer as any).vertexCount || 36;
          const instanceCount = GRID_SIZE * GRID_SIZE * GRID_SIZE;
          
          for (let i = 0; i < instanceCount; i++) {
             const dynamicOffset = i * 256;
             passEncoder.setBindGroup(1, objectBindGroup, [dynamicOffset]);
             passEncoder.draw(vertexCount, 1, 0, 0);
          }
          
          passEncoder.end();
          
          device.queue.submit([commandEncoder.finish()]);

          frameCount++;
          const currentTime = performance.now();
          if (currentTime >= lastTime + 1000) {
             setFps(Math.round((frameCount * 1000) / (currentTime - lastTime)));
             frameCount = 0;
             lastTime = currentTime;
          }
      };
      
      rendererTypeRef.current = rendererType;
      render();
      
      return () => {
          if (depthTexture) depthTexture.destroy();
      };
  }, [rendererType]);

  const handleRendererChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setRendererType(e.target.value as RendererType);
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', height: '600px',marginTop: 8, border: '1px solid #444'  }}>
      <canvas key={rendererType} ref={canvasRef} />
      
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
            <option value="webgpu">WebGPU (Raw)</option>
          </select>
        </div>
        
        <div style={{ marginTop: '15px', lineHeight: '1.8' }}>
          <div><strong>当前渲染器:</strong> {
            rendererType === 'webgpu' ? 'WebGPU (Raw)' : 
            '无'
          }</div>
          <div><strong>FPS:</strong> {fps}</div>
          <div><strong>初始化时间:</strong> {loadTime.toFixed(2)} ms</div>
          <div><strong>立方体数量:</strong> {(GRID_SIZE * GRID_SIZE * GRID_SIZE).toLocaleString()}</div>
          <div><strong>实现方式:</strong> {
             rendererType === 'webgpu' ? 'Multi-Draw (Dynamic Uniforms)' : '-'
          }</div>
        </div>
      </div>
    </div>
  );
};

export default WebGPUDemo;
