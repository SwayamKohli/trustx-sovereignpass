import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
export default defineConfig(({mode}) => {
  const env={...loadEnv(mode,process.cwd(),''),...process.env};
  const allowedHosts=['bank.local','b4nk-secure.local'];
  for(const value of [env.EXPECTED_ORIGIN,env.ORIGIN,env.FAKE_PHISHING_ORIGIN])if(value)allowedHosts.push(new URL(value).hostname);
  return {plugins:[react(),tailwindcss()],server:{port:Number(env.VITE_PORT||5173),strictPort:true,allowedHosts}};
});
