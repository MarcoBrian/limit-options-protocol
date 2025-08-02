// frontend/src/utils/optionsFetcher.ts
import { ethers } from 'ethers';
import { getContractAddresses } from '../config/contracts';

// OptionsNFT Contract ABI - only the functions we need
const OPTIONS_NFT_ABI = [
  "function balanceOf(address owner) external view returns (uint256)",
  "function tokenOfOwnerByIndex(address owner, uint256 index) external view returns (uint256)",
  "function options(uint256 tokenId) external view returns (address underlyingAsset, address strikeAsset, address maker, uint256 strikePrice, uint256 expiry, uint256 amount, bool exercised)",
  "function getOption(uint256 optionId) external view returns (tuple(address underlyingAsset, address strikeAsset, address maker, uint256 strikePrice, uint256 expiry, uint256 amount, bool exercised))",
  "function exercise(uint256 optionId) external"
];

// ERC20 ABI for token operations
const ERC20_ABI = [
  "function balanceOf(address owner) external view returns (uint256)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function decimals() external view returns (uint8)"
];

export interface UserOption {
  tokenId: number;
  underlyingAsset: string;
  strikeAsset: string;
  maker: string;
  strikePrice: string;
  expiry: number;
  amount: string;
  exercised: boolean;
}

/**
 * Fetch all options owned by a user
 */
export async function fetchUserOptions(
  userAddress: string,
  signer: ethers.Signer
): Promise<UserOption[]> {
  try {
    console.log('🔍 Fetching options for user:', userAddress);
    
    const contractAddresses = getContractAddresses();
    const optionsNFT = new ethers.Contract(
      contractAddresses.optionsNFTAddress,
      OPTIONS_NFT_ABI,
      signer
    );
    
    // Get the number of NFTs owned by the user
    const balance = await optionsNFT.balanceOf(userAddress);
    const numOptions = Number(balance);
    
    console.log(`   📊 User owns ${numOptions} option NFTs`);
    
    if (numOptions === 0) {
      return [];
    }
    
    // Fetch all token IDs owned by the user
    const tokenIds: number[] = [];
    for (let i = 0; i < numOptions; i++) {
      try {
        const tokenId = await optionsNFT.tokenOfOwnerByIndex(userAddress, i);
        tokenIds.push(Number(tokenId));
      } catch (error) {
        console.error(`Error fetching token at index ${i}:`, error);
        // Continue with other tokens
      }
    }
    
    console.log('   🔢 Token IDs:', tokenIds);
    
    // Fetch details for each token
    const options: UserOption[] = [];
    for (const tokenId of tokenIds) {
      try {
        const details = await optionsNFT.options(tokenId);
        
        const option: UserOption = {
          tokenId,
          underlyingAsset: details[0],
          strikeAsset: details[1],
          maker: details[2],
          strikePrice: details[3].toString(),
          expiry: Number(details[4]),
          amount: details[5].toString(),
          exercised: details[6]
        };
        
        options.push(option);
        console.log(`   ✅ Loaded option ${tokenId}:`, {
          strikePrice: ethers.formatUnits(option.strikePrice, 6),
          amount: ethers.formatEther(option.amount),
          expiry: new Date(option.expiry * 1000).toLocaleDateString(),
          exercised: option.exercised
        });
      } catch (error) {
        console.error(`Error fetching details for token ${tokenId}:`, error);
        // Continue with other tokens
      }
    }
    
    console.log(`🎉 Successfully loaded ${options.length} options`);
    return options;
    
  } catch (error) {
    console.error('❌ Error fetching user options:', error);
    throw new Error('Failed to fetch your options. Please try again.');
  }
}

/**
 * Exercise an option NFT
 */
export async function exerciseOption(
  tokenId: number,
  signer: ethers.Signer,
  onProgress?: (status: string) => void
): Promise<{ txHash: string }> {
  try {
    console.log('🏃‍♂️ Exercising option:', tokenId);
    onProgress?.('Preparing to exercise option...');
    
    const contractAddresses = getContractAddresses();
    const optionsNFT = new ethers.Contract(
      contractAddresses.optionsNFTAddress,
      OPTIONS_NFT_ABI,
      signer
    );
    
    const userAddress = await signer.getAddress();
    
    // Check if option is still valid
    console.log('   🔍 Checking option validity...');
    const details = await optionsNFT.getOption(tokenId);
    const strikeAsset = details[1];
    const strikePrice = details[3];
    const expiry = Number(details[4]);
    const exercised = details[6];
    
    if (exercised) {
      throw new Error('Option has already been exercised');
    }
    
    if (Date.now() / 1000 > expiry) {
      throw new Error('Option has expired and cannot be exercised');
    }
    
    console.log('   ✅ Option is valid for exercise');
    console.log('   🔍 Strike asset:', strikeAsset);
    console.log('   🔍 Strike price:', strikePrice.toString());
    
    // Check strike asset balance and approval
    onProgress?.('Checking strike asset balance and approval...');
    
    const strikeToken = new ethers.Contract(
      strikeAsset,
      ERC20_ABI,
      signer
    );
    
    // Check balance
    const balance = await strikeToken.balanceOf(userAddress);
    console.log('   🔍 User balance:', balance.toString());
    console.log('   🔍 Required:', strikePrice.toString());
    
    if (balance < strikePrice) {
      const decimals = await strikeToken.decimals();
      const balanceFormatted = ethers.formatUnits(balance, decimals);
      const requiredFormatted = ethers.formatUnits(strikePrice, decimals);
      throw new Error(`Insufficient strike asset balance. You have ${balanceFormatted} but need ${requiredFormatted}`);
    }
    
    // Check approval
    const allowance = await strikeToken.allowance(userAddress, contractAddresses.optionsNFTAddress);
    console.log('   🔍 Current allowance:', allowance.toString());
    
    if (allowance < strikePrice) {
      console.log('   ⚠️ Insufficient allowance, requesting approval...');
      onProgress?.('Approving strike asset for exercise...');
      
      // Request approval for the exact strike price needed
      const approveTx = await strikeToken.approve(contractAddresses.optionsNFTAddress, strikePrice);
      console.log('   ✅ Approval transaction sent:', approveTx.hash);
      
      onProgress?.('Confirming approval...');
      await approveTx.wait();
      console.log('   ✅ Strike asset approved for exercise');
    } else {
      console.log('   ✅ Sufficient allowance confirmed');
    }
    
    // Exercise the option
    console.log('   🎯 Exercising option...');
    onProgress?.('Exercising option...');
    
    const tx = await optionsNFT.exercise(tokenId);
    console.log('   ✅ Exercise transaction sent:', tx.hash);
    
    onProgress?.('Confirming transaction...');
    
    const receipt = await tx.wait();
    console.log('   ✅ Option exercised successfully!');
    console.log('   🔍 Gas used:', receipt.gasUsed.toString());
    
    return { txHash: tx.hash };
    
  } catch (error: any) {
    console.error('❌ Exercise failed:', error);
    
    // Parse specific error messages
    let errorMessage = error.message || 'Unknown error occurred';
    
    if (error.code === 4001) {
      errorMessage = 'Transaction rejected by user';
    } else if (error.message?.includes('already been exercised')) {
      errorMessage = 'This option has already been exercised';
    } else if (error.message?.includes('expired')) {
      errorMessage = 'This option has expired and cannot be exercised';
    } else if (error.message?.includes('insufficient funds')) {
      errorMessage = 'Insufficient funds for gas';
    } else if (error.message?.includes('Insufficient strike asset balance')) {
      errorMessage = error.message;
    } else if (error.message?.includes('Strike payment failed')) {
      errorMessage = 'Strike payment failed - check your token balance and allowance';
    } else if (error.message?.includes('Asset transfer failed')) {
      errorMessage = 'Asset transfer failed - the contract may not have the underlying asset';
    }
    
    throw new Error(errorMessage);
  }
}