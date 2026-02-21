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
                    'vendor-react': ['react', 'react-dom', 'react-router-dom'],
                    'vendor-ui': ['lucide-react', 'clsx', 'tailwind-merge'],
                    'vendor-pdf': ['pdfjs-dist', 'react-pdf'],
                    'vendor-three': ['three', 'three-stdlib'],
                    'vendor-math': ['katex'],
                },
            },
        },
        chunkSizeWarningLimit: 600,
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
