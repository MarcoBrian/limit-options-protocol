const { ethers } = require("hardhat");

// Helper to encode address as 32-byte left-padded hex string (1inch Address type)
function toAddressType(addr) {
  addr = addr.toLowerCase().replace(/^0x/, "");
  return "0x" + addr.padStart(64, "0");
}

async function main() {
  console.log("🚀 Testing Limit Order Protocol Interaction (v2)");
  console.log("================================================");

  // Get signers
  const [deployer, maker, taker] = await ethers.getSigners();
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Maker: ${maker.address}`);
  console.log(`Taker: ${taker.address}`);

  // Deploy mock tokens
  console.log("\n📦 Deploying Mock Tokens...");
  const MockERC20 = await ethers.getContractFactory("MockERC20");
  const tokenA = await MockERC20.deploy("Token A", "TKA");
  const tokenB = await MockERC20.deploy("Token B", "TKB");
  
  console.log(`Token A deployed: ${tokenA.target}`);
  console.log(`Token B deployed: ${tokenB.target}`);

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

  // Mint tokens to maker and taker
  console.log("\n💰 Minting tokens...");
  const mintAmount = ethers.parseEther("1000");
  
  await tokenA.mint(maker.address, mintAmount);
  await tokenB.mint(taker.address, mintAmount);
  
  console.log(`Minted ${ethers.formatEther(mintAmount)} Token A to maker`);
  console.log(`Minted ${ethers.formatEther(mintAmount)} Token B to taker`);

  // Approve tokens for LOP
  console.log("\n✅ Approving tokens for LOP...");
  await tokenA.connect(maker).approve(lop.target, mintAmount);
  await tokenB.connect(taker).approve(lop.target, mintAmount);
  console.log("Tokens approved for LOP");

  // Create order parameters
  console.log("\n📝 Creating order parameters...");
  const salt = ethers.getBigInt(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER));
  const makingAmount = ethers.parseEther("100"); // Maker offers 100 Token A
  const takingAmount = ethers.parseEther("50");  // Taker pays 50 Token B
  
  // Encode all address fields as 32-byte left-padded hex strings
  const order = {
    salt,
    maker: toAddressType(maker.address),
    receiver: toAddressType(maker.address),
    makerAsset: toAddressType(tokenA.target),
    takerAsset: toAddressType(tokenB.target),
    makingAmount,
    takingAmount,
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

  console.log("Order parameters:");
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
    makerAsset: tokenA.target,
    takerAsset: tokenB.target,
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
  const makerTokenABefore = await tokenA.balanceOf(maker.address);
  const makerTokenBBefore = await tokenB.balanceOf(maker.address);
  const takerTokenABefore = await tokenA.balanceOf(taker.address);
  const takerTokenBBefore = await tokenB.balanceOf(taker.address);
  
  console.log(`Maker Token A: ${ethers.formatEther(makerTokenABefore)}`);
  console.log(`Maker Token B: ${ethers.formatEther(makerTokenBBefore)}`);
  console.log(`Taker Token A: ${ethers.formatEther(takerTokenABefore)}`);
  console.log(`Taker Token B: ${ethers.formatEther(takerTokenBBefore)}`);

  // Fill the order
  console.log("\n🔄 Filling order...");
  const fillAmount = ethers.parseEther("25"); // Fill half the order
  
  try {
    const tx = await lop.connect(taker).fillOrder(
      orderTuple,
      r,
      vs,
      fillAmount,
      0 // No taker traits
    );
    
    const receipt = await tx.wait();
    console.log(`✅ Order filled successfully!`);
    console.log(`Transaction hash: ${receipt.hash}`);
    
    // Check balances after
    console.log("\n💰 Checking balances after fill...");
    const makerTokenAAfter = await tokenA.balanceOf(maker.address);
    const makerTokenBAfter = await tokenB.balanceOf(maker.address);
    const takerTokenAAfter = await tokenA.balanceOf(taker.address);
    const takerTokenBAfter = await tokenB.balanceOf(taker.address);
    
    console.log(`Maker Token A: ${ethers.formatEther(makerTokenAAfter)} (${ethers.formatEther(makerTokenAAfter - makerTokenABefore)})`);
    console.log(`Maker Token B: ${ethers.formatEther(makerTokenBAfter)} (${ethers.formatEther(makerTokenBAfter - makerTokenBBefore)})`);
    console.log(`Taker Token A: ${ethers.formatEther(takerTokenAAfter)} (${ethers.formatEther(takerTokenAAfter - takerTokenABefore)})`);
    console.log(`Taker Token B: ${ethers.formatEther(takerTokenBAfter)} (${ethers.formatEther(takerTokenBAfter - takerTokenBBefore)})`);
    
    console.log("\n🎉 Test completed successfully!");
    
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