const { ethers } = require("hardhat");

async function main() {
  const OptionNFT = await ethers.getContractFactory("OptionNFT");
  const optionNFT = await OptionNFT.deploy();

  await optionNFT.waitForDeployment();

  console.log("✅ OptionNFT deployed at:", optionNFT.address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
