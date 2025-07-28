const { ethers } = require("hardhat");

// Helper to encode address as 32-byte left-padded hex string (1inch Address type)
function toAddressType(addr) {
  addr = addr.toLowerCase().replace(/^0x/, "");
  return "0x" + addr.padStart(64, "0");
}

async function main() {
  console.log("🚀 Testing Options Protocol with Limit Order Protocol");
  console.log("=====================================================");

  // Get signers
  const [deployer, maker, taker] = await ethers.getSigners();
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Maker: ${maker.address}`);
  console.log(`Taker: ${taker.address}`);

  // Deploy mock tokens
  console.log("\n📦 Deploying Mock Tokens...");
  const MockERC20 = await ethers.getContractFactory("MockERC20");
  const underlyingToken = await MockERC20.deploy("Underlying Token", "UND");
  const strikeToken = await MockERC20.deploy("Strike Token", "STRK");
  
  console.log(`Underlying Token deployed: ${underlyingToken.target}`);
  console.log(`Strike Token deployed: ${strikeToken.target}`);

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
  const OptionsNFT = await ethers.getContractFactory("OptionNFT");
  const optionsNFT = await OptionsNFT.deploy(lop.target);
  console.log(`Options NFT deployed: ${optionsNFT.target}`);

  // Mint tokens to maker and taker
  console.log("\n💰 Minting tokens...");
  const mintAmount = ethers.parseEther("1000");
  
  await underlyingToken.mint(maker.address, mintAmount);
  await strikeToken.mint(taker.address, mintAmount);
  
  console.log(`Minted ${ethers.formatEther(mintAmount)} Underlying Token to maker`);
  console.log(`Minted ${ethers.formatEther(mintAmount)} Strike Token to taker`);

  // Approve tokens for LOP
  console.log("\n✅ Approving tokens for LOP...");
  await underlyingToken.connect(maker).approve(lop.target, mintAmount);
  await strikeToken.connect(taker).approve(lop.target, mintAmount);
  console.log("Tokens approved for LOP");

  // Create option parameters
  console.log("\n📝 Creating option parameters...");
  const salt = ethers.getBigInt(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER));
  const strikePrice = ethers.parseEther("100"); // Strike price: 100 strike tokens per underlying
  const expiry = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
  const optionAmount = ethers.parseEther("10"); // 10 underlying tokens
  const premium = ethers.parseEther("50"); // 50 strike tokens premium
  
  // Create order parameters for the option
  const order = {
    salt,
    maker: toAddressType(maker.address),
    receiver: toAddressType(maker.address),
    makerAsset: toAddressType(underlyingToken.target),
    takerAsset: toAddressType(strikeToken.target),
    makingAmount: optionAmount,
    takingAmount: premium,
    makerTraits: 0
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

  console.log("Option Order parameters:");
  console.log(`- Strike Price: ${ethers.formatEther(strikePrice)} Strike/Underlying`);
  console.log(`- Expiry: ${new Date(expiry * 1000).toISOString()}`);
  console.log(`- Option Amount: ${ethers.formatEther(optionAmount)} Underlying`);
  console.log(`- Premium: ${ethers.formatEther(premium)} Strike`);
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
    makerAsset: underlyingToken.target,
    takerAsset: strikeToken.target,
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
  const makerUnderlyingBefore = await underlyingToken.balanceOf(maker.address);
  const makerStrikeBefore = await strikeToken.balanceOf(maker.address);
  const takerUnderlyingBefore = await underlyingToken.balanceOf(taker.address);
  const takerStrikeBefore = await strikeToken.balanceOf(taker.address);
  
  console.log(`Maker Underlying: ${ethers.formatEther(makerUnderlyingBefore)}`);
  console.log(`Maker Strike: ${ethers.formatEther(makerStrikeBefore)}`);
  console.log(`Taker Underlying: ${ethers.formatEther(takerUnderlyingBefore)}`);
  console.log(`Taker Strike: ${ethers.formatEther(takerStrikeBefore)}`);

  // Fill the order with interaction to mint NFT
  console.log("\n🔄 Filling order with NFT minting...");
  const fillAmount = ethers.parseEther("25"); // Fill half the premium
  
  try {
    // Create interaction data for NFT minting
    const interactionData = ethers.AbiCoder.defaultAbiCoder().encode(
      ["address", "uint256", "uint256", "uint256"],
      [underlyingToken.target, strikePrice, expiry, optionAmount]
    );

    // Fill order with interaction
    const tx = await lop.connect(taker).fillOrderArgs(
      orderTuple,
      r,
      vs,
      fillAmount,
      0, // No taker traits
      interactionData // Interaction data
    );
    
    const receipt = await tx.wait();
    console.log(`✅ Order filled successfully with NFT minting!`);
    console.log(`Transaction hash: ${receipt.hash}`);
    
    // Check balances after
    console.log("\n💰 Checking balances after fill...");
    const makerUnderlyingAfter = await underlyingToken.balanceOf(maker.address);
    const makerStrikeAfter = await strikeToken.balanceOf(maker.address);
    const takerUnderlyingAfter = await underlyingToken.balanceOf(taker.address);
    const takerStrikeAfter = await strikeToken.balanceOf(taker.address);
    
    console.log(`Maker Underlying: ${ethers.formatEther(makerUnderlyingAfter)} (${ethers.formatEther(makerUnderlyingAfter - makerUnderlyingBefore)})`);
    console.log(`Maker Strike: ${ethers.formatEther(makerStrikeAfter)} (${ethers.formatEther(makerStrikeAfter - makerStrikeBefore)})`);
    console.log(`Taker Underlying: ${ethers.formatEther(takerUnderlyingAfter)} (${ethers.formatEther(takerUnderlyingAfter - takerUnderlyingBefore)})`);
    console.log(`Taker Strike: ${ethers.formatEther(takerStrikeAfter)} (${ethers.formatEther(takerStrikeAfter - takerStrikeBefore)})`);

    // Check NFT ownership
    console.log("\n🖼️ Checking NFT ownership...");
    const takerNFTCount = await optionsNFT.balanceOf(taker.address);
    console.log(`Taker NFT count: ${takerNFTCount}`);
    
    if (takerNFTCount > 0) {
      const tokenId = await optionsNFT.tokenOfOwnerByIndex(taker.address, 0);
      console.log(`Taker's first NFT ID: ${tokenId}`);
      
      // Get NFT details
      const nftDetails = await optionsNFT.getOptionDetails(tokenId);
      console.log("NFT Details:");
      console.log(`- Underlying: ${nftDetails.underlying}`);
      console.log(`- Strike Price: ${ethers.formatEther(nftDetails.strikePrice)}`);
      console.log(`- Expiry: ${new Date(Number(nftDetails.expiry) * 1000).toISOString()}`);
      console.log(`- Amount: ${ethers.formatEther(nftDetails.amount)}`);
      console.log(`- Owner: ${nftDetails.owner}`);
    }
    
    console.log("\n🎉 Options protocol test completed successfully!");
    
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