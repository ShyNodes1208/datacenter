# TASK-0029: Fix Vite proxy not forwarding DELETE requests

## Problem

Browser console shows:
```
DELETE http://localhost:5173/api/rooms/... 405 (Method Not Allowed)
```

Backend tests pass (DELETE room works via HttpClient), but frontend DELETE requests through Vite dev server return 405.

## Fix

**File:** `src/frontend/vite.config.ts`

The Vite proxy config needs to properly forward DELETE (and PUT) HTTP methods. Add `configure` option to ensure the proxy server handles all HTTP methods:

```typescript
proxy: {
  '/api': {
    target: proxyTarget,
    changeOrigin: true,
  },
},
```

If `changeOrigin` alone doesn't fix it, try the explicit method approach:

```typescript
proxy: {
  '/api': {
    target: proxyTarget,
    changeOrigin: true,
    configure: (proxy) => {
      proxy.on('proxyReq', (proxyReq, req) => {
        // Ensure all methods are forwarded
      })
    },
  },
},
```

Also verify the backend is running on `http://localhost:5142`.

## Verification

1. Start backend: `cd src/backend/Datacenter.Api && dotnet run`
2. Start frontend: `cd src/frontend && npm run dev`
3. Open browser, go to homepage, click delete on a room with no racks
4. DELETE request should return 204 (or 409 if room has racks)
