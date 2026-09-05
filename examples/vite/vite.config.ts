import { defineConfig } from 'vite';
import { resona } from '@natsuneko-laboratory/resona-vite';
export default defineConfig({ plugins: [resona()] });
