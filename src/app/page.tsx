export default function Home() {
    return (
            <div style={{ 
            fontFamily: 'monospace', 
            padding: '20px',
            maxWidth: '800px',
            margin: '0 auto' 
            }}>
            <h1>GVT Payments Service</h1>
            <p>Status: 🟢 Operational</p>

            <h2>Available Endpoints:</h2>
            <ul>
                <li><code>POST /api/checkout</code> - Create checkout session</li>
                <li><code>POST /api/auth/token</code> - Generate access token</li>
                <li><code>POST /api/webhooks/lemonsqueezy</code> - Webhook endpoint</li>
            </ul>

            <p>For API documentation, please refer to the repository README.</p>
            </div>
        )
    }