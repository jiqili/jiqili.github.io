import React, { useState } from 'react';

const TypedArrayDemo: React.FC = () => {
  const [logs, setLogs] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const runTest = async () => {
    setIsRunning(true);
    setLogs([]);
    
    // 让 UI 有机会更新
    await new Promise(r => setTimeout(r, 100));

    const COUNT = 1024 * 1024; // 1M 个对象
    // 每个对象: ID(Int32) + Value(Float32) = 8 bytes
    const TOTAL_BYTES = COUNT * 8;
    const buffer = new ArrayBuffer(TOTAL_BYTES);
    const view = new DataView(buffer);
    const u8 = new Uint8Array(buffer); // 用于手动读取字节
    
    // 初始化混合数据
    // 注意：必须使用小端序 (Little-Endian)，因为 TypedArray 默认使用系统字节序（通常是小端）
    // 如果 DataView 不指定 true，默认是大端序，会导致 TypedArray 读出来的数据是乱码
    for(let i=0; i<COUNT; i++) {
        view.setInt32(i*8, i, true);                 
        view.setFloat32(i*8 + 4, Math.random() * 100, true); 
    }

    const addLog = (msg: string) => setLogs(prev => [...prev, msg]);

    addLog(`准备数据: ${COUNT.toLocaleString()} 个混合对象`);
    addLog(`数据总量: ${(TOTAL_BYTES / 1024 / 1024).toFixed(1)} MB`);

    // 测试 1: 传统解析 (手动位运算 -> JS Objects)
    // 模拟最底层的解析：读取字节 -> 位运算拼接 -> 创建对象
    const start1 = performance.now();
    const normalArray = new Array(COUNT);
    for(let i=0; i<COUNT; i++) {
        const offset = i * 8;
        
        // --- 手动位运算解析 Int32 (小端序) ---
        // 相当于: id = b0 + b1*256 + b2*65536 + b3*16777216
        const b0 = u8[offset];
        const b1 = u8[offset+1];
        const b2 = u8[offset+2];
        const b3 = u8[offset+3];
        const id = b0 | (b1 << 8) | (b2 << 16) | (b3 << 24);
        
        // 浮点数解析太复杂(IEEE 754)，这里还是借用 DataView，但原理一样
        const val = view.getFloat32(offset + 4, true);
        
        normalArray[i] = { id, val };
    }
    const end1 = performance.now();
    addLog(`[传统解析] 手动位运算 -> JS对象: ${(end1 - start1).toFixed(2)} ms`);
    
    await new Promise(r => setTimeout(r, 100));

    // 测试 2: TypedArray 视图 (Zero-copy)
    // 内存本身无类型，只是字节。我们用不同的"眼镜"(视图)去解释同一块内存。
    const start2 = performance.now();
    
    // intView 把内存看作整数数组
    const intView = new Int32Array(buffer);
    // floatView 把同一块内存看作浮点数数组
    const floatView = new Float32Array(buffer);
    
    // 验证一下访问
    const len = intView.length; 
    const end2 = performance.now();
    addLog(`[TypedArray] 多重视图映射: ${(end2 - start2).toFixed(4)} ms`); 

    addLog(`-------------------------------------------`);
    addLog(`解析速度提升: 约 ${((end1 - start1) / (end2 - start2)).toFixed(0)} 倍`);
    
    // 测试 3: 遍历求和
    addLog(`\n开始计算性能测试...`);
    await new Promise(r => setTimeout(r, 100));

    const start3 = performance.now();
    let sum1 = 0;
    for(let i=0; i<COUNT; i++) {
        sum1 += normalArray[i].val;
    }
    const end3 = performance.now();
    addLog(`[JS对象数组] 遍历求和: ${(end3 - start3).toFixed(2)} ms`);

    const start4 = performance.now();
    let sum2 = 0;
    // 步长为2，因为 floatView 把整个 buffer 都看作 float
    // 我们的数据结构是 [Int, Float, Int, Float...]
    // 所以要取 floatView[1], floatView[3]...
    for(let i=0; i<COUNT*2; i+=2) {
        sum2 += floatView[i+1];
    }
    const end4 = performance.now();
    addLog(`[TypedArray] 步进遍历求和: ${(end4 - start4).toFixed(2)} ms`);

    setIsRunning(false);
  };

  return (
    <div style={{ border: '1px solid #444', padding: '20px', borderRadius: '8px', marginTop: '20px', background: 'rgba(0,0,0,0.2)' }}>
      <button 
        onClick={runTest} 
        disabled={isRunning}
        style={{
            padding: '8px 16px',
            background: isRunning ? '#555' : '#25c2a0',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: isRunning ? 'not-allowed' : 'pointer',
            fontWeight: 'bold'
        }}
      >
        {isRunning ? '测试中...' : '开始测试'}
      </button>
      
      <div style={{ marginTop: '15px', fontFamily: 'monospace', background: '#111', padding: '10px', borderRadius: '4px', minHeight: '300px', color: '#eee', fontSize: '13px' }}>
        {logs.length === 0 ? '点击开始测试查看结果...' : logs.map((log, i) => <div key={i} style={{marginBottom: '4px'}}>{log}</div>)}
      </div>
    </div>
  );
};

export default TypedArrayDemo;
