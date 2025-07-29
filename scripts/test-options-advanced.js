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
  console.log("🚀 Testing ETH Call Option with USDC Premium (Advanced OptionsNFT)");
  console.log("=====================================================================");

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

  // Deploy Options NFT
  console.log("\n📦 Deploying Options NFT...");
  const OptionNFT = await ethers.getContractFactory("OptionNFT");
  const optionsNFT = await OptionNFT.deploy(lop.target);
  console.log(`Options NFT deployed: ${optionsNFT.target}`);

  // Deploy Dummy Option Token (used as maker asset placeholder)
  console.log("\n📦 Deploying Dummy Option Token...");
  const DummyOptionToken = await ethers.getContractFactory("DummyOptionToken");
  const dummyOptionToken = await DummyOptionToken.deploy();
  console.log(`Dummy Option Token deployed: ${dummyOptionToken.target}`);

  // Mint tokens to maker and taker
  console.log("\n💰 Minting tokens...");
  const ethAmount = ethers.parseEther("10"); // 10 ETH to maker
  const usdcAmount = ethers.parseUnits("10000", 6); // 10,000 USDC to taker (USDC has 6 decimals)
  
  await mockETH.mint(maker.address, ethAmount);
  await mockUSDC.mint(taker.address, usdcAmount);
  
  // Mint dummy option tokens to maker (for LOP maker asset)
  const optionAmount = ethers.parseEther("1"); // 1 ETH call option
  await dummyOptionToken.mint(maker.address, optionAmount);
  
  console.log(`Minted ${ethers.formatEther(ethAmount)} Mock ETH to maker`);
  console.log(`Minted ${ethers.formatUnits(usdcAmount, 6)} Mock USDC to taker`);
  console.log(`Minted ${ethers.formatEther(optionAmount)} Dummy Option Tokens to maker`);

  // Approve tokens for LOP and OptionsNFT
  console.log("\n✅ Approving tokens...");
  await mockETH.connect(maker).approve(lop.target, ethAmount);
  await mockETH.connect(maker).approve(optionsNFT.target, ethAmount); // For collateral
  await mockUSDC.connect(taker).approve(lop.target, usdcAmount);
  await dummyOptionToken.connect(maker).approve(lop.target, optionAmount); // For LOP maker asset
  console.log("Tokens approved for LOP and OptionsNFT");

  // Create call option parameters
  console.log("\n📝 Creating call option parameters...");
  const salt = ethers.getBigInt(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER));
  const strikePrice = ethers.parseUnits("2000", 6); // Strike price: 2000 USDC per ETH
  const expiry = Math.floor(Date.now() / 1000) + 86400; // 24 hours from now
  const premium = ethers.parseUnits("100", 6); // 100 USDC premium

  // Set default parameters on the NFT contract
  console.log("\n⚙️ Setting default parameters on NFT contract...");
  await optionsNFT.setDefaultOptionParams(
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
    makerAsset: toAddressType(dummyOptionToken.target), // Use DummyOptionToken as maker asset
    takerAsset: toAddressType(mockUSDC.target),
    makingAmount: optionAmount,
    takingAmount: premium,
    makerTraits: setMakerTraits({ noPartialFills: true }) // Prevent partial fills at protocol level
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
    makerAsset: dummyOptionToken.target, // Use DummyOptionToken as maker asset
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

  // Create signature for OptionsNFT
  console.log("\n🔐 Creating signature for OptionsNFT...");
  
  // Calculate the domain separator manually since OptionsNFT doesn't expose it
  // The contract uses: EIP712("OptionNFT", "1")
  const optionsNFTDomainSeparator = ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ["bytes32", "bytes32", "bytes32", "uint256", "address"],
      [
        ethers.keccak256(ethers.toUtf8Bytes("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)")),
        ethers.keccak256(ethers.toUtf8Bytes("OptionNFT")),
        ethers.keccak256(ethers.toUtf8Bytes("1")),
        await ethers.provider.getNetwork().then(n => n.chainId),
        optionsNFT.target
      ]
    )
  );
  console.log(`OptionsNFT Domain Separator: ${optionsNFTDomainSeparator}`);

  // Create the EIP-712 typed data for OptionsNFT
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
      { name: "nonce", type: "uint256" }
    ]
  };

  const nonce = 1; // Use a simple nonce for testing
  
  const optionsNFTValue = {
    underlyingAsset: mockETH.target,
    strikeAsset: mockUSDC.target,
    maker: maker.address,
    strikePrice: strikePrice,
    expiry: expiry,
    amount: optionAmount,
    nonce: nonce
  };

  // Sign the OptionsNFT typed data using the manually calculated domain separator
  const optionsNFTSignature = await maker.signTypedData(optionsNFTDomain, optionsNFTTypes, optionsNFTValue);
  const { r: r2, s: s2, v: v2 } = ethers.Signature.from(optionsNFTSignature);
  
  console.log(`OptionsNFT Signature: ${optionsNFTSignature}`);
  console.log(`OptionsNFT r: ${r2}`);
  console.log(`OptionsNFT s: ${s2}`);
  console.log(`OptionsNFT v: ${v2}`);

  // Check balances before
  console.log("\n💰 Checking balances before fill...");
  const makerETHBefore = await mockETH.balanceOf(maker.address);
  const makerUSDCBefore = await mockUSDC.balanceOf(maker.address);
  const makerDummyBefore = await dummyOptionToken.balanceOf(maker.address);
  const takerETHBefore = await mockETH.balanceOf(taker.address);
  const takerUSDCBefore = await mockUSDC.balanceOf(taker.address);
  const takerDummyBefore = await dummyOptionToken.balanceOf(taker.address);
  
  console.log(`Maker ETH: ${ethers.formatEther(makerETHBefore)}`);
  console.log(`Maker USDC: ${ethers.formatUnits(makerUSDCBefore, 6)}`);
  console.log(`Maker Dummy: ${ethers.formatEther(makerDummyBefore)}`);
  console.log(`Taker ETH: ${ethers.formatEther(takerETHBefore)}`);
  console.log(`Taker USDC: ${ethers.formatUnits(takerUSDCBefore, 6)}`);
  console.log(`Taker Dummy: ${ethers.formatEther(takerDummyBefore)}`);

  // Fill the order with interaction to mint NFT
  console.log("\n🔄 Filling order with NFT minting...");
  const fillAmount = premium;
  
  try {
    // Create interaction data for OptionsNFT
    // FIXED: The OptionsNFT now expects all parameters: (address maker, address underlyingAsset, address strikeAsset, uint256 strikePrice, uint256 expiry, uint256 amount, uint256 nonce, uint8 v, bytes32 r, bytes32 s)
    console.log(`\n🧪 Creating interaction data for OptionsNFT...`);
    
    const interactionData = ethers.AbiCoder.defaultAbiCoder().encode(
      [
        "address",    // maker
        "address",    // underlyingAsset
        "address",    // strikeAsset
        "uint256",    // strikePrice
        "uint256",    // expiry
        "uint256",    // amount
        "uint256",    // nonce
        "uint8",      // v
        "bytes32",    // r
        "bytes32"     // s
      ],
      [
        maker.address,
        mockETH.target,      // underlyingAsset
        mockUSDC.target,     // strikeAsset
        strikePrice,         // strikePrice
        expiry,              // expiry
        optionAmount,        // amount
        nonce,               // nonce
        v2,                  // v
        r2,                  // r
        s2                   // s
      ]
    );
    
    // The LOP expects: contract address (20 bytes) + encoded parameters
    // Use the proper format with hexConcat and hexZeroPad
    const targetAddress = optionsNFT.target; // 20 bytes
    const extraData = ethers.AbiCoder.defaultAbiCoder().encode(
      [
        "address",    // maker
        "address",    // underlyingAsset
        "address",    // strikeAsset
        "uint256",    // strikePrice
        "uint256",    // expiry
        "uint256",    // amount
        "uint256",    // nonce
        "uint8",      // v
        "bytes32",    // r
        "bytes32"     // s
      ],
      [
        maker.address,
        mockETH.target,      // underlyingAsset
        mockUSDC.target,     // strikeAsset
        strikePrice,         // strikePrice
        expiry,              // expiry
        optionAmount,        // amount
        nonce,               // nonce
        v2,                  // v
        r2,                  // r
        s2                   // s
      ]
    );

    const fullInteractionData = ethers.concat([
      ethers.zeroPadValue(targetAddress, 20),
      extraData
    ]);
    
    // console.log(`\n🔍 Debug info:`);
    // console.log(`- OptionsNFT address: ${optionsNFT.target}`);
    // console.log(`- Encoded params: ${interactionData}`);
    // console.log(`- Full interaction data: ${fullInteractionData}`);
    // console.log(`- Full interaction data length: ${fullInteractionData.length / 2 - 1}`); // Convert hex to bytes
    
    // Calculate taker traits: interaction length in bits 200-223
    const interactionLength = BigInt(fullInteractionData.length / 2 - 1);
    const takerTraits = (interactionLength << 200n);
    // console.log(`- Taker traits: ${takerTraits}`);
    // console.log(`- Taker traits hex: ${ethers.toBeHex(takerTraits)}`);
    
    // Let's also check if the interaction data is being processed correctly by the LOP
    console.log(`\n🔍 LOP Processing Check:`);
    console.log(`- First 20 bytes (contract address): ${fullInteractionData.substring(0, 42)}`); // 20 bytes = 40 hex chars + 0x
    console.log(`- Remaining bytes length: ${(fullInteractionData.length - 42) / 2}`);
    console.log(`- Total interaction data length: ${(fullInteractionData.length - 2) / 2}`);
    
    // This is what the OptionsNFT will receive as extraData (interaction[20:])
    const extraDataForNFT = fullInteractionData.substring(42); // Skip 0x and first 20 bytes
    console.log(`- ExtraData length: ${extraDataForNFT.length / 2}`);
    
    // Let's decode what the NFT will try to decode
    try {
        const decodedParams = ethers.AbiCoder.defaultAbiCoder().decode(
            [
                "address",    // maker
                "address",    // underlyingAsset
                "address",    // strikeAsset
                "uint256",    // strikePrice
                "uint256",    // expiry
                "uint256",    // amount
                "uint256",    // nonce
                "uint8",      // v
                "bytes32",    // r
                "bytes32"     // s
            ],
            "0x" + extraDataForNFT // Add 0x prefix for decoding
        );
        console.log(`- Decoded maker: ${decodedParams[0]}`);
        console.log(`- Decoded underlyingAsset: ${decodedParams[1]}`);
        console.log(`- Decoded strikeAsset: ${decodedParams[2]}`);
        console.log(`- Decoded strikePrice: ${ethers.formatUnits(decodedParams[3], 6)}`);
        console.log(`- Decoded expiry: ${decodedParams[4]}`);
        console.log(`- Decoded amount: ${ethers.formatEther(decodedParams[5])}`);
        console.log(`- Decoded nonce: ${decodedParams[6]}`);
        console.log(`- Decoded v: ${decodedParams[7]}`);
        console.log(`- Decoded r: ${decodedParams[8]}`);
        console.log(`- Decoded s: ${decodedParams[9]}`);
    } catch (error) {
        console.log(`- Decoding failed: ${error.message}`);
        console.log(`- ExtraData hex: 0x${extraDataForNFT}`);
        
        // Let's try to decode the original encoded params directly
        try {
            const originalDecoded = ethers.AbiCoder.defaultAbiCoder().decode(
                [
                    "address",    // maker
                    "address",    // underlyingAsset
                    "address",    // strikeAsset
                    "uint256",    // strikePrice
                    "uint256",    // expiry
                    "uint256",    // amount
                    "uint256",    // nonce
                    "uint8",      // v
                    "bytes32",    // r
                    "bytes32"     // s
                ],
                interactionData
            );
            console.log(`- Original encoded params decode successfully:`);
            console.log(`  - maker: ${originalDecoded[0]}`);
            console.log(`  - underlyingAsset: ${originalDecoded[1]}`);
            console.log(`  - strikeAsset: ${originalDecoded[2]}`);
            console.log(`  - strikePrice: ${ethers.formatUnits(originalDecoded[3], 6)}`);
            console.log(`  - expiry: ${originalDecoded[4]}`);
            console.log(`  - amount: ${ethers.formatEther(originalDecoded[5])}`);
            console.log(`  - nonce: ${originalDecoded[6]}`);
            console.log(`  - v: ${originalDecoded[7]}`);
            console.log(`  - r: ${originalDecoded[8]}`);
            console.log(`  - s: ${originalDecoded[9]}`);
        } catch (error2) {
            console.log(`- Original params also failed: ${error2.message}`);
        }
    }
    
    const tx = await lop.connect(taker).fillOrderArgs(
      orderTuple,
      r,
      vs,
      fillAmount,
      takerTraits, // Taker traits: interaction length in bits 200-223
      fullInteractionData // Contract address + encoded parameters as raw bytes
    );
    
    const receipt = await tx.wait();
    console.log(`✅ Order filled successfully with NFT minting!`);
    console.log(`Transaction hash: ${receipt.hash}`);
    
    // Check balances after
    console.log("\n💰 Checking balances after fill...");
    const makerETHAfter = await mockETH.balanceOf(maker.address);
    const makerUSDCAfter = await mockUSDC.balanceOf(maker.address);
    const makerDummyAfter = await dummyOptionToken.balanceOf(maker.address);
    const takerETHAfter = await mockETH.balanceOf(taker.address);
    const takerUSDCAfter = await mockUSDC.balanceOf(taker.address);
    const takerDummyAfter = await dummyOptionToken.balanceOf(taker.address);
    
    console.log(`Maker ETH: ${ethers.formatEther(makerETHAfter)} (${ethers.formatEther(makerETHAfter - makerETHBefore)})`);
    console.log(`Maker USDC: ${ethers.formatUnits(makerUSDCAfter, 6)} (${ethers.formatUnits(makerUSDCAfter - makerUSDCBefore, 6)})`);
    console.log(`Maker Dummy: ${ethers.formatEther(makerDummyAfter)} (${ethers.formatEther(makerDummyAfter - makerDummyBefore)})`);
    console.log(`Taker ETH: ${ethers.formatEther(takerETHAfter)} (${ethers.formatEther(takerETHAfter - takerETHBefore)})`);
    console.log(`Taker USDC: ${ethers.formatUnits(takerUSDCAfter, 6)} (${ethers.formatUnits(takerUSDCAfter - takerUSDCBefore, 6)})`);
    console.log(`Taker Dummy: ${ethers.formatEther(takerDummyAfter)} (${ethers.formatEther(takerDummyAfter - takerDummyBefore)})`);

    // Check NFT ownership
    console.log("\n🖼️ Checking NFT ownership...");
    const takerNFTCount = await optionsNFT.balanceOf(taker.address);
    console.log(`Taker NFT count: ${takerNFTCount}`);
    
    if (takerNFTCount > 0) {
      const tokenId = await optionsNFT.tokenOfOwnerByIndex(taker.address, 0);
      console.log(`Taker's first NFT ID: ${tokenId}`);
      
      // Get option details
      const option = await optionsNFT.getOption(tokenId);
      console.log(`Option details:`);
      console.log(`- Underlying Asset: ${option.underlyingAsset}`);
      console.log(`- Strike Asset: ${option.strikeAsset}`);
      console.log(`- Maker: ${option.maker}`);
      console.log(`- Strike Price: ${ethers.formatUnits(option.strikePrice, 6)} USDC`);
      console.log(`- Expiry: ${new Date(Number(option.expiry) * 1000).toISOString()}`);
      console.log(`- Amount: ${ethers.formatEther(option.amount)} ETH`);
      console.log(`- Exercised: ${option.exercised}`);
      
      console.log("✅ NFT successfully minted with full option data!");
    }
    
    // Burn the dummy tokens received by taker (they have no real value)
    console.log("\n🔥 Burning dummy tokens received by taker...");
    const takerDummyBalance = await dummyOptionToken.balanceOf(taker.address);
    if (takerDummyBalance > 0) {
      await dummyOptionToken.connect(taker).burn(takerDummyBalance);
      console.log(`Burned ${ethers.formatEther(takerDummyBalance)} dummy tokens`);
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