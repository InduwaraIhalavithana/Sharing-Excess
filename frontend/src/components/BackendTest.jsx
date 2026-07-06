import React, { useState } from 'react';

function BackendTest() {
  const [testResult, setTestResult] = useState('');
  const [loading, setLoading] = useState(false);

  const testBackend = async () => {
    setLoading(true);
    try {
      const response = await fetch('http://localhost/sharing-excess/backend/simple_test.php');
      const data = await response.json();
      setTestResult(JSON.stringify(data, null, 2));
    } catch (error) {
      setTestResult(`Error: ${error.message}`);
    }
    setLoading(false);
  };

  return (
    <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
      <h2>Backend Connection Test</h2>
      <button onClick={testBackend} disabled={loading}>
        {loading ? 'Testing...' : 'Test Backend Connection'}
      </button>
      {testResult && (
        <div style={{ marginTop: '20px', padding: '10px', backgroundColor: '#f5f5f5', borderRadius: '5px' }}>
          <h3>Result:</h3>
          <pre>{testResult}</pre>
        </div>
      )}
    </div>
  );
}

export default BackendTest; 