const { ethers } = require("hardhat");

// Helper to encode address as 32-byte left-padded hex string (1inch Address type)
function toAddressType(addr) {
  addr = addr.toLowerCase().replace(/^0x/, "");
  return "0x" + addr.padStart(64, "0");
}

// Helper to set maker traits flags similar to SDK pattern
function setMakerTraits(flags = {}) {
  let traits = 0n;
  
  if (flags.postInteraction) {
    traits |= (1n << 251n); // POST_INTERACTION_CALL_FLAG
  }
  if (flags.noPartialFills) {
    traits |= (1n << 255n); // NO_PARTIAL_FILLS_FLAG
  }
  if (flags.allowMultipleFills) {
    traits |= (1n << 254n); // ALLOW_MULTIPLE_FILLS_FLAG
  }
  if (flags.preInteraction) {
    traits |= (1n << 252n); // PRE_INTERACTION_CALL_FLAG
  }
  if (flags.hasExtension) {
    traits |= (1n << 249n); // HAS_EXTENSION_FLAG
  }
  if (flags.usePermit2) {
    traits |= (1n << 248n); // USE_PERMIT2_FLAG
  }
  if (flags.unwrapWeth) {
    traits |= (1n << 247n); // UNWRAP_WETH_FLAG
  }
  
  return traits;
}

async function main() {
  console.log("🚀 Testing ETH Call Option with USDC Premium");
  console.log("=============================================");

  // Get signers
  const [deployer, maker, taker] = await ethers.getSigners();
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Maker: ${maker.address}`);
  console.log(`Taker: ${taker.address}`);

  // Deploy mock tokens
  console.log("\n📦 Deploying Mock Tokens...");
  const MockERC20 = await ethers.getContractFactory("MockERC20");
  const mockETH = await MockERC20.deploy("Mock ETH", "mETH");
  const mockUSDC = await MockERC20.deploy("Mock USDC", "mUSDC");
  
  console.log(`Mock ETH deployed: ${mockETH.target}`);
  console.log(`Mock USDC deployed: ${mockUSDC.target}`);

  // Deploy WETH
  console.log("\n📦 Deploying Mock WETH...");
  const MockWETH = await ethers.getContractFactory("MockWETH");
  const weth = await MockWETH.deploy();
  console.log(`WETH deployed: ${weth.target}`);

  // Deploy Limit Order Protocol
  console.log("\n📦 Deploying Limit Order Protocol...");
  const LimitOrderProtocol = await ethers.getContractFactory("LimitOrderProtocol");
  const lop = await LimitOrderProtocol.deploy(weth.target);
  console.log(`LOP deployed: ${lop.target}`);

  // Deploy Simple Options NFT
  console.log("\n📦 Deploying Simple Options NFT...");
  const SimpleOptionsNFT = await ethers.getContractFactory("SimpleOptionsNFT");
  const simpleOptionsNFT = await SimpleOptionsNFT.deploy(lop.target);
  console.log(`Simple Options NFT deployed: ${simpleOptionsNFT.target}`);

  // Mint tokens to maker and taker
  console.log("\n💰 Minting tokens...");
  const ethAmount = ethers.parseEther("10"); // 10 ETH to maker
  const usdcAmount = ethers.parseUnits("10000", 6); // 10,000 USDC to taker (USDC has 6 decimals)
  
  await mockETH.mint(maker.address, ethAmount);
  await mockUSDC.mint(taker.address, usdcAmount);
  
  console.log(`Minted ${ethers.formatEther(ethAmount)} Mock ETH to maker`);
  console.log(`Minted ${ethers.formatUnits(usdcAmount, 6)} Mock USDC to taker`);

  // Approve tokens for LOP
  console.log("\n✅ Approving tokens for LOP...");
  await mockETH.connect(maker).approve(lop.target, ethAmount);
  await mockUSDC.connect(taker).approve(lop.target, usdcAmount);
  console.log("Tokens approved for LOP");

  // Create call option parameters
  console.log("\n📝 Creating call option parameters...");
  const salt = ethers.getBigInt(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER));
  const strikePrice = ethers.parseUnits("2000", 6); // Strike price: 2000 USDC per ETH
  const expiry = Math.floor(Date.now() / 1000) + 86400; // 24 hours from now
  const optionAmount = ethers.parseEther("1"); // 1 ETH call option
  const premium = ethers.parseUnits("100", 6); // 100 USDC premium

  // Set default parameters on the NFT contract
  console.log("\n⚙️ Setting default parameters on NFT contract...");
  await simpleOptionsNFT.setDefaultOptionParams(
    mockETH.target,    // underlyingAsset
    mockUSDC.target,   // strikeAsset  
    strikePrice,       // strikePrice
    optionAmount       // amount
  );
  console.log("Default parameters set on NFT contract");
  
  // Create order parameters for the call option
  // Maker offers 1 ETH, Taker pays 100 USDC premium
  const order = {
    salt,
    maker: toAddressType(maker.address),
    receiver: toAddressType(maker.address),
    makerAsset: toAddressType(mockETH.target),
    takerAsset: toAddressType(mockUSDC.target),
    makingAmount: optionAmount,
    takingAmount: premium,
    makerTraits: 0 // No post-interaction needed, using taker interaction instead
  };

  // For ethers.js, pass as tuple (array)
  const orderTuple = [
    order.salt,
    order.maker,
    order.receiver,
    order.makerAsset,
    order.takerAsset,
    order.makingAmount,
    order.takingAmount,
    order.makerTraits
  ];

  console.log("Call Option Order parameters:");
  console.log(`- Strike Price: ${ethers.formatUnits(strikePrice, 6)} USDC per ETH`);
  console.log(`- Expiry: ${new Date(expiry * 1000).toISOString()}`);
  console.log(`- Option Amount: ${ethers.formatEther(optionAmount)} ETH`);
  console.log(`- Premium: ${ethers.formatUnits(premium, 6)} USDC`);
  console.log(order);

  // Get domain separator
  console.log("\n🔐 Getting domain separator...");
  const domainSeparator = await lop.DOMAIN_SEPARATOR();
  console.log(`Domain Separator: ${domainSeparator}`);

  // Hash the order
  console.log("\n🔍 Hashing order...");
  const orderHash = await lop.hashOrder(orderTuple);
  console.log(`Order Hash: ${orderHash}`);

  // Sign the order hash using EIP-712
  console.log("\n✍️ Signing order hash...");
  
  // Create the EIP-712 typed data
  const domain = {
    name: "1inch Limit Order Protocol",
    version: "4",
    chainId: await ethers.provider.getNetwork().then(n => n.chainId),
    verifyingContract: lop.target
  };

  const types = {
    Order: [
      { name: "salt", type: "uint256" },
      { name: "maker", type: "address" },
      { name: "receiver", type: "address" },
      { name: "makerAsset", type: "address" },
      { name: "takerAsset", type: "address" },
      { name: "makingAmount", type: "uint256" },
      { name: "takingAmount", type: "uint256" },
      { name: "makerTraits", type: "uint256" }
    ]
  };

  // Use original address values for signing (not the padded ones)
  const value = {
    salt: order.salt,
    maker: maker.address,
    receiver: maker.address,
    makerAsset: mockETH.target,
    takerAsset: mockUSDC.target,
    makingAmount: order.makingAmount,
    takingAmount: order.takingAmount,
    makerTraits: order.makerTraits
  };

  // Sign the typed data
  const signature = await maker.signTypedData(domain, types, value);
  const { r, s, v } = ethers.Signature.from(signature);
  
  // EIP-2098 compact signature: vs = s if v == 27, vs = s | (1 << 255) if v == 28
  let vsBigInt = ethers.getBigInt(s);
  if (v === 28) {
    vsBigInt |= (1n << 255n);
  }
  let vs = ethers.zeroPadValue(ethers.toBeHex(vsBigInt), 32);
  
  console.log(`Signature: ${signature}`);
  console.log(`r: ${r}`);
  console.log(`s: ${s}`);
  console.log(`v: ${v}`);
  console.log(`vs: ${vs}`);

  // Check balances before
  console.log("\n💰 Checking balances before fill...");
  const makerETHBefore = await mockETH.balanceOf(maker.address);
  const makerUSDCBefore = await mockUSDC.balanceOf(maker.address);
  const takerETHBefore = await mockETH.balanceOf(taker.address);
  const takerUSDCBefore = await mockUSDC.balanceOf(taker.address);
  
  console.log(`Maker ETH: ${ethers.formatEther(makerETHBefore)}`);
  console.log(`Maker USDC: ${ethers.formatUnits(makerUSDCBefore, 6)}`);
  console.log(`Taker ETH: ${ethers.formatEther(takerETHBefore)}`);
  console.log(`Taker USDC: ${ethers.formatUnits(takerUSDCBefore, 6)}`);

  // Fill the order with interaction to mint NFT
  console.log("\n🔄 Filling order with NFT minting...");
  const fillAmount = ethers.parseUnits("50", 6); // Fill half the premium (50 USDC)
  
  try {
    // Test with simple interaction data - just the NFT contract address as bytes
    console.log(`\n🧪 Testing with simple interaction data...`);
    const simpleInteractionData = ethers.getBytes(simpleOptionsNFT.target); // Convert to bytes
    
    console.log(`\n🔍 Debug info:`);
    console.log(`- Simple interaction data: ${simpleOptionsNFT.target}`);
    console.log(`- Simple interaction length: ${simpleInteractionData.length}`);
    
    // Calculate taker traits: interaction length in bits 200-223
    const takerTraits = (BigInt(simpleInteractionData.length) << 200n);
    console.log(`- Taker traits: ${takerTraits}`);
    
    const tx = await lop.connect(taker).fillOrderArgs(
      orderTuple,
      r,
      vs,
      fillAmount,
      takerTraits, // Taker traits: interaction length in bits 200-223
      simpleInteractionData // NFT contract address as bytes
    );
    
    const receipt = await tx.wait();
    console.log(`✅ Order filled successfully with NFT minting!`);
    console.log(`Transaction hash: ${receipt.hash}`);
    
    // Check balances after
    console.log("\n💰 Checking balances after fill...");
    const makerETHAfter = await mockETH.balanceOf(maker.address);
    const makerUSDCAfter = await mockUSDC.balanceOf(maker.address);
    const takerETHAfter = await mockETH.balanceOf(taker.address);
    const takerUSDCAfter = await mockUSDC.balanceOf(taker.address);
    
    console.log(`Maker ETH: ${ethers.formatEther(makerETHAfter)} (${ethers.formatEther(makerETHAfter - makerETHBefore)})`);
    console.log(`Maker USDC: ${ethers.formatUnits(makerUSDCAfter, 6)} (${ethers.formatUnits(makerUSDCAfter - makerUSDCBefore, 6)})`);
    console.log(`Taker ETH: ${ethers.formatEther(takerETHAfter)} (${ethers.formatEther(takerETHAfter - takerETHBefore)})`);
    console.log(`Taker USDC: ${ethers.formatUnits(takerUSDCAfter, 6)} (${ethers.formatUnits(takerUSDCAfter - takerUSDCBefore, 6)})`);

    // Check NFT ownership
    console.log("\n🖼️ Checking NFT ownership...");
    const takerNFTCount = await simpleOptionsNFT.balanceOf(taker.address);
    console.log(`Taker NFT count: ${takerNFTCount}`);
    
    if (takerNFTCount > 0) {
      const tokenId = await simpleOptionsNFT.tokenOfOwnerByIndex(taker.address, 0);
      console.log(`Taker's first NFT ID: ${tokenId}`);
      
      console.log("✅ NFT successfully minted!");
    }
    
    console.log("\n🎉 ETH Call Option test completed successfully!");
    
  } catch (error) {
    console.error("❌ Error filling order:", error.message);
    console.error("Full error:", error);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 