import React, { useEffect, useState } from 'react';

export default function TimerAndOldStateDemo() {
  const [flag, setFlag] = useState(0);
  const [count, setCount] = useState(0);


  useEffect(() => {
    if (flag) {
      setCount(count + 1)
      setTimeout(() => {
        alert(`当前count值是: ${count}`);
      }, 1000)
    }
  }, [flag])

  return (
    <div style={{ padding: '20px', marginBottom: '20px', border: '1px solid #ccc', borderRadius: '8px' }}>
      <h3>setTimeout 闭包问题演示</h3>
      <p>当前计数: <strong>{count}</strong></p>
      <button
        onClick={() => setFlag(flag + 1)}
        style={{
          padding: '10px 20px',
          fontSize: '16px',
          cursor: 'pointer',
          backgroundColor: '#4CAF50',
          color: 'white',
          border: 'none',
          borderRadius: '4px'
        }}
      >
        点击增加计数并在一秒后显示count值
      </button>
    </div>
  );
}
