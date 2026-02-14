import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
    plugins: [react(), tailwindcss()],
    optimizeDeps: {
        include: ['pdfjs-dist'],
    },
    build: {
        rollupOptions: {
            output: {
                manualChunks: {
                    'pdfjs-dist': ['pdfjs-dist'],
                },
            },
        },
    },
    worker: {
        format: 'es',
    },
    server: {
        fs: {
            allow: ['..'],
        },
    },
})
