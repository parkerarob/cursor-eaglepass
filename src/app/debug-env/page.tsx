'use client';

export default function DebugEnv() {
  const envVars = {
    NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    NEXT_PUBLIC_FIREBASE_APP_ID: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };

  const allNextPublicKeys = Object.keys(process.env).filter(key => key.startsWith('NEXT_PUBLIC'));
  const nodeEnv = process.env.NODE_ENV;
  const vercelEnv = process.env.VERCEL_ENV;

  return (
    <div style={{ padding: '20px', fontFamily: 'monospace', backgroundColor: '#f5f5f5', minHeight: '100vh' }}>
      <h1>🔍 Environment Variables Debug</h1>
      
      <div style={{ marginBottom: '30px', padding: '15px', backgroundColor: 'white', borderRadius: '8px' }}>
        <h2>📊 Environment Info</h2>
        <p><strong>NODE_ENV:</strong> {nodeEnv || 'undefined'}</p>
        <p><strong>VERCEL_ENV:</strong> {vercelEnv || 'undefined'}</p>
        <p><strong>Build Time:</strong> {new Date().toISOString()}</p>
      </div>

      <div style={{ marginBottom: '30px', padding: '15px', backgroundColor: 'white', borderRadius: '8px' }}>
        <h2>🔥 Firebase Environment Variables</h2>
        <pre style={{ backgroundColor: '#f8f8f8', padding: '10px', borderRadius: '4px', overflow: 'auto' }}>
          {JSON.stringify(envVars, null, 2)}
        </pre>
        
        <h3>Status Check:</h3>
        {Object.entries(envVars).map(([key, value]) => (
          <div key={key} style={{ 
            padding: '5px', 
            margin: '2px 0', 
            backgroundColor: value ? '#d4edda' : '#f8d7da',
            color: value ? '#155724' : '#721c24',
            borderRadius: '3px'
          }}>
            <strong>{key}:</strong> {value ? '✅ SET' : '❌ MISSING'}
            {value && <span style={{ marginLeft: '10px', fontSize: '0.8em' }}>
              ({value.substring(0, 10)}...)
            </span>}
          </div>
        ))}
      </div>
      
      <div style={{ marginBottom: '30px', padding: '15px', backgroundColor: 'white', borderRadius: '8px' }}>
        <h2>🔑 All NEXT_PUBLIC Environment Variables</h2>
        <p><strong>Count:</strong> {allNextPublicKeys.length}</p>
        <pre style={{ backgroundColor: '#f8f8f8', padding: '10px', borderRadius: '4px', overflow: 'auto' }}>
          {JSON.stringify(allNextPublicKeys, null, 2)}
        </pre>
      </div>

      <div style={{ padding: '15px', backgroundColor: 'white', borderRadius: '8px' }}>
        <h2>🛠️ Debugging Tips</h2>
        <ul>
          <li>Environment variables should be set in Vercel dashboard</li>
          <li>Variables must start with NEXT_PUBLIC_ to be available client-side</li>
          <li>After setting variables, redeploy the application</li>
          <li>Check the build logs for environment variable injection</li>
        </ul>
      </div>
    </div>
  );
} 