const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("OptionNFT", function () {
  let optionNFT;
  let deployer;
  let user;

  beforeEach(async () => {
    [deployer, user] = await ethers.getSigners();
    const OptionNFT = await ethers.getContractFactory("OptionNFT");
    optionNFT = await OptionNFT.deploy();
    await optionNFT.waitForDeployment();
  });

  it("should mint an option NFT with correct metadata", async function () {
    const strikePrice = ethers.parseUnits("3000", 6); // 3000 USDC
    const expiry = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60; // 7 days from now

    const tx = await optionNFT.mintOption(
      user.address,
      ethers.ZeroAddress, // mock WETH
      ethers.ZeroAddress, // mock USDC
      strikePrice,
      expiry,
      true
    );
    await tx.wait();

    const owner = await optionNFT.ownerOf(0);
    expect(owner).to.equal(user.address);

    const option = await optionNFT.options(0);
    expect(option.strikePrice).to.equal(strikePrice);
    expect(option.expiry).to.equal(expiry);
    expect(option.isCall).to.equal(true);
  });

  it("should revert if expiry is in the past", async function () {
    const past = Math.floor(Date.now() / 1000) - 100;

    await expect(
      optionNFT.mintOption(
        user.address,
        ethers.ZeroAddress,
        ethers.ZeroAddress,
        1000n,
        past,
        true
      )
    ).to.be.revertedWith("Invalid expiry");
  });
});
