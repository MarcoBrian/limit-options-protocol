// frontend/src/utils/orderFiller.ts
import { ethers } from 'ethers';
import { getContractAddresses } from '../config/contracts';

// LOP Contract ABI - only the functions we need
const LOP_ABI = [
  "function fillOrderArgs((uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256),bytes32,bytes32,uint256,uint256,bytes) external returns (uint256, uint256, bytes32)"
];

// ERC20 ABI for approvals
const ERC20_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function balanceOf(address account) external view returns (uint256)"
];

/**
 * Calculate taker traits from interaction data length
 */
function calculateTakerTraits(interactionData: string | null | undefined): bigint {
  // Handle null/undefined interactionData
  const safeInteractionData = interactionData || '0x';
  const length = safeInteractionData.length / 2 - 1; // Hex string length
  return BigInt(length) << 200n;
}

/**
 * Build order tuple from database order format
 */
function buildOrderTuple(order: any): any[] {
  return [
    BigInt(order.salt),
    order.maker,
    order.receiver,
    order.maker_asset,
    order.taker_asset,
    BigInt(order.making_amount),
    BigInt(order.taking_amount),
    BigInt(order.maker_traits)
  ];
}

/**
 * Build signature components (r, vs format for LOP)
 */
function buildSignatureComponents(signature: any): { r: string; vs: string } {
  const r = signature.r;
  let vsBigInt = BigInt(signature.s);
  
  // Apply EIP-2098 compact signature format
  if (signature.v === 28) {
    vsBigInt |= (BigInt(1) << BigInt(255));
  }
  
  const vs = ethers.zeroPadValue(ethers.toBeHex(vsBigInt), 32);
  
  return { r, vs };
}

/**
 * Check if user has sufficient USDC allowance for the LOP contract
 */
async function checkUSDCAllowance(
  signer: ethers.Signer,
  usdcAddress: string,
  lopAddress: string,
  requiredAmount: bigint
): Promise<boolean> {
  try {
    const userAddress = await signer.getAddress();
    const usdcContract = new ethers.Contract(usdcAddress, ERC20_ABI, signer);
    
    const allowance = await usdcContract.allowance(userAddress, lopAddress);
    console.log(`🔍 USDC Allowance: ${allowance.toString()}, Required: ${requiredAmount.toString()}`);
    
    return allowance >= requiredAmount;
  } catch (error) {
    console.error('Error checking USDC allowance:', error);
    return false;
  }
}

/**
 * Approve USDC spending for LOP contract
 */
async function approveUSDC(
  signer: ethers.Signer,
  usdcAddress: string,
  lopAddress: string,
  amount: bigint
): Promise<void> {
  console.log('💰 Requesting USDC approval...');
  
  const usdcContract = new ethers.Contract(usdcAddress, ERC20_ABI, signer);
  
  // Request approval for the exact amount + some buffer for gas
  const approvalAmount = amount * 2n; // 2x buffer
  
  const tx = await usdcContract.approve(lopAddress, approvalAmount);
  console.log(`⏳ Approval transaction sent: ${tx.hash}`);
  
  await tx.wait();
  console.log('✅ USDC approval confirmed');
}

/**
 * Check user's USDC balance
 */
async function checkUSDCBalance(
  signer: ethers.Signer,
  usdcAddress: string,
  requiredAmount: bigint
): Promise<boolean> {
  try {
    const userAddress = await signer.getAddress();
    const usdcContract = new ethers.Contract(usdcAddress, ERC20_ABI, signer);
    const balance = await usdcContract.balanceOf(userAddress);
    console.log(`🔍 USDC Balance: ${balance.toString()}, Required: ${requiredAmount.toString()}`);
    
    return balance >= requiredAmount;
  } catch (error) {
    console.error('Error checking USDC balance:', error);
    return false;
  }
}

/**
 * Fill an option order using MetaMask
 */
export async function fillOrder(
  order: any,
  signer: ethers.Signer,
  onProgress?: (status: string) => void
): Promise<{ txHash: string; optionTokenId?: number }> {
  console.log('🚀 Starting order fill process...');
  onProgress?.('Preparing transaction...');
  
  try {
    const contractAddresses = getContractAddresses();
    const userAddress = await signer.getAddress();
    
    // Step 1: Parse order data
    console.log('📋 Step 1: Parsing order data...');
    const orderTuple = buildOrderTuple(order);
    const signature = typeof order.signature === 'string' 
      ? JSON.parse(order.signature) 
      : order.signature;
    const { r, vs } = buildSignatureComponents(signature);
    
    const fillAmount = BigInt(order.taking_amount);
    const interactionData = order.interaction_data || '0x';
    const takerTraits = calculateTakerTraits(interactionData);
    
    console.log('   ✅ Order tuple built');
    console.log('   ✅ Signature components ready');
    console.log('   🔍 Fill amount:', fillAmount.toString());
    console.log('   🔍 Taker traits:', takerTraits.toString());
    
    // Step 2: Check USDC balance
    console.log('📋 Step 2: Checking USDC balance...');
    onProgress?.('Checking balance...');
    
    const hasBalance = await checkUSDCBalance(signer, order.taker_asset, fillAmount);
    if (!hasBalance) {
      throw new Error(`Insufficient USDC balance. Required: ${ethers.formatUnits(fillAmount, 6)} USDC`);
    }
    console.log('   ✅ Sufficient USDC balance confirmed');
    
    // Step 3: Check/Handle USDC approval
    console.log('📋 Step 3: Checking USDC approval...');
    onProgress?.('Checking approvals...');
    
    const hasAllowance = await checkUSDCAllowance(
      signer,
      order.taker_asset,
      contractAddresses.lopAddress,
      fillAmount
    );
    
    if (!hasAllowance) {
      console.log('   ⚠️ Insufficient allowance, requesting approval...');
      onProgress?.('Requesting USDC approval...');
      
      await approveUSDC(
        signer,
        order.taker_asset,
        contractAddresses.lopAddress,
        fillAmount
      );
    } else {
      console.log('   ✅ Sufficient USDC allowance confirmed');
    }
    
    // Step 4: Fill the order
    console.log('📋 Step 4: Filling order on-chain...');
    onProgress?.('Filling order...');
    
    const lopContract = new ethers.Contract(
      contractAddresses.lopAddress,
      LOP_ABI,
      signer
    );
    
    console.log('   🔍 Calling fillOrderArgs with:');
    console.log('     Order tuple length:', orderTuple.length);
    console.log('     R:', r);
    console.log('     VS:', vs);
    console.log('     Fill amount:', fillAmount.toString());
    console.log('     Taker traits:', takerTraits.toString());
    console.log('     Interaction data length:', interactionData.length);
    
    const tx = await lopContract.fillOrderArgs(
      orderTuple,
      r,
      vs,
      fillAmount,
      takerTraits,
      interactionData
    );
    
    console.log('   ✅ Transaction sent:', tx.hash);
    onProgress?.('Confirming transaction...');
    
    const receipt = await tx.wait();
    console.log('   ✅ Transaction confirmed!');
    console.log('   🔍 Gas used:', receipt.gasUsed.toString());
    
    // Step 5: Extract option token ID from events
    let optionTokenId: number | undefined;
    
    // Look for NFT Transfer event (ERC721 Transfer)
    for (const log of receipt.logs) {
      try {
        // ERC721 Transfer event signature: Transfer(address,address,uint256)
        if (log.topics[0] === '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef') {
          // Check if this is from the OptionsNFT contract and to our user
          if (log.address.toLowerCase() === contractAddresses.optionsNFTAddress.toLowerCase()) {
            const toAddress = ethers.getAddress('0x' + log.topics[2].slice(26)); // Remove leading zeros
            if (toAddress.toLowerCase() === userAddress.toLowerCase()) {
              optionTokenId = parseInt(log.topics[3], 16);
              console.log('   🎉 Option NFT Token ID:', optionTokenId);
              break;
            }
          }
        }
      } catch (error) {
        // Skip logs we can't parse
        continue;
      }
    }
    
    console.log('🎉 Order fill completed successfully!');
    onProgress?.('Order filled successfully!');
    
    return {
      txHash: tx.hash,
      optionTokenId
    };
    
  } catch (error: any) {
    console.error('❌ Order fill failed:', error);
    
    console.error('🔍 Original error:', error);
    
    // Parse specific error messages
    let errorMessage = error.message || 'Unknown error occurred';
    
    if (error.code === 4001) {
      errorMessage = 'Transaction rejected by user';
    } else if (error.message?.includes('insufficient funds')) {
      errorMessage = 'Insufficient funds for gas';
    } else if (error.message?.includes('exceeds balance')) {
      errorMessage = 'Insufficient USDC balance';
    } else if (error.message?.includes('nonce')) {
      errorMessage = 'Transaction nonce error. Please try again.';
    }
    
    throw new Error(errorMessage);
  }
}

/**
 * Estimate gas for filling an order
 */
export async function estimateFillGas(
  order: any,
  signer: ethers.Signer
): Promise<bigint> {
  try {
    const contractAddresses = getContractAddresses();
    
    const orderTuple = buildOrderTuple(order);
    const signature = typeof order.signature === 'string' 
      ? JSON.parse(order.signature) 
      : order.signature;
    const { r, vs } = buildSignatureComponents(signature);
    
    const fillAmount = BigInt(order.taking_amount);
    const interactionData = order.interaction_data;
    const takerTraits = calculateTakerTraits(interactionData);
    
    const lopContract = new ethers.Contract(
      contractAddresses.lopAddress,
      LOP_ABI,
      signer
    );
    
    const gasEstimate = await lopContract.fillOrderArgs.estimateGas(
      orderTuple,
      r,
      vs,
      fillAmount,
      takerTraits,
      interactionData
    );
    
    return gasEstimate;
  } catch (error) {
    console.error('Gas estimation failed:', error);
    // Return a reasonable default if estimation fails
    return BigInt(500000);
  }
}