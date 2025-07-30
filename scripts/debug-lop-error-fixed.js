const { ethers } = require("hardhat");

// Helper to encode address as 32-byte left-padded hex string (1inch Address type)
function toAddressType(addr) {
  addr = addr.toLowerCase().replace(/^0x/, "");
  return "0x" + addr.padStart(64, "0");
}

// Helper to set maker traits flags with proper nonce
function setMakerTraits(flags = {}, nonce = 0) {
  let traits = 0n;
  
  // Set nonce in bits [120..159] (40 bits)
  const nonceValue = BigInt(nonce) & ((1n << 40n) - 1n); // Ensure nonce fits in 40 bits
  traits |= (nonceValue << 120n);
  
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

async function deployDummyToken() {
  const DummyOptionToken = await ethers.getContractFactory("DummyOptionToken");
  const dummyToken = await DummyOptionToken.deploy();
  await dummyToken.waitForDeployment();
  return dummyToken;
}

async function main() {
  console.log("🔧 LOP Integration Fix - Proper Nonce Management");
  console.log("===============================================");

  const [deployer, maker, taker1, taker2] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  console.log("Maker:", maker.address);
  console.log("Taker 1:", taker1.address);
  console.log("Taker 2:", taker2.address);
  console.log("");

  // Deploy contracts
  console.log("📦 Deploying contracts...");
  
  const MockERC20 = await ethers.getContractFactory("MockERC20");
  const mockETH = await MockERC20.deploy("Mock ETH", "mETH");
  const mockUSDC = await MockERC20.deploy("Mock USDC", "mUSDC");
  await mockETH.waitForDeployment();
  await mockUSDC.waitForDeployment();

  const MockWETH = await ethers.getContractFactory("MockWETH");
  const weth = await MockWETH.deploy();
  await weth.waitForDeployment();

  const LimitOrderProtocol = await ethers.getContractFactory("LimitOrderProtocol");
  const lop = await LimitOrderProtocol.deploy(weth.target);
  await lop.waitForDeployment();

  const OptionNFT = await ethers.getContractFactory("OptionNFT");
  const optionsNFT = await OptionNFT.deploy(lop.target);
  await optionsNFT.waitForDeployment();

  // Deploy separate dummy tokens for each order
  const dummyToken1 = await deployDummyToken();
  const dummyToken2 = await deployDummyToken();
  
  console.log("All contracts deployed successfully");
  console.log("");

  // Set default parameters on the NFT contract
  console.log("⚙️ Setting default parameters on NFT contract...");
  const strikePrice = ethers.parseUnits("2000", 6);
  const optionAmount = ethers.parseEther("1");
  
  await optionsNFT.setDefaultOptionParams(
    mockETH.target,
    mockUSDC.target,
    strikePrice,
    optionAmount
  );
  console.log("✅ Default parameters set");
  console.log("");

  // Setup tokens
  console.log("💰 Setting up tokens...");
  const ethAmount = ethers.parseEther("100");
  const usdcAmount = ethers.parseUnits("50000", 6);
  
  await mockETH.mint(maker.address, ethAmount);
  await mockUSDC.mint(taker1.address, usdcAmount);
  await mockUSDC.mint(taker2.address, usdcAmount);
  
  // Approve tokens
  await mockETH.connect(maker).approve(lop.target, ethAmount);
  await mockETH.connect(maker).approve(optionsNFT.target, ethAmount);
  await mockUSDC.connect(taker1).approve(lop.target, usdcAmount);
  await mockUSDC.connect(taker2).approve(lop.target, usdcAmount);
  
  // Setup separate dummy tokens
  await dummyToken1.mint(maker.address, optionAmount);
  await dummyToken1.connect(maker).approve(lop.target, optionAmount);
  
  await dummyToken2.mint(maker.address, optionAmount);
  await dummyToken2.connect(maker).approve(lop.target, optionAmount);
  
  console.log("✅ Tokens setup complete");
  console.log("");

  // Shared variables
  const expiry = Math.floor(Date.now() / 1000) + 86400;
  const premium = ethers.parseUnits("100", 6);
  
  // CRITICAL FIX: Use DIFFERENT nonces for each order
  const lopNonce1 = 1001;
  const lopNonce2 = 1002;
  
  console.log(`🔑 Using unique nonces: Order 1 = ${lopNonce1}, Order 2 = ${lopNonce2}`);
  console.log("");

  // Sign domain and types (shared)
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

  const optionsNFTDomain = {
    name: "OptionNFT",
    version: "1",
    chainId: await ethers.provider.getNetwork().then(n => n.chainId),
    verifyingContract: optionsNFT.target
  };

  const optionsNFTTypes = {
    Option: [
      { name: "underlyingAsset", type: "address" },
      { name: "strikeAsset", type: "address" },
      { name: "maker", type: "address" },
      { name: "strikePrice", type: "uint256" },
      { name: "expiry", type: "uint256" },
      { name: "amount", type: "uint256" },
      { name: "salt", type: "uint256" }
    ]
  };

  // Test 1: First order with nonce 1001
  console.log("🔧 Test 1: First Order (Nonce 1001)");
  console.log("===================================");
  
  try {
    const lopSalt1 = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
    
    const order1 = {
      salt: ethers.getBigInt(lopSalt1),
      maker: toAddressType(maker.address),
      receiver: toAddressType(maker.address),
      makerAsset: toAddressType(dummyToken1.target),
      takerAsset: toAddressType(mockUSDC.target),
      makingAmount: optionAmount,
      takingAmount: premium,
      makerTraits: setMakerTraits({ noPartialFills: true }, lopNonce1) // UNIQUE NONCE
    };

    const orderTuple1 = [
      order1.salt,
      order1.maker,
      order1.receiver,
      order1.makerAsset,
      order1.takerAsset,
      order1.makingAmount,
      order1.takingAmount,
      order1.makerTraits
    ];

    const value1 = {
      salt: order1.salt,
      maker: maker.address,
      receiver: maker.address,
      makerAsset: dummyToken1.target,
      takerAsset: mockUSDC.target,
      makingAmount: order1.makingAmount,
      takingAmount: order1.takingAmount,
      makerTraits: order1.makerTraits
    };

    const lopSignature1 = await maker.signTypedData(domain, types, value1);
    const { r: r1, s: s1, v: v1 } = ethers.Signature.from(lopSignature1);
    
    let vsBigInt1 = ethers.getBigInt(s1);
    if (v1 === 28) {
      vsBigInt1 |= (1n << 255n);
    }
    let vs1 = ethers.zeroPadValue(ethers.toBeHex(vsBigInt1), 32);
    
    const optionsNFTSalt1 = 2001;
    const optionsNFTValue1 = {
      underlyingAsset: mockETH.target,
      strikeAsset: mockUSDC.target,
      maker: maker.address,
      strikePrice: strikePrice,
      expiry: expiry,
      amount: optionAmount,
      salt: optionsNFTSalt1
    };

    const optionsNFTSignature1 = await maker.signTypedData(optionsNFTDomain, optionsNFTTypes, optionsNFTValue1);
    const { r: r1_opt, s: s1_opt, v: v1_opt } = ethers.Signature.from(optionsNFTSignature1);
    
    // Create interaction data
    const interactionData1 = ethers.AbiCoder.defaultAbiCoder().encode(
      [
        "address", "address", "address", "uint256", "uint256", "uint256", "uint256", "uint8", "bytes32", "bytes32"
      ],
      [
        maker.address, mockETH.target, mockUSDC.target, strikePrice, expiry, optionAmount, optionsNFTSalt1, v1_opt, r1_opt, s1_opt
      ]
    );

    const fullInteractionData1 = ethers.concat([
      ethers.zeroPadValue(optionsNFT.target, 20),
      interactionData1
    ]);
    
    const interactionLength1 = BigInt(fullInteractionData1.length / 2 - 1);
    const takerTraits1 = (interactionLength1 << 200n);

    console.log(`LOP Nonce 1: ${lopNonce1}`);
    console.log(`Maker Traits 1: 0x${order1.makerTraits.toString(16)}`);
    console.log("Attempting to fill first order...");
    
    const tx1 = await lop.connect(taker1).fillOrderArgs(
      orderTuple1,
      r1,
      vs1,
      premium,
      takerTraits1,
      fullInteractionData1
    );
    
    const receipt1 = await tx1.wait();
    console.log(`🎉 Order 1 filled successfully! Gas used: ${receipt1.gasUsed}`);
    
    // Check NFT balance
    const taker1NFTs = await optionsNFT.balanceOf(taker1.address);
    console.log(`Taker 1 NFT balance: ${taker1NFTs}`);
    
  } catch (error) {
    console.log(`❌ Order 1 failed: ${error.message}`);
    if (error.data) {
      console.log(`Error data: ${error.data}`);
    }
    return; // Exit if first order fails
  }

  // Test 2: Second order with nonce 1002
  console.log("\n🔧 Test 2: Second Order (Nonce 1002)");
  console.log("====================================");
  
  try {
    const lopSalt2 = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
    
    const order2 = {
      salt: ethers.getBigInt(lopSalt2),
      maker: toAddressType(maker.address),
      receiver: toAddressType(maker.address),
      makerAsset: toAddressType(dummyToken2.target), // DIFFERENT maker asset
      takerAsset: toAddressType(mockUSDC.target),
      makingAmount: optionAmount,
      takingAmount: premium,
      makerTraits: setMakerTraits({ noPartialFills: true }, lopNonce2) // DIFFERENT NONCE
    };

    const orderTuple2 = [
      order2.salt,
      order2.maker,
      order2.receiver,
      order2.makerAsset,
      order2.takerAsset,
      order2.makingAmount,
      order2.takingAmount,
      order2.makerTraits
    ];

    console.log(`LOP Nonce 2: ${lopNonce2}`);
    console.log(`Maker Traits 2: 0x${order2.makerTraits.toString(16)}`);
    console.log(`Different nonces: ${lopNonce1 !== lopNonce2}`);

    // Sign LOP order 2
    const value2 = {
      salt: order2.salt,
      maker: maker.address,
      receiver: maker.address,
      makerAsset: dummyToken2.target, // DIFFERENT maker asset
      takerAsset: mockUSDC.target,
      makingAmount: order2.makingAmount,
      takingAmount: order2.takingAmount,
      makerTraits: order2.makerTraits
    };

    const lopSignature2 = await maker.signTypedData(domain, types, value2);
    const { r: r2, s: s2, v: v2 } = ethers.Signature.from(lopSignature2);
    
    let vsBigInt2 = ethers.getBigInt(s2);
    if (v2 === 28) {
      vsBigInt2 |= (1n << 255n);
    }
    let vs2 = ethers.zeroPadValue(ethers.toBeHex(vsBigInt2), 32);

    // Sign OptionsNFT signature with DIFFERENT salt
    const optionsNFTSalt2 = 2002; // DIFFERENT salt
    const optionsNFTValue2 = {
      underlyingAsset: mockETH.target,
      strikeAsset: mockUSDC.target,
      maker: maker.address,
      strikePrice: strikePrice,
      expiry: expiry,
      amount: optionAmount,
      salt: optionsNFTSalt2 // DIFFERENT salt
    };

    const optionsNFTSignature2 = await maker.signTypedData(optionsNFTDomain, optionsNFTTypes, optionsNFTValue2);
    const { r: r2_opt, s: s2_opt, v: v2_opt } = ethers.Signature.from(optionsNFTSignature2);
    
    // Create interaction data
    const interactionData2 = ethers.AbiCoder.defaultAbiCoder().encode(
      [
        "address", "address", "address", "uint256", "uint256", "uint256", "uint256", "uint8", "bytes32", "bytes32"
      ],
      [
        maker.address, mockETH.target, mockUSDC.target, strikePrice, expiry, optionAmount, optionsNFTSalt2, v2_opt, r2_opt, s2_opt
      ]
    );

    const fullInteractionData2 = ethers.concat([
      ethers.zeroPadValue(optionsNFT.target, 20),
      interactionData2
    ]);
    
    const interactionLength2 = BigInt(fullInteractionData2.length / 2 - 1);
    const takerTraits2 = (interactionLength2 << 200n);

    console.log("Attempting to fill second order...");
    
    const tx2 = await lop.connect(taker2).fillOrderArgs(
      orderTuple2,
      r2,
      vs2,
      premium,
      takerTraits2,
      fullInteractionData2
    );
    
    const receipt2 = await tx2.wait();
    console.log(`🎉 Order 2 filled successfully! Gas used: ${receipt2.gasUsed}`);
    
    // Check NFT balance
    const taker2NFTs = await optionsNFT.balanceOf(taker2.address);
    console.log(`Taker 2 NFT balance: ${taker2NFTs}`);
    
    if (taker2NFTs > 0) {
      console.log("\n🎉🎉🎉 COMPLETE SUCCESS! 🎉🎉🎉");
      console.log("✅ Both orders filled successfully!");
      console.log("✅ LOP integration is working correctly!");
      console.log("✅ Hash-based system with proper nonce management is functional!");
    }
    
  } catch (error) {
    console.log(`❌ Order 2 failed: ${error.message}`);
    if (error.data) {
      console.log(`Error data: ${error.data}`);
    }
  }

  console.log("\n🎯 LOP Integration Fix Test Completed");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Test failed:", error);
    process.exit(1);
  }); 