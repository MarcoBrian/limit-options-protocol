#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function main() {
  console.log('🚀 Options Protocol Production Setup\n');
  console.log('This script will help you configure your production environment.\n');

  // Get deployment platform choice
  console.log('Choose your deployment platform:');
  console.log('1. Vercel + Railway (Recommended)');
  console.log('2. Netlify + Render');
  console.log('3. Docker VPS');
  
  const platform = await question('Enter your choice (1-3): ');
  
  // Get contract addresses
  console.log('\n📋 Contract Information:');
  const lopAddress = await question('Enter your LimitOrderProtocol contract address: ');
  const nftAddress = await question('Enter your OptionsNFT contract address: ');
  
  // Get domain information
  console.log('\n🌐 Domain Information:');
  const frontendUrl = await question('Enter your frontend URL (e.g., https://myapp.vercel.app): ');
  const backendUrl = await question('Enter your backend URL (e.g., https://myapp.railway.app): ');
  
  // Generate frontend environment variables
  const frontendEnv = `# Frontend Production Environment Variables
# Copy these to your hosting platform (Vercel/Netlify)

REACT_APP_LOP_ADDRESS=${lopAddress}
REACT_APP_OPTIONS_NFT_ADDRESS=${nftAddress}
REACT_APP_CHAIN_ID=84532
REACT_APP_RPC_URL=https://sepolia.base.org
REACT_APP_NETWORK=base-sepolia
REACT_APP_API_URL=${backendUrl}
GENERATE_SOURCEMAP=false
`;

  // Generate backend environment variables
  const backendEnv = `# Backend Production Environment Variables
# Copy these to your hosting platform (Railway/Render)

NODE_ENV=production
PORT=3000
CHAIN_ID=84532
RPC_URL=https://sepolia.base.org
LOP_ADDRESS=${lopAddress}
OPTIONS_NFT_ADDRESS=${nftAddress}
CORS_ORIGIN=${frontendUrl}
DATABASE_PATH=./data/orders.db
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100
`;

  // Write environment files
  fs.writeFileSync('frontend/.env.production', frontendEnv);
  fs.writeFileSync('backend/.env.production', backendEnv);
  
  console.log('\n✅ Environment files generated:');
  console.log('- frontend/.env.production');
  console.log('- backend/.env.production');
  
  // Platform-specific instructions
  switch(platform) {
    case '1':
      console.log('\n🎯 Vercel + Railway Deployment Instructions:');
      console.log('');
      console.log('Frontend (Vercel):');
      console.log('1. cd frontend && vercel');
      console.log('2. Go to Vercel dashboard → Settings → Environment Variables');
      console.log('3. Copy variables from frontend/.env.production');
      console.log('4. Deploy: vercel --prod');
      console.log('');
      console.log('Backend (Railway):');
      console.log('1. railway init');
      console.log('2. Copy variables from backend/.env.production to Railway dashboard');
      console.log('3. railway up');
      break;
      
    case '2':
      console.log('\n🎯 Netlify + Render Deployment Instructions:');
      console.log('');
      console.log('Frontend (Netlify):');
      console.log('1. cd frontend && npm run build');
      console.log('2. netlify deploy --prod --dir=build');
      console.log('3. Add environment variables in Netlify dashboard');
      console.log('');
      console.log('Backend (Render):');
      console.log('1. Create Web Service on render.com');
      console.log('2. Add environment variables from backend/.env.production');
      break;
      
    case '3':
      console.log('\n🐳 Docker VPS Deployment Instructions:');
      console.log('');
      console.log('1. Copy backend/.env.production to .env on your server');
      console.log('2. cd docker && docker-compose -f docker-compose.prod.yml up -d');
      console.log('3. Setup SSL with certbot');
      break;
  }
  
  console.log('\n📖 For detailed instructions, see PRODUCTION-DEPLOYMENT-GUIDE.md');
  console.log('\n🔍 Health check your deployment:');
  console.log(`Frontend: ${frontendUrl}`);
  console.log(`Backend: ${backendUrl}/health`);
  
  rl.close();
}

main().catch(console.error);