import React, { useState } from 'react';
import styles from './GCDemo.module.css';

export default function GCDemo() {
  const [traditionalTime, setTraditionalTime] = useState<number>(0);
  const [poolTime, setPoolTime] = useState<number>(0);
  const [isRunningTraditional, setIsRunningTraditional] = useState(false);
  const [isRunningPool, setIsRunningPool] = useState(false);
    const iterations = 10000;
  // 传统方式：频繁创建和销毁ArrayBuffer
  const traditionalApproach = () => {
    
    const bufferSize = 1024 * 100; // 100KB per buffer
    
    const startTime = performance.now();
    
    for (let i = 0; i < iterations; i++) {
      const buffer = new ArrayBuffer(bufferSize);
      const view = new Float32Array(buffer);
      for (let j = 0; j < view.length; j++) {
        view[j] = Math.random() * 100;
      }
      let sum = 0;
      for (let j = 0; j < Math.min(view.length, 100); j++) {
        sum += view[j];
      }
      
      // buffer在这里会被标记为可回收
      // 大量的临时对象会触发频繁的垃圾回收
    }
    
    const endTime = performance.now();
    return endTime - startTime;
  };

  // 共享缓冲池方式：复用同一块内存
  const sharedBufferPoolApproach = () => {
    const bufferSize = 1024 * 100; // 100KB
    
    // 预先分配一大块内存
    const sharedBuffer = new ArrayBuffer(bufferSize);
    const sharedView = new Float32Array(sharedBuffer);
    
    const startTime = performance.now();
    
    for (let i = 0; i < iterations; i++) {
      // 复用同一块内存，只需要重置数据
      // 不需要创建新的ArrayBuffer
      
      // 模拟数据处理
      for (let j = 0; j < sharedView.length; j++) {
        sharedView[j] = Math.random() * 100;
      }
      let sum = 0;
      for (let j = 0; j < Math.min(sharedView.length, 100); j++) {
        sum += sharedView[j];
      }
      
      // 不需要释放内存，下次循环直接复用
    }
    
    const endTime = performance.now();
    return endTime - startTime;
  };

  const runTraditionalTest = async () => {
    setIsRunningTraditional(true);
    setTraditionalTime(0);
    
    await new Promise(resolve => setTimeout(resolve, 100));
    const time = traditionalApproach();
    setTraditionalTime(time);
    
    setIsRunningTraditional(false);
  };

  const runPoolTest = async () => {
    setIsRunningPool(true);
    setPoolTime(0);
    
    await new Promise(resolve => setTimeout(resolve, 100));
    const time = sharedBufferPoolApproach();
    setPoolTime(time);
    
    setIsRunningPool(false);
  };

  const improvement = traditionalTime > 0 && poolTime > 0
    ? ((traditionalTime - poolTime) / traditionalTime * 100).toFixed(2)
    : 0;

  const speedup = traditionalTime > 0 && poolTime > 0
    ? (traditionalTime / poolTime).toFixed(2)
    : 0;

  return (
    <div className={styles.container}>
      <h2>🚀 垃圾回收与共享缓冲池的性能对比</h2>
      
      <div className={styles.buttonGroup}>
        <button 
          onClick={runTraditionalTest} 
          disabled={isRunningTraditional}
          className={`${styles.button} ${styles.buttonTraditional}`}
        >
          {isRunningTraditional ? '测试中...' : '❌ 频繁GC测试'}
        </button>

        <button 
          onClick={runPoolTest} 
          disabled={isRunningPool}
          className={`${styles.button} ${styles.buttonPool}`}
        >
          {isRunningPool ? '测试中...' : '✅ 共享缓冲池测试'}
        </button>
      </div>

      <div className={styles.results}>
        <div className={styles.timeDisplay}>
          <div className={styles.timeItem}>
            频繁GC耗时: <span className={styles.timeValue}>
              {traditionalTime > 0 ? `${traditionalTime.toFixed(0)}ms` : '空'}
            </span>
          </div>
          <div className={styles.timeItem}>
            共享缓冲池耗时: <span className={styles.timeValue}>
              {poolTime > 0 ? `${poolTime.toFixed(0)}ms` : '空'}
            </span>
          </div>
          <div className={styles.timeItem}>
            性能提升: <span className={`${styles.timeValue} ${styles.highlight}`}>
              {traditionalTime > 0 && poolTime > 0 
                ? `${improvement}% (快了${speedup}x)` 
                : '空'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
